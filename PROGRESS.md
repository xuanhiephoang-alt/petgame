# PROGRESS: T57 Thú hiền chạy trốn về phía thoáng

## Vòng 1: coder
- [x] Bước 1: `packages/shared/src/combat.ts`: `FleeSteerTable`, `FLEE_STEER` (7 số), `FleeHeading`, `FleeChoice`, `FleeSteerState`, `fleeDirection`, `steerFlee`. Một hàm trong `pick(n, stepRad)` dùng chung cho vòng 9 hướng và vòng dự phòng 16 hướng (thứ tự 0, +1, -1, ...; chỉ thay khi điểm lớn hơn hẳn).
- [x] Bước 2: `packages/server/src/ai/wildCombat.ts`: `stepFlee(pos, dir, ...)` nhận hướng đơn vị.
- [x] Bước 3: `packages/server/src/ai/pathing.ts`: `constructor(readonly nav: NavGrid, ...)`.
- [x] Bước 4: `packages/server/src/rooms/GameRoom.ts`: import `steerFlee`, `FleeSteerState`; kiểu Map `fleeing`; `provoke` đặt `dirX: 0, dirY: 0, steerUntil: 0`; nhánh chạy trốn trong `tick` gọi `steerFlee(flee, pos, from, radius, this.paths.nav, now)`, rồi `stepFlee`; bước xuống biển đặt `flee.steerUntil = 0`. Không chạm gì khác.
- [x] Bước 5: test.
  - `packages/shared/src/combat.test.ts`: 9 test mới (`describe("fleeing toward open ground")`).
  - `packages/server/src/ai/wildCombat.test.ts`: hai test `stepFlee` đổi sang truyền hướng.
  - `packages/server/src/rooms/GameRoom.test.ts`: `westShore()` chuyển ra cấp module (cạnh `plantTrees`); thêm hàm phụ `fleeRun` và 2 test mới sau "a hit Voltmouse runs away slower than the player".
- [x] Bước 6: `docs/design/pals.md` không cần sửa (tên `FLEE_STEER`, `fleeDirection`, `steerFlee` đúng như kế hoạch).
- Kiểm chứng 2 test tích hợp hỏng ở code cũ: tạm thay `steerFlee(...)` bằng hướng thẳng ra xa (hành vi trước T57), chạy: cả hai hỏng (cây: dời 14 px < 70; bờ biển: dời 24 px < 70). "passive pals run away when hit" và "a hit Voltmouse runs away slower than the player" vẫn qua. Đã khôi phục bản steering (kiểm `git diff --stat`).
- Lệch kế hoạch (nhỏ):
  - `clearanceAt` nhận `(x, y)` chứ không phải điểm, nên gọi `nav.clearanceAt(fleeEnd.x, fleeEnd.y)`.
  - `PathPlanner.nav` làm bằng tham số constructor `readonly nav` (gọn hơn khai báo trường riêng).
  - Nhánh trong `tick` viết `if (flee && from)` để TypeScript tự thu hẹp, không dùng `!`; `stepFlee` nhận `{ x: flee.dirX, y: flee.dirY }` (một object nhỏ mỗi tick, như kế hoạch cho phép).
  - Số dòng trong PLAN.md lệch vài dòng so với HEAD, không ảnh hưởng.
- Lệnh đã chạy: typecheck ✓, test ✓ (497 test, 33 file), build ✓, `npm run test:e2e` ✓ (56 test), `GameRoom.test.ts` 3 lần ✓ (135 test mỗi lần).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (497 test, 33 file; sau khi thêm 2 test của tester: 499)   build ✓   e2e ✓ (56)   photo3d (không chạy, không đụng)
- Chạy lặp: `GameRoom.test.ts` 3 lần ✓ (135/135), `combat.test.ts` 3 lần ✓ (23/23), không chập chờn. Sau khi thêm test: `GameRoom.test.ts` 137/137.
- Tiêu chí hoàn thành: [x] `FLEE_STEER` 7 số, `fleeDirection`, `steerFlee`, kiểu `FleeHeading`/`FleeChoice`/`FleeSteerState`, JSDoc tiếng Anh, chỉ có `NAV_MAX_CLEARANCE` và `(0, 1)` là số ngoài bảng  [x] tất định, không `Math.random`, bằng điểm giữ hướng lệch ít hơn (`>`)  [x] `stepFlee` nhận hướng, `PathPlanner.nav` readonly công khai, `GameRoom` dùng `this.paths.nav`  [x] trạng thái giữ hướng trong `fleeing`, `provoke` đặt `steerUntil: 0`, nhánh biển đặt `steerUntil = 0`  [x] diff `GameRoom.ts` chỉ chạm import, khai báo `fleeing`, `provoke`, nhánh chạy trốn (không chạm đuổi, đầu đàn, trùm, thú đi theo)  [x] không đổi `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, `FLEE_MS`, `WILD_CHASE_SPEED_FACTOR`, schema, message, Profile, client (diff không có)  [x] 9 test shared, 2 test `stepFlee` đổi chữ ký, 2 test tích hợp, `westShore()` ở cấp module  [x] 2 test cũ ("passive pals run away when hit", "a hit Voltmouse runs away slower...") qua không sửa; diff test chỉ thêm, hai test `stepFlee` đổi theo kế hoạch, `westShore` chuyển chỗ, không có test nào bị nới  [x] typecheck/test/build/e2e sạch  [x] `docs/design/pals.md` khớp tên hàm và số (96 px, 250 ms, ±70°, 9 hướng)
- Đột biến (mỗi cái đã hoàn nguyên, so với bản sao bằng `diff`, `git diff --stat` còn 8 file):
  - a) luôn thẳng ra xa: bắt được, 6 test hỏng (4 shared, 2 tích hợp).
  - b) bỏ giữ hướng: bắt được, nhưng chỉ bởi test shared "holds a heading for 250 ms..." (test tích hợp không bắt; chấp nhận vì test shared đủ).
  - c) bỏ vòng dự phòng: bắt được, 3 test hỏng (hàng cây, bờ biển shared, bờ biển tích hợp).
  - d) bỏ `lineClear`: bắt được, 6 test hỏng.
  - e) `provoke` không đặt lại `steerUntil`: **KHÔNG bắt được** ở bản coder (19 test qua). Đã thêm test, giờ bắt được.
  - f) thú hung dữ, tự vệ, đầu đàn dùng steering: không có test nào ở bản coder. Đã thêm test; bỏ `!pal.alpha` hoặc cho hung dữ vào `fleeing` thì hỏng.
- Test đã thêm (trong `describe("chopping, dodging, dizzy pals")` của `GameRoom.test.ts`, sau hai test bờ biển):
  - "a hit again from the other side makes a fleeing pal pick a new heading at once" (khoá `steerUntil` về 0 khi `provoke`, và thú đổi hướng ngay tick sau).
  - "only passive common pals flee and steer: aggressive, defensive and alpha pals fight back" (scorchtail, emberpup, Voltmouse đầu đàn không vào `fleeing`, vào `wildAggro`).
- Hiệu năng (script tạm trong `packages/server`, đã xoá; `defaultNav()` thế giới thật, 2000 điểm ngẫu nhiên): `fleeDirection` trung bình 10 µs mỗi lần; 10 thú chọn lại **mỗi tick** (xấu hơn thực tế, thực tế mỗi 250 ms): trung bình 0,075 ms, tệ nhất 0,34 ms mỗi tick so với ngân sách 50 ms (dưới 1%).
- Không có lỗi sản phẩm.
