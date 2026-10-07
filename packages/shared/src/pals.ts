import palData from "./data/pals.json" with { type: "json" };

export type Element = "grass" | "fire" | "water" | "earth" | "electric";

export type Temperament = "passive" | "defensive" | "aggressive";
/** Where a pal lives: a terrain kind, or "lake" for the meadow lake shore. */
export type Biome = "meadow" | "lake" | "snow" | "desert" | "swamp" | "volcano" | "island" | "sea";
export type SpawnTime = "any" | "day" | "night";

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
  /** passive: never attacks; defensive: fights back when hit; aggressive: attacks anyone nearby. */
  temperament: Temperament;
  /** Damage per hit at level 1. */
  attack: number;
  /** Where and when this species appears in the wild. */
  spawn: { biomes: Biome[]; time: SpawnTime };
}

export const PAL_SPECIES: readonly PalSpecies[] = palData as PalSpecies[];

const byId = new Map(PAL_SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): PalSpecies {
  const species = byId.get(id);
  if (!species) throw new Error(`Unknown pal species: ${id}`);
  return species;
}

/**
 * Picks a species by spawnWeight among those that live in `biome` at this
 * time of day. `roll` is a number in [0, 1). Without a context, any species.
 */
export function pickSpecies(roll: number, where?: { biome: Biome; night: boolean }): PalSpecies | undefined {
  const pool = where
    ? PAL_SPECIES.filter(
        (s) =>
          s.spawn.biomes.includes(where.biome) &&
          (s.spawn.time === "any" || (s.spawn.time === "night") === where.night),
      )
    : PAL_SPECIES;
  const total = pool.reduce((sum, s) => sum + s.spawnWeight, 0);
  if (total <= 0) return undefined;
  let threshold = roll * total;
  for (const species of pool) {
    threshold -= species.spawnWeight;
    if (threshold < 0) return species;
  }
  return pool[pool.length - 1];
}
