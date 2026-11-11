import type { Vec2 } from "@petgame/shared";

/** What decides whether the world's keys are held back for the HUD. */
export interface KeyGate {
  /** A modal dialog is open (the release confirmation). */
  dialogOpen(): boolean;
  /** Panels that take the keys when the keyboard brought the focus into them (hidden ones are skipped). */
  panels: readonly HTMLElement[];
}

export interface KeyFocusState {
  dialogOpen: boolean;
  /** The focused element is inside a panel that is open. */
  focusInOpenPanel: boolean;
  /** The focus got there by a key press (a click or touch leaves the keys on). */
  focusByKeyboard: boolean;
}

/** The world's keys pause in a dialog, or in a panel the player reached with the keyboard (a click leaves them on). */
export function worldKeysPaused(s: KeyFocusState): boolean {
  return s.dialogOpen || (s.focusInOpenPanel && s.focusByKeyboard);
}

const STILL: Readonly<Vec2> = { x: 0, y: 0 };

/**
 * Tracks held keys and fires one-shot actions. While the gate says the HUD has the keyboard (see worldKeysPaused),
 * the world's keys do nothing and are not blocked, so Space, Enter and Tab keep their usual job in the dialog or panel.
 */
export class Keyboard {
  private held = new Set<string>();
  /** Whether the latest new input was a key press, not an auto-repeat (true), or a pointer (false). */
  private lastInputKey = false;
  /** The element that got the focus from a key press, if the last focus change was one. */
  private keyFocused: Element | null = null;
  /** Reused every call so the per-frame check allocates nothing. */
  private focusState: KeyFocusState = { dialogOpen: false, focusInOpenPanel: false, focusByKeyboard: false };

  constructor(actions: Record<string, () => void>, private gate: KeyGate) {
    // An auto-repeat of a held key is not a new input: a click made while a key is held stays a click.
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) this.lastInputKey = true;
    }, true);
    window.addEventListener("pointerdown", () => (this.lastInputKey = false), true);
    document.addEventListener("focusin", (e) => (this.keyFocused = this.lastInputKey ? (e.target as Element) : null), true);

    // Space (attack) and the other action keys belong to the game, not to the HUD button clicked last.
    const ownKey = (e: KeyboardEvent) => {
      if (actions[e.key.toLowerCase()] && (e.target as HTMLElement | null)?.tagName === "BUTTON") e.preventDefault();
    };
    window.addEventListener("keydown", (e) => {
      if (this.paused()) {
        this.held.clear();
        return;
      }
      const key = e.key.toLowerCase();
      ownKey(e);
      if (!e.repeat && actions[key]) actions[key]();
      this.held.add(key);
    });
    window.addEventListener("keyup", (e) => {
      this.held.delete(e.key.toLowerCase());
      if (!this.paused()) ownKey(e);
    });
    window.addEventListener("blur", () => {
      this.held.clear();
      this.lastInputKey = false; // a focus handed back on return is not the keyboard's
    });
  }

  /** True while the world's keys are held back for a dialog or a panel. */
  paused(): boolean {
    const a = document.activeElement;
    const s = this.focusState;
    s.dialogOpen = this.gate.dialogOpen();
    s.focusInOpenPanel = false;
    if (a) {
      for (const p of this.gate.panels) {
        if (!p.hidden && p.contains(a)) s.focusInOpenPanel = true;
      }
    }
    s.focusByKeyboard = !!a && a === this.keyFocused;
    return worldKeysPaused(s);
  }

  direction(): Vec2 {
    if (this.paused()) {
      this.held.clear();
      return STILL;
    }
    const h = this.held;
    const x = (h.has("d") || h.has("arrowright") ? 1 : 0) - (h.has("a") || h.has("arrowleft") ? 1 : 0);
    const y = (h.has("s") || h.has("arrowdown") ? 1 : 0) - (h.has("w") || h.has("arrowup") ? 1 : 0);
    return { x, y };
  }
}
