import type { Reward } from "./rewards.ts";

/** Things that move a quest forward. "palLevel" reports the highest level reached. */
export type QuestEvent = "catch" | "camp" | "work" | "craft" | "visit" | "chest" | "harvest" | "palLevel" | "boss";

export interface Quest {
  id: string;
  title: string;
  /** Short hint shown under the title. */
  hint: string;
  event: QuestEvent;
  /** For "craft" the recipe id, for "visit" the biome. */
  subject?: string;
  goal: number;
  reward: Reward;
}

/** The guided quest chain for new players, in order. */
export const QUESTS: readonly Quest[] = [
  { id: "first_catch", title: "Bắt con thú đầu tiên", hint: "Đánh cho thú yếu rồi ném bóng", event: "catch", goal: 1, reward: { berries: 5 } },
  { id: "camp", title: "Dựng trại", hint: "Bấm 🏕️ ở chỗ trống", event: "camp", goal: 1, reward: { wood: 6, stone: 4 } },
  { id: "work", title: "Giao việc cho thú", hint: "Mở 🐾, chọn thú, bấm Làm việc", event: "work", goal: 1, reward: { snacks: 1 } },
  { id: "harvest", title: "Hái 3 bụi quả", hint: "Bụi quả đỏ ở đồng cỏ, đứng gần rồi bấm Đánh", event: "harvest", goal: 3, reward: { wood: 5 } },
  { id: "great_ball", title: "Chế tạo Bóng xịn", hint: "Đứng ở trại, mở 🔨", event: "craft", subject: "great_ball", goal: 1, reward: { stone: 6 } },
  { id: "coat", title: "May áo ấm", hint: "Núi tuyết rất lạnh, chế 🧥 ở trại", event: "craft", subject: "warm_coat", goal: 1, reward: { berries: 6 } },
  { id: "snow", title: "Lên núi tuyết", hint: "Đi về phía bắc (xem bản đồ góc phải)", event: "visit", subject: "snow", goal: 1, reward: { greatBalls: 1 } },
  { id: "chests", title: "Mở 3 rương báu", hint: "Rương hiện trên bản đồ", event: "chest", goal: 3, reward: { snacks: 2 } },
  { id: "desert", title: "Băng qua sa mạc", hint: "Phía nam, nhớ đội 👒 Nón lá", event: "visit", subject: "desert", goal: 1, reward: { wood: 10 } },
  { id: "swamp", title: "Thám hiểm đầm lầy", hint: "Phía tây, nhiều ao và thú lạ", event: "visit", subject: "swamp", goal: 1, reward: { berries: 10 } },
  { id: "collector", title: "Bắt thêm 5 con thú", hint: "Mỗi vùng có loài riêng", event: "catch", goal: 5, reward: { greatBalls: 2 } },
  { id: "raft", title: "Đóng bè gỗ", hint: "Chế 🛶 ở trại để ra biển", event: "craft", subject: "raft", goal: 1, reward: { stone: 8 } },
  { id: "island", title: "Đặt chân lên đảo hoang", hint: "Các đảo ở bốn góc biển", event: "visit", subject: "island", goal: 1, reward: { greatBalls: 2, snacks: 2 } },
  { id: "trainer", title: "Nuôi một con thú lên cấp 5", hint: "Thú lên cấp khi đánh, làm việc, ăn bánh", event: "palLevel", goal: 5, reward: { berries: 10 } },
  { id: "volcano", title: "Đến núi lửa", hint: "Phía đông, nóng rực", event: "visit", subject: "volcano", goal: 1, reward: { stone: 10 } },
  { id: "boss", title: "Hạ Vua Đá Boulderhorn", hint: "Rủ bạn bè, trùm ở chân núi lửa", event: "boss", goal: 1, reward: { greatBalls: 3, wood: 20, stone: 20 } },
];

export interface QuestProgress {
  /** Index into QUESTS; QUESTS.length means the chain is finished. */
  index: number;
  progress: number;
}

/**
 * Applies one event. Counting events add `amount`; "palLevel" keeps the best
 * level seen. Quests with a subject only count events about that subject. Returns the new progress and the quest finished by this event.
 */
export function advanceQuest(
  state: QuestProgress,
  event: QuestEvent,
  amount = 1,
  subject?: string,
): { state: QuestProgress; completed?: Quest } {
  const quest = QUESTS[state.index];
  if (!quest || quest.event !== event || (quest.subject && quest.subject !== subject)) return { state };
  const progress = event === "palLevel" ? Math.max(state.progress, amount) : state.progress + amount;
  if (progress >= quest.goal) return { state: { index: state.index + 1, progress: 0 }, completed: quest };
  return { state: { index: state.index, progress } };
}
