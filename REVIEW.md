PASS
# REVIEW: T51 Test e2e `labels:` trên điện thoại chập chờn, vòng 1

## Kết luận
Thay đổi đúng PLAN.md, chỉ đụng test (`tests/e2e/multiplayer.spec.ts`, `labelLayout.test.ts`) và `PROGRESS.md`; `labelLayout.ts`, `labels.ts`, `index.html` không đổi. Kiểm 3 giây vẫn bắt được lỗi bố cục kéo dài, chỉ bỏ qua lúc chuyển ngắn đúng thiết kế "Lúc chuyển". Test unit 12 có tác dụng thật: tôi thử hai bản `layoutTags` cố ý sai thì chỉ test 12 hỏng, test 1-11 vẫn qua.

## Lỗi phải sửa
Không có.

## Đã kiểm
- **Phép đo dùng chung:** `installLabelPairs` gắn `window.__labelPairs`, thân hàm giữ y nguyên bản cũ (bỏ nhãn `display: none` hoặc mờ dưới 0,5; chữ mờ trên 0,5; thanh máu đang hiện; đè hơn 1 px theo cả hai chiều). `labelOverlaps` và `lastingLabelOverlaps` đều gọi hàm đó, không có code chép hai lần. Gắn sau `frames > 0`, trước khi cần dùng.
- **Không nới quá kế hoạch:** poll 20 s vẫn còn. Kiểm "một khoảnh khắc sau 30 khung" được thay bằng theo dõi ≥ 3 s và ≥ 60 khung, ngưỡng 400 ms **và** 8 khung, đúng bảng trong PLAN. Kiểm `frames ≥ 60` có mặt. Kiểm độ mờ của nhãn mình, nhãn thú đi theo và kiểm "≤ 10 lần đo" giữ nguyên. Lỗi bố cục kéo dài (đè suốt cả khoảng theo dõi) chắc chắn bị báo: ở 20 khung/giây là 3000 ms và 60 khung; ở 5 khung/giây vòng theo dõi kéo dài tới khoảng 12 s cho đủ 60 khung.
- **Vòng rAF:** chỉ lấy mẫu khi `game.frames` tăng. `frames++` nằm ngay sau `labels.update` trong cùng lượt ticker (`Game.ts:1004-1005`), nên mỗi khung đã vẽ cho đúng một mẫu. Lượt rAF không có khung mới thì không lấy mẫu và cũng không ngắt lần đè. Một khung không đè thì đóng lần đè (đúng "một khung không đè là ngắt"). Lần còn mở lúc hết giờ được xét. Mỗi cặp chỉ ghi lần dài nhất. Hằng số truyền vào làm tham số. `last - start` tính thiếu một khoảng khung, tức nghiêng về phía không báo nhầm; với ngưỡng 400 ms thì không đáng kể.
- **Chốt 20 s:** hoạt động khi game ngừng vẽ mà rAF vẫn chạy (trả về `frames` thật, rồi `frames ≥ 60` hỏng rõ). Khi tab bị ẩn thì rAF dừng hẳn, `tick` không chạy nên chốt không bao giờ tới; test sẽ hỏng vì hết thời gian chung thay vì có thông báo rõ. Trong Playwright headless trang luôn ở trạng thái hiện, và test này chỉ có một trang (bốn người kia là observer qua SDK), nên đây không phải lỗi (xem góp ý).
- **`aimedTag` + poll 2 s:** giữ đủ ba ý. Không có thú đang nhắm thì trả `null` nên `toEqual` hỏng. Độ mờ phải là `"1"`. `barShown = !hurt || (bar && display !== "none")` tương đương với `if (hurt) expect(bar).not.toBe("none")` cũ. Poll 2 s không che được lỗi thật, vì nhãn bị ẩn sai sẽ ẩn mãi.
- **Test unit 12:** tôi chép test và `labelLayout.ts` vào scratchpad, sửa bản chép ở đó, không đụng repo:
  - bản gốc: 13/13 qua;
  - M1, thu nhỏ cũng phải chờ `holdUntil`: **test 12 hỏng** (18.191 cặp đè), test 1-11 qua;
  - M2, dạng đang chờ giữ `rise` cũ thay cho `bestRise`: **test 12 hỏng** (391 cặp), test 1-11 qua.
  
  Như vậy test 12 bảo vệ đúng phần chống nhấp nháy qua nhiều khung, là kết luận mà T51 dựa vào. Test giữ tham chiếu và hạng gốc bằng `Map` vì `layoutTags` sắp xếp mảng tại chỗ: đúng.
- **Quy ước:** JSDoc tiếng Anh, có trỏ tới `LABEL_EASE_MS`, các `transition` CSS và `docs/design/pals.md`. Hằng số viết `UPPER_SNAKE_CASE`. Không có hook `debug:*` mới, không đổi giao thức hay `Profile`.
- `npm test` chạy song song với `npm run typecheck`: 30/30 file, 366/366 test qua (130 s).

## Lần `npm test` hỏng chập chờn (tester ghi lại)
Số liệu tester ghi lại là "1 failed file | 245 passed | **121 skipped**". `GameRoom.test.ts` có đúng 121 test (245 + 121 = 366), và không file nào khác có số test như vậy. Gần như chắc chắn file hỏng là `packages/server/src/rooms/GameRoom.test.ts`, và hỏng ở `beforeAll` chứ không ở một test nào: hook hỏng thì Vitest bỏ qua cả file. `beforeAll` gọi `boot(..., 2571)`, tức dựng server trên một **cổng cố định** với hạn mặc định 10 s. Hai nguyên nhân khả dĩ: dựng server quá 10 s khi máy bận, hoặc cổng 2571 đang bị một lần chạy vitest khác chiếm. Tôi chạy lại song song với `tsc` thì không tái hiện được.

**Nên thêm nhiệm vụ theo dõi**, ưu tiên thấp. Lý do: khi lỗi này xảy ra thì 121 test tích hợp server bị bỏ qua cùng lúc, và CI đỏ vô cớ. Đề xuất cho TASKS.md:
- "T?: `GameRoom.test.ts` `beforeAll` có lúc hỏng khi máy bận (T51: 1 file hỏng, 121 test bị bỏ qua). Tái hiện bằng 3 vòng lặp CPU (cách làm trong PLAN T51) và chạy file đó lặp lại, đọc lỗi của hook. Nếu do hết giờ: cho `beforeAll` hạn dài hơn (ví dụ 30 s). Nếu do cổng: dùng cổng trống thay cho 2571 cố định. Không nới test nào khác."

## Góp ý không bắt buộc
- `lastingLabelOverlaps`: thêm một `setTimeout(…, 20_000)` dự phòng để resolve cả khi rAF dừng hẳn (tab ẩn). Khi đó test sẽ hỏng với thông báo `frames < 60` rõ ràng thay vì hết thời gian chung.
- Theo kế hoạch, một khung không đè là ngắt lần đè. Vì vậy một lỗi bố cục kiểu **nhấp nháy** (hai nhãn đè nhau cách khung một) sẽ không bị báo, trong khi kiểm một khoảnh khắc cũ bắt được nó khoảng 50% số lần. Test 12 đã che phía bố cục, nên điều này chấp nhận được. Nếu muốn chặt hơn, có thể báo thêm cặp nào đè trong hơn khoảng 25% số khung theo dõi.
- Test 12: ghi seed, khung và cặp vào thông báo lỗi, ví dụ `expect(a.forced || b.forced, \`seed ${seed} f ${f}\`).toBe(true)`. Hiện lỗi chỉ in "expected false to be true", khó lần ra. Theo lần thử của tôi, nhánh `forced` không xảy ra lần nào (0 cặp đè có `forced`), và kiểm "thú đang nhắm không ẩn" trùng với kiểm "nhãn ghim không ẩn" (`aimed` ≤ `PINNED_RANK`). Cả hai vô hại. Có thể thêm hạng `follower`/`leader` và thú hoang yên (`named: false`, không thanh máu) để phủ rộng hơn.
- Khoá cặp là chữ của nhãn. Hai nhãn trùng chữ (hai "Lv 3 Leafkit") sẽ gộp vào cùng một khoá. Như vậy test chỉ chặt hơn, có thể báo nhầm chứ không bỏ sót; hiện chưa thấy xảy ra.
- `PROGRESS.md` (phần tester) viết nhầm "labelPayout".
- Ghi chú về T28 trong PLAN.md (Rủi ro 4: thú lành lặn đi ngang lấy chỗ thú đang nhắm khoảng 5 s) nên được agent chính chép vào mục T28 trong `TASKS.md`.
