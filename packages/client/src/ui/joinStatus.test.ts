import { describe, expect, it } from "vitest";
import { EMPTY_WORLD_HOLD_MS, MAX_PLAYERS } from "@petgame/shared";
import type { JoinFailure } from "../net/connection.ts";
import { FRIENDS_STAY_MS, INVITE_HINT, RECENT_WORLDS_MAX, RETURN_HINT, RETURN_OFFER_MS, SEEN_EVERY_MS, arrival, arrivalHint, joinCard, recentWorlds, returnOffer, startCard, startFailure, withRecentWorld, withWorldClosed, type RecentWorld } from "./joinStatus.ts";

const ALL: JoinFailure[] = ["closed", "full", "unreachable", "busy", "tooMany", "failed"];

describe("arrival", () => {
  it("is new without ?room=, whatever the tab remembers", () => {
    expect(arrival(null, "X", "1")).toBe("new");
    expect(arrival("", "X", "0")).toBe("new");
  });

  it("is invited when ?room= is not the world this tab was in", () => {
    expect(arrival("X", "Y", "1")).toBe("invited");
    expect(arrival("X", null, null)).toBe("invited");
    expect(arrival("X", undefined, "0")).toBe("invited");
  });

  it("is backAlone when this tab was alone in that world", () => {
    expect(arrival("X", "X", "0")).toBe("backAlone");
  });

  it("is back when friends were there, or the tab is from before T49 and did not note it", () => {
    expect(arrival("X", "X", "1")).toBe("back");
    expect(arrival("X", "X", null)).toBe("back");
    expect(arrival("X", "X", undefined)).toBe("back");
  });

  it("words the lobby hint: only back and invited have one", () => {
    expect(arrivalHint("back")).toBe(RETURN_HINT);
    expect(arrivalHint("invited")).toBe(INVITE_HINT);
    expect(arrivalHint("backAlone")).toBe("");
    expect(arrivalHint("new")).toBe("");
  });
});

describe("arrival with the device's recent worlds", () => {
  it("knows a world this device was in, though this tab was not", () => {
    expect(arrival("X", "Y", "1", [{ room: "X", friends: false, seen: 0 }])).toBe("backAlone");
    expect(arrival("X", "Y", "1", [{ room: "X", friends: true, seen: 0 }])).toBe("back");
    expect(arrival("X", null, null, [{ room: "Z", friends: true, seen: 0 }])).toBe("invited");
  });

  it("lets the tab win over the device, and needs ?room= to be anything but new", () => {
    expect(arrival("X", "X", "0", [{ room: "X", friends: true, seen: 0 }])).toBe("backAlone");
    expect(arrival(null, null, null, [{ room: "X", friends: true, seen: 0 }])).toBe("new");
  });
});

describe("recentWorlds", () => {
  it("is empty for anything that is not a list", () => {
    for (const raw of [null, undefined, "x", 42, {}]) expect(recentWorlds(raw)).toEqual([]);
  });

  it("drops items that are not a world", () => {
    const raw = [null, 1, { room: "" }, { room: "A" }, { room: "A", friends: "yes" }, { room: "a".repeat(65), friends: true }];
    expect(recentWorlds(raw)).toEqual([]);
  });

  it("keeps room, friends and seen", () => {
    expect(recentWorlds([{ room: "A", friends: true, extra: 1 }])).toEqual([{ room: "A", friends: true, seen: 0 }]);
    expect(recentWorlds([{ room: "A", friends: true, seen: 5, extra: 1 }])).toEqual([{ room: "A", friends: true, seen: 5 }]);
  });

  it("keeps a world whose seen is missing or unusable, as 0", () => {
    for (const seen of ["5", Number.NaN, Number.POSITIVE_INFINITY, -1, 0, null]) {
      expect(recentWorlds([{ room: "A", friends: true, seen }])).toEqual([{ room: "A", friends: true, seen: 0 }]);
    }
  });

  it("keeps the first of a repeated room", () => {
    expect(recentWorlds([{ room: "A", friends: true }, { room: "B", friends: false }, { room: "A", friends: false }])).toEqual([
      { room: "A", friends: true, seen: 0 },
      { room: "B", friends: false, seen: 0 },
    ]);
  });

  it("keeps the first RECENT_WORLDS_MAX of a longer list", () => {
    const raw = Array.from({ length: 25 }, (_, i) => ({ room: `w${i}`, friends: i % 2 === 0 }));
    const list = recentWorlds(raw);
    expect(list).toHaveLength(RECENT_WORLDS_MAX);
    expect(list[0].room).toBe("w0");
    expect(list[19].room).toBe("w19");
  });
});

describe("withRecentWorld", () => {
  it("adds a world at the front with the time seen", () => {
    expect(withRecentWorld([{ room: "A", friends: true, seen: 1 }], "B", false, 7)).toEqual([
      { room: "B", friends: false, seen: 7 },
      { room: "A", friends: true, seen: 1 },
    ]);
  });

  it("moves a known world to the front with the new flag and time, once", () => {
    const list = [{ room: "A", friends: true, seen: 1 }, { room: "B", friends: true, seen: 2 }];
    expect(withRecentWorld(list, "B", false, 9)).toEqual([
      { room: "B", friends: false, seen: 9 },
      { room: "A", friends: true, seen: 1 },
    ]);
  });

  it("drops the oldest when full", () => {
    const list: RecentWorld[] = Array.from({ length: RECENT_WORLDS_MAX }, (_, i) => ({ room: `w${i}`, friends: true, seen: 0 }));
    const next = withRecentWorld(list, "new", true, 1);
    expect(next).toHaveLength(RECENT_WORLDS_MAX);
    expect(next[0].room).toBe("new");
    expect(next.some((w) => w.room === `w${RECENT_WORLDS_MAX - 1}`)).toBe(false);
  });

  it("does not change the list it is given", () => {
    const list = [{ room: "A", friends: true, seen: 1 }];
    const copy = structuredClone(list);
    withRecentWorld(list, "B", false, 2);
    withRecentWorld(list, "A", false, 2);
    expect(list).toEqual(copy);
  });

  it("remembers 20 worlds", () => {
    expect(RECENT_WORLDS_MAX).toBe(20);
  });
});

describe("withWorldClosed", () => {
  it("zeroes seen of that world only, keeping place and friends", () => {
    const list = [{ room: "A", friends: true, seen: 5 }, { room: "B", friends: true, seen: 6 }, { room: "C", friends: false, seen: 7 }];
    expect(withWorldClosed(list, "B")).toEqual([
      { room: "A", friends: true, seen: 5 },
      { room: "B", friends: true, seen: 0 },
      { room: "C", friends: false, seen: 7 },
    ]);
  });

  it("leaves the list as it is for an unknown room, and never changes its input", () => {
    const list = [{ room: "A", friends: true, seen: 5 }];
    const copy = structuredClone(list);
    expect(withWorldClosed(list, "Z")).toEqual(copy);
    withWorldClosed(list, "A");
    expect(list).toEqual(copy);
  });
});

describe("returnOffer", () => {
  const now = 1_000_000_000_000;
  const w = (room: string, friends: boolean, seen: number): RecentWorld => ({ room, friends, seen });

  it("never offers when the page was opened with ?room=; an empty one counts as none", () => {
    expect(returnOffer("X", [w("X", true, now - 60_000)], now)).toBeNull();
    expect(returnOffer("Y", [w("X", true, now - 60_000)], now)).toBeNull();
    expect(returnOffer("", [w("X", true, now - 60_000)], now)).toBe("X");
    expect(returnOffer(null, [w("X", true, now - 60_000)], now)).toBe("X");
  });

  it("offers nothing for an empty list", () => {
    expect(returnOffer(null, [], now)).toBeNull();
  });

  it("offers a world with friends seen a minute ago", () => {
    expect(returnOffer(null, [w("X", true, now - 60_000)], now)).toBe("X");
  });

  it("is inclusive at the edge of the window", () => {
    expect(returnOffer(null, [w("X", true, now - RETURN_OFFER_MS)], now)).toBe("X");
    expect(returnOffer(null, [w("X", true, now - RETURN_OFFER_MS - 1)], now)).toBeNull();
  });

  it("does not offer a recent solo world, nor one without a time", () => {
    expect(returnOffer(null, [w("X", false, now - 1000)], now)).toBeNull();
    expect(returnOffer(null, [w("X", true, 0)], now)).toBeNull();
  });

  it("picks the latest seen, not the first in the list", () => {
    expect(returnOffer(null, [w("Y", true, 0), w("X", true, now - 60_000)], now)).toBe("X");
    expect(returnOffer(null, [w("A", false, now - 30_000), w("B", true, now - 60_000)], now)).toBeNull();
  });

  it("picks the world seen last among several offerable ones, wherever it is in the list", () => {
    expect(returnOffer(null, [w("Old", true, now - 5 * 60_000), w("New", true, now - 60_000)], now)).toBe("New");
    expect(returnOffer(null, [w("New", true, now - 60_000), w("Old", true, now - 5 * 60_000)], now)).toBe("New");
  });

  it("accepts a small future time but ignores one beyond the window", () => {
    expect(returnOffer(null, [w("X", true, now + 30_000)], now)).toBe("X");
    expect(returnOffer(null, [w("Bad", true, now + RETURN_OFFER_MS + 1), w("X", true, now - 60_000)], now)).toBe("X");
    expect(returnOffer(null, [w("Bad", true, now + RETURN_OFFER_MS + 1)], now)).toBeNull();
  });

  it("takes the earlier entry on a tie", () => {
    expect(returnOffer(null, [w("A", false, now - 1000), w("B", true, now - 1000)], now)).toBeNull();
    expect(returnOffer(null, [w("A", true, now - 1000), w("B", false, now - 1000)], now)).toBe("A");
  });

  it("has a 10 minute window made of the empty-world hold and the friends' stay, and a timer well inside it", () => {
    expect(RETURN_OFFER_MS).toBe(EMPTY_WORLD_HOLD_MS + FRIENDS_STAY_MS);
    expect(RETURN_OFFER_MS).toBe(10 * 60_000);
    expect(SEEN_EVERY_MS).toBeLessThanOrEqual(RETURN_OFFER_MS / 10);
  });
});

describe("joinCard", () => {
  it("has a title and an explanation for every failure", () => {
    for (const failure of ALL) {
      const card = joinCard(failure, false);
      expect(card.title).not.toBe("");
      expect(card.detail).not.toBe("");
    }
  });

  it("offers only retry when too many worlds are open, and says how to go on", () => {
    const busy = joinCard("busy", false);
    const tooMany = joinCard("tooMany", false);
    for (const card of [busy, tooMany]) {
      expect([card.retry, card.newWorld, card.reload, card.primary]).toEqual([true, false, false, "retry"]);
      expect(card.detail).toContain("link mời");
    }
    expect(tooMany.detail).toContain("1 phút");
    expect(busy.title).not.toBe(tooMany.title);
  });

  it("offers only a new world when the world is closed, with words that depend on coming back", () => {
    const back = joinCard("closed", true);
    const invited = joinCard("closed", false);
    expect([back.retry, back.newWorld, back.primary]).toEqual([false, true, "newWorld"]);
    expect(back.detail).toContain("vẫn còn");
    expect(invited.detail).toContain("link mời mới");
  });

  it("offers retry first and a new world when the world is full", () => {
    const card = joinCard("full", false);
    expect([card.retry, card.newWorld, card.primary]).toEqual([true, true, "retry"]);
    expect(card.title).toContain(String(MAX_PLAYERS));
  });

  it("offers only retry when the server cannot be reached or joining failed", () => {
    for (const failure of ["unreachable", "failed"] as const) {
      const card = joinCard(failure, true);
      expect([card.retry, card.newWorld]).toEqual([true, false]);
    }
  });

  it("always points the primary button at an enabled one", () => {
    for (const failure of ALL) {
      for (const returning of [true, false]) {
        const card = joinCard(failure, returning);
        expect(card[card.primary]).toBe(true);
        expect(card.reload).toBe(false);
      }
    }
    for (const failure of ["download", "broken"] as const) {
      const card = startCard(failure);
      expect(card[card.primary]).toBe(true);
    }
  });
});

describe("startCard", () => {
  it("says a download failed and offers only a reload", () => {
    const card = startCard("download");
    expect(card.title).toBe("Không tải được game");
    expect(card.detail).toContain("Kiểm tra mạng");
    expect([card.retry, card.newWorld, card.reload, card.primary]).toEqual([false, false, true, "reload"]);
  });

  it("says the browser failed and offers only a reload", () => {
    const card = startCard("broken");
    expect(card.title).toBe("Không mở được game");
    expect(card.detail).toContain("cập nhật trình duyệt");
    expect([card.retry, card.newWorld, card.reload, card.primary]).toEqual([false, false, true, "reload"]);
  });
});

describe("startFailure", () => {
  it("recognises a part of the game that did not download", () => {
    for (const err of [
      new TypeError("Failed to fetch dynamically imported module: http://x/browserAll-a1.js"),
      { message: "error loading dynamically imported module: http://x/a.js" },
      new TypeError("Importing a module script failed."),
      new TypeError("Load failed"),
    ]) {
      expect(startFailure(err)).toBe("download");
    }
  });

  it("calls every other error broken", () => {
    for (const err of [new TypeError("Cannot read properties of null (reading 'bodyHeight')"), new Error("WebGL unsupported"), "oops", null, undefined, { message: 5 }]) {
      expect(startFailure(err)).toBe("broken");
    }
  });
});
