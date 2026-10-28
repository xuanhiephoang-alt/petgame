# Nguồn asset

| Asset | Nguồn | Giấy phép |
|---|---|---|
| Mặt đất, cỏ, hoa, nước, trại, hiệu ứng; hình dự phòng của thú, người chơi, cây cối, đồ vật và núi lửa | Vẽ bằng code: `packages/client/src/game/art/` | Thuộc dự án |
| `packages/client/public/assets/pals/emberpup.webp` | Ảnh Emberpup 4 góc do chủ dự án làm bằng AI vẽ ảnh, tách nền bằng `npm run sprite` | Thuộc dự án |
| `packages/client/public/assets/pals/*.webp` (12 loài còn lại) | AI vẽ ảnh (Figma AI, model gemini-3.1-flash-lite-image) trên tài khoản của chủ dự án, theo mô tả trong `docs/design/pals.md`; tách nền bằng `npm run sprite` | Thuộc dự án |
| `packages/client/public/assets/players/*.webp` (5 người chơi) | AI vẽ ảnh (Figma AI, như trên), câu lệnh trong `docs/art-style.md` | Thuộc dự án |
| `packages/client/public/assets/nature/*.webp` (cây lá tròn, thông, thông tuyết, cây đầm lầy, cọ, xương rồng, bụi, đá, rương, lửa trại, bè, núi lửa, đá bazan, miệng phun hơi, obsidian, gốc cây cháy, vũng và vết nứt dung nham; đá và bụi riêng của vùng tuyết, sa mạc, đầm lầy, đảo; vật trang trí: hoa, cỏ ba lá, vòng nấm, gốc cây, khúc gỗ, biển chỉ đường, người tuyết, pha lê băng, ao đóng băng, cỏ lăn, đầu lâu bò, cây chết, vò đất, lau sậy, nấm tím, vũng bùn, lá súng, dương xỉ, dừa, vỏ sò, gỗ trôi dạt, lâu đài cát) | AI vẽ ảnh (Figma AI, như trên), cắt bằng `npm run sprite -- --objects` | Thuộc dự án |

Hình của thú, người chơi, cây cối và đồ vật có thể thay bằng ảnh trong `packages/client/public/assets/` (`pals/`, `players/`, `nature/`; xem `npm run sprite` và `docs/art-style.md`).
Mọi asset lấy từ bên ngoài phải ghi vào bảng này kèm giấy phép.
