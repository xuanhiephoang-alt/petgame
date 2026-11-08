PASS
# REVIEW: T37 Hai test e2e nhắm đúng con thú (gameplay đánh choáng, thú đi theo sau khi bắt), vòng 1

## Kết luận
Thay đổi làm đúng và đủ PLAN.md, chỉ sửa `tests/e2e/multiplayer.spec.ts` và một dòng `docs/architecture.md`. Mỗi chỗ sửa nhắm đúng nguyên nhân đã đo, và mình đã đối chiếu từng chỗ với code server. Không còn lỗi phải sửa. Mình chạy lại typecheck strict cho riêng file spec (sạch) và 3 test e2e bị sửa (3/3 qua).

## Lỗi phải sửa
Không có.

## Đã kiểm
- **Phạm vi:**
  - `git status` chỉ có file spec, `docs/architecture.md`, `PROGRESS.md`; không file nào trong `packages/` đổi.
  - Đủ mọi mục Tiêu chí hoàn thành. Đã hết: `nearest`/`best` trong test thú đi theo, `throwAtSpawned`, `dizzyPals`, `caught`, `partySize`, `sleep(500)`, `waitForTimeout(1500)`, chờ 800 ms sau khi tạo thú.
  - Giữ nguyên: tên test, `test.slow()`, bước lướt, chờ 800 ms ở cây, 500 ms giữa hai lần Space, 2500 ms trước khi tải lại. Không thêm retry.
- **Đúng nguyên nhân đã đo:**
  - **Đánh choáng (lượt 28 và 0):** `handleAttack` gọi `nearestPal(player, 48)` (`GameRoom.ts:852`, `2111-2124`). Người chơi đứng đúng chỗ con thú (khoảng cách 0) thì không con nào gần hơn được: thú thường đo từ tâm tới tâm. Chỉ trùm được trừ bán kính 40, mà trùm ở quanh núi lửa phía đông (dây giới hạn 256 px), rất xa đoạn y = 2500.
  - **Chặt cây (lượt 11):**
    - Trước mỗi lần Space, poll đến khi không thú hoang nào trong 100 px.
    - Thú lang thang đi tối đa 95 px/s: `stepWander` dùng đúng `species.speed`, Voltmouse nhanh nhất. Tay không với 48 px (`FISTS`).
    - Không ai chọc thú quanh cây, nên không có con nào đuổi theo ở tốc độ ×1,8.
  - **Thú đi theo (đường 1 và 2):**
    - Bóng chỉ ném theo id, và dừng khi con đó rời khỏi state. Bắt được thì server xoá nó và thêm vào túi trong cùng một lần xử lý (`GameRoom.ts:923-931`); tin ném đến muộn trỏ tới id đã xoá nên bị bỏ (`:893`).
    - Emberpup là thú tự vệ nên luôn ở trong tầm ném.
    - Người chơi xuất phát ở (3120, 2400) (`GameRoom.ts:487-488`), lửa trại ở (3200, 2323,2) (`worldgen.ts:107`): cách nhau đúng 110,9 px. Con thú ở phía đông nên cú cắn đẩy người chơi về phía tây, xa lửa trại hơn. Ở cấp thấp nó chỉ có Tàn lửa, chiêu không đẩy lùi.
- **Hai helper:**
  - **`spawnWeakPal` (`:980-992`):**
    - Nhận con thú qua id mới cộng `hp === 1`. Id không bao giờ dùng lại (`pal${nextPalId++}`), thú hoang sinh ra đầy máu (`:2144`).
    - Thú bị đánh choáng vẫn giữ 1 máu (`hitWildPal`, `combat.ts:66-67`), nên con thú debug có bị chạm vẫn nhận ra được.
    - Thú đi theo chỉ đánh mục tiêu của chủ (`GameRoom.ts:796-799`), nên ở test "party" nó không động vào con thú mới.
    - Không trùng helper sẵn có (gọi qua `sendFrom`), và thay đúng 2 đoạn chép tay.
  - **`throwingAt` (`:999-1010`):** giống hệt khối của T36. `finally` luôn dừng interval; lỗi `evaluate` khi trang đóng thì bị bỏ qua.
- **Đánh choáng vẫn kiểm đúng hành vi game:**
  - Vẫn đi đủ đường: phím Space thật → client → server → choáng → nhãn → hạ gục → rơi đá. Kiểm theo id nên chặt hơn cách cũ (đếm mọi thú đang choáng).
  - Khoảng cách 0 không làm code chạy nhánh khác:
    - `face(0, 0)` giữ nguyên hướng (`entities.ts:66-71`);
    - thú đang choáng không bị đẩy lùi (`GameRoom.ts:868`);
    - `knockback` có xử lý vector 0 (`combat.ts:86`).
  - Đánh trúng ở 40 px vẫn được kiểm ở test "explorer" (bắn cung vào con thú debug) và các test tích hợp của server.
- **Chờ "không thú hoang trong 100 px" có giới hạn, không che lỗi thật:**
  - Mỗi lần chờ tối đa 60 s, và chờ thật nhiều nhất 3 lần, vì lần bấm nào sau khi chờ cũng chặt. `nodeHits` không hồi theo thời gian (`GameRoom.ts:1955`), nên chờ lâu không làm mất nhát đã chặt. Tổng vẫn nằm trong 540 s của `test.slow()`.
  - Hết giờ thì test hỏng rõ ràng, kèm danh sách id các con còn gần.
  - Đây chỉ là điều kiện về môi trường, không bỏ hay nới kiểm tra `wood >= 3` và `felled`.
- **Test toasts và party giữ nguyên hành vi:**
  - Toasts: logic giữ y nguyên.
  - Party: bản cũ tìm "id mới trong 100 px", bản mới tìm "id mới có 1 máu". Hook luôn đặt con thú cách 40 px, nên hai cách tương đương, và cách mới chặt hơn.
- **Tài liệu:** dòng "Helper" có cả hai helper và câu "Thú hoang trong e2e", khớp PLAN.md. Mục "Tính khí" trong `docs/design/pals.md` (commit `d97516f`) tồn tại, đúng chỗ câu đó trỏ tới.
- **Mình đã chạy lại:**
  - `tsc --strict --noUnusedLocals --noUnusedParameters` riêng cho file spec: sạch. Typecheck của repo không kiểm e2e (việc T38).
  - `npx playwright test -g "gameplay: chop a tree|a captured pal follows|party: let a pal go" --workers=1`: 3/3 qua (14,6 s, 15,3 s, 22,9 s).

## Góp ý không bắt buộc
- `docs/architecture.md:92`: "server đánh con gần nhất trong 48 px" chỉ đúng khi tay không. Nên viết "trong tầm vũ khí (tay không 48 px)" cho khớp `docs/design/pals.md`, vì test "explorer" cầm cung.
- `wildPalsNear` (`tests/e2e/multiplayer.spec.ts:532-540`) có thể trả thêm loài và khoảng cách, để khi hết 60 s thì lỗi nói rõ con nào đứng lì gần cây.
- `spawnWeakPal` gọi `spawned()` thêm một lần sau khi poll qua; có thể giữ luôn giá trị poll vừa thấy. Rủi ro hiện tại không đáng kể.
- Giả định "thú lang thang tối đa 95 px/s" giờ chỉ nằm trong chú thích test và PLAN.md (sẽ bị ghi đè ở nhiệm vụ sau). Nên thêm nửa câu vào ghi chú "Thú hoang trong e2e" ở `docs/architecture.md`, để ai thêm loài nhanh hơn biết phải tính lại ngưỡng 100 px.

## Việc mới cho TASKS.md
- Không có việc mới bắt buộc. Nên gộp bốn góp ý trên vào T20, vốn đã có phần dọn helper e2e và sửa dòng "Helper" của `docs/architecture.md`.
