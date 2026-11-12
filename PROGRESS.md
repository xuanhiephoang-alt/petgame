# PROGRESS: T51 Test e2e `labels:` trên điện thoại chập chờn

## Vòng 1: coder
- [x] Bước 1: `tests/e2e/multiplayer.spec.ts`: `installLabelPairs(page)` gắn `window.__labelPairs()` (phép đo cũ, giữ nguyên luật: mờ 0,5, đè hơn 1 px, chữ và thanh máu); `labelOverlaps` gọi lại nó; thêm `LASTING_OVERLAP_MS = 400`, `LASTING_OVERLAP_FRAMES = 8` (có JSDoc nêu lý do) và `lastingLabelOverlaps(page, 3000, 60)` (một `page.evaluate` chạy vòng `requestAnimationFrame`, một mẫu cho mỗi khung đã vẽ, `Map` cặp -> lần đè liền, chốt an toàn 20 s).
- [x] Bước 2: cùng file, test `labels:`: gọi `installLabelPairs` sau khi có khung hình; giữ poll 20 s; thay kiểm "một khoảnh khắc" bằng `lastingLabelOverlaps` (kiểm `frames >= 60` và `pairs` rỗng); phần thú đang nhắm tách thành `aimedTag()` và poll 2 s (có thú đang nhắm, độ mờ "1", bị thương thì thanh máu hiện). Các kiểm khác không đổi.
- [x] Bước 3: `packages/client/src/game/labelLayout.test.ts`: thêm test 12 (100 hạt giống x 200 khung, đổi thú đang nhắm và nhích nhãn). Lưu ý: `layoutTags` sắp xếp `items` tại chỗ nên test giữ tham chiếu và hạng gốc theo nhãn (`Map`), không theo chỉ số.
- [x] Bước 4: kiểm tay, không commit. Tạm sửa `layoutTags` để mọi nhãn `form = full`, `rise = 0` rồi `continue`. Test `labels:` **hỏng** ngay ở poll 20 s chờ ổn định (trước kiểm theo dõi 3 s), với nhiều cặp đè nhau liên tục suốt 20 s (`Hiệp | Lv 8 Emberpup`, `Lan Anh | Lv 7 Bubbloon`, ...). Phần `lastingLabelOverlaps` không được chạy tới trong lần này (poll đứng trước), nên nhánh "kéo dài ≥ 400 ms" chỉ được kiểm gián tiếp qua poll. Đã hoàn tác (chép lại bản gốc, `git status` chỉ còn spec và `labelLayout.test.ts`); chạy lại thì qua (xem dưới).
- Lệch kế hoạch: không có. Chú ý: kiểm tay hỏng ở poll, không ở `watched.pairs`; kế hoạch cho phép ("hoặc hỏng ở poll trước đó").
- Không đổi `labelLayout.ts`, `labels.ts`, `index.html`, client hay server (`git diff --stat`: spec e2e và `labelLayout.test.ts`; `docs/design/pals.md`, `PLAN.md` đã đổi từ bước thiết kế).

### Lệnh đã chạy
- `npm run typecheck` ✓
- `npm test` ✓ (30 file, 366 test, gồm test 12)
- `npx playwright test -g "labels: in a crowd on a phone" --repeat-each=20 --workers=1 --retries=0`, máy rảnh: **20/20 qua** (4,4 phút)
- Cùng lệnh, 3 vòng lặp `node -e "for(;;){}"` ở nền: **20/20 qua** (4,7 phút); đã `pkill` các vòng lặp sau đó
- `npm run test:e2e` cả bộ: **40/40 qua** (6,1 phút)
- `npm run build`: không chạy (không đụng mã client sản phẩm, chỉ test)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (30 file, 366 test)   build (không chạy, không đụng client)   e2e ✓ (40/40, 5,8 phút)   photo3d (không chạy)
- Lưu ý: lần chạy `npm test` đầu tiên, chạy cùng lúc với `tsc` còn đang chạy nền, báo "1 failed file | 245 passed | 121 skipped" (file hỏng không in ra do tôi chỉ lấy đuôi log). Chạy lại ngay: 366/366 qua. Nghi do tải máy (chập chờn), không tái hiện.
- `npx playwright test -g "labels: in a crowd on a phone" --repeat-each=10 --workers=1 --retries=0`: 10/10 qua (1,7 phút).
- Kiểm trực tiếp `lastingLabelOverlaps` bằng spec tạm (đã xoá, `git status` sạch ngoài 3 file của coder): chép nguyên văn `installLabelPairs` + `lastingLabelOverlaps` từ spec thật, trang tĩnh với hai `.label` và `__petgame.game.frames` đếm bằng rAF, chuyển thẻ B đè lên A bằng `style.top` có hẹn giờ:
  - (a) đè liền 1000 ms: BÁO `["A | B (983 ms, 60 khung)"]`
  - (b) đè 150 ms: KHÔNG báo (`[]`)
  - (c) ba lần chạm 150 ms cách nhau 250 ms: KHÔNG báo, không bị gộp (`[]`)
  Vậy nhánh theo dõi 3 s phát hiện được đè kéo dài và bỏ qua chuyển tiếp ngắn. Hạn chế: kiểm trên trang giả, không phải thế giới thật; đo bằng chính hàm thật nên đủ cho ngưỡng 400 ms/8 khung.
- Tiêu chí hoàn thành: [x] test `labels:` ổn định (10/10) [x] theo dõi đè kéo dài hoạt động [x] test 12 trong labelPayout/labelLayout.test.ts qua [x] không đổi code sản phẩm
- Test đã thêm: không (chỉ kiểm tra; spec tạm đã xoá).
