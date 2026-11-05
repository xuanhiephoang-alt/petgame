PASS
# REVIEW: T6 Thông báo không che HUD (chỗ đặt, hàng đợi, mức ưu tiên), vòng 3

## Kết luận

Lỗi vòng 2 đã hết. `playOut` giờ ghi `to` theo những bước thông báo còn trong `visible`, nên một thông báo bị gỡ sớm sẽ có `to - from` ngắn hơn và test hỏng. Tình huống điện thoại ngang (1 chỗ) mới cho tin mức cao chờ 6 s rồi vẫn hiện đủ thời gian.

Code sản phẩm trùng bản đã rà ở vòng 1-2, không hồi quy:
- `toastQueue.ts` trùng từng byte với bản sao vòng 2 (cùng sha256; mtime đổi chỉ do coder thử đột biến rồi trả lại).
- Các file sản phẩm khác giữ nguyên mtime và số dòng diff.

Các tiêu chí của PLAN đều đạt:
- giao thức `kind` gắn đúng loại cho cả 31 tin;
- kinh nghiệm bắt thú trả lúc bóng khép;
- hàng đợi 3 mức;
- bố cục không che HUD ở 3 khung hình;
- tài liệu khớp code.

## Lỗi phải sửa (FAIL khi còn mục này)

Không còn.

Mình đã tự kiểm, chạy trên bản sao ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t6r2mut/`, không đụng repo:
- `toastQueue.test.ts` qua 19/19, typecheck sạch.
- Bốn đột biến đều bị bắt:
  - m1: cái chờ sau vào trước (`a.at > b.at`) → test hạ trùm hỏng;
  - m2: hoà `at` thì cái sau thắng, tin lên cấp chen trước tin ★ → test bắt thú đầu đàn và test một chỗ hỏng;
  - m3: `maxWaitMs.high: 5000` → test một chỗ hỏng;
  - m4: cắt mọi thông báo sau 2 s khi hàng chờ trống → cả ba test tình huống hỏng.

## Góp ý không bắt buộc

- **Test:** `to = now + 10` làm tròn theo bước 10 ms. Test nào sau này dùng chữ có thời lượng không chia hết cho 10 (ví dụ 3.860 ms) phải so lệch tối đa 10 ms, hoặc chọn chữ có thời lượng tròn.
- **Thông báo nhảy chỗ khi bị thay** (`hud.ts:157-162`): cái đang mờ đi vẫn chiếm chỗ 200 ms, nên cái mới hiện thấp hơn một ô rồi nhảy lên. Cách sửa: gán `top` theo `offsetTop` và cho `.toast.out { position: absolute; left: 0; }`.
- **Xoay từ dọc sang ngang khi đang có 2 thông báo:** cả hai ở lại tới khi hết giờ (tối đa 7 s). Có thể cho ra ngay cái không phải mức cao vượt chỗ, hoặc ghi rõ hành vi này vào `docs/design/hud.md`.
- **Đọc kích thước màn hình mỗi khung hình:** `toastRoom(window.innerWidth, window.innerHeight)` chạy mỗi khung hình khi có thông báo đang chờ. Nên lưu lại, chỉ cập nhật khi có sự kiện `resize`.
- **E2E:**
  - thanh máu trùm đang ẩn trong 3 test bố cục nên phép kiểm `.boss-bar` không kiểm gì; nên gọi `hud.setBoss(...)` trước khi đo;
  - test hàng đợi "chờ nó đi theo" bằng `companions.size >= 1`, điều kiện đã đúng sẵn; nên chờ `activePalId` trỏ tới con emberpup.
- **Test server:** chưa có test khẳng định thông báo trùm chứa `rewardText(BOSS.reward)` và tên món đồ hiếm.
- **Lặt vặt:**
  - thứ tự chữ cái của import `CAPTURE_NEWS_DELAY_MS` (`GameRoom.ts:23`, `GameRoom.test.ts:14`);
  - JSDoc cho `ToastQueue.waiting`;
  - `hud.md:16`: màn mất kết nối không nằm trong `.hud`;
  - `hud.md:61`: mẹo chỉ bị thay khi cả hai chỗ đã đầy.

## Việc mới nên đưa vào `TASKS.md`

- **T30 (P2). Thanh máu trùm che HUD.**
  - Thanh máu trùm đè hàng máu trên điện thoại dọc (184×35 px, che thanh máu của mình) và desktop (42×35 px).
  - Gợi ý: đưa vào `.hud-left` khi cầm dọc; desktop giới hạn bề rộng trong phần trống bên phải cột trái.
  - Kèm: cột trái khi cầm ngang trên iPhone có tai thỏ (`viewport-fit=cover`, `env(safe-area-inset-left)` khoảng 44-59 px) vượt mốc giữa màn hình − 100 px và có thể chạm thanh máu trùm. Gợi ý `max-width: min(300px, calc(50vw - 110px - env(safe-area-inset-left)))`.
  - E2E đo như `toastLayout`, có hiện thanh máu trùm.
- **T14:** thêm nhóm ảnh `toasts` vào `npm run shots`, lấy `toast-shots-after.mjs` của T6 làm gốc.
- **T20:** bỏ mục "bỏ tham số `delayMs` của `announce`" (T6 đã làm).
- **T18:** sau khi nâng nút "Ăn", 🔊 lên 44 px, chạy lại e2e `toasts (phone sideways)`. Nếu đáy thông báo vượt `innerHeight − 140` thì thu gọn cột khi cầm ngang, không nới giới hạn.
- **T12:** bảng chữ thông báo server giữ `kind` cạnh mỗi câu.
- **(P3) Tin ★ khi bắt thú đầu đàn:** người ném đang thấy hai tin cho một lần bắt. Gửi tin ★ cho mọi người trừ người ném, và thêm cờ `alpha` vào `CaptureResultMessage` để chữ "Bắt được …" ghi "đầu đàn".
- **(P3) Hoàn thiện thông báo:**
  - sửa thông báo nhảy chỗ khi bị thay;
  - xử lý khi số chỗ giảm lúc xoay màn hình;
  - lưu `toastRoom` theo `resize`;
  - e2e bố cục hiện thanh máu trùm;
  - test server cho chữ phần thưởng trùm.
- **Ghi chú cho agent chính:** thêm `docs/design/hud.md` vào danh sách tài liệu thiết kế trong `CLAUDE.md`.
