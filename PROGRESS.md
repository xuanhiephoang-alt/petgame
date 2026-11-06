# PROGRESS: T36 Test toasts tất định

## Vòng 1: coder
- [x] Bước 1: spawn `emberpup`, lấy id mới có `hp === 1`, poll đến khi đúng một con (`tests/e2e/multiplayer.spec.ts`)
- [x] Bước 2: vòng ném `throwAtSpawned` chỉ gửi `throw` với id đó khi còn trong state; nhịp 900 ms và các timeout giữ nguyên
- [x] Bước 3: kiểm `(await partyOf(page)).species` bằng `["emberpup"]` ngay sau poll hai toast
- [x] Bước 4: bỏ `debug:teleport` và chú thích sai; chú thích mới trước poll máu
- Lệch kế hoạch: không có
- Lệnh đã chạy: typecheck ✓, test này lặp 30/30 qua (~12 s mỗi lượt), cả bộ e2e 28/28 qua

## Kiểm thử vòng 1: PASS
- typecheck ✓   test (không chạy, chỉ đổi file e2e)   build (không chạy)   e2e ✓ cả bộ `--workers=1` 28/28   test toasts lặp `--repeat-each=30 --workers=1`: 30/30 qua   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] chỉ `tests/e2e/multiplayer.spec.ts` và `PROGRESS.md` đổi, không có code sản phẩm  [x] thông báo bắt và nhiệm vụ cùng hiện, thông báo nhỏ không đẩy thông báo lên cấp (giữ nguyên độ chặt, không thêm timeout/retry)  [x] có kiểm mới "túi chỉ có đúng một emberpup" (`partyOf(page).species` bằng `["emberpup"]`)  [x] cả bộ e2e qua
- Test đã thêm: không (chỉ rà bản sửa của coder).
