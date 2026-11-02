import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  XP_PER_CAPTURE,
  XP_PER_KNOCKOUT,
  addXp,
  companionDamage,
  finishXp,
  levelCatchRate,
  rollWildLevel,
  scaledMaxHp,
  xpToNext,
} from "./progression.ts";
import { MAX_WORKERS, WORK_RADIUS, workIntervalMs, workOutput, workSpot } from "./work.ts";
import { getSpecies } from "./pals.ts";

/** XP from level 1 up to reaching `level`. */
const totalTo = (level: number) => {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
};

describe("progression", () => {
  it("needs more XP for higher levels", () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
    for (let level = 1; level < MAX_LEVEL; level++) expect(xpToNext(level + 1), `level ${level + 1}`).toBeGreaterThan(xpToNext(level));
  });

  it("follows the curve: 13 XP from level 1, 191 from level 6, 681 from level 14", () => {
    expect(xpToNext(1)).toBe(13);
    expect(xpToNext(6)).toBe(191);
    expect(xpToNext(14)).toBe(681);
  });

  it("totals 558 XP to reach level 7 (the second skill) and 4,159 to reach level 15 (the third)", () => {
    expect(totalTo(7)).toBe(558);
    expect(totalTo(15)).toBe(4159);
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

describe("finishXp", () => {
  it("pays the base at level 1 and 10% of it more for each level above", () => {
    expect(finishXp(XP_PER_KNOCKOUT, 1)).toBe(XP_PER_KNOCKOUT);
    expect(finishXp(XP_PER_CAPTURE, 1)).toBe(XP_PER_CAPTURE);
    expect([3, 5, 8, 10, 14].map((level) => finishXp(12, level))).toEqual([14, 17, 20, 23, 28]);
    expect([3, 5, 8, 10, 14].map((level) => finishXp(25, level))).toEqual([30, 35, 43, 48, 58]);
    expect(finishXp(25, 15)).toBe(60);
    expect(finishXp(25, 22)).toBe(78);
  });

  it("rounds a half up exactly (a level 14 catch is 58, not 57)", () => {
    expect(finishXp(25, 14)).toBe(58);
    expect(finishXp(25, 8)).toBe(43);
  });

  it("counts a level that is not a number, or below 1, as level 1; a fraction as the whole level under it", () => {
    for (const level of [0, -3, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(finishXp(25, level), String(level)).toBe(25);
    }
    expect(finishXp(25, 3.9)).toBe(finishXp(25, 3));
  });

  it("never pays less for a higher level", () => {
    for (const base of [XP_PER_KNOCKOUT, XP_PER_CAPTURE]) {
      for (let level = 2; level <= MAX_LEVEL; level++) expect(finishXp(base, level), `${base} at ${level}`).toBeGreaterThanOrEqual(finishXp(base, level - 1));
    }
  });

  it("keeps a catch worth at most 2.2 knock-outs at every level", () => {
    // Catching and letting go (about 5 s more per pal) only beats knocking pals out one after another when a catch
    // is worth about 3.5 knock-outs. Keep well below that if either number is changed.
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(finishXp(XP_PER_CAPTURE, level) / finishXp(XP_PER_KNOCKOUT, level), `level ${level}`).toBeLessThanOrEqual(2.2);
    }
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
