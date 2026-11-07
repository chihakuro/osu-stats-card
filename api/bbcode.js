// GET /api/bbcode?u=<username>&mode=osu  -> ready-to-paste BBCode (text)
import { bbcodeFor } from '../lib/render.js';

export default function handler(req, res) {
  const user = String(req.query.u || '').trim();
  const mode = ['osu', 'taiko', 'fruits', 'mania'].includes(req.query.mode) ? req.query.mode : 'osu';
  if (!user) return res.status(400).send('missing ?u=username');
  const base = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(bbcodeFor(base, user, mode));
}
