# PLAN: T35 Dọn nhỏ sau T7

Code đọc ở `585a151` ("Mark T31 done, add T95, start T35"). Nguồn:
- dòng T35 trong `TASKS.md`; `REVIEW.md` của commit T7 `95f77e3` (mục "Góp ý"); `BALANCE.md` của commit `680d685` (bảng "tình trạng hiện tại" trước T7);
- `docs/design/pals.md`: các mục "Vùng", "Sức mạnh thú hoang theo cấp";
- shared: `progression.ts` (`wildMaxLevel`, `rollWildLevel`), `worldgen.ts` (`dangerAt`), `combat.ts` (`wildDamage`, `WILD_DAMAGE_PER_LEVEL`), `skills.ts` (`WILD_SKILL_MAX_LEVEL`, `wildSkillLevel`, `knownSkills`, `skillPower`), `alphas.ts` (`ALPHA.skillLevel` 8, `ALPHA.skillChance` 0,08), `boss.ts` (`BOSS.skillLevel` 4);
- server: `systems/movement.ts` (dòng gọi `startCast("wild", …)`), `systems/skills.ts` (`wildSkill`, `orderSkill`, `obey`), `systems/wild.ts` (`spawnPal`);
- test: `GameRoom.test.ts` (test thú đi theo cấp 14 ở `knows more skills and hits harder…`), `combat.test.ts` (luật 1/3, duyệt tới `wildMaxLevel(1)`).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Không có việc hình ảnh hay cân bằng mới: số cân bằng không đổi.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Không chạy `git stash`.

## Kiểm lại từng mục

| # | Mục | Hiện trạng | Làm |
|---|---|---|---|
| 1 | `pals.md`: "ngắn hơn 20-65%" lệch bảng ngay trên | **Còn** (dòng "Trước T7 …" dưới bảng thời gian trụ). Tính lại ra 1,5-39% (xem "Số liệu"). | Sửa |
| 2 | `pals.md`: cấp tối đa trên đất liền là 13, không phải 14 | **Còn**, ở 3 câu: "cấp tối đa từ 6 … đến 14 (góc bản đồ)"; "cấp 14 cắn gấp khoảng 2 lần cấp 1"; "cú cắn mạnh nhất 20 (Boulderhorn, Coralcrab cấp 14)". Câu "12-13 ở đảo" đã đúng. Bảng XP (`finishXp`, "cấp … 14 cho … 28") là ví dụ của công thức, không nói thú hoang cấp 14 có thật; giữ nguyên. | Sửa 3 câu |
| 3 | Gom ba nhánh chọn cấp chiêu (thường, đầu đàn, trùm) vào một hàm thuần | **Còn.** Sau T10, nhánh này nằm trong `systems/movement.ts`, ở lời gọi `this.room.skills.startCast("wild", id, pal, pal.boss ? BOSS.skillLevel : pal.alpha ? Math.min(pal.level, ALPHA.skillLevel) : wildSkillLevel(pal.level), skill, target)`. Không nằm trong `GameRoom.ts`, cũng không trong `wildSkill`. Ngay cạnh đó, `Skills.wildSkill` có một nhánh chọn **xác suất** tung chiêu theo cùng loại thú, với số cứng: `pal.alpha ? ALPHA.skillChance : 0.06`. | Làm, gồm cả nhánh xác suất (Thiết kế 2) |
| 4 | Test lệnh chiêu 1-3 khi thú đi theo trên cấp 8 (không bị giới hạn) | **Còn.** Đường tự động đã có test (thú đi theo cấp 14, `knows more skills and hits harder…`). Hai đường ra lệnh trong `Skills.obey` (chiêu đánh, và chiêu hồi máu hay khiên) truyền `owned.level` nhưng chưa test nào kiểm chúng ở trên cấp 8. | Thêm test (Thiết kế 3) |

## Số liệu (cách lấy)

Hai script chỉ đọc trong scratchpad (không commit), chạy bằng `npx tsx`, import thẳng `packages/shared/src/index.ts`. Coder hoặc tester chạy lại được theo mô tả dưới.

**Cấp tối đa:**
- Quét lưới 8 px toàn bản đồ (6400 × 4800), bỏ ô biển (`isSea`), lấy `dangerAt` lớn nhất.
- Kết quả: **0,9085** tại (256, 240), trên đảo góc tây bắc. `wildMaxLevel(0,9085)` = 6 + round(7,27) = **13**.
- Cấp 14 cần round(danger × 8) = 8, tức danger ≥ 0,9375; không ô đất nào đạt.
- `rollWildLevel` cho tối đa đúng `maxLevel`, và `spawnPal` không có đường nào khác đặt cấp thú hoang thường. Vậy cấp cao nhất gặp được là 13.

Theo vùng (`biomeAt`, độ nguy hiểm cao nhất trên đất → cấp tối đa):

| Vùng | Độ nguy hiểm cao nhất | Cấp tối đa |
|---|---|---|
| đồng cỏ | 0,222 | 8 |
| hồ | 0,219 | 8 |
| sa mạc | 0,525 | 10 |
| đầm lầy | 0,591 | 11 |
| núi tuyết | 0,587 | 11 |
| núi lửa | 0,630 | 11 |
| đảo hoang | 0,908 | 13 |

**Đòn mạnh nhất** ở cấp tối đa của vùng mỗi loài sống (`wildDamage`; `skillPower` với `wildSkillLevel`):
- cú cắn mạnh nhất là **20** (Coralcrab cấp 13, đảo hoang); Boulderhorn tối đa cấp 11, cắn **18**;
- chiêu mạnh nhất vẫn **33** (Động đất của Boulderhorn từ cấp 8; Boulderhorn tới cấp 11);
- tỉ số cắn: cấp 13 là 1 + 0,08 × 12 = **1,96** lần cấp 1 (cấp 14 là 2,04).

**"Ngắn hơn" trước T7:**
- So 5 hàng × 3 cột của bảng thời gian trụ trong `pals.md` (số sau T7) với cùng hàng, cùng cột trong bảng "tình trạng hiện tại" của `BALANCE.md` T7 (số trước T7, mô phỏng trên code trước T7; không chạy lại được trên code hiện nay). Tỉ lệ = (sau − trước) / sau.
- Kết quả: đồng cỏ 8,3 / 8,6 / **1,5**%, núi lửa 26,7 / 30,2 / 32,3%, sa mạc 27,6 / 24,7 / 9,4%, núi tuyết 18,9 / 32,1 / 26,5%, đảo hoang **39,2** / 26,1 / 27,3%.
- Khoảng: **1,5% đến 39%**. Reviewer T7 ghi "2-39%", tức làm tròn 1,5. Chỗ "20-65%" cũ là mức "sau T7 dài hơn" trong `BALANCE.md`, đo theo chiều khác.

## Mục tiêu

Tài liệu nói đúng số của dữ liệu. Ba nhánh cấp chiêu và hai nhánh xác suất của thú hoang nằm trong hai hàm thuần có unit test, không còn số cứng 0,06 trong logic. Đường ra lệnh chiêu của thú đi theo có test khẳng định nó không bị giới hạn cấp. **Không đổi hành vi.**

## Phạm vi

**Làm:** sửa `pals.md`; `wildCastLevel` và `wildTriesSkill` trong shared, cùng hằng số `WILD_SKILL_CHANCE`; hai chỗ gọi ở server; unit test; hai test tích hợp; một dòng `docs/architecture.md`.

**KHÔNG làm:**
- không đổi con số nào (`WILD_SKILL_MAX_LEVEL`, `ALPHA.*`, `BOSS.*`, 0,06), không đổi thứ tự rút `Math.random` trong `wildSkill`;
- không đổi cách chọn danh sách chiêu (`BOSS.skills` hay `knownSkills`) hay `chooseSkill`;
- không đổi `wildMaxLevel` (vẫn cho tới 14 khi danger = 1). Test luật 1/3 vẫn duyệt tới 14, chặt hơn mức gặp được.

## Thiết kế

### 1. `docs/design/pals.md`

| Chỗ | Hiện | Thành |
|---|---|---|
| mục "Vùng", sau bảng vùng | "cấp tối đa từ 6 (gần lửa trại) đến 14 (góc bản đồ), xem `dangerAt` và `wildMaxLevel`." | "cấp tối đa từ 6 (gần lửa trại) đến 13 (đảo hoang ở các góc biển), xem `dangerAt` và `wildMaxLevel`. Theo vùng: đồng cỏ và hồ 8, sa mạc 10, đầm lầy, núi tuyết, núi lửa 11, đảo hoang 13. `wildMaxLevel` cho tới 14, nhưng cấp 14 cần độ nguy hiểm ≥ 0,9375, mà đất xa nhất chỉ 0,908 (đảo tây bắc, quanh (256, 240))." Câu sau ("Cấp thấp gặp nhiều hơn …") giữ nguyên. |
| "Sức mạnh thú hoang theo cấp", gạch 8% | "8% sức cắn (cấp 14 cắn gấp khoảng 2 lần cấp 1);" | "8% sức cắn (cấp 13, cao nhất gặp được, cắn gấp 1,96 lần cấp 1);" |
| "Luật 1/3", gạch "Hiện tại" | "… cú cắn mạnh nhất 20 (Boulderhorn, Coralcrab cấp 14)." | "… cú cắn mạnh nhất 20 (Coralcrab cấp 13 ở đảo hoang; Boulderhorn tối đa cấp 11, cắn 18)." |
| "Luật 1/3", gạch "Unit test" | "Unit test giữ luật này cho mọi loài ở mọi cấp thú hoang có thể có." | "Unit test giữ luật này cho mọi loài ở mọi cấp tới 14 (`wildMaxLevel(1)`), chặt hơn cấp 13 gặp được." |
| dưới bảng thời gian trụ | "Trước T7 (cắn +15% mỗi cấp, chiêu theo đúng cấp) các số này ngắn hơn 20-65%, ví dụ đảo hoang 3,1 / 5,1 / 2,4 giây." | "Trước T7 (cắn +15% mỗi cấp, chiêu theo đúng cấp) các số này ngắn hơn từ 1,5% (đồng cỏ, 2 thú: 6,5 so với 6,6 giây) đến 39% (đảo hoang, 1 thú không giáp: 3,1 so với 5,1 giây); số trước T7 lấy từ `BALANCE.md` của T7. Ví dụ đảo hoang 3,1 / 5,1 / 2,4 giây." |

Câu "Số liệu:" ở đầu mục "Sức mạnh thú hoang theo cấp" thêm `wildCastLevel`, `wildTriesSkill` (`skills.ts`).

### 2. Hai hàm thuần cho chiêu của thú hoang

Đặt trong `packages/shared/src/skills.ts`, cạnh `wildSkillLevel`. Nếu import `ALPHA` (`alphas.ts`) và `BOSS` (`boss.ts`) vào `skills.ts` tạo vòng import, thì đặt trong `combat.ts` (đã import `skills.ts` và `boss.ts`). Coder kiểm bằng `npm run typecheck` và chạy test.

```ts
/** A wild pal's chance (each tick it fights) to start a skill: common pals and the boss; pack leaders use ALPHA.skillChance. */
export const WILD_SKILL_CHANCE = 0.06;

/** Who casts, as far as how strong and how often its skills are. */
export interface WildCaster { level: number; boss: boolean; alpha: boolean }

/**
 * The level a wild pal's skill is as strong as: the boss always BOSS.skillLevel; a pack leader its own level up to
 * ALPHA.skillLevel; any other its own up to WILD_SKILL_MAX_LEVEL (wildSkillLevel). `caps` is only for tests: the real
 * caps are equal today (8 and 8), so a test passes different ones to tell the branches apart.
 */
export function wildCastLevel(pal: WildCaster, caps = { wild: WILD_SKILL_MAX_LEVEL, alpha: ALPHA.skillLevel, boss: BOSS.skillLevel }): number

/** Whether a fighting wild pal tries a skill this tick: `random()` (in [0, 1)) at most its chance. */
export function wildTriesSkill(pal: Pick<WildCaster, "alpha">, random: () => number): boolean
```

**Thân hàm**, đúng như các nhánh hiện nay:
- `wildCastLevel`: `pal.boss ? caps.boss : pal.alpha ? Math.min(pal.level, caps.alpha) : Math.min(pal.level, caps.wild)`. Trùm thắng nếu cả hai cờ cùng bật, như biểu thức cũ.
- `wildTriesSkill`: `random() <= (pal.alpha ? ALPHA.skillChance : WILD_SKILL_CHANCE)`. Code cũ là `Math.random() > c` thì bỏ, nên `<=` là đúng phủ định, kể cả ở biên `r === c`.

**`random` từ ngoài:** cấp chiêu không có gì ngẫu nhiên, nên `wildCastLevel` không nhận `random`. `wildTriesSkill` thì có, và nhận `random` theo luật của CLAUDE.md.

**Chỗ gọi ở server:**
- `systems/movement.ts`: `this.room.skills.startCast("wild", id, pal, wildCastLevel(pal), skill, target)`. Bỏ import `BOSS`, `ALPHA`, `wildSkillLevel` nếu không còn dùng (`noUnusedLocals`).
- `systems/skills.ts`, `wildSkill`: `if (!wildTriesSkill(pal, Math.random) || (this.room.skillGapUntil.get(`w:${id}`) ?? 0) > now) return undefined;`. Vẫn rút ngẫu nhiên **trước** khi xét khoảng nghỉ, nên dãy `Math.random` của server không đổi.

`WildPal` (schema) có `level`, `boss`, `alpha`, nên truyền thẳng được.

Số liệu vẫn nằm trong bảng: `ALPHA.skillLevel`, `ALPHA.skillChance`, `BOSS.skillLevel`, `WILD_SKILL_MAX_LEVEL`, và `WILD_SKILL_CHANCE` mới (thay số cứng 0,06). Sửa chú thích `ChooseSkill`/`messages.ts` (trường `level` của `SkillCastMessage`) nếu nó nhắc tên cũ: thêm "(`wildCastLevel`)".

### 3. Test lệnh chiêu của thú đi theo trên cấp 8

Trong `GameRoom.test.ts`, cạnh test `knows more skills and hits harder at higher levels, with no cap (unlike wild pals)`, thêm hai test. Cả hai dùng `player.palAuto = false`, để chỉ lệnh mới làm thú tung chiêu.

- **Chiêu đánh theo lệnh:**
  - `giveCompanion(..., "emberpup", 14)`; một `pebblet` cách 60 px, `maxHp = hp = 999`;
  - `client.send(ClientMessage.PalSkill, { skill: "fire_breath" })` (Emberpup có Phun lửa từ trước cấp 14; coder kiểm `knownSkills`).

  Mong đợi:
  - `SkillCast` có `caster: "companion"`, `skill: "fire_breath"`, `level: 14`;
  - `Hit` với `skill: "fire_breath"` có `damage === skillPower(getSkill("fire_breath"), 14)`, và lớn hơn `skillPower(…, WILD_SKILL_MAX_LEVEL)`;
  - `control.skillOrder` đã được xoá.
- **Chiêu hồi máu hoặc khiên theo lệnh** (nhánh `isSupport` của `obey`):
  - chọn một loài trong `PAL_SPECIES` biết một chiêu `heal` ở cấp ≤ 14 (coder tìm bằng `knownSkills(species, 14).find(isSupport)`, ghi tên loài trong test);
  - cho thú cấp 14; người chơi bị thương (`hp = 30`) nếu là chiêu hồi máu;
  - gửi `PalSkill` với chiêu đó.

  Mong đợi: `SkillCast` có `level: 14`. Nếu là chiêu hồi máu: `Healed` của người chơi bằng `skillPower(skill, 14)`, kẹp theo máu tối đa nếu cần (đặt `hp` đủ thấp để không bị kẹp), và lớn hơn `skillPower(skill, WILD_SKILL_MAX_LEVEL)`. Nếu dữ liệu chỉ có chiêu khiên ở cấp ≤ 14, chỉ kiểm `level: 14`.

## Kế hoạch triển khai

1. **`docs/design/pals.md`:** sửa như bảng Thiết kế 1.
2. **`packages/shared/src/skills.ts`** (hoặc `combat.ts`, Thiết kế 2): `WILD_SKILL_CHANCE`, `WildCaster`, `wildCastLevel`, `wildTriesSkill`, JSDoc tiếng Anh; xuất qua `index.ts` nếu shared dùng barrel.
3. **`packages/shared/src/skills.test.ts`:** `describe("wildCastLevel")`, `describe("wildTriesSkill")` (mục Test).
4. **`packages/server/src/systems/movement.ts`** và **`systems/skills.ts`:** thay hai chỗ (Thiết kế 2).
5. **`packages/server/src/rooms/GameRoom.test.ts`:** hai test của Thiết kế 3.
6. **`docs/architecture.md`:** ở chỗ nói về chiêu thú hoang (hoặc dòng `skills.ts` của shared): `wildCastLevel` (cấp chiêu: thường, đầu đàn, trùm) và `wildTriesSkill` (xác suất mỗi tick), dùng ở `movement.ts` và `Skills.wildSkill`.
7. `npm run typecheck`, `npm test`.

## Giao thức

Không đổi schema, message, `Profile`. `SkillCastMessage.level` vẫn mang cùng giá trị.

## Test

### Unit (`skills.test.ts`)

**`wildCastLevel`:**
- **Tương đương với nhánh cũ:** trong test viết lại biểu thức cũ thành hàm tham chiếu `legacyCastLevel = (p) => p.boss ? BOSS.skillLevel : p.alpha ? Math.min(p.level, ALPHA.skillLevel) : wildSkillLevel(p.level)`, có chú thích "the inline expression of movement.ts before T35". Duyệt **hết** `level` 1..60 × `boss` {false, true} × `alpha` {false, true} (240 trường hợp, tất định, nên không cần seed). Mọi trường hợp `wildCastLevel(p) === legacyCastLevel(p)`.
- **Tách được ba nhánh** bằng `caps` khác nhau, ví dụ `{ wild: 5, alpha: 7, boss: 3 }`:
  - thường cấp 9 → 5; thường cấp 4 → 4;
  - đầu đàn cấp 9 → 7; đầu đàn cấp 6 → 6;
  - trùm cấp 2 → 3 (cố định, không lấy `min`); trùm cấp 20 → 3;
  - trùm kiêm đầu đàn → 3.
- Với bảng thật: thường cấp 13 → `WILD_SKILL_MAX_LEVEL` (8); trùm → `BOSS.skillLevel` (4).

**`wildTriesSkill`:**
- **Tương đương có seed:** với `mulberry32(seed)` (shared) cho seed 1, 2, 3, rút 10 000 số cho mỗi `alpha` {false, true}. Mỗi số `r`: `wildTriesSkill({ alpha }, () => r) === !(r > (alpha ? ALPHA.skillChance : 0.06))`. Hàm tham chiếu ghi đúng số 0,06 của code cũ.
- **Biên:** `r = WILD_SKILL_CHANCE` → `true`; `r = WILD_SKILL_CHANCE + 1e-9` → `false`. Tương tự với `ALPHA.skillChance` cho đầu đàn.
- **Phân biệt hai mức:** `r = 0,07` → thường `false`, đầu đàn `true`.
- **Rút đúng một lần:** đếm số lần `random` được gọi, phải là 1.
- `WILD_SKILL_CHANCE === 0.06`, ghim số để lỡ tay đổi thì test bắt.

### Tích hợp

Thiết kế 3. Các test thú hoang tung chiêu có sẵn (`wild pals cast too…` dùng `CAST_WITHIN_TICKS`, `a common wild pal's skill is no stronger than at WILD_SKILL_MAX_LEVEL…`, thú đầu đàn, trùm) qua không đổi, vì cùng `Math.random` mock về 0.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | `wildCastLevel`: nhánh đầu đàn dùng `caps.wild` | unit "tách được ba nhánh" (với số thật thì không thấy: 8 = 8, đúng lý do có `caps`) |
| M2 | nhánh trùm dùng `Math.min(pal.level, caps.boss)` | unit (trùm cấp 2 → 2 thay vì 3) |
| M3 | xét `alpha` trước `boss` | unit "trùm kiêm đầu đàn", và test tương đương (boss + alpha, cấp > 4) |
| M4 | `wildTriesSkill` dùng `<` thay `<=` | unit "biên" |
| M5 | đầu đàn dùng `WILD_SKILL_CHANCE` | unit `r = 0,07`; test tương đương có seed |
| M6 | `wildSkill` rút ngẫu nhiên sau khi xét khoảng nghỉ | unit không bắt được (thứ tự là việc của server). Tester ghi kết quả chạy test tích hợp chiêu thú hoang; nếu không test nào hỏng thì ghi rõ: khi `Math.random` mock về 0 thì không thấy được |
| M7 | `obey`, nhánh đánh: truyền `wildSkillLevel(owned.level)` | test tích hợp "chiêu đánh theo lệnh" (`level` 8, sát thương nhỏ hơn) |
| M8 | `obey`, nhánh hồi máu/khiên: truyền `wildSkillLevel(owned.level)` | test tích hợp "hồi máu hoặc khiên theo lệnh" |
| M9 | `movement.ts` truyền `pal.level` (bỏ giới hạn) | test có sẵn `a common wild pal's skill is no stronger…` |

### Kiểm số tài liệu

Tester chạy lại hai phép tính ở mục "Số liệu" (script chỉ đọc trong scratchpad, import `packages/shared/src/index.ts`). Rồi so từng số trong các câu đã sửa của `pals.md`: 13, 0,908, 0,9375, 1,96, 20, 18, 33, 1,5%, 39%, và cấp tối đa theo vùng. Ghi kết quả vào `PROGRESS.md`.

## Tiêu chí hoàn thành

- [ ] `pals.md` sửa đúng 5 chỗ của bảng Thiết kế 1; mọi số khớp lần tính lại của tester.
- [ ] `wildCastLevel`, `wildTriesSkill`, `WILD_SKILL_CHANCE` có JSDoc. Server dùng chúng ở `movement.ts` và `Skills.wildSkill`; không còn số cứng 0,06 và biểu thức ba nhánh ở server. Thứ tự rút ngẫu nhiên không đổi.
- [ ] Unit test tương đương (duyệt hết cấp chiêu; có seed cho xác suất), test biên và test tách nhánh qua.
- [ ] Hai test tích hợp lệnh chiêu cấp 14 qua; các test thú hoang, thú đầu đàn, trùm cũ qua.
- [ ] Bảng đột biến M1-M9 cho đúng kết quả (M6 ghi rõ).
- [ ] Không đổi số cân bằng, schema, message. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test` qua.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **Quét lưới 8 px** có thể sót một điểm đất nguy hiểm hơn một chút giữa hai mắt lưới. Khoảng cách tới mốc cấp 14 (0,9375 so với 0,908) lớn hơn nhiều so với độ đổi của `dangerAt` trên một mắt lưới (đường chéo 11 px, khoảng 0,003), nên kết luận "13" chắc chắn. Mốc của vùng núi lửa (0,630 so với 0,6875 cho cấp 12) cũng vậy.
- **Số "trước T7"** không chạy lại được trên code hiện nay. Tài liệu ghi rõ nguồn là `BALANCE.md` T7, và tỉ lệ được tính trên đúng các số trong bảng.

## Đề xuất cho `TASKS.md`

Không có việc mới.
