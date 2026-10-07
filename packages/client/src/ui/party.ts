import { RESOURCE_INFO, getSpecies, workOutput, xpToNext, type Element } from "@petgame/shared";

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

  constructor(parent: HTMLElement, private actions: PartyActions) {
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

  get open(): boolean {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    this.panel.hidden = !(force ?? this.panel.hidden);
  }

  update(party: readonly PartyEntry[], hasBase: boolean) {
    const key = `${hasBase}|${party.map((p) => `${p.id}:${p.level}:${p.xp}:${p.assignment}`).join(",")}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.button.textContent = `🐾 Thú (${party.length})`;

    this.list.replaceChildren();
    if (party.length === 0) {
      const empty = document.createElement("p");
      empty.className = "party-empty";
      empty.textContent = "Chưa bắt được thú nào. Đánh cho thú yếu đi rồi ném bóng để bắt!";
      this.list.append(empty);
      return;
    }
    if (!hasBase) {
      const hint = document.createElement("p");
      hint.className = "party-hint";
      hint.textContent = "Đặt trại (🏕️ / phím B) để giao việc cho thú.";
      this.list.append(hint);
    }
    for (const entry of party) this.list.append(this.card(entry, hasBase));
  }

  private card(entry: PartyEntry, hasBase: boolean): HTMLDivElement {
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

    const info = document.createElement("div");
    info.className = "party-info";
    const name = document.createElement("strong");
    name.textContent = `${species.name} · Lv ${entry.level}`;
    const detail = document.createElement("small");
    const status = entry.assignment === "follow" ? "Đang đi theo" : entry.assignment === "work" ? `Đang làm ${output.icon}` : `Làm ra ${output.icon}`;
    detail.textContent = `${ELEMENTS[species.element]} · ${status}`;
    const xp = document.createElement("div");
    xp.className = "party-xp";
    const fill = document.createElement("div");
    fill.style.width = `${Math.min(100, (entry.xp / xpToNext(entry.level)) * 100)}%`;
    xp.append(fill);
    info.append(name, detail, xp);

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

    card.append(swatch, info, buttons);
    return card;
  }
}
