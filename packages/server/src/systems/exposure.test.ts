import { describe, expect, it } from "vitest";
import { Exposures } from "./exposure.ts";

/** Whether a promise has settled, after letting pending microtasks run. */
async function done(p: Promise<void>): Promise<boolean> {
  let finished = false;
  void p.then(() => (finished = true));
  await new Promise((r) => setTimeout(r, 0));
  return finished;
}

describe("Exposures", () => {
  it("is settled at once for a session that is not open", async () => {
    expect(await done(new Exposures().settled("a"))).toBe(true);
  });

  it("waits while open and settles on close", async () => {
    const e = new Exposures();
    e.open("a");
    expect(e.isOpen("a")).toBe(true);
    const waiting = e.settled("a");
    expect(await done(waiting)).toBe(false);
    e.close("a");
    expect(e.isOpen("a")).toBe(false);
    expect(await done(waiting)).toBe(true);
  });

  it("closing twice or a session never opened is harmless", async () => {
    const e = new Exposures();
    e.close("nobody");
    e.open("a");
    e.close("a");
    e.close("a");
    expect(await done(e.settled("a"))).toBe(true);
  });

  it("keeps the first opening when opened again while open", async () => {
    const e = new Exposures();
    e.open("a");
    e.open("a");
    const waiting = e.settled("a");
    e.close("a");
    expect(await done(waiting)).toBe(true);
  });

  it("waits on a new opening made right after close, before the waiter woke", async () => {
    const e = new Exposures();
    e.open("a");
    const waiting = e.settled("a");
    e.close("a");
    e.open("a");
    expect(await done(waiting)).toBe(false);
    e.close("a");
    expect(await done(waiting)).toBe(true);
  });

  it("closeAll wakes everyone", async () => {
    const e = new Exposures();
    e.open("a");
    e.open("b");
    const waits = [e.settled("a"), e.settled("b")];
    e.closeAll();
    expect(await done(Promise.all(waits).then(() => undefined))).toBe(true);
    expect(e.isOpen("a") || e.isOpen("b")).toBe(false);
  });

  it("isOpen follows open and close per session", () => {
    const e = new Exposures();
    expect([e.isOpen("a"), e.isOpen("b")]).toEqual([false, false]);
    e.open("a");
    expect([e.isOpen("a"), e.isOpen("b")]).toEqual([true, false]);
    e.close("a");
    expect(e.isOpen("a")).toBe(false);
  });
});
