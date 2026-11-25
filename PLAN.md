# PLAN: T25 Né đòn bằng cách ngắt rồi nối lại mạng liên tục

Code đọc ở `843047c` ("Mark T24 done, add T90, start T25"; mã T24 ở `35e43ab`). Nguồn:
- dòng T25 trong `TASKS.md`; góp ý 1 trong `REVIEW.md` của T3 (`80a70ea`);
- `packages/server/src/rooms/GameRoom.ts` (`onDrop`, `onReconnect`, `onLeave`, `removePlayer`, `endSession`, `isEmpty`, các trường `holds`, `reconnectGraceMs`, `resumes`);
- `systems/combat.ts` (`sheltered`, `targetPos`, `wildTarget`, `damage`, `calmPalsTargeting`, `windUp`, `cancelWindup`, `strike`, `tickRegen`), `systems/movement.ts` (AI thú hoang và trùm, thú đi theo), `systems/world.ts` (rương, khí hậu), `systems/leaders.ts` (`bossStomp`), `systems/saving.ts`;
- `packages/shared/src/constants.ts`, `combat.ts` (`WILD_WINDUP_MS`), `boss.ts` (`BOSS`), `alphas.ts` (`ALPHA`), `skills.ts` (`skillTravelMs`, `skillReach`), `data/skills.json`;
- `GameRoom.test.ts` (describe `reconnecting after a dropped connection`, helper `cutConnection`, `holdReconnect`, `reconnected`, `holdsOf`, `steadyClock` của T22, test A1-A4 của T24);
- `tests/e2e/multiplayer.spec.ts` và `reconnect.spec.ts` (chỉ đọc, để chắc không test nào phụ thuộc vào việc được bảo vệ ngay lúc rớt);
- mã nguồn `@colyseus/core` 0.18.18 (`Room.setTimestep`: `clock.tick()` chạy hẹn giờ trước callback mô phỏng trong cùng một nhịp).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Chỉ đổi server, shared và test. Client không đổi, nên không có e2e mới.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Không chạy `git stash`.

## Mục tiêu

Hiện tại, ngay khi socket đóng, `onDrop` bảo vệ người chơi:
- đặt `offline`, nên `sheltered` chặn mọi sát thương và mọi việc nhắm vào họ;
- gọi `calmPalsTargeting`: xoá `wildAggro`, tức xoá luôn cú cắn hay cú dậm đang gồng (trạng thái gồng nằm trong `aggro.windupUntil`).

SDK nối lại sau khoảng 200-400 ms. Gọi `__petgame.room.connection.close(4010)` lặp lại thì đòn của thú hoang, thú đầu đàn và trùm không bao giờ trúng: một nút "bất tử" không có hồi chiêu.

Sau T25, **rớt mạng chỉ được bảo vệ khi kéo dài quá 1,5 giây.** Trong 1,5 giây đầu, người chơi vẫn ở trong thế giới như người bỏ tay khỏi máy: đứng yên, đòn đang gồng vẫn trúng, thú hoang vẫn đánh. Nối lại trong khoảng đó thì không có gì được xoá. Người chơi thật với mạng di động kém vẫn được bảo vệ y như T3 khi mất mạng thật: chậm hơn 1,5 giây, mà một lần mất mạng im lặng thì server vốn đã chỉ biết sau 6-9 giây qua ping.

## Chọn cách

| | (1) Chỉ bảo vệ khi rớt quá 1,5 s | (2) Rớt lại trong N s sau một lần nối lại thì không bảo vệ |
|---|---|---|
| Lần né đầu tiên | không né được: đòn đang gồng vẫn trúng | **vẫn né được** một lần mỗi N giây |
| Người chơi thật mạng chập chờn | mất mạng thật (> 1,5 s) lúc nào cũng được bảo vệ | lần mất mạng thật **thứ hai** trong N giây bị bỏ mặc suốt 20 s chờ: đúng người cần bảo vệ nhất lại không được |
| Trạng thái thêm | không: so `holds.get(sid) === hold` lúc hẹn giờ chạy | mốc nối lại cuối của mỗi phiên, xoá khi rời |
| Hợp với T24 | không đụng nhánh mất chỗ (điểm quay lại) | như (1) |

**Chọn (1).** Cách (2) vẫn để lại một lần né miễn phí mỗi N giây, và phạt nhầm người mạng xấu thật. Cách (1) bịt hẳn cách né mà chỉ làm người chơi thật chịu thêm tối đa 1,5 giây đứng yên. Không ghép cả hai: (1) đã đủ (xem Thiết kế 4).

## Phạm vi

**Làm:**
- `onDrop` tách làm hai phần:
  - **ngay khi rớt:** giữ chỗ, dừng ý định của chính người chơi;
  - **sau `DROP_SHELTER_DELAY_MS`**, nếu vẫn đúng lần rớt đó: bảo vệ (`offline`, dừng các thú đang đánh họ, huỷ chiêu đang gồng của thú họ, lưu).
- Hằng số và một hàm thuần trong shared, kèm test chốt rằng 1,5 s đủ dài so với mọi đòn.
- Test tích hợp; sửa helper `cutConnection` cho các test cũ; tài liệu.

**KHÔNG làm:**
- Không đổi client, schema, message, `Profile`, close code, `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `resumeMs`.
- Không đổi nhánh "không giữ được chỗ" của T24 (`noteResume`): nó không bảo vệ gì, chỉ ghi điểm quay lại rồi `onLeave` xoá người chơi ngay.
- Không đổi luật đứng yên, an toàn và thời gian dừng của người đang được bảo vệ (`sheltered`, `tickRegen`, khí hậu, rương, thú đi theo). Chỉ đổi **lúc bắt đầu** bảo vệ.
- Không thêm hồi chiêu nối lại, không giới hạn số lần rớt.

## Thiết kế

### 1. Hằng số

| Tên | Giá trị | Ở đâu | Lý do |
|---|---|---|---|
| `DROP_SHELTER_DELAY_MS` | **1500** | `packages/shared/src/constants.ts`, cạnh `RECONNECT_GRACE_MS` | Đòn dài nhất đã bắt đầu thì trúng trong ≤ 1350 ms: chiêu Bão tuyết, gồng 650 + kéo dài 700 (bảng dưới). Cộng 2 nhịp mô phỏng (100 ms) thành 1450, làm tròn 1500. Dài hơn rất xa lần nối lại tự động của SDK (200-400 ms), nên bật tắt nhanh không bao giờ được bảo vệ. Ngắn hơn rất xa 6-9 s server cần để biết một lần mất mạng im lặng, nên người chơi thật hầu như không thấy khác. |
| `GameRoom.shelterDelayMs` | `DROP_SHELTER_DELAY_MS` | trường của `GameRoom`, cạnh `reconnectGraceMs` | Test rút ngắn được (như `reconnectGraceMs`, `resumeMs`). |

**Đòn đã bắt đầu thì mất bao lâu mới trúng** (số liệu hiện tại, tính bằng `node` trên `data/skills.json`):

| Đòn | Thời gian (ms) |
|---|---|
| Cắn của thú hoang và thú đầu đàn (`WILD_WINDUP_MS`) | 450 |
| Cắn của trùm (`BOSS.biteWindupMs`) | 600 |
| Dậm của trùm (`BOSS.stompWindupMs`) | 1000 |
| Chiêu dài nhất: `blizzard` (`castMs` 650 + `durationMs` 700) | 1350 |
| Chiêu kế tiếp: `meteor`, `leaf_storm`, `tidal_wave` | 1150 |

Thời gian một chiêu = `castMs + skillTravelMs(skill, skillReach(skill))`. Hàm `skillTravelMs` trả thời gian bay với chiêu có `speed`, và `durationMs` với chiêu khác.

**Vì sao cộng 2 nhịp:** Colyseus chạy hẹn giờ của `this.clock` *trước* phần mô phỏng trong cùng một nhịp. Hẹn giờ bảo vệ chạy ở nhịp đầu tiên từ `DROP_SHELTER_DELAY_MS` trở đi; một đòn xong đúng nhịp đó sẽ bị bảo vệ chặn trước. Chừa 2 nhịp (20 nhịp/giây) thì đòn dài nhất luôn trúng trước. Hàm thuần `attackLandsWithinMs()` cùng test chốt trong shared (Kế hoạch triển khai, bước 1) giữ luật này khi ai đó thêm chiêu dài hơn hay đổi thời gian gồng: test hỏng thay vì lặng lẽ mở lại đường né.

### 2. Rớt mạng: hai giai đoạn

**Ngay khi rớt** (trong `onDrop`, như hiện nay):
- `allowReconnection`, `holds.set(sid, hold)`: chỗ được giữ ngay. Thế giới không đóng vì tưởng trống (`isEmpty` nhìn `holds`), phòng đủ 5 người vẫn giữ chỗ.
- Nhánh "không giữ được chỗ" của T24 giữ nguyên (`noteResume`, rồi `onLeave` ngay).
- Dừng ý định của chính người chơi: `control.input = {0, 0}`, `dashLeftMs = 0`, `skillOrder = undefined`, `aggroUntil = 0`. Đây là ý định của họ, client không gửi được gì nữa, và để lại thì nhân vật đi tiếp 1,5 giây.
- Hẹn `this.clock.setTimeout(() => this.shelter(sid, hold), this.shelterDelayMs)`.

**Sau `shelterDelayMs`** (phương thức riêng mới `shelter(sessionId, hold)`):
- Chỉ làm khi `this.holds.get(sessionId) === hold`, tức vẫn đúng lần rớt này. Không làm khi:
  - đã nối lại (`onReconnect` xoá `holds`);
  - đã rời: hết giờ chờ, `debug:endGrace`, `endSession` (`removePlayer` xoá `holds`);
  - đã rớt **lần khác**: hold mới là một `Deferred` khác.
- Rồi làm đúng phần bảo vệ của T3, chuyển nguyên từ `onDrop`:
  - `player.offline = true`;
  - `calmPalsTargeting("player", sid)`;
  - với mỗi thú đi theo của họ: `skills.cancelCasts("companion", id)` và `calmPalsTargeting("companion", id)`;
  - `saves.saveNow(sid)`.
- Không cần huỷ hẹn giờ: kiểm tra định danh làm nó vô hại, và hẹn giờ chết cùng đồng hồ khi phòng đóng.

**Vì sao chuyển `saveNow` sang lúc bảo vệ:**
- bật tắt mạng liên tục không còn làm server ghi SQLite mỗi lần rớt;
- một lần rớt ngắn chưa phải lúc "vắng mặt";
- lần lưu theo lô (`scheduleSave`) và lần lưu khi xoá (`removePlayer`) vẫn còn.

Lời hứa "lưu ngay khi phát hiện mất mạng" của T3 thành "lưu ngay khi lần rớt được tính", tức sau 1,5 s.

**Nối lại trước 1,5 s:** `onReconnect` xoá `holds` (`offline` vốn chưa bật). Không có gì phải hoàn lại: không thú nào bị gỡ khỏi họ, không đòn nào bị huỷ.

### 3. Trong 1,5 giây đầu (đã rớt, chưa được bảo vệ)

Server vẫn mô phỏng người chơi như một người **đứng yên** trong thế giới, và quyết định mọi thứ như với người đang chơi:
- **Đòn đang gồng trúng như thường:** cắn, cắn và dậm của trùm, chiêu của thú hoang, thú đầu đàn và trùm. Đẩy lùi cũng tác động. Máu về 0 thì ngất như thường (`faintPlayer`: về trại hoặc đống lửa, đầy máu); thông báo ngất không tới vì không có client, nhưng vị trí mới đến khi nối lại.
- **Thú hoang vẫn nhắm và đuổi họ** (`wildTarget`, `targetPos` chỉ bỏ qua người `offline`). Thú đầu đàn và trùm đi cùng đường đó, không có ngoại lệ.
- **Thú đi theo của họ vẫn theo chủ, đánh và tung chiêu** (`movement.ts` chỉ dừng khi chủ `offline`). Chấp nhận: đó là việc nó vẫn làm khi chủ đứng yên, và không cho chủ thêm gì so với ở lại kết nối.
- **Thời gian vẫn trôi:** tự hồi máu, lạnh và nóng, như người đứng yên. Mở rương và tiến nhiệm vụ không xảy ra vì họ không đi được.
- **Người khác thấy:** họ đứng yên, chưa mờ. "(mất kết nối)" hiện sau 1,5 s, khi `offline` bật.
- **Chính người chơi thấy:** client không đổi. Màn "Đang kết nối lại…" hiện ngay khi rớt như T3. Client không gửi được gì, nên không có gì để lợi dụng trong 1,5 s đó.

### 4. Còn né được không, và vì sao chấp nhận phần còn lại

- **Bật tắt nhanh (< 1,5 s):** không né được gì. Đòn đang gồng trúng, thú vẫn bám, không lưu, không đổi gì.
- **Rớt giữa lúc gồng rồi giữ quá 1,5 s:** đòn đang gồng lúc rớt vẫn trúng (≤ 1,35 s < 1,5 s). Sau đó người chơi được bảo vệ và thú thôi đánh. Muốn "thoát trận" kiểu này phải chịu 1,5 s đứng yên bị đánh, rồi không làm được gì cho tới khi nối lại. Đúng mức T3 đã chấp nhận ("cắt mạng để thoát một trận đánh"), chỉ đắt hơn. Không cần cách (2) chồng lên.
- **Chiêu bắt đầu *trong* 1,5 s đó mà trúng sau mốc đó** (ví dụ thú bắt đầu Bão tuyết ở giây thứ 1,0): bị chặn vì người chơi đã được bảo vệ. Chấp nhận, như mọi đòn rơi lúc người chơi vắng mặt từ T3.
- **Quyền của server:** mốc thời gian, kiểm định danh và mọi sát thương đều ở server. Client chỉ có một đòn bẩy là đóng socket, và nó không còn lợi gì.

### 5. Hợp với T24 và các phần khác

| Phần | Sau T25 |
|---|---|
| Nhánh mất chỗ của T24 (`noteResume` khi hold không phải `Deferred`) | không đổi; không hẹn bảo vệ, `onLeave` xoá ngay; điểm quay lại ghi đúng máu và chỗ tại lúc đó |
| `debug:endGrace` / hết giờ chờ trước 1,5 s | `onLeave` → `removePlayer` xoá `holds`; hẹn giờ bảo vệ chạy sau đó, thấy không khớp, không làm gì |
| `endSession` (cùng thiết bị vào lại) trước 1,5 s | như trên |
| Giữ thế giới trống (`isEmpty`, `holdEmptyWorld`) | không đổi: `holds` được đặt ngay khi rớt |
| Phòng đủ 5 người | không đổi: chỗ giữ ngay khi rớt |
| Hồi chiêu Ăn | không đổi (không bị xoá khi rớt) |
| Lần thử treo của T24 (client đóng 4010 rồi thử lại) | mỗi lần đóng là một lần rớt mới; nếu người chơi đang được bảo vệ thì vẫn được (xem rủi ro 2) |

## Kế hoạch triển khai

1. **`packages/shared/src/constants.ts`:** `export const DROP_SHELTER_DELAY_MS = 1500;` kèm JSDoc tiếng Anh: a drop counts as being away (sheltered) only after this long, so dropping and coming back cannot call off an attack already under way; longer than the longest attack once started plus two ticks (see `attackLandsWithinMs`), far shorter than the 6-9 s a silent drop takes to notice.
2. **`packages/shared/src/skills.ts`:** `export function skillLandsWithinMs(skill: SkillDef): number` = `skill.castMs + skillTravelMs(skill, skillReach(skill))`, kèm JSDoc. Nếu `castMs` có thể thiếu trong `SkillDef` thì coder dùng đúng kiểu hiện có.
3. **`packages/shared/src/combat.ts`** (hoặc `skills.ts` nếu import vòng): `export function attackLandsWithinMs(skills: readonly SkillDef[]): number`, trả số lớn nhất giữa `WILD_WINDUP_MS`, `BOSS.biteWindupMs`, `BOSS.stompWindupMs` và `skillLandsWithinMs` của mọi chiêu. JSDoc nói nó là gì và rằng `DROP_SHELTER_DELAY_MS` phải lớn hơn nó ít nhất 2 nhịp. Xuất qua `index.ts` nếu shared dùng barrel.
4. **Test shared** (`packages/shared/src/skills.test.ts`, đã có):
   - `skillLandsWithinMs`: `blizzard` là 1350, `ember` là `castMs` + `round(150 / 360 · 1000)`, một chiêu `melee`/`nova` không có `durationMs` thì bằng `castMs`;
   - với mọi chiêu trong dữ liệu, `attackLandsWithinMs(...)` là 1350 hôm nay;
   - **test chốt:** `DROP_SHELTER_DELAY_MS >= attackLandsWithinMs(all) + 2 * TICK_MS`.
5. **`packages/server/src/rooms/GameRoom.ts`:**
   - Trường `shelterDelayMs = DROP_SHELTER_DELAY_MS`, JSDoc ("tests shorten it").
   - `onDrop`:
     - giữ phần `allowReconnection`, `.catch`, nhánh không phải `Deferred` (T24), `holds.set`, và bốn dòng dừng ý định;
     - **bỏ** `player.offline = true`, hai `calmPalsTargeting`, `cancelCasts`, `saveNow` (chuyển sang `shelter`);
     - thêm `this.clock.setTimeout(() => this.shelter(sessionId, hold), this.shelterDelayMs);`;
     - sửa JSDoc: rớt mạng giữ chỗ ngay, nhưng chỉ được bảo vệ sau `shelterDelayMs` (T25: né đòn bằng bật tắt mạng).
   - Phương thức riêng mới `shelter(sessionId: string, hold: Deferred<Client>)`, JSDoc tiếng Anh: thoát nếu `this.holds.get(sessionId) !== hold` hoặc không còn `player`, rồi làm phần bảo vệ ở Thiết kế 2.
   - `onReconnect` không đổi (chỉ sửa câu JSDoc nếu cần: "nothing to undo when it is back before the shelter").
6. **`GameRoom.test.ts`, các test cũ:**
   - Đưa `steadyClock` (T22) từ `describe("eating berries")` lên cấp file (không đổi thân hàm) để test mới dùng chung.
   - `cutConnection(room, sessionId, { realDelay = false } = {})`: nếu không `realDelay` thì `(room as any).shelterDelayMs = 0` trước khi `terminate()`. JSDoc nói rõ: các test về trạng thái "đang vắng" bắt đầu nó ngay; test T25 dùng `realDelay: true`.
   - Lý do: 16 lời gọi `cutConnection` và 17 chỗ `vi.waitFor(() => expect(...offline).toBe(true))` dùng hạn mặc định 1000 ms của `vi.waitFor`, ngắn hơn 1500. Đặt 0 thì hẹn giờ chạy ở nhịp kế tiếp (≤ 50 ms), test giữ đúng nghĩa và không chậm thêm 25 s.
   - Coder kiểm từng chỗ `offline).toBe(true)`: chỗ nào rớt mà không qua `cutConnection` thì đặt `shelterDelayMs = 0` tại chỗ.
   - Sửa chú thích "Saved at the drop itself" trong test `saves at the drop…` thành "saved as the drop counts".
7. **`GameRoom.test.ts`, test mới** trong describe `reconnecting after a dropped connection` (xem mục Test).
8. **Tài liệu** (mục Tài liệu).
9. `npm run typecheck`, `npm test`; rồi `npx playwright test -g "connection:" --workers=1` và `npx playwright test tests/e2e/reconnect.spec.ts --workers=1`, để chắc e2e cũ (không sửa) vẫn qua.

## Giao thức

Không đổi schema, message, `JoinOptions`, `Profile`, close code hay route HTTP. Client không đổi. `Player.offline` giữ nghĩa "đang được bảo vệ, đang vắng", chỉ bật muộn hơn 1,5 s. Hồ sơ đã lưu không bị ảnh hưởng.

## Test

### Unit (shared)

Xem bước 4.

### Tích hợp (`GameRoom.test.ts`)

Dùng `cutConnection(..., { realDelay: true })`, `holdReconnect`, `reconnected`, `placeWild`, `bossOf`, `(room as any).provoke`, `steadyClock`. Mốc rớt `dropAt` = `room.clock.currentTime` ngay khi `holdsOf(room).has(sid)` (chờ bằng `vi.waitFor`; sai số ≤ 1 nhịp). Mọi phép đo thời gian theo đồng hồ phòng, có `steadyClock`, nên không phụ thuộc đồng hồ thật. Thú đánh cho `maxHp = hp = 999`; `room.state.pals.clear()` trước khi đặt thú.

- **T1** `a quick drop and return calls off nothing: the bite being wound up lands`:
  - đặt `scorchtail` cạnh người chơi (30 px), `provoke`;
  - tick đến khi `wildAggro.get(foe).windupUntil` có giá trị; ghi `hp`;
  - `holdReconnect`, cắt (`realDelay`), chờ `holds` có sid, mở cổng, `reconnected`;
  - tick qua `windupUntil` + 2 nhịp.

  Mong đợi: `player.hp < hp` (cú cắn trúng); `wildAggro.get(foe)?.target.id === sid`; `player.offline` chưa lúc nào `true` (lấy mẫu mỗi nhịp từ lúc cắt đến hết test); `holds` rỗng.
- **T2** `the boss's stomp under way when the player drops still lands; the shelter comes after`:
  - đặt trùm (`bossOf`) trong `BOSS.stompRadius`, `provoke`, rồi `(room as any).combat.windUp(boss, aggro, "stomp", BOSS.stompWindupMs)` cho tất định;
  - cắt (`realDelay`, không nối lại).

  Mong đợi: tại `dropAt + BOSS.stompWindupMs + 100`, máu giảm và `offline` vẫn `false`; tại `dropAt + DROP_SHELTER_DELAY_MS + 100`, `offline` là `true` và trùm không còn nhắm người chơi.
- **T3** `dropping again and again shelters nothing and saves nothing`:
  - một `scorchtail` cứ cắn;
  - spy `(room as any).saves.saveNow`;
  - lặp 4 lần: cắt (`realDelay`), mở cổng ngay, `reconnected`, tick 6 nhịp (300 ms). Mỗi vòng ngắn hơn 1,5 s.

  Mong đợi: `offline` chưa lúc nào `true`; máu giảm ít nhất 2 cú cắn so với đầu; `saveNow` không được gọi cho sid này; thú vẫn nhắm người chơi.
- **T4** `the shelter of an old drop never lands on a newer one`:
  - rớt 1 (cổng đóng) → `dropAt1`; mở cổng, `reconnected`;
  - tick đến `dropAt1 + 700`; rớt 2 (cổng mới đóng) → `dropAt2`;
  - tick đến `dropAt1 + DROP_SHELTER_DELAY_MS + 100`.

  Mong đợi: `offline` là `false` (hẹn giờ của lần 1 thấy hold khác); tick đến `dropAt2 + DROP_SHELTER_DELAY_MS + 100` thì `offline` là `true`.
- **T5** `a real outage is sheltered after DROP_SHELTER_DELAY_MS, as before`:
  - dùng thú đi theo (`capture`), thú `scorchtail` đang đánh người chơi, một chiêu của thú đi theo đang gồng (như test `a drop wipes…`);
  - `useStore(db)` với token;
  - cắt (`realDelay`, không nối lại).

  Mong đợi:
  - ngay sau khi rớt: `control.input` là `{0, 0}`, `dashLeftMs` 0, `skillOrder` không còn; tick 10 nhịp thì người chơi không dịch chuyển (trừ khi bị cắn đẩy lùi: đặt thú cắn ở xa hơn `WILD_ATTACK_RANGE` cho phần kiểm vị trí, hoặc kiểm vị trí trước khi đặt thú);
  - tại `dropAt + DROP_SHELTER_DELAY_MS - 100`: `offline` là `false`, chiêu của thú đi theo vẫn trong `casts`, hồ sơ chưa ghi lần này;
  - tại `dropAt + DROP_SHELTER_DELAY_MS + 100`: `offline` là `true`, `wildAggro` không còn nhắm người chơi hay thú của họ, chiêu đang gồng của thú đi theo bị huỷ, hồ sơ đã được ghi;
  - sau đó `damage(...)` gọi thẳng không làm giảm máu (`sheltered`).
- **T6** `a wait that ends before the shelter leaves nothing behind`:
  - `reconnectGraceMs = 800`, `reconnection.enabled = false`, cắt (`realDelay`);
  - tick đến `dropAt + DROP_SHELTER_DELAY_MS + 200`.

  Mong đợi: người chơi bị xoá ở khoảng 800 ms; không lỗi khi hẹn giờ chạy (spy `console.error`, không được gọi); `room.state.players.size` là 0; `(room as any).emptyHold` có giá trị (thế giới trống đang được giữ). Cùng test, phòng thứ hai: `debug:endGrace` trước 1,5 s cũng như vậy (bật `PETGAME_DEBUG` như test hook hiện có, trả lại giá trị cũ sau đó).

Các test T3 và T24 hiện có (A1-A4, `holds a dropped player…`, `time stands still…`, `saves at the drop…`, `keeps the place … full world`, `one device, one player…`, hook `endGrace`) phải qua không đổi nghĩa, nhờ `cutConnection` đặt `shelterDelayMs = 0`.

### E2E

Không viết mới (client không đổi). Chạy lại `-g "connection:"` (`multiplayer.spec.ts`, không sửa) và `tests/e2e/reconnect.spec.ts`. Đã đọc: các test đó chờ `offline` bằng `expect.poll` (hạn 5 s, dài hơn 1,5 s), và nhân vật dừng ngay khi rớt vì ý định vẫn bị xoá ngay. Nếu một test e2e cũ hỏng vì thời gian, tester báo lại; **không** sửa `multiplayer.spec.ts`.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | gọi `shelter` ngay trong `onDrop` (không hẹn) | T1, T2, T3, T5 (mốc −100 ms) |
| M2 | `shelter` kiểm `this.holds.has(sessionId)` thay vì `=== hold` | T4 |
| M3 | bỏ hẳn kiểm hold trong `shelter` | T1 (`offline` bật sau khi đã nối lại), T4 |
| M4 | để `calmPalsTargeting("player", …)` lại trong `onDrop` (chỉ `offline` chờ) | T1, T3 |
| M5 | chuyển bốn dòng dừng ý định sang `shelter` | T5 (người chơi đi tiếp trước 1,5 s), test cũ `a drop wipes…` |
| M6 | để `saveNow` lại trong `onDrop` | T3 (spy), T5 (hồ sơ ghi trước mốc) |
| M7 | `DROP_SHELTER_DELAY_MS = 1000` | test chốt shared (luôn bắt). T2 có thể hỏng hay không tuỳ nhịp mà cú dậm 1000 ms rơi vào, nên không dựa vào T2 |
| M8 | `skillLandsWithinMs` bỏ phần bay hay kéo dài | unit `blizzard` 1350 |
| M9 | `shelter` bỏ `cancelCasts` của thú đi theo | T5 |
| M10 | `cutConnection` không đặt `shelterDelayMs = 0` | nhiều test cũ hết hạn `vi.waitFor` (chứng minh helper cần thiết; ghi số test hỏng) |

### Chạy lặp

- describe `reconnecting after a dropped connection`: 10 lần, và 5 lần dưới tải 4 vòng lặp CPU (đồng hồ đều của `steadyClock` giữ các mốc);
- `npm test` 2 lần;
- e2e như trên, 1 lần.

## Tài liệu

- **`docs/design/multiplayer.md`:**
  - dòng đầu thêm "T25";
  - bảng **Rời chủ động và rớt mạng**, cột "Rớt mạng", hàng "Nhân vật": "ở lại **20 giây** chờ quay lại, vẫn giữ chỗ (kể cả khi phòng đủ 5 người). Được bảo vệ (mục dưới) chỉ khi rớt quá **1,5 giây** (`DROP_SHELTER_DELAY_MS`)";
  - mục **Trong 20 giây chờ**, câu mở đầu thêm: "Từ 1,5 giây sau khi rớt. Trong 1,5 giây đầu, nhân vật đứng yên trong thế giới như người bỏ tay khỏi máy: đòn đang gồng vẫn trúng, thú hoang vẫn đánh, máu về 0 thì ngất như thường; nối lại trong khoảng đó thì như chưa có gì";
  - câu "Server lưu hồ sơ ngay lúc phát hiện mất mạng" đổi thành "Server lưu hồ sơ khi lần rớt được tính (sau 1,5 giây), và lưu lần nữa khi xoá";
  - mục **Đã cân nhắc và chấp nhận**, gạch "Cắt mạng để thoát một trận đánh": thêm "Từ T25, ngắt rồi nối lại nhanh không né được gì: bảo vệ chỉ bắt đầu sau 1,5 giây, dài hơn mọi đòn đã bắt đầu (đòn dài nhất 1,35 giây), nên đòn đang gồng luôn trúng. Muốn thoát trận phải đứng yên chịu đòn 1,5 giây rồi không làm được gì cho tới khi nối lại. Không chọn cách 'rớt lại trong N giây sau khi nối lại thì không bảo vệ': nó vẫn cho né một lần mỗi N giây, và bỏ mặc người mạng xấu thật ở lần mất mạng thứ hai".
- **`docs/architecture.md`**, server, mục kết nối lại:
  - `onDrop` giữ chỗ và dừng ý định ngay, hẹn `shelter` sau `shelterDelayMs` (`DROP_SHELTER_DELAY_MS`) với kiểm `holds.get(sid) === hold`;
  - `shelter` đặt `offline`, gỡ thú đang đánh, huỷ chiêu của thú đi theo, lưu;
  - test shared chốt `DROP_SHELTER_DELAY_MS ≥ attackLandsWithinMs + 2 nhịp`;
  - ở mục kiểm thử: `cutConnection` đặt `shelterDelayMs = 0` trừ khi `realDelay`; `steadyClock` ở cấp file.

## Tiêu chí hoàn thành

- [ ] `DROP_SHELTER_DELAY_MS = 1500` trong `constants.ts` có JSDoc. `skillLandsWithinMs`, `attackLandsWithinMs` có JSDoc và unit test. Test chốt `DROP_SHELTER_DELAY_MS >= attackLandsWithinMs + 2 * TICK_MS` qua.
- [ ] `onDrop` chỉ còn giữ chỗ, nhánh T24, dừng ý định và hẹn `shelter`. `shelter` làm phần bảo vệ của T3 chỉ khi `holds.get(sid) === hold` và người chơi còn.
- [ ] T1-T6 qua. Các test kết nối lại của T3 và T24 qua không đổi nghĩa. `steadyClock` lên cấp file. `cutConnection` có tuỳ chọn `realDelay` và JSDoc.
- [ ] Bảng đột biến M1-M10 cho đúng kết quả, ghi trong `PROGRESS.md`. Với M7, test chốt shared hỏng.
- [ ] Không đổi client, schema, message, `Profile`, close code. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test` qua; e2e `-g "connection:"` và `reconnect.spec.ts` qua.
- [ ] Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi giao thức hay dữ liệu đã lưu, không xoá tính năng. Quyết định đảo ngược được bằng một hằng số.

1. **Người chơi thật chịu thêm 1,5 s đứng yên khi rớt rõ ràng** (đổi Wi-Fi, mạng báo đóng ngay). Trong một trận đánh, 1,5 s có thể mất 1-3 cú cắn. Chấp nhận: mất mạng im lặng (trường hợp phổ biến nhất trên di động) vốn đã để họ đứng đó 6-9 s trước khi server biết, nên T25 không làm gì tệ hơn rõ rệt.
2. **Lần thử treo của T24:** client đóng lần thử bằng 4010 khi `retryCount` đứng yên quá 8 s. Phía server đó là lần nối lại chưa xong, thường chưa từng tới server, nên không sinh lần rớt mới. Nếu nó đã tới server rồi chết lúc `JOINING`, đó là nhánh mất chỗ của T24 (không bảo vệ, có điểm quay lại). Không đổi gì.
3. **Thú đi theo vẫn đánh trong 1,5 s đầu.** Chấp nhận (Thiết kế 3). Nếu reviewer thấy cần dừng nó ngay thì cũng làm được, nhưng sẽ làm lệch luật "chưa vắng" thành hai mức.
4. **Chiêu dài hơn 1,4 s sau này:** test chốt shared hỏng. Người thêm chiêu phải tăng `DROP_SHELTER_DELAY_MS` hoặc rút chiêu lại, và ghi lý do.

## Đề xuất cho `TASKS.md`

- Không có việc mới. Ghi vào T24b (c): nếu làm tin "đang vắng" khi trang ẩn, dùng cùng `DROP_SHELTER_DELAY_MS` và cùng kiểu kiểm định danh, để trang ẩn không thành đường né đòn.
