/** Client -> server message types and payloads. */
export const ClientMessage = {
  Input: "input",
  Attack: "attack",
  Throw: "throw",
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
  playerId: string;
  palId: string;
  damage: number;
}

export interface JoinOptions {
  name?: string;
}
