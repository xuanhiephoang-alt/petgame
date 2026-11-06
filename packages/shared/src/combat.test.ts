import { describe, expect, it } from "vitest";
import { CollisionGrid } from "./collision.ts";
import { BITE_KNOCKBACK, PLAYER_MAX_HP, hitWildPal, knockback, palDrops, wildDamage } from "./combat.ts";
import { PAL_SPECIES, getSpecies } from "./pals.ts";
import { companionDamage, wildMaxLevel } from "./progression.ts";
import { isSupport, knownSkills, skillPower, wildSkillLevel } from "./skills.ts";

describe("hitting wild pals", () => {
  it("never drops below 1 HP, and 1 HP makes it dizzy", () => {
    expect(hitWildPal(40, 10, false, true)).toEqual({ hp: 30, dizzy: false, knockedOut: false });
    expect(hitWildPal(8, 10, false, true)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
    expect(hitWildPal(8, 10, false, false)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
  });

  it("knocks out a dizzy pal only with a player's hit", () => {
    expect(hitWildPal(1, 10, true, true)).toEqual({ hp: 0, dizzy: false, knockedOut: true });
    expect(hitWildPal(1, 10, true, false)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
  });
});

describe("knockback", () => {
  it("pushes straight away from the attacker", () => {
    const next = knockback({ x: 100, y: 100 }, { x: 80, y: 100 }, BITE_KNOCKBACK, 10);
    expect(next.x).toBeCloseTo(100 + BITE_KNOCKBACK);
    expect(next.y).toBeCloseTo(100);
  });

  it("slides off obstacles, stays in the world and stops where it is blocked", () => {
    const grid = new CollisionGrid([{ x: 130, y: 100, r: 20 }]);
    const next = knockback({ x: 100, y: 100 }, { x: 90, y: 100 }, 30, 10, grid);
    expect(Math.hypot(next.x - 130, next.y - 100)).toBeGreaterThanOrEqual(29.9);
    expect(knockback({ x: 8, y: 50 }, { x: 30, y: 50 }, 30, 6).x).toBe(6);
    expect(knockback({ x: 100, y: 100 }, { x: 80, y: 100 }, 20, 10, undefined, () => true)).toEqual({ x: 100, y: 100 });
  });

  it("pushes down the screen when both stand on one spot", () => {
    expect(knockback({ x: 50, y: 50 }, { x: 50, y: 50 }, 10, 5)).toEqual({ x: 50, y: 60 });
  });
});

describe("loot of knocked-out pals", () => {
  const seq = (...values: number[]) => () => values.shift() ?? 0.99;

  it("drops a resource of the pal's element, more at higher levels", () => {
    expect(palDrops(getSpecies("pebblet"), 1, seq(0, 0.9, 0.9))).toEqual({ stone: 1 });
    expect(palDrops(getSpecies("pebblet"), 8, seq(0, 0.1, 0.9))).toEqual({ stone: 4 });
    expect(palDrops(getSpecies("emberpup"), 1, seq(0, 0.9, 0.9))).toEqual({ wood: 1 });
  });

  it("sometimes adds a snack", () => {
    expect(palDrops(getSpecies("emberpup"), 1, seq(0, 0.9, 0.05)).snacks).toBe(1);
  });
});

describe("wild pals' bites", () => {
  it("bite as hard as their kind's attack at level 1, a little harder each level, never less at a higher level", () => {
    for (const s of PAL_SPECIES) {
      expect(wildDamage(s, 1), s.id).toBe(s.attack);
      for (let level = 2; level <= 30; level++) expect(wildDamage(s, level), `${s.id} Lv ${level}`).toBeGreaterThanOrEqual(wildDamage(s, level - 1));
    }
  });

  it("a level 14 bite is about twice a level 1 bite (Coralcrab 10 -> 20), not three times", () => {
    expect(wildDamage(getSpecies("coralcrab"), 14)).toBe(20);
    expect(wildDamage(getSpecies("boulderhorn"), 11)).toBe(18);
    expect(wildDamage(getSpecies("emberpup"), 6)).toBe(10);
  });

  it("companions keep their +15% a level", () => {
    expect(companionDamage(9)).toBe(13);
    expect(companionDamage(15)).toBe(19);
  });

  it("no common wild pal knocks out a full-health player in three hits", () => {
    for (const s of PAL_SPECIES) {
      for (let level = 1; level <= wildMaxLevel(1); level++) {
        expect(3 * wildDamage(s, level), `${s.id} Lv ${level} bite`).toBeLessThan(PLAYER_MAX_HP);
        for (const k of knownSkills(s, level)) {
          if (isSupport(k)) continue;
          expect(3 * skillPower(k, wildSkillLevel(level)), `${s.id} Lv ${level} ${k.id}`).toBeLessThan(PLAYER_MAX_HP);
        }
      }
    }
  });
});
