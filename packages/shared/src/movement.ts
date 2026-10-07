import { PLAYER_RADIUS, PLAYER_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { CollisionGrid } from "./collision.ts";

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
export function stepPlayer(pos: Vec2, input: Vec2, dtMs: number, obstacles?: CollisionGrid): Vec2 {
  const dir = normalizeInput(input);
  const dist = (PLAYER_SPEED * dtMs) / 1000;
  let next = clampToWorld({ x: pos.x + dir.x * dist, y: pos.y + dir.y * dist });
  if (obstacles) next = clampToWorld(obstacles.resolve(next, PLAYER_RADIUS));
  return next;
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
