import wearableData from "./data/wearables.json" with { type: "json" };
import { ATTACK_COOLDOWN_MS, ATTACK_DAMAGE, ATTACK_RANGE } from "./constants.ts";
import type { Hazard } from "./climate.ts";

/**
 * How explorers look and what they wear: a hairstyle, hair color and skin
 * tone chosen freely, and clothes, hats and weapons owned in the wardrobe
 * (some from the start, the rest crafted, found in chests or won from the
 * boss). The client draws each from AI-drawn parts (art/doll.ts).
 */
export type WearSlot = "outfit" | "hat" | "weapon";

export interface WeaponStats {
  damage: number;
  /** Reach of a swing, or how far a shot flies (pixels). */
  range: number;
  cooldownMs: number;
  /** Shoots (a pebble, an arrow, a spark) instead of swinging. */
  ranged?: boolean;
}

export interface Wearable {
  id: string;
  slot: WearSlot;
  name: string;
  icon: string;
  description: string;
  /** Its picture's name when it differs from the id (two items share "wizard"). */
  art?: string;
  /** Everyone has it, crafted at the camp, found in chests, or the boss's reward. */
  from: "starter" | "craft" | "chest" | "boss";
  /** Keeps the cold or the heat away while worn. */
  protects?: Hazard;
  /** Share of the damage it stops while worn (0..1). */
  defense?: number;
  weapon?: WeaponStats;
}

export const WEARABLES: readonly Wearable[] = wearableData as Wearable[];

export function getWearable(id: string): Wearable | undefined {
  return WEARABLES.find((w) => w.id === id);
}

/** Owned by every explorer from the start. */
export const STARTER_WARDROBE: readonly string[] = WEARABLES.filter((w) => w.from === "starter").map((w) => w.id);

/** What an explorer has on: an outfit always, a hat and a weapon or "" for none. */
export interface Worn {
  outfit: string;
  hat: string;
  weapon: string;
}

export const DEFAULT_WORN: Worn = { outfit: "explorer", hat: "", weapon: "" };

/** Whether an item can go in a slot from this wardrobe ("" takes the hat or weapon off). */
export function canWear(wardrobe: readonly string[], slot: WearSlot, id: string): boolean {
  if (id === "") return slot !== "outfit";
  const item = getWearable(id);
  return !!item && item.slot === slot && wardrobe.includes(id);
}

/** Bare hands: the plain attack. */
export const FISTS: WeaponStats = { damage: ATTACK_DAMAGE, range: ATTACK_RANGE, cooldownMs: ATTACK_COOLDOWN_MS };

/** The stats of a held weapon (bare hands for "" or an unknown id). */
export function weaponStats(id: string): WeaponStats {
  return getWearable(id)?.weapon ?? FISTS;
}

/** Most of the damage clothes can stop together. */
export const MAX_DEFENSE = 0.5;

/** Share of incoming damage the outfit and hat stop. */
export function defenseOf(worn: Pick<Worn, "outfit" | "hat">): number {
  const total = (getWearable(worn.outfit)?.defense ?? 0) + (getWearable(worn.hat)?.defense ?? 0);
  return Math.min(MAX_DEFENSE, total);
}

/** Whether what is worn keeps a hazard away (the coat or the beanie the cold, the nón lá or the safari hat the heat). */
export function wornProtects(worn: Pick<Worn, "outfit" | "hat">, hazard: Hazard): boolean {
  return getWearable(worn.outfit)?.protects === hazard || getWearable(worn.hat)?.protects === hazard;
}

/** A random item of a kind ("chest" or "boss") not in the wardrobe yet, or undefined when all are owned. */
export function rollWearable(rand: () => number, from: Wearable["from"], wardrobe: readonly string[]): string | undefined {
  const left = WEARABLES.filter((w) => w.from === from && !wardrobe.includes(w.id));
  return left.length ? left[Math.floor(rand() * left.length)].id : undefined;
}

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------

export const HAIR_STYLES = ["messy", "long", "twintails", "spiky", "ponytail", "bob", "bun", "curly"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_STYLE_NAMES: Record<HairStyle, string> = {
  messy: "Tóc rối",
  long: "Tóc dài",
  twintails: "Hai bím",
  spiky: "Tóc dựng",
  ponytail: "Đuôi ngựa",
  bob: "Tóc ngắn",
  bun: "Búi tóc",
  curly: "Tóc xoăn",
};

/** Hair colors: brown, black, blond, red, silver, pink, blue, green. */
export const HAIR_COLORS = [0x784d2e, 0x2b2933, 0xf2cc6b, 0xc75433, 0xdbdbe6, 0xf58fb8, 0x5285e0, 0x6bb873] as const;
/** Skin tones, the first as drawn. */
export const SKIN_TONES = [0xfdcfb6, 0xffdec7, 0xdba37a, 0xa3704f, 0x704a36] as const;

export interface Look {
  hair: HairStyle;
  /** Index into HAIR_COLORS. */
  hairColor: number;
  /** Index into SKIN_TONES. */
  skin: number;
}

/** A different look for each player slot until they pick their own. */
export const DEFAULT_LOOKS: readonly Look[] = [
  { hair: "messy", hairColor: 0, skin: 0 },
  { hair: "ponytail", hairColor: 1, skin: 1 },
  { hair: "spiky", hairColor: 2, skin: 0 },
  { hair: "bob", hairColor: 3, skin: 2 },
  { hair: "curly", hairColor: 1, skin: 3 },
];

/** A valid look from untrusted data, with `fallback` for whatever is missing or wrong. */
export function sanitizeLook(raw: unknown, fallback: Look): Look {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const index = (v: unknown, size: number, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < size ? (v as number) : d);
  return {
    hair: HAIR_STYLES.includes(r.hair as HairStyle) ? (r.hair as HairStyle) : fallback.hair,
    hairColor: index(r.hairColor, HAIR_COLORS.length, fallback.hairColor),
    skin: index(r.skin, SKIN_TONES.length, fallback.skin),
  };
}
