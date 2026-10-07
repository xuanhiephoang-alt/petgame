import type { Reward } from "./rewards.ts";

/** Walk this close (pixels) to a chest to open it. */
export const CHEST_OPEN_RADIUS = 36;
/** An opened chest refills after this long. */
export const CHEST_RESPAWN_MS = 3 * 60 * 1000;

/**
 * What a chest holds. Each call draws from `rand` (0..1): a pile of one or
 * two resources, sometimes a great ball or a snack. `danger` (0 near the
 * spawn, 1 at the far corners) makes remote chests richer.
 */
export function rollChestLoot(rand: () => number, danger = 0): Reward {
  const bonus = Math.round(danger * 4);
  const loot: Reward = {};
  const resources = ["wood", "stone", "berries"] as const;
  const first = resources[Math.floor(rand() * 3)];
  loot[first] = 3 + Math.floor(rand() * 8) + bonus;
  if (rand() < 0.5) {
    const second = resources[Math.floor(rand() * 3)];
    loot[second] = (loot[second] ?? 0) + 2 + Math.floor(rand() * 4);
  }
  if (rand() < 0.25 + danger * 0.25) loot.greatBalls = 1;
  if (rand() < 0.15) loot.snacks = 1;
  return loot;
}
