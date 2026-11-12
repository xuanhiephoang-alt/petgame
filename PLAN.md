# PLAN: T51 Test e2e `labels:` trên điện thoại chập chờn

Đọc code ở HEAD `fad32d2` (sau T42). Test: `tests/e2e/multiplayer.spec.ts`, `labels: in a crowd on a phone, ...` (dòng ~971), hàm `labelOverlaps` (dòng ~948). Code nhãn: `packages/client/src/game/labels.ts`, `labelLayout.ts` (T5, `deb0950`). Luật nhãn: `docs/design/pals.md`, mục "Nhãn tên và thanh máu" (đã thêm đoạn "Lúc chuyển" ở bước thiết kế này).

## Mục tiêu

Test này hỏng thỉnh thoảng (một lần trong lần chạy cả bộ của T42: `labelOverlaps` = `["Tuấn | Lv 6 Leafkit"]` ở kiểm thứ hai, sau poll). Một test chập chờn che lỗi thật và làm CI đỏ vô cớ. Sau T51:
- test chỉ hỏng khi nhãn **thật sự** đè nhau (lỗi bố cục), không hỏng vì lúc chuyển đúng thiết kế;
- test vẫn nghiêm như cũ, thậm chí nghiêm hơn: nó theo dõi liên tục 3 giây thay vì nhìn hai khoảnh khắc;
- có thêm unit test chứng minh bố cục đúng qua nhiều khung hình, cả khi thú đang nhắm đổi liên tục.

Người chơi không thấy gì khác: T51 không đổi code sản phẩm.

## Kết quả điều tra (nguyên nhân gốc)

Tôi đã tái hiện và đo, chỉ đọc (spec thử trong scratchpad, đã xoá):

1. **Chạy đúng lệnh được giao**, máy rảnh: `npx playwright test -g "labels: in a crowd on a phone" --repeat-each=20 --workers=1 --retries=0` cho **20/20 qua** (2,6 phút). Lỗi hiếm và cần đúng thời điểm.
2. **Đo từng khung hình trong 15 giây** sau khi dựng cảnh như test, bằng vòng `requestAnimationFrame`. Mỗi khung chạy đúng phép đo của `labelOverlaps`, và kiểm tra thêm hình chữ nhật mà `layoutTags` đã đặt (`placed`, `left/top/right/bottom`). Kết quả qua 12 lần chạy (8 lúc máy rảnh, khoảng 33 khung/giây; 4 lúc có 3 vòng lặp `node` chiếm CPU, khoảng 18 khung/giây):
   - **Bố cục chưa lần nào đè nhau:** 0 cặp hình chữ nhật đã đặt đè nhau, trong khoảng 5.000 khung hình.
   - **Hình trên trang thì có lúc đè nhau, nhưng luôn ngắn:** mỗi lần 30-190 ms, 1-5 khung hình. Lần dài nhất là 188 ms (3 khung) lúc máy bận. Mỗi lần chạy có 3-9 lần như vậy, phần lớn trong 1 giây đầu (camera và thú đi theo còn đang ổn định, phần này poll đã che).
   - **Cặp `Tuấn | Lv N Leafkit` của lần hỏng gốc lặp lại đúng như vậy:** 127 ms ở lúc máy rảnh, 132-188 ms lúc máy bận.
3. **Chuyện gì xảy ra trong những lần đó** (ảnh chụp trạng thái nhãn tại khung đầu tiên bị đè):
   - Một **Leafkit hoang lành lặn đi lang thang** trong bãi xuất hiện, tới cách người chơi 36 px. Thú bị thương mà test đặt ở cách 38 px. Con lành lặn thành thú đang nhắm (luật `aimed`: con gần nhất trong `THROW_RANGE`) và giữ vị trí đó khoảng 5 giây. Một lần đo khác ghi lại đúng `aimed=pal39` (leafkit 40/40 máu, cách 36 px), lấy chỗ của `pal88` (1 máu, cách 38 px).
   - Leafkit bị thương mất hạng 1 (ghim), về hạng 6. Ở độ cao 16,8 px nó không còn đủ chỗ cho cả nhãn, nên thu gọn còn thanh máu. Chữ của nó mờ dần trong 0,2 giây (`.label.pal span { transition: opacity 0.2s }`).
   - Cùng khung đó, `layoutTags` thấy chỗ đã trống nên cho nhãn "Tuấn" hạ từ khoảng 9 px về 0. Nhãn này hạ xuống mượt (`LABEL_EASE_MS` 60) và đi qua chữ Leafkit đang mờ. Khi chữ mờ dưới 0,5 thì test không còn tính.
   - Những lần khác cùng một kiểu. Hai nhãn ghim đổi chỗ khi thú đi theo đổi thứ tự trước sau (`Hiệp | Lv 8 Emberpup`). Một nhãn bị ẩn mờ dần trong 0,15 giây trong lúc nhãn khác vào chỗ (`Hiệp | Lan Anh`).
4. **Bố cục đúng qua nhiều khung hình.** Tôi chạy `layoutTags` thuần bằng `tsx`: 300 đám đông × 200 khung, mỗi khung đổi thú đang nhắm ngẫu nhiên và nhích một số nhãn ±3 px, `now` tăng 33 ms. Kết quả: 0 lần hai nhãn đã đặt (không bị ép) đè nhau.

**Kết luận: đây là lỗi của test, không phải lỗi bố cục.** Bố cục quyết định ngay trong một khung, còn hình vẽ theo sau tối đa khoảng 0,2 giây (độ mờ CSS 0,15-0,2 giây, độ cao xong 95% sau khoảng 3 × 60 ms). Thiết kế T5 cố ý như vậy: "nhãn đổi độ cao mượt chứ không nhảy", và nhãn không nhấp nháy. Kiểm thứ hai của test lấy mẫu một khoảnh khắc. Thỉnh thoảng khoảnh khắc đó rơi vào lúc chuyển: một thú lang thang (test không kiểm soát) đổi thú đang nhắm, hoặc thú đi theo đổi chỗ.

Không có lần đè nào kéo dài quá 200 ms, nên không có gì để sửa trong `labelLayout.ts`.

## Phạm vi

Làm:
- Sửa test e2e `labels:` để kiểm "không có hai nhãn đè nhau **liền** quá thời gian chuyển" trong một khoảng theo dõi liên tục, thay cho kiểm một khoảnh khắc.
- Kiểm thú đang nhắm hiện đủ bằng poll ngắn, vì thú đang nhắm có thể vừa đổi.
- Thêm unit test nhiều khung hình cho `layoutTags`.

KHÔNG làm:
- Không sửa `labelLayout.ts`, `labels.ts`, CSS trong `index.html`, hay hằng số nhãn. Hướng làm cho lúc chuyển hết đè: xem "Rủi ro" 3.
- Không thêm hook `debug:*` để giữ thú hoang đứng yên. Test phải chịu được thế giới thật: thú lang thang chính là thứ làm lộ lúc chuyển.
- Không nới các kiểm khác của test: nhãn của mình và thú đi theo có độ mờ "1", thanh máu của thú đang nhắm, và "cảnh đứng yên đo ≤ 10 lần".
- Không động tới test e2e khác.

## Thiết kế

Luật đã ghi vào `docs/design/pals.md`, mục "Nhãn tên và thanh máu", đoạn **"Lúc chuyển"**:
- Hai nhãn chạm nhau thoáng qua, tối đa khoảng 0,2 giây, khi một nhãn nhường chỗ là đúng thiết kế.
- Hai nhãn **đè nhau liền 0,4 giây trở lên** là lỗi bố cục.
- Thú đang nhắm có thể là một thú lành lặn đi ngang qua (không hiện nhãn; T28 sẽ thêm dấu).

**Ngưỡng của test và lý do:**

| Hằng số (trong spec) | Giá trị | Lý do |
|---|---|---|
| `LASTING_OVERLAP_MS` | 400 | Lúc chuyển dài nhất theo thiết kế là khoảng 200 ms (CSS 0,2 s; độ cao xong 95% sau khoảng 180 ms). Đo được tối đa 188 ms. Lấy gấp đôi để dư. |
| `LASTING_OVERLAP_FRAMES` | 8 | Khi máy rất chậm (5 khung/giây), `dt` bị chặn ở 100 ms nên độ cao cần 2-3 khung để về chỗ, nhưng tính ra hơn 400 ms. Cần cả hai điều kiện thì lúc chuyển ở mọi tốc độ khung đều không bị tính: ở 60 khung/giây cần khoảng 7 khung nhưng chỉ khoảng 120 ms; ở 5 khung/giây hết khoảng 600 ms nhưng chỉ ≤ 3 khung. Đo được tối đa 5 khung. |
| Thời gian theo dõi | 3.000 ms, và ít nhất 60 khung | Dài gấp 7 lần ngưỡng. Một lỗi bố cục thật làm hai nhãn đè nhau suốt khoảng đó, nên chắc chắn bị bắt. 60 khung giống kiểm "cảnh đứng yên" ở cuối test. |

Một lần đè chỉ tính là lỗi khi **đủ cả hai** điều kiện. Mỗi lần đè tính từ khung đầu tiên tới khung cuối cùng cặp đó còn đè liền; một khung không đè là ngắt.

Không có chữ người chơi thấy, không có thao tác mới (không ảnh hưởng cảm ứng hay bàn phím).

## Kế hoạch triển khai

Mỗi bước commit riêng được, nhưng làm hết trong một vòng.

1. **`tests/e2e/multiplayer.spec.ts`: dùng một phép đo cho cả hai kiểu kiểm.**
   - Đổi `labelOverlaps` (dòng ~948) thành hai phần, không chép thân hàm hai lần:
     - `installLabelPairs(page)`: chạy `page.evaluate` một lần để gắn `window.__labelPairs = () => string[]`. Thân hàm giữ y nguyên phép đo hiện có: bỏ nhãn `display: none` hoặc mờ dưới 0,5; phần là chữ (độ mờ trên 0,5) và thanh máu (đang hiện); đè nhau hơn 1 px theo cả hai chiều; trả về `"<A> | <B>"`. Giữ JSDoc hiện có, thêm một câu nói nó được gắn vào `window` để cả hai phép kiểm dùng chung.
     - `labelOverlaps(page)`: `page.evaluate(() => window.__labelPairs())`. Dùng cho poll lúc chờ cảnh ổn định, ngữ nghĩa như cũ.
   - Thêm `LASTING_OVERLAP_MS = 400` và `LASTING_OVERLAP_FRAMES = 8` ngay trên hàm mới, với JSDoc nói lý do (bảng trên, ngắn gọn, trỏ tới `LABEL_EASE_MS` trong `labelLayout.ts`, các `transition` của `.label` trong `index.html`, và `docs/design/pals.md` "Lúc chuyển").
   - Thêm `lastingLabelOverlaps(page, watchMs = 3000, minFrames = 60): Promise<{ frames: number; pairs: string[] }>`. Chỉ một `page.evaluate` trả về `Promise`, chạy vòng `requestAnimationFrame`:
     - mỗi lần gọi lại, chỉ lấy mẫu khi `__petgame.game.frames` đã tăng so với lần trước (đúng một mẫu cho mỗi khung đã vẽ), đếm vào `frames`;
     - với mỗi cặp từ `window.__labelPairs()`, giữ `{ start, last, frames }` của lần đè liền đang diễn ra. Cặp không còn trong mẫu thì đóng lần đó. Lần nào có `last - start >= LASTING_OVERLAP_MS` **và** `frames >= LASTING_OVERLAP_FRAMES` thì ghi `"<A> | <B> (<ms> ms, <n> khung)"` vào `pairs` (mỗi cặp ghi một lần, lấy lần dài nhất). Lần còn mở khi hết giờ cũng xét như vậy;
     - dừng khi đã qua `watchMs` **và** đã có ít nhất `minFrames` mẫu. Có một chốt an toàn 20 s để vòng không chạy mãi khi trang ngừng vẽ: khi đó trả về số `frames` thực có, để test báo lỗi rõ.
     - Hai hằng số truyền vào `evaluate` làm tham số, không viết số cứng bên trong.
     - Không tạo object mới mỗi khung ngoài mức cần thiết (chỉ là test, nhưng giữ gọn: một `Map` cặp → lần đè).
2. **Cùng file, trong test `labels: in a crowd on a phone, ...`:**
   - Sau `waitForWorld` và `frames > 0`, gọi `await installLabelPairs(page)`.
   - Giữ `await expect.poll(() => labelOverlaps(page), { timeout: 20_000 }).toEqual([])` (chờ camera, thú đi theo và nhãn ổn định).
   - Thay khối "Stable, not just one lucky moment" (đọc `frames`, chờ 30 khung, `expect(await labelOverlaps(page)).toEqual([])`) bằng:
     ```ts
     // Watched for 3 s: tags may touch while one fades or slides (about 0.2 s, by design), never for longer.
     const watched = await lastingLabelOverlaps(page);
     expect(watched.frames).toBeGreaterThanOrEqual(60);
     expect(watched.pairs).toEqual([]);
     ```
   - Khối "The aimed pal ...": đưa phần `page.evaluate` tìm thú đang nhắm vào một hàm `aimedTag()`. Kiểm bằng `await expect.poll(aimedTag, { timeout: 2_000 }).toMatchObject({ opacity: "1" })`, sau đó lấy một kết quả qua poll, rồi kiểm `if (aimed.hurt) expect(aimed.bar).not.toBe("none")` như cũ. Hoặc viết gọn thành một poll trả về `{ ok: boolean, ... }`, miễn là giữ đủ ba ý: có thú đang nhắm, độ mờ "1", và bị thương thì thanh máu hiện.
     - Lý do: thú đang nhắm có thể vừa đổi sang con khác. Nhãn ghim hiện ngay, nhưng độ mờ CSS cần 0,15 giây để lên 1. Poll 2 giây không nới luật, vì lỗi thật (nhãn bị ẩn) kéo dài mãi.
   - Không đổi các kiểm khác. Kiểm độ mờ của nhãn mình và thú đi theo vẫn đọc một lần: nhãn ghim không bao giờ ẩn, cả hai đủ máu nên không thu gọn, độ mờ luôn "1".
3. **`packages/client/src/game/labelLayout.test.ts`: thêm test `12`.**
   - Tên: `"12: frame after frame, while the aimed pal changes and tags drift, placed tags only overlap when forced"`.
   - Cách làm (theo phép thử của tôi, đã thấy 0 lần đè), dùng `mulberry32` và helper `tag()` có sẵn:
     - 100 hạt giống. Mỗi hạt tạo 20 nhãn trong vùng 240 × 160: nhãn 0 là `me`, còn lại chọn ngẫu nhiên trong `player`, `companion`, `wild`, `camp`; một nửa có thanh máu (24 px cao, thanh 36 × 5), nửa kia không (17 px).
     - Chạy 200 khung, `now = f * 33`. Mỗi khung, với xác suất 1/2, chọn ngẫu nhiên một nhãn `wild` làm thú đang nhắm (`rank = LABEL_RANK.aimed`), không thì không có thú đang nhắm; các nhãn còn lại về hạng gốc. Mỗi nhãn có 10% cơ hội nhích `x`, `y` ±3 px.
     - Gọi `layoutTags`, rồi kiểm:
       - mọi cặp nhãn đều `placed` mà đè nhau (`w > 0 && h > 0`) thì phải có một nhãn `forced`;
       - nhãn ghim không bao giờ `hidden`;
       - thú đang nhắm hiện ngay trong khung nó thành thú đang nhắm (`form !== hidden`).
     - Sau đó xoá `fresh` như helper `frame()`.
   - Mục đích: test 9 chỉ kiểm một khung. Test này chứng minh phần chống nhấp nháy (`holdUntil`, dạng nhỏ hơn nằm trong hình của dạng tốt nhất) không làm hai nhãn đã đặt đè nhau qua nhiều khung. Đây là kết luận mà T51 dựa vào.
   - Thời gian chạy: 20.000 lần `layoutTags` với 20 nhãn, dưới 1 giây.
4. **Kiểm rằng test mới vẫn bắt được lỗi thật** (kiểm tay, không commit). Tạm sửa `layoutTags` để mọi nhãn được đặt ở `form = full`, `rise = 0` (ví dụ `return` ngay sau vòng sắp xếp, sau khi gán `placed=false`, `form=full`, `rise=0` cho mọi nhãn). Chạy test `labels:` và xác nhận nó **hỏng** ở `watched.pairs` với các cặp kéo dài hết 3 s (hoặc hỏng ở poll trước đó). Hoàn tác, chạy lại thì qua. Ghi kết quả vào `PROGRESS.md`.
5. **`PROGRESS.md`:** ghi các bước, số lần chạy lặp và kết quả (xem "Tiêu chí hoàn thành").

## Giao thức

Không đổi `schema.ts`, `messages.ts` hay `Profile`. Không đổi client hay server. Chỉ đổi test (và tài liệu thiết kế, đã làm ở bước này).

## Test

- **Unit:** `packages/client/src/game/labelLayout.test.ts`, test 12 mới (bước 3). Các test 1-11 giữ nguyên.
- **Tích hợp server:** không cần, server không đổi.
- **E2E:** `tests/e2e/multiplayer.spec.ts`, test `labels:` sửa theo bước 1-2. Chạy:
  - `npx playwright test -g "labels: in a crowd on a phone" --repeat-each=20 --workers=1 --retries=0` lúc máy rảnh;
  - lệnh đó **lúc máy bận**: trước khi chạy, bật 3 vòng lặp CPU ở nền, ví dụ `for i in 1 2 3; do timeout 900 node -e "for(;;){}" & done`; chạy xong thì `pkill -f "for(;;)"`. Máy có 4 lõi; lúc này game chạy khoảng 18 khung/giây;
  - cả bộ `npm run test:e2e` một lần, vì lần hỏng gốc xảy ra khi chạy cả bộ.
- `npm run typecheck`, `npm test`.

## Tiêu chí hoàn thành

- [ ] `labelLayout.ts`, `labels.ts`, `index.html` không đổi (`git diff --stat` chỉ có spec e2e, `labelLayout.test.ts`, `docs/design/pals.md`, `PLAN.md`, `PROGRESS.md`).
- [ ] `labelOverlaps` và `lastingLabelOverlaps` dùng chung một phép đo trên trang (`window.__labelPairs`), không chép thân hàm hai lần. Phép đo giữ y nguyên luật hiện có (độ mờ 0,5, đè hơn 1 px, chữ và thanh máu).
- [ ] Kiểm thứ hai theo dõi liên tục ≥ 3 s và ≥ 60 khung. Cặp đè chỉ là lỗi khi liền ≥ `LASTING_OVERLAP_MS` (400) **và** ≥ `LASTING_OVERLAP_FRAMES` (8). Hai hằng số có JSDoc nói lý do. Test kiểm luôn `frames ≥ 60`.
- [ ] Kiểm thú đang nhắm dùng poll ≤ 2 s và vẫn đủ ba ý: có thú đang nhắm, độ mờ "1", bị thương thì thanh máu hiện.
- [ ] Không kiểm nào khác của test bị bỏ hay nới. Poll 20 s chờ ổn định vẫn còn. Kiểm "cảnh đứng yên đo ≤ 10 lần" giữ nguyên.
- [ ] Test unit 12 có mặt và qua. `npm test` qua. `npm run typecheck` sạch.
- [ ] **20/20** lần lặp qua lúc máy rảnh, và **20/20** lúc máy bận (3 vòng lặp CPU), cả hai với `--retries=0`. Ghi lệnh và kết quả vào `PROGRESS.md`.
- [ ] `npm run test:e2e` cả bộ qua một lần.
- [ ] Kiểm tay ở bước 4 ghi trong `PROGRESS.md`: khi bố cục bị tắt, test hỏng với cặp kéo dài ≥ 400 ms; khi hoàn tác, test qua.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Máy CI chậm hơn nữa.** Ngưỡng cần cả 400 ms lẫn 8 khung. Lúc chuyển kéo dài nhiều nhất khoảng 5 khung (ở 60 khung/giây cần khoảng 7 khung nhưng chỉ khoảng 120 ms), nên tốc độ khung nào cũng không làm test hỏng oan. Trang ngừng vẽ thì `frames < 60` làm test hỏng rõ ràng, không im lặng qua.
2. **Thú đi theo đang chạy.** Khi một nhãn đi theo một mục tiêu đang di chuyển, độ cao vẽ trễ khoảng `v × 60 ms`. Lúc thú đi theo vừa chạy tới chủ, độ trễ này có thể làm hai nhãn đè nhau liền vài trăm ms. Poll 20 s chờ ổn định đã đứng trước kiểm 3 s, và lúc đo, thú đi theo đã đứng yên (cả 12 lần đo đều không có lần đè nào dài quá 190 ms sau giây đầu). Nếu tester thấy hỏng ở cặp có thú đi theo đang chạy: báo lại với số ms và số khung, đừng nâng ngưỡng.
3. **Có nên làm cho lúc chuyển hết đè luôn không** (đổi sản phẩm, ngoài T51)? Có hai cách:
   - (a) Nhãn đang mờ đi vẫn giữ chỗ cũ thêm 0,2 giây trong `layoutTags`. Cần thêm trạng thái (hình chữ nhật cũ, giờ hết hạn) và test, và nhãn khác sẽ phải chờ mới vào chỗ được.
   - (b) Ẩn ngay không mờ dần. Nhãn sẽ "bụp" mất, trái ý "không nhấp nháy" của T5.

   Đề xuất: **không làm.** Hai nhãn chạm nhau ≤ 0,2 giây khi nhường chỗ gần như không thấy, và nhẹ hơn chuyện nhãn nhảy. Không thêm nhiệm vụ.
4. **Liên quan T28** (dấu thú đang nhắm): lần đo cho thấy thú đang nhắm thường là một thú lành lặn đi ngang, không có nhãn. Người chơi bấm Bắt có thể ném vào con đó thay cho con bị thương đứng cạnh. Đây đúng là vấn đề T28 sẽ giải quyết (dấu nhìn thấy được). Đề xuất cho agent chính: thêm vào ghi chú của T28 trong `TASKS.md` câu "Đo ở T51: một thú lành lặn đi ngang, gần hơn 2 px, lấy mất chỗ thú đang nhắm của con bị thương trong ~5 s". Có thể cân nhắc ưu tiên thú bị thương hoặc choáng khi hai con gần như cách đều. Đó là đổi luật của server (`throwBall`) nên thuộc T28, không làm ở đây.
