import { describe, expect, it } from "vitest";
import {
  OFFLINE_CAP_MS,
  OFFLINE_MAX_PER_RESOURCE,
  RECIPES,
  campSpeed,
  canAfford,
  craftBlocker,
  getRecipe,
  offlineProduction,
  workerCap,
} from "./crafting.ts";
import { RESOURCES } from "./work.ts";

const rich = { wood: 100, stone: 100, berries: 100 };
const ready = { resources: rich, hasBase: true, baseLevel: 1, nearBase: true };

describe("recipes", () => {
  it("have unique ids and only known resources", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) for (const k of Object.keys(r.cost)) expect(RESOURCES).toContain(k);
  });

  it("checks cost", () => {
    expect(canAfford({ wood: 3, stone: 2, berries: 0 }, { wood: 3, stone: 2 })).toBe(true);
    expect(canAfford({ wood: 2, stone: 2, berries: 0 }, { wood: 3, stone: 2 })).toBe(false);
  });

  it("explains why a recipe is blocked", () => {
    const ball = getRecipe("great_ball")!;
    expect(craftBlocker(ball, ready)).toBeUndefined();
    expect(craftBlocker(ball, { ...ready, hasBase: false })).toContain("trại");
    expect(craftBlocker(ball, { ...ready, nearBase: false })).toContain("gần");
    expect(craftBlocker(ball, { ...ready, resources: { wood: 0, stone: 0, berries: 0 } })).toContain("nguyên liệu");
  });

  it("upgrades the camp one level at a time", () => {
    expect(craftBlocker(getRecipe("camp_2")!, ready)).toBeUndefined();
    expect(craftBlocker(getRecipe("camp_3")!, ready)).toContain("cấp 2");
    expect(craftBlocker(getRecipe("camp_2")!, { ...ready, baseLevel: 2 })).toContain("đã đạt");
  });

  it("camp level raises worker cap and speed", () => {
    expect([1, 2, 3].map(workerCap)).toEqual([3, 4, 5]);
    expect(campSpeed(3)).toBeLessThan(campSpeed(1));
  });
});

describe("offlineProduction", () => {
  it("produces at half speed by each worker's skill", () => {
    const out = offlineProduction([{ speciesId: "pebblet", level: 1 }], 1, 60 * 60 * 1000);
    // 1 h at 50% = 30 min; one stone per 10 s at level 1.
    expect(out).toEqual({ wood: 0, stone: 180, berries: 0 });
  });

  it("caps time and amounts", () => {
    const many = Array.from({ length: 5 }, () => ({ speciesId: "leafkit", level: 30 }));
    const out = offlineProduction(many, 3, OFFLINE_CAP_MS * 10);
    expect(out.berries).toBe(OFFLINE_MAX_PER_RESOURCE);
    expect(offlineProduction(many, 1, -5)).toEqual({ wood: 0, stone: 0, berries: 0 });
  });
});
