PASS
# REVIEW: T65 Dọn sau T49, vòng 1

## Kết luận
Thay đổi làm đủ năm việc của PLAN.md, đúng phạm vi: không đổi schema, message, `Profile` hay chữ của hint/thẻ. Bản sửa `onLeave` đúng với luồng thật của Colyseus 0.18. Đã đối chiếu `Room.mjs`: `_onLeave` xoá client khỏi `clients` trước khi gọi hook, `#_onAfterLeave` gọi `onLeave` không có try/catch, và `registerGracefulShutdown` tắt server khi có `uncaughtException`. Danh sách thế giới trên thiết bị đọc/ghi an toàn và có giới hạn. Test kiểm đúng hành vi. Tôi đã tự chạy lại typecheck, `-t "keeping an empty world open"` (8/8) và `joinStatus.test.ts` (27/27), tất cả qua.

## Lỗi phải sửa
(không có)

## Đã kiểm, không có lỗi
- **`onLeave` và trạng thái còn dở.** `removePlayer` gọi `saveNow` đầu tiên, và hàm này tự bắt lỗi store, nên hồ sơ đã được lưu trước khi có thể ném lỗi. Nếu ném ở `despawnCompanion`, thứ còn sót là `players`, `controls` và mục `liveSessions` của phiên. `onLeave` xoá `holds` rồi tính `isEmpty()`, nên thế giới vẫn được giữ rồi đóng. `onDispose` xoá mục `liveSessions` của phòng, nên token không bị khoá vĩnh viễn.
- **Một lần vào hỏng vẫn giữ lại thế giới.** Nếu `onJoin` ném lỗi, Colyseus gọi `_onLeave(WITH_ERROR)`, rồi `onDrop` (trả về sớm), rồi `onLeave`, và `isEmpty()` lại gọi `holdEmptyWorld()`. Vậy việc `keepWorldOpen()` ở đầu `onJoin` không để thế giới treo mãi. Với điều kiện cũ (`players.size === 0`) thì người chơi ma sẽ làm treo; điều kiện mới thì không.
- **Không còn chỗ nào dùng `players.size` cho "trống".** Server chỉ còn `onJoin` dùng `players.size` để chọn chỗ đứng; người chơi ma chỉ làm lệch chỗ đứng, vô hại.
- **Thứ tự trong đường rớt mạng.** Handler `.then(…, resetAutoDisposeTimeout)` chạy trước `onLeave`, và lúc đó `autoDispose` đang là false nên không làm gì. `cleanup` xoá ghế giữ sau đó, còn `#_disposeIfEmpty` tự chờ ghế giữ. Không có thứ tự nào làm phòng đóng sớm.
- **`localStorage` `petgame:worlds`.**
  - Chỉ lưu id phòng và một cờ boolean. Id phòng trị giá như link mời, nhưng nằm cạnh token thiết bị (thứ quan trọng hơn), nên không thêm rủi ro riêng tư.
  - Giới hạn 20 phần tử, `room` dài 1-64 ký tự. Lỗi quota bị `safeStorage` nuốt.
  - Mới nhất đứng đầu, không trùng.
  - Chỉ ghi khi vào, khi trạng thái có bạn bè đổi (`syncAddress` chỉ gọi `rememberWorld` lúc cờ đổi), trong `failToStart`, và một lần lúc mở trang. Không ghi theo khung hình.
  - Không có request mới trước khi sảnh sẵn sàng. `noteRecentWorld` và `readJson` là khai báo `function` (được hoist), còn `RECENT_WORLDS_KEY` được khai báo trước chỗ dùng.
- **Hai tab ghi cùng lúc.** Kiểu đọc-sửa-ghi có thể mất một lần ghi. Hậu quả tối đa là hành vi trước T65, và mỗi thiết bị chỉ có một phiên sống, nên hai tab cùng ghi rất hiếm. Chấp nhận như PLAN đã nêu.
- **Thứ tự của `arrival`.** Không có `?room=` thì `new`; rồi tới trí nhớ của tab; rồi danh sách của thiết bị; còn lại là `invited`. Để tab thắng là hợp lý: `rememberWorld` ghi tab và thiết bị cùng lúc, nên tab không bao giờ cũ hơn danh sách về chính thế giới của nó.
- **Dấu trang của thế giới chơi một mình, sau đó chia sẻ cho bạn bè.**
  - Nếu bạn vào khi người chơi còn ở đó, `syncAddress` đổi cờ thành `true`.
  - Nếu bạn vào sau khi người chơi đã rời đi, cờ vẫn là `false`. Khi đó thế giới còn mở thì vẫn vào được đúng thế giới; đã đóng thì vào thẳng thế giới mới, không có thẻ. Cách này nhất quán với luật tab của T49, chấp nhận được.
- **Thiết bị dùng chung.** Một người khác trên cùng trình duyệt nhận link mời tới thế giới mà người kia đã vào, và thấy "Quay lại…" thay vì "Bạn được mời…". Chấp nhận được: token và hồ sơ đi theo thiết bị, nên hai người đó vốn là cùng một nhân vật với cùng thú, đồ và trại. Chữ "Thú, đồ và trại của bạn vẫn còn" vì vậy vẫn đúng.
- **Test server.**
  - S1: spy đặt sau `capture`, vì `capture` gọi `vi.restoreAllMocks()`. Hẹn giờ gọi `this.closeIfStillEmpty()` qua arrow function, nên spy trên instance bắt được.
  - S2 kiểm người chơi ma còn đó, có log kèm `roomId`, và phòng đóng.
  - S3 đi đúng đường `#_onAfterLeave`. Vitest cũng tự báo lỗi khi có unhandled rejection, nên đường làm sập server bị bắt từ hai phía.
- **Test e2e.**
  - E1: `goto` và `waitForEvent("load")` chỉ trả về khi module `main.ts` đã chạy, nên kiểm `#room-hint` bằng `""` có nghĩa. Ở E2 và E3, giá trị trước T65 là "Bạn được mời…", nên ba bước này đỏ nếu bỏ danh sách.
  - E1: `?.` trong poll chỉ chờ lâu hơn, không làm poll qua nhầm.
  - E3 dùng tab mới của cùng context, nên `sessionStorage` trống mà `localStorage` dùng chung: đúng tình huống dấu trang.
  - Test của tester (danh sách hỏng, storage ném lỗi) kiểm đúng điều quan trọng: sảnh mở khoá và hiện "Bạn được mời…".
- **Tài liệu.** `architecture.md` dòng 59, 66 và 98, cùng mục T65 trong `multiplayer.md` (bảng, lý do chọn 20, việc đưa lên đầu danh sách, chế độ riêng tư) khớp với code.

## Góp ý không bắt buộc
- **Người chơi ma khoá thiết bị trong lúc thế giới của nó còn sống** (chỉ xảy ra khi có bug).
  - Nếu `removePlayer` ném lỗi trước dòng 661, mục `liveSessions` vẫn trỏ tới phiên ma. Mỗi lần thiết bị đó vào bất kỳ thế giới nào, `onJoin` gọi `older.room.endSession(...)`, `endSession` gọi lại `removePlayer`, và gần như chắc chắn ném lại (cùng con thú gây lỗi). Lần vào đó hỏng với thẻ "Không vào được thế giới".
  - Mỗi lần thử vào lại chính thế giới ma còn khởi động lại khoảng giữ 60 s. Kết quả: thiết bị bị khoá cho tới 60 s sau lần thử cuối.
  - PLAN đã cho phép không dọn người chơi ma, nên đây không phải lỗi của T65.
  - Đề xuất thêm việc nhỏ vào TASKS: bọc `older.room.endSession` trong `onJoin` bằng try/catch, ghi log và xoá mục `liveSessions` đó, để thiết bị luôn vào được. Cũng nên cân nhắc đặt `input` của người chơi ma về 0: hiện nó vẫn được mô phỏng với hướng đi cuối cùng.
- **Đột biến (a) chưa chứng minh được assertion `stray` của S3.** S3 đỏ ở `holdsOf(room).size` trước khi tới bước kiểm `stray`.
  - Nên chạy thêm đột biến "`try { removePlayer } finally { holds.delete; if (isEmpty()) holdEmptyWorld(); }`", tức ném lại lỗi. Đây đúng là phương án PLAN đã loại vì làm sập server.
  - Như vậy mới thấy S3 (hoặc Vitest) báo unhandled rejection, thay vì chỉ dựa vào lập luận.
- **`holdsOf` bị khai báo hai lần** (`GameRoom.test.ts` dòng 2487 và 2936). Nên chuyển lên cấp file, cạnh `isOpen` và `emptyHoldOf`.
- **E1 dựa vào khoảng giữ 60 s thật.**
  - Biên dư ước chừng 35-45 s; chạy lặp 8+5 lần đều qua.
  - Nếu thời gian hết thì test đỏ rõ ràng (`roomId` khác), không qua nhầm.
  - Nên ghi thời gian từ lúc `helper.leave()` tới `waitForWorld` vào nhật ký test, để thấy biên dư trên CI. Nếu chập chờn thì dùng phương án dự phòng của PLAN: cho helper rời ngay trước khi bấm Về sảnh.
- **Câu dài ở `architecture.md` dòng 59.** Phần T65 chen giữa "khi `isEmpty()`" và "`keepWorldOpen()` ở đầu `onJoin`", nối bằng dấu chấm phẩy nên khó đọc. Có thể tách thành câu riêng.
- Tên phòng `someoneselse` trong test của tester: chỉ là lỗi chính tả nhỏ, không ảnh hưởng.
