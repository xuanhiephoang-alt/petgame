PASS
# REVIEW: T1 Test e2e chập chờn khi vào phòng, vòng 1

## Kết luận

Sửa đúng nguyên nhân gốc. Sảnh là một form bấm được ngay từ HTML tĩnh, trước khi `main.ts` gắn handler `submit`, nên cú bấm sớm khiến trình duyệt tự gửi form (GET về `/?`, mất tên vừa gõ và `?room=`). Nay ô tên và nút bị khoá sẵn và chỉ mở khoá ngay sau khi gắn handler, nên mọi nguồn kích hoạt (Vite tải lại trang sau `load`, module tải lỗi) đều bị chặn. Làm đủ các bước và tiêu chí của PLAN.md, không làm thừa phạm vi; helper e2e chỉ chặt hơn, không thêm timeout hay retry. Không có lỗi phải sửa.

## Đã kiểm

1. **Nguyên nhân gốc.** Chuỗi suy luận trong PLAN.md đứng vững: ô trống nghĩa là handler chưa từng chạy trên trang đó (`main.ts:54` lưu tên, `main.ts:25` điền lại). Form không có `action`, ô không có `name`, nên trình duyệt gửi form về `/?`. Bằng chứng:
   - test tạm A và B tái hiện được lỗi trên code cũ, không tái hiện trên code mới (coder làm, tester làm lại độc lập);
   - test hồi quy hỏng trên client cũ, kể cả bản chỉ giữ các kiểm tra về hệ quả.
   
   Tôi chạy lại `npx playwright test -g "lobby:" --workers=1`: qua (1,3 s).
2. **Không còn đường nào để trình duyệt tự gửi form.**
   - Nút `disabled` (`index.html:303`) chặn cả click lẫn gửi ngầm bằng Enter: khi nút mặc định bị khoá, trình duyệt không gửi form.
   - Ô tên bị khoá nên không nhận focus.
   - Các nút chọn ngoại hình là `type="button"` (`ui/wardrobe.ts:126`) và được gắn trong cùng lượt chạy đồng bộ với handler.
   - `autocomplete="off"` chặn Firefox khôi phục trạng thái đã mở khoá của nút sau khi tải lại.
   - Lệnh mở khoá (`main.ts:71-73`) chạy cùng lượt đồng bộ với `addEventListener` và sau bước điền tên đã lưu (`main.ts:25`), nên rủi ro H2 cũng hết.
3. **Script hỏng thì nút khoá mãi.** Người chơi chỉ thấy nút "Đang tải..." mờ với con trỏ `progress`; không có thông báo lỗi, không có nút tải lại. Chấp nhận được cho T1, vì:
   - (a) đây là lớp lỗi có từ trước. Trước đây nút bấm được nhưng chỉ tải lại trang về `/?`, mất `?room=` và tên. Nếu lỗi nằm trong code thì mỗi lần bấm lại tải lại y hệt;
   - (b) không thêm đường hỏng mới: mọi lệnh trước `main.ts:71` vốn đã chạy trên code cũ (H3), và e2e qua;
   - (c) `index.html` luôn được kiểm tra lại khi tải (`server/src/index.ts:25`, chỉ `/build` được cache vĩnh viễn), nên người chơi tự tải lại trang là hồi phục được, vẫn giữ `?room=`;
   - (d) PLAN.md đã chọn hành vi này và nêu lý do.
   
   Đề xuất việc tiếp theo ở phần góp ý.
4. **Helper e2e không nới lỏng.**
   - Không có `retries`; `playwright.config.ts` không đổi.
   - 13 `waitForTimeout` và 5 giá trị `timeout` giữ nguyên như `HEAD`.
   - `enterLobby` dùng timeout mặc định và thêm kiểm tra `toHaveValue`.
   - `waitForWorld` chỉ chặt hơn: trong đường vào thành công, `#join-error` luôn trống (`main.ts:57`) rồi bị gỡ cùng sảnh (`main.ts:60`).
   - `force: true` chỉ có ở `multiplayer.spec.ts:510`, trong test hồi quy.
   - Kiểm kiểu `tests/e2e` bằng tsconfig tạm kế thừa `tsconfig.base.json` (strict, noUnused): sạch.
5. **Nhật ký trang.**
   - Chỉ in khi `status !== expectedStatus` (`multiplayer.spec.ts:12`).
   - Trên CI, reporter `dot` vẫn ghi stdout của test ra log (`node_modules/playwright/lib/reporters/dot.js:34-38`).
   - Lỗi 504 "Outdated Optimize Dep" của Vite không phải `requestfailed`, nhưng vẫn vào nhật ký qua `console.error` "Failed to load resource", vì Playwright chuyển `Log.entryAdded` thành sự kiện console (`crPage.js:699-711`).
6. **Nút ≥ 44 px.** Có `min-height: 44px; box-sizing: border-box` (`index.html:243`). Tôi đo bằng CSS thật: 844×390 là 680×44, 390×844 là 340×45, 1280×720 là 340×45. Test hồi quy đo cả ba khung hình.
7. **Link mời `?room=`.** `connect()` và thân handler không đổi. Test hồi quy khẳng định:
   - `?room=` được giữ;
   - handler thử vào đúng phòng được mời;
   - chỉ có 1 lần điều hướng;
   - tên được lưu.
   
   Hai test vào bằng link mời ("5 players", "movement") qua trong cả 4 lượt chạy toàn bộ.
8. **Phạm vi và quy ước.**
   - Chỉ 5 file bị sửa, cộng PLAN.md và PROGRESS.md.
   - Không đổi: `main.ts:51-67`, `connect()`, server, schema, hồ sơ lưu, `playwright.config.ts`, `scripts/shots.mjs` (script này dùng `fill`/`click` nên tự chờ; tester chạy được).
   - Chú thích code bằng tiếng Anh, chữ người chơi thấy bằng tiếng Việt, tài liệu bằng tiếng Việt.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Góp ý không bắt buộc

- **Sảnh báo lỗi khi script không tải được (đề xuất thành việc mới, P2 hoặc P3).**
  - Cách làm: thêm handler `error` cho thẻ `<script type="module">`; sự kiện này bắn khi bất kỳ module nào trong cây không tải được. Thêm một lời nhắc hẹn giờ (ví dụ sau 20 s) kèm nút "Tải lại" gọi `location.reload()`; lệnh này giữ `?room=`.
  - Lưu ý: lỗi ném ra lúc chạy không bắn `error` trên thẻ script (nó đi vào `window.onerror`), nên muốn phủ hết thì cần cả hai cách.
  - Kiểm tra xem bản build của Vite có giữ nguyên thuộc tính trên thẻ script không.
- `multiplayer.spec.ts:13-14`: đổi thứ tự, xoá `pageLog` **sau** khi đóng context. Như hiện tại, dòng nào phát sinh trong lúc đóng (ví dụ request bị huỷ) sẽ lẫn vào nhật ký của test lỗi tiếp theo.
- **Kích thước chạm trong sảnh còn hở** (có từ trước, ngoài phạm vi T1; đề xuất thành việc P2):
  - ô tên ở 844×390 chỉ cao 39 px (padding `9px 12px`, `index.html:258`);
  - `.style-btn` có `min-height: 34px` (`index.html:176`);
  - `.swatch` 32×32 px (`index.html:179`).
- Firefox có thể khôi phục trạng thái đã mở khoá của **ô tên** khi tải lại, vì ô dùng `autocomplete="nickname"` chứ không phải `off`. Khi đó ô gõ được trước khi `main.ts` chạy, và chữ gõ sớm có thể bị tên đã lưu ghi đè. Form vẫn không bị gửi vì nút còn khoá. Không cần sửa (giữ gợi ý nickname có ích hơn), chỉ ghi nhận.
- `docs/architecture.md:51`: câu "Bấm lúc chưa sẵn sàng thì trình duyệt tự gửi form..." đọc như mô tả hành vi hiện tại. Nên viết "Nếu không khoá, bấm lúc chưa sẵn sàng thì...".
- Test hồi quy: thêm bước Enter như tester đề xuất, để repo kiểm cả đường bàn phím (khoá: Enter không gửi form; sẵn sàng: Enter vào được).
- Việc của agent chính khi hoàn tất:
  - thêm việc P3 "E2E chạy trên bản build" từ PLAN.md vào `TASKS.md`, cùng hai việc đề xuất ở trên nếu đồng ý;
  - cân nhắc ghi "không sửa file client/shared khi e2e đang chạy" vào mục môi trường của `CLAUDE.md` (việc này do agent chính hoặc người dùng quyết).
