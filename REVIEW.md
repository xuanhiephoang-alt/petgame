PASS
# REVIEW: T5 Nhãn tên không đè nhau, vòng 2

## Kết luận

Lỗi vòng 1 đã được sửa: `worldShots` đóng context iPhone 13 trong `try/finally`, nên khi `npm run shots` chạy chế độ mặc định, nhóm `labels` không còn chạy chung với một trang WebGL khác. Coder và tester mỗi người chạy một lần chế độ mặc định, cả hai lần đủ 24 ảnh. 9 ảnh nhãn đều 0 cặp chồng, ảnh `portrait-alpha` đủ 3 nhãn.

Vòng 2 chỉ sửa `scripts/shots.mjs` và một dòng chú thích trong `Game.ts`. Các file khác giữ nguyên như lúc tôi rà vòng 1: `labelLayout.ts`, test của nó, `labels.ts`, CSS, e2e, tài liệu. Không có hồi quy: tôi đã chạy lại `npm run typecheck`, 12 unit test và `node --check` cho script, đều sạch.

## Lỗi phải sửa (FAIL khi còn mục này)

Không còn.

## Kiểm lại các góp ý vòng 1

- **Hàm `frames()` thừa:** đã xoá, không còn chỗ nào gọi.
- **Cờ `--only`:** đã kiểm giá trị. Tôi thử ba trường hợp: `--only bogus`, `--only` không có giá trị, và `--only world,`. Cả ba đều báo lỗi rõ và thoát mã 1 trước bước build, không tạo thư mục ảnh.
- **Chú thích `Game.ts`:883:** đã sửa đúng. Giờ ghi rõ đây là luật của server, còn `throwBall` ở client vẫn tính cả thú đang trong bóng. Hành vi không đổi.
- **Chưa làm:** ba góp ý không bắt buộc vẫn còn (mục dưới). Không cái nào chặn commit.

## Góp ý không bắt buộc

- **`scripts/shots.mjs`:114-135:** thân khối `try` chưa được thụt lề thêm một bậc. Các dòng 115-131 đang thẳng hàng với chữ `try {`, khác code xung quanh. Thụt vào 2 dấu cách.
- **`labelLayout.ts`:114:** chú thích "nearly sorted from the previous frame" không đúng. `Labels.update` nạp lại `order` theo thứ tự `Set` mỗi khung. Với 30 nhãn trở xuống thì vẫn rẻ, chỉ cần sửa chú thích.
- **`Game.ts`:907:** `const d` trong khối của trùm che biến `d` ở :892 và tính lại đúng giá trị đó. Dùng lại `d`.

## Việc mới nên đưa vào TASKS.md

- **P2: Đánh dấu thú đang nhắm.** Đề xuất này có sẵn ở cuối PLAN T5.
  - Vấn đề: giữa đám đông, người chơi không biết bóng (phím E hoặc nút Bắt) sẽ bay vào con nào. T5 đã tính sẵn con đó mỗi khung hình trong `Game.frame()`.
  - Việc cần làm:
    - Thêm một dấu nhỏ, ví dụ vòng mảnh dưới chân hoặc viền sáng cho nhãn.
    - Cho `Game.throwBall()` bỏ qua thú đang trong bóng (`inBall`), giống `nearestPal` của server (`GameRoom.ts`:2097) và `handleThrow` (:891). Có vậy dấu nhắm và cú ném mới luôn trùng nhau. Hiện khi con gần nhất đang lắc trong bóng, nhãn ghim đã sang con thứ hai mà phím E vẫn nhắm con trong bóng (server từ chối).
    - Nếu thấy dấu nhảy qua lại giữa hai con cách đều mình, thêm độ trễ cho cả dấu lẫn cú ném. Hiện nay nhãn của hai con đó cũng có thể đổi hiện/ẩn theo từng khung, vì độ trễ 250 ms không áp dụng khi đổi ghim.
- **Ghi chú cho T14 (ảnh và hình ảnh):** đã có trong PLAN T5. `scripts/shots.mjs` giờ có cờ `--only world|labels`, và nhóm `labels` chụp đám đông ở 3 khung hình, kèm số cặp nhãn chồng và `labelMs`. Ảnh mới của T14 nên vào nhóm `world` hoặc một nhóm riêng. Cảnh `alpha` của nhóm `labels` phụ thuộc thời điểm, vì chụp cố định 1,1 giây sau khi dịch chuyển. Nên poll có giới hạn: chờ thú đi theo ở gần và camera đã tới rồi mới chụp.
- **P3: Nhãn tên bị HUD che ở điện thoại ngang.** Ví dụ trong ảnh `labels-landscape-*`: nhãn "Tuấn (mất kết nối)" và nhãn đầu đàn nằm dưới bảng trạng thái. T5 để việc này ngoài phạm vi. Có thể gộp với T6 (bố cục HUD điện thoại): thu gọn bảng trạng thái ở màn ngang, hoặc dời camera để vùng nhân vật không nằm dưới HUD.
- **P3: Thêm test ngẫu nhiên nhiều khung cho `layoutTags`.** Ca 9 hiện chỉ kiểm một khung, mọi nhãn đều `fresh`. Nên thêm vài trăm khung, nhãn di chuyển và đổi con đang nhắm, kiểm ba điều:
  - không chồng trừ khi bị ép;
  - nhãn ghim không ẩn;
  - nhãn hiện lại sau ít nhất `LABEL_REVEAL_MS` kể từ lần bị thu hoặc ẩn gần nhất.

  Lần rà vòng 1, tôi đã chạy một mô phỏng như vậy (200 cảnh × 600 khung) và cả ba điều đều đúng. Làm kèm việc chạm tới `labels.ts` sau này, cùng hai góp ý chú thích ở trên.
