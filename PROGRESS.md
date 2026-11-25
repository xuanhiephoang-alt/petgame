# PROGRESS: T43 Server nén script và tài nguyên tĩnh

## Vòng 1: coder
- [x] Bước 1: `scripts/precompressLib.mjs` (luật nén, `shouldCompress`, `keepVariants`, `precompressDir`, `formatSummary`), test `scripts/precompressLib.test.mjs`.
- [x] Bước 2: `scripts/precompress.mjs` (CLI, thoát mã 1 khi lỗi).
- [x] Bước 3: `packages/client/package.json`: `"build": "vite build && node ../../scripts/precompress.mjs dist"`.
- [x] Bước 4: `packages/client/src/pwa/swLogic.ts` (`precacheUrls` bỏ `.br`/`.gz`) và `swLogic.test.ts`.
- [x] Bước 5: `packages/server/src/contentEncoding.ts` + `contentEncoding.test.ts` (mọi dòng bảng Thiết kế 3).
- [x] Bước 6: `packages/server/src/webClient.ts` + `webClient.test.ts` (14 ca của kế hoạch, qua `node:http`).
- [x] Bước 7: `packages/server/src/http.ts` + `http.test.ts` (`/whoami` kể cả trustProxy 1, `/healthz`, `/` nén, `/matchmake/create` 200, không có dist).
- [x] Bước 8: `packages/server/src/index.ts` chỉ gọi `installRoutes`, log số file có bản nén.
- [x] Bước 10: `tests/e2e/pwa.spec.ts`: bước (g) kiểm `encodedBodySize * 2 < decodedBodySize` của chunk entry.
- [x] Bước 11: đo (bảng dưới).
- [x] Bước 12: tài liệu: `docs/architecture.md` (server và PWA), `docs/deploy.md`, `docs/design/multiplayer.md` (số đo mới, ghi cả số trước T43).
- Lệch kế hoạch:
  - `installRoutes`/`serveClient` nhận kiểu `Application` của Express thay vì `Express`: `defineServer({ express })` đưa vào `Application`, `Express` làm typecheck hỏng.
  - `findPrecompressed` bỏ qua thư mục không đọc được (trả rỗng) để `serveClient` không ném lỗi khi `dist` có mà `dist/build` thiếu.
  - Tổng byte trong `formatSummary` chỉ tính file đủ điều kiện nén (chữ, >= 1 KiB), không tính ảnh; nên "1,10 MB" là tổng file chữ.
  - Lượt đo "chỉ gzip": `Network.setAcceptedEncodings` không có trong Chromium này; thay bằng `Network.setExtraHTTPHeaders` với `Accept-Encoding: gzip, deflate` (có hiệu lực, `content-encoding: gzip` xác nhận).
- Lệnh đã chạy: typecheck ✓, test ✓ (706 test, 47 file), build ✓ (in `precompressed 16 files: 1.10 MB -> br 289 kB, gzip 337 kB`), e2e ✓ (63 passed, `boss bar (phone upright, notch)` không flake lần này; không phải chạy lại). `package-lock.json` và mọi `package.json` dependency không đổi. `dist/sw.js` không chứa `.br`/`.gz`; chạy lại `precompress.mjs` trên cùng `dist` cho cùng kết quả.

### Đo (Chromium của container, `serviceWorkers: "block"`, cache tắt, `?quality=low`, tới khi `#join-btn:enabled`)

Byte là tổng `encodedDataLength` của các `loadingFinished` tới localhost (11 file của sảnh; lượt 4G tốt/không giới hạn đôi khi đếm thêm vài file tải sau khi nút mở, nên số byte ở hai hàng nhanh nhất nhiễu, đọc các hàng 4G chậm, 3G, 3G chậm). Chrome trên `http://localhost` nhận `br`.

| Mạng | Trước (không nén): byte, giây | Sau (Chrome chọn br): byte, giây | Sau, chỉ gzip: byte, giây |
|---|---|---|---|
| 4G chậm (1,6 Mbps, 150 ms) | 1 020 711, 5,5 | 282 970, 2,0 | 323 371, 2,0 |
| 3G (750 kbps, 300 ms) | 1 020 711, 11,7 | 282 970, 4,2 | 323 371, 4,2 |
| 3G chậm (400 kbps, 400 ms) | 1 020 711, 21,4 | 278 142, 6,8 | 323 371, 7,8 |
| 4G tốt (10 Mbps, 50 ms) | (nhiễu) 1,4 | 0,4 | 0,9 |
| không giới hạn | 0,2 | 0,2 | 0,2 |

- 3G chậm: 21,4 s xuống 6,8 s (br) / 7,8 s (gzip), byte giảm 3,7 lần (br) / 3,2 lần: đạt tiêu chí (<= 8,5 s, giảm >= 2,5 lần).
- Chunk entry: 708 188 B gốc, 188 482 B br, 223 495 B gzip (curl với `Accept-Encoding: br`, `gzip`, không có header; Content-Type `text/javascript; charset=utf-8` cả ba).
- Thời gian build: `vite build` trơn ~9,2 s lần đầu (lạnh); `npm run build` có nén ~2,2 s ở lần đo sau (Vite nóng) trong đó bước nén thêm khoảng 1-2 s; không đo lại đối chứng nóng.
- Log server: `Serving web client from .../dist (16 files precompressed)`; trước khi build có nén: `(no precompressed files: build with npm run build)`.
- Script đo để ngoài repo (scratchpad), đã tắt server cổng 4599 và Chromium.

## Kiểm thử vòng 1 (T43): PASS
- typecheck ✓   test ✓ (47 file, 706 test)   build ✓ (16 file nén: 1,10 MB -> br 289 kB, gzip 337 kB)   e2e ✓ (63, không có test nào chập chờn; `pwa.spec.ts` bước (g) xanh)   photo3d (không chạy)
- Build: `.br` và `.gz` cạnh mọi file chữ >= 1 KiB (32 file nén, không mồ côi, không có cho png/webp); `dist/sw.js` không có `.br`/`.gz`; chạy lại `precompress.mjs` và `npm run build` lần nữa cho md5 toàn bộ `dist` y hệt.
- Server thật (`PORT=4599 npm start --workspace=@petgame/server` trên `dist`), bằng curl: `br, gzip` -> `Content-Encoding: br`, `text/javascript`, `Vary: Accept-Encoding`, Content-Length 188482; `gzip` -> gzip 223495; không header và `identity` -> bản gốc 708188; giải nén br/gzip khớp từng byte; ETag khác nhau cả ba (`2e042`, `36907`, `ace5c`); `If-None-Match` đúng ETag br -> 304, ETag br gửi cho yêu cầu gzip -> 200; HEAD ra header của bản br, không thân; `Range: bytes=0-99` -> 206 trên file gốc, không Content-Encoding, `Content-Range 0-99/708188`, 100 byte đúng; `/build/*` `public, max-age=31536000, immutable`, `/` và `/sw.js` `max-age=0`; `/whoami`, `/healthz`, `POST /matchmake/create/world` (200) chạy; đường lạ 404 như cũ.
- Đột biến (khôi phục từ bản sao, đã diff khớp): bỏ `res.vary` -> 3 test hỏng; bỏ nhánh Range -> `serves a Range from the original file` hỏng; bỏ `res.type` hoặc đặt `.br` -> 2 test hỏng (brotli, trang sảnh); `precacheUrls` nhận `.br/.gz` -> `lists the page, the manifest...` hỏng; MAX_RATIO 1 hoặc bỏ giới hạn -> 3 test hỏng; bỏ `br < gz` -> 1 test hỏng. Không cần thêm test.
- Ràng buộc: không đổi `multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json`; chỉ `packages/client/package.json` đổi dòng script build (không dependency mới); `git stash list` còn 2 mục.
- Test đã thêm: không (test của coder đã bắt mọi đột biến).
