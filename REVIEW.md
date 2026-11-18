PASS
# REVIEW: T13 Phần A (icon app, manifest, thẻ `<head>`), vòng 1

## Kết luận
Phần A làm đủ A1-A6 và đúng mọi tiêu chí hoàn thành. Không có thay đổi ngoài phạm vi. Manifest, 3 thẻ `<head>` và 5 PNG đều đúng. Script tất định: tôi chạy lại vào scratchpad và `cmp` khớp từng byte với cả 5 file. Chỗ đổi không chạm tới bộ canh tải T15 hay hành vi iOS. Không có lỗi phải sửa.

## Đã kiểm
- **Manifest** (`packages/client/public/manifest.webmanifest`): đúng thứ tự khoá A3.
  - `id: "/"` trùng với id mặc định Chrome tự tính từ `start_url` `/`. Vì vậy app đã cài trước T13 không bị coi là app khác.
  - `scope: "/"` bao trùm `start_url`. `lang: "vi"`, `dir: "ltr"`.
  - `description` tiếng Việt khớp `MAX_PLAYERS = 5` (`packages/shared/src/constants.ts`).
  - `purpose` để riêng `"any"` và `"maskable"`, không gộp `"any maskable"`. Cách này đúng.
  - Không đổi `start_url`, `display`, `orientation` và hai màu. `#1b2a1b` vẫn khớp `<meta name="theme-color">` và nền `body`.
- **`index.html`:** `git diff` chỉ có 3 dòng ngay sau `<link rel="manifest">`, và script canh tải không đổi.
  - Bộ canh tải chỉ phản ứng với `HTMLScriptElement` hoặc `ErrorEvent` cùng origin. Một `<link rel="icon">` hỏng không phát ra loại nào trong hai, nên không thể làm nó báo sai.
  - `apple-mobile-web-app-capable` và `status-bar-style` không đổi. Trong `dist/index.html`, Vite giữ nguyên các đường dẫn `/icons/...` và `/apple-touch-icon.png`. `dist/icons/` có đủ 4 file.
- **Icon:** tôi đã xem từng file và phóng to phần tai, chân.
  - Cỡ đúng: 192, 512, 192, 512, 180.
  - Kênh alpha của 2 icon maskable và `apple-touch-icon.png` là (255, 255), tức kín hoàn toàn. Bản `any` có góc trong suốt (alpha 0).
  - Bán kính xa nhất của thú trong icon maskable là 0,364·S, dưới mức 0,40. Ảnh cắt tròn không mất tai, lửa hay chân, và không có chữ.
- **Script** (`scripts/appIcons.py`):
  - Hằng số `UPPER_SNAKE_CASE` đặt ở đầu file, docstring tiếng Anh.
  - Đọc `views` trong `index.json` và tính `floor(W / n)` giống `palSprites.ts`.
  - Kiểm vùng an toàn trên ảnh 1024 trước khi thu nhỏ, và kiểm alpha < 255 cho mọi icon không phải `any`.
  - Chạy được với Pillow 12.3, numpy 2.5, Python 3.13.
- **Test** (`scripts/pwaManifest.test.mjs`): 5/5 qua. Tôi đã chạy lại.
  - Phủ đủ 4 ca của A5. Cỡ thật đọc từ IHDR và có kiểm chữ ký PNG.
  - Tester đã thử đột biến (`256x256`) và test bắt được.
- **Dung lượng repo:** 5 PNG tổng khoảng 408 kB, chấp nhận được (thư mục `public/assets` đã 2,8 MB). Icon không vào danh sách lưu sẵn của service worker (bảng định tuyến luật 7), nên không làm nặng thêm lần cài.
- **CREDITS:** dòng mới đúng nguồn (dựng từ `pals/emberpup.webp`, ảnh AI của dự án đã ghi ở dòng trên) và đúng giấy phép "Thuộc dự án". Không có asset ngoài nào mới.
- **Phạm vi:** `multiplayer.spec.ts`, `labelLayout.ts` và `labelLayout.test.ts` không đổi; `git stash list` vẫn 2 mục. Không file mới nào bị `.gitignore` bỏ qua.
- **Sẵn sàng cho T13b:**
  - Đường dẫn icon (`/icons/**`, `/apple-touch-icon.png`) khớp luật 7 (bỏ qua) của bảng định tuyến.
  - Manifest khớp luật 6 (mạng trước).
  - Phần (a) của e2e `pwa.spec.ts` có thể dựa vào đúng 4 icon và file 180 px này.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc
- `docs/art-style.md`, mục "Icon app": câu "có bóng mềm dưới chân" đọc như áp cho mọi icon. Thực tế `render_master` chỉ vẽ bóng khi `feet is not None`, nên 2 icon maskable không có bóng. Đây là lựa chọn hợp lý vì thú nằm giữa ảnh. Nên ghi rõ "(bản `any` và apple-touch)", hoặc nhắc trong docstring.
- `scripts/appIcons.py:24-26`: `SOURCE` và `PAL_ID` phải sửa cùng nhau, còn docstring dòng 12 chỉ nói "change SOURCE". Nên suy ra `SOURCE = PUBLIC / "assets" / "pals" / f"{PAL_ID}.webp"`, để đổi thú chỉ còn sửa một hằng. Sửa docstring và `docs/art-style.md` theo.
- `scripts/appIcons.py:119-134`: khi một icon maskable vượt vùng an toàn, script vẫn ghi đè các file khác rồi mới `exit 1`. Đổi sang dựng và kiểm cả 5 ảnh trước, chỉ ghi file khi tất cả qua, để không bao giờ để lại bộ icon lẫn bản cũ và bản mới.
- Viền lốm đốm sáng quanh thú: phóng to tai và chân của `icon-maskable-512.png` thấy một viền xám nhạt lốm đốm. Đó là pixel bán trong suốt sót lại khi tách nền ảnh gốc, bị phóng to khoảng 2,7 lần ở khung 1024. Ở cỡ hiển thị thật trên điện thoại gần như không thấy, nên không chặn. Nếu muốn sạch hơn: trong `load_pet`, bỏ pixel có alpha ≤ `ALPHA_THRESHOLD` (đặt alpha 0), hoặc khử màu viền trước khi phóng to.
- Dung lượng: lưu 3 icon kín ở dạng `RGB` thay vì `RGBA` (kiểm alpha trước rồi `convert("RGB")`) giảm khoảng 10-13%. Tôi đo được maskable-512 giảm từ 141 541 xuống 123 639 byte. Không cần thiết.
- `scripts/pwaManifest.test.mjs:51`: regex `hrefOf` chỉ khớp khi `rel` đứng trước `href`. Hiện đúng với `index.html`; nếu sau này đổi thứ tự thuộc tính, test sẽ báo "không có thẻ" thay vì lỗi rõ ràng. Có thể ghi một dòng chú thích.
- T13b: e2e (a) sẽ cần đọc IHDR lần nữa. Một hàm vài dòng chép tạm trong `pwa.spec.ts` là chấp nhận được; gom lại cùng helper ở T16.
