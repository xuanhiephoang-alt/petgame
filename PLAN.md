# PLAN: T29 Dọn nhỏ sau T5 (phần làm được khi chưa có Q1)

Code đọc ở `f255108` ("Mark T26 done, add T94, start T29"). Nguồn:
- dòng T29 và T28 trong `TASKS.md`;
- `REVIEW.md` của commit T59 `aa6e778` (mục "Góp ý không bắt buộc");
- `packages/client/src/game/scenery.ts` (`hitProp`, `debugProp`, `setFelled`, `update`), `game/propMotion.ts`, `propMotion.test.ts`;
- `scripts/shotGroups.mjs` (`aimShots`), `scripts/shotsLib.mjs` (`AIM_RETRY`, `aimRetrySpots`);
- `docs/architecture.md` (dòng về `propMotion.ts`).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Chỉ đổi code client thuần và unit test. Không có việc hình ảnh.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts` (phần T63 đang cất trong `git stash` đổi ba file này). Không chạy `git stash`.

## Kiểm lại từng mục của dòng T29

| # | Mục | Ở đâu | Quyết định |
|---|---|---|---|
| 1 | Test ngẫu nhiên nhiều khung, có seed, cho `layoutTags` | `labelLayout.test.ts`, hoặc một file mới import `layoutTags` | **Hoãn (T29b).** File mới thì không đụng file của stash, nhưng T63 đổi luật thứ tự `comesFirst`. Một test khẳng định các bất biến *hôm nay* (không chồng, nhãn ghim không ẩn, không hiện lại trước 250 ms) có thể hỏng, hoặc phải viết lại, khi T63 vào: chồng sai về nghĩa, dù git không báo xung đột. Không chắc thì hoãn, đúng như yêu cầu. |
| 2 | Sửa chú thích sai trong `labelLayout.ts` | `labelLayout.ts` | **Hoãn (T29b):** file bị chặn. |
| 3 | Lần thử lại cảnh của nhóm ảnh `aim` cách nhau 260 px; đổi tên `d` | `scripts/shotsLib.mjs`, `shotGroups.mjs` | **Đã xong, bỏ.** `AIM_RETRY` (`shotsLib.mjs`) đã là các bước 260 px, và `aimShots` thử lại theo `aimRetrySpots` (T14 viết lại `shots`). Chính dòng T29 ghi việc đổi tên `d` đã làm trong T28. |
| 4 | Bộ đếm số lần bị đánh trong `debugProp`, để bước "đứng thẳng lại" của e2e chặt cây chứng minh cây đã rung | `scenery.ts` (bộ đếm), và bước e2e trong test chặt cây của `multiplayer.spec.ts` (khoảng dòng 739-742, theo review T59) | **Hoãn (T29b).** Bộ đếm chỉ có ích khi bước e2e đó đọc nó, mà bước đó nằm trong file bị chặn. Viết lại cả màn chặt cây trong một spec mới (đứng cạnh cây, chờ không thú hoang nào trong 100 px…) chỉ để kiểm bộ đếm là chép trùng nhiều, thêm việc cho T16. Unit test không chứng minh được dây `Gathered` → `hitProp`, vốn là lý do có bộ đếm. |
| 5 | Tách hàm thuần cho mỗi bước của vòng `Scenery.update`, để unit test bắt được lỗi khung cuối của mọc lại | `scenery.ts`, `propMotion.ts` | **Làm** (Thiết kế 1). |
| 6 | (Tuỳ chọn) hook `debug:regrow` ở server, để e2e đi qua đường mọc lại thật; cập nhật danh sách hook trong `CLAUDE.md` | `systems/debug.ts`, và test chặt cây của `multiplayer.spec.ts` (thay đường tắt `setFelled(i, false)`) | **Hoãn (T29b).** Hook chỉ có nghĩa khi bước e2e đó dùng nó, và bước đó nằm trong file bị chặn. Thêm hook mà không ai gọi là mở thêm đường debug không có test. |

**Kết luận về phạm vi:** sau khi bỏ các mục bị chặn, chỉ còn mục 5. Nó nhỏ nhưng đáng làm ngay:
- nó không đụng file nào của T63;
- hôm nay ba chuyển trạng thái của vòng (khung cuối của mọc lại, gốc cây bị đánh không đổi cỡ, cây ngừng rung đúng 0) chỉ có e2e chậm kiểm, và lỗi `growing` → `grow > 0` không unit test nào bắt (review T59);
- làm xong mục 5 thì T29b chỉ còn những việc thật sự phải chờ Q1.

Nếu agent chính muốn gom cả T29 vào T29b để làm một lần, việc đó cũng hợp lý; mục 5 không phụ thuộc gì.

## Mục tiêu

Người chơi không thấy gì khác: cây rung và mọc lại y như bây giờ, cùng số liệu `PROP_MOTION`. Đổi lại, logic một khung của vật đang rung hoặc đang mọc lại nằm trong một hàm thuần có unit test. Ai sửa sai thứ tự "đọc `grow` trước khi đếm lùi" sẽ bị unit test bắt ngay, không phải chờ e2e.

## Phạm vi

**Làm:** hàm thuần `stepPropMotion` trong `propMotion.ts`; `Scenery.update` gọi nó; unit test; một dòng tài liệu.

**KHÔNG làm:**
- các mục 1, 2, 4, 6 (sang T29b);
- không đổi số trong `PROP_MOTION`, không đổi hình, không đổi phần lay gió, mờ tán, khói, lửa của `update`;
- không đổi `debugProp`, `hitProp`, `setFelled`;
- không đổi server, schema, message.

## Thiết kế

### 1. `stepPropMotion`: một khung của vật đang rung hoặc đang mọc lại

Hiện tại, trong vòng `for (const p of this.props)` của `Scenery.update`, khối `if (p.shake > 0 || p.grow > 0) { … }` làm 5 việc:
1. đọc `growing = p.grow > 0` **trước** khi đếm lùi;
2. đếm lùi `shake` và `grow`;
3. cây đứng (không phải gốc): `skew = shakeLean(shake)`;
4. `x` = vị trí gốc cộng `shakeJolt(shake)`, chỉ với đá hoặc vật đã đổ;
5. nếu `growing`: cỡ = cỡ đủ × `growSize(grow)`. Khung cuối (`grow` về 0) cho đúng cỡ đủ.

Còn rung thì bỏ qua phần lay gió.

Chuyển phần quyết định sang `propMotion.ts` (thuần, không PixiJS, không tạo object mỗi khung):

```ts
/** The pose one frame gives a prop that shakes or grows back (written into a reused object: no allocation per frame). */
export interface PropPose {
  /** Lean (rad) to set, or undefined to leave it (only a standing tree leans). */
  lean: number | undefined;
  /** Sideways offset (px) from the prop's own x: a rock, stump or rubble jolts; a standing tree does not. */
  dx: number;
  /** Size relative to the full size, or undefined to leave it (only while growing back; exactly 1 on the last frame). */
  size: number | undefined;
  /** Still shaking after this frame: the caller skips the wind sway and canopy fade. */
  busy: boolean;
}

/**
 * Moves a hit or regrowing prop on by `dt` seconds: counts `motion.shake` and `motion.grow` down in place and writes the
 * pose into `out`. Whether it was growing is read before the countdown, so the frame that ends the growth still sets the
 * full size. `standingTree`: a tree that is not felled (it leans); `jolts`: a rock, or anything felled (it jolts).
 */
export function stepPropMotion(motion: { shake: number; grow: number }, dt: number, standingTree: boolean, jolts: boolean, out: PropPose): PropPose
```

**`Scenery.update`:**
- Một trường riêng `pose: PropPose = { lean: undefined, dx: 0, size: undefined, busy: false }`, tạo một lần.
- Khối cũ thành:
  ```ts
  if (p.shake > 0 || p.grow > 0) {
    const pose = stepPropMotion(p, dt, prop.kind === "tree" && !p.felled, prop.kind === "rock" || p.felled, this.pose);
    if (pose.lean !== undefined) sprite.skew.x = pose.lean;
    sprite.x = prop.x + pose.dx;
    if (pose.size !== undefined) {
      const size = prop.scale * (art.fit ?? 1) * pose.size;
      sprite.scale.set(Math.sign(sprite.scale.x) * size, size);
    }
    if (pose.busy) continue;
  }
  ```
- Khối vẫn đứng **trước** `if (!visible) continue`, như hiện nay: vật ở ngoài camera vẫn đếm lùi. Chú thích "Count down even off screen…" giữ nguyên.
- Kết quả từng khung y hệt mã hiện tại: cùng biểu thức, cùng thứ tự.

**Hiệu năng:**
- không tạo object mới (một `pose` dùng lại);
- khối này chỉ chạy cho vài vật đang rung hoặc đang mọc;
- thêm một lời gọi hàm cho mỗi vật đó, không thêm gì cho khoảng 2 000 vật còn lại;
- không đổi số sprite.

## Kế hoạch triển khai

1. **`packages/client/src/game/propMotion.ts`:** `PropPose`, `stepPropMotion` như Thiết kế 1, kèm JSDoc tiếng Anh. Dùng `countDown`, `shakeLean`, `shakeJolt`, `growSize` có sẵn; không số cứng mới.
2. **`packages/client/src/game/scenery.ts`:** trường `pose`; thay khối trong `update` như Thiết kế 1; import `stepPropMotion`, `PropPose`. Bỏ import nào không còn dùng (`noUnusedLocals`).
3. **`packages/client/src/game/propMotion.test.ts`:** thêm `describe("stepPropMotion")` (mục Test).
4. **`docs/architecture.md`:** dòng `game/propMotion.ts`: thêm `stepPropMotion` (một khung của vật đang rung hoặc mọc lại, ghi vào `PropPose` dùng lại); `Scenery.update` gọi nó trước phép kiểm tầm nhìn.
5. `npm run typecheck`, `npm test`, `npm run build`; rồi chạy riêng test chặt cây đang có trong `multiplayer.spec.ts` (không sửa; tìm theo tên có "chop"/"gameplay:" và chạy bằng `npx playwright test -g "<tên>"`), để chắc hình vẫn như cũ.

## Giao thức

Không đổi gì: chỉ client, chỉ phần vẽ.

## Test

### Unit (`propMotion.test.ts`, `describe("stepPropMotion")`)

Mỗi test tạo `motion` và `out` riêng.

| Test | Đầu vào | Mong đợi |
|---|---|---|
| khung cuối của mọc lại cho đúng cỡ đủ | `{ shake: 0, grow: 0.05 }`, `dt` 0.1, cây đứng | `motion.grow === 0`; `out.size === 1` (đúng tuyệt đối); `out.busy === false` |
| đang mọc | `{ shake: 0, grow: PROP_MOTION.growSec }`, `dt` 0.1 | `out.size` bằng `growSize(PROP_MOTION.growSec - 0.1)`, nằm giữa `growFrom` và 1 |
| không mọc thì không đổi cỡ (gốc cây, đá vụn bị đánh) | `{ shake: 0.35, grow: 0 }`, `jolts` true | `out.size === undefined` |
| cây đứng rung | `{ shake: 0.35, grow: 0 }`, `dt` 0.016, cây đứng | `out.lean` bằng `shakeLean(0.334)` (`toBeCloseTo`); `out.dx === 0`; `out.busy === true` |
| khung cuối của rung | `{ shake: 0.01, grow: 0 }`, `dt` 0.1, cây đứng | `out.lean === 0`; `out.dx === 0`; `out.busy === false`; `motion.shake === 0` |
| đá rung | `{ shake: 0.35, grow: 0 }`, `dt` 0.016, không phải cây đứng, `jolts` | `out.lean === undefined`; `out.dx` bằng `shakeJolt(0.334)`, khác 0 |
| gốc cây bị đánh | như đá (cây đã đổ: `standingTree` false, `jolts` true) | không nghiêng (`lean` undefined), giật ngang |
| `dt` âm hoặc 0 | `{ shake: 0.2, grow: 0.2 }`, `dt` -1 rồi 0 | `motion` không đổi; `out.busy === true`; `out.size` bằng `growSize(0.2)` |
| không tạo object | gọi 2 lần với cùng `out` | trả đúng `out` (`toBe`) |
| rung và mọc cùng lúc (cây vừa mọc lại bị chặt ngay) | `{ shake: 0.35, grow: 0.45 }`, `dt` 0.1, cây đứng | `out.lean`, `out.size` đều có giá trị; `busy === true` |

### E2E

Không viết mới. Chạy lại test chặt cây có sẵn (bước 5): nó kiểm cây đứng thẳng lại, gốc cây không đổi cỡ, cây mọc lại đủ cỡ, giờ đi qua `stepPropMotion`.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến (trong `stepPropMotion`) | Phải hỏng |
|---|---|---|
| M1 | đọc `growing` **sau** khi đếm lùi (`motion.grow > 0`), đúng lỗi review T59 nêu | unit "khung cuối của mọc lại" (`size` undefined) |
| M2 | `lean` cho cả vật đã đổ (`standingTree` bị bỏ qua) | unit "gốc cây bị đánh" |
| M3 | `dx` cho cả cây đứng | unit "cây đứng rung" (`dx` khác 0) |
| M4 | `busy` tính từ `shake` trước khi đếm lùi | unit "khung cuối của rung" (`busy` true) |
| M5 | `size` luôn có giá trị (`growSize` cả khi không mọc) | unit "không mọc thì không đổi cỡ" |
| M6 | (trong `scenery.ts`) chuyển khối gọi `stepPropMotion` xuống sau `if (!visible) continue` | unit không bắt được (đây là quyết định của `Scenery`). Ghi lại kết quả chạy test chặt cây của e2e; nếu e2e cũng không bắt thì ghi rõ: đó là phần T29b làm chặt hơn |

## Tài liệu

`docs/architecture.md`: như bước 4. Không đổi tài liệu thiết kế (hình và luật không đổi).

## Tiêu chí hoàn thành

- [ ] `stepPropMotion` và `PropPose` trong `propMotion.ts`, có JSDoc, không số cứng mới, không tạo object.
- [ ] `Scenery.update` gọi `stepPropMotion` trước phép kiểm tầm nhìn, dùng một `pose` dùng lại; kết quả từng khung như cũ.
- [ ] 10 unit test ở bảng trên qua; M1-M5 bị bắt; M6 có ghi kết quả.
- [ ] `npm run typecheck`, `npm test`, `npm run build` qua; test chặt cây của e2e (không sửa) qua.
- [ ] `git diff --stat` chỉ có `propMotion.ts`, `propMotion.test.ts`, `scenery.ts`, `docs/architecture.md` (cộng `PLAN.md`, `PROGRESS.md`). Không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- `Scenery` không có unit test, vì phụ thuộc PixiJS. Phần nối (gọi đúng lúc, gán đúng vào sprite) vẫn chỉ e2e kiểm. Mục 4 và 6 trong T29b là nơi làm chặt phần đó.

## Đề xuất cho `TASKS.md`

- **T29b (mới), chờ Q1 (T63)**, vì đụng `tests/e2e/multiplayer.spec.ts` hoặc `labelLayout.ts`:
  1. Test ngẫu nhiên nhiều khung có seed cho `layoutTags` (200 cảnh × 600 khung theo mô phỏng của reviewer T5: không chồng, nhãn ghim không ẩn, không hiện lại sớm hơn 250 ms). Viết **sau** khi T63 đã đổi `comesFirst`, theo bất biến mới.
  2. Sửa chú thích chưa đúng trong `labelLayout.ts`.
  3. Bộ đếm số lần bị đánh (`hits`) trong `Scenery.debugProp`; bước "đứng thẳng lại" của test chặt cây trong `multiplayer.spec.ts` kiểm `hits` tăng lên 1 sau nhát đầu.
  4. (Tuỳ chọn) hook `debug:regrow` ở server, chỉ khi `PETGAME_DEBUG=1`: test chặt cây đi qua đường mọc lại thật (`onRemove("felled")` → `setFelled(false)`) thay cho đường tắt `setFelled(i, false)`; agent chính thêm `regrow` vào danh sách hook trong `CLAUDE.md`, `docs/architecture.md` thêm vào danh sách hook `debug:*`.
- Bỏ khỏi T29 mục "lần thử lại cách 260 px / đổi tên `d`": đã xong (`AIM_RETRY` trong `scripts/shotsLib.mjs`).
