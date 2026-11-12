# PROGRESS: T42 Sảnh giữ đến khi thế giới vẽ xong

## Vòng 1: coder
- [x] Bước 1: `joinStatus.ts`: `JoinCard.reload`, `primary` thêm `"reload"`, `StartFailure`, `DOWNLOAD_ERROR`, `startFailure`, `startCard`; test trong `joinStatus.test.ts` (packages/client/src/ui/)
- [x] Bước 2: `game/assetIndex.ts` (`fetchIndex`) + `assetIndex.test.ts`; dùng trong `palSprites.ts`, `art/pictures.ts`, `art/doll.ts`
- [x] Bước 3: `Game.create` gọi `abandon()` (huỷ PixiJS app, không ném) khi `init` hỏng (`game/Game.ts`)
- [x] Bước 4: `index.html`: nút `#join-reload-btn`, `#lobby { z-index: 10 }`, chú thích form
- [x] Bước 5: `main.ts`: `Promise.allSettled`, `lobby.remove()` sau `Game.create` (rồi mới gán `__petgame.game`), `failToStart` (dọn `#game`, ghi địa chỉ, `watch.leave()`, ẩn tên/ngoại hình, thẻ Tải lại), cờ `broken`, nút Tải lại (click + Space)
- [x] Bước 6: e2e `tests/e2e/multiplayer.spec.ts`: `waitForWorld` chờ sảnh biến mất, `PIXI_ENV_CHUNK`, test A và B
- [x] Bước 7: `docs/architecture.md` (đoạn `main.ts`; `assetIndex.ts` nhắc trong đoạn đó, không thêm dòng riêng vì mục `game/` gộp theo nhóm)
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (365 test), build ✓, `npx playwright test -g "lobby:"` ✓ (6 test), `npm run test:e2e` đầy đủ: ✓ (40 passed, 5.9 phút).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (365, 30 file)   build ✓   e2e ✓ (40; lần chạy đầy đủ: 39 qua, 1 chập chờn)   photo3d (không chạy)
- Chập chờn: `labels: in a crowd on a phone, no name tag covers another...` (multiplayer.spec.ts:971) lần đầu hỏng ở dòng 1002 (`labelOverlaps` trả `["Tuấn | Lv 6 Leafkit"]`), chạy lại riêng thì qua. Đây là test bố cục nhãn, không đi qua đường sảnh/failToStart; nghi do thời điểm mô phỏng thú đi lại, không do T42. Nên theo dõi nếu lặp lại.
- Test A và B: `--repeat-each=3 --workers=1` qua cả 6 lần (A ~10 s, B ~2.8 s).
- Kiểm tra test B hỏng trên code cũ: tạm chép `doll.ts` của HEAD vào (không dùng `fetchIndex`), test B hỏng ở `await expect(page.locator("#look")).toBeHidden()` (multiplayer.spec.ts:1731). Đã khôi phục, `cmp` với bản lưu giống hệt.
- Tiêu chí hoàn thành:
  - [x] Sảnh chỉ gỡ sau `Game.create`; `__petgame.game` gán sau `lobby.remove()` (main.ts)
  - [x] `#lobby { z-index: 10 }` (đọc diff; không có test hình riêng cho khoảng dựng)
  - [x] `Promise.allSettled`; vào được mà hỏng thì `failToStart` gọi `watch.leave()`
  - [x] Lỗi vào phòng giữ nguyên bốn thẻ T23 (các test `lobby:` cũ qua)
  - [x] `#game` rỗng (test A: 0 canvas, 0 `.hud`); địa chỉ giữ `room`/`quality` khi có bạn, bỏ `room` khi một mình; host thấy số người về 1 trong timeout 5 s mặc định của `expect.poll` (< 20 s giữ chỗ, nên là rời chủ động)
  - [x] Thẻ đúng chữ, chỉ nút Tải lại, có focus, Enter và chạm tải lại được; ≥ 44x44 và trong khung nhìn ở 3 cỡ. Phím Space chỉ kiểm bằng đọc code (chưa có e2e)
  - [x] `#name` ẩn (test A); `broken` chặn `enter()` (đọc code)
  - [x] `fetchIndex` dùng ở cả ba hàm tải ảnh; test B qua với `null`/`[1]`/pals bị chặn
  - [x] `Game.create` gọi `abandon()` (đọc code, không có test riêng)
  - [x] Test A khẳng định route bị gọi (`expect(blocked).toBeGreaterThan(0)`)
  - [x] Unit mới cho `startFailure`, `startCard`, `fetchIndex`
  - [x] `docs/architecture.md` cập nhật
- Test đã thêm: không thêm (bộ test của coder đã đủ theo PLAN.md). Ghi chú nhỏ: Space trên nút Tải lại và `#look` ẩn sau thẻ chưa có e2e; không bắt buộc.
