import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloseCode } from "@colyseus/sdk";
import { CLOSE_REPLACED, RECONNECT_TRY_MS } from "@petgame/shared";
import { ConnectionWatch, PING_EVERY_MS, STALL_MS, lostReason, type NetStatus, type WatchedRoom } from "./reconnect.ts";

/** The code the SDK takes as "may try to reconnect": closing with it reports the drop at once, as the real transport does. */
const MAY_TRY_RECONNECT = CloseCode.MAY_TRY_RECONNECT;

/** A stand-in for the SDK's Room: its signals are lists of callbacks, and what the watch asks of it is recorded. */
function fakeRoom() {
  const handlers = {
    drop: [] as ((code: number) => void)[],
    reconnect: [] as (() => void)[],
    leave: [] as ((code: number) => void)[],
    state: [] as (() => void)[],
  };
  const unanswered: (() => void)[] = [];
  const calls = { pings: 0, leave: [] as (boolean | undefined)[], close: [] as (number | undefined)[] };
  const room: WatchedRoom = {
    onDrop: (callback) => handlers.drop.push(callback),
    onReconnect: (callback) => handlers.reconnect.push(callback),
    onLeave: (callback) => handlers.leave.push(callback),
    onStateChange: (callback) => handlers.state.push(callback),
    ping: (callback) => {
      calls.pings++;
      unanswered.push(() => callback(1));
    },
    leave: (consented) => calls.leave.push(consented),
    connection: {
      close: (code) => {
        calls.close.push(code);
        if (code === MAY_TRY_RECONNECT) handlers.drop.forEach((h) => h(code));
      },
    },
    reconnection: { enabled: true, maxRetries: 15, maxDelay: 5000, minUptime: 5000, maxEnqueuedMessages: 10 },
  };
  return {
    room,
    calls,
    /** The server answers every ping sent so far. */
    answer: () => unanswered.splice(0).forEach((reply) => reply()),
    /** What the SDK does to the room's signals. */
    fire: {
      drop: (code = 1006) => handlers.drop.forEach((h) => h(code)),
      reconnect: () => handlers.reconnect.forEach((h) => h()),
      leave: (code: number) => handlers.leave.forEach((h) => h(code)),
      state: () => handlers.state.forEach((h) => h()),
    },
  };
}

describe("ConnectionWatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the reconnect policy to the SDK", () => {
    const { room } = fakeRoom();
    new ConnectionWatch(room);
    expect(room.reconnection).toEqual({ enabled: true, minUptime: 0, maxDelay: 2000, maxRetries: 30, maxEnqueuedMessages: 0 });
  });

  it("goes reconnecting on a drop, once, and back online on reconnect", () => {
    const { room, fire } = fakeRoom();
    const watch = new ConnectionWatch(room);
    const seen: [NetStatus, NetStatus][] = [];
    watch.onChange((status, previous) => seen.push([status, previous]));
    expect(watch.online).toBe(true);

    fire.drop(1006);
    fire.drop(1006); // every try that fails drops again
    expect(seen).toEqual([[{ state: "reconnecting" }, { state: "online" }]]);
    expect(watch.online).toBe(false);

    fire.reconnect();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual([{ state: "online" }, { state: "reconnecting" }]);
    expect(watch.online).toBe(true);
  });

  it("gives up after RECONNECT_TRY_MS and leaves if a late try still gets in", () => {
    const { room, calls, fire } = fakeRoom();
    const watch = new ConnectionWatch(room);
    fire.drop(1006);
    vi.advanceTimersByTime(RECONNECT_TRY_MS - 1);
    expect(watch.status).toEqual({ state: "reconnecting" });
    vi.advanceTimersByTime(1);
    expect(watch.status).toEqual({ state: "lost", reason: "failed" });
    expect(room.reconnection.enabled).toBe(false);
    expect(room.reconnection.maxRetries).toBe(0);

    expect(vi.getTimerCount()).toBe(0); // nothing is timed any more
    // A try already under way gets in after all: the place goes straight back to the server.
    expect(calls.leave).toEqual([]);
    fire.reconnect();
    expect(calls.leave).toEqual([true]);
    expect(watch.status).toEqual({ state: "lost", reason: "failed" });
  });

  it("does not give up once back online", () => {
    const { room, fire } = fakeRoom();
    const watch = new ConnectionWatch(room);
    fire.drop(1006);
    vi.advanceTimersByTime(RECONNECT_TRY_MS - 1000);
    fire.reconnect();
    // Past the time the give-up was set for, with the state coming in as it does.
    for (let t = 0; t < RECONNECT_TRY_MS; t += 1000) {
      vi.advanceTimersByTime(1000);
      fire.state();
    }
    expect(watch.status).toEqual({ state: "online" });
    expect(room.reconnection.enabled).toBe(true);
  });

  it("names why the world was lost from the close code", () => {
    expect([CLOSE_REPLACED, 4001, 4000, 4003, 1006].map(lostReason)).toEqual(["replaced", "shutdown", "left", "failed", "failed"]);

    const { room, fire } = fakeRoom();
    const watch = new ConnectionWatch(room);
    fire.leave(CLOSE_REPLACED);
    expect(watch.status).toEqual({ state: "lost", reason: "replaced" });
    fire.leave(4003); // the first reason stays
    expect(watch.status).toEqual({ state: "lost", reason: "replaced" });
  });

  it("pings while online and treats a silent connection as dropped", () => {
    const { room, calls } = fakeRoom();
    const watch = new ConnectionWatch(room);
    vi.advanceTimersByTime(STALL_MS);
    expect(calls.pings).toBe(STALL_MS / PING_EVERY_MS); // one every PING_EVERY_MS
    expect(calls.close).toEqual([]);
    expect(watch.online).toBe(true);

    // Nothing came back for longer than STALL_MS: closed once, as the SDK's "may try to reconnect", which it takes as a drop.
    vi.advanceTimersByTime(PING_EVERY_MS);
    expect(calls.close).toEqual([MAY_TRY_RECONNECT]);
    expect(watch.status).toEqual({ state: "reconnecting" });
    vi.advanceTimersByTime(10_000);
    expect(calls.close).toEqual([MAY_TRY_RECONNECT]);
    expect(calls.pings).toBe(STALL_MS / PING_EVERY_MS); // not pinging while reconnecting
  });

  it("leaves an answering connection alone", () => {
    // Every ping is answered.
    const answering = fakeRoom();
    const watch = new ConnectionWatch(answering.room);
    for (let t = 0; t < 30_000; t += PING_EVERY_MS) {
      vi.advanceTimersByTime(PING_EVERY_MS);
      answering.answer();
    }
    expect(answering.calls.close).toEqual([]);
    expect(watch.online).toBe(true);

    // No ping is answered, but the state keeps coming.
    const patching = fakeRoom();
    const other = new ConnectionWatch(patching.room);
    for (let t = 0; t < 30_000; t += 1000) {
      vi.advanceTimersByTime(1000);
      patching.fire.state();
    }
    expect(patching.calls.close).toEqual([]);
    expect(other.online).toBe(true);
  });

  it("gives the connection a moment after the page slept", () => {
    const { room, calls } = fakeRoom();
    const watch = new ConnectionWatch(room);
    // A phone with its screen off: the clock moves on, no timer runs. The next beat does not blame the silence.
    vi.setSystemTime(Date.now() + 60_000);
    vi.advanceTimersByTime(PING_EVERY_MS);
    expect(calls.close).toEqual([]);
    expect(calls.pings).toBe(1);
    expect(watch.online).toBe(true);

    // It then gets the usual STALL_MS to answer.
    vi.advanceTimersByTime(STALL_MS);
    expect(calls.close).toEqual([]);
    vi.advanceTimersByTime(PING_EVERY_MS);
    expect(calls.close).toEqual([MAY_TRY_RECONNECT]);
    expect(watch.status).toEqual({ state: "reconnecting" });
  });

  it("leaving on purpose", () => {
    // Online: the server is told, the place is freed, nothing is watched any more.
    const online = fakeRoom();
    const watch = new ConnectionWatch(online.room);
    watch.leave();
    expect(online.calls.leave).toEqual([true]);
    expect(watch.status).toEqual({ state: "lost", reason: "left" });
    expect(online.room.reconnection.enabled).toBe(false);
    const pings = online.calls.pings;
    vi.advanceTimersByTime(20_000);
    expect(online.calls.pings).toBe(pings);
    watch.leave(); // closing twice (pagehide again) does nothing more
    expect(online.calls.leave).toEqual([true]);

    // Reconnecting: there is no connection to say goodbye on, only the retries to stop.
    const dropped = fakeRoom();
    const other = new ConnectionWatch(dropped.room);
    dropped.fire.drop(1006);
    other.leave();
    expect(vi.getTimerCount()).toBe(0); // the wait to give up is stopped too
    expect(dropped.calls.leave).toEqual([]);
    expect(dropped.room.reconnection.enabled).toBe(false);
    expect(other.status).toEqual({ state: "lost", reason: "left" });
  });

  it("stops watching once lost", () => {
    const { room, calls, fire } = fakeRoom();
    new ConnectionWatch(room);
    fire.leave(4003);
    expect(vi.getTimerCount()).toBe(0); // the beat is stopped, not just ignored
    vi.advanceTimersByTime(20_000);
    expect(calls.pings).toBe(0);
    expect(calls.close).toEqual([]);
  });

  it("lets a listener that throws spoil neither the others nor the SDK", () => {
    const { room, fire } = fakeRoom();
    const watch = new ConnectionWatch(room);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const heard: string[] = [];
    watch.onChange(() => {
      throw new Error("a broken listener");
    });
    watch.onChange((status) => heard.push(status.state));
    expect(() => fire.drop(1006)).not.toThrow(); // runs inside the SDK's close handling, before its retry starts
    expect(heard).toEqual(["reconnecting"]);
    expect(quiet).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
});
