# Kỹ năng (chiêu) của thú

Mỗi loài thú học 3 chiêu khi chiến đấu, mỗi chiêu có hoạt ảnh riêng và sát thương (hoặc lượng máu hồi) tăng theo cấp của thú.

- Dữ liệu: `packages/shared/src/data/skills.json` (30 chiêu), chiêu của từng loài ở trường `skills` trong `pals.json`.
- Logic dùng chung (có test): `packages/shared/src/skills.ts`: `skillPower`, `learnset`, `knownSkills`, `skillTravelMs`, `inSkillArea`.
- Server quyết định mọi thứ: `GameRoom` (`startCast`, `tickCasts`, `land`), thú chọn chiêu ở `packages/server/src/ai/skillAi.ts`.
- Hoạt ảnh: `packages/client/src/game/skillfx.ts` (`SKILL_SHOWS`, mỗi chiêu một hàm). Xem tất cả chiêu chạy lặp ở http://localhost:5173/sprites.html?show=skills, một chiêu phóng to: `?show=skills&skill=meteor`, kiểu thú hoang tung chiêu (có vùng đỏ): thêm `&wild=1`.

## Học chiêu

Chiêu thứ nhất có từ cấp 1, chiêu thứ hai ở cấp 7, chiêu thứ ba ở cấp 15 (`SKILL_LEVELS`). Chiêu đầu tiên luôn là chiêu đánh (để có cái đánh ngay). Khi thú lên đúng cấp học chiêu, người chơi thấy thông báo "Học được chiêu mới". Bảng **Thú** (phím Q) hiện 3 chiêu của mỗi con: chiêu đã học kèm sát thương ở cấp hiện tại (⚔), máu hồi (+) hoặc thời gian khiên; chiêu chưa học có khoá 🔒 và cấp sẽ học.

| Thú | Hệ | Lv 1 | Lv 7 | Lv 15 |
|---|---|---|---|---|
| Leafkit | 🌿 Cỏ | 🌱 Bắn hạt | 🌿 Dây leo trói | 🍃 Bão lá |
| Emberpup | 🔥 Lửa | 🔥 Tàn lửa | 🔥 Phun lửa | 💥 Vòng lửa |
| Bubbloon | 💧 Nước | 🫧 Bong bóng | 🌧️ Mưa hồi máu | 🌊 Sóng thần |
| Pebblet | 🪨 Đất | 🪨 Ném đá | 🛡️ Khiên đá | 💢 Động đất |
| Voltmouse | ⚡ Điện | ⚡ Tia lửa điện | 🌩️ Sấm sét | 🔗 Sét chuỗi |
| Ripplefin | 💧 Nước | 💦 Vòi nước | 🌧️ Mưa hồi máu | 🌊 Sóng thần |
| Mothlume | ⚡ Điện | ✨ Bụi sáng | 🌀 Trường điện | 🌩️ Sấm sét |
| Boulderhorn | 🪨 Đất | 🦏 Húc sừng | 💢 Động đất | ⛰️ Gai đá |
| Frostfang | 💧 Nước | 🧊 Mũi băng | ❄️ Hơi thở băng giá | 🌨️ Bão tuyết |
| Cactoad | 🌿 Cỏ | 🌵 Gai tua tủa | 🌿 Dây leo trói | 🎯 Đại bác gai |
| Scorchtail | 🔥 Lửa | 🔥 Phun lửa | 🌋 Quất đuôi lửa | ☄️ Thiên thạch |
| Bogbloom | 🌿 Cỏ | 🌿 Dây leo trói | 🌼 Phấn hoa hồi máu | 🌸 Hoa nở |
| Coralcrab | 💧 Nước | 🦀 Kẹp càng | 💦 Vòi nước | 🌊 Sóng thần |

## Sát thương

```
sát thương = làm tròn(power × (1 + 0,12 × (cấp − 1))) × khắc hệ × khiên
```

- Mỗi cấp mạnh thêm 12% so với cấp 1 (`SKILL_LEVEL_SCALING`): cấp 7 ×1,72, cấp 15 ×2,68.
- Khắc hệ (`elements.ts`): ×1,5 khi đánh hệ bị khắc, ×0,75 khi đánh hệ khắc mình (chiêu của thú đi theo đánh thú hoang).
- Khiên đá: người (hoặc thú hoang) đang có khiên chỉ nhận ½ sát thương (`SHIELD_DAMAGE_TAKEN`).
- Sét chuỗi: mỗi lần nhảy sang con kế bên (trong 100 px) còn ×0,7 so với lần trước.
- Chiêu hồi máu dùng cùng công thức cho lượng máu hồi.

## Một lần tung chiêu

1. **Gồng** (`castMs`): thú đứng yên, phồng người lên và nhấp nháy màu hệ, vòng sáng dưới chân, các hạt sáng xoáy vào người; tên chiêu hiện trên đầu (màu đỏ nếu là thú hoang). Sấm sét có mây giông kéo tới, thiên thạch có bóng đen lớn dần chỗ sẽ rơi.
2. **Bay tới** (`skillTravelMs`): chiêu bay theo tốc độ (`speed`, chiêu bay thẳng, ném, sóng) hoặc mất một khoảng thời gian (`durationMs`, chiêu tia, từ trời, vùng, hồi máu, khiên).
3. **Trúng**: server tính ai nằm trong vùng trúng (`inSkillArea`): quanh chỗ nhắm, quanh thú (quanh mình), trong hình quạt hoặc dọc đường sóng; trừ máu, đẩy lùi, giữ chân, hồi máu hoặc dựng khiên.

Thú đi theo người chơi: chiêu luôn trúng mục tiêu dù nó chạy đi đâu (bám theo). Thú hoang: chiêu rơi đúng chỗ mục tiêu (người chơi hoặc thú đi theo) đứng lúc nó bắt đầu gồng, và mặt đất hiện **vùng đỏ** đúng bằng vùng trúng: chạy ra khỏi vùng hoặc lướt né (Shift / nút 💨) để tránh. Thú bị choáng, bị ném vào bóng hoặc bị hạ khi đang gồng thì mất chiêu đó; chiêu đã bay đi thì vẫn bay tiếp.

## Thú tự chọn chiêu

- Hồi máu khi máu thấp (thú đi theo: khi chủ hoặc chính nó dưới 70%; thú hoang: khi nó dưới 50%), dựng khiên khi đang đánh nhau.
- Không thì dùng chiêu đánh mạnh nhất (học sau cùng) đã hồi xong và với tới mục tiêu (`skillReach`).
- Mỗi chiêu có thời gian hồi riêng (`cooldownMs`); sau mỗi chiêu thú đi theo nghỉ 1,5 giây, thú hoang 2,5 giây, và chiêu của thú hoang hồi lâu hơn ×1,3. Mỗi lượt server chỉ có 6% khả năng thú hoang bắt đầu một chiêu, nên nó vẫn cắn xen kẽ.
- Boss (Vua Đá Boulderhorn) dùng Húc sừng và Gai đá ở sức mạnh cấp 4 (`BOSS.skills`, `BOSS.skillLevel`).

## 30 chiêu

Số sát thương ở cấp 1, 7 và 15, chưa tính khắc hệ. Kiểu chiêu (`shape`): bay thẳng (`projectile`), ném vòng cầu (`lob`), tia (`beam`), từ trời (`strike`), vùng (`zone`), quanh mình (`nova`), hình quạt (`cone`), sóng (`wave`), cận chiến (`melee`), hồi máu (`heal`), khiên (`shield`).

### 🔥 Lửa

| Chiêu | Kiểu | Lv 1 → 7 → 15 | Vùng trúng (px) | Gồng / hồi | Thêm | Hoạt ảnh |
|---|---|---|---|---|---|---|
| 🔥 **Tàn lửa** (`ember`) | bay thẳng | 8 → 14 → 21 | tầm 150, bán kính 20 | 0,35s / 5s | – | Quả cầu lửa có đuôi bay thẳng, rắc tàn lửa dọc đường, nổ bung thành tia lửa |
| 🔥 **Phun lửa** (`fire_breath`) | hình quạt | 11 → 19 → 29 | quạt 70°, dài 85 | 0,45s / 7s | đẩy lùi 10 | Luồng lửa hình quạt phun ra từ miệng, khói xám bốc lên chỗ trúng |
| 💥 **Vòng lửa** (`flame_ring`) | quanh mình | 16 → 28 → 43 | bán kính 95 quanh mình | 0,6s / 10s | đẩy lùi 22 | Vòng lửa lan ra quanh mình đúng bằng tầm, đất cháy đỏ |
| 🌋 **Quất đuôi lửa** (`lava_lash`) | cận chiến | 13 → 22 → 35 | tầm 52, bán kính 30 | 0,3s / 6s | đẩy lùi 26 | Đuôi lửa quét vòng cung trước mặt, tóe than hồng |
| ☄️ **Thiên thạch** (`meteor`) | từ trời | 24 → 41 → 64 | tầm 170, bán kính 52 | 0,7s / 12s | đẩy lùi 18 | Lúc gồng: bóng đen lớn dần trên đất và một đốm sáng trên trời. Tảng đá cháy rơi chéo kéo vệt khói, nổ tung để lại hố cháy, rung màn hình |

### 🌿 Cỏ

| Chiêu | Kiểu | Lv 1 → 7 → 15 | Vùng trúng (px) | Gồng / hồi | Thêm | Hoạt ảnh |
|---|---|---|---|---|---|---|
| 🌱 **Bắn hạt** (`seed_shot`) | bay thẳng | 7 → 12 → 19 | tầm 140, bán kính 18 | 0,3s / 4,5s | – | Ba hạt lượn sóng bay tới, vỡ tóe xanh |
| 🌿 **Dây leo trói** (`vine_bind`) | vùng | 8 → 14 → 21 | tầm 130, bán kính 30 | 0,4s / 9s | giữ chân 2,5s | Dây leo mọc lên từ đất quấn quanh kẻ địch, lá bay |
| 🍃 **Bão lá** (`leaf_storm`) | vùng | 18 → 31 → 48 | tầm 140, bán kính 64 | 0,55s / 11s | – | Lốc lá xoáy siết vào giữa rồi tung ra |
| 🌵 **Gai tua tủa** (`needle_spray`) | quanh mình | 9 → 15 → 24 | bán kính 72 quanh mình | 0,35s / 6s | – | Gai bắn tua tủa ra mọi hướng |
| 🎯 **Đại bác gai** (`needle_cannon`) | bay thẳng | 22 → 38 → 59 | tầm 160, bán kính 34 | 0,55s / 11s | đẩy lùi 20 | Một gai lớn bay thẳng, nổ thành gai nhỏ |
| 🌼 **Phấn hoa hồi máu** (`pollen`) | hồi máu | +14 → +24 → +38 | chủ và thú | 0,5s / 11s | – | Phấn hoa bay tới chủ và thú, cánh hoa rơi đúng lúc hồi máu |
| 🌸 **Hoa nở** (`bloom_burst`) | vùng | 18 → 31 → 48 | tầm 140, bán kính 56 | 0,6s / 11s | – | Bông hoa khổng lồ nở trên mặt đất rồi nổ thành cánh hoa |

### 💧 Nước

| Chiêu | Kiểu | Lv 1 → 7 → 15 | Vùng trúng (px) | Gồng / hồi | Thêm | Hoạt ảnh |
|---|---|---|---|---|---|---|
| 🫧 **Bong bóng** (`bubble`) | bay thẳng | 6 → 10 → 16 | tầm 130, bán kính 22 | 0,3s / 4,5s | – | Bong bóng lượn lờ bay tới rồi vỡ tóe nước |
| 💦 **Vòi nước** (`water_jet`) | tia | 9 → 15 → 24 | tầm 120, bán kính 18 | 0,35s / 5s | đẩy lùi 16 | Vòi nước gợn sóng phóng tới, nước bắn tung |
| 🌧️ **Mưa hồi máu** (`healing_rain`) | hồi máu | +18 → +31 → +48 | chủ và thú | 0,6s / 10s | – | Đám mây nhỏ mưa trên đầu chủ và thú, dấu cộng xanh bay lên khi hồi máu |
| 🌊 **Sóng thần** (`tidal_wave`) | sóng | 20 → 34 → 54 | dài 150, rộng 68 | 0,65s / 12s | đẩy lùi 30 | Con sóng có bọt trắng cuộn về phía trước suốt tầm |
| 🧊 **Mũi băng** (`ice_shard`) | bay thẳng | 10 → 17 → 27 | tầm 150, bán kính 18 | 0,35s / 5s | giữ chân 0,6s | Mũi băng nhọn bay thẳng, vỡ thành mảnh băng |
| ❄️ **Hơi thở băng giá** (`frost_breath`) | hình quạt | 13 → 22 → 35 | quạt 64°, dài 85 | 0,45s / 8s | giữ chân 1s | Hơi lạnh và bông tuyết phun hình quạt |
| 🌨️ **Bão tuyết** (`blizzard`) | vùng | 22 → 38 → 59 | tầm 150, bán kính 70 | 0,65s / 12s | giữ chân 1,2s | Bão tuyết xoáy, gió lùa quanh kẻ địch |
| 🦀 **Kẹp càng** (`pincer`) | cận chiến | 11 → 19 → 29 | tầm 48, bán kính 26 | 0,28s / 5s | đẩy lùi 18 | Hai càng đỏ kẹp lại, nước bắn |

### 🪨 Đất

| Chiêu | Kiểu | Lv 1 → 7 → 15 | Vùng trúng (px) | Gồng / hồi | Thêm | Hoạt ảnh |
|---|---|---|---|---|---|---|
| 🪨 **Ném đá** (`rock_throw`) | ném vòng cầu | 9 → 15 → 24 | tầm 140, bán kính 22 | 0,4s / 5s | đẩy lùi 12 | Hòn đá bay vòng cầu, vỡ tung bụi |
| 🛡️ **Khiên đá** (`stone_shield`) | khiên | – → – → – | chủ | 0,5s / 12s | nhận ½ sát thương 6s | Đá nhảy lên từ đất ghép thành vòm khiên quanh chủ |
| 💢 **Động đất** (`quake`) | quanh mình | 18 → 31 → 48 | bán kính 92 quanh mình | 0,65s / 11s | đẩy lùi 20 | Đất nứt toác quanh mình, đá văng lên, rung màn hình |
| 🦏 **Húc sừng** (`horn_charge`) | cận chiến | 14 → 24 → 38 | tầm 100, bán kính 28 | 0,45s / 7s | đẩy lùi 30, lao tới 70 | Lao tới để lại bóng mờ và vệt bụi, húc tóe bụi |
| ⛰️ **Gai đá** (`rock_spikes`) | vùng | 24 → 41 → 64 | tầm 160, bán kính 50 | 0,7s / 11s | đẩy lùi 16 | Gai đá nhô lên khỏi mặt đất rồi rút xuống |

### ⚡ Điện

| Chiêu | Kiểu | Lv 1 → 7 → 15 | Vùng trúng (px) | Gồng / hồi | Thêm | Hoạt ảnh |
|---|---|---|---|---|---|---|
| ⚡ **Tia lửa điện** (`spark`) | tia | 8 → 14 → 21 | tầm 120, bán kính 16 | 0,25s / 4,5s | – | Tia chớp ngoằn ngoèo nối từ thú tới kẻ địch |
| 🌩️ **Sấm sét** (`thunder`) | từ trời | 16 → 28 → 43 | tầm 160, bán kính 34 | 0,55s / 9s | – | Lúc gồng: mây giông kéo tới trên đầu kẻ địch. Sét đánh xuống |
| 🔗 **Sét chuỗi** (`chain_lightning`) | tia | 14 → 24 → 38 | tầm 140, bán kính 16 | 0,45s / 11s | nhảy thêm 2 con (×0,7 mỗi lần) | Tia chớp tới con đầu, rồi nhảy sang từng con kế bên |
| 🌀 **Trường điện** (`static_field`) | quanh mình | 10 → 17 → 27 | bán kính 72 quanh mình | 0,45s / 9s | giữ chân 1s | Vòng điện lởm chởm lan ra quanh mình |
| ✨ **Bụi sáng** (`glow_dust`) | vùng | 7 → 12 → 19 | tầm 130, bán kính 40 | 0,35s / 5s | – | Bụi sáng lấp lánh lơ lửng rồi tóe tia |
## Thêm một chiêu mới

1. Thêm một dòng vào `skills.json` (id, tên, icon, hệ, kiểu, power, castMs, cooldownMs và các trường kiểu đó cần: test `skills.test.ts` kiểm tra).
2. Gán chiêu cho một loài trong `pals.json` (đúng 3 chiêu, chiêu đầu là chiêu đánh). Mọi chiêu phải có ít nhất một loài học.
3. Viết hoạt ảnh trong `SKILL_SHOWS` (`skillfx.ts`), dựng từ các mảnh có sẵn: `fly` (vật bay), `spray` (chùm hạt), `groundRing` (vòng trên đất, vẽ đúng vùng trúng), `breath`, `embers`, `flash`. Chiêu chưa có hoạt ảnh vẫn chạy, hiện một chùm hạt màu hệ.
4. Xem ở `sprites.html?show=skills&skill=<id>` rồi chạy `npm run typecheck && npm test`.
