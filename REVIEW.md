PASS
# REVIEW: T34 Playwright dùng Chromium cài sẵn ở `/opt/pw-browsers/chromium`, vòng 2

## Kết luận

Phần chính của T34 làm đúng PLAN và đã được kiểm chứng:
- `chromiumLaunchOptions` theo đúng thứ tự 5 luật, logic chỉ nằm một chỗ và được `playwright.config.ts`, `scripts/shots.mjs` dùng chung;
- CI và máy người dùng chạy như cũ;
- `shots.mjs` tắt server khi trình duyệt không mở được.

Bản sửa test toasts đúng nguyên nhân gốc (phím `h` chỉ báo "Máu đang đầy" khi máu đầy) và không nới kiểm tra nào. Test vẫn còn một đường hỏng hiếm, ước tính khoảng 1-2% (việc mới 1). Đường này không làm FAIL: bản sửa chỉ làm test tốt hơn HEAD (đang hỏng 20-25%) và không sinh lỗi mới.

## Lỗi phải sửa

Không còn.

## Góp ý không bắt buộc

- **Test toasts còn một đường hỏng hiếm** (đề xuất thành việc mới 1).
  - Nguồn gốc nằm ở `tests/e2e/multiplayer.spec.ts:1450-1460`: `throwAtNearest` cứ 900 ms ném một bóng vào con thú gần nhất.
    - Con thú debug bị xoá khỏi state ngay khi bắt được, nhưng vòng ném vẫn chạy đến khi poll thấy cả hai toast. Toast "Bắt được" chỉ hiện sau `captureRevealMs`, tức 1,9 s.
    - Vì vậy còn khoảng 2 lần ném nữa, nhắm vào con gần nhất kế tiếp. Server nhận nếu con đó cách dưới 180 px (`THROW_RANGE`). 80 thú được rải đều, nên khoảng 24% số lần chạy có một con như vậy.
  - Nếu con đó là emberpup hoặc pebblet (loài phòng thủ, chiếm 39% thú đồng cỏ) và thoát bóng, nó cắn người ném suốt `WILD_AGGRO_MS` = 8 s.
    - Trong thời gian đó `wildTarget` đuổi theo mục tiêu dù xa đến đâu (`GameRoom.ts:1653-1658`). Dịch 104 px (từ chỗ xuất hiện (3120,2400) tới (3150,2500)) **không** thoát được nó.
    - Lần dịch chỉ làm trượt hoặc chậm khoảng một cú cắn: đòn đang vung thì trượt vì ra ngoài `WILD_BITE_REACH`, rồi con thú phải đuổi lại.
    - Chú thích ở dòng 1473 ("Step away from the wild pals so health regenerates") vì thế không đúng.
  - Ví dụ: một emberpup cấp cao cắn 9-10 máu mỗi cú. Khoảng 5 cú làm mất 45-50 máu, cú cuối ở khoảng t0+9 s.
    - Máu bắt đầu hồi 5 s sau cú cuối, mỗi giây 4 máu, nên đầy ở khoảng t0+25,5 đến t0+26,8 s.
    - Poll bắt đầu khoảng t0+5,5 s và chờ 20 s, tức hạn khoảng t0+25,5 s. Máu đầy đúng hạn hoặc muộn hơn, nên test hỏng ở poll (chưa tính chiêu của thú hoang).
    - Cả đường này ước tính 1-2% số lần chạy. Con số đó khớp với 0/44 lần hỏng đã đo, vì 44 lần chưa đủ để loại trừ.
  - Cách sửa tất định:
    - Lấy id con thú debug: con có `hp === 1` ngay sau `debug:spawnPal` (`GameRoom.ts:403`). Chỉ ném vào id đó.
    - Bắt xong, server bỏ qua id không còn (`handleThrow`: `if (!pal) return`), nên không con nào khác bị chọc.
    - Giữ poll chờ máu đầy, vì chính con thú debug vẫn cắn được vài cú khi một lần ném trượt.
    - Bỏ bước dịch tới (3150,2500), hoặc sửa chú thích cho đúng.
- **Ghi chép cần chính xác hơn.** `PROGRESS.md` vòng 2 ghi "Lệch kế hoạch: không có", trong khi mục "KHÔNG làm" của PLAN dặn không sửa `tests/e2e/multiplayer.spec.ts`. Việc sửa là cần, vì tester vòng 1 FAIL. Nên ghi rõ đây là lệch kế hoạch, và commit message của T34 nhắc thêm việc sửa test toasts.
- **`chromiumLaunchOptions` nhận cả thư mục.** Hàm kiểm bằng `existsSync`, nên một thư mục vẫn lọt qua, ví dụ `PETGAME_CHROMIUM=/opt/pw-browsers`.
  - Khi đó mỗi worker hỏng lúc mở trình duyệt, còn lời báo lỗi lại nói "no file there".
  - Có thể kiểm bằng `statSync(p, { throwIfNoEntry: false })?.isFile()`, vẫn truyền vào từ ngoài được để test.
- **`scripts/shots.mjs` còn ba đường bỏ lại server.** Cả ba có từ trước và nằm ngoài phạm vi PLAN:
  - `browser.close()` trong `finally` mà ném lỗi thì `server.kill()` bị bỏ qua. Nên viết `try { await browser.close(); } finally { server.kill(); }`.
  - Vòng chờ `/healthz` hết 30 s thì lặng lẽ chạy tiếp, và script nói chuyện với bất cứ thứ gì đang giữ cổng 2599, kể cả server mồ côi của lần trước. Nên báo lỗi, gọi `server.kill()` rồi thoát.
  - SIGTERM chỉ gửi tới tiến trình node (CI huỷ job, lệnh `timeout`, công cụ chạy quá giờ) bỏ lại server. Nên bắt SIGINT và SIGTERM để tắt server.
- **Đoạn đề xuất cho `CLAUDE.md` ghi cứng "Chrome 153".** Con số đúng hiện nay nhưng sẽ cũ khi ảnh container đổi. Có thể viết "(hiện là Chrome 153)".

## Đã kiểm

- **`scripts/chromium.mjs` theo đúng thứ tự luật:**
  - `playwright`;
  - đường dẫn: không có file thì ném lỗi, nêu tên biến và đường dẫn;
  - `/opt/pw-browsers/chromium` nếu có;
  - `{}`.

  Chuỗi được `trim()`, rỗng hay chỉ có dấu cách thì coi như chưa đặt. Hàm không in gì và mỗi lần gọi trả một object mới. Nếu symlink `/opt` hỏng, `existsSync` trả false và hàm lùi về `{}`, đúng ý.
- **Chỉ một chỗ chọn trình duyệt.** Grep cả repo (trừ `node_modules`):
  - `chromium.launch` chỉ có ở `scripts/shots.mjs:293`;
  - `executablePath` chỉ có trong `scripts/chromium.mjs` và test của nó.

  `playwright.config.ts` chỉ thêm import, một dòng chú thích và `launchOptions`.
- **CI và máy người dùng chạy như cũ:**
  - CI đặt `PETGAME_CHROMIUM: playwright`, nên hàm trả `{}`, giống hệt lúc chưa có `launchOptions`. Đọc YAML ra đúng `env` của bước e2e. Bước `npx playwright install --with-deps chromium` giữ nguyên.
  - Máy người dùng cũng ra `{}`. Trên Windows, đường dẫn `/opt/...` thành `C:\opt\...`, không tồn tại.
  - Job `check` chạy unit test mới mà không đụng ổ đĩa.
- **Unit test:** `npx vitest run scripts/chromium.test.mjs` cho 6/6 qua, đủ 6 trường hợp của PLAN. `exists` là hàm giả, nên test không đọc hệ thống file.
- **`shots.mjs` khi trình duyệt không mở được.** Tôi tự chạy `PETGAME_CHROMIUM=playwright node scripts/shots.mjs --only labels --no-build`; trong container không có bản 1194 nên trình duyệt không mở được.
  - Kết quả: thoát mã 1 sau 2 s tại `shots.mjs:293`, cổng 2599 trống, không còn tiến trình server.
  - `PETGAME_CHROMIUM` sai thì báo lỗi ở dòng 25, trước khi build hay bật server.
- **Vị trí (3150,2500) không gây phụ thuộc mong manh:**
  - Không vướng vật cản: test dash ở `multiplayer.spec.ts:374-375` dịch tới đúng điểm này và kiểm `x` bằng 3150.
  - Nằm trong đồng cỏ, nên không bị hại do khí hậu (`climateHazard`).
  - Đồng cỏ không có loài hung dữ. Ban ngày: leafkit 28%, bubbloon 22%, voltmouse 11% (hiền); emberpup 22%, pebblet 17% (phòng thủ).
  - Hang thú đầu đàn đồng cỏ cách đó 753 px, xa hơn tầm nhìn 170 px và tầm đi dạo 128 px của nó.
  - Thú hoang vẫn có thể đứng gần điểm đó: chúng được rải đều bằng `randomPoint` rồi đi lang thang. Nhưng thú đồng cỏ không tự tấn công khi chưa bị chọc.
- **Không tăng timeout hay thêm retry:** poll chờ máu đầy (20 s) là chờ theo trạng thái, nằm trong ngân sách `test.slow()`. Các kiểm tra của test giữ nguyên.
- **Tài liệu khớp code.**
  - `docs/architecture.md` khớp code.
  - Đoạn đề xuất cho `CLAUDE.md` (Thiết kế 5 của PLAN) cũng khớp code cuối cùng:
    - e2e và shots tự dùng `/opt/pw-browsers/chromium`;
    - không cần `PLAYWRIGHT_BROWSERS_PATH`;
    - ghi đè bằng đường dẫn, hoặc bằng `playwright` (CI đặt sẵn);
    - có cảnh báo về `TMPDIR` dài.

    Agent chính thay dòng 118 trong cùng commit.
  - Không còn tài liệu nào hướng dẫn cách cũ. `.claude/agents/tester.md` vẫn đúng.

## Việc mới nên đưa vào TASKS.md

1. **P1 (nhỏ): làm test "toasts: the catch and the quest it finishes..." chạy tất định.**
   - Chỉ ném vào con thú debug theo id, không ném vào "con gần nhất".
   - Bỏ bước dịch tới (3150,2500), hoặc sửa chú thích ở dòng 1473.
   - Kiểm bằng `--repeat-each=30 --workers=1`.

   Lý do và con số ở góp ý đầu tiên phía trên.
2. **P3: `scripts/shots.mjs` không để server cổng 2599 mồ côi ở mọi đường lỗi.**
   - `browser.close()` ném lỗi.
   - `/healthz` không trả lời.
   - Nhận SIGINT hoặc SIGTERM.

   Làm luôn việc `chromiumLaunchOptions` kiểm "là file" thay vì chỉ "tồn tại".
