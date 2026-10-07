# 🐾 PetGame

Game 3D bắt thú, chiến đấu, sinh tồn góc nhìn từ trên xuống, chơi trên **trình duyệt và điện thoại**, **tối đa 5 người** cùng một thế giới.

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
TypeScript · Three.js (3D low-poly) · Colyseus 0.18 · Vite · Vitest · Playwright

## Kiểm thử

```bash
npm run typecheck
npm test          # unit test
npm run test:e2e  # 5 trình duyệt cùng vào một thế giới
```

Xem `GAME_PLAN.md` cho lộ trình và `CLAUDE.md` cho quy ước phát triển với các agent.
