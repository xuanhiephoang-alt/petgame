PASS
# REVIEW: T12b Bảng chữ client `ui/strings.ts` (T12 đợt 2), vòng 1

## Kết luận
Đợt 2 làm đúng PLAN.md và đủ tiêu chí hoàn thành.
- `--compare cb2ab56` in đúng "Sau đợt 2": (a)/(b) chỉ có cặp cảnh báo lãnh địa, (c) đúng 6 bản gộp. Mã thoát 1 chỉ vì cặp đó.
- Ngoài `strings.ts` và `gallery.ts`, client không còn chuỗi tiếng Việt.
- 8 chuỗi HTML được chuyển nguyên văn và vẫn gắn vào trang như cũ.
- `strings.ts` chỉ import hằng và kiểu.
- Reviewer tự chạy lại: `npm test` 37 file, 526 test xanh; `npm run typecheck` sạch.
- So với `cb2ab56`, `git diff --stat` trên `*.test.ts`, `*.test.mjs`, `tests/` và `labelLayout.ts` chỉ có file mới, không file có sẵn nào bị sửa.
- `git stash list` còn đủ 2 mục.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm
- **Chỗ gọi so với BASE:** đọc từng dòng `git diff 1c1a708`. Số chỗ ghép và thứ tự đối số giữ nguyên ở mọi hàm mẫu:
  - `alphaLabel(level, name)` theo đúng thứ tự `★ Đầu đàn · Lv ${level} ${name}`;
  - `caught(name, Boolean(msg.alpha))`, `escaped(name, Math.round(msg.chance * 100))`;
  - `levelUpLearned` vẫn ghép danh sách chiêu ở chỗ gọi;
  - `statusLines(…, items, help)` giữ `${help}` là một chỗ ghép riêng;
  - `learnsAt` mang theo chuỗi con " (học ở cấp …)" như PLAN 2;
  - `confirmTitle` giữ ` `.
  
  Chuỗi điều kiện của nút ở `wardrobe.ts` chỉ được xuống dòng lại, logic giống BASE. `joinCard` và `startCard` spread `{ title, detail }` ra trước các cờ, nên thứ tự khoá và giá trị giống BASE.
- **HTML và XSS:** 8 chuỗi đều khớp BASE: `eatButton`, `inviteButton`, `statusLines`, `inviteLine`, 2 `header`, `allDone`, `hintAndReward`. Không có giá trị nào người chơi điều khiển được được ghép thêm vào HTML.
  - `statusLines` nhận số và icon tài nguyên như cũ.
  - `inviteLine` nhận `href` thô và `shown` đã qua `escapeHtml`, `escapeHtml` vẫn gọi ở `hud.ts`, giống hệt BASE.
  - `hintAndReward` nhận `quest.hint` và `rewardText(...)` từ dữ liệu, như cũ.
  - `quest.title` vẫn ghép ở `quests.ts` như BASE.
  - Các chữ khác đi vào `textContent`, `title` hoặc `aria-label`, không vào `innerHTML`.
- **Import:** `strings.ts` chỉ import `BERRY_HEAL`, `EAT_COOLDOWN_MS`, `EMPTY_WORLD_HOLD_MS`, `MAX_PLAYERS` và `type Element` từ `@petgame/shared`. Không import gì từ `ui/` hay `game/`, không có DOM, không có trạng thái. `strings.test.ts` chỉ import `palName` và `strings.ts`.
- **Kiểu:**
  - Các object hằng dùng `as const`.
  - `PARTY_TEXT.elements` có `satisfies Record<Element, string>`, nên thêm hệ mới mà quên chữ là lỗi biên dịch.
  - `WARDROBE_TEXT.from` được kiểm qua chú thích kiểu `Record<Wearable["from"], string>` ở `wardrobe.ts`.
  - `CONNECTION_TEXT[status.reason]` và `JOIN_TEXT[failure]` đều được kiểm kiểu theo khoá.
  - Hàm mẫu khai tham số là `string`, `number` hoặc `boolean` đúng luật PLAN 2.
- **Các bản gộp:** đúng 3 bản PLAN cho phép, mỗi bản cùng một nghĩa:
  - `COMMON_TEXT.close` là `aria-label` của nút ✕ ở 3 bảng;
  - `LOBBY_TEXT.join` là cùng một nút;
  - `PARTY_TEXT.release` là hành động "Thả" ở nút của thẻ thú và nút xác nhận.
  
  Không gộp thêm câu nào khác: `alphaTitle` và `alphaBadge`, `following` và `confirmFollowing` vẫn tách riêng.
- **Cảnh báo lãnh địa:** dùng `palName(p.speciesId, true)`. Có test literal, và tester đối chiếu đủ 13 loài.
- **Test canh giữ:** danh sách `GUARDED` đúng Thiết kế 6. `game/` được quét đệ quy, gồm cả `art/`; `ui/` bỏ đúng `strings.ts`; có cả `net/` và `main.ts`. Ở `packages/client/src`, chỉ `gallery.ts` không được canh, và PLAN loại nó có chủ đích.
- **Tài liệu:**
  - `docs/architecture.md` có `strings.ts` ở bullet `ui/`, câu mở đầu mục packages/client, và dòng test canh giữ đã cập nhật.
  - Dòng 49 đã sửa thành `announce(notice, except)`, xong góp ý của vòng trước.

## Góp ý không bắt buộc
- **Chữ client gần như không có test đơn vị giữ.** Tester đã chứng minh: đổi `MINIMAP_TEXT.title` hay `GAME_TEXT.dodge` thì không test nào bắt. Hiện `--compare` là bằng chứng chính, đúng như PLAN chấp nhận. Sau này có thể thêm một test chụp toàn bộ `strings.ts` (literal) để bảng không bị sửa nhầm. Nếu thêm, phải hiểu rằng ai cố ý sửa chữ sẽ phải sửa luôn test đó.
- **`PARTY_TEXT.release`** đang dùng chung cho nút của từng thẻ thú và nút xác nhận trong hộp thoại. Nếu sau này hai nút cần chữ khác nhau (ví dụ nút xác nhận ghi "Thả đi"), cần tách thành hai khoá.
- **`JOIN_TEXT`** gộp hai nhóm chung một object: lỗi vào phòng (`JoinFailure`) và lỗi mở game (`StartFailure`: `download`, `broken`). Cách này tiện cho `startCard` spread, nhưng hai nhóm phải không trùng khoá. Có thể tách thành `START_TEXT` khi làm đa ngôn ngữ.
- **Chú thích ở `party.ts:327`:** đã đổi `"Giữ lại"` thành `PARTY_TEXT.keep` nhưng vẫn để `"Thả"` ngay cạnh, và dòng 48, 62 cũng còn tên nút bằng chữ. Chú thích không bị công cụ đếm, nên nên để nguyên chữ như BASE cho thống nhất.
- **`wardrobe.ts`:** chuỗi điều kiện của nút bị xuống dòng thành 11 dòng. Có thể gom lại thành một bảng nhỏ theo `slot`, nhưng việc đó nằm ngoài phạm vi.
- **Việc còn lại theo PLAN rủi ro 6** (để agent chính đưa vào `TASKS.md`):
  - chữ tĩnh trong `index.html`;
  - chuỗi ASCII `Lv`, `XP`;
  - tách markup khỏi 8 chuỗi HTML;
  - `PARTY_TEXT.elements` lấy từ `ELEMENT_INFO` thay vì lặp lại.
