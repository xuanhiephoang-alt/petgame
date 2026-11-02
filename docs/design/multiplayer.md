# Chơi nhiều người: vào, rời và mất mạng

Luật của một phiên chơi (từ T3). Phần kỹ thuật (hook nào, file nào) ở `docs/architecture.md`; kế hoạch và bằng chứng API ở `PLAN.md` của T3.

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

## Mã kết nối lại

- Do server cấp cho từng lần kết nối, chỉ dùng được cho đúng phiên đó, **một lần** (nối lại xong thì cấp mã mới), và hết hạn cùng khoảng chờ.
- Chỉ nằm trong bộ nhớ của trang, không lưu xuống máy. Nối lại không đổi được tên, token hay ngoại hình.

## Đã cân nhắc và chấp nhận

- Cắt mạng để thoát một trận đánh: được tối đa 20 giây an toàn, nhưng không làm gì được và không được lợi gì về đồ (ngất vốn không mất đồ). Chấp nhận vì game hợp tác, không có PvP.
- Phòng đủ 5 người mà một người đang được giữ chỗ: người khác (kể cả chính họ vào lại từ sảnh) phải chờ hết 20 giây. Họ quay lại tự động thì vẫn vào được.
