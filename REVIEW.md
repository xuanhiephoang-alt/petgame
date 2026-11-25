PASS
# REVIEW: T24 Kết nối lại: vào lại chỗ vừa mất, bỏ lần thử bị treo, vòng 1

## Kết luận
Thay đổi làm đủ Bước A và B của PLAN.md. Server vẫn quyết định mọi kết quả, quay lại không cho thêm máu hay chỗ, và `/resume` chỉ trả một bit, không dò được gì. Phía client không bao giờ mở hai lần thử song song. Các test tích hợp và e2e là test thật, và bắt được các đột biến M1-M13. Không đổi schema, message hay `Profile`. Tôi đã chạy lại: typecheck sạch; `resume.test.ts`, `reconnect.test.ts`, `http.test.ts` qua 32/32.

## Lỗi phải sửa
Không có.

## Đã kiểm

### Server quyết định, chống né đòn và hồi máu
- **Chỗ ghi điểm quay lại:** chỉ ở nhánh `!(hold instanceof Deferred)` của `onDrop`.
  - Đã đối chiếu `Room.mjs` 0.18: `_onLeave` gọi `onDrop` khi mã khác 4000 và phiên không ở `RECONNECTING`. `allowReconnection` từ chối khi `_enqueuedMessages` còn, tức phiên đang `JOINING`.
  - Hết giờ chờ, `debug:endGrace` và rời chủ động (4000) đều không đi qua nhánh này.
  - Bị thay (4201): `endSession` xoá người chơi trước, nên `onDrop` thoát ngay ở `!player`.
  - Test A2 và test `endGrace` mở rộng giữ các ca này.
- **Khôi phục y nguyên:** vị trí, máu, `nextEatAt` khôi phục đúng. Các hồi chiêu khác (lướt, đánh, ném) về 0, giống mọi lần vào lại từ sảnh đã có từ trước, nên không mở đường mới.
- **Không né được đòn:** thú đang gồng đòn vào người chơi đã thôi nhắm từ `removePlayer`. Đây là chuyện có sẵn của mọi lần rớt (việc của T25); T24 không làm nó mạnh hơn.
- **Không hồi được máu:** nếu cố đóng socket đúng lúc `JOINING` thì chỉ được quay lại với đúng máu cũ. Còn rời chủ động rồi vào lại vẫn đầy máu ở giữa bản đồ như trước; tài liệu đã nói đúng như vậy.
- **Màu cũ:** chỉ lấy lại nếu không ai đang dùng (kể cả người chơi đang `offline` được giữ chỗ), không thì `pickColor()`. `slot` của ngoại hình mặc định tính theo màu cuối cùng.
- **Không lẫn phòng, không lẫn phiên:** `resumes` là `Map` của từng phòng, khoá theo token.
  - `takeResume` chạy sau `endSession(older)`, xoá ngay sau khi lấy, và tôn trọng `until`.
  - Một tab thứ hai thì vào như phiên mới (A1).
  - Thế giới trống của T49 vẫn được giữ 60 s, nên điểm 20 s còn dùng được. Điểm mất theo phòng khi phòng đóng.

### `POST /resume`
- **Kiểm dữ liệu vào:**
  - `express.text` chỉ nhận `text/plain`, tối đa 1 kB.
  - `JSON.parse` được bọc `try`.
  - `room` phải khớp `[A-Za-z0-9_-]{1,64}`, token phải qua `isValidToken`. Sai thì trả 400 mà không gọi `canResume` (test có kiểm).
- **Không dò được gì:**
  - Phòng không tồn tại và "không có điểm" trả cùng `false`, nên không dò được id phòng.
  - Token 16-64 ký tự ngẫu nhiên nên không dò được token.
  - Route không đụng SQLite, không tạo phòng, và không cần giới hạn tần suất (mỗi lần chỉ là một lần tra `Map`).
- **Tra phòng:** `matchMaker.getLocalRoomById` có thật trong `@colyseus/core` 0.18.18. Có `instanceof GameRoom` và bọc `try`. JSDoc ghi rõ giới hạn chỉ thấy phòng của một process.
- **Giới hạn thế giới, proxy, header:**
  - Lần vào lại dùng `joinById`, không bao giờ bị guard chặn.
  - Route không đọc địa chỉ nên `PETGAME_TRUST_PROXY` không liên quan.
  - Có `no-store` và `Access-Control-Allow-Origin: *`. Gửi `text/plain` thì trình duyệt không gửi preflight.

### Client
- **`refused`:** chỉ là 4003 khi đang `reconnecting`.
  - Hai ca khác cũng ra `refused` là hết giờ chờ của server, và SDK hết lượt thử (khoảng 53 s, nên `giveUp` 30 s luôn tới trước).
  - Cả hai đều vô hại, vì `comeBack` chỉ tải lại khi server trả `true`, không thì hiện "Không kết nối lại được" như T3. M12 chứng minh điều này.
- **`isTryHung` không gây hai lần thử song song:**
  - Chỉ đóng khi `readyState` là 0 hoặc 1.
  - `WebSocketTransport.close(4010)` gỡ `ws.onclose` trước rồi mới gọi `events.onclose` đúng một lần (đã đọc mã SDK), nên không có hai `onclose`.
  - `retryCount` tăng lúc SDK hẹn lần thử, nên mốc 8 s gồm cả độ trễ tối đa 2 s.
  - Trang vừa ngủ thì đặt lại mốc.
  - `onerror` của SDK không có ai nghe phía game.
- **`mayRejoinAgain` và `sessionStorage`:**
  - Có thể ghi `sessionStorage`: các khoá sống qua lần tải trang của cùng tab.
  - `sessionStorage` ném lỗi: `safeStorage` trả `undefined`, nên `Number(undefined)` là NaN và được coi như "chưa có". Trang tải lại một lần nhưng không đọc được `AUTO_ENTER_KEY`, nên dừng ở sảnh: không có vòng lặp.
  - Nhiều tab: mỗi tab một bộ khoá, và một thiết bị chỉ có một phiên sống (`liveSessions`).
  - `AUTO_ENTER_KEY` bị xoá ngay khi đọc, nên vào hỏng cũng không lặp.
- **`comeBack` và sảnh:**
  - `lobbyUrl(roomId, true)` giữ `?room=` và các tham số khác.
  - Sảnh gọi `enter()` sau `petgame:lobby-ready`, nên mọi thẻ lỗi (đã đóng, đủ người) vẫn hiện như thường.
- **Chữ và màn che:**
  - Chữ mới nằm ở `CONNECTION_TEXT.refused`, đúng bảng của kế hoạch.
  - Màn che `refused` vẽ như đang kết nối lại: nút xám, không lấy focus, cỡ chạm giữ như T3.

### Bộ nhớ
- `sweep` chạy ở mỗi `noteResume` và `takeResume`. Vì vậy ngay sau mỗi lần ghi, `Map` chỉ còn các điểm ghi trong 20 s gần nhất. Giữa hai lần ghi thì nó không lớn thêm.
- Mỗi điểm cần một lần vào phòng thật (tối đa 5 người), và mọi điểm mất theo phòng. Giới hạn như vậy là đủ.

### Test
- **Test tích hợp A1-A4:** là test thật.
  - Đổi `terminate()` thành `ws.close()` là đúng: socket của SDK trong Node là undici. A1 vẫn khẳng định mã đóng 4003, và M1, M5, M6 chứng minh nhánh `onDrop` được chạm tới.
  - A4 tự báo "inconclusive" nếu bóng đã khép, và bắt được M7.
- **`reconnect.spec.ts`:** không qua suông. M1, M6, M11, M13 làm e2e hỏng.
  - Bước 4 của test 1 đúng là chặn 60 s (M11 làm trang tải lại lần nữa).
  - Test 2 cần đúng việc đóng lần thử treo (M13).
  - Tester chạy `--repeat-each=5` được 10/10.
- **`reconnect.test.ts`:** sửa `.map(lostReason)` thành lambda là đúng, vì `map` truyền chỉ số vào tham số thứ hai. Không assertion cũ nào bị nới.

### Tài liệu và ràng buộc
- **Tài liệu:** `docs/design/multiplayer.md`, `docs/architecture.md`, `docs/deploy.md` khớp với code.
- **Ràng buộc:**
  - `packages/shared`, `multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json` không đổi.
  - Không thêm close code mới.
  - `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **`tests/e2e/reconnect.spec.ts:145`, `page.waitForTimeout(300)`:** Bước B.7 của PLAN.md chỉ cho phép một lần chờ 5 s, cái có chú thích ở bước 4.
   - Lần chờ này thừa: teleport là một bước, và lệnh poll ngay trên đã thấy chỗ mới.
   - Nếu thật sự sợ chỗ đứng còn đổi, poll tới khi hai lần đọc bằng nhau, hoặc so với đúng toạ độ teleport. Nên sửa ở lần đụng tới file này.
2. **Bấm "Về sảnh" trong lúc `comeBack` đang chờ `/resume`** (tối đa 3 s): nếu câu trả lời `true` tới trước khi trang kịp rời đi, `comeBack` vẫn ghi `AUTO_ENTER_KEY` và gọi `location.assign`, nên sảnh tự vào lại, trái với ý người chơi.
   - Khe thời gian rất hẹp.
   - Cách sửa: một cờ do nút Về sảnh đặt, và `comeBack` kiểm cờ đó trước khi ghi khoá và gọi `assign`.
3. **Hai đường mất chỗ còn lại vẫn rơi về màn T3:**
   - (a) Socket chết đúng lúc phiên còn `RECONNECTING` (trong lúc `await onReconnect`). Colyseus gọi `onLeave` chứ không gọi `onDrop`, nên không có điểm.
   - (b) Kết nối nửa mở: server chưa thấy socket `JOINING` đóng khi `/resume` tới, nên trả `false`.
   - Cả hai hiếm. Cùng lắm thì người chơi thấy "Không kết nối lại được" như trước T24.
   - Có thể hỏi `/resume` thêm một lần sau khoảng 1 s, và ghi hai ca này vào mục "Đã cân nhắc" của `multiplayer.md`.
4. **Chỗ quay lại bị chặn:** trong 20 s chờ, người khác có thể đặt công trình đúng chỗ cũ. Nên kiểm movement có đẩy người chơi ra khỏi vật cản khi vào lại không; nếu không, khi quay lại thì dời tới chỗ trống gần nhất.
5. **M10 chỉ unit test bắt được** (e2e không có 4003 nào ngoài lúc đang nối lại). Chấp nhận; có thể ghi một dòng trong JSDoc của `lostReason`: SDK hết lượt thử cũng ra `refused`, và `canResume` lo việc phân biệt.
6. **`http.ts`:** JSDoc của `installRoutes` có một dòng rất dài sau khi thêm `/resume`. Nên ngắt dòng.
7. **Theo PLAN.md:**
   - T24b mới: (c) trang ẩn lâu trên Android, cần tin "đang vắng", đổi giao thức, theo luật T25; (d) thêm `deadFreeze()` vào `reconnect.spec.ts`.
   - Ghi chú cho T16: gom bản chép `openWithSwitch` (có `hangNext`, `flapNext`), `enterLobby`, `waitForWorld`, `observer`.
   - Ghi chú cho T25: T24 không thêm đường né đòn nào.
