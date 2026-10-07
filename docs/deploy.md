# Đưa PetGame lên mạng

Một container duy nhất chạy **server game** (Colyseus) và phục vụ luôn **trang web** của game, nên chỉ cần deploy một chỗ, có một link để gửi bạn bè.

Kiểm tra trước trên máy:

```bash
npm run build
PORT=3000 npm start --workspace=@petgame/server
# mở http://localhost:3000
```

## Cách 1: Fly.io (đề xuất, có máy chủ ở Singapore)

1. Tạo tài khoản ở https://fly.io và cài `flyctl` (https://fly.io/docs/flyctl/install/).
2. `fly auth login`
3. Sửa `app = "petgame-change-me"` trong `fly.toml` thành tên riêng, ví dụ `petgame-hiep`.
4. Lần đầu: `fly launch --copy-config --no-deploy`.
5. Tạo ổ lưu dữ liệu người chơi (thú, trại, tài nguyên): `fly volumes create petgame_data --size 1 --region sin`, rồi `fly deploy`.
6. **Chỉ chạy 1 máy**, vì phòng chơi lưu trong bộ nhớ: `fly scale count 1`.
7. Game chạy ở `https://<tên-app>.fly.dev`. Gửi link mời (góc trái màn hình) cho bạn bè.

Chi phí: máy 512 MB dùng chung khoảng vài USD/tháng; máy tự tắt khi không ai chơi và tự bật khi có người vào (lần vào đầu chờ vài giây).

## Cách 2: Render / Railway

Cả hai đọc được `Dockerfile` ở thư mục gốc:
- Tạo "Web Service" từ repo GitHub, chọn Docker.
- Biến môi trường: `PORT=8080` (Render tự đặt `PORT`, server đọc biến này).
- Health check path: `/healthz`.
- Chỉ chạy **1 instance**.

## Ghi chú

- Dữ liệu người chơi lưu trong SQLite ở `PETGAME_DB` (mặc định trong Docker: `/data/petgame.db`). Phải gắn ổ lưu trữ vào `/data`, nếu không mỗi lần deploy lại sẽ mất dữ liệu. Sao lưu: `fly ssh sftp get /data/petgame.db`.
- Người chơi được nhận diện bằng mã ngẫu nhiên lưu trong trình duyệt (localStorage). Xóa dữ liệu trình duyệt hoặc đổi máy là thành người mới (chưa có tài khoản).

- Không bao giờ đặt `PETGAME_DEBUG=1` trên server thật (biến này chỉ để chạy test).
- Muốn tách client lên CDN riêng (Cloudflare Pages...), build với `VITE_SERVER_URL=https://<server>` rồi upload `packages/client/dist`.
- CI (`.github/workflows/ci.yml`) chạy typecheck, unit test, build và e2e mỗi lần push.
