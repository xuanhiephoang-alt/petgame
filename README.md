# 🐾 PetGame

Game 2D bắt thú, chiến đấu, sinh tồn góc nhìn từ trên xuống (hình vẽ kiểu hoạt hình), chơi trên **trình duyệt và điện thoại**, **tối đa 5 người** cùng một thế giới.

## Có gì trong game

- Lục địa 200×150 m giữa biển, chia 5 vùng khí hậu: 🌳 đồng cỏ ở giữa (cây, hồ, bụi quả), ❄️ núi tuyết phía bắc (lạnh), 🏜️ sa mạc phía nam (nóng), 🌧️ đầm lầy phía tây (mưa), 🌋 núi lửa phía đông (trùm **Vua Đá Boulderhorn**). Bốn góc biển có 🏝️ đảo hoang, phải đóng 🛶 bè mới ra được.
- Thời tiết riêng từng vùng; vùng lạnh/nóng làm mất máu nếu không mặc 🧥 áo ấm (hay đội 🧶 mũ len) / đội 👒 nón lá (hay 🤠 mũ thám hiểm), hoặc có thú hệ lửa / nước đi theo.
- Tự chọn ngoại hình ở sảnh (8 kiểu tóc, 8 màu tóc, 5 màu da) và thay đồ trong **👕 Tủ đồ** (phím T): 8 bộ quần áo, 8 mũ, 8 vũ khí (gậy, kiếm, rìu, giáo đánh gần; ná, cung, gậy phép bắn xa). Đồ có từ đầu, chế tạo ở trại, tìm trong rương hoặc hạ trùm mới có; giáp và mũ sắt giảm sát thương.
- 13 loài thú theo vùng và giờ (ngày/đêm), càng xa càng mạnh; bắt, nuôi lên cấp, cho đi theo đánh cùng hoặc làm việc ở trại.
- 30 chiêu thức của thú (mỗi loài học 3 chiêu ở cấp 1, 7, 15): cầu lửa, phun lửa, thiên thạch, dây leo trói, bão lá, mưa hồi máu, sóng thần, bão tuyết, khiên đá, động đất, sấm sét, sét chuỗi... Mỗi chiêu có hoạt ảnh riêng, sát thương tăng theo cấp và khắc hệ. Thú hoang cũng tung chiêu: vùng đỏ trên đất cho biết chỗ sắp trúng. Bảng chiêu: [`docs/design/skills.md`](docs/design/skills.md).
- 6 thú đầu đàn ★, mỗi vùng một con (Voltmouse ở đồng cỏ, Bogbloom ở đầm lầy, Cactoad ở sa mạc, Frostfang ở núi tuyết, Scorchtail ở núi lửa, Coralcrab ở đảo hoang): to hơn, cấp 15-22, thuộc đủ 3 chiêu, canh lãnh địa và tấn công ai lại gần, bị kéo đi xa thì quay về hồi máu. Hạ được thì thưởng lớn và nhiều kinh nghiệm cho thú đi theo; bắt được (khó hơn thường) thì có ngay một con thú cấp cao. Xuất hiện lại sau 6 phút; dấu ★ trên bản đồ.
- Chiến đấu: thú gồng người trước khi cắn (lùi hoặc lướt để né), đòn đánh văng thú, đòn chí mạng, thú choáng ở 1 máu (bắt dễ hơn hoặc hạ gục lấy đồ), thú hiền bị đánh thì bỏ chạy. Bắt thú có bóng lắc 1–3 lần trước khi biết kết quả.
- Chặt cây lấy gỗ, đập đá lấy đá (rìu, búa được gấp đôi); cây thành gốc, đá thành đống vụn rồi mọc lại.
- 40 rương báu, bụi quả mọng để hái, chuỗi 17 nhiệm vụ, chế tạo, nâng cấp trại, bản đồ thu nhỏ (phím N), lưu game tự động.

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
| Đánh thú; đứng cạnh cây, đá thì chặt gỗ, đập đá | Space | Nút **Đánh** |
| Lướt né (nhanh, không bị cắn trong lúc lướt) | Shift | Nút **💨** |
| Ném bóng bắt thú gần nhất | E | Nút **Bắt** |
| Bảo thú đi theo dùng chiêu 1, 2, 3 (nó chạy tới thú bạn đang đánh) | 1 / 2 / 3 | 3 nút tròn trên nút **Bắt** |

Thú càng ít máu càng dễ bắt. Còn 1 máu thì thú **choáng** 💫 vài giây: ném bóng lúc này dễ bắt hơn, đánh thêm một đòn thì hạ gục nó và nhặt đồ rơi ra. Thú gồng người (đỏ lên) trước khi cắn: lùi lại hoặc lướt để né. Thú hoang gồng chiêu (sáng màu hệ, tên chiêu hiện trên đầu) thì mặt đất hiện vùng đỏ đúng chỗ chiêu sẽ trúng: chạy ra khỏi vùng hoặc lướt qua. Trùm giậm chân sau khi hiện vòng đỏ trên đất: chạy ra khỏi vòng. Thú đi theo bạn tự tung chiêu vào thú bạn đang đánh, hồi máu hoặc dựng khiên khi bạn yếu; thanh chiêu ở dưới màn hình cho bạn tự ra lệnh (phím 1-3), đếm giây hồi chiêu, và nút **Tự động / Theo lệnh** để thú chỉ dùng chiêu khi bạn bảo.

## Công nghệ
TypeScript · PixiJS 8 (2D, WebGL) · Colyseus 0.18 · Vite · Vitest · Playwright

## Hình do AI vẽ

Cả 13 loài thú, người chơi (8 kiểu tóc, 8 bộ quần áo, 8 mũ, 8 vũ khí ghép tự do), cây cối, đá, bụi, rương, lửa trại, bè, núi lửa và vật trang trí của cả 6 vùng (hoa, gốc cây, người tuyết, pha lê băng, cỏ lăn, lau sậy, nấm phát sáng, lá súng, vỏ sò...) là ảnh do AI vẽ (hình vẽ bằng code là dự phòng). Muốn thay bằng ảnh của bạn (một ảnh ghép 4 góc: trước, bên, sau, bên kia):
`npm run sprite -- anh.png --pal emberpup` (thú), `npm run sprite -- anh.png --head <kiểu tóc>` hoặc `--outfit <bộ đồ>` (người chơi, xem `docs/art-style.md`), hoặc dùng trang `npm run photo3d:web` (chế độ **Một ảnh** → **Đưa vào game**).
Cây cối, đá, đồ vật: `npm run sprite -- anh.png --objects Tree_1_A,Tree_2_A,... --sheet trees`.
Câu lệnh mẫu cho AI vẽ ảnh và cách chọn màu nền: [`docs/art-style.md`](docs/art-style.md), mô tả từng loài: [`docs/design/pals.md`](docs/design/pals.md). Xem mọi hình ở http://localhost:5173/sprites.html khi chạy `npm run dev`.

## Kiểm thử

```bash
npm run typecheck
npm test          # unit test
npm run test:e2e  # 5 trình duyệt cùng vào một thế giới
```

Xem `GAME_PLAN.md` cho lộ trình và `CLAUDE.md` cho quy ước phát triển với các agent.
