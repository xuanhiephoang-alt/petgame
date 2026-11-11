import { describe, expect, it } from "vitest";
import {
  CollisionGrid,
  NavGrid,
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  BOSS,
  WILD_AGGRO_MS,
  WILD_CHASE_SPEED_FACTOR,
  distance,
  defaultNav,
  defaultWorld,
  getSpecies,
  isSea,
  mulberry32,
  type Circle,
  type Vec2,
} from "@petgame/shared";
import { PATHING, PathPlanner, detourLimit, type Walker } from "./pathing.ts";
import { stepChase } from "./wildCombat.ts";
import { randomPoint } from "./wander.ts";

const TICK = 50;
const tree = (x: number, y: number, r = 14): Circle => ({ x, y, r });

/** A cup of overlapping trees open to the north: nothing fits inside, so only a detour leaves it. */
function treeCup(c: Vec2): Circle[] {
  const out: Circle[] = [];
  for (let x = c.x - 80; x <= c.x + 80; x += 20) out.push(tree(x, c.y + 40));
  for (let y = c.y + 20; y >= c.y - 60; y -= 20) out.push(tree(c.x - 80, y), tree(c.x + 80, y));
  return out;
}

/** A closed ring of trees of the given radius around `c`. */
function treeRing(c: Vec2, ring = 60): Circle[] {
  const n = Math.ceil((2 * Math.PI * ring) / 20);
  const out: Circle[] = [];
  for (let i = 0; i < n; i++) out.push(tree(c.x + Math.cos((i / n) * 2 * Math.PI) * ring, c.y + Math.sin((i / n) * 2 * Math.PI) * ring));
  return out;
}

const scene = (circles: Circle[]) => {
  const grid = new CollisionGrid(circles);
  return { grid, nav: new NavGrid(grid) };
};

const emberpup = getSpecies("emberpup");
const SPEED = emberpup.speed * WILD_CHASE_SPEED_FACTOR;
const walker = (goalRadius = 40, radius = emberpup.size): Walker => ({ radius, sea: false, goalRadius, step: (SPEED * TICK) / 1000 });

describe("PathPlanner", () => {
  it("walks straight when the way is clear", () => {
    const { nav } = scene([]);
    const planner = new PathPlanner(nav);
    const goal = { x: 1300, y: 1000 };
    const out = planner.steer("w:a", { x: 1000, y: 1000 }, goal, walker(), TICK);
    expect(out).toBe(goal);
    planner.run(TICK);
    expect(planner.lastRun.searches).toBe(0);
    expect(planner.waypoints("w:a")).toBeUndefined();
  });

  it("does not look for a way once within reach", () => {
    const { nav } = scene([tree(1030, 1000)]);
    const planner = new PathPlanner(nav);
    const goal = { x: 1060, y: 1000 };
    // The tree is in the way, but the goal is 60 px off and the reach is 70 px.
    expect(planner.steer("w:a", { x: 1000, y: 1000 }, goal, walker(70), TICK)).toBe(goal);
    planner.run(TICK);
    expect(planner.lastRun.searches).toBe(0);
  });

  it("leads a pal out of a cup of trees to a player behind it, where sliding alone stays stuck", () => {
    const c = { x: 1000, y: 1000 };
    const { grid, nav } = scene(treeCup(c));
    const goal = { x: c.x, y: c.y + 120 };
    const planner = new PathPlanner(nav);
    let pos: Vec2 = c;
    let arrived = -1;
    for (let i = 0; i < 100 && arrived < 0; i++) {
      const now = (i + 1) * TICK;
      const via = planner.steer("w:a", pos, goal, walker(), now);
      const step = stepChase(pos, goal, SPEED, TICK, emberpup.size, grid, 40, via);
      pos = step.pos;
      if (step.inRange) arrived = i;
      planner.run(now);
    }
    expect(arrived).toBeGreaterThanOrEqual(0);

    // Control: without a path it only slides along the trees and never gets there.
    let stuck: Vec2 = c;
    for (let i = 0; i < 160; i++) {
      const step = stepChase(stuck, goal, SPEED, TICK, emberpup.size, grid, 40);
      stuck = step.pos;
      expect(step.inRange).toBe(false);
    }
  });

  it("serves searches first come, first served, 8 a tick", () => {
    const circles: Circle[] = [];
    for (let i = 0; i < 30; i++) circles.push(tree(1000 + 100 * i, 1040));
    const { nav } = scene(circles);
    const planner = new PathPlanner(nav);
    for (let k = 1; k <= 4; k++) {
      const now = k * TICK;
      for (let i = 0; i < 30; i++) planner.steer(`w:${i}`, { x: 1000 + 100 * i, y: 1000 }, { x: 1000 + 100 * i, y: 1080 }, walker(), now);
      planner.run(now);
      expect(planner.lastRun.searches).toBeLessThanOrEqual(8);
      expect(planner.lastRun.expanded).toBeLessThanOrEqual(3000);
      for (let i = 0; i < 30; i++) expect(planner.waypoints(`w:${i}`) !== undefined, `pal ${i} after tick ${k}`).toBe(i < Math.min(8 * k, 30));
    }
  });

  it("never expands more than its tick budget", () => {
    const circles: Circle[] = [];
    for (let i = 0; i < 5; i++) circles.push(...treeRing({ x: 1000 + 300 * i, y: 1000 }));
    const { nav } = scene(circles);
    const planner = new PathPlanner(nav);
    const served: number[] = [];
    for (let k = 1; k <= 3; k++) {
      const now = k * TICK;
      for (let i = 0; i < 5; i++) planner.steer(`w:${i}`, { x: 1000 + 300 * i, y: 1250 }, { x: 1000 + 300 * i, y: 1000 }, walker(), now);
      planner.run(now);
      served.push(planner.lastRun.searches);
      if (k < 3) {
        expect(planner.lastRun.searches).toBe(2);
        expect(planner.lastRun.expanded).toBe(PATHING.tickBudget);
      } else {
        expect(planner.lastRun.searches).toBe(1);
      }
    }
  });

  it("waits before searching again", () => {
    const c = { x: 1000, y: 1000 };
    const { grid, nav } = scene(treeCup(c));
    const planner = new PathPlanner(nav);
    let goal = { x: c.x, y: c.y + 120 };
    let pos: Vec2 = c;
    let first = 0;
    const searchesAt: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const now = (i + 1) * TICK;
      const via = planner.steer("w:a", pos, goal, walker(), now);
      pos = stepChase(pos, goal, SPEED, TICK, emberpup.size, grid, 40, via).pos;
      planner.run(now);
      if (i === 0) {
        first = now;
        expect(planner.waypoints("w:a")).toBeDefined();
        goal = { x: c.x + 60, y: c.y + 120 };
      } else {
        searchesAt.push([now, planner.lastRun.searches]);
      }
    }
    for (const [now, searches] of searchesAt) {
      if (now < first + PATHING.retryMs) expect(searches).toBe(0);
    }
    const again = searchesAt.find(([now]) => now >= first + PATHING.retryMs)!;
    expect(again[1]).toBe(1);
    expect(searchesAt.filter(([now, s]) => now > again[0] && s > 0).length).toBeLessThanOrEqual(searchesAt.length);

    // Shut in a ring, the goal outside: no way, so it waits longer.
    const ring = scene(treeRing(c));
    const caged = new PathPlanner(ring.nav);
    const out = { x: 1300, y: 1000 };
    let firstFail = 0;
    for (let i = 0; i < 50; i++) {
      const now = (i + 1) * TICK;
      caged.steer("w:b", c, out, walker(), now);
      caged.run(now);
      if (i === 0) {
        firstFail = now;
        expect(caged.lastRun.searches).toBe(1);
      } else if (now < firstFail + PATHING.failRetryMs) {
        expect(caged.lastRun.searches).toBe(0);
      } else if (now === firstFail + PATHING.failRetryMs) {
        expect(caged.lastRun.searches).toBe(1);
      }
    }
  });

  it("keeps its path while the goal moves a little", () => {
    const c = { x: 1000, y: 1000 };
    const { grid, nav } = scene(treeCup(c));
    const planner = new PathPlanner(nav);
    const goal = { x: c.x, y: c.y + 120 };
    let pos: Vec2 = c;
    let now = 0;
    const tick = (g: Vec2) => {
      now += TICK;
      const via = planner.steer("w:a", pos, g, walker(), now);
      pos = stepChase(pos, g, SPEED, TICK, emberpup.size, grid, 40, via).pos;
      planner.run(now);
      return via;
    };
    tick(goal);
    const moved = { x: goal.x + 30, y: goal.y };
    for (let i = 0; i < 20; i++) {
      const via = tick(moved);
      expect(planner.lastRun.searches).toBe(0);
      expect(via.x !== moved.x || via.y !== moved.y).toBe(true);
    }
  });

  it("searches when stuck even if the way looks clear, and walks that path", () => {
    const { nav } = scene([]);
    const planner = new PathPlanner(nav);
    const pos = { x: 1000, y: 1000 };
    const goal = { x: 1203, y: 1005 };
    let now = 0;
    for (let i = 0; i < 7; i++) {
      now += TICK;
      expect(planner.steer("w:a", pos, goal, walker(), now)).toBe(goal);
    }
    planner.run(now);
    expect(planner.lastRun.searches).toBe(1);
    now += TICK;
    const via = planner.steer("w:a", pos, goal, walker(), now);
    expect(via.x !== goal.x || via.y !== goal.y).toBe(true);
  });

  it("drops its path when moved far", () => {
    const c = { x: 1000, y: 1000 };
    const { nav } = scene(treeCup(c));
    const planner = new PathPlanner(nav);
    const goal = { x: c.x, y: c.y + 120 };
    planner.steer("w:a", c, goal, walker(), TICK);
    planner.run(TICK);
    expect(planner.waypoints("w:a")).toBeDefined();
    planner.steer("w:a", { x: c.x + 100, y: c.y }, goal, walker(), 2 * TICK);
    expect(planner.waypoints("w:a")).toBeUndefined();
  });

  it("forgets, and drops requests of pals that stopped asking", () => {
    const c = { x: 1000, y: 1000 };
    const { nav } = scene(treeCup(c));
    const planner = new PathPlanner(nav);
    const goal = { x: c.x, y: c.y + 120 };
    planner.steer("w:a", c, goal, walker(), TICK);
    expect(planner.has("w:a")).toBe(true);
    planner.forget("w:a");
    expect(planner.has("w:a")).toBe(false);
    planner.run(TICK);
    expect(planner.lastRun.searches).toBe(0);

    planner.steer("w:b", c, goal, walker(), TICK);
    planner.run(TICK + PATHING.staleMs + 1);
    expect(planner.lastRun.searches).toBe(0);
    expect(planner.waypoints("w:b")).toBeUndefined();
  });

  it("keeps to its budget with 100 pals chasing around trees at once (benchmark)", () => {
    const world = defaultWorld();
    const grid = world.grid;
    const terrain = world.layout.terrain;
    const nav = defaultNav();
    const planner = new PathPlanner(nav);
    const rand = mulberry32(5150);
    const body = { radius: emberpup.size, sea: false };
    const pals: { pos: Vec2; goal: Vec2; arrived: boolean }[] = [];
    for (let guard = 0; pals.length < 100 && guard < 100_000; guard++) {
      const p = randomPoint(rand, grid, 20);
      if (isSea(terrain, p.x, p.y)) continue;
      const angle = rand() * Math.PI * 2;
      const d = 100 + rand() * 300;
      const g = { x: p.x + Math.cos(angle) * d, y: p.y + Math.sin(angle) * d };
      if (g.x < 32 || g.y < 32 || g.x > WORLD_WIDTH - 32 || g.y > WORLD_HEIGHT - 32) continue;
      if (isSea(terrain, g.x, g.y) || grid.blocked(g, PLAYER_RADIUS) || nav.lineClear(p, g, body)) continue;
      pals.push({ pos: p, goal: g, arrived: false });
    }
    expect(pals).toHaveLength(100);

    let maxSearches = 0;
    let maxExpanded = 0;
    const started = performance.now();
    for (let i = 0; i < 160; i++) {
      const now = (i + 1) * TICK;
      pals.forEach((pal, n) => {
        if (pal.arrived) return;
        const via = planner.steer(`w:${n}`, pal.pos, pal.goal, walker(), now);
        const step = stepChase(pal.pos, pal.goal, SPEED, TICK, emberpup.size, grid, 40, via);
        if (!isSea(terrain, step.pos.x, step.pos.y)) pal.pos = step.pos;
        if (step.inRange) pal.arrived = true;
      });
      planner.run(now);
      maxSearches = Math.max(maxSearches, planner.lastRun.searches);
      maxExpanded = Math.max(maxExpanded, planner.lastRun.expanded);
    }
    const perTick = (performance.now() - started) / 160;
    expect(maxSearches).toBeLessThanOrEqual(PATHING.searchesPerTick);
    expect(maxExpanded).toBeLessThanOrEqual(PATHING.tickBudget);
    expect(pals.filter((p) => p.arrived).length).toBeGreaterThanOrEqual(95);
    expect(perTick).toBeLessThan(5);
  });
});

describe("detourLimit", () => {
  const rule = { factor: 3, extra: 160, max: 648 };

  it("allows the larger of factor x straight and straight + extra, up to max", () => {
    expect(detourLimit(30, rule)).toBe(190);
    expect(detourLimit(94, rule)).toBe(282);
    expect(detourLimit(400, rule)).toBe(648);
  });

  it("matches the boss table", () => {
    const boss = getSpecies(BOSS.speciesId);
    expect((boss.speed * WILD_CHASE_SPEED_FACTOR * WILD_AGGRO_MS) / 1000).toBeCloseTo(648);
    expect(BOSS.chaseDetourFactor).toBe(3);
    expect(BOSS.chaseDetourExtra).toBe(160);
    expect(BOSS.leash).toBe(256);
    expect(BOSS.homeRadius).toBe(128);
  });
});

describe("PathPlanner maxPath", () => {
  const c = { x: 1000, y: 1000 };
  const goal = { x: c.x, y: c.y + 120 };

  it("refuses a path longer than maxPath, walks straight and asks again after failRetryMs", () => {
    const { nav } = scene(treeCup(c));
    const a = new PathPlanner(nav);
    a.steer("w:a", c, goal, walker(), TICK);
    a.run(TICK);
    const way = a.waypoints("w:a")!;
    expect(way).toBeDefined();
    let len = 0;
    let at: Vec2 = c;
    for (const p of way) {
      len += distance(at, p);
      at = p;
    }

    const b = new PathPlanner(nav);
    const capped = { ...walker(), maxPath: len - 1 };
    b.steer("w:a", c, goal, capped, TICK);
    b.run(TICK);
    expect(b.lastRun.searches).toBe(1);
    expect(b.lastRun.refused).toBe(1);
    expect(b.waypoints("w:a")).toBeUndefined();
    for (let i = 1; i < 50; i++) {
      const now = TICK + i * TICK;
      const via = b.steer("w:a", c, goal, capped, now);
      if (i === 1) expect(via).toBe(goal);
      b.run(now);
      if (now < TICK + PATHING.failRetryMs) expect(b.lastRun.searches).toBe(0);
      else if (now === TICK + PATHING.failRetryMs) expect(b.lastRun.searches).toBe(1);
    }

    const k = new PathPlanner(nav);
    k.steer("w:a", c, goal, { ...walker(), maxPath: len + 1 }, TICK);
    k.run(TICK);
    expect(k.waypoints("w:a")).toBeDefined();
    expect(k.lastRun.refused).toBe(0);
  });

  it("keeps the boss pressing on toward a target close behind a long wall instead of walking far round it", () => {
    const wall: Circle[] = [];
    for (let x = 800; x <= 1200; x += 20) wall.push(tree(x, 1050));
    const { grid, nav } = scene(wall);
    const speed = getSpecies(BOSS.speciesId).speed * WILD_CHASE_SPEED_FACTOR;
    const target = { x: 1000, y: 1090 };
    const run = (limited: boolean) => {
      const planner = new PathPlanner(nav);
      const start = { x: 1000, y: 990 };
      let pos: Vec2 = start;
      let far = 0;
      for (let i = 0; i < 60; i++) {
        const now = (i + 1) * TICK;
        const maxPath = limited
          ? detourLimit(distance(pos, target), { factor: BOSS.chaseDetourFactor, extra: BOSS.chaseDetourExtra, max: 648 })
          : undefined;
        const goalRadius = BOSS.radius + 24;
        const via = planner.steer("w:boss", pos, target, { radius: BOSS.radius, sea: false, goalRadius, step: (speed * TICK) / 1000, maxPath }, now);
        pos = stepChase(pos, target, speed, TICK, BOSS.radius, grid, goalRadius, via).pos;
        planner.run(now);
        far = Math.max(far, distance(pos, start));
      }
      return { far, end: distance(pos, target) };
    };
    const limited = run(true);
    expect(limited.far).toBeLessThanOrEqual(40);
    expect(limited.end).toBeLessThanOrEqual(BOSS.stompRadius);
    expect(run(false).far).toBeGreaterThan(150);
  });
});
