import { describe, expect, it } from "vitest";
import { SqliteStore, emptyProfile, isValidToken, sanitizeProfile } from "./store.ts";

describe("profile store", () => {
  it("saves and loads a profile", () => {
    const store = new SqliteStore(":memory:");
    const profile = emptyProfile("Hiep");
    profile.pals.push({ id: "a1", speciesId: "leafkit", level: 3, xp: 10, assignment: "follow" });
    profile.base = { x: 300, y: 400 };
    profile.resources.wood = 7;
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
    expect(p.base).toEqual({ x: 1600, y: 600 });
    expect(p.resources).toEqual({ wood: 3, stone: 0, berries: 0 });
    expect(p.items).toEqual({ greatBalls: 0, snacks: 0 });
  });
});
