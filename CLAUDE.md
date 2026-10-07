# PetGame: hướng dẫn cho Claude và các agent

Game top-down kiểu Palworld (bắt thú, chiến đấu, xây căn cứ) cho web và điện thoại, tối đa 5 người chơi một thế giới. Kế hoạch tổng thể: `GAME_PLAN.md`.

## Cấu trúc
- `packages/shared`: TypeScript dùng chung: hằng số, schema đồng bộ Colyseus, message, logic thuần (di chuyển, bắt thú), dữ liệu JSON (`src/data/`)
- `packages/server`: Colyseus 0.18, `GameRoom` có server quyết định mọi kết quả (authoritative)
- `packages/client`: Three.js (3D, camera nhìn chéo từ trên xuống) + Vite; HUD và joystick là DOM overlay
- `tests/e2e`: Playwright, nhiều người chơi
- `.claude/agents`: 7 agent chuyên môn; mỗi agent chỉ sửa thư mục của mình (ghi trong file agent)

## Lệnh
- `npm install`: cài đặt (npm workspaces)
- `npm run dev`: chạy server (ws://localhost:2567) và client (http://localhost:5173)
- `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright, tự bật server)
- `npm run build`: build client vào `packages/client/dist`
- `npm run models:build`: dựng lại model GLB của thú từ `assets/pals/build.ts`; xem ở http://localhost:5173/model-viewer.html
- `npm run assets:kaykit`: nhập lại asset CC0 KayKit (cây cỏ, 5 nhân vật, animation) theo `assets/kaykit/manifest.ts`

## Quy tắc chung
- Client chỉ gửi ý định; server quyết định vị trí, sát thương, kết quả bắt thú.
- Server mô phỏng mặt phẳng 2D theo pixel (x, y). Client vẽ 3D trên mặt XZ qua `toScene()` (`packages/client/src/game/coords.ts`, 32 px = 1 đơn vị).
- Logic dùng chung giữa client và server đặt trong `packages/shared` và phải có test.
- Bố cục thế giới (cây, đá, bụi, cỏ, lửa trại) sinh từ seed trong `packages/shared/src/worldgen.ts`. Server lấy vật cản (`defaultWorld().grid`) để chặn người và thú; client vẽ đúng bố cục đó và dùng cùng grid khi dự đoán chuyển động. Không tự rải vật cản riêng ở client.
- Schema dùng `schema()` + `t.*` (không decorator). Đổi schema là đổi giao thức, cần cập nhật client.
- Import nội bộ có đuôi `.ts`. Không có bước compile; server chạy bằng `tsx`, client bằng Vite.
- Không dùng tên, hình hay thiết kế thú của Palworld, Pokémon hoặc game có bản quyền.
- Trước khi commit: `npm run typecheck && npm test`; tính năng chạm tới mạng hoặc UI thì chạy thêm `npm run test:e2e`.
- Mỗi tính năng làm trên nhánh riêng, merge qua PR.
