# 🐾 PetGame

Game 3D bắt thú, chiến đấu, sinh tồn góc nhìn từ trên xuống, chơi trên **trình duyệt và điện thoại**, **tối đa 5 người** cùng một thế giới.

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
