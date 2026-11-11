# PLAN: T23 Vào lại đúng thế giới sau khi tải lại trang hoặc iOS đóng tab

Đọc code ở HEAD `7e8c487`. Kèm các ghi chú "Sau T15" của T23 trong `TASKS.md` và mục Thiết kế 6 của kế hoạch T15 (`git show 478c8a7:PLAN.md`).

## Mục tiêu

Hiện tại, khi đang chơi cùng bạn bè mà người chơi tải lại trang (hoặc iOS dỡ tab ở nền rồi mở lại), trang về sảnh với địa chỉ ban đầu. Người tạo thế giới có địa chỉ không có `?room=`, nên bấm "Vào chơi" là **tạo thế giới mới**, tách khỏi bạn bè. Kết nối lại của T3 chỉ chạy khi trang còn mở.

Sau T23:
1. **Tải lại là về đúng thế giới đang chơi cùng bạn bè.** Trong lúc chơi, thanh địa chỉ luôn ghi nơi mà lần mở trang sau sẽ đưa người chơi tới (`history.replaceState`). Có bạn bè trong thế giới thì địa chỉ có `?room=<id>`. Chơi một mình thì địa chỉ không có `room`: thế giới đó đóng ngay khi người chơi rời, nên lần sau mở thế giới mới cùng bản đồ, giống nút "Về sảnh" của T3.
2. **Sảnh nói rõ vì sao không vào được và cho cách đi tiếp.** Bỏ dòng lỗi chung "Không vào được phòng (đầy 5 người hoặc server chưa chạy)." Thay bằng thẻ lỗi (dùng lại `.lobby-alert` / `.lobby-action` của T15) cho bốn trường hợp:
   - thế giới đã đóng: nút **Tạo thế giới mới**;
   - thế giới đủ 5 người: nút **Thử lại** và **Tạo thế giới mới**;
   - không kết nối được server: nút **Thử lại**;
   - lỗi khác: nút **Thử lại**.

Vì sao cần: chơi cùng bạn bè trên điện thoại là cách chơi chính. iOS Safari hay dỡ tab ở nền, và người chơi hay kéo xuống để tải lại. Mỗi lần như vậy họ rơi vào một thế giới trống mà không biết vì sao.

## Phạm vi

**Làm:**
- `packages/client/src/net/connection.ts`: hàm thuần `joinFailure(err)` phân loại lỗi khi vào phòng; có unit test.
- `packages/client/src/ui/joinStatus.ts` (mới): bảng chữ của thẻ lỗi, hàm thuần `joinCard(failure, returning)`; có unit test.
- `packages/client/src/main.ts`:
  - gom việc vào phòng thành hàm `enter()`, dùng cho submit, Thử lại và Tạo thế giới mới;
  - hiện thẻ lỗi;
  - đồng bộ `?room=` lên thanh địa chỉ trong lúc chơi;
  - ghi dấu "đang chơi ở thế giới nào" vào `sessionStorage`;
  - chữ gợi ý khi quay lại.
- `packages/client/index.html`:
  - thêm thẻ `#join-status` vào sảnh, bỏ `#join-error`;
  - thêm CSS `.lobby-actions` và `.lobby-action.quiet`.
- E2E: sửa 3 test có sẵn, thêm 1 test `lobby:`; sửa helper `waitForWorld`.
- Tài liệu: `docs/design/multiplayer.md` (designer đã cập nhật cùng commit kế hoạch này) và `docs/architecture.md` (coder sửa 2 dòng, xem bước 7).

**KHÔNG làm:**
- **Không tự vào lại khi mở trang.** Người chơi vẫn bấm "Vào chơi" một lần, vì:
  - link mời cũng có `?room=` mà người được mời cần chọn tên và ngoại hình trước;
  - tự vào sẽ phá hợp đồng T1 "sảnh sẵn sàng = `#join-btn:enabled`" mà mọi e2e dùng (sau `page.reload()` test sẽ đua với lần tự vào);
  - T3 đã định "vào lại từ sảnh là một phiên mới".

  Bù lại: khi quay lại, nút "Vào chơi" có sẵn focus (Enter là vào) và sảnh ghi rõ "Quay lại thế giới bạn đang chơi cùng bạn bè".
- Không dùng `sessionStorage` + `client.reconnect` (lý do ở Thiết kế 1).
- Không sửa server, schema, message, `Profile`. Không đổi `RECONNECT_GRACE_MS`, không giữ thế giới trống sống thêm (đề xuất việc riêng ở cuối).
- Không đổi bộ canh tải T15 (script inline trong `index.html`), `#load-status`, `#reload-btn`, tên sự kiện `petgame:lobby-ready`.
- Không đổi `lobbyUrl`, `inviteLink`, `ConnectionWatch`, màn che kết nối `ui/connection.ts`.
- Không xử lý lỗi sau `lobby.remove()` (`startGame` hỏng: việc T42). Không gỡ phiên bị treo khi `assets` hỏng sau khi đã vào phòng (server đã tự thay phiên cũ theo token khi vào lại; ghi ở Rủi ro).
- Không làm phần PWA "Thêm vào MH chính": app mở lại từ `start_url` `/` nên không giữ `?room=` (ghi ở Rủi ro, đề xuất việc riêng).
- Không thêm hook `debug:*` hay tham số URL chỉ dành cho test; test dùng `page.route`, SDK `Client` và helper `observer` có sẵn.
- Không sửa `playwright.config.ts`, không tăng timeout chung, không `retries`, không thêm `waitForTimeout`.

## Thiết kế

### 1. Chọn hướng: ghi `?room=` lên địa chỉ (không dùng mã nối lại)

| | `history.replaceState` `?room=` (chọn) | `sessionStorage` + `client.reconnect` |
|---|---|---|
| Khớp luật T3 "tải lại = rời chủ động" (`pagehide` → `watch.leave()`) | có | không: phải bỏ việc rời chủ động khi tải lại, nên chỗ bị giữ 20 giây mỗi lần đóng tab |
| Sống được bao lâu | đến khi thế giới đóng | mã nối lại hết hạn sau 20 giây (`RECONNECT_GRACE_MS`), dùng một lần |
| iOS dỡ tab ở nền hàng phút | về đúng thế giới nếu bạn bè còn ở đó | mã đã hết hạn |
| Dùng lại thứ có sẵn | `lobbyUrl`, `inviteLink`, nút Tải lại T15 (giữ địa chỉ), nút Về sảnh T3 | không |
| Tiến trình | hồ sơ theo token thiết bị nên vào lại đủ thú, đồ, trại | như bên trái |

Mất đi khi chọn hướng này: vị trí đứng và máu không được giữ (vào lại từ sảnh bắt đầu ở giữa bản đồ, đầy máu). Đây đúng là luật hiện có của "vào lại từ sảnh", không thành mẹo được (`docs/design/multiplayer.md`).

### 2. Địa chỉ trong lúc chơi

Luật: **địa chỉ = nơi lần mở trang sau đưa người chơi tới**. Tính bằng chính `lobbyUrl(room.roomId, withFriends)` mà nút "Về sảnh" đang dùng, nên hai đường luôn khớp.

| Lúc | `withFriends` | Địa chỉ |
|---|---|---|
| Đang chơi, `room.state.players.size > 1` (kể cả bạn đang mất kết nối mà còn được giữ chỗ) | có | `?room=<roomId>`, giữ mọi tham số khác (`quality`...) và `#…` |
| Đang chơi, chỉ còn mình (`size === 1`) | không | bỏ `room` |
| `size === 0` (trạng thái chưa tới) | | không đổi |
| Mất hẳn (`status.state === "lost"`) | theo luật T3: số người lúc còn online cuối; `shutdown` thì không | `lobbyUrl(room.roomId, withFriends)`, đúng URL mà nút Về sảnh mở |

- **Vì sao chơi một mình thì bỏ `room`:** người cuối cùng rời (tải lại là rời chủ động) thì Colyseus đóng thế giới ngay (`autoDispose`). Giữ `room` thì người chơi một mình lần nào tải lại cũng gặp thẻ "Thế giới này đã đóng", vô ích. Thế giới mới dùng cùng bản đồ (`defaultWorld()`), và thú, đồ, trại theo token. Với người chơi một mình, hai thế giới như nhau.
- **Người được mời vào thế giới chỉ còn mình họ** (chủ đã rời): `size === 1` nên `room` bị bỏ. Đúng: họ rời là thế giới đóng.
- **Chi phí:** cập nhật trong `room.onStateChange` (20 lần/giây), nhưng chỉ gọi `replaceState` khi `withFriends` đổi giá trị (so với biến nhớ), nên không tạo object mỗi tick. Safari giới hạn khoảng 100 lần `replaceState` trong 30 giây; ở đây chỉ vài lần mỗi phiên. Vẫn bọc `try` (`safeStorage`).
- **`sessionStorage` `petgame:room` = `room.roomId`**, ghi ngay khi vào phòng. Theo tab, sống qua tải lại và qua lúc Safari khôi phục tab. Chỉ dùng để biết trang này là **quay lại** (`?room=` trùng dấu) hay **được mời** (khác hoặc không có), từ đó chọn chữ. Không dùng để quyết định vào phòng nào: địa chỉ mới là thứ quyết định.

### 3. Sảnh khi mở trang

| Địa chỉ | `#room-hint` | Focus |
|---|---|---|
| không có `room` | (trống) | như cũ |
| `?room=X`, `sessionStorage` `petgame:room` = X (quay lại) | **"Quay lại thế giới bạn đang chơi cùng bạn bè"** | `#join-btn` (Enter hoặc Space là vào; trên điện thoại focus nút không bật bàn phím) |
| `?room=X`, khác hoặc không có dấu (được mời) | "Bạn được mời vào thế giới của bạn bè" (như cũ) | như cũ |

**Ràng buộc T15:** `main.ts` vẫn bắn `petgame:lobby-ready` đồng bộ, ngay sau ba dòng mở khoá, trước mọi `await` và mọi yêu cầu tới server. Phần đọc `sessionStorage`, gán gợi ý và focus đều chạy đồng bộ trước đó, bọc `safeStorage` để không thể ném lỗi (một lỗi ở đây sẽ làm bộ canh tải báo "Trình duyệt gặp lỗi").

### 4. Vào phòng và thẻ lỗi

**Trong lúc vào** (submit, Thử lại, Tạo thế giới mới đều gọi `enter()`):
- ẩn thẻ lỗi;
- hiện `#join-btn`, khoá nó, chữ **"Đang vào..."** (ba dấu chấm ASCII, giống "Đang tải...");
- có cờ `joining` chống gọi chồng.

**Vào hỏng:** `#join-btn` bị ẩn (`hidden`), chữ trả về "Vào chơi" và mở khoá. Thẻ `#join-status` hiện ngay chỗ nút (ngay sau nút trong form), cuộn vào tầm nhìn (`scrollIntoView({ block: "nearest" })`), focus vào nút chính (`preventScroll`). Ô tên và ngoại hình vẫn hiện và sửa được.

**Phân loại lỗi** (`joinFailure(err)`; số liệu đo bằng `@colyseus/testing` + SDK 0.18.5 ở HEAD, xem Thiết kế 7):

| SDK ném | Ví dụ | Loại |
|---|---|---|
| `code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID` (522), message có `"is locked"` | thế giới đủ 5 người, kể cả người đang được giữ chỗ 20 giây (Colyseus tự khoá phòng ở `maxClients`) | `full` |
| 522, message khác (`room "X" not found`) | mọi người đã rời, thế giới đã đóng; link mời sai | `closed` |
| `code` là `503` (server đang tắt), hoặc `code` không phải số (`undefined` khi `fetch` hỏng trên trình duyệt, `"ECONNREFUSED"` trên Node) | mất mạng, server không chạy hoặc đang khởi động lại | `unreachable` |
| còn lại: `code` số khác (525, mã đóng socket 4xxx/1006 khi vào giữa chừng), giá trị ném không phải object | | `failed` |

- Nhận diện theo cấu trúc (`typeof err === "object" && err !== null && "code" in err`), không `instanceof`, để test bằng object thường.
- Phân biệt đầy/đóng dựa vào chữ `"is locked"` của Colyseus (`MatchMaker.joinById`). Nếu chữ này đổi ở bản Colyseus sau: unit test giữ đúng chuỗi hiện tại, còn e2e "6th is turned away" sẽ hỏng (thấy "đã đóng" thay vì "đủ 5 người"). Không âm thầm sai.

**Chữ hiển thị** (`joinCard(failure, returning)`):

| Loại | Tiêu đề (`<strong>`) | Dòng giải thích | Nút (nút chính đứng trước, có focus) |
|---|---|---|---|
| `closed`, quay lại | **Thế giới này đã đóng** | Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn. | **Tạo thế giới mới** |
| `closed`, được mời | **Thế giới này đã đóng** | Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới. | **Tạo thế giới mới** |
| `full` | **Thế giới đã đủ 5 người** | Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới. | **Thử lại**, Tạo thế giới mới (phụ) |
| `unreachable` | **Không kết nối được server** | Kiểm tra mạng rồi bấm Thử lại. | **Thử lại** |
| `failed` | **Không vào được thế giới** | Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại. | **Thử lại** |

- `returning` là giá trị lúc mở trang (Thiết kế 3), tính một lần; không phụ thuộc việc `room` bị bỏ sau đó.
- Chữ "5" lấy từ `MAX_PLAYERS` của shared (`` `Thế giới đã đủ ${MAX_PLAYERS} người` ``), không viết số cứng.
- `full` vẫn có Tạo thế giới mới: nếu người đang được giữ chỗ không quay lại, người chơi phải chờ hết 20 giây; nút phụ cho họ một lối khác.

**Hành động:**
- **Thử lại:** `enter()` với địa chỉ hiện tại (vẫn `?room=` nếu có).
- **Tạo thế giới mới:**
  1. bỏ `room` khỏi địa chỉ (`replaceState`, không tải lại trang);
  2. xoá `#room-hint`;
  3. `enter()`, tức `client.create`, rồi vào ngay (không bắt bấm thêm "Vào chơi").
- **Khi phát hiện `closed`:** bỏ `room` khỏi địa chỉ và xoá gợi ý **ngay**, trước khi hiện thẻ. Địa chỉ phản ánh sự thật (thế giới không còn), nên tải lại ở thẻ này hay Enter trong ô tên cũng ra thế giới mới, không gặp lại cùng lỗi. Bước 1 của "Tạo thế giới mới" vì thế làm lại cũng không sao.
- Enter trong ô tên khi thẻ đang hiện (nút submit đang ẩn): trình duyệt có thể gửi form hoặc không. Nếu gửi thì handler `submit` gọi `enter()`, tức Thử lại. Không sai đường nào; cờ `joining` chặn gọi chồng.

**Giao diện thẻ** (`index.html`): dùng lại `.lobby-alert.failed` (thẻ sáng, bo 14 px) và `.lobby-action` (≥ 44 px cao, ≥ 140 px rộng, viền focus `#1e88e5`).

```html
<div id="join-status" class="lobby-alert failed" role="alert" hidden>
  <strong id="join-title"></strong>
  <p id="join-detail"></p>
  <div class="lobby-actions">
    <button type="button" id="retry-btn" class="lobby-action">Thử lại</button>
    <button type="button" id="new-world-btn" class="lobby-action">Tạo thế giới mới</button>
  </div>
</div>
```

- `type="button"` **bắt buộc**: thiếu thì nút trong form sẽ gửi form và tải lại trang (bài học T15, Thiết kế 7.6).
- CSS mới:
  - `.lobby-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }`
  - `.lobby-alert.failed .lobby-action.quiet { background: #e0e0e0; color: #263238; }` (nút phụ, cùng màu với `.net-overlay.reconnecting .net-lobby`).
- Hai nút 140 px + 8 px vừa form 340 px, nên ở điện thoại dọc chúng nằm một hàng. Ở điện thoại ngang (form dạng lưới), thẻ trải hết hai cột (`#lobby form > * { grid-column: 1 / -1 }` có sẵn).
- Nút nào không dùng thì `hidden`. Nút phụ có class `quiet`, nút chính thì không. Nút chính luôn đứng trước trong DOM (thứ tự có sẵn: Thử lại trước Tạo thế giới mới; với `closed` thì Thử lại bị ẩn, nên Tạo thế giới mới là nút chính duy nhất).
- `#join-error` bị bỏ khỏi HTML và `main.ts`. CSS `#lobby .error` giữ lại (thẻ `noscript` của T15 còn dùng).

### 5. Các tình huống, đầu cuối

| Tình huống | Kết quả |
|---|---|
| A và B chơi chung, A tải lại | `pagehide` → A rời chủ động. Địa chỉ của A có `?room=`, sảnh ghi "Quay lại…", nút có focus, Enter → cùng thế giới, đủ thú. B thấy A rời rồi vào lại |
| A chơi một mình, tải lại | Địa chỉ không có `room` → thế giới mới cùng bản đồ, như hiện nay (các e2e tải lại có sẵn vẫn đúng) |
| iOS dỡ tab của A ở nền, B còn ở trong; A mở lại sau 5 phút | Safari mở lại địa chỉ có `?room=`, sảnh "Quay lại…", vào lại đúng thế giới |
| như trên, nhưng B cũng đã rời | Thẻ "Thế giới này đã đóng / Thú, đồ và trại của bạn vẫn còn" → Tạo thế giới mới |
| iOS dỡ tab, tin rời không kịp gửi, A mở lại trong 20 giây | Chỗ của A còn được giữ. Nếu thế giới chưa đủ thì vào được, server thay phiên cũ theo token. Nếu đủ 5 người (tính cả chỗ đang giữ của chính A): thẻ "đủ 5 người", Thử lại sau 20 giây (luật có sẵn ở `multiplayer.md`, "Đã cân nhắc") |
| Server khởi động lại (deploy) | Màn che T3 "Server đang khởi động lại", địa chỉ bỏ `room`. Nếu tải lại trong lúc server chưa lên: thẻ "Không kết nối được server", Thử lại |
| Link mời cũ của thế giới đã đóng | "Thế giới này đã đóng / Xin bạn bè link mời mới…" |

### 6. Bàn phím và cảm ứng

- Thẻ lỗi: focus vào nút chính, nên Enter/Space bấm nó; Tab sang nút phụ. Viền focus có sẵn.
- Cảm ứng: mọi nút ≥ 44×44 ở 390×844, 844×390, 1280×720 (e2e đo). Focus một nút không bật bàn phím ảo; nếu bàn phím đang mở vì ô tên, chuyển focus sẽ đóng nó, để thẻ không bị che.
- Thẻ có `role="alert"`, nên trình đọc màn hình đọc ngay khi hiện.

### 7. Đã kiểm chứng (chỉ đọc; script trong scratchpad, không ghi file của repo)

- Chạy `npx tsx -e` với `boot()` của `@colyseus/testing` (`PETGAME_DB=:memory:`):
  - `joinById("nope")` → `MatchMakeError`, `code` 522, message `room "nope" not found`;
  - server không có ở cổng → `MatchMakeError`, `code` `"ECONNREFUSED"`, message `fetch failed` (Node). Trên trình duyệt `fetch` ném `TypeError` không có `cause.code`, nên `code` là `undefined`; cả hai thuộc `unreachable`.
- Đọc nguồn `@colyseus/core` 0.18.18 `MatchMaker.joinById`: phòng khoá → `ServerError(522, 'room "X" is locked')`. Route matchmake trả 503 khi server đang tắt.
- Đọc nguồn `@colyseus/sdk` 0.18.5:
  - `createMatchMakeRequest` gói mọi `ServerError` (kể cả lỗi mạng và lỗi socket khi tiêu thụ chỗ) thành `MatchMakeError(message, code)`;
  - `ErrorCode` được export từ `@colyseus/sdk`.
- E2E "6th is turned away" có sẵn chứng minh trên trình duyệt rằng thế giới đầy bị từ chối.

## Kế hoạch triển khai

1. **`packages/client/src/net/connection.ts`**
   - `import { Client, ErrorCode, type Room } from "@colyseus/sdk";`
   - Thêm:
     ```ts
     /** Why joining a world failed, as the lobby explains it. */
     export type JoinFailure = "closed" | "full" | "unreachable" | "failed";
     export function joinFailure(err: unknown): JoinFailure
     ```
     Luật theo bảng ở Thiết kế 4. JSDoc nói rõ dựa vào `"is locked"` của `MatchMaker.joinById`, và vì sao `code` không phải số nghĩa là `fetch` hỏng.
   - Không đổi `connect`, `inviteLink`, `lobbyUrl`.

2. **`packages/client/src/net/connection.test.ts`**: thêm `describe("joinFailure")`, dùng object thường và `new MatchMakeError(...)` của SDK:
   - 522 + `room "abc" not found` → `closed`; 522 + `room "abc" is locked` → `full`;
   - `code` `undefined` (message "Failed to fetch") → `unreachable`; `"ECONNREFUSED"` → `unreachable`; 503 → `unreachable`;
   - 525 → `failed`; 4002 → `failed`;
   - `new Error("x")` (không có `code`) → `unreachable`;
   - `"boom"` và `null` → `failed`.

3. **`packages/client/src/ui/joinStatus.ts`** (mới, không DOM):
   ```ts
   /** What the lobby's join card says and offers. `primary` gets the focus and comes first. */
   export interface JoinCard { title: string; detail: string; retry: boolean; newWorld: boolean; primary: "retry" | "newWorld" }
   export function joinCard(failure: JoinFailure, returning: boolean): JoinCard
   ```
   - Chữ đúng bảng Thiết kế 4; dùng `MAX_PLAYERS` từ `@petgame/shared`.
   - Thêm hằng `RETURN_HINT = "Quay lại thế giới bạn đang chơi cùng bạn bè"` và `INVITE_HINT = "Bạn được mời vào thế giới của bạn bè"` (chuyển từ `main.ts`).

   **`packages/client/src/ui/joinStatus.test.ts`**:
   - mỗi loại có tiêu đề, dòng giải thích không rỗng;
   - `closed`: chỉ `newWorld`, `primary` = `newWorld`, chữ khác nhau theo `returning` ("vẫn còn" và "link mời mới");
   - `full`: cả hai nút, `primary` = `retry`, tiêu đề chứa `String(MAX_PLAYERS)`;
   - `unreachable` và `failed`: chỉ `retry`;
   - mọi card có `primary` trỏ tới một nút đang bật.

4. **`packages/client/index.html`**
   - Thay `<div class="error" id="join-error"></div>` bằng thẻ `#join-status` (Thiết kế 4), đặt **ngay sau `#join-btn`**, trước `#load-status`.
   - Thêm 2 luật CSS (`.lobby-actions`, `.lobby-alert.failed .lobby-action.quiet`) cạnh khối `.lobby-action`.
   - Cập nhật chú thích HTML phía trên form: một dòng về `#join-status` (thẻ lỗi lúc vào thế giới, T23).
   - Không đụng script canh tải.

5. **`packages/client/src/main.ts`**
   - Bỏ `errorBox`. Lấy `joinStatus`, `joinTitle`, `joinDetail`, `retryBtn`, `newWorldBtn`.
   - Hằng `ROOM_KEY = "petgame:room"` (khoá `sessionStorage`, JSDoc: chỉ dùng để chọn chữ).
   - Lúc nạp (đồng bộ, trước khi mở khoá):
     - `const invited = new URLSearchParams(location.search).get("room");`
     - `const returning = invited !== null && safeStorage(() => sessionStorage.getItem(ROOM_KEY)) === invited;`
     - `roomHint.textContent = returning ? RETURN_HINT : invited ? INVITE_HINT : "";`
   - Hàm `setAddress(url: string)`: nếu `url !== location.href` thì `safeStorage(() => history.replaceState(history.state, "", url))`.
   - Hàm `dropWorldFromAddress()`: lấy `room` hiện có trong địa chỉ; nếu có thì `setAddress(lobbyUrl(room, false))`; rồi `roomHint.textContent = ""`.
   - Hàm `showJoinCard(card: JoinCard)`:
     - gán chữ;
     - `retryBtn.hidden = !card.retry`, `newWorldBtn.hidden = !card.newWorld`;
     - `classList.toggle("quiet", …)` cho nút không phải `primary`;
     - `joinStatus.hidden = false`, `joinBtn.hidden = true`;
     - `joinStatus.scrollIntoView({ block: "nearest" })`, rồi focus nút chính với `{ preventScroll: true }`.
   - `let joining = false;` và `async function enter()`, thân lấy từ handler `submit` hiện tại:
     - `if (joining) return; joining = true;`
     - lưu tên và ngoại hình;
     - `joinStatus.hidden = true; joinBtn.hidden = false; joinBtn.disabled = true; joinBtn.textContent = "Đang vào...";`
     - `try` như cũ (`connect` + `ConnectionWatch` + `assets`, `lobby.remove()`, `await startGame(...)`);
     - `catch (err)`: `console.error(err)`; `const failure = joinFailure(err)`; nếu `closed` thì `dropWorldFromAddress()`; `joinBtn.disabled = false; joinBtn.textContent = "Vào chơi";` rồi `showJoinCard(joinCard(failure, returning))`;
     - `finally { joining = false; }`.
   - Gắn handler:
     - `form` `submit`: `event.preventDefault(); void enter();`
     - `retryBtn` `click`: `void enter()`
     - `newWorldBtn` `click`: `dropWorldFromAddress(); void enter();`

     Gắn **trước** ba dòng mở khoá, như handler `submit` hiện nay.
   - Ba dòng mở khoá giữ nguyên. Ngay sau chúng: `if (returning) joinBtn.focus({ preventScroll: true });` rồi `document.dispatchEvent(new Event(LOBBY_READY_EVENT));`. Không `await` nào trước dòng này. Cập nhật chú thích có sẵn (nhắc T23: sự kiện vẫn chỉ đo việc tải script, không chờ server).
   - Trong `startGame`, sau khi gán `window.__petgame`:
     - `safeStorage(() => sessionStorage.setItem(ROOM_KEY, room.roomId));`
     - đồng bộ địa chỉ:
       ```ts
       let shared: boolean | undefined; // whether the address names this world (friends are in it)
       const syncAddress = () => {
         const size = room.state.players?.size ?? 0;
         if (size === 0 || (size > 1) === shared) return;
         shared = size > 1;
         setAddress(lobbyUrl(room.roomId, shared));
       };
       room.onStateChange(syncAddress);
       syncAddress();
       ```
       JSDoc hoặc chú thích: địa chỉ là nơi lần mở trang sau đưa tới; một mình thì thế giới đóng khi rời, nên không ghi `room`.
     - trong `react`, sau khi tính `withFriends`: `if (status.state === "lost") setAddress(lobbyUrl(room.roomId, withFriends));`. `syncAddress` không chạy nữa vì không còn bản vá trạng thái.
     - Nút Về sảnh giữ `location.assign(lobbyUrl(...))`.

6. **`tests/e2e/multiplayer.spec.ts`** (chi tiết ở mục Test).

7. **`docs/architecture.md`**
   - Dòng `main.ts` (khoảng dòng 64): thêm một câu về T23:
     - địa chỉ đồng bộ `?room=` bằng `history.replaceState` qua `lobbyUrl` khi có bạn bè;
     - `sessionStorage` `petgame:room` chỉ để chọn chữ "Quay lại…";
     - thẻ `#join-status` theo `joinFailure` (`net/connection.ts`) và `joinCard` (`ui/joinStatus.ts`);
     - luật ở `docs/design/multiplayer.md`.
   - Dòng helper e2e (khoảng dòng 93): `waitForWorld` báo lỗi khi sảnh hiện `#join-status` (thay `#join-error`).

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `JoinOptions`, `Profile`, server. Không ảnh hưởng dữ liệu đã lưu.
- Client:
  - địa chỉ trang có thể mang `?room=` sau khi vào. Đây đúng là dạng link mời đã có, nên địa chỉ chép từ thanh địa chỉ cũng là link mời;
  - khoá `sessionStorage` mới `petgame:room`;
  - bỏ phần tử `#join-error`, thêm `#join-status`, `#join-title`, `#join-detail`, `#retry-btn`, `#new-world-btn`. `scripts/shots.mjs` không dùng `#join-error` (đã kiểm), không cần sửa.

## Test

**Unit (Vitest, chạy trong `npm test`):** bước 2 (`joinFailure`) và bước 3 (`joinCard`). Đây là logic thuần của client, đặt cạnh file như `connection.test.ts`, `keyboard.test.ts`. Server không dùng nên không nằm ở shared.

**Tích hợp server:** không (server không đổi).

**E2E** (`tests/e2e/multiplayer.spec.ts`):

a. **Helper `waitForWorld`**: thay đọc `#join-error` bằng: `const card = document.getElementById("join-status"); return card && !card.hidden ? card.textContent : false;`. Sửa JSDoc của nó.

b. **"5 players share one world and a 6th is turned away"** (sửa):
   - Sau `join(…"TooMany"…)`:
     - `#join-status` hiện, chứa "đủ 5 người";
     - `#retry-btn` có focus; `#new-world-btn` hiện và có class `quiet`;
     - `#join-btn` ẩn;
     - địa chỉ vẫn `room=roomId`.
   - Rồi `await guests[0].leave()`, `sixth.keyboard.press("Enter")` (Thử lại), `waitForWorld(sixth)`:
     - `roomId` của sixth bằng `roomId`;
     - `expect.poll` địa chỉ của sixth có `room=roomId` (có bạn bè, đồng bộ địa chỉ).
   - Phần còn lại giữ nguyên.
   - Tên test có thể thêm ", and gets in once a place is free".

c. **"lobby: nothing is sent before the lobby script is ready…"** (sửa phần cuối, sau `enterLobby(page, "Early", "enter")`):
   - `#join-status` hiện, chứa "Thế giới này đã đóng" và "link mời mới" (được mời, không có dấu `sessionStorage`);
   - `#new-world-btn` có focus; `#retry-btn` ẩn;
   - `#room-hint` rỗng;
   - `room` **bị bỏ** khỏi địa chỉ, `quality` vẫn `low`, `navigations` vẫn 1. Đổi chú thích: thẻ "đã đóng" chỉ có thể đến từ `joinById("no-such-room")` của handler, và địa chỉ đổi bằng `replaceState` chứ không tải trang;
   - giữ kiểm tra tên trong `localStorage` và `#load-status` ẩn.
   - Không bấm Tạo thế giới mới (test này cố ý không nạp WebGL).

d. **"connection: when the world has let the player go…"** (sửa nhỏ):
   - Địa chỉ đã có `room=roomId` trước khi chạm Về sảnh (đồng bộ lúc có bạn và lúc mất), nên `page.waitForURL(/[?&]room=/)` xong ngay mà chưa tải trang.
   - Đổi thành: `const loaded = page.waitForEvent("load"); await page.locator(".net-lobby").tap(); await loaded;`, giữ kiểm tra `room` và `quality`.
   - Thêm trước khi chạm: `expect(new URL(page.url()).searchParams.get("room")).toBe(roomId)` (địa chỉ đã đúng ngay khi mất).
   - Sau khi vào sảnh mới: `#room-hint` là "Quay lại thế giới bạn đang chơi cùng bạn bè" (cùng tab nên `sessionStorage` còn).

e. **Test mới** `"lobby: a reload goes back to the world friends are in; a closed world or an unreachable server says so, with a way on"`, `test.slow()`:
   - **Phần 1, desktop, bàn phím:**
     - `join(browser, "Back")`, `waitForWorld`, lấy `roomId`. Chờ `game.frames > 0`.
     - Một mình: `expect.poll` `room` của địa chỉ là `null`, `quality` là `low`.
     - `const friend = await observer(roomId, "Friend")`: `expect.poll` địa chỉ có `room=roomId`.
     - `page.reload()`:
       - `#room-hint` là "Quay lại thế giới bạn đang chơi cùng bạn bè";
       - chờ `#join-btn:enabled`; `#join-btn` có focus; `#name` có tên cũ;
       - `page.keyboard.press("Enter")`, `waitForWorld`;
       - `roomId` bằng cũ; `playerCount` là 2; `friend.state.players.size` là 2.
     - Bạn rời (`void friend.leave()`, bỏ khỏi `observers`, hoặc `friend.leave()` có await): `expect.poll` `room` của địa chỉ thành `null`.
     - Thế giới đóng khi đang ở ngoài, cùng tab:
       - `const friend2 = await observer(roomId, "Friend2")`, `expect.poll` địa chỉ có `room`, lưu `const back = page.url()`;
       - `page.goto("about:blank")` (rời chủ động); `expect.poll(() => friend2.state.players.size).toBe(1)`; `friend2.leave()` (thế giới đóng);
       - `page.goto(back)`, `enterLobby(page, "Back")`;
       - `#join-status` chứa "Thế giới này đã đóng" và "vẫn còn" (quay lại);
       - `#new-world-btn` có focus; `room` bị bỏ khỏi địa chỉ.
       - Không vào thế giới mới ở phần này (đỡ một lần nạp WebGL).
   - **Phần 2, điện thoại dọc (`PHONE_SCREENS[0].options`), cảm ứng:**
     - Một thế giới đã đóng: `const gone = await new Client(SERVER).create("world", { name: "Gone" }); const closedId = gone.roomId; await gone.leave();`
     - `page.route(/:2567\/matchmake\//, (route) => route.abort())`; mở `/?room=${closedId}&quality=low`:
       - `#room-hint` "Bạn được mời…";
       - `enterLobby` rồi `#join-status` "Không kết nối được server"; `#retry-btn` có focus; `#new-world-btn` ẩn; địa chỉ vẫn có `room=closedId`.
     - `page.unroute(...)`, `#retry-btn` `.tap()`:
       - `#join-status` "Thế giới này đã đóng" và "link mời mới";
       - `room` bị bỏ;
       - kích thước `#new-world-btn` ≥ 44×44 ở 390×844, 844×390, 1280×720 (rồi trả về 390×844).
     - `#new-world-btn` `.tap()`, `waitForWorld`: `roomId` khác `closedId`; địa chỉ không có `room`; `quality` là `low`.
     - Đếm `framenavigated` của khung chính: đúng 1 (chỉ lần mở; mọi đổi địa chỉ là `replaceState`).

f. Không có e2e tải lại nào khác bị ảnh hưởng: các test "Tamer", "Stylist" tải lại khi chơi một mình nên vẫn vào thế giới mới. Test "Thuần" tải lại khi có `observer` "Bạn" nên giờ về đúng thế giới đó; kiểm tra của nó vẫn đúng. Coder chạy cả bộ để chắc.

**Lệnh:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (cả bộ; khi sửa thì chạy riêng `-g "lobby:"`, `-g "6th"`, `-g "let the player go"`).

## Tiêu chí hoàn thành

- [ ] `joinFailure` trong `net/connection.ts` theo đúng bảng Thiết kế 4; unit test đủ các ca ở bước 2.
- [ ] `joinCard` trong `ui/joinStatus.ts` có đúng chữ tiếng Việt ở bảng Thiết kế 4 (số người lấy từ `MAX_PLAYERS`); unit test ở bước 3.
- [ ] `#join-error` không còn trong `index.html`, `main.ts`, e2e. Chữ "Không vào được phòng (đầy 5 người hoặc server chưa chạy)." không còn.
- [ ] Thẻ `#join-status` dùng `.lobby-alert.failed`; các nút có `type="button"` và class `.lobby-action`; nút phụ có class `quiet`. Nút đạt ≥ 44×44 ở 390×844, 844×390, 1280×720 (e2e).
- [ ] Vào hỏng: `#join-btn` ẩn, thẻ hiện, nút chính có focus. Lúc đang vào: nút ghi "Đang vào..." và bị khoá. Không gọi `enter()` chồng.
- [ ] `closed`: `room` bị bỏ khỏi địa chỉ bằng `replaceState` (không tải trang), `#room-hint` rỗng. "Tạo thế giới mới" vào ngay một thế giới mới.
- [ ] `full`: địa chỉ giữ `room`; Thử lại vào được khi có chỗ.
- [ ] Trong lúc chơi, địa chỉ có `?room=<roomId>` đúng khi `players.size > 1`, không có khi `size === 1`. Các tham số khác và `#…` được giữ. `replaceState` chỉ gọi khi giá trị đổi.
- [ ] Mất hẳn kết nối: địa chỉ bằng đúng URL của nút Về sảnh.
- [ ] Tải lại khi có bạn bè: về đúng thế giới. Sảnh ghi "Quay lại thế giới bạn đang chơi cùng bạn bè", `#join-btn` có focus, Enter vào được (e2e).
- [ ] `petgame:lobby-ready` vẫn bắn đồng bộ ngay sau ba dòng mở khoá, không có `await` hay yêu cầu server nào trước nó. 3 test `lobby:` của T15 vẫn qua không sửa phần canh tải.
- [ ] Đọc, ghi `sessionStorage` và `history.replaceState` đều bọc `safeStorage`.
- [ ] Không có thay đổi ở `packages/server`, `packages/shared`, script canh tải inline.
- [ ] `docs/architecture.md` cập nhật 2 chỗ ở bước 7; `docs/design/multiplayer.md` khớp hành vi.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` đều sạch; không nới lỏng test có sẵn ngoài các sửa ghi ở mục Test.

## Rủi ro, câu hỏi mở

Không có "CHẶN:". Quyết định đã tự chọn (kèm lý do ở trên):
- hướng `replaceState`, không `reconnect`;
- không tự vào lại khi mở trang;
- một mình thì không ghi `room`;
- phân biệt đầy/đóng bằng chữ `"is locked"`.

Rủi ro:
1. **Chữ lỗi của Colyseus đổi** (`"is locked"`) khi nâng cấp: đầy sẽ bị báo thành "đã đóng". Unit test ghim chuỗi, e2e "6th" bắt được.
2. **Người chơi một mình tải lại thì link mời họ vừa gửi chết**, vì thế giới đóng ngay khi người cuối rời. Đã có từ trước T23, không tệ hơn. Đề xuất việc riêng: giữ thế giới trống sống khoảng 30-60 giây.
3. **Hai người cùng tải lại một lúc** (chỉ có hai người): cả hai rời, thế giới đóng, cả hai gặp thẻ "đã đóng" → Tạo thế giới mới, rồi mỗi người một thế giới. Hiếm; thẻ nói rõ và gợi ý xin link mời mới.
4. **PWA ở Màn hình chính** (`display: fullscreen`, `start_url: "/"`): iOS mở lại app từ `start_url`, mất `?room=` và `sessionStorage`. T23 chỉ chữa trường hợp tab Safari. Đề xuất việc riêng (gắn với T13): lưu thế giới gần nhất (id + thời điểm) vào `localStorage` và cho sảnh hiện nút "Quay lại thế giới vừa chơi" khi còn mới.
5. **`assets` hỏng sau khi đã vào phòng:** phiên vừa vào còn treo đến khi Thử lại; khi đó server tự thay phiên cũ theo token. Không thành hai bản người chơi. Để T42 xử lý chung phần lỗi sau khi vào.
6. **Safari giới hạn `replaceState`:** chỉ gọi khi đổi giá trị, và bọc `try`.
7. Enter trong ô tên khi nút submit ẩn: hành vi tuỳ trình duyệt, cả hai đường đều đúng (Thiết kế 4); không viết test cho nó.

## Đề xuất việc mới cho `TASKS.md`

- **P2 – Giữ thế giới trống thêm một lúc.** Người cuối rời thì Colyseus đóng thế giới ngay, nên người chơi một mình tải lại là mất thế giới, và link mời vừa gửi bạn bè chết. Giữ phòng trống khoảng 30-60 giây (`autoDispose = false` + hẹn giờ trong `GameRoom`). Khi đó địa chỉ của T23 có thể ghi `room` cả khi chơi một mình. Cần test tích hợp và cân nhắc tài nguyên server.
- **P2 – App ở Màn hình chính quay lại thế giới vừa chơi** (gắn T13). `start_url` làm mất `?room=` khi iOS mở lại app: lưu id thế giới gần nhất kèm thời điểm vào `localStorage`, sảnh hiện nút phụ "Quay lại thế giới vừa chơi" nếu chưa quá vài phút; thế giới đã đóng thì dùng thẻ của T23.
