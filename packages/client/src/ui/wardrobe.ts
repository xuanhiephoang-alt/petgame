import {
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_NAMES,
  SKIN_TONES,
  WEARABLES,
  weaponStats,
  type Look,
  type WearSlot,
  type Wearable,
  type Worn,
} from "@petgame/shared";
import { drawDoll, drawItem, hasDollArt, type DollView } from "../game/art/doll.ts";

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** A canvas showing an explorer, turning to the next side when tapped. */
export class DollPreview {
  readonly canvas = document.createElement("canvas");
  private facing: DollView | "left" = "front";

  constructor(private width: number, private height: number, private look: Look, private worn: Worn) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.className = "doll-preview";
    this.canvas.title = "Bấm để xoay";
    const order: (DollView | "left")[] = ["front", "right", "back", "left"];
    this.canvas.addEventListener("click", () => {
      this.facing = order[(order.indexOf(this.facing) + 1) % order.length];
      this.draw();
    });
    this.draw();
  }

  set(look: Look, worn: Worn) {
    this.look = look;
    this.worn = worn;
    this.draw();
  }

  draw() {
    const c = this.canvas.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!hasDollArt()) return;
    const ratio = this.canvas.width / this.width;
    c.scale(ratio, ratio);
    // A shadow, then the explorer standing on it; a doll is about 470 units tall with a hat.
    const scale = (this.height - 14) / 480;
    const feet = this.height - 9;
    c.fillStyle = "rgba(40, 60, 30, 0.22)";
    c.beginPath();
    c.ellipse(this.width / 2, feet, 62 * scale, 20 * scale, 0, 0, Math.PI * 2);
    c.fill();
    drawDoll(c, this.look, this.worn, this.facing, this.width / 2, feet, scale);
  }
}

/** Hairstyle, hair color and skin tone buttons. */
export class LookPicker {
  readonly root = document.createElement("div");

  constructor(private look: Look, private onChange: (look: Look) => void) {
    this.root.className = "look-picker";
    this.render();
  }

  set(look: Look) {
    this.look = look;
    this.render();
  }

  private render() {
    this.root.replaceChildren();
    const styles = row("Kiểu tóc");
    for (const style of HAIR_STYLES) {
      const b = button(HAIR_STYLE_NAMES[style], "style-btn", style === this.look.hair);
      b.dataset.hair = style;
      b.addEventListener("click", () => this.pick({ hair: style }));
      styles.list.append(b);
    }
    const hair = row("Màu tóc");
    HAIR_COLORS.forEach((color, i) => {
      const b = button("", "swatch", i === this.look.hairColor);
      b.style.background = hex(color);
      b.setAttribute("aria-label", `Màu tóc ${i + 1}`);
      b.dataset.hairColor = String(i);
      b.addEventListener("click", () => this.pick({ hairColor: i }));
      hair.list.append(b);
    });
    const skin = row("Màu da");
    SKIN_TONES.forEach((color, i) => {
      const b = button("", "swatch", i === this.look.skin);
      b.style.background = hex(color);
      b.setAttribute("aria-label", `Màu da ${i + 1}`);
      b.dataset.skin = String(i);
      b.addEventListener("click", () => this.pick({ skin: i }));
      skin.list.append(b);
    });
    this.root.append(styles.root, hair.root, skin.root);
  }

  private pick(change: Partial<Look>) {
    this.look = { ...this.look, ...change };
    this.render();
    this.onChange(this.look);
  }
}

function row(title: string) {
  const root = document.createElement("div");
  root.className = "look-row";
  const label = document.createElement("small");
  label.textContent = title;
  const list = document.createElement("div");
  list.className = "look-options";
  root.append(label, list);
  return { root, list };
}

function button(text: string, className: string, active: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className + (active ? " active" : "");
  b.textContent = text;
  return b;
}

export interface WardrobeState {
  look: Look;
  worn: Worn;
  wardrobe: readonly string[];
}

export interface WardrobeActions {
  setLook(look: Look): void;
  equip(slot: WearSlot, id: string): void;
}

const TABS: { key: "look" | WearSlot; title: string }[] = [
  { key: "look", title: "Ngoại hình" },
  { key: "outfit", title: "Quần áo" },
  { key: "hat", title: "Mũ" },
  { key: "weapon", title: "Vũ khí" },
];

const FROM: Record<Wearable["from"], string> = {
  starter: "",
  craft: "Chế ở trại (🔨)",
  chest: "Tìm trong rương báu",
  boss: "Phần thưởng hạ trùm",
};

/**
 * The "Tủ đồ" (wardrobe) button and panel: a turning preview of the
 * explorer, the look (hairstyle, hair and skin color, free to change) and
 * the clothes, hats and weapons owned, to put on; those not owned yet say
 * how to get them. T toggles it.
 */
export class WardrobePanel {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: HTMLDivElement;
  private preview: DollPreview;
  private picker: LookPicker;
  private tab: "look" | WearSlot = "look";
  private state: WardrobeState;
  private lastKey = "";
  /** What was owned when the panel was last opened: anything newer lights a dot on the button. */
  private seen?: Set<string>;
  onOpen?: () => void;

  constructor(parent: HTMLElement, private actions: WardrobeActions, initial: WardrobeState) {
    this.state = initial;
    this.button = document.createElement("button");
    this.button.className = "wardrobe-btn";
    this.button.textContent = "👕 Tủ đồ";
    this.button.title = "Ngoại hình, quần áo, mũ và vũ khí (phím T)";
    this.button.addEventListener("click", () => this.toggle());

    this.panel = document.createElement("div");
    this.panel.className = "party-panel wardrobe-panel";
    this.panel.hidden = true;
    const header = document.createElement("div");
    header.className = "party-header";
    header.innerHTML = "<strong>Tủ đồ</strong>";
    const close = document.createElement("button");
    close.className = "party-close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Đóng");
    close.addEventListener("click", () => this.toggle(false));
    header.append(close);

    this.preview = new DollPreview(120, 150, initial.look, initial.worn);
    const stage = document.createElement("div");
    stage.className = "wardrobe-stage";
    stage.append(this.preview.canvas);

    this.tabs = document.createElement("div");
    this.tabs.className = "wardrobe-tabs";
    for (const t of TABS) {
      const b = button(t.title, "wardrobe-tab", t.key === this.tab);
      b.dataset.tab = t.key;
      b.addEventListener("click", () => {
        this.tab = t.key;
        this.lastKey = "";
        this.render();
      });
      this.tabs.append(b);
    }
    this.picker = new LookPicker(initial.look, (look) => {
      this.state = { ...this.state, look };
      this.preview.set(look, this.state.worn);
      this.actions.setLook(look);
    });
    this.body = document.createElement("div");
    this.body.className = "party-list";
    this.panel.append(header, stage, this.tabs, this.body);
    parent.append(this.button, this.panel);

    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "t" && !e.repeat) this.toggle();
      if (e.key === "Escape") this.toggle(false);
    });
    this.render();
  }

  get open(): boolean {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    const open = force ?? this.panel.hidden;
    if (open === !this.panel.hidden) return;
    this.panel.hidden = !open;
    if (!open) return;
    this.onOpen?.();
    // Show what just came in (found in a chest, won, crafted).
    const fresh = this.state.wardrobe.find((id) => !this.seen?.has(id));
    const slot = fresh ? WEARABLES.find((w) => w.id === fresh)?.slot : undefined;
    if (slot && this.seen) this.tab = slot;
    this.seen = new Set(this.state.wardrobe);
    this.button.classList.remove("fresh");
    this.render();
    this.preview.draw();
  }

  update(state: WardrobeState) {
    const key = JSON.stringify(state);
    if (key === this.lastKey) return;
    this.state = state;
    this.seen ??= new Set(state.wardrobe);
    if (!this.open) this.button.classList.toggle("fresh", state.wardrobe.some((id) => !this.seen!.has(id)));
    else this.seen = new Set(state.wardrobe);
    this.preview.set(state.look, state.worn);
    this.picker.set(state.look);
    this.render();
  }

  private render() {
    this.lastKey = JSON.stringify(this.state);
    for (const b of this.tabs.querySelectorAll<HTMLButtonElement>(".wardrobe-tab")) b.classList.toggle("active", b.dataset.tab === this.tab);
    this.body.replaceChildren();
    if (this.tab === "look") {
      this.body.append(this.picker.root);
      return;
    }
    const slot = this.tab;
    if (slot !== "outfit") this.body.append(this.card(undefined, slot));
    for (const item of WEARABLES.filter((w) => w.slot === slot)) this.body.append(this.card(item, slot));
  }

  /** One item (or, without one, taking the hat off / bare hands). */
  private card(item: Wearable | undefined, slot: WearSlot): HTMLDivElement {
    const id = item?.id ?? "";
    const owned = !item || this.state.wardrobe.includes(id);
    const worn = this.state.worn[slot] === id;
    const card = document.createElement("div");
    card.className = `party-card wear-card${worn ? " worn" : ""}${owned ? "" : " locked"}`;
    card.dataset.item = id || `none-${slot}`;

    const pic = document.createElement("canvas");
    pic.className = "wear-pic";
    pic.width = pic.height = 88;
    const c = pic.getContext("2d")!;
    if (item && slot === "outfit") drawDoll(c, this.state.look, { outfit: id, hat: "", weapon: "" }, "front", 44, 86, 0.17);
    else if (item) drawItem(c, id, 88, 88);
    else {
      c.font = "44px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(slot === "hat" ? "🙂" : "✊", 44, 46);
    }

    const info = document.createElement("div");
    info.className = "party-info";
    const name = document.createElement("strong");
    name.textContent = item ? `${item.icon} ${item.name}` : slot === "hat" ? "Không đội mũ" : "Tay không";
    const desc = document.createElement("small");
    desc.textContent = item?.description ?? (slot === "hat" ? "Để lộ kiểu tóc" : "Đấm thường");
    info.append(name, desc);
    if (slot === "weapon") {
      const stats = weaponStats(id);
      const line = document.createElement("small");
      line.className = "wear-stats";
      line.textContent = `⚔️ ${stats.damage}  ${stats.ranged ? "🎯 bắn xa" : "✋ đánh gần"} ${stats.range}`;
      info.append(line);
    }
    if (item?.defense) {
      const line = document.createElement("small");
      line.className = "wear-stats";
      line.textContent = `🛡️ bớt ${Math.round(item.defense * 100)}% sát thương`;
      info.append(line);
    }
    if (!owned) {
      const how = document.createElement("small");
      how.className = "craft-blocker";
      how.textContent = `🔒 ${FROM[item!.from]}`;
      info.append(how);
    }

    const act = document.createElement("button");
    act.className = "party-action";
    act.textContent = worn ? "Đang dùng" : slot === "outfit" ? "Mặc" : slot === "hat" ? (item ? "Đội" : "Bỏ mũ") : item ? "Cầm" : "Cất";
    act.disabled = worn || !owned;
    act.addEventListener("click", () => this.actions.equip(slot, id));
    card.append(pic, info, act);
    return card;
  }
}
