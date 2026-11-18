# PLAN: T83 Test đường ghi giờ chính trên iOS và dọn nhỏ sau T79

Code đọc ở `83497b0` ("Mark T79 done, add T83, start T83"). Nguồn: mục "Góp ý không bắt buộc" trong `REVIEW.md` của T79 (`git show e3906f4:REVIEW.md`), `PLAN.md` của T79 (`git show e3906f4:PLAN.md`). Số dòng có thể trôi: tìm theo chữ hoặc tên hàm.

**Thiết kế đã ghi sẵn** trong `docs/design/multiplayer.md` (game-designer sửa cùng PLAN này), mục "Mở lại ở `/` ngay sau khi chơi cùng bạn bè (T79)": ô bảng "ngay dưới Vào chơi (điện thoại ngang: cùng hàng...)", bullet "Bấm một trong hai nút..." (nút ở yên, mờ đi, focus ở lại) và bullet mới "Điện thoại ngang". Coder không sửa file đó, trừ khi làm khác PLAN (khi đó ghi lý do vào `PROGRESS.md`).

## Mục tiêu

T79 thêm nút "Quay lại thế giới cùng bạn bè" và ghi giờ "ở trong lần cuối" theo ba cách. Cách quan trọng nhất trên iPhone (trang bị ẩn lúc còn kết nối) và nhịp 60 giây chưa có test nào bắt: xoá một trong hai thì mọi test vẫn qua, và trên iPhone thật nút sẽ thôi hiện mà không ai biết. T83 khoá hai đường đó bằng test. Kèm ba chỗ dọn nhỏ người chơi thấy được:
- điện thoại ngang 844×390: tiêu đề sát mép trên (cách 2 px);
- bấm nút phụ thì nút biến mất, nên sảnh nhảy trong lúc đang vào;
- bấm bằng Enter thì focus rơi về `body`.

Cuối cùng là một câu lạc chỗ trong `docs/architecture.md`.

## Phạm vi

Làm:
- Tách nhịp ghi giờ 60 s ra class nhỏ `SeenNotes` (`packages/client/src/net/seen.ts`), có unit test bằng fake timer.
- Mở rộng e2e test 4 trong `tests/e2e/rejoin.spec.ts` với nửa online (trang ẩn lúc còn kết nối thì `seen` mới) và một ca đối chứng (trang hiện lại thì không ghi).
- Nút phụ không ẩn lúc bắt đầu vào, chỉ mờ đi (`aria-disabled`); ẩn khi thẻ lỗi hiện.
- Điện thoại ngang: nút phụ cùng hàng với ô tên và "Vào chơi". Bỏ hai quy tắc `:has()` thu khoảng cách của T79.
- Thêm e2e test 5 kiểm bố cục, không nhảy, focus.
- Dời và cập nhật câu T79 trong `docs/architecture.md`.

KHÔNG làm:
- Không đổi luật chọn thế giới (`returnOffer`), khoảng 10 phút, chữ, dữ liệu `petgame:worlds`, server, `schema.ts`, `messages.ts`, `Profile`.
- Không đổi bố cục sảnh **khi không có nút phụ** ở bất kỳ cỡ màn nào (mọi CSS mới chỉ chạy khi nút đang hiện, hoặc khi nút có `aria-disabled`).
- Không sửa bố cục desktop 1280×720 hay điện thoại dọc khi có nút. Ở 1280×720 sảnh cuộn 7 px; đây là chuyện có từ T79, xem Rủi ro.
- **Không sửa `tests/e2e/multiplayer.spec.ts`**, không đụng `labelLayout` (`packages/client/src/ui/labelLayout*`). Cả hai thuộc T63 đang chờ Q1.
- **Không dùng `git stash`** dưới bất kỳ hình thức nào: `stash@{0}` của T63 và `stash@{1}` phải giữ nguyên. Thử đột biến thì sửa tay rồi sửa lại tay. Không dùng `git checkout -- <file>` hay `git restore` lên file đã sửa, vì sẽ xoá luôn phần việc của coder.
- Không dùng `page.clock` cho test nhịp 60 s (lý do ở Thiết kế 1).

## Thiết kế

### 1. Test nhịp 60 s: tách `SeenNotes`, không dùng `page.clock`

Đã cân nhắc `page.clock` của Playwright 1.56.1. API có thật: `multiplayer.spec.ts` đã dùng `install` và `fastForward`, nhưng chỉ ở sảnh, trước khi vào game. Để test nhịp 60 s, phải cài đồng hồ giả trước `goto` và giữ nó suốt lúc vào thế giới và dựng game. Đồng hồ giả thay cả `requestAnimationFrame`, `performance.now`, `Date`, timer của Pixi, SDK Colyseus và `ConnectionWatch`. Rủi ro cụ thể:
- `runFor(60_000)` chạy cả 30 lần `check()` của `ConnectionWatch` trong thời gian giả, mà pong thật không kịp về. Kết quả là `STALL_MS` cắt kết nối: test hỏng oan.
- `fastForward` thì né được điều đó (nhờ `SLEPT_GAP_MS`), nhưng cả test game nằm trên đồng hồ giả, trong Chromium vẽ WebGL bằng phần mềm. Chưa test nào ở repo làm vậy.

Chọn cách chắc chắn: tách phần ghi theo nhịp ra một class không dùng DOM, theo đúng mẫu `ConnectionWatch` (dùng `Date.now`, `setInterval` toàn cục; test dùng `vi.useFakeTimers()`):

```ts
// packages/client/src/net/seen.ts
import { SEEN_EVERY_MS } from "../ui/joinStatus.ts";

/**
 * Notes when the device was last connected in its world (T79), so the lobby at "/" can offer the way back. A timer
 * writes every `every` ms; the page also calls `note()` when it turns hidden and when it closes (iOS can drop a
 * backgrounded web app without a `pagehide`). Writes only while `online()`: a dropped or replaced tab may no longer be
 * in the world. No DOM: time comes from the global Date.now and setInterval (tests drive them with fake timers).
 */
export class SeenNotes {
  constructor(online: () => boolean, write: (seen: number) => void, every = SEEN_EVERY_MS)
  /** Writes Date.now() if online. */
  note(): void
  /** The world is lost for good: the timer stops (note() still checks online). */
  stop(): void
}
```

Constructor bắt đầu `setInterval(() => this.note(), every)` ngay. `stop()` gọi `clearInterval` và gọi nhiều lần không sao. Không tạo object mỗi lần ghi, ngoài bản thân việc ghi `localStorage` như cũ.

Hai việc vẫn ở `main.ts`: listener `visibilitychange` và `pagehide`. Chúng được e2e kiểm (mục 2 và test 1 đang có). Như vậy:
- xoá `setInterval` thì unit test hỏng;
- xoá listener `visibilitychange` thì e2e test 4 hỏng;
- bỏ điều kiện online thì cả hai hỏng.

### 2. Nửa online của ghi giờ khi trang ẩn (e2e test 4)

Trong một `page.evaluate` **đồng bộ**, nên không timer nào chen vào giữa: đặt mọi `seen` thành `OLD`, giả `document.visibilityState = "hidden"` bằng `Object.defineProperty` (như nửa offline đang làm), bắn `visibilitychange`, đọc `seen`. Kỳ vọng `seen >= before`, với `before = Date.now()` lấy trong cùng evaluate trước khi bắn. Rồi `delete` thuộc tính giả (trở về getter gốc "visible").

Đối chứng: đặt lại `OLD`, bắn `visibilitychange` khi trang đang hiện, thì `seen` vẫn là `OLD`. Đối chứng này bắt đột biến "ghi ở mọi `visibilitychange`".

`Game.ts` cũng nghe `visibilitychange` nhưng đọc `document.hidden`, không đọc `visibilityState`, nên việc giả trạng thái không làm game gửi input dừng. Không ảnh hưởng.

Sau đó chạy nửa offline như hiện có, trong một evaluate riêng, không đổi.

### 3. Nút phụ trong lúc đang vào: ở yên, mờ, giữ focus

Hiện `enter()` đặt `rejoinBtn.hidden = true` ngay đầu, gây hai lỗi:
- form ngắn lại 52 px và được căn giữa lại (`margin: auto`), nên mọi thứ nhảy 24-28 px;
- focus đang ở nút thì rơi về `body`.

Thiết kế mới (khớp `docs/design/multiplayer.md`):
- `enter()`: thay `rejoinBtn.hidden = true` bằng `rejoinBtn.setAttribute("aria-disabled", "true")`.
  - Không dùng `disabled`: thuộc tính đó làm trình duyệt bỏ focus khỏi nút, đúng lỗi đang sửa.
  - Handler `click` đã bỏ qua khi `joining`, nên bấm lại (chạm, Enter, Space) không làm gì.
- CSS (ngoài media query, cạnh `.lobby-action:focus-visible`): `.lobby-action[aria-disabled="true"] { opacity: 0.6; cursor: progress; }`, cùng kiểu với `#join-btn:disabled`.
- `showJoinCard(card)`: thêm `rejoinBtn.hidden = true;` cạnh `joinBtn.hidden = true;`. Mọi đường vào hỏng đều qua đây: thẻ vào hỏng, `failToStart`. Nhánh `quietRetry` không bao giờ gặp nút, vì `quietRetry` chỉ có khi có `?room=`, mà khi đó `offered` là `null`. Từ đó nút không hiện lại cho đến khi mở lại trang, như T79.
- Vào được thì `lobby.remove()` như cũ.

**Focus:** theo cách T23/T42 làm:
- thẻ hiện thì focus ở nút chính của thẻ (`showJoinCard` đã làm);
- trong lúc đang vào thì không ai cướp focus.

Nút phụ ở yên và vẫn focus được, nên Enter trên nút để focus ở lại nút (trình đọc màn hình đọc nút "không dùng được" vì có `aria-disabled`). Đã cân nhắc và bỏ hai cách khác:
- chuyển focus sang `#join-btn`: nút đó `disabled` lúc đang vào, nên không nhận focus;
- chuyển sang ô tên: trên Android sẽ bật bàn phím ảo. Muốn tránh thì phải đoán thao tác cuối là phím hay chạm, mà `docs/design/hud.md` đã ghi `:focus-visible` không tin được cho việc này.

Không cần nhánh riêng cho chạm hay phím.

### 4. Điện thoại ngang: nút phụ cùng hàng với "Vào chơi"

Đo ở `83497b0` (Chromium của container, Vite, hộp `[x, y, rộng, cao]` px):

| 844×390 | `h1` | `#look` | `#name` | `#join-btn` | `#rejoin-btn` | form |
|---|---|---|---|---|---|---|
| không có nút | 82,14,680,26 | 82,48,680,268 | 82,324,472,44 | 562,324,200,44 | ẩn | 82,6,680,378 |
| có nút (T79) | 82,**2**,680,26 | 82,32,680,256 | 82,292,472,44 | 562,292,200,44 | 82,340,680,44 | 82,2,680,386 |
| **có nút (T83, đã thử bằng CSS chèn vào)** | 82,14,680,26 | 82,48,680,268 | 82,324,252,44 | 342,324,160,44 | 510,324,252,44 | 82,6,680,378 |

Bố cục T83 ở màn ngang có nút có hai tính chất:
- **cao đúng như khi không có nút**: tiêu đề cách mép trên 14 px như sảnh thường;
- hàng nút cùng `y`.

Đo thêm ở các cỡ ngang khác:
- 812×375, 932×430: như 844, ô tên 252 px.
- 667×375: ô tên 199 px.
- 568×320: ô tên 106 px. Sảnh vốn đã cuộn 58 px ở cỡ này, không đổi.

Chữ nút một dòng (rộng 224 px).

CSS: trong `@media (max-height: 560px) and (min-width: 560px)` của `packages/client/index.html`, **xoá** hai dòng T79 (chú thích "Room for the second button..." và hai quy tắc `:has()` về `gap`, `padding`, `.look-picker`), thay bằng:

```css
/* The second button (#rejoin-btn, T79) in the row of the name box and #join-btn: the lobby keeps the height it has
   without it, so the title stays clear of the top edge, and nothing moves while joining (T83). */
#lobby form:has(#rejoin-btn:not([hidden])) { grid-template-columns: minmax(0, 1fr) 160px auto; }
#lobby form:has(#rejoin-btn:not([hidden])) > #rejoin-btn { grid-column: 3; white-space: nowrap; padding: 0 12px; }
```

Giải thích từng chỗ:
- `minmax(0, 1fr)`: không có nó, ô `<input>` giữ bề rộng tự nhiên (khoảng 256 px) và tràn form ở 667 và 568.
- "Vào chơi" 160 px: chữ ngắn, vẫn rộng hơn 44 px rất nhiều.
- `white-space: nowrap`: tránh xuống dòng thành "...cùng / bạn bè".
- `padding: 0 12px` (thay 18 px của `.lobby-action`): ô tên rộng thêm 12 px ở màn nhỏ.
- Thứ tự Tab giữ nguyên theo DOM (ô tên, "Vào chơi", nút phụ), trùng thứ tự trái sang phải.

Khi nút ẩn (sảnh thường) cả hai quy tắc không áp dụng, nên bố cục không có nút **y hệt** `83497b0` ở mọi cỡ.

Trong lúc đang vào, nút không ẩn (mục 3), nên lưới không đổi cột. Không nhảy theo chiều ngang lẫn dọc.

Trình duyệt không hiểu `:has()` (trước Safari 15.4, Chrome 105) bỏ cả quy tắc. Khi đó nút chiếm hàng riêng (`#lobby form > *`), form cao 430 px, sảnh cuộn khoảng 40 px ở 844×390; nút vẫn tới được. Kém hơn T79 một chút (T79 thu khoảng cách nên vừa khít), nhưng các trình duyệt đó dưới mốc `dvh` của game, như REVIEW T79 đã ghi.

Dọc và desktop không đổi (nút vẫn ở hàng riêng dưới "Vào chơi").

### 5. `docs/architecture.md`

Trong dòng `main.ts` (mục client):
- cắt câu bắt đầu bằng `T79: \`RecentWorld.seen\`` cho đến hết `Luật ở \`docs/design/multiplayer.md\`.` **đầu tiên** sau nó;
- để câu `arrival(...)` nối thẳng sau câu T65.

Đặt câu T79 thành một khối đậm riêng **Quay lại từ `/` (T79, T83):** ngay **trước** **Vào mà game không mở được (T42):**, tức sau câu "Luật ở `docs/design/multiplayer.md`." kết thúc phần T23. Nội dung mới:
- `RecentWorld.seen` (ms; 0 = không rõ hay đã đóng; `recentWorlds` cho 0 khi thiếu);
- ghi qua `rememberWorld` và `SeenNotes` (`net/seen.ts`): nhịp `SEEN_EVERY_MS`, `note()` khi `visibilitychange` sang ẩn và khi `pagehide` (trước `watch.leave()`), chỉ khi `watch.online`, `stop()` khi mất hẳn kết nối;
- `forgetWorldTime` khi "closed" hay `shutdown`;
- `returnOffer(invited, recent, now)` chọn thế giới có `seen` lớn nhất, có bạn bè, trong `RETURN_OFFER_MS` (10 phút) thì hiện `#rejoin-btn`; bấm thì đặt `?room=` rồi `enter()`;
- trong lúc vào nút có `aria-disabled` và ở yên chỗ (focus ở lại); `showJoinCard` ẩn nó;
- điện thoại ngang: nút cùng hàng với "Vào chơi" nhờ quy tắc `:has()` trong `index.html`;
- luật ở `docs/design/multiplayer.md`.

## Kế hoạch triển khai

1. **`packages/client/src/net/seen.ts`** (mới): class `SeenNotes` như Thiết kế 1, JSDoc tiếng Anh cho class và hai phương thức. Trường riêng: `timer: ReturnType<typeof setInterval> | undefined`.
2. **`packages/client/src/net/seen.test.ts`** (mới): mục Test, Unit.
3. **`packages/client/src/main.ts`**
   - `import { SeenNotes } from "./net/seen.ts";`. Bỏ `SEEN_EVERY_MS` khỏi import `./ui/joinStatus.ts` (không còn dùng; `noUnusedLocals`).
   - `startGame`: thay `noteSeen` và `setInterval` bằng:
     ```ts
     const seen = new SeenNotes(
       () => watch.online,
       (time) => {
         if (friends !== undefined) noteRecentWorld(room.roomId, friends, time);
       },
     );
     ```
     Listener `visibilitychange` gọi `seen.note()` khi `document.visibilityState === "hidden"`. `pagehide` gọi `seen.note(); watch.leave();` (giữ thứ tự). Trong `react`: `if (status.state === "lost") seen.stop();` thay `clearInterval(seenTimer)`. Giữ chú thích "Three ways, as iOS can drop...", sửa cho khớp tên mới.
   - `enter()`: thay `rejoinBtn.hidden = true;` bằng `rejoinBtn.setAttribute("aria-disabled", "true");`. Thêm chú thích một dòng: nút ở yên để sảnh không nhảy và focus bàn phím ở lại; thẻ lỗi sẽ ẩn nó.
   - `showJoinCard`: thêm `rejoinBtn.hidden = true;` ngay sau `joinBtn.hidden = true;`.
   - Handler `click` của `rejoinBtn` giữ nguyên (`joining || broken || !offered` thì bỏ qua).
4. **`packages/client/index.html`**
   - CSS ngang: Thiết kế 4 (xoá dòng 391-393 của T79, thêm hai quy tắc kèm chú thích).
   - CSS chung: `.lobby-action[aria-disabled="true"] { opacity: 0.6; cursor: progress; }` ngay sau `.lobby-action:focus-visible`.
   - Không đổi HTML.
5. **`tests/e2e/rejoin.spec.ts`**: sửa test 4 và thêm test 5 (mục Test). Không đổi test 1-3.
6. **`docs/architecture.md`**: Thiết kế 5.
7. Chạy `npm run typecheck`, `npx vitest run packages/client/src/net/seen.test.ts packages/client/src/ui/joinStatus.test.ts`, `npx playwright test tests/e2e/rejoin.spec.ts`. Ghi `PROGRESS.md`.

Một vòng coder, một commit.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, `store.ts`, server, dữ liệu `localStorage`. Chỉ đổi client: DOM, CSS, cách tổ chức timer.

## Test

### Unit: `packages/client/src/net/seen.test.ts` (mới)

`vi.useFakeTimers()` trong `beforeEach`, `vi.useRealTimers()` trong `afterEach`; `vi.setSystemTime(1_000_000_000_000)`. `write` là `vi.fn()`, `online` đọc một biến `let up = true`. Mỗi test tạo một `SeenNotes` và gọi `stop()` cuối test.

1. "writes the time every SEEN_EVERY_MS while online, not before":
   - tạo không truyền `every`; không có lần ghi nào lúc tạo;
   - `advanceTimersByTime(SEEN_EVERY_MS - 1)`: 0 lần;
   - `+1`: 1 lần, với `Date.now()` lúc đó;
   - `+SEEN_EVERY_MS`: 2 lần.

   Ca này bắt đột biến xoá `setInterval`, hay đổi nhịp mặc định.
2. "skips the beat while offline and writes again once back online": `up = false`, qua một nhịp thì 0 lần; `up = true`, qua nhịp sau thì 1 lần.
3. "note() writes at once only while online": `note()` khi `up` thì 1 lần với `Date.now()`; `up = false` thì `note()` không ghi.
4. "stop() ends the beat": `stop()`, qua 3 nhịp thì 0 lần; `stop()` lần hai không ném lỗi; `note()` sau `stop()` vẫn ghi khi online (trang bị ẩn sau khi mất kết nối thì đã bị chặn bởi `online`, không phải bởi `stop`).
5. "takes its beat from the argument": `every = 1000`, qua 1000 ms thì 1 lần.

### E2E: `tests/e2e/rejoin.spec.ts`

**Test 4**, đổi tên thành "rejoin: the time is written when the page turns hidden while connected, and not while the connection is down". Giữ phần dựng (Host, Friend, chờ `friends: true`). Thêm **trước** evaluate offline:

```ts
const hidden = await page.evaluate((room) => {
  const OLD = 12345;
  const read = () => (JSON.parse(localStorage.getItem("petgame:worlds")!) as Stored[]).find((w) => w.room === room)!.seen;
  const age = () => localStorage.setItem("petgame:worlds", JSON.stringify((JSON.parse(localStorage.getItem("petgame:worlds")!) as Stored[]).map((w) => ({ ...w, seen: OLD }))));
  const online = !document.querySelector(".net-overlay.reconnecting");
  age();
  const before = Date.now();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  const seen = read();
  delete (document as any).visibilityState;
  age();
  document.dispatchEvent(new Event("visibilitychange"));
  return { online, before, seen, shown: read() };
}, roomId);
expect(hidden.online).toBe(true);
expect(hidden.seen).toBeGreaterThanOrEqual(hidden.before);
expect(hidden.shown).toBe(12345);
```

Kiểu `Stored` không dùng được trong `page.evaluate`: trong evaluate viết kiểu nội dòng như evaluate offline đang làm. Rồi giữ nguyên evaluate offline. Một evaluate đồng bộ nên timer 60 s và `syncAddress` không chen vào được: chỉ listener `visibilitychange` có thể làm `seen` mới.

**Test 5 (mới)**: "rejoin: the lobby does not move while joining by the second button, keyboard focus stays on it, and sideways it shares the row of Vào chơi". Không cần thế giới thật: dùng danh sách dựng sẵn như ca đối chứng của test 3. Thế giới `r1` không tồn tại nên vào sẽ ra thẻ "đã đóng".

Helper trong file:

```ts
const BOXED = ["#lobby h1", "#look", "#name", "#join-btn", "#rejoin-btn"];
/** Rounded [x, y, width, height] of the lobby's parts (zeros when hidden). */
const boxes = (page: Page) => page.evaluate((sel) => Object.fromEntries(sel.map((s) => {
  const r = document.querySelector(s)!.getBoundingClientRect();
  return [s, [r.x, r.y, r.width, r.height].map(Math.round)];
})), BOXED);
```

Đoạn 1, bố cục ngang so với sảnh thường:
- `plain = await lobbyAt(await newContext(browser, { viewport: { width: 844, height: 390 } }))` và `offer`: context `{ viewport: 844×390, hasTouch: true }` có `addInitScript` ghi `[{ room: "r1", friends: true, seen: Date.now() - 60_000 }]`.
- Kỳ vọng ở 844×390:
  - `#lobby h1` và `#look` bằng nhau cả 4 số;
  - `#name`: x, y, cao bằng nhau (rộng khác);
  - `#join-btn`: y và cao bằng nhau;
  - `#rejoin-btn`: y và cao bằng `#join-btn` của trang có nút, x ≥ x + rộng của `#join-btn`;
  - `#name` rộng ≥ 200;
  - `h1` y ≥ 8;
  - nút ≥ 44×44 và `toBeInViewport({ ratio: 1 })`.

Đoạn 2, không nhảy, lặp 3 cỡ: `[844, 390, "tap"]`, `[390, 844, "tap"]`, `[1280, 720, "keys"]`. Mỗi cỡ một trang mới trong context `offer`. `addInitScript` chạy lại mỗi trang, nên `seen` của `r1` mới lại dù trang trước đã quên nó.
- `page.setViewportSize`, rồi `before = await boxes(page)`.
- Giữ yêu cầu vào thế giới:
  ```ts
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/:2567\/matchmake\//, async (route) => { await held; await route.continue(); });
  ```
- Bấm:
  - `"tap"`: `rejoin.tap()`;
  - `"keys"`: `#join-btn.focus()`, `Tab`, kiểm `#rejoin-btn` có focus, rồi `Enter`.
- Trong lúc giữ:
  - `#join-btn` ghi "Đang vào...";
  - `#rejoin-btn` hiện, `toHaveAttribute("aria-disabled", "true")`;
  - `await boxes(page)` bằng `before` (`toEqual`, mọi phần);
  - `"keys"`: `#rejoin-btn` vẫn có focus (`toBeFocused()`);
  - bấm thêm một lần (`tap()` hoặc `Enter`), rồi kiểm vẫn "Đang vào..." và hộp vẫn bằng `before`.
- `release()`. Kỳ vọng:
  - `#join-status` chứa "Thế giới này đã đóng";
  - `#rejoin-btn` ẩn;
  - `#new-world-btn` có focus.
- `page.close()`.

**Không đổi, phải còn qua:** test 1-3 của `rejoin.spec.ts`, đặc biệt:
- test 1 kiểm nút ≥ 44 và trong khung nhìn ở 844×390;
- test 2 kiểm Tab, Enter, thẻ "đã đóng", `#rejoin-btn` ẩn, `#new-world-btn` có focus.

Cũng phải còn qua: `multiplayer.spec.ts` (các test `lobby:`), `pwa.spec.ts`, toàn bộ `npm test`.

### Đột biến phải bị bắt

Tester thử từng cái: sửa tay, chạy test, sửa lại tay, rồi `git diff --stat` khớp với trước khi thử. **Không** `git stash`, `git checkout --`, `git restore`.

| Đột biến | Test phải hỏng |
|---|---|
| Xoá listener `visibilitychange` trong `startGame` (`main.ts`) | e2e test 4 (nửa online) |
| Xoá `setInterval` trong `SeenNotes` (hoặc đổi nhịp mặc định thành 120 s) | `seen.test.ts` ca 1 |
| Bỏ điều kiện `online()` trong `SeenNotes.note` | `seen.test.ts` ca 2, 3 và e2e test 4 (nửa offline) |
| Listener ghi ở mọi `visibilitychange` (bỏ `=== "hidden"`) | e2e test 4 (`shown`) |
| Đặt lại `rejoinBtn.hidden = true` ở đầu `enter()` | e2e test 5 (hộp, `aria-disabled`, focus) |
| Bỏ `rejoinBtn.hidden = true` trong `showJoinCard` | e2e test 2 và test 5 |
| Bỏ hai quy tắc CSS ngang mới (hoặc trả lại quy tắc `gap` của T79) | e2e test 5 đoạn 1 |

## Tiêu chí hoàn thành

- [ ] `packages/client/src/net/seen.ts` có `SeenNotes(online, write, every = SEEN_EVERY_MS)` với `note()`, `stop()`, JSDoc tiếng Anh, không dùng DOM. `seen.test.ts` có 5 ca của mục Test và qua.
- [ ] `main.ts` dùng `SeenNotes`: `visibilitychange` sang ẩn và `pagehide` gọi `note()`, `pagehide` ghi trước `watch.leave()`, `stop()` khi `lost`. Không còn `setInterval` hay `clearInterval` trong `main.ts`; `SEEN_EVERY_MS` không còn import ở `main.ts`.
- [ ] E2E test 4 kiểm cả nửa online (ẩn lúc kết nối thì `seen ≥ before`), đối chứng (hiện lại thì không ghi), lẫn nửa offline (không ghi).
- [ ] Bấm nút phụ (chạm hay Enter): nút ở yên, có `aria-disabled="true"`, mờ đi; Enter thì focus ở lại trên nút. Hộp của `h1`, `#look`, `#name`, `#join-btn`, `#rejoin-btn` không đổi trong lúc vào ở 844×390, 390×844, 1280×720. Bấm thêm lần nữa không làm gì. Vào hỏng thì nút ẩn, thẻ hiện, focus ở nút chính của thẻ.
- [ ] 844×390 có nút: tiêu đề, hình nhân vật, hàng ô tên ở đúng `y` như sảnh không có nút (tiêu đề cách mép trên ≥ 8 px; đo được 14). Nút phụ cùng hàng, bên phải "Vào chơi", chữ một dòng, ≥ 44×44, nằm trọn trong màn. Ô tên ≥ 200 px.
- [ ] Sảnh **không có** nút giống hệt `83497b0` ở 390×844, 844×390, 1280×720. Tester đo hộp `h1`, `#look`, `#name`, `#join-btn`, form, so với bảng Thiết kế 4 và các số dọc, desktop sau đây (đo ở `83497b0`):
  - 390×844: `h1` 25,78,340,39; `#name` 25,653,340,45; `#join-btn` 25,710,340,45; form 25,62,340,721;
  - 1280×720: `h1` 430,41,420,39; `#name` 430,566,420,45; `#join-btn` 430,623,420,45; form 430,25,420,671.

  Nếu font của máy đo khác thì so với HEAD đo trên cùng máy, không dùng `git stash`.
- [ ] Mọi CSS mới chỉ áp dụng khi `#rejoin-btn` đang hiện hoặc có `aria-disabled`. Hai quy tắc `gap`/`padding` và `.look-picker` của T79 đã xoá.
- [ ] `docs/architecture.md`: câu `arrival(...)` nối liền sau phần T65. Khối **Quay lại từ `/` (T79, T83):** đứng riêng trước **Vào mà game không mở được (T42):**, nhắc `SeenNotes`, `aria-disabled`, `showJoinCard`, quy tắc ngang.
- [ ] Mọi đột biến trong bảng làm đúng test tương ứng hỏng (tester ghi kết quả từng dòng vào `PROGRESS.md`).
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] `tests/e2e/multiplayer.spec.ts` và `labelLayout` không bị sửa. Không có `git stash` mới: `git stash list` vẫn đúng 2 mục như trước.
- [ ] Không chữ tiếng Việt mới viết thẳng trong `main.ts` hay `index.html` (`node scripts/viStrings.mjs --compare HEAD` không báo chữ mới ở hai file đó).

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **`page.route` giữ yêu cầu vào:** `connect()` chỉ gọi `/matchmake/joinById/...` khi có `?room=` (`net/connection.ts`), và `multiplayer.spec.ts` đã route `/:2567\/matchmake\//` theo cách này. Nếu SDK gửi gì khác trước matchmake mà bị chặn thì test vẫn đúng, vì ta chỉ giữ, không chặn. Nếu thẻ không bao giờ hiện sau `release()`, kiểm xem `route.continue()` có chạy không.
- **Ô tên hẹp ở 568×320** (iPhone SE đời đầu nằm ngang): 106 px, gõ được khoảng 8 ký tự rồi chữ cuộn trong ô. Sảnh vốn đã phải cuộn ở cỡ này. Chấp nhận.
- **Desktop 1280×720 có nút:** form 727 px, sảnh cuộn 7 px, tiêu đề cách mép trên 16 px (là `padding` của form, không sát). Có từ T79, không thuộc T83; nút vẫn nằm trọn trong màn (test 1). Không đề xuất việc mới.
- **`aria-disabled` không chặn bấm:** nút vẫn nhận `click`. Handler đã bỏ qua khi `joining`, test 5 bấm lại để kiểm. Thêm đường gọi `enter()` mới nào sau này cũng phải giữ guard đó.
- Hành vi thật trên iPhone (iOS có bắn `visibilitychange` khi chuyển app khỏi app ở Màn hình chính không) vẫn chỉ kiểm tay được: dòng kiểm tay của T79 trong ghi chú cuối `TASKS.md` giữ nguyên.

Đề xuất cập nhật `TASKS.md` (agent chính): không có việc mới. Ghi chú vào **T16** (đã có dòng gom helper của `rejoin.spec.ts`): thêm `boxes` của test 5 nếu module chung có helper đo hộp.
