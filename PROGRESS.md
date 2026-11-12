# PROGRESS: T66 shots/dev chạm trần thế giới; làm chắc worldLimits

## Vòng 1: coder
- [x] Bước 1: `scripts/dev.mjs` truyền `PETGAME_MAX_WORLDS_PER_ADDRESS` (mặc định `"1000"`, giữ giá trị đã đặt, dùng `??`) chỉ cho tiến trình server; client nhận `process.env`.
- [x] Bước 2: `scripts/shots.mjs` thêm `PETGAME_MAX_WORLDS_PER_ADDRESS: "1000"` vào `env` của server, kèm chú thích.
- [x] Bước 3: `clientAddress` trả `undefined` khi không có `remote`, không đọc header (`packages/server/src/worldLimits.ts`).
- [x] Bước 4: thêm `stampClientAddress` (luôn ghi `x-real-ip`, `"unknown"` khi thiếu địa chỉ); `stamp` gọi hàm này.
- [x] Bước 5: `addressKey` bóc IPv4 lồng IPv6 qua `ipv6Groups` (dạng chấm, hex, chữ hoa, đủ 8 nhóm); không bóc `::a:b` hay tiền tố khác 0.
- [x] Bước 6: `REFUSAL_LOG_MS`, class `RefusalLog` (thuần, nhận `now`), `noteRefusal` dùng nó; bỏ `refusedSince`/`refusedLogAt`/`refusedCounts`.
- [x] Bước 7: `positiveInt` đổi thành `intFromEnv`, JSDoc mới.
- [x] Bước 8: `guardWorldCreation` kiểm `matchMaker.controller` trước `prependListener`, ném lỗi có chữ `invokeMethod() and exposedMethods`; thêm câu vào JSDoc. Không cần ép kiểu rộng: `tsc` không phàn nàn.
- [x] Bước 9: `worldLimits.test.ts`: sửa test "clamps…" (đúng chỗ plan nêu), thêm test `clientAddress` không socket, `stampClientAddress` (2), `addressKey` hex, `RefusalLog` (3), test từ chối cài trên matchmaker lạ.
- [x] Bước 10: tài liệu `docs/architecture.md` (hai chỗ), `docs/deploy.md`, `docs/design/multiplayer.md`.
- Lệch kế hoạch: tiêu chí "`grep -rn "in the last minute" packages` rỗng" không đạt nguyên văn, vì test "counts refusals within a minute…" (theo plan) có `expect(line).not.toContain("in the last minute")`. Không còn trong code sản phẩm. Ngoài ra `docs/deploy.md` ghi thêm rằng `npm run dev:server` giữ trần thật (plan chỉ ghi ở architecture.md).
- Không đổi: `package.json`, `Dockerfile`, `fly.toml`, `render.yaml`, `playwright.config.ts`, `WORLD_LIMITS`, `index.ts`.
- Kiểm tay: `timeout 25 npm run dev` log `World limits: 50 worlds, 1000 per address; trusting 0 proxies`; với `PETGAME_MAX_WORLDS_PER_ADDRESS=2` log `2 per address`. `npm run shots -- --name t66 --no-build` chạy xong (32 ảnh), không lỗi 429.
- Lệnh đã chạy: typecheck ✓, test ✓ (451 test, 33 file; `worldLimits.test.ts` chạy riêng 3 lần, 37 test mỗi lần, đều qua), build ✓, test:e2e ✓ (48 test).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (451, 33 file; `worldLimits.test.ts` chạy riêng 3 lần, 37 test mỗi lần, đều qua)   build ✓   e2e ✓ (48)   photo3d (không chạy, không đụng)
- Tiêu chí hoàn thành: [x] dev.mjs (chỉ server, `??`) [x] shots.mjs [x] package.json/Dockerfile/fly.toml/render.yaml/playwright.config.ts/`WORLD_LIMITS` không đổi (`git diff --stat` chỉ 8 file: PROGRESS, 3 doc, worldLimits.ts + test, 2 script) [x] `clientAddress` không socket thì `undefined` [x] không còn `delete x-real-ip`, thiếu địa chỉ ghi `"unknown"` [x] `addressKey` bóc hex/chấm, không bóc nhầm [x] câu log khớp từng ký tự (test) [x] `positiveInt` hết, `intFromEnv` có JSDoc [x] kiểm controller ném lỗi, không cài gì trước khi ném (test) [x] test mới đủ, test cũ chỉ sửa dòng "clamps" [x] tài liệu [x] chú thích tiếng Anh
- Ghi chú: `grep "in the last minute" packages` còn đúng 1 dòng ở `worldLimits.test.ts:101` (`not.toContain`), không phải code sản phẩm; chấp nhận như coder đã ghi.
- Kiểm biến đổi (đã hoàn nguyên, `cmp` với bản gốc giống hệt, diff worldLimits.ts vẫn 107 dòng): a) stamp lại `delete` -> 1 test hỏng; b) `clientAddress` dùng header khi thiếu socket -> 2 test hỏng; c) `addressKey` không bóc dạng hex -> 1 test hỏng; d) bỏ kiểm controller -> 1 test hỏng; e) `RefusalLog` ghi "60 s" cố định -> 2 test hỏng. Cả 5 đều bị bắt.
- Kiểm tay: `npm run dev` log `1000 per address`; với `PETGAME_MAX_WORLDS_PER_ADDRESS=2` log `2 per address`; `npm run shots -- --only world --name t66b` xong (15 ảnh), không 429; server chạy thẳng `npx tsx packages/server/src/index.ts` (không env): 10 lần create đầu 200, lần 11 là 429, log `10 per address` và dòng "refused 1 world creation (server 0, address 1); 10 worlds open".
- Test đã thêm: không thêm (bộ test của coder đủ và bắt được cả 5 biến đổi).
