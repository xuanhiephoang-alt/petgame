# PROGRESS: T6 Thông báo không che HUD

## Vòng 1: coder (Phần A: shared + server)
- [x] Bước 1: `NoticeKind` (`"refused" | "done" | "warning" | "reward" | "quest" | "news"`) và `NoticeMessage.kind` (bắt buộc) (`packages/shared/src/messages.ts`)
- [x] Bước 2: `CAPTURE_NEWS_DELAY_MS = 300` (`packages/shared/src/capture.ts`, xuất qua `@petgame/shared`)
- [x] Bước 3: `rewardText` dùng `\xa0` giữa biểu tượng và số/tên (`packages/shared/src/rewards.ts`, `wardrobe.test.ts`)
- [x] Bước 4: `GameRoom.ts`
  - `notify(client, text, kind)` bắt buộc `kind`; `announce(text)` luôn `kind: "news"`, bỏ `delayMs`.
  - 29 lời gọi `notify` đã gắn loại theo bảng Thiết kế 4.
  - `handleThrow`: kinh nghiệm bắt (cộng `ALPHA.xp` nếu thú đầu đàn) trả trong một hẹn giờ `captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS`, tin ★ trước; không đặt hẹn giờ khi không có thú đi theo và không phải thú đầu đàn.
  - `defeatBoss`: `Hạ được trùm! 🏆 ${rewardText({ ...BOSS.reward, wear: prize })}${xpText}`, `kind: "reward"`.
  - Chữ lạnh/nóng đã rút gọn ("hoặc dắt thú hệ lửa/nước").
- [x] Bước 5: `GameRoom.test.ts`: sửa 3 test (kinh nghiệm bắt trả khi bóng khép), thêm 3 test mới (trả sau khi bóng khép không sớm hơn; thả thú trước khi bóng khép thì không học; `every notice says what it is about`), thêm kiểm `kind` ở test lạnh và test trùm.

### Cho phần B/C cần biết
- Giá trị `kind` theo tin: `refused` (từ chối, hết đồ, túi đầy, chỗ dựng trại sai, "Máu đang đầy", "đang nghỉ"...), `done` ("Đã thả", "Đã dựng trại", "Đã làm", "ăn ngon lành"), `warning` (bị ngất, kiệt sức, lạnh, nóng), `reward` ("Trong lúc bạn đi vắng", "Trại đã lên cấp", "Hạ được trùm", "Rương báu"), `quest` ("Xong nhiệm vụ"), `news` (tin ★, qua `announce`).
- Kinh nghiệm bắt thú giờ đến (và tin `LevelUp` nếu có) ở `captureRevealMs + 300 ms` sau khi ném, không còn lúc ném. Bắt thú đầu đàn chỉ còn một `LevelUp` (gộp hai khoản).
- Chữ thưởng trùm mới: `"Hạ được trùm! 🏆 🪵\xa015  🪨\xa025  🫐\xa010  🔵\xa02  🛡️\xa0Giáp hiệp sĩ · Emberpup +250 XP"` (mọi món do `rewardText`, khoảng trắng không ngắt `\xa0`); chữ rương/nhiệm vụ cũng có `\xa0` (e2e nào so chuỗi có "🪵 N" phải đổi).
- Client hiện tại vẫn chạy được (chỉ đọc `text`); `Game.ts` chưa dùng `kind`.
- Lệch kế hoạch: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (257 test, 23 file; các test bắt thú/tin chạy riêng 3 lần ✓), chưa build (không đụng client).

## Vòng 1: coder (Phần B + C: client, e2e, tài liệu)
- [x] Bước 6: `packages/client/src/ui/toastQueue.ts` (`ToastLevel`, `TOAST`, `toastDuration`, `toastRoom`, `ToastQueue`) + `toastQueue.test.ts` (vòng 1 ghi 17 test; sau vòng 2 là 18: thời gian, `toastRoom`, thay thế, `high` không bị thay, trùng chữ, `maxWaiting`, `maxVisible` là hàm, 4 tình huống thật: hạ trùm, bắt thú đầu đàn, thú đầu tiên khi mẹo hiện, lên cấp + 3 phím; hai tình huống đầu kiểm thứ tự và thời gian từ vòng 2).
- [x] Bước 7: `ui/hud.ts`: `.hud-toasts` (role=status, aria-live) cuối `.hud-left`, `showToast(text, level)` (mức bắt buộc), `tickToasts(now)`, `renderToasts()` (làm mờ `.out` 200 ms rồi xoá).
- [x] Bước 8: `game/Game.ts`: `NOTICE_LEVEL`, trường `touch`, mức cho mọi chỗ gọi, mẹo choáng riêng cho cảm ứng, `Notice` theo `kind` (`quest` trễ `QUEST_DELAY_MS`, `?? "low"`), `tickToasts` trong `frame()`.
- [x] Bước 9: `packages/client/index.html`: CSS toast, điện thoại dọc (13 px), điện thoại ngang (cột 300 px, ẩn vùng và dòng Thưởng, thanh trùm 200 px).
- [x] Bước 10: `tests/e2e/multiplayer.spec.ts`: 9 chỗ `.hud-toast` -> `.hud-toasts`, helper `shownToasts`, `toastLayout`, 3 test bố cục (desktop, dọc, ngang), 1 test hàng đợi (bắt + xong nhiệm vụ cùng hiện; lên cấp không bị đẩy).
- [x] Bước 11: `docs/architecture.md` (messages, capture, đoạn "Thông báo và thứ tự tin", ui/, helper e2e).
- [x] Bước 12: ảnh "sau" bằng `toast-shots-after.mjs`, thư mục `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t6/after/` (không commit). Giao nhau thông báo với HUD = 0 và nhãn dưới HUD = 0 ở cả 3 khung hình, cả ba cảnh (single, bossPair, catchPair). Dọc: thông báo y 185-311, nhãn mình y 362. Ngang: cột HUD x 12-312, thông báo y 186-230, thanh trùm x 322-522. Desktop: thông báo x 12-432, y 277-383.
- Lệch kế hoạch: không có. Phần A không sửa.
- Lệnh đã chạy: typecheck ✓, test ✓ (274 test, 24 file), build ✓, e2e đủ bộ ✓ (28 test, 3,0 phút); server/Vite đã tắt.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (274, 24 file; chạy 2 lần đều qua)   build ✓   e2e ✓ (28, `--workers=1`, 3,0 phút, không chập chờn)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] typecheck/test/build/e2e  [x] `.hud-toasts > .toast` dưới ô nhiệm vụ ở 3 khung hình (e2e 25-27)  [x] không giao HUD, tối đa 2 (dọc, desktop) / 1 (ngang)  [x] ngang: cột x 12-312 (<= 322), đáy thông báo 230 (<= 250), thanh trùm x 322-522  [x] mức high/low/trùng chữ (unit 3-12)  [x] hạ trùm/bắt đầu đàn/con thú đầu tiên (unit 11, e2e hàng đợi)  [x] kinh nghiệm bắt trả lúc bóng khép, thả sớm thì không học (GameRoom.test.ts)  [x] `kind` đúng bảng (test "every notice says what it is about")  [x] chữ thưởng trùm dùng U+00A0, không ngắt giữa biểu tượng và số (ảnh)  [x] docs/architecture.md
- Ảnh đã xem (chạy lại `toast-shots-after.mjs` trên code thật): `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t6v1/{portrait-bossPair,landscape-bossPair,desktop-catchPair}-after.png`. Giao với HUD = 0, nhãn dưới HUD = 0; dọc: thông báo y 185-311, nhãn mình y 362; ngang 1 thông báo y 186-230; desktop 2 thông báo y 277-383. Chữ đọc được, tin high không bị cắt, viền vàng có.
- Lưu ý (không phải lỗi của T6): thanh máu trùm vẫn đè hàng máu ở điện thoại dọc (x 78-312, y 12-47) và desktop; đã ghi là T30.
- Test đã thêm: không (coder đã thêm đủ test theo PLAN).

## Vòng 2: coder
- [x] Lỗi 1: `toastQueue.test.ts`: helper `playOut` (chạy các lần đẩy theo bước 10 ms, ghi lúc hiện đầu và lúc hết). Test hạ trùm khẳng định thứ tự `reward, level 8, level 9, quest`, lúc hiện `0, 0, 3000, 3000` và mỗi tin hiện đủ `toastDuration`. Thêm test bắt thú đầu đàn: `caught` 1900, `quest` 2100, tin ★ và lên cấp 2200; thứ tự `caught, quest, news, level`, lúc hiện `1900, 2100, 4900, 5100`, đủ thời gian.
- Kiểm bằng đột biến: đổi `a.at < b.at` thành `a.at > b.at` ở luật chọn cái chờ mạnh nhất thì test hạ trùm hỏng (1 fail / 18); đã trả lại.
- Code sản phẩm không đổi.
- Lệnh đã chạy: typecheck ✓, test ✓.

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (275, 24 file; chạy 2 lần đều qua; `toastQueue.test.ts` 18 test, 2 lần ✓)   build (không chạy, code sản phẩm không đổi)   e2e (không chạy, đã qua ở vòng 1)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] typecheck/test  [x] Test 11 (hạ trùm và bắt đầu đàn kiểm thứ tự + thời gian; luật "chờ lâu nhất vào trước" được giữ)  [x] các tiêu chí còn lại như vòng 1 (code sản phẩm không đổi)
- Đột biến (bản sao tạm ngoài repo, `toastQueue.ts`): đảo `a.at < b.at` ở chọn tin chờ (M1) -> 1 hỏng; đảo ở chọn tin bị bỏ khi quá `maxWaiting` (M8) -> 1 hỏng; tin thường thay được tin cao (bỏ `level !== "high"`) -> 6 hỏng; `<` thành `<=` ở luật thay -> 6 hỏng; cắt `maxMs` thêm 3000 -> 2 hỏng; `maxWaiting + 3` -> 1 hỏng; chọn mức thấp nhất vào trước -> 1 hỏng. Sống sót: `maxWaitMs.high: Infinity` đổi thành 5000 (không test nào kiểm tin cao chờ lâu quá 5 giây vẫn hiện); mức độ thấp, chỉ ghi nhận.
- Test đã thêm: không.

## Vòng 3: coder
- [x] Lỗi 1: `toastQueue.test.ts`, helper `playOut`: `to` giờ theo thông báo mỗi bước còn trong `visible` (`now + 10`), nên thông báo bị gỡ sớm thì `to - from` ngắn lại. Có thêm tham số `room` (số chỗ).
- [x] Thêm tình huống điện thoại ngang (1 chỗ): ba tin `high` cùng lúc 0, hiện lúc 0, 3000, 6000 (tin cuối chờ 6 s), mỗi tin đủ `toastDuration`.
- Kiểm bằng đột biến (đã trả lại sau mỗi lần; code sản phẩm không đổi): (a) cắt thông báo sau 2 s khi hàng chờ trống: 3 test hỏng; (b) `maxWaitMs.high: 5000`: 1 test hỏng; (c) đảo `a.at < b.at`: 1 test hỏng.
- Lệnh đã chạy: typecheck ✓, test ✓.

## Kiểm thử vòng 3: PASS
- typecheck ✓   test ✓ (276, 24 file; chạy 2 lần đều qua; `toastQueue.test.ts` 19 test)   build/e2e (không chạy, code sản phẩm không đổi)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] typecheck/test  [x] Test 11: kiểm thứ tự, lúc hiện và đủ thời gian (`to` nay theo `visible`), có tình huống điện thoại ngang 1 chỗ  [x] các tiêu chí còn lại như vòng 1
- Code sản phẩm: `toastQueue.ts` 146 dòng, các dòng 17/109/134 trùng bản đã đọc ở vòng 2 (cây chưa commit nên không có mốc git để so; mtime file mới hơn nhưng nội dung khớp).
- Đột biến (bản sao tạm): (a) cắt mọi tin sau 2 s khi hàng chờ trống -> 3 hỏng; (b) `maxWaitMs.high: 5000` -> 1 hỏng (vòng 2 còn sống sót, nay bị bắt); (c) đảo `a.at < b.at` chọn tin chờ -> 1 hỏng, ở chọn tin bị bỏ -> 1 hỏng; thay tin cao bằng tin thường -> 7; `<=` ở luật thay -> 7; cắt `maxMs` -> 2; `maxWaiting + 3` -> 1; đảo mức khi chọn -> 1. Không đột biến nào sống sót.
- Test đã thêm: không.
