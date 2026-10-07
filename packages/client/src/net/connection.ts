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
  options = { ...options, token: options.token ?? deviceToken() };
  const roomId = new URLSearchParams(location.search).get("room");
  if (roomId) return client.joinById(roomId, options, GameState);
  return client.create(ROOM_NAME, options, GameState);
}

export function inviteLink(roomId: string): string {
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

/**
 * Random id kept on this device; the server saves pals, base and resources
 * under it. Without storage (private mode) progress is simply not saved.
 */
function deviceToken(): string | undefined {
  try {
    let token = localStorage.getItem("petgame:token");
    if (!token) {
      token = randomToken();
      localStorage.setItem("petgame:token", token);
    }
    return token;
  } catch {
    return undefined;
  }
}

/**
 * crypto.randomUUID only exists on https/localhost pages; iPhone Safari on a
 * LAN address (http://192.168.x.x) lacks it, but getRandomValues works anywhere.
 */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
