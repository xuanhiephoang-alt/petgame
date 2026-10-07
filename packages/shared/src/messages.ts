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
} as const;

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
} as const;

export interface DamageMessage {
  targetType: "player" | "companion";
  /** Session id (player) or OwnedPal id (companion). */
  targetId: string;
  /** Wild pal that attacked. */
  attackerId: string;
  amount: number;
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
}

export interface HitMessage {
  /** Player who hit, or the owner of the companion that hit. */
  playerId: string;
  palId: string;
  damage: number;
  /** Set when a companion (OwnedPal id) landed the hit instead of the player. */
  companionId?: string;
}

export interface JoinOptions {
  name?: string;
  /**
   * Random per-device id kept in localStorage. The server saves the player's
   * pals, base and resources under it so they come back next time.
   */
  token?: string;
}
