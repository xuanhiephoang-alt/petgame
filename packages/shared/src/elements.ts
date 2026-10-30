import type { Element } from "./pals.ts";

/**
 * Each element beats the next one in this cycle and is weak to the previous:
 * fire > grass > earth > electric > water > fire.
 */
const CYCLE: Element[] = ["fire", "grass", "earth", "electric", "water"];

export const SUPER_EFFECTIVE = 1.5;
export const NOT_EFFECTIVE = 0.75;

export const ELEMENT_INFO: Record<Element, { name: string; icon: string }> = {
  grass: { name: "Cỏ", icon: "🌿" },
  fire: { name: "Lửa", icon: "🔥" },
  water: { name: "Nước", icon: "💧" },
  earth: { name: "Đất", icon: "🪨" },
  electric: { name: "Điện", icon: "⚡" },
};

/** Damage multiplier when `attacker` hits `defender`. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const a = CYCLE.indexOf(attacker), d = CYCLE.indexOf(defender);
  if ((a + 1) % CYCLE.length === d) return SUPER_EFFECTIVE;
  if ((d + 1) % CYCLE.length === a) return NOT_EFFECTIVE;
  return 1;
}

export type Effectiveness = "super" | "weak" | "normal";

export function effectiveness(multiplier: number): Effectiveness {
  return multiplier > 1 ? "super" : multiplier < 1 ? "weak" : "normal";
}

/** The element a species is strong against (for UI hints). */
export function strongAgainst(element: Element): Element {
  return CYCLE[(CYCLE.indexOf(element) + 1) % CYCLE.length];
}

/** Element colors for effects and the cast glow (0xRRGGBB). */
export const ELEMENT_COLOR: Record<Element, number> = {
  grass: 0x66bb6a,
  fire: 0xff7043,
  water: 0x4fc3f7,
  earth: 0xbcaaa4,
  electric: 0xffee58,
};
