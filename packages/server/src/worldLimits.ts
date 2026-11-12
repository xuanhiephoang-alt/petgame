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
 */
export function clientAddress(
  remote: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: number,
): string | undefined {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : (forwardedFor ?? "");
  const chain = header
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  if (remote) chain.push(remote);
  if (chain.length === 0) return undefined;
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
 * The key worlds are counted under: IPv4 as is (also when written as IPv4-mapped IPv6), IPv6 as its /64 block (a host
 * rotates addresses inside its block, and providers hand out at least a /64 per subscriber), "unknown" when there is none.
 */
export function addressKey(address: string | undefined): string {
  if (!address) return "unknown";
  let text = address.split("%")[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(text);
  if (mapped) text = mapped[1];
  if (isIPv4(text)) return text;
  if (isIPv6(text)) return `${ipv6Groups(text).slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
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

/** A positive decimal integer from env, else `fallback` (with a warning when the variable was set to something else). */
function positiveInt(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (value >= min && value <= max) return value;
  console.warn(`World limits: ignoring ${name}=${JSON.stringify(raw)}; using ${fallback}`);
  return fallback;
}

/** Reads PETGAME_MAX_WORLDS and PETGAME_MAX_WORLDS_PER_ADDRESS; anything but a positive integer keeps the default. */
export function worldLimitsFromEnv(env: Record<string, string | undefined>): WorldLimits {
  return {
    maxWorlds: positiveInt("PETGAME_MAX_WORLDS", env.PETGAME_MAX_WORLDS, WORLD_LIMITS.maxWorlds, 1, Number.MAX_SAFE_INTEGER),
    perAddress: positiveInt(
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
  return positiveInt("PETGAME_TRUST_PROXY", env.PETGAME_TRUST_PROXY, 0, 0, 9);
}

let warnedForwarded = false;
let refusedSince = 0;
let refusedLogAt = 0;
const refusedCounts: Record<WorldRefusal, number> = { server: 0, address: 0 };

/** Logs refusals at most once a minute and never the address: the first one at once, the rest counted into the next line. */
function noteRefusal(refusal: WorldRefusal, census: WorldCensus): void {
  refusedCounts[refusal]++;
  refusedSince++;
  const now = Date.now();
  if (now - refusedLogAt < 60_000) return;
  console.warn(
    `World limits: refused ${refusedSince} world creation${refusedSince === 1 ? "" : "s"} in the last minute ` +
      `(server ${refusedCounts.server}, address ${refusedCounts.address}); ${census.total()} worlds open`,
  );
  refusedLogAt = now;
  refusedSince = 0;
  refusedCounts.server = 0;
  refusedCounts.address = 0;
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
 */
export function guardWorldCreation(server: Server, settings: WorldGuardSettings, census: WorldCensus = worldCensus): () => void {
  const http = server.transport.server;
  if (!http) throw new Error("guardWorldCreation must be called after server.listen()");

  const stamp = (req: IncomingMessage) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded !== undefined && settings.trustProxy === 0 && !warnedForwarded) {
      warnedForwarded = true;
      console.warn(
        "World limits: requests carry X-Forwarded-For but PETGAME_TRUST_PROXY is 0; every player may share the proxy's address. See docs/deploy.md.",
      );
    }
    const address = clientAddress(req.socket.remoteAddress, forwarded, settings.trustProxy);
    if (address === undefined) delete req.headers["x-real-ip"];
    else req.headers["x-real-ip"] = address;
  };
  http.prependListener("request", stamp);

  const controller = matchMaker.controller;
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
