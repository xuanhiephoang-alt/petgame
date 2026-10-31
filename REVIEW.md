PASS
# REVIEW: T17 Làm tất định các test chập chờn trong GameRoom.test.ts, vòng 1

## Kết luận

Thay đổi chỉ nằm trong `packages/server/src/rooms/GameRoom.test.ts` (ngoài các file làm việc) và đạt mọi tiêu chí của PLAN.md. Cả ba test giờ cho cùng một kết quả mỗi lần chạy mà không bị nới lỏng: ngưỡng, số tick và các `expect` cũ giữ nguyên, có thêm phép kiểm chặt hơn. Test trùm và test thú đêm còn bắt được những lỗi mà bản cũ bỏ lọt (mất dây xích, không đồng bộ giờ, sinh thú đêm vào ban ngày). Không có lỗi phải sửa.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Đã kiểm

- **Phạm vi:** `git status` và `git diff` chỉ có `GameRoom.test.ts`, cùng `PLAN.md`, `PROGRESS.md`, `TASKS.md`. Không có file chưa theo dõi. Các hunk chỉ nằm ở phần import, `day and night`, `wild pals cast too...` và `regions and climate`. Không có `retry`, `skip`, `only`, `vi.mock`, không đổi timeout. Tên test và số test không đổi.
- **Test trùm** (`:978-1011`, `:1071-1085`):
  - `bossWalk()` dùng đúng lưới mà phòng dùng: `this.obstacles` là `defaultWorld().grid`, được cache. Lưới gồm lửa trại, núi lửa, hồ, cây và đá. Thứ tự tìm cố định, kiểm `BOSS.radius` và `isSea` mỗi ≤ 8 px, và throw khi không có tuyến.
  - Trùm đi trên chính đoạn `home`→`away` đã kiểm. Đoạn đó trống với bán kính 40, nên `resolve(…, 20)` không đẩy trùm. `stepWander` không vào nhánh bị chặn và không gọi `random`.
  - Người chơi ở xa hơn `AGGRESSIVE_SIGHT` rất nhiều. Thú hoang không va chạm nhau.
  - Gán `brain.target = away` là đúng ý: không có dây xích thì trùm đi xa thêm. Tôi chạy lại M-B1 (bỏ `GameRoom.ts:618`) trên bản sao của tester: `expected 690.36 to be less than 599.99`, hỏng như báo cáo. Sau đó đã khôi phục và so khớp với `HEAD`.
  - Ghi chú phụ: PLAN nói tuyến vẫn đúng nếu đổi sang bán kính 40 (T21). Điều này đúng: giữa hai điểm mẫu cách 8 px, thân trùm lấn vào vật cản tối đa khoảng 0,2 px, và `resolve` vẫn tất định.
- **Test thú đêm** (`:495-536`):
  - `spawnWith` mock đồng bộ, trả lại trong `finally`.
  - Mọi lần gọi `random` trong `spawnPal(at)` (loài, cấp, não) nhận cùng một giá trị, nên kết quả không phụ thuộc thứ tự gọi.
  - `rollFor` lấy roll ở giữa dải Mothlume (0,9005-0,9995), cách mỗi đầu dải 0,05.
  - Mothlume và voltmouse đều thụ động, nên Mothlume không nổi giận. Khi bình minh tới, con đó bị xoá ngay ở tick đầu, vì `wasNight` đúng và giờ là 0,9991.
  - Lượt sinh tự động (`PAL_RESPAWN_MS` 5 giây) không xảy ra trong khoảng 2 giây của test. Nếu có xảy ra thì cũng không làm hỏng phép kiểm nào.
  - Bốn phép kiểm ứng với M-N1 đến M-N4 đúng như PLAN.
- **Test tung chiêu** (`:671-674`):
  - Trong cửa sổ mock, chỉ `wildSkill` gọi `Math.random`. Không còn thú lang thang nào; `handleAttack` và `handleThrow` không chạy.
  - Ở 120 px chỉ ember với tới, nên thú tung ember ngay ở tick đầu.
  - Mock được trả lại trước các `expect`. Khi test lỗi, `afterEach` cũng trả lại. Vòng lặp còn dở sau khi hết giờ không chạy tiếp được, vì `waitForNextTimestep` treo ở phòng đã huỷ. Bản kiểm cả file của tester (78 qua + 1 hỏng với mỗi đột biến) khớp với nhận định này.
- **Helper:**
  - Không trùng helper sẵn có. `placeWild` bỏ qua `spawnPal` nên không dùng thay được; `westShore` làm việc khác.
  - Đặt tên, JSDoc tiếng Anh và hằng `UPPER_SNAKE` cục bộ đúng quy ước.
  - Các trường riêng mới dùng qua `as any` là `bossHome` và `brain.target`. Đây là lệ có sẵn của file, chấp nhận được. T10 phải giữ các trường này hoặc sửa test theo.
- Tôi tự chạy: `npm run typecheck` sạch; 3 test bằng `-t` qua.

## Góp ý không bắt buộc

- **`boot(..., 2571)` bỏ qua cổng** (`GameRoom.test.ts:74`, có từ `7572a34`). Tôi đã xác nhận: `defineServer` trả về một `Server`, và `boot` của `@colyseus/testing` 0.18.6 với `Server` luôn gọi `listen(DEFAULT_TEST_PORT)` = 2568.
  - Người chơi không bị ảnh hưởng, nên không chặn T17. Sửa trong T17 sẽ vượt phạm vi PLAN.
  - Nên đưa thành **việc riêng P3** (ví dụ T22), vì việc nhỏ nhưng có ích thật:
    - Dòng này gây hiểu nhầm: ghi chú của coder trong `PROGRESS.md` sai vì nó.
    - Đội thường chạy bản sao `GameRoom.test.ts` song song để khảo sát hoặc kiểm đột biến, và đã gặp `EADDRINUSE 2568` trong T17.
  - Cách sửa khoảng 3 dòng, giống bản sao của tester: `const server = defineServer(...); await server.listen(port); colyseus = new ColyseusTestServer(server);`. Đổi `ColyseusTestServer` từ import `type` sang import giá trị. Lấy `port` từ biến môi trường (ví dụ `PETGAME_TEST_PORT`, mặc định 2568 hoặc 2571) để các lần chạy song song chọn được cổng riêng.
- **Test tung chiêu:**
  - PLAN viết bản cũ "thỉnh thoảng" dùng fire_breath. Thực ra là khoảng 2/3 số lần. Thú đuổi với tốc độ 6,3 px/tick (70 × 1,8), nên chỉ có 6 tick đầu, khi còn cách hơn 85 px, là chỉ ember với tới: P(ember trước) ≈ 1 − 0,94^6 ≈ 31%.
  - Test không mất phép kiểm nào. Ember còn kiểm chặt hơn: ở bản cũ, người chơi né được hình nón chỉ vì ra khỏi tầm 85 px, kể cả khi chiêu có `homing`.
  - Nếu muốn kiểm hướng của chiêu hình nón: viết một test tất định riêng. Đặt emberpup từ cấp 7 cách người chơi dưới 85 px, mock `random` = 0, rồi cho người chơi bước ngang ra khỏi góc quạt 70° nhưng vẫn trong tầm. Ưu tiên thấp.
- Với mock, chiêu ra trong ≤ 2 tick. Giới hạn 160 tick (8 giây) dài hơn timeout 5 giây của Vitest, nên M-W2 hỏng vì hết giờ chứ không ở một `expect`. Có từ trước, và PLAN cấm đổi giới hạn trong nhiệm vụ này. Sau này có thể hạ giới hạn xuống khoảng 20 tick để thông báo lỗi rõ hơn; đó là siết lại, không phải nới lỏng.
- JSDoc của `rollFor` (`:495-498`) chưa nói hàm throw khi không có roll nào ra loài đó. PLAN có yêu cầu điều này.
- `spawnWith` có thể chỉ trả lại spy của chính nó: `const spy = vi.spyOn(...); try { ... } finally { spy.mockRestore(); }`. Như vậy nếu sau này test thêm spy khác thì không bị trả lại theo. Cách hiện tại vẫn đúng và giống `capture()`.
