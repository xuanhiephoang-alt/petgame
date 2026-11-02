# PROGRESS: T4 Lên cấp nhanh hơn

## Vòng 1: coder

Làm đúng PLAN.md (một commit: shared + server + client + test + tài liệu). Mục này ghi đè PROGRESS.md của T3 (đã xong, còn trong lịch sử git ở `80a70ea`).

- [x] **Bước 1 `packages/shared/src/progression.ts`:** `XP_CURVE = 13`, `XP_CURVE_POWER = 1.5` (JSDoc chung), `xpToNext` dùng hai hằng số; `XP_PERCENT_PER_WILD_LEVEL = 10`; `finishXp(base, wildLevel)` theo phần trăm nguyên (nhân trước, chia 100 sau; cấp NaN, vô cực, < 1 coi như 1; phần lẻ bỏ xuống). JSDoc của `XP_PER_CAPTURE`, `XP_PER_KNOCKOUT` nói rõ là giá trị ở cấp 1.
- [x] **Bước 2 `packages/shared/src/skills.ts`:** thêm `skillsLearnedBetween(species, fromLevel, toLevel)`; **xoá** `newSkillAt` (không còn chỗ nào dùng: grep sạch).
- [x] **Bước 3 `packages/shared/src/messages.ts`:** `LevelUpMessage.fromLevel: number` (bắt buộc, kèm JSDoc).
- [x] **Bước 4 `packages/shared/src/boss.ts`:** `BOSS.xp = 250`.
- [x] **Bước 5 `packages/shared/src/quests.ts`:** `snacks: 1` thêm vào thưởng của `first_catch`, `snow`, `swamp`.
- [x] **Bước 6 `packages/shared/src/data/recipes.json`:** `berry_snack.cost.berries` 4 -> 8 (mô tả "40 kinh nghiệm" giữ nguyên).
- [x] **Bước 7 `packages/server/src/persistence/store.ts`:** `sanitizeProfile` gọi `addXp({ level, xp }, 0)` sau khi kẹp, lưu `level`, `xp` của kết quả (chú thích: lên cấp lúc đọc, không bao giờ xuống). Import `addXp`.
- [x] **Bước 8 `packages/server/src/rooms/GameRoom.ts`:**
  - `handleThrow`: kinh nghiệm bắt = `finishXp(XP_PER_CAPTURE, pal.level)` (đoạn `ALPHA.xp` hẹn giờ giữ nguyên).
  - `knockOut`: `xp = pal.alpha ? ALPHA.xp : finishXp(XP_PER_KNOCKOUT, pal.level)` tính cạnh `loot`, trước `removePal`; `questEvent("alpha")` và `announce` đi trước, `grantXp` sau (chú thích thứ tự).
  - `defeatBoss`: tìm thú đi theo của mỗi người trong `winners`; thông báo thêm đuôi ` · <Tên thú> +250 XP` khi có thú đi theo; `questEvent("boss")` rồi `grantXp(sid, follower, BOSS.xp)` cuối cùng. Người không có thú đi theo vẫn nhận đồ, không lỗi.
  - `grantXp`: JSDoc, ghi `fromLevel` trước khi đổi cấp, gửi trong `LevelUpMessage` (vẫn một tin cho mỗi lần cộng).
  - Hook `debug:xp` (`{ amount }`, trong khối `PETGAME_DEBUG === "1"` cạnh `debug:givePal`): bỏ qua nếu không có thú đi theo hoặc `amount` không hữu hạn hay <= 0; kẹp 100.000; đi qua `grantXp`.
- [x] **Bước 9 `packages/client/src/game/Game.ts`:** handler `LevelUp` dùng `skillsLearnedBetween(species, msg.fromLevel, msg.level)`: toast liệt kê mọi chiêu ("Học được chiêu mới: 🔥 Phun lửa, ..."), 3.200 ms khi có chiêu; chữ bay tên chiêu cho từng chiêu lúc 400 ms + 700 ms × thứ tự, chỉ khi thú đi theo có trên màn hình. Import đổi `newSkillAt` -> `skillsLearnedBetween`.
- [x] **Bước 10 `docs/architecture.md`:** dòng `progression.ts`, dòng `skills.ts`, hook `xp`, mục `persistence/store.ts`. `docs/design/pals.md` và `docs/design/skills.md` (designer đã viết) khớp với code, không cần sửa.
- [x] **Bước 11 Test** (+15 test, 221 -> 236; chi tiết dưới đây).
- [x] **Bước 12** typecheck, test, build, e2e (xem "Lệnh đã chạy").

### Test đã thêm hoặc sửa

- `packages/shared/src/progression.test.ts` (+7): đường cong (13 / 191 / 681), tổng tới cấp 7 = 558 và cấp 15 = 4.159, `xpToNext` tăng ngặt cấp 1-30; `finishXp`: bảng của PLAN (12: 14/17/20/23/28; 25: 30/35/43/48/58, 60 ở cấp 15, 78 ở cấp 22), nửa làm tròn lên (cấp 14 bắt = 58), cấp hỏng coi như 1 và phần lẻ bỏ xuống, không giảm theo cấp, tỉ lệ bắt / hạ gục <= 2,2 ở cấp 1-30.
- `packages/shared/src/skills.test.ts` (+1, thay hai dòng `newSkillAt`): ca của PLAN `(6,7)`, `(6,8)`, `(7,8)`, `(1,30)`, `(0,1)`, `(8,6)`, thêm `(6,15)`, `(7,15)`, `(14,15)`, `(7,7)`, `NaN`.
- `packages/shared/src/crafting.test.ts` (+1): bánh tốn 8 quả mọng và mô tả có đúng `SNACK_XP` kinh nghiệm.
- `packages/server/src/persistence/store.test.ts` (+1): "levels up pals saved under the old curve, never down, keeping their XP" (5 thú như PLAN, `xp < xpToNext(level)`, idempotent).
- `packages/server/src/rooms/GameRoom.test.ts` (+5 mới, 2 sửa):
  - **Sửa** `progression > captured pals keep the wild level...`: tất định (thú đi theo cấp 10, xp 0; thú bị bắt cấp 8; `follower.xp === finishXp(XP_PER_CAPTURE, 8)` = 43, lớn hơn 25).
  - **Sửa nhẹ** `exploration > starts the quest chain...`: kiểm thêm bánh (+ `QUESTS[0].reward.snacks > 0`).
  - **Mới** `progression > knocking out a wild pal pays more XP the higher its level` (cấp 10: 23).
  - **Mới** `progression > the test hook that gives XP goes through the real level-up path` (`{amount:"lots"}`, `-5`, `0`, `Infinity`, `{}` không đổi gì; `450` -> cấp 8, xp 18, đúng một `LevelUp` `fromLevel 6 -> 8`, companion cấp 8 + máu tối đa mới + hồi đầy).
  - **Mới** `boss > the pal of everyone who helped learns BOSS.xp, after the reward notice` (người thứ nhất: cấp 8, xp 8, một `LevelUp`, thông báo "Hạ được trùm" có "Emberpup +250 XP" và đứng trước `LevelUp`; người thứ hai không thú: đủ `BOSS.reward`, thông báo không có "XP", không có `LevelUp` của họ).
  - **Mới** `pack leaders > a big gain skips levels: one LevelUp from the old level, after the news` (cấp 8, xp 58, một `LevelUp` `6 -> 8` đứng sau "★ Tester đã hạ Cactoad đầu đàn!").
  - **Mới** `saving > an old save with more XP than the cheaper curve needs comes back a level up, and its quest counts it` (leafkit cấp 4 xp 159 -> cấp 5 xp 55, companion cấp 5 + máu, nhiệm vụ `trainer` xong).
- `tests/e2e/multiplayer.spec.ts` (+1): `levels: a big XP gain over several levels still announces the skill learned on the way` (`debug:givePal` Emberpup cấp 6, `debug:xp` 450, toast "Emberpup lên cấp 8!" + "Học được chiêu mới: 🔥 Phun lửa", bảng Thú "Lv 8", chiêu thứ hai không khoá).

### Lệch kế hoạch

- **Test hook `debug:xp` dùng `vi.stubEnv("PETGAME_DEBUG", "1")` và `vi.unstubAllEnvs()` trong `finally`** thay vì tự lưu và gán lại `process.env.PETGAME_DEBUG`. Cùng ý định (trả lại giá trị cũ, không `delete` trong test); cách tự gán lại sẽ ghi chuỗi "undefined" vào môi trường khi giá trị cũ là rỗng. Test cũ `the test hook that gives a pal says why...` giữ nguyên (việc của T20).
- **Số kỳ vọng tính từ hằng số** (`190 + BOSS.xp - xpToNext(6) - xpToNext(7)`, `190 + ALPHA.xp - ...`) thay vì viết cứng 8 và 58; ở số hiện tại cho đúng 8 và 58 như PLAN. Chỉnh `XP_CURVE` 12 hoặc 14 (các nút ghi trong `docs/design/pals.md`) không phải sửa lại con số trong test; đường cong vẫn bị khoá bởi `progression.test.ts`.
- **Test thêm ngoài PLAN** (nhỏ, cùng nhóm): `crafting.test.ts` (giá bánh và mô tả), các ca thêm của `skillsLearnedBetween` và `finishXp` ở trên, thêm `0` và `Infinity` cho hook, kiểm companion hồi đầy máu khi lên cấp, kiểm thông báo trùm của người không thú không có "XP".
- Không có lệch nào khác về code sản phẩm.

### Việc cho agent chính

- `CLAUDE.md` liệt kê hook `debug:*` còn thiếu `endGrace` (T3) và `xp` (T4); coder không sửa `CLAUDE.md`.

### Kiểm tự làm (không thay cho tester)

- **Đột biến** (đổi một chỗ, chạy test tương ứng, khôi phục và so `sha256sum`): **25/25 bị bắt.**
  - Server (11): bắt và hạ gục trả số phẳng; thú đầu đàn trả như thú thường; `xp` trước tin báo ở `knockOut` và ở `defeatBoss`; trùm không cho `xp`; thông báo trùm thiếu đuôi XP hoặc luôn có; `fromLevel` sai; `debug:xp` thiếu kiểm số hữu hạn hoặc không đi qua `grantXp`.
  - Shared, store, dữ liệu (13): `finishXp` dùng số thực (hỏng ở 58), thiếu `floor`, thiếu kiểm hữu hạn; `XP_CURVE` 20, mũ 1,4, 15% mỗi cấp; `skillsLearnedBetween` bao gồm cấp đầu, bỏ cấp cuối, chỉ cấp cuối (cách cũ); `sanitizeProfile` không gọi `addXp`; `first_catch` thiếu bánh; bánh 4 quả; `BOSS.xp` 0.
  - Client (1): toast chỉ xét cấp cuối (cách cũ): e2e `levels:` hỏng đúng ("Received string: Emberpup lên cấp 8! ⭐").
  - Một đột biến đầu của tôi (`xp` thêm trước tin báo ở `defeatBoss` mà không bỏ chỗ cũ) là đột biến sai (cộng hai lần); làm lại đúng (di chuyển) và bị bắt.
- **Chập chờn:** nhóm test mới của `GameRoom.test.ts` (7 test) chạy 8 lần liền: 8/8; 3 lần nữa khi 4 vòng lặp bận chiếm hết CPU: 3/3. E2E `levels:` lặp 3 lần: 3/3.
- Công cụ tạm (ngoài repo): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t4coder/` (`mutate.py`, `run1.py`..`run4.py`).

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch).
- `npm test` ✓ (22 file, **236 test** = 221 cũ + 15 mới, 80 s).
- `npm run build` ✓.
- E2E ✓: cả bộ `npm run test:e2e -- --workers=1` **23/23** (22 cũ + `levels:`, 4,0 phút); trước đó chạy chọn lọc (`-g "levels:|a captured pal follows|exploring:|skills:|pack leaders:|crafting at the camp"`: 6/6) và `levels:` lặp 3 lần: 3/3.
- Không để server chạy nền: cổng 2567, 2568, 5173 trống sau khi xong.

## Kiểm thử vòng 1: PASS

- typecheck ✓   test ✓ (239)   build ✓   e2e ✓ (23)   photo3d (không chạy: không đụng `tools/photo3d`)
- Máy 4 nhân, mọi lần chạy tuần tự (cổng 2567, 2568, 2571, 2598, 5173 không chạy chồng). Số lần chạy:
  - `npm run typecheck` ✓ (đầu, và sau khi tôi thêm test).
  - `npm test` **3 lần đủ bộ**: lần 1 và 2 trên bản của coder: 22 file, 236 test, 80,3 s và 80,1 s, qua. Lần 3 sau khi tôi thêm 3 test: 22 file, **239 test**, 84,5 s, qua.
  - Chín test tích hợp mới hoặc sửa của T4 (`GameRoom.test.ts -t ...`) chạy lặp **8 lần**: 8/8.
  - `npm run build` ✓. E2E cả bộ `npm run test:e2e -- --workers=1`: **23/23** (4,1 phút; `levels:` qua trong 5,5 s). `levels:` lặp riêng `--repeat-each=3`: 3/3. Không có test nào chập chờn.
- Tiêu chí hoàn thành (PLAN.md):
  - [x] Đường cong `round(13 · L^1,5)` (`XP_CURVE`, `XP_CURVE_POWER`); tổng tới cấp 7 = 558 và tới cấp 15 = 4.159 (khoá bởi `progression.test.ts`, và tính lại ở dưới).
  - [x] `finishXp` theo phần trăm nguyên (`XP_PERCENT_PER_WILD_LEVEL` = 10), đúng bảng gồm 58 ở cấp 14; cấp hỏng coi như 1.
  - [x] Hạ gục thú thường = `finishXp(12, cấp)` (cấp 10 cho 23); hạ gục đầu đàn = đúng `ALPHA.xp` (300, không cộng thêm phần hạ gục); bắt = `finishXp(25, cấp)` (cấp 8 cho 43); bắt đầu đàn: 68 lúc ném (cấp 18) rồi +300 khi bóng khép (test mới).
  - [x] Trùm: thú đi theo của mỗi người giúp nhận `BOSS.xp` = 250; thông báo có "Emberpup +250 XP"; người giúp không có thú vẫn nhận đủ đồ, không dòng XP, không lỗi.
  - [x] `berry_snack` 8 quả mọng, mô tả vẫn "40 kinh nghiệm"; `first_catch`, `snow`, `swamp` thêm 1 bánh.
  - [x] Không có số cân bằng cứng mới: phần thêm của `GameRoom.ts` và `Game.ts` chỉ có `100_000` (kẹp của hook thử nghiệm) và thời gian hiệu ứng `400 + 700·i` ms (hiển thị); mọi số cân bằng lấy từ `progression.ts`, `BOSS`, `ALPHA`, `recipes.json`, `quests.ts`.
  - [x] `sanitizeProfile` cho thú lên cấp nốt: không tụt, không mất phần dư, tối đa +1 cấp, cấp 30 thì xp 0, idempotent; có unit test, test tích hợp (cấp, máu companion, nhiệm vụ `trainer`) và kiểm trọn vẹn ở dưới.
  - [x] `LevelUpMessage.fromLevel` do server gửi, một tin cho mỗi lần cộng; client dùng `skillsLearnedBetween`; `newSkillAt` không còn trong code (grep: chỉ còn trong PLAN, PROGRESS, BALANCE).
  - [x] Tin `LevelUp` đến sau tin báo của sự kiện, cả hạ thú đầu đàn lẫn hạ trùm (hai test tích hợp kiểm thứ tự tin người nhận đọc).
  - [x] `debug:xp` chỉ có khi `PETGAME_DEBUG=1` (test mới: không đăng ký thì không cộng gì), kiểm kiểu của `amount` (chuỗi, âm, 0, vô cực, thiếu: không đổi gì). Kẹp 100.000 không quan sát được qua trạng thái (24.572 kinh nghiệm đã đủ tới cấp 30), nên không có test riêng.
  - [x] E2E mới qua; typecheck, test, build, e2e sạch. Không nới lỏng hay bỏ qua test nào: diff test không thêm `skip`, `only`, `todo`; các dòng bị bỏ chỉ là import, hai dòng `newSkillAt` (thay bằng `skillsLearnedBetween`) và điều kiện "lên cấp hoặc +25" của test bắt thú (thay bằng kiểm chặt `follower.xp === finishXp(25, 8)`).
  - [x] `docs/architecture.md` (progression, skills, hook `xp`, `sanitizeProfile`), `docs/design/pals.md` và `docs/design/skills.md` khớp với code (đối chiếu từng con số ở dưới).
- **Đối chiếu số liệu** (script chỉ đọc, import thẳng `packages/shared` và `sanitizeProfile`; 62 phép so, đều khớp):
  - Hằng số: `XP_CURVE` 13, `XP_CURVE_POWER` 1,5, `XP_PERCENT_PER_WILD_LEVEL` 10, `BOSS.xp` 250. Giữ nguyên: `XP_PER_HIT` 4, `XP_PER_KNOCKOUT` 12, `XP_PER_CAPTURE` 25, `XP_PER_WORK` 2, `SNACK_XP` 40, `ALPHA.xp` 300, `MAX_LEVEL` 30, `SKILL_LEVELS` 1/7/15.
  - `xpToNext` ở cấp 1-7, 10, 14, 20, 29: 13, 37, 68, 104, 145, 191, 241, 411, 681, 1.163, 2.030. Tổng tới cấp 3 / 5 / 7 / 10 / 15 / 20 / 30: 50 / 222 / **558** / 1.444 / **4.159** / 8.727 / 24.572; tới cấp 7 và 15 đều bằng 65,0% của đường cũ (859 và 6.400).
  - `finishXp` ở cấp 1 / 2 / 3 / 5 / 8 / 10 / 14 / 15 / 22: hạ gục 12 / 13 / 14 / 17 / 20 / 23 / 28 / 29 / 37; bắt 25 / 28 / 30 / 35 / 43 / 48 / 58 / 60 / 78. Công thức số thực (0,1 mỗi cấp) chỉ lệch ở một ô trong cấp 1-30 (bắt cấp 14: 57 so với 58), đúng lý do PLAN chọn phần trăm nguyên. Tỉ lệ bắt / hạ gục lớn nhất 2,154 (cấp 2), dưới ngưỡng 2,2. Đầu vào 0, âm, NaN, ±vô cực, `undefined`, `null`, chuỗi "5" coi như cấp 1; 0,99 là cấp 1; 2,999 là cấp 2.
  - Nhảy cấp: 242 kinh nghiệm là mức ít nhất để từ cấp 6 (dư tối đa 190) lên 8 trong một lần (đường cũ 371), 756 để từ cấp 14 lên 16; từ cấp 6 lên 15 cần ít nhất 3.602, không nguồn nào làm được, nên hai chiêu trong một tin chỉ ở ngoài lối chơi thường. Cấp 6 xp 0 nhận 450: cấp 8 dư 18 (2 cấp). Cấp 6 xp 190 nhận 300 (đầu đàn): cấp 8 dư 58; nhận 250 (trùm): cấp 8 dư 8. Bằng đúng số của test.
  - Kinh tế: bánh 8 quả (5 kinh nghiệm mỗi quả); thưởng `first_catch` {5 quả, 1 bánh}, `snow` {1 bóng xịn, 1 bánh}, `swamp` {10 quả, 1 bánh}; cả chuỗi 17 nhiệm vụ có 11 bánh, 10 nhiệm vụ đầu có 6.
  - Nhịp: với 36 kinh nghiệm mỗi trận, cấp 7 sau 15,5 trận và cấp 15 sau 115,5 trận (PLAN: 15 và 116).
- **Hồ sơ cũ** (cũng bằng script, chạy hết, không lấy mẫu): mọi cặp (cấp 1-29, xp từ 0 tới `xpToNext` cũ − 1) = **37.806 hồ sơ** qua `sanitizeProfile`: 13.234 lên cấp lúc nạp, **tối đa +1 cấp**, 0 lần tụt cấp, xp dư giữ nguyên (xp mới cộng phần đã trả cho cấp vừa lên bằng đúng xp cũ), lên cấp đúng khi dư ≥ giá mới, xp mới luôn nhỏ hơn giá cấp mới, nạp lại kết quả cho đúng kết quả (idempotent). Cấp 29 vượt giá lên cấp 30 thì xp về 0 (như `addXp` luôn làm ở cấp tối đa). Dữ liệu hỏng: cấp 1 xp 1e9 và cấp 999 xp −5 đều về cấp 30, xp 0; cấp 30 mọi xp về 0; cấp và xp là chuỗi về 1 và 0; cấp 3 xp 10 giữ nguyên. Hồ sơ trộn (6 thú): 1/19 thành 2/6; 6/293 thành 7/102; 14/1047 thành 15/366; 20/1788 thành 21/625; 29/3122 và 30/0 thành 30/0 (khớp ví dụ 102 và 366 của PLAN).
- **Thông báo lên cấp nhảy nhiều cấp:** e2e `levels:` qua (toast "Emberpup lên cấp 8! ⭐ Học được chiêu mới: 🔥 Phun lửa", bảng Thú "Lv 8", chiêu thứ hai không khoá). Tích hợp: hạ Cactoad đầu đàn cấp 6 → 8 cho đúng một `LevelUp` 6 → 8 đứng sau "★ ... đã hạ Cactoad đầu đàn!"; hạ trùm cho thông báo "Hạ được trùm ... Emberpup +250 XP" rồi mới `LevelUp` 6 → 8.
- **Ảnh chụp** (script ngoài repo `scratchpad/t4tester/shot-toast.mjs`, ảnh ở `scratchpad/t4tester/shots/`, đã xem 7 trong 9 ảnh bằng Read): desktop 1280×720, điện thoại dọc 390×844 (iPhone 13), điện thoại ngang 844×390. Bảng Thú ở cả ba cỡ: "Emberpup · Lv 8", hai chiêu đã học (Tàn lửa ⚔15, Phun lửa ⚔20), chiêu thứ ba khoá "Vòng lửa · Lv 15", thanh kinh nghiệm 6% (18/294). Không lỗi trang (`pageerror`) ở cả ba cỡ. Xem Quan sát 1 về toast.
- **Kiểm đột biến độc lập** (trên bản sao ngoài repo `scratchpad/t4tester/mut/` của `packages/server` và `packages/shared`, mỗi lần một chỗ; không sửa file sản phẩm trong repo): **10/10 bị bắt, đúng lý do.** (M1) hook `debug:*` luôn bật: test hook vắng hỏng (`expected [ 8, 18 ] to deeply equal [ 6, +0 ]`). (M2) bắt đầu đàn cộng `ALPHA.xp` ngay lúc ném: test mới hỏng (`[ 10, 368 ]` thay vì `[ 10, 68 ]`). (M3) bắt trả 25 phẳng: hai test hỏng (`expected 25 to be 43`). (M4) bắt đầu đàn không bao giờ cộng `ALPHA.xp` (`[ 10, 68 ]` thay vì `[ 10, 368 ]`). (M5) `knockOut` cộng kinh nghiệm trước tin đầu đàn: thứ tự hỏng (`expected 0 to be greater than 1`). (M6) `defeatBoss` cộng kinh nghiệm trước thông báo (dời chỗ, không nhân đôi): hỏng đúng thứ tự. (M6b) trùm không cho kinh nghiệm (`expected [ 6, 190 ] to deeply equal [ 8, 8 ]`). (M7) `sanitizeProfile` không lên cấp: test mới hỏng (`level 1, 13 XP: expected false to be true`). (M8) lên cấp nhưng bỏ phần dư (`level 1, 19 XP: expected +0 to be 6`). (M9) thưởng một cấp cho mọi thú có kinh nghiệm (`level 1, 1 XP: expected true to be false`).
- Không có lỗi.
- Quan sát (không chặn, không phải lỗi của T4):
  1. **Toast dài ở điện thoại** (từ ảnh chụp; bố cục toast có từ trước, PLAN đã giao T6 và dặn không đổi giao diện toast). Thông báo trùm nay có thêm " · Emberpup +250 XP". Desktop: 2 dòng, đọc đủ. Điện thoại dọc: toast 4-5 dòng đè lên thanh trạng thái và chạm tiêu đề khung nhiệm vụ (cao 124 px, toast lên cấp có chiêu cao 102 px, như trước T4). Điện thoại ngang: toast căn giữa nên phần bên phải nằm dưới minimap; đuôi "· Emberpup +250 XP" (nhất là khi trùm còn cho thêm đồ mặc) và phần giữa của toast lên cấp có chiêu bị che. Gợi ý cho T6: giới hạn bề rộng toast để không đi qua minimap, đặt toast dưới thanh trạng thái ở điện thoại dọc.
  2. `CLAUDE.md` còn thiếu `endGrace` (T3) và `xp` (T4) trong danh sách hook `debug:*` (coder đã báo; `docs/architecture.md` đã đúng): việc của agent chính.
  3. Các test cũ còn tự gán `process.env.PETGAME_DEBUG = "1"` rồi `delete` (việc T20); test mới dùng `vi.stubEnv` và `vi.unstubAllEnvs()`.
- Test đã thêm (tôi chỉ sửa file test; 236 → 239):
  - `packages/server/src/persistence/store.test.ts` (+1) `at every level, whatever XP the old curve let a pal hold: never down, at most one up, not a point lost`: mọi cấp 1-29 với 6 mức xp (0, 1, giá mới trừ 1, giá mới, nửa và tối đa của đường cũ): không tụt, tối đa +1, lên cấp đúng khi dư đủ giá mới, giữ phần dư, xp nhỏ hơn giá cấp mới, nạp lại không đổi. Bắt M7, M8, M9.
  - `packages/server/src/rooms/GameRoom.test.ts` (+2): `pack leaders > caught, it pays the catch XP for its level at once, and ALPHA.xp once the ball has clicked shut` (tiêu chí "bắt thú đầu đàn" chưa có test: cộng theo cấp lúc ném, `ALPHA.xp` chỉ khi bóng khép; bắt M2, M3, M4); `progression > the test hook that gives XP is not there on a real server (PETGAME_DEBUG not 1)` (hook chỉ có khi bật cờ; bắt M1).
- Dọn: cổng 2567, 2568, 2571, 2598, 5173 trống; không còn tiến trình nền; không để file tạm trong repo (công cụ tạm ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t4tester/`: `check-numbers.ts`, `check-exhaustive.ts`, `mutate.py`, `shot-toast.mjs`).

## Vòng 2: coder

Sửa lỗi 1 trong "Lỗi phải sửa" của `REVIEW.md` vòng 1. Không đụng chỗ nào khác của code sản phẩm; các mục cũ ở trên giữ nguyên.

- [x] **Lỗi 1 [trung bình] `packages/server/src/rooms/GameRoom.ts` (`feed`):** gọi `this.notify(...)` ("<Thú> ăn ngon lành! +40 XP") trước, rồi mới `this.grantXp(...)`, kèm chú thích như ở `knockOut` và `defeatBoss` ("After the news, so a level-up (maybe a new skill) is the last thing its owner reads."). `scheduleSave` giữ nguyên. Nhờ vậy toast lên cấp, kể cả "Học được chiêu mới", là tin cuối cùng người ăn nhận, kể cả khi cho ăn một thú đang nghỉ từ bảng Thú (khi đó toast là cách báo duy nhất vì không có chữ bay tên chiêu).
- [x] **Test** (`packages/server/src/rooms/GameRoom.test.ts`, +1, trong `describe("progression")`): `feeding a snack tells of the meal first, so a level-up (and its new skill) is the last thing read`. Emberpup cấp 6, `xp = xpToNext(6) - SNACK_XP`, 1 bánh, `palAuto = false`; ghi chung thứ tự tin `Notice` và `LevelUp` của client; gửi `ClientMessage.Feed`; kiểm bánh về 0, thú cấp 7 xp 0, và mảng thứ tự đúng `["Emberpup ăn ngon lành! +40 XP", "LevelUp 6 -> 7"]` (đúng một `LevelUp`, đứng cuối).
- [x] **Rà mọi chỗ gọi `grantXp`** (9 chỗ trong `GameRoom.ts`) tìm tin báo (`Notice`, hay toast khác) gửi sau nó cho cùng người. Chỉ `feed` mắc lỗi:

  | Chỗ | Sau `grantXp` còn gửi gì | Kết luận |
  |---|---|---|
  | `feed` | "ăn ngon lành" (`Notice`) | **lỗi, đã sửa** |
  | `knockOut`, `defeatBoss` | không còn tin báo nào (đã sửa ở vòng 1) | đúng |
  | bắt thú đầu đàn, `ALPHA.xp` | hẹn giờ cùng mốc `reveal + 300` với `announce`, `announce` hẹn trước | đúng |
  | làm việc (`XP_PER_WORK`) | `Produced` đã gửi trước; chỉ là chữ bay và âm thanh, không phải toast | không có lỗi |
  | đòn thường và chiêu trúng (`XP_PER_HIT`) | `Hit` đã gửi trước. Nếu chính đòn đó hạ trùm thì `defeatBoss` chạy trong `hitWild` (đúng thứ tự), rồi 4 kinh nghiệm cuối có thể gây thêm một `LevelUp` thứ hai (hiếm: phải sát ngưỡng). Cả hai đều là `LevelUp`, không có `Notice` sau | không có lỗi |
  | `debug:xp` | không | không có lỗi |
  | bắt thú (`finishXp`, lúc ném trúng) | `CaptureResult`: toast "Bắt được …" do client hiện khi bóng khép | PLAN đã chấp nhận (mục "Rủi ro", ghép vào T6), không đổi |

  Còn lại ngoài danh sách: `Notice` "Xong nhiệm vụ" do `questEvent("palLevel")` trong `grantXp` gây ra, client hiện trễ `QUEST_DELAY_MS` (2,1 s): PLAN đã chấp nhận.
- **Đính chính vòng 1:** câu "Chỉnh `XP_CURVE` 12 hoặc 14 không phải sửa lại con số trong test" chỉ đúng với 12. Với 14, từ cấp 6 cần 206 + 259 = 465 kinh nghiệm mới lên cấp 8, nên test hook (450), test trùm (190 + 250) và e2e `levels:` phải sửa số khi chỉnh đường cong. Giữ nguyên theo `REVIEW.md` (góp ý không bắt buộc).
- Không làm các "Góp ý không bắt buộc" khác của `REVIEW.md` (toast trùm bị đè, helper `followerOf`, JSDoc riêng của `XP_CURVE_POWER`, thông báo "+XP" ở cấp 30): ngoài phạm vi lệnh sửa lỗi này.

### Kiểm tự làm (không thay cho tester)

- **Đột biến:** đổi lại thứ tự cũ (`grantXp` rồi `notify`) trong `feed`: test mới hỏng đúng (mảng nhận được `["LevelUp 6 -> 7", "Emberpup ăn ngon lành! +40 XP"]`); khôi phục và so `sha256sum` khớp.
- **Chập chờn:** test mới cùng test `snacks feed a pal for XP` chạy 8 lần liền: 8/8.

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch).
- `npm test` ✓ (22 file, **240 test** = 239 sau vòng kiểm thử 1 + 1 mới, 85 s).
- Không chạy lại build và e2e: vòng này chỉ đổi `GameRoom.ts` (hai dòng của `feed`) và `GameRoom.test.ts`; không đụng client hay shared, và không có e2e nào cho ăn bánh. Cổng 2567, 2568, 5173 trống.

## Kiểm thử vòng 2: FAIL

- typecheck ✓   test ✗ (**240 qua, 1 hỏng**, 241 test, 22 file)   build ✓   e2e ✓ (23)   photo3d (không chạy: không đụng `tools/photo3d`)
- Máy 4 nhân, mọi lần chạy tuần tự (không chạy chồng e2e với vitest); cổng 2567, 2568, 2571, 5173 trống trước khi chạy e2e, sau khi e2e xong và lúc kết thúc. Số lần chạy:
  - `npm run typecheck` ✓ (đầu, và sau khi tôi thêm test).
  - `npm test` trên bản của coder: **2 lần**, đều 22 file, **240 test qua** (84,4 s và 84,7 s). Lần 3 sau khi tôi thêm 1 test: 241 test, 240 qua, **1 hỏng** (Lỗi 1).
  - `npm run build` ✓. E2E cả bộ `npm run test:e2e`: **23/23** (4,3 phút), không chập chờn; `levels:` qua trong 5,9 s. Chạy trên đúng bản sản phẩm của coder (test tôi thêm sau đó là test tích hợp, không đổi e2e).
- **Lỗi 1 của reviewer (`feed`: toast lên cấp bị "ăn ngon lành" đè): đã hết.**
  - Đối chiếu với bản sao vòng 1 (`scratchpad/t4tester/mut/`): từ vòng 1 chỉ đổi `GameRoom.ts` (2 dòng của `feed` đổi chỗ + 1 chú thích) và `GameRoom.test.ts` (+1 test); `packages/shared/src` giống hệt; mọi file khác của `packages/server/src` giống hệt; `find -newer REVIEW.md` chỉ ra đúng hai file đó. Nên không có chỗ nào để hồi quy ngoài `feed`.
  - Kiểm đột biến trên **bản sao ngoài repo** (`scratchpad/t4tester2/mut/`, repo không bị đụng; sau khi xong sha256 của bản sao khớp bản gốc): bản gốc qua; (A) thứ tự cũ `grantXp` rồi `notify` hỏng đúng, mảng nhận được `["LevelUp 6 -> 7", "Emberpup ăn ngon lành! +40 XP"]` thay vì ngược lại; (B) bỏ thông báo, (C) thông báo hai lần quanh lần lên cấp, (D) không cộng kinh nghiệm, (E) không trừ bánh: đều hỏng. 5/5 bị bắt.
  - Test mới của coder cùng `snacks feed a pal for XP`, `a big gain skips levels`, `the pal of everyone who helped learns BOSS.xp` chạy lặp 8 lần: 8/8.
- **Rà mọi chỗ cộng kinh nghiệm xem còn toast nào đến sau `LevelUp`** (9 chỗ gọi `grantXp` + `debug:xp`; đọc cả phía client: toast chỉ có một ô, `Hud.showToast` thay chữ ngay; chỉ `Notice`, `LevelUp` và `CaptureResult` gây toast, `Defeated` và `BossDefeated` thì không):

  | Chỗ | Sau `LevelUp` còn toast nào | Kết luận |
  |---|---|---|
  | `feed`, `knockOut`, `defeatBoss` | không | đúng (có test thứ tự) |
  | làm việc, đòn thường, chiêu trúng, `debug:xp` | không | đúng |
  | bắt thú thường (`finishXp` lúc ném) | "Bắt được …" khi bóng khép | T6, đã chấp nhận |
  | "Xong nhiệm vụ" do `questEvent` | client hiện trễ 2,1 s | PLAN đã chấp nhận |
  | **bắt thú đầu đàn, `ALPHA.xp` khi bóng khép** | **"★ … đã bắt được …" đến SAU `LevelUp`** | **Lỗi 1 (mới)** |

- **Lỗi 1 [trung bình] `packages/server/src/rooms/GameRoom.ts:931-938` (`handleThrow`, nhánh thú đầu đàn): bắt được thú đầu đàn thì tin báo "★ … đã bắt được …" đến sau `LevelUp` do 300 kinh nghiệm, nên toast lên cấp (kể cả "Học được chiêu mới") bị đè ngay trong cùng khung hình.**
  - Lệnh -> `npm test` -> `AssertionError: expected 1 to be greater than 2` tại `packages/server/src/rooms/GameRoom.test.ts:1035` (test mới `pack leaders > caught, the news of the catch comes before the level-up that the ball's click pays for`). Chạy riêng 3 lần: 3/3 hỏng (tất định, không chập chờn).
  - Tái hiện: Emberpup cấp 6, xp 0, `palAuto = false`; ném bóng trúng Cactoad đầu đàn (`Math.random` = 0); ghi chung thứ tự `Notice` và `LevelUp` của client; chờ `captureRevealMs + 300` ms. Nhận được `["Sa mạc: nóng quá! …", "LevelUp 6 -> 7", "★ Tester đã bắt được Cactoad đầu đàn!"]`. Tức toast cuối là tin báo, người chơi không đọc được "Emberpup lên cấp 7! ⭐ Học được chiêu mới: 🔥 Phun lửa" (chỉ còn chữ bay tên chiêu trên đầu thú, và chỉ khi thú đang trên màn hình).
  - Nghi do (đã xác minh bằng đọc `node_modules/@colyseus/timer/build/ClockTimer.mjs` và bằng test): `announce(..., reveal + 300)` rồi `this.clock.setTimeout(grantXp ALPHA.xp, reveal + 300)` đăng ký hai hẹn giờ cùng độ trễ, nên cùng đáo hạn trong một tick; `ClockTimer.tick()` duyệt `while (i--)`, từ cuối về đầu, nên hẹn giờ đăng ký **sau** (cộng kinh nghiệm) chạy **trước**. PLAN mục 4 và REVIEW vòng 1 giả định ngược lại ("tin báo được hẹn trước nên đến trước"). Mã này có từ trước T4 (HEAD giống hệt), nhưng nằm đúng mục tiêu T4 ("luôn thấy 'Học được chiêu mới'", "tin lên cấp là tin cuối cùng người được thưởng nhận"): 300 kinh nghiệm luôn làm thú đi theo cấp ≤ 8 lên cấp (`xpToNext(8)` = 294), nên gần như mọi lần bắt đầu đàn bằng thú đi theo cấp thấp đều gặp.
  - Cách sửa đã chạy thử trong bản sao ngoài repo (cả 8 test `pack leaders` qua, kể cả test mới và `caught, it pays the catch XP for its level at once...`): gộp thành **một** hẹn giờ, báo tin rồi cộng kinh nghiệm trong cùng hàm (thứ tự không còn phụ thuộc cách đồng hồ duyệt):
    ```ts
    this.clock.setTimeout(() => {
      this.announce(`★ ${player.name} đã bắt được ${alphaName}!`);
      if (follower && this.state.players.get(client.sessionId)?.pals.includes(follower)) this.grantXp(client.sessionId, follower, ALPHA.xp);
    }, reveal + 300);
    ```
    Kèm chú thích: hẹn giờ cùng tick chạy cái đăng ký sau trước, nên tin báo và kinh nghiệm phải chung một hẹn giờ. Không cần sửa test đã có. Tuỳ chọn: sửa dòng "tin báo được hẹn trước nên đến trước" trong `PLAN.md` mục 4, và thêm "bắt thú đầu đàn, cho ăn bánh" vào câu "Khi hạ thú đầu đàn hoặc trùm, tin lên cấp đến sau tin báo" ở `docs/design/pals.md` (dòng 111).
- Tiêu chí hoàn thành (PLAN.md), đối chiếu lại; các mục [x] đạt như vòng 1 (shared không đổi, e2e và 240 test cũ đều qua), hai mục [ ] do Lỗi 1:
  - [x] Đường cong 13 · L^1,5, tổng tới cấp 7 = 558 và cấp 15 = 4.159 (`progression.test.ts`).
  - [x] `finishXp` phần trăm nguyên, đúng bảng (58 ở cấp 14), cấp hỏng coi như 1.
  - [x] Hạ gục thường `finishXp(12, cấp)`; hạ gục đầu đàn `ALPHA.xp`; bắt `finishXp(25, cấp)`; bắt đầu đàn thêm `ALPHA.xp` khi bóng khép (số kinh nghiệm đúng; thứ tự tin xem Lỗi 1).
  - [x] Trùm: thú đi theo của mỗi người giúp nhận `BOSS.xp`, thông báo có "+250 XP", người không có thú vẫn nhận đồ.
  - [x] `berry_snack` 8 quả; `first_catch`, `snow`, `swamp` thêm 1 bánh.
  - [x] Không có số cân bằng cứng mới trong `GameRoom.ts` hay client (vòng 2 không thêm số nào).
  - [x] `sanitizeProfile` cho thú lên cấp nốt (unit + tích hợp).
  - [x] `LevelUpMessage.fromLevel`, một tin cho mỗi lần cộng; client dùng `skillsLearnedBetween`; `newSkillAt` không còn trong code.
  - [x] Hạ thú đầu đàn, hạ trùm, và nay cả cho ăn bánh: `LevelUp` đến sau tin báo (3 test thứ tự).
  - [ ] **Mục tiêu "luôn thấy 'Học được chiêu mới'" / "tin lên cấp là tin cuối cùng người được thưởng nhận" (PLAN mục Mục tiêu và Thiết kế mục 4): chưa đạt ở đường bắt thú đầu đàn** (Lỗi 1). Danh sách tiêu chí chỉ nêu "hạ" thú đầu đàn và trùm nên coder làm đúng chữ của PLAN; chỗ sai là giả định của PLAN mục 4 về thứ tự hẹn giờ (REVIEW vòng 1 cũng tin theo).
  - [x] `debug:xp` chỉ có khi `PETGAME_DEBUG=1`, kiểm kiểu và giới hạn.
  - [ ] E2E mới qua; typecheck, build, e2e sạch (23/23); **`npm test` chưa sạch: 1 test hỏng là test mới của tôi, do Lỗi 1** (không nới lỏng hay bỏ qua test nào).
  - [x] `docs/architecture.md`, `docs/design/pals.md`, `docs/design/skills.md` khớp code.
- Không thêm e2e cho đường cho ăn: để có bánh phải đi qua nhiệm vụ bắt thú đầu tiên (thêm ~20 s, có ngẫu nhiên khi ném), mà toast chỉ có một ô và client xử lý `Notice`, `LevelUp` theo đúng thứ tự đến, nên test tích hợp về thứ tự tin ở server đã chặn đúng nguyên nhân.
- Test đã thêm (tôi chỉ sửa file test; 240 → 241):
  - `packages/server/src/rooms/GameRoom.test.ts` (+1) `pack leaders > caught, the news of the catch comes before the level-up that the ball's click pays for`: Emberpup cấp 6 xp 0 bắt Cactoad đầu đàn; kiểm lúc ném chưa có `LevelUp` nào, sau khi bóng khép thú đạt đúng cấp/xp của `addXp(addXp(6/0, finishXp(25, cấp)), ALPHA.xp)` (cấp 7), có đúng một `LevelUp 6 -> 7` và nó đứng **sau** tin "★ … đã bắt được Cactoad đầu đàn!". Hiện **hỏng** (đúng thứ tự phải qua; đã chạy thử qua với cách sửa nêu trên trong bản sao). Mọi số lấy từ `addXp`, `finishXp`, `xpToNext`; tính lại bằng script (`scratchpad/t4tester2/knobs.mjs`): với Cactoad đầu đàn cấp 18, cách dựng vẫn cho "không lên cấp lúc ném, lên đúng cấp 7 lúc bóng khép" ở `XP_CURVE` 12/13/14 và `ALPHA.xp` 200/300 (chỉ hỏng ở tổ hợp giả định 12 + 300 + thú đầu đàn cấp 30, không có trong dữ liệu).
- Dọn: cổng 2567, 2568, 2571, 5173 trống, không tiến trình nền; sha256 mọi file sản phẩm khớp lúc bắt đầu (chỉ `GameRoom.test.ts` đổi, do tôi thêm test); không file tạm trong repo (công cụ tạm ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t4tester2/`: `mutate.py`, `mutA.py`, `addalpha.py`, `mut/`).

## Vòng 3: coder

Sửa Lỗi 1 của "Kiểm thử vòng 2" (vòng cuối). Không đổi test của tester; các mục cũ ở trên giữ nguyên.

- [x] **Lỗi 1 [trung bình] `packages/server/src/rooms/GameRoom.ts` (`handleThrow`, nhánh thú đầu đàn):** tin báo "★ … đã bắt được …" và `grantXp(…, ALPHA.xp)` nay chung **một** `this.clock.setTimeout` (`reveal + 300`): `this.announce(news)` rồi mới cộng kinh nghiệm (vẫn chỉ khi `follower` còn trong túi người ném). Chú thích trong code nêu lý do. Chữ tin báo (`news`) vẫn tính lúc ném như trước, không đọc `player.name` lúc hẹn giờ chạy (người chơi có thể đã rời).
  - Nguyên nhân đã xác minh trong `node_modules/@colyseus/timer/build/ClockTimer.mjs`: `tick()` duyệt `while (i--)` từ cuối về đầu, mà `announce(text, reveal + 300)` và hẹn giờ cộng kinh nghiệm cùng độ trễ nên cùng đáo hạn trong một tick; cái đăng ký **sau** (cộng kinh nghiệm) chạy trước. Giả định "tin báo được hẹn trước nên đến trước" (PLAN mục 4, REVIEW vòng 1) sai. `PLAN.md` không sửa (file của game-designer).
- [x] **Rà mọi hẹn giờ** (`grep` `setTimeout|setInterval|clock.` trong `packages/server/src`, không kể test): 9 chỗ, đều ở `GameRoom.ts`. Chỉ cặp ở trên là hai hẹn giờ cùng mốc có thứ tự ý nghĩa với tin gửi người chơi:

  | Chỗ (dòng hiện tại) | Hẹn giờ làm gì | Kết luận |
  |---|---|---|
  | 936 `handleThrow`, thú đầu đàn | tin báo + `ALPHA.xp` khi bóng khép | **lỗi, đã sửa** (gộp một hẹn giờ) |
  | 539 `onJoin` | `notify` "Trong lúc bạn đi vắng…" sau 1.500 ms | một hẹn giờ, không cặp nào cần thứ tự |
  | 1603 `announce(text, delayMs)` | chỉ hẹn giờ khi `delayMs > 0` | nay không còn chỗ gọi nào truyền `delayMs` (`knockOut` gửi ngay); để nguyên chữ ký, ngoài phạm vi |
  | 1212 `removePal`, 1635 `defeatBoss` | `spawnAlpha`, `spawnBoss` sau thời gian hồi sinh | chỉ đổi state (`spawnAlpha`, `spawnBoss` không gửi tin) |
  | 1851 `placeChest`, 1921 `growFruit`, 1944 `felled.delete` | mọc lại | chỉ đổi state |
  | 2056 `scheduleSave` | `saveNow` sau 2.000 ms | không gửi tin; nếu cùng tick với một lần cộng kinh nghiệm không lên cấp thì lần lưu kế tiếp hoặc lúc rời / rớt mạng ghi nốt (như mọi lần cộng kinh nghiệm không lên cấp) |

  Các đường còn lại (`knockOut`, `defeatBoss`, `feed`) không dùng hẹn giờ: tin báo và `grantXp` nằm trong một hàm, đúng thứ tự và có test.
- [x] **Tài liệu:** `docs/architecture.md` thêm một dòng "Thứ tự tin báo và `LevelUp`" (mọi nguồn kinh nghiệm báo trước, `grantXp` sau; hai hẹn giờ cùng tick thì cái đăng ký sau chạy trước, nên tin cần thứ tự phải chung một hẹn giờ); `docs/design/pals.md` (mục "Thông báo lên cấp") nêu cả cho ăn bánh và bóng khép trên thú đầu đàn vừa bắt, theo gợi ý của tester.

### Kiểm tự làm (không thay cho tester)

- **Đột biến** trên chính chỗ đã sửa (đổi, chạy `-t "pack leaders"`, khôi phục; `sha256sum` khớp): 4/4 bị bắt. Hai hẹn giờ như code cũ (`expected 1 to be greater than 2`, đúng lỗi tester báo); một hẹn giờ nhưng cộng kinh nghiệm trước tin báo; bỏ tin báo; bỏ cộng kinh nghiệm.
- **Chập chờn:** nhóm `pack leaders` (8 test, gồm test mới của tester) chạy 8 lần liền: 8/8; thêm 2 lần khi 4 vòng lặp bận chiếm hết CPU: 2/2.

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch).
- `npm test` ✓ (22 file, **241 test**, 88 s), kể cả `pack leaders > caught, the news of the catch comes before the level-up…` của tester.
- Không chạy lại build và e2e: vòng này chỉ đổi nhánh bắt thú đầu đàn của `GameRoom.ts` và hai file tài liệu; client và shared không đổi, và không e2e nào bắt thú đầu đàn. Cổng 2567, 2568, 5173 trống.

## Kiểm thử vòng 3: PASS

- typecheck ✓   test ✓ (242)   build ✓   e2e ✓ (23)   photo3d (không chạy: không đụng `tools/photo3d`)
- Máy 4 nhân, mọi lần chạy tuần tự (không chạy chồng e2e với vitest); cổng 2567, 2568, 2571, 5173 trống trước và sau e2e; không tiến trình nền. Số lần chạy:
  - `npm run typecheck` ✓ (đầu, và sau khi tôi thêm test).
  - `npm test` **3 lần đủ bộ**: lần 1 và 2 trên bản của coder: 22 file, **241 test**, 88,4 s và 88,2 s, qua. Lần 3 sau khi tôi thêm 1 test: **242 test**, 91,4 s, qua.
  - `npm run build` ✓.
  - E2E cả bộ `npm run test:e2e -- --workers=1`: **23/23** (4,1 phút), không test nào chập chờn; `levels:` qua trong 5,3 s, lặp riêng `--repeat-each=3`: 3/3.
- **Lỗi vòng 2 (bắt thú đầu đàn: tin "★ … đã bắt được …" đến sau `LevelUp`): đã hết.**
  - Test `pack leaders > caught, the news of the catch comes before the level-up that the ball's click pays for` (của tôi, vòng 2) qua. Lặp `pack leaders|feeding a snack|learns BOSS.xp` (11 test) **10 lần: 10/10**; thêm 5 lần (15 test mỗi lần, gồm hook `debug:xp`, hạ gục theo cấp, bắt giữ cấp) khi 4 vòng lặp bận chiếm hết CPU: **5/5**.
  - Trả code cũ trong **bản sao ngoài repo** (`scratchpad/t4tester3/mut/`, dựng mới từ file hiện tại; sha256 `GameRoom.ts` của bản sao bằng bản repo; sau khi xong khôi phục khớp và file trong repo không bị đụng). Bản gốc qua cả bốn nhóm test. Mười đột biến, **10/10 hỏng đúng lý do**:
    - M1 (đúng code cũ: `announce(news, reveal + 300)` và một `setTimeout` riêng cho `ALPHA.xp`): `AssertionError: expected 1 to be greater than 2` tại `GameRoom.test.ts:1035`, y hệt lỗi vòng 2.
    - M2 (một hẹn giờ nhưng cộng kinh nghiệm trước tin báo): cùng lỗi trên. M3 (không có tin báo): `expected -1 to be greater than or equal to 0`. M4 (không có `ALPHA.xp`): `expected [ 6, 68 ] to deeply equal [ 7, 177 ]`. M5 (tin báo và `ALPHA.xp` ngay lúc ném): `expected [ 10, 368 ] to deeply equal [ 10, 68 ]`.
    - M9 (bỏ kiểm "thú còn trong túi chủ", cộng kinh nghiệm cho thú đã đi): `expected [ {…} ] to have a length of +0 but got 1`. M10 (tin báo chỉ phát khi người ném còn đó): `expected [] to include '★ Tester đã bắt được Cactoad đầu đàn!'`.
  - Giữ chữ tin báo (`news`) tính lúc ném là đúng: người ném rời trước khi bóng khép thì mọi người vẫn nghe tin, không ai nhận kinh nghiệm (test mới bên dưới).
- **Lỗi `feed` của vòng 1: vẫn hết.** `progression > feeding a snack tells of the meal first…` qua (có trong các lần lặp trên). Đột biến đổi lại thứ tự cũ (M6): hỏng đúng, mảng nhận được bắt đầu bằng `LevelUp 6 -> 7`. Cũng thử đổi lại thứ tự cũ ở `knockOut` (M7: `expected 0 to be greater than 1`, test `a big gain skips levels`) và `defeatBoss` (M8: cùng lỗi, test `the pal of everyone who helped learns BOSS.xp`): đều hỏng đúng. Không hồi quy.
- **Phạm vi thay đổi của coder vòng 3** (đối chiếu để chắc không hồi quy): sha256 của 23 file T4 đầu vòng 2 (`scratchpad/t4tester2/baseline.sha256`, gồm `Game.ts`, store, e2e, toàn bộ phần shared) chỉ khác ở 5 file: `GameRoom.ts`, `docs/architecture.md`, `docs/design/pals.md`, `PROGRESS.md` và `GameRoom.test.ts` (hai test của tôi). So với bản sao cuối vòng 1, `GameRoom.ts` chỉ khác ở `feed` (vòng 2) và nhánh bắt thú đầu đàn (vòng 3); phần còn lại của `packages/server/src` và `packages/shared/src` giống hệt.
- **Rà mọi chỗ gửi tin quanh `LevelUp`** (đọc cả hai phía; tôi không dựa vào bảng của coder mà `grep` lại): `grantXp` có 9 chỗ gọi (`debug:xp`, làm việc, đòn thường, bắt, bóng khép của thú đầu đàn, cho ăn, `knockOut`, chiêu trúng, `defeatBoss`) và `GameRoom.ts` có đúng 9 hẹn giờ, khớp bảng vòng 3. Phía client chỉ `Notice`, `LevelUp`, `CaptureResult` gây toast từ tin của server (các toast còn lại là việc của client: vào vùng, lãnh địa đầu đàn, mẹo choáng, nối lại); `Hud.showToast` thay chữ ngay.
  - **Không còn chỗ nào cùng lỗi** (một tin báo không trễ đến sau `LevelUp` của cùng sự kiện). `feed`, `knockOut`, `defeatBoss`, bắt thú đầu đàn đều báo trước, cộng kinh nghiệm sau, và đều có test thứ tự. Hai hẹn giờ cùng mốc không còn cặp nào cần thứ tự; hàm `announce(text, delayMs)` không còn chỗ gọi nào truyền `delayMs` (chữ ký để dư, vô hại).
  - PLAN đã chấp nhận, vẫn đúng: "Bắt được …" khi bóng khép đè `LevelUp` do kinh nghiệm bắt lúc ném (T6); "Xong nhiệm vụ" client hiện trễ 2,1 s.
- Tiêu chí hoàn thành (PLAN.md), đối chiếu lại toàn bộ, không hồi quy so với vòng 1 (shared, client, store, dữ liệu không đổi từ vòng 1; script đối chiếu số liệu chạy lại: **62/62 phép so khớp, 0 lệch**; hồ sơ cũ: **37.806** cặp (cấp, xp) qua `sanitizeProfile`, 13.234 lên cấp lúc nạp, tối đa +1 cấp, 0 tụt cấp, idempotent):
  - [x] Đường cong `round(13 · L^1,5)` (`XP_CURVE`, `XP_CURVE_POWER`); tổng tới cấp 7 = 558 và cấp 15 = 4.159, khoá bởi `progression.test.ts`.
  - [x] `finishXp` phần trăm nguyên (`XP_PERCENT_PER_WILD_LEVEL` = 10), đúng bảng (58 ở cấp 14), cấp hỏng coi như 1.
  - [x] Hạ gục thường `finishXp(12, cấp)`; hạ gục đầu đàn `ALPHA.xp`; bắt `finishXp(25, cấp)`; bắt đầu đàn: theo cấp lúc ném (68 ở cấp 18) rồi `ALPHA.xp` khi bóng khép.
  - [x] Trùm: thú đi theo của mỗi người giúp nhận `BOSS.xp`; thông báo có "Emberpup +250 XP"; người không có thú vẫn nhận đủ đồ, không dòng XP, không lỗi.
  - [x] `berry_snack` 8 quả, mô tả giữ nguyên; `first_catch`, `snow`, `swamp` thêm 1 bánh.
  - [x] Không có số cân bằng cứng mới (vòng 3 không thêm số nào: `reveal + 300` có từ trước).
  - [x] `sanitizeProfile` cho thú lên cấp nốt (unit, kiểm trọn vẹn, và tích hợp: cấp, máu companion, nhiệm vụ `trainer`).
  - [x] `LevelUpMessage.fromLevel`, một tin cho mỗi lần cộng; client dùng `skillsLearnedBetween`; `newSkillAt` không còn trong code (grep sạch).
  - [x] Tin `LevelUp` đến sau tin báo: hạ thú đầu đàn, hạ trùm, cho ăn bánh, và nay cả bóng khép trên thú đầu đàn vừa bắt (4 test thứ tự; mục tiêu "luôn thấy 'Học được chiêu mới'" đạt ở mọi nguồn kinh nghiệm hiện có).
  - [x] `debug:xp` chỉ có khi `PETGAME_DEBUG=1`, kiểm kiểu và giới hạn của `amount`.
  - [x] E2E mới qua; typecheck, test, build, e2e sạch; diff test không thêm `skip`, `only`, `todo`, `fixme`; không file cấu hình test nào đổi.
  - [x] `docs/architecture.md` (progression, skills, hook `xp`, `sanitizeProfile`, dòng "Thứ tự tin báo và `LevelUp`"), `docs/design/pals.md`, `docs/design/skills.md` khớp với code.
- Không có lỗi.
- Quan sát (không chặn, không phải lỗi của T4):
  1. **Hai `LevelUp` liền nhau khi thú đi theo ra đòn kết liễu trùm** (rất hiếm). `hitWild` → `defeatBoss` → `grantXp(BOSS.xp)` (`LevelUp` A, có thể kèm chiêu mới) rồi ngay sau đó `grantXp(XP_PER_HIT)` (`GameRoom.ts:829` đòn thường, `:1473` chiêu) có thể gây `LevelUp` B nếu kinh nghiệm dư cách ngưỡng không quá 4 (khoảng 4 / `xpToNext` ≈ 1-2% mỗi lần hạ trùm). Toast B ("lên cấp N+1! ⭐") thay toast A, nên toast "Học được chiêu mới" của A mất, chỉ còn chữ bay tên chiêu. Hạ thú đầu đàn không mắc (chỉ đòn của người chơi kết liễu được thú thường, sau đó không có `XP_PER_HIT`). Coder đã ghi nhận trường hợp này ở vòng 2. Gợi ý: ghi vào T6 (hàng đợi toast) hoặc T20.
  2. `PLAN.md` mục 4 vẫn ghi giả định sai "tin báo được hẹn trước nên đến trước" (hai hẹn giờ cùng tick chạy cái đăng ký sau trước; đã xác minh lại trong `node_modules/@colyseus/timer/build/ClockTimer.mjs`, `while (i--)`). Code và `docs/architecture.md` đã đúng; chỉ PLAN lỗi thời (file của game-designer).
  3. `CLAUDE.md` còn thiếu `endGrace` (T3) và `xp` (T4) trong danh sách hook `debug:*` (việc của agent chính); toast ở điện thoại và "+XP" ở cấp 30 như ghi ở vòng 1 và `REVIEW.md`.
- Test đã thêm (tôi chỉ sửa file test; 241 → 242):
  - `packages/server/src/rooms/GameRoom.test.ts` (+1) `pack leaders > caught, if the thrower leaves before the ball clicks shut, the others still hear the news and no XP is paid`: đường mới của vòng 3 (tin báo và `ALPHA.xp` chung một hẹn giờ) chưa có test cho trường hợp người ném rời trong lúc bóng lắc. Một người xem ghi `Notice` và `LevelUp`; người ném bắt Cactoad đầu đàn rồi `leave()`; sau khi bóng khép, người xem vẫn nhận tin "★ … đã bắt được Cactoad đầu đàn!" và không có `LevelUp` nào (không ai nhận kinh nghiệm). Bắt M3, M9, M10. Lặp 10/10, và 5/5 khi CPU bị chiếm.
- Dọn: cổng 2567, 2568, 2571, 5173 trống, không tiến trình nền (4 vòng lặp tải đã dừng); chỉ `GameRoom.test.ts` đổi trong repo do tôi (bản `GameRoom.ts` đã kiểm không đổi sha256 trước và sau mọi đột biến); không file tạm trong repo (công cụ ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t4tester3/`: `mutate3.py`, `loop.sh`, nhật ký `*.log`, bản sao `mut/`).
