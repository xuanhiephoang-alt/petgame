import type { Look, WearSlot } from "./wardrobe.ts";
import type { Resource } from "./work.ts";

/** Client -> server message types and payloads. */
export const ClientMessage = {
  Input: "input",
  Attack: "attack",
  Throw: "throw",
  /** Choose which captured pal follows the player. */
  Summon: "summon",
  /** Send a pal to work at the base, or call it back. */
  Assign: "assign",
  /** Place (or move) the player's base at their position. */
  PlaceBase: "placeBase",
  /** Craft a recipe at the player's camp. */
  Craft: "craft",
  /** Feed a snack to one of the player's pals. */
  Feed: "feed",
  /** Eat one berry to heal. */
  Eat: "eat",
  /** Change hairstyle, hair color or skin tone (free, any time). */
  SetLook: "setLook",
  /** Put on clothes, a hat or a weapon from the wardrobe ("" takes the hat or weapon off). */
  Equip: "equip",
  /** Dash (dodge) this way. */
  Dash: "dash",
  /** Order the following pal to use one of its skills (keys 1-3). */
  PalSkill: "palSkill",
  /** Let the following pal use its skills on its own, or only when ordered. */
  PalAuto: "palAuto",
} as const;

export interface PalSkillMessage {
  /** SKILL_DEFS id, one the following pal knows. */
  skill: string;
}

export interface PalAutoMessage {
  on: boolean;
}

export interface DashMessage {
  /** Direction, each axis in -1..1 (normalized by the server). */
  x: number;
  y: number;
}

export type SetLookMessage = Partial<Look>;

export interface EquipMessage {
  slot: WearSlot;
  id: string;
}

export interface InputMessage {
  /** Movement direction, each axis in -1..1. */
  x: number;
  y: number;
}

export interface ThrowMessage {
  /** Id of the wild pal the ball is thrown at. */
  palId: string;
  /** "great" uses a crafted great ball if the player has one. */
  ball?: "basic" | "great";
}

export interface CraftMessage {
  recipeId: string;
}

export interface FeedMessage {
  palId: string;
}

export interface SummonMessage {
  /** OwnedPal id from the player's party, or "" to send the companion back. */
  palId: string;
}

export interface AssignMessage {
  palId: string;
  /** "work" sends the pal to the base, "" rests it in the party. */
  assignment: "work" | "";
}

/** Server -> client message types and payloads. */
export const ServerMessage = {
  CaptureResult: "captureResult",
  Hit: "hit",
  LevelUp: "levelUp",
  Produced: "produced",
  /** Short text for one player (e.g. why an action was refused). */
  Notice: "notice",
  /** A wild pal hurt a player or a companion. */
  Damage: "damage",
  /** A player or companion was knocked out. */
  Fainted: "fainted",
  /** A pal (wild or companion) started a skill: it winds up, then the skill flies and lands. */
  SkillCast: "skillCast",
  /** A heal skill gave someone health back. */
  Healed: "healed",
  /** The boss stomped the ground. */
  BossStomp: "bossStomp",
  /** The boss was defeated. */
  BossDefeated: "bossDefeated",
  /** Someone opened a treasure chest. */
  ChestOpened: "chestOpened",
  /** A player finished a quest. */
  QuestDone: "questDone",
  /** A player picked berries from a fruit bush. */
  Harvested: "harvested",
  /** A player chopped a tree or mined a rock. */
  Gathered: "gathered",
  /** A wild pal finished its wind-up and bit (or missed). */
  Lunge: "lunge",
  /** A player knocked out a dizzy wild pal. */
  Defeated: "defeated",
  /** A player dashed. */
  Dashed: "dashed",
} as const;

export interface GatheredMessage {
  playerId: string;
  /** The tree or rock (its layout prop index, see gathering.ts). */
  node: number;
  resource: Resource;
  amount: number;
  /** Used up: it stands bare until it grows back. */
  depleted: boolean;
}

export interface LungeMessage {
  palId: string;
  targetType: "player" | "companion";
  targetId: string;
  /** The target stepped out of reach or dashed through it. */
  dodged: boolean;
  /** A skill it dashed through (SKILL_DEFS id), not a bite. */
  skill?: string;
}

export interface DefeatedMessage {
  palId: string;
  playerId: string;
  /** What it left behind (resource or item -> amount). */
  loot: Record<string, number>;
}

export interface DashedMessage {
  playerId: string;
  x: number;
  y: number;
}

export interface ChestOpenedMessage {
  chestId: string;
  playerId: string;
  /** Reward (resource/item -> amount). */
  loot: Record<string, number>;
  /** Clothes or a weapon found inside (WEARABLES id). */
  wear?: string;
}

export interface HarvestedMessage {
  fruitId: string;
  playerId: string;
  amount: number;
}

export interface QuestDoneMessage {
  playerId: string;
  questId: string;
}

export interface SkillCastMessage {
  /** Wild pal id, or companion (OwnedPal) id. */
  casterId: string;
  caster: "wild" | "companion";
  /** SKILL_DEFS id. */
  skill: string;
  /** The caster's level (the skill's strength). */
  level: number;
  /** Where it is cast from and where it is aimed (pixels). */
  from: { x: number; y: number };
  at: { x: number; y: number };
  /** Lands wherever its target is by then (companions' skills), not where it was aimed (wild pals' skills: step away to dodge). */
  homing: boolean;
  targetId?: string;
  targetType?: "pal" | "player" | "companion";
  /** Wind-up, then the time until it lands (ms). */
  castMs: number;
  travelMs: number;
}

export interface HealedMessage {
  targetType: "player" | "companion" | "pal";
  targetId: string;
  amount: number;
}

export interface BossStompMessage {
  bossId: string;
}

export interface BossDefeatedMessage {
  bossId: string;
  /** Session ids of everyone who helped (they all get the reward). */
  winners: string[];
}

export interface DamageMessage {
  targetType: "player" | "companion";
  /** Session id (player) or OwnedPal id (companion). */
  targetId: string;
  /** Wild pal that attacked ("" for the climate). */
  attackerId: string;
  amount: number;
  /** Set when cold or heat did the damage. */
  cause?: "cold" | "heat";
  /** How far (pixels) the hit pushed the target away from its attacker (or from `pushFrom`, where a skill landed). */
  push?: number;
  pushFrom?: { x: number; y: number };
  /** The skill that did it (SKILL_DEFS id), when not a bite. */
  skill?: string;
}

export interface FaintedMessage {
  targetType: "player" | "companion";
  targetId: string;
}

export interface LevelUpMessage {
  playerId: string;
  palId: string;
  speciesId: string;
  level: number;
}

export interface ProducedMessage {
  playerId: string;
  /** Companion (OwnedPal id) that produced the item. */
  palId: string;
  resource: string;
  amount: number;
}

export interface NoticeMessage {
  text: string;
}

export interface CaptureResultMessage {
  playerId: string;
  palId: string;
  speciesId: string;
  success: boolean;
  chance: number;
  /** How many times the ball wobbles before it clicks shut or the pal breaks out (captureShakes). */
  shakes: number;
}

export interface HitMessage {
  /** Player who hit, or the owner of the companion that hit. */
  playerId: string;
  palId: string;
  damage: number;
  /** Set when a companion (OwnedPal id) landed the hit instead of the player. */
  companionId?: string;
  /** Element matchup of a companion hit. */
  effect?: "super" | "weak" | "normal";
  /** A player's critical hit. */
  crit?: boolean;
  /** A companion's skill (SKILL_DEFS id). */
  skill?: string;
}

export interface JoinOptions {
  name?: string;
  /**
   * Random per-device id kept in localStorage. The server saves the player's
   * pals, base and resources under it so they come back next time.
   */
  token?: string;
  /** The look picked before joining (hairstyle, hair color, skin tone). */
  look?: Look;
}
