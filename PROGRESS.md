# PROGRESS: T65 Dọn sau T49

## Vòng 1: coder
- [x] Bước 1: `GameRoom.onLeave` bắt và ghi log lỗi của `removePlayer` (không ném lại), luôn `holds.delete(sessionId)`, rồi `if (isEmpty()) holdEmptyWorld()`. Thêm `isEmpty()` (`clients` rỗng và `holds` rỗng); `closeIfStillEmpty` dùng nó. (`packages/server/src/rooms/GameRoom.ts`)
- [x] Bước 2: test server 1 sửa (giữ 1000 ms, spy `closeIfStillEmpty`, kiểm `emptyHold` còn chạy và `autoDispose === false` trước `joinById`, chờ 1200 ms, timeout đóng 5000, `closes` đúng 1 lần). Thêm S2 và S3, `holdsOf` cục bộ trong `describe("keeping an empty world open")`. (`GameRoom.test.ts`)
- [x] Bước 3: `RecentWorld`, `RECENT_WORLDS_MAX = 20`, `recentWorlds`, `withRecentWorld`, `arrival(..., recent = [])` theo thứ tự kiểm mới. (`packages/client/src/ui/joinStatus.ts`)
- [x] Bước 4: `main.ts`: `RECENT_WORLDS_KEY`, `noteRecentWorld`, `arrival` nhận danh sách, đưa thế giới lên đầu khi `returning`, `rememberWorld` ghi thêm. Mọi truy cập qua `safeStorage`/`readJson`. (`packages/client/src/main.ts`)
- [x] Bước 5: test unit U1-U4. (`joinStatus.test.ts`)
- [x] Bước 6: e2e: `closedWorld` 30 s + JSDoc; test mới E1; bước E2 thêm cuối "lobby: alone, a reload…"; bước E3 thêm vào Part 1 của "lobby: a reload goes back…". (`tests/e2e/multiplayer.spec.ts`)
- [x] Bước 7: `docs/architecture.md` dòng 59, 66, 98.
- Lệch kế hoạch:
  - S1: `capture()` gọi `vi.restoreAllMocks()`, nên spy `closeIfStillEmpty` đặt sau `capture` (đặt trước thì bị gỡ, `closes` luôn 0).
  - E1: dùng `helper.state.players?.get(...)` (có `?.`) vì state đầu tiên của observer chưa tới ngay lúc `joinById` xong; lần đầu chạy thiếu `?.` làm 5/5 lần đỏ với TypeError.
  - E2 đặt tên biến tab mới là `bookmark` và `world3`; không ảnh hưởng hành vi.
- Đột biến: bỏ try/catch trong `onLeave` thì S2 và S3 đều đỏ (2 failed, 6 passed); đã khôi phục bản sửa.
- Lệnh đã chạy: typecheck ✓, test ✓ (470 test; `GameRoom.test.ts` 3 lần liền 133/133), build ✓, e2e đầy đủ ✓ (55 passed), e2e mới/đổi `--repeat-each=5 --workers=1 --retries=0`: E1 5/5, hai test `lobby:` 5/5 mỗi test.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (470, 33 file)   build ✓   e2e ✓ (55 passed, đầy đủ)   photo3d (không chạy)
- Chạy lặp: `-g "lobby:|alone, when the world has let"` `--repeat-each=8 --workers=1 --retries=0` -> 72/72 qua (gồm E1 và 2 test `lobby:` đã đổi); `GameRoom.test.ts` 3 lần liền 133/133.
- Tiêu chí hoàn thành: [x] onLeave bắt lỗi, `holds.delete`, `isEmpty()`   [x] `isEmpty()` có JSDoc, `closeIfStillEmpty` dùng nó   [x] S2, S3 qua, bỏ try/catch thì cả hai đỏ   [x] test 1 (1000 ms, kiểm trước `joinById`, spy)   [x] test cũ vẫn qua   [x] joinStatus (`recentWorlds`, `withRecentWorld`, `RECENT_WORLDS_MAX`, `arrival`)   [x] main.ts qua `readJson`/`safeStorage`, ghi ở `rememberWorld` và khi `returning`   [x] E1, E2, E3 qua, Part 2 vẫn "Bạn được mời"   [x] `closedWorld` 30 s + JSDoc   [x] không đổi schema/messages/Profile/store/chữ hint   [x] architecture.md   [x] typecheck/test/e2e
- Kiểm hai chỗ lệch của coder:
  - S1: spy đặt sau `capture` (vì `capture` gọi `restoreAllMocks`) nhưng trước `client.leave()`, nên vẫn thấy mọi lần gọi `closeIfStillEmpty` từ lúc rời. `not.toHaveBeenCalled()` sau 1200 ms và `toHaveBeenCalledTimes(1)` sau lần rời thứ hai: không yếu đi.
  - E1: `helper.state.players?.get(sessionId)?.offline` được dùng trong `expect.poll(...).toBe(true)`: `undefined` không bằng `true` nên poll vẫn chờ trạng thái thật, không qua nhầm. Bước sau `players.has(...)` toBe(false) ném lỗi khi `players` chưa có thì poll thử lại, an toàn.
- Đột biến (đều đã khôi phục, `diff` với bản gốc trống):
  - a) bỏ try/catch trong `onLeave`: S2 và S3 đỏ (2 failed, 6 passed). S3 đỏ ở `holdsOf(room).size` (1, mong 0), chưa tới bước `unhandledRejection`.
  - b) `closeIfStillEmpty` dùng `players.size > 0`: S2 và S3 đỏ (phòng không đóng).
  - c) `arrival` bỏ qua danh sách: U1 "knows a world this device was in, though this tab was not" đỏ.
  - d) `withRecentWorld` thêm vào cuối: 3 test đỏ; bỏ lọc trùng: 2 đỏ; bỏ `slice`: 1 đỏ ("drops the oldest when full"); `recentWorlds` bỏ cắt 20: 1 đỏ.
  - e) `closedWorld` 20 s: `-g "lobby:|connection:" --repeat-each=3` 45/45 vẫn qua, không có thay đổi quan sát được (đúng như dự kiến, chỉ là biên an toàn).
- Độ bền: `petgame:worlds` hỏng hoặc `localStorage` ném lỗi: đọc code (`readJson` bắt `JSON.parse`, `safeStorage` bắt mọi lỗi, `recentWorlds` nhận mọi giá trị) và test e2e mới đều cho thấy sảnh vẫn mở và hiện "Bạn được mời…".
- Test đã thêm: e2e "lobby: a corrupt device list of worlds, or storage that throws, does not break the lobby" (`tests/e2e/multiplayer.spec.ts`; 3 trường hợp: không phải JSON, sai hình dạng, `getItem`/`setItem` ném lỗi), qua.
