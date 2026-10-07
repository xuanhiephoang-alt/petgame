/**
 * Synced world state. Shared so the server encodes and the client decodes
 * with the same definitions (and the client gets typed state callbacks).
 */
import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema(
  {
    name: t.string(),
    x: t.number(),
    y: t.number(),
    color: t.number(),
    palCount: t.number(),
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

export const GameState = schema(
  {
    players: t.map(Player),
    pals: t.map(WildPal),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;
