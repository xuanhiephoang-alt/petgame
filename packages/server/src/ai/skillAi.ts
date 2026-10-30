import { isSupport, skillReach, type SkillDef } from "@petgame/shared";

/** What a pal knows about its situation when it thinks about using a skill. */
export interface SkillChoice {
  /** Skills it knows, in the order learned (the last is the strongest). */
  known: readonly SkillDef[];
  /** Whether a skill is off its cooldown. */
  ready: (skill: SkillDef) => boolean;
  /** How far its target is (pixels), when it is fighting one. */
  targetDistance?: number;
  /** Health share (0..1) of whoever on its side is hurt the most: its owner or itself. */
  hurt: number;
  /** Heal below this share of health. */
  healBelow: number;
  /** In a fight (or its owner is). */
  fighting: boolean;
}

/**
 * The skill to use now, if any: a heal when someone on its side is hurt, a
 * shield in a fight, otherwise the strongest ready skill that reaches the
 * target.
 */
export function chooseSkill(c: SkillChoice): SkillDef | undefined {
  const support = c.known.filter((s) => isSupport(s) && c.ready(s));
  const heal = support.find((s) => s.shape === "heal" && c.hurt < c.healBelow);
  if (heal) return heal;
  const shield = support.find((s) => s.shape === "shield" && c.fighting);
  if (shield) return shield;
  if (c.targetDistance === undefined) return undefined;
  return c.known.filter((s) => !isSupport(s) && c.ready(s) && c.targetDistance! <= skillReach(s)).at(-1);
}
