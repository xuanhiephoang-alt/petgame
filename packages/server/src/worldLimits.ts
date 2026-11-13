import { isIPv4, isIPv6 } from "node:net";
import type { IncomingMessage } from "node:http";
import { matchMaker, ServerError, type Server } from "colyseus";
import { WORLD_LIMITS, WORLD_LIMIT_ERROR, WORLD_LIMIT_STATUS } from "@petgame/shared";

/** Which cap refused a world creation: the whole server's, the one address's, or the address's IPv6 /48 block's. */
export type WorldRefusal = "server" | "address" | "network";

export interface WorldLimits {
  maxWorlds: number;
  perAddress: number;
  /** Cap per IPv6 /48 block (not applied to IPv4). */
  perNetwork: number;
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

/** The shared key of every world creation without a usable IP address (no socket address, garbage from a proxy header). */
export const UNKNOWN_KEY = "unknown";

/**
 * The one place an address is taken apart. Returns the dotted IPv4 string (also for IPv4-mapped IPv6, dotted or hex),
 * the 8 groups of any other IPv6, or undefined when `address` is not an IP. A port and brackets are dropped first
 * (some proxies write `1.2.3.4:5678` or `[v6]:443` into X-Forwarded-For), then a zone after `%`.
 */
function parseIp(address: string | undefined): string | number[] | undefined {
  if (!address) return undefined;
  let text = address;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(text);
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(text);
  if (bracketed) text = bracketed[1];
  else if (withPort) text = withPort[1];
  text = text.split("%")[0];
  if (isIPv4(text)) return text;
  if (!isIPv6(text)) return undefined;
  const g = ipv6Groups(text);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  return g;
}

/**
 * The key worlds are counted under: IPv4 as is, IPv6 as its /64 block (a host rotates addresses inside its block, and
 * providers hand out at least a /64 per subscriber), UNKNOWN_KEY for anything that is not an IP (after dropping a
 * port and brackets).
 */
export function addressKey(address: string | undefined): string {
  return creationKeys(address).address;
}

/**
 * The IPv6 /48 block of an address, or undefined for IPv4, IPv4-mapped IPv6 and non-IPs. /48 is the largest block a
 * provider commonly gives one customer (many give a /56): grouping by /56 would leave a /48 customer 256 blocks to
 * hop between, grouping by /48 covers both.
 */
export function networkKey(address: string | undefined): string | undefined {
  return creationKeys(address).network;
}

/** The keys one world creation is counted under. */
export interface CreationKeys {
  address: string;
  /** IPv6 /48 block; absent for IPv4 and non-IPs. */
  network?: string;
}

/** Both keys of `address`, parsing it once. */
export function creationKeys(address: string | undefined): CreationKeys {
  const ip = parseIp(address);
  if (ip === undefined) return { address: UNKNOWN_KEY };
  if (typeof ip === "string") return { address: ip };
  return {
    address: `${ip.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`,
    network: `${ip.slice(0, 3).map((x) => x.toString(16)).join(":")}::/48`,
  };
}

/**
 * Counts the worlds that are open and who made them, so creation can be refused over the caps. Pure: no timers, no clock.
 * While a creation is running its room has already called `opened` but not `settle`, so it counts twice for a few
 * milliseconds; with many simultaneous requests that is a little stricter, which is fine.
 */
export class WorldCensus {
  /** roomId -> keys of the HTTP request that created it (undefined: made without HTTP). */
  private open = new Map<string, CreationKeys | undefined>();
  /**
   * Creations admitted but not settled yet, per key string (what countFor reads). One IPv6 creation adds to two keys,
   * so these numbers must not be summed: `pendingCreations` counts creations. /64, /48, IPv4 and "unknown" keys never
   * collide (they end in "::/64" or "::/48", contain dots, or are the word "unknown"), so one table holds them all.
   */
  private pending = new Map<string, number>();
  /** Creations admitted but not settled yet (each counted once, whatever its keys); what total() adds to open worlds. */
  private pendingCreations = 0;

  /** A world is open (GameRoom.onCreate). */
  opened(roomId: string): void {
    if (!this.open.has(roomId)) this.open.set(roomId, undefined);
  }

  /** A world closed (GameRoom.onDispose); an unknown id does nothing. */
  closed(roomId: string): void {
    this.open.delete(roomId);
  }

  /** Checks the three caps in order (server, address, network); on success counts one pending creation for each key and returns undefined. */
  admit(keys: CreationKeys, limits: WorldLimits): WorldRefusal | undefined {
    if (this.total() >= limits.maxWorlds) return "server";
    if (this.countFor(keys.address) >= limits.perAddress) return "address";
    if (keys.network !== undefined && this.countFor(keys.network) >= limits.perNetwork) return "network";
    this.pending.set(keys.address, (this.pending.get(keys.address) ?? 0) + 1);
    if (keys.network !== undefined) this.pending.set(keys.network, (this.pending.get(keys.network) ?? 0) + 1);
    this.pendingCreations++;
    return undefined;
  }

  /** The creation admitted for `keys` finished: drop its pending counts; the room it made (if still open) belongs to `keys`. */
  settle(keys: CreationKeys, roomId: string | undefined): void {
    this.release(keys.address);
    if (keys.network !== undefined) this.release(keys.network);
    this.pendingCreations = Math.max(0, this.pendingCreations - 1);
    if (roomId !== undefined && this.open.has(roomId)) this.open.set(roomId, keys);
  }

  private release(key: string): void {
    const left = (this.pending.get(key) ?? 0) - 1;
    if (left > 0) this.pending.set(key, left);
    else this.pending.delete(key);
  }

  /** Open worlds plus pending creations, each creation counted once (what maxWorlds is checked against). */
  total(): number {
    return this.open.size + this.pendingCreations;
  }

  /** Open worlds created from `key` (an address or /48 key) plus its pending creations (what perAddress and perNetwork are checked against). */
  countFor(key: string): number {
    let count = this.pending.get(key) ?? 0;
    for (const owner of this.open.values()) if (owner && (owner.address === key || owner.network === key)) count++;
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

/**
 * Reads PETGAME_MAX_WORLDS, PETGAME_MAX_WORLDS_PER_ADDRESS and PETGAME_MAX_WORLDS_PER_NETWORK; anything but a positive
 * integer keeps the default.
 */
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
    perNetwork: intFromEnv(
      "PETGAME_MAX_WORLDS_PER_NETWORK",
      env.PETGAME_MAX_WORLDS_PER_NETWORK,
      WORLD_LIMITS.perNetwork,
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

/**
 * Error text sent for each refusal. The lobby tells only two texts apart, so a /48 refusal sends the address text
 * and shows the same card ("Mạng bạn đang dùng ..."); an unknown text would show the server-full card on old clients.
 */
const REFUSAL_ERROR: Record<WorldRefusal, string> = {
  server: WORLD_LIMIT_ERROR.server,
  address: WORLD_LIMIT_ERROR.address,
  network: WORLD_LIMIT_ERROR.address,
};

/** Minimum time between two refusal log lines (a logging rhythm, not a balance number). */
const REFUSAL_LOG_MS = 60_000;

/** Rate-limits the refusal log: at most one line per REFUSAL_LOG_MS; refusals in between are counted into the next line. Pure. */
export class RefusalLog {
  private count = 0;
  private counts: Record<WorldRefusal, number> = { server: 0, address: 0, network: 0 };
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
      `(server ${this.counts.server}, address ${this.counts.address}, network ${this.counts.network}); ${openWorlds} worlds open`;
    this.loggedAt = now;
    this.count = 0;
    this.counts.server = 0;
    this.counts.address = 0;
    this.counts.network = 0;
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
  req.headers["x-real-ip"] = clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], trustProxy) ?? UNKNOWN_KEY;
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
 * Three caps apply to `create`: the server's, the address's (IPv4, or IPv6 /64) and the IPv6 /48 block's. A /48
 * refusal sends the address text so the lobby shows the same card. Creations without a usable address share the
 * `unknown` key and a one-time warning (never containing the address).
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

  // Per installation (not per module) so tests that reinstall the guard get a fresh flag.
  let warnedUnknown = false;
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
    const keys = creationKeys(auth?.ip);
    if (keys.address === UNKNOWN_KEY && !warnedUnknown) {
      warnedUnknown = true;
      console.warn(
        "World limits: a world creation came without a usable client address; all such requests share one cap. If this is not expected, check PETGAME_TRUST_PROXY (docs/deploy.md). Logged once per process.",
      );
    }
    const refusal = census.admit(keys, settings.limits);
    if (refusal) {
      noteRefusal(refusal, census);
      throw new ServerError(WORLD_LIMIT_STATUS, REFUSAL_ERROR[refusal]);
    }
    let roomId: string | undefined;
    try {
      const reservation = await original.call(this, method, roomName, options, auth);
      roomId = reservation?.roomId;
      return reservation;
    } finally {
      census.settle(keys, roomId);
    }
  };

  return () => {
    http.removeListener("request", stamp);
    controller.exposedMethods = exposedBefore;
    controller.invokeMethod = original;
  };
}
