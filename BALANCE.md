# BALANCE: T57, thú hiền chạy trốn về phía thoáng (đo thời gian hạ gục trước và sau)

Số liệu tính bằng mô phỏng chạy trên code thật (import thẳng `@petgame/shared`, `stepFlee`, `stepToward`, `randomPoint` của server), bước 50 ms (đúng tick 20/s). Script nằm ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/` (`sim.ts`, `run2.ts` đến `run6.ts`), không thêm vào repo. Mỗi ô là 600-1500 trận ở các điểm sinh ngẫu nhiên trên thế giới thật (`defaultWorld()` seed 1234, `defaultNav()`, cùng `biomeAt`).

## Hiện trạng

### Công thức và nguồn

| Việc | Công thức | Nguồn |
|---|---|---|
| Tốc độ chạy | `fleeSpeed(speed) = min(speed * 1.8, WILD_FLEE_SPEED_CAP)`, cap = `PLAYER_SPEED * 0.6 = 96` (đã áp dụng từ T27) | `combat.ts:27-38` |
| Hướng chạy hiện nay | đích = vị trí + 200 px thẳng ra xa kẻ đánh; `stepToward` rồi `obstacles.resolve` (trượt quanh cây). Hướng tính lại mỗi tick từ vị trí kẻ đánh | `ai/wildCombat.ts:58-63` |
| Bờ biển | `GameRoom.ts:764-768`: nếu bước kế rơi vào biển (`isSea`) thì **không nhúc nhích cả tick** (không trượt dọc bờ), nên thú đứng sát bờ đến hết `FLEE_MS` | `GameRoom.ts:760-770` |
| Thời gian chạy | `FLEE_MS = 2500`, mỗi đòn trúng đặt lại; về 1 máu thì choáng 6 s, huỷ chạy; đòn kế hạ gục | `combat.ts:67`, `GameRoom.ts:1272-1278` |
| Đòn đánh | đòn trúng khi khoảng cách tâm <= tầm vũ khí; tay không 10 sát thương, tầm 48, hồi 400 ms, đẩy lùi 10 px | `GameRoom.ts:2238`, `GameRoom.ts:1357`, `constants.ts` |
| NavGrid | ô 16 px; `clearanceAt` nội suy song tuyến, trần `NAV_MAX_CLEARANCE = 64`, **không tính biển**; `lineClear(from, to, {radius, sea:false})` lấy mẫu mỗi 8 px theo clearance >= bán kính và quét ô biển chính xác | `pathfind.ts:96-146` |
| Thú hiền | leafkit 50 (chạy 90), bubbloon 40 (72), voltmouse 95 (96), mothlume 75, ban đêm (96), bogbloom 40 (72). Kích thước (bán kính) 12-16 px | `pals.json` |

### Quy ước mô phỏng

- Người chơi tay không (trường hợp tệ nhất của người mới), bắt đầu cách thú 56 px ở hướng ngẫu nhiên, luôn chạy thẳng vào thú (trượt quanh cây, không vào biển), dừng ở 0,7 x tầm. "Hiệu quả" `eff` là tỉ lệ so với 160 px/s (0,7 = 112 px/s: joystick cảm ứng, vòng cây).
- Thú đứng yên khi hết chạy (như BALANCE của T27). Không chí mạng, không thú đi theo, không khiên.
- "Kẹt" = thú nhúc nhích dưới 30% bước (định nghĩa `PATHING.stuckTicks`) trong tick đang chạy; "trận có kẹt" = có chuỗi từ 6 tick liên tiếp (0,3 s) như vậy. "Hạ gục" tính từ đòn đầu đến đòn hạ gục.

### Hôm nay: thú kẹt cây hoặc bờ biển bao lâu (thẳng ra xa, cap 96, `eff` 1,0, cấp 3 tay không)

| Vùng | Loài | Tick chạy bị kẹt | Trận có kẹt | Kẹt do biển | Hạ gục TB (s) |
|---|---|---|---|---|---|
| đồng cỏ | leafkit | 7% | 12% | 0% | 2,5 |
| đồng cỏ | bubbloon | 9% | 17% | 0% | 2,9 |
| đồng cỏ | voltmouse | 4% | 7% | 0% | 2,1 |
| hồ (bờ nước đồng cỏ) | bubbloon | 9% | 19% | 0% | 2,9 |
| đầm lầy | bubbloon | 18% | 32% | 42% | 2,9 |
| đầm lầy | voltmouse | 12% | 19% | 49% | 2,1 |
| đầm lầy | bogbloom | 16% | 29% | 45% | 2,9 |
| đảo (cần bè) | leafkit | 29% | 45% | 98% | 2,5 |
| đảo | voltmouse | 26% | 39% | 98% | 2,1 |
| **gộp các loài hiền, ban ngày** | | | **26%** (22% voltmouse, 29% leafkit, 32% bogbloom, 23% bubbloon) | | **2,6** |

(Dòng gộp: trung bình theo tỉ lệ sinh của từng loài, mỗi loài lấy đều các điểm trong vùng nó sống; đồng cỏ vẫn là vùng người mới ở nên thực tế gần 7-17% hơn 26%.)

Hạ gục hôm nay theo cấp và loài (giây, tay không, `eff` 1,0, địa hình thật): leafkit 1,7 / 2,5 / 3,4 / 4,1 (cấp 1/3/5/8), bubbloon 2,2 / 3,0 / 3,3 / 4,6, voltmouse 1,8 / 2,1 / 2,9 / 3,7, mothlume 1,7 / 2,7 / 2,9 / 3,8, bogbloom 2,1 / 2,9 / 3,7 / 4,9.

Hai điều rút ra:
1. Kẹt có thật và nhiều (một trên bốn trận gộp, hai trên năm ở đảo), nhưng **không làm hạ gục lâu hơn**: kẹt chỉ giúp người chơi. Hạ gục hôm nay đã bằng mức "đứng yên" (số đòn - 1) x 0,4 s + chút đi lại, vì cap 96 chậm hơn người chơi 64 px/s. Vấn đề của T57 là hình ảnh và cảm giác ("thú đứng ì tại cây, đứng sát bờ biển bị đánh"), không phải con số TTK.
2. Gần một nửa số kẹt ở đầm lầy và gần hết ở đảo là do bờ biển (nhánh `isSea` đứng yên cả tick), phần còn lại là cây.

## Vấn đề

1. **Kẹt cây và bờ biển** (bảng trên): tick chạy bị kẹt 4-9% ở đồng cỏ, 12-18% ở đầm lầy, 26-29% ở đảo; 7-17% trận ở đồng cỏ có thú đứng ì từ 0,3 s trở lên.
2. **Chạy thông minh làm thú khó bắt hơn, nên phải kiểm tra lại biên an toàn của cap 96.** Kết quả (bảng dưới): với người chơi đuổi ở 70% tốc độ trở lên (112 px/s) hạ gục gần như không đổi; chỉ ở 60-65% (96-104 px/s, sát hoặc dưới tốc độ thú) mới tệ đi, vì lúc đó cả bản cũ lẫn bản mới đều khó. Cap 96 vẫn là đúng, không cần hạ.
3. Chạy lệch hướng thực ra **giảm** tốc độ rời xa của thú (lệch 70° thì tốc độ rời chỉ còn 96 x cos 70° = 33 px/s), nên nguy cơ làm thú khó bắt chỉ có ở chỗ thú không còn kẹt mà chạy hết 2,5 s.

## Mô phỏng sau khi đổi

Thuật toán thử: mỗi lần chọn hướng (đầu trận chạy, mỗi 250 ms, và ngay khi bị đánh lại vì `fleeing` đặt lại), lấy `n` hướng đều trong `±half` quanh hướng thẳng ra xa; loại hướng mà `nav.lineClear(pos, pos + dir * look, {radius: species.size, sea: false})` báo chặn; điểm = `wAlign * cos(lệch) + wClear * min(clearanceAt(điểm cuối), 64) / 64`; chọn điểm cao nhất, giữ hướng tuyệt đối đó đến khi hết thời gian giữ. Không còn hướng nào: thử 16 hướng toàn vòng, vẫn không có thì chạy thẳng như hôm nay.

### Bảng 1: hạ gục TB (s) hôm nay -> mới, tay không, `eff` 1,0 / 0,7 (112 px/s), tham số đề xuất

| Loài | Cấp 1 | Cấp 3 | Cấp 5 | Cấp 8 |
|---|---|---|---|---|
| leafkit | 1,7->1,7 / 1,7->1,9 | 2,5->2,6 / 2,6->2,8 | 3,4->3,4 / 3,3->3,3 | 4,1->4,1 / 4,2->4,1 |
| bubbloon | 2,2->2,3 / 2,1->2,3 | 3,0->2,9 / 3,0->2,9 | 3,3->3,5 / 3,3->3,3 | 4,6->4,5 / 4,6->4,6 |
| voltmouse | 1,8->1,7 / 1,9->1,8 | 2,1->2,1 / 2,4->2,3 | 2,9->2,9 / 3,4->3,3 | 3,7->3,8 / 4,4->4,2 |
| mothlume | 1,7->1,9 / 1,9->1,9 | 2,7->2,6 / 2,8->2,7 | 2,9->2,9 / 3,4->3,4 | 3,8->3,9 / 4,3->4,1 |
| bogbloom | 2,1->2,1 / 2,2->2,1 | 2,9->2,9 / 3,1->2,9 | 3,7->3,8 / 3,9->3,7 | 4,9->4,9 / 4,9->5,0 |

Chênh 0,1-0,2 s là nhiễu lấy mẫu. Tức là TTK **không đổi**; p90 của mọi ô trên không quá 5,0 s.

Gộp loài hiền ban ngày, cấp 3, `eff` 1,0: 2,63 s -> 2,60 s; trận có kẹt 26% -> 0,3%.

### Bảng 2: voltmouse (cap 96), hạ gục TB / p90 (s) theo hiệu quả đuổi, bản cũ -> bản mới

| Cấp | `eff` 1,0 (160) | 0,8 (128) | 0,7 (112) | 0,65 (104) | 0,6 (96) |
|---|---|---|---|---|---|
| 3 | 2,1->2,1 / 2,1->2,1 | 2,2->2,3 / 2,1->2,1 | 2,3->2,4 / 2,6->2,5 | 3,6->3,6 / 4,7->4,5 | 6,3->8,0 / 9,7->10,8 |
| 8 | 3,8->3,8 / 3,7->3,7 | 3,8->3,8 / 3,7->3,7 | 4,2->4,2 / 4,8->4,6 | 6,7->6,9 / 8,5->8,3 | 10,5->15,0 / 15,6->20,2 |

Mothlume (cap 96 ban đêm) y hệt: cấp 3 `eff` 0,7: 2,8->2,8; `eff` 0,6: 7,0->9,3. Thoát hẳn (hết 60 s) hầu như không có ở bản mới (0-0,5% ở mọi ô, do người chơi tự kẹt cây khi đuổi thẳng, không phải do thú).

Vậy **mức giá của chạy thông minh chỉ lộ ra khi người chơi đuổi chậm hơn 65% (104 px/s)**, và ở đó nó thêm 25-40% (cấp 3: 6,3 -> 8,0 s). Vì ở `eff` 0,6 thú nhanh bằng người chơi, kẹt cây từng là thứ duy nhất cho người chơi đuổi kịp; mất nó thì chạy đúng như thiết kế (bám chậm hơn thú thì không bắt được).

### Vũ khí (voltmouse cấp 3, TB giây, cũ -> mới, `eff` 1,0 / 0,7)

| Vũ khí | `eff` 1,0 | `eff` 0,7 |
|---|---|---|
| tay không | 2,15 -> 2,07 | 2,56 -> 2,41 |
| gậy | 2,07 -> 1,92 | 3,00 -> 2,47 |
| kiếm | 1,45 -> 1,52 | 1,57 -> 1,60 |
| giáo | 2,80 -> 2,07 | 3,19 -> 2,25 |
| ná | 3,30 -> 3,30 | 3,37 -> 3,95 |

Giáo và gậy còn nhanh hơn một chút vì thú không còn kẹt rồi chạy dọc theo đường mà tầm dài vẫn với tới; ná chậm thêm 0,6 s ở `eff` 0,7 (nhiễu và tầm 150 px giữ thú trong tầm cả hai bản, nên vẫn trong dải mục tiêu).

### Quét tham số (trận có kẹt / tick kẹt còn lại, voltmouse cấp 5, `eff` 1,0, gộp đồng cỏ + đầm lầy + đảo; "đổi hướng gắt" = quyết định mà hướng đổi hơn 69° so với lần trước; "dự phòng" = quyết định phải mở rộng ra toàn vòng)

Cơ sở: `half` 70, `n` 9, `look` 96, `wClear` 1, `hold` 250. Hôm nay: kẹt 5,9% (đồng cỏ), 14,7% (đầm lầy), 36% (đảo) tick chạy.

| Biến thể | Tick kẹt còn lại (đồng cỏ / đầm lầy / đảo) | Đổi hướng gắt (đồng cỏ / đầm lầy) | Dự phòng (đồng cỏ / đầm lầy) | Hạ gục TB (s) |
|---|---|---|---|---|
| **cơ sở** | 0,0 / 0,1 / 0,0% | 0,9% / 2,9% | 1,4% / 3,8% | 2,9-3,0 |
| `half` 45 | 0,0 / 0,0 / 0,0% | 1,2% / 2,4% | 2,2% / 5,8% | 2,9-3,1 |
| `half` 90 | 0,1 / 0,0 / 0,0% | 0,8% / 2,9% | 1,0% / 3,0% | 2,9-3,0 |
| `n` 5 | 0,0 / 0,0 / 0,0% | 1,6% / 3,9% | 2,1% / 5,4% | 2,9 |
| `n` 7 | 0,0 / 0,0 / 0,0% | 1,2% / 3,6% | 1,5% / 5,2% | 3,0 |
| `n` 13 | 0,0 / 0,1 / 0,0% | 0,9% / 3,1% | 1,0% / 3,9% | 2,9 |
| `look` 64 | 0,0 / 0,0 / 0,0% | 0,9% / 3,7% | 1,1% / 4,2% | 2,9-3,0 |
| `look` 128 | 0,0 / **0,5** / 0,0% | 0,8% / 3,2% | 1,3% / 5,3% | 3,0 |
| `look` 160 | **0,4 / 0,7 / 0,6%** | 1,2% / 4,2% | 2,2% / 7,2% | 2,9 |
| `wClear` 0 (chỉ căn hướng) | 0,0 / 0,0 / 0,0% | 1,8% / 3,3% | 1,9% / 4,0% | 2,9-3,0 |
| `wClear` 0,5 | 0,0 / 0,1 / 0,0% | 1,3% / 2,9% | 1,5% / 4,0% | 3,0 |
| `wClear` 2 | 0,1 / 0,0 / 0,0% | 0,8% / 2,8% | 1,0% / 3,2% | 2,9-3,0 |
| `hold` 0 / 150 / 400 | 0,0-0,2% | 1,1% / 2,9-3,2% | 1,5-1,6% / 4,0-4,5% | 2,9-3,0 |

Thời gian giữ hướng (đổi hướng quá 20°, mỗi giây thú chạy, đầm lầy): 0 ms 0,98 lần/s; 100 ms 0,63; **250 ms 0,50**; 400 ms 0,48. Giữ 250 ms đã hết phần rung có thể bỏ được, 400 ms không thêm lợi mà thú chạy thẳng vào cây lâu hơn 150 ms (14 px ở 96 px/s).

Chi phí: một lần chọn hướng (9 mẫu x 96 px) khoảng 4,2 us trên máy này, mỗi 250 ms mỗi thú đang chạy; 80 thú hoang tối đa, thực tế vài thú chạy cùng lúc: không đáng kể.

### Đọc bảng quét

- TTK không phân biệt được các biến thể (mọi ô 2,9-3,1 s, sai số mẫu ±0,1), nên chọn tham số theo số kẹt còn lại, rung, và độ dự phòng.
- `look` dài quá (128-160) hại: vượt quá phần đường thú thực sự chạy trước khi đòn kế đặt lại hướng (2,5 s x 96 = 240 px chỉ trong trường hợp không bị đánh lại), chọn hướng theo chỗ thoáng ở xa mà cây sát chân vẫn cản. 64-96 đều 0% kẹt; 96 chọn vì 1 s đường chạy ở 96 px/s và 6 ô nav.
- `half` 45 khiến dự phòng gấp đôi ở đầm lầy (5,8%), `half` 90 chỉ bớt dự phòng 0,8 điểm phần trăm mà thú chạy lệch ngang nhiều hơn; 70 như đề bài là hợp lý.
- `n` 5 rung nhiều hơn (3,9%), `n` 9 và 13 như nhau: lấy 9 (bước 17,5°).
- `wClear` 0 vẫn hết kẹt vì `lineClear` đã loại hướng chặn; `wClear` 1-2 chỉ bớt dự phòng/rung một chút. Chọn 1 cho hướng lệch ít hơn.

## Đề xuất

Mục tiêu và vì sao (dải mục tiêu, giữ nguyên so với T27):
- Tay không, cấp 3: hạ gục TB **2-3 s**, p90 không quá 1,5 x mức "đứng yên"; cấp 8: không quá 5 s. Đó là mốc "người mới hạ thú thường cấp thấp trong vài đòn" và khớp các thú cùng cấp (T27: leafkit 2,4 s, pebblet 4,0 s).
- Giữ trong dải này cho người chơi bám từ 70% tốc độ (112 px/s) trở lên (joystick cảm ứng, vòng cây): bản đề xuất đạt (cấp 3: 2,3-2,9 s, cấp 8: 4,1-5,0 s).
- Phần chậm hơn 65% là người chơi không thể đuổi kịp một con vật bằng tốc độ của nó, không phải lỗi cân bằng.

**Không đổi `WILD_FLEE_SPEED_CAP` (96) và `FLEE_MS` (2500).** Lý do: bảng 1 và 2 cho thấy chạy thông minh với cap 96 giữ nguyên TTK ở mọi cấp, vũ khí và `eff` >= 0,7. Hạ cap xuống 90 chỉ đổi 0,1 s và làm thú chậm hơn leafkit; nâng thời gian chạy thì làm thú không còn bị đánh liên tục.

### Giá trị cần thêm

Bảng hằng số mới trong `packages/shared/src/combat.ts` (hoặc server, cạnh `stepFlee`, nhưng test cần import được) theo "số liệu cân bằng nằm trong bảng hằng số":

| File | Khoá | Cũ -> mới | Ý nghĩa |
|---|---|---|---|
| `packages/shared/src/combat.ts` | `FLEE_STEER.halfAngleDeg` | (không có) -> 70 | lệch tối đa so với hướng thẳng ra xa |
| | `FLEE_STEER.samples` | -> 9 | số hướng lấy mẫu, đều trong `[-70°, +70°]` (bước 17,5°, gồm hướng 0°) |
| | `FLEE_STEER.lookaheadPx` | -> 96 | độ dài đoạn kiểm tra `lineClear` và điểm đo `clearanceAt` |
| | `FLEE_STEER.alignWeight` | -> 1 | trọng số `cos(lệch)` |
| | `FLEE_STEER.clearanceWeight` | -> 1 | trọng số `min(clearanceAt, 64) / 64` (dùng `NAV_MAX_CLEARANCE`) |
| | `FLEE_STEER.holdMs` | -> 250 | giữ hướng; chọn lại khi hết giờ giữ, hoặc khi `fleeing` được đặt lại bởi đòn mới |
| | `FLEE_STEER.fallbackSamples` | -> 16 | khi cả 9 hướng bị chặn: lấy mẫu toàn vòng 360° (bước 22,5°) cùng tiêu chí; vẫn không có thì chạy thẳng như `stepFlee` hôm nay |

Chi tiết cần coder lưu ý, rút từ mô phỏng:
- Thân chạm (`body`) dùng `{ radius: species.size, sea: false }` để `lineClear` loại cả hướng ra biển; **không** tính biển trong `clearanceAt` (nó không biết biển), nên điểm chỉ làm tăng độ thoáng cây, còn biển do `lineClear` loại.
- Hướng giữ tính theo góc tuyệt đối. Sau khi giữ xong mới tính lại theo vị trí kẻ đánh mới.
- Nhánh `isSea` ở `GameRoom.ts:765` giữ lại làm lưới an toàn; nhưng vì `lineClear` đã loại hướng ra biển trong 96 px, chỉ còn đi vào biển ở dự phòng và khi bị đẩy lùi sát bờ.
- Tránh tạo object mỗi tick: đệm vectơ ứng viên theo từng thú hoặc tính bằng số, vì `GameRoom` chạy 20 tick/s.

### Bảng sau khi đổi (đã đo, tham số đề xuất)

| Chỉ số | Hôm nay | Sau | Mục tiêu |
|---|---|---|---|
| Trận hiền (gộp, cấp 3) có thú đứng ì >= 0,3 s | 26% (đồng cỏ 7-17%, đầm lầy 19-32%, đảo 39-45%) | 0,3% | giảm tối đa |
| Tick chạy bị kẹt (đồng cỏ / đầm lầy / đảo) | 6% / 15% / 36% | 0,0% / 0,1% / 0,0% | ~0 |
| Hạ gục TB gộp, cấp 3, tay không, `eff` 1,0 | 2,63 s | 2,60 s | 2-3 s |
| voltmouse cấp 3, `eff` 0,7 | 2,3 s (p90 2,6) | 2,4 s (p90 2,5) | 2-3 s |
| voltmouse cấp 8, `eff` 0,7 | 4,2 s (p90 4,8) | 4,2 s (p90 4,6) | <= 5 s |
| voltmouse cấp 3, `eff` 0,65 (104 px/s) | 3,6 s (p90 4,7) | 3,6 s (p90 4,5) | giới hạn |
| voltmouse cấp 3, `eff` 0,6 | 6,3 s (p90 9,7) | 8,0 s (p90 10,8) | ngoài dải, chấp nhận được |
| Đổi hướng quá 20° mỗi giây chạy (đầm lầy) | 0 | 0,50 | thấp |
| Dự phòng toàn vòng / lần chọn | n/a | 1,4% (đồng cỏ), 3,8% (đầm lầy) | thấp |

## Rủi ro

- **Không đổi cân bằng chiến đấu.** TTK, kinh nghiệm/giờ và bắt thú gần như không đổi (bảng 1), nên không cần chỉnh `finishXp`, `captureChance`, `FLEE_MS`, tầm đánh, hay đẩy lùi.
- **Biên an toàn của cap 96 là biên duy nhất cần theo dõi.** Dưới `eff` 0,65 (104 px/s) chạy thông minh làm voltmouse và mothlume khó bắt hơn 25-40% (cấp 3: 6,3 -> 8,0 s). Nếu playtest cảm ứng cho thấy người mới thường chỉ đạt dưới 65% tốc độ (khó đoán, mô phỏng giả định đuổi thẳng), hạ cap xuống 0,55 x 160 = 88 làm voltmouse dưới 0,6 nhưng cũng đồng nghĩa leafkit (90) bị cap theo; việc đó nên làm riêng trong PLAN, không trong T57.
- **Mô phỏng là cận trên về độ dễ.** Người chơi chạy thẳng không biết né cây; thú đứng yên sau khi hết chạy (thực tế đi dạo thêm vài chục px); không chí mạng (12% x 1,6 giảm vài đòn); không thú đi theo (190 px/s đuổi kịp mọi tốc độ chạy). Cả hai bản dùng chung giả định nên so sánh trước/sau vẫn đáng tin.
- **Thú hung dữ, đầu đàn và trùm không bị ảnh hưởng:** chỉ `stepFlee` và nhánh `from` ở `GameRoom.ts:760-770` đổi; `stepChase` và các `WILD_CHASE_SPEED_FACTOR` còn lại giữ nguyên. Thú hiền thoát khỏi bóng (`breakOut`) dùng cùng đường nên được hưởng.
- **Biển và thế giới nhỏ:** thú ở đảo nhỏ hoặc mũi đất có thể hết hướng thoáng trong ±70° (dự phòng 2-6% lần chọn): chúng sẽ chạy vòng (có thể ngang qua người chơi) hoặc chạy thẳng như cũ; đó là hành vi "bị dồn vào góc" chấp nhận được.
- **Test có thể phải sửa hoặc thêm:**
  - `GameRoom.test.ts:2170` ("passive pals run away when hit", leafkit, cách xa > 100 px sau 20 tick): chưa chạy lại; trên đất trống hướng chọn gần 0° nên kết quả dự kiến giữ nguyên, nhưng cần chạy để xác nhận (hướng lệch làm khoảng cách tăng chậm hơn).
  - Test của `stepFlee` (nếu có) cần chữ ký mới (cần `NavGrid`); thêm test mới: thú cạnh cây chạy lách về phía thoáng; thú đứng ở bờ biển (biển ngay sau lưng) chạy dọc bờ chứ không đứng; hướng giữ 250 ms không đổi; khi cả 9 hướng bị chặn dùng dự phòng; `lineClear` chặn hướng ra biển.
  - `pathing.test.ts:309` (tầm `max` 648 px) không bị ảnh hưởng vì dùng `WILD_CHASE_SPEED_FACTOR`.
