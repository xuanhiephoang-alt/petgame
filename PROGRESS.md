# PROGRESS: T15 Sảnh báo lỗi khi tải hỏng

## Vòng 1: coder
- [x] Bước 1: `packages/client/index.html`: chú thích form, markup `#load-status` + `<noscript>`, CSS `.lobby-alert`/`.lobby-action`, script inline cổ điển (bộ canh tải, ES2015, `LOBBY_SLOW_MS = 15000`) giữa `#lobby` và thẻ module.
- [x] Bước 2: `packages/client/src/main.ts`: `LOBBY_READY_EVENT` và `document.dispatchEvent(...)` ngay sau 3 dòng mở khoá.
- [x] Bước 3: `tests/e2e/multiplayer.spec.ts`: `LOBBY_SCRIPT`, `LOBBY_SLOW_MS`, `enterLobby(..., press)`, sửa test `lobby:` (bàn phím lúc khoá, vào bằng Enter, `#load-status` ẩn), 2 test mới (lỗi tải/chạy lỗi + Tải lại; mạng chậm bằng đồng hồ giả + tắt JS).
- [x] Bước 4: `docs/architecture.md` (mục `main.ts`, canh tải, helper e2e).
- Lệch kế hoạch: chú thích đầu script inline không ghi nguyên tên sự kiện (ghi "the lobby-ready event") để `grep -c "petgame:lobby-ready" dist/index.html` ra đúng 1 như tiêu chí.
- Lệnh đã chạy: typecheck ✓, test ✓ (333 test), build ✓ (grep = 1), `-g "lobby:" --repeat-each=3 --workers=1` ✓ 9/9; repeat-each=5 ✓ 15/15; cả bộ e2e ✓ 34 test (4,8 phút). Không còn server/Vite chạy nền.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (333)   build ✓ (grep petgame:lobby-ready dist/index.html = 1)   e2e ✓ (34, --workers=1)   photo3d (không chạy)
- Lặp `-g "lobby:" --repeat-each=5` ✓ 15/15, không chập chờn.
- Kiểm chứng bắt lỗi (bản sao tạm ngoài repo): index.html + main.ts của HEAD -> 2 test mới hỏng (`#load-status` không có); giữ code T15 nhưng bỏ `dispatchEvent` sự kiện lobby-ready -> test "mạng chậm" hỏng ở `toBeHidden` (thẻ không tắt sau khi script tới). Test "lobby: nothing is sent..." vẫn qua trên HEAD (chỉ khẳng định `#load-status` ẩn, đúng cả khi phần tử không tồn tại): yếu nhưng chấp nhận được vì 2 test mới phủ.
- Bản build (phục vụ dist qua server cổng 2567): tải bình thường không hiện thẻ, nút "Vào chơi"; chặn /build/*.js -> thẻ "Không tải được game" ngay; treo script -> "Vẫn đang tải…" sau 15 s; nút Tải lại 140x44 ở cả 3 cỡ.
- Ảnh đã xem (qua CDP, không commit): /tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/err-390x844.png, err-844x390.png, err-1280x720.png, slow-390x844.png, slow-844x390.png, slow-1280x720.png. Thẻ lỗi gọn, nút xanh có viền focus; dòng "Vẫn đang tải…" nằm dưới nút khoá. Nhận xét nhỏ: ở 390 dọc câu "Mạng có vẻ chậm… bấm Tải lại." xuống dòng mồ côi chữ "lại" (không lỗi).
- Test đã thêm: không (coder đã thêm đủ; tester không sửa test).
