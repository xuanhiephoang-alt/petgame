PASS
# REVIEW: T44 Trình duyệt không chạy được module báo sai nguyên nhân (thẻ "Hãy cập nhật trình duyệt"), vòng 2

## Kết luận
Lỗi duy nhất của vòng 1 đã được sửa đúng cách. Ngoài phần sửa đó, vòng 2 chỉ đổi đúng hai file test và `PROGRESS.md`, không thấy lỗi mới. Phần code sản phẩm (`packages/client/index.html`) và tài liệu giữ nguyên như vòng 1 (đã PASS phần đó).

## Lỗi phải sửa
Không có.

## Đã kiểm ở vòng 2
- **Lỗi vòng 1, đã sửa:** `tests/e2e/lobby.spec.ts` không còn `waitForTimeout`. Test "a later load error never replaces the update card…" giờ chờ sự kiện `error` của chính thẻ `<script>` được chèn vào.
  - Listener của bộ canh tải ở pha capture trên `window`, nên chạy trước listener gắn trên thẻ. Khi lời hứa xong, `fail()` chắc chắn đã chạy.
  - `ErrorEvent` được bắn đồng bộ.
  - Nếu sự kiện `error` không bao giờ tới, `evaluate` treo tới hết thời gian chờ và test hỏng rõ ràng, không qua suông.
  - Tester xác nhận đột biến bỏ `|| state === "outdated"` làm test hỏng cả 3 lần chạy.
- **`packages/client/src/indexHtml.test.ts`:** test CSS giờ khẳng định `from >= 0` và `to > from` trước khi cắt đoạn CSS, nên không còn qua suông khi đổi cách viết `#lobby {`. Tôi chạy lại: 7/7 xanh. Typecheck của client sạch.
- **`PROGRESS.md`:** câu sai "không `waitForTimeout`" của vòng 1 đã được sửa, kèm ghi chú. Có mục "Vòng 2" và "Kiểm thử vòng 2 (T44): PASS".
- **Không đổi thứ khác:**
  - `git diff --stat` của `index.html` và ba file tài liệu giống vòng 1.
  - Kiểm điểm lại các chỗ then chốt trong `index.html`, đều còn nguyên: điều kiện thoát của `fail()` và `outdated()`, `clearTimeout`, `refocus`, ` `, `top/left/width/height`, regex `invited`, script `nomodule`.
- **Ràng buộc:**
  - Không đụng `tests/e2e/multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json`.
  - Không thêm dependency.
  - `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
- **CSS bản build dùng cú pháp mà trình duyệt cũ bỏ qua:**
  - Bộ nén viết media query thành dạng khoảng, ví dụ `@media (width>=601px)`, và màu bóng thành `#0006` (hex 8 chữ số).
  - Trên trình duyệt không chạy module, thẻ T44 vẫn hiện nhờ các quy tắc gốc, chỉ mất bóng và bố cục rộng hoặc ngang. E2E không giả lập được phần này, vì Chromium hiểu cả hai.
  - Nếu muốn thẻ trông giống hệt: đặt `build.cssTarget` cũ hơn (ảnh hưởng toàn bộ CSS), hoặc để CSS của sảnh ra ngoài bộ nén. Mức ưu tiên thấp.
- **`indexHtml.test.ts`, danh sách cấm:** có thể thêm generator (`function*`, `yield`), `new Event(` (IE11 không có hàm dựng `Event`), cờ regex `u`/`y`/`s` và escape `\u{…}`. Danh sách là danh sách chặn có lý do, không cần đầy đủ.
- **`packages/client/index.html`:** chú thích khối của bộ canh tải xuống dòng lệch. Có một dòng rất dài ("…the nomodule script below says the browser") rồi một dòng rất ngắn ("cannot run modules at all. src/main.ts dispatches the lobby-ready event when"). Nên ngắt lại cho đều.
- **Chuyển sang T20** (theo PLAN.md, vì `multiplayer.spec.ts` đang bị T63 giữ):
  - bỏ hoặc ghi lý do cho `test.slow()` của test "lobby: a script that cannot load or breaks while starting …";
  - siết hai test "nothing is sent before…" và "on a slow network…" bằng `#load-invite` không còn `hidden`.
- **Ghi chú cho T16:** `lobby.spec.ts` có thêm bản chép của `LOBBY_SLOW_MS`, `ENTRY`, `PHONE` và `contexts`. Cần gom chung khi làm T16.
