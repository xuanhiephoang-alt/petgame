PASS
# REVIEW: T3 Kết nối lại sau khi rớt mạng (ân hạn 20 giây), vòng 1

## Kết luận

Thay đổi làm đủ Bước A và Bước B của PLAN.md và dùng đúng API Colyseus 0.18 (tôi đã đối chiếu với mã nguồn `@colyseus/core` 0.18.18 và `@colyseus/sdk` 0.18.5). Vòng đời phòng không rò `Map`, hẹn giờ, `Deferred` hay mục `liveSessions`; bản cũ không ghi đè được tiến trình mới; `sheltered()` phủ mọi đường gây sát thương và nhắm mục tiêu; client không nhân đôi listener hay sprite và không gửi gì khi mất kết nối. Không có lỗi phải sửa. Còn một kẽ hở thiết kế nhỏ (ngắt rồi nối lại liên tục để né đòn, chỉ làm được bằng devtools): nên đưa thành việc P3.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Đã kiểm

- **Server, vòng đời phòng** (`GameRoom.ts:540-614`):
  - Hook được gọi theo đúng `_onLeave` và `#_onAfterLeave` của core:
    - Mã 4000 → `onLeave` ngay.
    - Mã khác → `onDrop`; nếu có giữ chỗ thì `onLeave` chỉ chạy khi hold bị reject.
    - `allowReconnection` trả Promise bị reject (chưa JOINED, phòng DISPOSING); `.catch` và `instanceof Deferred` xử lý đúng trường hợp này.
  - Tin từ client chỉ được nhận sau `onReconnect`: listener `message` chỉ được gắn sau khi `onReconnect` trả về (`core/src/Room.ts:1911-1919`). Vì vậy không có ý định nào lọt vào lúc `offline`.
  - `holds`:
    - Xoá ở `onReconnect` và `removePlayer`.
    - Mọi đường reject (hết hạn, `endSession`, `debug:endGrace`, `disconnect`) đều dẫn tới `onLeave` → `removePlayer`.
    - Phòng đóng giữa lúc chờ: `_rejectPendingReconnections` → `onLeave` lưu và xoá người đang chờ. Người đang nối thì `onDrop` gặp hold bị từ chối (DISPOSING) → `onLeave`. Test của tester kiểm cả hai, không có unhandled rejection.
  - `liveSessions`:
    - Chỉ `set` sau `controls.set`.
    - `removePlayer` chỉ xoá mục đúng `{ room, sessionId }`, nên `onLeave` muộn của phiên đã bị thay không xoá mục của phiên mới. `onDispose` dọn thêm.
    - `onJoin` ném lỗi sau khi `set` → `onDrop` (hold bị từ chối vì chưa JOINED) → `onLeave` → mục bị xoá. Không có đường nào để một mục sống lâu hơn phiên của nó.
  - `removePlayer`:
    - Gọi hai lần vẫn an toàn.
    - Lọc thú theo `ownerId`; test 7 kiểm thú cùng id của phiên mới không bị đụng.
    - Xoá thêm `hazardWarned` và `shieldUntil` (trước đây bị bỏ sót).
- **Thứ tự lưu:**
  - Phiên cũ được `saveNow` trước khi phiên mới `store().load`, đồng bộ ngay trong `onJoin`.
  - Sau đó phiên cũ không còn player, nên mọi `saveNow` muộn (kể cả hẹn lưu theo lô 2 s đã đặt) đều không làm gì.
  - Test 8 kiểm đúng điều này: gọi `saveNow(bSid)` sau khi thế giới mới đã ghi 77, hồ sơ vẫn là 77.
  - Lưu ngay lúc rớt có test riêng (ân hạn 1000 ms, ngắn hơn lần lưu theo lô 2 s; đột biến bỏ lưu này bị bắt).
- **`sheltered()`:**
  - Máu của người chơi và thú đi theo chỉ bị trừ ở hai chỗ, và cả hai đều đã chặn:
    - `damage()`: cắn qua `strike`, chiêu thú hoang qua `land`, dậm của trùm qua `bossStomp`, và cả đẩy lùi.
    - `tickClimate`.
  - Nhắm mục tiêu:
    - `wildTarget` lọc ứng viên.
    - `targetPos` trả `undefined`, nên mọi thứ còn trỏ tới họ tự bỏ ở tick sau: aggro, `fleeing`, `inBallThrower`/`breakOut`, `provoke` từ chiêu đã bay.
    - Thú đầu đàn và trùm đi cùng đường này.
  - Rương, nhiệm vụ đi thăm vùng, hồi máu, thú làm việc đều bị chặn.
  - Chỉ còn hai đường hồi máu, đều từ chiêu đã bay ra trước lúc rớt: chiêu hồi máu, và lên cấp nhờ chiêu đó trúng. Đúng luật "chiêu đã bay ra vẫn rơi".
- **Bảo mật:**
  - Token kết nối lại do Colyseus cấp, dùng một lần, gắn với sessionId (test 6).
  - `CLOSE_REPLACED` chỉ phát trong `endSession`, và `endSession` chỉ được gọi từ `onJoin` khi có cùng token thiết bị hợp lệ. Token chỉ nằm trong `PlayerControl`, không có trong schema. Vì vậy không đá được người khác.
  - `debug:endGrace` nằm trong khối `PETGAME_DEBUG === "1"`; không cấu hình deploy nào đặt biến này.
- **Client:**
  - Mỗi thứ tạo hoặc đăng ký đúng một lần: `ConnectionWatch` (`main.ts:62`), `ConnectionOverlay`, `watchConnection`, `visibilitychange`, `pagehide`.
  - SDK nối lại trên cùng `Room`: không dùng `client.reconnect`, chỉ có một `bindRoom`.
  - SDK gọi `onReconnect` trước khi gửi xác nhận JOIN_ROOM, và các listener không gửi gì ngay, nên xác nhận luôn đi trước `Input`.
  - Không gửi gì khi mất kết nối:
    - `Game.ts` chỉ còn một `room.send`, nằm trong `send()`.
    - Watch chỉ ping khi online.
    - `maxEnqueuedMessages: 0` khiến `enqueueMessage` bỏ tin ngay.
  - Khi `lost`:
    - Interval và các hẹn giờ dừng; SDK tự gỡ listener.
    - Signal duyệt mảng cũ, nên listener của watch vẫn chạy sau `removeAllListeners`.
    - `room.state` còn giữ giá trị sau `teardown` (`clearRefs` không xoá nội dung), nên `withFriends` tính đúng.
  - `.label.offline span` không đụng thanh máu (thanh máu là `div`). `frame()` không cấp phát thêm.
- **Đồng bộ:**
  - `Player.offline` ở cuối schema, được đặt `false` trong `onJoin`.
  - Hai phía cùng import schema từ shared.
  - `Profile` và `store.ts` không đổi.
- **Test và tài liệu:**
  - Test cũ chỉ đổi dòng import.
  - Test mới kiểm hành vi thật; coder và tester đã kiểm đột biến.
  - `docs/architecture.md` và `docs/choi-tren-iphone.md` khớp code.
- **Tôi tự chạy:**
  - `npm run typecheck`: sạch.
  - `npx vitest run packages/client/src/net/`: 15/15.
  - Nhóm "reconnecting after a dropped connection": 12/12.
  - `npx playwright test -g "connection:" --workers=1`: 6/6 (1,3 phút).
  - Cổng 2567, 2568, 5173 trống sau khi chạy.

## Góp ý không bắt buộc

1. **Né đòn bằng cách ngắt rồi nối lại liên tục** (trả lời câu hỏi "có lách được không"):
   - Cách làm: trong devtools gọi `__petgame.room.connection.close(4010)` (hoặc tự đóng WebSocket).
   - Server biết ngay. `onDrop` xoá mọi aggro lên người chơi và thú của họ, kể cả cú cắn hay cú dậm đang gồng. `sheltered` chặn cả đòn đang bay.
   - SDK nối lại sau khoảng 200-400 ms. Lặp lại được mãi, không có cooldown: một nút "bất tử" mạnh hơn lướt.
   - Người chơi bình thường không làm được: bật chế độ máy bay thì server chỉ biết sau 6-9 s.
   - Thiết kế đã chấp nhận "cắt mạng để thoát trận" với lý do "không làm gì được trong 20 s". Bật tắt nhanh vượt qua lý do đó, vì người chơi đánh được giữa các lần. Game hợp tác, không có PvP, nên không chặn T3.
   - Đề xuất P3 cho game-designer: chỉ bảo vệ khi lần rớt kéo dài quá một ngưỡng ngắn, ví dụ khoảng 1,5 s. `onDrop` vẫn giữ chỗ, lưu và xoá ý định ngay. Riêng `offline` và `calmPalsTargeting` thì làm qua `this.clock.setTimeout`, có kiểm tra `holds.get(sid) === hold`. Cách khác: rớt lại trong N giây sau một lần nối lại thì không bảo vệ.
2. **Giữ chỗ vô hạn:** không đáng lo.
   - Mỗi lần giữ chỗ tối đa `RECONNECT_GRACE_MS`, và muốn gia hạn phải nối lại thật (vào hẳn rồi mới rớt lại).
   - Một người treo máy mà vẫn kết nối cũng giữ chỗ y như vậy.
3. **`onReconnect` phòng thủ:** nếu `this.state.players.get(sid)` không còn, gọi `client.leave(CLOSE_REPLACED)`, để không có client nào ở trong phòng mà không có nhân vật.
   - Hiện gần như không xảy ra được: giữa `resolve(client)` và `onReconnect` chỉ có một microtask, còn `endSession` luôn reject hold trước.
4. **e2e `freeze()` chưa chạy qua đường "đường truyền chết thật":**
   - Route chuyển cả lệnh đóng của trang (`ws.onClose` → `server.close`), nên khi watchdog đóng socket thì server biết ngay.
   - Đường thật thì khác: server chỉ biết qua ping sau 6-9 s, và lần nối lại phải chờ trong `_reconnectionAttempts` (`core/src/Room.ts:1736-1760`).
   - Có thể bỏ chuyển lệnh đóng cho socket đã đóng băng. Hành vi của thư viện đã được kiểm ở mục chạy thử số 8 của PLAN.
5. **`docs/design/multiplayer.md`, bảng "Rời chủ động":**
   - Bảng ghi "bấm 'Về sảnh'" là rời chủ động, "chỗ trống ngay". Thực ra nút chỉ hiện khi đã mất kết nối, nên lúc đó không gửi được gì.
   - Chỗ được trả khi thiết bị vào lại (`endSession`) hoặc khi hết ân hạn.
   - Có thể thêm một dòng: trong 6-9 s trước khi server phát hiện, nhân vật vẫn đi theo hướng cuối và vẫn có thể bị đánh (có từ trước).
6. **`pagehide` đăng ký trong `startGame`, tức sau khi tải xong hình.**
   - Đóng trang trong lúc hình đang tải thì server giữ chỗ 20 s thay vì trả ngay. Lần vào sau của cùng thiết bị vẫn trả chỗ.
   - Có thể đăng ký ngay sau khi tạo watch.
7. **Khi `lost`, vòng vẽ PixiJS vẫn chạy dưới lớp phủ**, tốn pin điện thoại nếu người chơi để đó. Có thể `ticker.stop()` khi mất hẳn.
8. **`lobbyUrl(roomId, true)` trùng với `inviteLink(roomId)`;** có thể dùng lại hàm này.
9. **Lớp phủ không đặt `inert` cho HUD:** người dùng bàn phím vẫn Tab được tới nút bên dưới.
   - Lệnh gửi đi đều bị chặn, nhưng giao diện cục bộ vẫn có thể đổi (ví dụ xem trước trong Tủ đồ).
   - Có thể đặt `inert` cho HUD khi chưa online.
10. **Việc cho agent chính:**
    - Thêm `endGrace` vào danh sách hook `debug:*` trong `CLAUDE.md` (có thể thêm `docs/design/multiplayer.md` vào danh sách tài liệu thiết kế).
    - Thêm vào `TASKS.md`:
      - P2 vào lại đúng thế giới sau khi tải lại trang (PLAN).
      - P3 Android ẩn trang mà socket vẫn sống (PLAN).
      - P3 `calmPalsTargeting` không xoá `pal.windup` (PLAN).
      - P3 tự vào lại khi nhận 4003 sớm lúc mạng chập chờn rất nhanh (tester).
      - P3 lần nối thử bị treo (coder).
      - P3 né đòn bằng ngắt/nối liên tục (mục 1).
