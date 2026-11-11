# PLAN: T19 Phím game vẫn chạy khi hộp thoại hoặc bảng đang mở

## Mục tiêu

- **Vấn đề (đọc code ở HEAD `593e3be`, chưa có gì chặn):** `Keyboard` (`packages/client/src/ui/keyboard.ts`) nghe `keydown`/`keyup` trên `window` và chạy mọi phím của thế giới bất kể focus đang ở đâu. Các trường hợp cụ thể:
  - Hộp xác nhận thả thú mở, bấm **Shift+Tab** để về "Giữ lại": phím Shift xuống trước Tab nên `dash()` chạy, nhân vật lướt. Test hiện có (`multiplayer.spec.ts` dòng 1148) bấm đúng tổ hợp này nhưng không kiểm tra nhân vật.
  - Hộp mở, giữ W/A/S/D hay mũi tên: nhân vật vẫn đi sau lớp mờ. Bấm 1-3: thú vẫn tung chiêu. E, B, H, R, M, N cũng vẫn chạy.
  - **Space trên nút đang có focus không bấm được nút đó**, kể cả trong hộp: `ownKey` chặn mặc định (`preventDefault`) của mọi phím hành động khi đích là `<button>`, rồi `attack()` chạy. Vậy trong hộp, Space là đánh chứ không phải "Giữ lại".
  - Bảng Chế tạo, Tủ đồ, Thú: người dùng bàn phím Tab vào bảng thì cũng vậy. Shift+Tab làm lướt, Space đánh thay vì bấm nút.
- **Sau nhiệm vụ:**
  - Khi hộp xác nhận mở, hoặc khi người chơi **dùng bàn phím** đưa focus vào một bảng, các phím của thế giới tạm dừng. Nhân vật đứng lại.
  - Tab, Shift+Tab, Enter, Space và Escape làm đúng việc của giao diện.
  - Người chơi dùng chuột hay cảm ứng vẫn chơi như cũ: mở bảng bằng chuột rồi vẫn đi, đánh được; bấm nút bằng chuột rồi Space vẫn là đánh (giữ quyết định cũ trong `keyboard.ts`).

## Phạm vi

**Làm:**
1. `packages/client/src/ui/keyboard.ts`: cổng tạm dừng (`KeyGate`), theo dõi focus đến từ bàn phím hay từ chuột/chạm, hàm thuần `worldKeysPaused`.
2. `packages/client/src/ui/keyboard.test.ts` (mới): unit test cho hàm thuần.
3. `packages/client/src/ui/party.ts`, `crafting.ts`, `wardrobe.ts`: getter công khai cho phần tử bảng, và `dialogOpen` cho bảng Thú.
4. `packages/client/src/game/Game.ts`: truyền cổng vào `new Keyboard(...)`.
5. `tests/e2e/multiplayer.spec.ts`: 1 test mới.
6. `docs/architecture.md`: mở rộng mô tả `keyboard.ts` trong dòng `ui/`. `docs/design/hud.md`: game-designer đã thêm mục "Bàn phím khi hộp thoại hoặc bảng giữ focus" trong nhiệm vụ này.

**KHÔNG làm:**
- Không đổi phím mở/đóng bảng: Q, C, T và Escape do từng bảng tự nghe. Các phím này giữ nguyên cách chạy trong mọi trường hợp. Test hiện có bấm Q khi hộp đang mở để đóng cả hộp lẫn bảng (dòng 1123), C để đổi bảng (dòng 1134), và vẫn phải qua.
- Không đổi bẫy Tab của hộp xác nhận (`party.ts`, `if (e.key === "Tab" && this.confirmId)`): nó đã xử lý cả Shift+Tab.
- Không tự đưa focus vào bảng khi mở bảng bằng phím. Lý do: người chơi hay bấm C khi đang đi tới trại. Nếu focus nhảy vào bảng thì phím đi sẽ dừng ngay.
- Không đưa màn mất kết nối (`connection.ts`) vào cổng. Khi mất kết nối, mọi hành động đã bị chặn bởi `watch.online`, và `frame()` có chủ ý giữ các phím đang giữ qua lúc kết nối lại ("the held keys count again once it is back"). Nếu cho nó vào cổng thì `held` bị xoá và hành vi đó đổi. Nút Về sảnh đã tự nhận Space.
- Không đổi cần điều khiển, nút cảm ứng, CSS, chữ hiển thị, server, shared, schema, message, hồ sơ.
- Không sửa test cũ, không thêm `waitForTimeout` để chờ trạng thái (chỉ dùng để giữ phím trong một khoảng thời gian, như test lướt hiện có).

## Thiết kế

Luật đầy đủ ghi trong `docs/design/hud.md`, mục "Bàn phím khi hộp thoại hoặc bảng giữ focus". Tóm tắt cho coder:

**Phím của thế giới** là mọi phím trong bảng `actions` của `Keyboard` cộng với phím đi:
- W, A, S, D và mũi tên;
- Space (đánh), Shift (lướt), E (ném bóng), B (đặt trại), R (đổi bóng), H (ăn), M (tắt tiếng), N (bản đồ), 1-3 (chiêu).

Chúng **tạm dừng** khi một trong hai điều sau đúng:

| Trường hợp | Điều kiện |
|---|---|
| A. Hộp xác nhận thả thú đang mở | `party.dialogOpen` (tức `confirmId !== ""`), focus ở đâu cũng vậy |
| B. Bàn phím đưa focus vào một bảng đang mở | `document.activeElement` nằm trong bảng Thú, Chế tạo hoặc Tủ đồ, bảng đó không `hidden`, **và** focus đến đó lúc thao tác gần nhất là phím (không phải `pointerdown`) |

**Khi tạm dừng:**
- `keydown` của phím thế giới: không chạy hành động, không ghi vào `held`, **không `preventDefault`**. Nhờ vậy trình duyệt tự làm việc của nó: Space và Enter bấm nút có focus, mũi tên cuộn danh sách.
- `keyup`: vẫn xoá phím khỏi `held` nhưng không `preventDefault`. Space bấm nút khi nhả phím, nên chặn `keyup` cũng làm hỏng việc bấm.
- `direction()` trả `{0, 0}` và xoá `held`: nhân vật đứng lại ngay (khung sau `frame()` gửi `Input` đứng yên).
  - Hết tạm dừng mà người chơi vẫn đang giữ phím thì phải nhấn lại mới đi.
  - Lý do: không có cách biết chắc phím nào còn được giữ sau khi `keydown` bị bỏ qua.
  - Giống hành vi khi cửa sổ mất focus (`blur`).

**Phím vẫn chạy khi tạm dừng (không đổi code):**
- Tab, Shift+Tab: chuyển focus. Trong hộp thì chỉ đổi qua lại giữa hai nút (bẫy Tab có sẵn).
- Enter, Space: bấm nút có focus (mặc định của trình duyệt).
- Escape: đóng hộp trước, lần sau đóng bảng (có sẵn). Bảng đóng thì focus rời bảng nên phím thế giới chạy lại ngay.
- Q, C, T: mở/đóng bảng như cũ.

**Vì sao trường hợp B cần biết focus đến từ bàn phím:** trên desktop, bấm chuột vào nút trong bảng (ví dụ tab "Mũ" của Tủ đồ) cũng để focus lại trên nút đó.
- Nếu chỉ xét "focus trong bảng" thì người chơi dùng chuột bấm nút xong là không đi được nữa.
- Người dùng chuột chỉ thấy phím dừng khi họ tự bấm Tab. Họ thoát bằng Escape hoặc bấm chuột ra thế giới (focus về `body`).

**Cách biết focus đến từ bàn phím:**
- Ghi thao tác gần nhất: `keydown` (capture, trên `window`) gán `true`, `pointerdown` (capture) gán `false`. Cảm ứng cũng sinh `pointerdown`.
- Ở `focusin` (capture, trên `document`), ghi lại phần tử vừa nhận focus nếu thao tác gần nhất là phím, ngược lại ghi `null`.
- Trường hợp B đúng khi `document.activeElement === keyFocused` và phần tử đó nằm trong một bảng đang mở.
- Hệ quả, đều đúng ý:
  - Escape đóng hộp, rồi `closeConfirm` đưa focus về "🕊️ Thả bớt" trong lúc xử lý phím: focus đó tính là của bàn phím, nên phím vẫn dừng. Người chơi đang dùng bàn phím trong bảng thì tiếp tục ở bảng; Escape thêm lần nữa đóng bảng.
  - "Giữ lại" bấm bằng chuột thì focus về "Thả bớt" tính là của chuột, nên phím chạy lại.
  - Thẻ thú vẽ lại làm nút có focus biến mất: `activeElement` thành `body` nên hết tạm dừng.
- **Không dùng `:focus-visible`.** Chromium bật `:focus-visible` cho phần tử đang có focus khi người chơi bấm một phím bất kỳ. Khi đó bấm chuột vào nút rồi bấm W cũng sẽ làm dừng phím.

**Còn lại, chấp nhận:** đang ở thế giới (focus ở `body`) mà bấm Shift+Tab thì vẫn lướt một lần.
- Lý do: Shift xuống trước Tab, lúc đó chưa biết Tab sẽ theo sau.
- Tab từ thế giới chỉ đưa focus lên các nút HUD ngoài bảng (🔊, 🫐 Ăn, nút cột phải...). Những nút này không thuộc cổng nên không tạm dừng, giữ như hiện nay.

**Thiết bị:**
- Cảm ứng: không đổi gì. Hộp xác nhận đã chặn mọi chạm, cần điều khiển không đi qua `Keyboard`.
- Điện thoại có bàn phím rời: chạy như desktop.
- Không có chữ hiển thị mới.

## Kế hoạch triển khai

1. **`packages/client/src/ui/keyboard.ts`**
   - Thêm và export kiểu và hàm thuần, kèm JSDoc tiếng Anh:
     ```ts
     /** What decides whether the world's keys are held back for the HUD. */
     export interface KeyGate {
       /** A modal dialog is open (the release confirmation). */
       dialogOpen(): boolean;
       /** Panels that take the keys when the keyboard brought the focus into them (hidden ones are skipped). */
       panels: readonly HTMLElement[];
     }
     export interface KeyFocusState { dialogOpen: boolean; focusInOpenPanel: boolean; focusByKeyboard: boolean }
     /** The world's keys pause in a dialog, or in a panel the player reached with the keyboard (a click leaves them on). */
     export function worldKeysPaused(s: KeyFocusState): boolean
     ```
     Kết quả: `dialogOpen || (focusInOpenPanel && focusByKeyboard)`.
   - `constructor(actions, private gate: KeyGate)`. Thêm trường riêng `lastInputKey = false` và `keyFocused: Element | null = null`. Thêm ba listener, capture:
     - `window` `keydown`: `lastInputKey = true`;
     - `window` `pointerdown`: `lastInputKey = false`;
     - `document` `focusin`: `keyFocused = lastInputKey ? (e.target as Element) : null`.
     
     Đăng ký **trước** listener `keydown` hiện có.
   - Thêm phương thức công khai `paused(): boolean`. Nó lấy `a = document.activeElement`, rồi gọi `worldKeysPaused` với:
     - `dialogOpen: gate.dialogOpen()`;
     - `focusInOpenPanel: !!a && gate.panels.some((p) => !p.hidden && p.contains(a))`;
     - `focusByKeyboard: !!a && a === this.keyFocused`.
     
     Không tạo object mới mỗi khung hình: có thể truyền object tạm dùng lại, hoặc viết điều kiện trực tiếp mà vẫn gọi hàm thuần. Coder chọn, miễn hàm thuần là nguồn luật duy nhất.
   - Listener `keydown`: nếu `this.paused()` thì `this.held.clear(); return;` trước `ownKey`, hành động và `held.add`.
   - Listener `keyup`: luôn `held.delete`; chỉ gọi `ownKey(e)` khi `!this.paused()`.
   - `direction()`: nếu `this.paused()` thì `held.clear()` và trả `{ x: 0, y: 0 }`. Không tạo object mới mỗi khung hình: dùng một hằng `STILL` dạng `Readonly<Vec2>` trong file.
   - Sửa JSDoc của class: nói thêm về cổng tạm dừng.
2. **`packages/client/src/ui/keyboard.test.ts`** (mới, môi trường node, chỉ import hàm thuần): bảng 8 tổ hợp của `worldKeysPaused`. Kiểm ít nhất các trường hợp sau:
   - hộp mở thì dừng, bất kể hai cờ kia;
   - focus trong bảng đến từ phím thì dừng;
   - focus trong bảng đến từ chuột thì không dừng;
   - focus đến từ phím nhưng ngoài bảng (nút HUD) thì không dừng;
   - không gì cả thì không dừng.
3. **`packages/client/src/ui/party.ts`**:
   - `get dialogOpen(): boolean { return this.confirmId !== ""; }`
   - `get element(): HTMLElement { return this.panel; }` (JSDoc: phần tử bảng, để `Keyboard` biết focus có ở trong không).
4. **`packages/client/src/ui/crafting.ts`**, **`wardrobe.ts`**: cùng getter `element`.
5. **`packages/client/src/game/Game.ts`**: `new Keyboard({...}, { dialogOpen: () => this.party.dialogOpen, panels: [this.party.element, this.craft.element, this.wardrobe.element] })`. Viết cạnh dòng `const panels = [...]` có sẵn (có thể dùng lại mảng `panels` để lấy `.element`).
6. **`tests/e2e/multiplayer.spec.ts`**: test mới (mục Test).
7. **`docs/architecture.md`**: trong dòng `ui/`, thay `keyboard.ts` bằng `keyboard.ts` (phím thế giới; tạm dừng khi hộp xác nhận mở hoặc khi bàn phím đưa focus vào bảng: `KeyGate`, `worldKeysPaused`; luật ở `docs/design/hud.md`).

## Giao thức

Không đổi `schema.ts`, `messages.ts` hay `Profile`. Chỉ đổi client.

## Test

**Unit:** `packages/client/src/ui/keyboard.test.ts` (bước 2).

**E2E mới** trong `tests/e2e/multiplayer.spec.ts`: `test("keys: a dialog or a panel the keyboard is in keeps the world's keys, a click does not", ...)`, `test.slow()`, desktop (mặc định 1280×720). Dùng helper có sẵn: `join`, `waitForWorld`, `sendFrom`, `partyOf`, `recordSends`, và hàm `me()` đọc x, y như các test khác.

1. Vào game, chờ `frames > 0`. `debug:teleport` tới `{ x: 3150, y: 2500 }` (chỗ trống, test lướt đã dùng), chờ x = 3150. Cho `leafkit` lv 3 rồi `pebblet` lv 2 (Pebblet đi theo). Chờ `partyOf` có 2 con.
2. **Hộp xác nhận:** bấm chuột `.party-btn`, `.party-release-toggle`, rồi `.party-card.follow .party-action.release`. Hộp hiện, `.confirm-keep` có focus. Chờ `.confirm-release` bật. Sau đó `const sent = await recordSends(page)` và `const at = await me()`.
   - `keyboard.press("Shift+Tab")`: focus sang `.confirm-release`. `keyboard.press("Shift+Tab")`: focus về `.confirm-keep`.
   - `keyboard.down("d")`, chờ 400 ms, `keyboard.up("d")`. Bấm `"1"`, `"b"`.
   - Kiểm: `sent()` không chứa `dash`, `attack`, `palSkill`, `placeBase`, và không có `input` nào. `me()` lệch khỏi `at` dưới 2 px.
   - `keyboard.press(" ")` khi `.confirm-keep` có focus: hộp đóng (Space bấm "Giữ lại"), `sent()` không chứa `attack`, `partyOf` vẫn 2 con, `.party-release-toggle` có focus.
3. **Bảng Thú, focus do bàn phím:** focus đang ở "Thả bớt" và do phím đưa tới (Space ở bước trên).
   - `keyboard.press("Shift")`, chờ 300 ms (để chắc là không lướt), rồi kiểm `sent()` không chứa `dash`.
   - `keyboard.press(" ")`: chế độ thả tắt (nút có chữ `🕊️ Thả bớt`, `aria-pressed="false"`), `sent()` không chứa `attack`.
   - `keyboard.press("Escape")`: bảng ẩn.
4. **Phím thế giới chạy lại:** ghi `before = await me()`. `keyboard.down("d")`, `keyboard.press("Shift")`, chờ 250 ms, `keyboard.up("d")`, chờ 300 ms. Kiểm x tăng > 75 (như test lướt cũ) và `sent()` chứa `dash`.
5. **Bảng Tủ đồ, focus do chuột không dừng phím:** bấm chuột `.wardrobe-btn`, rồi `.wardrobe-tab[data-tab="hat"]`. Tab đó có focus. `keyboard.press(" ")`: `sent()` chứa `attack` (chờ bằng `expect.poll`), tab "Mũ" vẫn `active` (Space không bấm tab có focus).
6. **Cùng bảng, Tab vào bằng bàn phím:** `keyboard.press("Tab")`: `.wardrobe-tab[data-tab="weapon"]` có focus. Đếm `dash` trong `sent()` (n), ghi `at`.
   - `keyboard.down("d")`, chờ 400 ms, `keyboard.up("d")`.
   - `keyboard.press("Shift")`. `keyboard.press(" ")`: tab "Vũ khí" thành `active`.
   - Kiểm: số `dash` vẫn là n, `me()` lệch dưới 2 px.
   - `keyboard.press("Escape")`: bảng ẩn.
7. **Bảng Chế tạo:** `keyboard.press("c")`, bảng hiện. `page.locator(".craft-btn").focus()`, rồi `keyboard.press("Tab")`: `.craft-panel .party-close` có focus. Ô ✕ là phần tử đầu của bảng, nằm ngay sau nút trong DOM.
   - Ghi `at`, `keyboard.down("d")`, chờ 400 ms, `keyboard.up("d")`: lệch dưới 2 px.
   - `keyboard.press("Enter")`: bảng ẩn (Enter bấm ✕).
   - `keyboard.down("d")`, chờ 400 ms, `keyboard.up("d")`: x tăng > 20 (đi được lại).

Lưu ý cho coder/tester:
- Có thể đổi thứ tự 5-7 nếu lúc chạy thấy phụ thuộc lẫn nhau.
- Mọi kiểm "không gửi" phải làm sau một bước có chờ thật: `expect(...)` của một thay đổi DOM xảy ra sau phím đó, hoặc lúc nhả phím đã giữ. Như vậy kết quả không đúng chỉ vì kiểm quá sớm.
- Lướt có hồi `DASH_COOLDOWN_MS` = 900 ms (`packages/shared/src/movement.ts`). Nếu Shift ở bước 6 rơi vào lúc lướt của bước 4 còn đang hồi, phép kiểm "không lướt" ở bước 6 sẽ qua mà không chứng minh được gì. Bước 5 có `expect.poll` và vài cú bấm chuột, nên thường đã quá 900 ms. Để chắc chắn, ghi `Date.now()` sau bước 4 và trước Shift ở bước 6 chờ cho đủ 1000 ms kể từ đó. Đây là chờ hồi chiêu, không phải chờ trạng thái, nên `waitForTimeout(phần còn lại)` được phép.

**Test cũ phải qua nguyên vẹn:** đặc biệt `party:` (dòng ~1040-1208, Q/C/Escape/Tab/Enter trong hộp), "the dialog hands the focus back" (~1285), test lướt và Space chặt cây (~686), `skills:` (bấm chuột `.skill-auto` rồi phím 1; focus do chuột nên không dừng).

## Tiêu chí hoàn thành

- [ ] Khi hộp xác nhận thả thú mở: W/A/S/D, mũi tên, Space, Shift, E, B, R, H, M, N, 1-3 không gửi gì và không làm nhân vật di chuyển. Shift+Tab chỉ đổi focus. Space và Enter bấm nút đang có focus.
- [ ] Khi bàn phím (Tab, hoặc focus trả về sau Escape/Space/Enter) đưa focus vào bảng Thú, Chế tạo hay Tủ đồ đang mở: như trên.
- [ ] Bấm chuột hoặc chạm vào nút trong bảng không dừng phím thế giới. Space sau cú bấm chuột vẫn là đánh (giữ hành vi cũ).
- [ ] Escape, Q, C, T chạy như trước. Đóng bảng hoặc hộp (bất kỳ cách nào) mà focus rời bảng thì phím thế giới chạy lại ngay.
- [ ] Nhân vật đang đi thì dừng ngay khi tạm dừng bắt đầu (client gửi `Input` đứng yên).
- [ ] Luật nằm trong hàm thuần `worldKeysPaused` có unit test; `Keyboard` không tạo object mới mỗi khung hình.
- [ ] Không đổi `connection.ts`, server, shared, CSS, chữ hiển thị.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` đều sạch. Test e2e mới qua; test cũ không sửa mà vẫn qua.
- [ ] `docs/architecture.md` cập nhật dòng `keyboard.ts`; `docs/design/hud.md` có mục mới (đã có).

## Rủi ro, câu hỏi mở

- Không có "CHẶN:". Mọi quyết định nhỏ đã tự quyết, lý do ở trên:
  - phạm vi chỉ gồm hộp và ba bảng, không gồm nút HUD ngoài bảng;
  - phân biệt focus của bàn phím với focus của chuột;
  - Q, C, T vẫn chạy;
  - không đưa màn mất kết nối vào cổng.
- **Rủi ro, thứ tự sự kiện:** listener capture `keydown` phải chạy trước khi trình duyệt chuyển focus (mặc định của Tab chạy sau khi phát sự kiện xong, nên đúng). Lời gọi `.focus()` bên trong handler phím của bảng (`closeConfirm`) phải thấy `lastInputKey = true`: listener capture trên `window` chạy trước các listener bubble của bảng, nên đúng. Nếu e2e bước 2-3 hỏng ở đây, kiểm thứ tự đăng ký trước tiên.
- **Rủi ro, `focusin` trong Playwright:** `locator.focus()` gọi `element.focus()`, nên nó tính theo thao tác gần nhất. Bước 7 dùng nó trên `.craft-btn`, nút **ngoài** bảng, nên không quan trọng là phím hay chuột; Tab thật mới đưa focus vào bảng.
- **Việc có thể làm sau (đề xuất cho TASKS.md, ưu tiên thấp):** "Tab từ thế giới không vào thẳng bảng đang mở". Hiện phải Tab qua mọi nút HUD trước khi tới bảng, vì bảng nằm sau nút của nó trong DOM. Có thể cho bảng đang mở bắt Tab đầu tiên từ `body`. Cần thiết kế riêng vì nó đổi cách Tab chạy cho mọi người chơi bàn phím.
