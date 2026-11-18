PASS
# REVIEW: T79 Nút "Quay lại thế giới cùng bạn bè" ở sảnh `/`, vòng 1

## Kết luận
Coder làm đủ các bước và tiêu chí của PLAN.md. Code khớp `docs/design/multiplayer.md` mục "Mở lại ở `/` ngay sau khi chơi cùng bạn bè (T79)". Có hai chỗ lệch đã ghi trong PROGRESS và có lý do (CSS ngang dùng `:has()` thay `zoom`; trường `ago` trong e2e). Không có lỗi phải sửa.

## Đã kiểm
- **Ghi giờ `seen`** (`packages/client/src/main.ts`, `startGame`):
  - **Timer:** `setInterval(noteSeen, SEEN_EVERY_MS)` chỉ tạo một lần mỗi trang (`startGame` chỉ chạy một lần). Mọi trạng thái `lost` đều `clearInterval`:
    - `left` khi `pagehide` hoặc `failToStart` (`watch.leave()` gọi `react` qua `onChange`, đăng ký trước `Game.create`);
    - `replaced`, `failed`, `shutdown`.
    - `reconnecting` thì timer vẫn chạy nhưng `noteSeen` không ghi (`watch.online` là false), nối lại được thì ghi tiếp. Không rò.
  - **Sau khi rời:** `pagehide` gọi `noteSeen()` **trước** `watch.leave()`, lúc còn online. Sau `leave()` trạng thái là `lost`, nên mọi `visibilitychange` sau đó, hay trang được khôi phục từ bfcache, đều không ghi. Màn `shutdown` gọi `forgetWorldTime` và không có lần ghi nào đè lại sau đó.
  - **Không ghi mỗi khung hình:** chỉ ghi từ timer 60 s, từ 2 sự kiện trang, và từ `syncAddress`. `syncAddress` chạy mỗi patch nhưng thoát sớm khi cờ bạn bè không đổi, như trước.
  - **Hai tab:**
    - Mỗi lần ghi đều đọc lại danh sách rồi mới ghi. Hai tab ở hai thế giới thì thế giới ghi sau cùng thắng, đúng nghĩa "ở trong gần nhất".
    - Tab mới ở `/` thấy nút trong lúc tab cũ còn chơi; bấm thì tab cũ thành `replaced`, tức thôi ghi.
    - Ghi chồng giữa hai tab có thể mất một lần ghi, lần sau (≤ 60 s) sửa lại.
    - Tài liệu thiết kế đã chấp nhận cả ba điều trên.
  - Mở ở `?room=X` (T65) giữ `seen` cũ của X. Mở bằng link mời mà chưa vào thì không ghi gì.
- **Quyết định `returnOffer`** (`ui/joinStatus.ts`):
  - Chọn mục có `seen` lớn nhất, không lấy `recent[0]` (T65 đưa dấu trang lên đầu dù chưa vào).
  - Bỏ `seen` ≤ 0 và `seen` ở tương lai quá `RETURN_OFFER_MS`, nên một giá trị hỏng không che các mục khác.
  - Rồi đòi có bạn bè và `|now - seen| ≤ RETURN_OFFER_MS`.
  - Lệch đồng hồ:
    - chỉnh lùi ít hơn 10 phút thì vẫn mời;
    - chỉnh lùi nhiều hơn thì bỏ qua mục đó;
    - chỉnh tiến thì mục trông cũ, nên không mời.
    - Cả ba đều hỏng theo hướng an toàn.
  - `?room=` rỗng coi như không có, khớp `arrival`. Unit test phủ biên dưới (có/không), bằng nhau, tương lai nhỏ/lớn, thứ tự trong danh sách.
- **Đóng và quên:**
  - `worldClosed()` lấy `room` từ địa chỉ, nên đúng cả nhánh `quietRetry` lẫn đường bấm nút phụ (địa chỉ đã có `?room=offered`).
  - "Tạo thế giới mới" vẫn chỉ gọi `dropWorldFromAddress()` (thế giới đầy không phải đã đóng).
- **Sảnh:**
  - `#rejoin-btn` dùng `.lobby-action` (có `:focus-visible`, `min-height: 44px`), ẩn sẵn trong HTML.
  - Chữ lấy từ `LOBBY_TEXT.rejoinFriends`: `viStrings --list` không thấy chữ mới nào trong `main.ts` hay `index.html`.
  - Nút hiện trước `petgame:lobby-ready`, không tự lấy focus. Thứ tự Tab: ô tên, rồi "Vào chơi", rồi nút phụ (e2e 2 kiểm).
  - Bấm nút thì bỏ qua khi `joining || broken`, rồi đặt `?room=` (giữ `quality`), `returning = true`, rồi `enter()`.
  - `enter()` ẩn nút ngay đầu hàm.
- **`:has()`:** có từ Safari 15.4, Chrome 105, Firefox 121. Sảnh đã dùng `100dvh`, mà `dvh` cũng chỉ có từ Safari 15.4, nên mốc trình duyệt không đổi.
  - Trình duyệt cũ hơn bỏ cả quy tắc (bộ chọn không hợp lệ). Khi đó khoảng cách giữ 8 px, form cao hơn khoảng 16 px; `#lobby` có `overflow-y: auto`, nên sảnh cuộn được và nút vẫn tới được.
  - Quy tắc chỉ bật khi nút đang hiện. Tester đo: lúc nút ẩn, hộp sảnh giống HEAD ở 3 cỡ màn.
- **Lưu dữ liệu:**
  - Cùng key `petgame:worlds`.
  - Mục T65 không có `seen`, hay `seen` hỏng (`"5"`, `NaN`, `Infinity`, âm, `null`), được giữ với `seen: 0`, nên T65 vẫn nhận dấu trang. Có test.
  - Bản cũ đọc danh sách mới thì bỏ qua trường thừa. Tab bản cũ ghi lại thì mất giờ, chỉ mất nút (đã ghi trong tài liệu).
  - Không đổi server, schema, message, `Profile`.
- **Test:**
  - Unit: 40 ca của `joinStatus.test.ts` qua (tôi chạy lại); `npm run typecheck` sạch.
  - E2E: 4 test có ý nghĩa.
    - Test 3 có ca đối chứng (cách dựng danh sách có tác dụng) và ca storage ném lỗi.
    - Test 4 của tester giữ trang ở trạng thái `reconnecting` qua sự kiện `offline` thật (`reconnect.ts:171`), rồi giả trang ẩn. Test bắt đúng đột biến "ghi khi mất kết nối".
    - Ca unit "picks the world seen last ... wherever it is in the list" bắt đột biến "lấy mục đầu".
  - `multiplayer.spec.ts` không đổi; `git stash list` vẫn 2 mục.
- **Tài liệu:**
  - `docs/architecture.md` có câu T79 đúng tên hàm, hằng và điều kiện.
  - `docs/design/multiplayer.md` khớp code: 10 phút, `seen` lớn nhất, chỉ ở `/`, không focus, Tab, quên giờ khi đóng hoặc `shutdown`, `seen: 0` cho danh sách cũ.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc
- **Cách ghi chính cho iOS chưa có test.**
  - Theo thiết kế, `visibilitychange` sang `hidden` là "cách chính", vì iOS dỡ app mà không bắn `pagehide`. Hiện xoá listener đó (hoặc xoá `setInterval`) thì không test nào hỏng: test 1 qua nhờ `pagehide`, test 4 chỉ kiểm phía "không ghi".
  - Đề xuất thêm vào test 4 một nửa đối xứng: trước khi gửi `offline`, giả trang ẩn lúc còn online, rồi kiểm `seen` đã thành giờ mới.
  - Nhịp 60 s có thể test bằng unit nếu tách `noteSeen` ra hàm nhận `setInterval` từ ngoài. Không cần gấp: thiếu một trong hai thì giờ chậm nhiều nhất 60 s so với khoảng 10 phút.
- **Màn 844×390:** tiêu đề chỉ cách mép trên khoảng 4 px khi nút hiện. Đó là màn standalone; Safari thường ở chế độ ngang còn có thanh công cụ, nên sảnh sẽ phải cuộn (vẫn tới được nút). Thêm gì vào sảnh ngang sau này cần đo lại.
  - Khi bấm nút, nút ẩn đi, khoảng cách trở lại 8 px, nên bố cục nhảy nhẹ trong lúc đang vào. Chỉ là thẩm mỹ.
- **Focus khi bấm bằng phím:** bấm nút phụ bằng Enter thì nút ẩn ngay nên focus rơi về `body` trong lúc vào. Hỏng thì thẻ lấy lại focus (e2e 2 kiểm), nên chấp nhận được. Có thể chuyển focus sang `#join-btn` cho trình đọc màn hình nếu muốn.
- **Dòng dài trong `docs/architecture.md`:** câu T79 chen giữa phần T65 (`noteRecentWorld`...) và câu `arrival(...)`, và kết bằng "Luật ở `docs/design/multiplayer.md`." nên câu `arrival` sau đó đọc như lạc chỗ. Nên dời câu T79 xuống sau đoạn `quietRetry`/`joinCard`, hoặc tách thành câu đậm riêng **Quay lại từ `/` (T79):**.
- `failToStart` ghi `seen` mới, nên vào được mà game không mở được rồi tải lại `/` sẽ có nút. Khớp bảng của PLAN; ghi lại cho rõ.
