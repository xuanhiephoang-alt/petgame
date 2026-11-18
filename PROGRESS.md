# PROGRESS: T83 Test đường ghi giờ chính trên iOS và dọn nhỏ sau T79

## Vòng 1: coder
- [x] Bước 1: `SeenNotes(online, write, every = SEEN_EVERY_MS)` với `note()`, `stop()`, không dùng DOM (`packages/client/src/net/seen.ts`).
- [x] Bước 2: `seen.test.ts`, 5 ca của PLAN, fake timer (`packages/client/src/net/seen.test.ts`).
- [x] Bước 3: `main.ts` dùng `SeenNotes` (`visibilitychange` ẩn và `pagehide` gọi `note()`, `pagehide` ghi trước `watch.leave()`, `stop()` khi `lost`); bỏ `setInterval`/`clearInterval`/`SEEN_EVERY_MS`; `enter()` đặt `aria-disabled="true"` thay vì ẩn nút; `showJoinCard` ẩn `rejoinBtn`.
- [x] Bước 4: `index.html`: xoá hai quy tắc `gap`/`.look-picker` của T79, thêm hai quy tắc `:has()` cùng hàng (`minmax(0, 1fr) 160px auto`, `nowrap`, `padding: 0 12px`) và `.lobby-action[aria-disabled="true"]`.
- [x] Bước 5: `tests/e2e/rejoin.spec.ts`: test 4 có nửa online và ca đối chứng; test 5 mới (hộp, `aria-disabled`, focus, bấm lần hai, thẻ "đã đóng", 3 cỡ).
- [x] Bước 6: `docs/architecture.md`: câu `arrival(...)` nối sau T65, khối **Quay lại từ `/` (T79, T83):** đứng trước **Vào mà game không mở được (T42):**.
- Lệch kế hoạch: test 5 bấm lần hai bằng `tap({ force: true })`. Playwright coi `aria-disabled="true"` là "not enabled" nên `tap()` thường chờ mãi; nút vẫn nhận bấm thật, và handler phải bỏ qua, đúng điều test muốn kiểm.
- Đo hộp (Chromium container, [x,y,rộng,cao]), sảnh không có nút, khớp PLAN:
  - 844×390: h1 82,14,680,26; look 82,48,680,268; name 82,324,472,44; join 562,324,200,44; form 82,6,680,378.
  - 390×844: h1 25,78,340,39; name 25,653,340,45; join 25,710,340,45; form 25,62,340,721.
  - 1280×720: h1 430,41,420,39; name 430,566,420,45; join 430,623,420,45; form 430,25,420,671.
  - Có nút ở 844×390: test 5 đoạn 1 qua (h1, look bằng sảnh thường; hàng nút cùng y; tên >= 200).
- Đột biến (sửa tay rồi khôi phục tay, `git diff --stat` khớp sau mỗi lần):
  - Xoá listener `visibilitychange`: e2e test 4 hỏng.
  - Xoá `setInterval`: `seen.test.ts` hỏng (3 ca, gồm ca 1).
  - Bỏ `online()`: `seen.test.ts` hỏng (2 ca) và e2e test 4 hỏng.
  - Bỏ `=== "hidden"`: e2e test 4 hỏng.
  - `rejoinBtn.hidden = true` đầu `enter()`: e2e test 5 hỏng.
  - Bỏ `rejoinBtn.hidden = true` trong `showJoinCard`: e2e test 2 và test 5 hỏng (2 failed).
  - Bỏ hai quy tắc CSS ngang: e2e test 5 hỏng.
  - Không thử riêng "đổi nhịp thành 120 s" và "trả lại quy tắc gap T79" (cùng loại với hai dòng trên).
- `node scripts/viStrings.mjs --compare HEAD`: 0 chữ mới. Không đụng `multiplayer.spec.ts`, `labelLayout`; `git stash list` vẫn 2 mục.
- Lệnh đã chạy: typecheck ✓, test ✓ (601 test), build ✓, `npm run test:e2e` ✓ (63 test), `rejoin.spec.ts` x5 (`--workers=1 --retries=0`) ✓ (5/5 lần qua, mỗi lần 5 test).

## Kiểm thử vòng 1 (T83): PASS
- typecheck ✓   test ✓ (41 file, 601 test)   build ✓   e2e ✓ (62 qua, 1 chập chờn)   `rejoin.spec.ts` x5 ✓ (25/25, `--workers=1 --retries=0`)   `-g "lobby:"` x2 ✓ (18/18)   photo3d (không chạy)
- Chập chờn (flaky): lần chạy đầy đủ đầu có 1 test hỏng, `multiplayer.spec.ts:2785 boss bar (phone upright, notch)`: `expect(locator('.hud-toasts > .toast:not(.out)')).toHaveCount(2)` nhận 1 sau 5 s, tại `multiplayer.spec.ts:2855`. Chạy lại riêng test đó: qua (13.8 s). Không liên quan T83 (HUD/toast, không đụng sảnh).
- Đột biến (sửa tay, khôi phục tay; `diff` với bản sao trước khi thử rỗng sau tất cả), mọi dòng bảng PLAN đều bị bắt:
  - xoá listener `visibilitychange` -> e2e test 4 hỏng.
  - xoá `setInterval` -> `seen.test.ts` hỏng 3 ca (ca 1, ca 2, ca 5).
  - đổi nhịp mặc định 120 s (coder bỏ qua) -> `seen.test.ts` ca 1 hỏng.
  - bỏ `online()` trong `note` -> `seen.test.ts` ca 2, 3 hỏng và e2e test 4 hỏng.
  - bỏ `=== "hidden"` -> e2e test 4 hỏng (đối chứng).
  - `rejoinBtn.hidden = true` đầu `enter()` -> e2e test 5 hỏng.
  - bỏ `rejoinBtn.hidden = true` trong `showJoinCard` -> e2e test 2 và 5 hỏng.
  - bỏ hai quy tắc CSS ngang -> e2e test 1 và 5 hỏng (`toBeInViewport`).
  - trả lại quy tắc `gap` của T79 (coder bỏ qua) -> e2e test 5 hỏng.
- Hộp sảnh KHÔNG có nút (Vite, Chromium container) khớp từng số với 83497b0:
  - 844x390: h1 82,14,680,26; look 82,48,680,268; name 82,324,472,44; join 562,324,200,44; form 82,6,680,378.
  - 390x844: h1 25,78,340,39; name 25,653,340,45; join 25,710,340,45; form 25,62,340,721.
  - 1280x720: h1 430,41,420,39; name 430,566,420,45; join 430,623,420,45; form 430,25,420,671.
- Có nút: 844x390 h1 và look giữ nguyên y (14, 48), name 82,324,252,44 (>= 200), join 342,324,160,44, rejoin 510,324,252,44 cùng hàng bên phải, chữ một dòng; 390x844 rejoin 25,739,340,44; 1280x720 rejoin 430,655,420,44 (đáy 699 < 720; form cao 727 nên cuộn nhẹ, như thiết kế dọc/desktop từ T79). Đã xem 3 ảnh chụp: gọn, không chồng lấn, tiêu đề cách mép trên 14 px ở ngang.
- Bấm ép: Enter, Space, chuột thật vào giữa nút, `dispatchEvent("click")` và Enter trong ô tên, tất cả trong lúc đang vào (matchmake bị giữ 2,5 s): chỉ 1 request `POST /matchmake/...` (cả lúc đang vào và sau khi hiện thẻ). Tức handler `if (joining || broken || !offered) return` bỏ qua thật, không chỉ Playwright.
- Focus: Tab từ "Vào chơi" tới nút phụ, Enter: `activeElement` = `rejoin-btn` khi `aria-disabled="true"` (300 ms sau khi bấm). Khi thẻ "Thế giới này đã đóng" hiện: `activeElement` = `new-world-btn`, nút phụ `hidden`.
- Không đụng `multiplayer.spec.ts`, `labelLayout`, server, shared; `git stash list` vẫn 2 mục.
- Test đã thêm: không (bộ test của coder bắt mọi đột biến, kể cả hai cái coder bỏ qua).
