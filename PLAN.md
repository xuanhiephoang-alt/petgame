# PLAN: T4 Lên cấp quá chậm so với hệ thống chiêu

## Mục tiêu

- Hiện tại `xpToNext(L) = round(20 · L^1,5)` và kinh nghiệm kết liễu phẳng: hạ gục 12, bắt 25, bất kể cấp thú bị hạ.
- Theo `BALANCE.md` (đo trên `GameRoom` thật), một trận cho thú đi theo 16-53 kinh nghiệm, trung bình 31:
  - cấp 7 (chiêu thứ 2) cần khoảng 27 trận: 36 phút ở nhịp bình thường, sang buổi 2 nếu chơi thong thả;
  - cấp 15 (chiêu thứ 3) cần khoảng 210 trận: 7 buổi 40 phút.
- Con số "hơn 200 đòn trúng" trong `TASKS.md` bỏ qua kinh nghiệm kết liễu. Vấn đề thật là chiêu thứ 3.
- Ba chỗ lệch thiết kế khác:
  - thú cấp 14 cho kinh nghiệm bằng thú cấp 1, nên không có lý do đi xa;
  - bánh quả mọng cho 10 kinh nghiệm mỗi quả: ai có trại thì lên cấp nhanh gấp 2,5-7,5 lần săn thú;
  - trùm không cho kinh nghiệm.
- Hai lỗi thông báo sẽ lộ ra khi đường cong rẻ hơn:
  - Client chỉ báo "Học được chiêu mới" khi **cấp cuối** đúng bằng cấp học chiêu (`Game.ts:800`, `newSkillAt(species, msg.level)`). Một cú 250-300 kinh nghiệm (trùm, thú đầu đàn) đưa thú từ cấp 6 lên thẳng cấp 8 thì không báo chiêu cấp 7. Đường mới chỉ cần ít nhất 242 kinh nghiệm trong một lần để làm vậy. Đường cũ cần ít nhất 371, hơn mọi nguồn hiện có (tối đa 300), nên chưa gặp.
  - Khi hạ thú đầu đàn, `knockOut` cộng kinh nghiệm trước rồi mới `announce("★ ... đã hạ ...")`. Toast chỉ có một ô (`Hud.showToast` thay chữ), nên tin báo đè mất thông báo lên cấp ngay trong cùng khung hình.
- Sau nhiệm vụ, người chơi:
  - lên cấp 7 trong buổi chơi đầu, kể cả khi chơi thong thả (khoảng 15 trận: 20 phút ở nhịp bình thường, 31 phút ở nhịp thong thả);
  - lên cấp 15 sau khoảng 4 buổi ở nhịp bình thường (116 trận; 2 buổi nếu tích cực, 6 buổi nếu thong thả);
  - được thưởng nhiều hơn khi đánh thú cấp cao, nhận kinh nghiệm khi hạ trùm, có bánh từ nhiệm vụ đầu tiên;
  - luôn thấy "Học được chiêu mới" khi thú vượt qua cấp 7 hoặc 15, dù một lần nhảy mấy cấp;
  - giữ nguyên tiến trình: không thú nào tụt cấp hay mất kinh nghiệm.
- Luật chơi đã được game-designer ghi vào tài liệu thiết kế: `docs/design/pals.md` (mục mới "Kinh nghiệm và lên cấp", sửa dòng thú đầu đàn) và `docs/design/skills.md` (mục "Học chiêu"). PLAN này là phần triển khai.

## Phạm vi

Làm (một commit):
- **Shared:**
  - đường cong mới, `finishXp`, `BOSS.xp`;
  - giá bánh, bánh thưởng nhiệm vụ;
  - `skillsLearnedBetween` thay `newSkillAt`;
  - trường `fromLevel` của `LevelUpMessage`.
- **Server:**
  - kinh nghiệm hạ gục và bắt theo cấp thú bị hạ;
  - trùm cho kinh nghiệm;
  - tin lên cấp đi sau tin báo của cùng sự kiện (thú đầu đàn, trùm);
  - `grantXp` gửi `fromLevel`;
  - hook thử nghiệm `debug:xp`;
  - `sanitizeProfile` cho thú lên cấp nốt khi nạp hồ sơ.
- **Client:** thông báo lên cấp liệt kê mọi chiêu học được trong khoảng cấp vừa qua.
- **Khác:** test unit, tích hợp, một e2e; cập nhật `docs/architecture.md`.

KHÔNG làm:
- Không đổi các số sau: `XP_PER_HIT` (4), `XP_PER_KNOCKOUT` (12), `XP_PER_CAPTURE` (25), `XP_PER_WORK` (2), `SNACK_XP` (40), `ALPHA.xp` (300), `MAX_LEVEL`, `SKILL_LEVELS`. Không đổi mô tả công thức bánh ("Cho thú ăn để nhận 40 kinh nghiệm").
- Không chia kinh nghiệm cho thú đang nghỉ trong túi; không tính kinh nghiệm chiêu theo số mục tiêu trúng; không giảm kinh nghiệm khi thú đi theo cao cấp hơn thú bị hạ (phương án C của BALANCE).
- Không thêm trường `xp` vào `Reward`, không đổi `rewardText`; không đổi `schema.ts` hay dạng `Profile`.
- Không quy đổi hồ sơ cũ theo tổng kinh nghiệm; không thông báo khi thú lên cấp lúc nạp hồ sơ.
- Không đổi thời điểm cộng kinh nghiệm bắt (vẫn lúc ném trúng, trước khi bóng khép).
- Không làm hàng đợi hay ưu tiên cho toast, không đổi giao diện toast (đề xuất ghép vào T6).
- Không sửa tốc độ bỏ chạy của Voltmouse; không sửa giới hạn cấp của `debug:givePal` (đề xuất việc mới ở cuối).

## Thiết kế

### 1. Quyết định cho từng đề xuất của BALANCE.md

| # | Đề xuất | Quyết định | Lý do |
|---|---|---|---|
| 1 | Hệ số `xpToNext` 20 → 13 (`XP_CURVE`) | **Nhận.** Thêm `XP_CURVE_POWER = 1.5` để hàm không còn số cứng | 13 là hệ số lớn nhất mà người thong thả (20 trận mỗi buổi) vẫn lên cấp 15 trong 6 buổi (5,8 buổi; hệ số 14 cho 6,25). Với hệ số này họ cũng lên cấp 7 trong buổi đầu, dư 25% (15 trận trên 20). Mỗi đơn vị hệ số đổi tổng kinh nghiệm khoảng 7,7% (hệ số 12: 14 / 107 trận tới cấp 7 / 15; hệ số 14: 17 / 125). Giữ mũ 1,5 để cấp thấp vẫn nhanh (cấp 2 ngay trận đầu) và cấp 20 trở lên vẫn là đích dài hạn |
| 2-4 | `finishXp`: hạ gục và bắt thêm 10% mỗi cấp thú bị hạ | **Nhận, sửa 2 điểm.** (a) Hằng số là phần trăm nguyên `XP_PERCENT_PER_WILD_LEVEL = 10`; nhân trước, chia 100 sau. (b) Áp cho **mọi** lần bắt, kể cả thú đầu đàn | (a) Viết bằng số thực 0,1 thì 25 × 2,3 = 57,4999… làm tròn thành 57 ở cấp 14, lệch bảng BALANCE (58). Số nguyên cho đúng 57,5 → 58 và khớp cả bảng. (b) Một dòng code thay cho nhánh riêng. Bắt thú đầu đàn được 60-78 thay vì 25, tổng 360-378 so với 300 khi hạ gục: không đáng kể so với độ khó bắt (tỉ lệ ×0,4) và 6 phút hồi sinh. Hạ gục thú đầu đàn vẫn nhận `ALPHA.xp` thay cho phần hạ gục, như hiện nay và như tài liệu ghi ("300") |
| 5 | `BOSS.xp = 250` cho thú đi theo của mỗi người giúp | **Nhận.** Thông báo phần thưởng trùm thêm "· <Tên thú> +250 XP"; cộng kinh nghiệm **sau** thông báo | 250 cùng bậc thú đầu đàn (300), cộng thêm 90-220 từ đòn trong trận, khoảng 1 cấp ở cấp 10-12. Trùm là việc chung của game hợp tác nên mỗi người giúp đều nhận. Cộng sau thông báo để tin lên cấp (có thể kèm chiêu mới) đến cuối cùng |
| 6 | Bánh 4 → 8 quả mọng | **Nhận** | Còn 5 kinh nghiệm mỗi quả. Một thú làm quả ở trại 1 cho 30 kinh nghiệm mỗi phút (1,1 lần săn thú bình thường), 3 thú cho 90 (3,3 lần; trước đây 7,5 lần). Bánh nhận được (nhiệm vụ, rương, rơi) vẫn 40. Hồ sơ cũ không mất gì |
| 7-9 | +1 bánh ở nhiệm vụ `first_catch`, `snow`, `swamp` | **Nhận** | Là kinh nghiệm từ nhiệm vụ mà không đổi kiểu `Reward`, `rewardText` hay giao thức. Bánh ở nhiệm vụ đầu dạy nút "Cho ăn 🥧" ngay khi có con thú đầu tiên (40 kinh nghiệm, đủ lên cấp 2). Cả chuỗi từ 8 lên 11 bánh |
| 10 | `sanitizeProfile` gọi `addXp(..., 0)` | **Nhận** | Xem mục 3 |
| 11 | `LevelUpMessage.fromLevel`; báo mọi chiêu trong khoảng (fromLevel, level] | **Nhận, mở rộng:** hàm dùng chung `skillsLearnedBetween` (có test) thay `newSkillAt`; toast liệt kê mọi chiêu; thêm quy tắc thứ tự tin cho thú đầu đàn và trùm | Xem mục 4 |
| - | Chia kinh nghiệm cho thú đang nghỉ | **Bỏ**, đồng ý với BALANCE | Tổng kinh nghiệm mỗi trận gấp 2,8 lần mà con thú người chơi quan tâm không lên nhanh hơn. Mỗi trận thêm tới 29 lần `addXp`, kèm tin lên cấp và lần lưu cho thú ở xa. Muốn nuôi con khác đã có bánh và việc ở trại |
| - | Kinh nghiệm chiêu theo từng mục tiêu trúng | **Bỏ** | Thú hoang đứng thưa: vùng chiêu rộng nhất trúng thêm trung bình 0,1-0,2 con, tức chỉ thêm khoảng 1% kinh nghiệm |
| - | Phương án C (chống cày thú yếu) | **Chưa làm**; ghi là nút chỉnh trong tài liệu thiết kế | Cấp thú đi theo ít ảnh hưởng độ khó của thú thường; nhịp cày 6 trận mỗi phút là cực đoan |
| - | Vòng bắt rồi thả (lưu ý của T4, có từ T2) | **Không cần chặn** | Sau thay đổi, bắt rồi thả cho 0,72 lần so với hạ gục liên tục. Vòng này chỉ có lợi khi kinh nghiệm bắt gấp khoảng 3,5 lần kinh nghiệm hạ gục; hiện gấp tối đa 2,15 (ở cấp 2). Một unit test khoá tỉ lệ này ≤ 2,2 |

### 2. Số liệu chốt

**Đường cong** (`progression.ts`): `xpToNext(L) = Math.round(XP_CURVE * Math.pow(L, XP_CURVE_POWER))`, với `XP_CURVE = 13`, `XP_CURVE_POWER = 1.5`. `addXp` giữ nguyên.

| Cấp L → L+1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 14 | 20 | 29 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cũ | 20 | 57 | 104 | 160 | 224 | 294 | 370 | 632 | 1.048 | 1.789 | 3.123 |
| **Mới** | 13 | 37 | 68 | 104 | 145 | 191 | 241 | 411 | 681 | 1.163 | 2.030 |

Tổng kinh nghiệm để tới cấp: 7 = 558 (cũ 859), 15 = 4.159 (cũ 6.400), 20 = 8.727, 30 = 24.572.

**Kinh nghiệm kết liễu** (`finishXp(base, wildLevel)`):

```
level  = wildLevel hợp lệ ? max(1, floor(wildLevel)) : 1      (NaN, vô cực, < 1 coi như 1)
result = Math.round(base * (100 + XP_PERCENT_PER_WILD_LEVEL * (level - 1)) / 100)
```

| Cấp thú bị hạ | 1 | 2 | 3 | 5 | 8 | 10 | 14 | 15 | 22 |
|---|---|---|---|---|---|---|---|---|---|
| Hạ gục (`XP_PER_KNOCKOUT` 12) | 12 | 13 | 14 | 17 | 20 | 23 | 28 | 29 | 37 |
| Bắt (`XP_PER_CAPTURE` 25) | 25 | 28 | 30 | 35 | 43 | 48 | 58 | 60 | 78 |

Áp dụng:
- Hạ gục thú thường: `finishXp(XP_PER_KNOCKOUT, pal.level)`. Hạ gục thú đầu đàn: `ALPHA.xp`, thay cho phần trên.
- Bắt bất kỳ thú nào: `finishXp(XP_PER_CAPTURE, pal.level)` ngay lúc ném trúng. Thú đầu đàn thêm `ALPHA.xp` khi bóng khép, như hiện nay.
- Hạ trùm: `BOSS.xp = 250` cho thú đi theo của mỗi người trong `winners`. Ai không có thú đi theo thì không nhận, không lỗi.
- Giữ nguyên: đòn và chiêu trúng 4, làm việc 2 mỗi món, bánh 40.

**Kinh tế:** công thức `berry_snack` tốn 8 quả mọng. Nhiệm vụ `first_catch` thưởng `{ berries: 5, snacks: 1 }`, `snow` thưởng `{ greatBalls: 1, snacks: 1 }`, `swamp` thưởng `{ berries: 10, snacks: 1 }`.

**Nhịp dự kiến** (BALANCE mục 3, đường chuẩn): cấp 5 / 7 / 10 / 15 / 20 sau 6 / 15 / 40 / 116 / 255 trận (cũ 11 / 27 / 70 / 210 / 470). Bảng theo phút ở `docs/design/pals.md`.

### 3. Hồ sơ cũ

- Hồ sơ lưu `level` và `xp`, trong đó `xp` là phần dư trong cấp hiện tại. `sanitizeProfile` (đường đọc duy nhất, chạy mỗi lần nạp) kẹp cấp và kinh nghiệm như hiện nay, rồi gọi `addXp({ level, xp }, 0)` và lưu `level`, `xp` của kết quả.
- Kết quả:
  - **Không tụt cấp:** `addXp` chỉ cộng cấp.
  - **Không mất kinh nghiệm:** phần dư được giữ, phần vượt ngưỡng chuyển sang cấp sau.
  - **Tối đa +1 cấp** với mọi hồ sơ hợp lệ: đã tính cho cấp 1-29 với kinh nghiệm dư lớn nhất của đường cũ. Ví dụ cấp 6, xp 293 thành cấp 7, xp 102; cấp 14, xp 1.047 thành cấp 15, xp 366.
  - Cấp 30 thì xp về 0. Dữ liệu hỏng (xp tới 1e9) lên tối đa cấp 30: bằng đúng điều lần cộng kinh nghiệm kế tiếp sẽ làm với code cũ, nên không mở thêm lỗ hổng (hồ sơ do server ghi).
  - Gọi lại `sanitizeProfile` trên kết quả cho ra đúng nó (idempotent).
- Vì sao chọn chỗ này:
  - `onJoin` dựng `OwnedPal` từ hồ sơ đã chuẩn hoá, nên companion có đúng cấp và máu, `catchUpQuest` (gọi ở `onJoin`) tính luôn nhiệm vụ "Nuôi một con thú lên cấp 5", và sản xuất lúc vắng mặt tính theo cấp mới.
  - Lần lưu kế tiếp ghi lại số đã chuẩn hoá.
  - Không cần sửa `GameRoom.onJoin`.
- Không quy đổi theo tổng kinh nghiệm (ví dụ cấp 7 cũ có 859 thì thành cấp 8 mới). Lý do: thú cấp 13-14 sẽ nhảy 2-3 cấp và có chiêu thứ 3 mà không ai báo, trong khi không cần thiết. Người chơi cũ đã trả nhiều kinh nghiệm hơn cho cùng một cấp; chấp nhận được vì game còn đang phát triển, ít hồ sơ.
- Thú lên cấp lúc nạp không có thông báo: bảng Thú hiện cấp và chiêu vừa mở. Thanh kinh nghiệm của thú đang dở nhảy vị trí (ví dụ 50% thanh cũ ở cấp 5 thành 77%): chỉ là hiển thị.

### 4. Thông báo lên cấp

- **Tin `LevelUp`:** thêm `fromLevel` (cấp trước lần cộng). `grantXp` vẫn gửi **một** tin cho mỗi lần cộng có lên cấp, dù lên mấy cấp. Làm theo cách này (không gửi mỗi cấp một tin) vì toast chỉ có một ô: tin cấp 8 sẽ đè tin "Học được chiêu mới" của cấp 7.
- **Client:** `skillsLearnedBetween(species, msg.fromLevel, msg.level)` cho mọi chiêu có cấp học trong khoảng (fromLevel, level], theo thứ tự học.
  - Có chiêu: `"<Tên thú> lên cấp <N>! ⭐ Học được chiêu mới: <icon> <tên>[, <icon> <tên>]"`, hiện 3.200 ms (như hiện nay).
  - Không có chiêu: `"<Tên thú> lên cấp <N>! ⭐"`, thời gian mặc định.
  - Chữ bay `"<icon> <tên>!"` (kiểu `skill`) trên đầu thú đi theo cho từng chiêu, lúc 400 ms + 700 ms × thứ tự, chỉ khi thú đang có trên màn hình (giữ điều kiện cũ). Âm thanh và ánh sáng giữ nguyên.
  - Ví dụ: Emberpup cấp 6 nhận 450 kinh nghiệm thì thấy "Emberpup lên cấp 8! ⭐ Học được chiêu mới: 🔥 Phun lửa". Hai chiêu trong một lần chỉ xảy ra khi một lần cộng đưa thú từ cấp 6 trở xuống lên tới cấp 15 trở lên (ít nhất 9 cấp), ngoài lối chơi thường; vẫn hiện đúng cả hai.
- **Thứ tự tin trong cùng một sự kiện:** tin lên cấp phải là tin cuối cùng người được thưởng nhận. Tin của server tới một client theo đúng thứ tự gửi.
  - `knockOut` thú đầu đàn: `questEvent("alpha")` và `announce("★ ... đã hạ ...")` trước, `grantXp` sau. Thú thường: không có tin báo nên thứ tự không đổi gì.
  - `defeatBoss`: thông báo phần thưởng và `questEvent("boss")` trước, `grantXp(BOSS.xp)` sau.
  - Bắt thú đầu đàn: `announce` và `ALPHA.xp` đã cùng hẹn `reveal + 300` ms, tin báo được hẹn trước nên đến trước. Giữ nguyên.
  - Toast nhiệm vụ xong được client hiện trễ `QUEST_DELAY_MS` (2,1 s), nên sau đó có thể đè thông báo lên cấp. Chấp nhận: thông báo đã hiện 2,1 s, và chữ bay tên chiêu vẫn còn.
- **Khi nào một lần cộng nhảy qua cấp học chiêu:** với các nguồn hiện có, chỉ trùm (250) và thú đầu đàn (300) nhảy qua được cấp 7 (cần ít nhất 242, từ cấp 6). Không nguồn nào nhảy qua cấp 15 (cần ít nhất 756). Cách làm trên vẫn đúng nếu sau này có nguồn lớn hơn.

### 5. Điện thoại và bàn phím

- Không có nút hay phím mới. Chữ toast giữ dạng cũ. Danh sách nhiều chiêu chỉ dài hơn trong trường hợp hiếm.
- Toast trên điện thoại dọc là việc của T6.
- Bảng Thú (thanh kinh nghiệm dùng `xpToNext` của shared), bảng Chế tạo (giá lấy từ `recipes.json`) và ô nhiệm vụ ("Thưởng: 🫐 5  🥧 1") tự cập nhật theo dữ liệu, không cần sửa.
- Thẻ thú có thêm nút "Cho ăn 🥧" sớm hơn (sau nhiệm vụ đầu), làm thẻ cao hơn một chút; việc sắp nút ở T18.

## Kế hoạch triển khai

Mọi số mới nằm trong `progression.ts`, `BOSS`, `recipes.json`, `quests.ts`. Không rải số cứng trong `GameRoom.ts` hay client.

1. **`packages/shared/src/progression.ts`**
   - Thêm `export const XP_CURVE = 13;` và `export const XP_CURVE_POWER = 1.5;`, JSDoc chung: "XP from level L to L+1 = XP_CURVE × L^XP_CURVE_POWER, rounded: 13 at level 1, 191 at 6, 681 at 14". `xpToNext` dùng hai hằng số này.
   - Thêm `export const XP_PERCENT_PER_WILD_LEVEL = 10;`, JSDoc: "finishing XP grows this many percent per level of the wild pal above 1".
   - Thêm `export function finishXp(base: number, wildLevel: number): number` theo công thức ở Thiết kế mục 2. JSDoc nói: kinh nghiệm khi kết liễu (hạ gục hoặc bắt) một thú hoang cấp `wildLevel`; dùng phần trăm nguyên để x,5 làm tròn lên đúng (cấp 14 bắt: 57,5 → 58); cấp không hợp lệ coi như 1.
   - Sửa JSDoc của `XP_PER_CAPTURE` và `XP_PER_KNOCKOUT`: giá trị ở cấp 1, `finishXp` tăng theo cấp thú bị hạ.
2. **`packages/shared/src/skills.ts`**
   - Thêm `export function skillsLearnedBetween(species: PalSpecies, fromLevel: number, toLevel: number): SkillDef[]`: các chiêu của `learnset(species)` có `fromLevel < level <= toLevel`, theo thứ tự học. JSDoc: để báo sau một lần lên cấp, dù lên mấy cấp; `fromLevel >= toLevel` cho mảng rỗng.
   - **Xoá** `newSkillAt` (chỉ `Game.ts` và test dùng); chuyển hai dòng test của nó sang hàm mới (bước 11).
3. **`packages/shared/src/messages.ts`:** `LevelUpMessage` thêm `fromLevel: number`, JSDoc "the pal's level before this gain (it may have gone up several levels at once)".
4. **`packages/shared/src/boss.ts`:** trong `BOSS` thêm `xp: 250`, JSDoc "XP for the following pal of everyone who helped (on top of `reward`)".
5. **`packages/shared/src/quests.ts`:** thêm `snacks: 1` vào phần thưởng của `first_catch`, `snow`, `swamp` (Thiết kế mục 2).
6. **`packages/shared/src/data/recipes.json`:** `berry_snack.cost.berries` 4 → 8. Giữ `description`.
7. **`packages/server/src/persistence/store.ts`** (`sanitizeProfile`, vòng lặp `pals`):
   - Sau khi tính `level` và `xp` đã kẹp như hiện nay, gọi `addXp({ level, xp }, 0)` và push `level`, `xp` của kết quả. Import `addXp` từ `@petgame/shared`.
   - Chú thích ngắn: hồ sơ lưu trước khi đường cong rẻ hơn có thể dư kinh nghiệm cho cấp sau; lên cấp ngay khi đọc, không bao giờ xuống.
8. **`packages/server/src/rooms/GameRoom.ts`**
   1. Import `finishXp`.
   2. `handleThrow` (khi bắt được): `this.grantXp(client.sessionId, follower, finishXp(XP_PER_CAPTURE, pal.level))`. Đoạn `ALPHA.xp` hẹn giờ giữ nguyên.
   3. `knockOut`:
      - Tính `const xp = pal.alpha ? ALPHA.xp : finishXp(XP_PER_KNOCKOUT, pal.level);` cùng chỗ tính `loot`, trước `removePal`.
      - Trong `if (player)`: `applyReward` → khối thú đầu đàn (`questEvent(sessionId, "alpha")`, `announce(...)`) → rồi mới `if (follower) this.grantXp(sessionId, follower, xp)` → `scheduleSave`.
      - Chú thích: "after the news, so a level-up (maybe a new skill) is the last thing its owner reads". Tin `Defeated` giữ chỗ cũ.
   4. `defeatBoss`, trong vòng lặp `winners`:
      - Tìm `follower` (`player.pals.find((p) => p.id === player.activePalId)`).
      - Thông báo cũ thêm đuôi `` ` · ${getSpecies(follower.speciesId).name} +${BOSS.xp} XP` `` khi có `follower`.
      - Rồi `questEvent(sid, "boss")` (như cũ), cuối cùng `if (follower) this.grantXp(sid, follower, BOSS.xp)`, kèm cùng chú thích như trên.
      - Người đang chờ nối lại (còn trong state) vẫn nhận, như phần thưởng đồ.
   5. `grantXp`:
      - Ghi `const fromLevel = owned.level;` trước khi đổi cấp; tin `LevelUpMessage` thêm `fromLevel`.
      - Thêm JSDoc: cộng kinh nghiệm; khi lên một hay nhiều cấp thì hồi máu cho companion, báo mọi người **một** lần (kèm cấp cũ) và đẩy nhiệm vụ `palLevel`.
   6. Hook thử nghiệm `debug:xp` (trong khối `PETGAME_DEBUG === "1"`, cạnh `debug:givePal`):
      - Payload `{ amount?: number }`; `amount = Math.floor(Number(message?.amount))`.
      - Bỏ qua nếu không hữu hạn hoặc ≤ 0; kẹp tối đa 100.000.
      - Không có thú đi theo thì bỏ qua; có thì `this.grantXp(client.sessionId, follower, amount)`.
      - Chú thích: "XP for the following pal through the real path (level-ups, LevelUp, quest)".
9. **`packages/client/src/game/Game.ts`** (handler `ServerMessage.LevelUp`, khoảng dòng 795):
   - Dùng `skillsLearnedBetween(species, msg.fromLevel, msg.level)`. Chữ toast, thời gian hiện và chữ bay theo Thiết kế mục 4.
   - Đổi import `newSkillAt` thành `skillsLearnedBetween`. Không tạo object mỗi khung hình (handler chỉ chạy khi có tin).
10. **`docs/architecture.md`:**
    - Dòng `progression.ts, work.ts`: thêm đường cong `XP_CURVE`, `finishXp` (kinh nghiệm kết liễu theo cấp thú bị hạ).
    - Dòng `skills.ts`: thêm `skillsLearnedBetween`.
    - Danh sách hook `debug:*` (mục packages/server): thêm `xp` (cộng kinh nghiệm cho thú đang đi theo qua đúng đường lên cấp).
    - Mục `persistence/store.ts`: `sanitizeProfile` cho thú lên cấp nốt theo đường cong hiện tại.
11. **Test:** theo mục Test dưới đây.
12. **`PROGRESS.md`:** ghi thay đổi, số test thêm, kết quả `npm run typecheck`, `npm test`, `npm run build`, e2e.

## Giao thức

- **`messages.ts`:** `LevelUpMessage` thêm `fromLevel: number`, bắt buộc, server luôn gửi.
  - Thay đổi kiểu cộng thêm: client cũ (ví dụ còn trong bộ nhớ đệm) bỏ qua trường lạ.
  - Client mới mà gặp tin thiếu trường thì `skillsLearnedBetween` so với `undefined` cho mảng rỗng: toast không có chiêu, không lỗi.
  - Server và client sửa trong cùng nhiệm vụ.
- **Hook thử nghiệm mới** `debug:xp` (`{ amount: number }`): chỉ đăng ký khi `PETGAME_DEBUG=1`, như các hook khác. Không bao giờ bật trên server thật.
- **Không đổi:** `schema.ts` (state đồng bộ), `ClientMessage`, dạng `Profile`/`SavedPal`, `emptyProfile`.
- **Lưu game:** `sanitizeProfile` chuẩn hoá `level`/`xp` theo đường cong mới khi đọc (Thiết kế mục 3). Hồ sơ cũ vẫn đọc được, không mất dữ liệu; lần lưu sau ghi số đã chuẩn hoá.
- **Dữ liệu dùng chung, cả hai bên tự thấy:** `recipes.json` (giá bánh), `quests.ts` (phần thưởng), `BOSS.xp`, `XP_CURVE` (thanh kinh nghiệm ở bảng Thú).

## Test

Số mong đợi dưới đây đã tính bằng script với đúng `addXp` và công thức mới.

**Unit, shared**
- `packages/shared/src/progression.test.ts`:
  - Đường cong: `xpToNext(1) === 13`, `xpToNext(6) === 191`, `xpToNext(14) === 681`.
  - Tổng tới cấp 7 là 558 và tới cấp 15 là 4.159 (helper trong test cộng `xpToNext(1..L-1)`).
  - `xpToNext` tăng ngặt trên cấp 1-29.
  - Các test `addXp` hiện có giữ nguyên (chúng dùng `xpToNext()` nên tự theo đường mới).
  - `finishXp`:
    - Cấp 1 trả đúng `base`.
    - Bảng: `finishXp(12, L)` ở L = 3 / 5 / 8 / 10 / 14 là 14 / 17 / 20 / 23 / 28; `finishXp(25, L)` là 30 / 35 / 43 / 48 / 58; `finishXp(25, 15) === 60`, `finishXp(25, 22) === 78`.
    - Cấp 0, âm, `NaN` coi như 1.
    - Không giảm trên cấp 1-30.
    - Tỉ lệ `finishXp(XP_PER_CAPTURE, L) / finishXp(XP_PER_KNOCKOUT, L) <= 2.2` ở mọi cấp 1-30. Chú thích: bắt rồi thả chỉ có lợi hơn hạ gục liên tục khi tỉ lệ khoảng 3,5.
- `packages/shared/src/skills.test.ts`: thay hai dòng `newSkillAt` bằng các ca của `skillsLearnedBetween` cho Emberpup:
  - (6, 7) và (6, 8) → `["fire_breath"]`;
  - (7, 8) → `[]`;
  - (1, 30) → `["fire_breath", "flame_ring"]`;
  - (0, 1) → `["ember"]`;
  - (8, 6) → `[]`.
- `quests.test.ts` không đổi (vẫn kiểm mỗi nhiệm vụ có thưởng).

**Unit, server: `packages/server/src/persistence/store.test.ts`**
- Thêm "levels up pals saved under the old curve, never down, keeping their XP":
  - `sanitizeProfile` với các thú: leafkit cấp 6 xp 293, cấp 14 xp 1047, cấp 3 xp 10, cấp 30 xp 500, cấp 1 xp 1e9.
  - Mong đợi: (7, `293 - xpToNext(6)`), (15, `1047 - xpToNext(14)`), (3, 10), (30, 0), (30, 0).
  - Mọi thú dưới `MAX_LEVEL` có `xp < xpToNext(level)`.
  - `sanitizeProfile(kết quả)` bằng chính kết quả.
- Các test hiện có (cấp 3 xp 10; cấp 999 thành 30, xp -5 thành 0) phải qua nguyên vẹn.

**Tích hợp, server: `packages/server/src/rooms/GameRoom.test.ts`**
- **Sửa** `progression > captured pals keep the wild level and the follower earns capture XP`: hiện test chấp nhận "lên cấp hoặc xp + 25", nên với đường mới luôn qua mà không kiểm gì. Đổi thành tất định:
  - Sau lần bắt đầu, đặt thú đi theo cấp 10, xp 0 (bắt tối đa 78 < `xpToNext(10)` = 411).
  - Chờ hết hồi ném (20 tick). Đặt `level = 8` cho thú hoang sẽ bị bắt (`[...room.state.pals.entries()][0]`, đúng con `capture()` dùng) ngay trước lần bắt thứ hai.
  - Kiểm: `player.pals[1].level === 8`, `follower.xp === finishXp(XP_PER_CAPTURE, 8)` (43) và lớn hơn `XP_PER_CAPTURE`.
- **Thêm** `progression > knocking out a wild pal pays more XP the higher its level`:
  - `giveCompanion(..., "emberpup", 10)`, xp 0, `room.state.pals.clear()`, `placeWild` một leafkit, đặt `level = 10`, `hp = 1`.
  - Gọi `(room as any).daze(...)` rồi `(room as any).knockOut(id, pal, client.sessionId)`, như test thú đầu đàn.
  - Kiểm `owned.xp === finishXp(XP_PER_KNOCKOUT, 10)` (23).
- **Thêm** `progression > the test hook that gives XP goes through the real level-up path`:
  - Đặt `PETGAME_DEBUG=1` trước `setup()`. Lưu giá trị cũ và **trả lại** trong `finally` (không `delete`, xem T20).
  - Emberpup cấp 6, xp 0, `collect` tin `LevelUp`.
  - Gửi `debug:xp` với `{ amount: "lots" }`, `{ amount: -5 }`, `{}`: không đổi gì, không có `LevelUp`.
  - Gửi `{ amount: 450 }`: cấp 8, xp 18, đúng **một** `LevelUp` `{ palId, fromLevel: 6, level: 8 }`, `companion.level === 8`, `companion.maxHp === companionMaxHp(getSpecies("emberpup"), 8)`.
- **Thêm** `boss > the pal of everyone who helped learns BOSS.xp, after the reward notice`:
  - Dựng như test "rewards everyone who helped when defeated".
  - Trước đó: `giveCompanion(..., "emberpup", 6)`, `owned.xp = 190`, `player.palAuto = false`.
  - Thêm một người chơi thứ hai không có thú đi theo, được đưa vào `(room as any).bossHelpers`.
  - Ghi chung một mảng thứ tự `Notice` và `LevelUp` của người thứ nhất.
  - Kiểm người thứ nhất:
    - `owned.level === 8`, `owned.xp === 8` (190 + 250 − 191 − 241);
    - đúng một `LevelUp` `{ fromLevel: 6, level: 8 }`;
    - thông báo "Hạ được trùm" có `+${BOSS.xp} XP` và đứng **trước** `LevelUp` trong mảng.
  - Kiểm người thứ hai: vẫn nhận đủ `BOSS.reward`, không có `LevelUp`.
- **Thêm** `pack leaders > a big gain skips levels: one LevelUp from the old level, after the news`:
  - Emberpup cấp 6, xp 190, `palAuto = false`. Hạ Cactoad đầu đàn bằng `daze` + `knockOut` như test sẵn có.
  - Kiểm: `owned.level === 8`, `owned.xp === 58`; đúng một `LevelUp` `{ fromLevel: 6, level: 8 }`; tin "★ Tester đã hạ Cactoad đầu đàn!" đứng trước `LevelUp` trong mảng thứ tự chung.
- **Thêm** `saving > an old save with more XP than the cheaper curve needs comes back a level up, and its quest counts it`:
  - `useStore(new SqliteStore(":memory:"))`. Lưu hồ sơ dạng cũ (như test "offline production") có leafkit cấp 4, xp 159, `assignment: "follow"`, và `quest.index` là chỉ số của nhiệm vụ `trainer`.
  - Vào bằng token đó. Kiểm: thú cấp 5, xp `159 - xpToNext(4)` (55); companion cấp 5 với `maxHp === companionMaxHp(getSpecies("leafkit"), 5)`; `player.questIndex === trainer + 1`.
- **Sửa nhẹ** `exploration > starts the quest chain and completes the first catch`: thêm kiểm `player.snacks === snacksBefore + (QUESTS[0].reward.snacks ?? 0)`.
- Các test khác phải qua nguyên vẹn, gồm: thú đầu đàn (`owned.level > 1`), bánh (`snacks feed a pal for XP`), trùm (`rewards everyone who helped`).

**E2E: `tests/e2e/multiplayer.spec.ts`**
- Thêm `levels: a big XP gain over several levels still announces the skill learned on the way`. Đặt sau các helper `partyOf`/`sendFrom` (khoảng dòng 700) và dùng chúng.
- Các bước:
  1. `join` → `waitForWorld` → chờ `frames > 0`.
  2. `debug:givePal` `{ species: "emberpup", level: 6 }`; chờ `companions.size === 1`.
  3. `debug:xp` `{ amount: 450 }`.
  4. `.hud-toast` chứa "Emberpup lên cấp 8!" và "Học được chiêu mới: 🔥 Phun lửa".
  5. Mở bảng Thú (`.party-btn`): `.party-card.follow strong` chứa "Lv 8"; chip chiêu thứ hai (`.party-card.follow .skill-chip` nth 1) không có class `locked`.
- Kiểm chữ toast bằng `toContainText`: chữ vẫn nằm trong phần tử sau khi toast ẩn nên không phụ thuộc thời điểm. Không có toast nào khác lúc này: `debug:givePal` không đẩy nhiệm vụ.
- Các e2e khác không phụ thuộc số kinh nghiệm. Test "a captured pal follows…" sẽ có thêm nút "Cho ăn 🥧" trên thẻ (nhận bánh từ nhiệm vụ đầu) nhưng chỉ chọn nút theo class hoặc chữ khác, nên không ảnh hưởng.

**Lệnh** (tester): `npm run typecheck`, `npm test` (chạy lặp riêng `GameRoom.test.ts` vài lần để bắt chập chờn của các test mới), `npm run build`, `npm run test:e2e`; một test: `npx playwright test -g "levels:"`.

## Tiêu chí hoàn thành

- [ ] `xpToNext(L) = round(XP_CURVE · L^XP_CURVE_POWER)` với `XP_CURVE = 13`, `XP_CURVE_POWER = 1.5`. Unit test khoá tổng tới cấp 7 là 558 và tới cấp 15 là 4.159.
- [ ] `finishXp` dùng `XP_PERCENT_PER_WILD_LEVEL = 10` theo công thức phần trăm nguyên; đúng bảng ở Thiết kế mục 2 (gồm 58 ở cấp 14); cấp hỏng coi như 1.
- [ ] Hạ gục thú thường cho `finishXp(XP_PER_KNOCKOUT, cấp)`; hạ gục thú đầu đàn cho `ALPHA.xp`; mọi lần bắt cho `finishXp(XP_PER_CAPTURE, cấp)`; bắt thú đầu đàn thêm `ALPHA.xp` khi bóng khép (không đổi).
- [ ] Hạ trùm: thú đi theo của mỗi người trong `winners` nhận `BOSS.xp` (250). Thông báo có "+250 XP" khi có thú đi theo. Người không có thú đi theo vẫn nhận đồ, không lỗi.
- [ ] `berry_snack` tốn 8 quả mọng, mô tả giữ nguyên; `first_catch`, `snow`, `swamp` thưởng thêm 1 bánh.
- [ ] Không có số cân bằng cứng mới trong `GameRoom.ts` hay client: mọi số lấy từ `progression.ts`, `BOSS`, `ALPHA`, `recipes.json`, `quests.ts`.
- [ ] `sanitizeProfile` cho thú lên cấp nốt theo đường cong mới: không tụt cấp, không mất phần dư, tối đa +1 cấp với hồ sơ hợp lệ, cấp 30 thì xp 0, idempotent. Có unit test và test tích hợp nạp hồ sơ cũ (cấp, máu companion, nhiệm vụ `trainer`).
- [ ] `LevelUpMessage.fromLevel` được server gửi, một tin cho mỗi lần cộng. Client báo mọi chiêu trong (fromLevel, level] qua `skillsLearnedBetween`; `newSkillAt` đã xoá, không còn chỗ nào dùng.
- [ ] Hạ thú đầu đàn và hạ trùm: tin `LevelUp` đến sau tin báo của sự kiện (test tích hợp kiểm thứ tự).
- [ ] `debug:xp` chỉ có khi `PETGAME_DEBUG=1`, kiểm kiểu và giới hạn của `amount`.
- [ ] E2E mới qua; toàn bộ `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch, không nới lỏng hay bỏ qua test nào.
- [ ] `docs/architecture.md` cập nhật (progression, skills, hook `xp`, `sanitizeProfile`). `docs/design/pals.md` và `docs/design/skills.md` khớp với code (đã viết sẵn; coder sửa nếu triển khai buộc phải khác và ghi lý do vào `PROGRESS.md`).

## Rủi ro, câu hỏi mở

Không có dòng "CHẶN:". Hồ sơ cũ vẫn đọc được, không ai mất gì; tin `LevelUp` chỉ thêm trường; mọi số là hằng số dễ chỉnh lại.

- **Nhịp là ước tính:** BALANCE giả định 0,5-1,5 trận mỗi phút, chưa có số liệu người chơi thật. Các nút chỉnh đã ghi trong `docs/design/pals.md`: `XP_CURVE` 12/14, bánh 12 quả, `ALPHA.xp` 200, `XP_PER_WORK` 1, phương án C.
- **Thú đầu đàn và trùm là nguồn nhanh nhất ở cấp 7-15** (một lần hạ đầu đàn khoảng 1,4-1,8 cấp ở cấp 7). Chấp nhận: hồi sinh 6 phút (trùm 4 phút) và trận khó. Nếu thấy cày thì hạ `ALPHA.xp`.
- **Thông báo bị cắt sớm, có từ trước:**
  - Kinh nghiệm bắt được cộng lúc ném trúng. Nếu nó làm thú lên cấp, toast "Bắt được …" (hiện sau khoảng 1,9 s, khi bóng khép) đè thông báo lên cấp, và thông báo lên cấp còn lộ trước kết quả bắt.
  - Kinh nghiệm bắt nay lớn hơn (tới 78) nên chuyện này gặp nhiều hơn. Thông báo vẫn hiện khoảng 1,9 s và chữ bay tên chiêu vẫn có, nên không "mất".
  - Đề xuất ghép vào T6: toast quan trọng (học chiêu) giữ ô trong thời gian của nó, toast thường chờ sau; có thể cộng kinh nghiệm bắt sau khi bóng khép như `ALPHA.xp`.
- **Người chơi cũ** đã trả nhiều kinh nghiệm hơn cho cùng cấp, và thú lên cấp lúc nạp không được báo (Thiết kế mục 3). Chấp nhận.
- **Liên quan T7:** cấp thú đi theo điển hình sau thay đổi là 8-9 cuối buổi đầu (nhịp bình thường) và 15 sau khoảng 4 buổi; dùng các cấp này khi đo thời gian người chơi trụ được trước thú hoang cấp cao.

## Đề xuất cho TASKS.md

- **P2, việc mới: Voltmouse bỏ chạy nhanh hơn người chơi.** Thú hiền bị đánh chạy với tốc độ ×1,8 (`WILD_CHASE_SPEED_FACTOR`). Voltmouse 95 × 1,8 = 171 px/s, nhanh hơn người chơi (`PLAYER_SPEED` 160), nên hạ một con cấp 3 mất 6-8 s, gấp 3-5 lần thú khác (bot của BALANCE đo). Voltmouse chiếm 11% thú ở đồng cỏ: trải nghiệm tệ cho người mới. Gợi ý: kẹp tốc độ bỏ chạy dưới tốc độ người chơi (ví dụ tối đa 0,9 × `PLAYER_SPEED`), có test.
- **Ghép vào T6 (toast):** toast học chiêu mới không bị toast thường đè trong thời gian hiện (hàng đợi hoặc ưu tiên trong `Hud.showToast`). Cân nhắc cộng kinh nghiệm bắt sau khi bóng khép để thông báo lên cấp không lộ trước kết quả bắt.
- **Ghi chú cho T7:** dùng cấp thú đi theo 8-9 (sau buổi đầu) và 15 (sau khoảng 4 buổi) khi đo.
- **P3, ghép vào T20 (dọn nhỏ):** `debug:givePal` cho cấp tới 50, vượt `MAX_LEVEL` 30; kẹp về `MAX_LEVEL`.
- **Sau khi có người chơi thử:** xem lại nhịp thật (số trận mỗi phút), chỉnh `XP_CURVE`, giá bánh, `ALPHA.xp` theo các nút đã ghi.
