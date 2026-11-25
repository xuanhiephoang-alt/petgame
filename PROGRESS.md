# PROGRESS: T24 Kết nối lại: các trường hợp mạng xấu còn hở (sau T3)

## Vòng 1: coder
Làm lại từ đầu sau khi container bị thay (cây làm việc sạch ở `323738f`); bản sao lưu ở `scratchpad/t24-backup/`.

### Bước A: server
- [x] `packages/server/src/systems/resume.ts` + `resume.test.ts` (5 test): `ResumePoint`, `noteResume`, `peekResume`, `takeResume`. `noteResume` nhận thêm tham số `now` (giờ đồng hồ phòng) để dọn điểm quá hạn của token khác; kế hoạch không ghi tham số này.
- [x] `rooms/GameRoom.ts`: `resumes`, `resumeMs`, ghi điểm chỉ ở nhánh hold bị từ chối của `onDrop`; `onJoin` dùng một lần (vị trí, máu, màu nếu trống, `nextEatAt`); `canResume(token)`.
- [x] `http.ts`: `POST /resume` (`express.text`, 1 kB, `no-store`, `Access-Control-Allow-Origin: *`, 400 khi sai), tuỳ chọn `canResume`. `index.ts` truyền hàm tìm phòng bằng `matchMaker.getLocalRoomById` (tên hàm đúng trong `@colyseus/core` 0.18.18; trả `Room`, `instanceof GameRoom` rồi `canResume`; bọc `try`).
- [x] Test: `http.test.ts` (3 test `/resume`), `GameRoom.test.ts` A1, A2, A3, A4 (e) và mở rộng test `endGrace`.

### Bước B: client
- [x] `net/reconnect.ts`: `LostReason` thêm `refused`; `lostReason(code, reconnecting)`; `HUNG_TRY_MS`, `AUTO_REJOIN_GAP_MS`; `isTryHung`, `mayRejoinAgain`; `ConnectionWatch` thay lần thử treo (nhánh `reconnecting` của `check()`, đặt lại mốc khi trang ngủ). `reconnect.test.ts` thêm 8 test (đủ mục kế hoạch).
- [x] `net/connection.ts`: `canResume` (`RESUME_CHECK_MS` = 3 s). `ui/strings.ts`: `CONNECTION_TEXT.refused`. `ui/connection.ts`: `refused` vẽ như đang kết nối lại, không lấy focus.
- [x] `main.ts`: `AUTO_ENTER_KEY`, `AUTO_REJOIN_AT_KEY`; `react` gặp `refused` thì giữ màn "Đang kết nối lại…" rồi `comeBack()` (`mayRejoinAgain` và `canResume`, ghi khoá, hiện chữ `refused`, `location.assign`; không thì "Không kết nối lại được"); sảnh đọc và xoá `AUTO_ENTER_KEY` lúc nạp, khớp `?room=` thì `enter()` sau `petgame:lobby-ready`.
- [x] `tests/e2e/reconnect.spec.ts` (mới, 2 test): bản chép `openWithSwitch` có `hangNext`, `flapNext`.
- [x] Tài liệu: `docs/design/multiplayer.md`, `docs/architecture.md`, `docs/deploy.md`.

### Lệch kế hoạch
- Test tích hợp giả mất chỗ bằng `(client.connection.transport as any).ws.close()` thay vì `ws.terminate()`: socket của SDK trong Node là WebSocket của undici, không có `terminate()`. Server vẫn thấy socket đóng khi phiên còn `JOINING`, và client nhận 4003 như kế hoạch. Tài liệu nói chung "đóng socket".
- A1 so máu bằng `toBeCloseTo(37, 0)` thay vì đúng 37: người chơi hồi máu rất ít (37,2) trước lúc rớt; điểm quay lại ghi đúng máu lúc mất chỗ.
- `reconnect.spec.ts` đếm `load` từ sau lần tải đầu (trang đã tải xong trong `openWithSwitch`), nên "tải lại một lần" là `loads` = 1, không phải 2.
- `reconnect.test.ts`: stand-in room mặc định `readyState` 3 (đang chờ hẹn) để test cũ "ping rồi coi kết nối im lặng là rớt" không bị nhánh thay lần thử treo đóng thêm lần nữa (nhánh đó đúng là hành vi mới); test hỏng và test mới đặt `readyState` rõ ràng. Cũng sửa `.map(lostReason)` thành lambda vì `map` truyền chỉ số làm tham số thứ hai.

### Lệnh đã chạy
- typecheck ✓, `npm test` ✓ (732 test, 49 file), `npm run build` ✓.
- `npm run test:e2e` ✓ (70 passed = 68 cũ + 2 mới; các test T3 trong `multiplayer.spec.ts` không sửa, gồm hai test "Không kết nối lại được" sau `debug:endGrace`; flake `boss bar (phone upright, notch)` không xảy ra).
- `npx playwright test tests/e2e/reconnect.spec.ts --repeat-each=3 --workers=1` ✓ (6/6; test 1 khoảng 17 s, test 2 khoảng 12-16 s).
- Vòng lặp `GameRoom.test.ts` 10 lần và bảng đột biến M1-M13 là việc của tester, chưa chạy. `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json`, schema, message, `Profile` không bị đụng; không dependency mới.

## Kiểm thử vòng 1 (T24): PASS
- typecheck ✓   test ✓ (49 file, 732 test)   build ✓   e2e ✓ (70/70; `reconnect.spec.ts --repeat-each=5` 10/10; boss bar không flake)   photo3d (không chạy)
- Chạy lặp: describe `reconnecting after a dropped connection` 10/10 (203 s, ~20 s mỗi lần); 5/5 dưới 4 vòng lặp CPU (109 s).
- Đột biến (hoàn tác bằng bản sao, diff khớp), test bắt được:
  - M1 (bỏ `noteResume` trong `onDrop`): A1 và "a spot to take back lasts resumeMs"; e2e `reconnect.spec` test 1.
  - M2 (ghi điểm ở `onLeave`): "a drop whose grace runs out..." và test hook `endGrace`; e2e hai test `connection: ... let the player go` của `multiplayer.spec.ts`.
  - M3 (`takeResume` không xoá): `resume.test.ts` "can be taken once" và A1.
  - M4 (bỏ `until` ở peek, ở sweep, ở cả hai): `resume.test.ts` ("cannot be taken after its time", "is only looked at by peekResume", "sweeps the points of other devices") và A3.
  - M5 (không dùng `resume.hp`): A1.   M6 (`canResume` dùng `take`): A1; e2e test 1.
  - M7 (`announce(news, client)`): A4.
  - M8-M11, M13: `reconnect.test.ts` (M8 3 test, M9 "does not count the time a page slept", M10 2 test, M11 "allows the first time and then one a minute", M13 "is closed once, after HUNG_TRY_MS..."); e2e: M11 và M13 hỏng ở `reconnect.spec`. **M10 qua e2e** (e2e không có ca 4003 ngoài lúc đang nối lại), nhưng unit bắt được; chấp nhận.
  - M12 (`comeBack` bỏ `canResume`): hai test e2e `connection: ... let the player go` hỏng.
  - Không cần thêm test.
- Nhận xét lệch của coder: `ws.close()` thay `terminate()` vẫn là đúng đường (A1 khẳng định mã đóng 4003 `FAILED_TO_RECONNECT`, và M1/M5/M6 chứng minh nhánh `onDrop` hold-không-phải-Deferred được chạm tới); `toBeCloseTo(37, 0)` chấp nhận được (100 bị bắt, M5 hỏng); tham số `now` của `noteResume` cần để dọn điểm quá hạn, có test "sweeps"; đếm `loads` bắt đầu sau lần tải đầu là đúng; `readyState` mặc định 3 của stand-in chỉ để các test cũ không chạm nhánh mới, test mới đặt rõ.
- Chống né/gian lận (đọc mã + test): điểm quay lại chỉ ghi ở `onDrop` khi hold bị từ chối (không ở hết giờ, endGrace, rời chủ động); vị trí và máu y nguyên lúc rớt (không hồi máu, không dịch chỗ; máu không bao giờ <= 0 vì `faintPlayer` hồi ngay); điểm nằm trong `Map` của từng phòng theo token nên cần cùng thế giới và cùng token thiết bị; `/resume` chỉ trả một bit, `peek` không dùng hết, 400 khi sai dạng; dùng một lần (`take` xoá), hết hạn `resumeMs` = 20 s, dọn khỏi bộ nhớ ở `noteResume`/`takeResume` (không có đồng hồ riêng: điểm của thiết bị không quay lại ở lại tới lần ghi/vào kế tiếp hoặc khi phòng đóng, nhỏ và bị chặn theo số token); tự vào lại bị chặn 60 s bằng `mayRejoinAgain` (M11 chứng minh bởi test).
- Ràng buộc: không đổi `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json`; không đổi schema, message, `Profile`; `git stash list` còn 2 mục. Không commit.
