import { COMPANION_DAMAGE } from "./constants.ts";

export const MAX_LEVEL = 30;
/** XP a companion earns for each hit it lands. */
export const XP_PER_HIT = 4;
/** XP the following companion earns when its owner captures a pal. */
export const XP_PER_CAPTURE = 25;
/** XP a working pal earns per item it produces. */
export const XP_PER_WORK = 2;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(20 * Math.pow(level, 1.5));
}

export interface LevelState {
  level: number;
  xp: number;
}

/** Adds XP, levelling up as many times as it covers. Caps at MAX_LEVEL. */
export function addXp(state: LevelState, gained: number): LevelState & { levelsGained: number } {
  let { level, xp } = state;
  xp += Math.max(0, gained);
  let levelsGained = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp, levelsGained };
}

/** Damage a companion deals per hit: +15% per level above 1. */
export function companionDamage(level: number): number {
  return Math.round(COMPANION_DAMAGE * (1 + 0.15 * (level - 1)));
}

/** Wild pals get 20% more HP per level above 1. */
export function scaledMaxHp(baseHp: number, level: number): number {
  return Math.round(baseHp * (1 + 0.2 * (level - 1)));
}

/** Higher-level wild pals are harder to catch (-6% catch rate per level, floor 30% of base). */
export function levelCatchRate(catchRate: number, level: number): number {
  return catchRate * Math.max(0.3, 1 - 0.06 * (level - 1));
}

/** Highest wild level at a spot: 6 near the spawn, up to 14 at the edges (see dangerAt). */
export function wildMaxLevel(danger: number): number {
  return 6 + Math.round(Math.min(1, Math.max(0, danger)) * 8);
}

/** Wild pal level, weighted toward low levels. `roll` is in [0, 1). */
export function rollWildLevel(roll: number, maxLevel = 6): number {
  return 1 + Math.floor(Math.pow(roll, 2) * maxLevel);
}
