import type { Stage } from "./stage.ts";

interface Tag {
  element: HTMLElement;
  /** World position the tag follows (read every frame). */
  at: () => { x: number; y: number } | undefined;
  /** Height above that point, in world pixels. */
  lift: number;
  visible: boolean;
}

/**
 * Name tags, HP bars and floating texts as DOM elements over the canvas,
 * moved every frame to follow their world positions (crisp text, styled by
 * the page's CSS).
 */
export class Labels {
  readonly root: HTMLDivElement;
  private tags = new Set<Tag>();
  private point = { x: 0, y: 0 };

  constructor(parent: HTMLElement, private stage: Stage) {
    this.root = document.createElement("div");
    this.root.className = "labels";
    parent.append(this.root);
  }

  add(element: HTMLElement, at: Tag["at"], lift: number): Tag {
    const tag: Tag = { element, at, lift, visible: true };
    element.style.position = "absolute";
    element.style.left = "0";
    element.style.top = "0";
    this.root.append(element);
    this.tags.add(tag);
    return tag;
  }

  remove(tag: Tag | undefined) {
    if (!tag) return;
    tag.element.remove();
    this.tags.delete(tag);
  }

  /** A short text rising from a world point, removed after its CSS animation. */
  float(at: { x: number; y: number }, lift: number, text: string, kind = "") {
    // The inner element runs the CSS rise animation; the outer one is positioned.
    const outer = document.createElement("div");
    const div = document.createElement("div");
    div.className = `float-text ${kind}`;
    div.textContent = text;
    outer.append(div);
    const x = at.x, y = at.y;
    const tag = this.add(outer, () => ({ x, y }), lift);
    setTimeout(() => this.remove(tag), 1200);
  }

  update() {
    const width = this.stage.width, height = this.stage.height;
    for (const tag of this.tags) {
      const at = tag.at();
      let show = tag.visible && !!at;
      if (at) {
        const p = this.stage.toScreen(at.x, at.y - tag.lift, this.point);
        show &&= p.x > -100 && p.x < width + 100 && p.y > -60 && p.y < height + 60;
        if (show) tag.element.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      const display = show ? "" : "none";
      if (tag.element.style.display !== display) tag.element.style.display = display;
    }
  }
}

export type { Tag };
