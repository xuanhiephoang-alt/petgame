# BALANCE: T32 - ăn quả mọng không có hồi chiêu (bấm liên tục là bất tử?)

Phương pháp: đọc code thật, rồi mô phỏng ngoài repo (thư mục tạm, bước 50 ms) người chơi đứng yên không giáp, bấm ăn ngay khi sẵn sàng và máu <= 80, kho quả mọng không giới hạn (cận xấu nhất). DPS lấy từ thời gian trụ sau T7 trong `git show 680d685:BALANCE.md` (bảng "sau khi đổi", đã gồm cú cắn + chiêu): DPS = 100 / thời gian trụ 1 thú không giáp. `wildDamage` đo lại bằng `packages/shared/src/combat.ts` hiện tại (hệ số 0,08). Hạn chế: không tính hồi tự nhiên 4/giây, thú đi theo, giáp (giáp chỉ làm DPS nhỏ đi, tức ăn mạnh hơn so với bảng).

## Hiện trạng

**Code (file nguồn)**
- `GameRoom.ts:1118` `eat()`: từ chối khi `berries <= 0` ("Hết 🫐 quả mọng") hoặc `hp >= maxHp` ("Máu đang đầy"); còn lại trừ 1 quả, `hp += BERRY_HEAL`. **Không có hồi chiêu, không giới hạn tần suất tin** (`onMessage(ClientMessage.Eat)` dòng 380).
- `combat.ts`: `BERRY_HEAL = 20`, `PLAYER_MAX_HP = 100` (không tăng theo cấp), `REGEN_DELAY_MS = 5000`, `REGEN_PER_SECOND = 4`. `tickRegen` (`GameRoom.ts:1784`): hồi 4/giây chỉ khi `hp < maxHp` và đã 5 giây không bị đánh; vì thế **trong trận hồi tự nhiên = 0, ăn là nguồn hồi duy nhất**.
- Nguồn quả: bụi cây 2-4 quả (trung bình 3, `harvest` dòng 1905), 30 bụi mọc lại sau 90 giây (`FRUIT_REGROW_MS`; tối đa khoảng 1 quả/giây cho cả bản đồ, 5 người); rương 3-10 (+0-4 vùng xa) quả; nhiệm vụ 5 + 6 + 10 + 10 = 31 quả cộng dồn (`quests.ts`); trùm 10 quả (`BOSS.reward`); thú đi làm sinh quả. Giá: bánh 8 quả (T4), áo ấm 8, giáp da 12, nón lá 3. Một quả = 20 máu = 1/5 thanh máu, tức 1,5-2 cú cắn của thú vùng giữa.

**Sát thương mỗi giây (người chơi đứng yên, không giáp, 1 thú) và hồi từ ăn**

| Trận | Cú cắn (cấp) | DPS | Hồi tối đa từ ăn hiện nay |
|---|---|---|---|
| cỏ, emberpup 6 | 10 | 10,4 | không giới hạn (bấm 5/giây = 100 máu/giây) |
| núi lửa, boulderhorn 11 | 18 | 22,7 | như trên |
| sa mạc, scorchtail 10 | 15 | 17,2 | như trên |
| tuyết, frostfang 11 | 16 | 18,9 | như trên |
| đầm lầy, cactoad 11 | 14 | 15,6 | như trên |
| đảo, coralcrab 13 | 20 | 19,6 | như trên |
| đầu đàn voltmouse 15 | 11 | 16,4 | như trên |
| đầu đàn coralcrab 22 | 27 | 31,3 | như trên |
| trùm Boulderhorn | cắn 14 / dậm 18 / chiêu | 14,3 | như trên |

**Bất tử được không: có.** Giới hạn duy nhất là số quả: bấm 4-5 lần/giây (hoặc giữ phím nếu OS lặp phím) hồi 80-100 máu/giây, gấp 3,5-10 lần DPS bất kỳ trận nào. Mỗi quả là 20 máu, nên người có 15 quả mang theo 300 máu thêm và có thể đứng yên đỡ đòn: mô phỏng không hồi chiêu, kho vô hạn sống > 120 giây ở mọi trận kể cả đầu đàn cấp 22 (31 DPS); khi hết quả thì chết như cũ. Tức là chỉ tốn khoảng 30 quả (10 bụi) cho một trận đầu đàn hoặc trùm, đánh bại cả ý nghĩa của T7 (thời gian trụ 3-7 giây). Tệ hơn, 85-136 quả/120 giây là giá phải trả nhưng quả là tài nguyên mọc lại (30 bụi/90 giây) và nhiệm vụ đã cho 31 quả.

## Vấn đề

1. Hồi 20 máu mỗi lần bấm không bị chặn, nên sát thương của T7 (cú cắn <= 20, đầu đàn <= 27, đỉnh chiêu <= 33) chỉ còn là "tốn bao nhiêu quả", không còn là "né hay chết".
2. Hồi tối đa (>= 80/giây) lớn hơn DPS đỉnh (31) hơn 2,5 lần: ăn thay hẳn việc né, đúng thứ mục tiêu T32 cấm.
3. Số quả tích được (nhiệm vụ 31 + trùm 10 + rương) khiến "bất tử" có sẵn ngay từ giữa game mà không cần giáp.

## Đề xuất

**Giữ `BERRY_HEAL = 20`** (đổi giá trị khiến test `GameRoom.test.ts:604` và mô tả hiện có lệch; 1/5 thanh máu là mức dễ hiểu; điều chỉnh bằng hồi chiêu mới là đủ). Thêm hồi chiêu ăn, server kiểm, tính từ lần ăn thành công trước (không tính lần bị từ chối).

| Việc | File, khoá | Cũ -> Mới |
|---|---|---|
| Hồi chiêu ăn | `packages/shared/src/combat.ts`: thêm `EAT_COOLDOWN_MS` | không có -> **4000** |
| Kiểm ở server | `GameRoom.ts` `eat()` và `Map` hồi chiêu ăn theo `sessionId` (không đưa vào schema) | kiểm sau khi qua hai điều kiện từ chối cũ |
| Giữ nguyên | `BERRY_HEAL` 20, `REGEN_*`, giá bánh 8 quả, máu người chơi | không đổi |

Hồi tối đa từ ăn = 20 / 4 giây = **5 máu/giây** (lần đầu ăn ngay khi cần, nên có "cứu nguy" tức thời). Lý do chọn 4000 thay vì 3000 hoặc 5000: 5 máu/giây thấp hơn DPS thấp nhất của mọi trận đang có (10,4 cỏ), bằng 22-48% DPS của một thú hoang và 16-35% của đầu đàn/trùm; người đứng yên vẫn chết, người biết né mới thắng. 3000 (6,7/giây) làm đầu đàn voltmouse với người né 50% hầu như không chết trong 51 giây; 5000 (4/giây, bằng đúng hồi tự nhiên) khiến ăn gần như vô nghĩa giữa trận (một cú cứu nguy 20 máu mỗi 5 giây).

**Bảng sau khi đổi: người đứng yên + ăn mỗi 4 giây (chưa né), thời gian sống / số quả dùng** (cũ: > 120 giây, kho vô hạn)

| Trận | DPS | Hồi ăn/giây, % DPS | Sống (cũ -> mới) | Quả dùng |
|---|---|---|---|---|
| cỏ, emberpup 6 | 10,4 | 5,0 (48%) | > 120 -> 17 s (không ăn 9,6 s) | 4 |
| núi lửa, boulderhorn 11 | 22,7 | 5,0 (22%) | > 120 -> 6 s (4,4 s) | 2 |
| sa mạc, scorchtail 10 | 17,2 | 5,0 (29%) | > 120 -> 8 s (5,8 s) | 2 |
| tuyết, frostfang 11 | 18,9 | 5,0 (26%) | > 120 -> 7 s (5,3 s) | 2 |
| đầm lầy, cactoad 11 | 15,6 | 5,0 (32%) | > 120 -> 9 s (6,4 s) | 2 |
| đảo, coralcrab 13 | 19,6 | 5,0 (26%) | > 120 -> 7 s (5,1 s) | 2 |
| đầu đàn voltmouse 15 | 16,4 | 5,0 (30%) | > 120 -> 9 s (6,1 s) | 2 |
| đầu đàn coralcrab 22 | 31,3 | 5,0 (16%) | > 120 -> 4 s (3,2 s) | 1 |
| trùm Boulderhorn | 14,3 | 5,0 (35%) | > 120 -> 11 s (7 s) | 3 |

**Người biết né (né một nửa số đòn, DPS giảm 50%), ăn mỗi 4 giây, trận 60 giây**

| Trận | DPS sau né | Kết quả (hồi chiêu 4 s) | Hồi chiêu 3 s | Hồi chiêu 5 s | Không hồi chiêu (cũ) |
|---|---|---|---|---|---|
| cỏ emberpup 6 | 5,2 | sống, 14 quả | sống | sống, 12 quả | sống |
| núi lửa boulderhorn 11 | 11,4 | chết ở 16 s | 19 s | 14 s | sống |
| sa mạc scorchtail 10 | 8,6 | chết ở 26 s | 42 s | 21 s | sống |
| tuyết frostfang 11 | 9,4 | chết ở 21 s | 32 s | 17 s | sống |
| đầm lầy cactoad 11 | 7,8 | chết ở 31 s | sống | 26 s | sống |
| đảo coralcrab 13 | 9,8 | chết ở 20 s | 29 s | 16 s | sống |
| đầu đàn voltmouse 15 | 8,2 | chết ở 29 s | 51 s | 22 s | sống |
| đầu đàn coralcrab 22 | 15,6 | chết ở 9 s | 10 s | 9 s | sống |
| trùm Boulderhorn | 7,1 | chết ở 39 s | sống | 28 s | sống |

Đọc bảng: né 50% là mức trung bình; thú hoang vùng giữa phải đánh trả chứ không hạ trong 3-6 giây của T7 mà thành 16-31 giây, mà người chơi lại hạ được thú trong 3-5 giây (kiếm 40 sát thương/giây). Muốn thắng trận kéo dài 40-60 giây (trùm có 4 lần máu, đầu đàn có 3 lần) phải né nhiều hơn 50% (né 70% thì DPS trùm 4,3 < 5 hồi ăn, sống vô hạn nếu còn quả; thực tế tốn 1 quả/4 giây = 10-15 quả cho 60 giây, tức 4-5 bụi, đáng giá bằng một chuyến thu hoạch hoặc rương). Vì vậy ăn giữa trận vẫn đáng dùng (cứu nguy khi máu <= 30, kéo dài 30-40%), nhưng không thể thay việc né.

## Rủi ro

- **Test cần sửa/thêm**: `GameRoom.test.ts:604` ("eating a berry heals") chỉ ăn 1 lần: vẫn đúng. `GameRoom.test.ts:1153` kiểm từ chối "Máu đang đầy" ở đầy máu: vẫn đúng nếu thứ tự kiểm là hết quả -> đầy máu -> hồi chiêu. Thêm test tích hợp: ăn 2 lần liền thì lần hai bị từ chối và không trừ quả; sau `EAT_COOLDOWN_MS` ăn được; hồi chiêu theo từng người chơi; lần bị từ chối (hết quả, đầy máu) không đặt lại hồi chiêu. Dùng `this.clock`/thời gian mô phỏng của `ticks(room, n)` thay vì giờ thực (4000 ms = 80 tick).
- **e2e**: `multiplayer.spec.ts:238` (bấm `.eat-btn` ở đầy máu, chờ "quả mọng|Máu đang đầy") và `:1490` (phím `h`, chờ "Máu đang đầy|Hết 🫐 quả mọng", đúng 2 toast đang hiện) vẫn đúng nếu thứ tự kiểm ở trên được giữ (đầy máu từ chối trước hồi chiêu). Nếu lần bị từ chối vì hồi chiêu phát thông báo "refused", test toast có thể thêm một toast không mong muốn khi máu chưa đầy: nên **không phát toast khi từ chối vì hồi chiêu** (nút đã hiện hồi chiêu), hoặc phát với mức thấp. Dòng `:1102` bấm `h` trong chuỗi phím ở đầy máu: không ảnh hưởng.
- **HUD** (`packages/client/src/ui/hud.ts:39`, nút `.eat-btn` "🫐 Ăn", phím H ở `Game.ts:306`): cần hiện hồi chiêu trên nút (ví dụ nền dần đầy hoặc số giây còn lại, nút vô hiệu hoá khi đang hồi chiêu cho cảm ứng lẫn phím), vẫn >= 44x44 px trên điện thoại (hiện `min-height` 28-30 px, thấp hơn quy ước). Cần đưa thời điểm sẵn sàng xuống client: thêm trường vào schema `Player` (đổi giao thức, cập nhật server và client cùng nhiệm vụ) hoặc client tự đếm 4 giây sau khi thấy máu/quả mọng thay đổi (không đồng bộ khi mạng trễ nhưng không đổi giao thức). Cập nhật `eat.title` ("Ăn 1 quả mọng để hồi 20 máu, hồi chiêu 4 giây").
- **Hệ khác**: không đổi kinh tế quả (bánh 8 quả, giáp 12 quả) nên không đụng T4; giáp vẫn có giá trị vì làm giảm DPS trong khi hồi ăn cố định (giáp 30% làm hồi ăn bằng 69% DPS cỏ thay vì 48%, vẫn không bất tử). Thú đi theo không dùng quả. Trùm/đầu đàn không đổi, không cần chỉnh lại số T7. Nếu sau thử thấy quá khắc nghiệt ở trùm, hạ `EAT_COOLDOWN_MS` về 3000 (bảng trên) trước khi động vào `BERRY_HEAL`.
- **Tài liệu**: `docs/design/hud.md` nếu nhắc nút Ăn; ghi mốc 4 giây.
