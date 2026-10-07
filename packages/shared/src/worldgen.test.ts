import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import { CollisionGrid } from "./collision.ts";
import { stepPlayer } from "./movement.ts";
import { CHEST_COUNT, CLEARING_RADIUS, dangerAt, defaultWorld, generateWorld } from "./worldgen.ts";
import { isSea, terrainAt } from "./terrain.ts";
import { climateHazard, protectedFrom } from "./climate.ts";
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

  it("has a meadow in the middle, four climates around it and the sea outside", () => {
    expect(terrainAt(layout.terrain, WORLD_WIDTH / 2, WORLD_HEIGHT / 2)).toBe("meadow");
    for (const region of ["snow", "desert", "swamp", "volcano", "island"] as const) {
      expect(terrainAt(layout.terrain, layout.regions[region].x, layout.regions[region].y)).toBe(region);
    }
    expect(layout.regions.snow.y).toBeLessThan(WORLD_HEIGHT / 2);
    expect(layout.regions.desert.y).toBeGreaterThan(WORLD_HEIGHT / 2);
    expect(layout.regions.swamp.x).toBeLessThan(WORLD_WIDTH / 2);
    expect(layout.regions.volcano.x).toBeGreaterThan(WORLD_WIDTH / 2);
    expect(isSea(layout.terrain, 10, 10 + WORLD_HEIGHT / 2)).toBe(true);
    expect(isSea(layout.terrain, -100, -100)).toBe(true);
  });

  it("keeps islands apart from the continent by sea", () => {
    for (const island of layout.islands.slice(0, 4)) {
      // Walk from the island toward the world center: there is sea on the way.
      let crossed = false;
      for (let t = 0; t <= 1; t += 0.01) {
        const x = island.x + (WORLD_WIDTH / 2 - island.x) * t, y = island.y + (WORLD_HEIGHT / 2 - island.y) * t;
        if (isSea(layout.terrain, x, y)) crossed = true;
      }
      expect(crossed).toBe(true);
    }
  });

  it("places reachable chests in every region and fruit bushes in the meadow", () => {
    expect(layout.chests).toHaveLength(CHEST_COUNT);
    for (const c of layout.chests) {
      expect(grid.blocked(c, PLAYER_RADIUS)).toBe(false);
      expect(isSea(layout.terrain, c.x, c.y)).toBe(false);
    }
    const regions = new Set(layout.chests.map((c) => terrainAt(layout.terrain, c.x, c.y)));
    expect([...regions].sort()).toEqual(["desert", "island", "meadow", "snow", "swamp", "volcano"]);
    expect(layout.fruits.length).toBeGreaterThan(10);
    for (const f of layout.fruits) expect(terrainAt(layout.terrain, f.x, f.y)).toBe("meadow");
  });

  it("spawns local species in each region", () => {
    const ids = (biome: "snow" | "desert" | "swamp" | "island") =>
      new Set(Array.from({ length: 100 }, (_, i) => pickSpecies(i / 100, { biome, night: false })!.id));
    expect(ids("snow").has("frostfang")).toBe(true);
    expect(ids("desert").has("cactoad")).toBe(true);
    expect(ids("swamp").has("bogbloom")).toBe(true);
    expect(ids("island").has("coralcrab")).toBe(true);
  });

  it("gets more dangerous away from spawn", () => {
    expect(dangerAt(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)).toBe(0);
    expect(dangerAt(0, 0)).toBeCloseTo(1);
    expect(dangerAt(layout.islands[0].x, layout.islands[0].y)).toBeGreaterThan(0.7);
  });
});

describe("sea movement", () => {
  const { layout, grid } = defaultWorld();
  // A point on the west coast: walk west from the swamp until the sea.
  let shore = { x: layout.regions.swamp.x, y: layout.regions.swamp.y };
  while (!isSea(layout.terrain, shore.x - 20, shore.y)) shore = { x: shore.x - 10, y: shore.y };

  it("stops at the shore without a raft and sails with one", () => {
    let walker = { ...shore };
    for (let i = 0; i < 20; i++) walker = stepPlayer(walker, { x: -1, y: 0 }, 50, undefined, { terrain: layout.terrain, canSail: false });
    expect(isSea(layout.terrain, walker.x, walker.y)).toBe(false);
    let sailor = { ...shore };
    for (let i = 0; i < 20; i++) sailor = stepPlayer(sailor, { x: -1, y: 0 }, 50, grid, { terrain: layout.terrain, canSail: true });
    expect(isSea(layout.terrain, sailor.x, sailor.y)).toBe(true);
  });
});

describe("climate", () => {
  it("is harsh in the snow, desert and volcano and mild elsewhere", () => {
    expect(climateHazard("snow", false)?.hazard).toBe("cold");
    expect(climateHazard("snow", true)!.damage).toBeGreaterThan(climateHazard("snow", false)!.damage);
    expect(climateHazard("desert", false)?.hazard).toBe("heat");
    expect(climateHazard("desert", true)?.hazard).toBe("cold");
    expect(climateHazard("volcano", true)?.hazard).toBe("heat");
    expect(climateHazard("meadow", false)).toBeUndefined();
  });

  it("is kept away by gear or a pal of the right element", () => {
    const none = { coat: 0, hat: 0 };
    expect(protectedFrom("cold", none)).toBe(false);
    expect(protectedFrom("cold", { coat: 1, hat: 0 })).toBe(true);
    expect(protectedFrom("cold", none, "fire")).toBe(true);
    expect(protectedFrom("heat", { coat: 1, hat: 0 })).toBe(false);
    expect(protectedFrom("heat", none, "water")).toBe(true);
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
