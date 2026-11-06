# Giao diện trên màn hình (HUD) và thông báo

Chữ, nút và bảng nằm đè lên thế giới: phần tử DOM, CSS trong `packages/client/index.html`, code ở `packages/client/src/ui/`. Kiểm tra ở ba khung hình chuẩn: desktop 1280×720, điện thoại dọc 390×844, điện thoại ngang 844×390. Đặt ra ở nhiệm vụ T6. Nhãn tên trên đầu người và thú (T5) ở `docs/design/pals.md`, mục "Nhãn tên và thanh máu".

## Bố cục

| Vùng | Desktop | Điện thoại dọc | Điện thoại ngang |
|---|---|---|---|
| Cột trái trên (`.hud-left`), từ trên xuống: hàng máu và giờ (kèm nút 🫐 Ăn, 🔊), trạng thái, nhiệm vụ, rồi **thông báo** | rộng tối đa 460 px | rộng 100vw − 140 px | rộng tối đa 300 px, chữ 12 px, ẩn tên vùng và dòng "Thưởng" của nhiệm vụ |
| Cột phải trên: 🐾 Thú, 🏕️ Đặt trại, 🔨 Chế tạo, 👕 Tủ đồ, bản đồ nhỏ | bản đồ dưới các nút | bản đồ dưới các nút | bản đồ bên trái các nút |
| Giữa trên: thanh máu trùm (khi ở gần trùm) | rộng 420 px | rộng 60vw | rộng 200 px, nằm giữa cột trái và bản đồ |
| Dưới: thanh chiêu, nút bóng, nút cảm ứng (Đánh, Bắt, 💨) | thanh chiêu ở giữa | bên phải | bên phải |
| Cần điều khiển (chỉ cảm ứng) | không có | hiện ở chỗ ngón trái chạm, trong nửa trái màn hình | như dọc |

- Nhân vật luôn ở giữa màn hình. Ở điện thoại ngang, cột trái phải kết thúc trước giữa màn hình ít nhất 100 px (844×390: cột đến x = 312, giữa là 422), để không che nhãn tên của người và thú quanh nhân vật.
- Lớp vẽ, từ dưới lên: nhãn tên (z 1), HUD (z 2). Trong HUD: nút 🫐 Ăn (1, để nằm trên vùng cần điều khiển), bảng Thú, Chế tạo, Tủ đồ (3), **thông báo (4)**, bản đồ phóng to (4, vẽ sau thông báo), hộp xác nhận thả thú (5), màn mất kết nối (6). Thông báo không nhận chạm; chạm xuyên qua nó.
- Còn tồn tại, làm ở việc riêng:
  - trên điện thoại dọc, thanh máu trùm đè lên hàng máu của người chơi;
  - trên điện thoại, vùng cần điều khiển (nửa trái màn hình) được vẽ sau cột trái nên nằm đè lên cột: chạm vào 🔊 hay 🔗 Mời bạn là bật cần điều khiển chứ không bấm nút (đo ở T32 bằng `elementFromPoint`, cả dọc lẫn ngang). Riêng nút 🫐 Ăn đã được nâng lên trên từ T32.

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
- **Cỡ:** cao và rộng ít nhất 44 px ở cả ba khung hình. Trên điện thoại, nút nằm trên vùng cần điều khiển: chạm đúng nút là ăn, không bật cần điều khiển.

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
| `news` | cao | "★ Hiệp đã hạ Voltmouse đầu đàn!" (gửi cả thế giới) |

**Âm thanh và hiệu ứng** (lấp lánh khi lên cấp, tiếng bóng khép) chạy ngay khi sự kiện đến, kể cả khi chữ của nó phải chờ.

**Ví dụ (luật trên, thời gian tính từ sự kiện):**
- Hạ trùm: phần thưởng và "lên cấp 8, học chiêu mới" hiện cùng lúc. "Xong nhiệm vụ" đến lúc 2,1 giây, chờ đến khi tin lên cấp hết (khoảng 3,9 giây). Không mất tin nào.
- Bắt thú đầu đàn: "Bắt được Voltmouse! 🎉" (1,9 giây) và "Xong nhiệm vụ" (2,1 giây) hiện cùng lúc. Tin ★ và tin lên cấp (2,2 giây) chờ rồi lần lượt hiện. Cả cảnh kéo dài khoảng 10 giây.
- Con thú đầu tiên: "Bắt được Leafkit! 🎉" và "Xong nhiệm vụ "Bắt con thú đầu tiên"" hiện cùng lúc. Mẹo "Thú choáng" đang hiện thì bị thay (đã hiện hơn 3 giây).
- Đang có tin lên cấp, bấm liên tục những phím không làm được: tin lên cấp vẫn ở nguyên; ô thứ hai chỉ hiện phản hồi mới nhất.
- Vừa ăn quả mọng, bấm Ăn liên tục trong 4 giây hồi: không thông báo nào hiện thêm, chỉ nút lắc.

**Chữ.** Ngắn, đủ một ý. Nhắc phím hay nút thì theo thiết bị: desktop "ném bóng (E)", cảm ứng "bấm Bắt". Một món kèm số lượng (`rewardText`: "🫐 10") không bị xuống dòng giữa biểu tượng và số.
