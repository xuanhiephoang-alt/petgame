PASS
# REVIEW: T14 Bộ ảnh `npm run shots` chắc chắn, thêm nhóm skills/alpha/toasts, vòng 3

## Kết luận
Lỗi chặn của vòng 2 đã sửa đúng gốc: lời cảnh báo lãnh địa nay đi qua giá trị `setup` trả về, nên truyền bản sao của cảnh cũng không còn làm mất nó. Ba ảnh `labels-*-alpha` đã có lời cảnh báo. Gộp hàm không đổi hành vi, và không có vấn đề mới. "Stood elsewhere" 7/53 có lý do rõ (thử lại dời chỗ, chọn chỗ theo thú) và không che lỗi dựng cảnh: là việc sau, không chặn. Không còn lỗi phải sửa.

## Đã kiểm
1. **Lỗi chặn vòng 2 đã hết:**
   - `capture` (`shotsPage.mjs:257`) dùng `const toasts = made.toasts ?? scene.toasts` cho cả `settle` lẫn `judgeScene`.
   - `alphaScene.setup` trả `{ target, toasts: [warning] }` và không còn tự ghi `scene.toasts`.
   - `labelShots` gắn `measure` vào chính `lair` rồi `capture(page, file, lair)`.
   - Tôi tự xem `shots/t14-t3a/labels-landscape-alpha.png` và `shots/t14-t3b/labels-portrait-alpha.png`:
     - cả hai có "★ Lãnh địa của Voltmouse đầu đàn (Lv 15)…";
     - nhãn thú đầu đàn không bị thông báo che;
     - ở điện thoại dọc, nhãn nằm ngay trên nút "Thường", đúng ngoại lệ đã ghi.
   - `ready` của cảnh dùng `TAG_CLEAR_SELECTOR`, gồm cả `.hud-toasts > .toast`, nên kiểm cuối tính đúng lời cảnh báo thật đang hiện.
   - Nếu lần thử hỏng sau khi lời cảnh báo đã hiện, `setup` lần sau gọi `waitNoToasts` trước.
   - Hai ca canh mới trong `shotsCapture.test.mjs` khoá cả hai chỗ; tester đã thử đột biến.
2. **Gộp hàm không đổi hành vi:**
   - `calmSpot` gọi `firstCalm(candidates, readPals, radius)`: cùng phép `hypot < radius`, cùng thứ tự ứng viên, chỉ đọc thêm trường thừa.
   - `findLeader` trả `{ x, y, level }`: chỗ dùng trong `setup` cần `level`, chỗ `hopAt` chỉ dùng `x`, `y`.
   - `labels-*-wild` dùng `readPals` chung, cùng dạng `{ id, speciesId, x, y, alpha, boss }` với hàm cục bộ cũ.
   - `labelUpdateMs` có hạn 20 s, hết hạn thì lấy trung bình số lần đã gọi; nhánh thường không đổi.
3. **Không có vấn đề mới:**
   - Chạy lại `npx vitest run scripts/`: 59 ca qua.
   - `git diff HEAD -- packages tests .claude` rỗng; `git stash list` vẫn 2 mục.
   - Chú thích đầu `shots.mjs` và `docs/architecture.md` giờ mô tả đúng `PETGAME_SHOTS_FAULT`: tâm hang bị vật cản, cảnh không ổn định, hỏng sau 3 lần, không ghi `.png`, thoát mã 1.
   - Hai lần chạy đầy đủ của tester: 53 ảnh, 0 cảnh hỏng, mã 0. `--compare` ra 0 mục cần xem; lệch `steady` lớn nhất ở cảnh đứng cùng chỗ là 3 (≤ 4).

## Đánh giá "stood elsewhere" 7/53: việc sau, không chặn
Tôi tính từ `report.json` của `t14-t3a` và `t14-t3b`:

| Cảnh | Cách nhau | `tries` a/b | `steady` a/b | Vì sao |
|---|---|---|---|---|
| `aim-phone` | 260 px | 2/1 | 237/186 | lần thử 1 hỏng, `AIM_RETRY` dời 260 px lên bắc |
| `aim-desert` | 260 px | 2/1 | 121/104 | như trên |
| `skills-desktop-cast` | 903 px | 3/1 | 199/226 | lần thử sau sang chỗ `CALM` khác |
| `skills-portrait-cast` | 240 px | 1/2 | 301/325 | như trên |
| `labels-desktop-alpha` | 31 px | 2/1 | 244/247 | thử lại, chỗ đứng gần như cũ |
| `labels-landscape-alpha` | 66 px | 2/1 | 287/302 | thử lại theo thú đầu đàn |
| `alpha-portrait-meadow` | 68 px | 2/2 | 362/385 | chọn chỗ theo thú đầu đàn |

- Cả 7 cảnh đều có thử lại ở ít nhất một lần chạy. Không cảnh nào lệch chỗ khi cả hai lần đều thành công ngay lần đầu, tức không có chỗ đứng ngẫu nhiên "lén".
- Hai ảnh cách nhau 260-900 px là hai ảnh khác nhau. So `steady` của chúng chỉ sinh cờ giả, nên bỏ so là đúng. Các cờ còn lại (`over budget`, nhãn chồng, vòng ngắm, thông báo đè HUD) vẫn được xét, và dòng vẫn in ghi chú để người so nhìn.
- Số cảnh này dao động theo số lần thử lại (4 rồi 7). Nguyên nhân gốc là thú hoang ngẫu nhiên, đúng việc T46 (`debug:clearPals`) sẽ gỡ. Sửa thật trong T14 thì cần hook mới, trái PLAN.
- Kết luận: chấp nhận cho T14, kèm việc sau (dưới). Đồng ý với hướng của agent chính.

## Lỗi phải sửa
Không có.

## Góp ý không bắt buộc (việc sau, để đưa vào TASKS.md)
1. **Giảm "stood elsewhere" sau T46** (P2): khi có `debug:clearPals`, dọn thú hoang quanh chỗ chụp, cho `aim`, `skills`, cảnh thú đầu đàn ít phải thử lại hay dời chỗ.
   - Trong `--compare`, in thêm số cảnh "stood elsewhere" ở dòng tổng.
   - Gắn cờ (không chỉ ghi chú) cho cảnh đứng khác chỗ dù cả hai lần đều `tries: 1`: đó mới là dấu hiệu chọn chỗ không tất định.
   - Cân nhắc lần thử lại của `aim` giữ nguyên chỗ trước khi dời 260 px.
2. **Thời gian nhóm `labels` và `alpha`** (P3): `labels` từng 4m04s (vượt mốc 4 phút/nhóm của PLAN 4 giây), `alpha` 3m25s-3m42s; cả bộ 11-13 phút. Cách giảm: hạ `deadline` 60 s / `hopAt` 30 s của cảnh thú đầu đàn, dùng chung context `skills` + `toasts` như PLAN cho phép, và giảm số lần thử lại nhờ T46.
3. **Dọn trùng lặp phần chạy trong trang** (P3): đoạn tìm thú đầu đàn theo loài còn lặp trong `tagCheck` (`shotsPage.mjs`) và `alphaScene.measure` (`shotGroups.mjs`); đoạn đọc thú đi theo của mình lặp ở `settleStatus`, `sceneState`, `alphaScene.measure`. Có thể đưa vào một hàm gắn lên `window` một lần (ví dụ trong `watchHurt` hay `inWorld`) rồi các `evaluate` gọi lại.
4. **Ảnh cũ sót lại** (P3): khi một nhóm chết giữa chừng (lỗi không phải `SceneError`), hoặc `--only` ghi vào thư mục `--name` đã có, ảnh của cảnh chưa chụp lần này vẫn nằm đó trông như mới. Lúc ghi `report.json`, xoá mọi `*.png` không có dòng `ok: true` (hoặc ghi danh sách đó vào `run.json`).
5. **`PETGAME_SHOTS_FAULT` kiểm cả mối đe doạ** (P3): hiện chỉ chứng minh "cảnh không ổn định thì không ghi ảnh", và làm cảnh sau hỏng theo. Đặt `target = serverSpot(lair + khoảng 60 px)` để đường `threat` thật sự chạy, và về `RETREAT` sau lần thử cuối.
6. **Thay test đọc mã nguồn bằng test hành vi** (P3): `shotsCapture.test.mjs` nay có 9 ca regex trên mã nguồn. Tách các quyết định thành hàm thuần trong `shotsLib.mjs` có unit test:
   - vòng chờ thú đầu đàn ("đứng tốt 1,5 s, không nguy hiểm");
   - bảng `minClear`/`lead` theo khung;
   - cách chọn `toasts` của `capture`.

   Rồi bỏ dần các regex.
7. **Dọn `shots/`** (agent chính, không phải code): hơn 30 thư mục thử (`dbg*`, `mut*`, `r2-alpha*`, `t14-*`...). Thư mục đã gitignore nên không hại; xoá cho gọn ổ đĩa nếu muốn.
