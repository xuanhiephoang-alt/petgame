import { describe, expect, it } from "vitest";
import type { Circle } from "./collision.ts";
import { CollisionGrid } from "./collision.ts";
import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import type { Vec2 } from "./movement.ts";
import { mulberry32 } from "./noise.ts";
import { NAV_CELL, NAV_MAX_CLEARANCE, NavGrid, defaultNav, type NavBody, type PathQuery } from "./pathfind.ts";
import { isSea, type Terrain } from "./terrain.ts";
import { defaultWorld } from "./worldgen.ts";
import { alphaLairs } from "./alphas.ts";

const tree = (x: number, y: number, r = 14): Circle => ({ x, y, r });
const nav = (circles: Circle[], terrain?: Terrain) => new NavGrid({ circles }, terrain);

/** A cup of overlapping trees open to the north: nothing fits inside, so only a detour leaves it. */
function treeCup(c: Vec2): Circle[] {
  const out: Circle[] = [];
  for (let x = c.x - 80; x <= c.x + 80; x += 20) out.push(tree(x, c.y + 40));
  for (let y = c.y + 20; y >= c.y - 60; y -= 20) out.push(tree(c.x - 80, y), tree(c.x + 80, y));
  return out;
}

/** Meadow everywhere except a sea strip over columns 100-109 (x 1600-1760). */
function seaStrip(): Terrain {
  const cols = 400, rows = 300;
  const data = new Uint8Array(cols * rows).fill(1);
  for (let r = 0; r < rows; r++) for (let c = 100; c < 110; c++) data[r * cols + c] = 0;
  return { cols, rows, data };
}

function pathLength(from: Vec2, path: Vec2[]): number {
  let total = 0, a = from;
  for (const p of path) {
    total += Math.hypot(p.x - a.x, p.y - a.y);
    a = p;
  }
  return total;
}

const body15: NavBody = { radius: 15, sea: false };
const query = (over: Partial<PathQuery> = {}): PathQuery => ({ radius: 15, sea: false, goalRadius: 40, maxNodes: 1500, ...over });

describe("NavGrid", () => {
  it("measures how far each cell's center is from the nearest obstacle's edge", () => {
    const grid = nav([tree(1000, 1000, 20)]);
    expect(grid.clearanceAt(1000, 1000)).toBe(0);
    expect(grid.clearanceAt(1048, 1000)).toBe(28);
    expect(grid.clearanceAt(2000, 2000)).toBe(NAV_MAX_CLEARANCE);
    expect(grid.clearanceAt(1040, 1000)).toBe(20);
  });

  it("opens a cell for a body exactly when the collision grid has room for it there", () => {
    const world = defaultWorld();
    const navGrid = defaultNav();
    const meadow = alphaLairs().get("meadow")!;
    for (const center of [meadow, world.layout.volcano]) {
      for (let j = -24; j < 24; j++) {
        for (let i = -24; i < 24; i++) {
          const x = (Math.floor(center.x / NAV_CELL) + i + 0.5) * NAV_CELL;
          const y = (Math.floor(center.y / NAV_CELL) + j + 0.5) * NAV_CELL;
          for (const radius of [12, 15, 17, 20, 40]) {
            expect(navGrid.cellOpen(x, y, { radius, sea: true })).toBe(!world.grid.blocked({ x, y }, radius));
          }
        }
      }
    }
  });

  it("marks the sea from the terrain", () => {
    const world = defaultWorld();
    const navGrid = defaultNav();
    expect(navGrid.cellOpen(8, 8, { radius: 12, sea: false })).toBe(false);
    expect(navGrid.cellOpen(8, 8, { radius: 12, sea: true })).toBe(true);
    expect(navGrid.cellOpen(world.layout.campfire.x, world.layout.campfire.y, { radius: 1, sea: true })).toBe(false);
    const lairs = alphaLairs();
    expect(lairs.size).toBe(6);
    for (const lair of lairs.values()) expect(navGrid.cellOpen(lair.x, lair.y, { radius: 17, sea: false })).toBe(true);
    expect(isSea(world.layout.terrain, 8, 8)).toBe(true);
  });

  it("checks a straight way for a body's width", () => {
    expect(nav([]).lineClear({ x: 1000, y: 1000 }, { x: 1300, y: 1000 }, body15)).toBe(true);
    expect(nav([tree(1150, 1000)]).lineClear({ x: 1000, y: 1000 }, { x: 1300, y: 1000 }, body15)).toBe(false);

    const row: Circle[] = [];
    for (let x = 700; x <= 960; x += 20) row.push(tree(x, 1000));
    for (let x = 1039; x <= 1299; x += 20) row.push(tree(x, 1000));
    const gap = nav(row);
    expect(gap.lineClear({ x: 1000, y: 900 }, { x: 1000, y: 1100 }, body15)).toBe(true);
    expect(gap.lineClear({ x: 1000, y: 900 }, { x: 1000, y: 1100 }, { radius: 40, sea: false })).toBe(false);

    const lone = nav([tree(1200, 1000)]);
    expect(lone.lineClear({ x: 1000, y: 1000 }, { x: 1200, y: 1000 }, body15)).toBe(false);
    expect(lone.lineClear({ x: 1000, y: 1000 }, { x: 1200, y: 1000 }, body15, 40)).toBe(true);

    expect(nav([]).lineClear({ x: 100, y: 100 }, { x: -200, y: 100 }, body15)).toBe(false);

    const strip = nav([], seaStrip());
    expect(strip.lineClear({ x: 1500, y: 1000 }, { x: 1900, y: 1000 }, body15)).toBe(false);
    expect(strip.lineClear({ x: 1500, y: 1000 }, { x: 1900, y: 1000 }, { radius: 15, sea: true })).toBe(true);
  });

  it("finds a way out of a cup of trees and around it", () => {
    const c = { x: 1000, y: 1000 };
    const grid = nav(treeCup(c));
    const goal = { x: c.x, y: c.y + 120 };
    expect(grid.lineClear(c, goal, body15)).toBe(false);
    const result = grid.findPath(c, goal, query());
    expect(result.status).toBe("found");
    expect(result.expanded).toBeLessThanOrEqual(400);
    const length = pathLength(c, result.path);
    expect(length).toBeGreaterThan(240);
    expect(length).toBeLessThan(520);
    let prev = c;
    for (const p of result.path) {
      expect(grid.cellOpen(p.x, p.y, body15)).toBe(true);
      expect(grid.lineClear(prev, p, body15)).toBe(true);
      prev = p;
    }
    expect(Math.hypot(prev.x - goal.x, prev.y - goal.y)).toBeLessThanOrEqual(40);
  });

  it("says when there is no way, and stops at its limit", () => {
    const ring: Circle[] = [];
    for (let i = 0; i < 19; i++) ring.push(tree(1000 + 60 * Math.cos((i / 19) * 2 * Math.PI), 1000 + 60 * Math.sin((i / 19) * 2 * Math.PI)));
    const grid = nav(ring);
    const inside = grid.findPath({ x: 1000, y: 1000 }, { x: 1300, y: 1000 }, query());
    expect(inside.status).toBe("none");
    expect(inside.path).toEqual([]);
    expect(inside.expanded).toBeLessThan(50);
    const limited = grid.findPath({ x: 1300, y: 1000 }, { x: 1000, y: 1000 }, query({ maxNodes: 300 }));
    expect(limited.status).toBe("limit");
    expect(limited.expanded).toBe(300);
  });

  it("starts from a tight spot", () => {
    const grid = nav([tree(1000, 1000)]);
    expect(grid.cellOpen(1016, 1016, body15)).toBe(false);
    const result = grid.findPath({ x: 1021, y: 1021 }, { x: 800, y: 800 }, query());
    expect(result.status).toBe("found");
  });

  it("keeps wild pals off the sea and lets companions cross it", () => {
    const grid = nav([], seaStrip());
    const from = { x: 1500, y: 1000 }, to = { x: 1900, y: 1000 };
    expect(grid.findPath(from, to, query({ maxNodes: 500 })).status).not.toBe("found");
    const swim = grid.findPath(from, to, query({ maxNodes: 500, sea: true }));
    expect(swim.status).toBe("found");
    expect(swim.expanded).toBeLessThan(100);
  });

  it("takes a narrow gap only when the body fits", () => {
    const row: Circle[] = [];
    for (let x = 700; x <= 960; x += 20) row.push(tree(x, 1000));
    for (let x = 1039; x <= 1299; x += 20) row.push(tree(x, 1000));
    const grid = nav(row);
    const from = { x: 1000, y: 900 }, to = { x: 1000, y: 1100 };
    const small = grid.findPath(from, to, query({ goalRadius: 20, maxNodes: 3000 }));
    expect(small.status).toBe("found");
    expect(pathLength(from, small.path)).toBeLessThan(250);
    const big = grid.findPath(from, to, query({ radius: 40, goalRadius: 20, maxNodes: 3000 }));
    expect(big.status).toBe("found");
    expect(pathLength(from, big.path)).toBeGreaterThan(600);
  });

  it("gives the same path for the same question", () => {
    const c = { x: 1000, y: 1000 };
    const grid = nav(treeCup(c));
    const goal = { x: c.x, y: c.y + 120 };
    const a = grid.findPath(c, goal, query());
    const b = grid.findPath(c, goal, query());
    expect(b).toEqual(a);
  });

  it("finds nothing for a body wider than it keeps clearance for", () => {
    const result = nav([]).findPath({ x: 1000, y: 1000 }, { x: 1300, y: 1000 }, query({ radius: 65 }));
    expect(result.status).toBe("none");
    expect(result.expanded).toBe(0);
  });

  it("survives its search counter nearing the Uint32 limit", () => {
    const ring: Circle[] = [];
    for (let i = 0; i < 19; i++) ring.push(tree(1000 + 60 * Math.cos((i / 19) * 2 * Math.PI), 1000 + 60 * Math.sin((i / 19) * 2 * Math.PI)));
    const grid = nav(ring);
    const c = { x: 1000, y: 1000 };
    const cup = nav(treeCup(c));
    const goal = { x: c.x, y: c.y + 120 };
    const fresh = cup.findPath(c, goal, query());
    for (const g of [grid, cup]) (g as unknown as { stamp: number }).stamp = 2 ** 32 - 3;
    for (let n = 0; n < 3; n++) {
      const r = grid.findPath({ x: 1000, y: 1000 }, { x: 1300, y: 1000 }, query());
      expect(r.status).toBe("none");
      expect(r.expanded).toBeLessThan(50);
    }
    (cup as unknown as { stamp: number }).stamp = 2 ** 32 - 2;
    expect(cup.findPath(c, goal, query())).toEqual(fresh);
    expect(cup.findPath(c, goal, query())).toEqual(fresh);
  });

  it("does not reuse stale marks when the search counter wraps", () => {
    const c = { x: 1000, y: 1000 };
    const cup = nav(treeCup(c));
    const goal = { x: c.x, y: c.y + 120 };
    // The first search leaves marks with id 1; the wrap hands out id 1 again, so they must have been wiped.
    const fresh = cup.findPath(c, goal, query());
    (cup as unknown as { stamp: number }).stamp = 2 ** 32 - 1;
    expect(cup.findPath(c, goal, query())).toEqual(fresh);
    expect((cup as unknown as { stamp: number }).stamp).toBe(1);
    expect(cup.findPath(c, goal, query())).toEqual(fresh);
  });

  it("does not clip the corner of a sea cell", () => {
    // A single sea cell (column 100, row 100: x 1600-1616, y 1600-1616); the line only grazes its corner.
    const terrain = seaStrip();
    terrain.data.fill(1);
    terrain.data[100 * 400 + 100] = 0;
    const grid = nav([], terrain);
    expect(grid.lineClear({ x: 1584, y: 1585 }, { x: 1678, y: 1636 }, body15)).toBe(false);
    expect(grid.lineClear({ x: 1584, y: 1585 }, { x: 1678, y: 1636 }, { radius: 15, sea: true })).toBe(true);
  });

  it("lets a body leave a spot that is tighter than the body's own cell clearance", () => {
    const grid = nav([tree(1000, 1000), tree(1058, 1000)]);
    expect(grid.clearanceAt(1029, 990)).toBeLessThan(15);
    expect(grid.lineClear({ x: 1029, y: 990 }, { x: 1029, y: 870 }, body15)).toBe(true);
    expect(grid.lineClear({ x: 1029, y: 990 }, { x: 1000, y: 1000 }, body15)).toBe(false);
  });

  it("builds the default grid once", () => {
    expect(defaultNav()).toBe(defaultNav());
  });

  it("keeps searches on the real world cheap (benchmark)", () => {
    const world = defaultWorld();
    const navGrid = defaultNav();
    const rand = mulberry32(9);
    const grid: CollisionGrid = world.grid;
    const pairs: { from: Vec2; to: Vec2 }[] = [];
    while (pairs.length < 200) {
      const from = { x: 32 + rand() * (WORLD_WIDTH - 64), y: 32 + rand() * (WORLD_HEIGHT - 64) };
      if (isSea(world.layout.terrain, from.x, from.y) || grid.blocked(from, 20)) continue;
      const angle = rand() * 2 * Math.PI, dist = 60 + rand() * 260;
      const to = { x: from.x + Math.cos(angle) * dist, y: from.y + Math.sin(angle) * dist };
      if (isSea(world.layout.terrain, to.x, to.y) || grid.blocked(to, PLAYER_RADIUS) || navGrid.lineClear(from, to, body15)) continue;
      pairs.push({ from, to });
    }
    const started = performance.now();
    const results = pairs.map((p) => navGrid.findPath(p.from, p.to, query()));
    const elapsed = performance.now() - started;
    const expanded = results.map((r) => r.expanded).sort((a, b) => a - b);
    expect(expanded[expanded.length - 1]).toBeLessThanOrEqual(1500);
    expect(results.filter((r) => r.status === "found").length).toBeGreaterThanOrEqual(194);
    expect(expanded[Math.floor(expanded.length * 0.9)]).toBeLessThanOrEqual(150);
    expect(elapsed).toBeLessThan(1000);
  });
});
