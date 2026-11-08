# PROGRESS: T37 Hai test e2e nhắm đúng con thú

## Vòng 1: coder
- [x] Bước 1: thêm helper `spawnWeakPal`, `throwingAt` sau `sendFrom` (`tests/e2e/multiplayer.spec.ts`).
- [x] Bước 2: test toasts (T36) dùng hai helper, hành vi giữ nguyên.
- [x] Bước 3: test "party: let a pal go..." dùng `spawnWeakPal`.
- [x] Bước 4: test thú đi theo: một Emberpup, chỉ ném qua `throwingAt`, kiểm `["emberpup"]`, `🐾 Thú (1)`, sau tải lại `pals` bằng 1; bỏ vòng ném "con gần nhất", `sleep(500)`, `waitForTimeout(1500)`, `caught`, `partySize`.
- [x] Bước 5: test gameplay: chặt cây chỉ bấm khi không thú hoang nào trong 100 px (poll 60 s); đánh choáng đứng đúng chỗ con thú debug (`debug:teleport`, khoảng cách < 1 px), kiểm theo id; bỏ `dizzyPals` và chờ 800 ms.
- [x] Bước 6: dòng "Helper" trong `docs/architecture.md`: hai helper mới và câu về thú hoang trong e2e.
- Lệch kế hoạch: không.
- Lệnh đã chạy: typecheck ✓; e2e "a captured pal follows" lặp 30/30 ✓; e2e "gameplay: chop a tree" lặp 30/30 ✓; cả bộ e2e 31/31 ✓ (test toasts và party nằm trong đó). Chưa chạy `npm test` và các lần lặp 10/3 của test toasts/party (dành cho tester).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (294)   build (không chạy, chỉ đổi test)   e2e ✓ (31/31, --workers=1)   photo3d (không chạy)
- Lặp riêng (--workers=1): "a captured pal follows" 30/30; "gameplay: chop a tree" 30/30; toasts (T36) 10/10; "party: let a pal go" 3/3.
- Diff chỉ gồm `tests/e2e/multiplayer.spec.ts`, `docs/architecture.md`, `PROGRESS.md`; không có code sản phẩm.
- Đối chiếu: giữ ý định và độ chặt; chờ "không thú hoang trong 100 px" có timeout 60 s như PLAN; `spawnWeakPal`/`throwingAt` dùng chung cho 3 test, không lặp code.
- Test đã thêm: không (chỉ sửa test sẵn có).
