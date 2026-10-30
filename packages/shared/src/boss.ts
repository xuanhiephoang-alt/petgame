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
  /** Body radius for collisions and melee reach (pixels). */
  radius: 40,
  /** Its skills (skills.json) instead of the species' own, used at this level (gentler than its real one). */
  skills: ["horn_charge", "rock_spikes"],
  skillLevel: 4,
  /** Respawns this long after being defeated. */
  respawnMs: 4 * 60 * 1000,
  /** Every player who helped gets this. */
  reward: { wood: 15, stone: 25, berries: 10, greatBalls: 2 },
} as const;
