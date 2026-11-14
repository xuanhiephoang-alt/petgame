import { describe, expect, it } from "vitest";
import { ALPHAS, ALPHA, alphaChaseSpeed, alphaLairs, palName } from "./alphas.ts";
import { WILD_CHASE_SPEED_FACTOR } from "./combat.ts";
import { PLAYER_SPEED } from "./constants.ts";
import { getSpecies } from "./pals.ts";
import { SKILL_LEVELS, knownSkills } from "./skills.ts";
import { terrainAt } from "./terrain.ts";
import { CLEARING_RADIUS, biomeAt, defaultWorld } from "./worldgen.ts";

describe("pack leaders", () => {
  it("guard one region each, are kinds that live there and know all three skills", () => {
    expect(new Set(ALPHAS.map((a) => a.region)).size).toBe(ALPHAS.length);
    for (const alpha of ALPHAS) {
      const species = getSpecies(alpha.speciesId);
      expect(species.spawn.biomes, alpha.speciesId).toContain(alpha.region);
      expect(alpha.level).toBeGreaterThanOrEqual(SKILL_LEVELS[SKILL_LEVELS.length - 1]);
      expect(knownSkills(species, alpha.level)).toHaveLength(3);
    }
    expect(ALPHA.leash).toBeGreaterThan(ALPHA.sight);
  });

  it("chase no faster than a walking player, yet fast enough that kiting is not possible", () => {
    expect(ALPHA.chaseSpeedMax).toBe(152);
    expect(ALPHA.chaseSpeedMax).toBeLessThan(PLAYER_SPEED);
    expect(ALPHA.chaseSpeedMax).toBeGreaterThanOrEqual(PLAYER_SPEED * 0.9);
    for (const def of ALPHAS) expect(alphaChaseSpeed(getSpecies(def.speciesId).speed), def.speciesId).toBeLessThan(PLAYER_SPEED);
  });

  it("cap only the fast ones: Voltmouse and Scorchtail at 152, the rest at 1.8x", () => {
    const expected: Record<string, number> = { voltmouse: 152, scorchtail: 152, frostfang: 135, coralcrab: 99, cactoad: 81, bogbloom: 72 };
    for (const def of ALPHAS) {
      expect(expected[def.speciesId], def.speciesId).toBeDefined();
      expect(alphaChaseSpeed(getSpecies(def.speciesId).speed), def.speciesId).toBeCloseTo(expected[def.speciesId], 6);
    }
    for (let speed = 10; speed <= 84; speed++) expect(alphaChaseSpeed(speed)).toBe(speed * WILD_CHASE_SPEED_FACTOR);
    for (let speed = 85; speed <= 200; speed++) expect(alphaChaseSpeed(speed)).toBe(ALPHA.chaseSpeedMax);
  });

  it("names a pack leader, wild or caught, as players read it", () => {
    expect(palName("voltmouse")).toBe("Voltmouse");
    expect(palName("voltmouse", false)).toBe("Voltmouse");
    expect(palName("voltmouse", true)).toBe("Voltmouse đầu đàn");
    for (const def of ALPHAS) expect(palName(def.speciesId, true)).toBe(`${getSpecies(def.speciesId).name} đầu đàn`);
  });

  it("live on open ground in their region, the meadow's away from the spawn", () => {
    const { layout, grid } = defaultWorld();
    const lairs = alphaLairs();
    expect(lairs.size).toBe(ALPHAS.length);
    for (const alpha of ALPHAS) {
      const at = lairs.get(alpha.region)!;
      expect(terrainAt(layout.terrain, at.x, at.y), alpha.region).toBe(alpha.region);
      expect(biomeAt(layout, at.x, at.y)).not.toBe("lake");
      expect(grid.blocked(at, 40), alpha.region).toBe(false);
    }
    const meadow = lairs.get("meadow")!;
    expect(Math.hypot(meadow.x - layout.regions.meadow.x, meadow.y - layout.regions.meadow.y)).toBeGreaterThan(CLEARING_RADIUS + 200);
    // The same spots every time (client and server agree).
    expect(alphaLairs()).toBe(lairs);
  });
});
