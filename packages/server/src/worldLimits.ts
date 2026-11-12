import { isIPv4, isIPv6 } from "node:net";
import type { IncomingMessage } from "node:http";
import { matchMaker, ServerError, type Server } from "colyseus";
import { WORLD_LIMITS, WORLD_LIMIT_ERROR, WORLD_LIMIT_STATUS } from "@petgame/shared";

/** Which cap refused a world creation: the whole server's, or the one address's. */
export type WorldRefusal = "server" | "address";

export interface WorldLimits {
  maxWorlds: number;
  perAddress: number;
}

export interface WorldGuardSettings {
  limits: WorldLimits;
  /** Number of proxies in front of this server (PETGAME_TRUST_PROXY); 0 trusts no address header at all. */
  trustProxy: number;
}

/**
 * The address of the player: the socket's, or with `trustProxy` N proxies in front, the Nth entry from the end of
 * X-Forwarded-For (each proxy appends the address it saw; entries before that are whatever the client claimed).
 * Same rule as Express' numeric `trust proxy`. With 0 the header is ignored, so a client cannot fake its address.
 * Without a socket address there is no address (the header alone could be anything).
 */
export function clientAddress(
  remote: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: number,
): string | undefined {
  if (!remote) return undefined;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : (forwardedFor ?? "");
  const chain = header
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  chain.push(remote);
  return chain[Math.max(0, chain.length - 1 - trustProxy)];
}

/** Expands an IPv6 address into its 8 groups (numbers); embedded IPv4 tails become two groups. */
function ipv6Groups(address: string): number[] {
  let text = address;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (isIPv4(tail)) {
    const [a, b, c, d] = tail.split(".").map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = text.split("::");
  const front = head === "" ? [] : head.split(":");
  const back = rest === undefined || rest === "" ? [] : rest.split(":");
  const missing = rest === undefined ? 0 : 8 - front.length - back.length;
  return [...front, ...Array<string>(Math.max(0, missing)).fill("0"), ...back].map((g) => parseInt(g, 16));
}

/**
 * The key worlds are counted under: IPv4 as is (also when written as IPv4-mapped IPv6, dotted or hex), IPv6 as its /64
 * block (a host rotates addresses inside its block, and providers hand out at least a /64 per subscriber), "unknown"
 * when there is none.
 */
export function addressKey(address: string | undefined): string {
  if (!address) return "unknown";
  const text = address.split("%")[0];
  if (isIPv4(text)) return text;
  if (isIPv6(text)) {
    const g = ipv6Groups(text);
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
  }
  return address;
}

/**
 * Counts the worlds that are open and who made them, so creation can be refused over the caps. Pure: no timers, no clock.
 * While a creation is running its room has already called `opened` but not `settle`, so it counts twice for a few
 * milliseconds; with many simultaneous requests that is a little stricter, which is fine.
 */
export class WorldCensus {
  /** roomId -> address key of the HTTP request that created it (undefined: made without HTTP). */
  private open = new Map<string, string | undefined>();
  /** Creations admitted but not settled yet, per address key. */
  private pending = new Map<string, number>();

  /** A world is open (GameRoom.onCreate). */
  opened(roomId: string): void {
    if (!this.open.has(roomId)) this.open.set(roomId, undefined);
  }

  /** A world closed (GameRoom.onDispose); an unknown id does nothing. */
  closed(roomId: string): void {
    this.open.delete(roomId);
  }

  /** Checks both caps; on success counts one pending creation for `key` and returns undefined. */
  admit(key: string, limits: WorldLimits): WorldRefusal | undefined {
    if (this.total() >= limits.maxWorlds) return "server";
    if (this.countFor(key) >= limits.perAddress) return "address";
    this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
    return undefined;
  }

  /** The creation admitted for `key` finished: drop its pending count; the room it made (if still open) belongs to `key`. */
  settle(key: string, roomId: string | undefined): void {
    const left = (this.pending.get(key) ?? 0) - 1;
    if (left > 0) this.pending.set(key, left);
    else this.pending.delete(key);
    if (roomId !== undefined && this.open.has(roomId)) this.open.set(roomId, key);
  }

  /** Open worlds plus pending creations (what maxWorlds is checked against). */
  total(): number {
    let pending = 0;
    for (const n of this.pending.values()) pending += n;
    return this.open.size + pending;
  }

  /** Open worlds created from `key` plus its pending creations (what perAddress is checked against). */
  countFor(key: string): number {
    let count = this.pending.get(key) ?? 0;
    for (const owner of this.open.values()) if (owner === key) count++;
    return count;
  }
}

/** The census shared by GameRoom (reports open and closed worlds) and guardWorldCreation (checks it). */
export const worldCensus = new WorldCensus();

/** A decimal integer in [min, max] from env, else `fallback` (with a warning when the variable was set to something else). */
function intFromEnv(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (value >= min && value <= max) return value;
  console.warn(`World limits: ignoring ${name}=${JSON.stringify(raw)}; using ${fallback}`);
  return fallback;
}

/** Reads PETGAME_MAX_WORLDS and PETGAME_MAX_WORLDS_PER_ADDRESS; anything but a positive integer keeps the default. */
export function worldLimitsFromEnv(env: Record<string, string | undefined>): WorldLimits {
  return {
    maxWorlds: intFromEnv("PETGAME_MAX_WORLDS", env.PETGAME_MAX_WORLDS, WORLD_LIMITS.maxWorlds, 1, Number.MAX_SAFE_INTEGER),
    perAddress: intFromEnv(
      "PETGAME_MAX_WORLDS_PER_ADDRESS",
      env.PETGAME_MAX_WORLDS_PER_ADDRESS,
      WORLD_LIMITS.perAddress,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

/** Reads PETGAME_TRUST_PROXY (0-9, default 0); anything else is ignored with a warning. */
export function trustProxyFromEnv(env: Record<string, string | undefined>): number {
  return intFromEnv("PETGAME_TRUST_PROXY", env.PETGAME_TRUST_PROXY, 0, 0, 9);
}

let warnedForwarded = false;

/** Minimum time between two refusal log lines (a logging rhythm, not a balance number). */
const REFUSAL_LOG_MS = 60_000;

/** Rate-limits the refusal log: at most one line per REFUSAL_LOG_MS; refusals in between are counted into the next line. Pure. */
export class RefusalLog {
  private count = 0;
  private counts: Record<WorldRefusal, number> = { server: 0, address: 0 };
  /** Time of the first refusal not logged yet. */
  private firstAt = 0;
  /** Time of the last line; -Infinity so the very first refusal is logged at once. */
  private loggedAt = -Infinity;

  /** Counts one refusal at `now` (ms); returns the line to log, or undefined while the last line is younger than REFUSAL_LOG_MS. */
  note(refusal: WorldRefusal, now: number, openWorlds: number): string | undefined {
    if (this.count === 0) this.firstAt = now;
    this.count++;
    this.counts[refusal]++;
    if (now - this.loggedAt < REFUSAL_LOG_MS) return undefined;
    const n = this.count;
    const seconds = Math.round((now - this.firstAt) / 1000);
    const line =
      `World limits: refused ${n === 1 ? "1 world creation" : `${n} world creations in the last ${seconds} s`} ` +
      `(server ${this.counts.server}, address ${this.counts.address}); ${openWorlds} worlds open`;
    this.loggedAt = now;
    this.count = 0;
    this.counts.server = 0;
    this.counts.address = 0;
    return line;
  }
}

const refusalLog = new RefusalLog();

/** Logs refusals at most once a minute and never the address. */
function noteRefusal(refusal: WorldRefusal, census: WorldCensus): void {
  const line = refusalLog.note(refusal, Date.now(), census.total());
  if (line) console.warn(line);
}

/** Overwrites `x-real-ip` (the header Colyseus reads first) with the address computed from the socket; "unknown" when there is none. */
export function stampClientAddress(req: Pick<IncomingMessage, "headers" | "socket">, trustProxy: number): void {
  req.headers["x-real-ip"] = clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], trustProxy) ?? "unknown";
}

/**
 * Installs the world caps on a listening server and returns a function that undoes it (tests).
 *
 * Why here: Express never sees /matchmake/*, and `onAuth` runs for every method before the room exists. Colyseus calls
 * `matchMaker.controller.invokeMethod(method, ...)` for each request, which knows the method and may throw a ServerError
 * (its status and `{ code, error }` body go straight to the client), so `create` is checked there, before any room is made.
 *
 * The address comes from Colyseus' `authContext.ip`, which it reads from `x-real-ip` first, then `x-forwarded-for`:
 * both are client headers. So a `request` listener overwrites `x-real-ip` with the address computed from the socket
 * (see clientAddress). It must be prepended AFTER `listen()`: Colyseus prepends its own listener in `listen()`, and
 * that one copies the headers at once, so ours has to run first. `settings` is read on every request.
 *
 * `join` and `joinOrCreate` are switched off: the game never calls them, `joinOrCreate` makes worlds around the cap, and
 * both would put strangers into somebody's world. Only `create` is counted; joinById and reconnect are never refused.
 *
 * Fails closed: if `matchMaker.controller` no longer has the shape this relies on (a Colyseus upgrade), it throws before
 * installing anything, so the server does not start without its caps.
 */
export function guardWorldCreation(server: Server, settings: WorldGuardSettings, census: WorldCensus = worldCensus): () => void {
  const http = server.transport.server;
  if (!http) throw new Error("guardWorldCreation must be called after server.listen()");

  const controller = matchMaker.controller;
  if (
    typeof controller?.invokeMethod !== "function" ||
    !Array.isArray(controller.exposedMethods) ||
    !controller.exposedMethods.includes("create")
  ) {
    throw new Error(
      "guardWorldCreation: matchMaker.controller no longer has invokeMethod() and exposedMethods with \"create\" " +
        "(Colyseus changed?); the world caps cannot be installed. See worldLimits.ts.",
    );
  }

  const stamp = (req: IncomingMessage) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded !== undefined && settings.trustProxy === 0 && !warnedForwarded) {
      warnedForwarded = true;
      console.warn(
        "World limits: requests carry X-Forwarded-For but PETGAME_TRUST_PROXY is 0; every player may share the proxy's address. See docs/deploy.md.",
      );
    }
    stampClientAddress(req, settings.trustProxy);
  };
  http.prependListener("request", stamp);

  const exposedBefore = controller.exposedMethods;
  controller.exposedMethods = exposedBefore.filter((method) => method !== "join" && method !== "joinOrCreate");

  const original = controller.invokeMethod;
  controller.invokeMethod = async function (this: typeof controller, method, roomName, options, auth) {
    if (method !== "create") return original.call(this, method, roomName, options, auth);
    const key = addressKey(auth?.ip);
    const refusal = census.admit(key, settings.limits);
    if (refusal) {
      noteRefusal(refusal, census);
      throw new ServerError(WORLD_LIMIT_STATUS, WORLD_LIMIT_ERROR[refusal]);
    }
    let roomId: string | undefined;
    try {
      const reservation = await original.call(this, method, roomName, options, auth);
      roomId = reservation?.roomId;
      return reservation;
    } finally {
      census.settle(key, roomId);
    }
  };

  return () => {
    http.removeListener("request", stamp);
    controller.exposedMethods = exposedBefore;
    controller.invokeMethod = original;
  };
}
