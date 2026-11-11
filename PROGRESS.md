# PROGRESS: T18 Nút cảm ứng dưới 44 px

## Vòng 1: coder
- [x] Bước 1: CSS trong `packages/client/index.html`
  - `.sound-btn` 44×44 (bỏ `min-height: 28px` của điện thoại); `.hud-actions` mới (Ăn + 🔊 xuống dòng cùng nhau).
  - Vùng chạm vô hình `::before` 44 px cho `.party-btn/.base-btn/.craft-btn/.wardrobe-btn/.invite-btn`; `.invite-btn` có `position: relative`.
  - Cột phải bước 48 px (top 12/60/108/156), bỏ 3 luật top riêng của điện thoại dọc; bản đồ nhỏ và bảng dời xuống (204/196 px).
  - `.party-panel`: `box-sizing: border-box`, rộng 340, `max-height` mới (không còn tràn đáy 8-12 px); ngang: `.wardrobe-panel` và `.pals-panel` rộng 490, `.party-buttons` lưới 2 cột (nút thứ 3 trải 2 cột).
  - `.party-close` 44×44, `.party-action` 44, `.wardrobe-tab` 44, `.style-btn` 44, `.swatch` 44×44, `.skill-auto` 44, `.ball-btn` 44 cao; `.ball-btn.touch` sang nửa phải (`right: 104px`).
  - Sảnh: `#lobby input, #join-btn` min-height 44; form rộng 420 từ 601 px; điện thoại dọc thấp (≤ 760) gap 8 + búp bê `zoom: 0.8`; điện thoại ngang: lưới 2 cột, ô tên và "Vào chơi" chung hàng.
- [x] Bước 2: `packages/client/src/ui/hud.ts`: Ăn + 🔊 trong `div.hud-actions`; nút Bóng dùng `onPress` (không còn `click`); `setBall` nhãn ngắn trên cảm ứng ("⚪ Thường", "🔵 Xịn (N)"), `aria-label` luôn là tên đầy đủ, desktop giữ chữ cũ.
- [x] Bước 3: `packages/client/src/ui/party.ts`: class `pals-panel`; "Lv" + dấu cách không ngắt (` `) ở tên thẻ và tiêu đề hộp xác nhận; `aria-label` nút Thả không đổi.
- [x] Bước 4: `packages/client/src/main.ts`: `errorBox.scrollIntoView({ block: "nearest" })` khi vào phòng lỗi.
- [x] Bước 5: `tests/e2e/multiplayer.spec.ts`: helper `touchTargets`, `expectTouchable`, `panelFits`; test mới `touch targets (phone upright|phone sideways)` (sảnh, HUD, nút Bóng bằng ngón thứ hai, bảng Thú 8 thú, chế độ Thả, hộp xác nhận, Chế tạo, Tủ đồ 4 tab). Đặt trước test `exploring:`.
- [x] Bước 6: `docs/architecture.md` (dòng `ui/`, mục helper e2e). `docs/design/hud.md` giữ nguyên (khớp code).
- Lệch kế hoạch: không có. Test mới đặt trước test "exploring" (ngay sau vòng lặp `touch (...)`), và chiều cao tên thẻ đo bằng `Range` từ "Lv" tới hết chữ như kế hoạch.

## Số đo
- Trước (kế hoạch, HEAD `449ae87`, đo bằng vùng chạm thật): dưới 44 px: 127/151 chỗ ở 390×844, 128/151 ở 844×390, 127/148 ở 1280×720; bảng tràn đáy 8 px (dọc, desktop), 12 px (ngang); hàng máu ngang 52-87 px; nút Bóng x 105-240 (nửa trái).
- Sau (test mới, Chromium): 0 chỗ chạm dưới 44×44 ở 390×844 và 844×390 trong sảnh, HUD, bảng Thú, chế độ Thả, hộp xác nhận, Chế tạo, Tủ đồ 4 tab; trang không cuộn (`scrollTop` 0); mọi bảng trọn màn hình; tên thẻ có "Lv N" trên 1 dòng; thẻ cao ≤ 136 (ngang) / ≤ 176 (dọc); nút Bóng ở nửa phải và đổi bóng bằng ngón thứ hai. Chưa đo lại 1280×720 và ảnh trước/sau (việc của tester).
- Kiểm chứng test bắt được lỗi (đã trả lại file, `cmp` khớp): (a) `.party-action` 36 px: cả 2 khung hình hỏng ở bảng Thú; (b) bỏ `box-sizing` của `.party-panel`: hỏng ở khung ngang (dọc vẫn qua); (c) bỏ luật `::before`: cả 2 hỏng ở HUD; (d) bỏ lưới 2 cột: ngang hỏng (thẻ cao 160 > 136).

- Lệnh đã chạy: typecheck ✓, test ✓ (333 test), build ✓, `npm run test:e2e` ✓ (36 test, gồm 2 test mới)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (333)   build ✓   e2e ✓ (36, cổng 2567/5173 trống)   photo3d (không chạy, không đụng)
- Chạy lại: `npx playwright test -g "touch" --repeat-each=3 --workers=1` ✓ 15/15 (gồm 6/6 test mới); không có test chập chờn.
- Tiêu chí hoàn thành:
  - [x] CSS đúng mục 1 (hiển thị qua test và ảnh; không đọc từng luật)
  - [x] `hud.ts`: nút Bóng `onPress`, nhãn ngắn "⚪ Thường"/"🔵 Xịn (1)" trên cảm ứng, aria-label đầy đủ (test kiểm)
  - [x] `party.ts` ("Lv" cùng dòng với số, test kiểm), `main.ts`
  - [x] E2E mới qua 2 khung hình điện thoại, 6/6 với repeat-each=3; mọi test cũ qua; cả bộ qua
  - [x] Số đo sau: 0 chỗ chạm dưới 44 ở 390×844 và 844×390 (test). 1280×720: đo bằng bản sao tạm của test mới (đã xoá) với 3 cấu hình: laptop cảm ứng 1280×720, 1281×721, và desktop không cảm ứng 1280×720: 0 chỗ dưới 44, trang không cuộn, bảng trọn màn hình; chỉ còn link mời `<a>` 121×17 trên desktop không cảm ứng (ngoại lệ có trong kế hoạch). Đáy thông báo ngang: test `toasts (phone sideways)` qua (≤ 250).
  - [~] Kiểm chứng 4 lỗi: do coder đã làm và ghi ở trên, tester không làm lại. Ảnh "sau" đã xem (sảnh ngang, HUD dọc/ngang, bảng Thú dọc/ngang, Tủ đồ ngang): không vỡ bố cục, nút Bóng cạnh Bắt, hàng máu 2 dòng, bảng không tràn. Ảnh "trước" không chụp (cần checkout HEAD cũ, tránh đụng cây làm việc).
  - [x] typecheck, test, build sạch; docs/architecture.md đã cập nhật (git diff)
- Ghi chú: ở 1280×720 test mới không chạy sẵn (chỉ 2 khung hình điện thoại, đúng kế hoạch); chưa thêm test desktop.
- Test đã thêm: không (test của coder đủ theo PLAN.md).
