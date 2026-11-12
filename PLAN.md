# PLAN: T42 Vào thế giới hỏng sau khi gỡ sảnh thì màn hình trống

Đọc code ở HEAD `2d3bd0f` (sau T23). Kèm ghi chú của T42 trong `TASKS.md` và Rủi ro 5 của kế hoạch T23 (`git show 6f49e71:PLAN.md`).

## Mục tiêu

Hiện tại `enter()` trong `packages/client/src/main.ts` làm theo thứ tự: chờ `connect()` và `assets` → `lobby.remove()` → `startGame()` → `Game.create()`. Có ba lỗi:

1. **Màn hình tối, không chữ, không nút.** Nếu `Game.create` hỏng (thường nhất là PixiJS không tải được chunk `browserAll-*.js` mà `app.init` nạp động, ví dụ mạng chập chờn hoặc tab cũ sau khi server đổi bản), sảnh đã bị gỡ. `catch` ghi thẻ lỗi vào `#join-status` nằm trong sảnh đã gỡ, nên người chơi chỉ thấy nền `#1b2a1b`.
2. **Chữ lỗi sai.** Mọi lỗi không phải của SDK (không có `code` số) bị `joinFailure` xếp thành `"unreachable"`, nên một lỗi vẽ/tải hình cũng báo "Không kết nối được server / Kiểm tra mạng rồi bấm Thử lại". Có một đường tái hiện thật: `assets/characters/index.json` trả về `null` (proxy, CDN lỗi) thì `loadDollArt` ném `TypeError` ở `index.bodyHeight` (nằm ngoài `try`), `assets` bị từ chối, sảnh báo "Không kết nối được server". Bấm Thử lại thì vẫn vậy mãi, vì `assets` là một promise dùng cho cả trang.
3. **Người chơi ma.** Khi `assets` hoặc `Game.create` hỏng, phòng đã vào rồi nhưng không ai rời. `ConnectionWatch` vẫn ping nên server giữ người chơi đó (đứng yên giữa bản đồ, chiếm một trong 5 chỗ) đến khi đóng tab. Bấm Thử lại thì vào thêm lần nữa (server thay phiên cũ theo token, không thành hai bản, nhưng vẫn là một phiên treo).

Sau T42:
- **Sảnh chỉ biến mất khi thế giới đã vẽ xong.** Trong lúc dựng thế giới, sảnh vẫn hiện với nút "Đang vào..." (thay cho màn hình tối hiện nay).
- **Dựng hỏng thì sảnh hiện thẻ lỗi đúng nguyên nhân** (cùng kiểu thẻ T15/T23) với một nút **Tải lại** có sẵn focus. Thiếu file thì "Không tải được game / Kiểm tra mạng rồi bấm Tải lại."; lỗi khác thì "Không mở được game / Trình duyệt gặp lỗi khi mở thế giới…".
- **Rời phòng ngay** (rời chủ động), nên bạn bè không thấy người chơi ma và chỗ trống lại ngay. Địa chỉ được ghi theo luật T23 trước khi rời, nên Tải lại về đúng thế giới của bạn bè, còn chơi một mình thì ra thế giới mới.
- **Ảnh hỏng không làm hỏng việc vào game.** Ba hàm tải ảnh không bao giờ ném lỗi vì file chỉ mục (`index.json`) sai: thiếu ảnh thì vẽ bằng code như đã định.

Vì sao cần: trên điện thoại mạng chập chờn và tab cũ sau khi deploy là chuyện thường. Màn hình tối không nút là ngõ cụt (người chơi phải tự đoán là cần tải lại), còn chữ "Không kết nối được server" khiến họ đi kiểm tra mạng trong khi lỗi nằm chỗ khác.

## Phạm vi

**Làm:**
- `packages/client/src/main.ts`: đổi thứ tự (gỡ sảnh sau `Game.create`), chờ cả hai việc bằng `Promise.allSettled`, xử lý "vào được phòng nhưng không dựng được game": dọn `#game`, ghi địa chỉ, rời phòng, hiện thẻ, khoá sảnh.
- `packages/client/src/ui/joinStatus.ts`: thêm nút Tải lại vào `JoinCard`, kiểu `StartFailure`, hàm thuần `startFailure(err)` và `startCard(failure)`; unit test.
- `packages/client/src/game/assetIndex.ts` (mới): `fetchIndex(url)` đọc file chỉ mục, không bao giờ ném lỗi; dùng trong `palSprites.ts`, `art/pictures.ts`, `art/doll.ts`; unit test.
- `packages/client/src/game/Game.ts`: `Game.create` dừng và huỷ PixiJS nếu `init` hỏng giữa chừng.
- `packages/client/index.html`: nút `#join-reload-btn` trong `#join-status`; `#lobby` có `z-index` trên mọi lớp của game.
- `tests/e2e/multiplayer.spec.ts`: `waitForWorld` chờ sảnh biến mất; hai test e2e mới.
- `docs/architecture.md` (coder sửa: game-designer không được sửa file ngoài `docs/design/`); `docs/design/multiplayer.md` (đã sửa trong bước thiết kế này).

**KHÔNG làm:**
- Không sửa server, `schema.ts`, `messages.ts`, `Profile`. Không thêm hook `debug:*` hay tham số URL cho test.
- Không đổi bộ canh tải T15 (script inline, `#load-status`, `#reload-btn`, `petgame:lobby-ready`). Lỗi ở T42 xảy ra sau khi sảnh sẵn sàng, nên bộ canh đó đã thôi nghe (`removeEventListener` lúc ready). Không dùng lại `#load-status` cho T42.
- Không thêm "Thử lại tại chỗ" khi dựng game hỏng: `assets` là promise một lần của trang, `Game` dựng dở để lại listener trên `window` (bàn phím, `pointerdown`), nên chỉ tải lại trang mới sạch. Lý do ở Thiết kế 3.
- Không xử lý lỗi xảy ra **sau** khi game đã chạy (ngoại lệ trong `frame()`, mất WebGL context): việc riêng, đề xuất ở cuối.
- Không đổi `joinFailure` (lỗi khi vào phòng vẫn dùng bốn thẻ T23), `ConnectionWatch`, `ConnectionOverlay`, `lobbyUrl`.
- Không sửa `playwright.config.ts`, không tăng timeout chung, không `retries`, không `waitForTimeout`.

## Thiết kế

### 1. Thứ tự mới khi bấm "Vào chơi"

1. Nút thành "Đang vào..." (như cũ).
2. Cùng lúc: vào phòng (`connect`, gắn `ConnectionWatch` ngay khi vào được) và chờ ảnh (`assets`). Chờ **cả hai xong** (`Promise.allSettled`), kể cả khi một bên hỏng trước, để không bao giờ bỏ lại một phòng đã vào mà không ai giữ.
3. Vào phòng hỏng → thẻ lỗi T23 như cũ (`joinFailure`, `joinCard`), có Thử lại. Không đổi gì.
4. Vào phòng được nhưng ảnh hỏng, hoặc `Game.create` hỏng → **"không mở được game"** (mục 3).
5. `Game.create` xong → **gỡ sảnh**, rồi mới gán `__petgame.game` (e2e chờ `game.frames`, nên khi test thấy game thì sảnh đã đi).

Trong bước 5, sảnh vẫn che `#game` trong lúc PixiJS, HUD, bảng được dựng bên dưới. Phải nâng `#lobby` lên trên: `#game` không tạo stacking context, nên `.hud` (z 2), `.labels` (z 1), `.net-overlay` (z 6) hiện **trên** sảnh nếu sảnh để `z-index: auto`. Đặt `#lobby { z-index: 10; }`.

Rớt mạng trong lúc dựng: màn che kết nối (đã gắn trong `startGame` trước `Game.create`) nằm dưới sảnh, sảnh đi thì nó hiện. Như vậy là đủ: khoảng này ngắn (vài trăm ms trên máy thật).

### 2. Phân loại nguyên nhân: `startFailure(err)`

| Loại | Khi nào | Nhận biết |
|---|---|---|
| `"download"` | thiếu một phần của game: chunk động của PixiJS, file của Vite không tải được (mất mạng, tab cũ sau khi server đổi bản và file băm cũ đã mất) | `err` là object có `message` (string) khớp `/dynamically imported module\|module script failed\|Failed to fetch\|NetworkError\|Load failed/i`. Chrome: "Failed to fetch dynamically imported module: …"; Firefox: "error loading dynamically imported module: …"; Safari: "Importing a module script failed." / "Load failed". |
| `"broken"` | mọi lỗi khác (trình duyệt không vẽ được, lỗi code) | còn lại, kể cả `err` không phải object |

Hằng regex đặt tên `DOWNLOAD_ERROR` trong `joinStatus.ts`, JSDoc ghi từng trình duyệt.

### 3. Thẻ "không mở được game"

Cùng thẻ `#join-status` (`.lobby-alert.failed`) của T23, `role="alert"`. Chỉ có **một nút: Tải lại** (`#join-reload-btn`, `.lobby-action`, nút chính, có focus: Enter hoặc Space là tải lại; chạm được ≥ 44×44). Thử lại và Tạo thế giới mới ẩn.

| Loại | Tiêu đề | Dòng giải thích |
|---|---|---|
| `download` | Không tải được game | Kiểm tra mạng rồi bấm Tải lại. |
| `broken` | Không mở được game | Trình duyệt gặp lỗi khi mở thế giới. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt. |

Chữ cố ý giống thẻ T15 ("Không tải được game", "Kiểm tra mạng rồi bấm Tải lại.") vì cùng nguyên nhân và cùng cách chữa.

Khi thẻ này hiện:
- Ô tên và ô ngoại hình (`#name`, `#look`) **ẩn** (như thẻ hỏng của T15), nút "Vào chơi" ẩn. Dòng gợi ý `#room-hint` giữ nguyên (nó vẫn đúng: "Bạn được mời…" hoặc "Quay lại…").
- Trang ở trạng thái "hỏng" (`broken = true`): `enter()` không làm gì nữa (Enter trong form, hay bất cứ đường nào khác, không vào lại được trong trang này).
- `#game` được dọn sạch (`replaceChildren()`): không còn canvas, HUD, màn che kết nối dựng dở.
- **Địa chỉ** theo luật T23 trước khi rời: phòng đang có > 1 người (tính cả mình) thì có `?room=<id>`; đúng 1 người thì bỏ `room`; chưa biết (0, state chưa về) thì giữ nguyên. Vì vậy:
  - được mời hoặc đang chơi cùng bạn bè → Tải lại về đúng thế giới đó;
  - một mình → thế giới đóng khi mình rời, Tải lại mở thế giới mới cùng bản đồ (không gặp thẻ "đã đóng").
- **Rời phòng chủ động** bằng `watch.leave()` (gửi tin rời, server xoá người chơi ngay, không giữ chỗ 20 giây; luật "Rời chủ động" của `multiplayer.md`).
- **Tải lại** = `location.reload()` (giữ mọi tham số, như nút của T15).

Vì sao Tải lại chứ không Thử lại tại chỗ: (a) `assets` là promise của cả trang, đã từ chối thì từ chối mãi; (b) chunk hỏng thường do bản cũ (file băm cũ bị xoá sau deploy), chỉ tải lại trang mới lấy được bản mới; (c) `Game` dựng dở để lại listener trên `window`. Tải lại cũng là cách T15 đã dạy người chơi.

### 4. Ảnh hỏng không chặn việc vào game

Ba hàm `loadPalSprites`, `loadPictures`, `loadDollArt` đã bắt lỗi mạng, nhưng chưa bắt file chỉ mục có JSON không phải object (`null`, mảng, số): `loadPictures` ném ở `Object.entries(null)`, `loadDollArt` ném ở `index.bodyHeight`. Gom việc đọc chỉ mục vào `fetchIndex(url)`: fetch, `res.ok`, `res.json()`, kiểm tra là object thường (không null, không mảng), mọi lỗi → `undefined`. Không có chỉ mục thì như hiện nay: thú, cây, đá vẽ bằng code; nhân vật vẽ theo màu ô (`lookBox` ẩn).

### 5. Bàn phím, cảm ứng, khung hình

- Bàn phím: thẻ hiện thì `#join-reload-btn` có focus; Enter và Space bấm nút. Nút tự bắt Space (`keydown`, `preventDefault`, gọi reload) giống `ConnectionOverlay`, vì nếu `Keyboard` của game đã được dựng trước khi hỏng thì nó chặn Space trên `<button>`.
- Cảm ứng: nút ≥ 44×44 ở điện thoại dọc (390×844), ngang (844×390), desktop (1280×720); thẻ nằm trong khung nhìn (`scrollIntoView` trong `showJoinCard` đã có).

## Kế hoạch triển khai

1. **`packages/client/src/ui/joinStatus.ts`**
   - `JoinCard`: thêm `reload: boolean`; `primary: "retry" | "newWorld" | "reload"`. Cập nhật JSDoc.
   - `joinCard(...)`: mọi nhánh thêm `reload: false` (không đổi chữ).
   - `export type StartFailure = "download" | "broken";` JSDoc: vào được phòng nhưng game không mở được.
   - `const DOWNLOAD_ERROR = /dynamically imported module|module script failed|Failed to fetch|NetworkError|Load failed/i;` JSDoc ghi chữ của từng trình duyệt (mục Thiết kế 2).
   - `export function startFailure(err: unknown): StartFailure`: so theo hình dạng (`typeof err === "object"`, `message` là string), không dùng `instanceof`.
   - `export function startCard(failure: StartFailure): JoinCard`: chữ đúng bảng ở Thiết kế 3; `{ retry: false, newWorld: false, reload: true, primary: "reload" }`.
2. **`packages/client/src/ui/joinStatus.test.ts`**: xem mục Test.
3. **`packages/client/src/game/assetIndex.ts`** (mới)
   - `export async function fetchIndex(url: string): Promise<Record<string, any> | undefined>`: JSDoc "The index.json of an asset folder, or undefined when it is missing, unreadable or not a plain object: the art is then drawn from code. Never throws." Toàn bộ thân trong `try`.
   - `assetIndex.test.ts` cạnh file (stub `fetch` bằng `vi.stubGlobal`).
4. **`packages/client/src/game/palSprites.ts`**: `sheetIndex(folder)` dùng `fetchIndex(...) ?? {}` (bỏ `try` riêng).
5. **`packages/client/src/game/art/pictures.ts`**: `loadPictures` dùng `const index = (await fetchIndex(...)) ?? {}`.
6. **`packages/client/src/game/art/doll.ts`**: `loadDollArt`: `const index = await fetchIndex(`${base}index.json`); if (!index) return false;` (bỏ `try`/`res.ok` riêng). `BODY = typeof index.bodyHeight === "number" ? index.bodyHeight : BODY;`
7. **`packages/client/src/game/Game.ts`**: `Game.create`: bọc `await game.init(resolution)` trong `try`; `catch` gọi `game.abandon()` rồi ném lại. `private abandon()`: JSDoc "Stops what a half-done init left running (the PixiJS ticker and canvas); never throws." Thân: `try { this.stage.app.destroy({ removeView: true }); } catch { /* init stopped before the renderer existed */ }`.
8. **`packages/client/index.html`**
   - Trong `#join-status`, `.lobby-actions` thêm `<button type="button" id="join-reload-btn" class="lobby-action" hidden>Tải lại</button>` (sau hai nút cũ).
   - Sửa chú thích trên form: `#join-status` cũng là thẻ "game không mở được sau khi vào" (T42).
   - CSS `#lobby`: thêm `z-index: 10;` kèm chú thích: "Above the game's layers (labels 1, HUD 2 ... connection screen 6): the world is built under the lobby, which goes once it is drawn (T42)."
9. **`packages/client/src/main.ts`**
   - Lấy thêm `reloadGameBtn = document.getElementById("join-reload-btn") as HTMLButtonElement`, `container = document.getElementById("game")!` (đưa lên đầu file; `startGame` dùng biến này).
   - `showJoinCard`: `reloadGameBtn.hidden = !card.reload`; `quiet` cho cả ba nút theo `primary`; focus nút chính qua bảng `{ retry: retryBtn, newWorld: newWorldBtn, reload: reloadGameBtn }[card.primary]`.
   - `let broken = false;` JSDoc: "The game could not start in this page (it joined, then failed): only a reload helps, so the lobby takes no more joins."
   - `enter()`: `if (joining || broken) return;`. Thay `Promise.all` bằng:
     ```
     const [joined, art] = await Promise.allSettled([connect(...).then(room => ({ room, watch: new ConnectionWatch(room) })), assets]);
     ```
     - `joined.status === "rejected"` → đúng xử lý cũ (`console.error`, `joinFailure`, `dropWorldFromAddress` khi `closed`, nút "Vào chơi", `showJoinCard(joinCard(...))`).
     - Ngược lại: `try { if (art.status === "rejected") throw art.reason; await startGame(room, watch, art.value); } catch (err) { console.error(err); failToStart(room, watch, err); }`.
     - Không còn `lobby.remove()` trong `enter()`. Giữ `finally { joining = false; }`.
   - `function failToStart(room: GameRoom, watch: ConnectionWatch, err: unknown)` (JSDoc: joined but the game could not be shown; leave on purpose so no idle player stays behind for the others, and offer a reload):
     1. `broken = true;`
     2. `container.replaceChildren();`
     3. `const size = room.state.players?.size ?? 0; if (size > 0) setAddress(lobbyUrl(room.roomId, size > 1));`
     4. `watch.leave();` (không ném: `handBack` đã bọc `try`).
     5. `nameInput.hidden = true; lookBox.hidden = true;` (lưu ý: `dollArt` có thể đặt lại `lookBox.hidden` nếu nó xong sau; nó đã xong vì `allSettled` chờ `assets`, nên không sao).
     6. `showJoinCard(startCard(startFailure(err)));`
   - Gắn nút: `reloadGameBtn.addEventListener("click", () => location.reload());` và `keydown` Space (`preventDefault`, `location.reload()`), chú thích lý do như `ConnectionOverlay`.
   - `startGame`: dùng `container` chung; sau `const game = await Game.create(...)`: `lobby.remove();` rồi `(window as any).__petgame.game = game;`. Chú thích: the lobby covers the world while it is built and goes only once it is drawn (T42).
10. **`tests/e2e/multiplayer.spec.ts`**: sửa `waitForWorld`, thêm hằng `PIXI_ENV_CHUNK`, hai test (mục Test).
11. **`docs/architecture.md`**: trong đoạn `main.ts` (dòng "Vào lại thế giới (T23)"), thêm: "**Vào mà game không mở được (T42):** sảnh chỉ bị gỡ sau `Game.create`; `#lobby` z-index 10. Vào phòng được mà `assets` hoặc `Game.create` hỏng thì `failToStart`: dọn `#game`, ghi địa chỉ, `watch.leave()`, thẻ `startCard(startFailure(err))` với nút Tải lại. Chỉ mục ảnh đọc qua `game/assetIndex.ts` (`fetchIndex`, không ném)." Trong danh sách `ui/`/`game/` thêm `assetIndex.ts`.
12. Chạy `npm run typecheck`, `npm test`, `npm run build`, rồi `npx playwright test -g "lobby:"` trước khi giao tester.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, server. Client chỉ dùng tin rời phòng có sẵn (`room.leave(true)` qua `ConnectionWatch.leave`). Hồ sơ lưu không bị ảnh hưởng: server lưu khi người chơi rời như mọi lần rời chủ động.

## Test

**Unit (Vitest, client):**
- `joinStatus.test.ts`:
  - mọi `joinCard` có `reload: false` (thêm vào test "offers only…" hiện có hoặc test mới);
  - `startCard("download")`: tiêu đề "Không tải được game", giải thích chứa "Kiểm tra mạng"; `startCard("broken")`: tiêu đề "Không mở được game", giải thích chứa "cập nhật trình duyệt"; cả hai `[retry, newWorld, reload, primary] = [false, false, true, "reload"]`;
  - test "always points the primary button at an enabled one" chạy cả trên hai `startCard`;
  - `startFailure`: `new TypeError("Failed to fetch dynamically imported module: http://x/browserAll-a1.js")`, `{ message: "error loading dynamically imported module: http://x/a.js" }`, `new TypeError("Importing a module script failed.")`, `new TypeError("Load failed")` → `"download"`; `new TypeError("Cannot read properties of null (reading 'bodyHeight')")`, `new Error("WebGL unsupported")`, `"oops"`, `null`, `undefined`, `{ message: 5 }` → `"broken"`.
- `assetIndex.test.ts` (stub `fetch`, `afterEach(vi.unstubAllGlobals)`): object → trả về object; `res.ok` false → `undefined`; JSON `null`, `[1]`, `5` → `undefined`; JSON hỏng (`res.json` ném) → `undefined`; `fetch` ném (mất mạng) → `undefined`.

**Tích hợp server:** không đổi (server không đổi).

**E2E (`tests/e2e/multiplayer.spec.ts`):**
- `waitForWorld`: kiểm thẻ trước (`#join-status` hiện → ném lỗi kèm chữ như cũ), rồi `"ok"` khi `!document.getElementById("lobby") && __petgame?.room?.state?.players?.size > 0`. Sửa JSDoc: chờ đến khi thế giới đã vẽ và sảnh đã đi.
- Hằng, đặt cạnh `LOBBY_SCRIPT`:
  ```
  /** PixiJS 8 loads this chunk on demand in app.init (renderer init: loadEnvironmentExtensions); nothing in the lobby needs it.
      Vite dev serves it from /node_modules/.vite/deps/, a build from /build/. */
  const PIXI_ENV_CHUNK = /\/browserAll-[\w-]+\.js(\?.*)?$/;
  ```
- **Test A** `"lobby: when the game cannot start after joining, the lobby says why, the world is left at once, and Tải lại gets back in"` (`test.slow()`):
  - Phần 1, desktop, bàn phím, được mời: `host = await new Client(SERVER).create("world", { name: "Host" }); observers.push(host);`. Context mới, `watch(page, "Broken")`, đếm `load`. `let blocked = 0; await page.route(PIXI_ENV_CHUNK, r => { blocked++; return r.abort(); })`. `goto(/?room=<host>&quality=low)`, `enterLobby(page, "Broken")`.
    - `#join-status` hiện, chứa "Không tải được game" và "Kiểm tra mạng"; `#join-reload-btn` có focus; `#retry-btn`, `#new-world-btn`, `#join-btn`, `#name` ẩn; `#lobby` hiện; `expect(blocked).toBeGreaterThan(0)` (chống test rỗng nếu PixiJS đổi tên chunk).
    - `#game canvas` và `.hud` đếm được 0.
    - Đã vào rồi rời: `page.evaluate(() => __petgame.room.roomId)` bằng `host.roomId`; `expect.poll(() => host.state.players.size).toBe(1)` (timeout mặc định 5 s < 20 s giữ chỗ: chứng minh rời chủ động, không phải rớt mạng).
    - Địa chỉ vẫn `room=<host>`, `quality=low`.
    - `#join-reload-btn` ≥ 44×44 ở 844×390, 390×844, 1280×720, và nằm trong khung nhìn (`toBeInViewport()`) ở cả ba.
    - `page.unroute(PIXI_ENV_CHUNK)`; focus lại `#join-reload-btn` (đổi khung hình không mất focus; nếu cần, `focus()` qua locator); `page.keyboard.press("Enter")` → trang tải lại; `enterLobby(page, "Broken")`; `waitForWorld(page)`; `roomId` bằng `host.roomId`; `playerCount(page)` là 2; `loads === 2`.
  - Phần 2, điện thoại dọc (`PHONE_SCREENS[0].options`), cảm ứng, một mình: route chặn `PIXI_ENV_CHUNK` như trên, `goto("/?quality=low")`, `enterLobby(phone, "Solo")`; thẻ "Không tải được game"; lấy `roomId` cũ từ `__petgame.room.roomId`; địa chỉ **không** có `room` (đúng 1 người); `unroute`; `#join-reload-btn` `.tap()`; `enterLobby(phone, "Solo")`; `waitForWorld(phone)`; `roomId` mới khác `roomId` cũ; không có thẻ "đã đóng".
- **Test B** `"lobby: broken picture indexes and missing pictures still let the player in, drawn from code"`: context mới (desktop); `route(/\/assets\/characters\/index\.json(\?.*)?$/, r => r.fulfill({ contentType: "application/json", body: "null" }))`, `route(/\/assets\/nature\/index\.json(\?.*)?$/, … body: "[1]")`, và `route(/\/assets\/pals\//, r => r.abort())` (ba mẫu không chồng nhau). Cả ba route đăng ký trên context **trước** khi mở trang, vì `assets` bắt đầu tải ngay khi script sảnh chạy. `goto("/?quality=low")`; `#look` ẩn sau khi sảnh sẵn sàng (không có phần nhân vật); `enterLobby`; `waitForWorld`; chờ `game.frames > 0`; `#join-status` không có trong DOM (sảnh đã gỡ). Trước T42 test này thất bại với thẻ "Không kết nối được server".
- Các test đang có phải vẫn qua, đặc biệt các test `lobby:` của T15/T23, test cỡ chạm (`expectTouchable(page, "#lobby", …)` chạy trước khi vào), và mọi test dùng `waitForWorld`.

## Tiêu chí hoàn thành

- [ ] Sảnh chỉ bị gỡ sau khi `Game.create` xong; `__petgame.game` được gán sau `lobby.remove()`.
- [ ] `#lobby` có `z-index: 10`; trong lúc dựng thế giới không thấy HUD, nhãn hay màn che kết nối đè lên sảnh.
- [ ] `enter()` chờ `connect` và `assets` bằng `Promise.allSettled`; không còn đường nào để một phòng đã vào mà không bị rời khi game không mở được.
- [ ] Vào phòng hỏng: vẫn bốn thẻ T23 (test T23 vẫn qua, chữ không đổi).
- [ ] Vào được mà `assets`/`Game.create` hỏng: `#game` rỗng; địa chỉ theo luật T23 (>1 người có `room`, 1 người không có, 0 giữ nguyên); `watch.leave()` được gọi; bạn bè thấy số người giảm trong < 5 s.
- [ ] Thẻ dùng `startCard(startFailure(err))`, chữ đúng bảng Thiết kế 3, chỉ có nút Tải lại, nút có focus, Enter/Space/chạm đều tải lại; nút ≥ 44×44 ở ba khung hình.
- [ ] Sau thẻ này, `#name` và `#look` ẩn, `enter()` không vào lại trong cùng trang.
- [ ] `fetchIndex` được dùng ở cả ba hàm tải ảnh; không còn `try`/`res.json()` trùng lặp ở đó; chỉ mục `null`/mảng/hỏng không làm `assets` từ chối.
- [ ] `Game.create` hỏng thì huỷ `app` (best-effort, không ném lỗi thứ hai che lỗi gốc).
- [ ] Unit test mới cho `startFailure`, `startCard`, `fetchIndex`; e2e A và B qua; `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] `docs/architecture.md` cập nhật; `docs/design/multiplayer.md` khớp với hành vi (đã sửa).
- [ ] Chữ hiển thị tiếng Việt, chú thích code tiếng Anh, không số cứng mới ngoài regex có tên.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Tên chunk của PixiJS có thể đổi** khi nâng PixiJS/Vite. Test A đếm số lần route bị gọi (`blocked > 0`) nên sẽ báo rõ thay vì qua rỗng. Đã kiểm ở PixiJS 8.22.0: `AbstractRenderer.init` → `loadEnvironmentExtensions` → `import('./browserAll.mjs')`; Vite dev phục vụ `node_modules/.vite/deps/browserAll-<hash>.js`, bản build có `build/browserAll-<hash>.js`. Trình kết xuất WebGL nằm sẵn trong gói chính, không phải chunk riêng.
2. **Nhận diện "download" theo chữ của lỗi** là heuristics; trình duyệt lạ ra chữ khác thì thành "broken". Hậu quả nhỏ: cả hai thẻ đều có nút Tải lại, chỉ khác dòng giải thích.
3. **`waitForWorld` chặt hơn** (chờ sảnh đi, tức game đã dựng). Test nào trước đây thao tác ngay sau `waitForWorld` mà chưa có game giờ chờ lâu hơn một chút; không test nào được phép thao tác trên sảnh sau `waitForWorld`. Coder chạy cả bộ e2e.
4. **Rớt mạng trong lúc dựng thế giới** bị sảnh che vài trăm ms; màn che hiện ngay khi sảnh đi. Chấp nhận.
5. **`watch.leave()` khi socket đã đóng**: server coi như rớt mạng, giữ chỗ 20 giây rồi xoá. Không thể tốt hơn từ phía client.
6. **Một mình, Tải lại**: thế giới cũ đã đóng khi rời, Tải lại mở thế giới mới (địa chỉ đã bỏ `room`). Thú, đồ, trại theo thiết bị nên không mất gì.
7. `Game.abandon()` không gỡ listener `window` của `Keyboard`, `Sound`. Trang đã ở trạng thái hỏng và chỉ chờ tải lại; các phím gọi `send`, mà `send` bỏ qua khi `watch` không online (đã `lost`).

**Đề xuất việc mới cho `TASKS.md`** (ưu tiên thấp):
- Lỗi khi game đã chạy: ngoại lệ trong `frame()` hay mất WebGL context (`webglcontextlost`) hiện màn che "Game gặp lỗi" kèm Tải lại, thay vì hình đứng im.
- Nhận `vite:preloadError` (bản build) để tự tải lại một lần khi tab cũ gặp file băm đã bị xoá sau deploy, trước khi hiện thẻ.
