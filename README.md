# osu! hidden stats card

![preview](docs-preview.png)

A live PNG card in the osu!lazer style that shows the stats an osu! profile **does not** display, for **any** player.
Paste one BBCode block into a me! page and the card keeps itself up to date (cached for 15 minutes).

```
https://<app>.vercel.app/card/<username>.png             # osu! standard
https://<app>.vercel.app/card/<username>.png?mode=mania  # taiko | fruits | mania
https://<app>.vercel.app/card/<username>.png?scale=2     # 2x resolution
https://<app>.vercel.app/card/demo.png                   # sample data, no API needed
https://<app>.vercel.app/api/bbcode?u=<username>         # ready-to-paste BBCode with clickable imagemap
```

The home page (`https://<app>.vercel.app`) has a small generator: type a username, pick a mode, copy the BBCode.

## What's on the card

Only things the osu! profile page doesn't show:

- **Progress & ranking**
  - pp needed to pass the player one rank above (rank ≤ 10,000)
  - raw pp a new play needs to add +1pp to the total
  - total score left until the next level, plus the exact fractional level
  - rank change over 7 / 30 / 90 days, average rank change per day, best and worst rank in the last 90 days
- **Lifetime**
  - total 300 / 100 / 50 / miss counts and their ratios
  - lifetime accuracy computed from every hit (the profile accuracy only weights top plays)
  - misses per play, average play length, ranked score per play, plays per day, hours per week
- **Top 100 deep-dive**
  - bonus pp, average pp / accuracy / star rating / BPM / length, accuracy range, no-miss plays
  - mod combinations (HDDT, HDHR…), pp distribution, the year each top play was set
  - newest top play, top plays set in the last 30 days, most-farmed mapper and artist
- **Last 24 hours:** plays including fails, pass rate, average accuracy, best pp play, most retried map
- **Activity pattern:** most active month, average plays per month over the last 12 months, this month vs last month, number of active months
- **Mapping deep-dive**
  - total plays and favourites on your own maps, plays per set, favourites per 1k plays
  - number of difficulties, average and max star rating, ranked + loved rate
  - first submitted map, most played and most favourited map

## Deploy (about 5 minutes, free)

1. **Create an osu! OAuth app:** go to https://osu.ppy.sh/home/account/edit → **OAuth** → *New OAuth Application*.
   Any name, leave the callback URL empty. Keep the **Client ID** and **Client Secret**.
2. **Vercel:** https://vercel.com → *Add New → Project* → import this repository.
   Under *Environment Variables* add:
   - `OSU_CLIENT_ID` = your Client ID
   - `OSU_CLIENT_SECRET` = your Client Secret

   Click **Deploy**.
3. Open `https://<app>.vercel.app`, enter a username → **Generate** → **Copy**, then paste it into the me! section of the osu! profile.

## Font

osu! uses **Torus** (Paulo Goode), which is a commercial font. Its licence file in ppy/osu-resources says it needs a licence to be distributed, so it is not included here.

- By default the card uses **Kumbh Sans**, the closest free look-alike. Nunito is the fallback for Vietnamese characters.
- If you own a licensed copy of Torus (`.otf` / `.ttf`), drop it into `fonts/torus/` and the card switches to it automatically. Don't commit it to a public repository.

## Notes

- The image cannot know which profile it is embedded on (osu! loads images through its own proxy), so the username is part of the image URL. Each player uses a link with their own name.
- Editing a me! page requires the account to have (or have had) osu!supporter.
- Local preview: `npm install && npm run preview`, which writes `preview.png` from sample data.
- Layout and colours live in `lib/render.js`; data fetching and the derived stats are in `lib/osu.js`.
