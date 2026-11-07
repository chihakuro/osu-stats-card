// Builds the card (osu!lazer look) and renders it to PNG. Focus: stats the osu! profile does not show.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------- fonts ----------
// Uses your own Torus files from fonts/torus/ when present (osu!'s font, commercial licence),
// otherwise Kumbh Sans, the closest free look-alike. Nunito covers Vietnamese characters.
const FONT_DIR = join(process.cwd(), 'fonts');
let fonts;
function loadFonts() {
  if (fonts) return fonts;
  const list = [];
  const torusDir = join(FONT_DIR, 'torus');
  const torus = existsSync(torusDir) ? readdirSync(torusDir).filter((f) => /\.(otf|ttf|woff)$/i.test(f)) : [];
  const weightOf = (f) => (/black|heavy/i.test(f) ? 800 : /bold/i.test(f) && !/semi/i.test(f) ? 700 : /semi/i.test(f) ? 600 : /light/i.test(f) ? 300 : 400);
  if (torus.length) {
    for (const f of torus) list.push({ name: 'Card', weight: weightOf(f), style: 'normal', data: readFileSync(join(torusDir, f)) });
    // Torus has no 800 – reuse the boldest file for it
    const boldest = torus.sort((a, b) => weightOf(b) - weightOf(a))[0];
    list.push({ name: 'Card', weight: 800, style: 'normal', data: readFileSync(join(torusDir, boldest)) });
  } else {
    for (const w of [400, 600, 700, 800]) {
      for (const s of ['latin', 'latin-ext', 'symbols']) {
        list.push({ name: 'Card', weight: w, style: 'normal', data: readFileSync(join(FONT_DIR, `kumbh-sans-${s}-${w}-normal.woff`)) });
      }
    }
  }
  for (const w of [400, 700, 800]) {
    list.push({ name: 'Fallback', weight: w, style: 'normal', data: readFileSync(join(FONT_DIR, `nunito-vietnamese-${w}-normal.woff`)) });
  }
  fonts = list;
  return fonts;
}

// ---------- palette (osu!lazer, pink theme) ----------
const C = {
  bg: '#1c1719',
  panel: '#2a2226',
  panel2: '#352b30',
  line: '#46393f',
  text: '#ffffff',
  dim: '#b8a8b0',
  faint: '#87757e',
  pink: '#ff66ab',
  yellow: '#ffcc22',
  blue: '#66ccff',
  green: '#b3d944',
  red: '#ff6666',
  orange: '#ffa64d',
  purple: '#b388ff',
};
const MODE_LABEL = { osu: 'osu!', taiko: 'osu!taiko', fruits: 'osu!catch', mania: 'osu!mania' };

// ---------- layout (fixed heights so the imagemap lines up) ----------
export const W = 1000;
const PAD = 24;
const GAP = 20;
const INNER = W - PAD * 2 - 40; // usable width inside a full-width panel (912)
export const SECTIONS = [
  ['header', 180],
  ['gap', PAD],
  ['progress', 196],
  ['gap', GAP],
  ['hits', 200],
  ['gap', GAP],
  ['top', 412],
  ['gap', GAP],
  ['activity', 186],
  ['gap', GAP],
  ['mapping', 262],
  ['gap', GAP],
  ['footer', 36],
];
export const H = SECTIONS.reduce((a, [, h]) => a + h, 0);

// ---------- helpers ----------
const h = (type, style = {}, children = [], props = {}) => ({
  type,
  props: { ...props, style: type === 'div' ? { display: 'flex', boxSizing: 'border-box', ...style } : style, children },
});
const txt = (s, style = {}) => h('div', style, String(s));
const none = () => h('div', {});

const fmt = (n, d = 0) =>
  n == null || Number.isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const compact = (n) => {
  if (n == null) return '-';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return fmt(n);
};
const signed = (n) => (n == null ? '-' : `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmt(Math.abs(n))}`);
const mmss = (sec) => {
  sec = Math.round(sec || 0);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const monthName = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '-');
const ago = (iso) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? '1 day ago' : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30.4)} months ago` : `${Math.round(d / 365)} years ago`;
};
const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '-');
const rankColor = (n) => (n == null ? C.text : n > 0 ? C.green : n < 0 ? C.red : C.text);

function panel(title, height, body, { width, accent = C.pink, right } = {}) {
  return h('div', { flexDirection: 'column', background: C.panel, borderRadius: 14, padding: '16px 20px', height, width: width || '100%', overflow: 'hidden' }, [
    h('div', { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, [
      h('div', { alignItems: 'center' }, [
        h('div', { width: 4, height: 18, borderRadius: 2, background: accent, marginRight: 10 }),
        txt(title, { fontSize: 17, fontWeight: 800, color: C.text }),
      ]),
      right || none(),
    ]),
    body,
  ]);
}

function tile(label, value, { sub, color = C.text, width = 228, height = 50 } = {}) {
  return h('div', { flexDirection: 'column', width, height, justifyContent: 'center' }, [
    txt(label, { fontSize: 12, color: C.dim, fontWeight: 600 }),
    h('div', { alignItems: 'baseline' }, [
      txt(value, { fontSize: 20, fontWeight: 800, color }),
      sub ? txt(sub, { fontSize: 12, color: C.faint, marginLeft: 6, fontWeight: 600 }) : none(),
    ]),
  ]);
}

const row = (width, children, style = {}) => h('div', { width, ...style }, children);
const section = (height, children) => h('div', { width: W, padding: `0 ${PAD}px`, height, justifyContent: 'space-between' }, children);

// ---------- small SVG bar chart ----------
function barChart(items, { w, hgt, color }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const gap = 6;
  const bw = items.length ? (w - gap * (items.length - 1)) / items.length : w;
  const bars = items
    .map((it, i) => {
      const bh = Math.max(3, (it.value / max) * (hgt - 4));
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(hgt - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${color}" opacity="${0.45 + 0.55 * (it.value / max)}"/>`;
    })
    .join('');
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">${bars}</svg>`);
}

function chartBlock(title, items, { w, hgt, color, labelEvery = 1 }) {
  const gap = 6;
  const bw = items.length ? (w - gap * (items.length - 1)) / items.length : w;
  return h('div', { flexDirection: 'column', width: w }, [
    txt(title, { fontSize: 12, color: C.dim, fontWeight: 700, marginBottom: 8 }),
    h('img', { width: w, height: hgt }, [], { src: barChart(items, { w, hgt, color }), width: w, height: hgt }),
    h('div', { width: w, marginTop: 4 }, items.map((it, i) =>
      txt(i % labelEvery === 0 ? it.label : '', { width: bw, marginRight: i < items.length - 1 ? gap : 0, fontSize: 10, color: C.faint, fontWeight: 600, justifyContent: 'center' }))),
  ]);
}

// ---------- sections ----------
function header(d) {
  const { user, stats } = d;
  const cover = user.cover
    ? h('img', { position: 'absolute', top: 0, left: 0, width: W, height: 110, objectFit: 'cover' }, [], { src: user.cover, width: W, height: 110 })
    : h('div', { position: 'absolute', top: 0, left: 0, width: W, height: 110, backgroundImage: 'linear-gradient(120deg, #6b2d4f, #2a2226 60%, #20334a)' });
  const avatar = user.avatar
    ? h('img', { width: 100, height: 100, borderRadius: 20, objectFit: 'cover' }, [], { src: user.avatar, width: 100, height: 100 })
    : h('div', { width: 100, height: 100, borderRadius: 20, background: C.panel2, alignItems: 'center', justifyContent: 'center' }, [
        txt(user.username.slice(0, 1).toUpperCase(), { fontSize: 48, fontWeight: 800, color: C.pink }),
      ]);
  const flag = user.flag
    ? h('img', { width: 24, height: 17, borderRadius: 3, marginRight: 8 }, [], { src: user.flag, width: 24, height: 17 })
    : h('div', { padding: '0 5px', borderRadius: 4, background: C.panel2, marginRight: 8 }, [txt(user.country || '??', { fontSize: 12, fontWeight: 800, color: C.dim })]);
  const big = (label, value, color = C.text) =>
    h('div', { flexDirection: 'column', alignItems: 'flex-end', marginLeft: 30 }, [
      txt(label, { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 0.5 }),
      txt(value, { fontSize: 24, fontWeight: 800, color }),
    ]);

  return h('div', { position: 'relative', width: W, height: 180 }, [
    cover,
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: 110, backgroundImage: 'linear-gradient(180deg, rgba(28,23,25,0.1), rgba(28,23,25,0.8))' }),
    h('div', { position: 'absolute', top: 16, right: 24, padding: '4px 12px', borderRadius: 20, background: 'rgba(0,0,0,0.45)', alignItems: 'center' }, [
      txt(MODE_LABEL[d.mode], { fontSize: 13, fontWeight: 800, color: C.pink, marginRight: 8 }),
      txt('HIDDEN STATS', { fontSize: 11, fontWeight: 800, color: C.dim, letterSpacing: 1 }),
    ]),
    h('div', { position: 'absolute', top: 110, left: 0, width: W, height: 70, background: C.panel }),
    h('div', { position: 'absolute', top: 58, left: 28, padding: 4, borderRadius: 24, background: C.panel }, [avatar]),
    h('div', { position: 'absolute', top: 116, left: 148, flexDirection: 'column' }, [
      h('div', { alignItems: 'center' }, [
        txt(user.username, { fontSize: 28, fontWeight: 800, color: C.text, marginRight: 10 }),
        user.supporter ? h('div', { padding: '1px 8px', borderRadius: 10, background: C.pink }, [txt('SUPPORTER', { fontSize: 10, fontWeight: 800, color: '#fff' })]) : none(),
      ]),
      h('div', { alignItems: 'center' }, [flag, txt(user.countryName || '', { fontSize: 13, color: C.dim, fontWeight: 700 })]),
    ]),
    h('div', { position: 'absolute', top: 120, right: 28 }, [
      big('GLOBAL', stats.globalRank ? `#${fmt(stats.globalRank)}` : '-'),
      big('COUNTRY', stats.countryRank ? `#${fmt(stats.countryRank)}` : '-'),
      big('PP', fmt(stats.pp), C.pink),
    ]),
  ]);
}

function progress(d) {
  const s = d.stats;
  const r = d.rank;
  const t = d.top;
  const tiles = [
    tile(s.globalRank > 1 ? `pp to reach #${fmt(s.globalRank - 1)}` : 'pp to next rank', s.toNext != null ? `${fmt(s.toNext, 2)}pp` : s.globalRank > 10000 ? 'top 10k only' : '-', { color: s.toNext != null ? C.pink : C.faint }),
    tile('Raw pp play for +1pp', t?.rawForPlusOne ? `${fmt(t.rawForPlusOne, 1)}pp` : '-', { color: C.yellow }),
    tile(`Total score to Lv.${s.level + 1}`, s.scoreToNextLevel > 0 ? compact(s.scoreToNextLevel) : '-', { sub: `Lv.${fmt(s.levelExact, 2)}` }),
    tile('Avg rank change / day', r ? signed(Math.round(r.perDay)) : '-', { sub: '90 days', color: rankColor(r?.perDay) }),
    tile('Rank change · 7 days', r ? signed(r.change7) : '-', { color: rankColor(r?.change7) }),
    tile('Rank change · 30 days', r ? signed(r.change30) : '-', { color: rankColor(r?.change30) }),
    tile('Rank change · 90 days', r ? signed(r.change90) : '-', { color: rankColor(r?.change90) }),
    tile('Best / worst rank · 90 days', r ? `#${fmt(r.best)}` : '-', { sub: r ? `/ #${fmt(r.worst)}` : '' }),
  ];
  return section(196, [panel('Progress & ranking', 196, h('div', { flexWrap: 'wrap', width: INNER, rowGap: 10 }, tiles), { accent: C.yellow })]);
}

function hits(d) {
  const s = d.stats;
  const total = s.c300 + s.c100 + s.c50 + s.miss;
  const names = d.mode === 'taiko' ? ['Great', 'Good', '-', 'Miss'] : d.mode === 'fruits' ? ['Fruits', 'Drops', 'Droplets', 'Miss'] : ['300', '100', '50', 'Miss'];
  const segs = [
    [names[0], s.c300, C.blue],
    [names[1], s.c100, C.green],
    [names[2], s.c50, C.orange],
    [names[3], s.miss, C.red],
  ].filter(([n]) => n !== '-');
  const barW = 520;
  const bar = h('div', { width: barW, height: 14, borderRadius: 7, overflow: 'hidden', background: C.panel2, marginBottom: 16 },
    segs.map(([, v, c]) => h('div', { width: Math.max(0, (v / (total || 1)) * barW), height: 14, background: c })));
  const counters = h('div', { width: barW }, segs.map(([label, v, c]) =>
    h('div', { flexDirection: 'column', width: barW / 4 }, [
      h('div', { alignItems: 'center' }, [h('div', { width: 10, height: 10, borderRadius: 5, background: c, marginRight: 6 }), txt(label, { fontSize: 13, color: C.dim, fontWeight: 700 })]),
      txt(compact(v), { fontSize: 20, fontWeight: 800 }),
      txt(`${fmt(pct(v, total), 2)}%`, { fontSize: 12, color: C.faint, fontWeight: 700 }),
    ])));
  const extra = txt(
    `${fmt(s.playCount ? s.miss / s.playCount : 0, 2)} misses per play  •  ${names[0]}:${names[1]} ratio ${fmt(s.c100 ? s.c300 / s.c100 : 0, 1)} : 1`,
    { fontSize: 12, color: C.faint, fontWeight: 700, marginTop: 10 }
  );

  const life = [
    tile('Lifetime accuracy', s.lifetimeAcc != null ? `${fmt(s.lifetimeAcc, 2)}%` : 'n/a', { sub: `profile ${fmt(s.acc, 2)}%`, color: C.blue, width: 330 }),
    tile('Avg play length', mmss(s.playCount ? s.playTime / s.playCount : 0), { width: 165 }),
    tile('Ranked score / play', compact(s.scorePerPlay), { width: 165 }),
    tile('Plays per day', fmt(s.playsPerDay, 1), { sub: 'since joining', width: 165 }),
    tile('Hours per week', fmt(s.hoursPerWeek, 1), { sub: 'avg', width: 165 }),
  ];
  return section(200, [
    panel('Lifetime hit breakdown', 200, h('div', { flexDirection: 'column' }, [bar, counters, extra]), { width: 562, accent: C.blue }),
    panel('Lifetime averages', 200, h('div', { flexWrap: 'wrap', width: 330, rowGap: 2 }, life), { width: 370, accent: C.blue }),
  ]);
}

function topPlays(d) {
  const t = d.top;
  if (!t) return section(412, [panel('Top plays deep-dive', 412, txt('No top plays yet.', { fontSize: 16, color: C.dim }))]);
  const tw = 150;
  const tiles = [
    tile('#1 play', `${fmt(t.top1)}pp`, { color: C.pink, width: tw }),
    tile(`#${t.count} play`, `${fmt(t.last)}pp`, { width: tw }),
    tile('Average pp', `${fmt(t.avgPP, 1)}pp`, { width: tw }),
    tile('Bonus pp', `~${fmt(t.bonusPP, 1)}`, { width: tw }),
    tile('Average accuracy', `${fmt(t.avgAcc, 2)}%`, { width: tw }),
    tile('Accuracy range', `${fmt(t.accMin, 1)}–${fmt(t.accMax, 1)}`, { width: tw }),
    tile('No-miss plays', `${t.noMiss}/${t.count}`, { color: C.green, width: tw }),
    tile('Avg star rating', `${fmt(t.avgSR, 2)}*`, { sub: 'nomod', color: C.yellow, width: tw }),
    tile('Avg BPM', fmt(t.avgBPM), { sub: 'w/ DT/HT', width: tw }),
    tile('Avg length', mmss(t.avgLen), { width: tw }),
    tile('Set in last 30 days', `${t.last30}`, { sub: 'top plays', width: tw }),
    tile('Newest top play', ago(t.newest) || '-', { width: tw }),
  ];
  const maxMod = Math.max(...t.combos.map((m) => m.count), 1);
  const modColor = (m) => (m.includes('DT') ? C.purple : m.includes('HR') ? C.red : m.includes('HD') ? C.yellow : m === 'NM' ? C.faint : m.includes('EZ') ? C.green : m.includes('HT') ? C.blue : C.pink);
  const mods = h('div', { flexDirection: 'column', width: 290 }, t.combos.map((m) =>
    h('div', { alignItems: 'center', marginBottom: 9 }, [
      h('div', { width: 64, height: 22, borderRadius: 6, background: modColor(m.mod), alignItems: 'center', justifyContent: 'center', marginRight: 10 }, [
        txt(m.mod.length > 8 ? m.mod.slice(0, 8) : m.mod, { fontSize: 12, fontWeight: 800, color: '#1c1719' }),
      ]),
      h('div', { width: 170, height: 8, borderRadius: 4, background: C.panel2, marginRight: 10 }, [
        h('div', { width: Math.max(4, (m.count / maxMod) * 170), height: 8, borderRadius: 4, background: modColor(m.mod) }),
      ]),
      txt(m.count, { fontSize: 14, fontWeight: 800 }),
    ])));

  const hist = t.hist.map((b) => ({ value: b.count, label: `${Math.round(b.from)}` }));
  const years = t.years.slice(-8).map((y) => ({ value: y.count, label: y.year }));
  const charts = row(INNER, [
    chartBlock('pp distribution (top plays per pp range)', hist, { w: 430, hgt: 62, color: C.pink }),
    chartBlock('When top plays were set (by year)', years, { w: 430, hgt: 62, color: C.blue }),
  ], { justifyContent: 'space-between', marginTop: 8 });
  const mapperLine = txt(
    `Most farmed mapper: ${t.topMapper ? `${t.topMapper.name} (${t.topMapper.count})` : '-'}  •  ${t.uniqueMappers} different mappers  •  Top artist: ${t.topArtist ? `${cut(t.topArtist.name, 28)} (${t.topArtist.count})` : '-'}  •  HD in ${Math.round(t.hdShare * 100)}%`,
    { fontSize: 12, color: C.dim, fontWeight: 700, marginTop: 12 }
  );
  return section(412, [
    panel(`Top ${t.count} plays deep-dive`, 412, h('div', { flexDirection: 'column' }, [
      row(INNER, [
        h('div', { flexWrap: 'wrap', width: 600, rowGap: 4 }, tiles),
        h('div', { flexDirection: 'column', width: 300, paddingLeft: 18, borderLeft: `1px solid ${C.line}` }, [
          txt('MOD COMBINATIONS', { fontSize: 12, color: C.dim, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }),
          mods,
        ]),
      ], { justifyContent: 'space-between' }),
      charts,
      mapperLine,
    ]), { right: txt(`${fmt(t.weightedPP)}pp weighted + ~${fmt(t.bonusPP)}pp bonus`, { fontSize: 12, color: C.faint, fontWeight: 700 }) }),
  ]);
}

function activity(d) {
  const r = d.recent;
  const a = d.activity;
  const tw = 213;
  const recentBody = !r || !r.plays
    ? txt('No plays in the last 24 hours.', { fontSize: 16, color: C.dim, fontWeight: 700 })
    : h('div', { flexDirection: 'column' }, [
        h('div', { flexWrap: 'wrap', width: 426 }, [
          tile('Plays (incl. fails)', fmt(r.plays), { width: tw }),
          tile('Pass rate', `${fmt(r.passRate, 1)}%`, { sub: `${r.passes} passed`, color: r.passRate >= 50 ? C.green : C.orange, width: tw }),
          tile('Avg accuracy (passes)', r.avgAcc != null ? `${fmt(r.avgAcc, 2)}%` : '-', { width: tw }),
          tile('Best pp play', r.bestPP ? `${fmt(r.bestPP)}pp` : '-', { color: C.pink, width: tw }),
        ]),
        txt(r.mostRetried && r.mostRetried.count > 1 ? `Most retried: ${cut(r.mostRetried.name, 40)} (${r.mostRetried.count}x)` : 'No map retried today', { fontSize: 12, color: C.faint, fontWeight: 700, marginTop: 6 }),
      ]);
  const actBody = !a
    ? txt('No activity data.', { fontSize: 16, color: C.dim })
    : h('div', { flexWrap: 'wrap', width: 426 }, [
        tile('Most active month', monthName(a.mostActive?.date), { sub: `${fmt(a.mostActive?.count)} plays`, width: tw }),
        tile('Avg plays / month', fmt(a.avg12), { sub: 'last 12 months', width: tw }),
        tile('This month vs last', fmt(a.thisMonth), { sub: `vs ${fmt(a.lastMonth)}`, color: a.thisMonth >= a.lastMonth ? C.green : C.orange, width: tw }),
        tile('Active months', `${a.activeMonths}`, { sub: `of ${a.accountMonths}`, width: tw }),
      ]);
  return section(186, [
    panel('Last 24 hours', 186, recentBody, { width: 466, accent: C.green }),
    panel('Activity pattern', 186, actBody, { width: 466, accent: C.purple }),
  ]);
}

function mapping(d) {
  const m = d.mapping;
  const has = m && m.sets > 0;
  if (!has) {
    return section(262, [panel('Mapping deep-dive', 262, h('div', { flexDirection: 'column' }, [
      txt('No own beatmaps yet.', { fontSize: 18, color: C.dim, fontWeight: 700 }),
      m && m.guest ? txt(`${m.guest} guest difficulties`, { fontSize: 14, color: C.faint, fontWeight: 700, marginTop: 6 }) : none(),
    ]), { accent: C.green })]);
  }
  const tw = 228;
  const tiles = h('div', { flexWrap: 'wrap', width: INNER }, [
    tile('Total plays on my maps', compact(m.totalPlays), { width: tw }),
    tile('Total favourites', fmt(m.totalFavs), { color: C.pink, width: tw }),
    tile('Avg plays per set', compact(m.avgPlays), { width: tw }),
    tile('Favs per 1k plays', fmt(m.favPer1kPlays, 2), { width: tw }),
    tile('Difficulties mapped', fmt(m.difficulties), { sub: `${m.sets} sets`, width: tw }),
    tile('Avg / max star rating', `${fmt(m.avgSR, 2)}*`, { sub: `max ${fmt(m.maxSR, 2)}*`, color: C.yellow, width: tw }),
    tile('Ranked + loved rate', `${fmt(m.rankRate, 1)}%`, { color: C.green, width: tw }),
    tile('First map submitted', date(m.firstSubmit), { width: tw }),
  ]);
  const line = (label, title, value) =>
    h('div', { alignItems: 'center', marginTop: 8, padding: '7px 12px', borderRadius: 8, background: C.panel2, width: INNER }, [
      txt(label, { fontSize: 11, fontWeight: 800, color: C.pink, width: 120, letterSpacing: 0.5 }),
      txt(cut(title, 64), { fontSize: 14, fontWeight: 700, flexGrow: 1 }),
      txt(value, { fontSize: 13, fontWeight: 700, color: C.dim }),
    ]);
  return section(262, [
    panel('Mapping deep-dive', 262, h('div', { flexDirection: 'column' }, [
      tiles,
      m.mostPlayed ? line('MOST PLAYED', m.mostPlayed.title, `${fmt(m.mostPlayed.plays)} plays`) : none(),
      m.mostFav ? line('MOST FAVOURITED', m.mostFav.title, `${fmt(m.mostFav.favs)} favs`) : none(),
    ]), { accent: C.green, right: txt(`${m.ranked} ranked • ${m.loved} loved • ${m.guest} GD • ${m.pending} pending • ${m.graveyard} graveyard`, { fontSize: 12, color: C.faint, fontWeight: 700 }) }),
  ]);
}

function footer(d) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  return h('div', { width: W, height: 36, alignItems: 'center', justifyContent: 'center' }, [
    txt(`${MODE_LABEL[d.mode]} hidden stats • updated ${now} UTC`, { fontSize: 12, color: C.faint, fontWeight: 700 }),
  ]);
}

export function buildTree(d) {
  const gap = (hgt) => h('div', { height: hgt, width: W });
  return h('div', { width: W, height: H, flexDirection: 'column', background: C.bg, fontFamily: 'Card, Fallback', color: C.text, borderRadius: 18, overflow: 'hidden' }, [
    header(d), gap(PAD),
    progress(d), gap(GAP),
    hits(d), gap(GAP),
    topPlays(d), gap(GAP),
    activity(d), gap(GAP),
    mapping(d), gap(GAP),
    footer(d),
  ]);
}

export async function renderPng(d, scale = 1) {
  let svg;
  try {
    svg = await satori(buildTree(d), { width: W, height: H, fonts: loadFonts() });
  } catch {
    // a broken avatar/cover/flag image should not kill the whole card
    const stripped = { ...d, user: { ...d.user, avatar: null, cover: null, flag: null } };
    svg = await satori(buildTree(stripped), { width: W, height: H, fonts: loadFonts() });
  }
  return new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(W * scale) } }).render().asPng();
}

export function sectionBoxes() {
  let y = 0;
  const out = {};
  for (const [name, hgt] of SECTIONS) {
    out[name] = { top: (y / H) * 100, height: (hgt / H) * 100 };
    y += hgt;
  }
  return out;
}

// Small card shown when something goes wrong (unknown user, API down...)
export async function renderError(message, scale = 1) {
  const tree = h('div', { width: W, height: 160, background: C.bg, borderRadius: 18, alignItems: 'center', padding: '0 40px', fontFamily: 'Card, Fallback' }, [
    h('div', { width: 6, height: 70, borderRadius: 3, background: C.red, marginRight: 24 }),
    h('div', { flexDirection: 'column' }, [
      txt('osu! hidden stats card', { fontSize: 16, color: C.pink, fontWeight: 800 }),
      txt(message, { fontSize: 26, color: C.text, fontWeight: 800, marginTop: 4 }),
    ]),
  ]);
  const svg = await satori(tree, { width: W, height: 160, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(W * scale) } }).render().asPng();
}

// The BBCode people paste into their me! page. Clickable areas are % of the card height.
export function bbcodeFor(base, username, mode = 'osu') {
  const b = sectionBoxes();
  const enc = encodeURIComponent(username);
  const img = `${base}/card/${enc}.png${mode !== 'osu' ? `?mode=${mode}` : ''}`;
  const profile = `https://osu.ppy.sh/users/${enc}/${mode}`;
  const r = (n) => n.toFixed(2);
  const area = (box, link, title) => `0 ${r(box.top)} 100 ${r(box.height)} ${link} ${title}`;
  return [
    '[centre][imagemap]',
    img,
    area(b.header, profile, 'Profile'),
    area(b.progress, `${profile}#historical`, 'Ranking'),
    area(b.top, `${profile}#top_ranks`, 'Top plays'),
    area(b.mapping, `${profile}#beatmaps`, 'Beatmaps'),
    '[/imagemap][/centre]',
  ].join('\n');
}
