# Chơi nhiều người: vào, rời và mất mạng

Luật của một phiên chơi (từ T3; phần mở game từ T1, T15; tải lại trang và lỗi khi vào thế giới từ T23; game không mở được sau khi vào từ T42). Phần kỹ thuật (hook nào, file nào) ở `docs/architecture.md`; kế hoạch và bằng chứng API ở `PLAN.md` của T3 và T15.

## Mở game: sảnh tải chậm hoặc hỏng

Sảnh (ngoại hình, tên, nút "Vào chơi") chỉ dùng được khi script game đã tải và chạy xong. Trước đó ô tên và nút bị khoá, nút ghi "Đang tải..." (T1). Trang tự canh việc tải này bằng một đoạn script nhỏ nằm sẵn trong trang, nên đoạn này vẫn chạy khi chính script game hỏng (T15):

| Tình huống | Người chơi thấy | Khi nào |
|---|---|---|
| Tải bình thường | "Đang tải..." rồi "Vào chơi" | khoảng 1 giây ở 4G tốt, 5 giây ở 4G chậm |
| Mạng chậm, vẫn đang tải | dưới nút "Đang tải...": "Vẫn đang tải… Mạng có vẻ chậm. Chờ thêm chút, hoặc bấm Tải lại." cùng nút **Tải lại** phụ. Tải xong thì sảnh tự mở, thông báo biến mất | sau 15 giây chưa xong |
| Tải hỏng: mất mạng giữa chừng, file thiếu (server vừa đổi bản) | thẻ "Không tải được game", dòng "Kiểm tra mạng rồi bấm Tải lại." và nút **Tải lại** đang có focus (Enter là tải lại); ô tên và nút "Đang tải..." ẩn đi | ngay khi trình duyệt báo lỗi tải |
| Script chạy lỗi (thường do trình duyệt quá cũ) | như trên, dòng giữa là "Trình duyệt gặp lỗi khi mở game. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt." | ngay khi lỗi |
| Trình duyệt tắt JavaScript | "Cần bật JavaScript để chơi PetGame." | luôn |

- **Tải lại** mở lại đúng địa chỉ đang có, giữ `?room=` của link mời và mọi tham số khác. Có link mời thì thông báo ghi thêm "Link mời vẫn được giữ."
- Thông báo "mạng chậm" không chặn gì, không đổi nút "Đang tải..." và không lấy focus. Chỉ khi trình duyệt báo lỗi thật mới hiện thẻ "Không tải được game".
- Vì sao chờ 15 giây: script sảnh của bản build khoảng 960 kB (server chưa nén). Đo được sảnh sẵn sàng sau 5,3 giây ở 4G chậm (1,6 Mbps), 11,3 giây ở 3G (750 kbps), 20,7 giây ở 3G chậm (400 kbps). Với 15 giây, mạng từ 3G trở lên không bị làm phiền, còn người bị treo mạng không phải chờ quá lâu mới có nút Tải lại.
- Phạm vi: chỉ lúc tải trang, trước khi sảnh dùng được. Lỗi khi bấm "Vào chơi" là mục "Vào thế giới: lỗi và cách đi tiếp" (T23) và "Vào được nhưng game không mở được" (T42). Mất mạng khi đang chơi là màn che kết nối ở mục "Quay lại".

## Tải lại trang: về đúng thế giới (T23)

Trong lúc chơi, thanh địa chỉ luôn ghi nơi mà lần mở trang sau sẽ đưa người chơi tới (đổi tại chỗ, không tải lại trang):

| Lúc | Địa chỉ |
|---|---|
| Có người khác trong thế giới (kể cả người đang mất kết nối mà còn được giữ chỗ) | có `?room=<thế giới>`, như link mời |
| Chỉ còn mình | không có `room` |
| Mất hẳn kết nối | đúng địa chỉ mà nút **Về sảnh** mở (luật ở mục "Quay lại") |

- Vì vậy tải lại trang, hay Safari mở lại một tab mà iOS đã dỡ ở nền, đưa người chơi về đúng thế giới đang có bạn bè.
- Chơi một mình thì không ghi `room`, vì người cuối cùng rời là thế giới đóng ngay (tải lại là rời chủ động). Lần sau mở một thế giới mới cùng bản đồ; thú, đồ và trại luôn còn vì theo thiết bị.
- Vẫn qua sảnh: người chơi bấm "Vào chơi" một lần. Khi quay lại, sảnh ghi "Quay lại thế giới bạn đang chơi cùng bạn bè" và nút "Vào chơi" có sẵn focus (Enter là vào). Sảnh không tự vào, vì link mời cũng có `?room=` mà người được mời cần chọn tên, ngoại hình trước.
- Vào lại từ sảnh là phiên mới: bắt đầu ở giữa bản đồ, đầy máu (như mục "Quay lại").
- Trang nhớ (trong `sessionStorage` của tab) thế giới vừa chơi, chỉ để chọn chữ "Quay lại…" hay "Bạn được mời…". Địa chỉ mới là thứ quyết định vào đâu.
- Giới hạn: app mở từ Màn hình chính (PWA) luôn mở lại từ `/`, nên chưa về được thế giới cũ.

## Vào thế giới: lỗi và cách đi tiếp (T23)

Vào hỏng thì nút "Vào chơi" nhường chỗ cho một thẻ (cùng kiểu thẻ "Không tải được game"), nút chính có sẵn focus; ô tên và ngoại hình vẫn sửa được. Trong lúc đang vào, nút ghi "Đang vào...". Sảnh ở lại cho đến khi thế giới đã vẽ xong (T42), nên không bao giờ có màn hình tối không chữ.

| Tình huống | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Thế giới đã đóng, người chơi đang quay lại | Thế giới này đã đóng | Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn. | **Tạo thế giới mới** |
| Thế giới đã đóng (link mời cũ hoặc sai) | Thế giới này đã đóng | Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới. | **Tạo thế giới mới** |
| Đủ 5 người (tính cả chỗ đang giữ 20 giây cho người rớt mạng) | Thế giới đã đủ 5 người | Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới. | **Thử lại**, Tạo thế giới mới (phụ) |
| Mất mạng, server không chạy hoặc đang khởi động lại | Không kết nối được server | Kiểm tra mạng rồi bấm Thử lại. | **Thử lại** |
| Lỗi khác | Không vào được thế giới | Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại. | **Thử lại** |

- **Tạo thế giới mới** bỏ `room` khỏi địa chỉ rồi vào ngay một thế giới mới (cùng bản đồ).
- Biết thế giới đã đóng thì địa chỉ bỏ `room` ngay, nên tải lại ở thẻ này cũng ra thế giới mới, không gặp lại lỗi cũ.
- **Thử lại** vào lại đúng địa chỉ đang có (vẫn giữ link mời).

## Vào được nhưng game không mở được (T42)

Vào phòng được, nhưng phần vẽ thế giới không dựng nổi: thiếu một file của game (mạng chập chờn, hoặc tab cũ sau khi server vừa đổi bản), hoặc trình duyệt gặp lỗi khi vẽ. Sảnh vẫn còn (nó chỉ biến mất khi thế giới đã vẽ xong) và hiện thẻ:

| Nguyên nhân | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Thiếu file của game | Không tải được game | Kiểm tra mạng rồi bấm Tải lại. | **Tải lại** |
| Lỗi khác | Không mở được game | Trình duyệt gặp lỗi khi mở thế giới. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt. | **Tải lại** |

- Người chơi **rời thế giới ngay** (rời chủ động): bạn bè không thấy một nhân vật đứng im, chỗ trống lại ngay.
- Địa chỉ được ghi theo luật "Tải lại trang" ở trên trước khi rời: còn bạn bè thì giữ `?room=`, một mình thì bỏ. **Tải lại** mở lại đúng địa chỉ đó: về thế giới của bạn bè, hoặc thế giới mới cùng bản đồ.
- Chỉ có Tải lại, không có Thử lại: phần game hỏng chỉ lấy lại được khi tải lại trang (cũng là cách lấy bản mới sau khi server đổi bản). Ô tên và ngoại hình ẩn đi, như thẻ hỏng lúc mở game.
- Ảnh vẽ bằng AI hỏng hay thiếu (kể cả file danh mục ảnh sai) **không** làm hỏng việc vào: thú, cây, đá và nhân vật được vẽ bằng code như khi chưa có ảnh.

## Mỗi thiết bị một nhân vật

- Hồ sơ (thú, đồ, trại, nhiệm vụ, ngoại hình) gắn với token ngẫu nhiên mà trình duyệt giữ trên thiết bị.
- Trên server, một token chỉ có **một phiên đang sống**, ở bất kỳ thế giới nào. Thiết bị vào lần nữa (tab khác, tải lại trang, vào thế giới khác) thì phiên cũ được **lưu rồi kết thúc ngay**, trước khi phiên mới đọc hồ sơ. Tab cũ báo "Bạn đang chơi ở nơi khác".
- Hệ quả: không bao giờ có hai bản của cùng một người chơi, và bản cũ không thể ghi đè tiến trình mới.

## Rời chủ động và rớt mạng

| | Rời chủ động | Rớt mạng |
|---|---|---|
| Ví dụ | đóng tab, tải lại trang, bấm "Về sảnh" | 4G chập chờn, đổi Wi-Fi, khoá màn hình hoặc chuyển app lâu |
| Server biết bằng | tin rời phòng trang gửi lúc đóng | socket đóng bất thường, hoặc hết ping (sau 6-9 giây) |
| Nhân vật | lưu rồi xoá ngay, chỗ trong phòng trống ngay | ở lại **20 giây** (`RECONNECT_GRACE_MS`) chờ quay lại, vẫn giữ chỗ (kể cả khi phòng đủ 5 người) |

Nếu tin rời phòng không kịp đi (trang bị tắt đột ngột), server coi như rớt mạng: chờ 20 giây rồi mới xoá.

## Trong 20 giây chờ

- Nhân vật và mọi thú của họ ở ngoài (đi theo, làm việc ở trại) **đứng yên** tại chỗ. Người khác thấy hình mờ đi và tên kèm "(mất kết nối)".
- **Không gì nhắm tới hoặc gây sát thương**: thú hoang bỏ qua họ (đang đánh thì thôi), cắn, chiêu, dậm của trùm, lạnh và nóng đều không có tác dụng.
- **Thời gian như dừng**: không tự hồi máu, không mở rương, không tiến nhiệm vụ đi thăm vùng, thú làm việc không sản xuất, thú đi theo không đánh và không tung chiêu (chiêu đang gồng bị huỷ).
- Phần đã giành trước khi mất mạng vẫn được nhận: chiêu của thú đã bay ra vẫn rơi, cùng hạ trùm thì vẫn có thưởng.
- Server lưu hồ sơ ngay lúc phát hiện mất mạng, và lưu lần nữa khi xoá.

## Quay lại

- Trong khoảng chờ: game **tự kết nối lại**, đúng nhân vật, đúng chỗ, cùng thú đi theo. Màn hình hiện "Đang kết nối lại…" (không bấm, không đi được trong lúc này) rồi báo "Đã kết nối lại".
- Game thử tối đa 30 giây (`RECONNECT_TRY_MS`: 20 giây chờ cộng thời gian server có thể cần để phát hiện mất mạng). Quá hạn, hoặc server đã thôi giữ chỗ: "Không kết nối lại được" kèm nút **Về sảnh**. Nút này đưa về đúng thế giới cũ nếu lúc mất mạng còn người khác trong đó, không thì về sảnh thường (thế giới mới cùng bản đồ). Thú, đồ và trại luôn còn.
- Server khởi động lại: "Server đang khởi động lại", cũng có nút Về sảnh.
- Trang bị ẩn (chuyển app): nhân vật dừng đi ngay. Nếu trình duyệt vẫn giữ kết nối khi ẩn trang (có trên Android), nhân vật vẫn ở trong thế giới như người đứng yên, chưa được bảo vệ.
- Hồi chiêu của nút 🫐 Ăn (4 giây, từ T32) vẫn đếm trong lúc chờ và không bị xoá khi nối lại: nối lại sớm thì chờ nốt phần còn lại.
  - Vào lại từ sảnh là một phiên mới, nên không còn hồi chiêu.
  - Điều này không thành mẹo được, vì máu không được lưu: vào lại vốn đã đầy máu, và lại bắt đầu ở giữa bản đồ.

## Mã kết nối lại

- Do server cấp cho từng lần kết nối, chỉ dùng được cho đúng phiên đó, **một lần** (nối lại xong thì cấp mã mới), và hết hạn cùng khoảng chờ.
- Chỉ nằm trong bộ nhớ của trang, không lưu xuống máy. Nối lại không đổi được tên, token hay ngoại hình.

## Đã cân nhắc và chấp nhận

- Cắt mạng để thoát một trận đánh: được tối đa 20 giây an toàn, nhưng không làm gì được và không được lợi gì về đồ (ngất vốn không mất đồ). Chấp nhận vì game hợp tác, không có PvP.
- Phòng đủ 5 người mà một người đang được giữ chỗ: người khác (kể cả chính họ vào lại từ sảnh) phải chờ hết 20 giây. Họ quay lại tự động thì vẫn vào được.
- Tải lại trang không dùng mã kết nối lại (T23): mã chỉ sống 20 giây và dùng một lần, mà muốn dùng thì phải bỏ luật "tải lại = rời chủ động" (chỗ bị giữ 20 giây mỗi lần đóng tab). Ghi thế giới lên địa chỉ thì sống đến khi thế giới đóng, đổi lại vị trí và máu không được giữ.
- Người chơi một mình tải lại thì thế giới cũ đóng, nên link mời họ vừa gửi không dùng được nữa (bạn bè thấy "Thế giới này đã đóng"). Giữ thế giới trống thêm một lúc là việc riêng.
