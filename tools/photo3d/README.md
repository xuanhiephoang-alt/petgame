# photo3d: tạo model 3D từ ảnh chụp

Chụp một vật từ **trước, phải, sau, trái** (thêm 4 ảnh **chéo 45°** và ảnh **từ trên xuống** nếu có), công cụ dựng ra model 3D **có màu thật từ ảnh**, xuất `.glb` (dùng được trong Blender, web, game 3D) hoặc `.obj`. Thêm `--rig` để model **có xương và 4 động tác** (đứng, đi, tấn công, bị đánh). Game PetGame là 2D: muốn đưa thú vào game thì làm **hình 2D** từ ảnh (mục 4, `npm run sprite`). Chạy trên máy thường, không cần GPU, mỗi model từ vài giây (ảnh nhỏ) đến khoảng 20 giây (ảnh điện thoại lớn). Muốn **hình dạng chi tiết hơn** thì dùng chế độ AI (mục 5): Hunyuan3D-2mv chạy trên máy có GPU NVIDIA, hoặc hình 3D làm bằng bất kỳ công cụ AI nào. Chỉ có **một ảnh** cũng được (mục 6): một ảnh ghép nhiều góc của vật, hoặc một ảnh duy nhất để AI đoán các mặt còn lại.

```
ảnh 4–9 phía ─► tách nền ─► căn chỉnh ─► hiệu chỉnh máy ảnh (chụp gần, chụp từ trên)
             ─► khắc khối từ bóng (tự chọn tròn hay vuông) hoặc hình từ AI ─► lưới tam giác, làm mịn
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

**Ảnh "phải"** là ảnh chụp *sườn phải của vật* (đứng bên phải vật nhìn vào: đầu vật quay về phía tay phải của bạn). **Ảnh "trái"** ngược lại. Lỡ đặt ngược hai ảnh này thì photo3d thường tự nhận ra và đổi lại (có cảnh báo): đầu ảnh bên giống ảnh trước là đầu phía trước của vật.

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

Mọi lệnh `npm.cmd run ...` phải chạy **trong thư mục gốc của game**, tức thư mục có file `package.json` cùng các thư mục `packages`, `tools`, `scripts`.
- Cách mở PowerShell đúng chỗ: mở thư mục game trong File Explorer, bấm vào thanh địa chỉ, gõ `powershell` rồi Enter.
- Báo lỗi `Could not read package.json` nghĩa là đang đứng sai thư mục.

**Cách dễ nhất: trang web.** Bấm đúp file `photo3d-web.cmd` trong thư mục game (giữ cửa sổ đen mở trong lúc dùng). Hoặc chạy:
```powershell
npm.cmd run photo3d:web
```
Trình duyệt tự mở http://localhost:8765. Trên trang:
1. Kéo thả ảnh vào 9 ô, hoặc kéo cả thư mục ảnh vào: ảnh tên `truoc`, `phai`... tự vào đúng ô. Kéo ảnh từ ô này sang ô khác để đổi chỗ. Chỉ có một ảnh (ảnh ghép nhiều góc, hoặc một ảnh duy nhất): chọn **Một ảnh** (mục 6).
2. Chọn dùng để làm gì: **Thú trong game** (có xương, file nhẹ), **Đồ vật trong game** hoặc **Chất lượng cao**.
3. Bấm **Dựng model 3D**: thanh tiến trình cho biết đang làm bước nào.
4. Xoay model bằng chuột hoặc ngón tay. Bấm **Đứng, Đi, Tấn công, Bị đánh** để xem động tác, **Lưới** để xem khung tam giác.
5. Bấm **Tải model (.glb)**. Muốn đưa con thú vào game (game là 2D): dùng chế độ **Một ảnh** rồi **Đưa vào game** (xem mục 4).

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
| `--ai hunyuan` | hình dạng do Hunyuan3D-2mv tạo trên máy này (mục 5) |
| `--ai D:\hinh.glb` | hình dạng lấy từ file `.glb`, `.obj` hoặc `.stl` làm bằng công cụ AI khác (mục 5) |
| `--ai-steps 50` | số bước của Hunyuan3D-2mv (mặc định 30; nhiều hơn thì lâu hơn, mịn hơn) |
| `--no-clip` | giữ cả phần hình AI nhô ra ngoài đường viền các ảnh (mặc định: cắt bỏ) |
| `--layout map` / `turn` | thứ tự các góc trong ảnh ghép: bản đồ 3 × 3 hoặc lần lượt quanh vật (mục 6; mặc định tự chọn) |
| `--grid 3x3` | số hàng × số cột của ảnh ghép khi không tự tìm ra các ô; `1x1` = một ảnh duy nhất (mục 6) |
| `--view front_right` | phía mà một ảnh duy nhất chụp (mặc định `front`, mục 6) |

## 4. Đưa con thú vào game (hình 2D)

Game là **2D**: mỗi loài thú là một hàng hình nhìn từ trước, bên, sau. photo3d làm hàng hình đó thẳng từ ảnh, không cần dựng model 3D:

```powershell
npm.cmd run sprite -- D:\anh\emberpup.png --pal emberpup
```

- Ảnh vào: một ảnh ghép các góc (ví dụ ảnh AI vẽ 4 góc: trước, bên trái, sau, bên phải), một thư mục ảnh `truoc/phai/sau/trai`, hoặc một ảnh duy nhất (khi đó thú dùng một hình cho mọi hướng).
- Công cụ tách nền, khử viền màu nền ở mép, đặt mọi góc cùng tỉ lệ, chân chạm đáy ô, rồi ghi `packages/client/public/assets/pals/<id>.webp` và khai báo trong `index.json` cùng thư mục.
- Ảnh AI vẽ trên nền trơn: tách theo màu nền (giữ lỗ thủng thật giữa chân, trong đuôi cuộn; lấp chỗ trên mình thú chỉ tình cờ trùng màu nền), xoá đường kẻ mặt đất và bóng dưới chân, mép mượt không còn viền màu nền.
- Hai góc nghiêng bị đổi chỗ thì đổi lại; AI vẽ hai góc nghiêng cùng quay một phía thì lật một góc (nhận hướng theo mắt, màu và hình dáng); một góc nghiêng thẳng, một góc chéo 3/4 thì bỏ góc chéo (game lật góc kia). Có phần thòng xuống dưới chân (đuôi nhìn từ sau) thì vẫn đặt chân đúng chỗ (`feet` trong `index.json`).
- `--player 0` đến `4`: làm nhân vật người chơi của slot đó (`assets/players/player<slot>.webp`).
- `--objects Tree_1_A,Rock_3_E+Rock_1_E,-,... --sheet trees`: một ảnh vẽ nhiều vật (cây, đá, bụi, rương...), cắt từng vật theo thứ tự đọc thành một tấm ảnh gộp `assets/nature/trees.webp` (tên và cách đặt tên: `docs/art-style.md`). Chỉ một tên thì cả ảnh là một vật (núi lửa có đá quanh chân); `--object-height 720` cho vật lớn nét hơn (mặc định 384 px). Bóng mờ AI vẽ dưới chân vật được xoá.
- Không có `--pal`/`--player`/`--sheet`: chỉ lưu `<tên ảnh>-sprite.png` (hoặc `-objects.png`) để xem trước. `--sprite-height 256`: chiều cao mỗi ô.
- Trên trang web (mục 2): chọn **Một ảnh**, thả ảnh vào, chọn loài ở mục **Hình 2D cho game** rồi bấm **Đưa vào game**. Trang cho xem trước hình đã tách.
- Bỏ hình đó: xoá file ảnh và dòng của loài trong `index.json` (game quay về hình vẽ sẵn).
- Xem thử: `npm run dev` rồi mở http://localhost:5173/sprites.html, hoặc vào game.
- Câu lệnh mẫu để AI vẽ ảnh 4 góc cho từng loài: `docs/art-style.md` và `docs/design/pals.md`.

Model 3D (`.glb`) vẫn làm được như các mục khác, để dùng trong Blender, web hay game 3D khác. `--rig` gắn xương và 4 animation (`idle`, `walk`, `attack`, `hurt`): **4 chân** (`leg_fl`, `leg_fr`, `leg_bl`, `leg_br`), **2 chân** (`leg_l`, `leg_r`, thêm `arm_l`, `arm_r` nếu tay giang ra), **không chân** (thân nhún nhảy); luôn có `body`, thêm `head` và `tail` nếu thấy.

## 5. Chế độ AI: hình dạng chi tiết hơn

Dựng từ bóng không thấy được chỗ lõm và phải đoán độ dày phần bị che. Chế độ AI để một model AI tạo hình dạng 3D từ chính các ảnh của bạn. Sau đó photo3d:
- tự dựng đứng, xoay, co giãn hình cho khớp ảnh (thử cả 6 trục đứng, mọi góc xoay, cả hình soi gương);
- cắt bỏ phần AI tự bịa nhô ra ngoài đường viền các ảnh;
- dán màu từ ảnh thật, rồi gắn xương như thường.

Có hai cách lấy hình AI.

**Cách 1: Hunyuan3D-2mv chạy ngay trên máy bạn.** Đây là model mã nguồn mở của Tencent, nhận đúng 4 ảnh trước, trái, sau, phải.
- Cần:
  - GPU NVIDIA có từ 6 GB bộ nhớ. Không có thì AI chạy bằng CPU, 20–40 phút một model.
  - RAM 16 GB.
  - Python 3.10 đến 3.13, nên dùng 3.12. Bản 3.14 mới nhất trên python.org chưa chạy được. Bản cài Windows của 3.12: [python-3.12.10](https://www.python.org/downloads/release/python-31210/), chọn "Windows installer (64-bit)", khi cài tích "Add python.exe to PATH".
  - Khoảng 20 GB ổ đĩa trống, có mạng ở lần đầu (tải tổng cộng khoảng 8 GB).
- Cài một lần: bấm đúp file `photo3d-ai-setup.cmd` trong thư mục game, hoặc mở PowerShell trong thư mục game rồi chạy:
  ```powershell
  npm.cmd run photo3d:ai-setup
  ```
  Lệnh này:
  - tạo môi trường Python riêng `tools/photo3d/.venv-ai`;
  - cài PyTorch và torchvision (bản CUDA khi thấy GPU NVIDIA), cùng `hy3dgen`;
  - tải đúng 2 file model cần dùng về thư mục `C:\Users\<tên>\.cache\huggingface`;
  - chạy thử: nạp model lên GPU và dựng nhanh một hình thử.

  Thấy dòng "Xong, AI đã sẵn sàng" là dùng được. Sau đó `npm run photo3d` và `npm run photo3d:web` tự dùng môi trường này. Chạy lại lệnh cài thì nhanh (phần đã cài, đã tải được giữ lại) và nó kiểm tra lại từ đầu.
- Nếu lỗi, mấy dòng cuối nói nguyên nhân và cách sửa:
  - Có GPU NVIDIA nhưng PyTorch không dùng được: cập nhật driver NVIDIA rồi chạy lại. Lệnh cài tự đổi PyTorch bản CPU sang bản GPU.
  - Windows thiếu Microsoft Visual C++ Redistributable: cài [vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe) rồi chạy lại.
  - Card không đủ bộ nhớ, hoặc máy thiếu RAM: đóng bớt chương trình nặng rồi chạy lại.
  - Không tải được model: kiểm tra mạng rồi chạy lại, phần đã tải được giữ lại.
  - Thông báo có chữ "Long Path": chuyển thư mục game ra chỗ có đường dẫn ngắn, ví dụ `D:\petgame`.
- Dùng: trên trang web chọn **Hình dạng: AI trên máy này**. Hoặc dòng lệnh:
  ```powershell
  npm.cmd run photo3d -- D:\anh\meo --ai hunyuan --rig --faces 4000 --texture 512 --jpeg
  ```
- Hunyuan3D-2mv học từ ảnh chụp ngang tầm, nền đã tách. Chụp ngang tầm vật cho kết quả tốt nhất.

**Cách 2: hình 3D làm bằng bất kỳ công cụ AI nào.** Ví dụ trang demo Hunyuan3D trên Hugging Face, Tripo, Meshy, TRELLIS, TripoSR. Tải hình về dạng `.glb` (không nén Draco), `.obj` hoặc `.stl`, rồi:
- trên trang web: chọn **Hình 3D làm sẵn bằng công cụ AI** và thả file vào;
- hoặc dòng lệnh: `--ai D:\hinh.glb`.

Màu của file AI bị bỏ qua; màu luôn lấy từ ảnh thật của bạn.

**Đọc kết quả:** dòng "đường viền khớp ảnh" (trên trang web và trong nhật ký) cho biết hình AI khớp ảnh đến đâu.
- Từ 95 % trở lên là tốt.
- Dưới 88 % thì có cảnh báo. Hãy kiểm tra ảnh đã đúng ô chưa, hoặc so với model dựng từ đường viền (không dùng AI).

**Giấy phép Hunyuan3D-2:** dùng Tencent Hunyuan 3D 2.0 Community License.
- Không được dùng ở **Liên minh châu Âu, Anh và Hàn Quốc**, kể cả model nó tạo ra. Vì vậy đừng đưa model do Hunyuan3D tạo vào bản game phát hành ở các nơi đó.
- Dùng thương mại được khi sản phẩm dưới 1 triệu người dùng mỗi tháng.
- Muốn tránh các điều kiện này thì dùng cách 2 với model có giấy phép MIT, như TRELLIS hoặc TripoSR.

## 6. Chỉ có một ảnh

Trên trang web chọn **Một ảnh** rồi thả ảnh vào: trang hiện tên từng góc photo3d tìm thấy ngay trên ảnh. Dòng lệnh: đưa đường dẫn ảnh thay cho thư mục.
```powershell
npm.cmd run photo3d -- D:\anh\meo.png --rig
```
photo3d tự nhận biết: thấy nhiều vật tách rời trên nền trơn là **ảnh ghép nhiều góc**, thấy một vật là **ảnh duy nhất**.

**Ảnh ghép nhiều góc** (tự ghép, hoặc AI vẽ): photo3d tách từng góc ra rồi dựng như khi có từng ảnh riêng.
- 3 × 3, kiểu **bản đồ**, giống 9 ô ảnh trên trang web. Mỗi góc nằm ở ô đúng chỗ máy ảnh đứng, nhìn từ trên xuống, mặt trước của vật hướng lên trên. Ô giữa là ảnh từ trên xuống, mặt trước của vật ở phía trên ảnh.
  ```
  trước-trái | trước | trước-phải
  trái       | trên  | phải
  sau-trái   | sau   | sau-phải
  ```
- Các kiểu khác xếp **lần lượt quanh vật**: đọc từ trái sang phải, trên xuống dưới, bắt đầu từ mặt trước.
  - 4 góc (1 × 4 hoặc 2 × 2): trước, phải, sau, trái; thêm ảnh trên thành 5.
  - 8 góc (2 × 4): trước, trước-phải, phải, sau-phải, sau, sau-trái, trái, trước-trái; thêm ảnh trên thành 9. Ảnh trên để mặt trước của vật ở phía dưới ảnh.
- Mặc định 3 × 3 là kiểu bản đồ, các lưới khác là kiểu lần lượt. Ép kiểu xếp bằng `--layout map` hoặc `--layout turn`. Ô để trống được bỏ qua.
- Ảnh mỗi ô một nền khác nhau thì photo3d có thể không tự tìm ra các ô: cho số ô bằng `--grid 3x3`, ảnh được chia đều.
- Nên dùng nền trơn một màu, các góc cùng cỡ, không chạm nhau. Đường kẻ ô, khung và chữ chú thích nhỏ được tự bỏ đi.
- AI vẽ ảnh hay đặt hai góc bên ngược chiều, ví dụ trước, **trái**, sau, **phải**. photo3d tự nhận ra nhờ màu và đổi lại: đầu nào của ảnh bên giống ảnh trước (mặt, ngực) thì đó là phía trước, đầu giống ảnh sau (lưng, đuôi) là phía sau.

**Một ảnh duy nhất:** ảnh được coi là chụp mặt trước; ảnh chụp chéo thì cho biết phía bằng `--view front_right` (trên trang web: ô "Ảnh chụp từ phía"). Các mặt còn lại phải đoán.
- **Hình dạng:**
  - Có AI (`--ai hunyuan`, cài như mục 5): Hunyuan3D-2mv dựng hình từ ảnh; chiều sâu lấy theo tỉ lệ của hình AI. Hình 3D làm bằng công cụ AI khác cũng dùng được (`--ai D:\hinh.glb`).
  - Không có AI: đường viền được **thổi phồng** thành khối tròn, mỗi phần dày bằng bề ngang của nó, nên chân và đuôi thành ống tròn. Nhanh, nhưng chỉ hợp với vật tròn trịa như thú bông, gối, quả bóng.
- **Màu:** phần ảnh thấy rõ lấy màu thật. Phần khuất (lưng, hai bên) được tô bằng màu **lan mượt từ phần nhìn thấy**, chứ không in xuyên mặt trước ra sau lưng. Vì vậy ở đó không có chi tiết thật (hoa văn sau lưng, mắt nhìn từ bên).
- Chỉ có 1 ảnh mà muốn mặt sau có màu và chi tiết: nhờ một AI vẽ ảnh (ChatGPT, Gemini...) vẽ thêm các góc thành ảnh ghép, rồi dùng cách ảnh ghép ở trên (thứ tự lần lượt). Gửi ảnh kèm câu lệnh (trang web có nút chép):
  ```
  Draw a turnaround sheet of exactly this object (same shape, colors and details): 4 views in one row on a plain white background, left to right: front view, right side view (facing right), back view, left side view (facing left). Same size and scale in every view, camera at the object's mid height, no perspective, no shadows, no text, views not touching.
  ```
  Các góc AI vẽ chưa chắc khớp tỉ lệ với nhau: xem dòng "các ảnh khớp nhau" sau khi dựng. Thêm `--ai hunyuan` thì model ít phụ thuộc vào độ khớp đó hơn.

## 7. Chất lượng đo được

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

**Chế độ AI** (đo trên 7 bộ ảnh; model AI thật không chạy được trong môi trường phát triển nên dùng hình chuẩn thay cho hình AI, xoay và co giãn ngẫu nhiên như file AI xuất ra):
- Tìm lại đúng tư thế: lệch trung bình 0,1 % chiều cao với thú có chân, dưới 1,5 % với vật tròn hay hộp; mất khoảng 3 giây.

| Hình dạng | Sai số | F-score |
|---|---|---|
| Dựng từ đường viền (không AI) | 2,32 % | 0,68 |
| Hình AI đúng hoàn toàn | 1,50 % | 0,84 |
| Hình AI sai lệch đến 4 % chiều cao, có cắt theo đường viền | 2,44 % | 0,58 |
| Như trên, không cắt (`--no-clip`) | 2,70 % | 0,51 |

Hình đúng hoàn toàn chạm mức tốt nhất mà phép đo này cho phép, vì model gốc có các mặt chồng bên trong. Vậy chế độ AI tốt hơn rõ khi AI tạo hình sát với vật thật; nếu AI sai nhiều thì nên so với cách dựng từ đường viền.

Thời gian 2–3 giây một model; 3–7 giây khi có hiệu chỉnh máy ảnh. Để so sánh: khối thô (visual hull vuông) ban đầu sai khoảng 4,5 %.

**Một ảnh** (đo bằng ảnh vẽ từ thú mẫu):
- Ảnh ghép 3 × 3 có đường kẻ ô và chữ chú thích: các góc tách ra khớp nhau 99 %, như 9 ảnh riêng; đường viền mỗi góc lệch dưới 2 % số điểm ảnh so với ảnh gốc.
- Một ảnh mặt trước cùng hình AI đúng (thay cho Hunyuan3D): hình được dựng đúng chiều, đường viền khớp 92 %, chiều sâu lệch khoảng 5 %.
- Một ảnh, không AI: khoảng 1 giây một model.

## 8. Giới hạn hiện tại (và cách khắc phục sau)

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
- **Chế độ AI:**
  - Phần không ảnh nào thấy (dưới bụng, kẽ chân) là AI đoán, và màu ở đó vẫn bị kéo giãn từ ảnh gần nhất.
  - Hình AI được ghép với ảnh qua lưới khối (128 ô theo chiều dài nhất, `--res` để tăng), nên chi tiết nhỏ hơn khoảng 1 % chiều cao bị làm mịn.
  - Phần chạy Hunyuan3D-2mv viết theo mã nguồn thư viện `hy3dgen` 2.0.2. Lần chạy thật đầu tiên sẽ trên máy bạn.
- **Một ảnh:**
  - Mặt khuất chỉ có màu lan từ phần nhìn thấy, không có chi tiết thật.
  - Khối thổi phồng (không AI) luôn tròn trịa: vật dẹt, vuông hay dài theo chiều sâu đều ra sai.
  - Hunyuan3D-2mv đoán từ một ảnh kém chính xác hơn từ 4 ảnh.
  - Ảnh ghép do AI vẽ thường lệch tỉ lệ giữa các góc.
- **Tự đổi ảnh trái/phải** chỉ chạy được khi mặt trước và mặt sau của vật trông khác nhau. Vật trước sau như nhau thì phải tự đặt đúng ảnh.
- **Khối ma:** tai chìa ra trong ảnh trước và đuôi chìa ra trong ảnh bên có thể tạo khối thừa mà không ảnh nào xoá được. Mảnh rời nhỏ hơn 5 % thân chính được tự bỏ đi; khối ma dính liền vào thân thì vẫn còn (chế độ AI không bị).
- **Không có normal map:** khối dựng từ bóng vốn trơn, còn chi tiết nhỏ (lông, đường may, nếp nhăn) đã nằm sẵn trong màu ảnh, kèm cả bóng sáng thật. Một normal map đoán từ ảnh sẽ tạo nổi khối giả: bóng bị tính hai lần, trông bẩn hơn, và tốn thêm một texture trên điện thoại. Hình từ chế độ AI cũng được làm mịn khi ghép với ảnh, nên normal map vẫn để sau.

## 9. Lộ trình

1. ~~Dựng từ bóng + dán màu ảnh, xuất GLB, chạy trong Blender~~ (xong)
2. ~~Chế độ AI: Hunyuan3D-2mv trên máy có GPU, hoặc hình từ công cụ AI bất kỳ; tự căn cho khớp ảnh, dán màu từ ảnh thật~~ (xong, mục 5). Còn lại: chạy TRELLIS (giấy phép MIT) ngay trong photo3d.
3. ~~Ảnh điện thoại chụp gần/từ trên (EXIF), ảnh chéo 45°, tự chọn khối tròn hay vuông~~ (xong)
4. ~~Texture liền mạch (hoà màu ở đường nối)~~ (xong). Normal map: để sau, khi có chế độ AI (lý do ở phần Giới hạn).
5. ~~Tự gắn xương và animation đứng/đi/tấn công/bị đánh như thú trong game~~ (xong). Còn lại: dọn lưới (retopology) bằng Blender.
6. ~~Trang web: kéo thả ảnh, xem trước 3D có động tác, tải về, đưa vào game; dùng được từ điện thoại cùng Wi-Fi~~ (xong: `npm run photo3d:web`)
7. ~~Một ảnh: ảnh ghép nhiều góc, hoặc một ảnh duy nhất (AI hoặc thổi phồng, tô màu mặt khuất)~~ (xong, mục 6). Còn lại: AI vẽ màu thật cho mặt khuất (như Hunyuan3D-Paint).

## Cho lập trình viên

- Mã nguồn trong `photo3d/`, lõi chỉ cần numpy nên chạy được trong Python của Blender:
  - `images.py`: đọc ảnh và EXIF, tách nền, căn chỉnh ban đầu.
  - `sheet.py`: tách ảnh ghép nhiều góc thành từng ảnh.
  - `cameras.py`: máy ảnh (hướng, góc chúc, phối cảnh).
  - `calibrate.py`: hiệu chỉnh máy ảnh theo độ khớp đường viền.
  - `carve.py`: khắc khối; thổi phồng một ảnh (`inflate`).
  - `prior.py`: đoán tròn hay vuông.
  - `mesh.py`: lưới tam giác.
  - `texture.py`: dán màu, hoà màu ở đường nối, tô màu mặt khuất khi chỉ có một ảnh (`fill_views`).
  - `rig.py`: tìm chân, đầu, đuôi, tay; trọng số da; animation.
  - `export.py`: xuất GLB/OBJ.
  - `meshio.py`: đọc hình 3D `.obj`, `.glb`, `.stl` của công cụ khác.
  - `ai.py`: chế độ AI: chạy Hunyuan3D-2mv (kiểm tra cài đặt: `python -m photo3d --ai-check`), xoay và căn hình cho khớp ảnh, chuyển thành lưới khối.
  - `pipeline.py`: ghép tất cả lại.
  - `web.py` và `web/`: trang web (chỉ dùng thư viện chuẩn của Python; three.js lấy từ `node_modules` của game, không có thì lấy từ CDN).
- Test: `cd tools/photo3d && python -m pytest`
- Tạo bộ ảnh thử từ model có sẵn: `blender --background --python tools/photo3d/samples/render_views.py -- --model model.glb --out thu_muc`
  - Ảnh chéo: thêm `--views front,right,back,left,front_right,back_right,back_left,front_left`.
  - Kiểu điện thoại: thêm `--perspective 2.5 --elevation 20`.
  - Kèm theo là `camera.json`, máy ảnh thật của từng ảnh.
- Đo chất lượng: `python tools/photo3d/samples/benchmark.py thu_muc_chua_cac_bo_anh [--top] [--diagonal] [--focal 0]`
