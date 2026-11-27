PASS
# REVIEW: T26 Dọn nhỏ sau T3, vòng 1

## Kết luận
Đủ 7 mục của PLAN.md, đúng thiết kế. Không mở lại đường né của T25/T25b, không đổi giao thức, và không tạo object mới mỗi khung hình. Các test mới không qua suông: E1 hỏng trên HEAD; M7 nay có e2e bắt. Tôi đã chạy lại: typecheck sạch; `connection.test.ts` và `reconnect.test.ts` qua 29/29; S1-S3 qua.

## Lỗi phải sửa
Không có.

## Đã kiểm

### Server
- **`calmPalsTargeting`:**
  - Chỉ gọi `cancelWindup` khi `aggro.windupUntil !== undefined`, tức đang gồng cắn hoặc dậm. Thú đang gồng chiêu không có trường đó trong aggro, nên tư thế `"skill"` và cast giữ nguyên (S1, M2).
  - Xoá mục đang duyệt trong `Map.forEach` là an toàn.
  - Đòn đã bị huỷ ngay từ khi aggro bị xoá (`strike` cần `windupUntil`), nên T26 chỉ làm hình ảnh khớp với điều đó.
  - Không thêm chỗ gọi nào. Các chỗ gọi vẫn là `shelter` (sau 1,5 s), `removePlayer` (`letGo`, `endSession` sau `exposures`, rời chủ động, hết giờ chờ), `faintPlayer`, `faintCompanion`, `despawnCompanion`.
  - S2 chứng minh đòn đang gồng lúc rớt vẫn trúng. Như tester ghi, chỉ S1 quan sát được M1, vì AI tự đặt lại tư thế ở cùng nhịp. Chấp nhận.
- **`onReconnect` gọi `client.leave(CLOSE_REPLACED)`:**
  - Tôi đã đối chiếu `_onJoin`: sau `onReconnect`, Colyseus kiểm `readyState !== OPEN` ngay ở microtask kế tiếp, khi client vẫn đang `RECONNECTING`. Vì vậy `_onLeave` chọn `onLeave`, không chọn `onDrop`: không có hold mới, không vào nhánh mất chỗ.
  - Kể cả nếu đi vào `onDrop`, nó cũng thoát ngay ở `!player`.
  - `liveSessions` đã được dọn trong `removePlayer` trước đó. S3 kiểm client nhận 4201, rồi không còn client, người chơi hay hold nào.

### Client
- **`watchJoined`:**
  - Chỉ có một listener `pagehide` cho mỗi lần vào được phòng. `ConnectionWatch` không tự đăng ký, nên không có hai lần.
  - Thứ tự `beforeLeave` → `watch.leave()` đúng (e2e mới của tester bắt M7).
  - Lần vào hỏng (`failToStart`) để lại một closure nhỏ; `leave()` bỏ qua khi đã `lost`. Vô hại.
  - Với đường `refused` tự tải lại của T24: `pagehide` lúc `location.assign` gặp watch đã `lost`, nên không gửi gì và `SeenNotes` không ghi. Server không nhận tin rời chủ động, đúng như cần.
- **Ticker:**
  - `halting` được đặt trong `onChange` và ở cuối `init` (trường hợp đã `lost` lúc hình còn tải).
  - `ticker.stop()` chạy cuối `frame()`. Render là listener ưu tiên thấp hơn trên cùng ticker, nên vẫn vẽ nốt khung đó.
  - Không chỗ nào khởi động lại ticker; `Game` không có `destroy` (đã biết từ T24). `reconnecting` vẫn vẽ (M9).
- **`setInert`:** chỉ chạy khi đổi trạng thái và một lần ở cuối `init`, không chạy mỗi khung.
  - Mọi bảng đều nằm trong `hud.root` (coder đã kiểm `hudBridge.build`). Màn che là anh em của HUD, nên nút Về sảnh vẫn dùng được (UX ở 390×844 và 1280×720 đã chụp ảnh kiểm).
  - Focus đang ở trong HUD lúc rớt thì rơi về `body`; Tab chỉ còn tới Về sảnh. Trình đọc màn hình không thấy HUD trong lúc đó, đúng ý.
- **`inviteLink`:** chỉ gọi `lobbyUrl(roomId, true)`. Không đổi chỗ gọi nào.
- **Hiệu năng:** `frame()` chỉ thêm một phép kiểm boolean, không tạo object.

### Test
- **S1:** có thú thứ ba nhắm B (M3). S3 có spy `onReconnect`.
- **`inviteLink`:** có 2 test (M12).
- **E1:** không qua suông. Nó chờ observer thấy 3 người trước khi đóng trang, và đã hỏng trên HEAD.
- **E2e mốc "lần cuối thấy":** chờ 2 s sau khi vào, nên mốc ghi lúc vào (cũ hơn 1 s) không làm test qua nhầm. Với M7 thì test hỏng.
- **Phép kiểm thêm trong `reconnect.spec.ts`:**
  - `inert` và Tab (M11).
  - `frames` tăng khi đang thử lại (M9).
  - HUD bấm được khi online lại (M10).
  - `ticker.started === false` và `frames` chênh ≤ 1 (M8).
  - Enter ở Về sảnh đưa về sảnh.
  - Có một `waitForTimeout(1000)` có chú thích, để đo "không còn khung nào"; kế hoạch cho phép.

### Tài liệu và ràng buộc
- **Tài liệu:**
  - `multiplayer.md`: bảng rời phòng, dòng về nút Về sảnh, 6-9 s, 1,5 s tính từ lúc server biết, các mục "Trong 20 giây chờ" và "Quay lại".
  - `hud.md` và `architecture.md` đều đúng với code.
- **Ràng buộc:**
  - Không đổi `packages/shared`, `multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json`.
  - Không đổi schema, message, `Profile` hay chữ người chơi thấy.
  - `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **Trả focus khi online lại:** nếu focus đang ở một nút hay bảng trong HUD lúc rớt, nó rơi về `body` và không quay lại khi online. Có thể nhớ `document.activeElement` (nếu nằm trong HUD) lúc đặt `inert`, rồi `focus()` lại khi gỡ, nếu phần tử đó còn trong DOM và còn hiện.
2. **Phím tắt khi HUD `inert`:** `keyboard.ts` nghe trên `window`. Phím tắt mở bảng (nếu có) vẫn mở bảng phía sau màn che dù không bấm được gì trong đó. Vô hại, nhưng có thể bỏ qua phím tắt UI khi không online.
3. **Trang khôi phục từ bfcache:** `pagehide` cũng chạy khi trang vào bfcache, nên watch rời phòng chủ động. Khi trang được khôi phục (`pageshow` với `persisted`), game ở trạng thái `lost: left` và ticker đã dừng. Có từ trước T26. Có thể tải lại trang khi `pageshow.persisted`.
4. **M1 chỉ unit (S1) quan sát được.** Nếu muốn có bằng chứng tích hợp: trong S2, kiểm ngay sau lúc bảo vệ bật bằng một hẹn giờ `room.clock` chạy cùng nhịp, trước khi AI chạy. Không bắt buộc.
5. **Còn lại từ các review trước** (chưa có trong TASKS):
   - T93 (rời chủ động, tab thứ hai, hồi máu khi vào lại);
   - việc dọn sau T25 (góp ý 2, 4, 5);
   - trong `endSession`, đưa `hold.reject`/`client.leave` vào `finally`;
   - phòng đủ 5 người có thể có 6 nhân vật trong tối đa 1,5 s.
