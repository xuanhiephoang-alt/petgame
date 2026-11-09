import { describe, expect, it } from "vitest";
import { COMPANION_FOLLOW_DISTANCE, COMPANION_SPEED, COMPANION_TELEPORT_DISTANCE, CollisionGrid, distance } from "@petgame/shared";
import { companionReach, stepCompanion } from "./companion.ts";

const run = (start: { x: number; y: number }, owner: { x: number; y: number }, target?: { x: number; y: number }, ticks = 40, grid?: CollisionGrid) => {
  let pos = start;
  let last = { pos, inAttackRange: false };
  for (let i = 0; i < ticks; i++) {
    last = stepCompanion(pos, owner, target, 50, 14, grid);
    pos = last.pos;
  }
  return last;
};

describe("stepCompanion", () => {
  it("catches up with its owner and stops at follow distance", () => {
    const { pos } = run({ x: 0, y: 0 }, { x: 300, y: 0 });
    expect(distance(pos, { x: 300, y: 0 })).toBeCloseTo(COMPANION_FOLLOW_DISTANCE, 0);
  });

  it("moves at companion speed", () => {
    const { pos } = stepCompanion({ x: 0, y: 0 }, { x: 400, y: 0 }, undefined, 500, 14);
    expect(pos.x).toBeCloseTo(COMPANION_SPEED / 2);
  });

  it("chases a target and reports when it can attack", () => {
    const step = run({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 });
    expect(step.inAttackRange).toBe(true);
  });

  it("teleports back when left far behind", () => {
    const { pos } = stepCompanion({ x: 0, y: 0 }, { x: 1000, y: 1000 }, undefined, 50, 14);
    expect(distance(pos, { x: 1000, y: 1000 })).toBeLessThan(50);
  });

  it("does not walk through obstacles", () => {
    const grid = new CollisionGrid([{ x: 150, y: 0, r: 30 }]);
    const { pos } = run({ x: 0, y: 0 }, { x: 300, y: 0 }, undefined, 60, grid);
    expect(grid.blocked(pos, 14)).toBe(false);
  });

  it("walks to a waypoint when given one, counting its attack range to the target", () => {
    const target = { x: 100, y: 0 };
    const via = { x: 0, y: 100 };
    const step = stepCompanion({ x: 0, y: 0 }, { x: 0, y: -50 }, target, 250, 14, undefined, via);
    expect(step.pos.x).toBeCloseTo(0);
    expect(step.pos.y).toBeCloseTo((COMPANION_SPEED * 250) / 1000);
    expect(step.inAttackRange).toBe(false);
    // The target is within reach of the next position even though the waypoint lies elsewhere.
    const close = stepCompanion({ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 30, y: 0 }, 50, 14, undefined, via);
    expect(close.inAttackRange).toBe(true);
    // Too far behind its owner: jumps back, ignoring the waypoint.
    const owner = { x: COMPANION_TELEPORT_DISTANCE + 100, y: 0 };
    const jumped = stepCompanion({ x: 0, y: 0 }, owner, undefined, 50, 14, undefined, via);
    expect(distance(jumped.pos, owner)).toBeLessThan(40);
    expect(companionReach(14, true)).toBe(54);
    expect(companionReach(14, false)).toBe(COMPANION_FOLLOW_DISTANCE);
  });
});
