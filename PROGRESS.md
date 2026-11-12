# PROGRESS: T27 Thú hiền bỏ chạy chậm hơn người chơi

## Vòng 1: coder
- [x] Bước 1: `WILD_FLEE_SPEED_CAP = PLAYER_SPEED * 0.6` và `fleeSpeed(speciesSpeed)` kèm JSDoc, sửa JSDoc `WILD_CHASE_SPEED_FACTOR`, import `PLAYER_SPEED` (`packages/shared/src/combat.ts`).
- [x] Bước 2: nhánh bỏ chạy dùng `fleeSpeed(species.speed)`, import `fleeSpeed`, một dòng chú thích (`packages/server/src/rooms/GameRoom.ts`; bốn chỗ `WILD_CHASE_SPEED_FACTOR` còn lại không đổi).
- [x] Bước 3: test shared 1-3 `describe("fleeing passive pals")` (`packages/shared/src/combat.test.ts`), test 4 "a player walking after a fleeing Voltmouse closes in" (`packages/server/src/ai/wildCombat.test.ts`), test tích hợp 5 "a hit Voltmouse runs away slower than the player" (`packages/server/src/rooms/GameRoom.test.ts`).
- [x] Bước 5: `docs/design/pals.md` đã khớp tên `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, 96 px/s; không sửa.
- Lệch kế hoạch: không có. Test 5 gọi `tick(TICK_MS)` trực tiếp trong vòng lặp đồng bộ như plan, chạy ổn, không cần cách dự phòng.
- Chưa chạy (để tester): đột biến `fleeSpeed` trả `speed * WILD_CHASE_SPEED_FACTOR`, e2e.
- Lệnh đã chạy: typecheck ✓, test ✓ (373 test), build ✓

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (373, 30 file)   build ✓   e2e ✓ (40/40, 6,6 phút)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] `WILD_FLEE_SPEED_CAP` và `fleeSpeed` có JSDoc  [x] `GameRoom.ts` chỉ đổi import, một dòng chú thích và dòng `stepFlee`; bốn chỗ còn lại (265, 685, 722, 1622) vẫn `WILD_CHASE_SPEED_FACTOR`  [x] `FLEE_MS`, `stepFlee`, hệ số 1,8 không đổi  [x] test 1-5 có và qua; đột biến hỏng đúng  [x] test có sẵn qua không sửa  [x] typecheck, test, build, e2e sạch  [x] không đổi schema, message, Profile, client (git status)  [x] `docs/design/pals.md` dòng 213 khớp tên và 96 px/s
- Đột biến (`fleeSpeed` trả `speciesSpeed * WILD_CHASE_SPEED_FACTOR`): hỏng 4 test, đúng như PLAN: combat "Voltmouse and Mothlume are capped" (`expected 171 to be 96`), combat "every passive pal runs away slower" (`expected 171 to be less than or equal to 96.000000001`), wildCombat "a player walking after a fleeing Voltmouse closes in" (`expected 104.95 to be less than or equal to 104.81`), GameRoom "a hit Voltmouse runs away slower than the player" (`expected 171.00 to be less than 160`). Test "slower pals keep their chase speed" qua (đúng: loài chậm không bị kẹp). `combat.ts` đã trả lại, `cmp` khớp bản lưu.
- Test GameRoom mới chạy riêng 5 lần: 5/5 qua (tất định).
- Test đã thêm: không (coder đã thêm đủ).
