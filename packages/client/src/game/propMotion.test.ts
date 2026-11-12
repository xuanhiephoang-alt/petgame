import { describe, expect, it } from "vitest";
import { PROP_MOTION, countDown, growSize, shakeJolt, shakeLean } from "./propMotion.ts";

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
