# PLAN: T32 Ăn quả mọng có hồi chiêu

## Mục tiêu

- **Vấn đề:** mỗi lần bấm "🫐 Ăn" (phím H) hồi 20 máu, không có hồi chiêu.
  - Bấm liên tục hồi 80-100 máu mỗi giây, gấp 2,5-10 lần sức đánh của bất kỳ trận nào. Ai có quả là đứng yên chịu đòn được, bỏ hẳn ý nghĩa của việc chỉnh sát thương ở T7 (`BALANCE.md`).
  - Trên điện thoại, nút "Ăn" còn **không chạm được**. Khi lập kế hoạch, tôi dựng lại trang với CSS thật của `index.html` trong Chromium: `elementFromPoint` ở tâm nút trả về `joystick-zone` ở cả 390×844 lẫn 844×390. Vùng cần điều khiển (nửa trái màn hình) được vẽ sau cột trái nên đè lên nút. Ăn bằng cảm ứng hiện không làm được.
- **Sau nhiệm vụ:**
  - Ăn xong phải chờ 4 giây. Ăn vẫn cứu nguy được (20 máu ngay), nhưng tối đa 5 máu mỗi giây, nên không thay được lướt né.
  - Nút "Ăn" hiện thời gian hồi giống ô chiêu: lớp tối thu dần và số giây.
  - Nút cao, rộng ít nhất 44 px và chạm được trên điện thoại. Bàn phím vẫn dùng H.

## Phạm vi

Làm:
- Thêm hằng số `EAT_COOLDOWN_MS` ở shared. Server kiểm hồi chiêu trong `eat()`.
- Báo cho client qua tin `Healed` có sẵn, thêm cờ `berry`.
- Nút "Ăn": cỡ 44 px, hiện hồi chiêu, nằm trên vùng cần điều khiển.
- Test tích hợp server và e2e. Cập nhật `docs/architecture.md`.
- Tài liệu thiết kế đã cập nhật trong lúc lập kế hoạch, coder không cần sửa:
  - `docs/design/hud.md`: mục "Nút 🫐 Ăn" và ghi chú vùng cần điều khiển;
  - `docs/design/pals.md`: mục "Hồi máu của người chơi";
  - `docs/design/multiplayer.md`: hồi chiêu khi nối lại.

KHÔNG làm:
- **Không đổi số cân bằng khác:** `BERRY_HEAL` (20), `REGEN_*`, giá bánh (8 quả), giáp, nguồn quả, máu người chơi giữ nguyên.
- **Không đổi schema, không đổi `Profile`.** Hồi chiêu không lưu.
- **Không thêm thông báo** cho lần bấm lúc đang hồi.
- **Không giới hạn tần suất** của các thông báo "Hết 🫐 quả mọng", "Máu đang đầy". Chúng đã như vậy từ trước.
- **Không đụng nút khác.**
  - 🔊, 🔗 Mời bạn và các nút bảng giữ nguyên cỡ và vị trí: phần đó là việc của T18.
  - Không đổi `.joystick-zone`, không chuyển nút "Ăn" sang chỗ khác.
- **Không thêm hook `debug:*`.**
- **Không đoán trước kết quả ăn ở client:** không hồi máu sẵn, không bắt đầu hồi chiêu trước khi server báo.
- **Không hiện số quả trên nút.** Bảng trạng thái đã có "🫐 N".

## Thiết kế

### 1. Con số: nhận đề xuất của balance-analyst

**`EAT_COOLDOWN_MS` = 4000, `BERRY_HEAL` = 20.** Tôi mô phỏng lại (người đứng yên, ăn ngay khi được và máu ≤ 80, bước 1 ms) và ra đúng các số trong `BALANCE.md`.

| Trận (1 thú, không giáp) | Sức đánh/giây | Sống khi không ăn | Ăn, chờ 4 s | Ăn, chờ 3 s |
|---|---|---|---|---|
| đồng cỏ, Emberpup 6 | 10,4 | 9,6 s | 17,3 s, 4 quả | 25 s, 8 quả |
| núi lửa, Boulderhorn 11 | 22,7 | 4,4 s | 6,2 s, 2 quả | 6,2 s |
| đầm lầy, Cactoad 11 | 15,6 | 6,4 s | 9,0 s, 2 quả | 10,3 s |
| trùm | 14,3 | 7,0 s | 11,2 s, 3 quả | 12,6 s |

Lý do chọn 4 giây:
- Ăn hồi tối đa 20 / 4 = 5 máu mỗi giây. Con số này thấp hơn sức đánh thấp nhất trong các trận đang có (10,4).
- Mặc giáp tốt nhất (giáp hiệp sĩ chặn 45%), trận đồng cỏ vẫn còn 5,7 > 5. Không trận nào "đứng yên ăn mãi" được.
- 3 giây: người né được một nửa số đòn trụ 51 giây trước Voltmouse đầu đàn (4 giây: 29 giây).
- 5 giây: chỉ bằng tự hồi (4 máu mỗi giây), ăn giữa trận gần như vô nghĩa.
- Nút chỉnh đã ghi trong `docs/design/pals.md`: thấy trùm quá khắc nghiệt thì hạ về 3000 trước khi đổi `BERRY_HEAL`.

### 2. Luật ở server (`eat()`)

**Thứ tự kiểm:**
1. hết quả: thông báo "Hết 🫐 quả mọng" (`refused`, như cũ);
2. đầy máu: "Máu đang đầy" (`refused`, như cũ);
3. đang hồi: **bỏ qua, không nói gì**;
4. ăn: trừ 1 quả, cộng máu, đặt hồi chiêu, phát tin `Healed` có `berry: true`.

Lý do thứ tự:
- Lý do nào thông báo giải thích được thì nói trước. Hồi chiêu đã hiện trên nút nên để cuối và im lặng.
- Test cũ còn nguyên ý nghĩa:
  - `GameRoom.test.ts:1152` ăn lúc đầy máu ra "Máu đang đầy";
  - e2e `:238` và `:1490` bấm lúc đầy máu, chưa ăn quả nào nên chưa có hồi chiêu.

**Lần bị từ chối không đặt lại hồi chiêu** (cả ba lý do). Chỉ quả đã ăn mới bắt đầu 4 giây chờ.
- Bấm lúc đầy máu rồi bị cắn ngay thì phải ăn được liền.
- Bấm dồn lúc đang hồi không được kéo dài thời gian chờ.

**Cho sớm một tick (`TICK_MS`, 50 ms).** Điều kiện từ chối là `now < nextEatAt - TICK_MS`.
- `this.clock.currentTime` chỉ nhích mỗi tick: Colyseus gọi `clock.tick()` trong vòng mô phỏng (`node_modules/@colyseus/core/build/Room.mjs:491-494`).
- Vì vậy lúc đặt và lúc kiểm, giờ có thể lệch tới gần 50 ms. Nếu không cho sớm, client đã chờ đủ đồng hồ của nó (nhất là trên localhost) vẫn có thể bị từ chối âm thầm.
- Gian lận được nhiều nhất 50 ms mỗi 4 giây (1,25%). `dash` cũng cho sớm như vậy (60 ms, `GameRoom.ts:874`).

**Lưu ở đâu: trường `nextEatAt` trong `PlayerControl`.** Đây chính là `Map` theo `sessionId` chỉ server dùng, cạnh `lastThrowAt` và `nextDashAt`. Không thêm `Map` mới, không đưa vào schema.
- Khởi tạo 0 ở `onJoin`.
- `removePlayer` đã `controls.delete(sessionId)`, nên dọn tự động khi rời phòng, hết giờ chờ nối lại hay bị phiên mới thay.
- **Kết nối lại (T3):**
  - `onDrop` và `onReconnect` không đụng tới trường này. Cùng phiên thì giữ nguyên `PlayerControl`, nên nối lại trong 4 giây vẫn phải chờ nốt.
  - `onDrop` xoá "việc đang làm" (đi, lướt, lệnh chiêu). Hồi chiêu không phải việc đang làm nên không xoá.
- **Vào lại từ sảnh** là phiên mới, không còn hồi chiêu. Chấp nhận được:
  - máu không lưu (`onJoin` đặt `hp = PLAYER_MAX_HP`), nên vào lại vốn đã đầy máu;
  - người chơi lại bắt đầu ở giữa bản đồ;
  - vào lại mất lâu hơn nhiều so với 4 giây.

### 3. Báo cho client: tin `Healed` có cờ `berry`

Ăn được thì server `broadcast` `HealedMessage { targetType: "player", targetId, amount, berry: true }`.
- `amount` là máu thật sự hồi, tối thiểu 1. Ví dụ 90 máu ăn thì là 10.
- Client nhận tin của chính mình thì bắt đầu đếm `EAT_COOLDOWN_MS` (lấy từ shared). Nút đếm từ lúc tin tới nên không bao giờ sẵn sàng sớm hơn server.
- Đây đúng mẫu thanh chiêu đang dùng: `SkillCast` → `skillBar.started` (`Game.ts:1221`).
- Được thêm, không tốn gì: handler `Healed` có sẵn (`Game.ts:773-779`) vẽ chớp xanh, "+N ❤" và tiếng hồi máu. Hiện ăn quả không có phản hồi nào ngoài thanh máu. Người ở gần cũng thấy "+20 ❤".
- Chiêu hồi máu giữ nguyên, không có trường `berry`. Test `:733` dùng `toMatchObject` nên không ảnh hưởng.

Không chọn:
- **Trường mới trong schema `Player`:** giờ server không có nghĩa ở client.
  - Muốn dùng phải là "còn bao nhiêu ms", đổi mỗi tick và gửi theo patch cho cả 5 người; hoặc thêm cách đồng bộ giờ.
  - Lại đổi giao thức nặng hơn.
- **Client tự đoán khi thấy máu hay quả đổi:** máu còn đổi vì tự hồi và chiêu hồi máu; quả còn đổi vì hái, rương, nhiệm vụ, chế tạo. Đoán sai.

### 4. Bấm lúc đang hồi: im lặng, nút lắc nhẹ

Client không gửi tin khi đồng hồ của nó còn chạy. Nút lắc (dùng lại keyframes `skill-nope` của thanh chiêu), **không có thông báo**. Server, nếu vẫn nhận tin, bỏ qua im lặng.

Lý do:
- Số giây trên nút đã nói vì sao không ăn được.
- Lúc nguy cấp người chơi bấm dồn. Mỗi lần bấm một thông báo mức thấp thì ô thứ hai của hàng đợi bị thay liên tục, làm khó đọc tin khác (luật T6). Nút lướt và ô chiêu đang hồi cũng im lặng.
- Test toasts (`multiplayer.spec.ts:1490`) bấm `h` lúc đầy máu và chưa ăn quả nào nên không đi qua nhánh này. Nhánh im lặng không thêm thông báo nào cho các test đếm thông báo.

Không dùng thuộc tính `disabled`:
- Nút bị khoá thì nuốt cú chạm mà không có phản hồi (không lắc được), và mất focus.
- Dùng class `cooling` cùng `aria-disabled="true"`.
- **Lưu ý cho test:** Playwright coi `aria-disabled="true"` là đang khoá. `tap()` hay `click()` vào nút lúc đang hồi sẽ chờ tới khi hết hồi. Muốn thử bấm lúc đang hồi thì bấm ngay trong trang (mục Test).

### 5. Nút "🫐 Ăn" trên HUD

**Cấu trúc:**

```html
<button class="eat-btn"><span class="eat-label">🫐 Ăn</span><span class="eat-cd"></span><span class="eat-secs"></span></button>
```

- `.eat-cd`: lớp tối, nằm tuyệt đối dưới đáy nút. Chiều cao bằng phần trăm thời gian còn lại, thu dần từ trên xuống.
- `.eat-secs`: số giây còn lại (4, 3, 2, 1) ở giữa nút; rỗng khi sẵn sàng.
- Khi đang hồi: nút có class `cooling` và `aria-disabled="true"`, chữ "🫐 Ăn" mờ đi (opacity 0,4).
- Chữ trên nút giữ "🫐 Ăn". Số giây là lớp phủ nên bề ngang nút không đổi: hàng máu ở điện thoại ngang không được xuống dòng thêm.
- `title`: `Ăn 1 quả mọng: hồi ${BERRY_HEAL} máu, rồi chờ ${EAT_COOLDOWN_MS / 1000} giây mới ăn tiếp (phím H)`, tức "Ăn 1 quả mọng: hồi 20 máu, rồi chờ 4 giây mới ăn tiếp (phím H)".

**Cỡ và chỗ.** Nút ở nguyên trong hàng máu.
- `min-width: 44px; min-height: 44px` ở mọi khung hình. Bỏ `min-height: 28px` của nút "Ăn" trong khối `@media (max-width: 600px)`; 🔊 giữ 28 px.
- `position: relative; z-index: 1; overflow: hidden`.
  - Nút được định vị và có z-index dương trong lớp xếp chồng của `.hud` (`.hud-left` không tạo lớp riêng), nên nằm trên `.joystick-zone` (z auto, vẽ sau).
  - Nút vẫn dưới các bảng (3), thông báo (4), hộp thả thú (5) và màn mất kết nối (6).
- Đo bằng trang dựng lại với CSS thật trong Chromium (script chỉ đọc trong scratchpad):

| Khung hình | Nút hiện tại | Nút sau khi đổi | Hàng máu cao | Tâm nút trúng |
|---|---|---|---|---|
| 1280×720 | 54×30 | 54×44 | 65 → 79 px | nút (trước cũng vậy) |
| 390×844 | 46×28 | 46×44 | 56 → 72 px | nút (trước: `joystick-zone`) |
| 844×390 | 54×30 | 54×44 | 73 → 87 px | nút (trước: `joystick-zone`) |

- 🔊 và 🔗 Mời bạn vẫn bị `joystick-zone` che trên điện thoại: đề xuất việc mới ở cuối.

**Ảnh hưởng tới vị trí thông báo** (thông báo nằm dưới cột):
- Desktop: thông báo dời xuống 14 px.
- Điện thoại dọc: dời 16 px. T6 đo y 185-311, thành khoảng 201-327, vẫn trên nhãn tên mình ở y 362.
- Điện thoại ngang: dời 14 px. T6 đo đáy thông báo 230, thành khoảng 244, giới hạn là `innerHeight − 140` = 250. Chỉ còn 6 px.
- **Phương án dự phòng** (chỉ dùng nếu e2e `toasts (phone sideways)` hỏng ở kiểm tra đáy): trong khối `@media (max-height: 520px) and (min-width: 601px)`, đổi `.hud-health` padding `4px 8px` thành `0 8px`. Đo được: hàng còn 79 px, tức chỉ tăng 6 px; đáy khoảng 236.
- Không nới giới hạn 140 px. Đây đúng hướng T18 đã ghi.

**Đồng hồ ở client** (trong `Hud`, đếm theo `performance.now()`):
- `eatStarted(ms)`: lưu thời điểm sẵn sàng và tổng thời gian hồi.
- `eatReady(now)`: so trực tiếp với giờ, không dựa vào class. Khung hình chậm vẫn đúng.
- `refuseEat()`: lắc nút.
- `tickEat(now)`: gọi mỗi khung hình.
  - Chỉ ghi DOM khi phần trăm (số nguyên) hoặc số giây đổi. Không tạo object mỗi khung hình.
  - Lúc nghỉ thì không làm gì.

Không gộp với `SkillBar.tick`: vòng đời khác nhau (thanh chiêu đổi theo thú đi theo, nút Ăn thì cố định), phần lặp chỉ vài dòng.

### 6. Không chọn (tóm tắt)

| Phương án | Vì sao không |
|---|---|
| Thông báo "Chưa ăn được, chờ N giây" | ngập ô thông báo khi bấm dồn; nút đã hiện số giây |
| Lần bị từ chối cũng đặt lại hồi chiêu | phạt người bấm lúc đầy máu rồi bị cắn; bấm dồn tự kéo dài thời gian chờ |
| `Map` riêng cho hồi chiêu ăn | `PlayerControl` đã là `Map` theo phiên và được dọn sẵn |
| Chuyển nút Ăn xuống cụm nút cảm ứng | đổi bố cục lớn, đụng thanh chiêu và nút bóng; để T18 xem |
| `.joystick-zone { z-index: -1 }` (sửa cả cột một lần) | đổi cách chạm của cả cột; thuộc T18 |
| Thêm `debug:hurt` cho e2e | không cần: tuyết ban ngày làm mất 2 máu mỗi 2 giây, tất định (mục Test) |

## Kế hoạch triển khai

Số dòng theo HEAD `1c3a1c5`. Chú thích code bằng tiếng Anh.

1. **`packages/shared/src/combat.ts`**, ngay sau `BERRY_HEAL` (dòng 28-29):

   ```ts
   /**
    * After a berry is eaten, the next one waits this long (ms). Eating then heals 5 a second at most, less than
    * any region's strongest common wild pal deals (10-23 a second), so it saves a fight but never replaces
    * dodging (BALANCE.md of T32, docs/design/pals.md).
    */
   export const EAT_COOLDOWN_MS = 4000;
   ```

2. **`packages/shared/src/messages.ts`:**
   - chú thích của `Healed` (dòng 108) thành `/** Someone got health back: a heal skill, or a player ate a berry. */`;
   - thêm vào `HealedMessage` (dòng 203-207):

     ```ts
     /** A berry the player ate (ClientMessage.Eat), not a skill: the eater's Ăn button recharges for EAT_COOLDOWN_MS. */
     berry?: boolean;
     ```

3. **`packages/server/src/rooms/GameRoom.ts`:**
   - Import `EAT_COOLDOWN_MS` (cạnh `BERRY_HEAL`, dòng 108). `TICK_MS` và `HealedMessage` đã import sẵn.
   - `PlayerControl` (dòng 201-218) thêm:

     ```ts
     /** When the next berry may be eaten (clock ms): EAT_COOLDOWN_MS after the last one eaten; a refused try leaves it. */
     nextEatAt: number;
     ```

   - `onJoin` (dòng 519-522): thêm `nextEatAt: 0` vào object của `controls.set`.
   - Thay `eat()` (dòng 1118-1126):

     ```ts
     /**
      * Eats one berry: BERRY_HEAL health at once, then EAT_COOLDOWN_MS before the next, so eating cannot outheal a
      * fight. What a notice can explain is refused first (no berries, full health); a try while the last berry still
      * recharges is dropped without a word (the Ăn button shows the countdown). Only a berry eaten starts the wait.
      */
     private eat(client: Client) {
       const player = this.state.players.get(client.sessionId);
       const control = this.controls.get(client.sessionId);
       if (!player || !control) return;
       if (player.berries <= 0) return this.notify(client, "Hết 🫐 quả mọng", "refused");
       if (player.hp >= player.maxHp) return this.notify(client, "Máu đang đầy", "refused");
       const now = this.clock.currentTime;
       // One tick early is let through: the clock only moves once a tick, and a client that waited out its countdown must not be refused.
       if (now < control.nextEatAt - TICK_MS) return;
       control.nextEatAt = now + EAT_COOLDOWN_MS;
       const before = player.hp;
       player.berries -= 1;
       player.hp = Math.min(player.maxHp, player.hp + BERRY_HEAL);
       const message: HealedMessage = { targetType: "player", targetId: client.sessionId, amount: Math.max(1, Math.round(player.hp - before)), berry: true };
       this.broadcast(ServerMessage.Healed, message);
       this.scheduleSave(client.sessionId);
     }
     ```

   - Không sửa `onDrop`, `onReconnect`, `removePlayer`.

4. **`packages/client/src/ui/hud.ts`:**
   - Import `BERRY_HEAL`, `EAT_COOLDOWN_MS`.
   - Dựng nút như mục 5 (thay dòng 38-43).
   - Lưu sẵn tham chiếu `eatButton`, `.eat-cd`, `.eat-secs` vào trường; không `querySelector` mỗi khung hình. Listener `click` vẫn gọi `actions.eat`.
   - Thêm các trường:
     - `eatUntil` (0 = sẵn sàng);
     - `eatTotal`;
     - `eatPercent`, `eatSecsShown`: giá trị đang hiện, để chỉ ghi DOM khi đổi.
   - Thêm các hàm, mỗi hàm có JSDoc:
     - `eatStarted(ms: number)`: `eatUntil = performance.now() + ms; eatTotal = ms`.
     - `eatReady(now: number): boolean`: trả `now >= eatUntil`.
     - `refuseEat()`: bỏ rồi thêm lại class `nope`, có `void offsetWidth` ở giữa (như `SkillBar.nope`).
     - `tickEat(now: number)`, theo thứ tự:
       - `left = max(0, eatUntil − now)`;
       - `percent = left > 0 ? ceil(left / eatTotal × 100) : 0`;
       - `secs = ceil(left / 1000)`;
       - percent đổi thì ghi `style.height`;
       - secs đổi thì ghi chữ số giây (rỗng khi 0), bật/tắt class `cooling`, đặt hoặc bỏ `aria-disabled="true"`.

5. **`packages/client/src/game/Game.ts`:**
   - Import `EAT_COOLDOWN_MS`.
   - Thêm hàm:

     ```ts
     /** Eats a berry (key H or the Ăn button) once the button has recharged; the server checks again and decides. */
     private eat() {
       if (!this.watch.online) return;
       if (!this.hud.eatReady(performance.now())) return this.hud.refuseEat();
       this.send(ClientMessage.Eat);
     }
     ```

   - `eat:` của `Hud` (dòng 268) và phím `h:` (dòng 306) đều gọi `this.eat()`.
   - Handler `Healed` (dòng 773): dòng **đầu tiên**, trước `return` theo khoảng cách:

     ```ts
     // A berry this player ate: the Ăn button recharges, counted from now (after the server), so it is never ready first.
     if (msg.berry && msg.targetType === "player" && msg.targetId === this.room.sessionId) this.hud.eatStarted(EAT_COOLDOWN_MS);
     ```

   - `frame()`: thêm `this.hud.tickEat(now);` ngay sau `this.hud.tickToasts(now);` (dòng 964).

6. **`packages/client/index.html` (CSS):**
   - Thay rule `.eat-btn` ở dòng 90 bằng:

     ```css
     /* The Ăn button (T32): a touch target on every screen, above the joystick's half of the screen (drawn after the HUD
        column on phones; the column's other buttons are T18). Recharging after a berry: a dark sweep that shrinks and the
        seconds left, like the skill buttons. */
     .eat-btn { position: relative; z-index: 1; overflow: hidden; min-width: 44px; min-height: 44px; border: none; border-radius: 8px;
       padding: 4px 8px; font-weight: 600; background: #7e57c2; color: #fff; cursor: pointer; }
     .eat-btn .eat-cd { position: absolute; left: 0; right: 0; bottom: 0; height: 0; background: rgba(0,0,0,0.55); pointer-events: none; }
     .eat-btn .eat-secs { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;
       font-size: 18px; font-weight: 800; text-shadow: 0 1px 3px #000; }
     .eat-btn.cooling .eat-label { opacity: 0.4; }
     .eat-btn.nope { animation: skill-nope 0.3s; }
     ```

   - Dòng 322, khối `@media (max-width: 600px)`: tách thành
     - `.eat-btn, .sound-btn { padding: 2px 6px; font-size: 12px; }`
     - `.sound-btn { min-height: 28px; }`

     Nút "Ăn" giữ 44 px từ rule gốc.

7. **`packages/server/src/rooms/GameRoom.test.ts`:** 5 test ở mục Test. Import thêm `EAT_COOLDOWN_MS`.

8. **`tests/e2e/multiplayer.spec.ts`:** test mới cùng phần thêm vào vòng `TOAST_SCREENS`, ở mục Test.

9. **`docs/architecture.md`:**
   - dòng `combat.ts`: thêm "quả mọng (`BERRY_HEAL` 20, chờ `EAT_COOLDOWN_MS` 4000 giữa hai lần ăn)";
   - đoạn `rooms/GameRoom.ts`: chữ "quả mọng" thành "quả mọng (`eat`: hồi chiêu ở `PlayerControl.nextEatAt`, cho sớm một tick)";
   - mục client, `hud.ts`: thêm "nút 🫐 Ăn có hồi chiêu".

10. **Tự kiểm trước khi giao tester:**
    - chạy `npm run typecheck`, `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "eating"`;
    - chạy `npx playwright test -g "toasts \(phone sideways\)"`. Hỏng ở `toast.bottom <= height - 140` thì áp dụng phương án dự phòng ở mục 5 rồi chạy lại.

## Giao thức

- **`messages.ts`:** `HealedMessage.berry?: boolean` (trường tùy chọn).
  - Server mới phát thêm `Healed` mỗi lần ăn được.
  - Client cũ bỏ qua trường mới, vẫn hiện "+N ❤".
  - Client mới cần tin này để hiện hồi chiêu. Server và client đổi trong cùng nhiệm vụ, deploy cùng một container.
- **`schema.ts`:** không đổi.
- **`Profile`:** không đổi. Hồi chiêu không lưu, hồ sơ cũ không ảnh hưởng.
- **Hằng số mới dùng chung:** `EAT_COOLDOWN_MS` (shared, client và server cùng import).

## Test

**Unit (shared):** không thêm. Không có logic dùng chung mới, chỉ một hằng số. Luật nằm ở `GameRoom.eat()` và được test tích hợp bên dưới.

**Tích hợp server** (`GameRoom.test.ts`):
- Mọi test bắt đầu bằng `room.state.pals.clear()` để không bị cắn.
- Tên test bắt đầu bằng "eating" để lọc được bằng `-t "eating"`. Test cũ "eating a berry heals; health regenerates after a pause" cũng khớp.

Test A, B, C đặt trong `describe("eating berries")` mới, ngay sau `describe("party and companions")` (dòng 612). Test D, E đặt trong `describe("reconnecting after a dropped connection")` (dùng `holdReconnect`, `cutConnection`, `reconnected`), E cạnh hai test "one device, one player" (dòng 2207).

- **A. "eating: a second berry right away is refused quietly and kept, and goes down once the wait is over"**
  - Đặt `hp = 20`, `berries = 3`. Ghi lại `Healed` (lọc `targetType === "player"`) và `Notice`.
  - Ăn, chờ 2 tick:
    - `berries` 2;
    - đúng một `Healed` bằng `{ targetType: "player", targetId: sessionId, amount: BERRY_HEAL, berry: true }`;
    - đọc `readyAt = (room as any).controls.get(sid).nextEatAt`; kiểm `readyAt − clock.currentTime` nằm trong (`EAT_COOLDOWN_MS − 500`, `EAT_COOLDOWN_MS`].
  - Ăn ngay lần nữa. Lặp `ticks(room, 1)` tới khi `clock.currentTime >= readyAt − 500`, rồi ăn lần nữa. Kiểm:
    - `berries` vẫn 2, vẫn một `Healed`;
    - **không có `Notice` nào**;
    - `nextEatAt` vẫn bằng `readyAt`.
  - Lặp tới khi `clock.currentTime >= readyAt`, rồi ăn. Kiểm `berries` 1 và hai `Healed`.
  - Chạy khoảng 4,3 giây. Máu tự hồi chỉ làm máu tăng, vẫn dưới 100.
- **B. "eating: only a berry eaten starts the wait; no berries and full health are said first, even while it runs"**
  - Các bước, mỗi bước gửi `Eat` rồi `ticks(room, 2)`:
    1. `berries = 0`, đầy máu: thông báo cuối là "Hết 🫐 quả mọng" (hết quả được kiểm trước đầy máu);
    2. `berries = 2`, đầy máu: "Máu đang đầy";
    3. `hp = 50`: ăn được ngay (`berries` 1, một `Healed`), vì hai lần trước không đặt hồi chiêu.
  - Trong lúc đang hồi:
    4. `hp = maxHp`: "Máu đang đầy";
    5. `berries = 0`, `hp = 50`: "Hết 🫐 quả mọng";
    6. `berries = 1`: không thông báo mới, không ăn, `nextEatAt` không đổi.
  - Cả test chạy dưới 1 giây, nằm gọn trong 4 giây hồi.
- **C. "eating: each player has their own wait, and everyone near sees the berry heal"**
  - Hai người, mỗi người `hp = 50`, `berries = 2`. A ăn, rồi B ăn ngay sau: cả hai còn 1 quả.
  - Client của B nhận được `Healed` của A (`targetId` là A, `berry: true`).
- **D. "eating: the wait carries over a dropped connection (same player, still waiting)"**
  - Ăn (`hp = 40`, `berries = 3`), rồi đặt `control.nextEatAt = clock.currentTime + 60_000` (đủ dài dù rớt và nối lại mất bao lâu).
  - `holdReconnect`, `cutConnection`, chờ `offline`. Kiểm `nextEatAt` không đổi.
  - Nối lại (`reconnected`, `letGo`). Kiểm:
    - `controls.get(sid)` vẫn là chính object đó;
    - ăn bị từ chối (`berries` vẫn 2).
  - Đặt `control.nextEatAt = clock.currentTime`, ăn: `berries` 1.
- **E. "eating: a new session of the same device starts without a wait (and at full health: health is not saved)"**
  - Chuẩn bị như test ở dòng 2207: `useStore(new SqliteStore(":memory:"))`, token `"eat-token-0123456789abcd"`.
  - Ăn (`hp = 40`, `berries = 3`), rồi `connectTo(room, { name: "Tester", token })`. Kiểm:
    - phiên cũ không còn trong `state.players` và `controls`;
    - người chơi mới có `hp === PLAYER_MAX_HP`, `berries === 2`.
  - Đặt `hp = 40`, ăn ngay: `berries` 1.
- **Test cũ phải qua mà không sửa:**
  - "eating a berry heals; health regenerates after a pause" (dòng 599);
  - "every notice says what it is about" (dòng 1152);
  - "water companions heal a hurt owner" (dòng 727).

**E2E** (`tests/e2e/multiplayer.spec.ts`):

- **Test mới, đặt ngay sau "HUD shows health..." (dòng 240):** `"eating: the Ăn button recharges after a berry, and a press while it recharges sends nothing"`, có `test.slow()`.
  1. `join(browser, "Đói", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })`, `waitForWorld`, chờ `frames > 0`.
  2. `.eat-btn` có `boundingBox()` rộng và cao ≥ 44.
  3. Gửi `debug:give` (+50 quả), rồi `debug:teleport { x: 2440, y: 1760 }`. Poll (tối đa 15 s) tới khi `berries >= 50` và `hp < maxHp`. Ghi `berries`.
     - Chỗ này tính bằng `defaultWorld()` và `biomeAt`: tuyết, cả vòng 120 px quanh đều là tuyết, cách hang thú đầu đàn gần nhất 942 px (`ALPHA.sight` 170), không rương nào trong 150 px.
     - Tuyết ban ngày lạnh, mất 2 máu mỗi 2 giây (`climateHazard`). Vùng tuyết không có loài hung dữ: Frostfang và Pebblet tự vệ, Mothlume chỉ ra ban đêm. Phòng mới luôn bắt đầu ban ngày.
  4. `eat.tap()` (lần chạm thật này kiểm luôn rằng nút không bị che). Kiểm:
     - poll `berries` thành `berries − 1`;
     - `eat` có class `/cooling/`;
     - `.eat-secs` khớp `/^[1-4]$/`.
  5. Thử bấm lúc đang hồi, **trong một lần `page.evaluate` chạy liền một mạch** để đồng hồ không kịp hết giữa chừng:
     - tạm bọc `room.send` để ghi loại tin;
     - đọc `cooling`;
     - `window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }))`, rồi `keyup`;
     - `button.click()`;
     - trả `room.send` lại như cũ;
     - trả về `{ cooling, sent }`.

     Kiểm kết quả bằng `{ cooling: true, sent: [] }`, và `shownToasts(page)` nối lại không khớp `/quả mọng|Máu đang đầy/`. Không dùng `tap()` ở bước này (xem `aria-disabled`, mục 4).
  6. Chờ hết hồi:
     - `expect(eat).not.toHaveClass(/cooling/, { timeout: 10_000 })`, `.eat-secs` rỗng;
     - poll `hp < maxHp` (lạnh vẫn trừ máu);
     - `page.keyboard.press("h")`;
     - poll `berries` thành `berries − 2`;
     - `eat` lại có `/cooling/`.
- **Thêm vào vòng `TOAST_SCREENS`** (test `toasts (${screen.name})`, sau vòng kiểm `layout.toasts` ở dòng 1425-1431, trước khối `phone sideways`). Cùng trang đó, ở cả 3 khung hình:
  - `.eat-btn` rộng và cao ≥ 44;
  - `elementFromPoint` ở tâm nút có `closest(".eat-btn")`, tức nút nằm trên cùng.

  Vì sao đặt ở đây: các test này đã mở đủ 3 khung hình và đo đúng phần bị ảnh hưởng (cột cao thêm đẩy thông báo xuống), nên không tốn thêm lần tải trang nào.
- **Test cũ phải qua mà không sửa:**
  - "HUD shows health, time of day and lets you eat berries" (dòng 238): 0 quả ra "Hết 🫐 quả mọng", khớp regex;
  - test toasts hàng đợi (dòng 1490): `h` lúc đầy máu, chưa ăn quả nào;
  - test kết nối lại (dòng 1102): `h` lúc mất mạng, không gửi gì, vì `Game.eat()` kiểm `watch.online` trước tiên;
  - 3 test bố cục toasts, kể cả `phone sideways` với đáy thông báo ≤ `innerHeight − 140`.

**Tester chạy:**
1. `npm run typecheck`, `npm test`, `npm run build`.
2. `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "eating"`, lặp 3 lần.
3. `npx playwright test -g "eating: the Ăn button" --repeat-each=5 --workers=1`: 5/5.
4. `npx playwright test -g "toasts"`: 4 test toasts.
5. `npm run test:e2e`: cả bộ qua (thêm 1 test so với trước).

## Tiêu chí hoàn thành

- [ ] `EAT_COOLDOWN_MS = 4000` ở `combat.ts`, có JSDoc. `BERRY_HEAL` vẫn 20. Không hằng số cân bằng nào khác đổi.
- [ ] `eat()` kiểm theo thứ tự hết quả, đầy máu, hồi chiêu.
  - Hồi chiêu dùng `now < nextEatAt - TICK_MS` và bỏ qua không thông báo.
  - Chỉ lần ăn được mới đặt `nextEatAt = now + EAT_COOLDOWN_MS`.
  - Ăn được thì `broadcast` `Healed` với `berry: true` và lượng máu hồi thật (tối thiểu 1).
- [ ] Hồi chiêu nằm ở `PlayerControl.nextEatAt`.
  - Không thêm `Map`, không thêm trường schema, không đổi `Profile`.
  - Khởi tạo 0 ở `onJoin`.
  - `onDrop`, `onReconnect` không đụng tới; `removePlayer` dọn qua `controls.delete`.
- [ ] `HealedMessage.berry?` có JSDoc. Chiêu hồi máu không gửi `berry`.
- [ ] Client:
  - nút và phím H cùng đi qua `Game.eat()`;
  - đồng hồ còn chạy thì không gửi, nút lắc, không thông báo;
  - đồng hồ bắt đầu khi nhận `Healed` có `berry` của chính mình;
  - `tickEat` không tạo object mỗi khung hình và chỉ ghi DOM khi giá trị đổi.
- [ ] Nút `.eat-btn`:
  - ≥ 44×44 và nằm trên cùng tại tâm nút ở 1280×720, 390×844, 844×390;
  - lúc đang hồi có `cooling`, `aria-disabled="true"`, `.eat-secs` đếm 4..1;
  - `title` đúng chữ ở mục 5;
  - không dùng thuộc tính `disabled`.
- [ ] `.sound-btn`, `.invite-btn`, `.joystick-zone` không đổi.
- [ ] 5 test tích hợp mới qua, 3 test cũ nêu trên qua mà không sửa.
- [ ] E2E mới qua 5/5 khi lặp. 3 test bố cục toasts qua kèm kiểm tra nút Ăn. Cả bộ e2e qua. Typecheck, unit, build qua.
- [ ] `docs/architecture.md` cập nhật như bước 9.

## Rủi ro, câu hỏi mở

- **Đáy thông báo ở điện thoại ngang chỉ còn 6 px** (khoảng 244 so với giới hạn 250). Đã có phương án dự phòng đo sẵn (padding hàng máu, xuống khoảng 236) và bước tự kiểm 10.
- **Mạng chậm:**
  - lớp tối hiện trễ một khoảng bằng thời gian đi về của tin;
  - lần bấm thứ hai trong lúc đó bị server bỏ qua, không mất quả;
  - mất tin `Healed` vì rớt mạng đúng lúc ăn thì nút có thể hiện "sẵn sàng" trong khi server còn chờ (tối đa 4 giây): lần bấm đó không có tác dụng, lần sau ăn được. Chấp nhận.
- **Máu lẻ:** máu có thể lẻ một phần mười do tự hồi. Ăn ở 99,8 máu tốn một quả cho "+1 ❤" và bắt đầu hồi chiêu. Đây là hành vi cũ, chỉ thêm 4 giây chờ. Hiếm vì tự hồi lên tới 100 rất nhanh.
- Không có quyết định nào cần người dùng; **không có dòng CHẶN**.
- **Đề xuất việc mới cho `TASKS.md`:**
  - **(P1, mới) Trên điện thoại, vùng cần điều khiển che các nút ở cột trái.**
    - `.joystick-zone` (nửa trái, `pointer-events: auto`) được vẽ sau `.hud-left`. Đo bằng `elementFromPoint` khi lập kế hoạch T32: tâm 🔊 và 🔗 Mời bạn đều trả `joystick-zone` ở 390×844 và 844×390.
    - Người chơi điện thoại không tắt được âm thanh và không mời bạn bằng nút được: trên điện thoại, bảng trạng thái chỉ có nút mời, không có link.
    - Gợi ý: cho `.joystick-zone` `z-index: -1` trong lớp HUD (cột và mọi nút nằm trên, chỗ trống vẫn bật cần điều khiển), hoặc nâng từng nút như nút Ăn. E2E chạm thật bằng `tap()` ở hai khung hình điện thoại. Có thể gộp vào T18.
  - **Cập nhật ghi chú T18:**
    - nút Ăn đã 44×44 và nằm trên vùng cần điều khiển (T32);
    - hàng máu ở điện thoại ngang đã cao 87 px (nếu dùng phương án dự phòng thì 79), đáy thông báo khoảng 244 so với giới hạn 250;
    - khi nâng 🔊 lên 44 px:
      - ở 390×844, 🔊 nằm cùng dòng 2 với nút Ăn (đã 44 px), nên hàng không cao thêm;
      - ở 844×390, 🔊 nằm một mình ở dòng 2 (đo được: nút Ăn ở dòng 1, x = 214; 🔊 ở dòng 2, x = 20). Nâng 🔊 làm hàng cao thêm 14 px, đáy thông báo khoảng 258 > 250. Phải thu gọn hàng cùng lúc, ví dụ đưa 🔊 lên dòng 1, hoặc bỏ padding dọc của hàng. Đo lại bằng e2e `toasts (phone sideways)`.
