# Giao diện trên màn hình (HUD) và thông báo

Chữ, nút và bảng nằm đè lên thế giới: phần tử DOM, CSS trong `packages/client/index.html`, code ở `packages/client/src/ui/`. Kiểm tra ở ba khung hình chuẩn: desktop 1280×720, điện thoại dọc 390×844, điện thoại ngang 844×390. Đặt ra ở nhiệm vụ T6. Nhãn tên trên đầu người và thú (T5) ở `docs/design/pals.md`, mục "Nhãn tên và thanh máu".

## Bố cục

| Vùng | Desktop | Điện thoại dọc | Điện thoại ngang |
|---|---|---|---|
| Cột trái trên (`.hud-left`), từ trên xuống: hàng máu và giờ (kèm nút 🫐 Ăn, 🔊), trạng thái, nhiệm vụ (hoặc thanh máu trùm, xem dưới), rồi **thông báo** | rộng tối đa 460 px | rộng 100vw − 140 px | rộng `min(300 px, 50vw − 110 px − lề trái)`, chữ 12 px, ẩn tên vùng, chữ của giờ (chỉ còn ☀️ 🌇 🌙 🌅) và dòng "Thưởng" của nhiệm vụ; nút 🔗 Mời nằm trong hàng máu, ô trạng thái một dòng (mục "Hàng trạng thái và nút 🔗 khi cầm ngang") |
| Cột phải trên: 🐾 Thú, 🏕️ Đặt trại, 🔨 Chế tạo, 👕 Tủ đồ (cách nhau 48 px), bản đồ nhỏ | bản đồ dưới các nút (top 204) | bản đồ dưới các nút (top 196) | bản đồ bên trái các nút |
| Bảng Thú, Chế tạo, Tủ đồ | dưới cột nút phải (top 204), rộng 340 | top 196, rộng 340 | bên trái cột nút; Thú và Tủ đồ rộng 490 |
| Thanh máu trùm (khi cách trùm ≤ 450 px) | rộng ≥ 1248 px: giữa trên, rộng `min(420, 100vw − 2 × lề trái − 944)` (1280: 312 px). Hẹp hơn: trong cột, thế chỗ ô nhiệm vụ | trong cột, thế chỗ ô nhiệm vụ | giữa trên, rộng `min(200, 100vw − 2 × lề phải − 528)`, nằm giữa cột trái và bản đồ |
| Dưới: thanh chiêu, nút bóng, nút cảm ứng (Đánh, Bắt, 💨) | thanh chiêu ở giữa, nút bóng góc phải dưới | bên phải; nút bóng bên trái nút Bắt | bên phải; nút bóng bên trái nút Bắt |
| Cần điều khiển (chỉ cảm ứng) | không có | hiện ở chỗ ngón trái chạm, ở bất cứ đâu trong nửa trái màn hình trừ trên nút (kể cả trên các ô của cột trái và thông báo) | như dọc |

"Lề trái/phải" là `max(12 px, env(safe-area-inset-*))`: 12 px, hoặc phần tai thỏ nếu lớn hơn (mục "Vùng an toàn"). Top 204 và 196 ở trên là khi không có tai thỏ.

- Nhân vật luôn ở giữa màn hình. Ở điện thoại ngang, cột trái phải kết thúc trước giữa màn hình ít nhất 100 px (844×390: cột đến x = 312, giữa là 422), để không che nhãn tên của người và thú quanh nhân vật. Từ T30 luật này đúng cả khi có tai thỏ: cột hẹp lại theo lề trái, mép phải luôn ≤ 50vw − 110.
- Lớp vẽ, từ dưới lên: nhãn tên (z 1), HUD (z 2). Trong HUD: **vùng cần điều khiển (−1, dưới cùng)**, các ô, nút và thanh máu trùm (không đặt z), bảng Thú, Chế tạo, Tủ đồ (3), **thông báo (4)**, bản đồ phóng to (4, vẽ sau thông báo), hộp xác nhận thả thú (5), màn mất kết nối (6). Thông báo không nhận chạm; chạm xuyên qua nó.

## Thanh máu trùm

Đặt ra ở nhiệm vụ T30. Trước đó thanh luôn nằm giữa trên và đè hàng máu của người chơi, đúng lúc đánh trùm:
- điện thoại dọc 184×35 px, còn đè cả 🔊 và nút 🐾 Thú;
- desktop 1280×720: 42×35 px;
- điện thoại ngang có tai thỏ: 25-38 px.

**Hiện khi nào:** người chơi cách trùm ≤ 450 px. Ẩn khi đi xa hơn, hoặc khi trùm bị hạ.

**Chữ:** một dòng "👑 Vua Đá Boulderhorn" và số máu "1152/1152", dưới là thanh máu. Thiếu chỗ thì tên rút gọn bằng "…", **số máu không bao giờ bị cắt**. Tên trùm vẫn luôn hiện trên đầu nó ngoài thế giới.

**Hai chỗ:**

**Giữa trên**, khi có đủ chỗ giữa cột trái và cột phải:
- desktop rộng ≥ 1248 px;
- điện thoại ngang (cao ≤ 520 px).

Thanh nằm đúng giữa màn hình, mép trên ngang mép trên cột, không nền. Bề rộng tính để cách cột trái và bản đồ nhỏ ít nhất 12 px:
- desktop: `min(420, 100vw − 2 × lề trái − 944)`. Cột desktop rộng tối đa 460 px, nên 944 = 2 × (460 + 12). Mốc 1248 là chỗ thanh còn 280 px, đủ hiện tên và số cỡ 14 px.
- ngang: `min(200, 100vw − 2 × lề phải − 528)`. Bản đồ nhỏ có mép trái ở 100vw − lề phải − 256 (rộng 112 px, cộng viền 2 px mỗi bên), nên khi thanh bị thu hẹp (màn rộng dưới 728 + 2 × lề phải: 752 px khi không có tai thỏ, 816 px với tai thỏ 44) nó cách bản đồ 8 px, không phải 12. Đo ở T61: 667×375, thanh `[276..391]`, bản đồ từ 399; 812×375 tai thỏ 44, thanh `[308..504]`, bản đồ từ 512.

**Trong cột trái, thế chỗ ô nhiệm vụ**, ở mọi màn rộng ≤ 600 px và desktop/máy tính bảng rộng 601-1247 px:
- Thanh là một ô như các ô khác của cột: nền tối, viền trái màu cam (ô nhiệm vụ viền vàng), tên bên trái, số bên phải. Thanh đứng sau ô trạng thái, trước thông báo.
- **Ô nhiệm vụ ẩn trong lúc thanh hiện**, hiện lại khi thanh ẩn.
  - Lý do: chèn thêm thanh vào cột thì cột dài thêm 22-38 px. Trên iPhone cầm dọc có tai thỏ, 2 thông báo khi đó đè tên mình 14 px.
  - Ô thanh (khoảng 38 px) thấp hơn ô nhiệm vụ (khoảng 57 px), nên cột còn ngắn hơn lúc thường.
  - Lúc đánh trùm, nhiệm vụ thường chính là "Hạ Vua Đá Boulderhorn".
- Đặt sau ô trạng thái để hàng máu và trạng thái không nhảy lên xuống khi người chơi đi ra vào vùng 450 px.

**Chạm và lớp vẽ:**
- Thanh không có nút và không nhận chạm. Trên cảm ứng, chạm vào nó là bật cần điều khiển.
- Bảng (z 3) và thông báo (z 4) vẽ trên thanh. Khi cầm ngang, bảng Thú/Tủ đồ rộng 490 px che thanh trong lúc mở; ✕ hoặc Escape là đóng.

## Vùng an toàn (tai thỏ, thanh Home)

Đặt ra ở nhiệm vụ T30. Trang dùng `viewport-fit=cover`, nên trên iPhone có tai thỏ, trang vẽ cả dưới tai thỏ và thanh Home. Phần đó là `env(safe-area-inset-*)`:
- iPhone cầm dọc ở Màn hình chính: trên 47-59 px, dưới 34 px;
- iPhone cầm ngang: trái và phải 44-59 px, dưới 21 px.

Luật: mọi thứ trên HUD nằm cách mép **ít nhất 12 px, hoặc phần vùng an toàn của cạnh đó nếu lớn hơn**, viết là `max(12px, env(...))`.
- Cột trái, cột nút phải, bản đồ nhỏ, thanh chiêu, nút cảm ứng, thanh máu trùm cộng phần đó. Các nút cột phải xuống theo lề trên, mỗi nút cách nhau 48 px như cũ.
- **Bảng Thú, Chế tạo, Tủ đồ** cùng công thức với bản đồ nhỏ:
  - mép trên `max(204, lề trên + 192)` (desktop), `max(196, lề trên + 184)` (dọc), luôn dưới vùng chạm 44 px của nút 👕 Tủ đồ;
  - đáy cách mép dưới `max(12, lề dưới)` (ngang `max(8, …)`), không nằm dưới thanh Home.
  - Trước T30, bảng khi cầm dọc mở ở top 196 cố định, nên trên iPhone có tai thỏ nó đè nút Tủ đồ 75×22 px.
- **Điện thoại ngang chỉ cao 375 px** (812×375 có tai thỏ, 667×375): cột hẹp lại theo luật "cột trước giữa màn hình 100 px". Từ T30 đến T61, ô trạng thái vì thế xuống 2 dòng, và thông báo kết thúc ở 246 và 260, quá mốc cao − 140 = 235. T61 giữ luật cột, và thu gọn hàng trạng thái (mục "Hàng trạng thái và nút 🔗 khi cầm ngang"): còn 214 và 228.
- **Kiểm thử:** e2e giả lập tai thỏ bằng CDP `Emulation.setSafeAreaInsetsOverride`. Chromium chưa có lệnh này thì viết lại `env(safe-area-inset-*)` trong `index.html` thành số px. Test kiểm lại rằng lề đã có tác dụng.

## Hàng trạng thái và nút 🔗 khi cầm ngang

Đặt ra ở nhiệm vụ T61 (số đo trong `PLAN.md` của commit kế hoạch T61). Áp dụng cho mọi điện thoại cầm ngang (cao ≤ 520 px, rộng ≥ 601 px); cầm dọc và desktop không đổi.

**Vấn đề:** trên màn cao 375 px, ô trạng thái xuống 2 dòng vì nút "🔗 Mời bạn" (88 px) không còn chỗ sau các con số. Thông báo vì thế kết thúc quá mốc ngón cái cao − 140 = 235:
- 812×375 có tai thỏ: 246;
- 667×375: 260.

**Bố cục cột khi cầm ngang**, từ trên xuống:
- **Hàng máu**, cao 69 px:
  - dòng 1: `☀️ ❤️ [thanh máu] 100/100`;
  - dòng 2: `[🫐 Ăn] [🔊] [🔗 Mời]`, cao 44 px.
- **Ô trạng thái**, một dòng: `👥 1/5 🐾 1 🪵 0 🪨 0 🫐 0` (thêm biểu tượng đồ nếu có).
- Ô nhiệm vụ, rồi thông báo (1 cái), như cũ.

**Luật:**
- **🔗 Mời nằm sau 🔊 trong hàng máu.**
  - Nhãn ngắn "🔗 Mời"; trình đọc màn hình đọc "Mời bạn" như ở mọi màn.
  - Vùng chạm 61×44 px. Vẫn nghe `click`, vì mở bảng chia sẻ cần cử chỉ người dùng.
  - Lý do: dòng 2 đã cao 44 px vì Ăn và 🔊, bên phải còn trống, nên nút vào đó không tốn thêm chiều cao nào.
  - Xoay máy thì nút đổi chỗ ngay; cầm dọc nó lại là "🔗 Mời bạn" ở cuối ô trạng thái.
- **Chữ giờ chỉ còn biểu tượng** (☀️ Ngày, 🌇 Hoàng hôn, 🌙 Đêm, 🌅 Bình minh), như tên vùng đã ẩn khi cầm ngang.
  - Lý do: lúc "Hoàng hôn", dòng 1 tràn ở 667 px, đẩy "100/100" xuống dòng 2 và cụm nút xuống dòng 3. Hàng máu khi đó cao 85 px, thông báo kết thúc ở 244.
  - Chữ vẫn có trong `title`. Ánh sáng của thế giới cũng cho biết giờ.
- **Ô trạng thái gọn:**
  - Mỗi con số (biểu tượng và số) không bị ngắt giữa chừng; giữa hai con số là 1 dấu cách + 2 px.
  - Chữ 12 px, line-height 1.4, đệm 3 px trên dưới: cao 23 px.
  - Số lớn thì vẫn xuống dòng giữa các con số, không cắt số nào.
- **Khoảng cách:** giữa các ô của cột 3 px, giữa 2 dòng của hàng máu 2 px.

**Kết quả** (thông báo dài nhất, có hay không có thanh máu trùm):

| Màn | Trước | Sau | Mốc |
|---|---|---|---|
| 812×375, tai thỏ 44 | 246 | 214 | 235 |
| 667×375 | 260 | 228 | 235 |
| 844×390 | 210 | 198 | 250 |
| 844×390, tai thỏ 47 | 246 | 214 | 250 |

**Còn tồn tại (việc riêng):**
- 640×360 (Android): 228 > 220 (trước là 260).
- Ô trạng thái rất đầy ở 667 px (3 tài nguyên ≥ 100, có đồ): xuống 2 dòng, 245 > 235 (trước là 279).

## Cần điều khiển và nút cảm ứng

Đặt ra ở nhiệm vụ T39. Trước đó vùng cần điều khiển được vẽ đè lên cột trái, nên trên điện thoại không chạm được 🔊, 🔗 Mời bạn và (khi cầm dọc) nút ⚪ Bóng: chạm vào là bật cần điều khiển.

- **Vùng cần điều khiển** là nửa trái màn hình và là **lớp dưới cùng của HUD**: nó chỉ nhận những chạm mà không thứ gì khác trong HUD nhận. Mọi nút ở nửa trái nằm trên nó: chạm đúng nút là bấm nút, không bật cần điều khiển.
- **Trên màn hình cảm ứng, các ô của cột trái** (hàng máu, trạng thái, nhiệm vụ) **cho chạm xuyên qua**, như thông báo. Chạm vào chỗ không phải nút là bật cần điều khiển.
  - Nhờ vậy cần điều khiển vẫn bật được trên 96% nửa trái, cả dọc lẫn ngang (đo ở T39). Nếu các ô chặn chạm thì chỉ còn 79% khi cầm dọc và 72% khi cầm ngang. Nhấn giữ trên chữ của ô cũng không bôi đen chữ.
  - Hệ quả: chỗ nhận chạm trong cột trái phải là nút (`<button>`).
- **Kéo cần điều khiển qua nút không bấm nút:** cần điều khiển giữ ngón của nó đến khi ngón nhấc lên. Ngược lại, ngón chạm xuống trên nút thì bấm nút, không bật cần điều khiển.
- **Nút dùng trong lúc ngón kia đang giữ cần điều khiển chạy ngay khi ngón chạm xuống** (`pointerdown`): Đánh, Bắt, 💨, ô chiêu, Tự động/Theo lệnh, 🫐 Ăn, ⚪/🔵 Bóng (từ T18).
  - Lý do: trên điện thoại, ngón thứ hai chạm vào nút không sinh ra `click`. Đo ở T39: khi nút Ăn còn nghe `click`, giữ cần điều khiển rồi chạm Ăn bằng ngón kia thì không ăn được.
  - Chuột vẫn bấm được (chuột cũng sinh `pointerdown`). Bàn phím dùng phím tắt (H cho Ăn), không dùng Enter trên nút.
- **🔗 Mời bạn phải nghe `click`.** Mở bảng chia sẻ hay chép link cần "cử chỉ của người dùng". Theo chuẩn HTML (Safari cũng vậy), một lần chạm chỉ cho cử chỉ đó lúc ngón nhấc lên.
- 🔊, nút mở bảng và nút trong bảng nghe `click`, vì không dùng trong lúc đang chạy.
- **Nút ⚪/🔵 Bóng** (T18): trên cảm ứng nằm sát bên trái nút Bắt, trên nút Đánh, ở nửa phải cả khi cầm dọc lẫn ngang. Trước đó, khi cầm dọc nó nằm đúng chỗ ngón cái trái đặt cần điều khiển, nên chạm nhầm là đổi bóng. Chọn bóng gắn với việc ném, nên đặt cạnh nút Bắt. Nhãn ngắn trên cảm ứng: "⚪ Thường" / "🔵 Xịn (N)" (trình đọc màn hình đọc tên đầy đủ); desktop giữ "⚪ Bóng thường" / "🔵 Bóng xịn (N)" ở góc phải dưới. Bàn phím: R.
- **Nút Bắt và phím E** (T28) ném vào thú có vòng ngắm dưới chân, cùng một con cho cả hai cách bấm. Luật chọn con và hình vòng ngắm ở `docs/design/pals.md`, mục "Thú đang nhắm và vòng ngắm". Không thêm nút hay phím nào.
- **Desktop** không có vùng cần điều khiển; các ô của cột vẫn nhận chuột như cũ, nên link mời trong ô trạng thái vẫn chọn và bấm được.

## Bàn phím khi hộp thoại hoặc bảng giữ focus

Đặt ra ở nhiệm vụ T19. Trước đó mọi phím của thế giới chạy bất kể focus ở đâu:
- hộp xác nhận thả thú đang mở mà Shift+Tab làm nhân vật lướt, W/A/S/D vẫn đi sau lớp mờ;
- Space trên nút có focus là đánh chứ không bấm nút.

**Phím của thế giới:**
- W, A, S, D và mũi tên;
- Space (đánh), Shift (lướt), E (ném bóng), B (đặt trại), R (đổi bóng), H (ăn), M (tắt tiếng), N (bản đồ), 1-3 (chiêu).

**Chúng tạm dừng khi:**
1. **Hộp xác nhận thả thú đang mở**, focus ở đâu cũng vậy. Hộp là hộp thoại chặn (`aria-modal`), mọi chạm đã bị chặn, nên phím cũng thế.
2. **Bàn phím đưa focus vào một bảng đang mở** (Thú, Chế tạo, Tủ đồ). Gồm hai cách:
   - người chơi Tab vào bảng;
   - bảng tự trả focus về một nút của nó sau một phím, ví dụ Escape đóng hộp xác nhận thì focus về "🕊️ Thả bớt".

**Lúc tạm dừng:**
- Nhân vật đứng lại ngay.
- Phím thế giới không gửi gì, và trình duyệt làm việc của nó:
  - Space hoặc Enter bấm nút đang có focus;
  - Tab, Shift+Tab chuyển focus (trong hộp chỉ đổi qua lại giữa "Giữ lại" và "Thả");
  - mũi tên cuộn danh sách.
- Phím đang giữ khi tạm dừng bắt đầu bị quên: hết tạm dừng phải nhấn lại mới đi, giống khi cửa sổ mất focus.

**Phím luôn chạy:**
- Escape: đóng hộp trước, lần sau đóng bảng.
- Q, C, T: mở và đóng bảng.

Bảng đóng (bằng bất kỳ cách nào) thì focus rời bảng, phím thế giới chạy lại ngay.

**Bấm chuột hay chạm vào nút trong bảng không làm tạm dừng**, dù trình duyệt vẫn để focus trên nút đó.
- Mở bảng bằng chuột rồi vẫn đi, đánh như thường. Space sau cú bấm chuột vẫn là đánh, không bấm lại nút vừa bấm.
- Lý do: người chơi desktop hay mở Chế tạo hay Tủ đồ trong lúc đi tới trại. Nếu cú bấm chuột làm dừng phím thì họ phải bấm ra thế giới mới đi tiếp được.
- Người dùng bàn phím thì cần Tab, Space, Enter cho bảng. Vì vậy chỉ focus do bàn phím mới dừng phím. Cách nhận biết thao tác gần nhất là phím hay `pointerdown`, không dùng `:focus-visible`: Chromium bật nó khi bấm bất kỳ phím nào, kể cả W.

**Ngoài phạm vi, giữ như cũ:**
- Nút HUD ngoài bảng (🔊, 🫐 Ăn, nút cột phải, thanh chiêu) không làm tạm dừng.
- Đang ở thế giới mà bấm Shift+Tab thì vẫn lướt một lần: Shift xuống trước Tab, lúc đó chưa biết Tab sẽ theo sau.
- Màn mất kết nối cũng không làm tạm dừng: hành động đã bị chặn khi mất mạng, và phím đang giữ được giữ qua lúc kết nối lại.
- Mở bảng bằng phím (Q, C, T) không đưa focus vào bảng, để phím đi không dừng giữa chừng.

## Cỡ chạm

Đặt ra ở nhiệm vụ T18 (số đo trong `PLAN.md` của commit kế hoạch T18).

- **Mọi chỗ ngón tay chạm được có vùng chạm ít nhất 44×44 px, ở cả ba khung hình, kể cả desktop**: sảnh, HUD, các bảng, hộp xác nhận. Lý do: máy tính bảng và laptop cảm ứng cũng nhận bố cục desktop.
  - Ngoại lệ duy nhất: link mời trong ô trạng thái desktop. Nó chỉ hiện trên máy không có màn hình cảm ứng; máy cảm ứng có nút 🔗 Mời bạn.
- **Hai cách:**
  - Tăng cỡ thật khi có chỗ: nút trong bảng, tab Tủ đồ, ô màu, nút kiểu tóc, ô tên, 🔊, Tự động, nút Bóng, ✕ đóng bảng.
  - Vùng chạm vô hình cao 44 px quanh nút nhỏ hình, khi tăng cỡ làm vỡ bố cục gọn: bốn nút cột phải và 🔗 Mời bạn. Hai vùng chạm không được chồng nhau, nên bốn nút cột phải cách nhau 48 px.
- **Đo bằng vùng chạm thật** (chạm thử từng điểm từ tâm nút ra), không bằng hộp bao: vùng vô hình không nằm trong hộp bao, còn phần bị nút khác đè thì không bấm được.
- **Hàng máu:** 🫐 Ăn và 🔊 (khi cầm ngang thêm 🔗 Mời, T61) luôn đi cùng nhau. Không đủ chỗ cạnh thanh máu thì cả cụm xuống dòng 2. Nhờ vậy khi cầm ngang hàng máu không đổi theo chữ giờ (trước T18 là 52-87 px), và thông báo vẫn kết thúc trên mốc màn hình − 140 px. Từ T61 hàng cao 69 px (trước là 72): dòng 2 sát dòng 1 hơn, và chữ giờ chỉ còn biểu tượng nên dòng 1 không bao giờ tràn.
- **Bảng không bao giờ tràn khỏi màn hình:** đáy cách mép dưới 12 px (ngang 8 px), hoặc phần thanh Home nếu lớn hơn (T30, mục "Vùng an toàn").
- **Thẻ thú:**
  - Cầm dọc và desktop: nút xếp một cột.
  - Cầm ngang: bảng Thú rộng 490 px như Tủ đồ, nút xếp 2 cột (nút thứ ba trải cả hai cột), nên thẻ cao khoảng 120 px và thấy 2 thẻ trọn trong bảng.
  - Tên thẻ không bao giờ tách "Lv" khỏi số; tên dài thì xuống dòng trước "Lv".
- **Sảnh:** cầm ngang, ô tên và nút "Vào chơi" chung một hàng. Điện thoại dọc thấp hơn 760 px: hình nhân vật nhỏ lại (80%) và khoảng cách hẹp hơn, để nút "Vào chơi" vẫn hiện mà không phải cuộn. Vào phòng lỗi thì dòng lỗi luôn được cuộn vào tầm nhìn.

## Nút 🫐 Ăn

Đặt ra ở nhiệm vụ T32. Nút nằm trong hàng máu, phím **H**. Luật hồi máu và lý do của các con số ở `docs/design/pals.md`, mục "Hồi máu của người chơi".

- **Bấm khi ăn được:** ăn 1 quả mọng, hồi 20 máu ngay. "+20 ❤" bay lên trên đầu (người ở gần cũng thấy), kèm tiếng hồi máu. Rồi nút **hồi 4 giây** mới ăn tiếp được.
- **Lúc nút đang hồi:** giống ô chiêu của thú. Một lớp tối phủ nút và thu dần từ trên xuống; số giây còn lại (4, 3, 2, 1) hiện ở giữa; chữ "🫐 Ăn" mờ đi.
  - Bấm lúc này (chạm hay H): nút lắc nhẹ, không gửi gì và **không có thông báo**.
  - Lý do: số giây trên nút đã nói vì sao. Lúc nguy cấp người chơi hay bấm liên tục; nếu mỗi lần bấm ra một thông báo thì ô thông báo sẽ ngập, đẩy mất tin quan trọng.
- **Không ăn được vì lý do khác:** vẫn là thông báo mức thấp như trước: "Hết 🫐 quả mọng", "Máu đang đầy".
  - Server kiểm theo thứ tự: hết quả, rồi máu đầy, rồi mới đến hồi chiêu. Lý do nào nói được bằng thông báo thì được nói trước.
  - Lần bị từ chối không làm nút hồi lại: bấm lúc đầy máu rồi bị cắn ngay thì vẫn ăn được liền.
- **Nút hồi tính từ lúc tin của server tới máy** (không đoán trước). Vì vậy nút không bao giờ sẵn sàng sớm hơn server. Mạng chậm thì lớp tối hiện trễ một nhịp; lần bấm thứ hai trong lúc đó bị server bỏ qua, không mất quả.
- **Cỡ:** cao và rộng ít nhất 44 px ở cả ba khung hình.
- **Chạm:** như mọi nút, nút nằm trên vùng cần điều khiển, nên chạm đúng nút là ăn chứ không bật cần điều khiển.
  - Nút chạy ngay khi ngón chạm xuống (mục "Cần điều khiển và nút cảm ứng"), nên ăn được cả khi ngón kia đang giữ cần điều khiển.
  - Chuột: bấm. Bàn phím: H.

## Thông báo (toast)

**Chỗ hiện.** Ngay dưới ô nhiệm vụ (hoặc dưới thanh máu trùm khi nó thế chỗ ô nhiệm vụ), trong cột trái. Cột cao bao nhiêu thì thông báo tự xuống theo, nên không bao giờ đè lên các ô của cột, các nút bên phải hay bản đồ. Rộng theo cột, desktop tối đa 420 px. Chữ đậm 15 px (điện thoại 13 px) trên nền đen mờ. Thông báo quan trọng có viền vàng bên trái.

**Bao nhiêu cái cùng lúc.** Tối đa 2, xếp theo thứ tự hiện, cái mới ở dưới. Chỉ 1 cái khi:
- điện thoại ngang (màn hình cao ≤ 520 px): để góc ngón cái trái trống cho cần điều khiển. Thông báo phải kết thúc trên mốc cao − 140 px (T18), cả trên màn chỉ cao 375 px (T61);
- màn dọc thấp hơn 790 px (ví dụ Safari trên iPhone khi có thanh địa chỉ): cột trái nằm ngay trên đầu nhân vật, 2 thông báo sẽ đè lên tên mình (trước T62 mốc là 760);
- màn dọc từ 790 px trở lên mà 2 thông báo dài nhất không vừa giữa cột trái và tên mình (mục "Thông báo và tên mình khi cầm dọc").

### Thông báo và tên mình khi cầm dọc

Đặt ra ở nhiệm vụ T62 (số đo trong `PLAN.md` của commit kế hoạch T62). Áp dụng cho màn dọc (rộng < cao) cao ≥ 790 px. Điện thoại ngang, desktop và màn ngang khác không đổi.

**Vấn đề:** khi cầm dọc, cột trái kết thúc ngay trên đầu nhân vật. Trước T62, hai thông báo dài nhất (mỗi cái 3 dòng, cao 61 px) đè tên mình:
- 390×760: 4 px, 12 px khi bị thương;
- 390×844 có tai thỏ 47 px: 5 px khi bị thương và tóc cao;
- 393×852 có tai thỏ 59 px: 13 px; 375×812 có tai thỏ 44 px: 31 px;
- ô nhiệm vụ 3 dòng ("Hái 3 bụi quả", 86 px thay vì 57) và mũ phù thủy (cao hơn tóc 13 px) còn làm tệ hơn: tới 57 px.

Lý do: số chỗ chỉ tính theo chiều cao màn hình. Nó không tính tai thỏ (cột xuống theo `env(safe-area-inset-top)`), thanh máu dưới tên khi bị thương (đẩy tên lên 8 px), kiểu tóc hay mũ (tóc xoăn cao 55,8, mũ phù thủy 68,9, tóc buộc hai bên 46,3 đơn vị thế giới), và ô nhiệm vụ cao bao nhiêu.

**Luật:** màn dọc cao ≥ 790 px chỉ hiện 2 thông báo khi **2 thông báo dài nhất vừa giữa cột và tên mình, cách tên ít nhất 4 px**:
- chỗ bắt đầu thông báo: đo thật trên màn, ngay dưới ô nhiệm vụ hoặc thanh máu trùm. Nhờ vậy tai thỏ và ô nhiệm vụ cao bao nhiêu đều đã được tính;
- mép trên tên mình: tính lúc đứng yên, theo chiều cao màn hình, độ phóng của camera và chiều cao nhân vật lúc này (tóc, mũ). **Luôn coi như đang bị thương** (có thanh máu dưới tên), vì lúc đánh nhau thanh máu hiện, ẩn liên tục, và lúc đó lại nhiều thông báo nhất;
- mỗi thông báo coi như cao 61 px (3 dòng chữ 13 px, cái dài nhất), cách nhau 4 px.

Không vừa thì chỉ 1 cái; cái thứ hai chờ, như khi cầm ngang. Thông báo đang hiện không bị cắt. Số chỗ được tính lại mỗi khi có thông báo mới, và trong lúc có thông báo đang chờ thì tính lại mỗi 250 ms. Màn ngang và desktop không cần đo gì.

**Kết quả** (hai thông báo dài nhất, đã bị thương; số là khoảng cách từ đáy thông báo cuối đến mép trên tên mình, âm là đè):

| Màn | Trường hợp | Trước | Sau |
|---|---|---|---|
| 390×760 | ô nhiệm vụ đầu, tóc xoăn | 2 cái, −12 | 1 cái, +52 |
| 390×760 | ô nhiệm vụ 3 dòng, mũ phù thủy | 2 cái, −53 | 1 cái, +12 |
| 390×844, tai thỏ 47 | ô nhiệm vụ đầu, tóc xoăn | 2 cái, −5 | 1 cái, +59 |
| 390×844, tai thỏ 47 | thanh máu trùm, tóc xoăn | 2 cái, +14 | 2 cái, +14 (không đổi) |
| 390×844 | ô nhiệm vụ đầu, mũ phù thủy | 2 cái, +18 | 2 cái, +18 (không đổi) |
| 390×844 | ô nhiệm vụ 3 dòng, mũ phù thủy | 2 cái, −11 | 1 cái, +54 |
| 393×852, tai thỏ 59 | ô nhiệm vụ đầu, tóc xoăn | 2 cái, −13 | 1 cái, +51 |
| 412×915, 430×932 tai thỏ 59, 768×1024 | mọi trường hợp | 2 cái, ≥ +35 | 2 cái, không đổi |

**Còn tồn tại (việc riêng):**
- Màn dọc thấp (390×664, 375×667): ngay cả 1 thông báo cũng đè tên khi ô nhiệm vụ 3 dòng hoặc đội mũ cao (tới 36 px).
- Đang đi lên, camera theo sau nên tên mình cao hơn lúc đứng yên tới 19 px (ở 390 px rộng). Luật chỉ tính lúc đứng yên.

**Ba mức quan trọng.**

| Mức | Gồm | Hiện ít nhất |
|---|---|---|
| Cao | lên cấp (kèm chiêu mới), "Bắt được …", phần thưởng (trùm, rương, trại lên cấp, thú làm được khi vắng), xong nhiệm vụ, tin ★ về thú đầu đàn | 3 giây |
| Thường | mẹo, cảnh báo (lạnh, nóng, lãnh địa thú đầu đàn, bị ngất, thú kiệt sức), xác nhận việc đã làm (đã làm, đã thả, đã dựng trại, cho ăn bánh), thú thoát khỏi bóng, đã kết nối lại | 2,5 giây |
| Thấp | phản hồi khi bấm mà không làm được (không có thú ở gần, máu đầy, hết quả mọng, chưa có bóng xịn, chiêu chưa học, túi đầy, chỗ không dựng trại được...), đến vùng mới, đã chép link mời | 1,8 giây |

**Thời gian hiện:** 1 giây cộng 55 ms cho mỗi ký tự, không dưới mức "hiện ít nhất", không quá 7 giây. Ví dụ: "Máu đang đầy" 1,8 giây, "Bắt được Leafkit! 🎉" 3 giây, lên cấp kèm chiêu mới khoảng 3,9 giây, phần thưởng trùm khoảng 5 giây.

**Khi đã hết chỗ.**
- Thông báo mới thay cái yếu nhất đang hiện (mức thấp nhất, cùng mức thì cái cũ nhất) nếu cái đó thấp mức hơn. Cùng mức thì cũng thay, trừ mức cao: với phản hồi, cái mới nhất mới là cái cần đọc.
- Thông báo mức cao không bao giờ bị thay hay cắt ngắn.
- Không thay được thì chờ: mức cao chờ đến lượt, mức thường chờ tối đa 4 giây, mức thấp 1 giây; quá thì bỏ. Hàng chờ giữ tối đa 4 cái (thừa thì bỏ cái yếu nhất, cũ nhất).
- Có chỗ trống thì cái đang chờ mạnh nhất (mức cao nhất, rồi cũ nhất) hiện, đủ thời gian của nó.

**Trùng chữ.** Trùng với cái đang hiện thì cái đó hiện lâu thêm (tính lại từ lúc này), không thêm cái mới. Trùng với cái đang chờ thì bỏ qua.

**Tin của server.** Mỗi tin `Notice` có loại (`kind`), client đổi ra mức:

| `kind` | Mức | Ví dụ |
|---|---|---|
| `refused` | thấp | "Máu đang đầy", "Chỗ này vướng cây hoặc đá" |
| `done` | thường | "Đã thả Pebblet. Tạm biệt! 👋", "Đã làm 🔵 Bóng xịn" |
| `warning` | thường | cảnh báo lạnh, nóng; bị ngất; thú kiệt sức |
| `reward` | cao | phần thưởng trùm, rương báu, trại lên cấp, thú làm được khi vắng |
| `quest` | cao | "Xong nhiệm vụ …", hiện sau 2,1 giây để việc làm xong nhiệm vụ (bóng đang lắc, đồ trong rương bay ra) diễn xong |
| `news` | cao | "★ Hiệp đã hạ Voltmouse đầu đàn!" (gửi cả thế giới). Tin bắt được "★ Hiệp đã bắt được Voltmouse đầu đàn!" gửi mọi người trừ người bắt: người bắt đã đọc "★ Bắt được Voltmouse đầu đàn! 🎉" (T8) |

**Âm thanh và hiệu ứng** (lấp lánh khi lên cấp, tiếng bóng khép) chạy ngay khi sự kiện đến, kể cả khi chữ của nó phải chờ.

**Ví dụ (luật trên, thời gian tính từ sự kiện):**
- Hạ trùm: phần thưởng và "lên cấp 8, học chiêu mới" hiện cùng lúc. "Xong nhiệm vụ" đến lúc 2,1 giây, chờ đến khi tin lên cấp hết (khoảng 3,9 giây). Không mất tin nào.
- Bắt thú đầu đàn, xong luôn nhiệm vụ cuối:
  - Người bắt thấy cùng lúc "★ Bắt được Voltmouse đầu đàn! 🎉" (1,9 giây) và "Xong nhiệm vụ" (2,1 giây).
  - Tin lên cấp (2,2 giây) chờ đến 4,9 giây mới hiện. Cả cảnh khoảng 9 giây.
  - Người bắt không nhận tin ★ (T8). Trước đó họ đọc hai tin cho cùng một việc và cảnh dài khoảng 10 giây; khi điện thoại ngang (1 chỗ) thì thêm 3 giây.
  - Những người khác thấy "★ Hiệp đã bắt được Voltmouse đầu đàn!" lúc 2,2 giây.
- Con thú đầu tiên: "Bắt được Leafkit! 🎉" và "Xong nhiệm vụ "Bắt con thú đầu tiên"" hiện cùng lúc. Mẹo "Thú choáng" đang hiện thì bị thay (đã hiện hơn 3 giây).
- Đang có tin lên cấp, bấm liên tục những phím không làm được: tin lên cấp vẫn ở nguyên; ô thứ hai chỉ hiện phản hồi mới nhất.
- Vừa ăn quả mọng, bấm Ăn liên tục trong 4 giây hồi: không thông báo nào hiện thêm, chỉ nút lắc.

**Chữ.** Ngắn, đủ một ý. Nhắc phím hay nút thì theo thiết bị: desktop "ném bóng (E)", cảm ứng "bấm Bắt". Một món kèm số lượng (`rewardText`: "🫐 10") không bị xuống dòng giữa biểu tượng và số.
