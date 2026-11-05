# Bản đồ hệ thống PetGame

Tài liệu tra cứu cho mọi agent (coder, tester, reviewer, explorer...): mỗi hệ thống nằm ở đâu, chạy thế nào, quy tắc riêng. Quy trình làm việc và quy ước chung ở `CLAUDE.md`.

## Luồng dữ liệu

```
Client (PixiJS, DOM HUD) --ClientMessage (ý định)--> GameRoom (Colyseus, 20 tick/giây)
Client <--state đồng bộ (schema.ts) + ServerMessage (sự kiện)-- GameRoom
packages/shared: dữ liệu JSON + logic thuần, cả hai bên cùng import
```

- Server quyết định mọi kết quả (vị trí, sát thương, bắt thú, rơi đồ). Client chỉ gửi ý định (`input`, `attack`, `throw`, `dash`, `palSkill`...) và hiển thị.
- Người chơi của mình được client đoán trước chuyển động bằng cùng hàm của shared (`stepWithDash`, `knockback`), kéo nhẹ về vị trí server, snap khi lệch quá `SNAP_DISTANCE`. Người khác và thú: nội suy về vị trí server.
- Sự kiện ngắn (trúng đòn, tung chiêu, hồi máu, bắt thú...) đi bằng `broadcast` (đến ngay); state (vị trí, máu, `windup`...) đến theo nhịp patch. Client phải chịu được thứ tự lệch nhau (ví dụ danh sách `leaving` cho thú vừa bị xoá khỏi state).

## packages/shared (logic thuần + dữ liệu, có test cạnh file)

| File | Nội dung |
|---|---|
| `constants.ts` | Hằng số chung (cổng, `TICK_MS`, `MAX_PLAYERS` 5, `MAX_PARTY` 30, `WILD_PAL_TARGET`, tốc độ...) |
| `schema.ts` | State đồng bộ: `Player`, `OwnedPal`, `WildPal`, `Companion`, `Chest`... dựng bằng `schema()` + `t.*` (không decorator). Đổi schema là đổi giao thức |
| `messages.ts` | `ClientMessage`, `ServerMessage` và kiểu payload từng tin |
| `movement.ts`, `collision.ts` | Bước đi, lướt, đẩy lùi, `CollisionGrid` |
| `worldgen.ts`, `terrain.ts`, `noise.ts` | Thế giới sinh từ seed (`defaultWorld()`: bố cục + grid vật cản), vùng (`biomeAt`, `terrainAt`), độ nguy hiểm (`dangerAt`) |
| `pals.ts` + `data/pals.json` | 13 loài: chỉ số, hệ, tính khí, nơi sinh, 3 chiêu (`skills`) |
| `skills.ts` + `data/skills.json` | 30 chiêu: `skillPower`, `learnset`, `knownSkills`, `skillsLearnedBetween` (chiêu học được trong một lần lên cấp, để báo), `skillTravelMs`, `inSkillArea`, hằng số lệnh chiêu |
| `elements.ts` | Khắc hệ (×1,5 / ×0,75), màu hệ |
| `capture.ts` | Tỉ lệ bắt, số lần lắc bóng, thời gian; `throwBlocker` (trùm, túi đầy; client và server dùng chung) |
| `combat.ts`, `gathering.ts` | Sát thương, choáng, hạ gục, rơi đồ; chặt cây, đập đá |
| `progression.ts`, `work.ts` | Kinh nghiệm, lên cấp, máu theo cấp (đường cong `XP_CURVE`/`xpToNext`; `finishXp`: kinh nghiệm hạ gục và bắt tăng theo cấp thú bị hạ); thú làm việc ở trại |
| `crafting.ts` + `data/recipes.json` | Chế tạo, nâng trại (`craftBlocker` dùng chung client/server) |
| `wardrobe.ts` + `data/wearables.json` | Ngoại hình, quần áo, mũ, vũ khí (chống rét/nắng, giáp, sát thương, tầm) |
| `daycycle.ts`, `climate.ts` | Ngày đêm, lạnh/nóng theo vùng |
| `boss.ts`, `alphas.ts` | Trùm Vua Đá Boulderhorn; 6 thú đầu đàn và lãnh địa (`alphaLairs`) |
| `rewards.ts`, `treasure.ts`, `quests.ts` | Phần thưởng, rương báu, chuỗi 17 nhiệm vụ |

## packages/server

- `index.ts`: Express + Colyseus (`defineServer`), `/healthz`, phục vụ client đã build (`packages/client/dist`).
- `rooms/GameRoom.ts`: toàn bộ luật chơi, mỗi tick (`tick`): người chơi (input, lướt, đánh, ném bóng, chặt cây), thú hoang (lang thang, nổi giận, gồng rồi cắn, choáng, bỏ chạy), thú đi theo và thú làm việc (`tickCompanions`), chiêu (`startCast`, `tickCasts`, `land`, `support`, lệnh của người chơi `orderSkill`/`obey`), trùm (`spawnBoss`, `bossStomp`, `defeatBoss`), thú đầu đàn (`spawnAlpha`, `alphaHome`, `alphaReturning`), rương, quả mọng, khí hậu, ngày đêm, nhiệm vụ (`questEvent`), lưu game (`scheduleSave`, `saveNow`).
  - Dữ liệu chỉ server cần (input, cooldown, não AI, hồi chiêu) để trong `Map` riêng, không đưa vào schema.
  - Hẹn giờ bằng `this.clock.setTimeout`. Mọi sát thương lên thú hoang đi qua `hitWild` (thú thường giữ ≥ 1 máu rồi choáng, trùm có thể bị hạ).
  - **Thứ tự tin báo và `LevelUp`:** toast của client chỉ có một ô (tin đến sau thay tin trước), nên chỗ nào cộng kinh nghiệm cũng gửi tin báo của sự kiện trước và gọi `grantXp` (tin `LevelUp`, có thể kèm chiêu mới) sau cùng: `knockOut`, `defeatBoss`, `feed`, bắt thú đầu đàn. Hai hẹn giờ `this.clock.setTimeout` cùng đáo hạn trong một tick thì cái đăng ký **sau** chạy **trước** (`ClockTimer` duyệt từ cuối về đầu), nên tin cần đi theo thứ tự phải chung một hẹn giờ (như tin báo và `ALPHA.xp` khi bóng khép), không hẹn hai cái cùng mốc.
  - Tin từ client luôn kiểm tra kiểu, khoảng cách, cooldown; không tin số từ client.
  - **Kết nối lại** (luật chơi ở `docs/design/multiplayer.md`; hằng số `RECONNECT_GRACE_MS`, `RECONNECT_TRY_MS`, `CLOSE_REPLACED` ở `constants.ts`):
    - Socket đóng mã khác 4000 (rớt mạng, đóng tab mà tin rời không kịp đi) thì Colyseus gọi `onDrop`: server giữ chỗ bằng `allowReconnection(client, reconnectGraceMs / 1000)` (kết quả phải `.catch`, và chỉ coi là đang giữ khi `instanceof Deferred`), đặt `Player.offline = true`, xoá ý định (đi, lướt, lệnh chiêu, aggro), huỷ chiêu chưa phát của thú đi theo và lưu ngay. Chỗ giữ nằm trong `holds` (sessionId → `Deferred`; `reject(false)` kết thúc sớm).
    - `sheltered(target)` chặn nhắm tới và sát thương lên người đang chờ và thú của họ (`targetPos`, `wildTarget`, `damage`); `tickCompanions`, `tickExploration`, `tickClimate`, `tickRegen` bỏ qua họ. Người đang chờ vẫn nằm trong state (đếm trong "👥 n/5").
    - SDK nối lại tại chỗ, giữ sessionId: `onReconnect` bỏ cờ `offline` (không tạo lại gì; client phải gửi lại hướng đi vì ý định đã bị xoá).
    - `onLeave` (rời chủ động mã 4000, hết hạn chờ, hoặc bị thay) luôn đi qua `removePlayer(sessionId)`: lưu rồi xoá mọi thứ của phiên; gọi lần hai vẫn an toàn.
    - `liveSessions` (cấp module, token thiết bị → phiên đang sống, trong toàn process): mỗi thiết bị một phiên. `onJoin` gọi `endSession` cho phiên cũ **trước** khi đọc hồ sơ (đang chờ thì `reject`, đang mở thì `leave(CLOSE_REPLACED)`), nên không có hai bản của một người và bản cũ không ghi đè tiến trình mới. Chạy nhiều process thì phải chuyển sang Presence của Colyseus.
- `ai/`: hàm thuần có test: `wander.ts` (lang thang, `randomPoint`), `wildCombat.ts` (chọn mục tiêu, đuổi, bỏ chạy), `companion.ts` (bám chủ, lao vào thú chủ đánh), `skillAi.ts` (chọn chiêu).
- `persistence/store.ts`: hồ sơ người chơi trong SQLite (`node:sqlite`, file ở `PETGAME_DB`), theo token ngẫu nhiên của thiết bị; luôn qua `sanitizeProfile` khi đọc (thú có kinh nghiệm dư đủ cho cấp sau theo đường cong hiện tại thì lên cấp ngay lúc đọc, không bao giờ xuống). Thêm dữ liệu cần lưu: cập nhật `Profile`, `emptyProfile`, `sanitizeProfile`, chỗ đọc/ghi trong `GameRoom` và test.
- Hook thử nghiệm `debug:*` (spawnPal, give, givePal, gear, wardrobe, quest, setTime, teleport, xp: cộng kinh nghiệm cho thú đang đi theo qua đúng đường lên cấp (`grantXp`: tin `LevelUp`, nhiệm vụ), endGrace: kết thúc ngay mọi lần chờ nối lại trong phòng của người gửi) chỉ đăng ký khi `PETGAME_DEBUG=1`. Không bao giờ bật trên server thật.

## packages/client

- `main.ts`: sảnh (chọn ngoại hình, tên), vào phòng, token thiết bị; `net/connection.ts`: kết nối Colyseus, link mời. **Sảnh sẵn sàng:** `#name` và `#join-btn` bị khoá sẵn trong `index.html` (nút ghi "Đang tải..."), `main.ts` mở khoá (nút ghi "Vào chơi") ngay sau khi gắn handler `submit` và điền tên đã lưu. Bấm lúc chưa sẵn sàng thì trình duyệt tự gửi form và tải lại trang (mất tên vừa gõ và `?room=` của link mời), nên chỉ được vào sảnh khi nút đã mở khoá; e2e chờ `#join-btn:enabled`.
- `net/reconnect.ts`: `ConnectionWatch` theo dõi kết nối (`online` / `reconnecting` / `lost` kèm lý do), đặt chính sách nối lại của SDK (`SDK_RECONNECTION`), bỏ cuộc sau `RECONNECT_TRY_MS`, ping mỗi 2 giây để bắt kết nối treo (quá 6 giây không nghe gì thì đóng bằng mã 4010 cho SDK coi như rớt và nối lại), và rời phòng chủ động khi trang đóng (`pagehide`). **SDK nối lại ngay trên chính đối tượng `Room` cũ** (cùng sessionId, token mới, `room.onReconnect`): không tạo `Room` mới, không gọi lại `bindRoom()`, không dùng `client.reconnect()`. State đầy đủ khi vào lại được giải bằng `decodeResync`: thứ bị xoá trong lúc mất mạng gọi `onRemove`, thứ mới gọi `onAdd`, thứ còn nguyên giữ đối tượng và callback. Không đụng DOM nên có unit test chạy trong Node (`reconnect.test.ts`).
- `game/Game.ts`: nối state phòng với hình (`Callbacks`), gửi input, dự đoán chuyển động, xử lý mọi `ServerMessage`, cập nhật HUD. `window.__petgame = { game, room }` cho e2e và `npm run shots` (đừng xoá). `Game.send` chỉ gửi khi `watch.online`: mất kết nối thì không gửi gì (không xếp hàng để gửi sau), nhân vật đứng yên, phím và nút game vô hiệu; người khác đang chờ nối lại hiện mờ, tên kèm "(mất kết nối)".
- `game/stage.ts`: các lớp từ dưới lên: `ground`, `water`, `marks`, `shadows`, `objects` (xếp theo y của chân), `air`, `weather`; `overlay` (ánh sáng đêm). Camera chỉ dời và phóng.
- `game/ground.ts`, `water.ts`, `scenery.ts`, `lighting.ts`, `weather.ts`: mặt đất nướng sẵn theo mảng, biển và hồ bằng shader, cây/đá theo `defaultWorld()`, ngày đêm, thời tiết theo vùng.
- `game/entities.ts`: `PlayerActor` (búp bê giấy `art/doll.ts`), `PalActor` (một hình mỗi hướng, nhún nhảy; gồng `setWindup`, choáng `setDizzy`, quầng đầu đàn `aura`, bóng mờ `ghost`), `play(...)`, `freeze()`.
- `game/effects.ts`: hiệu ứng ngắn tự dọn (`fx.add(layer, node, giây, update(k))`). `game/skillfx.ts`: hoạt ảnh riêng từng chiêu (`SKILL_SHOWS`), gồng chiêu, cảnh báo trước, vùng đỏ chiêu của thú hoang (`danger`).
- `game/labels.ts`: tên, thanh máu, chữ bay là phần tử DOM theo vị trí thế giới (CSS trong `index.html`). Nhãn tên không đè nhau: `game/labelLayout.ts` (hàm thuần có test) xếp theo hạng `LABEL_RANK` (mình, thú đang nhắm, thú đi theo, đầu đàn/trùm là nhãn ghim, không bao giờ ẩn; rồi người khác, thú khác, thú hoang, trại), nhãn vướng thì nâng ≤ 22 px (ghim ≤ 48), rồi thu còn thanh máu, rồi ẩn bằng `opacity`; nhãn đã thu/ẩn phải có chỗ liên tục 250 ms mới hiện lại. Kích thước nhãn chỉ đo khi nhãn đổi (`MutationObserver` theo class và chữ): đừng gán lại chữ không đổi. Chữ bay nằm trên mọi nhãn. `Game.debugInfo().labels` đếm cho test và `npm run shots`. `game/palSprites.ts` + `art/`: hình thú, cây, đồ vật (ảnh AI trong `public/assets/` hoặc vẽ bằng code).
- `ui/`: DOM overlay: `connection.ts` (màn che khi mất kết nối: "Đang kết nối lại…", "Không kết nối lại được", "Bạn đang chơi ở nơi khác"..., z-index 6, chặn mọi chạm, nút Về sảnh qua `lobbyUrl`), `hud.ts` (trạng thái, toast, nút cảm ứng), `party.ts` (bảng thú; chế độ 🕊️ Thả bớt và hộp xác nhận), `skillbar.ts` (chiêu của thú, phím 1-3), `crafting.ts`, `wardrobe.ts`, `minimap.ts`, `quests.ts`, `joystick.ts`, `keyboard.ts`, `audio.ts` (âm thanh tổng hợp Web Audio, không có file âm thanh).
- `gallery.ts` (`sprites.html`): xem mọi hình (`?show=pals|players|nature|skills`).
- Hiệu năng điện thoại: resolution ≤ 2, dùng chung texture, không tạo object mới mỗi khung hình, ẩn thứ ở xa camera, `destroy()` khi xoá. Ngân sách: ≤ 600 sprite mỗi khung hình (in bởi `npm run shots`), ảnh ≤ 1024×1024, ảnh thú cao 256 px mỗi ô.
- Mọi thao tác dùng được bằng cả cảm ứng lẫn bàn phím; nút cảm ứng ≥ 44×44 px; kiểm tra ở điện thoại dọc, ngang và desktop 1280×720.

## Hình ảnh và asset

- Phong cách và câu lệnh vẽ: `docs/art-style.md`; mô tả từng loài (tiếng Việt và tiếng Anh cho AI vẽ): `docs/design/pals.md`. Không sao chép thiết kế của Palworld, Pokémon hay game có bản quyền.
- `npm run sprite -- <ảnh> --pal <id>` (thú), `--head`/`--outfit` (người chơi), `--objects <tên,...> --sheet <tên>` (cây, đá, đồ vật; `--to characters` cho mũ, vũ khí). Ghi `packages/client/public/assets/...` và `index.json`.
- Ảnh lấy từ ngoài: ghi nguồn và giấy phép vào `assets/CREDITS.md`.

## Kiểm thử

- `npm test` (Vitest): `packages/**/src/**/*.test.ts`. Test tích hợp server ở `rooms/GameRoom.test.ts` dùng `@colyseus/testing` với các helper `setup`, `capture`, `giveCompanion`, `placeWild`, `ticks`, `collect`. Phần kết nối lại (`describe("reconnecting after a dropped connection")`) thêm `cutConnection` (server đóng socket của người chơi: thấy 1006 như mạng chết), `holdReconnect` (client nối lại ngay nhưng chờ ở một cổng) và `reconnected` (chờ `onReconnect` và state đầy đủ sau khi nối lại; gọi trước khi mở cổng). Test dùng trường riêng của `GameRoom` qua `as any` (`holds`, `reconnectGraceMs`, `controls`, `saveNow`...).
- `npm run test:e2e` (Playwright): `tests/e2e/multiplayer.spec.ts`, tự bật server (2567, `PETGAME_DEBUG=1`, DB trong RAM) và Vite (5173). Chromium vẽ WebGL bằng phần mềm nên chờ `window.__petgame.game.frames` tăng thay vì chờ theo giờ.
  - Helper: `openPage` (trang mới trong context mới, tức thiết bị mới), `enterLobby` (chờ `#join-btn:enabled`, điền tên, kiểm tra giá trị, bấm), `join` (hai cái trước), `waitForWorld` (chờ vào thế giới; báo lỗi ngay, kèm chữ lỗi, khi sảnh hiện `#join-error`), `labelOverlaps` (các cặp nhãn tên có phần nhìn thấy giao nhau). Vào sảnh luôn qua `enterLobby`, không `page.fill`/`page.click` rời vào `#name`, `#join-btn`.
  - Cắt mạng: `openWithSwitch` mở context mới với `context.routeWebSocket(/:2567\//)` đặt **trước** khi trang tải (SDK giữ hàm dựng `WebSocket` lúc nạp module) và trả `{ page, cut, restore, freeze }`: `cut()` đóng socket bằng mã 4010 (server biết ngay) rồi từ chối mọi lần nối lại cho đến `restore()`; `freeze()` để các socket đang mở nguyên nhưng không gì qua được nữa (không đóng, không tin nào, như đường truyền chết), các lần nối sau vẫn qua: watchdog của `ConnectionWatch` phải bắt được sau 6-8 giây. Cần thêm một init script đặt **sau** route: SDK mở socket bằng `new WebSocket(url, { headers, protocols })` và chỉ lùi về `new WebSocket(url)` khi lớp WebSocket thật ném lỗi, còn lớp thay thế của Playwright không ném nên `connectToServer()` âm thầm không bao giờ nối được; script làm nó ném như lớp thật. Không dùng `context.setOffline`: nó để socket đang mở nguyên, server chỉ biết sau 6-9 giây nhờ ping, và Vite dev có thể tải lại trang qua socket HMR của nó. **Tin trang gửi trong `pagehide` không qua được route**, nên test đóng trang (rời chủ động) dùng trang thường. `observer(roomId, name)` cho một người chơi thứ hai vào qua SDK, không có trang (không WebGL): nó thấy thế giới đúng như server chia sẻ, và tự rời khi test xong.
  - Nhật ký trang (`watch`): điều hướng của khung chính, `pageerror`, console lỗi, tin `[vite]`, `document`/`script` tải lỗi; chỉ in khi test lỗi. Hai dòng `navigated` liền nhau kèm tin `[vite]` nghĩa là Vite dev đã tải lại trang giữa chừng.
  - Không sửa file của `packages/client` hay `packages/shared` khi e2e đang chạy: Vite dev tải lại mọi trang đang mở.
  - Chạy lặp: `--repeat-each=N --workers=1`. Thiếu `--workers=1` thì các lượt chạy song song (mặc định số worker bằng 50% số nhân CPU, máy 4 nhân là 2).
- `cd tools/photo3d && python -m pytest`: công cụ photo3d (Python).
- `npm run shots -- --name <tên>`: bộ ảnh chuẩn để so sánh hình ảnh trước/sau. `--only world|labels` chọn nhóm (mặc định cả hai); nhóm `labels` chụp đám đông ở 3 khung hình (desktop, điện thoại dọc, ngang) kèm số cặp nhãn chồng nhau và thời gian `labels.update`.
