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
| Engine client | **PixiJS 8** + Vite (2D WebGL, nhìn từ trên xuống) | Thư viện vẽ 2D nhanh nhất cho web (~180 kB gzip), chạy mượt trên điện thoại, có shader cho nước và ánh sáng |
| Multiplayer | **Colyseus** (Node.js) | Có sẵn khái niệm "phòng" (room tối đa 5 người), tự đồng bộ trạng thái, có ví dụ dùng với Three.js/Babylon.js |
| Mô hình mạng | **Server quyết định mọi thứ (server-authoritative)**, client dự đoán chuyển động trước | Chống gian lận, tránh lệch trạng thái giữa 5 người |
| Bản đồ | Lưới 2D trên server (vật cản, vùng thú), client vẽ đúng bố cục đó bằng sprite | Server mô phỏng mặt phẳng 2D: đơn giản, rẻ, đủ cho góc nhìn từ trên xuống |
| Lưu dữ liệu | **PostgreSQL** (Supabase) hoặc SQLite lúc đầu | Lưu tài khoản, thú đã bắt, căn cứ |
| Điện thoại | Bản web dạng **PWA** + joystick ảo (DOM). Sau này đóng gói bằng **Capacitor** để đưa lên Google Play / App Store | Một code base duy nhất |
| Hosting | Client: Vercel/Netlify/Cloudflare Pages (miễn phí). Server: Fly.io / Railway / Colyseus Cloud (~5–20 USD/tháng) | Rẻ, đủ cho ít người chơi |
| Test | Vitest (logic), Playwright (mở 5 tab trình duyệt giả lập 5 người) | Có sẵn Chromium trong môi trường |

> **Đã chuyển sang 2D** (trước đây là 3D low-poly Three.js). Model 3D tự dựng (Blender, photo3d) không đủ đẹp, còn ảnh 2D do AI vẽ thì đẹp sẵn: mỗi loài thú là một ảnh ghép 4 góc (trước, bên, sau, bên kia) dùng thẳng làm sprite; người chơi là búp bê giấy ghép từ ảnh AI (đầu và kiểu tóc, quần áo, mũ, vũ khí), tự chọn ngoại hình ở sảnh và thay đồ trong **Tủ đồ**. Cây cối, đá và đồ vật cũng là ảnh AI; mặt đất, nước và hiệu ứng vẽ bằng code theo cùng phong cách hoạt hình viền mảnh. Server không đổi gì: nó vẫn mô phỏng mặt phẳng 2D (x, y). Bản 3D vẫn còn trong lịch sử git.

### Cấu trúc thư mục (monorepo)

```
petgame/
├── packages/
│   ├── shared/     # schema đồng bộ, message, hằng số, logic dùng chung
│   │   └── src/data/   # pals.json, items.json, recipes.json (dữ liệu thiết kế)
│   ├── server/     # Colyseus: GameRoom, AI thú, quái, lưu game
│   └── client/     # PixiJS + Vite: thế giới 2D, sprite, UI, điều khiển cảm ứng
├── assets/         # ghi nguồn asset (CREDITS.md)
├── docs/           # phong cách đồ họa, tài liệu thiết kế
├── tests/e2e/      # Playwright: nhiều người chơi
├── .claude/agents/ # định nghĩa 7 Agent
└── GAME_PLAN.md
```

---

## 3. Cần bao nhiêu Agent, mỗi Agent làm gì?

Đề xuất **1 điều phối + 6 agent chuyên môn**. Đừng chạy cả 7 cùng lúc ngay từ đầu: MVP chỉ cần 3–4 agent, các agent khác thêm dần.

| # | Agent | Nhiệm vụ cụ thể | Thư mục phụ trách | Khi nào dùng |
|---|---|---|---|---|
| 0 | **Điều phối (phiên Claude chính, tức bạn + tôi)** | Chia việc, giữ GAME_PLAN, duyệt PR, quyết định kiến trúc | toàn bộ | Luôn luôn |
| 1 | **game-designer** | Viết dữ liệu: danh sách thú (chỉ số, hệ, kỹ năng), vật phẩm, công thức chế tạo, tỉ lệ bắt, đường cong lên cấp. Chỉ sửa JSON/Markdown | `packages/shared/src/data/`, `docs/` | Từ MVP |
| 2 | **server-netcode** | Colyseus room, đồng bộ trạng thái, server quyết định va chạm/sát thương, vào lại khi rớt mạng, giới hạn 5 người | `packages/server`, `packages/shared` | Từ MVP |
| 3 | **client-gameplay** | Thế giới 2D PixiJS, sprite, di chuyển, camera, nội suy chuyển động người khác, hiệu ứng, ném bóng bắt thú | `packages/client/src/game` | Từ MVP |
| 4 | **ai-systems** | AI của thú/quái (đi lang thang, đuổi, bỏ chạy), thú đi theo chủ, giao việc ở căn cứ (chặt cây, đào mỏ), tìm đường A* | `packages/server/src/ai` | Alpha |
| 5 | **ui-mobile** | HUD, túi đồ, menu chế tạo, joystick ảo, nút cảm ứng, co giãn theo màn hình, PWA | `packages/client/src/ui` | Từ MVP (joystick), mở rộng ở Alpha |
| 6 | **art-pipeline** | Hình 2D: vẽ bằng code (`art/`) hoặc ảnh AI tách nền thành sprite (`npm run sprite`), giữ phong cách thống nhất | `packages/client/src/game/art`, `packages/client/public/assets` | Từ MVP |
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
| Template TypeScript Phaser + Colyseus + React ([bài giới thiệu trên phaser.io](https://phaser.io/news/2026/06/typescript-online-game-template-phaser-colyseus-react-and-electron-in-one-monorepo)) | Cấu trúc monorepo hiện đại |
| [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) | Khung client Phaser + Vite + TS chuẩn |
| [Danh sách ví dụ Colyseus](https://docs.colyseus.io/learn/examples) | Danh sách ví dụ chính thức của Colyseus |

Gợi ý: các repo Phaser + Colyseus ở trên gần với bản 2D nhất (netcode, túi đồ, chiến đấu). Phần vẽ thì xem [ví dụ chính thức của PixiJS](https://pixijs.com/8.x/examples) (sprite, shader, render texture).

> ⚠️ **Bản quyền:** không dùng tên, hình ảnh, thiết kế thú của Palworld/Pokémon. Lấy cơ chế làm cảm hứng, còn thú và thế giới thì tự thiết kế.

---

## 5. Đồ họa 2D: công cụ và quy trình

### Công cụ

| Công cụ | Dùng để | Giá |
|---|---|---|
| **AI vẽ ảnh** (Figma AI qua Figma MCP, hoặc ChatGPT, Gemini...) | Vẽ thú, người chơi, cây cối, đồ vật theo câu lệnh mẫu trong `docs/art-style.md`: một ảnh nhiều góc (hoặc nhiều vật) trên nền trơn | Tốn credit AI (Figma Starter còn giới hạn số lần gọi MCP) |
| **`npm run sprite`** (photo3d) | Tách nền, cắt từng góc, xếp thành sprite cho game, tự sửa lỗi AI hay mắc; `--head`, `--outfit` cho kiểu tóc, quần áo người chơi; `--objects` cho cây cối, đồ vật, mũ, vũ khí | Có sẵn trong repo |
| **Vẽ bằng code** (`packages/client/src/game/art/`) | Cây cối, đá, nước, trại, hiệu ứng và hình dự phòng cho mọi thứ, cùng một phong cách | Có sẵn trong repo |
| **Figma** | Thiết kế UI: HUD, túi đồ, menu, icon | Miễn phí |

### MCP nên kết nối với Claude Code

| MCP | Làm gì | Trạng thái trong phiên này |
|---|---|---|
| **Figma MCP** | Thiết kế màn hình UI, vẽ concept art | ✅ Đã kết nối |
| **Canva MCP** | Ảnh bìa, banner, ảnh quảng cáo | ⚠️ Cần cấp quyền trong cài đặt connector của claude.ai |
| **GitHub MCP** | Quản lý issue/PR cho các agent | ✅ Đã kết nối |
| **Playwright** (có sẵn Chromium) | Chụp màn hình game để agent tự kiểm tra hình ảnh (`npm run shots`) | ✅ Có sẵn |

### Quy trình đồ họa

1. **Phong cách** chốt trong `docs/art-style.md`: hoạt hình 2D, viền mảnh màu đậm, tô 2 tông, mắt to, ánh sáng từ trên bên trái.
2. **Thú và người chơi:** game-designer viết mô tả ngoại hình trong `docs/design/pals.md`; AI vẽ ảnh 4 góc theo câu lệnh mẫu rồi `npm run sprite -- anh.png --pal <id>`. Người chơi: ảnh 4 góc em bé tóc tím cho từng kiểu tóc (`--head <id>`) và từng bộ quần áo (`--outfit <id>`), mũ và vũ khí vẽ chung một ảnh (`--objects ... --to characters`). Đã có ảnh AI cho cả 13 loài, 8 kiểu tóc, 8 bộ quần áo, 8 mũ và 8 vũ khí; hình vẽ bằng code (`art/pals.ts`, `art/player.ts`) là dự phòng.
3. **Cây cối, đá, đồ vật:** AI vẽ nhiều vật trên một ảnh, `npm run sprite -- anh.png --objects <tên model,...> --sheet <tên>`. Đã có ảnh AI cho cây (mọi vùng), cọ, xương rồng, bụi, đá (kiểu riêng từng vùng), rương, lửa trại, bè, núi lửa và vật trang trí của cả 6 vùng; vật chưa có ảnh vẫn vẽ bằng code (`art/nature.ts`, `art/props.ts`).
4. **Kiểm tra:** `npm run dev`, mở http://localhost:5173/sprites.html (mọi hình), rồi vào game; `npm run shots` chụp đủ các vùng.
5. UI vẽ trong **Figma** → Figma MCP → code HUD.

---

## 6. Những thứ quan trọng khác

- **Mạng:** server chạy 20 tick/giây, client 60 FPS và nội suy. Chỉ gửi những gì nằm trong tầm nhìn. Với 5 người chơi thì một server rẻ nhất cũng đủ.
- **Điện thoại:** giới hạn số thú trên màn hình (dưới 50), mặt đất nướng sẵn thành từng mảng (cỏ, hoa không tốn gì mỗi khung hình), chỉ vẽ cây và thú gần camera, giới hạn pixel ratio ≤ 2, hỗ trợ cả cảm ứng lẫn bàn phím/tay cầm.
- **Mời bạn bè:** tạo phòng → sinh **mã phòng 6 ký tự / link mời**, không cần tài khoản ở MVP.
- **Lưu game:** chủ phòng sở hữu thế giới; lưu định kỳ mỗi 30 giây và khi người chơi thoát.
- **Âm thanh:** sfxr/jsfxr (hiệu ứng), nhạc CC0 hoặc nhạc tạo bằng AI có giấy phép thương mại.
- **Chống gian lận:** client chỉ gửi "ý định" (bấm phím, ném bóng hướng X); mọi kết quả (bắt được hay không, sát thương) đều do server quyết định.
- **Dữ liệu điều khiển game:** thú, vật phẩm, công thức, quần áo, mũ và vũ khí (`wearables.json`: chống rét/nắng, giáp, sát thương, tầm đánh) đều nằm trong JSON nên cân bằng game không cần sửa code.

---

## 7. Bước tiếp theo (MVP: tuần 1–2)

1. Dựng monorepo (`shared` / `server` / `client`), TypeScript, Vite, Colyseus.
2. Tạo các file `.claude/agents/*.md` cho 7 agent ở mục 3.
3. Một bản đồ đơn giản với hình tạm (vẽ bằng code).
4. Room Colyseus tối đa 5 người, di chuyển đồng bộ, joystick ảo trên điện thoại.
5. 3 loài thú lang thang, ném bóng để bắt (tỉ lệ theo máu còn lại).
6. Deploy thử: client lên Cloudflare Pages, server lên Fly.io, rồi gửi link cho 4 người bạn test.
