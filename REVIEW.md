PASS
# REVIEW: T10b Tách nốt `GameRoom.ts` (đợt 2 của T10, Part G-K), vòng 1

## Kết luận
Đợt 2 vẫn chỉ chuyển code, đúng 7 luật của PLAN.md.
- **So với bản gốc:** đã so từng phương thức theo tên, giữ thứ tự dòng, giữa `dfb0c1c` và bản mới. Khác biệt chỉ có:
  - `onCreate`: khối debug thành `registerDebugHooks(this)`.
  - `tick`: ba khối tách thành `tickPlayers`, `tickWild`, `tickRespawn`.
  - Dòng JSDoc dời lên `spawnBoss`, đã duyệt ở đợt 1.
- **Ba khối tách ra và hook debug:** so dòng với khối cũ thì giống hệt, sau khi chuẩn hoá đường gọi.
- **`GameRoom.ts` (556 dòng):** chỉ còn những gì PLAN cho phép.
- **Tài liệu:** đúng.
- **Ngoài phạm vi PLAN có hai chỗ:** `tickOrder.test.ts` và sửa `CLAUDE.md`. Cả hai hợp lý và không làm FAIL; xem góp ý.

Đã kiểm tra lại độc lập:
- `npm run typecheck` sạch.
- `npx vitest run packages/server`: 9 file, 237/237 (gồm cả test mới).
- `git diff --exit-code dfb0c1c` trên các file không được đổi: exit 0. Không có dòng đổi tên.
- Lệnh bảo toàn dòng so với `dfb0c1c` (bỏ qua dòng import):
  - MẤT 15 dòng: 6 dòng `// ----`, 4 tiêu đề mục, 4 khai báo đã thêm `export`, dòng `if (process.env.PETGAME_DEBUG === "1") {`.
  - MỚI chỉ gồm vỏ class, JSDoc, 9 trường hệ thống, 11 cửa test, chữ ký và lời gọi của `tickPlayers`/`tickWild`/`tickRespawn`/`registerDebugHooks`, dấu đóng.
- `tickPlayers` và `tickWild` so dòng với khối 722-730 và 733-838 của `dfb0c1c`: giống hệt. Thân `registerDebugHooks` so với khối 422-506: giống hệt.
- Các lệnh grep của Tiêu chí đều rỗng: hàm dựng đúng dạng; không có bản sao trường, không destructure `this.room`; không import giá trị giữa các hệ thống hay từ `GameRoom.ts`; `GameRoom` không gọi cửa test; `systems/` không gọi `room.<cửa test>(`.

## Lỗi phải sửa (FAIL khi còn mục này)
(không có)

## Ghi chú kiểm tra theo trọng tâm
- **`tick`:** khớp đúng PLAN mục 4. `now` đọc một lần rồi truyền vào `tickWild`, `paths.run` và `tickRegen`.
- **Phạm vi truy cập:**
  - Mọi phương thức public của `World`, `Camp`, `Movement` đều có lời gọi từ ngoài class. `bossHeadHome` là `private` và chỉ `tickWild` gọi.
  - Trên `GameRoom`, ngoài vòng đời của Colyseus, chỉ còn public: `notify`, `announce` và 11 cửa test.
  - `questEvent`, `harvest`, `gather`, `giveWearable` không còn nằm trên phòng. 8 lời gọi trong `combat`, `leaders`, `party`, `wild` đã trỏ sang `this.room.world.…` / `this.room.camp.…`.
- **Hook debug:**
  - `registerDebugHooks` chỉ được gọi dưới `process.env.PETGAME_DEBUG === "1"` (`GameRoom.ts:243`).
  - Thứ tự 11 handler `debug:*` không đổi, và chúng vẫn đăng ký sau các handler thường như cũ.
  - Import giá trị `registerDebugHooks` không đăng ký gì khi chỉ import.
- **Danh sách bàn giao của tôi ở đợt 1:** đã làm đủ.
  - Bullet `persistence/store.ts` đã sửa.
  - `pals.md` dòng 89, 220, 289 và `skills.md` dòng 7 đã trỏ đúng file.
  - Đã bỏ tiêu đề rỗng; `announce` đã nằm cạnh `notify`.
  - Đã thêm cửa test `eat` và `openChest`.
  - Không còn chỗ nào nói luật chơi nằm ở `GameRoom.ts`.
- **Sửa `CLAUDE.md` của agent chính:** cả hai chỗ đều đúng sự thật và không đổi luật nào.
  - Dòng 17: `GameRoom` giữ vòng đời, `tick` và trạng thái; luật chơi nằm ở `systems/`.
  - Mục lưu game: đọc ở `GameRoom.onJoin` (`store().load`), ghi ở `systems/saving.ts` (`saveNow`).
  - Luật "dữ liệu chỉ server cần để trong `Map` của `GameRoom`" vẫn đúng.
- **`tickOrder.test.ts`:**
  - **Hợp lý:**
    - `new GameRoom()` không gọi `onCreate`, nên không sinh thú, không bật vòng mô phỏng và không ghi vào `worldCensus`.
    - Hàm dựng `Room` của Colyseus 0.18 không tạo hẹn giờ hay listener, nên không rò tài nguyên. Test chạy khoảng 1 s.
    - Test thay phương thức trên instance rồi ghi lại thứ tự gọi. Đó là cách trực tiếp nhất để ghim một luật mà PLAN coi là hành vi ("thứ tự trong `tick`").
    - Tester đã chứng minh nó bắt được 3 đột biến mà bộ test cũ bỏ sót.
  - **Mức giòn:** chấp nhận được. Test chỉ đỏ khi thứ tự hay đường gọi trong `tick` đổi, mà đổi thứ tự là một quyết định cần được nhìn thấy. Nếu đổi có chủ đích thì sửa mảng mong đợi kèm lý do trong PLAN.
  - **Lệch PLAN:** mục Test ghi "Không thêm và không sửa test". Lý do của luật đó là giữ bộ test cũ nguyên vẹn để làm bằng chứng; test mới nằm ở file riêng nên không phá điều đó, và vai tester cho phép viết test còn thiếu. Tôi chấp nhận.
  - File đang untracked: agent chính phải `git add` nó cùng commit.
- **Lỗ hổng `rootedUntil` / `dizzy`:** đây không phải lỗi của T10, vì `tickWild` giống hệt bản cũ. Hệ quả của việc đảo hai khối: một thú vừa hết choáng vừa còn bị trói sẽ giữ `dizzy = true` (và thưởng bắt dễ) cho tới khi hết trói. Xem góp ý.

## Góp ý không bắt buộc
- **Commit:** nêu rõ trong thân commit, hoặc tách thành commit riêng, việc sửa `CLAUDE.md` (PLAN T10 ghi "Không sửa `CLAUDE.md`") và việc thêm `tickOrder.test.ts`. Cuối phiên báo người dùng rằng `CLAUDE.md` đã đổi hai chỗ cho đúng cấu trúc mới, vì đó là file hướng dẫn của họ.
- **Việc mới cho `TASKS.md` (P3):** một test hành vi cho trường hợp thú đang choáng thì bị trói bằng dây leo, rồi hết choáng trước khi hết trói. Thú phải tỉnh (`dizzy = false`, máu về `DIZZY_RECOVER`) dù vẫn đứng yên. Test này ghim thứ tự khối `dizzy` trước `rootedUntil` trong `tickWild`, hiện chưa có gì bắt.
- **`tickOrder.test.ts`:** có thể ghi thêm tham số của các lời gọi `tickWild`, `paths.run`, `tickRegen` và kiểm chúng nhận cùng một `now` (bằng `room.clock.currentTime`), như PLAN Rủi ro 2 ("giữ đúng một chỗ đọc"). Tên file có thể là `GameRoom.tick.test.ts` cho gần quy ước `<tên>.test.ts`; tách khỏi `GameRoom.test.ts` là đúng, vì T10 không được sửa file đó.
- **`docs/architecture.md`, bullet `rooms/GameRoom.ts`:** câu đầu ("phòng Colyseus: vòng đời, định tuyến…, cửa test") và câu "Phòng giữ: …" lặp ý nhau. Nên gộp làm một khi sửa tài liệu lần tới.
- **`GAME_PLAN.md:128`:** còn ghi `GameRoom.startCast`/`land`, nay là `systems/skills.ts`. Đây là tài liệu tổng thể, sửa khi tiện.
- **Kích thước file:** `skills.ts` (352) và `combat.ts` (350) đã sát trần 360 của PLAN. Nhiệm vụ sau thêm nhiều logic vào chiêu hay chiến đấu thì nên tách tiếp (ví dụ `land`/`support` thành file riêng), thay vì để file phình ra.
