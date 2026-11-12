PASS
# REVIEW: T64 Giới hạn số thế giới được tạo, vòng 1

## Kết luận
Thay đổi làm đủ các bước 1-12 và mọi tiêu chí trong PLAN.md, khớp `docs/design/multiplayer.md`. Ba chỗ lệch kế hoạch trong PROGRESS.md đều hợp lý. Tôi đã đối chiếu mã nguồn Colyseus 0.18.18 trong `node_modules`, cả `src` lẫn bản `build/*.mjs` chạy thật: cách gắn địa chỉ, chỗ chặn `invokeMethod` và sổ đếm đều đúng với mã thật, không chỉ đúng trên giấy. Chạy lại `worldLimits.test.ts`, `connection.test.ts` và `joinStatus.test.ts`: 53/53 qua. Không còn lỗi phải sửa; vài chỗ nên làm cứng thêm, ghi ở dưới.

## Lỗi phải sửa (FAIL khi còn mục này)
(không có)

## Đã xác minh

**Gắn địa chỉ (`x-real-ip`)**
- `Server.listen()` gọi `bindRoutes()` trong callback của `transport.listen`, trước `resolve()`. `bindRouterToTransport` gỡ app Express rồi `prependListener("request", cors+next)`.
- `guardWorldCreation` chạy ngay khi `await server.listen` xong, tức chỉ sau vài microtask và trước khi vòng sự kiện kịp nhận request nào. Nên thực tế không có khoảng hở (Rủi ro 5 của PLAN không xảy ra). `stamp` đứng đầu danh sách listener.
- `next` gọi `getRequest({ request: req })` một cách đồng bộ, và hàm này dùng `headers: request.headers` (better-call `adapters/node/request.mjs:74`). Nên header đã ghi đè được chép vào `Request`.
- `resolveClientIp` (`build/Transport.mjs:50`) đọc `x-real-ip` đầu tiên. Đường HTTP không truyền `remoteAddress`. Test "cannot be fooled…" là bằng chứng cho thứ tự listener: nếu `stamp` chạy sau thì `8.8.8.8` đã thắng.
- **WebSocket upgrade:** `stamp` không chạy cho sự kiện `upgrade`, nên `authContext.ip` phía WS vẫn lấy từ header client gửi (`buildAuthContext` trong ws-transport). Điều này không ảnh hưởng trần: WS chỉ dùng chỗ đã đặt, không tạo được phòng, và `GameRoom` không dùng `onAuth` hay IP của client. Xem góp ý 3.

**Chặn `invokeMethod`**
- Router gọi `matchMaker.controller.invokeMethod(...)` qua đúng object này, nên `this` vẫn là `controller` và lệnh kiểm `exposedMethods` gốc vẫn chạy.
- `matchMaker` chỉ có hai method tạo phòng là `create` và `joinOrCreate`; `joinOrCreate` đã bị gỡ. `join` không tạo phòng, nhưng vẫn gỡ vì nó ghép người lạ vào thế giới.
- Gọi `Create`, `createRoom` hay tên lạ khác đều không có trong `exposedMethods`, nên trả 520.
- `@colyseus/testing` dùng `joinById`, và `reconnect` không đổi.
- **Khi nâng Colyseus:** nếu `controller` bị đóng băng, hoặc `exposedMethods` không còn là mảng, thì server sập lúc khởi động. Đó là hỏng đóng, có ồn.
  - Nếu route thôi gọi `controller.invokeMethod` thì chặn mất im lặng (hỏng mở). Test tích hợp 5, 6 và 11 sẽ đỏ trong CI.
  - Lockfile ghim `colyseus` 0.18.9 và `@colyseus/core` 0.18.18. Chấp nhận như Rủi ro 2 của PLAN.

**Sổ đếm**
- `onCreate` ném lỗi: `opened` chưa chạy, vì nó là lệnh cuối và `onCreate` là hàm đồng bộ. Colyseus gọi `discardRoom`, phát `dispose`, rồi `#_dispose`, rồi `onDispose`. `closed(id lạ)` không làm gì.
- Phòng bị huỷ giữa `opened` và `settle` (ví dụ `releaseIfShuttingDown`, hay `recordRoom` trả `owner`): `onDispose` xoá phòng, và `settle` không gán phòng đã đóng. Đóng hai lần thì `Map.delete` không làm gì. Listener `dispose` là `once`.
- `opened` luôn chạy trước `settle` vì `handleCreateRoom` chờ `onCreate` xong. `pending` luôn được trả trong `finally`.
- Địa chỉ đi vào phòng qua `authContext.ip` mà `stamp` đã ghi đè, không qua `options` của client.

**Client**
- 429 được xét sau nhánh `unreachable` và trước 522. Hai thẻ mới có chữ đúng bảng trong `multiplayer.md`, và số phút tính từ `EMPTY_WORLD_HOLD_MS`.
- Không có `switch` nào khác trên `JoinFailure` cần thêm `case`.
- Các luồng T23, T42, T49 không đổi:
  - Tạo thế giới mới bỏ `room` trước khi gọi `enter()`;
  - thử lại lặng lẽ bỏ `room` trước khi tạo;
  - Thử lại sau `busy`/`tooMany` là tạo lại.
- Test e2e trả `origin` của trang kèm `allow-credentials`, đúng vì SDK gửi credentials. Yêu cầu `OPTIONS` vẫn đi tới server thật, và server trả 204 kèm CORS.

**`/whoami` và log**
- `/whoami` chỉ trả địa chỉ của chính người gọi. Listener CORS của Colyseus thêm `Access-Control-Allow-Origin: <origin>` cho mọi đường, nên trang khác đọc được `/whoami` của khách. Nhưng đó là địa chỉ mà trang ấy vốn đã biết, nên không lộ gì.
- Log không ghi IP: cảnh báo `X-Forwarded-For` in một lần, log chặn in tối đa một dòng mỗi 60 s, dòng khởi động chỉ in số.

**Cấu hình**
- `fly.toml` dùng `[http_service]` (bộ xử lý HTTP), và fly-proxy nối thẳng vào máy rồi thêm địa chỉ vào cuối `X-Forwarded-For`, nên `1` là đúng.
- Render chưa chắc (có thể có Cloudflare phía trước). Chú thích, cách kiểm bằng `/whoami` trong `deploy.md`, và chiều sai còn lại không hại người chơi là đủ cho vòng này (Rủi ro 1).
- `PETGAME_TRUST_PROXY` lấy mục thứ N tính từ cuối, giống `trust proxy` dạng số của Express.
- IPv6 gộp /64 đúng với `::`, IPv4 lồng trong IPv6, và zone. Dạng `::ffff:a.b.c.d` được bóc ra thành IPv4.
- Playwright đặt hai trần 1000 kèm chú thích; không test nào bị nới.

## Góp ý không bắt buộc
1. `packages/server/src/worldLimits.ts:202`: khi `clientAddress` trả `undefined`, code `delete` header `x-real-ip`. Colyseus khi đó rơi về `x-forwarded-for` rồi `x-client-ip` **của client**, nên khoá đếm do kẻ gửi chọn. Điều này trái ý "địa chỉ không xác định được gộp vào `unknown`, không được miễn" (PLAN Thiết kế 1).
   - Thực tế gần như không xảy ra, vì `remoteAddress` vẫn còn lúc có sự kiện `request`.
   - Sửa một dòng: `req.headers["x-real-ip"] = address ?? "unknown"`. `addressKey("unknown")` vẫn ra `"unknown"`. Đây là chỗ duy nhất hỏng theo hướng mở.
2. `worldLimits.ts:66`: IPv4 lồng trong IPv6 viết dạng hex (`::ffff:cb00:7105`) không được bóc, nên mọi địa chỉ dạng này rơi chung vào khoá `0:0:0:0::/64`. Node luôn viết dạng chấm và Fly cũng vậy, nên chỉ là làm cứng: nhận dạng tiền tố `0:0:0:0:0:ffff` sau khi mở rộng.
3. Ghi vào `docs/architecture.md` (mục `worldLimits.ts`) rằng `stamp` chỉ chạy cho `request`. `authContext.ip` và `client.ip` ở đường WebSocket upgrade vẫn lấy từ header client gửi, nên ai sau này dùng IP trong `onAuth` hay `onJoin` phải tự tính lại bằng `clientAddress`.
4. `worldLimits.ts:163-171`: các lần bị chặn sau dòng log đầu chỉ được in khi có lần chặn kế tiếp, mà lần đó có thể cách hàng giờ. Khi ấy chữ "in the last minute" sai. Sửa bằng cách in khoảng thời gian thật (`since Xs`), hoặc bỏ cụm "in the last minute".
5. `worldLimits.ts:126`: hàm `positiveInt` nhận cả 0 (cho `PETGAME_TRUST_PROXY`) nên tên và JSDoc chưa đúng; đổi thành `intFromEnv`.
6. Có thể cho `guardWorldCreation` tự kiểm lúc cài: `typeof controller.invokeMethod === "function"` và `exposedMethods` có `"create"`, sai thì ném lỗi rõ ràng. Như vậy lỗi khi nâng Colyseus lộ ra ngay lúc khởi động chứ không chờ tới CI.

## Việc mới cho TASKS.md
- **Kiểm `/whoami` sau lần deploy tới**, trên Fly và Render: dùng điện thoại 4G, rồi thử hai mạng khác nhau. Nếu Render ra địa chỉ của Cloudflare hay địa chỉ nội bộ thì nâng `PETGAME_TRUST_PROXY` (Rủi ro 1 của PLAN).
- **IPv6 làm trần cả server dễ bị chiếm** (thấp-trung bình): nhà mạng thường cấp /56 hoặc /48 cho mỗi thuê bao, nên một người có IPv6 có 256 khối /64 trở lên. Một máy nhà là đủ chiếm hết 50 chỗ và chặn mọi người tạo thế giới. Thiết kế đã chấp nhận "kẻ phá nhiều địa chỉ", nhưng chưa tính tới việc với IPv6 thì chỉ cần một người. Đề xuất thêm trần thứ hai theo /48 (ví dụ 20). Cần game-designer xét.
- **Dev và shots dùng trần 10 từ localhost:**
  - `npm run shots` tạo 8 thế giới trong vài phút (2 + 3 + 3), sát trần; thêm một cảnh nữa là hỏng.
  - `npm run dev` mà mở nhiều tab hay bấm Tạo thế giới mới liên tục thì gặp 429.
  - Đề xuất: `scripts/shots.mjs` và `scripts/dev.mjs` đặt `PETGAME_MAX_WORLDS_PER_ADDRESS` cao như `playwright.config.ts`.
- **Gom các góp ý 1, 2, 4, 5, 6** vào một việc nhỏ "làm cứng worldLimits".
