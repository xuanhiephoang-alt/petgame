# BALANCE: T27, thú hiền (Voltmouse) bỏ chạy nhanh hơn người chơi

Mọi số dưới đây tính bằng script chỉ đọc (import thẳng `@petgame/shared`), nằm ở thư mục tạm của phiên, không thêm vào repo. Mô hình là mô phỏng 1 chiều ở bước 50 ms, địa hình trống (xem "Giới hạn của mô hình").

## Hiện trạng

### Công thức và nguồn

| Việc | Công thức | Nguồn |
|---|---|---|
| Tốc độ bỏ chạy | `species.speed * WILD_CHASE_SPEED_FACTOR` (1,8), chạy thẳng ra xa kẻ đánh (đích cách 200 px), trượt quanh vật cản, dừng ở bờ biển | `GameRoom.ts:695`, `ai/wildCombat.ts:58` (`stepFlee`), `combat.ts:24` |
| Khi nào chạy | `provoke()` với thú `passive` không phải đầu đàn: `fleeing.set(..., until = now + FLEE_MS)` (2500 ms). Mỗi đòn trúng đặt lại đồng hồ. Gọi từ đòn người chơi, đòn thú đi theo, và lúc thoát khỏi bóng (`breakOut`) | `GameRoom.ts:1710-1720`, `combat.ts:53` |
| Hết chạy | `fleeing` bị xoá, thú quay lại đi dạo ở tốc độ `species.speed` (không nhân hệ số) | `GameRoom.ts:702`, `ai/wander.ts` |
| Choáng | Máu không xuống dưới 1; về 1 thì choáng 6 s, không di chuyển, hủy chạy; đòn kế của người chơi hạ gục | `combat.ts:64`, `GameRoom.ts:1187-1208` |
| Người chơi | `PLAYER_SPEED` 160 px/s; lướt 520 px/s trong 170 ms = 88,4 px, hồi 900 ms, tốc độ trung bình khi lướt liên tục 228 px/s | `constants.ts:16`, `movement.ts:9-13` |
| Vũ khí | tay không 10 sát thương, tầm 48, hồi 400 ms, đẩy lùi 10; gậy 13/52/420/14; kiếm 16/56/420/12; giáo 15/76/480/18; ná 9/150/520/6 | `constants.ts:19-21`, `wardrobe.ts:67`, `wearables.json` |
| Máu thú | `scaledMaxHp = round(maxHp * (1 + 0.2 * (L - 1)))` | `progression.ts:63` |
| Cấp thú hoang | `rollWildLevel = 1 + floor(roll^2 * wildMaxLevel)`, `wildMaxLevel = 6..14` theo `dangerAt` | `progression.ts:73-80` |

### Tốc độ bỏ chạy của mọi thú hiền (`temperament: passive`)

| Loài | speed | Bỏ chạy hiện nay (x1,8) | So với người chơi (160) | Nơi sinh | Chiếm trong thế giới* |
|---|---|---|---|---|---|
| leafkit | 50 | 90 | 0,56 | đồng cỏ, đảo | 7,8% |
| bubbloon | 40 | 72 | 0,45 | đồng cỏ, hồ, đầm lầy | 7,9% |
| **voltmouse** | 95 | **171** | **1,07** | đồng cỏ, đầm lầy, đảo | 5,1% |
| mothlume (chỉ ban đêm) | 75 | 135 | 0,84 | 5 vùng | 2,5% |
| bogbloom | 40 | 72 | 0,45 | đầm lầy | 4,2% |

*Mô phỏng 212 nghìn điểm sinh trên đất liền, 25% thời gian là đêm (`daycycle.ts`), cùng `pickSpecies`. Thú hiền tổng cộng 27,5% mọi lần gặp.

Tỉ lệ thú hiền trong từng vùng (chọn theo `spawnWeight`): đồng cỏ 62% (voltmouse 10-11%), đảo 46% (voltmouse 13%), đầm lầy 72% (voltmouse 14%), hồ 53%, núi lửa 3%, núi tuyết 6%, sa mạc 0%. Cấp trung vị của mọi loài là 3; 58% thú sinh ra cấp 3 trở xuống. Vậy người mới ở đồng cỏ gặp thú hiền trong 6 trên 10 lần, và cứ 9-10 lần có một lần là Voltmouse.

Chỉ Voltmouse thực sự chạy nhanh hơn người chơi. Mothlume (135, ban đêm) chạy sát tốc độ người chơi (0,84), đủ để thoát nếu người chơi bám không chuẩn (xem bảng độ nhạy).

### Thời gian hạ gục Voltmouse hiện nay (đến lúc hạ gục, giây; người chơi đuổi thẳng, địa hình trống)

Quy ước: "hạ gục" = tính từ đòn đầu đến đòn hạ gục thú đã choáng; "tĩnh" = thú đứng yên trong tầm (như thú phòng thủ đuổi lại cắn). Số đòn gồm cả đòn hạ gục.

| Cấp | Vũ khí | Số đòn | Tĩnh | Hiện nay, đi bộ | Hiện nay, lướt |
|---|---|---|---|---|---|
| 1 (máu 35) | tay không | 5 | 1,6 | 6,3 | 6,3 |
| 1 | gậy | 4 | 1,3 | 3,6 | 2,7 |
| 3 (máu 49) | tay không | 6 | 2,0 | **9,0** | 8,6 |
| 3 | gậy | 5 | 1,7 | **6,4** | 3,1 |
| 3 | kiếm | 4 | 1,3 | 3,6 | 3,0 |
| 3 | giáo | 5 | 1,9 | 6,5 | 2,0 |
| 3 | ná | 7 | 3,1 | 5,5 | 3,3 |
| 5 (máu 63) | tay không | 8 | 2,8 | 14,4 | 11,7 |
| 8 (máu 84) | tay không | 10 | 3,6 | 19,9 | 16,6 |
| 14 (máu 126) | tay không | 14 | 5,2 | 30,9 | 24,6 |

Khớp với báo cáo trong TASKS (cấp 3 mất 6-8 s). Nguyên nhân thấy rõ ở nhịp đòn: tay không, Voltmouse (171 px/s) thoát khỏi tầm sau mỗi đòn vì đòn đẩy lùi 10 px và người chơi chỉ đuổi 160. Thời điểm vung: 0 s, 0,4 s, 3,15 s, 5,85 s, 8,6 s, 11,35 s. Tức là cứ 2 đòn lại mất khoảng 2,75 s chờ hết `FLEE_MS` (2,5 s), vì lúc thú đang chạy người chơi không bao giờ rút ngắn khoảng cách (nhanh hơn 11 px/s, mỗi lần bị đánh lại chạy tiếp 2,5 s).

### Thú khác ở cùng cấp (hạ gục tĩnh, giây, tay không / gậy)

| Cấp | leafkit | bubbloon | mothlume | bogbloom | emberpup | pebblet | ripplefin | frostfang | cactoad | scorchtail | boulderhorn |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 2,4 / 2,1 | 2,8 / 2,1 | 2,4 / 1,7 | 2,8 / 2,5 | 2,8 / 2,5 | 4,0 / 3,4 | 2,8 / 2,5 | 4,0 / 3,4 | 3,6 / 2,9 | 3,2 / 2,5 | 5,2 / 4,2 |
| 8 | 4,0 / 3,4 | 4,4 / 3,8 | 3,6 / 2,9 | 4,8 / 4,2 | 4,8 / 4,2 | 6,8 / 5,5 | 4,8 / 3,8 | 6,8 / 5,5 | 6,0 / 4,6 | 5,6 / 4,6 | 8,8 / 7,1 |

Voltmouse "tĩnh" (2,0 s ở cấp 3) là loài mỏng nhất, nên mục tiêu hợp lý là 2-3 s ở cấp 3, ngang leafkit/mothlume. Hiện nay 9,0 s gấp 3,5-4,5 lần thú cùng cấp.

## Vấn đề

1. **Hệ số 1,8 dùng chung cho cả đuổi và bỏ chạy.** Với kẻ đuổi, 1,8 hợp lý vì người chơi lướt và né được (không loài đuổi nào vượt 153 px/s, scorchtail). Với kẻ bỏ chạy, 171 px/s > 160 khiến người chơi không thể rút ngắn khoảng cách và mỗi hai đòn lại chờ hết 2,5 s.
2. **Đề xuất ban đầu của TASKS (trần 0,9 x PLAYER_SPEED = 144) quá sát.** Với người chơi đuổi hoàn hảo thì ổn (voltmouse cấp 3 tay không 2,0 s), nhưng tốc độ rút ngắn chỉ 16 px/s. Chỉ cần người chơi bám kém một chút (joystick cảm ứng, vòng qua cây, độ trễ mạng; độ hiệu quả 90% = 144 px/s) là quay lại 8,5 s (xem bảng độ nhạy). Cần biên an toàn lớn hơn.
3. **Mothlume (135, 0,84 x) cũng thoát được** khi bám kém: 11,7 s ở cấp 3 nếu người chơi chỉ đạt 80% tốc độ.
4. **Không loài nào khác bị ảnh hưởng:** leafkit, bubbloon, bogbloom (90, 72, 72 = 0,45-0,56 x) đã hạ gục đúng bằng mức "tĩnh" ở mọi vũ khí.

### Bảng độ nhạy: hạ gục (giây, tay không / gậy) theo trần và độ hiệu quả đuổi của người chơi

"Độ hiệu quả" là tỉ lệ tốc độ đuổi thực tế so với 160 (1 là hoàn hảo; 0,8 = 128 px/s).

| Loài, cấp | Hiệu quả | Hiện nay | Trần 0,9 (144) | Trần 0,75 (120) | Trần 0,7 (112) | Trần 0,65 (104) | Trần 0,6 (96) |
|---|---|---|---|---|---|---|---|
| voltmouse, 3 | 1,0 | 9,0 / 6,4 | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 |
| voltmouse, 3 | 0,9 | 12,4 / 9,5 | **8,5 / 6,0** | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 |
| voltmouse, 3 | 0,8 | 13,9 / 10,7 | 9,5 / 6,8 | 3,2 / 3,0 | 2,0 / 1,8 | 2,0 / 1,8 | 2,0 / 1,8 |
| voltmouse, 3 | 0,7 | 15,9 / 12,1 | 13,5 / 10,3 | 9,1 / 6,5 | 8,5 / 6,1 | 3,1 / 3,0 | **2,0 / 1,8** |
| voltmouse, 8 | 0,8 | 27,6 / 21,0 | 21,1 / 15,6 | 8,2 / 8,3 | 4,3 / 4,3 | 3,6 / 3,2 | 3,6 / 3,1 |
| voltmouse, 8 | 0,7 | 31,5 / 23,9 | 26,7 / 20,3 | 20,1 / 14,9 | 18,9 / 14,0 | 8,2 / 8,3 | 4,3 / 4,3 |
| mothlume, 3 | 0,8 | 11,7 / 6,4 | 11,7 / 6,4 | 4,5 / 3,0 | 2,4 / 1,8 | 2,4 / 1,8 | 2,4 / 1,8 |
| mothlume, 3 | 0,7 | 15,8 / 9,7 | 15,8 / 9,7 | 11,8 / 6,5 | 11,1 / 6,1 | 4,4 / 3,0 | 2,5 / 1,8 |

Trần 0,6 giữ hạ gục ở mức "tĩnh" cho đến khi người chơi chỉ còn đuổi được 70% tốc độ (112 px/s); mỗi bậc cao hơn mất biên an toàn.

### Lướt

Lướt thêm 88,4 px mỗi 900 ms (trung bình 228 px/s) nên thoát được điểm nghẽn hiện nay một phần: voltmouse cấp 3, gậy 6,4 s → 3,1 s, giáo 6,5 s → 2,0 s; tay không gần như không khác (9,0 → 8,6 s) vì tay không có tầm ngắn nhất (48), mỗi đòn đẩy thú ra khỏi tầm. Người mới chưa biết lướt (phím Shift) nên không thể coi lướt là giải pháp.

### Vũ khí đầu tiên và vũ khí tầm xa

Gậy (4 gỗ), ná (6 gỗ + 4 quả), kiếm, giáo đều ở mức "tĩnh" sau khi sửa. Ná (tầm 150) vốn ít bị ảnh hưởng (5,5 s so với 3,1 s tĩnh ở cấp 3) vì chịu được khoảng cách; giáo (tầm 76) cũng nhẹ hơn tay không. Tay không là trường hợp tệ nhất, và là trải nghiệm của người mới.

### Giới hạn của mô hình

Đường thẳng không vật cản (cây, đá làm thú kẹt hoặc trượt, thường có lợi cho người đuổi nên bảng là cận trên về độ khó). Thú đứng yên sau khi hết chạy (lạc quan cho người chơi: đi dạo ở 47 px/s thêm khoảng 0,3 s). Không có chí mạng (12%, x1,6), không có thú đi theo (6 sát thương mỗi 0,9 s, bám 6 s) và không có khiên. Thú đi theo (190 px/s) nhanh hơn mọi tốc độ bỏ chạy nên thực tế hỗ trợ người chơi. Không tính cú ném bóng (tầm ném 180 px dài hơn mọi tầm đánh, chưa mô phỏng).

## Đề xuất

**Thêm một trần riêng cho tốc độ bỏ chạy, bằng 0,6 x `PLAYER_SPEED` (96 px/s), đặt trong `combat.ts`, và chỉ dùng ở chỗ bỏ chạy.**

| File | Khoá | Cũ -> mới |
|---|---|---|
| `packages/shared/src/combat.ts` | `WILD_FLEE_SPEED_CAP` (mới, = `PLAYER_SPEED * 0.6`, cần import `PLAYER_SPEED` từ `constants.ts`) | (không có) -> 96 |
| `packages/shared/src/combat.ts` | `fleeSpeed(speciesSpeed)` (mới) = `Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, WILD_FLEE_SPEED_CAP)` | (không có) |
| `packages/server/src/rooms/GameRoom.ts:695` | tốc độ truyền cho `stepFlee` | `species.speed * WILD_CHASE_SPEED_FACTOR` -> `fleeSpeed(species.speed)` |

`WILD_CHASE_SPEED_FACTOR`, `FLEE_MS`, đòn đẩy lùi, `stepFlee` giữ nguyên. Chọn trần phẳng, không phải hệ số theo loài, vì chỉ có hai loài vượt 96 px/s và trần để nguyên leafkit (90), bubbloon (72), bogbloom (72), nên không đổi hành vi hay test hiện có của chúng.

### Bảng sau khi đổi

| Loài | Bỏ chạy cũ | Bỏ chạy mới | So với người chơi | Hạ gục cấp 3 tay không (đuổi hoàn hảo / hiệu quả 0,8 / 0,7) | Tĩnh |
|---|---|---|---|---|---|
| leafkit | 90 | 90 | 0,56 | 2,4 / 2,4 / 2,4 | 2,4 |
| bubbloon | 72 | 72 | 0,45 | 2,8 | 2,8 |
| voltmouse | 171 | **96** | **0,60** | **2,0 / 2,0 / 2,0** (cũ 9,0 / 13,9 / 15,9) | 2,0 |
| mothlume | 135 | **96** | **0,60** | **2,4 / 2,4 / 2,5** (cũ 2,4 / 11,7 / 15,8) | 2,4 |
| bogbloom | 72 | 72 | 0,45 | 2,8 | 2,8 |

Hạ gục sau khi đổi, voltmouse (giây, tay không / gậy; hiệu quả 1,0 đến 0,8):

| Cấp | Số đòn tay không | Hạ gục (mới) | Hạ gục (cũ) |
|---|---|---|---|
| 1 | 5 | 1,6 / 1,4 | 6,3 / 3,6 |
| 3 | 6 | 2,0 / 1,8 | 9,0 / 6,4 |
| 5 | 8 | 2,8 / 2,3 | 14,4 / 9,2 |
| 8 | 10 | 3,6 / 3,1 | 19,9 / 14,7 |
| 14 | 14 | 5,2 / 4,5 | 30,9 / 23,0 |

Mỗi bậc khớp thú cùng cấp (cấp 3: 2,0 s so với leafkit 2,4, bubbloon 2,8, pebblet 4,0; cấp 8: 3,6 s so với 4,0-6,8). Khoảng cách chạy tối đa sau mỗi đòn giảm từ 427 px xuống 240 px, và người chơi rút ngắn 64 px/s (132 px/s khi lướt) thay vì bị bỏ xa 11 px/s. Vẫn là "đuổi ngắn" (thời điểm vung đòn tay không: 0 / 0,4 / 0,8 / 1,2 / 1,6 / 2,0 s, đúng nhịp hồi chiêu 400 ms như đánh tĩnh).

Phương án phụ nếu nhà thiết kế muốn thú còn "chạy trốn" rõ rệt hơn: trần 0,65 (104 px/s) vẫn an toàn đến hiệu quả 0,75 và thêm 0,05 độ nhanh; trần 0,75 (120) và 0,9 (144) không khuyến nghị (bảng độ nhạy). Không đề xuất giảm `WILD_CHASE_SPEED_FACTOR` toàn cục: sẽ làm yếu mọi thú đuổi (scorchtail 153 px/s hiện là loài đuổi nhanh nhất, 0,96 x).

## Rủi ro

### Tác dụng phụ lên các hệ khác (đã kiểm tra trong code)

- **Thú phòng thủ và hung dữ đuổi người chơi không bị ảnh hưởng.** Chúng dùng `species.speed * WILD_CHASE_SPEED_FACTOR` ở `GameRoom.ts:720`; bản sửa chỉ chạm dòng 695. Tốc độ đuổi hiện nay: scorchtail 153 (0,96 x), frostfang 135, emberpup 126, ripplefin 108, coralcrab 99, boulderhorn 81, cactoad 81, pebblet 54; không loài nào vượt người chơi.
- **Thú đầu đàn** không bỏ chạy (`provoke` chỉ chạy khi `!pal.alpha`), nên không đổi. Voltmouse đầu đàn ở đồng cỏ (cấp 15, máu 399) đuổi và quay về hang (`GameRoom.ts:684`, `:720`) ở 171 px/s, nhanh hơn người chơi 7%. Ghi nhận ngoài phạm vi T27: người chơi không thể chạy bộ thoát mà phải lướt hoặc né; dây đuổi chỉ giới hạn bởi `ALPHA.leash` (384 px) và `WILD_AGGRO_MS` (8 s). Nếu game-designer muốn, có thể kẹp tốc độ đuổi của riêng thú đầu đàn, nhưng đó là quyết định thiết kế khác, không đưa vào T27.
- **Trùm** (boulderhorn, 45 x 1,8 = 81 px/s) hung dữ, không bỏ chạy; `bossHeadHome` (`:1620`), `alphaReturning` (`:684`) và hằng số `max` ở `GameRoom.ts:264` (648 px, được `pathing.test.ts:309` kiểm tra) đều dùng `WILD_CHASE_SPEED_FACTOR` và không đổi. Vì vậy không đổi `WILD_CHASE_SPEED_FACTOR`.
- **Thú đi theo đánh thú hiền** cũng gọi `provoke`; thú đi theo (190 px/s) vẫn nhanh hơn trần 96, nên đuổi kịp như trước.
- **Bóng bắt trượt** (`breakOut`): thú hiền thoát khỏi bóng cũng bỏ chạy bằng đường đó, cùng trần mới. Thú chạy chậm hơn nên dễ ném bóng lại trong tầm 180 px.
- **Khả năng bắt thú:** không đổi (`captureChance`, `levelCatchRate`); thú hiền dễ chạm hơn nên người chơi hạ nhanh hơn nhưng vẫn bị giới hạn bởi máu về 1 và choáng 6 s.
- **Kinh tế XP/loot:** Voltmouse (cấp trung vị 3) cho `finishXp(12, L)` và loot như trước nhưng tốn ít thời gian hơn (9 s → 2 s); XP/giờ khi săn Voltmouse tăng, nhưng ngang các loài khác thay vì thấp hơn. Voltmouse chỉ chiếm 5,1% thế giới nên không làm lệch mục tiêu "cấp 7 trong buổi đầu".

### Test có thể phải sửa hoặc thêm

- `GameRoom.test.ts:2170` "passive pals run away when hit" dùng leafkit (90 < 96), kết quả giữ nguyên (cách xa trên 100 px sau 20 tick). Không cần sửa.
- `wildCombat.test.ts:24` gọi `stepFlee` với tốc độ 200 trực tiếp; không đổi.
- `pathing.test.ts` dùng `WILD_CHASE_SPEED_FACTOR` cho đuổi và trùm; không đổi.
- Thêm: test shared cho `fleeSpeed` (voltmouse = 96, mothlume = 96, leafkit = 90, bubbloon/bogbloom = 72; luôn nhỏ hơn `PLAYER_SPEED`), một test `GameRoom` cho voltmouse bị đánh chạy không quá khoảng 96 px/s trong `FLEE_MS` và người chơi giữ nhịp (hoặc kiểm tra `distance` sau 20 tick nhỏ hơn mức tương ứng 171 px/s), và ghi chú trong `docs/design/pals.md` nếu mục thú hiền nói về tốc độ bỏ chạy.

### "Sau T9": chạy về phía thoáng theo `NavGrid.clearanceAt`

Hiện trạng: `stepFlee` chạy thẳng đến điểm cách 200 px, ngược hướng kẻ đánh, và `obstacles.resolve` chỉ trượt quanh vật cản; nếu hướng đó có cây hoặc đá thì thú kẹt hoặc đi chậm, nếu hướng đó là biển thì nước bị chặn bằng `isSea` và thú đứng yên (`GameRoom.ts:696-699`). Cả hai đều là lợi thế ngẫu nhiên cho người đuổi (không có trong mô phỏng ở trên, vốn là địa hình trống nên cận trên về độ khó của thú).

`NavGrid.clearanceAt(x, y)` (`pathfind.ts:96`, nội suy hai chiều, tính bằng px, 0 là sát vật cản) và `lineClear`/`seaFree` đã có, nên có thể chọn hướng chạy: lấy mẫu vài hướng (ví dụ 8-12 hướng trong nửa mặt phẳng xa kẻ đánh, giới hạn khoảng ±70° so với hướng thẳng ra xa), cho điểm bằng `clearanceAt` tại khoảng 60-120 px phía trước, loại các hướng `lineClear` sai hoặc dẫn ra biển, giữ hướng cũ vài tick (khoảng 250 ms) để khỏi rung.

Tác động cân bằng:
1. Thú chạy đúng tốc độ danh nghĩa trong mọi địa hình, vì không còn kẹt vào cây. Đó là điều kiện bảng ở đây giả định, nên bảng không đổi, nhưng **không có trần thì T9-flee sẽ làm Voltmouse khó hơn nữa** (bỏ mất những lần nó kẹt vào cây). Vì vậy đưa trần 0,6 vào trước hoặc cùng lúc.
2. Hạ gục ở rừng (đầm lầy, núi tuyết) hơi chậm hơn so với bây giờ vì mất cơ hội kẹt cây; với trần 96 px/s, thú hiền vẫn bị bám kịp (rút ngắn 64 px/s), nên chênh lệch nhỏ.
3. Giữ trong nửa mặt phẳng xa kẻ đánh: nếu cho quá lệch (±90° hoặc hơn) thú có thể chạy ngang qua người chơi, đó là lỗi hành vi. Chạy dọc bờ biển cũng được lợi vì thú dừng cứng ở bờ hiện nay.
4. Chi phí: chỉ một ít thú chạy cùng lúc (mỗi đòn trúng 2,5 s); 10 mẫu x 1 lần/250 ms là rẻ, nhưng nên đi qua cùng bộ ngân sách `paths.run(now)` nếu gộp vào `PathPlanner` (TASKS T10).
