# BALANCE: T4 — Lên cấp có quá chậm so với hệ thống chiêu? (chiêu 2 ở cấp 7, chiêu 3 ở cấp 15)

Tóm tắt:
- "Hơn 200 đòn trúng" trong T4 là con số lệch: mỗi trận (hạ gục hoặc bắt một thú hoang) cho thú đi theo 16-53 XP (trung bình 31, đo trên `GameRoom` thật), nên cấp 7 (859 XP) cần khoảng 27 trận, không phải 215 đòn.
- Chiêu 2 gần đạt mục tiêu (cuối buổi đầu với người chơi 30 trận/buổi, sang buổi 2 với người chơi 20 trận). Chiêu 3 mới là vấn đề thật: cấp 15 cần khoảng 210 trận, tức 7 buổi 40 phút ở nhịp 30 trận/buổi.
- Hai chỗ lệch thiết kế quan trọng hơn con số: XP hạ gục/bắt không tính theo cấp thú bị hạ, và bánh quả mọng cho 10 XP mỗi quả, nhanh gấp 2,5-7,5 lần săn thú đối với ai có trại.
- Đề xuất: `xpToNext` hệ số 20 -> 13, XP hạ gục/bắt tăng 10% mỗi cấp thú bị hạ, bánh tốn 8 quả thay vì 4, thêm 3 bánh thưởng nhiệm vụ và 250 XP khi hạ trùm. Cấp 7 còn 15 trận (20 phút ở nhịp bình thường), cấp 15 còn 116 trận (3,9 buổi).
- Không chia XP cho thú không đi theo; không đổi cách tính XP theo từng mục tiêu trúng chiêu. Hồ sơ cũ đọc được, không ai tụt cấp (tối đa +1 cấp khi nạp).

## Hiện trạng

### Cách đo và giả định

- Công thức đọc từ code: `progression.ts`, `combat.ts`, `skills.ts`, `capture.ts`, `elements.ts`, `work.ts`, `crafting.ts`, `quests.ts`, `alphas.ts`, `boss.ts`, `treasure.ts`, `worldgen.ts` (`dangerAt`) và `GameRoom.ts` (`tickCompanions`, `handleThrow`, `knockOut`, `land`, `feed`, `grantXp`, `defeatBoss`).
- Mô hình một trận (người chơi + thú đi theo đánh 1 thú hoang) chạy từng tick 50 ms, dùng đúng hàm shared (`companionDamage`, `skillPower`, `hitWildPal`, `captureChance`, `chooseSkill` của server...) và hằng số server (đòn thú đi theo 900 ms, nghỉ giữa chiêu 1,5 s, choáng 6 s, bóng 1,9 s...). Hình học (đi lại, thú bỏ chạy) được gộp vào một hệ số "tỉ lệ đánh thực tế" = 0,7 của nhịp vũ khí.
- Kiểm chứng: bot chơi trên `GameRoom` thật (192 lần = 48 ô × 4: thú đi theo cấp 1/7/15 vs 8 loại-cấp thú hoang, hạ gục và bắt). XP mỗi trận: bot 31,0 so với mô hình 30,4 (lệch trung bình 1,1 XP). Thời gian làm choáng: lệch 0,2 s, trừ Voltmouse (xem Ghi chú cuối). Script chạy từ thư mục tạm, không thêm vào repo.
- "Trận" = một thú hoang bị hạ gục hoặc bắt khi thú đi theo có mặt, 50/50 hạ gục và bắt. Nhịp chơi tính theo trận mỗi phút của cả buổi (gồm đi lại, dựng trại, chế tạo): thong thả 0,5 (20 trận/buổi 40 phút), bình thường 0,75 (30 trận), tích cực 1,5 (60 trận), cày 6 (cực đoan, thú nằm ngay cạnh). Đây là giả định, chưa có số liệu người chơi thật; bảng có ghi cả số trận để thay nhịp khác.
- "Đường chuẩn": cấp 1-4 đồng cỏ 70% + vùng ngoài 30%; cấp 5-9 vùng ngoài (tuyết, sa mạc, đầm lầy, núi lửa); cấp 10-14 vùng ngoài 60% + đảo 40%; cấp 15+ vùng ngoài 50% + đảo 50%. Chưa tính 3-5 phút đầu để bắt con thú đầu tiên (chưa có thú đi theo thì chưa có XP).

### 1. Đường cong (`progression.ts`)

`xpToNext(L) = round(20 · L^1,5)`; `addXp` cộng dồn, có thể lên nhiều cấp một lần, cấp 30 thì xp về 0. `xp` lưu trong hồ sơ là phần dư trong cấp hiện tại.

| Cấp L -> L+1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 14 | 15 | 20 | 29 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `xpToNext` | 20 | 57 | 104 | 160 | 224 | 294 | 370 | 632 | 1048 | 1162 | 1789 | 3123 |

XP cộng dồn để tới cấp: 3 = 77, 5 = 341, 7 = 859, 10 = 2.222, 15 = 6.400, 20 = 13.427, 30 = 37.806.

### 2. Nguồn kinh nghiệm và ai nhận

Chỉ thú trong túi người chơi có XP; người chơi không có cấp. Không có chia sẻ XP cho thú không đi theo.

| Nguồn | Hằng số | Giá trị | Chỗ cộng (`GameRoom.ts`) | Ai nhận |
|---|---|---|---|---|
| Đòn thường của thú đi theo trúng | `XP_PER_HIT` | 4 mỗi 900 ms (khi mục tiêu chưa choáng) | `tickCompanions` :820 | chính thú đang đánh |
| Chiêu trúng | `XP_PER_HIT` | 4 mỗi lần tung có ít nhất 1 mục tiêu trúng (không nhân theo số mục tiêu) | `land` :1459 | thú tung chiêu |
| Hạ gục thú hoang | `XP_PER_KNOCKOUT` | 12, không phụ thuộc cấp thú bị hạ | `knockOut` :1168 | thú đi theo của người ra đòn kết liễu (không có thú đi theo thì mất) |
| Bắt thú | `XP_PER_CAPTURE` | 25, không phụ thuộc cấp | `handleThrow` :918 | thú đi theo của người ném (con bắt đầu tiên tự đi theo nên không nhận) |
| Thú đầu đàn | `ALPHA.xp` | 300 (hạ gục thay cho 12; bắt: cộng thêm sau khi bóng khép, :927) | :1168, :927 | thú đi theo |
| Thú làm việc | `XP_PER_WORK` | 2 mỗi món, chỉ khi người chơi online (sản xuất lúc vắng mặt không có XP, :522-531) | `tickCompanions` :774 | chính thú làm việc |
| Bánh quả mọng | `SNACK_XP` | 40, bất kỳ thú nào trong túi, không giới hạn số lần | `feed` :1096 | thú người chơi chọn |
| Nhiệm vụ | không có | chỉ cho vật phẩm; cả chuỗi có 8 bánh = 320 XP (8 nhiệm vụ đầu: 3 bánh = 120 XP) | `quests.ts` | - |
| Hạ trùm | không có | chỉ cho đồ (`defeatBoss` :1593); XP duy nhất là các đòn trúng trong trận | - | - |
| Rơi đồ | - | thú bị hạ rơi bánh 10% (`combat.ts:94`), rương 15% (`treasure.ts:33`), đầu đàn +2 bánh | - | - |

### 3. Một trận kéo dài bao lâu, cho bao nhiêu XP (cơ chế hiện tại)

Thú hoang cấp 1 + `floor(roll² · M)`, M = `wildMaxLevel`: đồng cỏ 6-8, vùng ngoài 7-11, đảo 10-13. Cấp trung bình của thú hoang: đồng cỏ 2,8; vùng ngoài 3,5-3,7; đảo 4,7.

| Vùng | Cấp thú đi theo | XP/trận hạ gục | XP/trận bắt | Làm choáng (s) |
|---|---|---|---|---|
| Đồng cỏ | 1 / 7 / 15 | 24 / 22 / 19 | 37 / 35 / 32 | 2,1 / 1,7 / 1,4 |
| Vùng ngoài | 1 / 7 / 15 | 29 / 25 / 21 | 42 / 38 / 34 | 3,1 / 2,4 / 1,7 |
| Đảo | 1 / 7 / 15 | 29 / 25 / 21 | 42 / 38 / 34 | 3,0 / 2,3 / 1,7 |

- Nhịp: người chơi 1 đòn mỗi 0,4 s (tay không 10 sát thương, kiếm 16 mỗi 0,42 s); thú đi theo 1 đòn mỗi 0,9 s và 1 chiêu mỗi 5-12 s tùy chiêu (gồng 0,25-0,7 s đứng yên, nghỉ 1,5 s sau mỗi chiêu); thú hoang choáng 6 s ở 1 HP.
- Hạ gục thêm khoảng 0,5 s sau khi choáng; bắt thêm khoảng 2 s (bóng 1,9 s). Khoảng 40-50% XP mỗi trận là từ đòn của thú (khoảng 1-4 đòn thường + 1 chiêu), phần còn lại là XP kết liễu 12/25.
- XP mỗi trận gần như phẳng theo cấp thú đi theo (31 -> 25 từ cấp 1 đến 20): thú đi theo mạnh hơn thì trận ngắn hơn, ít đòn hơn.
- Bot trên server thật: 16-53 XP mỗi trận (hạ gục thú cấp 1 = 16; bắt Frostfang cấp 8 = 52).
- Vì vậy cấp 7 = 859 XP khoảng 27 trận, và số trận cho mỗi cấp tăng từ 0,6 (cấp 1) lên 36 (cấp 14) và 67 (cấp 20).

### 4. Cần bao nhiêu trận, mất bao lâu (hiện tại, đường chuẩn)

| Cấp | XP cộng dồn | Trận | Thong thả 0,5/ph | Bình thường 0,75/ph | Tích cực 1,5/ph | Cày 6/ph |
|---|---|---|---|---|---|---|
| 5 | 341 | 11 | 22 ph | 15 ph | 7 ph | 2 ph |
| 7 | 859 | 27 | 54 ph | 36 ph | 18 ph | 4 ph |
| 10 | 2.222 | 70 | 2,3 giờ | 93 ph | 47 ph | 12 ph |
| 15 | 6.400 | 210 | 7,0 giờ | 4,7 giờ | 2,3 giờ | 35 ph |
| 20 | 13.427 | 470 | 15,7 giờ | 10,4 giờ | 5,2 giờ | 78 ph |

Theo buổi 40 phút (20 / 30 / 60 trận mỗi buổi): cấp 7 sau 1,3 / 0,9 / 0,4 buổi; cấp 10 sau 3,5 / 2,3 / 1,2 buổi; cấp 15 sau 10,5 / 7,0 / 3,5 buổi; cấp 20 sau 23,5 / 15,7 / 7,8 buổi.
Đường chỉ ở đồng cỏ: 11 / 29 / 78 / 233 / 513 trận tới cấp 5 / 7 / 10 / 15 / 20 (chậm hơn 7-11%).

### 5. Các kênh ngoài chiến đấu và đường tắt

Làm việc (`XP_PER_WORK` = 2, hiện tại):

| Trại | Cấp thú | Món/phút | XP/phút mỗi thú | Phút tới cấp 5 / 7 / 10 / 15 / 20 (chỉ khi online) |
|---|---|---|---|---|
| 1 (3 chỗ) | 1 / 7 / 15 | 6,0 / 8,2 / 12,3 | 12 / 16 / 25 | 25 / 60 / 138 / 334 / 591 |
| 3 (5 chỗ) | 1 / 7 / 15 | 8,6 / 11,7 / 17,6 | 17 / 23 / 35 | 18 / 42 / 97 / 234 / 413 |

Bánh quả mọng (`SNACK_XP` 40, công thức `berry_snack`: 4 quả mọng, `recipes.json`) = 10 XP mỗi quả:
- Loài làm ra quả mọng: Leafkit, Bubbloon, Ripplefin, Cactoad, Bogbloom (`workOutput`). Một thú làm quả ở trại 1 = 6 quả/phút = 60 XP/phút nếu đổi hết; 3 thú = 180 XP/phút; 5 thú ở trại 3 = 429 XP/phút.
- Để so sánh, săn thú ở nhịp thong thả / bình thường / tích cực / cày cho khoảng 16 / 24 / 48 / 190 XP/phút (nhân 32 XP/trận). Vậy với một trại có 1-3 thú làm quả, bánh nhanh hơn săn thú bình thường 2,5-7,5 lần.
- 30 bụi quả ở đồng cỏ mọc lại sau 90 s, mỗi bụi 2-4 quả: một bụi = 30 XP (bằng một trận), quét hết 30 bụi = 90 quả = 900 XP > toàn bộ cấp 7 (859). Tối đa lý thuyết 600 XP/phút.
- Để lên cấp 7 cần 21 bánh (86 quả); cấp 15 cần 160 bánh (640 quả). Vắng mặt tối đa 300 quả mỗi loại (`OFFLINE_MAX_PER_RESOURCE`) = 75 bánh = 3.000 XP.
- Chặn duy nhất là thao tác: mỗi bánh cần 1 lần chế + 1 lần cho ăn (không có nút làm hàng loạt).

Đường tắt "bắt thú cấp cao" (bắt giữ nguyên cấp thú hoang, `handleThrow`):

| Vùng | Thú cấp >= 7 | Thú cấp >= 10 | Tỉ lệ bắt khi đã choáng (bóng thường) |
|---|---|---|---|
| Đồng cỏ | 5% | 0% | 88% |
| Vùng ngoài | 17-20% | 1-3% | 86% |
| Đảo | 30% | 15% (cấp >= 13: 1,6%) | 84-86% |

Cấp 15 thì không có thú thường nào (tối đa 14); chỉ thú đầu đàn (cấp 15-22, đủ 3 chiêu), tỉ lệ bắt khi choáng khoảng 33% mỗi lần ném. Như vậy chiêu 2 đạt được bằng cách bắt sau khoảng 5-6 thú ở vùng ngoài; chiêu 3 chỉ qua lên cấp hoặc qua thú đầu đàn.

### 6. Sức mạnh theo cấp: lên nhanh có làm thú hoang quá dễ không?

Cấp thú đi theo (đòn thường +15%/cấp, chiêu +12%/cấp, máu +20%/cấp), so với người chơi tay không 26,8 DPS, kiếm 40,8 DPS (cả hai gồm bạo kích):

| Cấp | Máu | Đòn thường (DPS) | Chiêu | Số chiêu | Làm choáng thú hoang: đồng cỏ / ngoài / đảo (s) |
|---|---|---|---|---|---|
| 1 | x1,0 | 6 (6,7) | x1,00 | 1 | 2,1 / 3,1 / 3,0 |
| 7 | x2,2 | 11 (12,2) | x1,72 | 2 | 1,7 / 2,4 / 2,3 |
| 15 | x3,8 | 19 (21,1) | x2,68 | 3 | 1,4 / 1,7 / 1,7 |
| 30 | x6,8 | 32 (35,6) | x4,48 | 3 | 1,3 / 1,4 / 1,4 |

Thời gian đưa thú đầu đàn tới 1 HP và hạ trùm (người chơi cầm kiếm; trong ngoặc: tay không), thú đi theo cấp 1 / 7 / 15 / 30:
- Đầu đàn đồng cỏ (Voltmouse cấp 15, 399 HP): 10 / 9 / 6 / 5 s (15 / 11 / 8 / 5 s).
- Đầu đàn tuyết (Frostfang cấp 19, 966 HP): 26 / 21 / 16 / 12 s (37 / 28 / 20 / 14 s).
- Đầu đàn đảo (Coralcrab cấp 22, 1.170 HP): 31 / 26 / 20 / 14 s (44 / 34 / 24 / 17 s).
- Trùm (Boulderhorn cấp 12, 1.152 HP, không choáng): 30 / 25 / 18 / 14 s (43 / 32 / 22 / 16 s).

Kết luận: với thú thường, cấp thú đi theo gần như không đổi độ khó (người chơi tự đánh 27-41 DPS, thú đi theo thêm 7-36 DPS; thú thường choáng trong 1,3-3,1 s ở mọi cấp). Với đầu đàn và trùm, cấp 7 -> 15 rút ngắn trận khoảng 25-30%, cấp 30 còn 1/3-1/2 so với cấp 1. Mốc "vài chục giây" của đầu đàn/trùm giữ được tới khoảng cấp 15-20; ở cấp 30 đầu đàn đồng cỏ chỉ còn 5 s. Vì vậy không nên đưa số đông người chơi tới cấp 20+ trong vài buổi.

## Vấn đề

1. **Con số trong T4 lệch.** XP mỗi trận 25-35 chứ không phải 4 XP mỗi đòn; cấp 7 = khoảng 27 trận. Với người chơi bình thường (30 trận/buổi) chiêu 2 xuất hiện ở cuối buổi đầu; với người thong thả (20 trận/buổi) phải sang buổi 2 (cấp 6,2 sau buổi 1). Mục tiêu "cấp 7 trong buổi đầu" hụt chủ yếu với người chơi ít đánh.
2. **Chiêu 3 thực sự xa.** Cấp 15 = 210 trận = 7 buổi (bình thường), 10,5 buổi (thong thả), gấp đôi mục tiêu "vài buổi" (3-5). Nguyên nhân: đường cong L^1,5 tăng nhanh trong khi XP/trận phẳng, nên trận/cấp tăng từ 0,6 lên 36 ở cấp 14.
3. **XP không thưởng độ khó.** Hạ gục thú cấp 14 (máu x3,6, cắn x2,95) cũng 12 XP như thú cấp 1; thú cấp cao chỉ hơn nhờ trận dài hơn (thêm đòn). Không có lý do để tìm thú mạnh.
4. **Bánh quả mọng lấn át mọi chỉnh sửa khác.** 10 XP/quả: ai có trại và 1-3 thú làm quả có 60-180 XP/phút, gấp 2,5-7,5 lần săn thú bình thường; một lượt quét bụi quả đủ lên cấp 7. Nếu chỉ đổi đường cong, kênh này nhanh thêm 1,5 lần và T4 vẫn "chậm" với người không dùng bánh nhưng "quá nhanh" với người dùng.
5. **Trùm và nhiệm vụ không cho XP.** Trùm là trận lớn duy nhất không có thưởng XP (đầu đàn có 300). Nhiệm vụ cho bánh nhưng người chơi phải tự nhận ra nút "Cho ăn"; chuỗi 11 nhiệm vụ đầu chỉ có 3 bánh.
6. **Vòng bắt - thả (T2) không phải cách cày vượt trội**, nhưng cần giữ điều kiện (xem Đề xuất mục 5): người cày hạ gục liên tục (tìm thú 3 s) nhận 257 XP/phút; bắt khi túi chưa đầy 298 (1,16x); bắt rồi thả (thêm khoảng 5 s bấm bảng Thú) 179 (0,70x).
7. **Thông báo "Học được chiêu mới" mất khi lên nhiều cấp một lần.** `Game.ts:800` chỉ so `newSkillAt(species, cấp cuối)`. Với đường cong rẻ hơn, một cú 300 XP (đầu đàn) từ cấp 6 có thể nhảy qua cấp 7 (cần >= 432 XP; đường cong cũ cần 664 nên không xảy ra).

## Đề xuất

### 1. Thay đổi cụ thể (cũ -> mới)

| # | File | Khoá | Cũ | Mới |
|---|---|---|---|---|
| 1 | `packages/shared/src/progression.ts` | hệ số của `xpToNext` (đang viết cứng trong hàm) | `Math.round(20 * Math.pow(level, 1.5))` | thêm `export const XP_CURVE = 13;` và `Math.round(XP_CURVE * Math.pow(level, 1.5))` |
| 2 | `packages/shared/src/progression.ts` | (mới) XP kết liễu theo cấp thú bị hạ | - | `export const XP_PER_WILD_LEVEL = 0.1;` và `finishXp(base, wildLevel) = Math.round(base * (1 + XP_PER_WILD_LEVEL * (Math.max(1, wildLevel) - 1)))` |
| 3 | `packages/server/src/rooms/GameRoom.ts` `knockOut` (~:1168) | XP hạ gục thú thường | `XP_PER_KNOCKOUT` | `finishXp(XP_PER_KNOCKOUT, pal.level)`; thú đầu đàn vẫn `ALPHA.xp` |
| 4 | `GameRoom.ts` `handleThrow` (~:918) | XP bắt thú thường | `XP_PER_CAPTURE` | `finishXp(XP_PER_CAPTURE, pal.level)`; thú đầu đàn giữ như cũ (`XP_PER_CAPTURE` + `ALPHA.xp` sau khi bóng khép) |
| 5 | `packages/shared/src/boss.ts` + `GameRoom.ts` `defeatBoss` (~:1593) | (mới) `BOSS.xp` | không có | `xp: 250`; trong vòng lặp `winners`, cộng cho thú đi theo của từng người (nếu có) bằng `grantXp` |
| 6 | `packages/shared/src/data/recipes.json` | `berry_snack.cost.berries` | 4 | 8 |
| 7 | `packages/shared/src/quests.ts` | `first_catch.reward` | `{ berries: 5 }` | `{ berries: 5, snacks: 1 }` |
| 8 | `quests.ts` | `snow.reward` | `{ greatBalls: 1 }` | `{ greatBalls: 1, snacks: 1 }` |
| 9 | `quests.ts` | `swamp.reward` | `{ berries: 10 }` | `{ berries: 10, snacks: 1 }` |
| 10 | `packages/server/src/persistence/store.ts` `sanitizeProfile` | xp/cấp sau khi đọc | giữ nguyên số đọc được | gọi `addXp({ level, xp }, 0)` để lên cấp nốt phần XP vượt ngưỡng mới, lưu `level`/`xp` kết quả |
| 11 | `packages/shared/src/messages.ts` `LevelUpMessage` + `Game.ts:795-805` | báo chiêu mới | `newSkillAt(species, msg.level)` | thêm `fromLevel`; báo mọi chiêu học được trong (fromLevel, level] (hiện chiêu cuối cùng trong toast) |

Không đổi: `XP_PER_HIT` 4, `XP_PER_KNOCKOUT` 12 và `XP_PER_CAPTURE` 25 (làm gốc cho thú cấp 1), `XP_PER_WORK` 2, `SNACK_XP` 40 (giữ để chữ "40 kinh nghiệm" trong mô tả công thức còn đúng), `ALPHA.xp` 300, `MAX_LEVEL`, mũ 1,5 của đường cong.

Giá trị kết liễu sau đổi (`finishXp`): hạ gục cấp 1 / 3 / 5 / 8 / 10 / 14 = 12 / 14 / 17 / 20 / 23 / 28; bắt = 25 / 30 / 35 / 43 / 48 / 58.

### 2. Đường cong mới

| Cấp L -> L+1 | `xpToNext` cũ | mới | Cộng dồn cũ | mới | XP/trận cũ | mới | Trận/cấp cũ | mới |
|---|---|---|---|---|---|---|---|---|
| 1 -> 2 | 20 | 13 | 20 | 13 | 32 | 36 | 0,6 | 0,4 |
| 2 -> 3 | 57 | 37 | 77 | 50 | 32 | 35 | 1,8 | 1,0 |
| 4 -> 5 | 160 | 104 | 341 | 222 | 31 | 35 | 5,2 | 3,0 |
| 6 -> 7 | 294 | 191 | 859 | 558 | 33 | 37 | 9,0 | 5,1 |
| 8 -> 9 | 453 | 294 | 1.682 | 1.093 | 32 | 36 | 14,4 | 8,1 |
| 10 -> 11 | 632 | 411 | 2.854 | 1.855 | 31 | 36 | 20,7 | 11,3 |
| 14 -> 15 | 1.048 | 681 | 6.400 | 4.159 | 29 | 35 | 35,7 | 19,4 |
| 20 -> 21 | 1.789 | 1.163 | 15.216 | 9.890 | 27 | 32 | 67,3 | 35,9 |
| 29 -> 30 | 3.123 | 2.030 | 37.806 | 24.572 | 26 | 32 | 121,8 | 64,4 |

### 3. Thời gian tới cấp 5 / 7 / 10 / 15 / 20 sau khi đổi (đường chuẩn)

| Cấp | Trận cũ -> mới | Thong thả 0,5/ph | Bình thường 0,75/ph | Tích cực 1,5/ph | Cày 6/ph |
|---|---|---|---|---|---|
| 5 | 11 -> 6 | 22 -> 13 ph | 15 -> 8 ph | 7 -> 4 ph | 2 -> 1 ph |
| 7 | 27 -> 15 | 54 -> 31 ph | 36 -> 20 ph | 18 -> 10 ph | 4 -> 3 ph |
| 10 | 70 -> 40 | 2,3 giờ -> 79 ph | 93 -> 53 ph | 47 -> 26 ph | 12 -> 7 ph |
| 15 | 210 -> 116 | 7,0 -> 3,9 giờ | 4,7 -> 2,6 giờ | 2,3 giờ -> 77 ph | 35 -> 19 ph |
| 20 | 470 -> 255 | 15,7 -> 8,5 giờ | 10,4 -> 5,7 giờ | 5,2 -> 2,8 giờ | 78 -> 43 ph |

Số buổi 40 phút (20 / 30 / 60 trận mỗi buổi): cấp 7 sau 0,8 / 0,5 / 0,3 buổi (cũ 1,3 / 0,9 / 0,4); cấp 15 sau 5,8 / 3,9 / 1,9 buổi (cũ 10,5 / 7,0 / 3,5); cấp 20 sau 12,8 / 8,5 / 4,3 buổi (cũ 23,5 / 15,7 / 7,8).

Cấp trung bình sau từng buổi (không tính bánh):

| Trận mỗi buổi | Phiên bản | Sau 1 | 2 | 3 | 4 | 6 | 10 buổi |
|---|---|---|---|---|---|---|---|
| 20 | cũ | 6,2 | 8,1 | 9,4 | 10,5 | 12,2 | 14,7 |
| 20 | mới | 7,7 | 10,0 | 11,7 | 13,0 | 15,2 | 18,3 |
| 30 | cũ | 7,3 | 9,4 | 11,0 | 12,2 | 14,2 | 17,0 |
| 30 | mới | 9,0 | 11,7 | 13,6 | 15,2 | 17,6 | 21,2 |
| 60 | cũ | 9,4 | 12,2 | 14,2 | 15,7 | 18,2 | 21,9 |
| 60 | mới | 11,7 | 15,2 | 17,6 | 19,5 | 22,7 | 27,5 |

Đánh giá theo mục tiêu: cấp 7 trong buổi đầu đạt cả nhịp thong thả (0,8 buổi); cấp 15 sau 3,9 buổi ở nhịp bình thường (khoảng 2,6 giờ chơi), 5,8 buổi ở nhịp thong thả, 1,9 buổi ở nhịp tích cực. Với bánh nhiệm vụ (dòng 7-9 của bảng mục 1: 6 bánh tới hết nhiệm vụ 10, tức 240 XP, cho thú đi theo ăn hết) người chỉ đánh 10 trận vẫn tới cấp 7,2; 20 trận tới cấp 8,6.

### 4. Vì sao các con số này

- **Hệ số 13** (không phải 12 hay 14): chọn sao cho người thong thả (20 trận/buổi) có cấp 7 trong buổi đầu với dư khoảng 25% và cấp 15 trong 3-6 buổi. Mỗi 1 đơn vị của `XP_CURVE` đổi XP cộng dồn khoảng 7,7%: k = 12 cho cấp 7 / 15 / 20 ở trận 14 / 107 / 235; k = 14 cho 17 / 125 / 275; k = 16 cho 19 / 143 / 314. Giữ mũ 1,5 để cấp thấp vẫn nhanh (cấp 2 ngay trận đầu, cấp 3 sau 2 trận, cấp 5 sau 6 trận) và cấp 20+ vẫn là đích dài hạn (255 trận tới cấp 20, khoảng 750 trận tới cấp 30).
- **Nhân XP kết liễu theo cấp thú bị hạ (+10%/cấp)**: thú cấp 10 cho 23/48 XP thay vì 12/25, cho người chơi lý do sang vùng ngoài/đảo. Bù lại không phạt khi thú đi theo cao cấp hơn thú bị hạ (không chống cày; xem phương án C). Hiệu quả: bớt 12-17% số trận tới cấp 7-20 so với chỉ đổi hệ số (15 so với 17; 116 so với 136; 255 so với 306 trận).
- **Không nhân XP đòn thường (4) theo cấp**: trận dài hơn đã tự cho nhiều đòn hơn (thú đi theo cấp 1 nhận trung bình 12 XP từ đòn mỗi trận ở đồng cỏ, 13-19 XP ở vùng ngoài và đảo, nơi thú cấp cao hơn).
- **Bánh 4 -> 8 quả**: đưa bánh từ 10 xuống 5 XP/quả. Trại 1 với 1 thú làm quả cho 30 XP/phút (1,1x người chơi bình thường), 3 thú 90 XP/phút (3,3x; trước đây 7,5x), một bụi quả (3 quả) = 15 XP. Bánh nhận từ nhiệm vụ/rương/rơi đồ vẫn 40 XP. Nếu playtest vẫn thấy bánh lấn át: nâng lên 12 quả (3,3 XP/quả).
- **Bánh thưởng nhiệm vụ (+1 ở `first_catch`, `snow`, `swamp`)**: là cách "nhiệm vụ cho XP" không cần đổi kiểu `Reward`, `rewardText`, giao thức hay test (`quests.test.ts` chỉ cần phần thưởng không rỗng). Dạy người chơi nút "Cho ăn" ngay sau lần bắt đầu tiên (40 XP = cấp 2 gần đầy). Tổng chuỗi 8 -> 11 bánh; 11 nhiệm vụ đầu 3 -> 6 bánh. Phương án thay thế nếu muốn XP trực tiếp: thêm trường `xp` vào `Reward`, cộng cho thú đi theo trong `questEvent`, sửa `rewardText` và test; không cần cho con số này.
- **Trùm 250 XP** cho thú đi theo của mọi người giúp: cùng bậc với thú đầu đàn (300), cộng 90-220 XP từ các đòn trong trận (14-43 s tùy vũ khí và cấp thú đi theo). Mỗi lần hạ trùm khoảng 340-470 XP, tức khoảng 1 cấp ở cấp 10-12.
- **Làm việc giữ 2 XP/món**: thú làm việc lên nhanh hơn 1,5 lần chỉ nhờ đường cong (cấp 7 sau 27-39 phút online, cấp 15 sau 152-217 phút; cũ 42-60 và 234-334), là kênh nền hợp lý vì không có XP lúc vắng mặt.

### 5. Các quyết định được hỏi

- **Chia XP cho thú không đi theo: không.** Chia 20% cho mỗi thú nghỉ (túi 10 thú) tạo ra 2,8 lần tổng XP mỗi trận nhưng không làm con thú người chơi quan tâm lên nhanh hơn; mỗi trận sinh tới 29 lần `addXp`, thêm thông báo lên cấp và lần lưu cho thú ở xa. Người muốn đổi thú đi theo đã có bánh (đưa cho bất kỳ thú nào) và thú làm việc có XP riêng.
- **XP theo từng mục tiêu trúng chiêu: không đổi.** Thú hoang đứng thưa (80 con trên khoảng 12 triệu px² đất trống): số thú khác nằm trong vùng chiêu rộng nhất (Vòng lửa bán kính 95 px) trung bình 0,19, Bão lá 0,09, Sét chuỗi 0,21. Tính XP cho từng mục tiêu chỉ thêm khoảng 1% tổng XP. Nếu designer muốn thưởng chiêu vùng: 4 XP mỗi mục tiêu, tối đa 3 mục tiêu mỗi lần tung (đổi vòng lặp trong `land`), không ảnh hưởng bảng trên.
- **XP nhiệm vụ**: dùng bánh (mục 7-9). Trùm: `BOSS.xp`.
- **Vòng bắt - thả (T2):** sau đổi, người cày hạ gục liên tục 279 XP/phút (đồng cỏ, cấp 1); bắt khi túi chưa đầy 336 (1,20x); bắt rồi thả 201 (0,72x). Ở vùng ngoài cấp 15: 277 / 338 (1,22x) / 199 (0,72x). Vòng bắt - thả chỉ vượt hạ gục liên tục khi XP bắt thật sự lớn hơn khoảng 3,5 lần XP hạ gục (hoà vốn ở khoảng 42 XP kết liễu cho thú cấp 1); mức sau đổi chỉ gấp 2,1 lần. Giữ quy tắc: XP bắt cơ sở không quá 2 lần XP hạ gục cơ sở.

### 6. Phương án khác

| Phương án | Mô tả | Trận tới cấp 5 / 7 / 10 / 15 / 20 | Khi nào chọn |
|---|---|---|---|
| Hiện tại | k = 20, XP phẳng | 11 / 27 / 70 / 210 / 470 | - |
| A (tối giản) | chỉ mục 1 (k = 13) | 7 / 17 / 46 / 136 / 306 | muốn đổi đúng 1 hằng số |
| **B (khuyến nghị)** | A + mục 2-4 | **6 / 15 / 40 / 116 / 255** | - |
| B, k = 14 | chậm hơn | 7 / 17 / 43 / 125 / 275 | thấy B nhanh quá |
| B, k = 12 | nhanh hơn | 6 / 14 / 37 / 107 / 235 | thấy B vẫn chậm |
| C (dự phòng chống cày) | B + XP kết liễu x `clamp(1 - 0,1 * max(0, cấp thú đi theo - cấp thú bị hạ - 3), 0,5, 1)` | 6 / 16 / 43 / 143 / 356 | nếu có người cày thú yếu ở cấp cao |

Phương án C chỉ cắt XP kết liễu (không cắt XP đòn): gần như không đổi tới cấp 7 (16 so với 15 trận), chậm hơn 7% ở cấp 10, 23% ở cấp 15 và 40% ở cấp 20. Người cày hạ gục ở vùng ngoài cấp 15 giảm từ 277 xuống 195 XP/phút. Chưa cần, vì cấp thú đi theo ít ảnh hưởng độ khó thú thường (mục 6 Hiện trạng) và 6 trận/phút liên tục là cực đoan: ở mật độ 80 thú trên đất liền và đẻ lại 1 thú mỗi 5 s, người cày thực tế thấp hơn.

## Rủi ro

- **Hồ sơ đã lưu:** thú giữ `level` và `xp` (phần dư trong cấp). Đường cong mới thấp hơn nên không ai tụt cấp. Thú có `xp` lớn hơn ngưỡng mới lên tối đa +1 cấp (đã tính cho mọi cấp 1-29, ví dụ cấp 6 xp 293/294 -> cấp 7 xp 102/241; cấp 14 xp 1.047 -> cấp 15 xp 366/755), nên không bị nhảy hai cấp. Nếu không "lên nốt" lúc nạp (mục 10), thanh XP kẹt ở 100% (client kẹp `min(100, ...)`) và nhiệm vụ "nuôi thú lên cấp 5" chỉ được tính ở lần lên cấp kế tiếp. Thanh XP của thú đang dở sẽ nhảy (ví dụ 50% thanh cũ ở cấp 5 thành 77%): chỉ hiển thị. Thú làm việc +1 cấp làm sản xuất nhanh hơn khoảng 5%.
- **Test phải sửa/thêm:**
  - `packages/server/src/rooms/GameRoom.test.ts:198-209` ("captured pals keep the wild level and the follower earns capture XP") so `follower.xp === xpBefore + XP_PER_CAPTURE`; sau đổi XP bắt phụ thuộc cấp thú bị bắt: dùng `finishXp(XP_PER_CAPTURE, player.pals[1].level)` (cấp thú ngẫu nhiên nên bắt buộc đọc cấp từ thú vừa bắt).
  - `progression.test.ts`: thêm test `finishXp` (cấp 1 = base, +10%/cấp, cấp 0/âm coi như 1), mốc đường cong (cộng dồn tới cấp 7 = 558, cấp 15 = 4.159), mọi cấp 1-29 `xpToNext` tăng.
  - `store.test.ts`: thêm test thú có `xp` vượt ngưỡng mới được lên cấp khi nạp (và cấp 30 thì `xp` = 0); các test hiện có (cấp 3 xp 10; cấp 999 -> 30, xp -5 -> 0) không đổi.
  - `GameRoom.test.ts`: thêm test trùm cho thú đi theo của người giúp `BOSS.xp`.
  - `quests.test.ts` không đổi (chỉ kiểm phần thưởng không rỗng). E2E không phụ thuộc số XP.
  - Tài liệu: `docs/design/pals.md` nên có mục "Kinh nghiệm và lên cấp" (bảng nguồn, đường cong mới); mô tả công thức `berry_snack` ("40 kinh nghiệm") giữ nguyên.
- **Bánh tốn 8 quả:** không mất gì của hồ sơ cũ (quả và bánh đang có giữ nguyên). Người đang tích quả thấy "đắt gấp đôi". Nút "Chế" của bánh không có hàng loạt nên thao tác không đổi.
- **Thú làm việc AFK:** thú làm việc ở trại 3 (5 chỗ) lên cấp 15 sau khoảng 2,5 giờ có mặt trong game, trại 1 (3 chỗ) sau 3,6 giờ (cũ 3,9 và 5,6 giờ). Chấp nhận; nếu muốn chậm lại thì đặt `XP_PER_WORK` = 1 (chậm 2 lần).
- **Thú đầu đàn và trùm là nguồn XP nhanh nhất ở cấp 7-15:** một lần hạ đầu đàn cho 350-440 XP, bằng 1,4-1,8 cấp ở cấp 7 (cũ 0,9-1,2) và 0,45-0,54 cấp ở cấp 15; hồi sinh sau 6 phút (trùm 4 phút). Đầu đàn đồng cỏ (Voltmouse cấp 15) nằm cách chỗ xuất phát khoảng 850 px và hạ trong 9 s với kiếm. Nếu playtest thấy cày đầu đàn: đặt `ALPHA.xp` = 200.
- **Lên nhiều cấp một lần:** với đường cong mới, thú cấp 6 có từ 132 XP dư nhận thêm 300 (đầu đàn) sẽ nhảy qua cấp 7 và mất thông báo chiêu 2 (mục 11 sửa). Mục 11 đổi tin `LevelUp` (giao thức): server và client phải sửa trong cùng nhiệm vụ; muốn tránh đổi giao thức thì client tự nhớ cấp trước đó của từng thú trong `party`. Bánh 40 XP ở cấp 1 nhảy 1 cấp rưỡi, không sao.
- **Người chơi cấp cao ngoài đường chuẩn:** thú bắt được ở cấp 7-13 (vùng ngoài và đảo) bỏ qua phần đầu của đường cong; chúng tiến tiếp với XP kết liễu cao hơn nhờ mục 2.
- **Độ nhạy của giả định:** toàn bộ bảng thời gian phụ thuộc nhịp trận mỗi phút, chưa có số liệu thật; các bảng ghi cả số trận để đổi nhịp. Hệ số tính XP/trận bền: đổi tỉ lệ đánh thực tế 0,5-1,0 chỉ làm XP/trận dao động 26-33 ở đồng cỏ và 31-42 ở vùng ngoài (cấp 1-7); thay hỗn hợp thú đi theo bằng 5 loài khởi đầu lệch dưới 1 XP.
- **Liên quan T7:** cấp thú đi theo điển hình sau đổi là cấp 8-9 cuối buổi đầu (nhịp bình thường) và cấp 15 sau khoảng 4 buổi; dùng các cấp này khi đo thời gian người chơi trụ được trước thú hoang cấp cao.
- **Ghi chú ngoài phạm vi T4:** thú hiền chạy khi bị đánh với tốc độ x1,8 (`WILD_CHASE_SPEED_FACTOR`); Voltmouse (95 x 1,8 = 171 px/s) chạy nhanh hơn người chơi (160 px/s) nên hạ một con cấp 3 mất 6-8 s, gấp 3-5 lần thú khác (bot đo). Không đổi XP/phút đáng kể (Voltmouse chiếm 11% thú đồng cỏ) nhưng là trải nghiệm tệ cho người mới; nên cân nhắc một việc nhỏ riêng.
