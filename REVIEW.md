PASS
# REVIEW: T36 Test e2e toasts tất định (chỉ ném vào con thú debug), vòng 1

## Kết luận

Bản sửa làm đúng từng bước của PLAN và chặn đúng các nguyên nhân gốc:
- vòng ném chỉ nhắm id của con thú debug, nhận theo "id mới và `hp === 1`", poll đến khi có đúng một con;
- chỉ gửi tin ném khi id còn trong state, nên bắt xong thì không ném nữa;
- ghim loài Emberpup để đóng đường 3 (thú hiền chạy khỏi tầm);
- bỏ bước dịch và câu chú thích sai;
- thêm kiểm túi bằng `["emberpup"]`.

Nhịp ném, các timeout 15/20/20 s và mọi kiểm tra cũ giữ nguyên, không có retry. Chỉ `tests/e2e/multiplayer.spec.ts` đổi (cùng `PROGRESS.md`), không đụng `packages/`.

## Lỗi phải sửa (FAIL khi còn mục này)

Không có.

## Đã kiểm

- **Nhận id chắc chắn, không phụ thuộc thứ tự sinh hay số id.**
  - Mọi đường sinh thú đều đặt máu bằng `maxHp`: `spawnPal`, `spawnBoss`, `spawnAlpha` (`GameRoom.ts:2128`, `1578`, `1595`). `maxHp` nhỏ nhất là 35 (Voltmouse).
  - Máu thú hoang chỉ xuống 1 theo hai đường: hook debug, hoặc `hitWild` (đòn của người chơi, đòn hay chiêu của thú đi theo).
  - Chiêu của thú hoang chỉ trúng người chơi và thú đi theo (`GameRoom.ts:1482-1489`).
  - Trước khi bắt, người chơi chưa có thú đi theo và không đánh. Vì vậy con "id mới, máu 1" là duy nhất.
  - Phép lọc dùng hiệu tập hợp với `before`, nên con thú cũ nào ở máu 1 cũng bị loại. Nếu có hai con khớp, poll hỏng rõ ràng chứ không chọn bừa.
- **Không còn tin ném sau khi bắt.**
  - Server xoá thú ngay khi bắt (`GameRoom.ts:920`).
  - Patch xoá chưa tới client mà đã lỡ gửi một tin ném: server bỏ ở `GameRoom.ts:890`, trước khi chạm cooldown.
  - Id `pal${nextPalId++}` không bao giờ dùng lại.
- **Emberpup luôn trong tầm ném.**
  - Khi bóng trượt: `breakOut` gọi `provoke`, thú vào `wildAggro` 8 s, và `wildTarget` trả vị trí người chơi mà không xét khoảng cách. Nó lao tới cắn trong 50 px, luôn cách dưới 180 px.
  - Thú hoang ở đây cấp 1-6 (`wildMaxLevel` = 6 khi độ nguy hiểm bằng 0), nên chỉ biết Tàn lửa (`SKILL_LEVELS` [1, 7, 15]).
  - Server không có sát thương theo thời gian. Ngân sách máu ở PLAN mục d đúng.
- **Chú thích mới đúng.**
  - `REGEN_DELAY_MS` 5000 và `REGEN_PER_SECOND` 4 (`combat.ts:26-27`, `tickRegen`).
  - `eat()` không báo gì khi máu chưa đầy (`GameRoom.ts:1118-1126`).
  - Thú hiền chạy trốn thay vì đánh lại (`provoke`, nhánh `passive`).
- **Bỏ bước dịch là an toàn.**
  - Mỗi lần vào sảnh, client tạo phòng mới (`client.create`, `connection.ts:25`), nên phòng bắt đầu lúc ban ngày.
  - Đồng cỏ ban ngày chỉ có leafkit, emberpup, bubbloon, pebblet, voltmouse; không loài nào hung dữ.
  - Người chơi đứng đúng chỗ đã đứng suốt pha bắt.
  - Các phím `r`, `3`, `h` không phụ thuộc vị trí.
- **Không trùng helper.** Test dùng lại `sendFrom`, `partyOf`, `shownToasts`. Chưa có helper "spawn rồi lấy id": mẫu ở dòng 748-760 viết inline, và PLAN chủ động hoãn tách helper (xem việc mới 1).
- **Reviewer đã chạy:**
  - `npm test`: 25 file, 288/288 qua.
  - Kiểm kiểu riêng file spec với `tsconfig.base.json` (strict, `noUnusedLocals`, `noUnusedParameters`): sạch.

## Góp ý không bắt buộc

- `multiplayer.spec.ts:1451`: chú thích dài khoảng 330 ký tự trên một dòng, nên chia 2-3 dòng. "the only pal at 1 HP" nên thành "the only new pal at 1 HP" cho khớp điều kiện lọc.
- `multiplayer.spec.ts:1449` chép y hệt dòng 748. Chấp nhận được vì PLAN hoãn tách helper; làm ở việc mới 1.
- Quy trình: PLAN (mục Test, bước 3) yêu cầu chạy `npm test`, nhưng cả coder và tester đều không chạy (PROGRESS ghi "test (không chạy)"). Lần sau tester nên chạy đủ các lệnh PLAN nêu. Lần này reviewer đã chạy và qua.

## Việc mới nên đưa vào TASKS.md

1. **(P3) Hai test e2e còn nhắm "con gần nhất".**
   - **Test "a captured pal follows the player and shows in the party panel"** (`multiplayer.spec.ts:139-158`).
     - Vòng ném nhắm con gần nhất, loài không ghim, nên dính đường 3: khoảng 0,3%, thú hiền thoát bóng chạy khỏi tầm thì không bắt được.
     - Sửa giống T36: nhắm theo id, ghim Emberpup. Tách helper, ví dụ `spawnWeakPal(page, species)` trả id, đặt cạnh `sendFrom`. Dùng chung cho test này, test T36 (dòng 1449-1461) và dòng 748-760.
     - Rồi siết test: chỉ được đúng một lần bắt (`toBe(1)` thay cho `toBeGreaterThanOrEqual(1)` ở dòng 158). Bỏ hai chỗ chịu lần bắt nhầm: câu "A throw already in flight..." (dòng 157) và `waitForTimeout(1500)` ở dòng 166-168.
   - **Test "gameplay: chop a tree, dash, and knock out a dizzy pal"** (dòng 385-396).
     - Phím Space đánh con gần nhất trong tầm vũ khí (`nearestPal` ở server), chưa chắc là Pebblet debug.
     - Một thú hoang đứng gần hơn 40 px sẽ nhận đòn thay, và `dizzyPals` không lên 1. Hiếm, chưa đo.
   - Kèm theo (PLAN T36 đã đề xuất), ghi vào mục "Tính khí" của `docs/design/pals.md`:
     - bóng không giữ được cũng tính là bị đánh;
     - thú tự vệ đuổi 8 s bất kể xa bao nhiêu;
     - thú hiền chạy trốn 2,5 s.
2. **(P3) `npm run typecheck` không kiểm `tests/e2e/*.ts` và `playwright.config.ts`.**
   - Ba tsconfig chỉ `include` `packages/*/src`, còn Playwright bỏ kiểu mà không kiểm. Lỗi kiểu hoặc biến thừa trong spec lọt qua CI.
   - Thêm `tests/e2e/tsconfig.json` (kế thừa `tsconfig.base.json`, `types: ["node"]`) vào script `typecheck`.
   - Spec hiện đã sạch, nên thêm vào không cần sửa gì khác.
