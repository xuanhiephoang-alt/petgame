import { describe, expect, it } from "vitest";
import { WILD_ATTACK_RANGE } from "@petgame/shared";
import { findNearestTarget, stepChase } from "./wildCombat.ts";

describe("wild combat", () => {
  const targets = [
    { kind: "player" as const, id: "a", pos: { x: 100, y: 0 } },
    { kind: "companion" as const, id: "b", pos: { x: 60, y: 0 } },
  ];

  it("picks the nearest target in sight", () => {
    expect(findNearestTarget({ x: 0, y: 0 }, 120, targets)?.id).toBe("b");
    expect(findNearestTarget({ x: 0, y: 0 }, 50, targets)).toBeUndefined();
  });

  it("chases until it can bite", () => {
    let pos = { x: 0, y: 0 };
    let inRange = false;
    for (let i = 0; i < 40 && !inRange; i++) ({ pos, inRange } = stepChase(pos, { x: 300, y: 0 }, 150, 50, 14));
    expect(inRange).toBe(true);
    expect(300 - pos.x).toBeLessThanOrEqual(WILD_ATTACK_RANGE);
  });
});
