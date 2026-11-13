# PROGRESS: T62 Điện thoại dọc: thông báo đè tên người chơi

## Vòng 1: coder
- [x] Bước 1: `TOAST.roomyPortraitPx` 790; thêm `portraitToastPx` 61, `gapPx` 4, `nameClearPx` 4, `roomCheckMs` 250; `ToastFit`; `toastRoom(width, height, fit?)` (`packages/client/src/ui/toastQueue.ts`)
- [x] Bước 2: `CAMERA_LEAD_PX`, `PLAYER_TAG_LIFT_PX`, `NAME_TAG_PX`, `HURT_BAR_PX`, `restingNameTop` (`packages/client/src/game/labelLayout.ts`)
- [x] Bước 3: `Game.ts` dùng hằng số cho camera (dòng camera) và nhãn người chơi (2 chỗ `actor.height + PLAYER_TAG_LIFT_PX`); `hud.setNameTop(...)` sau `setMuted`
- [x] Bước 4: `Hud` nhớ `toastSlots`, `measureSlots` mỗi `showToast` và mỗi 250 ms khi có thông báo chờ trong `tickToasts`; `toastFit` là chỗ đọc layout duy nhất (`packages/client/src/ui/hud.ts`)
- [x] Bước 5: chú thích CSS về `NAME_TAG_PX`/`HURT_BAR_PX` (`packages/client/index.html`), không đổi luật CSS
- [x] Bước 6: unit test thêm (không sửa `it` cũ): `toastQueue.test.ts` (4 `it` mới), `labelLayout.test.ts` (`restingNameTop`, 4 số đo)
- [x] Bước 7: e2e thêm `LONGEST_TOASTS`, `UPRIGHT_TOAST_SCREENS` và 3 test `toasts (upright phone, ...)` (`tests/e2e/multiplayer.spec.ts`, chỉ thêm dòng, sau test `short sideways phone (667×375)`)

### Khoảng cách tới tên (đã bị thương, sau khi trượt xong; ổn định qua 5 lần lặp, lag 0)
| Màn | Ô nhiệm vụ, mũ | Số cái | Khoảng cách (px) | Dự kiến |
|---|---|---|---|---|
| 390×760 | q0, không mũ | 1 | +52,6 | +52 |
| 390×760 | q3, mũ phù thủy | 1 | +12,0 | +12 |
| 390×844, tai thỏ 47 | q0, không mũ | 1 | +59,6 | +59 |
| 390×844, tai thỏ 47 | q3, mũ phù thủy | 1 | +19,0 | +19 |
| 390×844 | q0, mũ phù thủy | 2 | +18,4 | +18 |
| 390×844 | q3, mũ phù thủy | 1 | +54,0 | +54 |

Thanh máu giả lập đẩy tên lên đúng trong [7, 9] px ở mọi case.

- Lệch kế hoạch: không có. (Lệnh `--repeat-each` chạy quá giới hạn 10 phút nên chạy lại nền với giới hạn dài hơn; kết quả dưới đây.)
- Không đổi: `TOAST_SCREENS`, `BOSS_SCREENS`, `toastLayout`, `safeArea`, test có sẵn; `git diff` của hai file test chỉ có dòng thêm.
- Lệnh đã chạy:
  - typecheck ✓
  - test ✓ (456 test, 33 file)
  - build ✓
  - `npm run test:e2e` ✓ (54 test, 8,1 phút), gồm 3 test mới
  - `npx playwright test -g "toasts|boss bar|short sideways" --repeat-each=5 --workers=1 --retries=0` ✓ (75/75, 15,5 phút, không chập chờn)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (456, 33 file)   build ✓   e2e ✓ (54, 8,2 phút, gồm 3 test `toasts (upright phone, ...)`)   photo3d (không chạy)
- Lặp: `-g "toasts|boss bar|short sideways|labels" --repeat-each=5 --workers=1 --retries=0` ✓ 80/80 (16 test × 5, 16,2 phút), không chập chờn. (`labels` thêm 1 test so với lệnh của coder.)
- Tiêu chí hoàn thành:
  - [x] typecheck, test, build, toàn bộ e2e sạch
  - [x] `git diff` của `tests/e2e/multiplayer.spec.ts`, `toastQueue.test.ts`, `labelLayout.test.ts` không có dòng xoá nào; `TOAST_SCREENS`, `BOSS_SCREENS`, `toastLayout`, `safeArea` không đổi
  - [x] `toastRoom`: 521-789 → 1; (390, 790) không fit → 2; 4 màn không gọi `fit` (unit đếm); ranh giới 230 / 229,9 đúng
  - [x] `restingNameTop` khớp 4 số đo (unit)
  - [x] E2E mới: 390×760 1 cái (+52,6; +12,0); 390×844 tai thỏ 1 cái (+59,6; +19,0); 390×844 2 cái (+18,4) rồi 1 cái (+54,0); cái thứ hai hiện sau; không chồng HUD
  - [x] Không đổi ngang, desktop (xem dưới), 390×844 ô đầu 2 cái, tai thỏ + thanh trùm 2 cái (test có sẵn qua)
  - [x] Hiệu năng (đọc code, xem dưới)
  - [x] Không còn `- 16` ở dòng camera và `height + 6` ở nhãn người chơi (còn `actor.height + 6` ở nhãn thú đầu đàn, Game.ts:461, đúng kế hoạch: không đổi lift của thú)
  - [x] `docs/design/hud.md` có mốc 790, luật vừa chỗ
- So sánh HEAD với cây làm việc (`git stash push -m "tester T62 compare"`, đo, `stash pop`; `git diff` sau pop trùng từng byte với trước): hộp `.hud-left`, `.hud-quest`, `.hud-toasts` và từng `.toast` ở 1280×800 (2 thông báo: 291-342, 346-397) và 812×375 (1 thông báo: 153,8-197,6) giống hệt, `diff` rỗng. Script đo tạm `tests/e2e/zzcmp.spec.ts` đã xoá.
- Đột biến (mỗi cái hoàn lại, `git diff` trùng bản gốc):
  - a) `restingNameTop` bỏ `HURT_BAR_PX`: bắt bởi unit `restingNameTop > matches the measured name tops`
  - b) `toastRoom` bỏ qua `fit`: unit bắt 3 test (`two only when...`, `boundary`, `fit is only asked`); e2e `toasts (upright phone, 390×844, notch)` và `(390×844)` hỏng ở `toHaveCount(1)` (390×760 vẫn qua vì dưới 790, đúng)
  - c) `roomyPortraitPx` 760: unit bắt `under 790 px...` và `fit is only asked...`
  - d) Hud chỉ đo lần đầu, không đo lại trong `tickToasts`: e2e `toasts (upright phone, 390×844)` hỏng (`Expected: 1, Received: 2`, cache cũ của case mũ phù thủy ô 57 px)
- Hiệu năng: `tickToasts` chỉ đo khi `toastQueue.waiting.length > 0` và ≥ 250 ms từ lần đo trước; `toastFit` (chỗ duy nhất đọc `getBoundingClientRect`, `getComputedStyle`) chỉ chạy khi `toastRoom` gọi `fit` (màn dọc ≥ 790) và có nhân vật; không đọc layout mỗi khung; khi hàng chờ rỗng không tạo object. `showToast` gọi `measureSlots` mỗi thông báo mới (theo kế hoạch). Chưa đo thời gian chạy thật, chỉ đọc code.
- Test đã thêm: không (test của coder đủ cho PLAN.md).
- Lỗi: không.
