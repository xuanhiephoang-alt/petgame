PASS
# REVIEW: T29 Dọn nhỏ sau T5 (`stepPropMotion`), vòng 1

## Kết luận
Đúng phạm vi của PLAN.md: chỉ còn mục 5, các mục khác đã chuyển sang T29b có lý do. `stepPropMotion` là một hàm thuần, không tạo object, không có số cứng mới. Khối mới trong `Scenery.update` cho kết quả từng khung y hệt mã cũ. Tôi đã chạy lại: typecheck sạch; `propMotion.test.ts` qua 20/20.

## Lỗi phải sửa
Không có.

## Đã kiểm
- **Không đổi hành vi** (`scenery.ts`), so từng dòng với mã cũ:
  - `growing` được đọc trước khi đếm lùi.
  - Đếm lùi `shake`, rồi `grow`.
  - `skew.x` chỉ được gán cho cây đứng (`lean !== undefined` đúng khi `standingTree`).
  - `sprite.x = prop.x + dx`, với `dx` là 0 khi không giật: giống mã cũ.
  - Cỡ chỉ được gán khi đang mọc; khung cuối cho `growSize(0) === 1`.
  - `continue` khi còn rung.
  - Khối vẫn đứng trước `if (!visible) continue`, và chú thích "Count down even off screen" giữ nguyên.
  - Tester so 1,88 triệu trạng thái ngẫu nhiên với phép tính cũ: không có khác biệt nào.
- **Hiệu năng:** một `pose` được tạo một lần và dùng lại; hàm chỉ chạy cho vật đang rung hoặc mọc. Import thừa (`countDown`, `growSize`, `shakeJolt`, `shakeLean`) đã bỏ, `PROP_MOTION` vẫn dùng.
- **JSDoc và quy ước:**
  - JSDoc tiếng Anh nói làm gì và vì sao (đọc `growing` trước).
  - Tên `camelCase` và `PascalCase`; import nội bộ có đuôi `.ts`, import kiểu bằng `type`.
  - Không có số cứng mới.
- **Test:**
  - Bảng 10 ca của kế hoạch đều có, kiểm theo hành vi:
    - khung cuối của mọc lại cho đúng 1;
    - gốc cây và đá không nghiêng và không đổi cỡ;
    - cây đứng không giật ngang;
    - khung cuối của rung cho `busy` false;
    - `dt` ≤ 0 giữ nguyên trạng thái;
    - trả lại đúng `out` được truyền vào.
  - Đối chiếu bằng `shakeLean`, `shakeJolt`, `growSize` là kiểm *cách ghép*, không gắn vào chi tiết bên trong của các hàm đó, vì bản thân chúng đã có test riêng. M1-M5 bị bắt.
- **Ràng buộc:**
  - `git diff --name-only` chỉ có `propMotion.ts`, `propMotion.test.ts`, `scenery.ts`, `docs/architecture.md`, `PROGRESS.md`.
  - Không đụng `tests/e2e`, `labelLayout*`, `.claude/`, `package-lock.json`.
  - `git stash list` còn 2 mục.
- **Tài liệu:** dòng `propMotion.ts` trong `docs/architecture.md` đúng với code.

## Về khoảng hở M6 (đưa lời gọi xuống sau phép kiểm tầm nhìn)
Không đáng thêm một chốt rẻ ngay bây giờ, nên để T29b.
- Unit test không thể bắt, vì đây là quyết định của `Scenery`, mà `Scenery` cần PixiJS.
- Một test "tĩnh" đọc mã nguồn `scenery.ts` và so vị trí `stepPropMotion(` với `if (!visible) continue` thì rẻ, nhưng giòn: gắn vào cách viết chứ không vào hành vi.
- Chốt có nghĩa là một bước e2e: chặt một cây, đưa camera ra xa (debug teleport) khoảng `PROP_MOTION.shakeSec`, rồi quay lại và kiểm `debugInfo(prop).prop.shake === 0`. Hoặc một bước đi qua đường mọc lại thật, với hook `debug:regrow`.
- Cả hai đều đụng test chặt cây trong `multiplayer.spec.ts`, file đang bị T63 giữ. Vì vậy chúng thuộc T29b.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **T29b, thêm một bước:** sau khi chặt, đưa camera ra khỏi tầm nhìn quá `PROP_MOTION.shakeSec` (và quá `growSec` cho phần mọc lại), rồi quay lại. Kiểm `shake`/`grow` đã về 0 và cỡ đủ. Bước này bắt M6.
2. **T29b, theo PLAN.md:** test ngẫu nhiên cho `layoutTags` (sau T63); sửa chú thích `labelLayout.ts`; bộ đếm `hits` trong `debugProp`; hook `debug:regrow` (tuỳ chọn, chỉ khi `PETGAME_DEBUG=1`, kèm cập nhật danh sách hook trong `CLAUDE.md`).
3. **(Nhỏ) Tham số `jolts` của `stepPropMotion`:** người gọi tính nó từ `prop.kind === "rock" || p.felled`. Nếu sau này có thêm loại vật, cân nhắc truyền một `kind` hoặc enum thay vì hai cờ boolean đứng cạnh nhau, để khó gọi nhầm thứ tự.
