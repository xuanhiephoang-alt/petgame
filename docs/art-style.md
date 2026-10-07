# Phong cách đồ họa 3D

> **Chuẩn hiện tại: phong cách KayKit** (chibi, bo tròn, smooth shading, màu tươi, texture gradient). Mọi asset mới phải hợp với cây cỏ và nhân vật KayKit đang dùng (xem `assets/CREDITS.md`).

- **Thể loại hình:** 3D low-poly kiểu KayKit, **smooth shading** (chỉ đá/khoáng dùng flat), camera phối cảnh nhìn chéo từ trên xuống (~50°).
- **Cảm giác:** dễ thương, tươi sáng; thú tròn trịa, mắt to, chân ngắn; màu bão hòa vừa phải.
- **Tỉ lệ:** 1 đơn vị = 1 m = 32 px của server. Người chơi cao ~1,7; thú nhỏ 0,8–1,2; thú lớn/boss 2–4; cây 2,5–4.
- **Ngân sách polygon:** thú nhỏ < 3k tam giác, nhân vật < 5k, boss < 10k, vật trang trí < 500.
- **Màu và chất liệu:** ưu tiên màu theo vertex hoặc một texture bảng màu 256×256 dùng chung (gradient atlas), vật liệu Lambert/Standard không bóng loáng.
- **Ánh sáng trong game:** trời xanh nhạt, ánh nắng vàng ấm, bóng đổ mềm; sương mù xa để giấu viền bản đồ.
- **Animation tối thiểu:** `idle`, `walk`, `attack`, `hurt` (thú làm việc: thêm `work`).

## Prompt mẫu cho Meshy / Tripo
`cute chubby <mô tả thú>, low poly stylized game character, flat shading, vibrant colors, big eyes, short legs, T-pose, clean topology, under 3000 triangles`

## Tham khảo phong cách (chỉ để cảm nhận, không sao chép)
Low-poly kiểu asset Quaternius / Kenney, phong cách "cozy" của các game nông trại 3D.
