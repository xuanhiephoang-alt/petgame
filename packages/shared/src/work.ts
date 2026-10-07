import type { PalSpecies } from "./pals.ts";

export const RESOURCES = ["wood", "stone", "berries"] as const;
export type Resource = (typeof RESOURCES)[number];

export const RESOURCE_INFO: Record<Resource, { name: string; icon: string }> = {
  wood: { name: "Gỗ", icon: "🪵" },
  stone: { name: "Đá", icon: "🪨" },
  berries: { name: "Quả mọng", icon: "🫐" },
};

/** What each work skill produces at the base. */
const SKILL_OUTPUT: Record<string, Resource> = {
  gathering: "wood",
  kindling: "wood",
  mining: "stone",
  generating: "stone",
  planting: "berries",
  watering: "berries",
};

/** Most pals one player can have working at their base. */
export const MAX_WORKERS = 3;
/** Workers stand this far (pixels) from the base center. */
export const WORK_RADIUS = 56;
/** A base cannot be placed this close (pixels) to the shared campfire. */
export const BASE_MIN_CAMPFIRE_DISTANCE = 96;

/** The resource a species produces when working (its first work skill). */
export function workOutput(species: PalSpecies): Resource {
  for (const skill of species.workSkills) {
    const out = SKILL_OUTPUT[skill];
    if (out) return out;
  }
  return "wood";
}

/** Milliseconds per item: 10 s at level 1, 5% faster per level, never under 3 s. */
export function workIntervalMs(level: number): number {
  return Math.max(3000, Math.round(10_000 * Math.pow(0.95, level - 1)));
}

/** Where the n-th worker stands around a base (pixels). */
export function workSpot(base: { x: number; y: number }, index: number): { x: number; y: number } {
  const angle = (index / MAX_WORKERS) * Math.PI * 2 + Math.PI / 6;
  return { x: base.x + Math.cos(angle) * WORK_RADIUS, y: base.y + Math.sin(angle) * WORK_RADIUS };
}
