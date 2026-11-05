import type { Stage } from "./stage.ts";
import { LABEL_EASE_MS, LABEL_RANK, TAG_FORM, layoutTags, type LayoutItem } from "./labelLayout.ts";

/** Stacking of name tags: rank 0 (mine) is on top, rank 7 at the bottom; floating texts (CSS) sit above all. */
const LABEL_Z_TOP = 10;

interface Tag extends LayoutItem {
  element: HTMLElement;
  /** World position the tag follows (read every frame). */
  at: () => { x: number; y: number } | undefined;
  /** Height above that point, in world pixels. */
  lift: number;
  visible: boolean;
  /** Priority (`LABEL_RANK`); undefined for floating texts, which are not laid out and are drawn above every tag. */
  baseRank?: number;
  /** The name `span`, found at the first measure. */
  name: HTMLElement | null;
  /** Size must be measured again (just shown, or its class or text changed). */
  dirty: boolean;
  /** The element is displayed (not `display: none`). */
  shown: boolean;
  // What was last written to the element, so unchanged values are not written again.
  drawnX: number;
  drawnY: number;
  drawnRise: number;
  drawnForm: number;
  drawnZ: number;
}

/**
 * Does the CSS show this tag's name? Copies the rule in index.html: a wild pal's
 * text is hidden unless it is hurt, angry or dizzy (leaders and the boss always
 * show it). Change the CSS and this together.
 */
function nameShows(classes: DOMTokenList): boolean {
  return !classes.contains("pal") || classes.contains("alpha") || classes.contains("boss")
    || classes.contains("hurt") || classes.contains("angry") || classes.contains("dizzy");
}

/**
 * Name tags, HP bars and floating texts as DOM elements over the canvas,
 * moved every frame to follow their world positions (crisp text, styled by
 * the page's CSS).
 *
 * Name tags never cover each other (see `layoutTags`): each has a rank, the
 * important ones (mine, the aimed pal, my followers, leaders) keep their place
 * and are never hidden; the others rise a little, shrink to their HP bar, or
 * hide (by `opacity`) and come back only after 250 ms of room. A tag is
 * measured only when it changes (a MutationObserver marks it), so a still
 * scene reads no layout. Do not rewrite a tag's text when it did not change.
 */
export class Labels {
  readonly root: HTMLDivElement;
  private tags = new Set<Tag>();
  private byElement = new WeakMap<Element, Tag>();
  private point = { x: 0, y: 0 };
  /** Tags on screen that take part in the layout; reused every frame. */
  private order: Tag[] = [];
  private lastNow = 0;
  /** Creation order of tags: the older one keeps its place on a tie. */
  private nextSeq = 1;
  private observer: MutationObserver;
  /** For tests and `npm run shots`: `measured` is a running total, the others are of the last frame. */
  readonly counts = { laidOut: 0, tucked: 0, hidden: 0, measured: 0 };

  constructor(parent: HTMLElement, private stage: Stage) {
    this.root = document.createElement("div");
    this.root.className = "labels";
    parent.append(this.root);
    // Our own writes are style only (not in the filter), so they do not trigger this again.
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        let node: Node | null = record.target;
        while (node && node.parentNode !== this.root) node = node.parentNode;
        if (!node) continue;
        const tag = this.byElement.get(node as Element);
        if (tag) tag.dirty = true;
      }
    });
    this.observer.observe(this.root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  }

  /** Adds an element that follows `at`. `baseRank` (a `LABEL_RANK`) puts it in the layout; without it it is a floating text. */
  add(element: HTMLElement, at: Tag["at"], lift: number, baseRank?: number): Tag {
    const tag: Tag = {
      x: 0, y: 0, width: 0, height: 0, barWidth: 0, barHeight: 0, named: true,
      rank: baseRank ?? LABEL_RANK.camp, seq: this.nextSeq++, fresh: true,
      form: TAG_FORM.full, rise: 0, holdUntil: 0,
      placed: false, forced: false, left: 0, top: 0, right: 0, bottom: 0,
      element, at, lift, visible: true, baseRank, name: null, dirty: true, shown: false,
      drawnX: NaN, drawnY: NaN, drawnRise: 0, drawnForm: TAG_FORM.full, drawnZ: -1,
    };
    element.style.position = "absolute";
    element.style.left = "0";
    element.style.top = "0";
    // Shown from the first update, already in place.
    element.style.display = "none";
    this.root.append(element);
    this.tags.add(tag);
    this.byElement.set(element, tag);
    return tag;
  }

  remove(tag: Tag | undefined) {
    if (!tag) return;
    tag.element.remove();
    this.tags.delete(tag);
    this.byElement.delete(tag.element);
  }

  /** A short text rising from a world point, removed after its CSS animation. */
  float(at: { x: number; y: number }, lift: number, text: string, kind = "") {
    // The inner element runs the CSS rise animation; the outer one is positioned.
    const outer = document.createElement("div");
    outer.className = "float";
    const div = document.createElement("div");
    div.className = `float-text ${kind}`;
    div.textContent = text;
    outer.append(div);
    const x = at.x, y = at.y;
    const tag = this.add(outer, () => ({ x, y }), lift);
    setTimeout(() => this.remove(tag), 1200);
  }

  /** `now` in ms; `aimed` is the tag of the wild pal a thrown ball would hit now. */
  update(now: number, aimed?: Tag) {
    const width = this.stage.width, height = this.stage.height;
    const dt = Math.min(100, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    const order = this.order;
    let n = 0;

    // 1. Positions, show and hide. Nothing is read from the page here.
    for (const tag of this.tags) {
      const at = tag.at();
      let show = tag.visible && !!at;
      if (at) {
        const p = this.stage.toScreen(at.x, at.y - tag.lift, this.point);
        show &&= p.x > -100 && p.x < width + 100 && p.y > -60 && p.y < height + 60;
        if (show) {
          tag.x = p.x;
          tag.y = p.y;
        }
      }
      if (!show) {
        if (tag.shown) {
          tag.element.style.display = "none";
          tag.shown = false;
        }
        continue;
      }
      if (!tag.shown) {
        tag.element.style.display = "";
        tag.shown = tag.dirty = tag.fresh = true;
      }
      if (tag.baseRank === undefined) {
        this.place(tag, 0);
        continue;
      }
      tag.rank = tag === aimed ? LABEL_RANK.aimed : tag.baseRank;
      order[n++] = tag;
    }

    // 2. Measure the tags that changed (all reads together, before any further write).
    for (let i = 0; i < n; i++) {
      const tag = order[i];
      if (!tag.dirty) continue;
      const element = tag.element;
      tag.name ??= element.querySelector<HTMLElement>(":scope > span");
      const bar = element.querySelector<HTMLElement>(":scope > .hp-bar");
      tag.width = element.offsetWidth;
      tag.height = element.offsetHeight;
      tag.barWidth = bar ? bar.offsetWidth : 0;
      tag.barHeight = bar ? bar.offsetHeight : 0;
      tag.named = nameShows(element.classList);
      tag.dirty = false;
      this.counts.measured++;
    }

    // 3. Decide.
    layoutTags(order, n, now);

    // 4. Write what changed.
    let laidOut = 0, tucked = 0, hidden = 0;
    const ease = 1 - Math.exp(-dt / LABEL_EASE_MS);
    for (let i = 0; i < n; i++) {
      const tag = order[i];
      if (tag.fresh) tag.drawnRise = tag.rise;
      else {
        tag.drawnRise += (tag.rise - tag.drawnRise) * ease;
        if (Math.abs(tag.rise - tag.drawnRise) < 0.25) tag.drawnRise = tag.rise;
      }
      this.place(tag, tag.drawnRise);
      if (tag.form !== tag.drawnForm) {
        tag.element.style.opacity = tag.form === TAG_FORM.hidden ? "0" : "";
        if (tag.name) tag.name.style.opacity = tag.form === TAG_FORM.compact ? "0" : "";
        tag.drawnForm = tag.form;
      }
      const z = LABEL_Z_TOP - tag.rank;
      if (z !== tag.drawnZ) {
        tag.element.style.zIndex = String(z);
        tag.drawnZ = z;
      }
      if (tag.named || tag.barHeight > 0) {
        laidOut++;
        if (tag.form === TAG_FORM.compact) tucked++;
        else if (tag.form === TAG_FORM.hidden) hidden++;
      }
      tag.fresh = false;
    }
    order.length = n;
    this.counts.laidOut = laidOut;
    this.counts.tucked = tucked;
    this.counts.hidden = hidden;
  }

  /** Moves the element to the tag's screen point, `rise` CSS pixels up; written only when it changed by 0.1 px. */
  private place(tag: Tag, rise: number) {
    const x = Math.round(tag.x * 10), y = Math.round((tag.y - rise) * 10);
    if (x === tag.drawnX && y === tag.drawnY) return;
    tag.drawnX = x;
    tag.drawnY = y;
    tag.element.style.transform = `translate(${x / 10}px, ${y / 10}px) translate(-50%, -100%)`;
  }
}

export type { Tag };
