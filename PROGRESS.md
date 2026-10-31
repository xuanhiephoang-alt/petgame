# PROGRESS: T17 Test chập chờn trong GameRoom.test.ts

## Vòng 1: coder

Chỉ sửa một file: `packages/server/src/rooms/GameRoom.test.ts`. Không đụng code sản phẩm, không thêm hay bớt test (vẫn 194), không đổi tên test, không retry, không đổi ngưỡng hay thời gian chờ (600 px, 40 / 30 / 10 tick, giới hạn 160 tick), không `vi.mock` module.

- [x] **Bước 1: import.** Thêm `biomeAt`, `pickSpecies`, `type Biome`, `type Vec2` vào import `@petgame/shared`. `getSpecies`, `BOSS`, `isSea`, `defaultWorld`, `distance` đã có sẵn (`getSpecies` vẫn được dùng ở `placeWild`).
- [x] **Bước 2: thú đêm** (`describe("day and night")`).
  - Hàm cục bộ `rollFor(speciesId, where)`, JSDoc tiếng Anh: thử 1000 lượt bốc `(k + 0.5) / 1000`, giữ những lượt mà `pickSpecies` ra loài đó, trả lượt ở giữa; `throw` kèm lý do nếu không có. Với dữ liệu hiện tại: 0,9505 cho Mothlume ở meadow ban đêm (ban ngày cùng lượt đó ra voltmouse).
  - Thân test viết lại đúng thứ tự PLAN.md. `dayTime > 0` (giữ), `pals.clear()` (chuyển lên đầu), chỗ sinh `layout.regions.meadow`, `roll = rollFor("mothlume", { biome: biomeAt(...), night: true })`, hàm `spawnWith(draw)` (mock `Math.random` bằng `draw`, gọi `(room as any).spawnPal({ ...at })`, `vi.restoreAllMocks()` trong `finally`, toàn bộ đồng bộ). Rồi:
    1. ban ngày, `not.toBe("mothlume")`;
    2. `dayTime = 0.8`, 30 tick, `expect(room.state.dayTime).toBeCloseTo(0.8, 1)` (mới);
    3. sinh lại: `toBe("mothlume")`;
    4. `dayTime = 0.999`, 10 tick, `expect(room.state.pals.has(moth)).toBe(false)` (mới) và phép kiểm "không còn Mothlume nào không giận" (giữ nguyên).
  - Bỏ: biến `night` (luôn rỗng), vòng 30 lần `spawnPal()` ngẫu nhiên và phép kiểm `> 0`.
- [x] **Bước 3: trùm về nhà** (`describe("regions and climate")`).
  - Hàm cục bộ `bossWalk()` cạnh `westShore()`, JSDoc tiếng Anh, `STRAY = 600` và `PAST = 150` là hằng cục bộ trong hàm. Tìm theo thứ tự cố định: ring 3 đến 13, góc đặt nhà 0 đến 355 độ bước 5, hướng đi 0 đến 355 độ bước 5; "trống" = mỗi 8 px không `grid.blocked(p, BOSS.radius)` và không `isSea`; lấy kết quả đầu tiên; không có thì `throw`.
  - Thân test: `setup()`, `bossOf`, `bossHome = { ...home }`, trùm đặt ở `stray`, `brain.target = { ...away }`, `brain.idleMs = 0`, `before = distance(boss, home)`, 40 tick, `toBeLessThan(before)`. Không còn `boss.x -= 600`. Chú thích cũ "west, toward the meadow" thay bằng chú thích nói ý: để mặc thì trùm đi xa thêm, chỉ dây xích kéo nó về.
  - Tuyến `bossWalk()` chọn (chạy lại đúng thuật toán đó bằng `tsx`, file tạm đã xoá): ring 3, nhà ở 10 độ, hướng 245 độ; `home` (5058,6; 2436,1), `stray` (4805,0; 1892,3), `away` (4741,6; 1756,4); khoảng cách nhà đến `stray` 600,0 và đến `away` 750,0; 154 cặp nhà/hướng hợp lệ. Khớp số của PLAN.md.
- [x] **Bước 4: thú hoang tung chiêu** (`wild pals cast too...`). Thêm `vi.spyOn(Math, "random").mockReturnValue(0)` ngay trước vòng đợi (kèm chú thích tiếng Anh) và `vi.restoreAllMocks()` ngay sau vòng, trước các `expect`. Vòng 160 tick và mọi `expect` giữ nguyên.
- [x] **Bước 5: kiểm.** Xem "Tự kiểm" dưới đây.

### Tự kiểm (không thay cho tester)

- 3 test đã sửa chạy riêng bằng `-t "walks the boss back home when it strays|syncs the time of day|wild pals cast too"`: **20/20 lần qua** (mỗi lần tạo phòng mới, khoảng 8 giây).
- `npm test` cả bộ: **4/4 lần qua, mỗi lần 194/194** (65,0 đến 66,0 giây).
- Đột biến, mỗi cái 2 lần, trên bản sao ngoài repo (bản sao của designer, `GameRoom.ts` giống HEAD `2d81602`, thêm file test mới đổi cổng thành 2591; mỗi đột biến thay bằng `GameRoomM*.ts` có sẵn rồi khôi phục). Code thật qua 1/1. Cả 7 đột biến hỏng 2/2, đúng phép kiểm ghi bên cạnh (số dòng của `GameRoom.test.ts` trong repo):
  - M-B1 (bỏ dây xích): dòng 1084 `toBeLessThan(before)`, `expected 690.675 to be less than 599.99` (lần hai 690.45).
  - M-N1 (luôn `night: false`): dòng 529, `expected 'voltmouse' to be 'mothlume'` (bước ban đêm).
  - M-N2 (luôn `night: true`): dòng 523, `expected 'mothlume' not to be 'mothlume'` (bước ban ngày).
  - M-N3 (bỏ xoá thú đêm lúc bình minh): dòng 534, `pals.has(moth)` là `true` (bước bình minh).
  - M-N4 (bỏ đồng bộ `state.dayTime`): dòng 527, `expected 0.12 to be close to 0.8` (bước đồng bộ).
  - M-W1 (`homing: true`): dòng 676, `toMatchObject({ ..., homing: false, ... })`.
  - M-W2 (`wildSkill` luôn `undefined`): hỏng vì hết giờ 5000 ms của Vitest (`Test timed out in 5000ms`), không phải ở một `expect`: vòng chờ 160 tick (8 giây) dài hơn 5 giây, test cũ cũng thế. Vẫn là hỏng đúng vì không có chiêu nào.
- Chưa làm (việc của tester): lặp `npm test` 20 lần liền, khảo sát 120 phòng mới cho mỗi thân test, đột biến ít nhất 5 lần mỗi cái.

### Lệch kế hoạch

- Không có. Chỉ khác chi tiết nhỏ: tham số của `spawnWith` tên `draw` (để không che biến `roll` bên ngoài); `bossWalk` dùng thêm hàm `unit(degrees)` để khỏi lặp biểu thức lượng giác (cùng phép tính, cùng kết quả số học).

### Ghi chú cho tester

- Test dùng cổng 2571 cố định (`boot(..., 2571)`), nên không chạy song song với `npm test` hay một lần chạy khác của file này.
- Bản sao và script đột biến của coder, dùng lại được (ngoài repo): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t17r1/` (`copy/` đã chứa file test mới và các `GameRoomM*.ts`; `mutate.sh <BASE|MB1|MN1|MN2|MN3|MN4|MW1|MW2> "<mẫu -t>" <số lần>`; nhật ký `mutation-results.log`). Bản sao của designer ở `.../scratchpad/t17/copy/`.
- `git status` chỉ có `PLAN.md`, `TASKS.md`, `PROGRESS.md`, `packages/server/src/rooms/GameRoom.test.ts`. Cổng 2567, 5173, 2571, 2591 trống sau khi xong.

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch, trên file test cuối cùng).
- `npm test` ✓ (20 file, 194 test, 4 lần liền).
- `npm run build`: không chạy (không đụng client).

## Kiểm thử vòng 1: PASS
- typecheck ✓ (10 s)   test ✓ (`npm test` 20 lần liền, mỗi lần 20 file / 194 test, 66-67 s)   build (không chạy: chỉ đổi file test)   e2e (không chạy: chỉ đổi file test)   photo3d (không chạy: không đụng `tools/photo3d`)
- `git diff --stat`: trong số file code chỉ có `packages/server/src/rooms/GameRoom.test.ts` (+81 -9), cùng `PLAN.md`, `PROGRESS.md`, `TASKS.md`; không có file chưa theo dõi. `GameRoom.test.ts` nằm trong typecheck (`tsc -p packages/server --listFiles`). Tester không sửa file nào của repo trừ mục này.
- Kết quả chạy (`GameRoom.test.ts` nghe ở cổng 2568, xem ghi chú cổng ở cuối; hai lần thử đầu của bản sao bị `EADDRINUSE` trong lúc `npm test` lần 4-5 giữ cổng, chúng không bind được nên không ảnh hưởng, và hai lần `npm test` đó vẫn qua):

  | Việc | Kết quả |
  |---|---|
  | `npm run typecheck` | sạch |
  | `npm test` lặp 20 lần liền (chạy nền) | **20/20 qua**, lần nào cũng 20 file, 194 test, 66-67 s; log không có `Unhandled`/lỗi, chỉ cảnh báo SQLite. Có lúc bị tải thêm (đột biến chạy song song trên 1 nhân) mà vẫn qua |
  | 3 test riêng, `-t "walks the boss back home when it strays\|syncs the time of day\|wild pals cast too"`, 20 lần (mỗi lần phòng mới) | **20/20 qua** (60 test qua, 1520 bỏ qua); mỗi lần 8-10 s; trùm 2,06-2,08 s, thú đêm 2,59-2,88 s, tung chiêu 1,01-1,06 s (giới hạn Vitest 5 s) |
  | Khảo sát 120 phòng mới cho mỗi thân test | trùm **0/120**, thú đêm **0/120**, tung chiêu **0/120** (xem dưới) |
  | 7 đột biến, mỗi cái 6 lần `-t` + 1 lần cả file | **7/7 đột biến hỏng ở mọi lần** (xem bảng) |

- Khảo sát 120 phòng (bản sao ngoài repo; thân test thật được bọc `for`, thêm duy nhất một dòng ghi nhật ký ngay trước `expect` cuối và đổi cổng; ba tiến trình riêng nên mock của test tung chiêu không lan sang phòng khác):
  - Trùm: 120/120 qua. `before` = 600,0 cả 120 lần; sau 40 tick trùm cách nhà **508,2 đến 509,9 px** (trung bình 509,5): còn dư ít nhất 90 px so với ngưỡng 600, không có phòng nào gần ngưỡng. Mỗi test 2,06-3,05 s.
  - Thú đêm: 120/120 qua (mỗi test 2,06-2,81 s).
  - Tung chiêu: 120/120 qua, mỗi phòng đúng 1 chiêu `ember` (mỗi test 1,0-1,75 s).
  - Đối chứng (thân test **cũ** của HEAD, 60 phòng mỗi dòng): code thật hỏng 2/60 (607,8 và 603,7 px, tức vẫn chập chờn); khi bỏ dây xích (M-B1) cũ **vẫn qua 51/60** (chỉ hỏng 9/60). Test cũ gần như không phát hiện mất dây xích; test mới hỏng 7/7.
- Đột biến (trên bản sao `HEAD` ngoài repo, mỗi lần áp bằng thay chữ có kiểm số lần xuất hiện, in diff, rồi khôi phục và so với `HEAD:GameRoom.ts`: 15/15 lần khôi phục khớp). Số dòng là của `GameRoom.test.ts` trong repo:

  | Đột biến | Test | Lần chạy | Kết quả | Hỏng ở |
  |---|---|---|---|---|
  | M-B1 bỏ dây xích `:618` | trùm | 6 + 1 cả file | 7/7 hỏng | dòng 1084 `toBeLessThan(before)`: `expected 690,4-690,9 to be less than 599.99` |
  | M-N1 `night: false` | thú đêm | 6 + 1 | 7/7 | dòng 529 (bước ban đêm): `expected 'voltmouse' to be 'mothlume'` |
  | M-N2 `night: true` | thú đêm | 6 + 1 | 7/7 | dòng 523 (bước ban ngày): `expected 'mothlume' not to be 'mothlume'` |
  | M-N3 `if (false)` lúc bình minh | thú đêm | 6 + 1 | 7/7 | dòng 534 (bước bình minh): `pals.has(moth)` là `true` |
  | M-N4 bỏ đồng bộ `state.dayTime` | thú đêm | 6 + 1 | 7/7 | dòng 527 (bước đồng bộ): `expected 0.12 to be close to 0.8` |
  | M-W1 `homing: true` | tung chiêu | 6 + 1 | 7/7 | dòng 676 `toMatchObject`; diff cho thấy đúng khoá `homing` (`- false` / `+ true`) |
  | M-W2 `wildSkill` luôn `undefined` | tung chiêu | 6 + 1 | 7/7 | hết giờ 5000 ms (vòng đợi không thấy chiêu nào), không tới `expect` (vòng đợi 160 tick này có sẵn từ test cũ) |

- Rò mock `Math.random` (kiểm riêng): chạy **cả file** với từng đột biến, kết quả luôn là 78 test qua + đúng 1 test mục tiêu hỏng (code thật: 79/79). Gồm M-W2, nơi test hết giờ khi mock còn bật: các test sau vẫn qua. Thêm đột biến phụ M-X1 (cho `spawnPal` ném lỗi đúng tại chỗ sinh của test thú đêm, tức ném bên trong `try`): 78 qua + 1 hỏng (lỗi ném), mock vẫn được trả lại. Thêm một test thăm dò ngoài repo có đúng dạng `afterEach(vi.restoreAllMocks)`: Vitest 5.0.3 trả lại `Math.random` sau cả lỗi ném lẫn hết giờ. Test tung chiêu không bọc `try/finally` nhưng dựa vào `afterEach` có sẵn của file, và an toàn như đã thấy; theo code `waitForNextTimestep` (`@colyseus/testing`), sau khi hết giờ thì vòng lặp bị bỏ lại chỉ treo ở phòng đã huỷ, không gọi lại `vi.restoreAllMocks()` vào test sau (suy từ code; kết quả cả file ở trên khớp).
- Không bị nới lỏng: ngưỡng 600 px (`before` = 599,9999999999997), 40 / 30 / 10 / 160 tick và mọi `expect` cũ giữ nguyên (`expect(` từ 259 lên 262: thú đêm bỏ 1, thêm 4); không còn `boss.x -= 600`; không thêm `retry`, `skip`, `only`, `vi.mock`, `timeout`; tên và số test không đổi (79 `it`, 194 test cả bộ); các test khác không đổi (hunk của `git diff` chỉ ở import, `day and night`, `wild pals cast too`, `regions and climate`).
- Tính lại độc lập (tsx) cho `bossWalk()`: tuyến đầu tiên là ring 3, nhà ở 10 độ, hướng 245 độ; `home` (5058,6; 2436,1), `stray` (4805,0; 1892,3), `away` (4741,6; 1756,4); khoảng cách 600,0 và 750,0; 154 cặp nhà/hướng hợp lệ ở bước 5 độ; điểm gần nhất của mọi tuyến hợp lệ tới chỗ người chơi xuất hiện là 508 px (> `AGGRESSIVE_SIGHT` 120). `rollFor("mothlume")` ra 0,9505 (dải Mothlume ban đêm là 0,9005-0,9995, lệch 0,05 hai đầu), cùng lượt đó ban ngày ra `voltmouse`.
- Tiêu chí hoàn thành (PLAN.md):
  - [x] Trong số file code chỉ `GameRoom.test.ts` đổi.
  - [x] Test trùm: không còn `boss.x -= 600`; dùng `bossWalk()` (thứ tự cố định, kiểm `BOSS.radius` và `isSea` mỗi ≤ 8 px, `throw` khi không có tuyến); `bossHome = home`, trùm ở `stray`, `brain.target = away`, `idleMs = 0`; 40 tick; `toBeLessThan(before)`.
  - [x] Test thú đêm: mock đồng bộ quanh `spawnPal(at)`, trả lại trong `finally`; đủ 4 phép kiểm (ban ngày không ra Mothlume, `dayTime` ≈ 0,8 sau 30 tick, ban đêm ra Mothlume, bình minh xoá con đó và không còn Mothlume không giận); 30 và 10 tick.
  - [x] Test tung chiêu: mock chỉ bao vòng đợi, trả lại trước các `expect`; giữ 160 tick và mọi `expect`.
  - [x] Không `retry`, không tăng ngưỡng/timeout, không đổi tên/`skip`, không `vi.mock`; test khác không đổi.
  - [x] `npm run typecheck` sạch; `npm test` qua 20/20 lần liền.
  - [x] Chạy riêng 3 test bằng `-t` 20 lần: lần nào cũng qua.
  - [x] Khảo sát 120 phòng mới cho mỗi thân test: 0 lần hỏng.
  - [x] 7 đột biến: mỗi cái hỏng ở mọi lần (6 lần `-t` cộng 1 lần cả file), đúng phép kiểm; đã khôi phục bản sao sau mỗi lần.
  - [x] `PROGRESS.md` ghi số lần chạy, số phòng và kết quả từng đột biến (mục này).
- Lỗi: không có.
  - Ghi chú không chặn 1 (có từ trước, không thuộc T17): `boot(defineServer(...), 2571)` **bỏ qua tham số cổng**. `defineServer` trả về một `Server`, và `boot` của `@colyseus/testing` với `Server` luôn nghe ở `DEFAULT_TEST_PORT` = 2568 (bằng chứng: `EADDRINUSE 0.0.0.0:2568` khi bản sao chạy cùng lúc với `npm test`). Câu "Test dùng cổng 2571 cố định" ở mục coder vòng 1 vì vậy không đúng: cổng thật là 2568, và hai lần chạy `GameRoom.test.ts` cùng lúc (repo hoặc bản sao) sẽ tranh cổng này. Chỉ ảnh hưởng người chạy song song; bản sao của tester đổi `boot` thành `server.listen(<cổng>)` + `new ColyseusTestServer(server)` (đúng phần `boot` làm cho `Server`). Mức ưu tiên thấp.
  - Ghi chú không chặn 2: M-W2 hỏng bằng hết giờ chứ không bằng một `expect`, vì vòng đợi 160 tick (8 s) dài hơn giới hạn 5 s của Vitest (cũng như test cũ); kế hoạch yêu cầu giữ 160 tick nên không đổi.
  - Không làm: thử tải CPU (6 vòng lặp bận chạy song song) bị hệ thống từ chối quyền, nên bỏ; không bắt buộc, và các test đều chờ theo tick nên ít nhạy với tải.
- Test đã thêm: không. PLAN.md không yêu cầu test mới và không có test nào còn thiếu; tester không sửa file test nào.
- Công cụ tạm của tester (ngoài repo, dùng lại được): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t17t1/` (`npmtest-loop.sh`, `t-loop.sh`, `make-copy.sh`, `portpatch.py`, `mutate.py` + `mutrun.sh` + `run-mutants.sh`, `mksurvey.py` + `run-surveys.sh` + `summ_survey.py`, `mkold.py` + `run-control.sh`, `summ.py`; kết quả trong `res/`, `svy/`, `tres/`, `npmtest-*.log`).
