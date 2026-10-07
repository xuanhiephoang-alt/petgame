import { PLAYER_RADIUS, PLAYER_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { CollisionGrid } from "./collision.ts";
import { isSea, type Terrain } from "./terrain.ts";

/** Speed on a raft compared to walking. */
export const SAIL_SPEED_FACTOR = 0.9;

export interface Vec2 {
  x: number;
  y: number;
}

/** Clamps a direction to length <= 1 so diagonals are not faster. */
export function normalizeInput(input: Vec2): Vec2 {
  const x = Number.isFinite(input.x) ? input.x : 0;
  const y = Number.isFinite(input.y) ? input.y : 0;
  const len = Math.hypot(x, y);
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

/**
 * Moves a player by one step, sliding around obstacles. Shared by the server
 * (authoritative) and the client (prediction) so both compute identical positions.
 */
export function stepPlayer(
  pos: Vec2,
  input: Vec2,
  dtMs: number,
  obstacles?: CollisionGrid,
  sea?: { terrain: Terrain; canSail: boolean },
): Vec2 {
  const dir = normalizeInput(input);
  const sailing = !!sea && isSea(sea.terrain, pos.x, pos.y);
  const dist = ((sailing ? PLAYER_SPEED * SAIL_SPEED_FACTOR : PLAYER_SPEED) * dtMs) / 1000;
  const move = (dx: number, dy: number) => {
    const next = clampToWorld({ x: pos.x + dx, y: pos.y + dy });
    return obstacles ? clampToWorld(obstacles.resolve(next, PLAYER_RADIUS)) : next;
  };
  const next = move(dir.x * dist, dir.y * dist);
  if (!sea || sea.canSail || !isSea(sea.terrain, next.x, next.y)) return next;
  // Without a raft the shore stops you: slide along it on one axis if possible.
  for (const [dx, dy] of [[dir.x * dist, 0], [0, dir.y * dist]]) {
    if (dx === 0 && dy === 0) continue;
    const slide = move(dx, dy);
    if (!isSea(sea.terrain, slide.x, slide.y)) return slide;
  }
  return { x: pos.x, y: pos.y };
}

function clampToWorld(p: Vec2): Vec2 {
  return {
    x: clamp(p.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
    y: clamp(p.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
