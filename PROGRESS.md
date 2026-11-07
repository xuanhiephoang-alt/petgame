# PROGRESS: T39 Nút HUD trên điện thoại không bị joystick che

## Vòng 1: coder
- [x] Bước 1: CSS: `.joystick-zone` có `z-index: -1`, hai rule `.hud.touch ...`, `.eat-btn` bỏ `z-index`, chú thích mới (`packages/client/index.html`).
- [x] Bước 2: `Hud` đặt lớp `touch` khi `isTouch`; nút Ăn và `button()` dùng hàm chung `onPress` (`pointerdown`); chú thích nút mời giữ `click`; JSDoc `joystickZone` (`packages/client/src/ui/hud.ts`).
- [x] Bước 3: JSDoc của `Joystick` (`packages/client/src/ui/joystick.ts`).
- [x] Bước 4: `docs/architecture.md` (hud.ts, joystick.ts, helper `fingers`).
- [x] Bước 5: test "eating:" bấm lúc đang hồi bằng `pointerdown`, kiểm `shook` (`tests/e2e/multiplayer.spec.ts`).
- [x] Bước 6: helper `fingers` và 2 e2e `touch (phone upright|phone sideways)` (cùng file).
- Lệch kế hoạch: bỏ qua bước tự kiểm "chạy test mới trên code chưa sửa để thấy nó hỏng" (viết test cùng lúc với code).
- Lệnh đã chạy: typecheck ✓, test ✓ (294 test), build ✓, `touch (` lặp 3 lần x 2 khung 6/6 ✓, e2e đầy đủ 30/31 (1 lần hỏng ở "gameplay: chop a tree... dizzy pal", test cũ không liên quan; chạy lại 2/2 qua). Không còn tiến trình nền.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (294)   build ✓   e2e ✓ (31/31, `--workers=1`)   photo3d (không chạy)
- Chạy lặp `touch (phone upright|sideways)` x10 mỗi khung: 20/20 qua.
- Tự kiểm trên code cũ (bản `HEAD` ở scratchpad, kèm spec mới): 3 test hỏng đúng chỗ. "eating:" `shook` false (nút Ăn không nghe `pointerdown`). 2 test `touch`: `covered` = `sound-btn`, `invite-btn`, `ball-btn` ... `under joystick-zone`. Trên code mới qua cả ba.
- Test "gameplay: chop a tree... dizzy pal" x10: code mới 10/10 qua; code cũ (`HEAD`) 8/10 (2 lần hỏng tại `multiplayer.spec.ts:579` `expect.poll(dizzyPals).toBe(0)`: received khác 0). Không liên quan T39: chập chờn có từ trước (khớp rủi ro T37, Space đánh "con gần nhất"). Trong bộ đầy đủ nó qua.
- Tiêu chí hoàn thành: [x] nút nửa trái trả về chính nút qua `elementFromPoint` (390x844, 844x390, kiểm trong test `touch`) [x] vùng joystick vẫn phủ cả nửa trái, ô nhiệm vụ cho chạm xuyên [x] Ăn ăn dưới ngón thứ hai [x] "eating:" sửa qua [x] typecheck/unit/build/e2e qua. Desktop 1280x720: các test desktop (toasts, labels...) qua, lớp `touch` chỉ đặt khi `isTouch`.
- Test đã thêm: không thêm ngoài phần coder đã viết.
