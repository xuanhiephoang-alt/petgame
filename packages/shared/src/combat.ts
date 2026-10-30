import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { CollisionGrid } from "./collision.ts";
import { clamp, type Vec2 } from "./movement.ts";
import type { Element, PalSpecies } from "./pals.ts";
import { scaledMaxHp } from "./progression.ts";
import type { Reward } from "./rewards.ts";
import type { Resource } from "./work.ts";

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

/** A wild pal crouches this long before it bites (ms): step back or dash to dodge. */
export const WILD_WINDUP_MS = 450;
/** The bite still lands if its target is this close when the wind-up ends (pixels). */
export const WILD_BITE_REACH = WILD_ATTACK_RANGE + 10;
/** A bite pushes its target back this far (pixels); the boss's stomp much farther. */
export const BITE_KNOCKBACK = 16;
export const STOMP_KNOCKBACK = 44;
/** At 1 HP a wild pal is dizzy this long (ms): easy to catch, and one more hit knocks it out. */
export const DIZZY_MS = 6000;
/** A dizzy pal is this much easier to catch (multiplies the ball's bonus). */
export const DIZZY_CATCH_BONUS = 1.5;
/** A pal that shakes off its daze gets this share of its health back. */
export const DIZZY_RECOVER = 0.3;
/** A passive pal that gets hit runs away this long (ms). */
export const FLEE_MS = 2500;
/** How often a player's hit is critical, and how much harder it hits. */
export const CRIT_CHANCE = 0.12;
export const CRIT_MULTIPLIER = 1.6;

/**
 * A hit on a wild pal (not the boss). Its HP never drops below 1, so it can
 * still be caught, and reaching 1 makes it dizzy; a player's hit on a pal
 * that is already dizzy knocks it out. Other hits (a companion, a skill's
 * splash) leave a dizzy pal alone.
 */
export function hitWildPal(hp: number, amount: number, dizzy: boolean, byPlayer: boolean): { hp: number; dizzy: boolean; knockedOut: boolean } {
  if (dizzy) return byPlayer ? { hp: 0, dizzy: false, knockedOut: true } : { hp, dizzy, knockedOut: false };
  const next = Math.max(1, hp - amount);
  return { hp: next, dizzy: next <= 1, knockedOut: false };
}

/**
 * Pushes something at `pos` away from `from` by `dist` pixels, sliding
 * around obstacles and staying in the world; `blocked` (the sea, say)
 * cancels the push. Straight down the screen when both are on one spot.
 */
export function knockback(
  pos: Vec2,
  from: Vec2,
  dist: number,
  radius: number,
  obstacles?: CollisionGrid,
  blocked?: (at: Vec2) => boolean,
): Vec2 {
  if (dist <= 0) return { x: pos.x, y: pos.y };
  const dx = pos.x - from.x, dy = pos.y - from.y;
  const d = Math.hypot(dx, dy);
  const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1;
  let next = { x: clamp(pos.x + nx * dist, radius, WORLD_WIDTH - radius), y: clamp(pos.y + ny * dist, radius, WORLD_HEIGHT - radius) };
  if (obstacles) next = obstacles.resolve(next, radius);
  return blocked?.(next) ? { x: pos.x, y: pos.y } : next;
}

/** What a knocked-out wild pal leaves behind, by its element. */
const DROPS: Record<Element, Resource[]> = {
  grass: ["berries", "wood"],
  fire: ["wood"],
  water: ["berries"],
  earth: ["stone"],
  electric: ["stone", "wood"],
};

/** A knocked-out wild pal's loot: a pile of one resource of its element (more at higher levels), sometimes a snack. */
export function palDrops(species: PalSpecies, level: number, rand: () => number): Reward {
  const kinds = DROPS[species.element];
  const resource = kinds[Math.floor(rand() * kinds.length)] ?? kinds[0];
  const reward: Reward = { [resource]: 1 + Math.floor(level / 4) + (rand() < 0.5 ? 1 : 0) };
  if (rand() < 0.1) reward.snacks = 1;
  return reward;
}

/** Damage a wild pal deals per hit: +15% per level above 1. */
export function wildDamage(species: PalSpecies, level: number): number {
  return Math.round(species.attack * (1 + 0.15 * (level - 1)));
}

/** A captured pal's health when out in the world. */
export function companionMaxHp(species: PalSpecies, level: number): number {
  return scaledMaxHp(species.maxHp, level);
}
