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
| `skills.ts` + `data/skills.json` | 30 chiêu: `skillPower`, `learnset`, `knownSkills`, `skillTravelMs`, `inSkillArea`, hằng số lệnh chiêu |
| `elements.ts` | Khắc hệ (×1,5 / ×0,75), màu hệ |
| `capture.ts` | Tỉ lệ bắt, số lần lắc bóng, thời gian |
| `combat.ts`, `gathering.ts` | Sát thương, choáng, hạ gục, rơi đồ; chặt cây, đập đá |
| `progression.ts`, `work.ts` | Kinh nghiệm, lên cấp, máu theo cấp; thú làm việc ở trại |
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
  - Tin từ client luôn kiểm tra kiểu, khoảng cách, cooldown; không tin số từ client.
- `ai/`: hàm thuần có test: `wander.ts` (lang thang, `randomPoint`), `wildCombat.ts` (chọn mục tiêu, đuổi, bỏ chạy), `companion.ts` (bám chủ, lao vào thú chủ đánh), `skillAi.ts` (chọn chiêu).
- `persistence/store.ts`: hồ sơ người chơi trong SQLite (`node:sqlite`, file ở `PETGAME_DB`), theo token ngẫu nhiên của thiết bị; luôn qua `sanitizeProfile` khi đọc. Thêm dữ liệu cần lưu: cập nhật `Profile`, `emptyProfile`, `sanitizeProfile`, chỗ đọc/ghi trong `GameRoom` và test.
- Hook thử nghiệm `debug:*` (spawnPal, give, givePal, gear, wardrobe, quest, setTime, teleport) chỉ đăng ký khi `PETGAME_DEBUG=1`. Không bao giờ bật trên server thật.

## packages/client

- `main.ts`: sảnh (chọn ngoại hình, tên), vào phòng, token thiết bị; `net/connection.ts`: kết nối Colyseus, link mời.
- `game/Game.ts`: nối state phòng với hình (`Callbacks`), gửi input, dự đoán chuyển động, xử lý mọi `ServerMessage`, cập nhật HUD. `window.__petgame = { game, room }` cho e2e và `npm run shots` (đừng xoá).
- `game/stage.ts`: các lớp từ dưới lên: `ground`, `water`, `marks`, `shadows`, `objects` (xếp theo y của chân), `air`, `weather`; `overlay` (ánh sáng đêm). Camera chỉ dời và phóng.
- `game/ground.ts`, `water.ts`, `scenery.ts`, `lighting.ts`, `weather.ts`: mặt đất nướng sẵn theo mảng, biển và hồ bằng shader, cây/đá theo `defaultWorld()`, ngày đêm, thời tiết theo vùng.
- `game/entities.ts`: `PlayerActor` (búp bê giấy `art/doll.ts`), `PalActor` (một hình mỗi hướng, nhún nhảy; gồng `setWindup`, choáng `setDizzy`, quầng đầu đàn `aura`, bóng mờ `ghost`), `play(...)`, `freeze()`.
- `game/effects.ts`: hiệu ứng ngắn tự dọn (`fx.add(layer, node, giây, update(k))`). `game/skillfx.ts`: hoạt ảnh riêng từng chiêu (`SKILL_SHOWS`), gồng chiêu, cảnh báo trước, vùng đỏ chiêu của thú hoang (`danger`).
- `game/labels.ts`: tên, thanh máu, chữ bay là phần tử DOM theo vị trí thế giới (CSS trong `index.html`). `game/palSprites.ts` + `art/`: hình thú, cây, đồ vật (ảnh AI trong `public/assets/` hoặc vẽ bằng code).
- `ui/`: DOM overlay: `hud.ts` (trạng thái, toast, nút cảm ứng), `party.ts` (bảng thú), `skillbar.ts` (chiêu của thú, phím 1-3), `crafting.ts`, `wardrobe.ts`, `minimap.ts`, `quests.ts`, `joystick.ts`, `keyboard.ts`, `audio.ts` (âm thanh tổng hợp Web Audio, không có file âm thanh).
- `gallery.ts` (`sprites.html`): xem mọi hình (`?show=pals|players|nature|skills`).
- Hiệu năng điện thoại: resolution ≤ 2, dùng chung texture, không tạo object mới mỗi khung hình, ẩn thứ ở xa camera, `destroy()` khi xoá. Ngân sách: ≤ 600 sprite mỗi khung hình (in bởi `npm run shots`), ảnh ≤ 1024×1024, ảnh thú cao 256 px mỗi ô.
- Mọi thao tác dùng được bằng cả cảm ứng lẫn bàn phím; nút cảm ứng ≥ 44×44 px; kiểm tra ở điện thoại dọc, ngang và desktop 1280×720.

## Hình ảnh và asset

- Phong cách và câu lệnh vẽ: `docs/art-style.md`; mô tả từng loài (tiếng Việt và tiếng Anh cho AI vẽ): `docs/design/pals.md`. Không sao chép thiết kế của Palworld, Pokémon hay game có bản quyền.
- `npm run sprite -- <ảnh> --pal <id>` (thú), `--head`/`--outfit` (người chơi), `--objects <tên,...> --sheet <tên>` (cây, đá, đồ vật; `--to characters` cho mũ, vũ khí). Ghi `packages/client/public/assets/...` và `index.json`.
- Ảnh lấy từ ngoài: ghi nguồn và giấy phép vào `assets/CREDITS.md`.

## Kiểm thử

- `npm test` (Vitest): `packages/**/src/**/*.test.ts`. Test tích hợp server ở `rooms/GameRoom.test.ts` dùng `@colyseus/testing` với các helper `setup`, `capture`, `giveCompanion`, `placeWild`, `ticks`, `collect`.
- `npm run test:e2e` (Playwright): `tests/e2e/multiplayer.spec.ts`, tự bật server (2567, `PETGAME_DEBUG=1`, DB trong RAM) và Vite (5173); helper `join`, `waitForWorld`. Chromium vẽ WebGL bằng phần mềm nên chờ `window.__petgame.game.frames` tăng thay vì chờ theo giờ.
- `cd tools/photo3d && python -m pytest`: công cụ photo3d (Python).
- `npm run shots -- --name <tên>`: bộ ảnh chuẩn để so sánh hình ảnh trước/sau.
