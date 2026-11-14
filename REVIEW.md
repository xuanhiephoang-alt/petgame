PASS
# REVIEW: T11b (đợt 2 của PLAN T11: Phần D-G, `looks.ts`, `hudBridge.ts`, `stateSync.ts`, tài liệu), vòng 1

## Kết luận
Đợt 2 là refactor thuần, đúng PLAN.md.
- **Thân hàm:** chuyển nguyên văn; so cả hai đợt với BASE `767619d`, chỉ mất đúng hai dòng JSDoc cũ của class `Game` mà PLAN yêu cầu thay.
- **Thứ tự đăng ký** và **`frame()`** giữ nguyên.
- **Hợp đồng `__petgame.game`** còn nguyên.
- **`docs/architecture.md`** khớp với code.

Không có lỗi phải sửa.

## Lỗi phải sửa
Không có.

## Đã kiểm (reviewer tự chạy, chỉ đọc; không chạy lệnh `git stash` nào, `git stash list` vẫn 2 mục)
- **Bảo toàn dòng** (lệnh của PLAN, so `767619d` với `Game.ts` + 6 file):
  - Dòng MẤT chỉ có `* The game screen: connects the synced room state…` và `* and the DOM HUD, predicts…`, tức JSDoc cũ của class `Game`, đã được Phần G thay.
  - Tôi so thêm theo số lần xuất hiện (`join` trên `uniq -c`): ngoài hai dòng đó, không dòng nào giảm số lần.
  - Dòng MỚI chỉ thuộc các loại PLAN cho phép:
    - JSDoc của 5 class, `bind()` ×2, `build()`, chú thích đầu `looks.ts`, JSDoc mới của `Game`, chú thích khối trường;
    - `class X {` và `constructor(game: Game) {}` ×5;
    - 5 trường `x = new X(this);`;
    - `bind() {` ×2, `build(container: HTMLElement, isTouch: boolean) {`;
    - `this.bind();` ×2, `this.build(container, isTouch);`;
    - các dấu đóng.
- **Thứ tự đăng ký** (`Game.ts` + `stateSync.ts` + `serverEvents.ts`):
  - Đúng 31 mục: 6 cặp `onAdd`/`onRemove`, rồi `listen("dayTime"`, rồi 18 `onMessage` từ Harvested tới Produced.
  - `Game.ts` không còn mục nào khớp mẫu.
- **Gọi một lần, đúng chỗ:**
  - `init` gọi `this.hudBridge.build(container, isTouch)` đúng chỗ khối cũ: sau `new Labels(...)`, trước `renderer.on("resize")`.
  - `bindRoom` chỉ còn `this.stateSync.bind(); this.serverEvents.bind();` và vẫn được gọi một lần từ `init`, trước `watchConnection()`.
  - Không còn ai gọi `bind`, `build` hay `bindRoom` ở chỗ khác.
- **`frame()`:** so với 868c07e, chỉ đổi `this.stateSync.removeActor(l.entity)`, `this.hudBridge.updateBossBar()` và `this.hudBridge.updateHud()`; cùng với `controls.readInput` của đợt 1 là đủ 4 đường gọi. `updateBossBar` vẫn trước `updateHud`; `this.labels.update(now, aimed?.tag)` rồi `frames++` vẫn ở cuối. `debugInfo` giống hệt BASE.
- **Không giữ bản sao:**
  - Cả 5 hàm dựng đều đúng dạng `constructor(private readonly game: Game) {}`.
  - Grep "bản sao" chỉ ra hai biến cục bộ joystick trong `controls.readInput` (giống BASE, đã giải thích ở vòng trước).
  - Trong `build`, `panels` và `unlock` vẫn là biến cục bộ; các widget được gán thẳng vào `this.game.hud`, `.party`, `.skillBar`…
- **Import:**
  - Không có import giá trị nào từ `./Game.ts` hay giữa các module; chỉ có `import type { Game, PalEntity, Named }`.
  - `looks.ts` chỉ import từ `@petgame/shared`.
  - Import giá trị từ các file lá (`labelLayout.ts`, `palSprites.ts`, `entities.ts`, `art/props.ts`, `looks.ts`) không tạo vòng.
  - `Game.ts` đổi `GameRoom` và `PalSprite` sang `import type`, đúng vì chỉ dùng làm kiểu.
- **Phạm vi truy cập** (luật 6):
  - `HudBridge`: `build`, `tip`, `updateHud`, `updateBossBar` là public; `updateSkillBar`, `updateRegion`, `updateMinimap` là private.
  - `StateSync`: `bind`, `removeActor` là public; `nameTag`, `updateHpBar`, `syncCamp`, `addActor` là private.
  - `Game` còn lại đúng danh sách "Ở lại `Game.ts`": `create`, `abandon`, `send`, `init`, `watchConnection`, `bindRoom`, `me`, `frame`, `lights`, `nearMe`, `bossActor`, `debugInfo`.
- **Cấp phát mỗi khung:**
  - Thân `updateHud`, `updateMinimap`, `updateRegion`, `updateSkillBar`, `updateBossBar` giống hệt BASE. Các cấp phát có sẵn (`resources`, `party`, `players`, `alphas`…) được giữ lại vì PLAN cấm dọn trong refactor.
  - Không thêm closure, mảng hay object nào; mỗi khung chỉ thêm vài bước tra `.game`/`.hudBridge`/`.stateSync`.
- **`destroy()` và dọn dẹp:** `chest.body/gem.destroy()`, `camp.root.destroy({ children: true })`, `camp.floor.destroy()`, `labels.remove(camp.tag)` và `removeActor` (`labels.remove` + `actor.destroy()`) đều chuyển nguyên văn. Module không giữ tài nguyên riêng.
- **Phạm vi file:** `git diff --exit-code 767619d -- <danh sách của PLAN>` cho exit 0. `git diff --stat 767619d` chỉ có `Game.ts`, 6 file mới, `docs/architecture.md` và các file làm việc.
- **Kiểm tra chạy lại:** `npm run typecheck` sạch; `npx vitest run packages/client` qua 110/110.
- **Số dòng:** `Game.ts` 454 (< 540). Các file mới đều dưới 380 dòng: 101, 368, 146, 35, 205, 321.
- **`docs/architecture.md`:**
  - Bullet `Game.ts` khớp code: những gì còn ở lại, `watchConnection` (dừng cú lướt, xoá `lastSentInput`, gửi đứng yên khi trang bị ẩn), thứ tự `frame()`, và bảng trường e2e/shots kèm ai đọc.
  - Bảng 6 file và luật làm việc khớp PLAN.
  - Không còn câu "xử lý mọi `ServerMessage`".
  - Không tài liệu nào khác (`docs/design/*`, `GAME_PLAN.md`) nhắc phương thức đã chuyển.
- **Ảnh `island`:** chấp nhận lời giải thích của tester và coder. Cùng hiện tượng (bị Coralcrab đầu đàn hạ rồi tỉnh dậy bên lửa trại) đã tái hiện được ở mã 868c07e và biến mất khi chụp lại trên cây làm việc, nên đây là cuộc đua thời gian, không do refactor. Các dòng CHECK khác là nhiễu thế giới chuyển động; mọi ảnh ≤ 600 sprite, không nhãn nào chồng nhau.

## Góp ý không bắt buộc
- Phần F.1 của PLAN bảo thêm `export` cho `interface Camp`, nhưng `Camp` vẫn chưa export (`Game.ts:68`). Việc này không gây lỗi vì `stateSync.ts` suy ra kiểu từ `this.game.camps`. Nhưng `PROGRESS.md` ghi "Lệch kế hoạch: không có", tức chưa chính xác. Nên export cho nhất quán với `Named`/`PalEntity`, hoặc ghi lại là cố ý không làm.
- `looks.ts`: chú thích đầu file là một khối `/** … */` đứng riêng, ngay trên JSDoc của `Dressed`, nên trình soạn thảo có thể coi nó là JSDoc thứ hai của `Dressed`. Đổi thành chú thích thường `//` hoặc `/* … */` thì rõ hơn (việc nhỏ, có thể làm trong T12).
- `PROGRESS.md` của coder ghi "mọi ảnh ≤ 380 sprite", nhưng bảng ở ngay dưới có `aim-meadow-night` 353 và `labels-portrait-alpha` 372. Đúng ra phải là ngân sách ≤ 600 sprite như tester ghi; nên sửa câu đó cho khỏi nhầm.
- Ảnh `island` của `npm run shots` phụ thuộc may rủi (đã gặp ở cả hai đợt). Nên thêm vào `TASKS.md` thành một việc riêng (ví dụ cho T14): chụp lúc máu đầy, hoặc tạm cho người chơi không bị cắn trong cảnh đó.
