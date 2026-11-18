# PROGRESS: T82 Service worker: Cache Storage lỗi không chặn game mở

## Vòng 1: coder
- [x] Bước 1: `swLogic.ts`: `StrategyDeps.openCache`, `lookup` (lỗi cache = miss), `storeLater` (ghi nền, clone đồng bộ, không bao giờ từ chối), `cacheFirst`/`networkFirst` dùng chúng; lỗi mạng vẫn ném đúng lỗi mạng.
- [x] Bước 2: `swLogic.ts`: `precacheAll` (tải hết, chỉ `put` khi mọi câu trả lời 200 và không chuyển hướng).
- [x] Bước 3: `swLogic.ts`: `SwVersionInputs`, `swVersion` (Web Crypto). Rolldown loại khỏi `sw.js`, không cần tách file.
- [x] Bước 4: `sw.ts`: `openCache`, install qua `precacheAll`, `respondWith` không còn bọc `caches.open().then`; bỏ import `freshOnInstall`.
- [x] Bước 5: `vite.config.ts`: cờ `failed` (`buildStart`/`buildEnd`/`renderError`), `closeBundle(error)` thoát sớm; phiên bản bằng `swVersion` (index.html, manifest, `sw.ts`, `swLogic.ts`, precache); bỏ `node:crypto`; sửa JSDoc.
- [x] Bước 6: `register.ts`: `try/catch` bọc cả callback `load`; thêm `register.test.ts` (4 ca).
- [x] Bước 7: `tests/e2e/pwa.spec.ts`: import `type Browser`.
- [x] Bước 8: `docs/deploy.md`, `docs/choi-tren-iphone.md`, `docs/architecture.md` theo đúng chữ trong kế hoạch.
- [x] Test: `swLogic.test.ts` (helper `fakes` có `broken`, nhóm "a broken Cache Storage never blocks the network", `precacheAll`, `swVersion`, ca "does not store a redirected answer" cho `cacheFirst`); test cũ giữ nguyên nghĩa.
- Chứng minh test bắt lỗi code cũ (không dùng git stash): đặt tạm `register.ts` cũ từ `git show c97a472:...` thì ca "never throws, not even inside the load callback" FAIL (3 ca khác qua), rồi khôi phục bản mới. Với cache hỏng: `swLogic.ts` cũ (xuất ra file tạm, đã xoá) có `match` bị từ chối thì `cacheFirst` ném `Error: x` thay vì trả câu trả lời mạng. Các ca mới trong `swLogic.test.ts` dùng API `openCache` nên không chạy trực tiếp được trên code cũ; ca tương đương được thử bằng file tạm.
- Lệch kế hoạch: không có. (`vi.stubEnv("PROD", true)` hoạt động, không cần tách `registerWhenLoaded`.)
- Kết quả kiểm tra:
  - build hai lần: cùng `service worker dabb78817fd3: 15 files precached` (N = 15 như `c97a472`).
  - `dist/sw.js`: 2480 byte (trước T82: 2087), không có `subtle`, có `redirected`, không có `import`/`export`.
  - `git stash list`: vẫn 2 mục. Không đụng `multiplayer.spec.ts`, `labelLayout.ts`. Không commit.
- Lệnh đã chạy: typecheck ✓, test ✓ (583 test), build ✓ (x2), test:e2e đầy đủ ✓ (58 test), `pwa.spec.ts` ×3 ✓ (6 lượt).
- Chưa kiểm tay tiêu chí 8 (build lỗi in lỗi gốc, không phải ENOENT): để tester/reviewer.

## Kiểm thử vòng 1 (T82): PASS
- typecheck ✓   test ✓ (40 file, 583 test)   build ✓ (hai lần liền cùng `service worker dabb78817fd3: 15 files precached`; `dist/sw.js` hai lần giống hệt từng byte, không có `subtle`)   e2e ✓ (58)   `pwa.spec.ts` x3 ✓ (6/6)   photo3d (không chạy)
- Tiêu chí hoàn thành:
  - [x] Tiêu chí 8 (coder chưa kiểm): thêm `const = ;` vào cuối `packages/client/src/main.ts`, `npm run build` -> exit 1, in lỗi gốc `[builtin:vite-transform] Unexpected token ... src/main.ts:288:7`, KHÔNG có `ENOENT` nào. Đã hoàn nguyên, `git diff packages/client/src/main.ts` rỗng, build lại ra cùng phiên bản `dabb78817fd3`.
  - [x] Kiểm tay trên bản build (server kiểu `npm run play`, `serviceWorkers: "allow"`): trang được worker điều khiển; rồi làm hỏng Cache Storage ngay trong worker (qua `sw.evaluate`, gán `self.caches.open/match/keys` thành Promise.reject, xác nhận `caches.open` bị từ chối `UnknownError`). Tải lại: HTML 200 và script `/build/index-*.js` 200 đều đi qua worker (fromServiceWorker = true), không có lỗi trang, sảnh sẵn sàng, rồi vào được thế giới. Tức Cache Storage hỏng không chặn game. (Gây lỗi từ ngữ cảnh trang không có tác dụng với worker vì `caches` của worker là đối tượng riêng; nên làm bên trong worker.)
  - [x] Đột biến (đã hoàn nguyên, `diff` rỗng), mỗi cái bị bắt:
    a) `lookup` ném lại lỗi cache -> 7 ca đỏ ("cacheFirst answers from the network when the cache is broken at open/openThrows/match", "both strategies throw the network error, not the cache error ...", ...).
    b) `precacheAll` nhận câu trả lời chuyển hướng -> "rejects and stores nothing when the page is a redirected answer".
    c) lỗi mạng bị thay bằng lỗi cache khi cả hai hỏng -> 3 ca "both strategies throw the network error, not the cache error".
    d) `swVersion` bỏ qua manifest -> "changes when any single input changes".
  - [x] `multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts` không đổi (không có trong `git status`, `git diff c97a472` rỗng).
- Không thêm test mới (bộ test của coder đã bắt cả 4 đột biến). Không có lỗi.
