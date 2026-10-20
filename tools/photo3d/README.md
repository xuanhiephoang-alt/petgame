# photo3d: tạo model 3D từ 4 ảnh chụp

Chụp một vật từ **trước, phải, sau, trái** (thêm 4 ảnh **chéo 45°** và ảnh **từ trên xuống** nếu có), công cụ dựng ra model 3D **có màu thật từ ảnh**, xuất `.glb` (dùng được trong game, Blender, web) hoặc `.obj`. Chạy trên máy thường, không cần GPU, mỗi model 2–7 giây.

```
ảnh 4–9 phía ─► tách nền ─► căn chỉnh ─► hiệu chỉnh máy ảnh (chụp gần, chụp từ trên)
             ─► khắc khối từ bóng (tự chọn tròn hay vuông) ─► lưới tam giác, làm mịn
             ─► dán màu từ ảnh ─► model.glb
```

## 1. Chụp ảnh thế nào cho tốt

| Nên | Tránh |
|---|---|
| Đặt vật trên bàn, **nền trơn một màu khác màu vật** (tờ giấy, tấm vải, bức tường) | Nền nhiều đồ vật (trừ khi dùng ảnh đã tách nền) |
| Máy ảnh **ngang tầm giữa vật** | Chúc xuống quá 30° |
| **Đứng xa 1–2 m và zoom** (2x, 3x): ảnh gần như không méo phối cảnh | Chụp sát bằng ống góc rộng |
| Giữ **cùng khoảng cách, cùng zoom** cho mọi ảnh; xoay vật (hoặc đi vòng) đúng 90° mỗi lần (45° nếu chụp cả ảnh chéo) | Mỗi ảnh một khoảng cách |
| Thấy trọn vật, có khoảng trống quanh vật | Cắt mất chân, tai, đuôi |
| Ánh sáng dịu, đều (gần cửa sổ, trời râm) | Đèn flash, bóng đổ gắt |

**Ảnh "phải"** là ảnh chụp *sườn phải của vật* (đứng bên phải vật nhìn vào: đầu vật quay về phía tay phải của bạn). **Ảnh "trái"** ngược lại.

**Ảnh điện thoại chụp gần hoặc từ trên xuống:** giữ nguyên file ảnh gốc (JPG có EXIF, không cắt). Công cụ đọc tiêu cự trong EXIF, tự đoán máy cầm cao hơn vật bao nhiêu độ và hiệu chỉnh. Ảnh đã cắt hoặc tách nền thì mất EXIF và được coi là chụp ngang từ xa. Nếu ảnh đó chụp từ trên xuống, hãy cho biết góc bằng `--elevation 20`.

**Mẹo iPhone:** mở ảnh, chạm giữ vào vật để *nhấc chủ thể khỏi nền*, chọn Chia sẻ, Lưu ra file PNG. Ảnh PNG trong suốt tách nền tốt nhất, nhưng bị cắt và mất EXIF (xem trên): hợp với ảnh chụp từ xa có zoom.

**Thêm 4 ảnh chéo** (trước-phải, sau-phải, sau-trái, trước-trái) cho model chính xác hơn, nhất là vật có góc cạnh (hộp, nhà, rương): ảnh chéo cho biết góc vật vuông hay tròn.

Đặt tên file theo phía (tiếng Anh hoặc tiếng Việt, có dấu hay không đều được) trong một thư mục:

```
D:\anh\meo\  truoc.jpg  phai.jpg  sau.jpg  trai.jpg                       (bắt buộc)
             truoc_phai.jpg  sau_phai.jpg  sau_trai.jpg  truoc_trai.jpg   (ảnh chéo, nên có)
             tren.jpg                                                     (từ trên xuống, tuỳ chọn)
   (hoặc front / right / back / left, front_right / back_right / back_left / front_left, top)
```

## 2. Chạy

**Cách 1: chỉ cần Blender (không cài thêm gì)**
```powershell
blender --background --python tools\photo3d\blender_photo3d.py -- D:\anh\meo
```

**Cách 2: npm (tự dùng Python nếu có numpy + Pillow, không thì dùng Blender)**
```powershell
npm.cmd run photo3d -- D:\anh\meo
```

**Cách 3: Python**
```powershell
pip install -e tools/photo3d[best]    # numpy, pillow, scipy, fast-simplification, rembg
python -m photo3d D:\anh\meo
```

**Trong Blender đang mở (hoặc nhờ Claude qua Blender MCP):**
```python
import sys; sys.path.insert(0, r"D:\petgame\tools\photo3d")
import photo3d.blender as pb
pb.run(r"D:\anh\meo", faces=8000)      # dựng xong tự import vào cảnh
```

Kết quả: `D:\anh\meo\model.glb` (đổi bằng `-o duong_dan.glb` hoặc `.obj`).

## 3. Tuỳ chọn

| Tuỳ chọn | Ý nghĩa |
|---|---|
| `--faces 8000` | số tam giác mong muốn (mặc định 20000; game điện thoại nên 3000–8000) |
| `--symmetric` | vật đối xứng trái/phải (con vật, đồ chơi, xe): bớt nhiễu |
| `--shape auto` | mặc định: tự chọn. Có ảnh chéo thì độ tròn/vuông lấy từ ảnh chéo cho từng lát; chỉ 4 ảnh thì so màu giữa các ảnh để biết vật tròn hay vuông |
| `--shape round` / `box` | ép kiểu khối: tròn trịa (thú, đồ chơi) hoặc sắc cạnh (hộp, nhà, tủ) |
| `--roundness 3` | độ "vuông" của mặt cắt kiểu tròn (2 = elip, càng lớn càng vuông) |
| `--elevation 20` | máy cầm cao hơn vật 20° (chúc xuống). `auto` để tự đoán; mặc định tự đoán khi ảnh có EXIF |
| `--focal 26` | tiêu cự quy đổi 35 mm của ảnh gốc chưa cắt (camera chính điện thoại ~26, zoom 2x ~52). `0` = coi như chụp từ xa; mặc định đọc EXIF |
| `--thin 0` | tắt giả định "phần bị che phía sau thì mảnh" (đuôi, sừng, chân) |
| `--cutout key` / `rembg` / `alpha` | cách tách nền: nền trơn / AI (cần `pip install rembg`) / PNG trong suốt. Mặc định tự chọn |
| `--res 160` | độ chi tiết khi khắc khối (cao hơn = chậm hơn, chi tiết hơn) |
| `--texture 2048` | độ phân giải texture (pixel trên một chiều cao vật) |

## 4. Chất lượng đo được

Bộ thử: chụp (render) các model có sẵn của game và vài đồ vật bằng Blender, chạy công cụ, so với model gốc. Sai số Chamfer tính theo % chiều cao vật (thấp là tốt), F-score là tỉ lệ bề mặt nằm trong 2% chiều cao so với bản gốc (cao là tốt).

| Bộ thử | Cách chụp | Sai số | F-score |
|---|---|---|---|
| 8 thú và rương, chụp ngang từ xa | 4 ảnh | 2,4 % | 0,66 |
| | 4 ảnh + ảnh trên | 2,2 % | 0,69 |
| 7 thú, rương, hiệp sĩ | 4 ảnh | 2,2 % | 0,67 |
| | 8 ảnh (thêm 4 ảnh chéo) | 2,1 % | 0,70 |
| 9 đồ vật: hộp, thùng, sách, nhà, lon, thùng tròn, bóng | 4 ảnh, luôn khối tròn (bản cũ) | 2,5 % | 0,74 |
| | 4 ảnh, tự chọn tròn/vuông | 0,7 % | 0,99 |
| 12 bộ ảnh kiểu điện thoại: cách 2–6 lần chiều cao vật, cầm cao hơn 0–25° | coi như chụp ngang từ xa (bản cũ) | 2,42 % | 0,58 |
| | hiệu chỉnh từ EXIF | 2,35 % | 0,62 |

Thời gian 2–3 giây một model; 3–7 giây khi có hiệu chỉnh máy ảnh. Để so sánh: khối thô (visual hull vuông) ban đầu sai khoảng 4,5 %.

## 5. Giới hạn hiện tại (và cách khắc phục sau)

- **Chỗ lõm không thấy được từ 4 phía** (lòng bát, khoang trong) bị lấp đầy: giới hạn của phương pháp dựng từ bóng.
- **Phần bị che phía sau** (đuôi sau thân, gai lưng) phải đoán độ dày: dùng giả định "mảnh và tròn"; thêm ảnh từ trên xuống sẽ chính xác hơn.
- **Đường nối màu** giữa các ảnh nếu ánh sáng mỗi ảnh khác nhau (đã tự cân bằng màu, nhưng chụp cùng ánh sáng vẫn tốt nhất).
- **Chụp gần, chụp từ trên:**
  - Chỉ tự đoán góc chụp khi biết tiêu cự (EXIF hoặc `--focal`); không có thì cho `--elevation` hoặc dùng `--elevation auto` (kém chắc chắn hơn).
  - Mặt trên của vật khi chụp từ trên xuống là phần khó nhất: có thể hơi phồng.
  - Chụp ngang từ xa vẫn cho kết quả tốt nhất.
- **Tròn hay vuông với 4 ảnh:** đoán nhờ màu và bóng sáng. Vật một màu trơn dưới ánh sáng đều (không có bóng) được coi là tròn; vật vuông kiểu đó cần `--shape box` hoặc thêm ảnh chéo.

## 6. Lộ trình

1. ~~Dựng từ bóng + dán màu ảnh, xuất GLB, chạy trong Blender~~ (xong)
2. Chế độ AI (cần GPU NVIDIA hoặc chờ lâu trên CPU): dùng model mã nguồn mở **Hunyuan3D-2mv** (nhận đúng 4 ảnh trước/trái/sau/phải), **TripoSR** hoặc **TRELLIS** để có hình dạng chi tiết hơn, rồi dán màu bằng bước chiếu ảnh của photo3d. Cần tải model từ Hugging Face.
3. ~~Ảnh điện thoại chụp gần/từ trên (EXIF), ảnh chéo 45°, tự chọn khối tròn hay vuông~~ (xong)
4. Bake texture liền mạch (hoà màu ở đường nối), sinh normal map.
5. Tự gắn xương và animation đi/đứng (như Tripo), dọn lưới (retopology) bằng Blender.
6. Trang web: kéo thả 4 ảnh, xem trước 3D, tải về.

## Cho lập trình viên

- Mã nguồn trong `photo3d/`, lõi chỉ cần numpy nên chạy được trong Python của Blender:
  - `images.py`: đọc ảnh và EXIF, tách nền, căn chỉnh ban đầu.
  - `cameras.py`: máy ảnh (hướng, góc chúc, phối cảnh).
  - `calibrate.py`: hiệu chỉnh máy ảnh theo độ khớp đường viền.
  - `carve.py`: khắc khối.
  - `prior.py`: đoán tròn hay vuông.
  - `mesh.py`: lưới tam giác.
  - `texture.py`: dán màu.
  - `export.py`: xuất GLB/OBJ.
  - `pipeline.py`: ghép tất cả lại.
- Test: `cd tools/photo3d && python -m pytest`
- Tạo bộ ảnh thử từ model có sẵn: `blender --background --python tools/photo3d/samples/render_views.py -- --model model.glb --out thu_muc`
  - Ảnh chéo: thêm `--views front,right,back,left,front_right,back_right,back_left,front_left`.
  - Kiểu điện thoại: thêm `--perspective 2.5 --elevation 20`.
  - Kèm theo là `camera.json`, máy ảnh thật của từng ảnh.
- Đo chất lượng: `python tools/photo3d/samples/benchmark.py thu_muc_chua_cac_bo_anh [--top] [--diagonal] [--focal 0]`
