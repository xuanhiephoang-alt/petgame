# PLAN: T61 Điện thoại ngang thấp (cao 375 px): thông báo vượt mốc ngón cái

Đọc code ở HEAD `ad7db98`. File liên quan:
- `packages/client/index.html`:
  - `.hud-health`, `.hud-actions`, `.hud-time`, `.hud-region` ở dòng 93-104;
  - `.hud-left`, `.hud-status`, `.hud-quest` ở dòng 117-127;
  - `.invite-btn` ở dòng 133, vùng chạm 44 px (`::before`) ở dòng 257-259;
  - khối điện thoại ngang `@media (max-height: 520px) and (min-width: 601px)` ở dòng 404-419.
- `packages/client/src/ui/hud.ts`:
  - hàng máu dựng ở dòng 51-67 (`actionsRow` chứa 🫐 Ăn và 🔊);
  - bắt sự kiện nút 🔗 bằng `click` uỷ quyền trên `this.status` ở dòng 79-87;
  - `setTime` ở dòng 178-183; `setStatus` ở dòng 202-216 (trên cảm ứng nút 🔗 nằm trong `innerHTML` của ô trạng thái).
- `tests/e2e/multiplayer.spec.ts`: `expectTouchable` (dòng 467), `sendFrom` (1392), `toastLayout` (2416), `boxesOverlap` (2436), `TOAST_SCREENS` và test `toasts (...)` (2439-2493), `safeArea` (2502), `bossLayout` (2527), `watchHurt` (2593), `bossPosition` (2604), `settledBossLayout` (2618), `BOSS_SCREENS` và test `boss bar (...)` (2649-2839; hàm `goNearBoss` nằm trong thân test, dòng 2711-2740).

### Số đo (script tạm trong scratchpad, chỉ đọc)

**Cách đo.** Giống e2e:
- Server `PETGAME_DEBUG=1`, `PETGAME_DB=:memory:` ở cổng trống 2667; Vite ở 5273 với `VITE_SERVER_URL`.
- Chromium `/opt/pw-browsers/chromium` (`scripts/chromium.mjs`), `hasTouch`, `isMobile`.
- Tai thỏ giả lập bằng CDP `Emulation.setSafeAreaInsetsOverride`, như `safeArea`.
- Cảnh như test `toasts (...)`: Emberpup cấp 8, chờ ô nhiệm vụ có chữ ("Bắt con thú đầu tiên"), chờ hết thông báo, rồi đẩy 2 thông báo dài nhất. Cầm ngang thì chỉ 1 cái hiện: phần thưởng trùm, 3 dòng, cao 61 px.
- Lần đo thứ hai: dịch chuyển tới 260 px phía nam trùm, chờ `.boss-bar` hiện, rồi đẩy lại 2 thông báo.
- Toạ độ là `[trái, trên, phải, dưới]`, đơn vị px. Mốc ngón cái là cao − 140.

**Bây giờ** (có thanh trùm hay không thì số như nhau: khi cầm ngang thanh nằm giữa trên, ngoài cột):

| Màn | Cột | Hàng máu | Trạng thái | Nhiệm vụ | Đáy thông báo | Mốc |
|---|---|---|---|---|---|---|
| 812×375, tai thỏ trái/phải 44, dưới 21 | `[44..296]` | 12-84 | 88-136, **2 dòng** | 140-181 | **246** | 235 |
| 667×375 | `[12..224]` | 12-84 | 88-136, **2 dòng** | 140-195 (gợi ý 2 dòng) | **260** | 235 |
| 844×390 | `[12..312]` | 12-84 | 88-117, 1 dòng | 121-162 | 210 | 250 |
| 844×390, tai thỏ 47 | `[47..312]` | 12-84 | 88-136, 2 dòng | 140-181 | 246 | 250 |

- Thanh trùm khi cầm ngang: 812 tai thỏ `[308..504]`, 667 `[276..391]`. Nó không đổi gì trong cột.
- Ô trạng thái xuống dòng vì nút "🔗 Mời bạn" (88 px) không còn chỗ sau các con số: "👥 1/5 🐾 1 🪵 0 🪨 0 🫐 0" dài 176 px, mà phần chữ của ô chỉ rộng 196 px (667) hoặc 236 px (812 tai thỏ).
- Dòng 2 của hàng máu (🫐 Ăn 54 px, 🔊 44 px, cao 44 px) còn trống phía phải: 92 px ở 667, 133 px ở 812 tai thỏ.
- Người chơi lâu, ô trạng thái đầy nhất (5/5 người, 12 thú, 999 mỗi tài nguyên, 🛶 và 3 món đang mặc): 812 tai thỏ 2 dòng, đáy 246; 667 3 dòng, đáy **279**.

**Thử bản thiết kế dưới đây** (CSS chèn vào trang và dựng lại DOM bằng script, không sửa file):

| Màn | Hàng máu | Trạng thái | Nhiệm vụ | Đáy thông báo | Mốc |
|---|---|---|---|---|---|
| 812×375, tai thỏ 44 | 12-81 | 84-107, 1 dòng | 110-151 | **214** | 235 |
| 667×375 | 12-81 | 84-107, 1 dòng | 110-165 | **228** | 235 |
| 844×390 | 12-81 | 84-107 | 110-151 | 198 | 250 |
| 844×390, tai thỏ 47 | 12-81 | 84-107 | 110-151 | 214 | 250 |

- Có thanh trùm: số y hệt. Thanh vẫn ở chỗ cũ (`[308..504]`, `[276..391]`), không chồng nút 🔗 (812: `[160..221]`; 667: `[128..189]`).
- Nút 🔗 Mời: hộp 61×21, vùng chạm thật 61×44 (`::before`), không bị gì đè.
- Đã thử lúc hoàng hôn (chữ giờ dài nhất, "🌇 Hoàng hôn"):
  - Nếu giữ nguyên chữ giờ thì ở 667 dòng 1 hàng máu tràn. "100/100" rơi xuống dòng 2, đẩy cụm nút xuống dòng 3: hàng máu cao 85, đáy thông báo **244**.
  - Vì vậy chữ giờ chỉ còn biểu tượng khi cầm ngang (bước 1). Khi đó hàng máu cao 69 ở mọi giờ, đáy 228.
- Điện thoại dọc 390×844 và 360×640 với cách dựng ô trạng thái mới (bước 2): hộp ô trạng thái và nút 🔗 trùng từng px với bây giờ (`[12,88,262,136]` / `[12,88,232,136]`; nút `[24,111,112,132]`).
- Ô trạng thái đầy nhất (như trên): 812 tai thỏ 2 dòng, đáy 231 ≤ 235; 667 2 dòng, đáy **245** (trước là 279). Xem "Rủi ro".

## Mục tiêu

Trên iPhone cầm ngang (cao 375 px: iPhone X/11 Pro/12 mini có tai thỏ, iPhone SE/8), thông báo hiện tại kéo xuống quá mốc cao − 140 (T18), vào đúng góc ngón cái trái đặt cần điều khiển. Sau nhiệm vụ này:
- ô trạng thái gọn lại còn một dòng;
- thông báo dài nhất kết thúc trên mốc 235, có hay không có thanh máu trùm;
- không bỏ con số nào, không làm nút nào nhỏ hơn 44 px, và giữ nguyên luật "cột trước giữa màn hình 100 px" cùng chỗ của thanh trùm (T30).

## Phạm vi

Làm, chỉ khi cầm ngang (khối `@media (max-height: 520px) and (min-width: 601px)`, cùng khối đang có cho điện thoại ngang):
1. Nút 🔗 Mời rời ô trạng thái, sang dòng 2 của hàng máu, cạnh 🫐 Ăn và 🔊. Nhãn ngắn "🔗 Mời".
2. Ô trạng thái chỉ còn các con số, khoảng cách hẹp hơn, chữ thấp hơn (line-height 1.4).
3. Chữ giờ chỉ còn biểu tượng (☀️ 🌇 🌙 🌅), như tên vùng đã ẩn từ T6. Nhờ vậy dòng 1 hàng máu không bao giờ tràn.
4. Khoảng cách giữa các ô của cột 4 → 3 px; khoảng cách giữa 2 dòng của hàng máu 5 → 2 px.
5. Một e2e mới cho 812×375 có tai thỏ và 667×375, đo khi không có và khi có thanh trùm.
6. Cập nhật `docs/design/hud.md` (đã làm cùng kế hoạch này).

**Không** làm:
- Không đổi điện thoại dọc và desktop. Dọc vẫn "🔗 Mời bạn" cuối ô trạng thái, hộp trùng từng px như trên. T62 (thông báo đè tên khi cầm dọc) là việc riêng.
- Không đổi `toastQueue.ts` (`toastRoom`, mốc 520/760), thanh máu trùm, ô nhiệm vụ, thông báo, cột nút phải, bản đồ nhỏ, server, shared.
- Không sửa test có sẵn: không đổi `TOAST_SCREENS`, `BOSS_SCREENS`, `goNearBoss` hay một dòng nào của các test đang có. Chỉ thêm.
- Không xử lý màn 640×360 và ô trạng thái đầy nhất ở 667 (xem "Đề xuất tách việc").

## Thiết kế

**Hàng máu khi cầm ngang** (rộng như cột):
- Dòng 1: `☀️ ❤️ [thanh máu 64 px] 100/100`, dài 152 px.
- Dòng 2: `[🫐 Ăn] [🔊] [🔗 Mời]`, dài 169 px, cao 44 px.
- Phần chữ của hàng hẹp nhất trong phạm vi là 182 px (640 rộng). Vì vậy cả hai dòng luôn vừa, ở mọi giờ, có hay không tai thỏ; hàng cao đúng 69 px. Trước đây là 72 px, nhưng "100/100" phải xuống dòng 2 lúc chữ giờ dài.
- Chữ giờ ("Ngày", "Hoàng hôn"...) ẩn khi cầm ngang, chỉ còn biểu tượng. Ánh sáng của thế giới đã cho thấy ngày hay đêm. Chữ vẫn nằm trong DOM (`textContent` của `.hud-time` không đổi, test "HUD shows health, time of day..." vẫn đọc được), và có `title`.

**Nút 🔗 Mời khi cầm ngang:**
- Nằm trong `.hud-actions`, sau 🔊.
- Chữ "🔗 Mời". Chữ " bạn" nằm trong `<span class="invite-more">` và ẩn khi cầm ngang. `aria-label="Mời bạn"` ở mọi màn, nên trình đọc màn hình đọc như nhau.
- Hộp 61×21, vùng chạm 61×44 (`::before` sẵn có của T18), không chồng vùng chạm của 🔊 (cách 5 px).
- Vẫn nghe `click` (cần "cử chỉ người dùng" để mở bảng chia sẻ, T39).
- Lý do chọn hàng máu: dòng 2 đã cao 44 px vì Ăn và 🔊, phần bên phải còn trống, nên nút vào đó không tốn thêm chiều cao nào. Ba nút chạm được của cột về chung một hàng, đều trong nửa trái (ngón cái trái), trên vùng cần điều khiển.
- Đã bỏ các phương án khác:
  - Chỉ thu nhỏ nút thành "🔗" 44 px trong ô trạng thái: 157 + 4 + 44 = 205 > 196 px ở 667, vẫn xuống dòng.
  - Đưa ô trạng thái sang dưới bản đồ nhỏ: dời phần HUD sang nửa phải, đổi luật bố cục lớn hơn mức việc này cần.
  - Cắt gợi ý của ô nhiệm vụ còn 1 dòng: mất đúng chữ "rồi ném bóng" của nhiệm vụ đầu tiên trên iPhone SE.

**Ô trạng thái khi cầm ngang:** `👥 1/5 🐾 1 🪵 0 🪨 0 🫐 0` (thêm biểu tượng đồ nếu có).
- Mỗi con số (biểu tượng và số) là một `<span class="hud-count">` không bị ngắt giữa chừng. Giữa hai con số là 1 dấu cách + 2 px; trước đây là ` &nbsp; `, khoảng 10 px.
- Chữ 12 px, line-height 1.4, đệm 3 px trên dưới: ô cao 22,8 px khi 1 dòng.
- Số lớn thì vẫn được xuống dòng giữa các con số, không cắt, không mất số nào.

**Điện thoại dọc:** cùng cấu trúc DOM (các `.hud-count` và nút 🔗 cuối ô), nhưng khoảng giữa hai con số là 1 dấu cách + 6 px, nhãn "🔗 Mời bạn" đủ. Đo: hộp như cũ từng px.

**Xoay máy:** nút đổi chỗ ngay khi bố cục đổi (`matchMedia(...).addEventListener("change")`), cùng điều kiện với khối CSS cầm ngang. Nút là một phần tử duy nhất, chỉ được chuyển chỗ, nên vẫn giữ trình nghe sự kiện và `data-link`.

**Desktop:** không đổi gì (vẫn có link mời trong ô trạng thái, không có nút 🔗).

**Kết quả:** xem bảng "Thử bản thiết kế". Đáy thông báo 214 và 228, dưới mốc 235 (còn 21 và 7 px). Cột vẫn kết thúc ở 296 và 224, trước giữa màn hình − 100 (306 và 233).

## Kế hoạch triển khai

### 1. `packages/client/src/ui/hud.ts`

a. Đầu file, sau `TOAST_FADE_MS`:
```ts
/**
 * Phones held sideways: the same condition as the short-screen block in index.html. There the invite button sits
 * with Ăn and 🔊 in the health row, so the status panel keeps to one line (T61, docs/design/hud.md).
 */
const SIDEWAYS_QUERY = "(max-height: 520px) and (min-width: 601px)";
```

b. Trường mới (cạnh `status`):
```ts
  /** Touch screens: the counts in the status panel (players, pals, resources, gear). */
  private statusCounts?: HTMLSpanElement;
  /** Touch screens: 🔗 Mời bạn. Last in the status panel, or after 🔊 in the health row on a sideways phone. */
  private inviteButton?: HTMLButtonElement;
```

c. Constructor, ngay sau `this.health.append(actionsRow);` (dòng 67): chỉ khi `isTouch`.
- Tạo `<span class="hud-counts">` gán vào `this.statusCounts`, rồi `this.status.append(counts, " ")`.
- Tạo nút: `className = "invite-btn"`, `setAttribute("aria-label", "Mời bạn")`, `innerHTML = '🔗 Mời<span class="invite-more"> bạn</span>'`.
- Gắn `click` thẳng vào nút, giữ nguyên thân xử lý của dòng 81-87 nhưng đọc `button.dataset.link`:
  - có `navigator.share` thì mở bảng chia sẻ (`title`, `text`, `url` như cũ), `.catch(() => {})`;
  - không có thì `navigator.clipboard?.writeText`, xong thì toast "Đã chép link mời 🔗" mức `low`, lỗi thì toast chính link đó.
- Đặt chỗ:
  ```ts
  const sideways = window.matchMedia(SIDEWAYS_QUERY);
  const placeInvite = () => (sideways.matches ? actionsRow : this.status).append(button);
  placeInvite();
  sideways.addEventListener("change", placeInvite);
  ```
- Xoá trình nghe `click` uỷ quyền trên `this.status` (dòng 79-87). Chú thích cũ ("It stays on click: both need a user gesture...") chuyển lên trình nghe mới.

d. `this.health.innerHTML` (dòng 52): giữ nguyên, `.hud-time` vẫn rỗng lúc đầu.

e. `setTime`: bảng nhãn thành biểu tượng + chữ:
```ts
const labels = { day: ["☀️", "Ngày"], dusk: ["🌇", "Hoàng hôn"], night: ["🌙", "Đêm"], dawn: ["🌅", "Bình minh"] } as const;
```
- Ghi `el.innerHTML = \`${icon}<span class="hud-time-word"> ${word}</span>\`` và `el.title = word`. Vẫn chỉ ghi khi pha đổi (`lastTime`).
- Lấy `.hud-time` một lần: dùng `querySelector` như bây giờ là đủ, vì hàm chỉ chạy khi pha đổi.
- `textContent` vẫn là "☀️ Ngày", nên test desktop `toHaveText(/Ngày|.../)` không đổi.

f. `setStatus`:
- Nhánh cảm ứng:
  - Dựng `counts = [\`👥 ${players}/${MAX_PLAYERS}\`, \`🐾 ${captured}\`, ...RESOURCES.map((r) => \`${RESOURCE_INFO[r].icon} ${resources[r]}\`), ...(gear ? [gear] : [])]`.
  - `html = counts.map((c) => \`<span class="hud-count">${c}</span>\`).join(" ")`.
  - Chỉ ghi `this.statusCounts.innerHTML` khi `html !== this.lastStatus`.
  - Gán `this.inviteButton.dataset.link = invite` khi khác. `dataset` không cần `escapeHtml`.
  - Không ghi lại `this.status.innerHTML`: nó sẽ xoá mất nút.
- Nhánh desktop giữ nguyên từng ký tự (biến `help`, `items` với ` &nbsp; `, link, `escapeHtml`).
- Biến `help` chỉ desktop dùng. Đưa nó vào nhánh desktop để `noUnusedLocals` không báo, và để code dễ đọc.

g. JSDoc của lớp và của `left`: thêm "the invite button (touch) moves to the health row when sideways".

### 2. `packages/client/index.html`

a. Sau `.hud-status a` (dòng 134), thêm:
```css
      /* Phones: each count (icon and number) stays whole on its line; the gap matches the old " &nbsp; " (T61). */
      .hud-count { white-space: nowrap; }
      .hud-count + .hud-count { margin-left: 6px; }
```

b. Trong khối `@media (max-height: 520px) and (min-width: 601px)` (dòng 405-419):
- `.hud-left { ...; gap: 4px; }` → `gap: 3px;`
- `.hud-health { font-size: 12px; gap: 5px; padding: 4px 8px; }` → `gap: 2px 5px;` (`.hud-actions` có `gap: inherit` nên giữ 5 px giữa các nút).
- `.hud-status { font-size: 12px; padding: 4px 8px; line-height: 1.6; }` → `padding: 3px 8px; line-height: 1.4;`
- Ngay sau `.hud-region { display: none; }` thêm `.hud-time-word { display: none; }`.
- Thêm (kèm chú thích):
  ```css
        /* T61: on screens 375 px tall the toast must end 140 px above the bottom (the thumb corner). The invite button
           sits after 🔊 in the health row (hud.ts moves it), short label; the status keeps to one line of counts. */
        .hud-count + .hud-count { margin-left: 2px; }
        .hud-actions .invite-btn { margin-left: 0; }
        .invite-more { display: none; }
  ```
- Không đổi `max-width` của cột, `.boss-bar`, `.minimap`, `.party-panel`, `.toast`.

c. Không đổi khối `@media (max-width: 600px)` (dọc) hay CSS desktop.

### 3. `tests/e2e/multiplayer.spec.ts`: thêm (không sửa gì có sẵn)

Đặt sau vòng `for (const screen of BOSS_SCREENS)` (sau dòng 2839).

a. Helper `nearBoss(page: Page): Promise<void>`, khai báo trên cùng tầng file.
- Cách chọn chỗ giống `goNearBoss` trong test `boss bar (...)`:
  - lấy trùm bằng `bossPosition`;
  - thử 8 hướng × bán kính 180/260/340 px, chọn chỗ xa thú hoang nhất;
  - `debug:teleport` tới đó, chờ `.boss-bar` hiện (30 s); thử 2 lần.
- JSDoc ghi rằng test `boss bar (...)` còn giữ bản riêng của nó (T61 không sửa test cũ), kèm đề xuất gộp ở "Đề xuất tách việc".

b. Hằng số:
```ts
/** Phones held sideways on a 375 px tall screen (T61): iPhone X/11 Pro with its notch, iPhone SE/8. */
const SHORT_SIDEWAYS_SCREENS = [
  { name: "812×375, notch", options: { viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true }, insets: { left: 44, right: 44, bottom: 21 } },
  { name: "667×375", options: { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true }, insets: undefined },
] as const;
```

c. Mỗi màn một test, `test.slow()`. Tên:
`short sideways phone (${screen.name}): one-line status, 🔗 Mời by Ăn and 🔊, the toast ends above the thumb corner with and without the boss bar`

1. **Vào thế giới.**
   - `join(browser, "Hiệp", "/", { ...screen.options }, screen.insets ? safeArea(screen.insets) : undefined)`, `waitForWorld`, chờ `frames > 0`, `watchHurt(page)`.
   - Kiểm tai thỏ đã có tác dụng: mép trái `.hud-left` = `max(12, L)` ±1, như test `boss bar`.
2. **Chuẩn bị.** `debug:givePal` emberpup cấp 8, chờ `companions.size === 1`, `.skill-bar` hiện, `.hud-quest` có chữ. Chờ hết thông báo (`toHaveCount(0)`, 20 s).
3. **Hàng máu và ô trạng thái, lúc hoàng hôn** (chữ giờ dài nhất).
   - `sendFrom(page, "debug:setTime", { t: 0.66 })` (hoàng hôn kéo dài 0,65-0,72 của 8 phút, tức còn khoảng 29 s), rồi `expect(page.locator(".hud-time")).toContainText("Hoàng hôn")`.
   - Kiểm:
     - `.invite-btn` có đúng 1 cái (`toHaveCount(1)`), nằm trong `.hud-health .hud-actions`, và `.hud-status button` có 0 cái.
     - `.invite-btn` có `toHaveText("🔗 Mời", { useInnerText: true })` và `toHaveAttribute("aria-label", "Mời bạn")`.
     - `.hud-time-word` ẩn (`toBeHidden()`).
     - Đo một lần bằng `page.evaluate`:
       - cao `.hud-status` ≤ 24 (đo 22,8: 1 dòng);
       - cao `.hud-health` ≤ 70 (đo 69);
       - tâm theo chiều dọc của `.eat-btn`, `.sound-btn`, `.invite-btn` lệch nhau ≤ 2 (cùng một dòng; nút 🔗 thấp hơn nhưng căn giữa dòng 44 px, đo: cả ba tâm ở y = 55);
       - mép phải của `.invite-btn` ≤ mép phải `.hud-health` − 7 (nằm trong hàng, không tràn).
     - `expectTouchable(page, ".hud-left", screen.name)` trả về danh sách chứa `.eat-btn`, `.sound-btn`, `.invite-btn`: mỗi nút có vùng chạm thật ≥ 44×44.
4. **Xoay máy.**
   - `page.setViewportSize({ width: 375, height: 812 })`, rồi `expect(page.locator(".hud-status .invite-btn")).toHaveCount(1)` và `toHaveText("🔗 Mời bạn", { useInnerText: true })`.
   - Trả lại cỡ cũ (`screen.options.viewport`), rồi `expect(page.locator(".hud-actions .invite-btn")).toHaveCount(1)`.
   - Thay `navigator.share` bằng hàm giả như test `touch (...)` (dòng 365-373), `tap()` nút. `window.__shared` phải bằng `{ title: "PetGame", text: "Vào chơi cùng mình!", url: link }`, với `link = data-link` có `room=<roomId>`. Nút vẫn chạy sau khi đổi chỗ 2 lần.
5. **Thông báo, không có thanh trùm.**
   - `.boss-bar` ẩn (`toBeHidden()`). Chỗ xuất phát ở đồng cỏ, xa trùm.
   - Đẩy 2 thông báo dài nhất bằng đúng hàm `pushToasts` như test `toasts` (chép 2 chuỗi đó). Chờ `toHaveCount(1)` cho `.hud-toasts > .toast:not(.out)`, rồi chờ hiệu ứng trượt vào xong (như dòng 2755).
   - `const layout = await toastLayout(page)`, kiểm:
     - đúng 1 thông báo;
     - mỗi thông báo: `left ≥ 0`, `right ≤ width`, **`bottom ≤ height − 140` (235)**, không chồng phần nào trong `layout.hud` (`boxesOverlap`), `top ≥` đáy phần có tên `hud-quest` trong `layout.hud`;
     - `layout.columnRight ≤ width / 2 − 100`.
6. **Thông báo, có thanh trùm.**
   - `await nearBoss(page)`, chờ hết thông báo (20 s), `pushToasts`, chờ `toHaveCount(1)` và hiệu ứng xong.
   - `const layout = await settledBossLayout(page, () => nearBoss(page), (l) => l.toasts.length === 1, pushToasts)`.
   - Kiểm:
     - `expectBarClear(layout, screen.name)`: thanh không chồng hàng máu, 🫐, 🔊, 🔗, trạng thái, nhiệm vụ, nút phải, bản đồ, nút cảm ứng, tên mình; số máu không bị cắt; chữ 1 dòng.
     - Chỗ của thanh như T30:
       - `position === "absolute"`;
       - |tâm − width/2| ≤ 1;
       - |`bar.top` − `left.top`| ≤ 1;
       - `bar.left ≥ columnRight + 8`;
       - `bar.right ≤ minimapLeft − 8 + 0.5` (ở 667 thanh cách bản đồ đúng 8 px; 0,5 cho làm tròn dưới px);
       - `questShown === true`.
     - Thanh trong vùng an toàn: `left ≥ L − 1`, `right ≤ width − R + 1`.
     - Mỗi thông báo: **`bottom ≤ height − 140`**, không chồng `[layout.bar, ...layout.parts]` (thông điệp lỗi như dòng 2765).
     - `columnRight ≤ width / 2 − 100`.

**Test có sẵn phải qua, không sửa một dòng:**
- `toasts (phone sideways)`: đáy 198 ≤ 250.
- `boss bar (phone sideways[, notch])`: đáy 198 và 214 ≤ 250; nút 🔗 (`[128..189]`, `[163..224]`) vẫn ngoài thanh `[322..522]`.
- `touch (phone sideways)`: `invite-btn` vẫn có tâm ở nửa trái, nằm trên cùng, `tap` mở bảng chia sẻ.
- `touch targets (phone sideways)`: 🔗 61×44.
- Mọi test cầm dọc và desktop: DOM dọc chỉ thêm span, hộp như cũ; desktop không đổi.
- "HUD shows health, time of day...": desktop, `textContent` của `.hud-time` vẫn có chữ.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, server hay shared. Chỉ client (DOM/CSS) và e2e.

## Test

- Unit, tích hợp: không thêm. Không có logic dùng chung mới; `Hud` không có unit test, và matchMedia/bố cục chỉ kiểm được trong trình duyệt.
- E2E: 2 test mới (mục 3), chạy riêng bằng `npx playwright test -g "short sideways phone"`. Rồi chạy toàn bộ `npm run test:e2e`.
- Tester nên chạy thêm `-g "toasts \\(|boss bar \\(|touch"` để thấy sớm nếu test cũ hỏng.

## Tiêu chí hoàn thành

- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch. `npm run test:e2e` qua toàn bộ, kể cả 2 test `short sideways phone (...)` mới.
- [ ] Không có dòng nào của test có sẵn bị sửa hoặc xoá (`git diff` của `multiplayer.spec.ts` chỉ có dòng thêm).
- [ ] Ở 812×375 có tai thỏ 44 và 667×375, khi có và không có thanh máu trùm: thông báo dài nhất (1 cái) kết thúc ≤ 235 px. Số đo bản thử: 214 và 228.
- [ ] Khi cầm ngang:
  - ô trạng thái 1 dòng (cao ≤ 24) với số liệu lúc mới vào;
  - hàng máu cao ≤ 70 ở mọi giờ, kể cả "Hoàng hôn";
  - chữ giờ chỉ còn biểu tượng.
- [ ] Nút 🔗 Mời khi cầm ngang:
  - nằm sau 🔊 trong hàng máu, nhãn "🔗 Mời", `aria-label="Mời bạn"`;
  - vùng chạm thật ≥ 44×44;
  - mở bảng chia sẻ bằng `click`;
  - đổi chỗ đúng khi xoay máy, chỉ có đúng 1 phần tử `.invite-btn`.
- [ ] Cầm dọc: nút "🔗 Mời bạn" vẫn ở cuối ô trạng thái; hộp ô trạng thái và nút như trước (390×844: `[12,88,262,136]`, nút `[24,111,112,132]`). Desktop không đổi.
- [ ] Thanh máu trùm cầm ngang giữ đúng chỗ của T30 (giữa trên, cách cột ≥ 8, cách bản đồ ≥ 8), không chồng phần nào của HUD. Cột kết thúc ≤ giữa − 100.
- [ ] `setStatus` không ghi DOM khi các con số không đổi. Nút 🔗 không bị tạo lại mỗi lần cập nhật (một phần tử dùng suốt). Không có `querySelector` mới chạy mỗi khung.
- [ ] Không đổi `toastQueue.ts`, `Game.ts`, server, shared.
- [ ] `docs/design/hud.md` khớp với code (đã cập nhật cùng kế hoạch: bảng bố cục, mục "Hàng trạng thái và nút 🔗 khi cầm ngang", "Vùng an toàn", "Cỡ chạm").

## Rủi ro, câu hỏi mở

- **Font trên CI khác container.** Ở 667 còn dư 7 px. Nếu font khác làm thông báo 4 dòng (+17 px) hay gợi ý nhiệm vụ 3 dòng thì sẽ hỏng. Khi đó báo lại kèm số đo, **không** nới mốc 235.
- **Ô trạng thái đầy nhất ở 667** (3 tài nguyên ≥ 100, 12 thú trở lên, có đồ): xuống 2 dòng, đáy 245 > 235. Vẫn tốt hơn bây giờ (279), và người mới (trường hợp e2e đo) đạt. 812 có tai thỏ vẫn đạt (231). Đề xuất tách việc bên dưới.
- **Màn 601-~615 px rộng**: dòng 2 hàng máu (169 px) rộng hơn phần chữ (162 px) nên tràn 6 px sang phải. Không có điện thoại phổ biến nào cầm ngang ở cỡ này (iPhone SE đời đầu 568 px rộng dùng bố cục dọc ≤ 600). Chấp nhận.
- **Thanh trùm cách bản đồ nhỏ 8 px, không phải 12 px như `hud.md` viết ở T30**: viền 2 px mỗi bên của bản đồ không được tính. Không đổi hành vi, chỉ sửa câu trong tài liệu (đã sửa). Test mới kiểm ≥ 8 như test T30.
- **Hoàng hôn trong test** chỉ kéo dài khoảng 29 s sau `debug:setTime 0.66`. Bước 3 đo ngay khi chữ hiện, nên không cần lâu hơn. Ở bước 6 không cần hoàng hôn: chữ giờ đã ẩn nên giờ nào cũng như nhau.
- Không có "CHẶN:".

### Đề xuất tách việc (agent chính thêm vào `TASKS.md`)

1. **Điện thoại ngang 640×360 (Android): thông báo quá mốc ngón cái** (P3). Sau T61, đáy 228 > 360 − 140 = 220 (trước T61 là 260). Hướng làm: gợi ý nhiệm vụ gọn hơn khi cao ≤ 360, hoặc thông báo chữ 12 px; đo lại bằng test `short sideways phone`.
2. **Ô trạng thái đầy ở 667×375 xuống 2 dòng** (P3). Ví dụ "👥 5/5 🐾 12 🪵 999 🪨 999 🫐 999" kèm đồ thì đáy thông báo 245 > 235. Hướng làm: khi cầm ngang ẩn biểu tượng đồ (đã thấy trên nhân vật và trong Tủ đồ), hoặc viết gọn số ≥ 1000 ("1,2k"). Thêm trường hợp ô đầy vào e2e.
3. **Dọn test**: cho test `boss bar (...)` dùng `nearBoss` (T61) thay bản `goNearBoss` riêng trong thân test, để bỏ chỗ trùng lặp (P3, chỉ đổi test).
