# PLAN: T14 Bộ ảnh `npm run shots`: cảnh chắc chắn, thêm chiêu, thú đầu đàn, thanh chiêu điện thoại, thông báo

Code đọc ở `40bcbe7` ("Mark T83 done, add T84, start T14"). Nguồn: dòng T14 trong `TASKS.md`; `scripts/shots.mjs` hiện tại (398 dòng, nhóm `world`, `labels`, `aim`); e2e `tests/e2e/multiplayer.spec.ts` (`toastLayout` quanh dòng 2519, `TOAST_SCREENS` 2542, `settledBossLayout` 2721, `watchHurt` 2696, ★ đầu đàn 894, `skills:` 801); kết quả so sánh cũ của T11 (`shotdiff.py` trong scratchpad, không có trong repo). Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Việc này là logic script (dựng cảnh, kiểm tra an toàn, so sánh báo cáo) kèm unit test, không vẽ hay sửa hình nào, nên giao coder chứ không giao asset-manager. Tester chạy bộ ảnh hai lần và tự xem vài ảnh mới bằng Read.

## Mục tiêu

`npm run shots` là cách duy nhất đội có để so hình trước/sau một thay đổi. Hiện tại nó có hai lỗi lớn:

1. **Kết quả may rủi.** Số liệu đo được, lấy từ hai lần chạy cùng code ở T11 (`shotdiff.out` trong scratchpad):

   | Ảnh | Số sprite lần 1/2/3 | Độ lệch ảnh giữa 2 lần cùng code |
   |---|---|---|
   | `snow` | 232 / 278 / 413 | 70,98 |
   | `desert` | 301 / 214 / 213 | 51,34 |
   | `swamp` | 303 / 294 / 289 | 32,12 |
   | `island` | 162 / 163 / 166 (T14 ghi từng thấy 163 → 293) | 25,61 |
   | `labels-*-alpha` | 292 / 277 / 322... | 20-30 |

   Cùng code mà độ lệch như vậy thì không so trước/sau được. **Nguyên nhân tìm được khi tính vị trí:** 4 chỗ chụp vùng nằm ngay trong hang thú đầu đàn. Thú đầu đàn tấn công ai lại gần trong `ALPHA.sight` = 170 px, và lang thang trong `ALPHA.roam` = 128 px quanh hang (`alphaLairs()`, `packages/shared/src/alphas.ts`). Khoảng cách từ chỗ chụp tới hang: `snow` 52 px, `desert` 10 px, `swamp` 34 px, `island` 37 px. Người chơi bị cắn, bị đẩy, hoặc bị hạ rồi về lửa trại ngay trước khi chụp. Cảnh `labels-*-alpha` cố ý bước vào 105 px rồi chụp sau 1,1 s, nhưng cú cắn đầu tiên tới sau khoảng 0,9 s (đuổi 65 px ở 152 px/s, rồi gồng `WILD_WINDUP_MS` 450 ms), và chiêu có thể ra sớm hơn (`ALPHA.skillChance` 0,08 mỗi tick, trong 1 s là khoảng 81%).
2. **Thiếu nội dung mới:** chưa có ảnh nào cho chiêu đang bay, thú đầu đàn, thanh chiêu trên điện thoại, chồng thông báo (T6), hay nhãn ★ của thú đầu đàn đã bắt (T8).

Sau T14:
- Mỗi cảnh hoặc ra ảnh đúng, hoặc báo hỏng kèm lý do. Không bao giờ lưu ảnh sai.
- Chạy hai lần cùng code thì số liệu khớp nhau.
- Có ba nhóm mới chụp riêng được bằng `--only`: `skills`, `alpha`, `toasts`.
- Có công cụ so hai bộ ảnh trong repo.

## Phạm vi

**Làm:**
- Viết lại `scripts/shots.mjs`, tách phần thuần (có test) và phần thao tác trang.
- Sửa nhóm `world`, `labels`, `aim` cho chắc chắn. Thêm nhóm `skills`, `alpha`, `toasts`.
- Thêm `--compare` để so hai bộ ảnh.
- Kèm 3 việc nhỏ cùng file đã có trong `TASKS.md`: tắt server cổng 2599 ở mọi đường lỗi và thụt lề khối `try` của `worldShots` (T29), in lỗi khởi động server thay vì `stdio: "ignore"` (T68). Viết lại file thì làm luôn rẻ hơn để lại.
- Cập nhật tài liệu: `docs/architecture.md`, dòng lệnh trong `CLAUDE.md`.

**KHÔNG làm:**
- Không sửa `packages/**`: game, server, shared không đổi gì; script chỉ đọc.
- Không thêm hook `debug:*` mới. Không cần, vì mọi cảnh dựng được bằng `spawnPal`, `givePal` (có `alpha`), `teleport`, `setTime`, `gear`, `give` và tin thường (`palSkill`, `equip`, `eat`). `debug:clearPals` vẫn là việc riêng T46.
- Không sửa `tests/e2e/multiplayer.spec.ts` (chép logic cần dùng sang script, không import từ spec). Không sửa `packages/client/src/game/labelLayout.ts`.
- **Không dùng `git stash`** (kể cả để thử code cũ); muốn chạy code cũ thì `git worktree add` vào scratchpad hoặc `git show <commit>:<file>`.
- Không commit thư mục `shots/`. Không commit công cụ so ảnh Python `shotdiff.py` (cần numpy/Pillow, nhiễu điểm ảnh cao do nước, gió, thời tiết; xem Thiết kế 6).
- Không ảnh chiêu của thú hoang (vùng đỏ cảnh báo): phải để thú hung dữ nhắm người chơi, khó giữ chắc chắn. Ghi thành đề xuất ở cuối.

## Thiết kế

### 1. Luật chung cho mọi cảnh

Mỗi cảnh đi qua một hàm chụp dùng chung `capture(page, file, scene)`, theo các bước sau.

**1. Dựng cảnh:** `scene.setup(attempt)` dịch chuyển người chơi, sinh thú, giao thú.

**2. Chờ ổn định bằng trạng thái game** (`settle`), không chờ theo giờ:
- Server đã nhận chỗ mới: vị trí server của mình nằm trong 24 px quanh chỗ yêu cầu, hoặc quanh chỗ đã được `resolve` khi điểm đó vướng vật cản. Ví dụ `lake` (3730, 2130) bị đẩy ra (3715, 2247). Vị trí server lúc ổn định là **mốc** của cảnh.
- Camera tới nơi: `hypot(camera.x − me.x, camera.y + 16 − me.y) < 2`, và client cách server < 4 px.
- Có thú đi theo thì nó đã tới và đứng yên: con có `ownerId` là mình nằm trong `COMPANION_FOLLOW_DISTANCE + 24` px (80 px) quanh mình, và hai lần đo cách nhau 250 ms nó dịch < 2 px.
- Thông báo theo yêu cầu của cảnh:
  - `"none"`: không còn `.hud-toasts > .toast` nào, kể cả cái đang mờ dần (`.out`);
  - `[chữ...]`: đúng các chữ đó đang hiện, không cái nào `.out`, không animation nào đang chạy trong `.hud-toasts` (như `settledBossLayout`).
- Đã vẽ thêm ít nhất 6 khung từ lúc bắt đầu chờ.
- Hạn chờ: 30 s cho camera và thú đi theo, 20 s cho thông báo (dài nhất `TOAST.maxMs` 7 s, cộng hàng đợi). Hết hạn thì lần thử đó hỏng, lý do ghi rõ điều nào chưa đạt.

**3. Kiểm tra an toàn trước khi chụp** (`threats`, hàm thuần). Không thú hoang nào đủ gần để tự lao vào:
- thú đầu đàn trong `ALPHA.sight + THREAT_MARGIN` (170 + 50 = 220 px) quanh mình hoặc quanh thú đi theo của mình;
- thú hung dữ (`temperament === "aggressive"` trong `PAL_SPECIES`: hiện là Scorchtail, Boulderhorn) trong `AGGRESSIVE_SIGHT + THREAT_MARGIN` (120 + 50 = 170 px); trùm thì cộng thêm `BOSS.radius`.

Thú hiền và thú tự vệ không tính vì chỉ đánh khi bị đánh (`Combat.wildTarget`). Có mối đe doạ thì lần thử hỏng (lý do `threat <loài> <khoảng cách>`).

**4. Chụp vào bộ nhớ:** `page.screenshot()` không có `path`. Đọc trạng thái ngay trước và ngay sau khi chụp.

**5. Phán xét** (`judgeScene`, hàm thuần). Ảnh chỉ hợp lệ khi đủ cả 5 điều sau:
- không có tin `damage` nào nhắm mình kể từ đầu lần thử (bộ đếm `window.__shotHurt`, như `watchHurt` của e2e);
- `hp === maxHp` cả trước và sau (thanh máu dưới tên mình làm ảnh khác);
- vị trí server trước và sau cách mốc ≤ 6 px (không bị đẩy, không bị hạ);
- thông báo lúc trước và lúc sau đúng như cảnh yêu cầu;
- điều kiện riêng của cảnh (`scene.verify`) đạt.

**6. Ghi kết quả:**
- Hợp lệ: ghi `<file>.png`, thêm một dòng `ok: true` vào báo cáo.
- Không hợp lệ:
  - **Bị đánh hoặc bị dời chỗ:** chạy bước hồi phục rồi thử lại. Bước hồi phục: dịch chuyển về `RETREAT` (bãi xuất phát 3200, 2400), `debug:give` rồi `eat` mỗi `EAT_COOLDOWN_MS` (4 s) khi còn thiếu máu, chờ tới khi máu đầy và đã qua `WILD_AGGRO_MS` (8 s) kể từ đòn cuối; tối đa 45 s.
  - **Có mối đe doạ:** đợi 2 s rồi thử lại. Với cảnh đặt chỗ theo thú (nhóm `alpha`), lần thử sau chọn lại chỗ đứng theo vị trí thú lúc đó.
  - **Hỏng cả `TRIES` = 3 lần:** không ghi `<file>.png`. Nếu thư mục ra đã có `<file>.png` từ lần chạy trước cùng `--name` thì xoá đúng file đó (file sinh ra, nằm trong `shots/` đã gitignore), để thư mục không còn ảnh cũ trông như mới. Thêm dòng báo cáo `{ file, group, view, ok: false, tries, reason }` và in `FAILED <file>: <lý do>`.
- Chạy xong: in `N cảnh hỏng`. Có cảnh hỏng thì thoát mã 1, **sau khi** đã ghi `report.json` và `run.json`.

Cả 6 nhóm đều phải đi qua `capture`, kể cả nhóm `aim`: hiện nhóm này ghi ảnh thẳng ra file rồi mới kiểm, và sau 6 lần hỏng vẫn để ảnh sai lại.

**Đồ mặc:** mọi nhóm đều chạy `debug:gear` rồi `equip` áo khoác (`coat`) và nón lá (`nonla`), như nhóm `aim` đang làm. Như vậy không mất máu vì rét hay nắng trong lúc dựng cảnh. Nhóm `world` trước đây không mặc, nên nhân vật trong ảnh đổi đồ: lần chạy đầu sau T14 là mốc mới.

**Số đo mỗi ảnh** (thêm vào `report.json`, đọc trong một lần `evaluate` cùng lúc chụp):
- `sprites`: như cũ, `debugInfo().objects`.
- `wild`: số thú hoang đang được vẽ, tức `game.pals` và `game.leaving` có `actor.root.visible`. Thú vẽ tới 1000 px (`PAL_DRAW_DISTANCE`), xa hơn màn hình nhiều, và vị trí của chúng ngẫu nhiên, nên số này đổi giữa các lần chạy.
- `chests`: số sprite rương đang hiện (`body`, `gem` của `game.chests` có `visible`). Rương đặt ngẫu nhiên.
- `steady = sprites − wild − chests`: phần chỉ do bố cục cảnh quyết định, phải gần như bằng nhau giữa hai lần chạy. Đây là con số dùng để biết cảnh có giữ được không: ở ảnh `island` lỗi, `steady` nhảy hơn 100.
- `me` (vị trí server làm tròn), `hp`, `maxHp`, `tries`, `ms` (thời gian của cảnh).

### 2. Chỗ chụp ngoài hang thú đầu đàn (sửa `island` và 3 vùng khác)

Luật cho chỗ cố định: cách mọi hang ≥ `LAIR_CLEAR = ALPHA.roam + ALPHA.sight + 60 = 358` px. Thú đầu đàn ở đâu trong vùng lang thang cũng còn cách người chơi ≥ 230 px. Cùng biome với vùng muốn chụp, không vướng vật cản bán kính 30. Chỗ mới là điểm gần chỗ cũ nhất đạt luật, tìm theo vòng 40 px (script đọc, đã chạy):

| Ảnh | Cũ (cách hang) | Mới (cách hang) |
|---|---|---|
| `snow`, `aim-snow` | (3200, 1180) (52) | **(2941, 992)** (365) |
| `desert`, `aim-desert` | (3200, 3650) (10) | **(3558, 3690)** (361) |
| `swamp`, `phone-swamp`, `aim-swamp` | (1520, 2400) (34) | **(1878, 2440)** (375) |
| `island` | (560, 520) (37) | **(911, 599)** (369) |
| `meadow-*`, `lake`, `volcano*`, `sea-raft`, `phone-lake`, `aim-meadow*`, `aim-volcano-night` | không đổi | 485-1036 |

Bốn chỗ mới không vướng vật cản (`grid.blocked(p, 30) === false`) và `resolve` giữ nguyên điểm. Hang lấy từ `alphaLairs()` lúc chạy (meadow 2500,2880; swamp 1510,2368; desert 3200,3640; snow 3218,1229; volcano 4854,1940; island 545,554), không ghi cứng. Unit test kiểm mọi chỗ, nên nếu worldgen đổi thì test báo ngay.

**Thử lại của nhóm `aim`:** hiện lùi 260 px về bắc mỗi lần, nên `aim-snow` mới sẽ ra khỏi bản đồ ở lần thứ 5. Đổi thành danh sách lệch dùng chung `AIM_RETRY = [[0,0],[0,-260],[260,0],[0,260],[-260,0],[260,-260]]`, lọc lúc chạy: trong bản đồ (cách mép ≥ 100), không phải biển, cách hang ≥ `LAIR_CLEAR`. Test đòi mỗi chỗ `aim` còn ≥ 4 chỗ thử hợp lệ.

### 3. Các nhóm và cảnh

Khung hình:
- `LABEL_VIEWS` (đã có trong script): `desktop` 1280×720; `portrait` 390×844; `landscape` 844×390. Hai khung điện thoại có `isMobile`, `hasTouch`, `deviceScaleFactor: 1`. Đây là đúng ba khung của e2e `TOAST_SCREENS`.
- Nhóm `world` và `aim` giữ khung cũ (desktop + `devices["iPhone 13"]`, `"iPhone 13 landscape"`), để ảnh còn so được với lần trước.

| Nhóm | Khung hình | Ảnh |
|---|---|---|
| `world` | desktop; iPhone 13 | 15 (như cũ) |
| `labels` | desktop, portrait, landscape | 9 (như cũ) |
| `aim` | desktop; iPhone 13 dọc, ngang | 8 (như cũ) |
| `skills` (mới) | desktop, portrait, landscape | 6 |
| `alpha` (mới) | desktop (4), portrait (1), landscape (1) | 6 |
| `toasts` (mới) | desktop, portrait, landscape | 9 |

Tổng 53 ảnh. Mỗi khung hình là một context mới, tức một thế giới mới (đóng context trước khi mở cái sau, như hiện nay). Thời gian trong ngày là `debug:setTime { t: 0.3 }` (ban ngày) trừ khi ghi khác.

**Chỗ yên tĩnh** `CALM = [(3200,2400), (3000,2470), (3400,2300), (4000,2000)]`: đều ở đồng cỏ, không vướng vật cản, cách hang 647-1071 px. Cảnh cần chỗ yên thì chọn chỗ đầu tiên trong danh sách mà lúc đó không có thú hoang nào trong 300 px (đọc `room.state.pals`).

#### 3a. `world` (sửa)
- Chỗ mới theo bảng mục 2. Mặc đồ như mục 1. Mỗi chỗ: `setTime`, `teleport`, `capture` với thông báo `"none"`. Thông báo "Đã vào vùng…" mức thấp (khoảng 3 s) được chờ cho hết, không còn lúc có lúc không trong ảnh.
- `pal-closeup`: thay `waitForTimeout(2500)` bằng chờ con thú mới (id chưa có trước `spawnPal`) có trong `game.pals`, `actor.root.visible`, rồi thêm 6 khung. Con thú này có 1 máu và nằm yên 60 s (`idleMs`).
- Các ảnh điện thoại (`phone`, `phone-swamp`, `phone-lake`): giữ nguyên tên, đi qua `capture`.

#### 3b. `labels` (sửa, thêm ★)
- **★ đầu đàn đã bắt (T8):** người thứ tư "Bảo Ngọc" nhận `debug:givePal { species: "voltmouse", level: 15, alpha: true }` thay vì thú thường. Nhãn thú đi theo của người này thành "★ Lv 15 Voltmouse" và đứng giữa đám đông trong ảnh `players` ở cả 3 khung. Chọn người có sẵn nên số người và số thú không đổi.
- `players`: thay `sleep(3000)` và `sleep(1000)` bằng điều kiện:
  - `room.state.companions.size === 5`, và mỗi thú đi theo nằm trong 80 px quanh chủ;
  - "Tuấn" đã `offline === true` trong state, rồi thêm 6 khung;
  - `settle` có thú đi theo của mình;
  - thông báo `"none"`.
- `wild`: thay `sleep(1500)` bằng `settle` và thông báo `"none"`. Đo `labelUpdateMs` như cũ.
- `alpha`: viết lại cho an toàn. Thú đầu đàn đồng cỏ và nhãn của nó vẫn ở trong khung cùng nhãn của mình và thú đi theo (đều là nhãn ghim), nhưng đứng ngoài tầm. Đặt chỗ đứng như cảnh `alpha` ở 3d, với khoảng cách `ALPHA_GAP`. Bỏ hẳn mẹo `debug:give` + `eat`.
  - Cảnh này không còn ép nhãn thú đầu đàn chồng lên nhãn thú đi theo. Lý do: không thể vừa đứng sát thú đầu đàn vừa không bị đánh. Chuyện nhãn chồng nhau đã có e2e `labels:` và unit test của `labelLayout` kiểm.
  - Cảnh này yêu cầu đúng thông báo `[GAME_TEXT.lairWarning(...)]`: cảnh báo lãnh địa hiện một lần mỗi phiên khi lại gần trong `ALPHA.sight + 150` (`hudBridge.updateMinimap`), nên lần nào cũng có.
- Tên file giữ nguyên (`labels-<view>-players|wild|alpha`).

#### 3c. `skills` (mới): thanh chiêu và một chiêu đang bay
Mỗi khung (desktop, portrait, landscape), một context:
1. Vào game, mặc đồ, chọn chỗ `CALM`, `teleport`, `settle`.
2. `debug:givePal { species: "bubbloon", level: 7 }`. Bubbloon cấp 7 biết Bong bóng và Mưa hồi máu; Sóng thần còn khoá "Lv 15". Chờ `.skill-bar` hiện, `settle` có thú đi theo, thông báo `"none"`.
   - **Ảnh `skills-<view>-bar`:** thanh chiêu lúc yên, 2 ô sẵn sàng, 1 ô khoá. Trên điện thoại đây là ảnh "thanh chiêu trên điện thoại" mà T14 yêu cầu.
3. `debug:givePal { species: "bubbloon", level: 15 }`. Con mới thành thú đi theo và biết cả 3 chiêu. `settle` có thú đi theo, thông báo `"none"`.
4. Mục tiêu: ghi danh sách id thú đang có, `debug:spawnPal { species: "leafkit", full: true }`. Server sinh con thú ở `x + 40`, đứng yên 60 s. Con mới là id chưa có trong danh sách. Rồi `teleport` mình sang `x − 110`, để con Leafkit cách mình khoảng 150 px.
   - Leafkit hiền và đủ máu: chưa bị trúng thì không làm gì.
   - Điều kiện riêng, kiểm sau `settle`: con Leafkit còn đó, không choáng; và **không thú hoang nào khác trong `SKILL_ORDER_RANGE + 40` = 300 px quanh mình**, vì lệnh chiêu đánh con gần mình nhất trong 260 px (`Skills.obey`). Có thì đổi sang chỗ `CALM` kế tiếp và làm lại từ bước 4.
5. **Chiêu:** Sóng thần `tidal_wave` (dạng `wave`, gồng 650 ms, lăn 300 px/s, tầm 150 px nên bay tới 500 ms; hiệu ứng to, rõ nhất trong ba chiêu).
   - Gài **chốt dừng hình** trong trang:
     - Đăng ký `room.onMessage("skillCast", ...)`; SDK trả về hàm huỷ đăng ký, nhớ gọi sau khi xong.
     - Khi nhận tin của `caster === "companion"`, `skill === "tidal_wave"`, `targetId` là con Leafkit: ghi `t0 = performance.now()`. Handler của game đăng ký trước nên đã chạy, và `SkillCasts.castSkill` tính giờ thả chiêu từ cùng lúc nhận tin. Chiêu thả lúc `release = t0 + castMs`.
     - Thêm một callback vào `game.stage.app.ticker` (ưu tiên thường; thêm sau `frame()` nên chạy ngay sau nó). Mỗi tick nó tính `phase = (performance.now() − release) / travelMs`. Khi `phase ≥ 0.35`: gọi `ticker.stop()`, tự gỡ mình, rồi trả `{ t0, castMs, travelMs, drawnAt, phase }`.
     - Vì sao vẫn có khung để chụp: PixiJS 8 `Ticker.update` chạy hết các listener của tick đang chạy, kể cả `render` (ưu tiên LOW, `TickerPlugin`). Đã đọc `node_modules/pixi.js/lib/ticker/Ticker.mjs`: `stop()` chỉ huỷ khung sau. Canvas giữ đúng khung có `phase` vừa ghi.
   - Gửi `palSkill { skill: "tidal_wave" }`. Chờ chốt tối đa 10 s (`SKILL_ORDER_MS` 4 s cộng chạy tới).
   - Chụp vào bộ nhớ. Đọc số đo và `game.frames` trước và sau ảnh; hai số phải bằng nhau, chứng minh hình đã đứng yên.
   - **Luôn** `ticker.start()` trong `finally`. `frame()` tự kẹp `delta` ≤ 100 ms nên không có bước nhảy.
   - Điều kiện riêng (`skillPhaseOk`, hàm thuần): `travelMs ≥ 250` (bay đủ lâu để thấy), và `phase` của khung chụp nằm trong `[0.2, 0.85]`.
   - **Ảnh `skills-<view>-cast`:** sóng nước đang lăn giữa Bubbloon và Leafkit, chữ "🌊 Sóng thần" bay trên đầu, ô Sóng thần trên thanh chiêu bắt đầu đếm hồi chiêu.
   - Thử lại: chờ `cooldownMs` của chiêu (12 s, lấy từ `getSkill`) + 300 ms, sinh con Leafkit mới và làm lại bước 4-5. Nếu `travelMs < 250` (Bubbloon đứng quá gần), lần sau dịch mình sang `x − 140`.
   - Sau khi chiêu trúng, Leafkit bỏ chạy và Bubbloon đuổi theo 6 s. Đó là sau ảnh nên không ảnh hưởng.

#### 3d. `alpha` (mới): thú đầu đàn hoang và thú đầu đàn đã bắt
Khoảng cách đứng `ALPHA_GAP = ALPHA.sight + THREAT_MARGIN + COMPANION_FOLLOW_DISTANCE = 170 + 50 + 56 = 276` px. Kể cả thú đi theo đứng lệch về phía thú đầu đàn thì vẫn ngoài tầm. Ở zoom của từng khung (`Stage.VIEW` 440 px thế giới theo cạnh ngắn), thú đầu đàn vẫn lọt màn hình nếu đặt đúng phía:
- desktop: zoom 1,64, nhìn thấy 782×440 px;
- portrait: zoom 0,89, nhìn thấy 440×952 px;
- landscape: zoom 0,89, nhìn thấy 952×440 px.

**Chọn chỗ đứng** (`standSpots(alpha, view, world)`, hàm thuần):
- Đặt thú đầu đàn về một phía của màn hình, thử lần lượt:
  - desktop và landscape: phải, phải-xuống 30°, phải-lên 30°, trái, trái-xuống 30°;
  - portrait: dưới, dưới-trái 30°, dưới-phải 30°, trên.
- Chỗ đứng là `alpha − ALPHA_GAP · hướng`. Chỉ nhận chỗ trong bản đồ, không phải biển, không vướng vật cản bán kính 20, và cách hang của **các** thú đầu đàn khác ≥ `LAIR_CLEAR`.
- Đã tính với hang đồng cỏ: chỗ bên trái hang (2224, 2880) vướng vật cản ở vùng đầm lầy, nên thứ tự dự phòng là cần thiết.

**Lúc chạy:**
- Đọc vị trí **hiện tại** của thú đầu đàn (`p.alpha && p.speciesId === ...` trong `room.state.pals`), lấy danh sách chỗ đứng, thử lần lượt.
- Một chỗ đạt khi, sau `settle`, nhãn `.labels > .label.pal.alpha` của đúng loài:
  - nằm trọn trong màn hình, cách mép dưới ≥ 40 px để thấy thân;
  - không giao phần HUD nào (dùng cùng danh sách bộ chọn với `toastLayout`).
- Lúc chụp: khoảng cách từ thú đầu đàn tới mình và tới thú đi theo ≥ `ALPHA.sight + THREAT_MARGIN` = 220. Thú đầu đàn đi lang thang mà vào gần hơn thì thử lại, chọn chỗ theo vị trí mới.
- Thông báo yêu cầu: đúng `[lairWarning]` của loài đó. Lời cảnh báo hiện một lần mỗi phiên, dài khoảng 4,9 s; chụp trong lúc nó hiện, nên ảnh có cả lời cảnh báo lãnh địa.

**Ảnh:**
- `alpha-desktop-meadow`, `alpha-portrait-meadow`, `alpha-landscape-meadow`: Voltmouse đầu đàn (Lv 15) ở hang đồng cỏ, ban ngày.
- `alpha-desktop-island`: Coralcrab đầu đàn (Lv 22) trên đảo, ban ngày. Đảo đủ rộng: điểm xa hang nhất cách 462 px; cả 4 phía cách 276 px đều là đất trống.
- `alpha-desktop-snow-night`: Frostfang đầu đàn (Lv 19) trên núi tuyết, `t: 0.85`: quầng đầu đàn trong đêm.
- `alpha-desktop-caught`: ở chỗ `CALM`, `debug:givePal { species: "scorchtail", level: 20, alpha: true }`; `settle` có thú đi theo, thông báo `"none"`. Ảnh thú đầu đàn đã bắt đi theo mình, nhãn "★ Lv 20 Scorchtail". Scorchtail khác loài với ★ của nhóm `labels`, nên mỗi ảnh có giá trị riêng.

Mỗi lần đổi vùng trong context desktop thì `teleport` thẳng tới chỗ đứng mới. Lời cảnh báo của mỗi loài vẫn hiện lần đầu, vì `alphasMet` nhớ theo loài.

#### 3e. `toasts` (mới): thông báo ở 3 khung hình
Dựng theo e2e `TOAST_SCREENS` và `toastLayout`. Mỗi khung một context:
1. Vào game, mặc đồ, `debug:givePal { species: "emberpup", level: 8 }` (giống e2e: có thanh chiêu và thú đi theo). Chờ `.hud-quest` có chữ, chỗ `CALM`, `settle` có thú đi theo, thông báo `"none"` (tối đa 20 s).
2. Ba cảnh theo thứ tự. Mỗi cảnh bắt đầu từ lúc không còn thông báo nào, rồi gọi `game.hud.showToast(text, level)` trong **một** `evaluate`:
   - `toasts-<view>-long`: một gợi ý dài mức `normal`, đúng như `hudBridge.tip` hiện. Desktop dùng `GAME_TEXT.stunTipKeys`; điện thoại dùng `GAME_TEXT.stunTipTouch` (đúng câu T6 nêu: đè HUD ở 390×844). Chờ hiện 1.
   - `toasts-<view>-reward`: hai thông báo mức `high` dài nhất, giống `LONGEST_TOASTS` của e2e nhưng dựng từ bảng chữ thật:
     - phần thưởng trùm: `NOTICES.bossDefeated(rewardText({ ...BOSS.reward, wear: <id> }), " · Emberpup +" + BOSS.xp + " XP").text`, trong đó `<id>` là món của trùm có tên dài nhất trong `wearables.json` (e2e dùng "Giáp hiệp sĩ"); chuỗi `xpText` dựng y như `Leaders.defeatBoss`;
     - lên cấp kèm hai chiêu: `GAME_TEXT.levelUpLearned("Frostfang", 15, ...)`, danh sách chiêu là `skillsLearnedBetween(getSpecies("frostfang"), 6, 15)` ghép `${icon} ${name}` bằng ", ".

     Chờ hiện đúng số chỗ: 2 ở desktop và portrait, 1 ở landscape (`toastRoom`, giống `TOAST_SCREENS.room`).
   - `toasts-<view>-burst`: nhiều tin liền nhau như sau khi bắt được thú đầu đàn. Theo thứ tự:
     - `GAME_TEXT.caught(palName("voltmouse", true), true)` (high);
     - `NOTICES.questDone(QUESTS[0].title, rewardText(QUESTS[0].reward)).text` (high, như client hiện tin `quest`);
     - `GAME_TEXT.levelUp("Voltmouse", 16)` (high);
     - ba tin từ chối mức `low`: `NOTICES.hpFull.text`, `NOTICES.noBerries.text`, `GAME_TEXT.noGreatBall`.

     Kết quả mong đợi theo luật hàng đợi (`ToastQueue`): hai tin `high` đầu (desktop, portrait) hoặc tin đầu (landscape) đang hiện, tin `low` bị bỏ hoặc chờ. Chờ hiện đúng số chỗ như trên. Ảnh ghi lại đúng hàng đợi xử lý một loạt tin.
3. Điều kiện riêng cho cả ba cảnh:
   - chữ các thông báo đang hiện (không `.out`) giống hệt lúc trước và lúc sau khi chụp, đúng số chỗ;
   - camera lệch < 1 px (như `settledBossLayout`), không animation nào đang chạy trong `.hud-toasts`.
4. Số đo riêng ghi vào báo cáo: `toasts` (chữ và hộp từng thông báo) và `toastOverlaps` (các cặp thông báo / phần HUD hay nhãn tên mình giao nhau > 1 px, tính như `toastLayout` + `boxesOverlap` của e2e, chép logic sang script). Số chồng là kết quả đo, không làm cảnh hỏng. In ra như nhóm `labels` in số nhãn chồng.

Chữ lấy từ `@petgame/shared` (`NOTICES`, `rewardText`, `BOSS`, `QUESTS`, `palName`, `getSpecies`, `skillsLearnedBetween`) và `packages/client/src/ui/strings.ts` (`GAME_TEXT`). Tệp `strings.ts` không có DOM và chỉ import từ shared, nên script chạy bằng `tsx` import được. Script không tự viết câu tiếng Việt nào, nên khi đổi chữ trong game, ảnh tự đổi theo.

### 4. Chạy script và tham số

- `package.json`: `"shots": "node --import tsx scripts/shots.mjs"`, để script import được `@petgame/shared` (TypeScript). `tsx` đã là devDependency và server của script cũng chạy bằng nó. Không thêm dependency.
- `--only <nhóm,...>`: nhận `world`, `labels`, `aim`, `skills`, `alpha`, `toasts`; mặc định là cả 6. Tên sai thì báo lỗi kèm danh sách đúng, thoát mã 1 trước khi build. Danh sách nằm ở một hằng `GROUPS`.
- `--compare <thư mục A> <thư mục B>`: chỉ so hai bộ (mục 6). Không build, không bật server hay trình duyệt. Chọn kiểu cờ này để lệnh vẫn khớp quyền `npm run shots *` sẵn có trong `.claude/settings.json`; `npm run shots:compare` sẽ không khớp.
- `--name`, `--no-build`: như cũ.
- **Server:** bỏ `stdio: "ignore"` (T68). Giữ 50 dòng stderr cuối; server thoát sớm hoặc `/healthz` không lên sau 30 s thì in chúng ra và thoát mã 1. Hiện nay script chạy tiếp trong im lặng. Tắt server ở **mọi** đường thoát, gồm lỗi build sau khi đã bật server, lỗi trình duyệt, lỗi trong nhóm, Ctrl+C (`SIGINT`): một `try/finally` bọc mọi thứ sau `spawn` cùng một `process.on("exit")` gọi `server.kill()` (T29).
- **Thời gian:** in thời gian từng nhóm (`world 3m12s`) và tổng. Ghi `run.json`: `{ name, groups, startedAt, totalMs, groupMs: { world: ... }, failed: [file...] }`. `report.json` vẫn là mảng các dòng có `file` và `sprites`, để công cụ cũ còn đọc được.

### 5. Ngân sách thời gian

Chưa có số đo cũ: log T11 không ghi giờ. Ước tính: 17 lần mở trang, mỗi lần khoảng 15-40 s với WebGL phần mềm, cộng khoảng 53 cảnh, mỗi cảnh 3-10 s, thêm thời gian chờ thông báo hết.

**Mục tiêu:** cả bộ (không tính build) ≤ 15 phút trên container cloud; mỗi nhóm mới ≤ 4 phút. Coder ghi số đo thật của từng nhóm vào `PROGRESS.md`. Nếu vượt, các cách giảm được phép là:
- dùng chung một context cho `skills` và `toasts` cùng khung hình khi cả hai được chọn;
- bỏ `alpha-desktop-snow-night`.

Không được giảm bằng cách bỏ bước kiểm tra.

### 6. Kiểm tra ổn định và công cụ so sánh

**Quyết định:** commit một công cụ so **báo cáo** bằng Node (`scripts/shotsCompare.mjs`, gọi qua `npm run shots -- --compare A B`). Không commit `shotdiff.py` (so điểm ảnh). Lý do:
1. Nhiễu điểm ảnh giữa hai lần cùng code rất cao: `desert` 51, `aim-swamp` 10, `phone-lake` 4,7 do nước, gió, mây, thời tiết.
2. Cần numpy/Pillow (không phải phụ thuộc của repo Node).
3. `steady` bắt đúng lỗi dựng cảnh: các ca hỏng ở T11 đều làm số sprite nhảy.

Xem ảnh bằng mắt vẫn là việc của người so.

Luật so (hàm thuần `compareReports(a, b)`), với mỗi `file` có ở một trong hai bộ:
- thiếu ở một bộ → `missing`;
- `ok: false` ở bộ nào → `failed`;
- cả hai có `steady`: `|Δsteady| > STEADY_SLACK` (4) → `scene changed`. Báo cáo cũ không có `steady` thì so `sprites`: `|Δ| > max(8, 10%)` → `sprites changed`;
- `sprites > 600` (ngân sách của `docs/art-style.md`) ở bộ B → `over budget`;
- `labels.overlapping` của B lớn hơn A → `label overlaps up`;
- `aimsWeak` từ `true` thành `false` → `aim lost`;
- `toastOverlaps` của B có phần tử → `toast overlap`.

In một bảng: tên, `sprites` A/B, `steady` A/B, `wild` A/B, cờ. Cuối bảng in "N mục cần xem". Có cờ thì thoát mã 1.

`STEADY_SLACK = 4` chừa cho quả mọng chín và cây vừa mọc lại. Nếu hai lần chạy thật lệch nhiều hơn ở cảnh không hỏng, coder tìm thứ ngẫu nhiên còn lại, trừ nó khỏi `steady` hoặc ghi rõ trong `PROGRESS.md`. Không nới số cho qua.

**Kiểm ổn định (bắt buộc, tester làm):**
1. `npm run shots -- --name t14-a`, rồi `npm run shots -- --name t14-b --no-build`.
2. `npm run shots -- --compare shots/t14-a shots/t14-b` phải ra 0 mục cần xem.
3. Thêm một lần `--only skills,alpha,toasts --no-build` để kiểm chạy riêng nhóm.

## Kế hoạch triển khai

Thứ tự dưới đây làm được trong một vòng. Phần A tự đứng được: chạy được bộ cũ chắc chắn hơn, trước khi thêm nhóm mới.

**Phần A: nền và sửa nhóm cũ**

1. **`scripts/shotsLib.mjs`** (mới, hàm thuần, import `@petgame/shared`, có JSDoc tiếng Anh):
   - `GROUPS`, `parseShotArgs(argv)` → `{ name, groups, noBuild, compare?: [a, b] }`, hoặc ném lỗi có chữ nêu nhóm sai và danh sách đúng.
   - `LAIR_CLEAR`, `THREAT_MARGIN = 50`, `ALPHA_GAP`, `STEADY_SLACK = 4`, `SPRITE_BUDGET = 600`, `TRIES = 3`: mọi số dẫn từ `ALPHA`, `AGGRESSIVE_SIGHT`, `COMPANION_FOLLOW_DISTANCE`, `SKILL_ORDER_RANGE`, `BOSS`, không ghi số đã có trong shared.
   - Dữ liệu cảnh: `SPOTS` (`world`, đã đổi theo mục 2), `PHONE_SPOTS`, `AIM_SPOTS`, `AIM_RETRY`, `CALM`, `RETREAT`, `LABEL_VIEWS`, `PEOPLE`, `CROWD`, `ALPHA_SIDES` (hướng theo khung).
   - `aimRetrySpots(spot, world)`: lọc theo mục 2.
   - `standSpots(alpha, view, world, lairs)`: theo mục 3d.
   - `threats({ me, companion, pals })`: `pals` gồm `{ id, speciesId, x, y, alpha, boss }`; trả danh sách `{ id, speciesId, distance }`.
   - `judgeScene(before, after, need)`: trả `{ ok, reason }`, với lý do `hurt`, `hp`, `moved`, `threat`, `toasts`.
   - `skillPhaseOk({ castMs, travelMs, t0, drawnAt })`.
   - `compareReports(a, b)`.
2. **`scripts/shotsPage.mjs`** (mới, thao tác trang):
   - `join(context, name)`: chờ `#join-btn:enabled`, điền tên, bấm, chờ state và `frames > 3`, như đoạn đang lặp 3 lần trong `shots.mjs`.
   - `dress(page)`: `debug:gear` + `equip coat`/`nonla`.
   - `watchHurt(page)`.
   - `settle(page, need)`: theo mục 1.
   - `sceneState(page)`: một `evaluate` trả đủ số đo mục 1 cùng `hurt`, `hp`, `pals` cho `threats`, chữ thông báo đang hiện.
   - `capture(page, file, scene)`: vòng thử, phán xét, ghi hoặc báo hỏng, hồi phục.
   - `toastBoxes(page)`: chép logic `toastLayout`.
   - `freezeOnSkill(page, skillId, targetId)`.
   - `calmSpot(page, candidates, radius)`.
3. **`scripts/shots.mjs`** viết lại:
   - đọc tham số bằng `parseShotArgs`; `--compare` thì gọi `shotsCompare.mjs` rồi thoát;
   - build; bật server có bắt stderr, `finally`, `exit`, `SIGINT`;
   - bảng thời gian, `report.json`, `run.json`, mã thoát;
   - nhóm `worldShots`, `labelShots`, `aimShots` đi qua `capture`, dùng chỗ mới và các thay đổi ở 3a, 3b, mục 2.
   - Khối `try` trong `worldShots` thụt lề đúng (T29).
   - Script dài hơn khoảng 600 dòng thì tách các nhóm sang `scripts/shotGroups.mjs`.
4. **`scripts/shotsCompare.mjs`** (mới): đọc hai `report.json`, gọi `compareReports`, in bảng, đặt mã thoát. Chạy được riêng bằng `node --import tsx scripts/shotsCompare.mjs A B`.
5. **`package.json`**: lệnh `shots` như mục 4.

**Phần B: nhóm mới**

6. `skillShots(browser)` theo 3c (dùng `freezeOnSkill`).
7. `alphaShots(browser)` theo 3d (dùng `standSpots`).
8. `toastShots(browser)` theo 3e (chữ từ shared và `ui/strings.ts`).
9. Chú thích đầu `scripts/shots.mjs` (dòng `Usage`) liệt kê đủ 6 nhóm, `--compare`, luật "cảnh hỏng không ghi ảnh, thoát mã 1".

**Phần C: tài liệu**

10. `docs/architecture.md`:
    - Bullet `npm run shots` (dòng cuối mục Kiểm thử, đang ghi sai "`--only world|labels` (mặc định cả hai)"): viết lại theo mục 1, 4, 6, gồm 6 nhóm, cách kiểm an toàn, `steady`, `--compare`, `run.json`.
    - Danh sách "Trường e2e và shots đọc" trong bullet `game/Game.ts`, thêm thứ shots đọc:
      - `pals`/`leaving` (`.actor.root.visible`), `chests` (`.body`, `.gem`);
      - `companions` (`.get(id).actor.pos`), `hud` (`showToast`);
      - `stage` (shots: `app.ticker.add/remove/stop/start` để dừng hình lúc chiêu đang bay).
11. `CLAUDE.md`, bảng Lệnh, dòng "Ảnh chụp so sánh hình": `npm run shots -- --name <tên>` (`--only world,labels,aim,skills,alpha,toasts`; `--compare <A> <B>` so hai bộ). Không đổi gì khác trong `CLAUDE.md`.

## Giao thức

Không đổi. Không sửa `schema.ts`, `messages.ts`, `Profile`, hay code client/server. Script chỉ gửi tin đã có (`debug:*` khi `PETGAME_DEBUG=1`, `equip`, `eat`, `palSkill`) và đọc các trường `Game` đã kể ở bước 10. Đổi tên các trường đó sau này thì phải sửa script; danh sách hợp đồng trong `docs/architecture.md` sẽ ghi rõ.

## Test

**Unit (`scripts/shotsLib.test.mjs`, Vitest đã gom `scripts/**/*.test.mjs`):**
1. `parseShotArgs`: mặc định đủ 6 nhóm; `--only skills,toasts`; nhóm sai (`--only sprites`) ném lỗi có tên nhóm sai và cả 6 tên đúng; `--compare a b`; `--name x --no-build`.
2. Chỗ chụp của `world` (dùng `defaultWorld()`, `alphaLairs()`):
   - mỗi chỗ đúng biome mong đợi (`snow` → snow, `island` → island, `sea-raft` → sea...);
   - mọi chỗ trên đất cách mọi hang ≥ `LAIR_CLEAR`;
   - 4 chỗ mới không vướng vật cản bán kính 30;
   - riêng một ca hồi quy có tên "island stands out of the Coralcrab leader's reach".
3. `aimRetrySpots`: mỗi chỗ `aim` có ≥ 4 chỗ thử hợp lệ; mọi chỗ trả về nằm trong bản đồ, không phải biển, cách hang ≥ `LAIR_CLEAR`.
4. `CALM`, `RETREAT`: đồng cỏ, không vướng vật cản, cách hang ≥ `LAIR_CLEAR`.
5. `standSpots`:
   - với hang đồng cỏ, đảo, núi tuyết, và mỗi hang lệch `ALPHA.roam` theo 8 hướng, khung nào cũng có ≥ 1 chỗ;
   - mọi chỗ cách thú `ALPHA_GAP` (±1), trên đất, không vướng vật cản;
   - thứ tự theo `ALPHA_SIDES` (hang đồng cỏ desktop: chỗ đầu tiên trả về **không** phải phía trái vướng vật cản).
6. `threats`:
   - thú đầu đàn ở `ALPHA.sight + THREAT_MARGIN − 1` → có; `+ 1` → không;
   - thú hung dữ ở `AGGRESSIVE_SIGHT + THREAT_MARGIN − 1` → có;
   - thú tự vệ hay thú hiền ở 10 px → không;
   - trùm cộng `BOSS.radius`;
   - khoảng cách tới thú đi theo cũng tính.
7. `judgeScene`: giống nhau → ok. Mỗi lý do một ca: `hurt` +1, `hp < maxHp`, dời 7 px, có `threat`, thông báo đổi chữ hoặc số lượng.
8. `skillPhaseOk`: `phase` 0,19 / 0,2 / 0,85 / 0,86 tại biên; `travelMs` 249 bị loại.
9. `compareReports`:
   - hai báo cáo giống → 0 cờ;
   - ca `island` cũ (`steady` 150 / 280) → `scene changed`;
   - lệch `wild` 6 mà `steady` bằng → không cờ;
   - thiếu file → `missing`; `ok:false` → `failed`;
   - báo cáo cũ không `steady` dùng ngưỡng `sprites`;
   - `sprites` 601 → `over budget`;
   - số nhãn chồng tăng, `aimsWeak` mất, `toastOverlaps` khác rỗng → có cờ tương ứng.

**Tích hợp server (`GameRoom.test.ts`):** không thêm, vì server không đổi.

**E2E:** không thêm, không sửa. Bộ ảnh không phải e2e và không chạy trong CI. CI vẫn chạy unit test của `shotsLib`.

**Chạy thật (tester):** như mục 6 "Kiểm ổn định", cộng `npm run typecheck`, `npm test`, `npm run build`. Cả `npm run test:e2e` cũng chạy theo quy trình, dù không có thay đổi nào chạm tới e2e. Tester tự mở bằng Read ít nhất các ảnh:
- `skills-portrait-cast`: thấy sóng nước đang lăn và thanh chiêu;
- `skills-landscape-bar`;
- `alpha-desktop-island`: thấy Coralcrab đầu đàn, nhãn vàng và lời cảnh báo;
- `labels-portrait-players`: thấy "★ Lv 15 Voltmouse";
- `toasts-portrait-burst`;
- `island`: bãi đảo, người chơi đứng yên, không có thanh máu.

## Tiêu chí hoàn thành

- [ ] `npm run typecheck`, `npm test` (gồm `scripts/shotsLib.test.mjs` với đủ các ca ở mục Test), `npm run build` sạch; `npm run test:e2e` qua.
- [ ] `npm run shots -- --name t14-a` và `--name t14-b --no-build` chạy hết, thoát mã 0, mỗi lần đủ 53 ảnh, không cảnh nào `ok: false` (`run.json.failed` rỗng).
- [ ] `npm run shots -- --compare shots/t14-a shots/t14-b` ra 0 mục cần xem: mọi ảnh `|Δsteady| ≤ 4`, không ảnh nào > 600 sprite.
- [ ] `--only skills,alpha,toasts --no-build` chỉ chụp đúng 21 ảnh của 3 nhóm đó; `--only sprites` báo lỗi rõ và thoát mã 1 trước khi build.
- [ ] Bốn chỗ chụp `snow`, `desert`, `swamp`, `island` (và các chỗ `aim`, `phone-swamp` tương ứng) cách mọi hang ≥ 358 px, có unit test.
- [ ] Không còn `waitForTimeout` hay `sleep` để **đợi cảnh ổn định** trong code shots: mọi chỗ chờ đều theo điều kiện trạng thái game. Được phép giữ: khoảng nghỉ ngắn giữa các tin gửi liên tiếp (≤ 150 ms, như lúc rải thú) và nhịp hỏi lại trong vòng chờ.
- [ ] Mọi ảnh đi qua `capture`: bị đánh, mất máu, bị dời, có thú đe doạ thì chụp lại; hỏng 3 lần thì không có file `.png`, báo cáo có `ok: false` kèm lý do, script thoát mã 1. Tester kiểm một lần bằng cách tạm làm cảnh hỏng, ví dụ chạy với `TRIES` và một chỗ trong hang, chỉ trong cây làm việc rồi trả lại; hoặc coder viết sẵn biến môi trường chỉ cho kiểm này. Chọn cách nào thì ghi vào `PROGRESS.md`.
- [ ] `skills-*-cast` có `phase` trong [0,2; 0,85] và `game.frames` không đổi trong lúc chụp; ticker luôn chạy lại sau đó (cảnh sau vẫn có khung mới).
- [ ] Nhóm `alpha`: khoảng cách lúc chụp từ thú đầu đàn tới mình và tới thú đi theo ≥ 220 px (ghi `alphaGap` vào báo cáo); nhãn thú đầu đàn trong màn hình và không dưới HUD.
- [ ] `labels-*-players` có nhãn "★ Lv 15 Voltmouse"; `labels-*-alpha` không còn mẹo `eat` và không bị đánh.
- [ ] `toasts-*`: số thông báo đang hiện đúng 1/2/2 (long), 2/2/1 (reward, burst) theo desktop/portrait/landscape; `toastOverlaps` được ghi và in (kết quả đo, không bắt buộc bằng 0).
- [ ] Server cổng 2599 không còn sống sau khi script dừng vì lỗi build, lỗi trình duyệt, lỗi trong nhóm, hay Ctrl+C (tester kiểm ít nhất một đường lỗi bằng `ss -ltn | grep 2599` hay tương đương); lỗi khởi động server được in ra.
- [ ] `PROGRESS.md` ghi thời gian từng nhóm và tổng của hai lần chạy (mục tiêu ≤ 15 phút không tính build; nhóm mới ≤ 4 phút mỗi nhóm), và độ lệch `steady` lớn nhất thấy được.
- [ ] Không có thay đổi nào trong `packages/**`, `tests/e2e/**`, `.claude/**`; không dùng `git stash`.
- [ ] `docs/architecture.md` (bullet `npm run shots`, danh sách trường shots đọc) và dòng lệnh trong `CLAUDE.md` cập nhật đúng.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **Mốc so sánh mới:** 4 chỗ chụp đổi vị trí, nhóm `world` mặc áo khoác và nón, nhóm `labels` có ★. Vì vậy ảnh trước T14 không so được với ảnh sau T14 ở những cảnh này (`--compare` sẽ báo `scene changed` hoặc `missing`, đúng như thực tế). Lần chạy `t14-a` là mốc mới. Ghi một dòng trong `PROGRESS.md` để agent chính ghi vào message commit.
- **Dừng hình bằng ticker:** dựa vào cách PixiJS 8.x chạy `Ticker.update` (đã đọc mã nguồn trong `node_modules`). Nếu bản Pixi khác làm khung cuối không được vẽ, cách dự phòng là: không dừng, mà chụp liền khi `phase` qua 0,35, rồi kiểm `phase` của khung cuối bằng giờ ghi trong callback ở lần `frames` tăng gần nhất trước khi chụp xong. Coder ghi cách đã dùng vào `PROGRESS.md`.
- **WebGL phần mềm chậm:** một khung có thể dài hơn 300 ms, làm `phase` vượt 0,85. Khi đó cảnh tự thử lại (mỗi lần mất 12 s hồi chiêu). Nếu hỏng cả 3 lần trên container, đổi sang Bong bóng (`bubble`: bay tới 650 ms, hồi 4,5 s) và ghi lý do. Không nới khoảng `phase`.
- **Thú đầu đàn đồng cỏ đi lang thang** có thể vào gần trong lúc chờ lời cảnh báo hiện. Cảnh khi đó chọn lại chỗ đứng theo vị trí mới; tối đa 3 lần.
- **Thú hoang qua lại ở đồng cỏ** có thể làm `calmSpot` không tìm được chỗ trống trong 300 px cho nhóm `skills`. Có 4 chỗ, và mật độ trung bình khoảng 80 thú trên 6400×4800 px, tức khoảng 0,7 con trong vòng 300 px. Nếu thiếu thì thêm chỗ `CALM` (có test), không thêm hook.
- **`STEADY_SLACK = 4`** chưa được đo: dựa trên những thứ ngẫu nhiên còn lại ngoài thú và rương. Xem cách xử lý ở mục 6.

## Đề xuất cho TASKS.md (agent chính cập nhật)

- T29: bỏ hai ý đã làm trong T14 ("thụt lề thân khối `try` trong `worldShots`" và "cho `shots.mjs` tắt server cổng 2599 ở mọi đường lỗi").
- T68: bỏ ý "`scripts/shots.mjs` chạy server với `stdio: \"ignore\"`…".
- Việc mới (P3, tuỳ chọn): ảnh vùng đỏ cảnh báo chiêu của thú hoang trong nhóm `skills`. Cần dựng thú hung dữ nhắm người chơi rồi né (dịch chuyển trước khi chiêu rơi). Làm sau T46 (`debug:clearPals`) để cảnh chắc chắn.
- Nếu vòng coder không xong Phần B: tách "T14b. Nhóm ảnh `skills`, `alpha`, `toasts`" (Phần B và C của PLAN này), commit Phần A riêng sau khi tester và reviewer qua.
