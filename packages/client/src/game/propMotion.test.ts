import { describe, expect, it } from "vitest";
import { PROP_MOTION, countDown, growSize, shakeJolt, shakeLean, stepPropMotion, type PropPose } from "./propMotion.ts";

describe("countDown", () => {
  it("moves down by dt and never below 0", () => {
    expect(countDown(0.35, 0.1)).toBeCloseTo(0.25);
    expect(countDown(0.05, 0.1)).toBe(0);
  });

  it("never rises with a negative dt", () => {
    expect(countDown(0.2, -1)).toBe(0.2);
  });

  it("stays put with dt = 0 (why a tree leaned forever when dt was never passed)", () => {
    expect(countDown(0.35, 0)).toBe(0.35);
  });
});

describe("shake", () => {
  it("is exactly 0 when done", () => {
    for (const left of [0, -0.1]) {
      expect(shakeLean(left)).toBe(0);
      expect(shakeJolt(left)).toBe(0);
    }
  });

  it("moves at the start and stays within its limits", () => {
    expect(shakeLean(PROP_MOTION.shakeSec)).not.toBe(0);
    expect(shakeJolt(PROP_MOTION.shakeSec)).not.toBe(0);
    for (let i = 1; i <= 1000; i++) {
      const left = (i / 1000) * PROP_MOTION.shakeSec;
      expect(Math.abs(shakeLean(left))).toBeLessThanOrEqual(0.14);
      expect(Math.abs(shakeJolt(left))).toBeLessThanOrEqual(2);
    }
  });
});

describe("growSize", () => {
  it("runs from 0.55 to exactly full size", () => {
    expect(growSize(0.45)).toBe(0.55);
    expect(growSize(1)).toBe(0.55);
    expect(growSize(0)).toBe(1);
    expect(growSize(-1)).toBe(1);
  });

  it("never shrinks as time runs down and stays in range", () => {
    let last = 0;
    for (let i = 450; i >= 0; i--) {
      const size = growSize(i / 1000);
      expect(size).toBeGreaterThanOrEqual(0.55);
      expect(size).toBeLessThanOrEqual(1);
      expect(size).toBeGreaterThanOrEqual(last);
      last = size;
    }
  });
});

describe("a whole shake and regrow", () => {
  it.each([1 / 60, 1 / 30, 0.1])("ends clean with dt = %f", (dt) => {
    let shake: number = PROP_MOTION.shakeSec;
    let frames = 0;
    while (shake > 0) {
      shake = countDown(shake, dt);
      frames++;
    }
    expect(frames).toBeLessThanOrEqual(Math.ceil(PROP_MOTION.shakeSec / dt) + 1);
    expect(shakeLean(shake)).toBe(0);
    expect(shakeJolt(shake)).toBe(0);

    let grow: number = PROP_MOTION.growSec;
    frames = 0;
    while (grow > 0) {
      grow = countDown(grow, dt);
      frames++;
    }
    expect(frames).toBeLessThanOrEqual(Math.ceil(PROP_MOTION.growSec / dt) + 1);
    expect(growSize(grow)).toBe(1);
  });
});

describe("stepPropMotion", () => {
  const blank = (): PropPose => ({ lean: undefined, dx: 0, size: undefined, busy: false });

  it("gives exactly the full size on the last frame of growing back", () => {
    const motion = { shake: 0, grow: 0.05 };
    const out = stepPropMotion(motion, 0.1, true, false, blank());
    expect(motion.grow).toBe(0);
    expect(out.size).toBe(1);
    expect(out.busy).toBe(false);
  });

  it("swells while growing", () => {
    const motion = { shake: 0, grow: PROP_MOTION.growSec };
    const out = stepPropMotion(motion, 0.1, true, false, blank());
    expect(out.size).toBe(growSize(PROP_MOTION.growSec - 0.1));
    expect(out.size).toBeGreaterThan(PROP_MOTION.growFrom);
    expect(out.size).toBeLessThan(1);
  });

  it("leaves the size alone when not growing (a stump or rubble that is hit)", () => {
    const out = stepPropMotion({ shake: 0.35, grow: 0 }, 0.016, false, true, blank());
    expect(out.size).toBeUndefined();
  });

  it("leans a standing tree that shakes, without a jolt", () => {
    const out = stepPropMotion({ shake: 0.35, grow: 0 }, 0.016, true, false, blank());
    expect(out.lean).toBeCloseTo(shakeLean(0.334));
    expect(out.dx).toBe(0);
    expect(out.busy).toBe(true);
  });

  it("is exactly upright and still on the last frame of shaking", () => {
    const motion = { shake: 0.01, grow: 0 };
    const out = stepPropMotion(motion, 0.1, true, false, blank());
    expect(out.lean).toBe(0);
    expect(out.dx).toBe(0);
    expect(out.busy).toBe(false);
    expect(motion.shake).toBe(0);
  });

  it("jolts a rock sideways and does not lean it", () => {
    const out = stepPropMotion({ shake: 0.35, grow: 0 }, 0.016, false, true, blank());
    expect(out.lean).toBeUndefined();
    expect(out.dx).toBeCloseTo(shakeJolt(0.334));
    expect(out.dx).not.toBe(0);
  });

  it("jolts a felled tree's stump and does not lean it", () => {
    const out = stepPropMotion({ shake: 0.2, grow: 0 }, 0.016, false, true, blank());
    expect(out.lean).toBeUndefined();
    expect(out.dx).not.toBe(0);
  });

  it("does not move on with dt <= 0", () => {
    for (const dt of [-1, 0]) {
      const motion = { shake: 0.2, grow: 0.2 };
      const out = stepPropMotion(motion, dt, true, false, blank());
      expect(motion).toEqual({ shake: 0.2, grow: 0.2 });
      expect(out.busy).toBe(true);
      expect(out.size).toBe(growSize(0.2));
    }
  });

  it("writes into the object it is given and returns it", () => {
    const out = blank();
    const motion = { shake: 0.3, grow: 0 };
    expect(stepPropMotion(motion, 0.016, true, false, out)).toBe(out);
    expect(stepPropMotion(motion, 0.016, true, false, out)).toBe(out);
  });

  it("shakes and grows at once (a tree that regrew and was chopped again)", () => {
    const out = stepPropMotion({ shake: 0.35, grow: 0.45 }, 0.1, true, false, blank());
    expect(out.lean).not.toBeUndefined();
    expect(out.size).not.toBeUndefined();
    expect(out.busy).toBe(true);
  });
});
