# PROGRESS: T8 Dấu ★ cho thú đầu đàn đã bắt

## Vòng 1: coder
- [x] Bước 1-3: `OwnedPal.alpha`, `Companion.alpha` (cuối schema), `CaptureResultMessage.alpha?`, hàm `palName` + unit test (`packages/shared/src/schema.ts`, `messages.ts`, `alphas.ts`, `alphas.test.ts`).
- [x] Bước 4: `SavedPal.alpha`, `sanitizeProfile` đọc `p.alpha === true` (`packages/server/src/persistence/store.ts`, `store.test.ts`).
- [x] Bước 5: `GameRoom.ts`: `debug:givePal` nhận `alpha`, `onJoin`, `handleThrow` (cờ, `result.alpha`, tin ★ qua `announce(news, except)` tìm client theo sessionId trong cùng hẹn giờ với `grantXp`), `release`, `knockOut`, bỏ `alphaName`, `spawnCompanion`, `saveNow`.
- [x] Bước 6: `Game.ts`: chữ bắt/thoát dùng `palName`, nhãn thú đi theo `★ Lv N Loài` class `alpha`, `alpha` trong dữ liệu bảng Thú.
- [x] Bước 7: `ui/party.ts`: class `alpha`, `span.party-star`, `aria-label` nút Thả, khoá vẽ lại, dòng `.party-confirm-alpha` trong hộp xác nhận.
- [x] Bước 8: CSS trong `packages/client/index.html`.
- [x] Bước 9: test tích hợp theo mục Test (sửa 4, thêm 4; test thứ tự tin ★ viết lại theo watcher) trong `GameRoom.test.ts`; e2e mới ở `tests/e2e/multiplayer.spec.ts` (3 khung hình).
- [x] Bước 10: `docs/architecture.md` (5 chỗ).
- Lệch kế hoạch: bộ chọn e2e cho thẻ là `.party-card[data-pal-id]` (không phải `.party-card`), vì tủ đồ/trang phục cũng dùng class `party-card` nên `strong` bị trùng nhiều phần tử.
- Lệnh đã chạy: typecheck ✓, test ✓ (300 test), build ✓, e2e mới 3 lượt ✓ (cùng test cũ "pack leaders"), cả bộ e2e 32/32 ✓.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (300, chạy 2 lần)   build ✓   e2e ✓ (32/32, --workers=1; test ★ mới lặp 5 lần đều qua, không chập chờn)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] hồ sơ cũ không có alpha -> false (store.test.ts)  [x] cờ lưu và còn sau khi vào lại (tích hợp + e2e reload)  [x] debug:givePal alpha chỉ khi PETGAME_DEBUG=1  [x] tin ★ cho người ném, không trùng, người khác nhận ★ trước lên cấp  [x] thẻ thú, nhãn tên, hộp xác nhận thả
- Ảnh đã xem (không commit): /tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/card-390x844.png, card-844x390.png, card-1280x720.png, tag-1280x720.png (và tag-390x844, tag-844x390), dialog-390x844.png, dialog-844x390.png, dialog-1280x720.png. Sao nằm trong thẻ, nhãn "★ Lv 15 Voltmouse", hộp thả có dòng "★ Thú đầu đàn" vừa khung ở cả ba cỡ, không tràn hay chồng chữ.
- Test đã thêm: không (coder đã có đủ; chỉ chụp ảnh bằng spec tạm đã xoá).
