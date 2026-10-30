import { describe, expect, it } from "vitest";
import { CollisionGrid } from "./collision.ts";
import { BITE_KNOCKBACK, hitWildPal, knockback, palDrops } from "./combat.ts";
import { getSpecies } from "./pals.ts";

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
