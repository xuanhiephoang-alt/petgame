# PLAN: T5 Nhãn tên đè lên nhau

## Mục tiêu

- Khi người và thú đứng gần nhau, nhãn tên và thanh máu chồng lên nhau, khó đọc. Trên điện thoại còn nặng hơn.
- Đo trên game hiện tại (commit `1790feb`) ở 3 cảnh đông (mục Hiện trạng):
  - desktop: tới 3 cặp nhãn chồng nhau mỗi cảnh;
  - điện thoại dọc và ngang: tới 6 cặp;
  - nhãn vàng của chính mình bị nhãn thú của người khác che gần hết.
- Sau nhiệm vụ, người chơi:
  - không thấy hai nhãn nào chồng lên nhau. Khi chật, nhãn kém quan trọng được nâng nhẹ lên, hoặc thu lại chỉ còn thanh máu, hoặc tạm ẩn;
  - luôn thấy nhãn của các nhãn ghim (định nghĩa ở Thiết kế mục 2): nhãn của mình, thú đi theo, thú đang nhắm (con mà bóng sẽ bay tới khi bấm E hoặc Bắt), thú đầu đàn và trùm. Thanh máu của chúng luôn hiện;
  - không thấy nhãn nhấp nháy khi người và thú chen qua lại.
- Không đổi server, schema, tin nhắn hay dữ liệu lưu.

## Hiện trạng

**Nhãn được tạo ở đâu.** Mọi nhãn là phần tử DOM trong `div.labels` (z-index 1, nằm dưới HUD z-index 2, không nhận chạm). `packages/client/src/game/labels.ts` giữ chúng trong một `Set<Tag>` (`element`, `at()`, `lift`, `visible`). Game tạo nhãn bằng `Game.nameTag()` (`Game.ts:333`), gồm `div.label`, bên trong là `span` tên, rồi `addHpBar()` gắn thêm `div.hp-bar` sau khi nhãn đã được thêm vào `Labels`.

| Loại | Class | Chữ | Khi nào hiện | `lift` |
|---|---|---|---|---|
| Mình | `label me` (nền vàng) | tên | luôn; thanh máu khi bị thương | cao hình + 6 |
| Người khác | `label` | tên; đang chờ nối lại (T3): thêm `offline`, chữ "<tên> (mất kết nối)" | luôn; thanh máu khi bị thương | cao hình + 6 |
| Thú đi theo, thú làm việc | `label companion` (11 px) | "Lv N Loài" | luôn; thanh máu khi bị thương | cao hình + 4 |
| Thú hoang | `label pal` (11 px) | "Lv N Loài"; `angry` thêm "❗", `dizzy` thêm "💫 " | **chữ ẩn (opacity 0)** trừ khi `hurt`, `angry` hoặc `dizzy`; thanh máu khi `hurt` | cao hình + 4 |
| Thú đầu đàn | `label pal alpha` (13 px, nền vàng, đỏ khi đánh) | "★ Đầu đàn · Lv N Loài" | luôn, thanh máu 52×6 luôn hiện. Quầng vàng dưới chân là hình PixiJS (`PalActor.aura`), không phải nhãn | cao hình ×1,6 + 6 |
| Trùm | `label pal boss` (14 px, nền đỏ) | "👑 Vua Đá Boulderhorn" | luôn; thanh máu khi bị thương. Thêm thanh máu lớn trên HUD khi ở gần 450 px | cao hình ×2,4 + 8 |
| Trại | `label base` | "🏕️ Trại của X · Cấp N" | luôn | 96 |
| Chữ bay | `div > div.float-text` | sát thương, tên chiêu, "Né!", đồ nhặt... | 1,2 giây, đứng yên tại điểm thế giới lúc tạo | tuỳ |

**Kích thước đo được** (CSS px):
- nhãn chỉ có tên: cao 16-17, rộng 43-122;
- nhãn có thanh máu: cao 24-25 (tên + khe 3 + thanh 5);
- nhãn đầu đàn: 213×27.

Nhãn có cỡ CSS cố định còn thế giới thì co giãn theo `Stage.zoomFor`:
- desktop 1280×720: zoom 1,636;
- điện thoại 390×844 và 844×390: zoom 0,886.

Nên trên điện thoại hình thú nhỏ đi 46% so với desktop, còn nhãn giữ nguyên cỡ. Cùng một cảnh, điện thoại có số cặp chồng gấp 2-3 lần desktop.

**Mỗi khung hình**, `Labels.update()` (gọi cuối `Game.frame()`, `Game.ts:949`) làm như sau:
- duyệt **mọi** nhãn trong thế giới, khoảng 104-115: 80-87 thú hoang, 6 đầu đàn, trùm, người, thú đi theo, trại, chữ bay;
- tính toạ độ màn hình, ẩn (`display: none`) nhãn ngoài màn hình (lề 100/60 px) và nhãn `visible = false` (thú xa hơn 1000 px, trong bóng, đang biến mất);
- ghi lại `style.transform` cho mọi nhãn trên màn hình, kể cả khi không đổi.

Không có xử lý va chạm nào. Thứ tự vẽ là thứ tự thêm vào DOM, nhãn tạo sau nằm trên. Vì vậy nhãn thú của người vào sau che nhãn vàng của mình.

**Chi phí đo được:** `Labels.update` trung bình 0,23 ms/khung hình, tối đa 2,2 ms, ở cảnh đông có 104 nhãn trong DOM và 9 nhãn trên màn hình. Đo trên Chromium headless của container, WebGL vẽ bằng phần mềm. Nhãn là DOM nên không tính vào ngân sách 600 sprite.

**Ảnh "trước" và phép đo** do game-designer chụp bằng một script tạm.
- Ở 3 khung hình: desktop 1280×720, điện thoại dọc 390×844, điện thoại ngang 844×390 (`isMobile`, `hasTouch`).
- Mỗi khung hình một thế giới mới, chụp 3 cảnh:
  - `players`: 5 người ở bãi xuất phát (3200, 2400), mỗi người một thú đi theo, một người "(mất kết nối)". Ở ảnh của game-designer, dấu này giả lập bằng cách đổi class và chữ y như `showAway`; script của bước 1 cho người đó rớt mạng thật;
  - `wild`: 7 thú hoang bị thương (`debug:spawnPal`) quanh mình và thú đi theo, ở (4000, 2000);
  - `alpha`: thú đi theo cạnh Voltmouse đầu đàn ở lãnh địa đồng cỏ.
- Phép đo: số cặp nhãn có phần nhìn thấy (chữ, thanh máu có opacity > 0,5) giao nhau.

| Cảnh | Desktop | Điện thoại dọc | Điện thoại ngang |
|---|---|---|---|
| players | 2 cặp (405 px²): "Hiệp" bị "Lv 7 Bubbloon" che, "Minh" bị "Lv 8 Emberpup" che | 6 cặp (1.221 px²) | 6 cặp (1.266 px²) |
| wild | 3 cặp (323 px²): nhãn thú đi theo bị thú hoang cùng loài che | 5-6 cặp (1.814-1.870 px²) | 6 cặp (1.872 px²) |
| alpha | 0-1 cặp (322 px²) tuỳ lúc chụp | 1 cặp (195 px²) | 3 cặp (1.141 px²): nhãn đầu đàn rộng 213 px đè cả "Hiệp" lẫn thú đi theo |

Ảnh nằm trong thư mục nháp của game-designer, chỉ để tham khảo; coder tự chụp lại bằng `npm run shots` ở bước 1:
- `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t5/` (`<khung>-<cảnh>-before.png`, kèm `-protoB.png` của mẫu thử ở Thiết kế mục 7);
- script: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/labels-shots.mjs`.

## Phạm vi

Làm, trong một commit:
- Hàm dàn nhãn thuần `packages/client/src/game/labelLayout.ts`, kèm unit test.
- `labels.ts`:
  - mỗi nhãn có hạng ưu tiên;
  - đo kích thước chỉ khi nhãn đổi;
  - đổi độ cao mượt;
  - thu gọn hoặc ẩn bằng `opacity`;
  - z-index theo hạng.
- `Game.ts`:
  - truyền hạng cho từng nhãn;
  - tính thú đang nhắm;
  - không ghi lại chữ không đổi.
- CSS trong `index.html`.
- Nhóm ảnh `labels` trong `scripts/shots.mjs` (chụp trước và sau).
- Một e2e mới.
- Cập nhật `docs/architecture.md`.
- `docs/design/pals.md` đã được game-designer cập nhật.

KHÔNG làm:
- Không đổi server, `schema.ts`, `messages.ts`, `Profile`.
- Không đổi chữ trên nhãn, kể cả "★ Đầu đàn · …" (e2e `pack leaders:` lọc theo chữ "Đầu đàn"). Không đổi cỡ chữ, màu, hay quy tắc chữ thú hoang chỉ hiện khi bị thương, nổi giận hoặc choáng.
- Không dàn chữ bay (`float`): chúng chỉ sống 1,2 giây và bay lên. Chỉ đặt chúng nằm trên mọi nhãn.
- Không thêm dấu hiệu "thú đang nhắm" trên hình hay trên nhãn. Ở đây thú đang nhắm chỉ là một hạng ưu tiên (đề xuất việc mới ở cuối).
- Không dời nhãn sang ngang, không kẻ đường nối nhãn với chủ, không cho nhãn tụt xuống thấp hơn chỗ của nó (sẽ đè lên đầu chủ).
- Không đổi lớp, z-index của HUD; nhãn vẫn nằm dưới HUD.
- Không sửa các mục của T14 ngoài nhóm `labels`.

## Thiết kế

### 1. Cách chọn và lý do

Dàn nhãn theo hạng ưu tiên. Nhãn quan trọng hơn giữ chỗ trước. Nhãn sau bị vướng thì lần lượt thử 3 cách, dừng ở cách đầu tiên được:
1. **nâng lên** vừa đủ để thoát (tối đa 22 px);
2. **thu gọn**: ẩn chữ, chỉ giữ thanh máu nếu có;
3. **tạm ẩn**.

Có thêm độ trễ chống nhấp nháy.

Các cách đã cân nhắc:

| Cách | Vì sao không chọn |
|---|---|
| Chỉ hiện tên khi ở gần hoặc đang nhắm | Không gỡ được 5 người kèm 5 thú đứng sát nhau; mất tên người khác cả khi màn hình còn chỗ |
| Xếp chồng mọi nhãn thành cột, không giới hạn (kiểu nameplate MMO) | Trên điện thoại thành tháp nhãn cao, xa chủ, không biết nhãn nào của ai |
| Thu nhỏ chữ trên điện thoại | Bớt chồng một ít nhưng không hết, chữ 9-10 px khó đọc |
| Dời nhãn sang ngang | Phải tìm vị trí theo hai chiều; nhãn lệch khỏi đầu chủ còn dễ nhầm hơn nâng lên chút ít |

Mẫu thử của cách đã chọn (mục 7) đưa cả 9 ảnh về 0 cặp chồng. Mỗi cảnh ẩn tối đa 1 nhãn và thu gọn tối đa 2 nhãn.

### 2. Thứ tự ưu tiên

Bảng `LABEL_RANK`, số nhỏ quan trọng hơn:

| Hạng | Tên | Nhãn nào | Lý do |
|---|---|---|---|
| 0 | `me` | người chơi của mình | Mốc để tìm mình giữa 5 nhân vật giống nhau |
| 1 | `aimed` | thú hoang mà bóng sẽ bay tới lúc này: con gần nhất trong `THROW_RANGE` (180 px), cùng luật với `throwBall()`, bỏ con đang trong bóng. Gồm cả đầu đàn và trùm | Máu và dấu 💫 của nó quyết định lúc ném bóng |
| 2 | `follower` | thú **đi theo** của mình (`companion.ownerId === room.sessionId && mode === "follow"`) | Máu của nó quyết định có nên rút lui |
| 3 | `leader` | thú đầu đàn, trùm | Nguy hiểm. Thanh máu đầu đàn chỉ có trên nhãn |
| 4 | `player` | người chơi khác, kể cả đang "(mất kết nối)" | |
| 5 | `companion` | thú của người khác, thú làm việc của mình | |
| 6 | `wild` | thú hoang khác (chỉ khi đang hiện chữ hoặc thanh máu) | |
| 7 | `camp` | trại | Hình trại và cờ màu chủ vẫn còn |

- **Nhãn ghim** là nhãn hạng 0-3 (`PINNED_RANK = LABEL_RANK.leader`): không bao giờ bị ẩn, được nâng tới 48 px, và xếp **từ trước ra sau**: nhãn có điểm neo thấp hơn trên màn hình (chủ đứng trước) giữ chỗ, nhãn phía sau nâng lên. Bằng nhau thì xét hạng, rồi thứ tự tạo.
  - Lý do: hai nhãn ghim vướng nhau thì nhãn phía sau chỉ cần nâng ít nhất.
  - Mẫu thử biến thể A (xếp ghim theo hạng, giới hạn 22 px) còn 1 cặp chồng ở 4 trong 6 cảnh có đo: "Hiệp" với thú đi theo, thú đi theo với thú đang nhắm. Biến thể B (từ trước ra sau, 44 px) thì 0 cặp ở mọi cảnh.
- **Nhãn thường** (hạng 4-7) xếp theo hạng, rồi theo thứ tự tạo (cũ trước). Không xếp theo khoảng cách hay vị trí, vì hai con ngang nhau mà đổi chỗ liên tục sẽ làm nhãn nhảy qua lại.
- Hạng có hiệu lực mỗi khung hình: nhãn của thú đang nhắm lấy hạng `aimed`, nhãn khác giữ hạng gốc.
- **Thanh máu:** thanh máu của mình, thú đi theo, thú đang nhắm và đầu đàn/trùm luôn hiện. Thanh máu của nhãn khác hiện khi còn chỗ: khi chật, chữ thu lại trước, thanh máu ẩn sau cùng.

### 3. Dàn nhãn mỗi khung hình (`layoutTags`, hàm thuần)

Toạ độ màn hình CSS px, y hướng xuống. Mỗi nhãn có:
- điểm neo (x, y): giữa cạnh dưới của nhãn ở chỗ của nó, chính là điểm hiện nay đặt bằng `translate(-50%, -100%)`;
- kích thước cả nhãn `width × height` và thanh máu `barWidth × barHeight` (0 nếu thanh máu ẩn);
- cờ `named` (chữ đang hiện).

Hằng số, đặt trong `labelLayout.ts`:

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `LABEL_GAP_PX` | 2 | Khoảng trống tối thiểu giữa hai nhãn |
| `LABEL_NUDGE_PX` | 22 | Nhãn thường nâng tối đa ngần này: vừa hơn một nhãn chỉ có tên (17 + 2 = 19). Nhãn có thanh máu (24-25 px) mà cần nâng hơn thì thu chữ, không bay xa chủ |
| `LABEL_PINNED_NUDGE_PX` | 48 | Nhãn ghim: đủ vượt hai nhãn chồng sẵn (24 + 17 + 2×2 = 45), nên 3 nhãn ghim dồn một chỗ vẫn hiện đủ |
| `LABEL_REVEAL_MS` | 250 | Nhãn đang thu gọn hoặc ẩn phải có chỗ liên tục ngần này mới hiện lại |
| `LABEL_LAYOUT_MAX` | 64 | Chặn trên an toàn. Thực tế ≤ 30 nhãn trên màn hình; nhãn thường thứ 65 trở đi bị ẩn ngay |

Các bước:
1. **Sắp xếp** `items[0..count)` tại chỗ bằng insertion sort, ổn định, gần như đã sắp từ khung trước. Không cấp phát gì.
   - Nhãn ghim trước nhãn thường.
   - Giữa hai nhãn ghim: `y` lớn hơn trước, rồi hạng nhỏ hơn, rồi `seq` nhỏ hơn.
   - Giữa hai nhãn thường: hạng nhỏ hơn trước, rồi `seq` nhỏ hơn.
2. **Đặt từng nhãn** theo thứ tự đó. Mỗi nhãn chỉ tránh các nhãn đã đặt trước nó.
   - Không có gì để hiện (`!named && barHeight === 0`, ví dụ thú hoang hiền, không bị thương): không chiếm chỗ. Đặt `form = full`, `rise = 0`, để lúc có chữ thì hiện ngay.
   - Hàm `rise(w, h, cap)`: bắt đầu `off = 0`.
     - Hình chữ nhật thử: trái `x - w/2`, phải `x + w/2`, đáy `y - off`, đỉnh `y - off - h`.
     - Tìm nhãn đã đặt đầu tiên giao với nó, tính cả khe `LABEL_GAP_PX`. Không có thì trả `off`.
     - Có thì `off = y - đỉnh_nhãn_đó + LABEL_GAP_PX` (vừa thoát lên trên nó). Nếu `off > cap` thì trả −1, không thì thử lại.
     - `off` tăng ngặt sau mỗi lần nên vòng lặp luôn dừng.
   - `cap` là `LABEL_PINNED_NUDGE_PX` cho nhãn ghim, `LABEL_NUDGE_PX` cho nhãn thường.
   - Thử lần lượt, dừng ở dạng đầu tiên được (`best`):
     - (a) **full**, nếu `named`: `rise(width, height, cap)`;
     - (b) **compact** (chỉ thanh máu), nếu `barHeight > 0`: `rise(barWidth, barHeight, cap)`. Thanh máu nằm đúng chỗ của nó trong nhãn đầy đủ (ở đáy), nên thu chữ thì thanh máu không nhảy;
     - (c) không dạng nào được: nhãn ghim lấy `compact` nếu có thanh máu, không thì `full`, ở `rise = 0`, đánh dấu `forced = true` (được phép chồng). Nhãn thường lấy **hidden**.
3. **Chống nhấp nháy** (mục 4) cho ra dạng thật `form`.
   - Nếu `form` kém hơn `best` vì đang chờ, nhãn vẫn dùng `rise` của `best`. Dạng kém hơn chiếm ít chỗ hơn: thanh máu nằm trong hình chữ nhật của nhãn đầy đủ.
   - Nhãn không `hidden` thì ghi hình chữ nhật của dạng đó (`left`, `top`, `right`, `bottom`, `placed = true`) cho các nhãn sau tránh.

Ví dụ (đã kiểm bằng tay, dùng làm unit test):
- "Hiệp" (neo 100, 100, cao 17) và nhãn người khác ở (110, 100): người khác nâng 17 + 2 = **19**.
- Thú hoang bị thương đứng trước "Hiệp" 10 px (neo 100, 110, nhãn 80×24, thanh 36×5): nhãn đầy đủ phải nâng 110 − 83 + 2 = 29 > 22, nên **compact** ở `rise` 0. Thanh máu (đỉnh 105) không vướng "Hiệp" (đáy 100, khe 2).
- Thú của người khác ở cùng chỗ đó, không có thanh máu: **hidden**.

### 4. Chống nhấp nháy

Mỗi nhãn nhớ `form` (`full` 0, `compact` 1, `hidden` 2; số lớn là ít hiện hơn) và `holdUntil` (ms). Với `now` của khung hình:
- Nhãn **vừa lên màn hình** (`fresh`), hoặc nhãn ghim đang `hidden` (ví dụ thú vừa trở thành con đang nhắm): `form = best` ngay, `holdUntil = now + LABEL_REVEAL_MS`.
- `best` kém hơn `form` (phải nhường chỗ): đổi **ngay**, `holdUntil = now + LABEL_REVEAL_MS`.
- `best` tốt hơn `form` (có chỗ lại): chỉ đổi khi `now >= holdUntil`. Thời gian chờ không bị đặt lại.
- `best` bằng `form` và `form` khác `full` (vẫn chật): `holdUntil = now + LABEL_REVEAL_MS`, đếm lại từ đầu.

Vì vậy nhãn bị ẩn phải có chỗ liên tục 250 ms mới hiện lại, còn nhãn cần nhường chỗ thì nhường ngay.

Độ cao đổi mượt, làm ở `labels.ts`:
- `drawnRise += (rise − drawnRise) × (1 − e^(−dt / LABEL_EASE_MS))`, với `LABEL_EASE_MS = 60` (95% sau khoảng 180 ms) và `dt` kẹp trong 0-100 ms;
- lệch dưới 0,25 px thì gán bằng `rise`;
- nhãn `fresh` thì gán thẳng.

Hiện, ẩn chữ và nhãn bằng `opacity`, có CSS transition 0,15 s.

### 5. Hiệu năng

- **Số nhãn được dàn:** chỉ nhãn trên màn hình, có hạng, có gì để hiện. Đo được 3-10 nhãn ở các cảnh trên, 26 khi gấp đôi đám thú. Dự trù tối đa khoảng 30: 5 người, 5 thú đi theo, khoảng 10 thú hoang bị thương, đầu đàn, trùm, vài trại.
- **Độ phức tạp:** sắp xếp O(n) khi gần như đã sắp. Đặt nhãn O(n²) phép so hình chữ nhật, với n ≤ 30 là dưới 1.000 phép, cỡ micro giây. `LABEL_LAYOUT_MAX` chặn trường hợp xấu nhất ở 64² phép.
- **Không cấp phát mỗi khung hình** trong phần dàn nhãn:
  - mảng `order` dùng lại;
  - kết quả và hình chữ nhật ghi thẳng vào chính đối tượng `Tag`;
  - insertion sort và hàm so sánh khai báo một lần ở cấp module;
  - không tạo closure hay object trong `update`.
- **Không đọc layout DOM mỗi khung hình:**
  - kích thước nhãn chỉ đo khi nhãn bị đánh dấu `dirty`: vừa hiện lên màn hình, hoặc `MutationObserver` báo đổi class hay chữ;
  - mọi lần đọc dồn vào một pha trước mọi lần ghi, nên tối đa một lần ép layout mỗi khung, và chỉ khi có nhãn đổi;
  - mẫu thử đo lại mọi nhãn mỗi khung tốn 0,50 ms so với 0,23 ms hiện nay. Phần chênh đó là cái quy tắc "chỉ đo khi đổi" bỏ đi.
- **Ghi DOM ít hơn hiện nay:**
  - `transform` chỉ ghi khi toạ độ làm tròn 0,1 px đổi;
  - `opacity` và `z-index` chỉ ghi khi dạng hoặc hạng đổi;
  - `display` ghi như hiện nay.
- **Hình ảnh:** không thêm sprite hay đối tượng PixiJS nào; ngân sách 600 sprite không đổi (các cảnh đo được 286-425 sprite).
- **Điện thoại:** phần thêm là số học trên tối đa khoảng 30 đối tượng mỗi khung, cộng một callback `MutationObserver` khi nhãn đổi. Số phần tử DOM không đổi.

### 6. Điện thoại, bàn phím, chữ

- Không có nút, phím hay thao tác mới. Không có chữ mới cho người chơi.
- Cùng một luật cho mọi khung hình. Điện thoại đông hơn vì zoom nhỏ, nên nâng, thu gọn và ẩn xảy ra nhiều hơn.
- Ngưỡng tính bằng CSS px, đúng với cỡ chữ của nhãn ở mọi thiết bị.
- Nhãn vẫn nằm dưới HUD; nhãn bị HUD che là chuyện của bố cục HUD, ngoài phạm vi.

### 7. Kết quả mẫu thử (biến thể B, đúng như mục 2-3, giới hạn ghim 44 px)

Mẫu thử là script tạm thay `game.labels.update` lúc chạy, đo lại mọi nhãn mỗi khung. Cùng cảnh và cùng lúc với ảnh "trước", trừ cảnh `alpha` chụp ở hai lần đến gần.

| Cảnh | Desktop: cặp chồng / nâng / thu gọn / ẩn | Dọc | Ngang |
|---|---|---|---|
| players | 0 / 2 / 0 / 0 | 0 / 5 / 0 / 1 ("Lv 7 Bubbloon") | 0 / 5 / 0 / 1 |
| wild | 0 / 1 / 2 / 0 | 0 / 3 / 2 / 1 | 0 / 3 / 2 / 1 |
| alpha | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |

- Ở cảnh `players`, cả 5 tên người chơi đều hiện. "Hiệp" đọc được ở mọi ảnh.
- Nhãn thú đang nhắm nâng tối đa 18 px, nhãn thú đi theo tối đa 23 px.
- Chính thức dùng 48 px thay 44 để chắc chắn cho ca 3 nhãn ghim dồn một chỗ (mục 3).

## Kế hoạch triển khai

Thứ tự: bước 1 chụp ảnh "trước" trên code chưa sửa, rồi mới sửa game.

1. **`scripts/shots.mjs`: nhóm ảnh `labels`, rồi chụp "trước".**
   - Thêm cờ `--only <nhóm,...>`:
     - `world`: toàn bộ ảnh hiện có (các vùng, cận cảnh thú, điện thoại);
     - `labels`: nhóm mới;
     - mặc định chụp cả hai.
   - Hàm `labelShots(browser)` chạy lần lượt 3 khung hình. Mỗi khung một context mới, đóng trước khi mở cái sau, như phần điện thoại hiện nay:
     - `desktop`: `{ viewport: { width: 1280, height: 720 } }`;
     - `portrait`: `{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }`;
     - `landscape`: như trên với 844×390.
   - Vào game:
     - chờ `#join-btn:enabled` trước khi điền tên "Hiệp" và bấm (bài học T1);
     - chờ `players.size > 0` và `game.frames > 3`;
     - `debug:setTime { t: 0.3 }`, `debug:givePal { species: "emberpup", level: 8 }`.
   - Bốn người chơi phụ không có trang, vào bằng `new Client(url).joinById(roomId, { name })` (`@colyseus/sdk` có sẵn ở gốc repo):
     - tên "Minh", "Lan Anh", "Tuấn", "Bảo Ngọc";
     - `room.onMessage("*", () => {})` để SDK không in cảnh báo;
     - `debug:teleport` tới (3200, 2400) cộng độ lệch `[-60, 12]`, `[50, -14]`, `[-18, -52]`, `[92, 24]`;
     - `debug:givePal`: leafkit 3, bubbloon 7, pebblet 11, voltmouse 15.
   - Cảnh `players`:
     - teleport mình tới (3210, 2404), dùng `settle`, chờ 3 giây cho thú đi theo tụ lại;
     - cho "Tuấn" rớt mạng thật: `Object.assign(guest.reconnection, { enabled: false }); guest.connection.close(4010)`. Server giữ chỗ 20 giây với `offline = true`, mọi người thấy "Tuấn (mất kết nối)". Game-designer đã thử: SDK không nối lại;
     - chờ 1 giây rồi chụp.
   - Cảnh `wild`:
     - với mỗi `[dx, dy, loài]` trong `[-70,-40,leafkit] [-25,-78,bubbloon] [22,-46,pebblet] [66,-82,voltmouse] [-48,8,leafkit] [40,4,emberpup] [96,-26,bubbloon]`: teleport tới (4000 + dx − 40, 2000 + dy) rồi `debug:spawnPal { species }`. Thú ra đúng 40 px bên phải, máu 1, đứng yên 60 giây;
     - teleport mình tới (4000, 2060), `settle`, chờ 1,5 giây, chụp.
   - Cảnh `alpha`:
     - tìm Voltmouse đầu đàn trong `room.state.pals` (`alpha && speciesId === "voltmouse"`);
     - hồi máu: `debug:give` rồi gửi `eat` 12 lần;
     - teleport tới (đầu đàn.x + 300, đầu đàn.y + 20), ngoài tầm nhìn 170 px; `settle`, chờ 1,5 giây;
     - teleport tới (đầu đàn.x + 105, đầu đàn.y + 20), chờ 1,1 giây, chụp ngay. Đầu đàn đánh đau, chờ lâu hơn là ngất về lửa trại.
   - Tên ảnh `labels-<khung>-<cảnh>.png`.
   - `report.json` thêm cho mỗi ảnh:
     - `labels: { shown, names, hidden, overlapping, area, pairs }`, đo bằng đúng phép đo DOM của e2e (bước 6) cộng diện tích giao. `hidden` là số `.label` đang hiện trên màn hình mà `opacity` của phần tử < 0,5;
     - `counts`: `debugInfo().labels` nếu có (code cũ không có thì ghi `null`);
     - riêng ảnh `wild`: `labelMs`, thời gian trung bình của `game.labels.update` qua 60 khung. Bọc hàm trong trang bằng `performance.now()`, chạy được cả code cũ lẫn mới.
   - In ra dòng tóm tắt như các ảnh khác.
   - Chạy `npm run shots -- --name t5-before --only labels` **trước khi sửa bước 2-5**. Ghi bảng số vào `PROGRESS.md`.
   - Không commit `shots/` (đã có trong `.gitignore`).

2. **`packages/client/src/game/labelLayout.ts`** (mới, thuần, không import DOM hay PixiJS):
   - `export const LABEL_RANK = { me: 0, aimed: 1, follower: 2, leader: 3, player: 4, companion: 5, wild: 6, camp: 7 } as const;` và `export const PINNED_RANK = LABEL_RANK.leader;`. JSDoc nói số nhỏ giữ chỗ trước; hạng ≤ `PINNED_RANK` không bao giờ bị ẩn.
   - `export const TAG_FORM = { full: 0, compact: 1, hidden: 2 } as const;` và `export type TagForm = (typeof TAG_FORM)[keyof typeof TAG_FORM];`. Dùng object `as const`, không dùng `const enum` vì `isolatedModules`.
   - Các hằng số ở Thiết kế mục 3, kèm `LABEL_EASE_MS = 60`, mỗi hằng số có JSDoc một dòng nói lý do (lấy từ bảng).
   - `export interface LayoutItem`:
     - vào: `x`, `y`, `width`, `height`, `barWidth`, `barHeight`, `named`, `rank`, `seq`, `fresh`;
     - giữ qua các khung hình: `form`, `rise`, `holdUntil`;
     - nháp của khung hình: `placed`, `forced`, `left`, `top`, `right`, `bottom`;
     - JSDoc từng nhóm trường.
   - `export function layoutTags(items: LayoutItem[], count: number, now: number): void`: đúng Thiết kế mục 3-4. JSDoc: sắp `items[0..count)` tại chỗ; ghi `form`, `rise`, `placed`, `forced`; **không** xoá `fresh` (người gọi xoá sau khi vẽ); không cấp phát.
   - Hàm phụ cấp module, không phải closure: `comesFirst(a, b)`, `overlaps(...)` theo số nguyên thuỷ, `riseFor(items, i, w, h, cap)`.

3. **`packages/client/src/game/labels.ts`**
   - `Tag` mở rộng `LayoutItem`, thêm:
     - `element`, `at`, `lift`, `visible` (như cũ);
     - `baseRank?: number`: `undefined` là chữ bay, không dàn, vẽ trên mọi nhãn;
     - `name: HTMLElement | null`: `span` tên, lấy lúc đo lần đầu;
     - `dirty`, `shown` (đang `display` hay không);
     - `drawnX`, `drawnY` (khởi tạo `NaN`), `drawnRise`, `drawnForm`, `drawnZ`.
   - `add(element, at, lift, baseRank?: number)`:
     - khởi tạo đủ trường: `form` full, `rise` 0, `seq` tăng dần, `dirty = true`, `shown = false`;
     - đặt `element.style.display = "none"`. Nhãn mới chỉ hiện từ lần `update` đầu, đã đúng chỗ (hiện nay nó nháy ở góc 0,0 một khung);
     - ghi vào `WeakMap<Element, Tag>`.
   - `remove()` như cũ, cộng xoá khỏi map.
   - `float()`: `outer.className = "float"`, thêm không có hạng.
   - Constructor tạo `MutationObserver` trên `root` với `{ subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] }`:
     - mỗi bản ghi: bỏ qua nếu `target === root`;
     - leo từ phần tử của `target` lên con trực tiếp của `root`, tra map, đặt `dirty = true`;
     - chú thích: style do `Labels` tự ghi không thuộc bộ lọc nên không tự kích hoạt lại.
   - `readonly counts = { laidOut: 0, tucked: 0, hidden: 0, measured: 0 }`, JSDoc: cho test và `npm run shots`. `measured` cộng dồn, ba số kia của khung hình vừa rồi.
   - `update(now: number, aimed?: Tag)`, bốn pha:
     1. **Vị trí, không đọc DOM.** Với mỗi tag:
        - tính `at()`, điểm màn hình, có hiện không (giống hiện nay);
        - không hiện: `display = "none"` nếu đang `shown`;
        - vừa hiện: `display = ""`, `shown = dirty = fresh = true`;
        - ghi `x`, `y`;
        - chữ bay (`baseRank === undefined`): ghi transform rồi bỏ qua;
        - còn lại: `rank = tag === aimed ? LABEL_RANK.aimed : baseRank`, đưa vào `this.order[n++]`.
     2. **Đo** các tag `dirty` trong `order`:
        - `name ??= element.querySelector(":scope > span")`, `bar = element.querySelector(":scope > .hp-bar")`;
        - `width = element.offsetWidth`, `height = element.offsetHeight`;
        - `barWidth`, `barHeight` = `offsetWidth`, `offsetHeight` của thanh máu (0 khi `display: none`);
        - `named = nameShows(element.classList)`;
        - `dirty = false`, `counts.measured++`.
        - `nameShows` là hàm cấp module: `!pal || alpha || boss || hurt || angry || dizzy`. JSDoc ghi rõ nó chép luật CSS trong `index.html`: chữ thú hoang chỉ hiện khi bị thương, nổi giận hoặc choáng; đổi CSS thì đổi cả đây.
     3. `layoutTags(this.order, n, now)`.
     4. **Ghi:**
        - `drawnRise` đổi mượt (Thiết kế mục 4), rồi transform `translate(x px, (y − drawnRise) px) translate(-50%, -100%)`, chỉ ghi khi toạ độ làm tròn 0,1 px đổi;
        - khi `form` khác `drawnForm`: `element.style.opacity = form === hidden ? "0" : ""` và `name.style.opacity = form === compact ? "0" : ""`;
        - khi `LABEL_Z_TOP − rank` khác `drawnZ` (`LABEL_Z_TOP = 10`): ghi `zIndex`;
        - đếm `counts`;
        - `fresh = false`;
        - `this.order.length = n` ở cuối để không giữ tag đã xoá.
   - JSDoc của class nêu luật: hạng, nâng, thu gọn, ẩn, chờ hiện lại, đo khi đổi.
4. **`packages/client/src/game/Game.ts`**
   - Import `LABEL_RANK` từ `./labelLayout.ts`.
   - `nameTag(text, className, at, lift, rank: number)` truyền `rank` cho `labels.add`. Các chỗ gọi:
     - người chơi: `isMe ? LABEL_RANK.me : LABEL_RANK.player`;
     - trùm và đầu đàn: `LABEL_RANK.leader`;
     - thú hoang: `LABEL_RANK.wild`;
     - thú ngoài thế giới: `companion.ownerId === this.room.sessionId && companion.mode === "follow" ? LABEL_RANK.follower : LABEL_RANK.companion`. Chú thích: `mode` không đổi suốt đời một companion, server chỉ đặt trong `spawnCompanion`;
     - trại (`syncCamp`): `this.labels.add(label, () => at, 96, LABEL_RANK.camp)`.
   - `onChange` của companion: chỉ gán `text.textContent` khi chữ mới khác chữ cũ. Chú thích: gán lại cùng chữ làm nhãn phải đo lại; tin `onChange` đến khoảng 20 lần mỗi giây.
   - `frame()`, vòng `this.pals.forEach`:
     - tính `const d = focus ? distance(focus, actor.pos) : Infinity` một lần, dùng cho `near` như cũ. Lưu ý: `focus` ở đây là vị trí của mình;
     - khai báo `let aimed: Tag | undefined; let aimedDist = THROW_RANGE;` trước vòng; trong vòng, `if (near && !pal.inBall && d <= aimedDist) { aimedDist = d; aimed = pal.tag; }`. Chú thích: cùng luật chọn thú với `throwBall`;
     - cuối frame gọi `this.labels.update(now, aimed)`.
   - `debugInfo()` thêm `labels: { ...this.labels.counts }`.
5. **`packages/client/index.html`** (CSS):
   - `.label` thêm `transition: opacity 0.15s;`; `.label span` thêm `transition: opacity 0.15s;` (`.label.pal span` vẫn giữ 0,2 s của nó).
   - Thêm `.labels > .float { z-index: 20; }`, chú thích: chữ bay nằm trên mọi nhãn; nhãn có z-index 3-10 theo hạng (`labels.ts`).
6. **`tests/e2e/multiplayer.spec.ts`**: helper và test mới, chi tiết ở mục Test.
7. **`docs/architecture.md`**:
   - Dòng `game/labels.ts`:
     - thêm `game/labelLayout.ts` (hàm thuần có test: hạng `LABEL_RANK`, nhãn ghim, nâng ≤ 22/48 px, thu gọn còn thanh máu, ẩn, chờ 250 ms);
     - kích thước chỉ đo khi nhãn đổi (`MutationObserver`, nên đừng gán lại chữ không đổi);
     - chữ bay nằm trên mọi nhãn;
     - `debugInfo().labels`.
   - Mục e2e: thêm helper `labelOverlaps` vào dòng "Helper".
   - Dòng `npm run shots`: thêm `--only world|labels`.
8. **`PROGRESS.md`:**
   - bảng trước/sau của 9 ảnh: `overlapping`, `area`, `hidden`, `names`, `labelMs`;
   - kết quả `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`, `emptyProfile`, `sanitizeProfile`. Không có hook `debug:*` mới. Server không sửa gì.
- API nội bộ client đổi: `Labels.add(..., baseRank?)`, `Labels.update(now, aimed?)`, `Game.nameTag(..., rank)`, `Game.debugInfo().labels`. `window.__petgame` giữ nguyên.

## Test

**Unit: `packages/client/src/game/labelLayout.test.ts`** (chạy trong Node như `reconnect.test.ts`)
- Helper `tag({...})` tạo `LayoutItem` với mặc định: `named: true`, không thanh máu, `fresh: true`, `form: full`, `rise: 0`, `holdUntil: 0`.
- Helper `frame(items, now)` gọi `layoutTags(items, items.length, now)` rồi đặt `fresh = false` cho mọi tag, như `labels.ts`.

| # | Ca | Dữ liệu | Mong đợi |
|---|---|---|---|
| 1 | Nhãn trước giữ chỗ, nhãn sau nâng vừa đủ | me (100, 100, 40×17); player (110, 100, 60×17), đưa vào mảng theo thứ tự [player, me] | me full, rise 0; player full, rise 19 |
| 2a | Quá chật để nâng: có thanh máu thì thu gọn | me như trên; wild (100, 110, 80×24, thanh 36×5) | wild compact, rise 0 |
| 2b | Không có thanh máu thì ẩn | me như trên; companion (100, 110, 80×17) | companion hidden |
| 3 | Nhãn ghim xếp từ trước ra sau, không ẩn | follower (100, 104, 80×16); me (100, 100, 40×17); aimed (100, 100, 80×24, thanh 36×5) | thứ tự follower, me, aimed; cả ba full; rise 0, 14, 33 |
| 4 | Nhãn ghim thứ tư không vừa thì bị ép, không ẩn | thêm vào ca 3 leader (100, 100, 120×27, thanh 52×6) | leader compact, `forced`, rise 0 |
| 5 | Thú vừa thành con đang nhắm thì hiện ngay dù đang ẩn | khung 1 (now 0): me như ca 1 và wild 80×17 không thanh máu ở (100, 110), wild hidden; khung 2 (now 16): cùng chỗ, `rank = aimed` | wild full, rise 29 ngay ở khung 2 |
| 6 | Chờ hiện lại 250 ms; khung chật thì đếm lại | me và companion như ca 2b. Khung 0, 50, 100 chật; từ 150 trở đi dời me sang x = 400; chạy các khung 150, 300, 349, 350 | companion hidden ở 150, 300, 349; full ở 350. Biến thể: chật lại ở khung 200 thì còn hidden ở 350 và 449, full ở 450 |
| 7 | Thú hoang hiền không chiếm chỗ | me (100, 100); wild `named: false`, không thanh máu, cùng chỗ; player 60×17 ở (100, 100) | player rise 19 (chỉ tránh me); wild `placed === false` |
| 8 | Cùng hạng thì nhãn cũ giữ chỗ, bất kể thứ tự trong mảng | hai wild có thanh máu cùng chỗ, seq 5 và 9, thử cả [9, 5] lẫn [5, 9] | seq 5 full, rise 0; seq 9 hidden ở cả hai thứ tự (cần nâng 26 > 22, thanh máu cũng vướng) |
| 9 | Đám đông ngẫu nhiên (`mulberry32(1234)` của `@petgame/shared`) | 300 cảnh × 25 nhãn: x 0-360, y 40-300, rộng 40-200; một nửa có thanh máu (cao 24, thanh 36×5), còn lại cao 17; tag 0 là me; tối đa một aimed, một follower, một leader; còn lại player, companion, wild, camp; 10% wild hiền | mọi cặp nhãn `placed` có hình chữ nhật giao nhau (rộng và cao giao > 0) thì ít nhất một nhãn `forced`; me luôn full; rise ≤ 22 (thường), ≤ 48 (ghim); nhãn ghim không bao giờ hidden |
| 10 | Chặn trên | 80 nhãn thường cách xa nhau (x = 300·i, không chạm nhau) | 64 nhãn đầu theo thứ tự đã sắp full, từ nhãn thứ 65 đều hidden |
| 11 | Tất định | chạy ca 9 hai lần trên bản sao | cùng `form` và `rise` |

**Tích hợp server:** không đổi, server không sửa gì. `GameRoom.test.ts` phải qua nguyên vẹn.

**E2E: `tests/e2e/multiplayer.spec.ts`**
- Helper cấp module `labelOverlaps(page)`, đặt cạnh `partyOf`/`sendFrom`. JSDoc: các cặp nhãn có phần nhìn thấy giao nhau.
  - Trong trang, với mỗi `.labels > .label` không `display: none` và `getComputedStyle(el).opacity >= 0.5`, lấy các phần:
    - `span` tên, nếu opacity tính được > 0,5;
    - `.hp-bar`, nếu `display` khác `none`;
    - dùng `getBoundingClientRect()`.
  - Hai nhãn chồng nhau khi có hai phần giao nhau **hơn 1 px theo cả hai chiều**. Kích thước đo làm tròn, khe 2 px, nên lệch tối đa khoảng 1 px.
  - Trả mảng chuỗi `"<chữ A> | <chữ B>"`, để khi lỗi biết ngay cặp nào. Bỏ qua chữ bay (không có class `label`).
- Test `labels: in a crowd on a phone, no name tag covers another, and mine, my pal's and the aimed pal's stay shown`, `test.slow()`:
  1. `join(browser, "Hiệp", "/", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })`, `waitForWorld`, chờ `frames > 0`. Lấy `roomId`.
  2. `sendFrom(page, "debug:givePal", { species: "emberpup", level: 8 })`.
  3. Bốn `observer(roomId, name)` với tên, độ lệch quanh (3200, 2400) và thú như bước 1 của kế hoạch. Mỗi người `send("debug:teleport", ...)` và `send("debug:givePal", ...)`. Không cho ai rớt mạng ở đây: một phòng đã đóng thì `leave()` trong `afterEach` có thể để lại promise lỗi.
  4. Hai thú hoang bị thương sát mình:
     - teleport tới (3180 − 40, 2380) rồi `debug:spawnPal { species: "leafkit" }`;
     - teleport tới (3245 − 40, 2368), spawn lần nữa;
     - teleport mình tới (3210, 2404).
  5. `await expect.poll(() => labelOverlaps(page), { timeout: 20_000 }).toEqual([])`. Chờ 30 khung hình rồi kiểm `labelOverlaps(page)` vẫn `[]` (ổn định, không chỉ trúng một khoảnh khắc). Trên code cũ bước này hỏng với khoảng 6 cặp, ví dụ "Hiệp | Lv 7 Bubbloon".
  6. Nhãn `.label.me`: phần tử `opacity` "1" và `span` `opacity` "1". Nhãn `.label.companion` có chữ "Lv 8 Emberpup": như trên.
  7. Thú đang nhắm, tính trong trang:
     - con gần nhất trong 180 px tính từ `game.me().pos`, trong `game.pals`, bỏ `inBall`;
     - nhãn `tag.element` của nó có `opacity` "1";
     - nếu nó có class `hurt` thì `.hp-bar` không `display: none`.
  8. Đo khi không có gì đổi:
     - đọc `game.debugInfo().labels.measured`, chờ 60 khung hình, đọc lại: tăng ≤ 10;
     - đo lại mỗi khung sẽ là khoảng 600. Thú hoang đi ngang mép màn hình có thể thêm vài lần.
- Các e2e đang có phải qua mà không sửa:
  - `pack leaders:` dùng `toBeVisible`; với Playwright, `opacity: 0` vẫn tính là thấy, và đầu đàn không bao giờ bị ẩn;
  - `connection: a friend sees…` dùng `toHaveText`, chữ không đổi;
  - `.label.pal.dizzy`, `.label.base`, `.label.me` dùng đếm phần tử và chữ.

**Ảnh và hiệu năng (tester):**
- Chạy `npm run shots -- --name t5-after --only labels` sau khi sửa, so với `t5-before` của bước 1.
- Ghi bảng 9 ảnh vào `PROGRESS.md`; xem kỹ ảnh điện thoại dọc và ngang.

**Lệnh:** `npm run typecheck`, `npm test` (một file: `npx vitest run packages/client/src/game/labelLayout.test.ts`), `npm run build`, `npm run test:e2e` (một test: `npx playwright test -g "labels:"`).

## Tiêu chí hoàn thành

- [ ] `labelLayout.ts` thuần, không import DOM hay PixiJS: hạng `LABEL_RANK`, nhãn ghim hạng 0-3, các hằng số và luật đúng Thiết kế mục 2-4. Unit test 11 ca ở trên qua.
- [ ] Nhãn ghim (mình, thú đang nhắm, thú đi theo, đầu đàn/trùm) không bao giờ bị ẩn, xếp từ trước ra sau. Nhãn thường xếp theo hạng rồi thứ tự tạo; nâng ≤ 22 px, rồi thu gọn còn thanh máu, rồi ẩn.
- [ ] Nhãn đã thu gọn hoặc ẩn chỉ hiện lại sau 250 ms có chỗ liên tục. Nhãn mới lên màn hình hiện ngay. Độ cao đổi mượt (60 ms).
- [ ] Thú đang nhắm tính trong vòng thú hoang sẵn có của `frame()`, cùng luật với `throwBall` (gần nhất trong `THROW_RANGE`, bỏ con trong bóng). Không thêm vòng duyệt riêng.
- [ ] Kích thước chỉ đo khi nhãn đổi hoặc vừa hiện; mọi lần đọc layout dồn trước mọi lần ghi. Companion không gán lại chữ không đổi. E2E kiểm `measured` tăng ≤ 10 trong 60 khung yên.
- [ ] Phần dàn nhãn không cấp phát mỗi khung hình: mảng dùng lại, insertion sort, hàm cấp module, kết quả ghi vào `Tag`. `transform`, `opacity`, `z-index` chỉ ghi khi đổi.
- [ ] Chữ bay không được dàn và nằm trên mọi nhãn.
- [ ] Không đổi server, schema, tin nhắn, dữ liệu lưu, chữ trên nhãn.
- [ ] `npm run shots -- --only labels` chụp đủ 9 ảnh ở 1280×720, 390×844, 844×390. Ảnh sau so với trước:
  - mọi ảnh 0 cặp chồng. Ngoại lệ duy nhất được phép là hai nhãn ghim cùng bị ép, phải ghi rõ trong `PROGRESS.md`;
  - "Hiệp" hiện đủ chữ ở mọi ảnh;
  - tối đa 2 nhãn ẩn mỗi ảnh;
  - `labelMs` không quá 1,5 lần số "trước" đo cùng máy, cùng lần chạy.
- [ ] E2E mới qua; toàn bộ `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch, không nới lỏng hay bỏ qua test nào.
- [ ] `docs/architecture.md` cập nhật (labels, labelLayout, helper `labelOverlaps`, `--only`). `docs/design/pals.md` khớp với code (game-designer đã viết mục "Nhãn tên và thanh máu"; triển khai buộc phải khác thì coder sửa và ghi lý do vào `PROGRESS.md`).

## Rủi ro, câu hỏi mở

Không có dòng "CHẶN:". Thay đổi chỉ ở client, không động tới dữ liệu người chơi, bỏ đi dễ dàng.

- **Nhãn nâng lên có thể bị nhầm chủ** khi hai con cùng loài đứng sát nhau. Ví dụ mẫu thử: nhãn "Lv 2 Emberpup" (con đang nhắm) nằm trên "Lv 8 Emberpup" (thú đi theo), và thanh máu của con đang nhắm nằm giữa hai chữ.
  - Giảm bằng giới hạn nâng nhỏ (22 px) và xếp nhãn ghim từ trước ra sau. Thú đi theo có vòng màu chủ dưới chân.
  - Dấu hiệu "thú đang nhắm" sẽ gỡ hẳn (đề xuất ở cuối).
- **Tên người khác hoặc chữ "(mất kết nối)" có thể tạm ẩn** khi rất đông. Chấp nhận: hình người đang chờ vẫn mờ đi (T3); ở mọi ảnh mẫu thử, cả 5 tên người đều hiện, chỉ nhãn thú của người khác bị ẩn.
- **`nameShows` chép luật CSS** (chữ thú hoang chỉ hiện khi bị thương, nổi giận, choáng). Đổi CSS mà quên đổi hàm thì nhãn có thể chiếm chỗ dù không hiện chữ, hoặc ngược lại. Đã ghi chú hai chiều, chỉ một chỗ.
- **`opacity` thay vì `display` hay `visibility`** để thu gọn và ẩn (có chuyển mượt). Playwright vẫn coi phần tử `opacity: 0` là "thấy được", nên test cần kiểm ẩn thì đọc `opacity`, như e2e mới.
- **Nhãn bị HUD che** trên điện thoại ngang (ví dụ nhãn đầu đàn dưới bảng trạng thái): ngoài phạm vi, thuộc bố cục HUD.
- **Số đo thời gian chỉ là tương đối:** Chromium headless vẽ phần mềm, CPU dùng chung. Chỉ so trước/sau trong cùng một lần chạy, không đặt ngưỡng tuyệt đối trong CI.

## Đề xuất cho TASKS.md

- **P2, việc mới: đánh dấu thú đang nhắm.** Giữa đám đông, người chơi không biết bóng (E/Bắt) và đòn đánh sẽ trúng con nào. T5 đã tính sẵn con đó mỗi khung hình (gần nhất trong `THROW_RANGE`, cùng luật với `throwBall`) và ưu tiên nhãn của nó. Thêm một dấu nhỏ: vòng mảnh dưới chân hoặc viền sáng cho nhãn. Cũng gỡ được chuyện nhầm nhãn khi nhãn bị nâng.
- **Ghi chú cho T14:** `scripts/shots.mjs` đã có cờ `--only` và nhóm `labels` (đám đông ở 3 khung hình, kèm số cặp nhãn chồng và `labelMs`). Ảnh mới của T14 nên vào nhóm `world` hoặc một nhóm riêng.
