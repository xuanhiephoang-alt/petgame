# PROGRESS: T29 Dọn nhỏ sau T5 (phần làm được khi chưa có Q1)

## Vòng 1: coder
- [x] `packages/client/src/game/propMotion.ts`: `PropPose` và `stepPropMotion(motion, dt, standingTree, jolts, out)` đúng Thiết kế 1: đọc `growing` trước khi đếm lùi, đếm `shake` và `grow` bằng `countDown`, ghi `lean` (chỉ cây đứng), `dx` (đá hoặc vật đã đổ), `size` (chỉ khi đang mọc; đúng 1 ở khung cuối), `busy` (còn rung sau khung này) vào `out` dùng lại. Không số cứng mới, `PROP_MOTION` không đổi.
- [x] `packages/client/src/game/scenery.ts`: trường `pose` tạo một lần; `Scenery.update` gọi `stepPropMotion` ở đúng chỗ cũ, trước `if (!visible) continue`; cùng biểu thức và thứ tự như mã cũ; bỏ import `countDown`, `growSize`, `shakeJolt`, `shakeLean` không còn dùng.
- [x] `packages/client/src/game/propMotion.test.ts`: `describe("stepPropMotion")` với 10 test của bảng kế hoạch (khung cuối mọc lại đúng 1, đang mọc, không mọc thì `size` undefined, cây đứng rung, khung cuối rung `lean` đúng 0, đá rung, gốc cây, `dt` <= 0, trả đúng `out`, rung và mọc cùng lúc).
- [x] `docs/architecture.md`: dòng `game/propMotion.ts` thêm `stepPropMotion` và việc `Scenery.update` gọi nó trước phép kiểm tầm nhìn.
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, `npm test` ✓ (775 test), build ✓. Test chặt cây của e2e (`gameplay: chop a tree, dash, and knock out a dizzy pal`, không sửa file) ✓ (11,5 s). `npm run test:e2e` đầy đủ ✓ (72 passed; flake `boss bar (phone upright, notch)` không xảy ra).
- Đột biến M1-M6 là việc của tester, chưa chạy. `git diff --stat` chỉ có `propMotion.ts`, `propMotion.test.ts`, `scenery.ts`, `docs/architecture.md` (cộng `PROGRESS.md`). Không đụng `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json`; không commit.

## Kiểm thử vòng 1 (T29): PASS
- typecheck ✓   test ✓ (50 file, 775 test)   build ✓   e2e ✓ (72/72; `gameplay: chop a tree, dash, and knock out a dizzy pal` qua riêng; boss bar không flake)   photo3d (không chạy)
- `git diff` chỉ có `propMotion.ts`, `propMotion.test.ts`, `scenery.ts`, `docs/architecture.md`, `PROGRESS.md`; không đụng `multiplayer.spec.ts`, labelLayout, `.claude/`; `git stash list` còn 2 mục.
- Tương đương hành vi: kịch bản tạm (`tsx`) chạy phép tính inline của `Scenery.update` ở HEAD (đếm lùi, `shakeLean`/`shakeJolt`/`growSize`, `busy`) và `stepPropMotion` trên 1,88 triệu trạng thái ngẫu nhiên (kể cả cạnh: 0, đúng `shakeSec`, `dt` âm và 0, cây đứng, cây đổ, đá): 0 khác biệt (so `Object.is` từng trường và cả `motion.shake/grow` sau khung). Không cấp phát: 5 triệu lần gọi, heap đổi -7 KB, hàm trả đúng `out` (cùng object); `scenery.ts` dùng một `pose` thành viên.
- Đột biến (hoàn tác bằng bản sao, diff khớp): M1 -> "gives exactly the full size on the last frame of growing back"; M2 -> "jolts a rock sideways and does not lean it" và "jolts a felled tree's stump..."; M3 -> "leans a standing tree that shakes, without a jolt"; M4 -> "is exactly upright and still on the last frame of shaking"; M5 -> "leaves the size alone when not growing...". Cả 5 bị bắt.
- M6 (gọi `stepPropMotion` sau `if (!visible) continue`): unit không bắt được (đúng dự kiến); e2e `chop a tree` **vẫn qua** (cây được chặt luôn trong tầm nhìn nên không thấy khác biệt). Ghi lại: phần này để T29b/kiểm thử có camera di chuyển.
- Không thêm test. Không commit.
