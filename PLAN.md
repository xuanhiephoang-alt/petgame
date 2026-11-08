# PLAN: T9 Thú kẹt sau cây, đá khi đuổi theo

## Mục tiêu

- **Vấn đề:** thú chỉ trượt dọc vật cản (`CollisionGrid.resolve`), không tìm đường.
  - Khi đường thẳng tới mục tiêu bị cây, đá chắn, khoảng 1/6 số lần đuổi kẹt trong hốc giữa các vật cản tới hết 8 giây đuổi.
  - Người chơi đứng sau cụm cây là "an toàn" trước thú tự vệ, thú hung dữ.
  - Thú đi theo đứng ì sau cây trong khi chủ đánh thú hoang (12% số lần không tới được trong 6 giây).
  - Số đo ở mục Thiết kế 2.
- **Sau nhiệm vụ:**
  - Thú hoang (cả thú đầu đàn và trùm) đi vòng để tới kẻ nó đang đánh; thú đầu đàn đi vòng để về hang.
  - Thú đi theo đi vòng để tới chủ hoặc tới con thú chủ đang đánh.
  - Đường thẳng thông thì mọi thứ y như trước. Chi phí CPU có giới hạn cứng mỗi tick, kể cả khi khoảng 100 thú cùng cần đường.
- **Luật** đã ghi trong `docs/design/pals.md`, mục mới "Đi vòng cây, đá", và một câu trong mục "Tính khí". Game-designer đã sửa file này trong nhiệm vụ.

## Phạm vi

**Làm:**
- **shared:** file mới `pathfind.ts` (lưới đi lại `NavGrid`, A* `findPath`, `lineClear`, `defaultNav`) + `pathfind.test.ts` (unit + benchmark nhẹ); export trong `index.ts`.
- **server, `ai/`:**
  - file mới `pathing.ts` (`PathPlanner`: khi nào tìm, đi theo điểm mốc, hàng đợi, ngân sách) + `pathing.test.ts`;
  - tham số `via` cho `stepChase` (`wildCombat.ts`) và `stepCompanion` (`companion.ts`); hàm `companionReach`; test.
- **`GameRoom.ts`:** trường `paths`; ba chỗ gọi (đuổi, về hang, thú đi theo); `paths.run(now)` mỗi tick; dọn trong `removePal`, `despawnCompanion`.
- **`GameRoom.test.ts`:** 3 test tích hợp mới.
- **`docs/architecture.md`:** 4 chỗ (bước 9).

**KHÔNG làm:**
- Không đổi client, schema, message, hồ sơ lưu. Thú chỉ đi khác ở server; client vẫn nội suy vị trí như cũ.
- Không tìm đường cho:
  - thú hiền chạy trốn (`stepFlee`, không có đích);
  - lang thang (`stepWander` tự đổi đích khi bị chặn);
  - thú làm việc đi tới chỗ làm ở trại;
  - trùm lang thang về nhà khi đi quá `BOSS_LEASH`: nhánh lang thang, gắn với việc T21 (xem đề xuất cuối).
- Không đổi luật đuổi: thời gian đuổi 8 giây (`WILD_AGGRO_MS`), tốc độ, tầm cắn, khoảng bám 56 px, nhảy về chủ khi cách quá 480 px (`COMPANION_TELEPORT_DISTANCE`). Không thêm luật "bỏ đuổi khi không có đường".
- Không đổi `CollisionGrid` (client dùng chung để đoán chuyển động) và `worldgen.ts`.
- Không sửa bán kính lang thang 20 của trùm (việc T21).
- Không đổi số cân bằng: không cần balance-analyst (lý do ở Thiết kế 7).

## Thiết kế

### 1. Hiện trạng (HEAD `2fd24ba`)

**Vòng tick** (`packages/server/src/rooms/GameRoom.ts`):
- `setSimulationInterval(tick, TICK_MS)` ở dòng 475: 20 tick/giây, `dtMs` ≈ 50.
- `tick` (dòng 638-757), lần lượt:
  - người chơi;
  - vòng thú hoang (dòng 650-740), mỗi con mỗi tick:
    - bán kính `radius = pal.boss ? BOSS.radius : species.size` (dòng 662);
    - thú đầu đàn bị kéo quá `ALPHA.leash` thì về hang: `stepChase(pos, home, …, 8)` (dòng 664-677);
    - chạy trốn: `stepFlee` (dòng 678-688);
    - đuổi: `stepChase(pos, target.pos, …, reach)` (dòng 705-706); bước rơi xuống biển thì bỏ (dòng 707-711);
    - lang thang: `stepWander` (dòng 722-739);
  - `tickCompanions` (dòng 742; định nghĩa dòng 759-839):
    - thú làm việc: `stepToward` tới chỗ làm (dòng 773-795);
    - thú đi theo: `stepCompanion(companion, owner, target, …)` (dòng 803).

**Hàm AI** (`packages/server/src/ai/`):
- `stepChase` (`wildCombat.ts` dòng 37-48) gọi `stepToward(pos, target, range * 0.7, …)`: đi thẳng, dừng ở 70% tầm cắn, `inRange` khi ≤ `range`.
- `stepToward` (`companion.ts` dòng 21-35): bước thẳng rồi `obstacles.resolve(next, radius)`.
- `stepCompanion` (`companion.ts` dòng 42-59):
  - cách chủ quá 480 px thì nhảy về cạnh chủ;
  - không thì đi thẳng tới mục tiêu (dừng ở `COMPANION_ATTACK_RANGE * 0.8 + radius`) hoặc tới chủ (dừng ở 56).
- `stepWander` (`wander.ts` dòng 42-76): tiến dưới 30% bước thì đổi đích.

**`CollisionGrid`** (`packages/shared/src/collision.ts`):
- Ô băm 96 px trong một `Map<number, Circle[]>` (dòng 16-33, khoá băm dòng 74-76).
- `query` tạo `Set` và mảng mới mỗi lần (dòng 36-43). `blocked` (dòng 45-47).
- `resolve` (dòng 53-72): tối đa 3 lượt, đẩy thân ra theo pháp tuyến mỗi vòng tròn chạm.
  - Lao thẳng vào tâm một thân cây thì lực đẩy triệt tiêu bước đi: đứng yên.
  - Hai cây gần nhau tạo hốc: kẹt ở đáy hốc.
- Vật cản sinh trong `worldgen.ts` (dòng 308-312), `defaultWorld()` dòng 336-342. Gồm 1.455 vòng tròn:
  - lửa trại (27 px), núi lửa (112 px);
  - 54 vòng hồ;
  - 1.399 cây, đá: bán kính 5-59, trung vị 12,6, p90 22.

**Bán kính thân** (dùng cho va chạm):

| Ai | Bán kính |
|---|---|
| Thú thường, theo loài (`pals.json`) | Voltmouse 12, Mothlume 13, Leafkit 14, 15-16 phần lớn, Pebblet và Frostfang 17, Boulderhorn 20 |
| Thú đầu đàn | `species.size` (hình to 1,6 lần chỉ là hình vẽ) |
| Trùm khi đuổi, cắn | `BOSS.radius` 40 (`boss.ts` dòng 23) |
| Trùm khi lang thang | 20 (lỗi T21, `GameRoom.ts` dòng 731) |
| Thú đi theo | `species.size` |

**Tốc độ:**
- Đuổi: `species.speed × 1,8` (`WILD_CHASE_SPEED_FACTOR`), tức 54-171 px/s.
- Thú đi theo 190 px/s (`COMPANION_SPEED`).

**Số thú mỗi phòng:**
- `WILD_PAL_TARGET` 80, +3 ban đêm, + trùm + 6 thú đầu đàn: khoảng 90 thú hoang.
- Tối đa 5 thú đi theo, cộng thú làm việc (không đuổi).

### 2. Số đo "trước" (script chỉ đọc trên `defaultWorld()`)

Script nằm trong scratchpad, ngoài repo; không file nào trong repo bị đổi khi đo.
- Mô phỏng hàm thật `stepChase` / `stepCompanion` với `defaultWorld().grid`, 20 tick/giây.
- Seed cố định.
- Bản mẫu A* để so "sau" và đo chi phí.

**A. Thú hoang đuổi mục tiêu đứng yên** cách 60-320 px. Mỗi loại thân 1.500 cặp; chỉ tính cặp có đường đi thật.

| Thân | Đường thẳng bị chắn | Tới trong 8 giây khi bị chắn, trước | Sau (bản mẫu) | Tới trong 8 giây, mọi cặp, trước → sau |
|---|---|---|---|---|
| Emberpup (15, 126 px/s) | 38% | 84,0% | 99,3% | 93,9% → 99,7% |
| Boulderhorn (20, 81 px/s) | 43% | 81,1% | 99,7% | 91,9% → 99,9% |
| Trùm (40, 81 px/s, tầm 64) | 57% | 77,5% | 93,9% | 87,2% → 96,5% |

- **Bao lâu:** 4.000 lần Emberpup đuổi khi bị chắn, 15,6% kẹt tới hết 8 giây: kẹt từ lúc chạm vật cản tới hết giờ, trung vị 7,1 giây, p90 7,7 giây.
- **Kẹt vào gì:**
  - 87% kẹt trong hốc chạm từ hai vật cản trở lên;
  - theo loại vật cản: cây 57%, đá 23%, cây cùng đá 14%, hồ 2%, còn lại (lắc qua lại, bờ biển) 4%.
- **Kẹt ở đâu** (tỉ lệ kẹt trong số lần đuổi bị chắn): đầm lầy 40%, đồng cỏ (rừng) 28%, núi tuyết 16%, núi lửa 11%, sa mạc 8%, đảo 4%.
- **Trùm** sau T9 vẫn không tới khoảng 6%: phần lớn cần hơn 8 giây kể cả theo đường ngắn nhất, hoặc thân 80 px không lọt.

**B. Người chơi bị đuổi chạy 1,5 giây rồi đứng:** trước T9 đã tới 100%, vì thú đi theo vết người chơi.
- Vậy kẹt xảy ra khi vật cản nằm giữa ngay từ đầu cuộc đuổi:
  - thú hung dữ thấy người trong 120 px;
  - thú thoát bóng đuổi người ném (tới 180 px);
  - đòn hay chiêu của thú đi theo;
  - mục tiêu là thú đi theo.

**C. Thú đi theo:**
- Lao vào thú hoang đứng sau vật cản, cách 80-280 px (1.000 lần): tới trong 6 giây (`COMPANION_AGGRO_MS`) 88,0% → 99,7%.
- Bám chủ đi đường bình thường (120 lượt, 52 phút đi): nhảy về chủ 0,06 lần/phút, xa chủ quá 150 px 0,8% thời gian. Sau T9 như cũ (0,02 lần/phút, 0,9%).
- Chủ (thân 12) lách khe mà thú (thân 17) không lọt: còn xa chủ quá 120 px trong 5 giây cuối 1,8% → 0%.
- Tóm lại: bám chủ vốn ít kẹt; lợi lớn ở lao vào đánh.

**D. Cảnh test "chén cây"** (mục Test):
- Trước T9 cả 4 trường hợp kẹt tới hết giờ.
- Sau (bản mẫu):
  - Emberpup tới tầm cắn sau 3,25 giây;
  - Boulderhorn sau 5,25 giây;
  - thú đi theo tới cạnh chủ sau 2,05 giây;
  - thú đi theo tới đánh được thú hoang sau 2,10 giây.
- Mỗi trường hợp 1 lần tìm, khoảng 125 ô.

### 3. Lưới đi lại `NavGrid` (shared)

**Ô 16 px** (`NAV_CELL = TERRAIN_CELL`): 400 × 300 = 120.000 ô, khớp đúng từng ô của `Terrain`.
- Cờ biển của mỗi ô chính xác.
- 16 px giữ được các khe 24-34 px giữa thân cây. Ô 32 px làm mất các khe đó, và tâm ô cách điểm thật tới 23 px.

**Mỗi ô lưu khoảng trống** (`clearance`, `Uint8Array`):
- Giá trị: khoảng cách từ tâm ô tới mép vật cản gần nhất, làm tròn xuống, kẹp trong [0, `NAV_MAX_CLEARANCE` = 64]. Bên trong vật cản là 0.
- Một ô **mở cho một thân** bán kính `r` khi `clearance ≥ r`, và không phải biển trừ khi thân đó được qua biển.
- Một lưới dùng cho mọi bán kính (12 tới 40), không cần một lưới cho mỗi cỡ thân.
- Đã kiểm: với bán kính nguyên, "ô mở" trùng **tuyệt đối** với `!grid.blocked(tâm ô, r)` trên toàn thế giới. Đo 960.000 lần (8 bán kính × 120.000 ô): 0 lần lệch. Unit test giữ tính chất này.

**Dựng một lần** từ `CollisionGrid.circles` và `Terrain`:
- Với mỗi vòng tròn, duyệt các ô trong `c.r + 64` quanh nó, lấy `min`. Khoảng 110 nghìn phép, đo 14 ms.
- Cờ biển: `isSea(terrain, tâm ô)` từng ô. Không có `terrain` thì không ô nào là biển (test).
- Ngoài thế giới coi như đóng.
- Đất liền bị đóng: thân 12 đóng 18%, thân 15 đóng 21%, thân 20 đóng 27%, thân 40 đóng 49%.

**`clearanceAt(x, y)`:** nội suy song tuyến giữa 4 tâm ô quanh điểm; điểm ngoài lưới tính là 0.
- Chọn nội suy thay vì lấy ô gần nhất: trên cùng bộ 1.500 cặp, cách lấy ô gần nhất báo "bị chắn" nhiều hơn 5-8% (tìm đường thừa) và tới đích ít hơn.
- Ví dụ Boulderhorn: 98,3% thay vì 99,7%.

**`lineClear(from, to, body, stopShort = 0)`:** đường thẳng có đủ rộng cho thân không.
- Lấy mẫu mỗi 8 px (`NAV_CELL / 2`), gồm cả hai đầu, dừng `stopShort` px trước `to`.
- Mỗi mẫu cần `clearanceAt ≥ radius`; nếu thân không qua biển thì ô dưới mẫu không phải biển.
- Không tạo object. Viết chặt (không closure), bản mẫu đo 0,65 µs cho 300 px thông, 0,21 µs khi bị chắn (dừng sớm).

**Bộ nhớ và chia sẻ:**
- Lưới khoảng 240 KB. Mảng nháp A* khoảng 2 MB, cấp một lần ở lần tìm đầu.
- `defaultNav()` dựng một lần mỗi process (như `defaultWorld()`), mọi phòng dùng chung.
- An toàn vì `findPath` chạy đồng bộ, không nhường lượt.

### 4. A* (`NavGrid.findPath`) và làm mượt

**Truy vấn:** `findPath(from, to, { radius, sea, goalRadius, maxNodes, weight? })` trả `{ status: "found" | "none" | "limit", path: Vec2[], expanded }`.

**Lưới và bước đi:**
- 8 hướng; đi thẳng tốn 16, đi chéo tốn 16·√2.
- Không cắt góc: đi chéo chỉ khi cả hai ô cạnh đều mở.
- Thứ tự xét láng giềng cố định (Đ, T, N, B, rồi 4 góc), nên kết quả tất định.

**Ô đầu:** ô chứa `from` (kẹp vào lưới), **luôn được nhận** dù không mở.
- Thân có thể đứng sát cây hợp lệ trong khi tâm ô hẹp hơn thân.
- Các ô sau phải mở.

**Đích là một vùng:**
- Thành công khi lấy ra một ô có tâm cách `to` không quá `max(goalRadius, NAV_CELL)`.
- Mục tiêu đứng chỗ hẹp (người chơi thân 12 sát cây) vẫn tới được, vì chỉ cần một ô mở trong tầm.
- Ô đầu thoả luôn thì `found` với `path` rỗng.

**Heuristic:** khoảng cách octile từ tâm ô tới `to`, nhân `PATH_HEURISTIC_WEIGHT` = 1,2. So trên 2.000 cặp bị chắn (thân 15, 60-320 px):

| Trọng số | Ô xét, trung vị | Ô xét, p90 | Đường dài hơn tối ưu, p99 |
|---|---|---|---|
| 1 | 30 | 94 | 0% |
| 1,2 | 17 | 69 | 7,7% |
| 1,5 | 16 | 50 | 10,6% |

Chọn 1,2: bớt 43% số ô ở trung vị, đường gần như tối ưu.

**Giới hạn:**
- Xét tối đa `maxNodes` ô. Hết mà chưa tới thì `"limit"`, khi đó `expanded === maxNodes`.
- Hết ô để xét thì `"none"`: bị nhốt, ví dụ trong vòng cây kín.
- `radius > NAV_MAX_CLEARANCE` thì `"none"` ngay với `expanded` 0 (không ô nào đủ rộng). Không ném lỗi trong tick.

**Mảng nháp** (cấp một lần, không xoá giữa các lần tìm):
- Dấu lượt tìm: `Uint32Array` "đã gặp" và "đã đóng", so với số lượt tăng dần mỗi lần tìm.
- `g: Float32Array`, `parent: Int32Array`.
- Heap nhị phân trên `Int32Array` + `Float32Array`, sức chứa `maxNodes × 8 + 8`, nới khi truy vấn cần nhiều hơn. Cho phép trùng, bỏ ô đã đóng khi lấy ra.
- **Không xoá 120.000 ô mỗi lần tìm.**

**Làm mượt** ("kéo dây" tham lam bằng `lineClear` cùng thân):
- Neo = `from`.
- Từ neo, đi xa nhất có thể theo dãy tâm ô mà vẫn thấy được, lấy điểm đó làm điểm mốc và làm neo mới. Lặp tới hết.
- Không có điểm nào xa hơn thấy được thì vẫn lấy điểm kế tiếp.
- `path` không gồm `from`; điểm cuối là ô đích (trong `goalRadius` của `to`).
- Đo: trung vị 25 ô thành 3 điểm mốc (p99: 48 ô thành 8 điểm), 395 mẫu (p99 1.200), khoảng 10-30 µs.

### 5. Khi nào tìm, đi theo điểm mốc, khi nào tính lại (`PathPlanner.steer`, server)

**Mỗi tick, mỗi con đang đuổi** gọi `paths.steer(key, pos, goal, walker, now)` ngay trước bước đi.
- Hàm trả điểm phải đi tới tick này: chính `goal` (đi thẳng như cũ) hoặc một điểm mốc.
- `key` là `"w:<id thú hoang>"` hoặc `"c:<id OwnedPal>"`, như `skillReady`.
- `walker = { radius, sea, goalRadius, step }`:
  - `goalRadius`: cách bao nhiêu là "đã tới" (tầm cắn, tầm đánh, khoảng bám, vùng về hang);
  - `step`: số px đi được tick này, để biết kẹt.

**Trạng thái mỗi con** (`Track`, chỉ server, trong `Map` của planner):
- `path`, `next`: điểm mốc và chỉ số điểm đang tới;
- `pathGoal`: đích lúc tìm;
- `lastPos`, `lastSteerAt`;
- `stuck`: số tick liền gần như đứng yên;
- `forced`: đường này có vì bị kẹt;
- `nextSearchAt`;
- `query`: `from`, `goal`, `walker` mới nhất, cho lần tìm.
- Chép `x`, `y` vào object của `Track`, **không giữ tham chiếu tới object schema** (nó di chuyển).

**Luật** (theo thứ tự, mỗi lần gọi):
1. **Bị dời đi:** cách `lastPos` quá `jumpPx` (64 px) thì bỏ đường, `stuck = 0`.
   - Ví dụ: nhảy về chủ, dịch chuyển thử nghiệm, chuyển chế độ.
   - 64 lớn hơn mọi cú đẩy: dậm 44, chiêu tối đa 30.
2. **Đếm kẹt:** ngược lại, nếu đi chưa tới 30% `step` từ lần gọi trước và chưa trong `goalRadius` thì `stuck += 1`; không thì `stuck = 0`. Ghi `lastPos`, `lastSteerAt`.
3. **Đã trong `goalRadius`:** bỏ đường, trả `goal`.
   - Thú đứng cắn qua thân cây như trước, nhịp cắn không đổi.
   - Vì vậy `goalRadius` là **tầm** (cắn 40, trùm 64, thú đi theo đánh `40 + thân`), không phải khoảng dừng 70%.
   - Đo: dùng tầm cho kết quả bằng hoặc tốt hơn khoảng dừng (bảng mục 2 là số với tầm).
4. **Kẹt mà chưa có đường:** `stuck ≥ stuckTicks` (6 tick, 0,3 giây) và chưa có `path` thì đặt `forced = true`.
5. **Đường thẳng thông:** nếu không `forced` và `lineClear(pos, goal, walker, goalRadius)` thì bỏ đường, trả `goal`.
   - Đây là trường hợp thường gặp: hành vi y như trước T9.
   - Kiểm tới điểm `goalRadius` trước mục tiêu, vì chỉ cần tới được tầm.
6. **Đang có đường:**
   - Bỏ qua các điểm mốc đã thấy được: tối đa `lookahead` (2) lần `lineClear(pos, path[next + 1])`.
   - Bỏ qua điểm cách `pos` không quá `max(4, step)`.
   - Hết điểm thì bỏ đường.
7. **Cần tìm** khi:
   - chưa có đường; hoặc
   - đích đã dời quá `repathPx` (48 px, 3 ô; người chơi chạy 48 px mất 0,3 giây) khỏi `pathGoal`; hoặc
   - `stuck ≥ stuckTicks` dù đang có đường (đường bị chặn hay kém).

   Cần tìm và `now ≥ nextSearchAt` thì ghi `query` và xếp hàng (mỗi con tối đa 1 chỗ trong hàng).
8. **Trả** `path[next]` nếu có đường. Không thì trả `goal`: trượt thẳng như cũ trong lúc chờ, hoặc khi không có đường.

**Bỏ đường** = `path = undefined`, `next = 0`, `forced = false`.

**Kết quả tìm** (trong `run`):
- `stuck = 0`.
- `found` có điểm mốc: gán `path`, `next = 0`, `pathGoal`, `nextSearchAt = now + retryMs` (500).
  - `forced` giữ nguyên: đường có vì kẹt thì đi hết, không lấy lối tắt ở luật 5 (lối tắt chính là thứ đã làm nó kẹt).
- `found` rỗng: bỏ đường, `nextSearchAt = now + retryMs`.
- `none` / `limit`: bỏ đường, `nextSearchAt = now + failRetryMs` (2000). Thú trượt như cũ, 2 giây sau thử lại.

### 6. Hàng đợi và ngân sách mỗi tick (`PathPlanner.run`)

**Hàng đợi:** `Set<string>` các `key`, giữ thứ tự xếp đầu tiên (FIFO; thêm lại không đổi chỗ).

**`run(now)`** gọi một lần mỗi tick, sau vòng thú hoang và `tickCompanions`. Duyệt hàng từ đầu:
- Dừng khi đã chạy `searchesPerTick` (8) lần tìm, hoặc khi `đã xét + maxNodes > tickBudget`.
  - Với `maxNodes` 1.500 và `tickBudget` 3.000: một lần tìm chỉ bắt đầu khi đã xét không quá 1.500 ô.
  - Nên **một tick không bao giờ quá 3.000 ô**, và luôn chạy được ít nhất 1 lần tìm.
- Mỗi `key` lấy ra thì xoá khỏi hàng.
  - Không còn `Track`, hoặc không gọi `steer` trong `staleMs` (250 ms; đã thôi đuổi, đang choáng, đang gồng hay tung chiêu): bỏ, không tìm.
  - Ngược lại tìm với `maxNodes`, áp kết quả (mục 5).
- Ghi `lastRun = { searches, expanded }` cho test.

**Hệ quả:**
- Thường mỗi tick 0-2 lần tìm, mỗi lần khoảng 17 ô.
- 100 con cùng cần đường một lúc thì con cuối được phục vụ ở tick 13 (0,65 giây). Trong lúc chờ nó trượt như cũ.
- Một con tìm tối đa 2 lần mỗi giây; con không có đường tốn tối đa 1.500 ô mỗi 2 giây.

### 7. Áp dụng cho ai

| Ai | Chỗ gọi | `goal` | `goalRadius` | `radius` | `sea` | `step` |
|---|---|---|---|---|---|---|
| Thú hoang, thú đầu đàn đuổi | dòng 705-706 | `target.pos` | `range` (40) | `species.size` | false | `species.speed × 1,8 × dt` |
| Trùm đuổi | cùng chỗ | `target.pos` | `range` = `BOSS.radius + 24` (64) | 40 | false | như trên |
| Thú đầu đàn về hang | dòng 672 | `home` | `ALPHA.roam × 0,5` (64, đúng mốc kết thúc về hang ở dòng 675) | `species.size` | false | như trên |
| Thú đi theo (bám chủ, lao vào đánh) | dòng 803 | `target ?? owner` | `companionReach(radius, !!target)`: `40 + radius` khi đánh, 56 khi bám | `species.size` | true (theo chủ đi bè như trước) | `COMPANION_SPEED × dt` |

**Trùm có tìm đường**, với thân 40:
- Lợi: 77,5% → 93,9% khi bị chắn.
- Chi phí: thân 80 px ít lối đi, nên khoảng 28% lần tìm của trùm hết giới hạn hoặc không có đường. Mỗi lần như vậy tốn tối đa 1.500 ô mỗi 2 giây, chỉ một con.

**Thú đi theo cách chủ quá 480 px** thì không gọi `steer`: `stepCompanion` nhảy nó về.
- Lần gọi sau thấy nó bị dời quá 64 px, nên tự bỏ đường cũ (luật 1).

**Không đổi cân bằng:**
- Thời gian trụ của T7 tính người đứng yên, thú tới được. T9 chỉ làm cho điều đó đúng cả trong rừng.
- Luật "chạy xa không cắt đuôi được" (Tính khí) nay đúng cả khi núp sau cây.
- Không đổi sát thương, máu, tốc độ, nên không cần balance-analyst.

### 8. Hiệu năng

**Đo trên bản mẫu** (JavaScript chưa tối ưu, có closure; container 4 vCPU):
- A* thân 15, cặp bị chắn 60-320 px: trung vị 17 ô, p90 69, p99 khoảng 1.000; trung bình 0,08-0,11 ms mỗi lần tìm (cả làm mượt).
- Cặp 320-640 px: trung vị 41 ô, p90 140.
- Một lần tìm chạm giới hạn 2.000 ô: 1,5 ms trung bình, 3,5 ms p99.
- 100 con cùng đuổi mục tiêu bị chắn, 160 tick:
  - mỗi tick trung bình 0,25-0,37 ms, p99 1,8-3,1 ms, cho **cả vòng** (gồm `stepChase`/`resolve` vốn có);
  - nhiều nhất khoảng 1.800 ô mỗi tick;
  - mọi con có đường trước tick 14;
  - 97-99% tới tầm cắn trong 8 giây.

**Xấu nhất mỗi tick, code thật, 100 con đuổi:**
- `lineClear`: tối đa 3 lần mỗi con (thẳng + 2 nhìn trước) × 100 × khoảng 1 µs = 0,3 ms.
- A*: tối đa 3.000 ô × khoảng 1 µs = 3 ms. Mục tiêu cho coder: không quá 1 µs mỗi ô; bản mẫu khoảng 0,7 µs khi chạm giới hạn.
- Làm mượt: tối đa 8 lần × khoảng 0,05 ms = 0,4 ms.
- Cộng lại khoảng 3,7 ms trên 50 ms của một tick (7%). Chỉ xảy ra khi nhiều lần tìm dài trùng một tick.
- Thường (dưới 20 con đuổi): dưới 0,2 ms.

**Cấp phát:**
- Lưới và mảng nháp cấp một lần mỗi process.
- Mỗi tick chỉ có object nhỏ: `walker` ở chỗ gọi (như `pos` vốn tạo mỗi tick).
- Mỗi lần tìm: mảng điểm mốc, tối đa 8 lần mỗi tick.
- `Track` dùng lại object `lastPos`, `query.from`, `query.goal` (gán `x`, `y`).

### 9. Số liệu

Không phải số cân bằng, nhưng để trong bảng hằng số, không rải trong logic:

| Hằng số | Giá trị | Ở đâu | Lý do |
|---|---|---|---|
| `NAV_CELL` | `TERRAIN_CELL` (16) | `shared/pathfind.ts` | cờ biển đúng từng ô, giữ khe giữa cây |
| `NAV_MAX_CLEARANCE` | 64 | như trên | lớn hơn thân to nhất tìm đường (trùm 40) |
| `PATH_HEURISTIC_WEIGHT` | 1,2 | như trên | bảng mục 4 |
| `PATHING.maxNodes` | 1.500 | `server/ai/pathing.ts` | thân 15 tìm thấy 99,0% (1.000: 98,8%; 3.000: 99,0%) |
| `PATHING.tickBudget` | 3.000 | như trên | tối đa khoảng 3 ms mỗi tick |
| `PATHING.searchesPerTick` | 8 | như trên | 100 yêu cầu xong trong 13 tick; giới hạn chi phí làm mượt (4/tick: 26 tick, 16/tick: 7 tick, cùng chi phí) |
| `PATHING.retryMs` | 500 | như trên | tối đa 2 lần tìm mỗi giây mỗi con |
| `PATHING.failRetryMs` | 2.000 | như trên | con không có đường tốn tối đa 1.500 ô mỗi 2 giây |
| `PATHING.repathPx` | 48 | như trên | 3 ô; người chơi chạy 0,3 giây |
| `PATHING.stuckTicks` | 6 | như trên | 0,3 giây tiến dưới 30% bước |
| `PATHING.lookahead` | 2 | như trên | bỏ điểm mốc thừa khi đi |
| `PATHING.jumpPx` | 64 | như trên | lớn hơn mọi cú đẩy (44), nhỏ hơn mọi cú nhảy |
| `PATHING.staleMs` | 250 | như trên | 5 tick không gọi `steer` thì bỏ yêu cầu |

## Kế hoạch triển khai

Số dòng theo HEAD `2fd24ba`. Chú thích code bằng tiếng Anh (JSDoc cho hàm, class, trường không hiển nhiên). Không có chữ người chơi thấy.

1. **`packages/shared/src/pathfind.ts`** (mới). Import `WORLD_WIDTH`, `WORLD_HEIGHT` (`constants.ts`), `type CollisionGrid` (`collision.ts`), `type Vec2` (`movement.ts`), `TERRAIN_CELL`, `isSea`, `type Terrain` (`terrain.ts`), `defaultWorld` (`worldgen.ts`; không tạo vòng import).
   - Hằng số: `NAV_CELL`, `NAV_MAX_CLEARANCE`, `PATH_HEURISTIC_WEIGHT` (mục 9), mỗi cái có JSDoc nói vì sao.
   - Kiểu:
     ```ts
     /** A body finding its way: how wide it is, and whether it may cross the sea (companions follow a rafting owner; wild pals cannot swim). */
     export interface NavBody { radius: number; sea: boolean }
     export interface PathQuery extends NavBody {
       /** Any cell whose center is this close to the goal will do (at least NAV_CELL). */
       goalRadius: number;
       /** Cells it may expand before giving up ("limit"). */
       maxNodes: number;
       /** Heuristic weight (PATH_HEURISTIC_WEIGHT unless given). */
       weight?: number;
     }
     export interface PathResult {
       status: "found" | "none" | "limit";
       /** Waypoints after smoothing, not including `from`; the last is within goalRadius of the goal. Empty unless found. */
       path: Vec2[];
       /** Cells expanded: the search's cost. */
       expanded: number;
     }
     ```
   - `export class NavGrid`, đúng mục 3-4:
     - `constructor(obstacles: Pick<CollisionGrid, "circles">, terrain?: Terrain)`: dựng `clearance`, `sea` (`Uint8Array`, riêng tư); `readonly cols`, `rows`.
     - `clearanceAt(x: number, y: number): number`: song tuyến.
     - `cellOpen(x: number, y: number, body: NavBody): boolean`: ô chứa điểm có mở cho thân không (theo tâm ô).
     - `lineClear(from: Vec2, to: Vec2, body: NavBody, stopShort = 0): boolean`.
     - `findPath(from: Vec2, to: Vec2, query: PathQuery): PathResult`: A* + làm mượt; mảng nháp riêng tư, cấp ở lần tìm đầu.
     - JSDoc của class ghi: một lưới cho mọi cỡ thân; dùng chung giữa các phòng an toàn vì chạy đồng bộ.
   - `export function defaultNav(): NavGrid`: cache cấp module, `new NavGrid(defaultWorld().grid, defaultWorld().layout.terrain)`.
2. **`packages/shared/src/index.ts`:** thêm `export * from "./pathfind.ts";` (cuối file).
3. **`packages/server/src/ai/wildCombat.ts`:** `stepChase` (dòng 36-48) thêm tham số cuối `via?: Vec2`.
   - JSDoc: "`via` (a waypoint around trees, ai/pathing.ts) is walked to at full speed instead of the target; the bite range is still measured to the target."
   - Thân hàm:
     ```ts
     const detour = via !== undefined && (via.x !== target.x || via.y !== target.y);
     const next = detour
       ? stepToward(pos, via, 0, dtMs, radius, obstacles, speed)
       : stepToward(pos, target, range * 0.7, dtMs, radius, obstacles, speed);
     return { pos: next, inRange: distance(next, target) <= range };
     ```
   - Không có `via`, hoặc `via` trùng `target`: y như cũ.
4. **`packages/server/src/ai/companion.ts`:**
   - Thêm hàm, đặt trước `stepCompanion`:
     ```ts
     /** How close counts as "there" for a companion: within hitting range of the wild pal it fights, or trailing distance of its owner. */
     export function companionReach(radius: number, attacking: boolean): number {
       return attacking ? COMPANION_ATTACK_RANGE + radius : COMPANION_FOLLOW_DISTANCE;
     }
     ```
   - `stepCompanion` (dòng 42-59) thêm tham số cuối `via?: Vec2`; JSDoc thêm câu như bước 3.
     - Nhánh nhảy về chủ không đổi, bỏ qua `via`.
     - Rồi `goal = target ?? owner`; `detour` tính như bước 3, so với `goal`.
     - Có `detour`: `stepToward(pos, via, 0, dtMs, radius, obstacles)`. Không: như cũ (`stopAt` dòng 55 giữ nguyên).
     - `inAttackRange = !!target && distance(next, target) <= companionReach(radius, true)`, thay biểu thức ở dòng 57 (cùng giá trị).
5. **`packages/server/src/ai/pathing.ts`** (mới), đúng mục 5-6.
   - `export const PATHING = { maxNodes: 1500, tickBudget: 3000, searchesPerTick: 8, retryMs: 500, failRetryMs: 2000, repathPx: 48, stuckTicks: 6, lookahead: 2, jumpPx: 64, staleMs: 250 } as const;`
     - JSDoc từng trường (một dòng, nói vì sao).
     - JSDoc của bảng trỏ tới `docs/design/pals.md`, mục "Đi vòng cây, đá".
   - Kiểu walker:
     ```ts
     export interface Walker extends NavBody {
       /** This close to its goal it is "there" (bite or hit range, trailing distance): no path, it walks straight as before. */
       goalRadius: number;
       /** Pixels it walks this tick (speed × dt): moving less than 30% of it counts toward being stuck. */
       step: number;
     }
     ```
   - `export type PathLimits = Readonly<Record<keyof typeof PATHING, number>>;` (`PATHING` là `as const` nên các số mang kiểu literal; kiểu này cho test truyền bảng khác, ví dụ `{ ...PATHING, searchesPerTick: 2 }`).
   - `export class PathPlanner`:
     - `constructor(nav: NavGrid, limits: PathLimits = PATHING)`.
     - `steer(key: string, pos: Vec2, goal: Vec2, walker: Walker, now: number): Vec2`: luật 1-8 mục 5. Trả chính object `goal` khi đi thẳng.
     - `run(now: number): void`: mục 6.
     - `forget(key: string): void`: xoá `Track` và chỗ trong hàng.
     - `has(key: string): boolean`, `waypoints(key: string): readonly Vec2[] | undefined` (cho test).
     - `lastRun: { searches: number; expanded: number }` (đọc được từ ngoài).
   - Không dùng `Math.random`, không hẹn giờ: thời gian là `now` truyền vào.
6. **`packages/server/src/rooms/GameRoom.ts`:**
   - **Import:**
     - từ `@petgame/shared` thêm `COMPANION_SPEED`, `WILD_ATTACK_RANGE`, `defaultNav`;
     - dòng 197: thêm `companionReach`;
     - thêm `import { PathPlanner } from "../ai/pathing.ts";`.
   - **Trường mới** sau `private obstacles = defaultWorld().grid;` (dòng 334):
     ```ts
     /** Ways around trees, rocks and water for chasing pals and companions (ai/pathing.ts), keyed "w:<wild id>" / "c:<owned id>". */
     private paths = new PathPlanner(defaultNav());
     ```
   - **Về hang** (dòng 672), thay bằng:
     ```ts
     const speed = species.speed * WILD_CHASE_SPEED_FACTOR;
     const via = this.paths.steer(`w:${id}`, pos, home, { radius, sea: false, goalRadius: ALPHA.roam * 0.5, step: (speed * dtMs) / 1000 }, now);
     const step = stepChase(pos, home, speed, dtMs, radius, this.obstacles, 8, via);
     ```
   - **Đuổi** (dòng 705-706), thay bằng:
     ```ts
     const range = pal.boss ? BOSS.radius + 24 : WILD_ATTACK_RANGE;
     const speed = species.speed * WILD_CHASE_SPEED_FACTOR;
     const via = this.paths.steer(`w:${id}`, pos, target.pos, { radius, sea: false, goalRadius: range, step: (speed * dtMs) / 1000 }, now);
     const step = stepChase(pos, target.pos, speed, dtMs, radius, this.obstacles, range, via);
     ```
     Biến `reach` cũ đổi thành `range`; giá trị như cũ, vì `stepChase` mặc định `WILD_ATTACK_RANGE`.
   - **Thú đi theo** (dòng 803), thay bằng:
     ```ts
     // Within reach of its owner it walks around trees; farther, stepCompanion jumps it back next to them.
     const via = distance(companion, owner) > COMPANION_TELEPORT_DISTANCE ? undefined : this.paths.steer(`c:${id}`, companion, target ?? owner,
       { radius, sea: true, goalRadius: companionReach(radius, !!target), step: (COMPANION_SPEED * dtMs) / 1000 }, now);
     const step = stepCompanion(companion, owner, target, dtMs, radius, this.obstacles, via);
     ```
   - **Sau** `this.tickCompanions(dtMs);` (dòng 742): `this.paths.run(now);`, chú thích `// The searches asked for this tick, within its budget (the pals walk them from the next tick).`
   - **`removePal`** (dòng 1222-1243): thêm `this.paths.forget(\`w:${palId}\`);` cạnh `this.forgetSkills(...)`.
   - **`despawnCompanion`** (dòng 2040-2047): thêm `this.paths.forget(\`c:${id}\`);`.
   - Không đổi gì khác: nhánh chạy trốn, lang thang, thú làm việc, kiểm biển sau bước đuổi (dòng 707-711) giữ nguyên.
7. **Test:** theo mục Test.
8. Chạy `npm run typecheck` (`noUnusedLocals`, `noUnusedParameters`).
9. **`docs/architecture.md`:**
   - Bảng shared: thêm dòng sau dòng `movement.ts`, `collision.ts` (dòng 24):
     `| pathfind.ts | Tìm đường (T9): NavGrid (lưới 16 px dẫn xuất từ CollisionGrid: khoảng trống tới vật cản gần nhất của mỗi ô, cờ biển), lineClear, findPath (A* 8 hướng, giới hạn số ô, làm mượt), defaultNav() |`
   - Dòng `rooms/GameRoom.ts` (41): sau "thú hoang (lang thang, nổi giận, gồng rồi cắn, choáng, bỏ chạy)" thêm "; thú đuổi theo và thú đi theo đi vòng cây, đá qua `paths` (`PathPlanner`; `paths.run(now)` mỗi tick sau `tickCompanions`)".
   - Dòng `ai/` (57): thêm "`pathing.ts` (`PathPlanner`: khi nào tìm đường, đi theo điểm mốc, hàng đợi và ngân sách mỗi tick; số liệu `PATHING`)".
   - Mục Kiểm thử (84): thêm helper `plantTrees` vào danh sách helper của `GameRoom.test.ts`.

**Tách bước (tuỳ chọn):** việc vừa một vòng coder. Nếu cần commit nhỏ hơn thì chia 2 commit:
- (A) bước 1-2 + `pathfind.test.ts`;
- (B) phần còn lại.

Tester và reviewer vẫn chấm cả nhiệm vụ một lần.

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, hook debug.
- Client không đổi: vẫn nội suy vị trí thú do server gửi.
- Đổi chữ ký hai hàm chỉ server dùng: `stepChase`, `stepCompanion` thêm tham số cuối tuỳ chọn; mọi chỗ gọi cũ vẫn đúng.
- Export mới từ `@petgame/shared`: `NavGrid`, `defaultNav`, `NAV_CELL`, `NAV_MAX_CLEARANCE`, `PATH_HEURISTIC_WEIGHT`, kiểu `NavBody`, `PathQuery`, `PathResult`.

## Test

**Cảnh "chén cây"** dùng chung (tâm `C`), như bản mẫu đã đo:
- Cây bán kính 14, tâm cách nhau 20 px (chồng lên nhau, không thân nào lọt).
- Hàng đáy từ `C.x - 80` tới `C.x + 80` ở `y = C.y + 40`.
- Hai cánh ở `x = C.x ± 80`, từ `C.y + 20` lên `C.y - 60`.
- Miệng chén quay lên bắc. Thú đứng ở `C` (trong chén), mục tiêu ở `(C.x, C.y + 120)` (sau đáy chén).
- Helper `treeCup(c: Vec2): Circle[]` (khoảng 10 dòng) có trong cả 3 file: `pathfind.test.ts`, `pathing.test.ts`, `GameRoom.test.ts`.
  - Chấp nhận chép vì repo chưa có module tiện ích dùng chung cho test.
  - Import từ một file `.test.ts` khác thì Vitest chạy lại các `describe` của file đó.
  - Không đưa hàm chỉ dành cho test vào `index.ts` của shared.

**Unit, shared:** `packages/shared/src/pathfind.test.ts` (mới).
1. `measures how far each cell's center is from the nearest obstacle's edge`:
   - một cây `{ x: 1000, y: 1000, r: 20 }` (1000 là tâm ô);
   - `clearanceAt(1000, 1000)` = 0, `clearanceAt(1048, 1000)` = 28, `clearanceAt(2000, 2000)` = `NAV_MAX_CLEARANCE`;
   - giữa hai tâm ô thì nội suy: `clearanceAt(1040, 1000)` = 20, giữa 12 (tâm ô 1032) và 28 (tâm ô 1048).
2. `opens a cell for a body exactly when the collision grid has room for it there`:
   - thế giới thật, hai cửa sổ 48 × 48 ô quanh lãnh địa đồng cỏ (`alphaLairs().get("meadow")`) và quanh núi lửa;
   - bán kính 12, 15, 17, 20, 40;
   - `defaultNav().cellOpen(tâm, { radius: r, sea: true }) === !defaultWorld().grid.blocked(tâm, r)` mọi ô.
3. `marks the sea from the terrain`:
   - `defaultNav().cellOpen(8, 8, { radius: 12, sea: false })` là false, với `sea: true` là true;
   - ô của lửa trại đóng với mọi thân (`radius: 1`);
   - ô của cả 6 lãnh địa thú đầu đàn mở cho `{ radius: 17, sea: false }`.
4. `checks a straight way for a body's width`:
   - không vật cản: true;
   - một cây giữa đường: false;
   - hai hàng cây chừa khe 51 px (cảnh dưới, test 9): thân 15 qua, thân 40 không;
   - đường từ `(1000, 1000)` tới tâm một cây `(1200, 1000, r 14)`: false; cùng đường với `stopShort: 40` (dừng ở 1160, khoảng trống 26): true;
   - ra ngoài thế giới: false;
   - dải biển (test 8): thân `sea: false` không qua, `sea: true` qua.
5. `finds a way out of a cup of trees and around it`:
   - chén ở `(1000, 1000)`, không terrain, thân `{ radius: 15, sea: false }`, `goalRadius: 40`, `maxNodes: 1500`;
   - `found`, `expanded ≤ 400` (bản mẫu 129);
   - độ dài đường (từ `from` qua các điểm mốc) trong khoảng 240-520 px: tối thiểu gấp đôi đường thẳng 120, bản mẫu 410-430;
   - mọi điểm mốc `cellOpen`; mọi đoạn giữa hai điểm mốc liền nhau `lineClear`, kể cả đoạn từ `from` (tâm chén mở cho thân 15);
   - điểm cuối cách đích ≤ 40;
   - `lineClear(C, đích)` false (cảnh có ý nghĩa).
6. `says when there is no way, and stops at its limit`:
   - vòng cây kín bán kính 60 quanh `(1000, 1000)` (cây 14, tâm cách nhau khoảng 20 px theo vòng: 19 cây);
   - từ `(1000, 1000)` ra `(1300, 1000)`: `"none"`, `path` rỗng, `expanded < 50` (bản mẫu 9);
   - từ `(1300, 1000)` vào `(1000, 1000)` với `maxNodes: 300`: `"limit"`, `expanded === 300`.
7. `starts from a tight spot`:
   - một cây `(1000, 1000, r 14)`; thân 15 đứng ở `(1021, 1021)`, cách tâm cây 29,7 px (chỗ đứng hợp lệ);
   - tâm ô của nó `(1016, 1016)` chỉ có khoảng trống 8, tức ô đầu đóng;
   - tìm tới `(800, 800)` (sau cây): `found`.
8. `keeps wild pals off the sea and lets companions cross it`:
   - terrain tự dựng: `{ cols: 400, rows: 300, data }` toàn 1 (meadow), cột 100-109 là 0 (biển, x 1600-1760);
   - từ `(1500, 1000)` tới `(1900, 1000)`, `maxNodes: 500`;
   - `sea: false`: không `found`;
   - `sea: true`: `found`, `expanded < 100`.
9. `takes a narrow gap only when the body fits`:
   - một hàng cây r 14 dọc `y = 1000`, tâm cách nhau 20 px: phần trái x = 700, 720, …, 960; phần phải x = 1039, 1059, …, 1299; khe giữa hai mép 974 và 1025 rộng 51 px;
   - từ `(1000, 900)` tới `(1000, 1100)`, `goalRadius: 20`, `maxNodes: 3000`;
   - thân 15: `found`, dài < 250 (qua khe; bản mẫu 180);
   - thân 40: `found`, dài > 600 (vòng qua đầu hàng; bản mẫu 803).
10. `gives the same path for the same question` (tất định), và `finds nothing for a body wider than it keeps clearance for` (`radius: 65`: `"none"`, `expanded` 0).
11. `defaultNav is built once`: `defaultNav() === defaultNav()`.
12. **Benchmark nhẹ:** `keeps searches on the real world cheap (benchmark)`.
    - 200 cặp tạo bằng `mulberry32(9)`:
      - điểm đầu `x = 32 + rand() × (WORLD_WIDTH − 64)`, `y` tương tự, giữ nếu không phải biển và `!grid.blocked(p, 20)`;
      - đích ở góc `rand() × 2π`, cách `60 + rand() × 260`, giữ nếu không biển, `!grid.blocked(t, PLAYER_RADIUS)` và `!lineClear(p, t, thân)`.
    - Thân `{ radius: 15, sea: false }`, `goalRadius: 40`, `maxNodes: 1500`.
    - Kiểm:
      - mọi `expanded ≤ 1500`;
      - `found` ≥ 97% (bản mẫu 99%);
      - p90 của `expanded` ≤ 150 (bản mẫu 69);
      - cả lô < 1.000 ms (bản mẫu khoảng 20-40 ms; giới hạn rộng chỉ để bắt lỗi kiểu xoá 120.000 ô mỗi lần tìm).
    - Không in gì ra console.

**Unit, server:**
- `packages/server/src/ai/wildCombat.test.ts`, thêm `walks to a waypoint at full speed, but measures its bite range to the target`:
  - `stepChase({x:0,y:0}, {x:30,y:0}, 50, 1000, 10, undefined, 40, {x:0,y:100})`: vị trí `(0, 50)`, `inRange` false;
  - `via` trùng `target` cho kết quả giống hệt khi không có `via`.
- `packages/server/src/ai/companion.test.ts`, thêm `walks to a waypoint when given one, counting its attack range to the target`:
  - có `target`, `via` khác: đi về `via` đủ tốc độ, `inAttackRange` tính tới `target`;
  - cách chủ quá 480 px thì nhảy về chủ, bỏ qua `via`;
  - `companionReach(14, true) === 54`, `companionReach(14, false) === COMPANION_FOLLOW_DISTANCE`.
- `packages/server/src/ai/pathing.test.ts` (mới). Dùng `NavGrid` thật dựng từ cảnh tự tạo (không terrain) trừ test 11; `now` tăng 50 mỗi tick.
  1. `walks straight when the way is clear`: `steer` trả `goal` (cùng toạ độ), `run` → `lastRun.searches` 0, `waypoints(key)` undefined.
  2. `does not look for a way once within reach`: một cây giữa `pos` và `goal` cách 30 px, `goalRadius` 40: trả `goal`, không tìm.
  3. `leads a pal out of a cup of trees to a player behind it, where sliding alone stays stuck`:
     - chén ở `(1000, 1000)`; Emberpup (thân 15, 126 px/s, tầm 40); mỗi tick: `steer` → `stepChase(…, 40, via)` → `run`;
     - tới tầm cắn trước tick 100 (bản mẫu 65);
     - đối chứng: `stepChase` không `via`, 160 tick, không lần nào `inRange`.
  4. `serves searches first come, first served, 8 a tick`:
     - 30 thân ở `(1000 + 100i, 1000)`, mỗi thân một cây `(x, 1040, r 14)` chắn đích `(x, 1080)`;
     - mỗi tick `steer` cả 30 theo thứ tự rồi `run`;
     - sau tick k (k = 1..4) đúng các thân `0 … min(8k, 30) − 1` có `waypoints`;
     - mỗi `run`: `searches ≤ 8`, `expanded ≤ 3000`.
  5. `never expands more than its tick budget`:
     - 5 thân có đích nằm trong 5 vòng cây kín (mỗi lần tìm chạm `maxNodes`);
     - `run` đầu: `searches === 2`, `expanded === 3000`; `run` sau phục vụ 2 thân kế.
  6. `waits before searching again`:
     - cảnh chén như test 3, thân đi theo đường mỗi tick;
     - lần tìm đầu `found`; tick sau dời đích sang `(C.x + 60, C.y + 120)` (vẫn sau đáy chén);
     - mọi `run` trước 500 ms kể từ lần tìm đầu: `searches` 0; `run` đầu tiên từ 500 ms: `searches` 1;
     - thân bị nhốt trong vòng kín, đích ở ngoài (`none`): gọi `steer` mỗi tick, không tìm lại trước 2.000 ms, tìm lại ở `run` đầu tiên từ 2.000 ms.
  7. `keeps its path while the goal moves a little`:
     - cảnh chén, thân đi theo đường; tick sau lần tìm đầu, dời đích 30 px (< 48);
     - trong 20 tick sau đó: không `run` nào tìm, `steer` vẫn trả điểm mốc (khác toạ độ `goal`).
  8. `searches when stuck even if the way looks clear, and walks that path`:
     - không vật cản, gọi `steer` 7 lần với cùng `pos` (đích cách 200 px);
     - lần thứ 7 xếp hàng; sau `run`, `steer` trả điểm mốc (khác toạ độ `goal`) dù đường thẳng thông.
  9. `drops its path when moved far`: có đường rồi gọi `steer` với `pos` dời 100 px: `waypoints(key)` undefined.
  10. `forgets`: `forget(key)` thì `has(key)` false và yêu cầu đang chờ không chạy. Thân không gọi `steer` quá 250 ms thì `run` bỏ yêu cầu (`searches` 0).
  11. **Benchmark:** `keeps to its budget with 100 pals chasing around trees at once (benchmark)`.
      - `defaultNav()`, `defaultWorld().grid`.
      - 100 cặp như benchmark shared nhưng cách 100-400 px, tạo bằng `mulberry32(5150)` và `randomPoint(rand, grid, 20)` từ `./wander.ts`.
      - Emberpup, 160 tick. Mỗi tick, mỗi thân chưa tới: `steer` → `stepChase(…, via)` → bỏ bước rơi xuống biển (như `GameRoom`); rồi `run`.
      - Kiểm:
        - mọi `run`: `searches ≤ 8`, `expanded ≤ 3000`;
        - ≥ 95% tới tầm cắn trong 160 tick (bản mẫu 97-99%);
        - thời gian trung bình mỗi tick < 5 ms (bản mẫu 0,25-0,37 ms).

**Tích hợp:** `packages/server/src/rooms/GameRoom.test.ts`, `describe("finding a way around trees")` mới, đặt sau `describe("combat")` (sau dòng 630).
- **Helper:**
  ```ts
  /** Only `circles` stand in this room's world from now on (its real trees and rocks go), with paths around them. */
  function plantTrees(room: GameRoom, circles: Circle[]) {
    const grid = new CollisionGrid(circles);
    (room as any).obstacles = grid;
    (room as any).paths = new PathPlanner(new NavGrid(grid, defaultWorld().layout.terrain));
  }
  ```
- `C = { x: 3200, y: 2560 }`: đồng cỏ trống phía nam lửa trại; đã kiểm `C` và `(C.x, C.y + 120)` không phải biển.
- Mỗi test đặt timeout `15_000` (tick chạy theo thời gian thật).

1. `a wild pal walks out of a cup of trees and around it to the player behind it`:
   - `room.state.pals.clear()`, `plantTrees(room, treeCup(C))`;
   - người chơi ở `(C.x, C.y + 120)`;
   - `placeWild(room, "emberpup", C, 0)`;
   - `skillGapUntil.set(\`w:${id}\`, Infinity)`: không tung chiêu, chỉ đi;
   - `provoke(id, { kind: "player", id: client.sessionId })`;
   - chờ từng tick, tối đa 100 tick (5 giây; bản mẫu 3,25 giây; đuổi kéo dài 8 giây): khoảng cách ≤ `WILD_ATTACK_RANGE`;
   - sau đó `removePal(id)` (qua `as any`) thì `paths.has(\`w:${id}\`)` false.
2. `a following pal walks around a cup of trees to its owner, without jumping`:
   - `giveCompanion(room, client, player, "emberpup")`, rồi `room.state.pals.clear()`, `plantTrees`;
   - chủ ở `(C.x, C.y + 120)`, thú đi theo ở `C`;
   - chờ tối đa 80 tick (bản mẫu 2,05 giây): cách chủ ≤ `COMPANION_FOLLOW_DISTANCE + 8`;
   - mỗi tick dịch không quá 20 px so với tick trước, tính từ vị trí `C` vừa đặt (đi bộ 9,5 px/tick, không nhảy về chủ).
3. `a following pal goes around a cup of trees to the wild pal its owner fights`:
   - như test 2 nhưng chủ ở `(C.x, C.y − 150)` (phía miệng chén), `player.palAuto = false` (chỉ đi và cắn, không chiêu bay qua tường);
   - thú hoang `placeWild(room, "leafkit", { x: C.x, y: C.y + 120 }, 0)`;
   - `controls.get(sid).targetPalId = id`, `aggroUntil = clock.currentTime + 6000`;
   - chờ tối đa 80 tick (bản mẫu 2,1 giây) tới `Hit` có `companionId === owned.id` và `palId === id`.

**Giữ nguyên, phải vẫn qua** (đường thẳng thông nên đi y như cũ):
- `attacks whoever comes close… walks home when led too far` (về hang);
- `walks the boss back home when it strays` (lang thang, không đổi);
- `companion attacks the wild pal its owner hit`;
- các test né, choáng, chặt cây.

**E2E:** không thêm (chỉ hành vi server, không có giao diện mới).

**Tester chạy:**
1. `npm run typecheck`, `npm test`: toàn bộ qua.
2. Lặp 5 lần `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "finding a way around trees"`; lặp 3 lần `npx vitest run packages/shared/src/pathfind.test.ts packages/server/src/ai/pathing.test.ts`. Tất cả qua.
3. `npm run build`.
4. `npm run test:e2e` một lượt (thú đuổi tới được sau cây nhiều hơn; xác nhận không test nào phụ thuộc vào thú kẹt).

## Tiêu chí hoàn thành

- [ ] **`pathfind.ts` (shared):**
  - `NavGrid` lưu khoảng trống `Uint8Array` theo ô 16 px và cờ biển; một lưới cho mọi bán kính;
  - `clearanceAt` nội suy song tuyến; `lineClear` lấy mẫu mỗi 8 px, có `stopShort`, không tạo object;
  - `findPath`: A* 8 hướng không cắt góc, ô đầu luôn nhận, đích là vùng `max(goalRadius, 16)`, trọng số 1,2, `limit` với `expanded === maxNodes`, `none` khi hết ô, làm mượt bằng `lineClear`;
  - mảng nháp cấp một lần, dấu lượt tìm, không xoá cả lưới mỗi lần tìm;
  - `defaultNav()` cache; export trong `index.ts`.
- [ ] **`pathing.ts` (server):**
  - `PATHING` đúng bảng mục 9;
  - `PathPlanner.steer` đúng luật 1-8, trả chính `goal` khi đi thẳng hoặc đã trong tầm;
  - `run` theo FIFO, tối đa 8 lần tìm và 3.000 ô mỗi lần gọi, bỏ yêu cầu cũ hơn 250 ms;
  - `forget`, `has`, `waypoints`, `lastRun`;
  - không `Math.random`, không giữ tham chiếu object schema.
- [ ] **`stepChase` và `stepCompanion`:** nhận `via` tuỳ chọn; không có `via` (hoặc trùng đích) thì kết quả y hệt trước; tầm đo tới mục tiêu thật. `companionReach` thay biểu thức tầm đánh.
- [ ] **`GameRoom`:**
  - trường `paths`;
  - ba chỗ gọi `steer` đúng bảng mục 7: `goalRadius` là tầm, thú hoang `sea: false`, thú đi theo `sea: true`, không gọi khi thú đi theo cách chủ quá 480;
  - `paths.run(now)` sau `tickCompanions`;
  - `forget` trong `removePal` và `despawnCompanion`;
  - không đổi nhánh chạy trốn, lang thang, thú làm việc, kiểm biển.
- [ ] **Test:**
  - đủ test ở mục Test (unit shared 12, server: `wildCombat` 1, `companion` 1, `pathing` 11; tích hợp 3);
  - đối chứng "chỉ trượt thì kẹt" có trong `pathing.test.ts`;
  - không test cũ nào bị nới hay bỏ;
  - typecheck, `npm test`, build, `npm run test:e2e` qua; lặp như mục "Tester chạy" đều qua.
- [ ] **Hiệu năng:** benchmark trong test giữ đúng ngân sách (`expanded ≤ 3000`, `searches ≤ 8` mỗi tick); reviewer xác nhận không có vòng lặp theo cả 120.000 ô trong một lần tìm và không có cấp phát lớn mỗi tick.
- [ ] **Tài liệu:**
  - `docs/architecture.md` đủ 4 chỗ ở bước 9;
  - code khớp `docs/design/pals.md`, mục "Đi vòng cây, đá". Nếu code buộc phải khác thì báo lại, không tự sửa thiết kế.

## Rủi ro, câu hỏi mở

- **Test tích hợp chạy theo thời gian thật:** 3 test, mỗi test 2-5 giây, làm `npm test` lâu thêm khoảng 10 giây. Mỗi test có timeout 15 giây; số tick tối đa gấp khoảng 1,5 lần số đo bản mẫu.
- **Giới hạn thời gian trong benchmark:** gấp 15-50 lần số đo, nên máy CI chậm vẫn qua. Phần chấm chính là bộ đếm (`expanded`, `searches`), tất định.
- **Ngưỡng tỉ lệ trong benchmark** (≥ 97% tìm thấy, ≥ 95% tới nơi) có lề 2-4 điểm so với bản mẫu.
  - Hai test tất định (seed cố định, thế giới cố định): nếu bản của coder thấp hơn thì luôn thấp. Khi đó tìm nguyên nhân (thường do `lineClear` hay đích), không hạ ngưỡng.
- **Đường thẳng tính bằng nội suy** có thể lệch vài px sát thân cây.
  - Thân có thể cọ vào cây rồi được `resolve` đẩy trượt qua.
  - Kẹt thật thì luật đếm kẹt tìm lại sau 0,3 giây.
- **Trùm** (thân 40) ít lối: khoảng 28% lần tìm hết giới hạn hoặc không có đường. Khi đó trượt như cũ, tốn tối đa 1.500 ô mỗi 2 giây.
- **Lối chơi đổi có chủ đích:** núp sau cụm cây hết cắt đuôi được thú (đã ghi trong `pals.md`).
  - E2E có thể bị ảnh hưởng nếu một test vô tình dựa vào việc thú kẹt; tester chạy cả bộ.
  - Các test e2e đã chỉ nhắm thú debug theo id (T36, T37).
- **Không có quyết định nào cần người dùng; không có dòng chặn:** không đổi giao thức, hồ sơ, không xoá tính năng; chỉ hành vi AI ở server, quay lại được bằng cách bỏ `via`.
- **Đề xuất cho `TASKS.md`** (ghép vào việc có sẵn, không tạo việc mới):
  - **T21:** khi thống nhất bán kính trùm, cho trùm về nhà (vượt `BOSS_LEASH`) bằng `PathPlanner` như thú đầu đàn về hang. Hiện `stepWander` bỏ đích khi bị chặn, còn dây giới hạn đặt lại đích mỗi tick, nên trùm có thể lắc qua lại sau vật cản.
  - **T27:** khi kẹp tốc độ bỏ chạy, cân nhắc cho thú hiền chạy về phía thoáng (`NavGrid.clearanceAt`) thay vì thẳng vào cây; T9 không đo việc này.
  - **T10:** khi tách `GameRoom.ts`, để `paths` cùng module di chuyển của thú hoang và thú đi theo.
