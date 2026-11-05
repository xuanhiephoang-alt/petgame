import { ITEMS, ITEM_INFO, type Item } from "./crafting.ts";
import { getWearable } from "./wardrobe.ts";
import { RESOURCES, RESOURCE_INFO, type Resource } from "./work.ts";

/** A bundle of resources and items (from a chest, a quest or the boss), maybe with clothes or a weapon. */
export type Reward = Partial<Record<Resource | Item, number>> & { wear?: string };

/**
 * "🪵 5  🔵 1  👘 Áo dài" for notices and the quest tracker. An item's icon and amount are joined by a no-break space
 * so a notice never wraps in the middle of one item; the double space between items is where it may wrap.
 */
export function rewardText(reward: Reward): string {
  const parts: string[] = [];
  for (const r of RESOURCES) if (reward[r]) parts.push(`${RESOURCE_INFO[r].icon}\xa0${reward[r]}`);
  for (const i of ITEMS) if (reward[i]) parts.push(`${ITEM_INFO[i].icon}\xa0${reward[i]}`);
  const wear = reward.wear ? getWearable(reward.wear) : undefined;
  if (wear) parts.push(`${wear.icon}\xa0${wear.name}`);
  return parts.join("  ");
}

/** Adds a reward to anything with resource and item counters (e.g. a Player). */
export function applyReward(target: Record<Resource | Item, number>, reward: Reward): void {
  for (const key of [...RESOURCES, ...ITEMS]) target[key] += reward[key] ?? 0;
}
