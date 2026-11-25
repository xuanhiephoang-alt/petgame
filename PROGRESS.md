# PROGRESS: T25 Né đòn bằng cách ngắt rồi nối lại mạng liên tục

## Vòng 1: coder
- [x] Shared: `DROP_SHELTER_DELAY_MS` = 1500 (`constants.ts`, JSDoc); `skillLandsWithinMs` (`skills.ts`); `attackLandsWithinMs(skills)` (`combat.ts`, không vòng import). Test trong `skills.test.ts`: `blizzard` 1350, `ember`, chiêu không `durationMs`, tối đa 1350 hôm nay, và test chốt `DROP_SHELTER_DELAY_MS >= attackLandsWithinMs + 2 * TICK_MS`.
- [x] `GameRoom.ts`: trường `shelterDelayMs`; `onDrop` chỉ giữ chỗ, nhánh mất chỗ của T24, dừng ý định (4 dòng) và hẹn `this.clock.setTimeout(() => this.shelter(sid, hold), shelterDelayMs)`; `shelter` (riêng) kiểm `holds.get(sid) === hold` và người chơi còn, rồi `offline`, `calmPalsTargeting`, huỷ chiêu thú đi theo, `saveNow`.
- [x] `GameRoom.test.ts`: `steadyClock` lên cấp file; `cutConnection(room, sid, { realDelay })` đặt `shelterDelayMs = 0` trừ khi `realDelay`; hai chỗ `ref.terminate()` trực tiếp cũng đặt `shelterDelayMs = 0`; sửa chú thích "Saved at the drop"; test mới T1-T6 (cùng helper `untilClock`, `dropForReal`, `watchOffline`, `foeBeside`).
- [x] Tài liệu: `docs/design/multiplayer.md`, `docs/architecture.md`.
- Lệch kế hoạch:
  - T1 kéo dài cú cắn bằng `combat.windUp(..., "bite", 900)` (thay vì chờ `windupUntil` tự có): cú cắn 450 ms có thể trúng trước khi SDK nối lại xong, khi đó test không chứng minh gì. Vẫn kiểm đúng các mong đợi của kế hoạch.
  - T3 lặp 7 vòng (kế hoạch: 4): thú hoang cắn khoảng một lần mỗi 1,5 s, 4 vòng chỉ có 1 cú cắn nên không đủ "ít nhất 2 cú". Mỗi vòng vẫn ngắn hơn 1,5 s. Đếm cú cắn bằng spy `combat.damage` lên người chơi.
  - T3 không dùng cổng `holdReconnect` (mở ngay): chỉ đặt `minDelay`/`maxDelay` ngắn để SDK nối lại tự động.
  - T4 thêm một `expect` bảo vệ: lần rớt thứ hai phải đến trước `dropAt1 + 1500`, không thì test tự báo là không kết luận được.
- Lệnh đã chạy: typecheck ✓, `npm test` ✓ (741 test, 49 file), build ✓. Vòng lặp describe `reconnecting after a dropped connection` 5 lần: 5/5 qua (24 test, khoảng 33 s mỗi lần), không chạy dưới tải CPU. `npm run test:e2e` ✓ (70 passed, gồm các test `connection:` cũ không sửa và `reconnect.spec.ts`; flake `boss bar (phone upright, notch)` không xảy ra).
- Kiểm nhanh đột biến M1 (gọi `shelter` ngay trong `onDrop`): cả 6 test T1-T6 hỏng, đã hoàn tác (`git diff --stat` chỉ còn thay đổi của vòng này). Bảng M1-M10 đầy đủ là việc của tester.
- Không đổi client, schema, message, `Profile`, close code; không dependency mới; `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json` không bị đụng; không commit.

## Kiểm thử vòng 1 (T25): PASS
- typecheck ✓   test ✓ (49 file, 741 test; chạy 2 lần)   build ✓   e2e ✓ (70/70, gồm `connection:` cũ và `reconnect.spec.ts`; boss bar không flake)   photo3d (không chạy)
- Chạy lặp describe `reconnecting after a dropped connection` (24 test): 10/10 qua (334 s, ~33 s mỗi lần); dưới 4 vòng lặp CPU 8/8 qua (278 s, ~35 s mỗi lần). Không flake. Đã tắt các vòng lặp CPU.
- Đột biến (hoàn tác bằng bản sao, diff khớp), test bắt được:
  - M1 (`shelter` ngay trong `onDrop`): cả T1-T6 hỏng.
  - M2 (`holds.has` thay `=== hold`): T4. M3 (bỏ kiểm hold): T3 và T4 (T1 không hỏng vì kiểm của T1 kết thúc trước 1,5 s; kế hoạch dự kiến T1, không ảnh hưởng).
  - M4 (`calmPalsTargeting` trong `onDrop`): T3 (T1 không hỏng, cú cắn đã gồng vẫn trúng).
  - M5 (dời bốn dòng dừng ý định sang `shelter`): T5.   M6 (`saveNow` trong `onDrop`): T3 và T5.
  - M7 (`DROP_SHELTER_DELAY_MS = 1000`): test chốt shared "is shorter than DROP_SHELTER_DELAY_MS by at least two ticks" và T2.
  - M8 (`skillLandsWithinMs` bỏ phần bay/kéo dài): 2 test shared (`is the cast plus...`, `is 1350 ms...`).
  - M9 (bỏ `cancelCasts`): T5 và test cũ `a drop wipes...`.
  - M10 (`cutConnection` không đặt `shelterDelayMs = 0`): 15/150 test hỏng (các test T3/T24 cũ chờ `offline` hết hạn).
  - Test khoá: đổi `blizzard.durationMs` 700 -> 1000 trong `skills.json` (tạm, đã hoàn tác): 3 test shared hỏng, gồm test chốt.
- Nhận xét lệch của coder: T1 ép cú cắn 900 ms là hợp lý (cú 450 ms có thể trúng trước khi SDK nối lại, test sẽ rỗng; nó vẫn kiểm cú cắn trúng, mục tiêu giữ nguyên và `offline` chưa bật); T3 lặp 7 vòng, mỗi vòng < 1,5 s, kiểm tối thiểu 2 cú cắn bằng spy: không yếu đi; T4 guard `expect(dropAt2).toBeLessThan(dropAt1 + DROP_SHELTER_DELAY_MS)` là `expect` cứng, không bỏ qua hay qua suông: nếu lần rớt thứ hai đến muộn thì test hỏng với lời báo "inconclusive" (chấp nhận được, hơi nhạy với máy rất chậm, nhưng dưới tải 4 CPU không lần nào hỏng).
- Đọc mã: rớt < 1,5 s không huỷ gì (`shelter` chạy sau hẹn giờ và thấy hold đã bị `onReconnect` xoá); mất mạng thật vẫn được bảo vệ sau 1,5 s (T5); hẹn giờ của lần rớt cũ so `holds.get(sid) !== hold` nên không bảo vệ lần rớt mới (T4, M2/M3); `saveNow` chỉ ở `shelter` nên rớt liên tục không ghi SQLite (T3, M6); nhánh `noteResume` của T24 nằm trước, không hẹn bảo vệ, không đổi (các test T24 qua).
- Ràng buộc: không đổi client, schema, message, `Profile`; `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json` không đụng; `git stash list` còn 2 mục. Không commit.
