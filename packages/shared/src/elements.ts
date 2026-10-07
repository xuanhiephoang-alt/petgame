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

export type SkillId = "flame" | "vines" | "quake" | "thunder" | "rain";

export interface Skill {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
  cooldownMs: number;
}

/** One signature skill per element, used automatically by companions in a fight. */
export const SKILLS: Record<Element, Skill> = {
  fire: { id: "flame", name: "Phun lửa", icon: "🔥", description: "Gây sát thương gấp 2 lên mục tiêu và kẻ địch xung quanh", cooldownMs: 8000 },
  grass: { id: "vines", name: "Dây leo trói", icon: "🌿", description: "Gây sát thương gấp 1,5 và trói chân mục tiêu 3 giây", cooldownMs: 9000 },
  earth: { id: "quake", name: "Khiên đá", icon: "🛡️", description: "Chủ nhận ít hơn 50% sát thương trong 6 giây", cooldownMs: 12000 },
  electric: { id: "thunder", name: "Sấm sét", icon: "⚡", description: "Một đòn sét gây sát thương gấp 3", cooldownMs: 9000 },
  water: { id: "rain", name: "Mưa hồi máu", icon: "💧", description: "Hồi 25 máu cho chủ và chính nó", cooldownMs: 10000 },
};

/** Skill effect numbers, shared so tests and UI agree with the server. */
export const SKILL_NUMBERS = {
  flameMultiplier: 2,
  flameRadius: 70,
  vinesMultiplier: 1.5,
  vinesRootMs: 3000,
  quakeShieldMs: 6000,
  quakeDamageTaken: 0.5,
  thunderMultiplier: 3,
  rainHeal: 25,
} as const;
