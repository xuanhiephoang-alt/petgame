import type { Element } from "./pals.ts";
import type { Biome } from "./pals.ts";

/** Harsh climates hurt players every CLIMATE_TICK_MS unless they are protected. */
export const CLIMATE_TICK_MS = 2000;

export type Hazard = "cold" | "heat";

/** The climate hazard at a biome and time of day, with its damage per tick. */
export function climateHazard(biome: Biome, night: boolean): { hazard: Hazard; damage: number } | undefined {
  switch (biome) {
    case "snow":
      return { hazard: "cold", damage: night ? 4 : 2 };
    case "desert":
      // Scorching by day, chilly at night.
      return night ? { hazard: "cold", damage: 1 } : { hazard: "heat", damage: 2 };
    case "volcano":
      return { hazard: "heat", damage: 3 };
    default:
      return undefined;
  }
}

/**
 * A coat (or a fire pal following you) keeps the cold away; a hat (or a water
 * pal) keeps you cool.
 */
export function protectedFrom(hazard: Hazard, gear: { coat: number; hat: number }, companion?: Element): boolean {
  if (hazard === "cold") return gear.coat > 0 || companion === "fire";
  return gear.hat > 0 || companion === "water";
}
