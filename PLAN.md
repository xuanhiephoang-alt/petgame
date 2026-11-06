# PLAN: T36 Test e2e toasts chạy tất định (chỉ ném vào con thú debug)

## Mục tiêu

- **Vấn đề:** đội chấm PASS dựa vào e2e, nhưng test "toasts: the catch and the quest it finishes show together; small notices do not push out a level-up" (`tests/e2e/multiplayer.spec.ts:1442-1492`) còn hỏng oan.
  - Khoảng 1-2% do ném nhầm (REVIEW T34).
  - Thêm khoảng 0,3% do một đường thứ ba, tìm ra khi lập kế hoạch này.

  Mỗi lần hỏng oan tốn một vòng sửa lỗi.
- **Sau nhiệm vụ:** luồng test không còn phụ thuộc thú hoang ngẫu nhiên quanh chỗ đứng. Ý định và mọi kiểm tra giữ nguyên.
- Người chơi không thấy gì khác.

## Phạm vi

Làm: chỉ sửa test này trong `tests/e2e/multiplayer.spec.ts`, khoảng dòng 1448-1479. Số dòng tính theo HEAD `428ddf2`.

KHÔNG làm:
- **Không đổi code sản phẩm** (`packages/*`) và không thêm hook debug. Hai thứ cần đã có sẵn: tin `throw` nhận `palId`, `debug:spawnPal` nhận `species`.
- **Không sửa test khác.** Test "a captured pal follows the player..." (dòng 139-158) cũng ném "con gần nhất", nhưng để thành việc riêng (xem cuối file).
- **Không đổi các thông số và kiểm tra hiện có:**
  - nhịp ném 900 ms;
  - timeout 15 s, 20 s, 20 s;
  - tên test, `test.slow()`;
  - các kiểm tra ở dòng 1480-1491.

  Không thêm retry.
- **Không tách helper:** mới có một chỗ dùng. Viết inline theo mẫu "id mới sau khi spawn" ở dòng 748-760.

## Thiết kế

### 1. Luồng hiện tại

| Dòng | Việc |
|---|---|
| 1449 | `debug:spawnPal` không chọn loài. Server tạo thú ở (x+40, y) của người chơi (chỗ xuất hiện (3120,2400)), loài theo vùng: đồng cỏ có leafkit 5, emberpup 4, bubbloon 4, pebblet 3, voltmouse 2 phần. Thú có máu 1 và đứng yên 60 s (`GameRoom.ts:392-405`). |
| 1450-1460 | Cứ 900 ms ném vào con **gần nhất** trong `room.state.pals`, không xét id hay tầm. |
| 1461-1468 | Chờ tối đa 15 s đến khi "Bắt được" và "Xong nhiệm vụ" cùng hiện, rồi mới dừng vòng ném. |
| 1471 | Chờ hết toast (20 s). |
| 1472-1474 | Chú thích, rồi `debug:teleport` tới (3150,2500), cách chỗ xuất hiện 104 px. |
| 1475-1479 | Chờ máu đầy (20 s). |
| 1480-1491 | `debug:givePal` emberpup cấp 6, rồi `debug:xp` 450 (lên cấp, học Phun lửa). Bấm `r`, `3`, `h`; `h` phải ra "Máu đang đầy". |

Vì sao cú cắn nào cũng nguy hiểm cho test:
- Lần bắt đầu tiên thưởng 5 quả mọng (`quests.ts:20`).
- Khi máu chưa đầy, `eat()` ăn im lặng, không có thông báo (`GameRoom.ts:1118-1126`).

Nên một cú cắn mà máu chưa hồi kịp trước lúc bấm `h` là test hỏng.

### 2. Ba đường hỏng

1. **Ném nhầm sau khi bắt** (REVIEW T34, khoảng 1-2%).
   - Bắt được thì con thú debug bị xoá khỏi state ngay (`GameRoom.ts:920`). Nhưng toast "Bắt được" chỉ hiện sau 1,9 s (`captureRevealMs(3)`), toast nhiệm vụ sau 2,1 s (`QUEST_DELAY_MS`, `Game.ts:140`).
   - Trong khoảng đó vòng ném còn chạy 2-3 lần, nhắm vào con gần nhất kế tiếp. Server nhận nếu nó cách tối đa 180 px (`THROW_RANGE`, `GameRoom.ts:893`).
   - Con đó đầy máu nên bóng thường trượt. Khi nó thoát bóng, `breakOut` (1168-1172) gọi `provoke` (1640-1650) nhắm vào người ném.
   - Emberpup và Pebblet (tính khí tự vệ, 7/18 số thú đồng cỏ) đuổi đánh trong 8 s (`WILD_AGGRO_MS`).
2. **Ném nhầm trước khi bắt** (hiếm hơn).
   - Một con thú hoang lang thang tới gần hơn 40 px thì nó thành "con gần nhất" và bị ném thay. Hậu quả như đường 1.
   - Nếu bắt được nó thì có thêm một lần bắt, có thể kéo theo tin lên cấp ngoài dự kiến.
3. **Con thú debug loài hiền chạy khỏi tầm** (mới tìm ra, khoảng 0,3%).
   - 11/18 số lần, con thú debug là loài hiền. Bóng trượt thì nó chạy trốn 2,5 s (`FLEE_MS`) với tốc độ ×1,8 (`GameRoom.ts:672-681`).
   - Thường thì lần ném sau vẫn bắt kịp, vì nó mới chạy được 0,3-0,7 s.
   - Nhưng có hai trường hợp nó thoát:
     - trượt hai lần liền;
     - là Voltmouse, trượt một lần và lần ném sau đến muộn.

     Khi đó nó dừng ngoài 180 px và đứng yên gần hết 60 s. Mọi lần ném sau bị từ chối, poll 15 s hỏng.
   - Mô phỏng 400.000 lượt bằng `captureChance` thật, nhịp 900 ms, lệch 0-300 ms: 0,28-0,49% số lượt.
   - Vòng ném "con gần nhất" đôi khi che lỗi này, vì nó bắt nhầm một con khác thay vào.

**Dịch 104 px không cắt đuôi được.** Khi còn trong thời gian bị chọc, `wildTarget` trả vị trí mục tiêu mà không xét khoảng cách (`GameRoom.ts:1653-1658`). Chỉ thú đầu đàn có dây giới hạn (657-670).
- Emberpup đuổi 126 px/s, Pebblet 54 px/s, nên bắt kịp trong 1-2 s.
- Bước dịch chỉ làm trượt cú cắn đang vung, vì người chơi ra ngoài `WILD_BITE_REACH` 50 px.

Vì vậy chú thích ở dòng 1473 sai.

### 3. Cách làm tất định (đã chọn)

**a) Chỉ ném vào id của con thú debug.**
- Lưu danh sách id trước khi spawn. Con thú debug là con có id mới và máu đúng 1:
  - thú hoang luôn xuất hiện đầy máu (`GameRoom.ts:2128`);
  - hook đặt máu 1 (dòng 403).
- Poll đến khi có đúng một con như vậy.
- Ném vào id đó, và chỉ ném khi id còn trong state. Bắt xong thì không gửi gì nữa.
- Nếu một tin ném vẫn đến server sau đó: server bỏ qua id không còn (`GameRoom.ts:890`), và id không bao giờ dùng lại (`pal${nextPalId++}`).

Đóng đường 1 và 2: không con thú hoang nào khác bị chọc.

**b) Ghim loài Emberpup:** `debug:spawnPal { species: "emberpup" }`.
- **Đóng đường 3.** Loài tự vệ không chạy trốn: bóng trượt thì nó lao vào người ném, nên luôn trong tầm cho lần ném sau. Chỉ làm (a) thì đường 3 vẫn còn, vì ném theo id vào một con đã ra ngoài tầm thì luôn bị từ chối.
- Mô phỏng 400.000 lượt: không lượt nào không bắt được.
- **Chọn Emberpup thay Pebblet:**
  - dễ bắt hơn: 86-88% ở máu 1, Pebblet 85-86%;
  - test khác đã dùng (dòng 444).
- **Cái giá:** 12,6% số lượt có ít nhất một lần bóng trượt; khi đó nó cắn được vài cú trước khi bị bắt. Vòng chờ máu đầy giữ nguyên, đủ bù (mục d).

**c) Bỏ bước dịch tới (3150,2500) và câu chú thích sai.**
- Sau (a) và (b), không còn gì đuổi theo người chơi sau khi bắt:
  - con thú debug đã bị xoá;
  - không con nào khác bị chọc;
  - đồng cỏ ban ngày không có loài hung dữ. Phòng bắt đầu lúc `DAY_START` 0,12, đêm đến sau 4,8 phút, còn test chạy dưới 1 phút.
- Bước dịch chưa từng làm được điều chú thích nói.
- Đứng yên ở chỗ xuất hiện không gây toast lạ:
  - rương gần nhất cách 271 px, mà rương chỉ mở khi cách dưới 36 px; cú cắn chỉ đẩy lùi 16 px;
  - hang thú đầu đàn cách 784 px, cảnh báo chỉ hiện khi cách dưới 320 px;
  - không đổi vùng, nên không có toast "Đến ...".

**d) Ngân sách máu.**
- **Mỗi lần bóng trượt** (con thú cấp 1-6), trước khi bóng sau bắt được:
  - tối đa một cú cắn, tối đa 10 máu;
  - Tàn lửa, tối đa 13 máu, cùng lắm một lần mỗi 6,5 s.
- **Ba lần trượt liền** (xác suất 0,2%):
  - mất tối đa khoảng 43 máu;
  - máu hồi từ 5 s sau cú cuối, 4 máu/giây, nên đầy lại sau khoảng 16 s.
- **Khoảng chờ có sẵn.** Hai toast hiện ở +1,9 s và +2,1 s rồi tắt sau khoảng 4 s, nên vòng chờ máu bắt đầu khoảng 6 s sau khi bắt. Nó chờ 20 s, tức chịu được tới khoảng 80 máu: 5-6 lần trượt liền, xác suất dưới 1/30.000.
- **Poll 15 s của phần bắt:** có ít nhất 7 lần ném được nhận, nên xác suất không bắt được khoảng 0,13^7, dưới một phần triệu.

**e) Thêm một kiểm tra rẻ.** Ngay sau poll hai toast, kiểm `(await partyOf(page)).species` bằng `["emberpup"]`.
- Kiểm tra này nói rõ: lần bắt duy nhất là con thú debug.
- Sau khi sửa, nó luôn đúng. Nếu ai đổi lại thành ném "con gần nhất", nó sẽ lộ lỗi.

**Không chọn:**
- **Dọn thú hoang quanh chỗ test:** chưa có hook. Thêm `debug:clearPals` là đổi server cho tiện test, mà thú vẫn lang thang tới.
- **Chọn chỗ không có thú:** thú rải ngẫu nhiên rồi đi lang thang, không chỗ nào chắc chắn trống.
- **Dừng vòng ném ngay khi con thú debug biến mất:** chỉ thu hẹp đường 1, không đóng đường 2 và 3.
- **Loài hiền kèm dịch tới sát nó trước mỗi lần ném:** phức tạp hơn, và có thể dịch trúng rương. Toast "Rương báu!" có mức cao, sẽ chen vào hai toast đang kiểm.

## Kế hoạch triển khai

Chỉ sửa `tests/e2e/multiplayer.spec.ts`, trong test ở dòng 1442. Chú thích viết tiếng Anh, ngắn.

1. **Dòng 1448-1449: spawn và lấy id.**
   - Giữ chú thích ở dòng 1448.
   - Lưu `before`: các id trong `room.state.pals`, giống dòng 748.
   - Gọi `await sendFrom(page, "debug:spawnPal", { species: "emberpup" });`.
   - Viết hàm `spawned`: một `page.evaluate` nhận `before`, trả mảng các id không có trong `before` và có `p.hp === 1`.
   - `await expect.poll(spawned).toHaveLength(1);` rồi `const [palId] = await spawned();`.
   - Chú thích gợi ý: `// Balls go only at the pal the hook made (a new id, the only pal at 1 HP), never at "the nearest": once this one is caught that is some wild pal, and one that breaks out fights back for 8 s however far we go. An Emberpup comes at us when a ball does not hold, so it stays in throwing range; a timid pal would run out of it.`
2. **Dòng 1450-1460: vòng ném.**
   - Đổi `throwAtNearest` thành `throwAtSpawned`:

     ```ts
     page.evaluate((id) => {
       const { room } = (window as any).__petgame;
       if (room.state.pals.has(id)) room.send("throw", { palId: id });
     }, palId)
     ```
   - `setInterval(..., 900)` và khối `try/finally` (1461-1468) giữ nguyên.
3. **Ngay sau `finally` (sau dòng 1468), thêm:**
   - chú thích `// The one catch is the pal the hook made: nothing else was thrown at.`;
   - `expect((await partyOf(page)).species).toEqual(["emberpup"]);`.
4. **Dòng 1472-1474:**
   - Xoá dòng 1474 (`debug:teleport`) và câu chú thích sai ở dòng 1473.
   - Thay dòng 1472 bằng: `// "h" only refuses ("Máu đang đầy") at full health; eating while hurt is silent. Only the spawned Emberpup can have bitten (when a ball did not hold), and it is caught: health comes back 5 s after its last bite, 4 a second.`
   - Giữ nguyên poll máu (1475-1479).
5. Giữ nguyên từng chữ phần còn lại: dòng 1470-1471 và 1480-1491.

## Giao thức

Không đổi: `schema.ts`, `messages.ts`, `Profile` giữ nguyên. Không đụng server hay client, không thêm hook debug.

## Test

Không thêm hay xoá test, chỉ sửa luồng của một test e2e. Tester kiểm:
1. `npx playwright test -g "the catch and the quest it finishes" --repeat-each=30 --workers=1`: 30/30 qua.
   - Lệnh mất khoảng 15-20 phút: chạy nền, hoặc chia 3 đợt 10.
   - Ghi thời gian mỗi lượt.
2. `npm run test:e2e`: cả bộ 28/28 qua.
3. `npm run typecheck` và `npm test` qua (code không đổi, chạy cho chắc).

## Tiêu chí hoàn thành

- [ ] `git diff --stat` (trừ `PROGRESS.md`) chỉ có `tests/e2e/multiplayer.spec.ts`; không file nào trong `packages/` đổi.
- [ ] Test gọi `debug:spawnPal` với `{ species: "emberpup" }`. Id lấy theo "id mới và `hp === 1`", poll đến khi đúng một con.
- [ ] Vòng ném chỉ gửi `throw` với id đó, và chỉ khi id còn trong state. Test này không còn `throwAtNearest` hay đoạn tìm "con gần nhất"; vòng ném ở dòng 139-158 của test khác giữ nguyên.
- [ ] Có kiểm `(await partyOf(page)).species` bằng `["emberpup"]` ngay sau poll hai toast.
- [ ] Test này không còn `debug:teleport` tới (3150,2500). Chú thích trước poll máu đúng như bước 4; không còn câu nào nói dịch đi thì máu hồi.
- [ ] Giữ nguyên:
  - nhịp 900 ms;
  - các timeout 15 s, 20 s, 20 s;
  - tên test và `test.slow()`;
  - các kiểm tra ở dòng 1480-1491.
- [ ] Chạy lặp 30/30 qua; cả bộ e2e qua; typecheck và unit test qua.

## Rủi ro, câu hỏi mở

- **Rủi ro còn lại, không xử lý:** thú hung dữ từ sa mạc (cách 663 px) hoặc núi lửa (cách 877 px) lang thang tới trong tầm 120 px của người chơi.
  - Thời gian để đi tới là dưới 1 phút đời phòng, nên xác suất dưới 0,1%.
  - Muốn chặn hẳn phải thêm hook server; không đáng.
- **12,6% số lượt chạy lâu hơn:** sau khi bóng trượt, test chờ máu đầy tối đa khoảng 16 s. Vẫn trong timeout sẵn có.
- Không có quyết định nào cần người dùng; không có dòng chặn.
- **Đề xuất việc mới cho `TASKS.md` (P3, nhỏ):**
  - Test "a captured pal follows the player and shows in the party panel" (`multiplayer.spec.ts:139-158`) ném "con gần nhất" vào thú debug không ghim loài. Nó dính đường 3: khoảng 0,3%, con hiền thoát bóng chạy khỏi tầm thì không bắt được.
  - Sửa cùng cách: nhắm theo id, ghim loài Emberpup. Khi đó có hai chỗ dùng, nên tách helper (ví dụ `spawnWeakPal(page, species)` trả id, đặt cạnh `sendFrom`), dùng chung với dòng 748-760.
  - Kèm theo, ghi rõ trong mục "Tính khí" của `docs/design/pals.md`:
    - bóng không giữ được cũng tính là bị đánh;
    - thú tự vệ đuổi theo bất kể xa bao nhiêu;
    - thú hiền chạy trốn 2,5 s.
