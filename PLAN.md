# PLAN: T66 `npm run shots`, `npm run dev` chạm trần thế giới; làm chắc `worldLimits`

Đọc code ở HEAD `ba6d5e2`. Nguồn là `REVIEW.md` của T64 (commit `004f6ac`): mục "Việc mới" (dev/shots) và các góp ý 1-6. Luật chơi không đổi; đây là việc kỹ thuật và tài liệu.

File liên quan:
- `scripts/dev.mjs`: chạy song song `npm run dev` của server và client. Hiện không truyền `env`, nên server nhận `process.env`.
- `scripts/shots.mjs`: dòng 36-39 spawn server với `env: { ...process.env, PORT, PETGAME_DEBUG, PETGAME_DB }`.
- `playwright.config.ts`: dòng 19-21, mẫu cần làm theo (chú thích và hai trần 1000).
- `packages/server/src/worldLimits.ts`:
  - `clientAddress` dòng 25-38;
  - `addressKey` dòng 60-68;
  - `positiveInt` dòng 126-132;
  - `noteRefusal` dòng 153-172;
  - `stamp` trong `guardWorldCreation` dòng 193-205.
- `packages/server/src/worldLimits.test.ts`.
- `packages/server/src/index.ts` dòng 40-44: gọi `guardWorldCreation`, in dòng "World limits: …". **Không phải sửa.**
- Tài liệu: `docs/architecture.md` dòng 42 (mục `worldLimits.ts`) và dòng 89 (mục test); `docs/deploy.md` mục "Giới hạn số thế giới và proxy"; `docs/design/multiplayer.md` dòng 54.

## Mục tiêu

- Người làm game chạy `npm run shots` (8 thế giới trong vài phút từ 127.0.0.1) hay `npm run dev` (nhiều tab, bấm Tạo thế giới mới liên tục) không gặp thẻ "Đã mở nhiều thế giới quá" (429).
- Bộ chặn thế giới không còn chỗ nào hỏng theo hướng mở: khi địa chỉ không xác định, không lấy header do client gửi.
- Lỗi khi nâng Colyseus phải lộ ra lúc khởi động server, không đợi tới CI.
- Log đúng sự thật. Tài liệu nói rõ chỗ địa chỉ vẫn giả được.

## Phạm vi

Làm:
1. `scripts/dev.mjs` và `scripts/shots.mjs` nâng trần mỗi địa chỉ cho server mà chúng tự chạy.
2. `worldLimits.ts`, gồm sáu việc:
   - (a) địa chỉ không tính được thì thành `"unknown"`;
   - (b) gỡ IPv4 lồng trong IPv6 viết dạng hex;
   - (c) sửa câu log về số lần bị chặn;
   - (d) đổi tên `positiveInt`;
   - (e) kiểm `matchMaker.controller` lúc cài;
   - (f) `clientAddress` không dùng header khi thiếu địa chỉ socket. Đây là cùng lỗi với (a), xem Thiết kế 2a.
3. Test unit cho từng mục trong `worldLimits.test.ts`.
4. Cập nhật tài liệu.

KHÔNG làm:
- Không đổi `npm run play`, `npm start`, `Dockerfile`, `fly.toml`, `render.yaml` hay `WORLD_LIMITS`: bản thật giữ trần thật (50 và 10).
- Không nâng `PETGAME_MAX_WORLDS` trong dev/shots (lý do ở Thiết kế 1).
- Không thêm trần /48 cho IPv6: đó là T67.
- Không sửa `stamp` cho đường WebSocket `upgrade`: chỉ ghi tài liệu (mục 7).
- Không nhận NAT64 (`64:ff9b::/96`), IPv4-compatible (`::a.b.c.d`) hay SIIT (`::ffff:0:a.b.c.d`). Những dạng này vẫn gộp theo /64 như IPv6 thường.
- Không đổi schema, message hay `Profile`. Không sửa client.

## Thiết kế

### 1. Trần trong dev và shots

| Lệnh | `PETGAME_MAX_WORLDS_PER_ADDRESS` | `PETGAME_MAX_WORLDS` | Cách truyền |
|---|---|---|---|
| `npm run dev` | `1000`, trừ khi người chạy đã tự đặt biến này | giữ 50 | `scripts/dev.mjs` truyền `env` riêng cho tiến trình server |
| `npm run shots` | luôn `1000` | giữ 50 | thêm vào object `env` của `spawn` server, giống `PETGAME_DB` |
| `npm run test:e2e` | 1000 (giữ nguyên) | 1000 (giữ nguyên) | `playwright.config.ts` |
| `npm run play`, `npm start`, deploy | 10 | 50 | không đổi |

Lý do:
- **Truyền qua script Node, không qua `package.json`.** Đặt biến trong chuỗi lệnh npm (`VAR=1 tsx ...`) không chạy trên Windows, mà repo không có `cross-env`. `dev.mjs` vốn tồn tại để chạy được trên mọi hệ điều hành.
  - `npm run dev --workspace=@petgame/server` truyền `process.env` của nó xuống `tsx watch`, rồi xuống tiến trình server. Mỗi lần tsx khởi động lại server, biến vẫn còn.
  - Hệ quả: `npm run dev:server` (gọi thẳng workspace, không qua `dev.mjs`) vẫn giữ trần 10. Chấp nhận được, và ghi vào tài liệu.
- **Dev dùng `??`, shots ép cứng.**
  - Dev: người làm game có thể muốn thử thẻ 429 bằng tay, ví dụ `PETGAME_MAX_WORLDS_PER_ADDRESS=2 npm run dev`, nên giá trị đã đặt sẵn phải được giữ.
  - Shots là bộ chụp cố định giống e2e: nó đã ép `PETGAME_DB` và `PETGAME_DEBUG`, nên cũng ép trần để kết quả không phụ thuộc shell.
- **Chỉ nâng trần mỗi địa chỉ.**
  - Hai lệnh này chỉ có một địa chỉ (127.0.0.1, hoặc thêm vài điện thoại trong LAN, mỗi máy một địa chỉ riêng) và tạo tối đa vài chục thế giới. Trần 50 của cả server không bao giờ bị chạm, mà vẫn giữ máy dev khỏi bị một vòng lặp lỗi mở hàng trăm thế giới.
  - Playwright nâng cả hai vì e2e chạy nhiều worker song song.
  - Số 1000 giống `playwright.config.ts` để chỉ có một "số dev" trong repo.
- `.mjs` không import được `@petgame/shared` (TypeScript) khi không có tsx, nên dùng chuỗi `"1000"` kèm chú thích trỏ tới `playwright.config.ts`.

### 2. Làm chắc `worldLimits.ts`

**2a. Địa chỉ không xác định (góp ý 1, và cùng lỗi trong `clientAddress`)**
- Hiện tại, khi `clientAddress` trả `undefined`, `stamp` xoá `x-real-ip`. Colyseus khi đó rơi về `x-forwarded-for`/`x-client-ip` **của client**, tức kẻ gửi tự chọn được khoá đếm.
- Mới: luôn ghi `req.headers["x-real-ip"] = address ?? "unknown"`. `addressKey("unknown")` trả `"unknown"`, đúng ý PLAN T64: "không xác định thì gộp vào `unknown`, không được miễn".
- `clientAddress` cũng có một chỗ hở cùng loại.
  - Khi thiếu `remote` (socket đã đóng), chuỗi mất mục cuối mà proxy gần nhất lẽ ra phải là. Khi đó `trustProxy = 0` vẫn trả mục cuối của `X-Forwarded-For` do client gửi, ví dụ `clientAddress(undefined, "9.9.9.9", 0) === "9.9.9.9"`, trái với JSDoc ("With 0 the header is ignored").
  - Mới: không có `remote` (rỗng hoặc `undefined`) thì trả `undefined` ngay, không đọc header.
  - Lý do: không biết ai nối vào thì không biết mục nào của header là do proxy ghi, nên mục nào cũng có thể là giả. `/whoami` khi đó in `"?"`, như hiện nay.
- Để test được mà không cần socket thật, tách phần ghi header ra hàm export:
  ```ts
  /** Overwrites `x-real-ip` (the header Colyseus reads first) with the address computed from the socket; "unknown" when there is none. */
  export function stampClientAddress(req: Pick<IncomingMessage, "headers" | "socket">, trustProxy: number): void
  ```
- `stamp` trong `guardWorldCreation` giữ phần cảnh báo `X-Forwarded-For` một lần, rồi gọi `stampClientAddress(req, settings.trustProxy)`.

**2b. IPv4 lồng trong IPv6 dạng hex (góp ý 2)**
- `addressKey`: bỏ regex `^::ffff:(\d+\.\d+\.\d+\.\d+)$`. Khi `isIPv6(text)`, lấy `g = ipv6Groups(text)`. Nếu `g[0..4]` đều bằng 0 và `g[5] === 0xffff`, trả IPv4 `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`; nếu không thì trả khoá /64 như cũ.
- `ipv6Groups` đã đổi đuôi dạng chấm thành hai nhóm, nên một nhánh phủ cả dạng chấm, dạng hex, chữ hoa và dạng viết đủ 8 nhóm.
- Kiểm: `0xcb00` = 203.0, `0x7105` = 113.5, nên `::ffff:cb00:7105` cho ra `203.0.113.5`.
- Sửa JSDoc của `addressKey`: "IPv4-mapped IPv6 (dotted or hex)".

**2c. Câu log (góp ý 4)**
- Hiện tại: lần chặn đầu được in ngay. Các lần sau trong 60 s chỉ được đếm, và chỉ in khi có lần chặn kế tiếp sau mốc 60 s. Lần đó có thể cách hàng giờ, mà câu in vẫn ghi "in the last minute".
- Mới: tách phần đếm thành một class thuần nhận `now` từ ngoài (giống `WorldCensus`), để test không cần giả đồng hồ:
  ```ts
  /** Rate-limits the refusal log: at most one line per REFUSAL_LOG_MS; refusals in between are counted into the next line. Pure. */
  export class RefusalLog {
    /** Counts one refusal at `now` (ms); returns the line to log, or undefined while the last line is younger than REFUSAL_LOG_MS. */
    note(refusal: WorldRefusal, now: number, openWorlds: number): string | undefined
  }
  ```
  - Trạng thái gồm: `count`, `counts: Record<WorldRefusal, number>`, `firstAt` (thời điểm lần chặn đầu tiên chưa in), `loggedAt` (khởi đầu `-Infinity`, để lần chặn đầu in ngay cả khi `now` nhỏ).
  - Hằng `REFUSAL_LOG_MS = 60_000` đặt ở đầu file, cạnh state cũ. Đây là nhịp log, không phải số cân bằng, nên không đưa vào `shared`.
  - Câu in, đúng từng ký tự (`n` là số lần chặn trong câu này, `s = Math.round((now - firstAt) / 1000)`):
    - `n === 1`: `World limits: refused 1 world creation (server S, address A); W worlds open`
    - `n > 1`: `World limits: refused N world creations in the last s s (server S, address A); W worlds open`
  - Sau khi in: đặt `loggedAt = now` và đưa các số đếm về 0.
- Module giữ một bản `const refusalLog = new RefusalLog()`. `noteRefusal` thành:
  ```ts
  const line = refusalLog.note(refusal, Date.now(), census.total()); if (line) console.warn(line);
  ```
- Vẫn không in địa chỉ.

**2d. Đổi tên (góp ý 5):** đổi `positiveInt` thành `intFromEnv`, JSDoc thành "A decimal integer in [min, max] from env, else `fallback` (with a warning when the variable was set to something else)". Ba chỗ gọi đổi theo. Hành vi không đổi.

**2e. Kiểm Colyseus lúc cài (góp ý 6)**
- Trong `guardWorldCreation`, ngay sau dòng kiểm `http` và **trước** `http.prependListener`, kiểm `matchMaker.controller`. Lỗi thì không cài gì nửa chừng:
  ```ts
  if (typeof controller?.invokeMethod !== "function" || !Array.isArray(controller.exposedMethods) || !controller.exposedMethods.includes("create")) {
    throw new Error(
      "guardWorldCreation: matchMaker.controller no longer has invokeMethod() and exposedMethods with \"create\" " +
        "(Colyseus changed?); the world caps cannot be installed. See worldLimits.ts.",
    );
  }
  ```
- `index.ts` không bắt lỗi này, nên server dừng lúc khởi động với thông báo rõ. Đó là hỏng đóng, có ồn.
- `const controller = matchMaker.controller;` chuyển lên trước dòng kiểm.
- Trong JSDoc của `guardWorldCreation`, thêm một câu nói về lần kiểm này.

### 3. Tài liệu (góp ý 3 và dev/shots)

**`docs/architecture.md`, dòng 42 (`worldLimits.ts`)**
- Thêm `stampClientAddress` và `RefusalLog` vào danh sách.
- Thêm câu: "Địa chỉ không xác định (socket không còn địa chỉ) ghi `x-real-ip: unknown`, không xoá header."
- Thêm câu: "`guardWorldCreation` kiểm `matchMaker.controller` lúc cài, sai dạng thì ném lỗi (server không khởi động)."
- Thêm câu cảnh báo: "Listener `stamp` chỉ chạy cho sự kiện `request` (HTTP), không chạy cho `upgrade` (WebSocket). Vì vậy `authContext.ip` và `client.ip` ở đường WebSocket vẫn lấy từ header client gửi, nghĩa là **vẫn giả được**. Hiện không sao vì `GameRoom` không dùng `onAuth` hay IP của client. Ai muốn dùng IP trong `onAuth`/`onJoin` phải tự tính lại bằng `clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], trustProxy)`."

**`docs/architecture.md`, dòng 89:** thay câu "e2e đặt hai trần lên 1000 trong `playwright.config.ts` vì mở nhiều thế giới từ 127.0.0.1" bằng: "e2e đặt hai trần lên 1000 (`playwright.config.ts`); `npm run shots` (`scripts/shots.mjs`) và `npm run dev` (`scripts/dev.mjs`, trừ khi đã tự đặt biến) đặt `PETGAME_MAX_WORLDS_PER_ADDRESS=1000`, vì đều mở nhiều thế giới từ 127.0.0.1; `npm run play` và `npm run dev:server` giữ trần thật."

**`docs/deploy.md`, sau bảng biến**
- Thêm một gạch: "`npm run dev` và `npm run shots` tự nâng `PETGAME_MAX_WORLDS_PER_ADDRESS` lên 1000 cho server chúng chạy (dev giữ giá trị nếu bạn đã đặt, để thử thẻ bị chặn: `PETGAME_MAX_WORLDS_PER_ADDRESS=2 npm run dev`). `npm run play` dùng trần thật."
- Sửa câu "Giá trị sai (không phải số nguyên dương)" thành "Giá trị sai (ngoài khoảng cho phép: hai trần là số nguyên ≥ 1, `PETGAME_TRUST_PROXY` từ 0 tới 9)".

**`docs/design/multiplayer.md`, dòng 54:** thêm vào cuối câu: "Địa chỉ IPv4 viết dạng IPv6 (`::ffff:…`, cả dạng chấm lẫn dạng hex) tính như IPv4. Server không biết địa chỉ thì mọi yêu cầu như vậy chung một khoá `unknown`, không được miễn."

## Kế hoạch triển khai

1. `scripts/dev.mjs`:
   - Trong `map`, truyền `env` cho tiến trình server:
     ```js
     env: workspace === "@petgame/server" ? { ...process.env, PETGAME_MAX_WORLDS_PER_ADDRESS: process.env.PETGAME_MAX_WORLDS_PER_ADDRESS ?? "1000" } : process.env
     ```
   - Thêm chú thích tiếng Anh: one developer opens many worlds from 127.0.0.1 (tabs, "Tạo thế giới mới"), same reason as `playwright.config.ts`; a value already set is kept so the 429 card can be tried by hand; `npm run play` keeps the real caps.
   - Sửa chú thích đầu file nếu cần.
2. `scripts/shots.mjs`, dòng 37: thêm `PETGAME_MAX_WORLDS_PER_ADDRESS: "1000"` vào `env`, kèm chú thích một dòng: shots opens 8 worlds from one address within minutes; the per-address cap is 10.
3. `worldLimits.ts`:
   - `clientAddress`: thêm `if (!remote) return undefined;` ở đầu hàm (2a). Bỏ `if (remote)` trước `chain.push(remote)`. Cập nhật JSDoc: "Without a socket address there is no address (the header alone could be anything)."
4. `worldLimits.ts`: thêm `stampClientAddress` (2a). `stamp` gọi hàm này thay cho hai dòng `delete`/gán.
5. `worldLimits.ts`: sửa `addressKey` theo 2b.
6. `worldLimits.ts`: thêm `REFUSAL_LOG_MS` và `RefusalLog` (2c). Bỏ `refusedSince`, `refusedLogAt` và `refusedCounts`, viết lại `noteRefusal`.
7. `worldLimits.ts`: đổi `positiveInt` thành `intFromEnv` (2d).
8. `worldLimits.ts`: thêm lần kiểm controller trong `guardWorldCreation` (2e).
9. `worldLimits.test.ts`: thêm và sửa test như mục Test.
10. Tài liệu: sửa theo Thiết kế 3.

Mỗi bước nhỏ. Làm cả nhiệm vụ trong một commit.

## Giao thức

- Không đổi `schema.ts`, `messages.ts` hay `Profile`. Client không đổi.
- Header `x-real-ip` là nội bộ giữa listener của ta và Colyseus. Giá trị `"unknown"` chỉ đi vào `authContext.ip` và `addressKey`.

## Test

Tất cả trong `packages/server/src/worldLimits.test.ts`. Import thêm `RefusalLog` và `stampClientAddress`.

**`describe("clientAddress")` (2a)**
- Sửa test "clamps to the first entry…":
  - Bỏ `clientAddress(undefined, "2.2.2.2", 2)` vì giờ phải ra `undefined`.
  - Thay bằng `clientAddress("10.0.0.1", "2.2.2.2", 3)`, mong `"2.2.2.2"`. Giữ dòng `("10.0.0.1", undefined, 3)`, mong `"10.0.0.1"`.
  - Đây là siết luật, không phải nới test.
- Thêm test "has no address without a socket address, whatever the header says":
  - `(undefined, "9.9.9.9", 0)`, `(undefined, "2.2.2.2", 2)` và `("", "9.9.9.9", 1)` đều ra `undefined`.
  - Giữ hai dòng của test "has no address without socket and header".

**`describe("stampClientAddress")` (2a)**
- "writes the socket address over any address header":
  - Đầu vào: `{ headers: { "x-real-ip": "8.8.8.8", "x-forwarded-for": "9.9.9.9" }, socket: { remoteAddress: "10.0.0.1" } }` với `trustProxy` 0.
  - Mong: `headers["x-real-ip"] === "10.0.0.1"`.
  - Dùng `as unknown as IncomingMessage` hoặc kiểu `Pick` cho object giả.
- "writes unknown, never deletes, when there is no address":
  - Đầu vào: `socket: { remoteAddress: undefined }`, các header như trên, với `trustProxy` 0 rồi 1.
  - Mong: `headers["x-real-ip"] === "unknown"` và `addressKey(headers["x-real-ip"]) === "unknown"`.

**`describe("addressKey")` (2b)**
- Thêm vào test "keeps IPv4 and unwraps IPv4-mapped IPv6" (hoặc một test mới "unwraps hex IPv4-mapped IPv6"):
  - `addressKey("::ffff:cb00:7105")`, `addressKey("::FFFF:CB00:7105")` và `addressKey("0:0:0:0:0:ffff:cb00:7105")` đều ra `"203.0.113.5"`.
  - `addressKey("::ffff:203.0.113.5%eth0")` ra `"203.0.113.5"`.
- Kiểm không bóc nhầm:
  - `addressKey("::cb00:7105")` ra `"0:0:0:0::/64"`;
  - `addressKey("1::ffff:cb00:7105")` ra `"1:0:0:0::/64"`.
- Các test /64 cũ phải qua nguyên vẹn.

**`describe("RefusalLog")` (2c)**, mỗi test một `new RefusalLog()`:
- "logs the first refusal at once":
  - `note("address", 1_000, 3)` ra đúng `"World limits: refused 1 world creation (server 0, address 1); 3 worlds open"`.
- "counts refusals within a minute into the next line, with the real time span":
  - `note("address", 0, 1)` in ngay. `note("server", 10_000, 2)` và `note("address", 30_000, 2)` ra `undefined`.
  - `note("address", 7_200_000, 4)` ra đúng `"World limits: refused 3 world creations in the last 7190 s (server 1, address 2); 4 worlds open"`.
  - Chữ "in the last minute" không còn xuất hiện.
- "starts a new count after a line":
  - Tiếp chuỗi trên: `note("server", 7_230_000, 4)` ra `undefined`; `note("server", 7_260_000, 4)` ra `"… refused 2 world creations in the last 30 s (server 2, address 0); 4 worlds open"`.
  - Chuỗi `…` là cùng tiền tố `World limits: `; test so cả câu.
  - Kiểm: 7_260_000 − 7_200_000 = 60_000, không nhỏ hơn `REFUSAL_LOG_MS`, nên câu được in; `firstAt = 7_230_000`, nên s = 30.

**`describe("limits from env")` (2d):** test hiện có phải qua nguyên vẹn. Không cần test mới, vì `intFromEnv` không export.

**`describe("creating worlds over HTTP")` (2e)**, thêm test "refuses to install on a matchmaker it does not recognise, installing nothing":
- Ghi lại `const http = server.transport.server!`, `const listeners = http.listenerCount("request")`, `const invoke = matchMaker.controller.invokeMethod` và `const exposed = matchMaker.controller.exposedMethods`.
- Ba trường hợp, mỗi trường hợp gán rồi khôi phục trong `try/finally`:
  1. `exposedMethods = exposed.filter((m) => m !== "create")`;
  2. `exposedMethods = undefined as any`;
  3. `invokeMethod = undefined as any`.
- Mỗi trường hợp mong `expect(() => guardWorldCreation(server, settings, new WorldCensus())).toThrow(/invokeMethod\(\) and exposedMethods/)`.
- Sau cả ba trường hợp:
  - `http.listenerCount("request")` vẫn bằng `listeners`;
  - `matchMaker.controller.invokeMethod` vẫn là `invoke`;
  - `(await create()).status` vẫn là 200, nghĩa là bộ chặn đang cài vẫn chạy.
- Test sẵn có "cannot be fooled by address headers" và "is undone completely" phải còn qua: chúng chứng minh `stampClientAddress` vẫn chạy trước listener của Colyseus.

**Scripts:** không có test tự động, vì `dev.mjs` và `shots.mjs` chạy ngay khi import. Tester kiểm tay:
- Ngắt server dev đang chạy nếu có (cổng 2567 và 5173 phải trống).
- Chạy `timeout 40 npm run dev`. Log server phải có `World limits: 50 worlds, 1000 per address; trusting 0 proxies`.
- Chạy `PETGAME_MAX_WORLDS_PER_ADDRESS=2 timeout 40 npm run dev`. Log phải có `2 per address`.
- Chạy `npm run shots -- --name t66 --no-build` (cần build có sẵn, hoặc bỏ `--no-build`) và xác nhận chạy xong, không lỗi 429. Bước này chậm; chỉ bắt buộc khi máy chạy được Chromium.

**E2E:** không thêm. `playwright.config.ts` không đổi, và `npm run test:e2e` phải còn qua.

## Tiêu chí hoàn thành

- [ ] `scripts/dev.mjs` truyền `PETGAME_MAX_WORLDS_PER_ADDRESS` (mặc định `"1000"`, giữ giá trị đã đặt) **chỉ** cho tiến trình server. Client nhận `process.env` như cũ. Không nâng `PETGAME_MAX_WORLDS`.
- [ ] `scripts/shots.mjs` thêm `PETGAME_MAX_WORLDS_PER_ADDRESS: "1000"` vào `env` của server.
- [ ] `package.json` (script `play`, `dev:server`), `packages/server/package.json`, `Dockerfile`, `fly.toml`, `render.yaml`, `playwright.config.ts` và `WORLD_LIMITS` không đổi. Kiểm bằng `git diff --stat`.
- [ ] `clientAddress` trả `undefined` khi không có `remote`, dù header nói gì.
- [ ] `stamp` không còn `delete req.headers["x-real-ip"]`; địa chỉ không xác định thành `"unknown"`.
- [ ] `addressKey` bóc IPv4 lồng trong IPv6 cả dạng chấm lẫn hex, và không bóc nhầm `::a:b` hay tiền tố khác 0.
- [ ] Câu log bị chặn khớp từng ký tự với Thiết kế 2c; chuỗi "in the last minute" không còn trong repo (`grep -rn "in the last minute" packages` rỗng).
- [ ] `positiveInt` không còn (`grep -n positiveInt packages` rỗng); `intFromEnv` có JSDoc đúng.
- [ ] `guardWorldCreation` ném lỗi có chữ `invokeMethod() and exposedMethods` khi controller sai dạng, và không cài listener hay wrapper nào trước khi ném.
- [ ] Mọi test mới ở mục Test có mặt và qua. Test cũ chỉ sửa đúng chỗ đã ghi ("clamps…"), không test nào bị nới hay bỏ.
- [ ] `npm run typecheck`, `npm test` và `npm run test:e2e` sạch.
- [ ] Kiểm tay `npm run dev` ra `1000 per address`, và với biến tự đặt ra đúng số đó.
- [ ] Tài liệu: `docs/architecture.md` (hai chỗ, có câu `auth.ip`/`client.ip` ở WebSocket vẫn giả được), `docs/deploy.md` và `docs/design/multiplayer.md` sửa như Thiết kế 3.
- [ ] Chú thích code bằng tiếng Anh; tài liệu bằng tiếng Việt.

## Rủi ro, câu hỏi mở

1. **Kiểu của `controller`:** `typeof controller?.invokeMethod !== "function"` có thể bị TypeScript coi là luôn sai. Lỗi này không làm hỏng `noUnusedLocals`, nhưng nếu `tsc` báo so sánh vô nghĩa thì đọc qua một biến kiểu rộng: `const c = matchMaker.controller as { invokeMethod?: unknown; exposedMethods?: unknown }`.
2. **Gán `undefined` vào `controller` trong test:** cần `as any`. Bắt buộc khôi phục trong `finally`, nếu không các test sau trong file hỏng dây chuyền.
3. **`npm run dev:server`** vẫn giữ trần 10. Chấp nhận và đã ghi tài liệu. Nếu sau này cần, chuyển phần đặt biến vào một script Node riêng cho server.
4. Không có mục CHẶN.
