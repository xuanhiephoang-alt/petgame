# 🐾 PetGame

Game 2D bắt thú, chiến đấu, sinh tồn góc nhìn từ trên xuống (hình vẽ kiểu hoạt hình), chơi trên **trình duyệt và điện thoại**, **tối đa 5 người** cùng một thế giới.

## Có gì trong game

- Lục địa 200×150 m giữa biển, chia 5 vùng khí hậu: 🌳 đồng cỏ ở giữa (cây, hồ, bụi quả), ❄️ núi tuyết phía bắc (lạnh), 🏜️ sa mạc phía nam (nóng), 🌧️ đầm lầy phía tây (mưa), 🌋 núi lửa phía đông (trùm **Vua Đá Boulderhorn**). Bốn góc biển có 🏝️ đảo hoang, phải đóng 🛶 bè mới ra được.
- Thời tiết riêng từng vùng; vùng lạnh/nóng làm mất máu nếu thiếu 🧥 áo ấm / 👒 nón lá (hoặc thú hệ lửa / nước đi theo).
- 13 loài thú theo vùng và giờ (ngày/đêm), càng xa càng mạnh; bắt, nuôi lên cấp, cho đi theo đánh cùng hoặc làm việc ở trại.
- 40 rương báu, bụi quả mọng để hái, chuỗi 16 nhiệm vụ, chế tạo, nâng cấp trại, bản đồ thu nhỏ (phím N), lưu game tự động.

## Chơi trên iPhone / điện thoại

Xem hướng dẫn từng bước: [`docs/choi-tren-iphone.md`](docs/choi-tren-iphone.md). Nhanh nhất: chạy `npm run play` trên máy tính rồi mở địa chỉ nó in ra bằng Safari trên iPhone (cùng Wi-Fi).

## Chạy thử (phát triển)

```bash
npm install
npm run dev
```

Mở http://localhost:5173, nhập tên, bấm **Vào chơi**. Gửi **link mời** ở góc trên bên trái cho bạn bè (cùng mạng LAN thì thay `localhost` bằng IP máy bạn).

| Điều khiển | Bàn phím | Điện thoại |
|---|---|---|
| Di chuyển | WASD / mũi tên | Kéo ở nửa trái màn hình |
| Đánh (giảm máu thú) | Space | Nút **Đánh** |
| Ném bóng bắt thú gần nhất | E | Nút **Bắt** |

Thú càng ít máu càng dễ bắt.

## Công nghệ
TypeScript · PixiJS 8 (2D, WebGL) · Colyseus 0.18 · Vite · Vitest · Playwright

## Hình do AI vẽ

Cả 13 loài thú, 5 nhân vật người chơi, cây cối, đá, bụi, rương, lửa trại và bè là ảnh do AI vẽ (hình vẽ bằng code là dự phòng). Muốn thay bằng ảnh của bạn (một ảnh ghép 4 góc: trước, bên, sau, bên kia):
`npm run sprite -- anh.png --pal emberpup` (thú), `npm run sprite -- anh.png --player 0` (người chơi), hoặc dùng trang `npm run photo3d:web` (chế độ **Một ảnh** → **Đưa vào game**).
Cây cối, đá, đồ vật: `npm run sprite -- anh.png --objects Tree_1_A,Tree_2_A,... --sheet trees`.
Câu lệnh mẫu cho AI vẽ ảnh và cách chọn màu nền: [`docs/art-style.md`](docs/art-style.md), mô tả từng loài: [`docs/design/pals.md`](docs/design/pals.md). Xem mọi hình ở http://localhost:5173/sprites.html khi chạy `npm run dev`.

## Kiểm thử

```bash
npm run typecheck
npm test          # unit test
npm run test:e2e  # 5 trình duyệt cùng vào một thế giới
```

Xem `GAME_PLAN.md` cho lộ trình và `CLAUDE.md` cho quy ước phát triển với các agent.
