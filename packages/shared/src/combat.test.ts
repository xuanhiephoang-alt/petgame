import { describe, expect, it } from "vitest";
import { CollisionGrid } from "./collision.ts";
import { PLAYER_SPEED } from "./constants.ts";
import {
  BITE_KNOCKBACK,
  FLEE_STEER,
  PLAYER_MAX_HP,
  WILD_CHASE_SPEED_FACTOR,
  WILD_FLEE_SPEED_CAP,
  fleeDirection,
  fleeSpeed,
  hitWildPal,
  knockback,
  palDrops,
  steerFlee,
  wildDamage,
  type FleeSteerState,
} from "./combat.ts";
import { NavGrid } from "./pathfind.ts";
import { buildTerrain } from "./terrain.ts";
import { PAL_SPECIES, getSpecies } from "./pals.ts";
import { companionDamage, wildMaxLevel } from "./progression.ts";
import { isSupport, knownSkills, skillPower, wildSkillLevel } from "./skills.ts";

describe("hitting wild pals", () => {
  it("never drops below 1 HP, and 1 HP makes it dizzy", () => {
    expect(hitWildPal(40, 10, false, true)).toEqual({ hp: 30, dizzy: false, knockedOut: false });
    expect(hitWildPal(8, 10, false, true)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
    expect(hitWildPal(8, 10, false, false)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
  });

  it("knocks out a dizzy pal only with a player's hit", () => {
    expect(hitWildPal(1, 10, true, true)).toEqual({ hp: 0, dizzy: false, knockedOut: true });
    expect(hitWildPal(1, 10, true, false)).toEqual({ hp: 1, dizzy: true, knockedOut: false });
  });
});

describe("knockback", () => {
  it("pushes straight away from the attacker", () => {
    const next = knockback({ x: 100, y: 100 }, { x: 80, y: 100 }, BITE_KNOCKBACK, 10);
    expect(next.x).toBeCloseTo(100 + BITE_KNOCKBACK);
    expect(next.y).toBeCloseTo(100);
  });

  it("slides off obstacles, stays in the world and stops where it is blocked", () => {
    const grid = new CollisionGrid([{ x: 130, y: 100, r: 20 }]);
    const next = knockback({ x: 100, y: 100 }, { x: 90, y: 100 }, 30, 10, grid);
    expect(Math.hypot(next.x - 130, next.y - 100)).toBeGreaterThanOrEqual(29.9);
    expect(knockback({ x: 8, y: 50 }, { x: 30, y: 50 }, 30, 6).x).toBe(6);
    expect(knockback({ x: 100, y: 100 }, { x: 80, y: 100 }, 20, 10, undefined, () => true)).toEqual({ x: 100, y: 100 });
  });

  it("pushes down the screen when both stand on one spot", () => {
    expect(knockback({ x: 50, y: 50 }, { x: 50, y: 50 }, 10, 5)).toEqual({ x: 50, y: 60 });
  });
});

describe("loot of knocked-out pals", () => {
  const seq = (...values: number[]) => () => values.shift() ?? 0.99;

  it("drops a resource of the pal's element, more at higher levels", () => {
    expect(palDrops(getSpecies("pebblet"), 1, seq(0, 0.9, 0.9))).toEqual({ stone: 1 });
    expect(palDrops(getSpecies("pebblet"), 8, seq(0, 0.1, 0.9))).toEqual({ stone: 4 });
    expect(palDrops(getSpecies("emberpup"), 1, seq(0, 0.9, 0.9))).toEqual({ wood: 1 });
  });

  it("sometimes adds a snack", () => {
    expect(palDrops(getSpecies("emberpup"), 1, seq(0, 0.9, 0.05)).snacks).toBe(1);
  });
});

describe("wild pals' bites", () => {
  it("bite as hard as their kind's attack at level 1, a little harder each level, never less at a higher level", () => {
    for (const s of PAL_SPECIES) {
      expect(wildDamage(s, 1), s.id).toBe(s.attack);
      for (let level = 2; level <= 30; level++) expect(wildDamage(s, level), `${s.id} Lv ${level}`).toBeGreaterThanOrEqual(wildDamage(s, level - 1));
    }
  });

  it("a level 14 bite is about twice a level 1 bite (Coralcrab 10 -> 20), not three times", () => {
    expect(wildDamage(getSpecies("coralcrab"), 14)).toBe(20);
    expect(wildDamage(getSpecies("boulderhorn"), 11)).toBe(18);
    expect(wildDamage(getSpecies("emberpup"), 6)).toBe(10);
  });

  it("companions keep their +15% a level", () => {
    expect(companionDamage(9)).toBe(13);
    expect(companionDamage(15)).toBe(19);
  });

  it("no common wild pal knocks out a full-health player in three hits", () => {
    for (const s of PAL_SPECIES) {
      for (let level = 1; level <= wildMaxLevel(1); level++) {
        expect(3 * wildDamage(s, level), `${s.id} Lv ${level} bite`).toBeLessThan(PLAYER_MAX_HP);
        for (const k of knownSkills(s, level)) {
          if (isSupport(k)) continue;
          expect(3 * skillPower(k, wildSkillLevel(level)), `${s.id} Lv ${level} ${k.id}`).toBeLessThan(PLAYER_MAX_HP);
        }
      }
    }
  });
});

describe("fleeing passive pals", () => {
  it("Voltmouse and Mothlume are capped at 0.6 of a player's speed", () => {
    expect(WILD_FLEE_SPEED_CAP).toBeCloseTo(96);
    expect(fleeSpeed(getSpecies("voltmouse").speed)).toBe(WILD_FLEE_SPEED_CAP);
    expect(fleeSpeed(getSpecies("mothlume").speed)).toBe(WILD_FLEE_SPEED_CAP);
  });

  it("slower pals keep their chase speed", () => {
    expect(fleeSpeed(getSpecies("leafkit").speed)).toBeCloseTo(90);
    expect(fleeSpeed(getSpecies("bubbloon").speed)).toBeCloseTo(72);
    expect(fleeSpeed(getSpecies("bogbloom").speed)).toBeCloseTo(72);
    for (let speed = 10; speed * WILD_CHASE_SPEED_FACTOR <= WILD_FLEE_SPEED_CAP; speed += 5) {
      expect(fleeSpeed(speed)).toBe(speed * WILD_CHASE_SPEED_FACTOR);
    }
  });

  it("every passive pal runs away slower than a walking player", () => {
    for (const s of PAL_SPECIES.filter((p) => p.temperament === "passive")) {
      expect(fleeSpeed(s.speed)).toBeLessThanOrEqual(PLAYER_SPEED * 0.6 + 1e-9);
      expect(fleeSpeed(s.speed)).toBeLessThan(PLAYER_SPEED);
    }
  });
});

describe("fleeing toward open ground", () => {
  const C = { x: 3200, y: 2560 };
  const R = 12;
  const attacker = { x: C.x - 30, y: C.y };
  const trees = (pts: { x: number; y: number }[]) => new NavGrid(new CollisionGrid(pts.map((p) => ({ ...p, r: 14 }))));
  const clearRay = (nav: NavGrid, pos: { x: number; y: number }, dir: { x: number; y: number }, radius = R) =>
    nav.lineClear(pos, { x: pos.x + dir.x * FLEE_STEER.lookaheadPx, y: pos.y + dir.y * FLEE_STEER.lookaheadPx }, { radius, sea: false });
  const oneTree = () => trees([{ x: C.x + 40, y: C.y }]);

  it("runs straight away over open ground", () => {
    const c = fleeDirection(C, attacker, R, trees([]));
    expect(c.heading).toBe("ahead");
    expect(c.x).toBeCloseTo(1);
    expect(c.y).toBeCloseTo(0);
  });

  it("slips to the side of a tree right behind it", () => {
    const nav = oneTree();
    const c = fleeDirection(C, attacker, R, nav);
    expect(c.heading).toBe("ahead");
    expect(c.x).toBeLessThan(Math.cos((17.5 * Math.PI) / 180) - 1e-6);
    expect(c.x).toBeGreaterThanOrEqual(Math.cos((70 * Math.PI) / 180) - 1e-6);
    expect(clearRay(nav, C, c)).toBe(true);
    expect(clearRay(nav, C, { x: 1, y: 0 })).toBe(false);
  });

  it("falls back to a wider heading when a wall of trees blocks every forward one", () => {
    const wall = [];
    for (let y = C.y - 120; y <= C.y + 120; y += 20) wall.push({ x: C.x + 40, y });
    const nav = trees(wall);
    const c = fleeDirection(C, attacker, R, nav);
    expect(c.heading).toBe("around");
    expect(clearRay(nav, C, c)).toBe(true);
    expect(Math.acos(c.x)).toBeGreaterThan((70 * Math.PI) / 180);
  });

  it("runs along the shore instead of into the sea", () => {
    const terrain = buildTerrain((x) => (x < 3000 ? "sea" : "meadow"));
    const nav = new NavGrid(new CollisionGrid([]), terrain);
    const pos = { x: 3024, y: C.y };
    const c = fleeDirection(pos, { x: 3054, y: C.y }, R, nav);
    expect(c.heading).toBe("around");
    expect(Math.abs(c.y)).toBeGreaterThan(0.99);
    expect(clearRay(nav, pos, c)).toBe(true);
    expect(clearRay(nav, pos, { x: -1, y: 0 })).toBe(false);
    const diag = fleeDirection(pos, { x: 3054, y: C.y - 20 }, R, nav);
    expect(diag.heading).toBe("ahead");
    expect(diag.y).toBeGreaterThan(0);
    expect(clearRay(nav, pos, diag)).toBe(true);
  });

  it("runs straight away when boxed in", () => {
    const ring = [];
    for (let i = 0; i < 40; i++) ring.push({ x: C.x + Math.cos((i / 40) * 2 * Math.PI) * 50, y: C.y + Math.sin((i / 40) * 2 * Math.PI) * 50 });
    const c = fleeDirection(C, attacker, R, trees(ring));
    expect(c.heading).toBe("straight");
    expect(c.x).toBeCloseTo(1);
    expect(c.y).toBeCloseTo(0);
  });

  it("runs down the screen when standing on the attacker", () => {
    const c = fleeDirection(C, C, R, trees([]));
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(1);
  });

  it("holds a heading for 250 ms unless told to choose again", () => {
    const nav = trees([]);
    const state: FleeSteerState = { dirX: 0, dirY: 0, steerUntil: 0 };
    expect(steerFlee(state, C, attacker, R, nav, 0)).toBe(true);
    expect(state.dirX).toBeCloseTo(1);
    expect(state.steerUntil).toBe(250);
    const east = { x: C.x + 30, y: C.y };
    expect(steerFlee(state, C, east, R, nav, 200)).toBe(false);
    expect(state.dirX).toBeCloseTo(1);
    expect(steerFlee(state, C, east, R, nav, 250)).toBe(true);
    expect(state.dirX).toBeCloseTo(-1);
    state.steerUntil = 0;
    expect(steerFlee(state, C, east, R, nav, 300)).toBe(true);
  });

  it("keeps the tuned numbers", () => {
    expect(FLEE_STEER.samples % 2).toBe(1);
    expect(FLEE_STEER.halfAngleDeg).toBeLessThan(90);
    expect(FLEE_STEER.holdMs).toBe(250);
    expect(FLEE_STEER.lookaheadPx).toBe(96);
    expect(FLEE_STEER.fallbackSamples).toBe(16);
  });

  it("is deterministic", () => {
    const nav = oneTree();
    expect(fleeDirection(C, attacker, R, nav)).toEqual(fleeDirection(C, attacker, R, nav));
  });
});
