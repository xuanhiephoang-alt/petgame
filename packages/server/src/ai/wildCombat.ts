import { WILD_ATTACK_RANGE, distance, type CollisionGrid, type Vec2 } from "@petgame/shared";
import { stepToward } from "./companion.ts";

/** Something a wild pal can fight: a player or a companion. */
export interface CombatTarget {
  kind: "player" | "companion";
  /** Session id for players, OwnedPal id for companions. */
  id: string;
  pos: Vec2;
}

/** Server-only fighting state of one wild pal. */
export interface WildAggro {
  target: Pick<CombatTarget, "kind" | "id">;
  until: number;
  lastAttackAt: number;
  /** Winding up a bite or (the boss) a stomp that lands at this time. */
  windupUntil?: number;
  windup?: "bite" | "stomp";
}

/** Nearest target within `sight` pixels, for aggressive pals looking for a fight. */
export function findNearestTarget(from: Vec2, sight: number, targets: readonly CombatTarget[]): CombatTarget | undefined {
  let best: CombatTarget | undefined;
  let bestDist = sight;
  for (const t of targets) {
    const d = distance(from, t.pos);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/** Chases a target and reports whether it is close enough to bite. */
export function stepChase(
  pos: Vec2,
  target: Vec2,
  speed: number,
  dtMs: number,
  radius: number,
  obstacles?: CollisionGrid,
  range = WILD_ATTACK_RANGE,
): { pos: Vec2; inRange: boolean } {
  const next = stepToward(pos, target, range * 0.7, dtMs, radius, obstacles, speed);
  return { pos: next, inRange: distance(next, target) <= range };
}

/** Runs straight away from `from` (a passive pal that got hit), sliding around obstacles. */
export function stepFlee(pos: Vec2, from: Vec2, speed: number, dtMs: number, radius: number, obstacles?: CollisionGrid): Vec2 {
  const dx = pos.x - from.x, dy = pos.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const goal = { x: pos.x + (dx / d) * 200, y: pos.y + (dy / d) * 200 };
  return stepToward(pos, goal, 0, dtMs, radius, obstacles, speed);
}
