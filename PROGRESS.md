# PROGRESS: T26 Dọn nhỏ sau T3

## Vòng 1: coder

### E1 hỏng trên HEAD
E1 (`connection: closing the page while the pictures still load frees the place at once`) được viết và chạy trước khi đổi mã sản phẩm (HEAD `aa03e33`, mã sản phẩm như `15500f7`): hỏng ở `expect.poll(() => friend.state.players.has(closer), { timeout: 3000 }).toBe(false)` (Expected false, Received true): người của trang đóng sớm vẫn ở lại (bị giữ chỗ) vì chưa có listener `pagehide` khi hình còn tải. Sau khi sửa, E1 qua (1,0 s).

### Mã
- [x] 1. `combat.ts`: `calmPalsTargeting` gọi `cancelWindup` cho thú đang gồng cắn hoặc dậm (`aggro.windupUntil !== undefined`) vào đúng mục tiêu, rồi xoá aggro; không đụng thú đang gồng chiêu. JSDoc.
- [x] 2. `GameRoom.onReconnect`: không còn nhân vật thì `client.leave(CLOSE_REPLACED)`.
- [x] 3. Tài liệu `multiplayer.md`: bảng "Rời chủ động và rớt mạng" (ví dụ, "Server biết bằng", "Nhân vật" tính 1,5 giây từ lúc server biết, dòng về nút Về sảnh, dòng tin rời từ T26), "Trong 20 giây chờ", "Quay lại", dòng đầu; `hud.md`; `architecture.md`.
- [x] 4. `main.ts`: `type Joined`, `watchJoined(room)` (đăng ký `pagehide` ngay khi vào phòng, `beforeLeave` trước `watch.leave()`), `attempt` dùng nó; `startGame(joined, art)` đặt `joined.beforeLeave = () => seen.note()` và bỏ listener `pagehide` cũ; `failToStart` giữ `(room, watch)`.
- [x] 5. `Game.ts`: `halting`, đặt khi `lost` (mọi lý do) và ở cuối `init` nếu đã `lost`; cuối `frame()` sau `frames++` thì `ticker.stop()`.
- [x] 6. `inviteLink` = `lobbyUrl(roomId, true)` (JSDoc).
- [x] 7. `Hud.setInert`; `Game.watchConnection` gọi mỗi lần đổi trạng thái, cuối `init` gọi theo trạng thái hiện tại. Mọi bảng đều gắn vào `hud.root` (đã kiểm `hudBridge.build`), không cần chuyển gì.
- [x] Test: S1, S2, S3 (`GameRoom.test.ts`), 2 test `inviteLink` trong `net/connection.test.ts`, E1 và các phép kiểm thêm trong `tests/e2e/reconnect.spec.ts` (`inert`, Tab, `frames` tăng khi thử lại, HUD dùng được khi online lại, ticker dừng, `frames` đứng yên, Enter ở Về sảnh).

### Lệch kế hoạch
- `net/connection.test.ts` đã có sẵn (test `lobbyUrl`, `joinFailure`), nên không "tạo mới": thêm describe `inviteLink` vào file đó. Lúc đầu tôi ghi đè nhầm file, đã khôi phục từ HEAD (`git show`) rồi thêm test.
- S1 đặt các test vào describe `reconnecting…` (cần helper `foeBeside`), giữ lại trùm khi dọn thú (`clearPals`), và phần cắn/dậm kiểm ngay sau khi gọi calm (dậm không kiểm sau 25 nhịp, vì trùm tự nhắm lại người chơi gần đó). Thú thứ ba gồng cắn B kiểm M3.
- S2: không kiểm `offline` ở `dropAt + 1440` (mốc `dropAt` đo qua `vi.waitFor` có thể trễ một nhịp, nên bảo vệ đã bật); kiểm máu giảm ở `dropAt + 1200` rồi ép gồng của thú 2.
- Đột biến M1 (bỏ `cancelWindup`): S1 hỏng nhưng **S2 vẫn qua**, vì AI thú tự đặt lại `pal.windup = ""` ở nhịp kế tiếp khi thú không còn mục tiêu. M4 (bỏ nhánh `!player`) làm S3 hỏng. Các đột biến còn lại (M2, M3, M5-M12) là việc của tester; đã hoàn tác hai đột biến trên, đối chiếu bản sao lưu.
- M7 (thứ tự `beforeLeave` và `watch.leave()`): chưa kiểm test nào bắt.

### Lệnh đã chạy
- typecheck ✓, `npm test` ✓ (765 test, 50 file), build ✓.
- Vòng lặp describe `reconnecting after a dropped connection` 5 lần: 5/5 qua (39 test).
- `npm run test:e2e` ✓ (71 passed, gồm `multiplayer.spec.ts` không sửa, hai test `connection: when the world has let the player go…` không hỏng vì `inert`; flake `boss bar (phone upright, notch)` không xảy ra). Lần chạy đầu bị ngắt giữa chừng khi phiên khởi động lại, đã chạy lại từ đầu.
- `reconnect.spec.ts --repeat-each=3 --workers=1` ✓ (9/9).
- Không đổi schema, message, `Profile`, close code, route, chữ người chơi thấy; không dependency mới; `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json` không bị đụng; không commit. Bản sao lưu ở `scratchpad/t26-backup/`.

## Kiểm thử vòng 1 (T26): PASS
- typecheck ✓   test ✓ (50 file, 765 test)   build ✓   e2e ✓ (72/72 = 71 cũ + 1 test mới của tester; `reconnect.spec.ts --repeat-each=5` 20/20; boss bar không flake)   photo3d (không chạy)
- E1 trên HEAD: đặt `main.ts` của HEAD (còn lại giữ bản mới), E1 hỏng ở `expect.poll(...friend.state.players.has(closer)).toBe(false)` (Expected false, Received true); khôi phục từ bản sao, diff khớp.
- Đột biến (hoàn tác bằng bản sao, diff khớp), test bắt được:
  - M1 (bỏ `cancelWindup`): S1 hỏng; **S2 không bắt được** (xem dưới). M2: S1 (chiêu). M3: S1 (thú thứ ba gồng cắn B). M4, M5: S3.
  - M6 (`pagehide` về `startGame`): E1. M7 (`leave()` trước `beforeLeave()`): **lọt qua mọi test cũ** (mốc lần cuối thấy chỉ mất độ chính xác tối đa 60 s); đã thêm e2e `connection: the page notes when it last saw the world before it says goodbye on its way out` (bắn `pagehide` từ trang, mốc phải tươi trong 1 s): hỏng với M7, qua với mã thật.
  - M8 (bỏ `ticker.stop()`): test `a place lost...` (phần 2). M9 (dừng ticker khi `reconnecting`): test `a try that opens...`. M10 (không `setInert(false)`): `a try that opens...`. M11 (không `inert`): cả hai test e2e đó. M12: 2 test `inviteLink` trong `connection.test.ts`.
- S2 và `cancelWindup`: S2 không thể bắt M1 vì `shelter` chạy trong hẹn giờ của đồng hồ, rồi mô phỏng chạy AI cùng nhịp: thú không còn mục tiêu tự đặt `pal.windup = ""`, nên ở ranh giới nhịp (nơi test nhìn được) không còn dấu vết. Tôi thử thêm một người chơi khác đứng cạnh để thú quay sang họ: AI vẫn đặt lại tư thế, M1 vẫn qua; đã bỏ test đó (rỗng). Kết luận: chỉ gọi trực tiếp `calmPalsTargeting` (S1) quan sát được, như coder ghi; S2 vẫn đúng vai trò (bằng chứng không mở lại đường né của T25), không cần bắt M1.
- UX (kịch bản Playwright, ngắt mạng bằng `setOffline`; ảnh đã xem): điện thoại 390×844 và desktop 1280×720. Khi `reconnecting`: `.hud` `inert`, Tab chỉ nhảy giữa nút "Về sảnh" và body (không bao giờ vào HUD), `frames` vẫn tăng (121->149, 68->82), ảnh thế giới vẽ đầy sau thẻ. Khi `lost` ("Không kết nối lại được"): nút "Về sảnh" 120×44 px (đủ cỡ chạm), đang có focus (viền focus thấy rõ), `ticker.started` = false, `frames` đứng yên (919->919, 397->397), canvas không trống (khung cuối còn nguyên), HUD `inert`. Enter/chạm trên nút được kiểm bởi e2e (`reconnect.spec`, và hai test `connection: ... let the player go` của `multiplayer.spec.ts` không sửa).
- Lệch của coder: `connection.test.ts` so với HEAD chỉ đổi dòng import (thêm `inviteLink`) và thêm describe `inviteLink`; mọi test cũ còn nguyên (dòng bị xoá duy nhất là import cũ). S1 giữ trùm: chấp nhận (cần để kiểm dậm). S2 không có assert `offline` ở 1,5 s: chấp nhận, vì mốc đo trễ tối đa một nhịp (đã có assert `offline` ở +1600 ms).
- Ràng buộc: `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json` không đụng; không đổi schema, message, `Profile`; `git stash list` còn 2 mục. Tôi chỉ sửa `tests/e2e/reconnect.spec.ts` (thêm 1 test). Không commit.
