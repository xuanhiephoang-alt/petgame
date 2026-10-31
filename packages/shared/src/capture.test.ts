import { describe, expect, it } from "vitest";
import {
  BALL_DROP_MS,
  BALL_FLIGHT_MS,
  BALL_SHAKE_MS,
  PARTY_FULL_TEXT,
  captureChance,
  captureRevealMs,
  captureShakes,
  throwBlocker,
} from "./capture.ts";
import { MAX_PARTY } from "./constants.ts";

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

describe("throwBlocker", () => {
  const wild = { boss: false };

  it("lets a ball fly while the party has room", () => {
    expect(throwBlocker(0, wild)).toBeUndefined();
    expect(throwBlocker(MAX_PARTY - 1, wild)).toBeUndefined();
  });

  it("refuses once the party is full, or somehow over", () => {
    expect(throwBlocker(MAX_PARTY, wild)).toBe(PARTY_FULL_TEXT);
    expect(throwBlocker(MAX_PARTY + 3, wild)).toBe(PARTY_FULL_TEXT);
  });

  it("tells the player which way out there is, naming the button and the limit", () => {
    expect(PARTY_FULL_TEXT).toContain(`${MAX_PARTY}/${MAX_PARTY}`);
    expect(PARTY_FULL_TEXT).toContain("Thả bớt");
    // The old text told players to do something no button could do (a regex, so the old wording is not repeated in the code).
    expect(PARTY_FULL_TEXT).not.toMatch(/cho\s+bớt/i);
  });

  it("never lets the boss be caught, whatever the party size (the boss is judged first)", () => {
    expect(throwBlocker(0, { boss: true })).toContain("trùm");
    expect(throwBlocker(MAX_PARTY, { boss: true })).toContain("trùm");
    expect(throwBlocker(MAX_PARTY, { boss: true })).not.toBe(PARTY_FULL_TEXT);
  });
});
