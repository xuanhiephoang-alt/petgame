# Chơi PetGame trên iPhone

Có 2 cách. **Cách A** nhanh và miễn phí, chơi trong cùng mạng Wi-Fi nhà bạn. **Cách B** đưa game lên mạng để bạn bè ở xa cùng vào.

---

## Cách A: Chạy trên máy tính, chơi bằng iPhone cùng Wi-Fi (khoảng 10 phút)

### Lần đầu cài đặt (trên máy tính Windows hoặc Mac)

1. **Cài Node.js**: vào https://nodejs.org, tải bản **LTS** (22 trở lên), cài như phần mềm bình thường.
2. **Tải mã nguồn game**: vào trang GitHub của repo `xuanhiephoang-alt/petgame`, chọn nhánh **`claude/clever-galileo-23g43e`** (nút chọn nhánh ở góc trái), bấm **Code → Download ZIP**, rồi giải nén.
   - Nếu đã cài Git: `git clone -b claude/clever-galileo-23g43e https://github.com/xuanhiephoang-alt/petgame.git`
3. Mở **Terminal** (Mac) hoặc **PowerShell** (Windows), đi vào thư mục vừa giải nén:
   ```bash
   cd đường-dẫn-tới/petgame
   npm install
   ```

### Mỗi lần chơi

```bash
npm run play
```

Chờ khoảng 10–20 giây, màn hình sẽ in ra:

```
Mở game trên máy này:   http://localhost:2567
Mở trên điện thoại:     http://192.168.1.23:2567  (cùng mạng Wi-Fi)
```

4. Trên iPhone (cùng Wi-Fi với máy tính), mở **Safari**, gõ đúng địa chỉ dòng "Mở trên điện thoại".
5. Nhập tên, bấm **Vào chơi**. Muốn chơi cùng nhau: gửi **link mời** (góc trái màn hình game) cho người khác cùng Wi-Fi.
6. Tắt game: bấm `Ctrl + C` trong cửa sổ Terminal. Thú, trại, tài nguyên đã được lưu trên máy tính.

### Nếu iPhone không vào được

- **Windows** hỏi "Allow access" cho Node.js lần đầu: chọn **Allow** (Private networks). Nếu lỡ chặn: Windows Security → Firewall → Allow an app → bật Node.js.
- **Mac** hỏi "Accept incoming network connections": chọn **Allow**.
- iPhone và máy tính phải **cùng một mạng Wi-Fi** (không dùng 4G/5G, không dùng Wi-Fi khách).
- Một số router chặn các thiết bị nói chuyện với nhau ("AP isolation"/"Client isolation"); khi đó dùng Cách B.

---

## Cách B: Đưa lên mạng bằng Render (không cần cài gì, chơi ở đâu cũng được)

1. Tạo tài khoản ở https://render.com (đăng nhập bằng GitHub là nhanh nhất).
2. Chọn **New → Blueprint**, chọn repo `petgame`, nhánh **`claude/clever-galileo-23g43e`**. Render đọc file `render.yaml` có sẵn và tự cấu hình.
3. Bấm **Apply**, chờ build khoảng 5–10 phút.
4. Render cho bạn một link dạng `https://petgame-xxxx.onrender.com`. Mở link này trên iPhone, gửi cho bạn bè.

Lưu ý gói **miễn phí** của Render:
- Server **ngủ sau ~15 phút** không ai chơi; lần vào tiếp theo chờ khoảng 1 phút để nó thức dậy.
- Ổ đĩa **không lưu lâu dài**: thú và trại có thể mất khi server ngủ hoặc cập nhật. Muốn giữ dữ liệu cần gói trả phí kèm ổ đĩa, hoặc dùng Fly.io theo `docs/deploy.md`.

---

## Mẹo khi chơi trên iPhone

- **Xoay ngang** điện thoại cho dễ chơi.
- **Thêm vào Màn hình chính** để chơi toàn màn hình như app: trong Safari bấm nút Chia sẻ → **Thêm vào MH chính**.
- **Không nghe tiếng?** Gạt **nút im lặng** bên cạnh iPhone sang chế độ có tiếng (Safari tắt âm thanh web khi iPhone ở chế độ im lặng), rồi chạm vào màn hình game một lần.
- **Giật lag?** Tắt **Chế độ nguồn điện thấp** (Low Power Mode). Chế độ này giới hạn game ở 30 khung hình/giây.
- Điều khiển: kéo nửa trái màn hình để đi; nút **Đánh**, **Bắt**, **🫐 Ăn**, **🐾 Thú**, **🏕️ Đặt trại**, **🔨 Chế tạo** trên màn hình.
- Thú và tiến trình được lưu theo **trình duyệt trên máy đó**. Xóa dữ liệu Safari hoặc đổi máy là bắt đầu lại.
