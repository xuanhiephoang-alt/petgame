# Phong cách đồ họa 2D

> **Chuẩn hiện tại: hoạt hình 2D viền mảnh**, giống ảnh thú do AI vẽ (xem `packages/client/public/assets/pals/emberpup.png`). Mọi hình mới, vẽ bằng code hay bằng AI, phải hợp với nó.

- **Góc nhìn:** từ trên xuống. Mặt đất nhìn thẳng từ trên; cây, người, thú đứng thẳng (nhìn từ trước hơi chếch), sắp xếp trước sau theo chân (y).
- **Nét vẽ:** viền mảnh màu đậm cùng tông với màu tô (không dùng đen), tô 2 tông: phần sáng ở trên bên trái, phần tối ở dưới bên phải, thêm một mảng sáng nhỏ. Ánh sáng luôn từ trên bên trái.
- **Cảm giác:** dễ thương, tươi sáng; thú tròn trịa, đầu to, mắt to bóng (tròng màu, hai đốm sáng), chân ngắn, má hồng nhạt; màu bão hòa vừa phải.
- **Tỉ lệ (pixel của server = pixel thế giới):** người chơi cao ~50; thú 37–62 tùy `size` trong `pals.json` (`palHeight` = size × 3,1); boss gấp 2,4; cây 100–130; bụi 30; rương 26.
- **Hướng:** mỗi loài có 3 hình: trước (đi xuống màn hình), sau (đi lên), bên (đi sang phải; sang trái là hình bên lật lại). Ảnh PNG có thể có đủ 4 hướng.
- **Chuyển động:** không vẽ từng khung hình. Thú nhún nhảy, phồng xẹp, lao tới khi đánh, rung khi bị đánh; người chơi đung đưa tay chân (ghép từ các mảnh). Cây, bụi lay theo gió.
- **Mặt đất:** màu theo vùng hòa vào nhau, bãi cát quanh biển và hồ, cỏ, hoa, sỏi vẽ thẳng vào nền (không tốn gì khi chơi), bóng mềm dưới cây/đá.
- **Nước:** dải màu nông/sâu rõ ràng kiểu hoạt hình, viền bọt trắng ở bờ, sóng lăn vào, vài đốm lấp lánh.
- **Ngày đêm:** ban đêm tối xanh, sáng quanh đèn lồng người chơi, lửa trại, dung nham, đèn trại, rương; hoàng hôn ấm màu cam.

## Hình thú bằng AI vẽ ảnh

Câu lệnh mẫu (thay phần mô tả bằng mô tả trong `docs/design/pals.md`):

```
Character turnaround sheet of a cute chibi creature for a 2D game: <mô tả bằng tiếng Anh>.
Four views in one row, same size, standing on the same ground line: front view, left side view,
back view, right side view. Clean cartoon style, thin dark colored outline, two-tone cel shading,
big glossy eyes, soft pastel colors. Plain flat light green background, no text, no shadow on the ground.
```

Rồi `npm run sprite -- anh.png --pal <id>` (hoặc trang `npm run photo3d:web`, chế độ **Một ảnh**). Công cụ tự tách nền, tự nhận ra khi hai ảnh bên bị đổi chỗ.

## Ngân sách hiệu năng (điện thoại)

- Mục tiêu 60 FPS trên iPhone đời 2020 trở lên.
- Mỗi khung hình ≤ 600 sprite (đo bằng `npm run shots`); mặt đất nướng sẵn theo mảng 512 px, nhớ tối đa 24 mảng.
- Hình vẽ bằng code được vẽ ở độ nét vừa đủ cho màn hình (`setArtScale`), ảnh PNG của thú cao 256 px mỗi ô.
