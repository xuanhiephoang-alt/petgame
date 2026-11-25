# PROGRESS: T25b Né đòn qua đường mất chỗ của T24

## Vòng 1: coder

### Bước 1: tái hiện cách né trên code cũ (HEAD `4823b16`, cùng mã sản phẩm với `2db768c`)
B1 và B2 được viết và chạy trước khi sửa mã sản phẩm (chỉ `GameRoom.test.ts` đổi). Để chạy trên mã cũ (chưa có `lostPlaces`), tạm cho `lostAt` chấp nhận "người chơi đã bị xoá" thay cho "có trong `lostPlaces`"; bản đó đã bỏ, `lostAt` cuối cùng chỉ chờ `lostPlaces`.
- B1 (`a place lost while coming back does not call off the boss's stomp…`) hỏng ở `expect(room.state.players.has(sid)).toBe(true)`: người chơi bị xoá ngay khi mất chỗ, nên cú dậm đang gồng bị huỷ.
- B2 (`a rejoin of the same device inside the window waits for it…`) hỏng ở `expect(joinedAt).toBeGreaterThanOrEqual(t + 1500 - 50)`: lần vào lại xong ngay (mốc 1 795 600 949 257 so với 1 795 600 950 707 cần có), tức không chờ gì và phiên mới nhận máu đầy.
Đúng như cách né dự đoán. Sau khi sửa cả hai qua.

### Mã
- [x] `systems/exposure.ts` + `exposure.test.ts` (7 test): `Exposures` (`open`, `close`, `isOpen`, `settled` lặp lại khi mở lại, `closeAll`).
- [x] `GameRoom.ts`: `lostPlaces`, `exposures`; `stopIntents`; nhánh mất chỗ của `onDrop` (dừng ý định, ghi `lostPlaces`, mở `exposures`, hẹn `letGo`; bỏ `noteResume` ở đây); nhánh thường mở `exposures`; `letGo` (ghi điểm quay lại theo trạng thái lúc đó, `removePlayer` trong `try/catch`, `holdEmptyWorld` nếu trống); `shelter` và `onReconnect` đóng `exposures`; `onLeave` bỏ qua người trong `lostPlaces`; `removePlayer` xoá `lostPlaces` và đóng `exposures`; `onJoin` thành `async` (chờ `exposures.settled` của phiên cũ cùng token rồi đọc lại `liveSessions`); `canResume` tính cả `lostPlaces`; `onDispose` lưu người còn trong `lostPlaces` rồi `closeAll`.
- [x] `GameRoom.test.ts`: `cutConnection` đặt `shelterDelayMs` theo `realDelay` cả hai chiều (góp ý 3 của review T25); helper `loseQuickly`, `lostAt`; B1-B8.
- [x] Tài liệu: `docs/design/multiplayer.md` (T25b ở dòng đầu, gạch mất chỗ, "Đã cân nhắc", phòng đủ 5 người), `docs/architecture.md` (server kết nối lại, kiểm thử).

### Lệch kế hoạch
- `loseQuickly` chờ server thấy `holds` có sid (`vi.waitFor`) rồi mới thay `events.onmessage` và mở cổng, thay vì thay trước khi cắt: nếu thay trước, một tin cũ trên socket sắp chết có thể ăn mất lần đóng một lần. Vẫn "không chờ offline" như kế hoạch.
- B1, B4 so máu bằng `toBeCloseTo(.., 0)` / khoảng, vì người chơi chưa được bảo vệ vẫn hồi máu rất ít ở nhịp kế tiếp (như A1 của T24); vị trí so bằng khoảng cách < 80 px ở B1 (cú cắn của trùm sau cú dậm có thể đẩy thêm).
- B3 đặt người chơi cách đống lửa 500 px trước khi gồng cắn, để thú không đuổi kịp tới đống lửa trong khoảng 1,5 giây.
- B4 giả `Input` lúc nối lại bằng cách bọc `room.onReconnect` trên instance (đúng ý kế hoạch); `onReconnect` có chạy trong đường mất chỗ vì lần giữ chỗ đầu đã thành công.
- B7 dùng `room.disconnect()` và chỉ đòi lần vào đang chờ kết thúc trong 3 giây (vào được hoặc bị từ chối), đúng kế hoạch.

### Lệnh đã chạy
- typecheck ✓, `npm test` ✓ (756 test, 50 file), `npm run build` ✓.
- Vòng lặp describe `reconnecting after a dropped connection`: 5 lần, 5/5 qua (32 test, 45,1 đến 45,5 s mỗi lần). Không chạy dưới tải CPU, không chạy `exposure.test.ts` 3 lần riêng, không chạy `npm test` hai lần (chỉ một lần).
- `npm run test:e2e` ✓ (70 passed, gồm các test `connection:` cũ không sửa và `reconnect.spec.ts` có chờ thêm tối đa 1,5 giây ở test 1; flake `boss bar (phone upright, notch)` không xảy ra).
- Kiểm nhanh đột biến (đã hoàn tác, đối chiếu bằng bản sao lưu): bỏ dòng `lostPlaces.has` trong `onLeave` làm B1, B2, B3, B6 hỏng (M1); bỏ `await ... settled(...)` trong `onJoin` làm B2 và B5 hỏng (M3). Bảng M1-M12 đầy đủ là việc của tester.
- Không đổi client, schema, message, `Profile`, close code, route; không dependency mới; `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json` không bị đụng; không commit.

## Kiểm thử vòng 1 (T25b): PASS
- typecheck ✓   test ✓ (50 file, 756 test, chạy 2 lần; `exposure.test.ts` 3 lần, 7/7)   build ✓   e2e ✓ (70/70; boss bar không flake)   photo3d (không chạy)
- Chạy lặp describe `reconnecting after a dropped connection` (~34 test): 10/10 qua (481 s, ~48 s mỗi lần); dưới 4 vòng lặp CPU 6/6 qua (299 s, ~50 s mỗi lần). Không flake. Đã tắt các vòng lặp CPU.
- B1 và B2 trên mã cũ (`GameRoom.ts` của HEAD, test mới giữ nguyên): tái hiện được cách né. B1 hỏng ở `expect(...).toBe(true)` (người chơi bị xoá ngay khi mất chỗ); B2 hỏng ở `expected 1795625271740 to be greater than or equal to 1795625273190` (join xong ngay, không chờ). Tôi phải sửa `lostAt` tạm thời để chấp nhận "đã bị xoá" (giống coder): chỉ đổi điều kiện chờ nhận ra lần mất chỗ, không đổi `expect` nào, nên hợp lệ. Đã hoàn tác, diff khớp.
- Đột biến M1-M12 (hoàn tác bằng bản sao, diff khớp):
  - M1: 9 test hỏng (A1, `resumeMs`, B1, B2, B3, B4, B6, B7, B8).   M2: B1, B2, B3.   M3: B2, B5.   M5: B1, B6.   M6: B7.   M8: B4.   M9: B2 và test mới "two joins..." (treo 5 s).   M10: B5.   M11: B8.   M12: unit "waits on a new opening made right after close...".
  - **M4 lọt qua** (đọc lại `liveSessions` sau khi chờ): thêm test `two joins of the same device that both wait for the window end with one player...` (hai lần vào cùng token trong khoảng phơi); với đột biến trong đó ra hai `Player` cùng token ("expected [..2 id..] to have a length of 1"), với mã thật qua.
  - **M7 lọt qua** (bỏ `exposures.closeAll()` trong `onDispose`): B7 qua dù thiếu, vì Colyseus từ chối các hold khi đóng phòng nên `onLeave`/`removePlayer` đã đóng khoảng phơi. Thêm test `a world closing while an ordinary drop still stands...`: vẫn qua với M7. Kết luận: `closeAll` là phòng thủ thừa trong mọi đường kiểm được hôm nay (không hại), chứ không phải lỗ hổng.
- An toàn (đọc mã): không có hai bản cùng token (phần từ đọc `liveSessions` đến `liveSessions.set` trong `onJoin` không có `await`; có test mới); lần vào chờ không treo khi phòng đóng (`onDispose` lưu người đang rời, `closeAll`, và `removePlayer` đóng khoảng phơi); `/resume` đúng trong khoảng phơi (B6); ngất trong khoảng phơi đưa về trại/đống lửa đầy máu (B3); thú đi theo bị cất theo chủ ở `removePlayer` trước khi phiên mới gọi ra; thế giới trống được giữ sau `letGo` (B8); đếm thế giới T64-T67 theo phòng (`worldCensus`), không theo lần vào, nên `onJoin` async chỉ giữ chỗ thêm tối đa 1,5 s (rủi ro đã chấp nhận: phòng đủ 5 người có thể có 6 nhân vật trong khe đó).
- **Góp ý không chặn:** `letGo` bọc `removePlayer` bằng `try/catch` nhưng nếu `removePlayer` ném giữa chừng (trước `exposures.close`) thì khoảng phơi mở mãi và một lần vào cùng thiết bị sẽ chờ vô hạn (`saveNow` đã tự bắt lỗi nên khó xảy ra). Có thể đưa `this.exposures.close(sessionId)` vào `finally` của `letGo`.
- Ràng buộc: không đổi client, schema, message, `Profile`; `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json` không đụng; `git stash list` còn 2 mục. Chỉ sửa `GameRoom.test.ts` (thêm 2 test). Không commit.

## Vòng 2: coder
Sửa lỗi chặn của reviewer: một lần vào của cùng thiết bị có thể chờ mãi nếu `removePlayer` ném lỗi trước khi đóng `exposures`.
- [x] `removePlayer`: phần lưu và gỡ thú nằm trong `try`; phần sổ sách mà người khác chờ hoặc đọc (`liveSessions`, `holds`, `lostPlaces`, `exposures.close`, rồi `players`, `controls`, các Map khác, `calmPalsTargeting`) chạy trong `finally`, nên lỗi ở `despawnCompanion` vẫn kết thúc phiên (lỗi vẫn được ném lên cho nơi gọi ghi log).
- [x] `letGo` và `onLeave`: `finally` / cạnh `holds.delete` cũng xoá `lostPlaces` và đóng `exposures`.
- [x] `onJoin`: chờ `settled` bị chặn bằng `2 * shelterDelayMs + TICK_MS` qua `this.clock.setTimeout` (`Promise.race`); sau lần chờ, nếu phòng đã đóng (`disposed`, đặt ở `onDispose`) thì ném lỗi "the world closed while joining", không ghi `liveSessions` trỏ vào phòng đã đóng. Sau hạn vẫn đọc lại `liveSessions` như cũ.
- [x] Test hồi quy mới `a removal that throws still ends the session…` (B9): `despawnCompanion` ném một lần (`mockImplementationOnce`), `loseQuickly`, `connectTo` cùng token; kết thúc trước `t + 1500 + 600` (tức do `letGo` đóng, không phải do hạn chờ), `exposures` đã đóng, phiên cũ biến mất, phiên mới có mặt.
- [x] Test B7: chờ đến khi lần vào thực sự đang chờ (spy `exposures.settled` đã được gọi) rồi mới đóng phòng.
- Chứng minh test bắt lỗi: tạm bỏ `try/finally` của `removePlayer`, `finally` của `letGo` và hạn chờ ở `onJoin` thì B9 hỏng với "the join hung" (4,2 s); đã hoàn tác (`cmp` với bản sao lưu giống hệt).
- M7 (bỏ `closeAll` ở `onDispose`) vẫn **qua** B7: `onDispose` gọi `removePlayer` cho mọi người trong `lostPlaces`, và `removePlayer` đã đóng `exposures` của họ, nên `closeAll` chỉ còn là lưới an toàn cho phiên đang giữ chỗ (`holds`) chưa tới `shelter`. Không có test nào ép tới nhánh đó; chấp nhận, ghi ở đây. Chưa kiểm test "rớt thường" của tester (không có trong cây làm việc này; B5 là test rớt thường của vòng 1 và nó chờ `settled` thật nên không rỗng).
- Lệnh đã chạy: typecheck ✓, `npm test` ✓ (759 test), build ✓; vòng lặp describe `reconnecting after a dropped connection` 5/5 qua (35 test, khoảng 49 s mỗi lần); `npm run test:e2e` ✓ (70 passed). Không commit, không đụng `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json`; đã cập nhật bản sao lưu ở `scratchpad/t25b-backup/`.

## Kiểm thử vòng 2 (T25b): PASS
- typecheck ✓   test ✓ (50 file, 760 test)   build ✓   e2e ✓ (70/70; boss bar không flake)   photo3d (không chạy)
- Chạy lặp describe `reconnecting after a dropped connection` (~37 test): 10/10 qua (543 s, ~54 s mỗi lần); dưới 4 vòng lặp CPU 5/5 qua (280 s, ~56 s mỗi lần). Không flake. Đã tắt các vòng lặp CPU.
- Ba bản sửa vòng 2, bỏ từng cái (hoàn tác bằng bản sao, diff khớp): `finally` của `removePlayer` một mình, `finally` của `letGo` một mình, hạn chờ ở `onJoin` một mình: **cả ba qua** vì chúng chồng nhau (mỗi cái đủ để phiên kết thúc: B9 chỉ hỏng khi bỏ đủ). F1+F2 (còn hạn chờ): B9 hỏng (join xong muộn, ở khoảng 3,3 s thay vì ≤ `t + 2100`). F1+F3 và F2+F3: qua. Cả ba: B9 hỏng. Đánh giá: phòng thủ nhiều lớp, chấp nhận; `finally` của `removePlayer` đã đủ, hạn chờ là lưới cuối.
- Hạn chờ riêng lẻ chưa có test nào ép (bỏ F3 vẫn xanh), nên thêm test `a join waiting on a session that never settles is let in at the cap, not left waiting for ever` (giả `exposures.settled` không bao giờ xong): bỏ hạn chờ thì hỏng (timeout 5 s), mã thật qua.
- Kiểm `disposed`: bỏ dòng ném lỗi vẫn qua mọi test cũ. Siết test `a world closing while a lost place still stands saves the player`: kết quả phải là "refused" và `room.state.players.size` phải bằng 0 sau khi đóng. Bỏ kiểm `disposed` thì hỏng ("no player may be added to a world that has closed: expected 1 to be +0"); mã thật qua.
- Đột biến vòng 1: M4 vẫn bị bắt (test `two joins of the same device...`, và `a rejoin...`); M9 (chỉ bỏ `exposures.close` ở `removePlayer`) giờ **qua**, vì `letGo` và `onLeave` cũng đóng (lớp chồng của vòng 2, đúng ý).
- Test `a world closing while an ordinary drop still stands...` (của tester, vòng 1): vòng 1 nó chưa chắc join đã chờ. Đã siết như B7: spy `exposures.settled`, chờ đã được gọi, kiểm khoảng phơi vẫn mở ("inconclusive" nếu không), rồi mới đóng phòng. Thử M7 (bỏ `closeAll`) với test này: **vẫn qua**. Kết luận: `closeAll` không với tới được hôm nay (Colyseus từ chối các hold khi đóng phòng nên `onLeave` -> `removePlayer` đã đóng khoảng phơi; `onDispose` cũng gọi `removePlayer` cho `lostPlaces`). Là lưới an toàn thừa, chấp nhận.
- Ràng buộc: không đổi client, schema, message, `Profile`; `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json` không đụng; `git stash list` còn 2 mục. Chỉ sửa file test (`GameRoom.test.ts`: siết 2 test, thêm 1). Không commit.
