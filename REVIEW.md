PASS
# REVIEW: T2 Thả bớt thú; túi đầy thì không ném bóng (không còn mất thú), vòng 1

## Kết luận

Thay đổi làm đúng và đủ PLAN.md. Server chặn ném bóng khi túi đầy trước khi tung xúc xắc hay trừ bóng xịn, và không còn đường nào bắt được rồi mất thú. Handler `release` kiểm kiểu, chỉ tìm trong túi của người gửi, dọn hết dữ liệu chỉ server giữ về con thú, rồi lưu game. Client chặn ném cùng lý do với server (`throwBlocker` dùng chung). Hộp xác nhận đúng thiết kế: focus, Tab, Escape, khoá 500 ms, nền mờ, nút ≥ 44 px. Không có lỗi phải sửa; các góp ý dưới đây không chặn commit.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Góp ý không bắt buộc

- **Trùng lặp trong e2e.** `tests/e2e/multiplayer.spec.ts`:
  - `party()` ở dòng 489, `send()` ở dòng 499 và đoạn ghi tin gửi đi ở dòng 650-657 (test `party:` đầu tiên) làm đúng việc của `partyOf`, `sendFrom`, `recordSends` (dòng 678-702, tester thêm sau).
  - Đề xuất: chuyển ba helper lên trước test `party:` đầu tiên và dùng chúng trong cả ba test, bỏ bản sao cục bộ.
- **`scheduleSave` trong `release()` chưa có test riêng.** Test "a released pal stays gone after rejoining" (`GameRoom.test.ts:1435`) vẫn qua nếu ai đó xoá `scheduleSave` khỏi `release()`, vì `onLeave` gọi `saveNow`. Muốn kiểm đúng việc lưu mà không cần rời phòng:
  - thả một con, chờ quá `SAVE_DELAY_MS` (khoảng 45 tick);
  - đọc hồ sơ thẳng từ store (`useStore`/`SqliteStore` đã import trong file);
  - kiểm con đó không còn trong hồ sơ.
- **Biến môi trường trong test.** `GameRoom.test.ts:1504-1514` nên nhớ giá trị cũ của `PETGAME_DEBUG` rồi trả lại, thay vì `delete`. Nếu ai đó chạy `PETGAME_DEBUG=1 npm test`, các test chạy sau test này sẽ mất biến đó.
- **Focus khi thả con cuối.** `closeConfirm()` đưa focus về nút chế độ, rồi `render()` ẩn nút đó vì túi trống (`party.ts:200`), nên focus rơi về `body`. Khi nút chế độ bị ẩn, có thể đưa focus sang nút ✕.
- **Focus mất khi danh sách được vẽ lại** (có từ trước, nay dễ thấy hơn ở chế độ thả).
  - Khoá ở `party.ts:188` chứa `xp` của mọi con. Mỗi khi một con làm việc hay con đi theo nhận XP, mọi thẻ được tạo lại, và người dùng bàn phím đang Tab giữa các nút `Thả` bị mất focus.
  - Có thể gộp vào việc P2 về bảng: nhớ id của thẻ đang có focus và trả focus lại sau `render()`.
- **Phím của game vẫn chạy khi hộp mở.** Shift+Tab làm nhân vật lướt; E ném bóng, B đặt trại, Space đánh.
  - PLAN.md đã chấp nhận giữ nguyên lớp `Keyboard`, nên không tính là lỗi.
  - Đề xuất việc riêng: `Keyboard` bỏ qua các phím hành động khi có hộp thoại modal đang mở.
- **Nút chế độ.** `title` luôn là "Chọn thú để thả về thiên nhiên", kể cả khi nút đang ghi "✓ Xong". Với nút có `aria-pressed`, nên giữ nhãn cố định, hoặc đổi `title` theo trạng thái. Việc nhỏ.
- **Tài liệu.** Dòng "Helper" ở `docs/architecture.md:73` chưa nhắc tham số `options` của `openPage`/`join` (màn hình, cảm ứng), cũng chưa nhắc ba helper mới `partyOf`, `sendFrom`, `recordSends`.
- **Cho TASKS.md (agent chính):**
  - P1: hai test chập chờn có từ trước. Tester đã ghi nguyên nhân trong PROGRESS.md: trùm bị dịch vào vật cản, khoảng 7,5%; 30 lần sinh mà không ra Mothlume, khoảng 3,8-5,5%. Gộp lại, khoảng 11% số lần chạy `npm test` hỏng oan.
  - P2: nút cảm ứng dưới 44 px (đề xuất cuối PLAN.md).
  - `.party-panel` là `content-box`, tràn 8 px ở 390×844 khi có từ 7 thú.
  - Tạm dừng phím game khi hộp thoại mở (mục trên).

## Đã xác minh

1. **Mọi chỗ đổi túi thú ở server.** Có 3 chỗ `push` và 1 chỗ `splice`, không chỗ nào để túi vượt `MAX_PARTY`:
   - `debug:givePal` chặn khi đầy;
   - `onJoin` nạp từ hồ sơ, đã cắt ở `MAX_PARTY` trong `sanitizeProfile`;
   - `handleThrow` có `throwBlocker` chặn trước, trong cùng lời gọi đồng bộ;
   - `release` là chỗ `splice`.

   Thứ tự trong `handleThrow` đúng PLAN.md: cooldown, tầm ném, `inBall`, `lastThrowAt`, `throwBlocker`. Câu báo trùm giữ nguyên.
2. **Dọn dữ liệu khi thả.**
   - `despawnCompanion` dọn: companion, `companionTimers`, chiêu chưa bắn, `skillReady`/`skillGapUntil`/`castingUntil`, `lastDamagedAt`, thú hoang đang nhắm nó.
   - `release` dọn thêm: `skillOrder`, `faintedUntil`.
   - Chiêu đã bắn: `land()` bỏ qua chiêu xuất phát từ người dùng chiêu (`FROM_CASTER`), và không cộng XP vì `owned` không còn.
   - Hẹn giờ XP khi bắt thú đầu đàn kiểm `pals.includes(follower)`.
   - Thú hoang bỏ chạy hay nổi giận với một companion đã mất thì tự thôi (`targetPos` trả `undefined`).
   - Hẹn giờ lưu: nếu người chơi đã rời phòng thì `saveNow` không làm gì.
3. **Đồng bộ schema.** Chạy script với Encoder/Decoder thật (`@colyseus/schema` 5.0.36) và `schema.ts`.
   - 12 tình huống `splice`, state phía client đều khớp server: giữa danh sách; con đầu trong 30; con cuối; con duy nhất; `splice` rồi `push` trong cùng một patch (thả rồi bắt trong cùng tick); `splice` rồi sửa phần tử bị dịch chỉ số; sửa rồi `splice` chính nó; hai `splice` trong một patch; thả hết rồi thêm lại 30 con trong một patch.
   - `delete` một companion không tồn tại (thả con đang nghỉ) cũng khớp.
   - Script nằm ngoài repo: `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/review/`.
4. **Client.**
   - Không có callback theo từng phần tử của `pals`; `updateHud` đọc `me.pals` mỗi khung hình. Thanh chiêu tự ẩn khi `activePalId` rỗng.
   - Hộp thoại dựng một lần, listener gắn một lần, hẹn giờ khoá được xoá khi đóng.
   - Mỗi khung hình không tạo thêm object nào đáng kể (chỉ một `some()` khi hộp mở).
   - `z-index` của hộp (5) nằm trên mọi thứ trong HUD (2) và nhãn (1).
5. **Lệnh đã chạy.**
   - `npm run typecheck`: sạch.
   - `npx vitest run packages/shared/src/capture.test.ts packages/server/src/rooms/GameRoom.test.ts -t "throwBlocker|releasing pals|cannot be captured|adds a captured pal"`: 12/12 qua.
   - `npx playwright test -g "party:" --workers=1`: 3/3 qua (1,2 phút). Cổng 2567/5173 trống trước và sau.
   - `grep -rn "cho bớt\|Túi thú đã đầy" packages`: không ra kết quả.
   - Không đổi `schema.ts`, `store.ts`, `Profile`, `constants.ts`, `scripts/shots.mjs`, `playwright.config.ts`.
