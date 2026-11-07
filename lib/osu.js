// Fetches data from the osu! API v2 and derives the stats that the osu! profile page does NOT show.
import sharp from 'sharp';

const API = 'https://osu.ppy.sh/api/v2';
export const MODES = ['osu', 'taiko', 'fruits', 'mania'];
const DAY = 86400000;

let tokenCache = { token: null, expires: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const res = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: Number(process.env.OSU_CLIENT_ID),
      client_secret: process.env.OSU_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });
  if (!res.ok) throw new Error(`osu! token request failed (${res.status}) – check OSU_CLIENT_ID / OSU_CLIENT_SECRET`);
  const json = await res.json();
  tokenCache = { token: json.access_token, expires: Date.now() + (json.expires_in - 300) * 1000 };
  return tokenCache.token;
}

async function api(path) {
  const token = await getToken();
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-api-version': '20240529' },
  });
  if (!res.ok) {
    const err = new Error(`osu! API ${path} -> ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function flagUrl(cc) {
  if (!cc || cc.length !== 2) return null;
  const cps = [...cc.toUpperCase()].map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16));
  return `https://osu.ppy.sh/assets/images/flags/${cps.join('-')}.svg`;
}

async function toDataUri(url, maxWidth = 1000) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0];
    let buf = Buffer.from(await res.arrayBuffer());
    if (type.includes('svg')) return `data:image/svg+xml;base64,${buf.toString('base64')}`;
    // gif / webp / anything else -> first frame as PNG, resized (also keeps the payload small)
    buf = await sharp(buf, { animated: false }).resize({ width: maxWidth, withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const safe = (p, fallback) => p.catch(() => fallback);
const when = (s) => s.ended_at || s.created_at || null;
const missOf = (s) => s.statistics?.miss ?? s.statistics?.count_miss ?? 0;
const passed = (s) => (s.passed != null ? s.passed : s.rank !== 'F');

function modsOf(score) {
  const raw = (score.mods || []).map((m) => (typeof m === 'string' ? m : m.acronym));
  const mods = raw.filter((m) => m && m !== 'CL').map((m) => (m === 'NC' ? 'DT' : m === 'PF' ? 'SD' : m));
  return mods.length ? mods : ['NM'];
}
const speedOf = (mods) => (mods.includes('DT') || mods.includes('DC') ? 1.5 : mods.includes('HT') ? 0.75 : 1);

function topEntry(map) {
  let best = null;
  for (const [k, v] of Object.entries(map)) if (!best || v > best.count) best = { name: k, count: v };
  return best;
}

// ---------- lifetime / level ----------
// Total score needed to reach level n (osu! wiki formula)
function scoreForLevel(n) {
  if (n <= 100) return (5000 / 3) * (4 * n ** 3 - 3 * n ** 2 - n) + 1.25 * 1.8 ** (n - 60);
  return 26931190827 + 99999999999 * (n - 100);
}

function lifetimeAccuracy(mode, st) {
  const { count_300: a = 0, count_100: b = 0, count_50: c = 0, count_miss: m = 0 } = st;
  if (mode === 'osu') {
    const t = a + b + c + m;
    return t ? ((300 * a + 100 * b + 50 * c) / (300 * t)) * 100 : null;
  }
  if (mode === 'taiko') {
    const t = a + b + m;
    return t ? ((a + 0.5 * b) / t) * 100 : null;
  }
  return null; // catch & mania need hit types the API does not give in totals
}

// ---------- rank history ----------
function rankMovement(history) {
  const h = history.filter((v) => v > 0);
  if (h.length < 2) return null;
  const now = h[h.length - 1];
  const back = (d) => h[Math.max(0, h.length - 1 - d)];
  return {
    change7: back(7) - now,
    change30: back(30) - now,
    change90: h[0] - now,
    best: Math.min(...h),
    worst: Math.max(...h),
    perDay: (h[0] - now) / (h.length - 1),
  };
}

// ---------- monthly play counts ----------
function activity(monthly, user) {
  if (!monthly.length) return null;
  const sorted = [...monthly].sort((a, b) => a.date.localeCompare(b.date));
  const most = sorted.reduce((a, m) => (!a || m.count > a.count ? m : a), null);
  const last12 = sorted.slice(-12);
  const nowKey = new Date().toISOString().slice(0, 7);
  const prev = new Date();
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevKey = prev.toISOString().slice(0, 7);
  const find = (k) => sorted.find((m) => m.date.startsWith(k))?.count || 0;
  const joinMonths = Math.max(1, Math.round((Date.now() - new Date(user.join_date)) / (30.44 * DAY)));
  return {
    mostActive: most,
    avg12: last12.reduce((a, m) => a + m.count, 0) / last12.length,
    thisMonth: find(nowKey),
    lastMonth: find(prevKey),
    activeMonths: sorted.filter((m) => m.count > 0).length,
    accountMonths: joinMonths,
  };
}

// ---------- top plays ----------
function rawPPForPlusOne(pps, target = 1) {
  const list = [...pps].sort((a, b) => b - a).slice(0, 100);
  const weighted = (arr) => arr.slice(0, 100).reduce((a, p, i) => a + p * 0.95 ** i, 0);
  const base = weighted(list);
  const gain = (x) => {
    const arr = [...list, x].sort((a, b) => b - a);
    return weighted(arr) - base;
  };
  let lo = 0;
  let hi = (list[0] || 0) + 2000;
  if (gain(hi) < target) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (gain(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

function analyseTop(scores, totalPP) {
  if (!scores.length) return null;
  const n = scores.length;
  const pps = scores.map((s) => s.pp || 0);
  const weighted = pps.reduce((a, p, i) => a + p * 0.95 ** i, 0);

  const combo = {};
  const single = {};
  const mappers = {};
  const artists = {};
  const years = {};
  let noMiss = 0;
  let bpm = 0;
  let len = 0;
  let sr = 0;
  let acc = 0;
  let accMin = 100;
  let accMax = 0;
  let newest = null;
  let oldest = null;
  let last30 = 0;
  for (const s of scores) {
    const mods = modsOf(s);
    const ORDER = ['EZ', 'NF', 'HT', 'HD', 'HR', 'DT', 'FL', 'SO', 'RX', 'AP', 'MR'];
    const rank = (m) => (ORDER.includes(m) ? ORDER.indexOf(m) : 99);
    const key = mods.filter((m) => m !== 'SD').sort((a, b) => rank(a) - rank(b)).join('') || 'NM';
    combo[key] = (combo[key] || 0) + 1;
    for (const m of mods) single[m] = (single[m] || 0) + 1;
    const speed = speedOf(mods);
    bpm += (s.beatmap?.bpm || 0) * speed;
    len += (s.beatmap?.total_length || 0) / speed;
    sr += s.beatmap?.difficulty_rating || 0;
    const a = (s.accuracy || 0) * 100;
    acc += a;
    accMin = Math.min(accMin, a);
    accMax = Math.max(accMax, a);
    if (missOf(s) === 0) noMiss++;
    const creator = s.beatmapset?.creator;
    if (creator) mappers[creator] = (mappers[creator] || 0) + 1;
    const artist = s.beatmapset?.artist;
    if (artist) artists[artist] = (artists[artist] || 0) + 1;
    const t = when(s);
    if (t) {
      if (!newest || t > newest) newest = t;
      if (!oldest || t < oldest) oldest = t;
      if (Date.now() - new Date(t) < 30 * DAY) last30++;
      const y = t.slice(0, 4);
      years[y] = (years[y] || 0) + 1;
    }
  }

  // pp histogram, 8 buckets between lowest and highest top play
  const lo = Math.min(...pps);
  const hi = Math.max(...pps);
  const step = (hi - lo) / 8 || 1;
  const hist = Array.from({ length: 8 }, (_, i) => ({ from: lo + i * step, count: 0 }));
  for (const p of pps) hist[Math.min(7, Math.floor((p - lo) / step))].count++;

  return {
    count: n,
    top1: pps[0],
    last: pps[n - 1],
    avgPP: pps.reduce((a, b) => a + b, 0) / n,
    weightedPP: weighted,
    bonusPP: Math.max(0, totalPP - weighted),
    rawForPlusOne: rawPPForPlusOne(pps),
    avgAcc: acc / n,
    accMin,
    accMax,
    avgSR: sr / n,
    avgBPM: bpm / n,
    avgLen: len / n,
    noMiss,
    newest,
    oldest,
    last30,
    combos: Object.entries(combo).map(([mod, count]) => ({ mod, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    hdShare: (single.HD || 0) / n,
    topMapper: topEntry(mappers),
    uniqueMappers: Object.keys(mappers).length,
    topArtist: topEntry(artists),
    hist,
    years: Object.entries(years).map(([year, count]) => ({ year, count })).sort((a, b) => a.year.localeCompare(b.year)),
  };
}

// ---------- last 24h ----------
function analyseRecent(scores) {
  if (!scores.length) return { plays: 0 };
  const pass = scores.filter(passed);
  const maps = {};
  for (const s of scores) {
    const t = s.beatmapset ? `${s.beatmapset.artist} - ${s.beatmapset.title}` : '?';
    maps[t] = (maps[t] || 0) + 1;
  }
  const bestPP = pass.reduce((a, s) => Math.max(a, s.pp || 0), 0);
  return {
    plays: scores.length,
    passes: pass.length,
    passRate: (pass.length / scores.length) * 100,
    avgAcc: pass.length ? (pass.reduce((a, s) => a + (s.accuracy || 0), 0) / pass.length) * 100 : null,
    bestPP,
    mostRetried: topEntry(maps),
  };
}

// ---------- mapping ----------
async function mappingStats(user) {
  const id = user.id;
  const counts = {
    ranked: user.ranked_beatmapset_count ?? user.ranked_and_approved_beatmapset_count ?? 0,
    loved: user.loved_beatmapset_count ?? 0,
    guest: user.guest_beatmapset_count ?? 0,
    pending: user.pending_beatmapset_count ?? 0,
    graveyard: user.graveyard_beatmapset_count ?? 0,
    nominated: user.nominated_beatmapset_count ?? 0,
  };
  const owned = ['ranked', 'loved', 'pending', 'graveyard'].filter((t) => counts[t] > 0);
  const lists = await Promise.all(owned.map((t) => safe(api(`/users/${id}/beatmapsets/${t}?limit=100`), [])));
  const sets = lists.flat();
  let plays = 0;
  let favs = 0;
  let diffs = 0;
  let srSum = 0;
  let srN = 0;
  let maxSR = 0;
  let mostPlayed = null;
  let mostFav = null;
  let first = null;
  let latest = null;
  for (const s of sets) {
    plays += s.play_count || 0;
    favs += s.favourite_count || 0;
    for (const b of s.beatmaps || []) {
      if (b.user_id != null && b.user_id !== id) continue;
      diffs++;
      srSum += b.difficulty_rating || 0;
      srN++;
      maxSR = Math.max(maxSR, b.difficulty_rating || 0);
    }
    const title = `${s.artist} - ${s.title}`;
    if (!mostPlayed || (s.play_count || 0) > mostPlayed.plays) mostPlayed = { title, plays: s.play_count || 0 };
    if (!mostFav || (s.favourite_count || 0) > mostFav.favs) mostFav = { title, favs: s.favourite_count || 0 };
    const sub = s.submitted_date;
    if (sub && (!first || sub < first)) first = sub;
    const upd = s.last_updated || sub;
    if (upd && (!latest || upd > latest)) latest = upd;
  }
  const ownedTotal = counts.ranked + counts.loved + counts.pending + counts.graveyard;
  return {
    ...counts,
    sets: sets.length,
    followers: user.mapping_follower_count ?? 0,
    kudosuTotal: user.kudosu?.total ?? 0,
    kudosuAvail: user.kudosu?.available ?? 0,
    totalPlays: plays,
    totalFavs: favs,
    avgPlays: sets.length ? plays / sets.length : 0,
    favPer1kPlays: plays ? (favs / plays) * 1000 : 0,
    difficulties: diffs,
    avgSR: srN ? srSum / srN : 0,
    maxSR,
    rankRate: ownedTotal ? ((counts.ranked + counts.loved) / ownedTotal) * 100 : 0,
    mostPlayed,
    mostFav,
    firstSubmit: first,
    lastActivity: latest,
  };
}

// ---------- pp to next rank ----------
async function nextRank(mode, rank, pp) {
  if (!rank || rank <= 1 || rank > 10000) return null;
  const page = Math.ceil((rank - 1) / 50);
  const json = await api(`/rankings/${mode}/performance?cursor[page]=${page}`);
  const above = (json.ranking || []).find((r) => r.global_rank === rank - 1);
  return above ? Math.max(0, above.pp - pp) : null;
}

export async function loadProfile(userParam, modeParam) {
  const mode = MODES.includes(modeParam) ? modeParam : 'osu';
  const ref = /^\d+$/.test(userParam) ? userParam : `@${userParam}`;
  const user = await api(`/users/${encodeURIComponent(ref)}/${mode}`);
  const st = user.statistics || {};

  const [best, recent, avatar, cover, flag, mapping, toNext] = await Promise.all([
    safe(api(`/users/${user.id}/scores/best?mode=${mode}&limit=100`), []),
    safe(api(`/users/${user.id}/scores/recent?mode=${mode}&include_fails=1&limit=100`), []),
    toDataUri(user.avatar_url, 256),
    toDataUri(user.cover?.url || user.cover_url),
    toDataUri(flagUrl(user.country_code)),
    safe(mappingStats(user), null),
    safe(nextRank(mode, st.global_rank, st.pp), null),
  ]);

  const days = Math.max(1, (Date.now() - new Date(user.join_date).getTime()) / DAY);
  const level = st.level?.current || 0;
  const monthly = (user.monthly_playcounts || []).map((m) => ({ date: m.start_date, count: m.count }));

  return {
    mode,
    user: {
      id: user.id,
      username: user.username,
      country: user.country_code,
      countryName: user.country?.name || user.country_code,
      supporter: !!user.is_supporter,
      avatar,
      cover,
      flag,
    },
    stats: {
      pp: st.pp || 0,
      globalRank: st.global_rank,
      countryRank: st.country_rank,
      acc: st.hit_accuracy || 0,
      lifetimeAcc: lifetimeAccuracy(mode, st),
      level,
      levelExact: level + (st.level?.progress || 0) / 100,
      scoreToNextLevel: Math.max(0, scoreForLevel(level + 1) - (st.total_score || 0)),
      playCount: st.play_count || 0,
      playTime: st.play_time || 0,
      rankedScore: st.ranked_score || 0,
      c300: st.count_300 || 0,
      c100: st.count_100 || 0,
      c50: st.count_50 || 0,
      miss: st.count_miss || 0,
      playsPerDay: (st.play_count || 0) / days,
      hoursPerWeek: (st.play_time || 0) / 3600 / (days / 7),
      scorePerPlay: st.play_count ? (st.ranked_score || 0) / st.play_count : 0,
      toNext,
    },
    rank: rankMovement(user.rank_history?.data || []),
    activity: activity(monthly, user),
    top: analyseTop(best, st.pp || 0),
    recent: analyseRecent(recent),
    mapping,
  };
}
