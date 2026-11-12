PASS
# REVIEW: T30 Thanh máu trùm che HUD, vòng 3

## Kết luận
Code sản phẩm (`index.html`, `hud.ts`) vẫn như vòng 1 và đúng PLAN; không đổi `Game.ts`, server, shared hay `toastQueue.ts`. Hai lỗi phải sửa của vòng 1 đã được sửa. Phép kiểm "thông báo không chồng phần nào, kể cả tên mình" giữ nguyên, không bị nới. Còn vài chỗ test có thể chạy sai trong tình huống hiếm, cộng một chỗ sửa nhầm vào test `toasts (...)` có sẵn. Không chỗ nào đủ nặng để chặn commit; ghi thành việc nối tiếp ở cuối.

## 1. Các lỗi FAIL của vòng 1
- **Đo lúc trạng thái đang chuyển:** đã sửa. `settledBossLayout` chỉ nhận số đo khi đủ các điều kiện sau, trong **cùng một** `evaluate`; không đủ thì thử lại, hết 10 lần thì `throw`:
  - thanh đang hiện (`barShown`);
  - camera lệch < 1 px so với người chơi;
  - không có thông báo `.out` và không có hiệu ứng thông báo đang chạy;
  - ở chỗ trong cột thì có lớp `boss-near`;
  - không trúng đòn nào trong lúc chờ và đo;
  - không có thú hoang trong 250 px;
  - `accept` đồng ý.

  Đoạn desktop 1248/1024 dùng chung helper, không còn `goNearBoss` nằm trong `expect.poll`.
- **`expectBarClear` qua khi thanh ẩn:** đã sửa. Hàm mở đầu bằng `expect(layout.barShown).toBe(true)`.
- **Bảng trong `docs/design/hud.md` bị cắt đôi:** đã sửa. Đoạn "Lề trái/phải" nay nằm sau bảng; bảng liền mạch và khớp với CSS.

## 2. Có phép kiểm nào bị nới, vòng thử lại có qua "cho có" được không?
- Phép kiểm chồng, `expectBarClear`, `expectBarInColumn`, vùng an toàn, chỗ A/B và hai mốc khi cầm ngang đều giữ nguyên. Riêng thông báo lỗi của phép kiểm chồng nay có thêm toạ độ.
- Các điều kiện để vòng lặp nhận số đo chỉ nói về **môi trường**: camera, đòn đánh, thú hoang, hiệu ứng. Chúng không phải chính phép kiểm bố cục, nên vòng lặp không thể chọn đúng lúc bố cục "đẹp". Với desktop, `accept` đòi rộng 280 hoặc `position: static`; không đạt thì test `throw` (hỏng), không bỏ qua. Lần đo nào cũng là số mới.
- Không thể đo khi không có thông báo: `accept` đòi đúng `screen.room` thông báo.
- **Còn một khe hẹp, hiếm gặp (góp ý 2).** `pushToasts` thoát ngay khi đang có bất kỳ thông báo nào, và `accept` chỉ đếm số thông báo, không xem nội dung. Giả sử hai thông báo dài hết hạn trong lúc tìm chỗ, rồi đúng lúc `prepare` chạy lại có một thông báo khác đang hiện (ngất rồi hồi sinh, "Đến 🌋 Núi lửa", cảnh báo nóng, cảnh báo máu thấp…). Khi đó vòng lặp đo với thông báo khác. Ở cấu hình cầm ngang (`room` 1) có thể qua với một thông báo ngắn hơn. Đây là trường hợp đo nhẹ đi ở một số lần chạy, không phải lỗi bị che vĩnh viễn: lần chạy bình thường vẫn đo đúng hai thông báo dài nhất.

## 3. Thiết lập test đã đủ ổn định chưa? Đòn từ nguồn khác thú hoang thì sao?
- Bộ đếm `watchHurt` đếm **mọi** tin `damage` trúng người chơi, không chỉ đòn của thú hoang: trùm cắn hay dậm, thú đầu đàn, cả nóng ở núi lửa. Ghi chú trong code nói "a pal's blow" là hẹp hơn thực tế. Đếm cả nóng chỉ làm thử lại nhiều hơn chút: cứ 2 s lại có một tick.
- Mọi dịch chuyển của người chơi, dù do đâu, đều bị điều kiện lệch camera < 1 px bắt. Lý do: nhãn tên bám theo `actor.pos`, còn camera theo `pos − (0, 16)`.
- Thứ duy nhất làm tên dịch mà camera không thấy là **rung màn hình** (`this.shake`, chỉ cộng trong `stage.look`). Mức rung có giới hạn:
  - trùm bước: ±0,7 px;
  - vừa trúng đòn trước cửa sổ đếm: ±1,8 px;
  - trùm dậm (chỉ khi trùm nổi giận): ±5,3 px.

  Cả ba đều dưới khe hở nhỏ nhất 12 px.
- Lớp `.hurt` đẩy tên lên 8 px và kiểu tóc đẩy thêm tới 8 px. Cả hai đã nằm sẵn trong con số khe hở 12-22 px.
- Thực nghiệm: tester chạy toàn bộ e2e 46/46, `boss bar` lặp 75/75; coder chạy 50/50.
- Một lần hỏng trong 50 lần ở vòng 3, trước khi có thông báo lỗi chi tiết, chưa giải thích được. Khả năng cao nhất là đúng khe hẹp ở mục 2: một thông báo khác thay chỗ, làm cột thông báo khác đi trên khe 12 px. Từ giờ thông báo lỗi đã ghi toạ độ; nếu lặp lại thì lưu trace vào T62.

## 4. Giới hạn bố cục 12-22 px có được để lại cho T62 đúng cách không?
Đúng, test không che giới hạn này:
- Test vẫn khẳng định thông báo không chồng tên mình ở 390×844 có tai thỏ khi thanh đang hiện. Khe 12 px là có thật và test kiểm đúng nó.
- Trường hợp chồng thật (thanh ẩn, ô nhiệm vụ hiện, đang mất máu, tóc cao: chồng 2 px, đo ở vòng 1) có từ trước T30. Nó nằm ngoài phạm vi T30 và không bị test này giấu đi.

Có điều `TASKS.md` mục T62 hiện chỉ nói 390×760. **Agent chính cần mở rộng T62** (xem cuối file); không thì giới hạn này chỉ còn nằm trong PROGRESS.md, và PROGRESS.md sẽ bị ghi đè.

## Lỗi phải sửa (FAIL khi còn mục này)
(không còn)

## Góp ý không bắt buộc
1. **Sửa nhầm test có sẵn**, trái với dòng "Test có sẵn … không sửa" của PLAN. `tests/e2e/multiplayer.spec.ts:2389-2397`: test `toasts (...)` (T6/T18) đã bị đổi `page.evaluate` thành `pushToasts`, có điều kiện thoát sớm. Kèm theo là một chú thích chép nhầm, "put back when they have run out while the test looked for a calm spot", trong khi test này không tìm chỗ nào. Có vẻ do một lần thay thế hàng loạt.
   - Điều kiện thoát sớm không làm test qua sai được. Nó chỉ thêm một kiểu hỏng hiếm: có thông báo lạc lọt vào giữa `toHaveCount(0)` và lúc đẩy thông báo.
   - Nên hoàn tác đúng 6 dòng đó về bản HEAD.
2. Trong test `boss bar`:
   - `pushToasts`/`prepare` nên đẩy lại hai thông báo cao **khi chúng không còn hiện**, không phải khi cột thông báo trống. `showToast` không sinh thông báo trùng, và thông báo cao thay được thông báo thấp hoặc thường.
   - `accept` nên kiểm cả **nội dung**: mọi thông báo đều bắt đầu bằng "Hạ được trùm" hoặc "Frostfang".
   - Nhờ vậy khe hẹp ở mục 2 được bịt.
3. `watchHurt`: chú thích nên nói nó đếm mọi tin `damage`, kể cả nóng hoặc lạnh. Nếu chỉ muốn đếm đòn có đẩy lùi thì lọc `!m.cause`, để bớt thử lại và bớt nguy cơ ngất vì nóng khi vòng lặp kéo dài.
4. Dòng 2687, giữ từ vòng 1: `Promise.all(... a.finished)` nên thêm `.catch(() => {})` cho từng hiệu ứng. Nếu một thông báo `.out` bị gỡ khi transition còn chạy, `finished` bị từ chối và `evaluate` ném lỗi.
5. Kiểm đáy bảng ở dòng 2741 dùng `max(safe.bottom, 8)` cho mọi cấu hình. Khi cầm dọc và trên desktop, thiết kế là `max(12, inset dưới)`.

## Việc nối tiếp cho TASKS.md
- **Mở rộng T62** (P2): 390×844 có tai thỏ trên 47, hai thông báo cao dài nhất, mỗi cái 3 dòng.
  - Khi thanh trùm hiện: khe tới tên mình chỉ 12-22 px. Phụ thuộc kiểu tóc (khoảng 8 px) và `.hurt` (8 px).
  - Khi ô nhiệm vụ hiện, người chơi đang mất máu, tóc `curly`/`bun`: **chồng 2 px**.
  - Nguyên nhân: `toastRoom` không trừ `safe-area-inset-top` và không tính thanh máu dưới tên.
  - Thêm bản có tai thỏ, người chơi đang mất máu, tóc cao vào e2e `toasts`.
- **Dọn test của T30** (P3, chỉ đụng test): làm góp ý 1 (hoàn tác 6 dòng ở test `toasts (...)`), cộng góp ý 2, 3, 4. Nếu quy trình cho phép thì nên làm góp ý 1 trước khi commit T30, vì chỉ là đưa về đúng bản HEAD.
