# PLAN: T53 `GameRoom.test.ts` có lúc hỏng ở `beforeAll` khi máy bận

Đọc code ở HEAD `b30b47a` (sau T51). File liên quan: `packages/server/src/rooms/GameRoom.test.ts` (hook ở dòng 94-97, test khí hậu ở dòng ~1779), `packages/shared/src/worldgen.test.ts` (dòng 11-14), `vitest.config.ts` (không đặt `testTimeout`/`hookTimeout`, tức mặc định 5 s / 10 s), `node_modules/@colyseus/testing/src/index.ts` (`boot`, 0.18.6), `node_modules/@colyseus/core/src/Server.ts` (`listen`, `defineServer`). Cách T17 (`632fa73`) sửa test chập chờn: làm test tất định, không thêm retry, không nới điều kiện, kiểm bằng chạy lặp.

## Mục tiêu

`npm test` là thước đo PASS/FAIL của cả đội agent. Khi `GameRoom.test.ts` hỏng ở `beforeAll`, cả 121 test tích hợp server bị bỏ qua cùng lúc và CI đỏ vô cớ. Sau T53:
- hai lần chạy vitest cùng lúc (hai agent, hai terminal, hoặc một vitest bị bỏ lại) không còn giành nhau một cổng;
- máy bận không làm hỏng test nào chỉ vì chậm, mà không nới điều kiện kiểm tra nào;
- nếu dựng server lỗi thì lỗi thật hiện ra, không còn bị che bởi "Hook timed out" và một `TypeError` phụ.

Người chơi không thấy gì khác: T53 chỉ đổi test và tài liệu.

## Kết quả điều tra (nguyên nhân gốc)

Tôi tái hiện và đo, chỉ đọc (script thử và log nằm trong scratchpad của phiên, ngoài repo). Máy 4 nhân. "Tải nặng" = 8 vòng lặp `node -e "while(...){}"` (gấp đôi số nhân) cộng `npm run typecheck` chạy cùng lúc.

1. **Hai lần chạy cùng lúc: tái hiện 100%, đúng dấu hiệu của T51.** Chạy `npx vitest run packages/server/src/rooms/GameRoom.test.ts`, 3 giây sau chạy thêm lần thứ hai. Lần đầu qua 121/121. Lần sau báo `Tests 121 skipped (121)` sau đúng 10 s, với ba lỗi:
   ```
   stderr | packages/server/src/rooms/GameRoom.test.ts
   Error: listen EADDRINUSE: address already in use 0.0.0.0:2568
       at WebSocketTransport.listen (.../ws-transport/build/WebSocketTransport.mjs:87:17)
       at _Server.listen (.../@colyseus/core/build/Server.mjs:88:12)
       at boot (.../@colyseus/testing/build/index.mjs:10:5)
       at .../GameRoom.test.ts:95:14
   FAIL  GameRoom.test.ts  Error: Hook timed out in 10000ms.          (dòng 94, beforeAll)
   FAIL  GameRoom.test.ts  TypeError: Cannot read properties of undefined (reading 'shutdown')   (dòng 97, afterAll)
   ```
   Dòng `EADDRINUSE` nằm trong khối `stderr |` ở đầu log, lẫn giữa banner Colyseus. Đọc đuôi log thì chỉ thấy "Hook timed out", nên T51 tưởng là do máy chậm.
2. **Vì sao lại là cổng 2568, không phải 2571:** `defineServer(...)` trả về một `Server`. Khi nhận một `Server`, `boot(config, port)` của `@colyseus/testing` 0.18.6 bỏ qua tham số `port` và luôn gọi `gameServer.listen(DEFAULT_TEST_PORT)` = 2568. Đúng như T22 đã ghi.
3. **Vì sao cổng bị chiếm lại thành "hết giờ" thay vì báo lỗi:** `Server.listen` của Colyseus chỉ gắn `server.on('error', reject)` **bên trong** callback "đã nghe". Khi gặp `EADDRINUSE`, callback đó không bao giờ chạy, nên lỗi chỉ được in ra (`debugAndPrintError`) và promise treo mãi. Hook chết sau 10 s, `colyseus` vẫn `undefined`, và `afterAll` ném thêm `TypeError`.
4. **Máy bận không thể làm hook quá 10 s.** Tôi đo thời gian dựng server (giống hệt hook) bằng script `tsx`: máy rảnh 36-51 ms; khi 12 vòng lặp CPU và typecheck chạy cùng lúc trên 4 nhân (5 lần đo): 111-213 ms, tức vẫn dư khoảng 50 lần so với hạn 10 s. Vậy kéo dài hạn của hook chỉ làm lỗi đến chậm hơn, không sửa được gì. Lần hỏng của T51 (lúc chạy cùng `tsc`, mà `tsc` không mở cổng) chỉ có thể là một tiến trình vitest khác đang giữ 2568: một agent khác đang chạy test, hoặc một vitest bị bỏ lại khi lệnh trước bị ngắt.
5. **Máy bận làm hỏng các test khác (dấu hiệu khác, tìm thấy khi tái hiện).** Đây cũng là lỗi "hỏng khi máy bận", nên T53 sửa luôn:
   - `npm test` dưới tải nặng: **hỏng 3/3 lần**, lần nào cũng ở `worldgen.test.ts > generateWorld > is deterministic for a seed` (`Test timed out in 5000ms`, đo được 6545 ms). Test này thuần CPU: gọi `generateWorld` 4 lần (mỗi lần 340-390 ms) rồi so sâu hai thế giới. Thời gian đo được: 1782 ms khi chạy riêng file, 2031 ms trong `npm test`, 2316 ms khi chạy cùng typecheck, 6545 ms dưới tải nặng. Nó chạy lúc mọi worker đang nạp và biên dịch file, đúng lúc CPU bị tranh nhiều nhất.
   - `npm test` chỉ chạy cùng typecheck (như T51): qua 366/366. Hai benchmark có kiểm thời gian (`pathing.test.ts` < 5 ms mỗi tick, `pathfind.test.ts` < 1000 ms) vẫn qua dưới tải nặng.
   - **Phòng đầu tiên rất đắt, và test chạy trước sẽ trả giá đó.** `createRoom` lần đầu tốn 373-469 ms khi máy rảnh và 1278-1653 ms dưới tải, vì phải sinh thế giới (`defaultWorld`) và lưới đường đi (`defaultNav`) lần đầu. Từ phòng thứ hai chỉ còn 4 ms. Test nào chạy đầu tiên (thường là khi chạy lẻ bằng `-t`, cách coder và tester hay làm) phải trả khoản này trong hạn 5 s của chính nó.
   - `regions and climate > hurts players in the snow unless they wear a coat` có hạn mặc định 5 s, nhưng kịch bản của nó đã chờ thật tới 4,5 s: đợi một nhịp khí hậu (`CLIMATE_TICK_MS` = 2000 ms, đếm từ lúc tạo phòng), rồi 50 tick = 2,5 s. Trong `npm test` nó mất 4527 ms (rảnh) và 4558 ms (tải nặng), tức 91% hạn. Chạy lẻ bằng `-t`: máy rảnh hỏng 1/2 lần (5016 ms, lần kia 4918 ms qua), tải nặng hỏng 3/3.
   - Nhóm kế tiếp, khoảng 70% hạn trong `npm test`: `pack leaders > caught, a pack leader pays the catch XP...` (3722 ms), `progression > captured pals keep the wild level...` (3717 ms), `ordering skills (keys 1-3) > with auto off...` (3285 ms) và ba test `pack leaders` khác (khoảng 3,5 s). Chạy lẻ dưới tải nặng: 5029 ms (hỏng), 4719, 4584, 4437, 4241, 4538 ms. Phần vượt chủ yếu là chi phí của phòng đầu tiên ở trên.
   - Thời gian các test `GameRoom` gần như không đổi dưới tải (chúng chờ đồng hồ thật, ít dùng CPU). Chỉ phòng đầu tiên và các test thuần CPU mới chậm đi rõ.

**Kết luận.**
- Lỗi `beforeAll` do **cổng cố định bị tranh**, không phải do chậm: `boot` bỏ qua cổng nên luôn dùng 2568, còn `Server.listen` treo thay vì báo lỗi khi cổng đã bị chiếm. Cách sửa: để hệ điều hành chọn cổng trống (`listen(0)`). Không kéo dài hạn của hook.
- Lỗi khi máy bận có hai nguồn. Một là test thuần CPU có hạn mặc định quá sát (`worldgen`). Hai là chi phí một lần của phòng đầu tiên bị tính vào test đầu tiên. Thêm vào đó, test khí hậu có kịch bản chờ thật 4,5 s/5 s ngay từ thiết kế. Cách sửa: làm nóng trong hook, bớt việc thừa, và đặt hạn riêng có số đo cho hai test có thời gian chờ dài đã biết. Đây cũng là quy ước sẵn có trong `GameRoom.test.ts`: test trùm, test tìm đường dùng `15_000`, test ăn quả dùng `20_000`.

Chỉ một bộ test mở cổng: tìm `listen(`, `createServer`, `boot(` trong mọi `*.test.ts`/`*.test.mjs` thì chỉ thấy `GameRoom.test.ts`. E2E dùng 2567/5173 do Playwright quản lý, không thuộc T53.

## Phạm vi

Làm:
- `GameRoom.test.ts`: dựng server ở cổng do hệ điều hành chọn, tắt banner và trình tắt-mềm của Colyseus trong test, làm nóng một phòng trong `beforeAll`, cho `afterAll` không ném lỗi phụ khi hook hỏng.
- `GameRoom.test.ts`: hạn riêng `15_000` cho test khí hậu, kèm chú thích có số đo.
- `worldgen.test.ts`: test tất định chỉ sinh 3 thế giới thay vì 4 (giữ nguyên các điều kiện kiểm), thêm hạn riêng `15_000` kèm chú thích có số đo.
- `docs/architecture.md`, mục test (dòng ~85): ghi luật cổng và làm nóng.

KHÔNG làm:
- Không đổi `vitest.config.ts`: không đặt `testTimeout`/`hookTimeout` chung, không `retry`, không đổi pool/số worker.
- Không bỏ, không `skip`, không đổi `expect` nào; không đổi số tick, ngưỡng hay thời gian chờ trong thân test.
- Không sửa `node_modules` hay vá Colyseus. Lỗi treo của `Server.listen` khi cổng bận được tránh bằng `listen(0)`. Phần ảnh hưởng tới `npm run dev`/`play` là việc khác (xem cuối file).
- Không đụng các mục khác của T22 (`rollFor` JSDoc, `spawnWith`, giới hạn 160 tick, nhóm "eating berries").
- Không đổi code sản phẩm (`GameRoom.ts`, `worldgen.ts`, `index.ts`...).

## Thiết kế

Không có thay đổi luật chơi, chữ hiển thị hay thao tác. Quy tắc cho hạ tầng test (ghi vào `docs/architecture.md`):
1. **Không dùng cổng cố định trong unit/tích hợp.** Server test nghe ở `127.0.0.1` cổng `0`; cổng thật đọc từ `server.transport.server.address()`. Như vậy bao nhiêu lần vitest chạy song song cũng được, và không bao giờ đụng 2567 của `npm run dev`/e2e.
2. **Chi phí một lần trả trong hook, không trong test.** `beforeAll` tạo rồi dọn một phòng, để `defaultWorld()`, `defaultNav()` và JIT đã nóng trước test đầu tiên. Ngân sách của hook: dựng ≤ 0,2 s, phòng đầu tiên ≤ 1,7 s dưới tải nặng, tổng ≤ 2 s so với hạn 10 s (dư 5 lần), nên giữ hạn mặc định.
3. **Hạn riêng chỉ khi có số đo.** Một test chỉ được đặt hạn riêng khi kịch bản của nó tự chờ thật gần hạn mặc định, hoặc khi nó thuần CPU và đo được dưới tải nặng ≥ 80% hạn. Đặt khoảng 3 lần thời gian xấu nhất đã đo, và chú thích ngay cạnh: thời gian đo được, chờ những gì. Hạn chỉ để chặn treo, không đổi điều kiện được kiểm.

## Kế hoạch triển khai

1. **`packages/server/src/rooms/GameRoom.test.ts`, phần dựng server (dòng 1-3, 92-101).**
   - Import: `import { ColyseusTestServer } from "@colyseus/testing";` (import giá trị, bỏ `boot` và `type`), thêm `import type { AddressInfo } from "node:net";`. `CloseCode`, `defineRoom`, `defineServer` vẫn từ `"colyseus"`.
   - Thêm hàm `bootTestServer(): Promise<ColyseusTestServer>` ngay trên `beforeAll`, có JSDoc tiếng Anh nói vì sao: `boot()` bỏ qua cổng khi nhận một `Server` (luôn dùng 2568), còn `Server.listen` treo thay vì báo lỗi khi cổng đã bị chiếm. Nên test để hệ điều hành chọn cổng trống, và nhiều lần chạy song song không đụng nhau. Thân hàm:
     ```ts
     const server = defineServer({ rooms: { [ROOM_NAME]: defineRoom(GameRoom) }, greet: false, gracefullyShutdown: false });
     await server.listen(0, "127.0.0.1");
     const address = server.transport.server?.address();
     if (!address || typeof address !== "object") throw new Error("the test server is not listening on a TCP port");
     server["port"] = (address as AddressInfo).port; // ColyseusTestServer points its SDK at server["port"], which listen() set to 0
     return new ColyseusTestServer(server);
     ```
     (`greet: false`, `gracefullyShutdown: false` là đúng những gì `boot()` tự đặt khi nhận cấu hình thay vì `Server`. Cái thứ nhất bỏ banner che lỗi trong log; cái thứ hai không gắn trình bắt tín hiệu thoát của tiến trình vào worker vitest. Truy cập `server["port"]`, trường `protected`, qua ngoặc vuông là được trong TS strict, đã thử `tsc --strict`. Bản thử bằng `tsx` của đúng đoạn này: hai tiến trình cùng lúc lấy cổng 42193 và 37651, cả hai `createRoom` + `connectTo` được.)
   - `beforeAll(async () => { colyseus = await bootTestServer(); await colyseus.createRoom(ROOM_NAME); await colyseus.cleanup(); });` với chú thích một dòng: phòng đầu tiên sinh thế giới và lưới đường đi (khoảng 0,45 s; khoảng 1,6 s khi máy bận), nên trả ở đây để không tính vào thời gian chờ thật của test đầu tiên.
   - `afterAll(() => colyseus?.shutdown());`: hook hỏng thì lỗi thật là lỗi duy nhất được báo.
   - Không đặt hạn riêng cho `beforeAll` (xem Thiết kế, mục 2).
2. **`GameRoom.test.ts`, test `hurts players in the snow unless they wear a coat` (dòng ~1779-1799).** Đổi `});` cuối thành `}, 15_000);`, thêm chú thích trên dòng `it(`: kịch bản chờ thật tới 4,5 s (một nhịp khí hậu 2 s đếm từ lúc tạo phòng, rồi 50 tick = 2,5 s), đo được 4,5 s trong `npm test`, quá 5 s khi chạy lẻ lúc máy bận. Thân test giữ nguyên.
3. **`packages/shared/src/worldgen.test.ts`, test `is deterministic for a seed` (dòng 11-14).** Đổi thành:
   ```ts
   const seven = generateWorld(7);
   expect(generateWorld(7)).toEqual(seven);
   expect(generateWorld(8).props).not.toEqual(seven.props);
   ```
   rồi đóng bằng `}, 15_000);`, kèm chú thích: thuần CPU, khoảng 0,35 s mỗi thế giới, khoảng 2 s trong `npm test`, 6,5 s khi máy bận (bản 4 lần sinh). Hai điều kiện kiểm giữ nguyên: cùng seed thì cả thế giới bằng nhau, khác seed thì `props` khác nhau.
4. **`docs/architecture.md`, dòng ~85 (mục `npm test`).** Thêm một câu: server test nghe ở cổng do hệ điều hành chọn (`bootTestServer`, `listen(0)` trên `127.0.0.1`), không dùng cổng cố định, nên nhiều lần `npm test` chạy song song được; `beforeAll` tạo và dọn một phòng để làm nóng; test nào chờ thật gần 5 s hoặc nặng CPU thì đặt hạn riêng kèm số đo, không đặt hạn chung.
5. **Dự phòng, chỉ khi tiêu chí C hỏng.** Sau bước 1, nếu một trong sáu test đã nêu ở mục 5 phần điều tra (`pack leaders` ×4, `progression > captured pals keep the wild level...`, `ordering skills > with auto off...`) vẫn quá 5 s khi chạy lẻ dưới tải nặng, thì áp quy tắc Thiết kế mục 3 cho đúng test đó: `15_000` kèm chú thích số đo. Ghi vào `PROGRESS.md` test nào và số đo. Không áp cho test nào chưa đo thấy hỏng.

Các bước 1-4 nằm gọn trong một commit.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile` hay lưu game. Client không bị ảnh hưởng.

## Test

Không thêm test mới. Đây là sửa hạ tầng test, nên phép thử chính là chạy lặp dưới các điều kiện gây lỗi. Tester tự viết script tải trong scratchpad (không đưa vào repo) và kill hết tiến trình khi xong. Số vòng lặp CPU bằng `2 × $(nproc)`:
```bash
pids=""; for i in $(seq 1 $((2 * $(nproc)))); do node -e "const e=Date.now()+600000; while(Date.now()<e){}" & pids="$pids $!"; done
# ... chạy kiểm ... rồi: kill $pids
```
Đọc **toàn bộ** log của mỗi lần chạy (`grep -E "FAIL|Error|EADDRINUSE|timed out|skipped"`), không chỉ dòng cuối.

- **A (hai lần chạy cùng lúc), 3 vòng:** chạy đồng thời `npm test` và `npx vitest run packages/server/src/rooms/GameRoom.test.ts`. Cả hai qua, không `skipped`. Trước khi sửa: lần sau hỏng 1/1.
- **B (cổng cũ bị chiếm):** giữ 2568 và 2571 bằng `node -e "const n=require('net');n.createServer().listen(2568);n.createServer().listen(2571)"` chạy nền, rồi chạy `npx vitest run packages/server/src/rooms/GameRoom.test.ts`. Qua 121/121. Trước khi sửa: hỏng chắc chắn.
- **C (chạy lẻ dưới tải nặng), mỗi test 3 lần:** `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "<tên>"` với `hurts players in the snow`, `caught, a pack leader pays the catch XP`, `captured pals keep the wild level`, `with auto off it uses no skill of its own`. Tất cả qua. Ghi thời gian từng lần (`--reporter=verbose`). Trước khi sửa: climate hỏng 3/3, pack leader hỏng 1/2.
- **D (`npm test` dưới tải nặng + typecheck), 3 vòng:** 0 hỏng, đủ 366 test (hoặc đúng số test hiện có, không ít hơn). Trước khi sửa: hỏng 3/3 ở `worldgen`.
- **E (bình thường):** `npm run typecheck` sạch; `npm test` một lần lúc máy rảnh qua hết; `npm run build` qua. Không cần chạy e2e vì không đổi code client hay server. Nếu tester vẫn chạy, nhớ tắt mọi vitest trước, dù vitest không còn dùng cổng của e2e.
- **Đột biến (cho reviewer):** đổi tạm `listen(0, ...)` thành `listen(2568, ...)` rồi chạy A, phải thấy hỏng lại. Bỏ tạm phần làm nóng rồi chạy C với test khí hậu đã có `15_000`, phải vẫn qua, vì hạn riêng tự đủ. Hoàn tác cả hai.

## Tiêu chí hoàn thành

- [ ] `GameRoom.test.ts` không còn số cổng cố định nào (`2568`, `2571`, `boot(`). Server test nghe `127.0.0.1:0` qua `bootTestServer()` có JSDoc nói rõ hai lỗi của Colyseus đã nêu.
- [ ] `beforeAll` làm nóng một phòng rồi `cleanup()`; `afterAll` dùng `colyseus?.shutdown()`; không có hạn riêng cho hook.
- [ ] Đúng hai hạn riêng mới, `15_000` cho test khí hậu và test tất định của `worldgen`, mỗi cái có chú thích kèm số đo. Hoặc thêm một số trong sáu test của bước 5, nhưng chỉ khi C hỏng, và có ghi số đo trong `PROGRESS.md`.
- [ ] Không đổi `vitest.config.ts`; không `retry`, `skip`, `only`; không đổi `expect`, số tick hay ngưỡng nào. `git diff --stat` chỉ có `GameRoom.test.ts`, `worldgen.test.ts`, `docs/architecture.md`, cùng `PROGRESS.md`/`REVIEW.md`/`TASKS.md`.
- [ ] Số test không giảm: 30 file, 366 test (hoặc đúng số hiện có trước khi sửa).
- [ ] A 3/3, B 1/1, C 12/12, D 3/3, E đều qua, tổng cộng 0 hỏng. Kết quả ghi trong `PROGRESS.md` kèm thời gian của các test ở C.
- [ ] Log của một lần `npm test` không còn banner Colyseus.
- [ ] `docs/architecture.md` có luật cổng trống, làm nóng và hạn riêng có số đo.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **`server["port"]` là trường `protected` của Colyseus.** `ColyseusTestServer` cũng đọc đúng trường này bằng tên, nên hai bên ăn khớp. Nếu bản Colyseus sau đổi tên trường, SDK sẽ nối tới cổng 0 và test đầu tiên hỏng ngay, rõ ràng, chứ không thành chập chờn. Đã cân nhắc cách chỉ dùng API công khai: mở rồi đóng một socket `net` ở cổng 0 để lấy số cổng, xong `server.listen(số đó)`. Bỏ cách này vì có khe hở giữa lúc đóng và lúc mở lại, và nếu dính khe đó thì `Server.listen` lại treo y như lỗi đang sửa.
- **Phòng làm nóng.** Phòng này không có người chơi và được `cleanup()` huỷ trước test đầu tiên. Cơ sở dữ liệu `:memory:` chỉ mở khi có người vào (`useStore` lười), nên trạng thái mà các test thấy không đổi. Nếu một test nào lỡ phụ thuộc vào việc "phòng đầu tiên của tiến trình" thì A và D sẽ lộ ra.
- **Hai benchmark có kiểm thời gian** (`pathing.test.ts` < 5 ms mỗi tick, `pathfind.test.ts` < 1000 ms) vẫn qua dưới tải nặng trong mọi lần đo, nên để nguyên. Nếu D hỏng ở đó thì ghi lại, không nới ngưỡng trong T53, và đề xuất việc riêng.

### Đề xuất cập nhật `TASKS.md` (cho agent chính)

- **T22:** bỏ phần đầu về cổng (`boot(..., 2571)` ... "cổng lấy từ biến môi trường"), vì T53 đã làm (cổng do hệ điều hành chọn, không cần biến môi trường). Giữ các mục còn lại.
- **Việc mới, P3:** "`npm run dev`/`npm run play` treo im lặng khi cổng 2567 đã bị chiếm. `Server.listen` của Colyseus 0.18 chỉ gắn `on('error', reject)` sau khi đã nghe, nên `EADDRINUSE` chỉ được in ra rồi promise treo mãi, dòng 'PetGame server listening' không bao giờ hiện. Trong `packages/server/src/index.ts`, bắt lỗi `listen` (ví dụ gắn `error` trên `server.transport.server` trước khi `listen`, hoặc thử cổng trước), in thông báo rõ ràng rồi thoát với mã ≠ 0."
