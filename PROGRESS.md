# PROGRESS: T2 Thả thú, túi đầy không mất thú

## Vòng 1: coder

- [x] **Bước 1-2: `packages/shared/src/capture.ts` + `capture.test.ts`.** `PARTY_FULL_TEXT` (dựng từ `MAX_PARTY`) và `throwBlocker(partySize, { boss })` (trùm xét trước, rồi túi đầy; thú đầu đàn không có nhánh riêng). Test mới `describe("throwBlocker")`: 4 test (còn chỗ, đầy hoặc quá đầy, chữ có `30/30` và "Thả bớt" mà không còn câu cũ, trùm xét trước).
- [x] **Bước 3: `packages/shared/src/messages.ts`.** `ClientMessage.Release = "release"` và `ReleaseMessage { palId }`, JSDoc tiếng Anh.
- [x] **Bước 4: `packages/server/src/rooms/GameRoom.ts`.**
  - Handler `release` cạnh `Summon`/`Assign`, chỉ gọi khi `typeof message?.palId === "string"`.
  - `handleThrow`: thứ tự cooldown, tầm ném, `inBall`, đặt `lastThrowAt`, rồi `throwBlocker`; bị chặn thì chỉ `notify`. Hai dòng cũ (trùm, đầu đàn "cho bớt thú đi") và nhánh `else { "Túi thú đã đầy" }` đã xoá; thân nhánh `success` bỏ một cấp thụt lề, kèm chú thích "đã kiểm còn chỗ ở trên, trong cùng lời gọi".
  - Hàm `release()` ngay sau `rest()`: tìm trong túi người gửi (id lạ thì bỏ qua im lặng), xoá `activePalId` nếu là thú đi theo, `despawnCompanion`, xoá `skillOrder` dành cho nó, `faintedUntil.delete`, `splice`, `Notice` "Đã thả <tên>. Tạm biệt! 👋", `scheduleSave`.
  - `debug:givePal` báo `PARTY_FULL_TEXT` khi túi đầy.
  - `grep -rn "cho bớt\|Túi thú đã đầy" packages` không ra kết quả.
- [x] **Bước 5: `packages/client/src/ui/party.ts`.** Tiêu đề `Túi thú n/30`; nút chế độ `🕊️ Thả bớt` / `✓ Xong` (`aria-pressed`, ẩn khi túi trống); chế độ thả (gợi ý đỏ, mỗi thẻ chỉ còn nút đỏ `Thả` kèm `aria-label`); hộp xác nhận dựng một lần (nền mờ chặn chạm, `role="dialog"`, focus ở `Giữ lại`, nút `Thả` khoá `CONFIRM_ARM_MS` = 500 ms, Tab/Shift+Tab chỉ đổi giữa hai nút, Escape đóng hộp trước rồi mới đóng bảng, Q đóng cả hai, chạm nền mờ là huỷ, hộp tự đóng khi con đó không còn trong túi, focus về nút chế độ); đóng bảng (✕, Q, Escape, mở bảng khác) thì chế độ thả và hộp tự tắt; nút 🐾 hiện `(30/30)` kèm class `full`; chữ túi trống mới; `swatch()` tách ra dùng chung cho thẻ và hộp; JSDoc của class cập nhật.
- [x] **Bước 6: `packages/client/src/game/Game.ts`.** `PartyPanel` thêm `release` (gửi `ClientMessage.Release`); `throwBall()` hỏi `throwBlocker` trước khi ném: bị chặn thì toast đúng câu đó 3 giây, không `send`, không `me.play("throw")`.
- [x] **Bước 7: `packages/client/index.html`.** CSS cho `.party-btn.full`, `gap` và `.party-title` ở header, `.party-release-toggle`, `.party-action.release`, `.party-hint.release`, `.party-confirm*`, `.confirm-keep`, `.confirm-release`, `:focus-visible`; đúng như PLAN.md (hộp `z-index: 5` trên bảng 3 và bản đồ lớn 4).
- [x] **Bước 8: `packages/server/src/rooms/GameRoom.test.ts`.** `describe("releasing pals and a full party")` ở cuối file, 6 test, helper `addPals`:
  1. thả con đang nghỉ; id lạ, `palId: 42`, `{}`, không payload, và con của người khác đều bị bỏ qua im lặng (không notice); state phía client cũng mất đúng con ở giữa danh sách;
  2. thả con đang đi theo và là con cuối: `activePalId`, companion, `skillOrder`, `faintedUntil`, `skillReady`, `castingUntil` đều sạch; bắt tiếp thì con mới tự đi theo;
  3. thả con đang làm việc: companion biến mất, con làm việc còn lại vẫn `work`;
  4. thả rồi vào lại phòng cùng token: con đã thả không quay lại;
  5. túi đầy: ném (cả bóng xịn, cả thú đầu đàn) không có `CaptureResult`, thú hoang không vào bóng, không trừ bóng xịn, notice đúng `PARTY_FULL_TEXT`; ném hai lần liền chỉ có một notice; thả một con rồi bắt được ngay, túi lại đầy;
  6. `debug:givePal` báo `PARTY_FULL_TEXT` khi đầy.
  - Test có sẵn "spawns one boss ... cannot be captured" vẫn qua, không sửa.
- [x] **Bước 9: `tests/e2e/multiplayer.spec.ts`.** Test `party: let a pal go after confirming; a full party cannot throw` (`test.slow()`), đặt sau "pack leaders", trước `lobby:`. Làm đủ 13 bước của PLAN.md và thêm: khoá nút `Thả` (bấm lần hai trong cùng một tác vụ JS thì hộp vẫn mở), nền mờ che nút HUD (`elementFromPoint`), chạm nền mờ, Shift+Tab, Q khi hộp mở (rồi bảng mở lại là bảng thường), mở bảng Chế tạo (phím C) ngắt chế độ thả, hộp con cuối (cảnh báo hiện, dòng trạng thái ẩn).
- [x] **Bước 10: `docs/architecture.md`.** Dòng `capture.ts` (`throwBlocker`) và dòng `ui/` (`party.ts`). `docs/design/pals.md` không sửa (game-designer đã cập nhật).

### Kiểm tra thêm (không phải thay cho tester)

- **Kiểm đột biến**, mỗi lần khôi phục ngay (đã xem `git diff` sau cùng, đúng như dự định):
  - server: `throwBlocker(0, pal)` thay `throwBlocker(player.pals.length, pal)`: test "a full party cannot throw" không qua ở `results` có 1 phần tử;
  - server: bỏ hai dòng dọn `skillOrder` và `faintedUntil` trong `release`: test "releasing the follower..." không qua ở `skillOrder` còn giá trị; bỏ riêng dòng `faintedUntil.delete`: không qua ở `faintedUntil.has` (`expected true to be false`);
  - client: `if (blocker && false)` trong `throwBall`: e2e không qua ở `expect(await sent()).not.toContain("throw")` (tin `throw` đã được gửi).
- **Ảnh kiểm tra bố cục** (không commit), spec và cấu hình tạm nằm ngoài repo: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/shots/` (`layout.spec.ts`, `playwright.config.ts`). Ba khung (390×844 và 844×390 có giả lập cảm ứng, 1280×720), 30 thú nhiều loài, năm ảnh mỗi khung: `<khung>-1-hud-full.png`, `-2-panel.png`, `-3-release-mode.png`, `-4-confirm-locked.png`, `-5-confirm.png` (`phone-portrait`, `phone-landscape`, `desktop`). Đã xem bằng mắt, bình thường. Số đo:
  - nút 🐾 là `🐾 Thú (30/30)`, nền `rgb(255, 213, 79)`, class `full`, ở cả ba khung;
  - hàng tiêu đề ở điện thoại dọc: tiêu đề `Túi thú 30/30` rộng 159 px, nút chế độ 97×44, ✕ 44×32; mép phải ✕ (364) trùng mép trong của bảng, không tràn, không chồng nhau, nên không cần thu nhỏ chữ nút (rủi ro đã nêu trong PLAN.md không xảy ra);
  - hộp 320×185 px: ở 390×844 nằm y 329-515, ở 844×390 nằm y 102-288, ở 1280×720 nằm y 267-453; đều trọn trong khung nhìn;
  - nền mờ nhận chạm thay cho joystick, `.btn-attack`, `.btn-capture`, `.btn-dash`, `.ball-btn`, `.base-btn`, `.craft-btn`, `.eat-btn` (`elementFromPoint` trả `div.party-confirm`).

### Lệch kế hoạch

- `setReleasing` không đặt `lastKey = ""` (PLAN.md bước 5): khoá của `update` đã chứa `releasing` nên đổi chế độ tự vẽ lại ngay, kết quả như nhau.
- `party.ts` có thêm `fillConfirm()`, gọi trong `openConfirm()` và cuối `render()` khi hộp đang mở: tên, cấp, dòng trạng thái và cảnh báo "con cuối" luôn khớp với túi nếu túi đổi lúc hộp mở (ví dụ một quả bóng đã ném xong, thì cảnh báo "con cuối" không còn đúng). PLAN.md chỉ nói hộp tự đóng khi con đó biến mất.
- `release()` lấy tên loài trước khi `splice` (PLAN.md đọc `owned.speciesId` sau `splice`): để không phụ thuộc vào việc phần tử schema đã gỡ còn đọc được. Hành vi y hệt.
- Test thêm hoặc đổi so với mục Test của PLAN.md:
  - test tích hợp 3 dùng hai con làm việc (PLAN.md: một con) để kiểm con còn lại vẫn làm việc; test 2 đặt thêm `skillReady` và `castingUntil` (giữ lệnh chiêu khỏi bị thực hiện hoặc bỏ trước khi tin `release` tới, và để kiểm `skillReady` có ý nghĩa); test 5 ném hai lần liền để chứng minh lần từ chối cũng tính cooldown; test 6 (`debug:givePal`) là mới, đặt `PETGAME_DEBUG=1` trong test rồi xoá;
  - unit test dùng `not.toMatch(/cho\s+bớt/i)` thay `not.toContain("cho bớt")`: để tiêu chí `grep -rn "cho bớt" packages` không ra kết quả (kiểm cùng một điều);
  - e2e: PLAN.md viết `.party-panel` và `.party-card`, nhưng bảng Chế tạo và Tủ đồ dùng chung hai class này (3 phần tử, 16 thẻ), nên dùng `.party-panel:has(.party-release-toggle)` và `panel.locator(".party-card")`; `toContainText` đọc cả chữ trong phần tử `hidden`, nên dòng "cuối cùng" và dòng trạng thái kiểm bằng `toBeVisible`/`toBeHidden`.

### Ghi chú cho agent chính và tester (không chặn)

- Phím của game (Space, E, Shift...) vẫn chạy khi hộp xác nhận mở, vì lớp `Keyboard` nghe toàn cửa sổ (như mọi bảng khác, PLAN.md không đổi). Hệ quả: Shift+Tab trong hộp làm nhân vật lướt một đoạn. Muốn chặn cần cờ tạm dừng trong `keyboard.ts`: việc riêng, ngoài T2.
- Có từ trước, ngoài phạm vi: `.party-panel` là `content-box`, nên ở điện thoại dọc (390×844) với từ 7 thú trở lên bảng cao 680 px từ y=172, đáy ở 852, lệch 8 px khỏi khung nhìn. Có thể gộp vào việc P2 "nút cảm ứng dưới 44 px và các bảng" mà PLAN.md đề xuất.
- Test có sẵn, không liên quan T2, từng không qua một lần: `regions and climate > walks the boss back home when it strays`. Trong 3 lần chạy cả bộ `npm test` có 1 lần hỏng (lần khác 194/194 qua); chạy riêng qua 1 + 12 lần liên tiếp. Chưa lấy được thông báo lỗi của lần hỏng nên chưa biết nguyên nhân (`spawnBoss` đặt trùm ở vị trí ngẫu nhiên quanh núi lửa; một phép thử nhanh cho thấy khoảng 58% vị trí đó có điểm `x - 600` rơi vào biển hoặc vật cản, nhưng test vẫn gần như luôn qua, nên đó chưa chắc là nguyên nhân). Test này đứng trước khối test mới của T2 trong file và không đi qua `handleThrow` hay `release`. Nếu tester gặp lại, đề nghị ghi thông báo lỗi và tách thành việc riêng.
- Cổng 2567 và 5173 trống sau khi xong (đã kiểm bằng `ss`). Không còn file tạm nào trong repo (`git status` chỉ có các file của nhiệm vụ).

### Lệnh đã chạy

- `npm run typecheck` ✓ (8,7 s). `tests/e2e` không nằm trong typecheck: kiểm riêng bằng `tsc` với tsconfig tạm ngoài repo, sạch.
- `npm test` ✓ (20 file, 194 test, 65 s; trước nhiệm vụ là 184: thêm 4 unit và 6 tích hợp). Lần chạy cuối cùng trên cây làm việc cuối: 194/194 qua (một lần chạy trước đó có 1 test boss có sẵn hỏng, xem ghi chú trên).
- `npm run build` ✓ (2,5 s).
- `npx playwright test -g "party:" --workers=1` ✓ (24-34 s); `--repeat-each=3 --workers=1` 3/3 qua (1,7 phút).
- `npx playwright test -g "captured pal|skills:|crafting|pack leaders|party:" --workers=1` 5/5 qua (1,3 phút): các test đụng bảng Thú, Escape và phím mở panel vẫn qua. Chưa chạy cả bộ `npm run test:e2e` (việc của tester).

## Kiểm thử vòng 1: PASS

- typecheck ✓   test ✓ (194, 20 file)   build ✓   e2e ✓ (16: 14 cũ + 2 mới)   photo3d (không chạy: không đụng `tools/photo3d`)
- Chạy trên cây làm việc của T2 (HEAD `b46b1d6` + thay đổi chưa commit); cổng 2567/5173 trống trước và sau mỗi lần chạy. Tuyệt đối không sửa code sản phẩm.
  - `npm run typecheck` sạch (16,7 s). `tests/e2e` không nằm trong typecheck: kiểm riêng bằng `tsc` với tsconfig tạm ngoài repo, sạch (kể cả hai test mới). `npm run build` qua (2,0 s).
  - `npm test`: 6 lần trên T2, 5 lần 194/194, 1 lần 193/194 do test chập chờn có từ trước (mục dưới). Đối chứng: 5 lần trên bản sao `HEAD` ngoài repo (trước T2, 184 test): 3 lần qua, 2 lần hỏng một test chập chờn khác.
  - `npm run test:e2e` cả bộ: lần đầu 14/14 (2,7 phút); sau khi tôi thêm 2 test, 16/16 (3,2 phút). Hai test mới lặp `--repeat-each=4 --workers=1`: 8/8. Hai thông báo `MatchMakeError` trong log là của test "6th is turned away" và "lobby:", có chủ ý.
- Tiêu chí hoàn thành (PLAN.md), đối chiếu từng mục:
  - [x] `messages.ts`: `ClientMessage.Release = "release"`, `ReleaseMessage { palId }`, JSDoc tiếng Anh.
  - [x] `capture.ts`: `PARTY_FULL_TEXT` dựng từ `MAX_PARTY`, `throwBlocker(partySize, { boss })` (trùm xét trước); 4 unit test.
  - [x] Server `release`: kiểm kiểu `palId`; id lạ, `palId: 42`, `{}`, không payload, thú của người khác đều bị bỏ qua và không có notice; id hợp lệ thì `splice`, xoá companion, `activePalId`, `skillOrder`, `faintedUntil` (cả `skillReady`, `castingUntil`), notice "Đã thả …", lưu (thả rồi vào lại phòng cùng token: không quay lại). Test tích hợp 1-4.
  - [x] Server `handleThrow`: thứ tự cooldown, tầm ném, `inBall`, `lastThrowAt`, rồi `throwBlocker` (đọc code). Bị chặn thì không có `CaptureResult`, không trừ bóng xịn, thú hoang không vào bóng, cả thú đầu đàn; hai lần ném liền chỉ một notice. Nhánh `else { "Túi thú đã đầy" }` đã xoá. `grep -rn "cho bớt\|Túi thú đã đầy" packages` không ra kết quả. Test có sẵn "spawns one boss ... cannot be captured" vẫn qua.
  - [x] `debug:givePal` báo `PARTY_FULL_TEXT` khi đầy (test tích hợp 6).
  - [x] Client `throwBall`: bị chặn thì không gửi `throw` (e2e đọc bản ghi tin gửi đi), toast đúng câu. Trùm đi cùng đường `throwBlocker` (unit test); không có e2e ném riêng vào trùm. Thời gian 3 giây: đọc code (`showToast(blocker, 3000)`), e2e chỉ kiểm chữ.
  - [x] Bảng 🐾 Thú: tiêu đề `Túi thú n/30`; nút `🕊️ Thả bớt` / `✓ Xong` có `aria-pressed`, ẩn khi túi trống; chế độ thả (gợi ý đỏ, mỗi thẻ chỉ còn `Thả`); chế độ tắt khi đóng bằng Q, Escape, mở bảng Chế tạo, và khi hết thú (e2e); ✕ đi chung đường `toggle(false)` (đọc code). Mọi chữ khớp bảng chữ của PLAN.md.
  - [x] Hộp xác nhận: chữ, dòng trạng thái, dòng con cuối; nền mờ che nút HUD (`elementFromPoint`) và nhận chạm thật (chạm vào chỗ nút Đánh thì hộp huỷ, không gửi `attack`: test mới 2); chạm nền mờ là huỷ; focus mặc định ở `Giữ lại`; Tab, Shift+Tab chỉ đổi giữa hai nút; Escape đóng hộp trước, Q đóng cả hai; `Thả` khoá lúc mở (`disabled`, 500 ms); hộp tự đóng khi con đó biến mất; focus về nút chế độ sau Giữ lại, Escape, chạm nền mờ, và khi con biến mất (test mới 1; trước đó chưa có test nào kiểm việc hộp tự đóng và việc trả focus).
  - [x] Nút HUD `🐾 Thú (30/30)` nền `rgb(255, 213, 79)` kèm class `full` khi đầy; `🐾 Thú (29)` và bỏ class khi còn chỗ; chữ túi trống mới khớp PLAN.md.
  - [x] Nút mới ≥ 44×44 px ở 390×844, 844×390, 1280×720 và hộp nằm trọn trong khung nhìn (e2e của coder đo; ảnh chụp của tôi khớp).
  - [x] Không đổi `schema.ts`, `Profile`, `emptyProfile`, `sanitizeProfile`, `store.ts` (`git diff --stat`); không thêm `ServerMessage`; không đổi `MAX_PARTY`, `scripts/shots.mjs`, `playwright.config.ts`.
  - [x] Unit, tích hợp, e2e mới đều qua; typecheck sạch; build qua; cả bộ e2e qua. Test cũ không bị sửa hay bỏ (diff của các file test chỉ thêm dòng, trừ dòng import ở `capture.test.ts` và hai hàm helper `openPage`, `join` ở e2e mà tôi thêm tham số tuỳ chọn).
  - [x] Chú thích code tiếng Anh, chữ hiển thị tiếng Việt; `docs/architecture.md` đã cập nhật 2 dòng.
- Lỗi của T2: không có.
- Chập chờn có từ trước (không tính là lỗi của T2; code T2 không đụng `spawnBoss`, `spawnPal`, AI của thú hoang):
  - **`regions and climate > walks the boss back home when it strays`** (`GameRoom.test.ts:1004-1012` ở cây T2). Hỏng 2/5 lần `npm test` trên bản sao HEAD (cả hai lần ở `GameRoom.test.ts:1008:34` của HEAD, dòng `expect(distance(boss, home)).toBeLessThan(before)`): `AssertionError: expected 610.2833640713945 to be less than 600` và `expected 623.7267240180252 to be less than 600`. Trên cây T2, 0/6 lần trong đợt này (coder gặp 1/3 lần). Khảo sát riêng thân test trong 120 phòng mới: **HEAD 9/120 hỏng (7,5%), cây T2 9/120 (7,5%)**, cùng nguyên nhân.
    - Nguyên nhân: `spawnBoss()` (`GameRoom.ts:1452-1473`) chưa lần nào dùng vị trí mặc định (0/120) mà luôn bốc điểm ngẫu nhiên quanh chân núi lửa; test lại dịch trùm đúng 600 px sang tây (`boss.x -= 600`). Ở 31-35% số phòng (37/120 ở HEAD, 42/120 ở T2) điểm dịch rơi vào vật cản (cây, đá); khoảng một phần tư trong số đó (9/37, 9/42) cú đẩy ra khỏi vật cản làm trùm sau 40 tick (2 giây, tốc độ 45 px/s) xa `home` hơn 600 px (600,6 đến 643,8). Cả 9 lần hỏng đều có điểm dịch bị chặn; không lần nào rơi xuống biển (0/120).
    - Đề xuất (việc riêng, chỉ sửa file test): chọn điểm dịch không bị chặn, hoặc đặt cố định vị trí và `bossHome` của trùm trước khi dịch.
  - **`day and night > syncs the time of day and spawns night pals at night`** (`GameRoom.test.ts:491-501`). Hỏng 1 lần trong 6 lần `npm test` trên T2, lần chạy đầu: `AssertionError: expected 0 to be greater than 0` tại `GameRoom.test.ts:501:73`; 5 lần sau qua.
    - Nguyên nhân: test ép 30 lần `spawnPal()` giữa đêm rồi đòi có ít nhất một Mothlume (loài đêm duy nhất, trọng số 2). Mỗi lần sinh ra Mothlume với xác suất 10,3% (lấy mẫu 200 000 lần theo đúng cách chọn của `spawnPal`: 10,35% ở HEAD, 10,31% ở T2), nên không ra con nào trong 30 lần với xác suất 3,8%. Khảo sát 200 phòng: **11/200 hỏng (5,5%) ở cả HEAD và T2**.
    - Đề xuất (việc riêng, chỉ sửa file test): ép `pickSpecies` ra Mothlume hoặc giả `Math.random`.
  - Cộng lại, một lần `npm test` có khoảng 1-(1-0,075)(1-0,038) = 11% hỏng chập chờn, độc lập với T2. Nên xử lý trước khi để vòng tự động coi một lần hỏng như vậy là FAIL.
- Phím game khi hộp xác nhận mở (coder báo Shift+Tab làm nhân vật lướt): **đúng như báo, nhưng không vi phạm tiêu chí nào**.
  - Đo bằng Playwright tạm (hộp mở cho thú đang đi theo, nút `Thả` đã mở khoá): bấm E, Space, Shift, Shift+Tab, 1, B, H rồi giữ D thì client gửi `["throw","attack","dash","palSkill","placeBase","eat","input","input"]`; hộp vẫn mở, vẫn 2 thú, Tab và Shift+Tab vẫn đổi focus đúng giữa hai nút.
  - PLAN.md mục Bàn phím chỉ quy định focus mặc định, Tab/Shift+Tab, Enter, Escape, Q, và nói rõ lớp `Keyboard` có sẵn giữ nguyên (Space); tiêu chí "nền mờ chặn chạm" nói về chạm. Bảng Chế tạo và Tủ đồ cũng không chặn phím game. Không có dòng nào đòi tạm dừng phím game khi hộp mở.
  - Nhận xét UX (không chặn): Shift+Tab là phím "lùi" quen thuộc nhưng game gán Shift là lướt, nên người dùng bàn phím đang cân nhắc có thể làm nhân vật lướt tới trước; B (đặt trại) và E (ném) cũng chạy khi hộp mở, trong khi chạm bị nền mờ chặn hết. Đề xuất việc riêng: cờ tạm dừng trong `keyboard.ts` khi một hộp xác nhận (hay mọi bảng) đang mở.
- Test đã thêm (`tests/e2e/multiplayer.spec.ts`, đặt sau test "party:" của coder, trước "lobby:"):
  - `party: the dialog hands the focus back, closes with its pal and keeps its warning true` (desktop): focus về `Thả bớt` sau `Giữ lại`, Escape, chạm nền mờ; hộp tự đóng khi con đó biến mất (gửi thẳng `release`, như thả từ thiết bị khác) và focus về nút chế độ; cảnh báo "con cuối" tắt khi con thứ hai tới lúc hộp mở; dòng trạng thái đổi theo khi con được gọi đi theo; Q đóng cả hộp lẫn bảng, mở lại là bảng thường.
  - `party: by touch alone a pal is let go; the dimmed layer takes the taps meant for what lies under it` (390×844, `hasTouch`, `isMobile`, chỉ chạm): chạm vào chỗ nút Đánh thì rơi vào nền mờ (hộp huỷ, không có `attack`); rồi chạm `Thả` trên thẻ và `Thả` trong hộp: thú được thả, toast "Đã thả Pebblet", vẫn ở chế độ thả.
  - Helper `openPage` và `join` thêm tham số tuỳ chọn `options` (`BrowserContextOptions`, mặc định `{}`, nên các test cũ không đổi) để mở trang với màn hình và cảm ứng riêng. Dòng "Helper" của `docs/architecture.md` chưa nhắc tham số này (tester không sửa tài liệu).
  - Kiểm đột biến trên bản sao cây T2 ngoài repo, mỗi lần một thay đổi, đều bị bắt rồi khôi phục (bản sao giống hệt cây làm việc): bỏ `releaseToggle.focus()` thì test 1 hỏng ở `toBeFocused`; bỏ đóng hộp khi con đó biến mất thì test 1 hỏng ở `toBeHidden`; bỏ `fillConfirm()` khi vẽ lại thì test 1 hỏng vì cảnh báo "con cuối" còn hiện; nền mờ `pointer-events: none` thì test 2 hỏng vì hộp không huỷ (test 1 cũng treo tới hết thời gian, chỉ khi lỗi).
  - Không thêm test chạm đúp vào nút `Thả` của thẻ vì kết quả phụ thuộc cửa sổ 500 ms theo đồng hồ thật (máy chậm sẽ hỏng oan); nút khoá đã có e2e của coder (hai lần bấm trong cùng một tác vụ JS). Kiểm tay bằng Playwright tạm ở 390×844: chạm đúp tại (320, 497), chỗ nút `Thả` của thẻ (282-358 × 475-519) chồng lên nút `Thả` của hộp (243-339 × 470-514): hộp vẫn mở, không có tin `release`, vẫn 2 thú; sau đó chạm chủ ý (chạm, chờ mở khoá, chạm) thả đúng một con và chỉ gửi một tin `release`.
- Ảnh chụp (đã xem bằng mắt) ở 390×844, 844×390 và 1280×720: chế độ thả, hộp xác nhận, nút HUD vàng `🐾 Thú (30/30)`, bảng 30/30 ở chế độ thường (có `🕊️ Thả bớt`). Hàng tiêu đề `Túi thú n/30`, nút chế độ, ✕ vừa một hàng ở điện thoại dọc; hộp nằm trọn trong khung nhìn ở cả ba. Ảnh "hộp đang khoá" chụp sau 500 ms nên không thấy nút mờ (trạng thái khoá đã được kiểm bằng DOM). Ảnh, nhật ký, mã khảo sát, mã đột biến: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t2r1/` (ngoài repo, không commit).
- Sau khi xong: cổng 2567/5173 trống; `git status` chỉ có các file của T2 và `tests/e2e/multiplayer.spec.ts` (của tôi).
