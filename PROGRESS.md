# PROGRESS: T32 Hồi chiêu ăn quả mọng

## Vòng 1: coder
- [x] Bước 1: `EAT_COOLDOWN_MS = 4000` có JSDoc (`packages/shared/src/combat.ts`).
- [x] Bước 2: `HealedMessage.berry?` và chú thích `Healed` (`packages/shared/src/messages.ts`).
- [x] Bước 3: `PlayerControl.nextEatAt` (khởi tạo 0 ở `onJoin`), `eat()` kiểm hết quả, đầy máu, hồi chiêu (cho sớm một tick, im lặng), phát `Healed` có `berry: true` (`packages/server/src/rooms/GameRoom.ts`).
- [x] Bước 4: `Hud` có nút Ăn mới (`eat-label`, `eat-cd`, `eat-secs`), `eatStarted`, `eatReady`, `refuseEat`, `tickEat` (`packages/client/src/ui/hud.ts`).
- [x] Bước 5: `Game.eat()` cho nút và phím H; `Healed` của chính mình bắt đầu đếm; `tickEat` mỗi khung hình (`packages/client/src/game/Game.ts`).
- [x] Bước 6: CSS nút Ăn 44×44, `z-index: 1`, lớp tối, số giây; khối điện thoại không còn ép `min-height` của nút Ăn (`packages/client/index.html`).
- [x] Bước 7: 5 test tích hợp "eating: ..." (`packages/server/src/rooms/GameRoom.test.ts`).
- [x] Bước 8: 1 e2e mới và kiểm nút Ăn trong 3 test bố cục toasts (`tests/e2e/multiplayer.spec.ts`).
- [x] Bước 9: `docs/architecture.md` (3 chỗ).
- [x] Bước 10: `toasts (phone sideways)` qua, không cần phương án dự phòng; e2e mới qua 3/3 khi lặp.
- Lệch kế hoạch: nhóm test A, B, C nằm trong `describe("eating berries")` mới đặt sau `describe("combat")` (dòng 612 thuộc "combat", không phải "party and companions"). Test A, D, E không bị lệch khác.
- Lệnh đã chạy: typecheck ✓, test ✓ (293 test), build ✓, e2e đầy đủ ✓ (29 test, gồm test mới), không còn tiến trình nền.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (293, chạy 2 lần)   build ✓   e2e ✓ (29, --workers=1; e2e Ăn lặp 10/10)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] EAT_COOLDOWN_MS=4000 + JSDoc, BERRY_HEAL=20  [x] thứ tự hết quả, đầy máu, hồi chiêu; lần bị từ chối không đặt lại nextEatAt  [x] nextEatAt trong PlayerControl, khởi tạo 0, không đụng schema/Profile  [x] Healed.berry? khớp server và client  [x] client không gửi khi đang hồi (phím H và nút cùng qua Game.eat)  [x] nút .eat-btn: 44 cao, rộng 46-54, onTop ở 390×844, 844×390, 1280×720; cooling, aria-disabled="true", không dùng disabled, title đúng  [x] docs/architecture.md
- Ảnh đã xem (không commit): /tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/shots/{phone-upright,phone-sideways,desktop}-cooling.png (cùng thư mục có -ready.png). Nút Ăn tối lại kèm số giây, nằm cạnh nút 🔊, không đè HUD.
- Test đã thêm: không (coder đã thêm đủ 5 test tích hợp + 1 e2e).

## Vòng 2: coder
- [x] Lỗi 1: test B kiểm thông báo tăng đúng 1 ở bước "đầy máu" và "hết quả" lúc đang hồi chiêu (`GameRoom.test.ts`).
- [x] Lỗi 2: test mới "eating: one tick early is let through, a little more is not" gọi `eat()` đồng bộ với `nextEatAt = now + TICK_MS` (ăn được) và `+ TICK_MS + 1` (bị bỏ qua).
- [x] `scripts/shots.mjs`: cảnh thú đầu đàn gửi `eat` một lần thay vì 12 lần cách 80 ms.
- Đột biến đã thử: bỏ `- TICK_MS` và đảo thứ tự đầy máu/hồi chiêu, mỗi cái làm 1 test hỏng; đã trả lại code.
- Lệnh đã chạy: typecheck, test, shots (kết quả ở báo cáo cuối).

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (294, chạy 2 lần)   build (không đổi code client)   e2e (không chạy lại, code sản phẩm không đổi)   photo3d (không chạy)
- Code sản phẩm không đổi so với vòng 1 (tổng dòng đổi của GameRoom.ts, client, shared khớp).
- Đột biến trong bản sao ngoài repo: bỏ `- TICK_MS` -> test "one tick early is let through, a little more is not" hỏng; đảo thứ tự kiểm đầy máu/hồi chiêu -> test "only a berry eaten starts the wait; no berries and full health are said first" hỏng.
- `npm run shots -- --only world --name t32r2`: chạy xong, 15 ảnh (ảnh trong shots/, không commit).
