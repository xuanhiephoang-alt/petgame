import { describe, expect, it } from "vitest";
import { QUESTS, advanceQuest } from "./quests.ts";
import { rollChestLoot } from "./treasure.ts";
import { applyReward, rewardText } from "./rewards.ts";
import { mulberry32 } from "./noise.ts";

describe("quests", () => {
  it("have unique ids, positive goals and a reward each", () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(q.goal).toBeGreaterThan(0);
      expect(rewardText(q.reward)).not.toBe("");
    }
  });

  it("ignores events for other quests", () => {
    const start = { index: 0, progress: 0 };
    expect(advanceQuest(start, "chest").state).toEqual(start);
  });

  it("counts up and moves on when the goal is reached", () => {
    const chests = QUESTS.findIndex((q) => q.id === "chests");
    let state = { index: chests, progress: 0 };
    state = advanceQuest(state, "chest").state;
    state = advanceQuest(state, "chest").state;
    expect(state).toEqual({ index: chests, progress: 2 });
    const last = advanceQuest(state, "chest");
    expect(last.completed?.id).toBe("chests");
    expect(last.state).toEqual({ index: chests + 1, progress: 0 });
  });

  it("tracks the best pal level instead of adding levels", () => {
    const trainer = QUESTS.findIndex((q) => q.id === "trainer");
    let state = advanceQuest({ index: trainer, progress: 0 }, "palLevel", 3).state;
    state = advanceQuest(state, "palLevel", 2).state;
    expect(state.progress).toBe(3);
    expect(advanceQuest(state, "palLevel", 5).completed?.id).toBe("trainer");
  });

  it("only counts events about the quest's subject", () => {
    const snow = QUESTS.findIndex((q) => q.id === "snow");
    expect(advanceQuest({ index: snow, progress: 0 }, "visit", 1, "desert").completed).toBeUndefined();
    expect(advanceQuest({ index: snow, progress: 0 }, "visit", 1, "snow").completed?.id).toBe("snow");
  });

  it("stops after the last quest", () => {
    const done = { index: QUESTS.length, progress: 0 };
    expect(advanceQuest(done, "boss")).toEqual({ state: done });
  });
});

describe("treasure chests", () => {
  it("always hold some resources, more far from spawn", () => {
    const rand = mulberry32(5);
    let near = 0, far = 0;
    for (let i = 0; i < 200; i++) {
      const a = rollChestLoot(rand, 0), b = rollChestLoot(rand, 1);
      const sum = (l: typeof a) => (l.wood ?? 0) + (l.stone ?? 0) + (l.berries ?? 0);
      expect(sum(a)).toBeGreaterThanOrEqual(3);
      near += sum(a);
      far += sum(b);
    }
    expect(far).toBeGreaterThan(near);
  });

  it("adds rewards to a player-like counter", () => {
    const target = { wood: 1, stone: 0, berries: 0, greatBalls: 0, snacks: 0, coat: 0, hat: 0, raft: 0 };
    applyReward(target, { wood: 2, greatBalls: 1 });
    expect(target).toEqual({ wood: 3, stone: 0, berries: 0, greatBalls: 1, snacks: 0, coat: 0, hat: 0, raft: 0 });
  });
});
