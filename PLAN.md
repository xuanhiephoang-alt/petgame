# PLAN: T54 Test trùm lang thang "does not squeeze through a gap" chập chờn

Đọc code ở HEAD `ba339ba` (sau T53). File liên quan: `packages/server/src/rooms/GameRoom.test.ts` (`describe("boss movement")` dòng 742-817, test (a) dòng 764-777, `calmBoss` dòng 751-762, `afterEach` gọi `vi.restoreAllMocks()` dòng 119-122), `packages/server/src/ai/wander.ts` (`stepWander`), `packages/server/src/ai/wander.test.ts`, `packages/server/src/rooms/GameRoom.ts` (nhánh lang thang dòng 744-761, hồi sinh thú hoang dòng 773-780), `packages/shared/src/collision.ts` (`resolve`, `blocked`). Kế hoạch T21 (`1062c06`) nói câu kiểm cuối "đi ít nhất 20 px khỏi `C`" chỉ để test "không trống". Cách T17 (`632fa73`) sửa test chập chờn: cố định phần ngẫu nhiên bằng `vi.spyOn(Math, "random")` ngay trong test, không thêm retry, không nới ngưỡng, kiểm bằng chạy lặp và đột biến.

## Mục tiêu

`npm test` là thước đo PASS/FAIL của cả đội. Test (a) của T21 hỏng khoảng 1 lần trên 27 lần chạy mà không có lỗi thật, làm đỏ CI và vòng kiểm thử vô cớ. Sau T54, test (a) cho cùng một kết quả mỗi lần chạy, vẫn bắt được lỗi trùm lọt khe như T21 muốn, và bắt thêm một lỗi nhỏ có thật vừa tìm ra (thú lang thang lấn vào cây tối đa một bước khi tới đích).

Người chơi thấy rất ít: thú hoang (cả trùm) không còn lấn 1-2 px vào cây, đá khi dừng ở đích lang thang nằm sát vật cản.

## Kết quả điều tra

Script thử và log nằm trong scratchpad của phiên, ngoài repo, đã xoá sau khi đo.

1. **Tái hiện trong phòng thật.** `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "squeeze" --repeats 80` (81 lần, 414 s, máy 4 nhân): **3/81 hỏng**, cả ba ở câu kiểm cuối:
   ```
   AssertionError: expected 18.73563527366105 to be greater than or equal to 20
   AssertionError: expected 14.012092694923556 to be greater than or equal to 20
   AssertionError: expected 12.271090508930838 to be greater than or equal to 20
   ```
   Không lần nào hỏng ở hai câu kiểm từng tick (không qua tường, không lấn cây).

2. **Nguyên nhân chính: giả định của test, không phải trùm lọt khe.** Mô phỏng đúng cảnh của test (cùng `stepWander`, cùng tường cây, thân 40, 45 px/s, 100 tick) với 20.000 hạt giống `mulberry32`:
   - Trùm luôn đi thẳng xuống, dừng ở miệng khe sâu đúng **23,72 px** (= 60 − √(54² − 40²): thân 40 cộng cây 14 chạm cả hai cây hai bên khe) ở tick 11. Đến lúc đó **chưa rút số ngẫu nhiên nào** (đích do test đặt, `idleMs = 0`).
   - Bị chặn, `stepWander` chọn đích mới ngẫu nhiên trong ô ±150 px quanh chỗ đứng. Trong 4 giây còn lại trùm có thể đi lại về gần `C`. Khoảng cách **cuối** tới `C` dưới 20 px ở **3,8%** số lần (760/20.000), khớp 3/81 đo trong phòng.
   - Số 20 px cuối cùng vì thế đo vị trí ngẫu nhiên lúc hết giờ, không đo việc trùm có tới khe hay không. Không có lần nào trùm qua tường (y ≥ C.y + 60) ở tick 50 ms.

3. **Nguyên nhân phụ: lỗi nhỏ có thật trong `stepWander`.** Nhánh tới đích (`dist <= step`) gán thẳng `pos = brain.target` **không qua `resolve`**. Đích ngẫu nhiên có thể nằm lấn vào vùng cấm quanh một cây; thú tiến tới bằng các bước đã `resolve` nên vẫn sạch, nhưng bước cuối "nhảy" vào đích và lấn vào cây tới một bước (2,25 px với trùm ở 50 ms, nhiều hơn khi tick dài). Sau đó nó đứng yên (nghỉ 1-4 giây) trong cây.
   - Mô phỏng 5.000 hạt giống, tick 50 ms: **36 lần (0,7%)** câu kiểm `blocked(boss, BOSS.radius - 1)` của test (a) sẽ hỏng; lấn sâu nhất 2,16 px. Ví dụ hạt 42: tick 46 trùm đứng ở (C.x + 30,3; C.y + 8,2), lấn cây (C.x + 40; C.y + 60) 1,32 px, giữ nguyên tới hết lần nghỉ.
   - Tăng số vòng lặp trong `resolve` (3 → 20) không đổi gì: lỗi nằm ở nhánh tới đích, không ở `resolve`.
   - Sửa nhánh tới đích bằng `resolve` (bản mẫu): **0/5.000** lấn quá 1 px, 0 lần qua tường, ở tick 50 / 100 / 150 / 200 ms cố định và tick ngẫu nhiên 20-250 ms; lấn sâu nhất 0,0004 px (sai số dấu phẩy động).
   - Ảnh hưởng mọi thú hoang lang thang (thân 10-20 px thì lấn tối đa một bước, khó thấy). Không ảnh hưởng client (`stepWander` chỉ chạy ở server), không ảnh hưởng thú đi theo (không dùng `stepWander`).

4. **Hạt giống cố định cho test (a).** Trong lúc trùm lang thang yên, chỉ `stepWander` của nó rút `Math.random` (đã soát: chí mạng, bắt, rơi đồ, rương, nhặt, chiêu thú hoang chỉ chạy khi có giao tranh hay thao tác), trừ **hồi sinh thú hoang**: `calmBoss` xoá các thú khác nên `respawnTimer` bắt đầu cộng và tới 5.000 ms (`PAL_RESPAWN_MS`), sát cuối 100 tick, `spawnPal` rút số. Chặn hồi sinh trong test thì dãy số trùm nhận là cố định.
   - Với `mulberry32(42)` và code cũ, mô phỏng lấn cây > 1 px ở **100%** lần chạy với tick dao động 45-65, 40-120 và 30-200 ms (300 lần mỗi kiểu). Với code đã sửa: 0%. Vậy test (a) dùng hạt 42 bắt được cả lỗi ở mục 3, không chỉ nhờ test unit.
   - Hạt 42 với code đã sửa: trùm bị chặn ở miệng khe, đổi đích vài lần, đi men tường; mọi câu kiểm từng tick đều qua.

5. **Ngoài phạm vi, ghi nhận:** khi tick dài 250 ms **liên tục** (server chỉ còn 4 tick/giây), bước 11 px của trùm có thể xuyên qua khe 52 px (6/5.000 lần trong mô phỏng, cả khi đã sửa mục 3), vì `resolve` không quét đường đi. Ở 50-200 ms: 0 lần. Đề xuất việc mới ở cuối.

## Phạm vi

Làm:
- `wander.ts`: nhánh tới đích dừng ở chỗ trống gần nhất thay vì nhảy vào đích lấn vật cản.
- `wander.test.ts`: một test unit cho đúng lỗi đó.
- `GameRoom.test.ts`, chỉ test (a): cố định dãy số ngẫu nhiên của trùm, chặn hồi sinh thú hoang trong test, và thay câu kiểm cuối bằng câu đo đúng điều cần đo, **vẫn ngưỡng 20 px**.

KHÔNG làm:
- Không đổi `collision.ts` (`resolve`, `blocked`), `pathfind.ts`, `pathing.ts`, `stepChase`, `GameRoom.ts`.
- Không đổi test (b), (c), `calmBoss`, hàm `wall`, hình tường, số tick (100), timeout (15.000 ms), ngưỡng 20 px, sai số `BOSS.radius - 1`.
- Không thêm retry, không tăng timeout, không bỏ hay nới câu kiểm nào.
- Không sửa chuyện xuyên khe khi tick dài (mục 5): việc mới.
- Không đổi schema, message, `Profile`.

## Thiết kế

Luật mới của thú lang thang: **tới đích thì đứng ở đích, trừ khi đích lấn vào vật cản; khi đó đứng ở chỗ trống gần nhất mà `resolve` đẩy ra** (sát mép vật cản), rồi nghỉ và chọn đích mới như cũ. Mọi thứ khác của `stepWander` giữ nguyên: thời gian nghỉ, cách chọn đích, ngưỡng "bị chặn" (`progress < step * 0.3`).

Lý do chọn `resolve` đích thay vì "không bước nếu bị lấn": `resolve` là đúng cách mọi bước đi khác đang dùng, tất định, và chỗ đẩy ra cách đích không quá chừng một bước (đích nằm trong một bước tính từ một chỗ sạch). Thú không "nhảy" xa.

Không có chữ hiển thị, không có thao tác mới (cảm ứng, bàn phím không đổi).

**Ý nghĩa câu kiểm 20 px của test (a).** T21 đặt nó để test "không trống": trùm thật sự có đi, chứ không đứng yên làm các câu kiểm từng tick tự qua. Câu đúng là: **trùm đã tiến vào khe ít nhất 20 px** (`boss.y - C.y`, lấy lớn nhất qua 100 tick). Câu này:
- giữ ngưỡng 20 px và chặt hơn về hướng (phải đi về phía khe, không phải đi đâu cũng được);
- tất định: trùm tới miệng khe (sâu 23,72 px) trước khi rút số ngẫu nhiên đầu tiên, ở mọi độ dài tick;
- cùng câu kiểm từng tick `boss.y < C.y + 60` cho thấy đúng điều tên test nói: trùm đi vào khe bằng cả thân và bị hai cây chặn lại. Thân 20 (đột biến T21) thì lọt qua và hỏng mọi lần.

## Kế hoạch triển khai

1. **`packages/server/src/ai/wander.ts`, `stepWander`**
   - Nhánh `if (dist <= step)`: thay hai dòng gán `pos.x = brain.target.x; pos.y = brain.target.y;` bằng:
     ```ts
     // The target was picked blindly: if it overlaps an obstacle, stop at the nearest clear spot instead.
     const at = obstacles ? obstacles.grid.resolve(brain.target, obstacles.radius) : brain.target;
     pos.x = at.x;
     pos.y = at.y;
     ```
     Hai dòng sau (`brain.target = nearbyPoint(pos, random)`, `brain.idleMs = 1000 + random() * 3000`) giữ nguyên, cùng thứ tự rút số.
   - JSDoc của `stepWander`: thêm ý "never ends a step inside an obstacle, not even on arrival at a target that overlaps one". Viết bằng tiếng Anh như chú thích hiện có.

2. **`packages/server/src/ai/wander.test.ts`**, trong `describe("wandering with obstacles")` (dùng lại `grid` có sẵn: cây `{ x: 150, y: 100, r: 30 }`):
   - Test mới `"stops next to an obstacle when its target overlaps it, not inside"`:
     - `pos = { x: 108, y: 100 }` (sạch: cách tâm 42 ≥ 30 + 10), `brain = { target: { x: 112, y: 100 }, idleMs: 0 }` (đích lấn 2 px).
     - `stepWander(pos, brain, 100, 100, () => 0.5, { grid, radius: 10 })` (bước 10 px ≥ khoảng cách 4: nhánh tới đích).
     - Kiểm `pos` bằng `{ x: 110, y: 100 }` (dùng `toBeCloseTo` cho từng toạ độ), `grid.blocked(pos, 10)` là `false`, `brain.idleMs > 0`, `brain.target` khác `{ x: 112, y: 100 }`.
     - Code cũ: `pos` = (112, 100), `blocked` = `true`, test hỏng.
   - Ba test không vật cản và hai test có vật cản đang có phải qua không sửa.

3. **`packages/server/src/rooms/GameRoom.test.ts`**
   - Thêm `mulberry32` vào khối `import { ... } from "@petgame/shared"` đầu file (đã được `packages/shared/src/index.ts` xuất qua `noise.ts`).
   - Test (a) (dòng 764-777), giữ nguyên tên, tường, `calmBoss(room, player, C, C)`, đích `{ x: C.x, y: C.y + 180 }`, `idleMs = 0`, 100 tick, hai câu kiểm từng tick, timeout `15_000`. Thay đổi:
     - Sau `calmBoss`: `(room as any).respawnTimer = -Infinity;` kèm chú thích tiếng Anh: no wild pal respawns during the test, so the boss's wandering takes every roll (see below).
     - Ngay trước vòng lặp: `vi.spyOn(Math, "random").mockImplementation(mulberry32(42));` kèm chú thích: where the boss turns to once the trees stop it is a fixed sequence, so a failure replays; this one later walks it into the notch between two trees of the wall, where it used to stop overlapping a tree by up to one step (stepWander arrival).
     - Trong vòng lặp, sau hai câu kiểm: `deepest = Math.max(deepest, boss.y - C.y);` (khai báo `let deepest = -Infinity;` trước vòng).
     - Sau vòng lặp: `vi.restoreAllMocks();` (như T17; `afterEach` cũng khôi phục nếu test hỏng giữa chừng).
     - Thay `expect(distance(boss, C)).toBeGreaterThanOrEqual(20);` bằng `expect(deepest).toBeGreaterThanOrEqual(20);` kèm chú thích: it walked into the gap until the trees on both sides stopped its body (23.7 px deep at radius 40; a radius-20 body goes through). The end spot is not checked: random turns can bring it back near the start.
   - Nếu `distance` không còn dùng ở chỗ nào khác thì `noUnusedLocals` sẽ báo; nó còn được dùng nhiều nơi trong file, giữ import.

4. **Tài liệu:** không đổi `docs/`. `docs/architecture.md` dòng `ai/` đã ghi `wander.ts` là hàm thuần có test; hành vi mới là sửa lỗi, không đổi thiết kế.

Commit đề xuất (một commit): `Keep wandering pals out of trees on arrival; fix flaky boss gap test (T54)`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, hồ sơ đã lưu. Client không đổi (`stepWander` chỉ chạy ở server; vị trí thú vẫn đồng bộ như cũ).

## Test

**Unit:** 1 test mới trong `wander.test.ts` (bước 2).

**Tích hợp:** test (a) sửa như bước 3. Phải còn qua: cả `describe("boss movement")`, `describe("finding a way around trees")`, `describe("pack leaders")`, `describe("regions and climate")` (có "walks the boss back home when it strays"), và cả file.

**E2E:** không thêm. Tester chạy cả bộ một lượt vì `stepWander` đổi cho mọi thú hoang.

**Tester chạy:**
1. `npm run typecheck`, `npm test`: toàn bộ qua.
2. `npx vitest run packages/server/src/ai/wander.test.ts --repeats 20`: 0 hỏng.
3. `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "squeeze" --repeats 80` (81 lần, khoảng 7 phút): **0 hỏng**. Trước sửa đã đo 3/81 hỏng; với tỉ lệ cũ 3,8% thì xác suất 81 lần đều qua chỉ khoảng 4%.
4. Cả file dưới tải: `npx vitest run packages/server/src/rooms/GameRoom.test.ts` 3 lần, trong đó ít nhất 1 lần chạy cùng lúc với `npm run typecheck`: 0 hỏng.
5. Đột biến (mỗi cái chạy `-t "squeeze" --repeats 4` hoặc test unit tương ứng, ghi kết quả vào `PROGRESS.md`, rồi trả lại code):
   - `GameRoom.ts` dòng 753: `radius` → `species.size` (đột biến của T21): test (a) hỏng **5/5** lần ở `boss.y < C.y + 60`.
   - `wander.ts`: trả nhánh tới đích về `pos.x = brain.target.x; pos.y = brain.target.y;`: test unit mới hỏng; test (a) hỏng **5/5** lần ở `blocked(boss, BOSS.radius - 1)`.
   - Bỏ dòng `stepWander(...)` ở `GameRoom.ts` (trùm đứng yên): test (a) hỏng 5/5 lần ở câu `deepest >= 20`.
6. `npm run build`, `npm run test:e2e` một lượt.

## Tiêu chí hoàn thành

- [ ] `stepWander`: nhánh tới đích dùng `obstacles.grid.resolve(brain.target, obstacles.radius)` khi có vật cản, không có vật cản thì như cũ; thứ tự rút số ngẫu nhiên không đổi; JSDoc nói rõ không dừng trong vật cản.
- [ ] `wander.test.ts` có test "stops next to an obstacle when its target overlaps it, not inside", hỏng với code cũ, qua với code mới.
- [ ] Test (a): `respawnTimer = -Infinity`, `Math.random` = `mulberry32(42)` trong vòng 100 tick rồi khôi phục, câu kiểm cuối là `deepest >= 20` (không còn `distance(boss, C) >= 20`), ngưỡng 20, số tick 100, timeout 15.000, hai câu kiểm từng tick và tên test giữ nguyên.
- [ ] Không file nào khác đổi ngoài `wander.ts`, `wander.test.ts`, `GameRoom.test.ts` (cùng `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`).
- [ ] `-t "squeeze" --repeats 80`: 81/81 qua. `wander.test.ts --repeats 20`: 0 hỏng. Cả file `GameRoom.test.ts` 3 lần (1 lần có tải): 0 hỏng.
- [ ] Ba đột biến ở mục Test bước 5 đều làm test hỏng 5/5 lần (đột biến 2 hỏng cả test unit).
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] Không có retry, không tăng timeout, không nới ngưỡng hay sai số nào.

## Rủi ro, câu hỏi mở

- **Hạt giống 42 phụ thuộc thứ tự rút số.** Nếu sau này có code mới rút `Math.random` trong tick lúc trùm lang thang yên (ví dụ thời tiết ngẫu nhiên), dãy số trùm nhận sẽ lệch. Test vẫn đúng (mô phỏng: mọi hạt giống trong 5.000 đều qua với code đã sửa, câu `deepest` không phụ thuộc số ngẫu nhiên), chỉ có thể mất khả năng bắt lỗi ở mục 3 qua test tích hợp; test unit vẫn bắt. Ghi ý này trong chú thích của test.
- **Độ dài tick là giờ thật.** Colyseus truyền `deltaTime` thật nên đường đi của trùm sau lần chặn đầu xê dịch theo tải máy. Đã mô phỏng tick dao động 20-250 ms: code đã sửa không hỏng lần nào; câu `deepest` không phụ thuộc độ dài tick (miệng khe luôn sâu 23,72 px).
- **Thú hoang khác đổi hành vi rất ít:** chỉ khi đích lang thang lấn vật cản, thú dừng sớm tối đa một bước. Không test nào khác dựa vào việc thú đứng đúng điểm đích lấn vật cản.
- Không có mục CHẶN.

## Đề xuất việc mới (cho agent chính thêm vào `TASKS.md`)

- **P3: Thú bước dài có thể xuyên khe hẹp khi server chậm.** `CollisionGrid.resolve` chỉ đẩy ra ở điểm đích, không quét đường đi. Khi tick dài 250 ms liên tục (4 tick/giây), trùm bước 11 px và lọt khe 52 px ở 6/5.000 lần trong mô phỏng tường của test (a) (0 lần ở 50-200 ms). Cân nhắc chia bước dài thành các bước nhỏ (ví dụ ≤ bán kính / 2) trong `stepWander`/`stepChase`, hoặc giới hạn `dtMs` ở `GameRoom.tick`. Ưu tiên thấp: server thường chạy 20 tick/giây.
