# PLAN: T3 Rớt mạng là văng khỏi game: kết nối lại trong khoảng ân hạn

## Mục tiêu

- Hiện nay mạng chập chờn (4G, đổi Wi-Fi, khoá màn hình) là văng khỏi game. Server không gọi `allowReconnection`, nên `onLeave` xoá người chơi ngay (`GameRoom.ts:516-525`). SDK có tự thử kết nối lại nhưng bị từ chối, client chỉ hiện toast "Mất kết nối với server" (`Game.ts:776`). Người chơi phải vào lại từ sảnh: mất vị trí, còn người tạo thế giới thì mất luôn thế giới (URL của họ không có `?room=`).
- Sau nhiệm vụ:
  - Rớt mạng dưới khoảng 20 giây thì người chơi tự quay lại đúng nhân vật, đúng chỗ, cùng thú đi theo, không phải bấm gì.
  - Màn hình nói rõ trạng thái: "Đang kết nối lại…", "Đã kết nối lại", hoặc "Không kết nối lại được" kèm nút Về sảnh.
  - Trong lúc chờ, nhân vật đứng yên và an toàn.
  - Rời chủ động (đóng tab, tải lại) thì giải phóng chỗ ngay.
  - Mỗi thiết bị chỉ một nhân vật một lúc: không nhân bản, không ghi đè tiến trình.
- Luật chơi đã ghi vào `docs/design/multiplayer.md` (tài liệu thiết kế mới, game-designer viết). PLAN này là phần triển khai.

## Phạm vi

Làm (chia được thành 2 commit, xem "Kế hoạch triển khai"):
- **A. Server và shared:**
  - `onDrop` giữ chỗ bằng `allowReconnection`, có `onReconnect`; `onLeave` thành luồng xoá dùng chung.
  - Người đang chờ được bảo vệ và đứng yên.
  - Mỗi token thiết bị một phiên, trong toàn process.
  - Trường schema `Player.offline`, ba hằng số mới, hook thử nghiệm `debug:endGrace`, test tích hợp.
- **B. Client:**
  - SDK tự kết nối lại ngay trên đối tượng `Room` cũ, theo chính sách thử lại có giới hạn.
  - Bộ theo dõi kết nối `ConnectionWatch` (có unit test), màn che trạng thái, nút Về sảnh.
  - Không gửi gì khi mất kết nối.
  - Rời chủ động khi đóng trang; dừng đi khi trang bị ẩn.
  - Đánh dấu người khác đang mất kết nối.
  - e2e, cập nhật tài liệu.

KHÔNG làm:
- Không lưu reconnection token xuống máy (`sessionStorage`, `localStorage`). Tải lại trang thì vào lại từ sảnh; thế giới cũ nhận ra thiết bị và kết thúc phiên cũ ngay. Việc tự vào lại sau khi tải lại trang là đề xuất riêng ở cuối.
- Không dùng `client.reconnect(token)` của SDK (nó tạo `Room` mới, sẽ nhân đôi listener và sprite). Không gọi lại `bindRoom()`. Không tạo `Room` mới.
- Không đổi `Profile`, `sanitizeProfile`, `store.ts`; không đổi transport hay ping của server; không đổi engine, không đổi kiến trúc mạng.
- Không thêm nút "Thoát" vào HUD.
- Không làm việc của T15 (sảnh báo lỗi), T19 (phím game khi mở hộp thoại), T12 (gom chữ).
- Không bảo vệ người chơi khi trang chỉ bị ẩn mà socket còn sống (Android): chỉ dừng đi.

## Thiết kế

### 1. API Colyseus 0.18 đang cài (đọc mã nguồn và chạy thử)

Phiên bản trong `node_modules`: `colyseus` 0.18.9 (`@colyseus/core` 0.18.18), `@colyseus/ws-transport` 0.18.4, `@colyseus/sdk` 0.18.5, `@colyseus/schema` 5.0.36, `@colyseus/testing` 0.18.6. Đường dẫn dưới đây tính từ `node_modules/@colyseus/`.

**Server:**
- `core/src/Room.ts:684-704`: có ba hook `onDrop(client, code?)`, `onReconnect(client)`, `onLeave(client, code?)`. Không còn tham số `consented: boolean` của các bản cũ.
- `core/src/Room.ts:2356-2414` (`_onLeave`), cách hook được chọn:
  - Mã 4000 `CONSENTED` (client gọi `room.leave()`) → `onLeave` ngay.
  - Mọi mã khác (1001 đóng tab, 1005, 1006 rớt mạng, 4010, mã riêng) → `onDrop`.
  - `onDrop` có gọi `allowReconnection`: `onLeave` chỉ chạy khi việc giữ chỗ bị reject (hết hạn hoặc ta tự reject).
  - `onDrop` không gọi: `onLeave` chạy ngay sau nó (`:2406-2413`, `:2416-2419`).
- `core/src/Room.ts:1960-2048` (`allowReconnection(client, seconds)`):
  - Trả về `Deferred<Client>` (có `.reject()`), giữ ghế; hết `seconds` thì `reject(false)` (`:2004-2008`).
  - Trả về Promise bị reject, không phải `Deferred`, khi client chưa từng JOINED hoặc phòng đang đóng (`:1966-1983`). Phải `.catch` để Node không báo unhandled rejection.
- `core/src/Room.ts:871-876` (`hasReachedMaxClients`): đếm cả ghế đang giữ, nên phòng đủ 5 vẫn khoá. `_reserveSeat` bỏ qua kiểm tra đầy cho ghế giữ (`:2147`), nên người đang được giữ vẫn vào lại được.
- Token gắn với ghế:
  - `core/src/Room.ts:887-905`: ghế giữ bởi `allowReconnection` chỉ nhận đúng token đã cấp cho sessionId đó.
  - `core/src/Transport.ts:523-537`: không có ghế → `MATCHMAKE_EXPIRED`.
  - `ws-transport/src/WebSocketTransport.ts:311-323`: lỗi khi có reconnectionToken → đóng socket mã 4003.
- `core/src/Room.ts:1714-1716, 1787-1829, 1927-1938`: nối lại được thì giữ nguyên sessionId, gọi `onReconnect`, gửi JOIN_ROOM kèm reconnectionToken MỚI. Token cũ bị xoá (`:2010-2014`, `:2025`).
- `core/src/Room.ts:1736-1760`: server chưa phát hiện socket cũ đã chết mà client đã nối lại → lần nối chờ (tối đa `seatReservationTimeout` 15 s) đến khi socket cũ đóng.
- `ws-transport/src/WebSocketTransport.ts:105-111, 259-276`: ping mỗi 3 s, 2 lần không trả lời thì cắt. Socket chết không báo gì được phát hiện sau 6-9 s.
- Mã đóng (`shared-types/src/Protocol.ts:273-285`): 1001, 1005, 1006, 4000 `CONSENTED`, 4001 `SERVER_SHUTDOWN`, 4002, 4003 `FAILED_TO_RECONNECT`, 4010 `MAY_TRY_RECONNECT`. Server import `CloseCode`, `Deferred` từ `"colyseus"` (core xuất lại, `core/src/index.ts:4-9, 71`).

**Client (`@colyseus/sdk`):**
- `sdk/src/Room.ts:156-178`: socket đóng với 1001, 1005, 1006, 4010 → signal `room.onDrop(code)` và tự kết nối lại; mã khác → `room.onLeave(code)`.
- `sdk/src/Room.ts:745-799`:
  - Không tự nối lại nếu phòng vào chưa đủ `minUptime`.
  - Chờ `min(maxDelay, max(minDelay, 2^n·delay))` rồi gọi `this.connection.reconnect({ reconnectionToken, skipHandshake: true })` trên **chính đối tượng `Room` cũ**.
  - Quá `maxRetries` → `onLeave(4003)`.
  - Mặc định (`sdk/src/Reconnection.ts:68-82`): maxRetries 15, delay 100, minDelay 100, maxDelay 5000, minUptime 5000, maxEnqueuedMessages 10.
- `sdk/src/Room.ts:619-642`: JOIN_ROOM khi đang nối lại → `room.onReconnect()`, `room.reconnectionToken` mới, gửi các tin đang xếp hàng.
- `sdk/src/Room.ts:300-305` và `Reconnection.ts:89-94`: `room.send` khi socket đóng sẽ xếp hàng (tối đa `maxEnqueuedMessages`) để gửi sau. Đặt `maxEnqueuedMessages = 0` thì bỏ hết.
- `sdk/src/serializer/SchemaSerializer.ts:30-41` và `schema/src/decoder/Decoder.ts:136-157`: full state khi vào lại được giải bằng `decodeResync`. Thứ đã bị xoá trong lúc mất mạng gọi `onRemove`, thứ mới gọi `onAdd`, thứ còn nguyên giữ đối tượng và callback.
- `sdk/src/Connection.ts:6-17, 26` và `sdk/src/transport/WebSocketTransport.ts:67-80`: sự kiện `offline` của trình duyệt → `connection.close(4010)` → onclose(4010) phát ngay → onDrop rồi tự nối lại. Ta dùng chính đường này để coi một socket treo là đã rớt.
- `sdk/src/Room.ts:147-150`: `onLeave` của SDK gỡ mọi listener và huỷ decoder. `room.state` vẫn giữ giá trị cuối.
- `sdk/src/Client.ts:297-306` (`client.reconnect(token)`, qua HTTP, tạo `Room` mới): **không dùng**.
- `sdk/src/index.ts:10`: `import { CloseCode } from "@colyseus/sdk"`.

**Đã chạy thử với thư viện thật** (script trong scratchpad, ngoài repo):
1. Server cắt socket (`ref.terminate()`):
   - Client nhận onDrop(1006), server nhận onDrop(1006), `allowReconnection` trả `Deferred`.
   - SDK tự nối lại sau khoảng 300 ms trên cùng `Room`: sessionId giữ nguyên, token đổi.
   - Trong lúc mất mạng xoá i0, thay i1, thêm i3. Khi nối lại, client nhận theo thứ tự onRemove(i1), onAdd(i1), onAdd(i3), onRemove(i0). Xoá luôn đi trước thêm cho cùng một khoá.
   - Tin gửi lúc mất mạng bị bỏ khi `maxEnqueuedMessages = 0`.
2. Dùng lại token cũ → lỗi 524 "reconnection token invalid or expired".
3. Phòng đầy:
   - Người đang được giữ vẫn tính chỗ; người mới bị từ chối 522 "room is locked".
   - Người được giữ vẫn vào lại được.
4. Hết hạn giữ chỗ:
   - Server gọi `onLeave(1006)` đúng sau `seconds`.
   - Client thử muộn thì nhận onLeave(4003).
5. Server gọi `hold.reject(false)`:
   - `onLeave` chạy ngay, ghế trống ngay.
   - Client thử muộn thì nhận 4003.
6. Rời chủ động: server chỉ gọi `onLeave(4000)`, không có `onDrop`.
7. Client gọi `connection.close(4010)`: server nhận onDrop(4010), nối lại được. Client đóng socket không mã: hai phía đều thấy 1005, nối lại được.
8. Socket cũ còn mở phía server: lần nối lại chờ, rồi nối ngay khi socket cũ bị cắt.
9. Server gọi `client.leave(4201)`:
   - Client nhận onLeave(4201) và không tự nối lại.
   - Server gọi onDrop(4201) rồi onLeave(4201).
10. Node 22: SDK dùng WebSocket có sẵn của Node, không có `terminate()`. Test tích hợp phải cắt socket từ phía server.

**Playwright 1.56.1 + Chromium:**
- `context.setOffline(true)`:
  - Có sự kiện `offline`. Socket đang mở không bị đóng và server không thấy gì; chỉ biết qua ping sau 6-9 s.
  - Lần nối mới thất bại với 1006 sau khoảng 300 ms; bật mạng lại thì nối được.
  - Có thể làm Vite dev tải lại trang (socket HMR của Vite).
- `context.routeWebSocket(/:2567\//, ...)`:
  - Phải cài trước khi trang tải: SDK giữ hàm dựng `WebSocket` lúc nạp module (`sdk/src/transport/WebSocketTransport.ts:5`).
  - Dữ liệu nhị phân đi qua cả hai chiều.
  - `server.close({ code: 4010 })` → trang nhận 4010, server thật cũng nhận 4010.
  - Lần nối mới bị route đóng bằng `ws.close({ code: 4010 })` → trang nhận 4010, SDK thử tiếp.
  - Không đụng socket Vite (cổng 5173).
  - **Nhưng tin trang gửi trong `pagehide` không qua được route.**
- WebSocket thật (không route): tin gửi trong `pagehide` tới server trước khi socket đóng 1001, cả khi điều hướng đi lẫn `page.close()`.

**Kết luận:**
- Dùng đúng cơ chế có sẵn: server dùng `onDrop` + `allowReconnection`, SDK tự kết nối lại tại chỗ.
- Client không cần "gắn lại" listener hay state: cùng một `Room`, cùng decoder, callback vẫn chạy. `window.__petgame.room` vẫn đúng đối tượng.
- Không đổi kiến trúc mạng.

### 2. Hằng số (shared `constants.ts`)

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `RECONNECT_GRACE_MS` | `20_000` | Theo gợi ý của nhiệm vụ. Đủ cho 4G chập chờn và chuyển app ngắn. Ghế bị giữ tối đa khoảng 29 s (6-9 s để phát hiện, cộng 20 s), chấp nhận được với phòng 5 người. |
| `RECONNECT_TRY_MS` | `RECONNECT_GRACE_MS + 10_000` (30 s) | Thời gian client còn thử: thời gian giữ chỗ, cộng tối đa 9 s server cần để phát hiện socket chết, cộng 1 s dư. Sau đó server chắc chắn đã thôi giữ chỗ. |
| `CLOSE_REPLACED` | `4201` | Mã đóng khi phiên bị thay bởi lần vào mới của cùng thiết bị. Dải 4000-4999 dành cho ứng dụng; Colyseus dùng 4000-4003 và 4010; SDK không tự nối lại với mã này. |

### 3. Server: ba đường ra và luật trong thời gian chờ

**Rời chủ động** (mã 4000: client gọi `room.leave()`, kể cả lúc đóng trang): `onLeave` → `removePlayer` (lưu rồi xoá). Không có `onDrop`, không giữ chỗ.

**Rớt mạng** (`onDrop`, mọi mã khác), theo đúng thứ tự:
1. Không còn player hoặc control cho sessionId này (phiên đã bị thay) → `return`. `onLeave` chạy ngay sau đó và không còn gì để làm.
2. `const hold = this.allowReconnection(client, this.reconnectGraceMs / 1000); hold.catch(() => {});`
3. Nếu `!(hold instanceof Deferred)` → `return`. Đây là trường hợp client chưa JOINED hoặc phòng đang đóng; `onLeave` chạy ngay sau đó.
4. `this.holds.set(sessionId, hold)`; `player.offline = true`.
5. Xoá ý định trong control: `control.input = { x: 0, y: 0 }`, `dashLeftMs = 0`, `skillOrder = undefined`, `aggroUntil = 0`.
6. `calmPalsTargeting("player", sessionId)`. Với mỗi companion có `ownerId === sessionId`: `cancelCasts("companion", id)` (huỷ chiêu chưa phát) và `calmPalsTargeting("companion", id)`.
7. `saveNow(sessionId)`: lưu ngay, phòng khi server sập trong lúc chờ.

**Quay lại** (`onReconnect`): `holds.delete(sessionId)`, `player.offline = false`. Không tạo lại gì. Player, companion, `PlayerControl`, hồi chiêu, `faintedUntil` đều còn nguyên. Ý định đã bị xoá ở bước 5; client gửi lại hướng đi hiện tại.

**Hết hạn** (Colyseus reject, rồi gọi `onLeave`): `removePlayer`, đúng luồng rời phòng hiện tại.

`removePlayer(sessionId)` thay cho thân `onLeave` hiện tại. Làm theo thứ tự, gọi hai lần cũng an toàn:
1. `saveNow`.
2. Despawn companion có `ownerId === sessionId`. Lọc theo `ownerId`, KHÔNG theo id thú, vì phiên mới của cùng thiết bị dùng lại id thú.
3. Bỏ đăng ký khỏi `liveSessions` nếu mục đó đúng là `{ room: this, sessionId }`.
4. `state.players.delete`, `controls.delete`, `holds.delete`, `lastDamagedAt.delete("p:" + sid)`, `hazardWarned.delete`, `shieldUntil.delete`.
5. `calmPalsTargeting("player", sid)`.

**Bảng `Map` và hẹn giờ trong lúc chờ:**

| Dữ liệu | Trong lúc chờ | Khi xoá |
|---|---|---|
| `controls` (token, hẹn lưu) | giữ; ý định bị xoá | xoá |
| `holds` | thêm | xoá |
| companion (`state.companions`) + `companionTimers`, `skillReady` | giữ, đứng yên | despawn như cũ |
| `castingUntil` của companion | huỷ (`cancelCasts`) | |
| `wildAggro` nhắm vào họ hoặc thú của họ | xoá ngay (`calmPalsTargeting`) | |
| `fleeing`, `inBallThrower` trỏ tới họ | tự hết hiệu lực vì `targetPos` trả `undefined` | |
| `lastDamagedAt`, `shieldUntil`, `hazardWarned` | giữ | xoá |
| `faintedUntil`, `bossHelpers` | giữ (thời gian vẫn trôi; cùng hạ trùm vẫn có thưởng) | như cũ |
| hẹn giờ `scheduleSave` (`clock.setTimeout`) | chạy bình thường, lưu được | `saveNow` không làm gì khi player đã bị xoá |

**Bảo vệ và đứng yên.** Thêm helper:
```ts
/** A player waiting to reconnect, and their pals, are out of the game: nothing targets or hurts them. */
private sheltered(target: Pick<CombatTarget, "kind" | "id">): boolean
```
Hàm lấy `ownerId` (chính `id` nếu là player, `ownerId` của companion nếu là companion), rồi trả `!!this.state.players.get(ownerId)?.offline`. Server chỉ đọc cờ `player.offline` (một nguồn sự thật, đồng bộ cho client luôn); `holds` chỉ dùng để kết thúc sớm.

Dùng ở các chỗ sau, và chỉ những chỗ này:
- `targetPos` (`:1561`): trả `undefined` nếu `sheltered`. Nhờ vậy aggro đang nhắm họ bị bỏ ở tick sau (`wildTarget` `:1546-1550`), thú đang chạy trốn họ thôi chạy, thú vỡ bóng giận họ cũng thôi.
- `wildTarget` (`:1552-1554`): không đưa người đang chờ và companion của họ vào `candidates`.
- `damage()` (`:1565`): dòng đầu `if (this.sheltered(target)) return;`. Đây là cổng chung cho cắn, chiêu của thú hoang, dậm của trùm, và cả đẩy lùi.
- `tickCompanions` (`:658-661`): ngay sau kiểm tra `!owner || !control || !owned`, thêm `if (owner.offline) return;`. Thú đi theo không di chuyển, không đánh, không tung chiêu; thú làm việc không sản xuất.
- `tickExploration` (`:1706`), `tickClimate` (`:1833`): bỏ qua player `offline` (không mở rương, không tiến nhiệm vụ đi thăm vùng, không lạnh nóng, không cảnh báo).
- `tickRegen` (`:1669-1670`): không hồi máu cho player `offline` và companion `sheltered`.
- Không cần chặn ở `tick()`: ý định đã bị xoá nên không có bước đi.

Người đang chờ vẫn hiện trong state (đếm trong "👥 n/5", minimap), với `offline = true`.

**Mỗi thiết bị một phiên** (chống nhân bản, chống ghi đè):
- Biến cấp module, cạnh `sharedStore`:
  ```ts
  /** Device token -> its one live session, in whichever room (process-wide, like the store): one player per device. */
  const liveSessions = new Map<string, { room: GameRoom; sessionId: string }>();
  ```
  TS cho phép gọi method `private` của một instance khác cùng class.
- `onJoin`:
  - Có token hợp lệ và `liveSessions` có phiên cũ → `older.room.endSession(older.sessionId)` **trước** `store().load(token)`.
  - Đăng ký `liveSessions.set(token, { room: this, sessionId })` ngay sau `controls.set`.
- `endSession(sessionId)`:
  - Lấy `hold` trước, rồi `removePlayer(sessionId)` (đã lưu).
  - Có `hold` → `hold.reject(false)`: ghế trống ngay; Colyseus gọi `onLeave` sau, khi không còn gì để làm.
  - Không có `hold` → `this.clients.find(...)?.leave(CLOSE_REPLACED)`: tab cũ được báo lý do; server gọi `onDrop`, rồi `onLeave`, cả hai không làm gì.
  - Chạy được cả khi phòng kia đang đóng.
- `onDispose()`: xoá mọi mục `liveSessions` có `room === this`.
- Vì sao phải làm trong toàn process: nếu không, bản ma đang chờ ở thế giới A sẽ ghi đè tiến trình mới làm ở thế giới B khi hết hạn (người tạo thế giới tải lại trang sẽ sang thế giới mới). Một token chỉ có một phiên sống nên không còn bản cũ nào để lưu. Server chạy một process (LocalDriver), đủ dùng; ghi rủi ro cho trường hợp mở rộng nhiều process.
- Luật "người vào sau thắng":
  - Vào mới thắng một lần nối lại đang chờ: lần nối đó nhận 4003.
  - Vào mới thắng một tab đang mở: tab đó nhận `CLOSE_REPLACED`.
  - Phòng đã đầy thì lần vào mới bị chặn ở bước giữ ghế, trước khi tới `onJoin`.

**Hook thử nghiệm** (trong khối `PETGAME_DEBUG`): `debug:endGrace` reject mọi `hold` trong phòng, như hết hạn. Dùng cho e2e màn "không kết nối lại được". Duyệt `this.holds.values()` rồi `reject` là an toàn, vì việc xoá diễn ra ở microtask sau.

### 4. Client: luồng kết nối

**Không có `Room` mới.** SDK nối lại trên chính `room` cũ. Giữ nguyên `bindRoom()`, `Callbacks`, `room.onMessage`, `window.__petgame.room`. Resync tự gọi `onRemove` và `onAdd` cho mọi thay đổi trong lúc mất mạng, nên các `Map` của `Game` (players, pals, companions, chests, fruits, felled, camps) tự khớp. Sprite không bị nhân đôi vì không có `bindRoom()` lần hai.

**`net/reconnect.ts` (mới, thuần TypeScript, không dùng DOM; có unit test):**
- `type LostReason = "failed" | "replaced" | "shutdown" | "left"`.
- `type NetStatus = { state: "online" } | { state: "reconnecting" } | { state: "lost"; reason: LostReason }`.
- Hằng số:
  - `PING_EVERY_MS = 2000`.
  - `STALL_MS = 6000`: quá 6 s không nghe gì (không pong, không patch) thì coi là treo.
  - `SLEPT_GAP_MS = 3 * PING_EVERY_MS`: hai lần kiểm tra cách nhau hơn mức này nghĩa là trang vừa "ngủ" (điện thoại treo JS).
- `SDK_RECONNECTION = { minUptime: 0, maxDelay: 2000, maxRetries: 30, maxEnqueuedMessages: 0 }`, lý do từng giá trị:
  - `minUptime: 0`: điện thoại 4G có thể rớt ngay trong 5 s đầu sau khi vào.
  - `maxDelay: 2000`: mạng về thì nối lại trong tối đa khoảng 2 s.
  - `maxRetries: 30`: chỉ là lưới an toàn; `RECONNECT_TRY_MS` mới là giới hạn thật (khoảng 17 lần thử vừa trong 30 s).
  - `maxEnqueuedMessages: 0`: không bao giờ phát lại ném bóng hay đánh đã bấm 20 s trước.
- `lostReason(code)`: `CLOSE_REPLACED` → `"replaced"`, `CloseCode.SERVER_SHUTDOWN` → `"shutdown"`, `CloseCode.CONSENTED` → `"left"`, mã khác → `"failed"`.
- `interface WatchedRoom`: phần của `Room` mà class này dùng, viết theo cấu trúc để `GameRoom` của client và room giả trong test đều khớp: `onDrop`, `onReconnect`, `onLeave`, `onStateChange`, `ping(cb)`, `leave(consented?)`, `connection.close(code?)`, `reconnection` (các trường enabled, maxRetries, maxDelay, minUptime, maxEnqueuedMessages).
- `class ConnectionWatch`:
  - API: `status: NetStatus`, `get online()`, `onChange(listener: (status, previous) => void)`, `leave()`.
  - Constructor:
    - `Object.assign(room.reconnection, SDK_RECONNECTION)`.
    - Nghe `onDrop`, `onReconnect`, `onLeave(code)`; `onStateChange` cập nhật `heardAt`.
    - `setInterval(check, PING_EVERY_MS)`.
    - Thời gian lấy bằng `Date.now()` và `setTimeout`, `setInterval` toàn cục, để Vitest fake timers điều khiển được.
  - `onDrop`: chỉ khi đang `online` → `reconnecting`, hẹn `giveUp` sau `RECONNECT_TRY_MS`. Các lần `onDrop` sau (mỗi lần thử hỏng) không làm gì.
  - `onReconnect`:
    - Nếu đã `lost` (đã bỏ cuộc mà một lần thử muộn vẫn vào được) → `room.leave(true)` để trả ghế, giữ nguyên `lost`.
    - Nếu không → `online`, huỷ hẹn, `heardAt = now`.
  - `onLeave(code)` → `lost(lostReason(code))`. Đã `lost` rồi thì giữ lý do đầu tiên.
  - `giveUp` (còn `reconnecting`): đặt `room.reconnection.enabled = false` và `maxRetries = 0`, rồi `lost("failed")`.
  - `check()` (chỉ khi `online`):
    1. Tính `gap = now - lastCheck`, rồi gán `lastCheck = now`.
    2. Nếu `gap > SLEPT_GAP_MS` thì gán `heardAt = now`: cho socket một nhịp sau khi trang thức dậy.
    3. Ngược lại, nếu `now - heardAt > STALL_MS` thì gọi `room.connection.close(CloseCode.MAY_TRY_RECONNECT)` (SDK coi như rớt, bắt đầu nối lại) và dừng.
    4. Cuối cùng gọi `room.ping(() => heardAt = Date.now())`.
  - `leave()` (trang đóng):
    - Đã `lost` → không làm gì.
    - Nếu không: `room.reconnection.enabled = false`, `lost("left")`; nếu lúc đó đang `online` thì `room.leave(true)` (tin rời phòng, server xoá ngay, không giữ chỗ).
  - Khi `lost`: dừng interval và mọi hẹn giờ.

**`ui/connection.ts` (mới): `ConnectionOverlay`.**
- Lớp phủ toàn màn hình trong `#game`, z-index 6, nằm trên mọi thứ: HUD 2, bảng 3, bản đồ lớn 4, hộp xác nhận thả thú 5. Làm tối và **chặn mọi chạm** xuống joystick và nút bên dưới.
- DOM: `div.net-overlay[role=alertdialog][aria-modal=true]` chứa `div.net-box` gồm:
  - `div.net-spinner` (`aria-hidden`, chỉ hiện khi đang kết nối lại),
  - `strong.net-title` (id `net-title`),
  - `p.net-detail` (id `net-detail`),
  - `button.net-lobby` "Về sảnh".
- `aria-labelledby` và `aria-describedby` trỏ tới hai id trên.
- `show(status)`: `online` thì `hidden`. Còn lại thì đặt chữ theo bảng dưới; thêm class `reconnecting` hoặc `lost`. Khi `lost`: `button.focus()` để Enter hoặc Space bấm được ngay. Khi đang kết nối lại: không cướp focus.

| Trạng thái | Tiêu đề | Dòng giải thích |
|---|---|---|
| reconnecting | Đang kết nối lại… | Mạng vừa bị ngắt. Nhân vật và thú của bạn đứng yên chờ bạn quay lại. |
| lost / failed | Không kết nối lại được | Thú, đồ và trại của bạn đã được lưu. Về sảnh để vào chơi lại. |
| lost / replaced | Bạn đang chơi ở nơi khác | Thiết bị này vừa vào game từ một tab khác. Mỗi thiết bị chỉ điều khiển một nhân vật. |
| lost / shutdown | Server đang khởi động lại | Thú, đồ và trại của bạn đã được lưu. Chờ một lát rồi về sảnh để vào lại. |
| lost / left | Bạn đã rời thế giới | Về sảnh để vào chơi lại. |

- Nút "Về sảnh" có ở mọi trạng thái. Khi đang kết nối lại, nút màu xám (phụ); khi mất hẳn, nút màu xanh (chính). Nút ≥ 44×44 px.
- Hộp `width: min(340px, 100%)`, vừa màn 390×844 và 844×390.
- `prefers-reduced-motion`: spinner không quay.

**Về sảnh**: `net/connection.ts` thêm
```ts
export function lobbyUrl(roomId: string, withFriends: boolean): string
```
Hàm lấy URL hiện tại, `withFriends` thì đặt `?room=<roomId>`, không thì xoá `room`; giữ các tham số khác (ví dụ `quality=low`). Điều hướng bằng `location.assign`, tải lại sạch cả trang. Lý do:
- Còn bạn trong thế giới thì quay về đúng thế giới đó, hồ sơ được khôi phục theo token.
- Chơi một mình thì thế giới đã đóng (không còn ai giữ), về sảnh thường: thế giới mới cùng bản đồ, trại vẫn ở chỗ cũ.

`withFriends` = `room.state.players.size > 1`, tính lúc trạng thái rời khỏi `online`.

**Toast**: khi `reconnecting` chuyển sang `online`, hiện "✅ Đã kết nối lại" (2 s).

**`Game.ts`:**
- `Game.create(container, room, assets, resolution, watch)`; constructor có thêm `private watch: ConnectionWatch`.
- Thêm `private send(type: string, message?: unknown)`: chỉ gửi khi `this.watch.online`. Thay **mọi** `this.room.send(` trong `Game.ts` bằng `this.send(` (các dòng 248, 250, 261-265, 268-269, 274, 276-277, 286, 288, 792, 944, 968, 1048).
- `attack()`, `dash()`, `throwBall()`: `return` sớm khi không `online` (không hoạt ảnh, không dự đoán). Phím "1", "2", "3" chỉ gọi `skillBar.press` khi `online`.
- `frame()`:
  - Khi không `online` thì dùng hằng `STILL = { x: 0, y: 0 }` cấp module, không mutate, không cấp phát mỗi khung hình. Nhân vật đứng yên đúng như server giữ.
  - Chỉ gửi `Input` khi `online` và hướng đổi.
- Nghe `watch.onChange`:
  - Rời `online` → `this.dashing.leftMs = 0`.
  - `reconnecting` chuyển sang `online` → `this.lastSentInput = { x: 0, y: 0 }` (server đã xoá hướng đi, khung hình sau gửi lại hướng đang giữ) và hiện toast.
- `visibilitychange`: khi `document.hidden` và đang `online`, gửi `Input` `STILL` một lần và đặt `lastSentInput = STILL`. Điện thoại chuyển app làm vòng lặp game dừng, mà server giữ hướng cuối thì nhân vật sẽ cứ đi.
- Người khác đang chờ, trong `$.onAdd("players")`:
  - Lấy thêm `text` từ `nameTag`.
  - Hàm cục bộ áp trạng thái `offline`:
    - `actor.root.alpha` và `actor.ground.alpha` bằng 0.45 khi đang chờ, 1 khi không;
    - `label.classList.toggle("offline", offline)`;
    - chữ của `text` là tên kèm " (mất kết nối)" khi đang chờ, trở lại tên khi quay lại.
  - Gọi một lần khi thêm (người vào sau vẫn thấy), và trong `$.onChange` chỉ khi cờ đổi.
- Xoá `this.room.onLeave(() => this.hud.showToast("Mất kết nối với server"))` (`:776`): màn che đã thay.

**`main.ts`:**
- Tạo watch ngay khi vào được phòng, để không lỡ một lần rớt xảy ra khi hình còn đang tải:
  `const joined = connect(...).then((room) => ({ room, watch: new ConnectionWatch(room) }))`, rồi `Promise.all([joined, assets])`.
- `startGame(room, watch, art)`:
  1. Đặt `window.__petgame = { room }` như cũ.
  2. `window.addEventListener("pagehide", () => watch.leave())`.
  3. Tạo `ConnectionOverlay(container, () => location.assign(lobbyUrl(room.roomId, withFriends)))`.
  4. Gọi `watch.onChange`: cập nhật `withFriends` khi rời `online`, rồi `overlay.show(status)`.
  5. Nếu watch đã không còn `online` thì áp ngay một lần.
  6. Sau đó mới `Game.create(..., watch)`.

**CSS (`index.html`):**
- Các class `.net-overlay` (cùng kiểu với `.party-confirm`: `position:absolute; inset:0; z-index:6; pointer-events:auto; background: rgba(0,0,0,0.5)`; `[hidden]` thì `display:none`), `.net-box`, `.net-title`, `.net-detail`, `.net-spinner`, `.net-lobby` (`min-height:44px; min-width:120px`, viền `:focus-visible` như các nút khác), `.net-overlay.reconnecting .net-lobby` (xám).
- `@keyframes` cho spinner và hiệu ứng hiện dần 0,15 s; spinner tắt quay khi `prefers-reduced-motion`.
- `.label.offline span { background: rgba(70,70,70,0.75); color: #e0e0e0; font-style: italic; }`.

**Điện thoại và bàn phím:**
- Chạm: lớp phủ chặn mọi chạm phía dưới. Nút "Về sảnh" ≥ 44×44 ở 390×844, 844×390 và 1280×720.
- Bàn phím:
  - Mọi phím game không có tác dụng khi chưa `online` (có chặn trong `Game`).
  - Khi mất hẳn, focus nằm sẵn ở "Về sảnh", nhấn Enter là đi.
  - Phím Q, C, T vẫn mở bảng bên dưới lớp phủ. Vô hại, vì mọi lệnh gửi đi đều bị chặn.
- Chuyển app hay khoá màn hình:
  - Trang ẩn thì nhân vật dừng đi.
  - Socket bị hệ điều hành đóng: khi trang thức dậy, SDK nhận onclose và tự nối lại.
  - Socket treo (không nhận được đóng): watchdog phát hiện sau khoảng 6-8 s và buộc nối lại.
  - Quá thời gian chờ: hiện "Không kết nối lại được".

### 5. Chống lạm dụng

- Reconnection token do Colyseus cấp:
  - Ngẫu nhiên (nanoid 9 ký tự), gắn với sessionId.
  - Chỉ hợp lệ khi ghế đang được giữ: đúng phiên, trong thời gian chờ.
  - Dùng xong thì bị thay bằng token mới, nên token cũ hết hiệu lực (`Room.ts:887-905, 2010-2014, 2025`; chạy thử mục 2).
- Client không lưu token ra ngoài bộ nhớ trang.
- Nối lại không nhận options, nên không đổi được token thiết bị, tên hay ngoại hình.
- Không nhân bản: SDK nối lại dùng lại sessionId cũ (không gọi `onJoin`, không tạo Player mới). Vào mới bằng cùng token thì phiên cũ bị kết thúc trước khi đọc hồ sơ, trong toàn process.
- Bản ma không ghi đè được tiến trình mới: phiên cũ bị xoá, nên `saveNow` của nó không còn gì để ghi.
- Người đang chờ không thể bị lợi dụng để giữ chỗ quá `RECONNECT_GRACE_MS`, và không làm được gì trong lúc đó.
- Hook `debug:endGrace` chỉ có khi `PETGAME_DEBUG=1`.

## Kế hoạch triển khai

Chú thích và JSDoc bằng tiếng Anh, chữ người chơi thấy bằng tiếng Việt, theo giọng văn của file. Làm Bước A, chạy `npm test`, rồi làm Bước B. Mỗi bước có thể là một commit riêng. Bước A tự đứng được: SDK hiện tại đã tự nối lại, chỉ chưa có giao diện.

**Bước A: shared + server**
1. `packages/shared/src/constants.ts`: thêm `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `CLOSE_REPLACED` kèm JSDoc (lý do ở bảng mục 2).
2. `packages/shared/src/schema.ts`: thêm `offline: t.boolean()` vào **cuối** `Player`, kèm JSDoc: "Waiting to reconnect after the connection dropped (RECONNECT_GRACE_MS): frozen, and nothing targets or hurts them or their pals."
3. `packages/server/src/rooms/GameRoom.ts`:
   1. Import `Deferred` (cạnh `Room`, `type Client`) từ `"colyseus"`; import `CLOSE_REPLACED`, `RECONNECT_GRACE_MS` từ shared.
   2. `liveSessions` cấp module, sau `useStore`.
   3. Hai trường mới `holds`, `reconnectGraceMs` cạnh `controls`, kèm JSDoc.
   4. `onJoin`:
      - Kết thúc phiên cũ cùng token trước `store().load`.
      - `player.offline = false` (cạnh `player.activePalId = ""`).
      - Đăng ký `liveSessions` sau `controls.set`.
   5. Thêm `onDrop(client: Client)`, `onReconnect(client: Client)`; `onLeave(client: Client)` chỉ còn gọi `this.removePlayer(client.sessionId)`. Thêm `removePlayer`, `endSession`, `onDispose`, mỗi hàm có JSDoc nói làm gì và vì sao, theo mục 3. Không khai tham số `code` (không dùng đến; `noUnusedParameters`).
   6. Thêm `sheltered()` và các chỗ dùng: `targetPos`, `wildTarget`, `damage`, `tickCompanions`, `tickExploration`, `tickClimate`, `tickRegen`, đúng như mục 3.
   7. `debug:endGrace` trong khối debug, kèm chú thích một dòng.
4. `packages/server/src/rooms/GameRoom.test.ts`: `describe("reconnecting after a dropped connection")` ở cuối file, gồm helper và 8 test (mục Test). Import thêm `CloseCode` từ `"colyseus"` (cùng dòng với `defineRoom`, `defineServer`) và `CLOSE_REPLACED` từ shared. File nằm trong typecheck, nên không import thừa.
5. `npm run typecheck`, `npm test`.

**Bước B: client + e2e + tài liệu**
1. `packages/client/src/net/reconnect.ts` (mới), theo mục 4.
2. `packages/client/src/net/reconnect.test.ts` (mới): unit test đầu tiên của client. Vitest đã gom `packages/**/src/**/*.test.ts`; file chạy trong Node vì không đụng DOM.
3. `packages/client/src/net/connection.ts`: thêm `lobbyUrl`, kèm JSDoc.
4. `packages/client/src/ui/connection.ts` (mới): `ConnectionOverlay`, bảng chữ `TEXT` đặt ở đầu file.
5. `packages/client/index.html`: CSS theo mục 4, đặt sau khối `.party-confirm`, kèm chú thích.
6. `packages/client/src/main.ts`: như mục 4.
7. `packages/client/src/game/Game.ts`: như mục 4.
8. `tests/e2e/multiplayer.spec.ts`: helper và 3 test (mục Test). Thêm `type WebSocketRoute` vào import từ `@playwright/test`.
9. Tài liệu:
   - `docs/architecture.md`, phần server: một mục "Kết nối lại", nói `onDrop`, `onReconnect`, `onLeave`, `removePlayer`, `holds`, `Player.offline`, `sheltered`, `liveSessions`, `CLOSE_REPLACED`, và trỏ tới `docs/design/multiplayer.md`.
   - `docs/architecture.md`, phần client:
     - `net/reconnect.ts`: SDK nối lại trên chính `Room` cũ, không tạo `Room` mới, không gọi lại `bindRoom`; resync bằng `decodeResync`.
     - `ui/connection.ts`.
   - `docs/architecture.md`, phần kiểm thử:
     - helper `cutConnection`, `holdReconnect`, `reconnected`, `openWithSwitch`, `observer`;
     - vì sao e2e dùng `routeWebSocket` thay vì `setOffline`;
     - tin `pagehide` không qua route.
   - `docs/architecture.md`: thêm `endGrace` vào danh sách hook `debug:*`.
   - `docs/choi-tren-iphone.md`, mục "Mẹo": thêm "**Mất mạng, chuyển app hay khoá màn hình?** Game tự kết nối lại, nhân vật đứng yên chờ bạn khoảng 20 giây. Lâu hơn thì bấm **Về sảnh**: thú, đồ và trại vẫn còn."
10. `npm run typecheck`, `npm test`, `npm run build`, e2e (mục Test). Ghi `PROGRESS.md`.

## Giao thức

- `schema.ts`: thêm `Player.offline: boolean`, ở cuối danh sách trường.
  - Server và client đổi trong cùng nhiệm vụ.
  - Không ảnh hưởng dữ liệu đã lưu, vì schema không được lưu.
  - Client cũ cùng server mới không phải lo: mỗi lần deploy server khởi động lại, mọi phòng mất; tab cũ nhận 4003, bấm Về sảnh là tải bản mới.
- `messages.ts`: không đổi. Có thêm tin thử nghiệm `debug:endGrace` (chuỗi, chỉ khi `PETGAME_DEBUG=1`, như các hook khác).
- Mã đóng mới `CLOSE_REPLACED = 4201`, server gửi tới client.
- `Profile`, `emptyProfile`, `sanitizeProfile`, `store.ts`: **không đổi**. Hồ sơ cũ đọc như cũ. Chỉ thêm thời điểm lưu: lúc rớt mạng và lúc bị thay.
- Hành vi client đổi:
  - Chính sách tự nối lại của SDK.
  - Đóng hoặc rời trang thì gửi tin rời phòng (consented).
  - Không gửi ý định khi mất kết nối.
  - Toast "Mất kết nối với server" được thay bằng màn che.

## Test

**Tích hợp server** (`GameRoom.test.ts`, describe mới).

Helper (JSDoc tiếng Anh):
- `cutConnection(room, sessionId)`: `(room.clients.find(...) as any).ref.terminate()`. Server thấy socket đóng 1006 như mạng chết.
- `holdReconnect(client)`:
  - Đặt `client.reconnection.minUptime = 0`, `minDelay = 10`, `maxDelay = 50`.
  - Thay `client.connection.reconnect` bằng bản chờ một cổng (Promise), rồi trả về hàm `letGo()` mở cổng.
  - Test nào không mở cổng thì gọi mà không gán, vì `noUnusedLocals`.
- `reconnected(client)`: chờ `client.onReconnect.once`, rồi `await client.waitForNextPatch()` để full state mới đã áp. Phải gọi **trước** `letGo()`.
- Người chơi không được quay lại: `client.reconnection.enabled = false`.

8 test:
1. `holds a dropped player where they stood, safe, with their pal frozen; the SDK's own retry brings the same player back`
   - Chuẩn bị:
     - `capture` để có thú đi theo.
     - Gửi `Input {x:1,y:0}`, chờ 3 tick.
     - Kéo companion ra xa 200 px.
     - `holdReconnect`, `cutConnection`, `vi.waitFor` đến khi `player.offline === true`.
   - Ghi lại vị trí và máu của người và thú. Đường về phía đông từ chỗ xuất hiện (3120, 2400) thoáng ít nhất 200 px (đã đo), đủ cho cả bài test. Sau đó:
     - `room.state.pals.clear()`, `placeWild(room, "scorchtail", player, 30)` (loài hung dữ).
     - `provoke` nó vào người chơi.
     - Gọi thẳng `(room as any).damage(...)` 40 sát thương lên người chơi và lên companion.
     - Chờ 20 tick.
   - Kiểm:
     - Vị trí và máu của người và thú không đổi so với lúc ghi lại (không giả định máu đầy: trước khi rớt có thể đã bị cắn).
     - `wildAggro.get(foe)?.target.id` không phải sessionId đó.
     - `players.size === 1`.
   - `letGo`, rồi `reconnected`. Kiểm:
     - `client.sessionId` như cũ, `player.offline === false`, `players.size === 1`.
     - Companion cùng id, `ownerId` là sessionId đó.
     - `client.state.players.size === 1`, `offline` là `false`.
     - Gửi `Input {x:1,y:0}`, chờ 10 tick: `player.x` tăng hơn 20.
2. `nothing hurts or heals a player while they are away: neither the cold nor time`
   - `room.state.pals.clear()`; đặt người chơi ở `layout.regions.snow` (qua `obstacles.resolve`, như test lạnh hiện có).
   - `holdReconnect` (không mở), cắt, chờ `offline`.
   - Đặt `player.hp = 50`, xoá `lastDamagedAt` của họ, chờ 50 tick (hơn một nhịp khí hậu 2 s; nếu không chặn thì hồi 4 HP/s).
   - Kiểm: `hp === 50`.
3. `saves at the drop and lets the player go when the grace runs out; a late try is refused`
   - Chuẩn bị:
     - `useStore(db)`, token.
     - `reconnectGraceMs = 300`.
     - `capture`, thêm một người quan sát (`connectTo`).
     - `holdReconnect`, cắt.
   - Ngay khi `offline`: `db.load(token)?.pals` có 1 con. Đây là lưu ngay lúc rớt; lưu theo lô phải 2 s sau mới chạy.
   - `vi.waitFor` (timeout 3000) đến khi player bị xoá. Kiểm:
     - Không còn companion của họ.
     - `controls` không còn sessionId; `holds.size === 0`.
     - Hồ sơ vẫn có thú.
     - Người quan sát cũng thấy player đã bị xoá.
   - Mở cổng: `client.onLeave` nhận `CloseCode.FAILED_TO_RECONNECT`.
4. `keeps the place of a dropped player in a full world until their grace runs out`
   - 5 người chơi, `reconnectGraceMs = 400`. Một người tắt tự nối lại và bị cắt; chờ `offline`.
   - Người thứ 6: `connectTo` bị reject.
   - Chờ người kia bị xoá, rồi người thứ 6 vào được; `players.size === 5`.
5. `a player who leaves on purpose is gone at once: no grace, no held place`
   - 5 người chơi, `vi.spyOn(room, "allowReconnection")`, một người gọi `await client.leave()`.
   - Kiểm: spy không được gọi; player bị xoá; người mới vào được ngay.
6. `a reconnection token works once and only for its own session`
   - `holdReconnect`, lưu `oldToken = client.reconnectionToken`, cắt, chờ `offline`.
   - `colyseus.sdk.reconnect(`${room.roomId}:not-the-token`)` bị reject.
   - Mở cổng, `reconnected`. Kiểm:
     - Token đã đổi.
     - `colyseus.sdk.reconnect(oldToken)` bị reject.
     - `players.size === 1`.
7. `one device, one player: joining again from another tab ends the first session`
   - `setup(token)`, `capture`, lưu id thú.
   - Phiên thứ hai cùng token vào cùng phòng. Kiểm:
     - Phiên đầu nhận `onLeave(CLOSE_REPLACED)`.
     - `players.size === 1`.
     - Phiên mới có đúng các id thú đó. Thú vừa bắt; lưu theo lô chưa chạy, nên điều này chứng minh phiên cũ được lưu trước khi đọc hồ sơ.
     - `companions.size === 1`, `ownerId` là phiên mới.
8. `one device, one player: a fresh join ends a session waiting to reconnect, in this world or another, so it cannot save over newer progress`
   - Chuẩn bị: `useStore(db)`.
   - (a) Cùng phòng: phiên A rớt (tắt tự nối lại); B vào bằng cùng token. Kiểm ngay:
     - A bị xoá, `holds.size === 0`.
     - Còn 1 người, B có thú.
   - (b) Phòng khác: B rớt; C vào một phòng mới bằng cùng token. Kiểm ngay:
     - B trong phòng cũ đã bị xoá, `holds.size === 0` (không phải chờ 20 s).
   - Sau đó:
     - Đặt `wood = 77` cho C, rồi `await c.leave()` → `db.load(token).resources.wood === 77`.
     - Gọi `(oldRoom as any).saveNow(bSid)` → vẫn 77.

**Unit test client** (`reconnect.test.ts`):
- Room giả theo `WatchedRoom`:
  - các signal là mảng callback, có hàm bắn sự kiện;
  - `ping(cb)` cất lại `cb`; `leave(c)` và `connection.close(code)` ghi lại tham số.
  - `connection.close(4010)` gọi luôn các handler `onDrop`, như SDK thật (`sdk/src/transport/WebSocketTransport.ts:67-80`).
- `vi.useFakeTimers()` ở `beforeEach`, `vi.useRealTimers()` ở `afterEach`.
1. `applies the reconnect policy to the SDK`: `minUptime 0`, `maxDelay 2000`, `maxRetries 30`, `maxEnqueuedMessages 0`.
2. `goes reconnecting on a drop, once, and back online on reconnect`: listener nhận `reconnecting` một lần dù `onDrop` phát hai lần; sau đó nhận `online` với `previous.state === "reconnecting"`.
3. `gives up after RECONNECT_TRY_MS and leaves if a late try still gets in`:
   - Lúc `RECONNECT_TRY_MS - 1` vẫn là `reconnecting`; thêm 1 ms thì là `lost`/`failed`.
   - `enabled` là `false`, `maxRetries` là 0.
   - `onReconnect` muộn → `leave(true)` được gọi, trạng thái vẫn `lost`.
4. `names why the world was lost from the close code`:
   - `lostReason` cho 4201, 4001, 4000, 4003, 1006.
   - `onLeave(4201)` lúc đang `online` → `replaced`; `onLeave(4003)` sau đó không đổi lý do.
5. `pings while online and treats a silent connection as dropped`: mỗi `PING_EVERY_MS` có một ping. Không trả lời:
   - tới `STALL_MS` chưa đóng;
   - tới `STALL_MS + PING_EVERY_MS` thì `connection.close(4010)` đúng một lần, trạng thái thành `reconnecting`, không ping nữa.
6. `leaves an answering connection alone`:
   - Trả lời mọi ping, 30 s → không đóng.
   - Không trả lời ping nhưng `onStateChange` phát mỗi giây → không đóng.
7. `gives the connection a moment after the page slept`:
   - `vi.setSystemTime(+60 s)` (không chạy timer), rồi chạy một nhịp: không đóng ngay, có ping.
   - Thêm `STALL_MS` không trả lời → đóng 4010.
8. `leaving on purpose`:
   - Đang `online` → `leave(true)`, trạng thái `lost`/`left`, không còn ping.
   - Đang `reconnecting` → `enabled = false`, `lost`/`left`, không gọi `leave`.
9. `stops watching once lost`: sau `onLeave(4003)`, chạy 20 s → không ping, không đóng.

**e2e** (`tests/e2e/multiplayer.spec.ts`; ba test, đều `test.slow()`, tên bắt đầu bằng `connection:`).

Helper:
- `openWithSwitch(browser, name, path = "/", options = {})`:
  - Tạo context mới (đưa vào `contexts`).
  - Gọi `context.routeWebSocket(/:2567\//, handler)` **trước** khi tạo trang:
    - đang cắt thì `ws.close({ code: 4010, reason: "test: network down" })`;
    - không thì `live.push(ws.connectToServer())`.
  - `watch(page, name)`, `goto` kèm `quality=low`.
  - Trả về `{ page, cut, restore }`:
    - `cut()`: bật cờ cắt, rồi `server.close({ code: 4010 })` cho mọi socket đang sống.
    - `restore()`: tắt cờ.
  - JSDoc nói rõ vì sao dùng route thay `setOffline` (server biết ngay, không đụng socket Vite) và rằng tin `pagehide` không qua route.
- `observer(roomId, name)`: `new Client(SERVER).joinById(...)`, như test 5 người. Người quan sát thấy thế giới đúng như server chia sẻ. Cuối test phải `leave()`.
- Dùng lại `enterLobby`, `waitForWorld`, `partyOf`, `sendFrom`, `recordSends`.

Ba test:
1. `connection: a dropped player comes back as themselves, where they stood, with nothing doubled` (desktop):
   - Chuẩn bị:
     - `openWithSwitch`, `enterLobby`, `waitForWorld`, chờ `frames > 0`.
     - Thêm người quan sát.
     - `debug:givePal` leafkit cấp 3; chờ `companions.size === 1`.
     - Gắn dấu `room.__mark = "before-drop"`; `recordSends`, ghi số tin đã gửi `n0`.
   - `cut()`. Trong lúc mất mạng:
     - `.net-overlay` hiện, có chữ "Đang kết nối lại".
     - Giữ "d" 600 ms rồi bấm Space: các tin gửi sau `n0` phải là `[]`.
     - Người quan sát thấy `offline === true`, `companions.size === 1`; ghi lại vị trí đứng yên.
   - `restore()`. Lớp phủ ẩn (timeout 15 s); `.hud-toast` có "Đã kết nối lại". Kiểm:
     - `room.__mark === "before-drop"` (cùng đối tượng `Room`), sessionId như cũ.
     - Vị trí bằng vị trí đứng yên (±1 px); `activePalId` như cũ.
     - `room.state.players.size === 2`.
     - `game.players.size === 2`, `game.companions.size === 1`.
     - `expect.poll`: `game.pals.size === room.state.pals.size`.
     - Đúng một `.label.me`.
     - Người quan sát thấy `offline === false`.
   - Giữ "d" 600 ms: người quan sát thấy x tăng hơn 40.
2. `connection: when the world has let the player go, the screen says so and the lobby takes them back` (điện thoại 390×844, `hasTouch`, `isMobile`):
   - Chuẩn bị: `openWithSwitch` với options điện thoại, vào thế giới, thêm người quan sát, `debug:givePal` leafkit.
   - `cut()`:
     - Có chữ "Đang kết nối lại"; nút "Về sảnh" phụ ≥ 44×44.
     - Người quan sát thấy `offline === true`.
     - `observer.send("debug:endGrace")`; người quan sát thấy player đã bị xoá.
   - `restore()`:
     - "Không kết nối lại được", dòng giải thích có "đã được lưu".
     - `.net-lobby` đang có focus.
     - Với 390×844, 844×390, 1280×720: nút ≥ 44×44 và hộp nằm gọn trong màn.
   - Về lại 390×844, `tap()` "Về sảnh":
     - URL có `room === roomId` và `quality === "low"`.
     - `enterLobby`, `waitForWorld`: cùng `roomId`; `partyOf(page).species` chứa `"leafkit"`; `players.size === 2`.
3. `connection: one device, one player; closing the page frees the place at once` (desktop, trang thường không route):
   - Chuẩn bị: `join` trang A (`Twin`), thêm người quan sát, `debug:givePal` leafkit.
   - Trang B **cùng context** (cùng token): `context.newPage()`, `watch`, `goto ?room=<id>&quality=low`, `enterLobby`, `waitForWorld`. Kiểm:
     - A có lớp phủ "Bạn đang chơi ở nơi khác", focus ở "Về sảnh".
     - B thấy `players.size === 2` (B và người quan sát, không có bản thứ hai của Twin).
     - B có leafkit; `companions.size === 1`.
   - `b.goto("about:blank")`: người quan sát thấy B bị xoá trong 5 s. Nếu là rớt mạng thì phải 20 s.

**Lệnh cho tester:**
- `npm run typecheck`.
- `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "reconnecting after a dropped connection"`, lặp 10 lần.
- `npx vitest run packages/client/src/net/reconnect.test.ts`.
- `npm test` 3 lần liền.
- `npm run build`.
- `npx playwright test -g "connection:" --repeat-each=3 --workers=1`.
- `npm run test:e2e` một lần, để thấy các test cũ không hỏng, nhất là test tải lại trang "a captured pal follows…".

**Kiểm đột biến** (khuyến nghị, trên bản sao ngoài repo như T17; mỗi lần chỉ một đột biến):
- Bỏ `allowReconnection` trong `onDrop` → test 1 hỏng.
- Bỏ cổng `sheltered` trong `damage()` → test 1 hỏng.
- Bỏ `if (owner.offline) return` → test 1 hỏng.
- Bỏ chặn trong `tickClimate` hoặc `tickRegen` → test 2 hỏng.
- Bỏ `saveNow` trong `onDrop` → test 3 hỏng.
- Đọc hồ sơ trước khi kết thúc phiên cũ → test 7 hỏng.
- Bỏ `liveSessions` → test 8 hỏng.
- Bỏ `maxEnqueuedMessages: 0` → unit 1 hỏng.
- Bỏ kiểm tra treo → unit 5 hỏng.

## Tiêu chí hoàn thành

- [ ] **API đúng 0.18:**
  - Server dùng `onDrop`, `allowReconnection(client, reconnectGraceMs / 1000)`, `onReconnect`, `onLeave`.
  - `.catch` trên kết quả `allowReconnection`; chỉ coi là đang giữ khi kết quả `instanceof Deferred`.
  - Client không dùng `client.reconnect()`, không gọi lại `bindRoom()`, không tạo `Room` mới.
- [ ] **Rớt mạng (server):**
  - Player ở lại với `offline = true`; ý định, lướt và lệnh chiêu bị xoá.
  - Aggro lên họ và thú của họ bị bỏ; chiêu chưa phát của companion bị huỷ.
  - Lưu ngay.
- [ ] **Bảo vệ và đứng yên:**
  - `targetPos`, `wildTarget`, `damage()` dùng `sheltered`.
  - `tickCompanions`, `tickExploration`, `tickClimate`, `tickRegen` bỏ qua người đang chờ.
  - Không chặn thêm chỗ nào khác.
- [ ] **Quay lại:** cùng sessionId, `offline = false`, không tạo lại player hay companion, không có người thứ hai.
- [ ] **Hết hạn và rời chủ động:**
  - `removePlayer` lưu trước rồi xoá đủ các Map trong bảng mục 3; gọi lại lần hai an toàn.
  - Rời chủ động không gọi `allowReconnection`.
- [ ] **Mỗi thiết bị một phiên:**
  - `liveSessions` trong toàn process.
  - Phiên cũ kết thúc trước `store().load`: phiên đang chờ thì reject, tab đang mở thì `leave(CLOSE_REPLACED)`.
  - `onDispose` dọn `liveSessions`.
- [ ] **Không có số cứng:** dùng `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `CLOSE_REPLACED` từ shared, và các hằng có tên trong `reconnect.ts`.
- [ ] **`debug:endGrace`** chỉ đăng ký khi `PETGAME_DEBUG=1`.
- [ ] **Client, SDK và watch:**
  - Áp `SDK_RECONNECTION`.
  - Bỏ cuộc sau `RECONNECT_TRY_MS`; lần thử muộn sau khi bỏ cuộc thì `leave(true)`.
  - Watchdog ping 2 s, coi là treo sau 6 s, xử lý được trang vừa ngủ dậy.
- [ ] **Client, Game:**
  - Không gửi gì khi chưa `online`; phím và nút game không có tác dụng; nhân vật đứng yên.
  - Gửi lại hướng đi sau khi nối lại; huỷ lướt khi rớt.
  - Trang ẩn thì dừng đi.
  - `pagehide` → rời chủ động.
  - Không còn toast "Mất kết nối với server".
- [ ] **Giao diện:**
  - Chữ đúng bảng mục 4.
  - Lớp phủ ở trên mọi thứ và chặn chạm.
  - Nút ≥ 44×44 ở 390×844, 844×390, 1280×720; focus sẵn khi mất hẳn.
  - "Về sảnh" giữ `?room=` khi còn bạn trong thế giới.
  - Người khác đang chờ hiện mờ, tên kèm "(mất kết nối)".
- [ ] **Test:**
  - 8 test tích hợp, 9 unit test, 3 e2e mới đều qua, và qua khi chạy lặp như mục Test.
  - `npm run typecheck` sạch; `npm test`, `npm run build`, `npm run test:e2e` qua.
  - Không nới lỏng hay bỏ qua test cũ nào.
- [ ] **Tài liệu:** `docs/architecture.md` và `docs/choi-tren-iphone.md` cập nhật như bước B9. `docs/design/multiplayer.md` đã có, do game-designer viết.

## Rủi ro, câu hỏi mở

- **Không có dòng CHẶN.**
  - Không đổi hồ sơ lưu, không đổi kiến trúc mạng (dùng cơ chế có sẵn của Colyseus).
  - Trường schema mới chỉ thêm, không làm hỏng dữ liệu đã lưu.
  - Hai quyết định nhỏ tự đặt, đảo lại được:
    - "Người vào sau thắng" khi cùng thiết bị vào hai lần.
    - Đóng trang là rời chủ động.
- **`pagehide` trên điện thoại:** trình duyệt chính không bắn `pagehide` khi chỉ chuyển app (chỉ bắn `visibilitychange`). Nếu trình duyệt nào có bắn, người chơi bị lưu rồi xoá thay vì được giữ chỗ; quay lại sẽ thấy "Bạn đã rời thế giới" kèm nút Về sảnh. Kết quả xấu đi một chút, không mất gì.
- **Server chỉ biết socket chết qua ping (6-9 s).** Trong khoảng đó, người chơi chưa được bảo vệ (server chưa biết họ mất mạng). Muốn nhanh hơn thì chỉnh `pingInterval` của transport: không cần trong nhiệm vụ này.
- **Android có thể giữ socket sống khi chuyển app** (trình duyệt tự trả lời ping), nên nhân vật không được bảo vệ, chỉ dừng đi. Ghi đề xuất riêng.
- **`liveSessions` chỉ đúng khi chạy một process.** Nếu sau này chạy nhiều process (Redis driver), phải chuyển sang Presence của Colyseus.
- **Phòng đầy cùng người đang được giữ chỗ:** chính người đó vào lại từ sảnh (không qua tự nối lại) phải chờ hết hạn. Lỗi ở sảnh vẫn là "đầy 5 người", đúng sự thật. Chấp nhận.
- **Câu "Thú, đồ và trại đã được lưu"** sai cho người chơi không có token (chế độ riêng tư chặn `localStorage`): hiếm, như hiện nay.
- **Watchdog có thể nối lại "oan"** nếu luồng chính bị chặn lâu mà nhịp kiểm tra vẫn đều. Luật "trang vừa ngủ dậy" che phần lớn trường hợp. Nếu có xảy ra thì vô hại: nối lại mất khoảng 200 ms.
- **Ghi chú cho người sẽ tách `GameRoom.ts` (T10):** test dùng trường riêng qua `as any` (`holds`, `reconnectGraceMs`, `controls`, `wildAggro`, `lastDamagedAt`, `saveNow`, `damage`, `provoke`). T10 phải giữ các trường này hoặc sửa test theo.
- **Gợi ý ở sảnh:** khi "Về sảnh" kèm `?room=`, sảnh hiện "Bạn được mời vào thế giới của bạn bè", hơi lệch với thế giới của chính mình. Để T15 hoặc T12 xử lý.

## Đề xuất cho TASKS.md

- **T3 có thể tách nếu một vòng coder không đủ:**
  - T3a = Bước A (server và shared cùng test tích hợp; tự đứng được).
  - T3b = Bước B (client, e2e, tài liệu).
- **(P2, mới) Vào lại đúng thế giới sau khi tải lại trang hoặc iOS đóng tab.** Hai cách:
  - Sau khi vào phòng, ghi `?room=<id>` vào thanh địa chỉ (`history.replaceState`), để tải lại là về đúng thế giới.
  - Hoặc lưu `room.reconnectionToken` vào `sessionStorage` và thử `client.reconnect` trước khi hiện sảnh.
  - Cần quyết định cùng T15 (sảnh báo lỗi khi thế giới đã đóng; cho nút "Tạo thế giới mới").
- **(P3, mới) Bảo vệ người chơi khi trang bị ẩn lâu mà socket vẫn sống (Android).** Ví dụ chủ động đóng kết nối (mã 4010) sau N giây ẩn trang. Cần game-designer cân nhắc.
- **(P3, mới) `calmPalsTargeting` không xoá `pal.windup`.** Thú đang gồng cắn người vừa rời đi hoặc vừa rớt vẫn giữ tư thế gồng tới lần tấn công sau. Chỉ ảnh hưởng hình ảnh, có từ trước.
- **(P3) Cập nhật danh sách hook `debug:*` trong `CLAUDE.md`:** thêm `endGrace`. Agent chính sửa, vì các agent khác không sửa `CLAUDE.md`.
