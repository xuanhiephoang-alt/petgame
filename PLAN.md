# PLAN: T17 Hai unit test chập chờn (trùm về nhà, thú đêm) và một test cùng kiểu

## Mục tiêu

- `npm test` hỏng oan khoảng 11-12% số lần (đo ở T2): `walks the boss back home when it strays` hỏng khoảng 7,5%, `day and night > syncs the time of day and spawns night pals at night` khoảng 4-5,5%. Đội agent chấm PASS/FAIL bằng test, nên mỗi lần hỏng oan tốn một vòng sửa lỗi hoặc che mất lỗi thật.
- Sau nhiệm vụ: các test này **tất định** (cùng code thì luôn cùng kết quả), **không nới lỏng**, và mỗi test **bắt được đúng lỗi nó nhắm tới** (đã thử bằng đột biến, xem từng mục).
- Người chơi không thấy gì khác: chỉ sửa file test, không đổi hành vi game.

## Phạm vi

Làm (chỉ trong `packages/server/src/rooms/GameRoom.test.ts`):
1. `regions and climate > walks the boss back home when it strays` (dòng 1004-1013).
2. `day and night > syncs the time of day and spawns night pals at night` (dòng 490-508).
3. `elements and skills > wild pals cast too: their skill lands where the target stood, so stepping away dodges it` (dòng 632-650). Cùng kiểu: đợi một lượt bốc 6% trong vòng lặp có giới hạn. Đo được 1/150 lần hỏng. Sửa luôn vì rẻ (2 dòng), và vì nếu để nguyên thì tiêu chí "20 lần `npm test` liền không hỏng" tự nó có khoảng 4-13% khả năng trượt.

KHÔNG làm:
- Không sửa code sản phẩm (`GameRoom.ts`, `ai/wander.ts`, `worldgen.ts`, `data/*.json`, hằng số). Không cần điểm tiêm: file test đã có lệ `vi.spyOn(Math, "random")` (helper `capture()`), còn test trùm không cần điều khiển ngẫu nhiên.
- Không đổi ngưỡng hay thời gian chờ: 600 px, 40 tick, 160 tick, 30 tick và 10 tick giữ nguyên. Không retry (không `retry` của Vitest, không vòng chạy lại). Không tăng timeout, không đổi tên, không `skip`, không `vi.mock` module.
- Không sửa test khác (đã rà, xem mục "Rà các test khác"). Không sửa cách trùm lang thang (ghi thành đề xuất T21 ở cuối).

## Thiết kế

Không có chữ hiển thị hay thao tác mới (không áp dụng điện thoại, bàn phím). Các con số dưới đây đo trên bản sao tạm của HEAD `2d81602` trong scratchpad, ngoài repo.

### 1. Trùm về nhà

**Nguyên nhân (xác nhận bằng code và số đo):**
- `spawnBoss` (`GameRoom.ts:1452-1473`): chỗ mặc định ở chân núi lửa luôn bị chặn với `BOSS.radius`, nên vòng `GameRoom.ts:1460-1463` luôn bốc một điểm ngẫu nhiên quanh núi lửa, và `bossHome` là điểm đó (`:1471`). Chạy lại đúng vòng này 200.000 lần: chỗ mặc định được dùng 0 lần. Điểm `x - 600` rơi vào vật cản ở 33,9% số lần (với bán kính 20 mà trùm dùng khi lang thang), rơi xuống biển 0%.
- Test dịch trùm đi `boss.x -= 600` (test:1008). Ở tick đầu, dây xích (`GameRoom.ts:618`) đặt `brain.target = bossHome`. Sau đó `stepWander` (`:624`, `wander.ts:65-75`) gọi `grid.resolve`, hàm này đẩy thân trùm ra khỏi vật cản theo pháp tuyến (`collision.ts:53-71`). Hướng đẩy có thể là về phía tây, tức xa nhà hơn. Khi tiến được dưới 30% một bước, trùm đứng chờ 300-1000 ms (`wander.ts:71-75`). Trong 40 tick (2 giây, tối đa khoảng 90 px ở 45 px/s) có lúc trùm không bù lại được, ra lỗi `expected 610.28 to be less than 600`. Tester đo được 9/120 phòng hỏng (7,5%), cả 9 phòng đều có điểm dịch bị chặn.
- **Phát hiện thêm: test cũ gần như không kiểm được dây xích.** Lúc sinh, não của trùm (`newBrain(pos)`, `GameRoom.ts:1997`, `wander.ts:27`) nhắm vào một điểm cách nhà tối đa ±150 px mỗi trục. Vì vậy dù bỏ hẳn dòng `:618`, trùm vẫn đi về phía nhà. Đo thử: bỏ `:618` thì test cũ vẫn qua 53/60 phòng.

**Cách làm tất định (chỉ sửa test):**
- Thêm helper `bossWalk()` trong `describe("regions and climate")`, cạnh `westShore()`. Helper tìm từ `defaultWorld()` (cố định theo `WORLD_SEED`) một đường thẳng trống gồm `home`, `stray` cách `home` 600 px, và `away` đi tiếp thêm 150 px cùng hướng.
  - "Trống" nghĩa là: mọi điểm lấy mẫu cách nhau 8 px trên đoạn `home` → `away` đều không bị chặn với bán kính `BOSS.radius` (40) và không phải biển (`isSea`). Bán kính 40 gấp đôi bán kính 20 mà trùm dùng khi lang thang. Nếu sau này đổi sang 40 (xem T21), tuyến vẫn đúng.
  - Thứ tự tìm cố định: các vòng tròn bán kính `volcano.r + ring * 32` với `ring` từ 3 đến 13 (cùng dải mà `spawnBoss` dùng), góc đặt nhà từ 0 đến 355 độ bước 5, hướng đi từ 0 đến 355 độ bước 5. Lấy kết quả đầu tiên tìm được. Không tìm được thì `throw new Error(...)` kèm lý do, không bao giờ trả về một tuyến xấu.
  - Kết quả hiện tại: `home` khoảng (5059, 2436), `stray` khoảng (4805, 1892), `away` khoảng (4742, 1756) (ring 3, góc 10 độ, hướng 245 độ). Ở bước 5 độ có 154 cặp nhà/hướng hợp lệ, nên vẫn còn tuyến nếu thế giới thay đổi chút ít.
  - Mọi tuyến hợp lệ đều cách chỗ người chơi xuất hiện (3120, 2400) ít nhất 503 px, xa hơn nhiều so với `AGGRESSIVE_SIGHT` 120, nên trùm không nhìn thấy người chơi. Không cần né hang thú đầu đàn: thú hoang không va chạm và không đánh nhau với nhau.
- Thân test:
  1. `setup()`, lấy trùm bằng `bossOf`.
  2. Gán `(room as any).bossHome = { ...home }`. Test khác vẫn ghi đè trường riêng như vậy (`brains`, `controls`).
  3. Đặt trùm ở `stray`.
  4. Gán `brain.target = { ...away }`: để mặc nó, trùm sẽ đi xa thêm. Chính dòng này làm test bắt được lỗi mất dây xích.
  5. `brain.idleMs = 0` (giữ như cũ).
  6. `before = distance(boss, home)` (bằng 600).
  7. Chờ 40 tick, rồi `expect(distance(boss, home)).toBeLessThan(before)` (giữ nguyên).
- **Vì sao tất định:** đường trống nên mỗi tick `stepWander` tiến đúng một bước. Nó không vào nhánh bị chặn và không gọi `random`. Người chơi ở xa, và thú hoang không đẩy nhau. Đo được 0/120 phòng hỏng; sau 40 tick trùm cách nhà khoảng 508,7 px.
- **Vẫn bắt được lỗi thật:** bỏ dòng `:618` (đột biến M-B1) thì hỏng 40/40 phòng, trùm cách nhà khoảng 690,5 px.
- Phương án đã bỏ:
  - (a) Giữ nhà ngẫu nhiên của phòng rồi tìm hướng trống: 86% số nhà không có đường thẳng 750 px trống ở cả 24 hướng (bán kính 40), nên không tất định.
  - (b) Thay `obstacles` bằng lưới rỗng: làm thay đổi thế giới mà phòng mô phỏng.
  - (c) Giả `Math.random` lúc tạo phòng: số lần gọi random trước khi thân test chạy phụ thuộc số tick đã qua, lại kéo theo cả 80 thú khác.

### 2. Thú đêm

**Nguyên nhân:**
- Test ép gọi `spawnPal()` 30 lần (test:499) rồi đòi có ít nhất một Mothlume (test:501). `spawnPal` (`GameRoom.ts:1976-1999`) bốc chỗ ngẫu nhiên, rồi bốc loài bằng `pickSpecies(Math.random(), { biome, night: isNight(this.dayTime) })` (`:1982`). Mothlume (trọng số 2, loài đêm duy nhất) ra với xác suất 10,31% mỗi lần, nên 30 lần không ra con nào có xác suất 3,83%. Tester đo được 11/200 phòng hỏng (5,5%).
- Thêm vài điểm yếu:
  - Biến `night` (thú đêm tự sinh trong 30 tick, test:497) luôn rỗng, vì thú chỉ tự sinh mỗi `PAL_RESPAWN_MS` = 5000 ms, lâu hơn 1,5 giây chờ.
  - Phép kiểm `state.dayTime > 0` (test:493) luôn đúng vì `onCreate` đã gán `DAY_START`. Phần "syncs the time of day" trong tên test chưa từng được kiểm thật.
  - Phần bình minh (test:503-506) chỉ có ý nghĩa khi đã có Mothlume, tức khoảng 96% số lần.

**Cách làm tất định:** giữ đường chọn loài thật (`spawnPal` gọi `pickSpecies` với cờ đêm của phòng), chỉ cố định chỗ sinh và lượt bốc.
- Chỗ sinh: `defaultWorld().layout.regions.meadow` (giữa bản đồ, `biomeAt` trả `"meadow"`), truyền vào `spawnPal(at)` để không bốc chỗ ngẫu nhiên.
- Lượt bốc: thêm helper `rollFor(speciesId, where)` trong `describe("day and night")`.
  - Helper thử `roll = (k + 0.5) / 1000` với k từ 0 đến 999, giữ các roll mà `pickSpecies(roll, where)?.id === speciesId`, rồi trả về roll ở giữa danh sách. Không có roll nào thì `throw`.
  - Với dữ liệu hiện tại, bể loài ban đêm ở meadow là leafkit 5, emberpup 4, bubbloon 4, pebblet 3, voltmouse 2, mothlume 2 (tổng 20). Helper trả roll 0,9505. Ban ngày cùng roll đó ra voltmouse, vì Mothlume không có trong bể ban ngày.
- Bọc lời gọi `(room as any).spawnPal({ ...at })` trong `vi.spyOn(Math, "random").mockReturnValue(roll)` và trả lại ngay sau đó (`try/finally`, `vi.restoreAllMocks()`). Toàn bộ phải đồng bộ, không có `await` ở giữa. Mọi lần gọi random trong `spawnPal` (loài, cấp, não) nhận cùng một giá trị, nên kết quả không phụ thuộc thứ tự hay số lần gọi.
- Trình tự (chi tiết ở bước 2 của kế hoạch):
  1. Ban ngày: sinh với roll này thì không ra Mothlume.
  2. Ban đêm (0,8), chờ 30 tick: `state.dayTime` khoảng 0,8.
  3. Sinh với roll này: ra Mothlume.
  4. Bình minh (0,999), chờ 10 tick: con đó bị xoá, và không còn Mothlume nào không giận.
- **Vẫn bắt được lỗi thật:**
  - M-N1 (`spawnPal` luôn truyền `night: false`): hỏng ở bước ban đêm.
  - M-N2 (luôn truyền `night: true`): hỏng ở bước ban ngày.
  - M-N3 (bỏ việc xoá thú đêm lúc bình minh): hỏng ở bước bình minh.
  - M-N4 (bỏ việc đồng bộ `state.dayTime`): hỏng ở bước đồng bộ.
  - Đo được: với code thật 0/120 phòng hỏng; mỗi đột biến hỏng 20/20, đúng ở bước của nó.

### 3. Thú hoang tung chiêu (cùng kiểu, sửa luôn)

- Test đợi tối đa 160 tick (test:642) cho một lần tung chiêu. `wildSkill` chỉ thử tung chiêu với xác suất 6% mỗi tick đang đánh (`GameRoom.ts:1420`), và không thử khi đang gồng cắn hay chờ hồi. Vì vậy có lúc cả 8 giây trôi qua mà không có chiêu nào. Đo được 1/150 phòng hỏng ("no cast").
- Cách sửa:
  - Thêm `vi.spyOn(Math, "random").mockReturnValue(0)` ngay trước vòng đợi, để mọi lượt bốc đều dưới ngưỡng (giống `capture()`).
  - Thêm `vi.restoreAllMocks()` ngay sau vòng đợi, trước các `expect`.
  - Emberpup cấp 8 đứng cách 120 px chỉ có ember (tầm 150) với tới, nên nó tung ember ngay ở tick đánh đầu tiên (đo được: chậm nhất 2 tick). Giữ nguyên giới hạn 160 tick và mọi `expect`.
- **Vẫn bắt được lỗi thật:**
  - M-W1 (chiêu của thú hoang đuổi theo mục tiêu: đổi `homing: !wild` thành `homing: true` ở `:1196` và `:1205`): hỏng 10/10.
  - M-W2 (`wildSkill` luôn trả `undefined`): hỏng 5/5.
  - Với code thật: 0/120.

### Rà các test khác trong `GameRoom.test.ts`

- Đã đo trên 100-150 phòng mới, không lần nào hỏng:
  - "winds up before biting" 0/150. Chiêu 6% có thể ra trước cú cắn, nhưng ember bay khoảng 111 ms (360 px/s), nên người chơi đã bước đi trước khi nó rơi xuống. Đã ép ember ra trước cú cắn 10/10 lần: test vẫn qua cả 10.
  - "misses a dashing player, and bites push the others back" 0/150.
  - "companion attacks the wild pal its owner hit" 0/100.
- An toàn theo code:
  - `capture()` giả random bằng 0.
  - "captured pals keep the wild level..." chấp nhận cả trường hợp lên cấp.
  - "snacks... great balls" không phụ thuộc kết quả bắt.
  - "the boss rears up..." và "stomps everyone nearby": cú dậm không ngẫu nhiên, và `clock.currentTime` là `Date.now()` nên thời gian hồi 6 giây đã qua từ đầu.
  - Cú đấm 10 sát thương (chí mạng 16) không làm choáng thú vừa sinh (máu tối thiểu 35).
  - "makes a pal dizzy... loot": pebblet (hệ đất) chỉ rơi đá.
  - Các test còn lại dùng `placeWild` hoặc vị trí cố định, giả random, hoặc không đợi sự kiện ngẫu nhiên.
- Unit test ở `shared` và `ai/` đều dùng random tiêm vào hoặc `mulberry32` có seed.
- Không còn test chập chờn nào cần đưa vào `TASKS.md`.

## Kế hoạch triển khai

Chỉ sửa `packages/server/src/rooms/GameRoom.test.ts`, một commit. Chú thích và JSDoc viết bằng tiếng Anh, theo giọng văn của file.

1. **Import** từ `@petgame/shared`: thêm `biomeAt`, `pickSpecies`, `type Biome`, `type Vec2`. `BOSS`, `isSea`, `defaultWorld`, `distance`, `getSpecies` đã có sẵn. File này nằm trong typecheck (`noUnusedLocals`), nên không import thừa.
2. **`describe("day and night")`:**
   - Thêm hàm cục bộ `rollFor(speciesId: string, where: { biome: Biome; night: boolean }): number` như mục Thiết kế 2. JSDoc nói hàm trả về roll ở giữa khoảng mà `pickSpecies` biến thành loài đó, và throw nếu không có.
   - Viết lại thân test theo thứ tự sau, giữ tên test:
     1. `const { room } = await setup();` rồi `expect(room.state.dayTime).toBeGreaterThan(0)` (giữ).
     2. `room.state.pals.clear()` (giữ, chuyển lên đây).
     3. `const { layout } = defaultWorld(); const at = layout.regions.meadow; const roll = rollFor("mothlume", { biome: biomeAt(layout, at.x, at.y), night: true });`
     4. Hàm cục bộ `spawnWith(roll)`: mock `Math.random` bằng roll, gọi `(room as any).spawnPal({ ...at })`, rồi `vi.restoreAllMocks()` trong `finally`; trả về id.
     5. Ban ngày (phòng bắt đầu ở `DAY_START`): `expect(room.state.pals.get(spawnWith(roll))!.speciesId).not.toBe("mothlume")`. Chú thích: cùng lượt bốc nhưng ban ngày ra thú ngày, vì Mothlume chỉ ra ban đêm.
     6. `(room as any).dayTime = 0.8; await ticks(room, 30);` (giữ) rồi `expect(room.state.dayTime).toBeCloseTo(0.8, 1)` (mới: bản sao trong state được đồng bộ mỗi giây, `GameRoom.ts:1677-1680`; sai số cho phép 0,05, tức khoảng 24 giây giờ game).
     7. `const moth = spawnWith(roll); expect(room.state.pals.get(moth)!.speciesId).toBe("mothlume");`
     8. Bình minh: `(room as any).dayTime = 0.999; await ticks(room, 10);` (giữ). Kiểm `expect(room.state.pals.has(moth)).toBe(false)` (mới, kiểm thẳng) và giữ nguyên `expect([...].some((p) => p.speciesId === "mothlume" && !p.angry)).toBe(false)`.
   - Bỏ: biến `night` (luôn rỗng), vòng 30 lần `spawnPal()` và phép kiểm `> 0`. Lý do: thay bằng phép kiểm chặt hơn, theo một lần sinh cụ thể.
3. **`describe("regions and climate")`:**
   - Thêm hàm cục bộ `bossWalk(): { home: Vec2; stray: Vec2; away: Vec2 }` cạnh `westShore()`, như mục Thiết kế 1. Dùng hằng cục bộ `STRAY = 600` (khoảng cách cũ) và `PAST = 150` (lớn hơn quãng 90 px trùm đi được trong 40 tick, còn dư vì tick thật có thể dài hơn 50 ms).
   - JSDoc nói hàm làm gì: một đường đi thẳng không vướng cây, đá, hồ, núi lửa hay biển, kể cả với cả thân trùm, tìm từ thế giới cố định; throw nếu thế giới không có đường như vậy.
   - Viết lại thân test `walks the boss back home when it strays` theo các bước ở mục Thiết kế 1. Thay chú thích cũ "west, toward the meadow" bằng chú thích nói ý: để mặc thì trùm đi xa thêm về `away`, dây xích phải kéo nó về.
4. **`describe("elements and skills")` > "wild pals cast too...":**
   - Ngay trước dòng `for (let i = 0; i < 160 && casts.length === 0; i++) ...`, thêm `vi.spyOn(Math, "random").mockReturnValue(0);` kèm chú thích: thú hoang chỉ thử tung chiêu ở khoảng 6% số tick đang đánh (`wildSkill`), mọi lượt bốc dưới ngưỡng thì nó tung ngay ở tick đánh đầu tiên.
   - Ngay sau vòng lặp thêm `vi.restoreAllMocks();`. Không sửa gì khác trong test này.
5. Chạy `npm run typecheck` và các lệnh ở mục Test; ghi `PROGRESS.md` (số lần chạy, số phòng, kết quả đột biến).

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, `store.ts`. Không ảnh hưởng client, e2e hay dữ liệu đã lưu.

## Test

- Không thêm test mới. Sửa 3 test tích hợp nói trên. Không sửa unit test ở `shared`, không sửa e2e.
- Lệnh cho tester:
  - `npm run typecheck`.
  - Chạy riêng 3 test, lặp 20 lần (mỗi lần tạo phòng mới):
    `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "walks the boss back home when it strays|syncs the time of day|wild pals cast too"`.
  - `npm test` 20 lần liền (mỗi lần khoảng 65 giây, tổng khoảng 22 phút). Ghi kết quả từng lần.
  - **Chạy thân test trên 120 phòng mới** (như tester làm ở T2), trên bản sao tạm ngoài repo:
    - Tạo bản sao bằng `git archive HEAD packages/server packages/shared vitest.config.ts package.json tsconfig.base.json`, rồi chép `GameRoom.test.ts` mới vào. Tạo `node_modules` gồm liên kết tới từng mục trong `node_modules` của repo, riêng `@petgame/shared` và `@petgame/server` trỏ vào `packages/` của bản sao.
    - Viết một file khảo sát chạy lại 3 thân test trên 120 phòng mới mỗi thân. Test trùm và test thú đêm chạy theo lô song song được, vì mock của test thú đêm là đồng bộ. Test tung chiêu phải chạy tuần tự, vì mock của nó kéo dài qua vài tick, chạy song song sẽ lan sang phòng khác.
    - Yêu cầu: 0/120 hỏng ở cả 3 thân test.
    - Bản nháp của game-designer (có thể đã mất khi phiên khởi động lại): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t17/copy/packages/server/src/rooms/survey.test.ts` và `wildcast.survey.test.ts`.
  - **Kiểm đột biến** trên bản sao đó, mỗi lần chỉ một đột biến trong `GameRoom.ts` của bản sao rồi khôi phục. Chạy test tương ứng của file test mới bằng `-t`, ít nhất 5 lần. Mỗi lần đều phải hỏng, đúng ở phép kiểm ghi bên cạnh:
    - M-B1: xoá dòng `:618` (`if (pal.boss && distance(pos, this.bossHome) > BOSS_LEASH) brain.target = { ...this.bossHome };`). Test trùm hỏng (khoảng 690 px, không nhỏ hơn 600).
    - M-N1: ở `:1982` đổi `night: isNight(this.dayTime)` thành `night: false`. Test thú đêm hỏng ở bước ban đêm.
    - M-N2: cùng chỗ, đổi thành `night: true`. Hỏng ở bước ban ngày.
    - M-N3: ở `:1682` đổi `if (this.wasNight && !night) {` thành `if (false) {`. Hỏng ở bước bình minh.
    - M-N4: xoá dòng `:1679` (`this.state.dayTime = ...`). Hỏng ở bước đồng bộ.
    - M-W1: ở `:1196` và `:1205` đổi `homing: !wild` thành `homing: true`. Test tung chiêu hỏng.
    - M-W2: thay dòng đầu của `wildSkill` (`:1420`) bằng `return undefined;`. Test tung chiêu hỏng (không có chiêu nào).
    - Đối chứng (không bắt buộc): test trùm cũ khi có M-B1 vẫn qua phần lớn số lần (đã đo 53/60). Điều này cho thấy dòng `brain.target = away` là cần thiết.
  - Không sửa code sản phẩm trong repo khi kiểm đột biến: chỉ sửa trong bản sao.

## Tiêu chí hoàn thành

- [ ] `git diff --stat`: trong số file code, chỉ có `packages/server/src/rooms/GameRoom.test.ts` thay đổi (cùng các file làm việc `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`).
- [ ] Test trùm:
  - Không còn `boss.x -= 600`.
  - Dùng `bossWalk()`. Helper tìm theo thứ tự cố định, kiểm bằng `BOSS.radius` và `isSea` mỗi 8 px, và throw khi không có tuyến.
  - Gán `bossHome = home`, trùm ở `stray`, `brain.target = away`, `brain.idleMs = 0`.
  - Vẫn chờ 40 tick. Vẫn kiểm `toBeLessThan(before)` với `before` = 600.
- [ ] Test thú đêm:
  - Mock `Math.random` chỉ đồng bộ quanh `spawnPal(at)`, trả lại trong `finally`.
  - Có đủ các phép kiểm: ban ngày không ra Mothlume; `state.dayTime` khoảng 0,8 sau 30 tick; ban đêm ra Mothlume; bình minh con đó bị xoá và không còn Mothlume nào không giận.
  - Vẫn chờ 30 tick và 10 tick.
- [ ] Test tung chiêu: mock chỉ bao quanh vòng đợi và được trả lại trước các `expect`. Giới hạn 160 tick và mọi `expect` giữ nguyên.
- [ ] Không có `retry`, không tăng ngưỡng hay timeout, không đổi tên hay `skip` test nào, không `vi.mock` module. Các test khác không đổi.
- [ ] `npm run typecheck` sạch. `npm test` qua 20 lần liền.
- [ ] Chạy riêng 3 test bằng `-t` 20 lần: lần nào cũng qua.
- [ ] Khảo sát 120 phòng mới cho mỗi thân test: 0 lần hỏng.
- [ ] Đủ 7 đột biến M-B1, M-N1 đến M-N4, M-W1, M-W2: mỗi đột biến làm test tương ứng hỏng ở mọi lần chạy (ít nhất 5 lần), đúng phép kiểm đã ghi. Đã khôi phục bản sao sau mỗi đột biến.
- [ ] `PROGRESS.md` ghi số lần chạy, số phòng và kết quả từng đột biến.

## Rủi ro, câu hỏi mở

- Không có quyết định nào cần người dùng: **không có dòng CHẶN**.
- `bossWalk()` phụ thuộc bố cục thế giới, nhưng thế giới cố định theo seed nên kết quả vẫn tất định. Nếu sau này `worldgen` đổi đến mức không còn tuyến nào, test sẽ hỏng mọi lần với thông báo rõ ràng (không phải chập chờn); khi đó nới vùng tìm kiếm, ví dụ thêm vòng hoặc bước góc nhỏ hơn.
- Test truy cập trường và hàm riêng qua `as any` (`bossHome`, `brains`, `dayTime`, `spawnPal`, `provoke`). Đây là lệ có sẵn của file. T10 (tách `GameRoom.ts`) phải giữ được các trường này hoặc sửa test theo.
- Mock `Math.random`:
  - Ở test thú đêm, mock là đồng bộ nên không lan ra tick nào.
  - Ở test tung chiêu, mock kéo dài 1-2 tick trong phòng chỉ có một con thú. Không có lần gọi random nào khác ảnh hưởng kết quả (không có thú lang thang, người chơi không đánh, chưa đến lượt sinh thú). `afterEach` cũng tự trả lại mock.
- Test tung chiêu nay luôn dùng ember (phóng thẳng). Trước đây thỉnh thoảng thú áp sát rồi dùng fire_breath (hình nón), nhưng việc đó chưa bao giờ xảy ra chắc chắn. Không mất phép kiểm nào; việc né chiêu hình nón chưa có test riêng. Mức ưu tiên thấp, không cần thêm việc.
- `toBeCloseTo(0.8, 1)` cho sai số 0,05, tức khoảng 24 giây giờ game, đủ an toàn cả khi máy chậm.

## Đề xuất cho TASKS.md

- **T21 (P3, đề xuất):** Trùm va chạm khi lang thang như một thú thường. `stepWander` của trùm dùng `species.size` (20) (`GameRoom.ts:624`), trong khi lúc xuất hiện, lúc đuổi và lúc cắn trùm dùng `BOSS.radius` (40) (`:555`, `:599`, `:1460`). Khi đi dạo, trùm có thể lấn vào đá, cây và lọt qua khe hẹp hơn thân mình (trùm được vẽ to gấp 2,4 lần). Cần game-designer quyết định có thống nhất hay không. Nếu đổi, test trùm của T17 vẫn qua, vì tuyến đã được kiểm với bán kính 40.
