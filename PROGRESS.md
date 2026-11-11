# PROGRESS: T19 Phím game vẫn chạy khi hộp thoại hoặc bảng đang mở

## Vòng 1: coder
- [x] Bước 1: `packages/client/src/ui/keyboard.ts`: thêm `KeyGate`, `KeyFocusState`, hàm thuần `worldKeysPaused`, hằng `STILL`. `Keyboard` nhận `gate`, theo dõi thao tác gần nhất (keydown/pointerdown capture) và phần tử nhận focus từ phím (`focusin` capture), có `paused()`. Khi tạm dừng: keydown không chạy hành động, không ghi `held`, không `preventDefault`; keyup vẫn xoá `held` nhưng không chặn mặc định; `direction()` xoá `held` và trả `STILL`.
- [x] Bước 2: `packages/client/src/ui/keyboard.test.ts` (mới): 5 test cho `worldKeysPaused`.
- [x] Bước 3-4: `party.ts` (`dialogOpen`, `element`), `crafting.ts`, `wardrobe.ts` (`element`).
- [x] Bước 5: `packages/client/src/game/Game.ts`: truyền cổng vào `new Keyboard(...)`, dùng lại mảng `panels`.
- [x] Bước 6: `tests/e2e/multiplayer.spec.ts`: test mới `keys: a dialog or a panel the keyboard is in keeps the world's keys, a click does not` (hộp, bảng Thú, Tủ đồ bằng chuột và bằng Tab, Chế tạo).
- [x] Bước 7: `docs/architecture.md`: mô tả `keyboard.ts`.
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (338 test, 28 file), build ✓, test:e2e ✓ (37 test)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (338, 28 file)   build ✓   e2e ✓ (37, cổng 2567/5173 trống)   photo3d (không chạy, không đụng)
- Chạy lại: `npx playwright test -g "keys:" --repeat-each=3 --workers=1` ✓ 3/3 (15.9-16.6 s); không chập chờn.
- Tiêu chí hoàn thành:
  - [x] Hộp xác nhận: Shift+Tab chỉ đổi focus; D, 1, B không gửi `dash/attack/palSkill/placeBase/input`, nhân vật đứng (< 2 px); Space bấm "Giữ lại" (hộp đóng, không `attack`, vẫn 2 thú). Test chỉ phủ D, 1, B, Shift, Space; E, R, H, M, N, W/A/S, mũi tên, 2-3 không có test riêng (cùng đường code trong `keydown`).
  - [x] Bảng Thú/Tủ đồ/Chế tạo với focus do bàn phím: Shift không lướt, Space không đánh, D không đi (test kiểm cả ba bảng).
  - [x] Chuột không dừng phím: Space sau cú bấm tab "Mũ" gửi `attack`, tab vẫn `active`.
  - [x] Escape, Q, C, T: test cũ `party:` (Q, C, Escape, Tab, Enter trong hộp) qua nguyên vẹn; test mới dùng Escape (đóng bảng Thú, Tủ đồ) và C (mở Chế tạo), Enter đóng ✕, rồi D đi lại được (x > 20). T không có test riêng mới (không đổi code).
  - [x] Đang đi thì dừng: `direction()` trả `STILL` và xoá `held` (đọc code); e2e kiểm bằng giữ D khi đã tạm dừng. Không có test "đang đi rồi mới mở hộp" (chưa phủ trực tiếp).
  - [x] `worldKeysPaused` có 5 unit test; `paused()` dùng lại object `focusState`, `STILL` là hằng: không tạo object mới mỗi khung.
  - [x] Không đổi connection.ts, server, shared, CSS (git diff chỉ gồm keyboard.ts, party.ts, crafting.ts, wardrobe.ts, Game.ts, test, docs).
  - [x] Kiểm "không lướt" có ý nghĩa: ở bước Tủ đồ-Tab, test chờ đủ 1000 ms kể từ lúc lướt ở bước 4 (`dashedAt`, > DASH_COOLDOWN_MS 900) rồi mới nhấn Shift, và so số `dash` với n. Bước Bảng Thú (Shift sau 300 ms) đứng ngay sau hộp, chưa có lướt nào trước đó nên cũng có nghĩa.
  - [x] docs/architecture.md cập nhật dòng `keyboard.ts`.
- Chưa làm: kiểm chứng đột biến (bỏ `paused()` rồi xem test hỏng), vì tester không được sửa code sản phẩm.
- Test đã thêm: không (test của coder đủ theo PLAN.md).

## Vòng 2: coder
- [x] Lỗi phải sửa: `keyboard.ts`: listener capture `keydown` chỉ đặt `lastInputKey = true` khi `!e.repeat` (phím tự lặp không phải thao tác mới); sửa JSDoc của `lastInputKey`.
- [x] Test e2e: nối vào test `keys:` đoạn giữ D (hai lần `keyboard.down`, lần hai là keydown lặp), bấm chuột `.confirm-keep`, nhả D, `hold("d")`, kiểm x tăng > 20 (`tests/e2e/multiplayer.spec.ts`).
- [x] Tuỳ chọn: `paused()` dùng vòng `for` thay `panels.some(...)` (không tạo closure mỗi khung); `blur` đặt lại `lastInputKey = false`.
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (338 test), build ✓, test:e2e ✓ (37 test)

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (338)   build ✓   e2e ✓ (37, cổng trống)   photo3d (không chạy)
- Chạy lại `keys:` (`--workers=1`): 3/3, 3/3, 3/3, 8/8 qua; một lần duy nhất hỏng (lần đầu của một đợt `--repeat-each=3` chạy ngay sau bộ e2e đầy đủ, hỏng ở 14.3 s so với ~19 s bình thường), lần chạy lại qua. Không bắt được thông báo lỗi (tôi chỉ đọc dòng tóm tắt), 1 hỏng trong 22 lần chạy: ghi là chập chờn, nghi do máy đang nặng sau bộ e2e dài, chưa xác định được chỗ.
- Kiểm chứng đột biến: kịch bản "giữ D + bấm `.confirm-keep`" của coder QUA khi bỏ `!e.repeat` (không chứng minh gì), vì `page.locator().click()` xong tức thì, không có keydown lặp nào rơi vào giữa pointerdown và lúc focus chuyển. Tôi sửa test (chỉ file test): `mouse.down()`, rồi `keyboard.down("d")` lần hai (lặp, vì phím đang xuống), rồi `mouse.up()`. Kết quả: với code của coder qua; bỏ `!e.repeat` (`this.lastInputKey = true;`) thì HỎNG tại `multiplayer.spec.ts:2217` (x không tăng > 20 sau khi đóng hộp). Đã trả `keyboard.ts` về bản của coder (`cmp` với bản sao khớp, dòng `if (!e.repeat) this.lastInputKey = true;` còn nguyên).
- Test đã sửa: kịch bản cuối của test `keys:` trong `tests/e2e/multiplayer.spec.ts` (bấm chuột tách thành down/up quanh keydown lặp).
- Chưa kiểm chứng đột biến riêng cho `blur` đặt lại `lastInputKey` và vòng `for` trong `paused()` (không có test riêng).

## Vòng 3: coder
- [x] Test e2e `keys:` (`tests/e2e/multiplayer.spec.ts`), giữ nguyên đoạn giữ D của tester:
  - Các phép kiểm "đứng yên" theo vị trí (`still`) đổi thành kiểm tin client gửi: `recordSends` bắt đầu sớm hơn; số tin `input` (và `dash`, `attack`...) không đổi khi giữ D lúc tạm dừng (bước hộp, Tủ đồ-Tab, Chế tạo).
  - Bước "Tủ đồ, focus do chuột": dịch tới chỗ không có thú hoang gần (quét lưới quanh 3150,2500, chọn điểm xa thú hoang nhất, bỏ ô sát chỗ cũ), rồi dịch về `{3150, 2500}` (chỗ đi lại tự do) cho các bước sau. Chờ dịch chuyển chỉ kiểm người chơi đã rời chỗ cũ, vì server đẩy điểm nằm trong vật cản ra ngoài (hai cách chờ chính xác hơn đã làm test hỏng 8/20 và 6/20, 4/20 lần).
  - Kiểm lướt `> 75` dùng `expect.poll`.
- Không đụng code sản phẩm.
- Lệnh đã chạy: typecheck ✓, test ✓ (338 test), test:e2e ✓ (37 test), rồi ngay sau đó `npx playwright test -g "keys:" --repeat-each=20 --workers=1 --retries=0`: 20/20 qua, không lỗi.

## Kiểm thử vòng 3: PASS
- typecheck ✓   test ✓ (338)   build ✓   e2e ✓ (37, cổng trống)   photo3d (không chạy)
- Ngay sau bộ e2e đầy đủ: `npx playwright test -g "keys:" --repeat-each=10 --workers=1 --retries=0` ✓ 10/10 (3.7 phút), không chập chờn.
- Kiểm chứng đột biến (mỗi lần đã trả `keyboard.ts` về bản đã lưu, `cmp` khớp; `keyboard.ts` trước vòng này giống bản vòng 2):
  - `paused()` luôn false (`return false && worldKeysPaused(s)`): test HỎNG tại `multiplayer.spec.ts:2129` (`toEqual`, các tin `dash/attack/palSkill/placeBase/input` bị gửi trong hộp).
  - Bỏ `!e.repeat` (`this.lastInputKey = true;`): test HỎNG tại `multiplayer.spec.ts:2241` (`toBeGreaterThan`, nhân vật không đi lại sau cú bấm chuột giữa lúc phím lặp).
- Test đã thêm: không (test của coder đủ).
