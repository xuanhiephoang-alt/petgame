# PLAN: T7 Chiêu và cú cắn của thú hoang cấp cao quá nặng

## Mục tiêu

- **Vùng xa không còn hạ người chơi trong vài đòn.** Người chơi có 100 máu cố định, không lên cấp. Còn thú hoang mỗi cấp thêm 15% sức cắn, chiêu thì mạnh theo đúng cấp thật. Hiện tại, người đứng yên trước 1 thú hoang thường ở cấp cao nhất thường gặp của vùng xa (cấp 10-13) chỉ trụ được:
  - 3,1-4,3 giây nếu không giáp;
  - 4,4-6,1 giây nếu mặc giáp da + mũ sắt (30%).

  Sau nhiệm vụ: 4,5-5,8 giây không giáp, 6,3-8,1 giây có giáp 30%.
- **Không còn cú nổ lớn một lần.** Hiện Động đất của Boulderhorn trúng 40 ở cấp 11 và 46 ở cấp 14: một chiêu lấy gần nửa máu. Sau nhiệm vụ, đòn mạnh nhất của thú hoang thường nhỏ hơn 1/3 máu (33). Người chơi đầy máu phải trúng ít nhất 4 đòn mới bị hạ.
- **Vùng xa vẫn khó hơn, thú đi theo không yếu đi.** Máu thú hoang vẫn +20% mỗi cấp. Hai thú cấp cao vẫn buộc người chơi phải lướt né. Chiêu và đòn của thú đi theo giữ nguyên.
- **Thú đầu đàn đạt mốc cảm nhận "trận vài chục giây, biết né thì sống"** (mục Thiết kế 4). Trùm không đổi.

"Thú hoang thường" trong file này là thú hoang không phải thú đầu đàn hay trùm.

## Phạm vi

Làm, trong một commit:
- **Shared:**
  - `combat.ts`: hằng số `WILD_DAMAGE_PER_LEVEL`, dùng trong `wildDamage`;
  - `skills.ts`: hằng số `WILD_SKILL_MAX_LEVEL` và hàm thuần `wildSkillLevel`;
  - sửa JSDoc của `ALPHA.damageMultiplier` (`alphas.ts`) và `SkillCastMessage.level` (`messages.ts`).
- **Server:** một dòng trong `GameRoom.ts` (cấp sức mạnh chiêu của thú hoang thường) và một tên import.
- **Test:** unit trong shared, tích hợp trong `GameRoom.test.ts`.
- **Tài liệu:**
  - coder sửa `docs/architecture.md`;
  - game-designer đã sửa `docs/design/skills.md` (mục "Sát thương", ghi chú bảng 30 chiêu) và `docs/design/pals.md` (bảng và mục "Thú đầu đàn", mục mới "Sức mạnh thú hoang theo cấp").

KHÔNG làm (để không lan rộng):
- **Thú đi theo:** không đổi `skillPower`, `SKILL_LEVEL_SCALING`, `companionDamage`.
- **Thú hoang:** không đổi `scaledMaxHp`, `wildMaxLevel`, `rollWildLevel`.
- **Người chơi:** không đổi `PLAYER_MAX_HP`, giáp (`wearables.json`, `MAX_DEFENSE`), hồi máu, quả mọng.
- **Nhịp đánh:** không đổi `WILD_ATTACK_COOLDOWN_MS`, `WILD_WINDUP_MS`, `WILD_SKILL_GAP_MS`, xác suất 0,06 trong `wildSkill`, `WILD_COOLDOWN_FACTOR`.
- **Thú đầu đàn và trùm:** không đổi giá trị nào trong `ALPHA`, `ALPHAS`, `BOSS`.
- Không đổi client, `schema.ts`, hình dạng message, `Profile`.
- Không sửa các test có sẵn ngoài hai chỗ ghi ở mục Test (việc dọn test cũ thuộc T22).

## Thiết kế

### 1. Quyết định từng đề xuất của `BALANCE.md`

| Đề xuất | Quyết định | Lý do |
|---|---|---|
| 1. `WILD_SKILL_MAX_LEVEL` = 8, chỉ cho thú hoang thường | **Nhận** (thêm hàm `wildSkillLevel` để có chỗ test) | Chặn cú nổ lớn: chiêu mạnh nhất của thú hoang thường còn 33. Chỉ tác động thú cấp 9-14: đồng cỏ (cấp tối đa 6-8) không đổi. Cùng mức với `ALPHA.skillLevel`, nên luật dễ nhớ: "chiêu của thú hoang tính tối đa cấp 8". Thú đầu đàn vẫn khác thú thường (biết chiêu thứ 3, dùng thường hơn, hồi nhanh hơn). Thú đi theo không bị giới hạn. Áp cho cả chiêu hồi máu, giống thú đầu đàn: một luật cho mọi chiêu |
| 2. `WILD_DAMAGE_PER_LEVEL` 0,15 → 0,08 trong `wildDamage` | **Nhận** | Cú cắn chiếm khoảng 80% sát thương thú hoang gây ra. Chỉ giới hạn chiêu thì thời gian trụ tăng 0-1,1 giây. Với 0,08, người đứng yên không giáp trụ ≥ 4,5 giây trước 1 thú ở cấp cao nhất thường gặp của mọi vùng. Thú cấp 1 không đổi. Mức 0,10 để thành nút chỉnh (đảo cấp 13: 4,2 giây). `companionDamage` giữ +15%, hệ số riêng |
| 3. Giữ nhịp cắn và nhịp chiêu | **Nhận** | Chiêu đã hiếm (khoảng 1 chiêu mỗi 6-7 giây). Đổi nhịp chạm cả thú đầu đàn, trùm và các test nhịp mà ít tác dụng hơn hai hằng số trên |
| Bù cho thú đầu đàn (`ALPHA.damageMultiplier`) | **Không bù**, giữ 1, chỉ sửa JSDoc | Mục 4. Lưu ý: số thú đầu đàn trong `BALANCE.md` sai, xem mục Rủi ro |
| Trùm | **Không đổi** | Trùm cắn cố định (`BOSS.biteDamage` 14) và dùng chiêu cấp 4 (`BOSS.skillLevel`), không đi qua `wildDamage` hay giới hạn mới |

### 2. Số trước → sau, thú hoang thường (chưa tính giáp)

Cú cắn (`wildDamage`): cấp 1 giữ nguyên, cấp 14 gấp 2,04 lần cấp 1 (trước: 2,95 lần).

| Thú (sức cắn gốc) | Cấp 6 | Cấp 8 | Cấp 11 | Cấp 14 |
|---|---|---|---|---|
| Emberpup (7) | 12 → 10 | 14 → 11 | 18 → 13 | 21 → 14 |
| Boulderhorn (10), Coralcrab (10) | 18 → 14 | 21 → 16 | 25 → 18 | 30 → 20 |
| Scorchtail (9), Frostfang (9) | 16 → 13 | 18 → 14 | 23 → 16 | 27 → 18 |
| Cactoad (8) | 14 → 11 | 16 → 12 | 20 → 14 | 24 → 16 |

Chiêu mạnh nhất mà thú hoang thường biết (từ cấp 9 trở lên tính như cấp 8, ×1,84; cấp 1-8 không đổi). Chỉ thú tự vệ và thú hung dữ mới đánh. Thú hiền (Leafkit, Bubbloon, Voltmouse, Mothlume, Bogbloom) khi là thú hoang thường thì bị đánh là bỏ chạy, không cắn, không tung chiêu (`provoke`, `wildTarget`).

| Thú (tính khí), chiêu | Cấp 11 | Cấp 14 |
|---|---|---|
| Boulderhorn (hung dữ), Động đất | 40 → 33 | 46 → 33 |
| Scorchtail (hung dữ), Quất đuôi lửa; Frostfang (tự vệ), Hơi thở băng giá | 29 → 24 | 33 → 24 |
| Emberpup (tự vệ), Phun lửa; Coralcrab (tự vệ), Kẹp càng | 24 → 20 | 28 → 20 |
| Pebblet (tự vệ), Ném đá; Ripplefin (tự vệ), Vòi nước | 20 → 17 | 23 → 17 |
| Ripplefin: Mưa hồi máu (hồi cho chính nó) | +40 → +33 | +46 → +33 |

Đòn mạnh nhất của thú hoang thường ở mọi cấp nó có thể có (1-14): trước là 46, sau là 33 (Động đất từ cấp 8); cú cắn tối đa 20. Câu "Sấm sét khoảng 41" trong mô tả T7 không xảy ra trong game: Voltmouse hoang là thú hiền nên không tung chiêu, còn Voltmouse đầu đàn đã bị giới hạn ở cấp 8 (29).

### 3. Thời gian trụ của người chơi, thú hoang thường

Số liệu: người đứng yên, không đánh lại, không hồi máu, đo bằng giây. Mô hình của `BALANCE.md`; game-designer chạy lại bằng script chỉ đọc và ra cùng số, sai lệch ≤ 0,1 giây.

| Vùng, thú, cấp | 1 thú, không giáp | 1 thú, giáp 30% | 2 thú, giáp 30% | 3 thú, không giáp |
|---|---|---|---|---|
| Đồng cỏ, Emberpup 6 | 8,8 → 9,6 | 12,7 → 13,9 | 6,5 → 6,6 | 2,5 → 2,9 |
| Núi lửa, Boulderhorn 8 | 4,4 → 5,5 | 6,2 → 7,2 | 2,7 → 3,3 | 1,6 → 1,7 |
| Núi lửa, Boulderhorn 11 | 3,3 → 4,5 | 4,4 → 6,3 | 2,1 → 3,1 | 1,5 → 1,7 |
| Sa mạc, Scorchtail 10 | 4,2 → 5,8 | 6,1 → 8,1 | 2,9 → 3,2 | 1,4 → 1,7 |
| Núi tuyết, Frostfang 11 | 4,3 → 5,3 | 5,5 → 8,1 | 2,5 → 3,4 | 1,6 → 1,8 |
| Đảo hoang, Coralcrab 13 | 3,1 → 5,1 | 5,1 → 6,9 | 2,4 → 3,3 | 1,3 → 1,7 |

Theo `BALANCE.md` (cùng mô hình), xác suất chết khi có kiếm, giáp 30%, thú đi theo cấp 9 và né được nửa số đòn:
- 2 thú: núi lửa cấp 11 giảm từ 39% xuống 7%, đảo cấp 13 từ 29% xuống 2%;
- 3 thú núi lửa cấp 11: vẫn 91%.

Tức là:
- 1 thú hoang không còn đe doạ;
- 2 thú vẫn buộc phải lướt né;
- 3 thú cùng lúc vẫn rất nguy hiểm. Chuyện này hiếm: chỉ Boulderhorn và Scorchtail chủ động tấn công.

### 4. Thú đầu đàn: không bù (`ALPHA.damageMultiplier` giữ 1)

Thú đầu đàn cắn bằng `wildDamage(loài, cấp) × ALPHA.damageMultiplier`, nên đường cắn mới cũng chạm nó. Chiêu của nó đã giới hạn cấp 8 từ trước, không đổi.

| Thú đầu đàn | Máu | Cắn hiện tại | Cắn sau T7 (×1) | ×1,25 | Hệ số để giữ như cũ |
|---|---|---|---|---|---|
| Voltmouse 15 | 399 | 16 | 11 | 14 | 1,45 |
| Bogbloom 17 | 630 | 17 | 11 | 14 | 1,55 |
| Cactoad 18 | 792 | 28 | 19 | 24 | 1,47 |
| Frostfang 19 | 966 | 33 | 22 | 28 | 1,50 |
| Scorchtail 20 | 792 | 35 | 23 | 29 | 1,52 |
| Coralcrab 22 | 1.170 | 42 | 27 | 34 | 1,56 |

**Người đứng yên, không đánh lại** (giây, không giáp / giáp 30%):

| | Hiện tại | Sau T7, ×1 | ×1,25 |
|---|---|---|---|
| Voltmouse 15 | 5,0 / 7,0 | 6,1 / 8,7 | 5,5 / 7,9 |
| Bogbloom 17 | 4,4 / 7,0 | 6,1 / 10,5 | 5,2 / 8,1 |
| Cactoad 18 | 3,2 / 4,4 | 4,3 / 5,9 | 3,2 / 5,1 |
| Frostfang 19 | 2,6 / 4,4 | 3,4 / 5,3 | 3,3 / 4,4 |
| Scorchtail 20 | 2,3 / 3,3 | 3,3 / 5,1 | 2,4 / 4,3 |
| Coralcrab 22 | 2,2 / 3,2 | 3,2 / 4,4 | 2,2 / 4,4 |

Để so sánh: trùm hạ người đứng yên trong khoảng 7 giây (`BALANCE.md`).

**Cả trận** (xác suất người chơi chết khi né 0% / 50% / 75% số đòn; thời gian thắng khi đánh liên tục). Hai mốc lấy theo T4:
- **C**: kiếm, giáp da + mũ sắt 30%, thú đi theo cấp 15, tức sau khoảng 4 buổi chơi. Đây là giai đoạn dự kiến gặp thú đầu đàn, vì nhiệm vụ cuối chuỗi là "Hạ hoặc bắt một thú đầu đàn", sau trùm;
- **B**: như C nhưng thú đi theo cấp 9, tức sau buổi đầu.

| Thú đầu đàn | Thắng sau (C / B) | C hiện tại | C sau T7, ×1 | C ×1,25 | B hiện tại | B sau T7, ×1 |
|---|---|---|---|---|---|---|
| Voltmouse 15 | 5 / 7 giây | 0 / 0 / 0% | 0 / 0 / 0% | 0 / 0 / 0% | 3 / 0 / 0% | 0 / 0 / 0% |
| Bogbloom 17 | 9 / 11 | 22 / 0 / 0 | 0 / 0 / 0 | 7 / 0 / 0 | 44 / 1 / 0 | 1 / 0 / 0 |
| Cactoad 18 | 11 / 13 | 99 / 30 / 3 | 81 / 6 / 0 | 95 / 18 / 1 | 100 / 57 / 7 | 100 / 18 / 1 |
| Frostfang 19 | 14 / 17 | 100 / 61 / 8 | 99 / 28 / 1 | 100 / 43 / 3 | 100 / 93 / 34 | 100 / 60 / 7 |
| Scorchtail 20 | 12 / 14 | 100 / 55 / 9 | 95 / 17 / 1 | 99 / 34 / 3 | 100 / 85 / 22 | 100 / 34 / 1 |
| Coralcrab 22 | 17 / 22 | 100 / 94 / 42 | 100 / 70 / 10 | 100 / 86 / 24 | 100 / 100 / 75 | 100 / 95 / 36 |

Giáp hiệp sĩ + mũ sắt (45%), thú đi theo cấp 15, né 50%: hiện 0 / 0 / 6 / 34 / 29 / 89% (theo thứ tự bảng), sau T7 0 / 0 / 1 / 6 / 8 / 38%.

Kiểm tra độ chắc: đánh chậm hơn (tay không thay kiếm, mốc C) thì kết luận không đổi. Né 50% sau T7: 0 / 0 / 17 / 46 / 29 / 90%; nếu bù ×1,25: 0 / 0 / 34 / 66 / 52 / 97%.

**Quyết định: không bù.** "Biết né" hiểu là né được nửa số đòn: lướt đúng nhịp nửa số cú cắn, ra khỏi vùng đỏ nửa số chiêu. "Thì sống" hiểu là chết dưới khoảng 30% ở mốc C.
- **Thời gian trận:** độ dài trận do máu thú đầu đàn quyết định, T7 không đụng: 5-30 giây khi đánh liên tục, chơi thật lâu hơn vì phải né. Mốc "vài chục giây" đạt được (trừ đồng cỏ, xem mục Rủi ro).
- **Hiện tại không đạt mốc "biết né thì sống":** người né nửa số đòn chết 30-94% ở 4/6 thú đầu đàn.
- **Sau T7 với ×1 thì đạt ở 5/6 con** (chết 0-28%).
  - Coralcrab ở đảo (cần bè, cấp cao nhất) còn là thử thách cuối: chết 70% nếu né nửa số đòn, 10% nếu né 3/4, 38% nếu có giáp hiệp sĩ.
  - Đứng yên vẫn thua từ sa mạc trở đi (chết 81-100%). Thú đầu đàn vẫn gắt hơn trùm tính theo giây: 3,2-4,3 giây so với khoảng 7 giây ở 4 con cấp 18-22.
- **Bù ×1,25** trượt mốc ở núi tuyết (43%), núi lửa (34%), đảo (86%). **Bù ×1,5** gần như trở lại như hiện tại.
- Nút chỉnh ghi trong `docs/design/pals.md`: `ALPHA.damageMultiplier` 1,25 hoặc 1,5.

**Mô hình** (script chỉ đọc của game-designer: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t7-alpha.ts`, có thể đã mất):
- bước 50 ms, 800-1.500 lần mỗi ô;
- **thú đầu đàn** bám theo server:
  - cắn mỗi 1,2 giây sau 0,45 giây gồng;
  - chiêu: 8% mỗi tick sau khoảng nghỉ `castMs` + 2,2 giây, thời gian hồi ×1, sức chiêu cấp 8;
  - Bogbloom tự hồi máu khi dưới 50%;
- **người chơi** đánh đều theo vũ khí (chí mạng 12%, ×1,6);
- **thú đi theo** kiểu Emberpup: cắn mỗi 0,9 giây, tung chiêu ngay khi sẵn, có máu và có thể ngất;
- khi thú đi theo còn đứng, 70% số đòn của thú đầu đàn nhắm người chơi. Lý do: thú đầu đàn đánh kẻ vừa đánh nó, và người chơi đánh nhanh gấp đôi thú;
- **bỏ qua:** khắc hệ, quả mọng, hồi máu, chạy vòng;
- số "hiện tại" khớp `BALANCE.md`: Voltmouse 5,0 / 7,0; Coralcrab 2,2 / 3,2.

### 5. Luật cân bằng mới: luật 1/3

Đòn mạnh nhất của một thú hoang thường (cú cắn hoặc chiêu đánh, chưa tính giáp) nhỏ hơn 1/3 `PLAYER_MAX_HP`. Nghĩa là người chơi đầy máu phải trúng ít nhất 4 đòn mới bị hạ.
- Hiện là 33 × 3 = 99 < 100. Luật sát nút có chủ ý: ai nâng `WILD_SKILL_MAX_LEVEL` lên 9 trở lên, hoặc đổi dữ liệu chiêu làm đòn vượt 33, sẽ thấy test đỏ và phải xem lại luật.
- Unit test duyệt mọi loài ở mọi cấp 1..`wildMaxLevel(1)` (14).
- Thú đầu đàn và trùm không theo luật này: chiêu thứ 3 của bốn thú đầu đàn cấp 18-22, tính ở cấp 8, trúng 37-44.

### 6. Người chơi thấy gì; chữ; điện thoại và bàn phím

- Không có chữ mới, không đổi giao diện. Số sát thương bay lên khi bị thú cấp cao cắn hoặc trúng chiêu nhỏ hơn (do server tính).
- Vùng đỏ, nhịp gồng, nhịp chiêu giữ nguyên, nên cách chơi trên cảm ứng và bàn phím không đổi.
- Thú đi theo cũng bị cắn nhẹ hơn (cùng `wildDamage`) nên ít ngất hơn ở vùng xa. Đây là điều mong muốn.
- Thú bắt về giữ cấp thật và dùng chiêu theo đúng cấp. Giới hạn chỉ áp cho thú còn hoang: bắt một con cấp 12 vẫn có chiêu ×2,32, thêm một lý do để bắt thú vùng xa.

## Kế hoạch triển khai

Không có thứ tự phụ thuộc giữa bước 1 và 2. Bước 3 cần bước 2.

1. **`packages/shared/src/combat.ts`**
   - Thêm ngay sau `WILD_ATTACK_COOLDOWN_MS`:
     ```ts
     /**
      * A wild pal's bite grows this much per level above 1 (+8%), slower than its health (+20%, scaledMaxHp) and a
      * companion's hits (+15%, companionDamage): a player's health never grows, so far-off pals should take longer
      * to beat, not knock players out much faster. Pack leaders bite like this too (times ALPHA.damageMultiplier).
      */
     export const WILD_DAMAGE_PER_LEVEL = 0.08;
     ```
   - `wildDamage`: thay `0.15` bằng `WILD_DAMAGE_PER_LEVEL`, giữ nguyên chữ ký và `Math.round`. Sửa JSDoc thành `/** Damage a wild pal deals per bite: its kind's attack at level 1, WILD_DAMAGE_PER_LEVEL more per level above. */`.
   - Không đụng `companionDamage` (`progression.ts`).
2. **`packages/shared/src/skills.ts`**
   - Thêm ngay sau `SKILL_LEVEL_SCALING`:
     ```ts
     /**
      * A common wild pal's skills (damage and healing) are as strong as a level 8 pal's at most, however high its
      * level: one blast from far away takes a third of a player's health, not half. Pack leaders have their own cap
      * (ALPHA.skillLevel) and the boss a level of its own (BOSS.skillLevel); companions always use their level.
      */
     export const WILD_SKILL_MAX_LEVEL = 8;
     ```
   - Thêm ngay sau `skillPower`:
     ```ts
     /** The level a common wild pal's skills are worked out at: its own, up to WILD_SKILL_MAX_LEVEL. */
     export function wildSkillLevel(level: number): number
     ```
     Thân hàm: `Math.min(level, WILD_SKILL_MAX_LEVEL)`. `index.ts` đã `export *` từ `skills.ts` và `combat.ts`, không cần sửa.
3. **`packages/server/src/rooms/GameRoom.ts`**, chỉ hai chỗ:
   - Import `wildSkillLevel` từ `@petgame/shared`, đặt cạnh `skillPower` (khoảng dòng 87). Không import `WILD_SKILL_MAX_LEVEL`, vì `noUnusedLocals` sẽ báo lỗi.
   - Dòng 695, trong nhánh thú hoang tung chiêu của `tick`, đổi `: pal.level` cuối biểu thức thành `: wildSkillLevel(pal.level)`:
     ```ts
     this.startCast("wild", id, pal, pal.boss ? BOSS.skillLevel : pal.alpha ? Math.min(pal.level, ALPHA.skillLevel) : wildSkillLevel(pal.level), skill, target);
     ```
   - Không sửa `strike` (dòng 1262): nó gọi `wildDamage`, tự nhận hệ số mới. Không sửa `land`, `support`, `startCast`: các hàm này dùng `cast.level` đã giới hạn, nên sát thương lên người chơi, thú đi theo và lượng máu thú hoang tự hồi đều theo cấp 8.
4. **`packages/shared/src/alphas.ts`**: chỉ sửa JSDoc của `damageMultiplier`, giá trị giữ 1:
   `/** Its bites hit this much harder than a common wild pal's of its level (wildDamage); 1 lets a lone player who dodges half the bites beat most pack leaders (docs/design/pals.md). */`
5. **`packages/shared/src/messages.ts`**: JSDoc của `SkillCastMessage.level` thành:
   `/** The level the skill is as strong as: the caster's, capped for wild pals (WILD_SKILL_MAX_LEVEL, ALPHA.skillLevel; the boss BOSS.skillLevel). */`
   Chú thích cũ ("The caster's level") vốn đã sai với thú đầu đàn và trùm. Không đổi kiểu.
6. **Unit test trong shared**, chi tiết ở mục Test: thêm vào `combat.test.ts` và `skills.test.ts`. Chỉ import thứ thật sự dùng (`noUnusedLocals` áp cả file test).
7. **Test tích hợp `GameRoom.test.ts`**: thêm 1 test, sửa 1 test (mục Test). Thêm `WILD_SKILL_MAX_LEVEL` vào khối import `@petgame/shared` ở đầu file.
8. **`docs/architecture.md`**, bảng `packages/shared`:
   - dòng `skills.ts`: thêm "`wildSkillLevel` (cấp sức mạnh chiêu của thú hoang thường, tối đa `WILD_SKILL_MAX_LEVEL` = 8)" sau `skillPower`;
   - dòng `combat.ts`, `gathering.ts`: đổi "Sát thương, …" thành "Sát thương (cú cắn thú hoang `wildDamage`, +8% mỗi cấp: `WILD_DAMAGE_PER_LEVEL`), …".
9. Chạy `npm run typecheck` và `npm test`. Ghi `PROGRESS.md`.

## Giao thức

- **`schema.ts`:** không đổi.
- **`messages.ts`:** chỉ sửa chú thích. Giá trị `SkillCastMessage.level` vốn là cấp sức mạnh: thú đầu đàn đã gửi 8, trùm gửi 4. Giờ thú hoang thường cấp 9-14 cũng gửi 8. Client không đọc trường này: `Game.castSkill` chỉ dùng `skill`, `castMs`, `travelMs`, `at`, `from`, `homing`, `target*`.
- **`Profile`:** không đổi. Thú hoang không được lưu. Thú đã bắt giữ cấp và dùng chiêu theo đúng cấp. Hồ sơ cũ đọc như cũ.
- **Client:** không sửa file nào. Không cần đồng bộ phiên bản: server mới với client cũ vẫn chạy đúng.

## Test

**Unit (shared)**

1. `packages/shared/src/combat.test.ts`, thêm `describe("wild pals' bites")`:
   - `it("bite as hard as their kind's attack at level 1, a little harder each level, never less at a higher level")`: với mọi loài trong `PAL_SPECIES`, `wildDamage(s, 1) === s.attack`, và `wildDamage(s, L) >= wildDamage(s, L - 1)` với L = 2..30.
   - `it("a level 14 bite is about twice a level 1 bite (Coralcrab 10 -> 20), not three times")`: khoá số T7 bằng `getSpecies`:
     - `wildDamage(coralcrab, 14)` là 20;
     - `wildDamage(boulderhorn, 11)` là 18;
     - `wildDamage(emberpup, 6)` là 10.
   - `it("companions keep their +15% a level")`: `companionDamage(9)` là 13, `companionDamage(15)` là 19 (import từ `./progression.ts`). Test này giữ cho T7 không chạm thú đi theo.
   - `it("no common wild pal knocks out a full-health player in three hits")`: với mọi loài và mọi L = 1..`wildMaxLevel(1)`, lấy `wildDamage(s, L)` và `skillPower(k, wildSkillLevel(L))` của mọi chiêu không phải hỗ trợ (`!isSupport(k)`) trong `knownSkills(s, L)`. Duyệt cả thú hiền cho đơn giản và chặt hơn; vẫn qua. Mỗi giá trị phải thoả `expect(3 * hit, label).toBeLessThan(PLAYER_MAX_HP)`, với `label` dạng `` `${s.id} Lv ${L} bite` `` hoặc `` `${s.id} Lv ${L} ${k.id}` `` để khi đỏ biết ngay đòn nào. Import từ `./skills.ts`, `./progression.ts`, `./pals.ts`.
2. `packages/shared/src/skills.test.ts`, thêm `it("works out a common wild pal's skills at its level up to WILD_SKILL_MAX_LEVEL; a companion's at its own level")`:
   - `wildSkillLevel(1)` là 1, `(7)` là 7, `(8)` là 8, `(14)` là 8, `(30)` là 8;
   - `wildSkillLevel(14)` bằng `WILD_SKILL_MAX_LEVEL`;
   - `skillPower(getSkill("quake"), wildSkillLevel(14))` là 33, trong khi `skillPower(getSkill("quake"), 14)` (thú đi theo cấp 14) là 46;
   - `skillPower(getSkill("frost_breath"), wildSkillLevel(14))` là 24 (thú đi theo cấp 14: 33);
   - `skillPower(getSkill("healing_rain"), wildSkillLevel(14))` là 33 (chiêu hồi máu cũng bị giới hạn).
3. **Không có test nào khoá số cũ.** `daycycle.test.ts:51` (`wildDamage(boulder, 5) > wildDamage(boulder, 1)`) vẫn đúng (13 > 10), giữ nguyên. `skills.test.ts` "hits harder at higher levels" kiểm `skillPower` của thú đi theo, không đổi.

**Tích hợp server (`packages/server/src/rooms/GameRoom.test.ts`, `describe("elements and skills")`)**

4. **Thêm** ngay sau test "wild pals cast too…": `it("a common wild pal's skill is no stronger than at WILD_SKILL_MAX_LEVEL, however high its level")`. Cách dựng giống test đó:
   - `setup()`, `room.state.pals.clear()`;
   - `const id = placeWild(room, "emberpup", player, 120)`, đặt `pal.level = 14`, `pal.maxHp = pal.hp = 999`;
   - `(room as any).provoke(id, { kind: "player", id: client.sessionId })`;
   - `collect` tin `SkillCast` và `Damage`;
   - `vi.spyOn(Math, "random").mockReturnValue(0)`, chạy tối đa 40 tick tới khi có tin cast, rồi `vi.restoreAllMocks()`;
   - ở 120 px chỉ có Tàn lửa (tầm 150) với tới; Phun lửa tầm 85 thì không.

   Kiểm:
   - `casts[0]` khớp `{ caster: "wild", casterId: id, skill: "ember", level: WILD_SKILL_MAX_LEVEL }`.
   - Ngay sau đó `(room as any).wildAggro.delete(id)`. Emberpup tính tự vệ nên không tự tìm mục tiêu khác. Chiêu đã nằm trong `casts` nên vẫn bay và trúng chỗ đã nhắm. Thú thôi đuổi nên không có cú cắn nào đẩy người chơi ra khỏi chỗ chiêu rơi. Bước này để chắc: cú cắn sớm nhất cũng đến sau khoảng 1,4 giây, còn chiêu trúng ở khoảng 0,68 giây.
   - `await ticks(room, Math.ceil((cast.castMs + cast.travelMs) / 50) + 3)`.
   - Tin `Damage` có `skill === "ember"` khớp `{ targetType: "player", targetId: client.sessionId, amount: skillPower(getSkill("ember"), WILD_SKILL_MAX_LEVEL) }`. Số này là 15; người chơi mặc đồ mặc định nên giáp 0.
   - `amount < skillPower(getSkill("ember"), 14)` (20), và `player.hp === PLAYER_MAX_HP - amount`.
5. **Sửa** test "knows more skills and hits harder at higher levels" để nó cũng chứng minh thú đi theo không bị giới hạn. Pebblet đối với hệ lửa là trung tính ×1, như test đang dùng.
   - Cấp thú đi theo 10 → 14 (cả `giveCompanion(..., 14)` và `skillPower(..., 14)`).
   - Thêm `const casts = collect<SkillCastMessage>(client, ServerMessage.SkillCast)` trước vòng chờ.
   - Thêm `expect(breath.damage).toBeGreaterThan(skillPower(getSkill("fire_breath"), WILD_SKILL_MAX_LEVEL))`, kèm chú thích "a companion is never capped like a wild pal". Hai số là 28 và 20.
   - Thêm `expect(casts.find((c) => c.skill === "fire_breath")?.level).toBe(14)`.
   - Giữ dòng kiểm Vòng lửa chưa học (học ở cấp 15). Đổi tên thành `"knows more skills and hits harder at higher levels, with no cap (unlike wild pals)"`.
6. Test có sẵn của thú hoang tung chiêu ("wild pals cast too…" đặt cấp 8, "a pal dazed…" gọi `startCast` với cấp 5) nằm dưới giới hạn nên không bị ảnh hưởng. Không có test nào khoá lượng máu mất sau cú cắn.

**E2E (Playwright):** không thêm, vì không đổi giao diện hay giao thức. Tester vẫn chạy cả bộ như thường lệ.

## Tiêu chí hoàn thành

- [ ] `WILD_DAMAGE_PER_LEVEL` = 0,08 export từ `combat.ts`. `wildDamage` dùng hằng số này, không còn `0.15` trong `wildDamage`. `companionDamage` không đổi.
- [ ] `WILD_SKILL_MAX_LEVEL` = 8 và `wildSkillLevel(level)` export từ `skills.ts`, có JSDoc tiếng Anh như bước 1-2.
- [ ] `GameRoom.ts` chỉ đổi đúng 2 chỗ: thêm import `wildSkillLevel`, và nhánh thú hoang thường ở dòng 695. Nhánh trùm (`BOSS.skillLevel`), nhánh thú đầu đàn (`Math.min(pal.level, ALPHA.skillLevel)`) và `strike` giữ nguyên.
- [ ] Không đổi giá trị nào trong `ALPHA`, `ALPHAS`, `BOSS`, `SKILL_LEVEL_SCALING`, nhịp cắn hay nhịp chiêu. JSDoc của `ALPHA.damageMultiplier` và `SkillCastMessage.level` đã sửa. Không đổi file nào trong `packages/client`, `schema.ts`, `store.ts`.
- [ ] Unit test có đủ:
  - cắn cấp 1 bằng sức cắn gốc, tăng dần, các số 20 / 18 / 10;
  - `companionDamage` 13 / 19;
  - `wildSkillLevel` 1 / 7 / 8 / 8 / 8;
  - chiêu 33 / 46 / 24 / +33;
  - luật 1/3 trên mọi loài và mọi cấp 1-14.
- [ ] Test tích hợp có đủ:
  - thú hoang Emberpup cấp 14 gửi tin cast `level` 8, Tàn lửa trúng người chơi 15 (thấp hơn 20);
  - thú đi theo cấp 14 gửi tin cast `level` 14, Phun lửa trúng 28 (cao hơn 20).
- [ ] `npm run typecheck` sạch, `npm test` qua, e2e có sẵn qua. Không test nào bị nới hay bỏ qua.
- [ ] `docs/architecture.md` đã cập nhật hai dòng ở bước 8.
- [ ] Số trong `docs/design/pals.md` khớp code: bảng thú đầu đàn có máu 399 / 630 / 792 / 966 / 792 / 1.170 và cắn 11 / 11 / 19 / 22 / 23 / 27; luật 1/3 (33 và 20). `docs/design/skills.md` ghi giới hạn cấp 8 (Động đất 33, Hơi thở băng giá 24, Mưa hồi máu +33). Reviewer đối chiếu bằng `wildDamage` và `skillPower`.

## Rủi ro, câu hỏi mở

Không có "CHẶN:". Mọi thay đổi chỉ là số liệu cân bằng, đảo ngược được bằng một hằng số, không chạm dữ liệu đã lưu.

1. **`BALANCE.md` sai ở phần thú đầu đàn** (mục Rủi ro của file đó). Số ở đó tính với hệ số cắn 0,10, không phải 0,08 như chính file đề xuất:
   - cắn giảm 32-36%, không phải "khoảng 25%": Scorchtail cấp 20 từ 35 xuống 23 (file ghi 26), Coralcrab cấp 22 từ 42 xuống 27 (file ghi 31);
   - hệ số để giữ như cũ là 1,45-1,56, không phải 1,29-1,34.

   Kết luận "không bù" vẫn đúng: mục Thiết kế 4 dùng số đã tính lại. Các chỗ lệch nhỏ khác:
   - dòng "đầm lầy, cactoad 11": Cactoad chỉ sống ở sa mạc. Số đúng cho Cactoad cấp 11, chỉ sai nhãn vùng; tài liệu thiết kế bỏ dòng này;
   - "cấp 6 ở cỏ chỉ giảm 1": Emberpup cấp 6 giảm 2 (12 → 10);
   - dòng "voltmouse 14 (thụ động)" trong bảng hiện trạng, cũng như câu "Sấm sét khoảng 41" trong mô tả T7: Voltmouse hoang không bao giờ đánh, nên trường hợp này không xảy ra trong game.

   PLAN.md thay số của `BALANCE.md` ở các chỗ này. Agent chính quyết có nhờ balance-analyst sửa file đó hay không; việc đó không chặn T7.
2. **Chiêu hồi máu của thú hoang cũng bị giới hạn.** Ripplefin cấp 9-14 hồi +33 thay vì tới +46, nên dễ hạ hơn một chút. Nó là thú hồi máu duy nhất có đánh khi là thú hoang thường; Bubbloon và Bogbloom là thú hiền, còn Bogbloom đầu đàn đã bị giới hạn từ trước. Đây là chủ ý: cùng luật với thú đầu đàn, một con số cho mọi chiêu. Đã ghi trong `docs/design/skills.md`.
3. **Luật 1/3 sát nút** (99 < 100). Nâng `WILD_SKILL_MAX_LEVEL` (nút chỉnh "10" của `BALANCE.md`) hoặc đổi sức chiêu thứ 2 trong `skills.json` có thể làm test luật đỏ. Đây là chủ ý: người chỉnh phải xem lại luật, ghi trong `docs/design/pals.md`.
4. **Cày `ALPHA.xp` dễ hơn** ở thú đầu đàn sa mạc trở đi. Thú đầu đàn đồng cỏ vốn đã dễ (chết 0%). Thời gian hồi sinh 6 phút vẫn giới hạn việc cày; nút chỉnh `ALPHA.xp` 200 đã có trong `docs/design/pals.md`.
5. **Giới hạn của mô hình:** không tính quả mọng, khắc hệ, hồi máu, chạy vòng; đánh đều. Số tuyệt đối có thể lệch so với chơi thật, nhưng so sánh trước/sau là công bằng. Chơi thử thấy vùng xa nhạt thì dùng nút chỉnh trong `docs/design/pals.md`: `WILD_DAMAGE_PER_LEVEL` 0,10; `ALPHA.damageMultiplier` 1,25.
6. **Quan sát ngoài phạm vi:**
   - quả mọng ăn không giới hạn nhịp, có thể vô hiệu các số thời gian trụ ở trên;
   - trận thú đầu đàn đồng cỏ ngắn hơn mốc "vài chục giây".

   Hai việc này đề xuất thành việc riêng ở dưới.

**Đề xuất việc mới** (agent chính thêm vào `TASKS.md`):

- **T32 (P2) Ăn quả mọng không có hồi chiêu.** `eat` (`GameRoom.ts:1117`; phím H, nút "Ăn") hồi 20 máu mỗi lần bấm, không giới hạn nhịp. Người có N quả coi như có 100 + 20N máu giữa trận, vô hiệu các số thời gian trụ của T7 và mốc trận thú đầu đàn. Game-designer quyết cách làm (hồi chiêu khoảng 1-2 giây kèm nút đếm ngược, hoặc hồi máu dần); server kiểm tra; có test.
- **T33 (P3, chỉ làm nếu chơi thử thấy nhạt) Trận thú đầu đàn đồng cỏ quá ngắn.** Voltmouse cấp 15 có 399 máu, gấp 1,2 lần một Boulderhorn thường cấp 14. Nó bị hạ trong khoảng 5-8 giây khi đánh liên tục (Bogbloom đầm lầy 9-14 giây), dưới mốc "vài chục giây". Cân nhắc hệ số máu riêng cho từng thú đầu đàn (trường mới trong `ALPHAS`) thay vì đổi `ALPHA.hpMultiplier` chung.
