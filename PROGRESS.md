# PROGRESS: T13b Service worker (PWA, Phần B)

## Vòng 1 (Phần B): coder

Không commit, không dùng `git stash`. `multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts` không đụng tới.

- [x] B1. `packages/client/src/pwa/swLogic.ts`: `routeFor`, `precacheUrls`, `freshOnInstall`, `staleCaches`, `cacheFirst`, `networkFirst`, `cacheName`, `CACHE_PREFIX`, `NEVER_HANDLED`. Hàm thuần, không import gì của game.
- [x] B2. `packages/client/src/pwa/sw.ts`: nối dây `install` / `activate` / `fetch`, không `skipWaiting`, không `message`.
- [x] B3. `packages/client/src/pwa/register.ts`: `registerServiceWorker` (PROD, `"serviceWorker" in navigator`, `try/catch`, đăng ký lúc `load`).
- [x] B4. `packages/client/src/main.ts`: import và gọi sau `LOBBY_READY_EVENT`.
- [x] B5. `packages/client/vite.config.ts`: plugin `petgame-service-worker`. `build.lib` dạng `iife` của Vite 8 chạy được ngay, ra đúng một file `dist/sw.js` (không `import`, không `skipWaiting`), nên không cần lùi về `rolldown` trực tiếp. Phiên bản `64daf4b17bef`, 15 file lưu sẵn; build ba lần liền cùng phiên bản.
- [x] B6. `packages/client/src/pwa/swLogic.test.ts`: các ca 1-13 của mục Test.
- [x] B7. `scripts/viStrings.test.mjs`: thêm `packages/client/src/pwa` vào `GUARDED`.
- [x] B8. `playwright.config.ts`: `serviceWorkers: "block"`; server 2567 chạy `npm run build && npm run start ...`, `timeout: 180_000`.
- [x] B9. `tests/e2e/pwa.spec.ts`: 2 test (bản build trên 2567 với icon, worker, cache, reload, `/whoami`, vào thế giới; Vite dev không đăng ký).
- [x] B10. `scripts/shots.mjs`: hằng `NO_SW` trải vào cả 4 `browser.newContext`.
- [x] B11. Tài liệu: `docs/architecture.md` (mục "PWA (T13)" mới và mục Kiểm thử), `docs/choi-tren-iphone.md`, `docs/deploy.md`.

### Lệch kế hoạch

- `docs/architecture.md`: kế hoạch nói "bullet mới trong mục `packages/client`"; tôi tạo mục `## PWA (T13)` riêng ngay trước "Hình ảnh và asset", vì mục `packages/client` gồm toàn dòng rất dài và khó đọc thêm. Nội dung đúng như kế hoạch.
- `NO_SW` đặt ở đầu `scripts/shots.mjs` (sau import) chứ không cạnh `LABEL_VIEWS`, vì các hàm ở dòng 92 và 127 dùng nó và `const` ở giữa file có thể chưa khởi tạo.
- Không có lệch nào khác.

### Lệnh đã chạy

- `npm run typecheck` ✓
- `npm test` ✓ (39 file, 551 test; gồm `swLogic.test.ts`, `pwaManifest.test.mjs`, `viStrings.test.mjs`)
- `npm run build` ✓ (ra `dist/sw.js`; "service worker 64daf4b17bef: 15 files precached")
- `npx playwright test tests/e2e/pwa.spec.ts --repeat-each=5 --workers=1 --retries=0` ✓ (10/10, 26.9 s)
- `npm run test:e2e` ✓ (58 test qua, gồm 2 test `pwa:`; 8 phút 50 giây gồm bước build thêm vào server)

## Kiểm thử vòng 1 (T13b): PASS
- typecheck ✓   test ✓ (39 file, 551 test; sau khi thêm 4 ca vào `swLogic.test.ts` là 24 ca trong thư mục pwa, tất cả qua)   build ✓ ("service worker 64daf4b17bef: 15 files precached")   e2e ✓ (58, gồm 2 test `pwa:`)   `pwa.spec.ts` x5 (`--repeat-each=5 --workers=1 --retries=0`) ✓ 10/10   photo3d (không chạy)
- Tiêu chí hoàn thành:
  - [x] `dist/sw.js` (2087 byte) là IIFE, không có `import`/`export`, không `skipWaiting`, không `controllerchange`.
  - [x] `playwright.config.ts` `timeout: 180_000`: KHÔNG nới. Ở 261f7e9 timeout mỗi test đã là `180_000` (dòng 7). Diff chỉ thêm `timeout: 180_000` cho `webServer` 2567 (do thêm bước `npm run build &&`), cùng `serviceWorkers: "block"` và lệnh `npm run build && npm run start ...`.
  - [x] Định tuyến khớp PLAN, từng ca có unit test: non-GET, khác origin (ws/wss), `/matchmake`, `/whoami` (cả điều hướng), `/healthz`, `/sw.js`, `/assets`, `/icons`, điều hướng tới `/sprites.html` đều bypass; `/build/*` cache-first khoá bỏ query; `/` và `/index.html` (navigate) network-first khoá `/`; manifest network-first.
  - [x] Kiểm tay trên bản build (Playwright, `serviceWorkers: "allow"`):
    1. Trang được worker điều khiển ngay lần mở đầu; cache `petgame-64daf4b17bef` có 15 mục: `/`, `/manifest.webmanifest`, 13 file `/build/*`; không có `/assets`, `/icons`, `/whoami`, `/matchmake`.
    2. Giả lập deploy (thêm dấu vào `dist/index.html`), tải lại -> HTML mới có dấu; bản cất `/` cũng cập nhật (network-first đúng).
    3a. Xoá chunk vào của `dist/build` trên đĩa, tab đã có cache, tải lại -> sảnh vẫn chạy vì chunk lấy từ cache. Khớp ý định PLAN: file có hash bất biến và đã lưu sẵn cùng HTML cũ; sau deploy thật HTML mới trỏ tới hash mới nên không bị che.
    3b. Context mới (không cache), chunk 404 -> thẻ "Không tải được game" của T15 hiện, nút vào game vẫn khoá.
    3c. Tab đã có worker cũ, HTML mới trỏ tới chunk hash mới không tồn tại -> thẻ "Không tải được game" vẫn hiện (404 không bị thay bằng bản cache).
    4. Tắt mạng rồi mở lại: sảnh vẫn có `#join-btn` (lùi về HTML đã lưu).
  - [x] Đột biến (đã hoàn nguyên, `diff` với bản gốc rỗng), mỗi cái bị đúng một test bắt:
    a) `/whoami` được cache-first/network-first -> "bypasses everything the server answers".
    b) điều hướng thành cache-first -> "answers navigations to the lobby network-first under one key".
    c1) `cacheFirst` thay 404 bằng bản cache -> ca mới "passes a 404 on even when other files are stored". Trước khi tôi thêm ca này, đột biến này KHÔNG bị bắt (ca cũ dùng cache rỗng).
    c2) `networkFirst` thay 404 bằng bản cache -> ca mới "returns a 404 as it is, without storing it or reading the cache" (ca cũ chỉ thử 503).
  - [x] Vite dev không đăng ký worker: test e2e `pwa: Vite dev registers no service worker` qua 5/5 (không có request `/sw.js`, `getRegistrations()` rỗng).
- Test đã thêm trong `packages/client/src/pwa/swLogic.test.ts` (4 ca): cacheFirst 404 khi cache có file khác; cacheFirst rethrow khi mất mạng dù cache có file khác; networkFirst 404 trả nguyên không đọc cache; `/` không phải navigate (hoặc POST) thì bypass.
- Lưu ý: `dist/` đã build lại sau khi kiểm tay (nội dung như ban đầu); server 2567 đã tắt.
