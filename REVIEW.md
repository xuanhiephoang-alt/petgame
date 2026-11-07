PASS
# REVIEW: T39 Nút HUD trên điện thoại không bị vùng joystick che; nút "Ăn" nghe `pointerdown`, vòng 1

## Kết luận
Code làm đúng và đủ mọi bước, mọi tiêu chí hoàn thành của PLAN.md, không làm gì ngoài phạm vi. Thứ tự lớp đúng: vùng joystick z −1 nằm trong lớp xếp chồng của `.hud` (z 2), nên vẫn ở trên canvas và nhãn tên (z 1). Bảng (3), thông báo (4), bản đồ phóng to (4), hộp thả thú (5, trong `.hud`) và màn che kết nối (6, trong `#game`) vẫn nằm trên vùng như trước, desktop không đổi. Mình đã chạy lại `npx playwright test -g "touch \("`: qua 2/2 (23 s).

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm (tóm tắt)
- **CSS** (`packages/client/index.html:131-135`):
  - Vùng joystick chỉ thêm `z-index: -1`; vị trí, cỡ, `pointer-events`, `touch-action` giữ nguyên.
  - `.hud.touch .hud-health/.hud-status/.hud-quest` (độ ưu tiên 0,3,0) thắng các rule `pointer-events: auto` cũ. Mọi con không phải nút thừa hưởng `none`; nút trong cột nhận `auto` qua `.hud.touch .hud-left button`.
  - Chạm xuyên không làm mất thao tác nào trên ba ô. Trên cảm ứng, ô trạng thái chỉ có nút mời (không có link). Ô nhiệm vụ không có bộ nghe nào. Hàng máu chỉ có Ăn và 🔊, cả hai là `<button>`.
  - Nút mời vẫn chạy: `click` nổi bọt qua `.hud-status` dù ô này là `pointer-events: none`, test xác nhận `navigator.share` được gọi.
  - Phần ô tràn sang nửa phải khi cầm dọc (x 195-262) giờ chạm xuống canvas. Canvas và Pixi không có bộ nghe nào (đã grep), nên không có tác dụng gì mới.
- **`.eat-btn` bỏ `z-index: 1`:** trên desktop không có gì đè nút. Thanh máu trùm gắn trước `.hud-left` và là `pointer-events: none`. 3 test bố cục toasts (kiểm cả nút Ăn nằm trên cùng) vẫn qua.
- **Lớp `touch`:** đặt cùng cờ `isTouch` và cùng lúc với vùng joystick (`hud.ts:40` và `:90-91`) và `Joystick` (`Game.ts:285`). Cả ba chỉ tính một lần, nên không thể lệch nhau. Không có selector `.touch` trần hay so sánh `className === "hud"` nào bị ảnh hưởng (đã grep client, tests, scripts).
- **`onPress`:** nút Ăn và mọi tổ tiên của nó không còn bộ nghe `click`, nên một lần chạm hay một cú bấm chuột chỉ ăn một lần. Bộ nghe `click` của `.hud-status` không chứa nút Ăn. Phím H vẫn chạy. 🔊, 🔗 và nút Bóng giữ `click` như PLAN. Server vẫn kiểm hồi chiêu nếu bấm dồn bằng nhiều ngón.
- **Kéo qua nút:** ngón bắt đầu trên vùng bị vùng giữ (capture tường minh, cộng capture ngầm của cảm ứng), nên không gửi `pointerdown` hay `click` cho nút nào nó đi qua. Chạm chỗ trống vẫn bật joystick.
- **E2E:**
  - `fingers` không trùng helper nào: Playwright 1.56 chỉ có `touchscreen.tap()`. Nó dùng lại `join`, `waitForWorld`, `recordSends`, `sendFrom`. Phiên CDP đóng theo context trong `afterEach`.
  - Chú thích của `fingers` khớp cách Chromium xử lý `Input.dispatchTouchEvent`: điểm mới là nhấn, điểm thiếu là nhấc, `touchEnd` phải rỗng.
  - Phép kiểm bố cục không rỗng: bắt buộc có `eat-btn`, `sound-btn`, `invite-btn`.
  - Bước ngón thứ hai phân biệt được `click` và `pointerdown` (PLAN đã đo: trên code cũ quả không đổi). Tester đã chạy test mới trên code cũ và thấy hỏng đúng chỗ, chạy lặp 20/20.
  - Test "eating:" giờ kiểm `shook`, nên trên code cũ thì hỏng.
- **Tài liệu:** `docs/design/hud.md` khớp code: lớp vẽ, mục "Cần điều khiển và nút cảm ứng", danh sách nút `pointerdown` (khớp `skillbar.ts:50-62`). `docs/architecture.md` cập nhật đúng bước 4.

## Góp ý không bắt buộc
- **`onPress` chạy với mọi nút chuột** (`hud.ts:251-256`). `pointerdown` có cả chuột phải và chuột giữa, còn `click` chỉ có chuột trái. Vì vậy trên desktop, chuột phải vào 🫐 Ăn giờ cũng ăn (kèm menu chuột phải).
  - Ô chiêu (`skillbar.ts:50-62`) đã như vậy từ trước, và tác dụng chỉ là việc của chính nút, nên không chặn PASS.
  - Sửa một dòng: `if (e.button !== 0) return;` (ngón tay và đầu bút chạm đều báo `button` 0).
- **Enter/Space trên nút Ăn đang được focus, và trình đọc màn hình, không còn ăn.** PLAN đã chấp nhận và H vẫn dùng được. Nếu sau này muốn giữ: nghe thêm `click` nhưng chỉ chạy khi `e.detail === 0` (click do bàn phím hay công cụ hỗ trợ sinh ra; click của chuột hay ngón tay có `detail` ≥ 1) thì không bị chạy hai lần. Cần đo trên Safari trước khi dùng.
- **Không test nào bắt được việc gắn lại `click` cạnh `pointerdown`** cho nút Ăn: tin `eat` thứ hai bị server lặng lẽ bỏ vì hồi chiêu, quả vẫn chỉ giảm 1. Có thể bọc `recordSends` quanh `.click()` của test desktop (`multiplayer.spec.ts:238`) và kiểm đúng một tin `eat`.
- **Desktop "không đổi" mới chỉ được kiểm bằng đọc code.** Thêm một dòng vào một test desktop (`.hud` không có lớp `touch`, `.hud-status` có `pointer-events` là `auto`) sẽ giữ được điều này.
- **`PHONE_SCREENS`** (`multiplayer.spec.ts:306-309`) lặp lại hai mục điện thoại của `TOAST_SCREENS` (`:1592-1596`); có thể dựng `TOAST_SCREENS` từ nó.
- **Ghi chú T18 trong `TASKS.md:29`** viết "(🔗 và 🔊 giữ `click` vì share/copy cần cử chỉ người dùng)". Lý do đó chỉ đúng cho 🔗. 🔊 giữ `click` vì không dùng lúc đang chạy (`docs/design/hud.md:32`). Agent chính sửa câu chữ khi cập nhật TASKS.md.

## Việc mới nên đưa vào TASKS.md
1. **(P2, ghép vào T18; ghi chú đã có trong cây làm việc) Nút ⚪/🔵 Bóng sang `onPress`**, thêm bước hai ngón vào test `touch (...)` bằng `fingers`. Kèm điểm mới:
   - Khi cầm dọc, nút Bóng (x 105-240, y 696-724) giờ nằm trên vùng joystick, ngay chỗ ngón cái trái hay đặt. Ở đó chạm nhanh là đổi bóng, còn kéo bắt đầu từ đó thì không làm gì.
   - Nâng nút lên 44 px (T18) thì chỗ chết này rộng thêm. Nên cân nhắc dời nút sang nửa phải khi cầm dọc (như khi cầm ngang), rồi chạy lại `touch (phone upright)`.
2. **(P3) Nút chạy theo `pointerdown` nhận cả chuột phải và chuột giữa.**
   - Gồm `onPress` (`hud.ts`: Ăn, và Đánh, Bắt, 💨 trên laptop cảm ứng) và ô chiêu, Tự động (`skillbar.ts`, có cả trên desktop).
   - Bỏ qua khi `e.button !== 0`. Gom về một hàm dùng chung (xuất `onPress`, `skillbar.ts` dùng lại).
   - E2E desktop: chuột phải vào Ăn hay ô chiêu không gửi gì.
3. **(P3, có thể ghép T19) Kích hoạt nút Ăn bằng bàn phím hay trình đọc màn hình** (Enter/Space khi nút có focus): quyết định có hỗ trợ không, ví dụ `click` với `detail === 0`. Hiện `docs/design/hud.md` ghi bàn phím chỉ dùng H.
