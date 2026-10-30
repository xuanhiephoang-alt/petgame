import {
  ELEMENT_INFO,
  RESOURCE_INFO,
  getSpecies,
  learnset,
  skillPower,
  strongAgainst,
  workOutput,
  xpToNext,
  type Element,
  type SkillDef,
} from "@petgame/shared";

const ELEMENTS: Record<Element, string> = {
  grass: "🌿 Cỏ",
  fire: "🔥 Lửa",
  water: "💧 Nước",
  earth: "🪨 Đất",
  electric: "⚡ Điện",
};

export interface PartyEntry {
  id: string;
  speciesId: string;
  level: number;
  xp: number;
  /** "", "follow" or "work". */
  assignment: string;
}

export interface PartyActions {
  summon(palId: string): void;
  work(palId: string): void;
  rest(palId: string): void;
  feed(palId: string): void;
}

/** What a skill does at a pal's level: damage, healing or a shield's time. */
function skillValue(skill: SkillDef, level: number): string {
  if (skill.shape === "shield") return `${Math.round((skill.shieldMs ?? 0) / 1000)}s`;
  if (skill.shape === "heal") return `+${skillPower(skill, level)}`;
  return `⚔${skillPower(skill, level)}`;
}

/**
 * The "Thú" (party) button and panel: lists captured pals with level and XP,
 * and lets the player choose who follows, who works at the base and who rests.
 * Works with touch, mouse and the Q key.
 */
export class PartyPanel {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private list: HTMLDivElement;
  private lastKey = "";

  /** `portrait` gives a picture of a species (data URL) for its card; without it, a color dot. */
  constructor(parent: HTMLElement, private actions: PartyActions, private portrait?: (speciesId: string) => string | undefined) {
    this.button = document.createElement("button");
    this.button.className = "party-btn";
    this.button.addEventListener("click", () => this.toggle());

    this.panel = document.createElement("div");
    this.panel.className = "party-panel";
    this.panel.hidden = true;
    const header = document.createElement("div");
    header.className = "party-header";
    header.innerHTML = "<strong>Thú của bạn</strong>";
    const close = document.createElement("button");
    close.className = "party-close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Đóng");
    close.addEventListener("click", () => this.toggle(false));
    header.append(close);
    this.list = document.createElement("div");
    this.list.className = "party-list";
    this.panel.append(header, this.list);

    parent.append(this.button, this.panel);
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "q" && !e.repeat) this.toggle();
      if (e.key === "Escape") this.toggle(false);
    });
    this.update([], false);
  }

  onOpen?: () => void;

  get open(): boolean {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    const open = force ?? this.panel.hidden;
    this.panel.hidden = !open;
    if (open) this.onOpen?.();
  }

  update(party: readonly PartyEntry[], hasBase: boolean, snacks = 0) {
    const key = `${hasBase}|${snacks > 0}|${party.map((p) => `${p.id}:${p.level}:${p.xp}:${p.assignment}`).join(",")}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.button.textContent = `🐾 Thú (${party.length})`;

    this.list.replaceChildren();
    if (party.length === 0) {
      const empty = document.createElement("p");
      empty.className = "party-empty";
      empty.textContent = "Chưa bắt được thú nào. Đánh đến khi thú choáng 💫 rồi ném bóng để bắt!";
      this.list.append(empty);
      return;
    }
    if (!hasBase) {
      const hint = document.createElement("p");
      hint.className = "party-hint";
      hint.textContent = "Đặt trại (🏕️ / phím B) để giao việc cho thú.";
      this.list.append(hint);
    }
    for (const entry of party) this.list.append(this.card(entry, hasBase, snacks > 0));
  }

  private card(entry: PartyEntry, hasBase: boolean, canFeed: boolean): HTMLDivElement {
    const species = getSpecies(entry.speciesId);
    const output = RESOURCE_INFO[workOutput(species)];
    const card = document.createElement("div");
    card.className = `party-card ${entry.assignment || "idle"}`;
    card.dataset.palId = entry.id;

    const swatch = document.createElement("span");
    swatch.className = "party-swatch";
    swatch.style.background = species.color;
    swatch.textContent = String(entry.level);
    swatch.title = `Cấp ${entry.level}`;
    const picture = this.portrait?.(entry.speciesId);
    if (picture) {
      swatch.classList.add("portrait");
      swatch.style.backgroundImage = `url(${picture})`;
      swatch.style.backgroundColor = `${species.color}33`;
    }

    const info = document.createElement("div");
    info.className = "party-info";
    const name = document.createElement("strong");
    name.textContent = `${species.name} · Lv ${entry.level}`;
    const detail = document.createElement("small");
    const status = entry.assignment === "follow" ? "Đang đi theo" : entry.assignment === "work" ? `Đang làm ${output.icon}` : `Làm ra ${output.icon}`;
    const strong = ELEMENT_INFO[strongAgainst(species.element)];
    detail.textContent = `${ELEMENTS[species.element]} (khắc ${strong.icon}) · ${status}`;
    const xp = document.createElement("div");
    xp.className = "party-xp";
    const fill = document.createElement("div");
    fill.style.width = `${Math.min(100, (entry.xp / xpToNext(entry.level)) * 100)}%`;
    xp.append(fill);
    // Its three skills: what each does at its level now, or the level it learns it at.
    const skills = document.createElement("div");
    skills.className = "party-skills";
    for (const { skill, level } of learnset(species)) {
      const chip = document.createElement("span");
      const known = entry.level >= level;
      chip.className = `skill-chip ${skill.element}${known ? "" : " locked"}`;
      chip.textContent = known ? `${skill.icon} ${skill.name} ${skillValue(skill, entry.level)}` : `🔒 ${skill.name} · Lv ${level}`;
      chip.title = `${skill.name}: ${skill.description}${known ? "" : ` (học ở cấp ${level})`}`;
      skills.append(chip);
    }
    info.append(name, detail, skills, xp);

    const buttons = document.createElement("div");
    buttons.className = "party-buttons";
    const add = (label: string, onClick: () => void, kind = "", disabled = false) => {
      const b = document.createElement("button");
      b.className = `party-action ${kind}`;
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener("click", onClick);
      buttons.append(b);
    };
    if (entry.assignment !== "follow") add("Đi theo", () => this.actions.summon(entry.id));
    if (entry.assignment !== "work") add("Làm việc", () => this.actions.work(entry.id), "work", !hasBase);
    if (entry.assignment) add(entry.assignment === "follow" ? "Cho về" : "Nghỉ", () => this.actions.rest(entry.id), "rest");
    if (canFeed) add("Cho ăn 🥧", () => this.actions.feed(entry.id), "feed");

    card.append(swatch, info, buttons);
    return card;
  }
}
