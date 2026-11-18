import type { JoinFailure } from "../net/connection.ts";
import { JOIN_TEXT, LOBBY_TEXT } from "./strings.ts";

/** Lobby hint when the page was opened again at the world the player was in (same tab). */
export const RETURN_HINT = LOBBY_TEXT.returnHint;
/** Lobby hint when the page was opened from an invite link. */
export const INVITE_HINT = LOBBY_TEXT.inviteHint;

/** How the lobby was opened: fresh, from an invite link, or coming back to a world this tab or this device was in (with or without friends). */
export type Arrival = "new" | "invited" | "back" | "backAlone";

/** A world this device entered lately, and whether friends were there when it was last seen. */
export interface RecentWorld {
  room: string;
  friends: boolean;
}

/**
 * How many recent worlds the device remembers (`petgame:worlds`). About 20 solo sessions (each one over 60 s
 * apart is a new world), under 1 kB, and a world used again moves to the front, so a bookmark in use is never forgotten.
 */
export const RECENT_WORLDS_MAX = 20;

/** Reads the stored list of recent worlds. Takes any JSON value and never throws: anything unusable is dropped. */
export function recentWorlds(raw: unknown): RecentWorld[] {
  if (!Array.isArray(raw)) return [];
  const list: RecentWorld[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { room, friends } = item as { room?: unknown; friends?: unknown };
    if (typeof room !== "string" || room.length < 1 || room.length > 64 || typeof friends !== "boolean") continue;
    if (list.some((w) => w.room === room)) continue;
    list.push({ room, friends });
    if (list.length >= RECENT_WORLDS_MAX) break;
  }
  return list;
}

/** The list with `room` at the front (and only once), newest first, cut to `RECENT_WORLDS_MAX`. `list` is not changed. */
export function withRecentWorld(list: readonly RecentWorld[], room: string, friends: boolean): RecentWorld[] {
  return [{ room, friends }, ...list.filter((w) => w.room !== room)].slice(0, RECENT_WORLDS_MAX);
}

/**
 * Sorts how the page was opened. `invited` is `?room=` from the address; `lastRoom` and `lastFriends` are what this
 * tab remembered (`petgame:room`, `petgame:friends`); `recent` is what this device remembers. The tab wins over the
 * device. A tab from before T49 has no `lastFriends`: it only wrote `room` when friends were there, so that counts as
 * friends. A world in neither is an invite.
 */
export function arrival(
  invited: string | null,
  lastRoom: string | null | undefined,
  lastFriends: string | null | undefined,
  recent: readonly RecentWorld[] = [],
): Arrival {
  if (!invited) return "new";
  if (lastRoom === invited) return lastFriends === "0" ? "backAlone" : "back";
  const known = recent.find((w) => w.room === invited);
  if (known) return known.friends ? "back" : "backAlone";
  return "invited";
}

/** The lobby's hint line for an arrival; coming back alone needs none. */
export function arrivalHint(a: Arrival): string {
  return a === "back" ? RETURN_HINT : a === "invited" ? INVITE_HINT : "";
}

/** What the lobby's join card says and offers. `primary` gets the focus and comes first. */
export interface JoinCard {
  title: string;
  detail: string;
  retry: boolean;
  newWorld: boolean;
  /** Reload the page (the game could not open: only a reload helps). */
  reload: boolean;
  primary: "retry" | "newWorld" | "reload";
}

/** The card shown when joining failed; `returning` is whether the player came back to a world they were playing in. */
export function joinCard(failure: JoinFailure, returning: boolean): JoinCard {
  switch (failure) {
    case "closed":
      return {
        title: JOIN_TEXT.closed.title,
        detail: returning ? JOIN_TEXT.closed.detailReturning : JOIN_TEXT.closed.detailInvited,
        retry: false,
        newWorld: true,
        reload: false,
        primary: "newWorld",
      };
    case "full":
      return { ...JOIN_TEXT.full, retry: true, newWorld: true, reload: false, primary: "retry" };
    case "unreachable":
      return { ...JOIN_TEXT.unreachable, retry: true, newWorld: false, reload: false, primary: "retry" };
    case "busy":
      return { ...JOIN_TEXT.busy, retry: true, newWorld: false, reload: false, primary: "retry" };
    case "tooMany":
      return { ...JOIN_TEXT.tooMany, retry: true, newWorld: false, reload: false, primary: "retry" };
    case "failed":
      return { ...JOIN_TEXT.failed, retry: true, newWorld: false, reload: false, primary: "retry" };
  }
}

/** Why the game could not open after the room was joined: a part of the game did not download, or the browser failed to run it. */
export type StartFailure = "download" | "broken";

/**
 * Errors of a part of the game that could not be fetched (lost network, or an old tab whose hashed files are gone after a deploy).
 * Chrome: "Failed to fetch dynamically imported module: ..."; Firefox: "error loading dynamically imported module: ...";
 * Safari: "Importing a module script failed." or "Load failed".
 */
const DOWNLOAD_ERROR = /dynamically imported module|module script failed|Failed to fetch|NetworkError|Load failed/i;

/** Sorts an error thrown while opening the game by its shape (not `instanceof`: it may come from another realm). */
export function startFailure(err: unknown): StartFailure {
  const message = typeof err === "object" && err !== null ? (err as { message?: unknown }).message : undefined;
  return typeof message === "string" && DOWNLOAD_ERROR.test(message) ? "download" : "broken";
}

/** The card shown when the room was joined but the game could not open: one button, Tải lại. */
export function startCard(failure: StartFailure): JoinCard {
  const card = { retry: false, newWorld: false, reload: true, primary: "reload" } as const;
  return { ...card, ...JOIN_TEXT[failure] };
}
