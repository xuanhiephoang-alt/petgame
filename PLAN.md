# PLAN: T25b Né đòn qua đường mất chỗ của T24

Code đọc ở `2db768c` ("Mark T25 done, add T25b and T92, start T25b"; mã T25 ở `29344e0`). Nguồn:
- dòng T25b trong `TASKS.md`; `REVIEW.md` ở HEAD (review T25, góp ý 1);
- `packages/server/src/rooms/GameRoom.ts`: `onJoin`, `onDrop` (nhánh hold không phải `Deferred` của T24), `shelter`, `onReconnect`, `onLeave`, `onDispose`, `removePlayer`, `endSession`, `isEmpty`, `holdEmptyWorld`, `canResume`, `pickColor`, các trường `holds`, `resumes`, `resumeMs`, `shelterDelayMs`, và `liveSessions` cấp module;
- `systems/resume.ts`, `systems/combat.ts` (`faintPlayer`, `calmPalsTargeting`), `systems/leaders.ts` (`bossStomp`), `systems/movement.ts` (thú đi theo dừng khi chủ `offline`);
- mã nguồn `@colyseus/core` 0.18.18 `Room.mjs`: `allowReconnection` trả Promise bị từ chối "not joined" khi `_enqueuedMessages !== undefined`; `_onLeave` → `onDrop` → `#_onAfterLeave` → `onLeave` ngay; `_onJoin` `await this.onJoin(...)`, rồi kiểm `client.state === LEAVING`;
- `GameRoom.test.ts`: `cutConnection(..., { realDelay })`, `holdReconnect`, `reconnected`, `loseWhileComingBack`, `resumesOf`, `steadyClock`, `bossOf`, test A1-A3 của T24 và T1-T6 của T25;
- `docs/design/multiplayer.md` (mục "Quay lại", "Trong 20 giây chờ", "Đã cân nhắc và chấp nhận").

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Chỉ đổi server, test và tài liệu. Client không đổi, nên không có e2e mới.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Không chạy `git stash`.

## Mục tiêu

T25 bắt một lần rớt phải kéo dài 1,5 s (`DROP_SHELTER_DELAY_MS`) mới được bảo vệ, nên đòn đang gồng luôn trúng. Nhưng còn một đường vòng qua nhánh "mất chỗ" của T24:
1. Đóng socket. Đây là lần rớt thường: hold là `Deferred`, người chơi chưa được bảo vệ.
2. SDK nối lại. Client đóng socket lần nữa trước khi đọc `JOIN_ROOM` (cùng cách test A1 làm).
3. Colyseus từ chối giữ chỗ ("not joined"), nên `onDrop` vào nhánh T24: ghi điểm quay lại; `onLeave` → `removePlayer` xoá người chơi **ngay**; `calmPalsTargeting` huỷ cú cắn hoặc cú dậm đang gồng.
4. Vào lại bằng token: đúng chỗ, đúng máu.

Client T24 tự làm như vậy mỗi phút một lần; một script thì làm không giới hạn, và né được mọi cú dậm của trùm.

Sau T25b, **mọi lần rời thế giới do mất kết nối đều đứng phơi ra đủ 1,5 s**, kể cả lần mất chỗ:
- người chơi mất chỗ ở lại trong thế giới, đứng yên, đến hết 1,5 s, rồi mới bị xoá;
- điểm quay lại ghi máu và chỗ **sau** các đòn trong khoảng đó (kể cả khi ngất);
- lần vào lại cùng thiết bị đến giữa chừng thì chờ hết khoảng đó rồi nhận đúng trạng thái sau đòn.

Người chơi thật mất chỗ mà không bị ai đánh vẫn quay lại đúng chỗ và đúng máu như T24.

## Chọn cách

| | (a) Giữ người mất chỗ trong thế giới tới hết 1,5 s, rồi mới xoá và ghi điểm quay lại | (b) Xoá ngay, nhưng tự tính các đòn đang chờ vào máu của điểm quay lại |
|---|---|---|
| Ai quyết sát thương | chính mô phỏng thường: `strike`, `bossStomp`, chiêu bay tới, đẩy lùi, `faintPlayer`, khiên, giáp, hệ | một bản tính thứ hai, phải chép lại mọi luật đó (giáp, khiên, hệ, đẩy lùi đổi chỗ, ngất đổi chỗ và máu, chiêu vùng chỉ trúng nếu đứng trong vùng) |
| Đòn bắt đầu *trong* 1,5 s sau khi mất chỗ | trúng như với người đứng yên (đúng luật T25) | không tính được (thú chưa gồng lúc xoá) |
| Lượng code | một trạng thái "đang rời" (2 Map) + một hẹn giờ + một lần chờ trong `onJoin` | nhỏ ở chỗ xoá, lớn ở bản tính sát thương, và phải giữ hai bản khớp nhau mãi về sau |
| Lần vào lại giữa chừng | phải chờ (Thiết kế 3) | không cần chờ |

**Chọn (a).** Server vẫn quyết theo đúng một đường mô phỏng, không có bản tính thứ hai để lệch. Luật thống nhất với T25: rớt kiểu gì cũng đứng phơi 1,5 s. Phần khó duy nhất (vào lại giữa chừng) giải bằng một lần `await` trong `onJoin`, mà Colyseus đã hỗ trợ (`await this.onJoin(...)`).

## Phạm vi

**Làm:**
- Server:
  - trạng thái "mất chỗ, đang rời" cho nhánh T24 của `onDrop`;
  - hẹn giờ `letGo` xoá người chơi và ghi điểm quay lại sau `shelterDelayMs`;
  - `onLeave` bỏ qua người đang rời;
  - `onJoin` chờ khoảng phơi của phiên cũ cùng thiết bị (cả phiên mất chỗ lẫn phiên đang giữ chỗ chưa được bảo vệ);
  - `canResume` đúng trong lúc đang rời;
  - `onDispose` lưu người đang rời.
- Lớp nhỏ `Exposures` có unit test.
- Test tích hợp tái hiện cách né trên code hiện tại, rồi chứng minh đã bịt.
- Tài liệu.

**KHÔNG làm:**
- Không đổi client, schema, message, `JoinOptions`, `Profile`, close code, route `/resume`, `DROP_SHELTER_DELAY_MS`, `RECONNECT_GRACE_MS`, `resumeMs`.
- Không đổi luật rời chủ động (4000: đóng tab, tải lại) và luật tab thứ hai khi phiên cũ đang online: hai trường hợp đó vẫn kết thúc phiên cũ ngay, vào lại ở giữa bản đồ với máu đầy, như thiết kế từ T3/T23. Đề xuất tách ở cuối file.
- Không làm các góp ý 2-5 của review T25 (không nằm trong dòng T25b; góp ý 3 làm luôn vì đụng đúng helper test, xem bước 6).

## Thiết kế

### 1. Hằng số

Không có hằng số mới. Dùng lại:

| Tên | Giá trị | Dùng cho |
|---|---|---|
| `DROP_SHELTER_DELAY_MS` / `GameRoom.shelterDelayMs` | 1500 | thời gian người mất chỗ còn đứng trong thế giới (cùng lý do T25: dài hơn đòn dài nhất 1350 ms + 2 nhịp) |
| `RECONNECT_GRACE_MS` / `GameRoom.resumeMs` | 20 000 | thời gian điểm quay lại còn hạn, tính từ lúc `letGo` (lúc xoá thật) |

### 2. Mất chỗ: đứng trong thế giới đến hết 1,5 s

**Trong `onDrop`, nhánh hold không phải `Deferred`** (thay cho `noteResume` + `return` hiện nay):
- dừng ý định như nhánh thường: `control.input = {0, 0}`, `dashLeftMs = 0`, `skillOrder = undefined`, `aggroUntil = 0`. Gom 4 dòng này vào phương thức riêng `stopIntents(control)`, dùng cho cả hai nhánh. Lý do: sau khi nối lại (bước 2 của cách né), client có thể đã gửi `Input`;
- `this.lostPlaces.set(sessionId, control.token)`, và `this.exposures.open(sessionId)`;
- `this.clock.setTimeout(() => this.letGo(sessionId), this.shelterDelayMs)`;
- `player.offline` để nguyên `false`: họ chưa được bảo vệ, như 1,5 s đầu của lần rớt thường.

**`onLeave`** (Colyseus gọi ngay sau `onDrop` cho phiên này): nếu `this.lostPlaces.has(sessionId)` thì `return` ngay, không `removePlayer`. Client của Colyseus đã đi, nhưng `Player` vẫn ở trong state, vì state là của ta, Colyseus không đụng.

**`letGo(sessionId)`** (phương thức riêng mới):
1. Nếu không còn trong `lostPlaces` thì thôi (đã bị xoá đường khác).
2. Lấy `token`, xoá khỏi `lostPlaces`.
3. Nếu còn `player`, `control` và `token`: `noteResume` với `x, y, hp, color, nextEatAt` **lúc này**, `until = now + resumeMs`.
4. `removePlayer(sessionId)` trong `try/catch` ghi log, như `onLeave`. Hẹn giờ chạy ngoài mọi `try` của Colyseus; ném lỗi ở đây sẽ làm sập server.
5. `if (this.isEmpty()) this.holdEmptyWorld()`.

**Trong 1,5 s đó** (giống hệt 1,5 s đầu của lần rớt thường ở T25):
- đòn đang gồng trúng; đẩy lùi đổi chỗ;
- máu về 0 thì `faintPlayer` đưa về trại hoặc đống lửa với máu đầy. Điểm quay lại khi đó là chỗ ấy với máu đầy: đúng điều server đã quyết;
- thú hoang vẫn nhắm và đánh; thú đi theo vẫn theo chủ và đánh (chủ chưa `offline`);
- tự hồi máu và khí hậu vẫn chạy;
- người khác thấy nhân vật đứng yên rồi biến mất.

**Các trường hợp khác của nhánh này:**
- Phòng đang đóng ("disposing"): cũng đi đường trên. Hẹn giờ chết cùng đồng hồ, và `onDispose` lưu (xem dưới).
- Kết nối chết trước khi xác nhận lần vào *đầu tiên*: người chơi mới xuất hiện đứng 1,5 s rồi biến mất. Vô hại.

**`removePlayer`:** thêm `this.lostPlaces.delete(sessionId)` và `this.exposures.close(sessionId)`, nên mọi đường xoá đều kết thúc trạng thái đang rời và đánh thức người đang chờ.

**`onDispose`:** với mỗi `sessionId` còn trong `lostPlaces`, gọi `removePlayer` (lưu hồ sơ) trong `try/catch`; rồi `this.exposures.closeAll()`, để không lần vào nào chờ mãi một phòng đã đóng.

### 3. Vào lại cùng thiết bị giữa lúc phiên cũ còn phơi

**Vấn đề nếu không làm gì:** `onJoin` thấy phiên cũ trong `liveSessions` và gọi `endSession`, tức `removePlayer` ngay. Đòn đang gồng bị huỷ, và điểm quay lại chưa được ghi (lấy chỗ xuất hiện, máu đầy): lại né được, còn hồi máu thêm. Đòn không thể "chuyển" sang phiên mới, vì nó nhắm theo `sessionId` cũ.

**Luật:** một phiên vừa rớt mà chưa hết khoảng phơi thì lần vào mới cùng thiết bị **chờ** đến khi khoảng phơi kết thúc, rồi mới xử lý như hiện nay. Có hai loại phiên như vậy:
- *Phiên mất chỗ* (Thiết kế 2): chờ `letGo`. Sau đó `liveSessions` không còn phiên cũ, và `takeResume` lấy đúng điểm quay lại **sau đòn**.
- *Phiên đang giữ chỗ trong 1,5 s đầu* (rớt thường của T25, chưa `shelter`): chờ `shelter` (hoặc nối lại). Sau đó `endSession` như hiện nay: vào lại là phiên mới ở chỗ xuất hiện, máu đầy (luật T3 không đổi). Lần chờ chỉ đảm bảo đòn đang gồng trúng phiên cũ trước, nên "rớt rồi vào lại ngay bằng token" không còn là cách huỷ một cú dậm.

**Cài đặt** (`onJoin` thành `async`):
```ts
const token = isValidToken(options?.token) ? options.token : undefined;
// An older session of this device still standing in a world after a drop (less than shelterDelayMs ago) is waited
// for: a blow under way lands first, and a lost place's spot is the one after it.
const exposed = token ? liveSessions.get(token) : undefined;
if (exposed) await exposed.room.exposures.settled(exposed.sessionId);
const older = token ? liveSessions.get(token) : undefined; // read again: the wait may have removed it
if (older) older.room.endSession(older.sessionId);
```
- `keepWorldOpen()` vẫn ở dòng đầu, trước lần chờ.
- Đọc lại `liveSessions` sau khi chờ là bắt buộc.
- Lần chờ dài tối đa `shelterDelayMs`. Client vẫn chỉ thấy "đang vào", nên không đổi gì ở client.
- Nếu client rời trong lúc chờ, Colyseus tự kiểm `client.state === LEAVING` sau `onJoin` và xử lý như mọi lần rời sớm.

**Không bao giờ có hai bản cùng token:** phiên mới chỉ tạo `Player` sau khi phiên cũ đã bị xoá (do chờ). Phiên online không có khoảng phơi, nên `endSession` ngay như cũ.

### 4. `Exposures` (`packages/server/src/systems/exposure.ts`, mới)

Lớp nhỏ, không phụ thuộc Colyseus, có unit test. Ghi các phiên đang "đứng phơi" sau một lần rớt và cho phép chờ tới khi hết:
- `open(sessionId)`: mở khoảng phơi nếu chưa có (đã có thì giữ nguyên).
- `close(sessionId)`: kết thúc và đánh thức người chờ; gọi nhiều lần vô hại.
- `isOpen(sessionId): boolean`.
- `settled(sessionId): Promise<void>`: xong ngay nếu không mở. Nếu đang mở thì chờ, và **lặp lại** nếu lúc tỉnh dậy phiên đó lại đang mở (một lần rớt mới ngay sau): `for (let e = map.get(id); e; e = map.get(id)) await e.done;`.
- `closeAll()`.

**Ai mở, ai đóng:**

| Lúc | Gọi |
|---|---|
| `onDrop`, nhánh `Deferred` (rớt thường) | `open` |
| `onDrop`, nhánh mất chỗ | `open` |
| `shelter` khi hold khớp | `close` (đã được bảo vệ: không còn đòn nào huỷ được bằng cách xoá) |
| `onReconnect` | `close` (đã quay lại) |
| `removePlayer` | `close` (mọi đường xoá: `letGo`, hết giờ chờ, `endSession`, rời chủ động) |
| `onDispose` | `closeAll` |

### 5. `/resume` và client tự vào lại

- `canResume(token)` = `peekResume(this.resumes, token, now)` **hoặc** có một mục trong `lostPlaces` mang `token` đó.
- Client T24 hỏi `/resume` ngay sau mã 4003, tức thường còn trong 1,5 s đang rời, khi điểm quay lại chưa được ghi. Vẫn phải trả `true`, nếu không người chơi thật bị đẩy ra "Không kết nối lại được".
- Client tải lại và vào: đến sau 1,5 s thì lấy điểm quay lại như T24; đến sớm thì chờ (Thiết kế 3). Client không đổi.

### 6. Các phần khác

| Phần | Sau T25b |
|---|---|
| Thú đi theo và danh sách thú | thuộc phiên cũ (`ownerId`) đến `letGo`; `removePlayer` cất theo chủ như hiện nay; phiên mới gọi thú ra từ hồ sơ sau khi phiên cũ đã đi, nên không có hai thú cùng id |
| Giữ thế giới trống | `isEmpty()` không nhìn `players`; người đang rời không giữ thế giới mở. `letGo` gọi `holdEmptyWorld` nếu trống. 60 s ≫ 1,5 s nên không có chuyện thế giới đóng giữa lúc đang rời |
| Lưu | `letGo` → `removePlayer` → `saveNow` (sau đòn); phòng đóng: `onDispose` lưu; mất chỗ không còn lưu ngay (giống T25: lưu khi lần rời được tính) |
| `debug:endGrace` | chỉ từ chối các `holds`; người đang rời không có hold, nên đi hết 1,5 s. Test không cần gì thêm |
| Phòng đủ 5 người | Colyseus trả chỗ ngay lúc mất chỗ; một người lạ vào trong 1,5 s đó thì có lúc 6 nhân vật, và `pickColor` có thể trùng màu. Chấp nhận: cần phòng đủ người *và* đúng khe đó, kéo dài tối đa 1,5 s. Chính thiết bị đó vào lại thì phải chờ, nên không bị mất chỗ vì chính mình |
| T25 `shelter` | thêm `this.exposures.close(sessionId)` khi hold khớp |

## Kế hoạch triển khai

1. **Viết test tái hiện trước** (B1 và B2 ở mục Test) và chạy trên code hiện tại (HEAD `2db768c`). Ghi vào `PROGRESS.md` rằng chúng hỏng, ở đúng chỗ mong đợi: người chơi biến mất ngay, cú dậm không trúng, vào lại còn nguyên máu. Rồi mới sửa code.
2. **`packages/server/src/systems/exposure.ts`** + **`exposure.test.ts`** (mới): lớp `Exposures` theo Thiết kế 4, JSDoc tiếng Anh.
3. **`GameRoom.ts`:**
   - Trường `lostPlaces = new Map<string, string | undefined>()` (JSDoc: session id → device token of a player whose place was lost and who still stands in the world until `letGo`) và `exposures = new Exposures()` (JSDoc: sessions that dropped less than `shelterDelayMs` ago; a fresh join of the same device waits on them).
   - `stopIntents(control)` riêng; dùng ở cả hai nhánh của `onDrop`.
   - `onDrop`, nhánh không phải `Deferred`: theo Thiết kế 2, bỏ `noteResume` khỏi đây. Sửa chú thích nhánh.
   - `onDrop`, nhánh `Deferred`: thêm `this.exposures.open(sessionId)`.
   - `shelter`: thêm `this.exposures.close(sessionId)` khi hold khớp.
   - `onReconnect`: thêm `this.exposures.close(client.sessionId)`.
   - `letGo(sessionId)` riêng mới (Thiết kế 2), JSDoc.
   - `onLeave`: `if (this.lostPlaces.has(sessionId)) return;` ở đầu, kèm chú thích.
   - `onJoin`: `async`, chờ theo Thiết kế 3.
   - `removePlayer`: thêm `lostPlaces.delete`, `exposures.close`.
   - `onDispose`: lưu người đang rời, `exposures.closeAll()`.
   - `canResume`: Thiết kế 5.
   - Sửa JSDoc của `onDrop`, `onLeave`, `onJoin` cho khớp.
4. **`GameRoom.test.ts`, helper:**
   - `cutConnection(..., { realDelay: true })` đặt lại `room.shelterDelayMs = DROP_SHELTER_DELAY_MS` (góp ý 3 của review T25), để thứ tự gọi không lặng lẽ làm mất độ trễ.
   - Helper mới `loseQuickly(room, client)`: như `loseWhileComingBack` nhưng `cutConnection(..., { realDelay: true })`, **không** chờ `offline` (mở cổng ngay), rồi thay `events.onmessage` để đóng socket trước khi đọc `JOIN_ROOM`. Trả mã `onLeave` của client (4003). JSDoc nói đây chính là cách né của T25b.
   - Helper `lostAt(room, sid)`: chờ `(room as any).lostPlaces.has(sid)` rồi trả `room.clock.currentTime`.
5. **`GameRoom.test.ts`, test mới** trong describe `reconnecting after a dropped connection` (mục Test).
6. **Tài liệu** (mục Tài liệu).
7. `npm run typecheck`, `npm test`. Rồi `npx playwright test -g "connection:" --workers=1` và `npx playwright test tests/e2e/reconnect.spec.ts --workers=1`. Test 1 của `reconnect.spec.ts` (tự vào lại sau mất chỗ) nay chờ thêm tối đa 1,5 s; e2e cũ phải qua mà không sửa `multiplayer.spec.ts`.

## Giao thức

Không đổi schema, message, `JoinOptions`, `Profile`, close code hay route. `/resume` giữ nguyên dạng; chỉ trả `true` thêm trong lúc đang rời. `onJoin` thành async: Colyseus đã `await` nó. Client không đổi; hồ sơ đã lưu không bị ảnh hưởng.

## Test

### Unit: `packages/server/src/systems/exposure.test.ts`

- `settled` của phiên chưa mở: xong ngay.
- `open` rồi `settled`: chưa xong; sau `close` thì xong.
- `close` hai lần, và `close` phiên chưa mở: vô hại.
- `open` khi đang mở: giữ nguyên lần mở đầu (một `close` là đủ).
- Mở lại ngay sau `close` (trước khi người chờ tỉnh): `settled` chờ tiếp lần mở mới.
- `closeAll` đánh thức mọi người chờ.
- `isOpen` đúng theo từng bước.

### Tích hợp (`GameRoom.test.ts`)

Mọi test mới dùng `useStore(new SqliteStore(":memory:"))`, token riêng, `steadyClock`, `room.state.pals.clear()` (trừ trùm khi cần), thú đánh có `maxHp = hp = 999`, và đo theo đồng hồ phòng. Gồng ép bằng `(room as any).combat.windUp(pal, aggro, kind, ms)` sau `provoke`, cho tất định.

- **B1** `a place lost while coming back does not call off the boss's stomp: the player stands until DROP_SHELTER_DELAY_MS, the stomp lands, and the spot taken back is the one after it` (**tái hiện cách né**):
  - trùm (`bossOf`) cách người chơi < `BOSS.stompRadius`, `provoke`, ép gồng dậm `BOSS.stompWindupMs`; ghi `hp0`;
  - `loseQuickly` (nhận 4003), `t = lostAt(...)`.

  Mong đợi:
  - ngay sau đó người chơi còn trong `state.players`, `offline` là `false`, `canResume(token)` là `true`;
  - tại `t + BOSS.stompWindupMs + 100`: `hp < hp0` và vị trí đã bị đẩy;
  - tại `t + DROP_SHELTER_DELAY_MS + 100`: người chơi đã bị xoá, `resumesOf(room).get(token).hp` bằng máu sau dậm, vị trí bằng chỗ sau khi bị đẩy;
  - vào lại bằng token: đúng máu và chỗ đó.

  **Trên HEAD:** hỏng ở "còn trong `state.players`" (bị xoá ngay) và ở máu.
- **B2** `a rejoin of the same device inside the window waits for it, and gets the health after the blow` (**tái hiện cách né bằng script**):
  - như B1 nhưng gồng cắn (`scorchtail`, ép 900 ms);
  - ngay sau 4003, gọi `colyseus.connectTo(room, { name, token })` mà chưa `await`;
  - mỗi nhịp lấy mẫu số người chơi có `controls.get(sid).token === token`.

  Mong đợi:
  - lời hứa join chỉ xong khi `room.clock.currentTime >= t + DROP_SHELTER_DELAY_MS - 50`;
  - số mẫu luôn ≤ 1 (không bao giờ hai bản);
  - phiên mới có máu bằng máu cũ sau cú cắn, đúng chỗ.

  **Trên HEAD:** join xong ngay, máu nguyên.
- **B3** `a faint in the window: the spot taken back is the campfire, with full health`: `player.hp = 1`, ép gồng cắn, `loseQuickly`. Mong đợi: ngất (`Fainted` thấy ở watcher), sau `letGo` thì điểm quay lại ở đống lửa với `PLAYER_MAX_HP`; vào lại đúng như vậy.
- **B4** `an honest lost place with nothing under way: same spot, same health, standing still`:
  - không có thú; `player.hp = 37`;
  - bọc `room.onReconnect` (spy gọi bản gốc rồi đặt `control.input = { x: 1, y: 0 }`: giả `Input` client gửi khi vừa nối lại);
  - `loseQuickly`.

  Mong đợi:
  - trong 1,5 s người chơi không dịch chuyển (`stopIntents` ở nhánh mất chỗ);
  - sau `letGo`, điểm quay lại có đúng `x, y` và `hp` bằng `player.hp` ngay trước khi xoá (≥ 37, vì tự hồi máu vẫn chạy khi chưa được bảo vệ);
  - vào lại đúng như vậy;
  - `canResume` là `false` sau khi đã dùng.
- **B5** `a fresh join of the same device while its held place is in the first 1.5 s waits for the shelter, so a blow under way lands on the old session first`:
  - trùm ép gồng dậm; `cutConnection(..., { realDelay: true })` mà không nối lại (`reconnection.enabled = false`);
  - ngay sau đó `connectTo(..., { token })`; một watcher thu tin `Damage`.

  Mong đợi: watcher thấy `Damage` của cú dậm nhắm `sessionId` cũ; join xong ở `>= dropAt + DROP_SHELTER_DELAY_MS - 50`; phiên cũ đã bị xoá; phiên mới ở chỗ xuất hiện, máu đầy (luật T3 không đổi).
- **B6** `/resume says yes while a lost place still stands, and only for that device`: sau `loseQuickly` và trước `letGo`, `canResume(token)` là `true`, token khác là `false`; sau `letGo` vẫn `true`; sau khi vào lại là `false`.
- **B7** `a world closing while a lost place still stands saves the player`: `player.wood = 77`; `loseQuickly`; trong 1,5 s gọi `await room.disconnect()`. Mong đợi: `db.load(token).resources.wood === 77`; một `connectTo` cùng token đang chờ (bắt đầu trước khi đóng) không treo: trong 3 s nó xong (rồi bị ngắt vì phòng đóng) hoặc bị từ chối. Test chỉ đòi kết thúc, không đòi kết quả nào.
- **B8** `the last player's lost place ends with the empty world held`: một người chơi, `loseQuickly`. Mong đợi: trong lúc đang rời, `room.state.players.size === 1`; sau `letGo` là 0 và `(room as any).emptyHold` có giá trị.
- **Test cũ:** A1-A3 (T24), T1-T6 (T25) và các test kết nối lại khác phải qua không đổi nghĩa. Chúng dùng `cutConnection` mặc định (`shelterDelayMs = 0`), nên `letGo` chạy ở nhịp kế tiếp, và `vi.waitFor(() => expect(room.state.players.size).toBe(0))` của A1 vẫn kịp.

### E2E

Không viết mới. Chạy lại như bước 7.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | bỏ dòng `lostPlaces.has` → `return` trong `onLeave` (xoá ngay như trước) | B1, B2, B3, B6 |
| M2 | ghi `noteResume` ngay trong `onDrop` (máu lúc mất chỗ) và `letGo` không ghi lại | B1, B3 |
| M3 | `onJoin` bỏ `await ... settled(...)` | B2, B5 |
| M4 | `onJoin` không đọc lại `liveSessions` sau khi chờ | B2 (phiên mới không lấy được điểm quay lại, hoặc `endSession` nhầm). Nếu sống sót thì ghi rõ và giải thích |
| M5 | `canResume` bỏ phần `lostPlaces` | B6 |
| M6 | `onDispose` không lưu người đang rời | B7 |
| M7 | `onDispose` không `closeAll` | B7 (join treo đến hết hạn) |
| M8 | nhánh mất chỗ không gọi `stopIntents` | B4 |
| M9 | `removePlayer` không `exposures.close` | B2 hoặc B5 treo, hoặc unit (ghi test nào bắt) |
| M10 | nhánh `Deferred` không `exposures.open` | B5 |
| M11 | `letGo` không `holdEmptyWorld` | B8 |
| M12 | `Exposures.settled` không lặp lại khi bị mở lại | unit "mở lại ngay sau close" |

### Chạy lặp

- describe `reconnecting after a dropped connection`: 10 lần, và 5 lần dưới tải 4 vòng lặp CPU;
- `exposure.test.ts`: 3 lần;
- `npm test`: 2 lần.

## Tài liệu

- **`docs/design/multiplayer.md`:**
  - dòng đầu thêm "T25b";
  - mục **Quay lại**, gạch về mất chỗ (T24): thêm "Lúc mất chỗ, nhân vật vẫn đứng trong thế giới 1,5 giây như mọi lần rớt (T25b): đòn đang gồng vẫn trúng, ngất thì về trại hoặc đống lửa. Chỗ và máu được nhớ là chỗ và máu sau khoảng đó. Vào lại sớm hơn thì chờ hết 1,5 giây đó." Và: "chỗ cũ được nhớ 20 giây kể từ lúc nhân vật rời thế giới";
  - mục **Đã cân nhắc và chấp nhận**, gạch "Cắt mạng để thoát một trận đánh": sửa câu T25 "ngắt rồi nối lại nhanh không né được gì" thành đúng cho mọi đường, kể cả mất chỗ giữa lúc nối lại và vào lại bằng token (T25b: lần vào lại chờ hết 1,5 giây của phiên cũ). Thêm: "Còn hở có chủ ý: rời chủ động (đóng tab, tải lại) hay mở tab thứ hai lúc đang online vẫn kết thúc phiên ngay; vào lại thì ở giữa bản đồ với máu đầy (từ T3, T23). Đổi lại mất chỗ đứng và vài giây tải trang";
  - mục **Phòng đủ 5 người**: một người lạ vào đúng 1,5 giây người khác đang rời sau khi mất chỗ thì có lúc 6 nhân vật, màu có thể trùng. Chấp nhận.
- **`docs/architecture.md`**, server, mục kết nối lại:
  - `lostPlaces` và `letGo` (nhánh mất chỗ đứng `shelterDelayMs` rồi mới xoá và ghi điểm quay lại);
  - `exposures` (`systems/exposure.ts`): ai mở, ai đóng; `onJoin` async chờ `settled` rồi đọc lại `liveSessions`;
  - `canResume` tính cả `lostPlaces`;
  - `onDispose` lưu người đang rời;
  - ở mục kiểm thử: helper `loseQuickly`, `lostAt`; `cutConnection(..., { realDelay: true })` đặt lại `DROP_SHELTER_DELAY_MS`.

## Tiêu chí hoàn thành

- [ ] `PROGRESS.md` ghi B1 và B2 hỏng trên HEAD `2db768c` (tái hiện cách né) và qua sau khi sửa.
- [ ] Nhánh mất chỗ của `onDrop`: dừng ý định, giữ `Player` trong thế giới (chưa `offline`) đến `letGo` sau `shelterDelayMs`; `letGo` ghi điểm quay lại theo trạng thái lúc đó rồi `removePlayer` (có `try/catch`) và `holdEmptyWorld` nếu trống. `onLeave` bỏ qua người đang rời.
- [ ] `onJoin` async: chờ `exposures.settled` của phiên cũ cùng token (ở bất kỳ phòng nào), đọc lại `liveSessions`, rồi `endSession`. Không bao giờ có hai bản cùng token trong state.
- [ ] `Exposures` có JSDoc và unit test; được mở/đóng đúng bảng ở Thiết kế 4. `onDispose` lưu người đang rời và `closeAll`.
- [ ] `canResume` trả `true` trong lúc đang rời.
- [ ] B1-B8 qua; A1-A3 (T24), T1-T6 (T25) và các test kết nối lại khác qua không đổi nghĩa; e2e `connection:` và `reconnect.spec.ts` qua.
- [ ] Bảng đột biến M1-M12 cho đúng kết quả (ghi rõ nếu M4 sống sót và vì sao).
- [ ] Không đổi client, schema, message, `Profile`, close code, route. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test` qua. Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi giao thức hay dữ liệu đã lưu, không xoá tính năng.

1. **`onJoin` async:** trong lúc chờ (≤ 1,5 s), lần vào đang giữ một chỗ của Colyseus. Một phòng đủ 5 người có thể từ chối người khác thêm tối đa 1,5 s. Chấp nhận.
2. **Cách giả mất chỗ phụ thuộc Colyseus 0.18** (tin đầu tiên của lần nối lại là `JOIN_ROOM`; socket đóng lúc `JOINING` thì gọi `onDrop`). Như T24: nếu Colyseus đổi, B1 hỏng ở chỗ nhận 4003, nghĩa là test báo chứ không im lặng.
3. **Người lạ vào đúng 1,5 s đó ở phòng đủ người** (6 nhân vật, màu trùng): chấp nhận (Thiết kế 6). Nếu reviewer muốn chặn, cách rẻ là để lần vào của người lạ cũng chờ `exposures` của mọi phiên đang rời khi `players.size >= MAX_PLAYERS`.

## Đề xuất cho `TASKS.md`

- **Mới, P3: "Tải lại hay mở tab thứ hai giữa trận thì hồi đầy máu"** (có từ T3, T23):
  - rời chủ động hoặc bị thay (tab thứ hai) đều xoá người chơi ngay: huỷ đòn đang gồng, và vào lại thì đầy máu ở giữa bản đồ;
  - đổi lại mất chỗ đứng và vài giây tải trang, nên kém hơn hẳn cách né T25/T25b;
  - hướng làm nếu muốn bịt: cho rời chủ động cũng đứng phơi `DROP_SHELTER_DELAY_MS` (cùng `lostPlaces`/`Exposures`), và ghi điểm quay lại cho mọi lần rời trong cùng thế giới. Đây là đổi luật T3/T23 (vào lại từ sảnh là phiên mới) nên cần game-designer xem lại.
- Góp ý 2, 4, 5 của review T25 vẫn để ngỏ; nên gộp vào một việc dọn nhỏ cho `combat.ts` và test T25.
