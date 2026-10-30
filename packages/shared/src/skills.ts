import skillData from "./data/skills.json" with { type: "json" };
import type { Vec2 } from "./movement.ts";
import type { Element, PalSpecies } from "./pals.ts";

/**
 * Pal skills: every species learns three (skills in pals.json), at levels
 * SKILL_LEVELS, and uses them in fights on its own: companions on the wild
 * pals their owner fights, wild pals on players and companions. A skill
 * winds up (castMs), then flies or grows for a moment (skillTravelMs) and
 * lands on an area (inSkillArea); its damage (or healing) grows with the
 * caster's level (skillPower). Each skill has its own animation (client
 * skillfx.ts).
 *
 * Shapes: "projectile" flies straight (speed), "lob" flies in an arc,
 * "beam" reaches its target at once (durationMs to land), "strike" falls
 * from the sky and "zone" grows out of the ground where it is aimed
 * (durationMs), "nova" bursts out around the caster, "cone" fans out in
 * front of it, "wave" rolls forward along a line (speed), "melee" hits next
 * to it (a "dash" lunges first), "heal" and "shield" help the caster's side.
 */
export type SkillShape = "projectile" | "lob" | "beam" | "strike" | "zone" | "nova" | "cone" | "wave" | "melee" | "heal" | "shield";

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  element: Element;
  shape: SkillShape;
  description: string;
  /** Damage (or, for "heal", health) at level 1, before element matchups and armor. */
  power: number;
  castMs: number;
  cooldownMs: number;
  /** How far it can be aimed (pixels); a cone's or a wave's length; a melee skill's reach. */
  range?: number;
  /** What it covers where it lands (pixels): an impact's radius, a nova's, a wave's half-width. */
  radius?: number;
  /** Projectiles, lobs and waves (px/s). */
  speed?: number;
  /** A cone's width (degrees). */
  angle?: number;
  /** Time (ms) from the end of the wind-up until it lands, for shapes that do not travel at a speed. */
  durationMs?: number;
  /** Pushes whoever it hits away (pixels). */
  knockback?: number;
  /** Holds a wild pal it hits in place (ms). */
  root?: number;
  /** "shield": the owner (or a wild caster itself) takes half damage this long (ms). */
  shieldMs?: number;
  /** Jumps to this many more enemies near the one it hit, each at CHAIN_FALLOFF. */
  chain?: number;
  /** "melee": lunges this far toward the target before it hits (pixels). */
  dash?: number;
}

export const SKILL_DEFS: readonly SkillDef[] = skillData as SkillDef[];

const byId = new Map(SKILL_DEFS.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef {
  const skill = byId.get(id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

/** The levels a species learns its first, second and third skill at. */
export const SKILL_LEVELS = [1, 7, 15] as const;
/** Each level above 1 makes a skill this much stronger (+12%). */
export const SKILL_LEVEL_SCALING = 0.12;
/** A chained hit does this much of the one before. */
export const CHAIN_FALLOFF = 0.7;
/** How far (pixels) a chain can jump from one enemy to the next. */
export const CHAIN_RANGE = 100;
/** After any skill a companion waits this long (ms) before the next; wild pals longer, and their cooldowns are longer too. */
export const COMPANION_SKILL_GAP_MS = 1500;
export const WILD_SKILL_GAP_MS = 2500;
export const WILD_COOLDOWN_FACTOR = 1.3;
/** A shielded owner (or wild caster) takes this share of the damage. */
export const SHIELD_DAMAGE_TAKEN = 0.5;

/** Damage (or healing) of a skill used by a pal of this level. */
export function skillPower(skill: SkillDef, level: number): number {
  return Math.round(skill.power * (1 + SKILL_LEVEL_SCALING * (Math.max(1, level) - 1)));
}

/** A species' skills with the level each is learned at. */
export function learnset(species: PalSpecies): { skill: SkillDef; level: number }[] {
  return species.skills.map((id, i) => ({ skill: getSkill(id), level: SKILL_LEVELS[i] ?? SKILL_LEVELS[SKILL_LEVELS.length - 1] }));
}

/** The skills a pal of this species and level knows. */
export function knownSkills(species: PalSpecies, level: number): SkillDef[] {
  return learnset(species).filter((l) => level >= l.level).map((l) => l.skill);
}

/** The skill learned exactly at this level, if any (to announce it). */
export function newSkillAt(species: PalSpecies, level: number): SkillDef | undefined {
  return learnset(species).find((l) => l.level === level)?.skill;
}

/** Skills that help instead of hurting. */
export function isSupport(skill: SkillDef): boolean {
  return skill.shape === "heal" || skill.shape === "shield";
}

/** How far from its caster (pixels) a target can be for this skill to reach it. */
export function skillReach(skill: SkillDef): number {
  if (skill.shape === "nova") return (skill.radius ?? 0) * 0.85;
  if (skill.shape === "melee") return skill.range ?? 48;
  return skill.range ?? 0;
}

/** Time (ms) from the end of the wind-up until it lands, `distance` pixels from its caster. */
export function skillTravelMs(skill: SkillDef, distance: number): number {
  if (skill.speed && (skill.shape === "projectile" || skill.shape === "lob" || skill.shape === "wave")) {
    return Math.round((Math.max(0, distance) / skill.speed) * 1000);
  }
  return skill.durationMs ?? 0;
}

/**
 * Whether a body at `p` (of radius `r`) is caught where the skill lands:
 * around `aim` for what is aimed at a spot, around its caster at `from` for
 * a nova, in the fan or along the line from `from` toward `aim` for a cone
 * or a wave.
 */
export function inSkillArea(skill: SkillDef, from: Vec2, aim: Vec2, p: Vec2, r = 0): boolean {
  const radius = skill.radius ?? 0;
  switch (skill.shape) {
    case "nova":
      return Math.hypot(p.x - from.x, p.y - from.y) <= radius + r;
    case "cone": {
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d > (skill.range ?? 0) + r) return false;
      if (d <= r) return true;
      const toward = Math.atan2(aim.y - from.y, aim.x - from.x);
      const off = Math.abs(normalizeAngle(Math.atan2(p.y - from.y, p.x - from.x) - toward));
      // A body near the edge counts if any of it is inside.
      return off <= ((skill.angle ?? 60) * Math.PI) / 360 + Math.asin(Math.min(1, r / d));
    }
    case "wave": {
      const dx = aim.x - from.x, dy = aim.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const along = Math.max(0, Math.min(skill.range ?? len, (p.x - from.x) * ux + (p.y - from.y) * uy));
      return Math.hypot(p.x - (from.x + ux * along), p.y - (from.y + uy * along)) <= radius + r;
    }
    case "heal":
    case "shield":
      return false;
    default:
      return Math.hypot(p.x - aim.x, p.y - aim.y) <= radius + r;
  }
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
