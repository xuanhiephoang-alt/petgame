# PLAN: T37 Hai test e2e còn nhắm "con thú gần nhất" (gameplay đánh choáng, thú đi theo sau khi bắt)

## Mục tiêu

- **Vấn đề** (đo ở HEAD `b7a3403`, mục Thiết kế 1): hai test e2e hỏng oan vì đánh hoặc ném vào "thú hoang gần nhất", mà con gần nhất có thể là một thú hoang đi ngang qua.
  - "gameplay: chop a tree, dash, and knock out a dizzy pal": hỏng **3/30** lần đo, ở ba chỗ khác nhau. Trước đó tester T39 đo được 2/10 (code trước T39) và 1/31 trong bộ đầy đủ.
  - "a captured pal follows the player and shows in the party panel": hỏng **6/53** lần đo hợp lệ (11%), thêm 1 lần qua nhờ may (bắt nhầm một thú hoang khác).

  Đội chấm PASS dựa vào e2e, nên mỗi lần hỏng oan tốn một vòng sửa.
- **Sau nhiệm vụ:**
  - Hai test chỉ tác động lên con thú debug của mình: bóng ném theo id; đòn đánh thì đứng đúng chỗ con thú đó.
  - Phím Space chỉ được bấm để chặt cây khi không thú hoang nào kịp chen vào tầm đánh.
  - Test thú đi theo bắt đúng một con, bỏ hai chỗ chờ cứng.
  - Hai helper dùng chung với test toasts (T36).
- Người chơi không thấy gì khác. Mục "Tính khí" trong `docs/design/pals.md` đã ghi luật (game-designer đã sửa trong nhiệm vụ này).

## Phạm vi

Làm:
- `tests/e2e/multiplayer.spec.ts`:
  - thêm 2 helper;
  - sửa 2 test hỏng;
  - cho test toasts (T36) và test "party: let a pal go..." dùng helper, hành vi giữ nguyên.
- Một câu trong dòng "Helper" của `docs/architecture.md`.

Số dòng trong file này tính theo HEAD `b7a3403`.

KHÔNG làm:
- **Không đổi code sản phẩm** (`packages/*`), không thêm hook debug. Mọi thứ cần đã có sẵn:
  - tin `throw` nhận `palId`;
  - `debug:spawnPal` nhận `species`;
  - `debug:teleport`.
- Không sửa hành vi game liên quan. Đó là việc riêng: Voltmouse chạy nhanh hơn người chơi (T27), dấu thú đang nhắm (T28).
- Giữ nguyên:
  - tên test, `test.slow()`;
  - bước lướt (dòng 557-567);
  - chờ 800 ms sau khi dịch tới cây (dòng 549);
  - chờ 500 ms giữa hai lần Space đánh choáng (dòng 577): giữ nhịp hồi đòn 400 ms;
  - chờ 2500 ms trước khi tải lại trang ở test thú đi theo (dòng 190): chờ lưu game, không liên quan việc bắt;
  - mọi kiểm tra không nêu ở dưới.

  Không thêm retry, không nới điều kiện kiểm tra.

## Thiết kế

### 1. Đo nguyên nhân

**Cách đo.** Chép mỗi test thành một bản có ghi chép trong scratchpad: đúng các bước và các lần chờ, chỉ thêm phần ghi lại, không tác động gì.
- Phần ghi lại gồm:
  - tin server (`hit`, `defeated`, `damage`, `captureResult`, `notice`);
  - mọi tin trang gửi, kèm vị trí người chơi;
  - các thú trong 300 px ở mỗi bước (id, loài, cấp, máu, choáng, khoảng cách);
  - mẫu 10 lần mỗi giây.
- Chạy bằng chính config Playwright của repo (cùng server, trình duyệt), `--repeat-each=30 --workers=1`.

**Luật gốc** (đọc trong code):
- Đòn đánh không mang mục tiêu: `ClientMessage.Attack` không có payload.
- Server cho trúng **thú hoang gần nhất trong tầm vũ khí**: `handleAttack` (`GameRoom.ts:843-869`) gọi `nearestPal(player, weapon.range)` (`2111-2124`), tay không 48 px (`ATTACK_RANGE`, `constants.ts:19`). Chỉ khi không có con nào trong tầm thì mới hái quả, chặt cây (`854-856`).
- Con thú debug xuất hiện cách người chơi 40 px về bên phải (`GameRoom.ts:404`), máu 1, đứng yên 60 giây.

**Test gameplay: hỏng 3/30, cả ba do Space trúng một thú hoang khác.** Xác nhận giả thuyết, và lộ thêm chỗ chặt cây.

| Lượt | Hỏng ở | Bằng chứng |
|---|---|---|
| 28 | dòng 574, `dizzyPals` chờ 1, nhận 0 | Một Pebblet hoang cấp 4 (đầy máu) đứng yên cách người chơi 33,2 px, gần hơn con thú debug (40 px). Space đầu trúng con hoang; nó đánh lại (4 cú cắn, Ném đá). |
| 0 | dòng 579, `dizzyPals` chờ 0, nhận 1 | Space đầu làm con thú debug choáng. Rồi một Bubbloon hoang cấp 1 đi tới cách 17,9 px; Space thứ hai trúng nó, con thú debug vẫn choáng. |
| 11 | dòng 554, `wood >= 3`, nhận 0 | Một Pebblet hoang cấp 2 ở trong 48 px quanh chỗ chặt cây. 7/8 lần Space trúng thú (con Pebblet, một Leafkit đi qua). Con Pebblet đánh lại (Ném đá, 2 cú cắn), đẩy người chơi lùi 44 px khỏi cây. |

- Các lượt qua cũng suýt hỏng: 6/30 lượt có một thú hoang khác trong 48 px lúc bấm Space sau khi tạo thú; 2 trong số đó trong 40 px, chính là lượt 0 và 28.
- Ước tính tĩnh với luật sinh thú của server (20.000 thế giới):
  - có thú hoang trong 40 px quanh chỗ dừng sau khi lướt: 3,3% mỗi thời điểm;
  - có thú hoang trong 48 px quanh chỗ chặt cây: 3,2% mỗi thời điểm.

**Test thú đi theo: hỏng 6/53 lượt hợp lệ, cả 6 ở dòng 185** (`hasBase`).
- Đo hai đợt 30 lượt. Đợt 1 có 7 lượt hỏng do lỗi của chính bản ghi chép, không tính: bản ghi chạy trước khi `game` có, vì test này không chờ khung hình đầu. Đợt 2 đã sửa bản ghi, 30/30 lượt hợp lệ.
- **Đường 1, ném nhầm sau khi bắt: cả 6 lượt hỏng đều do đường này.**
  - Vòng ném trong trang (dòng 145-153) kiểm `me().pals.length === 0` ở đầu mỗi vòng. Lúc đó tin ném vừa gửi, server chưa trả lời.
  - Rồi nó ngủ 900 ms và ném vào con gần nhất, không kiểm lại. Vậy là sau mỗi lần bắt luôn có **thêm một quả bóng** vào "con gần nhất" (53/53 lượt). Con đó ở xa hơn 180 px thì server bỏ qua.
  - 20/53 lượt có thú hoang trong 180 px nhận quả bóng thừa. Con đó đầy máu nên 15 lần bóng vỡ, và khi thoát bóng nó bị chọc (`breakOut` gọi `provoke`). 5 lần còn lại bắt thêm được con thứ hai.
  - Nếu con bị chọc là thú tự vệ (Emberpup, Pebblet; 10/53 lượt), nó đuổi cắn suốt phần còn lại của test. Ở các lượt hỏng: 4-7 cú cắn và 1-2 lần Ném đá hoặc Tàn lửa, mất 34-66 máu. Mỗi cú cắn đẩy người chơi 16 px ra xa nó.
  - Khi nó đến từ phía tây hoặc tây nam, người chơi bị đẩy về phía lửa trại chung. Trại phải cách lửa trại ít nhất 96 px (`BASE_MIN_CAMPFIRE_DISTANCE`, `work.ts:27`), mà chỗ xuất phát chỉ cách 110,9 px.
  - Server báo "Quá gần lửa trại chung" (`GameRoom.ts:1036`), `hasBase` không bao giờ thành true, test hỏng ở dòng 185. Lúc bấm dựng trại, người chơi ở cách lửa trại 71-91 px (6 lượt hỏng).
- **Đường 2, thú hiền chạy khỏi tầm, rồi ném nhầm trước khi bắt** (đợt 1, lượt 25):
  - Con thú debug là Leafkit cấp 1 (tỉ lệ bắt 0,90) nhưng thoát bóng lần đầu, chạy trốn 2,5 giây, dừng ở 267 px (ngoài tầm ném 180 px), rồi đứng yên.
  - Vòng ném chuyển sang con gần nhất: một Emberpup hoang cách 48 px. Bóng vỡ một lần, lần sau bắt được.
  - Test qua nhờ bắt nhầm con khác. Không có con Emberpup đó thì mọi lần ném sau bị từ chối, 0 lần bắt, hỏng ở dòng 158.
  - Mô phỏng của T36: đường này xảy ra ở 0,28-0,49% số lượt.
- Quả bóng thừa bắt thêm con thứ hai ở 5/53 lượt. Đó chính là lý do của kiểm "một con trở lên" (dòng 157-158) và hai chỗ chờ cứng (dòng 154 và 166-167: "một quả bóng đang bay có thể bắt thêm con nữa"). Hết quả bóng thừa thì kiểm được đúng 1 và bỏ hai chỗ chờ.

### 2. Cách làm tất định

**a) Hai helper dùng chung**, đặt ngay sau `sendFrom` (dòng 985):
- `spawnWeakPal(page, species?)`: tạo thú yếu cạnh người chơi, trả id của nó. Đó là con duy nhất vừa xuất hiện mà có 1 máu: thú hoang luôn sinh ra đầy máu, hook đặt máu 1, id không bao giờ dùng lại. Poll đến khi có đúng một con như vậy.
  - Thay 2 chỗ đang chép tay (test toasts, dòng 1652-1664; test "party: let a pal go...", dòng 932-944), và dùng ở 2 test cần sửa.
- `throwingAt(page, palId, wait)`: trong lúc chờ `wait`, cứ 900 ms ném một quả bóng vào đúng id đó, và chỉ khi con đó còn trong thế giới; `wait` xong (qua hay hỏng) thì dừng.
  - Server nhận một quả mỗi 800 ms (`THROW_COOLDOWN_MS`).
  - Dùng ở test toasts và test thú đi theo.
  - Bọc `wait` thay vì trả hàm dừng, để không chép khối `try/finally` ở mỗi chỗ, và poll bên trong vẫn giữ matcher riêng của nó.
- Hàm kiểm thú hoang quanh người chơi (bước 5) chỉ dùng trong một test nên để cục bộ trong test đó.

**b) Test thú đi theo: một con Emberpup, chỉ ném vào nó.**
- `spawnWeakPal(page, "emberpup")`, rồi `throwingAt` với poll `partyOf(page).species` bằng `["emberpup"]`, timeout 15 s.
- **Đúng một lần bắt:**
  - Chỉ con này bị ném. Bắt được thì server xoá nó khỏi thế giới và thêm vào túi trong cùng một lần xử lý (`GameRoom.ts:923-931`), nên client thấy hai việc trong cùng một bản cập nhật.
  - Từ đó vòng ném không gửi gì nữa. Một tin ném đang trên đường thì trỏ tới id server đã xoá, bị bỏ qua (`GameRoom.ts:893`).
  - Không thú hoang nào khác bị chọc, nên đường 1 hết.
- **Chọn Emberpup:**
  - Loài tự vệ: bóng vỡ thì nó lao vào người ném, luôn trong tầm cho lần ném sau. Đường 2 hết (thú hiền thì chạy khỏi tầm).
  - Nó đứng cách người chơi 40 px về phía **đông** (`GameRoom.ts:404`), còn lửa trại ở phía đông bắc, tại (3200, 2323). Cú cắn đẩy người chơi ra xa con thú, tức về phía tây, xa lửa trại hơn.
  - Cấp ≤ 6 quanh chỗ xuất phát, nên chiêu duy nhất là Tàn lửa, không đẩy lùi (`skills.json`). Pebblet thì có Ném đá, đẩy lùi 12 px từ chỗ đá rơi, khó đoán hướng.
  - Vật cản gần chỗ xuất phát nhất cách 196 px, nên bị đẩy cũng không làm chỗ dựng trại "vướng cây hoặc đá".
- **Số liệu:** tỉ lệ bắt 85,8-88,1% ở 1 máu (cấp 1-6). Mô phỏng T36 (400.000 lượt): không lượt nào hết 15 giây mà chưa bắt được; 12,6% số lượt có ít nhất một quả bóng vỡ (khi đó nó cắn được khoảng một cú trước quả sau).
- **Bỏ hai chỗ chờ cứng:**
  - `await sleep(500)` (dòng 154) mất theo vòng ném cũ;
  - `await page.waitForTimeout(1500)` (dòng 166-167): thay bằng kiểm chữ chính xác `🐾 Thú (1)` (assertion tự chờ).
- Sau khi tải lại, kiểm `pals` bằng đúng 1 thay cho "≥ số đã bắt" (dòng 194). Biến `caught` và hàm `partySize` không còn dùng, xoá.

**c) Test gameplay, bước đánh choáng: đứng đúng chỗ con thú debug.**
- Đòn đánh không nhận id (client không chọn được), nên không "đánh theo id" được.
- Thay vào đó: tạo bằng `spawnWeakPal(page, "pebblet")`, đọc x, y của nó, rồi `debug:teleport` người chơi tới đúng chỗ đó, khoảng cách 0.
  - `nearestPal` luôn chọn nó, vì con khác phải gần hơn 0 px.
  - Con thú không dời chỗ: hook cho đứng yên 60 giây, thú đang choáng không bị đòn đẩy lùi (`GameRoom.ts:868`, điều kiện `!pal.dizzy`), và không gì khác chọc nó.
- **Chỗ đó trống:**
  - Kiểm bằng `worldgen`: trên đường y = 2500 từ x 3150 đến 3624, không vật cản nào chạm thân bán kính 17 (Pebblet; người chơi 14).
  - Chỗ dừng sau khi lướt đo được 3283-3291, tức con thú ở 3323-3331.
  - Vì vậy `debug:teleport` đặt người chơi đúng toạ độ: hàm `resolve` chỉ dời chỗ bị vướng.
- Điều kiện trước: poll đến khi người chơi cách con thú dưới 1 px. Nếu có gì lạ thì test hỏng ngay ở đây, không chập chờn.
- Kiểm theo id thay cho đếm mọi thú đang choáng:
  - con này choáng sau Space thứ nhất;
  - không còn trong thế giới sau Space thứ hai.
  - Giữ kiểm nhãn `.label.pal.dizzy` (1 cái) và kiểm đá tăng: Pebblet hệ đất luôn rơi ≥ 1 đá.
- Bỏ `waitForTimeout(800)` sau khi tạo thú (dòng 571): `spawnWeakPal` đã chờ con thú có trong state, và poll khoảng cách chờ lần dịch chỗ.

**d) Test gameplay, bước chặt cây: chỉ bấm khi không thú hoang nào trong 100 px.**
- Không có cách nhắm vào cây. Trước mỗi lần Space, poll đến khi không thú hoang nào cách người chơi ≤ 100 px, timeout 60 s.
- **Vì sao 100 px:**
  - Thú chưa bị chọc lang thang tối đa 95 px/s (Voltmouse).
  - Từ lúc đọc state tới lúc server xử lý tin đánh: state cũ tối đa 50 ms, cộng đường đi của phím bấm. Đo được: từ lúc gửi `attack` tới lúc nhận kết quả (`hit` hoặc `gathered`) mất 129-239 ms, trung vị 202 ms (151 lần bấm).
  - Trong 0,5 giây (gấp đôi độ trễ đo được), thú lang thang đi tối đa 48 px. Từ ngoài 100 px vào tới 48 px phải đi hơn 52 px, nên không kịp.
  - Mô phỏng bằng chính code lang thang của server (`newBrain`, `stepWander`, quay lại ở bờ biển) trên bản đồ thật, độ trễ 500 ms, 20.000 lượt: 0/60.000 lần bấm có thú lọt vào 48 px trước khi đòn tới.
  - Với 80 px thì có 6/12.000 lần, nên không dùng.
- **Thời gian chờ** (cùng mô phỏng):
  - 17% số lượt phải chờ;
  - tổng thời gian chờ: p90 4 giây, p99 19 giây, lớn nhất 64 giây (ba lần bấm);
  - không lần chờ đơn nào quá 60 giây (quá 45 giây: 2-7 lần trong 60.000).
- Giữ vòng tối đa 8 lần bấm và các kiểm tra: mỗi lần bấm giờ đều chặt, nên vòng dừng sau 3 lần.
- Cây số 278 (gần chỗ xuất phát nhất) giữ nguyên: 29/30 lượt đo (trừ lượt 11 bị chen) đều có đúng 3 lần `gathered` vào cây này, không lần nào trúng thú.

**Đã thử trước** ở scratchpad: viết lại hai test đúng theo các bước 1, 4, 5 dưới đây, chạy 15 lượt mỗi test, 30/30 qua.
- Test gameplay:
  - chờ ở cây 2/15 lượt (7,4 và 11,5 giây);
  - không đòn nào trúng thú ở cây;
  - cả hai đòn sau khi tạo thú đều trúng con thú debug.
- Test thú đi theo: chỉ có tin về con thú debug. Một lượt bóng vỡ, Emberpup cắn một cú và đẩy người chơi về phía tây, tới (3104, 2400); trại vẫn dựng được.

**e) Không chọn:**
- **Thêm hook dọn hoặc đóng băng thú hoang** (`debug:clearPals`...):
  - là đổi server cho tiện test;
  - thú lang thang quay lại, thú mới sinh ngẫu nhiên;
  - không cần, vì rủi ro còn lại ≤ 0,03% (mục cuối).
- **Bấm Space lặp lại đến khi con thú debug bị hạ:** cứ trúng con chen vào; nếu là thú tự vệ thì nó đánh lại, và 6 giây choáng có thể hết.
- **Chờ không còn con khác gần trước mỗi lần Space đánh choáng:** thời gian chờ ăn vào 6 giây choáng. Đứng đúng chỗ con thú thì không phải chờ.
- **Chọn cây khác mỗi lượt (cây vắng nhất):** chỗ chặt của các cây khác chưa kiểm. Đá hay cây bên cạnh đổi thứ mà Space tác động tới, và kiểm `felled` theo id cây.
- **Vẫn ném "con gần nhất" nhưng dừng ngay khi bắt được:** còn ném nhầm trước khi bắt (lượt 25), và thú hiền vẫn chạy khỏi tầm.

### 3. Chữ hiển thị, điện thoại, bàn phím

Không đổi: chỉ sửa test (chạy trên desktop như cũ). Chú thích code bằng tiếng Anh.

## Kế hoạch triển khai

Chỉ sửa `tests/e2e/multiplayer.spec.ts`, cộng một câu trong `docs/architecture.md`.

1. **Helper, chèn sau `sendFrom` (sau dòng 985).** Viết đúng như sau (có thể chỉnh chữ JSDoc):

   ```ts
   /**
    * A weakened wild pal right beside the page's player (test-only hook: 40 px to the right, 1 HP, standing still for 60 s;
    * `species` picks which, else the region decides), and its id: the one pal that is new and at 1 HP (wild pals appear at
    * full health, and ids are never reused).
    */
   async function spawnWeakPal(page: Page, species?: string): Promise<string> {
     const before = await page.evaluate(() => [...(window as any).__petgame.room.state.pals.keys()] as string[]);
     await sendFrom(page, "debug:spawnPal", species ? { species } : {});
     const spawned = () => page.evaluate((known) => {
       const found: string[] = [];
       (window as any).__petgame.room.state.pals.forEach((p: any, id: string) => {
         if (!known.includes(id) && p.hp === 1) found.push(id);
       });
       return found;
     }, before);
     await expect.poll(spawned).toHaveLength(1);
     return (await spawned())[0];
   }

   /**
    * Runs `wait` while a ball goes at that one wild pal every 900 ms (the server takes one per 800 ms), only while it is still
    * in the world, and stops when `wait` ends, passed or failed. Never at "the nearest pal": that can be any wild pal walking
    * by, and one that breaks out of a ball fights back or runs off (docs/design/pals.md, "Tính khí").
    */
   async function throwingAt<T>(page: Page, palId: string, wait: () => Promise<T>): Promise<T> {
     const throwOnce = () => page.evaluate((id) => {
       const { room } = (window as any).__petgame;
       if (room.state.pals.has(id)) room.send("throw", { palId: id });
     }, palId);
     const thrower = setInterval(() => void throwOnce().catch(() => {}), 900);
     try {
       return await wait();
     } finally {
       clearInterval(thrower);
     }
   }
   ```

2. **Test toasts (dòng 1651-1677), chỉ đổi cách viết.**
   - Giữ dòng chú thích 1651.
   - Thay dòng 1652-1677 bằng ba thứ, theo thứ tự:
     - chú thích ở dòng 1654, rút còn: `// An Emberpup comes at us when a ball does not hold, so it stays in throwing range; a timid pal would run out of it.` Phần "never the nearest" đã nằm trong JSDoc của `throwingAt`;
     - `const palId = await spawnWeakPal(page, "emberpup");`;
     - `await throwingAt(page, palId, () => expect.poll(...).toBe(true));`, với nguyên khối poll hai toast hiện có (timeout 15 s).
   - Dòng 1678 trở đi giữ nguyên.
3. **Test "party: let a pal go..." (dòng 931-944).**
   - Giữ chú thích 931.
   - Thay dòng 932-944 bằng `const wildId = await spawnWeakPal(page);`.
   - Dòng 945 trở đi giữ nguyên.
4. **Test thú đi theo (dòng 139-168 và 194).**
   - Dòng 139-158 thay bằng:

     ```ts
     // A weakened Emberpup appears next to us (test-only server hook), and balls go only at it until it is in the party:
     // exactly one catch. It comes at us when a ball does not hold (a timid pal would run out of range), and its bites
     // push us west, away from the campfire that the camp below must keep clear of.
     const palId = await spawnWeakPal(page, "emberpup");
     await throwingAt(page, palId, () =>
       expect.poll(async () => (await partyOf(page)).species, { timeout: 15_000 }).toEqual(["emberpup"]));
     ```
   - Giữ `companions` (dòng 160) và `await expect.poll(companions).toBe(1);` (dòng 165).
   - Xoá `partySize` (dòng 161-164) và hai dòng 166-167 (chú thích, chờ 1500 ms).
   - Dòng 168 thành `await expect(page.locator(".party-btn")).toHaveText("🐾 Thú (1)");`.
   - Dòng 194 thành `await expect.poll(async () => (await me()).pals).toBe(1);`.
   - Phần còn lại giữ nguyên, kể cả chờ 2500 ms ở dòng 190.
5. **Test gameplay.**
   - **Chặt cây (dòng 550-553):** ngay trước vòng lặp thêm chú thích và hàm cục bộ:

     ```ts
     // Space hits the nearest wild pal within reach (48 px) before it chops: press only while none is within 100 px,
     // so a wandering pal (95 px/s at most) cannot step into reach before the press lands.
     const wildPalsNear = (radius: number) => page.evaluate((radius) => {
       const { room } = (window as any).__petgame;
       const p = room.state.players.get(room.sessionId);
       const near: string[] = [];
       room.state.pals.forEach((pal: any, id: string) => {
         if (Math.hypot(pal.x - p.x, pal.y - p.y) <= radius) near.push(id);
       });
       return near;
     }, radius);
     ```
     - Trong vòng, ngay trước `keyboard.press(" ")`: `await expect.poll(() => wildPalsNear(100), { timeout: 60_000 }).toEqual([]);`.
     - Phần còn lại của vòng và dòng 554-555 giữ nguyên.
   - **Đánh choáng (dòng 569-580)** thay bằng:

     ```ts
     // A weakened pal: one hit leaves it dizzy, the next knocks it out for loot. Space hits the nearest wild pal within
     // reach, whichever it is, so we stand right on this one: no other pal can be nearer.
     const palId = await spawnWeakPal(page, "pebblet");
     const pebblet = () => page.evaluate((id) => {
       const { room } = (window as any).__petgame;
       const pal = room.state.pals.get(id);
       const p = room.state.players.get(room.sessionId);
       return pal ? { x: pal.x as number, y: pal.y as number, dizzy: pal.dizzy as boolean, gap: Math.hypot(pal.x - p.x, pal.y - p.y) } : null;
     }, palId);
     const spot = (await pebblet())!;
     await sendFrom(page, "debug:teleport", { x: spot.x, y: spot.y });
     await expect.poll(async () => (await pebblet())?.gap).toBeLessThan(1);
     await page.keyboard.press(" ");
     await expect.poll(async () => (await pebblet())?.dizzy).toBe(true);
     await expect(page.locator(".label.pal.dizzy")).toHaveCount(1);
     const stone = (await me()).stone;
     await page.waitForTimeout(500);
     await page.keyboard.press(" ");
     await expect.poll(pebblet).toBeNull();
     await expect.poll(async () => (await me()).stone).toBeGreaterThan(stone);
     ```
6. **`docs/architecture.md`, dòng "Helper" (dòng 92):**
   - Thêm vào danh sách:
     - `spawnWeakPal` (thú hoang 1 máu cạnh người chơi, trả id: con mới duy nhất có 1 máu);
     - `throwingAt` (trong lúc chờ một điều kiện, cứ 900 ms ném bóng vào đúng một id khi con đó còn trong thế giới).
   - Thêm câu: "**Thú hoang trong e2e:** không đánh hay ném 'con gần nhất'.
     - Bóng: ném theo id (`throwingAt`).
     - Đòn đánh (Space, nút Đánh) không mang id, server đánh con gần nhất trong 48 px. Muốn đánh con thú debug thì đứng đúng chỗ nó (`debug:teleport`). Muốn chặt cây, đập đá thì chỉ bấm khi không thú hoang nào trong 100 px (test `gameplay:`).
     - Luật ở `docs/design/pals.md`, mục 'Tính khí'."

Không tách commit: một commit cho cả nhiệm vụ.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`. Không đụng server, client hay shared, không thêm hook debug.

## Test

Không thêm hay xoá test; sửa luồng 2 test, đổi cách viết 2 test. Tester chạy:
1. `npx playwright test -g "a captured pal follows" --repeat-each=30 --workers=1`: 30/30 qua. Khoảng 25 giây mỗi lượt; chạy nền hoặc chia đợt.
2. `npx playwright test -g "gameplay: chop a tree" --repeat-each=30 --workers=1`: 30/30 qua.
   - Ghi thời gian mỗi lượt, khoảng 14 giây; lượt phải chờ ở cây lâu hơn.
   - Ghi số lượt có chờ ở cây nếu dễ lấy.
3. Hai test chỉ đổi cách viết:
   - `-g "the catch and the quest it finishes" --repeat-each=10 --workers=1`: 10/10;
   - `-g "party: let a pal go" --repeat-each=3 --workers=1`: 3/3.
4. `npm run test:e2e`: 31/31.
5. `npm run typecheck` và `npm test` qua (code sản phẩm không đổi, chạy cho chắc).

Gợi ý tự kiểm cho tester (không bắt buộc), trong một bản chép ở scratchpad: gửi `debug:spawnPal` với `{ full: true }` ngay trước bước chặt cây, để có một thú hoang đứng yên cạnh chỗ chặt.
- Kết quả mong đợi: không lần Space nào trúng con đó (không có tin `hit`). Test hỏng ở poll 60 s, vì con tạo bằng hook đứng yên 60 giây.
- Bản test cũ thì đánh con đó ngay lần bấm đầu.

## Tiêu chí hoàn thành

- [ ] Phần coder sửa chỉ có `tests/e2e/multiplayer.spec.ts` và `docs/architecture.md`. Không tính file làm việc của đội và phần game-designer đã sửa (`docs/design/pals.md`). Không file nào trong `packages/` đổi.
- [ ] Có `spawnWeakPal` và `throwingAt` như bước 1, dùng ở:
  - test toasts;
  - test thú đi theo;
  - test "party: let a pal go..." (chỉ `spawnWeakPal`);
  - test gameplay (chỉ `spawnWeakPal`).

  Không còn đoạn tìm id mới chép tay ở 2 chỗ cũ.
- [ ] Trong file không còn vòng nào ném vào "con gần nhất":
  - không còn `nearest`/`best` trong test thú đi theo;
  - không còn `throwAtSpawned` riêng của test toasts.
- [ ] Test thú đi theo:
  - tạo `emberpup`, chỉ ném qua `throwingAt`;
  - poll túi bằng `["emberpup"]` (15 s);
  - kiểm `🐾 Thú (1)`, sau khi tải lại `pals` bằng 1;
  - không còn `sleep(500)`, `waitForTimeout(1500)`, `caught`, `partySize`;
  - vẫn chờ 2500 ms trước khi tải lại.
- [ ] Test gameplay, chặt cây: trước mỗi lần Space có poll "không thú hoang nào trong 100 px" (timeout 60 s); vẫn tối đa 8 lần bấm, kiểm `wood >= 3` và `felled`.
- [ ] Test gameplay, đánh choáng:
  - người chơi dịch tới đúng chỗ con thú debug, poll khoảng cách < 1 px;
  - kiểm theo id: choáng, rồi không còn;
  - giữ kiểm nhãn `.label.pal.dizzy` (1) và đá tăng;
  - không còn `dizzyPals`;
  - không còn chờ 800 ms sau khi tạo thú;
  - còn chờ 500 ms giữa hai lần Space.
- [ ] Giữ nguyên tên test, `test.slow()`, bước lướt, các kiểm tra khác; không retry.
- [ ] `docs/architecture.md`: dòng "Helper" có hai helper mới và câu về thú hoang trong e2e.
- [ ] Mỗi test sửa chạy lặp 30/30 qua; hai test đổi cách viết 10/10 và 3/3; cả bộ 31/31; typecheck và unit test qua.

## Rủi ro, câu hỏi mở

- **Rủi ro còn lại, không xử lý:**
  - **Thú hung dữ (Scorchtail từ sa mạc) lại gần chỗ chặt cây trong lúc test.** Mô phỏng: 5/20.000 lượt có một con trong 150 px. Khi đó nó tấn công, và poll 100 px có thể hết giờ. Test hiện tại cũng chịu rủi ro này. Chặn hẳn phải đổi server, không đáng.
  - **Một lần chờ ở cây quá 60 giây:** 0 trong 60.000 lần bấm mô phỏng.
  - **Test thú đi theo:** 12,6% số lượt bị Emberpup cắn (khoảng một cú mỗi quả bóng vỡ). Cú cắn đều đẩy người chơi về phía tây, ra xa lửa trại.
  - **Chỗ dựng trại chỉ dư 14,9 px so với giới hạn 96 px.** Nếu sau này đổi chỗ xuất phát, lửa trại hay `BASE_MIN_CAMPFIRE_DISTANCE`, test sẽ hỏng luôn (không chập chờn) và phải dời chỗ dựng trại.
  - **Bước chặt cây dựa vào tốc độ lang thang tối đa 95 px/s.** Thêm loài nhanh hơn, hay T27/T9 đổi tốc độ lang thang, thì tính lại 100 px.
- **Thời gian chạy:** test gameplay chờ ở cây trong khoảng 17% số lượt (p90 4 giây, p99 19 giây). Test thú đi theo nhanh hơn một chút: bỏ 2 giây chờ cứng.
- Không có quyết định nào cần người dùng; không có dòng chặn.
- **Đề xuất việc mới cho `TASKS.md`:** không có. Các test khác dùng Space hay bóng đã được rà:
  - "explorer" bắn cung, nhận sát thương của bất kỳ con nào trúng;
  - "labels" tự tính con đang nhắm;
  - "party" chỉ kiểm có gửi tin ném;
  - "skills" kiểm có chiêu tung ra, không phụ thuộc trúng con nào.

  Không test nào hỏng được vì "con gần nhất".
