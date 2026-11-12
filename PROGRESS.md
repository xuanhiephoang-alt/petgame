# PROGRESS: T54 Test trùm "does not squeeze through a gap" chập chờn

## Vòng 1: coder
- [x] Bước 1: `stepWander` nhánh tới đích dùng `obstacles.grid.resolve(brain.target, obstacles.radius)`, JSDoc thêm ý không dừng trong vật cản (`packages/server/src/ai/wander.ts`).
- [x] Bước 2: test unit "stops next to an obstacle when its target overlaps it, not inside" (`packages/server/src/ai/wander.test.ts`).
- [x] Bước 3: test (a) trong `packages/server/src/rooms/GameRoom.test.ts`: import `mulberry32`, `respawnTimer = -Infinity`, `Math.random` = `mulberry32(42)` trong 100 tick rồi `vi.restoreAllMocks()`, câu kiểm cuối `deepest >= 20`. Tên, tường, tick, timeout, ngưỡng, hai câu kiểm từng tick giữ nguyên.
- Lệch kế hoạch: không có.
- Chưa chạy (để tester): đột biến (bước 5), cả file GameRoom.test.ts 3 lần, e2e.
- Lệnh đã chạy: typecheck ✓, test ✓ (367 test), build ✓, `wander.test.ts --repeats 20` ✓ (0 hỏng), `GameRoom.test.ts -t "squeeze" --repeats 80` ✓ (81 lần, 0 hỏng, 413 s).

## Kiểm thử vòng 1: FAIL
- typecheck ✓ (coder)   test ✓ (coder, 367)   build ✓ (coder)   e2e ✓ (40/40, 6.0 phút)   photo3d (không chạy)
- Cả file `GameRoom.test.ts` 3 lần: 3/3 qua (121/121, ~130 s mỗi lần), một lần chạy cùng 8 vòng lặp CPU (qua, 134 s). Tiến trình tải đã kill.
- Đột biến 1 (`GameRoom.ts:753` `radius` -> `species.size`): `-t "squeeze" --repeats 4` hỏng 5/5, tại `GameRoom.test.ts:782` (`blocked(boss, BOSS.radius - 1)` là true), không phải ở `boss.y < C.y + 60` như PLAN nói; vẫn là hỏng. Đã trả lại, `cmp` khớp.
- Đột biến 3 (bỏ dòng `stepWander` ở `GameRoom.ts:753`): hỏng 5/5, `expected 0 to be greater than or equal to 20` tại `GameRoom.test.ts:788`. Đã trả lại, `cmp` khớp.
- Đột biến 2 (`wander.ts` nhánh tới đích về `pos.x = brain.target.x; pos.y = brain.target.y;`): test unit mới hỏng đúng (1 hỏng, 5 qua), nhưng test (a) **qua 5/5 và 1/1 lần** (kỳ vọng hỏng 5/5). Đã trả lại, `cmp` khớp.
- Tiêu chí hoàn thành: [x] 3 file đổi đúng phạm vi (git status)  [x] cả file GameRoom 3 lần  [x] e2e  [x] đột biến 1, 3  [ ] đột biến 2 hỏng 5/5 ở test (a)  [ ] "test (a) hạt 42 bắt được lỗi nhánh tới đích" (PLAN mục 4)  [ ] `--repeats 80` (coder đã chạy 81/81, tester không chạy lại)
- Lỗi 1: đột biến 2 + `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "squeeze" --repeats 4` -> "Tests 1 passed" (0/5 hỏng) tại `GameRoom.test.ts:765-790`. Tái hiện: thay 3 dòng `const at = ...; pos.x = at.x; pos.y = at.y;` ở `wander.ts` bằng gán thẳng `brain.target`. Ghi vết từng tick với hạt 42: trùm dừng ở miệng khe tick 11 (y = C.y + 23.72), đích mới (-15.5, 129.5), rồi (-97.6, 31.7) từ tick 29, đi men tường sang trái tới x = C.x - 85.6, y ~ C.y + 6..7, đích mới ở tick 92; không có lần "tới đích" nào đáp lên vùng cấm của cây, nên không lấn. Thử thêm hạt 1..16 với đột biến: 0 hạt hỏng. Nghi do: mô phỏng của PLAN (hạt 42 lấn 100%) khác dãy số trong phòng thật (thứ tự rút `Math.random` khác, hoặc mô phỏng không trùng `calmBoss`/tick), nên hạt 42 không tái hiện lỗi nhánh tới đích; lỗi này chỉ còn test unit bắt. Cách sửa gợi ý cho coder: tìm hạt (hoặc đặt đích) trong chính phòng thật cho đột biến 2 hỏng ở dòng 782 rồi mới cố định, hoặc bỏ yêu cầu này khỏi PLAN và nói rõ test (a) chỉ bảo vệ khe còn test unit bảo vệ nhánh tới đích.
- Test đã thêm: không.

## Vòng 2: coder
- [x] Lỗi 1: thêm test tích hợp "the boss that arrives at a wander target overlapping a tree stops beside the tree, not inside it" trong `describe("boss movement")` (`packages/server/src/rooms/GameRoom.test.ts`). Cây đặt cách trùm `BOSS.radius + 15`, đích lang thang cách trùm 2 px (lấn 1 px vào vùng cấm), nên bước đầu tiên là "tới đích"; kiểm `blocked(boss, BOSS.radius - 0.5)` là false sau khi trùm nghỉ. Tất định, không dùng hạt giống.
- Đột biến 2 (nhánh tới đích về `pos = brain.target`): test mới hỏng (`expected true to be false`, `--repeats 4` dừng ở lần hỏng đầu); với code đúng qua `--repeats 4`. Đã trả lại `wander.ts`.
- Phân vai bảo vệ: test (a) giữ nguyên, bảo vệ khe hẹp (trùm không lọt khe); test mới + test unit `wander.test.ts` bảo vệ nhánh tới đích. Test (a) với hạt 42 không bắt được lỗi nhánh tới đích; PLAN mục 4 về điểm này không còn đúng.

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (368, 30 file)   GameRoom.test.ts ✓ (122/122, 130 s)   e2e (vòng 1: 40/40; vòng 2 không đổi gì ngoài test)
- Test mới "the boss that arrives at a wander target overlapping a tree stops beside the tree, not inside it": với code sửa qua 5/5 (5 lần gọi riêng); với đột biến 2 (nhánh tới đích về `pos = brain.target`) hỏng 5/5, `expected true to be false` tại `GameRoom.test.ts:802:70`. `wander.ts` đã trả lại, `cmp` khớp.
- Đột biến 1 và 3 đã hỏng 5/5 ở vòng 1; test (a) không đổi.
- Test đã thêm: không (coder đã thêm).

## Vòng 3: coder
- [x] Sửa chú thích test (a) theo REVIEW.md: hạt 42 chỉ cố định dãy số; việc dừng trong cây khi tới đích do test kế tiếp và `wander.test.ts` bảo vệ (`GameRoom.test.ts`).
- [x] JSDoc `stepWander`: nói "resolves the target out of any obstacle on arrival" thay vì "never ends a step inside" (`wander.ts`).
- [x] Đặt tên hằng `treeR` cho bán kính cây 14 trong test mới (`GameRoom.test.ts`). Không đổi hành vi.
- Lệnh đã chạy: typecheck, `GameRoom.test.ts -t "boss movement"`, `wander.test.ts` (kết quả ở báo cáo của coder).

## Kiểm thử vòng 3: PASS
- typecheck ✓   test ✓ (368, 30 file)
- `wander.ts` so với bản vòng 2 (đã lưu): chỉ khác JSDoc (hai dòng chú thích), mã không đổi.
- Test đã thêm: không.
