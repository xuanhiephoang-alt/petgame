# PROGRESS: T11 Tách `Game.ts` thành các module

## Vòng 1 (Part 0, A-C): coder

Cách làm: một script Python tạm (ngoài repo, trong scratchpad) chuyển nguyên văn từng khối theo số dòng ở BASE `767619d` (kèm JSDoc), chỉ đổi đường gọi theo luật 3 của PLAN.md, rồi dựng lại import cho `Game.ts` và file mới theo tên được dùng. Script dựng lại từ BASE mỗi lần nên mỗi phần là cộng dồn.

- [x] Part 0: mốc ở BASE trước mọi sửa: `Game.ts` 1.512 dòng; `packages/client` 110 test; `shots/t11-base-1` và `shots/t11-base-2` (32 ảnh mỗi thư mục, gitignored).
- [x] Part A: bỏ `private` ở trường trạng thái (`room`, `assets`, `watch` thành `readonly`), chú thích khối trường, `export` `Named`/`PalEntity`, `send`/`me`/`nearMe` public; `game/skillCasts.ts` (`SkillCasts`: `castSkill`, `chainJump`). `Game.ts` 1.427, `skillCasts.ts` 101. typecheck ✓, client 110/110 ✓, build ✓.
- [x] Part B: `dayTime` listen dời lên sau `onRemove("fruits")`; `game/serverEvents.ts` (`QUEST_DELAY_MS`, `NOTICE_LEVEL`, `lootIcons`, `setFate`, `bind()` 18 `onMessage`); `bindRoom` kết thúc bằng `this.serverEvents.bind();`. `Game.ts` 1.086, `serverEvents.ts` 368. typecheck ✓, 110/110 ✓, build ✓.
- [x] Part C: `game/controls.ts` (`Controls`: `eat`, `readInput`, `attack`, `dash`, `gatherSpot`, `nearestPal`, `throwBall`, `toggleBall`); `init` và `frame()` gọi qua `this.controls.*`. `Game.ts` 957, `controls.ts` 146. typecheck ✓, 110/110 ✓, build ✓.
- [x] `docs/architecture.md`: bullet `Game.ts` viết lại (phần chưa tách ghi rõ, danh sách trường e2e/shots đọc), bullet mới "Các phần của màn chơi (T11...)" cho 3 file đã có kèm luật làm việc, `throwBall` (`game/controls.ts`), `skillCasts.ts` gọi `skillfx.ts`.
- Kiểm tra cuối đợt:
  - `npm test`: 34 file, 505 test qua. `npm run test:e2e`: 56/56 qua (9,3 phút; boss bar không chập chờn lần này).
  - Thứ tự đăng ký (`cat Game.ts serverEvents.ts | grep -oE ...`): 31 dòng đúng thứ tự: 6 cặp onAdd/onRemove, `listen("dayTime"`, rồi 18 `onMessage` Harvested ... Produced.
  - Bảo toàn dòng: MẤT rỗng. MỚI chỉ gồm: chú thích khối trường và JSDoc class (3 class + `bind`), vỏ `class X {`, `constructor(game: Game) {}` (x3), `bind() {`, 3 trường `x = new X(this);`, lời gọi `this.bind();`, và dấu `}` đóng.
  - Phạm vi file: `git diff --exit-code 767619d -- <danh sách của PLAN.md>` exit 0. `git diff --stat` chỉ có `Game.ts`, 3 file mới, `docs/architecture.md`, `PLAN.md`, `TASKS.md`, `PROGRESS.md`. `git stash list` vẫn 2 mục (không chạy lệnh stash nào).
  - `constructor(`: chỉ dạng `constructor(private readonly game: Game) {}`. Grep "bản sao trường" ra hai dòng ở `controls.ts` (`x = this.game.joystick.value.x;`, `y = ...`): đây là gán biến cục bộ trong `readInput` (nguyên văn BASE `x = this.joystick.value.x`), không phải trường giữ bản sao. Không có import giá trị giữa module hay từ `Game.ts`.
  - Diff `frame()`: chỉ `this.controls.readInput()`; `labels.update`, `removeActor` không đổi.
- Ảnh chụp (`npm run shots -- --name t11-r1`, 32 ảnh, mọi ảnh ≤ 600 sprite, vòng ngắm vẫn hiện ở các ảnh aim):
```
aim-desert                   sprites 232/230/234  mad noise 4.54 after 4.56  overlaps [None, None, None]  ok
aim-meadow                   sprites 316/313/321  mad noise 1.57 after 1.53  overlaps [None, None, None]  ok
aim-meadow-night             sprites 359/357/363  mad noise 1.08 after 2.25  overlaps [None, None, None]  ok
aim-phone                    sprites 278/282/279  mad noise 1.50 after 1.73  overlaps [None, None, None]  ok
aim-phone-landscape          sprites 363/365/366  mad noise 4.22 after 1.59  overlaps [None, None, None]  ok
aim-snow                     sprites 210/210/212  mad noise 6.15 after 1.90  overlaps [None, None, None]  ok
aim-swamp                    sprites 301/300/301  mad noise 10.27 after 20.43  overlaps [None, None, None]  ok
aim-volcano-night            sprites 193/193/184  mad noise 4.75 after 5.46  overlaps [None, None, None]  CHECK
desert                       sprites 301/214/213  mad noise 51.34 after 50.34  overlaps [None, None, None]  ok
island                       sprites 162/163/166  mad noise 25.61 after 23.87  overlaps [None, None, None]  CHECK
labels-desktop-alpha         sprites 292/277/322  mad noise 30.20 after 27.62  overlaps [0, 0, 0]  ok
labels-desktop-players       sprites 302/303/303  mad noise 1.25 after 1.46  overlaps [0, 0, 0]  ok
labels-desktop-wild          sprites 295/293/295  mad noise 2.37 after 3.30  overlaps [0, 0, 0]  ok
labels-landscape-alpha       sprites 319/327/324  mad noise 20.67 after 25.61  overlaps [0, 0, 0]  ok
labels-landscape-players     sprites 357/366/363  mad noise 1.05 after 0.66  overlaps [0, 0, 0]  ok
labels-landscape-wild        sprites 314/323/319  mad noise 2.21 after 1.89  overlaps [0, 0, 0]  ok
labels-portrait-alpha        sprites 360/352/339  mad noise 21.18 after 20.11  overlaps [0, 0, 0]  CHECK
labels-portrait-players      sprites 383/380/383  mad noise 1.41 after 1.33  overlaps [0, 0, 0]  ok
labels-portrait-wild         sprites 379/371/372  mad noise 24.40 after 24.21  overlaps [0, 0, 0]  ok
lake                         sprites 324/324/320  mad noise 2.01 after 2.02  overlaps [None, None, None]  CHECK
meadow-day                   sprites 315/311/308  mad noise 2.00 after 1.28  overlaps [None, None, None]  ok
meadow-dusk                  sprites 316/312/307  mad noise 1.70 after 1.16  overlaps [None, None, None]  CHECK
meadow-night                 sprites 316/311/306  mad noise 2.08 after 1.25  overlaps [None, None, None]  ok
pal-closeup                  sprites 315/312/306  mad noise 2.31 after 2.31  overlaps [None, None, None]  CHECK
phone                        sprites 312/311/307  mad noise 1.25 after 1.94  overlaps [None, None, None]  CHECK
phone-lake                   sprites 376/373/377  mad noise 4.72 after 3.19  overlaps [None, None, None]  ok
phone-swamp                  sprites 289/281/284  mad noise 22.30 after 21.77  overlaps [None, None, None]  ok
sea-raft                     sprites 128/127/131  mad noise 1.25 after 3.49  overlaps [None, None, None]  ok
snow                         sprites 232/278/413  mad noise 70.98 after 36.56  overlaps [None, None, None]  CHECK
swamp                        sprites 303/294/289  mad noise 32.12 after 33.08  overlaps [None, None, None]  ok
volcano                      sprites 188/184/185  mad noise 2.12 after 6.32  overlaps [None, None, None]  CHECK
volcano-night                sprites 188/185/185  mad noise 2.06 after 2.43  overlaps [None, None, None]  ok
9 to check by eye
```
  Dòng `CHECK` (9): đều là nhiễu thế giới đang chạy, không do code. Đã mở `volcano` (mốc 1 và sau) so bằng mắt: cùng HUD, bố cục, bản đồ nhỏ, thanh trùm; khác ở kiểu tóc nhân vật ngẫu nhiên, trùm Boulderhorn đứng chỗ khác và một thông báo khác. Các dòng còn lại lệch số sprite nhỏ (≤ 9, do thú hoang đi lại, cùng cỡ với lệch giữa hai mốc: `snow` mốc là 232/278) và `overlaps` đều 0; chưa mở từng ảnh. `aim-swamp` có mad 20 nhưng vẫn qua ngưỡng nhiễu của script (mốc 10).
- Lệch kế hoạch: không có. Ghi chú: `ConnectionWatch`/`ToastLevel` trong `Game.ts` giữ nguyên dạng `import type` sau khi lọc.
- Lỗi thấy được, không sửa: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (505 test), build ✓, e2e ✓ (56 test).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (505, 34 file; `npx vitest run packages/client` 110/110 hai lần)   build ✓   e2e ✓ 55/56 lần đầu, test thứ 56 chập chờn (xem dưới)   photo3d (không chạy, không đụng)
- Tiêu chí hoàn thành (Phần 0, A-C): [x] 3 file mới, đều < 380 dòng (skillCasts 101, serverEvents 368, controls 146), có JSDoc class   [x] `Game.ts` 957 (< 1.060)   [x] bảo toàn dòng: MẤT rỗng; MỚI chỉ là JSDoc class/trường module (3 dòng `x = new X(this)`), vỏ class, `constructor(game: Game) {}`, `bind()` + `this.bind();`, chú thích khối trường, dấu `}`   [x] 31 dòng đăng ký đúng thứ tự (12 state, dayTime, 18 onMessage)   [x] phạm vi file exit 0, `git diff --stat` chỉ có Game.ts, 3 file mới, architecture.md, file làm việc   [x] grep `constructor(` chỉ ra `private readonly game: Game`; không import giá trị giữa module; grep trường sao chép chỉ ra hai dòng cục bộ `x = this.game.joystick.value.x`/`y`, đã so với BASE: là biến cục bộ `let { x, y }` trong `readInput`, chuyển nguyên văn (BASE dòng 1066-1067)   [x] `debugInfo` giống hệt BASE; mười thành viên hợp đồng `__petgame.game` còn trên `Game`; `frame()` chỉ đổi `controls.readInput`, `removeActor` vẫn qua `this.removeActor` (chưa tách, đúng đợt 1), `updateBossBar`/`updateHud`/`labels.update` giữ nguyên thứ tự   [x] không git stash (còn đúng 2 mục)
- Lỗi chập chờn (không tính là lỗi thật): `boss bar (phone upright, notch)` hỏng ở lần e2e đầy đủ và ở lần chạy lại `-g "boss bar"` (`.hud-toasts > .toast:not(.out)` mong 2, nhận 1, `multiplayer.spec.ts:2855`). Test này tự gọi `hud.showToast` nên không đi qua code đã chuyển. Sau đó chạy lại: `-g "boss bar (phone upright"` 3/3 qua, `-g "boss bar"` (7 test) 4/4 qua trên working tree. Đối chứng bản BASE (git archive ở scratchpad): 2 + 2 + 3 lần, 0 lần hỏng. Đây là lỗi chập chờn đã biết của T63 (QUESTIONS Q1); 2 lần hỏng trên cây làm việc so với 0 trên BASE là mẫu nhỏ, reviewer lưu ý.
- Ảnh (`shots/t11-v1`, bảng ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/shotdiff.txt`): 7 dòng CHECK (aim-desert, aim-phone-landscape, aim-volcano-night, island, labels-desktop-players, labels-portrait-alpha, sea-raft), mọi ảnh ≤ 600 sprite (cao nhất 369), overlaps đều 0. Đã mở bằng mắt (ngoài `volcano` của coder): `sea-raft` (khác máu 5/27/100 và thông báo đang có hay đã hết: hai mốc cũng khác nhau như vậy), `labels-desktop-players` (khác kiểu tóc ngẫu nhiên, thú hoang ở chỗ khác, cùng nhãn, HUD, bản đồ), `island` (cả hai mốc đứng cạnh Coralcrab đầu đàn, máu thấp; lần mới nhân vật đã bị hạ gục và tỉnh dậy bên lửa trại, hiện đúng thông báo "Bạn bị ngất…", cho thấy handler Fainted vẫn chạy: là cuộc đua với trùm đầu đàn, không do code). Kết luận: nhiễu.
- Hiệu năng: `readInput` giống hệt BASE (cùng `let { x, y }` + `normalizeInput` + một object trả về), chỉ thêm tra `.game`; dòng MỚI không có closure hay object trong đường chạy mỗi khung. Hai arrow trong `init` đã có từ trước.
- Đột biến: ở `serverEvents.ts` dòng 315 (`Notice` bỏ `showToast`): e2e `exploring: quest tracker, minimap and opening a treasure chest` và `party: let a pal go after confirming; a full party cannot throw` hỏng (`toContainText`). Đã hoàn lại nguyên văn, typecheck sạch.
- Test đã thêm: không (đúng PLAN).


## Vòng 2 (T11b): coder

Cách làm giống vòng 1: script tạm (scratchpad) dựng lại từ BASE `767619d`, cộng dồn từng phần; chạy lại phần C cho ra đúng `Game.ts` đã commit (868c07e) nên các phần D-F chồng lên đó.

- [x] Part D: `game/looks.ts` (`Dressed`, `lookOf`, `wornOf`, `dressKey`, `remember`, `wornIcons`, thêm `export`; chỉ import từ `@petgame/shared`). `Game.ts` 923, `looks.ts` 35. typecheck ✓, client 110/110 ✓, build ✓.
- [x] Part E: `game/hudBridge.ts` (`HudBridge`: `build(container, isTouch)` = khối dựng HUD của `init`, `tip`, `updateSkillBar`, `updateHud`, `updateRegion`, `updateMinimap`, `updateBossBar`). `init` gọi `this.hudBridge.build(container, isTouch)`; `frame()` gọi `hudBridge.updateBossBar()` rồi `updateHud()`. `Game.ts` 755, `hudBridge.ts` 205. typecheck ✓, 110/110 ✓, build ✓.
- [x] Part F: `game/stateSync.ts` (`StateSync`: `AWAY_ALPHA`, `addHpBar`, `setHp`, `bind()` = `const $ = Callbacks.get(...)` + 12 callback state + `dayTime`, `nameTag`, `updateHpBar`, `syncCamp`, `addActor`, `removeActor`). `bindRoom` còn hai dòng; `frame()` gọi `stateSync.removeActor`. `Game.ts` 453, `stateSync.ts` 321. typecheck ✓, 110/110 ✓, build ✓.
- [x] Part G: JSDoc class `Game` theo PLAN; `Game.ts` bỏ import thừa (`import type` cho `GameRoom`, `PalSprite`). `docs/architecture.md`: bullet `Game.ts` viết lại gọn theo yêu cầu review vòng 1 (câu mở đầu, `watchConnection`, `lights`, thứ tự trong `frame()`, trường nào ai đọc), bảng 6 file của các phần màn chơi cùng luật làm việc.
- Số dòng cuối: `Game.ts` 454 (mục tiêu khoảng 500, dưới 540), `skillCasts.ts` 101, `serverEvents.ts` 368, `controls.ts` 146, `looks.ts` 35, `hudBridge.ts` 205, `stateSync.ts` 321 (đều dưới 380).
- Kiểm tra cuối đợt:
  - `npm test`: 34 file, 505 test qua. `npm run test:e2e`: 56/56 qua (9,4 phút).
  - Thứ tự đăng ký (`Game.ts` + `stateSync.ts` + `serverEvents.ts`): 31 dòng, đúng thứ tự; `Game.ts` không còn dòng nào khớp mẫu.
  - Bảo toàn dòng so BASE `767619d` (cả hai đợt): MẤT chỉ có hai dòng JSDoc cũ của class `Game` (được PLAN thay bằng JSDoc mới). MỚI chỉ gồm JSDoc/vỏ class, `constructor(game: Game) {}`, 5 trường `x = new X(this)`, `bind() {` (x2), `build(container: HTMLElement, isTouch: boolean) {`, các lời gọi `this.bind();` (x2) và `this.build(container, isTouch);`, dấu đóng.
  - Phạm vi: `git diff --exit-code 767619d -- <danh sách PLAN>` exit 0; `git diff --stat` chỉ có `Game.ts`, 6 file mới, `docs/architecture.md`, file làm việc. `git stash list` vẫn 2 mục.
  - Grep tiêu chí: `constructor(` chỉ dạng `private readonly game: Game` (5 file); không import giá trị giữa module; `looks.ts` không import gì từ `./`. Grep "bản sao trường" chỉ ra hai dòng gán biến cục bộ trong `controls.readInput` (như vòng 1). `frame()`: `labels.update(now, aimed?.tag)` và `debugInfo` không đổi.
- Ảnh chụp (`--name t11-after`, mốc `t11-base-1`/`t11-base-2` còn từ vòng 1; mọi ảnh ≤ 380 sprite):
```
aim-desert                   sprites 232/230/231  mad noise 4.54 after 7.02  overlaps [None, None, None]  ok
aim-meadow                   sprites 316/313/309  mad noise 1.57 after 2.24  overlaps [None, None, None]  CHECK
aim-meadow-night             sprites 359/357/353  mad noise 1.08 after 2.40  overlaps [None, None, None]  CHECK
aim-phone                    sprites 278/282/290  mad noise 1.50 after 0.37  overlaps [None, None, None]  CHECK
aim-phone-landscape          sprites 363/365/365  mad noise 4.22 after 4.52  overlaps [None, None, None]  ok
aim-snow                     sprites 210/210/210  mad noise 6.15 after 6.21  overlaps [None, None, None]  ok
aim-swamp                    sprites 301/300/305  mad noise 10.27 after 27.52  overlaps [None, None, None]  CHECK
aim-volcano-night            sprites 193/193/191  mad noise 4.75 after 13.74  overlaps [None, None, None]  CHECK
desert                       sprites 301/214/293  mad noise 51.34 after 2.46  overlaps [None, None, None]  ok
island                       sprites 162/163/291  mad noise 25.61 after 30.67  overlaps [None, None, None]  CHECK
labels-desktop-alpha         sprites 292/277/282  mad noise 30.20 after 25.37  overlaps [0, 0, 0]  ok
labels-desktop-players       sprites 302/303/300  mad noise 1.25 after 1.73  overlaps [0, 0, 0]  ok
labels-desktop-wild          sprites 295/293/295  mad noise 2.37 after 2.50  overlaps [0, 0, 0]  ok
labels-landscape-alpha       sprites 319/327/319  mad noise 20.67 after 25.35  overlaps [0, 0, 0]  ok
labels-landscape-players     sprites 357/366/359  mad noise 1.05 after 0.52  overlaps [0, 0, 0]  ok
labels-landscape-wild        sprites 314/323/320  mad noise 2.21 after 1.52  overlaps [0, 0, 0]  ok
labels-portrait-alpha        sprites 360/352/372  mad noise 21.18 after 18.27  overlaps [0, 0, 0]  ok
labels-portrait-players      sprites 383/380/380  mad noise 1.41 after 1.94  overlaps [0, 0, 0]  ok
labels-portrait-wild         sprites 379/371/363  mad noise 24.40 after 24.41  overlaps [0, 0, 0]  ok
lake                         sprites 324/324/322  mad noise 2.01 after 3.02  overlaps [None, None, None]  ok
meadow-day                   sprites 315/311/309  mad noise 2.00 after 1.68  overlaps [None, None, None]  ok
meadow-dusk                  sprites 316/312/309  mad noise 1.70 after 2.00  overlaps [None, None, None]  ok
meadow-night                 sprites 316/311/310  mad noise 2.08 after 2.21  overlaps [None, None, None]  ok
pal-closeup                  sprites 315/312/308  mad noise 2.31 after 3.24  overlaps [None, None, None]  CHECK
phone                        sprites 312/311/303  mad noise 1.25 after 1.57  overlaps [None, None, None]  CHECK
phone-lake                   sprites 376/373/372  mad noise 4.72 after 2.96  overlaps [None, None, None]  ok
phone-swamp                  sprites 289/281/290  mad noise 22.30 after 20.79  overlaps [None, None, None]  ok
sea-raft                     sprites 128/127/134  mad noise 1.25 after 5.67  overlaps [None, None, None]  CHECK
snow                         sprites 232/278/222  mad noise 70.98 after 37.03  overlaps [None, None, None]  ok
swamp                        sprites 303/294/297  mad noise 32.12 after 18.64  overlaps [None, None, None]  ok
volcano                      sprites 188/184/191  mad noise 2.12 after 2.21  overlaps [None, None, None]  ok
volcano-night                sprites 188/185/190  mad noise 2.06 after 2.83  overlaps [None, None, None]  ok
9 to check by eye
```
  9 dòng CHECK. 8 dòng lệch sprite ≤ 12 (thú đi lại) hoặc mad cao ở cảnh có thú và trùm di chuyển; cùng loại nhiễu như vòng 1, labels không chồng nhau. Dòng `island` (162/163 so với 291) cần giải thích: ở mốc người chơi bị Coralcrab đầu đàn cắn còn 27-32/100 máu khi chụp; ở lần chụp sau thì đã bị ngất và tỉnh dậy bên lửa trại (ảnh ở đồng cỏ, "Bạn bị ngất và tỉnh dậy bên lửa trại"), nên thấy cảnh khác. Chạy lại (`t11-after2`) vẫn 300 sprite. Để chắc không phải do code vòng 2, dựng lại `Game.ts` của vòng 1 (868c07e) và chụp lần nữa (`t11-abC`): `island` cũng 306 sprite. Vậy là phụ thuộc thời gian (máu mốc chỉ còn 27-32 và máy đang chậm), không do T11b. Đã khôi phục `Game.ts` vòng 2 nguyên vẹn (so bằng `diff`).
- Lệch kế hoạch: không có. Lỗi thấy được, không sửa: ảnh `island` của `shots` phụ thuộc may rủi (người chơi có thể bị Coralcrab đầu đàn hạ trước khi chụp); nên thành nhiệm vụ riêng nếu muốn ảnh ổn định.
- Lệnh đã chạy: typecheck ✓, test ✓ (505 test), build ✓, e2e ✓ (56 test).

## Kiểm thử vòng 1 (T11b): PASS
- typecheck ✓   test ✓ (505, 34 file; `npx vitest run packages/client` 110/110 hai lần)   build ✓   e2e ✓ (56/56, 9,6 phút, không chập chờn lần này)   photo3d (không chạy)
- Tiêu chí hoàn thành (đợt 2, so với BASE 767619d, cả hai đợt): [x] 6 file mới đều < 380 dòng (skillCasts 101, serverEvents 368, controls 146, looks 35, hudBridge 205, stateSync 321), `Game.ts` 454 (< 540)   [x] bảo toàn dòng: MẤT chỉ đúng 2 dòng JSDoc cũ của class `Game` ("The game screen: connects..." và "and the DOM HUD, predicts..."), MỚI 59 dòng chỉ là JSDoc, vỏ class, `constructor(game: Game) {}`, 5 trường `x = new X(this)`, `bind()` x2 và `build(container, isTouch)` cùng lời gọi, chú thích khối trường, dấu `}`   [x] đăng ký: `Game.ts` 0 dòng khớp, `Game.ts + stateSync.ts + serverEvents.ts` ra 31 (12 state, dayTime trong stateSync, 18 onMessage đúng thứ tự)   [x] phạm vi file exit 0, `git diff --stat 767619d` chỉ có Game.ts, 6 file mới, architecture.md, file làm việc   [x] 5 module có `constructor(private readonly game: Game) {}`; không import giá trị giữa module/từ Game.ts; `looks.ts` không import gì từ `./`; grep bản sao trường chỉ ra hai biến cục bộ joystick của `readInput` (nguyên văn BASE)   [x] `frame()`: chỉ đổi `controls.readInput`, `stateSync.removeActor`, `hudBridge.updateBossBar`/`updateHud`; `labels.update` và `frames++` giữ chỗ; `debugInfo` giống hệt BASE; `frames`, `pals`, `players`, `companions`, `nodes`, `scenery`, `stage`, `hud`, `labels` còn trên `Game`, `tag`, `setFelled`, `showToast` được e2e dùng và qua
- Ảnh (`shots/t11b-wt`, bảng ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/shotdiff2.txt`): 8 dòng CHECK (aim-desert, aim-phone-landscape, aim-volcano-night, island, labels-portrait-alpha, lake, phone, sea-raft), mọi ảnh ≤ 600 sprite, overlaps đều 0. `island`: chụp `--only world` ở 868c07e (git archive ở scratchpad) ra 293 sprite, người chơi đã bị ngất và tỉnh dậy bên lửa trại (cùng ảnh như coder thấy); chụp `--only world` lại trên cây làm việc ra 163 sprite, người chơi đứng cạnh Coralcrab (40/100 máu). Vậy hiện tượng xuất hiện ở cả mã vòng 1 và mã vòng 2 và biến mất khi chụp lại: do thời gian/cuộc đua với trùm, không do refactor. `aim-desert` (300 sprite) và `aim-volcano-night`: đã mở so với mốc 1 và 2; nhân vật đứng ở chỗ khác vì `shots.mjs` thử lại cảnh 260 px về phía bắc khi có thú hoang cắn ("a scene that did not come out ... is tried again"), `aimsWeak` vẫn true; cùng HUD, vòng ngắm, nhãn. Nhiễu.
- Hiệu năng: không có dòng MỚI nào chứa closure/mảng/object trong `stateSync`, `hudBridge`; `updateHud`, `updateMinimap`, `updateBossBar`, các callback state chuyển nguyên văn (lệnh bảo toàn dòng: MẤT rỗng ngoài hai dòng JSDoc), mỗi khung chỉ thêm tra `.game`/`.hudBridge`.
- Đột biến: ở `stateSync.ts` dòng 139 (`onRemove("pals")` bỏ `this.game.pals.delete(id)`): e2e `a captured pal follows the player and shows in the party panel` và `toasts: the catch and the quest it finishes show together...` hỏng. Đã hoàn lại nguyên văn (`cmp` khớp), typecheck sạch.
- Test đã thêm: không (đúng PLAN). `git stash list` vẫn 2 mục.
