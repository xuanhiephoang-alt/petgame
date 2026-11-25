# PROGRESS: T44 Trình duyệt không chạy được module báo sai nguyên nhân

## Vòng 1: coder
- [x] Bước 1, 2, 3, 4: `packages/client/index.html`:
  - CSS: `#lobby` bỏ `inset`, ba `width: min(...)` của `#lobby form` thành `width` + `max-width`; selector `.lobby-alert.outdated` cạnh `failed`; quy tắc `#load-link`; chú thích.
  - Markup `#load-status`: bỏ `aria-live`, thêm `<p id="load-link" hidden>`.
  - Bộ canh tải: bỏ `URLSearchParams` (regex `invited`), trạng thái `outdated` (hàm `outdated()`, `NO_MODULES_EVENT`), `fail()` không đè `outdated`, `show()` ẩn nút Tải lại và `#load-invite` rồi hiện `#load-link` khi `outdated`, focus về `#name` sau báo nhầm, ba câu dùng `Tải lại`, chú thích ES5 và bốn tín hiệu.
  - Script `<script nomodule>` mới (ES5, chỉ bắn `petgame:no-modules`) sau bộ canh tải, trước thẻ module.
- [x] Bước 5: `packages/client/src/indexHtml.test.ts` (7 test, gồm 6 mục của kế hoạch). Kiểm chạy thử đỏ: trên `index.html` của HEAD hỏng 6/7 (mục 1, 3, 4, 5, 6 và CSS).
- [x] Bước 6: `tests/e2e/lobby.spec.ts` (4 test: thẻ `outdated` dev và build, Safari 10.1 giả lập, "Tải lại" nguyên dòng + `alert` + focus), kiểm số lần viết lại HTML, không `test.slow()`. (Sửa ở vòng 2: vòng 1 nói "không `waitForTimeout`" là sai, test thứ 5 do tester thêm có một dòng `waitForTimeout(500)`; nay đã bỏ.)
- [x] Bước 7: tài liệu: `docs/design/multiplayer.md`, `docs/architecture.md` (chữ người chơi thấy, canh tải T44, ES5, dòng e2e, câu `join`), `docs/deploy.md` (hai hash CSP).
- Lệch kế hoạch:
  - **`#lobby` dùng `top: 0; left: 0; width: 100%; height: 100%` thay vì `top/right/bottom/left: 0`** (Thiết kế 5). Lý do: bộ nén CSS của `vite build` gộp bốn cạnh bằng 0 lại thành `inset:0` (thấy trong `dist/index.html`), nên bản build vẫn dùng `inset` và trình duyệt cũ vẫn làm rơi thẻ khỏi màn hình; test e2e bản build bắt được điều đó (khổ 844×390, `#load-title` ngoài khung nhìn). Với `width/height: 100%` bộ nén không gộp, và `dist` giữ đúng `top:0;left:0;width:100%;height:100%`. Hình trên trình duyệt mới giữ nguyên về nguyên tắc (fixed 100% của khung nhìn = `inset: 0`); chưa đo `boundingBox()` trước/sau như tiêu chí, việc đó dành cho tester.
  - Chú thích CSS không được chứa chuỗi `inset:` (có dấu hai chấm), vì regex xoá `inset:` của test e2e sẽ ăn luôn phần sau chú thích; đã viết lại chú thích.
- Lệnh đã chạy: typecheck ✓, test ✓ (713 test, 48 file), build ✓ (`dist/index.html`: script `nomodule` còn nguyên, đứng sau bộ canh tải, sau thẻ module đã dời lên `<head>`), `npx playwright test tests/e2e/lobby.spec.ts --repeat-each=3` ✓ (12/12, ổn định), `npm run test:e2e` ✓ (67 passed = 63 cũ + 4 mới; flake `boss bar (phone upright, notch)` không xảy ra). `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts` không bị sửa; không dependency mới; không `git stash`.

## Kiểm thử vòng 1 (T44): PASS
- typecheck ✓   test ✓ (48 file, 713 test)   build ✓   e2e ✓ (68 = 63 cũ + 5 lần lobby.spec; `lobby.spec.ts --repeat-each=5` 25/25, không chập chờn)   photo3d (không chạy)
- `indexHtml.test.ts` 7/7; trên `index.html` của HEAD hỏng 6/7 (chỉ ca "parses" của script nomodule còn qua vì HEAD không có nó).
- Bố cục trước/sau (`boundingBox` của `#lobby`, `#lobby form`, 390×844, 844×390, 1280×720): HEAD và bản mới giống từng pixel, ở Vite dev và ở build (build HEAD dựng bằng `vite build --outDir` ra thư mục tạm). `dist/index.html` không còn `inset` cho `#lobby` (`top:0;left:0;width:100%;height:100%`; các `inset:0` còn lại là của `.labels`, HUD...). Lệch khỏi kế hoạch là hợp lý: một phần tử `position:fixed` không padding/viền có width/height 100% đúng bằng inset:0, minifier gộp bốn số 0 về `inset:0` nên buộc dùng width/height.
- Xem ảnh thẻ (build, rewrite như `lobby.spec.ts`): thẻ "Hãy cập nhật trình duyệt" đọc rõ, địa chỉ chọn được (`user-select: all`), không tràn ngang, không cắt ở 3 cỡ (ở 390 địa chỉ bẻ giữa chữ "low" do `word-break: break-all`, chấp nhận được). Thẻ "Vẫn đang tải…": "Tải lại." nằm trọn một dòng.
- Đột biến (khôi phục từ bản sao, diff khớp): `URLSearchParams` trở lại -> unit hỏng; đổi tên sự kiện ở nomodule -> unit hỏng; thêm `aria-live` -> unit hỏng; hẹn giờ vẫn bắn sau outdated (bỏ `clearTimeout` và điều kiện `state === "loading"`) -> e2e `lobby.spec` hỏng; **lỗi tải muộn ghi đè outdated (bỏ `|| state === "outdated"` trong `fail`) lọt qua hết test** -> đã thêm test.
- Test đã thêm: `tests/e2e/lobby.spec.ts` "a later load error never replaces the update card of a browser without modules" (script cùng gốc lỗi tải + ErrorEvent sau khi outdated; bắt được đột biến trên: `lobby-alert failed`).
- Ràng buộc: không đụng `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json`; `git stash list` còn 2 mục. Không commit.

## Vòng 2: coder
- [x] `tests/e2e/lobby.spec.ts`, test "a later load error never replaces the update card…": bỏ `waitForTimeout(500)`; chờ sự kiện `error` của chính thẻ `<script>` chèn vào (listener canh tải chạy trước nên `fail()` đã chạy khi promise xong), rồi vẫn bắn `ErrorEvent` đồng bộ.
- [x] `packages/client/src/indexHtml.test.ts`: kiểm `indexOf("#lobby {") >= 0` và điểm cuối > điểm đầu trước khi cắt đoạn CSS.
- [x] Chứng minh test bắt lỗi: bỏ `|| state === "outdated"` khỏi `fail()` trong `index.html` thì test 5 hỏng (thẻ thành `lobby-alert failed`); đã hoàn lại, `cmp` với bản sao lưu giống hệt, `git diff` chỉ còn hai chỗ có `state === "outdated"` hợp lệ (`fail()` và `outdated()`).
- Lệnh đã chạy: typecheck ✓, test ✓ (713 test), build ✓, `lobby.spec.ts --repeat-each=5` ✓ (25/25), `npm run test:e2e` ✓ (68 passed). `multiplayer.spec.ts` và labelLayout không bị sửa.

## Kiểm thử vòng 2 (T44): PASS
- typecheck ✓   test ✓ (48 file, 713 test)   build ✓   e2e ✓ (68; `lobby.spec.ts --repeat-each=5` 25/25; boss bar không flake)   photo3d (không chạy)
- `lobby.spec.ts` không còn `waitForTimeout`.
- Đột biến (khôi phục từ bản sao, diff khớp): bỏ `|| state === "outdated"` trong `fail()` -> test "a later load error..." hỏng cả 3 lần chạy; đổi tên `#lobby {` -> `indexHtml.test.ts` hỏng ở ca CSS (không qua suông).
- Ràng buộc: không đụng `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json`; `git stash list` còn 2 mục. Không commit.
