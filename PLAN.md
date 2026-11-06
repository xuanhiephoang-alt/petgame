# PLAN: T34 E2E và `npm run shots` chạy được với Chromium cài sẵn của container

## Mục tiêu

- **Đội chấm PASS dựa vào e2e, nhưng hiện cả 28 test hỏng ngay khi mở trình duyệt.** Lý do: `@playwright/test` ghim 1.56.1 nên tìm `chromium_headless_shell-1194`, còn container cloud mới chỉ có bản 1243 (Chrome for Testing 153.0.8010.12). `npm run shots` hỏng cùng lý do.
- **Sau nhiệm vụ:**
  - `npm run test:e2e` và `npm run shots` chạy thẳng trong container: không phải tự đặt `PLAYWRIGHT_BROWSERS_PATH`, không cần thư mục symlink;
  - CI và máy người dùng chạy y như cũ.
- Người chơi không thấy gì khác.

## Phạm vi

Làm, trong một commit:
- **File mới `scripts/chromium.mjs`:** một hàm chọn trình duyệt, dùng chung cho mọi chỗ khởi động Chromium.
- **Các chỗ khởi động Chromium** (đã rà cả repo, trừ `node_modules`). Chỉ có hai chỗ:
  - `playwright.config.ts:7-10` (khối `use`). Cả 28 test e2e mở trình duyệt qua fixture `browser` của config này (`tests/e2e/multiplayer.spec.ts:47-48`: `openPage` gọi `browser.newContext`). Không test nào gọi `chromium.launch()` trực tiếp. `observer()` vào phòng qua SDK trong Node, không mở trình duyệt.
  - `scripts/shots.mjs:287`: `chromium.launch()`.
  - Những chỗ không dùng trình duyệt: các script khác trong `scripts/` (`dev.mjs`, `photo3d.mjs`, `photo3d-ai-setup.mjs`, `blender.mjs`), `tools/photo3d`, và Vitest (không chạy chế độ browser).
- **Test:** unit test `scripts/chromium.test.mjs`, thêm vào `include` của `vitest.config.ts`.
- **CI:** `.github/workflows/ci.yml` ghi rõ e2e dùng bản Playwright tự cài.
- **Tài liệu:** coder sửa `docs/architecture.md`; agent chính thay một dòng trong `CLAUDE.md` (đoạn đề xuất ở Thiết kế 5).

KHÔNG làm:
- Không nâng hay hạ `@playwright/test`. Lên 1.63 thì khớp bản 1243, nhưng đó là đổi phụ thuộc cho CI và mọi máy, mà ảnh container còn có thể đổi tiếp.
- Không chạy `playwright install`, không sửa gì trong `/opt`, không sửa `.claude/settings.json`.
- Không sửa `tests/e2e/multiplayer.spec.ts`, timeout, số worker, `webServer`. Không chuyển e2e sang bản build (việc đó là T16).
- Không thêm cờ dòng lệnh cho Chrome (Thiết kế 3).
- Không sửa `.claude/agents/tester.md`: dòng "Chromium đã cài sẵn, không chạy `playwright install`" vẫn đúng.

## Thiết kế

### 1. Kết quả thử trong container này (Playwright 1.56.1, chạy bằng root)

- **Mặc định** (không truyền `executablePath`): `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
- **`executablePath: "/opt/pw-browsers/chromium"`** (symlink tới `chromium-1243/chrome-linux64/chrome`, bản Chrome đầy đủ):
  - mở được, `browser.version()` = 153.0.8010.12;
  - có cả WebGL lẫn WebGL2, renderer "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) ...))";
  - không cần thêm cờ nào.
- **So sánh tốc độ trên hai test e2e nặng nhất về hình:** "5 players share one world..." (6 trang) và "labels: in a crowd on a phone..." (`isMobile`, `hasTouch`). Cả hai đều qua:
  - Chrome đầy đủ: 17,0 s;
  - headless shell 1243 (`/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`): 14,7 s.

  Tester của T7 đã chạy qua cả 28 test bằng headless shell 1243.
- **Bẫy:** Chrome đầy đủ tạo socket `SingletonSocket` trong `$TMPDIR`. Nếu `TMPDIR` là scratchpad (đường dẫn dài), Chrome thoát ngay với `FATAL ... process_singleton_posix.cc ... Socket path too long`. Headless shell không bị lỗi này.

### 2. Chọn trình duyệt: `chromiumLaunchOptions()` trong `scripts/chromium.mjs`

Các luật xét theo thứ tự, luật đầu tiên khớp được dùng:

| Điều kiện | Kết quả | Dùng khi |
|---|---|---|
| `PETGAME_CHROMIUM=playwright` | `{}`: Playwright tự chọn bản của nó | CI (đặt sẵn trong `ci.yml`), hoặc khi muốn đúng bản ghim |
| `PETGAME_CHROMIUM=<đường dẫn>`, file có thật | `{ executablePath: <đường dẫn> }` | Thử trình duyệt khác, ví dụ headless shell |
| `PETGAME_CHROMIUM=<đường dẫn>`, không có file | ném `Error` ngay khi nạp config, trước khi build hay bật server | Gõ sai |
| Không đặt (hoặc rỗng, chỉ có dấu cách), có `/opt/pw-browsers/chromium` | `{ executablePath: "/opt/pw-browsers/chromium" }` | Container cloud |
| Không đặt, không có đường dẫn đó | `{}`, y như hiện nay | Máy người dùng, runner CI |

Lý do:
- **Dùng Chrome đầy đủ ở `/opt/pw-browsers/chromium`, không dùng headless shell:**
  - đúng hướng dẫn của môi trường;
  - đường dẫn ổn định: không chứa số bản, và ảnh container tự trỏ lại symlink khi đổi bản. Thư mục headless shell thì mang số 1243 và sẽ đổi;
  - chạy được cả `--headed` và `--debug`;
  - chậm hơn khoảng 15% trên hai test đã đo, chấp nhận được.

  Headless shell vẫn dùng được qua biến ghi đè (luật 2).
- **Có `/opt/...` là dùng, không dò xem bản Playwright cần đã được cài chưa.** Muốn dò thì phải biết bố cục thư mục và số bản nội bộ của Playwright, dễ gãy khi nâng Playwright. Máy người dùng và runner GitHub không có đường dẫn này. CI vẫn đặt `PETGAME_CHROMIUM=playwright` cho chắc (Thiết kế 4).
- **Tên biến** theo tiền tố của project (`PETGAME_DB`, `PETGAME_DEBUG`). Từ khoá `playwright` rõ nghĩa hơn chuỗi rỗng, vì nhiều shell và CI coi chuỗi rỗng như chưa đặt. Chuỗi rỗng ở đây cũng được coi là chưa đặt.
- **Đường dẫn sai thì báo một lỗi duy nhất lúc nạp config**, thay vì 28 test cùng hỏng với một lỗi lặp lại.
- **Hàm nhận `env` và `exists` từ ngoài** (mặc định `process.env` và `existsSync`), để test không đụng hệ thống file hay `process.env`. Hàm không in gì, vì Playwright nạp lại config trong mỗi worker.
- **Dùng file `.mjs`:** `scripts/shots.mjs` chạy bằng `node` trần, mà Node ≥ 22.13 chưa chắc tự đọc được `.ts`. `playwright.config.ts` import được `.mjs` khi `package.json` có `"type": "module"` (đã thử với `playwright test --list`).

### 3. Cờ của Chrome

Không cần thêm cờ nào.
- Playwright 1.56.1 tự thêm `--headless` (Chrome 153 hiểu là chế độ headless mới) và `--no-sandbox` (bắt buộc vì container chạy bằng root), cùng bộ cờ tự động hoá thường lệ.
- Ở chế độ headless, WebGL tự chạy bằng SwiftShader.
- Nếu một bản Chrome sau này thôi tự chuyển sang SwiftShader (WebGL mất, `game.frames` không tăng): thêm `args: ["--enable-unsafe-swiftshader"]` vào nhánh `/opt` của hàm. Trên macOS, Playwright cũng tự thêm cờ này.

### 4. CI

Thêm `PETGAME_CHROMIUM: playwright` vào `env` của bước `npm run test:e2e` trong `ci.yml`. Nhờ vậy CI luôn dùng đúng bản vừa cài bằng `npx playwright install --with-deps chromium`, kể cả khi ảnh runner sau này có `/opt/pw-browsers/chromium`. Hành vi hiện nay không đổi: hàm trả `{}` như khi không có biến.

### 5. Đoạn đề xuất cho `CLAUDE.md` (agent chính áp dụng)

Thay dòng 118 (mục "Môi trường và lưu ý"):

> - Chromium cho Playwright đã cài sẵn và `@playwright/test` được ghim 1.56.1: **không chạy `playwright install`**.

bằng:

> - `@playwright/test` được ghim 1.56.1, còn container cloud cài sẵn Chromium khác bản (Chrome 153 ở `/opt/pw-browsers/chromium`, trong khi Playwright 1.56.1 đòi bản 1194). E2E và `npm run shots` tự dùng đường dẫn đó khi có (`scripts/chromium.mjs`), nên cứ chạy thẳng `npm run test:e2e`, không cần `PLAYWRIGHT_BROWSERS_PATH` hay thư mục symlink. **Không chạy `playwright install`.** Ghi đè bằng `PETGAME_CHROMIUM=<đường dẫn tới chrome>`, hoặc `PETGAME_CHROMIUM=playwright` để dùng bản Playwright tự cài (CI đặt sẵn). Đừng đặt `TMPDIR` dài (ví dụ trỏ vào scratchpad) khi chạy: Chrome sẽ báo `Socket path too long` rồi thoát.

## Kế hoạch triển khai

1. **`scripts/chromium.mjs` (mới).** Chú thích đầu file (tiếng Anh): đây không phải script để chạy; `playwright.config.ts` và `scripts/shots.mjs` dùng chung.
   - `export const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";`. JSDoc nói đây là Chromium cài sẵn của container cloud (symlink do ảnh container giữ), và bản của nó có thể khác bản `@playwright/test` đang ghim cần (ví dụ 1243 so với 1194).
   - `export function chromiumLaunchOptions(env = process.env, exists = existsSync)` trả `{ executablePath?: string }` theo đúng bảng ở Thiết kế 2.
     - Đọc `env.PETGAME_CHROMIUM` và `trim()` trước khi xét.
     - Đường dẫn không có thật thì ném `Error` với chữ: `` `PETGAME_CHROMIUM is "${choice}", but there is no file there: give the path to a Chromium executable, or "playwright" for Playwright's own browser` ``.
     - Chỉ import `existsSync` từ `node:fs`. Không `console.log`.
   - JSDoc của hàm (tiếng Anh) nói đủ:
     - thứ tự luật;
     - vì sao trả `{}` khi không tìm thấy gì (giữ lựa chọn của Playwright cho CI và máy người dùng);
     - không cần cờ thêm (Playwright tự thêm `--headless`, `--no-sandbox`; WebGL qua SwiftShader);
     - bẫy `TMPDIR` dài.

     Kiểu ghi bằng JSDoc (`@param`, `@returns`).
2. **`scripts/chromium.test.mjs` (mới) và `vitest.config.ts`.**
   - Thêm `"scripts/**/*.test.mjs"` vào `include`, giữ mẫu cũ.
   - Test dùng `env` là object riêng và `exists` giả (tra trong danh sách đường dẫn), không đọc ổ đĩa. Danh sách test ở mục Test.
3. **`playwright.config.ts`.**
   - `import { chromiumLaunchOptions } from "./scripts/chromium.mjs";`
   - Trong `use`, ngay sau `...devices["Desktop Chrome"],` thêm `launchOptions: chromiumLaunchOptions(),`, kèm một dòng chú thích: `// Chromium to start: the cloud container's preinstalled one if present; PETGAME_CHROMIUM overrides (scripts/chromium.mjs).`
   - Không đổi gì khác.
4. **`scripts/shots.mjs`.**
   - Import `chromiumLaunchOptions` từ `./chromium.mjs`.
   - Thêm một dòng vào chú thích cách dùng ở đầu file: `PETGAME_CHROMIUM=<path>|playwright` chọn trình duyệt, giống e2e.
   - Gọi `const launchOptions = chromiumLaunchOptions();` ngay sau vòng kiểm `--only`, tức trước `mkdirSync`, build và bật server. Như vậy `PETGAME_CHROMIUM` sai thì báo lỗi ngay.
   - Dòng 287: `chromium.launch(launchOptions)`. Nếu lời gọi này ném lỗi thì `server.kill()` rồi ném tiếp.
     - Vì sao: hiện lỗi mở trình duyệt (đúng tình huống T34) bỏ lại server cổng 2599 chạy mồ côi, vì lời gọi nằm ngoài `try/finally`.
     - Hậu quả nếu để nguyên: lần chạy sau, server mới không mở được cổng (lỗi bị nuốt vì `stdio: "ignore"`) và script nói chuyện với server cũ.
5. **`.github/workflows/ci.yml`.** Ở job `e2e`, bước `- run: npm run test:e2e` (dòng 43) thêm khoá `env:` thẳng cột với `run:` (8 dấu cách). Bên trong (10 dấu cách) có hai dòng:
   - chú thích `# The browser installed above for the pinned Playwright, never a preinstalled one (scripts/chromium.mjs).`;
   - `PETGAME_CHROMIUM: playwright`.

   Bước `npx playwright install --with-deps chromium` giữ nguyên.
6. **`docs/architecture.md`, mục "Kiểm thử":**
   - Dòng `npm test`: mẫu file test thêm `scripts/**/*.test.mjs`.
   - Dưới dòng `npm run test:e2e`, thêm một ý con đứng đầu, trước "Helper:":
     > - Trình duyệt: `scripts/chromium.mjs` (`chromiumLaunchOptions`, dùng chung cho `playwright.config.ts` và `scripts/shots.mjs`) chọn Chromium theo thứ tự sau.
     >   - `PETGAME_CHROMIUM=playwright`: để Playwright tự chọn bản của nó (CI đặt sẵn).
     >   - `PETGAME_CHROMIUM=<đường dẫn>`: dùng file đó; không có file thì báo lỗi ngay.
     >   - Không đặt: dùng `/opt/pw-browsers/chromium` nếu có. Đây là Chrome cài sẵn của container cloud, có thể khác bản Playwright ghim (hiện là bản 1243, Chrome 153, còn Playwright 1.56.1 cần bản 1194). Không có đường dẫn đó thì để Playwright chọn như mặc định (máy người dùng).
     >
     >   Không cần cờ thêm: Playwright tự thêm `--headless` và `--no-sandbox`, WebGL chạy bằng SwiftShader. Chrome đầy đủ tạo socket trong `$TMPDIR`, nên `TMPDIR` dài (ví dụ scratchpad) làm nó thoát với `Socket path too long`.
   - Dòng `npm run shots`: thêm "Trình duyệt chọn giống e2e (`scripts/chromium.mjs`)."
7. **Agent chính** thay dòng trong `CLAUDE.md` theo Thiết kế 5, trong cùng commit.

## Giao thức

Không đổi: `schema.ts`, `messages.ts`, `Profile` giữ nguyên. Không ảnh hưởng client hay server; chỉ đụng công cụ kiểm thử, CI và tài liệu.

## Test

**Unit** (`scripts/chromium.test.mjs`, chạy trong `npm test`), 6 test:
- "keeps Playwright's own browser when nothing is preinstalled (CI, players' machines)": `({}, exists không có gì)` cho `{}`.
- "uses the cloud container's preinstalled Chromium when it is there": `({}, có PREINSTALLED_CHROMIUM)` cho `{ executablePath: "/opt/pw-browsers/chromium" }`. Kiểm luôn giá trị của hằng số.
- "PETGAME_CHROMIUM=playwright keeps Playwright's own browser even when one is preinstalled": cho `{}`.
- "a PETGAME_CHROMIUM path wins over the preinstalled one": `/x/chrome` có thật, `/opt/...` cũng có, kết quả là `{ executablePath: "/x/chrome" }`.
- "a PETGAME_CHROMIUM path with no file there fails at once, naming the variable and the path": `toThrow` với biểu thức khớp `PETGAME_CHROMIUM` và `/nope/chrome`.
- "an empty or blank PETGAME_CHROMIUM counts as unset": `""` khi không có `/opt` cho `{}`; `"  "` khi có `/opt` cho đường dẫn `/opt`.

**E2E:** không thêm hay sửa test. Chạy cả bộ.

**Tester kiểm thêm trong container.** Các lệnh có biến môi trường đứng trước dùng được: T7 đã chạy `PLAYWRIGHT_BROWSERS_PATH=... npm run test:e2e`.
1. `npm run test:e2e`, không thêm biến hay cờ nào: 28 passed. Nếu có test hỏng, áp dụng luật chạy lại của tester. Nếu một test chỉ hỏng với Chrome đầy đủ, chạy lại nó với `PETGAME_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` để phân biệt lỗi môi trường với lỗi code, rồi ghi vào `PROGRESS.md`.
2. `PLAYWRIGHT_BROWSERS_PATH= npx playwright test -g "wild pals spawn"`: qua, chứng tỏ không còn phụ thuộc biến của container.
3. `PETGAME_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell npx playwright test -g "wild pals spawn"`: qua, nghĩa là ghi đè bằng đường dẫn có tác dụng.
4. `PETGAME_CHROMIUM=playwright npx playwright test -g "wild pals spawn"`: **phải hỏng** với `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1194/...`. Đây là đường của CI, nơi bản 1194 có được cài.
5. `PETGAME_CHROMIUM=/khong/co npx playwright test --list`: hỏng với **một** lỗi có tên biến và `/khong/co`.
6. `npm run shots -- --only labels`: in `Saved N shots to shots/latest/`. Xem một ảnh bằng Read. Sau đó `ss -ltn` không còn gì nghe ở cổng 2599.
7. `PETGAME_CHROMIUM=/khong/co npm run shots -- --only labels --no-build`: hỏng ngay, trước khi bật server; không có gì nghe ở cổng 2599.

## Tiêu chí hoàn thành

- [ ] `scripts/chromium.mjs` export `PREINSTALLED_CHROMIUM` và `chromiumLaunchOptions(env, exists)` đúng 5 dòng của bảng ở Thiết kế 2. Hàm không in gì; JSDoc tiếng Anh như bước 1.
- [ ] `playwright.config.ts` chỉ thêm import và `launchOptions: chromiumLaunchOptions()`.
- [ ] `scripts/shots.mjs` gọi hàm trước khi build và bật server, và `server.kill()` khi `chromium.launch` ném lỗi.
- [ ] Grep (trừ `node_modules`): ngoài `playwright.config.ts` và `scripts/shots.mjs`, không chỗ nào khác khởi động Chromium (`chromium.launch`, `launchPersistentContext`). `executablePath` chỉ xuất hiện trong `scripts/chromium.mjs` và test của nó, nên logic chọn đường dẫn chỉ nằm một chỗ.
- [ ] `npm run typecheck`, `npm test` (thêm 6 test, không test nào bị bỏ qua) và `npm run build` đều qua.
- [ ] Trong container: `npm run test:e2e` chạy thẳng, 28/28 qua. Không cần `PLAYWRIGHT_BROWSERS_PATH` tự đặt hay thư mục symlink (kiểm 2 qua).
- [ ] `npm run shots -- --only labels` chạy xong, ảnh đúng, không để server mồ côi.
- [ ] Kiểm 3, 4, 5, 7 cho đúng kết quả mong đợi.
- [ ] CI: `ci.yml` chỉ thêm `env: PETGAME_CHROMIUM: playwright` ở bước e2e, bước `npx playwright install --with-deps chromium` giữ nguyên. Không có `/opt/pw-browsers/chromium` thì hàm trả `{}` (unit test đầu tiên), tức Playwright chạy như trước.
- [ ] `docs/architecture.md` có ba chỗ sửa của bước 6. Dòng `CLAUDE.md` đã thay theo Thiết kế 5.

## Rủi ro, câu hỏi mở

- **`TMPDIR` dài làm Chrome đầy đủ thoát** (`Socket path too long`). Đã ghi vào hai tài liệu. Nếu thật sự cần `TMPDIR` dài, dùng `PETGAME_CHROMIUM=<headless shell>`.
- **Chrome 153 mới hơn bản Playwright 1.56.1 được kiểm với nó** (141). Thực tế giao thức CDP vẫn khớp: T7 qua 28/28 với headless shell 153, và hai test nặng qua với Chrome đầy đủ. Nếu cả bộ lộ khác biệt chỉ có ở chế độ headless mới, đổi mặc định sang headless shell là việc nhỏ trong cùng hàm, nhưng chỉ đổi khi có bằng chứng (xem kiểm 1).
- **Chậm hơn khoảng 15%** so với headless shell. Với 2 worker mặc định, máy chịu tải nặng hơn khi vẽ WebGL bằng phần mềm. Nhiệm vụ này không đổi số worker.
- **Ảnh container đổi:** nếu `/opt/pw-browsers/chromium` biến mất, hàm lùi về mặc định của Playwright, và lỗi sẽ chỉ ra bản Playwright cần. Tài liệu đã hướng dẫn dùng `PETGAME_CHROMIUM`. Nếu WebGL mất ở Chrome mới hơn, xem Thiết kế 3.
- Không có quyết định nào cần người dùng; không có dòng chặn.
- Không đề xuất tách nhiệm vụ: vừa một vòng coder.
