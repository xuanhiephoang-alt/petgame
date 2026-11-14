# PLAN: T11 Tách `Game.ts` thành các module (refactor thuần, không đổi hành vi)

Code đọc ở `767619d`, gọi là **BASE** trong cả kế hoạch. Ở BASE, `packages/client/src/game/Game.ts` dài **1.512 dòng** (`TASKS.md` ghi 1.360 là số cũ). Mọi số dòng dưới đây là số dòng ở BASE và sẽ trôi sau mỗi phần, nên coder tìm theo **tên hàm**, không theo số dòng.

Mốc đo do designer chạy ở BASE:
- `npm run typecheck` sạch (khoảng 8 s).
- `npx vitest run packages/client`: **9 file, 110 test qua** (khoảng 1 s). Không file test nào import `Game.ts`.
- `npx vitest run`: **34 file, 505 test qua** (khoảng 146 s).
- E2E: **56 test** (theo `PROGRESS.md` của T10b, khoảng 9-10 phút).

Kế hoạch dùng lại cách đã chạy tốt ở T10 (`git show 0b50b27:PLAN.md`): trạng thái ở lại lớp chính, các module giữ tham chiếu tới lớp chính, chỉ `import type` ngược về, và một lệnh kiểm tra bảo toàn dòng làm bằng chứng chính.

## Mục tiêu

Người chơi không thấy gì khác: hình, âm thanh, chữ, phím, nút cảm ứng, thứ tự hiệu ứng và tin gửi server giữ nguyên. Việc này phục vụ đội phát triển.

`Game.ts` hiện gom mọi thứ của màn chơi: dựng HUD, đồng bộ state thành hình và nhãn, 18 handler `ServerMessage`, hoạt ảnh chiêu, thao tác của người chơi, vòng `frame()`. Nhiệm vụ nào đụng màn chơi (T12 gom chữ, T14 ảnh chụp, T52 màn lỗi, T63 nhãn tên) cũng phải đọc cả file, và diff khó rà.

Sau T11 và T11b:
- `Game.ts` còn khoảng 500 dòng: tạo màn chơi (`create`/`init`), trạng thái chung, `send`, theo dõi kết nối, `frame()` và `lights()`, các hàm tra cứu dùng chung (`me`, `nearMe`), `debugInfo()`.
- Mỗi phần còn lại nằm trong một file 30-380 dòng dưới `packages/client/src/game/`.

## Phạm vi

**Làm:**
- Chuyển nguyên văn phương thức, hằng số và hàm tự do của `Game.ts` sang 6 file mới trong `packages/client/src/game/` (bảng ở Thiết kế 3).
- Ở chỗ gọi chỉ đổi đường gọi (`this.x` thành `this.game.x` hoặc `this.<module>.x`).
- Tách ba khối nằm trong thân hàm thành phương thức riêng: các `onMessage` của `bindRoom` (thành `ServerEvents.bind`), các callback state của `bindRoom` (thành `StateSync.bind`), khối dựng HUD của `init` (thành `HudBridge.build`). Khối nào cũng chỉ được di chuyển, không đổi gì khác.
- Cập nhật `docs/architecture.md`.

**KHÔNG làm:**
- Không đổi hình, chữ, con số, tên phương thức, tham số, giá trị mặc định, thứ tự câu lệnh, thứ tự gọi trong `frame()`, thứ tự đăng ký callback. Ngoại lệ duy nhất là dời `$.listen("dayTime")` (Thiết kế 4).
- Không "dọn" khi chuyển: không bỏ cấp phát sẵn có trong `updateHud`/`lights`, không gộp `updateHpBar` với `setHp`, không sửa lỗi nhỏ thấy được. Thấy lỗi thì ghi vào `PROGRESS.md` để thành nhiệm vụ riêng.
- Không chuyển trạng thái ra khỏi `Game` (lý do ở Thiết kế 2).
- Không sửa file nào ngoài `Game.ts`, các file mới và `docs/architecture.md` (cùng các file làm việc). Cụ thể, không sửa:
  - `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`: stash T63 sửa ba file này;
  - mọi file test, `scripts/` (kể cả `shots.mjs`), `packages/client/src/ui/*`, `main.ts`, `net/*`, các file `game/*.ts` khác, `packages/shared`, `packages/server`, `index.html`.
- Không thêm test. Test client hiện có không chạm `Game.ts`; test cho các module mới cần PixiJS và DOM, nằm ngoài một nhiệm vụ refactor thuần.
- Không sửa `CLAUDE.md`. Bản đồ hệ thống là `docs/architecture.md`.
- **Không chạy `git stash` dưới bất kỳ dạng nào** (push, pop, drop, apply, clear) trong suốt T11 và T11b (xem Rủi ro 7). Muốn xem bản cũ thì dùng `git show 767619d:packages/client/src/game/Game.ts`.

## Thiết kế

### 1. Chỗ đặt: `packages/client/src/game/`

Các module mới đọc và ghi trạng thái của `Game` (map thực thể, camera, rung màn hình) nên cùng tầng với `Game.ts`. `ui/` giữ các widget DOM không biết gì về `Game` (`Hud`, `PartyPanel`, `SkillBar`...), nên phần nối HUD (`hudBridge.ts`) cũng đặt ở `game/`, không đặt ở `ui/`.

### 2. Cách module truy cập `Game`: module giữ tham chiếu tới `Game`, mọi trạng thái vẫn nằm trên `Game`

```
Game
  trạng thái: stage, hud, labels, players, pals, companions, leaving, camps, chests, shake, dashing, aimedId, ...
  module:     readonly skillCasts = new SkillCasts(this); readonly serverEvents = new ServerEvents(this); ...
  còn lại:    create, init, send, watchConnection, bindRoom, me, nearMe, frame, lights, bossActor, debugInfo
game/<x>.ts
  export class X { constructor(private readonly game: Game) {} ...các phương thức đã chuyển, giữ nguyên tên... }
```

Tám luật bất biến. Reviewer chấm theo các luật này:

1. **Trạng thái ở lại `Game`, tên giữ nguyên.** E2E và `scripts/shots.mjs` đọc trực tiếp qua `window.__petgame.game` (danh sách đầy đủ ở Thiết kế 5). Bỏ chữ `private` ở **mọi** trường trạng thái (dòng 166-244). `private` của TypeScript không có tác dụng lúc chạy, nên bỏ nó không đổi hành vi.
   - Tham số hàm dựng `room`, `assets`, `watch` đổi `private` thành `readonly`. `container` giữ `private` vì chỉ `init` dùng.
   - `frames` vốn đã public.
2. **Module không bao giờ giữ bản sao trường của `Game`.** Hàm dựng rỗng. Không có trường dạng `private hud = this.game.hud`, không có `const players = this.game.players` mới. Lúc nào cũng đọc `this.game.<trường>` ngay khi dùng. Hai lý do:
   - Module được tạo trong lúc `Game` đang dựng, **trước** `init()`. Lúc đó `hud`, `labels`, `effects`, `party`, `skillBar`, `keyboard`... còn là `undefined`.
   - Nhiều trường bị **gán lại** khi chạy: `dashing` (trong `dash`), `lastSentInput`, `useGreatBall`, `shake`, `bossId`, `aimedId`, `skillBarPal`, `region`, `serverDay`/`serverDayAt`, `knockedAt`, `lastAttackAt`, `nextDashAt`, `joystick`.
3. **Tên phương thức không đổi khi chuyển.** Tham số, giá trị mặc định, kiểu trả về, JSDoc và thân hàm cũng giữ nguyên. Trong thân đã chuyển chỉ có ba kiểu thay chữ:
   - `this.<phương thức cùng module>` giữ nguyên;
   - `this.<phương thức của module khác>` thành `this.game.<module>.<phương thức>`;
   - `this.<trường hoặc phương thức còn ở Game>` (gồm `room`, `assets`, `watch`, `send`, `me`, `nearMe` và mọi trường trạng thái) thành `this.game.<…>`.

   Trong `Game`, lời gọi tới phương thức đã chuyển là `this.<module>.<phương thức>`. Hàm tự do (`lootIcons`, `addHpBar`, `setHp`, `lookOf`...) giữ nguyên tên và thân, chỉ thêm `export` khi file khác cần.
4. **Giữa các module, và từ module về `Game.ts`, chỉ được `import type`.** Lời gọi lúc chạy luôn đi qua `this.game.<module>`.
   - `Game.ts` import class của các module (giá trị), còn module chỉ import kiểu `Game`, `PalEntity`, `Named`, `Camp`. Nhờ vậy không có vòng import ES module. Ví dụ `serverEvents` gọi `skillCasts`, `stateSync` gọi `hudBridge`.
   - Ngoại lệ duy nhất là `looks.ts`: một file lá chỉ có hàm tự do, không import gì từ `game/`. `stateSync.ts`, `hudBridge.ts` và `Game.ts` được import giá trị từ nó.
5. **Thứ tự giữ nguyên:**
   - thứ tự câu lệnh trong mọi thân hàm;
   - thứ tự các lời gọi trong `frame()`, kể cả `updateBossBar()` trước `updateHud()`, và `labels.update` vẫn là lời gọi cuối trước `frames++`;
   - thứ tự đăng ký callback state và `onMessage` (Thiết kế 4);
   - thứ tự dựng widget trong `init`: `Labels` trước `Hud`, `Hud` trước các bảng, `Keyboard` cuối cùng.
6. **Phạm vi truy cập:**
   - Phương thức của module được gọi từ ngoài class thì không có từ khoá phạm vi (public). Chỉ dùng trong class thì để `private`.
   - Phương thức ở lại `Game` mà module gọi (`me`, `nearMe`, `send`) thì bỏ `private`. Phương thức chỉ `Game` dùng (`init`, `abandon`, `watchConnection`, `bindRoom`, `frame`, `lights`, `bossActor`) giữ `private`.
   - `noUnusedLocals` báo lỗi khi một thành viên `private` không ai dùng, còn TypeScript báo lỗi khi gọi thành viên `private` từ ngoài. Hai lỗi này giúp coder đặt đúng.
7. **Hợp đồng với e2e và `shots.mjs` không đổi** (Thiết kế 5): đủ trường, đúng tên, đúng kiểu dữ liệu bên trong. `frame()` vẫn gọi `this.labels.update(...)` qua trường `labels`, vì `shots.mjs` thay hàm `update` trên chính đối tượng đó để đo thời gian.
8. **Hiệu năng:**
   - Mỗi module chỉ được tạo một lần, là trường `readonly` của `Game`.
   - Không thêm closure, mảng hay object nào trong đường chạy mỗi khung (`frame`, `lights`, `updateHud`, `updateMinimap`, `updateBossBar`, `readInput`). Mỗi khung chỉ thêm vài bước tra thuộc tính `.game` và `.<module>`.
   - Các lời gọi `destroy()` (`removeActor`, `syncCamp`, rương) chuyển nguyên văn.

**Các cách đã cân nhắc và bỏ:**
- **Hàm tự do `fn(game, ...)`.** Phải export hàm qua lại giữa các file (`serverEvents` cần `chainJump`, `stateSync` cần `tip`), nên sinh vòng import. Diff không gọn hơn.
- **Chuyển trạng thái riêng vào module** (ví dụ `chains` vào `skillCasts`, `tips` vào `hudBridge`). Gọn hơn về đóng gói, nhưng mỗi trường phải quyết định riêng, và vài trường e2e đọc (`nodes`, `pals`) bị kéo theo. Một luật duy nhất "trạng thái ở `Game`" dễ rà hơn. Có thể làm sau thành nhiệm vụ riêng nếu cần.
- **Mixin vào prototype.** Lý do bỏ giống T10: quên gán một phương thức vẫn qua typecheck, và "đi tới định nghĩa" chỉ tới interface.

Tên trường module (`skillCasts`, `serverEvents`, `controls`, `hudBridge`, `stateSync`) không trùng trường nào của `Game` (đã so với danh sách dòng 166-246). `Game` không kế thừa lớp nào nên không có rủi ro ghi đè lớp cha.

### 3. Ranh giới module

Số dòng là vị trí ở BASE, tính cả JSDoc ngay phía trên. Cột "Phạm vi" ghi public/private theo luật 6.

| File | Class, trường trên `Game` | Chuyển vào (tên giữ nguyên) | Phạm vi | Khoảng |
|---|---|---|---|---|
| `game/skillCasts.ts` | `SkillCasts`, `game.skillCasts` | Hoạt ảnh chiêu: `castSkill` 1286-1365, `chainJump` 1367-1374 | cả hai public | 105 |
| `game/serverEvents.ts` | `ServerEvents`, `game.serverEvents` | Hằng `QUEST_DELAY_MS` 148-149, `NOTICE_LEVEL` 150-151; hàm `lootIcons` 1469-1477. Phương thức `setFate` 1140-1149. **Mới:** `bind()` = 18 lời gọi `this.room.onMessage(...)` của `bindRoom`, khối 600-782 và 789-892, đúng thứ tự | `bind` public, `setFate` private | 350 |
| `game/controls.ts` | `Controls`, `game.controls` | Thao tác của người chơi: `eat` 273-278, `readInput` 1063-1072, `attack` 1074-1092, `dash` 1094-1114, `gatherSpot` 1116-1125, `nearestPal` 1155-1167, `throwBall` 1169-1193, `toggleBall` 1384-1393 | `gatherSpot`, `nearestPal` private; còn lại public | 140 |
| `game/looks.ts` | (hàm tự do, không class) | `interface Dressed` 106-114; `lookOf`, `wornOf`, `dressKey` 116-118; `remember` 1479-1487; `wornIcons` 1489-1495. Thêm `export` cho mỗi cái | export | 40 |
| `game/hudBridge.ts` | `HudBridge`, `game.hudBridge` | Nối HUD. **Mới:** `build(container: HTMLElement, isTouch: boolean)` = khối 299-359 của `init` (từ `this.hud = new Hud(` tới hết `new Keyboard(...)`). Phương thức `tip` 1133-1138, `updateSkillBar` 1195-1211, `updateHud` 1219-1241, `updateRegion` 1243-1253, `updateMinimap` 1255-1284, `updateBossBar` 1376-1382 | `build`, `tip`, `updateHud`, `updateBossBar` public; còn lại private | 190 |
| `game/stateSync.ts` | `StateSync`, `game.stateSync` | State phòng thành thực thể, nhãn tên, trại, rương. Hằng `AWAY_ALPHA` 158-159; hàm `addHpBar` 1497-1505, `setHp` 1507-1512. Phương thức `nameTag` 387-394, `updateHpBar` 1213-1217, `syncCamp` 1395-1440, `addActor` 1442-1445, `removeActor` 1447-1450. **Mới:** `bind()` = dòng `const $ = Callbacks.get(this.room);` 397 + khối callback state 399-598 + khối `$.listen("dayTime", ...)` 784-787 | `bind`, `removeActor` public; còn lại private | 330 |

**Ở lại `Game.ts`:**
- import; `GameAssets` (export, `main.ts` dùng); `interface Named`, `PalEntity`, `Camp` (thêm `export` để module `import type`); hằng `PAL_DRAW_DISTANCE`, `SNAP_DISTANCE`, `STILL`;
- mọi trường trạng thái, 5 trường module;
- `create`, `abandon`, `send`, `init` (giờ gọi `this.hudBridge.build(container, isTouch)` đúng chỗ khối cũ), `watchConnection`;
- `bindRoom`. Sau đợt 2 chỉ còn hai dòng: `this.stateSync.bind();` rồi `this.serverEvents.bind();`;
- `me`, `nearMe`, `frame`, `lights`, `bossActor`, `debugInfo`.

**Vì sao nhãn tên không thành file riêng.** Chuyện tag (`nameTag`, `addHpBar`, `setHp`, `updateHpBar`) chỉ khoảng 40 dòng, và chỉ chạy khi một thực thể đồng bộ xuất hiện hoặc đổi. Đặt cạnh `bind()` của `stateSync` thì người đọc thấy tag được tạo ở đâu. Một file 40 dòng chỉ thêm nhiễu, giống lý do gộp thú đầu đàn ở T10. Phần xếp nhãn vẫn ở `labels.ts` và `labelLayout.ts`, không đụng tới.

**Vì sao `watchConnection`, `frame`, `lights` ở lại.** Chúng là xương sống của màn chơi: thứ tự trong `frame()` là thứ phải nhìn một chỗ (giống `tick` của T10). `debugInfo` ở lại vì e2e và shots gọi `game.debugInfo()`.

### 4. Thứ tự đăng ký callback (luật 5)

Ở BASE, `bindRoom` đăng ký theo thứ tự sau:
1. 12 callback state: `onAdd`/`onRemove` cho `players`, `pals`, `felled`, `companions`, `chests`, `fruits`;
2. 9 `onMessage`: Harvested, ChestOpened, QuestDone, Hit, Lunge, Defeated, Gathered, Dashed, CaptureResult;
3. `$.listen("dayTime")`;
4. 9 `onMessage`: Damage, Fainted, SkillCast, Healed, BossStomp, BossDefeated, Notice, LevelUp, Produced.

Sau T11, khối `$.listen("dayTime", ...)` (4 dòng) dời lên **ngay sau** `$.onRemove("fruits", ...)`, rồi tới 18 `onMessage` đúng thứ tự cũ. Đây là thay đổi thứ tự duy nhất được phép. Nó không đổi hành vi vì:
- cả `bindRoom` chạy đồng bộ trong một lượt, nên không tin nào của server được xử lý xen giữa các lần đăng ký;
- `onMessage` của mỗi loại tin là một handler riêng, không phụ thuộc thứ tự đăng ký;
- callback `listen` chạy ngay với giá trị hiện tại chỉ gán `serverDay`/`serverDayAt`, và không handler `onMessage` nào đọc hai trường này.

Lệnh kiểm (mục Test) in ra trình tự này để reviewer so.

### 5. Hợp đồng với e2e, `shots.mjs`, `main.ts` (luật 7)

Đọc qua `window.__petgame.game`, đã grep đủ trong `tests/e2e/multiplayer.spec.ts`, `scripts/shots.mjs` và stash T63:

| Thành viên của `Game` | Ai đọc | Cách dùng |
|---|---|---|
| `frames` | e2e (hơn 30 chỗ), shots | chờ khung mới |
| `debugInfo(prop?)` | e2e, shots | `.prop`, `.frames`, `.camera`, `.me`, `.server`, `.objects`, `.labels`, `.aim` |
| `pals` | e2e, stash T63 | `Map`; `.get(id).actor.pos`, `.get(id).tag.element`, `.size` |
| `players` | e2e | `Map`; `.get(id).actor` (`.pos`, `.root.alpha`), `.size` |
| `companions` | e2e | `.size` |
| `nodes` | e2e | mảng `gatherNodes` (`kind`, `x`, `y`, `radius`, `index`) |
| `scenery` | e2e | `.setFelled(i, false)` |
| `stage` | e2e | `.app.ticker` (`stop`, `start`) |
| `hud` | e2e, stash T63 | `.showToast(text, level)`, `.nameTop()` (thành viên riêng của `Hud`, đọc qua `as any`) |
| `labels` | shots | thay `labels.update` tạm thời trên chính đối tượng để đo thời gian |

`main.ts` dùng `Game.create(container, room, art, resolution, watch)` và `type GameAssets` từ `./game/Game.ts`, rồi gán `window.__petgame.game = game`. Các thứ này không đổi.

E2E còn bọc `room.send` (`recordSends`). Mọi tin vẫn đi qua `Game.send`, tức `this.room.send` của cùng đối tượng phòng.

### 6. Điện thoại, bàn phím, hiệu năng

Không đổi gì người chơi thấy hay bấm:
- `build()` giữ nguyên bản đồ phím (Space, Shift, E, B, R, H, M, N, 1-3), nút cảm ứng, joystick (`isTouch`), luật "một bảng mở một lúc" và `dialogOpen`/`panels` của `Keyboard`.
- Thêm 5 object nhỏ cho mỗi màn chơi, tạo một lần.
- Mỗi khung thêm 3 lời gọi phương thức (`controls.readInput`, `hudBridge.updateBossBar`, `hudBridge.updateHud`) và vài bước tra `.game`.
- Không cấp phát thêm gì mỗi khung. Ngân sách 600 sprite không đổi: không thêm `DisplayObject` nào. Shots kiểm lại số sprite.

## Kế hoạch triển khai

Chia thành **hai đợt** (xem "Đề xuất tách nhiệm vụ"), mỗi đợt một vòng coder → tester → reviewer và một commit. Mỗi phần (A, B, …) là một lần chuyển code. Sau mỗi phần phải xanh **trước khi** sang phần sau.

**Kiểm tra sau mỗi phần.** Ghi vào `PROGRESS.md` một dòng cho mỗi phần: tên phần, `wc -l` của `Game.ts` và của file mới, kết quả kiểm tra.
1. `npm run typecheck` sạch. Typecheck là phép kiểm đường gọi chính: module chỉ có `game` và phương thức của nó, nên một `this.x` quên đổi sẽ báo lỗi.
2. `npx vitest run packages/client`: 9 file, **110 test qua**.
3. `npm run build` qua.
4. `git add -N packages/client/src/game` để file mới hiện trong `git diff`. Lệnh chỉ đánh dấu ý định thêm, không commit.
5. Lệnh bảo toàn dòng và lệnh thứ tự đăng ký (mục Test) cho kết quả đúng như mô tả.

Nếu một phần làm đỏ: so lại phần vừa chuyển theo luật 1-8, không sửa gì ngoài phạm vi.

**Khi e2e đang chạy, không sửa file nào trong `packages/client`**: Vite dev sẽ tải lại mọi trang đang mở. Tắt `npm run dev` trước khi chạy e2e hay shots (cổng 2567, 5173, 2599).

### Đợt 1 (T11): hoạt ảnh chiêu, xử lý message, thao tác người chơi

**Phần 0: mốc trước khi sửa** (chạy ở BASE, trước mọi thay đổi code)
1. `npm run shots -- --name t11-base-1`, rồi `npm run shots -- --name t11-base-2`. Chạy hai lần để đo độ nhiễu: thú hoang đi lang thang, nước và lá chuyển động theo thời gian, nên hai lần chụp cùng code không bao giờ giống nhau từng điểm ảnh.
2. Ghi vào `PROGRESS.md`: số dòng `Game.ts` (1.512), số test, và đường dẫn hai thư mục `shots/`.
3. Nếu `npm run shots` không chạy được trong môi trường, ghi lý do vào `PROGRESS.md` và làm tiếp. Bằng chứng chính vẫn là bảo toàn dòng, typecheck và e2e.

**Phần A: chuẩn bị và `game/skillCasts.ts`**
1. `Game.ts`:
   - Bỏ `private` ở mọi trường trạng thái (dòng 166-244). Ba tham số hàm dựng `room`, `assets`, `watch` đổi thành `readonly`.
   - Thêm chú thích tiếng Anh trên khối trường: "Game state. The screen's parts (skillCasts.ts, serverEvents.ts, controls.ts, hudBridge.ts, stateSync.ts) read and write it through `this.game` when they need it and never keep a copy. E2E tests and scripts/shots.mjs read some of it through window.__petgame.game (docs/architecture.md), so keep the names."
   - Thêm `export` cho `interface Named` và `interface PalEntity`.
   - Bỏ `private` ở `me` và `nearMe`.
2. Tạo `game/skillCasts.ts`:
   - JSDoc của class: "Pal skills on screen: the wind-up in the element's color, the warning on the ground for a wild pal's skill, the skill's own animation (skillfx.ts) and chain lightning jumps."
   - `import type { Game, PalEntity } from "./Game.ts";`, import giá trị từ `@petgame/shared` và `./skillfx.ts`.
   - Chuyển `castSkill` (giữ nguyên JSDoc dài) và `chainJump`.
3. `Game.ts`:
   - `import { SkillCasts } from "./skillCasts.ts";`, thêm `readonly skillCasts = new SkillCasts(this);` (đặt các trường module ngay sau khối trường trạng thái, trước hàm dựng).
   - Handler SkillCast gọi `this.skillCasts.castSkill(msg)`, handler Hit gọi `this.skillCasts.chainJump(msg.companionId, pal)`.
   - Bỏ import không còn dùng (`chainBolt`, `chargeUp`, `danger`, `playSkill`, `skillPrelude`, `ELEMENT_COLOR`, `isSupport`...). Typecheck sẽ chỉ ra.

**Phần B: `game/serverEvents.ts`**
1. Trong `bindRoom`, dời khối `$.listen("dayTime", ...)` lên ngay sau `$.onRemove("fruits", ...)` (Thiết kế 4).
2. Tạo `game/serverEvents.ts`:
   - JSDoc của class: "What the server tells everyone (ServerMessage), played out on screen: effects, sounds, floating numbers and toasts."
   - Chuyển `QUEST_DELAY_MS`, `NOTICE_LEVEL` (kèm `import type { ToastLevel }`), `lootIcons`, `setFate` (private).
   - Tạo `bind()` với JSDoc "Registers a handler for every server message; called once, from Game.bindRoom." Thân là 18 lời gọi `this.room.onMessage(...)`, chuyển nguyên văn, đúng thứ tự, thành `this.game.room.onMessage(...)`. Thụt lề giữ 4 dấu cách như trong `bindRoom`.
   - Trong handler: `this.skillCasts.x` thành `this.game.skillCasts.x`; `this.setFate` giữ nguyên (cùng module).
3. `Game.ts`: `readonly serverEvents = new ServerEvents(this);`. `bindRoom` kết thúc bằng `this.serverEvents.bind();`. `Callbacks` vẫn ở `Game.ts` trong đợt này.

**Phần C: `game/controls.ts`, rồi tài liệu cho đợt 1**
1. Tạo `game/controls.ts`:
   - JSDoc của class: "What the local player does with keys, buttons and the stick: walk input, attack, dash, throw a ball, eat, switch balls. Each sends an intent; the server decides."
   - Chuyển 8 phương thức trong bảng, giữ thứ tự xuất hiện ở BASE: `eat`, `readInput`, `attack`, `dash`, `gatherSpot`, `nearestPal`, `throwBall`, `toggleBall`.
2. `Game.ts`:
   - `readonly controls = new Controls(this);`.
   - Trong `init`, callback của `Hud` và `Keyboard` gọi `this.controls.attack()`, `.dash()`, `.throwBall()`, `.toggleBall()`, `.eat()`.
   - `frame()` gọi `this.controls.readInput()`.
3. `docs/architecture.md`: viết theo Thiết kế ở phần G, nhưng chỉ cho 3 file đã có. Bullet `Game.ts` ghi rõ phần nào chưa tách (nối HUD, đồng bộ state, `looks`).
4. Cuối đợt chạy kiểm tra cuối đợt (mục Test).

### Đợt 2 (T11b): ngoại hình, nối HUD, đồng bộ state, tài liệu

Nếu thư mục `shots/t11-base-1` và `shots/t11-base-2` còn (container chưa bị thay), dùng lại làm mốc. Nếu mất, chạy lại Phần 0 ở commit của đợt 1, trước Phần D.

**Phần D: `game/looks.ts`**
- Chú thích đầu file: "What a synced explorer looks like and wears, as the lobby and the doll need it; plain functions (no game state)."
- Chuyển `Dressed`, `lookOf`, `wornOf`, `dressKey`, `remember`, `wornIcons`, mỗi cái thêm `export`. File chỉ import từ `@petgame/shared`.
- `Game.ts` import các hàm này từ `./looks.ts`. Lúc này `bindRoom` và `updateHud` vẫn ở `Game`.

**Phần E: `game/hudBridge.ts`**
1. Tạo class `HudBridge`:
   - JSDoc của class: "Wires the DOM HUD (ui/) to the game: builds the panels, buttons and keys, and refreshes them from the synced state every frame."
   - `build(container: HTMLElement, isTouch: boolean)` với JSDoc "Builds the HUD, the panels, the stick and the keys (once, from Game.init)." Thân là khối 299-359 chuyển nguyên văn: `this.hud = …` thành `this.game.hud = …`, `this.controls.attack()` thành `this.game.controls.attack()`... Biến cục bộ `panels` và `unlock` ở lại trong `build`.
   - Chuyển `tip`, `updateSkillBar`, `updateHud`, `updateRegion`, `updateMinimap`, `updateBossBar`.
2. `Game.ts`:
   - `init` thay khối bằng `this.hudBridge.build(container, isTouch);` đúng chỗ, giữa `this.labels = new Labels(...)` và `this.stage.app.renderer.on("resize", ...)`.
   - `frame()` gọi `this.hudBridge.updateBossBar();` rồi `this.hudBridge.updateHud();`.
   - `bindRoom` (callback dizzy của `pals`) gọi `this.hudBridge.tip(...)`.

**Phần F: `game/stateSync.ts`**
1. Thêm `export` cho `interface Camp` trong `Game.ts`.
2. Tạo class `StateSync`:
   - JSDoc của class: "Mirrors the synced room state on screen: players, wild pals, companions, camps, chests, felled trees and ripe fruit become actors, sprites and name tags (and go again)."
   - `bind()` với JSDoc "Registers the state callbacks (Callbacks) and the time of day; called once, from Game.bindRoom, before the message handlers." Thân: `const $ = Callbacks.get(this.game.room);`, 12 callback state, khối `dayTime`, đúng thứ tự sau Phần B.
   - Chuyển `AWAY_ALPHA`, `addHpBar`, `setHp`, `nameTag`, `updateHpBar`, `syncCamp`, `addActor`, `removeActor`.
3. `Game.ts`:
   - `bindRoom` còn `this.stateSync.bind();` rồi `this.serverEvents.bind();`.
   - `frame()` gọi `this.stateSync.removeActor(l.entity)`.

**Phần G: dọn dẹp và tài liệu**
1. `Game.ts`: bỏ import thừa (typecheck báo). Sửa JSDoc của class `Game` thành: "The game screen: owns the state and the frame loop (prediction, camera, drawing order) and hands the rest to its parts: stateSync (synced state on screen), serverEvents (server messages), skillCasts (skills), controls (the player's actions), hudBridge (the HUD)."
2. `docs/architecture.md`, mục `packages/client`:
   - Viết lại bullet `game/Game.ts`:
     - giữ gì: tạo màn chơi, trạng thái, `send` (giữ nguyên câu về `watch.online`), `watchConnection`, `bindRoom` (gọi `stateSync.bind` rồi `serverEvents.bind`), `frame()` (thứ tự: input, người chơi, thú hoang và vòng ngắm, thú đang rời, thú đi theo, camera, cảnh, hiệu ứng, HUD, `labels.update`), `lights`, `me`/`nearMe`, `debugInfo`;
     - giữ câu `window.__petgame` và thêm bảng Thiết kế 5 (rút gọn: tên trường và ai đọc);
     - giữ câu về người khác đang chờ nối lại (nay ở `stateSync.ts`).
   - Thêm bullet "Các phần của màn chơi (T11)" gồm một bảng 6 file với nội dung từng file (như bảng Thiết kế 3, không có số dòng), cùng luật làm việc:
     - trạng thái ở `Game`, tên trường là hợp đồng với e2e và shots;
     - module đọc `this.game.<trường>` ngay lúc dùng, không giữ bản sao (được tạo trước `init`);
     - chỉ `import type` giữa các module và từ `Game.ts` (trừ `looks.ts`);
     - gọi chéo qua `this.game.<module>`;
     - tin server mới thêm handler trong `serverEvents.bind`; widget HUD mới dựng trong `hudBridge.build`; thực thể đồng bộ mới thêm vào `stateSync.bind`; phím/nút mới gọi một phương thức của `controls`;
     - thêm module mới gồm file, trường `readonly x = new X(this)`, và một dòng trong bảng.
   - Bullet `entities.ts` (câu "Thú đang nhắm: `Game` tính `aimedId`... `throwBall` ném đúng con đó"): ghi `throwBall` (`game/controls.ts`).
   - Bullet `effects.ts`/`skillfx.ts`: thêm rằng `game/skillCasts.ts` gọi `skillfx.ts` khi nhận `SkillCast`.
   - Bullet `net/reconnect.ts` nhắc `bindRoom()`: giữ nguyên, vì `bindRoom` vẫn ở `Game`.
3. Chạy kiểm tra cuối đợt (mục Test).

## Giao thức

Không đổi gì: `schema.ts`, `messages.ts`, `Profile`/`sanitizeProfile`, dữ liệu đã lưu và `localStorage` (`petgame:look`, `petgame:worn` vẫn do `remember` ghi) giữ nguyên. Server không bị ảnh hưởng. Tin client gửi (loại, nội dung, thời điểm) giữ nguyên.

## Test

Không thêm và không sửa test. Bằng chứng "không đổi hành vi" gồm năm lớp, xếp từ mạnh tới yếu.

**1. Bảo toàn dòng (bằng chứng chính, tester và reviewer chạy, chỉ đọc).** Mỗi dòng của `Game.ts` ở BASE, sau khi chuẩn hoá đường gọi, phải còn ở `Game.ts` mới hoặc trong các file mới, và ngược lại:
```bash
S=<thư mục scratchpad>; cd /home/user/petgame; G=packages/client/src/game
MOD='skillCasts|serverEvents|controls|hudBridge|stateSync'
norm() { sed -E "s/^[[:space:]]+//; s/[[:space:]]+\$//; s/\b(private|readonly) //g; s/^export //; s/\bthis\.game\.($MOD)\./this./g; s/\bthis\.game\./this./g; s/\bthis\.($MOD)\./this./g" | grep -vE '^$|^(type )?[A-Za-z0-9_]+,$|^import |^\} from '; }
git show 767619d:$G/Game.ts | norm | sort > $S/before.txt
cat $G/Game.ts $(ls $G/{skillCasts,serverEvents,controls,looks,hudBridge,stateSync}.ts 2>/dev/null) | norm | sort > $S/after.txt
comm -23 $S/before.txt $S/after.txt   # dòng MẤT
comm -13 $S/before.txt $S/after.txt   # dòng MỚI
```
Designer đã chạy thử: ở BASE cả hai danh sách rỗng. Thêm một lần mô phỏng chuyển `castSkill`/`chainJump` sang file mới: MẤT rỗng, MỚI chỉ còn vỏ class.
- **Dòng MẤT phải rỗng.** Dòng `const $ = Callbacks.get(this.room);` vẫn còn (trong `stateSync.bind`, chuẩn hoá về cùng chữ). Mọi dòng mất là thay đổi hành vi tiềm tàng; reviewer phải đánh FAIL nếu không giải thích được.
- **Dòng MỚI chỉ được là:**
  - vỏ class (`class X {`, `constructor(game: Game) {}` sau chuẩn hoá) và JSDoc của class, chú thích đầu `looks.ts`;
  - trường `x = new X(this);`;
  - chữ ký và JSDoc của `bind()` (hai cái), `build(...)`, cùng lời gọi tới chúng (`this.bind();`, `this.build(container, isTouch);` sau chuẩn hoá);
  - chú thích mới trên khối trường trạng thái, JSDoc mới của class `Game`;
  - dấu `}` đóng.

  Ước lượng dưới 60 dòng sau cả hai đợt.

Xem nhanh các khối đã chuyển: `git diff --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change 767619d -- packages/client/src/game`. Thân hàm không đổi chữ hiện mờ.

**2. Thứ tự đăng ký** (chỉ đọc):
```bash
cd /home/user/petgame/packages/client/src/game
cat Game.ts $(ls stateSync.ts 2>/dev/null) serverEvents.ts | grep -oE '\$\.(onAdd|onRemove|listen)\("[a-zA-Z]+"|onMessage\(ServerMessage\.[A-Za-z]+'
```
Phải ra 31 dòng: 6 cặp `onAdd`/`onRemove` cho players, pals, felled, companions, chests, fruits; `listen("dayTime"`; rồi Harvested, ChestOpened, QuestDone, Hit, Lunge, Defeated, Gathered, Dashed, CaptureResult, Damage, Fainted, SkillCast, Healed, BossStomp, BossDefeated, Notice, LevelUp, Produced. Sau Phần F, `Game.ts` không còn dòng nào khớp mẫu này.

**3. Typecheck, unit test, build.**
- Sau mỗi phần: `npm run typecheck`, `npx vitest run packages/client` (110 test), `npm run build`.
- Cuối mỗi đợt: `npm test` (34 file, **505 test**).

**4. E2E** (cuối mỗi đợt): `npm run test:e2e`, 56 test, không đổi spec. Các test chạy qua gần như mọi phần đã chuyển:
- thao tác: chặt cây, lướt, đánh, ném, ăn, phím khi bảng mở;
- message: bắt thú, hạ gục, lên cấp, thông báo, chiêu trong trận;
- HUD: bảng thú, chế tạo, tủ đồ, bản đồ nhỏ, nhiệm vụ, thanh máu trùm;
- đồng bộ: 5 người chơi, nhãn tên, người chờ nối lại hiện mờ, thú đầu đàn ★;
- vòng ngắm.

Lỗi chập chờn đã biết, không do T11: `boss bar (phone upright, notch)` (T63, `QUESTIONS.md` Q1). Nếu chỉ test đó lỗi, chạy lại riêng nó (`npx playwright test -g "boss bar"`). Qua thì ghi vào `PROGRESS.md` là lỗi chập chờn đã biết. Lỗi lặp lại thì là FAIL như mọi lỗi khác.

**5. Ảnh chụp so sánh** (cuối mỗi đợt, sau e2e, không chạy song song):
1. `npm run shots -- --name t11-r1` (đợt 1) hoặc `--name t11-after` (đợt 2).
2. Viết script dưới đây vào scratchpad (không vào repo), rồi chạy `python3 -I <scratchpad>/shotdiff.py shots/t11-base-1 shots/t11-base-2 shots/t11-r1` (đợt 2 thay bằng `shots/t11-after`). Script so mỗi ảnh với mốc 1, lấy độ lệch giữa hai lần chụp mốc làm mức nhiễu.
   ```python
   """Compare two shots runs of the same code (noise) with a run of the new code.
   Usage: python3 -I shotdiff.py <base-1> <base-2> <after>   (folders written by npm run shots)"""
   import json, sys
   from pathlib import Path
   import numpy as np
   from PIL import Image

   b1, b2, af = (Path(p) for p in sys.argv[1:4])
   rep = {d: {r["file"]: r for r in json.loads((d / "report.json").read_text())} for d in (b1, b2, af)}

   def mad(x, y):
       a = np.asarray(Image.open(x).convert("RGB"), dtype=np.int16)
       b = np.asarray(Image.open(y).convert("RGB"), dtype=np.int16)
       return float(np.abs(a - b).mean()) if a.shape == b.shape else float("inf")

   flagged = 0
   for name in sorted(rep[b1]):
       r1, r2, ra = rep[b1][name], rep[b2].get(name), rep[af].get(name)
       if r2 is None or ra is None:
           print(f"{name:28} MISSING"); flagged += 1; continue
       noise = mad(b1 / f"{name}.png", b2 / f"{name}.png")
       diff = mad(b1 / f"{name}.png", af / f"{name}.png")
       s1, s2, sa = r1.get("sprites"), r2.get("sprites"), ra.get("sprites")
       sprite_ok = abs(sa - s1) <= max(3, 2 * abs(s2 - s1))
       image_ok = diff <= 2 * noise + 1.0
       aim_ok = not (r1.get("aimsWeak") and r2.get("aimsWeak")) or ra.get("aimsWeak")
       ov = [r.get("labels", {}).get("overlapping") for r in (r1, r2, ra)]
       label_ok = ov[2] is None or ov[2] <= max(ov[0], ov[1]) + 1
       ok = sprite_ok and image_ok and aim_ok and label_ok
       flagged += not ok
       print(f"{name:28} sprites {s1}/{s2}/{sa}  mad noise {noise:.2f} after {diff:.2f}  overlaps {ov}  {'ok' if ok else 'CHECK'}")
   print(f"{flagged} to check by eye")
   ```
   (Designer đã chạy thử script trên ảnh giả trong scratchpad.)
3. Mỗi ảnh có dòng `CHECK` thì mở ba ảnh (mốc 1, mốc 2, sau) bằng Read và so bằng mắt. Ghi vào `PROGRESS.md` khác biệt do nhiễu (thú khác chỗ, giờ trong ngày, hiệu ứng đang bay) hay do code. Khác biệt do code mà không giải thích được là FAIL.
4. Mọi ảnh trong `report.json` vẫn ≤ 600 sprite.
5. Dán bảng in ra của script vào `PROGRESS.md`. Không commit `shots/`.

Bước 5 là bằng chứng phụ: hình không so được từng byte vì thế giới tự chuyển động. Nếu không chạy được (môi trường, thiếu mốc), ghi rõ lý do. Khi bước 1-4 đã qua thì không coi đó là FAIL.

**Phạm vi file** (exit code phải là 0):
```bash
git diff --exit-code 767619d -- packages/client/src/game/labelLayout.ts packages/client/src/game/labelLayout.test.ts \
  tests playwright.config.ts vitest.config.ts scripts package.json packages/client/package.json packages/client/index.html \
  packages/client/src/main.ts packages/client/src/ui packages/client/src/net packages/shared packages/server \
  $(cd packages/client/src/game && ls *.ts art/*.ts | grep -vxE 'Game\.ts|skillCasts\.ts|serverEvents\.ts|controls\.ts|looks\.ts|hudBridge\.ts|stateSync\.ts' | sed 's|^|packages/client/src/game/|')
```
`git diff --stat 767619d` chỉ được có:
- `packages/client/src/game/Game.ts`;
- các file mới trong bảng (nhờ `git add -N`);
- `docs/architecture.md`;
- các file làm việc `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`.

## Tiêu chí hoàn thành

Mỗi đợt chấm theo phần đã làm. Đợt 2 chấm cả danh sách.

- [ ] `packages/client/src/game/` có `skillCasts.ts`, `serverEvents.ts`, `controls.ts` (đợt 1), `looks.ts`, `hudBridge.ts`, `stateSync.ts` (đợt 2). Mỗi file dưới 380 dòng, có JSDoc tiếng Anh cho class (hoặc chú thích đầu file với `looks.ts`).
- [ ] `Game.ts` dưới 1.060 dòng sau đợt 1, dưới 540 dòng sau đợt 2. Sau đợt 2 chỉ chứa những gì liệt kê ở "Ở lại `Game.ts`".
- [ ] Lệnh bảo toàn dòng: MẤT rỗng, MỚI chỉ gồm các loại liệt kê ở mục Test.
- [ ] Lệnh thứ tự đăng ký in đúng 31 dòng theo đúng thứ tự ở mục Test.
- [ ] Thứ tự lời gọi trong `frame()` không đổi. Lệnh `git diff 767619d -- packages/client/src/game/Game.ts` trong thân `frame()` chỉ có ba dòng đổi đường gọi (`controls.readInput`, `hudBridge.updateBossBar`/`updateHud`) và một dòng `stateSync.removeActor`.
- [ ] Module không giữ bản sao. `grep -nE "constructor\(" packages/client/src/game/{skillCasts,serverEvents,controls,hudBridge,stateSync}.ts` chỉ ra dạng `constructor(private readonly game: Game) {}`. `grep -nE "^\s+(private |readonly )*[a-zA-Z]+ = (this\.)?game\." <cùng các file>` không ra gì.
- [ ] Không có import giá trị giữa các module hay từ `Game.ts`. `grep -nE "from \"\./(Game|skillCasts|serverEvents|controls|hudBridge|stateSync)\.ts\"" packages/client/src/game/{skillCasts,serverEvents,controls,looks,hudBridge,stateSync}.ts | grep -v "import type"` không ra gì. `grep -n "from \"\./" packages/client/src/game/looks.ts` không ra gì.
- [ ] Hợp đồng e2e còn nguyên: `frames`, `debugInfo`, `pals`, `players`, `companions`, `nodes`, `scenery`, `stage`, `hud`, `labels` vẫn là thành viên của `Game`, cùng tên và kiểu. `debugInfo` không đổi một dòng. `frame()` vẫn gọi `this.labels.update(now, aimed?.tag)`.
- [ ] Hiệu năng: không closure, mảng hay object mới trong đường chạy mỗi khung. Bảo toàn dòng chứng minh điều này: dòng MỚI không có mã chạy mỗi khung. Không thêm `DisplayObject`. Mọi `destroy()` còn nguyên.
- [ ] Lệnh phạm vi file cho exit code 0. `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`, `scripts/shots.mjs` không đổi một byte nào.
- [ ] `npm run typecheck` sạch. `npx vitest run packages/client` qua 110/110. `npm test` qua 505/505. `npm run build` qua. `npm run test:e2e` qua 56/56, trừ lỗi chập chờn đã biết của T63 khi đã ghi rõ.
- [ ] `PROGRESS.md` có bảng so ảnh của `shotdiff.py` và giải thích cho mỗi dòng `CHECK`, hoặc lý do không chạy được.
- [ ] `docs/architecture.md`: bullet `Game.ts` đã viết lại kèm bảng hợp đồng `__petgame.game`; có bullet các phần của màn chơi (bảng và luật làm việc); `throwBall` và `skillCasts` được nhắc đúng file. Không còn câu nào nói `Game.ts` "xử lý mọi `ServerMessage`, cập nhật HUD".
- [ ] `PROGRESS.md` có một dòng cho mỗi phần (số dòng, kết quả kiểm tra), và ghi lại các lỗi thấy được mà không sửa (nếu có).
- [ ] Không có lệnh `git stash` nào trong lịch sử làm việc. `git stash list` vẫn có đúng hai mục như lúc bắt đầu.

## Rủi ro, câu hỏi mở

Không có mục "CHẶN:". Không có quyết định nào cần người dùng: giao thức, dữ liệu lưu và tính năng không đổi.

1. **`this` sai chỗ sau khi chuyển.** Handler trong `bind()` là arrow function, nên `this` giờ là module chứ không phải `Game`. Một `this.effects` quên đổi sẽ là lỗi typecheck vì module không có trường đó, nên typecheck bắt được hầu hết. Lệnh bảo toàn dòng bắt phần còn lại (ví dụ gọi nhầm phương thức của module khác).
2. **Module giữ bản sao trường** thì đọc `undefined` (tạo trước `init`) hoặc giá trị cũ (`dashing`, `useGreatBall` bị gán lại). Chặn bằng luật 2 và lệnh grep trong Tiêu chí.
3. **Đổi thứ tự đăng ký hay thứ tự trong `frame()`.** Chỉ di chuyển, không sắp xếp lại. Lệnh thứ tự đăng ký và diff của `frame()` kiểm điều này.
4. **Vòng import ES module.** Vite vẫn chạy được nhưng thứ tự khởi tạo module trở nên mong manh, và một module có thể nhận class `undefined` lúc `new`. Luật 4 và lệnh grep chặn việc này.
5. **`shots.mjs` thay `labels.update`.** Nếu ai đó lấy `update` ra biến tạm hoặc gọi qua module khác, phép đo thời gian nhãn của shots sẽ âm thầm đo sai. `frame()` ở lại `Game` và không đổi.
6. **Ảnh chụp nhiễu.** Thú hoang và nước chuyển động nên ảnh không bao giờ trùng. Script dùng hai lần chụp mốc làm mức nhiễu, phần còn lại so bằng mắt. Đây là bằng chứng phụ: không đủ bằng chứng mà vẫn kết luận thì không được, nhưng thiếu ảnh cũng không chặn được nhiệm vụ.
7. **Nhiệm vụ dở T63 trong stash.**
   - `stash@{0}` sửa `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`, `PROGRESS.md`, `REVIEW.md`. T11 không đụng ba file code đó, nên không có xung đột code.
   - E2E mới trong stash đọc `game.pals.get(id).tag.element`, `game.hud.nameTop()`, `game.debugInfo()`: đều giữ nguyên.
   - `PROGRESS.md` và `REVIEW.md` sẽ bị T11 ghi đè, nên khi agent chính `git stash pop` cho T63 sẽ xung đột ở hai file làm việc này. Cách gỡ: lấy bản trong stash cho hai file đó, vì nội dung T11 đã nằm trong commit.
   - Không ai được chạy `git stash` dưới bất kỳ dạng nào trong lúc làm T11/T11b. `stash@{1}` (đồ tạm của tester T63) cũng không đụng tới.
8. **Thời gian:** mỗi phần khoảng 1 phút kiểm tra (typecheck, test client, build). Cuối mỗi đợt có thêm `npm test` khoảng 2,5 phút, e2e khoảng 10 phút, mỗi lần shots vài phút. Không được bỏ bước kiểm tra giữa các phần: đó là cách khoanh lỗi vào đúng một lần chuyển.
9. **Nhiệm vụ sau đụng các file này.** T12 (gom chữ tiếng Việt) sẽ sửa chữ trong `serverEvents.ts`, `hudBridge.ts`, `controls.ts`, `stateSync.ts` thay vì `Game.ts`, nên nên làm sau T11b. T52 (màn lỗi trong `frame()`) và T14 (thêm ảnh vào shots) đọc lại code mới. Kế hoạch cũ nào ghi số dòng của `Game.ts` đều đã sai.
10. **Không còn test nào gọi `Game` bằng unit test.** E2E là lưới an toàn duy nhất cho hành vi. Vì vậy đợt nào cũng phải chạy đủ e2e, không được chạy một phần.

## Đề xuất tách nhiệm vụ (cho agent chính cập nhật `TASKS.md`)

Khoảng 980 dòng phải chuyển, sang 6 file. Một vòng coder vẫn làm được, nhưng e2e là lưới an toàn duy nhất nên nhỏ hơn thì dễ khoanh lỗi hơn. Đề xuất hai đợt, giống T10:

- **T11 (đợt 1, phần 0, A-C):** `skillCasts`, `serverEvents`, `controls`, kèm tài liệu cho phần đã tách. Khoảng 500 dòng. Commit riêng, ví dụ "Split Game.ts: skill casts, server events, controls (T11)".
- **T11b (đợt 2, phần D-G):** `looks`, `hudBridge`, `stateSync`, kèm tài liệu hoàn chỉnh. Khoảng 480 dòng. Commit riêng.
  - Thêm vào `TASKS.md` ngay dưới T11: "**T11b. Tách nốt `Game.ts`: nối HUD, đồng bộ state (thực thể, nhãn tên, trại), hàm ngoại hình** (đợt 2 của PLAN T11; làm ngay sau T11, cùng PLAN)".

Cả hai đợt dùng chung `PLAN.md` này, không cần gọi lại designer cho T11b. Mỗi đợt có ngân sách 3 vòng sửa riêng. Sau đợt 1 code vẫn chạy đúng và đủ test (mỗi phần tự đứng được), nên nếu T11b bị dừng thì T11 vẫn có giá trị.
