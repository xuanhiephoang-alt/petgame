PASS
# REVIEW: T31 Hoàn thiện thông báo sau T6, vòng 1

## Kết luận
Đủ 4 mục của PLAN.md. Thông báo đang mờ không còn giữ chỗ, xoay máy làm thông báo thừa về hàng chờ, và chữ phần thưởng trùm server gửi có test đúng từng ký tự. Không đổi luật, chữ hay giao thức. Tôi đã chạy lại: typecheck sạch; `toastQueue.test.ts` qua 32/32; test server mới qua.

## Lỗi phải sửa
Không có.

## Đã kiểm

### 1. `renderToasts`: đọc trước, ghi sau
- Chỉ chạy khi hàng đổi: `tickToasts` gọi nó khi `update` trả `true`, và nó cũng chạy ở `showToast` và `resized`. Không chạy mỗi khung.
- Mỗi lần chạy, phép đọc (`offsetTop`, `getBoundingClientRect`) của mọi phần tử sắp mờ làm trước, rồi mới ghi. Vì vậy chỉ ép bố cục một lần, không có layout thrashing.
- Mảng `leaving` và các object trong đó chỉ được tạo khi có thay đổi, không mỗi khung, nên không trái luật của CLAUDE.md. `tickToasts` khi không có gì đổi vẫn không cấp phát.
- Phần tử `.out` bị xoá sau `TOAST_FADE_MS`. Phần tử không bao giờ được dùng lại: mỗi thông báo, kể cả cái quay lại từ hàng chờ, có `id` mới và `div` mới. Vì vậy `top` và `width` ghi thẳng vào style không rò sang thông báo khác.
- `offsetTop` tính theo `.hud-toasts`, vốn có `position: relative`. Phần tử đã `.out` không còn trong `toastElements` nên không bị đọc lại.

### 2. Ý nghĩa của `shrink`
- Vòng `while` dừng chắc chắn: mỗi lượt bớt một cái. `maxVisible()` là 0 thì bớt hết; NaN thì không vào vòng.
- Bớt cái yếu nhất (mức thấp nhất, cùng mức thì cũ nhất), dùng cùng luật tràn `enqueue` như `push`.
- `update` không bao giờ bớt (có test), nên luật T62 "thông báo đang hiện không bị cắt khi bố cục đổi" vẫn giữ.
- **Không có vòng lặp chết, không đói:**
  - Mỗi lần xoay chỉ chuyển một cái giữa màn hình và hàng chờ, và chỉ khi người chơi xoay. Thôi xoay thì nó hết giờ như thường.
  - Xoay đi xoay lại thì một thông báo mức cao được hiện lại đủ thời gian mỗi lần. Đó là kéo dài, không phải lặp vô hạn.
  - Trong hàng chờ, cùng mức thì cái cũ (`at` nhỏ) lên trước.
- **Ngoại lệ trong `hud.md`** ("mức cao không bao giờ bị cắt ngắn, trừ khi màn hình đổi cỡ làm mất chỗ") đúng với code. Kèm một ca hiếm, xem góp ý 2.

### 3. Listener `resize`
- Một listener cho cả vòng đời HUD, như các listener khác của `Hud`. `Hud`/`Game` không có `destroy` (đã biết).
- `resized()` đo lại rồi gọi `shrink` rồi `update`. Trên màn dọc ≥ 790 px, `measureSlots` đọc bố cục đồng bộ, nên phản ánh cỡ mới.
- Lần đo mỗi 250 ms khi có cái chờ, và lần đo khi hiện (T62), vẫn còn.
- Màn ngang và desktop không đọc bố cục. T61 không đổi.
- Thanh trùm `fit` và vị trí tên (T30), nếu được tính lại ở khung kế tiếp, có thể làm lần đo lúc `resize` lệch một khung. Xem góp ý 1.

### 4. Test server cho chữ phần thưởng
- Đi qua đường thật: đánh trùm, `BossDefeated`, rồi `Notice` mà client nhận.
- So đúng từng ký tự với chuỗi viết thẳng có `\xa0`, trong cả hai trường hợp (không có và có đồ thưởng), kèm regex cấm dấu cách thường giữa biểu tượng và số, và `kind === "reward"`. M9, M10 bị bắt.

### 5. E2E và M8
- **E1:** đọc vị trí ngay trong cùng một `evaluate` với `showToast`, sau khi chờ hết hoạt ảnh trượt vào, nên không chập chờn. Nó hỏng trên HEAD (`twoTop` 55) và bắt M1-M3. Chữ "Một" dài để chứng minh không xuống dòng lại (M2).
- **E2:** chỉ thu chữ *sau* khi xoay, nên điều kiện "đủ 2 chữ" chỉ đúng khi cái về chờ hiện lại (bắt M5). Hạn 1 s cho phép xoay đủ thời gian trên Chromium vẽ bằng phần mềm. Tester chạy `--repeat-each=5` được 10/10.
- **M8:** kết luận của tester đúng. `tickToasts` gọi `update` mỗi khung, nên thiếu `update` trong `resized` chỉ chậm một khung (trừ khi ticker đã dừng vì mất kết nối, lúc đó không còn thông báo mới). Hạ hạn xuống 200 ms thì hỏng cả mã thật, nên giữ 1000 ms là đúng. Giữ `update` trong `resized` vẫn có ích, vì phản hồi ngay trong cùng sự kiện.

### 6. Tài liệu
`hud.md` (bao nhiêu cái, khi hết chỗ, cầm dọc, chỗ hiện) và `architecture.md` (`shrink`, `update` chỉ thêm, `resize`, `toasts.spec.ts`) khớp với code.

### 7. Ràng buộc
- Không đổi `packages/shared`, `multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json`.
- Không đổi schema, message hay chữ người chơi thấy.
- `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **Đo lại một lần ở khung kế tiếp sau `resize`.** Trên màn dọc ≥ 790 px, chỗ chứa phụ thuộc bố cục HUD (ô nhiệm vụ, thanh trùm `fit`). Phần đó có thể được tính lại sau listener này, ở `frame()`.
   - Đo thiếu thì một thông báo về hàng chờ oan, rồi hiện lại ở lần đo 250 ms.
   - Đo thừa thì không bớt, và thông báo có thể lấn góc ngón cái tới hết giờ.
   - Cách rẻ: `resized()` đặt cờ, và `tickToasts` ở khung kế tiếp gọi lại `measureSlots`, `shrink`, `update`.
2. **`hud.md` có thể nói rõ ca tràn hàng chờ:** "về hàng chờ rồi hiện lại đủ thời gian" đúng, trừ khi hàng chờ đã đủ `maxWaiting` (4) cái mức cao. Khi đó luật tràn có sẵn có thể bỏ chính cái vừa về chờ. Đây là ca có từ trước (luật của `push`), rất hiếm.
3. **Vị trí câu mới trong `hud.md`:** câu "mờ đi tại chỗ… không giữ chỗ" đang đứng đầu đoạn **Chỗ hiện**, trước phần tả vị trí. Nên dời xuống cuối đoạn cho dễ đọc.
4. **Test server tách đôi:** hai trường hợp (không có và có đồ thưởng) nằm trong một test. Lỗi ở trường hợp đầu che trường hợp sau (tester đã nêu). Có thể tách thành hai `it`.
5. **Ghi chú cho T16:** `toasts.spec.ts` có thêm bản chép `enterLobby`, `waitForWorld`, `shownToasts`, `LONGEST_TOASTS`.
