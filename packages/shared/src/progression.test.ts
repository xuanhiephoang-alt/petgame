import { describe, expect, it } from "vitest";
import { MAX_LEVEL, addXp, companionDamage, levelCatchRate, rollWildLevel, scaledMaxHp, xpToNext } from "./progression.ts";
import { MAX_WORKERS, WORK_RADIUS, workIntervalMs, workOutput, workSpot } from "./work.ts";
import { getSpecies } from "./pals.ts";

describe("progression", () => {
  it("needs more XP for higher levels", () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
  });

  it("levels up, carrying leftover XP, possibly several times", () => {
    expect(addXp({ level: 1, xp: 0 }, xpToNext(1) + 3)).toEqual({ level: 2, xp: 3, levelsGained: 1 });
    expect(addXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2)).levelsGained).toBe(2);
    expect(addXp({ level: 1, xp: 0 }, -10)).toEqual({ level: 1, xp: 0, levelsGained: 0 });
  });

  it("caps at the max level", () => {
    const r = addXp({ level: MAX_LEVEL - 1, xp: 0 }, 1e9);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.xp).toBe(0);
  });

  it("scales damage, HP and catch rate with level", () => {
    expect(companionDamage(5)).toBeGreaterThan(companionDamage(1));
    expect(scaledMaxHp(40, 1)).toBe(40);
    expect(scaledMaxHp(40, 3)).toBeGreaterThan(40);
    expect(levelCatchRate(0.5, 4)).toBeLessThan(0.5);
    expect(levelCatchRate(0.5, 100)).toBeCloseTo(0.15);
  });

  it("rolls wild levels within range, mostly low", () => {
    expect(rollWildLevel(0)).toBe(1);
    expect(rollWildLevel(0.999)).toBeLessThanOrEqual(6);
    expect(rollWildLevel(0.5)).toBeLessThanOrEqual(3);
  });
});

describe("work", () => {
  it("maps species skills to resources", () => {
    expect(workOutput(getSpecies("pebblet"))).toBe("stone");
    expect(workOutput(getSpecies("leafkit"))).toBe("berries");
    expect(workOutput(getSpecies("emberpup"))).toBe("wood");
  });

  it("works faster with level but not below 3 s", () => {
    expect(workIntervalMs(10)).toBeLessThan(workIntervalMs(1));
    expect(workIntervalMs(MAX_LEVEL)).toBeGreaterThanOrEqual(3000);
  });

  it("spreads workers around the base", () => {
    const spots = Array.from({ length: MAX_WORKERS }, (_, i) => workSpot({ x: 0, y: 0 }, i));
    for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(WORK_RADIUS);
    expect(new Set(spots.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`)).size).toBe(MAX_WORKERS);
  });
});
