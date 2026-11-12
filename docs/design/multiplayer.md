# Chơi nhiều người: vào, rời và mất mạng

Luật của một phiên chơi (từ T3; phần mở game từ T1, T15; tải lại trang và lỗi khi vào thế giới từ T23; game không mở được sau khi vào từ T42; thế giới trống được giữ thêm một phút từ T49; giới hạn số thế giới từ T64). Phần kỹ thuật (hook nào, file nào) ở `docs/architecture.md`; kế hoạch và bằng chứng API ở `PLAN.md` của T3 và T15.

## Mở game: sảnh tải chậm hoặc hỏng

Sảnh (ngoại hình, tên, nút "Vào chơi") chỉ dùng được khi script game đã tải và chạy xong. Trước đó ô tên và nút bị khoá, nút ghi "Đang tải..." (T1). Trang tự canh việc tải này bằng một đoạn script nhỏ nằm sẵn trong trang, nên đoạn này vẫn chạy khi chính script game hỏng (T15):

| Tình huống | Người chơi thấy | Khi nào |
|---|---|---|
| Tải bình thường | "Đang tải..." rồi "Vào chơi" | khoảng 1 giây ở 4G tốt, 5 giây ở 4G chậm |
| Mạng chậm, vẫn đang tải | dưới nút "Đang tải...": "Vẫn đang tải… Mạng có vẻ chậm. Chờ thêm chút, hoặc bấm Tải lại." cùng nút **Tải lại** phụ. Tải xong thì sảnh tự mở, thông báo biến mất | sau 15 giây chưa xong |
| Tải hỏng: mất mạng giữa chừng, file thiếu (server vừa đổi bản) | thẻ "Không tải được game", dòng "Kiểm tra mạng rồi bấm Tải lại." và nút **Tải lại** đang có focus (Enter là tải lại); ô tên và nút "Đang tải..." ẩn đi | ngay khi trình duyệt báo lỗi tải |
| Script chạy lỗi (thường do trình duyệt quá cũ) | như trên, dòng giữa là "Trình duyệt gặp lỗi khi mở game. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt." | ngay khi lỗi |
| Trình duyệt tắt JavaScript | "Cần bật JavaScript để chơi PetGame." | luôn |

- **Tải lại** mở lại đúng địa chỉ đang có, giữ `?room=` của link mời và mọi tham số khác. Có link mời thì thông báo ghi thêm "Link mời vẫn được giữ."
- Thông báo "mạng chậm" không chặn gì, không đổi nút "Đang tải..." và không lấy focus. Chỉ khi trình duyệt báo lỗi thật mới hiện thẻ "Không tải được game".
- Vì sao chờ 15 giây: script sảnh của bản build khoảng 960 kB (server chưa nén). Đo được sảnh sẵn sàng sau 5,3 giây ở 4G chậm (1,6 Mbps), 11,3 giây ở 3G (750 kbps), 20,7 giây ở 3G chậm (400 kbps). Với 15 giây, mạng từ 3G trở lên không bị làm phiền, còn người bị treo mạng không phải chờ quá lâu mới có nút Tải lại.
- Phạm vi: chỉ lúc tải trang, trước khi sảnh dùng được. Lỗi khi bấm "Vào chơi" là mục "Vào thế giới: lỗi và cách đi tiếp" (T23) và "Vào được nhưng game không mở được" (T42). Mất mạng khi đang chơi là màn che kết nối ở mục "Quay lại".

## Thế giới không còn ai: giữ thêm 60 giây (T49)

Người cuối cùng rời đi thì thế giới **chưa đóng ngay** mà còn mở thêm **60 giây** (`EMPTY_WORLD_HOLD_MS`). Ai vào lại trong khoảng đó (tải lại trang, bạn bè mở link mời, cả nhóm cùng tải lại) thì về đúng thế giới ấy. Hết 60 giây mà không ai vào thì thế giới đóng (trễ thêm tối đa khoảng 1 giây).

| Người cuối cùng | Thế giới đóng lúc |
|---|---|
| Rời chủ động (đóng tab, tải lại, Về sảnh) | 60 giây sau khi rời |
| Rớt mạng và không quay lại | sau 20 giây chờ nối lại (mục "Rời chủ động và rớt mạng"), thêm 60 giây nữa: khoảng 80-89 giây sau khi mất mạng |
| Tạo thế giới nhưng chưa kịp vào (mạng hỏng giữa chừng) | 60 giây sau khi tạo |
| Server khởi động lại | ngay, cùng mọi thế giới |

- Hai khoảng chờ nối tiếp nhau, không chồng: trong 20 giây chờ nối lại, người rớt mạng vẫn ở trong thế giới, nên thế giới chưa "không còn ai". Khoảng 60 giây chỉ bắt đầu khi người cuối cùng thật sự đã ra.
- Trong lúc không còn ai, **thế giới vẫn chạy như thường**: thú hoang đi lại và mọc thêm, ngày đêm vẫn trôi, trùm, thú đầu đàn, rương và quả mọng vẫn hồi theo giờ. Người quay lại thấy thế giới đã trôi đi một phút, như khi họ vắng mặt mà bạn bè vẫn chơi.
- Có người vào thì thế giới thôi đếm giờ; người cuối cùng ra lần nữa thì đếm lại từ đầu 60 giây.
- Hồ sơ không bị ảnh hưởng: người chơi được lưu đúng một lần lúc ra (như trước), trong lúc không còn ai không có gì để lưu, người vào lại đọc hồ sơ vừa lưu.
- Thế giới trống vẫn vào được bằng link mời (`?room=`) như lúc có người. Không ai bị ghép ngẫu nhiên vào đó: game chỉ tạo thế giới mới hoặc vào theo link.

Vì sao 60 giây:
- Tải lại trang rồi bấm "Vào chơi": sảnh sẵn sàng sau 5,3 giây ở 4G chậm, 11,3 giây ở 3G, 20,7 giây ở 3G chậm (số đo của mục "Mở game"), cộng vài giây để bấm. 60 giây đủ cho 3G chậm và người chơi còn kịp đọc sảnh.
- Mất mạng: màn "Không kết nối lại được" hiện sau 30 giây (`RECONNECT_TRY_MS`). Trường hợp xấu nhất (server biết mất mạng ngay, trang biết trễ 8 giây), thế giới còn mở ít nhất 20 + 60 − 30 − 8 = 42 giây sau khi nút **Về sảnh** hiện, đủ cho 3G chậm.
- Giá phải trả nhỏ: một thế giới trống tốn khoảng 0,07 ms mỗi nhịp (0,13% một nhân CPU) và khoảng 0,35 MB bộ nhớ.

## Giới hạn số thế giới (T64)

Mỗi lần bấm "Vào chơi" mà không có link mời (hoặc bấm **Tạo thế giới mới**) là tạo một thế giới, và thế giới đó sống ít nhất 60 giây (mục trên). Để một script không mở hàng trăm thế giới làm chậm server, việc **tạo** thế giới có hai trần (bảng `WORLD_LIMITS`):

| Trần | Số | Đếm gì | Bị chặn thì |
|---|---|---|---|
| Cả server | **50** thế giới | mọi thế giới đang mở: có người, đang giữ 60 giây, kể cả vừa tạo chưa ai vào | thẻ "Server đang có quá nhiều thế giới" |
| Mỗi mạng | **10** thế giới | thế giới **được tạo từ cùng một địa chỉ mạng** và còn mở (có người hay không) | thẻ "Đã mở nhiều thế giới quá" |

- Chỉ việc tạo bị giới hạn. **Vào thế giới có sẵn** (link mời, tải lại trang, nối lại) không bao giờ bị chặn, kể cả khi đã chạm trần.
- "Địa chỉ mạng" là địa chỉ IP mà server thấy. Cả nhà dùng chung Wi-Fi là chung một địa chỉ. IPv6 tính theo cả khối /64 (một thiết bị IPv6 có thể đổi địa chỉ trong khối đó). Địa chỉ IPv4 viết dạng IPv6 (`::ffff:…`, cả dạng chấm lẫn dạng hex) tính như IPv4. Server không biết địa chỉ thì mọi yêu cầu như vậy chung một khoá `unknown`, không được miễn.
- Thế giới đóng (hết 60 giây không ai, hoặc server khởi động lại) thì trả lại chỗ ngay.
- Vì mỗi thế giới sống ít nhất 60 giây, trần 10 cũng là giới hạn tốc độ: một mạng tạo được tối đa 10 thế giới trong một phút. Không cần thêm bộ đếm theo thời gian.

Thẻ ở sảnh (thêm vào bảng "Vào thế giới: lỗi và cách đi tiếp"):

| Tình huống | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Server đã có 50 thế giới | Server đang có quá nhiều thế giới | Chưa tạo thêm được thế giới mới. Chờ một lát rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | **Thử lại** |
| Mạng này đã mở 10 thế giới | Đã mở nhiều thế giới quá | Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau 1 phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | **Thử lại** |

- Không có nút "Tạo thế giới mới": Thử lại chính là tạo lại.
- Người chơi một mình quay lại thế giới đã đóng (T49: tự vào thế giới mới, không thẻ) mà bị chặn lúc tạo thì thấy thẻ của lần tạo đó; địa chỉ đã bỏ `room`, nên Thử lại cũng là tạo mới.

Vì sao các số này:
- Một thế giới trống tốn khoảng 0,13% một nhân CPU và 0,35 MB (số đo T49). Trước T64, một script gọi tạo thế giới 5 lần mỗi giây giữ được khoảng 300 thế giới (39% một nhân, 105 MB). Nay một địa chỉ giữ được tối đa 10 (1,3%, 3,5 MB), cả server tối đa 50 (6,5%, 17,5 MB khi trống).
- 10 mỗi mạng: một nhà 5 người, mỗi người một thế giới riêng, cộng mỗi người lỡ mở thêm một thế giới trong lúc thế giới cũ còn giữ 60 giây, là 10.
- 50 cả server: tới 250 người chơi cùng lúc, quá sức một máy 512 MB dùng chung (`fly.toml`). Máy mạnh hơn thì người vận hành nâng bằng biến môi trường (`docs/deploy.md`).
- Server chạy sau proxy (Fly, Render) phải được cấu hình để lấy đúng địa chỉ người chơi; nếu không, mọi người chung một địa chỉ và trần 10 chặn nhầm người thật. Cách kiểm ở `docs/deploy.md`.

## Tải lại trang: về đúng thế giới (T23, T49)

Trong lúc chơi, thanh địa chỉ luôn ghi nơi mà lần mở trang sau sẽ đưa người chơi tới (đổi tại chỗ, không tải lại trang):

| Lúc | Địa chỉ |
|---|---|
| Đang chơi, có bạn bè hay một mình | có `?room=<thế giới>`, như link mời |
| Mất hẳn kết nối | đúng địa chỉ mà nút **Về sảnh** mở (luật ở mục "Quay lại") |
| Server khởi động lại | không có `room` (mọi thế giới đã đóng) |

- Vì vậy tải lại trang, hay Safari mở lại một tab mà iOS đã dỡ ở nền, đưa người chơi về đúng thế giới đang chơi, nếu thế giới còn mở (còn người, hoặc chưa hết 60 giây giữ thế giới trống).
- Chơi một mình cũng ghi `room` (từ T49): tải lại trong vòng 60 giây là về đúng thế giới cũ, nên link mời vừa gửi cho bạn bè vẫn dùng được.
- Vẫn qua sảnh: người chơi bấm "Vào chơi" một lần, nút có sẵn focus (Enter là vào). Sảnh không tự vào, vì link mời cũng có `?room=` mà người được mời cần chọn tên, ngoại hình trước.
- Chữ trên sảnh khi quay lại theo lần cuối tab này thấy thế giới:
  - có bạn bè: "Quay lại thế giới bạn đang chơi cùng bạn bè";
  - một mình: không ghi gì, sảnh như lần mở thường.
- Một mình mà thế giới đã đóng (quay lại sau hơn 60 giây, ví dụ mở lại tab hôm sau): **không có thẻ lỗi**. Bấm "Vào chơi" là vào ngay một thế giới mới cùng bản đồ, như trước T23. Với người chơi một mình, thế giới cũ hay mới trông như nhau (bắt đầu ở giữa bản đồ, đầy máu; thú, đồ, trại theo thiết bị).
- Có bạn bè mà thế giới đã đóng (mọi người đã rời đi hơn 60 giây): thẻ "Thế giới này đã đóng" ở mục dưới, vì người chơi đang mong gặp bạn bè.
- Vào lại từ sảnh là phiên mới: bắt đầu ở giữa bản đồ, đầy máu (như mục "Quay lại").
- Trang nhớ (trong `sessionStorage` của tab) thế giới vừa chơi và lần cuối có bạn bè trong đó không, chỉ để chọn chữ trên sảnh và cách báo khi thế giới đã đóng. Địa chỉ mới là thứ quyết định vào đâu. Tab cũ (trước T49) không có dấu bạn bè thì coi như có bạn bè.
- Giới hạn: app mở từ Màn hình chính (PWA) luôn mở lại từ `/`, nên chưa về được thế giới cũ.

## Vào thế giới: lỗi và cách đi tiếp (T23)

Vào hỏng thì nút "Vào chơi" nhường chỗ cho một thẻ (cùng kiểu thẻ "Không tải được game"), nút chính có sẵn focus; ô tên và ngoại hình vẫn sửa được. Trong lúc đang vào, nút ghi "Đang vào...". Sảnh ở lại cho đến khi thế giới đã vẽ xong (T42), nên không bao giờ có màn hình tối không chữ.

| Tình huống | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Thế giới đã đóng, người chơi đang quay lại thế giới có bạn bè | Thế giới này đã đóng | Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn. | **Tạo thế giới mới** |
| Thế giới đã đóng (link mời cũ hoặc sai) | Thế giới này đã đóng | Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới. | **Tạo thế giới mới** |
| Đủ 5 người (tính cả chỗ đang giữ 20 giây cho người rớt mạng) | Thế giới đã đủ 5 người | Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới. | **Thử lại**, Tạo thế giới mới (phụ) |
| Mất mạng, server không chạy hoặc đang khởi động lại | Không kết nối được server | Kiểm tra mạng rồi bấm Thử lại. | **Thử lại** |
| Tạo thế giới bị chặn vì server hoặc mạng này đã mở quá nhiều thế giới (T64) | xem mục "Giới hạn số thế giới" | | **Thử lại** |
| Lỗi khác | Không vào được thế giới | Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại. | **Thử lại** |

- Người chơi quay lại thế giới mà lần cuối chỉ có mình họ thì không gặp thẻ "đã đóng": vào thẳng thế giới mới (mục "Tải lại trang").
- **Tạo thế giới mới** bỏ `room` khỏi địa chỉ rồi vào ngay một thế giới mới (cùng bản đồ).
- Biết thế giới đã đóng thì địa chỉ bỏ `room` ngay, nên tải lại ở thẻ này cũng ra thế giới mới, không gặp lại lỗi cũ.
- **Thử lại** vào lại đúng địa chỉ đang có (vẫn giữ link mời).

## Vào được nhưng game không mở được (T42)

Vào phòng được, nhưng phần vẽ thế giới không dựng nổi: thiếu một file của game (mạng chập chờn, hoặc tab cũ sau khi server vừa đổi bản), hoặc trình duyệt gặp lỗi khi vẽ. Sảnh vẫn còn (nó chỉ biến mất khi thế giới đã vẽ xong) và hiện thẻ:

| Nguyên nhân | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Thiếu file của game | Không tải được game | Kiểm tra mạng rồi bấm Tải lại. | **Tải lại** |
| Lỗi khác | Không mở được game | Trình duyệt gặp lỗi khi mở thế giới. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt. | **Tải lại** |

- Người chơi **rời thế giới ngay** (rời chủ động): bạn bè không thấy một nhân vật đứng im, chỗ trống lại ngay.
- Địa chỉ được ghi theo luật "Tải lại trang" ở trên trước khi rời: luôn giữ `?room=` (từ T49, cả khi một mình). **Tải lại** mở lại đúng địa chỉ đó: về thế giới vừa vào nếu nó còn mở (còn bạn bè, hoặc chưa hết 60 giây giữ thế giới trống); một mình mà thế giới đã đóng thì vào thế giới mới cùng bản đồ, không có thẻ lỗi.
- Chỉ có Tải lại, không có Thử lại: phần game hỏng chỉ lấy lại được khi tải lại trang (cũng là cách lấy bản mới sau khi server đổi bản). Ô tên và ngoại hình ẩn đi, như thẻ hỏng lúc mở game.
- Ảnh vẽ bằng AI hỏng hay thiếu (kể cả file danh mục ảnh sai) **không** làm hỏng việc vào: thú, cây, đá và nhân vật được vẽ bằng code như khi chưa có ảnh.

## Mỗi thiết bị một nhân vật

- Hồ sơ (thú, đồ, trại, nhiệm vụ, ngoại hình) gắn với token ngẫu nhiên mà trình duyệt giữ trên thiết bị.
- Trên server, một token chỉ có **một phiên đang sống**, ở bất kỳ thế giới nào. Thiết bị vào lần nữa (tab khác, tải lại trang, vào thế giới khác) thì phiên cũ được **lưu rồi kết thúc ngay**, trước khi phiên mới đọc hồ sơ. Tab cũ báo "Bạn đang chơi ở nơi khác".
- Hệ quả: không bao giờ có hai bản của cùng một người chơi, và bản cũ không thể ghi đè tiến trình mới.

## Rời chủ động và rớt mạng

| | Rời chủ động | Rớt mạng |
|---|---|---|
| Ví dụ | đóng tab, tải lại trang, bấm "Về sảnh" | 4G chập chờn, đổi Wi-Fi, khoá màn hình hoặc chuyển app lâu |
| Server biết bằng | tin rời phòng trang gửi lúc đóng | socket đóng bất thường, hoặc hết ping (sau 6-9 giây) |
| Nhân vật | lưu rồi xoá ngay, chỗ trong phòng trống ngay | ở lại **20 giây** (`RECONNECT_GRACE_MS`) chờ quay lại, vẫn giữ chỗ (kể cả khi phòng đủ 5 người) |

Nếu tin rời phòng không kịp đi (trang bị tắt đột ngột), server coi như rớt mạng: chờ 20 giây rồi mới xoá.

## Trong 20 giây chờ

- Nhân vật và mọi thú của họ ở ngoài (đi theo, làm việc ở trại) **đứng yên** tại chỗ. Người khác thấy hình mờ đi và tên kèm "(mất kết nối)".
- **Không gì nhắm tới hoặc gây sát thương**: thú hoang bỏ qua họ (đang đánh thì thôi), cắn, chiêu, dậm của trùm, lạnh và nóng đều không có tác dụng.
- **Thời gian như dừng**: không tự hồi máu, không mở rương, không tiến nhiệm vụ đi thăm vùng, thú làm việc không sản xuất, thú đi theo không đánh và không tung chiêu (chiêu đang gồng bị huỷ).
- Phần đã giành trước khi mất mạng vẫn được nhận: chiêu của thú đã bay ra vẫn rơi, cùng hạ trùm thì vẫn có thưởng.
- Server lưu hồ sơ ngay lúc phát hiện mất mạng, và lưu lần nữa khi xoá.

## Quay lại

- Trong khoảng chờ: game **tự kết nối lại**, đúng nhân vật, đúng chỗ, cùng thú đi theo. Màn hình hiện "Đang kết nối lại…" (không bấm, không đi được trong lúc này) rồi báo "Đã kết nối lại".
- Game thử tối đa 30 giây (`RECONNECT_TRY_MS`: 20 giây chờ cộng thời gian server có thể cần để phát hiện mất mạng). Quá hạn, hoặc server đã thôi giữ chỗ: "Không kết nối lại được" kèm nút **Về sảnh**. Nút này đưa về sảnh của đúng thế giới cũ (từ T49, cả khi chơi một mình): thế giới còn mở ít nhất 60 giây sau khi server thôi giữ chỗ (mục "Thế giới không còn ai"). Đã đóng thì như mục "Tải lại trang": một mình là vào thế giới mới ngay, có bạn bè thì thẻ "Thế giới này đã đóng". Thú, đồ và trại luôn còn.
- Server khởi động lại: "Server đang khởi động lại", cũng có nút Về sảnh; nút này về sảnh thường (thế giới mới cùng bản đồ), vì mọi thế giới đã đóng.
- Trang bị ẩn (chuyển app): nhân vật dừng đi ngay. Nếu trình duyệt vẫn giữ kết nối khi ẩn trang (có trên Android), nhân vật vẫn ở trong thế giới như người đứng yên, chưa được bảo vệ.
- Hồi chiêu của nút 🫐 Ăn (4 giây, từ T32) vẫn đếm trong lúc chờ và không bị xoá khi nối lại: nối lại sớm thì chờ nốt phần còn lại.
  - Vào lại từ sảnh là một phiên mới, nên không còn hồi chiêu.
  - Điều này không thành mẹo được, vì máu không được lưu: vào lại vốn đã đầy máu, và lại bắt đầu ở giữa bản đồ.

## Mã kết nối lại

- Do server cấp cho từng lần kết nối, chỉ dùng được cho đúng phiên đó, **một lần** (nối lại xong thì cấp mã mới), và hết hạn cùng khoảng chờ.
- Chỉ nằm trong bộ nhớ của trang, không lưu xuống máy. Nối lại không đổi được tên, token hay ngoại hình.

## Đã cân nhắc và chấp nhận

- Cắt mạng để thoát một trận đánh: được tối đa 20 giây an toàn, nhưng không làm gì được và không được lợi gì về đồ (ngất vốn không mất đồ). Chấp nhận vì game hợp tác, không có PvP.
- Phòng đủ 5 người mà một người đang được giữ chỗ: người khác (kể cả chính họ vào lại từ sảnh) phải chờ hết 20 giây. Họ quay lại tự động thì vẫn vào được.
- Tải lại trang không dùng mã kết nối lại (T23): mã chỉ sống 20 giây và dùng một lần, mà muốn dùng thì phải bỏ luật "tải lại = rời chủ động" (chỗ bị giữ 20 giây mỗi lần đóng tab). Ghi thế giới lên địa chỉ thì sống đến khi thế giới đóng, đổi lại vị trí và máu không được giữ.
- Link mời của người chơi một mình chỉ sống đến 60 giây sau khi họ rời đi (T49). Quay lại muộn hơn thì họ vào thế giới mới mà không được báo, nên link cũ đã gửi không dùng được nữa (bạn bè thấy "Thế giới này đã đóng"); nút 🔗 cho link mới. Chấp nhận để người chơi một mình không gặp thẻ lỗi mỗi lần mở lại tab.
- Thế giới trống vẫn chạy (không tạm dừng) trong 60 giây: rẻ (0,13% một nhân CPU mỗi thế giới), đồng hồ hẹn giờ của phòng chạy theo nhịp mô phỏng nên dừng mô phỏng là dừng cả hồi sinh và chính hẹn giờ đóng thế giới, và người quay lại thấy thời gian trôi đúng như khi vắng mặt.
- Ai cũng tạo được thế giới rồi rời ngay, mỗi cái sống 60 giây (trước T49: 15 giây nếu chưa ai vào). Từ T64 việc này bị giới hạn (mục "Giới hạn số thế giới").
- Kẻ phá có nhiều địa chỉ (từ 5 địa chỉ IPv4 hay 5 khối IPv6 /64) vẫn chiếm được hết 50 chỗ, khi đó không ai tạo được thế giới mới cho đến khi các thế giới của họ đóng. Chấp nhận: server không chậm đi (50 thế giới trống chỉ tốn 6,5% một nhân), thế giới đang chơi không bị ảnh hưởng và link mời vẫn vào được. Muốn chặn hơn nữa cần tài khoản hoặc captcha, quá tầm game chơi với bạn bè.
- Giữ một kết nối trong mỗi thế giới thì thế giới không đóng, như trước T49. Trần 10 mỗi mạng đếm cả thế giới có người, nên cách này cũng không vượt được 10.
