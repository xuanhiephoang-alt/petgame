# QUESTIONS

Câu hỏi đội agent cần người dùng trả lời. Chỉ ghi khi: yêu cầu mâu thuẫn, cần quyết định thiết kế lớn không thể đảo ngược, hoặc sau 3 vòng sửa vẫn lỗi (xem `CLAUDE.md`). Nhiệm vụ liên quan được đánh dấu `⛔` trong `TASKS.md`; đội vẫn làm tiếp các việc khác.

Trả lời: ghi ngay dưới câu hỏi (dòng `Trả lời:`), rồi đổi `⛔` trong `TASKS.md` lại thành `[ ]`.

Mẫu:

```
## Q<số> (<ngày>) · <mã nhiệm vụ>: <câu hỏi ngắn>
- Bối cảnh: ...
- Phương án: A) ... B) ...
- Đề xuất: ... vì ...
- Trả lời:
```

## Q1 (2026-11-14) · T63: cho thêm vòng sửa thứ 4 để vá luật xếp nhãn tên?
- Bối cảnh: T63 bắt đầu là việc dọn test thanh máu trùm. Khi tìm gốc test chập chờn, đội phát hiện lỗi thật trong game: nhãn thú đi theo hoặc thú đang ngắm đứng ngang bên cạnh đẩy tên mình lên 9-21 px, nên thông báo che tên. Vòng 2 sửa bằng luật "tên mình luôn xếp trước" (hai dòng trong `comesFirst`, `packages/client/src/game/labelLayout.ts`). Tester vòng 3 PASS (57/57 e2e, test thanh máu trùm có tai thỏ 60/60), nhưng reviewer vòng 3 FAIL: với luật mới, khi một nhãn ghim có thanh máu (thú đang ngắm, thú đầu đàn) lấy chỗ ngay trên tên mình, thú đi theo chưa bị thương (không có thanh máu để thu gọn) bị ép đè lên tên mình lâu dài. Quét lưới: 98/6114 vị trí với thú đang ngắm, 278/6114 với thú đầu đàn (bản trước T63: 0). Đã hết 3 vòng nên dừng theo `CLAUDE.md`.
- Phần dở dang: `git stash` "T63 round 3 (FAIL after 3 rounds, waiting on QUESTIONS.md Q1) …" (gồm dọn test, sửa `comesFirst`, unit test, PROGRESS.md, REVIEW.md). Stash chỉ nằm trên máy này: nếu container bị thay thì mất, khi đó làm lại theo `PLAN.md` (đã commit, có phần "Vòng 2") và cách sửa dưới đây.
- Phương án:
  - A) Cho thêm một vòng: thêm một dòng vào `comesFirst` ngay sau dòng so nhãn ghim với nhãn thường: `if (pinnedA && (a.barHeight > 0) !== (b.barHeight > 0)) return a.barHeight === 0;` (nhãn ghim không có thanh máu xếp trước nhãn ghim có thanh máu). Reviewer đã thử trên bản chép: cả hai lần quét về 0/6114, 15 unit test vẫn qua. Kèm unit test cho cảnh tái hiện, siết test 13, sửa JSDoc và một câu trong `docs/design/pals.md`. Rồi tester và reviewer chạy lại.
  - B) Bỏ phần sửa sản phẩm, chỉ giữ phần dọn test (trùm đi lang thang, thú hoang gần chỗ đo, khôi phục test `toasts (...)`). Khi đó test thanh máu trùm có tai thỏ vẫn hỏng khoảng 1/40 vì lỗi tên bị đẩy lên, để cho T73.
  - C) Bỏ cả T63, giữ nguyên như hiện tại.
- Đề xuất: **A**, vì lỗi người chơi thấy được đã tìm ra gốc, cách sửa đã có và đã thử trên bản chép; phần test đã PASS và sửa đúng gốc hai lỗi chập chờn. B để lại lỗi thật và test chập chờn; C bỏ phí cả hai.
- Trả lời:
