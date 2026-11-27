# PROGRESS: T31 Hoàn thiện thông báo sau T6

## Vòng 1: coder

### E1 và E2 hỏng trên mã chưa sửa (HEAD `180dac2`, mã sản phẩm như `2030898`)
`tests/e2e/toasts.spec.ts` được viết và chạy trước khi đổi mã sản phẩm:
- E1 (`a toast that takes an old one's place is at once where it stays…`) hỏng ở `expect(read.twoTop).toBe(0)`: "Hai" có `offsetTop` 55 chứ không phải 0, vì cái cũ đang mờ vẫn giữ chỗ trong cột (nên "Ba" cũng thấp hơn một ô).
- E2 (`turning the phone so only one toast fits…`) hỏng ở `toHaveCount(1, { timeout: 1000 })` sau khi xoay sang ngang: vẫn 2 thông báo không mờ (không ai bớt khi số chỗ giảm).
Sau khi sửa cả hai qua.

### Mã
- [x] `index.html`: `.toast.out { position: absolute; left: 0; max-width: none; pointer-events: none; }` kèm chú thích.
- [x] `ui/toastQueue.ts`: `enqueue(text, level, at)` tách từ `push`; `shrink(now)` đưa cái yếu nhất đang hiện về hàng chờ (`at = now`) khi `visible > maxVisible()`; JSDoc lớp ("`update` chỉ thêm").
- [x] `ui/hud.ts`: `renderToasts` đọc `offsetTop` và `width` của mọi cái sắp mờ trước, rồi ghi `top`, `width` và lớp `out`; `resized()` (đo lại chỗ, `shrink`, `update`, vẽ lại) và listener `resize` trong constructor; JSDoc `measureSlots`. Vẫn đo khi hiện và mỗi 250 ms lúc chờ.
- [x] Test: 9 test `shrink` trong `toastQueue.test.ts`; test server `the boss reward notice says the reward item by item…` trong `GameRoom.test.ts` (không còn đồ thưởng và còn một món, chữ đúng từng ký tự có `\xa0`); `tests/e2e/toasts.spec.ts` (E1, E2).
- [x] Tài liệu: `docs/design/hud.md` (chỗ hiện, bao nhiêu cái cùng lúc, tính lại số chỗ, ngoại lệ mức cao), `docs/architecture.md` (`toastQueue.ts`, `hud.ts`, danh sách spec).

### Lệch kế hoạch
- E1: "Một" dùng chữ dài hơn (`ONE`) để chiều cao chứng minh được việc không xuống dòng lại (đúng gợi ý cho M2). Phần điện thoại ngang thêm kiểm `top` bằng 0 sau khi cái cũ bị xoá.
- E2: dùng `Set` thu chữ từng hiện bằng `expect.poll` (khoảng 100 ms); phần quay lại (xoay ngang rồi dọc) kiểm 2 thông báo trong hạn 1 s như kế hoạch (M8 chưa kiểm).
- Test server: hai trường hợp chạy trong một test (`colyseus.cleanup()` giữa hai phòng) thay vì hai test.
- Không có lệch nào khác; không test `multiplayer.spec.ts` nào hỏng vì sửa xoay, nên không có T31b.

### Lệnh đã chạy
- typecheck ✓, `npm test` ✓ (785 test), build ✓.
- `toasts.spec.ts --repeat-each=3 --workers=1` ✓ (6/6).
- `npm run test:e2e` ✓ (74 passed; các test thông báo, thanh trùm và `setViewportSize` của `multiplayer.spec.ts` không sửa đều qua; flake `boss bar (phone upright, notch)` không xảy ra).
- Bảng đột biến M1-M10 là việc của tester, chưa chạy. Không đổi chữ người chơi thấy, schema, message; không dependency mới; không đụng `multiplayer.spec.ts`, `labelLayout*`, `.claude/settings.json`; không commit; không `git stash`. Bản sao lưu ở `scratchpad/t31-backup/`.

## Kiểm thử vòng 1 (T31): PASS
- typecheck ✓   test ✓ (50 file, 785 test)   build ✓   e2e ✓ (74/74; `toasts.spec.ts --repeat-each=5` 10/10; boss bar không flake)   photo3d (không chạy)
- E1 và E2 trên mã chưa sửa (HEAD của `hud.ts`, `toastQueue.ts`, `index.html`; khôi phục từ bản sao, diff khớp): cả hai hỏng. E1: `expect(read.twoTop).toBe(0)` Received 55; E2: `toHaveCount(1)` Received 2 sau khi xoay.
- Đột biến (hoàn tác bằng bản sao, diff khớp), test bắt được: M1 (bỏ `position: absolute`): E1. M2 (không ghi `width`): E1. M3 (không ghi `top`): E1. M4 (bỏ listener `resize`): E2. M5 (`shrink` bỏ hẳn cái thừa): 4 unit `shrink` và E2. M6 (bớt cái mới nhất): 4 unit `shrink`. M7 (`update` cũng bớt): unit "is the only thing that takes a shown toast off: update never does". M9 (`rewardText` dùng dấu cách thường): test server mới và `wardrobe.test.ts` ("names clothes in reward texts"). M10 (thiếu dấu cách giữa các món trong `rewardText`, hoặc thừa trước phần XP trong `notices.ts`): test server mới (và `wardrobe.test.ts` cho biến thể đầu).
- **M8 sống sót** (`resized` không gọi `update`): được nhưng tương đương hành vi: `tickToasts` gọi `update` mỗi khung nên cái chờ hiện ở khung kế tiếp (vài chục ms) dù không có `update` trong `resized`. Thử hạ hạn phần quay lại từ 1000 ms xuống 200 ms: **hỏng cả với mã thật** (3-4/4 lần), vì xoay + vẽ + hoạt ảnh trượt vào mất hơn 200 ms trong Chromium vẽ phần mềm; đã hoàn tác về 1000 ms (diff khớp). Kết luận: không kiểm chặt hơn được mà không chập chờn; ghi nhận, không phải lỗi.
- Xem ảnh/hình học (kịch bản Playwright, build dev): 390×844, 844×390, 1280×720: lúc thay thế "Ba" nằm ngay ô thứ hai (top 228 so với 201+27; desktop 323 so với 291+32), cái cũ mờ nằm đúng ô cũ, giữ chiều cao (27/32 px, không xuống dòng lại), chồng lên cái ở ô 1 trong 200 ms (đúng thiết kế, chữ chồng nhìn thấy trong ảnh) rồi biến mất, các cái còn lại không nhảy (khoảng cách 4 px sau khi trượt xong). 412×915 -> 915×412: sau 400 ms chỉ còn 1 thông báo, đáy 198 px ≤ 412-140 = 272; sau ~8 s thông báo kia hiện đủ chữ ở đúng chỗ; xoay về dọc: 2 thông báo trong 600 ms. Thông báo ở cột trái (y 200-330) không che tên nhân vật (giữa màn hình) ở cả bốn khổ.
- Lệch của coder: E1 dùng chữ "Một" dài (chiều cao chứng minh không xuống dòng lại: hợp lý, đúng gợi ý M2); E2 thu chữ bằng `Set` qua poll 100 ms: hợp lệ, chữ cao nào cũng ở ≥ 1 khung của poll (mỗi thông báo hiện ≥ vài giây); hai phòng trong một test server (có `colyseus.cleanup()` giữa): chấp nhận, nhưng một lỗi ở trường hợp đầu che trường hợp sau.
- Ràng buộc: `multiplayer.spec.ts`, labelLayout, `.claude/`, `package-lock.json` không đụng; không đổi schema, message; `git stash list` còn 2 mục. Không sửa thêm file test nào (bản sao `toasts.spec.ts` đã khôi phục). Không commit.
