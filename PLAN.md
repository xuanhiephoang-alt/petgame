# PLAN: T82 Service worker: không bao giờ chặn game mở khi Cache Storage lỗi

Code đọc ở `c97a472` ("Mark T13b done, add T82, start T82"). Nguồn: góp ý không bắt buộc trong `REVIEW.md` của commit T13b (`git show 06a92a8:REVIEW.md`) và thiết kế service worker trong `PLAN.md` của T13 (`git show 363dc31:PLAN.md`, mục "Thiết kế" 3-7). Số dòng có thể trôi: tìm theo chữ hoặc tên hàm.

## Mục tiêu

- Người chơi có mạng thì **luôn** mở được game, kể cả khi Cache Storage của trình duyệt hỏng (bộ nhớ hỏng, hết chỗ, trình duyệt chặn bộ nhớ). Hiện `sw.ts` dòng 47-49 gọi `caches.open(CACHE).then(...)` ngay trong `respondWith`. Nếu `caches.open` hoặc `cache.match` bị từ chối thì `respondWith` nhận lời hứa bị từ chối, nên trang `/` hoặc chunk `/build/*` hỏng dù mạng tốt. Đây là đường duy nhất worker có thể làm game không mở được. Sau T82, lỗi của bộ nhớ được coi như "không có trong bộ nhớ": lấy từ mạng như khi chưa có worker.
- Dọn 7 góp ý còn lại của reviewer T13b. Mỗi góp ý nhỏ, nhưng gom lại thì worker đúng với lời hứa trong tài liệu: không ném lỗi, gỡ khẩn cấp được, phiên bản đổi đúng lúc, build lỗi thì báo đúng lỗi.

## Phạm vi

Làm:
1. Logic lùi về mạng khi bộ nhớ lỗi, viết thuần trong `swLogic.ts` (`cacheFirst`, `networkFirst`), có unit test với cache giả ném lỗi.
2. Bước install tự tải và kiểm từng câu trả lời (không cất câu trả lời bị chuyển hướng hay khác 200), cũng viết thuần trong `swLogic.ts` (`precacheAll`), thay `cache.addAll`.
3. Phiên bản tính cả manifest và mã nguồn worker (`sw.ts`, `swLogic.ts`), bằng hàm thuần `swVersion` có test.
4. `register.ts`: `try/catch` bọc cả trong callback `load`.
5. `vite.config.ts`, `closeBundle`: build chính lỗi thì thoát sớm, không che lỗi gốc bằng `ENOENT`.
6. `tests/e2e/pwa.spec.ts`: import kiểu `Browser` ở dòng 1.
7. Tài liệu: `docs/deploy.md` (gỡ khẩn cấp phải `skipWaiting()`), `docs/choi-tren-iphone.md` (mở offline chỉ được sau lần mở app có mạng), `docs/architecture.md` (mục PWA). `docs/design/multiplayer.md` dòng 19 game-designer đã sửa sẵn trong bước kế hoạch.

KHÔNG làm:
- Không đổi bảng định tuyến `routeFor`, `NEVER_HANDLED`, `precacheUrls`, `freshOnInstall`, `staleCaches`, `cacheName`. Không đổi điều kiện cất `storable` (200 và không `redirected`).
- Không thêm `skipWaiting`, không tự tải lại, không thêm hẹn giờ cho mạng trước. Không đổi bước `activate` trong `sw.ts`.
- Không đổi luật "lỗi mạng thì ném lại": câu trả lời 404/502 vẫn trả nguyên; `fetch` ném lỗi mà không có bản lưu thì ném lại **đúng lỗi mạng đó**, không phải lỗi của bộ nhớ. Bộ canh tải T15 và `vite:preloadError` (T52) dựa vào luật này.
- **Không sửa `tests/e2e/multiplayer.spec.ts` và `packages/client/src/game/labelLayout.ts`** (thuộc T63, đang chờ Q1; phần dở dang nằm trong `stash@{0}`).
- **Cấm dùng `git stash`** dưới mọi dạng (`push`, `pop`, `apply`, `drop`...). `stash@{0}` là phần dở dang của T63, `stash@{1}` của tester; đụng vào là mất việc của nhiệm vụ khác. Cần so với bản cũ thì dùng `git show c97a472:<file>` hoặc `git diff`.
- Không thêm e2e mới: Chromium không có cách làm hỏng Cache Storage từ Playwright; unit test bao phần đó. E2E `pwa.spec.ts` có sẵn kiểm lại đường bình thường (install vẫn cất đủ, reload vẫn qua worker).

## Thiết kế

Không có chữ người chơi thấy mới. Không đổi thao tác cảm ứng hay bàn phím.

### 1. Bộ nhớ lỗi thì coi như "không có", mạng vẫn trả lời

Quy tắc chung cho cả hai chiến lược:
- **Đọc bộ nhớ** (mở cache rồi `match`): mọi lỗi, kể cả ném đồng bộ, đều tính là **không có trong bộ nhớ** (`undefined`).
- **Ghi bộ nhớ** (mở cache rồi `put`): chạy nền qua `defer`. Mọi lỗi bị nuốt: câu trả lời đã giao rồi, lời hứa đưa cho `defer` không bao giờ bị từ chối.
- **Lỗi mạng** (`fetch` ném) vẫn đi ra ngoài như cũ. Mạng lỗi và bộ nhớ cũng lỗi thì ném **lỗi mạng**, để trình duyệt hiện trang lỗi mạng hoặc `<script>` báo `error` như khi không có worker.

Theo từng chiến lược:
- `cacheFirst`: đọc bộ nhớ. Có thì trả. Không có hoặc bộ nhớ lỗi thì `fetch` đúng một lần. Câu trả lời cất được thì ghi nền. Trả câu trả lời mạng; `fetch` ném thì ném lại.
- `networkFirst`: `fetch` trước. Thành công thì ghi nền nếu cất được, rồi trả. `fetch` ném thì đọc bộ nhớ. Có thì trả bản lưu; không có hoặc bộ nhớ lỗi thì ném lại lỗi mạng gốc.

Vì vậy với bộ nhớ hỏng, worker cư xử y như không có worker. Không bao giờ tệ hơn không có worker.

Mở cache nằm **trong** hàm thuần (qua `deps.openCache()`), không còn ở `sw.ts`. Lý do: để lỗi của `caches.open` (kể cả `caches` ném `SecurityError` ngay khi gọi) rơi vào cùng `try/catch` với `match`, và test được bằng cache giả.

### 2. Install kiểm từng câu trả lời

`cache.addAll` chấp nhận câu trả lời bị chuyển hướng. Safari từ chối câu trả lời chuyển hướng cho điều hướng, nên một `/` lưu sẵn kiểu đó sẽ làm app không mở được lúc mất mạng. Đường mạng trước đã chặn điều này (`storable`), đường install thì chưa.

`precacheAll` thay `addAll`, giữ đúng ngữ nghĩa "tất cả hoặc hỏng":
- Tải mọi URL song song. `/` và manifest dùng `cache: "reload"` như cũ (`freshOnInstall`); `/build/*` tải thường.
- Bất kỳ câu trả lời nào không `storable` (khác 200, hoặc `redirected`) thì hàm ném `Error`, và **chưa `put` gì**. Lỗi mạng cũng ném lại.
- Chỉ khi mọi câu trả lời đều tốt mới mở cache rồi `put` từng cái dưới khoá là đường dẫn (`"/"`, `"/manifest.webmanifest"`, `"/build/..."`). Khoá trùng với khoá `routeFor` dùng: chuỗi tương đối, trình duyệt tự đổi thành địa chỉ đầy đủ theo origin của worker, như `addAll` làm trước đây.

Install hỏng thì trình duyệt bỏ worker mới và thử lại ở lần mở sau, như khi `addAll` hỏng. Không có worker thì game chạy như trước T13, nên an toàn. Install **không** nuốt lỗi bộ nhớ (khác bước 1). Một worker cài với cache rỗng hay thiếu là vô ích; để install hỏng là đúng.

Giới hạn chấp nhận: nếu `put` hỏng giữa chừng (hết chỗ), cache `petgame-<phiên bản>` có thể còn vài mục. Install vẫn hỏng nên worker không chạy. Cache dở đó bị ghi đè ở lần install sau cùng phiên bản, hoặc bị `staleCaches` xoá khi một phiên bản khác kích hoạt.

### 3. Phiên bản

Hiện phiên bản chỉ băm `dist/index.html` và danh sách lưu sẵn. Đổi riêng manifest, hoặc riêng logic của worker (như chính T82), thì tên cache giữ nguyên. Khi đó worker mới cài vào **cùng** cache mà worker cũ đang dùng, và `activate` không dọn gì.

Phiên bản mới là 12 ký tự hex đầu của SHA-256 trên `JSON.stringify([indexHtml, manifest, workerSources, precache])`, với:
- `manifest`: nội dung `dist/manifest.webmanifest`;
- `workerSources`: mã nguồn `src/pwa/sw.ts` và `src/pwa/swLogic.ts`, theo thứ tự đó.

Dùng `JSON.stringify` để hai bộ đầu vào khác nhau không bao giờ ghép thành cùng một chuỗi (ví dụ `"ab" + "c"` và `"a" + "bc"`). Băm bằng Web Crypto (`crypto.subtle.digest`), có sẵn trong Node 22 và trong lib DOM của client. Nhờ vậy không cần kiểu `node:crypto` trong `tsconfig` của client (`types: ["vite/client"]`), và test chạy bằng hàm băm thật.

Băm nguồn chứ không băm `sw.js` đã build: `sw.js` chứa chính phiên bản, nên không băm nó được. Hệ quả: sửa chú thích trong `sw.ts` cũng ra phiên bản mới, tức tải lại khoảng 1 MB một lần. Chấp nhận được, vì gần như mọi deploy đều đã đổi `index.html`.

### 4. `register.ts`

Đúng JSDoc "never throws": mọi chỗ đụng tới `navigator.serviceWorker` nằm trong `try/catch`, kể cả khi chạy trong callback `load`. Lỗi thì `console.warn("Service worker not registered", err)`, như hiện tại.

### 5. Gỡ khẩn cấp (tài liệu)

Worker không `skipWaiting`, nên một bản `sw.ts` gỡ worker mà không `skipWaiting` sẽ chờ tới khi mọi tab cũ đóng mới chạy; điện thoại có thể giữ tab nhiều ngày. Bản gỡ khẩn cấp phải:
- `install`: gọi `self.skipWaiting()`;
- `activate`: xoá mọi cache `petgame-*`, rồi `self.registration.unregister()`;
- không có listener `fetch`.

## Kế hoạch triển khai

Thứ tự gợi ý: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Mỗi bước typecheck được.

1. **`packages/client/src/pwa/swLogic.ts`: deps và lùi về mạng.**
   - `StrategyDeps`: bỏ trường `cache: CacheLike`, thay bằng `openCache(): Promise<CacheLike>`. JSDoc: "Opens this build's cache. May throw or reject when Cache Storage is broken or blocked; the strategies then answer from the network alone." `CacheLike` giữ nguyên.
   - Hàm nội bộ (không export):
     - `async function lookup(deps: Pick<StrategyDeps, "openCache">, key: string): Promise<Response | undefined>`: `try { return await (await deps.openCache()).match(key); } catch { return undefined; }`. Lời gọi `deps.openCache()` phải nằm trong `try`, để lỗi ném đồng bộ cũng bị bắt. JSDoc: lỗi của bộ nhớ tính là "không có", để bộ nhớ hỏng không bao giờ chặn một câu trả lời mạng.
     - `function storeLater(deps: StrategyDeps, key: string, response: Response): void`. Nếu `!storable(response)` thì `return`. Gọi `response.clone()` **đồng bộ**, trước khi trả `response` cho trình duyệt. Rồi gọi `deps.defer(...)` với một lời hứa không bao giờ bị từ chối. Ví dụ: một hàm `async` mở cache rồi `await cache.put(key, copy)`, bên ngoài nối `.catch(() => {})`. Bên trong phải `async` để `openCache`/`put` ném đồng bộ cũng thành lời hứa bị từ chối, rồi bị `.catch` nuốt.
   - `cacheFirst`: `const hit = await lookup(deps, key); if (hit) return hit; const response = await deps.fetch(request); storeLater(deps, key, response); return response;`.
   - `networkFirst`: trong `catch (error)` của `fetch`, dùng `const stored = await lookup(deps, key); if (stored) return stored; throw error;`. Nhánh thành công dùng `storeLater`.
   - Cập nhật JSDoc của hai hàm: thêm một câu "A broken cache counts as a miss and a failed store is ignored; only a network error is thrown."

2. **`swLogic.ts`: `precacheAll`.**
   ```ts
   /**
    * Install step: fetches every URL and stores them only if all are storable (200, not redirected), so a
    * redirected lobby page is never kept (Safari refuses it for a navigation). Throws on any bad answer or
    * network error before storing anything, so the install fails and the browser retries, as addAll did.
    * Cache errors are thrown too: a worker with a missing cache is worth nothing.
    */
   export async function precacheAll(urls: readonly string[], origin: string, deps: Pick<StrategyDeps, "fetch" | "openCache">): Promise<void>
   ```
   - Mỗi URL: `new Request(origin + url, freshOnInstall(url) ? { cache: "reload" } : undefined)`. Origin cần thiết vì `Request` trong Node không nhận đường dẫn tương đối; trong worker là `sw.location.origin`.
   - `const responses = await Promise.all(urls.map(...))`. Trong `map`: câu trả lời `!storable(r)` thì `throw new Error(\`precache ${url}: ${r.status}${r.redirected ? " redirected" : ""}\`)`.
   - Sau đó `const cache = await deps.openCache();` rồi `await Promise.all(responses.map((r, i) => cache.put(urls[i], r)))`.

3. **`swLogic.ts`: `swVersion`.** Đặt ngay sau `precacheUrls` (cùng nhóm "dùng lúc build").
   ```ts
   /** Everything a worker build stores or runs; any change gives a new version, so a new cache. */
   export interface SwVersionInputs {
     indexHtml: string;
     manifest: string;
     /** Source text of sw.ts then swLogic.ts. */
     workerSources: readonly string[];
     precache: readonly string[];
   }
   /** First 12 hex chars of SHA-256 over the inputs as JSON (no two inputs join into the same text). Web Crypto, so no Node types are needed. */
   export async function swVersion(inputs: SwVersionInputs): Promise<string>
   ```
   - Thân hàm: `crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([inputs.indexHtml, inputs.manifest, inputs.workerSources, inputs.precache])))`. Rồi đổi sang hex: `Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")`, lấy `.slice(0, 12)`.
   - `sw.ts` không import hàm này, nên rolldown loại nó khỏi `sw.js`; kiểm bằng tiêu chí 9. Nếu vẫn lọt vào `sw.js`, chuyển `SwVersionInputs` và `swVersion` sang file mới `packages/client/src/pwa/swVersion.ts`, kèm test riêng, rồi ghi lệch vào `PROGRESS.md`.
   - Sửa chú thích đầu file: thêm "plus two build-time helpers (`precacheUrls`, `swVersion`) used by vite.config.ts".

4. **`packages/client/src/pwa/sw.ts`.**
   - Import thêm `precacheAll`; bỏ `freshOnInstall`, vì giờ chỉ `swLogic.ts` dùng nó (giữ typecheck sạch với `noUnusedLocals`).
   - `const openCache = () => caches.open(CACHE);`. Tham chiếu `caches` chỉ nằm trong thân hàm, để `caches` ném lỗi thì lỗi rơi vào `try` của `lookup`.
   - `install`: `event.waitUntil(precacheAll(precache, sw.location.origin, { fetch: (r) => fetch(r), openCache }));`. Giữ chú thích "No skipWaiting...".
   - `fetch`: `event.respondWith(strategy(request, route.key, { fetch: (r) => fetch(r), openCache, defer: (p) => event.waitUntil(p) }));`. Không còn `caches.open(...).then(...)` bọc ngoài.
   - Thêm chú thích một dòng trên `respondWith`: "Cache Storage errors never reach respondWith: the strategies fall back to the network (T82)."
   - `activate`: không đổi.

5. **`packages/client/vite.config.ts`.**
   - Bỏ `import { createHash } from "node:crypto"`. Import thêm `swVersion` (cùng dòng với `precacheUrls`).
   - Thêm biến `let failed = false;` cạnh `root`/`outDir`, và các hook:
     - `buildStart() { failed = false; }`;
     - `buildEnd(error) { if (error) failed = true; }`;
     - `renderError() { failed = true; }`;
     - `async closeBundle(error) { if (error || failed) return; ... }`.
     
     Kèm chú thích: "A failed main build keeps its own error; reading dist/index.html here would only add an ENOENT on top." Rolldown khai báo `buildEnd(err?)` và `closeBundle(error?)` (`node_modules/rolldown/dist/shared/define-config-*.d.mts`).
   - **Không** dùng `existsSync(index.html)` để thoát: build thành công mà thiếu `index.html` là lỗi thật, phải nổ.
   - Phiên bản: `await swVersion({ indexHtml, manifest, workerSources, precache })`. Đọc bằng `readFileSync(..., "utf8")`:
     - `indexHtml`: `join(outDir, "index.html")`;
     - `manifest`: `join(outDir, "manifest.webmanifest")`;
     - `workerSources`: `resolve(root, "src/pwa/sw.ts")`, `resolve(root, "src/pwa/swLogic.ts")`.
   - Sửa JSDoc của `serviceWorker()`: "The version hashes index.html, the manifest, the worker's own source and the precache list, so an unchanged build gives the same version and any change to what the worker stores or does gives a new cache."

6. **`packages/client/src/pwa/register.ts`.**
   - Thân hàm sau `if (!import.meta.env.PROD) return;`: một `try` bọc `"serviceWorker" in navigator`, và chỗ gắn listener hoặc gọi ngay.
   - `register` bên trong có `try/catch` riêng: `try { navigator.serviceWorker.register(...).catch(warn); } catch (err) { warn(err); }`, với `const warn = (err: unknown) => console.warn("Service worker not registered", err);`.
   - Sửa JSDoc dòng cuối: "...and never throws, not even later in the load callback."

7. **`tests/e2e/pwa.spec.ts`.** Dòng 1: `import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";`. Dòng 13: `browser: Browser`. Không đổi gì khác.

8. **Tài liệu.**
   - `docs/deploy.md` dòng 65 (gạch "Gỡ service worker"), thay bằng: "Gỡ service worker khỏi máy người chơi khi cần (tắt khẩn cấp): deploy một `sw.ts` mà `install` gọi `self.skipWaiting()`, `activate` xoá mọi cache `petgame-*` rồi gọi `self.registration.unregister()`, và không có listener `fetch`. Thiếu `skipWaiting()` thì bản gỡ chờ tới khi mọi tab cũ đóng mới chạy (điện thoại có thể giữ tab nhiều ngày)." Thêm một gạch sau đó: "Cache Storage của trình duyệt hỏng thì worker lấy từ mạng như không có worker (T82); nó không bao giờ là lý do game không mở khi có mạng."
   - `docs/choi-tren-iphone.md` dòng 66 (Cách B), câu đầu đổi thành: "game lưu sẵn trang và script **sau lần đầu mở app có mạng**, nên từ đó khi mất mạng vẫn mở được tới sảnh; ...". Thêm nửa câu: "(app ở Màn hình chính có bộ nhớ riêng, không dùng bản Safari đã lưu, nên lần đầu mở app phải có mạng)". Phần sau giữ nguyên.
   - `docs/architecture.md`, mục "PWA (T13)":
     - dòng 118: danh sách hàm thêm `precacheAll`, `swVersion`;
     - dòng 119: thêm "Cache Storage lỗi (mở, đọc, ghi) tính như không có trong bộ nhớ: trả lời từ mạng, chỉ lỗi mạng mới ném (T82)";
     - dòng 120: phiên bản thành "12 ký tự sha256 của `index.html`, manifest, mã nguồn `sw.ts` + `swLogic.ts` và danh sách lưu sẵn"; install là "`precacheAll`: tải hết, chỉ cất khi mọi câu trả lời 200 và không chuyển hướng".
   - `docs/design/multiplayer.md` dòng 19: game-designer đã sửa trong bước kế hoạch, coder không đụng.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`. Không đổi server. Client: chỉ worker và chỗ đăng ký.

Tương thích: phiên bản đổi công thức, nên lần deploy đầu sau T82 ra tên cache mới. Worker mới cài cache mới, rồi khi kích hoạt xoá cache cũ (`staleCaches`). Đây là đúng đường cập nhật bình thường; không ảnh hưởng dữ liệu người chơi (localStorage và SQLite không liên quan).

## Test

### Unit: `packages/client/src/pwa/swLogic.test.ts` (sửa và thêm)

**Sửa helper `fakes`** theo `openCache`:
- thêm tham số thứ ba `broken?: "open" | "openThrows" | "match" | "put" | "putThrows"`;
- `"open"`: `openCache` trả lời hứa bị từ chối. `"openThrows"`: `openCache` ném đồng bộ. `"match"`/`"put"`: hàm đó trả lời hứa bị từ chối. `"putThrows"`: `put` ném đồng bộ. Lỗi giả là `new Error("cache broken")` (đặt hằng `CACHE_BROKEN`);
- đếm thêm `state.opens` và `state.puts`;
- `settle` giữ là `Promise.all(pending)`, để test "lời hứa ghi nền không bị từ chối" dùng `await expect(f.settle()).resolves.toBeDefined()`.

**Mọi test cũ giữ nguyên nghĩa**, chỉ đổi cách dựng deps; không xoá hay nới test nào.

**Thêm `describe("a broken Cache Storage never blocks the network")`.** Có thể dùng `it.each` theo `broken`, mỗi ca ghi rõ tên:
- `cacheFirst`, `broken` = `open` / `openThrows` / `match`: trả câu trả lời mạng (đọc được `"body"`), `fetches === 1`, `settle()` không bị từ chối.
- `cacheFirst`, `broken` = `put` / `putThrows`: trả câu trả lời mạng, `settle()` không bị từ chối. Ca `putThrows` chứng minh lỗi đồng bộ không thoát khỏi `cacheFirst`.
- `networkFirst`, đủ 5 giá trị `broken`: trả câu trả lời mạng, `settle()` không bị từ chối, `matches === 0`.
- `networkFirst` trả 503 với bộ nhớ hỏng (`open`): trả 503 nguyên.
- **Lỗi mạng vẫn đi ra**, với `broken` = `open` / `openThrows` / `match`, dưới cả hai chiến lược: `fetch` bị từ chối với `offline`. Kiểm `rejects.toBe(offline)`, tức đúng lỗi mạng chứ không phải `CACHE_BROKEN`.
- `cacheFirst` với bộ nhớ có sẵn bản lưu nhưng `match` hỏng: `fetch` một lần, trả câu trả lời mạng (không trả bản lưu, không treo).

**Thêm vào `describe("cacheFirst")`:** "does not store a redirected answer", dùng câu trả lời giả `{ status: 200, redirected: true, clone }` như test cũ của `networkFirst`.

**Thêm `describe("precacheAll")`.** Dùng `fetch` giả trả câu trả lời theo URL, và cache giả dạng `Map`:
- Mọi URL trả 200: cất đủ, khoá đúng (`"/"`, `"/build/a.js"`, `"/manifest.webmanifest"`); mỗi URL `fetch` đúng một lần; `request.url === ORIGIN + url`. `request.cache` là `"reload"` cho `/` và manifest, là `"default"` cho `/build/*` (Node `Request` có trường `cache`; đã kiểm).
- `/` trả câu trả lời giả `redirected: true` (status 200): hàm bị từ chối, lỗi chứa `"redirected"`; cache rỗng (`puts === 0`).
- Một file `/build/*` trả 404: bị từ chối, cache rỗng.
- Một URL `fetch` ném `offline`: bị từ chối với `offline`, cache rỗng.
- `openCache` hỏng mà mọi câu trả lời tốt: bị từ chối (install phải hỏng, không nuốt).

**Thêm `describe("swVersion")`:**
- Với `base = { indexHtml: "<html>", manifest: "{}", workerSources: ["sw", "logic"], precache: ["/", "/build/a.js"] }`:
  - kết quả khớp `/^[0-9a-f]{12}$/`;
  - gọi hai lần ra cùng giá trị.
- Đổi riêng `manifest` → khác `base`.
- Đổi riêng `workerSources[0]` (`sw.ts`) → khác. Đổi riêng `workerSources[1]` (`swLogic.ts`) → khác.
- Đổi riêng `indexHtml` → khác. Đổi riêng `precache` → khác.
- Ranh giới: `{ indexHtml: "ab", manifest: "c" }` khác `{ indexHtml: "a", manifest: "bc" }`.

### Unit mới: `packages/client/src/pwa/register.test.ts`

Dùng `vi.stubEnv("PROD", true)`, `vi.stubGlobal("navigator" | "document" | "window", ...)`, `vi.spyOn(console, "warn").mockImplementation(() => {})`. `afterEach` gọi `vi.unstubAllEnvs()`, `vi.unstubAllGlobals()`, `vi.restoreAllMocks()`.
- `navigator` có getter `serviceWorker` ném `SecurityError`, `document.readyState = "loading"`, `window.addEventListener` giữ lại listener. Gọi `registerServiceWorker()` không ném; gọi listener đã giữ cũng không ném; `console.warn` được gọi một lần. Đây là ca chứng minh sửa đúng: với code cũ, listener ném.
- `readyState = "complete"`, `register` trả lời hứa resolve: gọi ngay với `"/sw.js"`, không gắn listener.
- `register` trả lời hứa bị từ chối: không ném, `console.warn` được gọi (sau `await` một vòng microtask).
- `vi.stubEnv("PROD", false)`: không đọc `navigator` (getter không bị gọi), không gắn listener.

Lưu ý: `"serviceWorker" in navigator` không gọi getter, nên đối tượng giả phải định nghĩa `serviceWorker` bằng `Object.defineProperty(..., { get() { throw ... } })`.

### E2E

`tests/e2e/pwa.spec.ts`: chỉ đổi import (bước 7). Hai test có sẵn phải qua. Test 1 (c) kiểm lại rằng `precacheAll` cất đủ `/`, manifest và mọi script/modulepreload; (d) kiểm reload vẫn được worker trả lời. Không cần chạy lại cả bộ `multiplayer.spec.ts` để chấm T82, nhưng CI vẫn chạy cả bộ: tester chạy `npm run test:e2e` đầy đủ như thường lệ.

## Tiêu chí hoàn thành

1. `npm run typecheck` sạch. `npm test` qua, gồm mọi ca mới ở mục Test, cộng các ca cũ của `swLogic.test.ts` không bị xoá hay nới.
2. Trong `sw.ts` không còn `caches.open(...).then(` bọc quanh `respondWith`. Cache chỉ được mở qua `deps.openCache()` trong `swLogic.ts`, và không có `cache.addAll` nào.
3. Với cache giả ném lỗi ở `openCache` (bị từ chối và ném đồng bộ), `match`, `put` (bị từ chối và ném đồng bộ): cả hai chiến lược trả câu trả lời mạng, `fetch` đúng một lần, lời hứa đưa cho `defer` không bị từ chối.
4. Mạng lỗi kèm bộ nhớ lỗi: cả hai chiến lược ném **đúng** lỗi mạng (`toBe(offline)`).
5. `precacheAll` không cất gì khi có câu trả lời `redirected`, khác 200, hoặc lỗi mạng, và khi đó bị từ chối. Mọi câu trả lời tốt thì cất đủ, đúng khoá, `/` và manifest tải với `cache: "reload"`.
6. `swVersion` đổi khi manifest, `sw.ts` hoặc `swLogic.ts` đổi, và ổn định với cùng đầu vào. `vite.config.ts` truyền đúng 4 nguồn đó.
7. `npm run build` hai lần liền không đổi gì: dòng log `service worker <phiên bản>: N files precached` ra cùng phiên bản. N bằng số của bản build `c97a472` (reviewer T13b đếm được 15): T82 không đổi danh sách lưu sẵn.
8. `closeBundle` thoát sớm khi build chính lỗi (cờ `failed` từ `buildEnd`/`renderError`, hoặc tham số `error`). Không dùng `existsSync` để im lặng bỏ qua build thành công thiếu `index.html`. Reviewer kiểm bằng đọc code. Nếu tester muốn kiểm tay: sửa tạm một import trong `packages/client/src/main.ts` thành file không tồn tại, chạy `npm run build`, xác nhận lỗi in ra là lỗi resolve gốc chứ không phải `ENOENT ... index.html`. Rồi **sửa lại bằng tay**, và `git diff --stat packages/client/src/main.ts` phải rỗng. Không dùng `git stash` hay `git checkout` cho việc này.
9. `dist/sw.js` là IIFE, không có `import`/`export`, không chứa `subtle` (tức `swVersion` đã bị loại khỏi worker). Có chứa chuỗi `redirected` (`precacheAll` và `storable`). Ghi cỡ file vào `PROGRESS.md` (trước T82: 2087 byte).
10. `register.ts`: mọi lần đọc `navigator.serviceWorker` nằm trong `try/catch`, kể cả trong callback `load`. `register.test.ts` có ca getter ném trong listener; ca này hỏng với code cũ.
11. `npm run test:e2e` qua, gồm hai test `pwa:`. `pwa.spec.ts` dùng `type Browser` ở dòng 1 và không còn `import(` trong chú thích kiểu.
12. Tài liệu đã sửa đúng mục 8: `deploy.md` có `skipWaiting()` trong cách gỡ khẩn cấp; `choi-tren-iphone.md` có "sau lần đầu mở app có mạng"; `architecture.md` ghi phiên bản mới, `precacheAll` và luật lùi về mạng.
13. `git diff c97a472 --stat` không có `tests/e2e/multiplayer.spec.ts` hay `packages/client/src/game/labelLayout.ts`. `git stash list` vẫn đúng 2 mục như lúc bắt đầu (`stash@{0}` T63, `stash@{1}` tester).

## Rủi ro, câu hỏi mở

Không có CHẶN.

- **`vi.stubEnv("PROD", true)`:** Vitest 5 khai báo `stubEnv` nhận `boolean` cho `PROD`. Nếu `import.meta.env.PROD` trong `register.ts` vẫn không đổi theo, đừng tắt test. Khi đó tách phần sau dòng kiểm `PROD` thành hàm export `registerWhenLoaded(base: string): void` (vẫn trong `register.ts`), cho `registerServiceWorker` gọi nó, và test hàm đó. Ghi lệch vào `PROGRESS.md`.
- **Rolldown không loại `swVersion` khỏi `sw.js`:** xem phương án ở bước 3 (tách sang `swVersion.ts`).
- **Vite 8 có gọi `closeBundle` khi build lỗi không:** không chắc. Cờ `failed` cộng tham số `error` an toàn trong cả hai trường hợp; nếu Vite không gọi thì nhánh đó vô hại.
- **Ghi nền sau `respondWith`:** `event.waitUntil` được gọi sau một `await` trong lúc lời hứa của `respondWith` còn chờ. Spec cho phép, và code hiện tại đã làm vậy; không đổi.
- **Install nghiêm hơn:** một proxy luôn chuyển hướng `/` (ví dụ sang `/index.html`) giờ làm install hỏng mãi, tức không có worker. Đó là đúng ý: không có worker thì game chạy như trước T13. Lưu sẵn một trang mà Safari sẽ từ chối còn tệ hơn. Server hiện không chuyển hướng `/`.
- **Phiên bản đổi khi chỉ sửa chú thích worker:** chấp nhận được (xem Thiết kế 3).

## Đề xuất tách nhiệm vụ

Không cần: tất cả nhỏ và cùng chạm `src/pwa/`, làm được trong một vòng coder.
