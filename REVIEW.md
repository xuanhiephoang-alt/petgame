PASS
# REVIEW: T4 Lên cấp nhanh hơn, vòng 3

## Kết luận

Hai lỗi thứ tự tin đã hết: `feed` (vòng 1) và bắt thú đầu đàn (tester tìm ra ở vòng 2). Ngoài toast "Bắt được…" đã dành cho T6, không còn chỗ nào gửi tin báo sau tin `LevelUp` của cùng sự kiện. Phần còn lại của T4 không đổi kể từ vòng 1 và vẫn đạt. Không có hồi quy; tài liệu khớp code.

Đính chính REVIEW vòng 1: mình đã viết "hai hẹn giờ cùng mốc, tin báo được hẹn trước nên chạy trước". Câu này **sai**. Đã xác minh trong `node_modules/@colyseus/timer/build/ClockTimer.mjs` (bản 2.0.3, chỉ có một bản trong `node_modules`): `tick()` duyệt `while (i--)` từ cuối mảng về đầu, nên trong cùng một tick, hẹn giờ đăng ký sau chạy trước. Tester vòng 2 bắt đúng lỗi này.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Góp ý không bắt buộc

- **`GameRoom.ts:1601` `announce(text, delayMs = 0)`: tham số `delayMs` không còn ai dùng.** Hai chỗ gọi (`knockOut`, hẹn giờ bóng khép) đều gửi ngay. Nên bỏ tham số và phần trong JSDoc nói về nó, ví dụ khi dọn ở T20. Giữ lại thì dễ có người lặp lại đúng lỗi vừa sửa: hẹn `announce(…, d)` cạnh một hẹn giờ khác cùng mốc `d`.
- **Câu mới trong `docs/architecture.md` nói "chỗ nào cộng kinh nghiệm cũng gửi tin báo của sự kiện trước"**, nhưng kinh nghiệm bắt thú thường được cộng lúc ném, và toast "Bắt được…" khi bóng khép vẫn đè sau đó. Nên thêm ngoại lệ này (việc của T6) để tài liệu không hứa quá.
- **`PLAN.md` mục 4 vẫn ghi giả định sai** ("tin báo được hẹn trước nên đến trước"). Code và `docs/architecture.md` đã đúng. Đây là file của game-designer: nên sửa câu đó hoặc ghi chú trước khi commit, để lịch sử không giữ một khẳng định sai.
- **Gom cho T6 (hàng đợi hoặc ưu tiên toast).** Đều có từ trước hoặc đã chấp nhận, không chặn T4:
  1. "Bắt được…" đè toast lên cấp do kinh nghiệm bắt lúc ném.
  2. Toast phần thưởng trùm (chỗ duy nhất báo tên món đồ hiếm của trùm) bị toast lên cấp đè: luôn luôn ở cấp ≤ 7, 85% ở cấp 8, 61% ở cấp 10.
  3. Thú đi theo ra đòn kết liễu trùm: `grantXp(XP_PER_HIT)` (`GameRoom.ts:829`, `:1473`) chạy sau `defeatBoss` và có thể gây tin `LevelUp` thứ hai, đè chữ "Học được chiêu mới" của tin thứ nhất (khoảng 2%; chữ bay tên chiêu vẫn còn). Sửa rẻ: cộng `XP_PER_HIT` trước `hitWild` / trước vòng `hit.forEach`.
  4. Bắt thú đầu đàn dựa vào khoảng đệm 300 ms giữa lúc client hiện kết quả bóng và hẹn giờ `reveal + 300` của server. Client kẹp mỗi khung hình tối đa 100 ms, nên máy dưới 10 khung hình mỗi giây hoặc mạng giật hơn 300 ms vẫn có thể cho "Bắt được…" đến sau toast lên cấp.
  5. Toast "Xong nhiệm vụ" của nhiệm vụ cuối (bắt thú đầu đàn) chỉ hiện khoảng 0,1 giây trước khi tin "★ … đã bắt được …" đè; trước T4 cũng vậy.
- **Còn từ vòng 1 (tuỳ chọn):**
  - `CLAUDE.md` thiếu hook `xp` trong danh sách `debug:*` (việc của agent chính).
  - Helper `followerOf(player)` thay 4 chỗ `player.pals.find(…activePalId)`.
  - JSDoc riêng cho `XP_CURVE_POWER`.
  - Tin "+XP" vẫn hiện khi thú đã cấp 30.
  - Test và e2e hỏng nếu chỉnh `XP_CURVE` 14 (`PROGRESS.md` vòng 2 đã đính chính).

## Đã kiểm (đạt)

- **Lỗi vòng 1 (`feed`):**
  - `notify` "ăn ngon lành" chạy trước, `grantXp` sau, kèm cùng chú thích như `knockOut`/`defeatBoss`; `scheduleSave` giữ nguyên.
  - Test `feeding a snack tells of the meal first…` kiểm đúng mảng thứ tự `[ăn ngon lành, LevelUp 6 -> 7]`, cấp 7 xp 0, bánh về 0.
- **Lỗi vòng 2 (bắt thú đầu đàn), `GameRoom.ts:931-941`:**
  - Tin báo và `ALPHA.xp` chung **một** `clock.setTimeout(reveal + 300)`: `announce(news)` trước, rồi `grantXp` chỉ khi thú vẫn còn trong túi người ném. Thứ tự không còn phụ thuộc cách đồng hồ duyệt.
  - Chữ tin báo tính lúc ném, nên người ném rời đi thì những người khác vẫn nghe tin và không ai nhận kinh nghiệm (có test). Người đang chờ nối lại vẫn nhận, vì T3 giữ nguyên `sessionId`. Phòng bị huỷ thì đồng hồ dừng nên hẹn giờ không chạy.
  - Test thứ tự và test người ném rời đều tất định, số tính từ `addXp`, `finishXp`, `ALPHA.xp`. Tester kiểm: trả lại code cũ thì test hỏng đúng (`expected 1 to be greater than 2`).
- **Rà mọi chỗ cộng kinh nghiệm ở hai phía:**
  - 9 chỗ gọi `grantXp` và 9 hẹn giờ server (đã `grep` lại, khớp bảng của coder).
  - Client chỉ hiện toast từ ba tin của server: `Notice` (riêng "Xong nhiệm vụ" trễ 2,1 giây), `LevelUp` và `CaptureResult`. `Defeated`, `BossDefeated`, `QuestDone`, `Produced` không hiện toast.
  - `knockOut`, `defeatBoss` (với mọi người thắng), `feed` và bắt thú đầu đàn đều gửi tin báo trước, `grantXp` sau. Làm việc, đòn thường, chiêu và `debug:xp` không có toast nào sau `LevelUp`.
- **Không hồi quy:**
  - Từ vòng 1, code sản phẩm chỉ đổi ở `GameRoom.ts` (hai chỗ trên). Số dòng đổi của shared, client, store, e2e, dữ liệu và `docs/design/skills.md` giống hệt vòng 1, khớp với kiểm sha256 của tester.
  - Tester: 242 test, e2e 23/23, build sạch.
- **Tài liệu:**
  - `docs/architecture.md` có thêm dòng "Thứ tự tin báo và `LevelUp`", nói đúng cách `ClockTimer` duyệt hẹn giờ (xem góp ý 2 về ngoại lệ bắt thú).
  - `docs/design/pals.md` nêu đủ bốn sự kiện: hạ thú đầu đàn, hạ trùm, cho ăn bánh, bóng khép trên thú đầu đàn vừa bắt.
- **Mình chạy lại:** `npm run typecheck` sạch; 19 test tích hợp liên quan trong `GameRoom.test.ts` qua 19/19 (gồm `pack leaders`, cho ăn, trùm, hook `debug:xp`, hồ sơ cũ, bắt giữ cấp, hạ gục theo cấp).
