import { palName } from "@petgame/shared";
import { describe, expect, it } from "vitest";
import { GAME_TEXT, JOIN_TEXT, PARTY_TEXT } from "./strings.ts";

describe("GAME_TEXT", () => {
  it("writes the catch message with the star only for a pack leader", () => {
    expect(GAME_TEXT.caught("Voltmouse đầu đàn", true)).toBe("★ Bắt được Voltmouse đầu đàn! 🎉");
    expect(GAME_TEXT.caught("Voltmouse", false)).toBe("Bắt được Voltmouse! 🎉");
    expect(GAME_TEXT.escaped("Voltmouse", 35)).toBe("Voltmouse thoát ra rồi (35%)");
  });

  it("writes the lair warning with the pack leader's name from palName, as the old text did", () => {
    expect(GAME_TEXT.lairWarning(palName("voltmouse", true), 7)).toBe("★ Lãnh địa của Voltmouse đầu đàn (Lv 7): nó tấn công ai lại gần!");
  });

  it("writes the level-up message with and without a new skill", () => {
    expect(GAME_TEXT.levelUp("Voltmouse", 5)).toBe("Voltmouse lên cấp 5! ⭐");
    expect(GAME_TEXT.levelUpLearned("Voltmouse", 5, "⚡ Tia chớp")).toBe("Voltmouse lên cấp 5! ⭐ Học được chiêu mới: ⚡ Tia chớp");
  });
});

describe("JOIN_TEXT", () => {
  it("names the player limit and the empty world hold", () => {
    expect(JOIN_TEXT.full.title).toBe("Thế giới đã đủ 5 người");
    expect(JOIN_TEXT.tooMany.detail).toContain("sau 1 phút");
  });
});

describe("PARTY_TEXT", () => {
  it("has the release-done label (it has no accent, so scripts/viStrings.mjs cannot see it)", () => {
    expect(PARTY_TEXT.releaseDone).toBe("✓ Xong");
  });
});
