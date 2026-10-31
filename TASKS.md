# TASKS

Danh sách việc cho đội agent, xếp theo ưu tiên từ trên xuống. Agent chính lấy việc chưa xong đầu tiên (bỏ qua việc đang chờ trả lời), chạy đúng quy trình trong `CLAUDE.md`, rồi cập nhật trạng thái ở đây.

Trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong (ghi mã commit) · `⛔` chờ trả lời (xem `QUESTIONS.md`)

Người dùng thêm việc mới: ghi một dòng vào đúng mức ưu tiên (mô tả vấn đề hoặc mong muốn là đủ; game-designer sẽ phân tích).

## P1: Lỗi và lỗ hổng ảnh hưởng người chơi hoặc quy trình

- [x] **T1. Test e2e chập chờn khi vào phòng.** Một lần chạy cả bộ, test "a captured pal follows the player and shows in the party panel" kẹt ở sảnh (ảnh chụp trang lúc lỗi: sảnh với ô tên trống sau khi đã điền tên và bấm "Vào chơi"); chạy lại thì qua. Tìm nguyên nhân gốc (bấm trước khi script sảnh sẵn sàng? sảnh khởi tạo xoá ô tên?) và làm helper `join` trong `tests/e2e/multiplayer.spec.ts` (hoặc sảnh trong `packages/client/src/main.ts`) chắc chắn hơn, không nới lỏng kiểm tra. Đội agent dựa vào e2e để chấm PASS nên việc này đi trước.
- [ ] **T2. Không thả bớt thú được, túi đầy thì mất thú vừa bắt.** Túi tối đa `MAX_PARTY` = 30 nhưng không có cách thả thú. Khi túi đầy, bắt thường vẫn "thành công" rồi thú biến mất kèm thông báo "Túi thú đã đầy" (`handleThrow` trong `GameRoom.ts`); còn thông báo khi ném bóng vào thú đầu đàn lại bảo người chơi "cho bớt thú đi", một việc chưa làm được. Cần: nút thả thú trong bảng Thú (có xác nhận), message mới, server kiểm tra; không cho ném bóng khi túi đầy (báo rõ) thay vì làm mất thú; lưu game và test.
- [ ] **T3. Rớt mạng là văng khỏi game.** Server không gọi `allowReconnection`; client chỉ báo "Mất kết nối với server" và người chơi phải vào lại từ sảnh (điện thoại dùng 4G hay rớt). Cho phép kết nối lại trong một khoảng ân hạn (ví dụ 20 giây) giữ nguyên người chơi, thú đi theo, vị trí; client tự kết nối lại bằng reconnection token và báo trạng thái; test tích hợp và e2e (ngắt socket rồi kiểm tra quay lại đúng người chơi).
- [ ] **T4. Lên cấp quá chậm so với hệ thống chiêu.** `xpToNext` = 20·L^1.5: lên cấp 7 (chiêu thứ 2) cần khoảng 860 kinh nghiệm, tức hơn 200 đòn trúng của thú đi theo (`XP_PER_HIT` = 4); lên cấp 15 (chiêu thứ 3) cần khoảng 6.400. Chơi bình thường gần như không thấy chiêu 2, 3 nếu không bắt thú cấp cao. Gọi balance-analyst rồi game-designer: mục tiêu gợi ý là lên cấp 7 trong buổi chơi đầu, cấp 15 sau vài buổi; xem xét kinh nghiệm cho mỗi mục tiêu trúng chiêu, hạ gục, nhiệm vụ.

## P2: Lối chơi và giao diện

- [ ] **T5. Nhãn tên đè lên nhau.** Khi thú đứng gần nhau (ví dụ thú đầu đàn và thú đi theo, hoặc nhiều thú hoang), nhãn tên và thanh máu chồng lên nhau khó đọc (`packages/client/src/game/labels.ts`, CSS trong `index.html`). Dàn nhãn tránh nhau hoặc thu gọn nhãn ít quan trọng; kiểm tra bằng ảnh chụp desktop và điện thoại.
- [ ] **T6. Thông báo che HUD trên điện thoại dọc.** Toast gợi ý dài (ví dụ "💫 Thú đang choáng: ném bóng (E)...") đè lên góc trên bên trái của HUD ở màn hình 390×844. Đặt toast vào chỗ trống, giới hạn bề rộng, rút gọn chữ trên điện thoại; kiểm tra dọc và ngang.
- [ ] **T7. Chiêu của thú hoang cấp cao có thể quá nặng với người chơi.** Thú hoang ở xa lên tới cấp 14 dùng chiêu với sức mạnh ×2,56 (ví dụ Phun lửa khoảng 28, Sấm sét khoảng 41 sát thương), cộng với cú cắn; thú đầu đàn đã được giới hạn ở cấp 8 (`ALPHA.skillLevel`) nhưng thú thường thì chưa. Gọi balance-analyst đo thời gian người chơi trụ được theo vùng (có và không có giáp), rồi đề xuất điều chỉnh.
- [ ] **T8. Thú đầu đàn bắt được không có dấu hiệu gì.** Sau khi bắt, nó chỉ là một con thú cấp cao bình thường trong túi. Lưu cờ đầu đàn cho thú đã bắt (schema `OwnedPal`, `Profile`, `sanitizeProfile`) và hiện ★ trên thẻ thú và nhãn tên; có thêm lợi ích gì không do game-designer quyết (mặc định: không).
- [ ] **T9. Thú kẹt sau cây, đá khi đuổi theo.** `stepChase`/`stepCompanion` chỉ trượt quanh vật cản, chưa tìm đường. Thêm tìm đường A* đơn giản trên lưới vật cản (`CollisionGrid`) khi bị chặn, giữ chi phí nhỏ với khoảng 100 thú mỗi phòng (`packages/server/src/ai/`), có test.
- [ ] **T15. Sảnh: báo lỗi khi tải hỏng, nút cảm ứng đủ 44 px.** Từ T1, ô tên và nút "Vào chơi" khoá đến khi script sảnh sẵn sàng; nếu script tải hỏng, người chơi chỉ thấy "Đang tải..." mãi. Hiện thông báo lỗi kèm nút "Tải lại" (giữ `?room=` của link mời). Sửa luôn các chỗ chạm dưới 44 px có từ trước trong sảnh: ô tên 39 px khi điện thoại ngang, `.style-btn` 34 px, `.swatch` 32 px (`packages/client/index.html`). Thêm bước bấm Enter vào test hồi quy `lobby:`.

## P3: Nợ kỹ thuật và hạ tầng

- [ ] **T10. Tách `GameRoom.ts` (khoảng 2.000 dòng).** Chia thành các module theo hệ thống (chiêu, thú đầu đàn, trùm, chiến đấu, thú đi theo, lưu game) mà không đổi hành vi; toàn bộ test giữ nguyên và phải qua.
- [ ] **T11. Tách `Game.ts` (khoảng 1.360 dòng).** Tách phần xử lý message, hiển thị chiêu, nối HUD ra các module riêng, không đổi hành vi.
- [ ] **T12. Gom chữ hiển thị tiếng Việt về một chỗ.** Chữ trên HUD và thông báo của server đang rải khắp code. Gom vào `packages/client/src/ui/strings.ts` và một bảng chữ cho thông báo server để dễ sửa và dịch sau này.
- [ ] **T13. PWA chưa cài được đúng nghĩa.** `packages/client/public/manifest.webmanifest` có `"icons": []` và chưa có service worker. Thêm icon (192, 512, maskable) và service worker lưu sẵn tài nguyên tĩnh; kiểm tra theo `docs/choi-tren-iphone.md`.
- [ ] **T14. Bộ ảnh `npm run shots` chưa có nội dung mới.** Thêm ảnh cho một chiêu đang tung, thú đầu đàn, thanh chiêu trên điện thoại vào `scripts/shots.mjs`, để thay đổi hình ảnh ở các phần này được so sánh trước/sau; kiểm tra script vẫn chạy.
- [ ] **T16. E2E chạy trên bản build thay vì Vite dev.** Vite dev có thể tự tải lại trang ngay sau `load` (một nguồn gây lỗi T1). Chạy Playwright trên client đã build (như `npm run play`: server phục vụ `dist/`) để bỏ hẳn rủi ro này và giống bản thật hơn; giữ thời gian chạy CI hợp lý.
