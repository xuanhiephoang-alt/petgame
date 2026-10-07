import { describe, expect, it } from "vitest";
import { PAL_SPECIES, getSpecies, pickSpecies } from "./pals.ts";

describe("pal data", () => {
  it("has unique ids and sane stats", () => {
    const ids = new Set(PAL_SPECIES.map((s) => s.id));
    expect(ids.size).toBe(PAL_SPECIES.length);
    for (const s of PAL_SPECIES) {
      expect(s.maxHp).toBeGreaterThan(0);
      expect(s.catchRate).toBeGreaterThan(0);
      expect(s.catchRate).toBeLessThanOrEqual(1);
      expect(s.spawnWeight).toBeGreaterThan(0);
    }
  });

  it("picks species across the whole roll range", () => {
    expect(pickSpecies(0)).toBe(PAL_SPECIES[0]);
    expect(pickSpecies(0.9999)).toBe(PAL_SPECIES[PAL_SPECIES.length - 1]);
  });

  it("filters spawns by biome and time of day", () => {
    for (let i = 0; i < 50; i++) {
      const lakeDay = pickSpecies(i / 50, { biome: "lake", night: false })!;
      expect(lakeDay.spawn.biomes).toContain("lake");
      expect(lakeDay.spawn.time).not.toBe("night");
    }
    const nightIds = new Set(Array.from({ length: 200 }, (_, i) => pickSpecies(i / 200, { biome: "meadow", night: true })!.id));
    expect(nightIds.has("mothlume")).toBe(true);
    const dayIds = new Set(Array.from({ length: 200 }, (_, i) => pickSpecies(i / 200, { biome: "meadow", night: false })!.id));
    expect(dayIds.has("mothlume")).toBe(false);
    expect(pickSpecies(0.5, { biome: "rocky", night: false })!.spawn.biomes).toContain("rocky");
  });

  it("has a temperament, attack and spawn rule for every species", () => {
    for (const s of PAL_SPECIES) {
      expect(["passive", "defensive", "aggressive"]).toContain(s.temperament);
      expect(s.attack).toBeGreaterThan(0);
      expect(s.spawn.biomes.length).toBeGreaterThan(0);
    }
  });

  it("throws on unknown species", () => {
    expect(() => getSpecies("missingno")).toThrow();
  });
});
