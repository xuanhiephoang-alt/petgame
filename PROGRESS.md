# PROGRESS: T28 Đánh dấu thú đang nhắm

## Vòng 1: coder, Phần A (mọi thứ trừ vòng ngắm vẽ và nhóm ảnh `aim`)

- [x] Bước 1: `THROW_REACH_SLACK` = 32 (`packages/shared/src/constants.ts`).
- [x] Bước 2: `AIM`, `AimCandidate`, `aimScore`, `throwTarget` (`packages/shared/src/capture.ts`), không cấp phát trong vòng lặp.
- [x] Bước 3: unit test `throwTarget` (bảng ví dụ, giữ con cũ, `count`, trả đúng object, 500 cảnh seed cố định) và `aimScore` (`packages/shared/src/capture.test.ts`).
- [x] Bước 4: `handleThrow` nhận tới `THROW_RANGE + THROW_REACH_SLACK` (`packages/server/src/rooms/GameRoom.ts`).
- [x] Bước 5: `describe("throwing at the aimed pal")` với 2 test tích hợp (`packages/server/src/rooms/GameRoom.test.ts`).
- [x] Bước 6: getter `PalActor.bodyHeight` (`packages/client/src/game/entities.ts`), cho vòng ngắm ở Phần B.
- [x] Bước 8 (`packages/client/src/game/Game.ts`):
  - `PalEntity.aim` và `heldUntil`; `aim` cập nhật `hp`, `maxHp`, `dizzy` trong `onChange`.
  - Handler `CaptureResult` đặt `heldUntil` (trượt: `now + captureRevealMs(shakes)`, bắt được: `Infinity`) cho mọi người ném, khi con đó còn trong `this.pals`.
  - Vòng thú hoang trong `frame()` đổ vào `aimPool`, rồi một lần gọi `throwTarget(focus, aimPool, n, aimedId)` cho nhãn ghim (`labels.update(now, aimed?.tag)`) và `throwBall`. Đổi tên `d` bị che trong khối trùm thành `bossDist`.
  - `throwBall` ném đúng `this.aimedId` (bỏ nếu `now < heldUntil`); không có con nào: trùm trong `THROW_RANGE` thì báo `throwBlocker(0, { boss: true })`, không thì "Không có thú nào ở gần". Không còn gọi `nearestPal` (vẫn giữ cho `attack()`).
  - `debugInfo().aim = { id, x, y }`.
  - Chỗ cho Phần B: ngay sau `throwTarget` trong `frame()` có biến `aimed` (`PalEntity | undefined`, dùng `aimed.actor.pos`, `aimed.actor.bodyHeight`) và `this.aimedId`; `lights()` chưa có đốm sáng. `debugInfo().aim` chưa có `shown` (thêm khi có `AimMarker`; x, y hiện là vị trí `actor.pos` của thú đang nhắm).
- [x] Bước 9 (một phần): test `labels:` đọc `debugInfo().aim.id` thay vì tự tính "gần nhất" (`tests/e2e/multiplayer.spec.ts`).
- [x] Bước 11: `docs/architecture.md` (`capture.ts`, `constants.ts`, `entities.ts` và thú đang nhắm, `handleThrow`, mục kiểm thử về `debugInfo().aim`).
- Lệch kế hoạch: chưa làm (thuộc Phần B cùng vòng ngắm) test e2e `aim:` và helper `spawnFullPal`, nên dòng `spawnFullPal` chưa có trong `docs/architecture.md`; `aimMarker.ts`, đốm sáng ban đêm, nhóm ảnh `aim` ở `scripts/shots.mjs`.
- Lệnh đã chạy: typecheck ✓, test ✓ (387 test), build ✓, `npx playwright test -g "labels:"` ✓

## Vòng 1: coder, Phần B (vòng ngắm vẽ, đốm sáng, e2e `aim:`, nhóm ảnh `aim`)

- [x] `packages/client/src/game/aimMarker.ts` (mới): `AIM_MARKER` (mọi số hiển thị) và `AimMarker`: một `Container` + một `Graphics` dùng chung trong `stage.marks` (không vào số sprite của `stage.objects`), vẽ một lần (4 cung kem viền nâu, 4 mũi chĩa vào), mỗi khung chỉ gán `position`, `scale` (dẹt 0,5), `rotation` (0,8 rad/s), `alpha`, `visible`; thở ±5%, khoá đích 160 ms; bán kính `max(22, 0,6 × bodyHeight)`.
- [x] `Game.ts`: tạo `aimMarker` sau `effects`; `frame()` gọi `show(...)` hoặc `hide()` ngay sau `throwTarget` (ẩn khi không có đích, mất kết nối hoặc không có `me()`); `lights()` thêm một `Light` dùng lại (`aimLight`, bán kính 56, kem, 0,6) ở chân thú đang nhắm; `debugInfo().aim = { id, shown, x, y }`. `Game` không có đường huỷ nên không thêm `destroy` ở đó (`AimMarker.destroy()` có sẵn).
- [x] `spawnFullPal` trong `tests/e2e/multiplayer.spec.ts` (hook `debug:spawnPal { full: true }` đã có ở server) và test `aim:` (điện thoại 390×844, cảm ứng): vòng nằm trên con yếu dù con lành gần hơn; chạm Bắt ném đúng con có vòng; 3 khung sau `captureResult` vòng đã rời con đó; phím E ném đúng con đang có vòng. `docs/architecture.md` cập nhật (`aimMarker.ts`, `spawnFullPal`).
- [x] `scripts/shots.mjs`: nhóm `aim` (`--only aim`, mặc định chạy cùng `world`, `labels`): 6 cảnh desktop + `aim-phone` + `aim-phone-landscape`; in số sprite, vòng hiện hay không, `aim ✓/✗`.
- Lệch kế hoạch:
  - Cảnh ảnh dùng Leafkit ở mọi vùng (con thú hoang ở vùng khác cắn người chơi trong lúc dựng cảnh, ngất rồi về lửa trại); người chơi mặc áo ấm và nón lá (`equip`) để khỏi bị khí hậu làm hại.
  - `aim-meadow-night` ở (3000, 2470) thay vì (3200, 2470): cặp thú của cảnh ban ngày còn đứng ở chỗ cũ và tranh vòng ngắm.
  - Mỗi cảnh thử lại tối đa 6 lần, mỗi lần lùi 70 px về phía bắc, đến khi vòng nằm trên con yếu cả trước lẫn sau lúc chụp (thú hoang có thể cắn, đẩy người chơi).
  - Chưa chạy `--only world` để so số sprite ảnh `world` (chưa cần: chỉ thêm một vòng ngoài `objects`; số sprite `aim` 181-374 là cảnh có nhiều thú đã dựng).
- Ảnh (`shots/t28/aim-*.png`, đã xem), vòng đọc thế nào:
  - Đồng cỏ ngày và đêm: rõ, kem viền nâu nổi trên cỏ; ban đêm đốm sáng làm vòng và con thú sáng lên giữa màu đêm.
  - Tuyết: đọc được nhưng kem trên nền trắng kém nổi hơn, nhờ viền nâu vẫn thấy.
  - Sa mạc: rõ trên cát.
  - Đầm lầy: vòng bị tán cây che một phần ở một lần chụp (vòng nằm lớp `marks` dưới mọi vật đứng, con thú cũng khuất sau tán); đọc được ở lần chụp khác khi con thú đứng ngoài tán.
  - Núi lửa đêm: con thú đứng sát chân núi lửa to, bị vật đó che cả con lẫn vòng; vòng chỉ thấy lấp ló. Vị trí cảnh theo kế hoạch; nếu cần đọc được ở đây thì đổi chỗ cảnh, không đổi vòng.
  - Điện thoại dọc và ngang: vòng đọc được, nhỏ hơn nhưng rõ, không bị nút HUD che (nút Bắt, Đánh ở dưới phải, vòng ở giữa).
- Lệnh đã chạy: typecheck ✓, test ✓ (387 test), build ✓, `npm run test:e2e` ✓ (41 test), `aim:` `--repeat-each=3 --workers=1` ✓ (3/3), `npm run shots -- --name t28 --only aim` ✓ (8 ảnh, `aim ✓` cả 8).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (387, 30 file)   build ✓   e2e ✓ (41)   photo3d (không chạy, không đụng)
- `aim:` và `labels:` chạy `--repeat-each=3 --workers=1`: 6/6 qua (không chập chờn).
- Tiêu chí hoàn thành: [x] typecheck/test/build/e2e sạch; [x] `aim:` 3/3, `labels:` 3/3; [x] 8 ảnh `shots/t28` có `aimShown` và `aimsWeak` đều true; [x] số sprite `world` không tăng do T28 (xem dưới); [x] mutation check; [ ] "vòng đọc được ở mọi ảnh": hai ảnh có ngoại lệ, để reviewer quyết (xem dưới).
- Số sprite `npm run shots -- --name t28w --only world` (sau T28) so với HEAD chạy ở worktree riêng (`--name head`): meadow-day 311/301, dusk 311/302, night 311/301, lake 324/317, snow 233/230, desert 295/206, swamp 305/286, volcano 190/189, volcano-night 190/286, island 162/164, sea-raft 129/130, pal-closeup 309/303, phone 304/307, phone-swamp 280/285, phone-lake 379/379. Hai lần chạy trên cùng HEAD-ish lệch nhau tới ~100 (desert, volcano-night, island: thú hoang đi lang thang, cây đổi theo khung), nên chênh lệch là nhiễu do cảnh, không phải do T28; vòng ngắm nằm trong `stage.marks`, không tính vào `objects`. `shots/now/report.json` là bản cũ (ngày 11/11), không dùng để so. Không có ảnh nào gần ngân sách 600.
- Mutation check (đã khôi phục, `cmp` giống hệt bản gốc):
  - `aimScore` bỏ thưởng hurt/dizzy (`return d;`): `capture.test.ts` hỏng 3 test (bảng thiết kế "prefers hurt and dizzy pals when nearly as close", "gives a dizzy pal only the dizzy bonus", "aimScore is the distance minus the dizzy or hurt bonus").
  - Server bỏ `+ THROW_REACH_SLACK` ở `handleThrow` (GameRoom.ts:930): hỏng "throwing at the aimed pal > accepts a throw a little beyond THROW_RANGE ..." (`message 'captureResult' was not called`).
- Quan sát ảnh (đã Read):
  - `shots/t28/aim-swamp.png`: hai Leafkit (Lv 3, Lv 6) đứng sát nhau dưới tán liễu; chỉ thấy một cung kem nhỏ lộ ra ở mép phải tán, cạnh Lv 6 (khoảng x 755, y 430), phần còn lại của vòng bị tán che. Cả hai nhãn "Lv 3 Leafkit" và "Lv 6 Leafkit" đều hiện cùng kiểu (tên + thanh máu), mắt thường không phân biệt được nhãn nào là nhãn ghim; cung lộ ra là dấu duy nhất cho biết con nào. Người chơi ở đây chỉ chắc chắn nhờ cung nhỏ đó. (`aimShown` true, `aimsWeak` true theo báo cáo.)
  - `shots/t28/aim-volcano-night.png`: chỉ một Leafkit Lv 1 đứng sát chân núi lửa, thân bị núi che gần hết; một vệt kem lấp ló cạnh chân (khoảng x 680, y 370). Chỉ có một con có nhãn ("Lv 1 Leafkit" ở x 710, y 288, nằm trên núi, đọc được) nên người chơi biết con nào được nhắm dù vòng bị che, vì không có thú khác trong tầm. Khi có nhiều thú ở đây thì sẽ giống ca đầm lầy.
  - Nhãn ghim có thật trong code (`labels.update(now, aimed?.tag)`, Game.ts:1032) nhưng chưa có dấu hiệu thị giác riêng (cùng kiểu nhãn) trong ảnh; reviewer cân nhắc.
- Lỗi: không có. Test đã thêm: không (đủ theo PLAN, mutation xác nhận test bắt được lỗi). Không commit.

## Vòng 2: coder (sửa lỗi của reviewer vòng 1)

- [x] Lỗi phải sửa: cảnh vật che con đang nhắm và vòng của nó.
  - `packages/client/src/game/canopy.ts` (mới): `canopyHides` (phép kiểm hình chữ nhật của tán cây, tách ra từ `Scenery.update`) và `boxHides` (điểm đứng sau một hình hộp, cho núi lửa). Test: `canopy.test.ts` (4 test).
  - `scenery.ts`: `update(view, t, focus, dt, aimAt?)`: một tán cây trong suốt khi che người chơi hoặc che chân thú đang nhắm (cùng hàm, gọi hai lần). Hình nón núi lửa lưu ở `cone`, có `coneFade` làm mờ cùng hệ số 0,15, alpha thấp nhất 0,4, khi che người chơi hoặc thú đang nhắm. Không tạo object mới mỗi khung.
  - `Game.ts`: truyền `aimed?.actor.pos` vào `scenery.update` (đã chạy sau `throwTarget`).
- [x] Góp ý nhỏ: chú thích `THROW_REACH_SLACK` ("half a patch interval, a network round trip"); `shots.mjs` thử lại lùi 260 px mỗi lần (ngoài tầm ném).
- Ảnh chụp lại ở đúng vị trí kế hoạch (`npm run shots -- --name t28 --only aim`, 8 ảnh, `aim ✓` cả 8), đã xem `aim-swamp` và `aim-volcano-night`:
  - `aim-swamp`: con đang nhắm (Lv 5 Leafkit) hiện rõ giữa tán liễu đã mờ đi, vòng kem nhìn thấy dưới chân.
  - `aim-volcano-night`: hình nón mờ đi, con đang nhắm và vòng thấy rõ trước sườn núi. Người chơi đứng sau núi cũng hết bị che.
  - Các ảnh khác chụp lại cùng lượt, không đổi cách vẽ.
- Chưa thêm e2e đo số tán mờ: kiểm bằng test hàm thuần `canopyHides`/`boxHides` và ảnh.
- Lệnh đã chạy: typecheck ✓, test ✓ (391 test), build ✓, `npm run test:e2e` ✓ (41 test), shots aim ✓.

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (391, 31 file)   build ✓   e2e ✓ (41)   photo3d (không chạy)
- `npm run shots -- --name t28 --only aim`: 8 ảnh, `aim ✓` cả 8; sprite 192-366 (< 600).
- Ảnh (đã Read, 8/8), con bị nhắm và vòng có thấy rõ không:
  - aim-meadow, aim-meadow-night, aim-desert, aim-phone, aim-phone-landscape: con và vòng rõ, không bị gì che (ban đêm có đốm sáng).
  - aim-snow: con rõ; nửa dưới vòng bị tảng đá phủ tuyết ở chân che một phần, nửa trên và các mũi vẫn thấy; đọc được.
  - aim-swamp: con Lv 2 Leafkit rõ, tán cây gần đó không còn che nó; vòng chỉ thấy một đoạn cung kem nhỏ bên phải chân (khoảng x 700, y 410), phần còn lại bị đầu đàn Bogbloom, bóng lilypad và hiệu ứng che/trộn. Nhãn "Lv 2 Leafkit" ghim phía trên. Đọc được nhưng vòng yếu, con bị nhắm xác định nhờ nhãn kề bên. Có thêm một Leafkit mờ phía sau tán (tán đang mờ đi để lộ nó).
  - aim-volcano-night: con Lv 4 Leafkit rõ, hình núi lửa đã mờ đi (thấy dung nham qua); vòng thấy được nhưng bị chia nhỏ bởi nền đá, mũi chĩa và cung kem lộ rõ ở dưới chân. Cải thiện rõ so với vòng 1.
- Mutation (đã khôi phục, `cmp` giống hệt): `Scenery.update` bỏ `aimAt` (chỉ dùng `focus`, dòng 361 và 374): `tsc -p packages/client` báo `TS6133 'aimAt' is declared but its value is never read` (typecheck bắt). Vitest toàn client vẫn qua 76/76 và không có test e2e nào kiểm tra tán mờ theo thú bị nhắm: ngoài lỗi typecheck do tham số không dùng, không test hành vi nào bắt được. Nghĩa là nối `aimAt` vào `canopyHides`/`boxHides` bên trong `Scenery.update` không có test; `canopy.test.ts` chỉ phủ hàm thuần `canopyHides`/`boxHides`. Nếu gọi lệch (ví dụ truyền sai toạ độ) thì chỉ ảnh `aim-swamp`/`aim-volcano-night` mới lộ.
- Lỗi: không có. Test đã thêm: không. Không commit.
