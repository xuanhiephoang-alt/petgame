# PROGRESS: T7 Thú hoang cấp cao bớt nặng tay

## Vòng 1: coder
- Bản làm lại sau khi container bị thay (mọi file chưa commit đã mất, repo về `d68201a`): làm lại đúng các thay đổi của lần trước theo `PLAN.md`.
- [x] Bước 1: `WILD_DAMAGE_PER_LEVEL` = 0,08, `wildDamage` dùng hằng số (`packages/shared/src/combat.ts`)
- [x] Bước 2: `WILD_SKILL_MAX_LEVEL` = 8 và `wildSkillLevel` (`packages/shared/src/skills.ts`)
- [x] Bước 3: `GameRoom.ts` thêm import `wildSkillLevel`, nhánh thú hoang thường dùng `wildSkillLevel(pal.level)`; nhánh trùm, thú đầu đàn và `strike` giữ nguyên (`packages/server/src/rooms/GameRoom.ts`)
- [x] Bước 4-5: sửa JSDoc `ALPHA.damageMultiplier` (`packages/shared/src/alphas.ts`) và `SkillCastMessage.level` (`packages/shared/src/messages.ts`)
- [x] Bước 6: unit test `describe("wild pals' bites")`: cắn cấp 1 bằng sức cắn gốc và tăng dần, số 20 / 18 / 10, `companionDamage` 13 / 19, luật 1/3 trên mọi loài cấp 1-14 (`packages/shared/src/combat.test.ts`); `wildSkillLevel` 1 / 7 / 8 / 8 / 8, chiêu 33 / 46 / 24 / 33 / +33 (`packages/shared/src/skills.test.ts`)
- [x] Bước 7: thêm test "a common wild pal's skill is no stronger than at WILD_SKILL_MAX_LEVEL, however high its level" (Emberpup cấp 14 gửi cast `level` 8, Tàn lửa trúng 15); sửa test thú đi theo thành cấp 14, đổi tên "..., with no cap (unlike wild pals)" (cast `level` 14, Phun lửa trúng 28 > 20) (`packages/server/src/rooms/GameRoom.test.ts`)
- [x] Bước 8: `docs/architecture.md` hai dòng `skills.ts`, `combat.ts`
- Lệch kế hoạch: không có
- Lệnh đã chạy: typecheck ✓, test ✓ (282 test); không đụng client nên không chạy build/e2e

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (282, chạy 2 lần, cả hai qua)   build ✓   e2e ✓ (28, `--workers=1`, chạy với Chromium thay thế, xem "Lưu ý môi trường")   photo3d (không chạy, không đụng)
- Kiểm lại từ đầu trên cây hiện tại: HEAD `680d685` (= `a8c9551` cộng một commit chỉ có `BALANCE.md`) cộng diff code/test của coder vòng 1. Diff khớp từng bước 1-8 của PLAN.md, JSDoc đúng nguyên văn. Chạy riêng 4 test T7 (`--reporter=verbose`): đều ✓. Số test 276 → 282 (+4 combat, +1 skills, +1 GameRoom). Không test nào bị xoá hay `.skip`/`.only`. Test thú đi theo chỉ chặt hơn (cấp 10 → 14, thêm 2 kiểm).
- Đối chiếu số bằng script chỉ đọc, import thẳng `packages/shared/src/index.ts` (`/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t7-check.ts`, có thể mất cùng container). 14/14 số có tên trong PLAN.md khớp.
  - Cú cắn thú hoang thường ở cấp 6/8/11/14: Emberpup 10/11/13/14; Boulderhorn và Coralcrab 14/16/18/20; Scorchtail và Frostfang 13/14/16/18; Cactoad 11/12/14/16. Khớp bảng mục 2, cả cột "trước". Ở cấp 1, mọi loài cắn bằng sức cắn gốc.
  - `wildSkillLevel` 1/7/8/14/30 = 1/7/8/8/8. Thú hoang cấp 11 và 14: Động đất 33; Quất đuôi lửa và Hơi thở băng giá 24; Phun lửa và Kẹp càng 20; Ném đá và Vòi nước 17; Mưa hồi máu +33; Tàn lửa 15.
  - Thú đi theo cấp 14 không bị giới hạn: Động đất 46, Hơi thở băng giá 33, Phun lửa 28. `companionDamage` 9/15 = 13/19.
  - Thú đầu đàn (không bù, `ALPHA.damageMultiplier` 1):
    - máu 399/630/792/966/792/1.170;
    - cắn 16/17/28/33/35/42 → 11/11/19/22/23/27, hệ số để giữ như cũ 1,45-1,56;
    - chiêu tính ở cấp 8: chiêu thứ 3 của 4 con cấp 18-22 là 40/40/44/37, Sấm sét của Voltmouse 29.
  - Trùm không đổi: cắn 14, giậm 18, chiêu cấp 4 (Húc sừng 19, Gai đá 33), máu 1.152. `boss.ts` không có trong diff.
- Luật 1/3: duyệt 13 loài ở cấp 1-14, gồm cú cắn và mọi chiêu không phải hỗ trợ.
  - Đòn mạnh nhất là 33 (Động đất, Boulderhorn từ cấp 8): 3 × 33 = 99 < 100. Cú cắn mạnh nhất 20. Trước T7 đòn mạnh nhất là 46.
  - Hai điều kiện ngầm của luật cũng đúng. Thú hoang thường chỉ có cấp 1-14 (`rollWildLevel` với `wildMaxLevel` kẹp ở 14, `GameRoom.ts:2126`). `damage()` chỉ giảm sát thương lên người chơi (khiên, giáp; khắc hệ chỉ áp cho thú đi theo), và không chiêu nào trúng một mục tiêu nhiều lần trong một lần tung.
- Tiêu chí hoàn thành:
  - [x] `WILD_DAMAGE_PER_LEVEL` = 0,08, `wildDamage` dùng hằng số này, `companionDamage` không đổi.
  - [x] `WILD_SKILL_MAX_LEVEL` = 8 và `wildSkillLevel`, JSDoc như bước 1-2.
  - [x] `GameRoom.ts` chỉ đổi import và dòng nhánh thú hoang thường (nay là dòng 696). Nhánh trùm, nhánh đầu đàn và `strike` giữ nguyên.
  - [x] `ALPHA`, `ALPHAS`, `BOSS`, `SKILL_LEVEL_SCALING` và nhịp đánh (1200 / 450 / 2500 ms, ×1,3) không đổi. JSDoc của `damageMultiplier` và `SkillCastMessage.level` đã sửa. Không đụng client, `schema.ts`, `store.ts`.
  - [x] Unit test đủ: 20/18/10; 13/19; 1/7/8/8/8; 33/46/24/+33; luật 1/3.
  - [x] Test tích hợp đủ: thú hoang cast `level` 8, Tàn lửa trúng 15; thú đi theo cast `level` 14, Phun lửa trúng 28.
  - [x] typecheck, test, e2e qua.
  - [x] `docs/architecture.md` có hai dòng của bước 8.
  - [x] Số trong `docs/design/pals.md` (bảng đầu đàn; luật 1/3: 33 và 20) và `docs/design/skills.md` (33, 24, +33) khớp code.
- Lưu ý môi trường (không phải lỗi T7, không chặn):
  - Container mới chỉ có Chromium bản 1243 (Chrome for Testing 153) trong `/opt/pw-browsers`, còn `@playwright/test` 1.56.1 cần bản 1194. Chạy thẳng `npm run test:e2e` thì cả 28 test hỏng sau vài ms: `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
  - Cách đã làm: không chạy `playwright install`, không sửa repo hay `/opt`. Dựng một thư mục symlink tạm trong scratchpad theo bố cục bản 1194, trỏ về bản 1243, rồi chạy `PLAYWRIGHT_BROWSERS_PATH=<thư mục đó> npm run test:e2e -- --workers=1`: 28/28 qua (4,0 phút).
  - CI không bị ảnh hưởng vì tự chạy `npx playwright install --with-deps chromium`. Agent chính cần quyết cách sửa lâu dài cho môi trường cục bộ.
- Lỗi: không có.
- Test đã thêm: không (coder đã thêm đủ test PLAN.md yêu cầu).
