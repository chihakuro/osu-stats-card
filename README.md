# osu! stats card

![preview](docs-preview.png)

Ảnh PNG "live" theo phong cách osu!lazer, hiện thống kê chi tiết của **bất kỳ** người chơi osu! nào.
Dán BBCode vào me! page là xong, ảnh tự cập nhật (cache 15 phút).

```
https://<app>.vercel.app/card/<username>.png            # osu! standard
https://<app>.vercel.app/card/<username>.png?mode=mania # taiko | fruits | mania
https://<app>.vercel.app/card/<username>.png?scale=2    # ảnh nét gấp đôi
https://<app>.vercel.app/card/demo.png                  # dữ liệu mẫu, không cần API
https://<app>.vercel.app/api/bbcode?u=<username>        # BBCode có sẵn imagemap
```

## Deploy (khoảng 5 phút, miễn phí)

1. **Tạo OAuth app osu!:** vào https://osu.ppy.sh/home/account/edit → mục **OAuth** → *New OAuth Application*.
   Đặt tên tuỳ ý, Callback URL để trống. Lưu lại **Client ID** và **Client Secret**.
2. **Đưa code lên GitHub:** tạo repo mới, upload toàn bộ thư mục này (trừ `node_modules`).
3. **Vercel:** https://vercel.com → *Add New → Project* → import repo vừa tạo.
   Trong *Environment Variables* thêm:
   - `OSU_CLIENT_ID` = Client ID
   - `OSU_CLIENT_SECRET` = Client Secret

   Bấm **Deploy**.
4. Mở `https://<app>.vercel.app`, gõ username → **Generate** → **Copy** → dán vào me! trên profile osu!.

## Card có gì (chỉ những thứ profile osu! KHÔNG hiện)

- **Progress & ranking:** pp còn thiếu để vượt người hạng trên (rank ≤ 10k), raw pp cần cho một play để +1pp, total score còn thiếu để lên level kế tiếp (kèm level lẻ), thay đổi rank 7/30/90 ngày, trung bình rank/ngày, rank tốt/tệ nhất 90 ngày
- **Lifetime:** tổng 300/100/50/miss + tỉ lệ, accuracy thật tính từ toàn bộ hit (khác acc trên profile vốn chỉ tính từ top play), miss/play, độ dài play trung bình, ranked score/play, plays/ngày, giờ chơi/tuần
- **Top 100 deep-dive:** bonus pp, avg pp/acc/★/BPM/length, khoảng acc, số play không miss, tổ hợp mod (HDDT, HDHR…), phân bố pp, top play được lập năm nào, top play mới nhất, số top play 30 ngày qua, mapper/artist "farm" nhiều nhất
- **24 giờ qua:** số play kể cả fail, pass rate, acc trung bình, play nhiều pp nhất, map retry nhiều nhất
- **Activity pattern:** tháng chơi nhiều nhất, trung bình/tháng 12 tháng gần đây, tháng này so với tháng trước, số tháng có chơi
- **Mapping deep-dive:** tổng lượt chơi & favourite trên map của mình, plays/set, favs trên 1k plays, số diff, ★ trung bình/cao nhất, tỉ lệ ranked+loved, map đầu tiên, map được chơi & favourite nhiều nhất

## Font

Font của osu! là **Torus** (Paulo Goode). Đây là font thương mại: file trong repo osu-resources ghi rõ cần licence mới được phân phối, nên app không kèm sẵn.
- Mặc định app dùng **Kumbh Sans**, font miễn phí trông gần Torus nhất.
- Nếu bạn có file Torus hợp lệ (`.otf`/`.ttf`), bỏ vào `fonts/torus/` thì card tự đổi sang Torus. Đừng đưa file đó vào repo public.

## Ghi chú

- Ảnh không thể tự biết nó đang nằm trên profile nào (osu! tải ảnh qua proxy), nên username nằm trong link ảnh. Mỗi người dùng link có username của chính họ.
- Sửa me! page cần tài khoản đang/đã từng có osu!supporter.
- Xem trước giao diện trên máy: `npm install && npm run preview` → `preview.png`.
- Chỉnh màu/bố cục trong `lib/render.js`; lấy dữ liệu trong `lib/osu.js`.
