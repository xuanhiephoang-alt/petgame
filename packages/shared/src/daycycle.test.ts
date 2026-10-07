import { describe, expect, it } from "vitest";
import { DAY_START, daylight, isNight, phaseAt } from "./daycycle.ts";
import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";
import { biomeAt, defaultWorld, generateWorld } from "./worldgen.ts";
import { companionMaxHp, wildDamage } from "./combat.ts";
import { getSpecies } from "./pals.ts";

describe("day cycle", () => {
  it("walks through day, dusk, night and dawn", () => {
    expect(phaseAt(DAY_START)).toBe("day");
    expect(phaseAt(0.68)).toBe("dusk");
    expect(isNight(0.8)).toBe(true);
    expect(phaseAt(0.99)).toBe("dawn");
    expect(phaseAt(1.3)).toBe("day"); // wraps
  });

  it("daylight is 1 by day, 0 at night and continuous", () => {
    expect(daylight(0.3)).toBe(1);
    expect(daylight(0.8)).toBe(0);
    for (let t = 0; t < 1; t += 0.001) expect(Math.abs(daylight(t + 0.001) - daylight(t))).toBeLessThan(0.05);
  });
});

describe("biomes", () => {
  const world = generateWorld();

  it("has a lake that blocks movement and is away from spawn", () => {
    const { grid } = defaultWorld();
    const lake = world.lake[0];
    expect(grid.blocked({ x: lake.x, y: lake.y }, PLAYER_RADIUS)).toBe(true);
    expect(Math.hypot(lake.x - WORLD_WIDTH / 2, lake.y - WORLD_HEIGHT / 2)).toBeGreaterThan(300);
  });

  it("classifies points", () => {
    const lake = world.lake[0];
    expect(biomeAt(world, lake.x + lake.r + 10, lake.y)).toBe("lake");
    expect(biomeAt(world, world.rocky.x, world.rocky.y)).toBe("rocky");
    expect(biomeAt(world, WORLD_WIDTH / 2, WORLD_HEIGHT / 2)).toBe("meadow");
  });

  it("puts no trees in the water", () => {
    for (const p of world.props.filter((p) => p.kind === "tree")) {
      expect(world.lake.every((c) => Math.hypot(p.x - c.x, p.y - c.y) >= c.r)).toBe(true);
    }
  });
});

describe("combat numbers", () => {
  it("scale with level", () => {
    const boulder = getSpecies("boulderhorn");
    expect(wildDamage(boulder, 5)).toBeGreaterThan(wildDamage(boulder, 1));
    expect(companionMaxHp(boulder, 3)).toBeGreaterThan(boulder.maxHp);
  });
});
