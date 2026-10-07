import { PIXELS_PER_UNIT, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import { CollisionGrid, type Circle } from "./collision.ts";
import { fbm, mulberry32 } from "./noise.ts";
import type { Vec2 } from "./movement.ts";
import type { Biome } from "./pals.ts";
import { buildTerrain, terrainAt, type Region, type Terrain, type TerrainKind } from "./terrain.ts";

/**
 * Deterministic world layout. The server builds colliders from it and the
 * client draws the same props, so trees stand where they block.
 * All positions are in server pixels.
 */

export type PropKind = "tree" | "bush" | "rock" | "grass";

export interface Prop {
  kind: PropKind;
  /** Model name inside nature.glb (see assets/kaykit/manifest.ts), or "Palm" / "Cactus" (built by the client). */
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
  /** Every pond and lake as a union of circles (water blocks movement). */
  lake: Circle[];
  /** Sea, the five regions and the islands, per terrain cell. */
  terrain: Terrain;
  /** A point well inside each region (for the boss, labels, quests). */
  regions: Record<Region, Vec2>;
  /** The volcano cone in the east (blocks movement). */
  volcano: Circle;
  /** The islands out at sea (centers and rough radius). */
  islands: Circle[];
  /** Treasure chest spots, on open ground the player can reach. */
  chests: Vec2[];
  /** Fruit bushes in the meadow that players can pick berries from. */
  fruits: Vec2[];
}

export const WORLD_SEED = 1234;

const U = PIXELS_PER_UNIT;
/** Players spawn in the middle; keep it open. */
export const CLEARING_RADIUS = 6 * U;
/** How far the ground and sea are drawn past the world edge. */
export const BORDER = 12 * U;
export const CAMPFIRE_RADIUS = 0.85 * U;
/** How many treasure chests the world has. */
export const CHEST_COUNT = 40;
export const FRUIT_COUNT = 30;
/** Half-axes of the main continent, as fractions of the world size. */
const CONTINENT = { a: 0.38, b: 0.38 };

/** Blocking radius of each model at scale 1, in units. Missing = walk-through. */
const TREES: Record<string, number> = {
  Tree_1_A: 0.35, Tree_1_B: 0.35, Tree_2_A: 0.3, Tree_2_C: 0.4, Tree_3_A: 0.35,
  Tree_4_A: 0.3, Tree_4_B: 0.35, Tree_5_A: 0.3, Tree_6_A: 0.3, Tree_7_A: 0.35,
  Palm: 0.25, Cactus: 0.3,
};
const ROCKS: Record<string, number> = { Rock_1_A: 0.26, Rock_1_E: 0.45, Rock_2_A: 0, Rock_3_A: 0.4, Rock_3_E: 0.5, Rock_5_A: 0 };
/** Pal spawns count as "lake" this close (pixels) to meadow water. */
export const SHORE_WIDTH = 3 * U;

/** Which biome a point belongs to, for spawning, quests and ground colors. */
export function biomeAt(layout: Pick<WorldLayout, "lake" | "terrain">, x: number, y: number): Biome {
  const kind = terrainAt(layout.terrain, x, y);
  if (kind === "meadow" && layout.lake.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + SHORE_WIDTH)) return "lake";
  return kind;
}

/** 0 at the spawn clearing, 1 at the far corners: remote pals are stronger and chests richer. */
export function dangerAt(x: number, y: number): number {
  const d = Math.hypot(x - WORLD_WIDTH / 2, y - WORLD_HEIGHT / 2) - CLEARING_RADIUS;
  return Math.min(1, Math.max(0, d / (Math.hypot(WORLD_WIDTH, WORLD_HEIGHT) / 2 - CLEARING_RADIUS)));
}

const BUSHES = ["Bush_1_A", "Bush_1_C", "Bush_2_A", "Bush_2_C", "Bush_4_A"];
const GRASS = ["Grass_1_A", "Grass_1_C", "Grass_2_A", "Grass_2_C"];
/** Slim, pine-like trees for the snow. */
const PINES = ["Tree_4_A", "Tree_4_B", "Tree_5_A", "Tree_6_A"];
/** Broad, heavy trees for the swamp. */
const SWAMP_TREES = ["Tree_1_A", "Tree_1_B", "Tree_2_C", "Tree_3_A", "Tree_7_A"];
const BOULDERS = ["Rock_1_E", "Rock_3_A", "Rock_3_E", "Rock_1_A"];

/**
 * The world: a continent in the middle of the sea with a temperate meadow at
 * its heart and four climates around it (snow north, desert south, swamp
 * west, volcano east), plus islands in the corners that need a raft.
 */
export function generateWorld(seed = WORLD_SEED): WorldLayout {
  const W = WORLD_WIDTH, H = WORLD_HEIGHT;
  const rand = mulberry32(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const center = { x: W / 2, y: H / 2 };
  const campfire = { x: W / 2, y: H / 2 - 2.4 * U };
  const A = W * CONTINENT.a, B = H * CONTINENT.b;
  const dist = (a: Vec2, x: number, y: number) => Math.hypot(a.x - x, a.y - y);

  // Islands sit in the four corners, plus two islets.
  const islands: Circle[] = [
    { x: W * 0.09, y: H * 0.11, r: 13 * U },
    { x: W * 0.91, y: H * 0.1, r: 11 * U },
    { x: W * 0.1, y: H * 0.9, r: 11 * U },
    { x: W * 0.9, y: H * 0.89, r: 14 * U },
    { x: W * 0.5, y: H * 0.035, r: 3.5 * U },
    { x: W * 0.035, y: H * 0.5, r: 3.5 * U },
  ].map((c) => ({ x: c.x + (rand() - 0.5) * 4 * U, y: c.y + (rand() - 0.5) * 4 * U, r: c.r }));

  const terrain = buildTerrain((x, y) => {
    const ux = x / U, uy = y / U;
    const dx = (x - center.x) / A, dy = (y - center.y) / B;
    const e = Math.hypot(dx, dy);
    const coast = 1 + (fbm(ux * 0.035 + 11, uy * 0.035 + 11) - 0.5) * 0.45;
    if (e < coast) {
      const core = 0.42 + (fbm(ux * 0.05 + 40, uy * 0.05 + 40) - 0.5) * 0.25;
      if (e < core) return "meadow";
      // Four sectors around the meadow, with wavy borders.
      const angle = Math.atan2(dy, dx) + (fbm(ux * 0.03 + 70, uy * 0.03 + 70) - 0.5) * 0.9;
      const sector = Math.round(angle / (Math.PI / 2));
      return sector === 0 ? "volcano" : sector === 1 ? "desert" : sector === -1 ? "snow" : "swamp";
    }
    for (const c of islands) {
      if (Math.hypot(x - c.x, y - c.y) < c.r * (0.75 + 0.45 * fbm(ux * 0.12 + c.x, uy * 0.12))) return "island";
    }
    return "sea";
  });
  const kindAt = (x: number, y: number) => terrainAt(terrain, x, y);

  const regions: Record<Region, Vec2> = {
    meadow: center,
    snow: { x: center.x, y: center.y - 0.68 * B },
    desert: { x: center.x, y: center.y + 0.68 * B },
    swamp: { x: center.x - 0.68 * A, y: center.y },
    volcano: { x: center.x + 0.68 * A, y: center.y },
    island: { x: islands[0].x, y: islands[0].y },
  };
  const volcano: Circle = { x: regions.volcano.x, y: regions.volcano.y, r: 3.5 * U };

  // Water: a lake in the meadow, an oasis in the desert, ponds in the swamp.
  const lake: Circle[] = [];
  const addLake = (cx: number, cy: number, core: number, blobs: number) => {
    lake.push({ x: cx, y: cy, r: core });
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + rand() * 0.8;
      const d = core * (0.45 + rand() * 0.4);
      lake.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, r: core * (0.5 + rand() * 0.35) });
    }
  };
  addLake(center.x + 0.22 * A, center.y - 0.17 * B, 4.5 * U, 7);
  const oasis = { x: regions.desert.x + 0.16 * A, y: regions.desert.y - 0.04 * B };
  addLake(oasis.x, oasis.y, 2.2 * U, 3);
  for (let i = 0, tries = 0; i < 14 && tries < 400; tries++) {
    const x = regions.swamp.x + (rand() - 0.5) * 0.5 * A, y = regions.swamp.y + (rand() - 0.5) * 0.9 * B;
    if (kindAt(x, y) !== "swamp" || lake.some((c) => dist(c, x, y) < c.r + 5 * U)) continue;
    addLake(x, y, (1.1 + rand() * 1.3) * U, 2);
    i++;
  }

  const inWater = (x: number, y: number, margin = 0) => lake.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + margin);
  const inClearing = (x: number, y: number, margin = 0) => dist(center, x, y) < CLEARING_RADIUS + margin;
  const nearVolcano = (x: number, y: number) => dist(volcano, x, y) < volcano.r + 2 * U;
  const props: Prop[] = [];
  /** Places a prop on dry land of one of the given kinds (any land if none given). */
  const place = (kind: PropKind, model: string, x: number, y: number, scale: number, on?: TerrainKind[], margin = 0.6 * U) => {
    const ground = kindAt(x, y);
    if (ground === "sea" || (on && !on.includes(ground)) || inWater(x, y, margin) || nearVolcano(x, y)) return false;
    props.push({ kind, model, x, y, scale, yaw: rand() * Math.PI * 2 });
    return true;
  };
  /** A random point inside a terrain kind (undefined if none found). */
  const randomIn = (kind: TerrainKind, tries = 60): Vec2 | undefined => {
    for (let i = 0; i < tries; i++) {
      const x = rand() * W, y = rand() * H;
      if (kindAt(x, y) === kind) return { x, y };
    }
    return undefined;
  };
  const clump = (at: Vec2, trees: readonly string[], count: number, spread: number, on: TerrainKind[], scale = [0.8, 0.5]) => {
    for (let t = 0; t < count; t++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * spread;
      place("tree", pick(trees), at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, scale[0] + rand() * scale[1], on, 1.2 * U);
    }
  };

  // Meadow: forest clumps ringed with bushes, rock piles, fruit bushes.
  const treeNames = Object.keys(TREES).filter((n) => n.startsWith("Tree"));
  for (let i = 0; i < 70; i++) {
    const at = randomIn("meadow");
    if (!at || inClearing(at.x, at.y, 5 * U)) continue;
    clump(at, treeNames, 3 + Math.floor(rand() * 6), 3.2 * U, ["meadow"]);
    for (let b = 0; b < 4 + rand() * 4; b++) {
      const a = rand() * Math.PI * 2, r = (3 + rand() * 1.5) * U;
      place("bush", pick(BUSHES), at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 0.7 + rand() * 0.5, ["meadow"]);
    }
  }
  for (let i = 0; i < 130; i++) {
    const at = randomIn("meadow");
    if (at && !inClearing(at.x, at.y)) place("bush", pick(BUSHES), at.x, at.y, 0.6 + rand() * 0.5, ["meadow"]);
  }
  for (let i = 0; i < 40; i++) {
    const at = randomIn("meadow");
    if (!at || inClearing(at.x, at.y, U)) continue;
    for (let r = 0; r < 1 + Math.floor(rand() * 3); r++) {
      place("rock", pick(Object.keys(ROCKS)), at.x + (rand() - 0.5) * 1.6 * U, at.y + (rand() - 0.5) * 1.6 * U, 0.6 + rand() * 0.8, ["meadow"]);
    }
  }
  const fruits: Vec2[] = [];
  for (let tries = 0; fruits.length < FRUIT_COUNT && tries < 2000; tries++) {
    const at = randomIn("meadow");
    if (!at || inClearing(at.x, at.y, 3 * U) || inWater(at.x, at.y, 1.5 * U)) continue;
    if (fruits.some((f) => dist(f, at.x, at.y) < 6 * U)) continue;
    if (place("bush", "Bush_1_C", at.x, at.y, 1.25, ["meadow"])) fruits.push(at);
  }

  // Snow: stands of pines and frosted rocks.
  for (let i = 0; i < 45; i++) {
    const at = randomIn("snow");
    if (at) clump(at, PINES, 2 + Math.floor(rand() * 4), 2.2 * U, ["snow"], [0.9, 0.6]);
  }
  for (let i = 0; i < 60; i++) {
    const at = randomIn("snow");
    if (at) place("rock", pick(BOULDERS), at.x, at.y, 0.7 + rand() * 1, ["snow"]);
  }

  // Desert: cacti, sun-bleached rocks, palms around the oasis.
  for (let i = 0; i < 170; i++) {
    const at = randomIn("desert");
    if (at) place("tree", "Cactus", at.x, at.y, 0.8 + rand() * 0.7, ["desert"]);
  }
  for (let i = 0; i < 70; i++) {
    const at = randomIn("desert");
    if (at) place("rock", pick(BOULDERS), at.x, at.y, 0.6 + rand() * 1.1, ["desert"]);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4, d = 3.4 * U + rand() * 1.5 * U;
    place("tree", "Palm", oasis.x + Math.cos(a) * d, oasis.y + Math.sin(a) * d, 0.9 + rand() * 0.4, ["desert"]);
  }

  // Swamp: dense dark woods, reeds around the ponds.
  for (let i = 0; i < 70; i++) {
    const at = randomIn("swamp");
    if (at) clump(at, SWAMP_TREES, 4 + Math.floor(rand() * 5), 3 * U, ["swamp"], [0.9, 0.6]);
  }
  for (let i = 0; i < 220; i++) {
    const c = pick(lake);
    if (kindAt(c.x, c.y) !== "swamp") continue;
    const a = rand() * Math.PI * 2, d = c.r + (0.2 + rand() * 0.8) * U;
    place(rand() < 0.75 ? "grass" : "bush", rand() < 0.75 ? pick(GRASS) : pick(BUSHES), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0.6 + rand() * 0.5, ["swamp"], 0.2 * U);
  }
  for (let i = 0; i < 100; i++) {
    const at = randomIn("swamp");
    if (at) place("bush", pick(BUSHES), at.x, at.y, 0.8 + rand() * 0.6, ["swamp"]);
  }

  // Volcano: fields of dark boulders around the cone.
  for (let i = 0; i < 230; i++) {
    const at = randomIn("volcano");
    if (at) place("rock", pick(BOULDERS), at.x, at.y, 0.8 + rand() * 1.2, ["volcano"]);
  }

  // Islands: palms, bushes and a few rocks.
  for (const c of islands) {
    const n = Math.round((c.r / U) * 1.1);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * c.r;
      place("tree", "Palm", c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0.9 + rand() * 0.5, ["island"]);
      const b = rand() * Math.PI * 2, rb = Math.sqrt(rand()) * c.r;
      place("bush", pick(BUSHES), c.x + Math.cos(b) * rb, c.y + Math.sin(b) * rb, 0.7 + rand() * 0.5, ["island"]);
    }
    for (let i = 0; i < n / 3; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * c.r;
      place("rock", pick(BOULDERS), c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0.6 + rand() * 0.8, ["island"]);
    }
  }

  // Reeds along the meadow lake.
  for (let i = 0; i < 70; i++) {
    const c = lake[Math.floor(rand() * 8)];
    const a = rand() * Math.PI * 2, d = c.r + (0.3 + rand() * 0.8) * U;
    place("grass", pick(GRASS), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0.5 + rand() * 0.4, ["meadow"], 0.2 * U);
  }

  // Grass grows in patches: sample candidates and keep those where noise is high.
  const grassChance: Record<TerrainKind, number> = { meadow: 0.55, swamp: 0.6, island: 0.3, snow: 0.04, desert: 0.015, volcano: 0.03, sea: 0 };
  for (let i = 0; i < 110000; i++) {
    const x = rand() * W, y = rand() * H;
    const kind = kindAt(x, y);
    const chance = grassChance[kind];
    if (chance === 0) continue;
    const patchy = kind === "meadow" || kind === "swamp" ? fbm(x / U * 0.12 + 7, y / U * 0.12 + 7) > 0.5 : true;
    const keep = inClearing(x, y) ? rand() < 0.2 : patchy && rand() < chance;
    if (!keep || dist(campfire, x, y) < 1.6 * U) continue;
    place("grass", pick(GRASS), x, y, 0.3 + rand() * 0.3, undefined, 0.2 * U);
  }

  const colliders: Circle[] = [{ x: campfire.x, y: campfire.y, r: CAMPFIRE_RADIUS }, volcano, ...lake];
  for (const p of props) {
    const base = p.kind === "tree" ? TREES[p.model] : p.kind === "rock" ? ROCKS[p.model] : 0;
    if (base > 0) colliders.push({ x: p.x, y: p.y, r: base * p.scale * U });
  }

  // Treasure chests on open ground: some in every region, most on the islands.
  const grid = new CollisionGrid(colliders);
  const chests: Vec2[] = [];
  const quota: [TerrainKind, number][] = [["meadow", 8], ["snow", 6], ["desert", 6], ["swamp", 6], ["volcano", 6], ["island", 8]];
  for (const [kind, count] of quota) {
    for (let found = 0, tries = 0; found < count && tries < 3000; tries++) {
      const at = randomIn(kind, 1);
      if (!at || at.x < 2 * U || at.x > W - 2 * U || at.y < 2 * U || at.y > H - 2 * U) continue;
      if (inClearing(at.x, at.y, 4 * U) || grid.blocked(at, 1.2 * U) || inWater(at.x, at.y, U)) continue;
      // Away from the sea too, so the chest is not in the surf.
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => kindAt(at.x + dx * 1.5 * U, at.y + dy * 1.5 * U) === "sea")) continue;
      if (chests.some((c) => dist(c, at.x, at.y) < (kind === "island" ? 6 : 12) * U)) continue;
      chests.push(at);
      found++;
    }
  }
  return { props, colliders, campfire, lake, terrain, regions, volcano, islands, chests, fruits };
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
