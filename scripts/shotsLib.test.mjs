import { describe, expect, it } from "vitest";
import { ALPHA, AGGRESSIVE_SIGHT, BOSS, alphaLairs, defaultWorld, terrainAt } from "@petgame/shared";
import {
  AIM_RETRY, AIM_SPOTS, ALPHA_GAP, ALPHA_SIDES, ALPHA_STAND, CALM, GROUPS, LAIR_CLEAR, PEOPLE, PHONE_SPOTS, RETREAT, SPOTS, STEADY_SLACK, THREAT_MARGIN,
  aimRetrySpots, compareReports, firstCalm, firstSafe, judgeScene, parseShotArgs, skillPhaseOk, standSpots, threats, toastTexts, toastsMatch,
} from "./shotsLib.mjs";

const world = defaultWorld();
const lairs = alphaLairs();
const lairList = [...lairs.values()];
const nearestLair = (p) => Math.min(...lairList.map((l) => Math.hypot(l.x - p.x, l.y - p.y)));
const terrain = (p) => terrainAt(world.layout.terrain, p.x, p.y);

describe("parseShotArgs", () => {
  it("runs every group by default", () => {
    expect(parseShotArgs([])).toEqual({ name: "latest", groups: GROUPS, noBuild: false });
    expect(GROUPS).toHaveLength(6);
  });
  it("takes --only, --name and --no-build", () => {
    expect(parseShotArgs(["--only", "toasts,skills"]).groups).toEqual(["skills", "toasts"]);
    const a = parseShotArgs(["--name", "x", "--no-build"]);
    expect(a.name).toBe("x");
    expect(a.noBuild).toBe(true);
  });
  it("names the wrong group and the right ones", () => {
    let message = "";
    try { parseShotArgs(["--only", "sprites"]); } catch (e) { message = e.message; }
    expect(message).toContain("sprites");
    for (const g of GROUPS) expect(message).toContain(g);
  });
  it("reads --compare", () => {
    expect(parseShotArgs(["--compare", "a", "b"]).compare).toEqual(["a", "b"]);
    expect(() => parseShotArgs(["--compare", "a"])).toThrow();
  });
});

describe("fixed spots", () => {
  it("each world spot is in its terrain, out of every lair's reach", () => {
    for (const [file, x, y, , want] of SPOTS) {
      expect(terrain({ x, y }), file).toBe(want);
      if (want !== "sea") expect(nearestLair({ x, y }), file).toBeGreaterThanOrEqual(LAIR_CLEAR);
    }
    for (const [file, x, y] of [...PHONE_SPOTS, ...AIM_SPOTS]) expect(nearestLair({ x, y }), file).toBeGreaterThanOrEqual(LAIR_CLEAR);
  });
  it("the four moved spots do not touch a tree or rock", () => {
    for (const file of ["snow", "desert", "swamp", "island"]) {
      const [, x, y] = SPOTS.find((s) => s[0] === file);
      expect(world.grid.blocked({ x, y }, 30), file).toBe(false);
    }
  });
  it("island stands out of the Coralcrab leader's reach", () => {
    const [, x, y] = SPOTS.find((s) => s[0] === "island");
    const lair = lairs.get("island");
    // It roams ALPHA.roam around its lair and bites whoever comes within ALPHA.sight.
    expect(Math.hypot(lair.x - x, lair.y - y)).toBeGreaterThan(ALPHA.roam + ALPHA.sight);
  });
  it("calm spots and the retreat are open meadow far from every lair", () => {
    for (const p of [...CALM, RETREAT, PEOPLE]) {
      expect(terrain(p)).toBe("meadow");
      expect(world.grid.blocked(p, 30)).toBe(false);
      expect(nearestLair(p)).toBeGreaterThanOrEqual(LAIR_CLEAR);
    }
  });
});

describe("aimRetrySpots", () => {
  it("leaves at least 4 valid tries per aim scene, on land and out of every lair's reach", () => {
    expect(AIM_RETRY[0]).toEqual([0, 0]);
    for (const [file, x, y] of AIM_SPOTS) {
      const spots = aimRetrySpots({ x, y }, world, lairs);
      expect(spots.length, file).toBeGreaterThanOrEqual(4);
      for (const p of spots) {
        expect(p.x).toBeGreaterThanOrEqual(100);
        expect(terrain(p)).not.toBe("sea");
        expect(nearestLair(p)).toBeGreaterThanOrEqual(LAIR_CLEAR);
      }
    }
  });
});

describe("standSpots", () => {
  const anchors = [...lairs.values()].filter((_, i) => [0, 3, 5].includes(i)); // meadow, snow, island
  const alphas = [];
  for (const l of anchors) {
    alphas.push(l);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      alphas.push({ x: l.x + Math.cos(a) * ALPHA.roam, y: l.y + Math.sin(a) * ALPHA.roam });
    }
  }
  it("finds a spot in every view, ALPHA_STAND (over ALPHA_GAP) away, on land and in the open", () => {
    for (const alpha of alphas) {
      for (const view of ["desktop", "portrait", "landscape"]) {
        const spots = standSpots(alpha, view, world, lairs);
        expect(spots.length, `${view} ${alpha.x},${alpha.y}`).toBeGreaterThanOrEqual(1);
        for (const s of spots) {
          expect(Math.abs(Math.hypot(s.x - alpha.x, s.y - alpha.y) - ALPHA_STAND)).toBeLessThanOrEqual(1);
          expect(terrain(s)).not.toBe("sea");
          expect(world.grid.blocked(s, 20)).toBe(false);
        }
      }
    }
  });
  it("takes another distance when asked", () => {
    const [s] = standSpots(lairs.get("island"), "desktop", world, lairs, ALPHA_GAP + 4);
    expect(Math.abs(Math.hypot(s.x - lairs.get("island").x, s.y - lairs.get("island").y) - (ALPHA_GAP + 4))).toBeLessThanOrEqual(1);
  });
  it("stands farther than the gap the shot needs", () => {
    expect(ALPHA_STAND).toBeGreaterThan(ALPHA_GAP);
    expect(ALPHA_GAP).toBe(ALPHA.sight + THREAT_MARGIN + 56);
    // Wherever the leader roams from its lair, it stays at least sight + margin from a player standing so.
    expect(ALPHA_STAND - ALPHA.roam).toBeGreaterThanOrEqual(ALPHA.sight + THREAT_MARGIN);
  });
  it("follows the side order of the view", () => {
    for (const view of ["desktop", "portrait", "landscape"]) {
      for (const alpha of alphas) {
        const spots = standSpots(alpha, view, world, lairs);
        const sides = ALPHA_SIDES[view].map(([dx, dy]) => ({ x: Math.round(alpha.x - ALPHA_STAND * dx), y: Math.round(alpha.y - ALPHA_STAND * dy) }));
        const indexes = spots.map((s) => sides.findIndex((p) => p.x === s.x && p.y === s.y));
        expect(indexes.every((i) => i >= 0)).toBe(true);
        expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
      }
    }
  });
});

describe("threats", () => {
  const me = { x: 0, y: 0 };
  const pal = (speciesId, d, extra = {}) => ({ id: "p", speciesId, x: d, y: 0, alpha: false, boss: false, ...extra });
  it("counts a pack leader inside sight plus the margin only", () => {
    const reach = ALPHA.sight + THREAT_MARGIN;
    expect(threats({ me, companion: null, pals: [pal("voltmouse", reach - 1, { alpha: true })] })).toHaveLength(1);
    expect(threats({ me, companion: null, pals: [pal("voltmouse", reach + 1, { alpha: true })] })).toHaveLength(0);
  });
  it("counts an aggressive kind, not a passive one", () => {
    const reach = AGGRESSIVE_SIGHT + THREAT_MARGIN;
    expect(threats({ me, companion: null, pals: [pal("scorchtail", reach - 1)] })).toHaveLength(1);
    expect(threats({ me, companion: null, pals: [pal("scorchtail", reach + 1)] })).toHaveLength(0);
    expect(threats({ me, companion: null, pals: [pal("leafkit", 10)] })).toHaveLength(0);
  });
  it("adds the boss radius for the boss", () => {
    const d = AGGRESSIVE_SIGHT + THREAT_MARGIN + BOSS.radius - 1;
    expect(threats({ me, companion: null, pals: [pal(BOSS.speciesId, d, { boss: true })] })).toHaveLength(1);
    expect(threats({ me, companion: null, pals: [pal(BOSS.speciesId, d)] })).toHaveLength(0);
  });
  it("takes a wider margin when asked, and picks the first safe spot", () => {
    const p = pal("scorchtail", 200);
    expect(threats({ me, companion: null, pals: [p] })).toHaveLength(0);
    expect(threats({ me, companion: null, pals: [p] }, 100)).toHaveLength(1);
    expect(firstSafe([{ x: 0, y: 0 }, { x: 1000, y: 0 }], [p], 100)).toEqual({ x: 1000, y: 0 });
    expect(firstSafe([{ x: 0, y: 0 }], [p], 100)).toBeUndefined();
  });
  it("measures from the follower too", () => {
    const p = pal("voltmouse", 400, { alpha: true });
    expect(threats({ me, companion: { x: 300, y: 0 }, pals: [p] })).toHaveLength(1);
  });
});

describe("judgeScene", () => {
  const state = (extra = {}) => ({ me: { x: 100, y: 100 }, hp: 100, maxHp: 100, hurt: 0, toasts: [], total: 0, companion: null, pals: [], ...extra });
  const need = { toasts: "none" };
  it("accepts an unchanged scene", () => {
    expect(judgeScene(state(), state(), need)).toMatchObject({ ok: true });
  });
  it("gives one reason per fault", () => {
    expect(judgeScene(state(), state({ hurt: 1 }), need)).toMatchObject({ ok: false, kind: "hurt" });
    expect(judgeScene(state(), state({ hp: 99 }), need)).toMatchObject({ ok: false, kind: "hp" });
    expect(judgeScene(state(), state({ me: { x: 107, y: 100 } }), need)).toMatchObject({ ok: false, kind: "moved" });
    const near = [{ id: "a", speciesId: "voltmouse", x: 150, y: 100, alpha: true, boss: false }];
    expect(judgeScene(state({ pals: near }), state(), need)).toMatchObject({ ok: false, kind: "threat" });
    expect(judgeScene(state(), state({ toasts: ["x"], total: 1 }), need)).toMatchObject({ ok: false, kind: "toasts" });
    expect(judgeScene(state({ toasts: ["a"], total: 1 }), state({ toasts: ["b"], total: 1 }), { toasts: { count: 1 } })).toMatchObject({ ok: false, kind: "toasts" });
    expect(judgeScene(state({ toasts: ["a", "b"], total: 2 }), state({ toasts: ["a", "b"], total: 2 }), { toasts: { count: 2 } })).toMatchObject({ ok: true });
  });
  it("matches toasts by text or count", () => {
    expect(toastsMatch(["a"], { toasts: ["a"], total: 1 })).toBe(true);
    expect(toastsMatch(["a"], { toasts: ["a", "b"], total: 2 })).toBe(false);
    expect(toastsMatch("none", { toasts: [], total: 1 })).toBe(false);
  });
});

describe("skillPhaseOk", () => {
  const at = (phase, travelMs = 500) => skillPhaseOk({ castMs: 650, travelMs, t0: 0, drawnAt: 650 + phase * travelMs });
  it("accepts 0.2 to 0.85 of the flight", () => {
    expect(at(0.19).ok).toBe(false);
    expect(at(0.2).ok).toBe(true);
    expect(at(0.85).ok).toBe(true);
    expect(at(0.86).ok).toBe(false);
  });
  it("rejects a flight too short to see", () => {
    expect(at(0.5, 249).ok).toBe(false);
    expect(at(0.5, 250).ok).toBe(true);
  });
});

describe("compareReports", () => {
  const row = (file, extra = {}) => ({ file, ok: true, sprites: 300, wild: 5, chests: 2, steady: 293, ...extra });
  const flagsOf = (a, b) => compareReports(a, b).rows.map((r) => r.flags);
  it("finds nothing in two equal reports", () => {
    expect(compareReports([row("a")], [row("a")])).toMatchObject({ flagged: 0 });
  });
  it("flags a scene whose steady count jumped (the old island)", () => {
    expect(flagsOf([row("island", { sprites: 163, steady: 150 })], [row("island", { sprites: 293, steady: 280 })])).toEqual([["scene changed"]]);
    expect(flagsOf([row("a")], [row("a", { steady: 293 + STEADY_SLACK })])).toEqual([[]]);
  });
  it("does not compare a scene that stood elsewhere, and says so", () => {
    const a = row("a", { me: { x: 3200, y: 2400 } });
    const b = row("a", { me: { x: 3600, y: 2700 }, steady: 332, sprites: 430 });
    expect(compareReports([a], [b])).toMatchObject({ flagged: 0, rows: [{ flags: [], notes: ["stood elsewhere"] }] });
    expect(flagsOf([a], [{ ...b, me: { x: 3210, y: 2400 } }])).toEqual([["scene changed"]]);
  });
  it("ignores wild pals", () => {
    expect(flagsOf([row("a")], [row("a", { sprites: 306, wild: 11 })])).toEqual([[]]);
  });
  it("flags missing and failed scenes", () => {
    expect(flagsOf([row("a")], [])).toEqual([["missing"]]);
    expect(flagsOf([row("a")], [{ file: "a", ok: false }])).toEqual([["failed"]]);
  });
  it("compares sprites when a report has no steady count", () => {
    const old = { file: "a", sprites: 100 };
    expect(flagsOf([old], [{ file: "a", sprites: 108 }])).toEqual([[]]);
    expect(flagsOf([old], [{ file: "a", sprites: 120 }])).toEqual([["sprites changed"]]);
  });
  it("flags the budget, label overlaps, a lost aim and toast overlaps", () => {
    expect(flagsOf([row("a")], [row("a", { sprites: 601 })])).toEqual([["over budget"]]);
    expect(flagsOf([row("a", { labels: { overlapping: 0 } })], [row("a", { labels: { overlapping: 1 } })])).toEqual([["label overlaps up"]]);
    expect(flagsOf([row("a", { aimsWeak: true })], [row("a", { aimsWeak: false })])).toEqual([["aim lost"]]);
    expect(flagsOf([row("a")], [row("a", { toastOverlaps: [{}] })])).toEqual([["toast overlap"]]);
  });
});

describe("firstCalm and toastTexts", () => {
  it("picks the first spot with no wild pal near", () => {
    const pals = [{ x: 3200, y: 2400 }];
    expect(firstCalm(CALM, pals, 300)).toEqual(CALM[3]);
    expect(firstCalm(CALM, [], 300)).toEqual(CALM[0]);
  });
  it("words the toasts from the game's tables", () => {
    const t = toastTexts(true);
    expect(t.long[0].text).toContain("Bắt");
    expect(t.reward[0].text).toContain("Giáp hiệp sĩ");
    expect(t.reward[1].text).toContain("Frostfang lên cấp 15");
    expect(t.burst).toHaveLength(6);
    expect(toastTexts(false).long[0].text).not.toBe(t.long[0].text);
  });
});
