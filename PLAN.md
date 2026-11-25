# PLAN: T22 Dọn `GameRoom.test.ts` sau T17

Code đọc ở `41118e7` ("Mark T44 done, add T88, start T22"). Nguồn:
- dòng T22 trong `TASKS.md`;
- `REVIEW.md` của commit T53 `58cc5df` (mục "Góp ý không bắt buộc");
- `packages/server/src/rooms/GameRoom.test.ts`, `packages/shared/src/worldgen.test.ts`;
- `packages/server/src/systems/camp.ts` (`eat`), `systems/skills.ts` (`wildSkill`);
- `packages/server/src/http.test.ts`, `worldLimits.test.ts`;
- mã nguồn `@colyseus/core` `Room.mjs` (`setTimestep`), `@colyseus/timer` `ClockTimer.mjs`, `@colyseus/clock` `index.mjs`, `@colyseus/testing` `Room.ext.mjs`.

Số dòng có thể trôi: tìm theo tên.

**Người làm: coder.** Chỉ sửa test (và một câu tài liệu). **Không đổi hành vi sản phẩm, không thêm hook sản phẩm nào**: phần cần đồng hồ ổn định dùng chính trường `now` của đồng hồ Colyseus.

**Không được sửa** `tests/e2e/multiplayer.spec.ts`, `packages/client/src/game/labelLayout.ts`, `labelLayout.test.ts`. Không chạy `git stash`.

## Mục tiêu

Người chơi không thấy gì khác. Đây là việc giữ cho bộ test server đáng tin:
- test hỏng thì báo đúng chỗ, bằng một `expect` có lời, không phải "Test timed out";
- một test không vô tình gỡ mock của test khác;
- nhóm test ăn quả mọng không còn phụ thuộc đồng hồ thật, nên không chập chờn khi máy bận;
- bỏ vài chỗ thừa mà reviewer T53 đã chỉ.

**Sau T10 các helper không dời đi đâu.** `rollFor`, `spawnWith`, `bootTestServer`, test thú hoang tung chiêu và `describe("eating berries")` đều vẫn nằm trong `packages/server/src/rooms/GameRoom.test.ts`. T10 chỉ tách `GameRoom.ts`. Logic ăn nay nằm ở `systems/camp.ts` (`Camp.eat`, gọi qua cửa test `room.eat`), logic chiêu thú hoang ở `systems/skills.ts` (`Skills.wildSkill`).

## Phạm vi

**Làm:**
1. JSDoc của `rollFor` nói rõ hàm ném lỗi, và thêm một dòng test chứng minh điều đó.
2. `spawnWith` chỉ gỡ spy của chính nó.
3. Test thú hoang tung chiêu: hạ 160 tick xuống 20 và kiểm có chiêu bằng `expect` có lời.
4. `bootTestServer`: bỏ `as AddressInfo` và import thừa. Cùng mẫu chép ở `worldLimits.test.ts` và `http.test.ts` cũng bỏ cast (lý do ở Thiết kế 4).
5. `worldgen.test.ts`: viết lại chú thích hạn chạy cho đúng số thế giới.
6. `describe("eating berries")`: đồng hồ của phòng tiến đúng `TICK_MS` mỗi tick (helper `steadyClock`), nên hai test dùng mốc thời gian không còn phụ thuộc đồng hồ thật.
7. Một câu trong `docs/architecture.md` (mục `npm test`) nói về `steadyClock`.

**KHÔNG làm:**
- Không sửa file nào trong `packages/*/src` ngoài file `*.test.ts`, trừ `docs/architecture.md`.
- Không đổi các `vi.restoreAllMocks()` khác trong `GameRoom.test.ts`: TASKS chỉ nêu `spawnWith`, và `afterEach` vẫn gỡ mọi spy sau mỗi test.
- Không đổi giới hạn 40 tick của test anh em ("a common wild pal's skill is no stronger…"): 40 tick ≈ 2 s, đã dưới hạn 5 s mặc định, nên lỗi ở đó vẫn hiện trong `expect`.
- Không nới ngưỡng nào (500 ms, `EAT_COOLDOWN_MS`, `TICK_MS`) và không tăng hạn chạy nào.
- Không động tới test trùm chập chờn mà reviewer T53 nêu (`boss movement`): đó là việc khác.

## Thiết kế

### 1. `rollFor` (trong `describe("day and night")`)

Hàm đã ném `Error("no roll picks <loài> in the <biome> by day|at night")` khi không có roll nào trong 1000 roll cho ra loài đó, nhưng JSDoc chưa nói. Thêm vào JSDoc một câu tiếng Anh, đại ý: *Throws when none of the 1000 rolls picks `speciesId` there (it does not live in that biome at that hour), so a changed spawn table fails here with that message rather than later as the wrong pal.*

Để lời đó có kiểm chứng, trong test `syncs the time of day and spawns night pals at night`, ngay sau dòng tính `roll`, thêm:

```ts
expect(() => rollFor("mothlume", { biome: biomeAt(layout, at.x, at.y), night: false })).toThrow(/no roll picks mothlume/);
```

Cùng test đó đã khẳng định "Mothlume only comes out at night", nên dòng này đúng với dữ liệu hiện có.

### 2. `spawnWith`

Hiện tại `spawnWith` gọi `vi.spyOn(Math, "random")` rồi `vi.restoreAllMocks()` trong `finally`. Cách này gỡ luôn mọi spy khác mà test đang dựa vào (nay chưa có, nhưng là bẫy cho người sửa sau). Sửa:

- `const spy = vi.spyOn(Math, "random").mockReturnValue(draw);`
- `try { return (room as any).spawnPal({ ...at }); } finally { spy.mockRestore(); }`

Sau lần gọi `spawnWith` đầu tiên, thêm `expect(vi.isMockFunction(Math.random)).toBe(false);`: spy của chính nó đã được gỡ, nên các roll sau trong phòng là roll thật.

### 3. Test "wild pals cast too: their skill lands where the target stood, so stepping away dodges it"

`wildSkill` (`systems/skills.ts`) chỉ tung chiêu khi `Math.random() <= 0.06`. Với `Math.random` mock về 0, con `emberpup` cấp 8 đứng cách 120 px (tầm Ember 150) đã bị `provoke` sẽ tung chiêu ở tick đầu tiên nó xét. TASKS ghi "trong 2 tick"; tester đo lại (mục Test).

Vấn đề: vòng `for (let i = 0; i < 160 && casts.length === 0; i++)` chờ thật 160 × 50 ms = 8 s. Hạn mặc định của Vitest là 5 s (`vitest.config.ts` không đặt `testTimeout`). Nếu chiêu không bao giờ ra, test hết giờ ở khoảng tick 100, và `expect` không bao giờ chạy.

Sửa:
- Hằng cục bộ `const CAST_WITHIN_TICKS = 20;`, kèm chú thích tiếng Anh: with every draw at 0 it casts on its first fighting tick (measured: N ticks); 20 ticks is 1 s, well inside the 5 s test limit, so a pal that never casts fails at the `expect` below, not as a timeout.
- Vòng lặp dùng `CAST_WITHIN_TICKS`.
- Ngay sau `vi.restoreAllMocks()` của test, thêm `expect(casts.length, "a provoked wild pal with every draw at 0 casts within CAST_WITHIN_TICKS ticks").toBeGreaterThan(0);`, rồi mới `const cast = casts[0];`.

Chọn 20 vì nó chừa khoảng 10 lần so với 2 tick đo được, mà vẫn chỉ tốn 1 s khi hỏng. Thấp hơn nữa thì không lợi gì, mà dễ hỏng nhầm nếu sau này não thú cần thêm vài tick để vào thế đánh.

### 4. `bootTestServer` và hai bản chép

`server.transport.server` có kiểu `http.Server | https.Server` (`@colyseus/core` `Transport.d.ts`), nên `address()` trả `string | AddressInfo | null`. Sau dòng `if (!address || typeof address !== "object") throw …`, TypeScript đã thu hẹp `address` thành `AddressInfo`.

- `GameRoom.test.ts`: `server["port"] = address.port;` (giữ chú thích cuối dòng); xoá `import type { AddressInfo } from "node:net";`.
- Cùng mẫu chép trong `worldLimits.test.ts` (dòng `server["port"] = (address as AddressInfo).port;`): bỏ cast. Import `AddressInfo` ở đó chỉ dùng cho dòng này, nên xoá luôn.
- `http.test.ts`: chỉ bỏ cast ở dòng `server["port"] = …`. Import còn dùng ở chỗ `(s.address() as AddressInfo).port` (một `net.Server` chưa thu hẹp), nên giữ.

Lý do làm cả ba: đây là cùng một đoạn chép, sửa một chỗ thì hai chỗ kia thành mẫu sai cho người chép tiếp, và việc sửa không đổi hành vi. `webClient.test.ts` (`portOf`) không thu hẹp nên giữ cast.

### 5. Chú thích trong `worldgen.test.ts`

Chú thích hiện tại: `// Pure CPU: ~0.35 s per generated world, ~2 s in npm test, 6.5 s on a busy machine (4 worlds), hence the explicit limit.` Test nay chỉ sinh 3 thế giới (7, 7, 8), còn "~2 s" và "6.5 s" là số đo từ hồi sinh 4 thế giới. Reviewer T53 đo lại được 1440 ms khi máy rảnh và ước khoảng 4,9 s khi máy bận. Thay bằng (tiếng Anh, một hai dòng):

`// Pure CPU, 3 worlds: 1.4 s in npm test; on a busy machine 6.5 s was measured for 4 worlds (~4.9 s for 3), too close to the 5 s default, hence the explicit limit.`

Hạn `15_000` giữ nguyên.

### 6. Nhóm "eating berries": bỏ phụ thuộc đồng hồ thật

**Vì sao chập chờn.**
- `Camp.eat` lấy `now = room.clock.currentTime`. Đồng hồ của Colyseus (`@colyseus/clock`) mỗi tick đặt `currentTime = this.now()`, với `now` là `Date.now` (`Room.setTimestep`: `this.clock.tick(); onTickCallback(this.clock.deltaTime)`). Vậy mỗi tick, đồng hồ của phòng nhảy đúng bằng thời gian thật đã trôi.
- Nếu máy khựng (GC, CPU bận, lần chạy lẻ đầu tiên phải nạp module), một tick có thể nhảy vài trăm ms. Test 1 có hai chỗ không chịu được cú nhảy > 400-500 ms:
  - `expect(readyAt - now(room)).toBeGreaterThan(EAT_COOLDOWN_MS - 500)` sau `ticks(room, 2)`;
  - quả mọng gửi lúc `readyAt - 500` rồi `ticks(room, 2)`: nếu một tick nhảy hơn khoảng 450 ms, tin được xử lý khi đã trong vòng một tick trước `readyAt`, nên được cho qua, và `berries` thành 1.
- Test 2 dựa vào chuyện "hồi chiêu còn đang chạy" sau khoảng 10 tick. Nó chỉ hỏng nếu 10 tick mất hơn 4 s thật, hiếm hơn nhiều, nhưng cùng loại lỗi.

**Cách rẻ, không cần hook sản phẩm.** `Clock.now` là trường riêng của từng đồng hồ (constructor gán `this.now = … || Date.now`). Trong Colyseus và trong server chỉ `tick()` gọi nó, và GameRoom dùng `setSimulationInterval`, tức nhánh `setTimestep` không cố định, mỗi tick gọi `clock.tick()` đúng một lần. Thay `now` của đồng hồ **phòng đó** bằng một hàm cộng `TICK_MS` mỗi lần gọi, thì đồng hồ phòng tiến đúng 50 ms mỗi tick dù tick thật đến trễ bao lâu. Tick vẫn chạy theo nhịp thật, nên test vẫn mất bằng thời gian cũ (khoảng 4 s); chỉ là thời gian *của phòng* không còn nhảy.

Helper đặt trong `describe("eating berries")`, cạnh `nextEatAt`/`now`/`until`:

```ts
/**
 * Makes the room's clock advance exactly TICK_MS per tick, however late the real tick runs: Colyseus' Clock reads
 * its own `now` (Date.now) once per tick, so a stall on a busy machine would otherwise jump the room's time by
 * hundreds of ms and move these tests' edges. Ticks still come at the real 50 ms pace.
 */
function steadyClock(room: GameRoom) {
  const clock = room.clock as any;
  let time: number = clock.currentTime;
  clock.now = () => (time += TICK_MS);
}
```

- Gọi `steadyClock(room)` ngay sau `setup()` trong test 1 (`a second berry right away is refused quietly…`) và test 2 (`only a berry eaten starts the wait…`).
- Test 3 (`one tick early…`) đã chính xác vì không `await` giữa các bước; test 4 (`each player has their own wait…`) không dựa vào mốc thời gian. Cả hai không đổi.
- Không cần gỡ: phòng bị huỷ ở `afterEach` (`colyseus.cleanup()`), và `now` không phải spy của `vi`.
- Các assertion và ngưỡng 500 ms giữ nguyên. Với đồng hồ đều, `readyAt - now` sau `ticks(room, 2)` là `EAT_COOLDOWN_MS - k·TICK_MS` với k nhỏ (1-2), còn quả gửi lúc `readyAt - 500` được xử lý khi đồng hồ phòng còn cách `readyAt` ít nhất khoảng 400 ms. Cả hai luôn đúng, không còn chừa cho máy chậm.
- Chú thích của `until` giữ nguyên.

Phương án loại:
- Nới 500 → 1000 ms: rẻ, nhưng chỉ dời ngưỡng, máy khựng 1 s vẫn hỏng, và test bớt sắc (quả gửi sớm 1 s thay vì 0,5 s).
- `vi.useFakeTimers()`: làm đứng cả socket và vòng tick của `@colyseus/testing`.

## Kế hoạch triển khai

Tất cả trong một commit.

1. `packages/server/src/rooms/GameRoom.test.ts`:
   1. Xoá `import type { AddressInfo } from "node:net";`. Trong `bootTestServer`: `server["port"] = address.port;`.
   2. `describe("eating berries")`: thêm `steadyClock` (Thiết kế 6); gọi trong test 1 và test 2 ngay sau `const { room, client, player } = await setup();`.
   3. `describe("day and night")`: JSDoc `rollFor` (Thiết kế 1); trong test `syncs the time of day…`, thêm dòng `toThrow`; `spawnWith` dùng spy của chính nó; thêm `expect(vi.isMockFunction(Math.random)).toBe(false)` sau lần gọi đầu (Thiết kế 2).
   4. Test `wild pals cast too…`: `CAST_WITHIN_TICKS = 20` và `expect(casts.length, …)` (Thiết kế 3). Điền số tick đo được vào chú thích (bước 4 của mục Test).
2. `packages/server/src/worldLimits.test.ts`: bỏ cast và import `AddressInfo` (Thiết kế 4).
3. `packages/server/src/http.test.ts`: bỏ cast ở dòng `server["port"]`, giữ import.
4. `packages/shared/src/worldgen.test.ts`: chú thích mới (Thiết kế 5).
5. `docs/architecture.md`, dòng `npm test`: sau câu về hạn riêng, thêm câu "Test cần mốc thời gian của phòng chính xác (nhóm `eating berries`) gọi `steadyClock(room)`: đồng hồ phòng tiến đúng `TICK_MS` mỗi tick, máy bận không làm nó nhảy (không hook sản phẩm; thay `now` của `room.clock`)."
6. `npm run typecheck`, `npm test`.

## Giao thức

Không đổi `schema.ts`, `messages.ts`, `Profile`, server hay client. Chỉ file test và một câu tài liệu.

## Test

Không thêm file test. Tester chạy các bước dưới đây. **Mọi đột biến là tạm thời**: hoàn tác ngay, kiểm bằng `git diff --stat`/`sha256sum` rằng file sản phẩm về đúng bản gốc, rồi ghi kết quả (lệnh, số lần, thời gian, thông báo lỗi) vào `PROGRESS.md`.

1. `npm run typecheck` sạch: chứng minh bỏ `as AddressInfo` vẫn đúng kiểu, và không còn import thừa (`noUnusedLocals`). Rồi `npm test` qua toàn bộ.
2. **Đột biến ăn, cho qua sớm** (`systems/camp.ts`): đổi `now < control.nextEatAt - TICK_MS` thành `now < control.nextEatAt - 600`. Chạy `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "eating"`: test 1 phải hỏng ở `expect(player.berries).toBe(2)`. Hoàn tác.
3. **Đột biến ăn, hồi chiêu ngắn** (`camp.ts`): `control.nextEatAt = now + EAT_COOLDOWN_MS - 1000`. Test 1 phải hỏng ở `toBeGreaterThan(EAT_COOLDOWN_MS - 500)`. Hoàn tác.
4. **Đo tick ra chiêu:** tạm thêm `console.log(i)` sau vòng lặp của test `wild pals cast too…`, chạy 5 lần, ghi số tick (mong 1-2), điền vào chú thích, rồi xoá log.
5. **Đột biến chiêu thú hoang** (`systems/skills.ts`, `wildSkill`): đổi `0.06` thành `-1` (thú thường không bao giờ tung chiêu). Test `wild pals cast too…` phải hỏng ở `expect(casts.length, …)` với lời đã viết, trong khoảng 1-2 s, **không** phải "Test timed out in 5000ms". Ghi thời gian. Hoàn tác. Để so sánh, chạy cùng đột biến trên HEAD (vòng 160) và ghi lại rằng khi đó test hết giờ.
6. **`spawnWith` chỉ gỡ spy của nó:**
   - (a) Tạm bỏ `spy.mockRestore()`: test `syncs the time of day…` phải hỏng ở `expect(vi.isMockFunction(Math.random)).toBe(false)`. Hoàn tác.
   - (b) Tạm thêm vào đầu test `const warn = vi.spyOn(console, "warn");` và sau lần gọi `spawnWith` đầu tiên `expect(vi.isMockFunction(console.warn)).toBe(true);`. Bản mới qua; đổi `spawnWith` về `vi.restoreAllMocks()` thì hỏng. Hoàn tác cả hai.
7. **`rollFor` ném lỗi:** dòng `toThrow` mới phải qua. Tạm đổi `night: false` thành `night: true` ở dòng đó thì hỏng (không ném). Hoàn tác.
8. **Đồng hồ đều chịu được máy khựng.** Tạm chèn một đoạn khựng 700 ms vào test 1, ngay sau `client.send(ClientMessage.Eat);` đầu tiên và trước `await ticks(room, 2)`. Ví dụ `await new Promise((r) => setTimeout(r, 0)); const end = Date.now() + 700; while (Date.now() < end) {}` (chặn vòng sự kiện, nên tick kế đến trễ khoảng 700 ms).
   - Có `steadyClock`: test 1 qua.
   - Bỏ dòng gọi `steadyClock` (giữ đoạn khựng): test 1 hỏng ở `toBeGreaterThan(EAT_COOLDOWN_MS - 500)`.
   - Lặp lại với đoạn khựng đặt ngay sau `await until(room, readyAt - 500); client.send(ClientMessage.Eat);`: có `steadyClock` thì qua; không có thì hỏng ở `expect(player.berries).toBe(2)`.

   Hoàn tác mọi thứ.
9. **Chạy lặp:** `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "eating"` 20 lần liên tiếp, rồi 10 lần trong lúc chạy song song 4 vòng lặp CPU (`node -e "for(;;){}" &` ×4, tắt sau khi xong). Tất cả phải qua. Chạy cả file `GameRoom.test.ts` 3 lần, và `npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "wild pals cast too"` 10 lần: phải qua.

Không cần e2e: không có gì của client đổi. CI vẫn chạy e2e như thường.

## Tiêu chí hoàn thành

- [ ] JSDoc `rollFor` nói rõ hàm ném lỗi khi không roll nào ra loài đó; có dòng `toThrow(/no roll picks mothlume/)` trong test `syncs the time of day…`.
- [ ] `spawnWith` dùng `const spy = vi.spyOn(...)` và `spy.mockRestore()` trong `finally`, không còn `vi.restoreAllMocks()` bên trong; có `expect(vi.isMockFunction(Math.random)).toBe(false)` sau lần gọi đầu.
- [ ] Test `wild pals cast too…` lặp tối đa `CAST_WITHIN_TICKS = 20` tick; chú thích ghi số tick đo được; có `expect(casts.length, …).toBeGreaterThan(0)` trước `casts[0]`.
- [ ] `GameRoom.test.ts` không còn import `AddressInfo`, không còn `as AddressInfo`. `worldLimits.test.ts` không còn cả hai. `http.test.ts` không còn cast ở dòng `server["port"]`.
- [ ] Chú thích `worldgen.test.ts` nói 3 thế giới, kèm số đo đúng; hạn `15_000` giữ nguyên.
- [ ] `steadyClock` có JSDoc và được gọi trong test ăn 1 và 2; ngưỡng 500 ms và mọi assertion của nhóm giữ nguyên.
- [ ] `docs/architecture.md` có câu về `steadyClock`.
- [ ] `git diff --stat` chỉ gồm `GameRoom.test.ts`, `worldLimits.test.ts`, `http.test.ts`, `worldgen.test.ts`, `docs/architecture.md` (cộng `PROGRESS.md`). Không file sản phẩm nào đổi; không có `tests/e2e/multiplayer.spec.ts` hay file `labelLayout`.
- [ ] `npm run typecheck` sạch, `npm test` qua.
- [ ] Tester ghi đủ kết quả bước 2-9 của mục Test vào `PROGRESS.md`. Mỗi đột biến cho đúng kết quả mong đợi, và đột biến ở bước 5 hỏng trong `expect`, không hết giờ.

## Rủi ro, câu hỏi mở

Không có mục CHẶN.

- **`steadyClock` dựa vào chi tiết của `@colyseus/clock`** (trường `now` được bảo vệ, và chỉ `tick()` gọi nó). Nếu bản Colyseus sau đổi chỗ này, helper không còn tác dụng *mà không báo gì*, và test quay lại phụ thuộc đồng hồ thật. Giảm rủi ro: bước 8 của mục Test chứng minh nó có tác dụng hôm nay. Có thể thêm trong test 1, sau `steadyClock` và `ticks(room, 2)`, một dòng `expect((now(room) - start) % TICK_MS).toBe(0)` (với `start` = `currentTime` lúc gọi helper), để test hỏng ngay nếu đồng hồ không còn đều. Coder tự quyết, khuyên nên thêm.
- **Bộ đếm tick cho chiêu (20) dựa vào số đo.** Nếu bước 4 đo được hơn 5 tick, tester báo lại để chọn số mới theo luật "khoảng 10 lần số đo, vẫn dưới 5 s", thay vì giữ 20.
- Bỏ cast trong `worldLimits.test.ts`/`http.test.ts` là mở rộng nhỏ ngoài dòng TASKS. Lý do ở Thiết kế 4; nếu reviewer muốn giữ đúng phạm vi thì đó là phần duy nhất có thể bỏ ra.

## Đề xuất cho `TASKS.md`

- Đánh dấu xong phần "theo dõi nhóm eating berries (từ T9)" của T22: nguyên nhân (đồng hồ phòng nhảy theo thời gian thật) đã được xử lý tận gốc bằng `steadyClock`, không chỉ nới ngưỡng.
- Không có việc mới.
