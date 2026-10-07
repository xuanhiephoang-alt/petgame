import { MAX_PLAYERS, RESOURCES, RESOURCE_INFO, type Resource } from "@petgame/shared";

/** DOM overlay: status panel, toast, and touch action buttons. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly joystickZone: HTMLDivElement;
  private status: HTMLDivElement;
  private toast: HTMLDivElement;
  private toastTimer = 0;
  private lastStatus = "";
  private ballButton: HTMLButtonElement;
  private health: HTMLDivElement;
  private lastHealth = "";
  private lastTime = "";

  constructor(
    parent: HTMLElement,
    private isTouch: boolean,
    actions: { attack: () => void; capture: () => void; placeBase: () => void; toggleBall: () => void; eat: () => void },
  ) {
    this.root = div("hud");
    this.status = div("hud-status");
    this.toast = div("hud-toast");
    this.joystickZone = div("joystick-zone");
    this.health = div("hud-health");
    this.health.innerHTML = `<span class="hud-time"></span><span class="hud-heart">❤️</span><div class="hud-hp"><div></div></div><span class="hud-hp-text"></span>`;
    const eat = document.createElement("button");
    eat.className = "eat-btn";
    eat.textContent = "🫐 Ăn";
    eat.title = "Ăn 1 quả mọng để hồi máu (phím H)";
    eat.addEventListener("click", actions.eat);
    this.health.append(eat);
    this.root.append(this.health, this.status, this.toast);
    const base = document.createElement("button");
    base.className = "base-btn";
    base.textContent = "🏕️ Đặt trại";
    base.title = "Dựng trại ở chỗ đang đứng (phím B)";
    base.addEventListener("click", actions.placeBase);
    this.root.append(base);
    this.ballButton = document.createElement("button");
    this.ballButton.className = isTouch ? "ball-btn touch" : "ball-btn";
    this.ballButton.title = "Đổi loại bóng (phím R)";
    this.ballButton.addEventListener("click", actions.toggleBall);
    this.root.append(this.ballButton);

    if (isTouch) {
      this.root.append(this.joystickZone);
      this.root.append(button("btn-attack", "Đánh", actions.attack), button("btn-capture", "Bắt", actions.capture));
    }
    parent.append(this.root);
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
    const text = great ? `🔵 Bóng xịn (${greatCount})` : `⚪ Bóng thường`;
    if (this.ballButton.textContent === text) return;
    this.ballButton.textContent = text;
    this.ballButton.classList.toggle("great", great);
  }

  setStatus(players: number, captured: number, resources: Record<Resource, number>, invite: string) {
    const help = this.isTouch
      ? "Kéo bên trái để đi • Đánh • Bắt"
      : "WASD/↑↓←→ đi • Space đánh • E ném • R bóng • H ăn • Q thú • B trại • C chế tạo";
    const items = RESOURCES.map((r) => `${RESOURCE_INFO[r].icon} ${resources[r]}`).join(" &nbsp; ");
    const html =
      `Người chơi: ${players}/${MAX_PLAYERS} &nbsp; Thú: ${captured} &nbsp; ${items}<br>${help}<br>` +
      `Mời bạn: <a href="${invite}" target="_blank" rel="noopener">${escapeHtml(invite)}</a>`;
    if (html === this.lastStatus) return;
    this.lastStatus = html;
    this.status.innerHTML = html;
  }

  showToast(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("visible"), 2000);
  }
}

function div(className: string): HTMLDivElement {
  const d = document.createElement("div");
  d.className = className;
  return d;
}

function button(className: string, label: string, onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `action-btn ${className}`;
  b.textContent = label;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onPress();
  });
  return b;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
