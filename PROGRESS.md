# PROGRESS: T49 Giữ thế giới trống thêm một lúc

## Vòng 1: coder
- [x] Bước 1: `EMPTY_WORLD_HOLD_MS = 60_000` kèm JSDoc (`packages/shared/src/constants.ts`).
- [x] Bước 2: `GameRoom` (`packages/server/src/rooms/GameRoom.ts`): `autoDispose = false` (kèm chú thích về listing), `emptyHoldMs`, `emptyHold`; `holdEmptyWorld()` ở cuối `onCreate` và ở `onLeave` khi `players` rỗng; `keepWorldOpen()` ở đầu `onJoin`; `closeIfStillEmpty()` chỉ đặt `autoDispose = true`; hook `debug:emptyHold { ms }` (chỉ khi `PETGAME_DEBUG=1`, chỉ rút ngắn, bỏ qua giá trị không phải số hữu hạn).
- [x] Bước 3: `lobbyUrl(roomId, keepWorld)` đổi tên tham số và JSDoc (`packages/client/src/net/connection.ts`).
- [x] Bước 4: `Arrival`, `arrival`, `arrivalHint` (`packages/client/src/ui/joinStatus.ts`).
- [x] Bước 5: `packages/client/src/main.ts`: `FRIENDS_KEY`, `rememberWorld`, `failToStart` luôn ghi địa chỉ, `syncAddress` theo "có bạn bè hay không", `keepWorld` thay `withFriends`, `quietRetry` trong `enter` (vào thẳng thế giới mới một lần khi `backAlone` gặp "closed"), JSDoc cho `enter`.
- [x] Bước 6: `docs/architecture.md` (mục giữ thế giới trống, hook `emptyHold`, đoạn T23 của `main.ts`, helper `closedWorld`); `CLAUDE.md` chỉ thêm tên `emptyHold` vào danh sách hook.
- [x] Test: unit `joinStatus.test.ts` (describe `arrival`), `connection.test.ts` (đổi mô tả); tích hợp server `GameRoom.test.ts` describe "keeping an empty world open" (5 test); e2e `tests/e2e/multiplayer.spec.ts`: helper `closedWorld`, sửa test "a reload goes back to the world…" và test T42, thêm test "lobby: alone, a reload comes back to the same world…".
- Lệch kế hoạch:
  - `react` trong `startGame` bỏ tham số `previous` (không còn dùng sau khi bỏ `withFriends`; `noUnusedParameters` sẽ báo lỗi), và lời gọi `react(watch.status)` bỏ đối số thứ hai.
  - Test e2e "a reload goes back to the world…": thêm hai chỗ chờ `playerCount(page) === 2` (trước `page.reload()` và trước khi `page.goto("about:blank")` ở đoạn friend2) vì địa chỉ giờ luôn có `room` nên chờ địa chỉ không còn chứng tỏ trang đã thấy bạn; không chờ thì `petgame:friends` là "0" và sảnh hiện `backAlone` thay vì `back`. Phần 2 (điện thoại): sau "Tạo thế giới mới" địa chỉ giờ có `room` của thế giới mới (kiểm bằng `expect.poll` thay vì `toBeNull`).
  - Test unit đếm `load` trong test mới: 3 (tải lại, about:blank, goto(back)) vì listener gắn sau lần mở đầu; ý đồ trong kế hoạch (không tải thêm khi vào thẳng thế giới mới) vẫn được kiểm.
- Lệnh đã chạy: typecheck ✓, test ✓ (411 test), build ✓; e2e mới `--repeat-each=5 --retries=0` ✓ (test mới 5/5; test "a reload goes back to the world" 5/5; test T42 5/5). E2E đầy đủ `npm run test:e2e` ✓ (47 test).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (411 trước khi thêm test; 412 sau)   build ✓   e2e ✓ (47/47, 7,8 phút)   photo3d (không chạy, không đụng)
- Lặp: 3 test e2e liên quan (reload về thế giới cũ, một mình tải lại, T42) `--repeat-each=10 --workers=1 --retries=0`: 30/30 ✓. `GameRoom.test.ts` chạy 3 lần: 130/130 ✓ mỗi lần; sau khi thêm test mới 131/131 ✓ ba lần. Log ở scratchpad `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad`.
- Tiêu chí hoàn thành: [x] hằng số `EMPTY_WORLD_HOLD_MS` + JSDoc  [x] `GameRoom` (autoDispose=false, holdEmptyWorld ở onCreate/onLeave, keepWorldOpen ở onJoin, hết giữ chỉ đặt autoDispose=true)  [x] người chờ nối lại tính là có người (test 2)  [x] không lưu trong lúc trống, vào lại đọc đúng (test 4)  [x] `debug:emptyHold` chỉ khi `PETGAME_DEBUG=1`, chỉ rút ngắn (test 5 + test mới)  [x] client: `?room=` một mình, `petgame:friends`, vào thẳng thế giới mới không thẻ, thẻ T23 khi có bạn (e2e)  [x] `schema.ts`/`messages.ts`/`Profile` không đổi (git diff không đụng)  [x] test unit/tích hợp/e2e có đủ  [x] lệnh sạch  [x] docs/architecture.md đã sửa (không kiểm nội dung từng dòng)
- Đột biến (mỗi cái đã hoàn nguyên, `cmp` với bản gốc khớp):
  - a) `closeIfStillEmpty` đặt `autoDispose = false`: 4 test "keeping an empty world open" hỏng (giữ/đóng, grace, tạo-chưa-vào, hook) ✓ bắt được.
  - b) bỏ `keepWorldOpen()` ở `onJoin`: 2 test hỏng ("expected Delayed{active:true} to be undefined") ✓.
  - c) bỏ `Math.min(..., EMPTY_WORLD_HOLD_MS)` trong hook: test hook hỏng ("expected 1000000000 to be 60000") ✓.
  - d) `arrival` luôn trả `"back"`: `joinStatus.test.ts` "is backAlone when..." hỏng ✓. Thêm: tắt `quietRetry` (`let quietRetry = false`) thì e2e "lobby: alone, a reload comes back..." hỏng ("Still in the lobby", thẻ lỗi) ✓.
  - e) (thêm) bỏ cổng `PETGAME_DEBUG` (`if (true)`): test mới hỏng ✓.
- `debug:emptyHold` nằm trong khối `if (process.env.PETGAME_DEBUG === "1")` (GameRoom.ts:417 trở đi). Khi không đặt biến, server ngắt hoặc bỏ qua tin; `emptyHoldMs` giữ 60 000.
- Test đã thêm: `GameRoom.test.ts` trong describe "keeping an empty world open": "the hold hook is not there on a real server (PETGAME_DEBUG not 1)" (PLAN chưa liệt kê, thiếu trước đó). Lưu ý khi viết: gửi `debug:emptyHold` mà không có handler thì `client.leave()` treo (server dường như đóng client), nên test không gọi `leave()`.
- Lưu ý không phải lỗi: khi chạy lặp e2e, log WebServer có `Failed to fetch dynamically imported module .../browserAll-*.js` và `MatchMakeError: room ... not found` (dự kiến, từ test thế giới đã đóng); không test nào hỏng.
