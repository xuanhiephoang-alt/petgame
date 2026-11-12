# PLAN: T27 Voltmouse bỏ chạy nhanh hơn người chơi

Đọc code ở HEAD `88a3917` (commit `BALANCE.md` của T27). File liên quan: `packages/shared/src/combat.ts` (`WILD_CHASE_SPEED_FACTOR` dòng 24, `FLEE_MS` dòng 53; đã import `constants.ts`), `packages/shared/src/constants.ts` (`PLAYER_SPEED` 160), `packages/server/src/ai/wildCombat.ts` (`stepFlee`), `packages/server/src/rooms/GameRoom.ts` (nhánh bỏ chạy dòng 692-702, `provoke` dòng 1709-1720, import từ `@petgame/shared` dòng 110-125), `packages/server/src/rooms/GameRoom.test.ts` (`placeWild` dòng 567, `plantTrees` dòng 672, test "passive pals run away when hit" dòng 2170), `packages/server/src/ai/wildCombat.test.ts`, `packages/shared/src/combat.test.ts`, `docs/design/pals.md` (mục "Tính khí"). Số liệu cân bằng: `BALANCE.md` (balance-analyst, T27).

## Mục tiêu

Người mới ở đồng cỏ gặp thú hiền 6/10 lần, và cứ khoảng 9-10 lần gặp lại có một con Voltmouse. Hiện nay đánh Voltmouse một cái là nó chạy 171 px/s, nhanh hơn người chơi (160 px/s): người chơi không bao giờ đuổi kịp mà phải chờ nó hết chạy (2,5 giây) rồi mới đánh tiếp. Hạ một con cấp 3 bằng tay không mất 9 giây, gấp 3,5-4,5 lần thú cùng cấp, và thú bỏ xa người chơi tới khoảng 430 px. Mothlume (135 px/s, ban đêm) cũng thoát được khi người chơi bám không chuẩn (cảm ứng, vòng qua cây): 11,7 giây.

Sau T27: mọi thú hiền chạy trốn **chậm hơn hẳn người chơi** (tối đa 96 px/s = 0,6 × 160). Người chơi đi bộ đuổi vẫn rút ngắn ít nhất 64 px mỗi giây, nên hạ thú hiền mất gần bằng đánh một con đứng yên (Voltmouse cấp 3 tay không: 2,0 giây thay vì 9,0). Thú vẫn chạy trốn rõ ràng (tối đa khoảng 240 px mỗi lần, đủ ra khỏi tầm ném bóng 180 px nếu người chơi bỏ mặc nó).

## Quyết định: tách phần "chạy về phía thoáng" ra nhiệm vụ mới

Dòng T27 trong `TASKS.md` gồm hai phần: (A) kẹp tốc độ bỏ chạy, (B) "Sau T9: cho thú hiền chạy về phía thoáng theo `NavGrid.clearanceAt`". **T27 chỉ làm (A). (B) tách thành nhiệm vụ mới T57** (đề xuất ở cuối file). Lý do:

1. **Thứ tự đúng như BALANCE.md đòi.** Balance-analyst yêu cầu trần tốc độ có trước hoặc cùng lúc với (B), vì (B) làm thú hiền chạy hiệu quả hơn (bỏ mất những lần nó kẹt vào cây, vốn là lợi thế ngẫu nhiên của người đuổi). Làm (A) trước thỏa điều đó; (B) không cần gì của (A) ngoài trần đã có.
2. **(A) là sửa lỗi trải nghiệm của người mới, nhỏ và ít rủi ro**: một hằng số, một hàm thuần, một dòng ở server, không đổi giao thức. (B) là một hành vi AI mới (lấy mẫu hướng trên `NavGrid`, giữ hướng vài tick, xử lý bờ biển và mép thế giới, trạng thái mới trong `fleeing`, chi phí CPU), có bộ số riêng cần chỉnh và bộ test riêng trên địa hình thật. Gộp chung thì nếu (B) cần nhiều vòng sửa (tối đa 3), bản sửa (A) mà người chơi cần bị giữ lại theo.
3. **Hai phần đi ngược chiều nhau về độ khó**: (A) làm thú dễ đuổi hơn, (B) làm thú chạy khôn hơn. Tách ra thì reviewer chấm từng thay đổi độc lập, và có thể đo (B) trên nền (A) đã ổn định.
4. **(B) đụng vùng đang có việc nợ kỹ thuật**: T41 (tinh chỉnh `PathPlanner`), T10 (đưa `paths` vào module di chuyển của thú). BALANCE.md gợi ý (B) có thể đi qua ngân sách `paths.run(now)`; quyết định đó nên nằm trong nhiệm vụ riêng, không làm T27 phình ra.

## Phạm vi

**Làm:**
- Hằng số `WILD_FLEE_SPEED_CAP` và hàm thuần `fleeSpeed(speciesSpeed)` trong `packages/shared/src/combat.ts`, có unit test.
- Nhánh bỏ chạy trong `GameRoom.ts` dùng `fleeSpeed(species.speed)`.
- Test: unit (shared), unit (`wildCombat.test.ts`: người chơi đuổi kịp), tích hợp (`GameRoom.test.ts`: Voltmouse bị đánh chạy đúng 96 px/s).
- Cập nhật `docs/design/pals.md` (đã sửa trong bước lập kế hoạch này, xem "Tài liệu").

**KHÔNG làm:**
- Không đổi `WILD_CHASE_SPEED_FACTOR` (1,8), `FLEE_MS`, `stepFlee`, đòn đẩy lùi, tốc độ lang thang. Đổi hệ số chung sẽ làm yếu mọi thú đuổi, trùm và thú đầu đàn về hang, và hằng số `max` (648 px) ở `GameRoom.ts:264` mà `pathing.test.ts` kiểm.
- Không kẹp tốc độ đuổi của thú đầu đàn (Voltmouse đầu đàn đuổi 171 px/s): việc riêng, đề xuất T58 ở cuối file.
- Không làm "chạy về phía thoáng" (T57).
- Không đổi client, schema, message, hồ sơ lưu game.

## Thiết kế

### Luật

- Tốc độ chạy trốn của thú hiền = `min(speed × 1,8, 96)` px/s, với 96 = 0,6 × `PLAYER_SPEED`.
- Áp cho **mọi đường dẫn tới bỏ chạy**: đòn của người chơi, đòn và chiêu của thú đi theo, và thú hiền thoát khỏi bóng (`breakOut` → `provoke`). Cả ba đều đi qua cùng nhánh `fleeing` trong `tick`, nên chỉ cần sửa một chỗ.
- Thú đầu đàn không bỏ chạy (`provoke` chỉ đặt `fleeing` khi `!pal.alpha`), nên không đổi.

| Loài (hiền) | speed | Chạy trốn cũ | Chạy trốn mới | So với người chơi | Quãng tối đa mỗi lần chạy (2,5 s) |
|---|---|---|---|---|---|
| Leafkit | 50 | 90 | 90 | 0,56 | 225 px |
| Bubbloon | 40 | 72 | 72 | 0,45 | 180 px |
| Voltmouse | 95 | 171 | **96** | **0,60** | 240 px (cũ 427) |
| Mothlume | 75 | 135 | **96** | **0,60** | 240 px (cũ 338) |
| Bogbloom | 40 | 72 | 72 | 0,45 | 180 px |

### Vì sao trần 0,6 (không phải 0,9 như dòng TASKS gợi ý)

Theo bảng độ nhạy trong `BALANCE.md` (Voltmouse cấp 3, tay không, giây đến khi hạ gục; "hiệu quả" là tốc độ đuổi thực tế của người chơi so với 160):

| Hiệu quả đuổi | Hiện nay | Trần 0,9 (144) | Trần 0,75 (120) | **Trần 0,6 (96)** | Đánh đứng yên |
|---|---|---|---|---|---|
| 1,0 (đuổi hoàn hảo) | 9,0 | 2,0 | 2,0 | **2,0** | 2,0 |
| 0,9 | 12,4 | 8,5 | 2,0 | **2,0** | |
| 0,8 (joystick cảm ứng, vòng qua cây) | 13,9 | 9,5 | 3,2 | **2,0** | |
| 0,7 | 15,9 | 13,5 | 9,1 | **2,0** | |

- Trần 0,9 chỉ để lại 16 px/s chênh lệch: người chơi điện thoại bám kém 10% là quay về 8,5 giây. Trần 0,6 giữ mức "đánh đứng yên" tới khi người chơi chỉ còn đuổi được 70% tốc độ.
- Sau khi kẹp, Voltmouse cấp 3 (2,0 s) ngang Leafkit (2,4 s), Mothlume (2,4 s), Bubbloon (2,8 s) cùng cấp; cấp 8 (3,6 s) cũng nằm trong khoảng 3,6-8,8 s của thú cùng cấp.
- Một trần phẳng thay vì hệ số riêng từng loài: chỉ hai loài vượt 96 (Voltmouse, Mothlume); ba loài còn lại không đổi gì, nên test và hành vi hiện có của chúng giữ nguyên.
- Nút chỉnh nếu sau này muốn thú hiền "chạy trốn" rõ hơn: 0,65 (104 px/s) vẫn an toàn tới hiệu quả 0,75. Không dùng 0,75 hay 0,9.

### Trải nghiệm người chơi (điện thoại và bàn phím)

Không có chữ hay nút mới. Người chơi thấy Voltmouse bị đánh vẫn giật mình chạy đi, nhưng chỉ cần giữ joystick (hoặc phím mũi tên/WASD) về phía nó là theo kịp và đánh tiếp đúng nhịp vũ khí (tay không: mỗi 0,4 giây). Không cần biết lướt (Shift / nút lướt) mới hạ được nó. Lúc lang thang Voltmouse vẫn là loài nhanh nhất (95 px/s), nên vẫn giữ cảm giác "chuột điện nhanh nhẹn".

### Tác dụng phụ đã kiểm (theo BALANCE.md)

- Thú tự vệ, hung dữ, trùm, thú đầu đàn đuổi và về nhà: không đổi (dòng 684, 720, 1620, 264 của `GameRoom.ts` vẫn dùng `species.speed * WILD_CHASE_SPEED_FACTOR`).
- Thú đi theo (190 px/s) vẫn nhanh hơn mọi thú hiền chạy trốn.
- Bắt thú: công thức không đổi; thú thoát bóng chạy chậm hơn nên dễ ném lại trong tầm 180 px.
- Kinh nghiệm và đồ rơi: Voltmouse cho như cũ nhưng tốn 2 s thay vì 9 s, tức ngang thú khác; Voltmouse chỉ chiếm 5,1% thế giới nên không lệch mục tiêu lên cấp 7 trong buổi đầu (T4).

## Kế hoạch triển khai

1. **`packages/shared/src/combat.ts`**
   - Sửa dòng import đầu: `import { PLAYER_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from "./constants.ts";` (không tạo vòng import: `constants.ts` không import gì).
   - Sửa JSDoc của `WILD_CHASE_SPEED_FACTOR` cho đúng: "Chasing wild pals move this much faster than when wandering; fleeing passive pals too, but never faster than WILD_FLEE_SPEED_CAP."
   - Thêm ngay dưới `WILD_CHASE_SPEED_FACTOR`:
     ```ts
     /**
      * Fleeing passive pals never run faster than this (px/s): 0.6 of a walking player's speed, so a player who
      * follows even at 70% of full speed (touch joystick, weaving round trees) keeps hitting at the weapon's own
      * pace instead of waiting out FLEE_MS (BALANCE.md of T27, docs/design/pals.md "Tính khí").
      */
     export const WILD_FLEE_SPEED_CAP = PLAYER_SPEED * 0.6;

     /** How fast a passive pal of this wandering speed runs away when hit (px/s): its chase speed, capped. */
     export function fleeSpeed(speciesSpeed: number): number {
       return Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, WILD_FLEE_SPEED_CAP);
     }
     ```
   - Hệ số 0,6 chỉ nằm ở định nghĩa hằng số (bảng cân bằng), không rải ở chỗ khác. `index.ts` đã `export * from "./combat.ts"`, không cần sửa.

2. **`packages/server/src/rooms/GameRoom.ts`**
   - Thêm `fleeSpeed` vào danh sách import từ `@petgame/shared` (theo thứ tự chữ cái của khối hàm thường, cạnh `companionMaxHp`, `biomeAt`...). Giữ import `WILD_CHASE_SPEED_FACTOR` (còn dùng ở 4 chỗ khác).
   - Dòng 695: `stepFlee(pos, from, species.speed * WILD_CHASE_SPEED_FACTOR, dtMs, radius, this.obstacles)` → `stepFlee(pos, from, fleeSpeed(species.speed), dtMs, radius, this.obstacles)`. Có thể thêm chú thích ngắn phía trên `if (from)`: `// A passive pal runs away, slower than a walking player (fleeSpeed).`
   - Không đổi gì khác trong `GameRoom.ts`.

3. **`packages/server/src/ai/wildCombat.ts`**: không đổi code. Chỉ sửa JSDoc của `stepFlee` nếu muốn nói rõ tốc độ do người gọi truyền vào (`fleeSpeed`); tuỳ coder, không bắt buộc.

4. **Test**: xem mục "Test".

5. **Tài liệu**: `docs/design/pals.md` đã được game-designer cập nhật trong bước này; coder kiểm lại cho khớp tên hằng số, hàm đã viết (nếu đổi tên thì sửa cả tài liệu).

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`. Client không đổi: vị trí thú vẫn do server gửi qua schema, client chỉ vẽ. Không cần e2e mới.

## Test

**Unit, shared: `packages/shared/src/combat.test.ts`**, thêm `describe("fleeing passive pals")` (import thêm `fleeSpeed`, `WILD_FLEE_SPEED_CAP`, `WILD_CHASE_SPEED_FACTOR` từ `./combat.ts`, `PLAYER_SPEED` từ `./constants.ts`):
1. "Voltmouse and Mothlume are capped at 0.6 of a player's speed": `fleeSpeed(getSpecies("voltmouse").speed)` và mothlume đều `toBe(WILD_FLEE_SPEED_CAP)`, và `WILD_FLEE_SPEED_CAP` `toBeCloseTo(96)`.
2. "slower pals keep their chase speed": leafkit `toBeCloseTo(90)`, bubbloon và bogbloom `toBeCloseTo(72)`; tổng quát: với mọi `speed` mà `speed * WILD_CHASE_SPEED_FACTOR <= WILD_FLEE_SPEED_CAP`, `fleeSpeed(speed)` bằng `speed * WILD_CHASE_SPEED_FACTOR`.
3. "every passive pal runs away slower than a walking player": lặp `PAL_SPECIES` lọc `temperament === "passive"`, mỗi loài `fleeSpeed(s.speed) <= PLAYER_SPEED * 0.6 + 1e-9` và `< PLAYER_SPEED`. Test này giữ đúng khi sau này thêm loài hiền mới.

**Unit, server: `packages/server/src/ai/wildCombat.test.ts`**, thêm 1 test (import `fleeSpeed`, `PLAYER_SPEED`, `getSpecies` từ `@petgame/shared`):
4. "a player walking after a fleeing Voltmouse closes in": người chơi ở (0, 0), Voltmouse ở (100, 0), 20 bước 50 ms. Mỗi bước: `pal = stepFlee(pal, player, fleeSpeed(getSpecies("voltmouse").speed), 50, 12)`, rồi người chơi đi thẳng về phía thú `min(PLAYER_SPEED * 0.05, khoảng cách)` px. Kiểm: khoảng cách sau 1 giây `toBeLessThan(40)` (mô phỏng lúc lập kế hoạch: 36,0 px với 96 px/s; với tốc độ cũ 171 px/s là 111,0 px, nên test bắt được nếu ai đó bỏ trần), và khoảng cách không bao giờ vượt khoảng cách ban đầu cộng một bước của thú (≤ 100 + 96 × 0,05 + 0,01).

**Tích hợp: `packages/server/src/rooms/GameRoom.test.ts`**, trong `describe("combat")` ngay sau "passive pals run away when hit" (import thêm `fleeSpeed`, `PLAYER_SPEED` nếu chưa có):
5. "a hit Voltmouse runs away slower than the player": tất định, không phụ thuộc giờ thật.
   - `const { room, client, player } = await setup(); room.state.pals.clear(); plantTrees(room, []);` (bỏ hết cây, đá; địa hình thật vẫn còn). Đặt `player.x = 3200; player.y = 2560;` (điểm `C` mà `describe("finding a way around trees")` dùng, trên đất liền).
   - `const id = placeWild(room, "voltmouse", player);` (cách 30 px về phía đông), `const pal = room.state.pals.get(id)!`.
   - `(room as any).provoke(id, { kind: "player", id: client.sessionId });` (dùng `provoke` thay vì đánh để không có đòn đẩy lùi, chí mạng ngẫu nhiên).
   - Ghi `const start = { x: pal.x, y: pal.y }`, rồi trong **một vòng lặp đồng bộ** (không `await`) gọi `(room as any).tick(TICK_MS)` 20 lần. Vì không `await`, đồng hồ phòng không chạy và vòng tick thật không chen vào, nên `fleeing.until` còn hiệu lực suốt 20 lần.
   - Kiểm: `distance(pal, start)` `toBeCloseTo(fleeSpeed(getSpecies("voltmouse").speed) * (20 * TICK_MS) / 1000, 0)` (96 px); `toBeLessThan(PLAYER_SPEED * (20 * TICK_MS) / 1000)`; `pal.x > start.x` (chạy ra xa người chơi). Với code cũ quãng là 171 px nên test hỏng, đúng như muốn.
   - Nếu `tick` gặp vấn đề không lường trước khi gọi trực tiếp (ví dụ thú khác hồi sinh rồi chen vào), coder ghi vào `PROGRESS.md` và dùng cách dự phòng: `await ticks(room, 20)`, đo quãng đi so với `room.clock.currentTime` trước và sau, kiểm quãng ≤ `fleeSpeed × (elapsed + TICK_MS) / 1000 + 1` và < `PLAYER_SPEED × elapsed / 1000`. Không nới các điều kiện khác.
6. Test có sẵn giữ nguyên, phải qua: "passive pals run away when hit" (Leafkit 90 < 96), test thú đầu đàn Voltmouse không bỏ chạy (dòng 1309), `wildCombat.test.ts` "runs straight away when fleeing" (tốc độ 200 truyền thẳng), `pathing.test.ts`.

**E2E:** không thêm (không đổi giao diện hay giao thức). Tester chạy `npm run test:e2e` như thường lệ để chắc không vỡ gì.

## Tiêu chí hoàn thành

- [ ] `packages/shared/src/combat.ts` có `WILD_FLEE_SPEED_CAP = PLAYER_SPEED * 0.6` và `fleeSpeed(speciesSpeed)` = `min(speciesSpeed × WILD_CHASE_SPEED_FACTOR, WILD_FLEE_SPEED_CAP)`, mỗi cái có JSDoc tiếng Anh nói lý do.
- [ ] `GameRoom.ts`: nhánh bỏ chạy dùng `fleeSpeed(species.speed)`; bốn chỗ còn lại dùng `WILD_CHASE_SPEED_FACTOR` (dòng 264, 684, 720, 1620) **không đổi**. `git diff` của `GameRoom.ts` chỉ gồm dòng import và dòng gọi `stepFlee` (cộng tối đa một dòng chú thích).
- [ ] `WILD_CHASE_SPEED_FACTOR`, `FLEE_MS`, `stepFlee` không đổi giá trị hay hành vi.
- [ ] Unit test 1-3 (shared) và 4 (`wildCombat.test.ts`), tích hợp test 5 (Voltmouse 96 px/s) có và qua; thử đột biến: tạm đổi `fleeSpeed` trả `speciesSpeed * WILD_CHASE_SPEED_FACTOR` thì test 1, 3, 4, 5 hỏng (reviewer có thể làm lại trên bản tạm, không commit).
- [ ] Mọi test có sẵn qua không sửa (đặc biệt "passive pals run away when hit", test thú đầu đàn Voltmouse, `pathing.test.ts`).
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] Không đổi schema, message, `Profile`, client.
- [ ] `docs/design/pals.md` mục "Tính khí" khớp code: tên `WILD_FLEE_SPEED_CAP`, `fleeSpeed`, 96 px/s, bảng tốc độ.

## Tài liệu (đã sửa trong bước lập kế hoạch)

`docs/design/pals.md`:
- Mục "Tính khí": tách "Chạy trốn và đuổi theo đều nhanh gấp 1,8 lần" thành luật đuổi (1,8) và luật chạy trốn (1,8 nhưng tối đa 96 px/s), thay câu "Voltmouse chạy 171 px/s, nhanh hơn người chơi (việc T27)" bằng bảng tốc độ mới và lý do chọn 0,6.
- Mục "Thú đầu đàn": ghi rõ thú đầu đàn đuổi không bị trần này, Voltmouse đầu đàn đuổi 171 px/s, nhanh hơn người chơi (việc đề xuất T58).
- Mục "Đi vòng cây, đá": câu "thú hiền chạy trốn không tìm đường" thêm "chưa chọn hướng thoáng (việc đề xuất T57)".

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **Cảm giác "Voltmouse mất chất nhanh nhẹn".** Chấp nhận: lúc lang thang nó vẫn nhanh nhất (95 px/s); chạy trốn vẫn rõ (240 px mỗi lần). Nếu người chơi thử thấy quá dễ, nút chỉnh là đổi 0,6 thành 0,65 trong một hằng số (BALANCE.md: vẫn an toàn tới hiệu quả đuổi 0,75).
- **Mothlume cũng chậm lại (135 → 96).** Có chủ ý: nó cũng thoát được người bám kém (11,7 s ở hiệu quả 0,8).
- **Gọi `tick` trực tiếp trong test tích hợp** là cách mới trong `GameRoom.test.ts` (các test khác gọi `handleAttack`, `provoke`, `daze`... trực tiếp nhưng chờ tick thật). Đã có cách dự phòng ở test 5; ghi lý do vào `PROGRESS.md` nếu dùng.

## Đề xuất cho TASKS.md (agent chính cập nhật)

1. **Sửa dòng T27**: bỏ câu "Sau T9: cho thú hiền chạy về phía thoáng..." khỏi T27, ghi "phần chạy về phía thoáng tách sang T57".

2. **Thêm T57 (P2, sau T27): Thú hiền chạy trốn về phía thoáng.** Hiện `stepFlee` chạy thẳng tới điểm cách 200 px ngược hướng kẻ đánh; gặp cây, đá thì kẹt hoặc trượt chậm, gặp biển thì đứng yên ở bờ (`GameRoom.ts` bỏ bước nếu `isSea`). Gợi ý thiết kế (từ `BALANCE.md` của T27): lấy mẫu khoảng 9 hướng trong ±70° quanh hướng thẳng ra xa kẻ đánh (không quá ±90° để thú không chạy ngang qua người chơi), cho điểm bằng `NavGrid.clearanceAt` ở khoảng 60-120 px phía trước, loại hướng mà `NavGrid.lineClear` (thân thú, `sea: false`) sai, ưu tiên hướng gần thẳng khi điểm ngang nhau, giữ hướng đã chọn khoảng 250 ms (5 tick) để không rung; số liệu đặt trong một bảng hằng số (ví dụ `FLEE` trong `ai/wildCombat.ts`). Trạng thái hướng giữ trong `fleeing` của `GameRoom` (chỉ server). Chi phí: ít thú chạy cùng lúc; cân nhắc đi qua ngân sách `paths.run(now)` của `PathPlanner` (liên quan T10, T41). Phải giữ trần `fleeSpeed` của T27; test unit với `NavGrid` dựng từ vòng tròn giả (như `pathing.test.ts`), test tích hợp: thú hiền bị đánh khi phía sau là hàng cây vẫn đi được ít nhất X px trong 1 giây; Voltmouse cạnh bờ biển chạy dọc bờ thay vì đứng yên. Cập nhật mục "Đi vòng cây, đá" trong `docs/design/pals.md`. Gọi balance-analyst kiểm lại thời gian hạ gục ở rừng (đầm lầy, núi tuyết) sau khi có bản mẫu.

3. **Thêm T58 (P2): Voltmouse đầu đàn đuổi nhanh hơn người chơi.** Phát hiện phụ của balance-analyst ở T27: thú đầu đàn đuổi và về hang với `species.speed × WILD_CHASE_SPEED_FACTOR`; Voltmouse đầu đàn ở đồng cỏ (cấp 15, máu 399, thú đầu đàn đầu tiên người mới gặp) đuổi 171 px/s, nhanh hơn người chơi 7%, nên chạy bộ không thoát được, chỉ lướt hoặc chờ hết dây (`ALPHA.leash` 384 px, `WILD_AGGRO_MS` 8 s). Các thú đầu đàn khác đều chậm hơn người chơi (Scorchtail 153, Frostfang 135). Cần quyết định thiết kế: (a) kẹp tốc độ đuổi của thú đầu đàn (ví dụ tối đa 0,95 × `PLAYER_SPEED`, số trong bảng `ALPHA`), (b) giữ nguyên vì thú đầu đàn là thử thách và có dây giới hạn, chỉ ghi vào tài liệu. Đề xuất: gọi balance-analyst đo tỉ lệ người chơi bỏ chạy thoát được và tỉ lệ chết ở trận Voltmouse đầu đàn với (a) và (b), rồi game-designer chọn; nghiêng về (a) vì đây là thú đầu đàn đầu tiên và mốc thiết kế "người biết né thì sống" đã có, còn "không chạy thoát được" chỉ đúng với riêng loài này. Không đổi `WILD_CHASE_SPEED_FACTOR` toàn cục (làm đổi trùm và hằng số 648 px).
