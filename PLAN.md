# PLAN: T59 Cây bị chặt không hết rung, cây mọc lại không lớn hết

Đọc code ở HEAD `1620247`. File liên quan:
- `packages/client/src/game/Game.ts`: `frame()` dòng 894-1029 (`dt` tính ở dòng 896-898, giới hạn 0,1 s mỗi khung); lời gọi `this.scenery.update(view, t, focus, 0, aimed?.actor.pos)` dòng 1015; `Gathered` → `hitProp` dòng 706-711; `felled` → `setFelled` dòng 514-523; `debugInfo()` dòng 1448-1460.
- `packages/client/src/game/scenery.ts`: `PropSprite.shake/grow` dòng 138-140; `hitProp` dòng 268-271; `setFelled` dòng 280-315; `update(view, timeSec, focus, dt = 0, aimAt?)` dòng 332-364 (khối rung và mọc lại dòng 340-353).
- `tests/e2e/multiplayer.spec.ts`: test `gameplay: chop a tree, dash, and knock out a dizzy pal` dòng 700-773 (đoạn chặt cây dòng 711-739).

### Lỗi đã xác nhận, và nó bắt đầu từ đâu

- Commit `23cb20b` (chặt cây, đập đá) thêm tham số `dt = 0` vào `Scenery.update`, nhưng `Game.ts` vẫn gọi `scenery.update(view, t, focus)` không có `dt`. Từ đó `dt` luôn bằng 0. T28 (`b36567e`) chỉ viết số 0 ra cho rõ (`focus, 0, aimed?.actor.pos`). `git log -G"scenery\.update\("` chỉ ra đúng hai commit này. Reviewer T28 ghi lỗi này trong `REVIEW.md` mục 1.
- Khi `dt = 0`, `p.shake` và `p.grow` không bao giờ giảm:
  - Cây bị chặt trúng một lần (`hitProp` đặt `shake = 0.35`) nghiêng mãi: `skew.x = sin(0.35·60)·0.14 ≈ 0.117` rad. Độ lay gió của cây chỉ 0,01-0,03. Nhánh này còn `continue` nên cây đó không lay gió nữa, và tán cây không mờ đi khi người chơi đứng sau.
  - Gốc cây, đống đá vụn bị lệch mãi `sin(0.35·90)·2 ≈ 0.17` px. Đá chưa vỡ cũng vậy.
  - Cây, đá mọc lại (`setFelled(false)` đặt `grow = 0.45`) bị khung đầu tiên thu về `0.55` cỡ thật rồi đứng yên ở đó mãi. `propTop()` đọc `sprite.height` nên lá rơi, mảnh gỗ cũng bay ra từ chỗ thấp hơn.
- Có thêm hai lỗi nhỏ, sẽ lộ ra khi truyền `dt` đúng:
  1. **Khung cuối của mọc lại không đặt đủ cỡ.** Khung mà `grow` về 0 thì `if (p.grow > 0)` sai nên bỏ qua việc đặt cỡ. Cây giữ cỡ của khung trước, khoảng 0,9994 cỡ thật (ở 60 khung/giây), mãi mãi. Mắt khó thấy, nhưng test "lớn đủ cỡ" sẽ hỏng, và về lý là sai.
  2. **Chỉ đếm lùi khi vật đang trong tầm camera.** Vật ở xa (người khác chặt, hay 90-120 s sau mới mọc lại khi mình đã đi chỗ khác) giữ nguyên bộ đếm. Tới khi mình đi lại gần, nó mới rung hay phồng lên, trông như có người vừa chặt.
- Không gì khác dựa vào việc `dt = 0`: `scripts/shots.mjs` chỉ đọc `debugInfo()` (camera, số sprite, nhãn), không chặt cây. Không test e2e nào đọc `skew` hay `scale` của cây. `ground.ts` chỉ import `regionDecor` và `regionTint`. `Scenery.update` chỉ có một chỗ gọi.

### Hình chuyển động mong muốn

Giữ đúng ý và số của commit `23cb20b` (chỉ là hình, không phải cân bằng). `docs/art-style.md` ("rung khi bị đánh", "lay theo gió") và README ("cây thành gốc, đá thành đống vụn rồi mọc lại") nói cùng ý:
- Cây trúng đòn quất qua lại `0,35 s`: nghiêng tối đa `0,14` rad, tắt dần theo thời gian còn lại. Hết rung thì đứng thẳng, lay gió và mờ tán như cây khác.
- Đá, gốc cây, đống đá vụn trúng đòn giật ngang tối đa `2` px trong `0,35 s`, rồi về đúng chỗ.
- Cây, đá mọc lại phồng từ `55%` lên đủ cỡ trong `0,45 s` (ease-out bậc hai), dừng ở **đúng** cỡ thật.

Số khung để xong, theo `node -e`: rung 22 khung ở 60 fps, 11 khung ở 30 fps, 4 khung ở mức trần 0,1 s mỗi khung. Mọc lại tương ứng 28, 14, 5 khung. Chromium chạy WebGL bằng phần mềm có khi chỉ vài khung/giây, nên e2e phải chờ bằng `expect.poll`, không chờ cố định.

## Mục tiêu

Người chơi chặt cây thì thấy cây rung một nhịp ngắn rồi đứng thẳng, lay gió lại như cây khác. Cây, đá mọc lại thì phồng lên đúng cỡ cũ. Bây giờ cây cứ nghiêng mãi sau nhát chặt đầu, cây mọc lại lùn còn một nửa, trông như lỗi hình. Kèm test để lỗi nối dây kiểu này không lặp lại.

## Phạm vi

Làm:
- Truyền `dt` của `frame()` vào `scenery.update`. Bỏ giá trị mặc định `dt = 0` để không ai quên được nữa.
- Tách phần toán của rung và mọc lại ra hàm thuần có unit test (`propMotion.ts`).
- Sửa hai lỗi nhỏ ở trên: đặt đúng đủ cỡ ở khung cuối, và đếm lùi cả khi vật ngoài camera.
- Thêm hook đọc trạng thái một cây, đá cho e2e (`debugInfo(prop)`), và thêm bước kiểm vào test e2e `gameplay:` có sẵn.

KHÔNG làm:
- Không đổi luật chặt cây (`gathering.ts`, `GameRoom.ts`), thời gian mọc lại của server (`NODE_REGROW_MS`), hay số tài nguyên.
- Không thêm hook `debug:*` mới ở server. Mọc lại trong e2e được giả lập ở client, xem bước 5.
- Không đổi hình của gốc cây, đá vụn, lá rơi, mảnh vụn (`effects.ts`). Không đổi biên độ, thời gian rung hay mọc lại (giữ số cũ).
- Không đổi schema, message hay hồ sơ lưu.

## Thiết kế

- Số liệu ở mục "Hình chuyển động mong muốn", gom vào bảng hằng số `PROP_MOTION`, không rải số trong `scenery.ts`.
- Không có chữ hiển thị mới. Không có thao tác mới: rung đi theo đòn Đánh (Space, nút **Đánh**), cả cảm ứng lẫn bàn phím như cũ.
- Hiệu năng: mỗi khung đã duyệt ~2058 sprite cây, đá (`defaultWorld()` có 9685 prop, bỏ cỏ). Đưa phép kiểm `shake > 0 || grow > 0` lên trước phép kiểm tầm nhìn chỉ thêm hai phép so sánh cho mỗi vật. Hàm thuần trả số, không tạo object mỗi khung.

## Kế hoạch triển khai

1. **`packages/client/src/game/propMotion.ts` (file mới, hàm thuần, không import pixi)**, theo mẫu `canopy.ts`:
   - `export const PROP_MOTION = { shakeSec: 0.35, growSec: 0.45, growFrom: 0.55, leanMax: 0.14, leanRate: 60, joltPx: 2, joltRate: 90 }`, có JSDoc từng trường (đơn vị: giây, rad, px; chỉ là hình, không phải cân bằng).
   - `countDown(left: number, dt: number): number`: trả `Math.max(0, left - Math.max(0, dt))`.
   - `shakeLean(left: number): number`: độ nghiêng (rad) của cây khi còn `left` giây rung, là `sin(left·leanRate)·leanMax·(left/shakeSec)`. Trả đúng `0` khi `left <= 0`.
   - `shakeJolt(left: number): number`: độ giật ngang (px) của đá, gốc cây, đá vụn, là `sin(left·joltRate)·joltPx·(left/shakeSec)`. Trả đúng `0` khi `left <= 0`.
   - `growSize(left: number): number`: tỉ lệ so với cỡ thật khi còn `left` giây mọc. Với `g = 1 - left/growSec` (kẹp vào 0..1), trả `growFrom + (1 - growFrom)·(1 - (1-g)²)`. Trả đúng `1` khi `left <= 0` và `growFrom` khi `left >= growSec`.
2. **`packages/client/src/game/scenery.ts`:**
   - `hitProp`: `p.shake = PROP_MOTION.shakeSec`. Trong `setFelled(false)`: `p.grow = PROP_MOTION.growSec`.
   - `setFelled(true)`: thêm `p.grow = 0`, để vật vừa thành gốc không bị đặt lại cỡ của cây.
   - `update(view, timeSec, focus, dt: number, aimAt?: Vec2)`: bỏ `= 0`. Sửa JSDoc của `update` (thêm một câu cho `dt`: số giây từ khung trước).
   - Viết lại vòng `for (const p of this.props)`, giữ nguyên phần sau đó (lay gió, mờ tán):
     ```
     tính visible, gán sprite.visible
     if (p.shake > 0 || p.grow > 0) {
       const growing = p.grow > 0;            // đọc TRƯỚC khi đếm lùi
       p.shake = countDown(p.shake, dt);
       p.grow = countDown(p.grow, dt);
       if (prop.kind === "tree" && !p.felled) sprite.skew.x = shakeLean(p.shake);
       sprite.x = prop.x + (prop.kind === "rock" || p.felled ? shakeJolt(p.shake) : 0);
       if (growing) { size = prop.scale·(art.fit ?? 1)·growSize(p.grow); sprite.scale.set(sign(scale.x)·size, size); }
       if (p.shake > 0) continue;
     }
     if (!visible) continue;
     ... (phần felled, lay gió, mờ tán giữ nguyên)
     ```
     Chỗ cần đúng: (a) đếm lùi và đặt dáng **trước** `if (!visible) continue`; (b) đặt cỡ khi `growing` (lúc vào khối), kể cả khung mà `grow` vừa về 0, vì `growSize(0) = 1` cho ra đúng cỡ thật; (c) không đặt cỡ khi chỉ rung, vì gốc cây và đá vụn có cỡ riêng do `setFelled(true)` đặt.
   - Thêm `debugProp(index: number)` (JSDoc: cho e2e qua `Game.debugInfo`, không gọi mỗi khung). Trả `undefined` nếu không có, nếu có thì trả `{ felled, shake, grow, skew: sprite.skew.x, dx: sprite.x - prop.x, size: Math.abs(sprite.scale.y) / (prop.scale * (art.fit ?? 1)), sway: art.sway }`. `size` chỉ có nghĩa khi vật chưa bị chặt.
3. **`packages/client/src/game/Game.ts`:**
   - Dòng 1015: `this.scenery.update(view, t, focus, dt, aimed?.actor.pos);`.
   - `debugInfo(prop?: number)`: thêm trường `prop: prop === undefined ? undefined : this.scenery.debugProp(prop)` (JSDoc: trạng thái rung, mọc lại của cây, đá có chỉ số `prop` trong layout). Gọi không tham số vẫn trả như cũ, nên `scripts/shots.mjs` không phải sửa.
4. **`packages/client/src/game/propMotion.test.ts` (mới):** xem mục Test.
5. **`tests/e2e/multiplayer.spec.ts`**, test `gameplay: chop a tree, dash, and knock out a dizzy pal`:
   - Thêm helper cục bộ `const prop = () => page.evaluate((i) => (window as any).__petgame.game.debugInfo(i).prop, tree.index)` sau khi có `tree`.
   - **Cây đứng thẳng lại sau nhát đầu:** tách nhát chặt đầu ra khỏi vòng `for` (vẫn chờ `wildPalsNear(100)` rỗng trước khi bấm). Chờ `wood >= 1` bằng `expect.poll`. Rồi `expect.poll(prop, { timeout: 15_000 })` thoả `felled === false`, `shake === 0`, `Math.abs(skew) <= sway + 1e-9`, `Math.abs(dx) < 1e-6`. Viết poll trả boolean, hoặc trả object đã làm tròn rồi `toMatchObject`. Sau đó vòng `for` chặt tiếp như cũ, điều kiện `wood < 3` giữ nguyên.
   - **Gốc cây hết giật:** sau dòng kiểm `felled.has(...)`, poll `prop()` tới `felled === true`, `shake === 0`, `Math.abs(dx) < 1e-6`, `skew === 0`.
   - **Mọc lại đủ cỡ:** server mất 90 s (`NODE_REGROW_MS.tree`) mới mọc lại, quá dài cho e2e. Gọi đúng việc client làm khi `felled` bị xoá: `page.evaluate((i) => (window as any).__petgame.game.scenery.setFelled(i, false), tree.index)`. Đã có tiền lệ e2e đọc trường riêng `game.nodes`. Ghi chú trong test: chỉ đổi hình ở client, server vẫn coi cây đã chặt. Poll `prop()` tới `felled === false`, `grow === 0`, `|size - 1| < 1e-6`, `Math.abs(dx) < 1e-6`. Phần lướt và hạ gục phía sau giữ nguyên (đã teleport đi chỗ khác).
6. **Tài liệu** (coder sửa):
   - `docs/architecture.md` dòng 69: thêm `game/propMotion.ts` (hàm thuần `countDown`, `shakeLean`, `shakeJolt`, `growSize`, bảng `PROP_MOTION`: rung khi bị chặt, mọc lại; có test). Ghi `Scenery.update` nhận `dt` thật từ `frame()`, và `debugInfo(prop).prop` = `{ felled, shake, grow, skew, dx, size, sway }`.
   - `docs/art-style.md` mục **Chuyển động**, thêm một câu: "Cây bị chặt quất qua lại 0,35 giây rồi đứng thẳng, đá và gốc cây giật nhẹ; cây, đá mọc lại phồng từ 55% lên đủ cỡ trong 0,45 giây."

## Giao thức

Không đổi `schema.ts`, `messages.ts` hay `Profile`. Chỉ đổi client. `debugInfo()` thêm một tham số tuỳ chọn và một trường. Lời gọi không tham số (`shots.mjs`, các e2e khác) vẫn chạy như cũ.

## Test

- **Unit `packages/client/src/game/propMotion.test.ts`** (Vitest đã chạy `packages/**/src/**/*.test.ts`):
  - `countDown`: `countDown(0.35, 0.1)` ≈ 0.25; không bao giờ âm (`countDown(0.05, 0.1) === 0`); `dt` âm không làm tăng; `dt = 0` giữ nguyên (ghi rõ: đây là lý do cây cứ nghiêng mãi).
  - `shakeLean` và `shakeJolt`: bằng đúng `0` ở `left = 0` và `left < 0`; `|shakeLean| <= 0.14`, `|shakeJolt| <= 2` khi lấy mẫu dày trên `(0, 0.35]`; ở `left = 0.35` khác 0 (đúng là đang rung).
  - `growSize`: `growSize(0.45) === 0.55`, `growSize(0) === 1`, `growSize(-1) === 1`, `growSize(1) === 0.55`; không giảm khi `left` giảm dần (lấy mẫu dày); luôn trong `[0.55, 1]`.
  - **Mô phỏng đủ một lần rung và một lần mọc lại** với `dt` bằng `1/60`, `1/30` và `0.1`: lặp `countDown` tới khi về 0, đếm số khung (rung ≤ `ceil(0.35/dt) + 1`, mọc lại ≤ `ceil(0.45/dt) + 1`). Khung cuối cho `shakeLean = 0`, `shakeJolt = 0`, `growSize = 1` đúng tuyệt đối.
- **E2E**: ba bước kiểm ở bước 5, trong test `gameplay:` có sẵn. Trên code cũ (`dt = 0`) bước "đứng thẳng lại" hỏng vì `shake` giữ `0.35` và `skew ≈ 0.117`. Bước "mọc lại" hỏng vì `size` giữ `0.55` (hoặc ≈ 0.9994 nếu chỉ sửa `dt` mà không sửa khung cuối).
- **Tester kiểm lỗi có bị bắt thật không** (không commit): tạm đổi `dt` thành `0` ở `Game.ts:1015`, chạy `npx playwright test -g "gameplay: chop"`. Test phải FAIL ở bước đứng thẳng lại. Trả lại `dt`, test PASS. Ghi kết quả vào `PROGRESS.md`.
- Không cần test server: server không đổi.

## Tiêu chí hoàn thành

- [ ] `Game.ts` gọi `scenery.update(view, t, focus, dt, aimed?.actor.pos)` với `dt` của `frame()`. `Scenery.update` không còn giá trị mặc định cho `dt`.
- [ ] `propMotion.ts` là hàm thuần, không import pixi, số nằm trong `PROP_MOTION` (0,35 / 0,45 / 0,55 / 0,14 / 60 / 2 / 90, đúng như cũ). `scenery.ts` không còn số cứng của rung hay mọc lại.
- [ ] Khung mà `grow` về 0 đặt đúng cỡ thật (`growSize(0) = 1`). Vật vừa thành gốc (`setFelled(true)`) có `grow = 0`. Chỉ rung thì không đổi cỡ của gốc cây hay đá vụn.
- [ ] Bộ đếm rung và mọc lại giảm cả khi vật ngoài camera.
- [ ] `debugInfo(prop).prop` trả `{ felled, shake, grow, skew, dx, size, sway }`. `debugInfo()` không tham số vẫn như cũ.
- [ ] `propMotion.test.ts` có đủ các ca ở mục Test và PASS.
- [ ] E2E `gameplay: chop a tree...` có ba bước kiểm (đứng thẳng sau nhát đầu, gốc hết giật, mọc lại đủ cỡ) và PASS. Tester đã xác nhận test FAIL khi tạm đặt `dt = 0`.
- [ ] Không tạo object mới mỗi khung trong `Scenery.update` (`debugProp` chỉ chạy khi test gọi).
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] `docs/architecture.md` và `docs/art-style.md` đã cập nhật như bước 6.

## Rủi ro, câu hỏi mở

- Không có mục CHẶN.
- E2E giả lập mọc lại ở client (`game.scenery.setFelled(i, false)`) thay vì chờ server 90 s. Nó kiểm đúng hàm mà `onRemove("felled")` gọi, nhưng không kiểm dây nối từ state tới hàm đó. Dây nối này có sẵn từ `23cb20b`, không đổi trong nhiệm vụ này. Nếu sau này cần kiểm cả dây nối, có thể thêm hook `debug:regrow` ở server thành một nhiệm vụ riêng. Không đề xuất làm ngay.
- E2E chạy WebGL bằng phần mềm, có thể chỉ vài khung/giây. Mọi bước kiểm dùng `expect.poll` (15 s), không dùng `waitForTimeout`. `dt` bị chặn 0,1 s mỗi khung, nên rung xong sau tối đa 4 khung và mọc lại sau tối đa 5 khung.
- Trong lúc poll chờ cây đứng thẳng, thú hoang có thể đi lại gần. Bước này không bấm phím nên không sao; vòng `for` sau vẫn chờ `wildPalsNear(100)` rỗng trước mỗi lần bấm như cũ.
