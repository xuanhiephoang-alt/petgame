# PLAN: T49 Giữ thế giới trống thêm một lúc

Đọc code ở HEAD `a19086a`. Luật chơi đã ghi vào `docs/design/multiplayer.md` (mục mới "Thế giới không còn ai: giữ thêm 60 giây (T49)", và các mục "Tải lại trang", "Vào thế giới: lỗi", T42, "Quay lại", "Đã cân nhắc" đã sửa theo). PLAN này là phần kỹ thuật.

File liên quan:
- `packages/server/src/rooms/GameRoom.ts`:
  - trường `holds`, `reconnectGraceMs` ở dòng 291-294;
  - `onCreate` ở dòng 354, hook `debug:endGrace` ở dòng 483-486, `setSimulationInterval` ở dòng 489;
  - `onJoin` ở dòng 492, `onDrop` 572, `onReconnect` 598, `onLeave` 605-607, `onDispose` 610-612, `removePlayer` 618, `endSession` 641;
  - `scheduleSave`/`saveNow` ở dòng 2130-2164 (`saveNow` không làm gì khi người chơi đã bị xoá).
- `packages/shared/src/constants.ts`: `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `CLOSE_REPLACED` ở dòng 40-55.
- `packages/client/src/main.ts`:
  - `ROOM_KEY` dòng 31-32; `invited`/`returning`/`roomHint` dòng 64-67;
  - `dropWorldFromAddress` dòng 74-79; `failToStart` dòng 105-116; `enter` dòng 118-153;
  - `startGame` dòng 182-218 (`syncAddress` 186-196, `withFriends` và `react` 200-212).
- `packages/client/src/net/connection.ts`: `lobbyUrl(roomId, withFriends)` dòng 54-64; `connect` đọc `?room=` từ `location` mỗi lần gọi.
- `packages/client/src/ui/joinStatus.ts`: `RETURN_HINT`, `INVITE_HINT`, `joinCard(failure, returning)`.
- Test: `packages/server/src/rooms/GameRoom.test.ts` (describe "reconnecting after a dropped connection" dòng 2449, helper `cutConnection`, `holdReconnect`, `crowd`, `holdsOf`); `packages/client/src/net/connection.test.ts`; `packages/client/src/ui/joinStatus.test.ts`; `tests/e2e/multiplayer.spec.ts` (test "lobby: a reload goes back…" dòng 1666-1748, test T42 "lobby: when the game cannot start…" dòng 1817-1885, `observer` dòng 2018, `sendFrom` dòng 1392, `playerCount` dòng 93).

### Colyseus 0.18.18 làm gì (đã đọc `node_modules/@colyseus/core/build/Room.mjs`)

- `autoDispose` là accessor. Khai báo như trường của class (giống `maxClients = MAX_PLAYERS`) thì `__init()` chép giá trị vào accessor trước `onCreate`. Với `autoDispose = false`, lần hẹn `resetAutoDisposeTimeout(seatReservationTimeout)` cuối `__init` không đặt hẹn giờ nào.
- Phòng tự đóng qua `#_disposeIfEmpty`, chạy sau mỗi lần một client ra hẳn (`#_decrementClientCount`), khi chỗ giữ hết hạn, và khi hẹn giờ tự đóng chạy. Nó chỉ đóng khi đủ cả 4 điều kiện: `autoDispose` bật, không có hẹn giờ tự đóng đang chờ, `clients.length === 0`, không còn chỗ giữ (`_reservedSeats`, gồm người đang vào dở và người đang chờ nối lại), và không có `onLeave` nào đang chạy.
- Gán `autoDispose` một giá trị **khác** giá trị cũ (sau `__init`, khi phòng chưa đóng) thì setter gọi `resetAutoDisposeTimeout()`. Hàm này xoá hẹn giờ cũ. Nếu `autoDispose` bật thì nó hẹn kiểm tra `#_disposeIfEmpty` sau **1 giây**; nếu tắt thì không hẹn gì. `resetAutoDisposeTimeout` là private trong `Room.d.ts`, nên không đổi được con số 1 giây.
- `_onJoin` xoá hẹn giờ tự đóng trước khi gọi `onJoin`.
- `disconnect()` (server tắt, `matchMaker.disconnectAll()` trong `colyseus.cleanup()` của test) tự bật `#_autoDispose` và đóng phòng bất kể ta đặt gì.
- `this.clock` chỉ chạy khi có người gọi `clock.tick()`, và chỉ vòng mô phỏng (`setSimulationInterval`) gọi nó. Nếu dừng mô phỏng thì mọi `this.clock.setTimeout` cũng dừng: hồi sinh trùm, đầu đàn, rương, quả, và cả hẹn giờ đóng thế giới.
- `onLeave` luôn chạy cho mọi đường ra:
  - rời chủ động (4000);
  - hết hạn chờ nối lại: `onDrop`, rồi `#_onAfterLeave` gọi `onLeave`;
  - bị thay bởi `endSession`: `reject(false)`, hoặc `leave(CLOSE_REPLACED)` (đi qua `onDrop`, `onDrop` trả về sớm, rồi `onLeave`);
  - `onJoin` ném lỗi.

  `onLeave` chạy trước `#_decrementClientCount`. Phần dọn của `removePlayer` (lưu rồi xoá) đã đúng cho cả 4 đường.

### Số đo (script tạm trong scratchpad, chỉ đọc, đã chạy bằng `npx tsx`)

- Một `GameRoom` không người (87 thú hoang): `tick` tốn trung bình **0,064 ms**, tức 1,3 ms mỗi giây ở 20 nhịp, **0,13% một nhân CPU**. Patch không có client nào thì Colyseus chỉ bỏ thay đổi đi, cùng cỡ hoặc rẻ hơn.
- Bộ nhớ heap: khoảng **0,35 MB mỗi phòng**.

## Mục tiêu

- Người chơi một mình tải lại trang (hoặc iOS dỡ tab rồi mở lại) trong vòng một phút thì về **đúng thế giới cũ**, nên link mời họ vừa gửi bạn bè vẫn dùng được.
- Cả nhóm cùng tải lại (ví dụ sau khi server đổi bản) không còn gặp "Thế giới này đã đóng".
- Người rớt mạng bấm **Về sảnh** sau 30 giây vẫn kịp về thế giới cũ, kể cả khi chơi một mình.
- Người chơi một mình quay lại muộn (thế giới đã đóng) **không** bị thẻ lỗi: vào thẳng thế giới mới, như trước T23.

## Phạm vi

Làm:
1. Server: thế giới không còn ai thì mở thêm `EMPTY_WORLD_HOLD_MS` (60 s) rồi mới đóng. Có người vào thì thôi đếm. Thế giới vừa tạo mà chưa ai vào cũng theo luật này.
2. Server: hook thử nghiệm `debug:emptyHold { ms }` rút ngắn khoảng giữ của phòng (chỉ khi `PETGAME_DEBUG=1`).
3. Client: luôn ghi `?room=` khi đang chơi, cả khi một mình (trừ sau khi server khởi động lại). Tab nhớ lần cuối có bạn bè không. Quay lại một mình mà thế giới đã đóng thì vào thẳng thế giới mới, không có thẻ.
4. Test server, unit client, e2e; cập nhật `docs/architecture.md`.

KHÔNG làm:
- Không đổi `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS` hay cách nối lại.
- Không tự vào thế giới từ sảnh. Không dùng mã kết nối lại khi tải lại trang.
- Không đổi `schema.ts`, `messages.ts`, `Profile`.
- Không đổi listing hay `setPrivate` của phòng. Client chỉ dùng `create` và `joinById`, nên không ai bị ghép vào thế giới trống.
- Không thêm thông báo trong game kiểu "thế giới cũ đã đóng".
- Không giới hạn số thế giới mỗi IP.
- Không làm PWA `start_url` (T13), không làm các việc dọn của T50 (502/504, `location.reload` khi có `#`).

## Thiết kế

### 1. Khoảng giữ: 60 giây, nằm trong bảng hằng số

`packages/shared/src/constants.ts`, cạnh `RECONNECT_*`: `EMPTY_WORLD_HOLD_MS = 60_000`. Đặt ở shared (dù client chưa dùng) để mọi số về vào/rời nằm một chỗ, như `RECONNECT_GRACE_MS`.

Lý do chọn 60 (nhiệm vụ cho 30-60):
- **Tải lại một mình:** sảnh sẵn sàng sau 5,3 s ở 4G chậm, 11,3 s ở 3G, 20,7 s ở 3G chậm (`docs/design/multiplayer.md`, mục "Mở game"), cộng 2-5 s để bấm "Vào chơi". Vậy 3G chậm cần khoảng 25 s. 30 s thì quá sát, 45 s còn khoảng 20 s cho người chơi đọc sảnh.
- **Rớt mạng rồi Về sảnh:** quyết định chọn 60.
  - Thế giới đóng lúc: mất mạng + d_server (0-9 s) + 20 s chờ nối lại + H.
  - Nút Về sảnh hiện lúc: mất mạng + d_client (đến khoảng 8 s, watchdog) + 30 s.
  - Xấu nhất (d_server = 0, d_client = 8), thời gian còn lại là 20 + H − 38. Với H = 45 chỉ còn 27 s, vừa đủ cho 3G chậm (khoảng 25 s). Với H = 60 còn 42 s, dư rộng.
- **Chi phí** không đáng kể: 0,13% CPU và 0,35 MB mỗi thế giới trống (số đo ở trên).

### 2. Thế giới trống vẫn chạy, không tạm dừng

- `this.clock` chỉ chạy theo vòng mô phỏng. Dừng mô phỏng là dừng cả hẹn giờ đóng thế giới lẫn mọi hồi sinh. Muốn dừng thì phải viết lại phần hẹn giờ bằng `setTimeout` của Node, trái quy ước "hẹn giờ bằng `this.clock.setTimeout`".
- Chạy tiếp rẻ (0,13% CPU).
- Người quay lại thấy thế giới trôi đi một phút: thú hoang khác chỗ, giờ trong ngày đã đổi, trùm hay đầu đàn có thể đã hồi. Điều này đúng với cảm giác "vắng mặt một lúc", giống khi bạn bè vẫn ở lại.
- Hẹn giờ của người vừa ra vẫn chạy trong lúc giữ (ví dụ tin bắt thú `CAPTURE_NEWS_DELAY_MS`, `scheduleSave`). Chúng đã được viết để chịu được người chơi không còn (vì khi có người khác ở lại, phòng vốn không đóng): `saveNow` thấy không còn `player` hay `token` thì thôi; hẹn giờ của tin bắt thú kiểm `players.get(...)`. Không cần sửa gì.

### 3. Cơ chế: `autoDispose` tắt, một hẹn giờ của phòng

Trạng thái của phòng:

| Trạng thái | `autoDispose` | `emptyHold` |
|---|---|---|
| Có người (kể cả người đang chờ nối lại, `offline`) | `false` | không có |
| Không còn ai, đang giữ | `false` | đang đếm `emptyHoldMs` |
| Hết giữ | `true` | không có (Colyseus đóng phòng sau tối đa 1 s, khi không còn ai và không ai đang vào dở) |

- **Khi tạo** (`onCreate`, cuối hàm): `holdEmptyWorld()`. Phòng do `client.create` tạo ra mà người tạo không bao giờ kết nối (mạng hỏng giữa chừng) vẫn đóng sau 60 s. Nếu không có bước này, khi `autoDispose` tắt, phòng đó sẽ sống mãi (trước T49 Colyseus đóng nó sau 15 s giữ chỗ).
- **Khi vào** (`onJoin`, dòng đầu tiên): `keepWorldOpen()` huỷ hẹn giờ và đặt `autoDispose = false`. Việc đặt lại này cần cho trường hợp có người vào trong 1 giây sau khi hết giữ.
- **Khi ra** (`onLeave`, sau `removePlayer`): nếu `this.state.players.size === 0` thì `holdEmptyWorld()`.
  - Đếm `players` chứ không đếm `clients`: người đang chờ nối lại vẫn nằm trong `players`. Nhờ vậy khoảng giữ 60 s chỉ bắt đầu sau khi 20 s chờ nối lại kết thúc. Hai khoảng nối tiếp nhau, không chồng.
  - Thiết bị vào lại đúng thế giới này khi phiên cũ đang chờ nối lại: `endSession` trong `onJoin` xoá phiên cũ, nhưng `onLeave` của phiên cũ chạy sau (promise bị reject chạy ở microtask). Lúc đó người mới đã có trong `players`, nên không có hẹn giờ thừa.
  - Chỉ hẹn trong `onLeave`, không hẹn trong `removePlayer`: `removePlayer` cũng chạy giữa `onJoin` (qua `endSession`), khi người mới chưa được thêm.
- **Hết giữ** (`closeIfStillEmpty`): xoá tham chiếu `emptyHold`. Còn người thì thôi (lưới an toàn; người đó ra sẽ hẹn lại). Không còn ai thì `this.autoDispose = true`. Setter của Colyseus hẹn `#_disposeIfEmpty` sau 1 s. Hàm này tự chờ người đang vào dở (chỗ giữ của matchmaker) và `onLeave` đang chạy, nên không cắt ngang ai.
  - **Không** gọi `this.disconnect()` thẳng. Người bạn vừa bấm link (đã giữ chỗ, socket chưa mở) sẽ bị cắt, và client xếp lỗi đó là "failed" chứ không phải "closed".
- **Server tắt** và `colyseus.cleanup()`: `disconnect()` vẫn đóng ngay. Hẹn giờ của phòng bị `clock.clear()` dọn trong `#_dispose`. `onLeave` chạy trong lúc đóng có thể hẹn `emptyHold`, vô hại vì nó bị dọn ngay sau đó.
- `holdEmptyWorld()` luôn `clear()` hẹn giờ cũ trước khi hẹn mới, nên gọi hai lần vẫn an toàn.

### 4. Vào bằng `?room=` trong lúc giữ

- Phòng trống không bị khoá (Colyseus mở khoá khi số client giảm dưới `maxClients`) và vẫn nằm trong listing. Vì vậy `joinById` vào được như lúc có người.
- Hết giữ và đã đóng: `joinById` trả 522 không có chữ "is locked", nên `joinFailure` cho ra "closed", như trước.
- Listing: phòng vẫn công khai như trước T49. Không đổi, vì client không bao giờ vào theo tên (`join`/`joinOrCreate`). Ghi vào rủi ro: nếu sau này có ghép ngẫu nhiên thì phải loại thế giới trống.

### 5. Lưu hồ sơ: không mất, không lưu đôi

- Người chơi được lưu đúng như trước:
  - lúc rớt mạng (`onDrop` gọi `saveNow`);
  - lúc ra hẳn (`removePlayer` gọi `saveNow`);
  - theo lô (`scheduleSave`).
- Trong lúc giữ không còn ai, nên không có gì để lưu. `scheduleSave` đang chờ chạy vào lúc đó thì `saveNow` không làm gì (không còn `player`).
- Người vào lại đọc hồ sơ vừa lưu bằng token (`onJoin`), như vào một thế giới mới. Không có trạng thái người chơi nào sống trong phòng giữa hai phiên. Vị trí và máu không được giữ: vào lại vẫn ở giữa bản đồ, đầy máu.
- `liveSessions`: `removePlayer` đã xoá mục của phiên. `onDispose` vẫn dọn như cũ. Không đổi.
- Không đổi `Profile`, không cần chuyển dữ liệu cũ.

### 6. Hook thử nghiệm `debug:emptyHold`

- `{ ms: number }` đặt `this.emptyHoldMs = clamp(floor(ms), 0, EMPTY_WORLD_HOLD_MS)` cho **phòng của người gửi**. Chỉ rút ngắn, không kéo dài. `ms` không phải số hữu hạn thì bỏ qua.
- Có tác dụng từ lần giữ **sau** (người gửi đang ở trong phòng, nên lúc đó chưa có lần giữ nào chạy).
- Chỉ đăng ký khi `PETGAME_DEBUG=1`, đặt cạnh `debug:endGrace`.
- Dùng trong e2e: muốn có một thế giới đã đóng thì người cuối gửi `{ ms: 0 }` trước khi rời. Thế giới đóng khoảng 1,05 s sau đó (1 nhịp + 1 s của Colyseus).

### 7. Client: địa chỉ luôn ghi thế giới

Luật (đã ghi ở `docs/design/multiplayer.md`):

| Lúc | Địa chỉ |
|---|---|
| Đang chơi, có bạn bè hay một mình | `?room=<thế giới>` |
| Mất hẳn kết nối (thất bại, bị thay, bị đá) | `?room=<thế giới>` |
| Server khởi động lại (`reason === "shutdown"`) | không có `room` |
| Biết thế giới đã đóng (thẻ "closed", hoặc vào thẳng thế giới mới) | không có `room` (`dropWorldFromAddress`, như T23) |

`sessionStorage` của tab có hai khoá:
- `petgame:room` (`ROOM_KEY`, đã có): thế giới vừa vào.
- `petgame:friends` (`FRIENDS_KEY`, mới): `"1"` nếu lần cuối tab thấy thế giới có người khác, `"0"` nếu một mình.

Cả hai được ghi cùng địa chỉ, mỗi khi "có bạn bè hay không" đổi. Tab của bản trước T49 không có `FRIENDS_KEY` thì coi như `"1"`: hồi đó địa chỉ chỉ có `room` khi có bạn bè.

**Sảnh khi mở trang** (`arrival`, hàm thuần mới trong `ui/joinStatus.ts`):

| `?room=` | `petgame:room` | `petgame:friends` | `Arrival` | Chữ `#room-hint` | Focus nút "Vào chơi" |
|---|---|---|---|---|---|
| không có | bất kỳ | bất kỳ | `"new"` | "" | không (như cũ) |
| X | khác X hoặc không có | bất kỳ | `"invited"` | `INVITE_HINT` "Bạn được mời vào thế giới của bạn bè" | không |
| X | X | `"0"` | `"backAlone"` | "" | có |
| X | X | `"1"` hoặc không có | `"back"` | `RETURN_HINT` "Quay lại thế giới bạn đang chơi cùng bạn bè" | có |

**Vào hỏng** (`enter`):
- `"backAlone"`, lỗi `closed`, và địa chỉ vẫn còn `room`: không hiện thẻ. Gọi `dropWorldFromAddress()` rồi thử vào **một lần nữa**, lần này không có `room`, nên `connect` gọi `create`. Nút giữ chữ "Đang vào...". Lần thử thêm này chỉ có một lần cho mỗi trang (một cờ được tắt khi dùng). Sau khi bỏ `room` thì lỗi "closed" cũng không thể xảy ra lại.
  - Lần thử thêm mà hỏng (ví dụ mất mạng đúng lúc đó) thì hiện thẻ của lỗi đó như thường.
  - Lỗi "closed" lần đầu là chuyện bình thường, không `console.error` (e2e chỉ in log khi test lỗi, nhưng đừng làm nhiễu).
- `"back"` + `closed`: thẻ "Thế giới này đã đóng" với chữ "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn." (`joinCard(failure, true)`), như T23.
- Các lỗi khác: không đổi. `joinCard(failure, returning)` với `returning = arrived === "back" || arrived === "backAlone"`.

**Điện thoại và bàn phím:** không có nút hay phím mới. Enter vẫn vào (nút có focus khi quay lại). Thẻ lỗi không đổi kích cỡ.

## Kế hoạch triển khai

Một commit cho cả nhiệm vụ: server, client, test, tài liệu. Thứ tự làm:

1. **`packages/shared/src/constants.ts`:** thêm sau `RECONNECT_TRY_MS`:
   - `EMPTY_WORLD_HOLD_MS = 60_000`;
   - JSDoc tiếng Anh: thế giới không còn người chơi (kể cả người chờ nối lại) thì mở thêm chừng này để tải lại, link mời và Về sảnh còn tìm thấy nó; con số đến từ đâu (3G chậm, và Về sảnh sau `RECONNECT_TRY_MS`); Colyseus đóng thế giới thêm tối đa khoảng 1 s sau đó.

2. **`packages/server/src/rooms/GameRoom.ts`:**
   - Import `type Delayed` từ `"colyseus"` (cùng dòng với `Deferred, Room, type Client`) và `EMPTY_WORLD_HOLD_MS` từ `@petgame/shared`.
   - Trường của class, đặt cạnh `maxClients`:
     - `autoDispose = false;` với JSDoc: phòng không tự đóng khi người cuối rời đi; `holdEmptyWorld` quyết định lúc đóng;
     - `private emptyHoldMs = EMPTY_WORLD_HOLD_MS;` với JSDoc "tests and debug:emptyHold shorten it", như `reconnectGraceMs`;
     - `private emptyHold: Delayed | undefined;`.
   - `onCreate`: sau `this.setSimulationInterval(...)`, gọi `this.holdEmptyWorld();` kèm chú thích: thế giới được tạo mà người tạo chưa vào cũng không sống mãi.
   - Hook mới trong khối `PETGAME_DEBUG`, cạnh `debug:endGrace`: `this.onMessage("debug:emptyHold", (_client, message?: { ms?: number }) => { ... })`, luật ở Thiết kế 6.
   - `onJoin`: dòng đầu `this.keepWorldOpen();`.
   - `onLeave`: sau `this.removePlayer(client.sessionId);`, thêm `if (this.state.players.size === 0) this.holdEmptyWorld();`. Cập nhật JSDoc: người cuối ra thì thế giới được giữ.
   - Ba method mới, đặt sau `endSession`, có JSDoc tiếng Anh:
     - `private holdEmptyWorld()`: `this.emptyHold?.clear(); this.emptyHold = this.clock.setTimeout(() => this.closeIfStillEmpty(), this.emptyHoldMs);`
     - `private keepWorldOpen()`: `this.emptyHold?.clear(); this.emptyHold = undefined; this.autoDispose = false;`
     - `private closeIfStillEmpty()`: `this.emptyHold = undefined; if (this.state.players.size > 0) return; this.autoDispose = true;`. Chú thích nói vì sao không gọi `disconnect()` (Thiết kế 3).
   - Không đổi `onDrop`, `onReconnect`, `removePlayer`, `endSession`, `onDispose`.

3. **`packages/client/src/net/connection.ts`:**
   - `lobbyUrl(roomId, withFriends)` đổi tên tham số thành `keepWorld`. Logic giữ nguyên.
   - Viết lại JSDoc: `keepWorld` thì địa chỉ ghi thế giới (thế giới còn mở khi có người, và thêm `EMPTY_WORLD_HOLD_MS` sau người cuối); không thì mở thế giới mới. Chỉ dùng `false` sau khi server khởi động lại và khi biết thế giới đã đóng.

4. **`packages/client/src/ui/joinStatus.ts`:**
   - Thêm `export type Arrival = "new" | "invited" | "back" | "backAlone";`.
   - Thêm `export function arrival(invited: string | null, lastRoom: string | null | undefined, lastFriends: string | null | undefined): Arrival`, theo bảng ở Thiết kế 7.
   - Thêm `export function arrivalHint(a: Arrival): string`: `"back"` cho `RETURN_HINT`, `"invited"` cho `INVITE_HINT`, còn lại "".
   - JSDoc tiếng Anh. `RETURN_HINT`, `INVITE_HINT`, `joinCard` giữ nguyên.

5. **`packages/client/src/main.ts`:**
   - Thêm `const FRIENDS_KEY = "petgame:friends";` có JSDoc. Sửa JSDoc `ROOM_KEY`: nó chọn chữ trên sảnh và cách báo khi thế giới đã đóng.
   - Dòng 64-67:
     - `const arrived = arrival(invited, safeStorage(() => sessionStorage.getItem(ROOM_KEY)), safeStorage(() => sessionStorage.getItem(FRIENDS_KEY)));`
     - `const returning = arrived === "back" || arrived === "backAlone";`
     - `roomHint.textContent = arrivalHint(arrived);`
     - Dòng 179 `if (returning) joinBtn.focus(...)` giữ nguyên.
   - Hàm mới `rememberWorld(roomId: string, friends: boolean)`:
     - ghi `ROOM_KEY`;
     - ghi `FRIENDS_KEY` (`"1"`/`"0"`);
     - `setAddress(lobbyUrl(roomId, true))`.
   - `failToStart`: thay dòng 109-111 bằng `rememberWorld(room.roomId, (room.state.players?.size ?? 0) > 1);`. Sửa chú thích: thế giới được giữ cho lần tải lại. Cách này cũng sửa luôn lỗi nhỏ: khi `assets` hỏng thì `startGame` không chạy, nên trước đây `ROOM_KEY` không được ghi và tải lại hiện sai chữ "Bạn được mời…".
   - `startGame`:
     - bỏ dòng 185 (`ROOM_KEY`);
     - `syncAddress` thành: `const friends = size > 1; if (friends === last) return; last = friends; rememberWorld(room.roomId, friends);`. Bỏ điều kiện `size === 0`: trước khi state tới thì coi là một mình;
     - gọi một lần ngay và theo `onStateChange`, như cũ;
     - sửa chú thích dòng 186-188.
   - `react`/overlay:
     - bỏ `withFriends` và dòng 204;
     - thêm `let keepWorld = true;`, đổi thành `false` khi `status.state === "lost" && status.reason === "shutdown"`;
     - khi `lost`: `setAddress(lobbyUrl(room.roomId, keepWorld))`;
     - callback của `ConnectionOverlay` dùng `lobbyUrl(room.roomId, keepWorld)`;
     - sửa chú thích dòng 200 và 205.
   - `enter`: thực hiện luật "Vào hỏng" ở Thiết kế 7.
     - Gợi ý: thêm `let quietRetry = arrived === "backAlone";` ở cấp module.
     - Trong `enter`, gói lần gọi `Promise.allSettled([connect(...)..., assets])` vào một hàm nhỏ.
     - Khi `joinFailure(...) === "closed"`, `quietRetry` đang bật và `new URLSearchParams(location.search).get("room") === invited`: tắt `quietRetry`, gọi `dropWorldFromAddress()`, rồi gọi lại hàm đó một lần.
     - Giữ chú thích cũ "Both are awaited even when one fails first…".
     - `joining` vẫn bật suốt hai lần thử.
     - Thêm JSDoc cho `enter()` vì đang sửa nó (T50 có nhắc).

6. **`docs/architecture.md`** (coder sửa; `docs/design/multiplayer.md` đã xong):
   - Mục `rooms/GameRoom.ts`, sau gạch "Kết nối lại", thêm gạch **Giữ thế giới trống (T49)** tóm tắt Thiết kế 3: `autoDispose = false`, `emptyHold`/`emptyHoldMs`, `holdEmptyWorld` ở `onCreate` và ở `onLeave` khi `players` rỗng, `keepWorldOpen` ở `onJoin`, hết giữ thì `autoDispose = true` (Colyseus đóng sau ≤ 1 s, chờ người vào dở), mô phỏng vẫn chạy (hẹn giờ của phòng theo nhịp mô phỏng).
   - Danh sách hook `debug:*`: thêm `emptyHold` (`{ ms }`, chỉ rút ngắn khoảng giữ của phòng người gửi).
   - Mục `main.ts`, đoạn **Vào lại thế giới (T23)**: luôn ghi `?room=` (T49), `rememberWorld`, `FRIENDS_KEY`, `arrival`/`arrivalHint`, vào thẳng thế giới mới khi `backAlone` gặp "closed".
   - Mục Kiểm thử, helper e2e: thêm `closedWorld`.

## Giao thức

- `schema.ts`, `messages.ts`: **không đổi**. `debug:emptyHold` là tin thử nghiệm dạng chuỗi, chỉ có khi `PETGAME_DEBUG=1`, như các hook khác.
- `Profile`/`store.ts`: **không đổi**, hồ sơ cũ đọc như cũ.
- Hành vi mạng đổi theo hướng có thể đảo ngược: thế giới sống thêm 60 s sau người cuối. Client cũ (tab mở từ trước khi deploy) vẫn chạy đúng: nó chỉ không ghi `room` khi một mình, như T23.
- Client: thêm khoá `sessionStorage` `petgame:friends` (chỉ trong tab, không ảnh hưởng dữ liệu lưu).

Không có gì CHẶN.

## Test

### Unit (Vitest)

`packages/client/src/ui/joinStatus.test.ts`, describe mới `arrival`:
- không có `?room=` thì `"new"` (dù `lastRoom` có giá trị);
- `?room=X` mà `lastRoom` khác hoặc `null` thì `"invited"`;
- `X` = `lastRoom` và `"0"` thì `"backAlone"`;
- `"1"` thì `"back"`;
- `null`/`undefined` (tab trước T49) thì `"back"`;
- `arrivalHint`: `"back"` cho `RETURN_HINT`, `"invited"` cho `INVITE_HINT`, `"backAlone"` và `"new"` cho "".

`packages/client/src/net/connection.test.ts`: sửa mô tả các test `lobbyUrl` theo nghĩa mới của tham số (`keepWorld`). Kỳ vọng giữ nguyên.

### Tích hợp server (`GameRoom.test.ts`)

Describe mới `"keeping an empty world open"`, đặt sau describe kết nối lại. Dùng hold ngắn `(room as any).emptyHoldMs = 400` (không dùng fake timer: Colyseus dùng `setTimeout`/`setInterval` thật cho socket và hẹn giờ tự đóng). Helper trong describe:
- `isOpen(room)`: `colyseus.getRoomById(room.roomId) !== undefined`;
- `emptyHoldOf(room)`: `(room as any).emptyHold`.

Mọi chờ đều qua `vi.waitFor(..., { timeout: 4000 })`. Các test:

1. **"keeps a world nobody is in open for the hold, still running; whoever comes back in time finds it, then it closes once the hold runs out"**
   - `setup(token)` với `SqliteStore(":memory:")` + `useStore`; `emptyHoldMs = 400`; cho người chơi một thú (`capture`).
   - `client.leave()`, chờ `players.size === 0`. Kiểm:
     - `emptyHoldOf(room)?.active === true`;
     - `isOpen(room)`;
     - `(room as any).dayTime` tăng sau `ticks(room, 5)` (thế giới vẫn chạy).
   - Trong lúc giữ, `colyseus.sdk.joinById(room.roomId, { name: "Back", token })` vào được. Kiểm:
     - cùng phòng;
     - `emptyHoldOf(room)` là `undefined`;
     - `room.autoDispose === false`;
     - người chơi có lại 1 thú (đọc từ hồ sơ đã lưu).
   - Chờ 800 ms (gấp đôi hold): phòng **vẫn mở** vì có người.
   - Rời lần nữa, rồi `vi.waitFor(() => expect(isOpen(room)).toBe(false))`.
   - `colyseus.sdk.joinById(room.roomId, {})` bị từ chối với `code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID` và `message` không chứa `"is locked"` (đúng dạng lỗi `joinFailure` xếp là "closed"). Import `ErrorCode` từ `"colyseus"`.

2. **"the hold starts only when a dropped player's grace has run out"**
   - `crowd(1)` hoặc `setup()`; `reconnectGraceMs = 500`; `emptyHoldMs = 400`; `client.reconnection.enabled = false`; `cutConnection`.
   - Trong lúc chờ nối lại (`player.offline`): `emptyHoldOf(room)` là `undefined`, `room.autoDispose === false`.
   - Chờ người chơi bị xoá: ngay lúc đó `emptyHoldOf(room)?.active === true` và `isOpen(room)`.
   - Sau đó phòng đóng.

3. **"a world made but never joined closes after the hold"**
   - `colyseus.createRoom(ROOM_NAME)`. Kiểm `emptyHoldOf(room)?.active === true` và `emptyHoldOf(room).time === EMPTY_WORLD_HOLD_MS`.
   - Đặt `emptyHoldMs = 300`, gọi lại `(room as any).holdEmptyWorld()` (đồng thời kiểm việc hẹn lại huỷ hẹn cũ: sau lời gọi chỉ còn một hẹn với `time === 300`).
   - Phòng đóng trong `vi.waitFor`.

4. **"saves a player once as they leave and not again while the world is empty; the next session reads it"**
   - `SqliteStore(":memory:")` + `useStore`, `setup(token)`.
   - Đặt `player.wood = 33` và gửi `ClientMessage.PalAuto { on: false }` (hẹn một `scheduleSave` 2 s).
   - `client.leave()`, chờ `players.size === 0`. `db.load(token)?.resources.wood === 33`.
   - Sau đó `const save = vi.spyOn(db, "save")`, chờ thật 2,3 s (quá `SAVE_DELAY_MS`; `emptyHoldMs` mặc định 60 s nên phòng còn mở). `expect(save).not.toHaveBeenCalled()`.
   - Vào lại cùng token: `wood === 33`.
   - Đặt hạn riêng cho test này (khoảng 8 s, ghi số đo trong chú thích) như các test chờ thật khác.

5. **"the test hook shortens the hold of the sender's world, never lengthens it"**
   - `process.env.PETGAME_DEBUG = "1"` trong `try/finally`, như test `debug:endGrace`.
   - Gửi `debug:emptyHold { ms: 10 ** 9 }`, chờ một nhịp: `emptyHoldMs === EMPTY_WORLD_HOLD_MS`.
   - Gửi `{ ms: "x" }`: không đổi.
   - Gửi `{ ms: 0 }`: `emptyHoldMs === 0`.
   - `client.leave()`: phòng đóng trong `vi.waitFor({ timeout: 3000 })`.

Các test có sẵn phải qua mà không sửa. Đặc biệt:
- "closing the world saves everyone…" (`disconnect(SERVER_SHUTDOWN)` vẫn đóng ngay);
- "a player who leaves on purpose is gone at once";
- các test `client.leave()` + `colyseus.cleanup()`.

### E2E (`tests/e2e/multiplayer.spec.ts`)

**Helper mới `closedWorld(roomId)`** (đặt cạnh `observer`):
- Chờ đến khi `new Client(SERVER).joinById(roomId, { name: "Probe" })` bị từ chối với `code === 522` và message không có "is locked".
- Vào được thì `leave()` ngay rồi thử lại. Thế giới đã đặt hold 0 thì tự đóng lại khoảng 1 s sau.
- Dùng `expect.poll` với `intervals: [1500]` (lớn hơn 1,05 s đóng, để lần dò không giữ thế giới mở mãi), `timeout: 20_000`.
- JSDoc nói phải gửi `debug:emptyHold { ms: 0 }` trước.

**Sửa "lobby: a reload goes back to the world friends are in; …"** (dòng 1666). Đổi tên thành "lobby: a reload goes back to the world; a closed world or an unreachable server says so, with a way on".
- Dòng 1675-1676: một mình thì địa chỉ **có** `room` = `roomId` (`expect.poll`). Sửa chú thích.
- Dòng 1692-1694: bạn rời đi thì địa chỉ **vẫn** là `roomId`.
- Dòng 1696-1702:
  - `friend2` gửi `friend2.send("debug:emptyHold", { ms: 0 })` trước `friend2.leave()`;
  - sau đó `await closedWorld(roomId)` trước `page.goto(back)`;
  - thẻ vẫn là "Thế giới này đã đóng" + "vẫn còn" (lúc trang rời có `friend2`, nên `petgame:friends` là `"1"`).
- Phần 2 (dòng 1711-1713): `gone.send("debug:emptyHold", { ms: 0 })`, rồi `gone.leave()`, rồi `await closedWorld(closedId)`. Phần còn lại không đổi.

**Sửa test T42** (dòng 1869-1884), phần 2, điện thoại dọc, chạm, một mình:
- Sau thẻ "Không tải được game", địa chỉ **có** `room === oldRoom`. Sửa dòng 1879 và chú thích dòng 1869.
- Bấm Tải lại, `enterLobby`, `waitForWorld`: `roomOf(phone)` **bằng** `oldRoom` (thế giới còn được giữ).
- Đây là e2e "một mình tải lại về đúng thế giới" bằng cảm ứng.

**Test mới** "lobby: alone, a reload comes back to the same world while it is kept; once it has closed, a new one opens without a card" (desktop, bàn phím, `test.slow()`):
1. `join(browser, "Solo")`, `waitForWorld`, chờ `frames > 0`. Kiểm địa chỉ có `room = W` (`expect.poll`) và `quality=low` còn.
2. `page.reload()`. Kiểm:
   - `#room-hint` có chữ rỗng (`toHaveText("")`);
   - `#join-btn:enabled` rồi `toBeFocused()`;
   - Enter, `waitForWorld`;
   - `roomId === W`, `playerCount === 1`.
3. `sendFrom(page, "debug:emptyHold", { ms: 0 })`, `const back = page.url()`, `page.goto("about:blank")`, `await closedWorld(W)`.
4. `page.goto(back)`. Kiểm:
   - `#room-hint` rỗng;
   - `enterLobby(page, "Solo")` rồi `waitForWorld(page)` (`waitForWorld` báo lỗi ngay nếu `#join-status` hiện, tức là không có thẻ);
   - `roomId !== W`;
   - địa chỉ có `room` = thế giới mới, `quality=low` còn.
5. Đếm `load` của trang: đúng 3 lần (mở, tải lại, `goto(back)`). Lần vào thẳng thế giới mới không tải lại trang.

## Tiêu chí hoàn thành

- [ ] `EMPTY_WORLD_HOLD_MS = 60_000` ở `packages/shared/src/constants.ts`, có JSDoc kèm lý do. Trong code server và client không có số 60 000 hay 60 nào khác cho việc này.
- [ ] `GameRoom`:
  - `autoDispose = false`;
  - `holdEmptyWorld` gọi ở cuối `onCreate`, và ở `onLeave` khi `state.players.size === 0`;
  - `keepWorldOpen` ở đầu `onJoin`;
  - hết giữ chỉ đặt `autoDispose = true` (không `disconnect()`);
  - mọi hẹn giờ bằng `this.clock.setTimeout`;
  - mô phỏng không bị dừng.
- [ ] Người chờ nối lại vẫn tính là "có người": khoảng giữ chỉ bắt đầu sau khi chờ nối lại kết thúc (test 2).
- [ ] Không có lần lưu nào trong lúc thế giới trống; người vào lại đọc đúng tiến trình đã lưu lúc rời (test 4).
- [ ] `debug:emptyHold` chỉ có khi `PETGAME_DEBUG=1`, chỉ rút ngắn, chỉ cho phòng người gửi.
- [ ] Client:
  - địa chỉ có `?room=` khi đang chơi một mình;
  - bỏ `room` khi server khởi động lại;
  - `petgame:friends` được ghi;
  - quay lại một mình thì sảnh không có chữ gợi ý, nút có focus;
  - thế giới đã đóng thì vào thẳng thế giới mới, không có thẻ, không tải lại trang;
  - quay lại thế giới có bạn bè đã đóng thì vẫn thẻ T23.
- [ ] `failToStart` luôn ghi `room`, `ROOM_KEY`, `FRIENDS_KEY`.
- [ ] `schema.ts`, `messages.ts`, `Profile` không đổi.
- [ ] Test unit, tích hợp và e2e ở mục Test đã thêm hoặc sửa. Không test nào bị tắt hay nới.
- [ ] Các lệnh `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` đều sạch.
- [ ] `docs/architecture.md` cập nhật theo bước 6. `docs/design/multiplayer.md` khớp với hành vi đã làm (coder đọc lại; lệch thì báo, không tự đổi luật).

## Rủi ro, câu hỏi mở

- **Dựa vào hành vi của Colyseus 0.18.18:** setter `autoDispose` gọi `resetAutoDisposeTimeout()` 1 s, và `#_disposeIfEmpty` chờ chỗ giữ. Nâng Colyseus có thể đổi điều này. Test 1, 3 và 5 sẽ bắt được (phòng không đóng, hoặc đóng sớm).
- **Thời gian trong test:** dùng hold 300-400 ms và chờ bằng `vi.waitFor` tới 4 s. Riêng test 4 chờ thật 2,3 s nên có hạn riêng. Máy CI chậm (làm nóng phòng 1,6 s) vẫn dư.
- **E2E:** server e2e dùng chung cho mọi test. Thế giới trống của các test trước giờ sống thêm 60 s: với khoảng 20 thế giới cùng lúc là 2,6% CPU, chấp nhận được. Không đặt hold ngắn cho cả server e2e, vì test tải lại một mình cần hold thật.
- **Link mời của người chơi một mình chết lặng lẽ sau 60 s:** đã chấp nhận và ghi ở `docs/design/multiplayer.md`, "Đã cân nhắc".
- **Tạo thế giới rồi bỏ đi giờ sống 60 s** (trước: 15 s nếu chưa ai vào, 0 s nếu đã vào rồi rời). Chi phí nhỏ. Nếu sau này cần giới hạn số thế giới mỗi IP thì là việc riêng; chưa đề xuất thêm vào `TASKS.md`.
- **Listing:** thế giới trống vẫn công khai trong matchmaker. Hiện vô hại vì client không vào theo tên. Ai thêm ghép ngẫu nhiên (`joinOrCreate`) thì phải loại thế giới trống. Coder thêm một dòng chú thích tại `autoDispose = false` để nhắc.
- Không có câu hỏi CHẶN.
