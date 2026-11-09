PASS
# REVIEW: T15 Sảnh báo lỗi khi tải hỏng, vòng 1

## Kết luận
Làm đủ và đúng PLAN.md: markup và CSS, bộ canh tải inline, sự kiện `petgame:lobby-ready` trong `main.ts`, 3 test `lobby:`, tài liệu. Bảng trạng thái đúng (sẵn sàng luôn thắng, hẹn giờ được huỷ, listener được gỡ) và bộ lọc chỉ nhận lỗi của script cùng origin. Mình đã kiểm lại hành vi trên Chromium với cả `index.html` dev lẫn `dist/` thật. Không còn lỗi phải sửa.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm
- **Bộ canh tải** (`packages/client/index.html:431-485`):
  - Script cổ điển, bọc IIFE, không phụ thuộc cây module của sảnh.
  - Cú pháp chỉ ES5 (`var`, `function`). API cần có: `URLSearchParams`, `location.origin`, `{ once: true }`; trình duyệt cũ coi tham số này là `capture`, vẫn chạy.
  - Listener gắn trong lúc parse. Module, kể cả khi bản build dời nó lên `<head>`, chỉ chạy sau khi parse xong, nên không lỡ sự kiện nào.
  - `petgame:lobby-ready` thắng dù đến sau "slow" hay sau "failed": huỷ hẹn giờ, gỡ listener `error`, ẩn thông báo, trả lại ô tên và nút.
  - Không đụng `disabled` hay chữ của `#join-btn`. `main.ts:76-82` bắn sự kiện ngay sau 3 dòng mở khoá; thân handler `submit` không đổi.
- **Thử trực tiếp** bằng script riêng trong scratchpad (không commit). Script phục vụ `index.html` và `dist/` thật qua `page.route` trên một origin giả:

  | Trường hợp | Kết quả |
  |---|---|
  | `main.ts` bị chặn (abort) | thẻ "Không tải được game / Kiểm tra mạng…", focus ở Tải lại; Enter → `/?room=abc&quality=low` (giữ nguyên) |
  | như trên nhưng bỏ `type="button"` | Enter → `/?`, mất `room`: phần 2 của test 1 bắt được (so `roomId` và `room`). Mục này bù cho kiểm chứng thứ 2 trong mục Test của PLAN, tester đã thay bằng phép thử khác |
  | module ném lỗi; module lỗi cú pháp | `ErrorEvent`, `filename` = URL module → thẻ "Trình duyệt gặp lỗi…" |
  | script khác origin ném lỗi (ngay, và trong hẹn giờ) | `filename` rỗng → bỏ qua |
  | script inline do tiện ích chèn (`textContent`), ném ngay hoặc trong hẹn giờ; init script | `filename` rỗng → bỏ qua |
  | `<script>` cùng origin trả 404 (báo nhầm cố ý), rồi `petgame:lobby-ready` | hiện thẻ lỗi rồi ẩn, ô tên và nút hiện lại |
  | bản build, chặn một chunk `modulepreload` (CanvasPool) | thẻ "Không tải được game"; chunk đó chỉ bị yêu cầu 1 lần |
  | bản build, chặn chunk entry | thẻ "Không tải được game" |
  | bản build, bình thường | không có thông báo, nút "Vào chơi" |

- **Test:**
  - Đồng hồ giả được cài và dừng trước `goto`, nên mốc 14 s / 15 s chính xác.
  - Không thêm `waitForTimeout` hay `retries`. `force: true` vẫn chỉ có trong test `lobby:` đầu.
  - Bước Enter lúc sảnh khoá có tác dụng thật. Nếu bỏ khoá, Tab vào được `#name`, Enter gửi form, trang về `/?`, và các kiểm tra `room`, `navigations` sẽ hỏng.
- **Test `lobby: nothing is sent…` qua cả trên HEAD** (tester ghi chú): chấp nhận, không bắt buộc siết. Dòng kiểm `#load-status` ẩn ở đó chỉ canh "không báo nhầm khi giữ script vài giây", và chỉ có nghĩa khi bộ canh tải tồn tại. Tester đã thử: hai test mới hỏng trên HEAD. Cách siết rẻ ở mục góp ý.
- **Tài liệu:** `docs/design/multiplayer.md` khớp chữ và số với code. `docs/architecture.md` khớp code, trừ một chỗ câu chữ (xem góp ý).
- Không đổi schema, message, `Profile` hay server. Không có gì chạy mỗi khung hình.

## Góp ý không bắt buộc
- `docs/architecture.md:93`: phần T15 chèn vào giữa `enterLobby` và `join` (hai cái trước), nên "hai cái trước" giờ trỏ nhầm sang `LOBBY_SCRIPT` / `LOBBY_SLOW_MS`. Cách sửa: đưa phần bộ canh tải ra sau `fingers (…)` thành câu riêng, hoặc ghi `join` (`openPage` + `enterLobby`).
- `tests/e2e/multiplayer.spec.ts:1302`: PLAN không có `test.slow()` (PLAN ghi "không tăng timeout"). Test chỉ vào thế giới một lần, nên 180 s mặc định là đủ. Nó không che lỗi nào, chỉ làm test bị treo lâu hơn mới báo. Nên bỏ, hoặc ghi lý do.
- `tests/e2e/multiplayer.spec.ts:1283` và `:1381-1383`: thêm `await expect(page.locator("#load-invite")).not.toHaveAttribute("hidden")` (trước dòng kiểm ẩn, và trước `fastForward` đầu tiên). URL có `?room=` nên dòng này chứng minh bộ canh tải đã chạy. Được hai điều:
  - test `lobby:` đầu hết qua suông trên HEAD;
  - bỏ khe hở lý thuyết: `fastForward` có thể chạy trước khi script inline đặt hẹn giờ. Nếu xảy ra thì test hỏng chứ không qua nhầm, và gần như không xảy ra vì parser chạy một mạch.
- `index.html:412`: `aria-live="polite"` ghi rõ trong markup sẽ đè mức `assertive` ngầm định của `role="alert"` khi lỗi. Nên bỏ `aria-live`, vì `role="status"` vốn đã ngầm là `polite`. Không gấp: người dùng trình đọc màn hình vẫn nghe được nội dung nhờ focus và `aria-describedby`.
- `index.html:475-483`: sau một lần báo nhầm, `ready` ẩn nút Tải lại đang giữ focus, nên focus rơi về `body`. Nếu `document.activeElement === reload` thì chuyển focus sang `#name`.
- `index.html:443`: trong bộ canh tải, `URLSearchParams` là API duy nhất mà trình duyệt rất cũ có thể thiếu (iOS 10.0-10.2, Edge 16). Thiếu nó thì script dừng trước khi đặt hẹn giờ. Thay bằng `/[?&]room=/.test(location.search)`.
- Ở 390 px dọc, chữ "lại" bị xuống dòng một mình (tester đã ghi). Sửa bằng `Tải lại` trong chữ `detail`.

## Việc mới nên đưa vào TASKS.md
- **P2, mới: "Vào thế giới hỏng sau sảnh thì màn hình trống"** (từ PLAN):
  - `startGame` chạy sau `lobby.remove()` (`main.ts:67-68`). Nếu chunk động của PixiJS (`app.init`) hoặc `Game.create` hỏng, chữ lỗi được ghi vào sảnh đã bị gỡ, nên người chơi chỉ thấy màn hình tối, không chữ, không nút.
  - Ảnh (`loadPalSprites`, `loadPictures`, `loadDollArt`) hỏng thì sảnh báo sai "đầy 5 người hoặc server chưa chạy".
  - Gợi ý: chỉ gỡ sảnh khi `Game.create` xong, hoặc hiện màn che kèm nút Tải lại; dùng lại `.lobby-alert` / `.lobby-action`; phân biệt chữ lỗi.
- **P3, mới: "Server nén script"** (từ PLAN):
  - Express không nén, nên script sảnh 957 kB đi nguyên qua mạng (gzip còn 300 kB, brotli 257 kB). Ở 3G chậm sảnh mất 20,7 s, có nén thì khoảng 7 s.
  - Cách làm: middleware nén, hoặc tạo sẵn `.br`/`.gz` lúc build. Cân nhắc dependency mới.
  - Đo lại theo PLAN T15, Thiết kế 3.
- **P3, mới (nhỏ): "Trình duyệt không chạy được module"**:
  - Trình duyệt không hỗ trợ `type="module"` bỏ qua thẻ module mà không báo lỗi gì, nên người chơi chỉ thấy "Vẫn đang tải… Mạng có vẻ chậm" sau 15 s, sai nguyên nhân.
  - Gợi ý: `<script nomodule>` hiện ngay thẻ "cập nhật trình duyệt". Làm chung với việc bỏ `URLSearchParams` (góp ý ở trên).
- **Cập nhật mô tả T23:**
  - T15 đã làm lỗi lúc tải trang. T23 làm lỗi lúc vào phòng (thế giới đã đóng → "Tạo thế giới mới"), dùng `.lobby-alert` / `.lobby-action`.
  - Nếu T23 tự vào lại khi mở trang, `main.ts` vẫn phải bắn `petgame:lobby-ready` ngay khi dựng xong sảnh, trước khi chờ server. Nếu không, bộ canh tải báo "mạng chậm" oan.
  - Đề xuất ghi `?room=` lên địa chỉ bằng `history.replaceState`, lý do ở PLAN T15, Thiết kế 6.
- **Ghi chú cho T13 (service worker):**
  - `index.html` phải lấy từ mạng trước (network-first). Nếu không, Tải lại có thể lấy lại HTML cũ trỏ tới chunk đã mất.
  - Nếu sau này có Content-Security-Policy (header hay SW), phải cho phép bộ canh tải inline bằng hash `sha256-…`; nếu không nó mất tác dụng mà không báo gì.
- **Ghi chú cho T16 (e2e trên bản build):**
  - Đổi `LOBBY_SCRIPT` thành chunk entry `/build/index-*.js` (một chỗ, cả 3 test `lobby:` dùng chung).
  - Thêm ca chặn một chunk `modulepreload`. Reviewer T15 mới kiểm tay ca này: hiện thẻ lỗi, chỉ 1 request.
- **Dọn nhỏ**, làm kèm việc sau nào có đụng các file này: các góp ý ở trên (`architecture.md:93`, `test.slow()`, siết test bằng `#load-invite`, `aria-live`, focus sau khi báo nhầm, `Tải lại`).
