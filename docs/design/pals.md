# Danh sách thú (pal)

Chỉ số nằm ở `packages/shared/src/data/pals.json`. File này lưu mô tả ngoại hình để art-pipeline dựng model.
Model 3D hiện tại: `assets/pals/build.ts` → `packages/client/public/assets/models/pal-<id>.glb` (xem ở http://localhost:5173/model-viewer.html).

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

## Tính khí

- **passive** (hiền): không bao giờ tấn công.
- **defensive** (tự vệ): đánh trả ai đánh nó trong 8 giây.
- **aggressive** (hung dữ): chủ động tấn công người/thú trong tầm 120 px.

Trường `spawn.biomes` (`meadow`, `lake`, `rocky`) và `spawn.time` (`any`, `day`, `night`) quyết định thú xuất hiện ở đâu, khi nào.

