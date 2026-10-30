import { describe, expect, it } from "vitest";
import { BALL_DROP_MS, BALL_FLIGHT_MS, BALL_SHAKE_MS, captureChance, captureRevealMs, captureShakes } from "./capture.ts";

describe("captureChance", () => {
  it("equals catchRate at full HP", () => {
    expect(captureChance(40, 40, 0.5)).toBeCloseTo(0.5);
  });

  it("rises as HP drops", () => {
    const full = captureChance(40, 40, 0.3);
    const half = captureChance(20, 40, 0.3);
    const low = captureChance(1, 40, 0.3);
    expect(half).toBeGreaterThan(full);
    expect(low).toBeGreaterThan(half);
  });

  it("stays within 0..1", () => {
    expect(captureChance(0, 40, 2, 3)).toBeLessThanOrEqual(1);
    expect(captureChance(-5, 40, 0.1)).toBeLessThanOrEqual(1);
    expect(captureChance(10, 0, 0.5)).toBe(0);
  });
});

describe("ball wobbles", () => {
  it("wobbles three times before a catch, one or two before an escape", () => {
    expect(captureShakes(true, 0.5, 0.1)).toBe(3);
    expect(captureShakes(false, 0.5, 0.55)).toBe(2);
    expect(captureShakes(false, 0.5, 0.95)).toBe(1);
  });

  it("takes the throw, the drop and each wobble to reveal", () => {
    expect(captureRevealMs(3)).toBe(BALL_FLIGHT_MS + BALL_DROP_MS + 3 * BALL_SHAKE_MS);
    expect(captureRevealMs(1)).toBeLessThan(captureRevealMs(2));
  });
});
