# PLAN: T28 Đánh dấu thú đang nhắm

Đọc code ở HEAD `048bc31`. File liên quan:
- `packages/client/src/game/Game.ts`:
  - `PalEntity` dòng 123-129;
  - `$.onAdd("pals")` dòng 427-484;
  - handler `CaptureResult` dòng 717-756;
  - vòng thú hoang trong `frame()` dòng 923-950: tính `aimed` theo luật "gần nhất trong `THROW_RANGE`, không `inBall`";
  - `labels.update(now, aimed)` dòng 1004, `lights()` dòng 1009, `nearestPal` dòng 1118, `throwBall` dòng 1131-1152, `addActor` dòng 1401, `debugInfo` dòng 1412.
- `packages/client/src/game/entities.ts`: `PalActor` dòng 144, `ring`, `aura`.
- `packages/client/src/game/labels.ts`, `labelLayout.ts`: `LABEL_RANK.aimed` là nhãn ghim (T5).
- `packages/client/src/game/stage.ts`: các lớp; vòng ngắm vào `marks`.
- `packages/client/src/game/lighting.ts`: `Light`.
- `packages/shared/src/capture.ts` (`throwBlocker`) và `capture.test.ts`; `packages/shared/src/constants.ts` (`THROW_RANGE` 180, `THROW_COOLDOWN_MS` 800).
- `packages/server/src/rooms/GameRoom.ts`: `handleThrow` dòng 921-953 (kiểm tầm dòng 928, kiểm trong bóng dòng 929), `debug:spawnPal` dòng 409 (có `full: true`).
- `packages/server/src/rooms/GameRoom.test.ts`: `placeWild` dòng 569, test "holds a pal in the ball…" dòng 2137.
- `tests/e2e/multiplayer.spec.ts`: test `labels:` dòng 1039 (hàm `aimedTag` tự tính thú đang nhắm theo luật cũ, dòng 1085-1103), `spawnWeakPal`, `throwingAt`, `sendFrom`, cách ghi lại tin gửi trong test `party:` dòng 1270-1276.
- `scripts/shots.mjs`; `PLAN.md` trong commit kế hoạch T51 (`f550fdf`): số đo "thú lành lặn giành chỗ".

Thiết kế đã ghi vào `docs/design/pals.md` (mục mới "Thú đang nhắm và vòng ngắm", sửa mục "Nhãn tên và thanh máu" và "Đòn đánh và bóng trúng con nào") và một dòng trong `docs/design/hud.md` (mục "Cần điều khiển và nút cảm ứng").

**Ai làm:** **coder**. Vòng ngắm là vài nét `Graphics` vẽ bằng code. Phần lớn việc là logic (hàm thuần dùng chung, chỗ nối trong `Game.ts`, server, test), không có ảnh AI hay sprite. Không cần asset-manager.

## Mục tiêu

Bấm Bắt (cảm ứng) hay E (bàn phím) thì người chơi phải thấy **trước** bóng sẽ bay vào con nào. Hiện nay client đã biết con đó (để ưu tiên nhãn của nó, T5) nhưng không vẽ gì. Thú lành lặn không có nhãn, nên người chơi đứng giữa hai con có thể ném nhầm. Đo ở T51: một Leafkit lành lặn đi ngang, gần hơn 2 px (36 so với 38), giành chỗ của con 1 máu trong khoảng 5 giây. Ném nhầm lúc đó mất 0,8 giây chờ ném lại và 1-1,5 giây bóng lắc, có khi hết luôn 6 giây choáng của con kia, lại còn chọc giận con lành lặn.

Sau T28:
1. Một **vòng ngắm** dưới chân con sẽ bị ném, đọc được ở mọi vùng, ngày và đêm, trên điện thoại và desktop.
2. **Thú bị thương và thú choáng được ưu tiên** khi gần bằng con lành lặn, và con đang nhắm được giữ lại, không nhảy qua lại giữa hai con.
3. **Ném đúng con có vòng.** Client và nút Bắt/E dùng chung một hàm thuần trong `packages/shared`, có test. Client bỏ qua thú đang nằm trong bóng (sửa lỗi T5 để lại), và không nhắm trùm.

## Quyết định: luật ném ở server

Ghi chú của nhiệm vụ nói "ưu tiên thú bị thương là đổi luật ném ở server". Đọc code thì **server không chọn con**. Tin `throw` mang `palId` (`ThrowMessage`), client chọn con. Server chỉ kiểm: con đó còn, chưa hết hồi ném, trong `THROW_RANGE`, không nằm trong bóng, và `throwBlocker` (trùm, túi đầy). Luật ưu tiên vì vậy nằm ở **hàm chọn của client**, đặt trong shared, có test.

Quyết định:
- **Không để server tự chọn lại con** (không đổi `ThrowMessage`, không cho server chọn khi thiếu `palId`). Server thấy vị trí thú khác client tới khoảng 25 px. Nếu server chọn lại theo vị trí của nó, bóng có thể bay vào con khác với con có vòng ngắm, đúng lỗi T28 sửa. Client đã sửa mà gửi id khác cũng không được lợi gì: con nào trong tầm cũng ném được hợp lệ khi bước lại gần.
- **Đổi một chỗ ở server: thêm phần dư tầm ném `THROW_REACH_SLACK` = 32 px.** Client vẽ thú hoang trễ hơn server: nội suy `lerp` 0,137 giây ở 60 khung hình/giây, nửa nhịp patch 0,025 giây, rồi tin ném còn đi mất một chiều mạng. Thú bỏ chạy 96 px/s (trần từ T27), với mạng 50 ms mỗi chiều, thì khi tin ném tới server nó đã xa thêm khoảng 25 px. Tính: 96 × (0,137 + 0,025 + 0,1) = 25,1. Có vòng ngắm rồi thì lần ném vào con có vòng ở mép 180 px mà bị bỏ qua không một lời là lỗi người chơi thấy rõ. 32 px chịu được mạng tới khoảng 90 ms mỗi chiều. Client vẫn chỉ nhắm trong 180 px. Client bị sửa thì ném xa được 212 px, không đáng kể. Giống phần cho sớm 60 ms của lướt (`dash`).
- Không đổi giao thức, schema, hồ sơ lưu game.

## Phạm vi

**Làm:**
- Shared: hằng số `THROW_REACH_SLACK`, bảng `AIM`, kiểu `AimCandidate`, hàm thuần `throwTarget` (chọn thú đang nhắm, có giữ con cũ). Unit test.
- Server: `handleThrow` chấp nhận tới `THROW_RANGE + THROW_REACH_SLACK`. Test tích hợp.
- Client:
  - vòng ngắm `AimMarker` (file mới `aimMarker.ts`);
  - `Game.ts` dùng `throwTarget` cho cả vòng ngắm, nhãn ghim lẫn `throwBall`;
  - thú trong bóng được biết ngay khi có `CaptureResult`;
  - đốm sáng ban đêm;
  - `debugInfo().aim`.
- E2E: test mới `aim:`; sửa `aimedTag` trong test `labels:` để đọc thú đang nhắm của game thay vì tự tính theo luật cũ.
- `npm run shots`: nhóm ảnh mới `aim`.
- Tài liệu: `docs/architecture.md` (coder). `docs/design/` đã sửa.
- Nhân tiện (vì viết lại đúng vòng đó): đổi tên biến `d` bị che trong khối trùm của vòng thú hoang ở `Game.ts`, một mục của T29.

**KHÔNG làm:**
- Không thêm cách tự chọn con (chạm vào thú, phím đổi đích). Ghi là ý sau ở cuối file.
- Không đổi màu vòng theo loại bóng, không làm mờ vòng khi túi đầy (lời từ chối đã nói lý do).
- Không đổi luật đòn đánh (con gần nhất trong tầm vũ khí, server chọn), `nearestPal` của `attack()`, hay `THROW_RANGE`, `THROW_COOLDOWN_MS`, tỉ lệ bắt.
- Không đổi `labelLayout.ts`, `LABEL_RANK`, CSS nhãn. Nhãn ghim vẫn theo thú đang nhắm, chỉ thú đang nhắm được chọn theo luật mới.
- Không làm các mục khác của T29 (test ngẫu nhiên `layoutTags`, thụt lề `shots.mjs`, chú thích `labelLayout.ts`).
- Không tách `Game.ts` (T11). Phần mới đặt trong `aimMarker.ts` để `Game.ts` chỉ thêm ít dòng.

## Thiết kế

### Luật chọn thú đang nhắm (`throwTarget`, shared)

Đầu vào là các `AimCandidate` (id, x, y, hp, maxHp, dizzy, boss, inBall), vị trí người ném `from`, và id con đang nhắm hiện tại (`current`, "" nếu không có).

1. **Ném được:** `!boss && !inBall && distance(from, pal) <= THROW_RANGE` (180, tính cả đúng 180 như server).
2. **Điểm** = khoảng cách thật − thưởng. Thưởng là `AIM.dizzyPx` = 48 nếu `dizzy`, nếu không thì `AIM.hurtPx` = 24 nếu `hp < maxHp`, nếu không thì 0. Không cộng hai thưởng: thú choáng vốn ở 1 máu.
3. **Tốt nhất** = điểm nhỏ nhất. Bằng điểm (chênh dưới 1e-9) thì khoảng cách thật nhỏ hơn, rồi tới con đứng trước trong mảng.
4. **Giữ con cũ:** nếu `current` vẫn ném được và `điểm(current) <= điểm(tốt nhất) + AIM.keepPx` (8) thì trả `current`.
5. Không con nào ném được thì trả `undefined`.

Vì sao các con số (đã ghi ở `docs/design/pals.md`; số tính bằng `captureChance` thật):

| | Leafkit cấp 5 | Voltmouse cấp 5 | Emberpup cấp 5 |
|---|---|---|---|
| Lành lặn | 42% | 23% | 34% |
| Nửa máu | 65% | 54% | 61% |
| Choáng, 1 máu | 92% | 86% | 90% |

- **Choáng 48 px** = `ATTACK_RANGE`. Một con choáng còn trong tầm đánh tay không luôn thắng mọi thú lành lặn (điểm ≤ 0). Đây là lúc mẹo trong game bảo "bấm Bắt để dễ bắt", và chỉ kéo dài 6 giây.
- **Bị thương 24 px:** phủ trường hợp T51 (lành lặn 36, bị thương 38: điểm 36 so với 14) và mọi chênh lệch tới 24 px. Con lành lặn sát chân (gần hơn quá 24 px) vẫn thắng, nên người chơi muốn ném nó thì bước lại gần.
- **Giữ 8 px:** vị trí nội suy rung 1-2 px mỗi khung, nên không có giữ thì vòng ngắm và nhãn ghim lật qua lật lại khi hai con đứng gần bằng nhau (T51 thấy nhãn xếp lại vì đổi thú đang nhắm). Thú lang thang nhanh nhất 95 px/s cần ít nhất khoảng 0,1 giây để hơn 8 px, nên người chơi bước hẳn sang con khác thì vòng đổi gần như ngay.

Ví dụ (unit test phải có):

| Cảnh | Cũ | Mới |
|---|---|---|
| lành 36, bị thương 38 (T51) | lành | bị thương (14 < 36) |
| lành 10, bị thương 40 | lành | lành (10 < 16) |
| lành 5, choáng 48 | lành | choáng (0 < 5) |
| lành 100, choáng 150 | lành | lành (100 < 102) |
| trùm 20, Leafkit 100 | trùm (bị từ chối) | Leafkit |
| Leafkit trong bóng 20, Leafkit 60 | trong bóng (server bỏ qua) | Leafkit 60 |

### Ném (`throwBall`, client)

- Ném vào **đúng con có vòng ngắm ở khung vừa vẽ** (`this.aimedId`). Phải là nó: thứ người chơi thấy là thứ bị ném.
  - Con đó không còn trong `this.pals`, hoặc vừa vào bóng (`now < heldUntil`, mục dưới), thì coi như không có con nào.
  - Con đó còn mà khung sau sẽ bị loại vì vị trí đổi thì vẫn ném: lệch tối đa một khung, dưới 2 px, server có phần dư.
- **Không có con nào:**
  - trong `THROW_RANGE` có trùm (`this.bossId`) thì báo `throwBlocker(0, { boss: true })`, tức "Không thể bắt trùm! Hãy cùng nhau hạ nó", mức `low`, giữ lời giải thích cũ cho người bấm Bắt cạnh trùm;
  - không thì "Không có thú nào ở gần" (`low`, như cũ).
- Có con: như cũ. `throwBlocker(partySize, wild)` cho túi đầy, rồi gửi `Throw` với `palId`, quay mặt, hoạt ảnh ném.

### Thú trong bóng ở client

Server đặt `inBall` lúc ném, bỏ khi bóng mở. Client hiện chỉ đặt `entity.inBall` (để ẩn hình) sau `BALL_FLIGHT_MS` kể từ lúc nhận `CaptureResult`, và nhắm thì bỏ qua cờ này, còn `throwBall` thì không.

Thêm `PalEntity.heldUntil` (ms của `performance.now()`, mặc định 0). Đặt ngay đầu handler `CaptureResult`, cho **mọi người ném** (người khác ném thì vòng của mình cũng rời con đó):
- trượt: `heldUntil = performance.now() + captureRevealMs(msg.shakes)`;
- bắt được: `heldUntil = Infinity`, vì con đó sắp bị xoá khỏi state, tin có thể tới trước patch.

Chỉ đặt khi con đó còn trong `this.pals`. Khi nhắm, `AimCandidate.inBall = pal.inBall || now < pal.heldUntil`. Client giữ lâu hơn server một chút (tính từ lúc nhận, không phải lúc ném), nên không bao giờ nhắm vào con server còn giữ trong bóng.

### Vòng ngắm (`AimMarker`, client)

Hình (khớp `docs/art-style.md`: viền mảnh đậm cùng tông, không đen, hoạt hình), vẽ **một lần** lúc khởi tạo vào một `Graphics`:
- Tâm (0, 0), bán kính gốc `R = 24` (px thế giới).
- **4 cung tròn** tâm ở 45°, 135°, 225°, 315°, mỗi cung dài 52° (±26°). Vẽ hai lượt cho mỗi cung, mỗi cung một path riêng (`moveTo` tới điểm đầu cung trước `arc`) để không có nét nối giữa các cung:
  - viền: nét 6 px, màu `0x5a3d2b` (nâu đậm), alpha 0,5, `cap: "round"`;
  - lõi: nét 3,5 px, màu `0xfff4d6` (kem), alpha 1, `cap: "round"`.
- **4 mũi tam giác** ở 0°, 90°, 180°, 270° (giữa các cung), chĩa vào trong. Đỉnh ở bán kính `R − 5`, đáy ở bán kính `R + 3`, nửa bề rộng đáy 4 px. Tô kem, viền nâu 1,5 px alpha 0,7.
- Cây hiển thị: `root: Container` (trong `stage.marks`) chứa `spin: Graphics`.
  - `root.scale = (s, s × 0,5)`: dẹt theo mặt đất. Bóng là 0,36, vòng thú đi theo 0,4; 0,5 hơi tròn hơn để nét trên và dưới không quá mảnh.
  - `spin.rotation = t × 0,8` rad/giây: các cung chạy dọc theo hình elip trên mặt đất. Xoay con bên trong cha bị dẹt, nên không phải vẽ lại.
- **Cỡ:** bán kính trên đất `r = max(22, 0,6 × bodyHeight)`, với `bodyHeight = sprite.height × scale` (chưa cộng 10 px bay), và `s = r / R`:
  - Voltmouse (cao 37) 22,2;
  - Leafkit (43) 25,8;
  - Boulderhorn (62) 37,2;
  - Boulderhorn đầu đàn (×1,6) 59,5, lớn hơn quầng vàng (54,6).

  Ở điện thoại dọc (zoom 0,886), Leafkit có vòng rộng khoảng 46 px CSS. Vòng lớn hơn bóng (0,31) và vòng thú đi theo (0,42).
- **Chuyển động**, không tạo object nào:
  - thở: `s × (1 + 0,05 × sin(t × 5))`;
  - **khoá đích**: khi id đổi (hoặc vòng vừa hiện), `lockAt = now`, `k = min(1, (now − lockAt) / 160)`, cỡ nhân `1 + 0,5 × (1 − k)²`, `root.alpha = 0,35 + 0,65 × k`.
- **Ban đêm:** `Game.lights()` thêm **một** object `Light` dùng lại (`{ x, y, radius: 56, color: 0xfff4d6, strength: 0,6 }`, chỉ sửa x, y) khi vòng đang hiện.
  - Đèn lồng của người chơi bán kính 210 nhưng mờ dần, nên ở 150-180 px con thú và vòng bị phủ gần hết màu đêm (`NIGHT` 0,2/0,25/0,46).
  - Vòng nằm dưới lớp đêm (`overlay` nhân màu), nên phải được chiếu sáng chứ không vẽ đè lên lớp đêm.
- **Ẩn khi:**
  - không có thú đang nhắm;
  - `!this.watch.online` (mất kết nối thì cũng không ném được);
  - không có `me()`.
- **Hiệu năng:**
  - một `Container` và một `Graphics` cho cả thế giới (không phải mỗi thú một cái);
  - mỗi khung chỉ gán số (`position.set`, `scale.set`, `rotation`, `alpha`, `visible`);
  - không nằm trong `stage.objects` nên không vào số sprite của `debugInfo().objects`;
  - `destroy()` khi game huỷ (nếu `Game` có đường huỷ; không có thì không cần thêm).

Các số hiển thị là hằng số trong bảng `AIM_MARKER` ở đầu `aimMarker.ts`, có JSDoc. Chúng chỉ là hình ảnh, không phải cân bằng, nên để ở client.

### Cảm ứng và bàn phím

- Không có nút hay phím mới. Nút Bắt (`.btn-capture`, chạy lúc `pointerdown`) và phím E cùng gọi `throwBall`, nên cùng ném vào con có vòng.
- Vòng giúp nhất ở điện thoại: hình nhỏ, nhãn chen nhau.
- Chữ không đổi: "Không có thú nào ở gần", "Không thể bắt trùm! Hãy cùng nhau hạ nó", "Túi thú đầy…".

## Kế hoạch triển khai

1. **`packages/shared/src/constants.ts`**: ngay dưới `THROW_RANGE` thêm
   `export const THROW_REACH_SLACK = 32;`
   JSDoc (tiếng Anh): the server accepts a throw this much beyond `THROW_RANGE`, because the client draws wild pals about 0.25 s late (interpolation, patch rate, the throw's trip), and a fleeing pal (96 px/s) moves about 25 px in that time; clients only aim within `THROW_RANGE`.

2. **`packages/shared/src/capture.ts`** (import `THROW_RANGE` từ `./constants.ts`, `distance` (có export ở `movement.ts` dòng 87) và `type Vec2` từ `./movement.ts`):
   - `export const AIM = { dizzyPx: 48, hurtPx: 24, keepPx: 8 } as const;` Mỗi trường một JSDoc ngắn, kèm lý do và trỏ tới `docs/design/pals.md`, mục "Thú đang nhắm và vòng ngắm".
   - `export interface AimCandidate { id: string; x: number; y: number; hp: number; maxHp: number; dizzy: boolean; boss: boolean; inBall: boolean }`. JSDoc: the client keeps one per wild pal and updates it in place every frame.
   - `export function aimScore(from: Vec2, pal: AimCandidate): number`: điểm theo luật 1-2, `Infinity` khi không ném được.
   - `export function throwTarget(from: Vec2, pals: readonly AimCandidate[], count: number, current = ""): AimCandidate | undefined`:
     - luật 3-5, chỉ xét `pals[0..count)`;
     - một vòng lặp, không tạo mảng hay object;
     - trả về đúng object trong mảng.
   - Đã export qua `index.ts` (`export * from "./capture.ts"`).

3. **`packages/shared/src/capture.test.ts`**: `describe("throwTarget")`, mục Test.

4. **`packages/server/src/rooms/GameRoom.ts`**, `handleThrow` dòng 928: `if (distance(player, pal) > THROW_RANGE + THROW_REACH_SLACK) return;` kèm chú thích một dòng: clients aim within THROW_RANGE but see pals late. Import `THROW_REACH_SLACK`. Không đổi thứ tự các kiểm khác (`inBall`, hồi ném, `lastThrowAt`, `throwBlocker`).

5. **`packages/server/src/rooms/GameRoom.test.ts`**: `describe("throwing at the aimed pal")`, mục Test.

6. **`packages/client/src/game/entities.ts`**, `PalActor`: thêm getter `get bodyHeight(): number { return this.sprite.height * this.scale; }`, có JSDoc (cỡ thân không tính độ bay, cho vòng ngắm).

7. **`packages/client/src/game/aimMarker.ts`** (mới): `export const AIM_MARKER = {...}` (mọi số ở mục "Vòng ngắm") và `export class AimMarker`:
   - `constructor(layer: Container)`: vẽ `Graphics` một lần, `visible = false`;
   - `show(id: string, x: number, y: number, bodyHeight: number, now: number)`: gọi mỗi khung khi có đích; id khác lần trước, hoặc vòng đang ẩn, thì đặt `lockAt = now`;
   - `hide()`;
   - getter `shown`, `id`, `x`, `y` cho `debugInfo` và đốm sáng;
   - `destroy()`.

   JSDoc của class nói vòng là gì và vì sao một object dùng chung.

8. **`packages/client/src/game/Game.ts`**:
   1. `PalEntity`: thêm `aim: AimCandidate` và `heldUntil: number` (JSDoc). Trường của `Game`:
      - `aimMarker!: AimMarker`;
      - `aimedId = ""`;
      - `aimPool: AimCandidate[] = []` (dùng lại mỗi khung);
      - `aimLight: Light` (một object).

      Tạo `aimMarker` trong `init()` sau `this.effects` (lớp `this.stage.marks`).
   2. `$.onAdd("pals")`: tạo `entity.aim = { id, x, y, hp, maxHp, dizzy, boss: pal.boss, inBall: false }` và `heldUntil: 0`. Trong `onChange`, cập nhật `entity.aim.hp`, `maxHp` và `dizzy` (chỗ `dizzy = pal.dizzy`).
   3. Handler `CaptureResult`: ngay đầu, nếu `this.pals.get(msg.palId)` có thì đặt `heldUntil` như mục "Thú trong bóng ở client".
   4. Vòng thú hoang trong `frame()`:
      - bỏ `aimed`, `aimedDist`;
      - với con `near && !pal.inBall`: gán `pal.aim.x/y = actor.pos`, `pal.aim.inBall = now < pal.heldUntil`, rồi `this.aimPool[n++] = pal.aim`;
      - đổi tên `d` bên trong khối trùm thành `bossDist` (mục T29);
      - sau vòng: `const target = focus && this.watch.online ? throwTarget(focus, this.aimPool, n, this.aimedId) : undefined; this.aimedId = target?.id ?? ""; const aimed = target && this.pals.get(target.id);`;
      - có `aimed` thì `this.aimMarker.show(...)` với `aimed.actor.pos` và `aimed.actor.bodyHeight`, không thì `hide()`;
      - `this.labels.update(now, aimed?.tag)` thay cho `aimed`.

      Vòng ngắm phải đặt **sau** khi vị trí thú đã nội suy trong khung đó, để không trễ một khung.
   5. `lights()`: `if (this.aimMarker.shown)` thì sửa `this.aimLight.x/y` (y lấy chân thú − 4) rồi push.
   6. `throwBall()`: viết lại phần chọn con như mục "Ném". Bỏ `nearestPal` khỏi `throwBall` (vẫn giữ cho `attack()`).
   7. `debugInfo()`: thêm `aim: { id: this.aimedId, shown: this.aimMarker.shown, x: this.aimMarker.x, y: this.aimMarker.y }`.
   8. Sửa chú thích cũ dòng 923 ("the client's throwBall also counts pals in a ball") cho đúng.

9. **`tests/e2e/multiplayer.spec.ts`**: test mới `aim:` và sửa `aimedTag` của test `labels:` (mục Test). Thêm helper `spawnFullPal(page, species)`, giống `spawnWeakPal` nhưng gửi `{ species, full: true }` và tìm con mới có `hp === maxHp`. Cập nhật mô tả helper ở `docs/architecture.md`.

10. **`scripts/shots.mjs`**: nhóm mới `aim` (`--only aim`; chạy mặc định cùng `world`, `labels`).
    - **Desktop 1280×720**, các cảnh:

      | Ảnh | Vị trí | Giờ |
      |---|---|---|
      | `aim-meadow` | 3200, 2470 | 0,3 |
      | `aim-meadow-night` | 3200, 2470 | 0,85 |
      | `aim-snow` | 3200, 1180 | 0,3 |
      | `aim-desert` | 3200, 3650 | 0,3 |
      | `aim-swamp` | 1520, 2400 | 0,3 |
      | `aim-volcano-night` | 4700, 2400 | 0,85 |

      Mỗi cảnh:
      - teleport `(x, y)`, sinh một con yếu (`debug:spawnPal`, loài theo vùng), nằm ở `(x+40, y)`;
      - teleport `(x−40, y+30)`, sinh một con lành (`{ full: true }`), nằm ở `(x, y+30)`;
      - teleport về `(x, y)`, `settle`, chờ khoảng 600 ms, chụp.
    - **Điện thoại:** `aim-phone` (iPhone 13 dọc) và `aim-phone-landscape` (`devices["iPhone 13 landscape"]`), cảnh đồng cỏ ban ngày, cùng cách đặt.
    - Mỗi ảnh ghi vào `report`: số sprite, `aim.shown`, và `aim.id` có phải con yếu không (in `aim ✓` hoặc `aim ✗`).
    - Đóng context sau nhóm như các nhóm khác. Không đổi các ảnh đang có của nhóm `world`, `labels`.

11. **`docs/architecture.md`**:
    - dòng `capture.ts`: thêm `throwTarget`, `AIM`, `AimCandidate`;
    - dòng `constants.ts`: thêm `THROW_REACH_SLACK`;
    - mục client: thêm `game/aimMarker.ts` (vòng ngắm, một object dùng chung, lớp `marks`) và `debugInfo().aim`;
    - mục server: `handleThrow` có phần dư tầm;
    - mục Kiểm thử: helper `spawnFullPal`, nhóm `aim` của `npm run shots`, và "thú đang nhắm đọc từ `debugInfo().aim`, không tự tính".

## Giao thức

- Không đổi `schema.ts`, `messages.ts`, `Profile`. `ThrowMessage` giữ nguyên `{ palId, ball }`.
- Server chỉ nới kiểm tầm ném từ 180 lên 212 px (`THROW_RANGE + THROW_REACH_SLACK`). Client cũ, chưa cập nhật, vẫn chạy đúng.
- Client chọn con khác trước (ưu tiên bị thương/choáng, bỏ trùm và thú trong bóng) nhưng vẫn gửi đúng tin cũ.

## Test

**Unit, `packages/shared/src/capture.test.ts`**, `describe("throwTarget")`. Dựng ứng viên bằng một hàm nhỏ `pal(id, dx, dy, extra?)` quanh `from = {x: 0, y: 0}`, mặc định `hp = maxHp = 40`.
1. Thú lành lặn: chọn con gần nhất. Đúng 180 px vẫn chọn (`THROW_RANGE`), 180,5 px thì không. Không con nào thì `undefined`.
2. Bỏ trùm và thú trong bóng dù chúng gần nhất. Chỉ có chúng thì `undefined`.
3. Bảng ví dụ ở mục Thiết kế, từng dòng:
   - T51: lành 36, bị thương 38 → bị thương;
   - lành 10, bị thương 40 → lành;
   - lành 5, choáng 48 → choáng;
   - lành 100, choáng 150 → lành;
   - choáng và bị thương cùng 60 px → choáng;
   - thú choáng ở 1 máu chỉ nhận thưởng choáng (điểm = d − 48, không phải d − 72).
4. Giữ con cũ:
   - `current` hơn kém tối đa `AIM.keepPx` thì giữ;
   - con khác hơn quá `keepPx` (ví dụ 8,5) thì đổi;
   - `current` không còn ném được (vào bóng, ra ngoài 180, không có trong mảng, là trùm) thì bỏ ngay, dù không con nào hơn nó;
   - `current = ""` thì như không giữ.
5. Bằng điểm thì con gần hơn thật thắng; bằng cả hai thì con đứng trước trong mảng.
6. `count`: phần tử từ `count` trở đi bị bỏ qua (mảng dùng lại còn đồ cũ ở đuôi).
7. Trả về đúng object trong mảng (`toBe`, không phải bản sao).
8. Ngẫu nhiên có seed cố định (hàm `mulberry32` hoặc LCG nhỏ trong test): 500 cảnh × 1-12 con, vị trí, máu, choáng, trùm, trong bóng ngẫu nhiên, có hoặc không có `current`. Kiểm:
   - kết quả (nếu có) ném được;
   - không con nào có điểm nhỏ hơn điểm kết quả quá `keepPx`, và khi không có `current` thì không con nào nhỏ hơn hẳn;
   - `undefined` chỉ khi không con nào ném được.
9. `aimScore`: `Infinity` cho trùm, thú trong bóng, thú ngoài tầm; đúng `d − 48` / `d − 24` / `d`.

**Tích hợp, `packages/server/src/rooms/GameRoom.test.ts`**, `describe("throwing at the aimed pal")`:
1. **"the ball goes at the pal throwTarget picks from the server's view: a hurt pal 2 px farther wins over a healthy one"**:
   - `room.state.pals.clear()`; `healthy = placeWild(room, "leafkit", player, 36)`; `hurt = placeWild(room, "leafkit", player, -38)`, rồi `hurt.hp = maxHp − 5`;
   - dựng `AimCandidate` từ `room.state.pals`, với `inBall` từ `(room as any).inBall.has(id)`; `throwTarget(player, cands, cands.length)` phải là `hurt`;
   - `vi.spyOn(Math, "random").mockReturnValue(0.999)`, gửi `Throw` với id đó: `CaptureResult.palId === hurt`, `success === false`;
   - dựng lại ứng viên: giờ `throwTarget` trả `healthy` (con kia đang trong bóng).
2. **"accepts a throw a little beyond THROW_RANGE (the client sees pals late), refuses one beyond the slack"**:
   - một Leafkit đứng yên ở `THROW_RANGE + THROW_REACH_SLACK − 2`: có `CaptureResult` (chờ tối đa 2000 ms);
   - `ticks(room, 20)` cho hết hồi ném;
   - con khác ở `THROW_RANGE + THROW_REACH_SLACK + 4`: sau `ticks(room, 6)` không có `CaptureResult` nào cho nó (`collect`), `inBall` không có nó, và `controls.get(sessionId).lastThrowAt` không đổi (lần bị từ chối vì tầm không tốn lượt).
3. Test "holds a pal in the ball…" (dòng 2137) và mọi test ném khác giữ nguyên, phải qua.

**E2E, `tests/e2e/multiplayer.spec.ts`**:
1. **Test mới** `"aim: the ring marks the hurt pal over a closer healthy one; Bắt and E throw where it shows, never at a pal in a ball"`:
   - **Thiết bị:** điện thoại 390×844, `hasTouch`, `isMobile`, giống test `labels:`; `test.slow()`.
   - **Đặt cảnh:**
     - teleport `F = (3200, 2470)`, `weakId = spawnWeakPal(page, "leafkit")` (nằm ở F + (40, 0));
     - teleport `(3160, 2500)`, `fullId = spawnFullPal(page, "leafkit")` (nằm ở `(3200, 2500)`, cách F 30 px);
     - teleport F, chờ `debugInfo().me` cách F dưới 3 px.
   - **Điều kiện trước** (đọc vị trí `actor.pos` của hai con): con lành **gần hơn** con yếu. Luật cũ sẽ chọn con lành, nên test phân biệt được luật cũ và mới. Sai thì báo lỗi có số, không bỏ qua.
   - `expect.poll(aim, 5 s)`: `{ id: weakId, shown: true }`, và `(x, y)` của vòng cách `actor.pos` của con yếu dưới 1 px.
   - **Cài trong trang trước khi bấm:**
     - ghi mọi `room.send` vào `__sent` dạng `[type, message]`;
     - `room.onMessage("captureResult", …)`, kiểm `ServerMessage.CaptureResult` trong `messages.ts`: khi tin của `weakId` tới, một vòng `requestAnimationFrame` ghi `debugInfo().aim.id` của **3 khung kế tiếp** vào `__aimAfter`.
   - **Chạm** `.btn-capture` (`tap()`): poll `__sent` có `["throw", { palId: weakId, … }]`.
   - Poll `__aimAfter.length >= 3`: không phần tử nào là `weakId`.
     - Lý do kiểm ngay 3 khung đầu: client giữ con đó ít nhất `captureRevealMs(1)` = 1,06 giây kể từ lúc nhận tin (bắt được thì nó bị xoá), dư cho 3 khung cả khi WebGL chạy phần mềm.
     - Sau lúc đó con yếu có thể thoát bóng và lại được nhắm, đúng thiết kế, nên không kiểm lâu hơn.
   - **Phím E:** đọc `aim.id` ngay trước (`A`, không rỗng), `page.keyboard.press("e")`, poll tin `throw` cuối cùng trong `__sent` có `palId === A`. Hai con debug đứng yên 60 giây và có phần giữ 8 px, nên `A` không đổi trong khoảng đó. Nếu `A` rỗng thì đó là lỗi: con lành vẫn trong 30 px.
   - Không chờ kết quả bắt (may rủi).
2. **Sửa test `labels:`** (dòng 1083-1103): `aimedTag` đọc `game.debugInfo().aim.id` rồi lấy `game.pals.get(id).tag.element`, không tự tính "gần nhất" nữa (luật đã đổi). Không có id thì trả `null` như cũ (poll sẽ thất bại nếu cảnh có thú bị thương mà không có thú đang nhắm). Giữ đủ ba ý: có thú đang nhắm, độ mờ "1", bị thương thì thanh máu hiện. Không nới hạn 2 giây.
3. Các test `party:` (E khi túi đầy), "a captured pal follows…" (ném theo id qua `throwingAt`) phải vẫn qua, không sửa.

**Ảnh:** `npm run shots -- --name t28 --only aim`, xem 8 ảnh:
- vòng thấy rõ trên cỏ, tuyết, cát, đầm lầy, đá núi lửa đêm, đồng cỏ đêm;
- ở điện thoại dọc và ngang, vòng không bị nút HUD che;
- `aim ✓` ở cả 8.

Chạy thêm `npm run shots -- --name t28` (cả bộ): số sprite của các ảnh `world` không tăng quá 2 so với trước.

## Tiêu chí hoàn thành

- [ ] `throwTarget`, `aimScore`, `AIM`, `AimCandidate` trong `packages/shared/src/capture.ts`; `THROW_REACH_SLACK` = 32 trong `constants.ts`. Đủ 9 nhóm unit test ở mục Test, có test ngẫu nhiên seed cố định.
- [ ] Client dùng **cùng một lần gọi** `throwTarget` cho vòng ngắm, nhãn ghim (`labels.update`) và `throwBall`. `throwBall` không còn gọi `nearestPal`. Không có luật "gần nhất" thứ hai cho bóng ở client.
- [ ] `throwBall` không bao giờ gửi `throw` cho thú đang trong bóng (theo `heldUntil`) hay cho trùm.
  - Chỉ có trùm trong tầm: báo "Không thể bắt trùm! Hãy cùng nhau hạ nó".
  - Không có gì trong tầm: "Không có thú nào ở gần".
- [ ] `heldUntil` đặt khi nhận `CaptureResult` của **bất kỳ** người ném nào.
- [ ] Server: `handleThrow` chấp nhận tới `THROW_RANGE + THROW_REACH_SLACK`. Lần bị từ chối vì tầm không đổi `lastThrowAt`. Có 2 test tích hợp mới, mọi test cũ vẫn qua.
- [ ] Vòng ngắm đúng mô tả ở mục Thiết kế:
  - 4 cung kem viền nâu cùng 4 mũi chĩa vào, dẹt 0,5, xoay 0,8 rad/s, thở ±5%, khoá đích 160 ms;
  - bán kính `max(22, 0,6 × bodyHeight)`;
  - một object cho cả thế giới, trong `stage.marks`, vẽ `Graphics` một lần; mỗi khung không tạo object, mảng hay closure mới (trong `frame()`, `throwTarget`, `AimMarker.show`);
  - ẩn khi không có đích, mất kết nối, không có `me()`.
- [ ] Ban đêm có đốm sáng 56 px ở chân thú đang nhắm (một object `Light` dùng lại).
- [ ] `debugInfo().aim` có `{ id, shown, x, y }`.
- [ ] E2E `aim:` qua 3 lần liền (`--repeat-each=3 --workers=1`). `labels:` dùng `debugInfo().aim` và vẫn qua. Cả bộ e2e qua.
- [ ] `npm run typecheck`, `npm test`, `npm run build` sạch.
- [ ] `npm run shots -- --only aim`: 8 ảnh, `aim ✓` cả 8, vòng đọc được ở mọi ảnh (tester/reviewer xem ảnh). Số sprite các ảnh `world` không tăng quá 2.
- [ ] `docs/architecture.md` cập nhật như bước 11. Thiết kế khớp `docs/design/pals.md` mục "Thú đang nhắm và vòng ngắm" (số và chữ giống nhau).
- [ ] Biến `d` bị che trong khối trùm của vòng thú hoang đã đổi tên.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

1. **Ưu tiên có thể ngược ý người chơi:** người chơi muốn ném con lành lặn ở 60 px trong khi con bị thương ở 80 px. Vòng ngắm cho thấy ngay, và bước lại gần hơn khoảng 12 px là đổi được. Chấp nhận. Nếu chơi thử thấy phiền, các nút chỉnh là `AIM.hurtPx` 16, hoặc thêm "chạm vào thú để nhắm" (ý sau).
2. **`room.onMessage` thêm listener trong e2e:** đã kiểm `node_modules/@colyseus/sdk/build/Room.mjs` dòng 61 và 171. `onMessage` dùng `createNanoEvents().on(...)`, nên thêm listener không thay handler của game. Nếu đổi bản SDK làm điều này sai, có cách khác: bắt đầu ghi 3 khung khi `game.pals.get(weakId)?.heldUntil > performance.now()` hoặc khi con đó rời `game.pals`.
3. **Nét `Graphics` bị dẹt 0,5:** nét trên và dưới vòng mảnh còn khoảng 1,75 px thế giới. Ở điện thoại dọc là khoảng 1,6 px CSS cho phần lõi kem, có viền nâu 3 px quanh. Nếu ảnh `aim-phone` cho thấy khó đọc, coder được tăng lõi lên 4 px và viền lên 7 px, ghi vào `PROGRESS.md`. Không đổi hình dạng.
4. **Đốm sáng làm lộ thú ban đêm:** đó là điều muốn (thấy con sẽ ném). Bán kính 56 px chỉ phủ con đó.
5. **Đụng T29:** T29 còn các mục khác ở `labelLayout.ts`, `shots.mjs`. Ở đây chỉ thêm nhóm mới vào `shots.mjs`, không sửa khối `try` của `worldShots`, để T29 vẫn làm riêng được.

## Đề xuất cho TASKS.md (agent chính cập nhật)

- **T29:** bỏ mục "đổi tên biến `d` bị che trong vòng tính thú đang nhắm ở `Game.ts`" khi T28 xong (làm ở bước 8.4).
- **Ý sau (P3, không gấp):** "Chọn thú để ném": chạm vào một thú hoang trong tầm (cảm ứng), hoặc phím Tab/F để đổi đích (bàn phím), thì vòng ngắm chuyển sang con đó cho tới khi nó ra khỏi tầm. Chỉ cần nếu chơi thử thấy ưu tiên của T28 chưa đủ.
