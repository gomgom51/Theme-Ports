// Construit la police d'icônes en couleur web/fonts/pda-icons.woff2 (COLR v0 + CPAL) depuis les dessins,
// et met à jour la plage unicode de sa @font-face dans web/css/style.css.
// Prérequis : python3 avec fonttools, picosvg, skia-pathops et brotli (voir README.md).
import { EM, svgOf, CPS, unicodeRange } from './all.mjs';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
for (const n of Object.keys(CPS)) if (!EM[n]) throw new Error(`cps.mjs : « ${n} » n'a pas de dessin`);
const icons = {};
for (const n of Object.keys(EM)) icons[n] = { cps: (CPS[n] || []).map((c) => c.codePointAt(0)), box: 64, svg: svgOf(n) };
const tmp = path.join(os.tmpdir(), 'pda-icons.json');
fs.writeFileSync(tmp, JSON.stringify(icons));
const out = path.join(root, 'web/fonts/pda-icons.woff2');
const r = spawnSync('python3', [path.join(here, 'build_colr.py'), tmp, out, 'PdaIcons'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

const css = path.join(root, 'web/css/style.css');
const s = fs.readFileSync(css, 'utf8');
const re = /(@font-face \{ font-family: 'PdaIcons';[^}]*unicode-range: )[^;]*;/;
if (!re.test(s)) throw new Error("style.css : @font-face 'PdaIcons' avec unicode-range introuvable");
fs.writeFileSync(css, s.replace(re, `$1${unicodeRange()};`));
console.log('style.css : unicode-range à jour');
