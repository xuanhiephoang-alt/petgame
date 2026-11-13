/** How much a toast matters: decides how long it stays and what may replace it (see docs/design/hud.md). */
export type ToastLevel = "low" | "normal" | "high";

/** Toast tuning (all times in ms). */
export const TOAST = {
  /** Most toasts shown at once on a roomy screen (two news often arrive together, three would reach the player). */
  maxVisible: 2,
  /** Time to notice a toast appeared, even for a tiny text. */
  baseMs: 1000,
  /** Reading time per character (about 18 characters a second). */
  perCharMs: 55,
  /** Shortest time a toast of each level stays. */
  minMs: { low: 1800, normal: 2500, high: 3000 },
  /** Longest time any toast stays. */
  maxMs: 7000,
  /** How long a toast of each level may wait for a free slot before it is stale and dropped. */
  maxWaitMs: { low: 1000, normal: 4000, high: Infinity },
  /** Most toasts waiting; the weakest are dropped beyond this (guards against a flood). */
  maxWaiting: 4,
  /** Screens this tall (px) or shorter (phones held sideways) show one toast at a time. */
  shortScreenPx: 520,
  /** Upright screens shorter than this show one toast at a time; taller ones show two only when they fit above my name (`toastRoom`). */
  roomyPortraitPx: 790,
  /**
   * The tallest toast on an upright phone: 3 lines of 13 px text, measured at 360-412 px wide (wider columns wrap less).
   * A longer toast (4 lines, 78 px) could still reach my name.
   */
  portraitToastPx: 61,
  /** The gap between toasts (`.hud-toasts` in index.html). */
  gapPx: 4,
  /** The least room left between the last toast and my name tag. */
  nameClearPx: 4,
  /** How often the room is measured again while toasts wait. */
  roomCheckMs: 250,
} as const;

/** Where the toasts start and where the top of my name tag is at rest, health bar shown (CSS px from the top of the screen). */
export interface ToastFit {
  toastsTop: number;
  nameTop: number;
}

/** A toast being shown. */
export interface Toast {
  /** Grows with every toast shown; the HUD ties a DOM element to it. */
  id: number;
  text: string;
  level: ToastLevel;
  shownAt: number;
  /** When it goes away (ms, same clock as `now`). */
  until: number;
}

/** A toast waiting for a free slot. */
export interface WaitingToast {
  text: string;
  level: ToastLevel;
  at: number;
}

const RANK: Record<ToastLevel, number> = { low: 0, normal: 1, high: 2 };

/** How long a toast stays: reading time by length (code points, so an emoji counts once), within its level's floor and the cap. */
export function toastDuration(text: string, level: ToastLevel): number {
  return Math.min(TOAST.maxMs, Math.max(TOAST.minMs[level], TOAST.baseMs + TOAST.perCharMs * [...text].length));
}

/**
 * How many toasts fit at once on a screen of this size (px). `fit` reads the layout, so it is asked only on upright
 * screens `roomyPortraitPx` tall or more; it returns undefined when there is no name to avoid.
 */
export function toastRoom(width: number, height: number, fit?: () => ToastFit | undefined): number {
  if (height <= TOAST.shortScreenPx) return 1;
  if (width >= height) return TOAST.maxVisible;
  if (height < TOAST.roomyPortraitPx) return 1;
  const at = fit?.();
  if (!at) return TOAST.maxVisible;
  const bottom = at.toastsTop + TOAST.maxVisible * TOAST.portraitToastPx + (TOAST.maxVisible - 1) * TOAST.gapPx;
  return bottom + TOAST.nameClearPx <= at.nameTop ? TOAST.maxVisible : 1;
}

/**
 * Pure toast queue (no DOM, time passed in). High toasts are never replaced or cut short; low ones replace each other,
 * so the latest feedback to a button press wins.
 */
export class ToastQueue {
  /** Toasts being shown, oldest first. */
  readonly visible: Toast[] = [];
  readonly waiting: WaitingToast[] = [];
  private nextId = 1;

  constructor(private maxVisible: () => number = () => TOAST.maxVisible) {}

  /**
   * Adds a toast. In order:
   * 1. expire what is due (a freed slot goes to the strongest waiting toast first);
   * 2. same text as one shown: that one stays longer, nothing is added; same text as one waiting: ignored;
   * 3. a free slot: shown at once;
   * 4. no slot: it replaces the weakest shown toast (lowest level, then oldest) if that one is lower, or equal but not high;
   * 5. otherwise it waits; beyond `maxWaiting` the weakest waiting toast (possibly this one) is dropped.
   * Returns true when `visible` changed.
   */
  push(text: string, level: ToastLevel, now: number): boolean {
    const changed = this.update(now);
    const shown = this.visible.find((t) => t.text === text);
    if (shown) {
      shown.until = Math.max(shown.until, now + toastDuration(text, level));
      return changed;
    }
    if (this.waiting.some((w) => w.text === text)) return changed;
    if (this.visible.length < this.maxVisible()) {
      this.show(text, level, now);
      return true;
    }
    let weakest = 0;
    for (let i = 1; i < this.visible.length; i++) {
      const a = this.visible[i];
      const b = this.visible[weakest];
      if (RANK[a.level] < RANK[b.level] || (a.level === b.level && a.shownAt < b.shownAt)) weakest = i;
    }
    const target = this.visible[weakest];
    if (target && (RANK[target.level] < RANK[level] || (target.level === level && level !== "high"))) {
      this.visible.splice(weakest, 1);
      this.show(text, level, now);
      return true;
    }
    this.waiting.push({ text, level, at: now });
    if (this.waiting.length > TOAST.maxWaiting) {
      let drop = 0;
      for (let i = 1; i < this.waiting.length; i++) {
        const a = this.waiting[i];
        const b = this.waiting[drop];
        if (RANK[a.level] < RANK[b.level] || (a.level === b.level && a.at < b.at)) drop = i;
      }
      this.waiting.splice(drop, 1);
    }
    return changed;
  }

  /** Expires shown toasts, drops stale waiting ones and fills free slots with the strongest waiting. True when `visible` changed. Allocates nothing when idle. */
  update(now: number): boolean {
    let changed = false;
    for (let i = this.visible.length - 1; i >= 0; i--) {
      if (this.visible[i].until <= now) {
        this.visible.splice(i, 1);
        changed = true;
      }
    }
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const w = this.waiting[i];
      if (now - w.at > TOAST.maxWaitMs[w.level]) this.waiting.splice(i, 1);
    }
    while (this.waiting.length > 0 && this.visible.length < this.maxVisible()) {
      let best = 0;
      for (let i = 1; i < this.waiting.length; i++) {
        const a = this.waiting[i];
        const b = this.waiting[best];
        if (RANK[a.level] > RANK[b.level] || (a.level === b.level && a.at < b.at)) best = i;
      }
      const [next] = this.waiting.splice(best, 1);
      this.show(next.text, next.level, now);
      changed = true;
    }
    return changed;
  }

  private show(text: string, level: ToastLevel, now: number) {
    this.visible.push({ id: this.nextId++, text, level, shownAt: now, until: now + toastDuration(text, level) });
  }
}
