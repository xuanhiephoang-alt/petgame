import { Client, ErrorCode, type Room } from "@colyseus/sdk";
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

/** Why joining a world failed, as the lobby explains it. */
export type JoinFailure = "closed" | "full" | "unreachable" | "failed";

/**
 * Sorts what the SDK threw when joining into what the lobby tells the player. A full world is told from a closed one by
 * the "is locked" text of Colyseus' `MatchMaker.joinById` (it locks a room at `maxClients`); both are error 522. A `code`
 * that is not a number (a failed `fetch` has none; Node gives "ECONNREFUSED") or 503 (server shutting down) means the
 * server could not be reached. Matches by shape, not `instanceof`, so plain objects work in tests.
 */
export function joinFailure(err: unknown): JoinFailure {
  if (typeof err !== "object" || err === null) return "failed";
  const code = (err as { code?: unknown }).code;
  if (typeof code !== "number" || code === 503) return "unreachable";
  if (code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
    const message = (err as { message?: unknown }).message;
    return typeof message === "string" && message.includes("is locked") ? "full" : "closed";
  }
  return "failed";
}

export function inviteLink(roomId: string): string {
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

/**
 * Where "Về sảnh" goes after the world was lost: this page again, which starts at the lobby. With friends still in
 * that world it carries `?room=<roomId>`, so the player walks back into it (the profile comes back by token); alone,
 * the world is closed, so there is no `room` and a new world opens on the same map. Other parameters are kept.
 */
export function lobbyUrl(roomId: string, withFriends: boolean): string {
  const url = new URL(location.href);
  if (withFriends) url.searchParams.set("room", roomId);
  else url.searchParams.delete("room");
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
