# PROGRESS: T53 (GameRoom test server on a free port)

## Vòng 1: coder
- [x] Bước 1: `bootTestServer()` (listen 127.0.0.1 cổng 0, `greet: false`, `gracefullyShutdown: false`), `beforeAll` làm nóng một phòng rồi `cleanup()`, `afterAll` dùng `colyseus?.shutdown()` (`packages/server/src/rooms/GameRoom.test.ts`)
- [x] Bước 2: hạn `15_000` kèm chú thích số đo cho test khí hậu (`GameRoom.test.ts`)
- [x] Bước 3: test tất định của worldgen chỉ sinh 3 thế giới, hạn `15_000` kèm chú thích (`packages/shared/src/worldgen.test.ts`)
- [x] Bước 4: luật cổng trống, làm nóng, hạn riêng có số đo (`docs/architecture.md`, mục Kiểm thử)
- [ ] Bước 5 (dự phòng): không áp dụng, chưa chạy tiêu chí C dưới tải nặng; tester kiểm.
- Kiểm tra check A: `npm test` và `npx vitest run .../GameRoom.test.ts` chạy cùng lúc (cách nhau 3 s): cả hai qua (366/366 và 121/121), không `EADDRINUSE`, `skipped`, `timed out` hay banner Colyseus. (Thời gian chạy trong môi trường này dài, khoảng 130 s mỗi lần, vì hai lần chạy song song.)
- Chưa chạy: B, C, D (tải nặng), e2e. Dành cho tester.
- Lệch kế hoạch: không.
- Lệnh đã chạy: typecheck ✓, test ✓ (366 test, 30 file), build ✓

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (366, 30 file)   build ✓   e2e ✓ (40)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] kiểm A, B, C, D, E đều qua; [x] số test 366 không giảm; [x] log không còn banner Colyseus (grep "Colyseus" = 0 ở mọi log); [x] không đổi `vitest.config.ts`; `git status` chỉ có `GameRoom.test.ts`, `worldgen.test.ts`, `docs/architecture.md`, `PROGRESS.md`. Phần nội dung code/tài liệu để reviewer xét.
- A (hai lần chạy cùng lúc, 3 vòng): 3/3 qua. Mỗi vòng `npm test` 366/366 và `GameRoom.test.ts` 121/121, rc=0, không `EADDRINUSE`, `skipped`, `timed out`, `Error`.
- B (giữ 2568 và 2571): 121/121 qua, không `EADDRINUSE`.
- C (chạy lẻ dưới tải nặng: 8 vòng lặp CPU trên 4 nhân), 12/12 qua; thời gian mỗi lần (ms, `--reporter=verbose`):
  - hurts players in the snow: 4573, 4562, 4538 (hạn 15 s)
  - caught, a pack leader pays the catch XP: 3719, 3789, 3846
  - captured pals keep the wild level: 3618, 3619, 3630
  - with auto off it uses no skill of its own: 3428, 3394, 3448
  Không test nào vượt 5 s ngoài test khí hậu đã có hạn riêng, nên bước 5 (dự phòng) KHÔNG cần áp dụng.
- D (`npm test` + typecheck dưới tải nặng, 3 vòng): 3/3 qua, 366/366, typecheck rc=0 cả 3 vòng, 0 `timed out`/`skipped`.
- E: typecheck sạch, `npm test` rảnh 366/366, build qua.
- E2E (chạy một lần, ngoài kế hoạch): 40/40 qua, không chập chờn.
- Ghi chú: một lần `npm test` mất khoảng 130 s trong môi trường này kể cả khi rảnh (không phải do T53; cả lúc tải nặng chỉ 136 s).
- Test đã thêm: không (sửa hạ tầng test theo kế hoạch). Tiến trình tải đã kill, cổng 2568/2571 đã nhả.

