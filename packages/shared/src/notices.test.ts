import { describe, expect, it } from "vitest";
import { PARTY_FULL_TEXT, throwBlocker } from "./capture.ts";
import { craftBlocker, RECIPES } from "./crafting.ts";
import type { NoticeKind, NoticeMessage } from "./messages.ts";
import { CRAFT_SOUND_PREFIXES, NOTICES, refusal } from "./notices.ts";

const KINDS: NoticeKind[] = ["refused", "done", "warning", "reward", "quest", "news"];

/** Every entry as a message: functions are called with sample values. */
function samples(): [string, NoticeMessage][] {
  return Object.entries(NOTICES).map(([key, entry]) => {
    const message = typeof entry === "function" ? (entry as (...args: never[]) => NoticeMessage)(...(sampleArgs(key) as never[])) : entry;
    return [key, message];
  });
}

/** Sample arguments for the entries that are functions, in parameter order. */
function sampleArgs(key: string): unknown[] {
  switch (key) {
    case "campLeveled": return [2, "🏕️"];
    case "crafted": return ["🔵", "Bóng xịn"];
    case "campFull": return [2, 3];
    case "noSnacks": return ["🍖", "Bánh"];
    case "fed": return ["Voltmouse", 5];
    case "palExhausted":
    case "palResting": return ["Voltmouse", 4];
    case "bossDefeated":
    case "questDone": return ["a", "b"];
    case "alphaKnockedOut":
    case "alphaCaught": return ["An", "Voltmouse đầu đàn"];
    case "chestFound": return ["🪵\xa05", true];
    case "craftNeedCampLevel": return [2];
    default: return ["x"];
  }
}

describe("NOTICES", () => {
  it("gives every entry a known kind and some text", () => {
    for (const [key, message] of samples()) {
      expect(KINDS, key).toContain(message.kind);
      expect(message.text.length, key).toBeGreaterThan(0);
    }
  });

  it("has news only for the two pack leader announcements", () => {
    const news = samples().filter(([, m]) => m.kind === "news").map(([key]) => key);
    expect(news.sort()).toEqual(["alphaCaught", "alphaKnockedOut"]);
  });

  it("writes exact text for the entries with branches or special characters", () => {
    expect(NOTICES.released("Voltmouse").text).toBe("Đã thả Voltmouse. Tạm biệt! 👋");
    expect(NOTICES.chestFound("🪵\xa05", true).text).toBe("Rương báu! 🪵\xa05 (mở 👕 Tủ đồ)");
    expect(NOTICES.chestFound("🪵\xa05", false).text).toBe("Rương báu! 🪵\xa05");
    expect(NOTICES.questDone("Bắt thú đầu tiên", "🪵\xa05").text).toBe('Xong nhiệm vụ "Bắt thú đầu tiên"! 🪵\xa05');
    expect(NOTICES.partyFull.text).toBe("Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt");
    expect(NOTICES.partyFull.text).toBe(PARTY_FULL_TEXT);
  });
});

describe("CRAFT_SOUND_PREFIXES", () => {
  const starts = (text: string) => CRAFT_SOUND_PREFIXES.some((p) => text.startsWith(p));

  it("match the crafted and camp level sentences", () => {
    expect(starts(NOTICES.crafted("🔵", "Bóng xịn").text)).toBe(true);
    expect(starts(NOTICES.campLeveled(2, "🏕️").text)).toBe(true);
  });

  it("match no other sentence, so the craft sound does not ring by mistake", () => {
    for (const [key, message] of samples()) {
      if (key === "crafted" || key === "campLeveled") continue;
      expect(starts(message.text), key).toBe(false);
    }
  });
});

describe("refusals", () => {
  it("refusal wraps text as a refused notice", () => {
    expect(refusal("x")).toEqual({ kind: "refused", text: "x" });
  });

  it("throwBlocker returns the text of a refused entry", () => {
    expect(throwBlocker(0, { boss: true })).toBe(NOTICES.bossUncatchable.text);
    expect(throwBlocker(30, { boss: false })).toBe(NOTICES.partyFull.text);
  });

  it("craftBlocker returns the text of a refused entry for every branch", () => {
    const refused = new Set(samples().filter(([, m]) => m.kind === "refused").map(([, m]) => m.text));
    const none = { wood: 0, stone: 0, berries: 0 };
    const camp = { resources: none, hasBase: true, baseLevel: 1, nearBase: true };
    const raft = RECIPES.find((r) => "item" in r.output && r.output.item === "raft")!;
    const upgrade = RECIPES.find((r) => "baseLevel" in r.output && r.output.baseLevel === 3)!;
    const blocked = [
      craftBlocker(raft, { ...camp, hasBase: false }),
      craftBlocker(raft, { ...camp, nearBase: false }),
      craftBlocker(upgrade, camp),
      craftBlocker(upgrade, { ...camp, baseLevel: 3 }),
      craftBlocker(raft, { ...camp, items: { raft: 1 } }),
      craftBlocker(raft, camp),
    ];
    for (const text of blocked) expect(refused.has(text!), String(text)).toBe(true);
  });
});

describe("NOTICES kinds (as the call sites sent them before the table existed)", () => {
  it("keeps the kind of every entry, which sets the toast priority", () => {
    const expected: Record<string, NoticeKind> = {
      campNearCampfire: "refused", campBlocked: "refused", campOnSea: "refused", campNearOther: "refused",
      campPlaced: "done", campLeveled: "reward", crafted: "done", wearNotOwned: "refused", noBerries: "refused", hpFull: "refused",
      alphaKnockedOut: "news", faintedAtCamp: "warning", faintedAtCampfire: "warning", palExhausted: "warning",
      bossDefeated: "reward",
      needCamp: "refused", campFull: "refused", released: "done", noSnacks: "refused", fed: "done", palResting: "refused",
      noWildNear: "refused", alphaCaught: "news",
      chestFound: "reward", questDone: "quest", tooCold: "warning", tooHot: "warning",
      workedWhileAway: "reward",
      partyFull: "refused", bossUncatchable: "refused", craftNeedCamp: "refused", craftNotNearCamp: "refused", campMaxed: "refused",
      craftNeedCampLevel: "refused", craftOwned: "refused", craftNoMaterials: "refused",
    };
    const actual = Object.fromEntries(samples().map(([key, m]) => [key, m.kind]));
    expect(actual).toEqual(expected);
  });
});
