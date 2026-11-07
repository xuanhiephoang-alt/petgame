# PLAN: T39 Trên điện thoại, vùng joystick che nút ở cột trái; nút "Ăn" chạy theo `pointerdown`

## Mục tiêu

- **Vấn đề** (đo ở HEAD `6b64730`, mục Thiết kế 1):
  - Trên điện thoại, chạm 🔊 hay 🔗 Mời bạn là bật cần điều khiển chứ không bấm nút, cả khi cầm dọc lẫn cầm ngang.
    - Người chơi điện thoại không tắt được tiếng.
    - Họ cũng không mời bạn được: trên điện thoại ô trạng thái chỉ có nút mời, không có link.
  - **Phát hiện thêm khi lập kế hoạch:** khi cầm dọc (390×844), nút ⚪ Bóng thường / 🔵 Bóng xịn cũng bị che (tâm nút ở x 172, nửa trái là 0-195), nên không đổi được loại bóng.
  - Nút 🫐 Ăn nghe `click`, mà trên điện thoại ngón thứ hai chạm vào nút không sinh `click`. Vì vậy khi đang giữ cần điều khiển để chạy né, chạm Ăn bằng ngón kia **không ăn được**, đúng lúc cần ăn nhất (đo được, mục Thiết kế 1).
- **Sau nhiệm vụ:**
  - Mọi nút ở nửa trái màn hình chạm được: 🫐 Ăn, 🔊, 🔗 Mời bạn, nút Bóng.
  - Chạm chỗ không phải nút trong nửa trái vẫn bật cần điều khiển như trước, kể cả trên các ô của cột trái. Nhờ vậy cần điều khiển vẫn bật được trên 96% nửa trái.
  - Kéo cần điều khiển qua nút không bấm nút.
  - Ăn được bằng ngón thứ hai trong lúc ngón kia giữ cần điều khiển. Chuột và phím H vẫn như cũ.
  - Desktop không đổi gì.

## Phạm vi

Làm:
- CSS (`packages/client/index.html`):
  - `.joystick-zone` thành lớp dưới cùng của HUD (`z-index: -1`);
  - trên cảm ứng, các ô của cột trái cho chạm xuyên xuống nó, chỉ nút trong cột nhận chạm;
  - bỏ `z-index: 1` riêng của nút Ăn, sửa chú thích CSS của nút.
- `hud.ts`:
  - HUD có lớp `touch` khi dùng cảm ứng;
  - nút Ăn nghe `pointerdown` qua một hàm dùng chung với các nút Đánh, Bắt, 💨.
- JSDoc của `joystick.ts`.
- E2E:
  - 2 test mới `touch (phone upright|phone sideways)`;
  - sửa một bước của test "eating:" (T32) cho đúng đường `pointerdown`.
- `docs/architecture.md`.
- Tài liệu thiết kế đã cập nhật trong lúc lập kế hoạch, coder không cần sửa: `docs/design/hud.md`, gồm
  - mục mới "Cần điều khiển và nút cảm ứng";
  - dòng "Lớp vẽ";
  - bảng Bố cục;
  - mục "Nút 🫐 Ăn";
  - bỏ dòng "còn tồn tại" về vùng cần điều khiển.

KHÔNG làm:
- **Không đổi cỡ hay vị trí nút nào.** Đó là việc của T18. Sau nhiệm vụ này các nút vẫn giữ cỡ cũ:
  - 🔊: 34×28 khi cầm dọc, 34×30 khi cầm ngang;
  - 🔗 Mời bạn: 88×21;
  - nút Bóng: cao 28.
- **Không đổi bố cục:** không đổi `display`, kích thước, khoảng cách, thứ tự. Thông báo không dời một pixel nào, nên 3 test bố cục toasts giữ nguyên.
- **Không chuyển nút nào khác sang `pointerdown`:**
  - 🔗 Mời bạn phải giữ `click` (mục Thiết kế 4);
  - 🔊, nút Bóng, nút mở bảng và nút trong bảng giữ `click`. Nút Bóng là đề xuất việc riêng ở cuối.
- **Không sửa logic của `joystick.ts`:** giữ `setPointerCapture`, giữ vị trí `.joystick-base` (vẫn là con của vùng).
- **Không đụng `Game.ts`** (`Game.eat()` giữ nguyên), server, shared, schema, message, `Profile`.
- **Không gom `skillbar.ts`** vào hàm dùng chung mới; file đó giữ code `pointerdown` riêng của nó.
- **Không thêm** hook `debug:*`, không thêm chữ hiển thị mới, không đổi `user-select`.

## Thiết kế

### 1. Hiện trạng (HEAD `6b64730`)

**Thứ tự lớp.**
- `.hud` (`index.html:77`) là `position: absolute; z-index: 2; pointer-events: none`, nên tạo lớp xếp chồng riêng.
- Con trực tiếp của nó, theo thứ tự được gắn vào DOM:
  - `hud.ts:62` `.boss-bar`;
  - `:66` `.hud-left`;
  - `:80` `.base-btn`;
  - `:85` `.ball-btn`;
  - `:88` `.joystick-zone` (chỉ khi cảm ứng);
  - `:89` Đánh, Bắt, 💨;
  - rồi `Game.ts:286-304`: bảng Thú (z 3), thanh chiêu, bản đồ nhỏ, bảng Chế tạo và Tủ đồ (z 3).
- `.joystick-zone` (`index.html:128`) là `position: absolute`, nửa trái, z-index auto, `pointer-events: auto`.
- `.hud-left` (`:100`) cũng z-index auto và không tạo lớp riêng. Ba ô của nó đặt `pointer-events: auto`:
  - `.hud-health` (`:78-80`);
  - `.hud-status` (`:102-104`);
  - `.hud-quest` (`:105-106`).
- `.hud-toasts` (`:119-120`) là z 4 và `pointer-events: none`.
- Các phần tử định vị cùng z auto được vẽ theo thứ tự DOM. Vì vậy vùng cần điều khiển (gắn sau) nằm trên `.hud-left`, `.base-btn`, `.ball-btn`, và `elementFromPoint` trả về vùng trước. Phần gắn sau vùng (Đánh, Bắt, 💨, thanh chiêu, bản đồ) và các lớp z 3-6 thì nằm trên vùng.
- **T32 nâng riêng nút Ăn** bằng `position: relative; z-index: 1` (`index.html:93`). Nút có z dương trong lớp của `.hud` nên thoát lên trên vùng. Các nút khác trong cột thì không được nâng.

**Bộ nghe chạm.**
- `pointerdown` + `preventDefault()`:
  - Đánh, Bắt, 💨 (`hud.ts:239-242`);
  - ô chiêu và Tự động (`skillbar.ts:50-53, 59-62`).
- `click`:
  - Ăn (`hud.ts:52`);
  - 🔊 (`:57`);
  - 🔗 Mời bạn: `click` gắn trên `.hud-status`, dò ra nút bằng `closest` (`:68-74`);
  - nút Bóng (`:84`) và các nút bảng.
- Vùng cần điều khiển nghe `pointerdown` và giữ ngón bằng `setPointerCapture` (`joystick.ts:24-33`).

**Cách đo.**
- Dựng game thật: server `PETGAME_DEBUG=1`, DB trong RAM, Vite.
- Dùng Playwright 1.56.1 với Chromium cài sẵn, trang `hasTouch`, `isMobile`. Script chỉ đọc, đặt trong scratchpad.
- Chạm thật bằng CDP `Input.dispatchTouchEvent`.
- Cách sửa được thử bằng CSS chèn vào trang lúc chạy, không đổi file nào.

**Nút ở nửa trái màn hình** (lúc đo, tâm nút trả về gì với `elementFromPoint`; cột cuối là kết quả `locator.tap()` của Playwright):

| Khung hình | Nút | Hộp: x, y, rộng×cao | Ở tâm nút | `tap()` |
|---|---|---|---|---|
| 390×844 | 🫐 Ăn | 20, 36, 46×44 | chính nút (z 1 của T32) | được |
| 390×844 | 🔊 | 71, 44, 34×28 | `joystick-zone` | hỏng: "`<div class="joystick-zone">` intercepts pointer events" |
| 390×844 | 🔗 Mời bạn | 24, 111, 88×21 | `joystick-zone` | hỏng (như trên) |
| 390×844 | ⚪ Bóng thường | 105, 696, 135×28 | `joystick-zone` | hỏng (như trên) |
| 844×390 | 🫐 Ăn | 214, 16, 54×44 | chính nút | được |
| 844×390 | 🔊 | 20, 65, 34×30 | `joystick-zone` | hỏng (như trên) |
| 844×390 | 🔗 Mời bạn | 204, 107, 88×21 | `joystick-zone` | hỏng (như trên) |
| 844×390 | ⚪ Bóng thường | ở nửa phải (x 569-694) | chính nút | được |

- **Các ô của cột** (hàng máu, trạng thái, nhiệm vụ): ở cả hai khung hình đều nằm dưới vùng, nên chạm vào ô là bật cần điều khiển.
- **Bảng và lớp phủ:** khi mở bảng Thú, Chế tạo, Tủ đồ (z 3), bản đồ phóng to (z 4) hay hộp thả thú (z 5), mọi nút của chúng ở nửa trái đều nằm trên vùng. Vùng không che nút nào của bảng, trước và sau khi sửa đều vậy.
- **Thanh chiêu:** ở 844×390, nút "Tự động" (x 385-468) chờm vào mép vùng nhưng được gắn sau vùng nên nằm trên.
- **Hai ngón:**
  - Ngón 1 giữ yên ở chỗ trống: (98, 633) khi dọc, (211, 293) khi ngang. Ngón 2 chạm tâm nút Ăn. Người chơi đang mất máu vì lạnh ở vùng tuyết.
  - Nút nhận `pointerdown` và `pointerup` (`isPrimary: false`) nhưng **không có `click`**. Không tin nào được gửi, quả vẫn 50 → 50, ở cả hai khung hình.
  - Thêm thử một bộ nghe `pointerdown` gọi `game.eat()`: tin `eat` được gửi, quả 50 → 49, nút hiện hồi chiêu.
  - Một ngón chạm Ăn thì có `click` như thường.
- **Kéo từ chỗ trống tới 🔊 rồi nhấc ngón trên 🔊:** chỉ vùng nhận sự kiện (nó giữ ngón), 🔊 không đổi, không gửi gì. Đúng cả trước lẫn sau khi sửa.

### 2. Cách sửa: vùng cần điều khiển là lớp dưới cùng của HUD; trên cảm ứng, các ô của cột cho chạm xuyên

Luật (đã ghi vào `docs/design/hud.md`, mục "Cần điều khiển và nút cảm ứng"):
1. `.joystick-zone { z-index: -1 }`.
   - Vùng nằm trong lớp xếp chồng của `.hud` (z 2), nên vẫn ở trên nhãn tên (z 1) và canvas.
   - Trong HUD, nó nằm dưới mọi thứ khác: chỉ nhận chạm mà không thứ gì khác nhận.
   - Mọi nút ở nửa trái tự nằm trên nó, kể cả nút thêm sau này, không cần nhớ tự nâng.
2. **Chỉ trên cảm ứng** (lớp `touch` trên `.hud`, đặt khi `isTouch`, đúng lúc vùng được tạo):
   - `.hud-health`, `.hud-status`, `.hud-quest` đặt `pointer-events: none`, chạm xuyên xuống vùng như thông báo vẫn làm;
   - nút trong `.hud-left` đặt `pointer-events: auto`.
   - Hệ quả, ghi trong chú thích CSS và `hud.md`: chỗ nhận chạm trong cột phải là `<button>`.
3. Bỏ `z-index: 1` của `.eat-btn`, vì nút đã nằm trên vùng như mọi nút khác.
   - Giữ `position: relative` (chỗ dựa của lớp tối `.eat-cd` và số giây `.eat-secs`) và `overflow: hidden`.
4. Kéo cần điều khiển không bấm nút: giữ nguyên `setPointerCapture` (đã đo, mục 1). Ngón chạm xuống trên nút thì bấm nút, vùng không nhận ngón đó.
5. Desktop: không có vùng cũng không có lớp `touch`, nên các ô giữ `pointer-events: auto`. Link mời trong ô trạng thái vẫn chọn và bấm được.

**Đo cách sửa** (CSS chèn lúc chạy; lưới 10 px trên nửa trái):

| | 390×844 | 844×390 | Mọi nút ở nửa trái nằm trên cùng tại tâm |
|---|---|---|---|
| HEAD | cần điều khiển bật được ở 99% nửa trái | 98% | không (🔊, 🔗, nút Bóng khi dọc) |
| Chỉ `z-index: -1`, các ô vẫn chặn chạm | 79% | 72% | có |
| **Chọn:** `z-index: -1` + ô cho chạm xuyên trên cảm ứng | **96%** | **96%** | **có** |

4% còn lại chính là các nút: Ăn, 🔊, 🔗, nút Bóng, mép nút Tự động.

Lý do chọn:
- Một quy tắc sửa mọi nút đang bị che, kể cả nút Bóng mà mô tả nhiệm vụ không nêu, và mọi nút sau này.
- Cần điều khiển gần như giữ nguyên chỗ bật như hiện nay (96% so với 98-99%). Nếu để các ô chặn chạm thì khi cầm ngang mất 26% nửa trái.
- Không đổi bố cục, nên không động tới thông báo hay test toasts. Desktop không đổi.

### 3. Nút 🫐 Ăn chạy theo `pointerdown`

- Nút nghe `pointerdown` + `preventDefault()`, đúng như Đánh, Bắt, 💨. Code dùng chung một hàm mới `onPress` trong `hud.ts`: `button()` cũng dùng hàm này, không lặp 4 dòng.
- Bỏ bộ nghe `click` của nút Ăn. **Không giữ cả hai:** một lần chạm sẽ chạy hai lần (`pointerdown` rồi `click`). Lần thứ hai có thể ra "Máu đang đầy" ngay sau khi vừa ăn đầy máu.
- Hành vi khi bấm không đổi:
  - `Game.eat()` vẫn kiểm `watch.online` rồi hồi chiêu;
  - đang hồi thì nút lắc (`refuseEat`), không gửi gì.
- Chuột: `pointerdown` cũng chạy với chuột, nên test desktop `.click()` (`multiplayer.spec.ts:238`) vẫn qua.
- Bàn phím: phím H như cũ.
- Enter trên nút Ăn đang được focus thì không còn ăn, giống các nút cảm ứng khác (bàn phím dùng phím tắt). `preventDefault()` trên `pointerdown` của chuột cũng giữ cho nút không lấy focus, như nút Đánh.

### 4. 🔊 và 🔗 Mời bạn giữ `click`

- **🔗 bắt buộc giữ `click`:**
  - `navigator.share()` và `navigator.clipboard.writeText()` cần "cử chỉ của người dùng" (user activation).
  - Theo chuẩn HTML, một lần chạm chỉ cho cử chỉ đó lúc ngón nhấc lên (`pointerup`/`touchend`), Safari cũng vậy.
  - Chuyển sang `pointerdown` thì trên điện thoại thật bảng chia sẻ có thể bị từ chối âm thầm.
  - Thêm một dòng chú thích ở chỗ gắn bộ nghe để không ai "sửa cho nhất quán".
- 🔊 không dùng lúc đang chạy, giữ nguyên.
- Đã đo với cách sửa: `tap()` vào 🔊 đổi 🔊 ↔ 🔇; `tap()` vào 🔗 gọi `navigator.share` với `{ title: "PetGame", text: "Vào chơi cùng mình!", url: <link mời> }`.

### 5. Không chọn

| Phương án | Vì sao không |
|---|---|
| Nâng từng nút (`z-index` cho 🔊, 🔗, nút Bóng, như T32 làm với nút Ăn) | Vùng vẫn đè lên mọi thứ gắn trước nó. Mỗi nút mới ở nửa trái phải nhớ tự nâng; chính vì vậy 🔊, 🔗, nút Bóng mới bị che. Lại thành hai cách làm song song |
| Chỉ `z-index: -1`, các ô vẫn chặn chạm | Cần điều khiển chỉ còn 79% nửa trái khi dọc, 72% khi ngang. Nhấn giữ trên chữ của ô sẽ bôi đen chữ trên điện thoại |
| Gắn vùng trước cột trong DOM (`prepend`) thay vì `z-index` | Phụ thuộc thứ tự tạo phần tử; `z-index: -1` nói thẳng ý định |
| `.hud:has(> .joystick-zone)` thay cho lớp `touch` | Giấu điều kiện trong CSS. Code đã có sẵn kiểu lớp `touch` (`.ball-btn.touch`, `.skill-bar.touch`) |
| Cho các ô chạm xuyên cả trên desktop | Desktop không có cần điều khiển, lại mất chọn và bấm link mời trong ô trạng thái |
| Đưa `.joystick-base` ra khỏi vùng để nó vẽ đè lên các ô | Thêm code cho một chi tiết hình nhỏ (mục Rủi ro) |
| Chuyển 🔊, 🔗 sang `pointerdown` | Mục 4 |
| Giữ cả `click` lẫn `pointerdown` cho nút Ăn (để Enter vẫn ăn) | Mục 3: một lần chạm thành hai lần ăn |

### 6. Chữ hiển thị

Không có chữ mới. Dòng hướng dẫn trên cảm ứng ("Kéo bên trái để đi • Đánh • Bắt • 💨 Lướt né") vẫn đúng.

## Kế hoạch triển khai

Số dòng theo HEAD `6b64730`. Chú thích code bằng tiếng Anh. Có thể làm theo thứ tự 6 → 1 (viết e2e trước, xem nó hỏng trên code cũ), xem bước 7.

1. **`packages/client/index.html` (CSS):**
   - Thay chú thích và rule `.eat-btn` (dòng 90-94) bằng đoạn dưới. Chỉ bỏ `z-index: 1`, còn lại giữ nguyên:

     ```css
     /* The Ăn button (T32): a 44 px touch target on every screen. Like the other touch buttons it acts on pointerdown
        (hud.ts), so it eats under a second finger while the first holds the joystick (T39). Recharging after a berry:
        a dark sweep that shrinks and the seconds left, like the skill buttons (position: relative holds them). */
     .eat-btn { position: relative; overflow: hidden; min-width: 44px; min-height: 44px; border: none; border-radius: 8px;
       padding: 4px 8px; font-weight: 600; background: #7e57c2; color: #fff; cursor: pointer; }
     ```

   - Thay dòng 128 (`.joystick-zone`) bằng đoạn dưới. Thêm `z-index: -1` và hai rule mới; vị trí và cỡ của vùng không đổi:

     ```css
     /* The joystick's half of the screen (touch only): the HUD's bottom layer (T39), so it gets only the touches nothing
        else in the HUD takes and covers no button. A drag that starts here keeps its finger (pointer capture, joystick.ts),
        so it presses nothing it crosses. */
     .joystick-zone { position: absolute; left: 0; top: 0; bottom: 0; width: 50%; z-index: -1; pointer-events: auto; touch-action: none; }
     /* Touch screens (.hud.touch, hud.ts): the column's panels let touches through to the joystick and only their buttons
        take one, so a touch target in the column must be a <button>. The desktop keeps the panels as they are (invite link). */
     .hud.touch .hud-health, .hud.touch .hud-status, .hud.touch .hud-quest { pointer-events: none; }
     .hud.touch .hud-left button { pointer-events: auto; }
     ```

     Độ ưu tiên: `.hud.touch .hud-health` (0,3,0) thắng `.hud-health` (0,1,0) bất kể thứ tự, nên không cần sửa các rule cũ.

2. **`packages/client/src/ui/hud.ts`:**
   - JSDoc cho `joystickZone` (dòng 10):

     ```ts
     /** The joystick's half of the screen (touch only): the HUD's bottom layer (CSS), so it gets only the touches nothing else takes. */
     ```

   - Dòng 38:

     ```ts
     // Touch screens: the joystick's zone is the HUD's bottom layer, and the column's panels let touches through to it (index.html).
     this.root = div(isTouch ? "hud touch" : "hud");
     ```

   - Dòng 52: `this.eatButton.addEventListener("click", actions.eat);` thành `onPress(this.eatButton, actions.eat);`.
   - Dòng 67, chú thích của nút mời, thành:

     ```ts
     // Invite button (phones): share sheet if available, else copy the link. It stays on click: both need a user gesture,
     // which a touch only gives as the finger lifts.
     ```

   - Dòng 235-244: `button()` gọi hàm mới, tham số đổi tên thành `action` để khỏi trùng tên hàm:

     ```ts
     function button(className: string, label: string, action: () => void): HTMLButtonElement {
       const b = document.createElement("button");
       b.className = `action-btn ${className}`;
       b.textContent = label;
       onPress(b, action);
       return b;
     }

     /**
      * Runs `action` as soon as a finger (or the mouse) goes down on `target`: for buttons used on the move, since a phone
      * makes no click for a second finger's tap while the first holds the joystick. Not for what needs a user gesture
      * (share sheet, clipboard): a touch only gives one as the finger lifts.
      */
     function onPress(target: HTMLElement, action: () => void) {
       target.addEventListener("pointerdown", (e) => {
         e.preventDefault();
         action();
       });
     }
     ```

   - Không đổi gì khác. `actions.eat` vẫn là `() => this.eat()` của `Game`.

3. **`packages/client/src/ui/joystick.ts`:** chỉ thay JSDoc của class (dòng 5-8):

   ```ts
   /**
    * Floating joystick: touch anywhere on the left half of the screen that no HUD button covers to place it (the zone
    * is the HUD's bottom layer, see index.html), drag to steer. Screen up maps to world "north" (away from the camera).
    * The zone captures the pointer, so a drag presses no button it crosses.
    */
   ```

4. **`docs/architecture.md`:**
   - Dòng 71, mục `ui/`: thay "`hud.ts` (trạng thái, chồng thông báo, nút cảm ứng, nút 🫐 Ăn có hồi chiêu)" bằng "`hud.ts` (trạng thái, chồng thông báo, nút cảm ứng Đánh, Bắt, 💨 và 🫐 Ăn có hồi chiêu, chạy ngay khi ngón chạm xuống: `onPress`, `pointerdown`; lớp `touch` trên HUD khi dùng cảm ứng)".
   - Cũng dòng 71: thay "`joystick.ts`" bằng "`joystick.ts` (cần điều khiển ở nửa trái: lớp dưới cùng của HUD, `z-index: -1`; trên cảm ứng các ô của cột trái cho chạm xuyên xuống nó; luật ở `docs/design/hud.md`)".
   - Dòng 92, danh sách helper e2e: thêm sau `toastLayout (...)` ", `fingers` (chạm thật qua CDP `Input.dispatchTouchEvent` cho việc `tap()` không làm được: kéo, ngón thứ hai trong lúc ngón đầu còn giữ)".

5. **`tests/e2e/multiplayer.spec.ts`, test "eating: the Ăn button recharges..." (dòng 242-300):** thay bước bấm lúc đang hồi (dòng 271-288). Nút giờ nghe `pointerdown`, nên `button.click()` không còn đi qua nút nữa, và test sẽ qua "oan".

   ```ts
   // Pressed while it recharges, all in one go so the countdown cannot end in between: the key, then a finger on the button
   // (it acts on pointerdown). Each only shakes the button.
   const pressed = await page.evaluate(() => {
     const { room } = (window as any).__petgame;
     const sent: string[] = [];
     const send = room.send;
     room.send = (type: string, ...rest: unknown[]) => {
       sent.push(type);
       return send.call(room, type, ...rest);
     };
     const button = document.querySelector<HTMLButtonElement>(".eat-btn")!;
     const cooling = button.classList.contains("cooling");
     window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
     window.dispatchEvent(new KeyboardEvent("keyup", { key: "h" }));
     button.classList.remove("nope");
     button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true }));
     const shook = button.classList.contains("nope"); // the button itself refused
     room.send = send;
     return { cooling, sent, shook };
   });
   expect(pressed).toEqual({ cooling: true, sent: [], shook: true });
   ```

   Dòng 289 (`shownToasts` không khớp `/quả mọng|Máu đang đầy/`) và phần còn lại giữ nguyên.

6. **`tests/e2e/multiplayer.spec.ts`, phần mới:**
   - Helper, đặt ngay sau `recordSends` (dòng 873):

     ```ts
     /**
      * Real touches through the browser (CDP), for what `tap()` cannot do: a drag, or a second finger while the first stays down.
      * Each call lists the fingers down after it (an id each); a finger left out of the list lifts, and `touchEnd` lifts them all.
      */
     async function fingers(page: Page) {
       const cdp = await page.context().newCDPSession(page);
       return (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[] = []) =>
         cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
     }
     ```

   - Test mới, đặt ngay sau test "eating:" (sau dòng 300). Viết đúng như dưới; nội dung từng bước giải thích ở mục Test:

     ```ts
     /** A phone held upright and sideways, for what only touch shows. */
     const PHONE_SCREENS = [
       { name: "phone upright", options: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
       { name: "phone sideways", options: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
     ] as const;

     for (const screen of PHONE_SCREENS) {
       test(`touch (${screen.name}): every button in the joystick's half takes its tap, the rest of the half steers, and Ăn eats under a second finger`, async ({ browser }) => {
         test.slow();
         const page = await join(browser, "Ngón", "/", { ...screen.options });
         await waitForWorld(page);
         await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
         await expect(page.locator(".hud-quest")).toContainText(/\S/);
         const finger = await fingers(page);
         const sent = await recordSends(page);

         // Every HUD button whose centre is in the left half lies on top there: the joystick's zone is the HUD's bottom layer.
         // The zone still covers the whole left half, and the quest tracker (no button in it) lets a touch through to it.
         const layout = await page.evaluate(() => {
           const half = innerWidth / 2;
           const z = document.querySelector(".joystick-zone")!.getBoundingClientRect();
           const checked: string[] = [];
           const covered: string[] = [];
           for (const b of document.querySelectorAll<HTMLButtonElement>(".hud button")) {
             const r = b.getBoundingClientRect();
             if (b.closest("[hidden]") || getComputedStyle(b).display === "none" || r.width === 0 || r.height === 0) continue;
             const x = r.left + r.width / 2;
             const y = r.top + r.height / 2;
             if (x >= half) continue;
             const name = b.className.split(" ")[0];
             checked.push(name);
             const top = document.elementFromPoint(x, y);
             if (!top || !b.contains(top)) covered.push(`${name} under ${top?.className}`);
           }
           const q = document.querySelector(".hud-quest")!.getBoundingClientRect();
           const quest = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
           return {
             zone: [z.left, z.top, z.width, z.height].map(Math.round),
             leftHalf: [0, 0, Math.round(half), innerHeight],
             checked,
             covered,
             questToJoystick: !!quest?.closest(".joystick-zone"),
             half,
             height: innerHeight,
           };
         });
         expect(layout.zone).toEqual(layout.leftHalf);
         expect(layout.checked).toEqual(expect.arrayContaining(["eat-btn", "sound-btn", "invite-btn"]));
         expect(layout.covered).toEqual([]);
         expect(layout.questToJoystick).toBe(true);

         // 🔊: a tap mutes, another one unmutes (a new device starts with the sound on).
         const sound = page.locator(".sound-btn");
         await expect(sound).toHaveText("🔊");
         await sound.tap();
         await expect(sound).toHaveText("🔇");
         await sound.tap();
         await expect(sound).toHaveText("🔊");

         // 🔗 Mời bạn: a tap gives the invite link to the phone's share sheet (stubbed: this Chromium has none to open).
         await page.evaluate(() => {
           Object.defineProperty(navigator, "share", {
             configurable: true,
             value: (data: unknown) => {
               (window as any).__shared = data;
               return Promise.resolve();
             },
           });
         });
         const invite = page.locator(".invite-btn");
         await invite.tap();
         const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
         const link = await invite.getAttribute("data-link");
         expect(link).toContain(`room=${roomId}`);
         await expect.poll(() => page.evaluate(() => (window as any).__shared ?? null)).toEqual({ title: "PetGame", text: "Vào chơi cùng mình!", url: link });

         // An empty spot of the left half (a quarter across, three quarters down) starts the joystick: dragging up walks north.
         const spot = { x: Math.round(layout.half / 2), y: Math.round(layout.height * 0.75) };
         expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".joystick-zone"), [spot.x, spot.y])).toBe(true);
         const me = () => page.evaluate(() => {
           const { room } = (window as any).__petgame;
           const p = room.state.players.get(room.sessionId);
           return { y: p.y as number, berries: p.berries as number, hp: p.hp as number, maxHp: p.maxHp as number };
         });
         const start = await me();
         await finger("touchStart", [{ ...spot, id: 0 }]);
         for (let i = 1; i <= 6; i++) await finger("touchMove", [{ x: spot.x, y: spot.y - i * 10, id: 0 }]);
         await expect.poll(async () => start.y - (await me()).y).toBeGreaterThan(40);
         await finger("touchEnd");

         // A drag that starts on the joystick presses nothing it crosses or ends on (the zone keeps its finger).
         for (const target of [".sound-btn", ".eat-btn"]) {
           const box = (await page.locator(target).boundingBox())!;
           const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
           await finger("touchStart", [{ ...spot, id: 0 }]);
           for (let i = 1; i <= 8; i++) await finger("touchMove", [{ x: spot.x + ((end.x - spot.x) * i) / 8, y: spot.y + ((end.y - spot.y) * i) / 8, id: 0 }]);
           await finger("touchEnd");
         }

         // Ăn under a second finger while the first holds the joystick: a phone makes no click for that touch, so Ăn acts on
         // pointerdown. Snow by day is cold: health drops on its own (nothing hostile lives there, see the eating test).
         await sendFrom(page, "debug:give");
         await sendFrom(page, "debug:teleport", { x: 2440, y: 1760 });
         await expect.poll(async () => {
           const m = await me();
           return m.berries >= 50 && m.hp < m.maxHp;
         }, { timeout: 15_000 }).toBe(true);
         // The drags pressed nothing (checked now, when anything they set off would have arrived).
         await expect(sound).toHaveText("🔊");
         expect(await sent()).not.toContain("eat");
         const berries = (await me()).berries;
         const eat = (await page.locator(".eat-btn").boundingBox())!;
         await finger("touchStart", [{ ...spot, id: 0 }]); // holds the joystick still
         await finger("touchStart", [{ ...spot, id: 0 }, { x: eat.x + eat.width / 2, y: eat.y + eat.height / 2, id: 1 }]);
         await finger("touchMove", [{ ...spot, id: 0 }]); // the second finger lifts
         await finger("touchEnd");
         await expect.poll(async () => (await me()).berries).toBe(berries - 1);
         await expect(page.locator(".eat-btn")).toHaveClass(/cooling/);
       });
     }
     ```

7. **Tự kiểm trước khi giao tester.** Không sửa file `packages/client` khi e2e đang chạy: Vite tải lại trang.
   - **Nên làm:** viết bước 5-6 trước rồi chạy `npx playwright test -g "touch \("` trên code chưa sửa. Test phải hỏng ở `layout.covered`:
     - dọc: `["sound-btn under joystick-zone", "invite-btn under joystick-zone", "ball-btn under joystick-zone"]`;
     - ngang: chỉ hai nút đầu.

     Như vậy chứng tỏ test bắt được lỗi. Sau đó làm bước 1-4.
   - `npm run typecheck`.
   - `npx playwright test -g "touch \(|eating|toasts"`.

## Giao thức

- `schema.ts`, `messages.ts`, `Profile`: **không đổi**.
- Không có tin mới, server không đổi. Chỉ client đổi: CSS, cách nút Ăn nghe chạm, một lớp CSS trên HUD.
- Client cũ và server mới, hay ngược lại, vẫn chạy được với nhau.

## Test

**Unit (shared), tích hợp server:** không thêm. Không có logic dùng chung hay luật server mới. Thay đổi nằm ở thứ tự lớp DOM và bộ nghe chạm, chỉ e2e trong trình duyệt thật kiểm được.

**E2E mới**, mỗi khung hình điện thoại một test (390×844, 844×390), code ở bước 6:
1. **Bố cục:**
   - Mọi `.hud button` đang hiện có tâm ở nửa trái thì nằm trên cùng tại tâm (`covered` rỗng).
   - Danh sách đã kiểm phải có `eat-btn`, `sound-btn`, `invite-btn`, để phép kiểm không rỗng. Khi dọc có cả `ball-btn`; không bắt buộc, vì vị trí nút Bóng là việc của T18.
   - Vùng vẫn phủ đúng nửa trái.
   - Tâm ô nhiệm vụ (không có nút) chạm xuyên xuống vùng.
2. **🔊:** `tap()` thành 🔇, `tap()` lần nữa về 🔊.
3. **🔗 Mời bạn:**
   - Thay `navigator.share` bằng hàm ghi lại tham số. Chromium không đầu không có bảng chia sẻ, còn điện thoại thật đi đường này.
   - `tap()` rồi kiểm `{ title: "PetGame", text: "Vào chơi cùng mình!", url }` với `url` là `data-link` và chứa `room=<roomId>`.
4. **Chỗ trống bật cần điều khiển:**
   - Điểm (¼ rộng, ¾ cao) là vùng; đo được (98, 633) khi dọc và (211, 293) khi ngang.
   - Kéo lên 60 px thì y của người chơi trên server giảm hơn 40 px. Đo được giảm khoảng 130 px trong 0,8 s, đi từ chỗ xuất hiện (3120, 2400), phía bắc không vướng gì.
5. **Kéo không bấm nút:**
   - Hai lần kéo từ chỗ trống, nhấc ngón ở tâm 🔊 và ở tâm Ăn.
   - Kiểm sau bước 6 (lúc mọi tác dụng nếu có đã kịp tới): 🔊 vẫn 🔊, không có tin `eat`.
6. **Ăn bằng ngón thứ hai:**
   - Dùng `debug:give` và `debug:teleport` tới vùng tuyết (2440, 1760), cùng chỗ với test "eating:" của T32. Chỗ này lạnh ban ngày, không có thú hung dữ; phòng mới luôn bắt đầu ban ngày. Đo được: mất máu sau 0,3-0,5 s.
   - Ngón 1 giữ yên ở chỗ trống, ngón 2 chạm tâm Ăn rồi nhấc.
   - Kiểm quả giảm đúng 1 và nút có `cooling`.
   - Trên code cũ bước này hỏng: quả không đổi (đo ở Thiết kế 1).

**E2E sửa:** test "eating:" (T32), bước bấm lúc đang hồi, đổi `button.click()` thành `pointerdown` và kiểm thêm `shook` (bước 5).

**Test cũ phải qua mà không sửa:**
- "HUD shows health, time of day and lets you eat berries" (dòng 232): `.click()` bằng chuột trên desktop, nay đi qua `pointerdown`;
- 3 test bố cục `toasts (desktop|phone upright|phone sideways)` (dòng 1464), gồm cả phần kiểm nút Ăn ≥ 44 px và nằm trên cùng. Không có thay đổi bố cục nào;
- "toasts: the catch and the quest it finishes show together..." (dòng 1511);
- "party: by touch alone a pal is let go; the dimmed layer takes the taps..." (dòng 943): hộp thả thú z 5 vẫn che vùng;
- "connection: when the world has let the player go..." (dòng 1225): màn mất kết nối z 6;
- "labels: in a crowd on a phone..." (dòng 580).

**Tester chạy:**
1. `npm run typecheck`, `npm test`, `npm run build`.
2. `npx playwright test -g "touch \(" --repeat-each=3 --workers=1`: 6/6.
3. `npx playwright test -g "eating"`: test T32 đã sửa.
4. `npx playwright test -g "toasts"`: 4 test.
5. `npm run test:e2e`: cả bộ qua (thêm 2 test so với trước).

## Tiêu chí hoàn thành

- [ ] `.joystick-zone` có `z-index: -1` và chú thích như bước 1. Vị trí, cỡ, `pointer-events`, `touch-action` của vùng không đổi.
- [ ] Có `.hud.touch .hud-health, .hud.touch .hud-status, .hud.touch .hud-quest { pointer-events: none; }` và `.hud.touch .hud-left button { pointer-events: auto; }`, kèm chú thích. `Hud` đặt lớp `touch` lên `.hud` khi và chỉ khi `isTouch`.
- [ ] `.eat-btn` không còn `z-index`.
  - Vẫn `position: relative; overflow: hidden`, 44×44.
  - Chú thích CSS mới như bước 1: không còn nhắc "above the joystick's half" hay T18.
- [ ] Nút Ăn:
  - nghe `pointerdown` qua `onPress` (có `preventDefault()`), không còn bộ nghe `click`;
  - `button()` dùng cùng `onPress`; `onPress` có JSDoc.
- [ ] 🔊 và 🔗 vẫn `click`. Chú thích ở nút mời nói vì sao.
- [ ] `Game.ts`, `joystick.ts` (trừ JSDoc), `skillbar.ts`, server, shared không đổi.
- [ ] Desktop không đổi: không có lớp `touch`, các ô giữ `pointer-events: auto`.
- [ ] Không đổi bố cục: 3 test bố cục toasts qua mà không sửa.
- [ ] Hai test `touch (...)` qua 3/3 khi lặp, và hỏng trên code cũ (bước 7).
- [ ] Test "eating:" đã sửa qua. Cả bộ e2e qua. Typecheck, unit, build qua.
- [ ] `docs/architecture.md` cập nhật như bước 4.
- [ ] `docs/design/hud.md` đã cập nhật lúc lập kế hoạch và khớp với code.

## Rủi ro, câu hỏi mở

- **Hình cần điều khiển nằm dưới các ô của cột.**
  - `.joystick-base` là con của vùng (z −1). Bật cần điều khiển trên một ô (giờ đã được phép) thì vòng tròn bị ô nền đen mờ phủ lên một phần.
  - Trước đây vòng vẽ đè lên ô, nhưng vẫn nằm dưới thông báo như bây giờ.
  - Chỉ là hình: thường cần điều khiển bật ở góc dưới bên trái, xa cột. Chấp nhận, không đưa vòng ra khỏi vùng.
- **Enter trên nút Ăn đang có focus không còn ăn.** Giống mọi nút cảm ứng khác; bàn phím dùng H. Nhấn chuột không còn để focus lại trên nút Ăn (do `preventDefault()`).
- **Chưa thử trên máy thật.**
  - Chromium không đầu, chạm qua CDP, đúng như mô tả nhiệm vụ: ngón thứ hai không sinh `click` nhưng có `pointerdown`.
  - Safari iOS cũng chỉ sinh `click` cho chạm một ngón. `pointerdown` của ngón thứ hai chạy trên cả hai, nên cách nhất quán này không phụ thuộc trình duyệt.
- **Phần tử nhận chạm trong cột phải là `<button>`.** Thêm sau này một ô bấm được không phải nút (ví dụ bấm ô nhiệm vụ để mở danh sách) thì trên cảm ứng nó sẽ không nhận chạm. Điều này đã ghi trong chú thích CSS và `docs/design/hud.md`.
- **Trên điện thoại ngang, bảng Tủ đồ (x 232-702) và bản đồ phóng to che nút Ăn khi đang mở.** Bảng nằm trên HUD là đúng thiết kế; phím H vẫn ăn được. Không đổi ở đây.
- Không có quyết định nào cần người dùng; **không có dòng CHẶN**.
- **Đề xuất cho `TASKS.md`:**
  - **(P2, mới) Nút ⚪/🔵 Bóng nghe `click`.**
    - Lúc đang giữ cần điều khiển, chạm nút Bóng bằng ngón kia không đổi được bóng (T39 đo: ngón thứ hai không sinh `click`).
    - Đổi sang `onPress` (`pointerdown`) như nút Ăn. Thêm vào test `touch (...)` một bước hai ngón bằng helper `fingers`.
    - Có thể gộp vào T18 vì T18 cũng đụng `.ball-btn`.
  - **Cập nhật ghi chú T18:**
    - Sau T39, mọi nút ở nửa trái đã nằm trên vùng cần điều khiển: vùng là lớp dưới cùng của HUD, các ô của cột cho chạm xuyên trên cảm ứng.
    - Việc còn lại của T18 với 🔊 (34×28 khi dọc, 34×30 khi ngang), 🔗 Mời bạn (88×21) và nút Bóng (cao 28) chỉ là cỡ.
    - Test `touch (phone upright|phone sideways)` kiểm mọi nút có tâm ở nửa trái nằm trên cùng: chạy lại khi đổi cỡ hay bố cục.
