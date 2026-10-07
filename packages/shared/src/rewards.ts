import { ITEMS, ITEM_INFO, type Item } from "./crafting.ts";
import { RESOURCES, RESOURCE_INFO, type Resource } from "./work.ts";

/** A bundle of resources and items (from a chest, a quest or the boss). */
export type Reward = Partial<Record<Resource | Item, number>>;

/** "🪵 5  🔵 1" for notices and the quest tracker. */
export function rewardText(reward: Reward): string {
  const parts: string[] = [];
  for (const r of RESOURCES) if (reward[r]) parts.push(`${RESOURCE_INFO[r].icon} ${reward[r]}`);
  for (const i of ITEMS) if (reward[i]) parts.push(`${ITEM_INFO[i].icon} ${reward[i]}`);
  return parts.join("  ");
}

/** Adds a reward to anything with resource and item counters (e.g. a Player). */
export function applyReward(target: Record<Resource | Item, number>, reward: Reward): void {
  for (const key of [...RESOURCES, ...ITEMS]) target[key] += reward[key] ?? 0;
}
