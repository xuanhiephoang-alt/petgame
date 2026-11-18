# PLAN: T13 PWA cài được đúng nghĩa: icon, service worker, lấy bản mới khi có mạng

Code đọc ở `b609b39` (commit "Mark T12b done, start T13"), gọi là **BASE**. Số dòng trôi khi sửa: tìm theo chữ hoặc tên hàm.

Đề xuất chia hai đợt, mỗi đợt một commit, chung kế hoạch này (giống T10/T10b):
- **T13 (đợt 1, asset-manager):** Phần A: icon, manifest, thẻ `<link>` trong `index.html`, test manifest. Thuần hình ảnh và khai báo, không đổi hành vi game.
- **T13b (đợt 2, coder):** Phần B: service worker, đăng ký, plugin build, Playwright, e2e mới, tài liệu.

Agent chính có thể chạy cả hai đợt trong một vòng (asset-manager làm A rồi coder làm B) nếu muốn; A không phụ thuộc B và B chỉ cần các file PNG của A có sẵn (nếu B làm trước thì e2e phần icon hỏng, phần service worker vẫn đúng).

## Mục tiêu

- Người chơi thêm PetGame vào Màn hình chính (iPhone: Safari → Chia sẻ → Thêm vào MH chính; Android: Chrome → Cài đặt ứng dụng) thấy **icon Emberpup** trên nền cỏ xanh, không còn ô chụp màn hình mờ hay chữ "P". Chrome coi game là app cài được (manifest đủ icon 192, 512, maskable).
- Có **service worker** lưu sẵn trang và script của bản build:
  - mở lại game nhanh hơn một chút và không phụ thuộc HTTP cache;
  - mất mạng mà mở game (đã mở qua HTTPS trước đó) thì vẫn thấy sảnh và thẻ "Không kết nối được server" có nút Thử lại, thay vì trang lỗi của trình duyệt;
  - tab cũ sau khi deploy vẫn lấy được script cũ của nó từ bộ nhớ, ít phải tải lại hơn.
- Không phá những gì T15, T23, T42 đã làm: **Tải lại** luôn ra bản mới khi có mạng; bộ canh tải inline vẫn bắt được script hỏng; không bao giờ lưu `/matchmake`, WebSocket hay `/whoami`.

## Phạm vi

**Làm:**
- 5 file PNG (`icon-192`, `icon-512`, `icon-maskable-192`, `icon-maskable-512`, `apple-touch-icon` 180) làm từ ảnh Emberpup có sẵn bằng một script Python (Pillow), chạy một lần và commit PNG.
- `manifest.webmanifest`: icon, `id`, `scope`, `lang`, `description`. `index.html`: `apple-touch-icon`, `icon`, `apple-mobile-web-app-title`.
- Service worker viết bằng TypeScript (`src/pwa/`): logic định tuyến và chiến lược lưu là hàm thuần có unit test; file `sw.js` sinh lúc `npm run build` bằng một plugin nhỏ trong `vite.config.ts`, kèm phiên bản và danh sách lưu sẵn.
- Chỉ đăng ký ở bản build (`import.meta.env.PROD`). Vite dev (`npm run dev`, e2e hiện có) không bao giờ đăng ký.
- Playwright:
  - server e2e bật sau `npm run build`, nên `http://localhost:2567` phục vụ bản build;
  - mọi context chặn service worker (`serviceWorkers: "block"`);
  - một spec mới `tests/e2e/pwa.spec.ts` bật lại service worker và kiểm trên bản build.
- `scripts/shots.mjs` chặn service worker (ảnh chụp và số đo không bị nhiễu).
- Tài liệu: `docs/architecture.md`, `docs/choi-tren-iphone.md`, `docs/deploy.md`, `docs/art-style.md`, `assets/CREDITS.md`. Designer đã sửa `docs/design/multiplayer.md`: thêm dòng "mất mạng" vào bảng "Mở game", luật "luôn lấy bản mới khi có mạng", và hai giới hạn của app ở Màn hình chính.

**KHÔNG làm** (để coder không lan rộng):
- **Không thêm Content-Security-Policy** (header, `<meta>` hay trong service worker). Không cần cho T13. Ai thêm sau này phải cho phép script inline của bộ canh tải bằng hash `sha256-…` (ghi trong `docs/deploy.md`).
- Không `skipWaiting`, không nghe `controllerchange`, không tự tải lại trang, không thông báo "có bản mới". Tải lại sau deploy là việc của **T52** (mục "Phối hợp với T52").
- Không lưu ảnh AI `/assets/**` (2,8 MB, tên cố định), không lưu icon, không lưu gì của server (`/matchmake`, `/whoami`, `/healthz`), không lưu khác origin.
- Không gợi ý quay lại thế giới khi mở app từ Màn hình chính (T23); không mang hồ sơ Safari sang app iPhone. Cả hai đề xuất thành việc mới (cuối kế hoạch).
- Không đổi `start_url`, `display`, `orientation`, màu của manifest; không đổi `apple-mobile-web-app-status-bar-style` (đổi là đổi bố cục tai thỏ trên iOS).
- Không sửa `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts` (trùng với phần dở dang T63 trong `git stash`). **Không dùng `git stash`** (không `stash`, `stash pop`, `stash apply`) trong T13.
- Không dùng AI vẽ ảnh (Figma/Canva), không thêm dependency npm (không `vite-plugin-pwa`/Workbox: kéo nhiều gói và khó giữ luật "không bao giờ lưu `/whoami`").

## Thiết kế

### 1. Icon (Phần A, asset-manager)

Nguồn: `packages/client/public/assets/pals/emberpup.webp` (ảnh AI của dự án, đã ghi trong `assets/CREDITS.md`). Ô đầu là hướng `front` (`index.json`: `views[0] = "front"`). Cắt ô giống `palSprites.ts`: rộng ô = `floor(952 / 4) = 238`, cao cả ảnh. Rồi cắt theo vùng có alpha: bbox (27, 8, 211, 264), tức thú 184×256. Emberpup là thiết kế riêng của dự án, không dính bản quyền.

Mỗi kiểu vẽ ở khung gốc 1024×1024 rồi thu nhỏ bằng LANCZOS. Designer đã thử bản nháp (ảnh xem trước tốt; vùng an toàn đo ở dưới).

| File (trong `packages/client/public/`) | Cỡ | Hình nền | Chiều cao thú | Vị trí thú |
|---|---|---|---|---|
| `icons/icon-192.png`, `icons/icon-512.png` (`purpose: "any"`) | 192, 512 | vuông bo góc bán kính 0,22·S, ngoài góc trong suốt | 0,80·S | giữa theo chiều ngang, chân ở 0,92·S |
| `icons/icon-maskable-192.png`, `icons/icon-maskable-512.png` (`purpose: "maskable"`) | 192, 512 | vuông kín, không trong suốt | 0,68·S | tâm bbox thú ở tâm ảnh |
| `apple-touch-icon.png` | 180 | vuông kín, không trong suốt (iOS tự bo góc; chỗ trong suốt thành màu đen) | 0,76·S | giữa, chân ở 0,90·S |

- **Nền:** gradient tròn, tâm (0,5·S; 0,42·S), từ `#7dbf5e` ở tâm tới `#1f3a1d` ở bán kính 0,72·S, `t = min(1, d / (0,72·S))^1,2`. Sáng ở giữa sau lưng thú, tối dần về mép, hợp màu `theme_color` `#1b2a1b`.
- **Bóng dưới chân:** elip đen alpha 70/255, rộng 0,72 × bề rộng thú, cao 0,05·S, làm mờ Gauss 0,01·S. Đúng luật "bóng mềm" của `docs/art-style.md`.
- **Không có chữ:** chữ "PetGame" ở 48 px không đọc được, và tên app đã hiện dưới icon.
- **Vùng an toàn maskable:** mọi điểm của thú có alpha > 16 phải nằm trong hình tròn bán kính 0,40·S quanh tâm (chuẩn maskable: vùng an toàn là hình tròn đường kính 80%). Bản nháp đo được bán kính xa nhất 0,309·S khi thú cao 0,58·S. Bán kính tăng tuyến tính theo chiều cao, nên với 0,68·S là khoảng 0,36·S, còn dư. Script phải **tự kiểm** điều này và thoát lỗi nếu vượt.
- **Kiểu `any`:** bản nháp đo thú chạm bán kính 0,446·S, vẫn nằm trong khung vuông bo góc. Launcher Android có thể đặt icon `any` lên nền trắng, nên giữ góc trong suốt.

### 2. Manifest và thẻ trong `<head>` (Phần A)

`manifest.webmanifest` giữ nguyên `name`, `short_name`, `start_url`, `display`, `orientation`, hai màu. Thêm:
```json
"id": "/",
"scope": "/",
"lang": "vi",
"dir": "ltr",
"description": "Bắt thú, chiến đấu và xây trại cùng bạn bè, tối đa 5 người một thế giới.",
"categories": ["games"],
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
`index.html` `<head>`, ngay sau `<link rel="manifest" …>`:
```html
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-title" content="PetGame" />
```
`apple-touch-icon.png` nằm ở gốc vì iOS tự dò `/apple-touch-icon.png` khi không thấy thẻ. Vite để nguyên đường dẫn tuyệt đối tới `public/`.

### 3. Service worker: định tuyến (Phần B)

Một hàm thuần quyết định mỗi request đi đường nào. Xét theo thứ tự, luật đầu tiên khớp thắng:

| # | Request | Cách xử lý | Khoá trong cache |
|---|---|---|---|
| 1 | method khác `GET` (POST `/matchmake/…`, HEAD…) | **bỏ qua** (không `respondWith`, trình duyệt tự đi mạng) | |
| 2 | khác origin (kể cả `ws:`/`wss:`, server tách riêng qua `VITE_SERVER_URL`) | **bỏ qua** | |
| 3 | đường dẫn là `/matchmake` hoặc bắt đầu `/matchmake/`; đúng `/whoami`, `/healthz`, `/sw.js` | **bỏ qua** | |
| 4 | bắt đầu `/build/` (file Vite đã đánh hash) | **cache trước** (cache-first) | `pathname` (bỏ `?…`) |
| 5 | `mode === "navigate"` tới `/` hoặc `/index.html` (mọi `?room=`, `?quality=`) | **mạng trước** (network-first) | `"/"` |
| 6 | `/manifest.webmanifest` | **mạng trước** | `pathname` |
| 7 | còn lại: `/assets/**`, `/icons/**`, `/apple-touch-icon.png`, điều hướng tới đường khác (`/sprites.html`…) | **bỏ qua** | |

- WebSocket (kết nối thế giới) không bao giờ đi qua sự kiện `fetch` của service worker. Luật 2 chỉ để chắc chắn, có test.
- Điều hướng tới `/whoami` (người vận hành mở trên điện thoại, `docs/deploy.md`) rơi vào luật 3 nên luôn là câu trả lời thật của server.
- **Cache trước** (`/build/*`): có trong cache thì trả ngay. Không có thì `fetch`: status 200 thì cất bản sao (không chặn câu trả lời, qua `event.waitUntil`); status khác (404 sau deploy) thì trả nguyên, không cất. `fetch` ném lỗi (mất mạng) thì ném lại, để trang thấy lỗi mạng. **Không bao giờ thay bằng `index.html` hay bản khác.** Nhờ vậy thẻ `<script>` vẫn báo `error`: bộ canh tải của T15 hiện "Không tải được game", và `import()` động vẫn hỏng thành `vite:preloadError` cho T52.
- **Mạng trước** (trang, manifest): `fetch` trước. Status 200 mà không `redirected` thì cất bản sao dưới khoá, rồi trả câu trả lời mạng. Status khác (502 lúc Render/Fly đang deploy) thì trả nguyên, không cất, không lùi về cache. Chỉ khi `fetch` **ném lỗi** (không có mạng) mới lấy khoá trong cache; không có thì ném lại (trang lỗi mạng của trình duyệt, như trước T13). Không đặt giờ chờ: chậm thì chờ mạng. Lùi về cache khi mạng chậm có thể ra HTML cũ sau deploy, đúng điều T15 cấm.
- Cất trang dưới một khoá `"/"` bất kể `?room=`: mọi địa chỉ sảnh trả cùng một `index.html`. Không cất câu trả lời `redirected` (Safari từ chối câu trả lời đã chuyển hướng cho điều hướng).

### 4. Service worker: phiên bản, lưu sẵn, dọn cache (Phần B)

- Mỗi bản build có **phiên bản** = 12 ký tự đầu sha256 của (nội dung `dist/index.html` + danh sách lưu sẵn đã sắp xếp). Chỉ phụ thuộc nội dung nên build lại không đổi gì thì ra cùng phiên bản (build tái lập được). Tên cache `petgame-<phiên bản>`.
- **Danh sách lưu sẵn**, tính từ file trong `dist/`: `/`, `/manifest.webmanifest` và mọi file `/build/*` (bỏ `.map` nếu sau này bật sourcemap). Đo ở bản build ngày 14/11:
  - `/build` 13 file, 1 037 052 byte, phần lớn trình duyệt vừa tải (đã nằm trong HTTP cache);
  - chỉ các chunk tải lười của PixiJS chưa được tải (`browserAll` 43 kB, `init` 15 kB, `webworkerAll`), cộng `/` 33 kB;
  - tức lần đầu tải thêm khoảng 100 kB.
- **install:** `cache.addAll` cả danh sách. `/` và manifest tải với `cache: "reload"` (bỏ HTTP cache, để bản lưu sẵn khớp phiên bản). `/build/*` tải thường (file bất biến, HTTP cache có sẵn). Một file hỏng thì install hỏng cả, trình duyệt thử lại ở lần mở sau.
- **activate:** xoá mọi cache tên bắt đầu `petgame-` khác cache hiện tại (cache khác của origin không đụng tới), rồi `clients.claim()`. Nhờ đó ngay lần mở đầu tiên trang đã được service worker điều khiển (e2e kiểm), không cần tải lại.
- **Không `skipWaiting`.** Sau deploy, bản service worker mới cài xong thì **chờ** tới khi mọi tab của bản cũ đóng. Trong lúc đó:
  - tab cũ vẫn lấy được chunk cũ từ cache cũ (đã lưu sẵn đủ, kể cả chunk tải lười), nên đang chơi thì không bị hỏng giữa chừng;
  - tab tải lại vẫn được bản service worker cũ phục vụ, nhưng trang lấy từ mạng trước nên ra **HTML mới**: chunk mới không có trong cache cũ thì tải từ mạng rồi cất vào cache cũ;
  - khi bản mới kích hoạt thì cache cũ bị xoá.

  Chấp nhận: một tab cứ tải lại mãi (không đóng) giữ bản service worker cũ lâu. Nội dung game vẫn mới, chỉ logic service worker chậm cập nhật.
- `sw.js` được Express phục vụ như file tĩnh thường (`max-age=0`, có ETag). Trình duyệt luôn kiểm lại `sw.js` khi mở trang (mặc định `updateViaCache: "imports"`). Không cần đổi `packages/server/src/index.ts`.

### 5. Đăng ký (Phần B)

- `registerServiceWorker()` gọi trong `main.ts` **sau** `document.dispatchEvent(new Event(LOBBY_READY_EVENT))`, nên không thể làm chậm hay chặn sảnh.
- Ba điều kiện trong hàm, không thoả thì không làm gì:
  - `import.meta.env.PROD` (Vite dev không bao giờ đăng ký: HMR và e2e trên 5173 không đổi);
  - `"serviceWorker" in navigator` (thiếu khi không phải ngữ cảnh an toàn: `http://192.168.…` của `npm run play` qua Wi-Fi; hoặc trình duyệt cũ);
  - bọc `try/catch` (một số chế độ riêng tư ném `SecurityError`).
- Đăng ký lúc `load` (`document.readyState === "complete"` thì gọi ngay), để việc lưu sẵn không tranh băng thông với lần tải đầu. Đường dẫn `import.meta.env.BASE_URL + "sw.js"`, scope mặc định `/`. Lỗi đăng ký chỉ `console.warn`, không bao giờ ném.
- Chạy ở `localhost` của bản build (`npm run play`, e2e mới, `npm run shots`): vẫn đăng ký, vì `localhost` là ngữ cảnh an toàn và đó là cách duy nhất để thử. `npm run shots` tự chặn bằng `serviceWorkers: "block"`.

### 6. Phối hợp với T52 ("tự tải lại sau deploy")

- T13 **không** tự tải lại, không `skipWaiting`, không nghe `controllerchange`. Cơ chế duy nhất tải lại sau deploy vẫn là của T52 (`vite:preloadError` → tải lại một lần).
- Hai điều T13 bảo đảm cho T52:
  1. tải lại luôn lấy HTML từ mạng trước;
  2. chunk thiếu (404 hay mất mạng) vẫn hỏng như không có service worker, nên `vite:preloadError` vẫn xảy ra.
- Nhờ lưu sẵn, tab cũ thường tìm thấy chunk cũ trong cache, nên T52 ít phải tải lại hơn. Đó là điều tốt, T52 không cần làm gì thêm.
- Ghi chú này vào `docs/architecture.md`. Agent chính thêm một câu vào dòng T52 trong `TASKS.md` (mục "Đề xuất cho TASKS.md").

### 7. Trải nghiệm theo thiết bị

- **iPhone, Safari, HTTPS** (Render/Fly, Cách B):
  - Thêm vào MH chính thì icon `apple-touch-icon.png`, tên "PetGame";
  - mở toàn màn hình như trước (`apple-mobile-web-app-capable`);
  - mất mạng mà mở app thì sảnh vẫn hiện, bấm Vào chơi ra thẻ "Không kết nối được server" (đã có ở T23), Thử lại khi có mạng.
- **iPhone qua Wi-Fi `http://192.168.…`** (Cách A): vẫn thêm được vào MH chính kèm icon. Không có service worker (không phải ngữ cảnh an toàn), game chạy như trước T13.
- **Android Chrome, HTTPS:** menu có "Cài đặt ứng dụng" hoặc lời mời cài. Icon maskable cắt tròn hay bo góc theo launcher; mở toàn màn hình, nằm ngang (`orientation` giữ nguyên).
- **Desktop:** tab có icon; Chrome có nút cài trên thanh địa chỉ.
- **Bàn phím, cảm ứng:** không có nút mới, không đổi HUD. Không có chữ mới trong game; chữ tiếng Việt mới duy nhất là `description` của manifest.
- **iPhone, điều phải biết** (ghi vào `docs/choi-tren-iphone.md`): app ở MH chính dùng bộ nhớ riêng, không chung `localStorage` với Safari, nên lần đầu mở app là một người chơi mới (tên, thú, trại ở Safari không theo sang). Hành vi của iOS, có từ trước T13 (Thêm vào MH chính đã được khuyên trong tài liệu). Cần kiểm trên máy thật, đề xuất T80.

### 8. Quay lại thế giới khi mở app từ Màn hình chính (T23): ngoài phạm vi

Đã cân nhắc:
- `start_url` cố định (`/`), không đổi được theo lần chơi; iOS mở lại `start_url` khi app bị đóng hẳn.
- Danh sách `petgame:worlds` (T65) có `room` và `friends` nhưng **không có giờ**. Sảnh không phân biệt được "thế giới bạn bè vừa chơi 2 phút trước" với "thế giới tuần trước" (đã đóng, sẽ gặp thẻ "đã đóng").
- Làm đúng cần:
  - thêm trường giờ vào `RecentWorld`;
  - ghi giờ lúc rời trang (`pagehide`);
  - một nút phụ mới ở sảnh, chữ mới trong `ui/strings.ts`;
  - e2e mới.

  Thêm cả phần này thì T13 quá một vòng.
- Trường hợp hay gặp (chuyển app qua lại) đã được kết nối lại của T3 lo, vì trang vẫn sống.

Kết luận: không làm trong T13; ghi giới hạn vào `docs/design/multiplayer.md` (designer đã sửa) và đề xuất **T79**.

## Kế hoạch triển khai

### Phần A (asset-manager), đợt T13

**A1. `scripts/appIcons.py`** (mới). Python 3 + Pillow (numpy được phép, đã có trong yêu cầu của photo3d). Chạy: `python3 scripts/appIcons.py` từ gốc repo. Viết file theo bảng ở Thiết kế 1. Yêu cầu:
- Đọc `views` trong `packages/client/public/assets/pals/index.json` để tìm ô `front`. Bề rộng ô = `floor(W / số hướng)`, giống `palSprites.ts`. Rồi cắt theo bbox alpha.
- Hằng số ở đầu file, tên `UPPER_SNAKE_CASE`: `SOURCE`, `MASTER = 1024`, màu nền, các tỉ lệ trong bảng, `SAFE_RADIUS = 0.40`.
- Tất định: không ngẫu nhiên; chạy hai lần ra cùng byte (lưu PNG `optimize=True`, không ghi thời gian).
- Kiểm vùng an toàn maskable trên ảnh 1024 trước khi thu nhỏ. Vượt `SAFE_RADIUS` thì `sys.exit` kèm số đo.
- Kiểm `apple-touch-icon.png` và icon maskable không có pixel alpha < 255.
- In ra mỗi file: cỡ, số byte, bán kính xa nhất của thú.
- Docstring và chú thích tiếng Anh.

**A2.** Chạy script, commit 5 PNG:
- `packages/client/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`;
- `packages/client/public/apple-touch-icon.png`.

Ghi vào `PROGRESS.md` cỡ file và bán kính đo được, kèm một ảnh xem trước bản maskable cắt tròn (để trong scratchpad, không commit).

**A3. `packages/client/public/manifest.webmanifest`:** đúng khối ở Thiết kế 2, thứ tự khoá: `id, name, short_name, description, lang, dir, start_url, scope, display, orientation, background_color, theme_color, categories, icons`.

**A4. `packages/client/index.html`:** 3 dòng ở Thiết kế 2, ngay sau `<link rel="manifest" …>`. Không đụng gì khác trong file (nhất là script canh tải inline).

**A5. `scripts/pwaManifest.test.mjs`** (mới; Vitest đã gom `scripts/**/*.test.mjs`; dùng `node:fs` nên không đặt trong `packages/client/src`, vì tsconfig client không có kiểu Node). Đọc PNG qua header IHDR: byte 0-7 là chữ ký PNG, rộng/cao là `readUInt32BE(16)` / `readUInt32BE(20)`. Các ca:
1. Manifest là JSON hợp lệ, có `name`, `short_name`, `start_url: "/"`, `id`, `scope`, `display`, `background_color`, `theme_color`.
2. Có ít nhất một icon `any` 192×192, một `any` 512×512, một `maskable` 512×512.
3. Mỗi `icons[].src` tồn tại trong `packages/client/public/`, là PNG, và cỡ thật đúng `sizes`.
4. `index.html` có `rel="apple-touch-icon"` trỏ tới file tồn tại, PNG 180×180; có `rel="icon"` trỏ tới file tồn tại.

**A6. Tài liệu:**
- `assets/CREDITS.md`: thêm dòng "`packages/client/public/icons/*.png`, `apple-touch-icon.png` | Dựng từ ảnh Emberpup (`pals/emberpup.webp`) bằng `scripts/appIcons.py` | Thuộc dự án".
- `docs/art-style.md`: thêm đoạn ngắn "Icon app" (nguồn, lệnh, bảng tỉ lệ rút gọn, luật vùng an toàn maskable; muốn đổi thú làm icon thì sửa `SOURCE` rồi chạy lại).

### Phần B (coder), đợt T13b

**B1. `packages/client/src/pwa/swLogic.ts`** (mới, hàm thuần, không đụng `self`/`caches` ở cấp module, chạy được trong Node). Export:
```ts
/** Prefix of every Cache Storage name this game owns; caches with other names are never touched. */
export const CACHE_PREFIX = "petgame-";
export function cacheName(version: string): string;
/** Paths the worker never answers (server replies): exact match, or the path followed by "/". */
export const NEVER_HANDLED: readonly string[] = ["/matchmake", "/whoami", "/healthz", "/sw.js"];
export interface SwRequest { url: string; method: string; mode: string }
export type SwRoute = { strategy: "network-first" | "cache-first"; key: string } | { strategy: "bypass" };
export function routeFor(req: SwRequest, origin: string): SwRoute;          // bảng ở Thiết kế 3
export function precacheUrls(distFiles: readonly string[]): string[];       // Thiết kế 4; nhận đường dẫn tương đối trong dist, đổi "\" thành "/", trả URL đã sắp xếp
export function freshOnInstall(url: string): boolean;                       // true cho "/" và "/manifest.webmanifest"
export function staleCaches(names: readonly string[], current: string): string[];
export interface CacheLike { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> }
export interface StrategyDeps { fetch(request: Request): Promise<Response>; cache: CacheLike; defer(work: Promise<unknown>): void }
export function cacheFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response>;
export function networkFirst(request: Request, key: string, deps: StrategyDeps): Promise<Response>;
```
- Điều kiện cất: `status === 200 && !redirected`.
- `defer` nhận lời hứa `cache.put(key, response.clone())`.
- JSDoc tiếng Anh nói vì sao: network-first để Tải lại không bao giờ ra HTML cũ (T15); không thay câu trả lời hỏng để bộ canh tải và T52 thấy lỗi.
- Không import `@petgame/shared` hay gì của game (file này được đóng gói vào `sw.js`).

**B2. `packages/client/src/pwa/sw.ts`** (mới, chỉ nối dây, khoảng 40 dòng):
- `declare const __PETGAME_SW__: { version: string; precache: string[] };`
- Kiểu tối thiểu khai báo tại chỗ: `SwEvent` (`waitUntil`), `SwFetchEvent` (`request`, `respondWith`), `SwScope` (`location.origin`, `clients.claim()`, `addEventListener` cho `install`/`activate`/`fetch`). Rồi `const sw = globalThis as unknown as SwScope;`. Lib DOM của tsconfig client không có `FetchEvent`, và không thêm lib `WebWorker` (đụng với DOM).
- `install`: `event.waitUntil(caches.open(CACHE).then((c) => c.addAll(precache.map((u) => (freshOnInstall(u) ? new Request(u, { cache: "reload" }) : u)))))`.
- `activate`: xoá `staleCaches(await caches.keys(), CACHE)`, rồi `sw.clients.claim()`, tất cả trong `waitUntil`.
- `fetch`:
  - `const route = routeFor({ url, method, mode }, sw.location.origin)`; `bypass` thì `return` (không gọi `respondWith`);
  - còn lại `event.respondWith(caches.open(CACHE).then((cache) => strategy(event.request, route.key, { fetch: (r) => fetch(r), cache, defer: (p) => event.waitUntil(p) })))`;
  - gọi `waitUntil` sau khi dispatch là hợp lệ vì lời hứa của `respondWith` còn đang chờ.
- Không `skipWaiting`, không `message` handler.

**B3. `packages/client/src/pwa/register.ts`** (mới): `export function registerServiceWorker(): void` theo Thiết kế 5. JSDoc nói ba điều kiện và vì sao (dev/HMR/e2e; http trên LAN; không bao giờ ném).

**B4. `packages/client/src/main.ts`:**
- `import { registerServiceWorker } from "./pwa/register.ts";`;
- gọi `registerServiceWorker();` ngay sau dòng `document.dispatchEvent(new Event(LOBBY_READY_EVENT));`, kèm chú thích một dòng (sau khi sảnh sẵn sàng; bản build mới đăng ký).

Không đổi gì khác.

**B5. `packages/client/vite.config.ts`:** thêm plugin `serviceWorker()` (`name: "petgame-service-worker"`, `apply: "build"`).
- `configResolved`: nhớ `root` và `outDir` tuyệt đối.
- `closeBundle`:
  1. liệt kê đệ quy file trong `outDir` (đường dẫn tương đối, dạng POSIX);
  2. `precache = precacheUrls(files)` (import từ `./src/pwa/swLogic.ts`);
  3. `version = sha256(readFileSync(outDir/index.html) + "\n" + precache.join("\n")).slice(0, 12)` (`node:crypto`);
  4. gọi `build()` của `vite` lần hai để đóng gói `src/pwa/sw.ts` thành `dist/sw.js` dạng IIFE:
  ```ts
  await build({
    configFile: false, root, logLevel: "warn", publicDir: false,
    define: { __PETGAME_SW__: JSON.stringify({ version, precache }) },
    build: { outDir, emptyOutDir: false, copyPublicDir: false, minify: true, sourcemap: false,
      lib: { entry: resolve(root, "src/pwa/sw.ts"), formats: ["iife"], name: "petgameSw", fileName: () => "sw.js" } },
  });
  ```
  5. in một dòng: `service worker <version>: <n> files precached`.
- `configFile: false` nên lần build thứ hai không nạp lại plugin (không đệ quy).
- Giữ nguyên các dòng cấu hình hiện có. Nếu `build.lib` dạng `iife` của Vite 8.3 (rolldown) không ra đúng một file `sw.js` ở gốc `dist/` thì dùng thẳng API `rolldown` (Vite 8 đã kéo theo, không thêm dependency) với `format: "iife"`, cùng `define`. Ghi lựa chọn vào `PROGRESS.md`.
- `vite.config.ts` nằm ngoài typecheck (như hiện nay), nên logic đáng test phải ở `swLogic.ts`.

**B6. `packages/client/src/pwa/swLogic.test.ts`** (mới): các ca ở mục Test.

**B7. `scripts/viStrings.test.mjs`:** thêm `"packages/client/src/pwa"` vào `GUARDED` (thư mục client mới, không được có chữ tiếng Việt).

**B8. `playwright.config.ts`:**
- `use`: thêm `serviceWorkers: "block"`, kèm chú thích: e2e chạy trên Vite dev không có service worker; chặn để route và số đo không bao giờ bị service worker chen vào; `tests/e2e/pwa.spec.ts` tự bật lại.
- `webServer[0]`:
  - `command: "npm run build && npm run start --workspace=@petgame/server"`, để server ở 2567 phục vụ đúng bản build của cây làm việc hiện tại;
  - thêm `timeout: 180_000` (mặc định 60 s có thể không đủ cho build cộng khởi động).

  Chú thích: build chạy trước khi có trang nào mở, nên Vite dev ở 5173 không thể tải lại trang nào vì `dist/index.html` đổi (rủi ro của T1).
- Không đổi gì khác (env, cổng, `webServer[1]`).

**B9. `tests/e2e/pwa.spec.ts`** (mới, các ca ở mục Test). Không import gì từ `multiplayer.spec.ts`; tự viết 2 helper nhỏ (chờ `#join-btn:enabled` rồi điền tên, bấm; chờ vào thế giới như `waitForWorld`). Chú thích rằng chúng chép tạm vì T63 đang giữ `multiplayer.spec.ts`; gom lại ở T16/T20. Mọi context mở bằng `browser.newContext({ serviceWorkers: "allow" })`, ghi rõ để đè `block` của config. Đóng context trong `afterEach`.

**B10. `scripts/shots.mjs`:** thêm `serviceWorkers: "block"` vào cả 4 lời gọi `browser.newContext(...)` (dòng 92, 127, 222, 320 ở BASE; dùng một hằng `const NO_SW = { serviceWorkers: "block" }` trải vào), kèm chú thích: số sprite và giờ `labels.update` không được nhiễu bởi việc lưu sẵn.

**B11. Tài liệu:**
- `docs/architecture.md`, mục `packages/client`: bullet mới **PWA (T13)**:
  - các file `pwa/swLogic.ts`, `sw.ts`, `register.ts`;
  - bảng định tuyến rút gọn;
  - phiên bản, lưu sẵn, dọn cache, không `skipWaiting`;
  - plugin trong `vite.config.ts`;
  - chỉ đăng ký ở bản build và ngữ cảnh an toàn;
  - ghi chú T52 (Thiết kế 6);
  - icon do `scripts/appIcons.py` sinh.

  Mục Kiểm thử: `npm run test:e2e` chạy `multiplayer.spec.ts` và `pwa.spec.ts`; server e2e bật sau `npm run build`; `serviceWorkers: "block"` cho mọi context trừ `pwa.spec.ts`; `shots` chặn service worker.
- `docs/choi-tren-iphone.md`, mục "Mẹo": thay gạch "Thêm vào Màn hình chính" bằng một khối ngắn:
  - cách thêm, kèm icon PetGame;
  - Cách B (HTTPS) mở được khi mất mạng tới sảnh, có thẻ "Không kết nối được server";
  - Cách A (Wi-Fi `http://`) vẫn thêm được nhưng không lưu sẵn;
  - **app ở MH chính là người chơi riêng**, khác Safari (Thiết kế 7);
  - app luôn mở ở sảnh, muốn vào lại thế giới bạn bè thì mở lại link mời.
- `docs/deploy.md`, mục "Ghi chú":
  - service worker chỉ chạy qua HTTPS;
  - sau deploy, tab cũ dùng nốt bản cũ, tải lại là ra bản mới;
  - gỡ service worker khỏi máy người chơi khi cần: deploy một `sw.ts` chỉ xoá cache `petgame-*` rồi `self.registration.unregister()`;
  - **thêm CSP thì phải cho phép script canh tải inline bằng hash `sha256-…`**, kẻo nó mất tác dụng mà không báo.

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, server. Không đổi dữ liệu đã lưu (SQLite, `localStorage`, `sessionStorage`).
- Client: thêm Cache Storage `petgame-<phiên bản>` và một service worker scope `/` trên origin của game (chỉ bản build, chỉ ngữ cảnh an toàn).
- `dist/` thêm `sw.js`, `icons/`, `apple-touch-icon.png`. Dockerfile chép cả `dist/` nên không cần sửa.

## Test

**Unit, `packages/client/src/pwa/swLogic.test.ts`** (Node; `Request`/`Response` có sẵn trong Node 22). Origin dùng trong test: `http://localhost:2567`.

`routeFor`:
1. Điều hướng `GET` tới `/`, `/?room=abc&quality=low`, `/index.html`: network-first, khoá `"/"`.
2. `GET /build/index-Abc.js` với mode `cors`, `no-cors`: cache-first, khoá `/build/index-Abc.js`. Có `?v=1` thì khoá không có `?v=1`.
3. `GET /manifest.webmanifest`: network-first, khoá chính nó.
4. Bỏ qua:
   - `POST /matchmake/create/world`;
   - `GET /matchmake/abc` (kiểm luật đường dẫn, không chỉ luật method);
   - `GET /matchmake`;
   - `GET /whoami` với mode `cors` và `navigate`;
   - `GET /healthz`, `GET /sw.js`.
5. Bỏ qua tài nguyên tĩnh khác: `/assets/pals/emberpup.webp`, `/assets/pals/index.json`, `/icons/icon-192.png`, `/apple-touch-icon.png`, điều hướng tới `/sprites.html`.
6. Bỏ qua địa chỉ ngoài: `ws://localhost:2567/abc/def`, `wss://…`, `https://server.example/build/x.js` (server tách riêng), `HEAD /build/x.js`.
7. Luật đường dẫn không khớp nhầm: `/buildx/y.js` và `/build` (không gạch chéo) là bỏ qua, không phải cache-first.

Các hàm còn lại:

8. `precacheUrls` nhận `["index.html", "manifest.webmanifest", "sw.js", "build/index-A.js", "build\\b-B.js", "build/x.js.map", "assets/pals/index.json", "assets/pals/emberpup.webp", "icons/icon-192.png", "apple-touch-icon.png"]` và trả đúng `["/", "/build/b-B.js", "/build/index-A.js", "/manifest.webmanifest"]` (đã sắp xếp).
9. Nhất quán: mọi URL của `precacheUrls(...)` đi qua `routeFor` (mode `navigate` cho `/`, `cors` cho phần còn lại) đều **không** ra `bypass`.
10. `freshOnInstall`: true cho `/` và manifest, false cho `/build/…`.
11. `staleCaches(["petgame-a", "petgame-b", "other", "petgame-"], "petgame-b")` trả `["petgame-a", "petgame-"]`; không bao giờ có cache hiện tại hay cache tên khác.

Chiến lược, dùng fake `CacheLike` (một `Map`), fake `fetch` đếm số lần gọi, `defer` gom lời hứa rồi `await` hết trước khi kiểm cache:

12. `cacheFirst`:
    - trong cache có thì trả bản đó, `fetch` không bị gọi;
    - không có, mạng 200: gọi `fetch` đúng một lần, cất đúng khoá, thân câu trả lời đọc được ở cả hai bên (đã `clone`);
    - không có, mạng 404: trả 404, không cất;
    - không có, `fetch` ném: lời hứa bị từ chối với **đúng lỗi đó**, không cất, không trả gì khác.
13. `networkFirst`:
    - mạng 200: trả câu trả lời mạng, cất dưới khoá, kể cả khi cache đã có bản cũ (bản mới đè bản cũ);
    - mạng 503: trả 503, không cất, không đọc cache dù có;
    - `fetch` ném mà cache có khoá: trả bản cache;
    - `fetch` ném mà cache trống: ném lại đúng lỗi;
    - câu trả lời giả `{ status: 200, redirected: true, clone() }`: trả nó, không cất.

**Unit, `scripts/pwaManifest.test.mjs`** (Phần A): 4 ca ở A5.

**E2E, `tests/e2e/pwa.spec.ts`** (mới; chạy trong `npm run test:e2e` cùng `multiplayer.spec.ts`):

1. `pwa: the built game lists its icons, and a service worker caches the game shell but never the server's replies`. Trang `http://localhost:2567/?quality=low`, context `serviceWorkers: "allow"`.
   - (a) Icon:
     - đọc `href` của `link[rel=manifest]` rồi tải bằng `page.request.get` (ngoài service worker);
     - mỗi `icons[].src` trả 200, `content-type` `image/png`, cỡ IHDR đúng `sizes`;
     - có `any` 192, `any` 512, `maskable` 512;
     - `link[rel=apple-touch-icon]` trả PNG 180×180.
   - (b) Chờ `#join-btn:enabled`, rồi chờ `navigator.serviceWorker.controller !== null` (tối đa 60 s, vì `clients.claim`). `context.serviceWorkers()` có đúng một cái, URL kết thúc `/sw.js`.
   - (c) Trong trang:
     - `caches.keys()` lọc `petgame-` còn đúng một tên;
     - đường dẫn của mọi mục chứa `/`, `/manifest.webmanifest`, và mọi `/build/…` mà `index.html` trỏ tới (`script[type=module][src]`, `link[rel=modulepreload][href]`);
     - không mục nào bắt đầu `/assets/`, `/icons/`, `/matchmake`, `/whoami`, `/sw.js`, và không có `/apple-touch-icon.png`.
   - (d) `page.reload()`:
     - câu trả lời điều hướng có `fromServiceWorker() === true`;
     - câu trả lời của chunk vào (`script[type=module]`) có `fromServiceWorker() === true`;
     - `#join-btn:enabled` lại hiện.
   - (e) `fetch("/whoami")` trong trang trả 200; `page.waitForResponse` của nó có `fromServiceWorker() === false`; cache vẫn không có `/whoami`.
   - (f) Vào thế giới bằng helper (tên "Pwa"), chờ vào xong (thế giới đã vẽ, sảnh mất; `room.state.players.size > 0`), nghĩa là matchmake và WebSocket chạy bình thường khi service worker điều khiển trang. `navigator.serviceWorker.controller` vẫn khác null; cache vẫn không có mục nào bắt đầu `/matchmake`.
2. `pwa: Vite dev registers no service worker`. Trang `http://localhost:5173/?quality=low`, context `serviceWorkers: "allow"`:
   - ghi mọi request có đường dẫn `/sw.js`;
   - chờ `#join-btn:enabled` và `waitForLoadState("load")`;
   - `navigator.serviceWorker.getRegistrations()` dài 0, không có request `/sw.js`.

Không kiểm được bằng Playwright 1.56.1:
- **Mở khi mất mạng.** `context.setOffline` không áp cho mạng của service worker. Phần đó chỉ bật bằng cờ thử nghiệm `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` (`crServiceWorker.js`), không dùng.
- **Cập nhật sau deploy.** Phải đổi `dist` giữa chừng trên server dùng chung.

Hai phần này được unit test 12-13 và 11 lo; còn lại kiểm tay (dưới).

**E2E hiện có:** không sửa `multiplayer.spec.ts`. Phải qua nguyên như trước, khi:
- config có `serviceWorkers: "block"`;
- server phục vụ `dist/` (trước T13, khi chưa build thì không phục vụ).

**Kiểm tay** (agent chính thêm vào "Ghi chú chờ người chơi thử" của `TASKS.md`; theo `docs/choi-tren-iphone.md`):
1. **iPhone, Cách B (HTTPS):**
   - Thêm vào MH chính thì icon Emberpup, tên "PetGame"; mở toàn màn hình.
   - Bật chế độ máy bay rồi mở app: sảnh hiện, Vào chơi ra "Không kết nối được server". Tắt chế độ máy bay, Thử lại thì vào được.
   - Ghi lại thú ở Safari có theo sang app không (dự kiến không, xem T80).
2. **iPhone, Cách A (`http://192.168.…`):** thêm vào MH chính có icon, game chạy như trước.
3. **Android Chrome (HTTPS):** có "Cài đặt ứng dụng"; icon tròn không bị cắt mất tai hay chân.
4. **Desktop Chrome** (`npm run play`, `http://localhost:2567`), DevTools → Application:
   - Manifest không báo lỗi, thấy 4 icon;
   - Service workers: `sw.js` activated;
   - Cache storage: `petgame-<12 ký tự>` không có `/matchmake`, `/whoami`.

## Tiêu chí hoàn thành

Phần A:
- [ ] 5 PNG đúng cỡ, ở đúng đường dẫn. `apple-touch-icon.png` và 2 icon maskable không có pixel trong suốt. Script in bán kính xa nhất của thú trong icon maskable ≤ 0,40·S và ghi số đó vào `PROGRESS.md`.
- [ ] `python3 scripts/appIcons.py` chạy lại ra đúng các byte đã commit (`git status` sạch sau khi chạy).
- [ ] Manifest có `id`, `scope`, `lang`, `description` tiếng Việt, 4 icon. `index.html` có 3 thẻ mới; khối script canh tải inline không đổi một byte (`git diff` chỉ có 3 dòng trong `<head>`).
- [ ] `scripts/pwaManifest.test.mjs` qua. `assets/CREDITS.md` và `docs/art-style.md` có mục icon.

Phần B:
- [ ] `npm run build` tạo `dist/sw.js` (IIFE, không có `import`, không có `export`) chứa phiên bản 12 ký tự và danh sách lưu sẵn. Danh sách gồm `/`, `/manifest.webmanifest` và mọi file `dist/build/*`, không gồm `/assets`, `/icons`, `/sw.js`. Build hai lần liền ra cùng phiên bản.
- [ ] `routeFor` đúng bảng Thiết kế 3. Không request nào tới `/matchmake*`, `/whoami`, `/healthz`, `/sw.js`, khác origin hay khác `GET` được `respondWith`.
- [ ] Không có `skipWaiting`, không có `controllerchange`, không tự `location.reload()` nào mới. Không thêm CSP ở đâu cả (`grep -ri "content-security-policy"` không thấy dòng mới).
- [ ] `registerServiceWorker` chỉ chạy khi `import.meta.env.PROD`, có `"serviceWorker" in navigator` và `try/catch`, gọi sau khi sảnh sẵn sàng, đăng ký lúc `load`.
- [ ] Cache-first và network-first không bao giờ thay câu trả lời hỏng bằng nội dung khác. Chỉ network-first lùi về cache, và chỉ khi `fetch` ném lỗi (unit test 12-13 chứng minh).
- [ ] `activate` chỉ xoá cache `petgame-*` cũ, rồi `clients.claim()`.
- [ ] `playwright.config.ts`: `serviceWorkers: "block"`; server e2e bật sau `npm run build`, có `timeout: 180_000`. `scripts/shots.mjs` chặn service worker ở cả 4 context.
- [ ] `npm run typecheck` sạch; `npm test` qua (gồm `swLogic.test.ts`, `pwaManifest.test.mjs`, `viStrings.test.mjs` có thêm `pwa/`); `npm run build` qua; `npm run test:e2e` qua toàn bộ, gồm 2 test `pwa:` và mọi test cũ không sửa.
- [ ] `tests/e2e/multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts` không đổi; không dùng `git stash`.
- [ ] Tài liệu cập nhật đủ B11; `docs/design/multiplayer.md` (designer đã sửa) khớp với code.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **API build lần hai của Vite 8.3 (rolldown).** `build.lib` + `iife` có thể đặt tên file khác hoặc tách chunk. Đã có đường lùi: dùng thẳng `rolldown` (B5). Tester kiểm `dist/sw.js` là một file, không có `import`.
2. **Service worker cũ kẹt trên máy người chơi.**
   - Trang luôn lấy từ mạng trước nên nội dung game không bao giờ cũ khi có mạng;
   - logic service worker cập nhật khi mọi tab cũ đóng;
   - cách gỡ khẩn cấp ghi trong `docs/deploy.md`.

   Lỗi nặng nhất có thể là `routeFor` bắt nhầm request của server. Unit test 4, 6, 7 và e2e (e), (f) canh việc đó.
3. **`serviceWorkers: "block"` có áp cho `browser.newContext()` tự tạo trong spec không.** Playwright áp tuỳ chọn `use` cho context tự tạo (như `baseURL` mà spec hiện có đang dựa vào). Nếu không áp thì hiện cũng vô hại, vì Vite dev không đăng ký. Tester xác nhận bằng một lần đọc `navigator.serviceWorker.controller` trong một test cũ, nếu cần.
4. **Build trong `webServer` làm e2e chậm thêm** thời gian một lần `npm run build`. Tester ghi số giây vào `PROGRESS.md`. Build hỏng thì e2e hỏng ngay, đúng ý (trước đây CI e2e không build). Đây cũng là một nửa việc của T16.
5. **Không kiểm e2e được việc mở khi mất mạng** (Playwright không áp offline cho service worker): unit test và kiểm tay thay thế.
6. **iPhone: bộ nhớ riêng của app ở Màn hình chính.** Tài liệu ghi theo hành vi đã biết của iOS; cần xác nhận trên máy thật (kiểm tay 1). Nếu sai (thú có theo sang) thì bỏ câu đó trong `docs/choi-tren-iphone.md`, `docs/design/multiplayer.md` và bỏ T80.
7. **`orientation: "landscape"`** khoá app Android nằm ngang, dù game đã hỗ trợ điện thoại dọc (T6, T61, T62). Giữ nguyên vì không thuộc T13; nếu người dùng muốn dọc thì đổi thành `"any"` (một dòng).
8. **Xung đột với stash T63:** chỉ ở `PROGRESS.md`, `REVIEW.md` (file làm việc, ghi đè mỗi nhiệm vụ). Khi người dùng trả lời Q1 và mở lại stash, agent chính giữ bản của stash cho hai file đó.

## Đề xuất cho TASKS.md

- Tách **T13** (đợt 1, Phần A, asset-manager) và **T13b** (đợt 2, Phần B, coder), chung `PLAN.md` này.
- **T79 (P2). Gợi ý quay lại thế giới cùng bạn bè khi mở app từ Màn hình chính.** Sau T13: app luôn mở `/` (`start_url`). Hướng làm:
  - thêm giờ thấy lần cuối vào `RecentWorld` (`ui/joinStatus.ts`; mục cũ không có giờ thì coi như cũ);
  - ghi giờ khi rời trang (`pagehide`);
  - mở ở `/` mà thế giới mới nhất có bạn bè và vừa thấy trong vòng vài phút thì sảnh có nút phụ "Quay lại thế giới cùng bạn bè" (đặt `?room=` rồi vào; thế giới đã đóng thì thẻ "đã đóng" như T23);
  - luật ở `docs/design/multiplayer.md` mục "Tải lại trang".
- **T80 (P2). iPhone: app ở Màn hình chính là người chơi mới.** Sau T13, kiểm trên máy thật trước. Hướng làm:
  - ghi thêm token thiết bị vào một cookie cùng origin (`Secure`, `SameSite=Lax`, hạn dài); khi `localStorage` không có token mà cookie có thì dùng lại. iOS 17 trở lên chép cookie sang app lúc Thêm vào MH chính;
  - nếu không đủ thì làm "mã chuyển máy" (cân nhắc an toàn: token là tài khoản).
- **Ghi chú thêm vào T52:** "Sau T13: service worker không tự tải lại và không `skipWaiting`; trang luôn lấy từ mạng trước, chunk thiếu vẫn hỏng thành `vite:preloadError`. T52 không cần đụng service worker."
- **Ghi chú thêm vào T16:** "Sau T13: server e2e đã bật sau `npm run build` và mọi context đã `serviceWorkers: "block"`; còn đổi `baseURL` sang 2567 và `LOBBY_SCRIPT`. Gom helper chép trong `tests/e2e/pwa.spec.ts` vào một module chung khi T63 xong."
- **"Ghi chú chờ người chơi thử":** thêm 4 bước kiểm tay ở mục Test (iPhone HTTPS và Wi-Fi, Android, desktop).
