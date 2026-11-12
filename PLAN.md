# PLAN: T64 Giới hạn số thế giới được tạo

Đọc code ở HEAD `ab68125`. Luật chơi đã ghi vào `docs/design/multiplayer.md`: mục mới "Giới hạn số thế giới (T64)", một dòng thêm vào bảng "Vào thế giới: lỗi", và hai gạch mới trong "Đã cân nhắc". PLAN này là phần kỹ thuật.

File liên quan:
- `packages/server/src/index.ts`: `defineServer` + `server.listen(port)`; Express có `/healthz`.
- `packages/server/src/rooms/GameRoom.ts`:
  - `onCreate` ở dòng 364, kết thúc bằng `this.holdEmptyWorld()` ở dòng 507;
  - `onDispose` ở dòng 633.
- `packages/shared/src/constants.ts`: `EMPTY_WORLD_HOLD_MS` ở dòng 57.
- `packages/client/src/net/connection.ts`: `JoinFailure` dòng 29, `joinFailure` dòng 37.
- `packages/client/src/ui/joinStatus.ts`: `joinCard` dòng 40.
- `packages/client/src/main.ts`: `enter()` (dòng 133-176). **Không phải sửa**: nó đã hiện `joinCard(joinFailure(err))` cho mọi lỗi.
- Cấu hình: `playwright.config.ts` (env của webServer), `fly.toml` (`[env]`), `render.yaml` (`envVars`).
- Test: `packages/client/src/net/connection.test.ts` (describe "joinFailure"), `packages/client/src/ui/joinStatus.test.ts` (`ALL` ở dòng 6, describe "joinCard"), `tests/e2e/multiplayer.spec.ts` (`enterLobby` dòng 65, `waitForWorld` dòng 83, mẫu `route` trên `/matchmake/` ở test "lobby: a reload goes back…", khoảng dòng 1726).

### Colyseus 0.18.18 xử lý `/matchmake` thế nào (đã đọc `node_modules/@colyseus/core/src`)

- **Express không bao giờ thấy `/matchmake/*`.** Trong `router/index.ts`, `bindRouterToTransport` gỡ app Express khỏi sự kiện `request` của server HTTP. Nó thay bằng hàm `next`: đường nào có trong router của Colyseus (gồm `POST /matchmake/:method/:roomName`) thì router xử lý, còn lại mới chuyển cho Express. Vì vậy middleware Express trên `/matchmake/create` **không chạy**.
- **`onAuth` không đủ thông tin.**
  - Static `onAuth(token, options, context)` chạy cho cả `create`, `joinById`, `join` và `joinOrCreate`, và không được biết method nào gọi nó.
  - Nó chạy trước khi phòng được tạo, nên không biết `roomId`. Không có `roomId` thì không đếm được "thế giới của địa chỉ này còn mở".
- **`onCreate` không có địa chỉ mạng.** Nó chỉ nhận `options` của client, mà client sửa được.
- **`context.ip` của Colyseus giả được.**
  - `createAuthContext` trong `Transport.ts` lấy IP từ `x-real-ip`, rồi `x-forwarded-for`, rồi `x-client-ip`, và chỉ sau cùng mới dùng địa chỉ socket.
  - Với đường HTTP (`router/default_routes.ts`), nó **không** được truyền `remoteAddress`. `getRequest` của better-call cũng chỉ chép header.
  - Kết quả: client tự gửi `X-Forwarded-For: <bất kỳ>` là đổi được `context.ip`, còn không gửi thì `context.ip` là `undefined`.
- **Điểm chặn dùng được:**
  - `matchMaker.controller` (export từ `colyseus`) là object thường, được tài liệu của Colyseus cho phép ghi đè (`getCorsHeaders`).
  - Route gọi `matchMaker.controller.invokeMethod(method, roomName, options, authContext)` ở mỗi request. Hàm này biết method, và với `create` thì trả về `{ roomId, sessionId, ... }`.
  - Lỗi ném ra từ đó thành `ctx.error(e.code, { code: e.code, error: e.message })`: mã HTTP là `e.code`, thân JSON là `{ code, error }`, và header CORS do router của Colyseus thêm.
  - Phía SDK, `HTTP.ts` ném `ServerError(raw.status, data.message ?? data.error)`, rồi `Client.createMatchMakeRequest` đổi thành `MatchMakeError(message, code)`. Client vì vậy nhận `code` = mã HTTP và `message` = `error`.
- **`controller.exposedMethods`** là mảng `['joinOrCreate', 'create', 'join', 'joinById', 'reconnect']`. Game chỉ dùng `create`, `joinById` và `reconnect` (đã tìm trong client, test và e2e). `@colyseus/testing` `connectTo` cũng dùng `joinById`.
- **Thứ tự listener `request`.** Trong `listen()`, `bindRoutes` gọi `server.prependListener('request', …)` để gắn bộ CORS rồi `next`. Hàm `next` dựng `Request` (chép header) ngay, trước lần `await` đầu tiên.
  - Muốn sửa header trước khi Colyseus đọc thì listener của ta phải được prepend **sau** `listen()`, để nó đứng trước listener của Colyseus.
  - Prepend trước `listen()` thì listener của Colyseus đứng trước, và header đã bị chép rồi mới sửa.
- `roomId` được gán trước `onCreate` (`handleCreateRoom`), nên `onCreate` dùng được `this.roomId`.

## Mục tiêu

- Một script gọi `/matchmake/create` liên tục (hay vào rồi rời mỗi thế giới trước 60 giây) chỉ giữ được **tối đa 10 thế giới** từ một địa chỉ mạng. Cả server tối đa **50 thế giới**. Server không còn bị một người làm chậm (trước T64: khoảng 300 thế giới, 39% một nhân CPU, 105 MB).
- Người chơi thật không bao giờ gặp giới hạn: cả nhà 5 người sau một Wi-Fi vẫn chơi được; vào thế giới bằng link mời, tải lại hay nối lại **không bao giờ** bị chặn.
- Khi bị chặn, sảnh nói rõ vì sao và cho cách đi tiếp (Thử lại, hoặc vào thế giới bạn bè bằng link).

## Phạm vi

Làm:
1. Module server mới `packages/server/src/worldLimits.ts`. Nó gồm:
   - sổ đếm thế giới `WorldCensus`;
   - hàm lấy địa chỉ người chơi `clientAddress` và hàm gộp địa chỉ `addressKey`;
   - hàm đọc cấu hình từ env;
   - `guardWorldCreation`, hàm cài chặn vào Colyseus.
2. `GameRoom` báo cho sổ đếm khi thế giới mở (cuối `onCreate`) và khi đóng (`onDispose`).
3. `index.ts` cài chặn sau `listen()` và thêm `GET /whoami` để người vận hành kiểm cấu hình proxy.
4. Hằng số dùng chung `WORLD_LIMITS`, `WORLD_LIMIT_STATUS`, `WORLD_LIMIT_ERROR` trong `packages/shared/src/constants.ts`.
5. Client: hai loại lỗi mới `busy` và `tooMany` trong `joinFailure`, và hai thẻ mới trong `joinCard`.
6. Tắt hai method `join` và `joinOrCreate` không dùng tới, vì chúng tạo được thế giới vòng qua chặn và ghép người lạ vào thế giới của người khác.
7. Cấu hình: env cho e2e (`playwright.config.ts`), số proxy tin cậy cho `fly.toml` và `render.yaml`. Tài liệu: `docs/deploy.md`, `docs/architecture.md`.
8. Test: unit cho module server, tích hợp qua HTTP thật, unit client, và một e2e nhẹ (giả lỗi bằng `route`).

KHÔNG làm:
- Không thêm bộ đếm tốc độ theo thời gian (token bucket, cửa sổ trượt). Lý do ở Thiết kế 2.
- Không giới hạn `joinById` hay `reconnect`.
- Không sửa vòng đời phòng của T49 (`holdEmptyWorld`, `keepWorldOpen`, `closeIfStillEmpty`) hay các việc dọn của T65.
- Không sửa `main.ts`, `index.html`, CSS: thẻ mới dùng lại `#join-status`, `#retry-btn`.
- Không thêm captcha, tài khoản hay danh sách chặn IP.
- Không đổi schema, message hay hồ sơ lưu.

## Thiết kế

### 1. Hai trần

| Trần | Hằng số (`WORLD_LIMITS`) | Mặc định | Env ghi đè | Đếm gì |
|---|---|---|---|---|
| Cả server | `maxWorlds` | 50 | `PETGAME_MAX_WORLDS` | mọi `GameRoom` đang mở trong tiến trình (có người, đang giữ 60 s, mới tạo chưa ai vào), cộng số yêu cầu tạo đang chạy dở |
| Mỗi địa chỉ | `perAddress` | 10 | `PETGAME_MAX_WORLDS_PER_ADDRESS` | thế giới **được tạo qua HTTP từ địa chỉ đó** và còn mở (có người hay không), cộng số yêu cầu tạo đang chạy dở của địa chỉ đó |

- Chỉ method `create` bị kiểm. Trần được kiểm **trước** khi gọi `create` gốc. Bị chặn thì không tạo phòng nào và không tốn gì của server.
- Thế giới tạo không qua HTTP (`colyseus.createRoom` trong test) vẫn được tính vào trần cả server. Nó không thuộc địa chỉ nào.
- Thế giới đóng (`onDispose`) thì trả chỗ ngay cho cả hai trần.
- Địa chỉ không xác định được (socket đã đóng, rất hiếm) gộp chung vào khoá `"unknown"`: vẫn bị giới hạn, không được miễn.

Lý do chọn số (chi phí mỗi thế giới trống đo ở T49: 0,064 ms mỗi nhịp, tức 0,13% một nhân, và 0,35 MB):

| Kịch bản | Trước T64 | Sau T64 |
|---|---|---|
| Một script, một địa chỉ, 5 lần tạo mỗi giây | khoảng 300 thế giới, 39% một nhân, 105 MB | 10 thế giới, 1,3%, 3,5 MB |
| Nhiều địa chỉ | không giới hạn | 50 thế giới, 6,5%, 17,5 MB (khi trống) |
| Cả nhà 5 người sau một Wi-Fi, mỗi người một thế giới, mỗi người lỡ mở thêm một thế giới khi thế giới cũ còn giữ 60 s | không bị chặn | 10: vừa đủ, không bị chặn |
| 50 nhóm chơi cùng lúc | | đến 250 người: quá sức máy 512 MB CPU dùng chung trong `fly.toml`; máy mạnh hơn thì nâng bằng env |

- Tải lại trang, link mời, nối lại và Về sảnh đều dùng `joinById` hoặc `reconnect`, nên không tốn chỗ.
- Một người chỉ tạo thế giới mới khi: mở sảnh không có `room`; bấm Tạo thế giới mới; hoặc quay lại thế giới đã đóng (thử lại lặng lẽ của T49). Vì vậy người thật hiếm khi có quá 2 thế giới cùng lúc.

### 2. Vì sao không cần bộ đếm theo thời gian

Mỗi thế giới sống **ít nhất 60 giây** sau khi tạo (T49):
- `holdEmptyWorld()` chạy ở cuối `onCreate`;
- có người vào thì hẹn giờ bị huỷ, và người cuối ra thì hẹn lại 60 s;
- chỉ `closeIfStillEmpty` bật `autoDispose`.

Vì vậy một chỗ trong trần 10 chỉ được trả lại sớm nhất 60 s sau khi bị chiếm. Hệ quả là trong bất kỳ khoảng 60 giây nào, một địa chỉ tạo được tối đa 10 thế giới: trần 10 **đã là** giới hạn tốc độ 10 lần mỗi phút. Thêm token bucket chỉ thêm một con số, một env và test thời gian, mà không chặn thêm được gì.

Trần này cũng chặn mẹo "vào rồi rời trước 60 s" trong nhiệm vụ: thế giới vẫn còn mở thì vẫn tính vào trần của địa chỉ đã tạo nó.

Ghi trong JSDoc của `WORLD_LIMITS`: nếu sau này có cách làm thế giới đóng sớm hơn 60 s (rút `EMPTY_WORLD_HOLD_MS`, đóng ngay khi tạo hỏng...) thì phải xét lại và thêm bộ đếm theo thời gian.

### 3. Địa chỉ người chơi và proxy

`clientAddress(remote, forwardedFor, trustProxy)`:
- `remote` là `req.socket.remoteAddress`;
- `forwardedFor` là header `x-forwarded-for` (chuỗi, mảng hoặc `undefined`);
- `trustProxy` là số proxy đứng trước server (env `PETGAME_TRUST_PROXY`, mặc định 0).

Cách tính, giống `trust proxy` dạng số của Express:
- `chain = [...các mục của X-Forwarded-For (tách dấu phẩy, bỏ khoảng trắng, bỏ mục rỗng), remote]` (bỏ `remote` nếu `undefined`);
- kết quả là `chain[max(0, chain.length - 1 - trustProxy)]`, hoặc `undefined` khi `chain` rỗng.
- Với `trustProxy = 0`, kết quả luôn là `remote`: header client gửi lên bị bỏ qua.

`addressKey(address)` gộp địa chỉ thành khoá đếm:
- `undefined` hoặc rỗng: `"unknown"`;
- IPv4 kèm IPv6 (`::ffff:203.0.113.5`): `"203.0.113.5"`;
- IPv4: giữ nguyên;
- IPv6 (`net.isIPv6`): khối /64, viết đầy đủ 4 nhóm đầu, chữ thường, bỏ số 0 đứng đầu, đuôi `"::/64"`. Ví dụ `2001:db8::1` thành `"2001:db8:0:0::/64"`. Phải mở rộng `::` đúng chỗ, và bỏ phần zone `%eth0` nếu có.
- Còn lại (chuỗi lạ): giữ nguyên.
- Lý do gộp /64: một máy IPv6 tự đổi địa chỉ trong khối của nó (privacy extensions), và nhà mạng cấp ít nhất /64 cho mỗi thuê bao.

**Gắn địa chỉ trước khi Colyseus đọc:**
- `guardWorldCreation` gọi `server.transport.server.prependListener("request", stamp)`. Hàm `stamp` tính `clientAddress(...)` rồi **ghi đè** `req.headers["x-real-ip"]`; không tính được thì `delete` header đó.
- `x-real-ip` đứng đầu thứ tự đọc của `createAuthContext`, nên `authContext.ip` mà `invokeMethod` nhận là địa chỉ ta đã tính, client không giả được.
- Hàm phải được gọi **sau** `await server.listen(...)` (lý do ở mục Colyseus phía trên). Trong vài mili giây giữa `listen` và lúc cài chặn, server chưa giới hạn gì: chấp nhận.
- Cảnh báo một lần: khi `trustProxy === 0` mà gặp request có `x-forwarded-for`, `console.warn` **một lần** cho cả tiến trình: "World limits: requests carry X-Forwarded-For but PETGAME_TRUST_PROXY is 0; every player may share the proxy's address. See docs/deploy.md."

**`GET /whoami`** (Express, trong `index.ts`):
- trả `text/plain` là địa chỉ server thấy cho người gọi, tính bằng chính `clientAddress(req.socket.remoteAddress, req.headers["x-forwarded-for"], trustProxy)`, hoặc `"?"` khi không tính được;
- người gọi chỉ thấy địa chỉ của chính họ, nên không lộ gì;
- dùng để kiểm cấu hình proxy sau khi deploy (`docs/deploy.md`).

**Giá trị cho từng nơi chạy:**

| Nơi chạy | `PETGAME_TRUST_PROXY` | Vì sao |
|---|---|---|
| `npm run dev`, `npm run play` (LAN), e2e | 0 (mặc định) | không có proxy; mỗi điện thoại trên LAN có địa chỉ riêng |
| Fly (`fly.toml` `[env]`) | `"1"` | fly-proxy nối vào máy, và nó thêm địa chỉ người chơi vào cuối `X-Forwarded-For` |
| Render (`render.yaml` `envVars`) | `"1"`, **phải kiểm bằng `/whoami` sau khi deploy** | xem Rủi ro 1 |

Đặt sai theo hai hướng có hậu quả khác nhau:
- **Đặt thấp hơn số proxy thật: hại người chơi.** Mọi người cùng một địa chỉ (của proxy), nên trần 10 thành trần chung. Lời cảnh báo một lần và `/whoami` để phát hiện việc này.
- **Đặt cao hơn số proxy thật: không hại người chơi.** Chỉ để kẻ phá giả được địa chỉ, khi đó vẫn còn trần 50.

### 4. Sổ đếm `WorldCensus`

Đây là class thuần, không hẹn giờ, không đọc đồng hồ. Có một bản dùng chung `export const worldCensus = new WorldCensus()`; `GameRoom` và `guardWorldCreation` cùng dùng nó.

```ts
type WorldRefusal = "server" | "address";
interface WorldLimits { maxWorlds: number; perAddress: number }

class WorldCensus {
  /** roomId -> address key of the HTTP request that created it (undefined: made without HTTP). */
  private open: Map<string, string | undefined>;
  /** Creations admitted but not settled yet, per address key. */
  private pending: Map<string, number>;
  opened(roomId: string): void;                 // GameRoom.onCreate, at the end
  closed(roomId: string): void;                 // GameRoom.onDispose; unknown id: no-op
  /** Checks both caps; on success counts one pending creation for `key` and returns undefined. */
  admit(key: string, limits: WorldLimits): WorldRefusal | undefined;
  /** The creation admitted for `key` finished: drop the pending count; if it made `roomId` (still open), it belongs to `key`. */
  settle(key: string, roomId: string | undefined): void;
  /** Open worlds plus pending creations (what maxWorlds is checked against). */
  total(): number;
  /** Open worlds created from `key` plus its pending creations (what perAddress is checked against). */
  countFor(key: string): number;
}
```

- `admit` kiểm trần cả server trước: `total() >= maxWorlds` trả `"server"`. Sau đó `countFor(key) >= perAddress` trả `"address"`.
- `settle(key, roomId)`: giảm `pending` của `key` (không xuống dưới 0, xoá mục khi về 0). Nếu `roomId` đang có trong `open` thì gán nó cho `key`; nếu không (đã đóng, hoặc không biết) thì bỏ qua.
- `countFor` đếm tuyến tính trên `open`. Với tối đa vài chục thế giới thì đủ nhanh, không cần index phụ.
- Trong lúc một yêu cầu tạo đang chạy, phòng mới đã gọi `opened` mà chưa `settle`, nên nó bị đếm hai lần (một lần trong `open`, một lần trong `pending`) trong vài mili giây. Hệ quả chỉ là chặt hơn một chút khi nhiều yêu cầu đến cùng lúc: chấp nhận, ghi trong JSDoc.

### 5. Cài chặn: `guardWorldCreation(server, settings)`

```ts
interface WorldGuardSettings { limits: WorldLimits; trustProxy: number }
/** Returns a function that undoes everything (tests). `settings` is read on every request, so tests may change it. */
function guardWorldCreation(server: Server, settings: WorldGuardSettings, census = worldCensus): () => void
```

Hàm làm bốn việc:
1. **Gắn địa chỉ:** `prependListener("request", stamp)` (Thiết kế 3). Ném lỗi rõ ràng nếu `server.transport.server` không có, tức là bị gọi trước `listen()`.
2. **Tắt `join` và `joinOrCreate`:** xoá hai method này khỏi `matchMaker.controller.exposedMethods`. Gọi chúng thì Colyseus tự trả 520 `invalid method`.
   - Lý do: `joinOrCreate` tạo được thế giới vòng qua chặn khi không còn phòng trống. Cả hai còn ghép người lạ vào thế giới (kể cả thế giới đang giữ trống) của người khác, trái với `multiplayer.md` ("Không ai bị ghép ngẫu nhiên vào đó").
   - Game không dùng hai method này.
3. **Bọc `matchMaker.controller.invokeMethod`:**
   ```ts
   const original = controller.invokeMethod;
   controller.invokeMethod = async function (method, roomName, options, auth) {
     if (method !== "create") return original.call(this, method, roomName, options, auth);
     const key = addressKey(auth?.ip);
     const refusal = census.admit(key, settings.limits);
     if (refusal) { noteRefusal(refusal); throw new ServerError(WORLD_LIMIT_STATUS, WORLD_LIMIT_ERROR[refusal]); }
     let roomId: string | undefined;
     try { const reservation = await original.call(this, method, roomName, options, auth); roomId = reservation?.roomId; return reservation; }
     finally { census.settle(key, roomId); }
   };
   ```
   `ServerError` import từ `colyseus`.
4. **Hàm gỡ:** trả lại `invokeMethod` gốc, trả lại mảng `exposedMethods` như cũ, và `removeListener("request", stamp)`.

**Ghi log chặn (`noteRefusal`):**
- tối đa một dòng mỗi 60 s;
- lần đầu bị chặn trong khoảng đó thì in ngay; các lần sau thì đếm, rồi in kèm dòng kế tiếp. Ví dụ: `World limits: refused 37 world creations in the last minute (server 0, address 37); 50 worlds open`;
- **không** ghi địa chỉ IP vào log;
- dùng `Date.now()`; không cần test.

### 6. Hằng số dùng chung (`packages/shared/src/constants.ts`, ngay sau `EMPTY_WORLD_HOLD_MS`)

```ts
/** Caps on creating worlds (T64); see docs/design/multiplayer.md "Giới hạn số thế giới". <JSDoc: lý do số, và ghi chú Thiết kế 2> */
export const WORLD_LIMITS = { maxWorlds: 50, perAddress: 10 } as const;
/** HTTP status of a world creation refused by WORLD_LIMITS (Too Many Requests). */
export const WORLD_LIMIT_STATUS = 429;
/** Error text of each refusal; the lobby tells them apart by it. Never shown to players. */
export const WORLD_LIMIT_ERROR = { server: "too many worlds on this server", address: "too many worlds from this address" } as const;
```

- Để ở shared vì client cần `WORLD_LIMIT_STATUS` và `WORLD_LIMIT_ERROR`, và `WORLD_LIMITS` nằm cạnh `EMPTY_WORLD_HOLD_MS` mà nó dựa vào.
- `WORLD_LIMIT_ERROR` không phải chữ người chơi thấy (thẻ dùng chữ tiếng Việt của client), nên viết tiếng Anh như các thông điệp giao thức khác.

### 7. Đọc cấu hình từ env (`worldLimits.ts`)

- `worldLimitsFromEnv(env: Record<string, string | undefined>): WorldLimits`:
  - đọc `PETGAME_MAX_WORLDS` và `PETGAME_MAX_WORLDS_PER_ADDRESS`;
  - chỉ nhận chuỗi số nguyên dương thập phân (`/^\d+$/` và ≥ 1);
  - giá trị khác (`""`, `"0"`, `"-1"`, `"1.5"`, `"abc"`) thì dùng số mặc định của `WORLD_LIMITS` và `console.warn` tên biến bị bỏ qua. `undefined` thì dùng mặc định, không cảnh báo.
- `trustProxyFromEnv(env): number`:
  - `PETGAME_TRUST_PROXY`, số nguyên 0-9;
  - giá trị khác thì dùng 0 và cảnh báo.
- `index.ts` đọc một lần lúc khởi động và in một dòng, ví dụ: `World limits: 50 worlds, 10 per address; trusting 1 proxy`.

### 8. Sảnh (client)

`JoinFailure` thêm `"busy"` (trần cả server) và `"tooMany"` (trần mỗi địa chỉ).

`joinFailure(err)`:
- thêm ngay sau dòng `if (typeof code !== "number" || code === 503) return "unreachable";`:
  `if (code === WORLD_LIMIT_STATUS) return message === WORLD_LIMIT_ERROR.address ? "tooMany" : "busy";`
- Mã 429 mà message lạ (ví dụ proxy của Fly hay Render tự giới hạn) thì là `busy`. Đó là cách hiểu hợp lý và cũng có Thử lại.
- Sửa JSDoc của `joinFailure` cho đúng.

`joinCard` thêm hai trường hợp. Chữ đúng như bảng trong `multiplayer.md`:

| `failure` | `title` | `detail` | Nút |
|---|---|---|---|
| `busy` | Server đang có quá nhiều thế giới | Chưa tạo thêm được thế giới mới. Chờ một lát rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | `retry: true, newWorld: false, reload: false, primary: "retry"` |
| `tooMany` | Đã mở nhiều thế giới quá | Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau `${EMPTY_WORLD_HOLD_MS / 60_000}` phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | như trên |

- Số phút tính từ `EMPTY_WORLD_HOLD_MS` (ra "1 phút"), để chữ không lệch khi số đổi. Không ghi số 10 hay 50 trong chữ, vì server có thể ghi đè bằng env.
- Không cần sửa `main.ts`:
  - `enter()` đã gọi `showJoinCard(joinCard(joinFailure(err), returning))`, và `#retry-btn` gọi lại `enter()`;
  - lỗi tạo thế giới chỉ xảy ra khi địa chỉ không có `room`, nên Thử lại là tạo lại;
  - thử lại lặng lẽ của T49 chỉ chạy khi lỗi là `closed`. Lần tạo sau nó mà bị chặn thì hiện thẻ T64, và địa chỉ đã bỏ `room`.
- Bàn phím: nút Thử lại có focus, Enter là thử lại (như thẻ T23). Cảm ứng: nút đã ≥ 44×44 (T23 kiểm ở ba khung hình).

## Kế hoạch triển khai

1. **`packages/shared/src/constants.ts`:** thêm `WORLD_LIMITS`, `WORLD_LIMIT_STATUS` và `WORLD_LIMIT_ERROR` sau `EMPTY_WORLD_HOLD_MS`, kèm JSDoc (Thiết kế 6, lý do số theo Thiết kế 1-2).
2. **`packages/server/src/worldLimits.ts` (mới):**
   - `clientAddress` và `addressKey` (Thiết kế 3);
   - `WorldCensus` và `worldCensus` (Thiết kế 4);
   - `worldLimitsFromEnv` và `trustProxyFromEnv` (Thiết kế 7);
   - `guardWorldCreation` (Thiết kế 5), `stamp` và `noteRefusal` dùng nội bộ;
   - kiểu `WorldLimits`, `WorldRefusal`, `WorldGuardSettings`.
   - JSDoc tiếng Anh nói vì sao chặn ở `invokeMethod`, vì sao phải gọi sau `listen()`, và vì sao ghi đè `x-real-ip`.
3. **`packages/server/src/rooms/GameRoom.ts`:**
   - cuối `onCreate`, sau `this.holdEmptyWorld()`: `worldCensus.opened(this.roomId);`
   - đầu `onDispose`: `worldCensus.closed(this.roomId);`
   - Không đổi gì khác.
4. **`packages/server/src/index.ts`:**
   - đọc `settings = { limits: worldLimitsFromEnv(process.env), trustProxy: trustProxyFromEnv(process.env) }` trước `defineServer`;
   - trong callback `express` thêm `app.get("/whoami", ...)` (Thiết kế 3);
   - sau `await server.listen(port)` gọi `guardWorldCreation(server, settings)` rồi in dòng cấu hình (Thiết kế 7).
5. **`packages/client/src/net/connection.ts`:** thêm `"busy" | "tooMany"` vào `JoinFailure`, sửa `joinFailure` và JSDoc (Thiết kế 8), import hai hằng từ `@petgame/shared`.
6. **`packages/client/src/ui/joinStatus.ts`:** thêm hai `case` vào `joinCard`, import `EMPTY_WORLD_HOLD_MS`.
7. **`playwright.config.ts`:** thêm vào `env` của webServer 2567: `PETGAME_MAX_WORLDS: "1000"` và `PETGAME_MAX_WORLDS_PER_ADDRESS: "1000"`. Kèm chú thích: e2e mở nhiều thế giới từ một địa chỉ (127.0.0.1) trong vòng một phút, mỗi cái sống 60 s; trần được test ở `worldLimits.test.ts`.
   - Đây là cấu hình server cho test, không nới test nào: e2e chưa bao giờ kiểm số thế giới.
8. **`fly.toml`:** trong `[env]` thêm `PETGAME_TRUST_PROXY = "1"`, kèm chú thích một dòng (fly-proxy nối vào máy; kiểm bằng `/whoami`).
9. **`render.yaml`:** thêm `envVars` `- key: PETGAME_TRUST_PROXY` `value: "1"`, kèm chú thích "kiểm bằng /whoami sau khi deploy, xem docs/deploy.md".
10. **`docs/deploy.md`:** thêm mục "Giới hạn số thế giới và proxy":
    - ba biến env (`PETGAME_MAX_WORLDS`, `PETGAME_MAX_WORLDS_PER_ADDRESS`, `PETGAME_TRUST_PROXY`) với mặc định và ý nghĩa;
    - cách kiểm: mở `https://<app>/whoami` bằng điện thoại dùng 4G (tắt Wi-Fi), so với địa chỉ do một trang "what is my IP" báo;
      - khớp là đúng;
      - ra địa chỉ nội bộ (`10.*`, `172.16-31.*`, `192.168.*`, `fdaa:*`, `fd*`) thì tăng `PETGAME_TRUST_PROXY` thêm 1 rồi kiểm lại;
      - thử hai mạng khác nhau mà ra cùng một địa chỉ cũng là chưa đúng;
    - dòng cảnh báo `X-Forwarded-For` trong log nghĩa là gì.
11. **`docs/architecture.md`:**
    - mục `packages/server`: gạch `worldLimits.ts` (sổ đếm, `guardWorldCreation` bọc `matchMaker.controller.invokeMethod` cho `create`, gắn địa chỉ qua `x-real-ip` bằng listener `request` prepend sau `listen()`, tắt `join`/`joinOrCreate`, `/whoami`, env);
    - ở `index.ts`, thêm `/whoami` và việc cài chặn;
    - ở `GameRoom.ts`, mục "Giữ thế giới trống (T49)": `worldCensus.opened/closed`, và sửa câu "ai thêm ghép ngẫu nhiên phải loại nó" cho khớp việc `join`/`joinOrCreate` đã tắt;
    - ở đoạn `main.ts` (T23): `joinFailure` có thêm `busy`/`tooMany`;
    - ở phần test: `worldLimits.test.ts` và env trần trong e2e.
12. **Test:** theo mục Test dưới đây.

`docs/design/multiplayer.md` đã được game-designer cập nhật; coder chỉ sửa nếu cách làm buộc phải khác (ghi lý do vào PROGRESS.md).

## Giao thức

- Schema, `messages.ts`, `Profile`: **không đổi**. Hồ sơ cũ không bị ảnh hưởng.
- HTTP matchmaking:
  - `POST /matchmake/create/world` có thể trả **429** `{ code: 429, error: WORLD_LIMIT_ERROR.server | WORLD_LIMIT_ERROR.address }`, có header CORS do Colyseus thêm;
  - `POST /matchmake/join/*` và `/matchmake/joinOrCreate/*` trả **520** (`invalid method`).
  - Client cũ (tab mở trước khi deploy) gặp 429 thì hiện thẻ "Không vào được thế giới" (`failed`) với nút Thử lại: chấp nhận được.
- Endpoint mới `GET /whoami` (text/plain).

## Test

### Unit: `packages/server/src/worldLimits.test.ts` (mới, không cần server)

1. `clientAddress`:
   - `trustProxy 0` trả `remote` dù có `X-Forwarded-For`;
   - `trustProxy 1` với `"1.1.1.1, 2.2.2.2"` trả `"2.2.2.2"`;
   - `trustProxy 2` với một mục trả mục đó (kẹp về 0);
   - bỏ mục rỗng và khoảng trắng (`" , 3.3.3.3 ,"`);
   - header dạng mảng;
   - `remote` `undefined` và không header trả `undefined`.
2. `addressKey`:
   - IPv4 giữ nguyên;
   - `::ffff:203.0.113.5` thành `203.0.113.5`;
   - `2001:db8:a:b:1:2:3:4` và `2001:DB8:A:B::9` cùng khoá `"2001:db8:a:b::/64"`;
   - `2001:db8::1` thành `"2001:db8:0:0::/64"`;
   - `::1` thành `"0:0:0:0::/64"`;
   - `fe80::1%eth0` bỏ zone;
   - `2001:db8:a:c::1` khác khoá với `2001:db8:a:b::1`;
   - `undefined` và `""` thành `"unknown"`.
3. `WorldCensus`:
   - `admit` đến `perAddress` thì trả `"address"`, địa chỉ khác vẫn được;
   - `total()` đến `maxWorlds` (gồm thế giới mở không qua HTTP, qua `opened`) thì trả `"server"` cho mọi địa chỉ;
   - `settle(key, roomId)` gán phòng cho địa chỉ, và `countFor` không đổi sau `settle` (pending chuyển thành open);
   - `settle(key, undefined)` trả chỗ;
   - `closed` trả chỗ cho cả hai trần;
   - `closed` với id lạ không làm gì;
   - `settle` với `roomId` đã đóng không gán, và không làm `countFor` âm hay kẹt.
4. `worldLimitsFromEnv` và `trustProxyFromEnv`: mặc định khi `undefined`; nhận `"3"`; bỏ `""`, `"0"`, `"-1"`, `"1.5"`, `"abc"` (dùng mặc định, có `console.warn`, spy bằng `vi.spyOn(console, "warn")`); `trustProxy` `"10"` bị bỏ.

### Tích hợp: cùng file, describe "creating worlds over HTTP"

Boot server như `bootTestServer` trong `GameRoom.test.ts`: `defineServer` + `listen(0, "127.0.0.1")` + `ColyseusTestServer`. Sau `listen` gọi `guardWorldCreation(server, settings)`, với `settings` là object dùng chung để test đổi (mặc định `{ limits: { maxWorlds: 4, perAddress: 2 }, trustProxy: 0 }`, đặt lại trong `beforeEach`).

`beforeAll` làm nóng một phòng như `GameRoom.test.ts`. `afterEach`: `colyseus.cleanup()`, rồi kiểm `worldCensus.total() === 0` (mọi phòng đã đóng đều trả chỗ). `afterAll`: gỡ chặn rồi `shutdown()`.

Gọi tạo bằng `fetch` thật: `POST http://127.0.0.1:<port>/matchmake/create/world` với body `{}` và header tuỳ test. Phòng tạo mà không ai vào sẽ sống 60 s và được `cleanup()` dọn. Không chờ theo giờ thật.

5. **Trần mỗi địa chỉ:**
   - hai lần tạo đầu trả 200 và có `roomId`;
   - lần thứ ba trả 429 với `error === WORLD_LIMIT_ERROR.address`, kèm header `access-control-allow-origin`;
   - số phòng thật (`matchMaker.stats.local.roomCount`, hoặc `worldCensus.total()`) không tăng sau lần bị chặn;
   - qua SDK: `new Client(url).create("world", {})` ném lỗi `code === 429`, `message === WORLD_LIMIT_ERROR.address` (chính đường client đi).
6. **Không giả được địa chỉ khi `trustProxy 0`:** sau khi chạm trần, lần tạo kèm `X-Forwarded-For: 9.9.9.9`, `X-Real-IP: 8.8.8.8` và `X-Client-IP: 7.7.7.7` vẫn bị 429 `address`.
7. **Có proxy (`settings.trustProxy = 1`):**
   - tạo kèm `X-Forwarded-For: 203.0.113.1` hai lần thì lần thứ ba bị `address`;
   - `X-Forwarded-For: 203.0.113.2` vẫn tạo được;
   - `X-Forwarded-For: 198.51.100.7, 203.0.113.1` tính là `203.0.113.1` (mục cuối), nên bị chặn.
8. **Trần cả server:**
   - `maxWorlds: 3`, một phòng tạo bằng `colyseus.createRoom` (không qua HTTP) cộng hai lần tạo HTTP từ hai địa chỉ (`trustProxy 1`, XFF khác nhau) là đủ 3;
   - lần thứ tư từ địa chỉ mới bị 429 `server`.
9. **Đóng thì trả chỗ:**
   - chạm trần địa chỉ, rồi `(await matchMaker.getLocalRoomById(id)).disconnect()` (hoặc `colyseus.getRoomById`), rồi chờ phòng đóng (poll `worldCensus.total()` giảm, hạn 5 s);
   - lần tạo kế tiếp cùng địa chỉ trả 200.
10. **Vào thế giới có sẵn không bị chặn:** khi trần cả server đã đủ, `colyseus.sdk.joinById(roomId, { name: "Friend" })` vào một phòng đã tạo vẫn được (rồi `leave()`).
11. **`join`/`joinOrCreate` đã tắt:**
    - `POST /matchmake/joinOrCreate/world` và `/matchmake/join/world` trả 520;
    - không phòng mới nào được tạo.
12. **Tạo hỏng trả chỗ:** `POST /matchmake/create/nope` (không có handler) trả lỗi, và `worldCensus.countFor("127.0.0.1") === 0`, nên hai lần tạo `world` sau đó vẫn được.
13. **Gỡ chặn:** sau khi gọi hàm gỡ (trong một test riêng, rồi cài lại), lần tạo thứ ba từ cùng địa chỉ không bị 429, và `exposedMethods` có lại `joinOrCreate`.

Không sửa `GameRoom.test.ts`. Server của nó không cài chặn; `GameRoom` chỉ gọi thêm `worldCensus.opened/closed`, nên mọi test cũ chạy như trước.

### Unit client

- `packages/client/src/net/connection.test.ts`, describe "joinFailure": thêm test "tells the server's world cap from the address cap":
  - `new MatchMakeError(WORLD_LIMIT_ERROR.address, 429)` cho `"tooMany"`;
  - `new MatchMakeError(WORLD_LIMIT_ERROR.server, 429)` cho `"busy"`;
  - `{ code: 429, message: "Too Many Requests" }` cho `"busy"` (proxy tự giới hạn).
  - Test cũ giữ nguyên.
- `packages/client/src/ui/joinStatus.test.ts`:
  - thêm `"busy"` và `"tooMany"` vào `ALL`, để hai test có sẵn ("has a title…", "always points the primary button…") phủ cả hai;
  - thêm test "offers only retry when too many worlds are open, and says how to go on": cả hai loại có `[retry, newWorld] = [true, false]`, `primary "retry"`, `detail` chứa "link mời"; `tooMany` chứa "1 phút"; hai `title` khác nhau.

### E2E (nhẹ, một test mới trong `tests/e2e/multiplayer.spec.ts`)

`lobby: a refused new world says why, and Thử lại opens one once allowed`:
- Mở trang mới không có `room`.
- `page.route(/:2567\/matchmake\/create\//, handler)`. Với `POST`, handler `fulfill` `{ status: 429, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: 429, error: "too many worlds from this address" }) }`. Request khác thì `route.continue()`. Chuỗi lỗi phải khớp `WORLD_LIMIT_ERROR.address`: import từ `@petgame/shared` nếu spec đã import được, không thì viết cùng chữ và chú thích nguồn.
- `enterLobby(page, "Limit", "enter")`. Kiểm:
  - `#join-status` chứa "Đã mở nhiều thế giới quá" và "link mời";
  - `#retry-btn` có focus;
  - `#new-world-btn` ẩn;
  - địa chỉ không có `room`.
- `unroute`, rồi `page.keyboard.press("Enter")` (thử lại bằng bàn phím), rồi `waitForWorld(page)`.

Không cần trần thật trên server e2e (env 1000). Test chỉ tốn một lần vào thế giới.

Chạy: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (cả bộ, để chắc env 1000 không làm hỏng gì).

## Tiêu chí hoàn thành

- [ ] `WORLD_LIMITS` (`maxWorlds 50`, `perAddress 10`), `WORLD_LIMIT_STATUS` (429) và `WORLD_LIMIT_ERROR` nằm trong `packages/shared/src/constants.ts`, có JSDoc nói lý do số và ghi chú "trần mỗi địa chỉ là giới hạn tốc độ vì thế giới sống ≥ 60 s". Logic không có số cứng nào khác.
- [ ] `POST /matchmake/create/world` vượt trần trả 429 với `error` đúng loại, **trước** khi tạo phòng (số phòng không tăng).
- [ ] Trần mỗi địa chỉ đếm thế giới còn mở mà địa chỉ đó đã tạo, kể cả thế giới có người. Thế giới đóng thì trả chỗ. Tạo hỏng không giữ chỗ.
- [ ] Trần cả server đếm mọi `GameRoom` đang mở, kể cả phòng không tạo qua HTTP.
- [ ] Với `PETGAME_TRUST_PROXY` = 0, mọi header địa chỉ client gửi (`X-Forwarded-For`, `X-Real-IP`, `X-Client-IP`) bị bỏ qua. Với N > 0, server lấy mục thứ N tính từ cuối chuỗi. IPv6 gộp theo /64.
- [ ] Chặn được cài **sau** `listen()`, và listener gắn địa chỉ đứng trước listener của Colyseus (test 6 chứng minh).
- [ ] `joinById` và `reconnect` không bao giờ bị chặn (test 10). `join` và `joinOrCreate` trả 520.
- [ ] `GameRoom` chỉ thêm `worldCensus.opened` (cuối `onCreate`) và `worldCensus.closed` (`onDispose`); T49 không đổi.
- [ ] `/whoami` trả địa chỉ server thấy. `fly.toml` và `render.yaml` có `PETGAME_TRUST_PROXY`. `docs/deploy.md` có cách kiểm. Log cảnh báo `X-Forwarded-For` in tối đa một lần, log chặn tối đa một dòng mỗi 60 s và không có IP.
- [ ] Env sai giá trị thì dùng mặc định và có cảnh báo, không làm sập server.
- [ ] Sảnh: 429 `address` hiện thẻ "Đã mở nhiều thế giới quá", 429 khác hiện "Server đang có quá nhiều thế giới". Cả hai chỉ có Thử lại (có focus, Enter dùng được), chữ đúng bảng trong `multiplayer.md`. `main.ts` không đổi. Các thẻ T23, T42, T49 và thử lại lặng lẽ giữ nguyên (test cũ của `joinFailure`/`joinCard` không sửa, vẫn qua).
- [ ] `worldLimits.test.ts` có đủ test 1-13. `connection.test.ts` và `joinStatus.test.ts` có test mới. Có e2e mới. Không test cũ nào bị nới hay bỏ.
- [ ] `playwright.config.ts` đặt hai env trần 1000 kèm chú thích lý do. Cả bộ e2e qua.
- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch.
- [ ] `docs/architecture.md` và `docs/deploy.md` được cập nhật theo bước 10-11.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi dữ liệu đã lưu, không xoá tính năng người chơi dùng (`join`/`joinOrCreate` chưa từng được game gọi), mọi số đổi được bằng env.

1. **Số proxy trên Render chưa chắc chắn.** Có thể là 1 (proxy của Render) hay hơn (thêm Cloudflare phía trước).
   - Đặt thấp hơn thật thì mọi người chung một địa chỉ, và trần 10 chặn nhầm người chơi.
   - Giảm rủi ro bằng ba thứ: bước kiểm `/whoami` trong `docs/deploy.md`, cảnh báo một lần trong log, và chiều sai còn lại (đặt cao hơn) không hại người chơi.
   - Fly: fly-proxy thêm địa chỉ người chơi vào cuối `X-Forwarded-For`, nên 1 là đúng theo tài liệu của Fly; vẫn nên kiểm bằng `/whoami`.
   - Nếu agent chính có quyền deploy thì kiểm ngay; không thì ghi vào `TASKS.md` một việc nhỏ "kiểm `/whoami` sau lần deploy tới".
2. **Dựa vào chi tiết bên trong Colyseus 0.18.18:** `controller.invokeMethod`, `exposedMethods`, `x-real-ip` được đọc đầu tiên trong `createAuthContext`, và thứ tự `prependListener`. Nâng Colyseus có thể làm vỡ những điều này. Test tích hợp 5, 6, 11 sẽ hỏng ngay nếu vậy, không hỏng âm thầm.
3. **Kẻ phá có nhiều địa chỉ** vẫn chiếm được 50 chỗ và chặn việc tạo thế giới mới (không làm chậm server, không ảnh hưởng thế giới đang chơi). Đã ghi vào "Đã cân nhắc" trong `multiplayer.md`. Chặn tiếp cần tài khoản hoặc captcha: ngoài phạm vi.
4. **NAT dùng chung lớn** (trường học, quán net, CGNAT của nhà mạng di động): hơn 10 người cùng địa chỉ, mỗi người một thế giới riêng, thì người thứ 11 gặp thẻ "Đã mở nhiều thế giới quá". Thẻ chỉ cách vào thế giới bạn bè (mỗi thế giới 5 người). Với quy mô chơi cùng bạn bè thì hiếm. Người vận hành nâng `PETGAME_MAX_WORLDS_PER_ADDRESS` nếu cần.
5. Trong vài mili giây giữa `listen()` và lúc cài chặn lúc khởi động, server chưa giới hạn gì: không đáng kể.

Không đề xuất tách nhiệm vụ: một vòng coder làm được (một module server khoảng 200 dòng cộng test, hai hàm client, cấu hình và tài liệu).
