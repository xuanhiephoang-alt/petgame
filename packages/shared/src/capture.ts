/** The ball's flight, its drop to the ground and each wobble (ms): the catch animation, and how long a pal stays in the ball. */
export const BALL_FLIGHT_MS = 380;
export const BALL_DROP_MS = 260;
export const BALL_SHAKE_MS = 420;

/**
 * How many times the ball wobbles: three before it clicks shut, otherwise
 * one, or two when `roll` (the draw that decided it) came close to `chance`.
 */
export function captureShakes(success: boolean, chance: number, roll: number): number {
  if (success) return 3;
  return roll < chance + (1 - chance) * 0.4 ? 2 : 1;
}

/** When (ms after the throw) the ball clicks shut or the pal breaks out. */
export function captureRevealMs(shakes: number): number {
  return BALL_FLIGHT_MS + BALL_DROP_MS + shakes * BALL_SHAKE_MS;
}

/**
 * Probability (0..1) that a capture attempt succeeds.
 *
 * Lower remaining HP makes capture easier: at full HP the chance is
 * `catchRate * ballBonus`, and it rises toward 1 as HP approaches 0.
 */
export function captureChance(hp: number, maxHp: number, catchRate: number, ballBonus = 1): number {
  if (maxHp <= 0) return 0;
  const hpRatio = Math.min(Math.max(hp / maxHp, 0), 1);
  const base = Math.min(catchRate * ballBonus, 1);
  const chance = base + (1 - base) * (1 - hpRatio) * 0.8;
  return Math.min(Math.max(chance, 0), 1);
}
