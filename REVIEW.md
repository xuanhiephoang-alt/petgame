PASS
# REVIEW: T28 Đánh dấu thú đang nhắm, vòng 2

## Kết luận
Lỗi phải sửa của vòng 1 đã sửa đúng cách: thú đang nhắm không còn bị tán cây hay núi lửa che. Phần nối dây `aimAt` trong `Scenery.update` chưa có test hành vi. Không bắt buộc sửa, vì hai hàm thuần đã có test, phần nối chỉ một dòng và ảnh chụp xác nhận. Không còn lỗi phải sửa.

## Lỗi phải sửa (FAIL khi còn mục này)
(không còn)

## Đã kiểm ở vòng này
- **`canopy.ts`:** `canopyHides` giữ đúng phép kiểm cũ (điều kiện `point.y >= prop.y - 4`, khoảng cao và rộng của tán, nhân theo `scale`). `boxHides` dùng cho hình nón núi lửa. Có test cho các trường hợp trước, bên cạnh, phía trên, `undefined` và tỉ lệ.
- **`Scenery.update`:**
  - một tán trong suốt khi che người chơi hoặc chân thú đang nhắm;
  - hình nón mờ cùng hệ số 0,15, alpha thấp nhất 0,4;
  - không tạo object mới mỗi khung, mỗi khung chỉ thêm O(1) cho hình nón.
- **`Game.ts`:** truyền `aimed?.actor.pos` vào `scenery.update`. Lệnh này chạy sau `throwTarget` trong cùng khung, nên không trễ.
- **Chú thích `THROW_REACH_SLACK`:** đã sửa đúng (nửa nhịp patch, một vòng mạng).
- **`shots.mjs`:** mỗi lần thử lại lùi 260 px, ra ngoài tầm ném.
- **Ảnh** (đã xem `shots/t28/aim-swamp.png`, phóng to vùng quanh con đang nhắm, và `aim-volcano-night.png`):
  - Núi lửa đêm: nón đã mờ, Lv 4 Leafkit rõ, vòng đọc được (cung và mũi dưới chân).
  - Đầm lầy: Lv 2 Leafkit đứng rõ, nhãn ghim ngay trên đầu, cung phải của vòng lộ ra. Con lành lặn (không nhãn) hiện qua tán đã mờ, tách hẳn khỏi con đang nhắm. Người chơi phân biệt được bóng sẽ bay vào con nào, nên đạt mục đích của tiêu chí.
  - Phần lớn vòng ở đầm lầy bị **lá súng nổi** che. Đây là hạn chế của lớp vẽ, xem góp ý thứ nhất.

## Lỗ hổng test (`aimAt` không có test hành vi): không bắt buộc
- Logic thật (hai hàm kiểm che) đã nằm trong hàm thuần và có test.
- Phần còn lại là nối dây trong lớp Pixi, chỉ một dòng ở mỗi đầu:
  - nếu tham số bị bỏ không dùng, typecheck (`noUnusedParameters`) bắt;
  - nếu chỗ gọi bỏ đối số, ảnh `aim-swamp`, `aim-volcano-night` lộ ra.
- Muốn có test e2e thì phải mở thêm một bộ đếm trong `debugInfo` (số tán và nón đang mờ) chỉ để test. Hiệu ích không xứng với chi phí, nên để thành việc sau (mục dưới), không chặn T28.

## Góp ý không bắt buộc
- **Lá súng và vật nổi che vòng:** vật trôi trên nước nằm trong `stage.objects` với `zIndex = -1e5`, tức là trên lớp `marks`, nên đè lên vòng khi thú đứng ở mép ao (ảnh `aim-swamp`).
  - Cách sửa nhỏ: đặt `AimMarker.root` vào `stage.objects` với `zIndex` khoảng `-1e5 + 1`. Khi đó vòng nằm trên vật nổi nhưng vẫn dưới mọi vật đứng.
  - Đổi lại, số `debugInfo().objects` tăng 1.
- **`docs/architecture.md`:** chưa nhắc `game/canopy.ts` (`canopyHides`, `boxHides`) và việc tán cây, núi lửa mờ đi theo thú đang nhắm. Nên thêm một dòng trước khi commit, ở mục `scenery.ts` hoặc `aimMarker.ts`.
- **Hình nón dùng cả khung chữ nhật của sprite**, nên đứng ở góc trống phía trên hai bên nón cũng làm nón mờ. Chấp nhận được. Nếu thấy phiền thì thu hẹp hộp, ví dụ chỉ lấy 70% bề rộng ở giữa.

## Việc mới cho TASKS.md
1. **(P1, lỗi có sẵn từ commit `23cb20b`, không do T28)** `Game.ts:1015` gọi `scenery.update(view, t, focus, 0, …)`, tức `dt` luôn bằng 0. Trước T28 cũng vậy, chỉ là ngầm định.
   - Trong `scenery.ts:340-347`, `p.shake` và `p.grow` không bao giờ giảm. Cây bị chặt trúng một lần thì nghiêng mãi và bỏ qua phần làm mờ (`continue`). Cây mọc lại thì đứng mãi ở 55% cỡ.
   - Sửa: truyền `dt` của `frame()`. Thêm cách kiểm, ví dụ e2e chặt cây rồi đọc `skew` hoặc `scale`, hoặc tách bước giảm thành hàm thuần có test.
2. **(P3)** Đưa vòng ngắm lên trên vật nổi (lá súng), theo góp ý thứ nhất.
3. **(P3)** `debugInfo().fades` (số tán và nón đang mờ), rồi viết e2e: thú đang nhắm đứng sau một tán thì tán đó mờ.
4. **(P3)** "Chọn thú để ném": chạm vào thú, hoặc Tab/F để đổi đích (theo PLAN.md).
5. **(P3)** Dấu "đang nhắm" trên nhãn ghim (cần đổi CSS nhãn, thuộc thiết kế HUD).
6. **T29:** bỏ mục đổi tên biến `d` (đã làm trong T28).
