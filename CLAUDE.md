# PetGame: hướng dẫn cho Claude và đội agent

Game 2D nhìn từ trên xuống kiểu bắt thú (bắt thú, chiến đấu, xây trại, chế tạo, khám phá) cho web và điện thoại, tối đa 5 người chơi một thế giới. Project chạy ở **chế độ đội agent tự động**: người dùng giao việc một lần (qua `TASKS.md`), các agent tự làm đến khi xong, chỉ hỏi lại theo đúng mục "Khi nào dừng lại hỏi".

- Bản đồ hệ thống (file nào làm gì): `docs/architecture.md`
- Thiết kế: `docs/design/pals.md` (thú, vùng, thú đầu đàn), `docs/design/skills.md` (chiêu), `docs/art-style.md` (phong cách hình); kế hoạch tổng thể: `GAME_PLAN.md`

## Công nghệ và cấu trúc

- **TypeScript** strict, ES modules, npm workspaces, Node ≥ 22.13. Không có bước compile: server chạy bằng `tsx`, client bằng Vite.
- **Client:** PixiJS 8 (2D WebGL) + Vite 8; HUD, bảng, joystick là DOM overlay (CSS trong `packages/client/index.html`). Âm thanh tổng hợp bằng Web Audio.
- **Server:** Colyseus 0.18 + Express 5, server quyết định mọi kết quả, 20 tick/giây. Lưu game bằng SQLite (`node:sqlite`).
- **Kiểm thử:** Vitest 5 (logic, tích hợp server với `@colyseus/testing`), Playwright 1.56.1 (e2e nhiều người chơi). Công cụ Python `tools/photo3d` có pytest riêng.

```
packages/shared/   dữ liệu (src/data/*.json) + logic thuần dùng chung (schema, message, di chuyển, chiến đấu, chiêu, bắt thú, thế giới...)
packages/server/   index.ts (Express + Colyseus), rooms/GameRoom.ts (luật chơi), ai/ (hành vi thú), persistence/store.ts (lưu game)
packages/client/   src/main.ts (sảnh), src/game/ (thế giới, hình, hiệu ứng), src/ui/ (HUD, bảng, nút), public/assets/ (ảnh AI)
tests/e2e/         Playwright        tools/photo3d/   công cụ ảnh -> sprite/model (Python)
scripts/           dev, shots, sprite/photo3d        docs/   tài liệu        .claude/agents/   đội agent
```

## Lệnh

| Việc | Lệnh |
|---|---|
| Cài đặt | `npm install` |
| Chạy khi phát triển | `npm run dev` (server ws://localhost:2567 + client http://localhost:5173) |
| Chạy như bản thật (một cổng, có địa chỉ LAN cho điện thoại) | `npm run play` |
| Build client | `npm run build` (ra `packages/client/dist`) |
| Kiểm tra kiểu | `npm run typecheck` |
| Unit + tích hợp | `npm test` (một file: `npx vitest run <đường dẫn>`, lọc: `-t "<tên>"`) |
| E2E | `npm run test:e2e` (tự bật server 2567 + Vite 5173; một test: `npx playwright test -g "<tên>"`) |
| Công cụ photo3d | `cd tools/photo3d && python -m pytest -q` |
| Ảnh chụp so sánh hình | `npm run shots -- --name <tên>` (ra `shots/<tên>/` + số sprite) |
| Xem mọi hình | `npm run dev` rồi mở `/sprites.html` (`?show=pals\|players\|nature\|skills`) |
| Ảnh AI thành sprite | `npm run sprite -- <ảnh> --pal <id>` (`--head`, `--outfit`, `--objects ... --sheet ...`; xem `docs/art-style.md`) |
| Deploy | Một container chạy server + client đã build (`Dockerfile`, `render.yaml`, `fly.toml`; xem `docs/deploy.md`) |

CI (`.github/workflows/ci.yml`) chạy: typecheck, test, build, pytest photo3d, e2e.

## Quy ước code (rút từ code hiện có)

**Định dạng và đặt tên**
- 2 dấu cách, nháy kép, có dấu chấm phẩy, dấu phẩy cuối trong khối nhiều dòng. Không có formatter hay linter: viết giống code xung quanh; `npm run typecheck` phải sạch (`noUnusedLocals`, `noUnusedParameters`).
- `camelCase` cho hàm, biến; `PascalCase` cho class, type, schema; `UPPER_SNAKE_CASE` cho hằng số (`WILD_PAL_TARGET`, `SKILL_ORDER_MS`) và bảng cấu hình (`BOSS`, `ALPHA`).
- Tên file `camelCase.ts` (`skillfx.ts`, `palSprites.ts`); file của class chính viết hoa (`Game.ts`, `GameRoom.ts`). Test đặt cạnh file: `<tên>.test.ts`.
- Id dữ liệu viết thường không dấu: loài `emberpup`, chiêu `fire_breath`. Khoá JSON `camelCase`.
- Import nội bộ có đuôi `.ts`; kiểu dữ liệu import bằng `type`. Client và server import shared qua `@petgame/shared`.

**Chú thích và ngôn ngữ**
- Chú thích code bằng **tiếng Anh**: JSDoc `/** ... */` cho hàm, class, trường không hiển nhiên (nói làm gì và vì sao); chú thích trong thân hàm ngắn, nói ý định.
- Chữ người chơi thấy (HUD, thông báo, tên chiêu) bằng **tiếng Việt**. Tài liệu `.md` bằng tiếng Việt. Commit message bằng tiếng Anh.

**Kiến trúc**
- Client chỉ gửi ý định (`ClientMessage`); server quyết định vị trí, sát thương, kết quả bắt thú, rơi đồ. Server kiểm tra kiểu, khoảng cách, cooldown của mọi tin; không tin số từ client.
- Server mô phỏng mặt phẳng 2D theo pixel (x sang phải, y xuống dưới); client vẽ thẳng bằng pixel đó, vật đứng xếp trước sau theo y của chân.
- Logic dùng chung giữa client và server đặt trong `packages/shared` và **phải có test**. Hàm thuần nhận `random` từ ngoài để test được.
- Bố cục thế giới sinh từ seed trong `packages/shared/src/worldgen.ts` (`defaultWorld()`); server lấy vật cản từ đó, client vẽ đúng bố cục đó. Không tự rải vật cản ở client.
- Schema dùng `schema()` + `t.*` (không decorator). Đổi schema hoặc message là đổi giao thức: cập nhật server và client trong cùng nhiệm vụ.
- Dữ liệu chỉ server cần (input, cooldown, não AI, hồi chiêu) để trong `Map` của `GameRoom`, không đưa vào schema. Hẹn giờ bằng `this.clock.setTimeout`.
- Số liệu cân bằng nằm trong dữ liệu (`src/data/*.json`) hoặc bảng hằng số (`BOSS`, `ALPHA`, `progression.ts`), không rải số cứng trong logic.
- Lưu game: `packages/server/src/persistence/store.ts` (SQLite ở `PETGAME_DB`, mặc định `packages/server/data/`), hồ sơ theo token ngẫu nhiên của thiết bị, luôn qua `sanitizeProfile` khi đọc. Thêm dữ liệu cần lưu: `Profile`, `emptyProfile`, `sanitizeProfile`, chỗ đọc/ghi trong `GameRoom` và test. Hồ sơ cũ phải còn đọc được. Test dùng `PETGAME_DB=:memory:`.
- Hook thử nghiệm `debug:*` (spawnPal, give, givePal, gear, wardrobe, quest, setTime, teleport) chỉ bật khi `PETGAME_DEBUG=1` (Playwright tự đặt). Không bao giờ bật trên server thật.
- Client: không tạo object mới mỗi khung hình, ẩn thứ ở xa camera, `destroy()` khi xoá; ngân sách ≤ 600 sprite mỗi khung hình. Mọi thao tác dùng được bằng cả cảm ứng lẫn bàn phím, nút cảm ứng ≥ 44×44 px; kiểm tra ở điện thoại dọc, ngang và desktop.
- `window.__petgame = { game, room }` phục vụ e2e và `npm run shots`: không xoá.
- Không dùng tên, hình hay thiết kế thú của Palworld, Pokémon hoặc game có bản quyền. Ảnh lấy từ ngoài ghi nguồn vào `assets/CREDITS.md`.

## Đội agent (`.claude/agents/`)

| Agent | Model | Việc | Ghi vào |
|---|---|---|---|
| `game-designer` | opus | Phân tích yêu cầu, thiết kế, kế hoạch triển khai. Không viết code | `PLAN.md` (và `docs/design/` khi thiết kế đổi) |
| `coder` | sonnet | Viết/sửa code theo PLAN.md, sửa lỗi tester/reviewer báo | code, `PROGRESS.md` |
| `tester` | sonnet | Chạy typecheck, test, build, e2e; viết test còn thiếu; báo lỗi cụ thể | file test, `PROGRESS.md` |
| `reviewer` | opus | Rà soát độc lập so với PLAN.md: logic, gian lận, đồng bộ, hiệu năng, trùng lặp. Không viết code | `REVIEW.md` |
| `explorer` | haiku | Tra cứu nhanh trong codebase, chỉ đọc | (trả lời trực tiếp) |
| `asset-manager` | sonnet | Hình ảnh và asset: sprite từ ảnh AI, hình vẽ bằng code, ảnh chụp kiểm tra. Thay coder ở bước 2 cho việc thuần hình ảnh | asset, `PROGRESS.md` |
| `balance-analyst` | sonnet | Tính toán cân bằng chỉ số (TTK, kinh nghiệm, tỉ lệ bắt, kinh tế), đề xuất số cụ thể. Không sửa code | `BALANCE.md` |

Agent chính (phiên Claude đang đọc file này) là **người điều phối**: chọn nhiệm vụ, gọi agent theo đúng thứ tự, đọc kết quả, commit, cập nhật `TASKS.md`. Agent chính không tự viết code sản phẩm; mọi thay đổi code đi qua coder (hoặc asset-manager).

## Quy trình bắt buộc cho mọi nhiệm vụ

0. **Chọn việc:** nhiệm vụ chưa xong có ưu tiên cao nhất trong `TASKS.md` (đọc từ trên xuống, bỏ qua mục đang chờ trả lời trong `QUESTIONS.md`). Đánh dấu nó là đang làm.
1. **game-designer** viết `PLAN.md`. Nhiệm vụ cân bằng hoặc thêm thú/chiêu/vật phẩm/kẻ địch: gọi **balance-analyst** trước để có `BALANCE.md`. Cần tra cứu nhanh: gọi **explorer**. Nếu PLAN.md có dòng "CHẶN:", chuyển sang mục "Khi nào dừng lại hỏi".
2. **coder** (hoặc **asset-manager** nếu PLAN.md giao việc hình ảnh) làm theo PLAN.md, ghi `PROGRESS.md`.
3. **tester** chạy kiểm thử, ghi mục "Kiểm thử vòng N: PASS/FAIL" vào `PROGRESS.md`.
4. **reviewer** (chỉ khi tester PASS) ghi `REVIEW.md`, dòng đầu `PASS` hoặc `FAIL`.
5. **Vòng sửa lỗi:** tester FAIL hoặc reviewer FAIL thì quay lại bước 2, đưa coder đúng báo cáo lỗi; rồi lại bước 3, 4. **Tối đa 3 vòng** (một vòng = coder → tester → reviewer). Hết 3 vòng vẫn lỗi: dừng nhiệm vụ đó theo mục dưới.
6. **Hoàn tất** (tester PASS và `REVIEW.md` bắt đầu bằng `PASS`):
   - `git add` đúng các file của nhiệm vụ (code, test, tài liệu, `PLAN.md`, `PROGRESS.md`, `REVIEW.md`, `TASKS.md`), rồi `git commit` với message mô tả (tiếng Anh, dòng đầu ≤ 72 ký tự, thân nói thay đổi gì và vì sao, kèm mã nhiệm vụ).
   - Cập nhật `TASKS.md`: đánh dấu xong `[x]` kèm mã commit; thêm việc mới phát hiện (từ PLAN.md, REVIEW.md) vào đúng mức ưu tiên.
   - Làm nhiệm vụ tiếp theo. Tiếp tục đến khi `TASKS.md` không còn việc nào làm được.

Quyết định nhỏ (tên, bố cục, con số hợp lý, cách làm khi có nhiều cách tương đương) thì tự quyết, ghi lý do vào PLAN.md, không hỏi.

## Khi nào dừng lại hỏi

Chỉ dừng hỏi người dùng khi:
1. Yêu cầu mâu thuẫn (với nhau, hoặc với luật trong file này).
2. Cần quyết định thiết kế lớn không thể đảo ngược (ví dụ: đổi giao thức làm hỏng dữ liệu người chơi đã lưu, xoá tính năng đang có, đổi engine hoặc kiến trúc mạng, tốn chi phí thật như credit AI ngoài kế hoạch).
3. Sau 3 vòng sửa vẫn không qua được tester hoặc reviewer.

Khi đó: ghi vào `QUESTIONS.md` (ngày, mã nhiệm vụ, câu hỏi, bối cảnh, các phương án, **đề xuất của bạn** và lý do), đánh dấu nhiệm vụ trong `TASKS.md` là "⛔ chờ trả lời", không commit phần dở dang của nhiệm vụ đó (để nguyên trong cây làm việc hoặc `git stash` có ghi chú), rồi chuyển sang nhiệm vụ độc lập tiếp theo. Báo người dùng ở cuối phiên.

## Git và an toàn

- Làm và commit trên nhánh hiện tại; mỗi nhiệm vụ một commit (hoặc vài commit nhỏ có nghĩa).
- **Không** `git push`, **không** `git reset --hard`, **không** xoá thư mục, **không** `git clean` (đã chặn trong `.claude/settings.json`). Người dùng tự push.
- Không commit file sinh ra: `dist/`, `test-results/`, `shots/`, `packages/server/data/` (đã có trong `.gitignore`).
- Không tắt, bỏ qua hay nới lỏng test để cho qua.

## Môi trường và lưu ý

- Chromium cho Playwright đã cài sẵn và `@playwright/test` được ghim 1.56.1: **không chạy `playwright install`**.
- E2E cần cổng 2567 và 5173 trống: tắt server dev trước khi chạy. Chromium vẽ WebGL bằng phần mềm nên game tải chậm (timeout 180 s); chờ `window.__petgame.game.frames` tăng thay vì chờ theo giờ.
- `node:sqlite` cần Node ≥ 22.13. Test photo3d cần Python với numpy, pillow, scipy, fast-simplification, pytest.
- Tạo ảnh bằng AI (Figma/Canva MCP) tốn credit của người dùng: chỉ làm khi nhiệm vụ yêu cầu rõ.

## File làm việc của đội

| File | Ai ghi | Nội dung |
|---|---|---|
| `TASKS.md` | agent chính | Danh sách việc theo ưu tiên, trạng thái, mã commit |
| `PLAN.md` | game-designer | Thiết kế + kế hoạch của nhiệm vụ đang làm (ghi đè mỗi nhiệm vụ) |
| `BALANCE.md` | balance-analyst | Phân tích số liệu cân bằng |
| `PROGRESS.md` | coder, asset-manager, tester | Tiến độ từng vòng và kết quả kiểm thử của nhiệm vụ đang làm |
| `REVIEW.md` | reviewer | Kết quả rà soát, dòng đầu `PASS` hoặc `FAIL` |
| `QUESTIONS.md` | agent chính | Câu hỏi cho người dùng kèm đề xuất |
