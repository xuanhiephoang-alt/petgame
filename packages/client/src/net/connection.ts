import { Client, type Room } from "@colyseus/sdk";
import { GameState, ROOM_NAME, type JoinOptions } from "@petgame/shared";

export type GameRoom = Room<any, GameState>;

function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  // A production build is served by the game server itself: same origin.
  if (import.meta.env.PROD) return location.origin;
  // Dev: Vite on :5173, game server on :2567 of the same host (works over LAN).
  const protocol = location.protocol === "https:" ? "https" : "http";
  return `${protocol}://${location.hostname}:2567`;
}

/**
 * Joins the room named in `?room=<id>` (an invite link), or creates a new
 * world when there is no invite.
 */
export async function connect(options: JoinOptions): Promise<GameRoom> {
  const client = new Client(serverUrl());
  const roomId = new URLSearchParams(location.search).get("room");
  if (roomId) return client.joinById(roomId, options, GameState);
  return client.create(ROOM_NAME, options, GameState);
}

export function inviteLink(roomId: string): string {
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}
