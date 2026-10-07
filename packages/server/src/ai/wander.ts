import { WORLD_HEIGHT, WORLD_WIDTH, clamp, type Vec2 } from "@petgame/shared";

/** Per-pal AI memory that is not synced to clients. */
export interface WanderBrain {
  target: Vec2;
  /** Time left (ms) to idle before picking a new target. */
  idleMs: number;
}

const MARGIN = 32;

export function randomPoint(random: () => number = Math.random): Vec2 {
  return {
    x: MARGIN + random() * (WORLD_WIDTH - MARGIN * 2),
    y: MARGIN + random() * (WORLD_HEIGHT - MARGIN * 2),
  };
}

export function newBrain(from: Vec2, random: () => number = Math.random): WanderBrain {
  return { target: nearbyPoint(from, random), idleMs: random() * 2000 };
}

function nearbyPoint(from: Vec2, random: () => number): Vec2 {
  return {
    x: clamp(from.x + (random() - 0.5) * 300, MARGIN, WORLD_WIDTH - MARGIN),
    y: clamp(from.y + (random() - 0.5) * 300, MARGIN, WORLD_HEIGHT - MARGIN),
  };
}

/**
 * Advances a wandering pal: idle for a while, walk to a nearby point, repeat.
 * Mutates `pos` and `brain` in place.
 */
export function stepWander(
  pos: Vec2,
  brain: WanderBrain,
  speed: number,
  dtMs: number,
  random: () => number = Math.random,
): void {
  if (brain.idleMs > 0) {
    brain.idleMs -= dtMs;
    return;
  }
  const dx = brain.target.x - pos.x;
  const dy = brain.target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const step = (speed * dtMs) / 1000;
  if (dist <= step) {
    pos.x = brain.target.x;
    pos.y = brain.target.y;
    brain.target = nearbyPoint(pos, random);
    brain.idleMs = 1000 + random() * 3000;
    return;
  }
  pos.x += (dx / dist) * step;
  pos.y += (dy / dist) * step;
}
