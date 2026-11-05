# PLAN: T6 Thông báo che HUD: chỗ đặt, hàng đợi và mức ưu tiên

## Mục tiêu

- **Đọc được thông báo quan trọng.** Hiện toast chỉ có một ô, tin đến sau thay tin trước. Nhiều tin quan trọng gần như không kịp vẽ. Ví dụ: phần thưởng trùm (chỗ duy nhất báo tên món đồ hiếm) và tin lên cấp đến liền nhau trong cùng một tick. Sau nhiệm vụ, người chơi luôn đọc đủ các tin: lên cấp và chiêu mới, phần thưởng trùm, "Bắt được …", "Xong nhiệm vụ …", tin ★ về thú đầu đàn.
- **Thông báo không che HUD** ở cả 3 khung hình (desktop 1280×720, điện thoại dọc 390×844, điện thoại ngang 844×390). HUD gồm hàng máu, trạng thái, nhiệm vụ, nút bên phải, bản đồ nhỏ, thanh máu trùm, thanh chiêu và nút cảm ứng. Trên điện thoại dọc không còn khối 5 dòng đè góc trên bên trái.
- **Điện thoại ngang:** cột HUD bên trái không còn che nhãn tên quanh nhân vật.
- **Bắt thú không bị lộ kết quả.** Tin lên cấp do bắt thú không đến khi bóng còn đang lắc.

## Hiện trạng

Đo trên commit `deb0950`.

**Một ô duy nhất.** `Hud` (`packages/client/src/ui/hud.ts`) có một `div.hud-toast` (dòng 27). CSS ở `index.html:109-111`:
- `position: absolute; top: 12px; left: 50%; transform: translateX(-50%)`, chữ 18 px, đệm 8×14;
- không có `max-width`, nhưng `left: 50%` làm bề rộng tối đa còn một nửa màn hình. Ở 390 px, ô chỉ rộng 195 px nên câu dài xuống 5 dòng.

`showToast(text, ms = 2000)` (dòng 136-141) ghi chữ, bật class `visible`, đặt lại hẹn giờ:
- tin sau luôn thay tin trước;
- chữ còn nằm trong ô sau khi mờ đi (e2e `levels:` dựa vào điều này).

**Mọi chỗ gọi phía client** (13 chỗ):

| Chỗ | Chữ | Thời gian hiện nay |
|---|---|---|
| `hud.ts:55` | "Đã chép link mời 🔗" (hoặc chính link nếu không chép được) | 2 s |
| `Game.ts:281` (thanh chiêu, `skillbar.ts:116`) | "🔒 {chiêu}: thú học ở cấp {n}" | 2 s |
| `Game.ts:324` | "✅ Đã kết nối lại" | 2 s |
| `Game.ts:439` → `tip()` `:1057` (trễ 600 ms, mỗi phiên một lần) | "💫 Thú đang choáng: ném bóng (E) để dễ bắt, hoặc đánh thêm để hạ gục lấy đồ" (76 ký tự, cả trên cảm ứng) | 4,5 s |
| `Game.ts:688` (lúc bóng khép, khoảng `captureRevealMs` sau khi nhận `CaptureResult`) | "Bắt được {thú}! 🎉" / "{thú} thoát ra rồi ({n}%)" | 2 s |
| `Game.ts:795` (`Notice` bắt đầu bằng "Xong nhiệm vụ", trễ `QUEST_DELAY_MS` 2.100 ms) | "Xong nhiệm vụ "…"! {thưởng}" | 3 s |
| `Game.ts:796` (mọi `Notice` khác) | 30 tin còn lại của server, bảng ở mục Thiết kế 4 | 2 s |
| `Game.ts:807` (`LevelUp` của mình) | "{thú} lên cấp {n}! ⭐" (+ " Học được chiêu mới: …") | 2 s (có chiêu: 3,2 s) |
| `Game.ts:1094` | "Không có thú nào ở gần" | 2 s |
| `Game.ts:1103` (`throwBlocker`) | "Không thể bắt trùm! Hãy cùng nhau hạ nó" / "Túi thú đầy (30/30): …" | 3 s |
| `Game.ts:1169` | "Đến {vùng} ({khí hậu})" | 2 s |
| `Game.ts:1187` | "★ Lãnh địa của {thú} đầu đàn (Lv {n}): nó tấn công ai lại gần!" | 3,5 s |
| `Game.ts:1306` | "Chưa có 🔵 Bóng xịn. Chế tạo ở trại (phím C)" | 2 s |

Server gửi 31 tin `Notice`: 29 qua `notify` cho một người, 2 qua `announce` cho cả thế giới. Tin chỉ có `text`, không có loại.

**Đo hộp bao của toast** (ảnh "trước", toast dài giữ nguyên trên màn hình):

| Khung | Hộp toast | Dòng | Đè lên |
|---|---|---|---|
| desktop 1280×720 | 640×58 tại (320, 12) | 2 | hàng máu 152×58; thanh máu trùm 420×35 |
| dọc 390×844 | 195×121 tại (98, 12) | 5 | hàng máu 164×56, trạng thái 164×48, nhiệm vụ 151×9, nút Chế tạo 3×27; thanh máu trùm 195×35 |
| ngang 844×390 | 422×58 tại (211, 12) | 2 | hàng máu 261×58, bản đồ nhỏ 57×58; thanh máu trùm 420×35 |

**Điện thoại ngang.** Cột trái (`.hud-left`) rộng 460 px, tức đến x = 472, đã quá giữa màn hình (x = 422, chỗ nhân vật đứng). Cột cao tới y = 188 trên màn hình cao 390. Ở ảnh `shots/t5-r2-labels/labels-landscape-*.png`:
- "Tuấn (mất kết nối)" nằm dưới ô trạng thái;
- nhãn và thanh máu thú đầu đàn nằm dưới ô nhiệm vụ.

**Các chỗ đè đã biết** (REVIEW của T4, cộng ba chỗ tìm thêm ở lần này):

| # | Tình huống | Chuyện gì xảy ra |
|---|---|---|
| a | Bắt thú khi có thú đi theo | `handleThrow` cộng kinh nghiệm bắt ngay lúc ném. Tin `LevelUp` (toast, lấp lánh, tiếng lên cấp, chữ bay tên chiêu) đến khi bóng còn bay: lộ kết quả sớm 1,9 s. Lúc bóng khép, "Bắt được…" thay toast lên cấp |
| b | Hạ trùm | `defeatBoss` gửi tin phần thưởng rồi `grantXp(BOSS.xp)` trong cùng tick. Hai tin đến liền nhau, toast phần thưởng gần như không kịp vẽ. Xảy ra mỗi khi thú lên cấp: luôn luôn nếu thú ở cấp ≤ 7, 85% ở cấp 8, 61% ở cấp 10. Sau đó "Xong nhiệm vụ "Hạ Vua Đá Boulderhorn"" (trễ 2,1 s) cắt ngắn toast lên cấp có chiêu mới (3,2 s) |
| c | Thú đi theo ra đòn kết liễu trùm | `grantXp(XP_PER_HIT)` (`GameRoom.ts:829`, `:1473`) chạy sau `hitWild` → `defeatBoss`, có thể gây tin `LevelUp` thứ hai đè chữ "Học được chiêu mới" (khoảng 2%) |
| d | Bắt thú đầu đàn | Tin ★ và `ALPHA.xp` chung hẹn giờ `reveal + 300`, client hiện "Bắt được…" lúc bóng khép. Máy dưới 10 khung hình/giây (client kẹp mỗi khung hình ở 100 ms) hoặc mạng giật quá 300 ms thì "Bắt được…" đến sau và thay toast lên cấp. Tin ★ và `LevelUp` đến cùng tick nên người ném gần như không thấy tin ★ |
| e | Nhiệm vụ cuối (bắt thú đầu đàn) | "Xong nhiệm vụ" hiện lúc ném + 2,1 s, tin ★ đến lúc + 2,2 s và thay nó: hiện khoảng 0,1 s |
| f | Con thú đầu tiên (mới tìm ra) | "Bắt được Leafkit! 🎉" (1,9 s) bị "Xong nhiệm vụ "Bắt con thú đầu tiên"" (2,1 s) thay sau 0,2 s. Đây là khoảnh khắc đầu tiên của người chơi mới |
| g | Lên núi tuyết (mới tìm ra) | "Đến ❄️ Núi tuyết" bị cảnh báo lạnh (72 ký tự) thay ngay. Cảnh báo lạnh lại bị "Xong nhiệm vụ "Lên núi tuyết"" cắt lúc 2,1 s |
| h | Toast trùm kèm "+250 XP" | 4-5 dòng ở 390×844. Câu còn xuống dòng giữa "+🫐" và "10" |
| i | Ngoài phạm vi (mới tìm ra) | Thanh máu trùm đè hàng máu của người chơi: dọc 184×35 (che thanh máu của mình), ngang 260×35, desktop 42×35. Đề xuất việc riêng T30 (cuối file); T6 chỉ sửa bản ngang vì cột trái ngang đổi |

**Ảnh và script** (thư mục nháp của game-designer, chỉ để tham khảo):
- thư mục: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t6/`;
- ảnh "trước": `<khung>-<cảnh>-before.png`, với khung là `desktop|portrait|landscape` và cảnh là `tip|boss|skill|climate`; cảnh đông người: `<khung>-<single|bossPair|catchPair>-crowd-before.png`;
- mẫu thử của bố cục chọn ở Thiết kế 1: `<khung>-<cảnh>-protoF.png` (chỉ chèn CSS, có thanh máu trùm);
- script: `toast-shots.mjs` (ảnh trước), `proto-final.mjs` (mẫu thử), `toast-shots-after.mjs` (ảnh sau, gọi đúng API mới `hud.showToast(text, level)`), `queue-sim.mjs` (mô phỏng luật hàng đợi trên các tình huống ở bảng trên).

## Phạm vi

Làm, trong một commit:
- **Client:**
  - hàng đợi thông báo thuần `ui/toastQueue.ts` kèm unit test;
  - `Hud` vẽ chồng tối đa 2 thông báo trong cột trái;
  - CSS bố cục cho 3 khung hình, thu gọn cột trái và thanh máu trùm khi điện thoại ngang;
  - gắn mức cho mọi chỗ gọi;
  - mẹo "thú choáng" có chữ riêng cho cảm ứng.
- **Giao thức:** `NoticeMessage.kind` (bắt buộc). Server gắn loại cho cả 31 tin.
- **Server:**
  - kinh nghiệm bắt thú trả khi bóng khép, chung một hẹn giờ với tin ★ (hằng số `CAPTURE_NEWS_DELAY_MS`);
  - chữ phần thưởng trùm dùng `rewardText`;
  - rút gọn chữ cảnh báo lạnh/nóng;
  - `rewardText` không cho xuống dòng giữa biểu tượng và số.
- **Test:** unit, tích hợp server, e2e (4 test mới, sửa 9 chỗ chọn `.hud-toast`).
- **Tài liệu:** coder sửa `docs/architecture.md`. Game-designer đã viết `docs/design/hud.md` (mới) và sửa `docs/design/pals.md` (kinh nghiệm bắt thú trả khi bóng khép).

KHÔNG làm:
- Không đổi thứ tự `XP_PER_HIT` của đòn thú đi theo (lý do ở Thiết kế 5c).
- Không đổi lúc server hoàn thành nhiệm vụ. Không đổi `QUEST_DELAY_MS`.
- Không dời thanh máu trùm trên điện thoại dọc và desktop (việc mới T30). Chỉ thu hẹp nó khi điện thoại ngang.
- Không đổi cỡ nút cảm ứng (`.eat-btn`, `.sound-btn`... là việc của T18).
- Không đổi dàn nhãn tên (T5). Không thêm nhóm ảnh vào `npm run shots` (ghi cho T14). Không gom chữ (T12).
- Không đổi lúc phát âm thanh hay hiệu ứng.
- Không đổi chữ lên cấp, "Bắt được …", "thoát ra rồi", lãnh địa thú đầu đàn, "Đã thả", "Túi thú đầy", "Rương báu", "Đã kết nối lại" (e2e và test server lọc theo các chữ này).
- Không bỏ tin ★ lặp với "Bắt được…" cho người ném (ghi ở việc mới).

## Thiết kế

### 1. Chỗ đặt: ngay dưới ô nhiệm vụ, trong cột trái

Các cách đã thử bằng ảnh và số đo:

| Cách | Kết quả |
|---|---|
| Giữ giữa trên, chỉ giới hạn bề rộng | Điện thoại dọc không còn chỗ trống ở trên: cột trái chiếm x 12-262, nút bên phải từ x 290. Desktop: cột trái rộng 460 px nên ô giữa trên chỉ còn 312 px, lại trùng thanh máu trùm |
| Giữa dưới, trên thanh chiêu | Điện thoại có cần điều khiển và nút cảm ứng ở đó |
| Giữa trên khi ngang (giữa cột trái và bản đồ) | Còn 240 px, câu dài thành 3-4 dòng, 2 thông báo chạm nhãn của nhân vật (y 135) và trùng thanh máu trùm |
| **Cột trái, ngay dưới ô nhiệm vụ** (chọn) | Một luật cho cả 3 khung hình. Cột cao bao nhiêu thì thông báo tự xuống theo, nên không bao giờ đè lên ô của cột. Cột vốn rộng vừa đủ để không chạm nút bên phải và bản đồ |

Số đo của mẫu thử, chèn đúng CSS ở bước 9 vào game thật, có hiện thanh máu trùm:

| Khung | Cột trái (sau T6) | Thông báo | Đè HUD |
|---|---|---|---|
| desktop | x 12-472, đáy 271 | 2 cái, x 12-432, y 277-383 | 0 |
| dọc | x 12-262, đáy 181 | 2 cái, x 12-262, y 185-311; nhãn tên của mình ở y 362 | 0 |
| ngang | x 12-312 (trước: 472), đáy 182 | 1 cái, x 12-312, y 186-230 | 0; thanh máu trùm x 322-522 không còn đè cột |

Chi tiết:
- `.hud-toasts` là con của `.hud-left`, `order: 10`. Lý do: `QuestTracker` gắn ô nhiệm vụ vào cột **sau** khi `Hud` dựng xong, nên dùng thứ tự flex để thông báo luôn nằm cuối. Mẫu thử đặt nó lên đầu DOM mà vẫn hiện cuối.
- Mỗi thông báo rộng theo chữ, tối đa bằng cột (desktop tối đa 420 px để chừa nhãn của đám đông quanh nhân vật). Chữ đậm 15 px (điện thoại 13 px), dòng cao 1,3, nền `rgba(0,0,0,0.72)`, bo 8 px. Mức cao có viền vàng 4 px bên trái (`#ffca28`, cùng màu viền ô nhiệm vụ). Khi hiện thì trượt nhẹ xuống và rõ dần trong 0,15 s; khi hết thì mờ trong 0,2 s rồi bị xoá.
- z-index 4: nằm trên bảng Thú, Chế tạo, Tủ đồ (3). Lý do: trên điện thoại dọc các bảng mở từ y 172 phủ gần hết bề ngang, mà tin "Đã thả …", "Đã làm …" lại đến đúng lúc bảng đang mở. Thông báo nằm dưới bản đồ phóng to (4, vẽ sau), hộp xác nhận (5) và màn mất kết nối (6). Không nhận chạm.
- **Số thông báo cùng lúc** (`toastRoom(width, height)`):
  - 1 khi màn hình cao ≤ 520 px (điện thoại ngang; cùng ngưỡng với media query đang có), để góc ngón cái trái trống cho cần điều khiển;
  - 1 khi màn hình dọc thấp hơn 760 px, vì cột trái nằm ngay trên đầu nhân vật. Tính: đáy cột khoảng 181 + 2 thông báo khoảng 130, nên 311 phải nằm trên nhãn của nhân vật, ở khoảng nửa chiều cao − 60. Vậy cần cao hơn 742 px. Safari trên iPhone khi có thanh địa chỉ chỉ cao khoảng 664 px nên được 1; Playwright 390×844 được 2;
  - còn lại 2.
- **Điện thoại ngang** (thêm vào khối `@media (max-height: 520px) and (min-width: 601px)` đang có):
  - cột trái tối đa 300 px; chữ hàng máu, trạng thái, nhiệm vụ cỡ như điện thoại dọc (12/11 px), thanh máu 64 px;
  - ẩn tên vùng (`.hud-region`, điện thoại dọc vốn đã ẩn; khi vào vùng mới vẫn có thông báo "Đến …");
  - ẩn dòng "Thưởng" của nhiệm vụ, giữ dòng gợi ý;
  - cột kết thúc ở x = 312, nhỏ hơn giữa màn hình − 100 = 322, nên nhãn trong khoảng ±100 px quanh nhân vật không bao giờ nằm dưới cột;
  - thanh máu trùm rộng 200 px, chữ 12 px, nằm ở x 322-522, giữa cột (312) và bản đồ (576);
  - không đổi cỡ nút "Ăn" và 🔊: T18 sẽ nâng lên 44 px.

### 2. Ba mức

| Mức (`ToastLevel`) | Gồm | Ít nhất |
|---|---|---|
| `high` | lên cấp (kèm chiêu mới), "Bắt được …", `Notice` loại `reward`, `quest`, `news` | 3.000 ms |
| `normal` | mẹo, lãnh địa thú đầu đàn, "thoát ra rồi", "✅ Đã kết nối lại", `Notice` loại `done`, `warning` | 2.500 ms |
| `low` | phản hồi khi bấm mà không làm được (client và `Notice` loại `refused`), "Đến {vùng}", "Đã chép link mời" | 1.800 ms |

Nguyên tắc chia mức:
- **cao**: tiến triển hoặc phần thưởng, bỏ lỡ là mất thông tin;
- **thường**: game chủ động báo (mẹo, cảnh báo, xác nhận);
- **thấp**: phản hồi tức thời cho một lần bấm, hoặc tin vặt; chỉ lần bấm mới nhất là đáng đọc.

### 3. Luật hàng đợi (`ToastQueue`, hàm thuần, thời gian truyền vào)

Số liệu trong bảng `TOAST`:

| Hằng | Giá trị | Lý do |
|---|---|---|
| `maxVisible` | 2 | Hai tin quan trọng hay đến cùng lúc (phần thưởng + lên cấp, bắt được + xong nhiệm vụ). Ba cái thì trên điện thoại dọc chạm đầu nhân vật (đáy khoảng 376 > 362) |
| `baseMs`, `perCharMs` | 1.000, 55 | Khoảng 18 ký tự mỗi giây cộng 1 giây để nhận ra có thông báo giữa lúc đang đánh |
| `minMs` | low 1.800, normal 2.500, high 3.000 | |
| `maxMs` | 7.000 | |
| `maxWaitMs` | low 1.000, normal 4.000, high vô hạn | Phản hồi trễ quá 1 giây thì gây nhầm; mẹo, cảnh báo trễ quá 4 giây thì đã cũ |
| `maxWaiting` | 4 | Chỉ để chặn dồn ứ (ví dụ spam `debug:xp`) |
| `shortScreenPx`, `roomyPortraitPx` | 520, 760 | Mục 1 |

`toastDuration(text, level)` = `min(maxMs, max(minMs[level], baseMs + perCharMs × số ký tự))`, đếm theo code point (`[...text].length`). Ví dụ:

| Chữ | Mức | Thời gian |
|---|---|---|
| "Máu đang đầy" | thấp | 1.800 ms |
| "Bắt được Leafkit! 🎉" | cao | 3.000 ms |
| "Emberpup lên cấp 8! ⭐ Học được chiêu mới: 🔥 Phun lửa" | cao | 3.860 ms |
| mẹo cảm ứng | thường | 4.520 ms |
| phần thưởng trùm | cao | 5.015 ms |

Luật, theo thứ tự (cũng là JSDoc của `push`):
1. `push` gọi `update(now)` trước, để cái hết giờ đi ra và cái đang chờ được vào trước.
2. **Trùng chữ với cái đang hiện:** cái đó hiện lâu thêm, `until = max(until, now + toastDuration)`; không thêm, không đổi chỗ. **Trùng với cái đang chờ:** bỏ qua.
3. **Còn chỗ** (`visible.length < maxVisible()`): hiện ngay.
4. **Hết chỗ:** tìm cái yếu nhất đang hiện, tức mức thấp nhất, cùng mức thì `shownAt` nhỏ nhất. Thay nó nếu nó thấp mức hơn, hoặc cùng mức mà không phải `high`. Cái bị thay bị xoá ngay khỏi `visible`.
5. **Không thay được:** cho vào hàng chờ `{ text, level, at: now }`. Hàng chờ quá `maxWaiting` thì bỏ cái yếu nhất (mức thấp nhất, rồi `at` nhỏ nhất), có thể chính là cái vừa vào.
6. `update(now)`:
   - bỏ khỏi `visible` mọi cái có `until <= now`;
   - bỏ khỏi hàng chờ mọi cái đã chờ quá `maxWaitMs[level]`;
   - còn chỗ thì lần lượt đưa vào cái chờ mạnh nhất (mức cao nhất, rồi `at` nhỏ nhất), `shownAt = now`, `until = now + toastDuration`;
   - trả `true` nếu `visible` đổi;
   - không cấp phát gì khi không có gì thay đổi (gọi mỗi khung hình).
7. Mỗi toast có `id` tăng dần (`Hud` gắn phần tử DOM theo `id`). `visible` theo thứ tự hiện, cũ trước.

Kết quả mô phỏng (`queue-sim.mjs`, đúng luật trên):
- **Hạ trùm:** phần thưởng (5 s) và lên cấp có chiêu mới (3,9 s) cùng hiện. Lên cấp thứ hai (đòn của thú) chờ, hiện lúc 3,9 s. "Xong nhiệm vụ" (đến lúc 2,1 s) hiện lúc 5 s. Không mất tin, xong lúc 9 s.
- **Bắt thú đầu đàn:** "Bắt được" (1,9 s) và "Xong nhiệm vụ" (2,1 s) cùng hiện. Tin ★ và lên cấp (2,2 s) chờ, hiện lúc 4,9 s và 6 s.
- **Con thú đầu tiên khi mẹo đang hiện:** "Bắt được" thay mẹo (mẹo đã hiện 3,4 s). "Xong nhiệm vụ" thay "thoát ra rồi". Cả hai tin quan trọng cùng hiện.
- **Điện thoại ngang, hạ trùm:** lần lượt từng cái (phần thưởng, lên cấp, nhiệm vụ), xong lúc 12,9 s.
- **Lên cấp, rồi bấm R, 3, H, H, H:** tin lên cấp đứng yên 3,9 s. Ô thứ hai lần lượt là "Chưa có 🔵…", "🔒 …", rồi "Máu đang đầy" (được kéo dài, không nhân đôi).

### 4. Loại tin của server (`NoticeKind`) và mức phía client

`refused` → thấp; `done`, `warning` → thường; `reward`, `news` → cao; `quest` → cao, hiện trễ `QUEST_DELAY_MS` như hiện nay. Dòng là số dòng hiện tại trong `GameRoom.ts`:

| `kind` | Dòng | Chữ |
|---|---|---|
| `refused` | 437 (`debug:givePal`), 895 (`throwBlocker`), 970, 973, 1028, 1029, 1030, 1035, 1054 (`craftBlocker`), 1086, 1105, 1116, 1117, 1382, 1778 | túi đầy, không bắt được trùm, "Hãy đặt trại trước…", "Trại cấp N chỉ chứa…", chỗ dựng trại không hợp lệ (4 câu), thiếu điều kiện chế tạo, "Bạn chưa có món này", "Hết 🥧 …", "Hết 🫐 quả mọng", "Máu đang đầy", "Không có thú hoang nào ở gần để đánh", "{thú} đang nghỉ, còn N giây" |
| `done` | 1019, 1040, 1062, 1065, 1107 | "Đã thả …", "Đã dựng trại 🏕️", "Đã làm …" (2 chỗ), "… ăn ngon lành! +40 XP" |
| `warning` | 1749, 1764, 1969, 1970 | bị ngất, thú kiệt sức, lạnh quá, nóng quá |
| `reward` | 539, 1058, 1624, 1855 | "Trong lúc bạn đi vắng…", "Trại đã lên cấp…", "Hạ được trùm!…", "Rương báu!…" |
| `quest` | 1874 | "Xong nhiệm vụ …" |
| `news` | 937, 1182 (qua `announce`) | "★ … đã bắt được …", "★ … đã hạ …" |

Vì sao server gắn loại, không để client đoán theo chữ:
- client hiện đã đoán theo chữ ở 3 chỗ (`startsWith("Xong nhiệm vụ")`, `"Đã làm"`, `"Trại đã lên cấp"`);
- thêm 10 tiền tố nữa thì dễ vỡ khi sửa chữ, nhất là khi T12 gom chữ;
- tham số `kind` bắt buộc trong `notify` khiến mọi tin mới phải chọn loại ngay lúc viết.

Tiếng "craft" vẫn theo chữ như cũ (không đổi ở T6).

### 5. Thứ tự phía server: từng chỗ đè đã biết

| # | Cách giải | Lý do |
|---|---|---|
| a | **Sửa server:** kinh nghiệm bắt trả khi bóng khép | Tin lên cấp lúc ném lộ kết quả, không chỉ ở toast mà cả lấp lánh, tiếng lên cấp và chữ bay tên chiêu. Hàng đợi ở client không sửa được chỗ lộ này. Chi tiết dưới |
| b | Hàng đợi | Phần thưởng và lên cấp đều mức cao: hiện cùng lúc, cái thứ ba chờ. Server giữ thứ tự tin báo trước, `LevelUp` sau |
| c | Hàng đợi, **không** dời `XP_PER_HIT` | Cộng `XP_PER_HIT` trước `hitWild` không bỏ được tin `LevelUp` thứ hai, chỉ dời nó lên trước phần thưởng. Nó còn tách một lần "6 → 8, học chiêu" thành hai lần ("6 → 7, học chiêu" rồi "7 → 8") khi chính đòn đó qua ngưỡng. Hàng đợi giữ cả hai tin, không mất gì. Ghi ngoại lệ này vào `docs/architecture.md` |
| d | Hàng đợi, giữ đệm 300 ms (đặt tên) | Đến ngược thứ tự thì cả hai vẫn hiện. Đệm 300 ms giờ dùng cho mọi lần bắt |
| e, f, g | Hàng đợi | Tin quan trọng không bị thay; cảnh báo lạnh (thường) chỉ bị tin cao thay khi hết chỗ, còn "Đến vùng" (thấp) nhường trước |
| h | Bố cục và chữ | Ô rộng theo cột: 3 dòng ở 390×844 thay vì 5. `rewardText` dùng khoảng trắng không ngắt (U+00A0) giữa biểu tượng và số |

**Chi tiết a** (`handleThrow`, nhánh `success`):
- Thú đi theo **lúc ném** (`follower`) nhận `finishXp(XP_PER_CAPTURE, pal.level)`, cộng thêm `ALPHA.xp` nếu là thú đầu đàn.
- Trả một lần, trong **một** hẹn giờ `captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS` (300 ms, hằng mới trong `capture.ts`).
- Trong hẹn giờ: tin ★ (nếu là thú đầu đàn) trước, rồi `grantXp` nếu thú vẫn còn trong túi của người ném, rồi `scheduleSave`.
- Gộp hai khoản thành một `grantXp`, nên chỉ có một tin `LevelUp` (trước đây bắt thú đầu đàn có thể có hai).
- `questEvent("catch")` và `questEvent("alpha")` vẫn chạy lúc ném. Client vẫn hoãn "Xong nhiệm vụ" 2,1 s, sau lúc bóng khép (1,9 s).
- Không có thú đi theo (con đầu tiên) và không phải thú đầu đàn thì không đặt hẹn giờ.

Phác thảo (chỉ để rõ ý, coder viết theo code xung quanh):

```ts
const follower = player.pals.find((p) => p.id === player.activePalId);
if (!follower) this.summon(client.sessionId, owned.id); // the first catch starts following right away
this.questEvent(client.sessionId, "catch");
if (alphaName) this.questEvent(client.sessionId, "alpha");
// Once the ball has clicked shut (as the thrower sees it): a pack leader's news, then the XP for the pal that helped,
// in one timer (timers due in the same tick run last-registered first). Not at the throw: a level-up then would
// give the catch away while the ball still wobbles.
const xp = follower ? finishXp(XP_PER_CAPTURE, pal.level) + (alphaName ? ALPHA.xp : 0) : 0;
const news = alphaName ? `★ ${player.name} đã bắt được ${alphaName}!` : "";
if (xp > 0 || news) {
  this.clock.setTimeout(() => {
    if (news) this.announce(news);
    if (!follower || !this.state.players.get(client.sessionId)?.pals.includes(follower)) return;
    this.grantXp(client.sessionId, follower, xp);
    this.scheduleSave(client.sessionId);
  }, captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS);
}
```

### 6. Chữ (tiếng Việt, chính xác)

| Chỗ | Cũ | Mới |
|---|---|---|
| Mẹo thú choáng, cảm ứng (`Game.ts:439`) | "💫 Thú đang choáng: ném bóng (E) để dễ bắt, hoặc đánh thêm để hạ gục lấy đồ" | "💫 Thú choáng: bấm Bắt để dễ bắt, hoặc Đánh tiếp để hạ gục lấy đồ" |
| Mẹo thú choáng, bàn phím | như trên | "💫 Thú choáng: ném bóng (E) để dễ bắt, hoặc đánh tiếp (Space) để hạ gục lấy đồ" |
| Lạnh (`GameRoom.ts:1969`) | "{vùng}: lạnh quá! 🥶 Mặc 🧥 Áo ấm (👕 Tủ đồ) hoặc cho thú hệ lửa đi theo" | "{vùng}: lạnh quá! 🥶 Mặc 🧥 Áo ấm (👕 Tủ đồ) hoặc dắt thú hệ lửa" |
| Nóng (`:1970`) | "{vùng}: nóng quá! 🥵 Đội 👒 Nón lá (👕 Tủ đồ) hoặc cho thú hệ nước đi theo" | "{vùng}: nóng quá! 🥵 Đội 👒 Nón lá (👕 Tủ đồ) hoặc dắt thú hệ nước" |
| Phần thưởng trùm (`:1624`) | "Hạ được trùm! 🏆 +🪵15 +🪨25 +🫐10 +🔵2 +🛡️ Giáp hiệp sĩ · Emberpup +250 XP" | `Hạ được trùm! 🏆 ${rewardText({ ...BOSS.reward, wear: prize })}${xpText}`, thành "Hạ được trùm! 🏆 🪵 15  🪨 25  🫐 10  🔵 2  🛡️ Giáp hiệp sĩ · Emberpup +250 XP" (cùng kiểu với rương và nhiệm vụ). `xpText` giữ nguyên " · {thú} +250 XP" |
| `rewardText` (shared) | "🪵 2  👘 Áo dài" | `"🪵\xa02  👘\xa0Áo dài"`: ký tự U+00A0 (khoảng trắng không ngắt, trong code viết `\xa0`) giữa biểu tượng và số/tên. Khoảng cách đôi giữa các món giữ nguyên |

Giữ nguyên:
- chữ lên cấp, "Bắt được", "thoát ra rồi", "Đã thả", "Túi thú đầy", "Rương báu", "Đã kết nối lại" (e2e lọc theo chúng);
- lãnh địa thú đầu đàn (65 ký tự, 2 dòng ở 390 px, mỗi con một lần mỗi phiên; e2e lọc "Lãnh địa của Voltmouse đầu đàn").

### 7. Điện thoại, bàn phím, trợ năng

- Thông báo không bấm được, không nhận chạm (`pointer-events: none`), nên không chặn cần điều khiển hay nút nào. Không có phím mới.
- Mẹo nhắc đúng cách điều khiển của thiết bị. `Game` giữ `isTouch` của `init()` thành trường `touch`.
- `.hud-toasts` có `role="status"` và `aria-live="polite"`, để trình đọc màn hình đọc thông báo mới.
- `prefers-reduced-motion`: không trượt, không mờ dần.

## Kế hoạch triển khai

Làm theo thứ tự. Sau phần A chạy `npm test`; sau phần B chạy `npm run typecheck` và `npm test`; sau phần C chạy e2e.

### A. Shared và server

1. **`packages/shared/src/messages.ts`:**
   - thêm `export type NoticeKind = "refused" | "done" | "warning" | "reward" | "quest" | "news";`, JSDoc tiếng Anh nói từng loại dùng cho gì như bảng ở Thiết kế 4;
   - `NoticeMessage` thêm `kind: NoticeKind` (bắt buộc), JSDoc: "What the notice is about: the client shows it by how much it matters (how long, what may replace it)".
2. **`packages/shared/src/capture.ts`:** thêm `export const CAPTURE_NEWS_DELAY_MS = 300;`. JSDoc: "How long after the ball clicks shut (captureRevealMs) the server tells a catch's news and pays its XP: the client shows the catch first, with this much to spare for a slow frame or network."
3. **`packages/shared/src/rewards.ts`:**
   - `rewardText` dùng ký tự U+00A0 (khoảng trắng không ngắt, trong code viết `\xa0`) thay cho dấu cách giữa biểu tượng và số lượng (tài nguyên, vật phẩm), và giữa biểu tượng và tên đồ mặc. Giữ hai dấu cách thường `"  "` giữa các món (chỗ được xuống dòng).
   - Sửa JSDoc: thêm vì sao (một món không bị xuống dòng giữa chừng trong thông báo).
   - Sửa `wardrobe.test.ts:91` thành `"🪵\xa02  👘\xa0Áo dài"`.
4. **`packages/server/src/rooms/GameRoom.ts`:**
   - a. `notify(client, text, kind: NoticeKind)`, JSDoc. `announce(text)` luôn gửi `kind: "news"`. Bỏ tham số `delayMs` không còn ai dùng (gợi ý của REVIEW T4, trước đây ghi ở T20); sửa JSDoc.
   - b. Gắn `kind` cho 29 lời gọi `notify` theo bảng ở Thiết kế 4. `npm run typecheck` sẽ báo chỗ nào thiếu.
   - c. `handleThrow`: theo Thiết kế 5a, xoá hẹn giờ cũ của thú đầu đàn, import `CAPTURE_NEWS_DELAY_MS`.
   - d. `defeatBoss`: chữ phần thưởng theo Thiết kế 6, bỏ biến `won`.
   - e. `tickClimate`: chữ lạnh/nóng theo Thiết kế 6.
5. **`packages/server/src/rooms/GameRoom.test.ts`:**
   - a. Sửa `captured pals keep the wild level and the follower earns capture XP by that level`:
     - ngay sau lần `capture` thứ hai, `follower.xp` vẫn là 0 (lúc ném chưa trả gì);
     - rồi `ticks(room, Math.ceil((captureRevealMs(3) + CAPTURE_NEWS_DELAY_MS) / 50) + 3)`;
     - rồi `follower.xp` bằng `finishXp(XP_PER_CAPTURE, 8)`.
   - b. Viết lại `caught, it pays the catch XP for its level at once, and ALPHA.xp once the ball has clicked shut` thành `caught, a pack leader pays the catch XP and ALPHA.xp together once the ball has clicked shut`:
     - lúc ném: cấp và kinh nghiệm không đổi, không có `LevelUp`;
     - sau `reveal + CAPTURE_NEWS_DELAY_MS`: bằng `addXp({ level: 10, xp: 0 }, finishXp(XP_PER_CAPTURE, level) + ALPHA.xp)`.
   - c. `caught, the news of the catch comes before the level-up…`: sửa chú thích "The throw's own XP…" (lúc ném không còn trả gì) và dùng một lần `addXp` với tổng. Giữ kiểm tra thứ tự và đúng một `LevelUp 6 -> 7`.
   - d. **Mới:** `a catch pays its XP once the ball has clicked shut, never before (a level-up must not give the catch away)`:
     - thú đi theo emberpup cấp 6 (`giveCompanion`), `xp = xpToNext(6) - 1`, `palAuto = false`;
     - chờ hết hồi ném của lần bắt trong `giveCompanion` (`ticks(room, 20)`, như test 5a);
     - ném vào thú thường (`palNextTo(room, player, 60)`, ném tay như các test thú đầu đàn, `Math.random` mock 0, chờ `CaptureResult`). Kinh nghiệm bắt (ít nhất 25) đủ đưa thú từ cấp 6 lên 7, chưa tới 8 (cần thêm 241);
     - sau `Math.ceil(captureRevealMs(result.shakes) / 50)` tick: vẫn không có `LevelUp`, kinh nghiệm không đổi;
     - thêm `Math.ceil(CAPTURE_NEWS_DELAY_MS / 50) + 5` tick: đúng một `LevelUp` `fromLevel 6, level 7`.
   - e. **Mới:** `a pal let go before the ball clicks shut learns nothing from that catch`: như d, nhưng gửi `ClientMessage.Release` thú đi theo ngay sau `CaptureResult`; sau hẹn giờ không có `LevelUp`, không lỗi.
   - f. **Mới:** `every notice says what it is about`, mỗi `kind` một ví dụ:
     - `refused`: "Máu đang đầy" (có quả mọng, máu đầy, gửi `Eat`);
     - `quest`: "Xong nhiệm vụ …" sau lần bắt đầu tiên;
     - `done`: "Đã thả …" (thả con vừa bắt);
     - `reward`: "Rương báu!…" (`(room as any).openChest(...)`);
     - `news`: tin ★ khi `knockOut` thú đầu đàn, cả người khác cũng nhận với `kind: "news"`.
     Ngoài ra thêm `kind` vào test sẵn có: trong test lạnh/nóng, tin chứa "lạnh" có `kind: "warning"`; trong `the pal of everyone who helped learns BOSS.xp…`, tin "Hạ được trùm" có `kind: "reward"`.

### B. Client

6. **Mới `packages/client/src/ui/toastQueue.ts`** (không đụng DOM), xuất:
   - `type ToastLevel = "low" | "normal" | "high"`;
   - `TOAST` (bảng ở Thiết kế 3, `as const`, JSDoc từng trường);
   - `interface Toast { id; text; level; shownAt; until }`;
   - `toastDuration(text, level)`;
   - `toastRoom(width, height)`: 1 nếu `height <= TOAST.shortScreenPx`, hoặc nếu `width < height && height < TOAST.roomyPortraitPx`; còn lại `TOAST.maxVisible`;
   - `class ToastQueue`:
     - `constructor(maxVisible: () => number = () => TOAST.maxVisible)`;
     - `readonly visible: Toast[]`, `readonly waiting: { text; level; at }[]`;
     - `push(text, level, now): boolean` (true nếu `visible` đổi), `update(now): boolean`.

   Luật đúng như Thiết kế 3. JSDoc tiếng Anh nói từng luật và vì sao.
   **Mới `toastQueue.test.ts`:** xem mục Test.
7. **`packages/client/src/ui/hud.ts`:**
   - Bỏ `toast`, `toastTimer`. Thêm:
     - `toasts` (`div.hud-toasts`, `role="status"`, `aria-live="polite"`), gắn vào `this.left` sau `status` (CSS `order` đưa nó xuống cuối);
     - `toastQueue = new ToastQueue(() => toastRoom(window.innerWidth, window.innerHeight))`;
     - `toastElements = new Map<number, HTMLDivElement>()`;
     - hằng `TOAST_FADE_MS = 200` (khớp CSS).
   - `showToast(text: string, level: ToastLevel)`: `if (this.toastQueue.push(text, level, performance.now())) this.renderToasts();`. Mức là **bắt buộc**: typecheck chỉ ra mọi chỗ gọi cũ.
   - `tickToasts(now: number)`: `if (this.toastQueue.update(now)) this.renderToasts();`.
   - `renderToasts()`:
     - phần tử nào có `id` không còn trong `visible` thì thêm class `out`, xoá khỏi map, rồi `window.setTimeout(() => el.remove(), TOAST_FADE_MS)`;
     - toast nào trong `visible` chưa có phần tử thì tạo `div.toast.<level>` (`textContent`), gắn vào cuối `toasts`.
     - Thứ tự DOM vì vậy là thứ tự hiện.
   - Dòng 55 (link mời): `showToast(…, "low")` cả hai lời gọi.
   - JSDoc lớp: "status panel, toasts (see toastQueue.ts), touch action buttons".
8. **`packages/client/src/game/Game.ts`:**
   - Hằng cạnh `QUEST_DELAY_MS`: `NOTICE_LEVEL: Record<NoticeKind, ToastLevel> = { refused: "low", done: "normal", warning: "normal", reward: "high", quest: "high", news: "high" }`. JSDoc: trỏ tới `docs/design/hud.md`.
   - Trường `private touch = false;`, gán trong `init()` sau khi tính `isTouch`.
   - Mức cho từng chỗ gọi:
     - `:281` hint `"low"`;
     - `:324` `"normal"`;
     - `:688` `msg.success ? "high" : "normal"`;
     - `:807-809` `"high"`, bỏ tham số thời gian;
     - `:1057` `tip()` `"normal"`, bỏ 4500;
     - `:1094` `"low"`;
     - `:1103` `"low"`, bỏ 3000;
     - `:1169` `"low"`;
     - `:1187` `"normal"`, bỏ 3500;
     - `:1306` `"low"`.
   - `:439`: `this.tip("dizzy", this.touch ? <chữ cảm ứng> : <chữ bàn phím>)`, chữ ở Thiết kế 6.
   - Bộ xử lý `Notice` (`:794-798`):
     - `msg.kind === "quest"` thì `setTimeout(() => this.hud.showToast(msg.text, "high"), QUEST_DELAY_MS)`;
     - còn lại `this.hud.showToast(msg.text, NOTICE_LEVEL[msg.kind] ?? "low")` (`??` đề phòng server khác phiên bản);
     - dòng tiếng "craft" giữ nguyên.
   - `frame()`: thêm `this.hud.tickToasts(now);` ngay sau `this.skillBar.tick(now);`.
9. **`packages/client/index.html`** (CSS):
   - Xoá `.hud-toast` và `.hud-toast.visible` (dòng 109-111). Thêm vào chỗ đó, kèm chú thích tiếng Anh một dòng:

     ```css
     /* Toasts (ui/toastQueue.ts): at most two, under the quest tracker in the HUD column, above the panels (3). */
     .hud-toasts { order: 10; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: min(100%, 420px);
       position: relative; z-index: 4; pointer-events: none; }
     .hud-toasts:empty { display: none; }
     .toast { box-sizing: border-box; max-width: 100%; padding: 6px 12px; border-radius: 8px; background: rgba(0,0,0,0.72); color: #fff;
       font-size: 15px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; animation: toast-in 0.15s ease-out; transition: opacity 0.2s; }
     .toast.high { border-left: 4px solid #ffca28; padding-left: 10px; }
     .toast.out { opacity: 0; }
     @keyframes toast-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
     @media (prefers-reduced-motion: reduce) { .toast { animation: none; transition: none; } }
     ```

   - Trong `@media (max-width: 600px)` (điện thoại): `.toast { font-size: 13px; padding: 5px 10px; } .toast.high { padding-left: 8px; }`.
   - Trong `@media (max-height: 520px) and (min-width: 601px)` (điện thoại ngang), kèm chú thích "the HUD column stays left of the name tags around the player (T6)":

     ```css
     .hud-left { max-width: 300px; gap: 4px; }
     .hud-health { font-size: 12px; gap: 5px; padding: 4px 8px; }
     .hud-hp { width: 64px; }
     .hud-hp-text { font-size: 11px; }
     .hud-region { display: none; }
     .hud-status { font-size: 12px; padding: 4px 8px; line-height: 1.6; }
     .hud-quest { font-size: 12px; padding: 4px 8px; }
     .hud-quest small { font-size: 11px; }
     .hud-quest .quest-reward { display: none; }
     .toast { font-size: 13px; padding: 5px 10px; }
     .toast.high { padding-left: 8px; }
     .boss-bar { width: 200px; font-size: 12px; }
     ```

### C. E2E và tài liệu

10. **`tests/e2e/multiplayer.spec.ts`:**
    - a. Đổi 9 chỗ `page.locator(".hud-toast")` (dòng 239, 260, 487, 719, 772, 914, 933, 1114, 1359) thành `page.locator(".hud-toasts")`. Sửa chú thích dòng 932: tin lên cấp có chiêu mới là mức cao, hiện ít nhất 3 s và không bị thay.
      Thông báo con có class `.toast`, không phải `.hud-toast`: chỗ nào quên đổi sẽ hỏng ngay (không khớp phần tử nào), chứ không hỏng lúc được lúc không (vi phạm strict mode khi đang có 2 thông báo).
    - b. Helper cạnh `labelOverlaps`:
      - `shownToasts(page)`: chữ của `.hud-toasts > .toast:not(.out)`, theo thứ tự;
      - `toastLayout(page)`: hộp bao của
        - các thông báo đang hiện;
        - các phần HUD đang hiện (`display` khác `none`, không `hidden`, rộng và cao > 0): `.hud-health, .hud-status, .hud-quest, .party-btn, .base-btn, .craft-btn, .wardrobe-btn, .minimap, .skill-btn, .skill-auto, .ball-btn, .action-btn, .boss-bar`;
        - `.labels > .label.me span`;
        - mép phải lớn nhất của `.hud-health, .hud-status, .hud-quest`;
        - `innerWidth`, `innerHeight`.
      - Hai hộp "giao nhau" khi chồng nhau quá 1 px cả hai chiều, như `labelOverlaps`.
    - c. **Mới, lặp 3 khung hình:** `toasts (<khung>): under the quest tracker, clear of the HUD and of my name; <n> at a time`.
      - Các khung: desktop `{ viewport: 1280×720 }` n = 2; `phone upright` `{ 390×844, hasTouch, isMobile }` n = 2; `phone sideways` `{ 844×390, hasTouch, isMobile }` n = 1. Mỗi test `test.slow()`.
      - Các bước:
        1. `join`, `waitForWorld`, chờ `frames > 0`;
        2. `debug:givePal` emberpup cấp 8, chờ có thú đi theo và `.skill-bar` hiện; chờ `.hud-quest` có chữ và `.hud-toasts > .toast` đếm được 0;
        3. qua `(window as any).__petgame.game.hud.showToast` đẩy hai thông báo mức cao dài nhất:
           - `"Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP"` (đúng chữ server gửi sau bước 4d; `\xa0` là khoảng trắng không ngắt);
           - `"Frostfang lên cấp 15! ⭐ Học được chiêu mới: ❄️ Hơi thở băng giá, 🌨️ Bão tuyết"`.
      - Kiểm:
        - `.hud-toasts > .toast:not(.out)` đếm được n;
        - mỗi thông báo nằm trọn trong màn hình;
        - không giao phần HUD nào và không giao nhãn của mình.
      - Riêng `phone sideways`:
        - đáy thông báo ≤ `innerHeight − 140` (góc ngón cái trống);
        - mép phải cột HUD ≤ `innerWidth / 2 − 100`;
        - thông báo thứ hai hiện sau khi cái thứ nhất hết: `toContainText("Hơi thở băng giá", { timeout: 10_000 })` trên `.hud-toasts`.
    - d. **Mới (desktop):** `toasts: the catch and the quest it finishes show together; small notices do not push out a level-up`.
      1. Người chơi mới, chưa có thú. `debug:spawnPal`, rồi ném vào con gần nhất mỗi 900 ms cho tới khi bắt được (như test bắt thú đang có). `expect.poll` (15 s) tới khi `shownToasts` **cùng lúc** có một chữ bắt đầu bằng "Bắt được" và một chữ bắt đầu bằng "Xong nhiệm vụ".
      2. Chờ `.hud-toasts > .toast` về 0 (tối đa 20 s: nếu một lần ném đang bay bắt thêm con thứ hai, tin lên cấp của nó còn phải hiện hết). `debug:givePal` emberpup cấp 6, chờ nó đi theo, rồi `debug:xp` 450.
      3. Chờ `.toast.high` chứa "Học được chiêu mới: 🔥 Phun lửa" hiện. Bấm phím `r`, `3`, `h`.
      4. Kiểm:
         - `.hud-toasts` chứa `/Máu đang đầy|Hết 🫐 quả mọng/`;
         - `shownToasts` có đúng 2 chữ: tin lên cấp và phản hồi mới nhất;
         - tin lên cấp vẫn hiện;
         - "Chưa có 🔵 Bóng xịn" và "🔒" không còn hiện.
11. **`docs/architecture.md`:**
    - Bảng shared, dòng `messages.ts`: thêm "`NoticeMessage.kind` (refused, done, warning, reward, quest, news): client chọn mức thông báo theo đó".
    - Dòng `capture.ts`: thêm `CAPTURE_NEWS_DELAY_MS`.
    - Thay đoạn "**Thứ tự tin báo và `LevelUp`:** …" bằng:

      > **Thông báo và thứ tự tin:** client xếp thông báo theo mức (`ui/toastQueue.ts`, luật ở `docs/design/hud.md`): tối đa 2 cái cùng lúc (1 khi điện thoại ngang hoặc điện thoại dọc thấp hơn 760 px). Thông báo mức cao (lên cấp, bắt được, phần thưởng, xong nhiệm vụ, tin ★) không bị thay và hiện đủ thời gian, nên hai tin đến cùng lúc đều đọc được. `NoticeMessage.kind` cho client biết mức của mỗi tin; `quest` hiện trễ `QUEST_DELAY_MS`. Server vẫn giữ thứ tự tự nhiên:
      > - tin báo của sự kiện trước, `grantXp` (tin `LevelUp`) sau: `knockOut`, `defeatBoss`, `feed`;
      > - bắt thú: kinh nghiệm bắt (cộng `ALPHA.xp` nếu là thú đầu đàn) trả trong **một** hẹn giờ lúc bóng khép (`captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS`), tin ★ trước, kinh nghiệm sau. Trả lúc ném thì tin lên cấp sẽ lộ kết quả khi bóng còn lắc;
      > - ngoại lệ chấp nhận được: `XP_PER_HIT` của đòn thú đi theo cộng sau hậu quả của chính đòn đó. Đòn kết liễu trùm có thể gây một `LevelUp` thứ hai sau tin phần thưởng; hàng đợi giữ cả hai.
      >
      > Hai hẹn giờ `this.clock.setTimeout` cùng đáo hạn trong một tick thì cái đăng ký **sau** chạy **trước** (`ClockTimer` duyệt từ cuối về đầu), nên tin cần đi theo thứ tự phải chung một hẹn giờ.

    - Mục client, dòng `ui/`: `hud.ts` (trạng thái, chồng thông báo, nút cảm ứng), thêm `toastQueue.ts` (hàng đợi thông báo, hàm thuần có test).
    - Mục Kiểm thử, Helper e2e: thêm `shownToasts`, `toastLayout`.
12. **Ảnh "sau"** (tester hoặc coder, không commit):
    - bật server (`PETGAME_DEBUG=1`) và Vite, chạy `node /tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t6/toast-shots-after.mjs <thư mục> after`;
    - script in số giao nhau của thông báo với HUD, và nhãn nằm dưới HUD;
    - so với ảnh `*-before.png` và `*-protoF.png`; ghi số vào `PROGRESS.md`;
    - tắt server và Vite sau khi chụp.

## Giao thức

- **`messages.ts`:**
  - `NoticeMessage` thêm `kind: NoticeKind` (bắt buộc), `NoticeKind` mới;
  - server và client đổi cùng nhiệm vụ, chạy chung một container nên không có client cũ nói với server mới;
  - client vẫn đề phòng: `kind` lạ hoặc thiếu thì coi là `"low"`.
- **`schema.ts`:** không đổi. **`Profile` / lưu game:** không đổi, hồ sơ cũ không ảnh hưởng.
- **Thời điểm** (không phải định dạng):
  - tin `LevelUp` do bắt thú giờ đến lúc bóng khép + 300 ms thay vì lúc ném;
  - nhiệm vụ "Nuôi thú lên cấp 5" nếu xong nhờ lần bắt đó cũng đến lúc ấy;
  - kinh nghiệm không đổi về số lượng; bắt thú đầu đàn gộp hai khoản thành một `LevelUp`.
- **API nội bộ client:**
  - `Hud.showToast(text, level)` (mức bắt buộc, không còn tham số thời gian);
  - `Hud.tickToasts(now)`;
  - DOM: `.hud-toasts > .toast.<level>` thay `.hud-toast`.
  - `window.__petgame` giữ nguyên.

## Test

**Unit `packages/client/src/ui/toastQueue.test.ts`** (thời gian truyền vào, không DOM):
1. `toastDuration`:
   - chữ ngắn lấy mức sàn (1.800 / 2.500 / 3.000);
   - chữ dài tăng 55 ms mỗi ký tự;
   - trần 7.000;
   - emoji tính là một ký tự (`[...text]`).
2. `toastRoom`: (390, 844) → 2; (390, 664) → 1; (375, 667) → 1; (844, 390) → 1; (1280, 720) → 2; (768, 1024) → 2; (1280, 500) → 1.
3. Hai cái vừa chỗ; cái thứ ba mức `low` thay cái `low` cũ hơn, cái `normal` vẫn ở lại.
4. `high` không bao giờ bị thay:
   - `[high, high]` + `low`: chờ, quá 1.000 ms thì bị bỏ;
   - `[high, high]` + `normal`: chờ tới khi một `high` hết, rồi hiện đủ thời gian của nó, tính từ lúc hiện.
5. Mức cao hơn thay cái yếu nhất: `[low, normal]` + `high` thay `low`, giữ `normal`.
6. Cùng mức `normal`: thay cái cũ nhất.
7. Ba cái `high`: cái thứ ba chờ, hiện khi cái đầu hết. Nhiều cái chờ thì hiện cái mạnh nhất trước (một `normal` chờ trước, một `high` chờ sau, thì `high` vào trước).
8. Trùng chữ đang hiện: `until` kéo dài tới `now + duration`, không có `id` mới, thứ tự giữ nguyên, `push` trả `false`. Trùng chữ đang chờ: một mục.
9. `maxWaiting`: 2 `high` đang hiện cộng 6 `high` đẩy vào, hàng chờ còn 4, đã bỏ những cái cũ nhất.
10. `maxVisible` là hàm: trả 1 thì cái `high` thứ hai chờ. Đổi sang 2 thì `update` đưa nó vào ngay.
11. Các tình huống thật ở Thiết kế 3 (hạ trùm; bắt thú đầu đàn; con thú đầu tiên khi mẹo đang hiện; lên cấp rồi bấm 3 phím): kiểm thứ tự hiện và không tin `high` nào bị bỏ hay cắt ngắn.
12. `update` không có gì đáo hạn thì trả `false` và không đổi `visible`.

**Shared:** `wardrobe.test.ts:91` sửa theo U+00A0 (bước 3).

**Tích hợp server** (`GameRoom.test.ts`): bước 5 (a-f).

**E2E** (`tests/e2e/multiplayer.spec.ts`): bước 10 (9 chỗ đổi, 3 test bố cục, 1 test hàng đợi). Thêm khoảng 4 phút e2e trên WebGL phần mềm.

**Ảnh:** "trước" và mẫu thử đã có (mục Hiện trạng); "sau" theo bước 12.

## Tiêu chí hoàn thành

- [ ] `npm run typecheck` sạch; `npm test` qua (gồm `toastQueue.test.ts` và các test server mới/sửa); `npm run build` sạch; `npm run test:e2e` qua toàn bộ.
- [ ] Không còn `.hud-toast` trong code và e2e. Thông báo là `.hud-toasts > .toast`, con của `.hud-left`, hiện dưới ô nhiệm vụ ở cả 3 khung hình.
- [ ] Ở 1280×720, 390×844 và 844×390:
  - thông báo không giao hàng máu, trạng thái, nhiệm vụ, 4 nút phải, bản đồ nhỏ, thanh chiêu, nút bóng, nút cảm ứng, thanh máu trùm hay nhãn tên của mình;
  - desktop và dọc hiện tối đa 2, ngang tối đa 1.
- [ ] Điện thoại ngang:
  - mép phải cột HUD ≤ 322 px (giữa màn hình − 100);
  - đáy thông báo ≤ 250 px;
  - thanh máu trùm (200 px) không đè cột.
- [ ] Tin `high` không bao giờ bị thay hay cắt ngắn, hiện ≥ 3 s. Phản hồi `low` thay nhau, cái mới nhất thắng. Trùng chữ thì kéo dài, không nhân đôi (unit test 3-12).
- [ ] Hạ trùm, bắt thú đầu đàn, con thú đầu tiên: mọi tin quan trọng đều hiện (unit test 11; e2e bước 10d cho con thú đầu tiên).
- [ ] Bắt thú: không có `LevelUp` trước `captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS`. Thú đầu đàn: một `LevelUp` cho cả hai khoản, sau tin ★. Thú bị thả trước lúc đó thì không nhận gì (test 5a-e).
- [ ] Mọi tin `Notice` có `kind` đúng bảng Thiết kế 4 (typecheck bắt buộc, test 5f).
- [ ] Chữ mới đúng Thiết kế 6. Thông báo phần thưởng trùm không xuống dòng giữa biểu tượng và số.
- [ ] `docs/architecture.md` sửa theo bước 11. Không còn câu "toast của client chỉ có một ô".
- [ ] `PROGRESS.md` có số đo ảnh "sau" (giao nhau với HUD = 0 ở 3 khung hình) và đường dẫn ảnh.

## Rủi ro, câu hỏi mở

Không có "CHẶN": đổi giao thức chỉ thêm trường, không đụng dữ liệu đã lưu, không bỏ tính năng.

- **E2E chậm hơn khoảng 4 phút** (4 test, mỗi test tải một trang WebGL phần mềm). Chấp nhận được; T16 (e2e trên bản build) sẽ bù. Nếu CI quá giờ, gộp 3 test bố cục thành một test mở lần lượt 3 context (đóng context trước rồi mới mở cái sau, như `scripts/shots.mjs`).
- **T18 sẽ làm cột trái cao hơn** (nút "Ăn", 🔊 lên 44 px). Thông báo tự xuống theo cột nên vẫn không đè HUD. Nhưng giới hạn `innerHeight − 140` của e2e ngang có thể hỏng: khi đó T18 thu gọn cột ngang (ví dụ ẩn dòng gợi ý nhiệm vụ) chứ không nới giới hạn. Ghi vào T18.
- **Mất chữ phản hồi:** phản hồi `low` bị bỏ nếu chờ quá 1 s khi cả hai chỗ đều là tin mức thường hoặc cao. Hiếm và có chủ đích (phản hồi trễ còn gây nhầm hơn).
- **Tin lên cấp có thể hiện chữ sau tiếng và lấp lánh** khi phải chờ (ví dụ 3,9 s khi hạ trùm). Đã cân nhắc phát tiếng lúc chữ hiện, nhưng tiếng và lấp lánh đi cùng nhau đúng lúc sự kiện là phản hồi tốt hơn.
- **Đường cong thời gian** (1 s + 55 ms/ký tự) là ước tính, chưa đo người chơi thật. Chỉnh trong `TOAST` nếu thấy dài.

## Đề xuất việc mới (agent chính cập nhật `TASKS.md`)

- **T30 (P2). Thanh máu trùm che thanh máu của mình trên điện thoại dọc.**
  - Hiện trạng: `.boss-bar` rộng 60vw ở giữa trên, đè hàng máu: dọc 184×35 px (che thanh máu của người chơi đúng lúc đánh trùm), desktop 1280 px 42×35. T6 đã sửa bản ngang (200 px).
  - Gợi ý: đưa `.boss-bar` vào `.hud-left` (`order` giữa ô nhiệm vụ và thông báo) trên điện thoại dọc; desktop dùng `position: fixed` ở giữa trên, rộng không quá phần trống bên phải cột trái.
  - E2E đo như `toastLayout`.
- **T14:** thêm nhóm `toasts` vào `npm run shots`, lấy script `toast-shots-after.mjs` của T6 làm gốc.
- **T20:** bỏ mục "bỏ tham số `delayMs` không còn dùng của `announce`" (T6 đã làm).
- **T12:** bảng chữ thông báo server nên giữ `kind` cạnh mỗi câu.
- **T18:** sau khi nâng nút "Ăn", 🔊 lên 44 px, chạy lại e2e `toasts (phone sideways)`; cột ngang rộng 300 px.
- **(P3, tuỳ chọn) Người ném thấy hai tin cho một lần bắt thú đầu đàn** ("Bắt được Voltmouse! 🎉" và "★ … đã bắt được Voltmouse đầu đàn!"). Có thể gửi tin ★ cho mọi người trừ người ném, và cho `CaptureResultMessage` thêm cờ `alpha` để chữ bắt được ghi "… đầu đàn".
- **Ghi chú cho agent chính:** danh sách tài liệu thiết kế trong `CLAUDE.md` có thể thêm `docs/design/hud.md` (game-designer không sửa `CLAUDE.md`).

## Tách nhiệm vụ

**Đề xuất: không tách, làm T6 trong một vòng coder.** Ước lượng khoảng 800 dòng đổi, phần lớn làm theo bảng:
- 31 chỗ gắn `kind`, 13 chỗ gắn mức, 9 chỗ đổi bộ chọn e2e;
- một module thuần mới kèm test (`toastQueue.ts`);
- khoảng 30 dòng CSS đã thử bằng mẫu thử (số đo ở Thiết kế 1);
- một nhánh `handleThrow` đã có phác thảo.

Ba phần A (server), B (client), C (e2e, tài liệu) kiểm được riêng: sau A chạy `npm test`, sau B chạy typecheck và unit, sau C chạy e2e. T5 có cỡ tương đương và qua ở vòng 2.

**Phương án dự phòng.** Dùng khi agent chính muốn giảm rủi ro trước khi giao, hoặc khi vòng 1 hỏng chủ yếu ở phần thời điểm kinh nghiệm bắt thú.

- **T6a: thông báo.** Gồm mọi thứ trong kế hoạch này, trừ thời điểm kinh nghiệm bắt thú: `NoticeKind`, `toastQueue`, `Hud`, CSS, chữ, e2e, `docs/architecture.md`, `docs/design/hud.md`. Riêng bước 11, câu "bắt thú: …" viết theo hiện trạng (kinh nghiệm bắt trả lúc ném; `ALPHA.xp` và tin ★ chung hẹn giờ lúc bóng khép). Đứng được một mình: chỗ đè (a) vẫn hết vì "Bắt được…" và tin lên cấp đều mức cao, chỉ còn lộ kết quả sớm.
- **T6b: kinh nghiệm bắt thú trả khi bóng khép.** Gồm bước 2, 4c, 5a-e, câu "bắt thú: …" của bước 11, và 3 chỗ sửa trong `docs/design/pals.md` của game-designer: mục "Thú đầu đàn", bảng nguồn kinh nghiệm, và câu "Kinh nghiệm bắt thú trả khi bóng khép…" trong đoạn "Thông báo lên cấp". Câu cuối đoạn đó (tin lên cấp là thông báo mức cao) thuộc T6a. Nếu tách thì commit 3 chỗ trên cùng T6b, không cùng T6a.
