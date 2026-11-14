PASS
# REVIEW: T57 Thú hiền chạy trốn về phía thoáng, vòng 1

## Kết luận
Thay đổi làm đúng và đủ PLAN.md, không có gì ngoài phạm vi. `fleeDirection` và `steerFlee` đúng luật, tất định, dùng đúng đơn vị (px); trạng thái giữ hướng sống trong mục `fleeing` nên không còn hướng cũ sau khi bắt, hạ gục hay choáng. Chi phí mỗi tick không đáng kể, thú không phải loài hiền không bị ảnh hưởng. Typecheck sạch, test liên quan qua (tôi đã chạy lại).

## Lỗi phải sửa
Không có.

## Đã kiểm
- **Lấy mẫu góc:** vòng đầu `stepRad = 2·70°/8 = 17,5°`, thứ tự 0, +17,5, −17,5, ..., ±70 (9 hướng). Vòng dự phòng: tôi in thử thứ tự, ra 0, +22,5, −22,5, ..., −157,5, +180, đủ 16 hướng khác nhau, 180° chỉ một lần (đúng rủi ro 4 của PLAN). `i = 0` cho `off = −0`, `cos(−0) = 1`, vô hại.
- **Chấm điểm và bằng điểm:** `alignWeight·cos(off) + clearanceWeight·min(clearanceAt(end), 64)/64`, chỉ thay khi `>`, nên bằng điểm thì giữ hướng lệch ít hơn, và lệch bằng nhau thì giữ phía `+`. Tôi chạy thử cảnh một cây: ra +52,5°, khớp bản mẫu. Không dùng `Math.random` hay thời gian.
- **Trùng chỗ kẻ đánh:** `d ≤ 1e-6` cho `(0, 1)`, `atan2(1, 0) = π/2`, không ra NaN.
- **Đơn vị:** `clearanceAt` trả px (tối đa `NAV_MAX_CLEARANCE` = 64), `radius` là `species.size` px, `lookaheadPx` là px. `lineClear(..., { radius, sea: false })` bỏ mẫu đầu và quét ô biển chính xác, ra khỏi thế giới thì coi là chặn. `this.paths.nav` (`defaultNav()`) dựng từ cùng `defaultWorld().grid` và terrain với `this.obstacles`/`this.terrain`; vật cản là tĩnh (không có chỗ nào thêm hay bớt vòng tròn lúc chạy).
- **Vòng đời:** mục `fleeing` bị xoá ở `daze`, `removePal` (bắt, hạ gục, biến mất lúc sáng) và khi hết giờ hay mất kẻ đánh (dòng 776). `provoke` ghi đè cả mục (`steerUntil: 0`), nên mỗi đòn mới và mỗi lần thoát bóng đều chọn lại hướng. Mục mới luôn chọn hướng ở tick đầu (`now < 0` không xảy ra), nên `dirX/dirY = 0` không bao giờ được dùng để đi.
- **Đứng yên ở bờ:** vẫn đứng yên tick đó như trước, đặt `steerUntil = 0` nên tick sau chọn lại. Trường hợp xấu nhất (nhánh `"straight"` đâm ra biển) là chọn lại mỗi tick, khoảng 9-10 µs mỗi lần (tôi đo được 8,9 µs mỗi lần gọi trên `defaultNav()`), không tệ hơn hành vi cũ.
- **Thú khác:** điều kiện `passive && !alpha` trong `provoke` không đổi; nhánh đuổi, đầu đàn, trùm, thú đi theo không bị chạm. Test mới của tester khoá điều này.
- **`PathPlanner.nav` công khai `readonly`:** chấp nhận được. Lưới dùng chung giữa các phòng, nhưng `GameRoom` chỉ gọi `lineClear` và `clearanceAt`, hai hàm thuần chỉ đọc. Trạng thái tạm của A* chạy đồng bộ, như JSDoc của `NavGrid` đã nói.
- **Vòng import:** `combat.ts` → `pathfind.ts` → (`constants`, `collision`, `terrain`, `worldgen`), không file nào trong số đó import `combat.ts`.
- **Test:** 9 test shared khớp PLAN; 2 test tích hợp hỏng ở code cũ (coder đã kiểm); 2 test tester thêm bắt được đột biến e) và f). Test "hit again" dùng `tick` đồng bộ, không có `await` xen giữa, nên tất định. Hai test `fleeRun` dùng đồng hồ thật, nhưng ngưỡng rộng (≥ 70 px so với khoảng 96 px kỳ vọng, kẹt ≤ 1) và tester đã chạy lặp 3 lần đều qua.
- **Bảng số:** 7 số nằm trong `FLEE_STEER`; ngoài bảng chỉ có `NAV_MAX_CLEARANCE`, `1e-6` và `(0, 1)` như PLAN cho phép. Số `200` trong `stepFlee` có từ trước.
- **Tài liệu:** `docs/design/pals.md` mục "Chạy về phía thoáng" khớp tên hàm và số (9 hướng, ±70°, 17,5°, 96 px, 64 px, 16 hướng, 250 ms, chọn lại ở bờ biển).

## Góp ý không bắt buộc
- `combat.ts` `fleeDirection`: mỗi lần điểm tốt hơn lại tạo một object `best` (tối đa 9 + 16), cộng thêm closure `pick` và kết quả spread. Có thể giữ `bestX`, `bestY` dạng số. Chỉ chạy mỗi 250 ms mỗi thú, nên không cần làm ngay.
- `fleeDirection`: nếu `samples = 1` thì `stepRad = Infinity` và `off = −0 · Infinity = NaN`. Bảng là hằng số và test đã khoá `samples` lẻ và bằng 9, nên chỉ thêm guard (`samples > 1 ? ... : 0`) hoặc ghi chú "≥ 3" vào JSDoc nếu muốn chắc.
- Nhãn `"around"` vẫn có thể là hướng nằm trong ±70° (ví dụ 22,5° hay 45°, vốn không có trong vòng đầu). Hành vi đúng; chỉ cần JSDoc của `FleeHeading` nói "sau vòng đầu" thay vì "only a wider one".
- Test "is deterministic" gọi cùng một hàm hai lần, nên chỉ chứng minh rất ít. Có thể khoá thêm việc tách hoà: cảnh một cây đối xứng phải ra `y > 0` (+52,5°, hướng `+` xét trước).
- Trong test bờ biển tích hợp, `swam === false` luôn đúng kể cả ở code cũ (nhờ chốt `isSea`). Phần kiểm thật nằm ở `moved` và `stuck`; giữ lại cũng được.
- `pals.md` dòng 216 "theo hướng thoáng gần với hướng thẳng ra xa nhất" hơi đơn giản hoá: điểm có cộng độ thoáng, nên hướng lệch nhiều hơn vẫn có thể thắng. Mục con ngay dưới đã nói đúng.
- Còn lại một trường hợp hiếm: `obstacles.resolve` đẩy thú trượt quanh cây xuống ô biển. Khi đó thú chọn lại đúng hướng cũ (tất định) và đứng yên cho tới khi kẻ đánh di chuyển, giống hành vi trước T57. Chỉ nên xử lý nếu playtest thấy (trùng với ý "trượt dọc bờ" ở Quyết định 2).
