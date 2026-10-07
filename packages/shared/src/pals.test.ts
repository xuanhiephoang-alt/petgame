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

  it("throws on unknown species", () => {
    expect(() => getSpecies("missingno")).toThrow();
  });
});
