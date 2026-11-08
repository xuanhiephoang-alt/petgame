import { describe, expect, it } from "vitest";
import { SqliteStore, emptyProfile, isValidToken, sanitizeProfile } from "./store.ts";
import { DEFAULT_WORN, MAX_LEVEL, STARTER_WARDROBE, WORLD_HEIGHT, WORLD_WIDTH, xpToNext } from "@petgame/shared";

describe("profile store", () => {
  it("saves and loads a profile", () => {
    const store = new SqliteStore(":memory:");
    const profile = emptyProfile("Hiep");
    profile.pals.push({ id: "a1", speciesId: "leafkit", level: 3, xp: 10, assignment: "follow", alpha: true });
    profile.base = { x: 300, y: 400 };
    profile.resources.wood = 7;
    profile.look = { hair: "bun", hairColor: 2, skin: 3 };
    profile.wardrobe.push("sword");
    profile.worn = { outfit: "hoodie", hat: "cap", weapon: "sword" };
    store.save("token-1234567890ab", profile);
    expect(store.load("token-1234567890ab")).toEqual(profile);
    expect(store.load("missing-token-000000")).toBeUndefined();
    store.close();
  });

  it("validates tokens", () => {
    expect(isValidToken("3f2b6c1e-8a4d-4c55-9e0b-1a2b3c4d5e6f")).toBe(true);
    expect(isValidToken("short")).toBe(false);
    expect(isValidToken("x'; DROP TABLE profiles;--aaaaaaaa")).toBe(false);
    expect(isValidToken(42)).toBe(false);
  });

  it("drops malformed data", () => {
    const p = sanitizeProfile({
      name: "A very very long name indeed",
      pals: [
        { id: "ok1", speciesId: "leafkit", level: 999, xp: -5, assignment: "follow" },
        { id: "ok2", speciesId: "pebblet", level: 2, xp: 0, assignment: "follow" },
        { id: "bad", speciesId: "missingno", level: 1 },
        { id: "ok1", speciesId: "leafkit" },
        { id: "<script>", speciesId: "leafkit" },
      ],
      base: { x: 1e9, y: "nope" },
      resources: { wood: 3.7, stone: -1, berries: "x" },
      baseLevel: 99,
      savedAt: 1e15,
    })!;
    expect(p.baseLevel).toBe(3);
    expect(p.savedAt).toBeLessThanOrEqual(Date.now());
    expect(p.name.length).toBeLessThanOrEqual(16);
    expect(p.pals.map((x) => x.id)).toEqual(["ok1", "ok2"]);
    expect(p.pals[0].level).toBe(30);
    expect(p.pals[0].xp).toBe(0);
    expect(p.pals[1].assignment).toBe(""); // only one follower allowed
    expect(p.base).toEqual({ x: WORLD_WIDTH, y: WORLD_HEIGHT / 2 });
    expect(p.quest).toEqual({ index: 0, progress: 0 });
    expect(p.resources).toEqual({ wood: 3, stone: 0, berries: 0 });
    expect(p.items).toEqual({ greatBalls: 0, snacks: 0, raft: 0 });
    expect(p.look).toBeNull();
    expect(p.wardrobe).toEqual(STARTER_WARDROBE);
    expect(p.worn).toEqual(DEFAULT_WORN);
  });

  it("reads pals saved before pack leaders were marked as common pals, and keeps the mark only when it is true", () => {
    const saved = (id: string, extra: object) => ({ id, speciesId: "leafkit", level: 3, xp: 0, assignment: "", ...extra });
    const p = sanitizeProfile({
      pals: [saved("a1", {}), saved("a2", { alpha: true }), saved("a3", { alpha: "yes" }), saved("a4", { alpha: 1 })],
    })!;
    expect(p.pals.map((x) => x.alpha)).toEqual([false, true, false, false]);
    expect(sanitizeProfile(p)).toEqual(p);
  });

  it("levels up pals saved under the old curve, never down, keeping their XP", () => {
    const saved = (id: string, level: number, xp: number) => ({ id, speciesId: "leafkit", level, xp, assignment: "" });
    const p = sanitizeProfile({
      // The first two hold the most the old curve allowed (it asked 294 and 1,048 to go on), enough for a level now.
      pals: [saved("a1", 6, 293), saved("a2", 14, 1047), saved("a3", 3, 10), saved("a4", 30, 500), saved("a5", 1, 1e9)],
    })!;
    expect(p.pals.map((x) => [x.level, x.xp])).toEqual([
      [7, 293 - xpToNext(6)],
      [15, 1047 - xpToNext(14)],
      [3, 10], // nothing to add up: unchanged
      [MAX_LEVEL, 0],
      [MAX_LEVEL, 0],
    ]);
    for (const x of p.pals) if (x.level < MAX_LEVEL) expect(x.xp, x.id).toBeLessThan(xpToNext(x.level));
    expect(sanitizeProfile(p)).toEqual(p); // reading what was read again changes nothing
  });

  it("at every level, whatever XP the old curve let a pal hold: never down, at most one up, not a point lost", () => {
    const oldPrice = (level: number) => Math.round(20 * Math.pow(level, 1.5)); // xpToNext before levels got cheaper
    const read = (level: number, xp: number) => sanitizeProfile({ pals: [{ id: "a", speciesId: "leafkit", level, xp, assignment: "" }] })!.pals[0];
    let climbed = 0;
    for (let level = 1; level < MAX_LEVEL; level++) {
      // A pal could save anything below the old price of its level.
      for (const xp of new Set([0, 1, xpToNext(level) - 1, xpToNext(level), Math.floor(oldPrice(level) / 2), oldPrice(level) - 1])) {
        const where = `level ${level}, ${xp} XP`;
        const pal = read(level, xp);
        const gained = pal.level - level;
        expect(gained, where).toBeGreaterThanOrEqual(0);
        expect(gained, where).toBeLessThanOrEqual(1);
        expect(gained === 1, where).toBe(xp >= xpToNext(level)); // it climbs exactly when the leftover pays the new price
        // What is left over is kept (at the top level there is nothing left to earn, so it reads 0 as it always has).
        expect(pal.xp, where).toBe(pal.level === MAX_LEVEL ? 0 : gained === 1 ? xp - xpToNext(level) : xp);
        if (pal.level < MAX_LEVEL) expect(pal.xp, where).toBeLessThan(xpToNext(pal.level));
        expect(read(pal.level, pal.xp), where).toEqual(pal); // reading it again moves nothing
        climbed += gained;
      }
    }
    expect(climbed).toBeGreaterThan(0); // the old saves really do have XP the new curve pays out
  });

  it("keeps at most one of each gear", () => {
    const p = sanitizeProfile({ items: { raft: 7, greatBalls: 4 } })!;
    expect(p.items).toEqual({ greatBalls: 4, snacks: 0, raft: 1 });
  });

  it("keeps clothes and weapons owned, and wears only those", () => {
    const p = sanitizeProfile({
      wardrobe: ["sword", "sword", "laser", 7, "aodai"],
      worn: { outfit: "aodai", hat: "crown", weapon: "sword" }, // no crown in the wardrobe
      look: { hair: "curly", hairColor: 99, skin: 2 },
    })!;
    expect(p.wardrobe).toEqual([...STARTER_WARDROBE, "sword", "aodai"]);
    expect(p.worn).toEqual({ outfit: "aodai", hat: "", weapon: "sword" });
    expect(p.look).toEqual({ hair: "curly", hairColor: 0, skin: 2 });
  });

  it("moves the coat and hat crafted before the wardrobe into it", () => {
    const p = sanitizeProfile({ items: { coat: 1, hat: 1, raft: 1 } })!;
    expect(p.wardrobe).toContain("coat");
    expect(p.wardrobe).toContain("nonla");
    expect(p.items.raft).toBe(1);
  });
});
