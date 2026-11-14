# PROGRESS: T58 Kẹp tốc độ đuổi của thú đầu đàn

## Vòng 1: coder
- [x] Bước 1: `ALPHA.chaseSpeedMax = PLAYER_SPEED * 0.95` (152) có JSDoc, và hàm thuần `alphaChaseSpeed(speciesSpeed)` (`packages/shared/src/alphas.ts`; thêm import `PLAYER_SPEED` và `WILD_CHASE_SPEED_FACTOR` từ `./combat.ts`, không vòng import).
- [x] Bước 2: `packages/server/src/rooms/GameRoom.ts`: import `alphaChaseSpeed`; nhánh về hang dùng `alphaChaseSpeed(species.speed)`; nhánh đuổi dùng nó chỉ khi `pal.alpha` (kèm chú thích). Trùm (dòng 270, `bossHeadHome`) không đụng.
- [x] Bước 3: 2 unit test trong `packages/shared/src/alphas.test.ts` (cap 152, < 160, >= 144, bảng 6 thú đầu đàn, dưới/trên ngưỡng 84/85).
- [x] Bước 4: 3 test tích hợp trong `describe("pack leaders")` của `packages/server/src/rooms/GameRoom.test.ts` (đuổi, về hang, Scorchtail thường không bị kẹp); thêm import `WILD_CHASE_SPEED_FACTOR` và hàm phụ `stepsOf`, hằng `capStep` trong describe.
- [x] Bước 5: `docs/design/pals.md` không sửa (tên khoá, tên hàm khớp tài liệu).
- Kiểm chứng test đuổi vỡ khi đảo dòng đuổi về code cũ: đã làm một lần, test "an alpha Voltmouse chases at most ALPHA.chaseSpeedMax..." vỡ với `expected 8.55 to be less than or equal to 7.600001`; 15 test còn lại qua. Đã trả code về bản mới (kiểm bằng `git diff`).
- Lệch kế hoạch: không có. (Thêm hàm phụ `stepsOf` trong describe để khỏi lặp vòng tick ở 3 test.)
- Lệnh đã chạy: typecheck ✓, test ✓ (504 test, 33 file), build ✓, test:e2e ✓ (56 test), GameRoom.test.ts 3 lần ✓ (140/140 mỗi lần). Chưa commit.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (504, 33 file)   build ✓   e2e ✓ (56)   photo3d (không chạy, không đụng)
- GameRoom.test.ts chạy 3 lần: 140/140 mỗi lần, không chập chờn. Cổng 2567 và 5173 trống trước khi chạy e2e.
- Tiêu chí hoàn thành: [x] `ALPHA.chaseSpeedMax = PLAYER_SPEED * 0.95` có JSDoc  [x] `alphaChaseSpeed` thuần, không vòng import  [x] nhánh về hang dùng hàm, nhánh đuổi chỉ khi `pal.alpha`  [x] `git diff` chỉ chạm 4 file listed (+PROGRESS.md); dòng 271 (`max` đường vòng trùm) và 1697 (`bossHeadHome`) không đổi, `WILD_CHASE_SPEED_FACTOR` giữ nguyên  [x] 2 unit + 3 tích hợp qua  [x] test sẵn có qua không sửa  [x] không đổi schema/message/Profile/client  [x] tên khoá, tên hàm khớp `docs/design/pals.md`
- Đột biến (mỗi cái đã hoàn nguyên, `cmp` với bản gốc khớp):
  - a) dòng đuổi về `species.speed * WILD_CHASE_SPEED_FACTOR`: vỡ "an alpha Voltmouse chases at most ALPHA.chaseSpeedMax..."
  - b) về hang không kẹp: vỡ "...led past its leash walks home no faster..."
  - c) kẹp cho mọi thú đuổi: vỡ "a common Scorchtail still chases at the full 1.8x..."
  - d) `chaseSpeedMax` = 160, 162, 159: vỡ 2 unit (cap 152/< 160) và 2-4 test tích hợp (159 chỉ vỡ unit + Scorchtail, vì Voltmouse tích hợp vẫn đo được dưới 160 nhưng unit khoá 152)
  - e) `chaseSpeedMax` = 136 (0,85) và 143: vỡ 2 unit (khoá 152 và >= 144)
- T57 (chạy trốn, `-t "flee|runs away"`): 15 qua; cũng nằm trong 140/140 của GameRoom.test.ts.
- Test đã thêm: không (đã đủ theo PLAN.md).
