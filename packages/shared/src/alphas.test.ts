import { describe, expect, it } from "vitest";
import { ALPHAS, ALPHA, alphaLairs } from "./alphas.ts";
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
