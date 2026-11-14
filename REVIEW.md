PASS
# REVIEW: T58 Kẹp tốc độ đuổi của thú đầu đàn, vòng 1

## Kết luận
Thay đổi đúng PLAN.md, gọn, không làm thừa: `ALPHA.chaseSpeedMax = PLAYER_SPEED * 0.95` và hàm thuần `alphaChaseSpeed`, áp ở nhánh về hang và ở nhánh đuổi chỉ khi `pal.alpha`. Trùm (`GameRoom.ts:271`, `bossHeadHome` `:1697`), thú thường, `fleeSpeed` và `WILD_CHASE_SPEED_FACTOR` không đổi. Test unit và tích hợp kiểm đúng hành vi, tất định, và bắt được các đột biến chính. Đã tự kiểm lại: `npm run typecheck` sạch; `alphas.test.ts` cùng nhóm "pack leaders/chase/Scorchtail" của `GameRoom.test.ts` qua 21/21.

## Lỗi phải sửa
(không có)

## Kiểm tra theo các điểm được giao

**Có đường di chuyển nào của thú đầu đàn đi vòng qua chỗ kẹp không.** Không có đường nào cần kẹp:
- Đuổi (`GameRoom.ts:796`) và về hang (`:755`) đã dùng `alphaChaseSpeed`. Hai nhánh này là hai đường duy nhất thú đầu đàn di chuyển liên tục theo mục tiêu.
- Lang thang quanh hang (`:829`, `stepWander` với `species.speed`): tối đa 95 px/s, thấp hơn mức kẹp.
- Chạy trốn (`:765`): thú đầu đàn không bao giờ vào `fleeing` (T57; tester đã có test khoá việc này).
- Lao tới bằng chiêu (`lunge`, `:1531`): chỉ chiêu có `dash` mới lao, mà chiêu duy nhất có `dash` là `horn_charge`. Chiêu này chỉ Boulderhorn và trùm biết, không thú đầu đàn nào (voltmouse, bogbloom, cactoad, frostfang, scorchtail, coralcrab) có. Kể cả sau này có, đó là một cú lao 70 px sau 450 ms gồng, không phải tốc độ đuổi liên tục, nên không cần kẹp.
- Bị đẩy lùi (`push`, `:1364`): luôn đẩy ra xa người đánh, không giúp thú đuổi kịp.
- Dây giới hạn: không có chỗ nào dịch thẳng thú về hang; khi quá dây nó đi bộ về bằng nhánh `:748-761`, đã kẹp.
- Thú đầu đàn đã bị bắt thành thú đi theo thì chạy theo tốc độ của thú đi theo. Việc đó nằm ngoài phạm vi và cũng không phải `WildPal`.

**Nhất quán với trùm và với code chạy trốn của T57.** `alphaChaseSpeed` viết đúng mẫu `fleeSpeed` (`Math.min(speed * WILD_CHASE_SPEED_FACTOR, CAP)`, có trần là hệ số nhân với `PLAYER_SPEED`, JSDoc nói lý do). Trùm giữ nguyên 81 px/s và `pathing.test.ts` vẫn qua. Không có vòng import: `combat.ts` và các file nó import không import `alphas.ts`.

**Số cứng.** `0.95` chỉ nằm trong `ALPHA.chaseSpeedMax`. Server không có số mới. Hai chỗ có `152` trong `alphas.test.ts` là giá trị mong đợi của test, đúng như kế hoạch.

**Test có tất định không.**
- Các test tích hợp gọi `(room as any).tick(TICK_MS)` liên tiếp, không có `await` xen giữa, nên vòng mô phỏng thật của phòng không chen vào được và `dtMs` luôn đúng 50.
- `PathPlanner.run` giới hạn theo số lần tìm và số nút, không theo đồng hồ thật. Vì vậy máy chậm hay nhanh đều chọn cùng một đường đi.
- `stepChase` đi trọn một bước dù đi thẳng hay đi qua điểm vòng. Tổng quãng đi `toBeCloseTo(76, 1)` vì thế ổn định.
- Hàm chọn chiêu có gọi `Math.random`, nhưng đã bị chặn bằng `skillGapUntil = Infinity`, nên kết quả không còn phụ thuộc số ngẫu nhiên.
- Người chơi mới không có thú đi theo, nên mục tiêu chắc chắn là người chơi.
- Thú mới có thể sinh ra lại (`PAL_RESPAWN_MS` 5 s) nhưng 10 tick chỉ là 0,5 s.
- Chỗ đứng của người chơi ở test 1 có kiểm `isSea`. Test 3 đứng ở (3200, 2560), chỗ các test khác đã dùng.
- Tester chạy 3 lần đều 140/140.

**Tài liệu.** Dòng 64 của `docs/design/pals.md` và bảng 6 thú khớp code và dữ liệu (tốc độ 95, 85, 75, 55, 45, 40 nhân 1,8; Voltmouse và Scorchtail bị kẹp ở 152; tên `ALPHA.chaseSpeedMax`, `alphaChaseSpeed` đúng). Dòng 229 ở mục "Tính khí" cũng đã nhắc ngoại lệ này. Câu "khoảng 30%" ở dòng 73 vẫn đúng với số mới 29%.

**Cột 152 trong bảng thời gian hạ gục được suy ra, không đo.** Chấp nhận được. Cột 152 nằm giữa 171 và 144, mà các cột 171, 144, 128, 120 đều đo được 8,0 s (p10-p90 gần như trùng nhau). BALANCE.md cũng giải thích vì sao tốc độ đuổi không ảnh hưởng: thú đầu đàn tự tới đứng cách 28 px. Tài liệu ghi "khoảng 8 giây", không khẳng định quá mức. Không cần đo lại.

## Góp ý không bắt buộc
- Test 2 ("led past its leash") và test 3 (Scorchtail ở 3200, 2560) không có dòng `expect(isSea(...)).toBe(false)` như test 1. Có thể thêm để test tự báo khi worldgen đổi. Test 2 cũng không cần lo lắm, vì test dây giới hạn sẵn có đã dùng đúng vị trí đó.
- Dòng 796 viết điều kiện `pal.alpha` ngay trong `GameRoom`. Nếu sau này có thêm loại thú có trần riêng, nên gom vào một hàm `wildChaseSpeed(species, pal)` trong shared. Hiện chỉ có hai nhánh nên giữ như bây giờ là hợp lý.
- Phần "Rủi ro" của PLAN.md đã nhắc: khi thêm hiệu ứng làm chậm người chơi hoặc đổi `WILD_CHASE_SPEED_FACTOR`, cần xem lại bảng "Tốc độ đuổi và về hang" trong `docs/design/pals.md`. Chưa cần thêm việc mới vào TASKS.md.
