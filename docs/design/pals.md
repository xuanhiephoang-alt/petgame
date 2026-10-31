# Danh sách thú (pal)

Chỉ số nằm ở `packages/shared/src/data/pals.json`. File này lưu mô tả ngoại hình: hình vẽ bằng code (`packages/client/src/game/art/pals.ts`) và ảnh AI vẽ đều theo nó.
Hình trong game: ảnh trong `packages/client/public/assets/pals/` nếu có (cả 13 loài đã có ảnh AI vẽ; làm bằng `npm run sprite -- anh.png --pal <id>`), không thì hình vẽ bằng code. Xem tất cả ở http://localhost:5173/sprites.html khi chạy `npm run dev`.

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
| scorchtail | Scorchtail | fire | Kỳ nhông đỏ cam bò bốn chân sát đất, hàng gai lửa vàng từ đầu xuống lưng, sọc đỏ sẫm hai bên, đuôi dài lấm tấm đốm than hồng. Sa mạc và núi lửa, hung dữ |
| bogbloom | Bogbloom | grass | Ếch đầm lầy tròn màu ô liu, cổ đeo lá sen, đội bông súng hồng nhụy vàng. Sống ở đầm lầy, hiền |
| coralcrab | Coralcrab | water | Cua hồng đỏ, vương miện san hô trên mai, hai càng lớn. Chỉ có trên đảo hoang, tự vệ, khó bắt |
| frostfang | Frostfang | water | Sói tuyết trắng xanh, bờm lông trắng xù quanh cổ, ba tinh thể băng phát sáng dọc sống lưng, tai nhọn, hai răng nanh nhỏ, đuôi xù có mũi băng. Sống ở vùng tuyết, tự vệ, khó bắt |

## Mô tả cho AI vẽ ảnh (tiếng Anh)

Ghép vào câu lệnh mẫu trong `docs/art-style.md` (ảnh ghép 4 góc: trước, bên trái, sau, bên phải, nền xanh nhạt trơn):

| id | Mô tả |
|---|---|
| leafkit | a small green kitten with a pale green belly, ears shaped like two veined leaves, a curly vine tail ending in a leaf |
| emberpup | an orange-red puppy with floppy dark red ears, cream muzzle and chest, pink cheeks, a small flame tuft on its forehead, a two-layer glowing flame tail |
| bubbloon | a round floating water-bubble creature with a light blue belly, a shine spot on its head, a curly water drop on top, two side fins and a little fish tail |
| pebblet | a round boulder creature with short stubby arms and legs, lighter stone patches, bushy eyebrows, moss on top of its head with a tiny sprout, gentle eyes |
| voltmouse | a yellow mouse with big round ears (pink inside), a white tuft of static fur on its head, two brown stripes on its back, a long thin tail ending in a glowing turquoise orb; no red cheeks, no lightning-bolt tail |
| ripplefin | a chubby turquoise river fish with a white belly and light spots on its sides, a pointed dorsal fin, waddling on two fin feet, a fan tail |
| mothlume | a fluffy pale purple moth with a white fur collar, wings with glowing yellow spots, antennae ending in small glowing beads |
| boulderhorn | a grey stone rhino with a big white horn, a row of rock spikes on its back, patches of green moss, big heavy legs |
| cactoad | a green desert toad with a cream belly and bulging eyes, a small cactus with a pink flower growing on its back |
| scorchtail | a red-orange salamander that walks low on all four legs like a gecko, a frill of small yellow flame-shaped spikes from its head down its back, dark red stripes on its sides, a long curving tail dotted with glowing ember spots, round golden eyes, a pale yellow belly |
| bogbloom | a round olive-green swamp frog wearing a lily pad collar and a pink water lily with a yellow center on its head |
| coralcrab | a pink-red crab with a crown of coral branches on its shell and two big claws |
| frostfang | a white and pale blue wolf pup with a fluffy white mane, three glowing ice crystals along its spine, pointed ears, two small fangs, a fluffy tail with an icy tip |

## Thú đầu đàn

Mỗi vùng có một con thú đầu đàn (`packages/shared/src/alphas.ts`) canh một lãnh địa cố định (`alphaLairs`, tính từ seed của thế giới nên server và client giống nhau; dấu ★ trên bản đồ):

| Vùng | Loài | Cấp |
|---|---|---|
| 🌳 Đồng cỏ (tây nam, xa chỗ xuất phát) | Voltmouse | 15 |
| 🌧️ Đầm lầy | Bogbloom (tự hồi máu bằng Phấn hoa) | 17 |
| 🏜️ Sa mạc | Cactoad | 18 |
| ❄️ Núi tuyết | Frostfang | 19 |
| 🌋 Núi lửa (phía bắc núi, xa trùm) | Scorchtail (Thiên thạch) | 20 |
| 🏝️ Đảo hoang (cần bè) | Coralcrab (Sóng thần) | 22 |

- To gấp 1,6 lần, có quầng vàng dưới chân, nhãn "★ Đầu đàn" màu vàng (đỏ khi đang đánh) và thanh máu luôn hiện. Máu gấp 3 lần thú cùng loài cùng cấp.
- Thuộc đủ 3 chiêu và dùng thường hơn thú hoang khác (8% mỗi lượt, nghỉ 2,2 giây, không bị kéo dài thời gian hồi); sức mạnh chiêu tính tối đa ở cấp 8 để một người chơi biết né vẫn đánh được.
- Canh lãnh địa: tấn công ai lại gần (170 px), kể cả loài vốn hiền, không bỏ chạy. Bị kéo xa hơn 12 m khỏi chỗ ở thì bỏ trận, đi về, và hồi máu (4% mỗi giây) khi không ai làm phiền.
- Hạ gục (đánh choáng rồi đánh thêm): đồ rơi của loài cộng 🔵 2 bóng xịn và 🥧 2 bánh, thú đi theo của người hạ được 300 kinh nghiệm, cả thế giới được báo tin. Bắt: khó gấp 2,5 lần (tỉ lệ ×0,4), được ngay một con thú cấp cao; túi đầy thì không ném được.
- Quay lại chỗ ở sau 6 phút. Nhiệm vụ cuối chuỗi: "Hạ hoặc bắt một thú đầu đàn".

## Túi thú và thả thú

- Mỗi người chơi mang tối đa 30 thú (`MAX_PARTY`), tính cả con đang đi theo và các con làm việc ở trại.
- **Túi đầy thì không ném bóng được**, với mọi thú hoang kể cả thú đầu đàn (trùm thì không bao giờ bắt được). Khi đó bóng không bay đi, bóng xịn không bị trừ, thú hoang không bị động tới, và người chơi thấy "Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt". Client báo ngay mà không gửi tin; server vẫn tự kiểm tra lại. Cả hai dùng chung `throwBlocker` (`capture.ts`). Không còn trường hợp bắt được rồi mất thú.
- Khi túi đầy, nút 🐾 Thú hiện "🐾 Thú (30/30)" trên nền vàng. Nhờ vậy người chơi biết để thả bớt trước khi đánh choáng một con mới, vì choáng chỉ kéo dài 6 giây.
- **Thả thú:** mở bảng 🐾 Thú, bấm "🕊️ Thả bớt" (mỗi thẻ thú chỉ còn nút "Thả"), chọn một con, rồi xác nhận trong hộp "Giữ lại" / "Thả". Nút "Thả" trong hộp mờ 0,5 giây đầu để chạm đúp nhầm không thả mất thú. Thả được mọi con: đang nghỉ, đang đi theo, đang làm việc ở trại, đang kiệt sức, và cả con cuối cùng (hộp xác nhận nhắc riêng). Đóng bảng thì chế độ thả tự tắt.
- Thú được thả rời đi hẳn: không thành thú hoang, không rơi đồ, không hoàn lại gì. Lý do: bóng thường không giới hạn, và bắt một Leafkit cấp 1 gần lửa trại chỉ mất khoảng 3,5 giây (4 đòn, 96% bắt được khi choáng, bóng lắc 1,9 giây). Vì vậy phần thưởng nào khi thả cũng biến thành vòng lặp bắt rồi thả để kiếm đồ.

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
| ❄️ Núi tuyết | bắc | lạnh: mất máu nếu không mặc 🧥 Áo ấm (hay đội 🧶 Mũ len) hoặc có thú hệ lửa đi theo | Frostfang |
| 🏜️ Sa mạc | nam | ngày nóng (đội 👒 Nón lá, 🤠 Mũ thám hiểm hoặc có thú hệ nước), đêm lạnh; có ốc đảo | Cactoad, Scorchtail |
| 🌧️ Đầm lầy | tây | ẩm, mưa, nhiều ao | Bogbloom, Ripplefin |
| 🌋 Núi lửa | đông | nóng rực; trùm Vua Đá ở chân núi | Boulderhorn, Scorchtail |
| 🏝️ Đảo hoang | 4 góc biển | cần 🛶 Bè gỗ để ra; nhiều rương, thú mạnh | Coralcrab |

Thú càng xa điểm xuất phát càng mạnh: cấp tối đa từ 6 (gần lửa trại) đến 14 (góc bản đồ), xem `dangerAt` và `wildMaxLevel`.
40 rương báu đặt cố định theo seed (`layout.chests`), tự mở khi đi tới gần, mở lại sau 3 phút; rương ở xa có nhiều đồ hơn.
Chuỗi 17 nhiệm vụ dẫn người chơi đi qua mọi vùng (cuối cùng là hạ trùm rồi một thú đầu đàn): `packages/shared/src/quests.ts`.
