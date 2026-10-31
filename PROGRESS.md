# PROGRESS: T1 Test e2e chập chờn khi vào phòng

## Vòng 1: coder

- [x] **Bước 0: tái hiện lỗi trên code cũ bằng test tạm (không commit).** File tạm `tests/e2e/t1-repro.tmp.spec.ts`, hai bản; lệnh `npx playwright test -g "T1 repro" --workers=1` (9 s). Cả hai đặt `timeout: 10_000` cho `fill` và `click`.
  - Bản A (request đầu của `/src/main.ts` bị `route.abort()`, các request sau chạy bình thường): **qua** trên code cũ (1,9 s). Nhật ký: `navigated /?quality=low`, `requestfailed main.ts net::ERR_FAILED`; ngay sau `fill` + `click` có `navigated http://localhost:5173/?`. Kết quả cuối: URL `http://localhost:5173/?`, ô tên `""`, `localStorage["petgame:name"]` là `null`, `main.ts` được yêu cầu 2 lần. Đúng dấu hiệu lỗi gốc.
  - Bản B (nguồn H1a: `location.reload()` ngay sau `load`, request `main.ts` thứ hai bị giữ lại đến khi test xong `fill` + `click`): **qua** trên code cũ (1,3 s), kết quả như A (URL cuối `/?`, ô trống, `localStorage` trống, 3 request `main.ts`, request bị giữ báo `ERR_ABORTED`). Tức là chỉ cần Vite tải lại trang sau `load` cũng đủ gây đúng lỗi này.
- [x] **Bước 1: `packages/client/index.html`.** `#name` thêm `disabled`; `#join-btn` thành `disabled autocomplete="off"` với chữ "Đang tải..."; chú thích HTML (tiếng Anh) phía trên form nói vì sao khoá; CSS: `#join-btn` thêm `min-height: 44px; box-sizing: border-box`, thêm `#join-btn:disabled { opacity: 0.6; cursor: progress; }` và `#lobby input:disabled { opacity: 0.6; }`. Không đổi media query điện thoại ngang.
- [x] **Bước 2: `packages/client/src/main.ts`.** Ba lệnh mở khoá (`nameInput.disabled = false; joinBtn.disabled = false; joinBtn.textContent = "Vào chơi";`) kèm chú thích tiếng Anh, đặt ngay sau khối `form.addEventListener("submit", ...)`. Thân handler và việc điền sẵn tên không đổi (`git diff` chỉ thêm 6 dòng).
- [x] **Bước 3: `tests/e2e/multiplayer.spec.ts`.**
  - a. `pageLog` + `watch(page, tag)` (điều hướng khung chính, `pageerror`, console lỗi hoặc `[vite]`, `document`/`script` tải lỗi); `afterEach` thành `async ({}, testInfo)`, in `Page log:` chỉ khi `status !== expectedStatus`, rồi xoá log và đóng context như cũ.
  - b-d. `openPage(browser, path, tag)`, `enterLobby(page, name)` (chờ `#join-btn:enabled`, `fill`, `toHaveValue`, `click`; timeout mặc định), `join` = `openPage` + `enterLobby`.
  - e. `waitForWorld` trả `"ok"` khi vào được thế giới, hoặc chữ của `#join-error` nếu sảnh hiện lỗi; khác `"ok"` thì ném `Still in the lobby: <chữ lỗi>`.
  - f. Ba chỗ tự điền sảnh chuyển sang helper: test "a captured pal..." (sau `reload`), test "explorer..." (`openPage` ở đầu, `enterLobby` ở lần vào đầu và sau `reload`).
  - g. Test hồi quy mới ở cuối file: `lobby: nothing is sent before the lobby script is ready; the invite and the name are kept` (đúng 9 bước của kế hoạch; ba khung hình 844×390, 390×844, 1280×720 đều cao nút ≥ 44 px).
  - Kiểm tra theo tiêu chí: `#join-btn` trong spec chỉ còn ở `enterLobby` (dòng 51, 54) và test hồi quy (dòng 499-514); không thêm `waitForTimeout`, không thêm hay tăng timeout, không `retries`; `force: true` chỉ có ở test hồi quy (dòng 510). `playwright.config.ts`, `scripts/shots.mjs`, server, shared không đổi.
- [x] **Bước 4: test tạm trên code mới.** Cùng lệnh `npx playwright test -g "T1 repro" --workers=1` (25,6 s): **cả A và B không qua**, đúng kỳ vọng. Cả hai dừng ở `TimeoutError: page.fill: Timeout 10000ms exceeded` (locator resolved to `<input disabled id="name" ...>`, lặp lại `element is not enabled`). Nhật ký không có dòng `navigated http://localhost:5173/?` nào: sảnh đứng ở "Đang tải..." thay vì tự gửi form. Test tạm đã chuyển ra khỏi repo (bản sao ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t1/t1-repro.tmp.spec.ts`); `tests/e2e/` chỉ còn `multiplayer.spec.ts`.
- [x] **Bước 5: `docs/architecture.md`.** Mục packages/client (dòng `main.ts`): quy ước "sảnh sẵn sàng". Mục Kiểm thử: helper `openPage`/`enterLobby`/`join`/`waitForWorld`, nhật ký trang chỉ in khi lỗi (hai dòng `navigated` kèm tin `[vite]` nghĩa là Vite tải lại trang giữa chừng), không sửa file client/shared khi e2e đang chạy, chạy lặp bằng `--repeat-each=N --workers=1`.

### Tự kiểm bằng e2e có chọn lọc (không phải thay cho tester)

- Test hồi quy `lobby:` trên code mới: `-g "lobby:" --workers=1` qua (1,3 s); `-g "lobby:" --repeat-each=5 --workers=1`: **5/5 qua** (10,2 s).
- Test hồi quy phải **không qua** trên code cũ, nếu không thì vô nghĩa: tạm đặt `index.html` và `main.ts` của `HEAD` vào cây làm việc, chạy `-g "lobby:"`, rồi trả bản mới về (kiểm bằng `git diff`). Kết quả: không qua ở `expect(#join-btn).toBeDisabled()` (nút đang `enabled`). Lần lỗi này cũng cho thấy nhật ký trang hoạt động: khối `Page log:` in ra với `navigated http://localhost:5173/?room=no-such-room&quality=low`, `console.debug [vite] connecting...`, `console.debug [vite] connected.`; các lần qua thì không in gì.
- Nhánh lỗi của `waitForWorld` (spec tạm ngoài repo, đã bỏ): vào phòng `no-such-room`, `waitForWorld` ném `Still in the lobby: Không vào được phòng...` sau 43 ms thay vì chờ hết giờ.
- Các test có dùng helper mới, chạy một lần trên code mới, đều **qua**: "5 players share one world and a 6th is turned away" (6,2 s), "wild pals spawn and can be targeted" (0,8 s), "a captured pal follows the player and shows in the party panel" (15,8 s), "explorer: a look picked in the lobby..." (14,6 s), "movement is synced to other players" (9,5 s), "HUD shows health..." (3,3 s), "regions: the HUD names the region..." (3,1 s). Chưa chạy (việc của tester, chỉ dùng `join` + `waitForWorld` như cũ): crafting, exploring, gameplay, skills, pack leaders.
- Thời gian đo được để tester ước lượng: 8 trong 13 test chạy hết khoảng 1 phút trên máy này (4 nhân), nhiều khả năng ngắn hơn nhiều so với ước 15-20 phút cho 3 lượt cả bộ trong PLAN.md; số thật sẽ do tester ghi.

### Lệch kế hoạch

- Test tạm bước 0/4 nằm trong file riêng `tests/e2e/t1-repro.tmp.spec.ts` thay vì cuối `multiplayer.spec.ts` (tự đóng context trong `finally`, không dùng `contexts`). Nội dung, lệnh chạy và kỳ vọng đúng như kế hoạch; lý do: không có nguy cơ sót test tạm trong spec chính. Có làm cả bản B (tuỳ chọn trong kế hoạch).
- Test hồi quy dùng `enterLobby(page, "Early")` cho bước 8 (thay vì `fill` + `click` rời): cùng thao tác, thêm kiểm tra giá trị ô.
- Ghi chú nhỏ, không ảnh hưởng code: số worker mặc định (`"50%"` số nhân CPU, tức 2 worker trên máy 4 nhân) nằm ở `node_modules/playwright/lib/common/config.js:97`, không phải `suiteUtils.js:98` như PLAN.md ghi; `docs/architecture.md` không ghi số dòng nên không bị ảnh hưởng.
- Chú thích cũ "skip post-processing" cạnh `quality=low` được giữ nguyên (client không còn đọc tham số này từ commit 9ab605b; kế hoạch dặn giữ tham số).

### Lệnh đã chạy (không còn server nào chạy nền; cổng 2567 và 5173 trống)

- `npm run typecheck` ✓ (6,9 s). `tests/e2e` không nằm trong typecheck nên đã kiểm riêng bằng `tsc` với tsconfig tạm (ngoài repo) trỏ vào `tests/e2e/*.ts`: sạch.
- `npm test` ✓ (20 file, 184 test, 63 s).
- `npm run build` ✓ (1,2 s).
- Việc còn lại cho tester theo PLAN.md: `-g "wild pals spawn" --repeat-each=10 --workers=1`; `--repeat-each=3 --workers=1` cả bộ (chạy nền nếu dài); `npm run test:e2e` một lần; kiểm nhật ký trang bằng cách cố ý làm hỏng tạm một test (không commit).

## Kiểm thử vòng 1: PASS
- typecheck ✓ (6,6 s)   test ✓ (20 file, 184 test, 60 s)   build ✓ (1,3 s)   e2e ✓ (4 lượt cả bộ = 52 test, cộng 15 lượt chạy lặp lẻ: 67 lượt test qua, 0 hỏng, 0 chập chờn)   photo3d (không chạy: không đụng `tools/photo3d`)
- `tests/e2e` không nằm trong typecheck: kiểm riêng bằng `tsc` với tsconfig tạm (ngoài repo) trỏ vào `tests/e2e/*.ts` -> sạch.
- Lệnh e2e theo PLAN.md (cổng 2567/5173 trống trước mỗi lệnh, tất cả `--workers=1` trừ lần `npm run test:e2e`), thời gian thật:

  | Lệnh | Kết quả | Thời gian |
  |---|---|---|
  | `npx playwright test -g "lobby:" --repeat-each=5 --workers=1` | 5/5 qua | 9,5 s |
  | `npx playwright test -g "wild pals spawn" --repeat-each=10 --workers=1` | 10/10 qua | 29,0 s |
  | `npx playwright test --repeat-each=3 --workers=1` (chạy nền, 3 lượt cả bộ liên tiếp trong một phiên server) | 39/39 qua; không có khối `Page log:` nào | 4,1 phút |
  | `npm run test:e2e` (server khởi động mới, như CI) | 13/13 qua | 1,4 phút (86 s) |

  Một lượt cả bộ khoảng 83-86 s, xa mức 8 phút nên giữ đủ 3 lượt cộng 1 lần chạy thường (4 lượt cả bộ). Ước 15-20 phút trong PLAN.md là quá cao: số thật cho các nhiệm vụ sau là khoảng 1,5 phút một lượt.
- Tiêu chí hoàn thành (PLAN.md):
  - [x] Test tạm bản A (và B) tái hiện lỗi trên code cũ, không tái hiện trên code mới; test tạm đã xoá khỏi spec (`tests/e2e/` chỉ còn `multiplayer.spec.ts`). Coder đã ghi kết quả ở bước 0 và 4; tester chạy lại độc lập (bản sao ngoài repo, xem bên dưới): trên client `HEAD` (Vite cổng 5174) cả A và B **qua**, nghĩa là tái hiện đúng lỗi (URL cuối `http://localhost:5174/?`, ô tên `""`, `localStorage["petgame:name"]` là `null`); trên client mới (cổng 5173) cả A và B **không qua** ở `page.fill: Timeout 10000ms exceeded` (`<input disabled id="name" ...>`, lặp lại `element is not enabled`), nhật ký không có dòng `navigated .../?` nào.
  - [x] `index.html`: `#name` có `disabled`; `#join-btn` có `disabled autocomplete="off"` và chữ "Đang tải..."; có `#join-btn:disabled` và `#lobby input:disabled`; `#join-btn` có `min-height: 44px; box-sizing: border-box`.
  - [x] `main.ts`: ba lệnh mở khoá nằm ngay sau `form.addEventListener("submit", ...)`; `git diff` chỉ thêm 6 dòng, thân handler không đổi.
  - [x] Spec: `#join-btn` chỉ còn ở `enterLobby` (dòng 51, 54) và test hồi quy (dòng 499-514); `join` = `openPage` + `enterLobby`; `waitForTimeout` vẫn 13 chỗ như `HEAD`; 5 `timeout` cũ giữ nguyên giá trị (không thêm, không tăng); không có `retries`; `force: true` chỉ ở dòng 510 (test hồi quy); `playwright.config.ts`, `scripts/`, server, shared không đổi.
  - [x] `waitForWorld` ném lỗi ngay kèm nội dung `#join-error`: kiểm bằng bản sao spec thật cộng một test tạm vào phòng `no-such-room`: ném `Still in the lobby: Không vào được phòng...` sau **42 ms**.
  - [x] Nhật ký trang chỉ in khi test lỗi: 0 khối `Page log:` trong 39 lượt qua của bộ lặp 3 lần. Khi lỗi thì in đúng: (a) test hồi quy chạy trên client cũ in `navigated http://localhost:5174/?room=no-such-room&quality=low`, `console.debug [vite] connecting...`, `console.debug [vite] connected.`; (b) bản sao spec cố ý làm hỏng (test "wild pals spawn" bị đổi thành `expect(palCount).toBeLessThan(0)`) in `[Catcher] navigated http://localhost:5173/?quality=low` cùng hai dòng `console.debug [vite] connecting...` và `[vite] connected.`.
  - [x] Test hồi quy qua, kể cả nút ≥ 44 px. Đo thật trên client mới (cả hai trạng thái khoá và sẵn sàng): 1280×720 là 340×45 px, 390×844 là 340×45 px, 844×390 là 680×44 px (PLAN.md đo 39 px ở ngang trước khi sửa).
  - [x] `npm run typecheck`, `npm test`, `npm run build` sạch.
  - [x] Mọi lệnh e2e ở mục Test đều qua, 0 lỗi (bảng trên): 5 lượt hồi quy, 10 lượt "wild pals spawn", 3 lượt cả bộ liên tiếp và 1 lần `npm run test:e2e`, tổng 4 lượt cả bộ.
  - [x] `docs/architecture.md` có quy ước "sảnh sẵn sàng" (mục packages/client) và các lưu ý chạy e2e (mục Kiểm thử).
- Test hồi quy `lobby:` thật sự bắt được lỗi cũ (kiểm chứng độc lập, bản sao `HEAD` của `packages/client` đặt ngoài repo, Vite cổng 5174; không đụng file nào trong repo):
  - Test `lobby:` nguyên bản trên client cũ: **không qua** ở `expect(locator('#join-btn')).toBeDisabled()`: `Expected: disabled`, `Received: enabled` (`multiplayer.spec.ts:499`), kèm khối `Page log:` như trên.
  - Biến thể bỏ các assert khoá/chữ/chiều cao nút, chỉ giữ cú bấm `force` và các assert về hệ quả, chạy trên client cũ cùng server thật: cũng **không qua**, ở `expect(#join-error).toContainText("Không vào được")` (nhận `""`); nhật ký có hai dòng `navigated http://localhost:5174/?` (trình duyệt tự gửi form, mất `?room=`). Tức là các assert về hệ quả (giữ `?room=`, đúng 1 lần điều hướng, tên được lưu) tự chúng cũng bắt được lỗi cũ, không chỉ assert `disabled`.
- Kiểm tra bổ sung của tester (spec tạm ngoài repo, không commit; không đổi kết luận):
  - Bàn phím và cảm ứng: khi sảnh còn khoá, Tab, gõ chữ và Enter không gửi form (1 lần điều hướng, `?room=` còn nguyên); khi sẵn sàng, điền tên rồi Enter vào được (lưu tên, báo lỗi phòng không có, không tải lại trang, nút dùng lại được); chạm (`tap`) nút ở 844×390 vào được; tên đã lưu vẫn được điền sẵn khi sảnh mở khoá. 3/3 qua.
  - Ảnh chụp sảnh ở 1280×720, 390×844, 844×390, mỗi cỡ hai trạng thái (khoá: script sảnh bị thay bằng module rỗng; sẵn sàng: tải bình thường), đã xem bằng mắt: khoá hiện ô tên mờ và nút "Đang tải..." mờ (`opacity: 0.6`, `cursor: progress`), không vỡ bố cục; sẵn sàng hiện đủ ngoại hình, tên, nút "Vào chơi" sáng, không tràn ở 844×390.
  - `npm run shots -- --name t1-tester` (qua bản build thật): lần đầu bị cắt giữa chừng khi phiên khởi động lại (ba ảnh đầu đã chụp xong sau khi vào qua sảnh mới); chạy lại xong, exit 0, 15 ảnh, 69 s, sprite nhiều nhất 375 (ngân sách 600). `scripts/shots.mjs` (không sửa) vào được sảnh mới nhờ `fill`/`click` tự chờ; ảnh `phone.png` xem bằng mắt, bình thường.
  - Khởi động lạnh như CI (bản sao cây làm việc ngoài repo, thư mục cache Vite chưa có): cả bộ 13/13 qua (93 s), `lobby:` chạy riêng 1/1 qua (5 s); log không có thông báo Vite tối ưu lại hay tải lại trang.
- Lỗi: không có.
  - Ghi chú không chặn: mỗi lần chạy, terminal in vài dòng `[WebServer] ... [vite] (client) [console.error] MatchMakeError: ...` kèm ngăn xếp: `room "no-such-room" not found` (test `lobby:`, mới) và `room "<id>" is locked` (test "5 players...", đã có từ trước). Đó là Vite chuyển tiếp lỗi console của trang, và lỗi do chính test cố ý gây ra, không phải hỏng; đừng nhầm với lỗi thật khi đọc log CI. Đề xuất (tuỳ chọn, cho coder): thêm bước Enter trên bàn phím vào test hồi quy thì sảnh được kiểm tra đủ cả chuột/cảm ứng lẫn bàn phím trong repo.
- Test đã thêm: không thêm vào repo. Mọi thứ PLAN.md yêu cầu (helper, nhật ký trang, test hồi quy `lobby:`) đã do coder làm; không có test nào PLAN.md yêu cầu mà còn thiếu. Các spec kiểm chứng của tester nằm ngoài repo, trong `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/tester1/` (`variant/`, `waitspec/`, `logspec/`, `inputspec/`, `repro/`, `oldclient/`, `cold/`, `cold2/`); không sửa code sản phẩm.
