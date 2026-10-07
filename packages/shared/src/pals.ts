import palData from "./data/pals.json" with { type: "json" };

export type Element = "grass" | "fire" | "water" | "earth" | "electric";

export interface PalSpecies {
  id: string;
  name: string;
  element: Element;
  maxHp: number;
  /** Wander speed in pixels per second. */
  speed: number;
  /** Base capture probability at full HP, 0..1. */
  catchRate: number;
  /** Placeholder render color until real sprites exist. */
  color: string;
  /** Placeholder render radius in pixels. */
  size: number;
  /** Relative spawn frequency. */
  spawnWeight: number;
  workSkills: string[];
}

export const PAL_SPECIES: readonly PalSpecies[] = palData as PalSpecies[];

const byId = new Map(PAL_SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): PalSpecies {
  const species = byId.get(id);
  if (!species) throw new Error(`Unknown pal species: ${id}`);
  return species;
}

/** Picks a species by spawnWeight. `roll` is a number in [0, 1). */
export function pickSpecies(roll: number): PalSpecies {
  const total = PAL_SPECIES.reduce((sum, s) => sum + s.spawnWeight, 0);
  let threshold = roll * total;
  for (const species of PAL_SPECIES) {
    threshold -= species.spawnWeight;
    if (threshold < 0) return species;
  }
  return PAL_SPECIES[PAL_SPECIES.length - 1];
}
