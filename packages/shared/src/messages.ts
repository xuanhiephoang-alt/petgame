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
} as const;

export interface InputMessage {
  /** Movement direction, each axis in -1..1. */
  x: number;
  y: number;
}

export interface ThrowMessage {
  /** Id of the wild pal the ball is thrown at. */
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
} as const;

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
