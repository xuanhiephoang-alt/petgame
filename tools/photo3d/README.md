# photo3d: tạo model 3D từ 4 ảnh chụp

Chụp một vật từ **trước, phải, sau, trái** (thêm ảnh **từ trên xuống** nếu có), công cụ dựng ra model 3D **có màu thật từ ảnh**, xuất `.glb` (dùng được trong game, Blender, web) hoặc `.obj`. Chạy trên máy thường, không cần GPU, mỗi model 1–5 giây.

```
ảnh 4 phía ─► tách nền ─► căn chỉnh tỉ lệ ─► khắc khối từ bóng (visual hull, mặt cắt tròn)
          ─► lưới tam giác + làm mịn + giảm số tam giác ─► dán màu từ ảnh ─► model.glb
```

## 1. Chụp ảnh thế nào cho tốt

| Nên | Tránh |
|---|---|
| Đặt vật trên bàn, **nền trơn một màu khác màu vật** (tờ giấy, tấm vải, bức tường) | Nền nhiều đồ vật (trừ khi dùng ảnh đã tách nền) |
| Máy ảnh **ngang tầm giữa vật**, không chúc xuống | Chụp từ trên xuống chéo (khi đó mặt trên lọt vào ảnh "bên") |
| **Đứng xa 1–2 m và zoom** (2x, 3x): ảnh gần như không méo phối cảnh | Chụp sát bằng ống góc rộng |
| Giữ **cùng khoảng cách, cùng zoom** cho cả 4 ảnh; xoay vật (hoặc đi vòng) đúng 90° mỗi lần | Mỗi ảnh một khoảng cách |
| Thấy trọn vật, có khoảng trống quanh vật | Cắt mất chân, tai, đuôi |
| Ánh sáng dịu, đều (gần cửa sổ, trời râm) | Đèn flash, bóng đổ gắt |

**Ảnh "phải"** là ảnh chụp *sườn phải của vật* (đứng bên phải vật nhìn vào: đầu vật quay về phía tay phải của bạn). **Ảnh "trái"** ngược lại.

**Mẹo iPhone:** mở ảnh, chạm giữ vào vật để *nhấc chủ thể khỏi nền*, chọn Chia sẻ, Lưu ra file PNG. Ảnh PNG trong suốt cho kết quả tách nền tốt nhất.

Đặt tên file theo phía (tiếng Anh hoặc tiếng Việt, có dấu hay không đều được) trong một thư mục:

```
D:\anh\meo\  truoc.jpg  phai.jpg  sau.jpg  trai.jpg  [tren.jpg]
             (hoặc front / right / back / left / top)
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
| `--shape box` | vật vuông thành sắc cạnh (hộp, nhà, tủ). Mặc định `round` cho vật tròn trịa |
| `--roundness 3` | độ "vuông" của mặt cắt (2 = elip, càng lớn càng vuông) |
| `--thin 0` | tắt giả định "phần bị che phía sau thì mảnh" (đuôi, sừng, chân) |
| `--cutout key` / `rembg` / `alpha` | cách tách nền: nền trơn / AI (cần `pip install rembg`) / PNG trong suốt. Mặc định tự chọn |
| `--res 160` | độ chi tiết khi khắc khối (cao hơn = chậm hơn, chi tiết hơn) |
| `--texture 2048` | độ phân giải texture (pixel trên một chiều cao vật) |

## 4. Chất lượng đo được

Bộ thử: chụp (render) 4 phía các model có sẵn của game bằng Blender, chạy công cụ, so với model gốc. Sai số Chamfer tính theo % chiều cao vật (thấp là tốt), F-score là tỉ lệ bề mặt nằm trong 2% chiều cao so với bản gốc (cao là tốt):

| | 4 ảnh | 4 ảnh + ảnh trên |
|---|---|---|
| Sai số trung bình (Chamfer) | 2,4 % | 2,2 % |
| F-score trung bình | 0,65 | 0,68 |
| Thời gian | 1–3 giây/model | |

Để so sánh: khối thô (visual hull vuông) ban đầu sai khoảng 4,5 %.

## 5. Giới hạn hiện tại (và cách khắc phục sau)

- **Chỗ lõm không thấy được từ 4 phía** (lòng bát, khoang trong) bị lấp đầy: giới hạn của phương pháp dựng từ bóng.
- **Phần bị che phía sau** (đuôi sau thân, gai lưng) phải đoán độ dày: dùng giả định "mảnh và tròn"; thêm ảnh từ trên xuống sẽ chính xác hơn.
- **Đường nối màu** giữa các ảnh nếu ánh sáng mỗi ảnh khác nhau (đã tự cân bằng màu, nhưng chụp cùng ánh sáng vẫn tốt nhất).
- Giả định ảnh **không méo phối cảnh**: hãy đứng xa và zoom.

## 6. Lộ trình

1. ~~Dựng từ bóng + dán màu ảnh, xuất GLB, chạy trong Blender~~ (xong)
2. Chế độ AI (cần GPU NVIDIA hoặc chờ lâu trên CPU): dùng model mã nguồn mở **Hunyuan3D-2mv** (nhận đúng 4 ảnh trước/trái/sau/phải), **TripoSR** hoặc **TRELLIS** để có hình dạng chi tiết hơn, rồi dán màu bằng bước chiếu ảnh của photo3d. Cần tải model từ Hugging Face.
3. Hỗ trợ ảnh có phối cảnh (máy ảnh điện thoại chụp gần) và thêm ảnh chéo 45°.
4. Bake texture liền mạch (hoà màu ở đường nối), sinh normal map.
5. Tự gắn xương và animation đi/đứng (như Tripo), dọn lưới (retopology) bằng Blender.
6. Trang web: kéo thả 4 ảnh, xem trước 3D, tải về.

## Cho lập trình viên

- Mã nguồn: `photo3d/` (`images.py` tách nền và căn chỉnh, `carve.py` khắc khối, `mesh.py` lưới, `texture.py` dán màu, `export.py` GLB/OBJ, `pipeline.py` ghép lại). Lõi chỉ cần numpy nên chạy được trong Python của Blender.
- Test: `cd tools/photo3d && python -m pytest`
- Tạo bộ ảnh thử từ model có sẵn: `blender --background --python tools/photo3d/samples/render_views.py -- --model model.glb --out thu_muc`
- Đo chất lượng: `python tools/photo3d/samples/benchmark.py thu_muc_chua_cac_bo_anh [--top]`
