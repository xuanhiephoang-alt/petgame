# PLAN: T31 Hoàn thiện thông báo sau T6

Code đọc ở `2030898` ("Mark T29 done, extend T29b, start T31"). Nguồn:
- dòng T31 trong `TASKS.md`; `docs/design/hud.md` (mục "Thông báo (toast)" và "Thông báo và tên mình khi cầm dọc");
- client: `packages/client/src/ui/toastQueue.ts` (`TOAST`, `toastRoom`, `ToastQueue.push`, `update`, `show`), `ui/hud.ts` (`showToast`, `measureSlots`, `toastFit`, `tickToasts`, `renderToasts`, `TOAST_FADE_MS`, `SIDEWAYS_QUERY`), CSS `.hud-toasts`, `.toast`, `.toast.out` trong `packages/client/index.html`;
- shared và server: `packages/shared/src/rewards.ts` (`rewardText`), `notices.ts` (`bossDefeated`), `wardrobe.ts` (`rollWearable`, `WEARABLES`), `packages/server/src/systems/leaders.ts` (`defeatBoss`);
- test: `GameRoom.test.ts` (describe `boss`), `wardrobe.test.ts` (`rewardText` có `\xa0`), `toastQueue.test.ts`; trong `tests/e2e/multiplayer.spec.ts` (chỉ đọc) các helper `shownToasts`, `toastLayout`, các test `toasts (...)` và test thanh trùm.

**Phần T63 đang cất.** Đã xem danh sách file bằng lệnh chỉ đọc `git diff --stat 'stash@{0}^1' 'stash@{0}'` (cũng vậy với `stash@{1}`); không pop, không apply. Stash chỉ đổi `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts` (cùng `PROGRESS.md`, `REVIEW.md`). Nó **không đụng mã thông báo** (`toastQueue.ts`, `hud.ts`, CSS `.toast`). Phần e2e của nó có helper thông báo mới (`pushBossToasts`, `onlyTestToasts`) nhưng chỉ đọc `.toast:not(.out)` và đếm `.toast.out` đang mờ, không đổi cỡ màn hình khi thông báo đang hiện. Kế hoạch này không đổi tên lớp hay số đếm mà các helper đó dựa vào (Thiết kế 1, 2).

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.**

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. E2E mới nằm trong spec mới `tests/e2e/toasts.spec.ts`. Không chạy lệnh nào đổi stash.

## Kiểm lại từng mục với code sau T61, T62

| # | Mục | Còn đúng? | Làm |
|---|---|---|---|
| 1 | Thông báo mới hiện lệch xuống một ô khoảng 200 ms rồi nhảy lên, khi thay một cái cũ | **Còn.** `renderToasts` thêm `.out` cho phần tử cũ và chỉ xoá nó sau `TOAST_FADE_MS` (200 ms). `.toast.out` chỉ có `opacity: 0`, nên trong lúc mờ nó vẫn chiếm chỗ trong cột. Cái mới được `append` sau nó, nên nằm thấp hơn một ô, rồi nhảy lên khi cái cũ bị xoá. Cùng hiện tượng khi thông báo trên cùng hết giờ: cái dưới đứng yên 200 ms rồi nhảy. | Có (Thiết kế 1) |
| 2 | Xoay dọc sang ngang khi đang hiện 2 thông báo: cả hai ở lại tới hết giờ | **Còn.** `ToastQueue.update` chỉ thêm khi có chỗ, không bao giờ bớt khi `maxVisible()` giảm. Số chỗ chỉ được đo khi có thông báo mới (`showToast`) hoặc khi có cái đang chờ (`tickToasts`). Xoay máy lúc không có gì chờ thì không ai đo lại. | Có (Thiết kế 2) |
| 3 | Tính lại `toastRoom` theo `resize` *thay vì* mỗi lần hiện | **Một nửa đã lỗi thời.** Từ T62, số chỗ trên màn dọc ≥ 790 px phụ thuộc bố cục, không chỉ cỡ màn: ô nhiệm vụ 1-3 dòng, thanh máu trùm thế chỗ ô nhiệm vụ, tóc, mũ, độ phóng camera. Những thứ đó đổi mà không có `resize`, nên **bỏ phần "thay vì"**: vẫn đo khi có thông báo mới (rẻ: chỉ đọc bố cục trên màn dọc cao, 2 lần `getBoundingClientRect`). Phần còn đúng: **thêm** lần đo khi `resize`, vì đó là thứ mục 2 cần. | Một phần (Thiết kế 2) |
| 4 | Test server cho chữ phần thưởng trùm (`rewardText`, khoảng trắng không ngắt giữa biểu tượng và số) | **Còn.** `rewardText` có unit test trong shared (`wardrobe.test.ts`: `"🪵\xa02  👘\xa0Áo dài"`). Nhưng chưa test nào kiểm chữ server thật sự gửi khi hạ trùm. Test `the pal of everyone who helped learns BOSS.xp…` chỉ kiểm `startsWith("Hạ được trùm")` và phần XP. | Có (Thiết kế 3) |

Không mục nào cần sửa test e2e có sẵn trong `multiplayer.spec.ts`, nên không có T31b.

## Mục tiêu

- Thông báo mới xuất hiện **ngay đúng chỗ của nó**. Cái cũ mờ đi tại chỗ, không đẩy cái mới xuống.
- Xoay máy hoặc đổi cỡ cửa sổ làm số chỗ giảm (dọc 2 → ngang 1): thông báo thừa rời màn hình ngay và **quay về hàng chờ**, không mất. Ngón cái trái được góc trống của nó (luật T18).
- Chữ phần thưởng trùm server gửi được test đúng từng ký tự, kể cả dấu cách không ngắt.

## Phạm vi

**Làm:**
- CSS `.toast.out` và `renderToasts` (Thiết kế 1);
- `ToastQueue.shrink`, lắng nghe `resize` trong `Hud` (Thiết kế 2);
- test server cho `bossDefeated` (Thiết kế 3);
- unit test, e2e mới `tests/e2e/toasts.spec.ts`, tài liệu.

**KHÔNG làm:**
- Không đổi luật mức, thời gian, thay thế, chờ trong `hud.md`.
- Không đổi `toastRoom` và các số `TOAST`.
- Không bỏ lần đo khi hiện, và không bỏ lần đo mỗi 250 ms lúc có cái chờ (T62 cần cả hai).
- **Không bớt thông báo đang hiện khi bố cục đổi mà màn hình không đổi cỡ** (ô nhiệm vụ dài ra, thanh trùm hiện hay ẩn). Luật T62 "Thông báo đang hiện không bị cắt" giữ nguyên. Chỉ `resize` mới bớt (Thiết kế 2).
- Không đổi chữ người chơi thấy, server logic, schema, message.

## Thiết kế

### 1. Thông báo đang mờ không còn giữ chỗ

**CSS** (`index.html`, ngay sau `.toast.out { opacity: 0; }`):
```css
/* A fading toast keeps its place and size but no longer takes room: the new one is at once where it stays (T31). */
.toast.out { position: absolute; left: 0; max-width: none; pointer-events: none; }
```
`.hud-toasts` đã có `position: relative`, nên toạ độ tính theo hộp thông báo.

**`Hud.renderToasts`:**
- Với mỗi phần tử sắp mờ: **đọc hết trước** `el.offsetTop` và `el.getBoundingClientRect().width` của chúng, **rồi mới ghi** cho từng cái: `el.style.top = `${top}px``, `el.style.width = `${width}px``, `classList.add("out")`.
- Đọc trước, ghi sau để chỉ ép bố cục một lần.

**Vì sao phải ghi `top` và `width`:**
- Con của flex container mà `position: absolute` có chỗ "tĩnh" ở đầu hộp, không phải ở ô cũ của nó.
- Hộp thông báo co theo con rộng nhất. Cái mờ đi mà là cái rộng nhất thì hộp hẹp lại, và chữ của nó sẽ xuống dòng lại.

`offsetTop` không tính `transform` của hoạt ảnh trượt vào, nên là đúng ô. `box-sizing: border-box` đã có trên `.toast`, nên `width` đo được là đúng cỡ. Chỉ đọc bố cục lúc có thông báo rời đi (hiếm), không mỗi khung.

**Kết quả:**
- **Thay cái cũ** (2 chỗ `[A, B]`, C thay A): A mờ đi tại ô 1, B lên ô 1 ngay, C ở ô 2 ngay. Trong 200 ms, A đang mờ nằm chồng lên B.
- **1 chỗ** (cầm ngang): C hiện ngay ở ô 1, A mờ đi chồng lên nó (chuyển cảnh mờ dần).
- **Hết giờ:** cái dưới lên ngay, cái hết giờ mờ đi chồng lên.

Chồng 200 ms như vậy chấp nhận được: cái cũ đang về 0 độ mờ, và cái mới có hoạt ảnh trượt vào 150 ms. Đọc được ngay chữ mới quan trọng hơn. `prefers-reduced-motion`: không có chuyển cảnh, nên `.out` biến mất ngay; không chồng.

**Giữ nguyên cho test và T63:**
- `.toast.out` vẫn là lớp của cái đang mờ; `:not(.out)` vẫn là cái đang hiện;
- `toastFit()` đọc `this.toasts.getBoundingClientRect().top`. Đỉnh hộp không đổi khi con nằm ngoài dòng chảy;
- `.hud-toasts:empty` vẫn chỉ đúng khi không còn con nào.

### 2. Đổi cỡ màn hình: đo lại, bớt cái thừa về hàng chờ

**`ToastQueue.shrink(now): boolean`** (thuần, mới):
- Trong khi `visible.length > maxVisible()`: lấy cái **yếu nhất** đang hiện, theo đúng luật thay thế (mức thấp nhất, cùng mức thì cũ nhất), bỏ khỏi `visible` và đưa vào `waiting` với `at = now`.
- Hàng chờ dùng cùng luật tràn như `push`: quá `maxWaiting` thì bỏ cái yếu nhất. Tách phần tràn của `push` ra một phương thức riêng `enqueue(text, level, at)` để dùng chung.
- Trả `true` khi `visible` đổi. Không cấp phát gì khi không có gì để bớt.

**Không đổi `update`:** `update` vẫn chỉ thêm, không bao giờ bớt. Vì vậy các lần đo khi có thông báo mới hoặc mỗi 250 ms (bố cục đổi) không bao giờ cắt thông báo đang hiện, đúng luật T62.

**`Hud`:**
- Trong constructor: `window.addEventListener("resize", () => this.resized())`. Một listener cho cả vòng đời trang, như HUD.
- `resized()`: `const now = performance.now(); this.measureSlots(now); const changed = this.toastQueue.shrink(now); if (this.toastQueue.update(now) || changed) this.renderToasts();`.
- `update` lấp chỗ khi số chỗ tăng (xoay ngang sang dọc). `resize` bắn nhiều lần khi xoay; mỗi lần rẻ.

**Cái nào ở lại, cái nào về chờ:** theo luật thay thế đã có trong `hud.md` (yếu nhất đi trước). Cái về hàng chờ:
- mức cao chờ đến lượt, như mọi cái mức cao, rồi hiện **đủ thời gian của nó**;
- mức thường chờ tối đa 4 giây, mức thấp 1 giây, tính từ lúc về hàng chờ; quá thì bỏ, đúng như luật chờ.

**Ngoại lệ ghi vào `hud.md`:** "mức cao không bao giờ bị cắt ngắn" có một ngoại lệ là khi màn hình đổi cỡ làm mất chỗ. Khi đó nó tạm rời màn hình rồi hiện lại đủ thời gian.

**Các khổ màn hình:**

| Đổi | Trước | Sau |
|---|---|---|
| điện thoại dọc (2 chỗ) → ngang 844×390 hoặc 915×412 (1 chỗ) | 2 cái ở lại tới hết giờ, cái dưới lấn vào góc ngón cái | cái yếu hơn về chờ ngay; cái còn lại kết thúc trên mốc cao − 140 px (T18) |
| ngang → dọc (1 → 2) | cái chờ chỉ hiện ở lần đo 250 ms kế tiếp (thường đã có) | như trước, cộng thêm ngay khi `resize` |
| desktop đổi cỡ cửa sổ, vẫn cao > 520 | không đổi (2 chỗ) | không đổi |
| desktop thu thấp ≤ 520 px | như xoay ngang | như xoay ngang |
| dọc 844 → 760 (Safari hiện thanh địa chỉ) | 2 cái ở lại | 1 cái, cái kia về chờ (đúng luật "màn dọc < 790 px chỉ 1") |

Không có chỗ chạm mới: thông báo không nhận chạm (`pointer-events: none` trên `.hud-toasts`). Bàn phím không liên quan.

### 3. Test server cho chữ phần thưởng trùm

Trong `describe("boss")` của `GameRoom.test.ts`, test mới `the boss reward notice says the reward item by item, each icon held to its number by a no-break space`:
- Người chơi không có thú đi theo (không có phần XP), đứng cạnh trùm; trùm còn 5 máu (như test có sẵn ngay trên).
- **Không có đồ thưởng:** đặt sẵn vào `player.wardrobe` mọi id của `WEARABLES` có `from === "boss"` (`rollWearable` trả `undefined` khi không còn món nào). Đánh, chờ `BossDefeated`, rồi tìm `Notice` bắt đầu bằng "Hạ được trùm". Mong đợi đúng từng ký tự (viết thẳng trong test, không ráp từ `BOSS.reward`): `"Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02"`.
- **Có đồ thưởng:** phòng mới, wardrobe đủ mọi món của trùm trừ đúng một (món đầu tiên có `from === "boss"`). Mong đợi chữ là chuỗi trên cộng `"  " + wear.icon + "\xa0" + wear.name`, với `wear = getWearable(id)`. Phần icon và tên đọc từ dữ liệu vì thứ test giữ là cách ghép.
- **Cả hai trường hợp:** chữ không khớp `/(🪵|🪨|🫐|🔵) \d/u` (không có dấu cách thường giữa biểu tượng và số), và `kind === "reward"`.

Nếu trước đó có test khác đã gắn đồ vào người chơi đầu phòng, coder dùng `setup()` mới cho mỗi trường hợp.

## Kế hoạch triển khai

1. **`packages/client/src/ui/toastQueue.ts`:**
   - phương thức riêng `enqueue(text, level, at)`, gồm phần tràn hàng chờ, dùng ở `push`;
   - phương thức công khai `shrink(now)` theo Thiết kế 2;
   - JSDoc tiếng Anh cho cả hai; sửa JSDoc lớp: "`update` only ever adds; `shrink` (screen resized) is the only thing that takes a shown toast off, back to the waiting line".
2. **`toastQueue.test.ts`:** test ở mục Test.
3. **`packages/client/index.html`:** quy tắc `.toast.out` mới, kèm chú thích (Thiết kế 1).
4. **`packages/client/src/ui/hud.ts`:**
   - `renderToasts` ghi `top`, `width` cho cái sắp mờ (đọc trước, ghi sau);
   - `resized()` và listener `resize` trong constructor;
   - sửa JSDoc của `measureSlots` (đo khi hiện, mỗi 250 ms lúc chờ, và khi đổi cỡ).
5. **`packages/server/src/rooms/GameRoom.test.ts`:** test ở Thiết kế 3. Import `WEARABLES`, `getWearable` từ `@petgame/shared` nếu chưa có.
6. **`tests/e2e/toasts.spec.ts` (mới):** mục Test. Helper chép, kèm chú thích "Copied because T63 holds multiplayer.spec.ts; to be gathered in T16":
   - `enterLobby`, `waitForWorld` (bản trong `pwa.spec.ts`/`rejoin.spec.ts`);
   - `contexts` + `afterEach`;
   - `shownToasts`;
   - hằng `LONGEST_TOASTS` (2 chữ dài nhất mà `multiplayer.spec.ts` dùng: phần thưởng trùm và lên cấp kèm 2 chiêu).
7. **Tài liệu** (mục Tài liệu).
8. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Các test `toasts (...)`, thanh trùm và các test có `setViewportSize` trong `multiplayer.spec.ts` (không sửa) phải qua.

## Giao thức

Không đổi schema, message, `Profile`. Không đổi chữ server gửi (chỉ test nó). Client: chỉ HUD.

## Test

### Unit: `toastQueue.test.ts`, `describe("shrink")`

`maxVisible` là một biến test tự đổi (`let room = 2; new ToastQueue(() => room)`).

| Test | Mong đợi |
|---|---|
| 2 đang hiện (thường cũ, cao mới), chỗ 2 → 1 | trả `true`; còn cái cao; cái thường ở `waiting` với `at = now` |
| 2 cái cao, chỗ 2 → 1 | cái cũ hơn về chờ (luật yếu nhất), cái mới hơn ở lại |
| chỗ không giảm | trả `false`; `visible` và `waiting` không đổi (cùng mảng, cùng phần tử) |
| cái cao về chờ hiện lại khi cái kia hết giờ | `update(until của cái còn lại)` đưa nó lên với `until = now + toastDuration(...)` (đủ thời gian) |
| cái thấp về chờ bị bỏ sau `TOAST.maxWaitMs.low` | `update(now + maxWaitMs.low + 1)` khi vẫn hết chỗ thì nó không còn trong `waiting` |
| hàng chờ đã đầy (`maxWaiting`) | bớt thêm thì cái yếu nhất trong hàng chờ bị bỏ, như `push` |
| chỗ 2 → 0 (phòng hờ) | cả hai về chờ, không lỗi |
| `update` không bao giờ bớt | 2 đang hiện, chỗ → 1, gọi `update(now)`: vẫn 2 hiện (luật T62 giữ) |
| chỗ tăng lại sau `shrink` | `update` lấp lại từ hàng chờ |

Các test `push`, `update`, `toastRoom`, `toastDuration` cũ qua không đổi (`enqueue` chỉ là tách hàm).

### Tích hợp server

Thiết kế 3.

### E2E: `tests/e2e/toasts.spec.ts` (mới)

Mỗi test vào một thế giới riêng, đợi `frames > 0`, rồi đợi `.hud-toasts > .toast` về 0 (thông báo "đến vùng mới" lúc vào), hạn 20 s. Thông báo do test đẩy qua `window.__petgame.game.hud.showToast(text, level)`.

- **E1** `a toast that takes an old one's place is at once where it stays; the old one fades where it was` (desktop 1280×720, rồi điện thoại ngang 844×390):
  - Desktop: `showToast("Một", "normal")`, `showToast("Hai", "normal")`, chờ 2 cái không mờ và hết hoạt ảnh. Ngay trong **cùng một** `evaluate`: ghi `offsetTop`, `offsetWidth`, `offsetHeight` của "Một"; gọi `showToast("Ba", "normal")` ("Ba" thay "Một", cái cũ nhất cùng mức); ngay sau đó đọc `offsetTop` của "Hai" và "Ba", và hộp của "Một" (giờ `.out`).
  - Mong đợi:
    - "Hai" có `offsetTop` 0, "Ba" có `offsetTop` bằng chiều cao "Hai" + 4 (khoảng cách);
    - đọc lại sau khi "Một" đã bị xoá (`toHaveCount` của `.toast.out` về 0): hai số đó không đổi (±1 px);
    - "Một" lúc mờ giữ đúng `top` và `width` cũ (±1), chiều cao không đổi (không xuống dòng lại).
  - Điện thoại ngang (1 chỗ): `showToast("Một", "low")`, rồi `showToast("Hai", "low")`. "Hai" có `offsetTop` 0 ngay và vẫn 0 sau khi "Một" bị xoá.
  - **Trên HEAD hỏng:** "Ba" lúc đầu thấp hơn một ô. Ghi vào `PROGRESS.md`.
- **E2** `turning the phone so only one toast fits sends the other back to wait, and it comes back in full` (412×915 dọc, chạm; theo bảng T62 màn này luôn có 2 chỗ):
  - đẩy `LONGEST_TOASTS` (2 cái cao), chờ 2 cái không mờ;
  - `setViewportSize({ width: 915, height: 412 })`.

  Mong đợi:
  - trong 1 s chỉ còn 1 cái không mờ, và đáy của nó ≤ `412 − 140`;
  - thu mọi chữ từng hiện (poll `shownToasts`): sau khi cái còn lại hết giờ, cái kia hiện, nên cả 2 chữ đều đã hiện. Hạn 20 s: thời gian tối đa 7 s mỗi cái.

  Phần quay lại: lại đẩy 2 cái, xoay sang ngang (1 hiện, 1 chờ), rồi xoay về 412×915: trong 1 s có 2 cái không mờ.

  **Trên HEAD hỏng:** sau khi xoay vẫn 2 cái.
- Desktop không đổi luật: phần desktop của E1 có 2 chỗ.

### Đột biến cho tester

Tất cả tạm thời: hoàn tác, kiểm bằng `sha256sum` hoặc `git diff --stat`, ghi lệnh và kết quả vào `PROGRESS.md`.

| # | Đột biến | Phải hỏng |
|---|---|---|
| M1 | bỏ `position: absolute` của `.toast.out` | E1 (ô của "Ba") |
| M2 | không ghi `width` cho cái sắp mờ | E1 (cỡ của "Một" lúc mờ). Nếu chữ thử quá ngắn để xuống dòng, coder chọn chữ dài hơn cho "Một" |
| M3 | không ghi `top` | E1 ("Một" nhảy lên đầu hộp) |
| M4 | bỏ listener `resize` | E2 |
| M5 | `shrink` bỏ hẳn cái thừa thay vì đưa về chờ | unit "hiện lại khi cái kia hết giờ"; E2 (chữ thứ hai không bao giờ hiện) |
| M6 | `shrink` bớt cái mới nhất thay vì cái yếu nhất | unit "2 đang hiện" và "2 cái cao" |
| M7 | `update` cũng gọi phần bớt | unit "`update` không bao giờ bớt" |
| M8 | `resized` không gọi `update` | E2 phần quay lại (cái chờ chỉ hiện ở lần đo 250 ms; với hạn 1 s có thể vẫn qua). Tester ghi kết quả; nếu sống sót thì hạ hạn kiểm còn 200 ms và ghi lý do |
| M9 | `rewardText` dùng dấu cách thường | test server mới và `wardrobe.test.ts` |
| M10 | `bossDefeated` bỏ một dấu cách giữa các món | test server mới (cả hai trường hợp) |

## Tài liệu

`docs/design/hud.md`, mục **Thông báo (toast)**:
- **Bao nhiêu cái cùng lúc:** thêm "Màn hình đổi cỡ (xoay máy, thanh địa chỉ hiện hay ẩn, đổi cỡ cửa sổ) thì số chỗ được tính lại ngay. Số chỗ giảm thì cái yếu nhất đang hiện (mức thấp nhất, cùng mức thì cũ nhất) tạm rời màn hình, về hàng chờ, rồi hiện lại đủ thời gian khi có chỗ (mức thường, thấp chờ như thường, quá thì bỏ). Bố cục đổi mà màn hình không đổi cỡ (ô nhiệm vụ dài ra, thanh trùm hiện) thì thông báo đang hiện không bị cắt."
- **Mục "Thông báo và tên mình khi cầm dọc":** câu "Số chỗ được tính lại mỗi khi có thông báo mới, và trong lúc có thông báo đang chờ thì tính lại mỗi 250 ms" thêm "và khi màn hình đổi cỡ (T31)".
- **Khi đã hết chỗ:** sau "Thông báo mức cao không bao giờ bị thay hay cắt ngắn" thêm "(trừ khi màn hình đổi cỡ làm mất chỗ: xem trên)".
- **Đoạn mới, cạnh "Chỗ hiện":** "Thông báo hết giờ hay bị thay thì mờ đi tại chỗ trong 0,2 giây nhưng không giữ chỗ: cái mới hiện ngay ở ô của nó, cái còn lại lên ngay (T31)."

`docs/architecture.md`, dòng `ui/toastQueue.ts`: thêm `shrink` (chỉ khi màn hình đổi cỡ), `update` chỉ thêm; `hud.ts` nghe `resize`. Thêm `tests/e2e/toasts.spec.ts` vào danh sách spec ở mục `npm run test:e2e`.

## Tiêu chí hoàn thành

- [ ] `.toast.out` nằm ngoài dòng chảy, giữ `top` và `width` cũ; thông báo mới ở đúng ô ngay từ khung đầu (E1). Cùng lớp `.out`, cùng `:not(.out)` như trước.
- [ ] `ToastQueue.shrink` có JSDoc và unit test; `update` không bao giờ bớt. `Hud` đo lại và gọi `shrink` rồi `update` khi `resize`. Vẫn đo khi hiện và mỗi 250 ms lúc chờ.
- [ ] E2 qua: xoay dọc sang ngang còn 1 cái, cái kia hiện lại sau; xoay về thì 2.
- [ ] Test server cho chữ `bossDefeated` qua cả khi không có và có đồ thưởng, đúng từng ký tự, có `\xa0`.
- [ ] E1, E2 hỏng trên HEAD `2030898` (ghi trong `PROGRESS.md`).
- [ ] Bảng đột biến M1-M10 cho đúng kết quả (M8 ghi rõ).
- [ ] `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts`. Không đổi chữ người chơi thấy, schema, message.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` qua (cả các test thông báo và thanh trùm cũ, không sửa). Tài liệu cập nhật như mục Tài liệu.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Chồng 200 ms khi mờ:** người chơi thấy chữ cũ mờ dần chồng lên chữ mới trong 0,2 s. Nếu reviewer thấy khó đọc, có thể làm cái mờ đi nhạt nhanh hơn (`transition` riêng 0,12 s cho `.out`), không cần đổi cách làm.
2. **Test cũ có `setViewportSize` khi đang hiện thông báo** (`multiplayer.spec.ts`, không sửa được): đã đọc các chỗ đổi cỡ. Hai chỗ (thanh trùm 1248×720 và 1024×768; nút 🔗 375×812 rồi về ngang) không làm giảm số chỗ đang dùng, hoặc chạy lúc chưa đẩy thông báo của test. Nếu một test cũ hỏng vì cái thứ hai về hàng chờ, tester báo lại; không sửa spec đó, và cân nhắc chuyển mục 2 sang T31b chờ Q1.
3. **T63 khi được trả lại:** các helper của nó (`pushBossToasts`) đẩy thông báo lúc thanh trùm hiện và không đổi cỡ màn hình, nên không chạm `shrink`. Chúng đếm `.toast.out` khi chờ thông báo "yên". Lớp đó vẫn có mặt trong 200 ms mờ như trước.

## Đề xuất cho `TASKS.md`

Không có việc mới. Ghi chú cho T16: `tests/e2e/toasts.spec.ts` có bản chép `enterLobby`, `waitForWorld`, `shownToasts`, `LONGEST_TOASTS`.
