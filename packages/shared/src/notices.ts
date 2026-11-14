import { MAX_PARTY } from "./constants.ts";
import type { NoticeMessage } from "./messages.ts";

/**
 * Every sentence the server sends in a `Notice` message, each with the `kind` that says how much it matters to the
 * player. A fixed sentence is a NoticeMessage; one with values in it is a function of plain values (already looked up
 * and formatted by the caller), so this table holds wording only, no game rules. A new server sentence goes here.
 * Keep the order and count of the `${}` parts of each sentence: scripts/viStrings.mjs relies on it.
 */
export const NOTICES = {
  // systems/camp.ts
  campNearCampfire: { kind: "refused", text: "Quá gần lửa trại chung" },
  campBlocked: { kind: "refused", text: "Chỗ này vướng cây hoặc đá" },
  campOnSea: { kind: "refused", text: "Không dựng trại trên biển được" },
  campNearOther: { kind: "refused", text: "Quá gần trại của người khác" },
  campPlaced: { kind: "done", text: "Đã dựng trại 🏕️" },
  campLeveled: (level: number, icon: string): NoticeMessage => ({ kind: "reward", text: `Trại đã lên cấp ${level}! ${icon}` }),
  crafted: (icon: string, name: string): NoticeMessage => ({ kind: "done", text: `Đã làm ${icon} ${name}` }),
  wearNotOwned: { kind: "refused", text: "Bạn chưa có món này" },
  noBerries: { kind: "refused", text: "Hết 🫐 quả mọng" },
  hpFull: { kind: "refused", text: "Máu đang đầy" },

  // systems/combat.ts
  alphaKnockedOut: (player: string, pal: string): NoticeMessage & { kind: "news" } => ({ kind: "news", text: `★ ${player} đã hạ ${pal}!` }),
  faintedAtCamp: { kind: "warning", text: "Bạn bị ngất và tỉnh dậy ở trại 💫" },
  faintedAtCampfire: { kind: "warning", text: "Bạn bị ngất và tỉnh dậy bên lửa trại 💫" },
  palExhausted: (name: string, seconds: number): NoticeMessage => ({ kind: "warning", text: `${name} kiệt sức, cần nghỉ ${seconds} giây` }),

  // systems/leaders.ts
  bossDefeated: (reward: string, xp: string): NoticeMessage => ({ kind: "reward", text: `Hạ được trùm! 🏆 ${reward}${xp}` }),

  // systems/party.ts
  needCamp: { kind: "refused", text: "Hãy đặt trại trước (nút 🏕️ hoặc phím B)" },
  campFull: (level: number, cap: number): NoticeMessage => ({ kind: "refused", text: `Trại cấp ${level} chỉ chứa ${cap} thú làm việc` }),
  released: (name: string): NoticeMessage => ({ kind: "done", text: `Đã thả ${name}. Tạm biệt! 👋` }),
  noSnacks: (icon: string, name: string): NoticeMessage => ({ kind: "refused", text: `Hết ${icon} ${name}` }),
  fed: (name: string, xp: number): NoticeMessage => ({ kind: "done", text: `${name} ăn ngon lành! +${xp} XP` }),
  palResting: (name: string, seconds: number): NoticeMessage => ({ kind: "refused", text: `${name} đang nghỉ, còn ${seconds} giây` }),

  // systems/skills.ts
  noWildNear: { kind: "refused", text: "Không có thú hoang nào ở gần để đánh" },

  // systems/wild.ts
  alphaCaught: (player: string, pal: string): NoticeMessage & { kind: "news" } => ({ kind: "news", text: `★ ${player} đã bắt được ${pal}!` }),

  // systems/world.ts
  chestFound: (reward: string, wardrobeHint: boolean): NoticeMessage => ({
    kind: "reward",
    text: `Rương báu! ${reward}${wardrobeHint ? " (mở 👕 Tủ đồ)" : ""}`,
  }),
  questDone: (title: string, reward: string): NoticeMessage => ({ kind: "quest", text: `Xong nhiệm vụ "${title}"! ${reward}` }),
  tooCold: (region: string): NoticeMessage => ({ kind: "warning", text: `${region}: lạnh quá! 🥶 Mặc 🧥 Áo ấm (👕 Tủ đồ) hoặc dắt thú hệ lửa` }),
  tooHot: (region: string): NoticeMessage => ({ kind: "warning", text: `${region}: nóng quá! 🥵 Đội 👒 Nón lá (👕 Tủ đồ) hoặc dắt thú hệ nước` }),

  // rooms/GameRoom.ts
  workedWhileAway: (made: string): NoticeMessage => ({ kind: "reward", text: `Trong lúc bạn đi vắng, thú đã làm được: ${made}` }),

  // Refusals the client checks too (throwBlocker, craftBlocker): it turns them down before sending, with the same words.
  partyFull: { kind: "refused", text: `Túi thú đầy (${MAX_PARTY}/${MAX_PARTY}): mở 🐾 Thú và bấm 🕊️ Thả bớt` },
  bossUncatchable: { kind: "refused", text: "Không thể bắt trùm! Hãy cùng nhau hạ nó" },
  craftNeedCamp: { kind: "refused", text: "Cần dựng trại trước" },
  craftNotNearCamp: { kind: "refused", text: "Hãy đứng gần trại của bạn" },
  campMaxed: { kind: "refused", text: "Trại đã đạt cấp này" },
  craftNeedCampLevel: (level: number): NoticeMessage => ({ kind: "refused", text: `Cần trại cấp ${level}` }),
  craftOwned: { kind: "refused", text: "Đã có rồi" },
  craftNoMaterials: { kind: "refused", text: "Chưa đủ nguyên liệu" },
} as const satisfies Record<string, NoticeMessage | ((...args: never[]) => NoticeMessage)>;

/**
 * A refusal made of words that `throwBlocker` or `craftBlocker` returned (they return a plain string, which the client
 * shows too). The text passed in must be the `text` of a `refused` entry in NOTICES.
 */
export function refusal(text: string): NoticeMessage {
  return { kind: "refused", text };
}

/**
 * Beginnings of the two sentences that make the client play the craft sound (NOTICES.crafted, NOTICES.campLeveled).
 * They must match those entries; notices.test.ts keeps them in step.
 */
export const CRAFT_SOUND_PREFIXES = ["Đã làm", "Trại đã lên cấp"] as const;
