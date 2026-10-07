import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS, PLAYER_SPEED } from "./constants.ts";
import { normalizeInput, stepPlayer } from "./movement.ts";

describe("normalizeInput", () => {
  it("keeps diagonals at unit length", () => {
    const d = normalizeInput({ x: 1, y: 1 });
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });

  it("treats non-finite input as zero", () => {
    expect(normalizeInput({ x: NaN, y: Infinity })).toEqual({ x: 0, y: 0 });
  });
});

describe("stepPlayer", () => {
  it("moves PLAYER_SPEED pixels per second", () => {
    const next = stepPlayer({ x: 100, y: 100 }, { x: 1, y: 0 }, 1000);
    expect(next.x).toBeCloseTo(100 + PLAYER_SPEED);
    expect(next.y).toBe(100);
  });

  it("clamps to the world bounds", () => {
    const next = stepPlayer({ x: 5, y: 5 }, { x: -1, y: -1 }, 1000);
    expect(next).toEqual({ x: PLAYER_RADIUS, y: PLAYER_RADIUS });
  });
});
