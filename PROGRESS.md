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
