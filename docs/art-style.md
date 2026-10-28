# Phong cách đồ họa 2D

> **Chuẩn hiện tại: hoạt hình 2D viền mảnh**, giống ảnh thú do AI vẽ (xem `packages/client/public/assets/pals/`). Mọi hình mới, vẽ bằng code hay bằng AI, phải hợp với nó.

- **Góc nhìn:** từ trên xuống. Mặt đất nhìn thẳng từ trên; cây, người, thú đứng thẳng (nhìn từ trước hơi chếch), sắp xếp trước sau theo chân (y).
- **Nét vẽ:** viền mảnh màu đậm cùng tông với màu tô (không dùng đen), tô 2 tông: phần sáng ở trên bên trái, phần tối ở dưới bên phải, thêm một mảng sáng nhỏ. Ánh sáng luôn từ trên bên trái.
- **Cảm giác:** dễ thương, tươi sáng; thú tròn trịa, đầu to, mắt to bóng (tròng màu, hai đốm sáng), chân ngắn, má hồng nhạt; màu bão hòa vừa phải.
- **Tỉ lệ (pixel của server = pixel thế giới):** người chơi cao ~56 (búp bê giấy: 200 đơn vị từ cổ tới chân, 0,13 px mỗi đơn vị); thú 37–62 tùy `size` trong `pals.json` (`palHeight` = size × 3,1); boss gấp 2,4; cây 100–130; bụi 30; rương 26.
- **Hướng:** mỗi loài có 3 hình: trước (đi xuống màn hình), sau (đi lên), bên (đi sang phải; sang trái là hình bên lật lại). Ảnh PNG có thể có đủ 4 hướng.
- **Chuyển động:** không vẽ từng khung hình. Thú nhún nhảy, phồng xẹp, lao tới khi đánh, rung khi bị đánh; người chơi lắc lư khi đi, đầu gật theo bước chậm hơn thân một nhịp, vung vũ khí cận chiến hoặc giơ cung, ná, gậy phép ra ngắm khi đánh. Cây, bụi lay theo gió.
- **Mặt đất:** màu theo vùng hòa vào nhau, bãi cát quanh biển và hồ, cỏ, hoa, sỏi vẽ thẳng vào nền (không tốn gì khi chơi), bóng mềm dưới cây/đá.
- **Nước:** dải màu nông/sâu rõ ràng kiểu hoạt hình, viền bọt trắng ở bờ, sóng lăn vào, vài đốm lấp lánh.
- **Ngày đêm:** ban đêm tối xanh, sáng quanh đèn lồng người chơi, lửa trại, dung nham, đèn trại, rương; hoàng hôn ấm màu cam.

## Hình bằng AI vẽ ảnh

Thú, người chơi, cây cối, đồ vật và vật trang trí của cả 6 vùng là ảnh do AI vẽ (13 loài thú; người chơi ghép từ 8 kiểu tóc, 8 bộ quần áo, 8 mũ, 8 vũ khí; 14 tấm cây cối, đồ vật, núi lửa và vật trang trí; ảnh gốc ở file Figma "PetGame AI art" của chủ dự án). Công cụ `npm run sprite` cắt ảnh thành hình trong game. Còn vẽ bằng code: mặt đất, nước, trại, hiệu ứng (khói núi lửa, ánh sáng ban đêm).

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

**Người chơi (búp bê giấy):** mỗi nhà thám hiểm ghép từ một cái đầu (mặt và kiểu tóc), một thân (bộ quần áo), một mũ và một vũ khí, đổi tự do trong game (`art/doll.ts`, `public/assets/characters/`). Màu tóc và màu da đổi được nhờ mặt nạ màu: AI vẽ tóc **tím** và da **hồng đào nhạt**, công cụ tìm hai màu đó và ghi kèm mỗi ảnh một mặt nạ (đỏ: da, xanh lá: tóc). Ảnh ghép 4 góc như thú, mỗi kiểu một ảnh:

- Kiểu tóc: cùng một bộ quần áo đơn giản để công cụ cắt lấy cái đầu ở cổ.

  ```
  Character turnaround sheet of one cute chibi kid for a 2D game: <kiểu tóc, ví dụ: a high ponytail tied
  with a small red hair tie>, the hair is bright violet purple, light peach skin, big dark brown eyes, pink
  cheeks, wearing a plain white t-shirt, grey shorts and white sneakers. Exactly four views of the same kid
  in one row, same size, all standing on the same ground line: front view, left side view (facing left),
  back view, right side view (facing right). Clean cartoon illustration, thin dark colored outline, soft
  two-tone cel shading, big glossy eyes, cute proportions with a big head and short legs, arms relaxed at
  the sides. Plain flat solid medium sage green background, no text, no labels, no ground shadow, nothing
  else in the image.
  ```

  Rồi `npm run sprite -- anh.png --head <id>` (id là tên trong `HAIR_STYLES`, `packages/shared/src/wardrobe.ts`). Tóc dài thòng qua vai được giữ lại, phần sau lưng vẽ sau thân.
- Bộ quần áo: tóc ngắn gọn để không che cổ áo: `... very short neat dark brown hair, light peach skin, big dark brown eyes, pink cheeks, wearing <bộ đồ, ví dụ: a puffy red winter parka with white fur trim and the hood down, ...>. ... arms relaxed at the sides, empty hands. ...` Rồi `npm run sprite -- anh.png --outfit <id>`.
- Công cụ cắt ngang cổ (đường cổ áo dưới cằm), đưa mọi phần về cùng cỡ (cổ tới chân 200 px), tìm hai bàn tay (chỗ cầm vũ khí), giữ một góc nghiêng (`--side right|left`, game lật lại cho hướng kia).
- Mũ: `Game asset sheet for a cute cartoon 2D game: 4 different hats for a chibi kid character, with no heads and nobody wearing them. Each hat is drawn 3 times in one row: seen from the front, from the right side, and from the back. Row 1: <mũ 1>. Row 2: ... All twelve drawings at the same scale, each standing alone with clear gaps between them, ...`. Rồi `npm run sprite -- anh.png --objects hat_<tên>_front,hat_<tên>_right,hat_<tên>_back,... --sheet hats-a --to characters`. Cỡ mũ, chỗ vành mũ, phần tóc bị mũ che: `HATS` trong `art/doll.ts` (mũ đội trên tóc như vòng hoa, vương miện: `rests`).
- Vũ khí: `Game asset sheet for a cute cartoon 2D game: 8 handheld weapons for a chibi hero, each drawn alone standing upright with its handle at the bottom, seen from the side, in two rows of four. ... No glow, no sparkles, no light rays. ...`. Rồi `--objects weapon_club,weapon_sword,... --sheet weapons --to characters`. Độ dài, chỗ cầm, độ nghiêng: `WEAPONS` trong `art/doll.ts`.
- Món mới: thêm vào `packages/shared/src/data/wearables.json` (ô `outfit`/`hat`/`weapon`, có từ đầu, chế tạo, rương hay trùm, chống rét/nắng, giáp, chỉ số vũ khí; `art` khi dùng chung ảnh với món khác), và công thức ở `recipes.json` nếu chế tạo được. Xem mọi kiểu ở `sprites.html?show=players`.

**Cây cối, đá, bụi, đồ vật:** một ảnh vẽ nhiều vật tách rời nhau (một hàng, hoặc lưới 3×3 cho vật nhỏ), cùng phong cách: `Game asset sheet for a cute cartoon 2D game: <các vật> ... each standing alone with clear gaps between them, seen from the front and slightly above like in a cozy farming game ...`. Rồi `npm run sprite -- anh.png --objects <tên>,<tên>,... --sheet <tên tấm>`: tên theo thứ tự đọc (hàng trên xuống, trái sang phải), là tên model của `worldgen.ts` (`Tree_1_A`, `Rock_3_E`...), kiểu riêng của một vùng (`Tree_4_A@frost`, `Tree_1_A@swamp`), hoặc `Chest`, `Campfire`, `Raft`; `A+B` dùng một vật cho hai tên, `-` bỏ qua. Model không có ảnh riêng của vùng thì dùng ảnh thường tô lại màu vùng; model không có ảnh thì vẽ bằng code. Chiều cao trong game của từng model ở `HEIGHT` trong `art/nature.ts`. Kiểu riêng của vùng: `@frost` (núi tuyết), `@sand` (sa mạc), `@swamp` (đầm lầy), `@ash` (núi lửa), `@beach` (đảo). Các tấm đang dùng (`public/assets/nature/index.json`): `trees` (cây lá tròn), `pines`, `snowpines` (`@frost`), `swamp` (cây `@swamp`), `small` (cọ, xương rồng, bụi, đá), `props` (rương, lửa trại, bè), `volcano` (núi lửa), `volcanic` (đá bazan `Rock_*@ash`, miệng phun, obsidian, gốc cây cháy, vũng và vết nứt dung nham), `snowy` (đá phủ tuyết `Rock_*@frost`, bụi tuyết, đống tuyết, người tuyết, khúc gỗ và ao đóng băng), `desert` (đá sa thạch `Rock_*@sand`, cỏ lăn, xương rồng thùng, đầu lâu bò, phiến đá, cây chết, vò đất), `marsh` (bụi `Bush_*@swamp`, lau sậy, khúc gỗ và gốc cây phủ rêu, đá rêu, vũng bùn, lá súng, dương xỉ), `meadow` (hoa dại, hoa chuông, oải hương, hướng dương, cỏ ba lá, vòng nấm, gốc cây, khúc gỗ rỗng, biển chỉ đường), `beach` (đá biển `Rock_*@beach`, bụi nhiệt đới và dâm bụt `Bush_*@beach`, sỏi, dừa, vỏ sò, gỗ trôi dạt, lâu đài cát), `glowing` (pha lê băng, nấm tím).

Một ảnh chỉ một vật lớn (như núi lửa): đặt đúng một tên, cả ảnh thành một vật (`--objects Volcano --sheet volcano --object-height 720`; `--object-height` là chiều cao tối đa trong tấm ảnh gộp, mặc định 384 px). Vật trang trí không chặn đường, được rải ở client theo seed cố định: mỗi vùng có bảng `REGION_DECOR` trong `scenery.ts` (vật nào, bao nhiêu, ở đâu: đất trống, bãi cát sát biển, bờ ao, hay nổi trên mặt ao như lá súng), kích thước và độ đung đưa ở `DECOR` trong `art/nature.ts`. Vật phẳng (cỏ ba lá, vũng bùn, ao đóng băng, vỏ sò, vũng dung nham) vẽ thẳng vào mặt đất; bãi xuất phát chỉ có vật phẳng. Ban đêm phát sáng: dung nham, đá bazan, miệng phun, gốc cây cháy, pha lê băng, nấm tím (`GLOW` trong `scenery.ts`).

Vật phát sáng: AI hay vẽ thêm quầng sáng và lấp lánh quanh vật, cắt ra thành mảng nhạt bẩn trên mặt đất. Thêm `No glow, no light rays, no sparkles, no aura, no halo` vào câu lệnh, để game tự làm sáng ban đêm. Vật vẽ thành nhiều mảnh rời (vòng nấm, mấy hòn sỏi) được công cụ gộp lại cho đủ số tên.

**Chọn màu nền** thật khác màu vật (công cụ tách theo màu nền): thú xanh lá → `light blue-grey`; thú xanh dương, xám, đá → `pale peach`; thú trắng, tím nhạt, tóc bạc → `medium sage green`. **Người:** không dùng nền màu da (hồng nhạt, kem), vì công cụ sẽ coi mặt là nền.

Công cụ tự xử lý: tách nền trơn và giữ lỗ thủng thật (giữa chân, trong đuôi cuộn), xoá đường kẻ mặt đất và bóng AI hay vẽ dưới chân, đổi lại khi hai góc nghiêng bị đổi chỗ, lật lại khi AI vẽ hai góc nghiêng cùng quay một phía (nhìn theo mắt và màu), bỏ góc chéo 3/4 nếu góc kia là góc nghiêng thẳng, đặt điểm chân khi có phần thòng xuống dưới chân (đuôi nhìn từ sau, ghi `feet` trong `index.json`). Ảnh lưu dạng WebP (nhẹ bằng 1/5 PNG).

Không dùng tên, hình hay thiết kế của Pokémon, Palworld: xem kỹ ảnh AI vẽ, giống quá thì đổi mô tả rồi vẽ lại (ví dụ Scorchtail đổi từ thằn lằn đứng hai chân đuôi có lửa thành kỳ nhông bò bốn chân).

## Ngân sách hiệu năng (điện thoại)

- Mục tiêu 60 FPS trên iPhone đời 2020 trở lên.
- Mỗi khung hình ≤ 600 sprite (đo bằng `npm run shots`); mặt đất nướng sẵn theo mảng 512 px, nhớ tối đa 24 mảng.
- Hình vẽ bằng code được vẽ ở độ nét vừa đủ cho màn hình (`setArtScale`), ảnh thú cao 256 px mỗi ô, phần nhân vật 200 px từ cổ tới chân, cây cối và đồ vật tối đa 384 px. Người chơi đổi màu tóc, màu da một lần (lưu sẵn), không tốn gì mỗi khung hình.
