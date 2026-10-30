import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS, PLAYER_SPEED } from "./constants.ts";
import { DASH_MS, DASH_SPEED, normalizeInput, stepPlayer, stepWithDash } from "./movement.ts";

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

describe("dash", () => {
  it("covers DASH_SPEED * DASH_MS however the time is cut into steps", () => {
    let pos = { x: 1000, y: 1000 };
    let leftMs = DASH_MS;
    for (let i = 0; i < 10; i++) ({ pos, dashLeftMs: leftMs } = stepWithDash(pos, { x: 0, y: 0 }, 50, { dir: { x: 1, y: 0 }, leftMs }));
    expect(pos.x).toBeCloseTo(1000 + (DASH_SPEED * DASH_MS) / 1000);
    expect(leftMs).toBe(0);
  });

  it("walks for the rest of a step once the dash ends", () => {
    const { pos } = stepWithDash({ x: 1000, y: 1000 }, { x: 0, y: 1 }, 100, { dir: { x: 1, y: 0 }, leftMs: 40 });
    expect(pos.x).toBeCloseTo(1000 + DASH_SPEED * 0.04);
    expect(pos.y).toBeCloseTo(1000 + PLAYER_SPEED * 0.06);
  });

  it("moves at the given speed", () => {
    expect(stepPlayer({ x: 100, y: 100 }, { x: 1, y: 0 }, 100, undefined, undefined, 300).x).toBeCloseTo(130);
  });
});
