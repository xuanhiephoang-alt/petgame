# BALANCE: T7 - chiêu (và đòn) của thú hoang cấp cao có quá nặng với người chơi không?

Phương pháp: script mô phỏng ngoài repo (thư mục tạm), import thẳng logic dùng chung; bước 50 ms; 400-1500 lần mỗi ô. Mô hình bám server: `GameRoom.ts` dòng 686-712 (cú cắn: gồng 450 ms, chu kỳ 1200 ms, tầm 50 px), `wildSkill` dòng 1527 (6% mỗi tick = 20 tick/giây, nghỉ `WILD_SKILL_GAP_MS` 2500 + `castMs`, hồi chiêu ×1,3, chọn chiêu mạnh nhất sẵn sàng), `damage` dòng 1684 (giáp = `defenseOf`, tối thiểu 1). Người chơi đứng yên ("đứng yên" = không né) là cận xấu nhất; có cột né 50% làm mốc thực tế (lướt `DASH_MS` 170 + `DASH_GRACE_MS` 90 = 260 ms bất tử, hồi 900 ms nên về lý thuyết né được mọi cú cắn chu kỳ 1200 ms). Hạn chế mô hình: thú đi theo coi như emberpup đánh 900 ms/đòn + chiêu, "thú chịu 30% đòn" là giả định (server thật: thú hoang đánh người đã đánh nó, hoặc kẻ gần nhất trong 120 px); chiêu của thú hoang luôn trúng người đứng yên; bỏ qua hồi máu 4/giây (sau 5 giây không bị đánh) và quả mọng +20.

## Hiện trạng

**Công thức và hằng số (file nguồn)**
- Cú cắn: `wildDamage = round(attack × (1 + 0.15 × (cấp-1)))` (`combat.ts`), không có giới hạn cấp. Chiêu: `skillPower = round(power × (1 + 0.12 × (cấp-1)))` (`skills.ts`), thú hoang thường dùng cấp thật của nó (`GameRoom.ts:695`), thú đầu đàn `min(cấp, ALPHA.skillLevel=8)`, trùm `BOSS.skillLevel=4`.
- Chiêu thứ 2 học ở cấp 7, thứ 3 ở cấp 15 (`SKILL_LEVELS`): thú hoang thường (tối đa cấp 14) chỉ có chiêu 1-2; chiêu 3 chỉ thú đầu đàn.
- Người chơi: `PLAYER_MAX_HP` 100, không tăng theo cấp; hồi 4/giây sau 5 giây; giáp da 20% + nón sắt 10% = 30% (chế tạo); giáp hiệp sĩ 35% (+10% = 45%, rơi từ trùm); trần 50%.
- Cấp thú hoang: `wildMaxLevel = 6 + round(8 × danger)`, `rollWildLevel = 1 + floor(roll² × max)`. Đo trên lưới 40 px của thế giới thật: vùng cỏ max 6-8, sa mạc 7-10, tuyết 7-11, đầm lầy 8-11, núi lửa 7-11, đảo 10-13. Cấp 14 cần danger ≥ 0,94 nhưng đất xa nhất chỉ có danger 0,91 (đảo, quét lưới 8 px), nên hiện không có thú hoang thường cấp 14; boulderhorn chỉ sống ở núi lửa (tối đa cấp 11). Các dòng cấp 14 trong các bảng dưới là cận trên giả định; cấp tối đa thường gặp là 10-13. Cấp trung bình thấp (2,9 ở cỏ; 3,6 ở vùng giữa; 4,6 ở đảo); P(cấp ≥ 8) = 0% (cỏ), 12% (vùng giữa max 9), 24% (đảo max 12); P(cấp ≥ 11) = 9% (đảo).
- Kẻ thù chủ động: chỉ `boulderhorn` (núi lửa) và `scorchtail` (sa mạc, núi lửa) và thú đầu đàn (tầm thấy 170 px). Thú phòng thủ chỉ đánh trả kẻ đã đánh nó (`provoke` chỉ đặt cho chính con bị đánh), thú thụ động bỏ chạy. Nên trận 2-3 thú cùng đánh người chơi chủ yếu ở núi lửa/sa mạc, hoặc khi người chơi đánh nhiều con liền nhau.

**Sát thương mỗi lần, hiện tại (chưa giáp) và đóng góp vào DPS**

| Thú, cấp | Cú cắn | Chiêu mạnh nhất (cấp thật) | DPS cắn / chiêu (người đứng yên) |
|---|---|---|---|
| emberpup cấp 6 (cỏ) | 12 | ember 13 | 9,9 / 1,7 |
| boulderhorn 8 | 21 | quake 33 | 17,1 / 4,3 |
| boulderhorn 11 | 25 | quake 40 | 20,3 / 5,1 |
| scorchtail 10 | 21 | lava_lash 27 | 17,2 / 4,9 |
| frostfang 11 | 23 | frost_breath 29 | 18,8 / 4,5 |
| coralcrab 13 | 28 | pincer 27 | 23,0 / 5,6 |
| coralcrab 14 (góc xa) | 30 | pincer 28 | 24,6 / 5,9 |
| voltmouse 14 (thụ động) | 15 | thunder 41 | 12,3 / 5,4 |
| boulderhorn 14 | 30 | quake 46 | 24,4 / 5,8 |

Điểm mấu chốt: **chiêu chỉ chiếm khoảng 20% sát thương mỗi giây** (khoảng 1 chiêu mỗi 6-7 giây vì nghỉ 2,5 giây + cast + hồi ×1,3 + mỗi chiêu mạnh hồi 9-14 giây), **cú cắn chiếm ~80%**. Chiêu đau ở chỗ nổ lớn một lần: quake 46 (nova bán kính 92 px, né khó khi ở sát) = 46% máu, thunder 41 = 41% (cả hai là cận trên: boulderhorn tối đa cấp 11 nên quake thật tối đa 40; thunder chỉ voltmouse và mothlume có, đều là thú thụ động nên thú hoang thường không bao giờ dùng lên người, chỉ voltmouse đầu đàn dùng ở sức mạnh cấp 8 = 29). Cú cắn cấp 14 gấp ×2,95 cấp 1, chiêu chỉ ×2,56.

**Thời gian người chơi trụ được, tình trạng hiện tại** (giây, từ 100 máu đến 0, đứng yên, không hạ được thú, không hồi máu)

| Vùng, thú, cấp | 1 thú, không giáp | 1 thú, giáp 30% | 1 thú, giáp 45% | 2 thú, giáp 30% | 3 thú, không giáp |
|---|---|---|---|---|---|
| cỏ, emberpup 6 | 8,8 | 12,7 | 15,0 | 6,5 | 2,5 |
| núi lửa, boulderhorn 8 | 4,4 | 6,1 | 7,3 | 2,7 | 1,6 |
| núi lửa, boulderhorn 11 | 3,3 | 4,4 | 6,3 | 2,1 | 1,5 |
| sa mạc, scorchtail 10 | 4,2 | 6,1 | 7,1 | 2,9 | 1,4 |
| tuyết, frostfang 11 | 4,3 | 5,5 | 7,0 | 2,5 | 1,6 |
| đầm lầy, cactoad 11 | 5,2 | 7,0 | 9,2 | 3,3 | 1,7 |
| đảo, coralcrab 13 | 3,1 | 5,1 | 5,9 | 2,4 | 1,3 |
| góc xa, coralcrab 14 | 3,1 | 4,3 | 6,0 | 1,9 | 1,3 |

So sánh: thú đầu đàn (hạ người chơi đứng yên trong 2,2-5,0 giây không giáp, 3,2-7,0 giây giáp 30%: voltmouse cấp 15 là 5,0/7,0, coralcrab cấp 22 là 2,2/3,2); trùm Boulderhorn: cắn 14/1,8 s + dậm 18/6 s + chiêu cấp 4 (19 và 33), khoảng 7 giây với người đứng yên. Thú đầu đàn cắn mạnh hơn trùm (cấp 20-22: cắn 35-42 vì `damageMultiplier` 1 và đường cấp +15%); cùng gốc với vấn đề này (xem Rủi ro).

**Có thú đi theo / vũ khí** (kiếm 40 sát thương/giây kể cả chí mạng; quyền 27; thú 130/190 máu ở cấp 9/15 với emberpup, 182/266 pebblet; đòn thú 13 / 19): trận 1 thú hoang cùng cấp chỉ kéo dài 3-5 giây, người chơi có kiếm, giáp 30% và thú đi theo không chết (0%). Người chơi chỉ có quyền không giáp đứng yên chết 100% mọi trận từ cấp 8 trở lên, hiện tại không trừ trận nào; chỉ sau khi đổi mới có trận thắng được (scorchtail 10 còn chết khoảng 44%, cactoad 11 khoảng 66%, các trận khác vẫn gần 100%). Trận 2 thú (sau khi cho thú đi theo chịu 30% đòn, né 0%): chết 100% ở núi lửa cấp 8-11, đảo cấp 13, góc xa cấp 14 (thú đi theo cấp 9) và 78-100% ở núi lửa/tuyết/đảo (thú đi theo cấp 15); khi né được một nửa: 3% (núi lửa 8), 39% (núi lửa 11), 29% (đảo 13), 62% (góc xa 14).

## Vấn đề

1. **Cú cắn mới là thủ phạm chính, không phải chiêu**: ở cấp 11-14 cú cắn thú thường (23-30) bằng hoặc hơn chiêu 1-2 (20-33), tần suất 1 lần/1,2 giây so với 1 chiêu/6-7 giây. Chỉ giới hạn chiêu cho thú hoang thường (kiểu `ALPHA.skillLevel`) kéo thời gian trụ lên rất ít (ví dụ boulderhorn 11 có giáp 4,4 -> 5,5 giây; không giáp không đổi), nhưng **hạ đỉnh sát thương một lần** (quake 46 -> 33, thunder 41 -> 29) đủ để thoả mốc "thú thường không hạ người trong 1-2 chiêu" (hiện boulderhorn cấp 11: quake 40 + horn_charge 31 = 71% máu chỉ trong 2 chiêu, thêm 2 cú cắn 25 là hạ người không giáp; sau khi đổi 33 + 26 = 59%, cắn 18).
2. **Sức mạnh thú hoang tăng nhanh hơn người chơi**: người chơi cố định 100 máu, thú hoang +20% máu và +15% cắn mỗi cấp. Người chơi đứng yên với 1 thú cấp 13-14 trụ 3 giây không giáp, 4-5 giây giáp 30% (mốc cảm nhận: người biết né phải sống, người đứng yên cũng không nên chết trong vài đòn).
3. Né thật sự quyết định (né một nửa: 2 thú cấp 11 từ 100% chết xuống 39%); nhưng cú cắn chu kỳ 1,2 s với gồng 450 ms đòi hỏi lướt đúng nhịp, còn nova (quake bán kính 92 px) gần như phải lướt.
4. Giáp mua được ít: giáp da + nón (30%) chỉ kéo từ 3,3 lên 4,4 giây ở núi lửa 11 (1 thú); 3 thú cấp cao giết người có giáp trong khoảng 2 giây (1,7-2,1).
5. Phụ: thú đầu đàn cắn nặng hơn trùm (xem trên) và thời gian trụ trước thú đầu đàn cấp 20+ chỉ 2,2-3,3 giây (đã biết, ngoài phạm vi T7, ghi cho designer).

## Đề xuất

**Giữ nguyên mọi thứ về thú đi theo**: `skillPower`, `SKILL_LEVEL_SCALING`, `companionDamage` không đổi; mọi thay đổi chỉ nằm ở đường của thú hoang.

| Việc | File, khoá | Cũ -> Mới | Vì sao |
|---|---|---|---|
| 1. Giới hạn cấp sức mạnh chiêu của thú hoang thường | `packages/shared/src/skills.ts`: thêm `WILD_SKILL_MAX_LEVEL`; `GameRoom.ts:695` thay `pal.level` bằng `Math.min(pal.level, WILD_SKILL_MAX_LEVEL)` | không giới hạn -> 8 (bằng `ALPHA.skillLevel`) | Chiêu thú hoang cấp 8 trở lên không tăng nữa (×1,84 thay vì ×2,56 ở cấp 14). Đỉnh sát thương: quake 46 -> 33, thunder 41 -> 29, lava_lash 33 -> 24, frost_breath 33 -> 24, cactoad needle_spray 23 -> 17. Không đụng cấp 1-8 (người mới và vùng cỏ không đổi). |
| 2. Đường tăng cú cắn riêng, chậm hơn | `packages/shared/src/combat.ts`: `wildDamage` hệ số 0,15 -> hằng số mới `WILD_DAMAGE_PER_LEVEL = 0.08` (không sửa `companionDamage` ở `progression.ts`, dùng hệ số riêng) | +15%/cấp -> +8%/cấp | Cú cắn là 80% sát thương. Cấp 14: ×2,04 (cũ ×2,95); cấp 8 và cấp 11: ×1,56 và ×1,8 (cũ ×2,05 và ×2,5). Cấp 1 giữ nguyên, cấp 6 ở cỏ chỉ giảm 1. |
| 3. (Không đổi) tần suất | `WILD_SKILL_GAP_MS`, 0,06, `WILD_COOLDOWN_FACTOR`, `WILD_ATTACK_COOLDOWN_MS` | giữ nguyên | Chiêu đã hiếm (1 chiêu mỗi 6-7 s); đổi tần suất kéo theo sửa test/giao thức nhịp mà ít tác dụng hơn đổi hai hằng số trên. |

Với 1 và 2, đỉnh sát thương một lần của mọi thú hoang thường <= 33 (cắn <= 20 ở cấp 14, <= 18 ở cấp 11), tức cần ít nhất 4 đòn (5 đòn nếu có giáp 30%: 33 × 0,7 = 23) mới hạ được người chơi 100 máu.

**Bảng thời gian trụ sau khi đổi (cấp 8 + hệ số cắn 0,08), cùng điều kiện bảng hiện trạng**

| Vùng, thú, cấp | 1 thú, không giáp (cũ -> mới) | 1 thú, giáp 30% | 2 thú, giáp 30% | 3 thú, không giáp |
|---|---|---|---|---|
| cỏ, emberpup 6 | 8,8 -> 9,6 | 12,7 -> 13,9 | 6,5 -> 6,7 | 2,5 -> 2,9 |
| núi lửa, boulderhorn 8 | 4,4 -> 5,5 | 6,1 -> 7,2 | 2,7 -> 3,4 | 1,6 -> 1,7 |
| núi lửa, boulderhorn 11 | 3,3 -> 4,4 | 4,4 -> 6,3 | 2,1 -> 3,1 | 1,5 -> 1,7 |
| sa mạc, scorchtail 10 | 4,2 -> 5,8 | 6,1 -> 8,0 | 2,9 -> 3,2 | 1,4 -> 1,6 |
| tuyết, frostfang 11 | 4,3 -> 5,3 | 5,5 -> 8,1 | 2,5 -> 3,4 | 1,6 -> 1,8 |
| đầm lầy, cactoad 11 | 5,2 -> 6,4 | 7,0 -> 9,2 | 3,3 -> 4,4 | 1,7 -> 2,1 |
| đảo, coralcrab 13 | 3,1 -> 5,1 | 5,1 -> 6,9 | 2,4 -> 3,3 | 1,3 -> 1,7 |
| góc xa, coralcrab 14 | 3,1 -> 5,1 | 4,3 -> 6,9 | 1,9 -> 3,3 | 1,3 -> 1,7 |

Thời gian kéo dài +20% đến +65% (đáng kể nhất ở đảo và góc xa, đúng chỗ cấp cao). Hai phương án phụ đã thử: chỉ giới hạn chiêu (1): +0 đến +1,1 giây; giới hạn chiêu + hệ số 0,10: giữa hai mức trên (đảo 13: 4,2; góc xa 14: 4,2/5,9). Hệ số 0,08 chọn vì đạt mục tiêu "người đứng yên trụ >= 5 giây trước 1 thú ở cấp tối đa thường gặp" cho hầu hết vùng.

**Xác suất chết khi đánh thú có kiếm + giáp da/nón 30% + thú đi theo cấp 9, thú chịu 30% đòn** (cũ -> mới)

| Trận | né 0% | né 50% |
|---|---|---|
| 2 thú, núi lửa 11 | 100% -> 100% | 39% -> 7% |
| 2 thú, tuyết 11 | 100% -> 55% | 5% -> 0% |
| 2 thú, đảo 13 | 100% -> 100% | 29% -> 2% |
| 2 thú, góc xa 14 | 100% -> 100% | 62% -> 7% |
| 3 thú, sa mạc 10 | 100% -> 100% | 33% -> 4% |
| 3 thú, núi lửa 11 | 100% -> 100% | 99% -> 91% |

Thú đi theo cấp 15 + giáp hiệp sĩ (45%) + né 50%: 2 thú ở núi lửa 11 chết 4% -> 0%; 3 thú ở núi lửa 11 chết 81% -> 36%, 3 thú đảo 13 từ 79% -> 38%. Kết luận: 1 thú hoang thường không còn đe doạ người có kiếm và thú đi theo (đã ổn từ trước); 2 thú vẫn đáng sợ khi đứng yên (đúng ý đồ: phải lướt); 3 thú cấp cao cùng lúc vẫn là ác mộng (hiếm: chỉ boulderhorn/scorchtail chủ động, mật độ khoảng 80 thú trên cả bản đồ), không cần nới thêm.

## Rủi ro

- **Thú đi theo không bị ảnh hưởng**: `skillPower`/`SKILL_LEVEL_SCALING` giữ nguyên, đường cấp của thú đi theo (cấp 8-9 sau buổi đầu, cấp 15 sau ~4 buổi) không đổi. Chỉ chiêu thú hoang từ cấp 8 trở lên yếu đi; chiêu của chính thú người chơi bắt được cấp 15 (kể cả cấp 15 học chiêu 3) vẫn ×2,68. Đường cắn của thú hoang (`wildDamage`) tách khỏi `companionDamage`, nên thú đi theo không bị nhẹ đi.
- **Thú đầu đàn**: dùng chung `wildDamage`, nên cắn nhẹ đi khoảng một phần ba (31-36%: voltmouse cấp 15: 16 -> 11, bogbloom cấp 17: 17 -> 11, cactoad cấp 18: 28 -> 19, frostfang cấp 19: 33 -> 22, scorchtail cấp 20: 35 -> 23, coralcrab cấp 22: 42 -> 27). Thời gian trụ của người đứng yên (không giáp / giáp 30%): voltmouse 5,0/7,0 -> 6,1/8,7; bogbloom 4,4/7,0 -> 6,1/10,5; cactoad 3,2/4,4 -> 4,3/5,9; frostfang 2,6/4,4 -> 3,3/5,3; scorchtail 2,3/3,3 -> 3,3/5,1; coralcrab 2,2/3,2 -> 3,2/4,5. Không giáp vẫn chỉ 3,2-6,1 giây, gắt hơn trùm (khoảng 7 giây). Muốn giữ thú đầu đàn y nguyên: `ALPHA.damageMultiplier` 1 -> 1,5 (hệ số bù đúng 1,45-1,56 tuỳ con; với 1,5 cắn thành 17/17/29/33/35/41 so với cũ 16/17/28/33/35/42 và thời gian trụ về mức cũ, lệch tối đa 0,1 giây). Đề xuất của mình: **không bù**, vì thú đầu đàn cấp 19-22 hạ người chơi không giáp trong 2,2-2,6 giây là quá gắt so với trùm (khoảng 7 giây); nếu designer muốn đầu đàn khó như cũ thì bù bằng 1,5. Chiêu của đầu đàn (đã giới hạn cấp 8) không đổi. Trùm không đổi (cắn cố định 14, chiêu cấp 4).
- **Test có thể phải sửa**: `daycycle.test.ts:51` chỉ kiểm `wildDamage(boulder, 5) > wildDamage(boulder, 1)` (vẫn đúng với 0,08: 13 > 10). Không thấy test nào khoá giá trị `skillPower` của thú hoang hay cú cắn cụ thể; cần thêm test cho `WILD_SKILL_MAX_LEVEL` (thú hoang cấp 14 dùng cấp 8, thú đi theo cấp 14 vẫn dùng cấp 14) và `wildDamage` cấp 14. Test e2e/tích hợp dựa vào lượng máu mất sau cú cắn của thú ở cấp cao cần kiểm lại (chưa tìm thấy qua grep trong `packages` và `tests`).
- **Tài liệu**: `docs/design/skills.md:69` nhắc `ALPHA.skillLevel`; thêm dòng cho giới hạn thú hoang thường.
- **Thú hoang quá dễ ở vùng xa**: không. Người đứng yên không giáp trước một thú cấp 13-14 vẫn chỉ trụ được 5,1 giây, và máu của thú hoang vẫn +20%/cấp (270 máu cấp 14) nên trận kéo dài hơn; 2 thú vẫn hạ người đứng yên có giáp 30% ở mọi vùng cấp 11+ trong 3,1-4,4 giây, 3 thú vẫn hạ người không giáp trong khoảng 2 giây (1,6-2,1). Nếu sau này thấy quá dễ: nâng `WILD_SKILL_MAX_LEVEL` lên 10 hoặc hệ số cắn lên 0,10 (số liệu kèm trong mục phụ trên).
- **Không đổi**: nhịp tung chiêu/cắn (hiện 1 chiêu mỗi 6-7 giây, cắn mỗi 1,2 giây), giáp, máu người chơi (không thay mô hình chịu đòn); đổi những cái này ảnh hưởng tới thú đầu đàn, trùm, và test nhịp.

**Đã sửa sau khi rà lại:** (1) bảng sát thương mỗi lần: cú cắn scorchtail cấp 10 là 21 (bản trước ghi 24), coralcrab cấp 13 là 28 (ghi 29); chiêu mạnh nhất của coralcrab là pincer 27/28 (ghi water_jet 22/23, chiêu AI ưu tiên dùng); DPS dòng boulderhorn 8 đo lại đúng cấp 8 là 17,1 / 4,3 (ghi 17,9 / 4,5 là số của cấp 9). (2) Câu "trừ scorchtail 10, cactoad 11": hiện tại chết 100%, không trừ trận nào; con số cũ 3-8% là của phương án hệ số 0,10, nay tính lại với 0,08 (chết khoảng 44% và 66%). (3) Mục Rủi ro, thú đầu đàn: tính lại với hệ số cắn 0,08 (bản trước dùng 0,10): cắn giảm 31-36%, thời gian trụ mới, hệ số bù 1,45-1,56, tức khoảng 1,5 chứ không phải 1,3. (4) Hiện trạng: cấp 14 không xuất hiện (đất xa nhất danger 0,91), boulderhorn tối đa cấp 11, thú hoang thường không bao giờ dùng thunder lên người (voltmouse, mothlume là thú thụ động). (5) Phép tính "1-2 chiêu" ở Vấn đề 1; "dưới 2 giây" ở Vấn đề 4 (đúng là 1,7-2,1) và Rủi ro (1,6-2,1); "3 chiêu lớn có giáp 30%" ở Đề xuất (đúng là 5 đòn); ví dụ cactoad trong bảng Đề xuất (needle_spray 23 -> 17, không phải vine_bind 20 -> 15); câu "Một thú cấp 13-14 vẫn trụ được" ở Rủi ro viết lại cho đúng chủ ngữ. Đề xuất chính không đổi (`WILD_SKILL_MAX_LEVEL` = 8, `WILD_DAMAGE_PER_LEVEL` = 0.08, không bù `ALPHA.damageMultiplier`).
