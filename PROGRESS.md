# PROGRESS: T64 Giới hạn số thế giới được tạo

## Vòng 1: coder
- [x] Bước 1: `WORLD_LIMITS`, `WORLD_LIMIT_STATUS`, `WORLD_LIMIT_ERROR` kèm JSDoc (`packages/shared/src/constants.ts`).
- [x] Bước 2: module mới `packages/server/src/worldLimits.ts`: `clientAddress`, `addressKey`, `WorldCensus`/`worldCensus`, `worldLimitsFromEnv`, `trustProxyFromEnv`, `guardWorldCreation` (ghi đè `x-real-ip`, tắt `join`/`joinOrCreate`, bọc `invokeMethod` cho `create`, hàm gỡ), log chặn tối đa 1 dòng/60 s không có IP, cảnh báo `X-Forwarded-For` một lần.
- [x] Bước 3: `GameRoom.ts`: `worldCensus.opened` cuối `onCreate`, `worldCensus.closed` đầu `onDispose`.
- [x] Bước 4: `index.ts`: đọc cấu hình, `GET /whoami`, `guardWorldCreation` sau `listen()`, in dòng cấu hình.
- [x] Bước 5-6: client `net/connection.ts` (`busy`, `tooMany` trong `joinFailure`) và `ui/joinStatus.ts` (hai thẻ mới).
- [x] Bước 7-9: `playwright.config.ts` (hai trần 1000 kèm chú thích), `fly.toml`, `render.yaml` (`PETGAME_TRUST_PROXY=1`).
- [x] Bước 10-11: `docs/deploy.md` (mục "Giới hạn số thế giới và proxy"), `docs/architecture.md`.
- [x] Test: `packages/server/src/worldLimits.test.ts` (unit + describe "creating worlds over HTTP", 29 test, chạy 3 lần đều qua), `connection.test.ts` (test mới), `joinStatus.test.ts` (`ALL` thêm hai loại + test mới), e2e `lobby: a refused new world says why...` (`--repeat-each=5 --retries=0`: 5/5 qua).
- Lệch kế hoạch (nhỏ):
  - Test e2e: trả lời giả 429 phải kèm `access-control-allow-origin` bằng đúng origin của trang và `access-control-allow-credentials: true` (SDK gửi credentials, `*` bị trình duyệt chặn bằng CORS). Plan ghi `*`.
  - Test e2e viết chuỗi lỗi trực tiếp (có chú thích nguồn) thay vì import `@petgame/shared`, vì spec chưa import shared.
  - Test unit "accepts the header as an array" và "drops empty entries" đưa `remote` vào (với `remote` undefined và trustProxy 1, công thức của plan coi mục cuối là proxy nên ra mục đầu).
- Lệnh đã chạy: typecheck ✓, test ✓ (443 test), build ✓, `npm run test:e2e` đầy đủ ✓ (48 test).
- Không commit; `.claude/settings.json` không đổi.

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (443, 33 file)   build ✓   e2e ✓ (48, 7,8 phút)   photo3d (không chạy, không đụng)
- Lặp lại: `worldLimits.test.ts` 3 lần, 29/29 mỗi lần; `GameRoom.test.ts` 2 lần, 131/131 mỗi lần (móc sổ đếm không làm hỏng gì); e2e `a refused new world says why` với `--repeat-each=10 --workers=1 --retries=0`: 10/10 qua. Không có test chập chờn. Output ở scratchpad.
- Tiêu chí hoàn thành: [x] hằng số + JSDoc  [x] 429 đúng loại trước khi tạo phòng  [x] đếm theo địa chỉ, đóng thì trả chỗ, tạo hỏng không giữ chỗ  [x] trần cả server gồm phòng không qua HTTP  [x] trust proxy 0/N, IPv6 /64  [x] chặn cài sau `listen()` (test "cannot be fooled" chứng minh)  [x] `joinById` không bị chặn, `join`/`joinOrCreate` 520  [x] `GameRoom` chỉ thêm `opened`/`closed`  [x] `/whoami`, cấu hình fly/render, deploy.md, log cảnh báo một lần  [x] env sai thì dùng mặc định + cảnh báo  [x] thẻ `busy`/`tooMany` (unit + e2e: focus, Enter)  [x] test 1-13 đủ, e2e mới, không test cũ bị nới  [x] `playwright.config.ts` env 1000 + chú thích  [x] docs cập nhật. Không phải thêm test nào.
- Kiểm tra đột biến (mỗi cái đã hoàn nguyên, so sánh với bản sao, cây làm việc không đổi):
  - a) bỏ ghi đè `x-real-ip` / tin header client: 2 test hỏng ("cannot be fooled...", "counts the last X-Forwarded-For entry...").
  - b) `closed()` không xoá: 12 test hỏng (gồm "gives the place back when a world closes", "frees both caps...").
  - c) chặn cả `joinById`: hỏng "never refuses joining a world that exists".
  - d) để `joinOrCreate` bật: hỏng "switches off join and joinOrCreate".
  - e) client ánh xạ 429 thành `failed` (hai biến thể): hỏng "tells the server's world cap from the address cap".
- Kiểm tra tay với server thật (`npx tsx packages/server/src/index.ts`, `PETGAME_DEBUG` không đặt, `PETGAME_DB=:memory:`):
  - `PETGAME_TRUST_PROXY` không đặt: 10 lần `POST /matchmake/create/world` từ localhost trả 200; lần 11 trả 429 `{"code":429,"error":"too many worlds from this address"}`. Lần 12 kèm `X-Forwarded-For: 9.9.9.9`, `X-Real-IP: 8.8.8.8`, `X-Client-IP: 7.7.7.7` vẫn 429 (không vượt được trần). `joinOrCreate` trả 520. `/whoami` trả `127.0.0.1`. Log: một dòng "refused 1 world creation ... 10 worlds open" (không có IP) và đúng một cảnh báo `X-Forwarded-For`.
  - `PETGAME_TRUST_PROXY=1`: mỗi `X-Forwarded-For` khác (không có, 203.0.113.1, 203.0.113.2) có trần 10 riêng (10 lần 200, lần 11 là 429); `/whoami` với `X-Forwarded-For: 1.2.3.4, 203.0.113.9` trả `203.0.113.9` (mục cuối).
  - Lần chạy tay đầu có nhầm: server cũ chưa tắt nên lượt "proxy1" gặp 429 ngay. Đó là lỗi cách chạy của tester, không phải lỗi sản phẩm; đã chạy lại riêng như trên.
- Test đã thêm: không (đủ theo PLAN).
