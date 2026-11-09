# PLAN: T15 Sảnh báo lỗi khi tải hỏng

## Mục tiêu

- **Vấn đề:** từ T1, ô tên và nút "Vào chơi" khoá cho tới khi script sảnh (`src/main.ts` cùng mọi module nó import; bản build là `build/index-*.js` và 9 file `modulepreload`) chạy xong. Nếu script này không tải được (mất mạng giữa chừng, file thiếu sau khi server đổi bản), tải quá lâu (4G yếu, kết nối treo) hoặc ném lỗi lúc khởi động (trình duyệt cũ), người chơi chỉ thấy nút mờ "Đang tải..." mãi, không lời giải thích, không lối thoát.
  - Nặng nhất khi chơi từ màn hình chính iPhone (`docs/choi-tren-iphone.md` khuyên làm vậy; `manifest.webmanifest` có `"display": "fullscreen"`): không có thanh địa chỉ hay nút tải lại của trình duyệt, nên người chơi phải tắt hẳn app.
- **Sau nhiệm vụ:**
  - Tải hỏng hoặc script chạy lỗi: hiện ngay thẻ "Không tải được game" kèm nút **Tải lại**. Nút này mở lại đúng địa chỉ, giữ `?room=` của link mời và mọi tham số khác.
  - Mạng chậm nhưng vẫn đang tải: sau 15 giây chỉ báo "Vẫn đang tải…" kèm nút Tải lại phụ, không chặn gì; tải xong thì sảnh tự mở như thường.
  - Thao tác được bằng cảm ứng và bàn phím: nút ≥ 44 px, có focus sẵn khi lỗi.
  - Test hồi quy `lobby:` kiểm thêm đường bàn phím: Enter lúc sảnh khoá không gửi gì, Enter lúc sảnh sẵn sàng thì vào được.
- **Luật** đã ghi trong `docs/design/multiplayer.md`, mục mới "Mở game: sảnh tải chậm hoặc hỏng". Game-designer đã sửa file này trong nhiệm vụ.

## Phạm vi

**Làm:**
1. `packages/client/index.html`:
   - khối thông báo `#load-status` và `<noscript>` trong form sảnh;
   - CSS `.lobby-alert`, `.lobby-action`;
   - **script inline cổ điển** canh việc tải (gọi tắt: *bộ canh tải*);
   - sửa chú thích trên form.
2. `packages/client/src/main.ts`: hằng `LOBBY_READY_EVENT` và một dòng bắn sự kiện ngay sau 3 dòng mở khoá của T1.
3. `tests/e2e/multiplayer.spec.ts`:
   - hằng `LOBBY_SCRIPT`, `LOBBY_SLOW_MS`;
   - `enterLobby` thêm tham số `press`;
   - sửa test hồi quy `lobby:` (bước bàn phím);
   - 2 test mới.
4. `docs/architecture.md`: mục `main.ts` và mục e2e.

**KHÔNG làm:**
- Không đổi handler `submit`, `connect()`, chữ lỗi khi vào phòng ("Không vào được phòng (đầy 5 người hoặc server chưa chạy).", `#join-error`). Lỗi khi bấm "Vào chơi" là việc của T23 (xem Thiết kế 6).
- Không tự tải lại, không tự thử lại, không tải lại khi có sự kiện `online`. Chỉ tải lại khi người chơi bấm nút.
- Không xử lý lỗi **sau** khi sảnh đã sẵn sàng: ảnh tải hỏng, chunk động của PixiJS hỏng trong `startGame` sau `lobby.remove()`. Đề xuất thành việc riêng (cuối file).
- Không bật nén gzip/brotli ở server (đề xuất riêng), không service worker (T13), không chạy e2e trên bản build (T16), không sửa cỡ nút có sẵn của sảnh (T18).
- Không đổi màn che kết nối của T3 (`ui/connection.ts`, `.net-*`), không đổi `lobbyUrl`/`inviteLink`.
- Bộ canh tải **không** đụng `disabled` hay chữ của `#join-btn`; nó chỉ ẩn/hiện `#name` và `#join-btn` bằng `hidden`.
- Không thêm tham số URL hay hook chỉ dành cho test vào code sản phẩm: test dùng `page.route` và `page.clock`.
- Không sửa `playwright.config.ts`, không tăng timeout, không thêm `retries`, không thêm `waitForTimeout`.
- Không thêm unit test: không có logic dùng chung (lý do ở mục Test).

## Thiết kế

### 1. Hiện trạng (HEAD `c870cb7`)

**Khoá sảnh (T1):**
- `packages/client/index.html:390-392`: chú thích.
- `:396`: `<input id="name" … disabled />`.
- `:397`: `<button type="submit" id="join-btn" disabled autocomplete="off">Đang tải...</button>`.
- CSS `:321-324`: nút `min-height: 44px`; khi khoá thì `opacity: 0.6; cursor: progress`.
- `:402`: `<script type="module" src="/src/main.ts">` cuối `<body>`.

**Mở khoá:**
- `packages/client/src/main.ts:73-77`: `nameInput.disabled = false; joinBtn.disabled = false; joinBtn.textContent = "Vào chơi";`.
- Ba dòng này nằm ngay sau `form.addEventListener("submit", …)` (`:53-71`), cuối phần chạy đồng bộ của module (không có top-level await). Mọi thứ trước đó (`:1-51`) chạy lúc nạp module.

**Bản build:**
- Vite **dời** thẻ module lên `<head>` thành `<script type="module" crossorigin src="/build/index-*.js">`, kèm 9 thẻ `<link rel="modulepreload">` (`packages/client/dist/index.html`).
- Thuộc tính tự thêm vào thẻ module (`data-*`, `onerror=`) **bị bỏ**, còn script inline cổ điển được giữ nguyên chỗ, nguyên chữ. Đã kiểm bằng `vite build` một project mẫu trong scratchpad.
- Vậy không thể gắn bắt lỗi vào chính thẻ script.

**Server** (`packages/server/src/index.ts:23-26`):
- `/build` được cache vĩnh viễn (`immutable`), còn `index.html` luôn kiểm lại. Tải lại luôn lấy HTML mới (đúng tên file mới sau khi đổi bản), còn chunk đã tải xong thì dùng lại từ cache.
- Không nén: script sảnh 10 file, 957 kB (gzip được 300 kB).

**Các cách script sảnh hỏng, và trình duyệt báo thế nào** (đo trên Chromium 153 bằng trang mẫu `page.route`, xem mục Thực nghiệm):

| Hỏng | Ví dụ | Trình duyệt báo | Bắt bằng |
|---|---|---|---|
| Không tải được entry hoặc một module import tĩnh | mất mạng giữa chừng; 404 sau khi đổi bản; Vite dev trả 504; sai MIME; `modulepreload` hỏng | sự kiện `error` (không nổi bọt) trên **thẻ `<script type="module">` entry**, dù file hỏng là module con. Thẻ không bắn `load` | listener `error` **pha capture** trên `window`, lọc `HTMLScriptElement` có `src` cùng origin |
| Chạy lỗi lúc khởi động | `throw` ở top-level; `SyntaxError` (trình duyệt cũ gặp cú pháp mới); import tên không được export | `ErrorEvent` ở `window`, `filename` là URL module (cùng origin). Thẻ script vẫn bắn `load` | cùng listener, lọc `ErrorEvent` có `filename` cùng origin |
| Chậm hoặc treo | 3G yếu, TCP treo không đóng | không sự kiện nào | hẹn giờ |
| Tắt JavaScript | | | `<noscript>` |

### 2. Bộ canh tải

**Vì sao là script inline cổ điển trong `index.html`:**
- Nó phải chạy khi chính script sảnh hỏng, nên không được nằm trong cây module của `main.ts`.
- Không đặt trong file riêng (`public/boot.js`): mạng hỏng thì file đó cũng có thể không tới. HTML đã tới thì script inline chắc chắn chạy.
- Không gắn `onerror` lên thẻ module: bản build bỏ thuộc tính đó (Thiết kế 1).

**Vị trí:** cuối `<body>`, ngay sau `</div>` của `#lobby`, trước thẻ module.
- Lúc nó chạy, các phần tử sảnh đã có.
- Module luôn chạy sau khi HTML parse xong (`defer` mặc định, kể cả khi bản build dời thẻ lên `<head>`), nên sự kiện `error` của nó luôn tới sau khi listener đã gắn. Đã kiểm: module ở `<head>`, listener ở cuối `<body>`, module hỏng ngay lập tức, listener vẫn bắt được.

**Trạng thái:** `loading` → `slow` (hẹn giờ) → `failed` (lỗi thật); từ bất kỳ trạng thái nào → `ready`.

| Từ | Sự kiện | Sang | Làm gì |
|---|---|---|---|
| `loading` | hết `LOBBY_SLOW_MS` | `slow` | hiện thông báo "chậm"; không đụng ô tên, nút, focus |
| `loading`, `slow` | `error` từ thẻ `<script>` cùng origin | `failed` (tải hỏng) | huỷ hẹn giờ; hiện thẻ lỗi; ẩn `#name`, `#join-btn`; focus nút Tải lại |
| `loading`, `slow` | `ErrorEvent` có `filename` cùng origin | `failed` (chạy lỗi) | như trên, khác dòng giải thích |
| `failed` | lỗi khác | `failed` | bỏ qua (giữ lời giải thích đầu tiên) |
| mọi trạng thái | `petgame:lobby-ready` trên `document` | `ready` | huỷ hẹn giờ; gỡ listener `error`; ẩn thông báo; trả `#name`, `#join-btn` (bỏ `hidden`) |

- **Sẵn sàng luôn thắng.** Nếu có báo lỗi nhầm (một lỗi cùng origin không đến từ script sảnh; hiện không có script nào như vậy), sảnh vẫn mở bình thường khi script sảnh chạy xong.
- **Lọc cùng origin:** `url.indexOf(location.origin + "/") === 0`. Lỗi từ script tiện ích trình duyệt (`chrome-extension://…`) hay ảnh hỏng (không phải `<script>`) bị bỏ qua.
- **Không nghe `unhandledrejection`.** Lỗi bất đồng bộ của `main.ts` (tải ảnh, `loadDollArt`) xảy ra sau phần chạy đồng bộ, nên không chặn việc mở khoá; chúng là lỗi lúc vào phòng (đề xuất riêng).
- **`modulepreload` hỏng:** trình duyệt nhớ kết quả hỏng trong bản đồ module và không tải lại file đó, nên thẻ module entry cũng báo `error`. Lọc riêng `<script>` là đủ, không cần nghe `<link>`. Đã kiểm: 1 request, `LINK` rồi `SCRIPT` cùng báo lỗi.

**Sự kiện `petgame:lobby-ready`:**
- Ý nghĩa: "script sảnh đã tải và dựng xong sảnh". Nó **không** có nghĩa "nút đã mở khoá".
- `main.ts` bắn nó trên `document` ngay sau 3 dòng mở khoá.
- Tên sự kiện nằm ở hai nơi (`index.html` và `main.ts`) vì script inline không import được hằng TS. Test chậm (bước 3e) hỏng nếu hai tên lệch nhau.
- Không dùng `MutationObserver` theo dõi `#join-btn` để biết sảnh sẵn sàng: nếu sau này T23 giữ sảnh khoá trong lúc chờ tự vào lại thế giới, bộ canh tải sẽ báo "mạng chậm" oan vì chờ server. Bắn sự kiện rõ ràng thì chỉ đo việc tải script.

**Cú pháp:** JS thuần, cú pháp ES2015 (`var`/`function`, không `?.`, `??`, `async`, class field).
- Vite không biên dịch script inline cổ điển, và `npm run typecheck` không kiểm nó.
- Nó phải chạy được trên cả trình duyệt quá cũ để chạy game, để báo cho họ biết.
- Bọc trong IIFE để không tạo biến toàn cục.

### 3. Thời gian chờ: `LOBBY_SLOW_MS` = 15 000 ms

**Đo** bản build hiện tại (`packages/client/dist`), phục vụ không nén như `express.static`, Chromium với `Network.emulateNetworkConditions`, không cache. Đo thời điểm `#join-btn` mở khoá:

| Mạng | Băng thông, độ trễ | Sảnh sẵn sàng |
|---|---|---|
| không giới hạn | | 0,2 s |
| 4G tốt | 10 Mbps, 50 ms | 1,0 s |
| 4G chậm | 1,6 Mbps, 150 ms | 5,3 s |
| 3G | 750 kbps, 300 ms | 11,3 s |
| 3G chậm | 400 kbps, 400 ms | 20,7 s |
| EDGE | 240 kbps, 800 ms | 34,8 s |

- Cả 6 lần đều tải 985 kB trong 11 file trước khi sẵn sàng. Thời gian ≈ dung lượng / băng thông. Xong trong 15 s cần khoảng 510 kbps.

**Vì sao 15 s:**
- **Không 10 s:** ở 3G (11,3 s), thông báo sẽ hiện 1,3 s trước khi sảnh mở. Người chơi có thể bấm Tải lại oan và tải lại chunk chính 685 kB đang dở.
- **Không 20 s trở lên:** khi mạng treo, 20 giây nhìn "Đang tải..." đứng im là quá lâu (giới hạn chú ý của người dùng khoảng 10 giây). Ở màn hình chính iPhone, nút này là lối thoát duy nhất. 15 s là điểm cân bằng giữa hai điều trên.
- Thông báo ở trạng thái `slow` chỉ nói "vẫn đang tải", không chặn gì và tự biến mất, nên hiện ở 3G chậm/EDGE vẫn đúng sự thật.
- Lỗi thật không chờ hẹn giờ: hiện ngay khi trình duyệt báo.
- Nếu sau này server nén script (đề xuất cuối file), thời gian tải giảm khoảng 3 lần. Vẫn giữ 15 s (biên rộng hơn), không cần đổi.

### 4. Giao diện

**Markup** (trong `#join-form`, ngay sau `#join-btn`, trước `#room-hint`):
```html
<div id="load-status" class="lobby-alert" role="status" aria-live="polite" hidden>
  <strong id="load-title"></strong>
  <p id="load-detail"></p>
  <p id="load-invite" hidden>Link mời vẫn được giữ.</p>
  <button type="button" id="reload-btn" class="lobby-action" aria-describedby="load-title load-detail">Tải lại</button>
</div>
<noscript><p class="error" id="load-noscript">Cần bật JavaScript để chơi PetGame.</p></noscript>
```

`type="button"` là **bắt buộc**. `<button>` không ghi `type` trong form là nút gửi form, nên bấm vào sẽ khiến trình duyệt tự gửi form và tải lại trang ở `/?`, mất `?room=`: đúng lỗi của T1.

**Chữ** (tiếng Việt):

| Trạng thái | `#load-title` | `#load-detail` |
|---|---|---|
| `slow` | Vẫn đang tải… | Mạng có vẻ chậm. Chờ thêm chút, hoặc bấm Tải lại. |
| `failed`, tải hỏng | Không tải được game | Kiểm tra mạng rồi bấm Tải lại. |
| `failed`, chạy lỗi | Không tải được game | Trình duyệt gặp lỗi khi mở game. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt. |

- `#load-invite` ("Link mời vẫn được giữ.") hiện ở cả hai trạng thái khi URL có `?room=`.
- Nút: "Tải lại". Tắt JavaScript: "Cần bật JavaScript để chơi PetGame."
- Chữ "Đang tải..." của T1 giữ nguyên (ba dấu chấm ASCII; test cũ kiểm đúng chuỗi này).

**Hai trạng thái trông thế nào** (đã dựng thử trên `dist/index.html` thật, đo bằng Chromium; ảnh trong scratchpad của phiên):
- **`slow`:**
  - dòng chữ trắng trên nền sảnh, ngay dưới nút "Đang tải..." (nút vẫn hiện, vẫn khoá);
  - nút Tải lại phụ: nền trong suốt, viền trắng 2 px;
  - không lấy focus (Tab tới được);
  - ở 844×390: khối 680×130, đáy nút ở 314 px, không tràn.
- **`failed`:**
  - thẻ sáng giống màn che kết nối của T3 (`.net-box`): nền `#fafcf6`, chữ `#253020`, bo 14 px, đổ bóng;
  - rộng tối đa 420 px, giữa form, thay chỗ ô tên và nút (đã ẩn);
  - nút Tải lại xanh `#7cb342` chữ trắng, **có focus** (Enter hoặc Space là tải lại);
  - thẻ 340×160 (dòng "chạy lỗi" dài hơn: 180) ở 390×844 và 1280×720, 420×160-180 ở 844×390; không tràn ở cả 3 cỡ.
- Nút Tải lại: 140×44 ở cả 3 cỡ (`min-height: 44px; min-width: 140px`).
- Trạng thái chậm rồi tới lỗi thật: chuyển sang thẻ `failed`.

**CSS** (thêm sau `#lobby .error`, `index.html:326`):
```css
/* The lobby's load notice (T15; the watchdog script at the end of <body> fills it). Slow: a quiet line under the locked
   button, which keeps waiting. Failed: a card like the connection screen's, in place of the name box and the button. */
.lobby-alert { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font-size: 14px; line-height: 1.4; }
.lobby-alert[hidden] { display: none; }
.lobby-alert p { margin: 0; }
.lobby-alert strong { font-size: 16px; }
.lobby-alert.failed { width: 100%; max-width: 420px; align-self: center; box-sizing: border-box; padding: 14px 16px; border-radius: 14px;
  background: #fafcf6; color: #253020; box-shadow: 0 8px 28px rgba(0,0,0,0.4); }
.lobby-alert.failed strong { font-size: 18px; }
.lobby-action { min-height: 44px; min-width: 140px; padding: 0 18px; box-sizing: border-box; border: 2px solid rgba(255,255,255,0.6); border-radius: 10px;
  background: transparent; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
.lobby-alert.failed .lobby-action { border: none; background: #7cb342; color: #fff; }
.lobby-action:focus-visible { outline: 3px solid #1e88e5; outline-offset: 2px; }
```
- `.lobby-alert` có `display: flex` nên **phải** có dòng `[hidden] { display: none; }` (cùng kiểu `.party-panel[hidden]`).
- `#name`, `#join-btn`, `#load-invite` không có luật `display` nên thuộc tính `hidden` tự có tác dụng. Đừng thêm `display` cho chúng.
- Tên class chung (`lobby-alert`, `lobby-action`) để T23 dùng lại cho lỗi lúc vào phòng ("Tạo thế giới mới").

**Bàn phím, cảm ứng, trợ năng:**
- Nút Tải lại là `<button>` gốc: Enter, Space, chạm, chuột đều chạy.
- Trong sảnh chưa có `keyboard.ts` của game (chỉ gắn khi vào thế giới), nên không cần tự bắt phím Space như nút "Về sảnh" của T3.
- Khi lỗi: `role="alert"` và focus vào nút; `aria-describedby` đọc tiêu đề và lời giải thích khi nút nhận focus.
- Khi chậm: `role="status"` (đọc nhẹ), không lấy focus.

### 5. "Tải lại"

`location.reload()`:
- Giữ nguyên toàn bộ địa chỉ: `?room=`, `quality` và mọi tham số khác, cả `#…`.
- Lấy `index.html` mới (server luôn kiểm lại), dùng lại các chunk `/build` đã tải xong (cache `immutable`).
- Không tự gọi; chỉ khi người chơi bấm.

### 6. Quan hệ với T1, T3, T23 (không chồng chéo)

**T1:**
- Giữ nguyên hợp đồng: sảnh sẵn sàng khi `#join-btn` mở khoá, e2e chờ `#join-btn:enabled`.
- Bộ canh tải không đổi `disabled` hay chữ của nút. Ở trạng thái `failed` nó ẩn nút (`hidden`), nên `waitFor()` (mặc định chờ hiện) không bao giờ thấy nút cũ của trang hỏng.

**T3** (màn che kết nối `ui/connection.ts`, `.net-overlay`, z-index 6 trong `#game`):
- *Khác chỗ:* thông báo tải nằm trong `#lobby`.
- *Khác lúc:* chỉ có trước khi script sảnh sẵn sàng. Màn che T3 chỉ được tạo trong `startGame`, sau `lobby.remove()` (`main.ts:64-65`).
- Hai thứ không bao giờ cùng có mặt.
- Nút "Về sảnh" của T3 mở một trang mới (`location.assign(lobbyUrl(…))`), nên lần tải đó cũng được bộ canh tải trông.
- Giống nhau về hình (thẻ sáng, nút xanh 44 px, viền focus `#1e88e5`) nhưng CSS riêng, không dùng chung class `.net-*`.

**T23** (vào lại đúng thế giới sau khi tải lại trang; "quyết định cùng T15"):
- Ranh giới: **T15 = lỗi lúc tải trang**, trước khi script sảnh chạy xong. **T23 = lỗi lúc vào phòng** (thế giới đã đóng, đủ 5 người, server không chạy) và việc tự về đúng thế giới sau khi tải lại.
- T15 để sẵn cho T23:
  - "Tải lại" giữ nguyên URL: nếu T23 ghi `?room=<id>` lên thanh địa chỉ, Tải lại cũng về đúng thế giới;
  - class `.lobby-alert`/`.lobby-action` dùng lại được cho thẻ "Thế giới này đã đóng" kèm nút "Tạo thế giới mới";
  - sự kiện `petgame:lobby-ready` chỉ đo việc tải script.
- **Ràng buộc cho T23:** nếu T23 tự vào lại lúc mở trang, `main.ts` vẫn phải bắn `petgame:lobby-ready` ngay khi dựng xong sảnh, trước khi chờ server. Nếu không, bộ canh tải báo "mạng chậm" oan.
- **Đề xuất cho T23 (không ràng buộc):**
  - Chọn hướng ghi `?room=<id>` bằng `history.replaceState`. Lý do: khớp luật hiện có "tải lại trang = rời chủ động" (`docs/design/multiplayer.md`; trang gửi tin rời trong `pagehide`). Khớp `inviteLink`, `lobbyUrl` và nút Tải lại của T15.
  - Hướng `sessionStorage` + `client.reconnect` cần bỏ việc rời chủ động khi tải lại; mã nối lại cũng chỉ sống 20 giây.
  - Khi thế giới trong URL đã đóng: thẻ lỗi kèm "Tạo thế giới mới" (bỏ `?room=`).

### 7. Thực nghiệm đã làm (chỉ đọc; script trong scratchpad của phiên, `t15/`)

1. **`vite build` một project mẫu:** script inline giữ nguyên chỗ; thẻ module bị dời lên `<head>`, mất `data-lobby` và `onerror`.
2. **Sự kiện trên Chromium 153** (trang mẫu qua `page.route`; listener capture ở cuối `<body>`, module ở `<head>`):

   | Trường hợp | Trình duyệt báo | Nút |
   |---|---|---|
   | module con bị abort | `error` trên SCRIPT entry | khoá |
   | module con 404 | như trên | khoá |
   | module con sai MIME | như trên | khoá |
   | `modulepreload` hỏng một lần | `error` trên LINK rồi SCRIPT; chỉ 1 request | khoá |
   | `throw` ở top-level | `ErrorEvent` ở window, `filename` = URL module; SCRIPT bắn `load` | khoá |
   | lỗi cú pháp | như trên | khoá |
   | import tên không export | như trên | khoá |
   | bình thường | chỉ có `ready` | mở |

3. **Đồng hồ giả của Playwright:**
   - `page.clock.install()` rồi `pauseAt(…)` **trước** `goto`, script sảnh bị giữ: để 3 s thời gian thật trôi qua, `fastForward(14000)` vẫn chưa hiện, `fastForward(1000)` thì hiện;
   - thả script thì sảnh mở và thông báo ẩn;
   - `locator.waitFor` vẫn chạy khi đồng hồ dừng.
4. **Đo thời gian tải** (Thiết kế 3).
5. **Dựng thử giao diện** trên `dist/index.html` thật (Thiết kế 4).
   - `page.screenshot` **treo** khi trang chưa tải xong (script bị giữ): Playwright chờ `document.fonts.ready`, mà promise này chỉ xong khi trang tải xong. Cần ảnh trạng thái chậm thì chụp qua CDP `Page.captureScreenshot`.
   - `<noscript>` hiện đúng khi context có `javaScriptEnabled: false`. Dùng locator theo id (`getByText` trúng cả thẻ `noscript`).
6. **Nút Tải lại thiếu `type="button"`** (bản mẫu, mọi script hỏng): cả Enter lẫn click đều đưa trang về `http://game.test/?`. Việc trình duyệt tự gửi form thắng `location.reload()`, nên mất `room` và `quality`. Có `type="button"` thì tải lại đúng `?room=abc&quality=low`.

Đã tắt mọi thứ đã bật: server tĩnh cổng 4599 đóng, không còn Chromium chạy, cây làm việc không đổi (ngoài `PLAN.md` và `docs/design/multiplayer.md`).

## Kế hoạch triển khai

1. **`packages/client/index.html`**
   - a. Chú thích trên form (`:390-392`): giữ nội dung T1, thêm một câu: `#load-status` là thông báo của bộ canh tải (script inline sau `#lobby`, T15).
   - b. Sau dòng `#join-btn` (`:397`): chèn đúng markup ở Thiết kế 4 (`#load-status` rồi `<noscript>`).
   - c. Sau `#lobby .error` (`:326`): chèn đúng khối CSS ở Thiết kế 4.
   - d. Giữa `</div>` của `#lobby` (`:401`) và thẻ module (`:402`): chèn script inline.
     - Hành vi đúng bảng trạng thái ở Thiết kế 2, chữ đúng bảng ở Thiết kế 4.
     - Chú thích đầu script bằng tiếng Anh, nói: vì sao inline/cổ điển; ba tín hiệu; sự kiện `petgame:lobby-ready` do `main.ts` bắn; "sẵn sàng luôn thắng"; vì sao 15 s (số 3G); ràng buộc ES2015.
     - Bản phác tham khảo (coder được sắp lại, giữ hành vi):
     ```html
     <script>
       (function () {
         var LOBBY_SLOW_MS = 15000; // ready in 11 s on 3G (750 kbps), 21 s on slow 3G (400 kbps): docs/design/multiplayer.md
         var box = document.getElementById("load-status");
         var title = document.getElementById("load-title");
         var detail = document.getElementById("load-detail");
         var invite = document.getElementById("load-invite");
         var reload = document.getElementById("reload-btn");
         var nameInput = document.getElementById("name");
         var joinBtn = document.getElementById("join-btn");
         var state = "loading";
         var timer;
         invite.hidden = !new URLSearchParams(location.search).has("room");
         function ours(url) { return typeof url === "string" && url.indexOf(location.origin + "/") === 0; }
         function show(next, head, text) {
           state = next;
           box.className = "lobby-alert " + next;
           title.textContent = head;
           detail.textContent = text;
           box.hidden = false;
         }
         function fail(text) {
           if (state === "ready" || state === "failed") return;
           clearTimeout(timer);
           show("failed", "Không tải được game", text);
           box.setAttribute("role", "alert");
           nameInput.hidden = true;
           joinBtn.hidden = true;
           reload.focus();
         }
         function onError(event) {
           var target = event.target;
           if (target instanceof HTMLScriptElement) {
             if (ours(target.src)) fail("Kiểm tra mạng rồi bấm Tải lại.");
           } else if (event instanceof ErrorEvent && ours(event.filename)) {
             fail("Trình duyệt gặp lỗi khi mở game. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt.");
           }
         }
         timer = setTimeout(function () {
           if (state === "loading") show("slow", "Vẫn đang tải…", "Mạng có vẻ chậm. Chờ thêm chút, hoặc bấm Tải lại.");
         }, LOBBY_SLOW_MS);
         window.addEventListener("error", onError, true);
         reload.addEventListener("click", function () { location.reload(); });
         document.addEventListener("petgame:lobby-ready", function () {
           state = "ready";
           clearTimeout(timer);
           window.removeEventListener("error", onError, true);
           box.hidden = true;
           box.setAttribute("role", "status");
           nameInput.hidden = false;
           joinBtn.hidden = false;
         }, { once: true });
       })();
     </script>
     ```
2. **`packages/client/src/main.ts`**
   - Sau các hằng phần tử (`:13-19`): thêm
     ```ts
     /** Dispatched on document once this script has loaded and set the lobby up; index.html's load watchdog (T15) listens for this exact name. */
     const LOBBY_READY_EVENT = "petgame:lobby-ready";
     ```
   - Ngay sau `joinBtn.textContent = "Vào chơi";` (`:77`): `document.dispatchEvent(new Event(LOBBY_READY_EVENT));`.
   - Sửa chú thích `:73-74` cho nói thêm: rồi báo bộ canh tải của `index.html` (nó ẩn thông báo, thôi chờ).
   - Không đổi gì khác (thân handler, thứ tự các dòng trên).
3. **`tests/e2e/multiplayer.spec.ts`**
   - a. **Hằng**, đặt trước test `lobby:` (cạnh `openWithSwitch` là được), mỗi hằng có JSDoc:
     ```ts
     /** Where Vite dev serves the lobby script (index.html's module entry); on a build it is /build/index-<hash>.js (T16). */
     const LOBBY_SCRIPT = /\/src\/main\.ts(\?.*)?$/;
     /** How long index.html's load watchdog waits before it says the lobby is still loading (docs/design/multiplayer.md). */
     const LOBBY_SLOW_MS = 15_000;
     ```
     Test `lobby:` cũ dùng `LOBBY_SCRIPT` thay biểu thức viết tay.
   - b. **`enterLobby(page, name, press: "click" | "enter" = "click")`:**
     - giữ 3 bước đầu (chờ `#join-btn:enabled`, `fill`, `toHaveValue`);
     - `"enter"` thì `await page.locator("#name").press("Enter")`, ngược lại `page.click("#join-btn")` như cũ;
     - JSDoc thêm: Enter trong ô tên là cách vào bằng bàn phím (form tự gửi, handler `submit` nhận).
     - Mọi chỗ gọi hiện có không đổi.
   - c. **Test hồi quy `lobby:`** (`:1237-1280`):
     - Đổi tên thành `lobby: nothing is sent before the lobby script is ready, by click or by Enter; the invite and the name are kept`.
     - Sau cú bấm `force` (`:1267`), thêm bước bàn phím lúc sảnh còn khoá:
       ```ts
       // The keyboard way, just as impatient: Tab, a name and Enter reach nothing while the lobby is locked.
       await page.keyboard.press("Tab");
       await page.keyboard.type("Early");
       await page.keyboard.press("Enter");
       await expect(page.locator("#name")).toHaveValue("");
       await expect(page.locator("#join-btn")).toBeDisabled();
       ```
     - Thay `await enterLobby(page, "Early");` bằng `await enterLobby(page, "Early", "enter");`. Chú thích: đường bấm nút đã có ở mọi test khác qua `enterLobby`. Các kiểm tra sau giữ nguyên: lỗi "Không vào được", còn `?room=`, đúng 1 lần điều hướng, tên được lưu.
     - Ngay trước `release()`: `await expect(page.locator("#load-status")).toBeHidden();`. Giữ script vài giây (ngắn hơn nhiều so với 15 s) mà không có lỗi thì bộ canh tải không được lên tiếng.
     - Cuối test kiểm lại như vậy: sảnh đã sẵn sàng thì không còn thông báo nào.
   - d. **Test mới 1** (đặt ngay sau test `lobby:`): `lobby: a script that cannot load or breaks while starting says so at once, and Tải lại brings the invite back`.
     - **Phần 1: điện thoại, cảm ứng, script chạy lỗi.** Làm trước vì không tải thế giới WebGL.
       1. Context `{ ...PHONE_SCREENS[0].options }` (đẩy vào `contexts`), `watch(page, "Phone")`.
       2. `route(LOBBY_SCRIPT, (r) => r.fulfill({ contentType: "text/javascript", body: 'throw new Error("test: the lobby script broke while starting");' }))`.
       3. `goto("/?quality=low")`.
       4. Kiểm:
          - `#load-status` `toBeVisible()` **trước** khi kiểm chữ (`toContainText` không tự chờ phần tử hiện);
          - chứa "Không tải được game" và "Trình duyệt gặp lỗi";
          - `#load-invite` ẩn (không có link mời);
          - `#join-btn`, `#name` ẩn.
       5. `unroute(LOBBY_SCRIPT)`, `#reload-btn` `.tap()`.
       6. Chờ `#join-btn:enabled`; nút ghi "Vào chơi"; `#load-status` ẩn.
     - **Phần 2: desktop, bàn phím, script không tải được, vào đúng thế giới được mời.**
       1. Thế giới của người mời mở qua SDK: `const host = await new Client(SERVER).create("world", { name: "Host" }); observers.push(host);`. Chú thích: `"world"` là `ROOM_NAME` của shared; spec không import shared.
       2. Context desktop mới, `watch(page, "Invited")`. Đếm điều hướng khung chính như test `lobby:`.
       3. `route(LOBBY_SCRIPT, (r) => r.abort())`, `goto(\`/?room=${host.roomId}&quality=low\`)`.
       4. Kiểm:
          - `#load-status` hiện, chứa "Không tải được game" và "Kiểm tra mạng";
          - `#load-invite` hiện;
          - `#join-btn`, `#name` ẩn;
          - `#reload-btn` `toBeFocused()`;
          - Chú thích: `expect` mặc định chờ 5 s, ngắn hơn `LOBBY_SLOW_MS` nhiều, nên thẻ lỗi này đến từ báo lỗi của trình duyệt chứ không phải từ hẹn giờ.
       5. Lần lượt 844×390, 390×844, 1280×720 (`setViewportSize`): `boundingBox` của `#reload-btn` cao ≥ 44 và rộng ≥ 44 (thông điệp kèm cỡ màn hình như test `lobby:`).
       6. `unroute(LOBBY_SCRIPT)`, rồi `page.keyboard.press("Enter")` (nút đang có focus).
       7. `enterLobby(page, "Invited")` (chờ nút của trang mới), `waitForWorld(page)`.
       8. Kiểm:
          - `__petgame.room.roomId === host.roomId`;
          - đúng 2 lần điều hướng (mở trang, tải lại);
          - URL còn `room=<host.roomId>` và `quality=low`. Trình duyệt tự gửi form sẽ thành `/?`.
   - e. **Test mới 2:** `lobby: on a slow network it only says it is still loading, then opens by itself; without JavaScript it says so`.
     1. Context `{ ...PHONE_SCREENS[1].options }` (844×390, chỗ chật nhất), `watch(page, "Slow")`. Giữ `LOBBY_SCRIPT` bằng promise như test `lobby:`.
     2. **Trước `goto`:** `await page.clock.install({ time: start }); await page.clock.pauseAt(new Date(start.getTime() + 1000));` với `start` là một `Date` cố định.
        - Chú thích: đồng hồ của trang đứng yên, chỉ test đẩy nó đi, nên mốc 15 s chính xác dù máy chậm.
        - Không chụp ảnh trong test này: trang chưa tải xong thì `page.screenshot` chờ font mãi.
     3. `goto("/?room=no-such-room&quality=low", { waitUntil: "commit" })`; `#join-btn` có chữ "Đang tải...".
     4. `fastForward(LOBBY_SLOW_MS - 1000)`: `#load-status` ẩn.
     5. `fastForward(1000)`: kiểm
        - `#load-status` hiện, chứa "Vẫn đang tải", **không** chứa "Không tải được";
        - `#load-invite` hiện;
        - `#join-btn` hiện, khoá, chữ "Đang tải...";
        - `#name` hiện, khoá;
        - `#reload-btn` hiện, cao ≥ 44, **không** có focus.
     6. Thả script: chờ `#join-btn:enabled`; chữ "Vào chơi"; `#load-status` ẩn. Đây là chỗ bắt lệch tên sự kiện giữa `index.html` và `main.ts`.
     7. **Tắt JavaScript:** context `{ javaScriptEnabled: false }` (đẩy vào `contexts`), `goto("/?quality=low")`, `#load-noscript` hiện với đúng chữ "Cần bật JavaScript để chơi PetGame.".
4. **`docs/architecture.md`**
   - Dòng `main.ts` (mục packages/client), sửa câu "Sảnh sẵn sàng":
     - sau khi mở khoá, `main.ts` bắn `petgame:lobby-ready` trên `document`;
     - đổi "Bấm lúc chưa sẵn sàng thì…" thành "Nếu không khoá, bấm lúc chưa sẵn sàng thì…" (góp ý cũ của reviewer T1).
   - Thêm câu **Canh tải sảnh (T15):**
     - script inline cổ điển cuối `index.html` (vì sao inline; Vite giữ nguyên nó, còn thẻ module bị dời lên `<head>` và mất thuộc tính);
     - listener `error` pha capture trên `window` cho thẻ `<script>` cùng origin và `ErrorEvent` cùng origin → thẻ "Không tải được game";
     - quá `LOBBY_SLOW_MS` 15 s → "Vẫn đang tải…";
     - sự kiện sẵn sàng luôn thắng; Tải lại = `location.reload()`;
     - JS ES2015, không typecheck, e2e `lobby:` kiểm;
     - luật ở `docs/design/multiplayer.md`.
   - Mục Kiểm thử, dòng Helper:
     - `enterLobby` thêm "bấm nút, hoặc Enter trong ô tên (`press: "enter"`)";
     - thêm `LOBBY_SCRIPT` (đường Vite dev phục vụ script sảnh; chạy e2e trên bản build thì đổi) và `LOBBY_SLOW_MS`;
     - thêm cách thử bộ canh tải: `route` `abort` (tải hỏng), `fulfill` module ném lỗi (chạy lỗi), giữ request (chậm);
     - thời gian của trang: `page.clock.install` + `pauseAt` trước `goto`, rồi `fastForward`;
     - không `page.screenshot` khi trang chưa tải xong (chờ `document.fonts.ready` mãi; dùng CDP `Page.captureScreenshot`).
5. **Tự kiểm của coder:**
   - `npm run typecheck`, `npm test`, `npm run build`;
   - `grep -c "petgame:lobby-ready" packages/client/dist/index.html` ra 1: script inline có trong bản build;
   - `npx playwright test -g "lobby:" --workers=1`;
   - ghi `PROGRESS.md`.

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, server. Không đổi khoá `localStorage` (`petgame:name`, `petgame:look`, `petgame:worn`, `petgame:token`). Hồ sơ cũ không bị ảnh hưởng.
- Hợp đồng mới **trong client:**
  - sự kiện DOM `petgame:lobby-ready` (`main.ts` bắn, `index.html` nghe);
  - id `#load-status`, `#load-title`, `#load-detail`, `#load-invite`, `#reload-btn`, `#load-noscript`;
  - class `.lobby-alert`, `.lobby-action`.

## Test

- **Unit (shared):** không có.
  - Bộ canh tải là script inline trong HTML: không thuộc `packages/shared`, không import được từ test.
  - Vitest chạy môi trường Node, không có DOM.
  - Tách nó ra module TS để unit test thì phải nhân đôi code: một bản inline, một bản để test. e2e kiểm nó trong trình duyệt thật.
- **Tích hợp server:** không có (server không đổi).
- **E2E** (`tests/e2e/multiplayer.spec.ts`, bước 3):
  - sửa `enterLobby` (thêm `press`) và test `lobby:` (bàn phím lúc khoá, vào bằng Enter, không báo nhầm);
  - thêm 2 test:
    - lỗi tải và chạy lỗi, Tải lại bằng chạm và bằng Enter, vào đúng thế giới được mời;
    - mạng chậm bằng đồng hồ giả, tắt JS.
  - Cả 3 test bắt đầu bằng `lobby:` nên `-g "lobby:"` chạy đủ.
  - Ước thời gian: test 1 khoảng 10-20 s (vào thế giới WebGL một lần), test 2 và test `lobby:` vài giây.
- **Lệnh cho tester** (tắt server dev trước, cổng 2567 và 5173 phải trống):
  - `npm run typecheck`, `npm test`, `npm run build`, rồi `grep -c "petgame:lobby-ready" packages/client/dist/index.html` (= 1);
  - `npx playwright test -g "lobby:" --repeat-each=5 --workers=1`;
  - `npm run test:e2e` một lần (cả bộ, như CI).
- **Kiểm chứng test bắt được lỗi** (tester, không commit; đổi file **trước** khi bật e2e, vì Vite dev tải lại trang khi file đổi; xong thì trả lại và kiểm `git diff`):
  - bỏ dòng `dispatchEvent` trong `main.ts`: test 2 phải hỏng ở bước thả script (thông báo không ẩn);
  - bỏ `type="button"` của `#reload-btn`: test 1 phải hỏng ở phần 2. Trang tự gửi form về `/?` (đã thấy trên bản mẫu, Thiết kế 7 mục 6), nên vào một thế giới mới thay vì `host.roomId`, và URL mất `room`.
- **Xem bằng mắt** (tester, không commit): ảnh thẻ lỗi ở 3 cỡ. `page.screenshot` được vì trang hỏng vẫn tải xong. Ảnh trạng thái chậm ở 844×390 chụp qua CDP `Page.captureScreenshot`.
- **Lưu ý đọc log:**
  - nhật ký trang của các test mới có `requestfailed script …/src/main.ts` và `pageerror test: the lobby script broke while starting`: do test cố ý gây ra, chỉ in khi test hỏng;
  - terminal `[WebServer]` có thể in lỗi trang do Vite chuyển tiếp (như `MatchMakeError` trong T1): không phải lỗi thật.

## Tiêu chí hoàn thành

- [ ] `index.html`:
  - có markup `#load-status` (`role="status"`, `aria-live="polite"`, `hidden`), `#load-title`, `#load-detail`, `#load-invite` (`hidden`), `#reload-btn` **`type="button"`** có `aria-describedby`;
  - có `<noscript>` với `#load-noscript`;
  - đúng chữ ở Thiết kế 4;
  - có khối CSS `.lobby-alert`/`.lobby-action`, gồm cả `.lobby-alert[hidden] { display: none; }`.
- [ ] Script inline cổ điển (không `type="module"`) nằm sau `#lobby`, trước thẻ module:
  - IIFE, cú pháp ES2015 (không `?.`, `??`, `async`);
  - `LOBBY_SLOW_MS = 15000`;
  - hành vi đúng bảng trạng thái (Thiết kế 2), "sẵn sàng luôn thắng";
  - không đổi `disabled` hay chữ của `#join-btn`.
- [ ] `main.ts`: có `LOBBY_READY_EVENT = "petgame:lobby-ready"` và đúng một `document.dispatchEvent(new Event(LOBBY_READY_EVENT))` ngay sau 3 dòng mở khoá. Thân handler `submit` không đổi.
- [ ] `npm run build`: `dist/index.html` chứa script inline (grep `petgame:lobby-ready` = 1).
- [ ] Spec:
  - `LOBBY_SCRIPT`, `LOBBY_SLOW_MS` có JSDoc;
  - `enterLobby` có `press`;
  - test `lobby:` có bước bàn phím lúc khoá, vào bằng Enter, kiểm `#load-status` ẩn ngay trước khi thả script và ở cuối;
  - 2 test mới đúng các bước 3d, 3e;
  - `force: true` vẫn chỉ ở test `lobby:`;
  - không thêm `waitForTimeout`, không tăng timeout, không `retries`;
  - `page.clock` chỉ ở test chậm, cài và dừng trước `goto`.
- [ ] E2E chứng minh đủ:
  - lỗi tải (abort) và chạy lỗi (module ném lỗi) đều hiện thẻ lỗi ngay (trong thời gian `expect` mặc định, ngắn hơn 15 s);
  - nút Tải lại ≥ 44 px ở 3 cỡ, có focus khi lỗi;
  - Tải lại bằng Enter giữ `?room=` và `quality`, vào đúng thế giới được mời;
  - Tải lại bằng chạm mở được sảnh;
  - mạng chậm: chưa hiện ở 14 s, hiện ở 15 s mà không nói "Không tải được", không lấy focus, sảnh tự mở và thông báo ẩn khi script tới;
  - tắt JS thì hiện câu `<noscript>`.
- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch; `-g "lobby:" --repeat-each=5 --workers=1` qua 15/15; `npm run test:e2e` qua cả bộ.
- [ ] Tester đã làm 2 kiểm chứng "test bắt được lỗi" (mục Test) và xem ảnh 3 cỡ; ghi kết quả vào `PROGRESS.md`.
- [ ] `docs/architecture.md` cập nhật theo bước 4. `docs/design/multiplayer.md` có mục "Mở game: sảnh tải chậm hoặc hỏng" (game-designer đã viết; coder sửa nếu số hay chữ đổi khi làm).

## Rủi ro, câu hỏi mở

Không có CHẶN.

- **Chỉ đo trên Chromium.** Safari và Firefox chưa thử được ở đây. Theo đặc tả HTML: module tải hỏng thì thẻ script bắn `error`, chạy lỗi thì báo ở `window.onerror` với `filename` cùng origin (thẻ module có `crossorigin`, cùng origin nên có đủ chi tiết lỗi). Nếu một trình duyệt không báo, hẹn giờ 15 s vẫn đưa ra nút Tải lại, nên chỉ chậm hơn chứ không kẹt.
- **Báo lỗi nhầm:** một `ErrorEvent` cùng origin không đến từ script sảnh. Hiện trang không có script nào khác ngoài `/@vite/client` ở dev. Luật "sẵn sàng luôn thắng" trả sảnh về bình thường.
- **Vite dev trả 504 "Outdated Optimize Dep"** khi khởi động lạnh: có thể thoáng hiện thẻ lỗi rồi Vite tự tải lại trang. Chỉ ở dev; trước T15 trang khi đó cũng kẹt ở "Đang tải...".
- **Tên sự kiện nằm ở hai file.** Test 2 (bước thả script) hỏng nếu lệch.
- **Script inline không được typecheck.** Giữ ngắn (khoảng 50 dòng), e2e phủ mọi nhánh: tải hỏng, chạy lỗi, chậm, sẵn sàng sau khi chậm.
- **CSP:** project chưa có Content-Security-Policy. Nếu sau này thêm thì phải cho phép script inline này (hash), nếu không bộ canh tải mất tác dụng.
- **T13 (service worker):** SW phải lấy `index.html` từ mạng trước (network-first) hoặc kiểm phiên bản. Nếu không, Tải lại có thể lấy lại đúng bản HTML cũ trỏ tới chunk đã mất.
- **T16 (e2e trên bản build):** `LOBBY_SCRIPT` phải đổi thành chunk entry của bản build (`/build/index-*.js`). Ba test `lobby:` dùng chung hằng này nên chỉ sửa một chỗ.
- **Tải lại lúc mạng chậm** làm mất phần chunk đang tải dở (chunk đã xong vẫn ở cache). Chữ của trạng thái `slow` khuyên chờ trước.
- Ở 844×390, sảnh đầy đủ (có khung chọn ngoại hình) vốn đã cuộn được (có từ trước, không do T15; việc cỡ sảnh thuộc T18). Thông báo tải chỉ hiện khi khung chọn ngoại hình chưa có, nên không làm sảnh dài thêm.

## Đề xuất việc mới cho `TASKS.md`

- **P2, mới: "Vào thế giới hỏng sau sảnh thì màn hình trống."**
  - Hiện trạng: `startGame` chạy sau `lobby.remove()` (`main.ts:64-65`). Nếu chunk động của PixiJS (`browserAll-*.js`, `init-*.js`, tải trong `app.init`) hoặc `Game.create` hỏng, handler ghi chữ lỗi vào sảnh đã bị gỡ: người chơi thấy màn hình tối, không chữ, không nút.
  - Kèm: ảnh (`loadPalSprites`, `loadPictures`, `loadDollArt`) hỏng làm `assets` hỏng, sảnh báo sai "đầy 5 người hoặc server chưa chạy".
  - Gợi ý: chỉ gỡ sảnh sau khi `Game.create` xong, hoặc hiện màn che kiểu T3 với nút Tải lại; phân biệt chữ lỗi. Dùng lại `.lobby-alert`.
- **P3, mới: "Server nén script."**
  - Express không nén: script sảnh 957 kB qua mạng; gzip còn 300 kB, brotli 257 kB.
  - Ở 3G chậm, sảnh sẵn sàng sau 20,7 s; nén thì còn khoảng 7 s.
  - Cách làm: middleware nén, hoặc tạo sẵn `.br`/`.gz` lúc build rồi phục vụ theo `Accept-Encoding`. Cân nhắc thêm dependency.
  - Đo lại theo cách ở Thiết kế 3: phục vụ `dist` như server thật, Chromium với `Network.emulateNetworkConditions`, đo lúc `#join-btn` mở khoá. Script đo của T15 nằm trong scratchpad, có thể đã mất.
- **Cập nhật mô tả T23:**
  - T15 đã làm lỗi lúc tải trang;
  - T23 làm lỗi lúc vào phòng (thế giới đã đóng → "Tạo thế giới mới") bằng `.lobby-alert`/`.lobby-action`;
  - phải bắn `petgame:lobby-ready` trước khi chờ server nếu tự vào lại;
  - đề xuất hướng `history.replaceState` `?room=` (lý do ở Thiết kế 6).
- **Ghi chú cho T13:** `index.html` network-first (rủi ro ở trên).
- **Ghi chú cho T16:** đổi `LOBBY_SCRIPT`.
