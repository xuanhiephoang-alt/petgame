PASS
# REVIEW: T7 Giảm sức mạnh chiêu và cú cắn của thú hoang cấp cao, vòng 1

## Kết luận

Thay đổi làm đúng từng bước 1-8 của `PLAN.md`: 2 hằng số, 1 hàm thuần, 1 dòng server, 2 JSDoc, test, `docs/architecture.md`. Không làm thừa, không đụng client, `schema.ts`, `store.ts`. Reviewer đã tính lại mọi số trong PLAN và `docs/design/` từ logic shared, tất cả khớp code. Reviewer tự chạy lại: typecheck sạch, 282/282 test qua, test tích hợp mới qua 4/4 lần chạy riêng. Test này bắt đúng hành vi: bỏ giới hạn ở `GameRoom.ts:696` thì tin cast mang cấp 14, sát thương 20, test đỏ.

## Lỗi phải sửa

Không có.

## Đã xác minh

- **Chỉ một chỗ thú hoang tung chiêu:** `GameRoom.ts:696` là lời gọi `startCast("wild", …)` duy nhất trong mã sản phẩm.
  - `land` (`:1433`) và `support` (`:1504`) dùng `cast.level`, nên cả sát thương lên người chơi và thú đi theo lẫn lượng máu thú hoang tự hồi đều theo cấp đã giới hạn.
  - Nhánh trùm (`BOSS.skillLevel`) và nhánh thú đầu đàn (`Math.min(pal.level, ALPHA.skillLevel)`) giữ nguyên. Đúng quyết định "không bù, trùm không đổi" của PLAN.
  - Không đường nào tạo được thú hoang thường cấp > 14:
    - `debug:spawnPal` đi qua `spawnPal`, tức `rollWildLevel` ≤ `wildMaxLevel` ≤ 14;
    - thả thú (`release`) không sinh thú hoang;
    - khi bắt, chiêu đang gồng bị huỷ (`cancelCasts`), thú thành thú đi theo giữ cấp thật.
- **Thú đi theo không bị giới hạn:**
  - Cả 3 lời gọi `startCast("companion", …)` đều truyền `owned.level`: tự động (`:816`), lệnh hồi máu/khiên (`:1367`), lệnh đánh (`:1397`).
  - `companionDamage` (`progression.ts:58`), `skillPower` và `SKILL_LEVEL_SCALING` không đổi.
- **`wildDamage`** chỉ được dùng ở `strike` (`:1263`).
  - Cú cắn thú đầu đàn (×1) thành 11/11/19/22/23/27, đúng bảng trong `pals.md`; hệ số để giữ như cũ là 1,45-1,56.
  - Trùm vẫn cắn cố định 14.
  - `daycycle.test.ts:51` vẫn đúng (13 > 10).
  - Client không dùng `wildDamage`, cũng không đọc `SkillCastMessage.level` (`Game.castSkill`), nên server mới chạy được với client cũ.
- **Số liệu tính lại bằng `@petgame/shared`:**
  - Thú đầu đàn:
    - máu 399/630/792/966/792/1.170;
    - chiêu thứ 3 tính ở cấp 8 là 40/40/44/37.
  - Trùm không đổi: dậm 18, chiêu 19/33, máu 1.152.
  - Mọi ô ở bảng mục 2 của PLAN đều khớp (cắn, chiêu, Mưa hồi máu +33).
  - Đòn mạnh nhất của thú hoang thường ở cấp 1-14 là 33 (Động đất từ cấp 8; trước T7 là 46), cú cắn mạnh nhất 20.
  - Không có món đồ nào cộng thêm máu tối đa cho người chơi (`player.maxHp = PLAYER_MAX_HP`), nên luật 1/3 đúng như mô tả.
- **Test:**
  - Luật 1/3 duyệt mọi loài ở cấp 1..`wildMaxLevel(1)`, tự gồm chiêu thứ 3 nếu sau này nâng cấp tối đa.
  - Test thú đi theo cấp 14 kiểm cả tin cast `level` 14 lẫn sát thương 28 > 20.
  - Test thú hoang tách cú cắn ra khỏi chỗ chiêu rơi bằng `wildAggro.delete`. Emberpup có tính khí tự vệ, nên không tự tìm mục tiêu mới (`wildTarget`, `:1660`).
- `git diff --check` sạch. Quy ước tên, JSDoc tiếng Anh và import `.ts` đều đúng.

## Góp ý không bắt buộc

- `docs/design/pals.md:205`: câu "Trước T7 … các số này ngắn hơn 20-65%" không khớp bảng ngay trên.
  - Theo bảng, số trước T7 chỉ ngắn hơn 2-39%. Đồng cỏ gần như không đổi: 8,8 / 12,7 / 6,5 so với 9,6 / 13,9 / 6,6. Sa mạc 2 thú: 2,9 so với 3,2.
  - "20-65%" là mức "sau T7 dài hơn" ở vùng xa, lấy từ `BALANCE.md`.
  - Gợi ý: "ngắn hơn tới khoảng 40% ở vùng xa (đồng cỏ gần như không đổi)".
- `docs/design/pals.md:172` (câu có từ trước): "cấp tối đa từ 6 … đến 14 (góc bản đồ)".
  - Quét lưới 8 px trên đất liền: độ nguy hiểm cao nhất là 0,908 (đảo, tại (256, 240)), tức `wildMaxLevel` 13. Cấp 14 không bao giờ sinh ra.
  - Câu ngay sau ("12-13 ở đảo") đã đúng. Gợi ý sửa thành "đến 13 (đảo hoang; 14 cần độ nguy hiểm ≥ 0,94, hiện không có đất nào như vậy)".
  - Test luật 1/3 vẫn nên duyệt tới 14 (chặt hơn).
- `GameRoom.ts:696`: biểu thức 3 nhánh còn viết tay `Math.min(pal.level, ALPHA.skillLevel)` cho thú đầu đàn, và nhánh này chưa có test đơn vị. Có thể gom cấp sức mạnh chiêu của mọi thú hoang vào một hàm thuần trong shared (ví dụ `wildCastLevel(level, { boss, alpha })`) rồi test cả 3 nhánh. Hợp làm cùng T10 (tách `GameRoom.ts`).
- Đường ra lệnh 1-3 (`obey`) chưa có kiểm "cast `level` = cấp thú khi cấp > 8". Code không đổi nên không bắt buộc. Thêm một kiểm vào test "runs up to the nearest wild pal and uses the skill it was told to", với thú cấp 9 trở lên, là khoá được luật "thú đi theo không bị giới hạn" cho mọi đường tung chiêu.
- `BALANCE.md` còn hai lỗi nhỏ PLAN đã chỉ ra:
  - dòng "đầm lầy, cactoad 11" ở hai bảng thời gian trụ, trong khi Cactoad chỉ sống ở sa mạc;
  - câu "cấp 6 ở cỏ chỉ giảm 1", trong khi thực tế giảm 2 (12 → 10).

  PLAN và `docs/design/` đã dùng số đúng. Chỉ cần sửa nếu muốn `BALANCE.md` sạch trong commit.

## Việc mới nên đưa vào TASKS.md

- **T32 (P2) Ăn quả mọng không có hồi chiêu.** Đề xuất từ PLAN, reviewer đã kiểm trong code.
  - `eat` (`GameRoom.ts:1118`) hồi `BERRY_HEAL` mỗi lần bấm, không giới hạn nhịp. Người có N quả coi như có 100 + 20N máu giữa trận, làm mất tác dụng các số thời gian trụ của T7 và mốc trận thú đầu đàn.
  - Game-designer chọn cách làm: hồi chiêu khoảng 1-2 giây kèm đếm ngược trên nút "Ăn", hoặc hồi máu dần.
  - Server kiểm tra, có test.
- **T33 (P3, chỉ làm nếu chơi thử thấy nhạt) Trận thú đầu đàn đồng cỏ quá ngắn.** Đề xuất từ PLAN.
  - Voltmouse cấp 15 có 399 máu, bị hạ trong khoảng 5-8 giây khi đánh liên tục, dưới mốc "vài chục giây".
  - Cân nhắc hệ số máu riêng cho từng thú đầu đàn (trường mới trong `ALPHAS`) thay vì đổi `ALPHA.hpMultiplier` chung.
- **T35 (P3) Dọn nhỏ sau T7.** Gồm 4 góp ý đầu ở trên:
  - sửa `docs/design/pals.md:172` và `:205`;
  - gom cấp sức mạnh chiêu của thú hoang (trùm, thú đầu đàn, thú thường) vào một hàm thuần có test, nếu không làm cùng T10;
  - thêm kiểm cấp chiêu cho đường ra lệnh 1-3 của thú đi theo.
