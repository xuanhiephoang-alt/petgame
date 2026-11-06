PASS
# REVIEW: T32 Ăn quả mọng có hồi chiêu, vòng 2

## Kết luận
Hai lỗi phải sửa của vòng 1 đã hết. Mỗi luật server giờ có test hỏng ngay khi luật bị làm sai (đã thử đột biến). Code sản phẩm giống hệt vòng 1, vòng 2 chỉ đổi test và một dòng `scripts/shots.mjs`, không thấy hồi quy.

Đã tự kiểm:
- Diff của `packages/shared`, `packages/server/src/rooms/GameRoom.ts`, `packages/client`, `docs`, `TASKS.md` trùng từng byte với bản đã rà ở vòng 1. Diff e2e vẫn hai đoạn cũ: 60 dòng và 9 dòng, cùng vị trí.
- Typecheck sạch. `npm test` qua 294/294. Riêng nhóm `-t "eating"` qua 7/7.
- Đột biến chạy trên bản sao trong scratchpad, repo không bị sửa:
  - Bỏ `- TICK_MS` ở `GameRoom.ts:1134`: test "eating: one tick early is let through, a little more is not" hỏng (`expected 3 to be 2`).
  - Đưa kiểm hồi chiêu lên trước kiểm đầy máu: test "only a berry eaten starts the wait..." hỏng (`expected [ …(2) ] to have a length of 3 but got 2`).
- Vòng 1 đã chạy qua e2e mới và `toasts (phone sideways)` trên đúng code sản phẩm này. Cũng ở vòng 1, tester đã chạy cả bộ e2e.

## Lỗi phải sửa (FAIL khi còn mục này)
Không còn.

Hai lỗi của vòng 1 đã được sửa như sau:
1. Bước 4 của test B trước đây không kiểm được gì. Nay test kiểm số thông báo tăng đúng 1, ở cả bước "đầy máu" lẫn bước "hết quả", trong lúc đang hồi.
2. Luật cho sớm một tick trước đây chưa có test. Test mới gọi `eat()` liền một mạch, không `await` ở giữa nên đồng hồ không đổi:
   - `nextEatAt = now + TICK_MS`: ăn được;
   - `nextEatAt = now + TICK_MS + 1`: bị bỏ qua.

   Hai lần gọi này khoá đúng biên của luật.

## Góp ý không bắt buộc
- Test mới dùng client giả `{ sessionId }`. Hiện vậy là đủ, vì cả hai lần gọi đều không đi qua `notify`. Nếu sau này `eat()` dùng thêm trường khác của client thì test sẽ báo lỗi rõ ràng, không qua nhầm. Muốn chắc hơn thì dùng client thật của server: `room.clients.find((c) => c.sessionId === sid)!`.
- Test D (góp ý vòng 1, không bắt buộc): `waiting` vẫn được đọc sau khi rớt mạng. Lần ăn bị từ chối ngay sau đó vẫn bắt được trường hợp `onDrop` xoá hồi chiêu.
- `scripts/shots.mjs:276`: chú thích ghi cứng "4 s" nhưng có nêu tên `EAT_COOLDOWN_MS`, chấp nhận được.
- `.eat-btn.cooling` vẫn để `cursor: pointer` trên desktop. Chỉ là chuyện hình thức.

## Việc mới cho TASKS.md
- **Gộp vào T39** (vùng joystick che các nút ở cột trái) hai ý:
  - **Nút Ăn khi đang giữ joystick:**
    - Nút 🫐 Ăn nghe `click`. Các nút cảm ứng khác (Đánh, Bắt, 💨, ô chiêu) nghe `pointerdown` kèm `preventDefault`.
    - Cần thử trên máy thật, nhất là iOS Safari: một ngón đang giữ joystick, chạm Ăn bằng ngón kia thì có ăn không. Trình duyệt có thể không phát `click` cho ngón thứ hai.
    - Nếu không ăn được: chuyển nút Ăn sang `pointerdown`, giữ Enter và `click` cho bàn phím.
  - **Tài liệu sau khi xong T39:** sửa chú thích CSS ở `packages/client/index.html:90-92` (đang ghi "the column's other buttons are T18") và mục "Còn tồn tại" trong `docs/design/hud.md` cho khớp.
- Không có việc mới nào khác. T39 đã có trong `TASKS.md`, ghi chú sau T32 cho T18 cũng đã có.
