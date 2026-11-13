# PLAN: T65 Dọn sau T49

Đọc code ở HEAD `2c0418b`. Nguồn: mục "Góp ý không bắt buộc" trong `REVIEW.md` của commit T49 (`git show 471ea0d:REVIEW.md`). File liên quan:
- `packages/server/src/rooms/GameRoom.ts`: `onLeave` dòng 629-632, `removePlayer` 644-660, `endSession` 667-672, `holdEmptyWorld` 675-678, `keepWorldOpen` 681-685, `closeIfStillEmpty` 691-695, trường `holds` 299.
- `packages/server/src/rooms/GameRoom.test.ts`: `describe("keeping an empty world open")` dòng 2875-2993 (test 1 ở 2879-2912); `holdsOf` 2487 và `cutConnection` 2454 nằm trong `describe("reconnecting after a dropped connection")`; test "closing the world saves everyone…" 2842-2872 (mẫu bắt `unhandledRejection`).
- `packages/client/src/ui/joinStatus.ts`: `RETURN_HINT`, `INVITE_HINT`, `Arrival`, `arrival()` dòng 17-21, `arrivalHint()`.
- `packages/client/src/ui/joinStatus.test.ts`: `describe("arrival")` dòng 8-36.
- `packages/client/src/main.ts`: khoá `ROOM_KEY`/`FRIENDS_KEY` 31-34, `invited`/`arrived`/`returning`/`quietRetry` 66-72, `rememberWorld` 79-84, `dropWorldFromAddress` 87-91, `enter` 128-181, `readJson` 245-247, `safeStorage` 259-265.
- `tests/e2e/multiplayer.spec.ts`: test "lobby: a reload goes back…" 1666-1755, test "lobby: alone, a reload…" 1757-1794, `openWithSwitch` 2016-2058, `observer` 2064, `closedWorld` 2075-2090, test "connection: when the world has let the player go…" 2202-2269.
- `docs/architecture.md` dòng 59 (Giữ thế giới trống), 66 (`main.ts`, T23), 98 (helper e2e).

## Mục tiêu

Năm việc dọn sau T49, không đổi luật chơi:
1. **Thế giới không bị treo mãi khi có lỗi lúc người chơi rời đi.** Lỗi đó cũng không được làm sập cả server (xem phân tích ở Thiết kế 1).
2. **Test server 1** chứng minh thật rằng người vào lại kịp trong khoảng giữ, kể cả trên máy chậm.
3. **E2E cho mục tiêu 3 của T49:** chơi một mình, rớt mạng, bấm **Về sảnh**, về đúng thế giới cũ.
4. **`closedWorld` trong e2e không chập chờn** khi tin rời phòng lúc `pagehide` bị mất.
5. **Người chơi mở địa chỉ thế giới của chính mình ở tab mới** (dấu trang, dán lại) không bị coi là người được mời nữa.

## Phạm vi

Làm:
- `GameRoom.onLeave` bắt lỗi của `removePlayer` và luôn kiểm "trống"; một hàm `isEmpty()` dùng chung cho `onLeave` và `closeIfStillEmpty`.
- Sửa test server 1; thêm 2 test server cho đường lỗi.
- Một e2e mới, thêm bước vào 2 e2e `lobby:` có sẵn, nâng `closedWorld` lên 30 s.
- Client: danh sách "thế giới đã vào gần đây" trong `localStorage`; `arrival()` dùng thêm danh sách đó.
- Cập nhật `docs/architecture.md` (coder). `docs/design/multiplayer.md` đã được game-designer cập nhật.

KHÔNG làm:
- Không đổi schema, message, `Profile`, store hay HTTP: không đổi giao thức.
- Không đổi chữ của `RETURN_HINT`, `INVITE_HINT` hay của thẻ (`joinCard`).
- Không đổi `EMPTY_WORLD_HOLD_MS`, `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS` hay luật giữ thế giới.
- Không sửa `removePlayer`. Không dọn "người chơi ma" sót lại khi `removePlayer` ném lỗi: đó là đường chỉ có khi có bug, chỉ cần thế giới vẫn đóng và lỗi được ghi log.
- Không đụng `worldLimits.ts` (T67, T68 riêng).
- Không làm PWA mở lại thế giới cũ.

## Thiết kế

### 1. `onLeave` chịu được lỗi của `removePlayer`

Hiện tại `onLeave` gọi `removePlayer` rồi `if (players.size === 0) holdEmptyWorld()`. Nếu `removePlayer` ném lỗi (chỉ khi có bug: `saveNow` đã tự bắt lỗi của store, nên lỗi phải đến từ `despawnCompanion`, `calmPalsTargeting`…):

- **Đường rời chủ động** (`CloseCode.CONSENTED`): Colyseus `_onLeave` bọc `onLeave` trong try/catch nên chỉ ghi log. Nhưng hẹn giờ giữ không chạy, `autoDispose` vẫn tắt, nên phòng chạy 20 nhịp/giây mãi và chiếm 1 chỗ của trần 50 (T64) mãi.
- **Đường rớt mạng rồi hết chờ** (nặng hơn REVIEW của T49 nói): Colyseus 0.18 gọi `onLeave` ở `#_onAfterLeave`, bên trong `this._reconnections[token][1].catch(async () => …)`, **không có try/catch**. Lỗi thành promise bị từ chối mà không ai bắt. Node 22 biến nó thành `uncaughtException`, và handler `registerGracefulShutdown` của Colyseus (`@colyseus/core/build/utils/Utils.mjs` dòng 25) **tắt cả server**. `#_decrementClientCount` cũng bị bỏ qua.

Quyết định:
- `onLeave` dùng `try { this.removePlayer(sessionId) } catch (err) { console.error(...) }`, **bắt và ghi log, không ném lại**. Đặt `holdEmptyWorld` trong `finally` mà vẫn ném lại thì đường rớt mạng vẫn làm sập server. Câu log tiếng Anh, có `roomId` và `sessionId`, kèm `err`.
  - Ví dụ: `` `GameRoom ${this.roomId}: removing player ${sessionId} failed; the world is still held and will close` ``.
- Sau try/catch, luôn chạy hai việc:
  - `this.holds.delete(sessionId)`: `onLeave` nghĩa là phiên đã ra hẳn, nên chỗ giữ của nó (nếu có) đã hết. Nếu `removePlayer` ném trước dòng `holds.delete`, phải xoá ở đây thì mới tính được "trống".
  - `if (this.isEmpty()) this.holdEmptyWorld()`.
- Hàm mới `private isEmpty(): boolean` trả về `this.clients.length === 0 && this.holds.size === 0`. JSDoc: không còn ai kết nối và không ai đang được chờ nối lại. Không dựa vào `players`, vì một người chơi sót lại do lỗi không được giữ thế giới mở mãi.
- `closeIfStillEmpty` đổi `if (this.state.players.size > 0) return;` thành `if (!this.isEmpty()) return;`.
- Đường bình thường không đổi hành vi. Ở `onLeave`, client đã bị Colyseus xoá khỏi `clients` (`_onLeave` gọi `this.clients.delete(client)` trước). Người rớt mạng nằm trong `holds` suốt lúc chờ. `onJoin` chạy đồng bộ sau `clients.push`. Vì vậy hai điều kiện ("`players` rỗng" và `isEmpty()`) trùng nhau, trừ đúng trường hợp có người chơi ma.
- Cập nhật JSDoc của `onLeave` và `closeIfStillEmpty` cho đúng.

### 2. Test server 1 (giữ 400 ms → 1000 ms)

Từ lúc rời đến lúc vào lại mất khoảng 350 ms (chờ, 5 nhịp, `joinById`). Với 400 ms, test vẫn qua trên máy chậm nhờ Colyseus đóng trễ 1 s, nên chưa chứng minh được gì. Sửa:
- `emptyHoldMs = 1000`: dư khoảng 3 lần thời gian vào lại.
- Đặt spy gọi xuyên `const closes = vi.spyOn(room as any, "closeIfStillEmpty")` trước `client.leave()`. Hẹn giờ gọi `this.closeIfStillEmpty()` qua arrow function, nên spy trên instance bắt được.
- Ngay trước `joinById`: `expect(emptyHoldOf(room)?.active).toBe(true)` và `expect(room.autoDispose).toBe(false)`, tức là khoảng giữ chưa hết khi bắt đầu vào lại.
- Sau khi vào lại, chờ thật **1200 ms** (dài hơn khoảng giữ; thay cho 800 ms "twice the hold"). Rồi `expect(closes).not.toHaveBeenCalled()`: hẹn giờ đã bị huỷ khi có người vào, chứ không phải đã hết. Vẫn kiểm `isOpen(room)` và `room.autoDispose === false`.
- Sau `back.leave()`, `waitFor` đóng phòng nâng `timeout` từ 4000 lên **5000** (1000 giữ + tối đa 1 s Colyseus + dư), rồi `expect(closes).toHaveBeenCalledTimes(1)`.
- Test dài thêm khoảng 1,6 s, chấp nhận được.

### 3. E2E: một mình, rớt mạng, Về sảnh, về đúng thế giới cũ

Test mới, đặt ngay sau test "connection: when the world has let the player go…". Đi bằng **bàn phím trên desktop**: test có sẵn đã đi bằng cảm ứng trên điện thoại dọc. Không cần một người khác ở trong thế giới lúc mất mạng: trang không bao giờ thấy ai khác, nên tab ghi `petgame:friends = "0"`. Việc kết thúc khoảng chờ cần một người gửi `debug:endGrace`, nên một observer vào **sau khi** mất mạng (trang không thấy nó), gửi hook rồi rời đi. Từ lúc đó thế giới trống và được giữ đủ 60 s. Đây đúng là đường T49 cần chứng minh.

### 4. `closedWorld` chờ 30 s

Nếu tin rời phòng lúc `pagehide` bị mất, server coi như rớt mạng: chờ nối lại 20 s (`RECONNECT_GRACE_MS`), rồi khoảng giữ 0 ms, rồi Colyseus đóng trong khoảng 1 s. Cộng một nhịp dò 1,5 s và thời gian của chính lần dò, tổng khoảng 23 s, quá 20 s. Nâng `timeout` lên **30_000**: dư khoảng 7 s, và dưới timeout của test nhiều bậc. Ghi lý do vào JSDoc của `closedWorld`.

### 5. Nhận ra thế giới của chính mình ở tab mới

Luật đầy đủ, chữ hiển thị và lý do: `docs/design/multiplayer.md`, mục "Dấu trang, địa chỉ dán sang tab mới (T65)" (đã cập nhật). Tóm tắt:

**Chọn cách nào.** Có hai cách:
- **Theo token trên server: không chọn.** Server không nhớ thế giới đã đóng, nên phải thêm bảng lưu hoặc bộ nhớ riêng, thêm một lần hỏi server trước khi sảnh sẵn sàng hoặc đổi giao thức báo lỗi khi vào. Cách này cũng không biết thêm gì so với `localStorage`: token chính nó nằm trong `localStorage`, mất cái này là mất cả hai.
- **`localStorage` của thiết bị: chọn.** Không đổi giao thức, chỉ đụng client. Danh sách chỉ đổi chữ trên sảnh và cách báo khi thế giới đã đóng, không cho ai vào được đâu thêm, nên không có gì để gian lận.

**Dữ liệu.** Khoá `localStorage` `petgame:worlds` chứa JSON `[{ "room": "<roomId>", "friends": true|false }, ...]`, mới nhất đứng đầu, tối đa `RECENT_WORLDS_MAX = 20` phần tử, không trùng `room`. Vì sao 20 (chi tiết trong multiplayer.md):
- Khoảng 20 buổi chơi một mình (mỗi buổi sau hơn 60 s là một thế giới mới).
- Dưới 1 kB.
- Dùng một thế giới thì đưa nó lên đầu, nên một dấu trang dùng thường xuyên không bao giờ bị quên.

**Luật `arrival`** (thứ tự kiểm):
1. Không có `?room=` thì là `new`.
2. Trí nhớ của tab (`sessionStorage`) có đúng thế giới đó thì giữ luật cũ: `backAlone` nếu `petgame:friends` là `"0"`, còn lại `back`.
3. Danh sách của thiết bị có thế giới đó thì là `back` nếu `friends`, không thì `backAlone`.
4. Còn lại là `invited`.

Mọi thứ sau `arrival` giữ nguyên: `returning`, `quietRetry`, `arrivalHint`, `joinCard(…, returning)`, focus nút "Vào chơi". Kết quả:
- Một mình: sảnh không ghi gì. Thế giới đã đóng thì vào thẳng thế giới mới, không thẻ.
- Có bạn bè: "Quay lại thế giới bạn đang chơi cùng bạn bè". Thế giới đã đóng thì thẻ "Thế giới này đã đóng" kèm dòng "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn."
- Không có trong danh sách: như cũ ("Bạn được mời…").

**Ghi:**
- `rememberWorld(roomId, friends)` ghi thêm vào danh sách. Hàm này chỉ chạy lúc vào, khi trạng thái "có bạn bè hay không" đổi, và trong `failToStart`, nên không bao giờ ghi theo khung hình.
- Lúc mở trang, nếu `returning` thì đưa thế giới của địa chỉ lên đầu danh sách, giữ cờ: `back` → `friends: true`, `backAlone` → `friends: false`.
- Không xoá khỏi danh sách khi biết thế giới đã đóng: id không bao giờ dùng lại, và chính dấu trang của thế giới đã đóng là trường hợp cần nhận ra.

**Trải nghiệm:** không thêm nút hay chữ mới, nên không có gì mới về cảm ứng hay kích thước nút. Bàn phím: khi `returning`, nút "Vào chơi" có sẵn focus như khi tải lại, Enter là vào.

## Kế hoạch triển khai

Thứ tự là thứ tự làm. Bước 1-2 (server) và bước 3-5 (client) độc lập với nhau.

1. **`packages/server/src/rooms/GameRoom.ts`**
   - `onLeave(client)`:
     - `const sessionId = client.sessionId;`
     - `try { this.removePlayer(sessionId); } catch (err) { console.error(<câu log ở Thiết kế 1>, err); }`
     - `this.holds.delete(sessionId);`
     - `if (this.isEmpty()) this.holdEmptyWorld();`
     - JSDoc: thêm rằng lỗi ở đây được bắt (Colyseus gọi `onLeave` của người hết chờ ngoài try/catch, ném ra là sập server), và thế giới vẫn được giữ rồi đóng.
   - Thêm `private isEmpty(): boolean` (đặt cạnh `holdEmptyWorld`), có JSDoc như Thiết kế 1.
   - `closeIfStillEmpty`: `if (!this.isEmpty()) return;`. Sửa JSDoc nếu nhắc tới `players`.
2. **`packages/server/src/rooms/GameRoom.test.ts`**, trong `describe("keeping an empty world open")`:
   - Sửa test 1 đúng như Thiết kế 2.
   - Thêm `holdsOf` cục bộ (hoặc chuyển `holdsOf`/`cutConnection` lên mức file và dùng chung; chọn cách gọn hơn, không đổi hành vi test cũ).
   - Thêm 2 test (mục Test, S2 và S3).
3. **`packages/client/src/ui/joinStatus.ts`**
   - `export interface RecentWorld { room: string; friends: boolean }`.
   - `export const RECENT_WORLDS_MAX = 20;` JSDoc nói vì sao (Thiết kế 5).
   - `export function recentWorlds(raw: unknown): RecentWorld[]`:
     - Đọc an toàn giá trị lấy từ `localStorage`, **không bao giờ ném lỗi** với mọi giá trị JSON.
     - Không phải mảng thì trả về `[]`.
     - Giữ phần tử là object khác null, có `room` là chuỗi dài 1-64, có `friends` là boolean. Chỉ chép hai trường đó (bỏ trường lạ).
     - Bỏ `room` trùng, giữ lần đầu. Cắt còn `RECENT_WORLDS_MAX`.
   - `export function withRecentWorld(list: readonly RecentWorld[], room: string, friends: boolean): RecentWorld[]`: trả về mảng mới `[{ room, friends }, ...list không có room đó]` cắt còn `RECENT_WORLDS_MAX`. Không sửa `list`.
   - `arrival(invited, lastRoom, lastFriends, recent: readonly RecentWorld[] = [])`:
     - Thứ tự kiểm như Thiết kế 5.
     - Tham số mặc định `[]` nên các lời gọi cũ trong test vẫn đúng.
     - Cập nhật JSDoc của `arrival` và `Arrival`: "back" giờ là "tab này hoặc thiết bị này đã ở thế giới đó".
4. **`packages/client/src/main.ts`**
   - Thêm hằng `RECENT_WORLDS_KEY = "petgame:worlds"` cạnh `FRIENDS_KEY`, JSDoc: localStorage, các thế giới thiết bị này đã vào gần đây, mới nhất đầu tiên, kèm cờ có bạn bè lần cuối; dùng để phân biệt dấu trang hay địa chỉ dán sang tab mới của chính mình với link mời.
   - Thêm `function noteRecentWorld(roomId: string, friends: boolean)`:
     - `safeStorage(() => localStorage.setItem(RECENT_WORLDS_KEY, JSON.stringify(withRecentWorld(recentWorlds(readJson(RECENT_WORLDS_KEY)), roomId, friends))))`.
     - Đọc lại mỗi lần ghi, vì tab khác có thể vừa ghi.
   - Dòng 66-72:
     - `const arrived = arrival(invited, …sessionStorage…, …, recentWorlds(readJson(RECENT_WORLDS_KEY)))`.
     - Sau `returning`: `if (returning && invited) noteRecentWorld(invited, arrived === "back");`.
     - Đoạn này chạy trước khi sảnh mở khoá: mọi lần đọc/ghi phải qua `safeStorage`/`readJson`, không được ném lỗi.
     - `readJson` được khai báo bằng `function` nên hoist; dùng trước chỗ khai báo vẫn được.
     - Sửa chú thích dòng 66 cho đúng luật mới.
   - `rememberWorld`: gọi thêm `noteRecentWorld(roomId, friends)`.
5. **`packages/client/src/ui/joinStatus.test.ts`**: thêm test unit (mục Test, U1-U4).
6. **`tests/e2e/multiplayer.spec.ts`**
   - `closedWorld`: `timeout: 30_000`; JSDoc thêm lý do (20 s chờ nối lại nếu tin `pagehide` bị mất, cộng đóng phòng và nhịp dò).
   - Test mới E1, bước thêm E2 và E3 (mục Test).
7. **`docs/architecture.md`**
   - Dòng 59: `holdEmptyWorld()` gọi ở `onLeave` khi `isEmpty()` (`clients` rỗng và `holds` rỗng). `onLeave` bắt lỗi của `removePlayer` (lý do: sập server qua `#_onAfterLeave`). `closeIfStillEmpty` dùng `isEmpty()`.
   - Dòng 66: thêm `localStorage` `petgame:worlds` (`recentWorlds`, `withRecentWorld`, `RECENT_WORLDS_MAX` = 20, `ui/joinStatus.ts`), chữ ký mới của `arrival`, và việc đưa lên đầu danh sách khi `returning`.
   - Dòng 98: `closedWorld` chờ tối đa 30 s.
8. Ghi `PROGRESS.md`.

## Giao thức

- **Không đổi** `schema.ts`, `messages.ts`, `Profile`/`store.ts`, HTTP hay matchmaking. Server và client cũ/mới vẫn nói chuyện được với nhau.
- Thêm một khoá **chỉ ở client**: `localStorage` `petgame:worlds`.
  - Không có khoá, hay khoá hỏng: `recentWorlds` trả về `[]`, tức hành vi trước T65.
  - Thiết bị cũ chưa có danh sách: lần đầu mở dấu trang sau khi cập nhật vẫn có thể thấy "được mời" một lần. Từ lần vào đó trở đi thế giới đã được ghi.
- Không có gì không đảo ngược được, nên không có dòng CHẶN.

## Test

**Server tích hợp** (`GameRoom.test.ts`, `describe("keeping an empty world open")`):
- **S1** (sửa test 1): như Thiết kế 2.
- **S2.** Tên: "a leave that fails half-way is logged, and the world is still held and closes".
  - Chuẩn bị: `setup()`; `emptyHoldMs = 300`; `const errors = vi.spyOn(console, "error").mockImplementation(() => {})`; `vi.spyOn(room as any, "removePlayer").mockImplementation(() => { throw new Error("boom"); })`.
  - `await client.leave()`. Chờ `emptyHoldOf(room)?.active === true`.
  - Kiểm:
    - Người chơi ma vẫn còn: `room.state.players.size === 1`. Điều này chứng minh "trống" không dựa vào `players`.
    - `errors` được gọi đúng 1 lần, có chuỗi chứa `room.roomId`.
    - Phòng đóng (`waitFor isOpen === false`, timeout 4000).
- **S3.** Tên: "a dropped player whose grace runs out while leaving fails does not take the server down; the world still closes".
  - Chuẩn bị:
    - `setup()`; `reconnectGraceMs = 300`; `emptyHoldMs = 300`; `client.reconnection.enabled = false`.
    - Spy `console.error` và `removePlayer` ném lỗi như S2.
    - Đăng ký `process.on("unhandledRejection", note)` theo mẫu test "closing the world saves everyone…", gỡ trong `finally`.
  - Cắt socket bằng `ref.terminate()`. Chờ `player.offline === true`. Chờ `holdsOf(room).size === 0` và `emptyHoldOf(room)?.active === true`.
  - Kiểm: phòng đóng (timeout 4000); sau 100 ms `stray` vẫn là `[]`; `errors` được gọi.
  - Trước khi sửa code, test này phải đỏ: có `unhandledRejection`, hoặc phòng không đóng.
- `afterEach` đã có `vi.restoreAllMocks()` trước `colyseus.cleanup()`, nên lúc dọn, `removePlayer` đã về như cũ.

**Unit** (`joinStatus.test.ts`):
- **U1** `arrival` với danh sách:
  - `arrival("X", "Y", "1", [{room:"X",friends:false}])` → `backAlone`.
  - `…[{room:"X",friends:true}]` → `back`.
  - `arrival("X", null, null, [{room:"Z",friends:true}])` → `invited`.
  - Tab thắng danh sách: `arrival("X", "X", "0", [{room:"X",friends:true}])` → `backAlone`.
  - Không có `?room=` thì vẫn `new` dù danh sách có gì: `arrival(null, null, null, [{room:"X",friends:true}])` → `new`.
  - Các test cũ không sửa vẫn phải qua.
- **U2** `recentWorlds`:
  - `null`, `undefined`, `"x"`, `42`, `{}` → `[]`.
  - Lọc bỏ: `[null, 1, {room:""}, {room:"A"}, {room:"A",friends:"yes"}, {room:"a".repeat(65),friends:true}]` → `[]`.
  - Bỏ trường lạ: `[{room:"A",friends:true,extra:1}]` → `[{room:"A",friends:true}]`.
  - Trùng `room` thì giữ lần đầu.
  - 25 phần tử hợp lệ thì còn 20 phần tử đầu.
- **U3** `withRecentWorld`:
  - Thêm vào đầu.
  - `room` đã có thì chuyển lên đầu với cờ mới, không trùng.
  - Danh sách đầy 20 thì phần tử cũ nhất rơi ra, độ dài vẫn 20.
  - Không sửa mảng truyền vào (so với bản sao trước khi gọi).
- **U4** (một dòng): `RECENT_WORLDS_MAX === 20`.

**E2E** (`tests/e2e/multiplayer.spec.ts`):
- **E1.** Test mới, tên: "connection: alone, when the world has let the player go, Về sảnh takes them back to the same world, kept for them". Dùng `test.slow()`.
  - `openWithSwitch(browser, "Loner")` (desktop, mặc định); `enterLobby`; `waitForWorld`; chờ `frames > 0`. Lấy `roomId`, `sessionId`.
  - `sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 })`; chờ party có `leafkit`.
  - Địa chỉ đã có `room === roomId`.
  - `cut()`. `.net-title` chứa "Đang kết nối lại".
  - `const helper = await observer(roomId, "Helper")`. Helper vào **sau** khi cắt, nên trang không thấy.
    - Chờ `helper.state.players.get(sessionId)?.offline === true`.
    - `helper.send("debug:endGrace")`; chờ `!helper.state.players.has(sessionId)`.
    - `await helper.leave()`. Thế giới giờ trống và được giữ 60 s.
  - `restore()`.
    - `.net-title` có chữ "Không kết nối lại được" (timeout 15 s); `.net-lobby` có focus.
    - Địa chỉ có `room === roomId` (một mình vẫn giữ thế giới).
  - Bấm bằng bàn phím: `const loaded = page.waitForEvent("load"); await page.keyboard.press("Enter"); await loaded;`.
    - Địa chỉ mới có `room === roomId`, `quality === "low"`.
    - `#room-hint` có chữ `""` (một mình: không "Quay lại…", không "Bạn được mời…").
    - `#join-btn:enabled` rồi `#join-btn` có focus.
  - `page.keyboard.press("Enter")`; `waitForWorld`.
    - `roomId` vẫn như cũ; `playerCount(page) === 1`.
    - Party chứa `leafkit`.
- **E2.** Thêm vào cuối test "lobby: alone, a reload…" (sau `expect(loads).toBe(3)`, để không đổi số đếm). Gọi thế giới mới mà `page` đang ở là `world2`.
  - **Tab mới ở thế giới còn mở của mình** (chỉ xem sảnh, không vào):
    - `const tab = await page.context().newPage(); watch(tab, "Solo tab"); await tab.goto(`/?room=${world2}&quality=low`)`.
    - `#join-btn:enabled`; `#room-hint` có chữ `""` (trước T65 là "Bạn được mời…"); `#join-btn` có focus.
    - `await tab.close()`.
  - **Dấu trang của thế giới đã đóng** (tab mới, `sessionStorage` trống):
    - `await page.goto("about:blank")`, để vào từ tab mới không thay phiên của `page`.
    - `const bookmark = await page.context().newPage(); watch(…); await bookmark.goto(`/?room=${world}&quality=low`)`. `world` là thế giới đầu tiên, đã đóng ở bước trước.
    - `#room-hint` có chữ `""`.
    - `enterLobby(bookmark, "Solo")`; `waitForWorld(bookmark)`. Hàm này ném lỗi nếu hiện thẻ, nên chứng minh được "không thẻ".
    - `roomOf(bookmark) !== world`; chờ địa chỉ có `room === roomOf(bookmark)`.
- **E3.** Thêm vào Part 1 của test "lobby: a reload goes back…", sau dòng 1712 (`param(page, "room")` null).
  - Tab mới cùng context ở thế giới có bạn bè đã đóng: `const tab = await page.context().newPage(); watch(tab, "Back tab"); await tab.goto(`/?room=${roomId}&quality=low`)`.
  - `#room-hint` có chữ "Quay lại thế giới bạn đang chơi cùng bạn bè". Lần cuối trang thấy Friend2, nên cờ là có bạn bè.
  - `enterLobby(tab, "Back")`.
    - `#join-status` chứa "Thế giới này đã đóng" và "vẫn còn" (trước T65 là "link mời mới").
    - `#new-world-btn` có focus; `room` của địa chỉ là null.
  - Không vào thế giới. Part 2 (context điện thoại mới, thiết bị chưa từng vào) vẫn phải ra "Bạn được mời…" và "link mời mới": đó là kiểm tra hồi quy cho link mời thật, giữ nguyên.
- `closedWorld` 30 s: không có test riêng, các test đang dùng nó vẫn phải qua.

Lệnh:
- `npm run typecheck`.
- `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "keeping an empty world open"`.
- `npx vitest run packages/client/src/ui/joinStatus.test.ts`.
- `npm test`.
- `npx playwright test -g "lobby:"` và `npx playwright test -g "connection:"`.
- Cuối cùng `npm run test:e2e`.

## Tiêu chí hoàn thành

- [ ] `onLeave` bắt lỗi của `removePlayer`, ghi log `console.error` (có `roomId`), không ném lại. Sau đó luôn `holds.delete(sessionId)` rồi `if (isEmpty()) holdEmptyWorld()`.
- [ ] `isEmpty()` = `clients.length === 0 && holds.size === 0`, có JSDoc. `closeIfStillEmpty` dùng nó. `onLeave` và `closeIfStillEmpty` không còn nhìn `players.size`.
- [ ] S2 và S3 qua. S3 không có `unhandledRejection`. Đảo lại bản sửa ở bước 1 (bỏ try/catch) thì S3 đỏ (tester kiểm bằng đột biến).
- [ ] Test 1:
  - [ ] giữ 1000 ms;
  - [ ] kiểm `emptyHold` còn chạy và `autoDispose === false` ngay trước `joinById`;
  - [ ] `closeIfStillEmpty` không được gọi trong lúc có người, và được gọi đúng 1 lần sau khi rời lần hai.
- [ ] Mọi test cũ trong `describe("keeping an empty world open")` và `describe("reconnecting after a dropped connection")` vẫn qua, không nới timeout của chúng.
- [ ] `recentWorlds`, `withRecentWorld`, `RECENT_WORLDS_MAX`, `RecentWorld` có trong `ui/joinStatus.ts` với JSDoc. `arrival` nhận danh sách (mặc định `[]`) theo đúng thứ tự kiểm. U1-U4 qua, test cũ của `arrival` không sửa mà vẫn qua.
- [ ] `main.ts`:
  - [ ] đọc `petgame:worlds` qua `readJson`;
  - [ ] ghi qua `noteRecentWorld` trong `rememberWorld`, và lúc mở trang khi `returning`;
  - [ ] mọi truy cập storage qua `safeStorage`;
  - [ ] không ghi theo khung hình;
  - [ ] không gửi request nào mới trước khi sảnh sẵn sàng.
- [ ] E1, E2, E3 qua. Part 2 của "lobby: a reload…" vẫn ra "Bạn được mời…" và "link mời mới".
- [ ] `closedWorld` có `timeout: 30_000` và JSDoc nêu lý do.
- [ ] Không đổi `schema.ts`, `messages.ts`, `Profile`, `store.ts`, chữ của `joinCard`/hint.
- [ ] `docs/architecture.md` dòng 59, 66, 98 được cập nhật. `docs/design/multiplayer.md` khớp với hành vi đã làm.
- [ ] `npm run typecheck` sạch, `npm test` qua, `npm run test:e2e` qua.

## Rủi ro, câu hỏi mở

- **E1 dựa vào khoảng giữ 60 s thật.** Từ lúc helper rời đến lúc vào lại có các bước: màn "Không kết nối lại được" (tối đa 15 s), tải lại trang qua Vite, sảnh sẵn sàng, bấm Enter. Bình thường mất 10-25 s.
  - Nếu chậm hơn 60 s, test thấy `roomId` khác và báo đỏ rõ ràng, không qua nhầm.
  - Không rút ngắn khoảng giữ ở đây: `debug:emptyHold` chỉ rút ngắn, và test cần thế giới còn mở.
  - Nếu chập chờn trên CI thì có thể cho helper rời muộn hơn (ngay trước khi bấm Về sảnh). Thế giới vẫn trống lúc vào lại, nên vẫn chứng minh đúng điều cần.
- **E2 thêm một lần tải thế giới** (WebGL vẽ bằng phần mềm), khoảng 10-30 s. Test đã có `test.slow()` (540 s).
- **Nhiều tab ghi danh sách cùng lúc** có thể mất một lần ghi: mỗi lần ghi đọc lại rồi ghi đè. Hậu quả tối đa là một thế giới bị coi là link mời, tức hành vi trước T65. Chấp nhận.
- **Người chơi ma khi `removePlayer` lỗi** vẫn hiện với ai vào lại trong khoảng giữ, cho đến khi thế giới đóng. Đây là đường chỉ có khi có bug, đã có log. Không dọn thêm để khỏi lặp logic của `removePlayer`.
- Không có CHẶN.

Đề xuất tách nhiệm vụ: không cần. Năm việc nhỏ, một vòng coder, một commit. Nếu coder muốn chia commit: (a) server: bước 1-2; (b) client: bước 3-5 cùng E2, E3; (c) E1, `closedWorld`, `architecture.md`.
