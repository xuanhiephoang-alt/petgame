import { PIXELS_PER_UNIT } from "./constants.ts";

/** The rocky hills boss: a giant Boulderhorn. */
export const BOSS = {
  speciesId: "boulderhorn",
  name: "Vua Đá Boulderhorn",
  level: 12,
  /** Max HP = species HP scaled by level, times this. */
  hpMultiplier: 4,
  /** Drawn this much bigger than a normal pal. */
  displayScale: 2.4,
  /** Ground stomp hits everyone this close (pixels). */
  stompRadius: 3.2 * PIXELS_PER_UNIT,
  stompDamage: 18,
  stompCooldownMs: 6000,
  /** It rears up this long before the stomp lands (ms): a red ring shows where; run out of it. */
  stompWindupMs: 1000,
  /** Regular bite (instead of the level-scaled wild damage), and its pace. */
  biteDamage: 14,
  biteCooldownMs: 1800,
  biteWindupMs: 600,
  /** Body radius for every move (spawn, wander, chase, way home), collisions and melee reach (pixels). */
  radius: 40,
  /** Calm and farther than this from home (pixels): it walks back. */
  leash: 8 * PIXELS_PER_UNIT,
  /** Back within this of home (pixels) it wanders again. */
  homeRadius: 4 * PIXELS_PER_UNIT,
  /**
   * A chase path longer than max(factor × straight, straight + extra), and than what it walks in one anger,
   * is not worth walking: it presses on straight instead (see ai/pathing.ts detourLimit).
   */
  chaseDetourFactor: 3,
  /** Pixels a chase detour may add to the straight distance (see chaseDetourFactor). */
  chaseDetourExtra: 5 * PIXELS_PER_UNIT,
  /** Its skills (skills.json) instead of the species' own, used at this level (gentler than its real one). */
  skills: ["horn_charge", "rock_spikes"],
  skillLevel: 4,
  /** Respawns this long after being defeated. */
  respawnMs: 4 * 60 * 1000,
  /** Every player who helped gets this. */
  reward: { wood: 15, stone: 25, berries: 10, greatBalls: 2 },
  /** XP for the following pal of everyone who helped (on top of `reward`). */
  xp: 250,
} as const;
