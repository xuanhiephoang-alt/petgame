import { RECIPES, RESOURCES, RESOURCE_INFO, craftBlocker, type Resource } from "@petgame/shared";

export interface CraftState {
  resources: Record<Resource, number>;
  hasBase: boolean;
  baseLevel: number;
  nearBase: boolean;
}

/**
 * The "Chế tạo" button and panel: recipes with their costs, greyed out with
 * the same reason the server would give (shared craftBlocker). C toggles it.
 */
export class CraftPanel {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private list: HTMLDivElement;
  private lastKey = "";
  onOpen?: () => void;

  constructor(parent: HTMLElement, private onCraft: (recipeId: string) => void) {
    this.button = document.createElement("button");
    this.button.className = "craft-btn";
    this.button.textContent = "🔨 Chế tạo";
    this.button.title = "Chế tạo ở trại của bạn (phím C)";
    this.button.addEventListener("click", () => this.toggle());

    this.panel = document.createElement("div");
    this.panel.className = "party-panel craft-panel";
    this.panel.hidden = true;
    const header = document.createElement("div");
    header.className = "party-header";
    header.innerHTML = "<strong>Chế tạo</strong>";
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
      if (e.key.toLowerCase() === "c" && !e.repeat) this.toggle();
      if (e.key === "Escape") this.toggle(false);
    });
  }

  toggle(force?: boolean) {
    const open = force ?? this.panel.hidden;
    this.panel.hidden = !open;
    if (open) this.onOpen?.();
  }

  update(state: CraftState) {
    const key = JSON.stringify(state);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.list.replaceChildren();
    for (const recipe of RECIPES) {
      const blocker = craftBlocker(recipe, state);
      const card = document.createElement("div");
      card.className = "party-card craft-card";

      const icon = document.createElement("span");
      icon.className = "craft-icon";
      icon.textContent = recipe.icon;

      const info = document.createElement("div");
      info.className = "party-info";
      const name = document.createElement("strong");
      name.textContent = recipe.name;
      const desc = document.createElement("small");
      desc.textContent = recipe.description;
      const cost = document.createElement("div");
      cost.className = "craft-cost";
      for (const r of RESOURCES) {
        const need = recipe.cost[r];
        if (!need) continue;
        const chip = document.createElement("span");
        chip.className = state.resources[r] >= need ? "enough" : "short";
        chip.textContent = `${RESOURCE_INFO[r].icon} ${state.resources[r]}/${need}`;
        cost.append(chip);
      }
      info.append(name, desc, cost);
      if (blocker) {
        const why = document.createElement("small");
        why.className = "craft-blocker";
        why.textContent = blocker;
        info.append(why);
      }

      const make = document.createElement("button");
      make.className = "party-action";
      make.textContent = "Làm";
      make.disabled = !!blocker;
      make.addEventListener("click", () => this.onCraft(recipe.id));

      card.append(icon, info, make);
      this.list.append(card);
    }
  }
}
