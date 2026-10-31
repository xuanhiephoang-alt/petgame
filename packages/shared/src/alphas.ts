import type { Vec2 } from "./movement.ts";
import type { Region } from "./terrain.ts";
import { terrainAt } from "./terrain.ts";
import { biomeAt, defaultWorld, CLEARING_RADIUS, type WorldLayout } from "./worldgen.ts";
import type { CollisionGrid } from "./collision.ts";
import { PIXELS_PER_UNIT } from "./constants.ts";

/**
 * Pack leaders ("thú đầu đàn"): one big, tough pal guards a lair in each
 * region. It knows all three of its skills (level 15 and up) and uses them
 * often, attacks anyone who comes close whatever its kind's temperament,
 * and goes back to its lair (healing) when led too far away. Knock it out
 * or catch it (harder than usual) for a big reward and XP for your pal; it
 * comes back a while later.
 */
export interface AlphaDef {
  region: Region;
  speciesId: string;
  level: number;
  /** Its lair is looked for this far from the region's middle (pixels): the meadow's clear of the spawn, the volcano's of the boss. */
  offset?: Vec2;
}

export const ALPHAS: readonly AlphaDef[] = [
  { region: "meadow", speciesId: "voltmouse", level: 15, offset: { x: -700, y: 480 } },
  { region: "swamp", speciesId: "bogbloom", level: 17 },
  { region: "desert", speciesId: "cactoad", level: 18 },
  { region: "snow", speciesId: "frostfang", level: 19 },
  { region: "volcano", speciesId: "scorchtail", level: 20, offset: { x: 0, y: -460 } },
  { region: "island", speciesId: "coralcrab", level: 22 },
];

export const ALPHA = {
  /** Max HP: the species' HP at its level, times this. */
  hpMultiplier: 3,
  /** Its bites hit this much harder than a pal's of its level. */
  damageMultiplier: 1,
  /** Its skills hit as hard as a pal's of this level at most (fair to a lone player who dodges). */
  skillLevel: 8,
  /** Drawn this much bigger than a normal pal. */
  displayScale: 1.6,
  /** It attacks anyone who comes this close (pixels). */
  sight: 170,
  /** Led farther than this from its lair (pixels), it gives up and goes home. */
  leash: 12 * PIXELS_PER_UNIT,
  /** It strolls this close to its lair (pixels) when nobody is around. */
  roam: 4 * PIXELS_PER_UNIT,
  /** Back home and left alone, it heals this share of its HP per second. */
  healPerSecond: 0.04,
  /** Its skills: the chance to start one each tick while fighting, and the pause after one (ms). */
  skillChance: 0.08,
  skillGapMs: 2200,
  /** It is this much harder to catch than its kind at its level. */
  catchMultiplier: 0.4,
  /** XP for the following pal of whoever knocks it out or catches it. */
  xp: 300,
  /** Knocking it out leaves this on top of its kind's loot. */
  reward: { greatBalls: 2, snacks: 2 },
  /** It comes back this long after it was knocked out or caught (ms). */
  respawnMs: 6 * 60 * 1000,
} as const;

let lairs: Map<Region, Vec2> | undefined;

/**
 * Where each region's pack leader lives: open ground of that region (not in
 * water, not blocked for a body this big), near the region's middle; the
 * meadow's away from the spawn clearing. The same for every server and
 * client (it only depends on the world seed).
 */
export function alphaLairs(world: { layout: WorldLayout; grid: CollisionGrid } = defaultWorld()): Map<Region, Vec2> {
  if (lairs && world === defaultWorld()) return lairs;
  const { layout, grid } = world;
  const found = new Map<Region, Vec2>();
  for (const def of ALPHAS) {
    const middle = layout.regions[def.region];
    const anchor = { x: middle.x + (def.offset?.x ?? 0), y: middle.y + (def.offset?.y ?? 0) };
    found.set(def.region, nearestOpen(layout, grid, anchor, def.region));
  }
  if (world === defaultWorld()) lairs = found;
  return found;
}

/** The open ground of `region` nearest `anchor`, searched in rings outward. */
function nearestOpen(layout: WorldLayout, grid: CollisionGrid, anchor: Vec2, region: Region): Vec2 {
  const ok = (p: Vec2) =>
    terrainAt(layout.terrain, p.x, p.y) === region &&
    biomeAt(layout, p.x, p.y) !== "lake" &&
    !layout.lake.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r + 40) &&
    Math.hypot(p.x - layout.volcano.x, p.y - layout.volcano.y) > layout.volcano.r + 120 &&
    Math.hypot(p.x - layout.regions.meadow.x, p.y - layout.regions.meadow.y) > CLEARING_RADIUS + 200 &&
    !grid.blocked(p, 40);
  if (ok(anchor)) return { x: Math.round(anchor.x), y: Math.round(anchor.y) };
  for (let r = 24; r < 1600; r += 24) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 24));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const p = { x: anchor.x + Math.cos(a) * r, y: anchor.y + Math.sin(a) * r };
      if (ok(p)) return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  return { x: Math.round(anchor.x), y: Math.round(anchor.y) };
}
