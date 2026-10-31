# PLAN: T1 Test e2e chập chờn khi vào phòng

## Mục tiêu

- Bộ e2e (đội agent dựa vào để chấm PASS) không còn kẹt ở sảnh vì bấm "Vào chơi" lúc sảnh chưa sẵn sàng. Sửa ở gốc: sảnh có tín hiệu "sẵn sàng" rõ ràng, test chờ đúng tín hiệu đó. Không thêm lần chạy lại (retry), không tăng timeout.
- Người chơi cũng được lợi. Trên 4G chậm, HTML của sảnh hiện ra trước khi script game chạy xong (PixiJS khoảng 600 kB). Bấm "Vào chơi" lúc đó thì trình duyệt tự gửi form theo cách mặc định và tải lại trang ở `/?`: mất tên vừa gõ, mất luôn `?room=` của link mời (người chơi vào nhầm một thế giới mới thay vì thế giới của bạn). Sau nhiệm vụ này, nút ghi "Đang tải..." và chưa bấm được cho đến khi sảnh sẵn sàng.

## Phạm vi

Làm:
1. `packages/client/index.html`: ô tên và nút khoá sẵn (`disabled`) trong HTML, nút ghi "Đang tải..."; CSS cho trạng thái khoá; nút cao tối thiểu 44 px (điện thoại ngang hiện chỉ 39 px).
2. `packages/client/src/main.ts`: mở khoá ô tên và nút ngay sau khi gắn handler `submit`.
3. `tests/e2e/multiplayer.spec.ts`:
   - thêm helper `openPage` và `enterLobby` (chờ sảnh sẵn sàng, điền tên, kiểm tra giá trị, bấm);
   - `join` và 3 chỗ đang tự điền sảnh chuyển sang dùng các helper này;
   - `waitForWorld` báo lỗi ngay khi sảnh hiện lỗi;
   - nhật ký chẩn đoán của trang, chỉ in khi test lỗi;
   - thêm 1 test hồi quy cho sảnh.
4. `docs/architecture.md`: ghi quy ước "sảnh sẵn sàng" và lưu ý khi chạy e2e.

KHÔNG làm:
- Không sửa `playwright.config.ts`: không thêm `retries`, không tăng `timeout`, không đổi `workers`. Không thêm `waitForTimeout`. Không tăng timeout ở bất kỳ đâu.
- Không đổi luồng kết nối: thân handler `submit` (`main.ts:51-67`), `connect()`, server, schema, message, hồ sơ lưu đều giữ nguyên.
- Không sửa `scripts/shots.mjs`. `page.fill` và `page.click` của Playwright tự chờ ô và nút được mở khoá, nên script này tự an toàn sau bước 1-2.
- Không chuyển e2e sang chạy trên bản build (đề xuất thành nhiệm vụ riêng ở cuối file). Không bỏ tham số `?quality=low`. Không thêm chữ "Đang vào..." khi đang kết nối. Không đổi bố cục sảnh.

## Thiết kế

### Nguyên nhân gốc

**Dấu hiệu:** test kẹt ở sảnh với ô tên trống, dù đã điền "Tamer" và bấm "Vào chơi".

**Cơ chế đã xác nhận:** người dùng bấm vào form sảnh khi handler `submit` của `main.ts` chưa được gắn trên trang đó, nên trình duyệt gửi form theo cách mặc định.

Chuỗi suy luận:
1. **Lỗi xảy ra ở lần vào đầu tiên, không phải lần vào lại sau reload.** Handler ghi tên vào `localStorage` (`main.ts:54`); sau reload, sảnh tự điền lại tên đã lưu (`main.ts:24-25`). Nếu kẹt ở lần vào lại, ô sẽ có chữ "Tamer". Ô trống thì chỉ có thể là lần vào đầu.
2. **Handler chưa từng chạy trong context đó.** Mỗi test dùng một context mới (`multiplayer.spec.ts:14`), nên `localStorage` ban đầu trống. Nếu handler đã chạy dù một lần, tên đã được lưu và mọi sảnh sau đó phải hiện "Tamer".
3. **Nếu handler đã chạy thì không thể kẹt im lặng.** Server nhận cả tên rỗng (`GameRoom.ts:447`: `sanitizeName(...) || profile.name || "Player N"`). Kết nối lỗi thì sảnh hiện chữ lỗi (`main.ts:64`), không bao giờ đứng yên với ô trống.
4. **Thứ duy nhất tải tài liệu mới khi bấm `#join-btn` mà không qua handler là trình duyệt tự gửi form.** Form không có `action`/`method` (`index.html:293`), tức là GET về URL hiện tại. Ô tên không có thuộc tính `name` (`index.html:296`), nên dữ liệu form rỗng và query bị thay bằng chuỗi rỗng. Trang chuyển sang `http://localhost:5173/?` (mất `?quality=low`; nếu có link mời thì mất `?room=`), hiện sảnh mới với ô tên trống. Không ai bấm lần nữa, nên `waitForWorld` chờ đến hết giờ: 180 s × 3 = 540 s, vì test này có `test.slow()`.
5. **Vì sao handler chưa có, dù `page.goto` chờ sự kiện `load`?** Bình thường script module chạy xong trước `load`, và `main.ts` không có top-level await. Vậy trang được bấm không phải trang mà `goto` đã chờ, hoặc script của trang đó hỏng:
   - (a) Vite dev tải lại trang sau `load`. Các đường dẫn tới reload trong `node_modules/vite/dist/client/client.mjs`:
     - `:1091-1100`: tin `full-reload`, khi file client/shared đổi lúc e2e đang chạy hoặc khi Vite tối ưu lại phụ thuộc;
     - `:1080-1088`: mất kết nối HMR rồi có lại, sau đó gọi `location.reload()`.
     
     Khi trang đang tải lại, `fill`/`click` của Playwright chuyển sang tài liệu mới ngay khi `#name`/`#join-btn` được parse, sớm hơn nhiều so với lúc cả cây module của `main.ts` tải xong qua Vite dev.
   - (b) Một module trong cây `main.ts` tải lỗi ở lần đầu (Vite trả 504 "Outdated Optimize Dep", hoặc request bị huỷ khi máy quá tải). Khi đó `main.ts` không chạy, nhưng `load` vẫn bắn.
   
   Lần lỗi cũ không để lại log hay trace, nên không phân biệt được (a) hay (b). Cách sửa dưới đây chặn được cả hai, và nhật ký chẩn đoán sẽ chỉ rõ nguồn nếu lỗi tái diễn.
6. **Lỗi gốc trong code của mình:** sảnh là một form bấm được ngay từ HTML tĩnh, trước khi script sẵn sàng; còn helper `join` (`multiplayer.spec.ts:13-22`) dựa vào `load` thay vì một tín hiệu sẵn sàng tường minh. Mẫu `fill` rồi `click` không chờ này còn lặp lại ở `:134-136`, `:238-239` và `:287-288`.

Ghi chú: client không còn đọc `?quality=low` từ commit 9ab605b. Mất tham số này không gây lỗi; nó chỉ là dấu vết cho thấy trang đã tự gửi form (URL thành `/?`).

### Bảng giả thuyết

| # | Giả thuyết | Kết luận | Bằng chứng | Cách coder xác nhận |
|---|---|---|---|---|
| H1 | Bấm khi handler chưa gắn, trình duyệt tự gửi form, trang thành `/?` với ô trống | **Cơ chế đã xác nhận** | Suy luận 1-4 ở trên; thực nghiệm bên dưới | Test tạm ở bước 0 (bản A) phải qua trên code cũ |
| H1a | Nguồn: Vite tải lại trang sau `load` | Có thể | `client.mjs:1080-1100`; client chạy bằng Vite dev (`playwright.config.ts:19-23`) | Test tạm bản B (tuỳ chọn); nếu lỗi tái diễn, nhật ký chẩn đoán có 2 dòng `navigated` và tin `[vite]` |
| H1b | Nguồn: module của `main.ts` tải lỗi | Có thể | `load` vẫn bắn khi script module lỗi (thực nghiệm "abort") | Nhật ký chẩn đoán có dòng `requestfailed ... script` |
| H2 | Sảnh khởi tạo xoá hoặc ghi đè ô tên | Loại trừ cho lần lỗi này; vẫn là rủi ro ngầm | `main.ts:25` chỉ ghi khi có tên đã lưu. Nếu điền trước khi script chạy, ô sẽ bị ghi đè bằng tên cũ | Đọc code; sau khi sửa, `enterLobby` kiểm tra `toHaveValue(name)` |
| H3 | Ngoại hình ngẫu nhiên làm `main.ts` ném lỗi trước dòng 51 | Loại trừ | `DollPreview.draw()` thoát sớm khi chưa có ảnh (`ui/wardrobe.ts:48`); `LookPicker` chỉ tạo DOM; `index.json` có đủ ảnh cho 8 kiểu tóc; các hàm tải là `async`, không ném lỗi đồng bộ (`palSprites.ts:109`, `art/pictures.ts:28`, `art/doll.ts:51`) | Không cần |
| H4 | Top-level await làm `main.ts` chạy sau `load` | Loại trừ | Chỉ `gallery.ts:44` có top-level await, và đó là trang khác | Không cần |
| H5 | Token thiết bị, hồ sơ mới so với cũ | Loại trừ | Token chỉ được tạo trong `connect()` (`net/connection.ts:22,38-49`), tức là bên trong handler | Không cần |
| H6 | Handler đã chạy nhưng `connect`/`assets` lỗi hoặc treo | Loại trừ | Ô vẫn sẽ có "Tamer" vì handler không xoá ô, kèm chữ lỗi hoặc nút bị khoá | Sau khi sửa, `waitForWorld` báo lỗi ngay khi sảnh hiện lỗi |

Không nên dùng việc chạy lặp `-g "a captured pal follows" --repeat-each=N` để xác nhận nguyên nhân: nguồn kích hoạt do môi trường, rất hiếm, nên chạy lặp gần như không tái hiện được. Dùng test tạm có tính tất định ở bước 0.

### Thực nghiệm đã làm (chỉ đọc, không đụng file dự án)

Môi trường: Chromium headless của Playwright 1.56.1. Bản sao form sảnh được phục vụ trong bộ nhớ qua `page.route`. Script nằm trong scratchpad của phiên.

1. **Script sảnh tải lỗi ở lần đầu, sau đó tải bình thường.** Chạy `goto` (chờ `load`), `fill("Tamer")`, `click`. Kết quả:
   - URL `http://lobby.test/?quality=low` chuyển thành `http://lobby.test/?`;
   - ô tên `""`, handler không chạy, `localStorage` trống;
   - trang đứng ở sảnh.
   
   Khớp đúng dấu hiệu lỗi.
2. **Cùng tình huống, nhưng ô và nút có `disabled` sẵn trong HTML (script mở khoá khi gắn handler).** `click` đứng chờ; không chuyển trang; URL giữ `?quality=low`; ô vẫn là "Tamer".
3. **Trang tự tải lại ngay sau `load`, script chậm 2 s; helper chờ `#join-btn:enabled` rồi mới điền.** Vào được, đúng tên "Tamer".
4. **Đo nút bằng `index.html` thật:**

   | Khung hình | Kích thước nút |
   |---|---|
   | Desktop 1280×720 | 340×45 px |
   | Điện thoại dọc 390×844 | 340×45 px |
   | Điện thoại ngang 844×390 | 680×**39** px (dưới 44 px, vi phạm quy tắc nút cảm ứng) |

### Cách sửa ở sảnh (tín hiệu "sẵn sàng")

Hợp đồng: `#name` và `#join-btn` bị khoá ngay trong `index.html`. `main.ts` mở khoá cả hai **sau khi** đã gắn handler `submit` và đã điền sẵn tên lưu.

Vì sao chọn cách này:
- Nút bị khoá thì trình duyệt không tạo sự kiện click, và cũng chặn gửi form bằng phím Enter (implicit submission bị chặn khi nút mặc định bị khoá). Không còn đường nào để trình duyệt tự gửi form.
- Playwright tự chờ: `click` chờ nút được mở khoá, `fill` chờ ô sửa được. Mọi script đang điền sảnh (kể cả `shots.mjs`) đều tự an toàn.
- Khoá ô tên còn bỏ được rủi ro H2: không ai gõ được trước khi `main.ts:25` điền tên đã lưu.
- Thêm `autocomplete="off"` cho nút, vì Firefox giữ trạng thái `disabled` do script đặt qua các lần tải lại (theo MDN). Thiếu thuộc tính này, sau một lần reload, nút có thể đã mở sẵn trước khi script chạy.
- Không dùng `<fieldset disabled>`: fieldset làm hỏng bố cục flex của form trên điện thoại.

Chữ hiển thị:
- Trước khi sẵn sàng: nút ghi **"Đang tải..."** (ba dấu chấm ASCII), mờ đi (`opacity: 0.6`, `cursor: progress`); ô tên cũng mờ.
- Khi sẵn sàng: nút ghi **"Vào chơi"**, ô tên dùng được (có sẵn tên lần trước nếu có).
- Khi đang kết nối: giữ như hiện nay (handler khoá nút, nút mờ nhờ CSS mới).
- Khi lỗi: giữ như hiện nay.

Trải nghiệm theo thiết bị:
- **Desktop:** Tab vào ô tên, gõ, Enter để vào. Trước khi sảnh sẵn sàng, Enter không làm gì vì ô đang khoá.
- **Điện thoại dọc và ngang:** nút cao ít nhất 44 px (`min-height: 44px`, `box-sizing: border-box`). Trên Wi-Fi, trạng thái "Đang tải..." gần như không thấy; trên 4G chậm thì hiện vài giây.
- **Script sảnh hỏng hẳn:** sảnh đứng ở "Đang tải..." thay vì tải lại trang vô ích. E2E sẽ báo rõ là đang chờ `#join-btn:enabled`.

### Cách sửa trong helper e2e

- `enterLobby(page, name)`:
  1. chờ `#join-btn:enabled`;
  2. `fill("#name", name)`;
  3. `expect(#name).toHaveValue(name)`;
  4. `click("#join-btn")`.
  
  Dùng timeout mặc định của Playwright (giống `page.click` hiện tại). Không đặt timeout riêng.
- `waitForWorld` dừng ngay, kèm nội dung `#join-error`, nếu sảnh hiện lỗi, thay vì chờ hết 180-540 s. Thay đổi này chỉ làm kiểm tra chặt hơn: trong đường vào thành công, `#join-error` luôn trống (`main.ts:57`) rồi bị gỡ cùng sảnh (`main.ts:60`).
- Nhật ký chẩn đoán cho mỗi trang, chỉ in khi test lỗi:
  - điều hướng của khung chính;
  - `pageerror`;
  - `console` loại lỗi và mọi tin bắt đầu bằng `[vite]`;
  - request `document`/`script` bị lỗi.
  
  Reporter dạng list in `console.log` của test ra terminal (`node_modules/playwright/lib/reporters/list.js:63-65`), nên tester đọc được ngay.

## Kế hoạch triển khai

0. **Xác nhận nguyên nhân bằng test tạm (KHÔNG commit), trên code cũ.** Thêm vào cuối `tests/e2e/multiplayer.spec.ts` một test `T1 repro (temporary)`:
   - tạo context và page như test explorer, nhớ đẩy context vào `contexts`;
   - chặn script sảnh ở lần tải đầu: `page.route(/\/src\/main\.ts(\?.*)?$/, ...)` gọi `route.abort()` cho request đầu và `route.continue()` cho các request sau. Ghi URL của request bằng `page.on("request")` để chắc Vite dev phục vụ entry đúng ở `/src/main.ts`;
   - `goto("/?quality=low")`, `fill("#name", "Tamer")`, `click("#join-btn")`;
   - `await page.waitForURL((url) => url.search === "")`, rồi `await expect(page.locator("#name")).toHaveValue("")`.
   
   Chạy `npx playwright test -g "T1 repro"`. Kỳ vọng: **qua** trên code cũ (tái hiện đúng: trang chuyển sang `/?`, ô trống). Ghi kết quả vào `PROGRESS.md`.
   
   Bản B (tuỳ chọn, tái hiện nguồn H1a):
   - sau `goto`, chạy `page.evaluate(() => location.reload())`;
   - giữ request `/src/main.ts` thứ hai bằng một promise cho đến sau khi `fill` + `click` xong;
   - kỳ vọng như bản A.
1. **`packages/client/index.html`:**
   - dòng 296: thêm `disabled` vào `<input id="name" ...>`, giữ `autocomplete="nickname"`;
   - dòng 297: đổi thành `<button type="submit" id="join-btn" disabled autocomplete="off">Đang tải...</button>`;
   - thêm một chú thích HTML (tiếng Anh) phía trên form: ô và nút được khoá cho đến khi `src/main.ts` gắn handler submit; bấm sớm sẽ khiến trình duyệt tự gửi form và tải lại trang, mất `?room=` và tên vừa gõ;
   - CSS (khối sảnh, dòng 242-245):
     - thêm `min-height: 44px; box-sizing: border-box;` vào rule `#join-btn` (dòng 243);
     - thêm `#join-btn:disabled { opacity: 0.6; cursor: progress; }`;
     - thêm `#lobby input:disabled { opacity: 0.6; }`;
     - không đổi media query điện thoại ngang (dòng 255); `min-height` ở rule gốc vẫn áp dụng.
2. **`packages/client/src/main.ts`:** ngay sau khối `form.addEventListener("submit", ...)` (sau dòng 67), thêm ba lệnh cùng chú thích tiếng Anh. Chú thích nói rằng sảnh dùng được từ đây; `index.html` khoá ô và nút đến khi handler ở trên tồn tại; e2e chờ nút được mở khoá.
   ```ts
   nameInput.disabled = false;
   joinBtn.disabled = false;
   joinBtn.textContent = "Vào chơi";
   ```
   Không đổi gì khác: thân handler, việc điền sẵn tên ở dòng 24-25, thứ tự các dòng phía trên.
3. **`tests/e2e/multiplayer.spec.ts`:**
   - a. **Nhật ký chẩn đoán.** Thêm `const pageLog: string[] = []` và hàm `watch(page: Page, tag: string)`. Hàm này đăng ký:
     - `framenavigated` (chỉ khung chính) → dòng `navigated <url>`;
     - `pageerror`;
     - `console`: khi `msg.type() === "error"` hoặc `msg.text().startsWith("[vite]")`;
     - `requestfailed`: chỉ khi `resourceType()` là `document` hoặc `script`.
     
     Mỗi dòng có tiền tố `[tag]` và giờ `HH:MM:SS.mmm`. Đổi `test.afterEach` thành `async ({}, testInfo) => ...`: nếu `testInfo.status !== testInfo.expectedStatus` và `pageLog` có nội dung thì `console.log` toàn bộ nhật ký; sau đó xoá `pageLog`, rồi đóng các context như cũ.
   - b. **`openPage(browser, path = "/", tag = "page"): Promise<Page>`**: `newContext`, đẩy vào `contexts`, `newPage`, `watch(page, tag)`, `goto(path + (path.includes("?") ? "&" : "?") + "quality=low")`. Phần này lấy từ `join` hiện tại ra.
   - c. **`enterLobby(page, name)`** (JSDoc tiếng Anh, nói hợp đồng sảnh sẵn sàng):
     ```ts
     await page.locator("#join-btn:enabled").waitFor();
     await page.fill("#name", name);
     await expect(page.locator("#name")).toHaveValue(name);
     await page.click("#join-btn");
     ```
   - d. **`join(browser, name, path = "/")`** = `openPage(browser, path, name)` rồi `enterLobby(page, name)`.
   - e. **`waitForWorld`**: dùng `page.waitForFunction` trả về `"ok"` khi `__petgame.room.state.players.size > 0`, hoặc trả về `textContent` của `#join-error` nếu có chữ (ngoài hai trường hợp đó trả `false`). Lấy giá trị bằng `jsonValue()`; khác `"ok"` thì `throw new Error(\`Still in the lobby: ${value}\`)`.
   - f. **Thay các chỗ tự điền sảnh:**
     - Test "a captured pal...", dòng 134-136: `await page.reload(); await enterLobby(page, "Tamer");`.
     - Test "explorer...", dòng 229-232: thay bằng `const page = await openPage(browser, "/", "Stylist");`.
     - Test "explorer...", dòng 238-239: `await enterLobby(page, "Stylist");`.
     - Test "explorer...", dòng 287-288: giữ `reload` và kiểm tra `.style-btn.active[data-hair="curly"]` ở dòng 286, rồi `await enterLobby(page, "Stylist");`.
   - g. **Test hồi quy mới, đặt cuối file:** `lobby: nothing is sent before the lobby script is ready; the invite and the name are kept`. Không tải thế giới WebGL, chỉ mất vài giây.
     1. Tạo context và page (đẩy context vào `contexts`, gọi `watch(page, "lobby")`). Đếm điều hướng khung chính bằng `page.on("framenavigated")`.
     2. Giữ script sảnh: `page.route(/\/src\/main\.ts(\?.*)?$/, async (route) => { await held; await route.continue(); })`, trong đó `held` là promise do test tự giải phóng.
     3. `goto("/?room=no-such-room&quality=low", { waitUntil: "commit" })`.
     4. Kiểm tra `#join-btn` `toBeDisabled()` và `toHaveText("Đang tải...")`; `#name` `toBeDisabled()`.
     5. Đặt lần lượt từng khung hình 844×390, 390×844, rồi 1280×720 bằng `setViewportSize`; ở mỗi khung hình, kiểm tra `boundingBox().height >= 44` cho nút.
     6. `click({ force: true })` lên nút đang khoá, để mô phỏng người bấm vội. Đây là chỗ duy nhất được dùng `force`.
     7. Giải phóng `held`; `await page.locator("#join-btn:enabled").waitFor()`; kiểm tra chữ "Vào chơi".
     8. `fill("#name", "Early")`, `click("#join-btn")`.
     9. Kiểm tra:
        - `#join-error` chứa "Không vào được". Điều này chứng minh handler đã chạy và đã thử vào phòng của link mời: phòng không tồn tại nên lỗi. Nếu `?room=` bị mất, handler sẽ tạo thế giới mới và vào thành công;
        - `new URL(page.url()).searchParams.get("room") === "no-such-room"`;
        - số lần điều hướng là 1. Lần kiểm tra này diễn ra sau cả một vòng tải module và kết nối, nên nếu cú bấm ở bước 6 đã làm trang tự gửi form thì đã có lần điều hướng thứ 2;
        - `localStorage["petgame:name"] === "Early"`.
4. **Chạy lại test tạm ở bước 0 trên code mới.** Riêng test tạm này được đặt `timeout: 10_000` cho `page.fill`. Kỳ vọng: test **không qua**, dừng ở bước chờ `#name` được mở khoá (script bị chặn thì sảnh đứng ở "Đang tải..."), không có điều hướng sang `/?`. Ghi kết quả vào `PROGRESS.md`, rồi **xoá test tạm**.
5. **`docs/architecture.md`:**
   - mục packages/client, dòng `main.ts`: thêm một câu nói `#name` và `#join-btn` được khoá trong `index.html` đến khi `main.ts` gắn handler submit; đó là tín hiệu "sảnh sẵn sàng";
   - mục Kiểm thử, thêm:
     - helper `openPage`, `enterLobby` (chờ `#join-btn:enabled`), `waitForWorld` báo lỗi sảnh ngay;
     - nhật ký trang in khi test lỗi;
     - không sửa file của `packages/client` hay `packages/shared` khi e2e đang chạy, vì Vite dev sẽ tải lại mọi trang đang mở;
     - chạy lặp cả bộ thì dùng `--repeat-each=N --workers=1`, vì không có `--workers=1` thì các lượt chạy song song: máy 4 nhân mặc định có 2 worker (`node_modules/playwright/lib/common/suiteUtils.js:98`).

## Giao thức

Không đổi gì về giao thức:
- `schema.ts`, `messages.ts`, `Profile` và server không đổi.
- Các khoá `localStorage` giữ nguyên: `petgame:name`, `petgame:look`, `petgame:worn`, `petgame:token`.
- Phía client chỉ đổi `index.html` (thuộc tính và CSS) và 3 dòng trong `main.ts`. Hồ sơ cũ không bị ảnh hưởng.

## Test

- **Unit (shared):** không có (không đổi logic dùng chung).
- **Tích hợp server (`GameRoom.test.ts`):** không có (server không đổi).
- **E2E:**
  - Sửa helper `join` và `waitForWorld`; thêm `openPage`, `enterLobby`, `watch`; sửa `afterEach`.
  - Chuyển 3 chỗ tự điền sảnh sang helper.
  - Thêm 1 test hồi quy (bước 3g).
  - Test tạm ở bước 0 và 4 không commit.
- **Lệnh** (tắt server dev trước, để cổng 2567 và 5173 trống):
  - `npm run typecheck`, `npm test`, `npm run build`. Lưu ý: `tests/e2e` không nằm trong `typecheck`, nên phải tự giữ đúng kiểu.
  - `npx playwright test -g "lobby:" --repeat-each=5 --workers=1`: test hồi quy, khoảng 1 phút.
  - `npx playwright test -g "wild pals spawn" --repeat-each=10 --workers=1`: chạy lặp đường `join` + `waitForWorld`, khoảng 2-4 phút.
  - `npx playwright test --repeat-each=3 --workers=1`: 3 lượt cả bộ liên tiếp trong một phiên server, giống bối cảnh lỗi gốc (test thứ 4 của một lượt cả bộ). Ước khoảng 15-20 phút (chưa đo), nên **chạy nền** vì lệnh chạy tiền cảnh bị cắt ở 10 phút.
  - `npm run test:e2e`: 1 lần như CI, server khởi động mới.
  - Ghi thời gian thật của từng lệnh vào `PROGRESS.md`.

## Tiêu chí hoàn thành

- [ ] Test tạm (bản A) **tái hiện** được lỗi trên code cũ: URL thành `/?`, ô tên trống, không vào phòng. Trên code mới thì **không tái hiện**: không điều hướng, sảnh đứng ở "Đang tải...". Cả hai kết quả có trong `PROGRESS.md`; test tạm đã xoá khỏi spec.
- [ ] `index.html`: `#name` có `disabled`; `#join-btn` có `disabled autocomplete="off"` và chữ "Đang tải..."; có CSS `:disabled` cho nút và ô; nút có `min-height: 44px; box-sizing: border-box`.
- [ ] `main.ts`: ba lệnh mở khoá nằm ngay sau `form.addEventListener("submit", ...)`; thân handler không đổi một ký tự.
- [ ] Spec:
  - `grep -n '#join-btn' tests/e2e/multiplayer.spec.ts` chỉ còn trong `enterLobby` và test hồi quy;
  - `join` dùng `openPage` + `enterLobby`;
  - không có `waitForTimeout` mới, không timeout nào bị tăng, không có `retries`;
  - `force: true` chỉ xuất hiện ở test hồi quy.
- [ ] `waitForWorld` ném lỗi ngay kèm nội dung `#join-error` khi sảnh hiện lỗi.
- [ ] Nhật ký trang chỉ in khi test lỗi. Tester kiểm một lần bằng cách cố ý làm hỏng tạm một test (không commit): log phải có dòng `navigated` và `console.debug [vite] ...`.
- [ ] Test hồi quy qua, kể cả kiểm tra nút ≥ 44 px ở 844×390, 390×844 và 1280×720.
- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch.
- [ ] Mọi lệnh e2e ở mục Test đều qua, 0 lỗi:
  - 5 lượt test hồi quy;
  - 10 lượt "wild pals spawn";
  - **3 lượt cả bộ liên tiếp** (`--repeat-each=3 --workers=1`) và **1 lần `npm run test:e2e`**, tổng cộng 4 lượt cả bộ.
  
  Nếu đo thấy một lượt cả bộ dài hơn 8 phút, được giảm còn `--repeat-each=2` cộng 1 lần chạy thường, nhưng **không ít hơn 3 lượt cả bộ**.
- [ ] `docs/architecture.md` đã có quy ước sảnh sẵn sàng và các lưu ý chạy e2e (bước 5).

## Rủi ro, câu hỏi mở

Không có CHẶN.

- **Nguồn kích hoạt chưa biết chắc (H1a hay H1b).** Cách sửa đóng cơ chế chung cho cả hai. Nếu lỗi tái diễn, nhật ký chẩn đoán sẽ chỉ ra nguồn.
- **Rủi ro còn lại:** Vite tải lại trang *sau* khi đã bấm, lúc đang kết nối. Trang quay về sảnh với tên đã lưu, và test sẽ chờ đến hết giờ. Đây là sự cố môi trường của Vite dev, không phải lỗi game; nhật ký sẽ có 2 dòng `navigated` cùng tin `[vite]`. Trị tận gốc: không sửa file client/shared khi e2e đang chạy (sẽ ghi vào `docs/architecture.md`), hoặc làm nhiệm vụ đề xuất bên dưới. Có thể cân nhắc thêm câu này vào mục "Môi trường và lưu ý" của `CLAUDE.md` (việc của agent chính hoặc người dùng).
- **Biểu thức chặn `/src/main.ts` trong test hồi quy gắn với Vite dev.** Nếu sau này e2e chạy trên bản build, test phải chặn file bundle (`/build/index-*.js`).
- **Ô tên bị khoá lúc tải:** trên mạng rất chậm, người chơi phải chờ vài giây mới gõ được. Chấp nhận được, vì nút cũng chưa bấm được, và khoá ô tránh việc `main.ts:25` ghi đè chữ vừa gõ bằng tên đã lưu.
- **Thời gian chạy e2e là ước lượng** (chưa chạy trong lúc lập kế hoạch). Tester ghi số thật để các nhiệm vụ sau dùng.

## Đề xuất việc mới cho `TASKS.md`

- **P3: E2E chạy trên bản build như bản thật, thay vì Vite dev.**
  - Cách làm: server phục vụ `packages/client/dist` ở cổng 2567, giống `npm run play`.
  - Lợi ích: hết hẳn rủi ro HMR tải lại trang; mỗi lần tải trang không còn phải tải hàng trăm module riêng lẻ (chậm khi Chromium vẽ WebGL bằng phần mềm); test gần với bản deploy hơn.
  - Cần xem: thêm bước build trước e2e (CI job e2e hiện chưa build); `baseURL` đổi sang 2567; test hồi quy sảnh đổi file cần chặn.
  - Không cấp bách sau T1.
