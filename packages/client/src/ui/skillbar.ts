import type { SkillDef } from "@petgame/shared";

/** One of the following pal's skills, as the bar shows it. */
export interface SkillSlot {
  skill: SkillDef;
  /** The level it is learned at. */
  level: number;
  known: boolean;
  /** What it does at the pal's level ("⚔21", "+18", "6s"). */
  value: string;
}

export interface SkillBarActions {
  /** Orders the following pal to use this skill. */
  use(skillId: string): void;
  /** Lets it use its skills on its own, or only when ordered. */
  setAuto(on: boolean): void;
  /** Explains why a slot does nothing yet (a skill still to learn). */
  hint(text: string): void;
}

/** How long a pressed skill shows as ordered at most (the server gives up after SKILL_ORDER_MS). */
const ORDER_SHOWN_MS = 4000;

/**
 * The following pal's three skills at the bottom of the screen: press 1-3 or
 * tap one to order it (the pal runs up to the pal you fight and uses it); a
 * dark sweep and a countdown show it recharging, 🔒 the ones it has yet to
 * learn. "Tự động" lets the pal also use them on its own.
 */
export class SkillBar {
  private root: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private autoButton: HTMLButtonElement;
  private slots: SkillSlot[] = [];
  private lastKey = "";
  /** When each skill is ready again (performance.now() ms) and its whole cooldown. */
  private recharge = new Map<string, { until: number; total: number }>();
  /** A skill ordered and not yet seen going off, until when it shows as ordered. */
  private ordered?: { skillId: string; until: number };

  constructor(parent: HTMLElement, isTouch: boolean, private actions: SkillBarActions) {
    this.root = document.createElement("div");
    this.root.className = isTouch ? "skill-bar touch" : "skill-bar";
    this.root.hidden = true;
    for (let i = 0; i < 3; i++) {
      const b = document.createElement("button");
      b.className = "skill-btn";
      b.innerHTML = `<span class="key">${i + 1}</span><span class="icon"></span><span class="value"></span><span class="cd"></span><span class="secs"></span>`;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.press(i);
      });
      this.buttons.push(b);
      this.root.append(b);
    }
    this.autoButton = document.createElement("button");
    this.autoButton.className = "skill-auto";
    this.autoButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.actions.setAuto(!this.autoButton.classList.contains("on"));
    });
    this.root.append(this.autoButton);
    parent.append(this.root);
  }

  /** The following pal's skills (none: no pal follows, the bar hides) and whether it uses them on its own. */
  update(slots: SkillSlot[] | undefined, auto: boolean) {
    const key = slots ? `${auto}|${slots.map((s) => `${s.skill.id}:${s.known}:${s.value}`).join(",")}` : "";
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.root.hidden = !slots;
    if (!slots) {
      this.reset();
      return;
    }
    this.slots = slots;
    this.buttons.forEach((b, i) => {
      const slot = slots[i];
      b.hidden = !slot;
      if (!slot) return;
      b.className = `skill-btn ${slot.skill.element}${slot.known ? "" : " locked"}`;
      b.querySelector(".icon")!.textContent = slot.known ? slot.skill.icon : "🔒";
      b.querySelector(".value")!.textContent = slot.known ? slot.value : `Lv ${slot.level}`;
      b.title = slot.known
        ? `${slot.skill.name} (phím ${i + 1}): ${slot.skill.description}`
        : `${slot.skill.name}: học ở cấp ${slot.level}`;
      b.setAttribute("aria-label", slot.known ? slot.skill.name : `${slot.skill.name}, học ở cấp ${slot.level}`);
    });
    this.autoButton.classList.toggle("on", auto);
    this.autoButton.textContent = auto ? "Tự động ✓" : "Theo lệnh";
    this.autoButton.title = auto
      ? "Thú tự dùng chiêu (bấm để chỉ dùng khi bạn ra lệnh bằng phím 1-3)"
      : "Thú chỉ dùng chiêu khi bạn ra lệnh (bấm để thú tự dùng)";
  }

  /** One of the following pal's skills just went off: it recharges for its cooldown. */
  started(skillId: string, cooldownMs: number) {
    this.recharge.set(skillId, { until: performance.now() + cooldownMs, total: cooldownMs });
    if (this.ordered?.skillId === skillId) this.ordered = undefined;
  }

  /** Forgets the recharges (no pal follows now, or another one does). */
  reset() {
    this.recharge.clear();
    this.ordered = undefined;
  }

  /** Key 1-3 or a tap: orders the skill in that slot if it is learned and ready. */
  press(index: number) {
    const slot = this.slots[index];
    const button = this.buttons[index];
    if (!slot || this.root.hidden) return;
    if (!slot.known) {
      this.nope(button);
      this.actions.hint(`🔒 ${slot.skill.name}: thú học ở cấp ${slot.level}`);
      return;
    }
    if ((this.recharge.get(slot.skill.id)?.until ?? 0) > performance.now()) return this.nope(button);
    this.ordered = { skillId: slot.skill.id, until: performance.now() + ORDER_SHOWN_MS };
    this.actions.use(slot.skill.id);
  }

  /** Moves the recharge sweeps and countdowns along (every frame). */
  tick(now: number) {
    if (this.root.hidden) return;
    if (this.ordered && this.ordered.until <= now) this.ordered = undefined;
    this.slots.forEach((slot, i) => {
      const b = this.buttons[i];
      const r = this.recharge.get(slot.skill.id);
      const left = r ? Math.max(0, r.until - now) : 0;
      const cd = b.querySelector<HTMLSpanElement>(".cd")!;
      const secs = b.querySelector<HTMLSpanElement>(".secs")!;
      const height = r && left > 0 ? `${(left / r.total) * 100}%` : "0%";
      if (cd.style.height !== height) cd.style.height = height;
      const text = left > 0 ? String(Math.ceil(left / 1000)) : "";
      if (secs.textContent !== text) secs.textContent = text;
      b.classList.toggle("ordered", this.ordered?.skillId === slot.skill.id);
    });
  }

  private nope(button: HTMLButtonElement) {
    button.classList.remove("nope");
    void button.offsetWidth; // restart the shake
    button.classList.add("nope");
  }
}
