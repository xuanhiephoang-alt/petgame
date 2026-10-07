import { describe, expect, it } from "vitest";
import { stepWander, type WanderBrain } from "./wander.ts";

describe("stepWander", () => {
  it("idles before moving", () => {
    const pos = { x: 100, y: 100 };
    const brain: WanderBrain = { target: { x: 200, y: 100 }, idleMs: 500 };
    stepWander(pos, brain, 100, 100);
    expect(pos).toEqual({ x: 100, y: 100 });
    expect(brain.idleMs).toBe(400);
  });

  it("walks toward the target at the given speed", () => {
    const pos = { x: 100, y: 100 };
    const brain: WanderBrain = { target: { x: 200, y: 100 }, idleMs: 0 };
    stepWander(pos, brain, 100, 500);
    expect(pos.x).toBeCloseTo(150);
    expect(pos.y).toBeCloseTo(100);
  });

  it("picks a new target and idles on arrival", () => {
    const pos = { x: 195, y: 100 };
    const brain: WanderBrain = { target: { x: 200, y: 100 }, idleMs: 0 };
    stepWander(pos, brain, 100, 1000, () => 0.5);
    expect(pos).toEqual({ x: 200, y: 100 });
    expect(brain.idleMs).toBeGreaterThan(0);
  });
});
