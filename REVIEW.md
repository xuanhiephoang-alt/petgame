PASS
# REVIEW: T66 `npm run shots`/`npm run dev` chạm trần thế giới; làm chắc `worldLimits`, vòng 1

## Kết luận
Thay đổi làm đủ 10 bước và các tiêu chí của PLAN.md, không đụng file ngoài phạm vi (`git diff --stat` chỉ 8 file: 2 script, `worldLimits.ts` và test, 3 tài liệu, PROGRESS.md). Làm chắc đúng hướng hỏng đóng: thiếu địa chỉ socket thì ra khoá `unknown` chứ không lấy header; Colyseus đổi dạng thì server không khởi động. Đã kiểm chứng bằng chạy thật. Không có lỗi phải sửa.

## Lỗi phải sửa
(không có)

## Đã kiểm chứng
- **`clientAddress`/`stampClientAddress` và khoá `"unknown"`:**
  - Không có `remote` thì trả `undefined` trước khi đọc header. `stampClientAddress` luôn ghi `x-real-ip`, nên `resolveClientIp` của Colyseus (`@colyseus/core/build/Transport.mjs:48-50`, đọc `x-real-ip` trước) không bao giờ rơi về `x-forwarded-for`/`x-client-ip` do client gửi.
  - Dùng chung một khoá `unknown` là chấp nhận được. `socket.remoteAddress` chỉ là `undefined` khi handle của socket đã mất trước sự kiện `request`, tức client đã cắt kết nối. Khi đó phản hồi cũng không về tới ai. Trên Fly/Render, đầu kia của TCP là proxy giữ kết nối, nên trường hợp này thực tế gần như không xảy ra.
  - Kẻ phá cố tình rơi vào `unknown` cũng chỉ lấp được 10 chỗ của chính khoá đó. Hắn không được miễn trần và không tạo được nhiều thế giới hơn so với dùng địa chỉ thật.
  - Server không nghe Unix socket (PORT là số), nên không có trường hợp mọi yêu cầu đều thành `unknown`.
- **`addressKey`:**
  - Đã chạy thử các dạng sau, kết quả đúng PLAN: `::ffff:cb00:7105%eth0` và `0000:…:FFFF:CB00:7105` ra `203.0.113.5`; `::FFFF:1.2.3.4` ra `1.2.3.4`.
  - Các dạng sau gộp /64, đúng mục "KHÔNG làm": `::ffff:0:1.2.3.4` (SIIT), `::1.2.3.4`, `64:ff9b::1.2.3.4` và `2001:db8::ffff:1.2.3.4`.
  - Chuỗi hỏng (`::ffff:1.2.3.4:5`, `[::1]`, `%eth0`) trả nguyên chuỗi như trước T66.
  - Chi phí: `ipv6Groups` chỉ chạy sau khi `isIPv6` đúng, tức chuỗi ≤ 45 ký tự. Với chuỗi 16 KB (trần header của Node), `isIPv6`/`isIPv4` mất ≤ 0,001 ms; `split("%")` trên 16 000 dấu `%` mất 0,24 ms; `clientAddress` với `X-Forwarded-For` 4000 mục mất 0,29 ms. Tất cả tuyến tính, không có ReDoS.
- **`RefusalLog`:** câu in khớp từng ký tự với PLAN 2c. Khoảng thời gian in ra là từ lần chặn đầu chưa in tới `now`, nên luôn đúng và không âm: `firstAt` luôn nhỏ hơn `loggedAt + REFUSAL_LOG_MS`, mà câu chỉ được in khi `now` đã vượt mốc đó. Class thuần, nhận `now` từ ngoài; đồng hồ là `Date.now()` trong `noteRefusal` (xem góp ý).
- **Kiểm dạng controller lúc khởi động:**
  - Lần kiểm đứng trước `prependListener`, việc đổi `exposedMethods` và bọc `invokeMethod`, nên không cài nửa chừng. Test kiểm số listener và `invokeMethod` không đổi sau cả ba trường hợp hỏng.
  - Đã chạy `index.ts` thật với một preload gỡ `"create"` khỏi `exposedMethods`. Server in rõ lỗi `guardWorldCreation: matchMaker.controller no longer has invokeMethod() and exposedMethods …` kèm stack, rồi thoát với mã 1. Lỗi đi qua handler `uncaughtException` của Colyseus, `gracefullyShutdown` rồi `process.exit(1)`.
  - Kết luận: hỏng đóng, có ồn, server không bao giờ chạy mà thiếu trần.
- **Scripts:**
  - `dev.mjs` chỉ đưa `env` riêng cho `@petgame/server`; client nhận `process.env` như cũ. Dùng `??`, nên giá trị đã đặt được giữ.
  - `shots.mjs` ép `"1000"`.
  - Không chỗ nào dùng cú pháp shell, nên chạy được trên cả Windows lẫn POSIX: biến đi qua option `env` của `spawn`, giữ `shell: win32` như cũ.
  - `package.json` (`play`, `start`, `dev:server`), `playwright.config.ts`, `Dockerfile`, `fly.toml`, `render.yaml` và `WORLD_LIMITS` không đổi.
- **Tài liệu:**
  - Đã đối chiếu câu cảnh báo WebSocket với `@colyseus/ws-transport` (`buildAuthContext` dùng `req.headers` của `upgrade`, listener `stamp` không chạy cho sự kiện này): đúng.
  - `GameRoom` không dùng `onAuth` hay `client.ip` (grep rỗng), nên câu "hiện không sao" đúng.
  - Câu thêm về `dev:server` trong `deploy.md` cũng đúng.
- **Test:**
  - Dòng sửa trong "clamps…" là siết luật, không phải nới. `(undefined, "2.2.2.2", 2)` trước mong `"2.2.2.2"`, nay test mới mong `undefined`. Phần clamp vẫn được phủ bằng `("10.0.0.1", "2.2.2.2", 3)` ra `"2.2.2.2"`.
  - Đã chạy lại `worldLimits.test.ts`: 37/37 qua. `tsc -p packages/server` sạch.
  - Mục grep `"in the last minute"` của PLAN còn đúng 1 dòng: `not.toContain` trong test do chính PLAN yêu cầu. Code sản phẩm không còn chuỗi này, nên chấp nhận.

## Góp ý không bắt buộc
- `worldLimits.ts:194`: `noteRefusal` lấy giờ bằng `Date.now()`, là đồng hồ tường. Nếu đồng hồ máy lùi (NTP sửa giờ sau khi khởi động), dòng log bị chặn sẽ im cho tới khi đồng hồ chạy qua mốc cũ. Số đếm không mất, chỉ in muộn. Dùng `performance.now()` sẽ đơn điệu, và `RefusalLog` không phải sửa.
- `RefusalLog.note`: khi n > 1 mà các lần chặn sát nhau ngay trước mốc 60 s, câu có thể ra "in the last 0 s". Dùng `Math.max(1, …)` hoặc `Math.ceil` sẽ dễ đọc hơn. Ngoài ra, có 1 thế giới mở thì câu in "1 worlds open". Cả hai đều là chữ trong log, không ảnh hưởng hành vi.
- `docs/architecture.md`: câu "IPv4 viết dạng IPv6 dạng chấm hay hex tính như IPv4" nên ghi rõ là chỉ `::ffff:…` (IPv4-mapped), như `multiplayer.md` đã ghi. `::a.b.c.d` và NAT64 vẫn gộp /64.
- `docs/deploy.md`: ví dụ `PETGAME_MAX_WORLDS_PER_ADDRESS=2 npm run dev` là cú pháp POSIX. Có thể thêm cách đặt biến trên Windows (`set …` hoặc `$env:…`).
- `scripts/shots.mjs` chạy server với `stdio: "ignore"`, nên nếu server dừng vì lần kiểm controller mới, người chạy shots không thấy thông báo, chỉ thấy chờ `/healthz` thất bại. Vấn đề này có từ trước T66. Có thể in stderr của server khi `/healthz` không lên.
- `addressKey` trả nguyên chuỗi không phải IP làm khoá. Điều này chỉ khai thác được khi `PETGAME_TRUST_PROXY` đặt cao hơn số proxy thật, đã có trong `deploy.md`, và có từ trước. Nếu muốn chặt hơn, có thể gộp mọi chuỗi không phải IP vào `unknown` (cân nhắc cùng T67).
