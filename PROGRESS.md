# PROGRESS: T21 (thân trùm 40, đường về nhà, giới hạn đường vòng)

## Vòng 1: coder
- [x] Bước 1: `BOSS` thêm `leash`, `homeRadius`, `chaseDetourFactor`, `chaseDetourExtra`, sửa chú thích `radius` (`packages/shared/src/boss.ts`)
- [x] Bước 2: `Walker.maxPath`, `pathLength`, `detourLimit`, `lastRun.refused`, từ chối đường quá dài trong `run` (`packages/server/src/ai/pathing.ts`)
- [x] Bước 3: `bossHeadHome`, `bossReturning` (tắt ở `spawnBoss`, `removePal` của trùm), `maxPath` cho trùm ở nhánh đuổi, `stepWander` dùng `radius`, bỏ `BOSS_LEASH`, thêm `BOSS_DETOUR` (`packages/server/src/rooms/GameRoom.ts`)
- [x] Bước 4: 3 test unit (`detourLimit` x2 nhóm, từ chối `maxPath`, tường dài) (`packages/server/src/ai/pathing.test.ts`)
- [x] Bước 5: `describe("boss movement")` 3 test tích hợp (`packages/server/src/rooms/GameRoom.test.ts`); test cũ "walks the boss back home when it strays" giữ nguyên
- [x] Bước 6: `docs/architecture.md` 2 chỗ
- Ghi chú: `BOSS_DETOUR` tính ở cấp module bằng `getSpecies` được, không lỗi thứ tự nạp. Test (c) có thêm `provoke` để chắc trùm giận người chơi đứng sau tường. Chưa chạy 3 đột biến và lặp 5 lần (việc của tester).
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (345 test), build ✓, test:e2e ✓ (37 test)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (345, 28 file)   build ✓   e2e ✓ (37)   photo3d (không chạy, không đụng)
- Lặp: `GameRoom.test.ts -t "boss"` 5/5 lần qua (10 test mỗi lần); `pathing.test.ts` 3/3 lần qua (15 test). Không chập chờn.
- Đột biến (mỗi lần lưu bản gốc, khôi phục, `cmp` giống hệt):
  - dòng `stepWander` của `GameRoom.ts` về `radius: species.size`: test (a) "wanders with its whole body..." hỏng, các test khác qua.
  - thay lời gọi `bossHeadHome` bằng `if (pal.boss && false) return;` (không về nhà): (b) "walks the boss home around a wall..." và test cũ "walks the boss back home when it strays" hỏng.
  - nhánh đuổi `maxPath: undefined` trong `GameRoom.ts`: (c) "the boss stays and stomps..." hỏng. Test unit tường dài KHÔNG hỏng với đột biến này (đúng thiết kế: unit tự truyền `maxPath` cho planner, không đi qua GameRoom; PLAN.md ghi nhầm là nó hỏng theo).
  - bổ sung: `pathing.ts` `w.maxPath = undefined` (bỏ chép khi xếp hàng): hỏng cả "refuses a path longer than maxPath..." và "keeps the boss pressing on..." (unit).
- Tiêu chí hoàn thành: [x] BOSS 4 trường + JSDoc, radius sửa, không còn `BOSS_LEASH`/`8 * 32`/`256` rời  [x] stepWander dùng `radius`  [x] PathPlanner `maxPath`/`refused`  [x] `detourLimit` có test  [x] chỉ trùm nhận `maxPath` từ `BOSS_DETOUR`  [x] `bossHeadHome` (cờ tắt ở `spawnBoss`, `removePal`)  [x] test + đột biến + lặp  [x] `architecture.md` 2 chỗ
- Lỗi: không có lỗi chặn. Lưu ý nhỏ (không chặn): ở `GameRoom.ts` ~dòng 1612 JSDoc "The giant Boulderhorn appears at the foot of the volcano." của `spawnBoss` nằm trơ trên `bossHeadHome` (phương thức mới chèn giữa JSDoc và `spawnBoss`); nên chuyển lại xuống trên `spawnBoss`.
- Test đã thêm: không (đủ theo PLAN.md; không sửa file test).
