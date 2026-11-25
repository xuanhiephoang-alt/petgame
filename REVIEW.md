PASS
# REVIEW: T25 Né đòn bằng cách ngắt rồi nối lại mạng liên tục (bảo vệ chỉ sau 1,5 s), vòng 1

## Kết luận
Thay đổi đúng PLAN.md. `onDrop` giữ chỗ và dừng ý định ngay, còn phần bảo vệ chuyển sang `shelter(sid, hold)`, hẹn bằng `this.clock.setTimeout` và có kiểm định danh `holds.get(sid) === hold`. Con số 1500 ms được suy ra từ dữ liệu và có test chốt. Đường né đòn mà kế hoạch nhắm tới (`connection.close(4010)` lặp lại) đã bị bịt. Tôi đã chạy lại: typecheck sạch; `skills.test.ts` qua 11/11; 7 test liên quan (T1-T6 và A1 của T24) qua.

Còn một đường né đòn khác, đi qua nhánh "mất chỗ" của T24 (góp ý 1). Kế hoạch đã cố ý để nhánh đó ngoài phạm vi, và sửa nó cần một quyết định thiết kế. Vì vậy tôi không chặn T25 vì nó, mà đề nghị làm ngay thành nhiệm vụ riêng, ưu tiên cao.

## Lỗi phải sửa
Không có.

## Đã kiểm

### `onDrop` và `shelter`
- **Kiểm định danh:** so `holds.get(sid) === hold` loại đúng ba trường hợp:
  - đã nối lại: `onReconnect` xoá hold;
  - đã rời: hết giờ chờ, `debug:endGrace`, `endSession`, vì `removePlayer` xoá hold;
  - đã rớt lần khác: hold mới là một `Deferred` khác (T4 kiểm, M2 bị bắt).
- **Vòng đời hẹn giờ:**
  - Phòng đóng thì `clock.clear()` (`Room.mjs`) huỷ mọi hẹn giờ.
  - Hẹn giờ còn treo sau `endSession`/`endGrace` thì thấy không khớp và không làm gì (T6, có spy `console.error`).
  - Rớt nhiều lần tạo nhiều hẹn giờ, nhưng mỗi cái chỉ sống tối đa 1,5 s.
- **Giữ thế giới trống:** không đổi, vì `holds` được đặt ngay lúc rớt (T6 kiểm `emptyHold`).
- **Nhánh mất chỗ của T24:** không đổi. Không hẹn bảo vệ, và `onLeave` xoá người chơi ngay.
- **`liveSessions`:** không đụng tới.
- **Lưu:** một lần rớt dưới 1,5 s không gọi `saveNow`.
  - Khi phòng đóng có trật tự, hold bị từ chối nên `onLeave` → `removePlayer` → `saveNow` vẫn chạy.
  - Chỉ khi process chết đột ngột thì mất phần chưa lưu kể từ lần lưu theo lô gần nhất, đúng như với người đang chơi bình thường. Không mất gì thêm.

### Con số 1500 ms
- **Các đòn:**
  - `attackLandsWithinMs` lấy số lớn nhất của: cắn thú hoang (cả thú đầu đàn, cùng `WILD_WINDUP_MS` 450), cắn và dậm của trùm (600 và 1000), và `castMs + skillTravelMs(reach)` của mọi chiêu. Hôm nay ra 1350 (`blizzard`). Cộng 2 nhịp là 1450, nhỏ hơn 1500.
  - Tôi đã đối chiếu mọi chỗ gọi `windUp` (`movement.ts`) và `startCast` (`skills.ts`). Không còn đường gồng nào khác.
  - Dữ liệu chiêu không có sát thương kéo dài theo thời gian (không có trường `*Ms` nào ngoài `castMs`, `cooldownMs`, `durationMs`, `shieldMs`). Đẩy lùi, `chain`, `root`, `dash` đều xảy ra lúc trúng, không kéo dài thêm.
- **Trùm:** trùm được tung chiêu khi `distance - BOSS.radius <= reach`, nên quãng bay thật có thể dài hơn `reach` 40 px. Tôi đã tính trên dữ liệu hiện có: chiêu của trùm (`horn_charge`, `rock_spikes`) không bay theo tốc độ, nên không đổi. Mọi chiêu cộng thêm 40 px vẫn tối đa 1350. Xem góp ý 2 cho trường hợp sau này.
- **Không có số cứng:** số liệu nằm trong `constants.ts`, `BOSS` và `skills.json`.

### Người chơi thật
- Client không đổi. Màn "Đang kết nối lại…" vẫn hiện ngay lúc rớt.
- Trong 1,5 s đầu, nhân vật đứng yên trong thế giới. Người khác thấy họ đứng yên, chưa có "(mất kết nối)". Khi nối lại, máu và vị trí mới tới qua state.
- Lần mất mạng im lặng (phổ biến nhất) vốn đã mất 6-9 s server mới biết, nên gần như không khác.

### Test
- **T1-T6** dùng `steadyClock` và đồng hồ phòng. Các đột biến M1-M10 bị bắt.
- **Các lệch của coder đều hợp lý:**
  - T1 ép gồng 900 ms, để lần nối lại xong trước khi đòn rơi.
  - T3 lặp 7 lần, để có ít nhất 2 cú cắn.
  - T4 có câu báo "không kết luận được".
- **`cutConnection` đặt `shelterDelayMs = 0`:** không làm yếu test cũ. Các test đó kiểm trạng thái "đang vắng", và vẫn chờ `offline` bằng `vi.waitFor`. Phần dừng ý định vẫn chạy ngay trong `onDrop`, nên test `a drop wipes…` vẫn đúng nghĩa.
- **Hai chỗ `ref.terminate()` gọi thẳng:** đặt `shelterDelayMs = 0` tại chỗ, đúng như kế hoạch.
- **`steadyClock`:** lên cấp file với thân giữ nguyên.

### Tài liệu và ràng buộc
- **Tài liệu:** `docs/design/multiplayer.md` và `docs/architecture.md` đúng với code. Có JSDoc tiếng Anh cho hằng số, hai hàm mới và `shelter`.
- **Ràng buộc:**
  - Không đổi `packages/client`, `tests/e2e`, `schema.ts`, `messages.ts`, `persistence`, `.claude/`, `package-lock.json`.
  - `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **[ưu tiên cao, nên thành nhiệm vụ mới ngay sau T25] Vẫn né được đòn qua nhánh "mất chỗ" của T24.**
   - **Cách làm:**
     1. Đóng socket (lần rớt thường, hold là `Deferred`, chưa được bảo vệ).
     2. SDK nối lại; client bỏ `JOIN_ROOM` và đóng socket ngay, đúng cách test A1 làm bằng cách thay `connection.events.onmessage`. Làm được từ console.
     3. Server vào nhánh hold không phải `Deferred`: ghi điểm quay lại rồi `onLeave` → `removePlayer` xoá người chơi **ngay**. `calmPalsTargeting` huỷ cú cắn hay cú dậm đang gồng.
     4. Vào lại bằng token (client của T24 tự làm, một lần mỗi 60 s; script tự gọi `joinById` thì không bị giới hạn): đứng đúng chỗ cũ, đúng máu cũ.
   - **Hệ quả:** người dùng script né được từng cú dậm của trùm (gồng 1000 ms, hồi 6 s), rồi đánh tiếp tại chỗ.
   - **Vì sao kế hoạch bỏ sót:** kế hoạch coi nhánh đó là "không bảo vệ gì". Thật ra xoá người chơi chính là sự bảo vệ mạnh nhất.
   - **Hướng sửa (cần game-designer chọn):**
     - (a) Trong `onLeave`, nếu người chơi vừa mất chỗ mà chưa được bảo vệ, giữ `Player` trong thế giới (đứng yên, chưa `offline`) đến hết `shelterDelayMs` kể từ lần rớt, rồi mới `removePlayer` và ghi điểm quay lại theo máu và chỗ lúc đó. Lần vào lại bằng cùng token trong lúc đó phải chờ hoặc nhận lại đúng trạng thái, không được `endSession` xoá ngay.
     - (b) Lúc xoá một người chưa được bảo vệ, cho các đòn đang gồng nhắm vào họ trúng ngay vào máu của điểm quay lại.
   - Cùng việc đó: ghi phần còn hở này vào mục "Đã cân nhắc" của `multiplayer.md`, vì câu "ngắt rồi nối lại nhanh không né được gì" chỉ đúng với lần rớt thường.
2. **`attackLandsWithinMs` (`packages/shared/src/combat.ts`):**
   - Với chiêu của trùm nên tính quãng bay `skillReach + BOSS.radius`, vì `wildSkill` trừ `BOSS.radius` khi xét tầm, còn `startCast` tính quãng bay từ tâm trùm.
   - Hôm nay không đổi kết quả. Nhưng nếu sau này trùm có chiêu bay theo tốc độ, chiêu đó trúng muộn hơn mức test chốt tính, mà test vẫn xanh.
3. **`cutConnection(..., { realDelay: true })`** nên đặt lại `room.shelterDelayMs = DROP_SHELTER_DELAY_MS` thay vì giữ nguyên giá trị đang có. Nếu một test gọi bản mặc định (đặt 0) trước rồi mới gọi `realDelay`, test đó sẽ lặng lẽ chạy với độ trễ 0. Hiện chưa test nào làm vậy.
4. **T1:** sau `await back`, nên khẳng định `room.clock.currentTime < landsAt` (kèm lời "không kết luận được", như T4), để chắc lần nối lại xong *trước* khi đòn rơi. Hiện M1 vẫn bắt được, nên đây chỉ là làm rõ ý.
5. **`packages/shared/src/combat.ts`:** `attackLandsWithinMs` đang chen giữa `WILD_WINDUP_MS` và `WILD_BITE_REACH`, và thiếu dòng trống trước JSDoc kế tiếp. Nên dời xuống sau các hằng số của cú cắn. `combat.ts` nay import `skills.ts` và `boss.ts`; không có vòng import (`skills.ts` chỉ import kiểu và JSON, `boss.ts` chỉ import `constants.ts`).
6. **Theo PLAN.md, cho T24b (c):** nếu làm tin "đang vắng" khi trang ẩn, dùng cùng `DROP_SHELTER_DELAY_MS` và cùng kiểu kiểm định danh.
