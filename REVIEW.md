PASS
# REVIEW: T59 Cây bị chặt không hết rung, cây mọc lại không lớn hết, vòng 1
## Kết luận
Thay đổi làm đủ các bước và tiêu chí trong PLAN.md, không làm thừa. `dt` thật đã vào `Scenery.update` (lấy từ `frame()`, giới hạn 0,1 s). Toán rung và mọc lại nằm trong `propMotion.ts` thuần, cho ra đúng số của `23cb20b`. Hai lỗi phụ (khung cuối của mọc lại, đếm lùi ngoài camera) đã sửa đúng. Typecheck sạch, `propMotion.test.ts` 10/10 (reviewer chạy lại). Tester đã xác nhận e2e hỏng khi đặt lại `dt = 0`.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm
- **Số hình không đổi so với `23cb20b`:** 0,35 / 0,45 / 0,55 / 0,14 / 60 / 2 / 90. `shakeLean`, `shakeJolt` cho ra đúng biểu thức `sin(left·rate)·max·(left/0.35)`. `growSize` đúng `0.55 + 0.45·(1-(1-g)²)`, chỉ thêm kẹp `g` về 0..1 (không đổi kết quả trong khoảng cũ). `scenery.ts` không còn số cứng của rung hay mọc lại. Unit test ghim thẳng 0,14 / 2 / 0,55 (không đọc lại `PROP_MOTION`), nên lỡ tay đổi số sẽ bị bắt.
- **Chuyển trạng thái** (`scenery.ts:298-334`, `352-385`):
  - Rung xong trên màn hình: khung cuối đặt `skew = 0`, `x = prop.x`, rồi đi tiếp vào nhánh lay gió và mờ tán như cây khác.
  - Rung xong ngoài màn hình: đứng thẳng, đúng chỗ. Lúc camera quay lại, nhánh lay gió đặt lại `skew`.
  - Đang rung ngoài màn hình: `continue` sau khi đã gán `sprite.visible = false`, đúng.
  - Cây đổ giữa lúc đang rung: `setFelled(true)` đặt `skew = 0` và `grow = 0`, gốc chỉ giật ngang, không bị đặt lại cỡ cây. Trường hợp cây vừa mọc lại đã bị chặt ngay trong 0,45 s cũng được sửa luôn.
  - Đá vụn hay gốc cây bị đánh: `growing = false` nên không đổi cỡ riêng do `setFelled(true)` đặt.
  - Khung `grow` về 0: `growing` đọc trước khi đếm lùi, `growSize(0) = 1`, nên cỡ đúng tuyệt đối. Tester xác nhận e2e bắt được khi đổi ngược lại.
  - Lật hình được giữ bằng `Math.sign(sprite.scale.x)`.
- **Hiệu năng:** vòng lặp đã duyệt ~2058 prop mỗi khung. Phép kiểm `shake > 0 || grow > 0` chỉ được đưa lên trước phép kiểm tầm nhìn, tức thêm hai phép so sánh mỗi vật. Phần đếm lùi và đặt dáng chỉ chạy cho vài vật đang rung hay đang mọc. Các hàm thuần trả số, không tạo object. `debugProp` chỉ tạo object khi test gọi. Không đổi số sprite.
- **Hook debug:** `debugInfo(prop?)` và `debugProp` chỉ đọc, chạy ở client, không gửi gì lên server, nên không phải hook `debug:*` của server và không mở đường gian lận. Gọi không tham số (`scripts/shots.mjs`) vẫn trả như cũ, chỉ thêm `prop: undefined`.
- **Đường tắt e2e `setFelled(i, false)`:** chỉ đổi hình ở client, có chú thích trong test. Khi server mọc lại thật (90 s sau), `onRemove("felled")` gọi `setFelled(false)` và nó dừng sớm vì `p.felled` đã là `false`, nên vô hại. Phần sau của test đã teleport đi chỗ khác. Không thêm hook server, đúng phạm vi.
- **Thứ tự tin nhắn trong bước "đứng thẳng sau nhát đầu":** `gather()` gửi `Gathered` ngay (`GameRoom.ts:2024`, nên `hitProp` chạy trước), còn `wood` đi theo patch state sau đó. `NODE_HITS.tree = 3`, nên nhát đầu không làm cây đổ và `!p.felled` đứng vững. `art.sway` luôn là số (`nature.ts:41`), nên `p.sway + 1e-9` không thành NaN.
- **Quy ước:** chú thích tiếng Anh có JSDoc, tên file và hàm đúng kiểu, import có `.ts`. Tài liệu `architecture.md` và `art-style.md` cập nhật đúng bước 6.

## Góp ý không bắt buộc
- `tests/e2e/multiplayer.spec.ts:739-742`: bước "đứng thẳng lại" chỉ kiểm trạng thái cuối, nên nếu `hitProp` không bao giờ chạy (mất dây `Gathered` → `hitProp`, hay `node` khác `tree.index`) thì test vẫn qua mà không kiểm được gì. Lý do: Chromium phần mềm chỉ chạy vài khung/giây, rung xong trong ≤ 4 khung, nên poll khó bắt được lúc đang rung. Nếu muốn chặt hơn, có thể thêm vào `debugProp` một bộ đếm số lần bị đánh (`hits`), rồi kiểm nó tăng lên 1 sau nhát đầu. Đây là việc nhỏ, có thể thêm vào TASKS.md ở ưu tiên thấp.
- Các chuyển trạng thái trong vòng `Scenery.update` (khung cuối, gốc không đổi cỡ, đếm lùi ngoài camera) chỉ có e2e kiểm. Lỗi `growing` → `grow > 0` không bị unit test bắt. Muốn có unit test, có thể tách thêm một hàm thuần kiểu `stepPropMotion(state, dt, kind, felled)` trả dáng vào một object dùng lại. Không cần làm ngay.
- Rủi ro đã ghi trong PLAN: e2e không kiểm dây nối `onRemove("felled")` → `setFelled(false)` khi server mọc lại thật. Nếu sau này cần, làm hook `debug:regrow` ở server thành nhiệm vụ riêng. Hiện không đề xuất.
