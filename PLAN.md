# PLAN: T26 Dọn nhỏ sau T3

Code đọc ở `15500f7` ("Mark T25b done, extend T92 and T93, start T26"; mã T25b ở `7ef8b01`). Nguồn:
- dòng T26 trong `TASKS.md`; `REVIEW.md` của T3 (`80a70ea`, góp ý 3 và 5);
- server: `packages/server/src/systems/combat.ts` (`calmPalsTargeting`, `windUp`, `cancelWindup`, `strike`), `systems/movement.ts` (AI thú hoang: chỗ đặt `pal.windup = ""`), `systems/skills.ts` (`startCast`, `pal.windup = "skill"`), `rooms/GameRoom.ts` (`onDrop`, `shelter`, `onReconnect`, `onLeave`, `letGo`, `removePlayer`, `endSession`);
- client: `packages/client/src/main.ts` (`enter`, `startGame`, `react`, `comeBack`, `rememberWorld`), `net/connection.ts` (`inviteLink`, `lobbyUrl`), `net/reconnect.ts`, `net/seen.ts`, `game/Game.ts` (`init`, `watchConnection`, `frame`), `game/hudBridge.ts` (`build`), `ui/hud.ts` (`Hud.root`), `ui/connection.ts`, `game/stateSync.ts` (cách client vẽ `pal.windup`);
- `docs/design/multiplayer.md`, `docs/design/hud.md`, `docs/architecture.md`;
- `GameRoom.test.ts` (describe `reconnecting after a dropped connection`), `tests/e2e/reconnect.spec.ts`, `rejoin.spec.ts`, và `multiplayer.spec.ts` (chỉ đọc).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.**

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Test e2e mới nằm trong `tests/e2e/reconnect.spec.ts`. Không chạy `git stash`.

## Kiểm lại từng mục với code hiện tại

| # | Mục trong TASKS | Còn đúng? | Làm |
|---|---|---|---|
| 1 | `calmPalsTargeting` không xoá `pal.windup` | **Còn.** Hàm chỉ xoá `wildAggro`. Trạng thái gồng thật (`aggro.windupUntil`) mất theo nên đòn không bao giờ ra, nhưng `pal.windup` ("bite"/"stomp") ở lại. AI chỉ đặt lại nó khi thú không còn mục tiêu (`movement.ts`, nhánh không có target). Thú nhắm ngay người khác, hoặc đang choáng, bị trói, ở trong bóng, thì giữ tư thế gồng (và client vẽ cảnh báo dậm) cho tới lần gồng sau. | Có (Thiết kế 1) |
| 2 | `onReconnect` phòng thủ | **Còn.** `onReconnect` chỉ `if (player) player.offline = false`. Gần như không xảy ra được (giữa `resolve` của hold và `onReconnect` chỉ có microtask; `endSession` luôn từ chối hold trước), nhưng T25b đã làm `onJoin` thành async. Một lỗi sau này để lọt thì client nằm trong phòng mà không có nhân vật. Rẻ, nên làm. | Có (Thiết kế 2) |
| 3 | Bảng "Rời chủ động" trong `multiplayer.md`; ghi rõ 6-9 s | **Một nửa.** "6-9 giây" đã có trong bảng (hàng "Server biết bằng"). Còn sai: cột "Rời chủ động" vẫn ghi ví dụ "bấm 'Về sảnh'", trong khi nút đó chỉ hiện khi đã mất kết nối (không gửi được gì). Cũng chưa nói rõ trong 6-9 s đó nhân vật làm gì, và nó ghép với 1,5 s của T25 thế nào. | Sửa phần còn lại (Thiết kế 3) |
| 4 | Đăng ký `pagehide` ngay sau khi tạo `ConnectionWatch` | **Còn.** `ConnectionWatch` được tạo ngay khi vào phòng (`enter` → `attempt`), nhưng listener `pagehide` nằm trong `startGame`, chạy sau khi *cả* hình đã tải. Đóng trang trong lúc hình còn tải thì không gửi tin rời: server giữ chỗ 20 s, và phòng đủ 5 người bị chặn. | Có (Thiết kế 4) |
| 5 | Dừng ticker PixiJS khi mất hẳn kết nối | **Còn.** Không chỗ nào dừng ticker. `ConnectionWatch` và `SeenNotes` đã tự dừng khi `lost`. | Có (Thiết kế 5) |
| 6 | Dùng lại `inviteLink` thay cho `lobbyUrl(roomId, true)` | **Còn.** Hai hàm cho cùng kết quả: đặt `room` trên địa chỉ hiện tại, giữ tham số khác. `lobbyUrl(…, true)` được gọi 3 chỗ trong `main.ts` (`rememberWorld`, nút `rejoinBtn`, `comeBack`), `inviteLink` 1 chỗ (`hudBridge.ts`). | Có, theo cách gộp ngược (Thiết kế 6) |
| 7 | `inert` cho HUD khi chưa online | **Còn.** Màn che kết nối chặn chạm và chuột, nhưng Tab vẫn đưa focus vào nút HUD và bảng ở phía sau (màn che `aria-modal` không giữ focus). | Có (Thiết kế 7) |

Không mục nào đã xong hẳn. Mục 3 chỉ còn một nửa.

## Mục tiêu

Không có tính năng mới:
- thú thôi đánh thì thôi cả tư thế gồng trên màn hình;
- server không bao giờ giữ một client không có nhân vật;
- đóng trang sớm vẫn trả chỗ ngay;
- máy đỡ tốn pin khi đã mất hẳn kết nối;
- bàn phím không lọt vào giao diện bị che;
- bớt một hàm trùng; tài liệu đúng.

## Phạm vi

**Làm:** 7 mục ở bảng trên, theo Thiết kế 1-7.

**KHÔNG làm:**
- không đổi schema, message, `Profile`, close code, route;
- không đổi các mốc thời gian (`DROP_SHELTER_DELAY_MS`, `RECONNECT_*`, `STALL_MS`, `HUNG_TRY_MS`);
- không đổi luật bảo vệ của T25/T25b;
- không đổi chữ người chơi thấy.

## Thiết kế

### 1. `calmPalsTargeting` xoá luôn tư thế gồng cắn và dậm

`Combat.calmPalsTargeting(kind, id)`: với mỗi aggro nhắm đúng mục tiêu đó, **trước khi** xoá khỏi `wildAggro`:
- nếu `aggro.windupUntil !== undefined` (đang gồng cắn hoặc dậm) và thú còn trong `state.pals`, thì `this.cancelWindup(palId, pal)`. Hàm này đặt `pal.windup = ""` và xoá trường gồng của aggro.
- **không** đụng tới thú đang gồng *chiêu* (`pal.windup === "skill"`, đi theo `castingUntil`/`casts`, không theo aggro). Chiêu đã bắt đầu vẫn bay và rơi như hiện nay (`land` → `damage` → `sheltered`). `calmPalsTargeting` hôm nay không huỷ chiêu thú hoang; T26 giữ nguyên điều đó.

**Có mở lại cách né của T25 không? Không.** Lý do:
- Đòn cắn hay dậm đã bị huỷ ngay khi aggro bị xoá: `strike` chỉ chạy khi `aggro.windupUntil` còn. T26 chỉ làm hình ảnh khớp với điều đó.
- `calmPalsTargeting` vẫn chỉ được gọi ở cùng các chỗ như trước:
  - `shelter`, sau 1,5 s. Mọi đòn đã bắt đầu lúc rớt đều trúng trong ≤ 1350 ms;
  - `removePlayer`: `letGo` sau 1,5 s, `endSession` sau khi chờ `exposures` (T25b), rời chủ động, hết giờ chờ;
  - `faintPlayer`, `faintCompanion`.
- Không thêm chỗ gọi nào, không gọi sớm hơn. Test T1-T6 (T25) và B1-B8 (T25b) phải qua không đổi.

Client (`stateSync.ts`) đã tự vẽ lại khi `pal.windup` đổi về `""`, nên không cần sửa client.

### 2. `onReconnect` phòng thủ

```ts
onReconnect(client: Client) {
  this.holds.delete(client.sessionId);
  this.exposures.close(client.sessionId);
  const player = this.state.players.get(client.sessionId);
  // Back to a player who is no longer there (ended while the reconnection was resolving): never keep a client without
  // a character; it is told it plays elsewhere, the one way a held player is removed (endSession).
  if (!player) return client.leave(CLOSE_REPLACED);
  player.offline = false;
}
```

**Vì sao `CLOSE_REPLACED` (4201):** người đang được giữ chỗ chỉ bị xoá bằng `endSession`, tức cùng thiết bị vừa vào ở nơi khác. Client đã hiểu mã này ("Bạn đang chơi ở nơi khác") và không tự nối lại với nó.

**Đường đi trong Colyseus 0.18** (đã đối chiếu `_onJoin`):
1. Sau `onReconnect`, Colyseus kiểm `client.readyState !== OPEN` và ném "reconnection denied".
2. Rồi gọi `_onLeave(client, FAILED_TO_RECONNECT)`. Client lúc đó đang `RECONNECTING`, nên Colyseus gọi `onLeave`, không gọi `onDrop`: không hold mới, không vào nhánh mất chỗ.
3. `onLeave` → `removePlayer`: không làm gì vì người chơi đã đi; `holds.delete` vô hại.

Không có lỗi nào lọt ra ngoài.

### 3. Tài liệu: bảng "Rời chủ động và rớt mạng"

`docs/design/multiplayer.md`:
- **Hàng "Ví dụ", cột "Rời chủ động":** "đóng tab, tải lại trang, bấm 'Về sảnh'" → "đóng tab, tải lại trang, chuyển trang". Thêm một dòng dưới bảng: "Nút **Về sảnh** chỉ hiện khi đã mất kết nối, nên bấm nó không gửi gì: server đã coi đó là rớt mạng từ trước."
- **Hàng "Server biết bằng", cột "Rớt mạng":** giữ "6-9 giây" và nói rõ: "socket đóng bất thường (biết ngay), hoặc đường truyền chết im lặng: biết khi hết ping, sau 6-9 giây (trang cũng tự đóng kết nối sau 6 giây không nghe gì). Trong lúc server chưa biết, nhân vật vẫn ở trong thế giới như người đứng yên, chưa được bảo vệ."
- **Hàng "Nhân vật", cột "Rớt mạng":** nói 1,5 s tính *từ lúc server biết*: "Được bảo vệ chỉ khi rớt quá 1,5 giây kể từ lúc server biết (`DROP_SHELTER_DELAY_MS`)."
- **Dòng "Nếu tin rời phòng không kịp đi…":** thêm "(từ T26 trang gửi tin rời ngay từ khi vào được thế giới, cả lúc hình còn đang tải)".

### 4. `pagehide` ngay khi vào được phòng

**Vấn đề thứ tự:** hiện listener gọi `seen.note()` *rồi* `watch.leave()`. `SeenNotes` chỉ ghi khi `watch.online`, nên ghi trước khi rời là bắt buộc (T79/T83). Nếu chỉ chuyển dòng `watch.leave()` lên sớm bằng một listener thứ hai, thứ tự hai listener sẽ đảo (listener đăng ký trước chạy trước), và mốc "lần cuối thấy" không được ghi.

**Cách làm** (`main.ts`): một hàm cấp module thay cho biểu thức trong `attempt`:
```ts
/**
 * Watches a room just joined and frees its place if the page closes from now on (pictures may still be loading). What
 * must run first as the page closes (startGame's last-seen note) goes in `beforeLeave`.
 */
function watchJoined(room: GameRoom): Joined {
  const joined: Joined = { room, watch: new ConnectionWatch(room), beforeLeave: () => {} };
  window.addEventListener("pagehide", () => {
    joined.beforeLeave();
    joined.watch.leave();
  });
  return joined;
}
```
- `type Joined = { room: GameRoom; watch: ConnectionWatch; beforeLeave: () => void }`.
- `attempt` dùng `connect(...).then(watchJoined)`. `startGame(joined, art)` nhận `Joined` và đặt `joined.beforeLeave = () => seen.note()`, rồi **bỏ** listener `pagehide` cũ của nó.
- `failToStart` không đổi (vẫn `watch.leave()`; gọi hai lần vô hại vì `leave` bỏ qua khi đã `lost`).
- Listener `visibilitychange` của `seen` giữ nguyên trong `startGame`.

### 5. Dừng vẽ khi mất hẳn kết nối

**Định nghĩa "mất hẳn":** `watch.status.state === "lost"`, với mọi lý do: `failed`, `replaced`, `shutdown`, `left`, `refused`. Từ đó không còn gì từ server tới trang này nữa: `ConnectionWatch` đã dừng, và SDK đã `teardown` phòng.
- `refused` (T24) có hai ngả, đều không cần vẽ:
  - **tự vào lại:** trang sắp tải lại (`location.assign`);
  - **không:** thẻ "Không kết nối lại được".

  Màn che lúc hỏi `/resume` là DOM với vòng quay CSS, không cần PixiJS.
- `reconnecting` **không** phải mất hẳn: vẫn vẽ, để thấy người khác đi lại khi quay về.

**Cách làm** (`Game.ts`):
- Trường riêng `halting = false`.
- Trong `watchConnection`: `if (status.state === "lost") this.halting = true;`.
- Cuối `init` (sau `ticker.add`): nếu lúc đó `this.watch.status.state === "lost"` thì `halting = true`. Trường hợp này là rớt hẳn trong lúc hình còn tải: listener đăng ký sau, nên lỡ mất lần đổi trạng thái.
- Cuối `frame()`, sau `this.frames++`: `if (this.halting) this.stage.app.ticker.stop();`.
- Vẽ thêm **một** khung rồi mới dừng: render của PixiJS là một listener cùng ticker, chạy nốt trong nhịp này. Nhờ vậy thế giới sau lớp màn che không bao giờ trống, kể cả khi mất hẳn trước khung đầu tiên.

**Những gì không bị ảnh hưởng:**
- Màn che (`ConnectionOverlay`), nút **Về sảnh**, thẻ và vòng quay: DOM và CSS, không phụ thuộc ticker.
- Đổi cỡ cửa sổ: `renderer.on("resize")` vẫn chạy; khung đứng yên được giãn theo CSS.

**E2E:**
- `window.__petgame.game.frames` ngừng tăng sau khi mất hẳn. Đã đọc mọi chỗ chờ `frames` trong `multiplayer.spec.ts`, `reconnect.spec.ts`, `rejoin.spec.ts`, `pwa.spec.ts` và `scripts/shots.mjs`: không chỗ nào chờ `frames` *sau* khi đã `lost`. Các test bấm "Về sảnh" đều chờ `load` của trang mới, rồi đếm `frames` của game mới.
- Hai test `connection: when the world has let the player go…` (`multiplayer.spec.ts`, không sửa) bấm Về sảnh bằng chạm và bằng Enter khi đã `lost`. Chúng chạy lại không đổi và là bằng chứng nút còn dùng được.

### 6. Một hàm cho "địa chỉ có thế giới"

Gộp theo hướng ngược với dòng TASKS:
- `lobbyUrl(roomId, keepWorld)` giữ nguyên, là hàm thật;
- `inviteLink(roomId)` thành `return lobbyUrl(roomId, true);`, kèm JSDoc: the link given to friends is the address of this world, the same one a reload comes back to.

**Lý do:**
- Ba chỗ trong `main.ts` nói về *địa chỉ của trang*, không phải *link mời*. Đổi chúng thành `inviteLink` làm sai nghĩa khi đọc.
- `lobbyUrl` đã có JSDoc giải thích `keepWorld`.

Cách này bỏ được phần code trùng mà mỗi chỗ gọi vẫn đọc đúng nghĩa. Không đổi chỗ gọi nào.

### 7. HUD `inert` khi không online

- `Hud.setInert(on: boolean)`: `this.root.inert = on`, kèm JSDoc.
- `Game.watchConnection` gọi `this.hud.setInert(status.state !== "online")` mỗi lần đổi trạng thái; cuối `init` gọi một lần theo trạng thái hiện tại.

**Phạm vi `inert`:** `hud.root` chứa cột trái, các nút cảm ứng, vùng joystick, thanh chiêu, bảng Thú, Tủ đồ, Chế tạo, bản đồ nhỏ và hộp xác nhận thả thú (đều nhận `this.game.hud.root` làm cha trong `hudBridge.build`). Coder kiểm lại từng `new …(` trong `hudBridge.build`; cái nào gắn vào `container` thì chuyển vào `hud.root` hoặc cũng đặt `inert`.

**Không đụng:** `ConnectionOverlay` gắn vào `container` (anh em của HUD, không nằm trong HUD), nên nút **Về sảnh** vẫn nhận focus, chạm và bàn phím. Lớp `.labels` vốn không tương tác.

**Bàn phím game:** `keyboard.ts` nghe trên `window`, `inert` không chặn. Không sao: `Game.send` đã không gửi gì khi không online (T3).

**Focus:** nếu focus đang ở trong HUD lúc rớt, trình duyệt bỏ focus (về `body`). Khi `lost`, màn che tự đặt focus vào Về sảnh (như T3). Khi quay lại online, `inert` được gỡ ngay trong listener, trước khi test hay người chơi bấm gì.

## Kế hoạch triển khai

1. **`packages/server/src/systems/combat.ts`:** `calmPalsTargeting` theo Thiết kế 1; sửa JSDoc: "Every wild pal after this target lets go, and a bite or stomp it was winding up is called off (its pose too); a skill already being cast flies on."
2. **`packages/server/src/rooms/GameRoom.ts`:** `onReconnect` theo Thiết kế 2.
3. **`GameRoom.test.ts`:** test S1-S3 (mục Test).
4. **`packages/client/src/main.ts`:**
   - `type Joined`, `watchJoined`; `attempt` dùng nó;
   - `startGame(joined, art)` đặt `beforeLeave` và bỏ listener `pagehide` cũ;
   - `failToStart` nhận `Joined` hoặc giữ `(room, watch)` (coder chọn, ít sửa nhất).
5. **`packages/client/src/net/connection.ts`:** `inviteLink` gọi `lobbyUrl(roomId, true)`; JSDoc.
6. **`packages/client/src/net/connection.test.ts`** (mới, Node): `vi.stubGlobal("location", new URL("http://h/?quality=low&room=old"))` (`connection.ts` chỉ dùng `location.href`).
   - `inviteLink("abc") === lobbyUrl("abc", true)`;
   - giữ `quality=low`, thay `room`;
   - `lobbyUrl("abc", false)` bỏ `room`, giữ `quality`;
   - `vi.unstubAllGlobals()` sau mỗi test.
7. **`packages/client/src/ui/hud.ts`:** `setInert`. **`packages/client/src/game/Game.ts`:** `halting`, `watchConnection`, cuối `init`, cuối `frame()` theo Thiết kế 5 và 7.
8. **`tests/e2e/reconnect.spec.ts`:** test và phép kiểm thêm (mục Test). Dùng lại các helper đã chép ở đó (`openWithSwitch`, `enterLobby`, `waitForWorld`, `observer`).
9. **Tài liệu** (mục Tài liệu).
10. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Giao thức

Không đổi schema, message, `JoinOptions`, `Profile`, close code, route. `CLOSE_REPLACED` đã có. `pal.windup` được đặt `""` sớm hơn (cùng trường, cùng giá trị). Client tự vẽ lại theo trường đó như trước.

## Test

### Tích hợp (`GameRoom.test.ts`)

- **S1** `calming the pals after a player clears a bite's or a stomp's wind-up pose, and leaves a skill being cast alone` (describe `combat`, hoặc cạnh các test aggro):
  - Cắn: `scorchtail` cạnh người chơi A, `provoke`, ép `combat.windUp(pal, aggro, "bite", 900)`; có thêm người chơi B gần đó. Gọi `(room as any).combat.calmPalsTargeting("player", A)`. Mong đợi: `pal.windup === ""` ngay; aggro không còn; sau 25 nhịp A không mất máu; nếu thú nhắm B thì `pal.windup` vẫn `""` cho tới khi `wildAggro.get(id).windupUntil` có giá trị mới.
  - Dậm: trùm (`bossOf`), ép gồng `"stomp"`, gọi calm. Mong đợi: `boss.windup === ""`, không ai trúng dậm.
  - Chiêu: một thú hoang bắt đầu chiêu bằng `(room as any).skills.startCast("wild", id, pal, 1, getSkill("ember"), target)` (`pal.windup === "skill"`), gọi calm. Mong đợi: vẫn `"skill"`, cast còn trong `casts`.
- **S2** `a pal that starts winding up during the 1.5 s after a drop is called off by the shelter, pose and all, while the bite under way at the drop still lands` (describe `reconnecting…`):
  - `cutConnection(..., { realDelay: true })`, `steadyClock`;
  - thú 1 ép gồng cắn 900 ms ngay trước khi rớt; thú 2 ép gồng cắn 900 ms ở `dropAt + 1200`.

  Mong đợi:
  - cú của thú 1 trúng (máu giảm trước `dropAt + DROP_SHELTER_DELAY_MS`);
  - tại `dropAt + DROP_SHELTER_DELAY_MS + 100`: `offline`, `pal2.windup === ""`, không còn aggro của thú 2;
  - sau 25 nhịp máu không giảm thêm.

  Đây là bằng chứng T26 không mở lại đường né của T25.
- **S3** `a reconnection that finds no player is sent away as replaced, and leaves no client behind`:
  - `holdReconnect`, `cutConnection` (mặc định), chờ `offline`;
  - bọc `room.onReconnect` bằng `vi.spyOn(room, "onReconnect")` với hàm: `(room as any).removePlayer(c.sessionId)` rồi gọi bản gốc (giả trường hợp nhân vật bị xoá giữa lúc hold đang `resolve`);
  - mở cổng.

  Mong đợi:
  - `client.onLeave` nhận `CLOSE_REPLACED`;
  - `vi.waitFor` thấy `room.clients` không còn sessionId đó, `room.state.players.size === 0`, `holdsOf(room).size === 0`;
  - spy `console.error` không được gọi với lỗi ngoài "reconnection denied" của Colyseus. Nếu Colyseus tự log dòng này thì chấp nhận và ghi chú thích.
- Các test T3, T24 (A1-A4), T25 (T1-T6), T25b (B1-B8) qua không đổi nghĩa.

### Unit (client)

- `net/connection.test.ts` (bước 6).
- `reconnect.test.ts` không đổi.

### E2E (`tests/e2e/reconnect.spec.ts`)

- **Test mới E1** `connection: closing the page while the pictures still load frees the place at once`:
  - host bằng SDK (`new Client(SERVER).create("world", …)`), observer cùng phòng;
  - context mới, `page.route("**/assets/**", () => {})` (treo mọi ảnh: lời hứa `assets` không xong, nên `startGame` chưa chạy);
  - `goto("/?room=<id>&quality=low")`, `enterLobby`, chờ observer thấy 3 người (host, observer, trang);
  - `await page.close()`.

  Mong đợi: observer thấy người của trang biến mất trong ≤ 3 s (`expect.poll`, hạn 3 000), không phải bị giữ 20 s. **Trên HEAD test này hỏng** (người đó `offline` rồi ở lại); ghi vào `PROGRESS.md`.
- **Thêm vào test có sẵn** `connection: a try that opens and never answers…` (máy tính hoặc điện thoại):
  - trong lúc `reconnecting`: `.hud` có thuộc tính `inert`; bấm `Tab` 5 lần, `document.activeElement` không bao giờ nằm trong `.hud`; `frames` vẫn tăng (đang thử lại, vẫn vẽ);
  - sau khi online lại: `.hud` không còn `inert`; nút Thú (`.party-btn`) bấm được và bảng mở.
- **Thêm vào test có sẵn** `connection: a place lost while coming back…`, phần 2 (lần mất chỗ thứ hai trong một phút, kết thúc ở "Không kết nối lại được"):
  - `.hud` có `inert`; `.net-lobby` có focus;
  - đọc `frames` hai lần cách nhau 1 s (bằng `expect.poll` trên một giá trị ổn định, không `waitForTimeout` để chờ trạng thái; một `waitForTimeout(1000)` có chú thích cho phép đo "không đổi" là chấp nhận được): chênh tối đa 1;
  - `game.stage.app.ticker.started === false`;
  - Enter trên `.net-lobby` vẫn đưa về sảnh (`load` mới).

  Mục đích: chắc ticker dừng và `inert` không làm hỏng nút.
- Chạy lại toàn bộ e2e. Hai test `connection: when the world has let the player go…` trong `multiplayer.spec.ts` (không sửa) phải qua: chúng bấm Về sảnh bằng chạm và Enter khi đã mất hẳn, và đổi cỡ màn hình khi ticker đã dừng.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | `calmPalsTargeting` không gọi `cancelWindup` | S1 (cắn, dậm), S2 |
| M2 | `calmPalsTargeting` luôn đặt `pal.windup = ""` (cả khi đang gồng chiêu) | S1 (chiêu) |
| M3 | `calmPalsTargeting` gọi `cancelWindup` cho mọi thú, kể cả thú không nhắm mục tiêu đó | thêm vào S1 một thú thứ ba gồng cắn người B: nó phải vẫn `"bite"` |
| M4 | `onReconnect` bỏ nhánh `!player` | S3 (client không nhận 4201, vẫn ở trong `room.clients`) |
| M5 | `onReconnect` gửi mã khác (4003) | S3 |
| M6 | trả `pagehide` về trong `startGame` | E1 |
| M7 | trong `watchJoined`, gọi `watch.leave()` trước `beforeLeave()` | test ghi mốc "lần cuối thấy" khi đóng trang trong `rejoin.spec.ts` (tester ghi tên test bắt được; nếu không test nào bắt thì ghi rõ) |
| M8 | bỏ `ticker.stop()` | phần 2 của test `a place lost…` (`ticker.started`, `frames`) |
| M9 | dừng ticker cả khi `reconnecting` | test `a try that opens…` (`frames` không tăng lúc thử lại) |
| M10 | không gọi `setInert(false)` khi online lại | test `a try that opens…` (nút Thú không bấm được) |
| M11 | không đặt `inert` | test `a try that opens…` (Tab vào HUD) |
| M12 | `inviteLink` bỏ các tham số khác | `connection.test.ts` |

## Tài liệu

- **`docs/design/multiplayer.md`:**
  - bảng "Rời chủ động và rớt mạng" và dòng dưới nó, theo Thiết kế 3;
  - mục **Trong 20 giây chờ**: "Thú đang gồng cắn hay dậm thì thôi luôn tư thế gồng (T26)";
  - mục **Quay lại**: "Mất hẳn kết nối thì game ngừng vẽ để đỡ tốn pin; màn hình và nút Về sảnh vẫn dùng được";
  - dòng đầu thêm "T26".
- **`docs/design/hud.md`:** một dòng trong mục về màn che kết nối (hoặc mục bàn phím): "Khi không online, HUD đặt `inert`: Tab và chạm không vào được nút nào phía sau màn che; nút Về sảnh của màn che nằm ngoài HUD nên vẫn dùng được."
- **`docs/architecture.md`:**
  - client: `watchJoined` đăng ký `pagehide` ngay khi vào phòng; `beforeLeave` để `startGame` ghi mốc trước khi rời;
  - `Game` dừng ticker ở khung kế tiếp khi `lost` (`halting`);
  - `Hud.setInert`;
  - `inviteLink` = `lobbyUrl(…, true)`;
  - server: `calmPalsTargeting` huỷ cả tư thế gồng; `onReconnect` phòng thủ (4201).

## Tiêu chí hoàn thành

- [ ] Bảng "Kiểm lại" ở đầu file khớp với code (mục 3 chỉ sửa phần còn thiếu).
- [ ] `calmPalsTargeting` gọi `cancelWindup` cho đúng thú đang gồng cắn hoặc dậm vào mục tiêu đó, không đụng thú đang gồng chiêu.
- [ ] `onReconnect` gửi `CLOSE_REPLACED` khi không còn nhân vật.
- [ ] `pagehide` được đăng ký trong `watchJoined` ngay khi vào phòng; `seen.note()` vẫn chạy trước `watch.leave()`.
- [ ] `Game` dừng ticker sau một khung khi `lost` (mọi lý do), kể cả khi đã `lost` trước lúc dựng xong; vẫn vẽ khi `reconnecting`.
- [ ] HUD `inert` khi không online, gỡ ngay khi online; màn che và nút Về sảnh không bị `inert`.
- [ ] `inviteLink` gọi `lobbyUrl(roomId, true)`; `connection.test.ts` qua.
- [ ] S1-S3, E1 và các phép kiểm thêm trong `reconnect.spec.ts` qua. E1 hỏng trên HEAD `15500f7` (ghi trong `PROGRESS.md`). Mọi test kết nối lại cũ (T3, T24, T25, T25b) và `multiplayer.spec.ts` (không sửa) qua.
- [ ] Bảng đột biến M1-M12 cho đúng kết quả, ghi trong `PROGRESS.md` (M7 ghi rõ test nào bắt).
- [ ] Không đổi schema, message, `Profile`, close code, route, chữ người chơi thấy. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` qua. Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không có quyết định lớn, không đổi giao thức hay dữ liệu đã lưu.

1. **`inert` và Playwright:** Playwright coi phần tử trong vùng `inert` là không bấm được và sẽ chờ. Các test cũ chỉ bấm nút HUD khi đã online (đã đọc). Nếu một test cũ của `multiplayer.spec.ts` hỏng vì lý do này, tester báo lại. Không sửa spec đó; xem lại thời điểm gỡ `inert`.
2. **Dừng ticker:** nếu sau này có thứ gì cần chạy theo khung khi đã mất hẳn (ví dụ hoạt ảnh trên canvas của màn che), phải chạy bằng CSS hoặc `requestAnimationFrame` riêng.
3. **`page.route("**/assets/**")` trong E1:** nếu lời hứa `assets` không phụ thuộc mọi file dưới `/assets` (ví dụ chỉ mục ảnh `assetIndex` nuốt lỗi và trả rỗng), `startGame` có thể chạy sớm và E1 qua cả trên HEAD. Khi đó coder chặn đúng file mà `loadPalSprites`/`loadPictures` chờ (treo, không `abort`), và kiểm trên HEAD rằng E1 hỏng.

## Đề xuất cho `TASKS.md`

Không có việc mới.
