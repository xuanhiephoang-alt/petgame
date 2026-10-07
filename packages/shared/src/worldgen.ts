import { PIXELS_PER_UNIT, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import { CollisionGrid, type Circle } from "./collision.ts";
import { fbm, mulberry32 } from "./noise.ts";
import type { Vec2 } from "./movement.ts";
import type { Biome } from "./pals.ts";

/**
 * Deterministic world layout. The server builds colliders from it and the
 * client draws the same props, so trees stand where they block.
 * All positions are in server pixels.
 */

export type PropKind = "tree" | "bush" | "rock" | "grass";

export interface Prop {
  kind: PropKind;
  /** Model name inside nature.glb (see assets/kaykit/manifest.ts). */
  model: string;
  x: number;
  y: number;
  scale: number;
  yaw: number;
}

export interface WorldLayout {
  props: Prop[];
  colliders: Circle[];
  campfire: Vec2;
  /** The lake is a union of these circles (water blocks movement). */
  lake: Circle[];
  /** Center and radius of the rocky hills area. */
  rocky: Circle;
}

export const WORLD_SEED = 1234;

const U = PIXELS_PER_UNIT;
/** Players spawn in the middle; keep it open. */
export const CLEARING_RADIUS = 6 * U;
/** Width of the dense forest band drawn outside the playable area. */
export const BORDER = 8 * U;
export const CAMPFIRE_RADIUS = 0.85 * U;

/** Blocking radius of each model at scale 1, in pixels. Missing = walk-through. */
const TREES: Record<string, number> = {
  Tree_1_A: 0.35, Tree_1_B: 0.35, Tree_2_A: 0.3, Tree_2_C: 0.4, Tree_3_A: 0.35,
  Tree_4_A: 0.3, Tree_4_B: 0.35, Tree_5_A: 0.3, Tree_6_A: 0.3, Tree_7_A: 0.35,
};
const ROCKS: Record<string, number> = { Rock_1_A: 0.26, Rock_1_E: 0.45, Rock_2_A: 0, Rock_3_A: 0.4, Rock_3_E: 0.5, Rock_5_A: 0 };
/** Pal spawns count as "lake" this close (pixels) to the water. */
export const SHORE_WIDTH = 3 * U;

/** Which biome a point belongs to, for spawning and ground colors. */
export function biomeAt(layout: Pick<WorldLayout, "lake" | "rocky">, x: number, y: number): Biome {
  if (layout.lake.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + SHORE_WIDTH)) return "lake";
  if (Math.hypot(x - layout.rocky.x, y - layout.rocky.y) < layout.rocky.r) return "rocky";
  return "meadow";
}

const BUSHES = ["Bush_1_A", "Bush_1_C", "Bush_2_A", "Bush_2_C", "Bush_4_A"];
const GRASS = ["Grass_1_A", "Grass_1_C", "Grass_2_A", "Grass_2_C"];

export function generateWorld(seed = WORLD_SEED): WorldLayout {
  const W = WORLD_WIDTH, H = WORLD_HEIGHT;
  const rand = mulberry32(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const center = { x: W / 2, y: H / 2 };
  const campfire = { x: W / 2, y: H / 2 - 2.4 * U };
  const props: Prop[] = [];
  const place = (kind: PropKind, model: string, x: number, y: number, scale: number) =>
    props.push({ kind, model, x, y, scale, yaw: rand() * Math.PI * 2 });
  const dist = (a: Vec2, x: number, y: number) => Math.hypot(a.x - x, a.y - y);
  const inClearing = (x: number, y: number, margin = 0) => dist(center, x, y) < CLEARING_RADIUS + margin;
  const inside = (x: number, y: number) => x > 0 && x < W && y > 0 && y < H;
  const treeNames = Object.keys(TREES);
  const rockNames = Object.keys(ROCKS);

  // A blobby lake in the north-east and rocky hills in the south-west.
  const lakeCenter = { x: W * 0.78, y: H * 0.3 };
  const lake: Circle[] = [{ ...lakeCenter, r: 3.6 * U }];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.8;
    const d = (1.6 + rand() * 1.4) * U;
    lake.push({ x: lakeCenter.x + Math.cos(a) * d, y: lakeCenter.y + Math.sin(a) * d * 0.8, r: (1.8 + rand() * 1.2) * U });
  }
  const rocky: Circle = { x: W * 0.2, y: H * 0.74, r: 7.5 * U };
  const inWater = (x: number, y: number, margin = 0) => lake.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + margin);
  const inRocky = (x: number, y: number) => Math.hypot(x - rocky.x, y - rocky.y) < rocky.r;
  const placeLand = (kind: PropKind, model: string, x: number, y: number, scale: number, margin = 0.6 * U) => {
    if (!inWater(x, y, margin)) place(kind, model, x, y, scale);
  };

  // Dense forest band around the world edge.
  for (let x = -BORDER; x <= W + BORDER; x += 2.1 * U) {
    for (let y = -BORDER; y <= H + BORDER; y += 2.1 * U) {
      if (inside(x, y)) continue;
      const jx = x + (rand() - 0.5) * 1.6 * U, jy = y + (rand() - 0.5) * 1.6 * U;
      // The camera looks north from the south, so tall trees just past the
      // south edge would hide the player: use bushes there instead.
      if (y > H && y < H + 5 * U) {
        place("bush", pick(BUSHES), jx, jy, 1 + rand() * 0.6);
        continue;
      }
      place("tree", pick(treeNames), jx, jy, 0.9 + rand() * 0.6);
      if (rand() < 0.4) place("bush", pick(BUSHES), jx + U, jy + 0.5 * U, 0.8 + rand() * 0.5);
    }
  }
  // Bushes softening the inner edge of the forest.
  for (let i = 0; i < 70; i++) {
    const edge = Math.floor(rand() * 4), t = rand(), d = rand() * 1.5 * U;
    const [x, y] = edge === 0 ? [t * W, d] : edge === 1 ? [t * W, H - d] : edge === 2 ? [d, t * H] : [W - d, t * H];
    place("bush", pick(BUSHES), x, y, 0.8 + rand() * 0.6);
  }
  // Forest clumps inside the world.
  for (let i = 0; i < 11; i++) {
    const cx = 4 * U + rand() * (W - 8 * U), cy = 4 * U + rand() * (H - 8 * U);
    if (inClearing(cx, cy, 4 * U) || inRocky(cx, cy)) continue;
    const trees = 3 + Math.floor(rand() * 6);
    for (let t = 0; t < trees; t++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 3.2 * U;
      placeLand("tree", pick(treeNames), cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.8 + rand() * 0.5, 1.2 * U);
    }
    for (let b = 0; b < 4 + rand() * 4; b++) {
      const a = rand() * Math.PI * 2, r = (3 + rand() * 1.5) * U;
      placeLand("bush", pick(BUSHES), cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.7 + rand() * 0.5);
    }
  }
  // Rock clusters.
  for (let i = 0; i < 16; i++) {
    const cx = 2 * U + rand() * (W - 4 * U), cy = 2 * U + rand() * (H - 4 * U);
    if (inClearing(cx, cy, U)) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let r = 0; r < n; r++) placeLand("rock", pick(rockNames), cx + (rand() - 0.5) * 1.6 * U, cy + (rand() - 0.5) * 1.6 * U, 0.6 + rand() * 0.8);
  }
  // Rocky hills: many boulders, a few hardy trees.
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * rocky.r;
    const x = rocky.x + Math.cos(a) * r, y = rocky.y + Math.sin(a) * r;
    if (x < U || x > W - U || y < U || y > H - U) continue;
    placeLand("rock", pick(["Rock_1_E", "Rock_3_A", "Rock_3_E", "Rock_1_A"]), x, y, 0.9 + rand() * 1.1);
  }
  // Reeds and bushes along the lake shore.
  for (let i = 0; i < 40; i++) {
    const c = pick(lake);
    const a = rand() * Math.PI * 2, d = c.r + (0.3 + rand() * 0.8) * U;
    placeLand(rand() < 0.7 ? "grass" : "bush", rand() < 0.7 ? pick(GRASS) : pick(BUSHES), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0.5 + rand() * 0.4, 0.2 * U);
  }
  // Loose bushes.
  for (let i = 0; i < 30; i++) {
    const x = rand() * W, y = rand() * H;
    if (!inClearing(x, y)) placeLand("bush", pick(BUSHES), x, y, 0.6 + rand() * 0.5);
  }
  // Grass grows in patches: sample candidates and keep those where noise is high.
  for (let i = 0; i < 5000; i++) {
    const x = -2 * U + rand() * (W + 4 * U), y = -2 * U + rand() * (H + 4 * U);
    const ux = x / U, uy = y / U;
    const keep = inClearing(x, y) ? rand() < 0.2 : fbm(ux * 0.12 + 7, uy * 0.12 + 7) > 0.5 && rand() < 0.55;
    if (!keep || dist(campfire, x, y) < 1.6 * U || (inRocky(x, y) && rand() < 0.7)) continue;
    placeLand("grass", pick(GRASS), x, y, 0.3 + rand() * 0.3);
  }

  const colliders: Circle[] = [{ x: campfire.x, y: campfire.y, r: CAMPFIRE_RADIUS }, ...lake];
  for (const p of props) {
    const base = p.kind === "tree" ? TREES[p.model] : p.kind === "rock" ? ROCKS[p.model] : 0;
    if (base > 0) colliders.push({ x: p.x, y: p.y, r: base * p.scale * U });
  }
  return { props, colliders, campfire, lake, rocky };
}

let cached: { layout: WorldLayout; grid: CollisionGrid } | undefined;

/** The shared world for WORLD_SEED, built once per process. */
export function defaultWorld(): { layout: WorldLayout; grid: CollisionGrid } {
  if (!cached) {
    const layout = generateWorld(WORLD_SEED);
    cached = { layout, grid: new CollisionGrid(layout.colliders) };
  }
  return cached;
}
