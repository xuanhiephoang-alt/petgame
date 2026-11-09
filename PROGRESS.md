# PROGRESS: T9 Tìm đường A*

## Vòng 1: coder (Phần A: shared)
- [x] Bước 1: `packages/shared/src/pathfind.ts` mới: `NAV_CELL` (16), `NAV_MAX_CLEARANCE` (64), `PATH_HEURISTIC_WEIGHT` (1,2), kiểu `NavBody`, `PathQuery`, `PathResult`, class `NavGrid`, `defaultNav()`.
- [x] Bước 2: `packages/shared/src/index.ts` export `./pathfind.ts`.
- [x] Test: `packages/shared/src/pathfind.test.ts` (13 test: mục Test 1-12, gồm benchmark nhẹ).
- Phần B (server, `wildCombat.ts`, `companion.ts`, `pathing.ts`, `GameRoom.ts`, test server, `docs/architecture.md`) chưa làm.

### API cho phần B (import từ `@petgame/shared`)
- `defaultNav(): NavGrid`: lưới dùng chung cả process, dựng lười ở lần gọi đầu.
- `nav.lineClear(from: Vec2, to: Vec2, body: NavBody, stopShort = 0): boolean`: lấy mẫu mỗi 8 px, không cấp phát (~1 µs cho 300 px).
- `nav.findPath(from, to, query: PathQuery): PathResult`:
  - `PathQuery = { radius, sea, goalRadius, maxNodes, weight? }` (`NavBody = { radius, sea }`);
  - `PathResult = { status: "found" | "none" | "limit", path: Vec2[], expanded: number }`;
  - `path` không gồm `from`, đã làm mượt; `found` với `path` rỗng nghĩa là ô đầu đã trong `goalRadius`;
  - `expanded` là chi phí, dùng cộng dồn cho `tickBudget`; `limit` thì `expanded === maxNodes`;
  - `radius > NAV_MAX_CLEARANCE` trả `none`, `expanded` 0;
  - `from`, `to` là `Vec2` đọc ngay (không giữ tham chiếu), chạy đồng bộ.
- `nav.cellOpen(x, y, body)`, `nav.clearanceAt(x, y)`: phụ trợ cho test.
- Ngân sách đo (thế giới thật, thân 15, 200 cặp bị chắn 60-320 px, `maxNodes` 1500): cả lô 19 ms (khoảng 0,1 ms mỗi lần, ~1,8 µs mỗi ô kể cả làm mượt); `found` 197/200; ô xét: trung vị 19, p90 70, tối đa 1500, tổng 10.486.
- Lưu ý khi dùng: `maxNodes` quyết định kích thước heap (cấp lại nếu lần tìm sau cần nhiều hơn); `limit` được trả khi lấy ô thứ `maxNodes + 1` mà chưa tới đích.

- Lệch kế hoạch: không có. Chi tiết nhỏ: làm mượt bỏ ô đầu (điểm mốc bắt đầu từ ô thứ hai), và trong bộ nhớ tạm dùng thêm một `Int32Array` `trail` cấp lười để khỏi tạo mảng ô mỗi lần tìm.
- Lệnh đã chạy: typecheck ✓, test ✓ (313 test, gồm 13 test `pathfind.test.ts`); chưa chạy build (không đụng client).

## Vòng 1: coder (Phần B: server)
- [x] Bước 3: `wildCombat.ts` `stepChase` thêm `via`; test trong `wildCombat.test.ts`.
- [x] Bước 4: `companion.ts` thêm `companionReach`, `stepCompanion` thêm `via`; test trong `companion.test.ts`.
- [x] Bước 5: `ai/pathing.ts` mới (`PATHING`, `PathPlanner` luật 1-8, hàng đợi FIFO, ngân sách); `ai/pathing.test.ts` (11 test, gồm đối chứng "chỉ trượt thì kẹt" và benchmark 100 thú).
- [x] Bước 6: `GameRoom.ts`: trường `paths`, ba chỗ gọi `steer`, `paths.run(now)` sau `tickCompanions`, `forget` ở `removePal` và `despawnCompanion`.
- [x] Bước 7: `GameRoom.test.ts`: `describe("finding a way around trees")` (3 test, helper `treeCup`, `plantTrees`).
- [x] Bước 9: `docs/architecture.md` (4 chỗ).
- Lệch kế hoạch: không có. Chi tiết nhỏ: khoảng im lặng quá `staleMs` giữa hai lần `steer` chỉ đặt lại bộ đếm kẹt (không bỏ đường).
- Lệnh đã chạy: typecheck ✓, test ✓ (329 test), build ✓, e2e ✓ (32 test); 3 test "chén cây" chạy 3 lần đều qua.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (329, chạy 3 lần; 27 file)   build ✓   e2e ✓ (32, `--workers=1`)   photo3d (không chạy)
- Lặp: 3 test "chén cây" 10/10 lần qua; `pathfind.test.ts` + `pathing.test.ts` (24 test) 10/10 lần qua. Không có test chập chờn.
- Đo (script tạm ngoài repo, đã xoá; `defaultWorld()`, seed cố định, 1.500 cặp cách 60-320 px, 160 tick = 8 giây, chưa lọc cặp không có đường đi thật):
  - Hiệu năng, 100 thú bị chắn: `paths.run` trung bình 0,020 ms, p95 0,145 ms, tối đa 0,501 ms mỗi tick; tìm/tick trung bình 0,67 (tối đa 8), ô/tick trung bình 52 (tối đa 1.525); 21/160 tick có tìm. 300 thú: trung bình 0,036 ms, p95 0,184, tối đa 0,507; tìm/tick tối đa 8; ô/tick tối đa 1.554. Trong ngân sách (≤ 1.500 ô/lần, ≤ 3.000 ô và 8 lần/tick; xa dưới 50 ms).
  - Tới đích trong 8 giây khi bị chắn, trước → sau: Emberpup 86,4% → 99,5% (mọi cặp 94,7% → 99,8%); Boulderhorn 82,6% → 96,5% (mọi cặp 92,1% → 98,4%). Số "sau" của Boulderhorn thấp hơn mẫu PLAN (99,7%) khoảng 3 điểm, có thể do cặp không có đường thật chưa lọc; không phải lỗi.
  - Benchmark 100 thú: 99/100 tới nơi.
- Hành vi không đổi: không có `via` thì `stepChase`/`stepCompanion` y như cũ (test cũ không bị nới, chỉ bỏ 2 import trùng); `paths.forget` gọi ở `removePal` (GameRoom.ts:1249) và `despawnCompanion` (:2061), nên thú bị xoá, bắt, thả đều dọn trạng thái.
- Tiêu chí hoàn thành: [x] pathfind.ts  [x] pathing.ts  [x] stepChase/stepCompanion  [x] GameRoom  [x] test  [x] hiệu năng (số đo trên)  [x] tài liệu (architecture.md đã đổi; chưa đối chiếu từng dòng với pals.md, để reviewer)
- Test đã thêm: không (đủ theo PLAN).

## Vòng 2: coder
- [x] Lỗi 1 (tràn dấu lượt tìm `Uint32`): `pathfind.ts` `findPath` xoá `seen`/`closed` và đặt `stamp = 0` khi `stamp >= 0xffffffff`, ngay trước `++this.stamp`. Test mới `survives its search counter nearing the Uint32 limit` (vòng cây kín ra `none` 3 lần liền qua mức tràn, đường chén cây sau tràn giống lưới mới).
- [x] Khuyến nghị 1: `lineClear` bỏ mẫu đầu (thân đã đứng sẵn ở đó, kể cả ô hẹp hơn thân), nên thú sát cây không sinh lần tìm thừa.
- [x] Khuyến nghị 2: kiểm biển trong `lineClear` đổi từ lấy mẫu 8 px sang duyệt đúng từng ô đoạn thẳng đi qua (`seaFree`, DDA, bỏ ô đầu), không còn bỏ sót góc ô biển. Test mới `does not clip the corner of a sea cell, and ignores the tight cell it stands in`.
- Lệch kế hoạch: `lineClear` không còn đòi khoảng trống và cờ biển ở ô đầu (PLAN mục 3 nói lấy mẫu gồm cả hai đầu); khoảng trống vẫn lấy mẫu mỗi 8 px từ mẫu thứ hai.
- Lệnh đã chạy: typecheck ✓, test ✓ (331 test).

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (332 sau khi thêm 1 test, chạy 2 lần trước đó đều 331 ✓)   build ✓   e2e ✓ (32, `--workers=1`)   photo3d (không chạy)
- Số test cho mục coder vòng 2 ("xem dòng cuối bên dưới"): 331 test do coder thêm (27 file), 332 sau test của tester.
- Lặp 10 lần: 3 test "chén cây" ✓; `pathfind.test.ts` + `pathing.test.ts` (27 test) ✓. Không chập chờn.
- Đột biến tràn: bỏ `seen.fill(0); closed.fill(0)` trong `findPath`. Test coder `survives its search counter nearing the Uint32 limit` VẪN QUA (đột biến sống): nó đặt `stamp` gần mức tràn nhưng không có dấu cũ trùng id sau khi quay vòng. Không treo. Đã thêm test `does not reuse stale marks when the search counter wraps` (tìm một lần để có dấu id 1, đặt `stamp = 2^32 - 1`, tìm lại, so với kết quả mới; kiểm `stamp` về 1): với đột biến hỏng gọn (`none` thay vì `found`, 15 ms, không treo), với code thật qua. Đã khôi phục `pathfind.ts` nguyên bản.
- Đo lại (script tạm đã xoá; chỉ cặp bị chắn có đường thật theo `findPath` 20.000 ô; 8 giây): Emberpup 99,8% (586 cặp), Boulderhorn 98,0% (659), cỡ trùm 97,3% (782, tầm 64). Không tụt so với vòng 1 của reviewer (99,7 / 98,9 / 92,2; bộ cặp khác). `paths.run` 100 thú: trung bình 0,022 ms, p95 0,159, tối đa 0,441 ms; tìm tối đa 8, ô tối đa 1.525 mỗi tick; 99/100 tới nơi.
- Test đã thêm: `pathfind.test.ts` "does not reuse stale marks when the search counter wraps".

## Vòng 3: coder
- [x] Lỗi 1 (test `lineClear` không bảo vệ hai thay đổi vòng 2): `packages/shared/src/pathfind.test.ts` thay test cũ bằng hai test: `does not clip the corner of a sea cell` (một ô biển duy nhất, đường sượt góc: `false`, cùng đường `sea: true`: `true`) và `lets a body leave a spot that is tighter than the body's own cell clearance` (hai cây `(1000,1000)`, `(1058,1000)`, thân 15 ở `(1029, 990)`: đi lên `true`, đi vào cây `false`). Không đổi code sản phẩm.
- Tự kiểm bằng đột biến trong bản sao ngoài repo (scratchpad): đặt lại mẫu đầu `s = 0` làm hỏng test thứ hai; trả kiểm biển về lấy mẫu mỗi 8 px làm hỏng test thứ nhất. Đã trả lại (repo không bị đổi).
- Lệnh đã chạy: typecheck ✓, test ✓ (333 test).

## Kiểm thử vòng 3: PASS
- typecheck ✓   test ✓ (333, chạy 3 lần, 27 file)   build/e2e (không chạy lại: không đổi code sản phẩm so với vòng 2; `pathfind.ts` giống hệt bản vòng 2)   photo3d (không chạy)
- Đột biến (sửa tạm `pathfind.ts`, đã khôi phục, `diff` sạch):
  - đặt lại mẫu đầu `s = 0` → hỏng "lets a body leave a spot that is tighter than the body's own cell clearance";
  - kiểm biển về lấy mẫu mỗi 8 px (bỏ `seaFree`) → hỏng "does not clip the corner of a sea cell".
  Mỗi đột biến làm đúng một test hỏng; bản thật 17/17 qua.
- "eating berries" (`GameRoom.test.ts`): `-t "eating"` 20/20 lần qua (7 test), thêm 8/8 lần khi 4 vòng lặp CPU chạy nền; không tái hiện được lỗi coder gặp. Test này tự `room.state.pals.clear()`, không có thú nên không đi qua `paths`/T9; nó dựa vào đồng hồ thật của phòng (cooldown ăn 4 s, `until(readyAt - 500)`), tức là test theo thời gian từ T32 (6b64730). Kết luận: chập chờn có từ trước (nếu có), không tính cho T9.
- Lỗi: không có.
