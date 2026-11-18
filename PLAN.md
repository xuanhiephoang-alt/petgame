# PLAN: T79 Gợi ý quay lại thế giới cùng bạn bè khi mở app từ Màn hình chính

Code đọc ở `52cf8dc` ("Mark T82 done, start T79"). Nguồn: đề xuất trong `PLAN.md` của T13 (`git show 363dc31:PLAN.md`, mục đề xuất tách việc), luật T23/T49/T65 trong `docs/design/multiplayer.md`. Số dòng có thể trôi: tìm theo chữ hoặc tên hàm.

**Thiết kế đã ghi sẵn** trong `docs/design/multiplayer.md` (game-designer sửa cùng PLAN này): mục mới "Mở lại ở `/` ngay sau khi chơi cùng bạn bè (T79)" (sau mục T65), dòng đầu file, bullet app ở Màn hình chính trong "Tải lại trang", hai bullet của T65 (ghi theo nhịp, cỡ danh sách) và một bullet trong "Đã cân nhắc và chấp nhận". Coder không cần sửa file đó, trừ khi làm khác PLAN (khi đó ghi lý do vào `PROGRESS.md`).

## Mục tiêu

Nhóm bạn đang chơi chung. Một người chuyển sang app khác vài phút (trả lời tin nhắn, gửi link mời, nghe điện thoại); iOS dỡ app ở nền. Mở lại app từ Màn hình chính thì app luôn mở `/` (`start_url`), không có `?room=`: bấm "Vào chơi" là vào một thế giới mới một mình, và muốn về với bạn bè thì phải xin link mời mới. Từ T79, nếu thiết bị vừa ở trong một thế giới có bạn bè trong vòng 10 phút, sảnh có thêm nút phụ **Quay lại thế giới cùng bạn bè**: một lần bấm là về đúng thế giới đó. Đúng cả khi gõ thẳng địa chỉ game trên trình duyệt.

## Phạm vi

Làm:
- Thêm giờ ở trong lần cuối (`seen`) vào `RecentWorld` của danh sách `petgame:worlds` (T65), đọc tương thích ngược.
- Ghi giờ đó khi vào, khi bạn bè đổi (như nay), mỗi 60 giây khi đang kết nối, khi trang bị ẩn, khi đóng trang.
- Quên giờ của thế giới đã biết là đóng (thẻ "đã đóng", server khởi động lại).
- Hàm thuần quyết định có mời quay lại không (`returnOffer`), có unit test.
- Nút phụ `#rejoin-btn` ở sảnh, chữ trong `strings.ts`.
- E2E trong file mới `tests/e2e/rejoin.spec.ts`.
- Một đoạn trong `docs/architecture.md`.

KHÔNG làm:
- Không đổi server, `schema.ts`, `messages.ts`, `Profile`, `GameRoom`. Không hỏi server trước khi hiện nút.
- Không đổi luật T23/T49/T65 khi mở bằng `?room=` (chữ "Quay lại…", "Bạn được mời…", `quietRetry`, `arrival`).
- Không đổi nút "Vào chơi" (vẫn là nút chính, vẫn tạo thế giới mới ở `/`), không tự vào, không đổi focus mặc định.
- Không sửa `tests/e2e/multiplayer.spec.ts` (xung đột với phần dở của T63 đang chờ Q1). **Không dùng `git stash`** dưới bất kỳ hình thức nào (`stash@{0}` của T63 phải giữ nguyên).
- Không đụng service worker, manifest (`start_url` giữ là `/`).

## Thiết kế

Luật đầy đủ cho người chơi: `docs/design/multiplayer.md`, mục "Mở lại ở `/` ngay sau khi chơi cùng bạn bè (T79)". Tóm tắt kỹ thuật:

### 1. Dữ liệu lưu: `localStorage` `petgame:worlds`

```ts
interface RecentWorld {
  room: string;
  friends: boolean;
  /** When (Date.now() ms) this device was last connected in the world; 0 = unknown (written before T79) or known closed. */
  seen: number;
}
```

JSON lưu: `[{"room":"abc123xyz","friends":true,"seen":1763500000000}, ...]`, thứ tự như T65 (mới ghi nhất ở đầu), tối đa 20, khoảng 1,2 kB.

Tương thích và bền:
- **Mục cũ (T65) không có `seen`**, hoặc `seen` không phải số hữu hạn > 0 (chuỗi, `NaN`, `Infinity`, âm, `null`): `recentWorlds` giữ mục đó với `seen: 0` (không bỏ: T65 vẫn cần nó để nhận dấu trang). `seen: 0` nghĩa là "đã lâu": không bao giờ được mời.
- **Danh sách hỏng** (không phải JSON, sai kiểu, trình duyệt chặn storage): như T65, `readJson` + `safeStorage` cho `[]` hoặc `undefined`, không ném lỗi; không có nút. Ghi hỏng thì bỏ qua im lặng.
- **Tab bản cũ** (trước T79, ví dụ đang mở lúc deploy) ghi lại danh sách: `recentWorlds` cũ chỉ giữ `room` và `friends`, nên giờ mất, mọi mục thành "đã lâu". Hỏng theo hướng an toàn (chỉ mất nút), không cần xử lý.
- Không có phiên bản hay key mới: cùng key `petgame:worlds`.

### 2. Khi nào ghi giờ (`seen = Date.now()`)

| Lúc | Đã có trước T79? | Điều kiện |
|---|---|---|
| Vào thế giới, bạn bè vào hay ra hết (`rememberWorld` qua `syncAddress`), `failToStart` | có (thêm giờ) | luôn |
| Mỗi `SEEN_EVERY_MS` = 60 s (`setInterval` trong `startGame`) | mới | `watch.online` |
| `visibilitychange` sang `hidden` | mới | `watch.online` |
| `pagehide` (trước `watch.leave()`) | mới | `watch.online` |

Mở trang ở `?room=X` có trong danh sách (T65 đưa X lên đầu): **giữ nguyên `seen` cũ của X**, không ghi giờ mới, vì chưa vào. Biết thế giới đóng: đặt `seen = 0` cho thế giới đó (giữ chỗ, giữ `friends`).

Vì sao cả ba cách mới, không chỉ `pagehide` như dòng nhiệm vụ:
- iOS treo app web ở nền rồi dỡ nó mà **không** bắn `pagehide`. Chính trường hợp T79 nhắm tới (app bị dỡ) là lúc `pagehide` hay không đến; khi đó giờ lưu có thể là lúc vào thế giới, 30 phút trước, và nút không hiện.
- `visibilitychange` → `hidden` là sự kiện cuối cùng mà trình duyệt điện thoại báo chắc chắn (chuyển app, khoá màn hình, đổi tab). Đây là cách chính.
- Nhịp 60 s che phần còn lại: trình duyệt bị tắt hay sập khi đang hiện, và trang ẩn mà vẫn kết nối (Android giữ WebSocket khi ẩn; Chrome vẫn chạy timer của tab ẩn tối thiểu mỗi phút một lần), nên giờ đúng nghĩa "lần cuối còn ở trong thế giới". Giá: đọc và ghi khoảng 1,2 kB `localStorage` mỗi phút.
- `pagehide` vẫn giữ: desktop đóng tab, tải lại, điều hướng đi.
- Điều kiện `watch.online`: đang kết nối lại hay đã mất hẳn thì không chắc còn ở trong thế giới, không ghi. Tab bị tab khác thay (`replaced`) thôi ghi, nên không đẩy thế giới cũ lên đầu danh sách. Mất hẳn kết nối thì `clearInterval`.

### 3. Quyết định: `returnOffer(invited, recent, now)`

Hàm thuần trong `ui/joinStatus.ts`, trả về id thế giới để mời, hoặc `null`:
1. `invited` (có `?room=`) khác rỗng: `null`. Nút chỉ có ở `/`.
2. Ứng viên = mục có `seen` lớn nhất trong các mục `0 < seen <= now + RETURN_OFFER_MS` (bằng nhau thì mục đứng trước). Không có: `null`.
   - Vì sao "seen lớn nhất" chứ không phải `recent[0]`: T65 đưa thế giới lên đầu khi chỉ mới mở link mà chưa vào. Ví dụ chơi cùng bạn bè ở X, rồi mở dấu trang thế giới cũ Y mà không vào: `recent[0]` là Y nhưng thế giới ở trong gần nhất vẫn là X.
   - Giờ ở tương lai quá 10 phút (đồng hồ máy bị chỉnh lùi, dữ liệu hỏng) bị bỏ qua, để một giá trị hỏng không che mãi các thế giới khác.
3. Ứng viên `friends === false`: `null` (người chơi đã chủ động chơi một mình sau đó).
4. `Math.abs(now - seen) > RETURN_OFFER_MS`: `null`. Còn lại: `room` của ứng viên.

### 4. Khoảng "vừa thấy": 10 phút

```ts
/** Friends likely still play this long after the player stepped out: 31/40 of a 40-minute session (docs/design/multiplayer.md). */
export const FRIENDS_STAY_MS = 9 * 60_000;
/** How long after the device was last connected in a world with friends the lobby at `/` offers to go back (10 min). */
export const RETURN_OFFER_MS = EMPTY_WORLD_HOLD_MS + FRIENDS_STAY_MS;
/** How often (ms) the device notes it is still connected in its world, so a page killed without notice is at most this late. */
export const SEEN_EVERY_MS = 60_000;
```

Lý do (chi tiết trong tài liệu thiết kế):
- 1 phút chắc chắn: người cuối rời thì thế giới còn giữ `EMPTY_WORLD_HOLD_MS` = 60 s (T49), rớt mạng thì thêm 20 s.
- 9 phút nhờ bạn bè: buổi chơi 40 phút (`docs/design/pals.md`), người chơi bước ra ở một lúc bất kỳ, bạn bè chơi hết buổi: sau 9 phút bạn bè còn ở khoảng (40 − 9)/40 = 77,5% số lần. Ở 20 phút chỉ còn 52,5%: nút "cùng bạn bè" sai gần một nửa.
- Đoán sai rẻ (một lần bấm, thẻ "đã đóng" có sẵn Tạo thế giới mới); bỏ lỡ thì đắt (xin link mời mới). Nên chọn khoảng dài nhất mà nút vẫn đúng khoảng 3/4 số lần.
- Nhịp 60 s làm giờ chậm nhiều nhất 1 phút, một phần mười của khoảng.

Hằng số nằm ở client (`ui/joinStatus.ts`, cạnh `RECENT_WORLDS_MAX`) vì chỉ client dùng; import `EMPTY_WORLD_HOLD_MS` từ `@petgame/shared`.

### 5. Sảnh

- Nút mới `<button type="button" id="rejoin-btn" class="lobby-action" hidden></button>` ngay **sau** `#join-btn`, trước `#join-status`. Chữ đặt từ `LOBBY_TEXT.rejoinFriends` = **"Quay lại thế giới cùng bạn bè"** (`strings.ts`), không viết chữ trong HTML.
- Kiểu: dùng nguyên `.lobby-action` (nền trong, viền trắng 60%, chữ trắng đậm 16 px, `min-height: 44px`), đúng kiểu nút phụ "Tải lại" của thông báo "mạng chậm": rõ là phụ so với nút xanh "Vào chơi". Trong form dạng cột, nút giãn hết chiều ngang như "Vào chơi". Điện thoại ngang (`@media (max-height: 560px) and (min-width: 560px)`): `#lobby form > *` đã chiếm cả hàng, nút nằm hàng riêng dưới ô tên và "Vào chơi". Ước lượng cao form ngang: 8 + 27 + 8 + 180 + 8 + 44 + 8 + 44 + 8 + 8 ≈ 343 px < 390 px, nên nút nằm trọn trong màn 844×390 không cần cuộn. Nếu e2e cho thấy không vừa: trong media query ngang đó thêm `.lobby-look .doll-preview { zoom: 0.8; }` (như điện thoại dọc thấp), không đổi gì khác.
- Hiện khi: `returnOffer(...)` khác `null`, đặt ngay lúc mở khoá sảnh (cạnh `nameInput.disabled = false`), trước khi bắn `petgame:lobby-ready`. Trước đó nút ẩn sẵn trong HTML, nên không cần trạng thái khoá. Thẻ hỏng tải của bộ canh T15 không bao giờ gặp nút (script không chạy thì nút vẫn ẩn).
- **Focus:** không đổi: ở `/` không nút nào tự có focus (như nay). Enter trong ô tên = "Vào chơi". Thứ tự Tab: ô tên → "Vào chơi" → nút phụ (theo thứ tự DOM). Enter/Space trên nút: nút `<button>` gốc.
- **Bấm nút phụ:**
  1. bỏ qua nếu `joining || broken`;
  2. `setAddress(lobbyUrl(offered, true))`: địa chỉ có `?room=` (giữ `quality` và tham số khác), y như mở lại từ link quay lại;
  3. `returning = true` (thẻ "đã đóng" dùng chữ "Thú, đồ và trại của bạn vẫn còn", như T65 với thế giới có bạn bè);
  4. `void enter()`.
  `quietRetry` vẫn `false` (chỉ đặt cho `backAlone`, và điều kiện `room === invited` cũng không khớp vì `invited` là `null`): thế giới có bạn bè mà đóng thì luôn có thẻ.
- `enter()` ẩn nút phụ ngay đầu (`rejoinBtn.hidden = true`), kể cả khi bấm "Vào chơi". Từ đó đi tiếp theo thẻ T23: Thử lại thử đúng địa chỉ đang có (có `?room=` nếu đã bấm nút phụ), Tạo thế giới mới bỏ `room`. Lý do: một lần thử là đủ để thẻ dẫn đường; ít tổ hợp trạng thái hơn.
- **Với chữ gợi ý:** nút chỉ có khi không có `?room=`, tức `arrival` là `"new"` và `#room-hint` rỗng. Không bao giờ đi cùng "Quay lại thế giới bạn đang chơi cùng bạn bè" hay "Bạn được mời…". Không thêm dòng gợi ý nào.
- **Đã đóng:** không có hành vi mới. Thẻ "Thế giới này đã đóng" / `JOIN_TEXT.closed.detailReturning` / Tạo thế giới mới (có focus), địa chỉ bỏ `room`. Thêm: thiết bị đặt `seen = 0` cho thế giới đó, nên tải lại `/` không còn nút.

## Kế hoạch triển khai

1. **`packages/client/src/ui/joinStatus.ts`**
   - `import { EMPTY_WORLD_HOLD_MS } from "@petgame/shared";`
   - `RecentWorld`: thêm `seen: number` kèm JSDoc như mục Thiết kế 1.
   - Hằng `FRIENDS_STAY_MS`, `RETURN_OFFER_MS`, `SEEN_EVERY_MS` (mục Thiết kế 4), JSDoc tiếng Anh nói lý do.
   - `recentWorlds(raw)`: đọc thêm `seen`; `typeof seen === "number" && Number.isFinite(seen) && seen > 0 ? seen : 0`. Mục không có `seen` vẫn được giữ. Sửa JSDoc.
   - `withRecentWorld(list, room, friends, seen: number)`: thêm tham số bắt buộc, ghi vào mục đầu.
   - Hàm mới `withWorldClosed(list, room): RecentWorld[]`: bản sao, mục `room` có `seen: 0`, giữ vị trí và `friends`; không có `room` thì bản sao y nguyên. Không đổi `list`.
   - Hàm mới `returnOffer(invited: string | null, recent: readonly RecentWorld[], now: number): string | null` theo mục Thiết kế 3, JSDoc nói luật và vì sao "seen lớn nhất".
2. **`packages/client/src/ui/strings.ts`**: trong `LOBBY_TEXT` thêm `rejoinFriends: "Quay lại thế giới cùng bạn bè"` kèm chú thích `/** The lobby's second button at "/" when the device was just in a world with friends (T79). */`.
3. **`packages/client/index.html`**
   - Thêm `<button type="button" id="rejoin-btn" class="lobby-action" hidden></button>` ngay sau `#join-btn`.
   - Bổ sung chú thích HTML phía trên form: `#rejoin-btn` là nút phụ quay lại thế giới cùng bạn bè (T79), `main.ts` đặt chữ và hiện nó.
   - CSS: không cần quy tắc mới nếu e2e kích thước và trong khung nhìn qua; chỉ thêm `zoom: 0.8` theo mục Thiết kế 5 khi cần.
4. **`packages/client/src/main.ts`**
   - Lấy `rejoinBtn = document.getElementById("rejoin-btn") as HTMLButtonElement`.
   - Import thêm `returnOffer`, `withWorldClosed`, `SEEN_EVERY_MS`.
   - `const recent = recentWorlds(readJson(RECENT_WORLDS_KEY));` dùng cho cả `arrival(...)` và `returnOffer(...)`.
   - `returning` đổi từ `const` sang `let`.
   - Dòng T65 `if (returning && invited) noteRecentWorld(...)`: truyền thêm `recent.find((w) => w.room === invited)?.seen ?? 0` (giữ giờ cũ, không làm mới).
   - `const offered = returnOffer(invited, recent, Date.now());`
   - `noteRecentWorld(roomId, friends, seen: number)`: truyền `seen` cho `withRecentWorld`. `rememberWorld` gọi với `Date.now()`.
   - Hàm mới `forgetWorldTime(roomId: string)`: `safeStorage(() => localStorage.setItem(RECENT_WORLDS_KEY, JSON.stringify(withWorldClosed(recentWorlds(readJson(RECENT_WORLDS_KEY)), roomId))))`.
   - Hàm mới `worldClosed()`: lấy `room` từ địa chỉ hiện tại, có thì `forgetWorldTime(room)`, rồi `dropWorldFromAddress()`. Thay `dropWorldFromAddress()` bằng `worldClosed()` ở **hai** chỗ biết thế giới đóng trong `enter()`: nhánh `quietRetry` và `if (failure === "closed")`. Nút Tạo thế giới mới giữ `dropWorldFromAddress()` (đầy người không phải đóng).
   - `enter()`: đầu hàm (sau kiểm `joining || broken`) thêm `rejoinBtn.hidden = true;`.
   - Handler `rejoinBtn` `click`: theo mục Thiết kế 5 (bỏ qua khi `joining || broken || !offered`; `setAddress(lobbyUrl(offered, true))`; `returning = true`; `void enter()`).
   - Lúc mở khoá sảnh: `if (offered) { rejoinBtn.textContent = LOBBY_TEXT.rejoinFriends; rejoinBtn.hidden = false; }`, trước `document.dispatchEvent(...)`. Không gọi `focus()`.
   - `startGame`:
     - sau `syncAddress()` thêm `const noteSeen = () => { if (watch.online && friends !== undefined) noteRecentWorld(room.roomId, friends, Date.now()); };`
     - `const seenTimer = setInterval(noteSeen, SEEN_EVERY_MS);`
     - `document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") noteSeen(); });`
     - listener `pagehide` sửa thành `() => { noteSeen(); watch.leave(); }` (ghi **trước** khi rời, lúc còn `online`).
     - trong `react`: `if (status.state === "lost") clearInterval(seenTimer);` và khi `reason === "shutdown"` thì thêm `forgetWorldTime(room.roomId)`.
     - Chú thích tiếng Anh ngắn: vì sao cả ba (iOS dỡ app ở nền không bắn `pagehide`).
   - Không tạo object mỗi khung hình: mọi thứ trên là sự kiện hoặc timer 60 s.
5. **`packages/client/src/ui/joinStatus.test.ts`**: thêm và sửa test (mục Test).
6. **`tests/e2e/rejoin.spec.ts`** (file mới): mục Test.
7. **`docs/architecture.md`**: trong đoạn **Vào lại thế giới (T23)** của `main.ts`, sau phần T65 thêm một câu T79: `RecentWorld.seen` (ms, 0 = không rõ hay đã đóng; `recentWorlds` cho 0 khi thiếu); ghi qua `rememberWorld` và `noteSeen` (nhịp `SEEN_EVERY_MS`, `visibilitychange` ẩn, `pagehide`, chỉ khi `watch.online`); `forgetWorldTime` khi "closed" hay `shutdown`; `returnOffer(invited, recent, now)` chọn thế giới có `seen` lớn nhất, có bạn bè, trong `RETURN_OFFER_MS` (10 phút) thì hiện `#rejoin-btn`, bấm thì đặt `?room=` rồi `enter()`. Luật ở `docs/design/multiplayer.md`.
8. Chạy `npm run typecheck`, `npx vitest run packages/client/src/ui/joinStatus.test.ts`, `npx playwright test tests/e2e/rejoin.spec.ts`; ghi `PROGRESS.md`.

Có thể commit thành một commit (một vòng coder).

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, `store.ts`, server. Không thêm yêu cầu mạng nào.
- Chỉ đổi dữ liệu `localStorage` `petgame:worlds` của client: thêm trường `seen`, đọc tương thích hai chiều (mục Thiết kế 1). Không làm hỏng dữ liệu đã lưu: mục cũ vẫn dùng được cho T65, chỉ không được mời quay lại.

## Test

### Unit: `packages/client/src/ui/joinStatus.test.ts`

Sửa (hành vi đổi có chủ đích, không nới lỏng):
- "keeps only room and friends" → "keeps room, friends and seen": `{ room: "A", friends: true, extra: 1 }` cho `{ room: "A", friends: true, seen: 0 }`; `{ room: "A", friends: true, seen: 5, extra: 1 }` cho `seen: 5`.
- Các test `withRecentWorld` và `recentWorlds` đang có: thêm `seen` vào dữ liệu và kỳ vọng.

Thêm:
- `recentWorlds`: mục T65 không có `seen` được giữ với `seen: 0`; `seen` là `"5"`, `NaN`, `Infinity`, `-1`, `0`, `null` đều thành 0 và mục vẫn được giữ.
- `withRecentWorld(list, room, friends, seen)`: ghi `seen` vào mục đầu; đưa thế giới có sẵn lên đầu với `seen` mới.
- `withWorldClosed`: đặt `seen: 0` cho đúng mục, giữ vị trí và `friends`; room lạ cho danh sách y nguyên; không đổi list đầu vào.
- `returnOffer` (với `now = 1_000_000_000_000`):
  - có `invited` (kể cả danh sách hợp lệ): `null`; `invited` rỗng `""` coi như không có;
  - danh sách rỗng: `null`;
  - mục có bạn bè, `seen = now - 60_000`: trả `room`;
  - đúng biên: `seen = now - RETURN_OFFER_MS` có; `now - RETURN_OFFER_MS - 1` không;
  - mục một mình mới: `null`;
  - mục cũ không có giờ (`seen: 0`) có bạn bè: `null`;
  - chọn `seen` lớn nhất chứ không phải mục đầu: `[{Y, friends: true, seen: 0}, {X, friends: true, seen: now - 60_000}]` cho X; `[{A, friends: false, seen: now - 30_000}, {B, friends: true, seen: now - 60_000}]` cho `null`;
  - giờ tương lai nhỏ (`now + 30_000`) vẫn mời; giờ tương lai quá `RETURN_OFFER_MS` bị bỏ qua, mục kế tiếp hợp lệ thì được mời;
  - bằng nhau thì mục đứng trước.
- Hằng số: `RETURN_OFFER_MS === EMPTY_WORLD_HOLD_MS + FRIENDS_STAY_MS` và bằng `10 * 60_000`; `SEEN_EVERY_MS` nhỏ hơn hay bằng `RETURN_OFFER_MS / 10`.

### E2E: `tests/e2e/rejoin.spec.ts` (file mới, không đụng `multiplayer.spec.ts`)

Đầu file: chép tối thiểu helper từ `multiplayer.spec.ts` như `pwa.spec.ts` đã làm, kèm chú thích "Copied from multiplayer.spec.ts because T63 holds that file; to be gathered into one module in T16". Gồm: mảng `contexts` và `observers` dọn trong `afterEach`, `SERVER = "http://localhost:2567"`, `enterLobby`, `waitForWorld`, `playerCount`, `observer` (SDK `Client.joinById`), `closedWorld`, hằng màn điện thoại dọc `{ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }`. Hàm `worlds(page)` đọc `JSON.parse(localStorage.getItem("petgame:worlds"))`. Mọi trang mở với `?quality=low`. Test có thế giới thật dùng `test.slow()`.

1. **"rejoin: opened at / soon after playing with a friend, a second button takes the player back to the same world"** (điện thoại dọc, cảm ứng):
   - Mở `/?quality=low`, vào chơi "Host", `waitForWorld`, lấy `roomId`. `observer(roomId, "Friend")`, chờ `playerCount` = 2.
   - `worlds(page)[0]` là `{ room: roomId, friends: true, seen }` với `seen` trong khoảng giờ test.
   - Chứng minh ghi lúc rời trang: `page.evaluate` đặt `seen` của mọi mục thành `Date.now() - 60 * 60_000` (cũ 1 giờ), rồi `page.goto("about:blank")` (bắn `visibilitychange`/`pagehide`), rồi `page.close()`. Chỉ lần ghi lúc rời mới làm giờ mới lại. (Nhịp 60 s rơi đúng vào giữa hai lệnh chỉ làm test qua oan, không làm test hỏng oan.)
   - Trang mới cùng context (`context.newPage()`, sessionStorage rỗng như app vừa mở) ở `/?quality=low`. Chờ `#join-btn:enabled`. Kỳ vọng:
     - `#rejoin-btn` hiện, chữ đúng "Quay lại thế giới cùng bạn bè";
     - `#room-hint` rỗng, `#join-btn` hiện và ghi "Vào chơi";
     - `#rejoin-btn` không có focus.
   - Ở 390×844, 844×390, 1280×720: hộp của `#rejoin-btn` ≥ 44×44 và `toBeInViewport({ ratio: 1 })`; rồi về 390×844.
   - `tap()` nút phụ → `waitForWorld` → `roomId` trùng, `playerCount` = 2, `observer` thấy 2 người; địa chỉ có `room=roomId` và giữ `quality=low`.
2. **"rejoin: a world that closed meanwhile shows the closed card, by keyboard, and is not offered again"** (desktop):
   - Vào "Host", `observer` Friend, chờ 2 người.
   - `page.goto("about:blank")`; chờ `friend.state.players.size` = 1; `friend.send("debug:emptyHold", { ms: 0 })`; `friend.leave()`; `closedWorld(roomId)`.
   - Trang mới `/?quality=low`: `#rejoin-btn` hiện. `#join-btn.focus()`, nhấn Tab: `#rejoin-btn` có focus; nhấn Enter.
   - Thẻ `#join-status` chứa "Thế giới này đã đóng" và "vẫn còn"; `#new-world-btn` có focus; địa chỉ không còn `room`; `#rejoin-btn` ẩn; mục `roomId` vẫn trong danh sách với `friends: true`, `seen: 0`.
   - `reload()`: chờ `#join-btn:enabled`, `#rejoin-btn` ẩn.
3. **"rejoin: no second button when the last world was solo, too old, undated, opened by a link, or the list is broken"** (desktop):
   - Thật: vào "Solo" một mình, `waitForWorld`, `page.close()`; trang mới `/` cùng context: `#join-btn:enabled`, `#rejoin-btn` ẩn.
   - Dựng sẵn (mỗi trường hợp một context mới, `addInitScript` ghi `petgame:worlds` theo `Date.now()` của trang; không cần thế giới thật), kỳ vọng sau `#join-btn:enabled`:

     | Danh sách / địa chỉ | `#rejoin-btn` |
     |---|---|
     | `[{room:"r1", friends:true}]` (T65, không giờ) | ẩn |
     | `[{room:"r1", friends:false, seen: now-60s}]` | ẩn |
     | `[{room:"r1", friends:true, seen: now-11min}]` | ẩn |
     | `[{room:"a", friends:false, seen: now-30s}, {room:"b", friends:true, seen: now-60s}]` | ẩn |
     | `[{room:"r1", friends:true, seen: now-60s}]` ở `/` (đối chứng: cách dựng có tác dụng) | hiện |
     | cùng danh sách đó nhưng mở `/?room=r1` | ẩn, `#room-hint` = "Quay lại thế giới bạn đang chơi cùng bạn bè" (T65 không đổi) |
     | `"{not json"` | ẩn |
     | `Storage.prototype.getItem/setItem` ném lỗi | ẩn |

### Không đổi, phải còn qua

- `tests/e2e/multiplayer.spec.ts` (các test `lobby:` của T23/T49/T65, gồm danh sách hỏng), `tests/e2e/pwa.spec.ts`, toàn bộ `npm test`.
- Không cần test server hay `GameRoom.test.ts` (không đổi server).

## Tiêu chí hoàn thành

- [ ] `RecentWorld` có `seen: number`; `recentWorlds` giữ mục không có hoặc sai `seen` với `seen: 0`, không bao giờ ném lỗi; `withRecentWorld` nhận `seen`; có `withWorldClosed`, `returnOffer`, `FRIENDS_STAY_MS`, `RETURN_OFFER_MS` (= `EMPTY_WORLD_HOLD_MS` + 9 phút = 10 phút), `SEEN_EVERY_MS` (60 s) trong `ui/joinStatus.ts`, có JSDoc tiếng Anh.
- [ ] `returnOffer` chọn mục có `seen` lớn nhất (bỏ giờ tương lai quá `RETURN_OFFER_MS`), mời chỉ khi không có `?room=`, có bạn bè, `|now - seen| <= RETURN_OFFER_MS`.
- [ ] Giờ được ghi: khi vào/bạn bè đổi, mỗi 60 s, khi `visibilitychange` ẩn, khi `pagehide` (trước `watch.leave()`), ba cách mới chỉ khi `watch.online`; timer dừng khi mất hẳn kết nối. Mở bằng `?room=` (T65) giữ giờ cũ.
- [ ] Thẻ "closed" (cả nhánh `quietRetry`) và màn `shutdown` đặt `seen = 0` cho thế giới đó; nút Tạo thế giới mới thì không.
- [ ] `#rejoin-btn` (class `lobby-action`, ẩn sẵn) nằm ngay sau `#join-btn`; chữ "Quay lại thế giới cùng bạn bè" lấy từ `LOBBY_TEXT.rejoinFriends`, không có chữ tiếng Việt mới viết thẳng trong `main.ts` hay `index.html`.
- [ ] Nút hiện chỉ ở `/` khi `returnOffer` cho thế giới; không tự lấy focus; "Vào chơi" không đổi; bấm thì `?room=` vào địa chỉ (giữ tham số khác) rồi vào; nút ẩn khi bất kỳ lần vào nào bắt đầu.
- [ ] Thế giới đã đóng: thẻ "Thế giới này đã đóng" với chữ "vẫn còn", Tạo thế giới mới có focus, địa chỉ bỏ `room`; tải lại `/` không còn nút.
- [ ] Nút ≥ 44×44 và nằm trọn trong khung nhìn ở 390×844, 844×390, 1280×720; bấm được bằng chạm, Tab + Enter.
- [ ] Không đổi server, schema, message, Profile; không thêm yêu cầu mạng trước khi sảnh sẵn sàng.
- [ ] Unit test mục Test có và qua; `tests/e2e/rejoin.spec.ts` có 3 test và qua; `multiplayer.spec.ts` không bị sửa; `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] `docs/architecture.md` có câu T79; `docs/design/multiplayer.md` khớp với code (đã viết sẵn; nếu code khác thì sửa một trong hai và ghi lý do).
- [ ] Không có `git stash` nào mới; `stash@{0}` của T63 còn nguyên.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **Hành vi thật trên iOS chưa kiểm được ở đây:** việc iOS bắn `visibilitychange` khi chuyển app khỏi app web ở Màn hình chính là hành vi đã biết của Safari, nhưng cần kiểm trên máy thật cùng đợt kiểm tay của T13/T80. Nhịp 60 s là lưới an toàn nếu không có sự kiện. Đề xuất thêm một dòng vào ghi chú kiểm tay cuối `TASKS.md`: "T79: chơi cùng bạn bè trên app ở MH chính iPhone, chuyển app 2-5 phút cho iOS dỡ app, mở lại: có nút Quay lại thế giới cùng bạn bè và về đúng thế giới."
- **Nút ở 844×390 có thể không vừa** nếu ước lượng chiều cao sai: cách sửa đã ghi ở mục Thiết kế 5 (thu nhỏ hình nhân vật), không đổi bố cục khác.
- **Test 1 bước "ghi lúc rời trang"** dựa vào việc `page.goto("about:blank")` bắn `pagehide` (các test T23 đã dựa vào điều này). Nếu Chromium không bắn `visibilitychange` khi điều hướng thì `pagehide` vẫn ghi; test không phân biệt hai cách, chỉ kiểm có ghi lúc rời.
- **Hai tab:** tab mới ở `/` thấy nút trong lúc tab cũ vẫn chơi; bấm thì tab cũ kết thúc ("Bạn đang chơi ở nơi khác"). Đã ghi trong tài liệu thiết kế, chấp nhận (giống bấm "Vào chơi").
- **Ghi đồng thời giữa các tab** (đọc rồi ghi `localStorage`): có thể mất một lần ghi giờ của tab kia, lần ghi sau (≤ 60 s) sửa lại. Chấp nhận như T65.

Đề xuất cập nhật `TASKS.md` (agent chính):
- Ghi chú vào **T16**: "Gom thêm helper chép trong `tests/e2e/rejoin.spec.ts` (T79) vào module chung."
- Dòng kiểm tay iPhone cho T79 như trên, vào phần ghi chú chờ người chơi thử.
