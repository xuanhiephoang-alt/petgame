# Chơi nhiều người: vào, rời và mất mạng

Luật của một phiên chơi (từ T3; phần mở game từ T1, T15, T44; tải lại trang và lỗi khi vào thế giới từ T23; game không mở được sau khi vào từ T42; thế giới trống được giữ thêm một phút từ T49; giới hạn số thế giới từ T64, trần theo khối IPv6 /48 từ T67; nhận ra thế giới của chính mình ở tab mới từ T65; mở game khi mất mạng và app ở Màn hình chính từ T13; nút quay lại thế giới cùng bạn bè khi mở ở `/` từ T79; vào lại chỗ vừa mất vì mạng giật và bỏ lần thử kết nối lại bị treo từ T24). Phần kỹ thuật (hook nào, file nào) ở `docs/architecture.md`; kế hoạch và bằng chứng API ở `PLAN.md` của T3 và T15.

## Mở game: sảnh tải chậm hoặc hỏng

Sảnh (ngoại hình, tên, nút "Vào chơi") chỉ dùng được khi script game đã tải và chạy xong. Trước đó ô tên và nút bị khoá, nút ghi "Đang tải..." (T1). Trang tự canh việc tải này bằng một đoạn script nhỏ nằm sẵn trong trang, nên đoạn này vẫn chạy khi chính script game hỏng (T15):

| Tình huống | Người chơi thấy | Khi nào |
|---|---|---|
| Tải bình thường | "Đang tải..." rồi "Vào chơi" | khoảng 1 giây ở 4G tốt, 5 giây ở 4G chậm |
| Mạng chậm, vẫn đang tải | dưới nút "Đang tải...": "Vẫn đang tải… Mạng có vẻ chậm. Chờ thêm chút, hoặc bấm Tải lại." cùng nút **Tải lại** phụ. Tải xong thì sảnh tự mở, thông báo biến mất | sau 15 giây chưa xong |
| Tải hỏng: mất mạng giữa chừng, file thiếu (server vừa đổi bản) | thẻ "Không tải được game", dòng "Kiểm tra mạng rồi bấm Tải lại." và nút **Tải lại** đang có focus (Enter là tải lại); ô tên và nút "Đang tải..." ẩn đi | ngay khi trình duyệt báo lỗi tải |
| Script chạy lỗi (thường do trình duyệt quá cũ) | như trên, dòng giữa là "Trình duyệt gặp lỗi khi mở game. Bấm Tải lại; nếu vẫn lỗi, hãy cập nhật trình duyệt." | ngay khi lỗi |
| Trình duyệt quá cũ, không chạy được game (không hỗ trợ module: IE11, iOS ≤ 10.2, Chrome ≤ 60...) | thẻ "Hãy cập nhật trình duyệt", dòng giữa "Trình duyệt này quá cũ nên không mở được PetGame...", địa chỉ trang để chép sang trình duyệt khác; không có nút (tải lại trên cùng trình duyệt không giúp gì); ô tên và nút ẩn | ngay khi mở trang, không chờ 15 giây |
| Trình duyệt tắt JavaScript | "Cần bật JavaScript để chơi PetGame." | luôn |
| Mất mạng, mở game đã từng mở trên máy này qua HTTPS (T13) | sảnh hiện như thường, lấy từ bộ nhớ của máy (không có ô chọn ngoại hình: ảnh nhân vật không được lưu sẵn). Bấm "Vào chơi" thì thẻ "Không kết nối được server" của mục "Vào thế giới" | ngay |

- **Tải lại** mở lại đúng địa chỉ đang có, giữ `?room=` của link mời và mọi tham số khác. Có link mời thì thông báo ghi thêm "Link mời vẫn được giữ."
- **Luôn lấy bản mới khi có mạng (T13).** Trang game (sảnh) luôn được lấy từ server trước; bộ nhớ của máy chỉ dùng khi không có mạng. Vì vậy **Tải lại** sau khi server vừa đổi bản luôn ra bản mới, không bao giờ ra trang cũ trỏ tới file đã bị xoá. Các file script đã đánh số phiên bản (`/build/…`) lấy từ bộ nhớ nếu có. Không lưu gì của việc vào thế giới (`/matchmake`, kết nối WebSocket) hay `/whoami`. Chỉ có khi địa chỉ là HTTPS hoặc `localhost`: chơi qua Wi-Fi bằng `http://192.168.…` (Cách A của `docs/choi-tren-iphone.md`) thì trình duyệt không cho lưu, game chạy như trước T13. Bộ nhớ đó không bao giờ là lý do game không mở (T82): nếu bộ nhớ của trình duyệt hỏng, game lấy mọi thứ từ mạng như khi chưa lưu gì. Mở được lúc mất mạng chỉ khi trước đó đã mở game (hoặc app ở Màn hình chính) có mạng ít nhất một lần.
- Sau một lần báo nhầm (thẻ lỗi hiện rồi sảnh vẫn mở được), focus chuyển từ nút Tải lại về ô tên. Không có báo nhầm thì focus không bị đụng.
- Thông báo "mạng chậm" không chặn gì, không đổi nút "Đang tải..." và không lấy focus. Chỉ khi trình duyệt báo lỗi thật mới hiện thẻ "Không tải được game".
- Vì sao chờ 15 giây: 11 file của sảnh khoảng 1 MB, server gửi bản nén sẵn (brotli, còn khoảng 280 kB; T43). Đo được sảnh sẵn sàng sau 2,0 giây ở 4G chậm (1,6 Mbps), 4,2 giây ở 3G (750 kbps), 6,8 giây ở 3G chậm (400 kbps) (trước T43, chưa nén: 5,3, 11,3 và 20,7 giây). Với 15 giây, mạng từ 3G trở lên không bị làm phiền, còn người bị treo mạng không phải chờ quá lâu mới có nút Tải lại.
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
- Tải lại trang rồi bấm "Vào chơi": sảnh sẵn sàng sau 2,0 giây ở 4G chậm, 4,2 giây ở 3G, 6,8 giây ở 3G chậm (số đo của mục "Mở game"; trước T43: 5,3, 11,3, 20,7 giây), cộng vài giây để bấm. 60 giây đủ cho 3G chậm và người chơi còn kịp đọc sảnh.
- Mất mạng: màn "Không kết nối lại được" hiện sau 30 giây (`RECONNECT_TRY_MS`). Trường hợp xấu nhất (server biết mất mạng ngay, trang biết trễ 8 giây), thế giới còn mở ít nhất 20 + 60 − 30 − 8 = 42 giây sau khi nút **Về sảnh** hiện, đủ cho 3G chậm.
- Giá phải trả nhỏ: một thế giới trống tốn khoảng 0,07 ms mỗi nhịp (0,13% một nhân CPU) và khoảng 0,35 MB bộ nhớ.

## Giới hạn số thế giới (T64)

Mỗi lần bấm "Vào chơi" mà không có link mời (hoặc bấm **Tạo thế giới mới**) là tạo một thế giới, và thế giới đó sống ít nhất 60 giây (mục trên). Để một script không mở hàng trăm thế giới làm chậm server, việc **tạo** thế giới có ba trần (bảng `WORLD_LIMITS`):

| Trần | Số | Đếm gì | Bị chặn thì |
|---|---|---|---|
| Cả server | **50** thế giới | mọi thế giới đang mở: có người, đang giữ 60 giây, kể cả vừa tạo chưa ai vào | thẻ "Server đang có quá nhiều thế giới" |
| Mỗi địa chỉ | **10** thế giới | thế giới **được tạo từ cùng một địa chỉ mạng** (IPv4, hoặc khối IPv6 /64) và còn mở (có người hay không) | thẻ "Đã mở nhiều thế giới quá" |
| Mỗi khối IPv6 /48 (T67) | **20** thế giới | như trên, nhưng gộp mọi địa chỉ IPv6 chung 48 bit đầu (một khách hàng của nhà mạng). Không áp cho IPv4 | thẻ "Đã mở nhiều thế giới quá" (cùng thẻ trên) |

- Chỉ việc tạo bị giới hạn. **Vào thế giới có sẵn** (link mời, tải lại trang, nối lại) không bao giờ bị chặn, kể cả khi đã chạm trần.
- "Địa chỉ mạng" là địa chỉ IP mà server thấy. Cả nhà dùng chung Wi-Fi là chung một địa chỉ. IPv6 tính theo cả khối /64 (một thiết bị IPv6 có thể đổi địa chỉ trong khối đó). Địa chỉ IPv4 viết dạng IPv6 (`::ffff:…`, cả dạng chấm lẫn dạng hex) tính như IPv4, nên chỉ chịu trần mỗi địa chỉ, không chịu trần /48.
- Một thế giới tạo từ IPv6 được đếm cho **cả hai** trần: khối /64 của nó (trần 10) và khối /48 chứa khối đó (trần 20). Chạm trần nào trước thì bị chặn.
- Địa chỉ có cổng hoặc ngoặc vuông do proxy ghi (`1.2.3.4:5678`, `[2001:db8::1]:443`) được bỏ cổng, bỏ ngoặc rồi tính như trên (T67).
- Server không có địa chỉ, hoặc chuỗi địa chỉ không phải IP (`unknown`, header lạ), thì mọi yêu cầu như vậy chung **một** khoá `unknown` với trần mỗi địa chỉ (10), không được miễn (T67; trước đó mỗi chuỗi lạ là một khoá riêng). Lần đầu gặp, server ghi một dòng cảnh báo (không ghi địa chỉ) để người vận hành kiểm `PETGAME_TRUST_PROXY`.
- Thế giới đóng (hết 60 giây không ai, hoặc server khởi động lại) thì trả lại chỗ ở mọi trần ngay.
- Vì mỗi thế giới sống ít nhất 60 giây, các trần cũng là giới hạn tốc độ: một địa chỉ tạo được tối đa 10 thế giới trong một phút, một khối /48 tối đa 20. Không cần thêm bộ đếm theo thời gian.

Thẻ ở sảnh (thêm vào bảng "Vào thế giới: lỗi và cách đi tiếp"):

| Tình huống | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Server đã có 50 thế giới | Server đang có quá nhiều thế giới | Chưa tạo thêm được thế giới mới. Chờ một lát rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | **Thử lại** |
| Địa chỉ này đã mở 10 thế giới, hoặc khối IPv6 /48 này đã mở 20 | Đã mở nhiều thế giới quá | Mạng bạn đang dùng đã mở nhiều thế giới cùng lúc. Thế giới không còn ai sẽ tự đóng sau 1 phút: chờ chút rồi bấm Thử lại, hoặc vào thế giới của bạn bè bằng link mời. | **Thử lại** |

- Không có nút "Tạo thế giới mới": Thử lại chính là tạo lại.
- Người chơi một mình quay lại thế giới đã đóng (T49: tự vào thế giới mới, không thẻ) mà bị chặn lúc tạo thì thấy thẻ của lần tạo đó; địa chỉ đã bỏ `room`, nên Thử lại cũng là tạo mới.

Vì sao các số này:
- Một thế giới trống tốn khoảng 0,13% một nhân CPU và 0,35 MB (số đo T49). Trước T64, một script gọi tạo thế giới 5 lần mỗi giây giữ được khoảng 300 thế giới (39% một nhân, 105 MB). Nay một địa chỉ giữ được tối đa 10 (1,3%, 3,5 MB), cả server tối đa 50 (6,5%, 17,5 MB khi trống).
- 10 mỗi mạng: một nhà 5 người, mỗi người một thế giới riêng, cộng mỗi người lỡ mở thêm một thế giới trong lúc thế giới cũ còn giữ 60 giây, là 10.
- 50 cả server: tới 250 người chơi cùng lúc, quá sức một máy 512 MB dùng chung (`fly.toml`). Máy mạnh hơn thì người vận hành nâng bằng biến môi trường (`docs/deploy.md`).
- Trần /48 (T67): nhà mạng cấp cho mỗi khách hàng IPv6 cả một khối /56 (256 khối /64) hay /48 (65 536 khối /64); tunnel IPv6 miễn phí cũng cho /48. Chỉ có trần /64 thì một người, một máy ở nhà, đổi địa chỉ qua 5 khối /64 là chiếm hết 50 chỗ. Gộp theo /48 vì đó là khối lớn nhất cấp cho một khách hàng: gộp /56 thì người có /48 vẫn có 256 khối /56. Với trần 20, một khách hàng giữ được tối đa 20 thế giới (2,6% một nhân, 7 MB khi trống), còn 30 chỗ cho người khác; phải có 3 khối /48 riêng mới chiếm hết, tức là "kẻ phá nhiều địa chỉ" đã chấp nhận ở dưới.
- Vì sao 20 chứ không 10: nhà mạng di động cấp mỗi điện thoại một khối /64 riêng nhưng xếp nhiều thuê bao lạ vào chung một khối /48. Một nhóm 5 bạn cùng nhà mạng ở cùng thành phố, mỗi người một thế giới cộng một thế giới lỡ mở thêm, là 10; trần 20 còn dư 10 cho người lạ chung khối. Muốn bị chặn nhầm thì riêng một khối /48 phải đang mở 20 thế giới, tức 40% sức chứa cả server; với game chơi cùng bạn bè, lúc đó server cũng sắp chạm trần 50. Mức chặn nhầm này vẫn nhẹ hơn IPv4 qua CGNAT (nhiều thuê bao lạ chung một địa chỉ IPv4 với trần 10), là điều T64 đã chấp nhận. Điện thoại chỉ có IPv6 mà vào server IPv4 qua NAT64/464XLAT thì server thấy địa chỉ IPv4 của nhà mạng: trần /48 không áp.
- Gộp chuỗi không phải IP vào một khoá `unknown` (T67): các chuỗi này chỉ đến được khi socket không còn địa chỉ (client đã cắt kết nối) hoặc khi `PETGAME_TRUST_PROXY` đặt cao hơn số proxy thật; khi đó trước T67 kẻ phá đổi chuỗi rác mỗi lần là tạo được không giới hạn trong trần 50. Nay mọi chuỗi rác chung trần 10. Proxy hợp lệ ghi kèm cổng thì đã được bỏ cổng ở trên, nên không ai bị dồn vào `unknown` chỉ vì cổng.
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
- App mở từ Màn hình chính (PWA) luôn mở lại từ `/` (`start_url` của `manifest.webmanifest`), không có `?room=`. Chỉ ảnh hưởng khi app bị đóng hẳn rồi mở lại (iOS dỡ app ở nền); chuyển app qua lại thì trang vẫn còn và kết nối lại như mục "Quay lại". Từ T79 sảnh ở `/` có nút phụ để về thế giới vừa chơi cùng bạn bè: mục "Mở lại ở `/` ngay sau khi chơi cùng bạn bè" bên dưới.
- iPhone: app ở Màn hình chính dùng bộ nhớ riêng, không chung `localStorage` với Safari (hành vi của iOS; cần kiểm trên máy thật). Tên, token thiết bị và danh sách thế giới nằm ở đó, nên lần đầu mở app là **một người chơi mới**: thú, đồ, trại đã có trong Safari không theo sang. Đề xuất việc riêng (trong `PLAN.md` của T13) để mang hồ sơ sang app.

### Dấu trang, địa chỉ dán sang tab mới (T65)

Từ T49 địa chỉ lúc chơi một mình cũng có `?room=`. Tab mới (dấu trang, dán lại địa chỉ, mở lại trình duyệt) không có trí nhớ của tab cũ, nên trước T65 nó coi địa chỉ của chính mình là link mời: "Bạn được mời vào thế giới của bạn bè", rồi nếu thế giới đã đóng thì thẻ "Xin bạn bè link mời mới". Từ T65 **thiết bị** (không chỉ tab) nhớ các thế giới đã vào gần đây:

- Nhớ **20 thế giới** gần nhất (`localStorage`, chung mọi tab của trình duyệt đó), mỗi thế giới kèm "lần cuối thấy có bạn bè không". Ghi cùng lúc với địa chỉ (lúc vào, và khi có bạn bè vào hay ra hết). Từ T79 mỗi thế giới còn kèm giờ thiết bị ở trong đó lần cuối, ghi thêm theo nhịp và lúc rời trang (mục "Mở lại ở `/` ngay sau khi chơi cùng bạn bè").
- Mở trang ở `?room=X`: tab này vừa ở X thì dùng trí nhớ của tab (như trên). Không thì xem X có trong danh sách của thiết bị không. Thấy thì coi như **quay lại** (không phải được mời):

| Lần cuối ở X | Chữ trên sảnh | X còn mở | X đã đóng |
|---|---|---|---|
| Một mình | không ghi gì (nút "Vào chơi" có sẵn focus) | vào X | vào ngay thế giới mới cùng bản đồ, **không thẻ** |
| Có bạn bè | "Quay lại thế giới bạn đang chơi cùng bạn bè" | vào X | thẻ "Thế giới này đã đóng" / "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn." / **Tạo thế giới mới** |
| Không có trong danh sách (máy khác, link bạn bè gửi mà chưa vào bao giờ, quá 20 thế giới trước) | "Bạn được mời vào thế giới của bạn bè" (như trước) | vào X | thẻ "đã đóng" chữ link mời (như trước) |

- Mở bằng một thế giới trong danh sách thì thế giới đó được đưa lên đầu danh sách. Vì vậy một dấu trang dùng mỗi ngày không bao giờ bị quên, dù mỗi lần dùng lại mở một thế giới mới. Chỉ dấu trang bỏ không dùng trong khi thiết bị đã vào thêm 20 thế giới khác mới trở lại thành "được mời".
- Vì sao 20: chơi một mình thì mỗi lần quay lại sau hơn 60 giây là một thế giới mới, nên 20 là khoảng 20 buổi chơi (vài tuần nếu chơi một hai lần mỗi ngày). Danh sách khoảng 1,2 kB (kể cả giờ của T79). Quên thì vẫn có đường đi tiếp (thẻ có nút Tạo thế giới mới).
- Id thế giới do server sinh ngẫu nhiên và không dùng lại, nên một id có trong danh sách chắc chắn là thế giới thiết bị này đã vào. Link bạn bè gửi tới thế giới mình đã chơi cùng họ cũng được coi là "quay lại": đúng cả hai cách.
- Tab mới mở ở thế giới mà tab cũ đang chơi: sảnh không ghi gì (một mình) hay ghi "Quay lại…" (có bạn bè). Vào thì phiên ở tab cũ kết thúc như mục "Mỗi thiết bị một nhân vật".
- Trình duyệt chặn hoặc xoá `localStorage` (chế độ riêng tư, xoá dữ liệu trang) thì như trước T65: link được coi là link mời. Xoá dữ liệu trang cũng xoá token, tức là một người chơi mới.

### Mở lại ở `/` ngay sau khi chơi cùng bạn bè (T79)

App ở Màn hình chính luôn mở `/`, và người chơi cũng có thể gõ thẳng địa chỉ game hay mở dấu trang không có `?room=`. Khi đó "Vào chơi" tạo thế giới mới, kể cả khi bạn bè vẫn đang chờ trong thế giới vừa chơi. Từ T79 sảnh ở `/` xem **thế giới thiết bị ở trong gần nhất**:

| Thế giới đó, lúc thiết bị ở trong lần cuối | Sảnh ở `/` |
|---|---|
| Có bạn bè, cách đây không quá **10 phút** | thêm nút phụ **Quay lại thế giới cùng bạn bè** ngay dưới "Vào chơi" (điện thoại ngang: cùng hàng, bên phải "Vào chơi") |
| Chỉ có mình | như trước: chỉ "Vào chơi" |
| Quá 10 phút, không rõ giờ (danh sách ghi trước T79), hoặc đã biết thế giới đó đóng | như trước |

- "Thế giới ở trong gần nhất" là thế giới có giờ ở trong lần cuối muộn nhất, chỉ tính lúc đang kết nối. Mở một link hay dấu trang mà chưa vào thì không tính. Ví dụ: chơi cùng bạn bè, rồi tự vào một thế giới một mình, thì không có nút (người chơi đã chủ động rời bạn bè).
- **Bấm nút:** địa chỉ thêm `?room=` của thế giới đó rồi vào ngay, dùng tên và ngoại hình đang chọn ở sảnh (như "Vào chơi").
  - Thế giới còn mở: về đúng thế giới đó, gặp lại bạn bè. Là phiên mới: bắt đầu ở giữa bản đồ, đầy máu (mục "Quay lại").
  - Đã đóng: thẻ "Thế giới này đã đóng" / "Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn." / **Tạo thế giới mới** (mục "Vào thế giới: lỗi và cách đi tiếp").
  - Lỗi khác (đủ 5 người, mất mạng...): thẻ tương ứng; **Thử lại** là thử vào lại đúng thế giới đó.
- "Vào chơi" vẫn là nút chính và không đổi: tạo thế giới mới; Enter trong ô tên là "Vào chơi". Không nút nào tự lấy focus. Bàn phím: Tab từ "Vào chơi" sang nút phụ, Enter hay Space để bấm.
- Bấm một trong hai nút thì trong lúc đang vào ("Vào chơi" ghi "Đang vào..."), nút phụ **ở yên chỗ cũ, mờ đi và không bấm được nữa** (từ T83): sảnh không nhảy, và bấm bằng phím thì focus ở lại trên nút phụ chứ không rơi ra ngoài. Vào được thì sảnh biến mất như thường. Vào hỏng thì thẻ thay chỗ cả hai nút, nút phụ ẩn đi cho đến khi mở lại trang; từ đó đi tiếp theo thẻ (focus ở nút chính của thẻ).
- Điện thoại ngang (màn thấp): nút phụ nằm cùng hàng với ô tên và "Vào chơi" (ô tên hẹp lại), nên sảnh cao đúng như khi không có nút; tiêu đề không bị đẩy sát mép trên (T83). Trình duyệt quá cũ không hiểu quy tắc này (trước Safari 15.4) thì nút xuống hàng riêng và sảnh cuộn được một chút.
- Nút chỉ có ở `/`. Mở bằng `?room=` thì theo các mục trên (chữ "Quay lại…" hay "Bạn được mời…"), không có nút phụ. Sảnh ở `/` không có dòng chữ gợi ý nào: tên nút đã nói đủ.
- Biết thế giới đã đóng (thẻ "đã đóng" ở bất kỳ đường nào, hoặc màn "Server đang khởi động lại") thì thiết bị quên giờ của thế giới đó: lần mở sau không mời quay lại nữa. Thế giới vẫn ở trong danh sách, nên dấu trang của nó vẫn được nhận là "quay lại" (T65).
- Mở `/` ở tab khác trong lúc tab cũ vẫn đang chơi cùng bạn bè: nút có hiện; bấm thì phiên ở tab cũ kết thúc như mục "Mỗi thiết bị một nhân vật" (bấm "Vào chơi" cũng vậy).
- Không hỏi server trước khi hiện nút (như T65): sảnh không thêm yêu cầu nào trước khi sẵn sàng. Mất mạng (sảnh lấy từ bộ nhớ máy, T13) thì nút vẫn hiện; bấm thì thẻ "Không kết nối được server".

Giờ ở trong lần cuối:
- Mỗi thế giới trong danh sách (T65) kèm giờ thiết bị **đang kết nối** trong đó lần cuối. Ghi khi vào và khi bạn bè vào hay ra hết (như T65), **mỗi 60 giây** trong lúc kết nối, khi **trang bị ẩn** (chuyển app, khoá màn hình, đổi tab) và khi **đóng trang**. Đang kết nối lại hay đã mất kết nối thì không ghi.
- Vì sao không chỉ ghi lúc đóng trang: iOS dỡ app đang nằm nền mà không báo cho trang, nên lúc "đóng trang" có thể không bao giờ đến. Lúc trang bị ẩn là lần cuối trình duyệt điện thoại báo chắc chắn. Nhịp 60 giây che nốt trình duyệt bị tắt đột ngột khi đang mở, và giữ giờ đúng khi trang ẩn mà vẫn kết nối (Android giữ kết nối khi ẩn). Mỗi lần ghi khoảng 1,2 kB, một lần mỗi phút: không đáng kể.
- Danh sách cũ không có giờ thì coi như đã lâu: không có nút, mọi luật T65 giữ nguyên. Tab chạy bản cũ (trước T79) ghi lại danh sách thì mất giờ: lại coi như đã lâu (hỏng theo hướng an toàn, chỉ mất nút).
- Đồng hồ máy bị chỉnh lùi: giờ đã lưu nằm ở tương lai quá 10 phút thì coi như không có giờ (thế giới đó không được mời, cũng không che các thế giới khác); lệch ít hơn thì vẫn tính.

Vì sao 10 phút (`RETURN_OFFER_MS` = `EMPTY_WORLD_HOLD_MS` 1 phút + `FRIENDS_STAY_MS` 9 phút):
- **1 phút chắc chắn còn mở:** người chơi rời đi thì thế giới còn được giữ ít nhất 60 giây (mục "Thế giới không còn ai"), dù bạn bè đã đi hết. Rớt mạng thì còn thêm 20 giây chờ nối lại.
- **9 phút nhờ bạn bè:** sau đó thế giới chỉ còn mở nếu bạn bè còn chơi. Lấy một buổi chơi 40 phút (`docs/design/pals.md`), người chơi bước ra vào một lúc bất kỳ, bạn bè chơi hết buổi: sau 9 phút bạn bè vẫn còn trong khoảng 31/40 ≈ 78% số lần. Ở cuối khoảng 10 phút, nút vẫn đúng khoảng 3 lần trong 4; sớm hơn thì đúng nhiều hơn. Với 20 phút chỉ còn khoảng 52%, nút nói "cùng bạn bè" mà sai gần một nửa.
- Lần bước ra hay gặp (trả lời tin nhắn, gửi link mời, một cuộc gọi ngắn) kéo dài vài phút; ngắn hơn 10 phút thì bỏ lỡ đúng những lần đó.
- Đoán sai rẻ: nút hiện mà thế giới đã đóng thì tốn một lần bấm và thẻ nói rõ "Mọi người đã rời đi", có sẵn **Tạo thế giới mới**. Không hiện mà thế giới còn mở thì người chơi phải xin bạn bè link mời mới. Vì vậy chọn khoảng dài nhất mà nút vẫn đúng phần lớn số lần.
- Nhịp ghi 60 giây làm giờ lưu chậm nhiều nhất 1 phút so với lúc rời thật (chỉ khi trang bị tắt mà không báo gì), một phần mười khoảng 10 phút.

## Vào thế giới: lỗi và cách đi tiếp (T23)

Vào hỏng thì nút "Vào chơi" nhường chỗ cho một thẻ (cùng kiểu thẻ "Không tải được game"), nút chính có sẵn focus; ô tên và ngoại hình vẫn sửa được. Trong lúc đang vào, nút ghi "Đang vào...". Sảnh ở lại cho đến khi thế giới đã vẽ xong (T42), nên không bao giờ có màn hình tối không chữ.

| Tình huống | Tiêu đề | Dòng giải thích | Nút |
|---|---|---|---|
| Thế giới đã đóng, người chơi đang quay lại thế giới có bạn bè | Thế giới này đã đóng | Mọi người đã rời đi. Thú, đồ và trại của bạn vẫn còn. | **Tạo thế giới mới** |
| Thế giới đã đóng (link mời cũ hoặc sai, thiết bị chưa từng vào thế giới đó; T65) | Thế giới này đã đóng | Mọi người đã rời đi. Xin bạn bè link mời mới, hoặc tạo thế giới mới. | **Tạo thế giới mới** |
| Đủ 5 người (tính cả chỗ đang giữ 20 giây cho người rớt mạng) | Thế giới đã đủ 5 người | Chờ chút rồi bấm Thử lại, hoặc tạo thế giới mới. | **Thử lại**, Tạo thế giới mới (phụ) |
| Mất mạng, server không chạy hoặc đang khởi động lại | Không kết nối được server | Kiểm tra mạng rồi bấm Thử lại. | **Thử lại** |
| Tạo thế giới bị chặn vì server hoặc mạng này đã mở quá nhiều thế giới (T64) | xem mục "Giới hạn số thế giới" | | **Thử lại** |
| Lỗi khác | Không vào được thế giới | Có lỗi khi vào. Chờ giây lát rồi bấm Thử lại. | **Thử lại** |

- Người chơi quay lại thế giới mà lần cuối chỉ có mình họ thì không gặp thẻ "đã đóng": vào thẳng thế giới mới (mục "Tải lại trang"). Từ T65 điều này đúng cả khi mở ở tab mới hay từ dấu trang (mục "Dấu trang, địa chỉ dán sang tab mới").
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
- Mạng giật đúng lúc đang kết nối lại (server đã nhận lại nhưng kết nối đứt trước khi game biết) làm mất chỗ đang giữ. Game tự hỏi server rồi tải lại vào thẳng thế giới đó bằng token của thiết bị: người chơi đứng đúng chỗ cũ với đúng lượng máu cũ, thú và đồ còn nguyên. Màn hình hiện "Đang vào lại thế giới…". Tự vào lại tối đa một lần mỗi phút; lần thứ hai trong một phút thì "Không kết nối lại được" như thường. Chỗ cũ được nhớ 20 giây; thế giới đủ 5 người mà có người vào trước thì sảnh báo đủ người.
- Một lần thử kết nối lại bị treo (mạng nhận kết nối mà không trả lời, ví dụ Wi-Fi có trang đăng nhập) bị bỏ sau khoảng 8 giây để thử lần mới, nên không phải chờ hết 30 giây.
- Server khởi động lại: "Server đang khởi động lại", cũng có nút Về sảnh; nút này về sảnh thường (thế giới mới cùng bản đồ), vì mọi thế giới đã đóng.
- Trang bị ẩn (chuyển app): nhân vật dừng đi ngay. Nếu trình duyệt vẫn giữ kết nối khi ẩn trang (có trên Android), nhân vật vẫn ở trong thế giới như người đứng yên, chưa được bảo vệ.
- Hồi chiêu của nút 🫐 Ăn (4 giây, từ T32) vẫn đếm trong lúc chờ và không bị xoá khi nối lại: nối lại sớm thì chờ nốt phần còn lại.
  - Vào lại từ sảnh là một phiên mới, nên không còn hồi chiêu.
  - Điều này không thành mẹo được, vì máu không được lưu: vào lại từ sảnh vẫn đầy máu, và lại bắt đầu ở giữa bản đồ; trừ khi vào lại để lấy lại chỗ vừa mất kiểu trên (khi đó giữ đúng máu và chỗ, nên cũng không thành mẹo).

## Mã kết nối lại

- Do server cấp cho từng lần kết nối, chỉ dùng được cho đúng phiên đó, **một lần** (nối lại xong thì cấp mã mới), và hết hạn cùng khoảng chờ.
- Chỉ nằm trong bộ nhớ của trang, không lưu xuống máy. Nối lại không đổi được tên, token hay ngoại hình.
- Mã bị mất giữa chừng (mạng giật) thì dùng token thiết bị như trên.

## Đã cân nhắc và chấp nhận

- Hết 20 giây chờ thì không tự vào lại: server đã cố ý thả chỗ, và vào lại từ sảnh là phiên mới (T3, T23).
- Vào lại chỗ vừa mất (T24) bằng một lần tải trang, không dựng lại game ngay trong trang.
- `POST /resume` chỉ trả một bit, và người gọi phải biết cả id thế giới lẫn token thiết bị.
- Cắt mạng để thoát một trận đánh: được tối đa 20 giây an toàn, nhưng không làm gì được và không được lợi gì về đồ (ngất vốn không mất đồ). Chấp nhận vì game hợp tác, không có PvP.
- Phòng đủ 5 người mà một người đang được giữ chỗ: người khác (kể cả chính họ vào lại từ sảnh) phải chờ hết 20 giây. Họ quay lại tự động thì vẫn vào được.
- Tải lại trang không dùng mã kết nối lại (T23): mã chỉ sống 20 giây và dùng một lần, mà muốn dùng thì phải bỏ luật "tải lại = rời chủ động" (chỗ bị giữ 20 giây mỗi lần đóng tab). Ghi thế giới lên địa chỉ thì sống đến khi thế giới đóng, đổi lại vị trí và máu không được giữ.
- Link mời của người chơi một mình chỉ sống đến 60 giây sau khi họ rời đi (T49). Quay lại muộn hơn thì họ vào thế giới mới mà không được báo, nên link cũ đã gửi không dùng được nữa (bạn bè thấy "Thế giới này đã đóng"); nút 🔗 cho link mới. Chấp nhận để người chơi một mình không gặp thẻ lỗi mỗi lần mở lại tab.
- Thế giới trống vẫn chạy (không tạm dừng) trong 60 giây: rẻ (0,13% một nhân CPU mỗi thế giới), đồng hồ hẹn giờ của phòng chạy theo nhịp mô phỏng nên dừng mô phỏng là dừng cả hồi sinh và chính hẹn giờ đóng thế giới, và người quay lại thấy thời gian trôi đúng như khi vắng mặt.
- Ai cũng tạo được thế giới rồi rời ngay, mỗi cái sống 60 giây (trước T49: 15 giây nếu chưa ai vào). Từ T64 việc này bị giới hạn (mục "Giới hạn số thế giới").
- Kẻ phá có nhiều địa chỉ (từ 5 địa chỉ IPv4, hay từ T67 3 khối IPv6 /48 riêng) vẫn chiếm được hết 50 chỗ, khi đó không ai tạo được thế giới mới cho đến khi các thế giới của họ đóng. Chấp nhận: server không chậm đi (50 thế giới trống chỉ tốn 6,5% một nhân), thế giới đang chơi không bị ảnh hưởng và link mời vẫn vào được. Muốn chặn hơn nữa cần tài khoản hoặc captcha, quá tầm game chơi với bạn bè.
- Trần /48 (T67) không có trần tương ứng cho IPv4 (ví dụ theo /24): mỗi khách hàng IPv4 thường chỉ có một địa chỉ, và gộp /24 sẽ dồn cả khu dân cư vào một trần. Không xử lý riêng các dạng IPv6 hiếm: người dùng Teredo (`2001:0::/32`) qua cùng một server Teredo chung một khối /48; địa chỉ 6to4 (`2002::/16`) có /48 đúng bằng một địa chỉ IPv4 nên tự khớp. Các dạng IPv6 hiếm có IPv4 nhúng (`::a.b.c.d`, `64:ff9b::/96`) rơi vào cùng một khối /48 (ba nhóm đầu bằng 0 hoặc `64:ff9b:0`); không xử lý riêng. Không có ngoại lệ cho mạng di động: chưa có danh sách khối /48 di động đáng tin, và mức chặn nhầm đã tính ở mục "Giới hạn số thế giới".
- Giữ một kết nối trong mỗi thế giới thì thế giới không đóng, như trước T49. Trần 10 mỗi mạng đếm cả thế giới có người, nên cách này cũng không vượt được 10.
- Nhận ra thế giới của mình (T65) bằng danh sách trên thiết bị, không nhờ server theo token. Server không nhớ thế giới đã đóng, nên cách theo token cần thêm bảng lưu hoặc bộ nhớ riêng, thêm một lần hỏi server trước khi sảnh sẵn sàng hoặc đổi giao thức báo lỗi khi vào. Đổi lại không biết thêm gì: token cũng nằm trong `localStorage`, mất danh sách là mất luôn token. Danh sách không cho ai vào được đâu thêm: nó chỉ đổi chữ trên sảnh và cách báo khi thế giới đã đóng.
- Nút "Quay lại thế giới cùng bạn bè" (T79) có thể mời về một thế giới đã đóng (bạn bè rời hết trong 10 phút đó). Không hỏi server trước, vì sảnh không được chờ server trước khi sẵn sàng và thế giới vẫn có thể đóng giữa lúc hỏi và lúc bấm; thẻ "đã đóng" nói rõ ngay và thiết bị không mời lại thế giới đó nữa.
- Dấu trang cũ của thế giới có bạn bè vẫn ghi "Quay lại thế giới bạn **đang** chơi cùng bạn bè" dù đã lâu. Sảnh chưa biết thế giới còn mở hay không (không hỏi server trước khi bấm), và nếu đã đóng thì thẻ nói rõ ngay. Giữ một câu cho cả tải lại lẫn dấu trang.
