# PLAN: T12 Gom chữ hiển thị tiếng Việt về một chỗ (chuyển thuần, không đổi chữ)

Code đọc ở `cb2ab56` (commit "Mark T11b done, start T12"), gọi là **BASE** trong cả kế hoạch. Số dòng là số ở BASE và sẽ trôi khi sửa: coder tìm theo **chữ** hoặc tên hàm, không theo số dòng.

Mốc đo do designer chạy ở BASE (đếm chuỗi literal TypeScript có chữ cái tiếng Việt có dấu, không tính file test, cách đếm ở mục Thiết kế 4):

| Gói | File | Số chuỗi | Thuộc |
|---|---|---|---|
| client | `ui/party.ts` | 36 (+1 không dấu: `"✓ Xong"`) | đợt 2 |
| client | `ui/wardrobe.ts` | 30 | đợt 2 |
| client | `ui/hud.ts` | 23 | đợt 2 |
| client | `ui/joinStatus.ts` (thẻ sảnh, gợi ý sảnh) | 19 | đợt 2 |
| client | `ui/connection.ts` (màn che mất kết nối) | 11 | đợt 2 |
| client | `game/serverEvents.ts` | 9 (2 trong đó là tiền tố nhận biết tin chế tạo) | 2 tiền tố ở đợt 1, 7 còn lại ở đợt 2 |
| client | `ui/skillbar.ts` | 8 | đợt 2 |
| client | `game/stateSync.ts` | 6 | đợt 2 |
| client | `ui/crafting.ts` | 5 | đợt 2 |
| client | `main.ts` (nút sảnh) | 3 | đợt 2 |
| client | `ui/quests.ts` | 3 | đợt 2 |
| client | `game/controls.ts`, `game/hudBridge.ts` | 2 + 2 | đợt 2 |
| client | `game/Game.ts`, `ui/minimap.ts` | 1 + 1 | đợt 2 |
| server | `systems/camp.ts` | 11 | đợt 1 |
| server | `systems/party.ts` | 6 | đợt 1 |
| server | `systems/world.ts` | 5 | đợt 1 |
| server | `systems/combat.ts` | 4 | đợt 1 |
| server | `rooms/GameRoom.ts`, `systems/leaders.ts`, `skills.ts`, `wild.ts` | 1 mỗi file | đợt 1 |
| shared | `crafting.ts` (`craftBlocker`) | 8 (trong 11; 3 còn lại là tên vật phẩm `ITEM_INFO`) | đợt 1 |
| shared | `capture.ts` (`PARTY_FULL_TEXT`, câu trùm) | 2 | đợt 1 |

Tổng cần chuyển: client 159 (+1), server 30, shared 10. Tổng toàn bộ ở BASE: 277 chuỗi, 269 chuỗi khác nhau.

Không chuyển (đã là bảng dữ liệu theo miền, hoặc không phải chữ trong game), ghi lại để biết:
- shared, dữ liệu theo miền (71): `quests.ts` 34, `terrain.ts` 16 (`REGION_INFO`), `wardrobe.ts` 8 (tên kiểu tóc), `elements.ts` 5, `crafting.ts` 3 (`ITEM_INFO`), `work.ts` 3 (`RESOURCE_INFO`), `boss.ts` 1 (`BOSS.name`), `alphas.ts` 1 (`palName`, chỗ duy nhất ghép "… đầu đàn").
- JSON (`src/data/`): `skills.json` 60, `wearables.json` 48, `recipes.json` 30 (tên, mô tả); `pals.json` 0 (tên loài không có chữ có dấu).
- `client/src/gallery.ts` 5 (trang xem hình cho người làm game), `server/src/index.ts` 2 (dòng in ra console khi chạy `npm run play`).
- `client/index.html`: chữ tĩnh của sảnh (ô tên, nút "Đang tải...", "Thử lại", "Tạo thế giới mới", "Tải lại") và script canh tải inline (chạy trước mọi module, nên không import được bảng chữ).
- Test: `tests/e2e/multiplayer.spec.ts` 139, `GameRoom.test.ts` 28, `joinStatus.test.ts` 8, các test shared 15: giữ nguyên, xem mục Test.

## Mục tiêu

Người chơi không thấy gì khác: **mọi chữ giữ đúng từng ký tự**. Người làm game được hai bảng chữ: sửa một câu, rà chính tả, hoặc sau này dịch sang ngôn ngữ khác thì chỉ mở hai file, không phải lục 30 file code.
- `packages/client/src/ui/strings.ts`: mọi chữ client tự hiện (HUD, bảng, sảnh, thẻ lỗi khi vào, màn che mất kết nối, thông báo do client tạo, nhãn tên, chữ bay, gợi ý).
- `packages/shared/src/notices.ts`: mọi câu server gửi qua tin `Notice`, mỗi câu kèm `kind` của nó, cùng các câu từ chối mà client và server kiểm tra chung (`throwBlocker`, `craftBlocker`).
- Một công cụ đếm chữ (`scripts/viStrings.mjs`) chứng minh không chữ nào bị đổi, và một test canh giữ không cho chữ tiếng Việt mọc lại trong code luật chơi, code giao diện.

## Phạm vi

Làm:
- Chuyển nguyên văn các chuỗi trong bảng mốc đo (cột "đợt 1", "đợt 2") vào hai bảng chữ.
- Câu có ghép giá trị thành hàm mẫu nhỏ có kiểu (tham số là `string`, `number`, `boolean`).
- Gộp các bản trùng cùng nghĩa thành một mục (danh sách chính xác ở Thiết kế 5).
- Cảnh báo lãnh địa (`game/hudBridge.ts`) lấy tên thú qua `palName(id, true)` thay vì tự ghép `… đầu đàn`. Chữ ra giống hệt.
- Đổi chữ ký `GameRoom.notify` / `announce` để nhận cả câu lẫn `kind` từ bảng (Thiết kế 2).
- Công cụ `scripts/viStrings.mjs` và test `scripts/viStrings.test.mjs`, test mới cho hai bảng chữ, cập nhật `docs/architecture.md`.

KHÔNG làm:
- **Không đổi chữ nào**: không sửa chính tả, dấu câu, khoảng trắng, emoji, kể cả khi thấy câu chưa hay. Thấy câu cần sửa thì ghi vào `PROGRESS.md` mục "Đề xuất chữ" để làm ở nhiệm vụ khác.
- Không đổi hành vi, thời điểm, thứ tự tin, mức thông báo (`kind`, `ToastLevel`), giao thức (`NoticeMessage` vẫn là `{ text, kind }`), schema, `Profile`.
- Không chuyển chữ của dữ liệu theo miền (mục "Không chuyển" ở trên), `gallery.ts`, `server/index.ts`, `index.html`.
- Không tách markup HTML khỏi chữ: chuỗi có thẻ HTML được chuyển nguyên văn (Thiết kế 3.4).
- Không chuyển chuỗi chỉ có ASCII, số, emoji (`Lv ${level}`, `+${xp} XP`, `💨`, `✕`). Ngoại lệ duy nhất: `"✓ Xong"` (`ui/party.ts`), tiếng Việt không dấu nên công cụ không thấy, phải chuyển tay.
- Không làm cơ chế đa ngôn ngữ (chọn ngôn ngữ, tải bảng khác). Chỉ chuẩn bị chỗ.
- **Không sửa** `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts` (stash T63 đang giữ thay đổi của các file này).
- **Không dùng `git stash`** dưới bất kỳ dạng nào (`push`, `pop`, `apply`, `drop`): `stash@{0}` là phần dở dang của T63, chờ Q1.
- Không sửa file test có sẵn nào (xem mục Test).

## Thiết kế

### 1. Bảng chữ thông báo server nằm ở `packages/shared`, không ở server

Chọn `packages/shared/src/notices.ts`. Lý do:
1. Một phần câu server gửi vốn đã ở shared và client cũng hiện: `throwBlocker` (túi đầy, trùm) và `craftBlocker` (8 câu), dùng chung để client từ chối trước đúng như server. Đặt bảng ở server thì các câu này phải tách ra hai nơi.
2. Client đang dò chữ của tin server để phát tiếng chế tạo (`msg.text.startsWith("Đã làm") || …startsWith("Trại đã lên cấp")`, `game/serverEvents.ts`). Bảng ở shared cho phép đặt hai tiền tố này ngay cạnh hai câu mẫu, có test giữ chúng khớp nhau.
3. Muốn dịch sau này, cách gọn nhất là server gửi khoá và tham số, client tra bảng theo ngôn ngữ của mình. Bảng ở shared thì bước đó không phải dời file.

Giá phải trả: bundle client mang thêm khoảng 2 KB chữ server. Chấp nhận được.
Phương án còn lại (`packages/server/src/notices.ts`) gọn hơn cho server, nhưng phải giữ hai nơi cho câu từ chối và để client dò chữ "mù". Không chọn.

### 2. Hình dạng bảng thông báo server

`notices.ts` export:
- `NOTICES`: object `as const satisfies Record<string, NoticeMessage | ((...args: never[]) => NoticeMessage)>`.
  - Câu cố định là một `NoticeMessage` (`{ kind, text }`).
  - Câu có ghép giá trị là hàm mũi tên nhận giá trị thô, khai báo kiểu trả về `NoticeMessage`.
  - `kind` luôn nằm cạnh `text` trong cùng mục. Thứ tự mục theo hệ thống (camp, combat, leaders, party, skills, wild, world, GameRoom, rồi các câu từ chối dùng chung). Mỗi nhóm có một dòng chú thích tiếng Anh.
- `refusal(text: string): NoticeMessage`: trả `{ kind: "refused", text }`. Chỉ dùng ở hai chỗ server nhận câu từ một hàm chặn dùng chung (`throwBlocker`, `craftBlocker`), vì hai hàm này phải tiếp tục trả `string` (client dùng chữ, test có sẵn so chữ). JSDoc nói rõ: chữ truyền vào là `text` của một mục `refused` trong `NOTICES`.
- `CRAFT_SOUND_PREFIXES = ["Đã làm", "Trại đã lên cấp"] as const`: tiền tố của hai câu mà client phát tiếng chế tạo khi thấy (chuyển nguyên văn từ `serverEvents.ts`). JSDoc nói phải khớp `NOTICES.crafted` và `NOTICES.campLeveled`, có test giữ.

Luật cho hàm mẫu (cả `ui/strings.ts`):
- Tham số là giá trị đã sẵn sàng để in (`string`, `number`, `boolean`). Việc tra cứu (`getSpecies(...).name`, `palName`, `rewardText`, `REGION_INFO[...]`, phép chia ms ra giây) vẫn làm ở chỗ gọi, như ở BASE. Bảng chữ không chứa luật chơi, chỉ import hằng số và kiểu.
- **Giữ nguyên số và thứ tự chỗ ghép `${…}` của mỗi chuỗi**: chỉ biểu thức bên trong được đổi thành tên tham số. Ví dụ `Hạ được trùm! 🏆 ${rewardText(...)}${xpText}` thành `(reward: string, xp: string) => … \`Hạ được trùm! 🏆 ${reward}${xp}\``, chứ không gộp `xpText` vào trong mẫu. Công cụ so sánh dựa vào luật này.
- Chuỗi con có chữ tiếng Việt nằm trong biểu thức (ví dụ `wear ? " (mở 👕 Tủ đồ)" : ""`) chuyển theo, nằm trong cùng hàm mẫu (tham số `boolean`).

Danh sách mục `NOTICES` (khoá, `kind`, tham số, nguồn ở BASE). Coder dùng đúng khoá này, chữ chép nguyên văn từ nguồn:

| Khoá | kind | Tham số | Nguồn |
|---|---|---|---|
| `campNearCampfire` | refused | | camp.ts "Quá gần lửa trại chung" |
| `campBlocked` | refused | | camp.ts "Chỗ này vướng cây hoặc đá" |
| `campOnSea` | refused | | camp.ts "Không dựng trại trên biển được" |
| `campNearOther` | refused | | camp.ts "Quá gần trại của người khác" |
| `campPlaced` | done | | camp.ts "Đã dựng trại 🏕️" |
| `campLeveled` | reward | `level: number, icon: string` | camp.ts `Trại đã lên cấp ${…}! ${…}` |
| `crafted` | done | `icon: string, name: string` | camp.ts `Đã làm ${…} ${…}` (2 chỗ gọi, 1 mục) |
| `wearNotOwned` | refused | | camp.ts "Bạn chưa có món này" |
| `noBerries` | refused | | camp.ts "Hết 🫐 quả mọng" |
| `hpFull` | refused | | camp.ts "Máu đang đầy" |
| `alphaKnockedOut` | news | `player: string, pal: string` | combat.ts `★ ${…} đã hạ ${…}!` |
| `faintedAtCamp` | warning | | combat.ts "Bạn bị ngất và tỉnh dậy ở trại 💫" |
| `faintedAtCampfire` | warning | | combat.ts "Bạn bị ngất và tỉnh dậy bên lửa trại 💫" |
| `palExhausted` | warning | `name: string, seconds: number` | combat.ts `${…} kiệt sức, cần nghỉ ${…} giây` |
| `bossDefeated` | reward | `reward: string, xp: string` | leaders.ts `Hạ được trùm! 🏆 ${…}${…}` (`xpText` vẫn dựng ở leaders.ts) |
| `needCamp` | refused | | party.ts "Hãy đặt trại trước (nút 🏕️ hoặc phím B)" |
| `campFull` | refused | `level: number, cap: number` | party.ts `Trại cấp ${…} chỉ chứa ${…} thú làm việc` |
| `released` | done | `name: string` | party.ts `Đã thả ${…}. Tạm biệt! 👋` |
| `noSnacks` | refused | `icon: string, name: string` | party.ts `Hết ${…} ${…}` |
| `fed` | done | `name: string, xp: number` | party.ts `${…} ăn ngon lành! +${…} XP` |
| `palResting` | refused | `name: string, seconds: number` | party.ts `${…} đang nghỉ, còn ${…} giây` |
| `noWildNear` | refused | | skills.ts "Không có thú hoang nào ở gần để đánh" |
| `alphaCaught` | news | `player: string, pal: string` | wild.ts `★ ${…} đã bắt được ${…}!` |
| `chestFound` | reward | `reward: string, wardrobeHint: boolean` | world.ts `Rương báu! ${…}${wear ? " (mở 👕 Tủ đồ)" : ""}` |
| `questDone` | quest | `title: string, reward: string` | world.ts `Xong nhiệm vụ "${…}"! ${…}` |
| `tooCold` | warning | `region: string` | world.ts `${…}: lạnh quá! 🥶 …` |
| `tooHot` | warning | `region: string` | world.ts `${…}: nóng quá! 🥵 …` |
| `workedWhileAway` | reward | `made: string` | GameRoom.ts `Trong lúc bạn đi vắng, thú đã làm được: ${…}` |
| `partyFull` | refused | | capture.ts `PARTY_FULL_TEXT` (mẫu dùng hằng `MAX_PARTY`, tính lúc nạp module như ở BASE) |
| `bossUncatchable` | refused | | capture.ts "Không thể bắt trùm! Hãy cùng nhau hạ nó" |
| `craftNeedCamp` | refused | | crafting.ts "Cần dựng trại trước" |
| `craftNotNearCamp` | refused | | crafting.ts "Hãy đứng gần trại của bạn" |
| `campMaxed` | refused | | crafting.ts "Trại đã đạt cấp này" |
| `craftNeedCampLevel` | refused | `level: number` | crafting.ts `Cần trại cấp ${…}` (2 chỗ gọi, 1 mục) |
| `craftOwned` | refused | | crafting.ts "Đã có rồi" (2 chỗ gọi, 1 mục) |
| `craftNoMaterials` | refused | | crafting.ts "Chưa đủ nguyên liệu" |

`kind` của mỗi câu phải đúng như đối số `kind` ở chỗ gọi tại BASE. `alphaKnockedOut` và `alphaCaught` là `news` (BASE gửi qua `announce`, vốn gắn `news`).

Chỗ dùng:
- `GameRoom.notify(client: Client, notice: NoticeMessage)`: gửi nguyên `notice`. Bỏ tham số `kind` riêng.
- `GameRoom.announce(notice: NoticeMessage & { kind: "news" }, except?: Client)`: gửi nguyên `notice`. Kiểu bắt buộc mục phải là `news`.
- Ví dụ chỗ gọi:
  - `this.room.notify(client, NOTICES.hpFull)`
  - `this.room.notify(client, NOTICES.released(name))`
  - `this.room.notify(client, refusal(blocker))`
  - `this.room.announce(NOTICES.alphaKnockedOut(player.name, name))`
- `wild.ts`: `news` đang dùng chuỗi rỗng làm cờ "không có tin". Đổi thành `NoticeMessage | undefined`. Điều kiện `if (xp > 0 || news)` và `if (news)` giữ nguyên ý nghĩa.
- `capture.ts`: `export const PARTY_FULL_TEXT = NOTICES.partyFull.text;`. Giữ tên export và JSDoc, vì test có sẵn và `GameRoom.test.ts` import nó. `throwBlocker` trả `NOTICES.bossUncatchable.text` / `PARTY_FULL_TEXT`.
- `crafting.ts`: `craftBlocker` trả `NOTICES.<khoá>.text` hoặc `NOTICES.craftNeedCampLevel(n).text`. Kiểu trả về vẫn `string | undefined`.
- Vòng import: `notices.ts` chỉ import `MAX_PARTY` từ `constants.ts` và `import type { NoticeMessage }` từ `messages.ts`, nên không có vòng. Thêm `export * from "./notices.ts";` vào `packages/shared/src/index.ts`. Kiểm tra không trùng tên export (`NOTICES`, `refusal`, `CRAFT_SOUND_PREFIXES` hiện chưa có ở shared).

### 3. Bảng chữ client `packages/client/src/ui/strings.ts`

#### 3.1. Hình dạng

Hình dạng: các object hằng `as const` theo nơi hiện chữ, tên `UPPER_SNAKE_CASE` có đuôi `_TEXT` (tránh trùng `QUESTS` của shared, class `Hud`...).
- Câu cố định là giá trị `string`.
- Câu có ghép giá trị là hàm mũi tên có kiểu, theo luật ở Thiết kế 2.
- Bảng chỉ import hằng số và kiểu từ `@petgame/shared` (`MAX_PLAYERS`, `MAX_PARTY`, `EMPTY_WORLD_HOLD_MS`, `BERRY_HEAL`, `EAT_COOLDOWN_MS`, `type Element`...), không import gì của `game/` hay DOM. Như vậy sảnh (`main.ts`) import được mà không kéo theo game.

| Object | Lấy chữ từ |
|---|---|
| `LOBBY_TEXT` | `main.ts` ("Đang vào...", "Vào chơi" 1 mục), `joinStatus.ts` (`RETURN_HINT`, `INVITE_HINT`) |
| `JOIN_TEXT` | `joinStatus.ts`: `joinCard` (mỗi `JoinFailure` một mục `{ title, detail }`; `closed` có `detailReturning`, `detailInvited`), `startCard` (`download`, `broken`) |
| `CONNECTION_TEXT` | `connection.ts`: bảng `TEXT` chuyển nguyên hình dạng, thêm `lobby: "Về sảnh"` |
| `HUD_TEXT` | `hud.ts` (23 chuỗi: nút Ăn, âm thanh, Mời, trại, bóng, Đánh/Bắt, giờ trong ngày, dòng trạng thái và trợ giúp phím) |
| `PARTY_TEXT` | `party.ts` (gồm bảng `ELEMENTS` thành `PARTY_TEXT.elements: Record<Element, string>`, `"✓ Xong"`, "Đóng" và "Thả" theo Thiết kế 5) |
| `SKILLBAR_TEXT`, `WARDROBE_TEXT`, `CRAFTING_TEXT`, `QUEST_TEXT`, `MINIMAP_TEXT` | file cùng tên trong `ui/` (`WARDROBE_TEXT` gồm `TABS` title và `FROM`) |
| `COMMON_TEXT` | `close: "Đóng"` (dùng chung cho `crafting.ts`, `party.ts`, `wardrobe.ts`) |
| `GAME_TEXT` | `game/`: thông báo client tự tạo (`Game.ts` "✅ Đã kết nối lại", `controls.ts` 2 câu, `hudBridge.ts` đến vùng và cảnh báo lãnh địa, `serverEvents.ts` bắt được/thoát ra/lên cấp), chữ bay ("Hiệu quả! 💥", "Kém hiệu quả", "Né!", "💫 Choáng!"), nhãn (`stateSync.ts`: "(mất kết nối)", thú đầu đàn, trại), gợi ý choáng (2 câu) |

Coder tự đặt tên khoá trong mỗi object (camelCase, nói nghĩa, không nói vị trí). Ví dụ: `GAME_TEXT.caught(name, alpha)`, `GAME_TEXT.escaped(name, percent)`, `GAME_TEXT.levelUp(name, level)`, `GAME_TEXT.levelUpLearned(name, level, skills)`.

#### 3.2. Giữ export cũ để test không phải sửa

`joinStatus.ts` giữ `export const RETURN_HINT = LOBBY_TEXT.returnHint;` và `INVITE_HINT` tương tự, kèm JSDoc cũ, vì `joinStatus.test.ts` import chúng từ `./joinStatus.ts`.

#### 3.3. Cảnh báo lãnh địa

`hudBridge.ts` gọi `GAME_TEXT.lairWarning(palName(p.speciesId, true), p.level)`. Mẫu là `★ Lãnh địa của ${name} (Lv ${level}): nó tấn công ai lại gần!`. Vì `palName(id, true)` = `` `${getSpecies(id).name} đầu đàn` `` (`alphas.test.ts` giữ điều này), chữ ra giống hệt BASE. Đây là chỗ duy nhất công cụ so sánh báo khác (Thiết kế 5).

Không đổi hai chỗ còn lại có chữ "đầu đàn" ở client:
- nhãn `★ Đầu đàn · Lv …` (`stateSync.ts`): dạng khác, viết hoa, đứng trước;
- tiêu đề hộp xác nhận thả `Thả ${getSpecies(...).name} · Lv…?`: BASE dùng tên trơn, dòng "★ Thú đầu đàn" riêng.

#### 3.4. Chuỗi có markup HTML: chuyển nguyên văn

Có 8 chuỗi:
- `hud.ts`: nút Ăn `<span class="eat-label">…`, nút Mời `🔗 Mời<span class="invite-more"> bạn</span>`, dòng trạng thái `Người chơi: …<br>${…}<br>`, dòng `Mời bạn: <a href=…>`;
- `crafting.ts`, `wardrobe.ts`: `<strong>…</strong>`;
- `quests.ts`: 2 chuỗi.

Tách chữ khỏi markup thì đổi cấu trúc DOM và làm công cụ so sánh mất tác dụng. Để dành cho lúc làm đa ngôn ngữ. Mẫu có `${escapeHtml(invite)}`: hàm mẫu nhận chuỗi đã escape (`shown: string`), `escapeHtml` vẫn gọi ở `hud.ts`. Giữ thứ tự `${…}` theo luật.

#### 3.5. Đầu đọc chữ, điện thoại, bàn phím

Đầu đọc chữ (`aria-label`, `title`), điện thoại, bàn phím: không đổi gì. Bảng giữ cả các câu riêng cho cảm ứng và cho bàn phím (gợi ý choáng, nhãn bóng ngắn) như BASE. Chỗ chọn câu (`this.game.touch ? … : …`, `isTouch`) giữ ở chỗ gọi.

### 4. Công cụ chứng minh không đổi chữ: `scripts/viStrings.mjs`

Script Node (ES module, import `typescript` có sẵn ở devDependencies gốc), chỉ đọc file.

**Đối tượng đếm.** Mọi file `packages/*/src/**/*.ts`, trừ `*.test.ts`, `*.d.ts`, `node_modules`, `dist`. Đi qua cây cú pháp (`ts.createSourceFile`, `forEachChild`), lấy:
- `StringLiteral`, `NoSubstitutionTemplateLiteral`: lấy `.text`;
- `TemplateExpression`: `head.text` + với mỗi span: `"${}"` + `literal.text`. Mọi biểu thức bị thay bằng `${}`. Sau đó **vẫn đi tiếp vào trong biểu thức**, để chuỗi lồng như `" (mở 👕 Tủ đồ)"` được đếm riêng.

Chỉ giữ chuỗi có ít nhất một chữ cái tiếng Việt có dấu, theo lớp ký tự:
`/[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/`
Không dùng khoảng `À-ỹ` rộng: nó dính `×`, `÷`.

Chú thích code không bị đếm vì chỉ lấy literal.

**Chế độ.**
- Không tham số: in số chuỗi theo file và tổng (giống bảng mốc đo ở đầu).
- `--list`: in `file:dòng<TAB>chuỗi (JSON)`, cho người rà chữ hoặc dịch.
- `--compare <ref>`: dựng cùng tập đếm ở commit `<ref>` (đọc bằng `git ls-tree -r --name-only <ref> -- packages` và `git show <ref>:<đường dẫn>` qua `child_process.execFileSync`, chỉ đọc) và ở cây làm việc. Rồi in ba phần:
  - (a) chuỗi chỉ có ở `<ref>`;
  - (b) chuỗi chỉ có ở cây làm việc;
  - (c) chuỗi có ở cả hai nhưng số lần khác (multiset), dạng `cũ -> mới`.

  Có (a) hoặc (b) thì thoát mã 1, còn lại mã 0. (c) chỉ để đối chiếu với danh sách gộp được phép.
- Export hàm thuần `viLiterals(sourceText, fileName)` → `{ line, text }[]` và `VI_LETTER` (regex), cho test dùng.

**Mốc kiểm chứng.** Designer đã chạy một bản tương đương ở BASE: 277 chuỗi, 269 khác nhau. Chạy không tham số ở BASE phải ra đúng các số trong bảng mốc đo. Lệch thì xem lại cách đếm trước khi sửa code.

### 5. Kết quả so sánh mong đợi (`node scripts/viStrings.mjs --compare cb2ab56`)

Sau đợt 1:
- (a) rỗng, (b) rỗng.
- (c) đúng 3 dòng:
  - `"Đã làm ${} ${}"` 2 -> 1
  - `"Cần trại cấp ${}"` 2 -> 1
  - `"Đã có rồi"` 2 -> 1

Sau đợt 2 (vẫn so với `cb2ab56`, cộng dồn):
- (a) đúng 1 dòng: `"★ Lãnh địa của ${} đầu đàn (Lv ${}): nó tấn công ai lại gần!"`.
- (b) đúng 1 dòng: `"★ Lãnh địa của ${} (Lv ${}): nó tấn công ai lại gần!"` (Thiết kế 3.3; phần " đầu đàn" giờ đến từ `palName`, chuỗi đó đã được đếm ở `alphas.ts`).
- (c) đúng 6 dòng: 3 dòng của đợt 1, thêm:
  - `"Đóng"` 3 -> 1
  - `"Thả"` 2 -> 1
  - `"Vào chơi"` 2 -> 1

Ngoài danh sách này, không gộp thêm bản trùng nào khác, kể cả khi chữ giống nhau. `"Ôn hoà"` ×2 ở `terrain.ts` là dữ liệu, không đụng. Mọi dòng khác danh sách là lỗi, phải sửa code, không sửa danh sách.

`"✓ Xong"` không có dấu nên công cụ không thấy. Có test riêng (mục Test).

### 6. Test canh giữ

Trong `scripts/viStrings.test.mjs`, mảng `GUARDED` liệt kê file và thư mục không được chứa chuỗi tiếng Việt (dùng `viLiterals`, đọc file từ đĩa). Lỗi thì in `file:dòng chuỗi` kèm câu "move it to packages/client/src/ui/strings.ts or packages/shared/src/notices.ts".
- Đợt 1: `packages/server/src/rooms/GameRoom.ts`, `packages/server/src/systems/` (mọi `.ts` không phải test), `packages/shared/src/capture.ts`.
- Đợt 2 thêm:
  - `packages/client/src/game/` (đệ quy, gồm `art/`);
  - `packages/client/src/ui/` trừ `strings.ts`;
  - `packages/client/src/net/`;
  - `packages/client/src/main.ts`.
- `crafting.ts` không vào danh sách vì còn `ITEM_INFO`. `notices.test.ts` giữ phần `craftBlocker`.

## Kế hoạch triển khai

Hai đợt, mỗi đợt một vòng coder → tester → reviewer và một commit. Trong mỗi đợt, sau mỗi bước phải xanh: `npm run typecheck` và `npm test`. Đợt 2 chạy thêm `npm run test:e2e` ở cuối.

Đầu mỗi đợt, coder chạy `node scripts/viStrings.mjs` (đợt 1: ngay sau bước 1) và lưu kết quả để đối chiếu. Chạy `--compare cb2ab56` sau mỗi bước.

Ở mọi bước: chép chữ bằng copy/paste nguyên dòng, không gõ lại (dễ mất dấu, đổi `…` thành `...`, mất `\xa0`, ` `). Giữ đúng loại dấu ngoặc của literal gốc nếu chuỗi có ` ` hoặc `\xa0` dạng escape.

### Đợt 1 (T12): công cụ, bảng thông báo server, câu từ chối dùng chung

1. `scripts/viStrings.mjs` theo Thiết kế 4. Thêm `scripts/viStrings.test.mjs`:
   - test `viLiterals` trên mã nguồn nhỏ viết trong test:
     - chuỗi thường;
     - template có `${}`;
     - chuỗi lồng trong biểu thức của template được đếm riêng;
     - chuỗi chỉ ASCII/emoji bị bỏ;
     - chú thích có chữ tiếng Việt không bị đếm;
     - `×` không bị coi là tiếng Việt;
   - test canh giữ với `GUARDED` rỗng (thêm file ở bước 5).

   Chạy không tham số: khớp bảng mốc đo. Chạy `--compare cb2ab56`: không có (a), (b), (c).
2. `packages/shared/src/notices.ts` theo Thiết kế 2 (`NOTICES`, `refusal`, `CRAFT_SOUND_PREFIXES`), export trong `index.ts`.
   - `capture.ts`: `PARTY_FULL_TEXT` và `throwBlocker` lấy chữ từ `NOTICES`.
   - `crafting.ts`: `craftBlocker` lấy chữ từ `NOTICES`.

   Thêm `packages/shared/src/notices.test.ts` (mục Test). `capture.test.ts`, `crafting.test.ts`, `wardrobe.test.ts` phải qua mà không sửa.
3. Server:
   - `GameRoom.notify(client, notice)` và `announce(notice, except?)` theo Thiết kế 2. Sửa JSDoc của hai hàm.
   - Đổi mọi chỗ gọi:
     - `systems/camp.ts`, `combat.ts`, `leaders.ts`, `party.ts`, `skills.ts`, `wild.ts`, `world.ts`;
     - `systems/debug.ts` (`NOTICES.partyFull`);
     - `GameRoom.ts` (`workedWhileAway`).
   - Chỗ nhận chữ từ `throwBlocker`/`craftBlocker` dùng `refusal(blocker)`.
   - Bỏ import `NoticeKind` nếu không còn dùng (`noUnusedLocals`).
   - `GameRoom.test.ts` phải qua mà không sửa.
4. Client, chỉ một chỗ: `game/serverEvents.ts` thay hai `startsWith("…")` bằng `CRAFT_SOUND_PREFIXES.some((p) => msg.text.startsWith(p))`. Phần còn lại của client để đợt 2.
5. Thêm các file đợt 1 vào `GUARDED`. Chạy `--compare cb2ab56`: đúng kết quả "Sau đợt 1" ở Thiết kế 5. Dán nguyên kết quả vào `PROGRESS.md`.
6. `docs/architecture.md`:
   - bảng shared: thêm dòng `notices.ts` (bảng `NOTICES` mỗi câu kèm `kind`, `refusal`, `CRAFT_SOUND_PREFIXES`; câu mới server gửi phải thêm vào đây);
   - bullet `rooms/GameRoom.ts`: `notify(client, notice)`, `announce(notice)`;
   - mục Kiểm thử: `scripts/viStrings.mjs` (`--list`, `--compare <ref>`) và test canh giữ.

### Đợt 2 (T12b): bảng chữ client

1. Tạo `packages/client/src/ui/strings.ts`, JSDoc đầu file nói:
   - mọi chữ client hiện nằm ở đây;
   - chữ server gửi nằm ở `@petgame/shared` `notices.ts`;
   - chữ của dữ liệu (loài, chiêu, đồ, vùng, nhiệm vụ) nằm trong dữ liệu.

   Chuyển nhóm sảnh và kết nối:
   - `LOBBY_TEXT`, `JOIN_TEXT`, `CONNECTION_TEXT`;
   - sửa `main.ts`, `ui/joinStatus.ts` (giữ export `RETURN_HINT`, `INVITE_HINT`), `ui/connection.ts`.

   `ui/joinStatus.test.ts`, `net/connection.test.ts` qua mà không sửa (`ui/connection.ts` không có test riêng; e2e cắt mạng kiểm chữ màn che).
2. Chuyển nhóm bảng và HUD (`HUD_TEXT`, `PARTY_TEXT`, `SKILLBAR_TEXT`, `WARDROBE_TEXT`, `CRAFTING_TEXT`, `QUEST_TEXT`, `MINIMAP_TEXT`, `COMMON_TEXT`). Sửa `ui/hud.ts`, `party.ts`, `skillbar.ts`, `wardrobe.ts`, `crafting.ts`, `quests.ts`, `minimap.ts`. Nhớ `"✓ Xong"`.
3. Chuyển nhóm `game/` (`GAME_TEXT`). Sửa `Game.ts`, `controls.ts`, `hudBridge.ts` (cảnh báo lãnh địa qua `palName`, Thiết kế 3.3; thêm import `palName`, bỏ `getSpecies` nếu thừa), `serverEvents.ts`, `stateSync.ts`. Không đụng `labelLayout.ts`.
4. Thêm `packages/client/src/ui/strings.test.ts` (mục Test).
   - Thêm thư mục, file client vào `GUARDED`.
   - Chạy `--compare cb2ab56`: đúng kết quả "Sau đợt 2" ở Thiết kế 5, dán vào `PROGRESS.md`.
   - Chạy thêm `--list` lọc theo `packages/client/src/ui/strings.ts` và `packages/shared/src/notices.ts` để chắc mọi chữ đã vào bảng.
5. `docs/architecture.md`: bullet `ui/` thêm `strings.ts` (bảng chữ client, theo object `*_TEXT`; chữ mới thêm vào đây, không viết thẳng trong code giao diện). Thêm một câu ở mục packages/client: chữ server gửi lấy từ `NOTICES` (shared).

## Giao thức

- Không đổi `schema.ts`, `messages.ts` (`NoticeMessage` vẫn `{ text, kind }`, chữ vẫn gửi nguyên câu), `Profile`. Dữ liệu trên dây giống hệt BASE từng byte cho cùng một sự kiện.
- Đổi API nội bộ server: `GameRoom.notify(client, notice: NoticeMessage)`, `GameRoom.announce(notice: NoticeMessage & { kind: "news" }, except?)`. Test có sẵn không gọi hai hàm này (đã kiểm tra bằng grep).
- Shared thêm export: `NOTICES`, `refusal`, `CRAFT_SOUND_PREFIXES`. Giữ nguyên `PARTY_FULL_TEXT`, `throwBlocker`, `craftBlocker`, `palName`.

## Test

**Quyết định: test giữ chữ viết thẳng (literal), không import từ bảng.**
- Literal là hàng rào chống lỡ tay đổi chữ: test import từ bảng sẽ luôn xanh dù câu đã bị sửa.
- Mọi file test có sẵn **không được sửa một byte**: `GameRoom.test.ts`, các test shared, `joinStatus.test.ts`, `connection.test.ts`, `toastQueue.test.ts`, `tests/e2e/multiplayer.spec.ts`...
- Những test đang import hằng (`PARTY_FULL_TEXT`, `RETURN_HINT`, `INVITE_HINT`) vẫn import đúng tên, đúng đường dẫn cũ, nhờ alias ở Thiết kế 2 và 3.2.
- Kiểm: `git diff --stat cb2ab56 -- '*.test.ts' '*.test.mjs' tests/` chỉ được có file **mới** (`notices.test.ts`, `strings.test.ts`, `viStrings.test.mjs`), không có file sửa.

Test mới, chữ mong đợi viết literal.

`packages/shared/src/notices.test.ts` (đợt 1):
- Mọi mục của `NOTICES` (gọi hàm mẫu với tham số mẫu) có `kind` thuộc 6 loại `NoticeKind`, `text` không rỗng. Mục `news` chỉ có `alphaKnockedOut`, `alphaCaught`.
- Chữ ra đúng từng ký tự ở các mẫu có nhánh hoặc ký tự đặc biệt:
  - `NOTICES.released("Voltmouse").text` = `"Đã thả Voltmouse. Tạm biệt! 👋"`;
  - `NOTICES.chestFound("🪵\xa05", true).text` = `"Rương báu! 🪵\xa05 (mở 👕 Tủ đồ)"`, với `false` thì không có phần ngoặc;
  - `NOTICES.questDone("Bắt thú đầu tiên", "🪵\xa05").text` = `"Xong nhiệm vụ \"Bắt thú đầu tiên\"! 🪵\xa05"`;
  - `NOTICES.partyFull.text` = `"Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt"`, và `=== PARTY_FULL_TEXT`.
- `CRAFT_SOUND_PREFIXES`:
  - `NOTICES.crafted("🔵", "Bóng xịn").text` và `NOTICES.campLeveled(2, "🏕️").text` bắt đầu bằng một tiền tố;
  - không mục nào khác (gọi với tham số mẫu) bắt đầu bằng tiền tố nào, để tiếng chế tạo không kêu nhầm.
- `refusal("x")` = `{ kind: "refused", text: "x" }`. `throwBlocker(0, { boss: true })` = `NOTICES.bossUncatchable.text`. Với các nhánh của `craftBlocker`: chữ trả về là `text` của một mục `refused`.

`packages/client/src/ui/strings.test.ts` (đợt 2, chạy trong Node, không DOM):
- `GAME_TEXT.caught("Voltmouse đầu đàn", true)` = `"★ Bắt được Voltmouse đầu đàn! 🎉"`; với `false` thì không có `★ `.
- `GAME_TEXT.lairWarning(palName("voltmouse", true), 7)` = `"★ Lãnh địa của Voltmouse đầu đàn (Lv 7): nó tấn công ai lại gần!"`. Đây là chuỗi BASE ghép cho cùng thú, viết literal.
- Lên cấp có và không có chiêu mới: hai câu literal.
- `JOIN_TEXT` câu `full` chứa `` `${MAX_PLAYERS} người` ``; câu `tooMany` chứa `"sau 1 phút"` (`EMPTY_WORLD_HOLD_MS` = 60 s).
- `PARTY_TEXT` có đúng `"✓ Xong"` (công cụ không thấy chuỗi này).
- File này không được import `hud.ts` hay module có DOM. Nếu `strings.ts` buộc phải import gì từ `ui/` khác thì sai thiết kế.

`scripts/viStrings.test.mjs`: như kế hoạch đợt 1 bước 1 và Thiết kế 6.

Tích hợp server (`GameRoom.test.ts`) và e2e: không thêm. Bộ có sẵn đã so chữ và `kind` của nhiều thông báo. Tester chạy:
- đợt 1: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (server đổi chỗ gửi tin, e2e đọc chữ toast);
- đợt 2: như đợt 1. E2E là kiểm tra chính cho client.

## Tiêu chí hoàn thành

Đợt 1 (T12):
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` xanh.
- [ ] `node scripts/viStrings.mjs --compare cb2ab56` in đúng "Sau đợt 1" (Thiết kế 5), thoát mã 0. Kết quả dán trong `PROGRESS.md`.
- [ ] Không còn chuỗi tiếng Việt trong `server/src/rooms/GameRoom.ts`, `server/src/systems/*.ts`, `shared/src/capture.ts`. Test canh giữ xanh. `craftBlocker` không còn literal tiếng Việt (`--list` trên `crafting.ts` chỉ còn 3 tên `ITEM_INFO`).
- [ ] `NOTICES` có đủ 36 mục ở bảng Thiết kế 2, đúng khoá, đúng `kind` như chỗ gọi ở BASE. Mọi `notify`/`announce` lấy câu từ `NOTICES` (trực tiếp, hoặc qua `refusal` cho chữ của hàm chặn dùng chung).
- [ ] Hàm mẫu chỉ nhận giá trị thô, giữ số và thứ tự `${}`. Bảng không gọi `getSpecies`, `palName`, `rewardText`.
- [ ] `serverEvents.ts` dò tiếng chế tạo qua `CRAFT_SOUND_PREFIXES`. Test giữ tiền tố khớp mẫu.
- [ ] Không file test có sẵn nào bị sửa (lệnh `git diff --stat` ở mục Test).
- [ ] Không đụng `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`. Không chạy `git stash`. `git stash list` vẫn còn đủ hai mục như lúc bắt đầu.
- [ ] `docs/architecture.md` cập nhật (đợt 1 bước 6).

Đợt 2 (T12b):
- [ ] Bốn lệnh kiểm thử xanh. E2E chạy đủ, không bỏ test nào.
- [ ] `--compare cb2ab56` in đúng "Sau đợt 2", thoát mã 1 chỉ vì đúng một cặp (a)/(b) của cảnh báo lãnh địa. Kết quả dán trong `PROGRESS.md`.
- [ ] Không còn chuỗi tiếng Việt trong `client/src/game/**`, `client/src/ui/**` (trừ `strings.ts`), `client/src/net/**`, `client/src/main.ts`. Test canh giữ xanh. `"✓ Xong"` nằm trong `PARTY_TEXT`.
- [ ] `strings.ts` chỉ import hằng số và kiểu từ `@petgame/shared`. Không có trạng thái, không DOM.
- [ ] Cảnh báo lãnh địa dùng `palName(id, true)`.
- [ ] `RETURN_HINT`, `INVITE_HINT` vẫn export từ `joinStatus.ts`. Không file test có sẵn nào bị sửa.
- [ ] Không đụng ba file của stash T63, không `git stash`.
- [ ] `docs/architecture.md` cập nhật (đợt 2 bước 5).

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Chép sai chữ khi chuyển** (mất dấu, `…` thành `...`, mất khoảng trắng không ngắt `\xa0`/` `, đổi `"` thành `'` trong chữ). Chặn bằng `--compare` (bắt mọi đổi chữ trong chuỗi có dấu) cộng e2e/unit test có sẵn so chữ literal.
   - Chỗ công cụ không thấy: chuỗi không có dấu (chỉ `"✓ Xong"`, có test riêng) và chữ nằm trong biểu thức đã bị thay bằng `${}`. Ví dụ đổi nhầm `Math.ceil(left / 1000)` thành `left`: số và thứ tự tham số đúng nhưng giá trị sai. Reviewer đọc từng chỗ gọi so với BASE (`git diff cb2ab56`), chú ý phép tính và thứ tự đối số.
2. **Đổi chữ ký `notify` làm sai `kind`**. Bảng Thiết kế 2 ghi `kind` theo BASE. Reviewer so từng mục với `git show cb2ab56:<file>`. `GameRoom.test.ts` có so `kind` ở một số tin.
3. **`news` chuỗi rỗng ở `wild.ts`** đổi sang `undefined`: giữ đúng điều kiện hẹn giờ (`xp > 0 || news`). Nếu sai, tin ★ hoặc kinh nghiệm bắt thú đầu đàn mất. Có test tích hợp T8 bắt thú đầu đàn.
4. **Bundle sảnh lớn thêm** vì `strings.ts` chứa cả chữ game: vài KB, chấp nhận. Nếu `npm run build` báo chunk sảnh tăng bất thường (> 20 KB) thì ghi vào `PROGRESS.md`, không tự tách file.
5. **Stash T63 còn sửa `PROGRESS.md` và `REVIEW.md`.** Hai file này đội nào cũng ghi mỗi nhiệm vụ, nên khi mở lại T63 sẽ đụng. Đây là việc của agent chính lúc khôi phục T63: lấy bản của stash cho hai file đó. Không ảnh hưởng code T12.
6. **Chữ còn rải rác sau T12** (ghi để agent chính cân nhắc thêm việc, không làm ở đây):
   - chữ tĩnh của `index.html` (sảnh và bộ canh tải; `startCard` lặp lại hai câu "Không tải được game", "Kiểm tra mạng rồi bấm Tải lại." của bộ canh tải);
   - chuỗi ASCII người chơi thấy (`Lv`, `XP`);
   - markup trong 8 chuỗi;
   - `PARTY_TEXT.elements` lặp `ELEMENT_INFO` của shared;
   - `server/index.ts` in console.

## Đề xuất tách nhiệm vụ (cho agent chính cập nhật `TASKS.md`)

- **T12** (đợt 1): công cụ `viStrings`, bảng `NOTICES` ở shared kèm `kind`, server dùng bảng, câu từ chối dùng chung, tiền tố tiếng chế tạo. Một commit.
- **T12b** (đợt 2, ngay sau T12): bảng chữ client `ui/strings.ts`, mọi file `ui/`, `game/`, `main.ts`, cảnh báo lãnh địa qua `palName`. Một commit.
- Việc mới (ưu tiên thấp, sau T12b): **"Chuẩn bị đa ngôn ngữ phần còn lại"**. Gồm chữ tĩnh `index.html` và bộ canh tải (gộp hai câu lặp với `startCard`), chuỗi ASCII (`Lv`, `XP`), tách markup khỏi 8 chuỗi HTML, `PARTY_TEXT.elements` lấy từ `ELEMENT_INFO`. Chỉ nên làm khi có quyết định làm bản tiếng Anh.
