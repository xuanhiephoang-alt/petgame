# Phong cách đồ họa 2D

> **Chuẩn hiện tại: hoạt hình 2D viền mảnh**, giống ảnh thú do AI vẽ (xem `packages/client/public/assets/pals/`). Mọi hình mới, vẽ bằng code hay bằng AI, phải hợp với nó.

- **Góc nhìn:** từ trên xuống. Mặt đất nhìn thẳng từ trên; cây, người, thú đứng thẳng (nhìn từ trước hơi chếch), sắp xếp trước sau theo chân (y).
- **Nét vẽ:** viền mảnh màu đậm cùng tông với màu tô (không dùng đen), tô 2 tông: phần sáng ở trên bên trái, phần tối ở dưới bên phải, thêm một mảng sáng nhỏ. Ánh sáng luôn từ trên bên trái.
- **Cảm giác:** dễ thương, tươi sáng; thú tròn trịa, đầu to, mắt to bóng (tròng màu, hai đốm sáng), chân ngắn, má hồng nhạt; màu bão hòa vừa phải.
- **Tỉ lệ (pixel của server = pixel thế giới):** người chơi cao ~50; thú 37–62 tùy `size` trong `pals.json` (`palHeight` = size × 3,1); boss gấp 2,4; cây 100–130; bụi 30; rương 26.
- **Hướng:** mỗi loài có 3 hình: trước (đi xuống màn hình), sau (đi lên), bên (đi sang phải; sang trái là hình bên lật lại). Ảnh PNG có thể có đủ 4 hướng.
- **Chuyển động:** không vẽ từng khung hình. Thú nhún nhảy, phồng xẹp, lao tới khi đánh, rung khi bị đánh; người chơi đung đưa tay chân (ghép từ các mảnh). Cây, bụi lay theo gió.
- **Mặt đất:** màu theo vùng hòa vào nhau, bãi cát quanh biển và hồ, cỏ, hoa, sỏi vẽ thẳng vào nền (không tốn gì khi chơi), bóng mềm dưới cây/đá.
- **Nước:** dải màu nông/sâu rõ ràng kiểu hoạt hình, viền bọt trắng ở bờ, sóng lăn vào, vài đốm lấp lánh.
- **Ngày đêm:** ban đêm tối xanh, sáng quanh đèn lồng người chơi, lửa trại, dung nham, đèn trại, rương; hoàng hôn ấm màu cam.

## Hình bằng AI vẽ ảnh

Thú, người chơi, cây cối, đồ vật và vật trang trí của cả 6 vùng là ảnh do AI vẽ (13 loài thú, 5 người chơi, 14 tấm cây cối, đồ vật, núi lửa và vật trang trí; ảnh gốc ở file Figma "PetGame AI art" của chủ dự án). Công cụ `npm run sprite` cắt ảnh thành hình trong game. Còn vẽ bằng code: mặt đất, nước, trại, hiệu ứng (khói núi lửa, ánh sáng ban đêm).

**Thú** (ảnh ghép 4 góc; mô tả tiếng Anh từng loài ở `docs/design/pals.md`):

```
Character turnaround sheet of one cute chibi creature for a 2D game: <mô tả>, <màu mắt>.
Exactly four views of the same creature in one row, same size, all standing on the same ground line:
front view, left side view (facing left), back view, right side view (facing right). Clean cartoon
illustration, thin dark colored outline, soft two-tone cel shading, big glossy eyes, pink cheeks, cute
proportions with a big head and short legs. Plain flat solid <màu nền> background, no text, no labels,
no ground shadow, nothing else in the image.
```

Rồi `npm run sprite -- anh.png --pal <id>` (hoặc trang `npm run photo3d:web`, chế độ **Một ảnh**).

**Người chơi:** cùng câu lệnh, thay phần đầu bằng `one cute chibi kid explorer for a 2D game: <tóc, áo màu của slot, quần, giày, túi>` và thêm `arms relaxed at the sides`; màu áo theo slot (0 xanh da trời, 1 cam, 2 tím, 3 xanh lá, 4 đỏ). Rồi `npm run sprite -- anh.png --player <slot>`.

**Cây cối, đá, bụi, đồ vật:** một ảnh vẽ nhiều vật tách rời nhau (một hàng, hoặc lưới 3×3 cho vật nhỏ), cùng phong cách: `Game asset sheet for a cute cartoon 2D game: <các vật> ... each standing alone with clear gaps between them, seen from the front and slightly above like in a cozy farming game ...`. Rồi `npm run sprite -- anh.png --objects <tên>,<tên>,... --sheet <tên tấm>`: tên theo thứ tự đọc (hàng trên xuống, trái sang phải), là tên model của `worldgen.ts` (`Tree_1_A`, `Rock_3_E`...), kiểu riêng của một vùng (`Tree_4_A@frost`, `Tree_1_A@swamp`), hoặc `Chest`, `Campfire`, `Raft`; `A+B` dùng một vật cho hai tên, `-` bỏ qua. Model không có ảnh riêng của vùng thì dùng ảnh thường tô lại màu vùng; model không có ảnh thì vẽ bằng code. Chiều cao trong game của từng model ở `HEIGHT` trong `art/nature.ts`. Kiểu riêng của vùng: `@frost` (núi tuyết), `@sand` (sa mạc), `@swamp` (đầm lầy), `@ash` (núi lửa), `@beach` (đảo). Các tấm đang dùng (`public/assets/nature/index.json`): `trees` (cây lá tròn), `pines`, `snowpines` (`@frost`), `swamp` (cây `@swamp`), `small` (cọ, xương rồng, bụi, đá), `props` (rương, lửa trại, bè), `volcano` (núi lửa), `volcanic` (đá bazan `Rock_*@ash`, miệng phun, obsidian, gốc cây cháy, vũng và vết nứt dung nham), `snowy` (đá phủ tuyết `Rock_*@frost`, bụi tuyết, đống tuyết, người tuyết, khúc gỗ và ao đóng băng), `desert` (đá sa thạch `Rock_*@sand`, cỏ lăn, xương rồng thùng, đầu lâu bò, phiến đá, cây chết, vò đất), `marsh` (bụi `Bush_*@swamp`, lau sậy, khúc gỗ và gốc cây phủ rêu, đá rêu, vũng bùn, lá súng, dương xỉ), `meadow` (hoa dại, hoa chuông, oải hương, hướng dương, cỏ ba lá, vòng nấm, gốc cây, khúc gỗ rỗng, biển chỉ đường), `beach` (đá biển `Rock_*@beach`, bụi nhiệt đới và dâm bụt `Bush_*@beach`, sỏi, dừa, vỏ sò, gỗ trôi dạt, lâu đài cát), `glowing` (pha lê băng, nấm tím).

Một ảnh chỉ một vật lớn (như núi lửa): đặt đúng một tên, cả ảnh thành một vật (`--objects Volcano --sheet volcano --object-height 720`; `--object-height` là chiều cao tối đa trong tấm ảnh gộp, mặc định 384 px). Vật trang trí không chặn đường, được rải ở client theo seed cố định: mỗi vùng có bảng `REGION_DECOR` trong `scenery.ts` (vật nào, bao nhiêu, ở đâu: đất trống, bãi cát sát biển, bờ ao, hay nổi trên mặt ao như lá súng), kích thước và độ đung đưa ở `DECOR` trong `art/nature.ts`. Vật phẳng (cỏ ba lá, vũng bùn, ao đóng băng, vỏ sò, vũng dung nham) vẽ thẳng vào mặt đất; bãi xuất phát chỉ có vật phẳng. Ban đêm phát sáng: dung nham, đá bazan, miệng phun, gốc cây cháy, pha lê băng, nấm tím (`GLOW` trong `scenery.ts`).

Vật phát sáng: AI hay vẽ thêm quầng sáng và lấp lánh quanh vật, cắt ra thành mảng nhạt bẩn trên mặt đất. Thêm `No glow, no light rays, no sparkles, no aura, no halo` vào câu lệnh, để game tự làm sáng ban đêm. Vật vẽ thành nhiều mảnh rời (vòng nấm, mấy hòn sỏi) được công cụ gộp lại cho đủ số tên.

**Chọn màu nền** thật khác màu vật (công cụ tách theo màu nền): thú xanh lá → `light blue-grey`; thú xanh dương, xám, đá → `pale peach`; thú trắng, tím nhạt, tóc bạc → `medium sage green`. **Người:** không dùng nền màu da (hồng nhạt, kem), vì công cụ sẽ coi mặt là nền.

Công cụ tự xử lý: tách nền trơn và giữ lỗ thủng thật (giữa chân, trong đuôi cuộn), xoá đường kẻ mặt đất và bóng AI hay vẽ dưới chân, đổi lại khi hai góc nghiêng bị đổi chỗ, lật lại khi AI vẽ hai góc nghiêng cùng quay một phía (nhìn theo mắt và màu), bỏ góc chéo 3/4 nếu góc kia là góc nghiêng thẳng, đặt điểm chân khi có phần thòng xuống dưới chân (đuôi nhìn từ sau, ghi `feet` trong `index.json`). Ảnh lưu dạng WebP (nhẹ bằng 1/5 PNG).

Không dùng tên, hình hay thiết kế của Pokémon, Palworld: xem kỹ ảnh AI vẽ, giống quá thì đổi mô tả rồi vẽ lại (ví dụ Scorchtail đổi từ thằn lằn đứng hai chân đuôi có lửa thành kỳ nhông bò bốn chân).

## Ngân sách hiệu năng (điện thoại)

- Mục tiêu 60 FPS trên iPhone đời 2020 trở lên.
- Mỗi khung hình ≤ 600 sprite (đo bằng `npm run shots`); mặt đất nướng sẵn theo mảng 512 px, nhớ tối đa 24 mảng.
- Hình vẽ bằng code được vẽ ở độ nét vừa đủ cho màn hình (`setArtScale`), ảnh thú và người chơi cao 256 px mỗi ô, cây cối và đồ vật tối đa 384 px.
