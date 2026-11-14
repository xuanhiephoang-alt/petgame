# PROGRESS: T10 Tách `GameRoom.ts` thành các hệ thống

## Vòng 1 (Part A-F): coder

Cách làm: một script Python tạm (ngoài repo) chuyển nguyên văn từng khối phương thức theo tên (kèm JSDoc), chỉ đổi đường gọi theo luật 3 của PLAN.md, rồi dựng lại import cho `GameRoom.ts` và file hệ thống. Sau mỗi phần chạy `npm run typecheck` và `npx vitest run packages/server` (8 file, 236 test qua, khoảng 145 s mỗi lần).

- [x] Part A: trường trạng thái bỏ `private`, thêm chú thích khối trường, `export` cho `PlayerControl` và `CompanionTimers`; `systems/saving.ts` (`Saves`, `SAVE_DELAY_MS`, `store()` export, `useStore`, `scheduleSave`, `saveNow`); `GameRoom.ts` re-export `useStore`, trường `readonly saves`. `GameRoom.ts` 2.265 dòng, `saving.ts` 65 dòng. typecheck ✓, server 236/236 ✓.
- [x] Part B: `systems/skills.ts` (`Skills`, `Cast` export, `FROM_CASTER`, 12 phương thức); cửa test `startCast`. `GameRoom.ts` 1.944, `skills.ts` 352. typecheck ✓, 236/236 ✓.
- [x] Part C: `systems/combat.ts` (`Combat`, 21 phương thức); cửa test `provoke`, `daze`, `knockOut`, `damage`, `handleAttack`. `GameRoom.ts` 1.649, `combat.ts` 350. typecheck ✓, 236/236 ✓.
- [x] Part D: `systems/leaders.ts` (`Leaders`: `bossStomp`, `spawnBoss`, `spawnAlpha`, `defeatBoss`); dòng JSDoc lạc chỗ "The giant Boulderhorn appears…" dời lên trên `spawnBoss`. `GameRoom.ts` 1.562, `leaders.ts` 110. typecheck ✓, 236/236 ✓.
- [x] Part E: `systems/party.ts` (`Party`, 12 phương thức). `GameRoom.ts` 1.395, `party.ts` 185. typecheck ✓, 236/236 ✓.
- [x] Part F: `systems/wild.ts` (`Wild`: `handleThrow`, `removePal`, `spawnPal`, mới `tickRespawn(dtMs)` chuyển nguyên văn từ cuối `tick`; `tick` kết thúc bằng `this.wild.tickRespawn(dtMs);`); cửa test `spawnPal`, `removePal`. Bỏ hai tiêu đề `// ----` đã rỗng ("Combat, health and the day cycle", "Pal skills") khỏi `GameRoom.ts`. `GameRoom.ts` 1.249, `wild.ts` 180. typecheck ✓, 236/236 ✓.
- [x] `docs/architecture.md`: bullet `GameRoom` ghi rõ phần chưa tách (đợt 2), bullet `systems/` mới (bảng 6 file + luật làm việc), tên file ở các chỗ nhắc `handleThrow`, chiêu, trùm, `sheltered`, `grantXp`, lưu game; câu về `paths.run(now)`; mục Kiểm thử thêm quy ước cửa test và `(room as any).<hệ thống>.<phương thức>`.
- Kiểm tra cuối Part F:
  - `git diff --exit-code dfb0c1c -- <file không được đổi>`: exit 0.
  - Kiểm tra bảo toàn dòng (chỉ đọc): dòng MẤT chỉ có hai dòng tiêu đề `// ----`, hai tên mục đã chuyển ("Combat, health and the day cycle", "Pal skills (skills.ts): cast, then landing"), và bốn dòng khai báo đổi vì thêm `export` (`function store()`, `interface Cast`, `interface CompanionTimers`, `interface PlayerControl`). Dòng MỚI: 81 dòng, toàn bộ là vỏ class, JSDoc class, trường `readonly x = new X(this)`, `export { useStore }`, cửa test, chú thích khối trường, `tickRespawn` và lời gọi, dấu đóng.
  - Các lệnh grep của Tiêu chí: `constructor(` chỉ dạng `constructor(private readonly room: GameRoom) {}`; không có `this.x = room.y`; không có import giá trị giữa hệ thống hay từ `GameRoom.ts`; `room.<phương thức cửa test>(` trong `systems/` rỗng. `this.eat(` và `this.openChest(` còn trong `GameRoom.ts` vì `camp` và `world` chuyển ở đợt 2 (Part G, H).
  - `git diff -M --stat dfb0c1c` không có dòng đổi tên.
- Lệch kế hoạch:
  - Phương thức còn ở `GameRoom` mà hệ thống gọi qua `this.room.` (`notify`, `announce`, và tạm thời `questEvent`, `harvest`, `gather`, `giveWearable` cho tới đợt 2) bỏ `private` (cần để typecheck qua; `notify`/`announce` là public theo kế hoạch). Không đổi hành vi.
  - Phần "phương thức chỉ dùng trong class thì `private`" làm theo kết quả tìm lời gọi ngoài class lúc này (ví dụ `sheltered`, `faintCompanion`, `nearestPal`, `lunge`, `land`, `support`, `castTargetPos` là `private`). Đợt 2 nếu `world`/`camp`/`movement` cần gọi thì bỏ `private` ở đúng chỗ.
  - Import trong file hệ thống giữ cách viết của `GameRoom.ts` (tên lẫn `type` trong một khối `@petgame/shared`, theo thứ tự cũ), không sắp xếp lại.
  - `skills.ts` 352 dòng và `combat.ts` 350 dòng (kể cả khối import dài), vẫn dưới trần 360 của Tiêu chí.
- Chưa làm (đợt 2, T10b): Part G-K (`world`, `camp`, `movement`, `debug`, dọn cuối và tài liệu hoàn chỉnh; `GameRoom.ts` còn 1.249 dòng).
- Lỗi phát hiện mà không sửa: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (504 test, 33 file), build ✓, test:e2e ✓ (56 test, cổng 2567/5173 trống). Chưa commit; `git add -N packages/server/src/systems` đã chạy để file mới hiện trong `git diff`.

## Kiểm thử vòng 1 (T10, Part A-F): PASS
- typecheck ✓   test ✓ (504 test, 33 file)   build ✓   e2e ✓ (56 test, 9,9 phút, cổng 2567/5173 trống, không có test chập chờn)   photo3d (không chạy, không đụng)
- `npx vitest run packages/server` chạy 3 lần: 236/236 cả ba lần.
- Phạm vi: `git diff --exit-code dfb0c1c -- '*.test.ts' packages/client packages/shared tests/e2e` exit 0 (không đổi gì). `git diff -M --stat dfb0c1c` không có dòng đổi tên. Không có import giá trị giữa các hệ thống hay từ `GameRoom.ts`. Số dòng: GameRoom.ts 1.249; saving 65, skills 352, combat 350, leaders 110, party 185, wild 180.
- Kiểm tra bảo toàn dòng (chạy lại độc lập): MẤT 8, MỚI 81, trùng khớp số của coder.
  - MẤT: hai dòng `// ----`, hai tiêu đề mục (`// Combat, health and the day cycle`, `// Pal skills (skills.ts): cast, then landing`), và `function store()`, `interface Cast`, `interface CompanionTimers`, `interface PlayerControl` (bốn dòng này chỉ thêm `export`, bản `export ...` nằm trong danh sách MỚI).
  - MỚI: JSDoc của class/khối trường, 6 vỏ class + `constructor(private readonly room: GameRoom) {}`, 6 trường `readonly x = new X(this)`, `export { useStore }`, 9 phương thức uỷ quyền `// Test access` (đã đọc từng cái, mỗi cái gọi đúng phương thức hệ thống cùng tên), `tickRespawn` và lời gọi, 15 dấu `}`. Không có dòng logic nào ngoài các loại này.
- `tickRespawn`: trích nguyên văn khối cũ (849-856 ở dfb0c1c); chỉ `this.` đổi thành `this.room.` cho `dayTime`, `bossId`, `alphas`, `state`, `respawnTimer`, còn `this.spawnPal()` thành `this.spawnPal()` của `Wild`. Trong `tick` vẫn là dòng cuối, sau `tickDay`, thứ tự các bước giữ nguyên (`tickCompanions`, `paths.run`, `tickCasts`, `tickExploration`, `tickClimate`, `tickRegen`, `tickDay`, `tickRespawn`).
- Tương đương hành vi (ngoài unit test): script tạm ngoài repo mô phỏng xác định, chạy trên bản cũ (git worktree ở dfb0c1c, đã gỡ) và bản mới. `Math.random` gieo hạt, đồng hồ giả, tắt vòng mô phỏng thật rồi tự gọi `tick(50)` 1.556 lần, đẩy tin qua `onMessageEvents` (input, attack, throw, dash, palSkill, palAuto, eat, feed, assign, placeBase, summon, release, debug:givePal/spawnPal/xp/setTime/teleport), bắt cả broadcast lẫn `client.send`, chụp `state.toJSON()` mỗi 10 tick; UUID và sessionId được chuẩn hoá. Có bắt thú, hạ thú, thú hoang bắn chiêu, lunge, rương, thu hoạch, thả thú, ngày đêm, thú hoang hồi sinh. Kết quả: cũ-cũ, cũ-mới, mới-mới đều trùng từng byte (155 ảnh chụp trạng thái + log tin). Hạn chế: trùm và thú đầu đàn chỉ có mặt trong thế giới, không bị kích hoạt (người chơi dịch chuyển tới cách 683 px không gây dậm chân), nên đường `bossStomp`/`defeatBoss` chỉ được các test hiện có che.
- Đột biến thử: đổi `damage` uỷ quyền thành gọi `this.combat.daze(...)`: `GameRoom.test.ts` bắt được (2 test lỗi: "armor stops part of the damage" và test ở dòng 1123, `TypeError: Cannot create property 'dizzy' on number '20'`). Đã hoàn lại, `GameRoom.ts` về đúng 1.249 dòng, nội dung bằng bản trước đột biến.
- Tiêu chí hoàn thành đợt 1: [x] 6 file hệ thống tồn tại, dưới 360 dòng, có JSDoc  [x] phương thức giữ tên, tham số, thân  [x] không import giá trị giữa hệ thống  [x] file test/client/shared/e2e không đổi  [x] bảo toàn dòng  [ ] `GameRoom.ts` dưới 700 dòng (thuộc đợt 2, T10b)
- Lỗi: không có.
- Test đã thêm: không (refactor thuần, test cũ giữ nguyên; script mô phỏng nằm ngoài repo ở scratchpad).

## Vòng 2 (T10b, Part G–K): coder

Cùng cách làm như vòng 1 (script tạm ngoài repo, chuyển nguyên văn, chỉ đổi đường gọi). Sau mỗi phần: `npm run typecheck` sạch và `npx vitest run packages/server` 8 file, 236 test qua (khoảng 145 s).

- [x] Part G: `systems/world.ts` (`World`, 10 phương thức: `tickDay`, `placeChest`, `tickExploration`, `openChest`, `questEvent`, `catchUpQuest`, `growFruit`, `harvest`, `gather`, `tickClimate`); cửa test `openChest`. Mọi `this.room.questEvent` (8 chỗ trong combat, leaders, party, wild), `harvest`/`gather` (`combat.ts`) và các lời gọi trong `GameRoom` đã trỏ sang `…world.…`. `GameRoom.ts` 1.045 dòng, `world.ts` 226. typecheck ✓, 236/236 ✓.
- [x] Part H: `systems/camp.ts` (`Camp`, `BASE_CLEARANCE`, `BASE_SPACING`, 6 phương thức); cửa test `eat`; `giveWearable` (`leaders.ts`, `GameRoom`) và handler `Eat` trỏ sang `camp`. `GameRoom.ts` 937, `camp.ts` 134. typecheck ✓, 236/236 ✓.
- [x] Part I: `systems/movement.ts` (`Movement`, `BOSS_DETOUR`, `tickCompanions`, `dash`, `bossHeadHome`, mới `tickPlayers(dtMs)` và `tickWild(dtMs, now)` chuyển nguyên văn từ `tick`). `tick` đúng như PLAN mục 4. `GameRoom.ts` 657, `movement.ts` 307. typecheck ✓, 236/236 ✓.
- [x] Part J: `systems/debug.ts` (`registerDebugHooks(room)`, thân khối debug nguyên văn, thụt lề giảm 4, `this.` → `room.`); `onCreate` còn `if (process.env.PETGAME_DEBUG === "1") registerDebugHooks(this);`. `GameRoom.ts` 564, `debug.ts` 103. typecheck ✓, 236/236 ✓.
- [x] Part K: bỏ ba tiêu đề `// ----` đã rỗng ("Player actions", "Exploration…"), `announce` dời xuống ngay sau `notify`. Tài liệu: `docs/architecture.md` (bullet `GameRoom` viết lại gồm thứ tự `tick`; bảng `systems/` đủ 10 file; cửa test thêm `openChest`, `eat`; bullet `persistence/store.ts`: ghi ở `systems/saving.ts`, đọc ở `GameRoom.onJoin`), `docs/design/pals.md` (dòng 89, 220, 289), `docs/design/skills.md` (dòng 7). `GameRoom.ts` cuối cùng **556 dòng** (dưới 700); hệ thống: `saving` 65, `skills` 352, `combat` 350, `leaders` 110, `party` 185, `wild` 180, `world` 226, `camp` 134, `movement` 307, `debug` 103 (đều dưới 360).
- Lệch kế hoạch:
  - Không sửa `CLAUDE.md` (dòng 17 mô tả `rooms/GameRoom.ts`, bullet lưu game "chỗ đọc/ghi trong `GameRoom`"): PLAN.md cấm, và coder không được sửa file cấu hình theo yêu cầu của agent khác. Agent chính hoặc người dùng tự sửa nếu muốn (sửa thuần sự thật: nhắc thư mục `systems/`).
  - Mô phỏng tất định so sánh bản cũ và mới: không tạo worktree (lệnh `git worktree add` + `rm -rf` bị hệ thống từ chối); thay bằng `git archive dfb0c1c packages` giải nén vào thư mục tạm trong scratchpad (`old-src`, `node_modules` là symlink; `@petgame/shared` của hai bên cùng trỏ vào `packages/shared` hiện tại, vốn không đổi so với `dfb0c1c`). Không có worktree nào cần dọn (`git worktree list` chỉ có thư mục chính).
- Kiểm tra cuối:
  - `npm run typecheck` ✓; `npm test` ✓ (504 test, 33 file); `npm run build` ✓; `npm run test:e2e` ✓ (56 test; cổng 2567/5173 trống; không có lỗi chập chờn).
  - `git diff --exit-code dfb0c1c -- <file không được đổi>`: exit 0; `git diff -M --stat dfb0c1c` không có dòng đổi tên.
  - Kiểm tra bảo toàn dòng (chỉ đọc): dòng MẤT chỉ có tiêu đề `// ----` và tên mục đã chuyển (6 dòng `// ---`, "Combat, health and the day cycle", "Exploration: treasure chests and quests", "Pal skills (skills.ts)…", "Player actions"), dòng `if (process.env.PETGAME_DEBUG === "1") {` (thành một dòng mới) và bốn khai báo đổi vì thêm `export` (`function store()`, `interface Cast`, `CompanionTimers`, `PlayerControl`). Dòng MỚI: vỏ class và JSDoc, trường `readonly x = new X(this)`, `export { useStore }`, mười một cửa test, chú thích khối trường, chữ ký và JSDoc của `tickPlayers`/`tickWild`/`tickRespawn`/`registerDebugHooks` cùng lời gọi, dấu đóng.
  - Các lệnh grep của Tiêu chí: `constructor(` chỉ dạng `constructor(private readonly room: GameRoom) {}`; không có `this.x = room.y`; không có import giá trị giữa hệ thống hay từ `GameRoom.ts`; `GameRoom.ts` không gọi `this.<11 cửa test>(` ngoài thân cửa test; `systems/` không gọi `room.<cửa test>(`. `paths` vẫn là `new PathPlanner(defaultNav())` trên phòng.
  - Mô phỏng tất định `sim/sim.mts` (1.556 bước, 155 ảnh chụp state, 21 tin): bản cũ `dfb0c1c` và bản mới cho `simold.json` và `simnew.json` giống từng byte (3.629.115 byte, SHA-256 `5ce61e23…8a3`).
- Lỗi phát hiện mà không sửa: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (504 test), build ✓, test:e2e ✓ (56 test). Chưa commit; `git add -N packages/server/src/systems` đã chạy.

## Kiểm thử vòng 1 (T10b): PASS
- typecheck ✓   test ✓ (504 test, 33 file, trước khi thêm test mới; sau đó `packages/server` 237 test, 9 file)   build ✓   e2e ✓ (56 test, không chập chờn, 8,8 phút)   photo3d (không chạy)
- `npx vitest run packages/server` 3 lần liên tiếp: 236/236 cả ba lần (không chập chờn).
- Phạm vi: `git diff --exit-code dfb0c1c` trên `packages/client`, `packages/shared`, `tests`, mọi `*.test.ts` hiện có: exit 0.
- Kiểm tra dòng bị dời (so `GameRoom.ts` của dfb0c1c với `GameRoom.ts` + `systems/*.ts` hiện tại; chuẩn hóa: bỏ thụt lề, `this.room.`/`room.`/`this.<hệ thống>.` thành `this.`, bỏ `private`/`export`/`readonly`; so tập dòng):
  - Dòng MẤT (15): 6 dòng `// ----`, 4 tiêu đề mục đã chuyển, 4 import cũ (`detourLimit, PathPlanner`, `emptyProfile...openStore...`, `findNearestTarget, stepChase, stepFlee...`, `newBrain, randomPoint, stepWander...`) bị tách ra import theo từng file, và `if (process.env.PETGAME_DEBUG === "1") {` (thành một dòng gọi `registerDebugHooks`). Không mất dòng logic nào.
  - Dòng THÊM (267): chỉ là import/`} from "@petgame/shared"`/tên import, `import type { GameRoom }`, khai báo `class X {`, `constructor(private readonly room: GameRoom) {}`, `x = new X(this)`, các hàm bao test access (`startCast(...args)`, `return this.startCast(...args)`...), ba chữ ký `tickPlayers/tickWild/tickRespawn` cùng 3 dòng gọi, `registerDebugHooks`, JSDoc, và `}` đóng. Không có dòng logic mới.
- Thứ tự `tick` khớp PLAN mục 4 và khớp `tick` của dfb0c1c (players, wild, companions, paths.run, casts, exploration, climate, regen, day, respawn). Thứ tự `onMessage(ClientMessage.*)` (15 tin) và thứ tự 11 hook `debug:*` giống hệt bản cũ. `registerDebugHooks` chỉ được gọi dưới `process.env.PETGAME_DEBUG === "1"` (GameRoom.ts:243), cùng điều kiện cũ.
- Tương đương: `sim/sim.mts` (1.556 bước) cũ (dfb0c1c, giải nén bằng `git archive` vào `old-t10b/`) và mới: byte-giống hệt (sha256 `5ce61e23...`). Mở rộng `sim/sim2.mts` (2.496 bước, 146 tin; teleport cạnh boss 80 lượt tấn công, rồi đầu đàn 80 lượt, kèm `debug:xp`/`debug:gear`): boss bị đánh còn 508/1152 HP, vẫn byte-giống hệt. Ghi chú: đầu đàn gần như không bị trúng đòn (HP nguyên), nên nhánh hạ đầu đàn chưa được chạy tới.
- Đột biến (đã hoàn nguyên, `cmp` với bản sao: khớp):
  - `tickPlayers` <-> `tickCompanions` trong `tick`: mô phỏng BẮT được, test cũ không.
  - `tickWild` <-> `tickCompanions`, `tickCasts` <-> `tickRegen`, `tickDay` <-> `tickRespawn`: test cũ KHÔNG bắt, mô phỏng cũng không. Đây là lỗ hổng test (xem dưới).
  - Đổi chỗ khối `rootedUntil` và khối `dizzy` trong `movement.ts tickWild`: không test nào, không mô phỏng nào bắt (hiếm gặp: thú vừa choáng vừa bị trói).
  - `registerDebugHooks(this)` không kiểm tra env: BỊ BẮT bởi 2 test hiện có ("the test hook that gives XP is not there on a real server", "the hold hook is not there on a real server").
- Test đã thêm: `packages/server/src/rooms/tickOrder.test.ts` (1 test, thay hàm của các hệ thống bằng bản ghi gọi, ghim thứ tự 10 bước của `tick`). Đã kiểm chứng: bắt cả ba đột biến thứ tự ở trên (wild<->companions, casts<->regen, day<->respawn).
- Tiêu chí hoàn thành: [x] typecheck/test/build/e2e sạch  [x] phạm vi file không đổi  [x] bảo toàn dòng  [x] thứ tự `tick`  [x] hook debug chỉ bật với PETGAME_DEBUG=1  [x] mô phỏng tương đương
- Lỗi: không có. Chưa commit; `tickOrder.test.ts` là file mới chưa `git add`.
