PASS
# REVIEW: T25b Người mất chỗ vẫn đứng phơi 1,5 s, vòng 2

## Kết luận
Lỗi chặn của vòng 1 đã được sửa bằng ba lớp chồng nhau: `finally` trong `removePlayer`, `finally` trong `letGo` (cùng khối `catch` của `onLeave`), và hạn chờ trong `onJoin`. Không đường nào còn để lần vào cùng thiết bị chờ vô hạn. Các thay đổi không làm hỏng đường chạy bình thường. Tôi đã chạy lại: typecheck sạch; `exposure.test.ts` qua 7/7; hai describe `reconnecting after a dropped connection` và `keeping an empty world open` qua 44/44.

## Lỗi phải sửa
Không có.

## Đã kiểm ở vòng 2

### 1. Lỗi chặn đã sửa
- **Phần dọn dẹp trong `finally` của `removePlayer`:** `liveSessions`, `holds`, `lostPlaces` và `exposures.close` chạy trước các thao tác schema (`players.delete`…) và trước `calmPalsTargeting`. Vì vậy dù lỗi ném ở `saveNow`/`despawnCompanion`, hay ngay trong `finally` ở bước schema, khoảng phơi đã đóng và `liveSessions` đã được dọn.
- **Lớp thứ hai:** `letGo` (`finally`) và `onLeave` (sau `catch`) cũng đóng khoảng phơi và xoá `lostPlaces`.
- **Lớp cuối:** hạn chờ `2 * shelterDelayMs + TICK_MS` trên `this.clock` chặn mọi đường còn sót. Hạn này lớn hơn hẳn khoảng phơi dài nhất (1,5 s), nên đường bình thường không bao giờ chạm tới.
- Hẹn giờ hạn chờ còn sót lại sau khi `settled` xong trước chỉ resolve một promise không ai đọc. Vô hại, mỗi lần vào một cái.

### 2. Đường chạy bình thường không đổi
- Vẫn lưu và cất thú trước khi xoá. Điểm quay lại T24 vẫn được ghi trong `letGo` trước `removePlayer`. `holdEmptyWorld` vẫn do nơi gọi lo. `calmPalsTargeting` vẫn chạy.
- Đóng khoảng phơi trước `players.delete` không ảnh hưởng gì: người chờ chỉ tỉnh ở microtask sau khi đoạn mã đồng bộ hiện tại chạy xong.

### 3. Hạn chờ và `disposed`
- **Không có hai bản cùng thiết bị:** sau hạn chờ, `liveSessions` được đọc lại. Từ lần đọc đó tới `liveSessions.set` không có `await` nào, nên hai lần vào không thể xen nhau.
- Nếu phiên cũ còn đó, `endSession` xoá nó đồng bộ. Nếu nó ném lỗi, `finally` vẫn dọn rồi `onJoin` ném, nên join báo lỗi chứ không tạo bản thứ hai. Test của tester (`settled` không bao giờ xong) khẳng định chỉ còn một người chơi mang token đó.
- `disposed` đặt đầu `onDispose`. Lần vào tỉnh dậy trong phòng đã đóng thì ném lỗi, không ghi `liveSessions` trỏ vào phòng chết. Góp ý 2 của vòng 1 vì vậy đã xong. B7 kiểm kết quả `refused` và 0 người chơi.

### 4. Test
- **B9:** `despawnCompanion` ném một lần, có `console.error` làm bằng chứng. Join phải xong trước `t + 2100`, tức trước hạn chờ (≥ `t + 3050`), nên chứng minh được là `finally` đóng khoảng phơi chứ không phải hạn chờ.
- **Test hạn chờ:** bỏ hạn chờ thì treo (bị bắt).
- **B7 và test "rớt thường":** nay chỉ đóng phòng sau khi spy `exposures.settled` đã được gọi, kèm câu báo "inconclusive", nên không còn qua suông. Góp ý 1 của vòng 1 đã xong.
- **Đột biến sống sót:** M9 và việc bỏ riêng từng lớp không bị bắt. Đó là hệ quả đúng ý của các lớp chồng nhau, và B9 bắt khi bỏ đủ cả ba.
- **`closeAll`** không với tới được hôm nay: Colyseus từ chối hold khi đóng phòng, rồi `onLeave` → `removePlayer` đóng khoảng phơi. Giữ làm lưới an toàn là hợp lý.

### 5. Không hồi quy
- Tester chạy `npm test` (760), e2e 70/70, vòng lặp 10/10 và 5/5 dưới tải CPU.
- Ràng buộc: không đổi `packages/client`, `packages/shared`, `tests/e2e`, `.claude/`, `package-lock.json`. `git stash list` còn 2 mục.

## Góp ý không bắt buộc (có thể đưa vào TASKS.md)
1. **`endSession`:** nếu `removePlayer` ném lỗi, `hold.reject` hoặc `client.leave(CLOSE_REPLACED)` không chạy. Phiên cũ vẫn giữ socket mà không còn `Player`, và lần vào mới báo lỗi. Nên đưa hai lệnh đó vào `finally`.
2. **Lỗi giữa chừng trong `removePlayer`:** nếu `despawnCompanion` ném, các thú đi theo còn lại của người đó nằm lại trong state mà chủ đã đi. Có thể cất nốt trong `finally` theo từng con, có `try` riêng. Chỉ xảy ra khi có lỗi thật.
3. **Hạn chờ dùng `this.clock` của phòng đang vào:** nếu chính phòng này đóng giữa lúc chờ, đồng hồ bị xoá và hạn chờ không bao giờ chạy. Nếu đồng thời phiên ở phòng *khác* cũng không bao giờ xong (hai lỗi cùng lúc), `onJoin` treo dù socket đã đóng: chỉ rò bộ nhớ, người chơi không thấy gì. Có thể bỏ qua, hoặc dùng `setTimeout` thật cho hạn chờ.
4. **Sau hạn chờ (khoảng 3 s), lần vào kết thúc phiên cũ cùng thiết bị** dù nó còn đang phơi, ví dụ khi script giữ phiên cũ rớt rồi nối lại liên tục. Lúc đó đòn đang gồng vào phiên cũ bị huỷ. Muốn vậy phải chịu phơi khoảng 3 s, và đây chính là trường hợp "tab thứ hai" của T93. Nên ghi chú vào T93.
5. **Còn lại từ vòng 1 và PLAN.md:**
   - Thứ tự trong `removePlayer`: đã làm qua `finally`.
   - T93: rời chủ động, tab thứ hai, và đường hồi máu sau B5 (vào lại bằng token sau một lần rớt giữ chỗ thì ở giữa bản đồ, máu đầy). Cần game-designer.
   - Phòng đủ 5 người có thể có 6 nhân vật trong tối đa 1,5 s (đã chấp nhận). Nếu muốn chặn: khi phòng đầy, lần vào của người lạ cũng chờ `exposures`.
   - Các góp ý 2, 4, 5 còn lại của review T25 nên gộp thành một việc dọn nhỏ.
