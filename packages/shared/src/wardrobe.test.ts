import { describe, expect, it } from "vitest";
import { ATTACK_DAMAGE } from "./constants.ts";
import { RECIPES, craftBlocker } from "./crafting.ts";
import { rewardText } from "./rewards.ts";
import {
  DEFAULT_LOOKS,
  HAIR_COLORS,
  MAX_DEFENSE,
  SKIN_TONES,
  STARTER_WARDROBE,
  WEARABLES,
  canWear,
  defenseOf,
  getWearable,
  rollWearable,
  sanitizeLook,
  weaponStats,
} from "./wardrobe.ts";

describe("wardrobe", () => {
  it("has unique ids, a slot each, and stats for every weapon", () => {
    expect(new Set(WEARABLES.map((w) => w.id)).size).toBe(WEARABLES.length);
    for (const w of WEARABLES) {
      expect(["outfit", "hat", "weapon"]).toContain(w.slot);
      expect(!!w.weapon).toBe(w.slot === "weapon");
      if (w.weapon) expect(w.weapon.damage).toBeGreaterThan(0);
    }
  });

  it("starts everyone with a few outfits and a hat, no weapon", () => {
    const slots = STARTER_WARDROBE.map((id) => getWearable(id)!.slot);
    expect(slots).toContain("outfit");
    expect(slots).toContain("hat");
    expect(slots).not.toContain("weapon");
  });

  it("only wears what is owned, in its own slot", () => {
    const wardrobe = [...STARTER_WARDROBE, "sword"];
    expect(canWear(wardrobe, "weapon", "sword")).toBe(true);
    expect(canWear(wardrobe, "weapon", "bow")).toBe(false); // not owned
    expect(canWear(wardrobe, "hat", "sword")).toBe(false); // wrong slot
    expect(canWear(wardrobe, "weapon", "")).toBe(true); // bare hands
    expect(canWear(wardrobe, "hat", "")).toBe(true);
    expect(canWear(wardrobe, "outfit", "")).toBe(false); // always dressed
  });

  it("gives weapons their stats and bare hands the plain attack", () => {
    expect(weaponStats("").damage).toBe(ATTACK_DAMAGE);
    expect(weaponStats("axe").damage).toBeGreaterThan(weaponStats("club").damage);
    expect(weaponStats("bow").ranged).toBe(true);
    expect(weaponStats("bow").range).toBeGreaterThan(weaponStats("spear").range);
  });

  it("adds up armor, up to a cap", () => {
    expect(defenseOf({ outfit: "explorer", hat: "" })).toBe(0);
    expect(defenseOf({ outfit: "leather", hat: "helmet" })).toBeCloseTo(0.3);
    expect(defenseOf({ outfit: "knight", hat: "helmet" })).toBeLessThanOrEqual(MAX_DEFENSE);
  });

  it("finds chest and boss items not owned yet", () => {
    const chest = WEARABLES.filter((w) => w.from === "chest").map((w) => w.id);
    expect(chest).toContain(rollWearable(() => 0.5, "chest", []));
    expect(rollWearable(() => 0.99, "chest", chest)).toBeUndefined(); // all found
    const left = rollWearable(() => 0, "chest", chest.slice(1));
    expect(left).toBe(chest[0]);
  });

  it("cleans up looks from untrusted data", () => {
    const fallback = DEFAULT_LOOKS[0];
    expect(sanitizeLook({ hair: "bun", hairColor: 3, skin: 4 }, fallback)).toEqual({ hair: "bun", hairColor: 3, skin: 4 });
    expect(sanitizeLook({ hair: "mohawk", hairColor: HAIR_COLORS.length, skin: -1 }, fallback)).toEqual(fallback);
    expect(sanitizeLook(undefined, fallback)).toEqual(fallback);
    expect(sanitizeLook({ hair: "long", hairColor: 1.5, skin: SKIN_TONES.length - 1 }, fallback).hairColor).toBe(fallback.hairColor);
  });

  it("crafts clothes and weapons once, some only at a bigger camp", () => {
    const sword = RECIPES.find((r) => "wear" in r.output && r.output.wear === "sword")!;
    const bow = RECIPES.find((r) => "wear" in r.output && r.output.wear === "bow")!;
    const rich = { wood: 99, stone: 99, berries: 99 };
    const at = { resources: rich, hasBase: true, nearBase: true, baseLevel: 1, wardrobe: [...STARTER_WARDROBE] };
    expect(craftBlocker(sword, at)).toBeUndefined();
    expect(craftBlocker(sword, { ...at, wardrobe: [...STARTER_WARDROBE, "sword"] })).toBe("Đã có rồi");
    expect(craftBlocker(bow, at)).toBe("Cần trại cấp 2");
    expect(craftBlocker(bow, { ...at, baseLevel: 2 })).toBeUndefined();
    // Every recipe that makes clothes or a weapon names a real one.
    for (const r of RECIPES) if ("wear" in r.output) expect(getWearable(r.output.wear)).toBeDefined();
  });

  it("names clothes in reward texts", () => {
    expect(rewardText({ wood: 2, wear: "aodai" })).toBe("🪵 2  👘 Áo dài");
  });
});
