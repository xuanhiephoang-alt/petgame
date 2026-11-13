PASS
# REVIEW: T61 Điện thoại ngang thấp (cao 375 px): thông báo vượt mốc ngón cái, vòng 1

## Kết luận
Thay đổi đúng PLAN.md và `docs/design/hud.md`, không làm gì ngoài phạm vi: chỉ đụng `hud.ts`, `index.html`, e2e (176 dòng thêm, 0 dòng xoá). Phần dời nút bằng matchMedia đúng, ô trạng thái chỉ ghi DOM khi số đổi, CSS chỉ áp dụng khi cầm ngang (riêng `.hud-count` áp dụng cho mọi điện thoại, đúng kế hoạch), thanh trùm T30 giữ nguyên. Không có lỗi phải sửa. `npm run typecheck` sạch (reviewer chạy lại). Phần thêm trong spec e2e cũng qua `tsc --strict` khi kiểm riêng (không có lỗi kiểu nào).

## Lỗi phải sửa
(không có)

## Trả lời các câu hỏi rà soát

1. **Dời nút bằng matchMedia** (`hud.ts:78-99`):
   - Chỉ có một `<button>`, tạo một lần trong constructor và chỉ khi `isTouch`. `append` dời nút sang chỗ mới chứ không nhân bản, nên trình nghe `click` và `data-link` đi theo nút. Test kiểm `.invite-btn` có đúng 1 cái trước và sau khi xoay máy 2 lần, rồi `tap` mở bảng chia sẻ.
   - Trạng thái ban đầu: `placeInvite()` chạy ngay trong constructor. Khi đó `Game.init` đã dựng stage, nên khung nhìn đã có cỡ thật.
   - Câu truy vấn trùng từng ký tự với khối CSS `index.html:408`.
   - Trình nghe `change` không bao giờ được gỡ, nhưng `Hud` và `Game` không có `destroy()` và sống suốt đời trang: rời thế giới là `location.assign` hoặc `reload` (`main.ts:191-196, 228`). Vì vậy không rò rỉ. Sau này thêm `destroy()` thì nhớ gỡ trình nghe này.
   - Focus: `append` một nút đang có focus làm nó mất focus. Chuyện này chỉ xảy ra khi đang focus nút bằng bàn phím mà xoay máy, gần như không gặp.
   - Trình nghe uỷ quyền cũ trên `this.status` đã bị xoá. Chú thích về "cử chỉ người dùng" được giữ, chuyển sang trình nghe mới.
2. **Trợ năng:**
   - Nút 🔗: `aria-label="Mời bạn"` có ở mọi màn. Tên đọc ra chứa chữ đang hiện ("Mời"), nên đạt WCAG 2.5.3 (label in name). Khi cầm dọc, chữ hiện "🔗 Mời bạn" khớp đúng tên đọc ra.
   - Chữ giờ: `.hud-time-word { display: none }` làm chữ rời khỏi cây trợ năng. Trình đọc màn hình chỉ còn đọc tên của emoji (VoiceOver và TalkBack đọc ☀️ 🌇 🌙 🌅 thành tên mô tả, gần nghĩa nhưng không phải "Ngày" hay "Hoàng hôn"). `title` trên một `span` thường không được trình đọc màn hình trên điện thoại đọc, và màn cảm ứng không hiện tooltip.
   - Không chặn: tên vùng cũng đã ẩn bằng `display: none` từ T6, và HUD này chưa đặt mục tiêu dùng được với trình đọc màn hình. Xem góp ý 1.
3. **Hiệu năng:**
   - `setStatus` vẫn chạy mỗi khung (`Game.updateHud` gọi từ vòng vẽ), như trước T61.
   - DOM chỉ ghi khi `html` đổi, `dataset.link` chỉ gán khi khác. Không có `querySelector` mới chạy mỗi khung. `setTime` chỉ `querySelector` khi pha đổi.
   - Mỗi khung vẫn dựng chuỗi và vài mảng nhỏ (`counts`, `map`, `join`). Bản cũ cũng dựng chuỗi mỗi khung, nên số rác tăng rất ít. Không tạo phần tử DOM nào. Đạt tiêu chí của kế hoạch.
4. **Chỗ ngắt dòng của ô trạng thái đầy khi cầm dọc:**
   - Không phải hồi quy so với T18 hay T39. T18 đặt mốc ngón cái cho màn cầm ngang. T39 lo vùng chạm và cần điều khiển, mà hộp và vùng chạm của nút 🔗 khi cầm dọc trùng 0 px với HEAD (số đo của tester).
   - Khoảng cách cũ ` &nbsp; ` (dấu cách, nbsp, dấu cách) gần bằng khoảng mới (1 dấu cách + 6 px), nên rộng tổng gần như không đổi.
   - Ngắt dòng nay tốt hơn: trước đây trình duyệt được ngắt giữa biểu tượng và số (như "🪵" ở cuối dòng, "600" ở đầu dòng sau, thêm `overflow-wrap: anywhere`). Nay mỗi con số giữ nguyên một khối.
   - Trường hợp xấu nhất chỉ là một con số dời hẳn xuống dòng sau. Khi cầm dọc không có mốc nào bị ảnh hưởng.
5. **Phạm vi CSS:**
   - Các luật mới cho cầm ngang đều nằm trong khối `(max-height: 520px) and (min-width: 601px)`.
   - Hai luật chung `.hud-count` (nowrap, cách 6 px) chỉ khớp DOM của màn cảm ứng: desktop vẫn dựng HTML cũ, không có `.hud-count`.
   - Một chỗ rò nhỏ: khối CSS này cũng khớp cửa sổ desktop thấp (cao ≤ 520 px), nên ở đó chữ giờ cũng ẩn. Tên vùng cũng ẩn như vậy từ T6. Không có nút 🔗 nào bị dời, vì nhánh desktop không tạo nút. Xem góp ý 2.
6. **Vùng chạm:**
   - Nút 🔗 khi cầm ngang: hộp 61×21, vùng chạm `::before` cao 44 px (`index.html:261-262`). `expectTouchable` trong test mới xác nhận 🫐 Ăn, 🔊 và 🔗 đều có vùng chạm thật ≥ 44×44.
   - Các test `touch targets` và `touch (...)` có sẵn vẫn qua.
7. **Thanh trùm T30:**
   - Không đổi `.boss-bar` hay luật bố cục của nó.
   - Test mới kiểm thanh nằm giữa, mép trên ngang cột, cách cột và bản đồ nhỏ ≥ 8 px, nằm trong vùng an toàn, không chồng nút 🔗 (`expectBarClear` đo cả `.invite-btn`).
   - 5 test `boss bar (...)` có sẵn vẫn qua, 80/80 lần lặp.
8. **Chất lượng test:**
   - 2 test `short sideways phone (...)` kiểm đúng hành vi mà kế hoạch đặt ra:
     - ô trạng thái 1 dòng và hàng máu ≤ 70 lúc hoàng hôn;
     - ba nút cùng một dòng, vùng chạm ≥ 44×44;
     - xoay máy hai lần rồi bảng chia sẻ vẫn nhận đúng link;
     - thông báo kết thúc ≤ cao − 140, có và không có thanh trùm.
   - Đột biến (b), bỏ trình nghe `change`, bị bắt.
   - Test tester thêm (ô đầy ở 667) bắt được đột biến (a), bỏ `nowrap`: nó kiểm từng `.hud-count` chỉ có 1 khung (`getClientRects`). Đây là cách kiểm tốt.
   - `nearBoss` chép y nguyên `goNearBoss` (`multiplayer.spec.ts:2711-2740`). Kế hoạch cho phép vì T61 không sửa test cũ, và đã có đề xuất dọn ở việc tách số 3. Chấp nhận.
9. **Việc tách ra:** cả 3 đề xuất trong PLAN.md đều hợp lý, nên thêm vào `TASKS.md` (P3). Thêm 2 góp ý dưới đây nếu muốn.

## Góp ý không bắt buộc
1. **Trợ năng chữ giờ** (P3): ẩn `.hud-time-word` bằng luật "visually hidden" thay vì `display: none`, như `position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap`. Phần tử nằm ngoài luồng flex nên không đổi bố cục, và trình đọc màn hình vẫn đọc "Hoàng hôn". Có thể làm cùng `.hud-region`. Nếu đã thay luật ẩn thì `title` không còn cần.
2. Cửa sổ desktop thấp (cao ≤ 520 px) cũng mất chữ giờ, giống tên vùng từ T6. Có thể giới hạn `.hud-time-word { display: none }` vào `.hud.touch`. Ghi lại trong `hud.md` nếu giữ nguyên.
3. `setStatus` (nhánh cảm ứng) có thể so khoá số (`players|captured|wood|stone|berries|gear`) trước khi dựng mảng và HTML, để khung không đổi gì thì không tạo chuỗi nào. Nhánh desktop cũng vậy. Lợi ích nhỏ.
4. Test ô đầy có thể kiểm thêm `.hud-status` cao ≤ 2 dòng, và chạy ở 812×375 có tai thỏ. Đề xuất tách số 2 trong PLAN.md cũng nhắc việc thêm trường hợp này.
5. Rủi ro màn rộng 601-615 px (dòng 2 hàng máu tràn 6 px) đã được ghi và chấp nhận trong PLAN.md. Nên ghi kèm vào việc tách số 1 (640×360) để đo cùng lúc.
