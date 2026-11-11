PASS
# REVIEW: T18 Nút cảm ứng dưới 44 px (sảnh, HUD, các bảng), vòng 1

## Kết luận
Thay đổi làm đủ và đúng các bước 1-6 của PLAN.md, không làm thừa (không đụng server, shared, schema, hồ sơ; 🔊 và 🔗 vẫn `click`; `aria-label` nút Thả giữ nguyên). Nút Bóng chuyển sang `onPress` không bắn hai lần và chạy được bằng ngón thứ hai. Test e2e mới đo vùng chạm thật bằng `elementFromPoint` và bắt được các lỗi hồi quy chính (coder đã thử cả 4 kiểu làm hỏng). Không còn lỗi phải sửa.

## Đã kiểm
- **CSS so với kế hoạch (mục 1a-1l):** có đủ. `.sound-btn` 44×44 và đã xoá `min-height: 28px` của điện thoại; luật `::before` chung cho 4 nút cột phải và `.invite-btn` (có `position: relative`); cột phải đặt top 12/60/108/156, đã xoá 3 luật top riêng khi dọc; bản đồ nhỏ và bảng ở 204/196; `.party-panel` dùng `border-box`, rộng 340 (bề ngoài không đổi so với 320 + 20 padding cũ), `max-height` đúng; Tủ đồ ngang rộng 490 bề ngoài (đúng như 470 + 20 trước); lưới 2 cột cho `.party-buttons` chỉ áp khi cầm ngang; sảnh gộp luật input/nút, form 420 px từ 601 px, `zoom: 0.8` cho điện thoại dọc thấp, lưới 2 cột khi cầm ngang.
- **Lưới sảnh khi cầm ngang:** `#name` và `#join-btn` đứng liền nhau trong DOM (`index.html:425-426`), nên chắc chắn chung một hàng. `#load-status[hidden]` và `<noscript>` không chiếm ô lưới.
- **`.party-buttons > :nth-child(3):last-child`:** thẻ có nhiều nhất 3 nút (`party.ts:315-318`); chế độ Thả có 1 nút. Không có trường hợp 4 nút làm vỡ lưới. `.party-buttons` chỉ có ở thẻ thú.
- **`.hud-actions`:** `div` này nhận `pointer-events: none` từ `.hud.touch .hud-health`; nút bên trong vẫn được bật lại nhờ `.hud.touch .hud-left button`. Cần điều khiển vẫn nhận chạm qua phần trống. `gap: inherit` lấy 8/5 px của hàng máu, đúng ý.
- **Nút Bóng `pointerdown` (`hud.ts:89`, `onPress` ở `hud.ts:256`):**
  - Không bắn hai lần: bộ nghe `click` đã bỏ, `preventDefault` trên `pointerdown` chặn cả mousedown lẫn việc lấy focus. Test sẽ hỏng nếu bắn hai lần (bóng đổi hai lần thì quay về "⚪ Thường").
  - Đa chạm: mỗi ngón có `pointerdown` riêng. Nút giờ nằm ở nửa phải, không chung chỗ với `.joystick-zone` (đang giữ ngón đầu bằng pointer capture). Test lái hai ngón thật qua CDP.
  - Bàn phím: Enter/Space trên nút đang focus không còn đổi bóng, phím R vẫn dùng được (`Game.ts:314`, có trong `title`). Đúng quyết định trong kế hoạch, giống T39. Có thêm lợi: trước đây Space (đánh) trên nút Bóng đang focus còn đổi bóng.
  - Chuột phải/chuột giữa cũng đổi bóng: để T40 lo, đúng phạm vi.
  - `setBall` đặt `aria-label` sau phép so sánh sớm. Lần gọi đầu và mỗi lần chữ đổi đều cập nhật; nhãn ngắn chỉ dùng khi `isTouch`.
- **NBSP ở "Lv":** chỉ dùng ở tên thẻ và tiêu đề hộp xác nhận, `aria-label` không đổi. Các test cũ dùng chuỗi so khớp vẫn qua (Playwright chuẩn hoá khoảng trắng); cả bộ e2e đã qua.
- **`main.ts`:** chỉ có một chỗ ghi lỗi vào phòng, và `scrollIntoView` nằm đúng chỗ đó.
- **Test mới:** đo đúng điều cần đo. Vùng `::before` được tính, phần bị che không được tính. Phần tử trong bảng hoặc sảnh được `scrollIntoView` trước khi đo, kèm điều kiện trang không cuộn, nên nếu bảng tràn thì test bắt được. Test kiểm danh sách tên phần tử bắt buộc (một phần tử biến mất cũng làm hỏng), chiều cao thẻ, số thẻ trọn khi ngang, "Lv N" nằm trên một dòng, bảng nằm trọn màn hình. Không có `waitForTimeout`; repeat-each=3 qua 6/6.
- **Tài liệu:** `docs/architecture.md` (dòng `ui/` và helper e2e) đã cập nhật; `docs/design/hud.md` (mục "Cỡ chạm", bảng Bố cục, nút Bóng) đã vào commit kế hoạch `13d2ec5` và khớp với code.
- **Quy ước:** chú thích tiếng Anh có ghi T18, chữ người chơi thấy bằng tiếng Việt, typecheck sạch.

## Góp ý không bắt buộc
- Test vùng chạm chỉ chạy ở 2 khung hình điện thoại (đúng kế hoạch), còn quy tắc ≥ 44 áp cho cả desktop (laptop cảm ứng). Tester mới đo 1280×720 bằng bản sao tạm rồi xoá. Nên thêm một khung hình "laptop cảm ứng 1280×720" vào vòng lặp của test này để giữ quy tắc lâu dài (việc mới bên dưới).
- Ảnh "trước" không được chụp lại; số đo trước trong PLAN.md mục 1 là đủ để so, nên không chặn.
- `onPress` làm mọi nút dùng nó (giờ có cả Bóng) bỏ qua Enter/Space khi nút đang focus. Nếu muốn giữ khả năng dùng bàn phím mà không bắn hai lần: thêm bộ nghe `click` chỉ chạy khi `e.detail === 0` (click do bàn phím). Có thể gộp vào T40.
- `index.html:142`, `.party-btn` thiếu thụt đầu dòng. Lỗi có từ trước, không thuộc diff này.

## Việc mới đề xuất cho TASKS.md
- **T30 (ghi chú):** bảng (`.party-panel`) khi dọc và bản đồ nhỏ dùng top cố định 196, chưa cộng `env(safe-area-inset-top)` như cột nút phải. Trên iPhone có tai thỏ (inset ~47 px), vùng chạm của 👕 Tủ đồ xuống tới ~y 232, nên bảng mở ra có thể đè lên nó.
- **T40 (ghi chú):** nút Bóng giờ cũng đi qua `onPress`, nên e2e chuột phải của T40 cần kiểm cả nút Bóng; tiện thì xem luôn chuyện kích hoạt bằng bàn phím (`e.detail === 0`).
- **T20 (ghi chú):** `tests/e2e/multiplayer.spec.ts:1058, :1295` có thể đổi `.party-panel:has(.party-release-toggle)` thành `.pals-panel`.
- **Mới, ưu tiên thấp:** thêm khung hình laptop cảm ứng 1280×720 (`hasTouch: true`) vào test `touch targets (...)`, để quy tắc ≥ 44 ở desktop có test giữ.
