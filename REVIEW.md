PASS
# REVIEW: T23 Vào lại đúng thế giới sau khi tải lại trang; thẻ lỗi khi vào, vòng 1

## Kết luận
Thay đổi làm đủ các bước 1-7 và mọi tiêu chí hoàn thành trong PLAN.md, không đụng server, shared hay script canh tải. Phần phân loại lỗi khớp đúng cách SDK 0.18.5 ném lỗi (đã đọc `HTTP.ts`, `Client.createMatchMakeRequest`, `core/Room._onLeave`). Đồng bộ địa chỉ, cờ `joining`, thứ tự `lobby-ready` và test đều đúng. Không còn lỗi phải sửa.

Đã kiểm lại: `npx vitest run` hai file test mới (13/13 qua), `npm run typecheck` sạch. Tester đã chạy cả bộ e2e (38/38) và lặp 15/15.

## Lỗi phải sửa (FAIL khi còn mục này)
(không có)

## Đã rà soát, đạt
- **`joinFailure`** (`packages/client/src/net/connection.ts:37`): lỗi `fetch` được SDK gói thành `ServerError(err.cause?.code || err.code, …)`. Trên trình duyệt `code` là `undefined`, trên Node là `"ECONNREFUSED"`; cả hai thành `unreachable` (e2e `route.abort()` xác nhận trên Chromium). Trả HTTP không ok thì ra `ServerError(raw.status, …)`, kể cả khi thân trả về không phải JSON, nên không crash. Nhận diện theo cấu trúc, không dùng `instanceof`. Giá trị ném không phải object thì thành `failed`. Các bộ nạp `assets` tự bắt lỗi nên không ném `Error` không có `code` vào nhánh này.
- **Đầy hay đóng:** Colyseus mở khoá phòng (`#_decrementClientCount`) trước khi đóng socket của người rời (`_onLeave(...).then(leave)`). Vì vậy `await guests[0].leave()` rồi Thử lại trong test "6th" không đua.
- **Địa chỉ:**
  - `setAddress` chỉ gọi `replaceState` khi URL đổi, có bọc `safeStorage`.
  - `syncAddress` không tạo object mỗi tick, chỉ gọi `lobbyUrl` khi `shared` đổi.
  - Lúc `lost`, địa chỉ bằng đúng URL của nút Về sảnh. SDK kết nối lại trên cùng `Room`, nên `onStateChange` vẫn sống sau khi kết nối lại.
  - Gặp `closed` thì bỏ `room` trước khi hiện thẻ.
  - `?room=` rỗng nhất quán với `connect` (tạo thế giới mới, không có gợi ý).
  - `#fragment` được giữ (có unit test mới).
- **Gợi ý quay lại hay được mời:** đọc `sessionStorage` một lần, đồng bộ, bọc `safeStorage`. Khoá chỉ dùng để chọn chữ.
- **`lobby-ready`:** vẫn bắn đồng bộ ngay sau ba dòng mở khoá, sau `joinBtn.focus`. Không có `await` hay yêu cầu server nào trước nó.
- **Chống gọi chồng:** cờ `joining` đặt đồng bộ. Trong lúc vào, `#join-btn` bị khoá (nên Enter trong ô tên không gửi được form) và thẻ bị ẩn (nên không bấm được Thử lại hay Tạo thế giới mới).
- **Thẻ lỗi:**
  - `role="alert"`, nút `type="button"`.
  - Focus vào nút chính (`preventScroll`) sau khi `scrollIntoView`; nút phụ có class `quiet`.
  - `.lobby-alert[hidden]` có sẵn; `.lobby-action` và `#join-btn` không đặt `display`, nên `hidden` có tác dụng.
  - e2e đo nút ≥ 44×44 ở 3 cỡ màn hình.
- **Đổi bộ đếm `framenavigated` sang `load`:** hợp lý, vì `replaceState` cũng làm `framenavigated` bắn. Tester đã chứng minh `load` vẫn đếm được `reload` và `location.assign`. Test "let the player go" chờ `load` thay cho `waitForURL`, đúng.
- **Tài liệu:** `docs/architecture.md` (2 chỗ) và `docs/design/multiplayer.md` khớp hành vi.

## Góp ý không bắt buộc
- **`packages/client/src/main.ts:170` (Về sảnh khi địa chỉ có `#…`):** từ T23, địa chỉ lúc `lost` đã bằng đúng `lobbyUrl(...)`, nên `location.assign` sang cùng URL đó. URL không có `#` thì trình duyệt tải lại (e2e chứng minh). URL có `#frag` thì theo chuẩn HTML đó chỉ là điều hướng tới fragment, trang không tải lại, nên nút Về sảnh không làm gì. Trước T23 lỗi này đã có khi chơi một mình; giờ thêm cả trường hợp có bạn bè. Game hiện không tạo `#` nào, nên chưa ai gặp. Cách sửa: trong callback của overlay, nếu `url === location.href` thì `location.reload()`, không thì `location.assign(url)`.
- **`joinFailure`:** proxy của Render/Fly trả 502/504 khi server đang deploy. Hiện các mã này rơi vào `failed` ("Có lỗi khi vào…"). Có thể xếp 502/504 vào `unreachable` cho đúng nghĩa hơn; hai thẻ đều có nút Thử lại nên không gấp.
- **`main.ts:150`:** `size > 1 === shared` đúng nhờ thứ tự ưu tiên toán tử, nhưng thêm ngoặc `(size > 1) === shared` (như PLAN viết) sẽ dễ đọc hơn.
- **`showJoinCard`, `enter`, `joining`:** thiếu JSDoc ngắn. Theo quy ước, nên có ít nhất `enter()` (dùng chung cho submit, Thử lại, Tạo thế giới mới) và `joining` (chống gọi chồng).
- **Điện thoại ngang (form dạng lưới):** khi thẻ lỗi hiện, `#join-btn` bị ẩn nên cột 2 cạnh `#name` để trống. Chỉ là thẩm mỹ: có thể cho `#name` trải hai cột khi nút ẩn.
- **Test mới, Phần 1:** bước "một mình thì địa chỉ không có `room`" luôn đúng ngay từ đầu, vì trang mở ở `/`. Bước có giá trị thật là khi bạn rời thì `room` bị bỏ, và bước đó đã có.

## Việc tiếp theo đề xuất cho `TASKS.md`
- P2: giữ thế giới trống thêm 30-60 giây (theo PLAN.md, Rủi ro 2).
- P2: app ở Màn hình chính quay lại thế giới vừa chơi, gắn với T13 (theo PLAN.md, Rủi ro 4).
- P3: nút Về sảnh tải lại trang khi URL đích trùng địa chỉ hiện tại có `#…` (góp ý thứ nhất ở trên).
- P3: xếp HTTP 502/504 vào `unreachable` trong `joinFailure`.
