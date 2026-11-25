# PROGRESS: T22 Dọn `GameRoom.test.ts` sau T17

## Vòng 1: coder
- [x] `packages/server/src/rooms/GameRoom.test.ts`:
  - bỏ `import type { AddressInfo }` và cast trong `bootTestServer` (`address.port`);
  - `steadyClock(room)` (JSDoc) trong `describe("eating berries")`, gọi sau `setup()` ở test 1 và test 2; test 1 thêm `expect((now(room) - clockStart) % TICK_MS).toBe(0)` (khuyên nên thêm trong plan): hỏng ngay nếu đồng hồ phòng không còn tiến đúng `TICK_MS` mỗi tick;
  - JSDoc `rollFor` nói rõ hàm ném lỗi; dòng `expect(() => rollFor("mothlume", { ..., night: false })).toThrow(/no roll picks mothlume/)`;
  - `spawnWith` chỉ gỡ spy của nó (`spy.mockRestore()`), kèm `expect(vi.isMockFunction(Math.random)).toBe(false)` sau lần gọi đầu;
  - test thú hoang tung chiêu: `CAST_WITHIN_TICKS = 20` (thay 160) và `expect(casts.length, "...").toBeGreaterThan(0)` trước `casts[0]`.
- [x] `packages/server/src/worldLimits.test.ts`: bỏ cast và import `AddressInfo`. `packages/server/src/http.test.ts`: bỏ cast ở dòng `server["port"]`, giữ import (còn dùng ở chỗ khác).
- [x] `packages/shared/src/worldgen.test.ts`: chú thích hạn chạy nói 3 thế giới, kèm số đo.
- [x] `docs/architecture.md`: một câu về `steadyClock` ở dòng `npm test`.
- Đo: chiêu thú hoang ra sau **2 tick** (5 lần chạy đều 2), ghi vào chú thích; 20 tick chừa khoảng 10 lần.
- Lệch kế hoạch: không có. Không file sản phẩm nào đổi (`git status`: chỉ 4 file test và `docs/architecture.md`, cộng `PROGRESS.md`). Các đột biến của mục Test (bước 2-8) là việc của tester, coder chưa chạy; chỉ chạy bước đo tick (bước 4, đã hoàn tác log tạm).
- Lệnh đã chạy: typecheck ✓, `npm test` ✓ (713 test). Chạy `npx vitest run packages/server/src/rooms/GameRoom.test.ts` 10 lần liên tiếp: 10/10 qua (140 test mỗi lần), mỗi lần 144,0 đến 145,9 s (145,19; 145,60; 145,29; 144,96; 144,89; 145,91; 145,49; 145,70; 144,02; 145,20), không hỏng lần nào. Không chạy e2e (không đụng client, mạng, UI).

## Kiểm thử vòng 1 (T22): PASS
- typecheck ✓   test ✓ (48 file, 713 test; `GameRoom.test.ts` chạy cả file 3 lần: 140/140, ~145 s mỗi lần)   build (không chạy)   e2e (không chạy: `git diff` chỉ có `*.test.ts` và `docs/architecture.md`, không có code sản phẩm; `systems/` không đổi)
- Đột biến (hoàn tác bằng bản sao, diff khớp):
  - ăn cho qua sớm 600 ms (`camp.ts`) -> 2 test hỏng, `expected 1 to be 2` (test 1 và "one tick early").
  - hồi chiêu ngắn hơn 1000 ms -> test 1 hỏng `expected 2900 to be greater than 3500`.
  - thú hoang không tung chiêu (`0.06` -> `-1`) -> hỏng ở `expect` có lời "a provoked wild pal ... expected 0 to be greater than 0" sau 1067 ms (cả lệnh 3,0 s). Trên test của HEAD (vòng 160): `Test timed out in 5000ms` (7,0 s).
  - đo tick ra chiêu: 5 lần đều 2 tick (khớp chú thích).
  - bỏ `spy.mockRestore()` -> `expected true to be false`; thêm spy `console.warn` ngoài: bản mới qua, đổi về `vi.restoreAllMocks()` -> `expected false to be true`.
  - `rollFor` với `night: true` -> `expected [Function] to throw an error`.
  - đồng hồ không đều (`TICK_MS + 7`) -> guard hỏng `expected 14 to be +0`.
  - khựng 700 ms: **vị trí kế hoạch ghi không tái hiện được.** Khựng ngay sau `client.send` (cả hai điểm): khựng chặn cả vòng sự kiện nên tick quá hạn chạy trước khi tin được xử lý, nên thời gian phòng nhảy *trước* khi tin ăn, test vẫn qua dù không có `steadyClock` (điểm 1 không có `steadyClock` chỉ hỏng ở guard, `expected 7 to be +0`). Hai điểm đặt đúng để có tác dụng: (A') `send; await ticks(room,1); khựng; await ticks(room,1)` (tin đã xử lý, rồi tick nhảy), bỏ guard: có `steadyClock` qua, không có hỏng `expected 3249 to be greater than 3500`; (B') `until(readyAt-500); khựng; await ticks(room,1); send`: có `steadyClock` qua, không có hỏng `expected 1 to be 2`. Đề nghị lần sau sửa vị trí khựng trong PLAN.md; không ảnh hưởng test.
- Chạy lặp: "eating" 20/20 qua (178 s, ~8,9 s mỗi lần); 10/10 qua dưới 4 vòng lặp CPU (103 s, ~10,3 s mỗi lần); "wild pals cast too" 10/10 qua (30 s, ~3,0 s mỗi lần). Đã tắt các vòng lặp CPU.
- Ràng buộc: không đụng `multiplayer.spec.ts`, labelLayout, `.claude/`; `git stash list` còn 2 mục. Không commit.
