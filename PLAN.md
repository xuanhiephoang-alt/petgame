# PLAN: T44 Trình duyệt không chạy được module báo sai nguyên nhân

Code đọc ở `2072fd2` ("Mark T43 done, add T87, start T44"). Nguồn: dòng T44 trong `TASKS.md`; `REVIEW.md` và `PROGRESS.md` của commit T15 `449ae87` (mục "Góp ý không bắt buộc"); `packages/client/index.html` (CSS `#lobby`, `.lobby-alert`, markup `#load-status`, script canh tải inline); `packages/client/src/main.ts` (chỗ mở khoá sảnh và bắn `petgame:lobby-ready`); `packages/client/vite.config.ts`; `dist/index.html` của bản build có sẵn (Vite dời thẻ module lên `<head>`, giữ nguyên script inline); `node_modules/vite` 8.3.3 (không xử lý riêng `nomodule`); `tests/e2e/*.spec.ts`; `playwright.config.ts`; `docs/architecture.md`, `docs/design/multiplayer.md`, `docs/deploy.md`; `PLAN.md` T12 (`a23575d`, ngoại lệ chữ của `index.html`). Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Không có việc hình ảnh.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts` (đụng phần T63 đang cất trong `git stash`). Không chạy `git stash`.

## Mục tiêu

Trình duyệt không hỗ trợ `<script type="module">` (IE11, Safari ≤ 10.0 / iOS ≤ 10.2, Chrome và Android WebView ≤ 60, Firefox ≤ 59, Edge ≤ 15, Samsung Internet ≤ 8.0, trình duyệt cài sẵn trong app chat đời cũ) lặng lẽ bỏ qua thẻ module. Không có lỗi nào để bộ canh tải (T15) bắt, nên sau 15 giây người chơi đọc "Vẫn đang tải… Mạng có vẻ chậm" và đi kiểm tra mạng, trong khi chờ bao lâu cũng không vào được. Sau T44, trình duyệt đó hiện **ngay** thẻ "Hãy cập nhật trình duyệt" kèm địa chỉ trang để mở bằng trình duyệt khác.

Kèm theo là các chỗ dọn nhỏ T15 còn để lại trong `index.html` và tài liệu: trình đọc màn hình đọc thẻ lỗi đúng mức khẩn, focus không rơi về `body` sau một lần báo nhầm, chữ "lại" không còn nằm một mình trên dòng ở 390×844, và một câu trỏ nhầm trong `docs/architecture.md`.

## Phạm vi

**Làm (chỉ `packages/client/index.html`, một unit test, một spec e2e mới, tài liệu):**
1. Thêm `<script nomodule>` báo cho bộ canh tải biết trình duyệt không chạy module; bộ canh tải hiện thẻ "Hãy cập nhật trình duyệt" (trạng thái mới `outdated`).
2. Bộ canh tải bỏ `URLSearchParams`. Đây là điều kiện để mục 1 chạy được: IE11, iOS 10.0-10.2 và Edge ≤ 16 không có `URLSearchParams`, nên hiện nay bộ canh tải ném lỗi ngay ở dòng đó, trước khi đặt hẹn giờ hay listener.
3. CSS của sảnh không dựa vào `inset` và `min()`. Mọi trình duyệt không chạy module cũng không hiểu hai thứ này. Nếu thiếu, `#lobby` (`position: fixed` mà không có toạ độ) rơi xuống dưới `#game` cao 100vh, bị `overflow: hidden` che, và thẻ mới không bao giờ hiện ra. Thay bằng khai báo tương đương, hình trên trình duyệt mới giữ nguyên từng pixel.
4. Dọn T15: bỏ `aria-live="polite"` trên `#load-status`; chuyển focus về `#name` sau một lần báo nhầm; thêm dấu cách không ngắt trong "Tải lại" ở các câu của bộ canh tải; sửa câu "`join` (hai cái trước)" trong `docs/architecture.md`.
5. Unit test tĩnh cho hai script inline (chỉ cú pháp ES5, không dùng API mới). Spec e2e mới `tests/e2e/lobby.spec.ts`.
6. Tài liệu: `docs/design/multiplayer.md`, `docs/architecture.md`, `docs/deploy.md` (ghi chú CSP).

**KHÔNG làm:**
- Không sửa `tests/e2e/multiplayer.spec.ts`. Hai mục trong dòng T44 nằm hẳn trong file đó nên **bị loại khỏi kế hoạch này** (xem cuối file, đề xuất chuyển sang T20):
  - `test.slow()` ngoài kế hoạch: test `lobby: a script that cannot load or breaks while starting says so at once, …` (khoảng dòng 1852).
  - Siết bằng `#load-invite`: test `lobby: nothing is sent before the lobby script is ready, …` (trước dòng kiểm `#load-status` ẩn, khoảng 1641) và test `lobby: on a slow network …` (trước `fastForward` đầu, khoảng 2026).

  Kế hoạch này giữ nguyên dấu hiệu mà hai bước siết đó dựa vào (Thiết kế 3, "Giữ").
- Không sửa `main.ts`, `strings.ts` hay mã TypeScript nào của client. Chữ "Thử lại"/"Tải lại" trong `JOIN_TEXT` giữ nguyên: chưa ai thấy chúng xuống dòng mồ côi.
- Không thêm `@vitejs/plugin-legacy` hay bản build cho trình duyệt cũ: game cần WebGL và JS mới, mục tiêu chỉ là báo đúng nguyên nhân.
- Không thêm Content-Security-Policy. Không đổi server, schema, message, `Profile`.
- Không nới mục tiêu build của Vite. Trình duyệt *có* module nhưng cũ hơn mục tiêu build (mặc định của Vite 8) sẽ gặp lỗi cú pháp trong module, và vẫn nhận thẻ "Trình duyệt gặp lỗi … hãy cập nhật trình duyệt" như từ T15.

## Thiết kế

### 1. Vì sao dùng `<script nomodule>` báo bằng sự kiện, không tự phát hiện trong bộ canh tải

- `nomodule` là phán quyết của chính trình duyệt: trình duyệt chạy module thì bỏ qua script có thuộc tính này. Trình duyệt cũ không biết thuộc tính `nomodule` nên chạy script như script thường, và cũng không biết `type="module"` nên bỏ qua thẻ module. Phép thử `'noModule' in HTMLScriptElement.prototype` cho cùng kết quả, nhưng `TASKS.md` đã chọn `nomodule`, và cách này không cần đoán.
- Script `nomodule` **không tự sửa DOM**. Nó chỉ bắn sự kiện `petgame:no-modules` lên `document`, còn bộ canh tải tự đổi trạng thái. Như vậy:
  - chỉ còn một bảng trạng thái: hẹn giờ 15 s bị huỷ nên không bao giờ đè "Vẫn đang tải…" lên thẻ;
  - "sẵn sàng luôn thắng" vẫn đúng: `petgame:lobby-ready` ẩn thẻ (xem mục Safari 10.1 dưới);
  - mọi chữ của bộ canh tải nằm ở một chỗ.
- Tạo sự kiện bằng `document.createEvent("Event")` + `initEvent("petgame:no-modules", false, false)`, vì IE11 không có `new Event`/`new CustomEvent`.
- **Thứ tự trong `<body>`:** script canh tải → script `nomodule` → thẻ module. Listener phải có trước khi sự kiện bắn. Ở bản build, thẻ module đã nằm ở `<head>`, thứ tự này không đổi gì.
- **Safari 10.1 / iOS 10.3:** có module nhưng không biết `nomodule`, nên chạy **cả hai**. Thẻ "cập nhật" hiện lên trong lúc parse. Sau đó:
  - module lỗi cú pháp (gần như chắc chắn, vì Vite 8 nhắm trình duyệt mới hơn nhiều): `fail()` bị bỏ qua khi đang `outdated`, thẻ "cập nhật" ở lại. Đúng nguyên nhân.
  - nếu sảnh vẫn chạy được: `petgame:lobby-ready` ẩn thẻ, sảnh dùng bình thường.

  Không bao giờ có chuyện sảnh chạy được mà vẫn bị khoá.

### 2. Thẻ "Hãy cập nhật trình duyệt" (trạng thái `outdated`)

Dùng hình dạng thẻ `failed` của T15 (nền sáng, bo góc, bóng), đặt cùng chỗ: thay ô tên và nút "Đang tải...".

| Phần | Nội dung |
|---|---|
| Tiêu đề (`#load-title`) | `Hãy cập nhật trình duyệt` |
| Dòng giữa (`#load-detail`) | `Trình duyệt này quá cũ nên không mở được PetGame. Cập nhật trình duyệt, hoặc mở link dưới đây bằng một trình duyệt khác.` |
| Link (`#load-link`, mới) | địa chỉ đầy đủ của trang (`location.href`, gồm `?room=` của link mời): chữ thường, chọn được, không phải nút |
| `#load-invite` ("Link mời vẫn được giữ.") | ẩn: link đã hiện đầy đủ ở trên |
| Nút Tải lại | ẩn: tải lại trên cùng trình duyệt không giúp gì, có nút sẽ gây hiểu nhầm |
| Ô tên, nút "Đang tải..." | ẩn (như `failed`) |

Lý do có dòng link: người chơi mở link mời từ app chat (Zalo, Messenger…) trên điện thoại cũ thường đang ở trình duyệt cài sẵn trong app. Việc họ làm được ngay là chép link sang trình duyệt khác; thanh địa chỉ của trình duyệt trong app thường bị giấu.

- **Không có chỗ chạm:** thẻ không có nút, nên luật 44×44 không áp dụng; test kiểm thẻ không có nút nào đang hiện. Link là chữ thường (`<p>`), không phải `<a>`: chạm vào `<a>` sẽ tải lại trang trong chính trình duyệt cũ. Chọn chữ bằng giữ ngón (điện thoại) hoặc kéo chuột vẫn được; `user-select: all` cho một lần chạm chọn hết.
- **Bàn phím:** không có gì để bấm, không chuyển focus. Người dùng bàn phím trên máy tính chép từ thanh địa chỉ.
- **Trình đọc màn hình:** `role="alert"` (bộ canh tải đặt khi hiện thẻ, như `failed`), mức khẩn `assertive` ngầm định, nên được đọc ngay.
- **Khổ màn hình:**
  - 390×844: thẻ rộng 340 px, dòng giữa khoảng 3 dòng, link 1-2 dòng.
  - 844×390: thẻ tối đa 420 px; cả thẻ cộng tiêu đề game cao khoảng 200 px, vừa màn hình.
  - 1280×720: như thẻ `failed`.
  - Link dài thì ngắt ở bất cứ ký tự nào (`word-break: break-all`), không đẩy trang rộng ra.

### 3. Bộ canh tải sau T44 (trạng thái và quy tắc)

| Trạng thái | Vào từ | Do | Hiện |
|---|---|---|---|
| `loading` | (đầu) | | không gì |
| `slow` | `loading` | hẹn giờ 15 s | dòng "Vẫn đang tải…" + nút Tải lại phụ (như T15) |
| `outdated` (mới) | `loading`, `slow` | sự kiện `petgame:no-modules` | thẻ mục 2; huỷ hẹn giờ |
| `failed` | `loading`, `slow` | lỗi tải hoặc chạy cùng origin | thẻ "Không tải được game" (như T15) |
| `ready` | mọi trạng thái | `petgame:lobby-ready` | ẩn thông báo; trả ô tên và nút |

- **`failed` không đè `outdated`:** trong trình duyệt cũ, mọi lỗi sau đó đều là hệ quả, và "cập nhật trình duyệt" là nguyên nhân thật.
- **`outdated` không đè `failed`:** trên thực tế không xảy ra, vì script `nomodule` chạy trong lúc parse, trước mọi lỗi tải module.
- **Không còn `URLSearchParams`:** thay bằng `/[?&]room(?:[=&]|$)/.test(location.search)`, cho cùng kết quả với `URLSearchParams#has("room")` ở cả `?room=x`, `?room=`, `?room`, `?a=1&room=x`, và đúng là không khớp `?roomy=1` hay `?xroom=1`. Khoá viết dạng mã hoá (`r%6Fom`) thì bỏ qua: link mời của game không bao giờ tạo ra dạng đó.
- **Giữ:** dòng đặt `invite.hidden` lúc khởi động. Từ T15, với `?room=`, `#load-invite` mất thuộc tính `hidden` ngay khi bộ canh tải chạy, dù khung thông báo còn ẩn. Đây là dấu hiệu "bộ canh tải đã chạy" mà bước siết test chuyển sang T20 sẽ dùng, và `lobby.spec.ts` cũng dùng. `show()` chỉ thêm việc ẩn nó khi `outdated`.
- **Focus sau báo nhầm:** khi `ready` đến, nếu `document.activeElement` đang là nút Tải lại (thẻ `failed` đã tự đặt focus ở đó) thì focus chuyển sang `#name`, *sau* khi bỏ `hidden` của ô tên (`main.ts` đã mở khoá ô tên trước khi bắn sự kiện). Không có báo nhầm, hoặc người chơi đã tự chuyển focus đi chỗ khác, thì không đụng tới focus. Chọn `#name` (theo góp ý của reviewer T15) vì đó là việc kế tiếp của người chơi, và Enter trong ô tên là vào chơi. Trên điện thoại, `focus()` không do người chơi chạm thì không bật bàn phím ảo.
- **`aria-live`:** bỏ thuộc tính này khỏi markup `#load-status`. `role="status"` vốn ngầm là `polite`, còn khi bộ canh tải đổi sang `role="alert"` thì mức `assertive` ngầm định không còn bị đè.
- **Không mồ côi chữ "lại":** cả ba câu có "Tải lại" trong bộ canh tải viết `Tải lại` (escape trong chuỗi JS; không dán ký tự NBSP vô hình vào mã nguồn). Chữ người chơi thấy không đổi. Các test cũ chỉ kiểm "Vẫn đang tải", "Kiểm tra mạng", "Trình duyệt gặp lỗi", "Không tải được game", nên vẫn qua.
- **Cú pháp ES5 và API cũ:** bộ canh tải phải chạy trên IE11, nếu không nó không nhận được sự kiện `nomodule`. Hiện nó đã chỉ dùng cú pháp ES5. Các API còn lại (`location.origin`, `ErrorEvent`, `HTMLScriptElement`, thuộc tính `hidden`, `textContent`, `addEventListener`; tuỳ chọn `{ once: true }` mà IE11 hiểu thành capture, vô hại) đều có từ IE11, Safari 9, Chrome 49. Sửa chú thích "Plain ES2015 on purpose" thành ES5. Unit test giữ luật này (mục Test).

### 4. Chữ người chơi thấy: đặt ở đâu (theo T12)

Luật T12: chữ client nằm trong `ui/strings.ts`. **Ngoại lệ đã ghi trong PLAN T12** (`a23575d`): chữ tĩnh của `index.html` và chữ của script canh tải inline, vì chúng chạy trước mọi module, không import được bảng chữ. Trên trình duyệt không chạy module, `strings.ts` càng không bao giờ được nạp. Vì vậy chữ mới (tiêu đề, dòng giữa của thẻ `outdated`) nằm trong script canh tải, cạnh ba câu của T15; script `nomodule` không chứa chữ nào. Ghi ngoại lệ này vào dòng "Chữ người chơi thấy" của `docs/architecture.md` (hiện chưa nhắc). `scripts/viStrings.mjs` chỉ đếm `packages/*/src/**/*.ts`, nên không đổi số đếm.

### 5. CSS cho trình duyệt cũ (thay tương đương, không đổi hình)

| Quy tắc | Hiện | Thành |
|---|---|---|
| `#lobby` | `inset: 0;` | `top: 0; right: 0; bottom: 0; left: 0;` |
| `#lobby form` | `width: min(340px, 92vw);` | `width: 92vw; max-width: 340px;` |
| `@media (min-width: 601px) #lobby form` | `width: min(420px, 92vw);` | `width: 92vw; max-width: 420px;` |
| `@media (max-height: 560px) and (min-width: 560px) #lobby form` | `width: min(680px, 94vw);` | `width: 94vw; max-width: 680px;` |

Vì `min(A, B)` = B chặn trên ở A, nên mỗi dòng thay cho kết quả y hệt. Trong media query, `max-width` mới đè `max-width` cũ vì cùng độ đặc hiệu và đứng sau. Thêm chú thích một dòng tiếng Anh trên `#lobby`: sảnh và thẻ T44 phải hiện được trên trình duyệt không hiểu `inset`/`min()`.

Phần còn lại không sửa: `gap` của flex (thiếu thì các dòng chỉ sát nhau hơn), `system-ui` (đã có `sans-serif` dự phòng), `100dvh` (đã có `100vh` trước). Phần HUD và thế giới không bao giờ hiện trên trình duyệt cũ.

CSS thẻ:
- `.lobby-alert.failed` và `.lobby-alert.failed strong` thêm selector `.lobby-alert.outdated` (cùng hình thẻ).
- `#load-link` mới: `width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; background: #e8efe0; color: #253020; font-size: 13px; word-wrap: break-word; word-break: break-all; -webkit-user-select: all; user-select: all;`.

### 6. Content-Security-Policy

Hiện server không đặt CSP. Đã kiểm `packages/server/src/webClient.ts` và `index.ts`: chỉ có `Content-Encoding`. `docs/deploy.md` ghi "Nếu thêm Content-Security-Policy (hiện chưa có)…". Vì vậy **không cần hash** cho script inline mới. Chỉ sửa ghi chú: nay có **hai** script inline (bộ canh tải và `nomodule`), mỗi cái cần một hash `sha256-…`, và hash đổi mỗi khi chữ trong script đổi. Service worker (T13) băm cả `index.html` vào phiên bản, nên bản build mới tự có cache mới; không phải làm gì.

## Kế hoạch triển khai

1. **`packages/client/index.html`, CSS** (Thiết kế 5): thay `inset` của `#lobby` và ba `width: min(…)` của `#lobby form`; thêm `.lobby-alert.outdated` vào hai selector của thẻ `failed`; thêm quy tắc `#load-link`. Sửa chú thích CSS trên `.lobby-alert` (T15): thêm "Outdated (T44): the failed card's look, no button."
2. **`index.html`, markup `#load-status`:**
   - bỏ `aria-live="polite"`, giữ `role="status"`;
   - thêm `<p id="load-link" hidden></p>` sau `#load-invite`, trước `#reload-btn`;
   - trong chú thích đầu form, nối vào câu về `#load-status`: "…and the card for a browser that cannot run modules (T44, the nomodule script after the watchdog)".
3. **`index.html`, script canh tải** (Thiết kế 3):
   - `var invited = /[?&]room(?:[=&]|$)/.test(location.search);` thay cho dòng `URLSearchParams`; giữ `invite.hidden = !invited;` lúc khởi động.
   - Thêm `var link = document.getElementById("load-link");`.
   - `show(next, head, text)` đặt thêm: `reload.hidden = next === "outdated"`, `invite.hidden = !invited || next === "outdated"`, `link.hidden = next !== "outdated"`.
   - `fail()`: điều kiện thoát thêm `state === "outdated"`.
   - Hàm mới `outdated()`: thoát nếu `state` là `ready`, `failed` hoặc `outdated`; `clearTimeout(timer)`; `link.textContent = location.href`; `show("outdated", …)` với chữ ở Thiết kế 2; `box.setAttribute("role", "alert")`; ẩn `nameInput`, `joinBtn`; không gọi `focus()`.
   - `document.addEventListener("petgame:no-modules", outdated);`. Đặt tên sự kiện vào một `var NO_MODULES_EVENT` có chú thích nói script `nomodule` bắn nó.
   - Handler `petgame:lobby-ready`: đầu handler ghi `var refocus = document.activeElement === reload;`; cuối handler (sau khi bỏ `hidden` của ô tên và nút) `if (refocus) nameInput.focus();`.
   - Ba câu có "Tải lại" viết `Tải lại`.
   - Sửa chú thích khối: "Plain ES2015" → ES5 (cú pháp và API; IE11, Safari 9, Chrome 49 phải chạy được vì nó hiện cả thẻ T44); thêm tín hiệu thứ tư (sự kiện từ script `nomodule`).
4. **`index.html`, script `nomodule` mới**, ngay sau script canh tải, trước thẻ module. IIFE ES5: tạo sự kiện bằng `createEvent`/`initEvent`, rồi `document.dispatchEvent`. Chú thích HTML ngay trên nó (tiếng Anh) nói ba điều:
   - trình duyệt chạy module bỏ qua script này;
   - trình duyệt cũ chạy nó, còn Safari 10.1 chạy cả nó lẫn module, và "ready" vẫn thắng;
   - nó phải đứng sau bộ canh tải.
5. **Unit test** `packages/client/src/indexHtml.test.ts` (mục Test).
6. **E2E** `tests/e2e/lobby.spec.ts` (mục Test).
7. **Tài liệu** (mục Tài liệu).
8. Chạy `npm run typecheck`, `npm test`, `npm run build`, rồi xem `packages/client/dist/index.html`: script `nomodule` còn nguyên, đứng sau bộ canh tải. Rồi chạy `npx playwright test tests/e2e/lobby.spec.ts` và cả `npm run test:e2e`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, server. Sự kiện DOM mới `petgame:no-modules` chỉ đi trong trang (từ script `nomodule` sang bộ canh tải); `main.ts` không biết đến nó. Phiên bản service worker tự đổi vì `index.html` đổi.

## Test

### Unit: `packages/client/src/indexHtml.test.ts` (mới; Vitest, Node, không DOM)

Đọc `packages/client/index.html` (`new URL("../index.html", import.meta.url)`). Bỏ chú thích HTML `<!-- … -->` trước khi tìm thẻ: chú thích của bộ canh tải có chữ `<script>`. Dùng `typescript` (devDependency gốc, `scripts/viStrings.mjs` đã dùng) để phân tích.

1. Có đúng 2 script inline cổ điển (không `src`, không `type="module"`). Cái đầu không có thuộc tính; cái thứ hai có đúng thuộc tính `nomodule`. Thứ tự: canh tải < `nomodule` < `<script type="module"`.
2. Mỗi script không có lỗi cú pháp (`ts.transpileModule(code, { reportDiagnostics: true })`) và **chỉ dùng cú pháp ES5**. Duyệt AST và báo lỗi kèm dòng nếu gặp:
   - `let`/`const`, hàm mũi tên, template literal;
   - `class`, spread hoặc rest, destructuring, tham số mặc định;
   - viết tắt thuộc tính hay phương thức trong object, thuộc tính tính toán;
   - `for…of`, `async`/`await`, `?.`, `??`, `**`.
3. Không dùng API thiếu trên IE11 / iOS 10.0: không có định danh `URLSearchParams`, `CustomEvent`, `Promise`, `fetch`, `Map`, `Set`, `Symbol`; không gọi thuộc tính tên `includes`, `startsWith`, `endsWith`, `closest`, `append`, `prepend`, `remove`, `replaceWith`, `forEach`, `assign`, `from`. Danh sách là hằng có JSDoc nói lý do (trình duyệt không chạy module vẫn phải chạy hai script này).
4. Chuỗi `"petgame:no-modules"` có trong cả hai script, nghĩa là bên bắn và bên nghe cùng tên.
5. Không chuỗi nào trong hai script chứa "Tải lại" với dấu cách thường. So trên `node.text` của string literal, tức sau khi giải escape.
6. Thẻ `#load-status` trong markup không có `aria-live`.

Chạy thử đỏ: trên HEAD, test hỏng ở mục 1 (chưa có `nomodule`), mục 3 (`URLSearchParams`), mục 5 và mục 6.

### E2E: `tests/e2e/lobby.spec.ts` (mới; không vào thế giới, không WebGL, không `test.slow()`)

**Cách giả lập trình duyệt không có module, và vì sao.** Playwright chỉ có Chromium (Firefox và WebKit của nó đều chạy module), và không có cờ tắt module. Ta chọn **viết lại HTML trước khi trang nhận** (`page.route` cho chính tài liệu `/`):
- mọi `type="module"` thành `type="text/x-no-modules"`: kiểu lạ nên Chromium coi là khối dữ liệu, không tải, không chạy. Đó đúng là điều trình duyệt cũ làm với `type="module"`.
- bỏ thuộc tính `nomodule`: trình duyệt cũ không biết thuộc tính này nên chạy script như script thường.

Sau hai thay thế, Chromium đi đúng đường của trình duyệt cũ, và đi qua đúng HTML thật mà server gửi, ở cả Vite dev lẫn **bản build** (Vite dời thẻ module và thêm `modulepreload` khi build; ta phải chắc nó không làm hỏng script `nomodule`). Không chọn:
- unit test markup thuần, vì nó không chứng minh được hẹn giờ 15 s bị huỷ hay thẻ thật sự nằm trong khung nhìn;
- `addInitScript` bắn sự kiện giả, vì nó bỏ qua đúng phần cần kiểm: script `nomodule` có thật trong trang và bản build giữ nó.

Phần không giả lập được (cú pháp ES5 và API cũ) do unit test giữ. Để thẻ không rơi khỏi màn hình trên trình duyệt cũ, bản viết lại còn **bỏ mọi khai báo `inset: …` và `width: min(…)`** trong `<style>` (CSS bỏ qua khai báo nó không hiểu). Ví dụ regex: `/\binset:[^;}]*;?/g` và `/(^|[{;\s])width:\s*min\([^;}]*;?/g` → `"$1"`; regex sau không khớp `max-width`. Sau Thiết kế 5, sảnh không còn dùng hai thứ này. Ai thêm lại vào `#lobby` sẽ làm test hỏng.

Cách viết lại:
- `route.fetch()` → `await response.text()`, thay chuỗi, rồi `route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body })`. Không truyền header của response gốc: bản build gửi `Content-Encoding: br`, mà body đã được giải nén.
- Test kiểm số lần thay (`type="module"` ≥ 1, `nomodule` đúng 1, `inset` ≥ 1, `width: min(` ≥ 1) để test không qua suông khi markup đổi.

Hằng và helper, chép như `pwa.spec.ts`/`rejoin.spec.ts` (chú thích: "Copied because T63 holds multiplayer.spec.ts; to be gathered in T16"):
- `contexts` + `afterEach` đóng context;
- `VITE = "http://localhost:5173"`, `BUILT = "http://localhost:2567"`;
- `LOBBY_SLOW_MS = 15_000`;
- `ENTRY` theo origin: dev `/\/src\/main\.ts(\?.*)?$/`, build `/\/build\/index-[\w-]+\.js(\?.*)?$/`;
- `PHONE` (390×844, `hasTouch`, `isMobile`);
- `SIZES` = 844×390, 390×844, 1280×720;
- helper `oldBrowserPage(origin, { keepModules })` trả trang đã gắn route viết lại.

Các test (mọi context giữ `serviceWorkers: "block"` của cấu hình, nên route bắt được tài liệu):

1. **`lobby (dev|build): a browser without modules is told at once to update it, never that the network is slow`** (vòng lặp sinh 2 test, một cho `VITE`, một cho `BUILT`). Điện thoại dọc, chạm.
   - Đếm request khớp `ENTRY`.
   - `page.clock.install` + `pauseAt` trước `goto("/?room=abc123&quality=low")`.
   - Trong 5 s mặc định của `expect` (thẻ phải hiện ngay, không chờ hẹn giờ):
     - `#load-status` hiện, có class `outdated`;
     - `#load-title` là "Hãy cập nhật trình duyệt"; `#load-detail` chứa "quá cũ" và "trình duyệt khác";
     - `#load-link` có text bằng `page.url()` (gồm `room=abc123`);
     - `#reload-btn`, `#load-invite`, `#name`, `#join-btn` ẩn;
     - `#load-status` có `role="alert"` và không có `aria-live`;
     - không có `button` nào đang hiện trong `#load-status`.
   - `fastForward(LOBBY_SLOW_MS + 1000)`: vẫn class `outdated`, không chứa "Vẫn đang tải". Đây chính là lỗi của T44.
   - Số request khớp `ENTRY` = 0, tức module không hề chạy.
   - Ở 3 khổ `SIZES`:
     - `#load-title` và `#load-link` `toBeInViewport()`;
     - `document.documentElement.scrollWidth <= innerWidth` (trang không cuộn ngang);
     - `#load-link` có `scrollWidth <= clientWidth` (link ngắt dòng, không tràn).
2. **`lobby: a browser that runs both (modules but no nomodule, like Safari 10.1) ends on the working lobby`** (dev, máy tính).
   - `oldBrowserPage(VITE, { keepModules: true })`: chỉ bỏ thuộc tính `nomodule`, giữ `type="module"`. Giữ request `ENTRY` lại.
   - `goto("/?quality=low")`: thẻ `outdated` hiện.
   - Thả request: `#join-btn:enabled` có chữ "Vào chơi"; `#load-status` ẩn với `role="status"`; `#name` hiện. Đây là "sẵn sàng luôn thắng".
3. **`lobby: Tải lại stays whole on its line, the alert is assertive, and after a false alarm the focus goes to the name box`** (dev, máy tính, rồi khổ điện thoại; không viết lại HTML).
   - Giữ request `ENTRY`. `clock.install` + `pauseAt`. `goto("/?room=no-such-room&quality=low", { waitUntil: "commit" })`.
   - Chờ `#load-invite` **không có** thuộc tính `hidden`: dấu hiệu bộ canh tải đã chạy (Thiết kế 3, "Giữ").
   - `fastForward(LOBBY_SLOW_MS)` → "Vẫn đang tải…". Ở 390×844 (lỗi T15 đã ghi), 844×390 và 1280×720, `page.evaluate` tìm `/Tải\slại/` trong text node của `#load-detail`. Phải tìm thấy. Dùng `Range` bao đúng đoạn đó; mọi rect của `range.getClientRects()` cùng `top` (sai số < 1 px).
   - **Báo nhầm:** route `**/no-such-file.js` → `abort`. `page.evaluate` chèn `<script src="/no-such-file.js">` vào `body`. Kết quả: thẻ "Không tải được game", `role="alert"`, không `aria-live`, `#reload-btn` có focus. Kiểm lại "Tải lại" cùng dòng ở 390×844.
   - Thả request `ENTRY`: `#join-btn:enabled` "Vào chơi", `#load-status` ẩn, `role="status"`, **`#name` có focus**.
   - Đối chứng (trang mới, không báo nhầm): sau khi sảnh sẵn sàng, `#name` không có focus. Bộ canh tải không lấy focus khi không có lý do.

Test e2e cũ của T15 trong `multiplayer.spec.ts` chạy lại không sửa và phải qua: chúng giữ hành vi `slow`/`failed`, nút Tải lại, `#load-invite`, `noscript`. Test 1 của chúng (`#load-status` ẩn khi script bị giữ) cũng chứng minh Chromium bỏ qua script `nomodule` thật.

### Kiểm tay (tester)

Bản build trên 2567: tự viết lại HTML trong một script ở scratchpad (không commit), chụp thẻ `outdated` bằng CDP `Page.captureScreenshot` ở 3 khổ, xem chữ có gọn và link ngắt dòng gọn không. Ghi kết quả vào `PROGRESS.md`. Không có trình duyệt cũ thật trong container. Không bắt buộc kiểm trên IE11 hay iOS 10.

## Tài liệu

- `docs/design/multiplayer.md`, mục "Mở game: sảnh tải chậm hoặc hỏng":
  - thêm hàng "Trình duyệt quá cũ, không chạy được game" | thẻ "Hãy cập nhật trình duyệt", dòng giữa, địa chỉ trang để chép sang trình duyệt khác, không có nút | "ngay khi mở trang, không chờ 15 giây";
  - gạch đầu dòng mới: sau một lần báo nhầm (thẻ lỗi rồi sảnh vẫn mở) focus về ô tên;
  - dòng đầu file thêm "T44".
- `docs/architecture.md`:
  - dòng "Chữ người chơi thấy": thêm "trừ chữ tĩnh và bộ canh tải trong `index.html`, chạy trước mọi module (T12)";
  - đoạn **Canh tải sảnh (T15)** thêm phần T44:
    - script `nomodule` bắn `petgame:no-modules`, trạng thái `outdated`;
    - bộ canh tải viết ES5, không dùng `URLSearchParams`; unit test `indexHtml.test.ts` giữ luật này;
    - CSS sảnh không dùng `inset`/`min()`;
    - focus về `#name` sau báo nhầm.
  
  Sửa "JS ES2015" thành "ES5".
  - dòng e2e (`npm run test:e2e`): liệt kê đủ `multiplayer.spec.ts`, `pwa.spec.ts`, `rejoin.spec.ts`, `lobby.spec.ts`, kèm nửa câu: `lobby.spec.ts` giả lập trình duyệt không có module bằng cách viết lại HTML qua `page.route`, ở cả Vite dev và bản build.
  - mục Helper: `` `join` (hai cái trước) `` → `` `join` (`openPage` + `enterLobby`) ``. Chỉ sửa tài liệu, không đụng spec.
- `docs/deploy.md`, ghi chú CSP: "hai script inline trong `index.html` (bộ canh tải và script `nomodule`), mỗi cái một hash `sha256-…`; hash đổi khi chữ trong script đổi".

## Tiêu chí hoàn thành

- [ ] `index.html` có `<script nomodule>` (ES5, chỉ bắn `petgame:no-modules`), đứng sau bộ canh tải, trước thẻ module; `dist/index.html` sau `npm run build` vẫn giữ nó đúng chỗ đó.
- [ ] Bộ canh tải không còn `URLSearchParams`. Có trạng thái `outdated` đúng bảng Thiết kế 3: huỷ hẹn giờ, `failed` không đè được nó, `ready` thắng nó. Chữ đúng Thiết kế 2; `#load-link` là địa chỉ trang; nút Tải lại và `#load-invite` ẩn trong thẻ này.
- [ ] `invite.hidden` vẫn được đặt lúc khởi động. Với `?room=`, `#load-invite` mất `hidden` dù khung thông báo còn ẩn.
- [ ] `#load-status` không có `aria-live`; `role` là `alert` khi `failed`/`outdated`, là `status` lúc thường và sau `ready`.
- [ ] Sau báo nhầm, focus ở `#name`; không báo nhầm thì focus không bị đụng.
- [ ] Ba câu có "Tải lại" dùng ` `; ở 390×844 "Tải lại" nằm trên một dòng.
- [ ] CSS `#lobby` và `#lobby form` không còn `inset`/`min()`, đổi tương đương theo bảng Thiết kế 5; sảnh trên Chromium trông như cũ: tester đo `boundingBox()` của `#lobby` và `#lobby form` ở 844×390, 390×844, 1280×720 trên HEAD và sau khi sửa, hai bên trùng nhau; ghi vào `PROGRESS.md`.
- [ ] `packages/client/src/indexHtml.test.ts` có 6 mục ở trên; hỏng trên HEAD, qua sau khi sửa.
- [ ] `tests/e2e/lobby.spec.ts` có 4 test (test 1 × dev/build, test 2, test 3), không `test.slow()`, không `waitForTimeout`, kiểm số lần viết lại HTML.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` đều qua, kể cả các test `lobby:` cũ trong `multiplayer.spec.ts` không sửa.
- [ ] `git diff --stat` không có `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`; không có file `.ts` nào của client ngoài test mới.
- [ ] Tài liệu cập nhật như mục Tài liệu, kể cả câu `join` trong `docs/architecture.md`.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **Giả lập không phải trình duyệt cũ thật.** Viết lại HTML chứng minh được luồng (thẻ, hẹn giờ bị huỷ, bản build giữ script, thẻ nằm trong khung nhìn khi thiếu `inset`/`min()`). Nó không chứng minh được bộ canh tải *chạy được* trên IE11 hay iOS 10: phần đó dựa vào unit test cú pháp và API. Danh sách API cấm ở unit test là danh sách chặn có lý do, không đầy đủ tuyệt đối. Người sửa bộ canh tải sau này phải giữ ES5 (chú thích trong script nói rõ).
- **Safari 10.1 / iOS 10.3** chạy cả hai script: thẻ "cập nhật" hiện trong chốc lát rồi bị `ready` gỡ nếu sảnh chạy được. Thực tế sảnh không chạy được trên đó (mục tiêu build của Vite 8), nên thẻ ở lại, và đúng nguyên nhân.
- **`page.clock` và route tài liệu ở bản build:** `route.fetch()` qua server 2567 nhận bản `br`. Playwright trả body đã giải nén, nên phải `fulfill` với header mới (đã ghi ở mục Test). Nếu `toContainText` gặp NBSP: Playwright gộp khoảng trắng; test 3 dùng regex `\s`, không so chuỗi có dấu cách.
- **Chèn `<script>` hỏng để báo nhầm (test 3):** đúng loại tín hiệu thật mà bộ canh tải bắt (thẻ `<script>` cùng origin tải lỗi). Reviewer T15 đã thử tay cách này.

## Đề xuất cho `TASKS.md`

- **Chuyển sang T20** (vì nằm trong `tests/e2e/multiplayer.spec.ts`, file đang bị T63 giữ), bỏ khỏi dòng T44:
  - bỏ (hoặc ghi lý do) `test.slow()` của test `lobby: a script that cannot load or breaks while starting …`;
  - siết test `lobby: nothing is sent before the lobby script is ready …` (trước dòng kiểm `#load-status` ẩn) và test `lobby: on a slow network …` (trước `fastForward` đầu) bằng `await expect(page.locator("#load-invite")).not.toHaveAttribute("hidden")`. Dấu hiệu này được T44 giữ nguyên.
- **Ghi chú cho T16:** `tests/e2e/lobby.spec.ts` có thêm bản chép `LOBBY_SLOW_MS`, `ENTRY` (đường script sảnh ở dev và ở build) và `PHONE`; gom cùng các helper chép khác.
- (Thấp, không bắt buộc.) Nếu sau này thấy "Thử lại"/"Tải lại" trong `JOIN_TEXT` (`ui/strings.ts`) xuống dòng mồ côi, dùng cùng cách ` `.
