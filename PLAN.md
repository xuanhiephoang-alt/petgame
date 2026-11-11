# PLAN: T18 Nút cảm ứng dưới 44 px (sảnh, HUD, các bảng)

## Mục tiêu

- **Vấn đề:** quy ước của project là nút cảm ứng ≥ 44×44 px, nhưng đo thật (Playwright, Chromium 153, HEAD `449ae87`) thì **127/151 chỗ chạm ở 390×844, 128/151 ở 844×390, 127/148 ở 1280×720** nhỏ hơn 44 px (đa số là nút lặp trong bảng: 65 nút `.party-action`, 26 ô màu, 16 nút kiểu tóc). Người chơi điện thoại bấm trượt, nhất là nút trong bảng Thú và nút Bóng.
- Kèm theo các lỗi đo được trong lúc đo:
  - **Mọi bảng (Thú, Chế tạo, Tủ đồ) tràn đáy màn hình 8 px** (dọc, desktop) và **12 px** (ngang) khi nội dung dài: `max-height` tính theo content-box, quên `padding: 10px` hai đầu. Đây chính là "bảng Thú tràn 8 px khi có từ 7 thú". Hệ quả phụ: khi focus/cuộn tới nút cuối bảng, trình duyệt cuộn **cả trang** (html `overflow: hidden` vẫn cuộn được bằng code), cả game lệch lên 8-12 px và không về lại.
  - Hàng máu ở điện thoại ngang cao **52-87 px tuỳ chữ giờ** ("🌙 Đêm" ngắn: một dòng; "☀️ Ngày", "🌇 Hoàng hôn": 🔊 rơi xuống dòng 2 một mình). Nâng 🔊 lên 44 px theo cách cũ thì đáy thông báo 258 > giới hạn 250.
  - Khi cầm dọc, nút ⚪ Bóng nằm đúng chỗ ngón cái trái đặt cần điều khiển (x 105-240, y 696-724 ở 390×844); từ T39 nút thắng cần điều khiển, nên chạm vào đó là đổi bóng chứ không đi. Nút còn nghe `click`, nên ngón thứ hai không đổi bóng được khi đang chạy.
  - Tên trên thẻ thú ngắt giữa "Lv" và số ("★ Voltmouse · Lv" / "15").
- **Sau nhiệm vụ:** mọi chỗ chạm ở sảnh, HUD, bảng, hộp xác nhận có vùng chạm ≥ 44×44 ở cả 3 khung hình; không bảng nào tràn màn hình; bố cục HUD điện thoại ngang ổn định và thông báo vẫn trong giới hạn của T6; nút Bóng ở nửa phải, chạy khi ngón chạm xuống; e2e đo tất cả những điều này ở 2 khung hình điện thoại.

## Phạm vi

**Làm:**
1. `packages/client/index.html`: CSS (cỡ, vùng chạm vô hình, vị trí cột phải, bản đồ nhỏ, bảng, nút Bóng, sảnh).
2. `packages/client/src/ui/hud.ts`: nhóm Ăn + 🔊 trong một `div`, nút Bóng `onPress` + nhãn ngắn trên cảm ứng.
3. `packages/client/src/ui/party.ts`: class `pals-panel`, dấu cách không ngắt sau "Lv" (thẻ và tiêu đề hộp xác nhận).
4. `packages/client/src/main.ts`: cuộn dòng lỗi vào tầm nhìn khi vào phòng hỏng (một dòng).
5. `tests/e2e/multiplayer.spec.ts`: helper `touchTargets`/`expectTouchable`, 2 test mới (2 khung hình điện thoại).
6. `docs/architecture.md` (dòng `ui/`, mục helper e2e). `docs/design/hud.md` game-designer đã sửa trong nhiệm vụ này (mục mới "Cỡ chạm", bảng Bố cục, đoạn nút Bóng).

**KHÔNG làm:**
- Không lọc chuột phải/chuột giữa trong `onPress` (việc của **T40**; khi T40 thêm `if (e.button !== 0) return;` vào `onPress` thì nút Bóng tự được hưởng).
- Không đổi 🔗 Mời bạn và 🔊 sang `pointerdown` (giữ `click` theo T39).
- Không xử lý tai thỏ/safe-area (T30), không đổi thanh máu trùm (T30), không đổi `toastQueue`/`toastRoom` (T31).
- Không đổi bố cục thẻ thú trên desktop và điện thoại dọc ngoài cỡ nút (một cột, nút 44 px); không đổi bảng Chế tạo ngoài cỡ nút.
- Không đổi chữ hiển thị nào ngoài nhãn nút Bóng trên cảm ứng. Không đổi `aria-label` của nút "Thả" trên thẻ (test so khớp chính xác, giữ dấu cách thường).
- Không sửa test cũ, không nới giới hạn nào (`innerHeight − 140`, `width/2 − 100`), không thêm `waitForTimeout`, không đổi `playwright.config.ts`.
- Không đổi server, shared, schema, message, hồ sơ.

## Thiết kế

### 1. Đo trước khi sửa (HEAD `449ae87`)

Cách đo: server (`PETGAME_DEBUG=1`, DB `:memory:`) + Vite dev, script Playwright trong scratchpad. Mỗi phần tử bấm được (`button, a[href], input, .minimap, canvas.doll-preview`) đang hiện: hộp bao, `elementFromPoint` ở tâm (có bị che không), và **vùng chạm thật**: từ tâm dò từng px sang trái/phải/lên/xuống tới khi `elementFromPoint` không còn trả về chính nó (tính cả vùng `::before`, trừ phần bị che). Cảnh: sảnh (có ảnh búp bê), HUD có thú đi theo, bảng Thú 8 thú (có trại và 1 bánh nên mỗi thẻ 3 nút; 2 thú đầu đàn), chế độ Thả, hộp xác nhận, Chế tạo, Tủ đồ 4 tab (đủ đồ), bản đồ lớn.

Không có nút nào bị che ở tâm (trừ phần nằm dưới bản đồ lớn, đúng thiết kế). Các chỗ dưới 44 (rộng×cao, `index.html:dòng`):

| Phần tử | 390×844 | 844×390 | 1280×720 | CSS |
|---|---|---|---|---|
| `.style-btn` kiểu tóc (sảnh 8, Tủ đồ 8) | 61-85×34 | 61-85×34 | 61-85×34 | `:254`, sảnh `:343` |
| `.swatch` màu tóc/da (sảnh 13, Tủ đồ 13) | 32×32 | 32×32 | 32×32 | `:257` |
| `#name` ô tên | 340×45 (đạt) | **680×39** | 340×45 (đạt) | `:320`, ngang `:349` |
| `.sound-btn` 🔊 | 34×28 | 34×30 | 34×30 | `:63`, điện thoại `:357-358` |
| `.invite-btn` 🔗 Mời bạn | 88×21 | 88×21 | (không có) | `:116` |
| `.party-btn`, `.base-btn`, `.craft-btn`, `.wardrobe-btn` | 75-88×27 | 92-106×34 | 92-106×34 | `:140-142, :226-235`, điện thoại `:362-365` |
| `.ball-btn` | 135×28 (x 105-240, nửa trái) | 135×28 | 135×28 | `:266-270` |
| `.skill-auto` Tự động | 83×27 | 83×27 | 83×27 | `:304-305` |
| `.party-close` ✕ (Thú, Chế tạo, Tủ đồ) | 44×32 | 44×32 | 44×32 | `:151` |
| `.party-action` (Thú 24, Chế tạo 15, Tủ đồ 26) | 76-90×36 | 76-90×36 | 76-90×36 | `:219` |
| `.wardrobe-tab` | 77×34 | 82×34 | 77×34 | `:244` |
| `a` link mời (chỉ desktop không cảm ứng) | — | — | 349×17 | (miễn, mục 2) |

Đạt sẵn: `#join-btn`, `#reload-btn`, búp bê xem trước, 🫐 Ăn (46-54×44), Đánh/Bắt 76, 💨 60, ô chiêu 54/62, bản đồ nhỏ, 🕊️ Thả bớt, "Thả" trên thẻ, Giữ lại/Thả trong hộp, `.net-lobby` (CSS 44).

Bố cục khác đo được:
- Bảng (hộp ngoài): 390×844 top 172 + 660 + 20 = đáy **852**; 1280×720 188 + 520 + 20 = **728**; 844×390 8 + 374 + 20 = **402**. Tủ đồ ngang có `height` cố định nên **luôn** tràn 12 px.
- Thẻ thú (3 nút): cao 140 (tên 2 dòng: 160); cột nút 86×116; phần chữ rộng 143 px.
- Hàng máu (`.hud-health`) theo giờ: 390×844 luôn 72; 844×390: ngày/hoàng hôn/bình minh 87, đêm 52; 1280×720: 79. Thông báo dài nhất ở 844×390 đáy **244** (giới hạn 250).
- Sảnh: 390×844 vừa (cao nội dung 844 khi có gợi ý mời + dòng lỗi); 844×390 đã cuộn 36 px từ trước (dòng lỗi nằm dưới mép); 1280×720 vừa khít 720.

### 2. Quy tắc: ≥ 44 ở đâu

- **Mọi chỗ ngón tay chạm được, ở mọi khung hình, kể cả desktop.** Lý do: thiết bị cảm ứng cũng nhận CSS desktop (máy tính bảng ≥ 601 px, laptop cảm ứng: `isTouch` đúng nên có HUD cảm ứng nhưng bề rộng desktop). Làm riêng cỡ chuột thì phải đoán thiết bị trong CSS, dễ sai.
- Giá trên desktop nhỏ: các nút "viên thuốc" giữ nguyên hình nhờ vùng chạm vô hình; nút trong bảng cao thêm 8 px.
- **Ngoại lệ duy nhất:** link mời `<a>` trong ô trạng thái desktop. `hud.ts` chỉ vẽ nó khi `!isTouch` (không có màn hình cảm ứng); thiết bị cảm ứng có nút 🔗 thay thế.
- **Đo bằng vùng chạm thật, không bằng hộp bao:** vùng `::before` không nằm trong `getBoundingClientRect`, và một nút 44 px bị nút khác đè một nửa thì vẫn "44" theo hộp bao. Test dò `elementFromPoint` (mục Test).

### 3. Hai cách tăng vùng chạm

1. **Tăng cỡ thật** (`min-height`/`min-width`/`width`) khi có chỗ và hình không xấu đi: nút trong bảng, tab, ô màu, kiểu tóc, ô tên, 🔊, Tự động, nút Bóng, ✕.
2. **Vùng chạm vô hình** khi tăng cỡ làm vỡ bố cục gọn: 4 nút cột phải và 🔗 Mời bạn (nằm trong dòng chữ trạng thái). Một luật chung:
   ```css
   /* An invisible 44 px tall hit area centred on a small button (T18): the look stays, a finger gets 44 px. */
   .party-btn::before, .base-btn::before, .craft-btn::before, .wardrobe-btn::before, .invite-btn::before {
     content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 44px; margin-top: -22px; }
   ```
   - Nút phải có `position` (4 nút cột phải đã `absolute`; thêm `position: relative` cho `.invite-btn`).
   - Dùng `::before` vì `.wardrobe-btn.fresh::after` đã là chấm đỏ. Dùng `margin-top` chứ không `transform` (tránh lệch nửa px).
   - Không dùng cho nút có `overflow: hidden` (Ăn, ô chiêu: đã ≥ 44) hay nút trong bảng cuộn (bị cắt theo bảng).
   - **Hai vùng chạm không được chồng nhau**, nếu không nút sau trong DOM ăn phần chồng (mục 5).

### 4. Hàng máu: Ăn và 🔊 đi cùng nhau

- `hud.ts` bọc 🫐 Ăn và 🔊 trong `<div class="hud-actions">` (flex, **không** xuống dòng). Cặp nút luôn đi cùng nhau: không đủ chỗ trên dòng chữ thì cả cặp xuống dòng 2.
- 🔊 thành 44×44 (bỏ `min-height: 28px` của điện thoại).
- Kết quả đo (thử bằng CSS chèn vào trang thật, 4 chữ giờ ngày/hoàng hôn/đêm/bình minh):

  | Khung hình | Trước | Sau |
  |---|---|---|
  | 390×844 | 72 | 72 (mọi giờ) |
  | 844×390 | 52-87 | **72** (mọi giờ) |
  | 1280×720 | 79 | 79 (mọi giờ) |

  Đáy thông báo dài nhất ở 844×390: 244 → **229** (giới hạn 250). Cột trái vẫn kết thúc ở x 312 (giới hạn 322).
- Không ép xuống dòng bằng `flex-basis: 100%`: đã thử, desktop lúc hoàng hôn thành 3 dòng (104 px) vì chữ "100/100" phải xuống dòng riêng.

### 5. Cột nút phải: bước 48 px

- 4 nút cách nhau 44 px (dọc: 40 px) thì vùng chạm 44 px chạm sát nhau, đo được 43 ở `.base-btn` (lệch nửa px). Đổi **bước 48 px ở cả 3 khung hình**: top 12 / 60 / 108 / 156 (công thức `max(Npx, calc(env(safe-area-inset-top) + (N − 12)px))` như cũ). Giữa hai vùng chạm còn 4 px.
- Bỏ luật `top` riêng của điện thoại dọc (`:363-365`): dọc dùng chung top desktop; nút vẫn nhỏ hình (27 px) như cũ.
- Vùng chạm thấp nhất (Tủ đồ): dọc tới y 191,5; desktop/ngang tới 195. Vì vậy:
  - **Bản đồ nhỏ:** desktop `top: max(204px, calc(env(safe-area-inset-top) + 192px))` (từ 190); dọc `max(196px, calc(env(safe-area-inset-top) + 184px))` (từ 174); ngang giữ (bên trái các nút).
  - **Bảng** (mở đè lên bản đồ, không được đè nút): desktop `top: 204px`, dọc `top: 196px`; ngang giữ `top: max(8px, …)`.
- Đã đo: với bảng đang mở, cả 4 nút vẫn đủ 44 ở 3 khung hình.

### 6. Bảng: không tràn màn hình

- `.party-panel { box-sizing: border-box; width: min(340px, calc(100vw - 24px)); }` (bề ngoài giữ 340 như cũ). `max-height` giờ tính cả padding, nên chừa đúng như ý định ban đầu:
  - desktop `top: 204px; max-height: calc(100% - 216px)` → đáy 708 (cách mép 12);
  - dọc `top: 196px; max-height: calc(100% - 208px)` → đáy 832;
  - ngang `max-height: calc(100% - 16px)` (giữ) → đáy 382; Tủ đồ ngang `width: min(490px, calc(100vw - 150px))` (bề ngoài giữ 490), `height` giữ.
- Hết tràn thì `scrollIntoView`/focus nút cuối bảng không còn cuộn cả trang (test kiểm `scrollTop` của trang = 0).

### 7. Thẻ thú: một cột khi dọc và desktop, hai cột khi ngang

So 5 cách bằng CSS chèn vào trang thật, 8 thú, mỗi thẻ 3 nút:

| Cách | 390×844 | 844×390 (bảng cao 374) | Ghi chú |
|---|---|---|---|
| Hiện tại (nút 36) | thẻ 140-160 | thẻ 140-160, tràn | nút nhỏ |
| A. Một cột, nút 44 | **160**, 3 thẻ trọn | 160, **1 thẻ trọn** | ngang quá cao |
| B. Hàng nút dưới chữ | 158-178 | 158-178, 1 thẻ trọn | không thấp hơn A |
| C. Ngang: bảng 490 + hàng nút dưới | | 138, 2 thẻ trọn | |
| **D. Ngang: bảng 490 + lưới 2 cột, nút thứ 3 trải 2 cột** | | **112-124, 2 thẻ trọn**, tên 1 dòng, phần chữ rộng 211-221 | chọn |

**Chọn A cho dọc và desktop, D cho ngang.**
- Dọc: bảng chỉ rộng 340 (màn 390), 2 cột nút (≥ 156 px) thì phần chữ còn ~50 px: không được. Chiều cao dư (bảng 636 px), một cột 44 px vẫn thấy 3 thẻ trọn.
- Ngang: bảng rộng 490 như Tủ đồ ngang đã làm (x 212-702), lưới 2 cột; khi có 3 nút ("Cho ăn 🥧" là nút thứ 3) thì nút cuối trải cả 2 cột, không để ô trống. Chế độ Thả (1 nút) vẫn 76×44, cột 2 rỗng rộng 0.
- Bảng ngang 490 đè phần phải cột HUD trái (x 212-312) khi mở, giống Tủ đồ hiện nay; Ăn, 🔊, 🔗 vẫn lộ (x ≤ 123). Thông báo (z 4) vẫn vẽ trên bảng.
- Desktop giữ một cột (thẻ 160, thấy 2 thẻ trọn trong bảng 504 px). Không cần bảng rộng hơn; ghi ở Rủi ro.
- Class mới `pals-panel` cho bảng Thú (bảng Chế tạo, Tủ đồ dùng chung `.party-panel`). Lưới chỉ áp cho `.party-buttons` (chỉ thẻ thú có), không cần `:has()`.

### 8. Tên thẻ: "Lv" không tách khỏi số

- Thẻ: `` `${species.name} · Lv ${entry.level}` ``. Tên dài thì ngắt trước "Lv": "★ Voltmouse ·" / "Lv 15". Không nối cả cụm bằng dấu không ngắt: "★ Voltmouse · Lv 15" (~160 px) dài hơn phần chữ dọc (143 px), sẽ tràn sang cột nút.
- Tiêu đề hộp xác nhận cũng vậy: `` `Thả ${…name} · Lv ${entry.level}?` ``.
- **Không đổi** `aria-label` của nút "Thả" (test so khớp chính xác `"Thả Voltmouse đầu đàn · Lv 15"`).
- Test cũ `toHaveText("★ Voltmouse · Lv 15")`, `toContainText("Thả Pebblet · Lv 2?")` vẫn qua: Playwright gộp `\s+` (gồm U+00A0) thành một dấu cách (`playwright-core/lib/utils/isomorphic/stringUtils.js`, `normalizeWhiteSpace`).
- Đo: dải chữ từ "Lv" tới hết nằm trên đúng 1 dòng ở cả 3 khung hình.

### 9. Nút Bóng: `pointerdown`, sang nửa phải, nhãn ngắn trên cảm ứng

- **`pointerdown`:** `this.ballButton.addEventListener("click", …)` thành `onPress(this.ballButton, actions.toggleBall)`, như Đánh/Bắt/💨/Ăn. Ngón thứ hai đổi được bóng khi ngón kia đang giữ cần điều khiển. Hệ quả giống T39: Enter trên nút đang có focus không còn đổi bóng (bàn phím dùng R). Chuột phải: để T40.
- **Vị trí (cảm ứng, cả dọc lẫn ngang):** `.ball-btn.touch { right: max(104px, calc(env(safe-area-inset-right) + 104px)); bottom: 120px; }` (từ `right: 150px`): sát bên trái nút Bắt (cách hộp bao 4 px; Bắt tròn nên khe thật 4-19 px), trên nút Đánh 16 px, dưới hàng chiêu dọc 20 px. Một luật cho cả hai chiều.
  - 390×844: x 186-286, y 680-724 (tâm x 236, nửa phải bắt đầu ở 195). 844×390: x 640-740, y 226-270.
  - **Lý do dời:** chỗ cũ (x 105-240) là nơi ngón cái trái đặt cần điều khiển; từ T39 nút thắng cần điều khiển nên chạm nhầm là đổi bóng. Chọn bóng gắn với việc ném, ngón phải đã ở cạnh nút Bắt.
  - Đã loại: trên hàng chiêu (y ~500, ngón cái với không tới), giữ nhãn đầy đủ 135 px (lấn nửa trái tới x 151).
- **Nhãn trên cảm ứng:** "⚪ Thường" (100 px) / "🔵 Xịn (N)" (88-96 px), để nút nằm trong nửa phải. `aria-label` luôn là tên đầy đủ "⚪ Bóng thường" / "🔵 Bóng xịn (N)". Desktop giữ chữ cũ (test "crafting" kiểm `"🔵 Bóng xịn (1)"` trên desktop), nút cao 44 ở góc phải dưới như cũ.
- Cao 44 ở mọi khung hình (`min-height: 44px`).

### 10. Sảnh

- `#lobby input, #join-btn { …; min-height: 44px; box-sizing: border-box; }` (gộp `:320-321`): ô tên ngang 39 → 44.
- `.style-btn { min-height: 44px }`, `.swatch { width: 44px; height: 44px }` (dùng chung với Tủ đồ). Màu tóc (8) xuống 2 hàng 6+2 trong khung 340 px: không tránh được (8 ô × 44 = 352 > 340).
- Sảnh cao thêm, nên:
  - **Desktop/máy tính bảng** (`min-width: 601px`): form `width: min(420px, 92vw)` để 8 màu tóc vừa một hàng. Đặt **trước** luật ngang (`:345`) để luật ngang (680) thắng.
  - **Điện thoại dọc thấp** (`max-width: 600px and max-height: 760px`, cùng mốc 760 của T6, ví dụ Safari iPhone có thanh công cụ 390×664): form `gap: 8px; padding: 8px 0`, búp bê `zoom: 0.8` (112×144). CSS không đè được cỡ inline do `DollPreview` đặt, `zoom` thì được, không cần sửa JS.
  - **Điện thoại ngang** (luật `:345`): form thành lưới 2 cột `1fr 200px`, ô tên và "Vào chơi" chung một hàng, mọi phần khác trải 2 cột. Không đổi markup (T15 ẩn từng phần tử bằng `hidden` vẫn đúng).
  - `main.ts`: sau khi ghi chữ lỗi vào `#join-error`, `errorBox.scrollIntoView({ block: "nearest" })`, để dòng lỗi luôn hiện kể cả khi sảnh phải cuộn.
- Đo (có gợi ý mời và dòng lỗi 2 dòng, sau khi cuộn tới dòng lỗi):

  | Khung hình | Cao nội dung trước → sau | "Vào chơi" vẫn trong màn hình |
  |---|---|---|
  | 390×844 | 844 → 844 (vừa) | có |
  | 1280×720 | 720 → 740 | có |
  | 844×390 | 426 → 423 | có |
  | 390×664, 375×667, 360×640 | 696 → 718 | có |

  Trang không bao giờ cuộn (`scrollingElement.scrollTop` 0). Lúc mở trang (chưa cuộn), "Vào chơi" trọn trong màn hình ở mọi cỡ trên trừ 360×640 có link mời: thiếu 5 px đáy (vẫn bấm được).

### 11. Còn lại

- `.skill-auto { min-height: 44px }`: ngang và desktop nằm gọn trong hàng chiêu (54/62); dọc hàng "Tự động" cao thêm 17 px về phía trên (y 556-600).
- `.party-close { width: 44px; height: 44px }`: tiêu đề Chế tạo, Tủ đồ cao thêm 12 px (tiêu đề Thú đã 44 nhờ nút Thả bớt).
- `.party-action { min-height: 44px }`; bỏ `min-height: 44px` thừa ở `.party-action.release` (`:157`).
- `.wardrobe-tab { min-height: 44px }`. Danh sách Tủ đồ tab Ngoại hình cuộn thêm (ngang: vùng 252 px, nội dung 320): chấp nhận.

### 12. Kết quả thử (CSS + DOM chèn vào trang thật, cả 3 khung hình)

Với đúng các luật ở trên: **0 chỗ chạm dưới 44** trong sảnh (24), HUD (16; desktop 13 trừ link miễn), bảng Thú (26), chế độ Thả (10), hộp xác nhận (2), Chế tạo (16), Tủ đồ 4 tab (14-27). Mọi bảng nằm trọn màn hình, trang không cuộn. Ảnh trước/sau trong scratchpad của phiên (`t18/out`, `t18/proto3`), có thể đã mất; tester chụp lại.

## Kế hoạch triển khai

Một vòng coder (khoảng 120 dòng CSS/TS + 1 helper và 1 test e2e lặp 2 khung hình). Không cần tách.

1. **`packages/client/index.html` (CSS)**, mỗi khối đổi có chú thích tiếng Anh ngắn nói T18 và lý do:
   - a. `:63` `.sound-btn`: `min-width: 44px; min-height: 44px` (thay 34/30). Xoá `:358` (`.sound-btn { min-height: 28px; }`). Giữ `:357` (padding, cỡ chữ).
   - b. Thêm `.hud-actions { display: flex; align-items: center; gap: inherit; }` cạnh `.hud-health` (`:78-80`); chú thích: Ăn và 🔊 xuống dòng cùng nhau (mục 4).
   - c. `:116` `.invite-btn`: thêm `position: relative`. Thêm luật `::before` chung ở mục 3 (đặt sau `.wardrobe-btn`, `:233-237`).
   - d. Cột phải: `.base-btn` top `max(60px, calc(env(safe-area-inset-top) + 48px))`, `.craft-btn` `max(108px, … + 96px)`, `.wardrobe-btn` `max(156px, … + 144px)` (`:226, :230, :233`); xoá 3 dòng top của điện thoại `:363-365`.
   - e. `.minimap` (`:111`) top `max(204px, calc(env(safe-area-inset-top) + 192px))`; điện thoại `:366` top `max(196px, calc(env(safe-area-inset-top) + 184px))`.
   - f. `.party-panel` (`:145-147`): `top: 204px; width: min(340px, calc(100vw - 24px)); max-height: calc(100% - 216px); box-sizing: border-box;`. Điện thoại `:367`: `top: 196px; max-height: calc(100% - 208px)`. Ngang `:391` giữ. Ngang `:392` `.wardrobe-panel` width `min(490px, calc(100vw - 150px))`.
   - g. Trong khối ngang (`:372-397`), thêm:
     ```css
     /* The party panel as wide as the wardrobe's, its buttons in two columns (a third one across both): cards stay
        about 120 px tall, so two fit in the 374 px panel (T18). */
     .pals-panel { width: min(490px, calc(100vw - 150px)); }
     .party-buttons { display: grid; grid-template-columns: repeat(2, auto); }
     .party-buttons > :nth-child(3):last-child { grid-column: 1 / -1; }
     ```
   - h. `:151` `.party-close` `width: 44px; height: 44px`. `:219` `.party-action` `min-height: 44px` (từ 36). `:157` bỏ `min-height` (giữ màu).
   - i. `:244` `.wardrobe-tab` `min-height: 44px`. `:254` `.style-btn` `min-height: 44px`. `:257` `.swatch` `width: 44px; height: 44px`. Giữ `:343` (padding sảnh).
   - j. `:266` `.ball-btn` thêm `min-height: 44px`; `:270` `.ball-btn.touch { right: max(104px, calc(env(safe-area-inset-right) + 104px)); bottom: 120px; }`.
   - k. `:304` `.skill-auto` thêm `min-height: 44px`.
   - l. Sảnh: `:320` gộp thành `#lobby input, #join-btn { font-size: 18px; padding: 12px; border-radius: 8px; border: none; min-height: 44px; box-sizing: border-box; }`, bỏ hai thuộc tính trùng ở `:321`. Ngay sau `:318`: `@media (min-width: 601px) { #lobby form { width: min(420px, 92vw); } }`. Thêm `@media (max-width: 600px) and (max-height: 760px) { #lobby form { gap: 8px; padding: 8px 0; } .lobby-look .doll-preview { zoom: 0.8; } }`. Trong khối `:345-350` thêm:
     ```css
     #lobby form { display: grid; grid-template-columns: 1fr 200px; column-gap: 8px; }  /* gộp vào luật form đã có */
     #lobby form > * { grid-column: 1 / -1; }
     #lobby form > #name { grid-column: 1; }
     #lobby form > #join-btn { grid-column: 2; }
     ```
2. **`packages/client/src/ui/hud.ts`**
   - `:48-60`: tạo `const actionsRow = div("hud-actions")`, append Ăn và 🔊 vào đó, rồi `this.health.append(actionsRow)` (thay hai lần `this.health.append`). Chú thích: hai nút đi cùng nhau, nên hàng máu ngang luôn 2 dòng (đáy thông báo, T6).
   - `:87`: `onPress(this.ballButton, actions.toggleBall)`; sửa chú thích JSDoc của `onPress` nếu cần (nó đã nói đúng).
   - `setBall` (`:164-169`):
     ```ts
     setBall(great: boolean, greatCount: number) {
       const name = great ? `🔵 Bóng xịn (${greatCount})` : "⚪ Bóng thường";
       // Touch screens: a short label, so the button fits left of Bắt in the right half (T18); the full name is read out.
       const text = !this.isTouch ? name : great ? `🔵 Xịn (${greatCount})` : "⚪ Thường";
       if (this.ballButton.textContent === text) return;
       this.ballButton.textContent = text;
       this.ballButton.setAttribute("aria-label", name);
       this.ballButton.classList.toggle("great", great);
     }
     ```
3. **`packages/client/src/ui/party.ts`**
   - `:91` `this.panel.className = "party-panel pals-panel";`.
   - `:277` `name.append(\`${species.name} · Lv ${entry.level}\`);` kèm chú thích: no-break space, so a long name wraps before "Lv", never between it and the number.
   - `:339` tiêu đề hộp: `` `Thả ${getSpecies(entry.speciesId).name} · Lv ${entry.level}?` ``.
   - Không đổi `:312` (`aria-label`).
4. **`packages/client/src/main.ts`** `:71`: sau dòng ghi `errorBox.textContent`, thêm `errorBox.scrollIntoView({ block: "nearest" });` với chú thích: the lobby may scroll on short screens; the reason must show.
5. **`tests/e2e/multiplayer.spec.ts`**: helper và test ở mục Test (đặt sau test `touch (...)` của T39, `:407`).
6. **`docs/architecture.md`**: dòng `ui/` thêm: cỡ chạm ≥ 44 ở mọi khung hình, vùng chạm vô hình `::before` cho nút nhỏ hình, nút Bóng `onPress`, luật ở `docs/design/hud.md` mục "Cỡ chạm"; mục helper e2e thêm `touchTargets`/`expectTouchable`.
7. **Tự kiểm của coder:** `npm run typecheck`, `npm test`, `npm run build`; `npx playwright test -g "touch" --workers=1`; ghi `PROGRESS.md`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, server. Hợp đồng mới trong client: class `.hud-actions`, `.pals-panel`; nút Bóng nghe `pointerdown` (qua `onPress`) và có `aria-label`.

## Test

- **Unit / tích hợp server:** không có (chỉ CSS và DOM của client).
- **E2E mới** (`tests/e2e/multiplayer.spec.ts`):
  - Helper (JSDoc tiếng Anh):
    ```ts
    /**
     * Every touch target a finger can reach under `scope` (buttons, links, inputs, the minimap, the explorer preview) and
     * its hit area: how far from its centre, left-right and up-down, a tap still lands on it (`elementFromPoint`), so an
     * invisible hit area (::before) counts and whatever lies on top does not. A target in a scrolling panel or the lobby
     * is scrolled into view inside it first ("nearest": a panel that fits the screen never scrolls the page).
     */
    const touchTargets = (page: Page, scope: string) => page.evaluate((scope) => { … }, scope);
    ```
    Trả về `{ targets: { name, text, box, onTop, under, hit: { width, height } }[], scrolled: document.scrollingElement!.scrollTop, width, height }`. Thân hàm như bản đã chạy thử (`touchTargets` trong `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t18/proto3.mjs`, nếu còn):
    - lấy `querySelectorAll("button, a[href], input, .minimap, canvas.doll-preview")` dưới `scope`, bỏ phần tử không `checkVisibility({ checkVisibilityCSS: true })`;
    - phần tử trong `.party-panel, #lobby` thì `scrollIntoView({ block: "nearest", inline: "nearest" })` trước khi đo;
    - tâm làm tròn; `onTop` = `elementFromPoint` ở tâm là nó hoặc con của nó;
    - `hit.width` = số px liên tiếp sang trái + sang phải + 1 (dừng ở mép màn hình, tối đa 60 mỗi phía); `hit.height` tương tự; không `onTop` thì 0×0;
    - `name`: `#id` hoặc class đầu tiên hoặc tên thẻ.

    ```ts
    /** Checks every touch target under `scope` takes a 44×44 px tap and the page itself did not scroll; returns the target names. */
    async function expectTouchable(page: Page, scope: string, where: string): Promise<string[]>
    ```
    Kiểm: có ít nhất 1 target; danh sách `hit.width < 44 || hit.height < 44` (in `name "text" WxH under X`) bằng `[]`; `scrolled` bằng 0.
  - **Test** `touch targets (${screen.name}): every button in the lobby, the HUD, the panels and the dialog takes a 44×44 px tap; the party panel fits with 8 pals`, lặp `PHONE_SCREENS`, `test.slow()`:
    1. `openPage(browser, "/", "Ngón to", { ...screen.options })`; chờ `#join-btn:enabled` và `.lobby-look:not([hidden]) .doll-preview`. `expectTouchable(page, "#lobby", "lobby")`, tên gồm `.style-btn`, `.swatch`, `#name`, `#join-btn`.
    2. `enterLobby`, `waitForWorld`, chờ `frames > 0`.
    3. Dựng cảnh (hook debug, tất định): `debug:give` 2 lần; `placeBase` → poll `hasBase`; `craft` `berry_snack` và `great_ball` → poll `snacks ≥ 1`, `greatBalls ≥ 1`; `debug:givePal` theo thứ tự leafkit 3, emberpup 8, bubbloon 7, pebblet 11, ripplefin 5, frostfang 19 `alpha`, scorchtail 22, voltmouse 15 `alpha` (con cuối đi theo) → poll 8 thú; `assign` con thứ 2 `work`. Chờ `.skill-bar` hiện và `.hud-quest` có chữ.
    4. HUD: `expectTouchable(page, ".hud", "HUD")`; tên gồm `.eat-btn .sound-btn .invite-btn .ball-btn .party-btn .base-btn .craft-btn .wardrobe-btn .action-btn .skill-btn .skill-auto .minimap`. Tâm nút Bóng ≥ `innerWidth / 2`; chữ `"⚪ Thường"`, `aria-label` `"⚪ Bóng thường"`.
    5. Bóng bằng ngón thứ hai: `fingers(page)`; ngón 0 giữ chỗ trống nửa trái (như test T39: W/4, 0,75H); ngón 1 chạm tâm nút Bóng rồi nhấc; nhấc hết. Chữ thành `"🔵 Xịn (1)"`.
    6. Bảng Thú: `.party-btn` `tap()`; `expectTouchable(page, ".pals-panel", "party panel")`. Rồi trong trang: hộp bảng nằm trọn màn hình (`top ≥ 0`, `left ≥ 0`, `bottom ≤ innerHeight`, `right ≤ innerWidth`); `scrollWidth ≤ clientWidth`; mọi `.party-card` có `right ≤` mép phải bảng; mọi tên thẻ: `Range` từ "Lv" tới hết chữ có client rect trên **1** dòng; thẻ cao nhất ≤ **136** khi ngang (đo 124; một cột thì 160 sẽ hỏng) và ≤ **176** khi dọc (đo 160); khi ngang ít nhất 2 thẻ trọn trong bảng ở đầu danh sách. Thẻ đầu đàn: `toHaveText("★ Voltmouse · Lv 15")`.
    7. Chế độ Thả: tap `.party-release-toggle`; `expectTouchable(…, "release mode")`. Tap "Thả" trên thẻ `.alpha` đầu tiên; `expectTouchable(page, ".party-confirm", "release dialog")`; tap `.confirm-keep`; tap toggle; tap `.pals-panel .party-close`; bảng ẩn.
    8. Chế tạo: tap `.craft-btn`; `expectTouchable(page, ".craft-panel", "crafting")`; hộp bảng trọn màn hình; tap ✕.
    9. Tủ đồ: `debug:wardrobe`; tap `.wardrobe-btn`; với mỗi tab `look, outfit, hat, weapon`: tap tab, `expectTouchable(page, ".wardrobe-panel", \`wardrobe ${tab}\`)`, hộp bảng trọn màn hình; tap ✕.
  - Không `waitForTimeout`; chỉ poll và chờ locator.
- **Test cũ phải qua, không sửa:** `touch (phone upright|sideways)` (T39: nút Bóng không còn ở nửa trái khi dọc, danh sách bắt buộc chỉ có Ăn/🔊/🔗), `toasts (desktop|phone upright|phone sideways)` (ngang: đáy ≤ 250, cột ≤ 322), `eating:`, `HUD shows health…`, `crafting at the camp…` (chữ desktop `"🔵 Bóng xịn (1)"`), `explorer:`, `pack leaders: a caught leader…`, `party:` (3 test), `levels:`, `lobby:` (3 test), `labels:`.
- **Lệnh cho tester** (tắt server dev trước): `npm run typecheck`, `npm test`, `npm run build`; `npx playwright test -g "touch" --repeat-each=3 --workers=1`; `npx playwright test -g "toasts" --workers=1`; `npm run test:e2e` một lần.
- **Kiểm chứng test bắt được lỗi** (không commit, đổi file **trước** khi bật e2e, trả lại rồi kiểm `git diff`): (a) trả `.party-action` về `min-height: 36px`: test mới hỏng ở bảng Thú; (b) bỏ `box-sizing: border-box` của `.party-panel`: hỏng ở "trọn màn hình"/`scrolled`; (c) bỏ luật `::before`: hỏng ở HUD (cột phải); (d) bỏ luật lưới 2 cột ở khối ngang: test ngang hỏng ở chiều cao thẻ.
- **Ảnh trước/sau** (tester, script tạm trong scratchpad, không commit): sảnh, HUD có thú, bảng Thú 8 thú, chế độ Thả, hộp xác nhận, Chế tạo, Tủ đồ tab Ngoại hình, ở 390×844, 844×390, 1280×720; thêm sảnh 390×664 có `?room=`. Xem: không vỡ bố cục, nút Bóng cạnh Bắt, hàng máu 2 dòng, bảng không tràn.

## Tiêu chí hoàn thành

- [ ] CSS đúng mục 1 của Kế hoạch: mọi luật ở Thiết kế 3-11 có mặt; không còn `.sound-btn { min-height: 28px }` và top riêng của 3 nút cột phải khi dọc.
- [ ] `hud.ts`: `.hud-actions` chứa Ăn và 🔊; nút Bóng dùng `onPress`, không còn bộ nghe `click`; `setBall` đúng nhãn ngắn trên cảm ứng, chữ cũ trên desktop, `aria-label` đầy đủ. 🔗 và 🔊 vẫn `click`.
- [ ] `party.ts`: `pals-panel`; `Lv ` ở tên thẻ và tiêu đề hộp; `aria-label` nút Thả không đổi.
- [ ] `main.ts`: `scrollIntoView` dòng lỗi.
- [ ] E2E mới qua ở cả 2 khung hình điện thoại, `--repeat-each=3` qua 6/6; mọi test cũ qua không sửa; cả bộ `npm run test:e2e` qua.
- [ ] Số đo sau (tester ghi `PROGRESS.md`): 0 chỗ chạm dưới 44 ở 390×844, 844×390 (theo test) và 1280×720 (trừ link mời desktop, đo bằng script); đáy thông báo ngang ≤ 250 (dự kiến 229); bảng nằm trọn màn hình ở 3 khung hình.
- [ ] 4 kiểm chứng "test bắt được lỗi" đã làm; ảnh trước/sau đã xem.
- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch.
- [ ] `docs/architecture.md` cập nhật theo bước 6; `docs/design/hud.md` khớp với code (coder sửa nếu số đổi khi làm).

## Rủi ro, câu hỏi mở

Không có CHẶN.

- **Chỉ đo trên Chromium.** Safari: `zoom` hỗ trợ; vùng `::before` nhận chạm như phần tử. Firefox < 126 bỏ qua `zoom`: búp bê sảnh to như cũ, sảnh dọc thấp phải cuộn thêm 36 px; không hỏng gì.
- **Phông chữ khác** (CI dùng Chromium của Playwright, iOS dùng phông hệ thống) làm thẻ cao/thấp vài px: ngưỡng test có biên ~10%. Hàng máu ngang có thể vừa một dòng lúc đêm trên phông hẹp (thấp hơn, chỉ có lợi cho giới hạn thông báo).
- **Nhãn "⚪ Thường"/"🔵 Xịn (N)"** ngắn hơn trước; tên đầy đủ vẫn ở `aria-label`. Nếu người chơi thử thấy khó hiểu thì đổi chữ, vị trí giữ nguyên.
- **Bảng Thú ngang 490 px** đè phần phải cột HUD trái khi mở (như Tủ đồ). Thông báo vẫn vẽ trên bảng.
- **Desktop thẻ thú 160 px** (trước 140): thấy 2 thẻ trọn thay vì 3. Nếu thấy phiền thì dùng cách D cho desktop (bảng 420, 2 cột: thẻ ~140); không làm ở đây.
- **Sảnh 360×640 có link mời:** "Vào chơi" thiếu 5 px đáy lúc mở (vẫn bấm được, cuộn được).
- **Tai thỏ (T30):** bảng dọc dùng `top: 196px` cố định như trước dùng 172; với `safe-area-inset-top` ~47 px nút Tủ đồ dịch xuống và bảng có thể đè đáy nó. Có từ trước, ghi cho T30.
- **T40:** khi thêm `e.button !== 0` vào `onPress`, nút Bóng tự được lọc; e2e nhỏ của T40 nên gồm nút Bóng.

## Đề xuất việc mới cho `TASKS.md`

- **Ghi chú cho T30:** bảng (`.party-panel`) khi dọc và bản đồ nhỏ dùng top cố định 196, chưa cộng `env(safe-area-inset-top)` như cột nút phải; trên iPhone có tai thỏ bảng có thể đè nút Tủ đồ.
- **Ghi chú cho T40:** gồm nút Bóng (giờ cũng qua `onPress`) trong e2e chuột phải.
- **Ghi chú cho T20:** test cũ dùng `.party-panel:has(.party-release-toggle)` có thể đổi sang `.pals-panel`.
