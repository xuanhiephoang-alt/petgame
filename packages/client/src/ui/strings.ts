import { BERRY_HEAL, EAT_COOLDOWN_MS, EMPTY_WORLD_HOLD_MS, MAX_PLAYERS, type Element } from "@petgame/shared";

/**
 * Every piece of text the client shows the player, grouped by where it appears. Sentences the server sends are in
 * `@petgame/shared` notices.ts (NOTICES); the words of data (species, skills, items, regions, quests) are in the data.
 * A fixed sentence is a string; one with values in it is a function of plain values (already looked up and formatted by
 * the caller), keeping the number and order of the `${}` parts: scripts/viStrings.mjs relies on it. No state, no DOM:
 * the lobby imports this file without pulling in the game. New text goes here, not into the interface code.
 */

/** Words used by more than one panel. */
export const COMMON_TEXT = {
  close: "Đóng",
} as const;

/** The lobby page: the join button and the hints under it. */
export const LOBBY_TEXT = {
  joining: "Đang vào...",
  join: "Vào chơi",
  /** When the page was opened again at the world the player was in (same tab). */
  returnHint: "Quay lại thế giới bạn đang chơi cùng bạn bè",
  /** When the page was opened from an invite link. */
  inviteHint: "Bạn được mời vào thế giới của bạn bè",
} as const;

/** The lobby's cards: why joining failed, and why the game could not open. */
export const JOIN_TEXT = {
  closed: {
    title: "Thế giới này đã đóng",
    detailReturning: "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn.",
    detailInvited: "Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới.",
  },
  full: {
    title: `Thế giới đã đủ ${MAX_PLAYERS} người`,
    detail: "Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới.",
  },
  unreachable: { title: "Không kết nối được server", detail: "Kiểm tra mạng rồi bấm Thử lại." },
  busy: {
    title: "Server đang có quá nhiều thế giới",
    detail: "Chưa tạo thêm được thế giới mới. Chờ một lát rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời.",
  },
  tooMany: {
    title: "Đã mở nhiều thế giới quá",
    detail: `Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau ${EMPTY_WORLD_HOLD_MS / 60_000} phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời.`,
  },
  failed: { title: "Không vào được thế giới", detail: "Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại." },
  download: { title: "Không tải được game", detail: "Kiểm tra mạng rồi bấm Tải lại." },
  broken: { title: "Không mở được game", detail: "Trình duyệt gặp lỗi khi mở thế giới. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt." },
} as const;

/** The screen over the game while the connection is down. */
export const CONNECTION_TEXT = {
  reconnecting: {
    title: "Đang kết nối lại…",
    detail: "Mạng vừa bị ngắt. Nhân vật và thú của bạn đứng yên chờ bạn quay lại.",
  },
  failed: {
    title: "Không kết nối lại được",
    detail: "Thú, đồ và trại của bạn đã được lưu. Về sảnh để vào chơi lại.",
  },
  replaced: {
    title: "Bạn đang chơi ở nơi khác",
    detail: "Thiết bị này vừa vào game từ một tab khác. Mỗi thiết bị chỉ điều khiển một nhân vật.",
  },
  shutdown: {
    title: "Server đang khởi động lại",
    detail: "Thú, đồ và trại của bạn đã được lưu. Chờ một lát rồi về sảnh để vào lại.",
  },
  left: {
    title: "Bạn đã rời thế giới",
    detail: "Về sảnh để vào chơi lại.",
  },
  lobby: "Về sảnh",
} as const;

/** The heads-up display: health row buttons, status panel, ball button, touch buttons. */
export const HUD_TEXT = {
  /** Markup kept as it is: the label, the recharge cover and the countdown are separate elements. */
  eatButton: `<span class="eat-label">🫐 Ăn</span><span class="eat-cd"></span><span class="eat-secs"></span>`,
  eatTitle: `Ăn 1 quả mọng: hồi ${BERRY_HEAL} máu, rồi chờ ${EAT_COOLDOWN_MS / 1000} giây mới ăn tiếp (phím H)`,
  soundTitle: "Bật/tắt âm thanh (phím M)",
  inviteLabel: "Mời bạn",
  inviteButton: '🔗 Mời<span class="invite-more"> bạn</span>',
  shareText: "Vào chơi cùng mình!",
  linkCopied: "Đã chép link mời 🔗",
  placeCamp: "🏕️ Đặt trại",
  placeCampTitle: "Dựng trại ở chỗ đang đứng (phím B)",
  ballTitle: "Đổi loại bóng (phím R)",
  attack: "Đánh",
  capture: "Bắt",
  day: "Ngày",
  dusk: "Hoàng hôn",
  night: "Đêm",
  dawn: "Bình minh",
  greatBall: (count: number) => `🔵 Bóng xịn (${count})`,
  plainBall: "⚪ Bóng thường",
  greatBallShort: (count: number) => `🔵 Xịn (${count})`,
  plainBallShort: "⚪ Thường",
  /** Key help line of the desktop status panel. */
  keyHelp: "WASD/↑↓←→ đi • Space đánh (cả chặt cây, đập đá) • Shift lướt né • 1-3 thú dùng chiêu • E ném • R bóng • H ăn • Q thú • B trại • C chế tạo • T tủ đồ • N bản đồ • M âm thanh",
  /** Markup kept as it is: `<br>` ends the counts line and the help line. */
  statusLines: (players: number, captured: number, items: string, help: string) =>
    `Người chơi: ${players}/${MAX_PLAYERS} &nbsp; Thú: ${captured} &nbsp; ${items}<br>${help}<br>`,
  /** `href` is the link as is, `shown` the same link escaped for the page. */
  inviteLine: (href: string, shown: string) => `Mời bạn: <a href="${href}" target="_blank" rel="noopener">${shown}</a>`,
} as const;

/** The pals panel: the bag, each pal's card, and the release dialog. */
export const PARTY_TEXT = {
  elements: {
    grass: "🌿 Cỏ",
    fire: "🔥 Lửa",
    water: "💧 Nước",
    earth: "🪨 Đất",
    electric: "⚡ Điện",
  } satisfies Record<Element, string>,
  releaseTitle: "Chọn thú để thả về thiên nhiên",
  alphaBadge: "★ Thú đầu đàn",
  confirmText: "Nó sẽ về với thiên nhiên, không quay lại và không để lại gì.",
  lastPal: "Đây là con thú cuối cùng của bạn.",
  keep: "Giữ lại",
  release: "Thả",
  bag: (count: number, max: number) => `Túi thú ${count}/${max}`,
  openButton: (count: number) => `🐾 Thú (${count})`,
  openButtonFull: (count: number, max: number) => `🐾 Thú (${count}/${max})`,
  releaseMode: "🕊️ Thả bớt",
  releaseDone: "✓ Xong",
  empty: "Túi đang trống. Đánh đến khi thú choáng 💫 rồi ném bóng để bắt!",
  releaseHint: "Chọn thú muốn thả. Thú được thả sẽ về với thiên nhiên và không quay lại.",
  needCampHint: "Đặt trại (🏕️ / phím B) để giao việc cho thú.",
  level: (level: number) => `Cấp ${level}`,
  alphaTitle: "Thú đầu đàn",
  following: "Đang đi theo",
  working: (icon: string) => `Đang làm ${icon}`,
  makes: (icon: string) => `Làm ra ${icon}`,
  detail: (element: string, strongIcon: string, status: string) => `${element} (khắc ${strongIcon}) · ${status}`,
  learnsAt: (level: number) => ` (học ở cấp ${level})`,
  releaseLabel: (name: string, level: number) => `Thả ${name} · Lv ${level}`,
  follow: "Đi theo",
  work: "Làm việc",
  sendBack: "Cho về",
  rest: "Nghỉ",
  feed: "Cho ăn 🥧",
  confirmTitle: (name: string, level: number) => `Thả ${name} · Lv\u00A0${level}?`,
  confirmFollowing: "Đang đi theo bạn.",
  confirmWorking: "Đang làm việc ở trại.",
} as const;

/** The wardrobe panel: tabs, look picker, item cards. */
export const WARDROBE_TEXT = {
  turnHint: "Bấm để xoay",
  hairStyle: "Kiểu tóc",
  hairColor: "Màu tóc",
  hairColorLabel: (n: number) => `Màu tóc ${n}`,
  skinTone: "Màu da",
  skinToneLabel: (n: number) => `Màu da ${n}`,
  tabs: {
    look: "Ngoại hình",
    outfit: "Quần áo",
    hat: "Mũ",
    weapon: "Vũ khí",
  },
  /** Where an item not owned yet comes from. */
  from: {
    starter: "",
    craft: "Chế ở trại (🔨)",
    chest: "Tìm trong rương báu",
    boss: "Phần thưởng hạ trùm",
  },
  button: "👕 Tủ đồ",
  buttonTitle: "Ngoại hình, quần áo, mũ và vũ khí (phím T)",
  /** Markup kept as it is. */
  header: "<strong>Tủ đồ</strong>",
  noHat: "Không đội mũ",
  bareHand: "Tay không",
  noHatDesc: "Để lộ kiểu tóc",
  bareHandDesc: "Đấm thường",
  ranged: "🎯 bắn xa",
  melee: "✋ đánh gần",
  armor: (percent: number) => `🛡️ bớt ${percent}% sát thương`,
  worn: "Đang dùng",
  wearOutfit: "Mặc",
  wearHat: "Đội",
  takeOffHat: "Bỏ mũ",
  holdWeapon: "Cầm",
  putAwayWeapon: "Cất",
} as const;

/** The skill bar of the following pal. */
export const SKILLBAR_TEXT = {
  knownTitle: (name: string, key: number, description: string) => `${name} (phím ${key}): ${description}`,
  lockedTitle: (name: string, level: number) => `${name}: học ở cấp ${level}`,
  lockedLabel: (name: string, level: number) => `${name}, học ở cấp ${level}`,
  auto: "Tự động ✓",
  onOrder: "Theo lệnh",
  autoTitle: "Thú tự dùng chiêu (bấm để chỉ dùng khi bạn ra lệnh bằng phím 1-3)",
  onOrderTitle: "Thú chỉ dùng chiêu khi bạn ra lệnh (bấm để thú tự dùng)",
  lockedHint: (name: string, level: number) => `🔒 ${name}: thú học ở cấp ${level}`,
} as const;

/** The crafting panel. */
export const CRAFTING_TEXT = {
  button: "🔨 Chế tạo",
  buttonTitle: "Chế tạo ở trại của bạn (phím C)",
  /** Markup kept as it is. */
  header: "<strong>Chế tạo</strong>",
  make: "Làm",
} as const;

/** The quest tracker. */
export const QUEST_TEXT = {
  /** Markup kept as it is. */
  allDone: "<strong>📜 Đã xong mọi nhiệm vụ!</strong>",
  levelCount: (progress: number, goal: number) => `cấp ${progress}/${goal}`,
  /** Markup kept as it is. */
  hintAndReward: (hint: string, reward: string) => `<small>${hint}</small><small class="quest-reward">Thưởng: ${reward}</small>`,
} as const;

/** The minimap. */
export const MINIMAP_TEXT = {
  title: "Bản đồ (phím N để phóng to)",
} as const;

/** The game world: notices the client makes itself, floating words, name labels, tips. */
export const GAME_TEXT = {
  reconnected: "✅ Đã kết nối lại",
  noPalNear: "Không có thú nào ở gần",
  noGreatBall: "Chưa có 🔵 Bóng xịn. Chế tạo ở trại (phím C)",
  enterRegion: (icon: string, name: string, climate: string) => `Đến ${icon} ${name} (${climate})`,
  /** `name` is the pack leader's full name (palName with the alpha flag). */
  lairWarning: (name: string, level: number) => `★ Lãnh địa của ${name} (Lv ${level}): nó tấn công ai lại gần!`,
  superEffective: "Hiệu quả! 💥",
  notEffective: "Kém hiệu quả",
  dodge: "Né!",
  caught: (name: string, alpha: boolean) => `${alpha ? "★ " : ""}Bắt được ${name}! 🎉`,
  escaped: (name: string, percent: number) => `${name} thoát ra rồi (${percent}%)`,
  levelUp: (name: string, level: number) => `${name} lên cấp ${level}! ⭐`,
  levelUpLearned: (name: string, level: number, skills: string) => `${name} lên cấp ${level}! ⭐ Học được chiêu mới: ${skills}`,
  offlineName: (name: string) => `${name} (mất kết nối)`,
  alphaLabel: (level: number, name: string) => `★ Đầu đàn · Lv ${level} ${name}`,
  stunned: "💫 Choáng!",
  stunTipTouch: "💫 Thú choáng: bấm Bắt để dễ bắt, hoặc Đánh tiếp để hạ gục lấy đồ",
  stunTipKeys: "💫 Thú choáng: ném bóng (E) để dễ bắt, hoặc đánh tiếp (Space) để hạ gục lấy đồ",
  campLabel: (owner: string, level: number) => `🏕️ Trại của ${owner} · Cấp ${level}`,
} as const;
