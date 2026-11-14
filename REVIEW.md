PASS
# REVIEW: T10 Tách `GameRoom.ts` (đợt 1, Part A-F), vòng 1

## Kết luận
Đây đúng là một lần chuyển code thuần, theo đúng 7 luật của PLAN.md. Đã so từng phương thức theo tên giữa `dfb0c1c` và bản mới, sau khi chuẩn hoá đường gọi. Mọi thân hàm, JSDoc, tham số và giá trị mặc định đều giống hệt. Chỉ có ba chỗ khác, và cả ba đều được phép: `tick` (khối hồi sinh thay bằng `this.wild.tickRespawn(dtMs)`), dòng JSDoc lạc chỗ dời từ `bossHeadHome` lên `spawnBoss`, và phương thức mới `tickRespawn`. Không còn lỗi phải sửa.

Đã kiểm tra lại độc lập:
- Lệnh bảo toàn dòng cho MẤT 8, MỚI 81. Cả hai danh sách đều chỉ gồm các loại được phép (tiêu đề `// ----`, `export` thêm cho `store`/`Cast`/`PlayerControl`/`CompanionTimers`, vỏ class, trường hệ thống, cửa test, dấu đóng).
- Script so phương thức theo tên, giữ thứ tự dòng. Cách này chặt hơn `comm` vì bắt được cả dòng bị đảo thứ tự trong thân hàm. Không có khác biệt nào ngoài ba chỗ nêu trên.
- `npm run typecheck` sạch.
- `git diff --exit-code` trên các file không được đổi: exit 0. `-M` không có dòng đổi tên.
- 30 test trùm và thú đầu đàn (`-t "boss|pack leader|alpha|stomp"`) qua. Chúng che `defeatBoss` (phần thưởng, thứ tự tin), hạ thú đầu đàn (`ALPHA.reward`, tin ★, hẹn giờ `ALPHA.respawnMs`), dậm chân, trùm về nhà và giới hạn tốc độ của thú đầu đàn.

## Lỗi phải sửa (FAIL khi còn mục này)
(không có)

## Ghi chú kiểm tra theo trọng tâm
- **Luật của PLAN:**
  - Hàm dựng chỉ có dạng `constructor(private readonly room: GameRoom) {}`.
  - Không có `this.x = room.y`, không destructure `this.room`, không `const room = …`. Mọi trường đều đọc `this.room.<trường>` ngay lúc dùng. Các phép gán (`casts`, `bossId`, `bossHome`, `bossReturning`, `respawnTimer`, `nextPalId++`) đều ghi thẳng lên phòng.
  - Từ hệ thống về `GameRoom.ts`, và giữa các hệ thống, chỉ có `import type`. Lời gọi lúc chạy đi qua `this.room.<hệ thống>`.
  - Thứ tự trong `tick` không đổi; `tickRespawn` vẫn là bước cuối.
  - Thứ tự gọi `Math.random` và thứ tự đăng ký `clock.setTimeout` không đổi, vì thân hàm giống hệt từng dòng.
- **Trùm và thú đầu đàn** (`leaders.ts`; `knockOut`, `hitWild`, `strike` trong `combat.ts`; `removePal` trong `wild.ts`): đã đọc tay, so với `git show dfb0c1c`.
  - Bên trong arrow của hẹn giờ, `this` là đúng instance hệ thống: `this.spawnBoss()` trong `Leaders`, và `this.room.leaders.spawnAlpha(def)` trong `Wild`.
  - `defeatBoss` vẫn chạy đúng thứ tự: `giveWearable` → `scheduleSave` → `notify` → `questEvent` → `grantXp` → `BossDefeated` → `removePal` → hẹn giờ.
- **Phạm vi truy cập:**
  - Mỗi phương thức public của hệ thống đều có ít nhất một lời gọi từ ngoài class.
  - Các phương thức `private` (`sheltered`, `faintCompanion`, `nearestPal`, `tooTired`, `spawnCompanion`, `lunge`, `castTargetPos`, `land`, `support`) chỉ được gọi trong class của chúng.
  - Bỏ `private` ở `notify`, `announce`, `questEvent`, `harvest`, `gather`, `giveWearable` không mở thêm đường nào cho client. Colyseus chỉ gửi tin tới handler đã đăng ký bằng `onMessage`, không có handler `"*"`, và client không gọi được phương thức của Room.
  - Tên trường hệ thống không trùng thành viên nào của `Room` trong Colyseus 0.18 (`world` và `movement` chỉ xuất hiện trong chú thích của `Room.d.ts`).
  - Hook `debug:*` vẫn nằm sau `process.env.PETGAME_DEBUG === "1"`.
- **Trùng lặp và đặt tên:**
  - Ngoài 9 cửa test, không có tên phương thức nào trùng giữa các hệ thống và `GameRoom`. Vì vậy chuẩn hoá đường gọi trong lệnh bảo toàn dòng không che được lỗi gọi nhầm hệ thống, và typecheck bắt phần còn lại.
  - Tên file, class và JSDoc tiếng Anh đúng quy ước.
  - Số dòng: `skills.ts` 352, `combat.ts` 350 (dưới trần 360); `GameRoom.ts` 1.249.

## Góp ý không bắt buộc (cho T10b, Part G-K)
- `docs/architecture.md`, bullet `persistence/store.ts`, vẫn ghi "chỗ đọc/ghi trong `GameRoom`". Thực tế phần ghi (`saveNow`) đã chuyển sang `systems/saving.ts`, còn phần đọc vẫn ở `GameRoom.onJoin`. Sửa trong Part K.
- Tài liệu thiết kế còn trỏ luật về `GameRoom.ts`: `docs/design/pals.md:89` (trùm), `docs/design/pals.md:220` (`provoke`, `wildTarget`, nay ở `systems/combat.ts`), `docs/design/pals.md:289` (chỗ gọi tìm đường), `docs/design/skills.md:7` (`startCast`/`tickCasts`/`land`, nay ở `systems/skills.ts`). Nên sửa trong Part K cùng lúc với `architecture.md`.
- `CLAUDE.md:17` ghi "rooms/GameRoom.ts (luật chơi)" và mục lưu game ghi "chỗ đọc/ghi trong `GameRoom`". T10 không được sửa `CLAUDE.md`, nên sau T10b agent chính có thể báo người dùng để họ cập nhật.
- Sau khi bỏ tiêu đề "Combat, health and the day cycle", trong `GameRoom.ts` các mục `bossHeadHome`, `announce` và `tickDay` rơi vào dưới tiêu đề "Player actions". Đợt 2 sẽ chuyển `bossHeadHome` và `tickDay` đi. Part K chỉ cần giữ lại các tiêu đề còn đúng, và đặt `announce` cạnh `notify`.
- Chuẩn bị cho đợt 2:
  - Các hệ thống đã chuyển đang gọi `this.room.questEvent` (6 chỗ), `this.room.harvest`, `this.room.gather` (`combat.ts:65`) và `this.room.giveWearable` (`leaders.ts:91`). Khi `world` và `camp` chuyển đi, các lời gọi này phải thành `this.room.world.…` và `this.room.camp.…`, và trên `GameRoom` không còn phương thức public nào sót lại ngoài `notify`, `announce` và các cửa test. Typecheck sẽ bắt nếu quên.
  - Nhớ thêm cửa test `eat` và `openChest`, và đổi `this.eat(` (dòng 322) và `this.openChest(` (dòng 1033) thành lời gọi tới hệ thống.
  - Mọi phương thức mà `tickWild`, `tickCompanions` và `debug.ts` sẽ cần (`breakOut`, `recover`, `cancelWindup`, `targetPos`, `wildTarget`, `strike`, `windUp`, `wildSkill`, `startCast`, `obey`, `wildArmor`, `provoke`, `hitWild`, `timers`, `workSpotFor`, `grantXp`, `summon`, `spawnPal`, `faintPlayer`) đã public sẵn, nên không phải đổi phạm vi truy cập.
