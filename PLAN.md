# PLAN: T40 Nút chạy theo `pointerdown` nhận cả chuột phải, chuột giữa

Code đọc ở `8ea582a` ("Mark T35 done, add T96, start T40"). Nguồn:
- dòng T40 trong `TASKS.md`; `docs/design/hud.md` (mục "Cần điều khiển và nút cảm ứng", "Nút 🫐 Ăn", "Bàn phím khi hộp thoại hoặc bảng giữ focus");
- `packages/client/src/ui/hud.ts` (`onPress`, `button()`, nút Ăn, nút Bóng, các nút cảm ứng Đánh, Bắt, 💨);
- `ui/skillbar.ts` (3 ô chiêu và nút Tự động/Theo lệnh, mỗi cái tự gắn `pointerdown` riêng);
- `ui/keyboard.ts` (`ownKey`: phím hành động trên một `<button>` bị `preventDefault`);
- `game/hudBridge.ts` (bảng phím: Space, Shift, E, B, R, H, M, N, 1-3; các `actions` gọi `this.game.controls.*` lúc bấm);
- `tests/e2e/multiplayer.spec.ts` (chỉ đọc: `.eat-btn` và `.skill-auto` được bấm bằng `click()` của Playwright).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Không có việc hình ảnh.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. E2E mới nằm trong `tests/e2e/buttons.spec.ts`. Không chạy `git stash`.

## Hiện trạng (đã kiểm)

| Nút | Gắn bằng | Chuột phải / giữa | Enter khi có focus | Phím tắt |
|---|---|---|---|---|
| 🫐 Ăn | `onPress` (`hud.ts`) | **có tác dụng** (ăn) | không làm gì | H |
| ⚪/🔵 Bóng | `onPress` | **có** (đổi bóng) | không | R |
| Đánh, Bắt, 💨 (chỉ khi `isTouch`) | `onPress` qua `button()` | **có** | không | Space, E, Shift |
| 3 ô chiêu | `pointerdown` riêng trong `skillbar.ts` | **có** (ra lệnh chiêu) | không | 1, 2, 3 |
| Tự động/Theo lệnh | `pointerdown` riêng trong `skillbar.ts` | **có** | không | **không có** |

Ngoài 5 loại nút trong dòng TASKS, `skillbar.ts` có cùng lỗi ở 4 nút: chuột phải vào ô chiêu là ra lệnh chiêu. Tự động/Theo lệnh hiện **không có cách nào bằng bàn phím**: không phím tắt, và Enter không làm gì vì nút chỉ nghe `pointerdown`. Như vậy là trái luật "mọi thao tác dùng được bằng cả cảm ứng lẫn bàn phím" của CLAUDE.md.

Nút cảm ứng Đánh, Bắt, 💨 chỉ có khi `isTouch` (`matchMedia("(pointer: coarse)")` hoặc có `ontouchstart`). Laptop màn cảm ứng có các nút này **và** có chuột, nên chuột phải vào chúng có tác dụng thật.

## Quyết định: có cho Enter trên các nút này lại không?

**Có.** Mỗi nút nghe thêm `click`, nhưng **chỉ nhận `click` không do con trỏ sinh ra** (`event.detail === 0`): phím Enter trên nút đang có focus, công cụ hỗ trợ, hay `element.click()`.

**Lý do:**
1. **Luật bàn phím của CLAUDE.md.** Tự động/Theo lệnh hôm nay không dùng được bằng bàn phím. Thêm một phím tắt mới cũng chữa được, nhưng Enter trên nút đang có focus là cách bàn phím mà người dùng chờ đợi ở mọi `<button>`, và nó chữa luôn cả 9 nút một lần.
2. **Công cụ hỗ trợ.** Trình đọc màn hình trên desktop và điều khiển bằng công tắc kích hoạt nút bằng một `click` không kèm `pointerdown` (`detail` = 0). Hôm nay với các nút đó, chúng không làm gì; trình đọc màn hình đọc "nút Ăn" mà bấm không ăn.
3. **Không bấm hai lần.** Chuột, ngón tay, bút: trình duyệt sinh `pointerdown` (nút đã chạy) rồi `click` với `detail` ≥ 1. `click` đó bị bỏ qua. Ngón thứ hai trong lúc giữ cần điều khiển không sinh `click` (lý do của T39), nên không có gì thay đổi ở đó.
4. **Space không đổi.** Space là phím Đánh. `keyboard.ts` (`ownKey`) đã chặn mặc định của mọi phím hành động khi focus ở một `<button>`. Vì vậy Space trên nút Ăn đang có focus vẫn là Đánh, và không sinh `click`. Enter không phải phím hành động, nên nó sinh `click` (`detail` 0) như mọi nút.
5. **Phím tắt vẫn là cách chính** (H, R, E, Space, Shift, 1-3). Enter trên nút chỉ là cách thêm cho người dùng Tab.

**Chuột phải, chuột giữa:** bỏ qua, chỉ nhận nút chính (`button === 0`). Thêm hai điểm:
- **macOS Ctrl+click là chuột phải** (mở menu ngữ cảnh) nhưng báo `button === 0`. Với chuột (`pointerType === "mouse"`), Ctrl+click cũng bị bỏ qua. Trên Windows và Linux, Ctrl+click nút game không có ý nghĩa gì, nên bỏ qua cũng không mất gì.
- **Cảm ứng và bút** luôn báo `button === 0` (bút: đầu bút). Nút bên thân bút (2) và đầu tẩy (5) bị bỏ qua như chuột phải. **Không lọc theo `isPrimary`**: ngón thứ hai trong lúc giữ cần điều khiển có `isPrimary === false` mà vẫn phải bấm được (T39).

**Menu ngữ cảnh:**
- Chuột phải vào nút giờ không làm gì trong game, và menu của trình duyệt hiện như mọi trang. Không chặn `contextmenu`: chặn thì cũng không được gì, mà người dùng mất "Kiểm tra" hay "Lưu ảnh" quen thuộc.
- Lần bị bỏ qua cũng không gọi `preventDefault` (để menu và cuộn bằng chuột giữa hoạt động như thường).
- **Nhấn giữ trên cảm ứng:** `pointerdown` (nút 0) chạy hành động một lần như hôm nay. Không đổi CSS chống bôi đen chữ hay chú thích (callout) của iOS: ngoài phạm vi, chưa ai thấy lỗi đó. Nếu kiểm tay thấy, ghi thành việc riêng.

## Mục tiêu

- Chuột phải, chuột giữa (và Ctrl+click trên Mac) vào 9 nút trên không làm gì.
- Chuột trái, chạm, bút, ngón thứ hai: như hôm nay.
- Enter trên nút đang có focus và công cụ hỗ trợ bấm được cả 9 nút, kể cả Tự động/Theo lệnh. Không nút nào chạy hai lần cho một lần bấm.

## Phạm vi

**Làm:**
- module mới `packages/client/src/ui/press.ts` (hàm thuần và `onPress`), cùng unit test;
- `hud.ts`, `skillbar.ts` dùng nó;
- e2e mới `tests/e2e/buttons.spec.ts`;
- tài liệu `hud.md`.

**KHÔNG làm:**
- không đổi các nút nghe `click` (🔊, 🔗, nút mở bảng, nút trong bảng);
- không thêm phím tắt mới, không đổi `keyboard.ts`;
- không chặn `contextmenu`;
- không đổi CSS, không đổi server hay giao thức.

## Thiết kế

### `packages/client/src/ui/press.ts` (mới)

```ts
/** What a pointerdown needs to be a press of a game button. */
export interface PressPointer { button: number; ctrlKey: boolean; pointerType: string }

/**
 * Whether a pointerdown presses a game button: the main button only (a finger, a pen's tip, the left mouse button),
 * never a right or middle click, a pen's barrel or eraser button, or a Mac's Ctrl+click (its right click). Any finger
 * counts, not only the first: a second finger presses while the first holds the joystick.
 */
export function isPress(e: PressPointer): boolean {
  return e.button === 0 && !(e.pointerType === "mouse" && e.ctrlKey);
}

/** Whether a click came from no pointer: Enter on the focused button, an assistive tool, or element.click() (detail 0). */
export function isKeyClick(e: { detail: number }): boolean {
  return e.detail === 0;
}

/**
 * Runs `action` as soon as a finger, pen or the left mouse button goes down on `target` (buttons used on the move: a
 * phone makes no click for a second finger's tap while the first holds the joystick), and on a click that came from no
 * pointer (Enter on the focused button, an assistive tool), so it works by keyboard too. A pointer's own click after its
 * pointerdown is ignored: one press, one action. Not for what needs a user gesture (share sheet, clipboard): a touch
 * only gives one as the finger lifts.
 */
export function onPress(target: EventTarget, action: () => void): void
```

**Thân `onPress`:**
- `pointerdown`: `if (!isPress(e)) return; e.preventDefault(); action();`
- `click`: `if (isKeyClick(e)) action();`

Tham số là `EventTarget` (không phải `HTMLElement`) để unit test chạy được trong Node.

**Chỗ dùng:**
- `hud.ts`: bỏ hàm `onPress` cục bộ, import từ `press.ts`. `button()`, nút Ăn và nút Bóng không đổi gì khác.
- `skillbar.ts`: 3 ô chiêu và nút Tự động thay `addEventListener("pointerdown", …)` bằng `onPress(b, () => this.press(i))` và `onPress(this.autoButton, () => this.actions.setAuto(!this.autoButton.classList.contains("on")))`.

`SkillBar.press(i)` đã tự lắc nút khi chiêu chưa sẵn sàng, đúng như lúc bấm bằng phím 1-3. Không đổi.

### Các khổ màn hình và thiết bị

| Thiết bị | Hôm nay | Sau T40 |
|---|---|---|
| Điện thoại dọc, ngang (chạm) | chạm: chạy ngay; ngón thứ hai: chạy | như cũ |
| Desktop (chuột) | trái, phải, giữa đều chạy | chỉ chuột trái chạy |
| Laptop cảm ứng (chuột và chạm, có Đánh, Bắt, 💨) | chuột phải vào Đánh là đánh | không làm gì; chạm và chuột trái vẫn chạy |
| Bàn phím, focus trên nút | Enter không làm gì; Space là Đánh | Enter bấm nút; Space vẫn là Đánh (không bấm nút) |
| Trình đọc màn hình, công tắc | không làm gì | bấm được |

Cỡ chạm không đổi (mọi nút đã ≥ 44 × 44, T18). Không thêm nút.

## Kế hoạch triển khai

1. **`packages/client/src/ui/press.ts`** (mới): như Thiết kế, JSDoc tiếng Anh.
2. **`packages/client/src/ui/press.test.ts`** (mới, Node): mục Test.
3. **`packages/client/src/ui/hud.ts`:** xoá `onPress` cục bộ (cả JSDoc của nó, đã chuyển sang `press.ts`), `import { onPress } from "./press.ts"`.
4. **`packages/client/src/ui/skillbar.ts`:** dùng `onPress` cho 4 nút.
5. **`tests/e2e/buttons.spec.ts`** (mới): mục Test. Helper chép kèm chú thích "Copied because T63 holds multiplayer.spec.ts; to be gathered in T16":
   - `enterLobby`, `waitForWorld` (bản trong `pwa.spec.ts`/`rejoin.spec.ts`);
   - `contexts` + `afterEach`;
   - `sendFrom` (gửi tin `debug:*` từ trang);
   - một `recordSends` gọn: bọc `room.send` để ghi tên tin.
6. **`docs/design/hud.md`** (mục Tài liệu).
7. **`docs/architecture.md`:** dòng `ui/` thêm `press.ts` (`onPress`: `pointerdown` nút chính, cộng `click` không do con trỏ; dùng cho các nút chạy theo `pointerdown` ở `hud.ts` và `skillbar.ts`).
8. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Các test cũ bấm `.eat-btn` và `.skill-auto` bằng `click()` của Playwright (chuột trái: `pointerdown` rồi `click` với `detail` 1) vẫn chạy đúng một lần.

## Giao thức

Không đổi gì. Chỉ client, chỉ cách nhận thao tác.

## Test

### Unit: `press.test.ts`

**`isPress`:**
- `{ button: 0, ctrlKey: false, pointerType: "mouse" }` → `true`
- chuột, nút 1 và 2 → `false`
- chuột, nút 0 kèm `ctrlKey` → `false` (Ctrl+click của Mac)
- `touch` nút 0 → `true`; `touch` nút 0 kèm `ctrlKey` → `true` (Ctrl chỉ có nghĩa với chuột)
- `pen` nút 0 → `true`; `pen` nút 2 và 5 → `false`

**`isKeyClick`:** `detail` 0 → `true`; 1 và 2 → `false`.

**`onPress`** trên một `EventTarget` của Node. Sự kiện tạo bằng `Object.assign(new Event(type, { cancelable: true }), { button, ctrlKey, pointerType, detail })`.

| Sự kiện | Mong đợi |
|---|---|
| `pointerdown` nút 0 | hành động chạy 1 lần, `defaultPrevented === true` |
| `pointerdown` nút 2 | không chạy, `defaultPrevented === false` (menu ngữ cảnh vẫn mở được) |
| `pointerdown` nút 0 rồi `click` với `detail` 1 | tổng cộng 1 lần |
| chỉ `click` với `detail` 0 (Enter) | 1 lần |
| `pointerdown` nút 1 rồi `click` với `detail` 1 | 0 lần (chuột giữa không sinh lần chạy nào) |

### E2E: `tests/e2e/buttons.spec.ts` (mới)

**Cách đếm:** `hudBridge` gọi `this.game.controls.<tên>()` lúc bấm, nên test bọc các phương thức của `window.__petgame.game.controls` (`eat`, `toggleBall`, `attack`, `throwBall`, `dash`) và của `game.skillBar` (`press`) bằng bộ đếm, trong một `evaluate`. Nút Tự động đếm qua tin `palAuto` của `recordSends`. Đếm ở client là đủ, vì lỗi nằm ở chỗ client nhận thao tác. Server không được hỏi gì, nên không phụ thuộc máu, quả mọng hay có thú ở gần.

**Chuẩn bị chung:**
- vào thế giới;
- `debug:givePal` một Emberpup cấp 8, để thanh chiêu hiện và có ô chiêu biết chiêu;
- `debug:give` quả mọng và bóng xịn, để nút Ăn và nút Bóng ở trạng thái thường;
- chờ `frames > 0`.

**B1** `desktop mouse: only the left button presses Ăn, Bóng, the skill buttons and Tự động`:
- 1280×720, không cảm ứng.
- Với mỗi nút `.eat-btn`, `.ball-btn`, `.skill-btn` đầu tiên có chiêu, `.skill-auto`:
  - `locator.click({ button: "right" })`, rồi `locator.click({ button: "middle" })`, rồi `click({ modifiers: ["Control"] })` → bộ đếm của nút đó vẫn 0;
  - `locator.click()` (trái) → đúng 1.
- Nút Bóng: chữ đổi đúng một lần (thường ↔ xịn). Nút Tự động: đúng một tin `palAuto`.

**B2** `a touch laptop: the mouse's right and middle buttons do nothing on Đánh, Bắt and 💨; the left button and a tap press once`:
- context `{ viewport: { width: 1280, height: 720 }, hasTouch: true }`, để có `.btn-attack`, `.btn-capture`, `.btn-dash`.
- Mỗi nút: chuột phải, chuột giữa → 0; chuột trái → 1; `tap()` → thêm đúng 1.
- 💨 có hồi chiêu ở client: chờ hết hồi (`.btn-dash` mất lớp `cooling`, hoặc đếm số lần gọi `dash` chứ không đếm lần lướt thật).

**B3** `the keyboard: Enter on a focused button presses it once; Space on it is still Đánh`:
- Desktop. `locator(".eat-btn").focus()`, `keyboard.press("Enter")` → `eat` 1 lần.
- Cũng vậy với `.ball-btn` (chữ đổi), một ô chiêu (`press` 1 lần) và `.skill-auto` (một tin `palAuto`): bấm được bằng bàn phím, điều hôm nay không làm được.
- Focus `.eat-btn` rồi `keyboard.press(" ")` → `eat` 0 lần; Đánh: đúng một tin `attack` trong `recordSends` (phím Space của game, không bấm nút).
- Context cảm ứng của B2: focus `.btn-attack`, Enter → `attack` 1 lần; Space → `attack` thêm đúng 1 (không 2).

**Trên HEAD:** B1, B2 hỏng (chuột phải đếm 1); B3 hỏng ở Enter (đếm 0). Ghi vào `PROGRESS.md`.

**Menu ngữ cảnh:** Chromium headless không hiện menu, nên không kiểm. Unit test kiểm rằng `pointerdown` chuột phải không bị `preventDefault`.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | `isPress` trả `true` mọi nút chuột | unit `isPress`; B1, B2 |
| M2 | bỏ điều kiện Ctrl+click | unit; B1 (Ctrl+click) |
| M3 | lọc thêm `isPrimary` | không có unit nào (sự kiện thử không có `isPrimary`). Tester ghi lại; test e2e có sẵn trong `multiplayer.spec.ts` "touch (…): … Ăn eats under a second finger" phải hỏng. Nếu không hỏng, ghi rõ |
| M4 | `click` nhận mọi `detail` | unit "pointerdown rồi click detail 1" (2 lần); B1 (chuột trái đếm 2) |
| M5 | bỏ bộ nghe `click` | unit "chỉ click detail 0"; B3 |
| M6 | `preventDefault` trước khi kiểm `isPress` | unit "nút 2: `defaultPrevented === false`" |
| M7 | `skillbar.ts` giữ `pointerdown` riêng cho ô chiêu | B1 (ô chiêu, chuột phải) và B3 (ô chiêu, Enter) |
| M8 | `skillbar.ts` giữ `pointerdown` riêng cho nút Tự động | B1, B3 (Tự động) |

## Tài liệu

`docs/design/hud.md`, mục **Cần điều khiển và nút cảm ứng**:
- gạch "Nút dùng trong lúc ngón kia đang giữ…": thêm "Chỉ nút chính tính (ngón tay, đầu bút, chuột trái). Chuột phải, chuột giữa, nút trên thân bút và Ctrl+click trên Mac không làm gì, và menu chuột phải của trình duyệt hiện như thường (T40). Ngón thứ hai vẫn bấm được.";
- thay câu "Chuột vẫn bấm được (chuột cũng sinh `pointerdown`). Bàn phím dùng phím tắt (H cho Ăn), không dùng Enter trên nút." bằng: "Chuột trái vẫn bấm được (chuột cũng sinh `pointerdown`). Bàn phím: phím tắt (H, R, E, Space, Shift, 1-3), hoặc Tab tới nút rồi Enter (T40). Enter, trình đọc màn hình và công tắc bấm nút bằng một `click` không do con trỏ sinh ra; `click` của chuột, ngón tay hay bút sau `pointerdown` bị bỏ qua, nên mỗi lần bấm chỉ chạy một lần. Space trên nút vẫn là Đánh (phím của game), không bấm nút. Tự động/Theo lệnh không có phím tắt: dùng Tab và Enter.";

Mục **Nút 🫐 Ăn**, gạch cuối: "Chuột: bấm. Bàn phím: H." → "Chuột trái: bấm (chuột phải, giữa không làm gì). Bàn phím: H, hoặc Enter khi nút có focus."

## Tiêu chí hoàn thành

- [ ] `ui/press.ts` có `isPress`, `isKeyClick`, `onPress`, JSDoc; `hud.ts` không còn `onPress` riêng; `skillbar.ts` dùng `onPress` cho 4 nút.
- [ ] Chuột phải, chuột giữa và Ctrl+click không làm gì trên Ăn, Bóng, Đánh, Bắt, 💨, 3 ô chiêu, Tự động. Chuột trái, chạm, bút chạy đúng một lần; ngón thứ hai vẫn chạy.
- [ ] Enter trên nút đang có focus bấm được cả 9 nút, đúng một lần; Space trên nút vẫn chỉ là Đánh.
- [ ] Unit test `press.test.ts` qua; B1, B2, B3 qua và hỏng trên HEAD `8ea582a` (ghi trong `PROGRESS.md`).
- [ ] Bảng đột biến M1-M8 cho đúng kết quả (M3 ghi rõ).
- [ ] Không đổi server, giao thức, CSS. `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` qua (cả các test cũ bấm `.eat-btn`, `.skill-auto`, và test ngón thứ hai). Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi giao thức hay dữ liệu, không xoá tính năng; Enter là thêm cách bấm.

1. **`element.click()` trong code hay test** giờ chạy hành động (`detail` 0). Đã tìm trong `packages/client/src`, `tests/e2e` và `scripts`: không chỗ nào gọi `.click()` hay `dispatchEvent("click")` lên 9 nút này. Playwright `locator.click()` là chuột thật (`detail` 1).
2. **Trình đọc màn hình trên di động:** có công cụ (VoiceOver trên iOS) giả một lần chạm thật khi chạm hai lần. Khi đó `pointerdown` chạy hành động, và `click` (`detail` 1) bị bỏ qua: vẫn một lần. Công cụ chỉ sinh `click` (`detail` 0) thì giờ cũng chạy được. Không kiểm được trong CI; ghi để kiểm tay nếu có thiết bị.
3. **Enter giữ lâu:** `keydown` lặp lại sinh nhiều `click`, giống mọi nút HTML. Với Ăn thì lần sau rơi vào hồi chiêu (nút lắc, không gửi gì); Bóng thì đổi qua lại. Chấp nhận, như phím tắt giữ lâu (các phím tắt bỏ qua `repeat`, Enter trên nút thì không). Nếu reviewer muốn chặt hơn, có thể bỏ `click` khi `keydown` gần nhất là `repeat`, nhưng việc đó cần thêm trạng thái; không đề xuất.

## Đề xuất cho `TASKS.md`

Không có việc mới. Ghi chú cho T16: `tests/e2e/buttons.spec.ts` có bản chép `enterLobby`, `waitForWorld`, `sendFrom`, `recordSends`.
