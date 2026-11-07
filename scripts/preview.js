// node scripts/preview.js [out.png] [scale]  – renders the demo card locally
import { writeFileSync } from 'node:fs';
import { renderPng } from '../lib/render.js';
import { mock } from '../lib/mock.js';

const out = process.argv[2] || 'preview.png';
const scale = Number(process.argv[3] || 1);
const t = Date.now();
writeFileSync(out, await renderPng(mock, scale));
console.log(`wrote ${out} in ${Date.now() - t}ms`);
