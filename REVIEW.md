PASS
# REVIEW: T54 Thú lang thang tới đích không lấn vào cây; test trùm qua khe tất định, vòng 3

## Kết luận
Lỗi phải sửa của vòng 2 đã được sửa: chú thích của test (a) giờ nói đúng rằng hạt 42 chỉ cố định dãy số ngẫu nhiên, còn lỗi lấn cây khi tới đích do test kế tiếp và `wander.test.ts` bảo vệ. Code `stepWander` không đổi so với vòng 2 (chỉ đổi JSDoc). Hai góp ý vòng trước cũng đã làm: JSDoc viết nhẹ lại, số 14 lặp lại đã đặt tên `treeR`. Không còn lỗi phải sửa.

## Lỗi phải sửa (FAIL khi còn mục này)
(không có)

## Đã kiểm
- **`GameRoom.test.ts:774-775`:** chú thích mới đúng với kết quả đột biến ở vòng 1 và 2. Phân vai giữa các test rõ ràng: test (a) bảo vệ khe hẹp; test tích hợp mới và test unit bảo vệ nhánh tới đích.
- **JSDoc `stepWander`:** mô tả đúng việc code làm (đẩy đích ra khỏi vật cản khi tới nơi), không còn khẳng định "never".
- **Test tích hợp mới:** tính lại `reach = BOSS.radius + treeR` cho cùng con số như vòng 2 (cây cách 55, đích lấn 1 px), nên hành vi test không đổi.
- **Những gì đã kiểm ở vòng 2 vẫn còn đúng:**
  - Thứ tự rút số ngẫu nhiên không đổi; mọi thú hoang đều đi qua chỗ gọi `GameRoom.ts:753`.
  - Mock `Math.random` được khôi phục; `respawnTimer = -Infinity` chặn hồi sinh.
  - `deepest >= 20` tất định.
  - Ba đột biến đều bị ít nhất một test bắt 5/5 lần.
  - Phạm vi đúng: chỉ đổi `wander.ts`, `wander.test.ts`, `GameRoom.test.ts`; không đổi giao thức hay `Profile`.
- **Chạy lại để xác minh:** `wander.test.ts` cùng `GameRoom.test.ts -t "boss movement"`: 10/10 qua. Tester vòng 3 báo typecheck sạch, `npm test` 368/368.

## Góp ý không bắt buộc
- `PLAN.md` mục 4 và tiêu chí "đột biến 2 hỏng 5/5 ở test (a)" đã lỗi thời. Thân commit message nên ghi rõ phân vai mới giữa các test (đã nêu ở mục Đã kiểm), để lịch sử không mang lại khẳng định sai về hạt 42.

## Việc mới đề xuất cho `TASKS.md`
- **P3: Thú bước dài có thể xuyên khe hẹp khi server chậm** (đồng ý với đề xuất cuối `PLAN.md`).
  - `CollisionGrid.resolve` chỉ đẩy thú ra tại điểm đích, không quét đường đi.
  - Khi tick dài 250 ms liên tục, trùm bước 11 px và lọt khe 52 px ở 6/5.000 lần trong mô phỏng tường của test (a).
  - Cùng nguyên nhân: ở nhánh tới đích, nếu một bước lấn quá nửa vùng cấm của một vật cản nhỏ, `resolve` có thể đẩy thú sang phía bên kia vật cản. Điều này chỉ xảy ra với thú nhanh và tick dài.
  - Hướng sửa: chia bước dài thành các bước con (ví dụ ≤ bán kính / 2) trong `stepWander` và `stepChase`, hoặc giới hạn `dtMs` trong `GameRoom.tick`.
  - Ưu tiên thấp, vì server thường chạy 20 tick/giây.
