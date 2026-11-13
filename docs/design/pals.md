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
- Đuổi và về hang nhanh gấp 1,8 lần lúc lang thang như thú hoang khác; trần 96 px/s của thú hiền chạy trốn (mục "Tính khí") không áp cho thú đầu đàn. Vì vậy Voltmouse đầu đàn đuổi 171 px/s, nhanh hơn người chơi đi bộ (160): muốn thoát phải lướt hoặc kéo nó quá dây 12 m. Các thú đầu đàn khác đều chậm hơn người chơi (Scorchtail 153, Frostfang 135). Có nên kẹp hay không: việc đề xuất T58 (sau T27).
- Hạ gục (đánh choáng rồi đánh thêm): đồ rơi của loài cộng 🔵 2 bóng xịn và 🥧 2 bánh, thú đi theo của người hạ được 300 kinh nghiệm (`ALPHA.xp`, thay cho kinh nghiệm hạ gục thường), cả thế giới được báo tin, kể cả người hạ ("★ Hiệp đã hạ Voltmouse đầu đàn!"). Bắt: khó gấp 2,5 lần (tỉ lệ ×0,4), được ngay một con thú cấp cao; khi bóng khép, thú đi theo nhận một lần kinh nghiệm bắt theo cấp như mọi lần bắt (60-78) cộng 300; túi đầy thì không ném được.
- **Tin khi bắt được** (đặt ra ở nhiệm vụ T8):
  - Người bắt thấy "★ Bắt được Voltmouse đầu đàn! 🎉" lúc bóng khép (chữ của chính lần bắt).
  - Mọi người khác trong thế giới thấy tin ★ "★ Hiệp đã bắt được Voltmouse đầu đàn!".
  - Người bắt không nhận tin ★: trước T8, họ đọc hai tin cho cùng một việc, và tin thứ hai làm tin lên cấp phải chờ thêm 3 giây.
  - Bóng không giữ được thì người bắt thấy "Voltmouse đầu đàn thoát ra rồi (33%)".
- Quay lại chỗ ở sau 6 phút. Nhiệm vụ cuối chuỗi: "Hạ hoặc bắt một thú đầu đàn".

## Trùm Vua Đá: thân và đường về nhà

Đặt ra ở nhiệm vụ T21. Số liệu: bảng `BOSS` (`packages/shared/src/boss.ts`); luật ở `GameRoom.ts`.

- **Thân 40 px trong mọi việc** (`BOSS.radius`): xuất hiện, lang thang, đuổi, về nhà, cắn, trúng chiêu. Trước T21, lúc lang thang trùm dùng thân 20 px của Boulderhorn thường, nên lấn vào đá và lọt khe 40-80 px, rồi kẹt ở đó khi đổi sang thân 40 để đuổi.
- **Nhà** là chỗ trùm xuất hiện ở chân núi lửa. Khi không đánh ai mà cách nhà quá 8 m (256 px, `BOSS.leash`), trùm đi về bằng tìm đường (mục "Đi vòng cây, đá") với tốc độ đuổi (81 px/s, chậm hơn người chơi), tới khi cách nhà 4 m (128 px, `BOSS.homeRadius`) thì lang thang lại.
- Khác thú đầu đàn: trùm đang về **vẫn đánh** ai lại gần trong 120 px hoặc đánh nó; đánh xong, còn xa nhà thì lại về. Trùm không có dây giới hạn lúc đánh (như trước T21): người chơi vẫn dụ được nó đi xa, nhưng hết 8 giây giận là nó về.
- Không hồi máu khi về (khác thú đầu đàn).
- **Vì sao** (mô phỏng 400 lần, trùm bị dụ xa nhà 300-1.200 px quanh núi lửa, hầu hết bị núi hay cây chắn đường thẳng; tính tới khi cách nhà 128 px trong 60 giây):

  | Cách về | Về tới | Thời gian trung bình |
  |---|---|---|
  | Trước T21: lang thang, thân 20 | 67% | 21 giây |
  | Chỉ sửa thân thành 40, vẫn lang thang | 37% | 22 giây |
  | Tìm đường, tốc độ lang thang 45 px/s | 91% | 17 giây |
  | Tìm đường, tốc độ đuổi 81 px/s (chọn) | 92% | 10 giây |

  Sửa thân mà không tìm đường làm trùm kẹt nhiều hơn, nên hai việc làm cùng nhau. Số còn lại cần đường dài hơn giới hạn 1.500 ô một lần tìm: trùm trượt dần và thử lại mỗi 2 giây.

### Thú đầu đàn đã bắt

Đặt ra ở nhiệm vụ T8. Con thú đầu đàn bắt được mang dấu ★ mãi trong túi (lưu trong hồ sơ). Dấu hiện ở:
- **Bảng 🐾 Thú:** thẻ có viền vàng bên trái, tên ghi "★ Voltmouse · Lv 15" (★ màu vàng đậm; rê chuột vào ★ thấy "Thú đầu đàn"). Ở chế độ 🕊️ Thả bớt, nút "Thả" đọc cho trình đọc màn hình là "Thả Voltmouse đầu đàn · Lv 15".
- **Nhãn trên đầu** khi nó đi theo hay làm việc ở trại: "★ Lv 15 Voltmouse", chữ vàng trên nền tối như mọi nhãn thú đi theo. Mọi người trong thế giới đều thấy.
  - Dấu ★ không đổi hạng nhãn (mục "Nhãn tên và thanh máu"): thú đi theo của mình vẫn là nhãn ghim hạng 3, của người khác vẫn hạng 6.
  - Lý do: hạng xếp theo thứ người chơi cần thấy (của mình, mối nguy). Thú đầu đàn đã thuần không phải mối nguy.
- **Hộp xác nhận thả:** thêm dòng "★ Thú đầu đàn" ngay dưới tên. Thả xong thì thông báo "Đã thả Voltmouse đầu đàn. Tạm biệt! 👋".

**Không có lợi ích gì thêm.** Chỉ số, chiêu, sức làm việc giống thú thường cùng loài cùng cấp. Hình trong thế giới cũng bình thường: không to hơn, không có quầng vàng, vì hai thứ đó báo hiệu thú đầu đàn hoang đang canh lãnh địa. Lý do:
- **Phần thưởng đã lớn.** Con bắt được ở cấp 15-22, tức 4.159-11.141 kinh nghiệm cộng dồn. Ở nhịp bình thường, nuôi một con lên cấp 15 mất 116 trận, khoảng 2,6 giờ. Thú đi theo còn nhận thêm 300 kinh nghiệm.
- **Lợi ích gắn với dấu ★ sẽ cày được.** Thú đầu đàn quay lại sau 6 phút. Khi nó choáng ở 1 máu, mỗi lần ném bắt được khoảng 1/3 (33-35% ở cả 6 con; bóng xịn chỉ thêm chưa tới 1 điểm). Lợi ích sẽ cộng dồn tới 30 con trong túi.
- **Không lệch cân bằng.** Cân bằng của T7 tính sức thú đi theo chỉ theo cấp.
- **Không phá luật thả thú.** Thả không hoàn lại gì (mục "Túi thú và thả thú").

**Hồ sơ lưu trước T8** không có dấu này: mọi thú đọc ra là thú thường, kể cả con từng là đầu đàn (server không còn cách biết).

## Túi thú và thả thú

- Mỗi người chơi mang tối đa 30 thú (`MAX_PARTY`), tính cả con đang đi theo và các con làm việc ở trại.
- **Túi đầy thì không ném bóng được**, với mọi thú hoang kể cả thú đầu đàn (trùm thì không bao giờ bắt được). Khi đó bóng không bay đi, bóng xịn không bị trừ, thú hoang không bị động tới, và người chơi thấy "Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt". Client báo ngay mà không gửi tin; server vẫn tự kiểm tra lại. Cả hai dùng chung `throwBlocker` (`capture.ts`). Không còn trường hợp bắt được rồi mất thú.
- Khi túi đầy, nút 🐾 Thú hiện "🐾 Thú (30/30)" trên nền vàng. Nhờ vậy người chơi biết để thả bớt trước khi đánh choáng một con mới, vì choáng chỉ kéo dài 6 giây.
- **Thả thú:** mở bảng 🐾 Thú, bấm "🕊️ Thả bớt" (mỗi thẻ thú chỉ còn nút "Thả"), chọn một con, rồi xác nhận trong hộp "Giữ lại" / "Thả". Nút "Thả" trong hộp mờ 0,5 giây đầu để chạm đúp nhầm không thả mất thú. Thả được mọi con: đang nghỉ, đang đi theo, đang làm việc ở trại, đang kiệt sức, và cả con cuối cùng (hộp xác nhận nhắc riêng). Thú đầu đàn đã bắt cũng thả được; hộp có thêm dòng "★ Thú đầu đàn" (mục "Thú đầu đàn đã bắt"). Đóng bảng thì chế độ thả tự tắt.
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

Trên đầu mỗi người chơi, thú và trại có một nhãn: tên (thú thì "Lv N Loài"; thú đầu đàn đã bắt thì "★ Lv N Loài", chữ vàng), bên dưới là thanh máu khi bị thương. Chữ của thú hoang chỉ hiện khi nó bị thương, nổi giận hoặc choáng. Thanh máu của thú đầu đàn hoang luôn hiện. Đặt ra ở nhiệm vụ T5; code ở `packages/client/src/game/labels.ts` và `labelLayout.ts`.

**Khi nhiều nhãn chen nhau** (hay gặp trên điện thoại: hình thú nhỏ đi còn chữ giữ nguyên cỡ), không nhãn nào được che nhãn khác. Nhãn quan trọng hơn giữ chỗ, theo thứ tự:

1. Nhãn của chính mình.
2. Thú đang nhắm: con mà bóng sẽ bay tới khi bấm E hoặc Bắt, có vòng ngắm dưới chân (mục "Thú đang nhắm và vòng ngắm").
3. Thú đi theo của mình.
4. Thú đầu đàn hoang, trùm.
5. Người chơi khác.
6. Thú của người khác, thú đang làm việc ở trại.
7. Thú hoang khác.
8. Trại.

Thú đầu đàn đã bắt giữ hạng của thú đi theo hoặc thú của người khác (mục "Thú đầu đàn đã bắt"), dấu ★ không đổi hạng.

Nhãn bị vướng lần lượt thử ba cách, dừng ở cách đầu tiên được:
- **nâng lên** vừa đủ để thoát, tối đa 22 px;
- **thu gọn**: ẩn chữ, chỉ giữ thanh máu;
- **tạm ẩn**.

Bốn loại đầu (mình, thú đang nhắm, thú đi theo, đầu đàn hoang và trùm) là **nhãn ghim**:
- không bao giờ bị ẩn, được nâng tới 48 px;
- **nhãn của mình luôn giữ chỗ, không bao giờ bị nâng** (T63). Các nhãn ghim khác: con đứng trước giữ chỗ, con phía sau nâng lên;
- nên thanh máu của chúng luôn hiện.

Lý do nhãn của mình luôn giữ chỗ: luật thông báo khi cầm dọc (`docs/design/hud.md`, mục "Thông báo và tên mình khi cầm dọc") tính chỗ theo mép trên tên mình lúc đứng yên. Trước T63, thú đi theo, thú đang nhắm hay trùm đứng ngay trước mình đẩy tên mình lên 8-22 px (đo ở T63, 390×844), nên 2 thông báo có thể đè tên. Nay con đứng trước nâng nhãn của nó qua nhãn mình (đo ở T63: thú đi theo +29, thú đang nhắm +27-38 px, vẫn trong 48 px); hết chỗ thì nó thu gọn còn thanh máu như mọi nhãn ghim.

Nhãn đã thu gọn hoặc ẩn phải có chỗ liên tục 1/4 giây mới hiện lại, để nhãn không nhấp nháy khi mọi người chen qua lại. Nhãn đổi độ cao mượt chứ không nhảy. Chữ bay (sát thương, tên chiêu, đồ nhặt) không tham gia và luôn nằm trên mọi nhãn.

**Lúc chuyển** (làm rõ ở nhiệm vụ T51). Bố cục quyết định ngay trong một khung hình, còn hình vẽ đi theo sau:
- nhãn mờ đi hoặc hiện ra trong 0,15-0,2 giây (CSS);
- nhãn đổi độ cao mượt, xong 95% sau khoảng 0,2 giây.

Vì vậy, khi một nhãn nhường chỗ (thu gọn, ẩn, hạ xuống), nhãn khác có thể vào chỗ đó trong lúc chữ cũ chưa mờ hết. Hai nhãn chạm nhau thoáng qua như vậy, tối đa khoảng 0,2 giây, là đúng thiết kế: đổi lại, nhãn không nhảy hay nhấp nháy. Còn nếu hai nhãn **đè nhau liền 0,4 giây trở lên**, đó là lỗi bố cục. Số đo ở T51, điện thoại 390×844, cả khi máy bận: mỗi lần chạm thoáng kéo dài 30-190 ms, tức 1-5 khung hình.

Thú đang nhắm có thể là một thú hoang lành lặn. Thú lành lặn không hiện nhãn, nên dấu của nó là vòng ngắm dưới chân (T28). Trước T28, một thú lành lặn đi ngang, gần hơn thú bị thương vài px, là giành mất chỗ thú đang nhắm; khi đó thú bị thương mất hạng ghim, thu nhỏ còn thanh máu, và các nhãn quanh đó xếp lại. Từ T28 thú bị thương và thú choáng được ưu tiên, và con đang nhắm được giữ lại khi hai con gần bằng nhau, nên chuyện đó chỉ còn xảy ra khi con lành lặn gần hơn hẳn.

## Tính khí

Mỗi loài có một tính khí (`temperament` trong `pals.json`): nó làm gì khi không ai động tới, và khi bị đánh. Số liệu ở `combat.ts`, luật ở `GameRoom.ts` (`provoke`, `wildTarget`).

| Tính khí | Loài | Không ai động tới | Bị đánh |
|---|---|---|---|
| **passive** (hiền) | Leafkit, Bubbloon, Voltmouse, Mothlume, Bogbloom | lang thang, không bao giờ tấn công | chạy trốn 2,5 giây |
| **defensive** (tự vệ) | Emberpup, Pebblet, Ripplefin, Frostfang, Cactoad, Coralcrab | lang thang | lao vào kẻ đánh, cắn và tung chiêu trong 8 giây |
| **aggressive** (hung dữ) | Boulderhorn, Scorchtail | tấn công người chơi hoặc thú đi theo gần nhất trong 120 px (`AGGRESSIVE_SIGHT`) | như thú tự vệ |

- **Bị đánh** gồm đòn của người chơi, đòn và chiêu của thú đi theo, và cả **bóng không giữ được**: thú thoát khỏi bóng coi như vừa bị người ném đánh.
- **Đuổi theo** nhanh gấp 1,8 lần lúc lang thang (`WILD_CHASE_SPEED_FACTOR`). **Chạy trốn** cũng gấp 1,8 lần nhưng không quá 96 px/s, tức 0,6 lần tốc độ đi bộ của người chơi (`WILD_FLEE_SPEED_CAP`, hàm `fleeSpeed` trong `combat.ts`; đặt ra ở nhiệm vụ T27).
  - **Thú hiền** chạy thẳng ra xa kẻ đánh trong 2,5 giây (`FLEE_MS`), tính lại sau mỗi đòn:

    | Loài | Chạy trốn | Quãng tối đa mỗi lần chạy |
    |---|---|---|
    | Voltmouse, Mothlume | 96 px/s (bị kẹp; không kẹp sẽ là 171 và 135) | 240 px |
    | Leafkit | 90 px/s | 225 px |
    | Bubbloon, Bogbloom | 72 px/s | 180 px |

    Người chơi đi bộ đuổi luôn rút ngắn ít nhất 64 px mỗi giây, nên đánh tiếp được đúng nhịp vũ khí, không cần lướt. Không ai đuổi thì thú ra khỏi tầm ném bóng (180 px).
  - **Vì sao kẹp ở 0,6** (`BALANCE.md` của T27): trước T27 Voltmouse chạy 171 px/s, nhanh hơn người chơi (160), nên sau mỗi hai đòn người chơi phải chờ nó hết chạy; hạ một con cấp 3 tay không mất 9 giây, gấp 3,5-4,5 lần thú cùng cấp. Kẹp ở 0,9 (144 px/s) chỉ đủ khi đuổi hoàn hảo: người chơi điện thoại bám kém 10% là lại mất 8,5 giây. Kẹp ở 0,6 giữ thời gian hạ gục bằng lúc đánh thú đứng yên (Voltmouse cấp 3: khoảng 2 giây, ngang Leafkit 2,4) tới khi người chơi chỉ đuổi được 70% tốc độ. Nút chỉnh nếu muốn thú chạy rõ hơn: 0,65 (104 px/s) vẫn an toàn tới 75%.
  - **Thú tự vệ** đuổi theo kẻ đánh nó sau cùng trong 8 giây (`WILD_AGGRO_MS`), tính lại sau mỗi đòn, **bất kể người chơi chạy xa bao nhiêu** (Emberpup đuổi 126 px/s). Không có dây giới hạn, nên chạy ra xa không cắt đuôi được; núp sau cây, đá cũng không, vì thú tìm đường vòng (mục "Đi vòng cây, đá"). Lướt chỉ làm trượt cú cắn đang gồng. Mỗi cú cắn đẩy người chơi lùi 16 px, ra xa con thú.
- Thú đang choáng (6 giây) hoặc đang trong bóng thì đứng yên, không cắn. Thú hiền bị đánh tới choáng thì thôi chạy trốn.
- Thú đầu đàn không theo bảng này: canh lãnh địa, tấn công cả khi là loài hiền, không bỏ chạy, có dây giới hạn (mục "Thú đầu đàn").
- Trùm Vua Đá hung dữ như Boulderhorn, nhưng hết đánh mà ở xa nhà thì đi về (mục "Trùm Vua Đá: thân và đường về nhà").

**Đòn đánh và bóng trúng con nào:**
- **Đánh** (Space, nút Đánh): server cho trúng thú hoang **gần nhất trong tầm vũ khí** (tay không 48 px). Người chơi không chọn được con nào. Chỉ khi không có thú nào trong tầm thì đòn mới hái quả, chặt cây hay đập đá.
- **Bắt** (E, nút Bắt): bóng bay tới **thú đang nhắm**, con có vòng ngắm dưới chân (mục "Thú đang nhắm và vòng ngắm"). Thú bị thương và thú choáng được ưu tiên hơn thú lành lặn đứng gần bằng. Client chọn con, server kiểm lại tầm.
- Vì vậy một thú hoang đi ngang qua có thể nhận đòn định cho con khác; nếu là thú tự vệ thì nó đánh lại. Với bóng thì người chơi thấy trước con nào sẽ bị ném, và thú lành lặn đi ngang không giành được chỗ của con đang bị đánh.

Trường `spawn.biomes` (`meadow`, `lake`, `snow`, `desert`, `swamp`, `volcano`, `island`) và `spawn.time` (`any`, `day`, `night`) quyết định thú xuất hiện ở đâu, khi nào.

## Thú đang nhắm và vòng ngắm

Đặt ra ở nhiệm vụ T28. Trước đó bóng bay tới thú hoang gần nhất trong tầm ném, và người chơi không thấy đó là con nào. Đo ở T51: một Leafkit lành lặn đi ngang, gần hơn 2 px (36 so với 38 px), giành chỗ của con đang bị thương 1 máu trong khoảng 5 giây; bấm Bắt lúc đó là ném vào con lành lặn.

**Luật chọn** (hàm thuần `throwTarget` trong `packages/shared/src/capture.ts`, số trong bảng `AIM`):
- Chỉ xét thú hoang trong 180 px (`THROW_RANGE`), không đang nằm trong bóng (của bất kỳ ai), không phải trùm.
- Mỗi con có một **khoảng cách tính điểm**: khoảng cách thật, trừ 48 px nếu nó đang choáng, hoặc trừ 24 px nếu nó bị thương (máu dưới tối đa). Con có điểm nhỏ nhất được nhắm.
- **Giữ con đang nhắm:** con đang nhắm chỉ mất chỗ khi một con khác hơn nó quá 8 px điểm. Nhờ vậy vòng ngắm và nhãn ghim không nhảy qua lại giữa hai con đứng gần bằng.
- Bằng điểm thì con gần hơn thật được chọn.

**Vì sao các con số:**
- **Choáng: 48 px**, bằng tầm đánh tay không (`ATTACK_RANGE`). Một con choáng còn trong tầm đánh luôn được nhắm trước mọi thú lành lặn. Choáng chỉ kéo dài 6 giây, và lúc đó bắt dễ hơn nhiều: Leafkit cấp 5 khoảng 92% khi choáng 1 máu so với 42% khi lành lặn; Voltmouse cấp 5 khoảng 86% so với 23%. Ném nhầm vào con lành lặn mất 0,8 giây chờ ném lại cộng 1-1,5 giây bóng lắc, có khi hết luôn lúc choáng, và còn chọc giận con kia.
- **Bị thương: 24 px**, một nửa mức choáng. Đủ cho trường hợp đo ở T51 (cách nhau 2 px) và cả khi con lành lặn gần hơn tới 24 px. Con lành lặn sát chân người chơi (gần hơn quá 24 px) vẫn được nhắm, nên người chơi muốn ném con lành lặn thì bước lại gần nó.
- **Giữ: 8 px**. Thú lang thang đi tối đa 95 px/s, nên muốn vượt 8 px phải đi thêm ít nhất khoảng 0,1 giây. Mức này chặn chuyện vòng ngắm nhảy qua lại từng khung hình vì vị trí nội suy rung vài px, nhưng không giữ lâu con mà người chơi đã rõ ràng bước ra xa.

**Server không chọn con.** Tin ném mang id con mà client thấy được nhắm. Server chỉ kiểm: con đó còn, chưa nằm trong bóng, đã hết hồi ném (0,8 giây), và nằm trong `THROW_RANGE` cộng 32 px dư (`THROW_REACH_SLACK`). Thú bị trùm hoặc túi đầy thì báo lý do (`throwBlocker`).
- Lý do không để server chọn: server thấy vị trí khác client tới khoảng 25 px (mục dưới). Nếu server tự chọn lại thì bóng có thể bay tới con khác với con có vòng ngắm, đúng lỗi mà T28 sửa.
- Lý do có 32 px dư: client vẽ thú hoang trễ hơn server. Thú bỏ chạy 96 px/s, nên khi tin ném tới server nó đã ra xa thêm khoảng 25 px (nội suy 0,14 giây, nửa nhịp gửi state 0,025 giây, mạng hai chiều 0,1 giây). Không có phần dư, một lần ném vào con có vòng ngắm ở mép tầm sẽ bị bỏ qua không một lời. Client đã sửa chỉ nhắm trong 180 px, nên phần dư chỉ có ích cho client bị sửa: ném xa hơn 32 px, không đáng kể.

**Vòng ngắm** (client, `packages/client/src/game/aimMarker.ts`): một vòng dưới chân thú đang nhắm, vẽ bằng code.
- **Hình:** bốn cung tròn màu kem có viền nâu đậm cùng tông (không dùng đen), giữa các cung là bốn mũi tam giác nhỏ chĩa vào trong. Cả vòng dẹt theo mặt đất (cao bằng một nửa bề ngang) và xoay chậm.
- **Cỡ:** bán kính bằng 0,6 lần chiều cao thân thú, ít nhất 22 px. Vì vậy vòng lớn hơn bóng (0,31) và vòng của thú đi theo (0,42), và lớn hơn cả quầng vàng của thú đầu đàn.
- **Màu:** khác mọi vòng có sẵn: vòng thú đi theo màu người chơi, vòng trùm đỏ, quầng đầu đàn vàng, vùng chiêu đỏ. Nền kem viền nâu đọc được trên cỏ, tuyết trắng, cát, đầm lầy và đá núi lửa.
- **Chuyển động:** vòng thở nhẹ (±5%). Khi đổi sang con khác, vòng hiện ra từ cỡ 1,5 lần thu về trong 0,16 giây, để người chơi thấy bóng vừa đổi đích.
- **Ban đêm:** thêm một đốm sáng nhỏ (bán kính 56 px) ở chân thú đang nhắm, nên ở mép tầm ném (180 px, đèn lồng của người chơi tới 210 px nhưng mờ dần) vẫn thấy cả vòng lẫn con thú.
- **Ẩn khi:** không con nào ném được, hoặc mất kết nối (lúc đó ném cũng không được). Nhãn của thú đang nhắm vẫn là nhãn ghim (mục "Nhãn tên và thanh máu"). Thú lành lặn không hiện nhãn, nên với nó vòng ngắm là dấu duy nhất.
- **Cảm ứng và bàn phím** như nhau: nút Bắt và phím E ném vào đúng con có vòng ngắm. Không con nào ném được thì báo "Không có thú nào ở gần"; nếu trong tầm chỉ có trùm thì báo "Không thể bắt trùm! Hãy cùng nhau hạ nó". Chưa có cách tự chọn con khác (chạm vào thú, phím đổi đích): người chơi bước lại gần con mình muốn.

## Đi vòng cây, đá

Đặt ra ở nhiệm vụ T9. Code: `packages/shared/src/pathfind.ts` (lưới đi lại, A*), `packages/server/src/ai/pathing.ts` (khi nào tìm đường, giới hạn chi phí), chỗ gọi trong `GameRoom.ts`.

**Ai tìm đường:**

| Ai | Tới đâu | Coi là đã tới khi cách | Thân | Qua biển |
|---|---|---|---|---|
| Thú hoang đuổi (thú tự vệ bị đánh, thú hung dữ thấy người, thú vừa thoát bóng) | kẻ nó đang đánh | tầm cắn 40 px | 12-20 px theo loài | không |
| Thú đầu đàn đuổi trong lãnh địa | như trên | 40 px | theo loài | không |
| Thú đầu đàn bị kéo quá xa, đi về hang | chỗ ở | 64 px (nửa vùng dạo) | theo loài | không |
| Trùm Vua Đá đuổi | kẻ nó đang đánh | tầm cắn 64 px | 40 px | không |
| Trùm Vua Đá về nhà (không đánh ai mà cách nhà quá 8 m) | chỗ nó xuất hiện | 128 px (4 m) | 40 px | không |
| Thú đi theo bám chủ | chủ | 56 px (khoảng bám) | theo loài | được |
| Thú đi theo lao vào thú hoang chủ đang đánh | con thú đó | tầm đánh, 40 px cộng thân nó | theo loài | được |

Không tìm đường (giữ như cũ): thú hiền chạy trốn (chạy thẳng, không có đích, chưa chọn hướng thoáng: việc đề xuất T57), lang thang (đã tự đổi đích khi bị chặn), thú làm việc đi tới chỗ làm ở trại.

**Cách đi:**
- Đường thẳng tới mục tiêu đủ rộng cho thân nó thì đi thẳng, y như trước T9.
- Bị cây, đá, hồ hay núi lửa chắn thì tìm một đường vòng rồi đi theo các điểm mốc. Với thú hoang, biển cũng là vật chắn. Thấy lại mục tiêu là đi thẳng ngay, trừ đường tìm vì bị kẹt (dưới đây): đường đó đi tới hết rồi mới đi thẳng.
- **Trùm không đi vòng quá xa** (T21): khi đuổi, đường vòng dài hơn `min(648, max(3 × d, d + 160))` px (d là khoảng cách thẳng tới mục tiêu lúc tìm; 648 px là quãng trùm đuổi được trong 8 giây giận) thì coi như không có đường: trùm đứng ép vào vật cản phía mục tiêu, vẫn dậm đất được nếu mục tiêu trong 102 px, 2 giây sau thử lại. Thú khác không có giới hạn này.
- Đường tính theo đúng bề rộng thân: thú to không chui khe hẹp; trùm (thân 40 px) chỉ đi lối rộng từ 80 px.
- Mục tiêu chạy xa hơn 48 px khỏi chỗ đường dẫn tới thì tìm lại. Mỗi con tìm nhiều nhất 2 lần mỗi giây.
- Đang đuổi mà gần như đứng yên 0,3 giây (kẹt) thì tìm đường, kể cả khi đường thẳng trông có vẻ thông.
- Đã trong tầm (cắn, đánh, bám) thì không tìm đường: thú đứng cắn qua thân cây như trước, nhịp cắn không đổi.
- Không có đường, hoặc đường quá xa để tìm trong giới hạn: trượt quanh vật cản như trước T9, 2 giây sau thử lại. Luật đuổi không đổi: thú hoang vẫn đuổi 8 giây rồi thôi, thú đi theo vẫn nhảy về cạnh chủ khi cách quá 480 px.

**Vì sao.** Trước T9 thú chỉ trượt dọc vật cản. Mô phỏng trên thế giới thật (`defaultWorld()`, mục tiêu đứng yên cách 60-320 px, đường thẳng bị chắn):

| Trường hợp | Tới được trước T9 | Sau T9 (bản mẫu khi lập kế hoạch) |
|---|---|---|
| Emberpup (thân 15) đuổi người, trong 8 giây | 84% | 99% |
| Boulderhorn (thân 20) | 81% | 99,7% |
| Trùm (thân 40) | 78% | 94% (phần lớn số còn lại cần hơn 8 giây kể cả theo đường ngắn nhất) |
| Thú đi theo lao vào thú hoang, trong 6 giây | 88% | 99,7% |

- Giới hạn đường vòng của trùm (T21), mô phỏng 600 lần đuổi bị chắn (mục tiêu đứng yên cách 60-320 px, 8 giây) trên cả thế giới / quanh núi lửa: tới tầm cắn 82,8% / 88,8% khi chưa có giới hạn, 83,7% / 90,7% khi có; tới tầm dậm 87,0% / 91,2% thành 88,5% / 93,5%. Số lần trùm đi ra xa mục tiêu hơn 150 px so với lúc bắt đầu: 27 / 13 thành 0 / 0. Quãng đi trung bình 237 thành 201 px.
- Con kẹt thì kẹt tới hết 8 giây (trung vị 7,1 giây). 87% kẹt trong hốc giữa hai vật cản trở lên: cụm cây, cây với đá.
- Kẹt nhiều nhất ở đầm lầy (40% số lần đuổi bị chắn), rừng đồng cỏ (28%) và núi tuyết (16%).
- Thú đi theo bám chủ vốn ít kẹt, vì nó đi theo vết chủ: nhảy về chủ 0,06 lần mỗi phút. Tìm đường giúp chủ yếu khi chủ lách qua khe mà thú to hơn không lọt.

**Lối chơi:** núp sau cụm cây không còn cắt đuôi được thú tự vệ hay thú hung dữ. Muốn thoát thì chạy xa rồi chờ hết 8 giây, như mọi nơi khác. Không đổi số cân bằng nào: thời gian trụ của T7 vốn tính người đứng yên và thú tới được.

**Giới hạn chi phí (mỗi phòng):**
- Mỗi lần tìm xét tối đa 1.500 ô (lưới 16 px).
- Mỗi tick (1/20 giây) xét tối đa 3.000 ô và 8 lần tìm. Yêu cầu xếp hàng theo thứ tự đến; trong lúc chờ, thú vẫn trượt như cũ.
- Một con tìm lại sau ít nhất 0,5 giây, hoặc 2 giây nếu lần trước không thấy đường.
- Ví dụ xấu nhất: 100 con cùng cần đường một lúc thì con cuối chờ khoảng 0,65 giây.

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
