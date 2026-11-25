PASS
# REVIEW: T22 Dọn `GameRoom.test.ts` sau T17 (`steadyClock`, `spawnWith`, `rollFor`, chiêu thú hoang, bỏ cast), vòng 1

## Kết luận
Thay đổi chỉ chạm file test, một câu trong `docs/architecture.md` và `PROGRESS.md`. Làm đủ các bước và tiêu chí của PLAN.md, không test nào bị nới hay bỏ. `steadyClock` đúng với mã của `@colyseus/clock`/`@colyseus/core` hiện có, chỉ ảnh hưởng đúng phòng của test, và bịt tận gốc nguyên nhân chập chờn của nhóm "eating berries". Tôi đã chạy lại: typecheck server sạch; 9 test liên quan (`eating`, `wild pals cast too`, `syncs the time of day`) đều qua.

## Lỗi phải sửa
Không có.

## Đã kiểm
- **`steadyClock(room)`, có đúng không:**
  - `Clock` (`@colyseus/clock`) gán `this.now` trong constructor, cho từng đối tượng.
  - Chỉ hai chỗ gọi `now()`: `start()` (lúc phòng khởi tạo, trước khi test gọi helper) và `tick()`.
  - GameRoom dùng `setSimulationInterval` → `setTimestep`, mỗi interval gọi `clock.tick()` đúng một lần. Nhánh `broadcastPatch` chỉ tự `tick()` khi không có simulation interval.
  - Vì vậy sau helper, mỗi tick `currentTime` tăng đúng `TICK_MS`. `deltaTime` (truyền vào `GameRoom.tick(dtMs)`) cũng đều 50, và các hẹn giờ `clock.setTimeout` đếm theo tick: còn tất định hơn, không hại gì cho hai test này.
- **`steadyClock`, phạm vi và rò rỉ:**
  - Hàm chỉ thay trường của `room.clock` của phòng vừa `setup()`, nên không đụng prototype, `Date.now` hay phòng khác.
  - Phòng bị huỷ ở `afterEach` (`colyseus.cleanup()`), và phòng mới có `Clock` mới. Không cần gỡ.
- **Câu kiểm đồng hồ** (`(now - clockStart) % TICK_MS === 0`):
  - Tester thử đột biến `TICK_MS + 7` thì câu kiểm hỏng, nên câu kiểm có tác dụng.
  - Nếu sau này Colyseus không gọi `this.now` nữa, đồng hồ quay về `Date.now`. Khi đó hiệu thời gian sau 2 tick chỉ chia hết cho 50 với xác suất khoảng 2%, nên câu kiểm gần như luôn báo. Xem góp ý để làm nó chắc chắn 100%.
- **Có bịt được lỗi chập chờn gốc không:**
  - Nhận xét của tester đúng. Đoạn khựng ngay sau `client.send` chặn cả vòng sự kiện, nên tick quá hạn (pha timers) chạy trước tin nhắn (pha poll). Đồng hồ nhảy *trước* khi ăn, nên `readyAt` dời theo, và vị trí khựng của kế hoạch không tái hiện được lỗi.
  - Hai vị trí tester dùng thì có tái hiện. (A') là khựng sau khi tin đã xử lý. (B') là khựng giữa `until(readyAt-500)` và `send`. Không có `steadyClock` thì hỏng đúng chỗ (`3249 > 3500`, `1 to be 2`); có thì qua.
  - Với `steadyClock`, thời gian của phòng chỉ còn là số tick nhân 50, nên khựng ở đâu cũng không dời mốc. Chạy lặp 20/20, và 10/10 khi có 4 vòng lặp CPU chạy song song.
- **`spawnWith`:** dùng `const spy = ...` và `spy.mockRestore()` trong `finally`. Có `expect(vi.isMockFunction(Math.random)).toBe(false)` sau lần gọi đầu. Tester thử cả hai đột biến (bỏ `mockRestore`; spy `console.warn` ở ngoài bị gỡ nhầm khi quay về `restoreAllMocks`): đều bắt được.
- **`rollFor`:** JSDoc nói rõ hàm ném lỗi, và khớp chuỗi lỗi thật (`no roll picks ${speciesId} in the …`). Dòng `toThrow(/no roll picks mothlume/)` đúng với dữ liệu: mothlume chỉ ra ban đêm.
- **Chiêu thú hoang:**
  - `CAST_WITHIN_TICKS = 20`, chú thích ghi số đo (2 tick).
  - `expect(casts.length, "…").toBeGreaterThan(0)` đứng trước `casts[0]`.
  - Đột biến "không bao giờ tung chiêu" giờ hỏng ở `expect` có lời sau khoảng 1 s, thay vì "Test timed out" như trên HEAD.
- **Bỏ `as AddressInfo`:**
  - Sau `if (!address || typeof address !== "object") throw`, kiểu `string | AddressInfo | null` thu hẹp còn `AddressInfo`. Typecheck sạch.
  - Không còn import thừa ở `GameRoom.test.ts` và `worldLimits.test.ts`.
  - `http.test.ts` giữ import, vì còn dùng ở `(s.address() as AddressInfo)`, một `net.Server` chưa thu hẹp.
- **Không nới test:**
  - Ngưỡng 500 ms, `EAT_COOLDOWN_MS` và mọi assertion của nhóm ăn giữ nguyên. Chỉ thêm `expect`, không bớt.
  - Hạn `15_000` của worldgen và `20_000` của test ăn không đổi.
  - Không có `skip`/`only`. Không file sản phẩm nào đổi: `git diff --name-only` chỉ có `*.test.ts`, `docs/architecture.md`, `PROGRESS.md`.
- **Tài liệu và chú thích:**
  - Câu về `steadyClock` trong `docs/architecture.md` đúng.
  - Chú thích `worldgen.test.ts` đúng: test sinh 3 thế giới (7, 7, 8); 1,4 s là số đo của reviewer T53; 6,5 s × 3/4 ≈ 4,9 s.
- **Ràng buộc:**
  - Không đụng `tests/e2e/multiplayer.spec.ts`, `labelLayout*`, `.claude/`, `package-lock.json`.
  - `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
- **Câu kiểm đồng hồ chắc chắn 100%:**
  - Trong test 1, `clockStart` được đọc đồng bộ ngay sau `steadyClock`, rồi đến đúng `ticks(room, 2)`. Vì vậy có thể khẳng định bằng nhau: `expect(now(room) - clockStart).toBe(2 * TICK_MS)`, thay cho phép chia lấy dư.
  - Phép chia lấy dư vẫn lọt khoảng 2% khi helper hết tác dụng mà hiệu thời gian thật tình cờ chia hết cho 50.
  - Có thể thêm một câu kiểm như vậy vào test 2, vì test 2 cũng dựa vào helper.
- **Vị trí khựng trong ghi chép** (tester đề nghị): PLAN.md bị ghi đè ở nhiệm vụ sau, nên nơi đáng ghi là JSDoc của `steadyClock` hoặc `docs/architecture.md`.
  - Ghi vị trí khựng làm lộ lỗi: sau khi tin ăn đã được xử lý (`send; ticks 1; khựng; ticks 1`), hoặc giữa `until(...)` và `send`.
  - Ghi thêm vì sao khựng ngay sau `send` không làm lộ: tick quá hạn chạy trước tin nhắn trong vòng sự kiện.
  - Để người sau kiểm lại helper không bị đánh lừa như bước 8 của kế hoạch.
- **Chú thích `spawnWith`:** "only this spy: other mocks of the test stay" đúng với spy trên đối tượng khác. Nếu chính test đã spy `Math.random` từ trước, `vi.spyOn` dùng lại spy đó, và `mockRestore()` gỡ luôn nó. Hiện không test nào như vậy; có thể nói rõ trong chú thích.
- **Khẳng định "bị từ chối, im lặng"** của test 1 (`berries` vẫn 2, `notices` rỗng, `nextEatAt` không đổi):
  - Nếu tin ăn tới server chậm hơn 2 tick, ba câu này vẫn qua mà chưa chứng minh gì, vì không có tin trả lời để chờ.
  - Đột biến "cho qua sớm" của tester cho thấy hiện tin vẫn tới kịp. Đây là điểm yếu có từ trước T22, ưu tiên thấp.
  - Muốn chắc hơn: trước khi kiểm, chờ dấu hiệu server đã xử lý một tin khác gửi sau nó. Ví dụ một tin vô hại có phản hồi.
