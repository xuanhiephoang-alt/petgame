import { CloseCode } from "@colyseus/sdk";
import { CLOSE_REPLACED, RECONNECT_TRY_MS } from "@petgame/shared";

/** Why the world was lost for good. */
export type LostReason = "failed" | "replaced" | "shutdown" | "left" | "refused";

/** Where the connection to the world stands: fine, being brought back, or gone for good. */
export type NetStatus = { state: "online" } | { state: "reconnecting" } | { state: "lost"; reason: LostReason };

/** How often (ms) the connection is checked and pinged while online. */
export const PING_EVERY_MS = 2000;
/** Longer than this (ms) without hearing anything (no pong, no state patch) and the connection is taken as hung. */
export const STALL_MS = 6000;
/** Two checks further apart than this (ms) mean the page itself was asleep (a phone with its screen off). */
export const SLEPT_GAP_MS = 3 * PING_EVERY_MS;
/**
 * A reconnection try whose retry count has not moved for this long (ms) while its socket is connecting or open is hung
 * (the network took the connection but never answers, as a Wi-Fi login page does): the SDK schedules nothing more for
 * it. A try waits at most SDK_RECONNECTION.maxDelay (2 s) before it starts, so a hung one has been open at least
 * STALL_MS, the same silence that counts as hung while online.
 */
export const HUNG_TRY_MS = 2000 + STALL_MS;
/** The lobby is entered again by itself at most this often (ms), so a network that keeps flapping cannot make the page reload in a loop. */
export const AUTO_REJOIN_GAP_MS = 60_000;

/**
 * How the SDK retries on its own after a drop (it reconnects on the very same Room object, so nothing is bound again):
 * - minUptime 0: a phone on mobile data can drop within the first 5 s (the SDK's default floor).
 * - maxDelay 2000: once the network is back, the next try is at most 2 s away.
 * - maxRetries 30: only a safety net; RECONNECT_TRY_MS is the real limit (about 17 tries fit in it).
 * - maxEnqueuedMessages 0: nothing is kept to send later, so a throw or an attack pressed 20 s ago is never replayed.
 */
export const SDK_RECONNECTION = { minUptime: 0, maxDelay: 2000, maxRetries: 30, maxEnqueuedMessages: 0 } as const;

/**
 * Why a room that closed with this code is gone. 4003 while reconnecting means the server refused the reconnection
 * code: the place was lost to a bad moment (T24), which the game can try to take back; 4003 at any other time is "failed".
 */
export function lostReason(code: number, reconnecting = false): LostReason {
  if (code === CloseCode.FAILED_TO_RECONNECT && reconnecting) return "refused";
  if (code === CLOSE_REPLACED) return "replaced";
  if (code === CloseCode.SERVER_SHUTDOWN) return "shutdown";
  if (code === CloseCode.CONSENTED) return "left";
  return "failed";
}

/**
 * Whether a reconnection try is hung: no progress for HUNG_TRY_MS and its socket is connecting (0) or open (1).
 * A socket that is closing or closed (2, 3) or unknown is the wait between two tries, and closing it again would make
 * the SDK schedule a second try beside the first.
 */
export function isTryHung(stillMs: number, readyState: number | undefined): boolean {
  return stillMs >= HUNG_TRY_MS && (readyState === 0 || readyState === 1);
}

/** Whether the page may enter the lobby again by itself, given when it last did (null or not a number: never). */
export function mayRejoinAgain(lastAt: number | null, now: number): boolean {
  if (typeof lastAt !== "number" || !Number.isFinite(lastAt)) return true;
  return now - lastAt >= AUTO_REJOIN_GAP_MS;
}

/** The readyState of the socket under a transport, or undefined when it cannot be told (the SDK does not declare `ws`). */
function socketState(transport: unknown): number | undefined {
  if (typeof transport !== "object" || transport === null || !("ws" in transport)) return undefined;
  const ws = (transport as { ws: unknown }).ws;
  if (typeof ws !== "object" || ws === null || !("readyState" in ws)) return undefined;
  const state = (ws as { readyState: unknown }).readyState;
  return typeof state === "number" ? state : undefined;
}

/**
 * The part of the SDK's Room that ConnectionWatch uses, written structurally so the game's room and a stand-in
 * in tests both fit.
 */
export interface WatchedRoom {
  onDrop(callback: (code: number) => void): unknown;
  onReconnect(callback: () => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
  onStateChange(callback: () => void): unknown;
  ping(callback: (ms: number) => void): void;
  leave(consented?: boolean): unknown;
  connection: { close(code?: number): void; transport?: unknown };
  reconnection: { retryCount: number; enabled: boolean; maxRetries: number; maxDelay: number; minUptime: number; maxEnqueuedMessages: number };
}

type Listener = (status: NetStatus, previous: NetStatus) => void;

const ONLINE: NetStatus = { state: "online" };
const RECONNECTING: NetStatus = { state: "reconnecting" };

/**
 * Keeps track of the connection to the world: online, reconnecting (the SDK is trying again) or lost for good.
 * It sets the SDK's retry policy, gives up when the server must have let the place go, tells a hung connection from a
 * live one by pinging it, replaces a reconnection try that hangs (HUNG_TRY_MS), and hands the place back when the page closes. No DOM: time comes from the global
 * Date.now, setTimeout and setInterval (tests drive them with fake timers).
 */
export class ConnectionWatch {
  private current: NetStatus = ONLINE;
  private listeners: Listener[] = [];
  /** When (ms) anything last came from the server: a pong or a state patch. */
  private heardAt = Date.now();
  private lastCheck = Date.now();
  /** The SDK's retry count at the last check while reconnecting, and when (ms) it last changed. */
  private tryCount = 0;
  private tryChangedAt = Date.now();
  private checker: ReturnType<typeof setInterval> | undefined;
  private giveUpTimer: ReturnType<typeof setTimeout> | undefined;
  /** The answer to a ping (one function, so a ping every 2 s makes no new closure). */
  private heard = () => {
    this.heardAt = Date.now();
  };

  constructor(private room: WatchedRoom) {
    Object.assign(room.reconnection, SDK_RECONNECTION);
    room.onDrop(() => this.dropped());
    room.onReconnect(() => this.reconnected());
    room.onLeave((code) => this.lose(lostReason(code, this.current.state === "reconnecting")));
    room.onStateChange(this.heard);
    this.checker = setInterval(() => this.check(), PING_EVERY_MS);
  }

  get status(): NetStatus {
    return this.current;
  }

  /** Whether the connection is up: the only time anything may be sent. */
  get online(): boolean {
    return this.current.state === "online";
  }

  /** Calls back whenever the status changes, with the new one and the one before. */
  onChange(listener: Listener) {
    this.listeners.push(listener);
  }

  /**
   * The page is closing: leave on purpose, so the server frees the place at once instead of holding it for a
   * reconnection that will not come.
   */
  leave() {
    if (this.current.state === "lost") return;
    const wasOnline = this.current.state === "online";
    this.room.reconnection.enabled = false;
    this.lose("left");
    if (wasOnline) this.handBack();
  }

  /** The SDK saw the socket close without a goodbye and is about to try again. */
  private dropped() {
    if (this.current.state !== "online") return; // every failed try drops again: nothing new
    this.tryCount = this.room.reconnection.retryCount;
    this.tryChangedAt = Date.now();
    this.change(RECONNECTING);
    this.giveUpTimer = setTimeout(() => this.giveUp(), RECONNECT_TRY_MS);
  }

  private reconnected() {
    if (this.current.state === "lost") return this.handBack(); // a try that got in after we gave up
    clearTimeout(this.giveUpTimer);
    this.heardAt = Date.now();
    this.change(ONLINE);
  }

  /** Past RECONNECT_TRY_MS the server has surely let the place go: stop trying. */
  private giveUp() {
    if (this.current.state !== "reconnecting") return;
    this.room.reconnection.enabled = false;
    this.room.reconnection.maxRetries = 0;
    this.lose("failed");
  }

  /** Gone for good: the first reason stays, and nothing is watched or timed any more. */
  private lose(reason: LostReason) {
    if (this.current.state === "lost") return;
    clearInterval(this.checker);
    clearTimeout(this.giveUpTimer);
    this.change({ state: "lost", reason });
  }

  /** Gives the place back to the server (leaving on purpose); never throws, as it also runs while the page closes. */
  private handBack() {
    try {
      void this.room.leave(true);
    } catch {
      // The socket was not open: the server lets the place go on its own.
    }
  }

  private change(next: NetStatus) {
    const previous = this.current;
    this.current = next;
    // These run inside the SDK's own close handling: one that throws must not stop the others, or the SDK's retry.
    for (const listener of this.listeners) {
      try {
        listener(next, previous);
      } catch (err) {
        console.error(err);
      }
    }
  }

  /** Every PING_EVERY_MS: a hung connection is closed so the SDK reconnects, a live one is pinged. */
  private check() {
    const now = Date.now();
    const gap = now - this.lastCheck;
    this.lastCheck = now;
    if (this.current.state === "reconnecting") {
      const count = this.room.reconnection.retryCount;
      if (gap > SLEPT_GAP_MS || count !== this.tryCount) {
        // A sleeping page stopped the SDK's timers too; a moved count means the SDK is still trying on its own.
        this.tryCount = count;
        this.tryChangedAt = now;
      } else if (isTryHung(now - this.tryChangedAt, socketState(this.room.connection.transport))) {
        // The try opened a socket and nothing came: drop it (the SDK takes this as a failed try and starts a new one now).
        this.room.connection.close(CloseCode.MAY_TRY_RECONNECT);
        this.tryChangedAt = now;
      }
      return;
    }
    if (this.current.state !== "online") return;
    if (gap > SLEPT_GAP_MS) {
      // The page was asleep, so the silence is not the server's fault: the connection gets a moment to show it lives.
      this.heardAt = now;
    } else if (now - this.heardAt > STALL_MS) {
      // Nothing for too long and no close either (a dead network, a locked phone): close it the way the browser's own
      // "offline" event does, so the SDK takes it as a drop and starts reconnecting.
      this.room.connection.close(CloseCode.MAY_TRY_RECONNECT);
      return;
    }
    this.room.ping(this.heard);
  }
}
