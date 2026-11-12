# PLAN: T30 Thanh máu trùm che HUD

Đọc code ở HEAD `60ae2d0`. File liên quan:
- `packages/client/index.html`:
  - `.boss-bar`, `.boss-hp` ở dòng 64-68;
  - `.hud-left` ở dòng 102-103 (desktop: rộng tối đa `min(460px, 100vw − 190px)`, gap 6);
  - `.minimap` ở dòng 113;
  - `.party-panel` ở dòng 148-150 (`top: 204px` cố định);
  - khối điện thoại `@media (max-width: 600px)` ở dòng 370-384 (`.hud-left` dòng 371, `.minimap` dòng 380, `.party-panel { top: 196px }` dòng 381);
  - khối điện thoại ngang `@media (max-height: 520px) and (min-width: 601px)` ở dòng 386-416 (`.hud-left { max-width: 300px }` dòng 388, `.boss-bar { width: 200px }` dòng 399, `.minimap` dòng 404, `.party-panel` dòng 405, `.wardrobe-panel` dòng 406).
- `packages/client/src/ui/hud.ts`:
  - tạo `.boss-bar` ở dòng 63-66, gắn thẳng vào `.hud`, không vào cột;
  - cột trái ở dòng 67-70;
  - `setBoss` ở dòng 139-145: ghi DOM ở **mọi khung hình** khi ở gần trùm.
- `packages/client/src/game/Game.ts`: `updateBossBar()` ở dòng 1371-1377 (hiện thanh khi người chơi cách trùm ≤ 450 px, tính ở client), gọi mỗi khung ở dòng 1030. `QuestTracker` gắn vào `hud.left` ở dòng 327. Không sửa.
- `tests/e2e/multiplayer.spec.ts`:
  - `openPage` ở dòng 47, `join` ở dòng 72;
  - `touchTargets` ở dòng 431;
  - `toastLayout` ở dòng 2347 (danh sách phần HUD đã có `.boss-bar`), `boxesOverlap` ở dòng 2367, `TOAST_SCREENS` ở dòng 2370.

### Số đo hiện tại (script tạm, đã xoá)

**Cách đo.**
- Chạy game thật (server `PETGAME_DEBUG=1`, Vite) với Chromium ở `/opt/pw-browsers/chromium`.
- Cảnh: cho một Emberpup cấp 8 (`debug:givePal`), dịch chuyển tới 260 px phía nam trùm (`debug:teleport`), chờ `.boss-bar` hiện, rồi đẩy 2 thông báo dài nhất (như test `toasts (...)`).
- Vùng an toàn (tai thỏ) giả lập bằng CDP `Emulation.setSafeAreaInsetsOverride` trước khi mở trang. Đã kiểm `env(safe-area-inset-*)` đọc ra đúng số đặt vào. Chrome 153 trong container hỗ trợ lệnh này.
- Toạ độ trong bảng là hộp `[trái, trên, phải, dưới]`, đơn vị px.

| Màn hình | Thanh trùm | Chồng lên |
|---|---|---|
| Desktop 1280×720 | `[430,12,850,47]` | hàng máu 42×35 |
| Desktop 1024×768 | `[302,12,722,47]` | hàng máu 170×35 |
| Dọc 390×844 | `[78,12,312,47]` | hàng máu 184×35, 🔊 37×11, nút 🐾 Thú 17×27 |
| Dọc 360×640 | `[72,12,288,64]` (xuống 2 dòng) | hàng máu 160×52, 🔊 43×28, 🐾 Thú 23×27, 🏕️ 25×4 |
| Ngang 844×390 | `[322,12,522,45]` | không có (cột tới 312) |
| Ngang 844×390, tai thỏ trái/phải 47 | như trên | hàng máu 25×33. Cột `[47..347]` vượt mốc 322 (giữa − 100) |
| Ngang 852×393, tai thỏ 59 (iPhone 14 Pro) | `[326..526]` | hàng máu 33×33. Cột tới 359 > 326 |
| Ngang 812×375, tai thỏ 44 (iPhone X/11 Pro) | `[306..506]` | hàng máu 38×33. Cột tới 344 > 306 |
| Ngang 667×375 (iPhone SE, không tai thỏ) | `[234..434]` | hàng máu 78×33, bản đồ nhỏ 35×33. Cột tới 312 > 233 |

**Bảng khi cầm dọc có tai thỏ** (390×844, trên 47, dưới 34):
- Nút 👕 Tủ đồ dời xuống `[303,191,378,218]`, vì các nút cột phải có cộng `env(safe-area-inset-top)`.
- Ba bảng vẫn mở ở `top: 196px`, nên **đè nút Tủ đồ 75×22 px**. Ở 430×932 (tai thỏ 59) đè 75×27.
- Bảng kéo xuống tới 832, nằm dưới thanh Home (mép dưới an toàn là 810).

**Thông báo đè tên mình (`.label.me`), có từ trước, không do thanh trùm:**
- Dọc 390×760 (`TOAST.roomyPortraitPx = 760` nên vẫn cho 2 thông báo): 2 thông báo dài nhất đè tên mình 5 px.
- Dọc 360×640: cột đè tên mình.

## Mục tiêu

Lúc đánh trùm là lúc người chơi cần nhìn máu của chính mình nhất. Hiện giờ thanh máu trùm lại đè đúng lên hàng máu, trên điện thoại dọc gần hết hàng (184×35 px), và còn đè 🔊 với nút 🐾 Thú. Sau nhiệm vụ này:
- Ở mọi cỡ màn hình, kể cả iPhone có tai thỏ cầm dọc hay ngang, thanh máu trùm không đè hàng máu, thông báo, cột nút phải hay bản đồ nhỏ.
- Các bảng không bao giờ đè nút cột phải, cũng không lấn vào vùng tai thỏ và thanh Home.

## Phạm vi

Làm:
- Đặt lại chỗ của thanh máu trùm theo cỡ màn hình. Thanh có chữ dài thì tên rút gọn bằng "…", còn số máu luôn hiện đủ.
- Cột trái khi cầm ngang trừ phần tai thỏ bên trái, để luôn kết thúc trước giữa màn hình − 100 px.
- Bảng Thú, Chế tạo, Tủ đồ cộng vùng an toàn trên và dưới (desktop, dọc, ngang).
- `setBoss` chỉ ghi DOM khi số đổi (giống `setHealth`).
- E2E mới ở 5 cấu hình màn hình (2 cấu hình có tai thỏ giả lập), cộng các mốc bề rộng của desktop.
- Cập nhật `docs/design/hud.md`.

**Không** làm:
- Không đổi luật trùm, khoảng cách 450 px hiện thanh, hay `Game.ts`.
- Không đổi hàng đợi thông báo (`toastQueue.ts`, `TOAST.roomyPortraitPx`).
- Không đổi cỡ, chỗ của bảng ngoài phần vùng an toàn: bảng Thú/Tủ đồ rộng 490 px khi cầm ngang vẫn đè một phần cột trái như T18.
- Không đổi server, schema, message, hồ sơ lưu.
- Không sửa lỗi "thông báo đè tên mình" có từ trước ở 390×760 và 360×640 (đề xuất tách việc, xem cuối).

## Thiết kế

### 1. Thanh máu trùm có hai chỗ

**A. Giữa trên** (như bây giờ). Dùng khi:
- desktop rộng ≥ 1248 px;
- màn thấp ≤ 520 px và rộng ≥ 601 px (điện thoại cầm ngang).

**B. Trong cột trái, thế chỗ ô nhiệm vụ.** Dùng khi:
- rộng ≤ 600 px (điện thoại dọc);
- rộng 601-1247 px và cao > 520 px (desktop hẹp, máy tính bảng).

Media query của chỗ B: `@media (max-width: 600px), (max-width: 1247px) and (min-height: 521px)`.

**Vì sao thế chỗ ô nhiệm vụ, không chèn thêm vào cột:**
- Chèn thêm thì cột dài ra khoảng 22-38 px, đẩy thông báo xuống. Đo bản thử: dọc 390×844 có tai thỏ (iPhone ở Màn hình chính), 2 thông báo đè tên mình 14 px; ở 390×760 thì 17 px.
- Ẩn ô nhiệm vụ (57 px + gap 4) trong lúc thanh trùm hiện thì cột còn **ngắn hơn** bây giờ. Đo bản thử: thông báo cuối cách tên mình 25 px (có tai thỏ), 7 px (390×760), 28 px (360×640).
- Ô nhiệm vụ hiện lại ngay khi đi xa trùm hơn 450 px, hoặc khi trùm bị hạ (thanh ẩn khi trùm biến khỏi state).
- Lúc đánh trùm, nhiệm vụ thường chính là "Hạ Vua Đá Boulderhorn", và thanh trùm nói đúng điều đó.

**Vì sao đặt sau trạng thái, trước thông báo**, không ngay dưới hàng máu: hàng máu và trạng thái không nhảy lên xuống khi người chơi đi ra vào vùng 450 px. Chỉ thông báo dời theo, và chúng vốn đã dời theo cột.

**Cách làm bằng CSS.**
- `.boss-bar` chuyển vào trong `.hud-left` (DOM). Có `order: 5`: sau ô nhiệm vụ (order 0, gắn sau), trước thông báo (`order: 10`).
- Ở chỗ A, thanh `position: absolute` so với `.hud-left`:
  - `top: 0`, trùng mép trên của cột, tức `max(12px, env(safe-area-inset-top))` như cũ;
  - `left: calc(50vw - max(12px, env(safe-area-inset-left)))` và `transform: translateX(-50%)`, nên tâm thanh đúng giữa màn hình.
  - Không dùng `position: fixed`, để không phụ thuộc cách Safari xử lý fixed.
- Ở chỗ B: `position: static`, `align-self: stretch` (rộng bằng cột).
- `Hud.setBoss` bật lớp `boss-near` trên `.hud-left` khi thanh hiện. CSS chỗ B: `.hud-left.boss-near > .hud-quest { display: none; }`. Dùng lớp chứ không dùng `:has()`: rõ ràng, dễ kiểm trong e2e.

### 2. Bề rộng và các con số

**Desktop, chỗ A:** `width: min(420px, calc(100vw - 2 * max(12px, env(safe-area-inset-left)) - 944px))`.
- Lý do: cột desktop rộng tối đa 460 px, nên mép phải cột là L + 460, với L = `max(12px, inset trái)`. Muốn thanh nằm giữa và cách cột 12 px thì nửa bề rộng ≤ 50vw − L − 472, tức bề rộng ≤ 100vw − 2L − 944.
- Đo bản thử:

| Bề rộng màn hình | Bề rộng thanh |
|---|---|
| 1248 | 280 |
| 1280 | 312 (bây giờ 420 và đè cột 42 px) |
| 1366 | 398 |
| 1440 trở lên | 420 |

- Phía phải không ràng buộc gì: nút cột phải bắt đầu từ khoảng 100vw − 118.
- **Mốc 1248:** chữ "👑 Vua Đá Boulderhorn" cỡ 14 px rộng khoảng 155 px (tên 137 + vương miện), cộng "1152/1152" khoảng 70 px và khoảng cách. Vậy 280 px là bề rộng nhỏ nhất còn hiện đủ tên và số. Đo: ở 1248 tên không bị cắt. Hẹp hơn thì thanh vào cột (chỗ B), ở đó thanh rộng 460 px.

**Điện thoại ngang, chỗ A:**
- **Cột trái:** `max-width: min(300px, calc(50vw - 110px - max(12px, env(safe-area-inset-left))))`.
  - Mép phải cột luôn ≤ 50vw − 110. Vậy luật "cột kết thúc trước giữa màn hình ≥ 100 px" (T6) đúng cả khi có tai thỏ, và cột cách thanh trùm (rộng 200, bắt đầu ở 50vw − 100) ít nhất 10 px.
  - Ở 844×390 không tai thỏ vẫn đúng 300 px như cũ (422 − 110 − 12 = 300).
  - Có tai thỏ: 265 px (844, inset 47), 257 px (852, inset 59), 252 px (812, inset 44).
- **Thanh trùm:** `width: min(200px, calc(100vw - 528px - 2 * max(12px, env(safe-area-inset-right))))`.
  - Lý do: bản đồ nhỏ khi cầm ngang có mép trái ở 100vw − R − 252 (right R + 140, rộng 112), với R = `max(12px, inset phải)`. Cách nó 12 px thì nửa bề rộng ≤ 50vw − R − 264.
  - Bề rộng thanh: 200 ở 844 (có hay không tai thỏ), 196 ở 812 có tai thỏ 44, 115 ở 667×375. Ở 667 bây giờ thanh đè cả cột lẫn bản đồ.
  - Giữ cỡ chữ 12 px.

**Chữ trong thanh**, ở mọi chỗ:
- Một dòng `<strong>`: `<span class="boss-name">👑 Vua Đá Boulderhorn</span><span class="boss-num">1152/1152</span>`, cách nhau 4 px, `white-space: nowrap`.
- `.boss-name` có `min-width: 0; overflow: hidden; text-overflow: ellipsis`. `.boss-num` có `flex: none`, nên **số máu không bao giờ bị cắt**, chỉ tên rút gọn khi thiếu chỗ.
- Đo ở cỡ 12 px: tên kèm vương miện khoảng 137 px, cả dòng khoảng 200 px. Vậy tên có thể mất vài chữ cuối ở thanh 196-200 px, và rút còn "👑 Vua…" ở 115 px. Chấp nhận được: tên trùm luôn hiện trên đầu nó ngoài thế giới (`👑 Vua Đá Boulderhorn`).
- Chỗ A: chữ canh giữa, không nền (như bây giờ).

**Chỗ B (trong cột)** trông như các ô khác của cột:
- nền `rgba(0,0,0,0.45)`, `padding: 4px 10px`, `border-radius: 8px`, viền trái 3 px màu cam `#ff6d00` (ô nhiệm vụ viền vàng, nên hai ô khác nhau);
- tên bên trái, số bên phải (`justify-content: space-between`).
- Điện thoại dọc: chữ 12 px, thanh máu cao 10 px. Cả ô khoảng 38 px, thấp hơn ô nhiệm vụ 57 px mà nó thế chỗ.

**Chạm:** thanh không có nút. Nó nằm trong `.hud` (`pointer-events: none`) và không bật lại, nên trên cảm ứng chạm vào thanh vẫn bật cần điều khiển (như các ô khác của cột, T39).

**Lớp vẽ:** thanh không đặt z-index. Bảng (z 3) và thông báo (z 4) vẽ trên nó.
- Khi cầm ngang, bảng Thú/Tủ đồ rộng 490 px che thanh trong lúc mở. Người chơi tự mở bảng, ✕ hay Escape là đóng.
- Thanh không bao giờ được vẽ đè lên bảng: nếu đè thì che tiêu đề bảng và nút 🕊️ Thả bớt.

### 3. Bảng và vùng an toàn

Mép trên của bảng theo đúng công thức của bản đồ nhỏ, để bảng luôn nằm dưới nút 👕 Tủ đồ (kể cả vùng chạm vô hình 44 px):

| Chỗ | `top` | `max-height` |
|---|---|---|
| Desktop (khối gốc, dòng 148-149) | `max(204px, calc(env(safe-area-inset-top) + 192px))` | `calc(100% - <top> - max(12px, env(safe-area-inset-bottom)))` |
| Dọc (dòng 381) | `max(196px, calc(env(safe-area-inset-top) + 184px))` | `calc(100% - <top> - max(12px, env(safe-area-inset-bottom)))` |
| Ngang (dòng 405-406) | giữ `max(8px, env(safe-area-inset-top))` | `calc(100% - max(8px, env(safe-area-inset-top)) - max(8px, env(safe-area-inset-bottom)))`; `.wardrobe-panel` dùng đúng biểu thức này cho `height` (thay `calc(100% - 16px)`) |

`<top>` viết lại nguyên biểu thức `max(...)` của cột `top`. CSS không có biến cho nó; nếu muốn gọn thì dùng custom property `--panel-top` đặt cạnh `top`.

Kiểm theo số đo:
- Dọc có tai thỏ 47: Tủ đồ có tâm ở 204,5, vùng chạm tới 226,5; bảng bắt đầu ở 231 (đo bản thử: không còn đè). Đáy bảng ở 844 − 34 = 810.
- Không tai thỏ: mọi số giống hệt bây giờ (196/204, đáy cách mép 12, ngang 8). Vì vậy test T18 (`touch targets`, `panelFits`, 2 thẻ trọn khi cầm ngang) không đổi.

### 4. Trường hợp đã biết, chấp nhận trong nhiệm vụ này

Điện thoại ngang thấp 375 px (812×375 có tai thỏ 44, 667×375 không tai thỏ):
- Cột hẹp lại (252 và 212 px) nên ô trạng thái xuống 2 dòng. Thông báo (1 cái) kết thúc ở 246 và 260 px, quá mốc 375 − 140 = 235 của T18.
- Ở 844×390 có tai thỏ 47 và 852×393 có tai thỏ 59 vẫn đạt: 246 ≤ 250 và 246 ≤ 253.
- Chọn giữ luật "cột trước giữa màn hình 100 px" và luật "thanh trùm không đè cột", bỏ luật "góc ngón cái" ở hai màn này. Lý do:
  - cột nằm đó mãi, che nhãn tên quanh nhân vật;
  - thông báo chỉ hiện vài giây và cho chạm xuyên (`pointer-events: none`), nên không chặn cần điều khiển.
- Bây giờ chính hai màn này đang vi phạm cả hai luật kia: cột tới 344 > 306 và 312 > 233, thanh trùm đè cột 38 và 78 px.
- Đề xuất tách việc (cuối file).

## Kế hoạch triển khai

1. **`packages/client/src/ui/hud.ts`**
   - Dòng 63-70: tạo `bossBar` với nội dung `<strong><span class="boss-name"></span><span class="boss-num"></span></strong><div class="boss-hp"><div></div></div>` (vẫn `hidden = true`). **Không** gắn vào `this.root` nữa: `this.left.append(this.health, this.status, this.bossBar, this.toasts)`.
     - Chú thích (tiếng Anh): thanh nằm trong cột; CSS đặt nó giữa trên hoặc trong cột thay ô nhiệm vụ (T30, `docs/design/hud.md`).
   - Thêm trường `private lastBoss = ""` (khoá `name|hp|maxHp`). Viết lại `setBoss(boss)`:
     - Chỉ đổi `hidden` và lớp `boss-near` của `this.left` khi trạng thái hiện/ẩn thật sự đổi (so với `this.bossBar.hidden`).
     - Khi có trùm: tính khoá `${boss.name}|${Math.ceil(boss.hp)}|${boss.maxHp}`; trùng `lastBoss` thì `return`. Không trùng thì ghi `.boss-name` = `👑 ${boss.name}`, `.boss-num` = `${Math.ceil(boss.hp)}/${boss.maxHp}`, và bề rộng thanh như cũ.
     - Giữ tham chiếu tới ba phần tử con trong trường riêng (như `eatCover`), không `querySelector` mỗi khung.
   - Chữ "👑 " giữ như cũ, ghép trong `.boss-name`.
2. **`packages/client/index.html`, khối gốc**
   - Thay dòng 64-66 (`.boss-bar`, `.boss-bar[hidden]`) bằng:
     - `.boss-bar`: `order: 5; box-sizing: border-box; position: absolute; top: 0; left: calc(50vw - max(12px, env(safe-area-inset-left))); transform: translateX(-50%); width: min(420px, calc(100vw - 2 * max(12px, env(safe-area-inset-left)) - 944px)); text-align: center; color: #fff; font-size: 14px; text-shadow: 0 1px 2px #000;`
     - `.boss-bar[hidden] { display: none; }` (giữ).
     - `.boss-bar strong { display: flex; justify-content: center; align-items: baseline; gap: 4px; white-space: nowrap; }`
     - `.boss-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }` và `.boss-num { flex: none; }`.
   - Ngay sau `.boss-hp div` (dòng 68), thêm khối chỗ B: `@media (max-width: 600px), (max-width: 1247px) and (min-height: 521px)` gồm
     - `.boss-bar { position: static; transform: none; width: auto; align-self: stretch; text-align: left; background: rgba(0,0,0,0.45); border-left: 3px solid #ff6d00; padding: 4px 10px; border-radius: 8px; }`
     - `.boss-bar strong { justify-content: space-between; }`
     - `.hud-left.boss-near > .hud-quest { display: none; }`
     - Chú thích CSS (tiếng Anh) ghi lý do: thế chỗ ô nhiệm vụ để cột không dài thêm và thông báo không chạm tên mình; mốc 1247 từ 100vw − 968 ≥ 280.
   - `.party-panel` (dòng 148-149): `top` và `max-height` theo bảng ở Thiết kế mục 3, kèm chú thích.
3. **`packages/client/index.html`, khối `@media (max-width: 600px)`** (dòng 370-384)
   - Thêm `.boss-bar { font-size: 12px; }` và `.boss-hp { height: 10px; margin-top: 3px; }`.
   - `.party-panel` (dòng 381): `top` và `max-height` theo bảng ở mục 3.
4. **`packages/client/index.html`, khối ngang** (dòng 386-416)
   - Dòng 388: `.hud-left { max-width: min(300px, calc(50vw - 110px - max(12px, env(safe-area-inset-left)))); gap: 4px; }`. Sửa chú thích: "ends 110 px left of the middle, notch or not (T6, T30)".
   - Dòng 399: `.boss-bar { width: min(200px, calc(100vw - 528px - 2 * max(12px, env(safe-area-inset-right)))); font-size: 12px; }`, chú thích nói khe giữa cột và bản đồ nhỏ.
   - Dòng 405: `max-height` theo mục 3. Dòng 406: `height` của `.wardrobe-panel` theo mục 3.
5. **`tests/e2e/multiplayer.spec.ts`**: test mới, xem mục Test.
6. **`docs/design/hud.md`**: game-designer đã cập nhật cùng PLAN này. Coder chỉ sửa nếu con số làm thật khác với tài liệu, và ghi lý do vào `PROGRESS.md`.

Không có logic dùng chung mới, nên không có gì vào `packages/shared`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`. Không ảnh hưởng server hay dữ liệu đã lưu. Chỉ client: DOM của `Hud` và CSS.

## Test

**Unit:** không có. Thay đổi là CSS và DOM của client; không có hàm thuần mới. `toastQueue.test.ts` không đổi.

**Tích hợp server:** không.

**E2E** (`tests/e2e/multiplayer.spec.ts`, đặt ngay sau khối `toasts (...)`, dùng lại `boxesOverlap`).

### a. Giả lập tai thỏ

Thêm tham số tuỳ chọn `before?: (page: Page) => Promise<void>` cho `openPage` (chạy sau `newPage`, trước `goto`) và cho `join` (truyền xuống). Các lời gọi cũ không đổi.

Hàm `safeArea(insets: { top?: number; right?: number; bottom?: number; left?: number })` trả về hàm `before`:
1. Thử CDP: `context.newCDPSession(page)` rồi `send("Emulation.setSafeAreaInsetsOverride", { insets: { top, topMax: top, left, leftMax: left, bottom, bottomMax: bottom, right, rightMax: right } })`. Đã chạy được với Chrome 153 trong container.
2. Nếu lệnh ném lỗi (CI chạy Chromium 141 của Playwright, chưa chắc có lệnh này): `page.route` cho tài liệu `/` (pathname `/`), `route.fetch()`, rồi thay chuỗi `env(safe-area-inset-<cạnh>)` trong HTML bằng `<n>px` và `route.fulfill`. Mọi `env()` của game chỉ nằm trong `<style>` của `index.html` (`grep` trong `src/` không có).

Sau khi vào thế giới, test **kiểm vùng an toàn đã có tác dụng**, dù đi đường nào:
- mép trái `.hud-left` = `max(12, left)` ±1;
- mép trên `.party-btn` = `max(12, top)` ±1.

### b. Năm cấu hình (`BOSS_SCREENS`)

| Tên | Viewport | Cảm ứng | Tai thỏ | Thanh ở | Thông báo |
|---|---|---|---|---|---|
| desktop | 1280×720 | không | | giữa trên | 2 |
| phone upright | 390×844 | có, `isMobile` | | cột | 2 |
| phone sideways | 844×390 | có | | giữa trên | 1 |
| phone upright, notch | 390×844 | có | trên 47, dưới 34 | cột | 2 |
| phone sideways, notch | 844×390 | có | trái 47, phải 47, dưới 21 | giữa trên | 1 |

### c. Mỗi cấu hình một test

Tên: `boss bar (<tên>): clear of the health row, the toasts, the right column and the panels`, có `test.slow()`.
1. `join` (kèm `safeArea` nếu có), `waitForWorld`, chờ `frames > 0`. Kiểm vùng an toàn (mục a).
2. `debug:givePal` emberpup cấp 8, chờ `.skill-bar` hiện và `.hud-quest` có chữ (như test `toasts`). Ghi lại vị trí xuất phát của mình.
3. Tìm trùm trong `room.state.pals` (`boss === true`), `debug:teleport` tới `{ x: boss.x, y: boss.y + 260 }`, chờ `.boss-bar` hiện (timeout 30 s). Trùm hiền khi không bị đánh; trong lần đo nó không tấn công.
4. Chờ hết thông báo (`toHaveCount(0, 20 s)`). Đẩy 2 thông báo dài nhất (đúng chuỗi của test `toasts`). Chờ số thông báo hiện bằng cột "Thông báo".
5. Đo bằng helper mới `bossLayout(page)`, trả về:
   - hộp thanh trùm, `.boss-num`, `strong`;
   - hộp các phần: `.hud-health, .hud-status, .hud-quest, .eat-btn, .sound-btn, .invite-btn, .party-btn, .base-btn, .craft-btn, .wardrobe-btn, .minimap, .skill-btn, .skill-auto, .ball-btn, .action-btn`, các thông báo `:not(.out)`, `.label.me span`. Chỉ lấy phần đang hiện, như `toastLayout`;
   - `columnRight`, `.hud-quest` có đang hiện không (`display`), `.hud-left` có lớp `boss-near` không;
   - `elementFromPoint` ở tâm thanh;
   - kích thước màn hình.
6. Kiểm:
   - Thanh không chồng (`boxesOverlap`) phần nào trong danh sách.
   - Mỗi thông báo không chồng phần nào, kể cả thanh trùm và tên mình. Thông báo nằm trong màn hình.
   - Thanh nằm trong vùng an toàn: trái ≥ L, phải ≤ rộng − R, trên ≥ `max(12, top)` −1 (L, R là inset của cấu hình, 0 nếu không có).
   - `.boss-num` hiện đủ: `scrollWidth ≤ clientWidth + 1`, hộp nằm trong hộp thanh. `strong` cao ≤ 22 px (một dòng).
   - Chỗ A (giữa trên):
     - |tâm thanh − rộng/2| ≤ 1;
     - trên của thanh = trên của `.hud-left` ±1;
     - trái của thanh ≥ `columnRight` + 8;
     - phải của thanh ≤ (cầm ngang: trái `.minimap`; desktop: trái nhỏ nhất của 4 nút cột phải) − 8;
     - `.hud-quest` vẫn hiện.
   - Chỗ B (trong cột):
     - `.hud-left` có `boss-near`, `.hud-quest` không hiện;
     - trên của thanh ≥ dưới `.hud-status` + 2, dưới của thanh ≤ trên thông báo đầu − 2;
     - trái và rộng của thanh bằng `.hud-left` ±1;
     - trên cảm ứng, `elementFromPoint` ở tâm thanh nằm trong `.joystick-zone`.
   - Cầm ngang (cả có tai thỏ):
     - `columnRight ≤ rộng/2 − 100`;
     - mọi thông báo kết thúc ≤ cao − 140. Đo bản thử: 210 và 246, mốc 250.
7. **Bảng:** lần lượt mở `.party-btn` → `.pals-panel`, `.craft-btn` → `.craft-panel`, `.wardrobe-btn` → `.wardrobe-panel` (desktop `click`, cảm ứng `tap`). Mỗi bảng, kiểm:
   - Bảng nằm trong vùng an toàn: trên ≥ `top` (inset), dưới ≤ cao − `max(bottom, 8)` + 1.
   - 4 nút cột phải không bị bảng che: `elementFromPoint` ở tâm mỗi nút, và ở tâm ± 21 px theo chiều dọc (vùng chạm 44 px), đều thuộc nút đó.
   - Nếu hộp bảng giao hộp thanh trùm: `elementFromPoint` ở tâm phần giao thuộc bảng (bảng vẽ trên thanh).
   - Đóng bằng `.party-close` của bảng, chờ bảng ẩn.
8. Dịch chuyển về chỗ xuất phát. `.boss-bar` ẩn, `.hud-quest` hiện lại, `.hud-left` không còn `boss-near`.
9. **Chỉ cấu hình desktop**, sau bước 8 thì quay lại gần trùm (bước 3) rồi:
   - `page.setViewportSize({ width: 1248, height: 720 })`: thanh ở giữa trên, rộng 280 ±1, tên không bị cắt (`.boss-name` có `scrollWidth ≤ clientWidth + 1`).
   - `page.setViewportSize({ width: 1024, height: 768 })`: chờ (`expect.poll`) đến khi thanh vào cột. Kiểm như chỗ B, và kiểm lại "thanh không chồng phần nào".

**Test có sẵn phải vẫn qua, không sửa:**
- `toasts (...)`: `toastLayout` đã có `.boss-bar` trong danh sách; không có trùm thì không đổi.
- `touch targets (...)` và `touch (...)` (T18, T39): không tai thỏ thì số của bảng giữ nguyên.

## Tiêu chí hoàn thành

- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch. `npm run test:e2e` qua toàn bộ, kể cả 5 test `boss bar (...)` mới.
- [ ] `.boss-bar` là con của `.hud-left`, `order: 5`. `setBoss` không ghi DOM khi tên, máu, máu tối đa và trạng thái hiện/ẩn đều không đổi; không `querySelector` mỗi khung.
- [ ] Desktop ≥ 1248 px: thanh giữa trên, rộng `min(420, 100vw − 2L − 944)`, ở 1280 rộng 312. Cách cột trái ≥ 12 px. Ô nhiệm vụ vẫn hiện.
- [ ] Desktop 601-1247 px (cao > 520) và mọi màn rộng ≤ 600: thanh nằm trong cột, sau ô trạng thái, trước thông báo. Ô nhiệm vụ ẩn trong lúc thanh hiện, hiện lại khi thanh ẩn.
- [ ] Điện thoại ngang: thanh giữa trên, rộng `min(200, 100vw − 2R − 528)`. Cột trái kết thúc ≤ 50vw − 110 cả khi có tai thỏ; ở 844×390 không tai thỏ cột vẫn rộng 300.
- [ ] Ở cả 5 cấu hình e2e: thanh không chồng hàng máu, 🫐 Ăn, 🔊, trạng thái, ô nhiệm vụ, thông báo, 4 nút cột phải, bản đồ nhỏ, thanh chiêu, nút cảm ứng, nút bóng, tên mình. Thông báo không chồng thanh, cũng không chồng tên mình.
- [ ] Số máu trùm không bao giờ bị cắt; chỉ tên rút gọn bằng "…". Chữ một dòng.
- [ ] Thanh không nhận chạm: trên cảm ứng, chạm vào thanh trong cột là bật cần điều khiển.
- [ ] Bảng Thú, Chế tạo, Tủ đồ:
  - mép trên = `max(204, inset trên + 192)` (desktop), `max(196, inset trên + 184)` (dọc);
  - đáy cách mép dưới `max(12, inset dưới)` (ngang `max(8, …)`);
  - không bao giờ che nút cột phải hay vùng chạm 44 px của chúng;
  - vẽ trên thanh trùm.
  Không tai thỏ thì số giống hệt trước.
- [ ] Không đổi `Game.ts`, server, shared, `toastQueue.ts`.
- [ ] `docs/design/hud.md` khớp với code (bảng bố cục, mục "Thanh máu trùm", mục "Vùng an toàn"). Dòng "Còn tồn tại …" đã bỏ.

## Rủi ro, câu hỏi mở

- **CDP `Emulation.setSafeAreaInsetsOverride` là lệnh thử nghiệm.** Container có Chrome 153 chạy được; CI dùng Chromium 141 của Playwright 1.56.1, không thử được ở đây (không được `playwright install`). Vì vậy đường dự phòng `page.route` là bắt buộc, không tuỳ chọn. Bước "kiểm vùng an toàn đã có tác dụng" bảo đảm test không âm thầm chạy mà không có tai thỏ.
- **Mức sát của số đo.**
  - Thông báo cầm ngang có tai thỏ kết thúc ở 246 so với mốc 250. Nếu font trên CI khác làm ô trạng thái xuống 3 dòng thì sẽ hỏng. Khi đó báo lại; **không** nới mốc.
  - Dọc 844 có tai thỏ: thông báo cuối cách tên mình 25 px, đủ rộng.
- **Trùm đi lang thang.** Thanh hiện khi cách ≤ 450 px, tính theo vị trí vẽ ở client. Đứng cách 260 px là còn dư. Nếu trùm đang trên đường về (`bossReturning`) thì dùng vị trí đọc lúc dịch chuyển; nếu thanh không hiện trong 30 s thì dịch chuyển lại một lần.
- **Thông báo "nóng" ở vùng núi lửa** có thể chen vào. Chúng ở mức thường, nên 2 thông báo mức cao vẫn thay được, hoặc chúng phải chờ. Bước "chờ hết thông báo" ở trên xử lý được.
- Không có "CHẶN:".

### Đề xuất tách việc (agent chính thêm vào `TASKS.md`)

1. **Điện thoại ngang thấp 375 px: thông báo quá mốc ngón cái** (P2). Ở 812×375 có tai thỏ 44 và 667×375, cột hẹp lại (252 và 212 px) làm ô trạng thái xuống 2 dòng. Thông báo kết thúc ở 246 và 260 px, quá mốc cao − 140 = 235. Hướng làm: ô trạng thái gọn hơn khi cầm ngang (bỏ `&nbsp;` thừa, nút 🔗 nhỏ lại), hoặc ẩn dòng gợi ý của ô nhiệm vụ khi cao ≤ 380. Thêm 812×375 có tai thỏ vào e2e `toasts`.
2. **Dọc 390×760: 2 thông báo đè tên mình 5 px** (P2, có từ T6). Chỉ ra chỗ sai là `TOAST.roomyPortraitPx = 760`: cột với 2 thông báo dài nhất kết thúc ở 327, tên mình bắt đầu ở cao/2 − 65, nên cần cao ≥ 2 × (327 + 65 + 2) ≈ 790. Đề xuất nâng lên 790 sau khi đo lại ở 360 và 390 rộng. Màn 360×640 thì cột đè tên mình cả khi chỉ có 1 thông báo: cân nhắc ẩn dòng "Thưởng" của ô nhiệm vụ khi cầm dọc và thấp.
