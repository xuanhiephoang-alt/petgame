# PLAN: T67 Trần thế giới với IPv6

Đọc code ở HEAD `b85c430`. Nguồn: mục "Việc mới cho TASKS.md" trong `REVIEW.md` của T64 (`git show 004f6ac:REVIEW.md`, dòng 66) và mục góp ý cuối của T66 (`git show 8ca488d:REVIEW.md`, dòng 46). File liên quan:
- `packages/shared/src/constants.ts` dòng 58-73: `WORLD_LIMITS`, `WORLD_LIMIT_STATUS`, `WORLD_LIMIT_ERROR`.
- `packages/server/src/worldLimits.ts`: `WorldRefusal` 7, `WorldLimits` 9-12, `ipv6Groups` 42-56, `addressKey` 62-72, `WorldCensus` 79-124, `worldLimitsFromEnv` 139-150, `warnedForwarded` 157, `RefusalLog` 163-188, `stampClientAddress` 199-201, `guardWorldCreation` 221-269 (khoá tính ở 255, ném lỗi ở 259).
- `packages/server/src/worldLimits.test.ts`: `describe("addressKey")` 57-85, `RefusalLog` 87-115, `stampClientAddress` 117-138, `WorldCensus` 140-209, `limits from env` 211-241, `creating worlds over HTTP` 243-417 (`settings` 248, `beforeEach` 270-273).
- `packages/server/src/index.ts` dòng 42-44 (dòng log lúc khởi động).
- `scripts/dev.mjs` dòng 15, `scripts/shots.mjs` dòng 38, `playwright.config.ts` dòng 21.
- `docs/deploy.md` dòng 39-45, `docs/architecture.md` dòng 42.
- `docs/design/multiplayer.md`: **game-designer đã cập nhật** (mục "Giới hạn số thế giới", "Vì sao các số này", "Đã cân nhắc và chấp nhận"). Coder không cần sửa file này.

## Mục tiêu

1. **Một khách hàng IPv6 không chiếm hết được 50 chỗ của server.** Hiện trần mỗi địa chỉ tính theo khối /64. Nhà mạng cấp cho mỗi khách hàng /56 (256 khối /64) hoặc /48 (65 536 khối), nên chỉ cần một máy ở nhà, đổi địa chỉ qua 5 khối /64, là cả server không ai tạo được thế giới mới. Thêm trần thứ ba: **20 thế giới mỗi khối IPv6 /48**.
2. **Chuỗi địa chỉ không phải IP chung một khoá.** Hiện `addressKey` trả nguyên chuỗi lạ làm khoá, nên khi `PETGAME_TRUST_PROXY` đặt cao hơn số proxy thật, kẻ phá gửi chuỗi rác khác nhau mỗi lần và không bị trần mỗi địa chỉ chặn. Từ nay mọi chuỗi không phải IP đều vào khoá `unknown` (trần 10). Để proxy hợp lệ ghi kèm cổng không bị dồn nhầm vào `unknown`, bỏ cổng và ngoặc vuông trước khi nhận dạng.

Người chơi không thấy gì mới: bị chặn vì trần /48 thì gặp đúng thẻ "Đã mở nhiều thế giới quá" đã có.

## Phạm vi

Làm:
- `WORLD_LIMITS.perNetwork = 20`; biến môi trường `PETGAME_MAX_WORLDS_PER_NETWORK`.
- `worldLimits.ts`: khoá /48 (`networkKey`), cặp khoá mỗi lần tạo (`creationKeys`), `WorldCensus` đếm cả hai khoá, gộp chuỗi không phải IP vào `unknown`, bỏ cổng và ngoặc, cảnh báo một lần khi gặp địa chỉ không dùng được, đếm riêng lần chặn "network" trong `RefusalLog`.
- Nâng trần mới lên 1000 ở `dev.mjs`, `shots.mjs`, `playwright.config.ts` (như trần mỗi địa chỉ).
- Test unit và tích hợp trong `worldLimits.test.ts`.
- Cập nhật `docs/deploy.md`, `docs/architecture.md`, dòng log ở `index.ts`.

KHÔNG làm:
- **Không đổi giao thức:** không đổi `WORLD_LIMIT_STATUS`, `WORLD_LIMIT_ERROR`, schema, message, `Profile`. Không sửa client (`connection.ts`, `joinStatus.ts`) hay chữ của thẻ.
- Không thêm trần cho IPv4 theo /24 hay khối nào khác.
- Không thêm trần /56 (chỉ /48, lý do ở Thiết kế 1).
- Không có danh sách ngoại lệ cho nhà mạng di động.
- Không đổi `clientAddress`, `/whoami`, `PETGAME_TRUST_PROXY`, luật đếm `pending`.
- Không làm phần của T68 (đổi `Date.now()` sang `performance.now()`, câu "in the last 0 s", "1 worlds open", tài liệu Windows, stderr của `shots.mjs`). T67 chỉ thêm số đếm `network` vào câu log; T68 sửa câu sau.

## Thiết kế

### 1. Trần theo khối /48: chọn khối và số

**Vì sao /48, không phải /56.** /48 là khối lớn nhất mà một khách hàng thường được cấp (RIPE khuyên cấp /48 hoặc /56 cho mỗi nơi dùng; vài nhà mạng gia đình và tunnel IPv6 miễn phí cấp /48). Gộp theo /56 thì người có /48 vẫn có 256 khối /56, tức trần không có tác dụng với đúng nhóm dễ phá nhất. Gộp theo /48 thì chặn được cả người có /56 lẫn /48. Thêm cả trần /56 lẫn /48 thì phức tạp hơn mà không thêm gì cho mục tiêu "một khách hàng không chiếm hết server".

**Vì sao 20.**
- Phải nhỏ hơn 50 rõ rệt. Với 20, một khách hàng giữ được tối đa 20 thế giới (20 × 0,13% = 2,6% một nhân, 20 × 0,35 MB = 7 MB khi trống), còn 30 chỗ cho người khác. Muốn chiếm hết phải có 3 khối /48 riêng (20 + 20 + 10), tức là trường hợp "kẻ phá nhiều địa chỉ" mà T64 đã chấp nhận (với IPv4 là 5 địa chỉ). Chọn 25 thì 2 khối /48 đã đủ chiếm hết.
- Chặn nhầm người thật. Nhà mạng di động cấp mỗi điện thoại một /64 riêng (chuẩn 3GPP) nhưng xếp nhiều thuê bao lạ chung một /48 hay /56. Một nhóm 5 bạn cùng nhà mạng, cùng thành phố (rất có thể chung /48), mỗi người một thế giới cộng mỗi người lỡ mở thêm một (như lý do của trần 10) là 10 thế giới. Trần 20 = 2 × `perAddress`: đủ cho cả nhóm đó và còn 10 cho người lạ chung khối. Chọn 10 (bằng `perAddress`) thì nhóm bạn đó đã chạm trần, và người lạ chung khối bị chặn ngay.
- Muốn bị chặn nhầm thì riêng một khối /48 phải đang mở 20 thế giới, tức 40% sức chứa của server. Với game chơi cùng bạn bè trên một máy 512 MB, lúc đó server cũng gần chạm trần 50 rồi. Mức này nhẹ hơn IPv4 qua CGNAT mà T64 đã chấp nhận (nhiều thuê bao lạ chung một địa chỉ IPv4 với trần 10).
- Điện thoại chỉ có IPv6 mà vào server qua NAT64/464XLAT thì server thấy địa chỉ IPv4 của nhà mạng. Trường hợp đó vẫn đi theo trần mỗi địa chỉ như trước, trần /48 không áp.
- Người vận hành nâng được bằng `PETGAME_MAX_WORLDS_PER_NETWORK` nếu thấy dòng log chặn "network" mà không có kẻ phá.

**Luật đếm.**
- Mỗi lần tạo có hai khoá:
  - `address`: như hiện nay. IPv4 giữ nguyên, IPv6 tính khối /64, IPv4 viết dạng IPv6 (`::ffff:…`) tính như IPv4. Từ T67 thêm: không phải IP thì là `unknown`.
  - `network`: khối /48 nếu là IPv6 (không phải dạng `::ffff:`); `undefined` với IPv4, `unknown` và mọi thứ khác.
- Thứ tự kiểm: cả server (`maxWorlds`) → `address` (`perAddress`) → `network` (`perNetwork`, chỉ khi có khoá này). Chạm trần nào trước thì trả lần chặn đó.
- Được nhận thì cả hai khoá đều được đếm (pending, rồi gán cho phòng ở `settle`). Thế giới đóng thì trả chỗ cho cả hai.
- Dạng khoá /48: ba nhóm đầu ở hệ 16, chữ thường, không số 0 đứng đầu, rồi `::/48`, giống cách viết khoá /64 hiện có. Ví dụ `2001:db8:a:b::1` → `2001:db8:a::/48`, `::1` → `0:0:0::/48`. Khoá /64 kết thúc `::/64`, IPv4 có dấu chấm, `unknown` là chữ, nên các khoá không bao giờ trùng nhau trong cùng một bảng đếm.

**Thẻ và thông báo lỗi.** Chặn vì trần /48 thì ném `ServerError(WORLD_LIMIT_STATUS, WORLD_LIMIT_ERROR.address)`, tức đúng chữ của chặn theo địa chỉ. Sảnh (`joinFailure`) nhận ra chữ đó là `"tooMany"` và hiện thẻ "Đã mở nhiều thế giới quá": "Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau 1 phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời." Câu "Mạng bạn đang dùng" đúng cho cả hai trường hợp. Không thêm chữ mới vào `WORLD_LIMIT_ERROR`: client cũ sẽ đọc chữ lạ thành `"busy"` (thẻ server đầy), sai thẻ. Bên trong server vẫn phân biệt `"network"` để ghi log.

### 2. Chuỗi không phải IP và địa chỉ kèm cổng

`addressKey` (và `networkKey`) nhận dạng địa chỉ theo thứ tự:
1. Bỏ ngoặc vuông và cổng: chuỗi khớp `^\[([^\]]+)\](?::\d{1,5})?$` thì lấy phần trong ngoặc (`[2001:db8::1]:443` → `2001:db8::1`, `[::1]` → `::1`). Chuỗi khớp `^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$` thì lấy phần trước dấu `:` (`1.2.3.4:5678` → `1.2.3.4`). Một số proxy (ví dụ Azure Application Gateway) ghi `X-Forwarded-For` kèm cổng. Nếu không bỏ cổng thì sau khi gộp, mọi người chơi sau proxy đó chung khoá `unknown` và trần 10 chặn nhầm.
2. Bỏ phần zone sau `%` (như hiện có, nhưng làm sau bước 1, để `[fe80::1%eth0]:443` cũng nhận được).
3. `isIPv4` → khoá IPv4. `isIPv6` → khoá như mục 1. Còn lại (kể cả `undefined`, `""`, `"unknown"`, chuỗi rác, `1.2.3.4:` thiếu cổng, `::ffff:1.2.3.4:5`) → `UNKNOWN_KEY` (`"unknown"`).

Vì sao một khoá chung (giữ chữ `unknown`, không thêm khoá `invalid` riêng):
- Chuỗi rác chỉ tới được `addressKey` trong hai trường hợp: socket không còn địa chỉ (client đã cắt kết nối, `stampClientAddress` đã ghi `unknown`), hoặc `PETGAME_TRUST_PROXY` đặt cao hơn số proxy thật. Cả hai đều nghĩa là "server không xác định được người gửi", nên chung một trần là đúng nghĩa. Tách hai khoá chỉ cho kẻ phá thêm 10 chỗ.
- Proxy ghi `unknown` cho mọi người (RFC 7239 cho phép) thì trước T67 mọi người chơi cũng đã chung chuỗi `"unknown"`. Không đổi gì so với trước.

**Cảnh báo một lần.** Lần đầu `guardWorldCreation` gặp lần tạo có khoá `address === UNKNOWN_KEY`, ghi:

```
World limits: a world creation came without a usable client address; all such requests share one cap. If this repeats, check PETGAME_TRUST_PROXY (docs/deploy.md).
```

Chỉ một lần cho mỗi lần cài (biến trong closure của `guardWorldCreation`, không phải biến cấp module, để test cài lại là có cờ mới). Không bao giờ ghi chuỗi địa chỉ (giữ luật "không log địa chỉ" của T64). Ghi trước khi kiểm trần, bất kể có bị chặn hay không.

### 3. Biến môi trường và log

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PETGAME_MAX_WORLDS_PER_NETWORK` | 20 | số thế giới tối đa mỗi khối IPv6 /48 (không áp cho IPv4) |

- Kiểm như hai trần kia: số nguyên từ 1 tới `Number.MAX_SAFE_INTEGER`, sai thì bỏ qua kèm cảnh báo (dùng `intFromEnv`). Không ép quan hệ với hai trần kia: đặt `perNetwork` ≥ `maxWorlds` thì trần /48 không còn tác dụng; đặt nhỏ hơn `perAddress` thì với IPv6 trần /48 chặn trước. Cả hai đều hợp lệ, ghi vào `deploy.md`.
- Dòng log lúc khởi động (`index.ts`): `World limits: 50 worlds, 10 per address, 20 per IPv6 /48; trusting 1 proxy`.
- Dòng log khi chặn (`RefusalLog`) thêm số đếm thứ ba: `World limits: refused 1 world creation (server 0, address 0, network 1); 3 worlds open`.

## Kế hoạch triển khai

1. **`packages/shared/src/constants.ts`**
   - `WORLD_LIMITS = { maxWorlds: 50, perAddress: 10, perNetwork: 20 } as const;`
   - JSDoc thêm 2-3 câu: `perNetwork` đếm mọi địa chỉ IPv6 chung khối /48 (một khách hàng của nhà mạng nhận tới /48), để một khách hàng không chiếm hết `maxWorlds`; 20 = 2 × `perAddress`, chừa chỗ cho thuê bao di động lạ chung khối; không áp cho IPv4. Trần này cũng là giới hạn tốc độ như `perAddress`.
   - `WORLD_LIMIT_ERROR` không đổi. Thêm một câu vào JSDoc của nó: chặn theo /48 dùng chữ `address`, nên sảnh hiện cùng thẻ.

2. **`packages/server/src/worldLimits.ts`: kiểu và nhận dạng địa chỉ**
   - `export type WorldRefusal = "server" | "address" | "network";`, cập nhật JSDoc.
   - `WorldLimits` thêm `perNetwork: number;` (JSDoc: trần mỗi khối IPv6 /48).
   - `export const UNKNOWN_KEY = "unknown";` (JSDoc: khoá chung của mọi lần tạo không có địa chỉ IP dùng được). `stampClientAddress` dùng hằng này thay chữ `"unknown"`.
   - Hàm riêng (không export) `parseIp(address: string | undefined): string | number[] | undefined`. Trả về chuỗi IPv4 dạng chấm (kể cả khi viết dạng `::ffff:`), hoặc 8 nhóm số của IPv6 không phải dạng `::ffff:`, hoặc `undefined` nếu không phải IP. Làm đúng ba bước ở Thiết kế 2, dùng lại `ipv6Groups`. Mọi phép bóc tách địa chỉ chỉ nằm ở hàm này.
   - `addressKey(address)`: giữ chữ ký. Viết lại trên `parseIp`: chuỗi → giữ nguyên, nhóm số → `"<4 nhóm>::/64"` như hiện nay, `undefined` → `UNKNOWN_KEY`. Cập nhật JSDoc (bỏ cổng và ngoặc; không phải IP thì `unknown`).
   - `export function networkKey(address: string | undefined): string | undefined`: nhóm số → `"<3 nhóm>::/48"`, còn lại `undefined`. JSDoc: vì sao /48.
   - `export interface CreationKeys { address: string; network?: string }` và `export function creationKeys(address: string | undefined): CreationKeys` (gọi `parseIp` một lần, dựng cả hai khoá). Không đặt `network: undefined` tường minh khi là IPv4 thì càng tốt, nhưng không bắt buộc. Test so bằng `toEqual`, nên cả hai cách đều qua.

3. **`worldLimits.ts`: `WorldCensus` đếm hai khoá**
   - `open: Map<string, CreationKeys | undefined>` (roomId → khoá của lần tạo; `undefined` là tạo không qua HTTP).
   - `pending: Map<string, number>` giữ nguyên, nhưng đếm theo **từng chuỗi khoá**: một lần tạo IPv6 tăng cả khoá /64 lẫn khoá /48. JSDoc nói các dạng khoá không trùng nhau (lý do ở Thiết kế 1).
   - `admit(keys: CreationKeys, limits: WorldLimits): WorldRefusal | undefined`: `total() >= maxWorlds` → `"server"`; `countFor(keys.address) >= perAddress` → `"address"`; `keys.network !== undefined && countFor(keys.network) >= perNetwork` → `"network"`; nhận thì tăng pending cho `address` và (nếu có) `network`.
   - `settle(keys: CreationKeys, roomId)`: giảm pending của từng khoá (về 0 thì xoá mục, như hiện nay), gán `keys` cho phòng nếu phòng còn mở.
   - `countFor(key: string)`: pending của `key` cộng số phòng mở có `owner.address === key || owner.network === key`.
   - Tách đoạn "giảm một khoá" thành hàm riêng `private release(key)` để không lặp code. Giữ JSDoc về việc đếm đôi trong vài mili giây.

4. **`worldLimits.ts`: env, log, guard**
   - `worldLimitsFromEnv` thêm `perNetwork: intFromEnv("PETGAME_MAX_WORLDS_PER_NETWORK", env.PETGAME_MAX_WORLDS_PER_NETWORK, WORLD_LIMITS.perNetwork, 1, Number.MAX_SAFE_INTEGER)`. Cập nhật JSDoc liệt kê biến.
   - Hằng riêng `const REFUSAL_ERROR: Record<WorldRefusal, string> = { server: WORLD_LIMIT_ERROR.server, address: WORLD_LIMIT_ERROR.address, network: WORLD_LIMIT_ERROR.address };`. JSDoc: sảnh chỉ phân biệt hai chữ, chặn theo /48 hiện thẻ của địa chỉ (Thiết kế 1). Trong `invokeMethod` thay `WORLD_LIMIT_ERROR[refusal]` bằng `REFUSAL_ERROR[refusal]`.
   - `RefusalLog`: `counts` thêm `network: 0`; câu log thành `(server ${s}, address ${a}, network ${n})`; reset cả ba sau mỗi dòng.
   - Trong `guardWorldCreation`: `let warnedUnknown = false;` trong thân hàm (cạnh `stamp`). Ở nhánh `create`: `const keys = creationKeys(auth?.ip);` rồi nếu `keys.address === UNKNOWN_KEY && !warnedUnknown` thì bật cờ và `console.warn` đúng câu ở Thiết kế 2. Sau đó `census.admit(keys, …)`, `census.settle(keys, roomId)` (thay `key`).
   - Cập nhật JSDoc của `guardWorldCreation` (ba trần, chặn /48 dùng chữ của địa chỉ).

5. **`packages/server/src/index.ts`** dòng 42-44: thêm `${worldSettings.limits.perNetwork} per IPv6 /48` vào dòng log (câu ở Thiết kế 3).

6. **`scripts/dev.mjs`, `scripts/shots.mjs`, `playwright.config.ts`**: thêm `PETGAME_MAX_WORLDS_PER_NETWORK` = `"1000"` ngay cạnh `PETGAME_MAX_WORLDS_PER_ADDRESS` (`dev.mjs` giữ giá trị đã đặt: `process.env.PETGAME_MAX_WORLDS_PER_NETWORK ?? "1000"`). Lý do (ghi vào chú thích sẵn có): trình duyệt có thể vào `localhost` qua `::1`, mà `::1` thuộc khối `0:0:0::/48`, nên khi trần mỗi địa chỉ đã nâng lên 1000 thì trần /48 (20) sẽ chặn trước.

7. **`docs/deploy.md`**
   - Bảng biến (dòng 39-41): thêm dòng `PETGAME_MAX_WORLDS_PER_NETWORK | 20 | số thế giới tối đa mỗi khối IPv6 /48 (gộp mọi khối /64 của một khách hàng); không áp cho IPv4`.
   - Dòng 43: "ba trần là số nguyên ≥ 1". Thêm một câu: đặt trần /48 ≥ `PETGAME_MAX_WORLDS` là tắt nó; thấy log chặn có `network` tăng mà không có kẻ phá (nhiều người chơi di động cùng nhà mạng) thì nâng biến này.
   - Dòng 45: `npm run dev`/`npm run shots` nâng cả `PETGAME_MAX_WORLDS_PER_NETWORK` lên 1000.
   - Một câu ở mục kiểm sau deploy: proxy ghi kèm cổng (`1.2.3.4:5678`) vẫn đếm đúng. Dòng log "came without a usable client address" lặp lại nghĩa là `PETGAME_TRUST_PROXY` đang cao hơn số proxy thật (hoặc proxy ghi chữ lạ).

8. **`docs/architecture.md`** dòng 42 (mục `worldLimits.ts`): thêm `networkKey`/`creationKeys` (IPv6 gộp thêm /48 cho trần `perNetwork`), `UNKNOWN_KEY` (mọi chuỗi không phải IP, sau khi bỏ cổng và ngoặc), `WorldCensus` đếm hai khoá mỗi thế giới, biến `PETGAME_MAX_WORLDS_PER_NETWORK`, chặn /48 trả chữ `WORLD_LIMIT_ERROR.address`.

9. **Test** (mục dưới), rồi chạy `npm run typecheck`, `npx vitest run packages/server/src/worldLimits.test.ts`, `npm test`.

## Giao thức

Không đổi. Không có thay đổi ở schema, message, `Profile` hay store. HTTP vẫn trả 429 `{ code, error }` với một trong hai chữ cũ của `WORLD_LIMIT_ERROR`. Client cũ lẫn mới hiện đúng thẻ. Shared chỉ thêm một trường vào bảng hằng `WORLD_LIMITS`; client không đọc bảng này.

## Test

Tất cả trong `packages/server/src/worldLimits.test.ts`. Không cần e2e mới, vì client không đổi và thẻ `tooMany` đã có e2e/unit. `packages/client/src/net/connection.test.ts` dòng 66 đã chứng minh chữ `address` → `"tooMany"`.

**Sửa test có sẵn cho chữ ký mới:**
- `WorldCensus` (140-209): `limits` thêm `perNetwork`; `admit("a", …)` → `admit({ address: "a" }, …)`, `settle("a", …)` → `settle({ address: "a" }, …)`. Hành vi kỳ vọng không đổi.
- `RefusalLog` (87-115): câu kỳ vọng thêm `, network 0`.
- `limits from env`: `toEqual({ maxWorlds: 3, perAddress: 7 })` thêm `perNetwork`. Test "ignores bad values" đặt cả ba biến, kỳ vọng `toHaveBeenCalledTimes(3)`.
- `creating worlds over HTTP`: `settings` (248) và `beforeEach` (270-273) thêm `perNetwork: 3`, `maxWorlds: 4` và `perAddress: 2` giữ nguyên; các test `settings.limits = {…}` khác thêm `perNetwork`. Mọi test cũ dùng IPv4 nên hành vi không đổi.
- `addressKey` (81-84) "calls a missing address unknown": giữ, và dùng `UNKNOWN_KEY`.

**Test unit mới:**
1. `addressKey` "puts every string that is not an IP under one unknown key": `"unknown"`, `"garbage"`, `"1.2.3.4:"`, `"::ffff:1.2.3.4:5"`, `"%eth0"`, `"1.2.3.4.5"`, `"01.2.3.4"`, `"[::1"` đều ra `UNKNOWN_KEY`.
2. `addressKey` "drops a port and brackets a proxy added": `"1.2.3.4:5678"` → `"1.2.3.4"`; `"[2001:db8:a:b::1]:443"` → `"2001:db8:a:b::/64"`; `"[::1]"` → `"0:0:0:0::/64"`; `"[::ffff:1.2.3.4]:80"` → `"1.2.3.4"`; `"[fe80::1%eth0]:443"` → `"fe80:0:0:0::/64"`.
3. `networkKey` "groups IPv6 by its /48 block": `"2001:db8:a:b:1:2:3:4"` và `"2001:DB8:A:FF::1"` → `"2001:db8:a::/48"`; `"2001:db8:b::1"` khác khoá trên; `"::1"` → `"0:0:0::/48"`; `"[2001:db8:a:b::1]:443"` → `"2001:db8:a::/48"`.
4. `networkKey` "has no /48 for IPv4, mapped IPv4 or non-IP": `"203.0.113.5"`, `"::ffff:203.0.113.5"`, `"::ffff:cb00:7105"`, `undefined`, `"unknown"`, `"garbage"` → `undefined`.
5. `creationKeys`: `"2001:db8:a:b::9"` → `{ address: "2001:db8:a:b::/64", network: "2001:db8:a::/48" }`; `"203.0.113.5"` → `toEqual({ address: "203.0.113.5" })`; `"garbage"` → `toEqual({ address: UNKNOWN_KEY })`.
6. `WorldCensus` "refuses a /48 at its cap across different /64 blocks" với `{ maxWorlds: 10, perAddress: 2, perNetwork: 3 }`: `creationKeys` của `2001:db8:1:1::1`, `2001:db8:1:1::2`, `2001:db8:1:2::1` được nhận; `2001:db8:1:3::1` → `"network"`; `2001:db8:2:1::1` được nhận; `203.0.113.1` được nhận; `countFor("2001:db8:1::/48")` = 3.
7. `WorldCensus` "checks the address cap before the /48 cap": `{ maxWorlds: 10, perAddress: 2, perNetwork: 2 }`, hai lần cùng `2001:db8:1:1::1` được nhận, lần thứ ba → `"address"`.
8. `WorldCensus` "frees the /48 place when a world settles empty or closes": admit IPv6, `settle(keys, undefined)` → `countFor` của cả `/64` và `/48` về 0. Admit lại, `opened("r1")`, `settle(keys, "r1")` → cả hai = 1; `closed("r1")` → cả hai = 0, `total()` = 0.
9. "default caps keep one IPv6 customer below the server cap": `WORLD_LIMITS.perAddress <= WORLD_LIMITS.perNetwork` và `WORLD_LIMITS.perNetwork < WORLD_LIMITS.maxWorlds`.
10. `limits from env`: `PETGAME_MAX_WORLDS_PER_NETWORK: "5"` → `perNetwork: 5`; mặc định `perNetwork` = `WORLD_LIMITS.perNetwork`.
11. `RefusalLog` "counts /48 refusals apart": `note("network", 0, 7)` → `"World limits: refused 1 world creation (server 0, address 0, network 1); 7 worlds open"`.

**Test tích hợp mới** (trong `creating worlds over HTTP`, `settings.trustProxy = 1`):
12. "refuses a world over the /48 cap across /64 blocks, with the address card": `limits = { maxWorlds: 10, perAddress: 2, perNetwork: 3 }`. `x-forwarded-for` lần lượt `2001:db8:1:1::1`, `2001:db8:1:2::1`, `2001:db8:1:3::1` → 200. `2001:db8:1:4::1` → 429 và `json().error === WORLD_LIMIT_ERROR.address`. `2001:db8:2:1::1` → 200, `203.0.113.1` → 200. `worldCensus.countFor("2001:db8:1::/48") === 3`.
13. "puts every non-IP address under one key and warns once without the address": `limits = { maxWorlds: 10, perAddress: 2, perNetwork: 3 }`, `vi.spyOn(console, "warn")`. `x-forwarded-for` `"garbage-1"` → 200, `"garbage-2"` → 200, `"unknown"` → 429 (`WORLD_LIMIT_ERROR.address`). Số lần gọi `console.warn` có chứa `"usable client address"` đúng bằng 1, và không lần gọi nào chứa `"garbage"`. Muốn cờ cảnh báo mới thì test tự `unguard()` rồi `unguard = guardWorldCreation(server, settings)` ở đầu test (như mẫu "is undone completely"), để không phụ thuộc thứ tự test. Chú thích trong test giải thích lý do. Lưu ý: dòng log chặn của `RefusalLog` cũng gọi `console.warn`; chỉ đếm lời gọi chứa `"usable client address"`.
14. "counts an address with a port as that address": `limits` mặc định của `beforeEach` (`perAddress: 2`). `"203.0.113.9:1111"` → 200, `"203.0.113.9:2222"` → 200, `"203.0.113.9"` → 429.

`afterEach` sẵn có (chờ `worldCensus.total()` về 0) bảo đảm mọi khoá /48 được trả hết sau mỗi test.

## Tiêu chí hoàn thành

- [ ] `WORLD_LIMITS` có `perNetwork: 20` với JSDoc nêu lý do; `WORLD_LIMIT_ERROR`, `WORLD_LIMIT_STATUS` không đổi; không file nào trong `packages/client/src` bị sửa.
- [ ] Một lần tạo từ IPv6 được đếm vào cả khoá /64 và khoá /48; IPv4 (kể cả dạng `::ffff:` chấm hay hex) không có khoá /48.
- [ ] Chạm trần /48 thì HTTP trả 429 với `error` = `WORLD_LIMIT_ERROR.address`, không phòng nào được tạo (test 12).
- [ ] Mọi chuỗi không phải IP (sau khi bỏ cổng, ngoặc, zone) cho ra `UNKNOWN_KEY` và chung trần `perAddress` (test 1, 13). `1.2.3.4:5678` và `[v6]:port` được tính như địa chỉ không cổng (test 2, 14).
- [ ] Cảnh báo "usable client address" in đúng một lần mỗi lần cài, không chứa địa chỉ (test 13).
- [ ] `PETGAME_MAX_WORLDS_PER_NETWORK` đọc qua `intFromEnv`, giá trị sai bị bỏ qua kèm cảnh báo (test 10 và test "ignores bad values").
- [ ] `RefusalLog` đếm `network` riêng; dòng log khởi động ghi trần /48.
- [ ] `dev.mjs`, `shots.mjs`, `playwright.config.ts` nâng `PETGAME_MAX_WORLDS_PER_NETWORK` lên 1000 kèm lý do `::1`.
- [ ] Việc bóc tách địa chỉ chỉ nằm trong `parseIp`; `addressKey`, `networkKey`, `creationKeys` không tự bóc tách lại.
- [ ] `docs/deploy.md` và `docs/architecture.md` cập nhật như bước 7, 8; khớp với `docs/design/multiplayer.md` (đã cập nhật).
- [ ] Tất cả test cũ của `worldLimits.test.ts` còn qua, chỉ đổi chữ ký hoặc câu log, không nới kỳ vọng nào. Có 14 test mới ở mục Test.
- [ ] `npm run typecheck`, `npm test` sạch; `npm run test:e2e` vẫn qua (trần đã nâng trong `playwright.config.ts`).

## Rủi ro, câu hỏi mở

- **Chặn nhầm người dùng di động** chung khối /48: chấp nhận với trần 20 (Thiết kế 1). Chưa có số đo thật về số thuê bao mỗi /48 của các nhà mạng Việt Nam. Dòng log chặn giờ tách `network`, nên người vận hành thấy được và nâng bằng biến môi trường. Không chặn tiến độ.
- **Bỏ cổng có thể đổi khoá của ai đó?** Trước T67, `1.2.3.4:5678` là một khoá riêng cho mỗi kết nối, nên trần mỗi địa chỉ không có tác dụng với proxy kiểu đó. Nay mọi người sau proxy đó được đếm đúng theo địa chỉ thật. Đây là sửa đúng hướng; Fly và Render không ghi cổng, nên deploy hiện tại không bị ảnh hưởng.
- **Xung đột với T68** (cũng sửa `RefusalLog`): T67 chỉ thêm một số đếm; T68 làm sau, dựa trên câu mới. Agent chính nên chuyển cho T68 ghi chú "câu log đã có `network` từ T67".
- **`::1` trong dev/e2e**: nếu quên nâng `PETGAME_MAX_WORLDS_PER_NETWORK` ở bước 6, e2e mở hơn 20 thế giới qua `localhost` → `::1` sẽ gặp 429 ngẫu nhiên. Bước 6 bắt buộc.
- Không có dòng CHẶN.
