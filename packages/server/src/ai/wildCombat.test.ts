import { describe, expect, it } from "vitest";
import { PLAYER_SPEED, WILD_ATTACK_RANGE, fleeSpeed, getSpecies } from "@petgame/shared";
import { findNearestTarget, stepChase, stepFlee } from "./wildCombat.ts";

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

  it("runs straight away when fleeing", () => {
    const next = stepFlee({ x: 100, y: 100 }, { x: 60, y: 100 }, 200, 100, 10);
    expect(next.x).toBeCloseTo(120);
    expect(next.y).toBeCloseTo(100);
  });

  it("a player walking after a fleeing Voltmouse closes in", () => {
    let pal = { x: 100, y: 0 };
    let player = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) {
      pal = stepFlee(pal, player, fleeSpeed(getSpecies("voltmouse").speed), 50, 12);
      const gap = pal.x - player.x;
      player = { x: player.x + Math.min(PLAYER_SPEED * 0.05, gap), y: 0 };
      expect(pal.x - player.x).toBeLessThanOrEqual(100 + 96 * 0.05 + 0.01);
    }
    expect(pal.x - player.x).toBeLessThan(40);
  });

  it("walks to a waypoint at full speed, but measures its bite range to the target", () => {
    const step = stepChase({ x: 0, y: 0 }, { x: 30, y: 0 }, 50, 1000, 10, undefined, 40, { x: 0, y: 100 });
    expect(step.pos).toEqual({ x: 0, y: 50 });
    expect(step.inRange).toBe(false);
    const target = { x: 200, y: 0 };
    expect(stepChase({ x: 0, y: 0 }, target, 50, 1000, 10, undefined, 40, target)).toEqual(
      stepChase({ x: 0, y: 0 }, target, 50, 1000, 10, undefined, 40),
    );
  });
});
