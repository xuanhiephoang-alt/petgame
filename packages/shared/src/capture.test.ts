import { describe, expect, it } from "vitest";
import { captureChance } from "./capture.ts";

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
