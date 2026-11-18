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

## Vòng 2 (T12b): coder

BASE vẫn `cb2ab56`. Không đổi chữ nào; không file test có sẵn nào bị sửa (chỉ thêm `packages/client/src/ui/strings.test.ts`, và mở rộng `GUARDED` trong `scripts/viStrings.test.mjs` của T12); không đụng `labelLayout.ts`, `labelLayout.test.ts`, `tests/e2e/multiplayer.spec.ts`; không dùng `git stash` (`git stash list` vẫn 2 mục).

- [x] Bước 1: `packages/client/src/ui/strings.ts` (JSDoc đầu file; `COMMON_TEXT`, `LOBBY_TEXT`, `JOIN_TEXT`, `CONNECTION_TEXT`). Sửa `main.ts`, `ui/joinStatus.ts` (`RETURN_HINT`, `INVITE_HINT` vẫn export, `startCard` dùng `...JOIN_TEXT[failure]`), `ui/connection.ts`.
- [x] Bước 2: `HUD_TEXT`, `PARTY_TEXT` (gồm `elements`, `releaseDone: "✓ Xong"`), `SKILLBAR_TEXT`, `WARDROBE_TEXT`, `CRAFTING_TEXT`, `QUEST_TEXT`, `MINIMAP_TEXT`. Sửa `ui/hud.ts`, `party.ts`, `skillbar.ts`, `wardrobe.ts`, `crafting.ts`, `quests.ts`, `minimap.ts`. 8 chuỗi có markup HTML chuyển nguyên văn.
- [x] Bước 3: `GAME_TEXT`. Sửa `game/Game.ts`, `controls.ts`, `hudBridge.ts` (cảnh báo lãnh địa qua `palName(p.speciesId, true)`, thêm import `palName`, vẫn dùng `getSpecies` ở chỗ khác), `serverEvents.ts`, `stateSync.ts`.
- [x] Bước 4: `packages/client/src/ui/strings.test.ts` (chữ mong đợi viết literal; chỉ import `@petgame/shared` và `strings.ts`, không DOM). `GUARDED` thêm `client/src/game`, `client/src/ui` (trừ `strings.ts`), `client/src/net`, `client/src/main.ts`. `--list` ngoài `strings.ts`, `gallery.ts` không còn chuỗi nào ở client.
- [x] Bước 5: `docs/architecture.md`: bullet `ui/` có `strings.ts`, câu mở đầu mục packages/client, dòng test canh giữ; theo review vòng 1, `announce(text, except)` thành `announce(notice, except)` (dòng 49).

`node scripts/viStrings.mjs --compare cb2ab56` (mã thoát 1, chỉ vì cặp cảnh báo lãnh địa), đúng "Sau đợt 2":

```
(a) only in cb2ab56: 1
  "★ Lãnh địa của ${} đầu đàn (Lv ${}): nó tấn công ai lại gần!"
(b) only in working tree: 1
  "★ Lãnh địa của ${} (Lv ${}): nó tấn công ai lại gần!"
(c) different count: 6
  "Vào chơi" 2 -> 1
  "Đóng" 3 -> 1
  "Thả" 2 -> 1
  "Đã làm ${} ${}" 2 -> 1
  "Cần trại cấp ${}" 2 -> 1
  "Đã có rồi" 2 -> 1
```

- Lệch kế hoạch: không có. Nhận xét nhỏ: `JOIN_TEXT` thêm mục `download` và `broken` ngang hàng với các lỗi vào phòng để `startCard` spread được; `PARTY_TEXT.confirmTitle` giữ ` ` dạng escape như BASE; `WARDROBE_TEXT.from` được `wardrobe.ts` giữ làm `FROM`.
- Đề xuất chữ: không có.
- Lệnh đã chạy: typecheck ✓, test ✓ (526 test, 37 file), build ✓ (chunk chính 703 -> 707 kB), test:e2e ✓ (56 passed, cổng 2567 và 5173 trống).

## Kiểm thử vòng 1 (T12b): PASS
- typecheck ✓   test ✓ (526, 37 file)   build ✓   e2e ✓ (56)   photo3d (không chạy)
- Tiêu chí hoàn thành: [x] `viStrings --compare cb2ab56` đúng "Sau đợt 2": (a) 1 dòng lãnh địa cũ, (b) 1 dòng lãnh địa mới, (c) 6 dòng (Vào chơi 2->1, Đóng 3->1, Thả 2->1, Đã làm 2->1, Cần trại cấp 2->1, Đã có rồi 2->1), exit 1 chỉ vì cặp (a)/(b)  [x] chữ không đổi  [x] test cũ không đổi  [x] sảnh không nặng thêm
- Chữ: script tsx so 169 đoạn cố định của mọi giá trị trong `strings.ts` với mã nguồn client ở cb2ab56: 164 khớp, 5 "thiếu" chỉ vì có hằng số hoặc điều kiện nội suy trong nguồn cũ (`eatTitle` BERRY_HEAL/EAT_COOLDOWN_MS, `JOIN_TEXT.full.title`, `tooMany.detail`, `statusLines` MAX_PLAYERS, `caught` tiền tố "★ " điều kiện); đã đọc tay cả 5 so với diff: giống. 8 chuỗi HTML (eatButton, inviteButton, 2 header, allDone, hintAndReward, statusLines, inviteLine) khớp từng byte. Mọi template giữ thứ tự ô và giá trị truyền (xem `git diff` các file ui, game).
- Cảnh báo lãnh địa: với cả 13 loài (`PAL_SPECIES`), câu cũ `${getSpecies().name} đầu đàn` và mới `lairWarning(palName(id, true), lv)` giống hệt, 0 khác biệt.
- Test cũ: `git diff --exit-code cb2ab56 --` trên mọi `*.test.ts`, `*.test.mjs`, `tests/`: không đổi. (Lưu ý `scripts/viStrings.test.mjs` của T12 được mở rộng, là file thêm ở vòng trước.)
- Sảnh: `main.ts` và `Game` cùng nằm trong một chunk vào (không tách chunk sảnh; không có `import()` động). Chunk `index`: cb2ab56 703.29 kB (gzip 224.27) -> nay 706.61 kB (gzip 225.17), +3.3 kB. `strings.ts` chỉ import hằng số từ `@petgame/shared` (đã có sẵn trong bundle), không kéo thêm module nặng. Các chunk pixi không đổi.
- Đột biến (đã hoàn nguyên, `cmp` với bản sao):
  - a) Đổi chữ trong `strings.ts`: "Đang đi theo bạn." -> "ban." bị e2e "party: let a pal go after confirming; a full party cannot throw" bắt (không test đơn vị nào bắt). Đổi `MINIMAP_TEXT.title` ("phóng to" -> "phóng") và `GAME_TEXT.dodge` ("Né!" -> "Né."): KHÔNG test nào bắt (unit lẫn e2e không kiểm hai chữ này). Chữ client chỉ được bảo vệ ở chỗ test cũ so chữ literal; `--compare` là bằng chứng chính.
  - b) Literal tiếng Việt trong `ui/hud.ts:77`: `scripts/viStrings.test.mjs` "hold no Vietnamese string literals" bắt, in `hud.ts:77 "Bật/tắt âm thanh (phím M)"`.
- Chập chờn: không.
