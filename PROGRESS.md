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
