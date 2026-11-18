# PROGRESS: T13 Cài game lên màn hình chính (PWA)

## Vòng 1 (Phần A): asset-manager

Không commit, không `git stash`, không dùng AI vẽ ảnh (không tốn credit).

- [x] A1. `scripts/appIcons.py` (Pillow + numpy). Đọc ô `front` của `emberpup.webp` theo `index.json` (rộng ô = `floor(W/4)`), cắt bbox alpha, vẽ ở 1024 rồi thu LANCZOS. Tất định: chạy hai lần, `md5sum -c` khớp cả 5 file. Tự kiểm: thú ngoài `SAFE_RADIUS = 0.40` ở maskable thì `sys.exit`; icon maskable và apple-touch có alpha < 255 thì `sys.exit`.
- [x] A2. Chạy `python3 scripts/appIcons.py`, 5 PNG (bán kính xa nhất của thú, tính trên ảnh 1024):

| File (trong `packages/client/public/`) | Cỡ | Byte | Bán kính thú |
|---|---|---|---|
| `icons/icon-192.png` | 192 | 38537 | 0.447·S |
| `icons/icon-512.png` | 512 | 164055 | 0.447·S |
| `icons/icon-maskable-192.png` | 192 | 32927 | 0.364·S (≤ 0.40) |
| `icons/icon-maskable-512.png` | 512 | 141541 | 0.364·S (≤ 0.40) |
| `apple-touch-icon.png` | 180 | 31565 | 0.426·S |

  Xem trước (bản `any`, maskable cắt tròn, apple-touch; không commit): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/icons-preview.png`. Đã xem: thú nằm gọn trong vòng tròn, không bị cắt, không có chữ.
- [x] A3. `packages/client/public/manifest.webmanifest`: thêm `id`, `scope`, `lang`, `dir`, `description`, `categories`, 4 icon, đúng thứ tự khoá PLAN.
- [x] A4. `packages/client/index.html`: 3 dòng (`icon`, `apple-touch-icon`, `apple-mobile-web-app-title`) ngay sau `<link rel="manifest">`; `git diff` chỉ có 3 dòng thêm, script canh tải inline không đổi.
- [x] A5. `scripts/pwaManifest.test.mjs`: 5 ca (manifest hợp lệ; có 192 any, 512 any, 512 maskable; mỗi `icons[].src` tồn tại, là PNG, cỡ thật khớp `sizes`; `apple-touch-icon` là PNG 180x180; `icon` tồn tại). Đọc cỡ qua IHDR.
- [x] A6. `assets/CREDITS.md` thêm dòng nguồn icon; `docs/art-style.md` thêm mục "Icon app".

### Lệnh đã chạy
- `npm run typecheck`: sạch.
- `npm test`: 38 file, 531 test qua.
- `npm run build`: thành công.
- `npm run test:e2e` (cổng 2567, 5173 trống): 56 qua.
- `npm run shots -- --only world`: 15 ảnh vào `shots/latest/`, số sprite bình thường (ví dụ pal-closeup 310, phone 317, phone-lake 376, đều < 600). Thay đổi chỉ là file tĩnh trong `public/` và thẻ `<head>`, không đụng gì trong game; không chạy bộ `before` riêng vì không có thay đổi hình trong game.

### Lệch so với PLAN
- Không có lệch về nội dung. Hai chi tiết nhỏ do tự chọn: bóng dưới chân đặt cao hơn đường chân 0.3 chiều cao bóng để bóng ôm lấy chân thay vì lệch xuống; `SOURCE` đi kèm hằng `PAL_ID` (đọc `index.json` cần id loài).
- `shots` không chạy `--name before` (xem trên), nên không có đường dẫn ảnh so sánh trước/sau.

## Kiểm thử vòng 1 (T13 Phần A): PASS
- typecheck ✓   test ✓ (38 file, 531 test; `scripts/pwaManifest.test.mjs` 5/5)   build ✓   e2e ✓ (56, cổng 2567/5173 trống)   photo3d (không chạy, không đụng)
- Tiêu chí hoàn thành Phần A:
  - [x] `git diff packages/client/index.html` chỉ thêm đúng 3 dòng (`icon`, `apple-touch-icon`, `apple-mobile-web-app-title`) ngay sau `<link rel="manifest">`; script canh tải inline không đổi (không có hash sha256 nào trong docs để so, chỉ PLAN nhắc cho CSP sau này).
  - [x] Manifest là JSON hợp lệ, đúng thứ tự khoá và nội dung PLAN: 192 any, 512 any, 192 maskable, 512 maskable; `sizes` khớp cỡ thật qua IHDR.
  - [x] `python3 scripts/appIcons.py` tất định: chạy lại, sha256 cả 5 file khớp. Bán kính thú maskable 0.364 ≤ 0.40.
  - [x] Bản build (`npm run play`): `/manifest.webmanifest` 200 `application/manifest+json`; 4 icon và `/apple-touch-icon.png` 200 `image/png`, byte khớp file.
  - [x] Đột biến 1: nâng chiều cao thú maskable lên 0.90 -> script `exit=1`, "pet radius 0.482 exceeds safe zone 0.4". Đột biến 2: manifest ghi `256x256` cho icon-192 -> test hỏng 2 ca ("expected '192x192' to be '256x256'" và ca thiếu 192 any). Đã hoàn nguyên cả hai; PNG và manifest về đúng byte cũ.
  - [x] Xem ảnh: icon maskable cắt tròn đẹp, thú gọn trong vòng, không bị cắt tai/chân/lửa; bản any và apple-touch cũng ổn, không có chữ.
- Ghi chú nhỏ (không chặn): khi vượt vùng an toàn, script đã ghi xong các file `any` trước khi `sys.exit` (không hại vì kết quả tất định). Trong e2e có log `MatchMakeError: too many worlds` là của test "a refused new world says why" (mong đợi).
- Test đã thêm: không (test của asset-manager đủ; đã mutation xác nhận bắt được).
