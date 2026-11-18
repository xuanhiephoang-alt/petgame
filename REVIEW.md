PASS
# REVIEW: T83 Test đường ghi giờ và dọn nút phụ sau T79, vòng 1

## Kết luận
Coder làm đủ 7 bước và mọi tiêu chí của PLAN.md T83, phủ cả 4 góp ý trong REVIEW T79. Đường ghi giờ chính cho iPhone (trang ẩn lúc còn kết nối) và nhịp 60 s giờ đã có test. Nút phụ ở yên khi đang vào; ở màn ngang nút nằm cùng hàng với "Vào chơi". Không có lỗi phải sửa.

## Đã kiểm
- **`SeenNotes`** (`packages/client/src/net/seen.ts`):
  - **Vòng đời:**
    - Tạo một lần trong `startGame` (mỗi trang chạy một lần), không có timer đôi.
    - `stop()` chạy ở mọi trạng thái `lost`: `react` đăng ký qua `watch.onChange` ngay sau đó (chỉ có hàm khởi tạo đồng bộ của `ConnectionOverlay` ở giữa). Nếu đã mất kết nối từ trước thì có `if (!watch.online) react(watch.status)`.
    - `failToStart` gọi `watch.leave()`, nên `react` chạy và `stop()` được gọi.
    - `stop()` gọi nhiều lần vẫn an toàn.
    - `note()` sau `stop()` vẫn bị chặn bởi `online()`; có ca test riêng nói rõ điều này.
  - `main.ts` không còn `setInterval`, `clearInterval` hay `SEEN_EVERY_MS`. `pagehide` vẫn ghi trước `watch.leave()`.
  - Unit test dùng fake timer, 5 ca đúng PLAN. Bắt được đột biến "đổi nhịp thành 120 s" vì kiểm biên `SEEN_EVERY_MS - 1` và `+1`.
- **Test 4 nửa online:**
  - Một `page.evaluate` đồng bộ: đặt giờ cũ, giả `visibilityState = "hidden"`, bắn sự kiện, rồi đọc. Không timer hay `syncAddress` nào chen vào giữa được, nên chỉ listener `visibilitychange` làm `seen` mới.
  - Đối chứng: `delete` thuộc tính giả, trả về getter gốc ("visible"). Bắn sự kiện lần nữa thì `seen` giữ nguyên, nên bắt được đột biến bỏ `=== "hidden"`.
  - `Game.ts:250` đọc `document.hidden`, không đọc `visibilityState`, nên game không bị ảnh hưởng.
- **`aria-disabled`:**
  - `disabled` sẽ làm nút mất focus, nên dùng `aria-disabled` là đúng. Trình đọc màn hình đọc nút "không dùng được", Tab vẫn tới.
  - Chặn bấm bằng `joining` trong handler `click`. Chạm, Enter, Space và `dispatchEvent` đều đi qua `click`, nên đều bị chặn; tester đếm được đúng 1 request matchmake.
  - Không có đường nào để nút còn hiện và mờ sau khi `joining` hết:
    - vào được thì `lobby.remove()`;
    - mọi đường hỏng (thẻ vào hỏng, `failToStart`) đều qua `showJoinCard`, và hàm này ẩn nút;
    - `quietRetry` không bao giờ gặp nút (`offered` là `null` khi có `?room=`).
- **Lưới ngang** (`index.html`):
  - Hai quy tắc chỉ bật khi `#rejoin-btn:not([hidden])`. Bộ chọn trong `:has()` mang id nên thắng `#lobby form > * { grid-column: 1 / -1 }`.
  - Media query ngang đứng sau `@media (min-width: 601px)` nên `width: min(680px, 94vw)` thắng.
  - Từ 560 đến 900 px rộng (cao ≤ 560): form rộng 526-680 px, ô tên còn khoảng 98-252 px. Cột `minmax(0, 1fr)` giữ ô tên không tràn.
  - Desktop thấp (ví dụ 1280×500) cũng rơi vào quy tắc này, và vẫn vừa.
  - Quy tắc gap của T79 đã xoá. Tester đo: lúc nút ẩn, hộp sảnh khớp `83497b0` ở 3 cỡ màn.
- **Test 5:**
  - `page.route(/:2567\/matchmake\//)` giữ request `joinById` của SDK (fetch HTTP tới server 2567) bằng một lời hứa chưa giải. Route được gắn trước khi bấm và chỉ giữ, không chặn. Thời gian giữ chỉ bằng vài lệnh kiểm tra, ngắn hơn nhiều so với bất kỳ hạn nào.
  - Thế giới `r1` không tồn tại nên luôn ra thẻ "đã đóng". `addInitScript` ghi lại danh sách ở mỗi trang mới, nên không phụ thuộc lần trước đã "quên" `r1`.
  - Kiểm hộp trước, trong và sau lần bấm thứ hai, ở 3 cỡ màn; có cả đường phím Tab + Enter.
  - Tester chạy 25/25 qua.
- **Tài liệu:**
  - `docs/architecture.md`: câu `arrival(...)` nối liền sau T65. Khối **Quay lại từ `/` (T79, T83):** đứng riêng trước T42, nhắc `SeenNotes`, `aria-disabled`, `showJoinCard`, quy tắc ngang.
  - `docs/design/multiplayer.md` dòng 131, 141, 142 khớp code.
- **Lệnh và phạm vi:** tôi chạy lại `seen.test.ts` và `joinStatus.test.ts` (45 ca qua); `npm run typecheck` sạch. `multiplayer.spec.ts` không đổi; `git stash list` vẫn 2 mục.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc
- **Hướng phụ thuộc:** `net/seen.ts` import `SEEN_EVERY_MS` từ `ui/joinStatus.ts`, tức thư mục `net/` phụ thuộc `ui/`. Đúng như PLAN, nhưng ngược hướng các file `net/` khác. Có thể chuyển `SEEN_EVERY_MS` sang `seen.ts` (`joinStatus.test.ts` import lại từ đó), hoặc để cạnh `RETURN_OFFER_MS` mà không import chéo.
- **Chữ dài hơn ở màn ngang hẹp:** cột nút phụ là `auto` + `nowrap`. Nếu chữ `LOBBY_TEXT.rejoinFriends` dài thêm (đổi chữ, dịch) thì ở khoảng 560-600 px rộng, ô tên co về 0 rồi form tràn ngang.
  - Có thể thêm `max-width` cho cột 3 (ví dụ `minmax(0, 260px)`) kèm `text-overflow: ellipsis`.
  - Hoặc ghi chú cạnh `rejoinFriends` trong `strings.ts` rằng chữ phải vừa một dòng khoảng 230 px.
- **Thông báo cho trình đọc màn hình:** focus ở lại nút phụ (đọc "không dùng được"), nhưng chữ "Đang vào..." trên `#join-btn` không được đọc. Một vùng `aria-live="polite"`, hoặc `aria-busy` trên form, giúp người dùng biết đang vào. Chuyện này có từ trước T83 cho "Vào chơi".
- `seen.test.ts`: `write` là `vi.fn()` dùng chung ở mức `describe`, xoá bằng `mockClear()` trong `beforeEach`. Ổn. Nếu thêm ca đặt `mockImplementation` thì phải đổi sang `mockReset()`.
