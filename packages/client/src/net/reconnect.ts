import { CloseCode } from "@colyseus/sdk";
import { CLOSE_REPLACED, RECONNECT_TRY_MS } from "@petgame/shared";

/** Why the world was lost for good. */
export type LostReason = "failed" | "replaced" | "shutdown" | "left";

/** Where the connection to the world stands: fine, being brought back, or gone for good. */
export type NetStatus = { state: "online" } | { state: "reconnecting" } | { state: "lost"; reason: LostReason };

/** How often (ms) the connection is checked and pinged while online. */
export const PING_EVERY_MS = 2000;
/** Longer than this (ms) without hearing anything (no pong, no state patch) and the connection is taken as hung. */
export const STALL_MS = 6000;
/** Two checks further apart than this (ms) mean the page itself was asleep (a phone with its screen off). */
export const SLEPT_GAP_MS = 3 * PING_EVERY_MS;

/**
 * How the SDK retries on its own after a drop (it reconnects on the very same Room object, so nothing is bound again):
 * - minUptime 0: a phone on mobile data can drop within the first 5 s (the SDK's default floor).
 * - maxDelay 2000: once the network is back, the next try is at most 2 s away.
 * - maxRetries 30: only a safety net; RECONNECT_TRY_MS is the real limit (about 17 tries fit in it).
 * - maxEnqueuedMessages 0: nothing is kept to send later, so a throw or an attack pressed 20 s ago is never replayed.
 */
export const SDK_RECONNECTION = { minUptime: 0, maxDelay: 2000, maxRetries: 30, maxEnqueuedMessages: 0 } as const;

/** Why a room that closed with this code is gone. */
export function lostReason(code: number): LostReason {
  if (code === CLOSE_REPLACED) return "replaced";
  if (code === CloseCode.SERVER_SHUTDOWN) return "shutdown";
  if (code === CloseCode.CONSENTED) return "left";
  return "failed";
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
  connection: { close(code?: number): void };
  reconnection: { enabled: boolean; maxRetries: number; maxDelay: number; minUptime: number; maxEnqueuedMessages: number };
}

type Listener = (status: NetStatus, previous: NetStatus) => void;

const ONLINE: NetStatus = { state: "online" };
const RECONNECTING: NetStatus = { state: "reconnecting" };

/**
 * Keeps track of the connection to the world: online, reconnecting (the SDK is trying again) or lost for good.
 * It sets the SDK's retry policy, gives up when the server must have let the place go, tells a hung connection from a
 * live one by pinging it, and hands the place back when the page closes. No DOM: time comes from the global
 * Date.now, setTimeout and setInterval (tests drive them with fake timers).
 */
export class ConnectionWatch {
  private current: NetStatus = ONLINE;
  private listeners: Listener[] = [];
  /** When (ms) anything last came from the server: a pong or a state patch. */
  private heardAt = Date.now();
  private lastCheck = Date.now();
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
    room.onLeave((code) => this.lose(lostReason(code)));
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
