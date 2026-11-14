# PLAN: T57 Thú hiền chạy trốn về phía thoáng

Code đọc ở HEAD `0f9abf7`. Số liệu: `BALANCE.md` của T57 (commit `0f9abf7`). Phác thảo gốc: `git show a6f061c:PLAN.md`, mục "Việc cho agent chính" số 2.

Chỗ liên quan (số dòng ở HEAD):

| File | Dòng | Nội dung |
|---|---|---|
| `packages/server/src/ai/wildCombat.ts` | 57-63 | `stepFlee(pos, from, ...)`: đích = vị trí + 200 px thẳng ra xa `from`, `stepToward` rồi `obstacles.resolve` |
| `packages/server/src/rooms/GameRoom.ts` | 323 | `private fleeing = new Map<string, { from; until }>()` |
| `packages/server/src/rooms/GameRoom.ts` | 760-771 | nhánh chạy trốn trong `tick`; 765-768: bước rơi xuống biển thì đứng yên cả tick |
| `packages/server/src/rooms/GameRoom.ts` | 359 | `private paths = new PathPlanner(defaultNav())` |
| `packages/server/src/rooms/GameRoom.ts` | 1780-1790 | `provoke`: chỉ loài `passive` và `!pal.alpha` mới vào `fleeing` |
| `packages/server/src/ai/pathing.ts` | 91 | `constructor(private nav: NavGrid, ...)` |
| `packages/shared/src/combat.ts` | 23-38, 66-67 | `WILD_CHASE_SPEED_FACTOR`, `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, `FLEE_MS` |
| `packages/shared/src/pathfind.ts` | 95-129 | `NavGrid.clearanceAt`, `NavGrid.lineClear` (lấy mẫu mỗi 8 px, quét ô biển chính xác khi `sea: false`, ngoài thế giới coi là chặn) |
| `packages/server/src/ai/wildCombat.test.ts` | 24-40 | hai test `stepFlee` (phải đổi theo chữ ký mới) |
| `packages/server/src/rooms/GameRoom.test.ts` | 678-683 | `plantTrees` (thay `obstacles` và `paths`) |
| `packages/server/src/rooms/GameRoom.test.ts` | 1777-1784 | `westShore()` (nằm trong `describe("regions and climate")`) |
| `packages/server/src/rooms/GameRoom.test.ts` | 2177-2203 | "passive pals run away when hit", "a hit Voltmouse runs away slower than the player" |

## Mục tiêu

Người chơi đánh một thú hiền (Leafkit, Bubbloon, Voltmouse, Mothlume, Bogbloom) đứng cạnh gốc cây hay sát bờ biển thì thấy nó **lách sang bên mà chạy**, không còn đứng ì dí mặt vào thân cây hay mép nước cho tới hết 2,5 giây. Hôm nay 26% trận với thú hiền có lúc thú đứng ì từ 0,3 giây trở lên (đảo 39-45%, đầm lầy 19-32%), nhìn như lỗi. Sau thay đổi còn 0,3% (`BALANCE.md`). Thời gian hạ gục không đổi (2,63 thành 2,60 giây ở cấp 3), nên đây là sửa cảm giác và hình ảnh, không phải đổi cân bằng.

## Phạm vi

Làm:
- Hàm thuần chọn hướng chạy trốn `fleeDirection` và hàm giữ hướng `steerFlee`, cùng bảng hằng số `FLEE_STEER`, trong `packages/shared/src/combat.ts`, có test.
- `stepFlee` (server) nhận **hướng** thay cho vị trí kẻ đánh.
- `GameRoom`: giữ trạng thái hướng của mỗi thú đang chạy trong Map `fleeing` (chỉ server). Nhánh biển chọn lại hướng ở tick sau thay vì đợi hết thời gian giữ.
- `PathPlanner.nav` đọc được từ ngoài (để `GameRoom` và `plantTrees` của test dùng chung một `NavGrid`).
- Test shared, test server, sửa hai test `stepFlee`.
- Tài liệu: `docs/design/pals.md` (designer đã sửa trong commit kế hoạch này).

KHÔNG làm:
- Không đổi `WILD_FLEE_SPEED_CAP` (96), `fleeSpeed`, `FLEE_MS` (2500), `WILD_CHASE_SPEED_FACTOR`, đẩy lùi, tầm đánh (`BALANCE.md`: TTK không đổi).
- Không đụng nhánh đuổi (`stepChase`, `paths.steer`, nhánh thú đầu đàn về hang, trùm về nhà, nhánh "Wild pals cannot swim" ở `GameRoom.ts:798-802`), không đụng thú đi theo, lang thang (`brains`).
- **Không đổi cách đứng yên ở bờ biển thành trượt dọc bờ** (xem "Quyết định 2").
- Không đi qua ngân sách `paths.run` của `PathPlanner` (chi phí quá nhỏ, xem "Chi phí").
- Không đổi schema, message, hồ sơ lưu game, client, e2e.

## Thiết kế

### Luật chơi

1. Thú hiền bị đánh (hoặc thoát bóng) vẫn chạy 2,5 giây với `fleeSpeed`, như trước.
2. Hướng chạy: xét `FLEE_STEER.samples` = 9 hướng cách đều trong ±`halfAngleDeg` = ±70° quanh hướng thẳng ra xa kẻ đánh (bước 17,5°, có hướng 0°). Mỗi hướng là một đoạn dài `lookaheadPx` = 96 px từ chỗ thú đứng.
   - **Bỏ** hướng mà `nav.lineClear(pos, end, { radius, sea: false })` trả `false` (thân thú không đi thẳng hết đoạn: cây, đá, hồ, núi lửa, ô biển, ngoài thế giới).
   - **Điểm** = `alignWeight * cos(lệch) + clearanceWeight * min(nav.clearanceAt(end), NAV_MAX_CLEARANCE) / NAV_MAX_CLEARANCE`, với `alignWeight` = 1, `clearanceWeight` = 1.
   - Chọn điểm cao nhất. Thứ tự xét: 0°, +17,5°, −17,5°, +35°, −35°, ...; chỉ thay khi điểm **lớn hơn hẳn** (`>`), nên bằng điểm thì giữ hướng lệch ít hơn, và kết quả tất định (không cần `random`).
   - Kết quả gắn nhãn `"ahead"`.
3. **Dự phòng** khi cả 9 hướng bị bỏ: xét `fallbackSamples` = 16 hướng quanh cả vòng (bước 22,5°, thứ tự 0°, +22,5°, −22,5°, ..., 180°), cùng cách bỏ và chấm điểm (hướng lùi có `cos` âm nên bị phạt). Nhãn `"around"`.
4. Vẫn không còn hướng nào (thú bị vây kín): hướng thẳng ra xa như hôm nay, nhãn `"straight"`. Thú đứng đúng chỗ kẻ đánh (khoảng cách < 1e-6): coi hướng ra xa là xuống dưới màn hình `(0, 1)`, giống `knockback`, để không ra `NaN`.
5. **Giữ hướng** `holdMs` = 250 ms (5 tick). Chọn lại khi: (a) hết giờ giữ, (b) bị đánh lại (`provoke` tạo mục `fleeing` mới, `steerUntil = 0`), (c) bước kế rơi xuống biển (đặt `steerUntil = 0`). Hướng giữ là hướng tuyệt đối; khi chọn lại mới tính theo vị trí kẻ đánh lúc đó.
6. Đi theo hướng: như hôm nay, đích = vị trí + hướng × 200 px, `stepToward` với tốc độ `fleeSpeed`, trượt quanh vật cản bằng `obstacles.resolve`. Nhánh `isSea` giữ làm lưới an toàn.

Kết quả đo trước khi viết (bản mẫu chạy bằng `NavGrid` thật, script trong scratchpad, không vào repo):

| Cảnh | Nhãn | Hướng chọn | Cũ: dời được sau 1 s | Mới: dời được sau 1 s |
|---|---|---|---|---|
| Đất trống | ahead | 0° (đúng hướng thẳng) | 96 px | 96 px |
| Một cây r 14 ngay sau lưng, tâm cách 40 px | ahead | 52,5° | 14 px (kẹt 17/20 tick) | 94 px (kẹt 0) |
| Hàng 13 cây cách 40 px sau lưng | around | 112,5° (hơi chéo về phía kẻ đánh) | 14 px | 96 px |
| Bờ biển thẳng, biển cách 24 px sau lưng | around | 90° (dọc bờ) | 24 px (đứng yên 15/20 tick) | 96 px |
| Bờ biển, kẻ đánh chéo 34° | ahead | −52,5° (dọc bờ, ra xa) | | |
| Vòng cây kín | straight | 0° | | |
| `westShore()` thế giới thật, kẻ đánh ở phía đất | around | 90° | 24 px | 96 px |

### Quyết định 1: hàm thuần trong `combat.ts`, không cần `random`

`BALANCE.md` đề xuất `FLEE_STEER` trong `combat.ts`, cạnh `FLEE_MS` và `WILD_FLEE_SPEED_CAP`, để mọi số của việc chạy trốn ở một chỗ. Hàm chọn hướng tất định (thứ tự xét cố định, bằng điểm giữ hướng trước), nên test chính xác được mà không cần `random`. `combat.ts` import `NAV_MAX_CLEARANCE` và `type NavGrid` từ `pathfind.ts`: không có vòng import (`pathfind.ts` chỉ import `constants`, `terrain`, `worldgen`, `collision`; không file nào trong số đó import `combat.ts`).

Hàm nhận `nav: Pick<NavGrid, "clearanceAt" | "lineClear">` để test có thể dùng `NavGrid` thật dựng từ vòng tròn giả và `buildTerrain` (test dưới đây đều dùng `NavGrid` thật).

### Quyết định 2: không làm trượt dọc bờ ở `GameRoom.ts:765-768`

Nhánh "bước rơi xuống biển thì đứng yên cả tick" **giữ nguyên**, chỉ thêm `flee.steerUntil = 0` để tick sau chọn hướng mới. Lý do:
- `lineClear(..., { sea: false })` đã bỏ mọi hướng chạm biển trong 96 px, nên thú chỉ còn bước xuống biển khi ở nhánh `"straight"` (bị vây kín) hoặc ngay sau đẩy lùi sát bờ. Mô phỏng của balance-analyst giữ nguyên nhánh này mà vẫn đạt 0% tick kẹt ở đảo.
- Với `steerUntil = 0`, một lần chạm biển chỉ mất đúng 1 tick (50 ms) thay vì tới 250 ms.
- Trượt dọc bờ là đổi luật di chuyển chung với biển (cùng kiểu với nhánh đuổi ở 798-802 và người chơi), nên nếu cần thì làm thành nhiệm vụ riêng; hiện không có số liệu cho thấy cần.

### Quyết định 3: trạng thái giữ hướng trong `fleeing`

Mục `fleeing` của mỗi thú thêm `dirX`, `dirY`, `steerUntil` (kiểu `FleeSteerState` của shared). Không vào schema, không cần Map mới: mọi chỗ đang xoá `fleeing` (`daze`, `removePal`, hết giờ chạy) tự xoá luôn trạng thái hướng. `provoke` đặt mục mới nên đòn mới tự chọn lại hướng.

### Không ảnh hưởng thú khác

Chỉ thú trong `fleeing` dùng hàm mới, và `provoke` chỉ thêm vào `fleeing` loài `passive` không phải đầu đàn. Trùm (Boulderhorn, `aggressive`), thú tự vệ, hung dữ, đầu đàn (kể cả Voltmouse đầu đàn) không bao giờ vào `fleeing`. Nhánh đuổi không đổi một dòng nào.

### Chi phí

Một lần chọn hướng: tối đa 9 + 16 = 25 lần `lineClear` 96 px (12 mẫu mỗi lần), đo khoảng 4,2 µs cho trường hợp thường (`BALANCE.md`). Mỗi thú đang chạy chọn lại mỗi 250 ms; chỉ vài thú chạy cùng lúc. Không cấp phát mỗi tick: chỉ cấp phát khi chọn hướng (một object kết quả và một `NavBody`), và dùng lại một điểm tạm cấp module cho `end`.

### Chữ hiển thị, điều khiển

Không có chữ mới, không đổi thao tác cảm ứng hay bàn phím. Client chỉ vẽ vị trí server gửi; hình thú quay mặt theo hướng đi như cũ.

## Kế hoạch triển khai

### Bước 1. `packages/shared/src/combat.ts`

1. Import: `import { NAV_MAX_CLEARANCE, type NavGrid } from "./pathfind.ts";`. `Vec2` đã import từ `movement.ts`.
2. Ngay sau `FLEE_MS`, thêm bảng (JSDoc tiếng Anh, nói lý do từng số và trỏ `BALANCE.md` của T57, `docs/design/pals.md` "Chạy về phía thoáng"):
   ```ts
   export interface FleeSteerTable {
     halfAngleDeg: number;
     samples: number;
     lookaheadPx: number;
     alignWeight: number;
     clearanceWeight: number;
     holdMs: number;
     fallbackSamples: number;
   }
   export const FLEE_STEER: FleeSteerTable = {
     halfAngleDeg: 70,     // first pass never heads within 20° of sideways-toward the attacker
     samples: 9,           // odd, so straight away (0°) is one of them; 17.5° apart
     lookaheadPx: 96,      // one second of running at the cap, 6 nav cells
     alignWeight: 1,       // times cos(offset)
     clearanceWeight: 1,   // times min(clearanceAt(end), NAV_MAX_CLEARANCE) / NAV_MAX_CLEARANCE
     holdMs: 250,          // 5 ticks: halves sharp turns, 400 ms gained nothing
     fallbackSamples: 16,  // full circle, 22.5° apart, when every forward heading is blocked
   };
   ```
   Chú thích trong khối trên chỉ là gợi ý; coder viết JSDoc tiếng Anh cho bảng theo quy ước.
3. Kiểu:
   ```ts
   export type FleeHeading = "ahead" | "around" | "straight";
   export interface FleeChoice { x: number; y: number; heading: FleeHeading }
   /** Server-only steering memory of one fleeing pal. */
   export interface FleeSteerState { dirX: number; dirY: number; steerUntil: number }
   ```
4. `export function fleeDirection(pos: Vec2, from: Vec2, radius: number, nav: Pick<NavGrid, "clearanceAt" | "lineClear">, steer: FleeSteerTable = FLEE_STEER): FleeChoice` theo luật 2-4 ở trên:
   - hướng ra xa đơn vị `(ax, ay)` (khoảng cách < 1e-6 thì `(0, 1)`), góc gốc `base = Math.atan2(ay, ax)`;
   - một hàm trong (hoặc vòng lặp viết hai lần, tuỳ coder, miễn không trùng logic chấm điểm) `pick(n, stepRad)` duyệt `i = 0..n-1`, `m = Math.ceil(i / 2)`, `off = (i % 2 === 1 ? 1 : -1) * m * stepRad`; với `samples` thì `stepRad = toRad(2 * halfAngleDeg / (samples - 1))`, với `fallbackSamples` thì `stepRad = 2π / fallbackSamples` (với 16: `i = 15` cho `m = 8`, `off = +180°`, nên đủ 16 hướng khác nhau, chỉ một hướng 180°);
   - `end = pos + dir * lookaheadPx` ghi vào điểm tạm cấp module; `lineClear(pos, end, body)` sai thì bỏ; điểm như luật 2; giữ khi `score > best`;
   - trả `{ x, y, heading }` (hướng đơn vị).
5. `export function steerFlee(state: FleeSteerState, pos: Vec2, from: Vec2, radius: number, nav: Pick<NavGrid, "clearanceAt" | "lineClear">, now: number, steer: FleeSteerTable = FLEE_STEER): boolean`:
   - `now < state.steerUntil` thì không làm gì, trả `false`;
   - ngược lại gọi `fleeDirection`, ghi `dirX`, `dirY`, `steerUntil = now + steer.holdMs`, trả `true`.
   JSDoc: giữ hướng để không rung; `steerUntil = 0` buộc chọn lại ở lần gọi kế.

### Bước 2. `packages/server/src/ai/wildCombat.ts`

Đổi `stepFlee` thành nhận hướng đơn vị:
```ts
/** Runs along `dir` (a unit vector, from fleeDirection) at `speed`, sliding around obstacles. */
export function stepFlee(pos: Vec2, dir: Vec2, speed: number, dtMs: number, radius: number, obstacles?: CollisionGrid): Vec2
```
Thân: đích = `pos + dir * 200`, gọi `stepToward(pos, goal, 0, dtMs, radius, obstacles, speed)` như cũ.

### Bước 3. `packages/server/src/ai/pathing.ts`

Dòng 91: `private nav: NavGrid` thành `readonly nav: NavGrid` (JSDoc ngắn: GameRoom dùng chung lưới này cho thú chạy trốn). Không đổi gì khác.

### Bước 4. `packages/server/src/rooms/GameRoom.ts`

1. Import từ `@petgame/shared`: `steerFlee`, `type FleeSteerState` (giữ `fleeSpeed`, `FLEE_MS`).
2. Dòng 323: `private fleeing = new Map<string, { from: Pick<CombatTarget, "kind" | "id">; until: number } & FleeSteerState>();` (JSDoc: hướng đang giữ của thú chạy trốn, chỉ server).
3. `provoke` (1785): `this.fleeing.set(palId, { from: target, until: now + FLEE_MS, dirX: 0, dirY: 0, steerUntil: 0 });`.
4. Nhánh chạy trốn (760-770) thành:
   ```ts
   if (from) {
     // A passive pal runs away toward open ground, slower than a walking player (fleeSpeed).
     steerFlee(flee!, pos, from, radius, this.paths.nav, now);
     const next = stepFlee(pos, { x: flee!.dirX, y: flee!.dirY }, fleeSpeed(species.speed), dtMs, radius, this.obstacles);
     if (!isSea(this.terrain, next.x, next.y)) {
       pal.x = next.x;
       pal.y = next.y;
     } else {
       flee!.steerUntil = 0; // pick a new heading next tick instead of standing at the shore
     }
     return;
   }
   ```
   (Tránh `!` nếu TypeScript tự thu hẹp được: `from` chỉ có khi `flee` có. Object `{ x, y }` cho `stepFlee` mỗi tick là một object nhỏ như `pos` ở dòng 733, chấp nhận; hoặc truyền `flee` trực tiếp nếu coder đổi `stepFlee` nhận `{ dirX, dirY }`. Chọn cách gọn, ghi vào `PROGRESS.md`.)
5. Không đổi gì khác trong `tick`, `daze`, `removePal`.

### Bước 5. Test (xem mục "Test")

### Bước 6. Tài liệu

`docs/design/pals.md` đã được designer sửa trong commit kế hoạch (mục "Tính khí": câu thú hiền chạy và mục con "Chạy về phía thoáng"; mục "Đi vòng cây, đá": câu "Không tìm đường"). Coder chỉ sửa nếu tên hàm hay hằng số cuối cùng khác `FLEE_STEER`, `fleeDirection`, `steerFlee`. `docs/architecture.md` không nhắc `stepFlee`, không cần sửa.

## Giao thức

- `schema.ts`, `messages.ts`: không đổi.
- `Profile`, lưu game: không đổi.
- Client: không đổi. Export mới của shared (`FLEE_STEER`, `fleeDirection`, `steerFlee`, kiểu) client không dùng.
- API nội bộ server đổi: `stepFlee(pos, dir, ...)` (tham số thứ hai là hướng), `PathPlanner.nav` thành `readonly` công khai.

## Test

### Shared: `packages/shared/src/combat.test.ts`, `describe("fleeing toward open ground")`

Dựng cảnh bằng `new NavGrid(new CollisionGrid(circles), terrain?)` và `buildTerrain`. `C = { x: 3200, y: 2560 }`, cây `{ x, y, r: 14 }`, thân 12 (Voltmouse), kẻ đánh ở `C − (30, 0)` (hướng thẳng ra xa là `(1, 0)`). Hàm phụ trong test: `clearRay(nav, pos, dir, radius)` = `nav.lineClear(pos, pos + dir * FLEE_STEER.lookaheadPx, { radius, sea: false })`.

1. **Đất trống**: `fleeDirection` trả `heading "ahead"`, `x ≈ 1`, `y ≈ 0` (thẳng ra xa, như trước T57).
2. **Cạnh cây**: một cây tâm `C + (40, 0)`. Kỳ vọng `heading "ahead"`; hướng **không** thẳng (`x < cos(17.5°) − 1e-6`), vẫn trong ±70° (`x ≥ cos(70°) − 1e-6`); `clearRay` đúng; và chứng minh cảnh có nghĩa: `clearRay` theo `(1, 0)` sai. (Bản mẫu: 52,5°.)
3. **Hàng cây, dự phòng**: 13 cây tâm `x = C.x + 40`, `y` từ `C.y − 120` tới `C.y + 120` bước 20. Kỳ vọng `heading "around"`; `clearRay` đúng; góc lệch so với `(1, 0)` lớn hơn 70°. (Bản mẫu: 112,5°.)
4. **Bờ biển**: `terrain = buildTerrain((x) => (x < 3000 ? "sea" : "meadow"))`, nav không cây. Thú ở `(3024, C.y)`, kẻ đánh ở `(3054, C.y)` (biển sau lưng). Kỳ vọng `heading "around"`, `|y| > 0.99` (chạy dọc bờ, không ra biển), `clearRay` đúng, và `clearRay` theo hướng thẳng `(−1, 0)` sai. Thêm trường hợp kẻ đánh ở `(3054, C.y − 20)`: `heading "ahead"`, `y > 0` (ra xa phía kẻ đánh), `clearRay` đúng. (Bản mẫu: 90°, và −52,5°.)
5. **Bị vây kín**: vòng 40 cây tâm cách `C` 50 px. Kỳ vọng `heading "straight"`, `(x, y) ≈ (1, 0)`.
6. **Đứng trùng kẻ đánh**: `fleeDirection(C, C, 12, navTrống)` trả số hữu hạn, `(0, 1)`.
7. **Giữ 250 ms** (`steerFlee`): `state = { dirX: 0, dirY: 0, steerUntil: 0 }`, nav trống. `now = 0`, kẻ đánh ở phía tây: trả `true`, `dirX ≈ 1`, `steerUntil = 250`. Chuyển kẻ đánh sang phía đông; `now = 200`: trả `false`, `dirX ≈ 1` (giữ). `now = 250`: trả `true`, `dirX ≈ −1`. Đặt `state.steerUntil = 0` ở `now = 300`: trả `true` (chọn lại ngay).
8. **Bảng số**: `FLEE_STEER.samples` lẻ, `halfAngleDeg < 90`, `holdMs === 250`, `lookaheadPx === 96`, `fallbackSamples === 16` (khoá số đã cân bằng; đổi phải đổi có chủ ý cùng `BALANCE.md`).
9. **Tất định**: hai lần gọi cùng đầu vào ở cảnh 2 cho cùng kết quả (`toEqual`).

### Server unit: `packages/server/src/ai/wildCombat.test.ts`

- "runs straight away when fleeing" → đổi thành "runs along the given heading": `stepFlee({ x: 100, y: 100 }, { x: 1, y: 0 }, 200, 100, 10)` cho `(120, 100)`.
- "a player walking after a fleeing Voltmouse closes in": truyền hướng `{ x: 1, y: 0 }` thay cho `player`; giữ nguyên các kỳ vọng.

### Tích hợp server: `packages/server/src/rooms/GameRoom.test.ts`

Chuẩn bị: chuyển `westShore()` từ trong `describe("regions and climate")` ra cấp module (cạnh `plantTrees`), không đổi thân; test "stops players at the sea..." vẫn dùng nó.

Hai test mới trong `describe("combat")`, ngay sau "a hit Voltmouse runs away slower than the player". Cả hai: `room.state.pals.clear()`, gọi thẳng `(room as any).provoke(id, { kind: "player", id: client.sessionId })` (không gây sát thương, không đẩy lùi, nên tất định), rồi chạy 20 tick thật bằng `await room.waitForNextTimestep()` (đồng hồ chạy, nên thời gian giữ hết và hướng được chọn lại). Mỗi tick ghi quãng dời; "tick kẹt" = dời dưới 30% bước (`0.3 * fleeSpeed(voltmouse) * TICK_MS / 1000` ≈ 1,44 px).

1. **"a hit passive pal with a tree right behind it runs around the tree"**: `plantTrees(room, [{ x: C.x + 40, y: C.y, r: 14 }])` với `C = { x: 3200, y: 2560 }`; `player` ở `(C.x − 30, C.y)`; `placeWild(room, "voltmouse", player, 30)` (thú ở `C`). Kỳ vọng sau 20 tick: dời khỏi chỗ đầu ≥ 70 px, số tick kẹt ≤ 1, khoảng cách tới người chơi > 80 px, thú không lấn vào cây (`distance(pal, tree) ≥ 14 + 12 − 0.01`). Bản cũ: dời 14 px, kẹt 17 tick, cách người chơi 44 px, nên test này hỏng ở code cũ.
2. **"a hit passive pal at the shore runs along it instead of standing still"**: `plantTrees(room, [])` (bỏ cây, giữ địa hình thật); `s = westShore()`; `player` ở `(s.x + 30, s.y)`; `placeWild(room, "voltmouse", player, -30)` (thú ở `s`, biển cách 30 px phía tây). Kỳ vọng: mọi tick `isSea(defaultWorld().layout.terrain, pal.x, pal.y)` sai, dời ≥ 70 px sau 20 tick, số tick kẹt ≤ 1. Bản cũ: dời 24 px, đứng yên 15 tick.

Test đang có phải qua **không sửa**:
- "passive pals run away when hit" (2177): Leafkit tại chỗ người chơi xuất hiện; kể cả khi lệch tối đa 70° thì sau 1 giây khoảng cách vẫn khoảng 110 px > 100.
- "a hit Voltmouse runs away slower than the player" (2187): đất trống (`plantTrees(room, [])`), vòng tick đồng bộ không chạy đồng hồ, nên hướng chọn một lần ở 0°, quãng đúng bằng `fleeSpeed × 1 s`, `pal.x > start.x`.
- Các test ở `describe("finding a way around trees")`, `pathing.test.ts` (nhánh đuổi không đổi), test thú tự vệ, đầu đàn, trùm.

E2E: không thêm, không sửa (không đổi client, không có e2e nào kiểm thú hiền chạy trốn). Tester vẫn chạy `npm run test:e2e` như mọi nhiệm vụ.

## Tiêu chí hoàn thành

- [ ] `packages/shared/src/combat.ts` có `FLEE_STEER` đúng 7 số ở trên, `fleeDirection`, `steerFlee`, kiểu `FleeHeading`, `FleeChoice`, `FleeSteerState`; JSDoc tiếng Anh; không có số cứng của việc chọn hướng nằm ngoài `FLEE_STEER` (trừ `NAV_MAX_CLEARANCE` và `(0, 1)` cho trường hợp trùng chỗ).
- [ ] `fleeDirection` không dùng `Math.random` hay thời gian; kết quả tất định; bằng điểm thì giữ hướng lệch ít hơn.
- [ ] `stepFlee` nhận hướng; `PathPlanner.nav` là `readonly` công khai; `GameRoom` dùng `this.paths.nav` (nên `plantTrees` của test tự áp cho thú chạy trốn).
- [ ] Trạng thái giữ hướng nằm trong mục `fleeing` của `GameRoom` (`dirX`, `dirY`, `steerUntil`), không có trong schema; `provoke` đặt `steerUntil: 0`; nhánh biển đặt `steerUntil = 0`.
- [ ] `git diff` của `GameRoom.ts` chỉ chạm: import, khai báo `fleeing`, `provoke` dòng `fleeing.set`, nhánh chạy trốn trong `tick`. Không chạm nhánh đuổi, thú đầu đàn, trùm, thú đi theo.
- [ ] Không đổi `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, `FLEE_MS`, `WILD_CHASE_SPEED_FACTOR`, schema, message, `Profile`, client.
- [ ] 9 test shared ở trên có và qua; hai test `stepFlee` đã đổi chữ ký và qua; hai test tích hợp mới có và qua; `westShore()` ở cấp module.
- [ ] "passive pals run away when hit" và "a hit Voltmouse runs away slower than the player" qua **không sửa**.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] `docs/design/pals.md` khớp tên hàm và số trong code.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Dự phòng chạy hơi chéo về phía kẻ đánh** (cảnh hàng cây: 112,5°). Đây là hành vi "bị dồn vào tường" đã đo trong `BALANCE.md` (2-6% lần chọn ở đầm lầy, đảo). Khoảng cách gần nhất tới kẻ đánh chỉ giảm vài px (30 xuống khoảng 28 px ở cảnh thử) rồi tăng lại. Chấp nhận, đã ghi trong `pals.md`.
2. **Người chơi đuổi dưới 65% tốc độ** khó bắt Voltmouse, Mothlume hơn 25-40% (`BALANCE.md`, bảng 2). Không xử lý trong T57; nếu playtest cảm ứng cho thấy cần, hạ trần là nhiệm vụ riêng (balance-analyst đã gợi ý 0,55 × 160 = 88).
3. **Test bờ biển dựa vào thế giới cố định** (`westShore()` theo seed của `defaultWorld()`), giống test "stops players at the sea" đang có. Đổi worldgen có thể làm đổi chỗ bờ nhưng `westShore()` tự dò lại bờ, và test shared bờ biển dùng địa hình giả nên không phụ thuộc.
4. **Vòng `fallbackSamples` chẵn**: thứ tự `0, +22,5, −22,5, ..., +180` cho đúng 16 hướng khác nhau (một hướng 180°). Lỗi dễ gặp khi viết lại công thức: xét 180° hai lần hoặc thiếu một hướng; reviewer kiểm.
5. `lineClear` bỏ qua mẫu đầu (thú đã đứng đó), nên thú bị đẩy sát cây vẫn chọn được hướng. Nếu tester thấy thú bị đẩy lùi vào chỗ hẹp hơn thân rồi mọi hướng đều sai, nhánh `"straight"` vẫn giữ hành vi như trước T57, không tệ hơn.

## Việc cho agent chính

- Commit và push `PLAN.md` cùng `docs/design/pals.md` (đã sửa mục "Tính khí" và câu "Không tìm đường" ở mục "Đi vòng cây, đá") ngay sau bước 1.
- Không có nhiệm vụ mới cần thêm vào `TASKS.md` từ kế hoạch này. Ý "trượt dọc bờ biển cho mọi thú hoang" (Quyết định 2) chỉ thêm khi có số liệu cho thấy cần.
