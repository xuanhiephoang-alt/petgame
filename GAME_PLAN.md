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
| Engine client | **Three.js** + Vite (3D, camera nhìn chéo từ trên xuống) | Thư viện 3D phổ biến nhất cho web, nhẹ (~200 kB gzip), chạy tốt trên điện thoại, đọc model **glTF/GLB** từ Blender/Meshy/Tripo |
| Multiplayer | **Colyseus** (Node.js) | Có sẵn khái niệm "phòng" (room tối đa 5 người), tự đồng bộ trạng thái, có ví dụ dùng với Three.js/Babylon.js |
| Mô hình mạng | **Server quyết định mọi thứ (server-authoritative)**, client dự đoán chuyển động trước | Chống gian lận, tránh lệch trạng thái giữa 5 người |
| Bản đồ | Lưới 2D trên server (vật cản, vùng thú) + cảnh 3D dựng trong **Blender** hoặc sinh bằng code | Server vẫn mô phỏng mặt phẳng 2D: đơn giản, rẻ, đủ cho góc nhìn từ trên xuống |
| Lưu dữ liệu | **PostgreSQL** (Supabase) hoặc SQLite lúc đầu | Lưu tài khoản, thú đã bắt, căn cứ |
| Điện thoại | Bản web dạng **PWA** + joystick ảo (DOM). Sau này đóng gói bằng **Capacitor** để đưa lên Google Play / App Store | Một code base duy nhất |
| Hosting | Client: Vercel/Netlify/Cloudflare Pages (miễn phí). Server: Fly.io / Railway / Colyseus Cloud (~5–20 USD/tháng) | Rẻ, đủ cho ít người chơi |
| Test | Vitest (logic), Playwright (mở 5 tab trình duyệt giả lập 5 người) | Có sẵn Chromium trong môi trường |

> **Đã chọn 3D.** Hình hiển thị là 3D low-poly với camera nhìn chéo từ trên xuống, nhưng server vẫn mô phỏng trên mặt phẳng 2D (x, y) nên netcode đơn giản như game 2D. Low-poly vừa đẹp vừa nhẹ cho điện thoại, và AI tạo model 3D (Meshy, Tripo) làm tốt kiểu này.

### Cấu trúc thư mục (monorepo)

```
petgame/
├── packages/
│   ├── shared/     # schema đồng bộ, message, hằng số, logic dùng chung
│   │   └── src/data/   # pals.json, items.json, recipes.json (dữ liệu thiết kế)
│   ├── server/     # Colyseus: GameRoom, AI thú, quái, lưu game
│   └── client/     # Three.js + Vite: cảnh 3D, model, UI, điều khiển cảm ứng
├── assets/         # file nguồn 3D (.blend), texture gốc
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
| 3 | **client-gameplay** | Cảnh 3D Three.js, model, di chuyển, camera, nội suy chuyển động người khác, hiệu ứng, ném bóng bắt thú | `packages/client/src/scenes` | Từ MVP |
| 4 | **ai-systems** | AI của thú/quái (đi lang thang, đuổi, bỏ chạy), thú đi theo chủ, giao việc ở căn cứ (chặt cây, đào mỏ), tìm đường A* | `packages/server/src/ai` | Alpha |
| 5 | **ui-mobile** | HUD, túi đồ, menu chế tạo, joystick ảo, nút cảm ứng, co giãn theo màn hình, PWA | `packages/client/src/ui` | Từ MVP (joystick), mở rộng ở Alpha |
| 6 | **art-pipeline** | Tạo model 3D bằng Meshy/Tripo/Blender MCP, rig + animation, tối ưu số polygon, xuất GLB, giữ phong cách thống nhất | `assets/`, `packages/client/public` | Từ MVP |
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

Gợi ý: với bản 3D, **[t5c](https://github.com/orion3dgames/t5c)** là repo gần nhất (3D top-down + Colyseus). Các repo Phaser vẫn hữu ích để học phần netcode, túi đồ, chiến đấu. Ngoài ra có thể xem [ví dụ chính thức của Three.js](https://threejs.org/examples/) (nạp GLB, animation, bóng đổ).

> ⚠️ **Bản quyền:** không dùng tên, hình ảnh, thiết kế thú của Palworld/Pokémon. Lấy cơ chế làm cảm hứng, còn thú và thế giới thì tự thiết kế.

---

## 5. Đồ họa 3D: phần mềm, MCP, cách kết nối

### Phần mềm

| Công cụ | Dùng để | Giá |
|---|---|---|
| **Blender** | Dựng, sửa, rig và tạo animation cho model; dựng địa hình; xuất **GLB** | Miễn phí |
| **Meshy** / **Tripo AI** | Tạo model 3D từ chữ hoặc ảnh, tự rig và tạo animation đi/chạy | Có gói miễn phí, trả phí theo lượt |
| **Mixamo** | Animation người (đi, chạy, ném) gắn vào nhân vật | Miễn phí |
| **gltf-transform** / glTF Viewer | Nén GLB (Draco/Meshopt, texture KTX2) cho nhẹ trên điện thoại; xem thử model | Miễn phí |
| **Figma** | Thiết kế UI: HUD, túi đồ, menu, icon | Miễn phí |
| **Kenney.nl, Quaternius, Poly Pizza (CC0)** | Model low-poly miễn phí (cây, đá, nhà, nhân vật) để làm tạm | Miễn phí |

### MCP nên kết nối với Claude Code

| MCP | Làm gì | Trạng thái trong phiên này |
|---|---|---|
| **Blender MCP** ([ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)) | Claude điều khiển Blender: dựng model, vật liệu, ánh sáng, tải asset Poly Haven/Sketchfab, xuất GLB | Cần cài: Blender + addon, rồi `claude mcp add` (chạy trên máy có Blender, không chạy được trong cloud) |
| **Meshy MCP** ([pasie15/meshy-ai-mcp-server](https://github.com/pasie15/meshy-ai-mcp-server)) | Tạo model từ chữ/ảnh, tự rig và tạo animation | Cần API key Meshy |
| **Tripo MCP** | Tương tự Meshy (tạo, rig, animation, đổi định dạng) | Cần API key Tripo |
| **Figma MCP** | Thiết kế màn hình UI, rồi chuyển design thành code | ✅ Đã kết nối |
| **Canva MCP** | Ảnh bìa, banner, ảnh quảng cáo | ⚠️ Cần cấp quyền trong cài đặt connector của claude.ai |
| **GitHub MCP** | Quản lý issue/PR cho các agent | ✅ Đã kết nối |
| **Playwright** (có sẵn Chromium) | Chụp màn hình game để agent tự kiểm tra hình ảnh | ✅ Có sẵn |

### Quy trình đồ họa đề xuất

1. **Chốt phong cách** trong `docs/art-style.md`: low-poly, đổ bóng phẳng (flat shading), màu tươi, thú tròn trịa dễ thương, giới hạn số polygon.
2. **art-pipeline agent** gọi Meshy/Tripo: tạo thú/nhân vật từ mô tả trong `docs/design/pals.md` → tự rig → animation `idle/walk/attack/hurt`.
3. Chỉnh lại trong **Blender** (qua Blender MCP hoặc bằng tay): giảm polygon, sửa màu, đặt gốc tọa độ ở chân, hướng mặt về +Z.
4. Nén bằng **gltf-transform** → `packages/client/public/assets/models/<id>.glb`.
5. client-gameplay thay model tạm (dựng bằng code trong `models.ts`) bằng `GLTFLoader`.
6. UI vẽ trong **Figma** → Figma MCP → code HUD.
7. qa-tester chụp màn hình bằng Playwright để kiểm tra hình hiển thị đúng.

---

## 6. Những thứ quan trọng khác

- **Mạng:** server chạy 20 tick/giây, client 60 FPS và nội suy. Chỉ gửi những gì nằm trong tầm nhìn. Với 5 người chơi thì một server rẻ nhất cũng đủ.
- **Điện thoại:** giới hạn số thú trên màn hình (dưới 50), model low-poly (thú < 3k tam giác), InstancedMesh cho cây/đá, giới hạn pixel ratio ≤ 2, tắt bóng đổ trên máy yếu, khóa xoay ngang, hỗ trợ cả cảm ứng lẫn bàn phím/tay cầm.
- **Mời bạn bè:** tạo phòng → sinh **mã phòng 6 ký tự / link mời**, không cần tài khoản ở MVP.
- **Lưu game:** chủ phòng sở hữu thế giới; lưu định kỳ mỗi 30 giây và khi người chơi thoát.
- **Âm thanh:** sfxr/jsfxr (hiệu ứng), nhạc CC0 hoặc nhạc tạo bằng AI có giấy phép thương mại.
- **Chống gian lận:** client chỉ gửi "ý định" (bấm phím, ném bóng hướng X); mọi kết quả (bắt được hay không, sát thương) đều do server quyết định.
- **Dữ liệu điều khiển game:** thú, vật phẩm, công thức đều nằm trong JSON nên cân bằng game không cần sửa code.

---

## 7. Bước tiếp theo (MVP: tuần 1–2)

1. Dựng monorepo (`shared` / `server` / `client`), TypeScript, Vite, Colyseus.
2. Tạo các file `.claude/agents/*.md` cho 7 agent ở mục 3.
3. Một bản đồ 3D đơn giản với model tạm (dựng bằng code hoặc CC0 từ Kenney/Quaternius).
4. Room Colyseus tối đa 5 người, di chuyển đồng bộ, joystick ảo trên điện thoại.
5. 3 loài thú lang thang, ném bóng để bắt (tỉ lệ theo máu còn lại).
6. Deploy thử: client lên Cloudflare Pages, server lên Fly.io, rồi gửi link cho 4 người bạn test.
