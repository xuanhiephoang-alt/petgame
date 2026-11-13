# PLAN: T62 Điện thoại dọc: thông báo đè tên người chơi

Đọc code ở HEAD `61845e6`. File liên quan:
- `packages/client/src/ui/toastQueue.ts`: `TOAST` (dòng 5-24, `roomyPortraitPx: 760`), `toastRoom(width, height)` (dòng 52-56).
- `packages/client/src/ui/toastQueue.test.ts`: `describe("toastRoom")` dòng 40-50.
- `packages/client/src/ui/hud.ts`: `toastQueue = new ToastQueue(() => toastRoom(innerWidth, innerHeight))` dòng 26; `showToast` 256, `tickToasts` 261.
- `packages/client/src/game/Game.ts`: tạo `Hud` dòng 299-308; nhãn tên người chơi `actor.height + 6` dòng 399 và `tag.lift = actor.height + 6` dòng 420; camera `me.pos.y - 16` dòng 1005; `me()` dòng 890.
- `packages/client/src/game/labelLayout.ts` (+ `labelLayout.test.ts`): hằng số và logic nhãn tên.
- `packages/client/src/game/stage.ts`: `Stage.zoomFor` = cạnh ngắn / 440 (390 px rộng: 0,886).
- `packages/client/index.html`: `.label` (gap 3 px), `.label span` (12 px, đệm 1 px: cao 17), `.hp-bar` (cao 5, chỉ hiện khi `.label.hurt`) dòng 16-26; `.hud-left` dòng 117; `.hud-toasts` (gap 4) và `.toast` dòng 139-147; khối `@media (max-width: 600px)` (`.toast` chữ 13 px, cột `100vw − 140`) dòng 389-406.
- `tests/e2e/multiplayer.spec.ts`: `shownToasts` 2409, `toastLayout` 2416, `boxesOverlap` 2436, `TOAST_SCREENS` + test `toasts (...)` 2439-2493, `safeArea` 2502, `bossLayout` 2527, `BOSS_SCREENS` 2649, test `short sideways phone` 2876-2996, test ô trạng thái đầy 667 kết thúc dòng 3015.

## Mục tiêu

Cầm điện thoại dọc, hai thông báo dài nhất (phần thưởng hạ trùm, lên cấp kèm 2 chiêu: mỗi cái 3 dòng, cao 61 px) xếp dưới ô nhiệm vụ đè lên tên mình. Đúng lúc nhiều thông báo nhất (đánh nhau, bắt thú) người chơi mất tên và thanh máu dưới tên. Sau T62, khi cầm dọc, thông báo không bao giờ đè tên mình lúc đứng yên, kể cả khi:
- có tai thỏ;
- đang bị thương (thanh máu dưới tên);
- tóc hoặc mũ cao;
- ô nhiệm vụ dài.

Màn có đủ chỗ vẫn hiện 2 thông báo như cũ.

### Số đo hiện tại (bản đo chỉ đọc, Playwright + Chromium như e2e, HEAD `61845e6`)

Cách đo: script trong scratchpad, server cổng 2667 và Vite 5273 (`VITE_SERVER_URL`), `PETGAME_DEBUG=1`, tai thỏ bằng CDP `Emulation.setSafeAreaInsetsOverride` (như `safeArea`). Mỗi trường hợp:
- vào thế giới, `debug:givePal` emberpup cấp 8, ép 2 thông báo dài nhất;
- đổi tóc (`setLook`), mũ (`debug:wardrobe` rồi `equip`), nhiệm vụ (`debug:quest`);
- "bị thương" = thêm lớp `hurt` cho `.label.me` ngay trong lần đo (đúng lớp mà `setHp` đặt khi máu < tối đa).

Đo khi camera đứng yên (lệch < 1). Khoảng cách = mép trên tên mình − đáy thông báo cuối (đã hết hiệu ứng trượt 4 px); số âm là đè.

**Chiều cao nhân vật** (`PlayerActor.height`, đơn vị thế giới):
- tóc buộc hai bên 46,3; dài 48,3; búi 55,1; **xoăn 55,8** (tóc cao nhất);
- mũ: hoa 58,1, lưỡi trai 61,7, len 66,4, **mũ phù thủy 68,9** (cao nhất).

**Ô nhiệm vụ ở 390 px rộng:**
- 57 px với đa số nhiệm vụ;
- 71-72 px với chỉ số 1, 7, 10, 13;
- **86 px với chỉ số 3** ("Hái 3 bụi quả", gợi ý 2 dòng);
- 23 px khi đã xong hết nhiệm vụ.

Thanh máu trùm thế chỗ ô nhiệm vụ cao 38 px.

**Hai thông báo, 390×760** (hiện đang 2 cái, vì `760 < 760` sai):

| Tóc | Ô nhiệm vụ | + bị thương | Thanh trùm | + bị thương |
|---|---|---|---|---|
| buộc hai bên | +4,4 | −3,6 | +23,4 | +15,4 |
| rối (messy) | +0,6 | −7,4 | +19,6 | +11,6 |
| xoăn | −4,0 | −12,0 | +15,0 | +7,0 |

**Hai thông báo, 390×844, tai thỏ 47** (hiện 2 cái):

| Tóc | Ô nhiệm vụ | + bị thương | Thanh trùm | + bị thương |
|---|---|---|---|---|
| buộc hai bên | +11,4 | +3,4 | +30,4 | +22,4 |
| rối | +7,6 | −0,4 | +26,6 | +18,6 |
| xoăn | +3,0 | −5,0 | +22,0 | +14,0 |

**Trường hợp tệ hơn mà nhiệm vụ chưa nêu** (hai thông báo, đã bị thương):

| Màn | Ô nhiệm vụ đầu, tóc xoăn | Ô nhiệm vụ đầu, mũ phù thủy | Ô 86 px, mũ phù thủy |
|---|---|---|---|
| 390×844 | +30 | +18 | −11 |
| 390×844, tai thỏ 47 | −5 | −17 | −46 |
| 393×852, tai thỏ 59 (iPhone 14 Pro/15) | −13 | −25 | −54 |
| 375×812, tai thỏ 44 (iPhone X/12 mini) | −31 | −42 | −57 |
| 360×800 (Android) | −3 | −14 | −29 |
| 412×915 | +63 | +51 | +36 |
| 430×932, tai thỏ 59 (thông báo 2 dòng, 44 px) | +76 | +63 | +48 |
| 768×1024 (máy tính bảng, thông báo 51 px) | +93 | +70 | +53 |

**Công thức mép trên tên mình khớp số đo** (sai ≤ 0,4 px ở mọi màn trên):
```
nameTop = H/2 + (16 − (chiều cao nhân vật + 6)) × zoom − 17 − 8 (thanh máu)
```
- camera nhìn vào điểm 16 đơn vị trên chân (`Game.ts` dòng 1005);
- nhãn treo ở `chiều cao + 6`, neo theo đáy (`translate(-50%, -100%)`);
- chữ tên cao 17 px; thanh máu thêm 3 + 5 = 8 px dưới chữ, đẩy chữ lên 8 (đo được đúng 8,0).

**Chỗ bắt đầu thông báo** (`toastsTop`, đáy ô nhiệm vụ + gap 4) đo được:
- 390×844: 201,2; có tai thỏ 47: 236,2; tai thỏ 47 + thanh trùm: 217,2;
- ô 86 px: +29.

Một thông báo 3 dòng cao 60,7; hai cái và gap 4 kết thúc ở `toastsTop + 125,4`.

### Kết luận

Chỉ nâng mốc chiều cao (cách task gợi ý) **không đủ và không làm được mà không sửa test cũ**:
- 390×844 không tai thỏ phải giữ 2 thông báo: test `toasts (phone upright)` và unit `toastRoom(390, 844) = 2`.
- 390×844 có tai thỏ 47 + thanh trùm cũng phải giữ 2: test `boss bar (phone upright, notch)`, room 2.
- Nhưng cũng 390×844 có tai thỏ, khi có ô nhiệm vụ, bị thương và tóc xoăn thì đè 5 px.

Một mốc theo `(cao, lề trên)` không phân biệt được ô nhiệm vụ với thanh trùm, ô 57 với ô 86, tóc với mũ. Vì vậy số chỗ phải tính theo **chỗ thật trên màn**: cột kết thúc ở đâu (đo DOM), tên mình ở đâu (công thức trên). Mốc tĩnh nâng lên 790 vẫn giữ (task yêu cầu), làm tầng dưới rẻ: màn dọc thấp hơn thì không đo gì.

## Phạm vi

Làm:
1. `toastRoom` nhận thêm hàm `fit` (tuỳ chọn, gọi lười): chỗ bắt đầu thông báo và mép trên tên mình. Màn dọc cao ≥ 790 chỉ cho 2 khi 2 thông báo cao nhất vừa, cách tên ≥ 4 px.
2. `roomyPortraitPx` 760 → 790.
3. Hàm thuần `restingNameTop` (mép trên tên mình lúc đứng yên, luôn tính thanh máu), cùng các hằng số mà `Game.ts` đang viết cứng (16, 6).
4. `Hud` tính và nhớ số chỗ: tính lại mỗi lần có thông báo mới, và mỗi 250 ms khi có thông báo đang chờ. `Game` đưa cho `Hud` hàm mép trên tên mình.
5. Unit test cho `toastRoom` (với `fit`) và `restingNameTop`. Một e2e mới cho điện thoại dọc: tai thỏ, bị thương, tóc cao, mũ cao, ô nhiệm vụ cao.
6. `docs/design/hud.md`: đã cập nhật cùng kế hoạch này (mục "Thông báo (toast)": "Bao nhiêu cái cùng lúc" và mục mới "Thông báo và tên mình khi cầm dọc").

**Không** làm:
- Không đổi CSS bố cục: cột, ô nhiệm vụ, thông báo (cỡ chữ, đệm, rộng), nhãn tên, thanh máu. Chỉ được thêm chú thích CSS ở bước 5.
- Không cắt dòng thông báo, không đổi thời gian hay mức của thông báo, không đổi luật hàng chờ (`ToastQueue`).
- Không đổi camera, độ phóng, chỗ nhân vật trên màn.
- Không đổi điện thoại ngang, desktop, màn ngang. `toastRoom` trả lời trước khi gọi `fit` cho các màn này, nên không đọc DOM.
- **Không sửa test có sẵn.** Không đổi `TOAST_SCREENS`, `BOSS_SCREENS`, `toastLayout`, `safeArea`, `bossLayout`, `settledBossLayout`, `nearBoss` hay một dòng nào của test `toasts (...)`, `boss bar (...)`, `short sideways phone (...)`. Chỉ thêm. Việc trả test `toasts (...)` về bản trước T30 và dọn test thanh trùm là của **T63**, không làm ở đây. Không thêm dòng vào mảng `TOAST_SCREENS`, để T63 trả test về bản cũ mà không đụng phần mới.
- Không xử lý màn dọc thấp (< 790) khi 1 thông báo vẫn đè tên, và tên lên cao lúc đang đi (xem "Đề xuất tách việc").
- Không đổi server, shared, schema, message, lưu game.

## Thiết kế

### Luật số chỗ (thay luật "dọc thấp hơn 760 px" trong `hud.md`)

`toastRoom(width, height, fit?)`, theo thứ tự:
1. `height ≤ 520` (điện thoại ngang): **1**. Không đổi.
2. `width ≥ height` (desktop, màn ngang cao): **2**. Không đổi.
3. Màn dọc `height < 790`: **1**. Trước là 760.
4. Màn dọc ≥ 790:
   - gọi `fit()`. Nếu nó trả `undefined` (chưa có nhân vật mình, nên không có tên để tránh) thì **2**;
   - nếu không: **2** khi `toastsTop + 2 × 61 + 4 + 4 ≤ nameTop`, ngược lại **1**.

Số `61 + 4 + 61` là 2 thông báo cao nhất cộng gap; `+ 4` là khoảng cách tối thiểu tới tên.

**Giải thích từng thành phần** (lý do):
- **`toastsTop` đo thật trên màn**: mép trên `.hud-toasts` khi đang có thông báo; khi không có thì đáy `.hud-left` + `row-gap` của nó (4 px trên điện thoại, 6 px trên màn rộng hơn). Nhờ vậy những thứ sau đã nằm sẵn trong số:
  - tai thỏ (`env(safe-area-inset-top)`);
  - ô trạng thái xuống mấy dòng;
  - ô nhiệm vụ cao 23-86 px;
  - thanh trùm thế chỗ ô nhiệm vụ.

  Không phải sao chép CSS vào TypeScript.
- **`nameTop` tính bằng công thức, không đo DOM**:
  - vị trí đứng yên, không theo vị trí đang lắc hay đang trễ của camera, nên số không nhảy theo từng khung;
  - không đọc layout của nhãn (nhãn được ghi `transform` mỗi khung, đọc thì ép layout).
- **Luôn tính thanh máu dưới tên (8 px)**: thanh hiện, ẩn theo máu, và đổi liên tục lúc đánh nhau, đúng lúc nhiều thông báo nhất. Số chỗ đổi theo máu thì không giúp gì: hàng chờ không bao giờ cắt thông báo đang hiện, nên chỗ đã cho thì đè đến khi hết giờ.
- **Chiều cao nhân vật lấy theo lúc này** (`PlayerActor.height`: tóc + mũ), không lấy cao nhất có thể (mũ phù thủy):
  - đổi tóc, mũ là việc hiếm, người chơi tự làm trong Tủ đồ;
  - nếu lấy cao nhất thì 390×844 có tai thỏ + thanh trùm còn 1 chỗ (344,8 < 347,2), làm hỏng test T30 `boss bar (phone upright, notch)` với room 2.
- **Mỗi thông báo coi như 61 px** (3 dòng chữ 13 px: 3 × 16,9 + 10):
  - đo được ở cả 360, 390 và 412 px rộng;
  - màn rộng hơn thì thông báo ngắn hơn (430 px: 44; 768 px: 51), nên 61 là trần an toàn;
  - không biết trước chữ của thông báo sau, nên lấy trường hợp xấu nhất.
- **Cách tên 4 px**: để chừa sai số làm tròn vị trí (`Math.round` của `world.position`, `translate` 0,1 px) và font khác nhau giữa máy. E2E kiểm ≥ 2 px.
- **Mốc 790**: dưới 790, 2 thông báo chỉ vừa trong vài trường hợp hiếm:
  - có thanh trùm (cần ≥ 756 với tóc xoăn);
  - hoặc tóc thấp nhất (≥ 777).

  Với tóc xoăn và ô nhiệm vụ đầu thì cần ≥ 794. Ở mốc 790 luật vẫn dễ nói ("dọc thấp hơn 790: 1 cái"), và màn thấp không phải đo DOM. Đổi lại mất 2 chỗ trong các trường hợp hiếm đó: chấp nhận được, vì thông báo thứ hai chỉ chờ chứ không mất.

**Khi nào tính lại số chỗ** (`Hud` nhớ số cuối cùng):
- mỗi lần `showToast`, trước `push`;
- trong `tickToasts`, khi hàng chờ không rỗng, tối đa mỗi `TOAST.roomCheckMs = 250` ms. Lý do: lúc chờ, ô nhiệm vụ có thể đổi hay thanh trùm ẩn, hiện, nên chỗ có thể vừa mở ra. Không chờ thì `update` không hỏi số chỗ, nên không đo.

Màn ngang, desktop và màn dọc < 790 không gọi `fit`, nên không đọc DOM. Màn dọc ≥ 790: tối đa 1 lần đọc layout mỗi thông báo mới + 4 lần mỗi giây trong lúc có thông báo chờ.

**Thông báo đang hiện không bị cắt.** Số chỗ giảm (ô nhiệm vụ dài ra) thì thông báo đang hiện vẫn hiện đến hết giờ. Đây là luật của `ToastQueue` từ T8, không đổi.

### Kết quả mong đợi (công thức + số đo ở trên; tiêu chí dùng các số này)

| Màn | Trường hợp (đã bị thương) | Trước | Sau |
|---|---|---|---|
| 390×760 | ô đầu, tóc xoăn | 2 cái, −12 | 1 cái, +52 |
| 390×760 | ô 86 px, mũ phù thủy | 2 cái, −53 | 1 cái, +12 |
| 390×844, tai thỏ 47 | ô đầu, tóc xoăn | 2 cái, −5 | 1 cái, +59 |
| 390×844, tai thỏ 47 | ô 86 px, mũ phù thủy | 2 cái, −46 | 1 cái, +19 |
| 390×844, tai thỏ 47 | thanh trùm, tóc xoăn | 2 cái, +14 | 2 cái, +14 (T30 giữ) |
| 390×844 | ô đầu, tóc xoăn | 2 cái, +30 | 2 cái, +30 (T6 giữ) |
| 390×844 | ô đầu, mũ phù thủy | 2 cái, +18 | 2 cái, +18 |
| 390×844 | ô 86 px, tóc xoăn | 2 cái, +1 | 1 cái, +65 |
| 390×844 | ô 86 px, mũ phù thủy | 2 cái, −11 | 1 cái, +54 |
| 393×852, tai thỏ 59 | ô đầu, tóc xoăn | 2 cái, −13 | 1 cái, +51 |
| 393×852, tai thỏ 59 | ô 86 px, mũ phù thủy | 2 cái, −54 | 1 cái, +11 |
| 375×812, tai thỏ 44 | ô 86 px, mũ phù thủy | 2 cái, −57 | 1 cái, +8 |
| 360×800 | ô đầu, tóc xoăn | 2 cái, −3 | 1 cái, +61 |
| 412×915, 430×932 tai thỏ 59, 768×1024 | mọi trường hợp đo | 2 cái | 2 cái (không đổi) |

Với 1 cái, đáy là `toastsTop + 61`.

### Trải nghiệm

- Người chơi không thấy gì mới. Trên màn chật, thông báo thứ hai hiện sau khi cái đầu hết, như khi cầm ngang. Mức cao không bao giờ mất (chờ đến lượt); mức thường chờ tối đa 4 s, mức thấp 1 s (luật T8).
- Cảnh dài nhất khi chỉ 1 chỗ (bắt thú đầu đàn xong nhiệm vụ cuối) dài thêm khoảng 3 s, như `hud.md` đã ghi cho điện thoại ngang.
- Bàn phím, cảm ứng: không đổi thao tác nào. Thông báo vẫn không nhận chạm.
- Không có chữ mới.

## Kế hoạch triển khai

### 1. `packages/client/src/ui/toastQueue.ts`

- Trong `TOAST`:
  - đổi `roomyPortraitPx: 760` → `790`; JSDoc nói "Upright screens shorter than this show one toast at a time; taller ones show two only when they fit above my name (`toastRoom`)";
  - thêm `portraitToastPx: 61` (JSDoc: the tallest toast on an upright phone, 3 lines of 13 px text, measured at 360-412 px wide; wider columns wrap less);
  - thêm `gapPx: 4` (JSDoc: the gap between toasts, `.hud-toasts` in index.html);
  - thêm `nameClearPx: 4` (JSDoc: the least room left between the last toast and my name tag);
  - thêm `roomCheckMs: 250` (JSDoc: how often the room is measured again while toasts wait).
- Thêm và export:
  ```ts
  /** Where the toasts start and where the top of my name tag is at rest, health bar shown (CSS px from the top of the screen). */
  export interface ToastFit { toastsTop: number; nameTop: number }
  ```
- `toastRoom(width: number, height: number, fit?: () => ToastFit | undefined): number`:
  ```ts
  if (height <= TOAST.shortScreenPx) return 1;
  if (width >= height) return TOAST.maxVisible;
  if (height < TOAST.roomyPortraitPx) return 1;
  const at = fit?.();
  if (!at) return TOAST.maxVisible;
  const bottom = at.toastsTop + TOAST.maxVisible * TOAST.portraitToastPx + (TOAST.maxVisible - 1) * TOAST.gapPx;
  return bottom + TOAST.nameClearPx <= at.nameTop ? TOAST.maxVisible : 1;
  ```
  JSDoc nói rõ:
  - `fit` chỉ được gọi cho màn dọc ≥ `roomyPortraitPx` (nó đọc layout);
  - `undefined` nghĩa là không có tên để tránh.

### 2. `packages/client/src/game/labelLayout.ts`

Thêm và export (JSDoc tiếng Anh, nói vì sao có số):
- `CAMERA_LEAD_PX = 16`: the camera looks this many world px above my feet.
- `PLAYER_TAG_LIFT_PX = 6`: a player's name tag hangs this many world px above the head.
- `NAME_TAG_PX = 17`: height of a name (`.label span`: 12 px text, 1 px padding).
- `HURT_BAR_PX = 8`: the health bar under a hurt name (`.label` gap 3 + `.hp-bar` 5) lifts the name by this much.
- Hàm:
  ```ts
  /**
   * Top of my name tag (CSS px) while I stand still in the middle of a screen `screenHeight` tall, with its health bar
   * showing, for a figure `actorHeight` world px tall (hair and hat). The camera centre is CAMERA_LEAD_PX above my feet;
   * the tag is anchored by its bottom at PLAYER_TAG_LIFT_PX above my head.
   */
  export function restingNameTop(screenHeight: number, zoom: number, actorHeight: number): number {
    return screenHeight / 2 + (CAMERA_LEAD_PX - actorHeight - PLAYER_TAG_LIFT_PX) * zoom - NAME_TAG_PX - HURT_BAR_PX;
  }
  ```

### 3. `packages/client/src/game/Game.ts`

- Import `CAMERA_LEAD_PX`, `PLAYER_TAG_LIFT_PX`, `restingNameTop` từ `./labelLayout.ts` (file đã import `LABEL_RANK` từ đó thì gộp vào dòng import có sẵn).
- Dòng 1005: `me.pos.y - 16` → `me.pos.y - CAMERA_LEAD_PX`. Chỉ dòng camera, không đụng ánh sáng dòng 1054.
- Dòng 399 (`actor.height + 6` của nhãn người chơi) và dòng 420 (`tag.lift = actor.height + 6`) → `actor.height + PLAYER_TAG_LIFT_PX`. Không đổi lift của thú và trùm.
- Ngay sau `this.hud.setMuted(...)` (dòng 308):
  ```ts
  // Upright phones: two toasts only when they end above my name (T62, docs/design/hud.md).
  this.hud.setNameTop(() => {
    const me = this.me();
    return me ? restingNameTop(this.stage.height, this.stage.camera.zoom, me.height) : undefined;
  });
  ```

### 4. `packages/client/src/ui/hud.ts`

- Import thêm `TOAST` và `type ToastFit` từ `./toastQueue.ts`.
- Trường mới:
  - `private toastSlots: number = TOAST.maxVisible` (JSDoc: how many toasts fit, as last measured);
  - `private slotsCheckedAt = -Infinity`;
  - `private nameTop: () => number | undefined = () => undefined`.

  Đặt các trường này **trước** `toastQueue` cho dễ đọc. Callback chỉ được gọi lúc chạy, nên thứ tự không làm sai.
- `toastQueue = new ToastQueue(() => this.toastSlots)`.
- `setNameTop(top: () => number | undefined)`: JSDoc nói "where the top of my name tag is at rest (CSS px), for the upright-phone toast rule".
- `private measureSlots(now: number)`:
  ```ts
  this.slotsCheckedAt = now;
  this.toastSlots = toastRoom(window.innerWidth, window.innerHeight, () => this.toastFit());
  ```
- `private toastFit(): ToastFit | undefined`:
  - `nameTop = this.nameTop()`; `undefined` thì trả `undefined`, không đọc DOM;
  - `toastsTop`:
    - `this.toasts.childElementCount > 0`: `this.toasts.getBoundingClientRect().top`. Phần tử đang mờ dần vẫn giữ hộp, và hiệu ứng trượt nằm ở `.toast`, không ở hộp chứa;
    - ngược lại `this.left.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(this.left).rowGap) || 0)`. `.hud-toasts:empty` có `display: none`, nên đáy cột là đáy ô nhiệm vụ hoặc thanh trùm.
  - JSDoc nói đây là chỗ đọc layout duy nhất, và chỉ chạy khi `toastRoom` cần.
- `showToast(text, level)`:
  ```ts
  const now = performance.now();
  this.measureSlots(now);
  if (this.toastQueue.push(text, level, now)) this.renderToasts();
  ```
- `tickToasts(now)`: trước `update`:
  ```ts
  if (this.toastQueue.waiting.length > 0 && now - this.slotsCheckedAt >= TOAST.roomCheckMs) this.measureSlots(now);
  ```
  Không tạo object mới mỗi khung: closure `() => this.toastFit()` chỉ tạo khi đo, tối đa 4 lần mỗi giây.
- Không đổi `renderToasts`, thứ tự DOM, CSS class.

### 5. `packages/client/index.html` (chỉ chú thích)

Trên `.label span` / `.hp-bar` (dòng 18-21) thêm chú thích ngắn: `NAME_TAG_PX` và `HURT_BAR_PX` trong `game/labelLayout.ts` theo các cỡ này (đổi CSS thì đổi số). Không đổi luật CSS nào.

### 6. Unit test

**`packages/client/src/ui/toastQueue.test.ts`**: giữ nguyên `it` có sẵn của `describe("toastRoom")`. Thêm các `it` mới trong cùng `describe`:
- "upright screens under 790 px show one toast, 790 and up two without a name to avoid":
  - `toastRoom(390, 789)` = 1;
  - `toastRoom(390, 790)` = 2;
  - `toastRoom(390, 790, () => undefined)` = 2.
- "upright screens show two only when the two tallest end 4 px above my name". Số đo T62 (`toastsTop`, `nameTop`):
  - (390, 844, {201.2, 356.4}) = 2: không tai thỏ, ô đầu, tóc xoăn;
  - (390, 844, {236.2, 356.4}) = 1: tai thỏ 47, ô nhiệm vụ;
  - (390, 844, {217.2, 356.4}) = 2: tai thỏ 47, thanh trùm, T30 giữ;
  - (390, 844, {230.2, 344.8}) = 1: ô 86, mũ phù thủy;
  - (393, 852, {248.2, 360.1}) = 1;
  - (430, 932, {244, 383.5}) = 2;
  - (768, 1024, {225, 384.3}) = 2.
- "the boundary": `toastsTop = 100`:
  - `nameTop = 230` → 2 (100 + 61 + 4 + 61 + 4 = 230);
  - `nameTop = 229.9` → 1.
- "fit is only asked on upright screens 790 px and taller": một hàm đếm số lần gọi. 0 lần với (844, 390), (1280, 720), (390, 760), (812, 375); 1 lần với (390, 844).

**`packages/client/src/game/labelLayout.test.ts`**: thêm `describe("restingNameTop")`:
- `restingNameTop(844, 390 / 440, 55.8)` ≈ 356.40 (`toBeCloseTo(356.4, 1)`). Đo được 356,5;
- `restingNameTop(760, 390 / 440, 55.8)` ≈ 314.40. Đo được 314,5;
- `restingNameTop(844, 390 / 440, 68.9)` ≈ 344.79. Đo được 344,9;
- `restingNameTop(1024, 768 / 440, 55.8)` ≈ 407.1. Đo được 407,3.

### 7. E2E: `tests/e2e/multiplayer.spec.ts` (chỉ thêm)

Đặt sau test `short sideways phone (667×375): a full status panel ...` (kết thúc khoảng dòng 3015), trước test `toasts: the catch and the quest it finishes ...`. Dùng lại helper có sẵn (`join`, `waitForWorld`, `sendFrom`, `safeArea`, `toastLayout`, `boxesOverlap`, `shownToasts`), **không sửa chúng**.

**Helper mới `nameAndToasts(page)`**: một `page.evaluate`, đo tất cả trong cùng một lần:
- `toasts`: hộp các `.hud-toasts > .toast:not(.out)`;
- `plain`: mép trên `.labels > .label.me span`;
- `hurt`: thêm lớp `hurt` cho `.label.me`, đọc lại mép trên chữ, rồi trả lớp về như trước. Đây đúng là lớp `setHp` đặt khi máu < tối đa. Làm trong cùng evaluate nên không bị `setHp` ghi đè giữa chừng;
- `lag`: từ `debugInfo()`, như `bossLayout`: `Math.hypot(camera.x − me.x, camera.y − (me.y − 16))`.

**Mảng mới `UPRIGHT_TOAST_SCREENS`** (tóc xoăn = tóc cao nhất, mũ phù thủy = hình cao nhất; quest 0 = ô 57 px, quest 3 = ô 86 px). Mỗi `case` ghi `room` và khoảng cách tối thiểu dự kiến để chú thích:

| `name` | viewport | `insets` | cases (`quest`, `hat`, `room`) |
|---|---|---|---|
| `390×760` | 390×760 | không | (0, "", 1), (3, "wizardhat", 1) |
| `390×844, notch` | 390×844 | `{ top: 47, bottom: 34 }` | (0, "", 1), (3, "wizardhat", 1) |
| `390×844` | 390×844 | không | (0, "wizardhat", 2), (3, "wizardhat", 1) |

Tất cả `hasTouch: true, isMobile: true`.

**Test** `toasts (upright phone, ${screen.name}): never on my name, hurt and in the tallest look; one when two do not fit`, `test.slow()`. Các bước:
1. `join(browser, "Hiệp", "/", options, insets ? safeArea(insets) : undefined)`, `waitForWorld`, chờ `frames > 0`.
2. Có tai thỏ thì kiểm lề có tác dụng: `.hud-left` top ≈ `max(12, insets.top)` ± 1, như test thanh trùm.
3. Chuẩn bị:
   - `debug:givePal` emberpup cấp 8, chờ `companions.size === 1` và `.skill-bar` hiện;
   - `debug:wardrobe`;
   - `sendFrom(page, "setLook", { hair: "curly", hairColor: 0, skin: 0 })`;
   - `expect.poll` tới khi `room.state.players.get(sessionId).hair === "curly"`.
4. Mỗi case:
   1. Đặt nhiệm vụ: `sendFrom(page, "debug:quest", { index: quest })`. Chờ `.hud-quest` chứa tên nhiệm vụ: quest 0 "Bắt con thú đầu tiên", quest 3 "Hái 3 bụi quả".
   2. Đặt mũ: `sendFrom(page, "equip", { slot: "hat", id: hat })`. `expect.poll` tới khi `player.hat === hat`.
   3. Chờ không còn thông báo: `toHaveCount(0, { timeout: 20_000 })`.
   4. Đẩy hai thông báo dài nhất. Cùng hai chuỗi như test `toasts (...)`: chép nguyên văn vào một hằng mới `LONGEST_TOASTS` ngay trên test mới, không sửa test cũ.
   5. `expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(room)`; chờ hiệu ứng trượt xong (như `slideIn` của T61, kèm `.catch(() => {})`).
   6. Đo bằng `nameAndToasts`, lặp tối đa 5 lần (mỗi lần cách 250 ms) tới khi `lag < 1`. Thú hoang cắn làm nhân vật bị đẩy, camera trễ.
   7. Kiểm:
      - `toasts.length === room`;
      - `hurt` thấp hơn `plain` đúng 8 ± 1 px (`plain − hurt` trong [7, 9]). Chứng minh thanh máu giả lập đẩy tên như thật;
      - mỗi thông báo: nằm trong màn; `boxesOverlap` với phần HUD và tên mình (từ `toastLayout(page)`) là `[]`;
      - **`hurt − max(toast.bottom) ≥ 2`** (khoảng cách tới tên khi bị thương). Thông báo lỗi ghi số đo, ví dụ `` `${screen.name} q${quest} ${hat}: gap ${gap}` ``.
   8. `room === 1`: thông báo thứ hai hiện sau khi cái đầu hết, không mất: `toContainText("Hơi thở băng giá", { timeout: 10_000 })`.

Thời gian: mỗi màn 1 lần vào (khoảng 30-60 s) + 2 case (mỗi case tối đa khoảng 15 s chờ thông báo hết). Tổng khoảng 3-4 phút cho 3 màn.

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, server hay shared.
- Chỉ client: `toastQueue.ts`, `labelLayout.ts`, `Game.ts`, `hud.ts`, chú thích trong `index.html`. Thêm unit test và e2e.
- E2E dùng message có sẵn: `setLook`, `equip`, `debug:wardrobe`, `debug:quest`, `debug:givePal`.

## Test

- Unit:
  - `npx vitest run packages/client/src/ui/toastQueue.test.ts packages/client/src/game/labelLayout.test.ts`;
  - rồi `npm test`.
- E2E mới: `npx playwright test -g "toasts \\(upright phone"`.
- E2E có sẵn phải qua, không sửa:
  - `-g "toasts \\(|boss bar \\(|short sideways"`: `toasts (phone upright)` vẫn 2 cái; `boss bar (phone upright)` và `(phone upright, notch)` vẫn 2 cái;
  - `-g "touch|release|levels"`: các test 390×844 có thông báo.
- Rồi toàn bộ `npm run test:e2e`.

## Tiêu chí hoàn thành

- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch. `npm run test:e2e` qua toàn bộ, kể cả 3 test `toasts (upright phone, ...)` mới.
- [ ] `git diff tests/e2e/multiplayer.spec.ts` chỉ có dòng thêm. Không đổi `TOAST_SCREENS`, `BOSS_SCREENS`, `toastLayout`, `safeArea`, `settledBossLayout`.
- [ ] `git diff packages/client/src/ui/toastQueue.test.ts` chỉ có dòng thêm. 7 kỳ vọng cũ của `toastRoom` giữ nguyên và vẫn đúng.
- [ ] `toastRoom`:
  - màn dọc cao 521-789 px → 1;
  - (390, 790) không `fit` → 2;
  - (844, 390), (1280, 720), (1280, 500), (812, 375) và mọi màn dọc < 790 **không gọi `fit`**;
  - ranh giới `toastsTop + 130 ≤ nameTop` đúng như unit test.
- [ ] `restingNameTop` khớp số đo trong ±0,5 px ở 4 trường hợp của unit test.
- [ ] E2E mới, sau khi trượt xong, với tóc xoăn và giả lập bị thương:
  - 390×760: 1 cái ở cả 2 case; khoảng cách tới tên ≥ 2 (dự kiến +52 và +12);
  - 390×844 tai thỏ 47: 1 cái ở cả 2 case (trước là 2, đè 5 và 46 px); khoảng cách ≥ 2 (dự kiến +59 và +19);
  - 390×844: mũ phù thủy + ô đầu **2 cái**, khoảng cách ≥ 2 (dự kiến +18); mũ phù thủy + ô 86 px 1 cái (trước đè 11 px), khoảng cách ≥ 2 (dự kiến +54);
  - thông báo thứ hai hiện sau ở mọi case 1 cái;
  - không thông báo nào chồng phần HUD nào.
- [ ] Không đổi: điện thoại ngang (1 cái, đáy ≤ cao − 140), desktop 1280×720 (2 cái), 390×844 không tai thỏ với ô đầu (2 cái), 390×844 tai thỏ 47 với thanh trùm (2 cái). Các test có sẵn đã kiểm.
- [ ] Hiệu năng:
  - đọc layout chỉ trong `Hud.toastFit`, chỉ khi `toastRoom` gọi `fit` (màn dọc ≥ 790);
  - `tickToasts` không đo khi hàng chờ rỗng, và đo không quá 1 lần mỗi 250 ms;
  - không tạo object mới mỗi khung khi không có thông báo chờ.
- [ ] Số 16 (camera) và 6 (nhãn người chơi) trong `Game.ts` thay bằng `CAMERA_LEAD_PX`, `PLAYER_TAG_LIFT_PX`; không còn bản viết cứng của hai số đó ở dòng camera và nhãn người chơi.
- [ ] `docs/design/hud.md` khớp với code (đã cập nhật cùng kế hoạch): mốc 790, luật vừa chỗ, bảng kết quả, phần còn tồn tại.

## Rủi ro, câu hỏi mở

- **Test thanh trùm T30 khi trùm đi xa giữa chừng.** `boss bar (phone upright, notch)` cần 2 chỗ. Nếu lúc `pushToasts` thanh trùm vừa ẩn (trùm đi quá 450 px), ô nhiệm vụ trở lại: `toastsTop` 236 → 1 chỗ, và `accept` của `settledBossLayout` chờ 2 cái. Test có sẵn đã đi lại gần trùm và đẩy lại thông báo khi hết (tối đa 10 lần), nên thường tự hồi phục; trùm đứng yên khi không bị đánh. Nếu tester thấy chập chờn: báo kèm log, **không** sửa test cũ trong T62 (T63 làm chắc `settledBossLayout`).
- **Font khác giữa máy.** Chữ tên 17 px và thông báo 61 px đo trên Chromium của container. Font hệ thống trên iPhone, Android có thể lệch 1-2 px. Chừa 4 px cho việc này; e2e kiểm ≥ 2.
- **Thông báo dài hơn 3 dòng.** Hai chuỗi dài nhất hiện có là 3 dòng ở 360-412 px. Thông báo mới dài hơn (ví dụ tên người chơi rất dài trong tin ★) có thể 4 dòng (78 px) và đè. Ghi trong JSDoc của `portraitToastPx`, để ai thêm thông báo dài thì biết.
- **Ô nhiệm vụ đổi khi đang hiện 2 thông báo.** Ví dụ xong "Bắt con thú đầu tiên" thì ô sang "Dựng trại" (71 px, +14). Lúc đó 2 thông báo đã hiện không bị cắt và có thể đè trong vài giây. Hai thông báo thật thường ngắn hơn 61 px (ví dụ "Bắt được Leafkit! 🎉" 1 dòng), nên trên thực tế còn dư. Chấp nhận, không cắt thông báo mức cao (luật T8).
- Không có "CHẶN:".

### Đề xuất tách việc (agent chính thêm vào `TASKS.md`)

1. **Điện thoại dọc thấp (390×664, 375×667): một thông báo vẫn đè tên** (P3). Số đo T62, 1 thông báo dài nhất, đã bị thương:
   - 390×664: ô đầu + tóc xoăn +4; ô đầu + mũ phù thủy −7; ô 86 px + tóc xoăn −25; ô 86 px + mũ phù thủy −36;
   - 375×667: ô đầu + tóc xoăn −6; ô 86 px + mũ phù thủy −33.

   Hướng làm: trên màn dọc thấp, ẩn dòng gợi ý hoặc dòng "Thưởng" của ô nhiệm vụ (như khi cầm ngang), hoặc thông báo 12 px / tối đa 2 dòng. Đo lại bằng e2e `toasts (upright phone, ...)` thêm 390×664 và 375×667.
2. **Tên mình lên cao lúc đang đi lên** (P3, cân nhắc). Camera trễ `v / 7,6` giây: đi bộ 160 px/s làm tên cao hơn lúc đứng yên 21 đơn vị thế giới, tức 19 px ở 390 px rộng; lướt còn nhiều hơn trong chốc lát. Luật T62 chỉ tính lúc đứng yên. Hướng làm: cộng một khoảng dự phòng vào `nameClearPx` khi đang đi, hoặc cho camera dẫn trước theo hướng đi. Cần đo trước khi quyết.
