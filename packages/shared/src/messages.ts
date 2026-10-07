/** Client -> server message types and payloads. */
export const ClientMessage = {
  Input: "input",
  Attack: "attack",
  Throw: "throw",
  /** Choose which captured pal follows the player. */
  Summon: "summon",
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

/** Server -> client message types and payloads. */
export const ServerMessage = {
  CaptureResult: "captureResult",
  Hit: "hit",
} as const;

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
}
