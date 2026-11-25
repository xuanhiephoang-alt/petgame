# PLAN: T24 Kết nối lại: các trường hợp mạng xấu còn hở (sau T3)

Code đọc ở HEAD sau commit T22. Nguồn:
- dòng T24 và T25 trong `TASKS.md`;
- `PROGRESS.md` và `REVIEW.md` của commit T3 `80a70ea` (mục "Rủi ro và đề xuất" của coder Bước B; góp ý 1 và 4 của reviewer);
- `docs/design/multiplayer.md` (mục "Rời chủ động và rớt mạng" đến "Đã cân nhắc và chấp nhận");
- `packages/server/src/rooms/GameRoom.ts` (`onJoin`, `onDrop`, `onReconnect`, `onLeave`, `removePlayer`, `endSession`), `systems/wild.ts` (`handleThrow`), `http.ts`, `index.ts`;
- `packages/client/src/net/reconnect.ts`, `net/connection.ts`, `main.ts` (`startGame`, `enter`), `ui/connection.ts`, `ui/strings.ts` (`CONNECTION_TEXT`);
- `GameRoom.test.ts` (describe `reconnecting after a dropped connection`: `cutConnection`, `holdReconnect`, `reconnected`, `crowd`, `holdsOf`), `reconnect.test.ts`;
- `tests/e2e/multiplayer.spec.ts` (chỉ đọc: `openWithSwitch`, các test `connection:`);
- mã nguồn `@colyseus/core` 0.18.18 `Room.mjs` (`_onJoin`, `allowReconnection`, `_onLeave`, `_onMessage` với `JOIN_ROOM`) và `@colyseus/sdk` 0.18.5 `Room.mjs` (`onclose`, `handleReconnection`, `retryReconnection`), `Reconnection.mjs`, `transport/WebSocketTransport.mjs` (`close`).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder**, hai bước như T3. **Bước A** gồm server và test tích hợp; **Bước B** gồm client, e2e và tài liệu. Mỗi bước commit được riêng, nhưng nhiệm vụ chỉ xong khi cả hai qua tester và reviewer. Không có việc hình ảnh.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Không chạy `git stash`.

## Chia việc

| Lỗ hổng | Làm ở | Lý do |
|---|---|---|
| (a) Mạng chập chờn làm mất chỗ, client nhận 4003 | **T24** (A + B) | Người chơi thật gặp: đang chơi thì văng ra "Không kết nối lại được" chỉ vì mạng giật vài lần trong một giây. |
| (b) Một lần thử bị treo làm kẹt cả 30 giây | **T24** (B) | Người chơi thật gặp, nhất là với Wi-Fi có cổng đăng nhập hoặc 4G chết nửa chừng. Sửa nhỏ, chỉ ở client. |
| (e) Test ném thú đầu đàn rồi nối lại trước khi bóng khép | **T24** (A) | Test rẻ, dùng hàm cắt mạng sẵn có, khoá một sửa của T8. |
| (c) Android giữ socket khi trang ẩn lâu | **T24b** | Muốn bảo vệ người chơi lúc trang ẩn mà không làm socket nối lại liên tục ở nền thì cần một tin mới kiểu "đang vắng" (đổi giao thức). Việc này cũng dính luật chống né đòn của T25. Đề xuất ở cuối file. |
| (d) e2e `freeze()` chưa đi qua đường truyền chết thật | **T24b** | Sửa thẳng `freeze()` thì phải đụng `multiplayer.spec.ts`. T24 tạo sẵn `tests/e2e/reconnect.spec.ts` với bản chép `openWithSwitch`, nên T24b chỉ cần thêm một công tắc ở đó. |

## Mục tiêu

- **(a)** Mạng giật liên tục (mỗi khoảng có mạng dưới 1 giây) không còn đẩy người chơi ra màn "Không kết nối lại được". Game tự vào lại thế giới bằng token thiết bị: người chơi đứng **đúng chỗ cũ, với đúng lượng máu cũ**, thú và đồ còn nguyên.
- **(b)** Một lần thử nối lại bị treo (đã mở kết nối mà server không trả lời) bị bỏ sau vài giây và game thử lần mới, nên người chơi quay lại trong khoảng 10-12 giây thay vì chờ hết 30 giây rồi thấy "Không kết nối lại được".
- **(e)** Có test giữ cho người ném không nhận tin ★ hai lần khi họ nối lại giữa lúc bóng còn lắc.

## Phạm vi

**Làm:**
- **Bước A, server:**
  - điểm quay lại (vị trí, máu, màu, hồi chiêu Ăn) cho phiên mất chỗ vì kết nối chết lúc đang quay vào;
  - phiên mới cùng token trong cùng thế giới dùng điểm này;
  - route `POST /resume` để client hỏi "có quay lại được không" mà không dùng hết điểm;
  - test tích hợp, gồm cả (e).
- **Bước B, client:**
  - hạn cho mỗi lần thử nối lại (b);
  - lý do mất kết nối mới, `refused`;
  - tự vào lại qua sảnh, tối đa một lần mỗi phút;
  - spec e2e mới `tests/e2e/reconnect.spec.ts`;
  - tài liệu.

**KHÔNG làm:**
- Không đổi `schema.ts`, `messages.ts`, `JoinOptions`, `Profile` hay `store.ts`. Hồ sơ đã lưu không đổi: điểm quay lại chỉ nằm trong bộ nhớ của phòng.
- Không thêm mã đóng (close code) mới; không đổi `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `STALL_MS`, `PING_EVERY_MS`.
- **Không cho quay lại sau khi hết 20 giây chờ** (hay sau `debug:endGrace`). Lúc đó vẫn là "Không kết nối lại được" với nút Về sảnh như T3. Lý do ở Thiết kế 1. Nhờ vậy hai test e2e `connection: when the world has let the player go…` trong `multiplayer.spec.ts` vẫn đúng mà không phải sửa.
- Không mang vị trí và máu sang khi thiết bị vào lại lúc phiên cũ còn kết nối (tab thứ hai) hay đang được giữ chỗ (tab bị giết rồi mở lại). Hai trường hợp đó đã có từ trước; test `eating: a new session of the same device starts without a wait (and at full health…)` giữ nguyên.
- Không làm (c), (d) (xem Chia việc), không làm T25.
- Không dựng lại `Game` trên một `Room` mới ngay trong trang: `Game` không có hàm dọn (Pixi, listener trên `window`/`document`). Vào lại đi qua sảnh bằng một lần tải trang (Thiết kế 3).

## Thiết kế

### 1. (a) Vì sao mất chỗ, và vì sao chỉ token thiết bị cứu được

Đối chiếu mã nguồn Colyseus 0.18:
1. Server nhận lần nối lại: `allowReconnection(...).resolve(newClient)`, rồi gọi `onReconnect` (đặt `offline = false`), rồi gửi `JOIN_ROOM` kèm **mã kết nối lại mới T2**. Mã cũ T1 đã dùng hết. Từ đây đến khi client xác nhận `JOIN_ROOM`, `newClient` ở trạng thái `JOINING` và `_enqueuedMessages` vẫn là mảng.
2. Socket chết đúng lúc đó (mạng giật). `_onLeave` gọi `onDrop(newClient)` (trạng thái `JOINING` không phải `RECONNECTING`), và `allowReconnection` trả Promise bị từ chối ("not joined", vì `_enqueuedMessages !== undefined`). `GameRoom.onDrop` thấy hold không phải `Deferred` nên trả về. Colyseus gọi `onLeave` ngay: người chơi bị lưu rồi xoá, chỗ trống.
3. Client chưa nhận `JOIN_ROOM` nên chỉ có T1; hoặc đã nhận T2 nhưng server đã thôi giữ chỗ. Lần thử sau bị từ chối ở tầng transport (`hasReservedSeat` sai), mã **4003** `FAILED_TO_RECONNECT`. SDK gọi `onLeave(4003)`, và `ConnectionWatch` báo `lost: failed`.

Không có cách nào để server giữ chỗ bằng T1 (Colyseus đã huỷ nó), và chọc vào trường riêng `_enqueuedMessages` của Colyseus chỉ cứu được trường hợp client đã nhận T2. Danh tính duy nhất còn lại là **token thiết bị**: client vào lại thế giới như một phiên mới, và server đặt phiên mới vào đúng chỗ của phiên vừa mất.

**Khi nào được quay lại.** Chỉ khi server *không giữ được chỗ* cho một lần rớt: `onDrop` gặp hold không phải `Deferred` trong khi người chơi còn trong phòng. Đó chính là trường hợp (a), cộng hai trường hợp vô hại:
- kết nối chết trước khi xác nhận lần vào đầu tiên: điểm quay lại khi đó là chỗ xuất hiện, máu đầy;
- phòng đang đóng: điểm chết theo phòng.

Không tạo điểm quay lại khi:
- hết 20 giây chờ, hay `debug:endGrace`: server đã cố tình thôi giữ chỗ. Thiết kế T3 và T23 đã chốt "vào lại từ sảnh là một phiên mới", và màn "Không kết nối lại được" là đúng nghĩa. Ở trường hợp (a) thì khác: người chơi chưa hề vắng lâu, chỗ mất vì một lỗi thời điểm;
- rời chủ động (4000), bị thay (4201): `onDrop` không chạy, hoặc người chơi đã bị xoá trước đó.

**Điểm quay lại (`ResumePoint`)** gồm `x`, `y`, `hp`, `color`, `nextEatAt` (giờ của đồng hồ phòng) và `until` = lúc ghi + `resumeMs`.
- `resumeMs` = `RECONNECT_GRACE_MS` (20 s), là trường của `GameRoom` để test rút ngắn.
- Vì sao đủ: ở (a), client nhận 4003 trong vòng khoảng 2 s sau khi chỗ mất (độ trễ thử lại tối đa `maxDelay` 2 s), hỏi `/resume` (tối đa 3 s), rồi tải sảnh và vào. Sảnh ở 3G chậm mất 6,8 s (T43), vào phòng khoảng 1 s. Tổng ≤ 13 s < 20 s.

**Phiên mới cùng token trong cùng phòng**, trong hạn, dùng điểm này **một lần** (lấy ra là xoá):
- vị trí và máu như cũ (không hồi máu, không dịch về giữa bản đồ);
- màu cũ nếu chưa ai dùng, không thì `pickColor()`;
- hồi chiêu Ăn còn lại;
- mọi thứ khác lấy từ hồ sơ như mọi lần vào (thú, đồ, trại, nhiệm vụ). Thú đi theo được gọi ra cạnh chủ như thường.

Quá hạn thì phiên mới như mọi phiên mới (giữa bản đồ, máu đầy). Trường hợp hiếm này không cần báo.

**Chống né đòn (T25) và chống hồi máu.** Quay lại không cho thêm gì:
- máu và vị trí y nguyên;
- mọi thú đang đánh họ đã thôi từ `onDrop`/`removePlayer` (như T3);
- trong lúc họ ở ngoài thế giới thì không gì chạm được họ, như lúc được giữ chỗ.

Mẹo "đóng socket liên tục" của T25 không mạnh hơn trước. Ngược lại, T24 còn bịt một đường hồi máu đang có: hôm nay, mất chỗ kiểu (a) rồi bấm Về sảnh và Vào chơi thì được đầy máu ở giữa bản đồ. Việc tự vào lại bị chặn ở một lần mỗi 60 giây (Thiết kế 3), nên không thành vòng lặp tải trang.

**Thế giới đủ 5 người:** chỗ trống ra lúc `onLeave`, nên một người mới có thể vào trước. Khi đó lần vào lại gặp thẻ "Thế giới đã đủ 5 người" của sảnh. Hiếm (cần phòng đủ người *và* đúng khe vài trăm ms); chấp nhận và ghi vào tài liệu.

### 2. Route `POST /resume` (client hỏi trước khi tải lại trang)

Sau 4003, client phải biết đây là (a) (vào lại được, đúng chỗ) hay "hết giờ chờ" (giữ màn T3). Mã 4003 giống hệt ở cả hai, và client không có cách nào tự phân biệt. Client không thể cứ tải lại trang rồi mới thử: nếu bị từ chối thì người chơi đã rời màn game, và hai test e2e của T3 sẽ hỏng. Vì vậy client hỏi server trước, bằng một yêu cầu không dùng hết điểm quay lại.

- **Yêu cầu:** `POST /resume`, thân là chuỗi JSON `{"room":"<roomId>","token":"<token thiết bị>"}` gửi với `Content-Type: text/plain`. Đây là "simple request" của CORS nên trình duyệt không gửi preflight; ở dev, client chạy ở 5173 còn server ở 2567. Token nằm trong thân, không nằm trên URL, nên không vào nhật ký hay lịch sử.
- **Trả lời:** `200 {"resume": true|false}` kèm `Cache-Control: no-store` và `Access-Control-Allow-Origin: *`. Trả 400 khi thân không phải JSON, token sai dạng (`isValidToken`), hoặc `room` không phải chuỗi 1-64 ký tự `[A-Za-z0-9_-]`. Giới hạn thân 1 kB.
- **Server:** `installRoutes` nhận thêm tuỳ chọn `canResume?: (roomId: string, token: string) => boolean`; không có thì route trả `{resume:false}`. `index.ts` truyền một hàm tìm phòng trong process (`matchMaker.getLocalRoomById(roomId)`; coder kiểm tên hàm trong `@colyseus/core` 0.18.18) và gọi `room.canResume(token)` nếu đó là `GameRoom`. Nhờ vậy `http.ts` không phụ thuộc `GameRoom` và test được bằng hàm giả.
- **Bảo mật:** chỉ trả một bit, và phải biết cả id phòng lẫn token 16-64 ký tự ngẫu nhiên. Không đụng SQLite, không tạo phòng (giới hạn thế giới T64 không liên quan). Service worker không lưu POST. Client trên CDN riêng (`VITE_SERVER_URL`) vẫn gọi được nhờ `Access-Control-Allow-Origin: *`.

### 3. (a) Client: lý do `refused` và tự vào lại qua sảnh

- **`ConnectionWatch`:** nhận `onLeave(4003)` khi đang `reconnecting` (trước hạn bỏ cuộc 30 s của chính nó) thì báo `lost` với lý do mới **`refused`** (server từ chối mã kết nối lại). 4003 lúc khác vẫn là `failed`. Làm qua hàm thuần `lostReason(code, reconnecting)`.
- **`startGame` (`main.ts`)** khi gặp `refused`:
  1. Màn che giữ "Đang kết nối lại…" (không đổi gì trước mắt người chơi).
  2. Nếu `mayRejoinAgain(lần tự vào lại trước, bây giờ)` (lần trước cách quá `AUTO_REJOIN_GAP_MS` = 60 s, hoặc chưa có) **và** `await canResume(room.roomId)` là `true`:
     - ghi `sessionStorage`: `petgame:autoEnter` = roomId, `petgame:autoRejoinAt` = bây giờ;
     - màn che hiện chữ `refused` ("Đang vào lại thế giới…", vòng quay, nút Về sảnh xám, không lấy focus);
     - `location.assign(lobbyUrl(roomId, true))`.
  3. Không thì màn che hiện `{ lost, failed }`: "Không kết nối lại được", Về sảnh có focus, đúng như T3.
- **Sảnh (`main.ts`, lúc nạp):** đọc rồi **xoá ngay** `petgame:autoEnter`. Nếu nó bằng `?room=` của địa chỉ thì ngay sau khi sảnh sẵn sàng (sau khi bắn `petgame:lobby-ready`) gọi `enter()`, với tên và ngoại hình đã lưu. Mọi lỗi khi vào hiện thẻ như thường:
  - thế giới đã đóng: một mình thì `quietRetry` vào thế giới mới, có bạn bè thì thẻ "đã đóng";
  - đủ 5 người: thẻ "đủ người".
- **Vì sao 60 giây:** mạng giật đến mức mất chỗ hai lần trong một phút thì tải trang liên tục chỉ làm người chơi khó chịu thêm. Lần thứ hai cho người chơi tự quyết bằng nút Về sảnh. Thời điểm nằm trong `sessionStorage` nên sống qua lần tải trang của chính tab đó.
- **Vì sao tải trang thay vì dựng lại game trong trang:** xem mục KHÔNG làm. Tải lại mất vài giây, nhưng các file `/build/*` và ảnh đã có trong bộ nhớ đệm (và service worker trên HTTPS), nên trang lên nhanh.
- `canResume(roomId)` (`net/connection.ts`): `fetch(`${serverUrl()}/resume`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ room: roomId, token: deviceToken() }), signal: AbortSignal.timeout(RESUME_CHECK_MS) })`, với `RESUME_CHECK_MS` = 3000. Lỗi mạng, hết giờ, khác 200, JSON lạ: đều trả `false`.

**Chữ mới** (`ui/strings.ts`, `CONNECTION_TEXT.refused`):

| | |
|---|---|
| Tiêu đề | `Đang vào lại thế giới…` |
| Dòng dưới | `Mạng chập chờn nên game phải vào lại thế giới. Nhân vật của bạn vẫn đứng chỗ cũ.` |

`ConnectionOverlay.show`: `lost`/`refused` vẽ như `reconnecting` (class `reconnecting`, vòng quay, nút xám) và không lấy focus. Nút Về sảnh vẫn bấm được: nếu bấm trong lúc chờ tải trang thì cũng tới đúng sảnh đó. Cỡ chạm 44 px giữ như T3.

### 4. (b) Hạn cho mỗi lần thử nối lại

Theo mã SDK: mỗi lần thử hỏng (socket đóng) gọi `onDrop` rồi `retryReconnection`, tăng `reconnection.retryCount` lên 1 và hẹn lần sau sau `min(maxDelay, …)` ≤ 2 s. Một lần thử đã mở TCP mà không bao giờ nhận `JOIN_ROOM` hay `close` thì không có gì gọi lại `retryReconnection`. `retryCount` đứng yên đến khi `ConnectionWatch.giveUp` (30 s).

**Luật** (trong `ConnectionWatch.check()`, mỗi `PING_EVERY_MS` = 2 s, khi đang `reconnecting`):
- Ghi lại `retryCount` và thời điểm nó đổi lần cuối.
- Nếu `retryCount` đứng yên quá **`HUNG_TRY_MS` = `SDK_RECONNECTION.maxDelay` + `STALL_MS` = 8 000 ms** **và** socket hiện tại đang mở dở hoặc đã mở (`readyState` 0 hoặc 1), thì `room.connection.close(CloseCode.MAY_TRY_RECONNECT)` và đặt lại mốc thời gian.
- `WebSocketTransport.close(4010)` gọi ngay `onclose` của SDK (không chờ bắt tay đóng), nên SDK coi như một lần rớt và thử lần mới ngay.

**Vì sao an toàn:**
- *Đang chờ hẹn (giữa hai lần thử):* socket hiện tại là socket cũ đã đóng hoặc đang đóng (`readyState` 2 hay 3), nên không bao giờ bị đóng lần nữa. Đóng vào lúc này sẽ làm SDK hẹn thêm một lần thử song song: hai lần thử cùng mã, lần sau nhận 4003 và giết cả phòng.
- *8 s:* độ trễ trước một lần thử tối đa 2 s, nên lần thử bị đóng đã mở ít nhất 6 s (= `STALL_MS`, cùng mức im lặng mà lúc online đã coi là treo). Một lần nối lại lành mạnh cần khoảng 4 vòng đi về; ở mạng rất chậm (1 s mỗi vòng) là khoảng 4 s.
- *Trang vừa ngủ* (khoảng cách giữa hai lần kiểm > `SLEPT_GAP_MS`): đặt lại mốc, không đóng. Hẹn giờ của SDK cũng bị dừng theo.
- *Kết quả:* trong 30 s có chỗ cho khoảng 3 lần thử bị treo được thay. Người chơi quay lại sau khoảng 10-12 s, vẫn trong 20 s giữ chỗ, đúng phiên, không cần tải trang.

`WatchedRoom` thêm:
- `reconnection.retryCount: number`;
- `connection.transport: unknown`. Hàm cục bộ `socketState(transport)` đọc `ws.readyState` lúc chạy (thu hẹp kiểu bằng `typeof`/`in`), vì `ITransport` của SDK không khai báo `ws`, và một kiểu toàn trường tuỳ chọn sẽ vướng luật "weak type" của TypeScript.

Phần quyết định là hàm thuần `isTryHung(stillMs: number, readyState: number | undefined): boolean`, có unit test.

**(a) và (b) ghép được với nhau:** nếu server đã nhận lần thử bị treo (giống bước 1 ở Thiết kế 1) rồi ta đóng nó, thì server mất chỗ đúng kiểu (a), client nhận 4003, và lộ trình `refused` đưa người chơi về đúng chỗ.

### 5. (e) Ném thú đầu đàn rồi nối lại trước khi bóng khép

`Wild.handleThrow` hẹn tin ★ và XP sau `captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS`. Lúc đó nó tìm lại client hiện tại của phiên (`this.room.clients.find(...)`) để loại người ném khỏi `announce`, chứ không dùng `client` của lần ném, vì sau khi nối lại phiên có một `Client` mới. Test mới khoá điều này: nếu đổi về `client` cũ, người ném vừa nối lại sẽ nhận ★ lần thứ hai.

## Kế hoạch triển khai

### Bước A: server và test tích hợp (một commit)

1. **`packages/server/src/systems/resume.ts` (mới, hàm thuần, JSDoc tiếng Anh):**
   - `export interface ResumePoint { x: number; y: number; hp: number; color: number; nextEatAt: number; until: number }`
   - `noteResume(points: Map<string, ResumePoint>, token: string, point: ResumePoint)`: ghi, đè điểm cũ cùng token.
   - `peekResume(points, token, now): boolean`: còn hạn hay không, không xoá.
   - `takeResume(points, token, now): ResumePoint | undefined`: lấy ra và xoá; quá hạn thì xoá và trả `undefined`.
   - Mỗi lần `noteResume` và `takeResume` dọn các điểm đã quá hạn (Map chỉ lớn bằng số thiết bị vừa mất chỗ trong 20 s).
2. **`packages/server/src/systems/resume.test.ts` (mới):**
   - ghi rồi lấy được đúng một lần;
   - quá hạn thì không lấy được;
   - `peekResume` không xoá;
   - điểm mới đè điểm cũ;
   - dọn điểm quá hạn của token khác.
3. **`GameRoom.ts`:**
   - Trường `resumes = new Map<string, ResumePoint>()` và `resumeMs = RECONNECT_GRACE_MS`, cạnh `holds`/`reconnectGraceMs`, kèm JSDoc.
   - `onDrop`: trong nhánh `if (!(hold instanceof Deferred))`, trước `return`, nếu có `control.token` thì gọi `noteResume(this.resumes, control.token, { x: player.x, y: player.y, hp: player.hp, color: player.color, nextEatAt: control.nextEatAt, until: now + this.resumeMs })` (`now` = `this.clock.currentTime`). Sửa chú thích của nhánh: "the place could not be held (the connection died while the player was still coming back, or the room is closing): onLeave follows at once; a fresh join by the same device in time takes this spot back".
   - `onJoin`: sau `endSession(older)` và `store().load`, `const resume = token ? takeResume(this.resumes, token, this.clock.currentTime) : undefined;`. Khi có `resume`:
     - `player.x/y = resume.x/y`;
     - `player.hp = resume.hp`;
     - `player.color = resume.color` nếu không người chơi nào khác đang dùng, không thì `this.pickColor()`. Ô ngoại hình mặc định (`slot`) tính theo màu cuối cùng;
     - `nextEatAt: resume.nextEatAt` trong `controls.set`.

     Không có thì giữ nguyên như hiện nay.
   - Phương thức công khai `canResume(token: string): boolean` (gọi `peekResume`), kèm JSDoc nói route `/resume` dùng nó.
4. **`packages/server/src/http.ts`:** `installRoutes` nhận thêm `canResume?: (roomId: string, token: string) => boolean`; thêm `app.post("/resume", express.text({ type: "text/plain", limit: "1kb" }), …)` theo Thiết kế 2. JSDoc của `installRoutes` nhắc thêm `/resume`.
5. **`packages/server/src/index.ts`:** truyền `canResume` tìm phòng trong process theo Thiết kế 2.
6. **`http.test.ts`:** test `/resume`:
   - đúng dạng thì trả đúng giá trị của hàm giả, kèm header `no-store` và `Access-Control-Allow-Origin`;
   - thân sai, token sai dạng, room sai dạng thì 400;
   - không có `canResume` thì `{resume:false}`;
   - gửi `text/plain` (không preflight) thì qua.
7. **`GameRoom.test.ts`**, trong describe `reconnecting after a dropped connection` (dùng `cutConnection`, `holdReconnect`, `reconnected`, `useStore(new SqliteStore(":memory:"))`, token riêng mỗi test):
   - **A1** `a place lost while coming back (the line died before the client heard JOIN_ROOM) is refused with the old code, and the device token takes the same spot back with the same health`:
     - Dựng: `setup(token)`, `capture` cho có thú, đặt `player.x/y` ra một chỗ rõ ràng khác chỗ xuất hiện, `player.hp = 37`, `control.nextEatAt = now + 60_000`. Mở `holdReconnect`, `cutConnection`, chờ `offline`.
     - Trước khi mở cổng, thay `client.connection.events.onmessage` bằng một hàm chạy một lần: trả lại hàm gốc rồi `(client.connection.transport as any).ws.terminate()`. Tin đầu tiên của lần nối lại là `JOIN_ROOM`, nên client không bao giờ đọc được nó, và server thấy socket đóng khi phiên còn `JOINING`.
     - Mong đợi:
       - `client.onLeave` nhận `CloseCode.FAILED_TO_RECONNECT`;
       - người chơi và thú biến khỏi phòng;
       - `room.canResume(token)` là `true`.
     - Rồi `colyseus.connectTo(room, { name: "Tester", token })`: phiên mới có `x/y` đúng chỗ cũ, `hp` 37, cùng `color`, cùng thú, `nextEatAt` mang sang; `canResume(token)` thành `false` (dùng một lần).
     - Một phiên mới nữa cùng token (tab khác) thì về chỗ xuất hiện với máu đầy.
   - **A2** `a drop whose grace runs out (or is ended by the test hook) leaves nothing to take back: the device starts afresh`: `reconnectGraceMs = 1000`, `reconnection.enabled = false`, chờ người chơi bị xoá. `canResume(token)` là `false`; vào lại thì ở chỗ xuất hiện, máu đầy. Cùng test: rời chủ động (`leave()`) cũng không để lại điểm.
   - **A3** `a spot to take back lasts resumeMs`: `resumeMs = 300`, tạo mất chỗ như A1, chờ quá 300 ms theo đồng hồ phòng (`ticks`), `canResume` là `false`, vào lại thì ở chỗ xuất hiện, máu đầy.
   - **A4 (e)** `a pack leader caught while the thrower drops and comes back before the ball clicks shut: no second ★ for the thrower, one for the others, the XP paid once`:
     - Dựng như test `caught, everyone else hears the news…` (`giveCompanion(..., "emberpup", 6)`, `alphaOf(room, "cactoad")`, `watcher`, mock `Math.random` về 0). Ném, chờ `CaptureResult` (thành công, `alpha: true`), ghi mốc `revealAt = currentTime + captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS`.
     - `holdReconnect`, `cutConnection`, chờ `offline`, mở cổng, chờ `reconnected`. Kiểm `room.clock.currentTime < revealAt`: nếu không thì test tự báo là không kết luận được, không qua suông.
     - Chờ quá `revealAt` vài tick. Mong đợi: tin `Notice` của người ném (collect đăng ký trước khi cắt; SDK nối lại trên cùng `Room` nên listener còn) không có tin nào bắt đầu bằng "★"; watcher có đúng 1 tin ★ `★ Tester đã bắt được Cactoad đầu đàn!`; `owned` nhận XP đúng một lần (`addXp({ level: 6, xp: 0 }, finishXp(XP_PER_CAPTURE, level) + ALPHA.xp)`).
   - Mở rộng test có sẵn `the test hook that ends the wait lets a dropped player go at once`: sau khi người chơi bị xoá, `canResume(token)` là `false` (cần `setup(token)`; nếu test hiện không dùng token thì thêm).
8. `npm run typecheck`, `npm test`.

### Bước B: client, e2e, tài liệu (một commit)

1. **`packages/client/src/net/reconnect.ts`:**
   - `LostReason` thêm `"refused"`;
   - `lostReason(code, reconnecting = false)`: 4003 khi `reconnecting` thì `refused`;
   - hằng `HUNG_TRY_MS` và `AUTO_REJOIN_GAP_MS` (JSDoc nói vì sao, theo Thiết kế 3 và 4);
   - hàm thuần `isTryHung(stillMs, readyState)` và `mayRejoinAgain(lastAt: number | null, now: number)` (`lastAt` không phải số hữu hạn thì coi như chưa có);
   - `WatchedRoom` thêm `reconnection.retryCount`, `connection.transport`;
   - `ConnectionWatch`:
     - trường `tryCount`, `tryChangedAt`;
     - `onLeave` gọi `lostReason(code, this.current.state === "reconnecting")`;
     - `check()` có nhánh `reconnecting` theo Thiết kế 4, với trang vừa ngủ thì đặt lại mốc;
     - `dropped()` đặt `tryChangedAt = Date.now()`.

   Sửa JSDoc của lớp: thêm việc thay lần thử bị treo.
2. **`reconnect.test.ts`**, stand-in room thêm `reconnection.retryCount` và `connection.transport.ws.readyState`:
   - `lostReason`: bảng mã đủ các trường hợp, có `reconnecting`;
   - `isTryHung`: biên 8 000 ms, `readyState` 0/1 là `true`, 2/3/`undefined` là `false`;
   - `mayRejoinAgain`: `null`, `NaN`, 59 999 ms, 60 000 ms;
   - watch, lần thử treo: rớt, `retryCount` = 1, `readyState` 0, tiến 10 s thì `close(4010)` đúng một lần. `retryCount` lên 2 thì 6 s sau chưa đóng, 10 s sau đóng lần nữa;
   - watch, đang chờ hẹn: `readyState` 3, tiến 30 s thì không bao giờ `close`;
   - watch, các lần thử hỏng đều: `retryCount` tăng mỗi 2 s thì không `close`;
   - watch, trang ngủ: nhảy đồng hồ 20 s một lần thì lần kiểm đó không `close`;
   - watch: 4003 khi `reconnecting` thì `lost: refused`; sau `giveUp` thì vẫn `failed`; 4201 vẫn `replaced`;
   - `vi.getTimerCount()` về 0 sau khi `lost` (như các test cũ).
3. **`net/connection.ts`:** `canResume(roomId)` theo Thiết kế 3; hằng `RESUME_CHECK_MS`; JSDoc.
4. **`ui/strings.ts`:** `CONNECTION_TEXT.refused` (bảng ở Thiết kế 3).
5. **`ui/connection.ts`:** `show()` coi `lost`/`refused` là đang bận (Thiết kế 3); chữ lấy từ `CONNECTION_TEXT[status.reason]`.
6. **`main.ts`:**
   - Hằng `AUTO_ENTER_KEY = "petgame:autoEnter"` và `AUTO_REJOIN_AT_KEY = "petgame:autoRejoinAt"` (JSDoc, cạnh `ROOM_KEY`).
   - Trong `startGame`, `react`: `refused` thì `overlay.show({ state: "reconnecting" })` rồi `void comeBack()`. Hàm cục bộ `comeBack()` làm đúng bước 2-3 của Thiết kế 3. `seen.stop()` và `setAddress` vẫn chạy cho mọi `lost` như hiện nay.
   - Lúc nạp sảnh: đọc và xoá `AUTO_ENTER_KEY`; sau `document.dispatchEvent(new Event(LOBBY_READY_EVENT))`, nếu khớp `invited` thì `void enter()`.
   - Mọi truy cập `sessionStorage` đi qua `safeStorage`.
7. **E2E `tests/e2e/reconnect.spec.ts` (mới).** Chép từ `multiplayer.spec.ts`, kèm chú thích "Copied because T63 holds multiplayer.spec.ts; to be gathered in T16":
   - `openWithSwitch`, gồm init script bọc lớp thay thế của Playwright cho ném `SyntaxError` như lớp thật;
   - `enterLobby`, `waitForWorld`, `observer`, mảng `contexts`/`observers` và `afterEach`.

   Thêm vào `openWithSwitch` hai công tắc, mỗi cái chỉ áp cho **lần kết nối kế tiếp**, kèm JSDoc:
   - `hangNext()`: route nhận kết nối nhưng không nối tới server, không gửi gì. Trang thấy socket mở mà không bao giờ có `JOIN_ROOM`.
   - `flapNext()`: route nối tới server và chuyển tin từ trang sang, nhưng bỏ tin đầu tiên từ server (`JOIN_ROOM`), rồi đóng cả hai đầu: `server.close()`, và phía trang `close({ code: 4010 })`.

   Hai test:
   - **`connection: a place lost while coming back is taken back by the device token, where the player stood; a second loss within a minute says so instead`**, máy tính, bàn phím:
     1. Vào thế giới, `observer` cùng phòng. `debug:teleport` tới một điểm cách chỗ xuất hiện ≥ 200 px (gửi từ trang qua `__petgame.room.send`), chờ observer thấy đúng chỗ. Đếm sự kiện `load`.
     2. `cut()`: màn "Đang kết nối lại…". Rồi `flapNext()` và `restore()`.
     3. Mong đợi: trang tự tải lại (`load` = 2), `?room=` giữ nguyên, vào thế giới mà không bấm gì (`waitForWorld`), `sessionId` mới. Observer thấy đúng 2 người, người của trang không `offline`, vị trí trong ±2 px của điểm teleport. Thú (`debug:givePal` trước khi cắt) còn.
     4. **Lần hai ngay sau đó:** `cut()`, `flapNext()`, `restore()`. Mong đợi: `.net-title` là "Không kết nối lại được", `.net-lobby` có focus, `load` vẫn là 2 sau 5 s.
   - **`connection: a try that opens and never answers is dropped and tried again, so the player is back long before 30 s`**, điện thoại dọc, chạm:
     1. Vào thế giới. `cut()`, `hangNext()`, `restore()`.
     2. Mong đợi: màn che biến mất trong vòng 20 s kể từ `restore()`, không lúc nào có chữ "Không kết nối lại được"; `load` = 1 (cùng trang); `sessionId` giữ nguyên (SDK nối lại tại chỗ, không phải vào lại); observer thấy người đó không `offline`.

   Hai test dùng `test.slow()` như các test `connection:` khác; không `waitForTimeout` để chờ trạng thái (chỉ cái 5 s "không có gì xảy ra" ở bước 4 của test 1, kèm chú thích).
8. **Tài liệu** (mục Tài liệu).
9. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Các test `connection:` cũ trong `multiplayer.spec.ts` phải qua mà không sửa.

## Giao thức

- **Schema, message, `JoinOptions`, `Profile`, close code:** không đổi. Hồ sơ cũ đọc như cũ; điểm quay lại chỉ ở trong RAM, mất khi phòng đóng hoặc server khởi động lại (khi đó là `shutdown` như T3).
- **HTTP mới:** `POST /resume` (Thiết kế 2). Server (`http.ts`, `index.ts`) và client (`canResume`) làm trong cùng nhiệm vụ. Bản client cũ không gọi route này, nên vẫn chạy như T3.
- **Client nội bộ:** `LostReason` thêm `"refused"`; hai khoá `sessionStorage` mới `petgame:autoEnter`, `petgame:autoRejoinAt`.

## Test

Ngoài các test ở trên, tester chạy các đột biến sau. **Tất cả tạm thời**: hoàn tác, kiểm bằng `sha256sum`/`git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | bỏ `noteResume` trong `onDrop` | A1 (về chỗ xuất hiện, máu đầy) và e2e test 1 |
| M2 | ghi điểm quay lại cả ở `onLeave` (mọi lần rớt) | A2; và hai test e2e `connection: when the world has let the player go…` của `multiplayer.spec.ts` (trang tự tải lại thay vì hiện "Không kết nối lại được") |
| M3 | `takeResume` không xoá | A1 (lần vào thứ ba vẫn về chỗ cũ), `resume.test.ts` |
| M4 | `takeResume`/`peekResume` bỏ qua `until` | A3, `resume.test.ts` |
| M5 | `onJoin` không dùng `resume.hp` | A1 |
| M6 | route `/resume` gọi `takeResume` thay cho `peekResume` | A1 qua e2e test 1 (vào lại thì ở chỗ xuất hiện) |
| M7 | `wild.ts`: `announce(news, client)` dùng `client` của lần ném | A4 |
| M8 | `isTryHung` bỏ điều kiện `readyState` | unit "đang chờ hẹn" |
| M9 | bỏ đặt lại mốc khi trang vừa ngủ | unit "trang ngủ" |
| M10 | `lostReason` bỏ tham số `reconnecting` | unit `refused`; e2e test 1 (hiện "Không kết nối lại được") |
| M11 | `mayRejoinAgain` luôn `true` | unit; e2e test 1 bước 4 (tải lại lần nữa) |
| M12 | `comeBack` bỏ `canResume` (luôn tự vào lại) | hai test e2e `connection: when the world has let the player go…` của `multiplayer.spec.ts` |
| M13 | tắt nhánh `reconnecting` của `check()` | e2e test 2 (màn che còn đến hết 20 s, rồi "Không kết nối lại được") |

Chạy lặp:
- describe `reconnecting after a dropped connection`: 10 lần, và 5 lần dưới tải 4 vòng lặp CPU;
- `npx playwright test tests/e2e/reconnect.spec.ts --repeat-each=3 --workers=1`;
- `npx playwright test -g "connection:" --workers=1` (cả test cũ).

## Tài liệu

- **`docs/design/multiplayer.md`:**
  - dòng đầu thêm "T24";
  - mục **Quay lại**, thêm hai gạch đầu dòng:
    - "Mạng giật đúng lúc đang kết nối lại (server đã nhận lại nhưng kết nối đứt trước khi game biết) làm mất chỗ đang giữ. Game tự hỏi server rồi tải lại vào thẳng thế giới đó bằng token của thiết bị: người chơi đứng đúng chỗ cũ với đúng lượng máu cũ, thú và đồ còn nguyên. Màn hình hiện 'Đang vào lại thế giới…'. Tự vào lại tối đa một lần mỗi phút; lần thứ hai trong một phút thì 'Không kết nối lại được' như thường. Chỗ cũ được nhớ 20 giây; thế giới đủ 5 người mà có người vào trước thì sảnh báo đủ người."
    - "Một lần thử kết nối lại bị treo (mạng nhận kết nối mà không trả lời, ví dụ Wi-Fi có trang đăng nhập) bị bỏ sau khoảng 8 giây để thử lần mới, nên không phải chờ hết 30 giây."
  - sửa gạch đầu dòng "Điều này không thành mẹo được…": vào lại từ sảnh vẫn đầy máu ở giữa bản đồ, trừ khi vào lại để lấy lại chỗ vừa mất kiểu trên (khi đó giữ đúng máu và chỗ, nên cũng không thành mẹo);
  - mục **Mã kết nối lại**: thêm "Mã bị mất giữa chừng (mạng giật) thì dùng token thiết bị như trên";
  - mục **Đã cân nhắc và chấp nhận**, thêm:
    - (1) Hết 20 giây chờ thì không tự vào lại: server đã cố ý thả chỗ, và vào lại từ sảnh là phiên mới (T3, T23);
    - (2) Vào lại bằng một lần tải trang, không dựng lại game ngay trong trang;
    - (3) `/resume` chỉ trả một bit, cần biết cả id thế giới và token.
- **`docs/architecture.md`:**
  - server, mục "Kết nối lại": `resumes` (`systems/resume.ts`), `canResume`, `resumeMs`, chỉ ghi ở nhánh hold bị từ chối của `onDrop`; route `/resume` (`http.ts`, tuỳ chọn `canResume` do `index.ts` truyền);
  - client: `ConnectionWatch` thay lần thử treo (`HUNG_TRY_MS`, `isTryHung`), lý do `refused`, `canResume`, `AUTO_ENTER_KEY`/`AUTO_REJOIN_AT_KEY`, `mayRejoinAgain`;
  - kiểm thử: liệt kê `tests/e2e/reconnect.spec.ts` (bản chép `openWithSwitch` có thêm `hangNext`, `flapNext`) và cách giả mất chỗ ở test tích hợp (bỏ `JOIN_ROOM` bằng cách thay `events.onmessage` rồi `ws.terminate()`).
- **`docs/deploy.md`:** một dòng: `/resume` trả `Access-Control-Allow-Origin: *` để client trên CDN riêng (`VITE_SERVER_URL`) gọi được.

## Tiêu chí hoàn thành

- [ ] Bước A:
  - điểm quay lại chỉ được ghi ở nhánh hold bị từ chối của `onDrop`;
  - `onJoin` dùng nó một lần, trong `resumeMs`, cho đúng token, trong đúng phòng: vị trí, máu, màu (nếu trống), `nextEatAt`;
  - `canResume` không xoá điểm;
  - test A1-A4 và test `endGrace` mở rộng qua; `resume.test.ts` và test `/resume` trong `http.test.ts` qua.
- [ ] Hết giờ chờ, `debug:endGrace`, rời chủ động, bị thay: không có điểm quay lại; hành vi như T3.
- [ ] Bước B:
  - `ConnectionWatch` báo `refused` cho 4003 khi đang `reconnecting`, và thay lần thử treo theo `HUNG_TRY_MS` chỉ khi socket đang mở dở hoặc đã mở;
  - `main.ts` tự vào lại khi `canResume` đúng và chưa tự vào lại trong 60 s, ngược lại hiện "Không kết nối lại được";
  - sảnh tự vào khi `petgame:autoEnter` khớp `?room=`, và xoá khoá ngay khi đọc.
- [ ] Chữ `CONNECTION_TEXT.refused` đúng bảng; màn che kiểu đang bận, không lấy focus, nút Về sảnh ≥ 44×44.
- [ ] `tests/e2e/reconnect.spec.ts` có 2 test qua. Các test `connection:` cũ trong `multiplayer.spec.ts` qua mà không sửa.
- [ ] Bảng đột biến M1-M13 cho đúng kết quả; ghi trong `PROGRESS.md`.
- [ ] Không đổi schema, message, `JoinOptions`, `Profile`, close code. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` qua.
- [ ] Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi hồ sơ, không xoá tính năng, không đổi kiến trúc mạng.

- **Giả lập mất chỗ phụ thuộc chi tiết Colyseus.** Test A1 và `flapNext()` dựa vào việc tin đầu tiên của lần nối lại là `JOIN_ROOM`, và server coi socket đóng lúc `JOINING` là `onDrop`. Đúng với 0.18.18 và SDK 0.18.5. Nếu Colyseus đổi, A1 hỏng ở chỗ nhận 4003 hoặc ở chỗ có điểm quay lại; nghĩa là test báo, không im lặng.
- **`matchMaker.getLocalRoomById`:** coder kiểm đúng tên hàm. Server chạy một process (presence cục bộ); nếu sau này chạy nhiều process thì `/resume` chỉ thấy phòng của process mình. Ghi ở JSDoc của hàm truyền vào.
- **Đóng một socket đang `CONNECTING` bằng 4010:** `WebSocketTransport.close` gọi `onclose` của SDK trước rồi mới `ws.close(4010)`. Trình duyệt cho phép `close()` lúc `CONNECTING` (huỷ kết nối). Test e2e 2 chạy qua đúng đường này trên Chromium.
- **Màn che "Đang vào lại thế giới…" rồi sảnh hiện thoáng qua** trước khi vào: chấp nhận (sảnh chỉ hiện "Đang vào..." trong lúc đó).
- **T25:** nếu sau này `offline`/an toàn chỉ có hiệu lực sau khoảng 1,5 s rớt, thì điểm quay lại vẫn đúng, vì nó ghi máu và chỗ tại lúc mất chỗ.

## Đề xuất cho `TASKS.md`

- **T24b (mới, P3), làm sau T24.**
  - (c) Android giữ socket khi trang ẩn lâu. Đề xuất: tin client mới "đang vắng" khi trang ẩn quá N giây (ví dụ 10 s). Server bảo vệ người chơi như lúc chờ nối lại (đặt `offline`, `calmPalsTargeting`) mà không cắt socket; trang hiện lại thì tin "đã về". Phải theo luật chống né đòn T25: chỉ có hiệu lực sau một khoảng tối thiểu, và có hồi chiêu giữa hai lần. Đổi giao thức, nên làm server và client cùng lúc. Không dùng cách đóng 4010: SDK sẽ nối lại ngay ở nền, thành vòng lặp.
  - (d) Thêm công tắc `deadFreeze()` vào `tests/e2e/reconnect.spec.ts` (bản chép của T24): không chuyển lệnh đóng của trang sang server, để server chỉ biết qua ping sau 6-9 s và lần nối lại phải chờ trong `_reconnectionAttempts`. Thêm một test đi qua đường đó.
- **Ghi chú cho T16:** gom bản chép `openWithSwitch` (cùng `hangNext`, `flapNext`), `enterLobby`, `waitForWorld`, `observer` trong `tests/e2e/reconnect.spec.ts`.
- **Ghi chú cho T25:** T24 không thêm đường né đòn nào; điểm quay lại giữ đúng máu và chỗ (Thiết kế 1).
