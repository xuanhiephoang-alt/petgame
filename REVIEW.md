PASS
# REVIEW: T19 Tạm dừng phím thế giới khi hộp thoại hoặc bảng giữ focus, vòng 3

## Kết luận
Vòng 3 chỉ sửa test e2e `keys:` và sửa đúng lỗi vòng 2. Các phép kiểm lúc tạm dừng giờ đếm tin client gửi (`input`, `dash`, `attack`, `palSkill`, `placeBase`) thay vì vị trí server, nên cú cắn đẩy lùi của thú hoang không còn làm test hỏng. Bước Space bằng chuột chạy ở chỗ xa thú hoang. Kiểm quãng lướt dùng `expect.poll`. Kiểm chứng đột biến cho thấy test bắt đúng hai lỗi chính:
- `paused()` luôn false thì hỏng ở dòng 2129;
- bỏ `!e.repeat` thì hỏng ở dòng 2241.

Code sản phẩm (`keyboard.ts`, `party.ts`, `crafting.ts`, `wardrobe.ts`, `Game.ts`) không đổi so với vòng 2, vốn đã đạt. Đủ các tiêu chí của PLAN.md.

## Lỗi phải sửa (FAIL khi còn mục này)
Không còn.

## Đã kiểm
- **`recordSends` bắt đầu trước `debug:teleport` và `debug:givePal`:** trước bước hộp không có thao tác nào gửi `input`, `dash`, `attack`, `palSkill` hay `placeBase`. Client chỉ gửi `input` khi hướng đổi so với `lastSentInput = {0, 0}`, và các cú bấm chuột vào nút bảng không gửi gì. Vì vậy `toEqual([])` ở bước hộp có nghĩa.
- **Bước Tủ đồ-Tab và Chế tạo:** đếm tin `input` trước và sau khi giữ D 400 ms. Nếu không có cổng, `keydown` của D làm khung hình kế tiếp gửi `input` trong 400 ms đó, nên phép kiểm hỏng thật. Phép kiểm "không lướt" vẫn chờ hết `DASH_COOLDOWN_MS`.
- **Bước "chỗ không có thú":** trường hợp `pals` rỗng cho `Math.min()` = `Infinity`, không lỗi. Lúc chờ dịch chuyển chỉ đòi người chơi rời chỗ cũ > 100 px. Cách chờ này hợp lý, vì server đẩy điểm đích nằm trong vật cản ra ngoài. Sau đó người chơi về lại `{3150, 2500}`, nơi đã biết đi lại tự do.
- **Các phép kiểm còn dựa vào vị trí:** đều là kiểm "đi được" (> 20 px, > 75 px) bằng `expect.poll`. Một cú cắn 16 px không đủ đảo kết quả.
- `const sent` được khai báo sau closure `inputs`, nhưng chỉ dùng sau khi đã gán, nên không vướng TDZ. `npm run typecheck` sạch.
- **Lần chạy lại:** coder chạy 20/20, tester chạy 10/10, đều ngay sau bộ e2e đầy đủ. Bộ e2e đầy đủ qua 37/37.

## Góp ý không bắt buộc
- Đoạn quét lưới tìm "chỗ không có thú" khá dài ngay trong test. Nếu sau này test khác cũng cần, nên chuyển nó thành helper chung trong `multiplayer.spec.ts`, hoặc thay bằng hook debug (xem dưới).
- Vẫn chưa có e2e riêng cho "đang đi thì mở hộp, nhân vật dừng (tin `input` cuối là `{0, 0}`)" và "hết tạm dừng không tự đi tiếp" (`direction()` xoá `held`). Code đúng khi đọc, nhưng chưa có test giữ hành vi này.

## Việc nên thêm vào TASKS.md
1. (thấp) Tab từ thế giới vào thẳng bảng đang mở. Hiện phải Tab qua mọi nút HUD trước; cần thiết kế riêng (PLAN.md T19 đã nêu).
2. (thấp) Hook `debug:clearPals` (dọn thú hoang trong một bán kính quanh người chơi, chỉ khi `PETGAME_DEBUG=1`). Các e2e đứng lâu ở `{3150, 2500}` sẽ không còn phụ thuộc thú hoang ngẫu nhiên: test lướt khoảng dòng 726, test chiêu khoảng dòng 819, test `keys:`.
3. (thấp) e2e cho "đang đi thì mở hộp, nhân vật dừng" và "hết tạm dừng phải nhấn lại phím mới đi".
4. (ghi chú thiết kế) Khi thêm ô nhập chữ (ví dụ chat), đưa ô đó vào `KeyGate`, để W/A/S/D không vừa gõ chữ vừa làm nhân vật đi.
