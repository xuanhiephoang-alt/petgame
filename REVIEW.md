PASS
# REVIEW: T42 Sảnh giữ đến khi thế giới vẽ xong; thẻ "không mở được game"; chỉ mục ảnh chịu lỗi, vòng 1

## Kết luận
Thay đổi làm đủ các bước và tiêu chí của PLAN.md, không làm thừa ngoài phạm vi (không đụng server, schema, message, `Profile`, bộ canh tải T15). Luồng `allSettled` đảm bảo phòng đã vào luôn được dùng hoặc rời; `failToStart` đúng luật địa chỉ T23, rời chủ động đúng một lần, focus đúng nút. Chỗ hỏng chập chờn của test `labels:` không do T42 gây ra (lý do ở dưới), nên ghi thành việc tiếp theo, không phải lỗi phải sửa. Typecheck sạch, 16 unit test mới qua (đã chạy lại để kiểm chứng).

## Lỗi phải sửa
(không có)

## Đã kiểm
- **Luồng `allSettled` (main.ts:131-149):** `connect` hỏng thì không có phòng nào để rời, giữ nguyên bốn thẻ T23. `connect` được mà `assets` hỏng thì `throw art.reason` rơi vào cùng `catch` với `startGame`, nên `failToStart` luôn chạy khi đã vào phòng. Không có `await` nào giữa `Game.create` ném lỗi và `watch.leave()` (chỉ có microtask), nên không có patch nào của server chen vào lúc stage đã huỷ. Không rời hai lần: `ConnectionWatch.leave()` thoát sớm khi đã `lost`, nên `pagehide` (đã gắn trong `startGame`) gọi lại cũng không sao; đang `reconnecting` thì chỉ tắt nối lại, không gửi tin (Rủi ro 5 của plan, chấp nhận được).
- **`failToStart`:** `broken` chặn mọi đường vào lại; `#game` được dọn trước; địa chỉ theo luật T23 (0 giữ nguyên, 1 bỏ `room`, >1 có `room`); `watch.leave()` chạy trước `showJoinCard`, nên focus của `ConnectionOverlay.show(lost)` (trên phần tử đã gỡ) không cướp focus của `#join-reload-btn`. `#look` ẩn không bị `dollArt` bật lại, vì `allSettled` đã chờ `assets` (gồm `dollArt`).
- **Phím Space:** `Keyboard` chặn mặc định của Space trên `<button>` ở cả `keydown` lẫn `keyup` (chặn `click`), nhưng không `stopPropagation`, nên handler `keydown` riêng của nút vẫn chạy. Đúng như `ConnectionOverlay`.
- **`Game.abandon`:** bọc `try`, không che lỗi gốc; huỷ ticker và canvas. Listener `window` của `Keyboard`/`Sound`/`visibilitychange` còn lại, đã ghi ở Rủi ro 7 của plan; mọi tin gửi đi đều qua `send`, mà `send` bỏ qua khi `watch` đã `lost`.
- **`fetchIndex`:** toàn bộ thân trong `try`, loại `null`/mảng/số; cả ba hàm tải ảnh dùng nó, đã bỏ `try`/`res.json()` trùng lặp. `BODY` chỉ nhận số.
- **Lớp z-index:** mọi lớp của game nằm trong `#game` có z-index tối đa 6 (`.net-overlay`); `.labels` (1) và `.hud` (2) tự tạo stacking context nên `.float` (20) và nhãn (3..10) bị nhốt bên trong. Không có phần tử nào của game gắn thẳng vào `body`. `#lobby` z-index 10 che được hết.
- **Chữ tiếng Việt:** khớp bảng Thiết kế 3 và `docs/design/multiplayer.md`; chú thích code tiếng Anh.
- **Test:** unit test kiểm đúng hành vi (chữ của từng trình duyệt, các dạng `err` lạ, mọi dạng JSON hỏng). E2E A chống test rỗng bằng `blocked > 0`, chứng minh rời chủ động bằng việc host thấy số người về 1 trong 5 s (người chơi không rời thì ping giữ socket mãi, nên không thể qua nhờ may). Tester đã xác nhận E2E B hỏng trên code cũ.

## Test chập chờn `labels: in a crowd on a phone...` (multiplayer.spec.ts:971, hỏng ở dòng 1002)
**Không do T42.** Dòng 1002 là lần kiểm thứ hai ("Stable, not just one lucky moment"), chạy sau khi `expect.poll` ở dòng 1000 đã thấy `[]`. Đến đó sảnh đã bị gỡ từ lâu (gỡ đồng bộ ngay sau `Game.create`, trước khung hình đầu tiên), và đã có hàng chục tin `debug:*` cùng ít nhất 5 bạn đồng hành được chờ xong. `waitForWorld` mới chỉ làm test bắt đầu muộn hơn một chút, không đổi trạng thái thế giới hay DOM lúc đo; `#lobby` không còn trong DOM nên không ảnh hưởng `getBoundingClientRect` của nhãn.

**Nguyên nhân có lẽ là:** `"Lv 6 Leafkit"` là một trong hai thú hoang test tự sinh (bị thương nên nhãn hiện), và thú hoang vẫn đi lại theo AI. Khi nó đi sát nhãn của "Tuấn", `layoutTags` đổi dạng nhãn (nâng lên, thu gọn hoặc ẩn), nhưng phần vẽ đi trễ hơn quyết định đó: `drawnRise` trôi dần theo `LABEL_EASE_MS` (60 ms), còn độ mờ đổi qua CSS `.label { transition: opacity 0.15s }` / `.label.pal span { transition: opacity 0.2s }`. `labelOverlaps` đọc `getComputedStyle(...).opacity` và hộp đang vẽ, nên nếu đo đúng lúc đang chuyển thì vẫn thấy hai nhãn chồng nhau (độ mờ còn > 0.5, hoặc hộp chưa tới chỗ mới). Một lần đo đơn lẻ sau 30 khung hình rơi vào khoảng 60–200 ms đó là đủ để test hỏng.

## Góp ý không bắt buộc
- main.ts:198-212 và 105-116: khi `Game.create` hỏng, `watch.leave()` cũng gọi `react` của `startGame`, nên `overlay.show` chạy trên phần tử đã gỡ và `setAddress` được gọi lần hai. Với `size > 0` thì kết quả giống `failToStart`; với `size === 0` (state chưa về) thì `react` bỏ `room` khỏi địa chỉ, trái với dòng "0 giữ nguyên" của plan. Gần như không xảy ra, vì `stage.init` phải chờ một lượt mạng nên state đã về trước. Muốn chặt chẽ thì để `startGame` trả về hàm gỡ `react`, hoặc cho `react` bỏ qua khi `broken`.
- E2E A phần 2: câu kiểm "địa chỉ không có `room`" yếu, vì người chơi một mình mở `/?quality=low` nên địa chỉ chưa bao giờ có `room`. Nhánh "đúng 1 người thì bỏ `room`" của `failToStart` chưa có test thật sự kiểm.
- Space trên `#join-reload-btn` chưa có e2e (tester đã ghi).
- `doll.ts:59-63`: chỉ mục có đúng dạng ngoài cùng nhưng một mục bên trong hỏng (ví dụ `heads: { a: null }`) vẫn ném lỗi ngoài `try` ở `entry.file`, nên game hỏng với thẻ "Không mở được game" (nay ít ra có thẻ và người chơi đã rời phòng). Plan chỉ yêu cầu kiểm dạng ngoài cùng nên không tính là lỗi.
- `pictures.ts:30`: chú thích "No atlases: everything is drawn." nay đứng trên một dòng gán, nên đọc như mô tả của dòng đó; có thể viết lại thành "Without an index (or a broken one) every object is drawn from code."

## Việc tiếp theo đề xuất cho TASKS.md
1. **(trung bình) Làm vững test `labels: in a crowd on a phone...`** (multiplayer.spec.ts:971, chập chờn ở dòng 1002). Có hai hướng, chọn một hoặc cả hai: (a) cho thú hoang trong test đứng yên (ví dụ thêm tuỳ chọn cho `debug:spawnPal`), hoặc chỉ coi là chồng nhau khi cặp đó còn chồng sau quá `LABEL_REVEAL_MS` + thời gian chuyển CSS (đo hai lần cách nhau ~300 ms, báo cặp có ở cả hai lần); (b) kiểm xem `layoutTags` có tính đến vị trí đang trôi (`drawnRise`) và nhãn đang mờ dần hay không. Nếu chồng nhau thật quá 200 ms thì đó là lỗi bố cục nhãn, không phải lỗi test.
2. **(thấp, từ PLAN.md)** Lỗi khi game đã chạy (ngoại lệ trong `frame()`, `webglcontextlost`): hiện màn che "Game gặp lỗi" kèm Tải lại.
3. **(thấp, từ PLAN.md)** Bắt `vite:preloadError` ở bản build để tự tải lại một lần khi tab cũ gặp file băm đã bị xoá.
4. **(thấp)** Kiểm dạng từng mục trong chỉ mục ảnh (`doll.ts` `heads`/`bodies`/sheet, `pictures.ts`), để một mục hỏng chỉ làm mục đó vẽ bằng code thay vì làm hỏng cả game.
