# PROGRESS: T12 Gom chữ hiển thị tiếng Việt về một chỗ (đợt 1)

## Vòng 1: coder

BASE `cb2ab56`. Không đổi chữ nào; không file test có sẵn nào bị sửa; không đụng `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`; không dùng `git stash`.

- [x] Bước 1: `scripts/viStrings.mjs` (không tham số, `--list`, `--compare <ref>`, export `viLiterals` và `VI_LETTER`) và `scripts/viStrings.test.mjs` (test `viLiterals`: chuỗi thường, template `${}`, chuỗi lồng, ASCII/emoji, chú thích, `×`; test canh giữ `GUARDED`). Chạy ở BASE-tương-đương: 277 chuỗi, 269 khác nhau, đúng bảng mốc đo; `--compare cb2ab56` rỗng, mã 0.
- [x] Bước 2: `packages/shared/src/notices.ts` (`NOTICES` 36 mục đúng khoá và `kind` của PLAN, `refusal`, `CRAFT_SOUND_PREFIXES`), export trong `packages/shared/src/index.ts`. `capture.ts`: `PARTY_FULL_TEXT = NOTICES.partyFull.text`, `throwBlocker` dùng `NOTICES.bossUncatchable.text`. `crafting.ts`: `craftBlocker` dùng `NOTICES.*.text`. Test mới `packages/shared/src/notices.test.ts`.
- [x] Bước 3: `GameRoom.notify(client, notice)` và `announce(notice: NoticeMessage & { kind: "news" }, except?)`; đổi mọi chỗ gọi ở `systems/camp.ts`, `combat.ts`, `leaders.ts`, `party.ts`, `skills.ts`, `wild.ts` (`news` là `NoticeMessage | undefined`), `world.ts`, `debug.ts`, và `GameRoom.ts` (`workedWhileAway`). Chữ từ `throwBlocker`/`craftBlocker` đi qua `refusal(blocker)`. Bỏ import `NoticeKind` khỏi `GameRoom.ts`.
- [x] Bước 4: `packages/client/src/game/serverEvents.ts`: `CRAFT_SOUND_PREFIXES.some((p) => msg.text.startsWith(p))`.
- [x] Bước 5: `GUARDED` có `GameRoom.ts`, `systems/`, `capture.ts`. `--list` trên `shared/src/crafting.ts` chỉ còn 3 tên `ITEM_INFO` ("Bóng xịn", "Bánh quả mọng", "Bè gỗ").
- [x] Bước 6: `docs/architecture.md` (dòng `notices.ts`, bullet `GameRoom.ts`, mục Kiểm thử).

Kết quả `node scripts/viStrings.mjs --compare cb2ab56` (mã thoát 0), đúng "Sau đợt 1":

```
(a) only in cb2ab56: 0
(b) only in working tree: 0
(c) different count: 3
  "Đã làm ${} ${}" 2 -> 1
  "Cần trại cấp ${}" 2 -> 1
  "Đã có rồi" 2 -> 1
```

- Lệch kế hoạch: không có. Chi tiết nhỏ: `notices.test.ts` dựng trạng thái `craftBlocker` bằng các công thức thật (`raft`, nâng trại cấp 3) cho 6 nhánh từ chối, thay vì chỉ liệt kê.
- `git diff --stat cb2ab56 -- '*.test.ts' '*.test.mjs' tests/`: rỗng (chỉ có file mới chưa theo dõi: `notices.test.ts`, `viStrings.test.mjs`).
- Đề xuất chữ: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (520 test, 36 file, gồm `notices.test.ts` và `viStrings.test.mjs` với `GUARDED` đầy đủ), build ✓ (chunk chính 703 kB), test:e2e ✓ (56 passed, cổng 2567 và 5173 trống lúc chạy).

## Kiểm thử vòng 1: PASS
- typecheck ✓   test ✓ (520 trước khi thêm test; thêm 1 test kind)   build ✓   e2e ✓ (56)   photo3d (không chạy)
- Tiêu chí hoàn thành (đợt 1, T12): [x] `viStrings --compare cb2ab56` in đúng "Sau đợt 1" (a) rỗng, (b) rỗng, (c) 3 dòng (`Đã làm ${} ${}`, `Cần trại cấp ${}`, `Đã có rồi`), exit 0  [x] chữ không đổi  [x] kind không đổi  [x] test cũ không đổi  [x] test canh giữ
- Chữ: đối chiếu độc lập bằng script tsx (mọi đoạn cố định của 36 mục NOTICES đều có trong mã nguồn cb2ab56; chỉ `partyFull` không khớp vì nguồn cũ là template `${MAX_PARTY}`, đúng như cũ) và đọc `git diff cb2ab56`: mọi template giữ thứ tự ô và giá trị (palName, `FAINT_REST_MS / 1000`, `Math.ceil(left / 1000)`, `Boolean(wear)`, `xpText`).
- Kind: 36 mục đối chiếu từng chỗ gọi ở cb2ab56, không đổi (news chỉ cho `announce`).
- Test cũ: `git diff --exit-code cb2ab56 --` trên mọi `*.test.ts`, `*.test.mjs`, `tests/`: không đổi.
- Đột biến (đã hoàn nguyên, kiểm bằng git diff/grep):
  - a) đổi "Máu đang đầy" -> "đủ": GameRoom.test.ts "eating: ... no berries and full health" và "pack leaders > every notice says what it is about" bắt.
  - b) đổi kind `hpFull`: GameRoom.test.ts "every notice says what it is about" bắt. Nhưng đổi kind `campPlaced` hoặc `faintedAtCamp`: KHÔNG test cũ nào bắt (test cũ chỉ ghim kind của khoảng 8 câu; chữ của 2 câu này cũng không test nào kiểm). Đã thêm test mới (bên dưới), giờ bắt.
  - c) đặt lại literal tiếng Việt vào `systems/camp.ts`: `scripts/viStrings.test.mjs` "guarded files > hold no Vietnamese string literals" bắt, kèm câu "move it to ...".
  - d) sửa `CRAFT_SOUND_PREFIXES` ("Đã lam"): notices.test.ts "match the crafted and camp level sentences" bắt.
- Test đã thêm: `packages/shared/src/notices.test.ts` > "keeps the kind of every entry..." (ghim kind của cả 36 mục theo chỗ gọi cũ).
- Chập chờn: không.
