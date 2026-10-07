/**
 * Synced world state. Shared so the server encodes and the client decodes
 * with the same definitions (and the client gets typed state callbacks).
 */
import { schema, t, type SchemaType } from "@colyseus/schema";

/** A pal a player has captured (their party). */
export const OwnedPal = schema(
  {
    id: t.string(),
    speciesId: t.string(),
    level: t.number(),
    xp: t.number(),
    /** "" (resting in the party), "follow" or "work". */
    assignment: t.string(),
  },
  "OwnedPal",
);
export type OwnedPal = SchemaType<typeof OwnedPal>;

export const Player = schema(
  {
    name: t.string(),
    x: t.number(),
    y: t.number(),
    color: t.number(),
    hp: t.number(),
    maxHp: t.number(),
    pals: t.array(OwnedPal),
    /** Id of the OwnedPal currently following the player ("" = none). */
    activePalId: t.string(),
    hasBase: t.boolean(),
    baseX: t.number(),
    baseY: t.number(),
    wood: t.number(),
    stone: t.number(),
    berries: t.number(),
    baseLevel: t.number(),
    greatBalls: t.number(),
    snacks: t.number(),
    /** Position in the quest chain (QUESTS index) and progress toward its goal. */
    questIndex: t.number(),
    questProgress: t.number(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

export const WildPal = schema(
  {
    speciesId: t.string(),
    x: t.number(),
    y: t.number(),
    hp: t.number(),
    maxHp: t.number(),
    level: t.number(),
    /** True while it is chasing someone (fighting back or hunting). */
    angry: t.boolean(),
    /** The world boss: much bigger, cannot be captured, can be defeated. */
    boss: t.boolean(),
  },
  "WildPal",
);
export type WildPal = SchemaType<typeof WildPal>;

/** A captured pal out in the world (following or working). Keyed by OwnedPal id. */
export const Companion = schema(
  {
    ownerId: t.string(),
    speciesId: t.string(),
    x: t.number(),
    y: t.number(),
    level: t.number(),
    /** "follow" or "work". */
    mode: t.string(),
    hp: t.number(),
    maxHp: t.number(),
  },
  "Companion",
);
export type Companion = SchemaType<typeof Companion>;

/** A closed treasure chest. Opened chests are removed and come back later. */
export const Chest = schema(
  {
    x: t.number(),
    y: t.number(),
  },
  "Chest",
);
export type Chest = SchemaType<typeof Chest>;

export const GameState = schema(
  {
    players: t.map(Player),
    pals: t.map(WildPal),
    companions: t.map(Companion),
    chests: t.map(Chest),
    /** Time of day in [0, 1): see daycycle.ts. */
    dayTime: t.number(),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;
