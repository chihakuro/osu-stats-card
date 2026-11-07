// GET /card/<username>.png?mode=osu|taiko|fruits|mania&scale=1..2   (or /api/card?u=<username>)
import { loadProfile } from '../lib/osu.js';
import { renderPng, renderError } from '../lib/render.js';
import { mock } from '../lib/mock.js';

export default async function handler(req, res) {
  const q = req.query || {};
  const user = String(q.u || q.user || '').replace(/\.png$/i, '').trim();
  const mode = String(q.mode || 'osu');
  const scale = Math.min(2, Math.max(1, Number(q.scale) || 1));

  res.setHeader('Content-Type', 'image/png');
  try {
    let data;
    if (q.demo != null || user.toLowerCase() === 'demo') {
      data = mock;
    } else if (!user) {
      throw Object.assign(new Error('No username given'), { status: 400 });
    } else {
      data = await loadProfile(user, mode);
    }
    const png = await renderPng(data, scale);
    // CDN keeps the image 15 min, then refreshes in the background
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400');
    res.status(200).send(png);
  } catch (e) {
    const msg = e.status === 404 ? `User "${user}" not found` : e.status === 400 ? e.message : 'Could not load osu! data, try again later';
    console.error(e);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).send(await renderError(msg, scale));
  }
}
