import { BERRY_HEAL, EAT_COOLDOWN_MS, MAX_PLAYERS, RESOURCES, RESOURCE_INFO, type Resource } from "@petgame/shared";
import { ToastQueue, toastRoom, type ToastLevel } from "./toastQueue.ts";

/** How long (ms) a toast fades out before its element is removed; matches the CSS transition on `.toast`. */
const TOAST_FADE_MS = 200;

/** DOM overlay: status panel, toasts (see toastQueue.ts), touch action buttons. */
export class Hud {
  readonly root: HTMLDivElement;
  /** The joystick's half of the screen (touch only): the HUD's bottom layer (CSS), so it gets only the touches nothing else takes. */
  readonly joystickZone: HTMLDivElement;
  /** Left column under the health bar (status, quest tracker). */
  readonly left: HTMLDivElement;
  private status: HTMLDivElement;
  private toasts: HTMLDivElement;
  private toastQueue = new ToastQueue(() => toastRoom(window.innerWidth, window.innerHeight));
  private toastElements = new Map<number, HTMLDivElement>();
  private lastStatus = "";
  private ballButton: HTMLButtonElement;
  private health: HTMLDivElement;
  private lastHealth = "";
  private lastTime = "";
  private soundButton!: HTMLButtonElement;
  private bossBar!: HTMLDivElement;
  private eatButton: HTMLButtonElement;
  private eatCover: HTMLSpanElement;
  private eatSecs: HTMLSpanElement;
  /** When the Ăn button is ready again (performance.now ms; 0 = ready), the wait's length, and what is shown now. */
  private eatUntil = 0;
  private eatTotal = 1;
  private eatPercent = 0;
  private eatSecsShown = 0;

  constructor(
    parent: HTMLElement,
    private isTouch: boolean,
    actions: { attack: () => void; dash: () => void; capture: () => void; placeBase: () => void; toggleBall: () => void; eat: () => void; toggleSound: () => boolean },
  ) {
    // Touch screens: the joystick's zone is the HUD's bottom layer, and the column's panels let touches through to it (index.html).
    this.root = div(isTouch ? "hud touch" : "hud");
    this.status = div("hud-status");
    this.toasts = div("hud-toasts");
    this.toasts.setAttribute("role", "status");
    this.toasts.setAttribute("aria-live", "polite");
    this.joystickZone = div("joystick-zone");
    this.health = div("hud-health");
    this.health.innerHTML = `<span class="hud-time"></span><span class="hud-region"></span><span class="hud-heart">❤️</span><div class="hud-hp"><div></div></div><span class="hud-hp-text"></span>`;
    this.eatButton = document.createElement("button");
    this.eatButton.className = "eat-btn";
    this.eatButton.innerHTML = `<span class="eat-label">🫐 Ăn</span><span class="eat-cd"></span><span class="eat-secs"></span>`;
    this.eatCover = this.eatButton.querySelector<HTMLSpanElement>(".eat-cd")!;
    this.eatSecs = this.eatButton.querySelector<HTMLSpanElement>(".eat-secs")!;
    this.eatButton.title = `Ăn 1 quả mọng: hồi ${BERRY_HEAL} máu, rồi chờ ${EAT_COOLDOWN_MS / 1000} giây mới ăn tiếp (phím H)`;
    onPress(this.eatButton, actions.eat);
    this.soundButton = document.createElement("button");
    this.soundButton.className = "sound-btn";
    this.soundButton.title = "Bật/tắt âm thanh (phím M)";
    this.soundButton.addEventListener("click", () => this.setMuted(actions.toggleSound()));
    // The two buttons wrap to the second line together, so the health row keeps its height (T18).
    const actionsRow = div("hud-actions");
    actionsRow.append(this.eatButton, this.soundButton);
    this.health.append(actionsRow);
    this.bossBar = div("boss-bar");
    this.bossBar.innerHTML = `<strong></strong><div class="boss-hp"><div></div></div>`;
    this.bossBar.hidden = true;
    this.root.append(this.bossBar);
    this.left = div("hud-left");
    // The toasts sit last in the column (CSS order), under the quest tracker that is added to it later.
    this.left.append(this.health, this.status, this.toasts);
    this.root.append(this.left);
    // Invite button (phones): share sheet if available, else copy the link. It stays on click: both need a user gesture,
    // which a touch only gives as the finger lifts.
    this.status.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(".invite-btn");
      if (!button) return;
      const link = button.dataset.link ?? "";
      if (navigator.share) navigator.share({ title: "PetGame", text: "Vào chơi cùng mình!", url: link }).catch(() => {});
      else navigator.clipboard?.writeText(link).then(() => this.showToast("Đã chép link mời 🔗", "low"), () => this.showToast(link, "low"));
    });
    const base = document.createElement("button");
    base.className = "base-btn";
    base.textContent = "🏕️ Đặt trại";
    base.title = "Dựng trại ở chỗ đang đứng (phím B)";
    base.addEventListener("click", actions.placeBase);
    this.root.append(base);
    this.ballButton = document.createElement("button");
    this.ballButton.className = isTouch ? "ball-btn touch" : "ball-btn";
    this.ballButton.title = "Đổi loại bóng (phím R)";
    onPress(this.ballButton, actions.toggleBall);
    this.root.append(this.ballButton);

    if (isTouch) {
      this.root.append(this.joystickZone);
      this.root.append(button("btn-attack", "Đánh", actions.attack), button("btn-capture", "Bắt", actions.capture), button("btn-dash", "💨", actions.dash));
    }
    parent.append(this.root);
  }

  /** The server let the player eat a berry: the Ăn button recharges for `ms`, counted from now. */
  eatStarted(ms: number) {
    this.eatUntil = performance.now() + ms;
    this.eatTotal = ms;
  }

  /** Whether the Ăn button has recharged (compared with the clock, not the class, so a slow frame cannot lie). */
  eatReady(now: number): boolean {
    return now >= this.eatUntil;
  }

  /** Shakes the Ăn button: pressed while it recharges. */
  refuseEat() {
    this.eatButton.classList.remove("nope");
    void this.eatButton.offsetWidth; // restart the shake
    this.eatButton.classList.add("nope");
  }

  /** Per frame: shrinks the dark sweep and counts the seconds left; the DOM is written only when a shown value changes. */
  tickEat(now: number) {
    const left = Math.max(0, this.eatUntil - now);
    const percent = left > 0 ? Math.ceil((left / this.eatTotal) * 100) : 0;
    const secs = Math.ceil(left / 1000);
    if (percent !== this.eatPercent) {
      this.eatPercent = percent;
      this.eatCover.style.height = `${percent}%`;
    }
    if (secs !== this.eatSecsShown) {
      this.eatSecsShown = secs;
      this.eatSecs.textContent = secs > 0 ? String(secs) : "";
      this.eatButton.classList.toggle("cooling", secs > 0);
      if (secs > 0) this.eatButton.setAttribute("aria-disabled", "true");
      else this.eatButton.removeAttribute("aria-disabled");
    }
  }

  setMuted(muted: boolean) {
    this.soundButton.textContent = muted ? "🔇" : "🔊";
  }

  /** Big HP bar for the boss; undefined hides it. */
  setBoss(boss: { name: string; hp: number; maxHp: number } | undefined) {
    this.bossBar.hidden = !boss;
    if (!boss) return;
    this.bossBar.querySelector("strong")!.textContent = `👑 ${boss.name}  ${Math.ceil(boss.hp)}/${boss.maxHp}`;
    this.bossBar.querySelector<HTMLDivElement>(".boss-hp div")!.style.width = `${(Math.max(0, boss.hp) / boss.maxHp) * 100}%`;
  }

  setHealth(hp: number, maxHp: number) {
    const key = `${Math.ceil(hp)}/${maxHp}`;
    if (key === this.lastHealth) return;
    this.lastHealth = key;
    const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 1;
    const fill = this.health.querySelector<HTMLDivElement>(".hud-hp div")!;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    fill.classList.toggle("low", ratio < 0.3);
    this.health.querySelector(".hud-hp-text")!.textContent = key;
  }

  setTime(phase: "day" | "dusk" | "night" | "dawn") {
    if (phase === this.lastTime) return;
    this.lastTime = phase;
    const labels = { day: "☀️ Ngày", dusk: "🌇 Hoàng hôn", night: "🌙 Đêm", dawn: "🌅 Bình minh" };
    this.health.querySelector(".hud-time")!.textContent = labels[phase];
  }

  /** Shows which ball the next throw uses. */
  setBall(great: boolean, greatCount: number) {
    const name = great ? `🔵 Bóng xịn (${greatCount})` : "⚪ Bóng thường";
    // Touch screens: a short label, so the button fits left of Bắt in the right half (T18); the full name is read out.
    const text = !this.isTouch ? name : great ? `🔵 Xịn (${greatCount})` : "⚪ Thường";
    if (this.ballButton.textContent === text) return;
    this.ballButton.textContent = text;
    this.ballButton.setAttribute("aria-label", name);
    this.ballButton.classList.toggle("great", great);
  }

  /** Region name and climate next to the clock. */
  setRegion(text: string) {
    const el = this.health.querySelector(".hud-region")!;
    if (el.textContent !== text) el.textContent = text;
  }

  setStatus(players: number, captured: number, resources: Record<Resource, number>, invite: string, gear = "") {
    const help = this.isTouch
      ? "Kéo bên trái để đi • Đánh • Bắt • 💨 Lướt né"
      : "WASD/↑↓←→ đi • Space đánh (cả chặt cây, đập đá) • Shift lướt né • 1-3 thú dùng chiêu • E ném • R bóng • H ăn • Q thú • B trại • C chế tạo • T tủ đồ • N bản đồ • M âm thanh";
    const items = RESOURCES.map((r) => `${RESOURCE_INFO[r].icon} ${resources[r]}`).join(" &nbsp; ") + (gear ? ` &nbsp; ${gear}` : "");
    // Phones get a compact panel: counts plus an invite button.
    const html = this.isTouch
      ? `👥 ${players}/${MAX_PLAYERS} &nbsp; 🐾 ${captured} &nbsp; ${items} ` +
        `<button class="invite-btn" data-link="${escapeHtml(invite)}">🔗 Mời bạn</button>`
      : `Người chơi: ${players}/${MAX_PLAYERS} &nbsp; Thú: ${captured} &nbsp; ${items}<br>${help}<br>` +
        `Mời bạn: <a href="${invite}" target="_blank" rel="noopener">${escapeHtml(invite)}</a>`;
    if (html === this.lastStatus) return;
    this.lastStatus = html;
    this.status.innerHTML = html;
  }

  /** Queues a toast; its level decides how long it stays and what may replace it. */
  showToast(text: string, level: ToastLevel) {
    if (this.toastQueue.push(text, level, performance.now())) this.renderToasts();
  }

  /** Call every frame: expires toasts and shows waiting ones (does nothing when idle). */
  tickToasts(now: number) {
    if (this.toastQueue.update(now)) this.renderToasts();
  }

  /** Brings the toast elements in line with the queue: fade out the gone ones, add the new ones last (DOM order = show order). */
  private renderToasts() {
    const shown = this.toastQueue.visible;
    for (const [id, el] of this.toastElements) {
      if (shown.some((t) => t.id === id)) continue;
      el.classList.add("out");
      this.toastElements.delete(id);
      window.setTimeout(() => el.remove(), TOAST_FADE_MS);
    }
    for (const toast of shown) {
      if (this.toastElements.has(toast.id)) continue;
      const el = div(`toast ${toast.level}`);
      el.textContent = toast.text;
      this.toasts.append(el);
      this.toastElements.set(toast.id, el);
    }
  }

  /** Dims a touch button while its action recharges (e.g. the dash). */
  cooldown(action: "dash", ms: number) {
    const button = this.root.querySelector<HTMLButtonElement>(`.btn-${action}`);
    if (!button) return;
    button.style.setProperty("--cooldown", `${ms}ms`);
    button.classList.remove("cooling");
    void button.offsetWidth; // restart the animation
    button.classList.add("cooling");
  }
}

function div(className: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}

function button(className: string, label: string, action: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `action-btn ${className}`;
  b.textContent = label;
  onPress(b, action);
  return b;
}

/**
 * Runs `action` as soon as a finger (or the mouse) goes down on `target`: for buttons used on the move, since a phone
 * makes no click for a second finger's tap while the first holds the joystick. Not for what needs a user gesture
 * (share sheet, clipboard): a touch only gives one as the finger lifts.
 */
function onPress(target: HTMLElement, action: () => void) {
  target.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    action();
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
