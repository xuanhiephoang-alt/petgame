# PROGRESS: T79 Gợi ý quay lại thế giới cùng bạn bè khi mở app từ Màn hình chính

## Vòng 1: coder
- [x] Bước 1: `ui/joinStatus.ts`: `RecentWorld.seen`; `FRIENDS_STAY_MS`, `RETURN_OFFER_MS` (= `EMPTY_WORLD_HOLD_MS` + 9 phút), `SEEN_EVERY_MS`; `recentWorlds` đọc `seen` (thiếu/sai = 0, vẫn giữ mục); `withRecentWorld(..., seen)`; `withWorldClosed`; `returnOffer`.
- [x] Bước 2: `ui/strings.ts`: `LOBBY_TEXT.rejoinFriends`.
- [x] Bước 3: `index.html`: `#rejoin-btn` (class `lobby-action`, ẩn sẵn) ngay sau `#join-btn`, chú thích HTML, CSS dự phòng cho điện thoại ngang (xem "Lệch kế hoạch").
- [x] Bước 4: `main.ts`: `recent` dùng chung, `offered`, `noteRecentWorld(..., seen)`, `forgetWorldTime`, `worldClosed` (hai chỗ: nhánh `quietRetry` và `failure === "closed"`), `rejoinBtn.hidden = true` đầu `enter()`, handler bấm nút, hiện nút lúc mở khoá sảnh (không focus), `noteSeen` + timer 60 s + `visibilitychange` ẩn + `pagehide` (ghi trước `watch.leave()`), `clearInterval` khi `lost`, `forgetWorldTime` khi `shutdown`.
- [x] Bước 5: `ui/joinStatus.test.ts`: sửa/thêm test theo mục Test của PLAN (39 test trong file).
- [x] Bước 6: `tests/e2e/rejoin.spec.ts` (mới, 3 test, kích thước ≥ 44 px và trong khung nhìn ở 390×844, 844×390, 1280×720, đường phím Tab + Enter). Không đụng `multiplayer.spec.ts`.
- [x] Bước 7: `docs/architecture.md`: câu T79 sau phần T65.
- Lệch kế hoạch:
  - CSS ngang: dự phòng `zoom: 0.8` của PLAN không đủ. Đo ở 844×390: chiều cao `.lobby-look` là 268 px do bộ chọn ngoại hình (các nút 44 px), không phải hình nhân vật, nên thu nhỏ hình nhân vật không giúp (nút bị cắt, ratio 0,45). Thay bằng quy tắc trong media query ngang, chỉ khi nút đang hiện (`#lobby form:has(#rejoin-btn:not([hidden]))`): `gap: 4px 8px; padding: 0` và `.look-picker { gap: 4px }`. Không đổi cỡ vùng chạm, không ảnh hưởng sảnh khi nút ẩn.
  - Test 3 của e2e: danh sách dựng sẵn mô tả bằng `ago` (ms trước đồng hồ trang) thay vì truyền hàm, để `addInitScript` nhận dữ liệu thuần.
- Lệnh đã chạy: typecheck ✓, test ✓ (595 test, 40 file), build ✓, `npm run test:e2e` ✓ (61 passed), `rejoin.spec.ts --repeat-each=5 --workers=1 --retries=0` ✓ (15/15, chạy trước khi sửa `docs/architecture.md`, sau đó không đổi code).
- Không dùng `git stash`, không commit, không đụng server, schema, messages, Profile.

## Kiểm thử vòng 1 (T79): PASS
- typecheck ✓   test ✓ (40 file, 595 test; sau khi tôi thêm 1 ca là 596)   build ✓   e2e ✓ (61; sau khi tôi thêm 1 test là 62)   `rejoin.spec.ts` x5 ✓ (15/15)   `-g "lobby:"` x3 ✓ (27/27)   photo3d (không chạy)
- Tiêu chí hoàn thành:
  - [x] Nút không hiện khi có `?room=` (unit `returnOffer` + e2e ca "opened by a link"); không lấy focus (e2e `not.toBeFocused`); Tab từ "Vào chơi" tới nút rồi Enter (e2e test 2).
  - [x] Mục cũ không có `seen`: `recentWorlds` giữ mục với `seen: 0` (unit), `arrival` vẫn nhận ra thế giới đã vào cho T65 (unit "arrival with the device's recent worlds"), nút không hiện (e2e ca "no time (T65)").
  - [x] Giờ bị quên khi thế giới đóng: thẻ "closed" đặt `seen = 0`, tải lại `/` không còn nút (e2e test 2). Màn `shutdown` gọi `forgetWorldTime` (đọc code; không có e2e riêng, e2e server khởi động lại không có sẵn; unit `withWorldClosed` có).
  - [x] Bố cục: bản HEAD (git archive, Vite cổng 5180) và cây làm việc (Vite 5173) ở 844x390, 390x844, 1280x800 với nút ẩn: tọa độ và kích thước của `#lobby`, form, h1, `#look`, `.look-picker`, `#name`, `#join-btn`, `#room-hint` GIỐNG HỆT. Khi nút hiện: 844x390 nút 680x44 ở y=340 (đáy 384/390), 390x844 nút 340x44, 1280x800 nút 420x44; đều trong khung nhìn, không tràn form, không cuộn trang. Đã xem 3 ảnh chụp: gọn, không chồng lấn; ở ngang tiêu đề sát mép trên (khoảng 4 px), chấp nhận được.
  - [x] Không đổi server, schema, message, Profile (`git status`: không có file server/shared); `multiplayer.spec.ts`, `labelLayout*` không đổi; `git stash list` vẫn 2 mục.
- Đột biến (đã hoàn nguyên, `diff` với bản gốc rỗng):
  - a) bỏ cửa sổ 10 phút -> bị bắt ("is inclusive at the edge of the window").
  - b) chọn mục đầu tiên thay vì `seen` lớn nhất -> KHÔNG bị bắt lúc đầu (cả hai ca "picks the latest seen" vẫn qua nếu chọn mục hợp lệ đầu tiên). Tôi thêm ca "picks the world seen last among several offerable ones, wherever it is in the list"; giờ bị bắt.
  - c) ghi giờ khi đang offline (bỏ `watch.online &&`) -> KHÔNG bị bắt lúc đầu (cả 3 test e2e và 180 test client qua). Tôi thêm test e2e "the time is not written while the connection is down": chờ lớp phủ mạng "reconnecting" sau sự kiện `offline`, rồi cho trang ẩn; giờ phải giữ nguyên. Qua 3/3 trên code thật, hỏng 3/3 với đột biến.
  - d) hiện nút khi có `?room=` -> bị bắt ("never offers when the page was opened with ?room=...").
  - e) không xoá giờ ở thẻ closed -> bị bắt (e2e test 2, `toMatchObject({ friends: true, seen: 0 })`).
- Test đã thêm: unit `joinStatus.test.ts` 1 ca (đột biến b); e2e `tests/e2e/rejoin.spec.ts` 1 test (đột biến c). Cả hai chỉ là file test.
- Lưu ý: test mới dùng `window.dispatchEvent(new Event("offline"))` như SDK, nên phụ thuộc việc lớp phủ `.net-overlay.reconnecting` hiện đủ lâu; 3/3 lần chạy ổn định.
