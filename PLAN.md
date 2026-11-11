# PLAN: T21 Trùm lang thang va chạm với bán kính 20 thay vì 40 (kèm đường về nhà và giới hạn đường vòng)

## Mục tiêu

Đọc code ở HEAD `f319a8f`. Ba lỗi của trùm Vua Đá (cùng một con, cùng nhánh code trong `GameRoom.tick`):

1. **Thân lúc lang thang sai cỡ.** `GameRoom.ts` dòng 741 gọi `stepWander(..., { grid: this.obstacles, radius: species.size })`. Với trùm, `species.size` là 20 (Boulderhorn thường), trong khi xuất hiện (`spawnBoss`), đuổi, cắn, chiêu đều dùng `BOSS.radius` = 40. Hậu quả: trùm lấn vào đá, lọt khe rộng 40-80 px. Sau đó khi đổi sang đuổi (thân 40), `resolve` đẩy nó bật ra hoặc nó kẹt trong khe.
   - Đo (bản mẫu trong scratchpad): bức tường cây có khe 52 px, trùm lang thang hướng qua khe. Thân 20: 50/50 lần lọt qua, 1.600 tick chồng lên cây. Thân 40: 0/50 lần lọt, 0 tick chồng.
2. **Về nhà kẹt sau vật cản.** Dây giới hạn (dòng 735) đặt `brain.target = bossHome` **mỗi tick**. `stepWander` thấy bị chặn thì đổi sang đích ngẫu nhiên, nhưng tick sau đích lại bị đặt về nhà, nên trùm ép vào cây, đá hay núi lửa mãi.
   - Đo: 400 lần trùm bị dụ xa nhà 300-1.200 px quanh núi lửa (388/400 lần đường thẳng bị chắn). Tỉ lệ về tới trong 60 giây:

     | Cách về | Về tới | Thời gian trung bình |
     |---|---|---|
     | Hiện tại (thân 20) | 67% | 21 giây |
     | Chỉ sửa thân thành 40 | 37% | 22 giây |
     | Tìm đường, tốc độ lang thang | 91% | 17 giây |
     | Tìm đường, tốc độ đuổi | 92% | 10 giây |

   - Kết luận: **sửa thân mà không thêm tìm đường thì tệ hơn hiện tại**, nên hai việc làm cùng một nhiệm vụ.
3. **Đuổi thì đi vòng quá xa khi mục tiêu ở gần.** Đây là góp ý trong `REVIEW.md` của commit T9: mục tiêu cách 78 px, trùm đi vòng 933 px. Người chơi đứng ngay sau bức tường thấy trùm quay lưng bỏ đi.
   - Đo: 600 lần đuổi bị chắn (mục tiêu cách 60-320 px, 8 giây), trên cả thế giới / quanh núi lửa. Số lần trùm đi ra xa mục tiêu hơn 150 px so với lúc bắt đầu là 27 / 13.

**Sau nhiệm vụ, người chơi thấy:**
- Trùm to bao nhiêu thì chiếm chỗ bấy nhiêu: không chui khe hẹp, không đứng lẫn vào đá.
- Bị dụ đi xa rồi hết giận, trùm đi vòng cây, núi về chân núi lửa.
- Người chơi đứng sát sau bức tường thì trùm đứng ép vào tường phía người chơi và dậm đất (tầm 102 px), không bỏ đi vòng.

## Phạm vi

**Làm:**
1. `packages/shared/src/boss.ts`: thêm 4 trường vào `BOSS`, sửa chú thích `radius`.
2. `packages/server/src/ai/pathing.ts`: trường tuỳ chọn `Walker.maxPath`, từ chối đường dài hơn trong `PathPlanner.run`, hàm thuần `detourLimit`, `lastRun.refused`.
3. `packages/server/src/rooms/GameRoom.ts`:
   - thân trùm khi lang thang;
   - trùm về nhà bằng `paths` (phương thức mới `bossHeadHome`, cờ `bossReturning`);
   - giới hạn đường vòng khi trùm đuổi;
   - bỏ hằng `BOSS_LEASH`.
4. Test:
   - `packages/server/src/ai/pathing.test.ts`: 3 test;
   - `packages/server/src/rooms/GameRoom.test.ts`: 3 test, sửa 1 test có sẵn (chỉ đổi cách đọc dây giới hạn);
   - Không có `packages/shared/src/boss.test.ts`; các câu kiểm số liệu `BOSS` nằm trong test `detourLimit` của `pathing.test.ts` (bước 4).
5. `docs/architecture.md`: 2 chỗ (bước 6). `docs/design/pals.md`: game-designer đã sửa trong nhiệm vụ này (mục "Trùm Vua Đá: thân và đường về nhà", bảng "Ai tìm đường", câu "Thấy lại mục tiêu..."). Coder không sửa `pals.md`; code khác thiết kế thì báo lại.

**KHÔNG làm:**
- Không thêm dây giới hạn lúc **đánh**. Trùm vẫn đuổi kẻ nó giận bao xa cũng được, như trước. Không đổi `wildTarget`, `provoke`, `WILD_AGGRO_MS`, `AGGRESSIVE_SIGHT`.
- Không cho trùm hồi máu khi về nhà. Không đổi luật thú đầu đàn (`alphaReturning`, `ALPHA`).
- Không áp giới hạn đường vòng (`maxPath`) cho thú nào khác ngoài trùm: thú đầu đàn về hang, thú thường, thú đi theo giữ y nguyên.
- Không đổi `PATHING`, `pathfind.ts`, `NavGrid`, `stepChase`, `stepWander`, `wander.ts`.
- Không làm các mục của T41: bỏ yêu cầu khi `steer` trả sớm, bỏ đường cũ khi im lặng, `maxNodes > tickBudget`, thoát hốc hẹp, câu kiểm luôn đúng ở `pathing.test.ts:158`.
- Không đổi schema, message, hồ sơ, client, sprite.

## Thiết kế

Luật đầy đủ ở `docs/design/pals.md`: mục "Trùm Vua Đá: thân và đường về nhà", và mục "Đi vòng cây, đá" (dòng trong bảng "Ai tìm đường", gạch đầu dòng "Trùm không đi vòng quá xa").

### 1. Thân 40 ở mọi chỗ di chuyển

`radius` (dòng 668, đã là `pal.boss ? BOSS.radius : species.size`) được dùng cho cả `stepWander`. Thú thường và thú đầu đàn không đổi gì, vì với chúng `radius === species.size`.

Các chỗ khác còn dùng `species.size` không ảnh hưởng tới trùm:
- `push` (dòng 1275) không bao giờ chạy cho trùm: dòng 886 có `!pal.boss`, dòng 1515 có `pal.boss` return ở dòng 1513.
- Thú đi theo, thú làm việc không phải trùm.

### 2. Trùm về nhà

Khi trùm **không đánh ai** (nhánh sau `wildTarget` trả `undefined`):
- Cách nhà (`bossHome`, chỗ xuất hiện) quá `BOSS.leash` (256 px, giữ giá trị của `BOSS_LEASH` cũ) thì bật `bossReturning`.
- Đang `bossReturning`:
  - đi về bằng `this.paths.steer` + `stepChase`, giống thú đầu đàn về hang;
  - đích `bossHome`, `goalRadius` = `BOSS.homeRadius` (128 px, nửa dây giới hạn, như `ALPHA.roam * 0.5`), thân `BOSS.radius`, `sea: false`;
  - tốc độ đuổi: `species.speed * WILD_CHASE_SPEED_FACTOR` = 81 px/s.
- Không bước xuống biển: giữ vị trí cũ nếu bước mới là biển, như nhánh đuổi.
- Tới trong `BOSS.homeRadius` (theo `step.inRange` hoặc `distance <= BOSS.homeRadius`): tắt `bossReturning` và đặt `this.brains.set(id, newBrain(pal))` (đích gần ngẫu nhiên, nghỉ 0-2 giây). Từ đó lang thang như thường.
- Lúc về nhà vẫn đặt `pal.angry = false`, `pal.windup = ""` như nhánh lang thang hiện nay.

**Khác thú đầu đàn, có chủ ý:**
- Trùm đang về **vẫn đánh** ai lại gần trong 120 px hoặc đánh nó. Nhánh đánh chạy trước nhánh về nhà, đúng thứ tự hiện có.
- Đánh xong, nếu `bossReturning` còn bật thì lại về tiếp, kể cả khi đang trong 256 px. Như vậy trùm luôn về tới 128 px, không dừng giữa chừng.
- Lý do:
  - giữ luật trùm hung dữ như cũ;
  - trùm không có dây lúc đánh (không đổi lối chơi đánh trùm);
  - người chơi đứng chặn đường về vẫn bị đánh, đúng chất trùm.

**Tốc độ đuổi thay vì tốc độ lang thang:**
- giống thú đầu đàn;
- về nhanh gần gấp đôi (10 so với 17 giây trung bình);
- vẫn chậm hơn người chơi (160 px/s), nên không thành mối đe doạ mới.

**`bossReturning` tắt khi:** tới nhà; `spawnBoss` (trùm mới); `removePal` của chính trùm (`palId === this.bossId`, gồm cả lúc `defeatBoss`).

### 3. Giới hạn đường vòng khi trùm đuổi

Khi trùm đuổi, đường A* tìm được dài hơn ngưỡng sau thì coi như **không có đường**:

```
maxPath = min(chaseMax, max(chaseDetourFactor × d, d + chaseDetourExtra))
        = min(648, max(3 × d, d + 160))
```

- `d`: khoảng cách thẳng từ trùm tới mục tiêu lúc gọi `steer`.
- `chaseMax` = `species.speed × WILD_CHASE_SPEED_FACTOR × WILD_AGGRO_MS / 1000` = 45 × 1,8 × 8 = 648 px: quãng trùm đi được trong một lần giận 8 giây. Đường dài hơn thì hết giận trước khi tới.
- `3 × d` và `d + 160`: mục tiêu ở gần (d nhỏ) thì cho phép vòng thêm tối đa 160 px (5 m). Mục tiêu xa hơn thì cho tới 3 lần khoảng cách thẳng.

"Không có đường" đi đúng đường thất bại sẵn có của `PathPlanner`:
- bỏ đường cũ (`drop`);
- `nextSearchAt = now + failRetryMs` (2 giây);
- trùm trượt thẳng về phía mục tiêu như trước T9: ép vào vật cản phía mục tiêu, vẫn dậm đất được nếu mục tiêu trong 102 px (`BOSS.stompRadius`).

Lần tìm bị từ chối vẫn tính vào `searches` và `expanded` của tick đó (đã tốn CPU).

Độ dài đường tính từ chỗ trùm đứng lúc yêu cầu (`query.from`) qua mọi điểm mốc (`result.path`).

**Chọn công thức nào: số đo** (scratchpad, 600 lần đuổi bị chắn mỗi bộ, seed cố định). Cột "tệ hơn trượt": số lần trượt thẳng tới được mà cách này tới chậm hơn 2 giây hoặc không tới. Cột "đi xa > 150": số lần trùm ra xa mục tiêu hơn 150 px so với lúc bắt đầu.

| Cách | Tới tầm cắn (cả thế giới / núi lửa) | Tới tầm dậm | Tệ hơn trượt (cắn) | Đi xa > 150 |
|---|---|---|---|---|
| Chỉ trượt (trước T9) | 63,3% / 68,2% | 74,2% / 76,8% | | 0 / 0 |
| Hiện tại (T9) | 82,8% / 88,8% | 87,0% / 91,2% | 17 / 26 | 27 / 13 |
| Trần 648 | 83,8% / 91,0% | 88,7% / 93,5% | 11 / 13 | 0 / 0 |
| max(3d, d+160) | 83,8% / 89,7% | 88,8% / 92,7% | 8 / 19 | 0 / 0 |
| **min(648, max(3d, d+160))** (chọn) | 83,7% / 90,7% | 88,5% / 93,5% | 7 / 13 | 0 / 0 |
| d + 320 | 82,0% / 90,5% | 87,3% / 93,0% | 7 / 12 | 0 / 0 |
| Đích tìm đường = tầm dậm 102 px | 79,3% / 84,5% | 89,7% / 93,2% | 11 / 24 | 20 / 11 |

**Lý do chọn:**
- Bỏ hết các lần trùm đi xa bỏ mục tiêu: 27 → 0.
- Tỉ lệ tới tầm cắn không giảm mà còn tăng nhẹ, vì trùm không phí 8 giây vào đường vòng vô vọng.
- Số lần tệ hơn trượt thấp nhất hoặc gần thấp nhất ở cả hai bộ.
- Hai số đều có nghĩa dễ giải thích: quãng đi trong một lần giận, và vòng thêm tối đa 5 m.
- Phương án "đích tìm đường = tầm dậm" làm tụt tầm cắn và vẫn đi xa 20 lần, nên bỏ.

**Chi phí CPU:** số lần tìm tăng khoảng 10% (844 → 948 trên 600 lần đuổi), vì đường bị từ chối sẽ thử lại sau 2 giây. Chỉ có một con trùm, ngân sách mỗi tick không đổi (`maxExp` vẫn 1.500).

### 4. Hằng số (bảng `BOSS` trong `packages/shared/src/boss.ts`)

| Trường | Giá trị | Ý nghĩa |
|---|---|---|
| `leash` | `8 * PIXELS_PER_UNIT` (256) | Không đánh ai mà xa nhà hơn chừng này thì về. Chuyển từ `BOSS_LEASH` trong `GameRoom.ts`, cùng giá trị |
| `homeRadius` | `4 * PIXELS_PER_UNIT` (128) | Về tới trong chừng này thì lang thang lại |
| `chaseDetourFactor` | `3` | Đường vòng khi đuổi dài tối đa gấp 3 lần đường thẳng... |
| `chaseDetourExtra` | `5 * PIXELS_PER_UNIT` (160) | ...hoặc đường thẳng cộng 160 px, lấy số lớn hơn; không quá quãng đi trong một lần giận |

Chú thích `radius` đổi thành: "Body radius for every move (spawn, wander, chase, way home), collisions and melee reach (pixels)."

Không có chữ hiển thị mới, không đổi giao diện; điện thoại và bàn phím không ảnh hưởng.

## Kế hoạch triển khai

1. **`packages/shared/src/boss.ts`**
   - Thêm 4 trường ở mục Thiết kế 4 vào `BOSS`, mỗi trường có JSDoc tiếng Anh ngắn. Ví dụ `chaseDetourFactor`: "A chase path longer than max(factor × straight, straight + extra), and than what it walks in one 8 s anger, is not worth walking: it presses on straight instead (see ai/pathing.ts detourLimit)".
   - Sửa chú thích `radius` như trên.
   - Bảng vẫn `as const`.

2. **`packages/server/src/ai/pathing.ts`**
   - `Walker`: thêm trường tuỳ chọn `maxPath?: number`.
     - JSDoc: "Longest path (px, from where it stands through every waypoint) worth walking; a longer one counts as no way: it walks straight as before and asks again after failRetryMs. No limit when absent."
   - `Track.query.walker` khởi tạo trong `steer` thêm `maxPath: undefined`. Khi xếp hàng thêm dòng `w.maxPath = walker.maxPath;` cạnh `w.step = walker.step;`.
   - `lastRun`: thêm `refused: 0` (số lần tìm thấy đường mà bị từ chối vì quá dài, trong lần `run` cuối, cho test). Đặt lại ở cuối `run` như hai trường kia.
   - Trong `run`, ngay sau `findPath`:
     ```ts
     const tooLong = result.status === "found" && q.walker.maxPath !== undefined && pathLength(q.from, result.path) > q.walker.maxPath;
     ```
     - `tooLong` thì đi nhánh thất bại với `failRetryMs`: `this.drop(t); t.nextSearchAt = now + lim.failRetryMs;` và `refused++`.
     - Không thì giữ nguyên hai nhánh hiện có.
     - Viết sao cho nhánh `else` hiện tại (`found` mà đường rỗng thì `retryMs`) không đổi hành vi.
   - Hàm module (không export cũng được; export nếu test cần) `pathLength(from: Vec2, path: readonly Vec2[]): number`: tổng `distance` các đoạn. Không cấp phát.
   - Hàm export thuần:
     ```ts
     /** Longest chase path worth walking toward a goal `straight` px away (see BOSS.chaseDetourFactor). */
     export function detourLimit(straight: number, rule: { factor: number; extra: number; max: number }): number
     ```
     Trả `Math.min(rule.max, Math.max(straight * rule.factor, straight + rule.extra))`.

3. **`packages/server/src/rooms/GameRoom.ts`**
   - Import thêm `detourLimit` từ `../ai/pathing.ts` (cùng chỗ import `PathPlanner`). `newBrain` đã import. `WILD_AGGRO_MS`, `WILD_CHASE_SPEED_FACTOR` đã import.
   - Xoá `const BOSS_LEASH = 8 * 32;` (dòng 260-261) và chú thích của nó. Thay bằng hằng module:
     ```ts
     /** The boss's limit on detours while chasing: at most what it walks in one anger (45 × 1.8 × 8 s = 648 px). */
     const BOSS_DETOUR = {
       factor: BOSS.chaseDetourFactor,
       extra: BOSS.chaseDetourExtra,
       max: (getSpecies(BOSS.speciesId).speed * WILD_CHASE_SPEED_FACTOR * WILD_AGGRO_MS) / 1000,
     };
     ```
     Nếu gọi `getSpecies` ở cấp module gây lỗi thứ tự nạp, tính trong constructor hoặc lười lần đầu. Ghi lại trong `PROGRESS.md`.
   - Trường mới, cạnh `bossHome`:
     ```ts
     /** The boss is on its way home (strayed past BOSS.leash while calm); cleared within BOSS.homeRadius. */
     private bossReturning = false;
     ```
   - **Nhánh đuổi** (dòng 713-716): thêm `maxPath` vào walker khi là trùm:
     ```ts
     maxPath: pal.boss ? detourLimit(distance(pos, target.pos), BOSS_DETOUR) : undefined
     ```
     Thú khác không đổi: `maxPath` là `undefined`.
   - **Nhánh lang thang** (dòng 732-749):
     - Thay dòng 734-735 (dây giới hạn cũ đặt `brain.target`) bằng:
       ```ts
       if (pal.boss && this.bossHeadHome(id, pal, pos, radius, species, dtMs, now)) return;
       ```
       Đặt ngay sau `pal.angry = false; pal.windup = "";` và trước khối `if (home)` của thú đầu đàn.
     - Dòng 741: `radius: species.size` thành `radius` (biến đã có ở dòng 668).
   - **Phương thức mới** đặt gần `spawnBoss`:
     ```ts
     /**
      * Walks a calm boss back toward its home (around trees and the volcano) once it strayed past BOSS.leash,
      * until it is within BOSS.homeRadius. Returns true when it handled this tick's move.
      */
     private bossHeadHome(id: string, pal: WildPal, pos: Vec2, radius: number, species: PalSpecies, dtMs: number, now: number): boolean
     ```
     Thân hàm theo đúng luật ở mục Thiết kế 2:
     - chưa `bossReturning` và `distance(pos, this.bossHome) <= BOSS.leash` thì `return false`;
     - bật cờ, tính `speed`, gọi `steer` với key `` `w:${id}` `` (cùng key với nhánh đuổi, như thú đầu đàn), rồi `stepChase(pos, this.bossHome, speed, dtMs, radius, this.obstacles, BOSS.homeRadius, via)`;
     - không phải biển thì gán `pal.x`, `pal.y`;
     - tới nơi thì tắt cờ và `this.brains.set(id, newBrain(pal))`;
     - `return true`.
   - `spawnBoss`: thêm `this.bossReturning = false;` cạnh `this.bossHome = { ...pos };`.
   - `removePal`: thêm `if (palId === this.bossId) this.bossReturning = false;` (trước hay sau `paths.forget` đều được).
   - Không đổi gì khác trong `tick`: thứ tự nhánh (về hang của đầu đàn, chạy trốn, đánh, lang thang) giữ nguyên.

4. **`packages/server/src/ai/pathing.test.ts`** (thêm vào `describe("PathPlanner")`, hoặc một `describe` mới cho `detourLimit`)
   - **`detourLimit`**:
     - `detourLimit(30, { factor: 3, extra: 160, max: 648 })` = 190;
     - `(94, …)` = 282;
     - `(400, …)` = 648.
     - Kèm câu kiểm cho bảng thật: `max` dựng như `BOSS_DETOUR` (tốc độ Boulderhorn × `WILD_CHASE_SPEED_FACTOR` × `WILD_AGGRO_MS` / 1000) bằng 648; `BOSS.chaseDetourFactor` là 3, `BOSS.chaseDetourExtra` là 160; `BOSS.leash` là 256, `BOSS.homeRadius` là 128.
   - **"refuses a path longer than maxPath, walks straight and asks again after failRetryMs"**:
     - Dùng `treeCup(c)`, walker Emberpup như các test sẵn có.
     - Lần 1, planner A không `maxPath`: `steer` + `run` ở `TICK`. Lấy `waypoints`, tính độ dài `L` từ `c` (tự cộng trong test).
     - Planner B, walker `{ ...walker(), maxPath: L - 1 }`, gọi đúng như A:
       - sau `run`: `lastRun.searches === 1`, `lastRun.refused === 1`, `waypoints` là `undefined`;
       - `steer` ở tick sau trả chính `goal` (đi thẳng);
       - lặp tới `failRetryMs`: không lần tìm nào trước `TICK + failRetryMs`, đúng 1 lần tại mốc đó (mẫu giống phần "Shut in a ring" của test "waits before searching again").
     - Planner C với `maxPath: L + 1`: có `waypoints`, `refused === 0`.
   - **"keeps the boss pressing on toward a target close behind a long wall instead of walking far round it"** (unit, chạy nhanh):
     - Cảnh: tường cây `r 14` mỗi 20 px, `x` từ 800 đến 1200, `y = 1050`.
     - Trùm ở `(1000, 990)` với thân `BOSS.radius`, tốc độ 45 × 1,8, `goalRadius` `BOSS.radius + 24`. Mục tiêu đứng yên ở `(1000, 1090)`.
     - Mỗi tick `maxPath = detourLimit(distance(pos, goal), { factor: BOSS.chaseDetourFactor, extra: BOSS.chaseDetourExtra, max: 648 })`, 60 tick `steer` + `stepChase` + `run`.
     - Kiểm: trùm không bao giờ cách chỗ đầu quá 40 px; cuối cùng cách mục tiêu ≤ `BOSS.stompRadius`.
     - Đối chứng trong cùng test, không `maxPath`: trùm đi xa chỗ đầu hơn 150 px. Số đo bản mẫu: 239 px, còn có giới hạn thì 7 px.

5. **`packages/server/src/rooms/GameRoom.test.ts`**: một `describe("boss movement")` mới, đặt sau `describe("finding a way around trees")`, dùng `plantTrees`, `C = { x: 3200, y: 2560 }` (đất liền, đã kiểm `isSea` = false).
   - Helper trong `describe`:
     ```ts
     calmBoss(room, player, at: Vec2, home: Vec2): [string, WildPal]
     ```
     - Xoá mọi thú hoang khác khỏi `room.state.pals`.
     - Đưa người chơi ra xa `{ x: at.x + 1500, y: at.y }` (ngoài tầm nhìn 120).
     - Đặt trùm ở `at`, `bossHome = home`, `bossReturning = false`, xoá `wildAggro` của trùm.
     - Trả `[id, boss]`.
   - Hàm nhỏ tạo tường: `wall(y, x0, x1)`, cây `r 14` mỗi 20 px.
   - **(a) "the boss wanders with its whole body and does not squeeze through a gap narrower than itself"**
     - Cây: `wall(C.y + 60, C.x - 400, C.x - 40)` và `wall(C.y + 60, C.x + 40, C.x + 400)`. Hai tâm cây cạnh khe cách nhau 80 px, khe rộng 52 px: thân 20 lọt, thân 40 không.
     - `calmBoss(room, player, C, C)`; `brain.target = { x: C.x, y: C.y + 180 }`, `brain.idleMs = 0`.
     - 100 tick (5 giây; trùm lang thang 45 px/s không ra quá dây 256 px). Mỗi tick kiểm:
       - `boss.y < C.y + 60` (không qua tường);
       - `!obstacles.blocked(boss, BOSS.radius - 1)`;
     - Cuối cùng: trùm đã đi ít nhất 20 px khỏi `C` (test không trống).
     - Bản mẫu trước sửa: lọt 50/50 lần.
   - **(b) "walks the boss home around a wall in its way, at its own size"**
     - Cây: `wall(C.y + 60, C.x - 100, C.x + 100)`.
     - `calmBoss(room, player, C, { x: C.x, y: C.y + 290 })`: cách nhà 290 > 256, tường nằm thẳng giữa.
     - Lặp tối đa 160 tick tới khi `distance(boss, home) <= BOSS.homeRadius`. Mỗi tick kiểm:
       - `!obstacles.blocked(boss, BOSS.radius - 1)`;
       - `boss.angry === false`.
     - Kiểm đã tới, và sau đó `(room as any).bossReturning === false`.
     - Timeout 15 s. Bản mẫu: 87 tick. Code cũ kẹt 30/30 lần.
   - **(c) "the boss stays and stomps a player just behind a long wall instead of walking far round"**
     - Cây: `wall(C.y + 50, C.x - 200, C.x + 200)`.
     - Thiết lập:
       - `calmBoss(room, player, { x: C.x, y: C.y - 10 }, { x: C.x, y: C.y - 10 })`;
       - đặt người chơi ở `P = { x: C.x, y: C.y + 90 }`;
       - `(room as any).skillGapUntil.set(\`w:${id}\`, Infinity)`;
       - `(room as any).bossLastStompAt = -Infinity`;
       - `collect<BossStompMessage>(client, ServerMessage.BossStomp)`.
     - 60 tick. Mỗi tick đặt lại người chơi về `P` (cú dậm đẩy lùi 44 px; người chơi coi như đứng yên) và `player.hp = PLAYER_MAX_HP`. Ghi lại khoảng cách xa nhất của trùm tới chỗ đầu.
     - Kiểm:
       - khoảng cách xa nhất ≤ 40 px;
       - có ít nhất một `BossStomp` với `bossId === id`.
     - Code hiện tại: sau cú dậm, trùm đi theo đường vòng khoảng 450 px, ra xa chỗ đầu hơn 100 px.
   - **Test có sẵn "walks the boss back home when it strays"** (dòng 1748): vẫn phải qua mà không nới. Nếu tester muốn, đổi chú thích `STRAY = 600; // beyond the boss's leash` sang dựa vào `BOSS.leash`. Không bắt buộc.

6. **`docs/architecture.md`**
   - Dòng `rooms/GameRoom.ts`: thêm `bossHeadHome` vào danh sách phần trùm (`spawnBoss`, `bossStomp`, `defeatBoss`, `bossHeadHome`). Thêm ý: trùm về nhà qua `paths` khi không đánh mà xa quá `BOSS.leash`, đường vòng lúc đuổi giới hạn bởi `detourLimit`.
   - Dòng `ai/`: `pathing.ts` thêm `Walker.maxPath` (đường dài hơn thì coi như không có đường) và `detourLimit`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`. `bossReturning` chỉ ở server (`GameRoom`), không đồng bộ. Client không đổi: trùm vẫn chỉ là `WildPal` có `boss = true`, client nội suy vị trí như cũ.

## Test

**Unit (server `ai/`):** 3 test mới trong `pathing.test.ts` (bước 4). Không có logic shared mới ngoài bảng số `BOSS`, đã được các câu kiểm số liệu canh.

**Tích hợp:** 3 test mới trong `GameRoom.test.ts` (bước 5). Phải còn qua:
- `describe("boss")`, cả nhóm;
- "walks the boss back home when it strays";
- "puts the boss at the foot of the volcano and wild pals on land";
- `describe("finding a way around trees")`;
- `describe("pack leaders")`, vì có đi về hang cùng key `w:`.

**E2E:** không thêm, vì chỉ đổi hành vi server, không có giao diện mới. Tester vẫn chạy cả bộ một lượt.

**Tester chạy:**
1. `npm run typecheck`, `npm test`: toàn bộ qua.
2. Lặp 5 lần `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "boss"`, vì test (a) dùng `Math.random` của `stepWander`. Lặp 3 lần `npx vitest run packages/server/src/ai/pathing.test.ts`. Tất cả qua.
3. Đột biến để chắc test bắt được lỗi, rồi trả lại code:
   - trả dòng 741 về `species.size`: (a) phải hỏng;
   - bỏ lời gọi `bossHeadHome`, dùng lại dây cũ: (b) phải hỏng;
   - bỏ `maxPath` ở nhánh đuổi: (c) và test unit tường dài phải hỏng.
   Ghi kết quả vào `PROGRESS.md`.
4. `npm run build`, `npm run test:e2e` một lượt.

## Tiêu chí hoàn thành

- [ ] `BOSS` có `leash` (256), `homeRadius` (128), `chaseDetourFactor` (3), `chaseDetourExtra` (160), mỗi trường có JSDoc; chú thích `radius` nói rõ mọi lần di chuyển. `BOSS_LEASH` không còn trong `GameRoom.ts`; không còn số `8 * 32` hay `256` rời trong logic trùm.
- [ ] Trùm lang thang với `BOSS.radius`: lời gọi `stepWander` dùng biến `radius`. Thú thường và thú đầu đàn không đổi.
- [ ] `PathPlanner`:
  - `Walker.maxPath` tuỳ chọn; được chép vào `query` khi xếp hàng;
  - đường `found` dài hơn thì `drop`, `nextSearchAt = now + failRetryMs`, `lastRun.refused` tăng;
  - không có `maxPath` thì hành vi y hệt trước (mọi test `pathing.test.ts` cũ qua không sửa);
  - không cấp phát thêm trong `run` ngoài những gì đã có.
- [ ] `detourLimit` thuần, export, có test, đúng `min(max, max(factor × d, d + extra))`.
- [ ] Nhánh đuổi chỉ truyền `maxPath` cho trùm, tính từ `BOSS_DETOUR` (trần 648 suy ra từ tốc độ loài, `WILD_CHASE_SPEED_FACTOR`, `WILD_AGGRO_MS`, không ghi số cứng).
- [ ] `bossHeadHome`:
  - bật khi không đánh và xa nhà hơn `BOSS.leash`;
  - đi bằng `paths.steer` + `stepChase` với thân `BOSS.radius`, `sea: false`, `goalRadius` `BOSS.homeRadius`, tốc độ đuổi;
  - không bước xuống biển;
  - tới nơi thì tắt cờ và có não lang thang mới;
  - nhánh đánh vẫn chạy trước;
  - cờ tắt trong `spawnBoss` và `removePal` của trùm.
- [ ] Test: 3 unit mới + 3 tích hợp mới qua; không test cũ nào bị nới hay bỏ; 3 đột biến ở mục Test đều làm đúng test tương ứng hỏng (ghi trong `PROGRESS.md`); typecheck, `npm test`, build, e2e qua; lặp ở mục "Tester chạy" đều qua.
- [ ] `docs/architecture.md` cập nhật 2 chỗ (bước 6). Code khớp `docs/design/pals.md`, mục "Trùm Vua Đá: thân và đường về nhà" và gạch đầu dòng "Trùm không đi vòng quá xa".

## Rủi ro, câu hỏi mở

- **Không có dòng chặn.** Không đổi giao thức, hồ sơ; không xoá tính năng. Chỉ hành vi AI của một con trùm ở server; quay lại được bằng cách bỏ `maxPath` và `bossHeadHome`.
- **Trùm có thể nằm sẵn trong khe hẹp hoặc lấn vào đá** (từ lúc lang thang với thân 20) ngay khi server mới lên bản này. Không sao: trùm xuất hiện lại mỗi khi khởi động phòng (`spawnBoss` kiểm `blocked(pos, BOSS.radius)`), và `resolve` đẩy nó ra ở bước đầu tiên.
- **Khoảng 8% lần về nhà vẫn không tới trong 60 giây.** Đó là khi trùm bị dụ sang phía bên kia núi lửa xa hơn khoảng 1.000 px: đường cần hơn 1.500 ô, quá giới hạn một lần tìm.
  - Khi đó trùm trượt dần, cứ 2 giây thử tìm lại từ chỗ mới; phần lớn tới sau đó.
  - Thử nâng `maxNodes` lên 3.000 chỉ tăng từ 91% lên 95%, lại tốn gấp đôi mỗi lần tìm của mọi thú. Không làm.
  - Nếu chơi thử thấy trùm lạc mãi, việc sau có thể thêm "về quá 60 giây thì hiện lại ở nhà".
- **Người chơi dụ trùm vào trại.** Trùm không có dây lúc đánh, nên điều này vẫn làm được như trước T21. T21 chỉ làm trùm tự về sau khi hết giận. Nếu muốn cấm hẳn, cần một quyết định thiết kế riêng: thêm dây lúc đánh như thú đầu đàn. Không thuộc T21, không chặn.
- **Test tích hợp chạy theo thời gian thật:** 3 test, tổng khoảng 11 giây (100 + 87 + 60 tick), làm `npm test` lâu thêm chừng đó. Test (a) dựa vào `Math.random` của `stepWander`, nhưng hình học khiến kết quả không phụ thuộc may rủi: khe 52 px không lọt thân 40, tường dài ±400 px mà trùm chỉ đi được 225 px trong 5 giây.
- **Đề xuất cho `TASKS.md`:**
  - **T41:** bỏ ý cuối ("sửa câu trong `docs/design/pals.md` (mục tìm đường) về đường tìm khi bị kẹt"). Game-designer đã sửa câu đó trong T21.
  - **T41** (ghép, tuỳ chọn): đo xem giới hạn đường vòng (`Walker.maxPath`) có giúp thú thường không. Bản mẫu T21 chỉ đo trùm.
