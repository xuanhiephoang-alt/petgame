import {
  ELEMENT_INFO,
  MAX_PARTY,
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

/** The release button in the confirm dialog stays locked this long, so a double tap on a card's button cannot confirm. */
const CONFIRM_ARM_MS = 500;

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
  release(palId: string): void;
}

/** What a skill does at a pal's level: damage, healing or a shield's time. */
export function skillValue(skill: SkillDef, level: number): string {
  if (skill.shape === "shield") return `${Math.round((skill.shieldMs ?? 0) / 1000)}s`;
  if (skill.shape === "heal") return `+${skillPower(skill, level)}`;
  return `⚔${skillPower(skill, level)}`;
}

/**
 * The "Thú" (party) button and panel: lists captured pals with level and XP,
 * and lets the player choose who follows, who works at the base and who rests.
 * "Thả bớt" turns every card's buttons into a single "Thả"; a dialog asks
 * before a pal is let go for good. Works with touch, mouse and the Q key.
 */
export class PartyPanel {
  private button: HTMLButtonElement;
  private panel: HTMLDivElement;
  private title: HTMLElement;
  private releaseToggle: HTMLButtonElement;
  private list: HTMLDivElement;
  private lastKey = "";
  /** What the last update() was given, to draw again (release mode, the dialog) without waiting for the next one. */
  private party: readonly PartyEntry[] = [];
  private hasBase = false;
  private snacks = 0;
  /** The "Thả bớt" mode: each card offers only "Thả". Always off when the panel closes. */
  private releasing = false;
  /** The confirm dialog (a dimmed layer over the whole screen) and the pal it asks about ("" = closed). */
  private confirm: HTMLDivElement;
  private confirmHead: HTMLDivElement;
  private confirmTitle: HTMLElement;
  private confirmStatus: HTMLParagraphElement;
  private confirmWarn: HTMLParagraphElement;
  private keepButton: HTMLButtonElement;
  private releaseButton: HTMLButtonElement;
  private confirmId = "";
  private armTimer = 0;

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
    this.title = document.createElement("strong");
    this.title.className = "party-title";
    this.releaseToggle = document.createElement("button");
    this.releaseToggle.type = "button";
    this.releaseToggle.className = "party-release-toggle";
    this.releaseToggle.title = "Chọn thú để thả về thiên nhiên";
    this.releaseToggle.addEventListener("click", () => this.setReleasing(!this.releasing));
    const close = document.createElement("button");
    close.className = "party-close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Đóng");
    close.addEventListener("click", () => this.toggle(false));
    header.append(this.title, this.releaseToggle, close);
    this.list = document.createElement("div");
    this.list.className = "party-list";
    this.panel.append(header, this.list);

    // The dialog is built once; openConfirm() fills it for the pal asked about.
    this.confirm = document.createElement("div");
    this.confirm.className = "party-confirm";
    this.confirm.hidden = true;
    const box = document.createElement("div");
    box.className = "party-confirm-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "party-confirm-title");
    this.confirmHead = document.createElement("div");
    this.confirmHead.className = "party-confirm-head";
    this.confirmTitle = document.createElement("strong");
    this.confirmTitle.id = "party-confirm-title";
    const text = document.createElement("p");
    text.className = "party-confirm-text";
    text.textContent = "Nó sẽ về với thiên nhiên, không quay lại và không để lại gì.";
    this.confirmStatus = document.createElement("p");
    this.confirmStatus.className = "party-confirm-status";
    this.confirmWarn = document.createElement("p");
    this.confirmWarn.className = "party-confirm-warn";
    this.confirmWarn.textContent = "Đây là con thú cuối cùng của bạn.";
    const choices = document.createElement("div");
    choices.className = "party-confirm-buttons";
    this.keepButton = document.createElement("button");
    this.keepButton.type = "button";
    this.keepButton.className = "confirm-keep";
    this.keepButton.textContent = "Giữ lại";
    this.releaseButton = document.createElement("button");
    this.releaseButton.type = "button";
    this.releaseButton.className = "confirm-release";
    this.releaseButton.textContent = "Thả";
    choices.append(this.keepButton, this.releaseButton);
    box.append(this.confirmHead, text, this.confirmStatus, this.confirmWarn, choices);
    this.confirm.append(box);
    this.keepButton.addEventListener("click", () => this.closeConfirm());
    this.releaseButton.addEventListener("click", () => this.confirmRelease());
    // A tap on the dimmed area around the box cancels.
    this.confirm.addEventListener("click", (e) => {
      if (e.target === this.confirm) this.closeConfirm();
    });

    parent.append(this.button, this.panel, this.confirm);
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "q" && !e.repeat) this.toggle();
      if (e.key === "Escape") {
        if (this.confirmId) this.closeConfirm(); // the dialog first, the panel on the next press
        else this.toggle(false);
      }
      if (e.key === "Tab" && this.confirmId) {
        e.preventDefault(); // focus stays on the dialog's two buttons (a locked one cannot take it, so it stays put)
        (document.activeElement === this.keepButton ? this.releaseButton : this.keepButton).focus();
      }
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
    if (open) {
      this.onOpen?.();
      return;
    }
    // Closed (any way): the next time it opens it is the plain panel again.
    this.closeConfirm(false);
    if (this.releasing) this.setReleasing(false);
  }

  update(party: readonly PartyEntry[], hasBase: boolean, snacks = 0) {
    this.party = party;
    this.hasBase = hasBase;
    this.snacks = snacks;
    if (party.length === 0) this.releasing = false;
    if (this.confirmId && !party.some((p) => p.id === this.confirmId)) this.closeConfirm();
    const key = `${hasBase}|${snacks > 0}|${this.releasing}|${party.map((p) => `${p.id}:${p.level}:${p.xp}:${p.assignment}`).join(",")}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.render();
  }

  private render() {
    const party = this.party;
    this.title.textContent = `Túi thú ${party.length}/${MAX_PARTY}`;
    // Full: the button says so (and turns yellow), so the player frees a place before stunning another pal.
    this.button.textContent = party.length < MAX_PARTY ? `🐾 Thú (${party.length})` : `🐾 Thú (${party.length}/${MAX_PARTY})`;
    this.button.classList.toggle("full", party.length >= MAX_PARTY);
    this.releaseToggle.hidden = party.length === 0;
    this.releaseToggle.textContent = this.releasing ? "✓ Xong" : "🕊️ Thả bớt";
    this.releaseToggle.classList.toggle("on", this.releasing);
    this.releaseToggle.setAttribute("aria-pressed", String(this.releasing));

    this.list.replaceChildren();
    if (party.length === 0) {
      const empty = document.createElement("p");
      empty.className = "party-empty";
      empty.textContent = "Túi đang trống. Đánh đến khi thú choáng 💫 rồi ném bóng để bắt!";
      this.list.append(empty);
      return;
    }
    if (this.releasing) {
      const hint = document.createElement("p");
      hint.className = "party-hint release";
      hint.textContent = "Chọn thú muốn thả. Thú được thả sẽ về với thiên nhiên và không quay lại.";
      this.list.append(hint);
    } else if (!this.hasBase) {
      const hint = document.createElement("p");
      hint.className = "party-hint";
      hint.textContent = "Đặt trại (🏕️ / phím B) để giao việc cho thú.";
      this.list.append(hint);
    }
    for (const entry of party) this.list.append(this.card(entry, this.hasBase, this.snacks > 0));
    // A dialog left open follows the party (its pal levelled up, or the party is no longer down to one).
    if (this.confirmId) this.fillConfirm();
  }

  private setReleasing(on: boolean) {
    this.releasing = on;
    this.update(this.party, this.hasBase, this.snacks); // draws it now, not with the next frame's update
  }

  /** The pal's picture: its portrait with the level on it, or a color dot. */
  private swatch(entry: PartyEntry): HTMLSpanElement {
    const species = getSpecies(entry.speciesId);
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
    return swatch;
  }

  private card(entry: PartyEntry, hasBase: boolean, canFeed: boolean): HTMLDivElement {
    const species = getSpecies(entry.speciesId);
    const output = RESOURCE_INFO[workOutput(species)];
    const card = document.createElement("div");
    card.className = `party-card ${entry.assignment || "idle"}`;
    card.dataset.palId = entry.id;

    const swatch = this.swatch(entry);

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
      return b;
    };
    if (this.releasing) {
      add("Thả", () => this.openConfirm(entry), "release").setAttribute("aria-label", `Thả ${species.name} · Lv ${entry.level}`);
    } else {
      if (entry.assignment !== "follow") add("Đi theo", () => this.actions.summon(entry.id));
      if (entry.assignment !== "work") add("Làm việc", () => this.actions.work(entry.id), "work", !hasBase);
      if (entry.assignment) add(entry.assignment === "follow" ? "Cho về" : "Nghỉ", () => this.actions.rest(entry.id), "rest");
      if (canFeed) add("Cho ăn 🥧", () => this.actions.feed(entry.id), "feed");
    }

    card.append(swatch, info, buttons);
    return card;
  }

  /** Asks whether to let this pal go. "Giữ lại" has the focus, so a stray Enter cancels; "Thả" wakes up after CONFIRM_ARM_MS. */
  private openConfirm(entry: PartyEntry) {
    this.confirmId = entry.id;
    this.fillConfirm();
    this.releaseButton.disabled = true;
    window.clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => (this.releaseButton.disabled = false), CONFIRM_ARM_MS);
    this.confirm.hidden = false;
    this.keepButton.focus();
  }

  /** Writes the pal being asked about into the dialog (its picture, name and level, what it is doing, the last-pal warning). */
  private fillConfirm() {
    const entry = this.party.find((p) => p.id === this.confirmId);
    if (!entry) return;
    this.confirmTitle.textContent = `Thả ${getSpecies(entry.speciesId).name} · Lv ${entry.level}?`;
    this.confirmHead.replaceChildren(this.swatch(entry), this.confirmTitle);
    this.confirmStatus.hidden = entry.assignment === "";
    this.confirmStatus.textContent = entry.assignment === "follow" ? "Đang đi theo bạn." : "Đang làm việc ở trại.";
    this.confirmWarn.hidden = this.party.length !== 1;
  }

  /** Closes the dialog; the focus goes back to "Thả bớt" (the cards behind it may have been drawn again) unless the panel is closing. */
  private closeConfirm(restoreFocus = true) {
    if (!this.confirmId) return;
    window.clearTimeout(this.armTimer);
    this.confirm.hidden = true;
    this.confirmId = "";
    if (restoreFocus && this.open && !this.releaseToggle.hidden) this.releaseToggle.focus();
  }

  private confirmRelease() {
    const id = this.confirmId;
    if (!id) return;
    this.closeConfirm();
    this.actions.release(id);
  }
}
