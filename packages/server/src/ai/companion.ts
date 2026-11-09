import {
  COMPANION_ATTACK_RANGE,
  COMPANION_FOLLOW_DISTANCE,
  COMPANION_SPEED,
  COMPANION_TELEPORT_DISTANCE,
  distance,
  type CollisionGrid,
  type Vec2,
} from "@petgame/shared";

export interface CompanionStep {
  pos: Vec2;
  /** True when the companion is close enough to hit its target. */
  inAttackRange: boolean;
}

/**
 * Moves toward `goal` (at companion speed unless given), stopping `stopAt` pixels short and
 * sliding around obstacles.
 */
export function stepToward(
  pos: Vec2,
  goal: Vec2,
  stopAt: number,
  dtMs: number,
  radius: number,
  obstacles?: CollisionGrid,
  speed = COMPANION_SPEED,
): Vec2 {
  const d = distance(pos, goal);
  if (d <= stopAt) return pos;
  const step = Math.min((speed * dtMs) / 1000, d - stopAt);
  const next = { x: pos.x + ((goal.x - pos.x) / d) * step, y: pos.y + ((goal.y - pos.y) / d) * step };
  return obstacles ? obstacles.resolve(next, radius) : next;
}

/** How close counts as "there" for a companion: within hitting range of the wild pal it fights, or trailing distance of its owner. */
export function companionReach(radius: number, attacking: boolean): number {
  return attacking ? COMPANION_ATTACK_RANGE + radius : COMPANION_FOLLOW_DISTANCE;
}

/**
 * One tick of a following pal: chase and stand next to `target` if there is
 * one (the wild pal its owner is fighting), otherwise trail the owner.
 * Jumps back to the owner when left far behind (e.g. stuck behind trees).
 * `via` (a waypoint around trees, ai/pathing.ts) is walked to at full speed instead of the goal;
 * the attack range is still measured to the target.
 */
export function stepCompanion(
  pos: Vec2,
  owner: Vec2,
  target: Vec2 | undefined,
  dtMs: number,
  radius: number,
  obstacles?: CollisionGrid,
  via?: Vec2,
): CompanionStep {
  if (distance(pos, owner) > COMPANION_TELEPORT_DISTANCE) {
    const back = { x: owner.x - 24, y: owner.y + 24 };
    return { pos: obstacles ? obstacles.resolve(back, radius) : back, inAttackRange: false };
  }
  const goal = target ?? owner;
  const stopAt = target ? COMPANION_ATTACK_RANGE * 0.8 + radius : COMPANION_FOLLOW_DISTANCE;
  const detour = via !== undefined && (via.x !== goal.x || via.y !== goal.y);
  const next = detour
    ? stepToward(pos, via, 0, dtMs, radius, obstacles)
    : stepToward(pos, goal, stopAt, dtMs, radius, obstacles);
  const inAttackRange = !!target && distance(next, target) <= companionReach(radius, true);
  return { pos: next, inAttackRange };
}
