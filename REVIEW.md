PASS
# REVIEW: T27 Thú hiền bỏ chạy chậm hơn người chơi, vòng 1

## Kết luận
Thay đổi đúng và đủ theo PLAN.md: trần `WILD_FLEE_SPEED_CAP = PLAYER_SPEED * 0.6` và hàm thuần `fleeSpeed` nằm trong `packages/shared/src/combat.ts`, server chỉ đổi đúng một dòng gọi `stepFlee` (cộng import và một dòng chú thích). Mọi đường dẫn tới bỏ chạy đều đi qua nhánh đã kẹp, các tốc độ đuổi giữ nguyên, test bắt được đột biến bỏ trần. Không có lỗi phải sửa.

## Đã kiểm
- **Mọi đường bỏ chạy đi qua trần.** `fleeing` chỉ được ghi ở một chỗ (`provoke`, `GameRoom.ts:1717`, chỉ khi `passive && !alpha`) và chỉ được đọc ở một chỗ (nhánh `stepFlee`, `GameRoom.ts:693-704`). `provoke` được gọi từ: đòn người chơi (`:893`), đòn thú đi theo (`:861`), chiêu thú đi theo (`:1526`), bóng vỡ (`breakOut`, `:1223`). Không có đường bỏ chạy nào khác: grep `flee|run away|scatter|scare` trong code không phải test chỉ ra các chỗ này. Đẩy lùi (`push`/`knockback`, `:1290`) là dịch chuyển một lần mỗi đòn, không phải bỏ chạy, và PLAN để ngoài phạm vi.
- **Tốc độ đuổi không đổi.** Bốn chỗ `species.speed * WILD_CHASE_SPEED_FACTOR` (`:265`, `:685`, `:722`, `:1622`) giữ nguyên. Lang thang (`:755`) dùng `species.speed`. `FLEE_MS`, `stepFlee` và hệ số 1,8 không đổi. Client không dùng các hằng số này, nên không cần đổi client, schema, message hay `Profile`.
- **Vị trí hằng số.** Hệ số 0,6 chỉ xuất hiện ở định nghĩa `WILD_FLEE_SPEED_CAP` (bảng hằng số cạnh `WILD_CHASE_SPEED_FACTOR`). Không có vòng import (`constants.ts` không import gì). JSDoc tiếng Anh, nói lý do. `index.ts` đã `export *`, và tên mới không trùng tên nào khác.
- **Hiệu năng.** Mỗi tick chỉ thêm một `Math.min`, không cấp phát gì mới.
- **Tài liệu.** `docs/design/pals.md` dòng 213-223 khớp code: tên `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, 96 px/s, bảng tốc độ và quãng chạy. Dòng 64 (T58) và dòng 252 (T57) cũng khớp.
- **Test** (tôi chạy lại: `combat.test.ts` + `wildCombat.test.ts` 19/19, `GameRoom.test.ts -t "Voltmouse|passive pals run away"` 2/2):
  - Shared 1-3 khoá đúng giá trị và tính chất. Test 3 lặp qua mọi loài hiền, nên vẫn đúng khi thêm loài mới.
  - Tích hợp 5 tất định: vòng `tick` đồng bộ, không `await`, nên `clock.currentTime` đứng yên và `fleeing.until` còn hiệu lực. Đã bỏ cây, đá; `placeWild` không tạo thú đầu đàn. Test đo đúng 96 px trong 1 s, còn đột biến cho 171 px.
  - **Biên 104,95 so với 104,81 trong `wildCombat.test.ts` không phải biên của code đúng.** Đó là chỗ *đột biến* (171 px/s) vượt câu kiểm trong vòng lặp ở bước 9, vì mỗi bước khoảng cách tăng 0,55 px: 100 + 9 × 0,55 = 104,95. Với code đúng, khoảng cách sau mỗi bước là 100 − 3,2·i, lớn nhất 96,8, tức cách ngưỡng 104,81 tới 8 px. Câu kiểm cuối ra 36 so với ngưỡng 40 (đột biến: 111). Đây là số học thuần, không có ngẫu nhiên hay thời gian thật, nên không chập chờn. Nếu câu kiểm trong vòng lặp có quá sát thì câu kiểm cuối vẫn bắt được đột biến. Test có nghĩa nhưng câu kiểm trong vòng lặp yếu hơn cần thiết (xem góp ý).

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc (có thể làm cùng T57 hoặc khi chỉnh trần)
- `packages/server/src/ai/wildCombat.test.ts:36-39`: câu kiểm trong vòng lặp chạy *sau* khi người chơi đã bước, nên ngưỡng "100 + một bước của thú" lỏng và còn dùng số cứng `96`. Tính chất thật cần giữ là "người chơi rút ngắn khoảng cách ở mọi bước". Nên kiểm khoảng cách giảm dần (`expect(gap).toBeLessThan(prevGap)`), đúng với mọi trần nhỏ hơn `PLAYER_SPEED`. Câu kiểm cuối `< 40` thì đang khoá đúng giá trị 0,6: trần từ 100 px/s trở lên là hỏng. Vì vậy nếu sau này vặn "nút chỉnh" 0,65 (104 px/s) mà tài liệu nhắc tới, test này sẽ hỏng (ra 44) cùng với `toBeCloseTo(96)` ở shared. Như vậy là chấp nhận được, vì đổi số cân bằng thì phải sửa test có chủ ý. Nhưng nên viết ngưỡng theo `fleeSpeed(...)` để test hỏng vì đúng lý do.
- `TASKS.md` dòng 38: mô tả T27 vẫn ghi "ví dụ tối đa 0,9 × `PLAYER_SPEED`". Khi đánh dấu xong, agent chính nên ghi số đã chọn (0,6, 96 px/s) để khỏi lệch với PLAN và tài liệu.
- `GameRoom.test.ts:23`: `PLAYER_SPEED` chen giữa `companionMaxHp` và `distance`. Khối import vốn đã không theo thứ tự, nên không cần sửa.

## Việc tiếp theo (đã có trong TASKS.md, không thêm mới)
- T57: thú hiền chạy trốn về phía thoáng; phải giữ trần `fleeSpeed`.
- T58: Voltmouse đầu đàn đuổi 171 px/s; quyết định có kẹp trong bảng `ALPHA` hay không.
