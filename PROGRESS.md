# PROGRESS: T3 Kết nối lại sau khi rớt mạng

## Vòng 1: coder (Bước A: shared + server)

Chỉ làm Bước A của PLAN.md (shared + server + test tích hợp). Không đụng `packages/client`, `tests/e2e`, `docs/` (việc của Bước B). Mục này ghi đè PROGRESS.md của T17 (đã xong, còn trong lịch sử git ở `632fa73`).

- [x] **A.1 Hằng số** (`packages/shared/src/constants.ts`): `RECONNECT_GRACE_MS = 20_000`, `RECONNECT_TRY_MS = RECONNECT_GRACE_MS + 10_000` (30 s), `CLOSE_REPLACED = 4201`, kèm JSDoc.
- [x] **A.2 Schema** (`packages/shared/src/schema.ts`): `Player.offline: t.boolean()` ở cuối `Player`, kèm JSDoc.
- [x] **A.3 Server** (`packages/server/src/rooms/GameRoom.ts`), đúng mục 3 của PLAN:
  - Import `Deferred` (cạnh `Room`) từ `"colyseus"`; `liveSessions` cấp module sau `useStore`; hai trường `holds`, `reconnectGraceMs` cạnh `controls`.
  - `onJoin`: kết thúc phiên cũ cùng token **trước** `store().load`; `player.offline = false`; `liveSessions.set` ngay sau `controls.set`.
  - Hàm mới, đều có JSDoc: `onDrop(client)`, `onReconnect(client)`, `onDispose()`, `removePlayer(sessionId)`, `endSession(sessionId)`; `onLeave(client)` chỉ còn gọi `removePlayer`.
  - `sheltered(target)` dùng ở `targetPos`, `wildTarget` (qua hàm cục bộ `consider`) và `damage()`. `tickCompanions`, `tickExploration`, `tickClimate`, `tickRegen` bỏ qua người đang chờ và thú của họ. Không chặn thêm chỗ nào khác.
  - `debug:endGrace` trong khối `PETGAME_DEBUG`.
- [x] **A.4 Test** (`packages/server/src/rooms/GameRoom.test.ts`): `describe("reconnecting after a dropped connection")` ở cuối file, gồm helper `cutConnection`, `holdReconnect`, `reconnected`, `crowd`, `holdsOf` và 10 test (8 của PLAN + 2 thêm, xem "Lệch kế hoạch"). Import thêm `CloseCode`, `CLOSE_REPLACED`, `MAX_PLAYERS`, `Chest`.
- [x] **A.5** `npm run typecheck` và `npm test` sạch (xem "Lệnh đã chạy").

### Bước B cần biết

- **Shared** (từ `@petgame/shared`): `RECONNECT_GRACE_MS` (20 000 ms), `RECONNECT_TRY_MS` (30 000 ms), `CLOSE_REPLACED` (4201). Trường `Player.offline: boolean`: client đọc qua `$.onAdd("players")` và `$.onChange`; `true` khi người đó đang chờ nối lại.
- **Không có tin riêng cho việc nối lại.** Dùng cơ chế sẵn có của Colyseus 0.18: SDK nối lại tại chỗ trên chính `Room` (cùng `sessionId`, token mới); server gọi `onDrop`, rồi `onReconnect`.
- **Rớt mạng** = socket đóng với mã khác 4000. Lúc đó `onDrop` đặt `offline = true`, xoá ý định (`control.input = {0, 0}`, hết lướt, hết lệnh chiêu, hết aggro), huỷ chiêu chưa phát của thú đi theo và lưu ngay. ⇒ Sau khi nối lại, **client phải gửi lại `Input`** hiện tại (server không giữ hướng đi): đặt `lastSentInput = { x: 0, y: 0 }` như PLAN mục 4.
- **Server chỉ thấy socket chết qua ping (6-9 s).** Trong 6-9 s đầu của một cú treo mạng, người chơi chưa `offline` (chưa được bảo vệ).
- **Mã đóng client có thể nhận ở `room.onLeave(code)`:**
  - 4000 `CONSENTED`: chính client gọi `leave`.
  - 4001 `SERVER_SHUTDOWN`.
  - 4003 `FAILED_TO_RECONNECT`: lần thử nối muộn khi chỗ giữ đã hết hạn, đã bị trả (`debug:endGrace`, bị thay bởi lần vào mới) hoặc token đã dùng.
  - 4201 `CLOSE_REPLACED`: cùng thiết bị vừa vào lại (tab khác, tải lại trang, thế giới khác) trong lúc tab này còn kết nối. SDK không tự nối lại với mã này.
- **Cùng thiết bị vào lại** (cùng token, trong toàn process): phiên cũ được lưu rồi xoá ngay, **trước** khi phiên mới đọc hồ sơ. Phiên cũ đang chờ nối lại thì chỗ được trả ngay (lần thử nối muộn của nó nhận 4003); phiên đang mở nhận 4201.
- **Rời chủ động**: `room.leave()` (consented, mã 4000) → `onLeave` ngay: lưu rồi xoá, không giữ chỗ. Client cần gọi nó ở `pagehide` (PLAN B). Tin rời không kịp đến thì server coi là rớt mạng (giữ 20 s).
- **Phòng đủ 5 người có người đang chờ**: người mới bị từ chối (`MatchMakeError` "room ... is locked"); người đang chờ vẫn vào lại được.
- **Hook `debug:endGrace`**: tin chuỗi, không có payload (`room.send("debug:endGrace")`), chỉ đăng ký khi `PETGAME_DEBUG=1` (Playwright tự đặt).
  - Kết thúc ngay mọi lần chờ trong **phòng của người gửi**, như hết hạn: người đang chờ bị xoá (người khác thấy `players` mất mục đó), lần thử nối sau đó của họ nhận 4003.
  - Người gửi phải là một client đang kết nối (người quan sát): người đang chờ không gửi được.
  - Cần thêm `endGrace` vào danh sách hook `debug:*` ở `docs/architecture.md` (Bước B9) và `CLAUDE.md` (agent chính sửa, PLAN.md P3).
- **Resync** (đã chạy thử ở PLAN mục 1): xoá đi trước thêm cho cùng một khoá; client không cần làm gì thêm.

### Lệch kế hoạch

- **Code sản phẩm: không lệch** (đúng mục 3 của PLAN). Chi tiết nhỏ: `wildTarget` lọc bằng hàm cục bộ `consider(target)` gọi `sheltered`, không tạo thêm đối tượng cho mỗi ứng viên.
- **Thời gian giữ chỗ trong test dài hơn PLAN:** test 3 dùng `reconnectGraceMs = 1000` (PLAN 300), test 4 dùng 1500 (PLAN 400). Lý do: phép kiểm "đã lưu ngay lúc rớt" (test 3) và "người thứ 6 bị từ chối" (test 4) phải chạy trước khi hết hạn. Với 300/400 ms, máy chậm có thể làm hết hạn trước lúc kiểm; riêng test 3 khi đó vẫn qua dù thiếu `saveNow` ở `onDrop` vì `removePlayer` cũng lưu, tức bỏ sót đột biến M6.
- **Hai test thêm** ngoài 8 test của PLAN, cùng describe:
  - `a drop wipes what the player was doing: the walk, a dash, an ordered skill, the fight and the skill their pal was winding up`: tiêu chí "Rớt mạng (server)" của PLAN đòi các thứ này nhưng 8 test không kiểm.
  - `the test hook that ends the wait lets a dropped player go at once`: hook `debug:endGrace`, e2e Bước B dựa vào nó.
- **Phép kiểm thêm vào các test của PLAN** (vì đột biến M5b, M13, M17-M20, M23, M25 sống sót với bộ test đầu; xem bảng dưới):
  - Test 1: thú bị thương nửa máu trước khi rớt (kiểm thú không hồi máu); sau khi nối lại `holds` rỗng.
  - Test 2: đổi tên thành `time stands still for a player who is away: the cold does not hurt, nothing heals, no chest opens, no quest moves`; thêm rương dưới chân và nhiệm vụ đi thăm vùng tuyết (không mở rương, không tiến nhiệm vụ).
  - Test 7: sau khi tab cũ đóng hẳn, `onLeave` muộn của nó không động tới thú mới cùng id.
  - Test 8: ở phòng đủ 5 người có chỗ giữ, chỗ được trả ngay khi cùng thiết bị vào thế giới khác (`hasReachedMaxClients()` từ `true` sang `false`).

### Kiểm tự làm (không thay cho tester)

- Đột biến trên bản sao ngoài repo (`GameRoom.ts` đổi một chỗ, chạy `-t "reconnecting after a dropped connection"`, mỗi đột biến một lần; vòng 1 với 9 test đầu, vòng 2 với 10 test cuối cho nhóm sống sót). **24/25 bị bắt:**

  | Đột biến | Test bắt được |
  |---|---|
  | M1 bỏ `allowReconnection` trong `onDrop` | 7 test (cả 1, 2, 3, 4, 6, 8 và hook) |
  | M2 bỏ cổng `sheltered` trong `damage()` | 1 (vị trí và máu đổi) |
  | M3 bỏ `if (owner.offline) return` ở `tickCompanions` | 1 (thú chạy về chủ) |
  | M4 bỏ chặn ở `tickClimate` | 2 (máu 48, không phải 50) |
  | M5 bỏ chặn người ở `tickRegen` | 2 (máu 60) |
  | M5b bỏ chặn thú ở `tickRegen` | 1 (thú hồi máu), chỉ sau khi củng cố |
  | M6 bỏ `saveNow` trong `onDrop` | 3 |
  | M7 đọc hồ sơ trước khi kết thúc phiên cũ | 7 (thú không sang phiên mới) |
  | M8 bỏ `liveSessions.set` | 7 (hết giờ), 8 |
  | M9 bỏ cổng ở `targetPos` | 1 (aggro vẫn nhắm người chơi) |
  | M10 bỏ lọc ở `wildTarget` | 1 |
  | M11 `onReconnect` giữ `offline` | 1, 6 |
  | M12 `removePlayer` không xoá `holds` | 3, 8, hook |
  | M13 `endSession` không `reject` chỗ giữ | 8, chỉ sau khi củng cố |
  | M14 `endSession` không gửi `CLOSE_REPLACED` | 7 (nhận 1006) |
  | M16 `onDrop` giữ hướng đi | 1 (nhân vật đi tiếp) |
  | M17 / M18 / M19 / M20: `onDrop` giữ lướt / lệnh chiêu / aggro / chiêu đang gồng | "a drop wipes...", chỉ sau khi củng cố |
  | M22 `sheltered` bỏ qua thú | 1 |
  | M23 bỏ chặn ở `tickExploration` | 2 (rương mở), chỉ sau khi củng cố |
  | M25 `removePlayer` không lọc theo `ownerId` | 7 (`onLeave` muộn xoá thú mới), chỉ sau khi củng cố |
  | M26 `onReconnect` không xoá `holds` | 1, chỉ sau khi củng cố |
  | **M24 sống sót:** `removePlayer` không bỏ mục `liveSessions` | không quan sát được: mục thừa chỉ khiến `endSession` chạy lên một phiên đã mất (không làm gì); `onDispose` dọn khi phòng đóng |

- Công cụ tạm của coder (ngoài repo, dùng lại được): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t3coder/` (`mutate.py <BASE|M1..M26> ...` áp đột biến lên `copy/` rồi khôi phục; `GameRoom.base.ts`; nhật ký `run1.log`, `run2.log`). Muốn dùng lại thì chép `GameRoom.ts` và `GameRoom.test.ts` hiện tại vào `copy/packages/server/src/rooms/` và `GameRoom.base.ts` trước.
- `GameRoom.test.ts` luôn nghe ở cổng 2568: `boot` của `@colyseus/testing`, khi nhận một `Server`, dùng `DEFAULT_TEST_PORT` và bỏ qua tham số `2571` trong `beforeAll`. Đừng chạy hai lần song song (kể cả bản sao ngoài repo).
- Test dùng trường và hàm riêng của `GameRoom` qua `as any`: `holds`, `reconnectGraceMs`, `controls`, `wildAggro`, `lastDamagedAt`, `casts`, `castingUntil`, `obstacles`, `saveNow`, `damage`, `provoke`, `startCast`. T10 (tách `GameRoom.ts`) phải giữ chúng hoặc sửa test theo.

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch, trên file cuối).
- `npm test` ✓ (20 file, **204 test** = 194 cũ + 10 mới, 76 s).
- `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "reconnecting after a dropped connection"` ✓ 8 lần liền, mỗi lần 10/10 (khoảng 13 s).
- `npm run build` ✓ (không đụng client; chạy để chắc trường schema mới đóng gói được).
- Không chạy e2e (Bước B). Không để server chạy nền; cổng 2567, 2568, 5173 trống sau khi xong.

## Vòng 1: coder (Bước B: client + e2e + tài liệu)

Làm Bước B của PLAN.md. Không sửa lại Bước A (shared + server): không phát hiện lỗi ở đó.

- [x] **B.1 `packages/client/src/net/reconnect.ts` (mới):** `ConnectionWatch` (`status`, `online`, `onChange`, `leave`), `NetStatus`, `LostReason`, `lostReason`, `SDK_RECONNECTION`, `PING_EVERY_MS` 2000, `STALL_MS` 6000, `SLEPT_GAP_MS`, `WatchedRoom`. Đúng mục 4 của PLAN.
- [x] **B.2 `packages/client/src/net/reconnect.test.ts` (mới):** unit test đầu tiên của client, chạy trong Node: 9 test của PLAN + 2 thêm (xem "Lệch kế hoạch").
- [x] **B.3 `packages/client/src/net/connection.ts`:** `lobbyUrl(roomId, withFriends)`.
- [x] **B.4 `packages/client/src/ui/connection.ts` (mới):** `ConnectionOverlay`, bảng chữ `TEXT` ở đầu file (đúng bảng mục 4: Đang kết nối lại…, Không kết nối lại được, Bạn đang chơi ở nơi khác, Server đang khởi động lại, Bạn đã rời thế giới).
- [x] **B.5 `packages/client/index.html`:** CSS `.net-*` (sau khối `.party-confirm`) và `.label.offline span`.
- [x] **B.6 `packages/client/src/main.ts`:** `ConnectionWatch` tạo ngay khi vào được phòng, `pagehide` → `watch.leave()`, `ConnectionOverlay` nối với `watch.onChange` (áp ngay một lần nếu đã rớt lúc tải hình), `Game.create(..., watch)`.
- [x] **B.7 `packages/client/src/game/Game.ts`:** `send()` chỉ gửi khi `watch.online` (thay mọi `this.room.send(`); `attack`, `dash`, `throwBall` và phím 1-3 không làm gì khi chưa online; `frame()` dùng `STILL` khi mất kết nối; sau khi nối lại đặt `lastSentInput = STILL` + toast "✅ Đã kết nối lại"; rớt thì huỷ lướt; `visibilitychange` ẩn trang thì gửi `Input` đứng yên một lần; người khác đang chờ hiện mờ (`AWAY_ALPHA` 0,45) và tên kèm "(mất kết nối)"; bỏ toast "Mất kết nối với server".
- [x] **B.8 `tests/e2e/multiplayer.spec.ts`:** helper `openWithSwitch` (`cut`, `restore`, và `freeze` thêm), `observer`; 6 test `connection: ...` (3 của PLAN + 3 thêm, xem "Lệch kế hoạch"). `observers` được dọn trong `afterEach`.
- [x] **B.9 Tài liệu:** `docs/architecture.md` (server "Kết nối lại", hook `endGrace`, client `net/reconnect.ts` và `ui/connection.ts`, kiểm thử: `cutConnection`, `holdReconnect`, `reconnected`, `openWithSwitch`, `observer`, vì sao `routeWebSocket` thay `setOffline`, init script phụ, tin `pagehide` không qua route), `docs/choi-tren-iphone.md` (mẹo mất mạng).
- [x] **B.10** typecheck, test, build, e2e (xem "Lệnh đã chạy").

### Lệch kế hoạch

- **`openWithSwitch` cần thêm một init script** (PLAN không có). SDK mở socket bằng `new WebSocket(url, { headers, protocols })` và chỉ lùi về `new WebSocket(url)` khi lớp WebSocket thật ném lỗi (tham số thứ hai là object). Lớp thay thế của Playwright (`routeWebSocket`) không ném, rồi `connectToServer()` âm thầm không bao giờ nối được (lỗi `SyntaxError` bị nuốt trong `__pwWebSocketDispatch`): trang không bao giờ vào thế giới và test treo đến hết 540 s (lần chạy đầu của tôi mất 9 phút). Các spike của designer dùng `WebSocket` thuần nên không thấy. Cách sửa: `context.addInitScript` đặt **sau** `routeWebSocket`, bọc lớp thay thế cho ném `SyntaxError` với tham số thứ hai không phải chuỗi hay mảng, y như lớp thật. Đã ghi vào JSDoc của `openWithSwitch` và `docs/architecture.md`. Dòng `console.error "WebSocket is already in CLOSING or CLOSED state."` trong nhật ký trang khi cắt mạng là tiếng ồn vô hại của lớp thay thế (một tin từ server đến sau khi phía trang đã đóng); nhật ký chỉ in khi test hỏng.
- **Ba test e2e thêm** (ngoài 3 của PLAN), vì mỗi cái chứng minh một chỗ của Bước B mà 3 test kia không chạm tới:
  - `a friend sees who is waiting to reconnect, dimmed and marked, and who is back`: hai trang; người khác đang chờ hiện mờ (`root.alpha` dưới 0,6), tên "Drifter (mất kết nối)", rồi trở lại bình thường.
  - `a page that goes to the background stops walking at once, and walks again when it is back`: giữ phím đi, ẩn trang (mô phỏng `visibilitychange` và dừng vòng lặp như trình duyệt làm); người quan sát thấy nhân vật dừng, rồi đi tiếp khi trang hiện lại.
  - `a connection that goes silent without closing is noticed, and the player comes back`: `freeze()` (socket mở nhưng không gì qua được): lớp phủ hiện sau 6-8 giây nhờ watchdog, rồi nối lại được đúng người, đúng `Room`. Vì thế `openWithSwitch` chuyển tin hai chiều bằng tay (`onMessage`, `onClose`) thay vì để Playwright tự chuyển.
- **Test 1 của PLAN được mở rộng:** trong lúc mất mạng thử thêm các phím Shift, E, B, H, 1 (không tin nào đi: bắt được lỗi `send` không chặn) và nhân vật không dịch chuyển trên màn hình (lấy mẫu suốt 600 ms, vì một lần lấy mẫu có thể trúng khung hình vừa kéo về: bản đầu chỉ lấy mẫu một lần và để lọt đột biến G3); thêm pha giữ phím "a" suốt thời gian mất mạng, nối lại xong vẫn đi tiếp không cần bấm lại (bắt được lỗi quên đặt lại `lastSentInput`).
- **Hai test unit thêm** trong `reconnect.test.ts` (ngoài 9 test của PLAN): `does not give up once back online` (hẹn bỏ cuộc không làm gì khi đã nối lại) và `lets a listener that throws spoil neither the others nor the SDK` (xem dưới). Test "stops watching" và "leaving on purpose" thêm kiểm `vi.getTimerCount() === 0` (dừng thật, không chỉ bỏ qua).
- **`ConnectionWatch` bọc từng listener trong `try/catch`** (PLAN không nói): listener chạy ngay trong xử lý `onDrop` của SDK, trước khi SDK gọi `handleReconnection`; một listener ném lỗi sẽ làm SDK không bao giờ bắt đầu nối lại.
- **"Về sảnh" sau khi server khởi động lại** (`lost`/`shutdown`) luôn về sảnh thường, không kèm `?room=` (PLAN: `players.size > 1`): khi server tắt, mọi thế giới mất theo, nên `?room=<id>` chắc chắn báo lỗi ở sảnh.
- **Nút "Về sảnh" tự xử lý phím Space.** `keyboard.ts` huỷ mặc định của phím game (Space là Đánh) trên mọi nút, nên Space không bấm được nút đang có focus; PLAN ghi "Enter hoặc Space bấm được ngay", nên nút tự bắt Space (đã thử: Space đưa về sảnh kèm `?room=`).
- **e2e:** `observer` đăng ký vào mảng `observers`, `afterEach` cho rời (không `await`: phòng đã rời không trả lời nữa), nên test không phải tự `leave()` và test hỏng cũng không để người chơi ma. Test 2 thêm kiểm `elementFromPoint` ở chỗ nút Đánh (lớp phủ chặn chạm), như test hộp thả thú; `waitForURL` có hạn 15 s (mặc định chờ hết cả 540 s của test).
- Không có unit test cho `lobbyUrl` (cần `location`, mà unit test của client chạy trong Node): test e2e 2 kiểm URL.

### Rủi ro và đề xuất (không làm trong nhiệm vụ này)

- **Một lần thử nối lại bị treo làm kẹt cả vòng thử.** SDK chỉ thử lại khi một lần thử đóng (`onclose`); nó không có hạn giờ cho một lần thử đã mở được TCP mà không nhận được `JOIN_ROOM`. Mạng "hố đen" (cổng đăng nhập Wi-Fi, đường 4G chết nửa chừng) có thể làm một lần thử treo hàng chục giây: khi đó người chơi chờ đến hết `RECONNECT_TRY_MS` (30 s) rồi thấy "Không kết nối lại được" thay vì được thử lại mỗi 2 giây. Tôi gặp đúng chuyện này trong một spike (do lỗi của spike, nhưng cơ chế thật). Cách chữa có thể: trong lúc `reconnecting`, nếu `room.reconnection.retryCount` không đổi quá `STALL_MS` thì `connection.close(4010)` để SDK bỏ lần thử treo và thử lần mới. Thêm vào TASKS nếu designer thấy đáng.
- Các rủi ro khác (Android giữ socket sống, `pagehide` trên iOS...) đã có trong PLAN.

### Kiểm tự làm (không thay cho tester)

- **Ảnh chụp Playwright** (thư mục tạm, không commit): điện thoại dọc 390×844, ngang 844×390, máy tính 1280×720. Màn "Đang kết nối lại…" (vòng quay, nút xám) và "Không kết nối lại được" (nút xanh) vừa khung hình ở cả ba cỡ; "Bạn đang chơi ở nơi khác"; người khác đang chờ hiện mờ với tên "Drifter (mất kết nối)" rồi trở lại bình thường; nút "Về sảnh" có focus sau khi mất hẳn.
- **Đột biến, unit test** (bản sao ngoài repo, mỗi lần đổi một chỗ của `reconnect.ts`): 17/17 bị bắt (bỏ `maxEnqueuedMessages: 0`, bỏ kiểm tra treo, bỏ luật "trang vừa ngủ", `giveUp` không tắt `enabled` hay `maxRetries`, không trả chỗ khi nối muộn, `leave` không báo, không dừng interval hay hẹn bỏ cuộc, `onDrop` không chặn lần hai, bỏ `try/catch`, sai lý do, không nghe state, đổi hạn bỏ cuộc...). Lúc đầu 1 đột biến sống (hẹn bỏ cuộc không bị huỷ khi rời); thêm kiểm `vi.getTimerCount()` thì bắt được.
- **Đột biến, e2e** (đổi một chỗ ở client trong cây làm việc, chạy test tương ứng, rồi khôi phục; đã kiểm bằng `sha256sum`): `send` không chặn (G1), không gửi lại hướng đi (G2), `frame()` không dùng `STILL` (G3), không làm mờ người khác (G5), bỏ `visibilitychange` (G6), bỏ `pagehide` (G8), bỏ focus (G9), "Về sảnh" bỏ `?room=` (G10), lớp phủ không bao giờ hiện (G11), bỏ watchdog (G12): cả 10 bị bắt. Hai đột biến G1 và G3 lúc đầu sống sót với bản test đầu (xem "Test 1 được mở rộng").

### Lệnh đã chạy

- `npm run typecheck` ✓ (sạch; client, shared, server). Test e2e kiểm kiểu riêng bằng một `tsconfig` tạm ngoài repo (các file e2e không nằm trong `npm run typecheck`): sạch.
- `npm test` ✓: 21 file, **215 test** (204 của Bước A + 11 mới của `reconnect.test.ts`), 76 s.
- `npx vitest run packages/client/src/net/reconnect.test.ts` ✓ (11 test, dưới 1 s).
- `npm run build` ✓.
- `npx playwright test -g "connection:" --repeat-each=3 --workers=1` ✓ **18/18** (6 test × 3 lượt, 3,3 phút).
- `npm run test:e2e` ✓ **22/22** (16 test cũ + 6 test `connection:`, 3,7 phút), gồm test tải lại trang "a captured pal follows…".
- Không để server chạy nền: cổng 2567, 2568, 5173 trống sau khi xong. Lần chạy e2e đầu tiên của tôi (trước khi có init script) bị treo 9 phút rồi hết giờ: đã dọn các tiến trình còn sót.
- Công cụ tạm của coder (ngoài repo, dùng lại được): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t3b/` (`mut/mutate.py`: đột biến `reconnect.ts` trên bản sao; `emut.py`: đột biến client rồi chạy e2e tương ứng và khôi phục file; `shots.mjs`: ảnh chụp lớp phủ).

## Kiểm thử vòng 1: PASS

- typecheck ✓   test ✓ (221)   build ✓   e2e ✓ (22)   photo3d (không chạy: không đụng `tools/photo3d`)
- Máy 4 nhân. Mọi lần chạy tuần tự (cổng 2567, 2568, 5173 không chạy chồng). Số lần chạy:
  - `npm test` **5 lần liền** trên bản của coder: 5/5 qua (21 file, 215 test, 75-76 s). Sau khi tôi thêm test: 22 file, **221 test** qua (1 lần).
  - Nhóm `reconnecting after a dropped connection` **10 lần**: 10/10 (10 test). Sau khi thêm 2 test: 6 lần với 4 vòng lặp bận chiếm hết 4 nhân (giả lập máy CI chậm): 6/6 (12 test, 19-20 s so với 14-15 s bình thường): các test giữ chỗ 1000/1500 ms không chập chờn.
  - `reconnect.test.ts` 3 lần: 3/3 (11 test). `npm run build` ✓. `npm run typecheck` ✓ (đầu và cuối).
  - e2e cả bộ `--workers=1`: lượt 1 **22/22**; lượt 2 **21/22** (1 chập chờn, Lỗi 1); lượt cuối sau khi sửa test **22/22** (3,4 phút). `connection:` lặp 4 lần: 24/24; sau khi sửa lặp 3 lần: 18/18; riêng test chập chờn lặp 12 lần: 12/12.
  - Kiểm đột biến độc lập, 9 đột biến của PLAN (bản trong cây làm việc, mỗi lần một chỗ, `sha256sum` trước và sau): **9/9 bị bắt** (bỏ `allowReconnection`: 10 test hỏng; bỏ cổng `damage()`; bỏ `if (owner.offline)`; bỏ chặn `tickClimate` và `tickRegen`; bỏ `saveNow` ở `onDrop`; đọc hồ sơ trước khi kết thúc phiên cũ; bỏ `liveSessions.set`; bỏ `maxEnqueuedMessages: 0`; bỏ đóng kết nối treo). Cộng 5 đột biến cho test tôi thêm (2 server, 3 `lobbyUrl`) và 1 cho test e2e đã sửa (bỏ watchdog): đều bị bắt. Các file sản phẩm giống hệt trước khi đột biến (so `sha256sum`).
- Tiêu chí hoàn thành: [x] API đúng 0.18 (đọc mã: `onDrop` + `allowReconnection(client, reconnectGraceMs / 1000)` + `.catch` + `instanceof Deferred`, `onReconnect`, `onLeave`; client chỉ có một `bindRoom()`, không `client.reconnect`, `Game.ts` chỉ còn một `room.send`, nằm trong `send()`)  [x] Rớt mạng (server)  [x] Bảo vệ và đứng yên (`sheltered` đúng 3 chỗ cộng 4 `tick` như PLAN, không chặn thêm)  [x] Quay lại (cùng sessionId, cùng đối tượng `Room`, một người)  [x] Hết hạn và rời chủ động (`removePlayer` gọi hai lần an toàn)  [x] Mỗi thiết bị một phiên (`CLOSE_REPLACED`; `onDispose` dọn)  [x] Không có số cứng  [x] `debug:endGrace` chỉ trong khối `PETGAME_DEBUG`  [x] Client: SDK, watch  [x] Client: Game  [x] Giao diện (chữ đúng bảng, ảnh đã xem ở 3 cỡ)  [x] Test (10 + 11 + 6 test mới của coder đều qua, qua cả khi lặp)  [x] Tài liệu (`architecture.md`, `choi-tren-iphone.md`, `design/multiplayer.md`). Không có test cũ nào bị nới lỏng hay bỏ qua (diff chỉ thêm).
- **Kiểm tay ngoài bộ test** (script trong `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t3tester1/`: `shots.mjs`, `timeout.mjs`, `shutdown.mjs`, `flap.mjs`, `silence.mjs`; ảnh trong `shots/`, không commit; cần `servers.sh start`):
  - Màn che ở 390×844, 844×390, 1280×720, cả hai trạng thái, và "Bạn đang chơi ở nơi khác": ~60 phép kiểm đều ✓. Hộp vừa màn; nút "Về sảnh" 120×44; lớp phủ kín màn, z-index 6 trên HUD (2); `elementFromPoint` ở giữa mọi nút game, joystick, Ăn, Đặt trại, Thú, ... đều rơi vào lớp phủ; aria đúng; vòng quay tắt khi `prefers-reduced-motion`; đang kết nối lại không cướp focus, mất hẳn thì focus ở nút; Enter (ngang) và Space (desktop) đưa về sảnh giữ `?room=` và `quality=low`, vào lại đúng thế giới với thú còn. Đã xem cả 7 ảnh bằng Read: bố cục sạch, chữ đọc được, nút xám khi đang thử và xanh khi mất hẳn.
  - Đồng hồ thật: server thấy socket đóng sau 0,1 s và đánh dấu `offline`; người chơi không nhúc nhích; chỗ giữ **20,1 s**; client bỏ cuộc **30,2 s** sau lúc cắt; vào lại đúng thế giới, thú đã lưu từ lúc rớt. Rớt khi chơi một mình: bỏ cuộc sau 30,1 s, "Về sảnh" về `/` không có `room` (giữ `quality=low`), thế giới mới, thú còn. `page.close()` trả chỗ sau **0,1 s**; tải lại trang: đúng một người, thú còn.
  - Tắt server êm (SIGTERM, như lúc deploy): "Server đang khởi động lại"; thú cho trước lúc tắt 0,5 s (chưa tới lần lưu theo lô 2 s) vẫn còn khi vào lại; "Về sảnh" không kèm `room`.
  - Chập chờn vừa (cắt 1-2,5 s, thông 2-3 s, 6 vòng trong 25 s), 3 lần: cả 3 quay lại cùng `Room` và sessionId, không nhân bản, không ai kẹt `offline`, đi tiếp được; ân hạn tính lại mỗi lần rớt.
- Lỗi 1 (chập chờn, đã sửa trong test): `npx playwright test --workers=1` lượt 2 -> `Error: expect(locator).toBeVisible() failed ... Locator: locator('.net-overlay') Expected: visible Received: hidden Timeout: 20000ms` tại `tests/e2e/multiplayer.spec.ts:1222` (test "connection: a connection that goes silent without closing..."); chạy riêng lại: qua. Nguyên nhân: lớp phủ chỉ hiện **335-806 ms** (trung bình 661 ms, đo 8 lượt bằng `MutationObserver`) sau khi watchdog thấy kết nối câm (7,3-7,6 s sau lúc đóng băng), vì lần nối thử ngay sau đó đi qua; `toBeVisible` thăm dò cách nhau 1 s nên có lúc lỡ (nhật ký gọi thấy lớp `reconnecting` đã được đặt, rồi `hidden` lại). Là lỗi thiết kế của test, không phải của sản phẩm. Sửa: trang tự ghi lại các lần đổi của `.net-overlay` (`MutationObserver`), test chờ và kiểm đúng chuỗi `["Đang kết nối lại…", "hidden"]` rồi vẫn kiểm toast và cùng `Room`/sessionId. Không làm yếu test: bỏ watchdog thì test hỏng đúng (`page.waitForFunction: Timeout 40000ms exceeded`). Sau sửa: 12/12, 18/18, 22/22.
- Quan sát 2 (không chặn, thuộc Colyseus; ngoài tiêu chí của PLAN): **chập chờn cực nhanh làm mất ân hạn.** `flap.mjs`: 8 lần cắt trong khoảng 9 s, mỗi khoảng thông 150-900 ms, 3/3 lần hỏng (chập chờn vừa thì qua, xem trên). Cơ chế, đã xác nhận bằng nhật ký tạm trong `onDrop`, `onReconnect`, `onLeave` (đã gỡ, file giống hệt): server chấp nhận một lần nối lại (`onReconnect`, `state=2` RECONNECTING), 86 ms sau socket đó bị cắt khi `Room._onJoin` chưa xong (`state=4` LEAVING), Colyseus gọi `onDrop(1001)`, `allowReconnection` trả Promise bị từ chối "not joined" (client chưa JOINED hẳn), nên `onDrop` thoát ở `!(hold instanceof Deferred)` (đúng như PLAN mô tả) và `onLeave` chạy cùng mili giây: `removePlayer` ngay. Người khác thấy `OFFLINE` rồi `online` rồi `GONE` thay vì giữ 20 s; token cũ đã dùng, token mới không bao giờ tới trang, nên lần thử sau nhận 4003 và trang hiện "Không kết nối lại được" sau khoảng 10 s (câu chữ đúng sự thật: đã lưu; "Về sảnh" vẫn vào lại). Không sửa được ở server (token chỉ dùng một lần); cách chữa trọn vẹn là tự vào lại bằng token thiết bị khi nhận 4003 sớm (cần `Room` mới, ngoài phạm vi T3): đề xuất P3 cho TASKS.md.
- Quan sát 3 (coder đã ghi, giữ nguyên): một lần nối thử bị treo (đã mở TCP mà không nhận `JOIN_ROOM`) làm SDK không thử lại cho tới khi nó đóng; người chơi chờ tới hết `RECONNECT_TRY_MS` rồi thấy "Không kết nối lại được". Tôi không tái hiện được bằng công cụ hiện có (Playwright không giả được socket treo).
- Việc nhỏ cho agent chính (không phải lỗi): `CLAUDE.md` chưa liệt kê `endGrace` trong danh sách hook `debug:*` (PLAN, mục đề xuất P3); `docs/architecture.md` phần e2e nên nói thêm test câm dùng bản ghi của chính trang (`MutationObserver`) vì lớp phủ chỉ hiện dưới một giây.
- Test đã thêm (tôi chỉ sửa file test):
  - `packages/server/src/rooms/GameRoom.test.ts` (+2, trong `describe("reconnecting after a dropped connection")`): `a pal at work makes nothing while its owner is away, and carries on once they are back` (luật "thú làm việc không sản xuất" chưa có test; đột biến chỉ chặn thú đi theo thì hỏng: `expected 16 to be 15`); `closing the world saves everyone, those connected and those waited for, and leaves nothing waiting` (đóng phòng: người đang nối và người đang chờ đều được lưu, `holds` rỗng, không có `unhandledRejection`; nhánh `.catch` + `instanceof Deferred` chưa có test; bỏ `.catch` thì hỏng: `Error: disposing`).
  - `packages/client/src/net/connection.test.ts` (mới, +4): `lobbyUrl` (giữ tham số khác, đặt `room` đúng một lần, bỏ `room` khi chơi một mình, không đổi khi không có `room`); trường hợp một mình không có test nào khác (e2e chỉ kiểm có bạn). 3 đột biến bị bắt.
  - `tests/e2e/multiplayer.spec.ts`: sửa test "connection: a connection that goes silent..." như Lỗi 1 (kiểm kiểu e2e bằng `tsconfig` tạm: sạch).
- Dọn: cổng 2567, 2568, 5173 trống; không còn tiến trình nền; không để file tạm trong repo.
