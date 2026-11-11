PASS
# REVIEW: T21 Thân trùm 40, đường về nhà bằng tìm đường, giới hạn đường vòng khi đuổi, vòng 1

## Kết luận
Thay đổi làm đủ 6 bước và mọi tiêu chí hoàn thành trong PLAN.md, khớp `docs/design/pals.md` (mục "Trùm Vua Đá: thân và đường về nhà", gạch "Trùm không đi vòng quá xa"), không làm gì ngoài phạm vi. Không thấy lỗi logic, lỗ gian lận hay chi phí tick đáng kể. Tôi đã chạy lại `typecheck` và 14 test liên quan (pathing, boss), tất cả qua. Còn một chú thích JSDoc đặt sai chỗ: chỉ là góp ý, không làm FAIL.

## Lỗi phải sửa
(không có)

## Đã kiểm
- **Cờ `bossReturning`:**
  - Bật khi trùm không đánh ai mà cách nhà quá `BOSS.leash`. Tắt khi về tới nơi: lúc đó trùm còn được não lang thang mới (`newBrain(pal)`), và vì hàm `return true` nên biến `brain` cũ trong tick không bị dùng tiếp.
  - Tắt cả trong `spawnBoss`, và trong `removePal` khi `palId === this.bossId`. `defeatBoss` gọi `removePal(bossId)` trước `this.bossId = undefined` (GameRoom.ts:1703-1704), nên cờ được tắt đúng.
  - Bị khiêu khích lúc đang về: nhánh đánh (`wildTarget`) chạy trước nên trùm vẫn đánh, đánh xong còn cờ thì về tiếp, đúng thiết kế ("vẫn đánh", về tới 128 px).
  - Chạy tick sau khi trùm đã mất: không sao, vì `state.pals.forEach` không còn trùm và cờ đã tắt.
- **Đuổi, dây giới hạn, lang thang:**
  - `bossHeadHome` chặn trước `stepWander`. Thú đầu đàn không bị đụng: `home` là `undefined` với trùm.
  - `stepWander` giờ dùng `radius`. Với thú thường và thú đầu đàn, `radius === species.size`, nên không đổi gì.
  - Không bước xuống biển: giống nhánh đuổi.
  - `stepChase` không có đường vòng thì dừng ở `0,7 × 128 ≈ 90` px, mà `inRange` tính ở 128 px, nên lúc tới nơi cờ luôn tắt.
- **`PathPlanner`:**
  - `maxPath` được chép vào `query` mỗi lần xếp hàng, nên lần gọi về nhà (không có `maxPath`) xoá giới hạn của lần đuổi trước.
  - Lần bị từ chối vẫn tính vào `searches` và `expanded`, rồi `drop` và chờ `failRetryMs` (2 s), nên không chiếm ngân sách liên tục và không làm đói các thú khác.
  - Nhánh `else` cũ (đường `found` nhưng rỗng thì chờ `retryMs`) giữ nguyên hành vi.
  - `pathLength` không cấp phát; `detourLimit` O(1); chỉ một con trùm. Chi phí tick không đáng kể.
- **Hằng số:**
  - `BOSS` có đủ 4 trường, mỗi trường có JSDoc tiếng Anh, chú thích `radius` đã sửa.
  - `BOSS_LEASH` và `8 * 32` đã bỏ.
  - `BOSS_DETOUR.max` suy ra từ tốc độ loài × `WILD_CHASE_SPEED_FACTOR` × `WILD_AGGRO_MS`, không ghi số cứng.
  - Thú khác nhận `maxPath: undefined`.
- **Test:**
  - 3 test unit và 3 test tích hợp kiểm đúng hành vi: có đối chứng không giới hạn (đi xa hơn 150 px), có kiểm mốc thử lại theo `failRetryMs`, có kiểm không lấn vật cản ở mọi tick.
  - Tester chạy 3 đột biến, đều làm đúng test tương ứng hỏng. Riêng đột biến thứ ba không làm hỏng test unit "tường dài", vì test đó tự truyền `maxPath`; PLAN.md ghi nhầm chỗ này, không phải lỗi của test.
  - Không có test cũ nào bị nới.
- Không đổi giao thức, schema, hồ sơ hay client. Không có `debug:*` mới.

## Góp ý không bắt buộc
- `packages/server/src/rooms/GameRoom.ts:1612`: JSDoc của `spawnBoss` ("The giant Boulderhorn appears at the foot of the volcano.") nằm trơ phía trên JSDoc của `bossHeadHome`, nên `spawnBoss` mất chú thích. Nên chuyển dòng đó xuống ngay trên `private spawnBoss()`. Có thể sửa khi commit nhiệm vụ sau đụng tới file này, hoặc ghép vào T41.
- **Cùng key `w:${id}` cho lúc đuổi và lúc về nhà:**
  - Khi trùm đổi từ đuổi sang về nhà, nếu còn đường cũ thì `steer` trả điểm mốc của đường đuổi trong tối đa 0,5 s (`retryMs`).
  - Nếu lần đuổi vừa bị từ chối, trùm đi thẳng về nhà trong tối đa 2 s rồi mới được tìm đường.
  - Thú đầu đàn cũng vậy, và lỗi này cùng nhóm với các mục của T41 ("bỏ đường cũ"). Đề xuất ghi vào T41: khi đích đổi hẳn (đổi chế độ), gọi `drop` và đặt lại `nextSearchAt`.
- **Test chưa có (không bắt buộc theo PLAN.md):**
  - trùm đang về nhà bị khiêu khích, đánh xong lại về tiếp, kể cả khi đã ở trong 256 px;
  - `bossReturning` tắt sau `defeatBoss` và khi trùm xuất hiện lại.
  Có thể thêm khi làm T41.
- Test unit "keeps the boss pressing on..." ghi cứng `max: 648`. Có thể dựng như `BOSS_DETOUR` (đã có câu kiểm 648 ở test "matches the boss table"), để khi đổi tốc độ loài chỉ một chỗ hỏng.

## Việc tiếp theo đề xuất cho TASKS.md
- **T41:**
  - bỏ ý cuối (sửa câu về đường tìm khi bị kẹt trong `pals.md`), vì game-designer đã sửa trong T21;
  - thêm: bỏ đường và đặt lại thời điểm tìm khi một thú đổi đích (đuổi sang về nhà);
  - thêm: chuyển JSDoc `spawnBoss` về đúng chỗ;
  - tuỳ chọn: đo xem `Walker.maxPath` có giúp thú thường không.
- **Việc mới, ưu tiên thấp:** trùm về nhà quá 60 giây thì hiện lại ở nhà. Chỉ làm nếu chơi thử thấy trùm lạc mãi (khoảng 8% lần bị dụ sang phía bên kia núi lửa).
