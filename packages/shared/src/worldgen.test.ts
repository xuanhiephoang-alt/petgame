import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import { CollisionGrid } from "./collision.ts";
import { stepPlayer } from "./movement.ts";
import { CHEST_COUNT, CLEARING_RADIUS, biomeAt, dangerAt, defaultWorld, generateWorld } from "./worldgen.ts";
import { pickSpecies } from "./pals.ts";

describe("generateWorld", () => {
  it("is deterministic for a seed", () => {
    expect(generateWorld(7)).toEqual(generateWorld(7));
    expect(generateWorld(7).props).not.toEqual(generateWorld(8).props);
  });

  it("keeps the spawn line free of obstacles", () => {
    const { grid } = defaultWorld();
    for (let i = 0; i < 5; i++) {
      // Same spawn formula as GameRoom.onJoin.
      const spawn = { x: WORLD_WIDTH / 2 + (i - 2) * 40, y: WORLD_HEIGHT / 2 };
      expect(grid.blocked(spawn, PLAYER_RADIUS)).toBe(false);
    }
  });

  it("only blocks with trees, rocks and the campfire", () => {
    const layout = generateWorld();
    expect(layout.colliders.length).toBeGreaterThan(50);
    const center = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    const inClearing = layout.props.filter((p) => p.kind === "tree" && Math.hypot(p.x - center.x, p.y - center.y) < CLEARING_RADIUS);
    expect(inClearing).toHaveLength(0);
  });
});

describe("expanded world", () => {
  const { layout, grid } = defaultWorld();

  it("has two lakes, rocky hills and a snowfield in their own corners", () => {
    expect(biomeAt(layout, layout.snow.x, layout.snow.y)).toBe("snow");
    expect(layout.snow.x).toBeLessThan(WORLD_WIDTH / 2);
    expect(layout.snow.y).toBeLessThan(WORLD_HEIGHT / 2);
    const lakeCenters = layout.lake.filter((c) => c.y < WORLD_HEIGHT / 2).length;
    expect(lakeCenters).toBeGreaterThan(0);
    expect(layout.lake.some((c) => c.y > WORLD_HEIGHT / 2)).toBe(true);
  });

  it("places reachable chests spread out, some in the snow", () => {
    expect(layout.chests).toHaveLength(CHEST_COUNT);
    for (const c of layout.chests) {
      expect(grid.blocked(c, PLAYER_RADIUS)).toBe(false);
      expect(c.x).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(WORLD_HEIGHT);
    }
    expect(layout.chests.filter((c) => biomeAt(layout, c.x, c.y) === "snow").length).toBeGreaterThanOrEqual(3);
  });

  it("spawns snow species in the snowfield", () => {
    const ids = new Set(Array.from({ length: 100 }, (_, i) => pickSpecies(i / 100, { biome: "snow", night: false })!.id));
    expect(ids.has("frostfang")).toBe(true);
  });

  it("gets more dangerous away from spawn", () => {
    expect(dangerAt(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)).toBe(0);
    expect(dangerAt(0, 0)).toBeCloseTo(1);
    expect(dangerAt(layout.snow.x, layout.snow.y)).toBeGreaterThan(0.5);
  });
});

describe("CollisionGrid", () => {
  const grid = new CollisionGrid([{ x: 100, y: 100, r: 20 }]);

  it("pushes a circle out of an obstacle", () => {
    const p = grid.resolve({ x: 110, y: 100 }, 10);
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(30);
  });

  it("leaves free positions alone", () => {
    expect(grid.resolve({ x: 200, y: 200 }, 10)).toEqual({ x: 200, y: 200 });
  });

  it("stops a walking player at the obstacle edge and lets them slide past", () => {
    let pos = { x: 50, y: 100 };
    for (let i = 0; i < 40; i++) pos = stepPlayer(pos, { x: 1, y: 0 }, 50, grid);
    expect(pos.x).toBeLessThanOrEqual(100 - 20 - PLAYER_RADIUS + 1e-6);
    // Moving diagonally slides around it instead of sticking.
    for (let i = 0; i < 40; i++) pos = stepPlayer(pos, { x: 1, y: 0.4 }, 50, grid);
    expect(pos.x).toBeGreaterThan(130);
  });
});
