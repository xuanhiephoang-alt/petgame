/** Looks only (not balance) of a prop hit by a tool and of one growing back. */
export const PROP_MOTION = {
  /** Seconds a hit prop shakes. */
  shakeSec: 0.35,
  /** Seconds a prop takes to swell back to full size. */
  growSec: 0.45,
  /** Fraction of the full size a prop starts growing from. */
  growFrom: 0.55,
  /** Largest lean of a hit tree (rad). */
  leanMax: 0.14,
  /** Lean oscillation speed (rad per second left). */
  leanRate: 60,
  /** Largest sideways jolt of a hit rock, stump or rubble (px). */
  joltPx: 2,
  /** Jolt oscillation speed (rad per second left). */
  joltRate: 90,
};

/** A countdown moved on by `dt` seconds; never below 0, and a negative `dt` never raises it. */
export function countDown(left: number, dt: number): number {
  return Math.max(0, left - Math.max(0, dt));
}

/** Lean (rad) of a hit tree with `left` seconds of shake to go: fades out, exactly 0 when done. */
export function shakeLean(left: number): number {
  if (left <= 0) return 0;
  return Math.sin(left * PROP_MOTION.leanRate) * PROP_MOTION.leanMax * (left / PROP_MOTION.shakeSec);
}

/** Sideways jolt (px) of a hit rock, stump or rubble with `left` seconds to go: exactly 0 when done. */
export function shakeJolt(left: number): number {
  if (left <= 0) return 0;
  return Math.sin(left * PROP_MOTION.joltRate) * PROP_MOTION.joltPx * (left / PROP_MOTION.shakeSec);
}

/** Size relative to full size of a prop with `left` seconds of growing to go (ease-out): 1 when done. */
export function growSize(left: number): number {
  if (left <= 0) return 1;
  const g = Math.min(1, Math.max(0, 1 - left / PROP_MOTION.growSec));
  const from = PROP_MOTION.growFrom;
  return from + (1 - from) * (1 - (1 - g) * (1 - g));
}
