import type { PalSpecies } from "./pals.ts";
import { scaledMaxHp } from "./progression.ts";

export const PLAYER_MAX_HP = 100;
/** Wild pals hit from this close (pixels, edge to edge-ish). */
export const WILD_ATTACK_RANGE = 40;
export const WILD_ATTACK_COOLDOWN_MS = 1200;
/** How long a provoked wild pal keeps chasing its attacker. */
export const WILD_AGGRO_MS = 8000;
/** Aggressive wild pals notice players and companions this close. */
export const AGGRESSIVE_SIGHT = 120;
/** Chasing wild pals move this much faster than when wandering. */
export const WILD_CHASE_SPEED_FACTOR = 1.8;
/** No damage taken for this long starts health regeneration. */
export const REGEN_DELAY_MS = 5000;
export const REGEN_PER_SECOND = 4;
/** Eating one berry heals this much. */
export const BERRY_HEAL = 20;
/** A knocked-out companion must rest this long before it can come out again. */
export const FAINT_REST_MS = 30_000;

/** Damage a wild pal deals per hit: +15% per level above 1. */
export function wildDamage(species: PalSpecies, level: number): number {
  return Math.round(species.attack * (1 + 0.15 * (level - 1)));
}

/** A captured pal's health when out in the world. */
export function companionMaxHp(species: PalSpecies, level: number): number {
  return scaledMaxHp(species.maxHp, level);
}
