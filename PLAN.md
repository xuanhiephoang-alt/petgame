# PLAN: T10 Tách `GameRoom.ts` thành các hệ thống (refactor thuần, không đổi hành vi)

Code đọc ở HEAD `dfb0c1c` (`packages/server/src/rooms/GameRoom.ts` dài 2.295 dòng). Mọi số dòng dưới đây là số dòng ở `dfb0c1c`. Số dòng trôi sau mỗi phần, nên coder tìm theo **tên hàm**, không theo số dòng.

Mốc đo trước khi làm (designer chạy ở `dfb0c1c`): `npx vitest run packages/server` cho kết quả **8 file, 236 test qua, khoảng 145 s**. Trong đó `GameRoom.test.ts` có 140 test `it(`.

## Mục tiêu

Người chơi không thấy gì khác: không đổi luật, con số, tin nhắn, thứ tự sự kiện hay giao thức. Việc này phục vụ đội phát triển. Từ sau T9, `GameRoom.ts` đã thêm trùm (T21), bỏ chạy (T27/T57), giữ thế giới trống (T49/T65), thú đầu đàn đuổi (T58) và sổ đếm thế giới (T64), nên giờ là một file 2.300 dòng. Mỗi nhiệm vụ đụng tới nó đều phải đọc cả file, diff thì khó rà, và các thay đổi song song dễ xung đột. Sau T10:

- `GameRoom.ts` còn khoảng 600-700 dòng: vòng đời phòng Colyseus, thứ tự trong `tick`, định tuyến tin nhắn, trạng thái chung, gửi thông báo.
- Mỗi hệ thống (chiêu, chiến đấu, trùm và thú đầu đàn, thú đi theo, thú hoang, di chuyển và tìm đường, thế giới, trại, lưu game, hook debug) nằm trong một file 60-350 dòng dưới `packages/server/src/systems/`.

## Phạm vi

**Làm:**
- Chuyển nguyên văn các phương thức của `GameRoom` sang các class hệ thống mới trong `packages/server/src/systems/`.
- Ở các chỗ gọi, chỉ đổi đường gọi (`this.x` thành `this.room.x` hoặc `this.<hệ thống>.x`).
- Tách ba khối nằm trong thân hàm thành phương thức riêng: vòng người chơi và vòng thú hoang của `tick`, khối hồi sinh thú hoang. Mỗi khối chỉ được di chuyển, không đổi gì khác.
- Cập nhật `docs/architecture.md`.

**KHÔNG làm:**
- Không đổi luật, con số, chữ, tên phương thức, tham số, giá trị mặc định, thứ tự câu lệnh, thứ tự gọi `Math.random`, thứ tự trong `tick`.
- Không "dọn" logic khi chuyển, không gộp hàm trùng (ví dụ hai `heal` lồng nhau), không sửa lỗi nhỏ thấy được. Thấy lỗi thì ghi vào `PROGRESS.md` để thành nhiệm vụ riêng.
- Không sửa file test (`GameRoom.test.ts`, `worldLimits.test.ts`, `tests/e2e/*`), `packages/shared`, `packages/client`, `packages/server/src/ai/*`, `persistence/*`, `index.ts`, `worldLimits.ts`. Nếu test hỏng thì sửa code, không sửa test, kể cả đường import (kế hoạch này giữ nguyên mọi đường import của test).
- Không chuyển trạng thái (`Map`, bộ đếm, `bossHome`...) ra khỏi `GameRoom` (lý do ở mục Thiết kế).
- Không sửa `CLAUDE.md`. Bản đồ hệ thống là `docs/architecture.md`.
- Không chạy `git stash` (push/pop/drop/apply) trong suốt T10 (xem Rủi ro, T63).

## Thiết kế

### 1. Chỗ đặt: `packages/server/src/systems/`

Chọn `systems/`, không chọn `rooms/`. Lý do:
- `rooms/` là nơi đặt class Room của Colyseus (hiện chỉ có `GameRoom`).
- Các file mới không phải Room. Đó là các phần luật chơi chạy bên trong một phòng, cùng tầng với `ai/` (hàm thuần) và `persistence/` (lưu trữ).
- `systems/` nằm cạnh hai thư mục đó nên dễ tìm.

### 2. Cách hệ thống truy cập phòng: class giữ tham chiếu tới phòng, mọi trạng thái vẫn nằm trên `GameRoom`

```
GameRoom (Colyseus Room)
  trạng thái: controls, holds, brains, wildAggro, fleeing, skillReady, skillGapUntil, casts, paths, obstacles, bossHome, ...
  hệ thống:   readonly saves = new Saves(this); readonly skills = new Skills(this); ... (mỗi hệ thống một trường)
  vòng đời:   onCreate, onJoin, onDrop, onReconnect, onLeave, onDispose, removePlayer, endSession, giữ thế giới trống
  tick:       gọi các hệ thống theo đúng thứ tự cũ
systems/<x>.ts
  export class X { constructor(private readonly room: GameRoom) {} ...các phương thức đã chuyển, giữ nguyên tên... }
```

Bảy luật bất biến. Reviewer chấm theo các luật này:

1. **Trạng thái ở lại `GameRoom`, tên giữ nguyên.** Test chạm vào trạng thái riêng của phòng qua `as any`: `controls`, `holds`, `reconnectGraceMs`, `emptyHoldMs`, `emptyHold`, `brains`, `companionTimers`, `wildAggro`, `faintedUntil`, `lastDamagedAt`, `dayTime`, `rootedUntil`, `dizzyUntil`, `fleeing`, `inBall`, `skillReady`, `skillGapUntil`, `castingUntil`, `casts`, `bossHome`, `bossReturning`, `bossHelpers`, `bossLastStompAt`, `alphaReturning`, `obstacles`, `paths`, `respawnTimer`, `clock`. Có test **gán lại** cả trường: `plantTrees` gán `obstacles` và `paths`, ngoài ra còn `bossHome`, `bossReturning`, `respawnTimer`, `dayTime`, `bossLastStompAt`, `emptyHoldMs`, `reconnectGraceMs`. Vì vậy mọi trường ở lại đúng chỗ, chỉ bỏ chữ `private` đi. `private` của TypeScript không có tác dụng lúc chạy, nên bỏ nó không đổi hành vi.
2. **Hệ thống không bao giờ giữ bản sao trường của phòng.** Hàm dựng (constructor) rỗng. Không có trường nào dạng `this.obstacles = room.obstacles`. Lúc nào cũng đọc `this.room.<trường>` ngay khi dùng. Nếu giữ bản sao, `plantTrees` gán lại `paths` hay `obstacles` thì hệ thống vẫn dùng bản cũ, và các test đi vòng cây sẽ hỏng.
3. **Tên phương thức không đổi khi chuyển.** Tham số, giá trị mặc định, kiểu trả về, chú thích JSDoc và thân hàm cũng giữ nguyên. Trong thân hàm đã chuyển chỉ có ba kiểu thay chữ:
   - `this.<phương thức cùng hệ thống>` giữ nguyên;
   - `this.<phương thức của hệ thống khác>` thành `this.room.<hệ thống>.<phương thức>`;
   - `this.<trường hoặc phương thức còn ở phòng>` (gồm `state`, `clock`, `clients`, `broadcast`, `notify`, `announce` và mọi trường trạng thái) thành `this.room.<…>`.

   Trong `GameRoom`, lời gọi tới phương thức đã chuyển là `this.<hệ thống>.<phương thức>`.
4. **Giữa các hệ thống, và từ hệ thống về `GameRoom.ts`, chỉ được `import type`.** Lời gọi qua lại lúc chạy luôn đi qua `this.room.<hệ thống>`. Nhờ vậy không có vòng import ES module nào: `GameRoom.ts` import các class hệ thống, còn hệ thống chỉ import kiểu `GameRoom`. Cùng là chiến đấu nhưng combat gọi leaders (`defeatBoss`) và leaders gọi combat (`damage`). Nếu import lẫn nhau sẽ thành vòng.
5. **Thứ tự mọi thứ giữ nguyên:** thứ tự trong `tick`, thứ tự câu lệnh, thứ tự gọi `Math.random` (test giả `Math.random` bằng chuỗi `mulberry32(42)`), và thứ tự đăng ký `this.clock.setTimeout` (hai hẹn giờ cùng đáo hạn trong một tick thì cái đăng ký sau chạy trước).
6. **Phạm vi truy cập:**
   - Phương thức của hệ thống được gọi từ ngoài class đó (từ `GameRoom`, từ hệ thống khác, từ `debug.ts`, hoặc qua cửa test ở luật 7) thì không có từ khoá phạm vi (public).
   - Phương thức chỉ dùng trong class thì để `private`.
   - `noUnusedLocals` báo lỗi khi một thành viên `private` không ai dùng, còn TypeScript báo lỗi khi gọi thành viên `private` từ ngoài. Hai lỗi này giúp coder đặt đúng.
7. **Cửa test.** Test gọi trực tiếp các phương thức `room.saveNow`, `startCast`, `provoke`, `daze`, `knockOut`, `damage`, `handleAttack`, `spawnPal`, `removePal`, `openChest`, `eat`. Những phương thức này chuyển đi, nên `GameRoom` giữ một phương thức uỷ quyền **cùng tên** cho mỗi cái, gom ở cuối class dưới tiêu đề `// Test access`. Code của game không gọi các phương thức uỷ quyền này mà gọi thẳng hệ thống. Dạng mẫu, giữ chữ ký luôn khớp với hệ thống:
   ```ts
   /** Test access (GameRoom.test.ts): Combat.provoke. */
   provoke(...args: Parameters<Combat["provoke"]>) {
     return this.combat.provoke(...args);
   }
   ```
   Các phương thức này để public: nếu để `private` mà không ai trong class gọi thì `noUnusedLocals` báo lỗi.

   Bốn thứ **ở lại** `GameRoom` thật sự, không làm uỷ quyền:
   - `tick`;
   - `holdEmptyWorld`;
   - `closeIfStillEmpty` và `removePlayer`: test `vi.spyOn(room as any, …)` thay chúng trên instance, và chỉ bắt được lời gọi dạng `this.closeIfStillEmpty()` / `this.removePlayer()` trong `GameRoom`;
   - `allowReconnection` (bị spy, nằm trong `onDrop`).

   `vi.spyOn(room.clock, "setTimeout")` vẫn bắt được vì hệ thống dùng chung đối tượng `this.room.clock`.

**Các cách đã cân nhắc và bỏ:**
- **Hàm tự do `fn(room, ...)`.** Các module phải import lẫn nhau (combat và leaders, skills và combat) nên sinh vòng import. Diff cũng không gọn hơn cách đã chọn.
- **Mixin vào prototype** (`Object.assign(GameRoom.prototype, …)` kết hợp `interface GameRoom extends …`). Diff gọn nhất, vì `this.` giữ nguyên, nhưng quên gán một phương thức thì vẫn qua typecheck rồi hỏng lúc chạy, và "đi tới định nghĩa" chỉ tới interface. Khó rà.
- **Chuyển `Map` vào hệ thống rồi thêm getter/setter trên phòng.** Phải viết setter cho mọi trường test gán lại, nên rủi ro cao hơn mà lợi ích không đáng kể trong một nhiệm vụ refactor thuần.

Tên trường hệ thống (`saves`, `skills`, `combat`, `leaders`, `party`, `wild`, `world`, `camp`, `movement`) đã được so với `Room.d.ts` của Colyseus 0.18.9 và không trùng. Colyseus có `messages`, `plugins`, `inputs`, `presence`, `clock`, `state`, `clients`, `listing`: không được dùng các tên này.

### 3. Ranh giới module

Số dòng ở cột thứ hai là vị trí trong `GameRoom.ts` ở `dfb0c1c`, tính cả JSDoc ngay phía trên.

| File | Class, trường trên phòng | Chuyển vào (tên giữ nguyên) | Khoảng |
|---|---|---|---|
| `systems/saving.ts` | `Saves`, `room.saves` | Cấp module: `SAVE_DELAY_MS` 273-274, `sharedStore` + `store()` (export) 276-281, `useStore` (export) 283-286. Phương thức: `scheduleSave` 2203-2211, `saveNow` 2213-2243 | 70 |
| `systems/skills.ts` | `Skills`, `room.skills` | `Cast` (export interface) 241-258, `FROM_CASTER` 260-261. Phương thức: `cancelCasts` 1351-1355, `forgetSkills` 1357-1361, `startCast` 1405-1447, `tickCasts` 1449-1465, `orderSkill` 1467-1480, `obey` 1482-1528, `lunge` 1530-1543, `castTargetPos` 1545-1548, `land` 1550-1627, `support` 1629-1654, `wildSkill` 1656-1668, `wildArmor` 1670-1673 (lá chắn đá là tác dụng của chiêu) | 300 |
| `systems/combat.ts` | `Combat`, `room.combat` | `handleAttack` 949-975, `hitWild` 1259-1276, `daze` 1278-1285, `recover` 1287-1292, `breakOut` 1294-1299, `knockOut` 1301-1323, `push` 1363-1368, `windUp` 1370-1375, `cancelWindup` 1377-1381, `strike` 1383-1394, `invulnerable` 1396-1399, `provoke` 1786-1797, `wildTarget` 1799-1818, `targetPos` 1820-1824, `sheltered` 1826-1830, `damage` 1832-1880, `faintPlayer` 1882-1898, `faintCompanion` 1900-1913, `calmPalsTargeting` 1915-1919, `tickRegen` 1930-1944, `nearestPal` 2245-2258 | 300 |
| `systems/leaders.ts` | `Leaders`, `room.leaders` | Trùm và thú đầu đàn: `bossStomp` 1675-1687, `spawnBoss` 1712-1734 (dời dòng JSDoc lạc chỗ 1689 "The giant Boulderhorn appears…" lên đúng trên `spawnBoss`; đây là chỉnh sửa chú thích duy nhất được phép), `spawnAlpha` 1736-1750, `defeatBoss` 1757-1784 | 85 |
| `systems/party.ts` | `Party`, `room.party` | Thú trong túi và thú đi theo: `summon` 1066-1081, `sendToWork` 1083-1093, `startWork` 1095-1112, `rest` 1114-1123, `release` 1125-1140, `feed` 1220-1230, `tooTired` 1921-1928, `grantXp` 2133-2153, `spawnCompanion` 2155-2167, `despawnCompanion` 2169-2177, `timers` 2179-2186, `workSpotFor` 2188-2195 | 165 |
| `systems/wild.ts` | `Wild`, `room.wild` | Thú hoang sinh ra, bị bắt, rời thế giới: `handleThrow` 995-1064, `removePal` 1325-1349, `spawnPal` 2260-2283; **mới** `tickRespawn(dtMs)` = khối 849-856 của `tick`, chuyển nguyên văn | 125 |
| `systems/world.ts` | `World`, `room.world` | Khám phá, nhiệm vụ, môi trường: `tickDay` 1946-1961, `placeChest` 1967-1975, `tickExploration` 1977-1988, `openChest` 1990-2006, `questEvent` 2008-2024, `catchUpQuest` 2026-2041, `growFruit` 2043-2050, `harvest` 2052-2075, `gather` 2077-2099, `tickClimate` 2101-2127 | 190 |
| `systems/camp.ts` | `Camp`, `room.camp` | Trại, chế tạo, tủ đồ, ăn: `BASE_CLEARANCE`, `BASE_SPACING` 263-266, `placeBase` 1142-1162, `craft` 1164-1188, `setLook` 1190-1199, `equip` 1201-1208, `giveWearable` 1210-1218, `eat` 1232-1253 | 120 |
| `systems/movement.ts` | `Movement`, `room.movement` | Di chuyển và tìm đường (mọi lời gọi `paths.steer` và `steerFlee(... paths.nav ...)` nằm ở đây): `BOSS_DETOUR` 267-272; **mới** `tickPlayers(dtMs)` = khối 722-730; **mới** `tickWild(dtMs, now)` = khối 733-838 (`this.state.pals.forEach(...)`, thân hàm giữ nguyên kể cả mọi `return` trong callback); `tickCompanions` 859-943, `dash` 977-993, `bossHeadHome` 1690-1710 | 265 |
| `systems/debug.ts` | hàm `registerDebugHooks(room: GameRoom)` (không có trạng thái nên không cần class) | Thân của khối `if (process.env.PETGAME_DEBUG === "1") { … }` 422-506, giữ nguyên chú thích. Trong khối, `this.` thành `room.` | 90 |

**Ở lại `GameRoom.ts`:**
- import, `PlayerControl`, `CompanionTimers` (thêm `export` để hệ thống `import type`), `liveSessions`, `sanitizeName`;
- mọi trường trạng thái, các trường hệ thống;
- `onCreate`: các handler `onMessage` gọi sang hệ thống; dòng `if (process.env.PETGAME_DEBUG === "1") registerDebugHooks(this);` giữ việc kiểm biến môi trường ngay trong phòng; `setSimulationInterval`; `holdEmptyWorld()`; `worldCensus.opened`;
- `onJoin` (đọc hồ sơ qua `store()` import từ `saving.ts`), `onDrop`, `onReconnect`, `onLeave`, `onDispose`, `removePlayer`, `endSession`, `isEmpty`, `holdEmptyWorld`, `keepWorldOpen`, `closeIfStillEmpty`;
- `tick`, `notify`, `announce` (public: mọi hệ thống gửi tin qua đây), `pickColor`;
- 11 phương thức uỷ quyền `// Test access`.

**Vì sao gộp trùm và thú đầu đàn vào `leaders.ts`, khác với cách liệt kê trong `TASKS.md`:**
- Logic riêng của thú đầu đàn phần lớn nằm **xen** trong các luồng chung: nhánh về hang trong vòng thú hoang, `ALPHA.skillGapMs` trong `startCast`, phần thưởng trong `knockOut`, hồi sinh trong `removePal`. Tách các đoạn này ra là đổi cấu trúc, không còn là chuyển code.
- Phần còn lại của thú đầu đàn chỉ là `spawnAlpha` (15 dòng). Một file 15 dòng chỉ thêm nhiễu.
- `bossHeadHome` nằm ở `movement.ts` cạnh nhánh về hang của thú đầu đàn. Cả hai là đường đi về nhà qua `paths`, đúng yêu cầu "để `paths` cùng module di chuyển".

**Về `paths`:** trường `paths` (`PathPlanner`) vẫn nằm trên `GameRoom` vì `plantTrees` của test gán lại nó. Mọi lời gọi `steer` và `steerFlee` nằm trong `movement.ts`. `run(now)` được gọi trong `GameRoom.tick` ngay sau `tickCompanions`, như hiện nay. `paths.forget` vẫn nằm trong hai hàm dọn dẹp `removePal` (`wild.ts`) và `despawnCompanion` (`party.ts`).

### 4. `tick` sau khi tách (đúng thứ tự của `dfb0c1c`)

```ts
private tick(dtMs: number) {
  this.movement.tickPlayers(dtMs);
  const now = this.clock.currentTime;
  this.movement.tickWild(dtMs, now);
  this.movement.tickCompanions(dtMs);
  // The searches asked for this tick, within its budget (the pals walk them from the next tick).
  this.paths.run(now);
  this.skills.tickCasts();
  this.world.tickExploration();
  this.world.tickClimate(dtMs);
  this.combat.tickRegen(dtMs, now);
  this.world.tickDay(dtMs);
  this.wild.tickRespawn(dtMs);
}
```

Ba phương thức mới cần một dòng JSDoc tiếng Anh nói chúng làm gì:
- `tickPlayers`: "Players walk and dash (the server side of the client's prediction)."
- `tickWild`: "Every wild pal's move this tick: in a ball, dizzy, rooted, a pack leader walking home, fleeing, fighting, or wandering."
- `tickRespawn`: "Wild pals come back over time, up to the target (more at night, plus the boss and the pack leaders out)."

### 5. Hiệu năng, điện thoại và bàn phím

Không đổi gì ở client. Phía server:
- thêm 9 đối tượng nhỏ cho mỗi phòng;
- mỗi lần truy cập thêm một bước `.room`;
- mỗi tick thêm 3 lời gọi phương thức;
- không cấp phát thêm gì mỗi tick.

## Kế hoạch triển khai

Chia thành **hai đợt**, mỗi đợt một vòng coder → tester → reviewer và một commit (xem "Đề xuất tách nhiệm vụ" ở cuối). Mỗi phần (A, B, …) là một lần chuyển code. Sau mỗi phần, typecheck và test server phải xanh **trước khi** sang phần sau.

**Kiểm tra sau mỗi phần**, ghi vào `PROGRESS.md` một dòng cho mỗi phần: tên phần, `wc -l` của `GameRoom.ts` và của file mới, kết quả kiểm tra.
1. `npm run typecheck` sạch.
2. `npx vitest run packages/server`: 8 file, **236 test qua**, số test không đổi.
3. `git add -N packages/server/src/systems` để file mới hiện trong `git diff`. Lệnh chỉ đánh dấu ý định thêm, không commit.
4. Kiểm tra file không được đổi (mục Test, lệnh `git diff --exit-code`).

Nếu một phần làm test đỏ: so lại phần vừa chuyển theo luật 1-7, đừng sửa test.

### Đợt 1: lưu game, chiêu, chiến đấu, trùm và thú đầu đàn, thú đi theo, thú hoang

**Phần A: chuẩn bị và `systems/saving.ts`**
1. `GameRoom.ts`: bỏ `private` ở mọi trường trạng thái (dòng 300-366). Thêm một chú thích trên khối trường: "Room state, shared with the systems (systems/*.ts) and kept here so it lives as long as the room; only the room, its systems and tests touch it." Thêm `export` cho `interface PlayerControl` và `interface CompanionTimers`.
2. Tạo `systems/saving.ts`:
   - JSDoc của class: "Saving profiles: batched saves and the process-wide store."
   - `import type { GameRoom, … } from "../rooms/GameRoom.ts"`.
   - Chuyển `SAVE_DELAY_MS`, `sharedStore`, `store()` (thêm `export`), `useStore`, `scheduleSave`, `saveNow`.
3. `GameRoom.ts`:
   - `import { Saves, store } from "../systems/saving.ts";`
   - `export { useStore } from "../systems/saving.ts";` để `GameRoom.test.ts` vẫn import `useStore` từ `./GameRoom.ts`, cùng một binding.
   - `readonly saves = new Saves(this);`
   - Mọi `this.scheduleSave(` thành `this.saves.scheduleSave(`, `this.saveNow(` thành `this.saves.saveNow(`.
   - Thêm khối `// Test access` với `saveNow`.
   - Bỏ import không còn dùng.

**Phần B: `systems/skills.ts`**
- Chuyển `Cast`, `FROM_CASTER` và 12 phương thức trong bảng. `Cast` thành `export interface`. `GameRoom` dùng `import { Skills, type Cast }` cho trường `casts: Cast[]`.
- `obey` nhận `control: PlayerControl`, nên `import type { GameRoom, PlayerControl }`.
- Trong `tickCasts` và `cancelCasts`, `this.casts = this.casts.filter(...)` thành `this.room.casts = this.room.casts.filter(...)`. Mảng vẫn là trường của phòng nên `inner.casts` trong test vẫn thấy mảng mới.
- Cửa test: `startCast`.

**Phần C: `systems/combat.ts`**
- Chuyển 21 phương thức trong bảng.
- Cửa test: `provoke`, `daze`, `knockOut`, `damage`, `handleAttack`.
- `onCreate`: `ClientMessage.Attack` gọi `this.combat.handleAttack(client)`.
- `onDrop` và `removePlayer` gọi `this.combat.calmPalsTargeting(...)`.

**Phần D: `systems/leaders.ts`**
- Chuyển `bossStomp`, `spawnBoss` (kèm dời JSDoc lạc chỗ), `spawnAlpha`, `defeatBoss`.
- `onCreate` gọi `this.leaders.spawnBoss()` và `this.leaders.spawnAlpha(def)`.
- `removePal` gọi lại `spawnAlpha` qua hẹn giờ. Lúc này `removePal` vẫn ở phòng nên là `this.leaders.spawnAlpha(def)`; sang phần F nó thành `this.room.leaders.spawnAlpha(def)`.

**Phần E: `systems/party.ts`**
- Chuyển 12 phương thức trong bảng.
- `onCreate`: các handler Summon, Assign, Release, Feed và `debug:givePal`/`debug:xp` (lúc này vẫn trong `onCreate`) gọi `this.party.…`.
- `onJoin` gọi `this.party.summon` và `this.party.startWork`.
- `onDrop` và `removePlayer` gọi `this.party.despawnCompanion`.
- Không có cửa test mới.

**Phần F: `systems/wild.ts`, rồi cập nhật tài liệu cho đợt 1**
1. Chuyển `handleThrow`, `removePal`, `spawnPal`. Tạo `tickRespawn(dtMs)` từ khối 849-856 và thay khối đó trong `tick` bằng `this.wild.tickRespawn(dtMs);` (vẫn là dòng cuối của `tick`).
2. Cửa test: `spawnPal` (phải `return` id), `removePal`.
3. `docs/architecture.md`: viết mục `systems/` (xem phần K) cho 6 file đã có. Bullet `rooms/GameRoom.ts` ghi rõ những phần chưa tách.
4. Cuối đợt chạy thêm `npm test`, `npm run build`, `npm run test:e2e`, và lệnh kiểm tra bảo toàn dòng (mục Test).

### Đợt 2: thế giới, trại, di chuyển, debug, tài liệu

**Phần G: `systems/world.ts`**
- Chuyển 10 phương thức trong bảng. Cửa test: `openChest`.
- `onCreate` gọi `this.world.placeChest` và `this.world.growFruit`.
- `onJoin` gọi `this.world.catchUpQuest`.
- `tick` gọi `this.world.tickExploration()`, `this.world.tickClimate(dtMs)`, `this.world.tickDay(dtMs)` ở đúng vị trí cũ.

**Phần H: `systems/camp.ts`**
- Chuyển `BASE_CLEARANCE`, `BASE_SPACING` và 6 phương thức. Cửa test: `eat`.
- Các handler PlaceBase, Craft, Eat, SetLook, Equip và `debug:gear`/`debug:wardrobe` gọi `this.camp.…`.

**Phần I: `systems/movement.ts`**
1. Chuyển `BOSS_DETOUR`, `tickCompanions`, `dash`, `bossHeadHome`.
2. Tạo `tickPlayers(dtMs)` từ khối 722-730.
3. Tạo `tickWild(dtMs, now)` từ khối 733-838: nguyên lời gọi `this.state.pals.forEach((pal, id) => { … })`, thụt lề giữ nguyên (4 dấu cách ở mức method, như trong `tick`).
4. Viết lại `tick` đúng như mục Thiết kế 4.
5. Handler Dash gọi `this.movement.dash(...)`.

**Phần J: `systems/debug.ts`**
1. Tạo `export function registerDebugHooks(room: GameRoom)` với JSDoc "Test hooks (debug:*). Only registered when PETGAME_DEBUG=1; never on a real server." Chuyển nguyên văn thân khối 422-506, đổi `this.` thành `room.` (theo luật 3: `room.wild.spawnPal`, `room.party.summon`, `room.party.grantXp`, `room.camp.giveWearable`, `room.notify`, `room.brains`, `room.dayTime`, `room.obstacles`, `room.holds`, `room.emptyHoldMs`, `room.state`).
2. Trong `onCreate`, khối `if` thay bằng `if (process.env.PETGAME_DEBUG === "1") registerDebugHooks(this);`.
3. Như mọi hệ thống, `debug.ts` chỉ cần `import type { GameRoom }`. Lời gọi lúc chạy đi qua tham số `room`.

**Phần K: dọn dẹp và tài liệu**
1. `GameRoom.ts`: bỏ import thừa (typecheck báo). Giữ các tiêu đề `// ----` còn đúng: "Simulation" trên `tick`, "Test access". Các tiêu đề của phần đã chuyển đi trở thành JSDoc của class tương ứng, ví dụ "Pal skills (skills.ts): cast, then landing."
2. `docs/architecture.md`, mục `packages/server`:
   - Viết lại bullet `rooms/GameRoom.ts`. Ghi rằng phòng giữ: vòng đời (`onCreate`/`onJoin`/`onDrop`/`onReconnect`/`onLeave`/`onDispose`, `removePlayer`, `endSession`), giữ thế giới trống, thứ tự `tick` (liệt kê như mục Thiết kế 4), định tuyến `onMessage`, toàn bộ trạng thái chỉ server cần, `notify`/`announce`, và cửa test.
   - Giữ nguyên các bullet con về thông báo, kết nối lại, giữ thế giới trống. Chỉ thêm tên file ở chỗ nhắc hàm, ví dụ "`sheltered(target)` (`systems/combat.ts`)", "`grantXp` (`systems/party.ts`)".
   - Thêm bullet `systems/` gồm một bảng 10 file và nội dung từng file (như bảng ở mục Thiết kế 3, không cần số dòng), cùng luật làm việc:
     - trạng thái ở `GameRoom`;
     - hệ thống đọc qua `this.room` ngay lúc dùng, không giữ bản sao;
     - chỉ `import type` giữa các hệ thống và từ `GameRoom.ts`;
     - gọi chéo qua `this.room.<hệ thống>`;
     - thêm luật chơi mới vào hệ thống đúng chỗ, không thêm vào `GameRoom`;
     - thêm hệ thống mới gồm file, trường `readonly x = new X(this)`, và một dòng trong bảng.
   - Mục Kiểm thử, câu "Test dùng trường riêng của `GameRoom` qua `as any`…": thêm rằng trạng thái vẫn ở `GameRoom` nên dùng được như cũ. Phương thức đã chuyển mà test cũ gọi bằng tên cũ thì đi qua cửa `// Test access`. Test **mới** cần một phương thức của hệ thống thì gọi `(room as any).<hệ thống>.<phương thức>`, không thêm cửa mới.
   - Thay câu "`paths.run(now)` mỗi tick sau `tickCompanions`" bằng mô tả mới: `paths` ở phòng, mọi `steer` ở `systems/movement.ts`.
3. Chạy toàn bộ: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, cùng kiểm tra bảo toàn dòng và kiểm tra file không đổi.

## Giao thức

Không đổi gì: `schema.ts`, `messages.ts`, `Profile`/`sanitizeProfile` và dữ liệu đã lưu giữ nguyên. Client không bị ảnh hưởng, không phải đổi gì ở client.

## Test

- **Không thêm và không sửa test.** Bằng chứng duy nhất cho "không đổi hành vi" là bộ test hiện có qua nguyên vẹn: 140 test của `GameRoom.test.ts` (dùng nhiều trường và phương thức riêng của phòng), `worldLimits.test.ts` (mở phòng `GameRoom` thật qua HTTP), và toàn bộ e2e.
- **Sau mỗi phần:** `npm run typecheck` và `npx vitest run packages/server` (236 test, khoảng 2,5 phút).
- **Cuối mỗi đợt:** `npm test`, `npm run build`, `npm run test:e2e`.
  - Lỗi đã biết, không do T10: `boss bar (phone upright, notch)` thỉnh thoảng lỗi (T63, `QUESTIONS.md` Q1). Nếu chỉ test đó lỗi, chạy lại riêng nó (`npx playwright test -g "boss bar"`). Qua thì ghi vào `PROGRESS.md` là lỗi chập chờn đã biết. Lỗi lặp lại thì là FAIL như mọi lỗi khác.
- **File không được đổi** (exit code phải là 0):
  ```bash
  git diff --exit-code dfb0c1c -- packages/server/src/rooms/GameRoom.test.ts packages/server/src/worldLimits.test.ts \
    packages/server/src/worldLimits.ts packages/server/src/index.ts packages/server/src/ai packages/server/src/persistence \
    packages/shared packages/client tests playwright.config.ts vitest.config.ts package.json packages/server/package.json
  ```
- **`git diff --stat dfb0c1c`** chỉ được có:
  - `packages/server/src/rooms/GameRoom.ts`: xoá nhiều, thêm ít. Sau đợt 1 file còn khoảng 1.300 dòng, sau đợt 2 còn 600-700 dòng.
  - các file mới trong `packages/server/src/systems/` (nhờ `git add -N`);
  - `docs/architecture.md`;
  - các file làm việc `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`.
- **Về `git diff -M` và `-C`:**
  - `-M` chỉ nhận ra khi **cả file** đổi tên. Ở đây `GameRoom.ts` không đổi tên, nên kết quả đúng là **không có dòng đổi tên nào** (`git diff -M --stat dfb0c1c` không có `=>`). Đặc biệt `GameRoom.test.ts` không được dời chỗ.
  - `-C`/`--find-copies-harder` cũng không nhận các file mới là bản chép, vì git tính độ giống so với file **lớn hơn** (vài trăm dòng so với 2.295 dòng nên dưới ngưỡng 50%).
  - Vì vậy hai cách dưới đây mới là bằng chứng.
- **Xem các khối được chuyển:**
  ```bash
  git diff --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change dfb0c1c -- packages/server/src
  ```
  Thân hàm không đổi chữ hiện mờ (đã chuyển). Chỉ những dòng có `this.` → `this.room.` hoặc → `this.<hệ thống>.` hiện là thêm/xoá thường.
- **Kiểm tra bảo toàn dòng.** Đây là bằng chứng chính, tester và reviewer chạy lệnh này, chỉ đọc. Mỗi dòng của `GameRoom.ts` cũ, sau khi chuẩn hoá đường gọi, phải còn ở `GameRoom.ts` mới hoặc trong `systems/*.ts`:
  ```bash
  S=<thư mục scratchpad>; cd /home/user/petgame
  SYS='saves|skills|combat|leaders|party|wild|world|camp|movement'
  norm() { sed -E "s/^[[:space:]]+//; s/[[:space:]]+\$//; s/^private //; s/\bthis\.room\.($SYS)\./this./g; s/\bthis\.room\./this./g; s/\bthis\.($SYS)\./this./g; s/\broom\.($SYS)\./this./g; s/\broom\./this./g" | grep -vE '^$|^(type )?[A-Za-z0-9_]+,$|^import |^\} from '; }
  git show dfb0c1c:packages/server/src/rooms/GameRoom.ts | norm | sort > $S/before.txt
  cat packages/server/src/rooms/GameRoom.ts packages/server/src/systems/*.ts | norm | sort > $S/after.txt
  comm -23 $S/before.txt $S/after.txt   # dòng MẤT
  comm -13 $S/before.txt $S/after.txt   # dòng MỚI
  ```
  Designer đã chạy thử ở `dfb0c1c`: hai danh sách đều rỗng.
  - **Dòng MẤT** chỉ được là:
    - các dòng tiêu đề `// ----` và tên mục của phần đã chuyển;
    - dòng `if (process.env.PETGAME_DEBUG === "1") {` (đã thành một dòng mới);
    - vài dấu `}` thừa ra do tách khối.

    Mọi dòng mất khác là một thay đổi hành vi tiềm tàng. Reviewer phải đánh FAIL nếu không giải thích được.
  - **Dòng MỚI** chỉ được là:
    - vỏ class (`export class X {`, `constructor(private readonly room: GameRoom) {}`) và JSDoc của class;
    - trường `readonly x = new X(this);`;
    - chữ ký và JSDoc của `tickPlayers`/`tickWild`/`tickRespawn`/`registerDebugHooks`, cùng lời gọi tới chúng;
    - `export { useStore } …`;
    - các phương thức uỷ quyền `// Test access`;
    - chú thích mới trên khối trường trạng thái;
    - dấu ngoặc đóng.

    Ước lượng dưới 150 dòng.

## Tiêu chí hoàn thành

Mỗi đợt chấm theo phần đã làm. Đợt 2 chấm cả danh sách.

- [ ] `packages/server/src/systems/` có `saving.ts`, `skills.ts`, `combat.ts`, `leaders.ts`, `party.ts`, `wild.ts` (đợt 1), `world.ts`, `camp.ts`, `movement.ts`, `debug.ts` (đợt 2). Mỗi file dưới 360 dòng và có JSDoc tiếng Anh cho class hoặc hàm export.
- [ ] `GameRoom.ts` dưới 700 dòng sau đợt 2, chỉ chứa những gì liệt kê ở "Ở lại `GameRoom.ts`".
- [ ] Mọi phương thức chuyển đi giữ đúng tên, tham số, giá trị mặc định và thân hàm. Chỉ đường gọi đổi theo luật 3. Lệnh bảo toàn dòng cho danh sách MẤT và MỚI đúng như mô tả ở mục Test.
- [ ] Thứ tự trong `tick` đúng như mục Thiết kế 4.
- [ ] Không hệ thống nào giữ bản sao trường của phòng. Lệnh `grep -nE "constructor\(" packages/server/src/systems/*.ts` chỉ ra dạng `constructor(private readonly room: GameRoom) {}`. Lệnh `grep -nE "this\.[A-Za-z]+ = (this\.)?room\." packages/server/src/systems/*.ts` không ra gì.
- [ ] Không có import giá trị giữa các hệ thống hay từ `GameRoom.ts`. Lệnh `grep -nE "from \"(\.\./rooms/GameRoom|\./[a-zA-Z]+)\.ts\"" packages/server/src/systems/*.ts | grep -v "import type"` không ra gì. Vì vậy mỗi import từ `GameRoom.ts` hay từ hệ thống khác phải viết trên một dòng `import type { … } from "…";`. Các import này ngắn nên không cần xuống dòng.
- [ ] `GameRoom` có đủ 11 phương thức uỷ quyền cùng tên (`saveNow`, `startCast`, `provoke`, `daze`, `knockOut`, `damage`, `handleAttack`, `spawnPal`, `removePal`, `openChest`, `eat`), dạng `Parameters<…>`. Code của game không gọi chúng: `grep -nE "this\.(saveNow|startCast|provoke|daze|knockOut|damage|handleAttack|spawnPal|removePal|openChest|eat)\(" packages/server/src/rooms/GameRoom.ts` không ra gì. Thân của các phương thức uỷ quyền gọi `this.<hệ thống>.…` nên không khớp mẫu này. Lệnh tương tự `grep -nE "room\.(saveNow|startCast|provoke|daze|knockOut|damage|handleAttack|spawnPal|removePal|openChest|eat)\(" packages/server/src/systems/*.ts` cũng không ra gì.
- [ ] `tick`, `holdEmptyWorld`, `closeIfStillEmpty`, `removePlayer`, `onDrop` (gọi `allowReconnection`) vẫn ở `GameRoom` và được gọi bằng `this.…`.
- [ ] Mọi trường trạng thái giữ đúng tên trên `GameRoom` (danh sách ở luật 1). Trường `paths` vẫn là `new PathPlanner(defaultNav())` trên phòng.
- [ ] Lệnh `git diff --exit-code` ở mục Test cho exit code 0. Test, client, shared, e2e không đổi một byte nào.
- [ ] `npm run typecheck` sạch. `npx vitest run packages/server` qua 236/236. `npm test`, `npm run build`, `npm run test:e2e` qua, trừ lỗi chập chờn đã biết của T63 khi đã ghi rõ.
- [ ] `docs/architecture.md` có mục `systems/` với bảng và luật làm việc. Bullet `GameRoom` đã cập nhật. Không còn chỗ nào nói "toàn bộ luật chơi" nằm trong `GameRoom.ts`.
- [ ] `PROGRESS.md` có một dòng cho mỗi phần (số dòng, kết quả typecheck/test) và ghi chú những lỗi phát hiện được mà không sửa (nếu có).

## Rủi ro, câu hỏi mở

Không có mục "CHẶN:". Không có quyết định nào cần người dùng: giao thức và dữ liệu lưu không đổi, không xoá tính năng.

1. **Hệ thống giữ bản sao trường**, ví dụ `obstacles` hay `paths` lấy một lần trong hàm dựng. Khi đó test đi vòng cây (`plantTrees`), trùm về nhà và dây giới hạn của thú đầu đàn sẽ hỏng, hoặc tệ hơn là vẫn qua nhờ may mắn. Chặn bằng luật 2 và lệnh grep trong Tiêu chí.
2. **Đổi thứ tự khi tách khối.** Thứ tự `Math.random` và hẹn giờ quyết định kết quả của các test dùng `mulberry32(42)` và của test thứ tự tin (`knockOut` có spy `clock.setTimeout`). Chỉ di chuyển, không sắp xếp lại. `tickWild` nhận `now` từ `tick`, không tự đọc lại đồng hồ (giá trị như nhau, nhưng giữ đúng một chỗ đọc).
3. **Phương thức uỷ quyền lệch chữ ký** so với hệ thống. Dạng `Parameters<…>` buộc chúng khớp nhau lúc typecheck.
4. **Vòng import ES module.** Nếu lỡ import giá trị giữa các hệ thống, `tsx` vẫn chạy được nhưng thứ tự khởi tạo module trở nên mong manh. Luật 4 và lệnh grep trong Tiêu chí chặn việc này.
5. **Trùng tên với thành viên của `Room` Colyseus** thì ghi đè hành vi của framework. Các tên đã chọn đã được kiểm với `Room.d.ts` 0.18.9. Không dùng `messages`, `plugins`, `inputs`.
6. **API công khai lớn hơn**, do bỏ `private` trên trường. Chấp nhận: TypeScript `private` không bảo vệ gì lúc chạy, và chú thích trên khối trường nói rõ ai được chạm vào.
7. **Nhiệm vụ dở T63 trong stash.**
   - `stash@{0}` (T63 vòng 3) sửa `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`, `PROGRESS.md`, `REVIEW.md`.
   - T10 không đụng ba file code đó, nên không có xung đột code.
   - `PROGRESS.md` và `REVIEW.md` sẽ bị T10 ghi đè, nên khi agent chính `git stash pop` cho T63 (sau khi có câu trả lời Q1) sẽ xung đột ở hai file làm việc này. Cách gỡ: lấy bản trong stash cho hai file đó, vì nội dung T10 đã nằm trong commit.
   - Không ai được `git stash` / `pop` / `drop` trong lúc làm T10. Muốn so với bản cũ thì dùng `git show dfb0c1c:<đường dẫn>`.
   - `stash@{1}` ("tester-r3 temp: HEAD shots comparison") là đồ tạm còn sót của tester vòng T63. T10 không đụng tới. Dọn hay giữ là việc của agent chính.
8. **Thời gian chạy test:** khoảng 2,5 phút cho mỗi phần, 11 phần, cộng hai lần e2e. Không được bỏ bước kiểm tra giữa các phần: đó là cách khoanh lỗi vào đúng một lần chuyển.
9. **Nhiệm vụ đang chờ khác cũng sửa `GameRoom.ts`**, ví dụ T75. Làm sau T10 thì sẽ sửa trong file hệ thống tương ứng. Nếu một kế hoạch cũ đã ghi số dòng của `GameRoom.ts` thì số đó không còn đúng: designer của nhiệm vụ đó phải đọc lại code.

## Đề xuất tách nhiệm vụ (cho agent chính cập nhật `TASKS.md`)

Khoảng 1.700 dòng phải chuyển, quá nhiều cho một vòng coder an toàn. Đề xuất:

- **T10 (đợt 1, phần A-F):** `saving`, `skills`, `combat`, `leaders`, `party`, `wild`, kèm tài liệu cho phần đã tách. Commit riêng, ví dụ "Split GameRoom: saving, skills, combat, leaders, party, wild (T10)".
- **T10b (đợt 2, phần G-K):** `world`, `camp`, `movement`, `debug`, kèm tài liệu hoàn chỉnh. Commit riêng.
  - Thêm vào `TASKS.md` ngay dưới T10: "T10b. Tách nốt `GameRoom.ts`: thế giới, trại, di chuyển và tìm đường, hook debug (đợt 2 của PLAN T10)".

Cả hai đợt dùng chung `PLAN.md` này, không cần gọi lại designer cho T10b. Mỗi đợt có ngân sách 3 vòng sửa riêng. Sau đợt 1 code vẫn chạy đúng và đủ test (mỗi phần tự đứng được), nên nếu T10b bị dừng thì T10 vẫn có giá trị.
