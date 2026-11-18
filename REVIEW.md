PASS
# REVIEW: T82 Service worker không chặn game khi Cache Storage lỗi, vòng 1

## Kết luận
Coder làm đủ 8 bước của PLAN.md và đạt cả 13 tiêu chí, gồm cả 7 góp ý của reviewer T13b. Lỗi của Cache Storage giờ chỉ làm worker lấy từ mạng; lỗi mạng vẫn ném ra đúng như trước, nên bộ canh tải T15 và `vite:preloadError` không đổi. Không có lỗi phải sửa.

## Đã kiểm
- **Xử lý lỗi** (`packages/client/src/pwa/swLogic.ts`):
  - `lookup`: `deps.openCache()` nằm trong `try`, nên cả lỗi ném đồng bộ (`caches` báo `SecurityError`) cũng bị bắt và tính là "không có". Hàm chỉ nuốt lỗi **bộ nhớ**; `deps.fetch` gọi ở ngoài `try`, nên lỗi mạng vẫn ra ngoài. Test kiểm điều này bằng `rejects.toBe(offline)`, tức đúng đối tượng lỗi mạng, cho cả hai chiến lược với 3 kiểu hỏng.
  - `storeLater`:
    - `clone()` gọi đồng bộ trước khi trả câu trả lời. Phần ghi nằm trong một hàm `async` tự gọi, có `.catch(() => {})`, nên `put` ném đồng bộ cũng thành lời hứa bị từ chối rồi bị nuốt. Lời hứa đưa cho `waitUntil` không bao giờ bị từ chối, và không có rejection nào không được xử lý.
    - `defer`, tức `event.waitUntil`, được gọi trước khi chiến lược trả về, lúc lời hứa của `respondWith` còn chờ, nên hợp lệ.
    - Test bắt được cả khi bỏ `.catch`: `settle()` sẽ bị từ chối.
  - `respondWith` trong `sw.ts` giờ chỉ nhận lời hứa của chiến lược, và lời hứa này chỉ bị từ chối khi `fetch` ném. Không còn `caches.open(...).then` bọc ngoài.
  - `activate` không đổi, đúng phạm vi. Nếu `caches.keys()` hỏng ở đó thì trình duyệt vẫn kích hoạt worker, mà install với cùng bộ nhớ đó đã hỏng từ trước.
- **`precacheAll`:**
  - Tải song song. Câu trả lời khác 200 hoặc `redirected` thì ném và chưa `put` gì; `fetch` ném thì ném lại đúng lỗi. Nghiêm hơn `addAll` (nhận mọi 2xx) và vẫn giữ "tất cả hoặc hỏng".
  - `Promise.all` gắn handler cho mọi lời hứa con, nên lỗi thứ hai không thành rejection không được xử lý.
  - Lỗi bộ nhớ ở bước install không bị nuốt, nên install hỏng. Đúng thiết kế: một worker không có cache thì vô dụng.
  - Khoá là đường dẫn tương đối, trùng khoá `routeFor` dùng. `/` và manifest tải với `cache: "reload"` (có test).
  - `put` hỏng giữa chừng có thể để lại vài mục trong cache; PLAN đã ghi giới hạn này.
- **Phiên bản (`swVersion`):**
  - Băm `JSON.stringify` của `index.html`, manifest, nguồn `sw.ts` + `swLogic.ts` và danh sách lưu sẵn. Có test ranh giới `"ab"+"c"` khác `"a"+"bc"`.
  - Web Crypto có sẵn trên Node v22.23.4 của máy này (`crypto.subtle.digest` là function).
  - `dist/sw.js` 2480 byte: không chứa `subtle` hay `addAll`, có `redirected`.
  - `vite.config.ts` truyền đúng 4 nguồn.
- **Lần deploy đầu sau T82:** worker T13b có `sw.js` khác byte, nên trình duyệt cài worker mới vào `petgame-<phiên bản mới>`. Worker mới chờ tới khi tab cũ đóng, rồi `activate` xoá `petgame-64daf4b17bef` qua `staleCaches`. Đây là đường cập nhật bình thường, không đụng `localStorage` hay SQLite. Trong lúc chờ, worker cũ vẫn chạy code cũ; đây là rủi ro sẵn có, không tệ hơn.
- **`closeBundle`:**
  - Thoát sớm khi có tham số `error` hoặc cờ `failed` (từ `buildEnd(err)` hoặc `renderError`).
  - `buildStart` đặt lại cờ. Không dùng `existsSync`.
  - Tôi kiểm trong khai báo của rolldown (`define-config-*.d.mts`): `buildEnd(err?)`, `renderError(error)` và `closeBundle(error?)` đều có thật.
- **`register.ts`:** mọi lần đọc `navigator.serviceWorker` đều nằm trong `try`, kể cả trong callback `load`. Ca getter ném trong listener của `register.test.ts` hỏng với code cũ. Ca `PROD=false` chứng minh getter không bị đọc.
- **Test:** tôi chạy lại `packages/client/src/pwa`: 52 ca qua, `npm run typecheck` sạch. Không test cũ nào bị xoá hay nới; helper `fakes` chỉ đổi cách dựng deps.
- **Phạm vi:** `multiplayer.spec.ts` và `labelLayout.ts` không đổi; `git stash list` vẫn 2 mục. `pwa.spec.ts` chỉ đổi import kiểu.
- **Tài liệu:**
  - `deploy.md`: cách gỡ khẩn cấp có `skipWaiting()` và không có listener `fetch`. Đúng: sau `skipWaiting`, worker gỡ điều khiển các tab ngay, và vì không có `fetch` nên mọi request đi mạng.
  - `choi-tren-iphone.md` có câu "sau lần đầu mở app có mạng".
  - `multiplayer.md` dòng 19 và `architecture.md` khớp code.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc
- **Lỗi bị nuốt không để lại dấu vết:**
  - Cái giá của `lookup` và `storeLater`: nếu sau này nối dây sai (ví dụ `openCache` mở nhầm tên cache), worker lặng lẽ thành "chỉ đi mạng". Không test nào bắt, vì e2e (d) chỉ kiểm `fromServiceWorker()`, và câu trả lời mạng đi qua worker cũng ra `true`.
  - Đề xuất 1: thêm `console.warn` trong hai nhánh `catch` (chỉ hiện ở console của worker, không đổi hành vi).
  - Đề xuất 2: thêm một kiểm tra e2e rằng chunk vào được lấy **từ cache** khi tải lại. Ví dụ: ghi đè mục cache của chunk vào bằng nội dung gốc có chèn thêm `window.__fromCache = 1;`, tải lại, rồi đọc cờ đó.
- `docs/architecture.md`, dòng định tuyến của mục PWA: câu T82 chen giữa "không bao giờ thay câu trả lời 404/502" và "mọi thứ khác bị bỏ qua (...)". Vì vậy "mọi thứ khác" đọc như nói về Cache Storage. Nên tách câu T82 thành một gạch riêng, hoặc đưa xuống cuối dòng.
- `swLogic.test.ts`:
  - `it.each` đầu tiên của nhóm "a broken Cache Storage" viết lại mảng literal thay vì dùng hằng `all` khai báo ngay trên; nên dùng `all`.
  - Các ca `put`/`putThrows` nên thêm `expect(f.state.puts).toBe(1)`, để chắc nhánh ghi thật sự đã chạy chứ không chỉ "không lỗi".
- `swVersion` băm nguồn dạng văn bản, nên một checkout CRLF (Windows) ra phiên bản khác bản build trên Linux. Vô hại, vì deploy build trong Docker; chỉ ghi lại để không ai ngạc nhiên.
