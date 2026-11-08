# PLAN: T8 Thú đầu đàn bắt được không có dấu hiệu gì

## Mục tiêu

- **Vấn đề:**
  - Bắt được thú đầu đàn là chiến tích lớn nhất của game (nhiệm vụ cuối chuỗi; con thú cấp 15-22). Nhưng vào túi rồi, nó chỉ là một con thú cấp cao bình thường: không thẻ, nhãn hay hồ sơ nào nhớ nó từng là đầu đàn.
  - Lúc bắt, người ném đọc hai tin cho cùng một việc: "Bắt được Voltmouse! 🎉" (chữ của client) và "★ Hiệp đã bắt được Voltmouse đầu đàn!" (tin `news` của server, gửi cả người ném). Tin thứ hai là thông báo mức cao, nên tin lên cấp phải chờ thêm 3 giây.
- **Sau nhiệm vụ:**
  - Con đầu đàn bắt được mang dấu ★ mãi: lưu trong hồ sơ, hiện trên thẻ ở bảng 🐾 Thú, trên nhãn tên khi nó đi theo hay làm việc (ai trong thế giới cũng thấy), và trong hộp xác nhận thả.
  - Người ném chỉ đọc một tin: "★ Bắt được Voltmouse đầu đàn! 🎉". Mọi người khác vẫn nhận tin ★.
- Luật đầy đủ đã ghi trong `docs/design/pals.md` (mục "Thú đầu đàn", tiểu mục mới "Thú đầu đàn đã bắt", "Túi thú và thả thú", "Nhãn tên và thanh máu") và `docs/design/hud.md` (bảng `news`, ví dụ "Bắt thú đầu đàn"). Game-designer đã sửa hai file này trong nhiệm vụ.

## Phạm vi

Làm:
- **shared:**
  - trường `alpha` ở cuối `OwnedPal` và `Companion` (`schema.ts`);
  - `CaptureResultMessage.alpha` (`messages.ts`);
  - hàm `palName` (`alphas.ts`) và test.
- **server:**
  - `GameRoom.ts`: mọi chỗ tạo `OwnedPal`, `spawnCompanion`, `saveNow`, `handleThrow`, `announce`, `knockOut`, `release`, hook `debug:givePal`;
  - `persistence/store.ts`: `SavedPal`, `sanitizeProfile`;
  - test.
- **client:**
  - `Game.ts`: nhãn thú đi theo, chữ khi bắt, dữ liệu cho bảng Thú;
  - `ui/party.ts`: thẻ, hộp xác nhận;
  - CSS trong `index.html`.
- **E2E:** 1 test mới.
- **`docs/architecture.md`:** 5 chỗ nhỏ (bước 10).

KHÔNG làm:
- **Không thêm lợi ích nào cho thú đầu đàn đã bắt.** Không thêm chỉ số, chiêu, sức làm việc; không làm hình to hơn hay có quầng vàng. Lý do ở mục Thiết kế 3.
- Không đổi tin ★ khi **hạ gục** thú đầu đàn: vẫn gửi cả thế giới, kể cả người hạ. Client không có thông báo riêng cho lần hạ gục (tin `Defeated` chỉ có hiệu ứng và chữ bay đồ rơi), nên người hạ không đọc trùng.
- Không đổi chữ lên cấp, cho ăn bánh, cảnh báo lãnh địa: tên loài là đủ ở đó.
- Không đổi nhãn của thú đầu đàn hoang ("★ Đầu đàn · Lv 15 Voltmouse"), hạng nhãn `LABEL_RANK`, `labelLayout.ts`, `labels.ts`.
- Không đổi thứ tự tin và kinh nghiệm của T4/T6: tin ★ và `ALPHA.xp` vẫn chung một hẹn giờ lúc bóng khép, tin trước, kinh nghiệm sau.
- Không thêm hook debug mới. Chỉ thêm một trường tuỳ chọn `alpha` cho hook `debug:givePal` có sẵn (mục Thiết kế 6).
- Không đụng `scripts/shots.mjs` (xem đề xuất cho T14 ở cuối).

## Thiết kế

### 1. Lưu cờ

**Trường mới:**
- `OwnedPal.alpha` (boolean, cuối schema): con thú này bị bắt khi đang là thú đầu đàn.
- `Companion.alpha` (boolean, cuối schema): chép từ `OwnedPal.alpha` khi con thú ra ngoài (`spawnCompanion`).
  - Theo đúng cách `Companion` đang chép `speciesId` và `level`: client vẽ nhãn ngay trong `onAdd`, không phải tra chéo sang `Player.pals` (thứ tự patch, nối lại).
  - Giá trị không bao giờ đổi trong đời con thú, như `mode`.
- `SavedPal.alpha` (boolean, bắt buộc) trong `Profile`.

Thêm ở cuối schema để chỉ số của các trường cũ giữ nguyên.

**Ai đặt cờ.** Chỉ server: client không bao giờ gửi cờ này, trừ hook thử nghiệm khi `PETGAME_DEBUG=1`. Mọi chỗ server tạo hay chép `OwnedPal`:

| Chỗ | Giá trị |
|---|---|
| Bắt được (`handleThrow`) | `pal.alpha` của thú hoang lúc ném |
| Nạp hồ sơ (`onJoin`) | `saved.alpha` (đã qua `sanitizeProfile`, luôn là boolean) |
| `debug:givePal` | `message?.alpha === true` |
| `saveNow` (ghi hồ sơ) | `p.alpha === true` |
| `spawnCompanion` (ra ngoài) | `companion.alpha = owned.alpha === true` |

Schema dùng `t.boolean()` không có giá trị mặc định, nên `new OwnedPal()` có `alpha` là `undefined` cho đến khi gán. Vì vậy:
- mọi chỗ tạo trong `GameRoom` gán tường minh, giống `pal.alpha = false` ở `spawnPal`;
- hai chỗ ranh giới (`saveNow`, `spawnCompanion`) ép `=== true`. Nếu sau này có đường tạo thú quên gán, nó vẫn ra `false` chứ không ra `undefined`.

**Hồ sơ cũ:**
- `sanitizeProfile` đọc `alpha: p.alpha === true`. Hồ sơ trước T8 không có trường thì ra `false`. Giá trị lạ (`"yes"`, `1`) cũng ra `false`. Đọc lại kết quả đã đọc không đổi gì.
- `emptyProfile` không đổi: `pals` rỗng.
- Quay về code cũ (nếu phải): code cũ dựng hồ sơ từ các trường nó biết, nên bỏ qua `alpha`. Chỉ mất cờ, không hỏng gì. Vì vậy không cần hỏi người dùng.

### 2. Hiển thị ★

| Ở đâu | Thú thường (không đổi) | Thú đầu đàn đã bắt |
|---|---|---|
| Tên trên thẻ ở bảng 🐾 Thú | `Voltmouse · Lv 15` | `★ Voltmouse · Lv 15`: ★ là `<span class="party-star" title="Thú đầu đàn">`, màu `#b77900` |
| Thẻ | viền theo việc (đi theo xanh, làm việc cam) | thêm class `alpha`: vạch vàng 4 px bên trái trong thẻ (`box-shadow: inset 4px 0 0 #ffb300`), không đụng viền theo việc |
| Nút "Thả" (chế độ 🕊️ Thả bớt), `aria-label` | `Thả Voltmouse · Lv 15` | `Thả Voltmouse đầu đàn · Lv 15` |
| Hộp xác nhận thả | (không có dòng) | dòng `★ Thú đầu đàn` ngay dưới tiêu đề, chữ đậm `#9a6200` |
| Thông báo sau khi thả (server) | `Đã thả Voltmouse. Tạm biệt! 👋` | `Đã thả Voltmouse đầu đàn. Tạm biệt! 👋` |
| Nhãn trên đầu khi đi theo hay làm việc | `Lv 15 Voltmouse`, class `label companion` | `★ Lv 15 Voltmouse`, class `label companion alpha`: chữ vàng `#ffe082`, đậm 600, nền tối như cũ |

**Lý do các lựa chọn:**
- **★ đặt trong tên**, khớp với nhãn trên đầu ("★ Lv 15 Voltmouse"), tin ★, dấu ★ trên bản đồ và nhãn "★ Đầu đàn" của thú hoang.
- **Vạch vàng bên trái** giúp nhìn ra ngay trong danh sách tới 30 thẻ. Viền vàng bên trái cũng là dấu "quan trọng" mà thông báo mức cao đang dùng.
- **Màu (đo tương phản):**
  - `#b77900` cho ★: 3,37-3,65:1 trên ba nền thẻ (`#fff`, `#f1f8e9`, `#fff8e1`), đạt 3:1 cho ký hiệu;
  - `#9a6200` cho chữ trong hộp: 4,93:1 trên `#fafcf6`, đạt 4,5:1 cho chữ 14 px;
  - `#ffe082` cho nhãn: khoảng 9,9:1 trên nền nhãn.
- **Nhãn vẫn chữ vàng trên nền tối**, không dùng nền vàng: nền vàng là nhãn của chính mình (`.label.me`) và của thú đầu đàn hoang. Chữ vàng là đủ để phân biệt.
- **Hạng nhãn không đổi (T5):**
  - thú đi theo của mình vẫn là `LABEL_RANK.follower`, nhãn ghim;
  - thú của người khác và thú làm việc vẫn là `LABEL_RANK.companion`.

  Hạng xếp theo thứ người chơi cần thấy (của mình, mối nguy). Thú đầu đàn đã thuần không phải mối nguy. Nhãn chỉ rộng thêm khoảng 10 px; `labelLayout` đã đo lại khi chữ đổi.
- **Không ★ trên hình chân dung:** không cần thêm chỗ trên ô 52 px đã có số cấp.
- **Hình trong thế giới không đổi** (không quầng vàng, không to 1,6 lần): hai thứ đó nghĩa là "thú đầu đàn hoang đang canh lãnh địa". Nếu thú đi theo cũng có, người chơi sẽ tưởng bị tấn công. Trên điện thoại, hình to còn chiếm chỗ.

**Điện thoại và bàn phím:**
- Không có thao tác mới. Thả vẫn qua chuột, chạm và Q, Tab, Enter, Escape như T2.
- Ở thẻ hẹp (390×844, cột chữ khoảng 125 px), tên có thể xuống dòng ở khoảng trắng như hiện nay. Chuyện thẻ quá cao để T18 lo.
- Hộp xác nhận cao thêm khoảng 28 px. Ước tính ở 844×390: khoảng 245-270 px so với 358 px trống, và hộp đã có `max-height: 100%; overflow-y: auto`. E2E đo lại.
- `title` của ★ chỉ hiện khi rê chuột. Trên cảm ứng, chữ "★ Thú đầu đàn" trong hộp và tin lúc bắt đã nói ★ là gì.

### 3. Lợi ích thêm: không có

Thú đầu đàn đã bắt có chỉ số, chiêu, sức làm việc, cấp tối đa như thú thường cùng loài cùng cấp. Số liệu tính bằng script chỉ đọc trên code hiện tại:
- **Phần thưởng đã lớn.**
  - Con bắt được ở cấp 15, 17, 18, 19, 20, 22. Kinh nghiệm cộng dồn lần lượt 4.159, 5.746, 6.657, 7.650, 8.727, 11.141.
  - Theo bảng "Nhịp mục tiêu" (`pals.md`), nuôi một con lên cấp 15 mất 116 trận, khoảng 2,6 giờ ở nhịp bình thường; cấp 20 mất 5,7 giờ.
  - Thú đi theo còn nhận phần bắt theo cấp (60-78) cộng 300 (`ALPHA.xp`).
- **Lợi ích gắn với dấu ★ sẽ cày được.**
  - Thú đầu đàn quay lại sau 6 phút (`ALPHA.respawnMs`).
  - Choáng ở 1 máu, mỗi lần ném bắt được 33,0-33,8% (bóng xịn: 33,7-34,8%, gần như không thêm vì ở 1 máu tỉ lệ gốc đã gần trần trước khi nhân 0,4). Choáng 6 giây cho khoảng 7 lần ném, nên chỉ khoảng 6% số lần cả 7 quả đều trượt.
  - Một lợi ích theo cờ sẽ cộng dồn tới 30 con trong túi.
- **Cân bằng T7** tính sức thú đi theo chỉ theo cấp (`companionDamage`, chiêu theo cấp). Thêm chỉ số làm lệch thời gian trận đã đo.
- **Luật thả thú (T2)** không hoàn lại gì, để không có vòng bắt rồi thả kiếm đồ. Thú đầu đàn cũng không ngoại lệ.

Không đổi số cân bằng nào, nên không cần balance-analyst.

### 4. Tin nhắn khi bắt

**`CaptureResultMessage.alpha?: boolean`:**
- Có (`true`) khi thú bị ném là thú đầu đàn, **cả khi bắt được lẫn khi nó thoát**. Không có trường khi thú thường. Viết theo kiểu cờ tuỳ chọn đang dùng: `...(crit ? { crit } : {})`.
- Tin vẫn `broadcast` như cũ. Người khác nhận được nhưng không dùng (chữ "Bắt được" chỉ hiện cho người ném).

**Chữ của người ném** (client, `Game.ts`, hàm `verdict`), tên lấy từ `palName(msg.speciesId, msg.alpha === true)`:

| Kết quả | Thú thường (không đổi) | Thú đầu đàn | Mức, thời gian |
|---|---|---|---|
| Bắt được | `Bắt được Voltmouse! 🎉` | `★ Bắt được Voltmouse đầu đàn! 🎉` | cao, 3,0 giây |
| Thoát | `Voltmouse thoát ra rồi (33%)` | `Voltmouse đầu đàn thoát ra rồi (33%)` | thường, 3,0 giây |

**Tin ★ (`announce`, kind `news`):**
- Chữ không đổi: `★ Hiệp đã bắt được Voltmouse đầu đàn!`.
- Gửi cho mọi người **trừ người ném**: `this.broadcast(..., { except })`, Colyseus 0.18 hỗ trợ `except?: Client | Client[]`.
- `except` lấy lúc hẹn giờ chạy, theo sessionId: `this.clients.find((c) => c.sessionId === client.sessionId)`. Không dùng biến `client` của lúc ném. Lý do, đọc trong `@colyseus/core` 0.18.18 (`Room.mjs`):
  - khi rớt mạng, Colyseus xoá client khỏi `this.clients` (`_onLeave`);
  - khi nối lại, nó đẩy vào một đối tượng `Client` **mới**, cùng sessionId;
  - `except` so sánh bằng tham chiếu.

  Hệ quả:

  | Lúc hẹn giờ chạy, người ném… | Tra theo sessionId | Dùng `client` cũ |
  |---|---|---|
  | đang chơi bình thường | được loại ra | được loại ra |
  | đang chờ nối lại | không tìm thấy, `except` là `undefined`, mọi người còn lại nhận (người ném không nằm trong danh sách) | như cột trái |
  | vừa nối lại | đối tượng mới, được loại ra | không loại được, người ném lại thấy tin ★ |
- Hạ gục: `announce(text)` không có `except`, như cũ.

**Thứ tự (T4/T6) giữ nguyên:**
- Một hẹn giờ lúc `captureRevealMs(shakes) + CAPTURE_NEWS_DELAY_MS` (2,2 giây khi bắt được). Trong đó: `announce` trước, `grantXp` sau. Người khác nhận tin ★ rồi mới đến `LevelUp` (tin `LevelUp` cũng `broadcast`).
- Người ném thấy "★ Bắt được…" ở client lúc bóng khép (1,9 giây). `LevelUp` đến sau 0,3 giây như mọi lần bắt.
- Người ném rời phòng trước khi bóng khép: không ai để loại, mọi người còn lại vẫn nhận tin, không trả kinh nghiệm (test sẵn có, giữ nguyên).

**Màn hình người ném** (`toastDuration`, 2 chỗ khi desktop hay điện thoại dọc), trường hợp xong luôn nhiệm vụ cuối:
- "★ Bắt được…" hiện từ 1,9 đến 4,9 giây; "Xong nhiệm vụ…" từ 2,1 đến 6,0 giây.
- Tin lên cấp đến lúc 2,2 giây, chờ đến 4,9 giây mới hiện.
- Cả cảnh khoảng 9 giây; trước T8 khoảng 10 giây và đọc hai tin cho một việc.
- Điện thoại ngang (1 chỗ): ngắn đi khoảng 3 giây, bằng thời gian của tin ★ cũ (3,0 giây).

### 5. Một hàm chung cho tên

`palName(speciesId: string, alpha = false): string` trong `packages/shared/src/alphas.ts`:
- trả `Voltmouse` hoặc `Voltmouse đầu đàn`;
- import `getSpecies` từ `./pals.ts` (không vòng: `pals.ts` chỉ import JSON).

Thay cho `alphaName(pal)` riêng của `GameRoom` (bỏ phương thức này) ở 4 chỗ:
- tin bắt được;
- tin hạ gục;
- thông báo thả (server);
- chữ bắt và thoát, `aria-label` nút Thả (client).

Mục đích: chữ "đầu đàn" ghép giống nhau ở cả hai bên, có unit test. Cảnh báo lãnh địa trong `Game.ts` tự ghép "… đầu đàn" và giữ nguyên (đề xuất cho T12 ở cuối).

### 6. Hook thử nghiệm

`debug:givePal` nhận thêm `alpha?: boolean`: `owned.alpha = message?.alpha === true`.
- **Lý do:** e2e không bắt được thú đầu đàn thật bằng hook sẵn có.
  - Không hook nào làm yếu một con thú đầu đàn; `debug:spawnPal` chỉ sinh thú thường.
  - Ném vào con đầy máu chỉ trúng 3,6-6% mỗi lần, trong lúc nó cắn 11 máu mỗi 1,2 giây.
- Hook vẫn chỉ đăng ký khi `PETGAME_DEBUG=1`. Test tích hợp kiểm cả giá trị `true` lẫn giá trị lạ.

## Kế hoạch triển khai

Số dòng tính theo HEAD `54fe64c`. Chú thích code bằng tiếng Anh, chữ hiển thị tiếng Việt, đúng như bảng ở mục Thiết kế.

1. **`packages/shared/src/schema.ts`:**
   - `OwnedPal` (dòng 9-19): sau `assignment`, thêm:
     ```ts
     /** Caught while it was a region's pack leader (alphas.ts): shown with a ★, nothing more. */
     alpha: t.boolean(),
     ```
   - `Companion` (dòng 90-103): sau `maxHp`, thêm:
     ```ts
     /** Its OwnedPal was caught as a pack leader: the name tag shows a ★. Set once when it comes out, like `mode`. */
     alpha: t.boolean(),
     ```
2. **`packages/shared/src/messages.ts`**, `CaptureResultMessage` (dòng 276-284), sau `shakes`:
   ```ts
   /** The pal thrown at was a region's pack leader (whether caught or not): the thrower reads "… đầu đàn". */
   alpha?: boolean;
   ```
3. **`packages/shared/src/alphas.ts`:** thêm `import { getSpecies } from "./pals.ts";` và hàm sau `ALPHA`:
   ```ts
   /** A pal's name as players read it: "Voltmouse", or "Voltmouse đầu đàn" for a pack leader, wild or caught. */
   export function palName(speciesId: string, alpha = false): string {
     const name = getSpecies(speciesId).name;
     return alpha ? `${name} đầu đàn` : name;
   }
   ```
4. **`packages/server/src/persistence/store.ts`:**
   - `SavedPal` (dòng 31-37) thêm:
     ```ts
     /** Caught as a region's pack leader (★). Saves from before it was kept have none: read as false. */
     alpha: boolean;
     ```
   - `sanitizeProfile`, dòng 156: `pals.push({ id: p.id, speciesId: p.speciesId, level, xp, assignment, alpha: p.alpha === true });`.
5. **`packages/server/src/rooms/GameRoom.ts`:**
   - Import `palName` từ `@petgame/shared`.
   - **`debug:givePal`** (dòng 439-458):
     - kiểu `message?: { species?: string; level?: number; alpha?: boolean }`;
     - thêm `owned.alpha = message?.alpha === true;` cạnh các trường khác;
     - chú thích dòng 439: `// A pal of this species and level joins the party and follows (to try its skills); { alpha: true } makes it a caught pack leader.`
   - **`onJoin`** (dòng 512-520): thêm `owned.alpha = saved.alpha;`.
   - **`handleThrow`** (dòng 889-954):
     - Ngay sau `const species = getSpecies(pal.speciesId);` (dòng 903): `const alpha = pal.alpha === true;`. Dùng `alpha` thay cho `pal.alpha` ở dòng 907.
     - Nhánh `success`:
       - bỏ `alphaName` (dòng 922);
       - thêm `owned.alpha = alpha;` trước `player.pals.push(owned)`;
       - `if (alpha) this.questEvent(client.sessionId, "alpha");`;
       - `xp` cộng `(alpha ? ALPHA.xp : 0)`;
       - `const news = alpha ? \`★ ${player.name} đã bắt được ${palName(species.id, true)}!\` : "";`.
     - Chú thích dòng 937-939 sửa thành: `Once the ball has clicked shut (as the thrower sees it): a pack leader's news for everyone else (the thrower reads it in this result, CaptureResultMessage.alpha), then the XP for the pal that helped, in one timer (timers due in the same tick run last-registered first). Not at the throw: a level-up then would give the catch away while the ball still wobbles.`
     - Trong hẹn giờ, thay `if (news) this.announce(news);` bằng:
       ```ts
       // Found again now, not the `client` of the throw: a reconnect in between brings a new Client for this session.
       if (news) this.announce(news, this.clients.find((c) => c.sessionId === client.sessionId));
       ```
     - Dòng 952:
       ```ts
       const result: CaptureResultMessage = { playerId: client.sessionId, palId, speciesId: species.id, success, chance, shakes, ...(alpha ? { alpha } : {}) };
       ```
   - **`release`** (dòng 1016-1029): `const owned = player.pals[index];` và `const name = palName(owned.speciesId, owned.alpha === true);`, thay dòng 1020.
   - **`knockOut`** (dòng 1195): `const name = pal.alpha ? palName(pal.speciesId, true) : "";`.
   - **Xoá phương thức `alphaName`** (dòng 1616-1619).
   - **`announce`** (dòng 1621-1624):
     ```ts
     /** Tells everyone in the world but `except` (a "news" notice). */
     private announce(text: string, except?: Client) {
       this.broadcast(ServerMessage.Notice, { text, kind: "news" } satisfies NoticeMessage, { except });
     }
     ```
   - **`spawnCompanion`** (dòng 2024-2035): `companion.alpha = owned.alpha === true;`.
   - **`saveNow`** (dòng 2086-2092): thêm `alpha: p.alpha === true,` sau `assignment`.
6. **`packages/client/src/game/Game.ts`:**
   - Import `palName` từ `@petgame/shared`.
   - **`CaptureResult`** (dòng 696-706):
     - `const name = palName(msg.speciesId, msg.alpha === true);` thay dòng 701;
     - chữ bắt được: `` `${msg.alpha ? "★ " : ""}Bắt được ${name}! 🎉` ``;
     - chữ thoát giữ cách viết, dùng `name` mới.
   - **`$.onAdd("companions")`** (dòng 488-521):
     - Trước `nameTag`:
       ```ts
       // A caught pack leader: a ★ and gold text. Set once by the server when it comes out, like `mode`.
       const star = companion.alpha ? "★ " : "";
       ```
     - `nameTag` nhận chữ `` `${star}Lv ${companion.level} ${species.name}` `` và class `companion.alpha ? "label companion alpha" : "label companion"`.
     - Trong `onChange` (dòng 517): `` const shown = `${star}Lv ${companion.level} ${species.name}`; ``. Giữ phép so sánh trước khi gán.
   - **`updateHud`** (dòng 1166): thêm `alpha: p.alpha === true` vào object của mỗi thú.
7. **`packages/client/src/ui/party.ts`:**
   - Import `palName`.
   - `PartyEntry` (dòng 26-33) thêm:
     ```ts
     /** Caught as a pack leader: a ★ on its card and a line in the release dialog. */
     alpha: boolean;
     ```
   - Khoá vẽ lại (dòng 188): `` `${p.id}:${p.level}:${p.xp}:${p.assignment}:${p.alpha ? 1 : 0}` ``.
   - **`card`:**
     - `` card.className = `party-card ${entry.assignment || "idle"}${entry.alpha ? " alpha" : ""}`; ``
     - Tên (dòng 262-263): nếu `entry.alpha`, tạo `span.party-star` có chữ `★`, `title = "Thú đầu đàn"`, rồi `name.append(star, " ")`. Sau đó `` name.append(`${species.name} · Lv ${entry.level}`) `` (chữ của tên là `★ Voltmouse · Lv 15`).
     - `aria-label` của nút Thả (dòng 298): `` `Thả ${palName(entry.speciesId, entry.alpha)} · Lv ${entry.level}` ``.
   - **Hộp xác nhận:**
     - Trường mới `private confirmAlpha: HTMLParagraphElement;`. Dựng một lần trong constructor: `className = "party-confirm-alpha"`, chữ `★ Thú đầu đàn`.
     - Thứ tự trong hộp: `box.append(this.confirmHead, this.confirmAlpha, text, this.confirmStatus, this.confirmWarn, choices)`.
     - `fillConfirm`: `this.confirmAlpha.hidden = !entry.alpha;`.
8. **`packages/client/index.html` (CSS):**
   - Cạnh `.label.companion span` (dòng 217):
     ```css
     /* A caught pack leader (★): gold text on the usual dark tag (a gold tag is mine or a wild leader's). */
     .label.companion.alpha span { color: #ffe082; font-weight: 600; }
     ```
   - Cạnh các quy tắc thẻ (sau dòng 201):
     ```css
     /* A caught pack leader: a gold bar inside the card's left edge (the border keeps showing what the pal does) and a gold ★ in its name. */
     .party-card.alpha { box-shadow: inset 4px 0 0 #ffb300; }
     .party-star { color: #b77900; }
     ```
   - Cạnh `.party-confirm-warn` (dòng 167): `.party-confirm-alpha { color: #9a6200; font-weight: 700; }`.
9. **Test:** theo mục Test.
10. **`docs/architecture.md`:**
    - Dòng `schema.ts` (22): thêm "; `OwnedPal.alpha`, `Companion.alpha`: thú đầu đàn đã bắt (★)".
    - Dòng `messages.ts` (23): thêm "; `CaptureResultMessage.alpha` (thú bị ném là đầu đàn)".
    - Dòng `boss.ts`, `alphas.ts` (35): thêm "; `palName` (tên kèm "đầu đàn", dùng chung)".
    - Mục "Thông báo và thứ tự tin" (dòng 46): sau "tin ★ trước, kinh nghiệm sau." thêm "Tin ★ của lần bắt gửi mọi người trừ người ném (`announce(text, except)`, tìm client theo sessionId lúc hẹn giờ chạy vì nối lại tạo `Client` mới); người ném đọc "★ Bắt được … đầu đàn! 🎉" từ `CaptureResultMessage.alpha`. Tin ★ khi hạ gục vẫn gửi cả người hạ."
    - Dòng hook (59): `givePal` thành "givePal (`species`, `level`, `alpha: true` cho thú đầu đàn đã bắt)".

Một commit cho cả nhiệm vụ.

## Giao thức

| Thay đổi | Chi tiết | Ảnh hưởng |
|---|---|---|
| `schema.ts` | `OwnedPal.alpha`, `Companion.alpha` (boolean, cuối mỗi schema) | Server và client đổi cùng nhiệm vụ (một container chạy cả hai). Thêm ở cuối nên chỉ số các trường cũ không đổi |
| `messages.ts` | `CaptureResultMessage.alpha?: boolean` | Tuỳ chọn: client không đọc thì như cũ |
| `Profile` | `SavedPal.alpha: boolean`; `sanitizeProfile` đọc `p.alpha === true` | Hồ sơ cũ đọc được: mọi thú là thú thường. Code cũ đọc hồ sơ mới thì bỏ qua trường, không hỏng |
| Hook debug | `debug:givePal` nhận `alpha` | Chỉ khi `PETGAME_DEBUG=1` |

Không đổi `ClientMessage`, `NoticeMessage`, `NoticeKind`.

## Test

**Unit, shared:** `packages/shared/src/alphas.test.ts`, test mới `names a pack leader, wild or caught, as players read it`:
- `palName("voltmouse")` và `palName("voltmouse", false)` là `"Voltmouse"`;
- `palName("voltmouse", true)` là `"Voltmouse đầu đàn"`;
- với mọi `ALPHAS`: `palName(def.speciesId, true) === \`${getSpecies(def.speciesId).name} đầu đàn\``.

**Unit, server:** `packages/server/src/persistence/store.test.ts`:
- `saves and loads a profile` (dòng 9): con thú được đẩy vào có `alpha: true`. Lượt lưu rồi đọc vẫn `toEqual(profile)`.
- Test mới `reads pals saved before pack leaders were marked as common pals, and keeps the mark only when it is true`:
  - `sanitizeProfile({ pals: [...] })` với 4 con: không có trường, `alpha: true`, `alpha: "yes"`, `alpha: 1`;
  - kết quả `pals.map((p) => p.alpha)` là `[false, true, false, false]`;
  - `sanitizeProfile(p)` bằng `p`.

**Tích hợp:** `packages/server/src/rooms/GameRoom.test.ts`.

Sửa:
1. **`adds a captured pal to the party and makes it follow`** (dòng 127-136): thêm `expect(player.pals[0].alpha).toBe(false)` và `expect(companion.alpha).toBe(false)`. Bắt thú thường ra `false` tường minh, không phải `undefined`.
2. **`is harder to catch than its kind`** (dòng 1100-1110): thêm `expect(result.alpha).toBe(true)`, đúng dù lần ném đó trúng hay trượt.
3. **`caught, the news of the catch comes before the level-up the ball's click pays for`** (dòng 1168-1199):
   - đổi tên thành `caught, everyone else hears the news before the level-up the ball's click pays for; the thrower is not told twice`;
   - thêm `watcher = await colyseus.connectTo(room, { name: "Watcher" })`, ghi thứ tự (Notice, LevelUp) **ở watcher** như đang ghi ở `client`;
   - ở watcher: có tin `★ ${player.name} đã bắt được Cactoad đầu đàn!`, và đúng một `"LevelUp 6 -> 7"` đến sau tin;
   - ở người ném: không tin Notice nào bắt đầu bằng `★`; có đúng một `LevelUp 6 -> 7`; `result.alpha === true`.
4. **`addPals`** (dòng 1932-1945): gán `owned.alpha = false;` như mọi chỗ tạo thú của server.

Giữ nguyên, phải vẫn qua:
- `caught, if the thrower leaves before the ball clicks shut...` (dòng 1201): người ném đã rời thì không ai bị loại;
- `every notice says what it is about` (dòng 1273): tin ★ khi hạ gục vẫn đến người hạ;
- `a big gain skips levels...` (dòng 1313).

Thêm:
5. **Trong `describe("pack leaders")`:** `caught, it stays a pack leader: in the party, as a companion, in the client's state, and after rejoining`.
   - Token riêng (`"alpha-token-0123456789"`). Lấy Voltmouse đầu đàn bằng `alphaOf`, xoá các thú khác, người chơi đứng cách 40 px, `Math.random` trả 0, ném.
   - `result` có `success` và `alpha` đều `true`.
   - `player.pals[0].alpha === true`, cấp 15.
   - Con đầu tiên tự đi theo: `room.state.companions.get(id).alpha === true`.
   - Bản state của client: `await vi.waitFor(...)` thấy `client.state.players.get(sid).pals[0].alpha` và `client.state.companions.get(id).alpha` đều `true`.
   - Sau `ticks(room, 20)` (chờ hồi ném), `placeWild(room, "leafkit", player, 60)` rồi bắt tiếp với `random` trả 0: `result.alpha` là `undefined`, `player.pals[1].alpha === false`.
   - Rời phòng, `colyseus.cleanup()`, `setup(token)` lại:
     - `pals.map((p) => p.alpha)` là `[true, false]`;
     - thú đi theo được gọi lại có `companion.alpha === true`.
6. **Trong `describe("saving")`:** `an old save without the mark loads its pals as common pals`.
   - `db = new SqliteStore(":memory:")`, `useStore(db)`.
   - `db.save(token, { ...emptyProfile("Old"), pals: [{ id: "old-voltmouse", speciesId: "voltmouse", level: 15, xp: 0, assignment: "follow" }] } as Profile)`, chú thích "saved before T8: no `alpha`". Import `type Profile` từ `../persistence/store.ts`.
   - Sau `setup(token)`: `player.pals[0].alpha === false` và thú đi theo `alpha === false`.
7. **Trong `describe("releasing pals and a full party")`:** `letting a caught pack leader go names it so`.
   - `const [a] = addPals(player, 1, "voltmouse"); a.alpha = true;`, gửi `Release`.
   - Thông báo cuối là `"Đã thả Voltmouse đầu đàn. Tạm biệt! 👋"`.
8. **Cạnh `the test hook that gives a pal says why when the party is full`:** `the test hook that gives a pal makes a caught pack leader only with alpha: true`.
   - Dùng `vi.stubEnv("PETGAME_DEBUG", "1")` và `vi.unstubAllEnvs()` trong `finally`, như dòng 265-290; không dùng `delete process.env` (xem T20).
   - Gửi `{ species: "voltmouse", level: 15, alpha: true }`: con đầu `alpha === true`, thú đi theo của nó `alpha === true`.
   - Gửi `{ species: "leafkit", alpha: "yes" }`: con thứ hai `alpha === false`, và thú đi theo lúc này (Leafkit) có `alpha === false`.

Không viết test cho trường hợp người ném nối lại trong 2,2 giây trước khi bóng khép (xem Rủi ro).

**E2E:** `tests/e2e/multiplayer.spec.ts`, test mới đặt ngay sau `pack leaders: a gold-tagged leader...` (sau dòng 674). Viết theo khung sau; được chỉnh chữ chú thích và cách viết nhỏ, giữ các kiểm tra:

```ts
test("pack leaders: a caught leader keeps its ★ on its card, its name tag and in the release dialog, after a reload too", async ({ browser }) => {
  test.slow();
  const page = await join(browser, "Thuần");
  await waitForWorld(page);
  await page.waitForFunction(() => (window as any).__petgame?.game?.frames > 0);
  const marks = () => page.evaluate(() => {
    const { room } = (window as any).__petgame;
    return room.state.players.get(room.sessionId).pals.map((p: any) => p.alpha === true) as boolean[];
  });

  // A Leafkit, then a caught pack leader (test-only hook: `alpha: true`), which follows since it came last.
  await sendFrom(page, "debug:givePal", { species: "leafkit", level: 3 });
  await sendFrom(page, "debug:givePal", { species: "voltmouse", level: 15, alpha: true });
  await expect.poll(async () => (await partyOf(page)).species).toEqual(["leafkit", "voltmouse"]);
  expect(await marks()).toEqual([false, true]);

  // Its name tag carries the star; my follower's tag is pinned, so always shown.
  const myTag = page.locator(".labels > .label.companion.alpha", { hasText: "Voltmouse" });
  await expect(myTag).toHaveText("★ Lv 15 Voltmouse");
  await expect(myTag).toBeVisible();

  // The leader's card has the star (inside the card on a phone held upright or sideways and on a desktop); the Leafkit's has none.
  await page.locator(".party-btn").click();
  const leaderCard = page.locator(".party-card.alpha");
  await expect(leaderCard).toHaveCount(1);
  await expect(leaderCard.locator("strong")).toHaveText("★ Voltmouse · Lv 15");
  await expect(leaderCard.locator(".party-star")).toHaveAttribute("title", "Thú đầu đàn");
  await expect(page.locator(".party-card:not(.alpha) strong")).toHaveText("Leafkit · Lv 3");
  await expect(page.locator(".party-card:not(.alpha) .party-star")).toHaveCount(0);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await expect(leaderCard.locator(".party-star")).toBeVisible();
    const star = (await leaderCard.locator(".party-star").boundingBox())!;
    const card = (await leaderCard.boundingBox())!;
    expect(star.x >= card.x && star.x + star.width <= card.x + card.width, `star inside its card at ${size.width}x${size.height}`).toBe(true);
  }

  // The release dialog says it is a pack leader and still fits a phone held sideways; the Leafkit's does not say it.
  await page.locator(".party-release-toggle").click();
  const leaderRelease = leaderCard.locator(".party-action.release");
  await expect(leaderRelease).toHaveAttribute("aria-label", "Thả Voltmouse đầu đàn · Lv 15");
  await leaderRelease.click();
  const dialog = page.locator(".party-confirm-box");
  const mark = page.locator(".party-confirm-alpha");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveText("★ Thú đầu đàn");
  await page.setViewportSize({ width: 844, height: 390 });
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator(".confirm-keep").click();
  await page.locator(".party-card:not(.alpha) .party-action.release").click();
  await expect(dialog).toBeVisible();
  await expect(mark).toBeHidden();
  await page.locator(".confirm-keep").click();
  await page.keyboard.press("q"); // the panel closes, and release mode with it

  // A friend's caught pack leader shows its star on my screen too.
  const roomId = await page.evaluate(() => (window as any).__petgame.room.roomId as string);
  const friend = await observer(roomId, "Bạn");
  friend.send("debug:givePal", { species: "frostfang", level: 19, alpha: true });
  await expect(page.locator(".labels > .label.companion.alpha", { hasText: "Frostfang" })).toHaveText("★ Lv 19 Frostfang");

  // After a reload (the same device), it is still one.
  await page.waitForTimeout(2500); // saves are batched every 2 s
  await page.reload();
  await enterLobby(page, "Thuần");
  await waitForWorld(page);
  await expect.poll(marks).toEqual([false, true]);
  await expect(myTag).toHaveText("★ Lv 15 Voltmouse");
  await page.locator(".party-btn").click();
  await expect(page.locator(".party-card.alpha strong")).toHaveText("★ Voltmouse · Lv 15");
});
```

Không test e2e chữ "★ Bắt được … đầu đàn! 🎉" (không bắt thật được thú đầu đàn, mục Thiết kế 6). Nó được giữ bởi ba thứ:
- test tích hợp kiểm `CaptureResultMessage.alpha`;
- unit test của `palName`;
- reviewer đọc 2 dòng ở `verdict`.

**Tester chạy:**
1. `npm run typecheck` và `npm test`: toàn bộ qua.
2. `npx playwright test -g "pack leaders" --repeat-each=5 --workers=1`: 10/10 (test mới và test cũ, mỗi test 5 lượt).
3. Các test e2e đụng bảng Thú, nhãn, bắt thú:
   - `-g "party:"` (3 test);
   - `-g "labels:"`;
   - `-g "a captured pal follows"`;
   - `-g "the catch and the quest it finishes"`.

   Mỗi lệnh 1 lượt.
4. `npm run test:e2e`: 32/32.

## Tiêu chí hoàn thành

- [ ] **Schema, tin, hàm chung:**
  - `OwnedPal` và `Companion` có `alpha: t.boolean()` ở cuối;
  - `CaptureResultMessage` có `alpha?: boolean`;
  - `palName` ở `alphas.ts`, có unit test;
  - `GameRoom` không còn `alphaName`.
- [ ] **Hồ sơ:**
  - `SavedPal.alpha: boolean`; `sanitizeProfile` đọc `p.alpha === true`;
  - `saveNow` ghi `alpha: p.alpha === true`;
  - `onJoin` gán `owned.alpha = saved.alpha`;
  - hồ sơ không có trường đọc ra `false` (unit và tích hợp).
- [ ] **Mọi chỗ server tạo `OwnedPal` gán `alpha` tường minh:** bắt, nạp hồ sơ, `debug:givePal` (`message?.alpha === true`). `spawnCompanion` gán `companion.alpha = owned.alpha === true`.
- [ ] **Bắt thú đầu đàn:**
  - `CaptureResultMessage` có `alpha: true` khi bắt được lẫn khi thoát; thú thường không có trường này;
  - con trong túi và thú đi theo của nó có `alpha === true`, vẫn vậy sau khi vào lại.
- [ ] **Tin ★:**
  - khi bắt: người ném không nhận, người khác nhận, gửi qua `announce(news, this.clients.find(...sessionId...))` trong **cùng** hẹn giờ với `grantXp`, tin trước kinh nghiệm sau;
  - khi hạ gục: vẫn gửi cả người hạ.
- [ ] **Client:** chữ người ném là `★ Bắt được Voltmouse đầu đàn! 🎉` và `Voltmouse đầu đàn thoát ra rồi (N%)` với thú đầu đàn; thú thường giữ chữ cũ.
- [ ] **Nhãn thú đi theo hay làm việc:**
  - `★ Lv N Loài`, class `label companion alpha`, chữ vàng `#ffe082`;
  - hạng nhãn không đổi; `labels.ts` và `labelLayout.ts` không đổi.
- [ ] **Thẻ:**
  - class `alpha` (vạch vàng trái);
  - tên `★ Loài · Lv N` với `span.party-star[title="Thú đầu đàn"]`;
  - `aria-label` nút Thả có "đầu đàn";
  - khoá vẽ lại có cờ.
- [ ] **Hộp xác nhận:** dòng `★ Thú đầu đàn` (`.party-confirm-alpha`) chỉ hiện với thú đầu đàn.
- [ ] **Thông báo thả:** `Đã thả Voltmouse đầu đàn. Tạm biệt! 👋`.
- [ ] **Test:**
  - đủ các test ở mục Test, test 3 đổi như mô tả;
  - không test nào bị nới hay bỏ;
  - typecheck, `npm test`, `npm run test:e2e` (32/32) qua.
- [ ] **Tài liệu:** `docs/architecture.md` có đủ 5 chỗ ở bước 10. `docs/design/pals.md` và `hud.md` khớp code; nếu code buộc phải khác thì báo lại, không tự sửa thiết kế.

## Rủi ro, câu hỏi mở

- **Người ném rớt mạng rồi nối lại trong 2,2 giây** từ lúc ném tới lúc bóng khép:
  - tra theo sessionId xử lý đúng: đang chờ nối lại thì không nhận gì; đã nối lại thì được loại đúng;
  - không viết test vì dựng phải dùng bộ cắt mạng của T3, mà trường hợp hiếm;
  - nếu sai, hậu quả chỉ là thấy hai tin như trước T8.
- **Thú từng là đầu đàn trong hồ sơ cũ thành thú thường:** không suy được từ cấp, vì thú thường cũng lên được cấp đó. Chấp nhận và đã ghi trong `pals.md`.
- **Thẻ ở điện thoại dọc:** tên dài thêm 2 ký tự, có thể xuống thêm một dòng ở vài loài. Chiều cao thẻ để T18 lo.
- **Không có ảnh chụp:** bộ `npm run shots` chưa có cảnh thú đầu đàn đã bắt. E2E kiểm bằng DOM ở 3 khung hình (★ trong thẻ, hộp vừa màn hình ngang).
- **Không có quyết định nào cần người dùng; không có dòng chặn.**
  - Lợi ích thêm: quyết "không", lý do ở Thiết kế 3.
  - Thay đổi hồ sơ không làm hỏng dữ liệu đã lưu: cũ đọc được, quay về code cũ chỉ mất cờ.
- **Đề xuất cho `TASKS.md`** (ghép vào việc có sẵn, không tạo việc mới):
  - T14: trong nhóm `labels` của `scripts/shots.mjs`, cho một khách nhận `debug:givePal` có `alpha: true`, để có ảnh so sánh nhãn "★ Lv N Loài" chữ vàng ở 3 khung hình;
  - T12: cảnh báo lãnh địa trong `Game.ts` tự ghép "… đầu đàn"; khi gom chữ, dùng `palName`.
