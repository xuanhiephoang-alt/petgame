import recipeData from "./data/recipes.json" with { type: "json" };
import { RESOURCES, workIntervalMs, workOutput, type Resource } from "./work.ts";
import { getSpecies } from "./pals.ts";

export const ITEMS = ["greatBalls", "snacks"] as const;
export type Item = (typeof ITEMS)[number];

export const ITEM_INFO: Record<Item, { name: string; icon: string }> = {
  greatBalls: { name: "Bóng xịn", icon: "🔵" },
  snacks: { name: "Bánh quả mọng", icon: "🥧" },
};

/** Capture chance multiplier of a great ball (basic balls are 1). */
export const GREAT_BALL_BONUS = 1.6;
/** XP a pal gets from eating one snack. */
export const SNACK_XP = 40;
export const MAX_BASE_LEVEL = 3;
/** Crafting happens at your own camp: stand within this many pixels of it. */
export const CRAFT_RANGE = 160;

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: Partial<Record<Resource, number>>;
  /** Either an item to add, or the camp level it upgrades to. */
  output: { item: Item; amount: number } | { baseLevel: number };
}

export const RECIPES: readonly Recipe[] = recipeData as Recipe[];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function canAfford(have: Record<Resource, number>, cost: Recipe["cost"]): boolean {
  return RESOURCES.every((r) => (have[r] ?? 0) >= (cost[r] ?? 0));
}

/**
 * Why a recipe cannot be crafted right now, or undefined if it can.
 * Shared so the client greys out exactly what the server would refuse.
 */
export function craftBlocker(
  recipe: Recipe,
  state: { resources: Record<Resource, number>; hasBase: boolean; baseLevel: number; nearBase: boolean },
): string | undefined {
  if (!state.hasBase) return "Cần dựng trại trước";
  if (!state.nearBase) return "Hãy đứng gần trại của bạn";
  if ("baseLevel" in recipe.output) {
    if (state.baseLevel >= recipe.output.baseLevel) return "Trại đã đạt cấp này";
    if (state.baseLevel !== recipe.output.baseLevel - 1) return `Cần trại cấp ${recipe.output.baseLevel - 1}`;
  }
  if (!canAfford(state.resources, recipe.cost)) return "Chưa đủ nguyên liệu";
  return undefined;
}

/** How many pals can work at a camp of this level (3, 4, 5). */
export function workerCap(baseLevel: number): number {
  return 2 + Math.min(Math.max(baseLevel, 1), MAX_BASE_LEVEL);
}

/** Camp upgrades make workers 15% faster per level above 1. */
export function campSpeed(baseLevel: number): number {
  return 1 - 0.15 * (Math.min(Math.max(baseLevel, 1), MAX_BASE_LEVEL) - 1);
}

/** Offline production runs at half speed and stops after this long. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const OFFLINE_EFFICIENCY = 0.5;
export const OFFLINE_MAX_PER_RESOURCE = 300;

/** What a camp's workers made while their owner was away. */
export function offlineProduction(
  workers: readonly { speciesId: string; level: number }[],
  baseLevel: number,
  elapsedMs: number,
): Record<Resource, number> {
  const out = { wood: 0, stone: 0, berries: 0 } as Record<Resource, number>;
  const time = Math.min(Math.max(elapsedMs, 0), OFFLINE_CAP_MS) * OFFLINE_EFFICIENCY;
  for (const w of workers) {
    const interval = workIntervalMs(w.level) * campSpeed(baseLevel);
    out[workOutput(getSpecies(w.speciesId))] += Math.floor(time / interval);
  }
  for (const r of RESOURCES) out[r] = Math.min(out[r], OFFLINE_MAX_PER_RESOURCE);
  return out;
}
