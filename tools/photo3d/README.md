# photo3d: tạo model 3D từ 4 ảnh chụp

Chụp một vật từ **trước, phải, sau, trái** (thêm 4 ảnh **chéo 45°** và ảnh **từ trên xuống** nếu có), công cụ dựng ra model 3D **có màu thật từ ảnh**, xuất `.glb` (dùng được trong game, Blender, web) hoặc `.obj`. Thêm `--rig` để model **có xương và 4 động tác của thú trong game** (đứng, đi, tấn công, bị đánh). Chạy trên máy thường, không cần GPU, mỗi model từ vài giây (ảnh nhỏ) đến khoảng 20 giây (ảnh điện thoại lớn).

```
ảnh 4–9 phía ─► tách nền ─► căn chỉnh ─► hiệu chỉnh máy ảnh (chụp gần, chụp từ trên)
             ─► khắc khối từ bóng (tự chọn tròn hay vuông) ─► lưới tam giác, làm mịn
             ─► dán màu từ ảnh, hoà màu ở đường nối ─► (gắn xương + animation) ─► model.glb
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

**Cách dễ nhất: trang web**
```powershell
npm.cmd run photo3d:web
```
Trình duyệt tự mở http://localhost:8765. Trên trang:
1. Kéo thả ảnh vào 9 ô, hoặc kéo cả thư mục ảnh vào: ảnh tên `truoc`, `phai`... tự vào đúng ô. Kéo ảnh từ ô này sang ô khác để đổi chỗ.
2. Chọn dùng để làm gì: **Thú trong game** (có xương, file nhẹ), **Đồ vật trong game** hoặc **Chất lượng cao**.
3. Bấm **Dựng model 3D**: thanh tiến trình cho biết đang làm bước nào.
4. Xoay model bằng chuột hoặc ngón tay. Bấm **Đứng, Đi, Tấn công, Bị đánh** để xem động tác, **Lưới** để xem khung tam giác.
5. Bấm **Tải model (.glb)**, hoặc **Đưa vào game** để thay model của một loài thú (xem mục 4).

Bên dưới model có ảnh sau khi tách nền, để kiểm tra nền đã được bỏ sạch chưa, và các cảnh báo (ảnh đặt nhầm ô, vật chạm mép ảnh...).

**Chụp bằng điện thoại, gửi thẳng lên trang:** cho máy tính và điện thoại vào cùng mạng Wi-Fi. Mở trên điện thoại địa chỉ được in ra ở dòng "Mở trên điện thoại" (dạng `http://192.168.1.5:8765`), chạm vào từng ô để chụp. Lần đầu Windows hỏi tường lửa thì cho phép mạng riêng (Private). Mọi máy cùng Wi-Fi đều mở được trang này khi nó đang chạy; tắt bằng Ctrl+C. Đổi cổng: `npm.cmd run photo3d:web -- --port 9000`.

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
| `--rig` | gắn xương và 4 animation của thú trong game: `idle`, `walk`, `attack`, `hurt` (chỉ `.glb`) |
| `--no-level` | giữ nguyên màu từng ảnh ở đường nối (mặc định: hoà cho liền) |
| `--jpeg` | lưu texture dạng JPEG: file nhỏ hơn khoảng 4 lần (`.glb`) |

## 4. Dùng model làm thú trong game

```powershell
python -m photo3d D:\anh\meo --rig --faces 4000 --texture 512 --jpeg -o packages\client\public\assets\models\pal-leafkit.glb
```

- `--rig` tự tìm các phần của vật từ khối đã dựng:
  - **4 chân** (thú): xương `leg_fl`, `leg_fr`, `leg_bl`, `leg_br`;
  - **2 chân** (người, thú đứng thẳng): `leg_l`, `leg_r`, thêm `arm_l`, `arm_r` nếu tay giang ra hai bên;
  - **không thấy chân** (bóng, cá, vật tròn): thân nhún nhảy khi đi;
  - luôn có `body`, thêm `head` và `tail` nếu thấy.
- Tên xương và tên animation giống hệt thú làm bằng Blender (`assets/blender/pals.py`). Vì vậy đặt tên file `pal-<id>.glb` là game dùng được ngay, không phải sửa code.
- Model cao 1 đơn vị, cùng cỡ với thú trong game (0,7–1,1). Mặt trước của vật (ảnh `truoc`) quay về hướng thú nhìn.
- Dung lượng: với `--faces 4000 --texture 512 --jpeg` mỗi file khoảng 0,3 MB (thú làm bằng Blender: 0,13–0,17 MB). Để mặc định (20000 tam giác, texture PNG lớn) thì 1,5–2,7 MB, quá nặng cho điện thoại.
- Thêm `--symmetric` nếu con vật đối xứng trái/phải.
- Trên trang web (mục 2): chọn **Thú trong game**, dựng xong chọn loài rồi bấm **Đưa vào game**. Trang ghi đè `pal-<id>.glb` của loài đó; lấy lại model cũ bằng `git checkout -- packages/client/public/assets/models/pal-<id>.glb`.
- Xem thử: `npm run dev` rồi mở http://localhost:5173/model-viewer.html?only=leafkit (bấm `walk`, `attack`...).
- Loài mới (không thay loài có sẵn) còn cần khai báo trong dữ liệu game (`packages/shared/src/data/`).

## 5. Chất lượng đo được

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

**Đường nối màu:** chênh lệch màu trung bình giữa hai bên đường nối giảm còn khoảng 40 % (ví dụ leafkit xoay trước đèn: 0,154 xuống 0,064; quả bóng trơn: 0,068 xuống 0,005). Tốn thêm khoảng 1,5 giây.

**Gắn xương:** thử trên 25 bộ ảnh thú và nhân vật (chụp xa, chụp gần, chụp từ trên, có ảnh chéo):
- 24 bộ nhận đúng loại: cả 19 bộ thú 4 chân đều đủ 4 chân, 3 bộ cá bóng không chân, 2 bộ hiệp sĩ 2 chân.
- Bộ sai: nhân vật ranger chụp gần từ trên cao. Hai chân dính nhau trong khối dựng nên nó chỉ nhún nhảy.
- Model chạy đúng 4 animation trong trình xem model của game (three.js), cạnh thú gốc.

Thời gian 2–3 giây một model; 3–7 giây khi có hiệu chỉnh máy ảnh. Để so sánh: khối thô (visual hull vuông) ban đầu sai khoảng 4,5 %.

## 6. Giới hạn hiện tại (và cách khắc phục sau)

- **Chỗ lõm không thấy được từ 4 phía** (lòng bát, khoang trong) bị lấp đầy: giới hạn của phương pháp dựng từ bóng.
- **Phần bị che phía sau** (đuôi sau thân, gai lưng) phải đoán độ dày: dùng giả định "mảnh và tròn"; thêm ảnh từ trên xuống sẽ chính xác hơn.
- **Đường nối màu** giữa các ảnh nếu ánh sáng mỗi ảnh khác nhau (đã tự cân bằng màu, nhưng chụp cùng ánh sáng vẫn tốt nhất).
- **Chụp gần, chụp từ trên:**
  - Chỉ tự đoán góc chụp khi biết tiêu cự (EXIF hoặc `--focal`); không có thì cho `--elevation` hoặc dùng `--elevation auto` (kém chắc chắn hơn).
  - Mặt trên của vật khi chụp từ trên xuống là phần khó nhất: có thể hơi phồng.
  - Chụp ngang từ xa vẫn cho kết quả tốt nhất.
- **Tròn hay vuông với 4 ảnh:** đoán nhờ màu và bóng sáng. Vật một màu trơn dưới ánh sáng đều (không có bóng) được coi là tròn; vật vuông kiểu đó cần `--shape box` hoặc thêm ảnh chéo.
- **Gắn xương (`--rig`):**
  - Chân chỉ được nhận khi trong ảnh trước có **khe hở giữa các chân** ở sát đất. Chân khép sát hoặc váy dài thì vật chỉ nhún nhảy khi đi.
  - Ảnh chụp quá gần từ trên cao có thể làm hỏng khối ở bàn chân. Khi đó một chân có xương nhưng đứng yên.
  - Tai, cánh, ngón tay không có xương riêng: chúng đi theo đầu hoặc thân.
  - Động tác là 4 động tác chung của thú trong game; muốn động tác riêng thì sửa trong Blender.
- **Trang web** chạy trên máy của bạn, không phải trên internet: điện thoại phải cùng mạng Wi-Fi. Ảnh HEIC của iPhone cần `pip install pillow-heif`, hoặc chọn Cài đặt > Camera > Định dạng > Tương thích nhất để máy chụp JPG.
- **Không có normal map:** khối dựng từ bóng vốn trơn, còn chi tiết nhỏ (lông, đường may, nếp nhăn) đã nằm sẵn trong màu ảnh, kèm cả bóng sáng thật. Một normal map đoán từ ảnh sẽ tạo nổi khối giả: bóng bị tính hai lần, trông bẩn hơn, và tốn thêm một texture trên điện thoại. Chỉ đáng làm khi có hình dạng chi tiết từ chế độ AI (lộ trình mục 2).

## 7. Lộ trình

1. ~~Dựng từ bóng + dán màu ảnh, xuất GLB, chạy trong Blender~~ (xong)
2. Chế độ AI (cần GPU NVIDIA hoặc chờ lâu trên CPU): dùng model mã nguồn mở **Hunyuan3D-2mv** (nhận đúng 4 ảnh trước/trái/sau/phải), **TripoSR** hoặc **TRELLIS** để có hình dạng chi tiết hơn, rồi dán màu bằng bước chiếu ảnh của photo3d. Cần tải model từ Hugging Face.
3. ~~Ảnh điện thoại chụp gần/từ trên (EXIF), ảnh chéo 45°, tự chọn khối tròn hay vuông~~ (xong)
4. ~~Texture liền mạch (hoà màu ở đường nối)~~ (xong). Normal map: để sau, khi có chế độ AI (lý do ở phần Giới hạn).
5. ~~Tự gắn xương và animation đứng/đi/tấn công/bị đánh như thú trong game~~ (xong). Còn lại: dọn lưới (retopology) bằng Blender.
6. ~~Trang web: kéo thả ảnh, xem trước 3D có động tác, tải về, đưa vào game; dùng được từ điện thoại cùng Wi-Fi~~ (xong: `npm run photo3d:web`)

## Cho lập trình viên

- Mã nguồn trong `photo3d/`, lõi chỉ cần numpy nên chạy được trong Python của Blender:
  - `images.py`: đọc ảnh và EXIF, tách nền, căn chỉnh ban đầu.
  - `cameras.py`: máy ảnh (hướng, góc chúc, phối cảnh).
  - `calibrate.py`: hiệu chỉnh máy ảnh theo độ khớp đường viền.
  - `carve.py`: khắc khối.
  - `prior.py`: đoán tròn hay vuông.
  - `mesh.py`: lưới tam giác.
  - `texture.py`: dán màu, hoà màu ở đường nối.
  - `rig.py`: tìm chân, đầu, đuôi, tay; trọng số da; animation.
  - `export.py`: xuất GLB/OBJ.
  - `pipeline.py`: ghép tất cả lại.
  - `web.py` và `web/`: trang web (chỉ dùng thư viện chuẩn của Python; three.js lấy từ `node_modules` của game, không có thì lấy từ CDN).
- Test: `cd tools/photo3d && python -m pytest`
- Tạo bộ ảnh thử từ model có sẵn: `blender --background --python tools/photo3d/samples/render_views.py -- --model model.glb --out thu_muc`
  - Ảnh chéo: thêm `--views front,right,back,left,front_right,back_right,back_left,front_left`.
  - Kiểu điện thoại: thêm `--perspective 2.5 --elevation 20`.
  - Kèm theo là `camera.json`, máy ảnh thật của từng ảnh.
- Đo chất lượng: `python tools/photo3d/samples/benchmark.py thu_muc_chua_cac_bo_anh [--top] [--diagonal] [--focal 0]`
