import type { Element } from "./pals.ts";
import type { Biome } from "./pals.ts";
import { wornProtects, type Worn } from "./wardrobe.ts";

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
 * Warm clothes worn (the coat, the beanie) or a fire pal following you keep
 * the cold away; a sun hat worn (the nón lá, the safari hat) or a water pal
 * keeps you cool.
 */
export function protectedFrom(hazard: Hazard, worn: Pick<Worn, "outfit" | "hat">, companion?: Element): boolean {
  if (wornProtects(worn, hazard)) return true;
  return hazard === "cold" ? companion === "fire" : companion === "water";
}
