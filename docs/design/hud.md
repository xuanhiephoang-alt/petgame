# Giao diện trên màn hình (HUD) và thông báo

Chữ, nút và bảng nằm đè lên thế giới: phần tử DOM, CSS trong `packages/client/index.html`, code ở `packages/client/src/ui/`. Kiểm tra ở ba khung hình chuẩn: desktop 1280×720, điện thoại dọc 390×844, điện thoại ngang 844×390. Đặt ra ở nhiệm vụ T6. Nhãn tên trên đầu người và thú (T5) ở `docs/design/pals.md`, mục "Nhãn tên và thanh máu".

## Bố cục

| Vùng | Desktop | Điện thoại dọc | Điện thoại ngang |
|---|---|---|---|
| Cột trái trên (`.hud-left`), từ trên xuống: hàng máu và giờ (kèm nút 🫐 Ăn, 🔊), trạng thái, nhiệm vụ, rồi **thông báo** | rộng tối đa 460 px | rộng 100vw − 140 px | rộng tối đa 300 px, chữ 12 px, ẩn tên vùng và dòng "Thưởng" của nhiệm vụ |
| Cột phải trên: 🐾 Thú, 🏕️ Đặt trại, 🔨 Chế tạo, 👕 Tủ đồ (cách nhau 48 px), bản đồ nhỏ | bản đồ dưới các nút (top 204) | bản đồ dưới các nút (top 196) | bản đồ bên trái các nút |
| Bảng Thú, Chế tạo, Tủ đồ | dưới cột nút phải (top 204), rộng 340 | top 196, rộng 340 | bên trái cột nút; Thú và Tủ đồ rộng 490 |
| Giữa trên: thanh máu trùm (khi ở gần trùm) | rộng 420 px | rộng 60vw | rộng 200 px, nằm giữa cột trái và bản đồ |
| Dưới: thanh chiêu, nút bóng, nút cảm ứng (Đánh, Bắt, 💨) | thanh chiêu ở giữa, nút bóng góc phải dưới | bên phải; nút bóng bên trái nút Bắt | bên phải; nút bóng bên trái nút Bắt |
| Cần điều khiển (chỉ cảm ứng) | không có | hiện ở chỗ ngón trái chạm, ở bất cứ đâu trong nửa trái màn hình trừ trên nút (kể cả trên các ô của cột trái và thông báo) | như dọc |

- Nhân vật luôn ở giữa màn hình. Ở điện thoại ngang, cột trái phải kết thúc trước giữa màn hình ít nhất 100 px (844×390: cột đến x = 312, giữa là 422), để không che nhãn tên của người và thú quanh nhân vật.
- Lớp vẽ, từ dưới lên: nhãn tên (z 1), HUD (z 2). Trong HUD: **vùng cần điều khiển (−1, dưới cùng)**, các ô và nút (không đặt z), bảng Thú, Chế tạo, Tủ đồ (3), **thông báo (4)**, bản đồ phóng to (4, vẽ sau thông báo), hộp xác nhận thả thú (5), màn mất kết nối (6). Thông báo không nhận chạm; chạm xuyên qua nó.
- Còn tồn tại, làm ở việc riêng: trên điện thoại dọc, thanh máu trùm đè lên hàng máu của người chơi.

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
- **Hàng máu:** 🫐 Ăn và 🔊 luôn đi cùng nhau. Không đủ chỗ cạnh thanh máu thì cả cặp xuống dòng 2. Nhờ vậy khi cầm ngang hàng máu luôn cao 72 px, không đổi theo chữ giờ (trước đó 52-87 px), và thông báo vẫn kết thúc trên mốc màn hình − 140 px.
- **Bảng không bao giờ tràn khỏi màn hình:** đáy cách mép dưới 12 px (ngang 8 px).
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

**Chỗ hiện.** Ngay dưới ô nhiệm vụ, trong cột trái. Cột cao bao nhiêu thì thông báo tự xuống theo, nên không bao giờ đè lên các ô của cột, các nút bên phải hay bản đồ. Rộng theo cột, desktop tối đa 420 px. Chữ đậm 15 px (điện thoại 13 px) trên nền đen mờ. Thông báo quan trọng có viền vàng bên trái.

**Bao nhiêu cái cùng lúc.** Tối đa 2, xếp theo thứ tự hiện, cái mới ở dưới. Chỉ 1 cái khi:
- điện thoại ngang (màn hình cao ≤ 520 px): để góc ngón cái trái trống cho cần điều khiển;
- điện thoại dọc thấp hơn 760 px (ví dụ Safari trên iPhone khi có thanh địa chỉ): cột trái nằm ngay trên đầu nhân vật, 2 thông báo sẽ đè lên nhân vật.

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
