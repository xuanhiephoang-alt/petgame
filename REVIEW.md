PASS
# REVIEW: T8 Dấu ★ cho thú đầu đàn đã bắt, vòng 1

## Kết luận
Thay đổi làm đúng và đủ PLAN.md, không làm thừa. Cờ `alpha` được lưu đúng ở mọi chỗ server tạo hay chép thú, hồ sơ cũ đọc ra `false`. Tin ★ của lần bắt bỏ qua người ném, kể cả khi người ném vừa nối lại mạng; mình đã thử thật trường hợp này. Không còn lỗi phải sửa. Mình chạy lại `npm run typecheck` (sạch) và `npm test` (300/300).

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm
- **Giao thức, lưu game:**
  - `alpha: t.boolean()` là trường cuối của `OwnedPal` (sau `assignment`) và của `Companion` (sau `maxHp`).
  - `SavedPal.alpha`; `sanitizeProfile` đọc `p.alpha === true`; `emptyProfile` không đổi.
  - Cả 3 chỗ `new OwnedPal()` trong `GameRoom.ts` đều gán cờ: `debug:givePal` (dòng 457, `message?.alpha === true`), `onJoin` (521), `handleThrow` (934).
  - `spawnCompanion` (2034) và `saveNow` (2095) ép `=== true`.
  - Hook nằm trong khối `PETGAME_DEBUG === "1"` (dòng 393-473). Không còn `alphaName`.
  - Client: `updateHud` truyền `alpha` sang `PartyEntry`. Nhãn đọc `companion.alpha` ngay trong `onAdd`; server gán cờ trước `companions.set`.
- **Test lưu game và tin nhắn** (đọc từng test, đối chiếu tiêu chí):
  - `store.test.ts`: lưu rồi đọc lại `alpha: true` qua SQLite. 4 giá trị (thiếu, `true`, `"yes"`, `1`) ra `[false, true, false, false]`. Đọc lại kết quả không đổi gì.
  - Tích hợp, hồ sơ cũ: ghi bằng `db.save` không có trường, rồi vào lại qua SQLite thật. Cả thú trong túi lẫn thú đi theo có `alpha` `toBe(false)`.
  - Tích hợp, bắt thú đầu đàn: cờ là `true` trong túi, ở thú đi theo và trong state của client. Thú thường bắt sau không có trường trong kết quả, cờ là `false`. Sau khi vào lại: `[true, false]`, thú đi theo vẫn `true`.
  - Tích hợp, hook: `"yes"` ra `false`, và thú đi theo đổi sang Leafkit có cờ `false`.
  - Tích hợp, thả: thông báo "Đã thả Voltmouse đầu đàn. Tạm biệt! 👋".
  - Các test bắt được lỗi thật:
    - `saveNow` bỏ trường thì vào lại ra `[false, false]`;
    - quên gán ở `onJoin` hay `spawnCompanion` thì ra `undefined`, mà test so bằng `toBe(false)`;
    - dùng `!!alpha` thì `"yes"` thành `true`.
  - Test 3 (watcher): ghi thứ tự tin ★ rồi `LevelUp` ở watcher. Ở người ném, chỉ kiểm "không có tin ★" sau khi đã nhận `LevelUp`. Nếu tin ★ được gửi tới người ném, nó đến trước `LevelUp` trên cùng socket, nên kiểm âm như vậy là hợp lệ. Bỏ `except` thì test đỏ.
  - Test "người ném rời phòng trước khi bóng khép" giữ nguyên và vẫn qua. Hạ gục vẫn gọi `announce(text)` không có `except`; hai test cũ vẫn kiểm người hạ nhận tin ★.
- **Một hẹn giờ, tin trước kinh nghiệm sau:** `handleThrow` dòng 947-954: `announce` rồi mới `grantXp`, trong cùng một `clock.setTimeout`.
- **Nối lại mạng:**
  - Đọc `@colyseus/core` 0.18.18 (`Room.mjs`):
    - `_onLeave` xoá client khỏi `this.clients` trước khi gọi `onDrop`;
    - khi nối lại, Colyseus `push` một đối tượng `Client` mới;
    - `broadcastMessageType` so `except` bằng tham chiếu;
    - `{ except: undefined }` thì gửi mọi người.
  - Thử thật bằng script tạm, không thuộc project (`/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t8review/reconnect-news.mts`):
    - người ném bắt Voltmouse đầu đàn, cắt socket, nối lại sau 54 ms (cùng sessionId, đối tượng `Client` khác);
    - lúc hẹn giờ chạy, người ném chỉ nhận "Xong nhiệm vụ…", không có tin ★;
    - watcher nhận đúng một tin ★.
- **Hiển thị:**
  - Đã xem đủ 9 ảnh của tester (`card-*`, `tag-*`, `dialog-*` ở 390×844, 844×390, 1280×720), gồm `tag-390x844.png` và `tag-844x390.png` mà tester chưa mở.
  - Nhãn "★ Lv 15 Voltmouse": chữ vàng trên nền tối, đọc rõ, không chồng nhãn khác.
  - Thẻ: ★ vàng, vạch vàng nằm trong viền xanh "đi theo".
  - Hộp thả có dòng "★ Thú đầu đàn" ngay dưới tiêu đề và vừa màn hình 844×390.
  - CSS `.label.companion.alpha` không dính luật `.label.pal.alpha` của thú đầu đàn hoang. `nameShows` (`labels.ts`) cho cùng kết quả với nhãn không có class `pal`. Hạng nhãn không đổi; `labels.ts` và `labelLayout.ts` không đổi.
  - `palName` dùng ở cả 4 chỗ PLAN nêu. Cảnh báo lãnh địa giữ nguyên, đúng phạm vi.
- **Không thêm lợi ích:** cờ của thú đã bắt chỉ được đọc ở `spawnCompanion`, `release`, `saveNow` và ở client để hiển thị.
- **Tài liệu:** `architecture.md` đủ 5 chỗ. `pals.md` và `hud.md` (commit `0ef223e`) khớp code.

## Góp ý không bắt buộc
- **Tên trên thẻ ngắt giữa "Lv" và số** ở cả 3 khung hình: "★ Voltmouse · Lv" rồi "15" ở dòng dưới (xem `card-*.png`). Nên dùng dấu cách không ngắt (`Lv ${level}`) hoặc bọc "· Lv N" trong `span` có `white-space: nowrap`. PLAN đã chấp nhận tên xuống dòng, nên để T18.
- **Test nối lại cho tin ★** dễ viết hơn PLAN ước tính: `cutConnection`, `holdReconnect`, `reconnected` có sẵn trong `GameRoom.test.ts`, và script tạm ở trên chạy dưới 3 giây.
- **`is harder to catch than its kind`** chỉ kiểm `result.alpha` ở nhánh thoát theo xác suất (ném vào con đầy máu trượt khoảng 95%). Thêm một lần ném với `Math.random` trả 0,99 sẽ ghim nhánh thoát.
- **E2E:** `page.waitForTimeout(2500)` trước khi tải lại là không cần. Tab đóng thì `onDrop` gọi `saveNow`; lần vào lại gọi `endSession` (lại `saveNow`) trước khi đọc hồ sơ. CLAUDE.md khuyên chờ theo điều kiện.

## Việc mới nên đưa vào TASKS.md
T12 và T14 đã có ghi chú từ PLAN. Đề xuất ghép vào việc có sẵn:
- **T18:** tên trên thẻ thú ngắt giữa "Lv" và số (ảnh T8, "★ Voltmouse · Lv 15" ở cả 3 khung hình). Dùng dấu cách không ngắt, hoặc `nowrap` cho phần "· Lv N".
- **T24:** test tích hợp cho người ném thú đầu đàn rớt mạng rồi nối lại trước khi bóng khép. Dùng `cutConnection` và `holdReconnect` sẵn có. Kỳ vọng: người ném không nhận tin ★, người khác nhận đúng một lần.
- **T20** (dọn e2e): bỏ `waitForTimeout(2500)` trong test e2e của T8. Thêm một lần ném trượt chắc chắn vào thú đầu đàn ở test tích hợp, để kiểm `CaptureResultMessage.alpha` khi thoát.
