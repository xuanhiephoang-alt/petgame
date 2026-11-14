PASS
# REVIEW: T11 (đợt 1: Phần 0, A-C, tách `Game.ts` thành `skillCasts.ts`, `serverEvents.ts`, `controls.ts`), vòng 1

## Kết luận
Đây là một refactor thuần, làm đúng PLAN.md: các thân hàm chuyển nguyên văn, thứ tự đăng ký đúng, hợp đồng `__petgame.game` và `frame()` giữ nguyên. Lần hỏng của `boss bar (phone upright, notch)` là nhiễu thống kê của lỗi chập chờn T63 có từ trước. Code đã chuyển không chạm tới cơ chế gây ra lỗi đó (lý do cụ thể ở dưới).

## Lỗi phải sửa
Không có.

## Đã kiểm (reviewer tự chạy, chỉ đọc)
- **Bảo toàn dòng** (lệnh ở mục Test của PLAN, so ở `767619d`):
  - Dòng MẤT rỗng.
  - Dòng MỚI chỉ gồm: JSDoc của 3 class, JSDoc của `bind()`, chú thích khối trường, `class X {`, `constructor(game: Game) {}` ×3, `bind() {`, 3 trường `x = new X(this);`, `this.bind();` và các dấu `}` / `/**` / `*/`.
  - Thêm một lần so theo số lần xuất hiện (`uniq -c`): không dòng cũ nào bị giảm số lần.
- **Thứ tự đăng ký:** đúng 31 dòng như PLAN. Gồm 6 cặp `onAdd`/`onRemove`, rồi `listen("dayTime"`, rồi 18 `onMessage` từ Harvested tới Produced.
- **Phạm vi file:** lệnh `git diff --exit-code` cho exit 0. `labelLayout.ts`, `labelLayout.test.ts`, `multiplayer.spec.ts`, `shots.mjs` không đổi. `git stash list` vẫn đúng 2 mục. Reviewer không chạy lệnh stash nào; chỉ đọc `stash@{0}:PROGRESS.md` bằng `git show`.
- **`npm run typecheck`:** sạch.
- **Không giữ bản sao:**
  - Cả 3 hàm dựng đều đúng dạng `constructor(private readonly game: Game) {}`.
  - Grep "bản sao" chỉ ra `x = this.game.joystick.value.x` / `y = …` trong `readInput`. Đây là gán vào biến cục bộ `let { x, y }`, giống hệt BASE, không phải trường.
- **Import:** module chỉ `import type { Game, PalEntity }` từ `./Game.ts`. `skillCasts.ts` import giá trị từ `./skillfx.ts`, là file lá, được phép. Không có vòng import.
- **Phạm vi truy cập:**
  - `send`, `me`, `nearMe` bỏ `private` đúng luật 6.
  - `init`, `abandon`, `watchConnection`, `bindRoom`, `frame`, `lights`, `bossActor` vẫn `private`.
  - Các phương thức chưa tách (`tip`, `updateHud`…) vẫn `private`, đúng cho đợt 1.
  - Trong module: `gatherSpot`, `nearestPal`, `setFate` là `private`.
- **`frame()`:** trong diff chỉ đổi đúng một dòng `this.controls.readInput()`. `updateBossBar()` vẫn gọi trước `updateHud()`, `this.labels.update(now, aimed?.tag)` vẫn là lời gọi cuối. `debugInfo` không đổi dòng nào. Mười thành viên hợp đồng vẫn trên `Game`, cùng tên.
- **Cấp phát mỗi khung:** `readInput` giống hệt BASE (đã cấp phát `{x,y}` từ trước). Không thêm closure, mảng hay object nào trong đường chạy mỗi khung. 3 module được tạo một lần, là trường `readonly`.
- **Đăng ký handler:**
  - `serverEvents.bind()` chỉ được gọi một lần, là câu cuối của `bindRoom`.
  - `bindRoom` vẫn được gọi từ đúng chỗ cũ trong `init`: sau `renderer.on("resize")`, trước `watchConnection()`.
  - Không còn chỗ nào khác gọi `bindRoom` hay `onMessage` trong `packages/client/src`.
  - Các closure handler được tạo một lần trong `bind()`, như trước trong `bindRoom`.
- **`destroy()` và dọn dẹp:**
  - Code đã chuyển không tạo `DisplayObject` nào. `chest.*.destroy()`, `camp.*.destroy()`, `entity.actor.destroy()` vẫn ở `Game.ts`, không đổi.
  - Module không giữ tài nguyên nên không cần `destroy()`.
  - Hẹn giờ trong handler vẫn là `setTimeout` của `window` như BASE.

## Lỗi chập chờn `boss bar (phone upright, notch)`: kết luận là nhiễu của lỗi T63 có từ trước

Lỗi nằm ở `multiplayer.spec.ts:2855`, `toHaveCount(screen.room)`: test chờ 2 thông báo, chỉ thấy 1.

**Số thông báo được hiện cùng lúc quyết định ở đâu.** Số thông báo hiện cùng lúc được chốt ngay lúc gọi `hud.showToast`. Hàm này gọi `measureSlots`, rồi `toastRoom(390, 844, toastFit)` (file `ui/hud.ts`, `ui/toastQueue.ts`). Trên màn 390×844, kết quả chỉ phụ thuộc hai số:
- `toastsTop`: đáy cột `.hud-left`. Số này đổi khi lớp `boss-near` bật hay tắt. Lớp đó do `Hud.setBoss` đặt, `setBoss` được `Game.updateBossBar()` gọi mỗi khung. Còn `bossId` do callback `onAdd("pals")` gán.
- `nameTop`: vị trí tên mình, lấy qua `setNameTop` (nối trong `init`) và cách xếp nhãn trong `labelLayout.ts`.

Đổi một trong hai số thì kết quả có thể là 1 thay vì 2. Đó đúng là hai cơ chế đã ghi ở T63/Q1 và T73: trùm đi xa nên thanh máu trùm ẩn và ô nhiệm vụ hiện lại; hoặc nhãn thú đi theo hay thú đang ngắm đẩy tên mình lên.

**Không chỗ sửa nào chạm tới hai số đó.** `updateBossBar`, `updateHud`, các callback state (gồm chỗ gán `bossId`), phần dựng HUD và `setNameTop` trong `init`, `labels`, `labelLayout.ts` và AI của trùm ở server đều không có dòng nào đổi. Diff `Game.ts` chỉ có mấy loại thay đổi: bỏ chữ `private`, đổi đường gọi, và xoá các khối đã chuyển.

Từng giả thuyết được nêu:
- **Dời `dayTime` lên trước:**
  - `Callbacks.listenInstance` (`@colyseus/schema/src/decoder/strategy/Callbacks.ts:148-164`) gọi handler đồng bộ ngay khi đăng ký, rồi mới `addCallback`.
  - Handler chỉ gán `serverDay`/`serverDayAt`, nên giá trị như cũ, chỉ sớm hơn vài micro giây. Không handler `onMessage` nào đọc hai trường này.
  - Phía client, cả `bindRoom` chạy đồng bộ trong một lượt, nên không tin nào được xử lý xen vào giữa.
- **Thời điểm `serverEvents.bind`:**
  - Hàm được gọi đồng bộ ở cuối `bindRoom`, tức cùng lượt và cùng chỗ trong `init` như 18 lời đăng ký cũ.
  - SDK lưu handler theo từng loại tin (`createNanoEvents`, `Room.ts:231`), nên thứ tự đăng ký giữa các loại không có ý nghĩa.
  - Handler `"damage"` thêm của `watchHurt` được đăng ký sau `init` như trước.
- **`controls.readInput`:** thân hàm giống hệt BASE và vẫn được gọi ở cùng chỗ đầu `frame()`. Test không gửi phím hay cần điều khiển nên kết quả là `STILL` như cũ. Thứ tự các lời gọi trong `frame()` không đổi.
- **Handler `Notice`/`LevelUp` (gọi `showToast`):** chuyển nguyên văn. Test vẫn chờ 0 thông báo trước khi tự đẩy 2 cái, giống hệt BASE.
- **Chi phí:** chỉ thêm vài bước tra `.game`/`.controls` mỗi khung và 3 module tải lúc khởi động. Không đáng kể so với một Chromium vẽ WebGL bằng phần mềm.

**Về thống kê:**
- Cây làm việc hỏng khoảng 2/9 lần, BASE 0/7 lần. Kiểm định chính xác Fisher một phía: p ≈ C(9,2)/C(16,2) ≈ 0,30 (≈ 0,27 nếu tính 8 lần). Không có ý nghĩa thống kê.
- Hai lần hỏng xảy ra liền nhau (lần chạy đầy đủ rồi lần chạy lại ngay sau), sau đó 7 lần liên tiếp đều qua. Điều này giống một điều kiện nhất thời (thế giới, tải máy) hơn là một thay đổi có tính quyết định.
- BASE chưa có phần dọn test của T63. Ngay cả với phần dọn đó, `stash@{0}:PROGRESS.md` vẫn ghi lỗi tên bị đẩy lên khoảng 1/40 lần. Lỗi này cũng đã xuất hiện ở T67 vòng 2, trước mọi thay đổi của T11.

Theo mục Test 4 của PLAN, lỗi này là lỗi chập chờn đã biết, không tính là FAIL. Nếu T11b còn gặp lại với tần suất tương tự, nên đưa số liệu vào T63/T73, không quy cho refactor.

## Góp ý không bắt buộc
- `docs/architecture.md`, bullet `game/Game.ts`: câu mở đầu "nối state phòng với hình (`Callbacks`, trong `bindRoom`, cùng dựng HUD, …: các phần này chưa tách)" hơi rối. Bullet chưa nhắc `watchConnection`, `lights`, thứ tự trong `frame()`, chưa nói `bindRoom` kết thúc bằng `serverEvents.bind()`, và danh sách trường chưa ghi "ai đọc". Phần G (T11b) yêu cầu viết lại bullet này, nên có thể để đến lúc đó.
- `PROGRESS.md` ghi lệch nhau: coder ghi thư mục ảnh `shots/t11-r1` và e2e 56/56, tester ghi `shots/t11-v1` và 55/56. Khi viết mục T11b nên thống nhất tên thư mục mốc, nếu dùng lại.
- JSDoc của class `Game` vẫn tả kiểu cũ ("…and the DOM HUD, predicts…"). PLAN dời việc sửa sang Phần G, nên giữ như hiện tại là đúng.
- `readInput` không có JSDoc, giống BASE. Không thêm là đúng luật "thân và JSDoc giữ nguyên". Có thể bổ sung trong một nhiệm vụ dọn chú thích sau này.
