PASS
# REVIEW: T43 Server nén script và tài nguyên tĩnh (bản `.br`/`.gz` dựng sẵn, Express chọn theo `Accept-Encoding`), vòng 1

## Kết luận
Thay đổi làm đủ các bước và tiêu chí của PLAN.md, không thêm dependency, không đụng file bị cấm. Middleware chỉ tra khoá có sẵn trong danh mục lúc khởi động, nên không có đường thoát khỏi `dist`. `Vary`, ETag riêng cho từng bản, 304, HEAD, Range và đường rẽ về file gốc đều đúng và có test tích hợp đọc byte thật trên dây. Đã tự chạy lại: `npm run typecheck` sạch, 5 file test mới hoặc đã sửa xanh (112 test).

## Lỗi phải sửa
Không có.

## Đã kiểm, không thấy lỗi
- **Chọn encoding** (`packages/server/src/contentEncoding.ts`):
  - Bảng của Thiết kế 3 được test đủ, thêm hai ca `br;q=1.0, gzip;q=0.8, *;q=0.1` và `identity;q=0`.
  - Regex token và qvalue chạy tuyến tính, không có backtracking nặng.
  - Header lỗi chỉ làm bỏ mục đó, không ném lỗi.
  - Node gộp các header `accept-encoding` lặp lại thành một chuỗi.
- **Vary, ETag, 304, HEAD, Range** (`packages/server/src/webClient.ts`):
  - `res.vary` được đặt trước mọi nhánh, kể cả nhánh Range và nhánh trả file gốc.
  - Khi trả 304, `send` gỡ các header `Content-*` nhưng giữ `Vary`.
  - ETag yếu tính từ cỡ và mtime. Luật `keepVariants` (≤ 90% và br < gz) bảo đảm ba bản có cỡ khác nhau. Ràng buộc này được ghi rõ trong JSDoc ở cả hai phía.
  - `acceptRanges: false` cho bản nén.
  - Có test cho trường hợp `If-None-Match` của bản br gửi kèm yêu cầu gzip: kết quả là 200.
- **An toàn:**
  - `decodeURIComponent` được bọc `try`, kèm test `%E0%A4%A`.
  - `..%2f`, ký tự null và đường lạ không có trong danh mục nên đi thẳng `express.static` như trước. Dotfile bị loại ở cả lúc build lẫn lúc quét danh mục.
  - Giá trị `Content-Encoding` chỉ lấy từ tập cố định `br`/`gzip`, và `Content-Type` lấy từ đuôi của khoá trong danh mục, nên không chèn được header.
  - Mỗi request không tốn thêm CPU nén hay lời gọi `stat`.
  - Tải thẳng `x.js.br` vẫn nhận `application/gzip` hoặc octet-stream, không có Content-Encoding. Đúng như phạm vi kế hoạch.
- **Lỗi khi gửi file:**
  - Khi `ENOENT` hoặc `EISDIR`, `send` chưa đặt header nào. Callback gỡ `Content-Encoding` và `Content-Type` rồi `next()`, có test ca file nén bị xoá sau khi khởi động.
  - Khi `ECONNABORTED` hoặc header đã gửi, callback dừng luôn.
- **Service worker:**
  - `precacheUrls` loại `.br`/`.gz`, có test.
  - Script nén chạy sau khi `vite build` thoát, nên `closeBundle` của plugin service worker đã xong. Tester đã kiểm `dist/sw.js` không chứa `.br`/`.gz`.
  - `cache.match` theo chuỗi không bị `Vary: Accept-Encoding` cản.
  - `pwa.spec.ts` chạy trên bản build có nén và xanh, kèm bước (g).
- **Tách `index.ts` sang `http.ts`:**
  - `/healthz` và `/whoami` giữ nguyên code. `/whoami` vẫn đọc `worldSettings.trustProxy` theo tham chiếu mỗi request.
  - `guardWorldCreation` vẫn chạy sau `listen()` trong `index.ts`.
  - `http.test.ts` kiểm `/matchmake/create` trả 200 khi có cả guard lẫn middleware tĩnh, và kiểm `/whoami` qua `X-Forwarded-For`.
  - Hook `debug:*` vẫn chỉ đăng ký trong `GameRoom` khi `PETGAME_DEBUG === "1"`, không liên quan thay đổi này.
  - Callback `express` chạy trước khi `listen()` resolve: `http.test.ts` có kiểm `installed === 1`. Vì vậy log trong `index.ts` đọc được số file nén.
- **Build:**
  - Thứ tự `vite build && node ../../scripts/precompress.mjs dist` đúng, và lệnh chạy được với `cmd` trên Windows.
  - Script chạy lại cho kết quả idempotent: tester so md5 toàn bộ `dist` qua hai lần chạy.
  - Bản Docker được nén: `.dockerignore` không loại `scripts/`, script chỉ dùng module có sẵn của Node, và stage runtime chép cả `dist` gồm `.br`/`.gz`.
- **Ràng buộc:**
  - `package-lock.json`, `.claude/`, `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts` và `labelLayout.test.ts` không đổi.
  - Không có dependency mới. `git stash list` còn 2 mục.
- **Tài liệu:** `docs/architecture.md` (phần server và PWA), `docs/deploy.md` và `docs/design/multiplayer.md` khớp với code và số đo trong PROGRESS.md. Số đo cũ được ghi trong ngoặc.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
- `packages/server/src/webClient.ts` `serveClient`: hàm quét `dist` ba lần. Mỗi `precompressed(...)` quét một lần, rồi `findPrecompressed(dir).size` quét lại để đếm. Có thể cho `precompressed` nhận danh mục dựng sẵn, hoặc lấy số đếm từ danh mục gốc. Chỉ tốn lúc khởi động, không ảnh hưởng request.
- `scripts/precompressLib.mjs` `precompressDir`: hàm `readFileSync` mọi file trong `dist`, kể cả ảnh (khoảng 3 MB png và webp), chỉ để lấy cỡ file. Nên dùng `statSync` trước và chỉ đọc file đủ điều kiện nén.
- `scripts/precompressLib.mjs`: chất lượng brotli 11 và mức gzip 9 đang viết thẳng trong lời gọi. Nên đặt thành hằng `BROTLI_QUALITY`, `GZIP_LEVEL` cạnh `MIN_BYTES`/`MAX_RATIO`, đúng quy ước bảng hằng số. Rủi ro của kế hoạch có nhắc khả năng hạ brotli xuống mức 9.
- Regex `/\.(br|gz)$/` lặp lại ở `webClient.ts`, `precompressLib.mjs` (bản này không phân biệt hoa thường) và `swLogic.ts`. Trong server có thể suy ra regex từ `ENCODING_SUFFIX`. Cách so hoa thường giữa build và server đang lệch nhau, hiện vô hại.
- Phòng hờ ETag trùng: hiện tại ETag khác nhau chỉ nhờ luật build. Có thể cho `findPrecompressed` bỏ bản nén có cỡ bằng file gốc hoặc bằng bản kia ngay lúc khởi động, vì `stat` một lần lúc đó gần như không tốn gì. Khi đó server tự bảo vệ cả khi ai đó sửa luật build.
- Danh mục gốc `/` cũng chứa khoá `/build/*` với `max-age=0`. Nó chỉ được dùng khi mount `/build` đã rơi qua, tức file gốc mất mà bản nén còn. Khi đó bản nén vẫn được gửi, nhưng không có `immutable`. Đây là ca hiếm và vô hại, có thể ghi một dòng chú thích.
- Test còn thiếu nhưng không bắt buộc:
  - `findPrecompressed` bỏ qua dotfile và thư mục dot.
  - Request thẳng `/build/x.js.br` trả file thô, không có `Content-Encoding`.
  - `http.test.ts` kiểm thêm `vary` cho `/`.
- `packages/client/src/pwa/swLogic.ts`: dòng JSDoc mới của `precacheUrls` dài hơn hẳn các dòng xung quanh. Nên ngắt dòng.
- `docs/architecture.md`: mục công cụ và script chưa có dòng cho `scripts/precompress.mjs` và `precompressLib.test.mjs`. Hiện chúng chỉ được nhắc trong mục PWA.
- Ghi chú cho T16: khi chuyển e2e sang bản build, mọi test sẽ đi qua bản nén. Nên giữ bước (g) của `pwa.spec.ts`.
- Sau này: zstd khi Node có bản ổn định; cache dài cho `/assets/*` (cần tên có băm), như PLAN.md đã đề xuất.
