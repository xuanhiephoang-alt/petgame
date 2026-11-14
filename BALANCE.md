# BALANCE: T58, Voltmouse đầu đàn đuổi 171 px/s, nhanh hơn người chơi (160)

Số tính bằng script chỉ đọc, import thẳng `@petgame/shared`, nằm ở thư mục tạm của phiên (không thêm vào repo): `.../scratchpad/a.ts` (bảng tốc độ), `sim.ts` và `sim3.ts` (chạy thoát), `sim2.ts` và `sim4.ts` (đánh nhau). Mô phỏng bước 50 ms, địa hình trống, sao chép thứ tự xử lý của `GameRoom.tick` cho một thú đầu đàn (dây giới hạn, nhìn thấy 170 px, gồng cắn, chiêu thật của Voltmouse qua `inSkillArea`, `skillPower`, `skillTravelMs`). Mỗi ô 6000 lượt, hạt giống cố định.

## Hiện trạng

### Công thức và nguồn

| Việc | Công thức | Nguồn |
|---|---|---|
| Tốc độ đuổi và về hang của thú đầu đàn | `species.speed * WILD_CHASE_SPEED_FACTOR` (1,8); không kẹp | `GameRoom.ts:794` (đuổi, dùng chung cho thú hung dữ, thú phòng thủ, đầu đàn, trùm), `:754` (về hang) |
| Thú đầu đàn không bỏ chạy | `provoke` chỉ cho chạy khi `!pal.alpha`; trần `WILD_FLEE_SPEED_CAP` (96) không áp | `GameRoom.ts:1717-1720`, `combat.ts:34` |
| Tìm kẻ địch | `ALPHA.sight` 170 px; giận 8 s (`WILD_AGGRO_MS`) kể từ lúc thấy hoặc bị đánh; hết giận mà người chơi còn trong 170 px thì giận lại ngay | `GameRoom.ts:1799-1814` |
| Dây giới hạn | alpha cách hang hơn `ALPHA.leash` = 12 x 32 = **384 px** thì bỏ trận, về hang (không bao giờ quay lại đánh khi đang về), hồi 4%/s. Hang cách người chơi đứng ở giữa bản đồ 849 px (Voltmouse) | `alphas.ts:46`, `GameRoom.ts:747-760` |
| Vùng dạo | `ALPHA.roam` 128 px quanh hang | `alphas.ts` |
| Cắn | dừng cách mục tiêu 28 px (`0,7 x WILD_ATTACK_RANGE`); cắn khi trong 40 px, nghỉ 1200 ms tính từ lúc **bắt đầu** gồng; gồng 450 ms **đứng yên**; trúng nếu lúc đó mục tiêu còn trong 50 px | `GameRoom.ts:802-815`, `combat.ts:12-13,55-57` |
| Chiêu | 8% mỗi tick, nghỉ 2,2 s; **nhắm vào chỗ mục tiêu đứng lúc bắt đầu gồng** (không đuổi theo, `homing: false`), đứng yên suốt lúc gồng | `GameRoom.ts:1656`, `startCast` |
| Người chơi | 160 px/s; lướt 520 px/s x 170 ms = 88 px, hồi 900 ms (trung bình khi lướt liên tục 228 px/s); trên bè 144 | `constants.ts:16`, `movement.ts:6-13` |

### Tốc độ đuổi của mọi loài biết đuổi (x1,8) so với người chơi (160) và lướt (520 trong 170 ms)

| Loài | Tính khí | speed | Đuổi | / 160 | Ghi chú |
|---|---|---|---|---|---|
| **voltmouse đầu đàn** (cấp 15, máu 399) | đầu đàn | 95 | **171** | **1,07** | duy nhất vượt người chơi; lướt vẫn bỏ xa (tốc độ lướt 3,0x) |
| scorchtail đầu đàn (cấp 20, máu 792) | đầu đàn | 85 | 153 | 0,96 | sát |
| frostfang đầu đàn (cấp 19) | đầu đàn | 75 | 135 | 0,84 | |
| coralcrab đầu đàn (cấp 22) | đầu đàn | 55 | 99 | 0,62 | |
| cactoad đầu đàn (cấp 18) | đầu đàn | 45 | 81 | 0,51 | |
| bogbloom đầu đàn (cấp 17) | đầu đàn | 40 | 72 | 0,45 | |
| boulderhorn (trùm) | hung dữ | 45 | 81 | 0,51 | |
| scorchtail, emberpup, frostfang, ripplefin, coralcrab, cactoad, pebblet thường | hung dữ/phòng thủ | 30-85 | 54-153 | 0,34-0,96 | không loài nào vượt 160 |
| voltmouse, mothlume, leafkit, bubbloon, bogbloom thường | hiền | - | không đuổi (bỏ chạy, trần 96, T27) | - | |

Vậy chỉ một con trong cả game vượt người chơi: Voltmouse đầu đàn ở đồng cỏ, và vượt 7% (hơn 11 px/s). Người chơi lướt (228 px/s trung bình) luôn bỏ xa mọi loài.

### Thoát khỏi Voltmouse đầu đàn hiện nay

Người chơi 100 HP, không giáp, cấp 3-5 (máu người chơi không tăng theo cấp). Thoát = chạy thẳng ra xa alpha, hướng ngẫu nhiên so với hang. "Phản ứng" là thời gian trước khi bắt đầu chạy. "Hiệu quả" là tỉ lệ tốc độ thực so với 160 (joystick cảm ứng, vòng qua cây).

| Tình huống | Hiệu quả | Phản ứng | Có sát thương | Sát thương TB | Lớn nhất | Chết | Dây đứt sau (TB / p95) |
|---|---|---|---|---|---|---|---|
| Vừa vào tầm nhìn (cách 170 px) | 1,0 / 0,9 / 0,7 | 0-300 ms | **0%** | 0 | 0 | 0% | 2,7-3,0 s / 3,3-3,5 s |
| Đang đánh giáp lá cà (cách 28 px), pha cắn ngẫu nhiên | 1,0 | 0 ms | 3,9% | 0,4 | 11 | 0% | 3,1 s / 3,7 s |
| như trên | 1,0 | 300 ms | 29,6% | 3,3 | 11 | 0% | 3,4 s / 4,0 s |
| như trên | 0,7 | 300 ms | 33,9% | 3,7 | 11 | 0% | 4,1 s / 5,0 s |
| như trên | 0,5 | 300 ms | 41% | 4,5 | 26 | 0% | 5,4 s / 6,5 s |
| như trên (bị vật cản làm chậm nặng) | 0,3 | 300 ms | 100% | 83 | 121 | **9%** | 8,3 s / 9,9 s |

Cú cắn duy nhất có thể trúng là cú đã gồng trước khi người chơi bỏ chạy (11 sát thương, `wildDamage` cấp 15 = 11). Đòn chiêu hầu như không bao giờ trúng người đang chạy (0,00 lần trúng mỗi lượt, trừ hiệu quả 0,3 là 1,2 lần).

DPS thực tế của alpha lên người chơi đang chạy: trung bình 3,3 sát thương trong 3,4 s tức khoảng 1 máu mỗi giây (cấp 3-5 không giáp). Lên người đứng yên: cắn 11 mỗi 1,2 s cộng chiêu 15/29/26, gộp lại 100 máu hết trong **7,0 s** (không giáp), 9,2 s (giáp da + mũ sắt 30%), tức 14 máu mỗi giây.

Vì sao tốc độ gần như không quan trọng:
1. **Dây giới hạn đứt trước khi alpha đuổi kịp.** Từ lúc thấy (cách 170 px), khoảng cách chỉ co lại 11 px/s, mất 11,8 s mới tới tầm cắn 40 px; alpha chỉ cần đi 256-512 px (từ chỗ nó đứng ra khỏi vòng 384 px) nên bỏ cuộc sau 2,6-3,3 s.
2. **Cú cắn có gồng đứng yên 450 ms.** Người chơi đang chạy cách xa thêm 72 px, vượt tầm 50 px, nên cú cắn trượt; alpha phải đuổi lại.
3. **Chiêu nhắm vào chỗ đã đứng.** Sấm sét rơi sau 670 ms (người chơi đã đi 107 px, bán kính chiêu 34 + 12), tia điện sau 350 ms (56 px so với 16 + 12), sét chuỗi sau 600 ms.

### Kết quả khi đổi tốc độ đuổi của alpha (cùng mô phỏng, cùng hạt giống)

Cột = tốc độ đuổi (px/s); ô = (có sát thương %, sát thương TB, chết %).

| Tình huống (đang đánh giáp lá cà, phản ứng 300 ms) | 171 (hiện nay) | 152 (0,95) | 144 (0,9) | 128 (0,8) | 120 (0,75) | 96 (0,6) |
|---|---|---|---|---|---|---|
| hiệu quả 1,0 | 30%, 3,3, 0% | 29%, 3,2, 0% | 30%, 3,3, 0% | 30%, 3,3, 0% | 29%, 3,2, 0% | 30%, 3,2, 0% |
| hiệu quả 0,5 | 41%, 4,5, 0% | 42%, 4,6, 0% | 42%, 4,6, 0% | 43%, 4,7, 0% | 42%, 4,6, 0% | 41%, 4,5, 0% |
| hiệu quả 0,3 | 100%, 83, **9,0%** | 100%, 82, 6,7% | 100%, 82, 7,3% | 100%, 81, 5,1% | 100%, 81, 4,3% | 100%, 78, 1,6% |
| Dây đứt sau (TB, hiệu quả 1,0) | 3,4 s | 3,6 s | 3,7 s | 3,9 s | 4,1 s | 4,7 s |

Kẹp tốc độ đuổi thay đổi kết quả thoát không đáng kể (trong sai số mô phỏng) trừ khi người chơi bị chậm cực mạnh (hiệu quả 0,3).

### Trận đánh Voltmouse đầu đàn không đổi theo tốc độ đuổi

Mô phỏng người chơi đứng đánh, đo thời gian hạ alpha xuống 1 máu (399 máu). Vì alpha tự đi tới và dừng cách 28 px (trong tầm mọi vũ khí), tốc độ chỉ ảnh hưởng thời gian khép khoảng cách sau đòn đẩy lùi 10-18 px.

| Cấu hình | 171 | 152 | 144 | 128 | 120 | 96 |
|---|---|---|---|---|---|---|
| kiếm, đứng đánh, giáp 30%: hạ gục (giây, trung vị) | 10,6 | (chưa đo) | 10,6 | 10,6 | 10,6 | 10,7 |
| kiếm + thú đi theo cấp 15 (khoảng 15 máu/s), né nửa số đòn, giáp 30%: hạ gục (giây, trung vị / p10-p90) | 8,0 / 6,8-9,4 | (chưa đo) | 8,0 / 6,8-9,3 | 8,0 / 6,8-9,4 | 8,0 / 6,8-9,4 | 8,0 / 6,8-9,3 |

Khớp ghi chú T7 (trận đồng cỏ 5-8 s khi đánh liên tục, mô phỏng thô này ra 7-9 s vì có né). Người chơi cấp 3-5 tay không không thể thắng (hạ 399 máu cần khoảng 16 s đánh liền, trong khi 7 s là chết): con này là mục tiêu của người chơi đã có kiếm, giáp và thú đi theo cấp cao, không phải chặn đường người mới. Giới hạn: chính sách né của mô phỏng thô, thú đi theo là sát thương hằng; chỉ tin so sánh giữa các tốc độ, không tin con số tuyệt đối. Mô phỏng chính sách "né" thẳng ra xa cho kết quả vỡ vì kéo alpha đứt dây ở mọi tốc độ (không đưa vào bảng).

### Bắn kéo (kiting) với tầm xa

Một alpha chậm hơn người chơi có thể bị bắn kéo: người chơi bắn, chạy ra xa để lấy lại khoảng cách, bắn tiếp, và không bị cắn. Quãng chạy cần để lấy lại 100 px (từ 50 lên 150 = tầm ná) là `100 x 160 / (160 - tốc độ đuổi)`:

| Tốc độ đuổi | 171 | 160 | 152 | 144 | 128 | 120 | 96 |
|---|---|---|---|---|---|---|---|
| Quãng chạy mỗi chu kỳ | không thể | không thể | 2.000 px | 1.000 px | 500 px | 400 px | 250 px |

Dây đứt ở 384 px quanh hang, nên chạy vòng quanh hang được tối đa khoảng 1.500 px mỗi vòng. Từ 128 trở xuống người chơi bắn kéo được trọn một vòng quanh hang: trận trở thành "bắn rồi chạy vòng" mà không cần né. 144 trở lên (khoảng cách thu lại cần hơn 1.000 px) thì không khả thi trong vùng dây. Kẹp thấp hơn 0,9 phá trận đầu đàn.

## Vấn đề

1. **Phát hiện của T27 đúng về số nhưng hậu quả nhỏ hơn dự đoán.** Voltmouse đầu đàn nhanh hơn 7%, nhưng người chơi bỏ chạy mà không bị thương (0% sát thương khi vừa thấy, 0% chết ở mọi tình huống trừ khi bị vật cản làm chậm xuống 0,3 x tốc độ). Nhờ dây giới hạn (đứt sau khoảng 3 s) cùng cú cắn gồng đứng yên và chiêu nhắm vào chỗ cũ. "Người mới không thoát được" chỉ đúng theo nghĩa "alpha bám sát sau lưng trong khoảng 3 giây cho tới khi bỏ cuộc", không phải theo nghĩa bị đánh.
2. **Điều bất nhất có thật:** Voltmouse đầu đàn là loài duy nhất (kể cả trùm và mọi thú thường) nhanh hơn người chơi đi bộ; thiết kế và tài liệu (mục thú đầu đàn) ghi 5 trên 6 thú đầu đàn chậm hơn người chơi và đòi hỏi "né được", còn con này đòi lướt hoặc kéo qua dây. Một con "nhanh hơn người chơi" cũng làm tăng rủi ro thiết kế sau này: bất kỳ thứ gì làm chậm người chơi (bè 144 px/s, đóng băng, trói) hoặc tăng tốc thú (nâng `WILD_CHASE_SPEED_FACTOR`) khiến nhiều alpha vượt người chơi, và lúc đó dây giới hạn trở thành chỗ dựa duy nhất.
3. **Kẹp quá thấp có hại:** dưới 0,9 x người chơi mở đường bắn kéo (bảng trên) và làm trận đồng cỏ dễ hơn.

## Đề xuất

Chọn **phương án 1: kẹp tốc độ đuổi và về hang của thú đầu đàn ở 0,95 x `PLAYER_SPEED` = 152 px/s**, trong bảng `ALPHA`. Lý do chọn kẹp thay vì chỉ ghi tài liệu: kết quả trận và kết quả thoát gần như không đổi (tức rủi ro gần bằng 0), còn lại lợi ích là luật nhất quán "không thú đầu đàn nào chạy nhanh hơn người đi bộ" thay vì một ngoại lệ phải giải thích, và Voltmouse đầu đàn vẫn là con nhanh nhất (152 so với Scorchtail 153 trước đó, tức ngang).

| File | Khoá | Cũ -> mới |
|---|---|---|
| `packages/shared/src/alphas.ts` | `ALPHA.chaseSpeedMax` (mới, = `PLAYER_SPEED * 0.95`; cần import `PLAYER_SPEED` từ `constants.ts`) | (không có) -> 152 |
| `packages/shared/src/alphas.ts` | `alphaChaseSpeed(speciesSpeed)` (mới) = `Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, ALPHA.chaseSpeedMax)` (import `WILD_CHASE_SPEED_FACTOR` từ `combat.ts`; `combat.ts` không import `alphas.ts` nên không vòng) | (không có) |
| `packages/server/src/rooms/GameRoom.ts:754` | tốc độ về hang | `species.speed * WILD_CHASE_SPEED_FACTOR` -> `alphaChaseSpeed(species.speed)` |
| `packages/server/src/rooms/GameRoom.ts:794` | tốc độ đuổi | `species.speed * WILD_CHASE_SPEED_FACTOR` -> `pal.alpha ? alphaChaseSpeed(species.speed) : species.speed * WILD_CHASE_SPEED_FACTOR` |

Không đổi: `WILD_CHASE_SPEED_FACTOR`, `ALPHA.leash`, `ALPHA.sight`, `ALPHA.hpMultiplier`, `ALPHA.damageMultiplier`, trần bỏ chạy `WILD_FLEE_SPEED_CAP`, `GameRoom.ts:270` (`max` của trùm, được `pathing.test.ts:309` kiểm).

Dùng cả cho đường về hang (`:754`) để alpha không quay về nhanh hơn lúc đuổi, và để người chơi không thấy alpha "dịch chuyển" lúc bỏ cuộc.

### Bảng sau khi đổi

| Thú đầu đàn | Đuổi cũ | Đuổi mới | / 160 | Đổi |
|---|---|---|---|---|
| voltmouse | 171 | **152** | **0,95** | -19 (-11%) |
| scorchtail | 153 | **152** | 0,95 | -1 (-0,7%, coi như không đổi) |
| frostfang | 135 | 135 | 0,84 | không |
| coralcrab | 99 | 99 | 0,62 | không |
| cactoad | 81 | 81 | 0,51 | không |
| bogbloom | 72 | 72 | 0,45 | không |

Kết quả thoát và trận sau khi đổi (từ bảng "Kết quả khi đổi tốc độ đuổi", cột 152):

| Chỉ số | Trước (171) | Sau (152) |
|---|---|---|
| Vừa thấy rồi chạy: sát thương | 0 | 0 |
| Đang đánh rồi chạy, phản ứng 300 ms, hiệu quả 1,0: có sát thương / TB / chết | 30% / 3,3 / 0% | 29% / 3,2 / 0% |
| Hiệu quả 0,3 (bị vật cản làm chậm nặng): chết | 9,0% | 6,7% |
| Dây đứt sau khi bắt đầu chạy (giây, TB, hiệu quả 1,0) | 3,4 | 3,6 |
| Khoảng cách alpha còn bám sau lưng người chạy đúng tốc độ | co lại 11 px/s | giãn ra 8 px/s |
| Bắn kéo (quãng chạy mỗi chu kỳ) | không thể | 2.000 px, vượt xa vòng dây (không khả thi) |
| Hạ gục kiếm + thú cấp 15 (giây) | 8,0 | khoảng 8,0 (không phụ thuộc tốc độ đuổi) |

Các tình huống đồng cỏ cụ thể (người chơi cấp 3-5, 100 HP, tay không, không giáp, hang cách chỗ xuất phát 849 px):
- Đi vào tầm 170 px rồi quay đi ngay: không bị đánh ở mọi tốc độ 96-171; alpha bỏ cuộc sau khoảng 2,7-3,0 s.
- Đứng đánh giáp lá cà rồi bỏ chạy sau 0,3 s: 30% bị đúng một cú cắn 11, không chết.
- Đứng yên: chết sau khoảng 7 s (14 máu/s). Số này không đổi vì không liên quan tốc độ đuổi.
- Người chơi chạy khỏi alpha và dừng lại trước khi dây đứt (khoảng 3 s): alpha vẫn sát; đó là nguyên nhân "thoát không được" mà người chơi cảm nhận. Nên ghi vào tài liệu "chạy liên tục khoảng 4 giây, hoặc lướt".

Phương án 2 (giữ nguyên, ghi tài liệu): chấp nhận được vì số liệu thoát gần như giống nhau; sửa dòng 64 của `docs/design/pals.md` thành "Voltmouse đầu đàn đuổi 171 px/s (1,07 lần người chơi) nhưng bỏ cuộc sau khoảng 3 giây chạy nhờ dây 12 m, không gây thương nếu người chơi liên tục chạy". Nhược: giữ một ngoại lệ không có lý do thiết kế, và có sát thương nếu người chơi bị chậm (bè 144 px/s khi lên đảo qua đồng cỏ: không xảy ra với Voltmouse đầu đàn vì nó ở đất liền, nhưng xảy ra nếu đổi vị trí).

Không đề xuất kẹp dưới 0,9 (144): xem mục "Bắn kéo". 0,9 cũng chấp nhận được nhưng làm Scorchtail đầu đàn (núi lửa, cuối game) chậm đi 6% mà không cần thiết. Con số 0,95 là mức nhỏ nhất vẫn ngăn bắn kéo (2.000 px mỗi chu kỳ) và vẫn giữ Voltmouse đầu đàn là con "nhanh sát người chơi".

## Rủi ro

- **Tác động lên hệ khác (đã kiểm tra trong code):**
  - Thú thường (hung dữ, phòng thủ) và trùm: không đổi, nhánh `pal.alpha` ở `:794` chỉ nhánh thú đầu đàn.
  - Trùm: `GameRoom.ts:270` và `bossHeadHome` (`:1695`) dùng `WILD_CHASE_SPEED_FACTOR` trực tiếp, không đụng.
  - Thú hiền chạy trốn: không đụng (`fleeSpeed` ở `combat.ts`).
  - Thú đầu đàn khác: chỉ Scorchtail đổi 1 px/s.
  - Bắt, XP, rơi đồ: không đổi. Trận kéo dài như cũ.
  - Đường về hang `alphaReturning`: chậm hơn 11% với Voltmouse, vẫn đủ để về hang (dây 384 px, về trong khoảng 2,5 s).
- **Test có thể phải sửa hoặc thêm:**
  - Thêm vào `alphas.test.ts`: mọi thú đầu đàn `alphaChaseSpeed(species.speed) < PLAYER_SPEED`; Voltmouse = 152 (= `ALPHA.chaseSpeedMax`); Frostfang, Coralcrab, Cactoad, Bogbloom không bị kẹp (= `speed x 1,8`).
  - Thêm một test tích hợp ở `GameRoom.test.ts`: một alpha đuổi người chơi đứng xa 150 px trong 20 tick, không dịch chuyển quá `152 x 1,0 s` (kiểm không còn dùng 171).
  - `pathing.test.ts:309` (trùm 648 px) không đổi. Chưa thấy test nào cứng tốc độ alpha 171.
- **Tài liệu:** sửa `docs/design/pals.md` dòng 64 (hiện "Voltmouse đầu đàn đuổi 171 px/s ... Có nên kẹp hay không: việc đề xuất T58") thành luật mới: tốc độ đuổi và về hang của thú đầu đàn không quá 0,95 x người chơi (152 px/s), chỉ Voltmouse (171 -> 152) và Scorchtail (153 -> 152) bị kẹp.
- **Điều không làm trong T58:** trận đồng cỏ ngắn (T7). Số liệu cho thấy hạ gục không phụ thuộc tốc độ đuổi (8,0 s ở mọi tốc độ với kiếm + thú cấp 15), nên kẹp không làm trận ngắn hơn hay dài hơn. Nếu thấy nhạt, chỉnh máu hoặc cắn riêng của con này là việc khác (ghi ở TASKS, mục ghi chú dưới T7).
- **Độ tin cậy:** mô phỏng 1 chiều trên đất trống: cây và đá làm chậm cả người chơi (thường có lợi cho alpha khi người chơi bị vướng, hiệu quả 0,3-0,5 trong bảng) lẫn alpha. Thú đi theo của người chơi (190 px/s) nhanh hơn alpha và có thể kéo mục tiêu của alpha sang nó (`provoke` đặt mục tiêu là thú đi theo), không mô phỏng. Chiêu `thunder` có vùng 34 px, người chơi lướt hay đổi hướng gấp có thể bị trúng nếu dừng lại ở chỗ cũ: chưa mô phỏng.
