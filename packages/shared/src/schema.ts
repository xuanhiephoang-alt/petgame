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
    pals: t.array(OwnedPal),
    /** Id of the OwnedPal currently following the player ("" = none). */
    activePalId: t.string(),
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
  },
  "WildPal",
);
export type WildPal = SchemaType<typeof WildPal>;

/** A captured pal walking in the world next to its owner. Keyed by OwnedPal id. */
export const Companion = schema(
  {
    ownerId: t.string(),
    speciesId: t.string(),
    x: t.number(),
    y: t.number(),
  },
  "Companion",
);
export type Companion = SchemaType<typeof Companion>;

export const GameState = schema(
  {
    players: t.map(Player),
    pals: t.map(WildPal),
    companions: t.map(Companion),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;
