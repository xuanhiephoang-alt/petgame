# PROGRESS: T5 Nhãn tên không đè nhau

## Vòng 1: coder
- [x] Bước 1: `scripts/shots.mjs`: cờ `--only world|labels` (mặc định cả hai), nhóm `labels` (3 khung hình x 3 cảnh `players`/`wild`/`alpha`, 4 người chơi phụ qua SDK, "Tuấn" rớt mạng thật, `report.json` có `labels`, `counts`, `labelMs`). Đã chụp "trước" (`npm run shots -- --name t5-before --only labels`) trên code chưa sửa.
- [x] Bước 2: `packages/client/src/game/labelLayout.ts` (mới, thuần) + `labelLayout.test.ts` (12 test: 11 ca của kế hoạch, ca 2 tách 2a/2b).
- [x] Bước 3: `packages/client/src/game/labels.ts`: hạng, đo khi đổi (`MutationObserver`), đổi độ cao mượt, thu gọn/ẩn bằng `opacity`, z-index theo hạng, `counts`, `update(now, aimed)` bốn pha. Thanh máu được tra lại mỗi lần đo (không lưu trong `Tag`).
- [x] Bước 4: `Game.ts`: `LABEL_RANK` cho mọi nhãn, thú đang nhắm tính trong vòng `pals.forEach` của `frame()`, companion không gán lại chữ không đổi, `debugInfo().labels`.
- [x] Bước 5: `packages/client/index.html`: transition opacity 0,15 s cho `.label` và `.label span`, `.labels > .float { z-index: 20 }`.
- [x] Bước 6: e2e `labels: in a crowd on a phone, ...` + helper `labelOverlaps` trong `tests/e2e/multiplayer.spec.ts`.
- [x] Bước 7: `docs/architecture.md` (labels, labelLayout, `labelOverlaps`, `--only`). `docs/design/pals.md` khớp, không sửa thêm.
- [x] Bước 8: bảng trước/sau dưới đây.

### Ảnh trước/sau (`shots/t5-before/`, `shots/t5-after/`, ảnh `labels-<khung>-<cảnh>.png`, `report.json`)

Cặp chồng (diện tích px²) / nhãn ẩn / số nhãn có chữ hiện / `labelMs` (ms mỗi khung của `labels.update`, trung bình 60 khung):

| Ảnh | Trước | Sau |
|---|---|---|
| desktop players | 2 (405) / 0 / 10 | 0 / 1 / 9 |
| desktop wild | 3 (326) / 0 / 9 / 0,175 | 0 / 0 / 7 / 0,100 |
| desktop alpha | 0 / 0 / 3 | 0 / 0 / 2 (xem ghi chú) |
| portrait players | 7 (1321) / 0 / 10 | 0 / 1 / 9 |
| portrait wild | 6 (1824) / 0 / 9 / 0,205 | 0 / 1 / 6 / 0,068 |
| portrait alpha | 1 (808) / 0 / 3 | 1 (59) / 0 / 3 |
| landscape players | 7 (1295) / 0 / 10 | 0 / 1 / 9 |
| landscape wild | 5 (1855) / 0 / 9 / 0,213 | 0 / 1 / 7 / 0,086 |
| landscape alpha | 1 (214) / 0 / 3 | 0 / 0 / 3 |

- Tổng cặp chồng: trước 32, sau 1. `labelMs` sau thấp hơn trước (nhãn chỉ ghi DOM khi đổi). "Hiệp" hiện đủ chữ ở mọi ảnh; tối đa 1 nhãn ẩn mỗi ảnh; 2 nhãn thu gọn ở các cảnh `wild`.
- Cặp còn lại: portrait alpha, "★ Đầu đàn · Lv 15 Voltmouse" với "Lv 8 Emberpup", 59 px² (lớp chồng khoảng 1 px): cả hai là nhãn ghim và thú đi theo đang chạy nên nhãn đang đổi độ cao mượt (đo DOM lúc ngay sau khi chụp), kích thước đo làm tròn. E2E dùng ngưỡng 1 px. Không phải trường hợp bị ép (`forced`).
- Cảnh `alpha` ở desktop: lần chụp này người chơi bị đầu đàn hạ rồi hồi sinh ở chỗ khác nên khung chỉ có 2 nhãn; do cảnh phụ thuộc thời điểm, không phải lỗi nhãn. Cảnh này không ổn định giữa các lần chụp (cả bản "trước" cũng chỉ có 0 cặp).
- Chưa xem kỹ từng ảnh bằng mắt; tester nên xem ảnh dọc và ngang.

### Lệch kế hoạch
- Unit test ca 5: kế hoạch ghi "wild full, rise 29", nhưng theo luật xếp ghim từ trước ra sau (y lớn trước) thì con thú (y 110) giữ chỗ trước, rise 0, còn "me" (y 100) nâng 9. Test kiểm: thú hiện `full` ngay dù trước đó `hidden`, và "me" vẫn `full` (rise 9). Luật giữ nguyên như kế hoạch.
- `scripts/shots.mjs`: không `await g.leave()` cho người chơi phụ ở cuối mỗi khung hình (người đã rớt mạng không bao giờ trả lời, làm script treo). Kế hoạch ghi chú điều này cho e2e nhưng không cho shots.
- Chỉ chạy e2e có chọn lọc (labels, gameplay, skills, pack leaders, connection: 10 test, đều qua); chưa chạy toàn bộ `npm run test:e2e` (để tester).

### Lệnh đã chạy
- `npm run typecheck` ✓, `npm test` ✓ (254 test, 23 file; gồm 12 test mới của `labelLayout`), `npm run build` ✓.
- `npx playwright test -g "labels:"` ✓; `-g "pack leaders|connection:|gameplay:|skills:"` ✓ (9 test).
- Cổng 2567/5173/2599 đã trống, không còn tiến trình nền.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (254, 23 file)   build ✓   e2e ✓ (24, `--workers=1`, không có test chập chờn)   photo3d (không chạy)
- Ảnh đã xem (Read), `shots/t5-after-check/labels-{desktop,portrait,landscape}-{players,wild,alpha}.png` (9 ảnh) và `report.json`: cả 9 ảnh 0 cặp chồng (cặp 59 px² của portrait-alpha ở lần coder chụp không còn, chụp lại 0). Hiệp, thú đi theo, thú đang nhắm, đầu đàn đều có nhãn; thanh máu hiện ở thú bị thương và đầu đàn; tối đa 1 nhãn ẩn mỗi ảnh (ẩn là nhãn thú hoang xa), 2 nhãn thu gọn ở cảnh `wild`. Nhãn nâng lên vẫn nằm sát chủ (ở đám đông đứng cạnh nhau, đọc được chủ nhờ vòng màu dưới chân). `labelMs` 0,078 / 0,080 / 0,080 ms (coder đo trước 0,175-0,213).
- desktop-alpha chụp lại đúng thời điểm: người chơi còn sống (58/100), 3 nhãn (Hiệp, đầu đàn, Lv 8 Emberpup), 0 chồng.
- Ghi chú nhỏ (không phải lỗi): ở portrait-alpha, nhãn "Hiệp" bị chữ bay "Set Chuối" che (chữ bay nằm trên mọi nhãn theo đúng kế hoạch); nhãn vẫn hiện trong DOM, 0 chồng giữa các nhãn.
- Tiêu chí hoàn thành: [x] labelLayout thuần + 12 unit test  [x] nhãn ghim không ẩn (e2e kiểm me, companion, thú đang nhắm)  [x] chờ 250 ms, mượt  [x] thú đang nhắm trong vòng thú hoang  [x] đo khi đổi (e2e `measured` tăng ≤ 10 trong 60 khung yên qua)  [x] không cấp phát mỗi khung (đọc code, labelMs thấp hơn trước)  [x] chữ bay nằm trên  [x] server/schema không đổi  [x] 9 ảnh, 0 cặp chồng, ≤ 1 ẩn, labelMs < 1,5x trước  [x] toàn bộ lệnh sạch  [x] docs cập nhật
- Test đã thêm: không (coder đã có đủ unit + e2e theo PLAN.md).

## Vòng 2: coder
- [x] Lỗi 1: `scripts/shots.mjs` `worldShots` đóng context điện thoại (`phone.context().close()` trong `finally`), nên nhóm `labels` không còn bị trang điện thoại tranh CPU.
- [x] `Game.ts`: chú thích thú đang nhắm nói đúng (luật của server; `throwBall` ở client vẫn tính cả thú trong bóng). Không đổi hành vi.
- [x] `shots.mjs`: xoá hàm `frames()` không dùng; `--only` kiểm giá trị (thiếu hoặc tên lạ thì báo lỗi, thoát mã 1, trước cả bước build).
- Kiểm: `npm run shots -- --name t5-r2-all` (mặc định, 24 ảnh): 0 cặp chồng ở cả 9 ảnh nhãn, `labelMs` 0,107 / 0,140 / 0,082 (desktop / dọc / ngang, cảnh `wild`), portrait-alpha đủ 3 nhãn. `--only labels` (`t5-r2-labels`): 0 cặp chồng, `labelMs` 0,112 / 0,098 / 0,090.
- Lệnh đã chạy: typecheck ✓, test ✓ (254 test), build ✓. Không còn tiến trình nền.

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (254, 23 file)   build ✓   e2e ✓ (24, --workers=1)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] nhãn không đè nhau ở desktop/dọc/ngang (9 ảnh labels: overlap pairs 0, area 0) [x] không hồi quy so với vòng 1 [x] shots mặc định đủ 24 ảnh, nhóm world không hỏng
- `npm run shots -- --name t5-r2-default`: labels-portrait-alpha đúng (3 nhãn, không đè); labelMs 0.09/0.21/0.11 ms (wild), `--only labels` 0.08/0.12/0.135 ms: cùng cỡ.
- `--only` thiếu giá trị hoặc `bogus`: báo "--only needs "world", "labels" or both ...", thoát mã 1, không tạo thư mục ảnh.
- Test đã thêm: không (không cần thêm).
