import { describe, expect, it } from "vitest";
import { MAX_PLAYERS } from "@petgame/shared";
import type { JoinFailure } from "../net/connection.ts";
import { joinCard } from "./joinStatus.ts";

const ALL: JoinFailure[] = ["closed", "full", "unreachable", "failed"];

describe("joinCard", () => {
  it("has a title and an explanation for every failure", () => {
    for (const failure of ALL) {
      const card = joinCard(failure, false);
      expect(card.title).not.toBe("");
      expect(card.detail).not.toBe("");
    }
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
      }
    }
  });
});
