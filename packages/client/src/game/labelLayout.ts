/**
 * Name tag layout: pure arithmetic on screen rectangles (no DOM, no PixiJS) so it
 * can be tested in Node. `Labels` fills the input fields every frame, calls
 * `layoutTags` and applies the result to the page.
 *
 * Tags are placed most important first. A tag that collides with one already
 * placed tries, in order: rise a little, shrink to its HP bar only, hide.
 */

/** Priority of a tag: the smaller number keeps its place first. Ranks up to `PINNED_RANK` are never hidden. */
export const LABEL_RANK = { me: 0, aimed: 1, follower: 2, leader: 3, player: 4, companion: 5, wild: 6, camp: 7 } as const;

/** Tags up to this rank are pinned: always shown (they may overlap only when there is truly no room). */
export const PINNED_RANK = LABEL_RANK.leader;

/** How much of a tag is drawn; a bigger number shows less. */
export const TAG_FORM = { full: 0, compact: 1, hidden: 2 } as const;
export type TagForm = (typeof TAG_FORM)[keyof typeof TAG_FORM];

/** Smallest empty space kept between two tags, in CSS pixels. */
export const LABEL_GAP_PX = 2;
/** A normal tag rises at most this far: just over one name-only tag (17 + 2), so tags never fly far from their owner. */
export const LABEL_NUDGE_PX = 22;
/** A pinned tag rises at most this far: enough to clear two stacked tags (24 + 17 + 2 * 2), so three pinned tags in one spot all show. */
export const LABEL_PINNED_NUDGE_PX = 48;
/** A shrunk or hidden tag must have room for this long before it comes back, so it does not blink. */
export const LABEL_REVEAL_MS = 250;
/** Safety cap on laid-out tags; normal tags beyond it are hidden at once (in practice 30 or fewer are on screen). */
export const LABEL_LAYOUT_MAX = 64;
/** Time constant of the smooth height change of a tag, in ms (95% done after about three times this). */
export const LABEL_EASE_MS = 60;

/** The camera looks this many world px above my feet. */
export const CAMERA_LEAD_PX = 16;
/** A player's name tag hangs this many world px above the head. */
export const PLAYER_TAG_LIFT_PX = 6;
/** Height of a name (`.label span`: 12 px text, 1 px padding); keep in step with index.html. */
export const NAME_TAG_PX = 17;
/** The health bar under a hurt name (`.label` gap 3 + `.hp-bar` 5) lifts the name by this much. */
export const HURT_BAR_PX = 8;

/**
 * Top of my name tag (CSS px) while I stand still in the middle of a screen `screenHeight` tall, with its health bar
 * showing, for a figure `actorHeight` world px tall (hair and hat). The camera centre is CAMERA_LEAD_PX above my feet;
 * the tag is anchored by its bottom at PLAYER_TAG_LIFT_PX above my head.
 */
export function restingNameTop(screenHeight: number, zoom: number, actorHeight: number): number {
  return screenHeight / 2 + (CAMERA_LEAD_PX - actorHeight - PLAYER_TAG_LIFT_PX) * zoom - NAME_TAG_PX - HURT_BAR_PX;
}

/** One tag for the layout. Screen coordinates are CSS pixels, y down. */
export interface LayoutItem {
  // In, written by the caller every frame.
  /** Anchor: the middle of the tag's bottom edge at its natural place. */
  x: number;
  y: number;
  /** Size of the whole tag. */
  width: number;
  height: number;
  /** Size of its HP bar; 0 when the bar is not shown. */
  barWidth: number;
  barHeight: number;
  /** Is the name text shown (wild pals only show it when hurt, angry or dizzy). */
  named: boolean;
  /** Effective priority (`LABEL_RANK`). */
  rank: number;
  /** Creation order, breaks ties so the older tag keeps its place. */
  seq: number;
  /** Just came on screen: take the computed form at once. Cleared by the caller after drawing. */
  fresh: boolean;

  // Kept between frames.
  form: TagForm;
  /** Height above the natural place, in CSS pixels. */
  rise: number;
  /** Time (ms) before a shrunk or hidden tag may come back. */
  holdUntil: number;

  // Out, scratch of the current frame.
  /** The rectangle below is taken. */
  placed: boolean;
  /** Pinned tag that found no room: shown anyway, overlapping. */
  forced: boolean;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Is `a` placed before `b`? Pinned first (front to back), then by rank; creation order breaks every tie. */
function comesFirst(a: LayoutItem, b: LayoutItem): boolean {
  const pinnedA = a.rank <= PINNED_RANK, pinnedB = b.rank <= PINNED_RANK;
  if (pinnedA !== pinnedB) return pinnedA;
  // Pinned: the one lower on screen (nearer the viewer) keeps its place, the one behind rises.
  if (pinnedA && a.y !== b.y) return a.y > b.y;
  if (a.rank !== b.rank) return a.rank < b.rank;
  return a.seq < b.seq;
}

/** Does the rectangle (padded by the gap) touch a placed tag? Returns its index or -1. */
function hitIndex(items: LayoutItem[], count: number, left: number, top: number, right: number, bottom: number): number {
  for (let j = 0; j < count; j++) {
    const q = items[j];
    if (!q.placed) continue;
    if (left < q.right + LABEL_GAP_PX && right > q.left - LABEL_GAP_PX && top < q.bottom + LABEL_GAP_PX && bottom > q.top - LABEL_GAP_PX) return j;
  }
  return -1;
}

/**
 * Smallest height (0..cap) a `w` by `h` box anchored at tag `i` must rise to
 * clear every placed tag before it; -1 when it needs more than `cap`.
 */
function riseFor(items: LayoutItem[], i: number, w: number, h: number, cap: number): number {
  const { x, y } = items[i];
  let off = 0;
  for (;;) {
    const j = hitIndex(items, i, x - w / 2, y - off - h, x + w / 2, y - off);
    if (j < 0) return off;
    // Just clear the tag in the way; the offset grows every round, so this ends.
    off = y - items[j].top + LABEL_GAP_PX;
    if (off > cap) return -1;
  }
}

/**
 * Lays out `items[0..count)`: sorts them in place (most important first) and
 * writes `form`, `rise` and the taken rectangle (`placed`, `forced`, ...) into
 * each. Does not clear `fresh` (the caller does after drawing). Allocates nothing.
 */
export function layoutTags(items: LayoutItem[], count: number, now: number): void {
  // Insertion sort: stable, and nearly sorted from the previous frame.
  for (let i = 1; i < count; i++) {
    const cur = items[i];
    let j = i - 1;
    while (j >= 0 && comesFirst(cur, items[j])) {
      items[j + 1] = items[j];
      j--;
    }
    items[j + 1] = cur;
  }

  for (let i = 0; i < count; i++) {
    const it = items[i];
    it.placed = false;
    it.forced = false;
    // Nothing to show (a calm wild pal): takes no room, and shows at once when it has something.
    if (!it.named && it.barHeight === 0) {
      it.form = TAG_FORM.full;
      it.rise = 0;
      continue;
    }
    const pinned = it.rank <= PINNED_RANK;
    if (!pinned && i >= LABEL_LAYOUT_MAX) {
      it.form = TAG_FORM.hidden;
      it.rise = 0;
      it.holdUntil = now + LABEL_REVEAL_MS;
      continue;
    }
    const cap = pinned ? LABEL_PINNED_NUDGE_PX : LABEL_NUDGE_PX;

    let best: TagForm = TAG_FORM.hidden;
    let bestRise = 0;
    if (it.named) {
      const r = riseFor(items, i, it.width, it.height, cap);
      if (r >= 0) {
        best = TAG_FORM.full;
        bestRise = r;
      }
    }
    if (best === TAG_FORM.hidden && it.barHeight > 0) {
      const r = riseFor(items, i, it.barWidth, it.barHeight, cap);
      if (r >= 0) {
        best = TAG_FORM.compact;
        bestRise = r;
      }
    }
    if (best === TAG_FORM.hidden && pinned) {
      best = it.barHeight > 0 ? TAG_FORM.compact : TAG_FORM.full;
      bestRise = 0;
      it.forced = true;
    }

    // Anti-flicker: give room up at once, take it back only after a quiet spell.
    if (it.fresh || (pinned && it.form === TAG_FORM.hidden)) {
      it.form = best;
      it.holdUntil = now + LABEL_REVEAL_MS;
    } else if (best > it.form) {
      it.form = best;
      it.holdUntil = now + LABEL_REVEAL_MS;
    } else if (best < it.form) {
      if (now >= it.holdUntil) it.form = best;
    } else if (it.form !== TAG_FORM.full) {
      it.holdUntil = now + LABEL_REVEAL_MS;
    }
    // A smaller form (waiting to come back) sits inside the rectangle of the best one.
    it.rise = bestRise;

    if (it.form !== TAG_FORM.hidden) {
      const w = it.form === TAG_FORM.compact ? it.barWidth : it.width;
      const h = it.form === TAG_FORM.compact ? it.barHeight : it.height;
      it.placed = true;
      it.left = it.x - w / 2;
      it.right = it.x + w / 2;
      it.bottom = it.y - it.rise;
      it.top = it.bottom - h;
    }
  }
}
