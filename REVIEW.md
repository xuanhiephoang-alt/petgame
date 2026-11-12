PASS
# REVIEW: T53 (server test GameRoom nghe ở cổng trống, làm nóng, hạn riêng có số đo), vòng 1

## Kết luận
Thay đổi làm đúng các bước 1-4 của PLAN.md, không thừa (bước 5 không cần, vì C qua). Nguyên nhân gốc (cổng 2568 cố định cộng `Server.listen` treo khi gặp `EADDRINUSE`) được sửa tận gốc bằng `listen(0)` và đọc lại cổng thật. Hai hạn `15_000` đều có số đo, không che một chỗ chậm thật nào và không nới điều kiện kiểm nào. Cả hai phép đột biến cho reviewer đều cho đúng kết quả mong đợi.

## Đã kiểm
- **`bootTestServer`** (`packages/server/src/rooms/GameRoom.test.ts:95-111`): đã đối chiếu với `@colyseus/testing` 0.18.6 (`index.ts`, `TestServer.ts`) và `@colyseus/core` `Server.ts`.
  - `defineServer` chuyển `greet` và `gracefullyShutdown` vào `new Server(...)`. `greet: false` bỏ banner; `gracefullyShutdown: false` không gọi `registerGracefulShutdown`, nên worker vitest không bị gắn trình bắt tín hiệu thoát. `devMode` mặc định là false, giống `boot()`.
  - `listen(0, "127.0.0.1")`: `Server.listen` gán `this.port = 0`, sau đó coder đọc cổng thật từ `transport.server.address()` và gán lại vào `server["port"]` trước khi tạo `new ColyseusTestServer(server)`. Constructor đọc `server['port']` để dựng cả `sdk` (`ws://127.0.0.1:<cổng>`) lẫn `http`, nên client nối đúng cổng thật.
  - `ColyseusTestServer` vẫn được import từ `@colyseus/testing`, nên phần vá `Room.ext.ts` vẫn được nạp.
- **Làm nóng:** `createRoom` rồi `cleanup()`. `cleanup` gọi `matchMaker.disconnectAll()`, nên phòng làm nóng bị huỷ trước test đầu tiên. Phòng này không có người chơi nên không mở store (`store()` lười), và `onDispose` chỉ dọn `liveSessions`. Không có trạng thái nào rò sang test sau.
- **`afterAll(() => colyseus?.shutdown())`:** đã thấy tận mắt trong đột biến 1. Khi hook hỏng, chỉ còn `EADDRINUSE` và "Hook timed out", không còn `TypeError` phụ. `afterEach` không có `?.` cũng không sao, vì vitest không chạy test (nên không chạy `afterEach`) khi `beforeAll` hỏng.
- **Hạn riêng:**
  - Test khí hậu tự chờ thật khoảng 4,5 s (một nhịp `CLIMATE_TICK_MS` rồi 50 tick), tester đo 4538-4573 ms. Hạn `15_000` chỉ để chặn treo; số tick và `expect` không đổi.
  - `worldgen`: chạy lại đo được 1440 ms khi máy rảnh. Với 3 thế giới, dưới tải nặng ước khoảng 4,9 s, vẫn sát 5 s, nên cần hạn riêng.
  - Cả hai con số khớp quy tắc "khoảng 3 lần thời gian xấu nhất đã đo". Không đổi `vitest.config.ts`.
- **`worldgen.test.ts`:** `generateWorld` không có cache (chỉ `defaultWorld` có), nên `expect(generateWorld(7)).toEqual(seven)` vẫn so hai lần sinh độc lập. Điều kiện "khác seed thì `props` khác nhau" vẫn giữ nguyên nghĩa.
- **`docs/architecture.md`:** mô tả đúng luật cổng trống, làm nóng và hạn riêng có số đo. Viết tiếng Việt, chú thích code viết tiếng Anh.
- **Phạm vi:** `git diff --stat` chỉ có `GameRoom.test.ts`, `worldgen.test.ts`, `docs/architecture.md` và `PROGRESS.md`. Typecheck sạch.
- **Đột biến 1** (`listen(2568, ...)` + hai lần chạy cùng lúc): lần sau hỏng như mong đợi, với `EADDRINUSE 127.0.0.1:2568`, `Hook timed out in 10000ms` và `121 skipped`. Đã hoàn tác; sha256 khớp bản gốc.
- **Đột biến 2** (bỏ làm nóng, chạy lẻ dưới tải 8 vòng lặp CPU trên 4 nhân):
  - Test khí hậu qua 3/3, vì hạn riêng tự đủ.
  - Để so sánh, `caught, a pack leader pays the catch XP...` mất 4698, 4784 và 4930 ms, so với 3719-3846 ms khi có làm nóng (số của tester). Vậy làm nóng thật sự gánh khoảng 1 s cho test đầu tiên.
  - Đã hoàn tác; sha256 khớp bản gốc; `git diff --stat` không đổi.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Góp ý không bắt buộc
- `GameRoom.test.ts:109`: `transport.server` có kiểu `http.Server | https.Server`, nên sau phép thu hẹp `typeof address !== "object"` thì `address` đã là `AddressInfo`. Vì vậy phép ép `as AddressInfo` và dòng `import type { AddressInfo } from "node:net"` là thừa, có thể bỏ.
- `worldgen.test.ts:11`: chú thích "~2 s in `npm test`" là số đo của bản sinh 4 thế giới. Có thể ghi "(4 worlds)" cho cả hai con số để khỏi hiểu nhầm.

## Việc tiếp theo đề xuất (cho agent chính thêm vào TASKS.md)
- **Mới, P2: test `boss movement > the boss wanders with its whole body and does not squeeze through a gap narrower than itself` chập chờn (có từ trước, không do T53).**
  - Ở đột biến 1, lần chạy cả file (song song với một vitest khác) hỏng với `expected 18.29967482189087 to be greater than or equal to 20` (`GameRoom.test.ts:776`).
  - Chạy lẻ thì qua: 4/4 khi máy rảnh, 4/4 dưới tải.
  - Nguyên nhân: khi trùm bị chặn, `stepWander` (`packages/server/src/ai/wander.ts:71-75`) chọn đích mới bằng `nearbyPoint(pos, Math.random)` trong vòng ±150 px. Trong 100 tick, trùm có thể đi ngẫu nhiên ngược về gần `C`.
  - Cách sửa theo kiểu T17: tiêm `random` hoặc seed cho não của trùm trong test (hoặc đặt `brain.idleMs` đủ dài sau khi bị chặn), để kết quả tất định. Không nới ngưỡng 20 px. Kiểm bằng chạy lặp.
- **T22:** bỏ phần về cổng, như PLAN.md đề xuất, vì T53 đã làm xong phần đó.
- **Mới, P3** (theo PLAN.md): `npm run dev`/`npm run play` treo im lặng khi cổng 2567 đã bị chiếm, vì `Server.listen` chỉ gắn `on('error')` sau khi đã nghe. Cách sửa: bắt lỗi trong `packages/server/src/index.ts`, in thông báo rõ rồi thoát với mã khác 0.
