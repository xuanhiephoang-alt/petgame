# PLAN: T58 Kẹp tốc độ đuổi của thú đầu đàn (Voltmouse đầu đàn 171 → 152 px/s)

Code đọc ở HEAD `38987f7`. Số liệu: `BALANCE.md` của T58 (commit `38987f7`). Tài liệu thiết kế `docs/design/pals.md` đã được designer sửa cùng kế hoạch này (mục "Thú đầu đàn", gạch đầu dòng "Tốc độ đuổi và về hang", và một câu ở mục "Tính khí"): agent chính commit nó cùng `PLAN.md`; coder không cần sửa tài liệu, chỉ đối chiếu.

Chỗ liên quan (số dòng ở HEAD):

| File | Dòng | Nội dung |
|---|---|---|
| `packages/shared/src/alphas.ts` | 1-7 | import (đã có `PIXELS_PER_UNIT` từ `./constants.ts`) |
| `packages/shared/src/alphas.ts` | 35-63 | bảng `ALPHA` |
| `packages/shared/src/combat.ts` | 28, 37-39 | `WILD_CHASE_SPEED_FACTOR` (1,8); `fleeSpeed` (mẫu để viết hàm kẹp) |
| `packages/shared/src/constants.ts` | 16 | `PLAYER_SPEED = 160` |
| `packages/server/src/rooms/GameRoom.ts` | 3-165 | khối import từ `@petgame/shared` (có `ALPHA`, `WILD_CHASE_SPEED_FACTOR`) |
| `packages/server/src/rooms/GameRoom.ts` | 745-760 | nhánh thú đầu đàn về hang; **754** `const speed = species.speed * WILD_CHASE_SPEED_FACTOR;` |
| `packages/server/src/rooms/GameRoom.ts` | 777-818 | nhánh đuổi (thú hung dữ, tự vệ, đầu đàn, trùm); **794** `const speed = species.speed * WILD_CHASE_SPEED_FACTOR;` |
| `packages/server/src/rooms/GameRoom.ts` | 270, 1695 | trùm: `max` đường vòng và `bossHeadHome` (**không đụng**) |
| `packages/server/src/rooms/GameRoom.ts` | 341, 355 | `skillGapUntil`, `alphaReturning` (dùng trong test) |
| `packages/shared/src/alphas.test.ts` | 1-2, 8 | import, `describe("pack leaders")` |
| `packages/server/src/rooms/GameRoom.test.ts` | 159, 574-586, 679-683 | `ticks`, `placeWild`, `plantTrees` |
| `packages/server/src/rooms/GameRoom.test.ts` | 1308-1345 | `describe("pack leaders")`, `alphaOf`, test dây giới hạn |
| `packages/server/src/rooms/GameRoom.test.ts` | 2187-2203 | "a hit Voltmouse runs away slower than the player" (mẫu tick đồng bộ `(room as any).tick(TICK_MS)`) |

## Mục tiêu

Người chơi mới gặp Voltmouse đầu đàn ở đồng cỏ (con đầu đàn đầu tiên họ thấy) và quyết định bỏ chạy thì thấy khoảng cách **giãn ra** (8 px/s) thay vì bị nó bám sát dần (co lại 11 px/s như hôm nay). Luật trở nên nhất quán và dễ giải thích: **không thú đầu đàn nào chạy nhanh hơn người đi bộ**, thay vì một ngoại lệ duy nhất trong cả game (Voltmouse đầu đàn 171 px/s là loài duy nhất, kể cả trùm và mọi thú thường, nhanh hơn người chơi 160 px/s).

Đây là sửa cảm giác và sự nhất quán, không phải đổi độ khó: kết quả thoát gần như không đổi (có sát thương 30% → 29%, chết 0%) và thời gian hạ gục không đổi (khoảng 8 giây với kiếm và thú đi theo cấp 15), theo `BALANCE.md`.

## Phạm vi

Làm:
- Bảng `ALPHA` thêm khoá `chaseSpeedMax` = `PLAYER_SPEED * 0.95` (152 px/s).
- Hàm thuần `alphaChaseSpeed(speciesSpeed)` trong `packages/shared/src/alphas.ts`, có unit test.
- `GameRoom.ts`: dùng hàm đó cho tốc độ về hang (dòng 754) và cho tốc độ đuổi **chỉ khi `pal.alpha`** (dòng 794).
- Ba test tích hợp server (đuổi, về hang, thú thường không bị kẹp).

KHÔNG làm:
- Không đổi `WILD_CHASE_SPEED_FACTOR` (1,8) toàn cục (yêu cầu của nhiệm vụ), không đổi `WILD_FLEE_SPEED_CAP`, `fleeSpeed`.
- Không đụng trùm: `GameRoom.ts:270` (`max` đường vòng của trùm, được `pathing.test.ts:309` kiểm 648 px) và `bossHeadHome` (`:1695`) giữ `species.speed * WILD_CHASE_SPEED_FACTOR`. Trùm không phải thú đầu đàn (`pal.alpha` false), 81 px/s.
- Không đụng thú thường hung dữ/tự vệ: Scorchtail thường vẫn đuổi 153 px/s.
- Không đổi `ALPHA.leash`, `sight`, `hpMultiplier`, `damageMultiplier`, `skillChance`, máu, cắn, chiêu của thú đầu đàn. Không chỉnh trận đồng cỏ ngắn (việc của T7, xem "Rủi ro").
- Không đổi schema, message, hồ sơ lưu game, client, e2e. Không có chữ mới cho người chơi.

## Thiết kế

### Chọn phương án: **kẹp** (phương án 1), không phải "giữ nguyên và ghi tài liệu"

| | Phương án 1: kẹp 0,95 × người chơi | Phương án 2: giữ 171, ghi tài liệu |
|---|---|---|
| Kết quả thoát (đang đánh rồi chạy, phản ứng 0,3 s) | có sát thương 29%, TB 3,2, chết 0% | 30%, 3,3, 0% |
| Bị vật cản làm chậm nặng (hiệu quả 0,3) | chết 6,7% | chết 9,0% |
| Khoảng cách khi người chơi chạy đúng tốc độ | giãn 8 px/s | co 11 px/s (nó bám sát sau lưng tới khi đứt dây) |
| Thời gian hạ gục | khoảng 8,0 s | 8,0 s |
| Luật | "không thú đầu đàn nào nhanh hơn người đi bộ" | một ngoại lệ phải giải thích |
| Rủi ro về sau | thứ làm chậm người chơi (bè 144, đóng băng...) không biến Voltmouse đầu đàn thành mối nguy | dây giới hạn là chỗ dựa duy nhất |
| Chi phí | 1 khoá, 1 hàm, 2 dòng server, test | sửa tài liệu |

Chọn phương án 1 vì: rủi ro gần bằng 0 (mọi số đo về thoát và hạ gục nằm trong sai số mô phỏng), chi phí nhỏ, đảo ngược dễ (đổi một hằng số), và bỏ được một ngoại lệ không có lý do thiết kế. Phương án 2 cũng chấp nhận được về số, nhưng không có lợi gì ngoài việc không sửa code. Đây là quyết định nhỏ, đảo ngược được, không đụng dữ liệu lưu: tự quyết, không hỏi.

### Luật

1. Tốc độ đuổi và tốc độ về hang của **thú đầu đàn** = `min(species.speed × WILD_CHASE_SPEED_FACTOR, ALPHA.chaseSpeedMax)`.
2. `ALPHA.chaseSpeedMax` = `PLAYER_SPEED * 0.95` = **152 px/s** (JavaScript tính `160 * 0.95` ra đúng `152`, đã kiểm bằng `node -e`).
3. Áp cho **cả đường về hang** (khi bị kéo quá dây): để thú đầu đàn không về nhanh hơn lúc đuổi, và người chơi không thấy nó "vụt" đi khi bỏ cuộc.
4. Thú thường và trùm: không đổi, vẫn `species.speed × 1,8`.

Bảng sau khi đổi (mọi thú đầu đàn, `ALPHAS`):

| Thú đầu đàn | speed | × 1,8 | Sau kẹp | / 160 | Đổi |
|---|---|---|---|---|---|
| voltmouse | 95 | 171 | **152** | 0,95 | −19 (−11%) |
| scorchtail | 85 | 153 | **152** | 0,95 | −1 (coi như không đổi) |
| frostfang | 75 | 135 | 135 | 0,84 | không |
| coralcrab | 55 | 99 | 99 | 0,62 | không |
| cactoad | 45 | 81 | 81 | 0,51 | không |
| bogbloom | 40 | 72 | 72 | 0,45 | không |

Ngưỡng kẹp có hiệu lực: `speed > 152 / 1,8 ≈ 84,4`.

### Vì sao 0,95, không thấp hơn

- **Sàn 0,9 (144 px/s):** dưới mức này mở đường bắn kéo. Quãng chạy để lấy lại 100 px tầm ná = `100 × 160 / (160 − tốc độ đuổi)`: 152 → 2.000 px, 144 → 1.000 px, 128 → 500 px. Vòng chạy quanh hang trong dây 384 px dài khoảng 1.500 px mỗi vòng: từ 128 trở xuống người chơi bắn kéo được trọn một vòng, trận đầu đàn mất ý nghĩa. Test unit khoá `chaseSpeedMax ≥ 0,9 × PLAYER_SPEED` để lần chỉnh sau không vô tình xuống dưới.
- **Chọn 0,95 thay vì 0,9:** Voltmouse đầu đàn vẫn là con nhanh nhất, "sát người chơi" (đúng tính cách chuột điện), và Scorchtail đầu đàn (núi lửa, cuối game) không bị chậm đi 6% mà không cần.
- **Trần < 1,0:** test unit khoá `chaseSpeedMax < PLAYER_SPEED`.

### Trải nghiệm (điện thoại và bàn phím)

Không có chữ, nút hay HUD mới. Trên điện thoại người chơi đẩy joystick hết cỡ chạy 160 px/s, bàn phím cũng vậy; cả hai giờ đều bỏ xa Voltmouse đầu đàn khi chạy thẳng. Lướt (520 px/s trong 170 ms) vẫn như cũ.

## Kế hoạch triển khai

Một commit duy nhất (nhỏ).

1. **`packages/shared/src/alphas.ts`**
   - Import: sửa dòng `import { PIXELS_PER_UNIT } from "./constants.ts";` thành `import { PIXELS_PER_UNIT, PLAYER_SPEED } from "./constants.ts";`; thêm `import { WILD_CHASE_SPEED_FACTOR } from "./combat.ts";`. Không vòng import: `combat.ts` và các file nó import (`constants`, `collision`, `movement`, `pathfind`, `pals`, `progression`, `rewards`, `work`) không import `alphas.ts` (chỉ `index.ts`, `schema.ts` và test import nó).
   - Trong `ALPHA`, đặt ngay sau `roam` (nhóm "đi lại"), thêm:
     ```ts
     /**
      * Its chase and walk home are never faster than this (px/s): 0.95 of a walking player's speed, so a
      * player who runs always pulls away, yet not below 0.9 or a ranged player could shoot, run, and shoot
      * again around its lair without being bitten (docs/design/pals.md, BALANCE.md of T58).
      */
     chaseSpeedMax: PLAYER_SPEED * 0.95,
     ```
   - Sau `ALPHA` (trước `palName`), thêm hàm:
     ```ts
     /** A pack leader's chase and walk-home speed (px/s): a wild pal's chase speed, capped at ALPHA.chaseSpeedMax. */
     export function alphaChaseSpeed(speciesSpeed: number): number {
       return Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, ALPHA.chaseSpeedMax);
     }
     ```
   - Không cần sửa `index.ts` (đã `export * from "./alphas.ts"`).

2. **`packages/server/src/rooms/GameRoom.ts`**
   - Thêm `alphaChaseSpeed` vào khối import từ `@petgame/shared` (đặt cạnh `ALPHA`/`alphaLairs` theo thứ tự đang có). Giữ import `WILD_CHASE_SPEED_FACTOR` (còn dùng ở 270, 794, 1695).
   - Dòng 754 (nhánh về hang, chỉ chạy khi `pal.alpha` vì `home` chỉ có với thú đầu đàn):
     `const speed = species.speed * WILD_CHASE_SPEED_FACTOR;` → `const speed = alphaChaseSpeed(species.speed);`
   - Dòng 794 (nhánh đuổi chung):
     `const speed = species.speed * WILD_CHASE_SPEED_FACTOR;` → `const speed = pal.alpha ? alphaChaseSpeed(species.speed) : species.speed * WILD_CHASE_SPEED_FACTOR;`
     Thêm chú thích ngắn tiếng Anh phía trên: `// Pack leaders never outrun a walking player (ALPHA.chaseSpeedMax); others chase at 1.8x.`
   - Không đụng dòng 270 và 1695.

3. **`packages/shared/src/alphas.test.ts`**: thêm test (mục "Test").

4. **`packages/server/src/rooms/GameRoom.test.ts`**: thêm 3 test vào `describe("pack leaders")` (mục "Test"); bổ sung import còn thiếu từ `@petgame/shared` (`WILD_CHASE_SPEED_FACTOR`; `alphaChaseSpeed` nếu dùng) nếu chưa có. `PLAYER_SPEED`, `TICK_MS`, `ALPHA`, `alphaLairs`, `getSpecies`, `isSea`, `defaultWorld` đã được import.

5. **`docs/design/pals.md`**: designer đã sửa. Coder chỉ kiểm tên khoá và hàm trong code khớp tài liệu (`ALPHA.chaseSpeedMax`, `alphaChaseSpeed`). Nếu coder đổi tên vì lý do nào đó thì sửa tài liệu theo.

6. Ghi `PROGRESS.md`.

## Giao thức

Không đổi. Không đổi `schema.ts`, `messages.ts`, `Profile`. Client chỉ vẽ vị trí server gửi, không tự tính tốc độ thú, nên không cần sửa client. Hồ sơ lưu game không bị ảnh hưởng.

## Test

### Unit (shared), `packages/shared/src/alphas.test.ts`

Import thêm `alphaChaseSpeed` từ `./alphas.ts`, `PLAYER_SPEED` từ `./constants.ts`, `WILD_CHASE_SPEED_FACTOR` từ `./combat.ts`.

1. **"chase no faster than a walking player, yet fast enough that kiting is not possible"**
   - `expect(ALPHA.chaseSpeedMax).toBe(152)`.
   - `expect(ALPHA.chaseSpeedMax).toBeLessThan(PLAYER_SPEED)`.
   - `expect(ALPHA.chaseSpeedMax).toBeGreaterThanOrEqual(PLAYER_SPEED * 0.9)` (sàn chống bắn kéo).
   - Với mọi `def` trong `ALPHAS`: `alphaChaseSpeed(getSpecies(def.speciesId).speed) < PLAYER_SPEED`.
2. **"cap only the fast ones: Voltmouse and Scorchtail at 152, the rest at 1.8x"**
   - Bảng mong đợi theo `speciesId`: voltmouse 152, scorchtail 152, frostfang 135, coralcrab 99, cactoad 81, bogbloom 72; mỗi con `toBeCloseTo(expected, 6)` (`55 * 1.8` có sai số dấu phẩy động). Duyệt `ALPHAS` để test vỡ nếu thêm thú đầu đàn mà quên bảng (`expect(expected[def.speciesId]).toBeDefined()`).
   - Dưới ngưỡng không đổi: với `speed` từ 10 tới 84 bước 1, `alphaChaseSpeed(speed)` `toBe(speed * WILD_CHASE_SPEED_FACTOR)`; với `speed` 85 tới 200, `toBe(ALPHA.chaseSpeedMax)`.

### Tích hợp server, `packages/server/src/rooms/GameRoom.test.ts`, trong `describe("pack leaders")`

Dùng tick đồng bộ `(room as any).tick(TICK_MS)` như test "a hit Voltmouse runs away slower than the player" (đồng hồ phòng không chạy, `dtMs` đúng 50, không phụ thuộc tốc độ máy). Không `await` giữa lúc đặt vị trí và vòng tick. Đặt `const capStep = ALPHA.chaseSpeedMax * TICK_MS / 1000;` (7,6 px; trước T58 Voltmouse đầu đàn đi 8,55 px mỗi tick).

Cho mỗi test: xoá mọi thú khác (`for (const other of [...room.state.pals.keys()]) if (other !== id) room.state.pals.delete(other);`), `plantTrees(room, [])` để không cây nào làm lệch bước, và chặn chiêu bằng `(room as any).skillGapUntil.set(\`w:${id}\`, Number.POSITIVE_INFINITY)` để thú không đứng gồng chiêu (8% mỗi tick) giữa chừng. Ghi độ dời mỗi tick vào mảng `steps`.

1. **"an alpha Voltmouse chases at most ALPHA.chaseSpeedMax (152 px/s), slower than a walking player"**
   - `[id, pal] = alphaOf(room, "voltmouse")`; `home = alphaLairs().get("meadow")!`; `pal.x = home.x; pal.y = home.y`; `player.x = home.x + 150; player.y = home.y` (trong tầm nhìn 170, ngoài tầm cắn 40). `expect(isSea(defaultWorld().layout.terrain, player.x, player.y)).toBe(false)` để test tự báo nếu bố cục đổi.
   - 10 tick đồng bộ. Sau tick đầu: `expect((room as any).wildAggro.get(id)?.target).toMatchObject({ kind: "player", id: client.sessionId })`.
   - Mọi `step <= capStep + 1e-6`; `steps[0]` `toBeCloseTo(capStep, 3)` (đang chạy hết tốc, không đứng yên; với code cũ là 8,55 nên test vỡ); tổng độ dời `toBeCloseTo(ALPHA.chaseSpeedMax * 0.5, 1)` (76 px) và `toBeLessThan(PLAYER_SPEED * 0.5)` (80 px). Sau 10 tick còn cách khoảng 74 px nên chưa tới tầm cắn, không gồng.
   - `expect((room as any).alphaReturning.has(id)).toBe(false)` (không lẫn sang nhánh về hang).
2. **"an alpha Voltmouse led past its leash walks home no faster than ALPHA.chaseSpeedMax"**
   - Như test dây giới hạn sẵn có: `pal.x = home.x + ALPHA.leash + 40; pal.y = home.y; player.x = pal.x + 60; player.y = pal.y`.
   - 5 tick đồng bộ. `expect((room as any).alphaReturning.has(id)).toBe(true)`; mọi `step <= capStep + 1e-6`; `steps[0]` `toBeCloseTo(capStep, 3)`.
3. **"a common Scorchtail still chases at the full 1.8x: the cap is only for pack leaders"** (khoá việc không đụng thú thường; Scorchtail 85 × 1,8 = 153 là loài thường duy nhất vượt 152)
   - `room.state.pals.clear(); plantTrees(room, []); player.x = 3200; player.y = 2560;` (chỗ đất liền mà test chạy trốn đang dùng) `id = placeWild(room, "scorchtail", player, 100)`; chặn chiêu như trên; `(room as any).provoke(id, { kind: "player", id: client.sessionId })`.
   - 5 tick đồng bộ. `steps[0]` `toBeCloseTo(getSpecies("scorchtail").speed * WILD_CHASE_SPEED_FACTOR * TICK_MS / 1000, 3)` (7,65) và `toBeGreaterThan(capStep)`.
   - Trùm không cần test mới: `pathing.test.ts:309` đã khoá `boss.speed * WILD_CHASE_SPEED_FACTOR`, và dòng 270/1695 không đổi.

Test sẵn có phải vẫn qua không sửa: "attacks whoever comes close, even a passive kind, and walks home when led too far" (về hang tới `ALPHA.roam` trong 400 tick: 424 px ở 152 px/s mất khoảng 2,8 s = 56 tick, dư nhiều), các test thú đầu đàn khác, `pathing.test.ts`, `combat.test.ts`.

### E2E

Không thêm, không sửa (không đổi giao diện hay giao thức).

## Tiêu chí hoàn thành

- [ ] `ALPHA.chaseSpeedMax` có trong `packages/shared/src/alphas.ts`, viết là `PLAYER_SPEED * 0.95` (không số cứng 152), có JSDoc tiếng Anh nói lý do (không vượt người chơi, không dưới 0,9 vì bắn kéo).
- [ ] `alphaChaseSpeed(speciesSpeed)` là hàm thuần trong `alphas.ts`, export qua `@petgame/shared`, = `Math.min(speciesSpeed * WILD_CHASE_SPEED_FACTOR, ALPHA.chaseSpeedMax)`; không vòng import.
- [ ] `GameRoom.ts`: nhánh về hang dùng `alphaChaseSpeed(species.speed)`; nhánh đuổi dùng nó **chỉ khi `pal.alpha`**, còn lại vẫn `species.speed * WILD_CHASE_SPEED_FACTOR`.
- [ ] `GameRoom.ts:270` và `bossHeadHome` không đổi; `WILD_CHASE_SPEED_FACTOR` vẫn 1,8; `fleeSpeed`, `WILD_FLEE_SPEED_CAP` không đổi (`git diff` chỉ chạm `alphas.ts`, `alphas.test.ts`, `GameRoom.ts` ở 2 dòng tốc độ + import + chú thích, `GameRoom.test.ts`).
- [ ] Unit test mới trong `alphas.test.ts` qua: cap 152, < 160, ≥ 144, bảng 6 thú đầu đàn, dưới ngưỡng không đổi.
- [ ] 3 test tích hợp mới qua, và test đuổi của Voltmouse đầu đàn **vỡ** nếu đảo dòng 794 về code cũ (coder hoặc tester kiểm một lần rồi trả lại, ghi vào `PROGRESS.md`).
- [ ] Mọi test sẵn có qua không sửa; `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` sạch.
- [ ] Không đổi schema, message, `Profile`, client.
- [ ] `docs/design/pals.md` (mục "Thú đầu đàn", "Tính khí") khớp code: tên khoá, tên hàm, số 152, bảng 6 thú.

## Rủi ro, câu hỏi mở

- Không có "CHẶN:". Quyết định nhỏ, đảo ngược được (một hằng số), không đụng dữ liệu lưu.
- **Trận đồng cỏ ngắn** (T7): kẹp không làm trận ngắn hơn hay dài hơn (hạ gục khoảng 8,0 s ở mọi tốc độ 96-171). Nếu sau này thấy Voltmouse đầu đàn nhạt, chỉnh máu hoặc cắn riêng con này là việc khác; không làm trong T58.
- **Thú đi theo kéo mục tiêu:** thú đi theo (190 px/s) nhanh hơn thú đầu đàn, có thể kéo mục tiêu của nó sang mình (`provoke`); không mô phỏng, nhưng không đổi so với trước (trước đây 171 < 190 cũng vậy).
- **Test tích hợp phụ thuộc bố cục:** test 1 đặt người chơi 150 px phía đông hang đồng cỏ; nếu worldgen đổi làm chỗ đó thành biển, dòng `expect(isSea(...)).toBe(false)` báo ngay. Hồ/núi lửa trong `NavGrid` chỉ làm `paths.steer` chọn điểm đi vòng, không làm bước ngắn hơn, nên vẫn đo được tốc độ.
- **Đề xuất việc sau (cho agent chính, tuỳ chọn, ưu tiên thấp):** khi thêm bất kỳ hiệu ứng làm chậm người chơi (đóng băng, trói) hoặc đổi `WILD_CHASE_SPEED_FACTOR`, kiểm lại bảng "Tốc độ đuổi và về hang" trong `docs/design/pals.md`. Không cần thêm nhiệm vụ mới vào `TASKS.md` lúc này.
