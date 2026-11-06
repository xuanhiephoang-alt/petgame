# PROGRESS: T34 Playwright dùng Chromium cài sẵn

## Vòng 1: coder
- [x] Bước 1: `scripts/chromium.mjs` (mới): `PREINSTALLED_CHROMIUM`, `chromiumLaunchOptions(env, exists)` đúng 5 luật của bảng
- [x] Bước 2: `scripts/chromium.test.mjs` (mới, 6 test) + `vitest.config.ts` thêm `scripts/**/*.test.mjs`
- [x] Bước 3: `playwright.config.ts`: import + `launchOptions: chromiumLaunchOptions()`
- [x] Bước 4: `scripts/shots.mjs`: gọi hàm trước build/server, `server.kill()` khi `chromium.launch` ném lỗi, ghi chú cách dùng
- [x] Bước 5: `.github/workflows/ci.yml`: `PETGAME_CHROMIUM: playwright` ở bước e2e
- [x] Bước 6: `docs/architecture.md`: ba chỗ sửa mục "Kiểm thử"
- Bước 7 (`CLAUDE.md`) để agent chính áp dụng.
- Lệch kế hoạch: không có.
- Tự kiểm (shell của container đã đặt sẵn `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, không phải tôi đặt; không đặt `TMPDIR`):
  - `npm run test:e2e -- --workers=1`: 27/28 qua. Hỏng "toasts: the catch and the quest it finishes show together; small notices do not push out a level-up" (dòng 1478, chờ `.hud-toasts`). Chạy lặp 3 lần: Chrome đầy đủ 1/3 qua; headless shell 1243 (qua `PETGAME_CHROMIUM`) 2/3 qua. Hỏng với cả hai trình duyệt nên là test chập chờn (timing), không do việc chọn trình duyệt; tester cần xem lại.
  - Kiểm 2 (`PLAYWRIGHT_BROWSERS_PATH=` rỗng, "wild pals spawn"): qua. Kiểm 3 (headless shell qua biến): qua. Kiểm 4 (`=playwright`): hỏng đúng với `Executable doesn't exist at .../chromium_headless_shell-1194/...`. Kiểm 5 (`/khong/co`, `--list`): một lỗi có tên biến và đường dẫn.
  - Kiểm 6 `npm run shots -- --only labels`: "Saved 9 shots to shots/latest/". Kiểm 7 (`/khong/co`, `--no-build`): lỗi ngay trước khi bật server. Sau đó cổng 2599, 2567, 5173 trống (kiểm bằng curl; `ss` không có trong container).
- Lệnh đã chạy: typecheck ✓, test ✓ (288 test), build ✓

## Kiểm thử vòng 1: FAIL (chỉ vì một test e2e chập chờn có sẵn trong test, không do T34)
- typecheck ✓   test ✓ (288, 25 file, gồm 6 test của `scripts/chromium.test.mjs`)   build ✓   e2e: cả bộ `--workers=1` 28/28 ✓ ở lần chạy này; riêng test toasts hỏng 3/12 và 2/10 lần chạy lặp   photo3d (không chạy)   shots `--only labels` ✓ (9 ảnh)
- Tiêu chí hoàn thành: [x] chọn trình duyệt đúng 5 luật (mặc định dùng `/opt/pw-browsers/chromium`; `PLAYWRIGHT_BROWSERS_PATH` đặt hay để trống đều chạy)  [x] `shots` chạy được  [x] CI: `PETGAME_CHROMIUM: playwright` cho `{}` nên hành vi CI không đổi (kiểm: `=playwright` trong container này báo đúng `Executable doesn't exist .../chromium_headless_shell-1194`, vì container không cài bản 1194; CI cài bản đó bằng `playwright install`)  [ ] "cả bộ e2e qua" không ổn định vì lỗi 1
- Lỗi 1 (chập chờn, nguyên nhân gốc là test): `npx playwright test -g "the catch and the quest it finishes"` -> `expect(locator).toContainText(/Máu đang đầy|Hết 🫐 quả mọng/) ... Received string: "" ... waiting for locator('.hud-toasts')` tại `tests/e2e/multiplayer.spec.ts:1478`. Tần suất: 2/10 (lần chạy 1), 3/12 (lần có đo thêm); lần chạy cả bộ qua. Nguyên nhân: phím `h` gửi `Eat`; server (`GameRoom.ts:1119-1126`, `eat()`) chỉ báo "Máu đang đầy" khi máu đã đầy, còn khi máu chưa đầy (và còn quả mọng) thì ăn im lặng, không có thông báo. Sau lần bắt đầu tiên nhiệm vụ `first_catch` thưởng 5 quả mọng (`shared/quests.ts:20`), nên `h` luôn có quả; thú hoang vừa bị ném bóng đôi khi cắn người chơi trước đó. Đo bằng bản sao tạm của test (đã xoá) in `hp` ngay trước khi bấm phím: mọi lần hỏng có `hp` < 100 (66, 53, 92.4), mọi lần qua có `hp` = 100. Không liên quan đến `toastQueue.ts`/`hud.ts`, thời điểm tin server, hay trình duyệt.
  - Cách sửa đề xuất (sửa test, không đụng code sản phẩm): trước khi bấm phím, đưa người chơi về máu đầy có điều kiện chắc chắn, hoặc bỏ phụ thuộc vào `h`: dùng một phím từ chối luôn có thông báo cục bộ (ví dụ `4`/`r` đã có "Chưa có 🔵 Bóng xịn") hoặc để người chơi hết quả mọng rồi mới bấm `h` (-> "Hết 🫐 quả mọng"). Hoặc chờ `me.hp === me.maxHp` bằng `expect.poll` trước dòng 1476 (kèm thêm bước loại bỏ thú hoang gần đó nếu hồi máu chậm).
- Test đã thêm: không (không sửa file test theo luật "không làm yếu test"; lỗi nằm ở giả định của test, chờ coder sửa theo đề xuất).

## Vòng 2: coder
- [x] Lỗi 1 (test "toasts: ... small notices do not push out a level-up" chập chờn): chỉ sửa `tests/e2e/multiplayer.spec.ts`. Trước `debug:givePal`, dịch người chơi đi xa thú hoang (`debug:teleport` tới 3150,2500) rồi `expect.poll` chờ `hp >= maxHp`, nên phím `h` luôn ra "Máu đang đầy". Chỉ chờ hp thôi là chưa đủ: thú hoang còn đứng gần cứ cắn nên máu không hồi (5 giây không bị đánh mới hồi), lần thử đó hỏng 1/12. Không đổi code sản phẩm, không nới kiểm tra.
- Lệch kế hoạch: không có.
- Tự kiểm: test này 12/12 và 12/12 qua (hai đợt `--repeat-each=12 --workers=1`); cả bộ `npm run test:e2e -- --workers=1`: 28 passed; cổng 2599/2567/5173 trống.
- Lệnh đã chạy: typecheck ✓, test ✓ (vòng 1: 288 test; vòng 2 chỉ đổi file e2e)

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (288)   e2e ✓ cả bộ `--workers=1` 28/28   test toasts lặp `--repeat-each=20`: 20/20 qua, không lần nào hỏng (kể cả bước bắt thú)   shots `--only labels` ✓   photo3d (không chạy)
- Tiêu chí T34: [x] chạy thẳng không cần đặt biến trình duyệt  [x] shots  [x] CI không đổi (`PETGAME_CHROMIUM: playwright` -> `{}`)  [x] cả bộ e2e qua
- Lỗi vòng 1 đã hết: bản sửa (teleport + chờ hp đầy) đúng nguyên nhân gốc. Cộng dồn vòng 1+2 bước bắt thú không hỏng lần nào trong 20+ lượt ở phía tôi.
- Test đã thêm: không.
