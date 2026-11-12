# PROGRESS: T59 Cây bị chặt không hết rung, cây mọc lại không lớn hết

## Vòng 1: coder
- [x] Bước 1: `packages/client/src/game/propMotion.ts` (mới): `PROP_MOTION`, `countDown`, `shakeLean`, `shakeJolt`, `growSize`, không import pixi.
- [x] Bước 2: `packages/client/src/game/scenery.ts`: dùng `PROP_MOTION`; `setFelled(true)` đặt `grow = 0`; `update` nhận `dt` bắt buộc (bỏ `= 0`); đếm lùi và đặt dáng trước phép kiểm tầm nhìn; khung `grow` về 0 đặt đúng cỡ thật (`growing` đọc trước khi đếm lùi); thêm `debugProp(index)`.
- [x] Bước 3: `packages/client/src/game/Game.ts`: `scenery.update(view, t, focus, dt, aimed?.actor.pos)`; `debugInfo(prop?)` thêm trường `prop`.
- [x] Bước 4: `packages/client/src/game/propMotion.test.ts` (mới): đủ các ca trong PLAN.
- [x] Bước 5: `tests/e2e/multiplayer.spec.ts`, test `gameplay: chop a tree...`: ba bước poll (đứng thẳng sau nhát đầu, gốc hết giật, mọc lại đủ cỡ bằng `game.scenery.setFelled(i, false)`).
- [x] Bước 6: `docs/architecture.md` (dòng `game/propMotion.ts`), `docs/art-style.md` (mục Chuyển động).
- Lệch kế hoạch: không có. (Chưa chạy bước "tạm đặt dt = 0" của tester.)
- Lệnh đã chạy: typecheck ✓, test ✓ (401 test), build ✓, test:e2e ✓ (41 test)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (401, 32 file)   build ✓   e2e ✓ (41)   photo3d (không chạy)
- Chạy riêng "gameplay: chop a tree" 3 lần: cả 3 đều qua (14 s, 29 s, 21 s), không chập chờn.
- Kiểm biến đổi (đã khôi phục từng file, kiểm bằng `cmp`):
  - Game.ts truyền lại `dt = 0` -> e2e `gameplay: chop a tree` HỎNG tại `tests/e2e/multiplayer.spec.ts:739` (bước chờ cây hết rung). Đúng như kế hoạch.
  - scenery.ts trả về `if (p.grow > 0)` thay `if (growing)` (khung mọc lại cuối không đặt đủ cỡ) -> unit 86/86 vẫn qua (khối vòng lặp trong `Scenery.update` không có unit test, chỉ phần toán), nhưng e2e HỎNG tại `multiplayer.spec.ts:761` (kiểm `size == 1`). Lỗi này do e2e bắt.
  - propMotion.ts `growSize(0)` trả 0.55 thay 1 -> 5 unit test hỏng (`growSize` và `a whole shake and regrow`).
- Tiêu chí hoàn thành: [x] cây hết rung, đứng thẳng, đúng chỗ  [x] gốc cây hết giật  [x] mọc lại đúng đủ cỡ  [x] dt thật truyền vào, không còn mặc định  [x] unit + e2e bắt được lỗi cũ
- Chưa chụp `npm run shots` (tuỳ chọn).
- Test đã thêm: không thêm mới (test của coder đủ: `propMotion.test.ts`, bước kiểm trong e2e `gameplay:`).
