# PetGame: kế hoạch phát triển

Game kiểu Palworld (bắt thú, cho thú chiến đấu, xây căn cứ, chế tạo, sinh tồn), góc nhìn từ trên xuống (top-down), chạy trên **trình duyệt web và điện thoại**, **tối đa 5 người chơi cùng một thế giới**.

---

## 1. Nhìn cho thực tế

Palworld do hàng chục người làm trong nhiều năm. Để làm được thật, ta **thu nhỏ phạm vi** và đi từng vòng:

| Vòng | Mục tiêu | Có thể chơi được gì |
|---|---|---|
| **MVP (4–6 tuần)** | 1 bản đồ, 5 người online, di chuyển + đánh quái + **ném bóng bắt thú** | 5 người chạy cùng nhau, bắt được 5–8 loài thú |
| **Alpha** | Thú đi theo và đánh giúp, túi đồ, nhặt tài nguyên, chế tạo đơn giản | Vòng chơi chính: đi khám phá → bắt → mạnh lên |
| **Beta** | Xây căn cứ, giao việc cho thú (chặt cây, đào mỏ), lưu game, ngày/đêm | Cảm giác "Palworld" |
| **Bản phát hành** | Nhiều biome, boss, cân bằng chỉ số, âm thanh, PWA/app store | Phát hành |

---

## 2. Công nghệ đề xuất

| Phần | Lựa chọn | Lý do |
|---|---|---|
| Ngôn ngữ | **TypeScript** (dùng cho cả client lẫn server) | Dùng chung code chỉ số, kiểu dữ liệu, công thức sát thương |
| Engine client | **Phaser 3** + Vite | Engine 2D mạnh nhất cho web, chạy mượt trên điện thoại, có sẵn tilemap, va chạm, camera |
| Multiplayer | **Colyseus** (Node.js) | Có sẵn khái niệm "phòng" (room tối đa 5 người), tự đồng bộ trạng thái, có nhiều ví dụ dùng chung với Phaser |
| Mô hình mạng | **Server quyết định mọi thứ (server-authoritative)**, client dự đoán chuyển động trước | Chống gian lận, tránh lệch trạng thái giữa 5 người |
| Bản đồ | **Tiled Map Editor** → xuất JSON → Phaser đọc | Chuẩn de facto cho game 2D |
| Lưu dữ liệu | **PostgreSQL** (Supabase) hoặc SQLite lúc đầu | Lưu tài khoản, thú đã bắt, căn cứ |
| Điện thoại | Bản web dạng **PWA** + joystick ảo (plugin rex-virtual-joystick). Sau này đóng gói bằng **Capacitor** để đưa lên Google Play / App Store | Một code base duy nhất |
| Hosting | Client: Vercel/Netlify/Cloudflare Pages (miễn phí). Server: Fly.io / Railway / Colyseus Cloud (~5–20 USD/tháng) | Rẻ, đủ cho ít người chơi |
| Test | Vitest (logic), Playwright (mở 5 tab trình duyệt giả lập 5 người) | Có sẵn Chromium trong môi trường |

> **2D hay 3D?** Đề xuất **2D pixel art, góc nhìn top-down / 3/4** (kiểu Stardew Valley, Pokémon). Rẻ hơn rất nhiều, AI tạo hình làm tốt, điện thoại chạy nhẹ. Nếu bắt buộc muốn 3D nhìn từ trên xuống thì đổi Phaser thành **Babylon.js** hoặc **Three.js**, còn Colyseus giữ nguyên (xem repo `t5c` bên dưới).

### Cấu trúc thư mục (monorepo)

```
petgame/
├── packages/
│   ├── shared/     # kiểu dữ liệu, chỉ số thú, công thức sát thương, hằng số
│   ├── server/     # Colyseus: GameRoom, AI thú, quái, lưu game
│   └── client/     # Phaser + Vite: scene, UI, điều khiển cảm ứng
├── assets/         # sprite gốc (.aseprite), tileset, file Tiled (.tmx)
├── data/           # pals.json, items.json, recipes.json (dữ liệu thiết kế)
├── .claude/agents/ # định nghĩa các Agent
└── GAME_PLAN.md
```

---

## 3. Cần bao nhiêu Agent, mỗi Agent làm gì?

Đề xuất **1 điều phối + 6 agent chuyên môn**. Đừng chạy cả 7 cùng lúc ngay từ đầu: MVP chỉ cần 3–4 agent, các agent khác thêm dần.

| # | Agent | Nhiệm vụ cụ thể | Thư mục phụ trách | Khi nào dùng |
|---|---|---|---|---|
| 0 | **Điều phối (phiên Claude chính, tức bạn + tôi)** | Chia việc, giữ GAME_PLAN, duyệt PR, quyết định kiến trúc | toàn bộ | Luôn luôn |
| 1 | **game-designer** | Viết dữ liệu: danh sách thú (chỉ số, hệ, kỹ năng), vật phẩm, công thức chế tạo, tỉ lệ bắt, đường cong lên cấp. Chỉ sửa JSON/Markdown | `data/`, `docs/` | Từ MVP |
| 2 | **server-netcode** | Colyseus room, đồng bộ trạng thái, server quyết định va chạm/sát thương, vào lại khi rớt mạng, giới hạn 5 người | `packages/server`, `packages/shared` | Từ MVP |
| 3 | **client-gameplay** | Scene Phaser, di chuyển, camera, nội suy chuyển động người khác, hiệu ứng, ném bóng bắt thú | `packages/client/src/scenes` | Từ MVP |
| 4 | **ai-systems** | AI của thú/quái (đi lang thang, đuổi, bỏ chạy), thú đi theo chủ, giao việc ở căn cứ (chặt cây, đào mỏ), tìm đường A* | `packages/server/src/ai` | Alpha |
| 5 | **ui-mobile** | HUD, túi đồ, menu chế tạo, joystick ảo, nút cảm ứng, co giãn theo màn hình, PWA | `packages/client/src/ui` | Từ MVP (joystick), mở rộng ở Alpha |
| 6 | **art-pipeline** | Gọi PixelLab MCP tạo sprite/tileset, cắt sprite sheet, đặt tên đúng chuẩn, giữ bảng màu thống nhất | `assets/`, `packages/client/public` | Từ MVP |
| 7 | **qa-tester** | Viết test Vitest + Playwright (5 người cùng vào), đo FPS trên màn hình điện thoại, tìm bug lệch đồng bộ | `tests/` | Từ Alpha |

**Quy tắc để các agent không giẫm chân nhau:**
- Mỗi agent chỉ sửa thư mục của mình. Mọi thứ dùng chung đều đi qua `packages/shared`, và chỉ server-netcode được sửa phần này.
- Mỗi tính năng là một nhánh git + PR riêng; agent điều phối review trước khi merge.
- Định nghĩa mỗi agent là một file `.claude/agents/<tên>.md` (có frontmatter `name`, `description`, `tools`) để Claude Code gọi đúng chuyên gia.

---

## 4. Repo tham khảo trên GitHub

| Repo | Học được gì |
|---|---|
| [colyseus/tutorial-phaser](https://github.com/colyseus/tutorial-phaser), xem kèm [hướng dẫn chính thức](https://learn.colyseus.io/phaser/1-basic-player-movement) | **Bắt đầu từ đây.** Di chuyển nhiều người, client dự đoán chuyển động, nội suy, fixed tick |
| [dwdgame](https://github.com/MakingBrowserGames/dwdgame) (tiền thân của **Reldens**) | MMORPG đơn giản dùng Phaser 3 + Colyseus: đăng nhập, chuyển map, đồng bộ người chơi |
| [damian-pastorini/reldens](https://github.com/damian-pastorini/reldens) | MMORPG đầy đủ: túi đồ, kỹ năng, chiến đấu, lưu DB. Tham khảo kiến trúc |
| [PeterChou1/dungeonio](https://github.com/PeterChou1/dungeonio) | Game IO dùng Phaser + Colyseus |
| [orion3dgames/t5c](https://github.com/orion3dgames/t5c) | RPG **3D top-down** dùng Babylon.js + Colyseus, có client-side prediction. Hữu ích nếu chọn 3D |
| Template TypeScript Phaser + Colyseus + React ([bài giới thiệu trên phaser.io](https://phaser.io/news/2026/06/typescript-online-game-template-phaser-colyseus-react-and-electron-in-one-monorepo)) | Cấu trúc monorepo hiện đại |
| [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) | Khung client Phaser + Vite + TS chuẩn |
| [Danh sách ví dụ Colyseus](https://docs.colyseus.io/learn/examples) | Danh sách ví dụ chính thức của Colyseus |

Gợi ý: **không fork nguyên một repo**. Hãy dựng khung từ `template-vite-ts` + `tutorial-phaser` và đọc Reldens để học cách làm túi đồ/chiến đấu.

> ⚠️ **Bản quyền:** không dùng tên, hình ảnh, thiết kế thú của Palworld/Pokémon. Lấy cơ chế làm cảm hứng, còn thú và thế giới thì tự thiết kế.

---

## 5. Đồ họa: phần mềm, MCP, cách kết nối

### Phần mềm

| Công cụ | Dùng để | Giá |
|---|---|---|
| **Aseprite** (hoặc LibreSprite miễn phí) | Vẽ/sửa pixel art, làm animation, xuất sprite sheet | ~20 USD |
| **Tiled** | Vẽ bản đồ từ tileset, đặt vùng xuất hiện thú, vật cản | Miễn phí |
| **Free Texture Packer** / TexturePacker | Gộp sprite thành atlas cho Phaser | Miễn phí / trả phí |
| **Figma** | Thiết kế UI: HUD, túi đồ, menu, icon | Miễn phí |
| **Blender** | Chỉ khi làm 3D, hoặc render model 3D thành sprite 2D | Miễn phí |
| **Kenney.nl, itch.io (asset CC0)** | Asset tạm để làm MVP trước khi có hình thật | Miễn phí |

### MCP nên kết nối với Claude Code

| MCP | Làm gì | Trạng thái trong phiên này |
|---|---|---|
| **PixelLab MCP** | Tạo nhân vật/thú pixel art **4 hoặc 8 hướng**, tạo animation đi/đánh, tạo **tileset Wang** (ghép liền mạch) và tile isometric, ngay từ Claude Code | Cần cài: lấy API key tại [pixellab.ai/vibe-coding](https://www.pixellab.ai/vibe-coding), rồi chạy `claude mcp add` theo hướng dẫn ở đó (gói npm `pixellab-mcp`, cần Node 18+) |
| **Figma MCP** | Thiết kế màn hình UI, rồi chuyển design thành code | ✅ Đã kết nối |
| **Canva MCP** | Ảnh bìa, banner, ảnh quảng cáo | ⚠️ Cần cấp quyền trong cài đặt connector của claude.ai |
| **GitHub MCP** | Quản lý issue/PR cho các agent | ✅ Đã kết nối |
| **Playwright** (có sẵn Chromium) | Chụp màn hình game để agent tự kiểm tra hình ảnh | ✅ Có sẵn |

### Quy trình đồ họa đề xuất

1. **Chốt phong cách:** pixel art, nhân vật 32×32 hoặc 48×48 px, tile 16×16 hoặc 32×32, một bảng màu cố định (ví dụ Lospec "Resurrect 64"). Ghi thành `docs/art-style.md` để mọi prompt AI dùng chung.
2. **art-pipeline agent** gọi PixelLab: tạo thú/nhân vật 8 hướng → thêm animation `idle/walk/attack/hurt` → xuất PNG.
3. Sửa lại bằng tay trong **Aseprite** (AI thường lỗi vài pixel).
4. Gộp thành atlas → `packages/client/public/assets/`.
5. Tạo tileset bằng PixelLab → vẽ map bằng **Tiled** → xuất JSON.
6. UI vẽ trong **Figma** → Figma MCP → code HUD.
7. qa-tester chụp màn hình bằng Playwright để kiểm tra hình hiển thị đúng.

---

## 6. Những thứ quan trọng khác

- **Mạng:** server chạy 20 tick/giây, client 60 FPS và nội suy. Chỉ gửi những gì nằm trong tầm nhìn. Với 5 người chơi thì một server rẻ nhất cũng đủ.
- **Điện thoại:** giới hạn số thú trên màn hình (dưới 50), dùng texture atlas, tắt bớt hiệu ứng trên máy yếu, khóa xoay ngang, hỗ trợ cả cảm ứng lẫn bàn phím/tay cầm.
- **Mời bạn bè:** tạo phòng → sinh **mã phòng 6 ký tự / link mời**, không cần tài khoản ở MVP.
- **Lưu game:** chủ phòng sở hữu thế giới; lưu định kỳ mỗi 30 giây và khi người chơi thoát.
- **Âm thanh:** sfxr/jsfxr (hiệu ứng), nhạc CC0 hoặc nhạc tạo bằng AI có giấy phép thương mại.
- **Chống gian lận:** client chỉ gửi "ý định" (bấm phím, ném bóng hướng X); mọi kết quả (bắt được hay không, sát thương) đều do server quyết định.
- **Dữ liệu điều khiển game:** thú, vật phẩm, công thức đều nằm trong JSON nên cân bằng game không cần sửa code.

---

## 7. Bước tiếp theo (MVP: tuần 1–2)

1. Dựng monorepo (`shared` / `server` / `client`), TypeScript, Vite, Colyseus.
2. Tạo các file `.claude/agents/*.md` cho 7 agent ở mục 3.
3. Một map Tiled đơn giản với asset tạm từ Kenney.
4. Room Colyseus tối đa 5 người, di chuyển đồng bộ, joystick ảo trên điện thoại.
5. 3 loài thú lang thang, ném bóng để bắt (tỉ lệ theo máu còn lại).
6. Deploy thử: client lên Cloudflare Pages, server lên Fly.io, rồi gửi link cho 4 người bạn test.
