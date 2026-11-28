PASS
# REVIEW: T35 Dọn nhỏ sau T7 (`wildCastLevel`, `wildTriesSkill`, số trong `pals.md`), vòng 1

## Kết luận
Đủ 4 mục của PLAN.md và không đổi hành vi:
- biểu thức ba nhánh cấp chiêu và số cứng 0,06 đã rời server, chuyển vào hai hàm thuần có test tương đương;
- đường ra lệnh chiêu của thú đi theo cấp 14 có test;
- `pals.md` nói đúng số.

Tôi đã chạy lại: typecheck sạch; `skills.test.ts` qua 19/19; 5 test tích hợp liên quan qua; nạp `combat.ts` trước hay `alphas.ts` trước đều không lỗi.

## Lỗi phải sửa
Không có.

## Đã kiểm

### 1. Không đổi hành vi, số nằm trong bảng
- **`wildCastLevel`:** trùng biểu thức cũ trên đủ 240 trường hợp (cấp 1..60 × `boss` × `alpha`). `Math.min(level, WILD_SKILL_MAX_LEVEL)` bằng `wildSkillLevel`.
- **`wildTriesSkill`:** `<=` đúng là phủ định của `>` cũ, kể cả ở biên. Có 60 000 số rút có seed và test biên `chance` / `chance + 1e-9`.
- **Thứ tự rút ngẫu nhiên:** vẫn rút trước khi xét khoảng nghỉ.
- **Số không đổi:** `ALPHA.*`, `BOSS.*`, `WILD_SKILL_MAX_LEVEL`. Số 0,06 thành `WILD_SKILL_CHANCE` và được ghim bằng test.
- **Chỗ đặt `WILD_SKILL_CHANCE`:** đặt cạnh `WILD_WINDUP_MS` và các hằng số chiến đấu khác của thú hoang trong `combat.ts` là hợp lý. Mức của đầu đàn vẫn ở bảng `ALPHA`, của trùm thì dùng chung mức thường (đúng như code cũ).
- **Không còn số cứng ở server:** không còn `wildSkillLevel` hay `0.06` trong `systems/`.

### 2. Chỗ đặt module
- `skills.ts` không thể import `alphas.ts` (`alphas.ts` → `worldgen` → … sẽ tạo vòng import lớn hơn), nên chọn `combat.ts` là có lý.
- Nhưng việc này tạo một vòng **mới** `combat.ts` ↔ `alphas.ts`, vì `alphas.ts` đã import `WILD_CHASE_SPEED_FACTOR` từ `combat.ts`.
  - Hôm nay vòng này vô hại: cả hai bên chỉ dùng giá trị của bên kia trong thân hàm (và trong tham số mặc định của `wildCastLevel`, vốn chỉ chạy lúc gọi), không ở cấp module.
  - Tôi đã thử nạp mỗi file trước: không lỗi.
- Một module nhỏ `packages/shared/src/wildSkill.ts` (import `alphas.ts`, `boss.ts`, `skills.ts`) sẽ sạch hơn và không có vòng.
- **Tôi xếp việc này là góp ý, không chặn:** không sai hôm nay; nếu sau này ai dùng `ALPHA` ở cấp module trong `combat.ts` thì lỗi TDZ hiện ngay lúc nạp, test bắt được ngay. Chuyển chỉ là đổi một file và các đường import.

### 3. Tham số `caps`
- Chấp nhận được:
  - JSDoc nói rõ nó chỉ để test, và tại sao (hai mức trần hôm nay bằng nhau, 8 = 8);
  - giá trị mặc định là bảng thật;
  - server gọi không truyền `caps`.
- Mặc định tạo một object mỗi lần gọi, nhưng chỉ khi thú hoang bắt đầu một chiêu (hiếm), không mỗi khung. Không sao.

### 4. Test
- **Test tương đương** (vét cạn cho cấp, có seed cho xác suất), test tách nhánh bằng `caps`, test biên, test mức đầu đàn và test "rút đúng một lần": đều kiểm hành vi, và bắt M1-M5.
- **Hai test tích hợp lệnh chiêu cấp 14:** `fire_breath` và `healing_rain` của bubbloon. Chúng so cả `level: 14` lẫn sát thương/hồi máu bằng `skillPower(…, 14)` và lớn hơn mức ở trần 8, nên bắt M7, M8. M9 bị test có sẵn bắt.
- **Test đếm số lần rút của tester** (M6): đúng ý T35 (giữ dãy rút như cũ). Nó hơi gắn vào cách cài đặt: thứ tự rút `Math.random` trên server không ảnh hưởng gì tới người chơi, nên một thay đổi hợp lệ sau này (xét khoảng nghỉ trước để đỡ một lần rút) sẽ làm test hỏng. Chú thích trong test đã nói rõ mục đích, nên người sửa biết đó là quyết định có chủ ý. Chấp nhận; xem góp ý 3.

### 5. `pals.md`
- **Số khớp:**
  - 1 + 0,08 × 12 = 1,96;
  - (6,6 − 6,5) / 6,6 = 1,5%; (5,1 − 3,1) / 5,1 = 39%;
  - mốc 0,9375 = 7,5 / 8;
  - cấp tối đa theo vùng khớp bảng trong PLAN.md. Tester đã tính lại mọi số.
- **Nguồn ghi rõ:** `dangerAt`/`wildMaxLevel`, điểm (256, 240), và `BALANCE.md` của T7 cho số trước T7.
- Câu về unit test sửa đúng thành "tới 14 (`wildMaxLevel(1)`), chặt hơn 13".

### 6. Quy ước
- JSDoc tiếng Anh cho hằng số, interface và hai hàm. Tên `camelCase`/`UPPER_SNAKE_CASE`. Import có `.ts`.
- `wildTriesSkill` nhận `random` từ ngoài, đúng luật hàm thuần.

### 7. Ràng buộc
- Không đổi `tests/e2e`, `packages/client`, dữ liệu JSON, `.claude/`, `package-lock.json`.
- `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **Bỏ vòng import mới:** chuyển `WILD_SKILL_CHANCE`, `WildCaster`, `wildCastLevel`, `wildTriesSkill` sang `packages/shared/src/wildSkill.ts` (import `alphas.ts`, `boss.ts`, `skills.ts`; xuất qua barrel), và bỏ `import { ALPHA }` khỏi `combat.ts`. Sửa theo `docs/architecture.md` và `pals.md`. Test tương ứng có thể chuyển sang `wildSkill.test.ts`.
2. **`docs/architecture.md`, hàng `skills.ts`:** câu mới dính liền "hằng số lệnh chiêu Cấp chiêu…" (thiếu dấu chấm hoặc chấm phẩy), và nói về hàm nằm ở `combat.ts` ngay trong hàng của `skills.ts`. Nên thêm dấu câu, hoặc chuyển câu sang hàng `combat.ts` (hay hàng module mới nếu làm góp ý 1).
3. **Test "rút đúng một lần" trong `GameRoom.test.ts`:** có thể ghi thêm trong chú thích rằng đây là chốt cho việc tách hàm của T35, và được phép bỏ hay sửa nếu sau này cố ý đổi thứ tự rút (ví dụ xét khoảng nghỉ trước).
4. **`pals.md`, mục "Số liệu":** `combat.ts` xuất hiện hai lần. Có thể gộp thành `combat.ts` (`wildDamage`, `WILD_DAMAGE_PER_LEVEL`, `wildCastLevel`, `wildTriesSkill`, `WILD_SKILL_CHANCE`).
