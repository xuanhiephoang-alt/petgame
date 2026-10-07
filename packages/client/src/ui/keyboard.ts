import type { Vec2 } from "@petgame/shared";

/** Tracks held keys and fires one-shot actions. */
export class Keyboard {
  private held = new Set<string>();

  constructor(actions: Record<string, () => void>) {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (!e.repeat && actions[key]) actions[key]();
      this.held.add(key);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.held.clear());
  }

  direction(): Vec2 {
    const h = this.held;
    const x = (h.has("d") || h.has("arrowright") ? 1 : 0) - (h.has("a") || h.has("arrowleft") ? 1 : 0);
    const y = (h.has("s") || h.has("arrowdown") ? 1 : 0) - (h.has("w") || h.has("arrowup") ? 1 : 0);
    return { x, y };
  }
}
