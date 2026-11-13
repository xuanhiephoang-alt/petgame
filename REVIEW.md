PASS
# REVIEW: T62 Điện thoại dọc: thông báo đè tên người chơi, vòng 1

## Kết luận
Thay đổi làm đủ 7 bước của PLAN.md, không làm ngoài phạm vi. Luật vừa chỗ đúng và tính theo số đo thật, nên màn ngang, desktop và màn dọc < 790 không đọc DOM. Không có lỗi phải sửa. Hàng chờ không cắt thông báo khi số chỗ giảm. Số chỗ cũng không nhảy qua lại giữa 1 và 2, nên không cần hysteresis. Tôi đã tự chạy typecheck (sạch) và 2 file unit (37/37 qua). Ba file test chỉ có dòng thêm (`git diff --numstat`: 11/34/105 dòng thêm, 0 dòng xoá).

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm (không phải lỗi)
- **Chỗ bắt đầu thông báo đo thật khớp với mô hình `restingNameTop`:**
  - `.hud-toasts` là con cuối của `.hud-left` (flex cột, `order: 10`), và `.hud-toasts:empty` có `display: none`. Vì vậy hai nhánh của `Hud.toastFit` cho cùng một số:
    - có thông báo: mép trên của `.hud-toasts`;
    - không có: đáy `.hud-left` + `row-gap`.

    Số đo đó không phụ thuộc thông báo đang hiện, và hiệu ứng trượt nằm ở `.toast`.
  - `restingNameTop` dùng các số sau, không có số nào thay đổi từng khung, nên số chỗ không dao động:
    - `stage.height` và `camera.zoom`: chỉ `Stage.resize` ghi;
    - `me.height`: tóc và mũ lúc này;
    - `CAMERA_LEAD_PX`, `PLAYER_TAG_LIFT_PX`: chung một nguồn với `Game.ts`.
- **Đổi tủ đồ khi đang có thông báo:** nếu có thông báo chờ, số chỗ được tính lại với chiều cao mới trong vòng ≤ 250 ms. Thông báo đang hiện không bị cắt, đúng kế hoạch.
- **Thanh trùm thế chỗ ô nhiệm vụ giữa hàng chờ:** chỗ bắt đầu thông báo đo lại từ DOM, nên chỗ mở ra (1 → 2) được dùng ngay. Trường hợp ngược lại (trùm đi xa, ô nhiệm vụ cao trở lại) có thể làm thông báo đang hiện đè tên tới hết giờ. Kế hoạch đã chấp nhận ở mục rủi ro.
- **Xoay máy:** màn ngang trả 1 hoặc 2 trước khi gọi `fit`. Mỗi lần `push` đều tính lại, và trong lúc chờ thì tính lại mỗi 250 ms. Xem thêm góp ý 4 về một khung trễ của Pixi.
- **Luật hàng chờ:** `ToastQueue` không đổi, và `maxVisible()` chỉ chặn việc hiện thêm. Khi số chỗ từ 2 xuống 1, cả hai thông báo đang hiện vẫn ở lại. Khi số chỗ từ 1 lên 2, cái đang chờ hiện bên dưới. Không có chớp tắt.
- **Hiệu năng:**
  - `tickToasts` chỉ đo khi `waiting.length > 0` và đã ≥ 250 ms từ lần đo trước;
  - closure và object `ToastFit` chỉ được tạo khi đo;
  - khi không có thông báo chờ thì không tạo object nào mỗi khung;
  - `getBoundingClientRect` và `getComputedStyle` chỉ nằm trong `toastFit`.
- **Hằng số:**
  - `16` ở dòng camera và `6` ở hai chỗ nhãn người chơi đã thay bằng hằng.
  - Nhãn thú đầu đàn vẫn `actor.height + 6` (Game.ts:461), và đúng ra phải giữ: đó là nhãn thú, không phải nhãn người chơi. Dùng `PLAYER_TAG_LIFT_PX` ở đó sẽ sai nghĩa.
  - `NAME_TAG_PX`, `HURT_BAR_PX` có chú thích hai chiều với CSS (`index.html` và JSDoc).
- **Test:**
  - Unit test phủ ranh giới 230 / 229,9, mốc 789/790, `fit` trả `undefined`, và các màn không gọi `fit`.
  - E2E: thanh máu giả lập bằng đúng lớp `hurt` mà `setHp` đặt. Lớp được bật rồi trả lại trong cùng một `evaluate`, và test kiểm nó đẩy tên lên 7-9 px.
  - Nếu số chỗ sai thành 2, `toHaveCount(1)` không thể qua: hai thông báo cùng hết hạn ở 7 s, nên số đếm đi 2 → 0, không bao giờ qua 1. Đột biến (b) và (d) của tester xác nhận điều này.
  - Tester lặp 80/80 lần, gồm các test `boss bar (...)` (rủi ro T30), không có lần nào chập chờn.
- **hud.md:**
  - Mốc 790, luật vừa chỗ, chu kỳ 250 ms và câu "màn ngang không đo" khớp code.
  - Bảng kết quả khớp số đo của coder (+52,6 / +12,0 / +59,6 / +19,0 / +18,4 / +54,0).

## Góp ý không bắt buộc
1. **Việc tách mới, nên thêm vào TASKS.md cùng 2 việc kế hoạch đã đề xuất: tên mình bị `layoutTags` đẩy lên.**
   - Nhãn ghim (rank ≤ `PINNED_RANK`) xếp theo y trước. Vì vậy khi thú đi theo mình, thú đang ngắm hoặc thú đầu đàn đứng thấp hơn mình trên màn và chồng nhãn, nhãn của mình phải nhường và lên cao tới `LABEL_PINNED_NUDGE_PX` = 48 px (`labelLayout.ts` dòng 92-95).
   - `restingNameTop` không tính phần này, nên khi đứng yên mà đánh nhau sát thú, 2 thông báo vẫn có thể đè tên.
   - Nên gộp vào việc "tên lên cao lúc đang đi". Đo xem trường hợp này hay gặp tới mức nào, rồi chọn một trong hai hướng:
     - cho nhãn `me` luôn giữ chỗ (rank `me` xếp trước mọi nhãn ghim khác);
     - hoặc cộng phần `rise` hiện tại của nhãn mình vào lúc đo.
2. **Hai việc kế hoạch đề xuất (màn dọc thấp 390×664 / 375×667; camera trễ khi đi):** đồng ý tách thành P3.
   - Với màn dọc thấp, hướng "ẩn dòng gợi ý hoặc dòng Thưởng của ô nhiệm vụ khi cầm dọc thấp" rẻ và không đụng luật hàng chờ. Nên làm trước hướng cắt chữ thông báo.
   - Với camera trễ, không nên cộng thêm cố định vào `nameClearPx` (mất 2 chỗ ở 390×844). Nên đo tần suất trước, như kế hoạch nói.
3. **Câu chữ ở hud.md và PLAN.md, mục "Trải nghiệm":**
   - Câu "thông báo thứ hai hiện sau khi cái đầu hết" chỉ đúng cho thông báo mức cao.
   - Với 1 chỗ, một thông báo mức thường tới khi một thông báo mức thường đang hiện sẽ **thay** cái đó (luật T8, như khi cầm ngang), chứ không chờ.
   - Nên ghi rõ ở hud.md: "thông báo đang hiện không bị cắt **vì số chỗ giảm**".
4. **Xoay máy, một khung trễ:**
   - `toastRoom` dùng `window.innerWidth/innerHeight` ngay lúc đó, còn `restingNameTop` dùng `stage.height`. Pixi cập nhật `stage.height` qua sự kiện resize của renderer, có thể chậm một khung.
   - Phần lớn trường hợp làm số chỗ nhỏ hơn thật (an toàn). Nếu muốn chặt, có thể truyền `stage.width/height` vào `toastRoom` thay cho `window.inner*`.
5. **E2E `toasts (upright phone, ...)`:**
   - Vòng lặp chờ `lag < 1` không kiểm lại sau 5 lần thử, chỉ ghi log. Nên `expect(layout.lag).toBeLessThan(1)` (hoặc ít nhất ghi `lag` vào thông báo lỗi của `gap`), để nếu hỏng thì phân biệt được camera trễ với luật sai.
   - `setLook` chỉ gửi `{ hair: "curly" }`, kế hoạch ghi `{ hair, hairColor: 0, skin: 0 }`. Test vẫn qua, không ảnh hưởng.
6. **Unit test "fit is only asked...":** thiếu `(1280, 500)` trong danh sách tiêu chí. Nhánh `height ≤ 520` đã được kiểm gián tiếp, nên chỉ cần thêm cho đủ.
7. **`showToast` đo mỗi lần gọi** (ép layout một lần trên màn dọc ≥ 790). Với tần suất thông báo hiện tại thì không sao. Nếu sau này có thông báo dồn dập (spam nút), có thể bỏ qua lần đo khi lần trước cách < 50 ms.
