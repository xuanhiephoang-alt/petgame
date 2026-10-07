import { describe, expect, it } from "vitest";
import { CollisionGrid } from "@petgame/shared";
import { randomPoint, stepWander, type WanderBrain } from "./wander.ts";

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

describe("wandering with obstacles", () => {
  const grid = new CollisionGrid([{ x: 150, y: 100, r: 30 }]);

  it("never walks into an obstacle and retargets when blocked", () => {
    const pos = { x: 100, y: 100 };
    const brain: WanderBrain = { target: { x: 200, y: 100 }, idleMs: 0 };
    for (let i = 0; i < 40; i++) stepWander(pos, brain, 100, 50, () => 0.5, { grid, radius: 10 });
    expect(Math.hypot(pos.x - 150, pos.y - 100)).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(brain.target).not.toEqual({ x: 200, y: 100 });
  });

  it("spawns in free space", () => {
    let i = 0;
    // First candidate lands inside the obstacle; the retry must not.
    const rolls = [150 / 1600, 100 / 1200, 0.9, 0.9];
    const p = randomPoint(() => rolls[i++ % rolls.length], grid, 10);
    expect(grid.blocked(p, 10)).toBe(false);
  });
});
