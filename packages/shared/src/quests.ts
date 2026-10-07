import type { Reward } from "./rewards.ts";

/** Things that move a quest forward. "palLevel" reports the highest level reached. */
export type QuestEvent = "catch" | "camp" | "work" | "craftGreatBall" | "visitSnow" | "chest" | "palLevel" | "boss";

export interface Quest {
  id: string;
  title: string;
  /** Short hint shown under the title. */
  hint: string;
  event: QuestEvent;
  goal: number;
  reward: Reward;
}

/** The guided quest chain for new players, in order. */
export const QUESTS: readonly Quest[] = [
  { id: "first_catch", title: "Bắt con thú đầu tiên", hint: "Đánh cho thú yếu rồi ném bóng", event: "catch", goal: 1, reward: { berries: 5 } },
  { id: "camp", title: "Dựng trại", hint: "Bấm 🏕️ ở chỗ trống", event: "camp", goal: 1, reward: { wood: 6, stone: 4 } },
  { id: "work", title: "Giao việc cho thú", hint: "Mở 🐾, chọn thú, bấm Làm việc", event: "work", goal: 1, reward: { snacks: 1 } },
  { id: "great_ball", title: "Chế tạo Bóng xịn", hint: "Đứng ở trại, mở 🔨", event: "craftGreatBall", goal: 1, reward: { stone: 6 } },
  { id: "snow", title: "Khám phá vùng tuyết", hint: "Đi về phía tây bắc (xem bản đồ góc phải)", event: "visitSnow", goal: 1, reward: { greatBalls: 1 } },
  { id: "chests", title: "Mở 3 rương báu", hint: "Rương hiện trên bản đồ", event: "chest", goal: 3, reward: { snacks: 2 } },
  { id: "collector", title: "Bắt thêm 5 con thú", hint: "Mỗi vùng có loài riêng", event: "catch", goal: 5, reward: { greatBalls: 2 } },
  { id: "trainer", title: "Nuôi một con thú lên cấp 5", hint: "Thú lên cấp khi đánh, làm việc, ăn bánh", event: "palLevel", goal: 5, reward: { berries: 10 } },
  { id: "boss", title: "Hạ Vua Đá Boulderhorn", hint: "Rủ bạn bè vào vùng đá tây nam", event: "boss", goal: 1, reward: { greatBalls: 3, wood: 20, stone: 20 } },
];

export interface QuestProgress {
  /** Index into QUESTS; QUESTS.length means the chain is finished. */
  index: number;
  progress: number;
}

/**
 * Applies one event. Counting events add `amount`; "palLevel" keeps the best
 * level seen. Returns the new progress and the quest finished by this event.
 */
export function advanceQuest(
  state: QuestProgress,
  event: QuestEvent,
  amount = 1,
): { state: QuestProgress; completed?: Quest } {
  const quest = QUESTS[state.index];
  if (!quest || quest.event !== event) return { state };
  const progress = event === "palLevel" ? Math.max(state.progress, amount) : state.progress + amount;
  if (progress >= quest.goal) return { state: { index: state.index + 1, progress: 0 }, completed: quest };
  return { state: { index: state.index, progress } };
}
