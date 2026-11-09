PASS
# REVIEW: T9 Thú kẹt sau cây, đá (tìm đường A*), vòng 3

## Kết luận
Lỗi vòng 2 đã hết: hai test `lineClear` mới phân biệt được code vòng 2 với cách làm cũ, và mỗi thay đổi có đúng một test canh. Vòng 3 chỉ đổi test; `pathfind.ts` giống hệt bản vòng 2 mà mình đã kiểm kỹ, nên không có hồi quy. Không còn lỗi phải sửa. Nhiệm vụ đạt đủ tiêu chí hoàn thành của PLAN.md. Chỗ lệch kế hoạch duy nhất là `lineClear` bỏ mẫu đầu và kiểm biển theo từng ô; chỗ này đã ghi trong `PROGRESS.md` và tốt hơn kế hoạch.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Góp ý không bắt buộc
Không mục nào chặn việc commit:

- **Test mới thiếu câu kiểm tiền đề** (`pathfind.test.ts:222-227`, test `lets a body leave a spot that is tighter than the body's own cell clearance`). Test không kiểm rằng `(1029, 990)` là chỗ thân 15 được phép đứng, tức `!new CollisionGrid(trees).blocked(p, 15)`. Mình đã kiểm: đúng là được phép. Thêm câu kiểm này (hoặc một dòng chú thích) để test tự nói rõ tiền đề của nó.
- **Trùm (thân 40) có khi đi vòng rất xa khi mục tiêu ở gần.**
  - 10 trên 605 lần trùm đuổi khi bị chắn bị kém đi so với trượt kiểu cũ.
  - Ví dụ: mục tiêu cách 78 px, bản mới đi vòng 933 px.
  - Tính chung trùm vẫn lợi: 72,7% → 92,2%. Nên giao game-designer cùng T21.
- **`pathing.ts`:**
  - `steer` trả sớm (đã trong tầm hoặc đường thẳng thông) mà yêu cầu vẫn nằm trong hàng (dòng 111-119): thêm `this.queue.delete(key)` ở hai nhánh đó.
  - Đích nhảy xa hoặc `steer` im quá `staleMs` mà vẫn đi đường cũ tới 0,5 giây (dòng 98-99 và 129-130): có thể bỏ đường trong hai trường hợp này.
  - `run` không tìm lần nào nếu `maxNodes > tickBudget` (dòng 151): thêm `searches > 0 &&` trước điều kiện ngân sách.
- **Một câu kiểm luôn đúng** (`pathing.test.ts:158`): bỏ đi, hoặc thay bằng "không có hai lần tìm nào cách nhau dưới `retryMs`".
- **Thú bị đẩy vào hốc** mà không ô láng giềng nào đủ rộng thì A* từ chỗ đó trả `none`. Có thể cho bước đầu ra khỏi ô đầu dùng bán kính r − 4.
- **Tài liệu thiết kế** (`docs/design/pals.md:217`): câu "Thấy lại mục tiêu là đi thẳng ngay" không đúng với đường tìm vì bị kẹt, vì đường đó đi tới hết. Việc của game-designer.
- **Test "eating berries" chập chờn** (coder gặp một lần, tester chạy 28 lần không tái hiện được): không liên quan T9. Test này không có thú, không đi qua `paths`, và dựa vào đồng hồ thật với khoảng chừa 500 ms từ T32. Nên theo dõi; nếu còn hỏng thì làm chắc lại.

## Đã kiểm (vòng 3)
- **`pathfind.ts` không đổi:** so từng dòng với bản vòng 2 mình giữ trong scratchpad, giống hệt. Tester sửa tạm file này để thử đột biến rồi đã trả lại.
- **Hai test mới phân biệt đúng:** mình chạy chúng trên 4 bản:

  | Bản | Test góc ô biển | Test chỗ đứng hẹp |
  |---|---|---|
  | Code thật | qua | qua |
  | `lineClear` vòng 1 | hỏng | hỏng |
  | Đột biến: đặt lại mẫu đầu `s = 0` | qua | hỏng |
  | Đột biến: kiểm biển lấy mẫu 8 px | hỏng | qua |

  Khớp với kết quả đột biến tester ghi trong `PROGRESS.md`.
- **Toàn bộ:** `npm run typecheck` sạch, `npm test` 333/333 (27 file).
- **Từ vòng 2, vẫn đúng vì code không đổi:**
  - lỗi tràn đã hết, hai test tràn bắt được cả hai kiểu đột biến mà không treo;
  - `seaFree` chính xác trên 120.000 đoạn ngẫu nhiên;
  - bỏ mẫu đầu không làm thú đi xuyên hay kẹt thêm, kể cả khi bắt đầu lấn vào vật cản;
  - tới đích không tụt (Emberpup 99,7%, Boulderhorn 99,1%, cỡ trùm 92,2%);
  - build và e2e qua ở vòng 2.

## Việc mới cho TASKS.md
- **T21** (ghép):
  - cho trùm về nhà (vượt `BOSS_LEASH`) bằng `PathPlanner`, như thú đầu đàn về hang (đề xuất cuối PLAN);
  - cùng lúc xử lý việc trùm đi vòng quá xa khi mục tiêu ở gần (góp ý thứ hai ở trên).
- **T27** (ghép): thú hiền chạy về phía thoáng theo `NavGrid.clearanceAt` thay vì lao thẳng vào cây (đề xuất cuối PLAN).
- **T10** (ghép): khi tách `GameRoom.ts`, để `paths` cùng module di chuyển của thú hoang và thú đi theo (đề xuất cuối PLAN).
- **Việc mới, ưu tiên thấp, "Tinh chỉnh tìm đường":**
  - bỏ yêu cầu khỏi hàng khi `steer` trả sớm;
  - bỏ đường cũ khi đích nhảy xa hoặc sau khoảng im lặng;
  - chặn trường hợp `maxNodes > tickBudget`;
  - cho A* thoát hốc hẹp;
  - sửa câu kiểm luôn đúng ở `pathing.test.ts:158`;
  - thêm câu kiểm "chỗ đứng hợp lệ" vào test chỗ đứng hẹp.
- **Việc cho game-designer, nhỏ:** sửa câu ở `docs/design/pals.md:217` về đường tìm vì bị kẹt.
- **Việc mới, ưu tiên thấp:** theo dõi test "eating berries" (T32); nếu còn chập chờn thì nới khoảng chừa 500 ms hoặc bớt phụ thuộc đồng hồ thật.
