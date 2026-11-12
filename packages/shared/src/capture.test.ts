import { describe, expect, it } from "vitest";
import {
  AIM,
  BALL_DROP_MS,
  BALL_FLIGHT_MS,
  BALL_SHAKE_MS,
  PARTY_FULL_TEXT,
  type AimCandidate,
  aimScore,
  captureChance,
  captureRevealMs,
  captureShakes,
  throwBlocker,
  throwTarget,
} from "./capture.ts";
import { MAX_PARTY, THROW_RANGE } from "./constants.ts";

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

/** A candidate `dx` px to the right of the thrower (`dy` px down), full health unless `extra` says otherwise. */
function pal(id: string, dx: number, dy = 0, extra: Partial<AimCandidate> = {}): AimCandidate {
  return { id, x: dx, y: dy, hp: 40, maxHp: 40, dizzy: false, boss: false, inBall: false, ...extra };
}

const FROM = { x: 0, y: 0 };
const pick = (pals: AimCandidate[], current = "") => throwTarget(FROM, pals, pals.length, current)?.id;

describe("throwTarget", () => {
  it("picks the nearest healthy pal within THROW_RANGE, exactly at the limit included", () => {
    expect(pick([pal("far", 100), pal("near", 60)])).toBe("near");
    expect(pick([pal("edge", THROW_RANGE)])).toBe("edge");
    expect(pick([pal("out", THROW_RANGE + 0.5)])).toBeUndefined();
    expect(pick([])).toBeUndefined();
  });

  it("skips the boss and pals in a ball even when they are nearest", () => {
    expect(pick([pal("boss", 20, 0, { boss: true }), pal("ball", 30, 0, { inBall: true }), pal("leaf", 100)])).toBe("leaf");
    expect(pick([pal("boss", 20, 0, { boss: true }), pal("ball", 30, 0, { inBall: true })])).toBeUndefined();
  });

  it("prefers hurt and dizzy pals when nearly as close (the design table)", () => {
    expect(pick([pal("healthy", 36), pal("hurt", 38, 0, { hp: 1 })])).toBe("hurt");
    expect(pick([pal("healthy", 10), pal("hurt", 40, 0, { hp: 1 })])).toBe("healthy");
    expect(pick([pal("healthy", 5), pal("dizzy", 48, 0, { hp: 1, dizzy: true })])).toBe("dizzy");
    expect(pick([pal("healthy", 100), pal("dizzy", 150, 0, { hp: 1, dizzy: true })])).toBe("healthy");
    expect(pick([pal("hurt", 60, 0, { hp: 20 }), pal("dizzy", 60, 0, { hp: 1, dizzy: true })])).toBe("dizzy");
  });

  it("gives a dizzy pal only the dizzy bonus, not dizzy plus hurt", () => {
    const dizzy = pal("dizzy", 100, 0, { hp: 1, dizzy: true });
    expect(aimScore(FROM, dizzy)).toBe(100 - AIM.dizzyPx);
  });

  it("keeps the current pal unless another beats it by more than keepPx", () => {
    expect(pick([pal("a", 50), pal("b", 50 - AIM.keepPx)], "a")).toBe("a");
    expect(pick([pal("a", 50), pal("b", 50 - AIM.keepPx - 0.5)], "a")).toBe("b");
    expect(pick([pal("a", 50), pal("b", 40)], "")).toBe("b");
  });

  it("drops a current pal that can no longer be thrown at, even if nothing beats it", () => {
    expect(pick([pal("a", 50, 0, { inBall: true })], "a")).toBeUndefined();
    expect(pick([pal("a", 200)], "a")).toBeUndefined();
    expect(pick([pal("a", 50, 0, { boss: true })], "a")).toBeUndefined();
    expect(pick([pal("b", 80)], "gone")).toBe("b");
    expect(pick([pal("a", 50, 0, { inBall: true }), pal("b", 90)], "a")).toBe("b");
  });

  it("breaks score ties by true distance, then by array order", () => {
    // Equal scores: hurt at 54 (54 - 24 = 30) vs healthy at 30.
    expect(pick([pal("hurt", 54, 0, { hp: 1 }), pal("healthy", 30)])).toBe("healthy");
    expect(pick([pal("healthy", 30), pal("hurt", 54, 0, { hp: 1 })])).toBe("healthy");
    expect(pick([pal("first", 0, 70), pal("second", 70, 0)])).toBe("first");
  });

  it("only looks at the first `count` entries of a reused array", () => {
    const pals = [pal("a", 100), pal("stale", 10)];
    expect(throwTarget(FROM, pals, 1)?.id).toBe("a");
    expect(throwTarget(FROM, pals, 0)).toBeUndefined();
  });

  it("returns the very object in the array", () => {
    const pals = [pal("a", 100), pal("b", 50)];
    expect(throwTarget(FROM, pals, 2)).toBe(pals[1]);
  });

  it("agrees with aimScore on seeded random scenes", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let scene = 0; scene < 500; scene++) {
      const n = 1 + Math.floor(rnd() * 12);
      const pals: AimCandidate[] = [];
      for (let i = 0; i < n; i++) {
        pals.push(pal(`p${i}`, (rnd() - 0.5) * 440, (rnd() - 0.5) * 440, { hp: 1 + Math.floor(rnd() * 40), dizzy: rnd() < 0.2, boss: rnd() < 0.1, inBall: rnd() < 0.1 }));
      }
      const current = rnd() < 0.5 ? pals[Math.floor(rnd() * n)].id : "";
      const result = throwTarget(FROM, pals, n);
      const kept = throwTarget(FROM, pals, n, current);
      const scores = pals.map((p) => aimScore(FROM, p));
      const min = Math.min(...scores);
      if (min === Infinity) {
        expect(result).toBeUndefined();
        expect(kept).toBeUndefined();
        continue;
      }
      expect(aimScore(FROM, result!)).toBeCloseTo(min, 9);
      expect(kept).toBeDefined();
      expect(aimScore(FROM, kept!)).toBeLessThanOrEqual(min + AIM.keepPx + 1e-9);
      if (current === "") expect(kept).toBe(result);
    }
  });
});

describe("aimScore", () => {
  it("is Infinity for the boss, a pal in a ball and a pal out of range", () => {
    expect(aimScore(FROM, pal("a", 50, 0, { boss: true }))).toBe(Infinity);
    expect(aimScore(FROM, pal("a", 50, 0, { inBall: true }))).toBe(Infinity);
    expect(aimScore(FROM, pal("a", THROW_RANGE + 1))).toBe(Infinity);
  });

  it("is the distance minus the dizzy or hurt bonus", () => {
    expect(aimScore(FROM, pal("a", 100))).toBe(100);
    expect(aimScore(FROM, pal("a", 100, 0, { hp: 39 }))).toBe(100 - AIM.hurtPx);
    expect(aimScore(FROM, pal("a", 100, 0, { dizzy: true }))).toBe(100 - AIM.dizzyPx);
  });
});
