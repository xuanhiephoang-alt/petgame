PASS
# REVIEW: T13b Service worker (PWA, Phần B), vòng 1

## Kết luận
Đợt này làm đủ B1-B11 và khớp Thiết kế 3-7. Bảng định tuyến chặt theo kiểu "mặc định bỏ qua": chỉ `/build/*`, điều hướng tới `/` và `/index.html`, và manifest được trả lời. Không có `skipWaiting`, không tự tải lại. Hành vi của bộ canh tải T15 và `vite:preloadError` vẫn như trước, vì câu trả lời hỏng không bao giờ bị thay. Không có lỗi phải sửa; còn vài chỗ nên làm cứng thêm (dưới).

## Đã kiểm
- **Bảo mật, riêng tư, scope:**
  - `sw.js` ở gốc nên scope là `/`. `routeFor` bỏ qua mọi request khác `GET`, khác origin (kể cả `ws:`/`wss:`), `/matchmake*`, `/whoami`, `/healthz`, `/sw.js`, và mọi đường dẫn không có trong bảng.
  - Thứ được lưu chỉ gồm `index.html` tĩnh (khoá `"/"`, mọi `?room=` dùng chung), manifest, và file `/build/*` có hash. Không có gì riêng của người chơi; server không đặt cookie trên các đường này.
  - Test (c), (e), (f) trong `tests/e2e/pwa.spec.ts` kiểm cache thật trên bản build.
- **`sw.js` hỏng hoặc 404 sau rollback:** `index.ts` phục vụ `sw.js` bằng `express.static` với `max-age=0`, không có route bắt-tất-cả.
  - `sw.js` 404 hoặc sai MIME thì lần cập nhật hỏng. Worker đang chạy giữ nguyên, nhưng nó vẫn lấy trang từ mạng trước và lấy từ mạng chunk nào chưa có. Người chơi luôn nhận bản đang deploy, không bị kẹt.
  - Lần cài lỗi (một file 404 giữa lúc deploy) chỉ làm `addAll` hỏng; trình duyệt thử lại lần sau.
- **Vòng đời cập nhật:**
  - `install` lưu sẵn với `cache: "reload"` cho `/` và manifest. `activate` chỉ xoá `petgame-*` khác cache hiện tại, rồi `clients.claim()`.
  - Tab cũ trong lúc deploy:
    - chunk tải lười đã được lưu sẵn, nên không còn `vite:preloadError` cho phần đó;
    - Tải lại dưới worker cũ vẫn ra HTML mới (mạng trước), chunk mới thì lấy từ mạng rồi cất vào cache cũ;
    - cache cũ bị xoá khi worker mới kích hoạt.
  - Hai lần deploy liền nhau: worker đang chờ bị thay, và `staleCaches` dọn cache của nó khi bản mới nhất kích hoạt.
  - Đúng phần "Phối hợp với T52": T52 chỉ cần `vite:preloadError`, mà sự kiện này vẫn xảy ra khi chunk thật sự thiếu (404 trả nguyên, mất mạng thì ném lại đúng lỗi). Unit test có ca cache có file khác mà 404 vẫn trả nguyên; tester đã thử đột biến c1, c2.
- **Bộ canh tải T15:** chỗ đăng ký chạy sau `LOBBY_READY_EVENT`, lúc bộ canh tải đã gỡ listener. Chunk thiếu vẫn ra `error` trên thẻ `<script>`; tester kiểm tay 3b, 3c.
- **Plugin Vite** (`packages/client/vite.config.ts`):
  - `apply: "build"`. Lần build thứ hai dùng `configFile: false` nên không gọi lại chính plugin.
  - `dist/sw.js` 2087 byte, dạng IIFE, không có `import`/`export`.
  - Tôi tính lại phiên bản bằng tay từ `dist/index.html` cộng danh sách: ra `64daf4b17bef`, khớp `sw.js`.
  - Danh sách lưu sẵn có 15 mục: `/`, manifest, 13 file `/build/*`. Bao trọn mọi `script`/`modulepreload` của `index.html`, cộng 3 chunk tải lười của PixiJS. Không có `/assets`, `/icons`, `/sw.js`.
- **Thời điểm đăng ký:**
  - chỉ khi `import.meta.env.PROD` và có `"serviceWorker" in navigator`;
  - gọi sau khi sảnh sẵn sàng;
  - đăng ký lúc `load`, hoặc ngay nếu trang đã `complete`.
  - Vite dev không đăng ký (e2e thứ 2). Sảnh không bị làm chậm.
- **Playwright và shots:**
  - `serviceWorkers: "block"` trong `use`.
  - `webServer` 2567 build trước rồi mới bật, kèm `timeout: 180_000`. Đây là hạn khởi động `webServer`, không phải hạn mỗi test; hạn mỗi test đã 180 s từ trước.
  - Không nới gì; `multiplayer.spec.ts` không đổi.
  - `shots.mjs` chạy trên server bản build (`http://localhost:${port}`), nên `NO_SW` ở cả 4 context là cần thiết.
- **Test và typecheck:** tôi chạy lại `swLogic.test.ts` và `viStrings.test.mjs`, 31 ca qua; `npm run typecheck` sạch. Test chiến lược kiểm đúng hành vi: số lần `fetch`, không đọc cache khi 503/404, ném lại đúng lỗi, không cất câu trả lời `redirected`.
- **Tài liệu:**
  - `docs/architecture.md`: mục PWA riêng (lệch nhỏ đã ghi trong PROGRESS, hợp lý) và mục Kiểm thử.
  - `docs/deploy.md`: HTTPS, tab cũ, cách gỡ, CSP.
  - `docs/choi-tren-iphone.md`: Cách A/B, app là người chơi riêng, luôn mở ở sảnh.
  - Tất cả khớp code và `docs/design/multiplayer.md` dòng 15, 19, 103-104. Chữ "Không kết nối được server" và "Thử lại" có thật trong `ui/strings.ts`.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc
- `packages/client/src/pwa/sw.ts:47-49`: nếu `caches.open` hoặc `cache.match` bị từ chối (Cache Storage hỏng, hiếm gặp), lời hứa của `respondWith` bị từ chối. Khi đó trang hay chunk hỏng **dù có mạng**. Đây là đường duy nhất worker này có thể làm game không mở được. Nên bọc thêm: lỗi của Cache Storage thì lùi về `fetch(request)`. Phải giữ nguyên luật "lỗi mạng thì ném lại", và có một unit test với `CacheLike` ném lỗi.
- `packages/client/src/pwa/register.ts:13-17`: `try/catch` chỉ bọc lúc gắn listener `load`. Nếu `navigator.serviceWorker` ném `SecurityError` ngay khi được đọc (một số cấu hình Firefox chặn bộ nhớ), lỗi đó nổ trong listener và thành lỗi chưa bắt.
  - Vô hại: bộ canh tải T15 đã gỡ listener, game vẫn chạy.
  - Nhưng trái với JSDoc "never throws". Nên chuyển `try/catch` vào trong `register`.
- `docs/deploy.md`, gạch "Gỡ service worker": vì không có `skipWaiting`, một `sw.ts` chỉ dọn cache rồi `unregister()` sẽ chờ tới khi mọi tab cũ đóng mới chạy. Nên ghi rõ bản gỡ khẩn cấp gọi `self.skipWaiting()` trong `install`, rồi dọn cache và `unregister()` trong `activate`.
- `docs/choi-tren-iphone.md`, Cách B: nên thêm "sau lần mở app đầu tiên có mạng". App ở MH chính có bộ nhớ riêng, nên bản lưu của Safari không theo sang; lần đầu mở app phải có mạng.
- `vite.config.ts`, `closeBundle`: nếu build chính lỗi mà hook này vẫn được gọi, `readFileSync(index.html)` ném `ENOENT` và có thể che lỗi gốc. Nên kiểm `existsSync` rồi `return`.
- Phiên bản chỉ băm `index.html` và tên file lưu sẵn. Đổi riêng manifest hay riêng logic `sw.ts` thì tên cache giữ nguyên.
  - Vô hại: manifest đi mạng trước, và `sw.js` vẫn đổi byte nên trình duyệt vẫn cập nhật.
  - Nếu muốn chặt: băm thêm nội dung manifest.
- `install` dùng `addAll`: không kiểm `redirected` như đường mạng trước. Server hiện không chuyển hướng `/`. Nếu sau này có proxy chuyển hướng `/`, bản lưu sẵn có thể bị Safari từ chối khi mở lúc mất mạng.
- `tests/e2e/pwa.spec.ts:13`: dùng `import("@playwright/test").Browser` ngay trong chú thích kiểu; đổi thành import `type Browser` ở dòng 1 cho gọn.
