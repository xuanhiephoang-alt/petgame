# PLAN: T43 Server nén script và tài nguyên tĩnh

Code đọc ở `a47dcbd` ("Mark T14 done, add T85 and T86, start T43"). Nguồn: dòng T43 trong `TASKS.md`; cách đo trong `PLAN.md` của commit kế hoạch T15 `478c8a7` (Thiết kế 3 và đề xuất "Server nén script" ở cuối file); `packages/server/src/index.ts`; `packages/client/vite.config.ts`; `packages/client/src/pwa/swLogic.ts`, `sw.ts`; `tests/e2e/pwa.spec.ts`; `playwright.config.ts`; `Dockerfile`; mã của `send` 1.2.1 và `express` 5.2.1 trong `node_modules` (cách `express.static`/`res.sendFile` đặt header). Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Việc này là server, script build và test, không có hình ảnh.

## Mục tiêu

Hiện Express phục vụ `packages/client/dist` bằng `express.static` không nén (`index.ts`, trong `express: (app) => { ... }`: `app.use("/build", express.static(..., { immutable: true, maxAge: "1y" }))` rồi `app.use(express.static(clientDist))`). Cả `npm run play` lẫn bản Docker (Fly, Render) đi qua đúng chỗ này.

Sảnh tải 11 file trước khi ô tên và nút "Vào chơi" mở: `index.html`, chunk entry `build/index-*.js` và 9 chunk `modulepreload`. T15 đo được ở 3G chậm (400 kbps, 400 ms) sảnh sẵn sàng sau **20,7 s**, 3G 11,3 s, 4G chậm 5,3 s. Gần như toàn bộ là thời gian truyền: 985 kB / 50 kB/s ≈ 19,7 s.

Tính lại trên `dist` hiện có trong cây làm việc (bản build cũ hơn HEAD một chút; coder build lại trước khi đo):

| 11 file của sảnh | Byte | Thời gian truyền ở 3G chậm (50 kB/s) |
|---|---|---|
| không nén | 1 013 905 | 20,3 s |
| gzip mức 9 | 316 322 | 6,3 s |
| brotli mức 11 | 271 113 | 5,4 s |

(File < 1 KiB tính như không nén, đúng luật Thiết kế 2.) Cộng khoảng 1 s cho các vòng trễ thì **ước 6,5 s (brotli) đến 7,5 s (gzip)**, nhanh gấp khoảng 3 lần. Người chơi điện thoại mạng yếu vào sảnh nhanh hơn hẳn; ở 3G thường dưới 5 s.

## Phạm vi

**Làm:**
- Lúc build, tạo sẵn `<file>.br` và `<file>.gz` cạnh các file chữ trong `dist` (script Node, chỉ dùng `node:zlib`).
- Middleware nhỏ ở server chọn `.br`, `.gz` hay file gốc theo `Accept-Encoding`, với header đúng (Content-Encoding, Vary, Content-Length, ETag, Cache-Control, Content-Type), HEAD, 304, Range.
- Tách phần khai báo route HTTP của `index.ts` ra một module để test tích hợp được (`/healthz`, `/whoami`, client tĩnh).
- `precacheUrls` của service worker bỏ qua `.br`/`.gz` (phòng hờ).
- Test unit, tích hợp, thêm một kiểm tra nhỏ trong `tests/e2e/pwa.spec.ts`; đo lại theo cách T15; cập nhật tài liệu.

**KHÔNG làm:**
- Không thêm dependency (không `compression`, không `express-static-gzip`, không import trực tiếp `send`/`serve-static`; chỉ dùng API của Express: `res.sendFile`, `res.vary`, `res.type`).
- Không nén câu trả lời động (`/whoami`, `/healthz`, `/matchmake/*`): đều vài chục byte.
- Không zstd (Chrome có hỗ trợ, nhưng Node 22 chỉ có zstd thử nghiệm từ 22.15; brotli và gzip đủ cho mọi trình duyệt). Ghi vào rủi ro để làm sau nếu muốn.
- Không đổi Cache-Control đang có: `/build/*` vẫn `public, max-age=31536000, immutable`; mọi thứ khác (gồm `index.html`, `sw.js`, `manifest.webmanifest`, `/assets/*`) vẫn `public, max-age=0` kèm ETag/Last-Modified (T15, T52 dựa vào việc trang luôn kiểm lại).
- Không chặn ai tải thẳng `/build/x.js.br` (trả file như `express.static` vẫn làm; vô hại).
- Không đổi `playwright.config.ts`, không chuyển e2e sang bản build (việc của T16).
- **Không sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts` (đụng phần đang cất trong `git stash`). Không dùng `git stash`.
- Không đổi `worldLimits.ts`.

## Thiết kế

### 1. Chọn cách làm: (b) nén sẵn lúc build, không dependency mới

| | (a) middleware `compression` | (b) `.br`/`.gz` tạo lúc build | (c) lai |
|---|---|---|---|
| Dependency | thêm `compression` + 7 gói con | không | thêm |
| Cỡ script sảnh | gzip mức 6 (mặc định) 224 kB cho chunk entry; brotli động thường để mức thấp (mức 11 mất 1,7 s cho 708 kB, không làm được mỗi request) | brotli mức 11: 188 kB cho chunk entry | như (b) |
| CPU mỗi request | nén lại mỗi lần (không cache) | 0, chỉ đọc file | |
| Content-Length | mất (chunked) | đúng, cỡ file nén | |
| ETag | giữ nguyên ETag của file gốc cho cả bản nén (hai biểu diễn khác nhau chung một ETag) | mỗi biểu diễn một ETag riêng (Thiết kế 4) | |
| Range | phải tự cẩn thận | rõ ràng: có Range thì trả file gốc | |

Nội dung cần nén đều là file tĩnh đã biết lúc build; câu trả lời động đều tí hon. Nên (b) vừa nhỏ hơn, vừa không tốn CPU (máy Fly 1 CPU dùng chung còn chạy mô phỏng 20 tick/giây), vừa không thêm gói. (c) chỉ có lợi nếu có nội dung động lớn: không có. **Chọn (b).**

Nhược điểm của (b), chấp nhận được:
- Chỉ có tác dụng khi build bằng `npm run build` (gọi script nén). `vite build` trơn thì không có `.br`/`.gz`, server tự trả file gốc như hiện nay: không hỏng gì.
- Danh sách file nén đọc một lần lúc server khởi động (Thiết kế 4). Build lại khi server đang chạy thì phải khởi động lại mới được nén file mới; xem Rủi ro.

### 2. Luật nén lúc build (`scripts/precompressLib.mjs`)

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `COMPRESSIBLE_EXTENSIONS` | `.js`, `.mjs`, `.css`, `.html`, `.json`, `.webmanifest`, `.svg`, `.txt`, `.wasm` | file chữ (và wasm) nén được 3 đến 9 lần. Không có `.png`, `.webp`, `.jpg`, `.woff2`: đã nén sẵn, đo được brotli/gzip chỉ đổi ±0,1% (749 kB png, 2,37 MB webp trong `dist`). Không có `.map` (bản build không sinh). So khớp không phân biệt hoa thường. |
| `MIN_BYTES` | 1024 | dưới 1 KiB thì vừa một gói TCP (khoảng 1460 byte), nén không đổi số vòng truyền. Trong `dist` hiện tại: bỏ `manifest.webmanifest` 831 B, `getTextureBatchBindGroup-*.js` 344 B, `webworkerAll-*.js` 55 B (bản gzip còn to hơn gốc: 63 B). |
| `MAX_RATIO` | 0,9 | chỉ giữ bản nén nếu ≤ 90% file gốc (làm tròn xuống). Bảo đảm bản nén luôn khác cỡ file gốc, nên ETag khác (Thiết kế 4). |
| brotli | `BROTLI_PARAM_QUALITY` 11, `BROTLI_PARAM_MODE` = `BROTLI_MODE_TEXT`, `BROTLI_PARAM_SIZE_HINT` = cỡ file | nhỏ nhất; nén một lần lúc build. Đo: 708 kB → 188 kB trong 1,7 s. |
| gzip | `level` 9 | mức 9 so với 6 chỉ nhỏ hơn chút ít nhưng miễn phí lúc build (27 ms). |

Luật giữ bản nén (`keepVariants(rawSize, brSize, gzSize)`):
- `.gz` giữ khi `gzSize <= floor(rawSize * 0.9)`.
- `.br` giữ khi `brSize <= floor(rawSize * 0.9)` **và** `brSize < gzSize` (hoặc `.gz` không được giữ). Nhờ vậy ba bản (gốc, br, gz) của một file luôn khác cỡ, nên ba ETag khác nhau; và không bao giờ phục vụ bản br to hơn gz.

Luật chọn file (`shouldCompress(relPath, size)`): đuôi trong danh sách; `size >= MIN_BYTES`; không đuôi `.br`/`.gz`; không có đoạn đường dẫn nào bắt đầu bằng `.` (Express không phục vụ dotfile).

Chạy lại trên cùng `dist` phải ra đúng kết quả cũ (idempotent): với mỗi file nguồn được xét, xoá `<file>.br`/`<file>.gz` cũ nếu lần này không giữ, ghi đè nếu giữ; không bao giờ tạo `x.js.br.br`.

Nén song song bằng bản bất đồng bộ (`promisify(brotliCompress)`, `promisify(gzip)`, `Promise.all`): libuv chạy 4 luồng. Build thêm khoảng 2-3 s.

Log một dòng tiếng Anh, ví dụ: `precompressed 16 files: 1.13 MB -> br 300 kB, gzip 350 kB`.

**Chạy ở đâu:** script build của client: `"build": "vite build && node ../../scripts/precompress.mjs dist"` (`packages/client/package.json`; npm chạy script workspace với cwd là `packages/client`).
- Vì sao không làm plugin Vite: phải chạy **sau** plugin `petgame-service-worker` (nó sinh `dist/sw.js` và đọc danh sách file cho precache trong `closeBundle`). Trong Vite 8/Rolldown `closeBundle` là hook song song, thứ tự giữa hai plugin không chắc chắn. Chạy sau khi `vite build` thoát thì thứ tự rõ ràng: precache được tính trên `dist` chưa có `.br`/`.gz`, còn `sw.js` cũng được nén.
- Mọi lối vào đều đi qua đây: `npm run build` (gốc) gọi script workspace; `npm run play`, `Dockerfile` (`RUN npm run build`), CI và `webServer` của Playwright (`npm run build && npm run start ...`) đều gọi `npm run build`. `.dockerignore` không loại `scripts/`.
- Có tiền lệ: `scripts/shotsLib.mjs` + `shotsLib.test.mjs` (vitest đã gom `scripts/**/*.test.mjs`).

### 3. Chọn bản nén theo `Accept-Encoding` (`packages/server/src/contentEncoding.ts`, hàm thuần)

`type Encoding = "br" | "gzip"`. `ENCODINGS: readonly Encoding[] = ["br", "gzip"]` (thứ tự ưu tiên khi hoà). `ENCODING_SUFFIX: Record<Encoding, string> = { br: ".br", gzip: ".gz" }`.

`parseAcceptEncoding(header: string | undefined): Map<string, number>` (coding viết thường → q):
- Tách theo `,`, bỏ khoảng trắng, bỏ mục rỗng.
- Mỗi mục: `coding *( ";" param )`. `coding` phải là token (`/^[!#$%&'*+.^_`|~0-9a-z-]+$/` sau khi viết thường), sai thì bỏ mục.
- Tham số `q` (tên không phân biệt hoa thường) phải khớp `/^(0(\.\d{0,3})?|1(\.0{0,3})?)$/`, sai thì bỏ mục; không có `q` thì q = 1. Tham số khác bỏ qua.
- `x-gzip` tính là `gzip` (RFC 9110 mục 8.4.1.3).
- Một coding xuất hiện nhiều lần: lấy lần đầu.

`pickEncoding(header: string | undefined, available: readonly Encoding[]): Encoding | null` (`null` = gửi file gốc):
- Không có header, hoặc header rỗng sau khi bỏ khoảng trắng: `null`.
- q của một coding trong `available`: mục của nó nếu có, không thì mục `*` nếu có, không thì 0.
- Chọn coding có q > 0 lớn nhất; hoà thì theo thứ tự `ENCODINGS` (br trước).
- **File gốc chỉ thắng khi `identity` được ghi rõ với q lớn hơn hẳn** q của coding vừa chọn. Không tính "identity mặc định q = 1" vì header thật như `br;q=1.0, gzip;q=0.8, *;q=0.1` hay `gzip;q=0.5` vẫn có nghĩa là muốn nén; nginx `gzip_static` cũng làm vậy.
- Không coding nào có q > 0: `null` (kể cả khi `identity;q=0`: trả file gốc còn hơn 406, như `express.static` hiện nay).

Các header phải test (kết quả với `available = ["br", "gzip"]` nếu không ghi khác):

| Header | Kết quả |
|---|---|
| `gzip, deflate, br, zstd` (Chrome HTTPS) | `br` |
| `gzip, deflate` (Chrome trên `http://192.168...`, xem Rủi ro) | `gzip` |
| `gzip, deflate, br` (Safari, Firefox) | `br` |
| không có / `""` / `"  "` | `null` |
| `identity` | `null` |
| `br;q=0, gzip` | `gzip` |
| `br;q=0.5, gzip;q=0.8` | `gzip` |
| `GZIP;Q=1, BR;Q=1` | `br` (hoà, br trước) |
| `*` | `br` |
| `*;q=0, gzip` | `gzip` |
| `gzip;q=0.5` | `gzip` |
| `identity;q=1, br;q=0.5` | `null` |
| `br;q=1, identity;q=1` | `br` (hoà với identity: nén) |
| `x-gzip` | `gzip` |
| `br;q=abc, gzip` / `br;q=1.5, gzip` / `br;q=0.1234, gzip` | `gzip` (mục br sai bị bỏ) |
| `br;level=5;q=0.9` | `br` |
| `deflate` | `null` |
| `gzip, gzip;q=0` | `gzip` (lần đầu thắng) |
| `gzip, deflate, br` với `available = ["gzip"]` | `gzip` |
| `br` với `available = ["gzip"]` | `null` |
| `gzip, br` với `available = []` | `null` |

### 4. Middleware phục vụ bản nén (`packages/server/src/webClient.ts`)

**Danh mục lúc khởi động:** `findPrecompressed(dir): Map<string, Encoding[]>` duyệt `dir` đệ quy một lần (`readdirSync` với `withFileTypes`), bỏ mục bắt đầu bằng `.`. Với mỗi file `F` không đuôi `.br`/`.gz`: nếu thư mục cùng chứa `F.br` và/hoặc `F.gz` thì thêm khoá `"/" + đường dẫn tương đối kiểu POSIX` → các encoding có, theo thứ tự `ENCODINGS`. Không stat theo request; dist không đổi khi server chạy (`npm run play` build trước rồi mới chạy).

**`precompressed(dir, cache: StaticCacheOptions): RequestHandler`** (`StaticCacheOptions = { maxAge?: string | number; immutable?: boolean }`, cùng nghĩa với tuỳ chọn của `express.static`). Mỗi request:
1. Không phải `GET` hay `HEAD`: `next()`.
2. Đường dẫn: `decodeURIComponent(req.path)` trong `try` (lỗi thì `next()`); kết thúc bằng `/` thì thêm `index.html` (giống tuỳ chọn `index` mặc định của `express.static`, nên `/` và `/?room=abc` ra `/index.html`). Tra trong danh mục; không có: `next()` (không đụng header gì; ảnh, file < 1 KiB, `/whoami`... đi thẳng như cũ). Vì chỉ tra khoá có sẵn trong danh mục, không thể đi ra ngoài `dir` (`/../x` không bao giờ là khoá).
3. Có trong danh mục: `res.vary("Accept-Encoding")` **trước mọi nhánh**, để cả câu trả lời file gốc (cho trình duyệt không nhận nén, hay request có Range) cũng mang `Vary`, nên cache trung gian không trả nhầm bản nén cho người không nhận được.
4. Có header `Range`: `next()`. `express.static` trả 206 trên byte của file gốc như hiện nay. Không ai tải script bằng Range; làm vậy thì Range luôn tính trên nội dung thật, không phải trên byte nén.
5. `pickEncoding(req.headers["accept-encoding"], encodings)`; `null` thì `next()`.
6. Phục vụ bản nén:
   - `res.setHeader("Content-Encoding", encoding)`;
   - `res.type(extname(path))`: cùng `mime.contentType` mà `send` dùng cho file gốc, nên Content-Type y hệt (`send` không ghi đè Content-Type đã đặt);
   - `res.sendFile(path + ENCODING_SUFFIX[encoding], { root: dir, maxAge: cache.maxAge ?? 0, immutable: cache.immutable ?? false, acceptRanges: false }, callback)`.
   - `send` tự đặt: Content-Length = cỡ file nén; ETag yếu từ cỡ và mtime của file nén; Last-Modified; Cache-Control giống hệt `express.static` cùng tuỳ chọn; trả 304 khi `If-None-Match`/`If-Modified-Since` khớp (lúc đó `send` tự gỡ Content-Encoding, Content-Length; Vary vẫn còn); HEAD chỉ gửi header (Content-Length vẫn là cỡ bản nén).
   - `acceptRanges: false`: không quảng cáo `Accept-Ranges: bytes` cho byte nén (Range đã rẽ sang file gốc ở bước 4).
7. `callback(err)`: không lỗi hoặc `res.headersSent` thì thôi; lỗi `ECONNABORTED` (khách huỷ) thì thôi; lỗi khác (ví dụ `ENOENT`: file nén bị xoá sau khi khởi động) thì `res.removeHeader("Content-Encoding")`, `res.removeHeader("Content-Type")` rồi `next()`, để `express.static` trả file gốc hoặc 404. (Có listener lỗi nên `send` chuyển lỗi cho callback, không tự xoá header hay gửi trang lỗi.)

**ETag khác nhau cho từng biểu diễn:** ETag của `send` là `W/"<cỡ hex>-<mtime hex>"`. Luật giữ bản nén (Thiết kế 2) bảo đảm gốc, br, gz luôn khác cỡ, nên ba ETag luôn khác nhau mà không cần tự tính ETag hay stat thêm. Cache có `If-None-Match` của bản gz mà xin br thì nhận 200 đầy đủ, không nhận 304 sai.

**Gắn vào app:** `serveClient(app, dir): number` (trả số file có bản nén, để log):

```
const BUILD_CACHE = { immutable: true, maxAge: "1y" }
app.use("/build", precompressed(join(dir, "build"), BUILD_CACHE), express.static(join(dir, "build"), BUILD_CACHE))
app.use(precompressed(dir, {}), express.static(dir))
```

Một hằng `BUILD_CACHE` dùng cho cả hai middleware của `/build`, nên bản nén và bản gốc không thể lệch Cache-Control. Middleware gốc `/` quét cả `build/`; vô hại (request `/build/*` gần như luôn được mount `/build` trả lời trước), không cần loại.

**Service worker (không phải sửa luật chạy, chỉ kiểm):**
- Trình duyệt tự gắn `Accept-Encoding` và tự giải nén ở tầng mạng; `fetch()` trong worker nhận nội dung đã giải nén. `precacheAll` và `cacheFirst`/`networkFirst` cất `Response` đã giải nén vào Cache Storage, vẫn mang header Content-Encoding, Content-Length của bản nén. Đó là cách mọi trang chạy sau CDN nén vẫn làm; trình duyệt không dùng lại các header đó để giải nén lần nữa.
- `Vary: Accept-Encoding` và Cache Storage: `cache.match(key)` so các header trong `Vary` giữa request đã cất và request tra. Cả hai đều là `Request` tạo từ chuỗi (`cache.put(urls[i], r)`, `cache.match(key)` với `key` là đường dẫn), không cái nào có header `Accept-Encoding` (trình duyệt thêm nó ở tầng mạng, không vào `Request`), nên vẫn khớp. Chỉ `Vary: *` mới làm hỏng; ta không bao giờ gửi `*`.
- `storable()` chỉ cần 200 và không chuyển hướng: bản nén là 200 thường.
- `/whoami`, `/healthz`, `/matchmake` không có file nên middleware `next()` ngay; worker vẫn bỏ qua chúng như cũ.
- Phòng hờ: `precacheUrls` bỏ mọi đường dẫn kết thúc bằng `.br` hoặc `.gz`. Với thứ tự build ở Thiết kế 2 thì lúc tính precache chưa có file nén, nhưng nếu ai đổi thứ tự thì worker sẽ tải thêm khoảng 500 kB file nén vô ích ở lần cài. Đổi `swLogic.ts` làm phiên bản worker đổi một lần (cache mới một lần): chấp nhận.

### 5. Route HTTP tách khỏi `index.ts` (`packages/server/src/http.ts`)

`installRoutes(app: Express, options: { clientDist: string; worldSettings: WorldGuardSettings }): number | null` chứa đúng thân hàm `express: (app) => { ... }` hiện nay, theo đúng thứ tự: `/healthz`, `/whoami` (đọc `options.worldSettings.trustProxy` mỗi request như cũ), rồi `serveClient` nếu `existsSync(clientDist)`. Trả số file có bản nén, hoặc `null` khi không có `dist` (chạy dev chưa build: không phục vụ client, như hiện nay).

`index.ts` chỉ còn: `express: (app) => { served = installRoutes(app, { clientDist, worldSettings }); }`, `guardWorldCreation` sau `listen()` như cũ, và log. Log khi phục vụ client (tiếng Anh như các dòng log khác):
- có bản nén: `Serving web client from <dist> (16 files precompressed)`;
- không có: `Serving web client from <dist> (no precompressed files: build with npm run build)`.

Dòng "Mở game trên máy này" và địa chỉ LAN giữ nguyên.

### 6. Điện thoại và bàn phím

Không có giao diện mới, không chữ mới cho người chơi. Người chơi chỉ thấy sảnh mở nhanh hơn; nút "Tải lại" và hẹn giờ `LOBBY_SLOW_MS` 15 s của T15 giữ nguyên (biên rộng hơn, như T15 đã dự kiến).

## Kế hoạch triển khai

1. **`scripts/precompressLib.mjs`** (mới; chú thích đầu file tiếng Anh: dùng làm gì, vì sao chạy sau `vite build`):
   - export `COMPRESSIBLE_EXTENSIONS`, `MIN_BYTES`, `MAX_RATIO`, `shouldCompress(relPath, size)`, `keepVariants(rawSize, brSize, gzSize)` → `{ br: boolean, gzip: boolean }`, `async precompressDir(dir)` → `{ files, rawBytes, brBytes, gzBytes }` (`brBytes`/`gzBytes` cộng cỡ bản được giữ; file không có bản đó thì cộng cỡ gốc, để con số là "byte qua mạng nếu khách nhận br/gzip"), `formatSummary(summary)` → dòng log.
   - Đúng luật Thiết kế 2. JSDoc cho mỗi export.
2. **`scripts/precompress.mjs`** (mới): đọc `process.argv[2]` (thiếu hoặc không phải thư mục: in lỗi, `process.exit(1)`), gọi `precompressDir`, in `formatSummary`; lỗi thì in và thoát mã 1 (build hỏng thay vì ra `dist` nửa vời).
3. **`packages/client/package.json`**: `"build": "vite build && node ../../scripts/precompress.mjs dist"`. Không đổi `package.json` gốc.
4. **`packages/client/src/pwa/swLogic.ts`**: trong `precacheUrls`, bỏ đường dẫn kết thúc bằng `.br` hoặc `.gz` (cạnh điều kiện `.map`); cập nhật JSDoc ("compressed copies excluded").
5. **`packages/server/src/contentEncoding.ts`** (mới): `Encoding`, `ENCODINGS`, `ENCODING_SUFFIX`, `parseAcceptEncoding`, `pickEncoding` đúng Thiết kế 3. Không import Express hay `node:fs`.
6. **`packages/server/src/webClient.ts`** (mới): `StaticCacheOptions`, `BUILD_CACHE`, `findPrecompressed`, `precompressed`, `serveClient` đúng Thiết kế 4. Chú thích tiếng Anh nói rõ: vì sao Vary đặt trước mọi nhánh, vì sao Range rẽ sang file gốc, vì sao ETag luôn khác (luật build), vì sao danh mục chỉ đọc lúc khởi động.
7. **`packages/server/src/http.ts`** (mới): `installRoutes` đúng Thiết kế 5.
8. **`packages/server/src/index.ts`**: dùng `installRoutes`; bỏ import không còn dùng (`existsSync` vẫn cần nếu log dùng; `noUnusedLocals` phải sạch); log như Thiết kế 5. `guardWorldCreation(server, worldSettings)` giữ nguyên chỗ (sau `listen()`).
9. **Test** (mục Test).
10. **`tests/e2e/pwa.spec.ts`**: thêm bước kiểm nén (mục Test, E2E).
11. **Đo** (mục Đo) và ghi bảng kết quả vào `PROGRESS.md`.
12. **Tài liệu** (mục Tài liệu).

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`: không đụng lưu game, hồ sơ cũ không ảnh hưởng.
- HTTP: thêm header `Content-Encoding` và `Vary: Accept-Encoding` cho file chữ ≥ 1 KiB của client. Client không cần sửa gì: trình duyệt tự giải nén.
- Service worker: phiên bản đổi một lần (do `swLogic.ts` đổi), người chơi tải cache mới một lần ở lần mở kế tiếp; không mất dữ liệu.

## Test

**Unit, `scripts/precompressLib.test.mjs`** (mới):
- `shouldCompress`: `build/a.js` 2000 B có; `index.html`, `x.webmanifest`, `a.JSON` (hoa) có; `a.png`, `a.webp` không; `a.js` 1023 B không, 1024 B có; `a.js.br`, `a.js.gz` không; `.hidden/a.js`, `build/.a.js` không.
- `keepVariants`: 1000/950/950 → không giữ gì (> 90%); 1000/200/300 → cả hai; 1000/300/300 → chỉ gz (br không nhỏ hơn hẳn); 1000/400/300 → chỉ gz; 1000/200/950 → chỉ br; biên đúng 900 → giữ.
- `precompressDir` trên thư mục tạm (`mkdtempSync(join(tmpdir(), ...))`, xoá trong `afterEach` bằng `rmSync(..., { recursive: true, force: true })` chỉ trên thư mục tạm đó): file js lặp lại 5 KB, html 3 KB, png ngẫu nhiên 5 KB, js 500 B, `build/sub/c.json`, dotfile `.env.js`:
  - có `.br`/`.gz` đúng cho js, html, json lồng; không có cho png, file nhỏ, dotfile;
  - `brotliDecompressSync`/`gunzipSync` ra đúng byte gốc;
  - chạy lần hai: cùng tập file, không có `.br.br`/`.gz.gz`, nội dung giống hệt;
  - một `.br` cũ của file không còn đủ điều kiện (ví dụ file bị thu nhỏ còn 500 B) bị xoá;
  - kết quả `{ files, rawBytes, brBytes, gzBytes }` khớp cỡ file thật; `formatSummary` ra một dòng.

**Unit, `packages/client/src/pwa/swLogic.test.ts`:** thêm `build/index-A.js.br`, `build/index-A.js.gz`, `index.html.br` vào danh sách của test "lists the page, the manifest and the hashed files, sorted"; kết quả không đổi.

**Unit, `packages/server/src/contentEncoding.test.ts`** (mới): mọi dòng của bảng ở Thiết kế 3; thêm vài ca trực tiếp cho `parseAcceptEncoding` (khoảng trắng, mục rỗng `gzip,,br`, `x-gzip`, q sai bị bỏ, lần đầu thắng).

**Tích hợp, `packages/server/src/webClient.test.ts`** (mới): `express()` + `serveClient(app, tmp)` + `app.listen(0, "127.0.0.1")`, đóng trong `afterAll`. Thư mục tạm dựng sẵn trong `beforeAll`:
- `index.html` (≥ 3 KB chữ), `build/app-abc123.js` (≥ 5 KB chữ lặp), `build/tiny.js` (300 B, không có bản nén), `assets/pic.png` (byte ngẫu nhiên);
- bản `.br`/`.gz` cho `index.html` và `build/app-abc123.js` ghi **trực tiếp trong test** bằng `brotliCompressSync`/`gzipSync` (không gọi script build: test này kiểm server, độc lập với luật build).

Gửi request bằng `node:http` (`http.request`), **không** dùng `fetch`: `fetch` của Node tự gửi `Accept-Encoding` và tự giải nén, nên không thấy byte thật trên dây. Helper `rawGet(path, headers, method = "GET")` → `{ status, headers, body: Buffer }`.

Các ca:
1. `GET /build/app-abc123.js`, `accept-encoding: gzip, deflate, br, zstd` → 200; `content-encoding: br`; `vary` chứa `Accept-Encoding`; `content-length` = cỡ file `.br` = `body.length`; `brotliDecompressSync(body)` bằng byte gốc; `content-type` bằng Content-Type của câu trả lời file gốc (ca 3; so với nhau, không viết cứng); `cache-control: public, max-age=31536000, immutable`; không có `accept-ranges`.
2. Cùng file, `accept-encoding: gzip` → `content-encoding: gzip`; `gunzipSync(body)` bằng byte gốc; Content-Length đúng.
3. Cùng file, không có `accept-encoding` → không có `content-encoding`; `vary` vẫn chứa `Accept-Encoding`; `accept-ranges: bytes`; body bằng byte gốc; cùng Cache-Control như ca 1.
4. ETag của ca 1, 2, 3 có đủ và đôi một khác nhau.
5. `If-None-Match` = ETag br, cùng `accept-encoding: br` → 304, body rỗng, không `content-encoding`. `If-None-Match` = ETag br nhưng `accept-encoding: gzip` → 200 gzip.
6. `HEAD` với `accept-encoding: br` → 200, `content-encoding: br`, `content-length` = cỡ `.br`, body rỗng.
7. `Range: bytes=0-9` với `accept-encoding: br` → 206, không `content-encoding`, `content-range: bytes 0-9/<cỡ gốc>`, body = 10 byte đầu của file gốc, `vary` chứa `Accept-Encoding`.
8. `GET /`, `GET /?room=abc`, `GET /index.html` với `accept-encoding: br` → br, giải nén bằng `index.html` gốc, `content-type` bắt đầu bằng `text/html`, `cache-control: public, max-age=0`.
9. `GET /build/tiny.js` và `GET /assets/pic.png` với `accept-encoding: br` → không `content-encoding`, không có `Vary` (không có bản nén), body bằng gốc.
10. `accept-encoding: identity;q=1, br;q=0.5` → file gốc.
11. `POST /build/app-abc123.js` → không phải 200 và không có `content-encoding`.
12. `GET /build/missing.js` → 404; `GET /build/..%2f..%2fetc%2fpasswd` → không phải 200.
13. Xoá `build/app-abc123.js.br` sau khi server đã chạy, `accept-encoding: br` → 200, không `content-encoding` (đường `ENOENT` rẽ về file gốc), body bằng gốc. (Làm ca này cuối, hoặc dùng một file riêng chỉ cho ca này.)
14. Một app thứ hai trên thư mục không có bản nén nào: `serveClient` trả 0; `GET /build/app-abc123.js` với `br` không có `content-encoding` và không có `Vary` (y như `express.static` trơn).

**Tích hợp, `packages/server/src/http.test.ts`** (mới), dựng giống `worldLimits.test.ts` khối "creating worlds over HTTP": `defineServer({ rooms: { [ROOM_NAME]: defineRoom(GameRoom) }, greet: false, gracefullyShutdown: false, express: (app) => { installRoutes(app, { clientDist: tmp, worldSettings }) } })`, `listen(0, "127.0.0.1")`, rồi `guardWorldCreation(server, worldSettings)`; dọn bằng `ColyseusTestServer` như file kia. `tmp` là thư mục tạm có `index.html` + `.br`.
- `GET /whoami` với `accept-encoding: gzip, deflate, br` → 200, `text/plain`, không `content-encoding`, body là `127.0.0.1` (trustProxy 0). Đổi `worldSettings.trustProxy = 1` và gửi `X-Forwarded-For: 203.0.113.7` → body `203.0.113.7`.
- `GET /healthz` → `ok`, không `content-encoding`.
- `GET /` với `br` → `content-encoding: br`.
- `POST /matchmake/create/<ROOM_NAME>` (body `{}`, như helper `post` của `worldLimits.test.ts`) → 200 có `roomId`: Colyseus vẫn trả lời `/matchmake` khi có middleware tĩnh và guard. (Phòng đầu tiên sinh thế giới, tốn vài giây như `worldLimits.test.ts`; đặt timeout đủ.)
- `installRoutes` với `clientDist` không tồn tại → trả `null`; `GET /` → 404; `/whoami` vẫn chạy (một app Express trơn là đủ cho ca này).

`worldLimits.test.ts` không đổi và phải còn xanh.

**E2E:**
- Playwright chạy game trên **Vite dev** (`baseURL` 5173), không đi qua Express tĩnh, nên `multiplayer.spec.ts` và `rejoin.spec.ts` **không bị ảnh hưởng** (và không được sửa `multiplayer.spec.ts`). T16 sau này chuyển e2e sang bản build; khi đó các test đó tự đi qua bản nén.
- **Ngoại lệ: `tests/e2e/pwa.spec.ts` chạy trên bản build ở 2567** (`webServer` chạy `npm run build && npm run start`), nên từ nay worker cài và tải lại bằng bản nén. Test 1 phải còn xanh nguyên vẹn: đó chính là kiểm tra e2e rằng nén không làm hỏng service worker (precache, cache-first khi tải lại, `/whoami` không qua worker, vào thế giới được).
- Thêm vào test 1, ngay sau bước (b) (trang đã tải lần đầu từ mạng): bước `(g) the lobby's scripts come compressed`. Với chunk entry (đường dẫn lấy từ `script[type=module][src]` như bước (d)), đọc `performance.getEntriesByName(<url tuyệt đối>)[0]` trong trang và kiểm `encodedBodySize > 0` và `encodedBodySize * 2 < decodedBodySize`. Không kiểm tên encoding: Chrome có thể chỉ nhận gzip trên `http://localhost` (Rủi ro); cả gzip lẫn br đều nhỏ hơn một nửa. Ghi chú trong test: kiểm tra này để chắc `npm run build` thật sự tạo bản nén và server thật sự gửi nó.
- Chạy cả `npm run test:e2e` như thường lệ.

## Đo (cách của T15, Thiết kế 3)

Script đo để trong scratchpad, không commit. Tester (hoặc coder) chạy:

1. **Trước:** chạy `npx vite build` trong `packages/client` (build không có bước nén; `emptyOutDir` xoá sạch `dist` cũ). Server mới không thấy bản nén nên trả file gốc, y như trước T43. Chạy server: `PORT=4599 PETGAME_DB=:memory: npm start --workspace=@petgame/server`.
2. **Sau:** `npm run build` (có bước nén), chạy lại server như trên.
3. Mỗi lần: Playwright Chromium (`chromiumLaunchOptions()` từ `scripts/chromium.mjs`), context `serviceWorkers: "block"`, CDP: `Network.enable`, `Network.setCacheDisabled({ cacheDisabled: true })`, `Network.emulateNetworkConditions` với 5 mức của T15 (không giới hạn; 4G tốt 10 Mbps/50 ms; 4G chậm 1,6 Mbps/150 ms; 3G 750 kbps/300 ms; 3G chậm 400 kbps/400 ms; `downloadThroughput` tính bằng byte/giây = kbps × 1000 / 8, `uploadThroughput` cùng giá trị). `goto http://localhost:4599/?quality=low`, đo từ lúc bắt đầu điều hướng tới khi `#join-btn:enabled`.
4. Ghi: tổng `encodedDataLength` của các sự kiện `Network.loadingFinished` trước lúc sảnh sẵn sàng, số file, và `content-encoding` của chunk entry (từ `Network.responseReceived`).
5. Thêm một lượt "sau" chỉ nhận gzip: `Network.setAcceptedEncodings({ encodings: ["gzip"] })` (lệnh CDP thử nghiệm; nếu Chromium không có thì bỏ dòng này, ghi lại).
6. Kiểm thêm bằng tay: `curl -s -o /dev/null -w '%{size_download} %{content_type}\n' -H 'Accept-Encoding: br' http://localhost:4599/build/index-*.js` và với `gzip`, không header.
7. Tắt server cổng 4599 và mọi Chromium khi xong.

Ghi vào `PROGRESS.md` bảng:

| Mạng | Trước: byte, giây | Sau (encoding Chrome chọn): byte, giây | Sau, chỉ gzip: byte, giây |
|---|---|---|---|

kèm thời gian `npm run build` trước và sau (bước nén ước thêm 2-3 s).

Dự kiến: 3G chậm từ khoảng 20 s xuống ≤ 8 s; byte của 11 file sảnh từ khoảng 1 MB xuống ≤ 330 kB.

## Tài liệu

- `docs/architecture.md`, mục `packages/server`: thay dòng `index.ts` (giờ gọi `installRoutes` của `http.ts`), thêm `http.ts` (`installRoutes`: `/healthz`, `/whoami`, client tĩnh), `webClient.ts` (`findPrecompressed`, `precompressed`, `serveClient`, `BUILD_CACHE`; luật Vary, Range, ETag, danh mục đọc lúc khởi động), `contentEncoding.ts` (`parseAcceptEncoding`, `pickEncoding`, ưu tiên br rồi gzip, identity chỉ thắng khi ghi rõ q lớn hơn).
- `docs/architecture.md`, mục PWA: `precacheUrls` bỏ `.br`/`.gz`; một câu: build client chạy `scripts/precompress.mjs` sau `vite build` (sau khi `sw.js` đã sinh); worker cất nội dung đã giải nén, `Vary: Accept-Encoding` không cản `cache.match` theo chuỗi.
- `docs/deploy.md`, mục "Ghi chú": server gửi bản nén sẵn (`.br`/`.gz` do `npm run build` tạo); kiểm sau deploy: `curl -sI -H 'Accept-Encoding: br' https://<app>/ | grep -i content-encoding` phải ra `br`; tách client lên CDN thì upload cả `.br`/`.gz` hoặc để CDN tự nén (CDN thường tự nén); build bằng `vite build` trơn vẫn chạy, chỉ không nén.
- `docs/design/multiplayer.md` (dòng "Vì sao chờ 15 giây" và dòng "Tải lại trang rồi bấm Vào chơi" ở mục giữ chỗ): thay "khoảng 960 kB (server chưa nén)" và các số 5,3/11,3/20,7 s bằng số đo mới của mục Đo (ghi cả số cũ "trước T43" trong ngoặc). Lý do giữ 15 s và 60 s vẫn đúng (chỉ thêm biên), không đổi hằng số.

## Tiêu chí hoàn thành

- [ ] `package.json` của mọi workspace không có dependency mới; `package-lock.json` không đổi.
- [ ] `npm run build` tạo `.br` và `.gz` cạnh các file `.js`, `.html`, `.json` ≥ 1 KiB trong `dist` (kể cả `sw.js`, `assets/*/index.json`), không tạo cho `.png`/`.webp`/file < 1 KiB; in một dòng tóm tắt. Chạy lại script trên cùng `dist` không đổi gì.
- [ ] `dist/sw.js` (danh sách precache) không chứa đường dẫn `.br`/`.gz`.
- [ ] `parseAcceptEncoding`/`pickEncoding` đúng mọi dòng bảng Thiết kế 3, có test.
- [ ] Server: bản nén có Content-Encoding đúng, `Vary: Accept-Encoding` (cả câu trả lời file gốc của file có bản nén), Content-Length = cỡ bản nén, Content-Type và Cache-Control y như file gốc, ETag khác nhau giữa gốc/br/gz, 304 đúng, HEAD đúng, Range trả 206 trên file gốc, file nén mất thì rẽ về file gốc; giải nén ra đúng byte gốc. Tất cả có trong `webClient.test.ts`.
- [ ] `/whoami` (cả qua `X-Forwarded-For` với trustProxy 1), `/healthz` không nén và đúng; `/matchmake/create` vẫn 200 khi có guard và middleware (`http.test.ts`); `worldLimits.test.ts` xanh, không sửa.
- [ ] Không có `dist`: server chạy, không phục vụ client, `/whoami` vẫn chạy.
- [ ] `index.ts` chỉ gọi `installRoutes`; log nói số file có bản nén.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` xanh; `pwa.spec.ts` có bước (g) và xanh; `multiplayer.spec.ts`, `labelLayout.ts`, `labelLayout.test.ts` không bị đụng.
- [ ] Bảng đo trước/sau trong `PROGRESS.md` theo mục Đo; sảnh ở 3G chậm ≤ 8,5 s với encoding Chrome chọn; byte của sảnh giảm ít nhất 2,5 lần.
- [ ] Tài liệu cập nhật đúng mục Tài liệu.
- [ ] Chú thích code tiếng Anh, JSDoc cho mọi export mới; không chữ mới cho người chơi.

## Rủi ro, câu hỏi mở

Không có mục CHẶN: không đổi giao thức game hay dữ liệu đã lưu, không thêm chi phí, không xoá tính năng.

- **Chrome có thể không gửi `br` trên HTTP thường.** Chrome trước đây chỉ quảng cáo brotli qua HTTPS. Trên `http://192.168...` (chơi qua Wi-Fi bằng `npm run play`) có thể chỉ nhận `gzip, deflate`, vì vậy phải có cả bản `.gz` (sảnh vẫn ~316 kB thay vì ~271 kB). Bản deploy chạy HTTPS nên nhận br. Lượt đo ghi lại encoding Chrome chọn trên `http://localhost`; bước e2e (g) cố ý không kiểm tên encoding.
- **Build lại khi server đang chạy:** danh mục bản nén đọc lúc khởi động. File băm mới được gửi không nén tới khi khởi động lại; file cũ bị xoá thì đường `ENOENT` rẽ về `express.static` (404 như hiện nay); `index.html.br` ghi đè tại chỗ nên vẫn đúng nội dung mới. `npm run play` và Docker luôn build trước khi chạy, nên không gặp trong thực tế.
- **Proxy trước server** (Fly, Render) chuyển nguyên Content-Encoding đã có, không nén lần hai. Kiểm sau deploy bằng `curl` (ghi trong `docs/deploy.md`).
- **Cỡ trùng nhau làm ETag trùng:** đã loại bằng luật build (≤ 90% và br < gz). Nếu ai sửa luật build mà bỏ điều kiện đó, hai biểu diễn có thể chung ETag; test ca 4 của `webClient.test.ts` chỉ kiểm trên fixture, nên chú thích ở `keepVariants` phải nói rõ ràng buộc này.
- **Thời gian build** thêm khoảng 2-3 s (brotli mức 11), tăng theo cỡ bundle. Nếu sau này bundle lớn nhiều lần, có thể hạ xuống mức 9 (708 kB → 205 kB trong 66 ms).
- **Service worker:** đổi `swLogic.ts` làm phiên bản worker đổi một lần; người chơi tải lại cache một lần. Không có rủi ro nào khác đã biết; e2e `pwa.spec.ts` chạy trên bản nén kiểm điều này.
- **Sau này (không thuộc T43):** zstd (Chrome) khi Node có zstd ổn định; `Cache-Control` cho `/assets/*` (tên cố định, hiện luôn kiểm lại) là việc riêng nếu muốn.

## Đề xuất cho `TASKS.md`

- Ghi chú cho **T16**: khi chuyển e2e sang bản build, mọi test đi qua bản nén; giữ bước (g) của `pwa.spec.ts` và có thể gom helper `rawGet` nếu cần kiểm header.
- Không có việc mới bắt buộc. Tuỳ chọn (P3): "Cache dài cho `/assets/*`" (cần tên có băm hoặc phiên bản; ảnh nhân vật, thiên nhiên tải lại mỗi lần kiểm ETag).
