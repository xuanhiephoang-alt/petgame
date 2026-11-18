import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEEN_EVERY_MS } from "../ui/joinStatus.ts";
import { SeenNotes } from "./seen.ts";

const START = 1_000_000_000_000;

describe("SeenNotes", () => {
  let up = true;
  const write = vi.fn();
  const online = () => up;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    up = true;
    write.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the time every SEEN_EVERY_MS while online, not before", () => {
    const seen = new SeenNotes(online, write);
    expect(write).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(SEEN_EVERY_MS - 1);
    expect(write).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(Date.now());
    vi.advanceTimersByTime(SEEN_EVERY_MS);
    expect(write).toHaveBeenCalledTimes(2);
    seen.stop();
  });

  it("skips the beat while offline and writes again once back online", () => {
    const seen = new SeenNotes(online, write);
    up = false;
    vi.advanceTimersByTime(SEEN_EVERY_MS);
    expect(write).toHaveBeenCalledTimes(0);
    up = true;
    vi.advanceTimersByTime(SEEN_EVERY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    seen.stop();
  });

  it("note() writes at once only while online", () => {
    const seen = new SeenNotes(online, write);
    seen.note();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(Date.now());
    up = false;
    seen.note();
    expect(write).toHaveBeenCalledTimes(1);
    seen.stop();
  });

  it("stop() ends the beat", () => {
    const seen = new SeenNotes(online, write);
    seen.stop();
    vi.advanceTimersByTime(SEEN_EVERY_MS * 3);
    expect(write).toHaveBeenCalledTimes(0);
    expect(() => seen.stop()).not.toThrow();
    // The online check, not stop(), is what blocks writes after the world is lost.
    seen.note();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("takes its beat from the argument", () => {
    const seen = new SeenNotes(online, write, 1000);
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(1);
    seen.stop();
  });
});
