PASS
# REVIEW: T49 Giữ thế giới trống thêm một lúc, vòng 1

## Kết luận
Thay đổi làm đúng PLAN.md và `docs/design/multiplayer.md`. Đã đối chiếu vòng đời phòng với mã nguồn Colyseus 0.18.18 (`Room.mjs`: setter `autoDispose`, `_onJoin`, `_onLeave`/`#_onAfterLeave`, `_reserveSeat`, `#_disposeIfEmpty`, `disconnect`) và không thấy đường nào làm phòng mất bình thường bị treo mãi. Lần lưu hồ sơ vẫn đúng một lần, `debug:emptyHold` có cổng và chỉ rút ngắn được. Client ghi `?room=` và `petgame:friends` đúng bảng trong PLAN. Không có lỗi phải sửa; các góp ý bên dưới là việc theo sau.

Đã tự chạy lại để kiểm: `npm run typecheck` sạch; `joinStatus.test.ts` và `connection.test.ts` 22/22; describe "keeping an empty world open" 6/6 (test "hook absent" mất 306 ms, không treo).

## Lỗi phải sửa
(không có)

## Đã kiểm, không có lỗi
- **Vòng đời phòng:**
  - `autoDispose = false` khai báo như trường của class. `__init` chép giá trị này qua accessor khi `#_ready` còn tắt, nên `resetAutoDisposeTimeout(seatReservationTimeout)` không hẹn gì.
  - Phòng tạo ra mà không ai vào: chỗ giữ 15 s hết hạn thì `#_disposeIfEmpty` không đóng phòng vì `autoDispose` đang tắt. Đến 60 s thì hẹn giờ của phòng bật `autoDispose`, và phòng đóng sau 1 s (test 3).
  - Mọi đường ra đều đi qua `onLeave`: rời chủ động; hết chờ nối lại; `endSession` (cả `reject` lẫn `leave(CLOSE_REPLACED)`, kể cả khi gọi từ phòng khác); `onJoin` ném lỗi (`_onLeave(WITH_ERROR)`, rồi `onDrop`, nơi `allowReconnection` bị từ chối "not joined", rồi `onLeave`). Vì `keepWorldOpen` là dòng đầu của `onJoin`, mỗi lần vào luôn có một lần ra hẹn lại giờ.
  - Không còn chỗ nào `players` rỗng mà không có hẹn giờ.
- **Hết giữ đúng lúc có người vào:**
  - Có người giữ chỗ trước khi hết giữ: `#_disposeIfEmpty` đếm `_reservedSeats` nên không đóng phòng. Họ vào thì `_onJoin` xoá hẹn giờ của Colyseus, rồi `keepWorldOpen` tắt lại `autoDispose`. Họ không vào thì chỗ giữ hết hạn, `#_decrementClientCount` chạy và phòng đóng.
  - Có người giữ chỗ trong 1 s sau khi hết giữ: `_reserveSeat` hẹn lại 15 s. Kết quả giống trường hợp trên.
  - Khoảng hở giữa lúc phát "dispose" và lúc listing bị xoá vẫn có từ trước T49. Nay nó chỉ còn xảy ra lúc hết giữ, không phải mỗi lần người cuối rời, nên hiếm hơn.
- **Chờ nối lại:** người `offline` vẫn nằm trong `players`, nên trong lúc chờ không có hẹn giờ giữ. `reject` của `allowReconnection` có gọi `resetAutoDisposeTimeout()`, nhưng `autoDispose` đang tắt nên lời gọi đó không làm gì. Server tắt (`disconnect`) thì `#_autoDispose` được bật thẳng, setter chặn `keepWorldOpen` khi phòng đang DISPOSING, và `clock.clear()` dọn hẹn giờ.
- **Lưu hồ sơ:**
  - `onDrop` và `removePlayer` lưu như cũ.
  - `scheduleSave` của phiên đã ra gặp `saveNow` không còn `player` nên thôi. Test 4 dùng spy để chứng minh điều này.
  - Sau `endSession`, `onLeave` chạy `removePlayer` lần hai cũng không lưu thêm.
  - Hẹn giờ đang chờ trong lúc phòng trống (tin bắt thú, thông báo 1,5 s ở `onJoin`) đều đã kiểm `players`.
- **CPU khi trống:** mô phỏng vẫn chạy, tốn 0,13% một nhân mỗi phòng và chỉ trong tối đa 60 s. Đã ghi ở "Đã cân nhắc".
- **`debug:emptyHold`:**
  - Chỉ đăng ký trong khối `PETGAME_DEBUG === "1"`.
  - Giá trị bị kẹp trong `[0, EMPTY_WORLD_HOLD_MS]`. Chuỗi, NaN và Infinity bị bỏ qua.
  - Chỉ đổi phòng của người gửi.
  - Có test cho cả lúc có hook và lúc không có. Đột biến (e) của tester bắt được việc bỏ cổng.
- **Client:**
  - `arrival` và `arrivalHint` đúng bảng ở Thiết kế 7.
  - `quietRetry` chỉ thử thêm một lần, chỉ khi lỗi là "closed", và chỉ khi địa chỉ vẫn là `invited`. Nhờ vậy nút "Tạo thế giới mới" không kích hoạt nó.
  - Lỗi "closed" lần đầu không `console.error`. `joining` bật suốt cả hai lần thử, và không tải lại trang (e2e đếm `load`).
  - `syncAddress` chỉ ghi khi "có bạn bè hay không" đổi, nên không ghi gì theo từng nhịp.
  - `keepWorld` chỉ tắt khi server khởi động lại. `failToStart` luôn ghi địa chỉ và cả hai khoá.
  - Link cũ hoặc sai mở ở tab khác vẫn ra `invited`, kèm thẻ "đã đóng" chữ cũ.
- **Lệch kế hoạch trong PROGRESS.md:** cả ba đều hợp lý.
  - Bỏ tham số `previous`, vì `noUnusedParameters` sẽ báo lỗi.
  - Thêm bước chờ `playerCount === 2` trước khi tải lại. Bước này cần, vì địa chỉ giờ không còn cho biết trang đã thấy bạn bè chưa.
  - Đếm `load` là 3.
- **Test "hook absent" không gọi `leave()`:** không rò client hay phòng.
  - Không có handler thì Colyseus (không ở dev mode) gọi `client.leave(WITH_ERROR)`, rồi tới `onDrop`, nơi người chơi được giữ chờ nối lại. Vì vậy `leave()` phía SDK treo.
  - `afterEach` gọi `colyseus.cleanup()`, tức `disconnectAll`. Lệnh này từ chối mọi lần chờ nối lại và đóng phòng.
  - Test "debug:xp is not there" có từ trước cũng làm đúng kiểu này. Bộ test vẫn ổn định (tester chạy 3 lần, 131/131).
- **Tài liệu:**
  - `architecture.md` có mục "Giữ thế giới trống (T49)", hook `emptyHold`, đoạn T23 của `main.ts` và helper `closedWorld`.
  - Danh sách hook trong `CLAUDE.md` đã có `emptyHold`.
  - `multiplayer.md` khớp với hành vi đã làm.

## Góp ý không bắt buộc (nên thêm vào TASKS.md)
- **[nên làm sớm] Chặn tạo thế giới hàng loạt.**
  - Trước T49, một yêu cầu `create` mà không ai vào giữ phòng 15 s. Vào rồi rời thì phòng đóng ngay (0 s).
  - Nay cả hai trường hợp đều giữ 60 s. Script gọi `POST /matchmake/create/world` với tốc độ r lần mỗi giây sẽ giữ khoảng 60r thế giới đang chạy, gấp 4 lần trước, và không cần giữ socket nào. Ví dụ r = 5 cho khoảng 300 thế giới: khoảng 39% một nhân và 105 MB.
  - Một client cũng giữ được nhiều thế giới mãi mà không cần socket nào đang mở, chỉ bằng cách vào rồi rời mỗi thế giới trước khi hết 60 s. Trước T49, muốn vậy phải giữ một socket cho mỗi thế giới.
  - Thiết kế đã chấp nhận và ghi ở "Đã cân nhắc", nên không làm FAIL. Đề xuất một nhiệm vụ riêng: trần tổng số thế giới (ví dụ `MAX_WORLDS`, quá trần thì `create` trả lỗi rõ ràng) và/hoặc giới hạn tốc độ `/matchmake/create` theo IP.
- **[nhỏ] Phòng treo khi `removePlayer` ném lỗi.** `GameRoom.ts`, `onLeave`: nếu `removePlayer` ném lỗi (chỉ xảy ra khi có bug, vì `saveNow` đã tự bắt lỗi của store), `holdEmptyWorld` không chạy. Phòng khi đó không bao giờ đóng: trước T49 Colyseus vẫn đóng nó, nay nó chạy 20 nhịp/giây mãi. Phòng thủ rẻ: đặt `holdEmptyWorld` trong `finally`. Ở `closeIfStillEmpty`, xem như trống khi `this.clients.length === 0 && this.holds.size === 0`, kể cả khi `players` còn sót người.
- **[nhỏ] Test 1 dùng hold 400 ms**, trong khi từ lúc rời đến lúc vào lại đã khoảng 350 ms (chờ, 5 nhịp, `joinById`). Trên máy chậm, test vẫn qua nhờ 1 s đóng trễ của Colyseus cộng chỗ giữ, nên nó chưa thật sự chứng minh "vào lại kịp trong khoảng giữ". Nên đặt khoảng 1000 ms.
- **[nhỏ] Chưa có e2e cho "một mình, rớt mạng, Về sảnh, về đúng thế giới cũ"** (Mục tiêu 3). Hiện mới có test server 2 (giữ sau khi chờ nối lại) và lý lẽ trong code (`keepWorld = true`). Nên thêm một bước vào test `connection:` có sẵn, dùng `openWithSwitch` + `cut` + `debug:endGrace`.
- **[nhỏ] Link cũ của chính người chơi mở ở tab mới.** Trước T49 chỉ địa chỉ lúc có bạn bè mới mang `room`. Nay địa chỉ khi chơi một mình cũng có, nên dấu trang lưu lúc chơi một mình, hay địa chỉ dán sang tab mới, sẽ thành `invited`: sảnh hiện "Bạn được mời…", rồi thẻ "đã đóng" với dòng "Xin bạn bè link mời mới". Hiếm và có đường đi tiếp (Tạo thế giới mới). Có thể ghi thêm vào "Đã cân nhắc", hoặc gộp vào T13/T50.
- **[nhỏ] `closedWorld` chờ tối đa 20 s.** Nếu tin rời phòng lúc `pagehide` bị mất, server sẽ chờ nối lại 20 s trước khi giữ, và lần chờ này sẽ hết giờ. Chưa xảy ra (30/30). Nếu sau này thấy chập chờn thì nâng lên khoảng 30 s.
- PROGRESS.md ghi nhầm "Test unit đếm `load`": đó là e2e.
