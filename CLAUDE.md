# PetGame: hướng dẫn cho Claude và các agent

Game top-down kiểu Palworld (bắt thú, chiến đấu, xây căn cứ) cho web và điện thoại, tối đa 5 người chơi một thế giới. Kế hoạch tổng thể: `GAME_PLAN.md`.

## Cấu trúc
- `packages/shared`: TypeScript dùng chung: hằng số, schema đồng bộ Colyseus, message, logic thuần (di chuyển, bắt thú), dữ liệu JSON (`src/data/`)
- `packages/server`: Colyseus 0.18, `GameRoom` có server quyết định mọi kết quả (authoritative)
- `packages/client`: PixiJS 8 (2D, nhìn từ trên xuống, hình vẽ kiểu hoạt hình) + Vite; HUD và joystick là DOM overlay. Hình vẽ bằng code ở `src/game/art/`; thú, người chơi, cây cối và đồ vật có thể thay bằng ảnh AI vẽ trong `public/assets/` (`pals/`, `players/`, `nature/`)
- `tests/e2e`: Playwright, nhiều người chơi
- `.claude/agents`: 8 agent chuyên môn; mỗi agent chỉ sửa thư mục của mình (ghi trong file agent). `visual-director` giữ phong cách và chất lượng hình ảnh tổng thể

## Lệnh
- `npm install`: cài đặt (npm workspaces)
- `npm run dev`: chạy server (ws://localhost:2567) và client (http://localhost:5173)
- `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright, tự bật server)
- `npm run build`: build client vào `packages/client/dist`
- `npm run sprite -- <ảnh> --pal <id>`: biến một ảnh thú (ảnh ghép 4 góc do AI vẽ, hoặc một ảnh) thành hình 2D của loài đó trong game: tách nền, xếp các góc, tự sửa lỗi AI hay mắc (góc nghiêng đổi chỗ hoặc cùng quay một phía, đường kẻ mặt đất), ghi `packages/client/public/assets/pals/<id>.webp` và `index.json`. `--player <0-4>`: nhân vật người chơi của slot đó (`assets/players/`). `--objects <tên,tên,...> --sheet <tên>`: ảnh vẽ nhiều cây cối, đá, đồ vật thành một tấm ảnh gộp (`assets/nature/`; tên là model của `worldgen.ts`, xem `docs/art-style.md`). Xem mọi hình ở http://localhost:5173/sprites.html (`?show=players`, `?show=nature`)
- `npm run play`: build rồi chạy server phục vụ luôn game (một cổng), in địa chỉ LAN cho điện thoại; xem `docs/choi-tren-iphone.md`.
- Deploy: một container (hoặc Render qua `render.yaml`; `Dockerfile`, `fly.toml`) chạy server và phục vụ luôn client đã build; xem `docs/deploy.md`.
- `npm run shots -- --name <tên>`: chụp bộ ảnh chuẩn (mọi vùng, ngày/đêm, cận cảnh thú, điện thoại) vào `shots/<tên>/` kèm số sprite, để so sánh đồ họa trước/sau
- `npm run photo3d -- <thư mục ảnh>`: công cụ tạo model 3D từ 4 ảnh chụp (trước/phải/sau/trái, thêm ảnh chéo và ảnh trên nếu có; tự hiệu chỉnh ảnh điện thoại theo EXIF; hoặc `<một ảnh>`: ảnh ghép nhiều góc, hoặc một ảnh duy nhất; `--rig` thêm xương và 4 animation; `--sprite` làm hình 2D thay cho model 3D (như `npm run sprite`); `--ai hunyuan` hoặc `--ai hinh.glb` lấy hình dạng chi tiết từ AI, cài AI một lần bằng `npm run photo3d:ai-setup`) trong `tools/photo3d` (Python + numpy, hoặc chạy bằng Python của Blender); test: `cd tools/photo3d && python -m pytest`; xem `tools/photo3d/README.md` và skill `.claude/skills/photo-to-3d`
- `npm run photo3d:web`: trang web của photo3d (kéo thả ảnh, xem trước 3D có động tác, tải về; chế độ **Một ảnh** có nút **Đưa vào game** làm hình 2D cho một loài thú), mở được cả từ điện thoại cùng Wi-Fi. Game là 2D nên không dùng model 3D; photo3d vẫn giữ để làm model 3D cho việc khác

## Quy tắc chung
- Client chỉ gửi ý định; server quyết định vị trí, sát thương, kết quả bắt thú.
- Server mô phỏng mặt phẳng 2D theo pixel (x sang phải, y xuống dưới). Client vẽ thẳng bằng pixel đó (`packages/client/src/game/stage.ts`: camera chỉ dời và phóng to); vật đứng (cây, người, thú) xếp trước sau theo y của chân.
- Logic dùng chung giữa client và server đặt trong `packages/shared` và phải có test.
- Bố cục thế giới (cây, đá, bụi, cỏ, lửa trại) sinh từ seed trong `packages/shared/src/worldgen.ts`. Server lấy vật cản (`defaultWorld().grid`) để chặn người và thú; client vẽ đúng bố cục đó và dùng cùng grid khi dự đoán chuyển động. Không tự rải vật cản riêng ở client.
- Schema dùng `schema()` + `t.*` (không decorator). Đổi schema là đổi giao thức, cần cập nhật client.
- Import nội bộ có đuôi `.ts`. Không có bước compile; server chạy bằng `tsx`, client bằng Vite.
- Lưu game: `packages/server/src/persistence/store.ts` (SQLite `node:sqlite`, file ở `PETGAME_DB`, mặc định `packages/server/data/`). Hồ sơ theo token ngẫu nhiên của thiết bị (`JoinOptions.token`), luôn qua `sanitizeProfile` khi đọc. Test dùng `PETGAME_DB=:memory:`.
- Test hook phía server (`debug:*`: spawnPal, give, setTime, teleport) chỉ bật khi `PETGAME_DEBUG=1` (Playwright tự đặt). Không bao giờ bật trên server thật.
- Không dùng tên, hình hay thiết kế thú của Palworld, Pokémon hoặc game có bản quyền.
- Trước khi commit: `npm run typecheck && npm test`; tính năng chạm tới mạng hoặc UI thì chạy thêm `npm run test:e2e`.
- Mỗi tính năng làm trên nhánh riêng, merge qua PR.
