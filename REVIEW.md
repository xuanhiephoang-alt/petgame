PASS
# REVIEW: T12 Gom chữ hiển thị tiếng Việt về một chỗ (đợt 1), vòng 1

## Kết luận
Đợt 1 làm đúng và đủ PLAN.md: 36 mục `NOTICES` đúng khoá, đúng chữ, đúng `kind` như chỗ gọi ở `cb2ab56`; mọi `notify`/`announce` lấy câu từ bảng; `--compare cb2ab56` ra đúng "Sau đợt 1" (exit 0). Không đổi file test có sẵn, không đụng `labelLayout.*` hay e2e spec, `git stash list` còn đủ 2 mục. Reviewer tự chạy lại: `npm test` 36 file, 521 test xanh (có test ghim kind mới của tester), `npm run typecheck` sạch.

## Lỗi phải sửa (FAIL khi còn mục này)
Không có.

## Đã kiểm
- **Chỗ gọi so với BASE:** đọc từng dòng `git diff cb2ab56`. Đối số và thứ tự giữ nguyên: `FAINT_REST_MS / 1000`, `Math.ceil(left / 1000)`, `rewardText(...)`, `xpText` vẫn dựng ở `leaders.ts`, `palName(species.id, true)`, `ITEM_INFO.snacks.icon/name`, `parts.join("  ")`. `Boolean(wear)` cho kết quả giống `wear ? … : ""`, kể cả khi `wear` là chuỗi rỗng. `debug.ts` vẫn gửi `refused` như cũ.
- **`wild.ts`:** `news` đổi từ `""` sang `undefined`, điều kiện `xp > 0 || news` và `if (news)` giữ đúng nghĩa. Hẹn giờ vẫn tìm lại client theo sessionId.
- **Kiểu:**
  - `satisfies Record<string, NoticeMessage | ((...args: never[]) => NoticeMessage)>` là cách đúng để nhận mọi hàm mẫu.
  - Mục cố định có `kind` dạng literal readonly, gán vào `NoticeMessage` được.
  - `announce(notice: NoticeMessage & { kind: "news" })` chặn được khi biên dịch: mục cố định không phải `news` và hàm mẫu khai kiểu trả `NoticeMessage` đều không lọt qua. Chỉ hai hàm khai rõ `& { kind: "news" }` gọi được `announce`.
  - `refusal` nhận `string` bất kỳ, đúng như PLAN (bất biến nằm ở JSDoc và test `craftBlocker`).
- **Vòng import:** `notices.ts` chỉ import `MAX_PARTY` (`constants.ts` không import gì) và `import type` từ `messages.ts` (bị xoá khi chạy). `capture.ts` và `crafting.ts` import `notices.ts` theo một chiều, nên không có vòng.
- **`viStrings.mjs`:**
  - Đi theo AST; `node.text` là giá trị đã giải mã escape (`\xa0`).
  - Đã thử tay template lồng trong template, chuỗi lồng hai tầng, tagged template, khoá thuộc tính, kiểu literal: mỗi literal được đếm đúng một lần, không đếm trùng phần head/middle/tail.
  - Đọc ref cũ chỉ bằng `git ls-tree` và `git show`. Không tham số ra 274 chuỗi, 269 khác nhau (277 − 3 bản gộp).
  - `vitest.config.ts` đã có mẫu `scripts/**/*.test.mjs` từ T34 (cùng chỗ với `chromium.test.mjs`), nên test vào `npm test` mà không phải sửa cấu hình.
- **Test canh giữ:** danh sách `GUARDED` đúng Thiết kế 6. Đường dẫn sai hoặc file bị đổi tên thì `statSync` ném lỗi, nên test đỏ rõ ràng chứ không âm thầm xanh. Lọc `.test.ts` và `.d.ts` giống công cụ.
- **Hiệu năng client:** `CRAFT_SOUND_PREFIXES.some(...)` chạy mỗi tin `Notice`, không chạy mỗi khung hình.

## Góp ý không bắt buộc
- `docs/architecture.md:49` còn ghi chữ ký cũ `announce(text, except)`; nên là `announce(notice, except)`. Sửa một chữ, có thể gộp vào commit này hoặc làm ở T12b.
- **Thứ tự khoá trên dây:** mục `NOTICES` viết `{ kind, text }`, còn BASE dựng `{ text, kind }`. Mục Giao thức của PLAN nói "giống hệt từng byte", nên nói chặt thì msgpack mã hoá thứ tự khoá khác. Về nghĩa thì không khác: client giải mã ra object, không chỗ nào phụ thuộc thứ tự khoá (đã grep test và e2e). Không cần sửa; nếu muốn đúng nguyên văn PLAN thì đổi thành `{ text, kind }`.
- **`CRAFT_SOUND_PREFIXES`** vẫn là cách dò chữ, nhưng nay có test hai chiều: tiền tố khớp hai câu, và không mục nào khác bắt đầu bằng tiền tố đó. Đủ chắc cho bây giờ.
  - Giới hạn: test gọi hàm mẫu với tham số mẫu. Các mục mở đầu bằng `${…}` (`fed`, `palExhausted`, `palResting`, `tooCold`, `tooHot`) phụ thuộc tên loài và tên vùng trong dữ liệu. Hiện chưa tên nào bắt đầu bằng "Đã làm" hay "Trại đã lên cấp".
  - Khi làm đa ngôn ngữ, nên để client quyết định tiếng theo tín hiệu có cấu trúc (khoá câu hoặc cờ âm thanh trong tin) thay vì dò tiền tố chữ.
- **Mục `NOTICES` cố định là object dùng chung, gửi đi nguyên tham chiếu.** `as const` chỉ có tác dụng ở kiểu. Hiện không ai sửa chúng (msgpack chỉ đọc). Nếu muốn chắc khi chạy, có thể `Object.freeze`.
- **`GUARDED`** có thể mở rộng sau thành cả `packages/server/src` trừ `index.ts`: `ai/`, `persistence/`, `worldLimits.ts` hiện không có chuỗi tiếng Việt nào, nên canh luôn được.
- **`viStrings.test.mjs`** chưa có ca template lồng trong template, dù công cụ chạy đúng với ca đó (reviewer đã thử tay). Nên thêm một ca để giữ.
- **Test "craftBlocker … every branch"** gọi 6 trường hợp, chưa đi qua nhánh `wear` đã có và nhánh `recipe.camp`. Hai nhánh này ra cùng chữ với nhánh đã thử (`craftOwned`, `craftNeedCampLevel`), nên chưa sót chữ nào; có thể đổi tên test cho đúng hơn hoặc thêm hai ca.
