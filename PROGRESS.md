# PROGRESS: T23 Vào lại đúng thế giới sau khi tải lại trang; thẻ lỗi khi vào

## Vòng 1: coder
- [x] Bước 1: `joinFailure` + kiểu `JoinFailure` (`packages/client/src/net/connection.ts`)
- [x] Bước 2: unit test `joinFailure` (`packages/client/src/net/connection.test.ts`)
- [x] Bước 3: `ui/joinStatus.ts` (`joinCard`, `RETURN_HINT`, `INVITE_HINT`) + `ui/joinStatus.test.ts`
- [x] Bước 4: `#join-status` thay `#join-error`, CSS `.lobby-actions`, `.lobby-action.quiet`, chú thích HTML (`packages/client/index.html`)
- [x] Bước 5: `main.ts`: `enter()` + cờ `joining`, `showJoinCard`, `setAddress`/`dropWorldFromAddress`, gợi ý "Quay lại…" + focus nút, `sessionStorage` `petgame:room`, `syncAddress` trong lúc chơi, địa chỉ khi mất hẳn kết nối (`packages/client/src/main.ts`)
- [x] Bước 6: e2e (`tests/e2e/multiplayer.spec.ts`): sửa `waitForWorld`, test "6th" (thử lại khi có chỗ), test `lobby:` T15 (thẻ "đã đóng"), test "let the player go" (địa chỉ có `room` ngay khi mất, chờ `load`, gợi ý "Quay lại…"), thêm test `lobby:` mới (tải lại, thế giới đóng, server không tới được, nút ≥ 44×44, một lần tải trang)
- [x] Bước 7: `docs/architecture.md` (2 chỗ)
- Lệch kế hoạch: đếm "số lần tải trang" trong e2e bằng sự kiện `load` của trang, không phải `framenavigated`. `framenavigated` của Playwright cũng bắn cho `history.replaceState` (điều hướng cùng tài liệu), nên giá trị là 2 dù trang chỉ tải một lần. Đã đổi ở test `lobby:` của T15 (chỉ phần đếm) và ở test mới; test "connection: one device…" (dòng ~1613) không đụng.
- Lệnh đã chạy: typecheck ✓, test ✓ (353 test), build ✓, e2e đầy đủ: 36 qua, 2 test `lobby:` lỗi do đếm `framenavigated` ở trên; sau khi sửa chạy lại `-g "lobby:"` ✓ (4/4). Chưa chạy lại cả bộ sau sửa này.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (353, thêm 1 sau đó = 354)   build ✓   e2e ✓ (38/38 cả bộ)   photo3d (không chạy, không đụng)
- Lặp `-g "lobby:|6th" --repeat-each=3 --workers=1`: 15/15 qua, không chập chờn.
- Độ lệch "đếm bằng `load` thay `framenavigated`": hợp lý. Đã kiểm bằng spec tạm (đã xoá): `replaceState` làm `framenavigated` tăng nhưng `load` không đổi (1); `location.assign` và `page.reload()` làm `load` tăng (2, 3). Nên bộ đếm `load` vẫn bắt được tải trang thật và không bị `replaceState` làm sai. Test "connection: one device..." còn dùng `framenavigated` nhưng không bị ảnh hưởng (qua).
- Tiêu chí hoàn thành: [x] joinFailure + unit  [x] joinCard + unit (MAX_PLAYERS)  [x] `#join-error` và chữ lỗi cũ không còn (grep sạch)  [x] thẻ `.lobby-alert.failed`, nút `type="button"`, `.quiet`, ≥ 44×44 ở 3 cỡ (e2e)  [x] vào hỏng/đang vào/chống chồng  [x] closed bỏ `room` bằng replaceState (load = 1)  [x] full giữ `room`, Thử lại vào được (6th)  [x] địa chỉ theo `players.size` (e2e poll) và `#fragment`/tham số khác (unit mới)  [x] mất hẳn = URL nút Về sảnh (e2e "let the player go")  [x] tải lại khi có bạn: gợi ý, focus, Enter (e2e)  [x] `lobby-ready` đồng bộ sau mở khoá (3 test `lobby:` T15 qua; đọc diff: không có await trước)  [x] sessionStorage/replaceState qua `safeStorage`  [x] không đổi server/shared/script canh tải (git status sạch ở đó)  [x] docs/architecture.md cập nhật  [x] mọi lệnh sạch
- Không có lỗi.
- Test đã thêm: `packages/client/src/net/connection.test.ts`: "keeps the #fragment of the address" (lobbyUrl giữ `#…`).
- Lưu ý nhỏ: log Vite "Unhandled error: test: the lobby script broke" là chủ ý của test T15, không phải lỗi.
