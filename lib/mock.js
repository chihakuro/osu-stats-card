// Sample data so the card can be previewed without osu! API credentials (?demo=1).
const svg = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

const cover = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="170">
  <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff66ab"/><stop offset="0.55" stop-color="#7a3cff"/><stop offset="1" stop-color="#1e88e5"/></linearGradient></defs>
  <rect width="1000" height="170" fill="url(#a)"/>
  <circle cx="820" cy="40" r="140" fill="#fff" opacity="0.08"/><circle cx="180" cy="190" r="120" fill="#fff" opacity="0.06"/>
  <circle cx="560" cy="90" r="60" fill="none" stroke="#fff" stroke-width="10" opacity="0.18"/>
</svg>`);

const avatar = svg(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <rect width="256" height="256" fill="#2e2a3a"/>
  <circle cx="128" cy="128" r="84" fill="#ff66ab"/><circle cx="128" cy="128" r="62" fill="#fff"/>
  <text x="128" y="152" font-size="70" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#ff66ab">osu</text>
</svg>`);

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

export const mock = {
  mode: 'osu',
  user: { id: 1234567, username: 'DemoPlayer', country: 'VN', countryName: 'Vietnam', supporter: true, avatar, cover, flag: null },
  stats: {
    pp: 6421.7, globalRank: 41231, countryRank: 312, acc: 98.137, lifetimeAcc: 94.62,
    level: 101, levelExact: 101.63, scoreToNextLevel: 61_220_000_000,
    playCount: 48213, playTime: 3_412_800, rankedScore: 41_238_771_093,
    c300: 13_910_442, c100: 811_204, c50: 160_655, miss: 302_118,
    playsPerDay: 17.2, hoursPerWeek: 3.4, scorePerPlay: 855_344, toNext: 0.84,
  },
  rank: { change7: 412, change30: 2210, change90: 6919, best: 41231, worst: 48150, perDay: 77 },
  activity: {
    mostActive: { date: '2025-08-01', count: 1840 }, avg12: 912, thisMonth: 384, lastMonth: 1102,
    activeMonths: 71, accountMonths: 92,
  },
  top: {
    count: 100, top1: 412.6, last: 248.3, avgPP: 301.4, weightedPP: 6005.5, bonusPP: 416.2, rawForPlusOne: 263.8,
    avgAcc: 97.82, accMin: 93.1, accMax: 100, avgSR: 6.21, avgBPM: 214, avgLen: 141, noMiss: 63,
    newest: daysAgo(3), oldest: daysAgo(1400), last30: 7,
    combos: [
      { mod: 'HDDT', count: 39 }, { mod: 'HD', count: 21 }, { mod: 'NM', count: 19 },
      { mod: 'HDHR', count: 11 }, { mod: 'DT', count: 6 }, { mod: 'HR', count: 4 },
    ],
    hdShare: 0.71,
    topMapper: { name: 'Sotarks', count: 14 }, uniqueMappers: 61, topArtist: { name: 'xi', count: 6 },
    hist: [31, 22, 15, 11, 9, 6, 4, 2].map((count, i) => ({ from: 248 + i * 20.5, count })),
    years: [ { year: '2020', count: 4 }, { year: '2021', count: 9 }, { year: '2022', count: 13 }, { year: '2023', count: 18 }, { year: '2024', count: 21 }, { year: '2025', count: 24 }, { year: '2026', count: 11 } ],
  },
  recent: { plays: 38, passes: 22, passRate: 57.9, avgAcc: 96.41, bestPP: 287, mostRetried: { name: 'Camellia - GHOST', count: 9 } },
  mapping: {
    ranked: 3, loved: 1, guest: 7, pending: 2, graveyard: 14, nominated: 0, sets: 20,
    followers: 58, kudosuTotal: 129, kudosuAvail: 41,
    totalPlays: 1_284_330, totalFavs: 2741, avgPlays: 64_216, favPer1kPlays: 2.13,
    difficulties: 46, avgSR: 4.87, maxSR: 7.42, rankRate: 20,
    mostPlayed: { title: "Camellia - Exit This Earth's Atomosphere", plays: 812_440 },
    mostFav: { title: 'xi - Blue Zenith', favs: 1530 },
    firstSubmit: '2019-09-02T00:00:00Z', lastActivity: daysAgo(12),
  },
};
