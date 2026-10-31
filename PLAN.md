# PLAN: T2 Thả bớt thú; túi đầy thì không ném bóng (không còn mất thú vừa bắt)

## Mục tiêu

- **Không còn mất thú.** Hiện túi đầy (30 con, `MAX_PARTY`) mà bắt thú thường vẫn "thành công": thú hoang bị xoá khỏi thế giới rồi chỉ hiện "Túi thú đã đầy" (`GameRoom.ts:808-835`), nên người chơi mất cả công đánh choáng lẫn con thú. Sau nhiệm vụ này, túi đầy thì không ném được bóng (cả thú thường lẫn thú đầu đàn). Thú hoang không bị động tới, bóng xịn không bị trừ, và người chơi được báo rõ cách khắc phục.
- **Thả bớt được thú.** Bảng 🐾 Thú có chế độ "🕊️ Thả bớt" và hộp xác nhận, dùng được bằng cảm ứng lẫn bàn phím. Câu thông báo cũ "cho bớt thú đi" (`GameRoom.ts:786`) bảo người chơi làm một việc chưa làm được; nay câu mới chỉ đúng nút để bấm.
- Khi túi đầy, nút 🐾 Thú hiện "(30/30)" trên nền vàng, để người chơi thả bớt trước khi đánh choáng con mới (choáng chỉ kéo dài 6 giây, `DIZZY_MS`).

## Phạm vi

Làm:
1. Shared: `throwBlocker` và `PARTY_FULL_TEXT` trong `capture.ts` (+ test); `ClientMessage.Release` và `ReleaseMessage` trong `messages.ts`.
2. Server: handler `release` có kiểm tra; `handleThrow` chặn ném khi túi đầy (trước khi tung xúc xắc hay trừ bóng xịn), bỏ nhánh "bắt được rồi mất"; `debug:givePal` báo cùng câu khi túi đầy.
3. Client:
   - `ui/party.ts`: tiêu đề có số thú, nút chế độ thả, nút "Thả" trên thẻ, hộp xác nhận, nút 🐾 báo đầy, chữ khi túi trống;
   - `game/Game.ts`: gửi `release`; `throwBall` hỏi `throwBlocker` trước khi ném;
   - CSS trong `index.html`.
4. Test: unit (shared), tích hợp (`GameRoom.test.ts`), một test e2e mới.
5. Tài liệu: `docs/architecture.md` (2 dòng). `docs/design/pals.md` đã được game-designer cập nhật (mục "Túi thú và thả thú"); coder không cần sửa.

KHÔNG làm:
- Không đổi `schema.ts`, `Profile`, `emptyProfile`, `sanitizeProfile`, `store.ts`. Không thêm `ServerMessage` mới (dùng `Notice`). Không đổi `MAX_PARTY`.
- Không có phần thưởng khi thả, không rơi đồ, không biến thú được thả thành thú hoang, không có kho thú ở trại, không chọn nhiều con một lúc, không trao đổi thú.
- Không thêm hiệu ứng, âm thanh khi thả.
- Không sửa kích thước các nút có sẵn dưới 44 px (`.party-action` 36 px, `.party-close` cao 32 px...); đề xuất thành việc riêng ở cuối file. Chỉ các nút **mới** phải ≥ 44×44 px.
- Không đổi cách focus khi mở bảng bằng phím Q. Không đổi vị trí hay độ dài toast (T6). Không gom chữ hiển thị (T12). Không thêm cờ đầu đàn (T8).
- Không sửa `scripts/shots.mjs`, `playwright.config.ts`.

## Thiết kế

### Luật

| Tình huống | Kết quả |
|---|---|
| Ném bóng khi `pals.length >= MAX_PARTY`, vào thú thường hoặc thú đầu đàn | Không ném. Client hiện toast `PARTY_FULL_TEXT` và không gửi tin `throw`. Nếu tin vẫn tới server (client sửa đổi, hoặc trạng thái client trễ), server từ chối với cùng câu: không gửi `CaptureResult`, không tung xúc xắc, không trừ bóng xịn, thú hoang không bị động tới (không vào bóng, không nổi giận). |
| Ném bóng vào trùm | Như cũ: "Không thể bắt trùm! Hãy cùng nhau hạ nó". Câu này chuyển vào `throwBlocker`, nên client cũng báo ngay. |
| Thả một con (đang nghỉ, đi theo, làm việc ở trại, kiệt sức, hoặc con cuối) | Được, sau khi xác nhận. Con đó rời túi và thế giới ngay, không hoàn lại gì. |
| Thả con đang đi theo | Hết thú đi theo (`activePalId = ""`), thanh chiêu tự ẩn. Lần bắt tới, con mới tự đi theo như lần bắt đầu tiên (`GameRoom.ts:821-822`, giữ nguyên). |
| Thả con đang làm việc | Rời trại; các con làm việc còn lại tự đi tới chỗ mới (`workSpotFor` theo thứ tự, giống khi bấm "Nghỉ"). |
| Thả con cuối cùng | Được (người chơi mới cũng bắt đầu với 0 thú, không cơ chế nào cần ≥ 1 con). Hộp xác nhận có thêm dòng cảnh báo. |

**Vì sao không hoàn lại gì.** Bóng thường không giới hạn. Bắt một Leafkit cấp 1 gần lửa trại mất khoảng 3,5 giây:
- 40 máu, 4 đòn × 400 ms = 1,6 giây;
- 96% bắt được khi choáng;
- bóng lắc 1,9 giây.

Tính bằng `captureChance`, `levelCatchRate`, `captureRevealMs`. Cộng thời gian đi lại thì khoảng 6 lần bắt mỗi phút. Thưởng 1 quả mọng mỗi lần thả đã ra khoảng 6 quả/phút, ngang hái vài bụi quả (2-4 quả mỗi bụi, mọc lại sau 90 giây). Vì vậy phần thưởng nào khi thả cũng thành vòng lặp bắt rồi thả.

**Kinh nghiệm khi bắt (lưu ý cho T4).** Thả bớt nghĩa là bắt thú không còn bị chặn ở 30 con, nên thú đi theo nhận `XP_PER_CAPTURE` (25) mỗi lần bắt mãi mãi. Không phải lỗ hổng: khoảng 25 XP mỗi 10 giây vẫn thấp hơn đánh liên tục (4 XP mỗi đòn của thú đi theo, khoảng 1 đòn/giây).

### Luồng trên bảng 🐾 Thú

Bảng thường không đổi (các nút Đi theo / Làm việc / Cho về / Nghỉ / Cho ăn như cũ). Thêm:

1. **Tiêu đề** `Túi thú n/30` thay cho "Thú của bạn". Cạnh tiêu đề là nút chế độ `🕊️ Thả bớt`, rồi tới nút ✕. Nút chế độ ẩn khi túi trống.
2. Bấm `🕊️ Thả bớt`:
   - nút đổi thành `✓ Xong` (class `on`, `aria-pressed="true"`);
   - đầu danh sách hiện gợi ý (đỏ) thay cho gợi ý đặt trại;
   - mỗi thẻ giữ nguyên ảnh, tên, cấp, trạng thái, chiêu, thanh XP, nhưng cột nút chỉ còn một nút đỏ `Thả`.
   
   Bấm `✓ Xong` thì về bảng thường. **Đóng bảng (✕, Q, Escape, hay mở bảng khác) thì chế độ thả tự tắt**, nên lần mở sau luôn là bảng thường.
3. Bấm `Thả` trên một thẻ thì mở **hộp xác nhận** giữa màn hình, kèm nền mờ che toàn màn hình. Nền mờ chặn chạm vào joystick và các nút phía sau; chạm vào nền mờ là huỷ.
   - Trong hộp: ảnh thú (dùng lại `party-swatch`), tiêu đề, dòng chính, dòng trạng thái (nếu có), dòng cảnh báo con cuối (nếu có), hai nút `Giữ lại` (xám) và `Thả` (đỏ), theo thứ tự đó từ trái sang phải.
   - Focus mặc định ở `Giữ lại`, nên Enter vô tình (hay giữ phím Enter) là huỷ.
   - **Nút `Thả` trong hộp bị khoá (`disabled`) 500 ms đầu** (`CONFIRM_ARM_MS`). Nếu không, chạm đúp vào nút `Thả` trên thẻ có thể trúng luôn nút `Thả` trong hộp: trên điện thoại dọc, cột nút của thẻ (x khoảng 290-366) chồng lên nút phải của hộp (x khoảng 243-339). Chạm đúp thường dưới 300 ms.
4. Bấm `Thả` trong hộp:
   - hộp đóng ngay, client gửi `release`, focus về nút chế độ;
   - server gỡ thú và gửi `Notice` "Đã thả Pebblet. Tạm biệt! 👋";
   - thẻ biến mất khi patch tới; vẫn ở chế độ thả để thả tiếp.
   
   Thả hết thì bảng hiện chữ túi trống, chế độ thả tắt, nút chế độ ẩn.
5. Hộp đang mở mà con thú đó không còn trong túi thì hộp tự đóng.

**Bàn phím:**
- Q mở bảng. Tab tới `🕊️ Thả bớt` rồi Enter. Tab tới `Thả` của một thẻ rồi Enter.
- Trong hộp: focus ở `Giữ lại`; Tab và Shift+Tab đổi qua lại giữa hai nút (chỉ hai nút này, không thoát ra ngoài; nút `Thả` còn khoá thì focus đứng yên). Enter bấm nút đang focus.
- **Escape khi hộp mở thì chỉ đóng hộp** (bảng vẫn mở); Escape lần nữa mới đóng bảng. Q khi hộp mở thì đóng cả bảng lẫn hộp.
- Space là phím đánh của game: lớp `Keyboard` chặn Space trên nút (`keyboard.ts:9-11`). Đây là hành vi có sẵn, không đổi, nên không dùng Space để bấm nút trong bảng.

### Chữ hiển thị (tiếng Việt)

| Chỗ | Chữ |
|---|---|
| Nút HUD, dưới 30 con | `🐾 Thú (n)` (như cũ) |
| Nút HUD, đủ 30 con | `🐾 Thú (30/30)` + class `full` (nền vàng) |
| Tiêu đề bảng | `Túi thú n/30` |
| Nút chế độ, tắt / bật | `🕊️ Thả bớt` / `✓ Xong`; `title`: "Chọn thú để thả về thiên nhiên" |
| Gợi ý khi bật chế độ | `Chọn thú muốn thả. Thú được thả sẽ về với thiên nhiên và không quay lại.` |
| Nút trên thẻ | `Thả`; `aria-label`: `Thả Pebblet · Lv 2` |
| Hộp: tiêu đề | `Thả Pebblet · Lv 2?` |
| Hộp: dòng chính | `Nó sẽ về với thiên nhiên, không quay lại và không để lại gì.` |
| Hộp: trạng thái (ẩn khi đang nghỉ) | đi theo: `Đang đi theo bạn.`; làm việc: `Đang làm việc ở trại.` |
| Hộp: con cuối (đỏ, đậm) | `Đây là con thú cuối cùng của bạn.` |
| Hộp: hai nút | `Giữ lại` / `Thả` |
| Notice của server khi thả | `Đã thả Pebblet. Tạm biệt! 👋` |
| Túi đầy (`PARTY_FULL_TEXT`, client và server) | `Túi thú đầy (30/30): mở 🐾 Thú và bấm 🕊️ Thả bớt` |
| Trùm (giữ nguyên chữ cũ) | `Không thể bắt trùm! Hãy cùng nhau hạ nó` |
| Túi trống (thay câu "Chưa bắt được thú nào..." vì sai sau khi thả hết) | `Túi đang trống. Đánh đến khi thú choáng 💫 rồi ném bóng để bắt!` |

Số 30 trong các câu lấy từ `MAX_PARTY`, không viết cứng.

### Bố cục và kích thước chạm

- Nút mới đều ≥ 44×44 px ở 390×844, 844×390 và 1280×720: nút chế độ, nút `Thả` trên thẻ, hai nút trong hộp.
- Tiêu đề rút thành `Túi thú n/30` (khoảng 120 px) để vừa một hàng với nút chế độ (khoảng 100 px) và ✕ (44 px) trong 300 px của bảng trên điện thoại dọc.
- Hộp rộng `min(320px, 100%)` trong nền mờ có padding 16 px; cao khoảng 220 px, vừa màn hình ngang 390 px.

### Kiểm tra phía server

- Kiểu: handler chỉ gọi `release` khi `typeof message?.palId === "string"`. Payload thiếu, sai kiểu, hay `undefined` thì bỏ qua.
- Id lạ, hoặc id thú của người khác: server chỉ tìm trong túi của người gửi (`player.pals.findIndex`), không thấy thì bỏ qua **im lặng**. Không gửi notice, để không lộ thông tin và không thành kênh spam notice.
- Spam: không cần cooldown riêng. Tin không hợp lệ chỉ tốn một lần duyệt tối đa 30 phần tử. Tin hợp lệ thì gỡ một con, nên mỗi người chơi có tối đa 30 lần thả thật (mỗi lần một notice). Thả chỉ làm người gửi mất thú, không được gì, nên không có động cơ gian lận.
- Ném bóng: lần ném bị `throwBlocker` từ chối **vẫn tính thời gian chờ ném** (`lastThrowAt = now`), nên notice từ chối tối đa khoảng 1,25 lần/giây mỗi người. Client bình thường không gửi khi bị chặn, nên người chơi thật không thấy khác.
- Không có khe hở giữa kiểm tra và thêm thú: `handleThrow` chạy đồng bộ (kiểm tra, tung xúc xắc, `removePal`, `push` trong cùng một lời gọi, không `await`, không hẹn giờ). Bóng lắc chỉ là hình ảnh, kết quả đã quyết lúc ném. Vì vậy bỏ hẳn nhánh `else { notify("Túi thú đã đầy") }`.
- Những chỗ khác thêm thú vào túi (đã rà):
  - `quests.ts` và `rewards.ts`: `Reward` chỉ có tài nguyên, vật phẩm, đồ mặc, không có thú;
  - rương và trùm: không cho thú;
  - `onJoin`: nạp từ hồ sơ đã qua `sanitizeProfile`, cắt ở `MAX_PARTY`;
  - `debug:givePal`: đã chặn khi đầy nhưng im lặng; nay báo `PARTY_FULL_TEXT` (chỉ có khi `PETGAME_DEBUG=1`).
- Dọn dữ liệu chỉ server có khi thả: `despawnCompanion` đã dọn companion, timers, casts chưa bắn, `forgetSkills`, `lastDamagedAt`, thú hoang đang nhắm nó. Thêm:
  - `faintedUntil.delete(id)`: map này hiện không bao giờ được dọn;
  - `control.skillOrder = undefined` nếu lệnh chiêu đang dành cho con này.
  
  Chiêu đã bắn vẫn bay tiếp và trúng, vì `land` đã kiểm `owned` trước khi cộng XP (`GameRoom.ts:1307, 1348`). Hẹn giờ XP thú đầu đàn đã kiểm `pals.includes(follower)` (`GameRoom.ts:829`).

## Kế hoạch triển khai

1. **`packages/shared/src/capture.ts`**
   - `import { MAX_PARTY } from "./constants.ts";`
   - Thêm hằng số và hàm (có JSDoc tiếng Anh):
     ```ts
     /** What a player is told when their party is full (MAX_PARTY): no ball is thrown. */
     export const PARTY_FULL_TEXT = `Túi thú đầy (${MAX_PARTY}/${MAX_PARTY}): mở 🐾 Thú và bấm 🕊️ Thả bớt`;

     /**
      * Why a ball cannot be thrown at this wild pal, or undefined if it can: the boss is never caught,
      * and a full party has no room. Shared so the client refuses, without throwing, exactly what the server would.
      */
     export function throwBlocker(partySize: number, target: { boss: boolean }): string | undefined
     ```
     Thứ tự: `target.boss` trả câu trùm (giữ nguyên chữ hiện ở `GameRoom.ts:785`); `partySize >= MAX_PARTY` trả `PARTY_FULL_TEXT`; còn lại `undefined`. Thú đầu đàn không có nhánh riêng.

2. **`packages/shared/src/capture.test.ts`**: `describe("throwBlocker")`, xem mục Test.

3. **`packages/shared/src/messages.ts`**
   - Trong `ClientMessage`, sau `PalAuto`: `/** Let one of the player's pals go for good (the party panel asks first). */ Release: "release",`
   - Thêm `export interface ReleaseMessage { /** OwnedPal id from the player's party. */ palId: string; }`.

4. **`packages/server/src/rooms/GameRoom.ts`**
   - a. Import thêm `PARTY_FULL_TEXT`, `throwBlocker`, `type ReleaseMessage`. `MAX_PARTY` vẫn dùng ở `debug:givePal`.
   - b. Đăng ký handler cạnh `Summon`/`Assign` (khoảng dòng 349-356):
     ```ts
     this.onMessage(ClientMessage.Release, (client, message: ReleaseMessage) => {
       if (typeof message?.palId === "string") this.release(client, message.palId);
     });
     ```
   - c. **`handleThrow` (777-840)**, thứ tự kiểm tra mới (đây là phần quan trọng):
     ```ts
     if (!player || !control || !pal) return;
     const now = this.clock.currentTime;
     if (now - control.lastThrowAt < THROW_COOLDOWN_MS) return;
     if (distance(player, pal) > THROW_RANGE) return;
     if (this.inBall.has(palId)) return;
     control.lastThrowAt = now; // a refused throw waits out the cooldown too: refusals cannot flood notices
     // The boss is never caught and a full party has no room: refuse before any roll or great ball is used.
     const blocker = throwBlocker(player.pals.length, pal);
     if (blocker) return this.notify(client, blocker);
     ```
     - Xoá dòng 785 (trùm) và 786 (đầu đàn, "cho bớt thú đi"); cả hai nay nằm trong `throwBlocker`. Dòng `control.lastThrowAt = now` cũ (788) thay bằng dòng ở trên.
     - Nhánh `success`: bỏ `if (player.pals.length < MAX_PARTY) { ... } else { this.notify(client, "Túi thú đã đầy"); }`, giữ nguyên thân khối `if` (tạo `OwnedPal`, `push`, XP, `summon`, nhiệm vụ, thú đầu đàn). Thêm chú thích ngắn: đã kiểm còn chỗ ở trên, trong cùng lời gọi.
     - Còn lại không đổi (tỉ lệ, bóng xịn, `inBall`, `CaptureResult`).
   - d. **Hàm mới `release`**, đặt ngay sau `rest()` (dòng 891-899):
     ```ts
     /** Lets one of the player's pals go for good (the party panel asks first): it leaves the party and the world, nothing is given back. */
     private release(client: Client, ownedId: string) {
       const player = this.state.players.get(client.sessionId);
       const index = player ? player.pals.findIndex((p) => p.id === ownedId) : -1;
       if (!player || index < 0) return; // not one of theirs: ignored quietly
       const owned = player.pals[index];
       if (player.activePalId === ownedId) player.activePalId = "";
       this.despawnCompanion(ownedId);
       const control = this.controls.get(client.sessionId);
       if (control?.skillOrder?.companionId === ownedId) control.skillOrder = undefined;
       this.faintedUntil.delete(ownedId);
       player.pals.splice(index, 1);
       this.notify(client, `Đã thả ${getSpecies(owned.speciesId).name}. Tạm biệt! 👋`);
       this.scheduleSave(client.sessionId);
     }
     ```
     Không gọi `rest()` trước `splice`, vì `rest()` sẽ đổi `assignment` của phần tử sắp bị xoá, một thao tác thừa. Đã kiểm bằng Encoder/Decoder của `@colyseus/schema` 5.0.36: `splice` phần tử giữa, đổi rồi xoá trong cùng tick, đổi phần tử sau khi chỉ số dịch đều đồng bộ đúng sang client.
   - e. **`debug:givePal` (418-420)**: tách điều kiện thành `if (!player) return;` và `if (player.pals.length >= MAX_PARTY) return this.notify(client, PARTY_FULL_TEXT);`.

5. **`packages/client/src/ui/party.ts`**
   - Import thêm `MAX_PARTY`. Hằng số module `/** The release button in the confirm dialog stays locked this long, so a double tap on a card's button cannot confirm. */ const CONFIRM_ARM_MS = 500;`
   - `PartyActions`: thêm `release(palId: string): void;`.
   - Trường mới:
     - `title` (`strong.party-title`), `releaseToggle` (`button.party-release-toggle`), `releasing = false`;
     - tham số của lần `update` gần nhất: `party`, `hasBase`, `snacks`;
     - phần tử hộp: `confirm` (nền mờ `div.party-confirm`), `confirmHead`, `confirmTitle` (`strong#party-confirm-title`), `confirmStatus`, `confirmWarn` (`p`), `keepButton` (`button.confirm-keep`), `releaseButton` (`button.confirm-release`);
     - `confirmId = ""`, `armTimer = 0`.
   - Constructor:
     - Header gồm `title`, `releaseToggle`, `close`. Bấm toggle thì gọi `setReleasing(!this.releasing)`.
     - Dựng hộp **một lần**, gắn vào `parent` sau panel: `parent.append(this.button, this.panel, this.confirm)`. Cấu trúc:
       ```
       div.party-confirm (hidden)
         div.party-confirm-box (role="dialog", aria-modal="true", aria-labelledby="party-confirm-title")
           div.party-confirm-head
           p.party-confirm-text
           p.party-confirm-status
           p.party-confirm-warn
           div.party-confirm-buttons
             button.confirm-keep
             button.confirm-release
       ```
       Mọi nút có `type="button"`. Dùng `textContent`, không dùng `innerHTML` cho chữ có tên thú.
     - Sự kiện:
       - `keepButton` click: `closeConfirm()`;
       - `releaseButton` click: `confirmRelease()`;
       - `confirm` click khi `e.target === this.confirm` (chạm nền mờ): `closeConfirm()`.
     - Listener `keydown` trên `window` (thay khối dòng 79-82):
       ```ts
       if (e.key.toLowerCase() === "q" && !e.repeat) this.toggle();
       if (e.key === "Escape") {
         if (this.confirmId) this.closeConfirm(); // the dialog first, the panel on the next press
         else this.toggle(false);
       }
       if (e.key === "Tab" && this.confirmId) {
         e.preventDefault(); // focus stays on the dialog's two buttons
         (document.activeElement === this.keepButton ? this.releaseButton : this.keepButton).focus();
       }
       ```
       `focus()` lên nút còn khoá không có tác dụng, nên focus ở yên `Giữ lại`. Đó là hành vi mong muốn.
   - `toggle(force)`: khi đóng, gọi `closeConfirm(false)` và `if (this.releasing) this.setReleasing(false)`.
   - `update(party, hasBase, snacks = 0)`:
     - lưu ba tham số;
     - `if (party.length === 0) this.releasing = false;`
     - `if (this.confirmId && !party.some((p) => p.id === this.confirmId)) this.closeConfirm();`
     - key thêm `this.releasing`; key đổi thì gọi `render()` (phần thân cũ, dòng 102-118, chuyển vào đây).
   - `render()`:
     - `title`: `Túi thú ${n}/${MAX_PARTY}`;
     - nút HUD: `🐾 Thú (${n})` khi `n < MAX_PARTY`, ngược lại `🐾 Thú (${n}/${MAX_PARTY})`; `classList.toggle("full", n >= MAX_PARTY)`;
     - `releaseToggle.hidden = n === 0`; chữ, class `on` và `aria-pressed` theo `releasing`;
     - danh sách: túi trống thì chữ túi trống (mới); khi `releasing` thì gợi ý thả (`p.party-hint.release`) thay cho gợi ý đặt trại; rồi các thẻ.
   - `private setReleasing(on: boolean)`: `this.releasing = on; this.lastKey = ""; this.update(this.party, this.hasBase, this.snacks);`. Vẽ lại ngay, không chờ khung hình sau.
   - `card()`: tách phần tạo `party-swatch` (dòng 128-138) thành `private swatch(entry: PartyEntry): HTMLSpanElement`, dùng lại trong hộp. Khi `this.releasing`, cột nút chỉ có `add("Thả", () => this.openConfirm(entry), "release")` và đặt `aria-label`; các nút khác không thêm. Hàm `add` cần trả về nút, hoặc đặt `aria-label` ngay trong đó.
   - `private openConfirm(entry)`:
     - `confirmId = entry.id`;
     - `confirmHead.replaceChildren(this.swatch(entry), this.confirmTitle)`;
     - điền tiêu đề, dòng trạng thái (`hidden` khi `assignment === ""`) và dòng con cuối (`hidden = this.party.length !== 1`);
     - `releaseButton.disabled = true`; `armTimer = window.setTimeout(() => (this.releaseButton.disabled = false), CONFIRM_ARM_MS)`;
     - `confirm.hidden = false`; `keepButton.focus()`.
   - `private closeConfirm(restoreFocus = true)`:
     - `confirmId` rỗng thì `return`;
     - `clearTimeout(armTimer)`; ẩn hộp; `confirmId = ""`;
     - nếu `restoreFocus && this.open && !this.releaseToggle.hidden` thì `releaseToggle.focus()`.
   - `private confirmRelease()`: lấy `id = this.confirmId`; rỗng thì `return`; `closeConfirm()`; `this.actions.release(id)`.
   - Cập nhật JSDoc của class: thêm việc thả thú.

6. **`packages/client/src/game/Game.ts`**
   - Import `throwBlocker`.
   - `PartyPanel` (dòng 259-264): thêm `release: (palId) => this.room.send(ClientMessage.Release, { palId }),`.
   - `throwBall()` (1028-1042), sau khi có `[targetId, pal]` và `state`, trước `room.send`:
     ```ts
     // Refused for the same reason the server would give (the boss, a full party): no ball leaves the hand.
     const wild = this.room.state.pals.get(targetId);
     const blocker = wild ? throwBlocker(state?.pals.length ?? 0, wild) : undefined;
     if (blocker) {
       this.hud.showToast(blocker, 3000);
       return;
     }
     ```
     Bị chặn thì không `send`, không `me.play("throw")`. Toast 3 giây vì câu dài hơn thường lệ và người chơi cần đọc để làm theo.

7. **`packages/client/index.html`** (CSS, cạnh khối `.party-*`, dòng 116-151):
   - `.party-btn.full { background: #ffd54f; color: #4e342e; }`
   - `.party-header { ... gap: 6px; }`: thêm `gap` vào luật có sẵn.
   - `.party-title { flex: 1; min-width: 0; }`
   - `.party-release-toggle { min-height: 44px; min-width: 44px; padding: 0 12px; border: none; border-radius: 10px; background: #ffebee; color: #b71c1c; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; }`, `.party-release-toggle.on { background: #b71c1c; color: #fff; }`, `.party-release-toggle[hidden] { display: none; }`
   - `.party-action.release { background: #e53935; min-height: 44px; }`, `.party-hint.release { color: #b71c1c; }`
   - `.party-confirm { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0,0,0,0.45); pointer-events: auto; }`, `.party-confirm[hidden] { display: none; }`
   - `.party-confirm-box { width: min(320px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 14px 16px; border-radius: 14px; background: #fafcf6; color: #253020; box-shadow: 0 8px 28px rgba(0,0,0,0.4); }`
   - `.party-confirm-head { display: flex; align-items: center; gap: 10px; font-size: 17px; }`, `.party-confirm-box p { margin: 8px 0 0; font-size: 14px; line-height: 1.4; }`, `.party-confirm-warn { color: #b71c1c; font-weight: 700; }`
   - `.party-confirm-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }`, `.party-confirm-buttons button { min-height: 44px; min-width: 96px; padding: 0 16px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; }`, `.confirm-keep { background: #e0e0e0; color: #263238; }`, `.confirm-release { background: #e53935; color: #fff; }`, `.confirm-release:disabled { opacity: 0.45; cursor: default; }`
   - `.party-confirm-buttons button:focus-visible, .party-release-toggle:focus-visible, .party-action.release:focus-visible { outline: 3px solid #1e88e5; outline-offset: 2px; }`
   
   `.hud` có `z-index: 2`; bảng `z-index: 3`, bản đồ lớn 4; hộp 5 nằm trên tất cả trong HUD, kể cả joystick và nút cảm ứng.

8. **`packages/server/src/rooms/GameRoom.test.ts`**: các test ở mục Test.

9. **`tests/e2e/multiplayer.spec.ts`**: test mới ở mục Test, đặt sau test "pack leaders", trước test "lobby:".

10. **`docs/architecture.md`**:
    - dòng `capture.ts`: thêm "`throwBlocker` (trùm, túi đầy; client và server dùng chung)";
    - dòng `ui/`: `party.ts` thành "(bảng thú; chế độ 🕊️ Thả bớt và hộp xác nhận)".

## Giao thức

- **`messages.ts`:** thêm `ClientMessage.Release = "release"` với `ReleaseMessage { palId: string }`. Không thêm `ServerMessage` (kết quả báo bằng `Notice`, state tự cập nhật).
- **`schema.ts`:** không đổi. Thả là `player.pals.splice(index, 1)` trên `ArraySchema` có sẵn, kèm `activePalId = ""` và xoá khỏi `state.companions` như khi cho nghỉ. Client không dùng callback theo phần tử của `pals` (đọc `me.pals` mỗi khung hình trong `updateHud`, tìm thú đi theo theo id), nên không cần đổi gì thêm.
- **Lưu game:** `Profile`, `emptyProfile`, `sanitizeProfile` không đổi. Lần lưu sau (`scheduleSave`, hoặc `saveNow` khi rời phòng) ghi danh sách `pals` đã bớt con được thả. Hồ sơ cũ đọc y như trước, không cần chuyển đổi. Server sập trong 2 giây trước khi lưu thì con vừa thả quay lại; vô hại.
- **Ảnh hưởng client:** `Game.ts` gửi `release` và chặn ném theo `throwBlocker`. Client và server deploy cùng một container. Client cũ còn trong cache (chưa có service worker, T13) vẫn chơi được: chỉ thiếu nút thả, và ném khi túi đầy thì nhận notice của server thay vì mất thú.

## Test

**Unit (`packages/shared/src/capture.test.ts`)**, `describe("throwBlocker")`:
- `throwBlocker(MAX_PARTY - 1, { boss: false })` là `undefined`; `throwBlocker(0, { boss: false })` là `undefined`.
- `throwBlocker(MAX_PARTY, { boss: false })` và `throwBlocker(MAX_PARTY + 3, { boss: false })` là `PARTY_FULL_TEXT`.
- `PARTY_FULL_TEXT` chứa `${MAX_PARTY}/${MAX_PARTY}` và "Thả bớt", không chứa "cho bớt".
- `throwBlocker(0, { boss: true })` và `throwBlocker(MAX_PARTY, { boss: true })` chứa "trùm" (trùm xét trước).

**Tích hợp (`packages/server/src/rooms/GameRoom.test.ts`)**: thêm `describe("releasing pals and a full party")` ở cuối file.
- Import thêm `OwnedPal`, `MAX_PARTY`, `PARTY_FULL_TEXT`.
- Helper `addPals(player, n, speciesId = "leafkit")`: tạo `OwnedPal` đang nghỉ với id duy nhất (`fill-<i>-<ngẫu nhiên>`), `push` thẳng vào `player.pals`, trả mảng.

Các test:
1. **"lets a resting pal go for good; ignores unknown ids, bad payloads and other players' pals"**
   - `setup()`, `capture()` (con A đi theo), `addPals(player, 2)` (B, C); `other = await colyseus.connectTo(room, { name: "Other" })`; `notices = collect(client, Notice)`.
   - `other` gửi `Release { palId: B.id }`; `client` gửi `Release { palId: "nope" }`, `Release { palId: 42 }`, `Release {}`, `Release` không payload; `ticks(3)`. Kiểm: id vẫn `[A, B, C]`, `notices` rỗng.
   - `client` gửi `Release { palId: B.id }`; `ticks(3)`. Kiểm:
     - server còn `[A, C]`;
     - state phía client cũng còn `[A, C]`: `await vi.waitFor(() => expect([...client.state.players.get(client.sessionId).pals].map((p) => p.id)).toEqual([A, C]))`;
     - `notices.at(-1)` chứa "Đã thả";
     - A vẫn đi theo (`activePalId`, `companions.has(A)`).
2. **"releasing the follower, even the last pal, sends it away and forgets it"**
   - `setup()`, `capture()`: F là con duy nhất, đang đi theo.
   - Đặt `(room as any).controls.get(client.sessionId).skillOrder = { companionId: F.id, skill: "seed_shot", until: Number.MAX_SAFE_INTEGER }` và `(room as any).faintedUntil.set(F.id, Number.MAX_SAFE_INTEGER)`.
   - Gửi `Release { palId: F.id }`; `ticks(2)`. Kiểm:
     - `pals.length === 0`, `activePalId === ""`;
     - `companions.has(F.id) === false`;
     - `skillOrder` là `undefined`;
     - `faintedUntil.has(F.id) === false`;
     - `skillReady.has("c:" + F.id) === false`.
   - Rồi `ticks(20)`, `capture()` lần nữa: con mới tự đi theo (`activePalId` là id của nó).
3. **"releasing a worker takes it off the camp"**
   - Đặt trại như `atCamp()` của describe crafting (dòng 297-305), `capture()`, gửi `Assign work`, `ticks(2)`: companion ở `mode "work"`.
   - Gửi `Release`, `ticks(2)`. Kiểm: companion không còn, `pals.length === 0`.
4. **"a released pal stays gone after rejoining"**
   - `token = "release-token-0123456789"`; `setup(token)`, `capture()` (A đi theo), `addPals(player, 1)` (B).
   - Gửi `Release { palId: A.id }`, `ticks(2)`, `client.leave()`, `colyseus.cleanup()`.
   - `setup(token)` lại. Kiểm: id là `[B.id]`, `activePalId === ""`, `companions.size === 0`.
5. **"a full party cannot throw: no ball is used and nothing is caught or lost, pack leaders included"**
   - `setup()`; `addPals(player, MAX_PARTY)`; `[alphaId, alpha]` = thú đầu đàn đầu tiên trong state; xoá mọi thú hoang khác; `leaf = placeWild(room, "leafkit", player, 60)`, `hp = 1`; `player.greatBalls = 1`.
   - `notices = collect(Notice)`, `results = collect(CaptureResult)`.
   - Không mock `Math.random` ở bước này (bị từ chối trước khi tung xúc xắc).
   - Ném bóng xịn vào `leaf`, `ticks(3)`. Kiểm:
     - `results` rỗng;
     - `leaf` còn trong state;
     - `(room as any).inBall.has(leaf) === false`;
     - `pals.length === MAX_PARTY`;
     - `greatBalls === 1`;
     - `notices.at(-1) === PARTY_FULL_TEXT`.
   - `ticks(20)` (lần bị từ chối cũng tính thời gian chờ ném). Đặt người chơi cạnh `alpha` (+40 px), ném vào `alphaId`, `ticks(3)`. Kiểm: `results` vẫn rỗng, `alpha` còn trong state, notice là `PARTY_FULL_TEXT`.
   - Đưa người chơi về cạnh `leaf` (cách 60 px). Gửi `Release` một con, `ticks(2)`: còn `MAX_PARTY - 1`.
   - `ticks(20)`; `vi.spyOn(Math, "random").mockReturnValue(0)`; ném vào `leaf`; `waitForMessage(CaptureResult)`; `vi.restoreAllMocks()`. Kiểm: `success === true`, `pals.length === MAX_PARTY`, `leaf` không còn trong state.
   - Không dùng helper `capture()` trong test này: `palNextTo` lấy thú hoang đầu tiên trong state, ở đây có thể là thú đầu đàn.
   
   Test có sẵn "spawns one boss ... cannot be captured" (kiểm notice chứa "trùm") phải tiếp tục qua mà không sửa.

**E2E (`tests/e2e/multiplayer.spec.ts`)**: test mới `"party: let a pal go after confirming; a full party cannot throw"`, có `test.slow()`.
1. `join(browser, "Keeper")`, `waitForWorld`, chờ `game.frames > 0`. Helper `party()` đọc từ `__petgame.room.state` `{ ids, species, active }` của mình; `companions()` như các test khác.
2. `room.send("debug:givePal", { species: "leafkit", level: 3 })` rồi `{ species: "pebblet", level: 2 }`. Poll: 2 con, 1 companion (Pebblet đi theo).
3. Bấm `.party-btn`. `.party-panel .party-title` chứa "2/30". `.party-action.release` có 0 phần tử. Bấm `.party-release-toggle`: có 2 phần tử, nút toggle có chữ "✓ Xong".
4. Bấm `.party-card.follow .party-action.release`. Kiểm:
   - `.party-confirm-box` hiện, chứa "Thả Pebblet · Lv 2?" và "Đang đi theo bạn";
   - `.confirm-keep` được focus.
5. Kích thước chạm (hộp đang mở): lần lượt `setViewportSize` 390×844 và 844×390.
   - `boundingBox` của `.party-release-toggle`, `.party-action.release` (đầu tiên), `.confirm-keep`, `.confirm-release`: rộng và cao ≥ 44;
   - `.party-confirm-box` nằm trọn trong khung nhìn;
   - xong trả về 1280×720 (khung mặc định của "Desktop Chrome").
6. Bấm `.confirm-keep`: hộp ẩn, vẫn 2 con.
7. Mở lại hộp, `keyboard.press("Escape")`: hộp ẩn, `.party-panel` vẫn hiện.
8. Mở lại hộp. Chờ `.confirm-release` **enabled** (hết thời gian khoá), rồi `Tab`: `.confirm-release` được focus; `Enter`. Kiểm:
   - `.hud-toast` chứa "Đã thả Pebblet";
   - poll `species` là `["leafkit"]`, `companions()` là 0, `active === ""`;
   - `.party-card` còn 1.
9. Bấm `.party-action.release` còn lại: hộp chứa "cuối cùng"; bấm `.confirm-release` (Playwright tự chờ nút hết khoá). Poll 0 con. `.party-empty` hiện; `.party-release-toggle` ẩn.
10. Escape đóng bảng. Gửi `debug:givePal { species: "leafkit" }` 30 lần; poll 30 con. `.party-btn` có chữ `🐾 Thú (30/30)` và class `full`.
11. Ghi lại tin client gửi: `const sent = []; const send = room.send.bind(room); room.send = (t, m) => (sent.push(t), send(t, m));` (lưu vào `window.__sent`). `room.send("debug:spawnPal")`; poll đến khi state có một thú hoang trong vòng 100 px quanh người chơi.
12. `keyboard.press("e")`. Kiểm: `.hud-toast` chứa "Túi thú đầy"; `__sent` không có `"throw"`; vẫn 30 con; thú hoang vừa sinh còn trong state.
13. `room.send("release", { palId: <id con đầu> })`; poll 29 con; `.party-btn` không còn class `full`. `keyboard.press("e")`; poll đến khi `__sent` có `"throw"`. Không chờ kết quả bắt, vì kết quả ngẫu nhiên.

**Lệnh**
- Coder: `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test -g "party:" --workers=1`. Tắt server dev trước khi chạy; không sửa file client/shared khi e2e đang chạy.
- Tester: thêm `npm run test:e2e` cả bộ.
- Ảnh kiểm tra bố cục: coder chụp bảng ở chế độ thả kèm hộp đang mở ở 390×844, 844×390, 1280×720 bằng Playwright tạm, không commit. Lưu vào scratchpad, ghi đường dẫn vào `PROGRESS.md`.

## Tiêu chí hoàn thành

- [ ] `messages.ts` có `ClientMessage.Release = "release"` và `ReleaseMessage { palId: string }`, kèm JSDoc tiếng Anh.
- [ ] `capture.ts` có `PARTY_FULL_TEXT` (dựng từ `MAX_PARTY`) và `throwBlocker(partySize, { boss })`; có unit test như mục Test.
- [ ] Server, `release`:
  - kiểm kiểu `palId`; id lạ, id của người khác, payload hỏng thì không đổi gì và không gửi notice;
  - id hợp lệ thì: gỡ khỏi `player.pals` bằng `splice`; xoá companion; xoá `activePalId` nếu là thú đi theo; xoá `skillOrder` dành cho nó; xoá `faintedUntil`; gửi notice "Đã thả …"; `scheduleSave`.
- [ ] Server, `handleThrow`:
  - thứ tự: cooldown, tầm ném, `inBall`, đặt `lastThrowAt`, rồi `throwBlocker`;
  - bị chặn thì không có `CaptureResult`, không trừ bóng xịn, thú hoang không vào bóng;
  - nhánh `else { "Túi thú đã đầy" }` đã xoá;
  - `grep -rn "cho bớt\|Túi thú đã đầy" packages` không ra kết quả.
- [ ] `debug:givePal` báo `PARTY_FULL_TEXT` khi túi đầy.
- [ ] Client: `throwBall` không gửi `throw` khi `throwBlocker` chặn (cả trùm), hiện toast đúng câu đó 3 giây.
- [ ] Bảng 🐾 Thú:
  - tiêu đề `Túi thú n/30`;
  - nút `🕊️ Thả bớt` / `✓ Xong` có `aria-pressed`, ẩn khi túi trống;
  - chế độ thả: mỗi thẻ chỉ có nút `Thả` và gợi ý đỏ; chế độ tắt khi đóng bảng (✕, Q, Escape, mở bảng khác) và khi túi trống.
- [ ] Hộp xác nhận:
  - đúng chữ ở mục Thiết kế, kể cả dòng trạng thái và dòng con cuối;
  - nền mờ chặn chạm phía sau, chạm nền mờ là huỷ;
  - focus mặc định ở `Giữ lại`; Tab và Shift+Tab chỉ đổi giữa hai nút;
  - Escape đóng hộp trước rồi mới đóng bảng;
  - nút `Thả` khoá 500 ms đầu;
  - hộp tự đóng khi con đó không còn trong túi; focus về nút chế độ sau khi đóng.
- [ ] Nút HUD hiện `🐾 Thú (30/30)` kèm class `full` khi đầy; dưới 30 thì chữ như cũ (test e2e cũ vẫn qua). Chữ túi trống đã đổi.
- [ ] Mọi nút mới ≥ 44×44 px ở 390×844, 844×390, 1280×720; hộp nằm trọn trong khung nhìn (e2e đo).
- [ ] Không đổi `schema.ts`, `Profile`, `emptyProfile`, `sanitizeProfile`, `store.ts`. Thú đã thả không quay lại sau khi vào lại phòng (test tích hợp 4).
- [ ] Unit, tích hợp, e2e mới đều qua; `npm run typecheck` sạch; `npm run build` qua; cả bộ e2e qua. Không nới lỏng hay bỏ test nào.
- [ ] Chú thích code bằng tiếng Anh, chữ hiển thị bằng tiếng Việt. `docs/architecture.md` đã cập nhật 2 dòng.

## Rủi ro, câu hỏi mở

Không có dòng CHẶN.

- **Thả nhầm.** Đã có 4 lớp chặn:
  - phải bật chế độ thả trước;
  - phải xác nhận trong hộp, focus mặc định ở `Giữ lại`;
  - nút `Thả` trong hộp khoá 500 ms;
  - chế độ thả tắt khi đóng bảng.
  
  Không có hoàn tác. Thêm hoàn tác cần giữ thú "đang thả" trên server một lúc, phức tạp hơn nhiều so với lợi ích.
- **Cùng một token ở hai tab.** Lần lưu sau cùng thắng (có từ trước, mọi dữ liệu đều vậy). Thú đã thả có thể "sống lại" nếu tab kia lưu sau. Thả không cho gì nên không tạo đường nhân bản mới. Ngoài phạm vi.
- **Choáng 6 giây.** Người chơi túi đầy đánh choáng một con rồi mới thả bớt thì có thể không kịp ném. Nút 🐾 vàng khi đầy giúp họ biết trước. Nếu vẫn thấy khó, có thể cân nhắc kho thú ở trại (ý tưởng, chưa đề xuất thành việc).
- **Bố cục tiêu đề trên điện thoại dọc** (`Túi thú 30/30`, nút chế độ, ✕ trong 300 px) ước tính vừa. Coder kiểm bằng ảnh chụp; nếu tràn thì cho chữ nút chế độ nhỏ đi (13 px) trong media query `max-width: 600px`, không đổi chữ.
- **Ghi chú cho việc sau:**
  - T8: khi có cờ đầu đàn, hộp xác nhận nên thêm dòng "★ Thú đầu đàn";
  - T12: chữ mới nằm ở `ui/party.ts`, `capture.ts` (`PARTY_FULL_TEXT`, câu trùm) và notice "Đã thả" trong `GameRoom.ts`;
  - T4: xem lưu ý về kinh nghiệm khi bắt ở mục Thiết kế.

## Đề xuất việc mới cho TASKS.md

T2 làm trong một vòng coder, không cần tách. Đề xuất thêm:

- **P2, "Nút cảm ứng dưới 44 px trong HUD và các bảng trong game".** Ước tính từ CSS, cần đo bằng e2e như test `lobby:`:
  - `.party-action` (cao 36 px; dùng ở bảng Thú, Chế tạo, Tủ đồ), `.party-close` (44×32), `.wardrobe-tab` (34);
  - `.eat-btn`, `.sound-btn` (30, điện thoại 28); `.invite-btn` (khoảng 24);
  - `.party-btn`, `.base-btn`, `.craft-btn`, `.wardrobe-btn` (khoảng 34, điện thoại khoảng 29); `.ball-btn` (khoảng 31); `.skill-auto` (khoảng 27).
  
  T15 đã nhận `.style-btn` và `.swatch`; hai class này dùng chung cho sảnh và Tủ đồ, nên sửa một lần là được cả hai. Khi làm, cần sắp lại cột nút của thẻ thú (ví dụ 2 cột), để thẻ không cao quá trên điện thoại ngang (bảng cao khoảng 374 px).
