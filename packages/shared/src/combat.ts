import { PLAYER_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { CollisionGrid } from "./collision.ts";
import { clamp, type Vec2 } from "./movement.ts";
import { NAV_MAX_CLEARANCE, type NavGrid } from "./pathfind.ts";
import type { Element, PalSpecies } from "./pals.ts";
import { scaledMaxHp } from "./progression.ts";
import type { Reward } from "./rewards.ts";
import type { Resource } from "./work.ts";

export const PLAYER_MAX_HP = 100;
/** Wild pals hit from this close (pixels, edge to edge-ish). */
export const WILD_ATTACK_RANGE = 40;
export const WILD_ATTACK_COOLDOWN_MS = 1200;
/**
 * A wild pal's bite grows this much per level above 1 (+8%), slower than its health (+20%, scaledMaxHp) and a
 * companion's hits (+15%, companionDamage): a player's health never grows, so far-off pals should take longer
 * to beat, not knock players out much faster. Pack leaders bite like this too (times ALPHA.damageMultiplier).
 */
export const WILD_DAMAGE_PER_LEVEL = 0.08;
/** How long a provoked wild pal keeps chasing its attacker. */
export const WILD_AGGRO_MS = 8000;
/** Aggressive wild pals notice players and companions this close. */
export const AGGRESSIVE_SIGHT = 120;
/**
 * Chasing wild pals move this much faster than when wandering; fleeing passive pals too, but never faster
 * than WILD_FLEE_SPEED_CAP.
 */
export const WILD_CHASE_SPEED_FACTOR = 1.8;
/**
 * Fleeing passive pals never run faster than this (px/s): 0.6 of a walking player's speed, so a player who
 * follows even at 70% of full speed (touch joystick, weaving round trees) keeps hitting at the weapon's own
 * pace instead of waiting out FLEE_MS (BALANCE.md of T27, docs/design/pals.md "Tính khí").
 */
export const WILD_FLEE_SPEED_CAP = PLAYER_SPEED * 0.6;

/** How fast a passive pal of this wandering speed runs away when hit (px/s): its chase speed, capped. */
export function fleeSpeed(speciesSpeed: number): number {
  return Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, WILD_FLEE_SPEED_CAP);
}
/** No damage taken for this long starts health regeneration. */
export const REGEN_DELAY_MS = 5000;
export const REGEN_PER_SECOND = 4;
/** Eating one berry heals this much. */
export const BERRY_HEAL = 20;
/**
 * After a berry is eaten, the next one waits this long (ms). Eating then heals 5 a second at most, less than
 * any region's strongest common wild pal deals (10-23 a second), so it saves a fight but never replaces
 * dodging (BALANCE.md of T32, docs/design/pals.md).
 */
export const EAT_COOLDOWN_MS = 4000;
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

/** Numbers of how a fleeing passive pal picks its heading (fleeDirection). */
export interface FleeSteerTable {
  /** First pass looks this far (degrees) to either side of straight away from the attacker. */
  halfAngleDeg: number;
  /** Headings in the first pass; odd, so straight away (0 degrees) is one of them. */
  samples: number;
  /** Length (px) of the stretch a heading must keep clear: one second of running at WILD_FLEE_SPEED_CAP. */
  lookaheadPx: number;
  /** Score weight of cos(offset from straight away). */
  alignWeight: number;
  /** Score weight of the open space at the end of the stretch (0..1 of NAV_MAX_CLEARANCE). */
  clearanceWeight: number;
  /** A chosen heading is kept this long (ms), so the pal does not jitter between near-equal headings. */
  holdMs: number;
  /** Headings around the full circle, tried when every forward heading is blocked. */
  fallbackSamples: number;
}

/** Tuned in BALANCE.md of T57; see docs/design/pals.md "Chạy về phía thoáng". Changing these is a balance change. */
export const FLEE_STEER: FleeSteerTable = {
  halfAngleDeg: 70,
  samples: 9,
  lookaheadPx: 96,
  alignWeight: 1,
  clearanceWeight: 1,
  holdMs: 250,
  fallbackSamples: 16,
};

/** "ahead": a forward heading is clear; "around": only a wider one is; "straight": boxed in, runs straight away. */
export type FleeHeading = "ahead" | "around" | "straight";
export interface FleeChoice {
  /** Unit vector to run along. */
  x: number;
  y: number;
  heading: FleeHeading;
}
/** Server-only steering memory of one fleeing pal. */
export interface FleeSteerState {
  dirX: number;
  dirY: number;
  /** Keep the heading until this time (ms); 0 forces a new choice. */
  steerUntil: number;
}

type FleeNav = Pick<NavGrid, "clearanceAt" | "lineClear">;
/** Scratch end point of the stretch being tested, so choosing a heading allocates little. */
const fleeEnd: Vec2 = { x: 0, y: 0 };

/**
 * Picks the unit direction a hit passive pal runs along: straight away from `from` when that stretch is clear,
 * else the best clear heading within a wide cone (score: alignment plus open space), else any clear heading
 * around the circle, else straight away as before. Deterministic: headings are tried in a fixed order and
 * only a strictly better score replaces the best, so ties keep the heading closest to straight away.
 */
export function fleeDirection(pos: Vec2, from: Vec2, radius: number, nav: FleeNav, steer: FleeSteerTable = FLEE_STEER): FleeChoice {
  const dx = pos.x - from.x, dy = pos.y - from.y;
  const d = Math.hypot(dx, dy);
  const ax = d > 1e-6 ? dx / d : 0, ay = d > 1e-6 ? dy / d : 1;
  const base = Math.atan2(ay, ax);
  const body = { radius, sea: false };

  /** Best clear heading among `n` ones `stepRad` apart, tried 0, +1, -1, +2, -2 ... steps off straight away. */
  const pick = (n: number, stepRad: number): { x: number; y: number } | undefined => {
    let best: { x: number; y: number } | undefined;
    let bestScore = -Infinity;
    for (let i = 0; i < n; i++) {
      const off = (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * stepRad;
      const hx = Math.cos(base + off), hy = Math.sin(base + off);
      fleeEnd.x = pos.x + hx * steer.lookaheadPx;
      fleeEnd.y = pos.y + hy * steer.lookaheadPx;
      if (!nav.lineClear(pos, fleeEnd, body)) continue;
      const open = Math.min(nav.clearanceAt(fleeEnd.x, fleeEnd.y), NAV_MAX_CLEARANCE) / NAV_MAX_CLEARANCE;
      const score = steer.alignWeight * Math.cos(off) + steer.clearanceWeight * open;
      if (score > bestScore) {
        bestScore = score;
        best = { x: hx, y: hy };
      }
    }
    return best;
  };

  const ahead = pick(steer.samples, (2 * steer.halfAngleDeg * Math.PI) / 180 / (steer.samples - 1));
  if (ahead) return { ...ahead, heading: "ahead" };
  const around = pick(steer.fallbackSamples, (2 * Math.PI) / steer.fallbackSamples);
  if (around) return { ...around, heading: "around" };
  return { x: ax, y: ay, heading: "straight" };
}

/**
 * Chooses a new heading for a fleeing pal unless the last one is still held (so it does not jitter).
 * Returns whether it chose; setting `state.steerUntil = 0` forces a new choice on the next call.
 */
export function steerFlee(state: FleeSteerState, pos: Vec2, from: Vec2, radius: number, nav: FleeNav, now: number, steer: FleeSteerTable = FLEE_STEER): boolean {
  if (now < state.steerUntil) return false;
  const choice = fleeDirection(pos, from, radius, nav, steer);
  state.dirX = choice.x;
  state.dirY = choice.y;
  state.steerUntil = now + steer.holdMs;
  return true;
}
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

/** Damage a wild pal deals per bite: its kind's attack at level 1, WILD_DAMAGE_PER_LEVEL more per level above. */
export function wildDamage(species: PalSpecies, level: number): number {
  return Math.round(species.attack * (1 + WILD_DAMAGE_PER_LEVEL * (level - 1)));
}

/** A captured pal's health when out in the world. */
export function companionMaxHp(species: PalSpecies, level: number): number {
  return scaledMaxHp(species.maxHp, level);
}
