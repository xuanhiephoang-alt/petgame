import { getSpecies, type Element } from "@petgame/shared";

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
}

/**
 * The "Thú" (party) button and panel: lists captured pals and lets the player
 * pick which one follows them. Works with touch, mouse and the Q key.
 */
export class PartyPanel {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private list: HTMLDivElement;
  private lastKey = "";

  constructor(parent: HTMLElement, private onSummon: (palId: string) => void) {
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
    this.update([], "");
  }

  get open(): boolean {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    this.panel.hidden = !(force ?? this.panel.hidden);
  }

  update(party: readonly PartyEntry[], activeId: string) {
    const key = `${activeId}|${party.map((p) => p.id).join(",")}`;
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
    for (const entry of party) {
      const species = getSpecies(entry.speciesId);
      const active = entry.id === activeId;
      const card = document.createElement("div");
      card.className = `party-card${active ? " active" : ""}`;
      card.dataset.palId = entry.id;

      const swatch = document.createElement("span");
      swatch.className = "party-swatch";
      swatch.style.background = species.color;
      const info = document.createElement("div");
      info.className = "party-info";
      const name = document.createElement("strong");
      name.textContent = species.name;
      const element = document.createElement("small");
      element.textContent = ELEMENTS[species.element];
      info.append(name, element);

      const action = document.createElement("button");
      action.className = "party-action";
      action.textContent = active ? "Cho về" : "Đi theo";
      action.addEventListener("click", () => this.onSummon(active ? "" : entry.id));

      card.append(swatch, info, action);
      this.list.append(card);
    }
  }
}
