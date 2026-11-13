# PROGRESS: T67 Trần thế giới với IPv6

## Vòng 1: coder
- [x] Bước 1: `WORLD_LIMITS.perNetwork = 20` kèm JSDoc, thêm câu vào JSDoc của `WORLD_LIMIT_ERROR` (`packages/shared/src/constants.ts`). `WORLD_LIMIT_ERROR`, `WORLD_LIMIT_STATUS` không đổi, không sửa file client nào.
- [x] Bước 2-4: `packages/server/src/worldLimits.ts`: `WorldRefusal` thêm `"network"`, `WorldLimits.perNetwork`, `UNKNOWN_KEY`, hàm riêng `parseIp` (bỏ cổng, ngoặc, zone), `addressKey`/`networkKey` + `CreationKeys`/`creationKeys`, `WorldCensus` đếm hai khoá (`admit`/`settle` nhận `CreationKeys`, `release`), `worldLimitsFromEnv` đọc `PETGAME_MAX_WORLDS_PER_NETWORK`, `REFUSAL_ERROR` (chặn /48 trả chữ của `address`), `RefusalLog` thêm `network`, cảnh báo một lần "usable client address" (cờ trong closure của `guardWorldCreation`).
- [x] Bước 5: dòng log khởi động có `per IPv6 /48` (`packages/server/src/index.ts`).
- [x] Bước 6: `PETGAME_MAX_WORLDS_PER_NETWORK` = 1000 ở `scripts/dev.mjs` (giữ giá trị đã đặt), `scripts/shots.mjs`, `playwright.config.ts`, kèm lý do `::1`.
- [x] Bước 7-8: `docs/deploy.md`, `docs/architecture.md`.
- [x] Bước 9: test trong `packages/server/src/worldLimits.test.ts`: sửa chữ ký/câu log của test cũ (không nới kỳ vọng nào), thêm 14 test mới (addressKey 2, networkKey 2, creationKeys 1, RefusalLog 1, WorldCensus 3, default caps 1, env 1, HTTP 3).
- Lệch kế hoạch: `addressKey` và `networkKey` gọi `creationKeys` (nơi duy nhất dựng chuỗi khoá, gọi `parseIp`) thay vì mỗi hàm tự định dạng từ `parseIp`, để khỏi lặp code định dạng. Việc bóc tách địa chỉ vẫn chỉ nằm ở `parseIp`. Test "env" mới (test 10) tách thành một `it` riêng, test "accepts valid numbers" chỉ đổi kỳ vọng cho có `perNetwork`.
- Kiểm tay: server trần (`npx tsx packages/server/src/index.ts`, không env) trả 200 mười lần rồi 429 ở lần tạo thứ 11 từ 127.0.0.1, log "50 worlds, 10 per address, 20 per IPv6 /48" và dòng chặn có `network 0`. `npm run dev` log "50 worlds, 1000 per address, 1000 per IPv6 /48".
- Lệnh đã chạy: typecheck ✓, test ✓ (484 test, 33 file; `worldLimits.test.ts` 50 test, qua 3 lần liên tiếp), build ✓, `npm run test:e2e` ✓ (56 test)

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (484, 33 file)   build ✓   e2e ✓ (56)   photo3d (không chạy)
- `worldLimits.test.ts` chạy riêng 3 lần: 51 test, qua cả 3 (coder ghi 50; thực tế 51).
- Tiêu chí hoàn thành: [x] `WORLD_LIMITS.perNetwork = 20` + JSDoc, `WORLD_LIMIT_ERROR/STATUS` không đổi, không sửa client  [x] hai khoá /64 + /48 cho IPv6, IPv4 và `::ffff:` không có /48  [x] chạm /48 thì 429 chữ `address` (test 12 + tay)  [x] chuỗi không phải IP về `UNKNOWN_KEY`, bỏ cổng/ngoặc (test 1, 2, 13, 14)  [x] cảnh báo "usable client address" đúng một lần, không có địa chỉ  [x] env qua `intFromEnv`, giá trị sai cảnh báo  [x] `RefusalLog` đếm `network`, log khởi động có /48  [x] dev/shots/playwright nâng 1000 kèm lý do `::1`  [x] bóc tách chỉ ở `parseIp` (đã lệch nhẹ có chủ đích: `addressKey/networkKey` gọi `creationKeys`, không tự bóc tách)  [x] docs deploy/architecture đã cập nhật  [x] test cũ chỉ đổi chữ ký/câu log (đã so từng assertion: không nới), 14 test mới  [x] typecheck, test, e2e sạch
- Kiểm biến đổi (mỗi cái đều bị test bắt, đã trả file về nguyên trạng, hash trước/sau trùng):
  - a) bỏ kiểm khoá network trong `admit`: 2 test hỏng (unit "refuses a /48...", HTTP test 12)
  - b) không trả khoá network ở `settle`: hỏng "frees the /48 place..." và nhiều test HTTP (time out do `afterEach` không về 0)
  - c) không bỏ cổng IPv4: hỏng "drops a port and brackets..." và HTTP "counts an address with a port..."
  - d) chuỗi rác mỗi cái một khoá: 5 test hỏng (gồm test 1, 13)
  - e) IPv4 có khoá network: hỏng "has no /48 for IPv4..." và "creationKeys"
  - f) chặn /48 dùng chữ `server`: hỏng test HTTP 12
- Kiểm tay: server trần (không env) 10 lần 200 rồi 429 ở lần 11 từ 127.0.0.1, log "20 per IPv6 /48". Với `PETGAME_TRUST_PROXY=1`: 20 lần tạo từ 20 khối /64 khác nhau trong `2001:db8:1::/48` đều 200, lần 21 là 429 `too many worlds from this address`, `2001:db8:2:1::1` và `203.0.113.1` vẫn 200; log chặn "(server 0, address 0, network 1); 20 worlds open". Cả hai log không chứa địa chỉ nào (grep 0).
- Test đã thêm: không (14 test của coder đủ theo PLAN.md).
- Không có lỗi. Không flaky.

## Vòng 2: coder
Sửa lỗi chặn của reviewer: một lần tạo IPv6 bị đếm thành 2 thế giới trong `total()`.
- [x] `WorldCensus` (`packages/server/src/worldLimits.ts`): thêm bộ đếm riêng `pendingCreations` (mỗi lần tạo đếm một lần, `settle` kẹp ở 0 vì có test gọi `settle` hai lần sau một `admit`); `total()` = số phòng mở + `pendingCreations`. Bảng `pending` theo khoá chỉ còn dùng cho `countFor`. Sửa JSDoc của `pending`, `pendingCreations`, `total()`.
- [x] Test mới (`worldLimits.test.ts`): sau một `admit` IPv6 thì `total() === 1`, và IPv4 vẫn được nhận ở `maxWorlds: 2` khi một lần tạo IPv6 đang chờ; phòng đã `opened` nhưng chưa `settle` đếm 2 (không phải 3), sau `settle` còn 1. Test HTTP 12 kiểm thêm `roomCount` không đổi sau 429. Đã xác nhận hai test census mới FAIL khi `total()` trở lại cách cộng cũ, PASS với bản sửa.
- [x] Câu cảnh báo "usable client address" đổi thành "If this is not expected, check PETGAME_TRUST_PROXY (docs/deploy.md). Logged once per process."; `docs/deploy.md` sửa tương ứng (chỉ ghi một lần mỗi lần server chạy).
- [x] `docs/design/multiplayer.md`: thêm câu về dạng IPv6 hiếm có IPv4 nhúng (`::a.b.c.d`, `64:ff9b::/96`) rơi vào cùng một khối /48, cạnh ghi chú Teredo.
- Lệnh đã chạy: typecheck ✓, test ✓ (486 test, 33 file; `worldLimits.test.ts` 53 test, qua 3 lần liên tiếp), build ✓, `npm run test:e2e` ✓ (56 test)

## Kiểm thử vòng 2: PASS
- typecheck ✓   test ✓ (486, 33 file)   build ✓   e2e ✓ (56, có 1 chập chờn)   photo3d (không chạy)
- Chập chờn: lần chạy đầy đủ đầu tiên hỏng `multiplayer.spec.ts:2785 boss bar (phone upright, notch)` (`.hud-toasts > .toast:not(.out)` kỳ vọng 2, nhận 1, timeout 5 s: lỗi thời điểm của toast, không liên quan trần thế giới). Chạy lại riêng test đó qua ngay. 55 test còn lại qua.
- `worldLimits.test.ts` chạy riêng 3 lần: 53 test, qua cả 3.
- Kiểm biến đổi mới (đã trả file về nguyên trạng, hash trước/sau trùng):
  - a) `total()` cộng lại bảng `pending` theo khoá: 2 test hỏng ("counts one IPv6 creation once...", "counts an opened but not yet settled IPv6 world once")
  - b) `settle` không giảm `pendingCreations`: 4+ test hỏng
  - c) bỏ kẹp 0: bị bắt, 1 test hỏng ("does not give an already closed room to the address, nor go negative")
- Chạy lại a-f của vòng 1: cả 6 vẫn bị bắt (2, 2, 2, 5, 2, 1 test hỏng).
- Kiểm tay: `PETGAME_MAX_WORLDS=3 PETGAME_TRUST_PROXY=1`: 1 lần tạo từ IPv6, 2 từ IPv4 đều 200; lần 4 trả 429 `too many worlds on this server`; log "(server 1, address 0, network 0); 3 worlds open".
- Không có lỗi thật. Không thêm test.
