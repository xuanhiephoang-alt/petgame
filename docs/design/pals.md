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

| Vùng | Loài | Cấp | Máu | Cắn |
|---|---|---|---|---|
| 🌳 Đồng cỏ (tây nam, xa chỗ xuất phát) | Voltmouse | 15 | 399 | 11 |
| 🌧️ Đầm lầy | Bogbloom (tự hồi máu bằng Phấn hoa) | 17 | 630 | 11 |
| 🏜️ Sa mạc | Cactoad | 18 | 792 | 19 |
| ❄️ Núi tuyết | Frostfang | 19 | 966 | 22 |
| 🌋 Núi lửa (phía bắc núi, xa trùm) | Scorchtail (Thiên thạch) | 20 | 792 | 23 |
| 🏝️ Đảo hoang (cần bè) | Coralcrab (Sóng thần) | 22 | 1.170 | 27 |

- To gấp 1,6 lần, có quầng vàng dưới chân, nhãn "★ Đầu đàn" màu vàng (đỏ khi đang đánh) và thanh máu luôn hiện. Máu gấp 3 lần thú cùng loài cùng cấp. Khi nhiều nhãn chen nhau, nhãn đầu đàn không bao giờ bị ẩn (mục "Nhãn tên và thanh máu").
- Thuộc đủ 3 chiêu và dùng thường hơn thú hoang khác (8% mỗi lượt, nghỉ 2,2 giây, không bị kéo dài thời gian hồi); sức mạnh chiêu tính tối đa ở cấp 8 để một người chơi biết né vẫn đánh được.
- Cú cắn tính như thú hoang thường cùng loài cùng cấp (`wildDamage`, +8% mỗi cấp; `ALPHA.damageMultiplier` 1), mỗi 1,2 giây sau 0,45 giây gồng: 11 đến 27 (bảng trên, chưa tính giáp). 4/6 con cắn nặng hơn trùm (14).
- **Mốc cảm nhận** (đặt ra ở nhiệm vụ T7, số từ mô phỏng): trận kéo dài vài chục giây, và người biết né thì sống. Đánh liên tục, trận mất khoảng 5-30 giây (đồng cỏ ngắn nhất, đảo lâu nhất); chơi thật lâu hơn vì phải lướt né. Người chơi có kiếm, giáp da + mũ sắt (30%) và thú đi theo cấp 15:
  - né được nửa số đòn: thắng 5/6 thú đầu đàn, chết 0-28%. Coralcrab ở đảo là thử thách cuối: chết 70%, còn 10% nếu né được 3/4 số đòn;
  - đứng yên không né: thua từ sa mạc trở đi (chết 81-100%).
- Vì sao không bù khi T7 giảm đường cắn: trước T7 cú cắn tăng 15% mỗi cấp (16-42), người né được nửa số đòn vẫn chết 30-94% ở sa mạc, núi tuyết, núi lửa và đảo, tức không đạt mốc trên.
- Nút chỉnh: `ALPHA.damageMultiplier` 1,25 làm trận gắt hơn (cùng điều kiện, né nửa số đòn: chết 18-43% ở sa mạc, núi tuyết, núi lửa; đảo 86%); 1,5 gần như trước T7.
- Canh lãnh địa: tấn công ai lại gần (170 px), kể cả loài vốn hiền, không bỏ chạy. Bị kéo xa hơn 12 m khỏi chỗ ở thì bỏ trận, đi về, và hồi máu (4% mỗi giây) khi không ai làm phiền.
- Hạ gục (đánh choáng rồi đánh thêm): đồ rơi của loài cộng 🔵 2 bóng xịn và 🥧 2 bánh, thú đi theo của người hạ được 300 kinh nghiệm (`ALPHA.xp`, thay cho kinh nghiệm hạ gục thường), cả thế giới được báo tin. Bắt: khó gấp 2,5 lần (tỉ lệ ×0,4), được ngay một con thú cấp cao; khi bóng khép, thú đi theo nhận một lần kinh nghiệm bắt theo cấp như mọi lần bắt (60-78) cộng 300; túi đầy thì không ném được.
- Quay lại chỗ ở sau 6 phút. Nhiệm vụ cuối chuỗi: "Hạ hoặc bắt một thú đầu đàn".

## Túi thú và thả thú

- Mỗi người chơi mang tối đa 30 thú (`MAX_PARTY`), tính cả con đang đi theo và các con làm việc ở trại.
- **Túi đầy thì không ném bóng được**, với mọi thú hoang kể cả thú đầu đàn (trùm thì không bao giờ bắt được). Khi đó bóng không bay đi, bóng xịn không bị trừ, thú hoang không bị động tới, và người chơi thấy "Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt". Client báo ngay mà không gửi tin; server vẫn tự kiểm tra lại. Cả hai dùng chung `throwBlocker` (`capture.ts`). Không còn trường hợp bắt được rồi mất thú.
- Khi túi đầy, nút 🐾 Thú hiện "🐾 Thú (30/30)" trên nền vàng. Nhờ vậy người chơi biết để thả bớt trước khi đánh choáng một con mới, vì choáng chỉ kéo dài 6 giây.
- **Thả thú:** mở bảng 🐾 Thú, bấm "🕊️ Thả bớt" (mỗi thẻ thú chỉ còn nút "Thả"), chọn một con, rồi xác nhận trong hộp "Giữ lại" / "Thả". Nút "Thả" trong hộp mờ 0,5 giây đầu để chạm đúp nhầm không thả mất thú. Thả được mọi con: đang nghỉ, đang đi theo, đang làm việc ở trại, đang kiệt sức, và cả con cuối cùng (hộp xác nhận nhắc riêng). Đóng bảng thì chế độ thả tự tắt.
- Thú được thả rời đi hẳn: không thành thú hoang, không rơi đồ, không hoàn lại gì. Lý do: bóng thường không giới hạn, và bắt một Leafkit cấp 1 gần lửa trại chỉ mất khoảng 3,5 giây (4 đòn, 96% bắt được khi choáng, bóng lắc 1,9 giây). Vì vậy phần thưởng nào khi thả cũng biến thành vòng lặp bắt rồi thả để kiếm đồ.

## Kinh nghiệm và lên cấp

Chỉ thú có cấp (người chơi không có), tối đa cấp 30. Số liệu: `packages/shared/src/progression.ts` (đường cong, kinh nghiệm chiến đấu, `finishXp`), `alphas.ts` (`ALPHA.xp`), `boss.ts` (`BOSS.xp`), `crafting.ts` (`SNACK_XP`), `data/recipes.json` (giá bánh), `quests.ts` (thưởng nhiệm vụ). Đặt ra ở nhiệm vụ T4 (trước đó lên cấp 7 cần khoảng 27 trận, cấp 15 khoảng 210 trận).

**Đường cong:** từ cấp L lên L+1 cần `làm tròn(13 × L^1,5)` kinh nghiệm (`XP_CURVE`, `XP_CURVE_POWER`). Kinh nghiệm dư chuyển sang cấp sau; một lần nhận nhiều có thể lên vài cấp.

| Cấp L → L+1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 14 | 20 | 29 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kinh nghiệm cần | 13 | 37 | 68 | 104 | 145 | 191 | 241 | 411 | 681 | 1.163 | 2.030 |

Cộng dồn: cấp 3 = 50, cấp 5 = 222, cấp 7 = 558, cấp 10 = 1.444, cấp 15 = 4.159, cấp 20 = 8.727, cấp 30 = 24.572.

**Nguồn kinh nghiệm:**

| Nguồn | Kinh nghiệm | Ai nhận |
|---|---|---|
| Đòn thường của thú trúng thú hoang | 4 mỗi đòn (`XP_PER_HIT`) | thú ra đòn |
| Chiêu trúng ít nhất một thú hoang | 4 mỗi lần tung, không nhân theo số con trúng | thú tung chiêu |
| Hạ gục thú hoang | 12 ở cấp 1, thêm 10% mỗi cấp của thú bị hạ (`finishXp`): cấp 3 / 5 / 8 / 10 / 14 cho 14 / 17 / 20 / 23 / 28 | thú đi theo của người kết liễu |
| Bắt thú hoang | 25 ở cấp 1, cùng cách tính: 30 / 35 / 43 / 48 / 58; trả khi bóng khép, không phải lúc ném | thú đi theo của người ném lúc ném, nếu vẫn còn trong túi (con bắt đầu tiên tự đi theo nên không nhận) |
| Thú đầu đàn | hạ gục: 300 thay cho phần hạ gục; bắt: phần bắt theo cấp (60-78) cộng 300, trả một lần khi bóng khép | thú đi theo |
| Hạ trùm Vua Đá | 250 (`BOSS.xp`), cùng lúc với phần thưởng đồ | thú đi theo của mỗi người đã đánh trúng trùm |
| Làm việc ở trại | 2 mỗi món, chỉ khi chủ đang trong game | thú làm việc |
| Bánh quả mọng 🥧 | 40 mỗi cái, cho bất kỳ thú nào trong túi (nút "Cho ăn 🥧" ở bảng Thú) | thú được chọn |

Bánh có từ: chế ở trại (8 quả mọng, tức 5 kinh nghiệm mỗi quả), nhiệm vụ (11 cái cả chuỗi; "Bắt con thú đầu tiên", "Lên núi tuyết", "Thám hiểm đầm lầy" mỗi nhiệm vụ 1 bánh để người chơi biết nút "Cho ăn" từ sớm), rương (15%), thú bị hạ rơi (10%), thú đầu đàn (+2).

**Nhịp mục tiêu.** Một "trận" là hạ gục hoặc bắt một thú hoang khi có thú đi theo, trung bình khoảng 35 kinh nghiệm cho thú đi theo (gồm cả đòn của nó). Nhịp tính theo trận mỗi phút của cả buổi (gồm đi lại, dựng trại, chế tạo): thong thả 0,5, bình thường 0,75, tích cực 1,5. Đây là ước tính, chưa có số liệu người chơi thật:

| Cấp | Số trận | Thong thả | Bình thường | Tích cực |
|---|---|---|---|---|
| 5 | 6 | 13 phút | 8 phút | 4 phút |
| 7 (chiêu thứ 2) | 15 | 31 phút | 20 phút | 10 phút |
| 10 | 40 | 79 phút | 53 phút | 26 phút |
| 15 (chiêu thứ 3) | 116 | 3,9 giờ | 2,6 giờ | 77 phút |
| 20 | 255 | 8,5 giờ | 5,7 giờ | 2,8 giờ |

- Cấp 2 ngay trận đầu. Chiêu thứ 2 đến trong buổi chơi đầu, kể cả người chơi thong thả. Chiêu thứ 3 sau khoảng 4 buổi 40 phút ở nhịp bình thường (2 buổi nếu tích cực, 6 buổi nếu thong thả); thú đầu đàn và trùm rút ngắn đáng kể. Cấp 20 trở lên là đích dài hạn.
- Thú hoang cấp cao cho nhiều kinh nghiệm hơn, nên vùng xa đáng đi. Thú đi theo cấp cao hơn thú bị hạ vẫn nhận đủ (cấp thú đi theo gần như không đổi độ khó của thú thường).
- Không chia kinh nghiệm cho thú đang nghỉ trong túi: muốn nuôi con khác thì cho ăn bánh, cho làm việc hoặc cho đi theo. Chiêu trúng nhiều con không cho thêm, vì thú hoang đứng thưa và phần thêm chỉ khoảng 1%.
- Bắt rồi thả (từ khi có nút thả thú) không phải cách cày nhanh nhất: khoảng 0,7 lần so với hạ gục liên tục, vì kinh nghiệm bắt chỉ gấp khoảng 2 lần kinh nghiệm hạ gục. Giữ quy tắc này khi đổi số.

**Thông báo lên cấp.** Mỗi lần nhận kinh nghiệm làm thú lên cấp, server gửi một tin `LevelUp` kèm cấp trước đó (`fromLevel`) và cấp mới. Người chơi thấy "<Thú> lên cấp N! ⭐". Nếu thú vừa vượt qua cấp học chiêu (7 hoặc 15), thông báo thêm "Học được chiêu mới: ..." cho mọi chiêu học được trên đường, kể cả khi một lần nhảy nhiều cấp (ví dụ cấp 6 nhận 300 kinh nghiệm từ thú đầu đàn lên thẳng cấp 8 vẫn báo chiêu cấp 7). Khi hạ thú đầu đàn hoặc trùm, cho thú ăn bánh, hay khi bóng khép trên thú đầu đàn vừa bắt, tin lên cấp đến sau tin báo của sự kiện đó. Kinh nghiệm bắt thú trả khi bóng khép (thêm 0,3 giây, `CAPTURE_NEWS_DELAY_MS`), không phải lúc ném: tin lên cấp lúc ném sẽ lộ là đã bắt được khi bóng còn đang lắc. Trên màn hình, tin lên cấp là thông báo mức cao: không bị thông báo nào khác thay, hiện cùng lúc với tin báo của sự kiện hoặc chờ đến lượt (`docs/design/hud.md`, mục "Thông báo").

**Hồ sơ lưu trước T4:** thú giữ nguyên cấp và kinh nghiệm dư. Nếu kinh nghiệm dư đã đủ cho cấp sau theo đường cong mới thì thú lên cấp ngay khi nạp (tối đa thêm 1 cấp với mọi hồ sơ hợp lệ). Không thú nào tụt cấp hay mất kinh nghiệm. Lên cấp lúc nạp không có thông báo; bảng Thú hiện cấp và chiêu mới.

**Nút chỉnh nếu chơi thử thấy lệch:** `XP_CURVE` 12 (nhanh hơn khoảng 8%) hoặc 14 (chậm hơn khoảng 8%); bánh 12 quả nếu bánh vẫn lấn át săn thú; `ALPHA.xp` 200 nếu người chơi cày thú đầu đàn; `XP_PER_WORK` 1 nếu thú làm việc lên quá nhanh khi treo máy. Nếu có người cày thú yếu ở cấp cao: giảm kinh nghiệm kết liễu 10% cho mỗi cấp thú đi theo cao hơn thú bị hạ quá 3 cấp, thấp nhất còn một nửa (chưa làm).

## Nhãn tên và thanh máu

Trên đầu mỗi người chơi, thú và trại có một nhãn: tên (thú thì "Lv N Loài"), bên dưới là thanh máu khi bị thương. Chữ của thú hoang chỉ hiện khi nó bị thương, nổi giận hoặc choáng. Thanh máu của thú đầu đàn luôn hiện. Đặt ra ở nhiệm vụ T5; code ở `packages/client/src/game/labels.ts` và `labelLayout.ts`.

**Khi nhiều nhãn chen nhau** (hay gặp trên điện thoại: hình thú nhỏ đi còn chữ giữ nguyên cỡ), không nhãn nào được che nhãn khác. Nhãn quan trọng hơn giữ chỗ, theo thứ tự:

1. Nhãn của chính mình.
2. Thú đang nhắm: thú hoang gần nhất trong tầm ném bóng, tức con mà bóng sẽ bay tới khi bấm E hoặc Bắt.
3. Thú đi theo của mình.
4. Thú đầu đàn, trùm.
5. Người chơi khác.
6. Thú của người khác, thú đang làm việc ở trại.
7. Thú hoang khác.
8. Trại.

Nhãn bị vướng lần lượt thử ba cách, dừng ở cách đầu tiên được:
- **nâng lên** vừa đủ để thoát, tối đa 22 px;
- **thu gọn**: ẩn chữ, chỉ giữ thanh máu;
- **tạm ẩn**.

Bốn loại đầu (mình, thú đang nhắm, thú đi theo, đầu đàn và trùm) là **nhãn ghim**:
- không bao giờ bị ẩn, được nâng tới 48 px;
- con đứng trước giữ chỗ, con phía sau nâng lên;
- nên thanh máu của chúng luôn hiện.

Nhãn đã thu gọn hoặc ẩn phải có chỗ liên tục 1/4 giây mới hiện lại, để nhãn không nhấp nháy khi mọi người chen qua lại. Nhãn đổi độ cao mượt chứ không nhảy. Chữ bay (sát thương, tên chiêu, đồ nhặt) không tham gia và luôn nằm trên mọi nhãn.

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

Thú càng xa điểm xuất phát càng mạnh: cấp tối đa từ 6 (gần lửa trại) đến 14 (góc bản đồ), xem `dangerAt` và `wildMaxLevel`. Cấp thấp gặp nhiều hơn cấp cao; cấp cao nhất thường gặp là 6-8 ở đồng cỏ, 9-11 ở các vùng giữa, 12-13 ở đảo (mục "Sức mạnh thú hoang theo cấp").
40 rương báu đặt cố định theo seed (`layout.chests`), tự mở khi đi tới gần, mở lại sau 3 phút; rương ở xa có nhiều đồ hơn.
Chuỗi 17 nhiệm vụ dẫn người chơi đi qua mọi vùng (cuối cùng là hạ trùm rồi một thú đầu đàn): `packages/shared/src/quests.ts`.

## Sức mạnh thú hoang theo cấp

Đặt ra ở nhiệm vụ T7. Số liệu: `combat.ts` (`wildDamage`, `WILD_DAMAGE_PER_LEVEL`), `skills.ts` (`WILD_SKILL_MAX_LEVEL`, `wildSkillLevel`), `progression.ts` (`scaledMaxHp`). "Thú hoang thường" là thú hoang không phải thú đầu đàn hay trùm.

Mỗi cấp trên 1, thú hoang thường được thêm:
- 20% máu;
- 8% sức cắn (cấp 14 cắn gấp khoảng 2 lần cấp 1);
- 12% sức chiêu, nhưng chỉ tới cấp 8 (×1,84), kể cả chiêu hồi máu.

**Vì sao:**
- Người chơi luôn có 100 máu, không lên cấp. Giáp chỉ chặn 30% (giáp da + mũ sắt, chế được) đến 45% (giáp hiệp sĩ, rơi từ trùm).
- Vì vậy sức chịu đòn của thú hoang phải tăng nhanh hơn sức đánh: vùng xa đánh lâu hơn và thưởng nhiều hơn, chứ không hạ người chơi nhanh hơn bao nhiêu.
- Cú cắn chiếm khoảng 80% sát thương thú hoang gây ra (1 lần mỗi 1,2 giây; chiêu khoảng 1 lần mỗi 6-7 giây), nên đường cắn là nút chỉnh chính. Giới hạn chiêu chặn những cú nổ lớn một lần.

**Luật 1/3:** đòn mạnh nhất của một thú hoang thường (cú cắn hoặc chiêu, chưa tính giáp) nhỏ hơn 1/3 máu người chơi. Nghĩa là người chơi đầy máu phải trúng ít nhất 4 đòn mới bị hạ.
- Hiện tại: chiêu mạnh nhất 33 (Động đất của Boulderhorn từ cấp 8), cú cắn mạnh nhất 20 (Boulderhorn, Coralcrab cấp 14).
- Unit test giữ luật này cho mọi loài ở mọi cấp thú hoang có thể có.
- Thú đầu đàn và trùm không theo luật này.

**Thời gian trụ** của người đứng yên, không đánh lại, trước thú ở cấp cao nhất thường gặp của vùng (giây, mô phỏng):

| Vùng, thú, cấp | 1 thú, không giáp | 1 thú, giáp 30% | 2 thú, giáp 30% |
|---|---|---|---|
| 🌳 Đồng cỏ, Emberpup 6 | 9,6 | 13,9 | 6,6 |
| 🌋 Núi lửa, Boulderhorn 11 | 4,5 | 6,3 | 3,1 |
| 🏜️ Sa mạc, Scorchtail 10 | 5,8 | 8,1 | 3,2 |
| ❄️ Núi tuyết, Frostfang 11 | 5,3 | 8,1 | 3,4 |
| 🏝️ Đảo hoang, Coralcrab 13 | 5,1 | 6,9 | 3,3 |

- Trước T7 (cắn +15% mỗi cấp, chiêu theo đúng cấp) các số này ngắn hơn 20-65%, ví dụ đảo hoang 3,1 / 5,1 / 2,4 giây.
- Một thú hoang không còn đe doạ người có vũ khí và thú đi theo.
- Hai thú cấp cao vẫn hạ người đứng yên trong khoảng 3 giây: phải lướt né.
- Ba thú cùng lúc vẫn hạ người không giáp trong chưa tới 2 giây. Chuyện này hiếm, vì chỉ Boulderhorn và Scorchtail chủ động tấn công.

Thú đi theo không đổi: đòn thường +15% mỗi cấp (`companionDamage`), chiêu tính đúng cấp.

**Nút chỉnh** nếu chơi thử thấy vùng xa quá dễ:
- `WILD_DAMAGE_PER_LEVEL` 0,10: đảo hoang cấp 13 còn 4,2 giây thay vì 5,1 (1 thú, không giáp);
- `WILD_SKILL_MAX_LEVEL` 10: Động đất thành 37, phải bỏ luật 1/3.

## Hồi máu của người chơi

Đặt ra ở nhiệm vụ T32. Số liệu từ `BALANCE.md` của T32 (mô phỏng lại khi lập kế hoạch, khớp). Hằng số ở `combat.ts`.

- **Tự hồi:** 4 máu mỗi giây, chỉ khi đã 5 giây không bị đánh (`REGEN_PER_SECOND`, `REGEN_DELAY_MS`). Giữa trận coi như không có.
- **🫐 Quả mọng** (nút 🫐 Ăn hoặc phím H, giao diện ở `docs/design/hud.md`):
  - mỗi quả hồi ngay 20 máu (`BERRY_HEAL`), tức 1/5 thanh máu;
  - ăn xong phải chờ **4 giây** mới ăn quả tiếp (`EAT_COOLDOWN_MS`);
  - không ăn được khi hết quả hay đầy máu; những lần bị từ chối không tính là đã ăn.
- **Vì sao 4 giây:** ăn liên tục hồi tối đa 5 máu mỗi giây. Con số này thấp hơn sức đánh của thú ở cấp cao nhất thường gặp của mọi vùng: 10 đến 23 máu mỗi giây, gồm cả chiêu, chưa tính giáp. Mặc giáp hiệp sĩ (chặn 45%), thú yếu nhất trong số đó vẫn đánh 5,7 máu mỗi giây.
  - Vì vậy ăn để cứu nguy và kéo dài trận, không thay được lướt né. Người đứng yên vẫn bị hạ.
  - 3 giây (6,7 máu mỗi giây): người né được một nửa số đòn trụ được 51 giây trước Voltmouse đầu đàn (với 4 giây: 29 giây).
  - 5 giây (4 máu mỗi giây, bằng tự hồi): ăn giữa trận gần như vô nghĩa.
- **Thời gian sống** của người đứng yên, không giáp, ăn ngay khi được, trước 1 thú ở cấp cao nhất thường gặp:
  - đồng cỏ khoảng 17 giây (không ăn: 9,6), tốn 4 quả;
  - các vùng giữa và đảo 6-9 giây (không ăn: 4,5-6,4), tốn 2 quả mỗi trận;
  - trùm khoảng 11 giây (không ăn: 7), tốn 3 quả.
- **Trước T32** chưa có hồi chiêu: bấm liên tục hồi 80-100 máu mỗi giây, nên đứng yên chịu đòn được ở mọi trận chừng nào còn quả.
- **Nút chỉnh:** nếu chơi thử thấy trận trùm hay thú đầu đàn quá khắc nghiệt, hạ `EAT_COOLDOWN_MS` xuống 3000 trước khi đổi `BERRY_HEAL`. Không đổi giá quả mọng (bánh 8 quả, giáp da 12 quả).
