# Danh sách thú (pal)

Chỉ số nằm ở `packages/shared/src/data/pals.json`. File này lưu mô tả ngoại hình để art-pipeline dựng model.
Model 3D hiện tại: dựng bằng Blender qua `assets/blender/pals.py` (`npm run models:build`) → `packages/client/public/assets/models/pal-<id>.glb` (xem ở http://localhost:5173/model-viewer.html).

| id | Tên | Hệ | Mô tả ngoại hình |
|---|---|---|---|
| leafkit | Leafkit | grass | Mèo con màu xanh lá, bụng xanh nhạt, tai là hai chiếc lá có gân, đuôi xoăn như dây leo kết thúc bằng một chiếc lá |
| emberpup | Emberpup | fire | Chó con màu cam đỏ, tai cụp màu đỏ sẫm, mõm kem, má hồng, chỏm lửa nhỏ trên trán, đuôi là ngọn lửa hai lớp phát sáng |
| bubbloon | Bubbloon | water | Bong bóng nước tròn lơ lửng, bụng xanh nhạt, đốm sáng trên đầu, giọt nước xoăn trên đỉnh, hai vây bên và đuôi cá |
| pebblet | Pebblet | earth | Tảng đá tròn có tay chân ngắn, các mảng đá sáng màu, mày rậm, rêu phủ đỉnh đầu với một mầm cây nhỏ, mắt hiền |
| voltmouse | Voltmouse | electric | Chuột vàng tai tròn lớn (lòng tai hồng), chỏm lông trắng dựng tĩnh điện, hai sọc nâu trên lưng, đuôi dài mảnh kết thúc bằng quả cầu điện xanh ngọc phát sáng. Không có má đỏ, không có đuôi hình tia sét (tránh giống thú của game khác) |
| ripplefin | Ripplefin | water | Cá sông mũm mĩm màu xanh ngọc, bụng trắng, đốm sáng hai bên, vây lưng nhọn, đi lạch bạch bằng hai vây chân, đuôi quạt. Sống quanh hồ, tự vệ khi bị đánh |
| mothlume | Mothlume | electric | Bướm đêm lông xù màu tím nhạt, cổ lông trắng, cánh có đốm phát sáng, râu kết thúc bằng hạt sáng. Chỉ xuất hiện ban đêm, hiền lành, hiếm |
| boulderhorn | Boulderhorn | earth | Tê giác đá xám, sừng trắng lớn, hàng gai đá trên lưng, rêu xanh, chân to nặng. Sống ở núi đá, hung dữ: chủ động tấn công người lại gần |
| cactoad | Cactoad | grass | Cóc sa mạc xanh lá, bụng kem, lưng mọc một cây xương rồng nhỏ có hoa hồng, mắt lồi. Sống ở sa mạc, tự vệ |
| scorchtail | Scorchtail | fire | Thằn lằn cam nhanh nhẹn, gai lửa vàng dọc lưng, chóp đuôi cháy sáng. Sa mạc và núi lửa, hung dữ |
| bogbloom | Bogbloom | grass | Ếch đầm lầy tròn màu ô liu, cổ đeo lá sen, đội bông súng hồng nhụy vàng. Sống ở đầm lầy, hiền |
| coralcrab | Coralcrab | water | Cua hồng đỏ, vương miện san hô trên mai, hai càng lớn. Chỉ có trên đảo hoang, tự vệ, khó bắt |
| frostfang | Frostfang | water | Sói tuyết trắng xanh, bờm lông trắng xù quanh cổ, ba tinh thể băng phát sáng dọc sống lưng, tai nhọn, hai răng nanh nhỏ, đuôi xù có mũi băng. Sống ở vùng tuyết, tự vệ, khó bắt |

## Tính khí

- **passive** (hiền): không bao giờ tấn công.
- **defensive** (tự vệ): đánh trả ai đánh nó trong 8 giây.
- **aggressive** (hung dữ): chủ động tấn công người/thú trong tầm 120 px.

Trường `spawn.biomes` (`meadow`, `lake`, `snow`, `desert`, `swamp`, `volcano`, `island`) và `spawn.time` (`any`, `day`, `night`) quyết định thú xuất hiện ở đâu, khi nào.


## Bản đồ và độ khó

Thế giới rộng 6400×4800 px (200×150 m): một lục địa giữa biển, chia 5 vùng (`packages/shared/src/terrain.ts`, `worldgen.ts`):

| Vùng | Hướng | Khí hậu | Thú đặc trưng |
|---|---|---|---|
| 🌳 Đồng cỏ | giữa | ôn hoà, có hồ và 30 bụi quả mọng (đánh để hái) | Leafkit, Emberpup, Voltmouse |
| ❄️ Núi tuyết | bắc | lạnh: mất máu nếu thiếu 🧥 Áo ấm hoặc thú hệ lửa đi theo | Frostfang |
| 🏜️ Sa mạc | nam | ngày nóng (cần 👒 Nón lá hoặc thú hệ nước), đêm lạnh; có ốc đảo | Cactoad, Scorchtail |
| 🌧️ Đầm lầy | tây | ẩm, mưa, nhiều ao | Bogbloom, Ripplefin |
| 🌋 Núi lửa | đông | nóng rực; trùm Vua Đá ở chân núi | Boulderhorn, Scorchtail |
| 🏝️ Đảo hoang | 4 góc biển | cần 🛶 Bè gỗ để ra; nhiều rương, thú mạnh | Coralcrab |

Thú càng xa điểm xuất phát càng mạnh: cấp tối đa từ 6 (gần lửa trại) đến 14 (góc bản đồ), xem `dangerAt` và `wildMaxLevel`.
40 rương báu đặt cố định theo seed (`layout.chests`), tự mở khi đi tới gần, mở lại sau 3 phút; rương ở xa có nhiều đồ hơn.
Chuỗi 16 nhiệm vụ dẫn người chơi đi qua mọi vùng: `packages/shared/src/quests.ts`.
