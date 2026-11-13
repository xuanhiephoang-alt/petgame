# PLAN: T63 Dọn test boss bar sau T30 (kèm mục 1 của T71)

Đọc code ở HEAD `e1f3007`. Nhiệm vụ **chỉ đổi test**, trong một file: `tests/e2e/multiplayer.spec.ts`. Code sản phẩm không có lỗi (xem "Nguyên nhân"), nên không sửa.

Nguồn:
- `TASKS.md` dòng 49 (T63).
- `REVIEW.md` của T30 (`git show 2ee7271:REVIEW.md`, "Góp ý không bắt buộc" 1-5).
- `REVIEW.md` của T61 (`git show 5ddcda1:REVIEW.md`, mục 8).
- `REVIEW.md` của T62 (`git show 0990723:REVIEW.md`).
- `PROGRESS.md` của T67 (`git show 23b1846:PROGRESS.md`, dòng 39: lần hỏng).

Chỗ liên quan trong `tests/e2e/multiplayer.spec.ts` (số dòng ở HEAD):

| Dòng | Nội dung |
|---|---|
| 2548-2596 | test `toasts (${screen.name})`; khối phải trả lại ở 2560-2568 |
| 2630-2693 | `bossLayout`; chú thích đặt lệch ở 2667-2668 |
| 2695-2701 | `watchHurt` |
| 2707-2714 | `bossPosition` |
| 2716-2750 | `settledBossLayout` |
| 2784-2942 | test `boss bar (...)` |
| 2813-2844 | `goNearBoss` của test boss bar |
| 2846-2860 | đẩy thông báo, đếm, chờ trượt vào, đo |
| 2912 | lề dưới của bảng |
| 2925-2940 | đoạn desktop 1248/1024 |
| 2944-2976 | `nearBoss` (bản chép của T61) |
| 2984-3099 | test `short sideways phone (...)` của T61; `pushToasts` 3049-3055, `slideIn` 3056, đoạn có trùm 3076-3082 |
| 3120-3124 | `LONGEST_TOASTS` |

Code sản phẩm đã đọc để tìm nguyên nhân:
- `packages/client/src/ui/hud.ts` 175-192 (`setBoss`), 259-292 (`showToast`, `measureSlots`, `toastFit`, `tickToasts`);
- `packages/client/src/ui/toastQueue.ts` 72-80 (`toastRoom`), 103-138 (`push`);
- `packages/client/src/game/Game.ts` 789-815 (tin `damage`), 1377-1382 (`updateBossBar`: ẩn khi xa hơn 450 px);
- `packages/server/src/rooms/GameRoom.ts` 813-822 (trùm đi lang thang), 1793-1811 (`wildTarget`), 2095-2120 (`tickClimate`);
- `packages/server/src/ai/wander.ts` 30-35, 51-66;
- `packages/shared/src/boss.ts`; `packages/shared/src/combat.ts:22` (`AGGRESSIVE_SIGHT` 120).

## Nguyên nhân lần hỏng (đã đo)

**Kết luận:** trùm đi lang thang ra xa hơn 450 px **trước lúc đẩy thông báo**. Thanh máu trùm ẩn, ô nhiệm vụ hiện lại. Trên 390×844 có tai thỏ 47, HUD khi đó chỉ cho 1 chỗ, đúng luật T62. Thông báo thứ hai phải chờ. Nếu trùm còn ở xa suốt 5 s (timeout của `toHaveCount`) thì test thấy 1 thay vì 2. **HUD làm đúng thiết kế; lỗi nằm ở test**: test giả định thanh vẫn hiện mà không kiểm lại ở đúng lúc đẩy.

Cách đo: script Playwright chỉ đọc, server ở cổng 2767, Vite ở 5373, đã tắt sau khi đo. Script nằm ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t63/` (`measure.mjs`, `hairs.mjs`, `repro.mjs`, `odds.mjs`).

### 1. Số chỗ chỉ phụ thuộc thanh có hiện hay không

Gọi thẳng `hud.toastFit()` rồi tính như `toastRoom`, cho cả 8 kiểu tóc ngẫu nhiên của sảnh. "Dư" là `nameTop − (toastsTop + 2×61 + 4) − 4`, âm thì chỉ còn 1 chỗ.

| 390×844 | Ô nhiệm vụ hiện (thanh ẩn) | Thanh trùm hiện |
|---|---|---|
| tai thỏ 47 | **1 chỗ** với mọi kiểu tóc, dư −1,3 (twintails) đến −9,8 (curly) | **2 chỗ** với mọi kiểu tóc, dư +9,2 (curly) đến +17,7 (twintails) |
| không tai thỏ | 2 chỗ, dư +25 đến +34 | 2 chỗ, dư +44 đến +53 |

Kết quả khớp bảng của T62 trong `hud.md`: "390×844, tai thỏ 47, ô nhiệm vụ: 1 cái; thanh máu trùm: 2 cái". Vì vậy:
- Chỉ cấu hình `phone upright, notch` bị ảnh hưởng.
- Trên desktop và khi cầm ngang, `toastRoom` không đo gì. Cầm dọc không tai thỏ luôn có 2 chỗ.
- Trước T62, số chỗ chỉ tính theo chiều cao màn hình, nên T30 lặp 75/75 lần mà không gặp lỗi này.

### 2. Thanh ẩn lúc đẩy thì chỉ hiện 1, cho đến khi thanh hiện lại

Đặt người chơi cách trùm 470 px rồi đẩy hai thông báo, `odds.mjs` cho kết quả `{"bar":false,"shown":1,"waiting":1,"slots":1}`. Nửa giây sau trùm đi lại gần, thanh hiện, và thông báo đang chờ hiện theo, vì `tickToasts` đo lại mỗi 250 ms.

Vậy thanh ẩn đúng lúc đẩy chưa đủ để hỏng: thanh còn phải ẩn suốt 5 s sau đó. Thông báo đầu dài khoảng 5,4 s, nên trong suốt cửa sổ 5 s ấy số đếm đứng yên ở 1. Khớp đúng thông báo lỗi "kỳ vọng 2, nhận 1, timeout 5 s".

### 3. Trùm không đứng yên

Chú thích "it stands still when not hit" ở dòng 2813 sai.
- **Trùm đi lang thang:** 45 px/s. Mỗi chặng đi tới một điểm lệch tối đa ±150 px mỗi trục (tới 212 px), nghỉ 1-4 s giữa hai chặng. Nó chỉ bị kéo về khi ra xa nhà quá 256 px.
- **Chỗ đứng của test cách trùm 180-340 px.** `goNearBoss` chọn chỗ xa thú hoang nhất, thường là vòng 340 px. Như vậy chỉ còn dư 110 px trước mốc 450: một chặng đi ra xa là đủ làm thanh ẩn.
- **Giữa lúc dịch chuyển và lúc đẩy, test chờ 2,5-6,5 s** (`toHaveCount(0)` chờ "Đến 🌋 Núi lửa" và cảnh báo nóng hết).
- **Đo tần suất (`odds.mjs`, 22 lần):** thanh ẩn đúng lúc đẩy và còn ẩn thêm 5 s ở 1/22 lần với lúc đẩy 2,5 s, 0/22 với 4,5 s, 1/22 với 6,5 s. Tức khoảng 4-5% mỗi lần chạy cấu hình tai thỏ. `measure.mjs` lần 3: thanh ẩn từ giây 4,3 và ẩn đến hết 30 s.
- Máy bận khi chạy cả bộ e2e làm cửa sổ chờ dài ra, nên dễ gặp hơn.

### 4. Đã loại các khả năng khác

- **`fit` đo lúc thanh đang chuyển:** không phải.
  - `setBoss` đổi `hidden` và lớp `boss-near` cùng lúc.
  - `showToast` đo đồng bộ ngay trong lời gọi; `getBoundingClientRect` ép tính bố cục mới.
  - `nameTop` chỉ phụ thuộc chiều cao màn hình, độ phóng và chiều cao nhân vật, không đổi trong lúc test.
- **Thông báo hết hạn:** hai thông báo cao sống 5,1-5,4 s, dài hơn cửa sổ 5 s. Chúng không làm số đếm xuống 1 trong cửa sổ đó.
- **`pushToasts` thoát sớm vì có thông báo của game chen vào:** có thể xảy ra (góp ý 2 của T30), nhưng không khớp với lỗi. Cảnh báo nóng chỉ gửi một lần khi vào núi lửa. Thông báo mức thường sống 2,5-3 s, ngắn hơn 5 s, nên số đếm sẽ về 0 chứ không đứng ở 1. `repro.mjs`, 14 lần: không lần nào thoát sớm. Chỗ này vẫn phải sửa (Thiết kế 2), vì nó làm đo nhầm thông báo.

### 5. Hai điều khác đo được, ảnh hưởng tới cách sửa

- **Trùm hung dữ, tầm nhìn 120 px.** Lang thang lại gần người chơi hoặc thú đi theo là nó lao vào đánh. `measure.mjs` lần 0: trùm nổi giận ở giây 3,8, người chơi ngất ở giây 14 và tỉnh dậy ở trại, rất xa trùm.
- **Núi lửa trừ 3 máu mỗi 2 s** (Emberpup hệ lửa không chống nóng): ngất sau khoảng 66 s nếu ở lì đó. `watchHurt` đếm cả những lần trừ máu này, nên `settledBossLayout` phải thử lại thường xuyên. Tin `damage` vì khí hậu có `cause`, và client không rung màn hình hay đẩy lùi khi nhận nó (`Game.ts:794-797` trả về trước đoạn rung và đẩy).

## Mục tiêu

- `boss bar (...)` hết chập chờn **vì đã sửa đúng nguyên nhân**: số thông báo mong đợi chỉ được kiểm khi chắc chắn thanh đang hiện ở đúng lúc HUD quyết định số chỗ.
- Không nới phép kiểm nào.
- Dọn các góp ý còn lại của rà soát T30.
- Bỏ bản chép `goNearBoss` (T71 mục 1).

Người chơi không thấy gì khác.

## Phạm vi

Làm (chỉ `tests/e2e/multiplayer.spec.ts`):
1. Thêm `pushBossToasts` và `bossToasts`: chỉ đẩy thông báo thử khi thanh đang hiện, kiểm trong cùng một `evaluate`.
2. `settledBossLayout`: dùng `nearBoss` chung, bỏ tham số `goNearBoss`. `prepare` đẩy lại thông báo thử khi chúng không còn hiện. `accept` kiểm cả chữ.
3. Test `boss bar (...)`: bỏ `goNearBoss` và `pushToasts` riêng, dùng các helper trên. Thêm `.catch(() => {})` cho từng `a.finished`. Lề dưới của bảng theo `max(12, inset)` khi cầm dọc và trên desktop.
4. `watchHurt`: chỉ đếm đòn đánh (`!m.cause`), sửa chú thích. Sửa chú thích đặt lệch trong `bossLayout`.
5. Trả test `toasts (${screen.name})` về đúng bản trước T30.
6. Test `short sideways phone (...)` của T61 (cùng dùng `settledBossLayout`): đổi theo chữ ký mới, dùng helper mới thay bản `pushToasts` có thoát sớm, thêm `.catch` cho `slideIn`.
7. Dời `nearBoss` và `LONGEST_TOASTS` lên khối helper của trùm, giữ nguyên văn. Sửa JSDoc của `nearBoss`.

KHÔNG làm:
- **Không sửa code sản phẩm** (`hud.ts`, `toastQueue.ts`, `Game.ts`, server, CSS) và không thêm hook `debug:*` (ví dụ khoá trùm đứng yên). HUD làm đúng luật T62. Muốn trùm không đi thì phải đổi server, mà chỉ cần nó cho một test.
- Không nới hay bỏ phép kiểm nào. Danh sách phép kiểm phải còn nguyên ở "Tiêu chí hoàn thành".
- Không đổi người chơi trong test (tóc, mũ, thú đi theo hệ nước để chống nóng): đổi thế là đổi bố cục mà T30 đã đo.
- Không đổi test `toasts (upright phone, …)` của T62, trừ việc `LONGEST_TOASTS` được dời chỗ.
- Không làm các mục còn lại của T71 (chữ giờ "visually hidden", `setStatus`), T72, T73.
- Không đổi `docs/design/hud.md`: luật không đổi.

## Thiết kế

### 1. Đẩy thông báo thử chỉ khi thanh đang hiện, kiểm ngay lúc đó

Có hai hướng sửa. Chọn hướng (a).

**(a) Kiểm thanh và đẩy trong cùng một `evaluate`.**
- `showToast` quyết định số chỗ một cách đồng bộ, theo DOM ngay lúc gọi.
- Nếu ngay trước đó, trong cùng một lượt JS, thanh đang hiện và `.hud-left` có `boss-near`, thì HUD chắc chắn quyết định 2 chỗ trên 390×844 có tai thỏ. Hai thông báo được gắn vào DOM ngay trong lời gọi.
- Sau đó thanh có ẩn thì HUD cũng không cắt thông báo đang hiện.
- Nếu trùm đã đi xa thì không đẩy gì, dịch chuyển lại gần trùm rồi thử lại, có giới hạn số lần.
- Số mong đợi vẫn là hằng số độc lập `screen.room`, lấy từ thiết kế ("thanh máu trùm, tai thỏ: 2 cái"). Nếu HUD sai mà cho 1 chỗ lúc thanh đang hiện thì test vẫn hỏng.

**(b) Lấy số mong đợi từ `hud.toastSlots` hay `debugInfo`: không chọn.**
- Test sẽ thành "HUD đồng ý với chính nó", mất phép kiểm luật T62 ngay trong cảnh có trùm.
- Còn phải thêm trường vào `debugInfo`, tức là sửa code sản phẩm.

Đưa người chơi lại gần trùm hơn (ví dụ chỉ dùng vòng 180 px) cũng không đủ: trùm đi hai chặng ra xa là vượt 450 px, và tới quá gần thì nó nổi giận (tầm nhìn 120 px, thú đi theo đứng cách người chơi 56 px). Chỉ có kiểm ngay lúc đẩy mới chắc chắn.

### 2. Thông báo thử trong `settledBossLayout`

- **`prepare` đẩy lại cả hai thông báo, có điều kiện thanh đang hiện như mục 1.** Nó không thoát sớm khi cột đang có thông báo khác.
  - `showToast` với chữ đang hiện chỉ làm thông báo đó ở lâu thêm, không thêm bản sao.
  - Chữ đang chờ trong hàng thì bị bỏ qua.
  - Thông báo cao thay được thông báo thấp hoặc thường của game (cảnh báo nóng, "Đến 🌋 Núi lửa", "Bạn bị ngất…").
  - Vì vậy mỗi lần thử, hai thông báo dài nhất hoặc hiện lại, hoặc ở lâu thêm.
- **`accept` kiểm chữ:** đúng `screen.room` thông báo, mỗi cái trùng **nguyên văn** một chuỗi trong `LONGEST_TOASTS`.
  - Không bao giờ đo nhầm thông báo của game.
  - Khi cầm ngang chỉ hiện 1, cái nào trong hai cái cũng được (cả hai đều là "dài nhất"), giống phép kiểm hiện nay.
- `settledBossLayout` tự gọi `nearBoss(page)` khi thanh ẩn hoặc có thú hoang gần. Điều kiện nhận số đo giữ nguyên: thanh hiện, `boss-near` khi ở trong cột, camera lệch < 1, không thông báo đang mờ dần hay trượt, không trúng đòn, thú hoang ≥ 250 px.

### 3. `watchHurt` chỉ đếm đòn đánh

Chọn lọc theo nguồn (`m.cause` rỗng), không giữ "đếm mọi sát thương". Lý do:
- Phép kiểm này có để tránh đo lúc nhãn tên đang bị dời. Chỉ đòn đánh mới dời nhãn: đòn đánh đẩy lùi người chơi và rung màn hình ±1,8 px, còn nóng hay lạnh thì không (`Game.ts:794-797`).
- Lớp `.hurt` (tên lên 8 px) có thể bật ở lần trừ máu đầu tiên vì nóng. Nhưng `bossLayout` đo trong một `evaluate`, nên số đo vẫn nhất quán. Luật T62 cũng đã luôn coi như đang bị thương.
- Cứ 2 s lại một lần trừ máu vì nóng, nên hiện nay nhiều lần thử bị loại không vì lý do gì. Người chơi cũng ở lâu hơn ở núi lửa (ngất sau khoảng 66 s).

### 4. Lề dưới của bảng

Thiết kế (`hud.md` "Vùng an toàn", CSS `index.html:169, 404, 435-436`): đáy bảng cách mép dưới `max(12, inset)` khi cầm dọc và trên desktop, `max(8, inset)` khi cầm ngang. Hiện test dùng `max(inset, 8)` cho mọi màn, lỏng hơn thiết kế 4 px khi cầm dọc và trên desktop. Sửa thành `max(safe.bottom, sideways ? 8 : 12)`. Đây là siết chặt hơn, không phải nới. CSS hiện tại thoả điều kiện này: `max-height` tính theo `border-box`, nên đáy bảng ≤ `100% − max(12px, env(...))`.

### 5. Trả test `toasts (...)` về bản trước T30

T30 đã đổi nhầm 4 dòng ở test này: thêm `pushToasts` có thoát sớm và chú thích "calm spot" chép nhầm. Kiểm bằng lệnh:

```
diff <(git show 2ee7271^:tests/e2e/multiplayer.spec.ts | sed -n '/^for (const screen of TOAST_SCREENS)/,/^}/p') \
     <(sed -n '/^for (const screen of TOAST_SCREENS)/,/^}/p' tests/e2e/multiplayer.spec.ts)
```

Ở HEAD lệnh này in đúng 4 dòng khác. Sau khi sửa, nó không được in gì.

## Kế hoạch triển khai

Mọi bước trong `tests/e2e/multiplayer.spec.ts`. Chú thích code bằng tiếng Anh.

1. **Trả test `toasts (${screen.name})` (2560-2568).** Thay khối đó bằng đúng bản trước T30:
   - giữ dòng chú thích 2560;
   - bỏ dòng chú thích 2561 ("calm spot");
   - `await page.evaluate(() => { const { hud } = …; hud.showToast(…); hud.showToast(…); });`, không có `if (…) return;`, không có biến `pushToasts`.

   Không dùng `LONGEST_TOASTS` ở đây, để thân test trùng từng ký tự với bản `2ee7271^`.

2. **`bossLayout` (2667-2668).** Đặt lại hai dòng chú thích cho khớp với các trường: `wild` và `hurt` một dòng, `lag` và `fading` một dòng. Sửa "lags behind my pal" thành "behind my player". `hurt` là số đòn đánh đã trúng tôi (`watchHurt`).

3. **`watchHurt` (2695-2701).** Đổi điều kiện thành `m.targetId === w.__petgame.room.sessionId && !m.cause && w.__bossHurt++`. JSDoc ghi:
   - đếm đòn đánh (cắn, dậm, chiêu) trúng người chơi vào `window.__bossHurt`;
   - nóng và lạnh (`cause`) không được đếm, vì chúng không đẩy lùi hay rung màn hình (`Game.ts`), nên không dời nhãn tên.

4. **Dời và sửa `nearBoss`, dời `LONGEST_TOASTS`.**
   - Dời nguyên văn hàm `nearBoss` (2944-2976) và hằng `LONGEST_TOASTS` cùng JSDoc (3120-3124) lên ngay sau `bossPosition` (sau 2714).
   - JSDoc của `nearBoss`:
     - bỏ câu "The test `boss bar (...)` keeps its own copy…";
     - thêm: trùm đi lang thang (45 px/s, mỗi chặng tới ±150 px mỗi trục, nghỉ 1-4 s) và hung dữ trong 120 px, nên thanh có thể ẩn bất cứ lúc nào sau khi hàm trả về;
     - nơi nào cần thanh hiện thì kiểm lại ngay lúc đó (`pushBossToasts`, `settledBossLayout`).
   - Thân hàm giữ nguyên.

5. **Helper mới, đặt sau `nearBoss`:**
   - `pushBossToasts(page): Promise<{ near: boolean; shown: string[] }>`, một `page.evaluate` nhận `LONGEST_TOASTS` làm đối số:
     - `near = !bar.hidden && .hud-left` có lớp `boss-near`;
     - nếu `near`: `hud.showToast(text, "high")` cho từng chuỗi theo thứ tự;
     - trả `near` và chữ của `.hud-toasts > .toast:not(.out)` theo thứ tự DOM, đọc **sau** khi đẩy.

     JSDoc nói vì sao phải kiểm thanh trong cùng lượt: trên điện thoại dọc có tai thỏ, HUD chỉ cho 2 chỗ khi thanh thế chỗ ô nhiệm vụ (T62). Kèm: chữ đang hiện chỉ ở lâu thêm, chữ thiếu được đẩy lại.
   - `bossToasts(page): Promise<string[]>`: tối đa 3 lần `await nearBoss(page)` rồi `pushBossToasts`. Lần nào `near` thì trả `shown`. Hết 3 lần thì `throw new Error("The boss bar was never shown when the test toasts went up")`.
   - `onlyTestToasts(toasts: { text: string }[], room: number): boolean`: `toasts.length === room && toasts.every((t) => LONGEST_TOASTS.includes(t.text))`.

6. **`settledBossLayout` (2716-2750).**
   - Chữ ký mới: `(page, accept = () => true, prepare = async () => {})`, bỏ tham số `goNearBoss`.
   - Dòng 2731 gọi `await nearBoss(page)`.
   - Sửa JSDoc: "goes back to the boss (`nearBoss`)…"; `prepare` chạy mỗi lần thử, sau khi dịch chuyển; thông báo thử được đẩy lại bằng `pushBossToasts`.
   - Không đổi điều kiện nhận số đo nào ở dòng 2746.

7. **Test `boss bar (...)` (2784-2942).**
   - Xoá `goNearBoss` (2813-2843). Dòng 2844 thành `await nearBoss(page);`, giữ dòng 2846 (`toHaveCount(0, 20 s)`).
   - Thay 2847-2855 bằng:
     ```ts
     // The two longest high toasts, put up while the bar shows (it decides how many fit on an upright phone with a notch).
     const shown = await bossToasts(page);
     expect(shown, "shown at once").toEqual(LONGEST_TOASTS.slice(0, screen.room));
     await expect(page.locator(".hud-toasts > .toast:not(.out)")).toHaveCount(screen.room);
     ```
   - Dòng 2858: `.map((a) => a.finished.catch(() => {}))` (bắt lỗi cho từng hiệu ứng).
   - Dòng 2860:
     ```ts
     settledBossLayout(page, (l) => onlyTestToasts(l.toasts, screen.room), async () => { await pushBossToasts(page); })
     ```
     Giữ `expect(layout.toasts).toHaveLength(screen.room)` ở 2861.
   - Dòng 2912:
     ```ts
     expect(check.bottom, panel).toBeLessThanOrEqual(check.height - Math.max(safe.bottom, sideways ? 8 : 12) + 1);
     ```
     Chú thích: "`max(12, inset)` upright and on desktop, `max(8, inset)` sideways (hud.md, Vùng an toàn)". `sideways` đã có từ 2874.
   - Đoạn desktop (2926, 2929, 2937): `goNearBoss()` thành `nearBoss(page)`; hai lời gọi `settledBossLayout` bỏ đối số `goNearBoss`.

8. **Test `short sideways phone (...)` (2984-3099).**
   - Xoá `pushToasts` (3049-3055).
   - `slideIn` (3056): thêm `.catch(() => {})` cho từng `a.finished`, như bước 7.
   - Đoạn không trùm (3061): thay `await pushToasts()` bằng đẩy thẳng `LONGEST_TOASTS`, như test T62 (dòng 3190-3193), không thoát sớm. Giữ `toHaveCount(1)`.
   - Đoạn có trùm (3077-3082):
     ```ts
     await nearBoss(page);
     // giữ toHaveCount(0, 20 s)
     const shown = await bossToasts(page);
     expect(shown).toEqual([LONGEST_TOASTS[0]]);
     // giữ toHaveCount(1) và slideIn()
     const layout = await settledBossLayout(page, (l) => onlyTestToasts(l.toasts, 1), async () => { await pushBossToasts(page); });
     ```
   - Mọi phép kiểm sau đó giữ nguyên.

9. Không còn chỗ nào dùng `goNearBoss` hay `pushToasts`. Lệnh sau không được ra kết quả nào: `rg -n "goNearBoss|pushToasts|calm spot|stands still" tests/e2e/multiplayer.spec.ts`.

Mỗi bước nhỏ và nằm chung một file. Làm trong một vòng coder, một commit.

## Giao thức

Không đổi: schema, message, `Profile`, `debugInfo`, client và server đều giữ nguyên.

## Test

Chỉ e2e. Không có unit hay test tích hợp mới, vì không có logic sản phẩm mới.

### Kiểm tĩnh

1. `npm run typecheck`: sạch. Lệnh này không gồm `tests/e2e`.
2. Kiểm kiểu riêng file e2e: `npx tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --types node tests/e2e/multiplayer.spec.ts`. Ở HEAD lệnh này sạch, và sau khi sửa cũng phải sạch.
3. Lệnh `diff` ở Thiết kế 5 không in gì. Lệnh `rg` ở bước 9 không ra kết quả nào.

### Chứng minh sửa đúng nguyên nhân

Tester làm. Các thay đổi tạm thời dưới đây **không được commit**. Trả file về nguyên trạng và so hash trước/sau.

- **(a) Tái hiện chắc chắn lỗi cũ** (trên code mới, chỉ để kiểm cơ chế).
  - Trong `bossToasts`, ở lần thử đầu, thay `nearBoss(page)` bằng: dịch chuyển tới `{ x: boss.x, y: boss.y + 700 }`, rồi chờ `.boss-bar` ẩn.
  - Đồng thời bỏ điều kiện `near` trong `pushBossToasts`: luôn đẩy và luôn trả `near: true`. Nếu vẫn trả `near` thật, lần thử 2 sẽ đẩy lại lúc thanh đã hiện, thông báo đang chờ được hiện ra, và lỗi bị che.
  - Chạy `npx playwright test -g "boss bar \(phone upright, notch\)"`: phải **hỏng** ở `shown at once` hoặc `toHaveCount(2)`, với 1 thông báo hiện.
- **(b) Cùng chỗ dịch chuyển ra xa như (a), nhưng giữ điều kiện `near`.**
  - Test phải **qua**: lần thử 1 trả `near: false` và không đẩy gì, lần thử 2 qua.
  - Ghi log tạm số lần thử để thấy được điều này.
- **(c) Kiểm chữ trong `accept`.**
  - Cho `pushBossToasts` đẩy `["Bắt được Leafkit! 🎉", LONGEST_TOASTS[1]]` thay cho `LONGEST_TOASTS`, và tạm bỏ dòng `shown at once`. Cả hai đều là thông báo mức cao, và mỗi lần thử `prepare` lại làm chúng ở lâu thêm. Vì vậy lần thử nào cũng có đủ 2 thông báo, nhưng một cái là chữ của game.
  - `settledBossLayout` của `boss bar (phone upright)` phải `throw "never settled"`, không đo nhầm.
  - Đẩy thêm một thông báo ngay trước `settledBossLayout` thì không kiểm được gì: hai thông báo thử mức cao đang hiện không bị thay, nên cái đẩy thêm chỉ nằm chờ.

### Lặp lại

Mỗi lệnh có thể chạy nền hoặc chia lô 10 lần, vì mỗi lệnh foreground giới hạn 10 phút. Không chạy server dev trên 2567/5173 trong lúc chạy.

| Lệnh | Kỳ vọng | Ghi chú |
|---|---|---|
| `npx playwright test -g "boss bar \(phone upright, notch\)" --repeat-each 40` | 40/40 | Trước khi sửa, khoảng 4-5% mỗi lần hỏng, nên 40/40 chỉ là bằng chứng phụ; bằng chứng chính là (a) và (b) |
| `npx playwright test -g "boss bar" --repeat-each 8` | 40/40 (5 cấu hình) | |
| `npx playwright test -g "short sideways phone" --repeat-each 5` | 15/15 (3 test) | |
| `npx playwright test -g "toasts \(" --repeat-each 3` | 18/18 | Gồm 3 test `toasts (...)` và 3 test `toasts (upright phone, …)` |
| `npm run test:e2e` | qua hết | Chạy một lần cả bộ |

`npm test` không cần đổi, nhưng vẫn chạy như mọi vòng.

## Tiêu chí hoàn thành

- [ ] Chỉ `tests/e2e/multiplayer.spec.ts` đổi (cùng `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`). Không đổi file nào trong `packages/`, `docs/`, `playwright.config.ts`.
- [ ] Thân test `toasts (${screen.name})` trùng từng ký tự với bản `2ee7271^`: lệnh `diff` ở Thiết kế 5 không in gì.
- [ ] Không còn `goNearBoss`, `pushToasts`, "calm spot", "stands still". `nearBoss` là bản duy nhất, JSDoc nói trùm đi lang thang.
- [ ] Thông báo thử của test trùm chỉ được đẩy trong một `evaluate` có kiểm `!bar.hidden` và `boss-near` trước khi đẩy. Có giới hạn số lần thử (3), hết lần thì `throw`.
- [ ] `settledBossLayout`:
  - `prepare` đẩy lại thông báo thử, không thoát sớm vì có thông báo khác;
  - `accept` của test trùm và test T61 kiểm chữ nguyên văn bằng `LONGEST_TOASTS`;
  - chữ ký không còn tham số `goNearBoss`.
- [ ] `watchHurt` chỉ đếm `damage` không có `cause`; JSDoc nói rõ vì sao.
- [ ] Mọi chỗ chờ `a.finished` trong test trùm và test T61 có `.catch(() => {})` cho từng hiệu ứng.
- [ ] Lề dưới bảng: `max(safe.bottom, sideways ? 8 : 12)`.
- [ ] **Không phép kiểm nào bị nới hay bỏ.** Các phép kiểm sau còn nguyên:
  - `toHaveCount(screen.room)`;
  - `expect(layout.toasts).toHaveLength(screen.room)`;
  - `expectBarClear`, `expectBarInColumn`;
  - phép kiểm chồng của thông báo với thanh, các phần HUD và tên mình;
  - thông báo nằm trên màn hình;
  - vùng an toàn của thanh;
  - chỗ giữa trên của thanh và hai mốc khi cầm ngang;
  - ba phép kiểm của bảng (mép trên, cột phải bị che, bảng vẽ trên thanh);
  - lúc rời trùm: thanh ẩn, ô nhiệm vụ hiện lại;
  - đoạn desktop 1248/1024;
  - mọi phép kiểm của T61 và T62.

  Có thêm phép kiểm mới: chữ của thông báo hiện ngay sau khi đẩy (`shown at once`), chữ trong `accept`, lề 12 px.
- [ ] Kiểm tĩnh 1-3 sạch. Thí nghiệm (a), (b), (c) cho đúng kết quả mong đợi, và file đã trả về nguyên trạng (hash trùng).
- [ ] Các lệnh lặp ở mục Test đạt đủ số lần qua. `npm run test:e2e` cả bộ qua.

## Rủi ro, câu hỏi mở

- **Trùm nổi giận** (tới gần người chơi hoặc thú đi theo trong 120 px) có thể đánh người chơi tới ngất.
  - Đo được ở 1/4 lần trong 30 s.
  - `settledBossLayout` tự xử lý: không nhận số đo khi trúng đòn; ngất thì tỉnh dậy ở trại, thanh ẩn, nên nó gọi `nearBoss`.
  - `accept` mới loại thông báo "Bạn bị ngất…".
  - Rủi ro còn lại chỉ là hết 10 lần thử. Lỗi khi đó là "never settled" kèm toạ độ, không phải đo sai.
  - Không thêm hook khoá trùm. Nếu sau này gặp lại, tách việc riêng: hook `debug:` giữ trùm đứng yên, sửa server.
- **Nóng ở núi lửa:** ngất sau khoảng 66 s ở lì đó. Bỏ đếm nóng trong `watchHurt` làm ít lần thử bị loại hơn, nên thời gian ở đó ngắn lại. Ngất vẫn được xử lý như trên.
- **Thông báo mức cao của game hiện đúng lúc đẩy** (lên cấp của thú đi theo khi nó hạ một thú hoang): `shown at once` sẽ hỏng. Thú đi theo chỉ đánh khi bị đánh trước, nên gần như không gặp. Không nới phép kiểm vì chuyện này.
- **Thông báo thử ở lâu hơn:** `prepare` gọi `showToast` mỗi lần thử, nên thông báo thử ở lâu thêm (luật trùng chữ). Không ảnh hưởng phép kiểm nào: test trùm không kiểm "thông báo thứ hai hiện sau khi cái đầu hết".
- Không có dòng "CHẶN:".

## Việc cho agent chính

- **T71:** sau khi T63 xong, bỏ mục đầu "cho test `boss bar (...)` dùng `nearBoss` thay bản `goNearBoss` riêng". T63 đã làm mục này. Phần còn lại của T71 giữ nguyên.
- Không đề xuất tách việc mới.

---

## Vòng 2: thông báo đè tên mình (bổ sung sau kiểm thử vòng 1)

Phần trên giữ nguyên và đã làm xong (`PROGRESS.md`, "Vòng 1"). Lỗi "1 thông báo thay vì 2" không còn: 0/120 lần. Còn một lỗi khác, khoảng 1/40 lần ở `boss bar (phone upright, notch)`, tại phép kiểm chồng: thông báo thứ hai `282-343` đè `my name 338-355` 5 px, dù thanh đang hiện, có 2 thông báo, camera đứng yên, không trúng đòn, không có thú hoang gần.

Riêng vòng 2 thay hai dòng "KHÔNG làm" ở trên: **sửa code sản phẩm** (`labelLayout.ts`) và tài liệu thiết kế (game-designer đã sửa xong).

### Nguyên nhân (đã đo, xác nhận nghi vấn của coder)

**Kết luận:** `layoutTags` đẩy tên mình lên khi một nhãn ghim khác đứng "trước" mình. Nhãn ghim gồm thú đi theo, thú đang nhắm, trùm và thú đầu đàn; xếp theo `y`, con thấp hơn trên màn được đặt trước. Luật thông báo T62 tính chỗ theo `restingNameTop`, tức tên ở đúng chỗ của nó, nên tên thật nằm cao hơn chỗ luật tính 8-22 px. Đây là **lỗi sản phẩm**: người chơi đứng yên vẫn thấy 2 thông báo đè tên mình.

Cách đo: script chỉ đọc, server ở cổng 2767, Vite ở 5373, đã tắt sau khi đo. Script ở `/tmp/claude-0/-home-user-petgame/ee57c635-d235-5b8f-aee0-2769b26aceb9/scratchpad/t63/` (`tags.mjs`, `aimed.mjs`, `crowd.mjs`, `sim.ts`, `calc.ts`, thư mục `vt/`).

1. **Gần trùm, 390×844 có tai thỏ, 24 lần dịch chuyển** (`tags.mjs`):
   - 21 lần tên mình nằm đúng `restingNameTop` (lệch ≤ 0,6 px, đã tính thanh máu dưới tên).
   - 3 lần tên bị đẩy lên **16,3, 16,9 và 9,3 px**. Trong cả 3, thú đi theo đứng ngang hàng cạnh mình (lệch y −8 đến +10 px thế giới, x 46-56 px). Mép dưới nhãn của nó trên màn là 383-384, còn của mình là 382, nên nó được coi là "đứng trước": đặt trước, mình phải nâng.
   - Điều kiện của `settledBossLayout` không loại được trường hợp này: thú đi theo luôn ở đó, đứng yên, không phải thú hoang.
   - Chỗ dư của luật khi thanh hiện là 9,2-17,7 px (đo ở vòng 1), cộng 4 px cách tên. Bị đẩy 9-17 px là đủ đè, khớp lần hỏng 5 px.
2. **Tái hiện chắc chắn** (`aimed.mjs`, 390×844): `debug:spawnPal` đặt một thú 1 máu cách mình 40 px bên phải; nó thành thú đang nhắm (nhãn ghim hạng 1). Tên mình bị đẩy lên:
   - **21,5 px** với thú của vùng và với leafkit;
   - **15,9 px** với voltmouse;
   - 0 px với pebblet: nhãn của nó cao hơn nhãn mình nên nó tự nâng.

   Lần nào cũng lặp lại đúng như vậy.
3. **Phương án (c), thêm điều kiện "tên mình chưa bị đẩy" vào test: không chọn.** Đó là nới phép kiểm: trạng thái này người chơi gặp thật, và luật trong `hud.md` hứa rằng thông báo không đè tên.

### Cách sửa: nhãn của mình luôn giữ chỗ

Trong `comesFirst`, nhãn của mình (`LABEL_RANK.me`) luôn được đặt đầu tiên. Nó không bao giờ phải nâng, nên lúc đứng yên `restingNameTop` luôn đúng. Các nhãn ghim còn lại vẫn "con đứng trước giữ chỗ"; con nào vướng nhãn mình thì nâng qua, tối đa 48 px, hết chỗ thì thu gọn còn thanh máu, như mọi nhãn ghim.

Đây cũng là hướng đầu tiên mà rà soát T62 và T73 đề xuất.

**Phương án (b), cho `toastFit` đo mép trên thật của nhãn: không chọn.**
- Độ nâng đổi sau lúc đẩy thông báo: thú đi theo chạy tới sau khi dịch chuyển, thú đang nhắm đi vào. Mà thông báo đang hiện không bị cắt, nên vẫn đè. Không chắc chắn.
- Nếu đo theo trường hợp xấu nhất (−48 px) thì 390×844 có tai thỏ luôn chỉ còn 1 chỗ (dư 9-18 px), 390×844 không tai thỏ có lúc cũng vậy (dư 25-53 px). Bảng kết quả của T62 trong `hud.md` sẽ đổi.

**Hệ quả, đã đo bằng dữ liệu thật:**
- **Cảnh của `aimed.mjs`** (`calc.ts`): tên mình nâng 0 px; thú đang nhắm nâng 38 px, vẫn hiện đầy đủ, không bị ép đè.
- **Cảnh của e2e `labels: in a crowd on a phone`:** `crowd.mjs` dựng lại cảnh trong trình duyệt và ghi đầu vào bố cục của mọi nhãn trong 40 khung. `sim.ts` chạy lại `layoutTags` ngoài trình duyệt với cả hai cách xếp. Bản cũ cho đúng số của trình duyệt (mình +7,9, thú đi theo 0, thú đang nhắm +16,8), nên cách mô phỏng đáng tin.

  | | Mình | Thú đi theo | Thú đang nhắm | Nhãn chồng nhau | Nhãn thường bị ẩn |
  |---|---|---|---|---|---|
  | Cũ | +7,9 | 0 | +16,8 | không | 3/18 |
  | Mới | **0** | +29,1, đầy đủ | +26,9, đầy đủ | không | 4/18 |

  Nhãn ẩn thêm là một nhãn thường, không phải nhãn ghim.
- **Unit test chạy với bản sửa chép tạm** (`vt/`): chỉ test 3 và 5 phải đổi số. Test 4 giữ nguyên. Test 9 (300 đám đông ngẫu nhiên, đã thêm `mine.rise === 0`) và test 12 vẫn qua.

**Tài liệu** (game-designer đã sửa, coder không cần đụng):
- `docs/design/pals.md`, mục "Nhãn tên và thanh máu": luật nhãn ghim, kèm lý do và số đo;
- `docs/design/hud.md`, mục "Thông báo và tên mình khi cầm dọc": một câu nói tên mình không bao giờ bị nhãn khác đẩy lên.

**Phần T73 được làm luôn ở đây:** "`layoutTags` xếp nhãn ghim theo y nên tên mình có thể bị đẩy lên tới 48 px…". T73 còn lại:
- tên lên cao khi đang đi (camera trễ, khoảng 19 px);
- câu "hiện sau khi cái đầu hết" trong `hud.md`;
- e2e T62 kiểm `lag < 1` sau các lần thử.

Unit `toastRoom(1280, 500)` mà T73 nhắc đã có sẵn (`toastQueue.test.ts:48`), T73 có thể bỏ mục này.

### Kế hoạch triển khai vòng 2

10. **`packages/client/src/game/labelLayout.ts`, `comesFirst` (90-98).** Thêm hai dòng ở đầu thân hàm, trước so sánh nhãn ghim:
    ```ts
    const meA = a.rank === LABEL_RANK.me, meB = b.rank === LABEL_RANK.me;
    if (meA !== meB) return meA;
    ```
    Sửa chú thích (tiếng Anh) ở ba chỗ:
    - JSDoc của `comesFirst`: "My own tag first: it never rises, so the toast rule's `restingNameTop` holds (T63). Then pinned front to back…";
    - phần đầu file (dòng 6-7);
    - JSDoc của `restingNameTop`: số này đúng vì nhãn của mình không bao giờ bị nâng.

    Không đổi hằng số, hạng hay cỡ nâng nào.
11. **`packages/client/src/game/labelLayout.test.ts`:**
    - Test 3: đổi tên thành "3: pinned tags: mine keeps its place, the others go front to back, none hides". Mong đợi thứ tự `[mine, follower, aimed]`, cả ba dạng đầy đủ, độ nâng `[follower 23, mine 0, aimed 37]`.
    - Test 5: chú thích "The pal stands nearer the viewer, yet my own tag keeps its place: the pal rises". Mong đợi `wild` dạng đầy đủ, nâng 29; `mine` dạng đầy đủ, nâng 0.
    - Test 9: thêm `expect(mine.rise).toBe(0)` ngay sau `expect(mine.form)…`.
    - Thêm test 13 "my tag never rises, even with every other pinned tag right in front":
      - `me()` ở y 100;
      - thú đi theo ở y 104, thú đang nhắm ở y 108, thú đầu đàn ở y 112, cùng x 100, cỡ như `pinnedScene`;
      - mong đợi `mine.rise === 0`, `mine.form === TAG_FORM.full`, không nhãn ghim nào bị ẩn;
      - nhãn nào chồng nhãn mình thì phải là nhãn bị ép (`forced`).

      Kết quả đã tính bằng `calc13.ts`: mình nâng 0; thú đầu đàn nâng 31; thú đang nhắm thu gọn, nâng 0, nằm dưới tên mình; thú đi theo bị ép (`forced`), nâng 0, là nhãn duy nhất chồng tên mình. Test 13 kiểm đúng các số này.

    Số của test 3 và 5 đã tính bằng `calc.ts`.
12. **E2E mới trong `tests/e2e/multiplayer.spec.ts`**, đặt ngay sau test `aim: …` (dòng 1130). Tên: `labels: my name keeps its place when the aimed pal stands right by me (T63)`.
    - 390×844, chạm. Vào thế giới, chờ có khung hình.
    - Lặp lần lượt cho `{}` (thú của vùng) và `{ species: "voltmouse" }`:
      1. dịch chuyển tới một chỗ mới, cách chỗ trước 300 px;
      2. `spawnWeakPal(page, species)`;
      3. chờ `debugInfo().aim.id` bằng id con vừa đặt và nhãn của nó có `opacity` 1;
      4. chờ camera lệch < 1 px (`expect.poll`);
      5. trong **một** `evaluate`, đọc mép trên chữ tên mình (cộng 8 nếu chưa có lớp `hurt`, như `nameAndToasts` của T62), `game.hud.nameTop()`, hộp chữ và thanh máu của nhãn thú đang nhắm.
    - Kiểm:
      - `|mép trên tên − nameTop()| ≤ 1`;
      - nhãn thú đang nhắm không chồng tên mình (`boxesOverlap`);
      - nhãn đó hiện, có thanh máu.
    - Ở HEAD test này hỏng chắc chắn: lệch 21,4 và 15,8 px.
13. Không đổi test `boss bar (...)` hay luật thông báo. Phép kiểm chồng giữ nguyên.

### Kiểm chứng vòng 2

- **Kiểm tĩnh:** `npm run typecheck`; `npm test` (gồm `labelLayout.test.ts`); `tsc --strict` riêng file e2e như vòng 1.
- **Tái hiện chắc chắn** (tạm thời, không commit, trả file về nguyên trạng và so hash):
  - (d) Bỏ hai dòng mới trong `comesFirst`, chạy e2e ở bước 12: phải **hỏng** ở phép kiểm `≤ 1` (lệch khoảng 16-21 px). Trả lại hai dòng thì **qua**.
  - (e) Cũng bỏ hai dòng đó, chạy `npx vitest run packages/client/src/game/labelLayout.test.ts`: test 3, 5, 9 và 13 phải hỏng.
- **Lặp lại:**

  | Lệnh | Kỳ vọng | Ghi chú |
  |---|---|---|
  | `npx playwright test -g "boss bar \(phone upright, notch\)" --repeat-each 120` | 120/120 | Chia lô 10-20 hoặc chạy nền. Trước khi sửa khoảng 1/40 lần hỏng, nên còn lỗi mà qua cả 120 lần thì chỉ khoảng 5%. Bằng chứng chính là (d) |
  | `-g "my name keeps its place"` `--repeat-each 10` | 10/10 | |
  | `-g "labels: in a crowd"` `--repeat-each 10` | 10/10 | |
  | `-g "aim:"` `--repeat-each 3` | 3/3 | |
  | `-g "pack leaders"` `--repeat-each 2` | 4/4 | |
  | `-g "boss bar"` `--repeat-each 8` | 56/56 | |
  | `-g "toasts \("` `--repeat-each 3` | 18/18 | |
  | `npm run test:e2e` | qua hết | Chạy một lần cả bộ |

- **Nhìn bằng mắt** (không bắt buộc): `npm run shots -- --name t63`. Nhãn thú đi theo hay thú đang nhắm có thể nằm trên tên mình khi chúng đứng sát trước mình. Đó là chủ ý.

### Tiêu chí hoàn thành vòng 2

- [ ] Thay đổi sản phẩm chỉ gồm hai dòng ở `comesFirst` và chú thích trong `labelLayout.ts`. Không đổi hằng số, `LABEL_RANK`, `hud.ts`, `toastQueue.ts`, CSS hay server.
- [ ] Unit: test 3 và 5 mang số mới (`[23, 0, 37]` và `29 / 0`). Test 9 kiểm `mine.rise === 0`. Có test 13. `npm test` qua.
- [ ] Có e2e ở bước 12. Nó hỏng khi bỏ hai dòng mới (thí nghiệm d) và qua khi có.
- [ ] Không phép kiểm nào của test `boss bar (...)`, `labels: in a crowd`, `aim:`, T61 hay T62 bị nới hay bỏ.
- [ ] Các lệnh lặp ở trên đạt đủ số lần; `npm run test:e2e` cả bộ qua.
- [ ] Mọi tiêu chí vòng 1 vẫn đúng, trừ dòng "chỉ `tests/e2e/multiplayer.spec.ts` đổi": nay đổi thêm `labelLayout.ts`, `labelLayout.test.ts`, và `docs/design/pals.md`, `docs/design/hud.md` (game-designer đã sửa).

### Rủi ro vòng 2

- **Nhãn thú đi theo và thú đang nhắm nằm xa con thú hơn** khi nó đứng sát trước mình: tới 38 px trong lần đo. Hết 48 px thì nhãn thu gọn còn thanh máu. Thú đang nhắm vẫn luôn có thanh máu và vòng ngắm (T28). Đổi lại, tên mình đứng yên giữa màn hình, và luật thông báo đúng.
- **Đám đông rất chật có thể ẩn thêm vài nhãn thường** (mô phỏng: 3 thành 4 trên 18). Nhãn ghim không bao giờ bị ẩn.
- **Còn lại:** khi đang đi, camera trễ làm tên cao hơn (T73). Thông báo vẫn có thể đè tên trong lúc đi. Không thuộc vòng này.
- Không có dòng "CHẶN:".

### Việc cho agent chính (thêm)

- **T73:** bỏ mục "`layoutTags` đẩy tên mình lên" (đã làm ở T63 vòng 2) và mục unit `toastRoom(1280, 500)` (đã có ở `toastQueue.test.ts:48`). Giữ các mục còn lại.
- Khi commit T63, kèm `docs/design/pals.md` và `docs/design/hud.md`.
