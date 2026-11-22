// Construit web/js/data/countries.js à partir de Natural Earth (domaine public) :
//   * BORDERS : frontières terrestres entre pays (lignes simplifiées) ;
//   * COUNTRIES : nom français et point d'étiquette de chaque pays ;
//   * WATERS : grille 0,5° (même découpage que la grille de navigation) donnant le pays
//     propriétaire de chaque case : terres, et eaux à moins de 200 milles des côtes
//     (approximation des zones économiques exclusives). 0 = eaux internationales.
// Usage : npm install && node tools/build_countries.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const resolveDep = (p) => (process.env.NODE_PATH
  ? require.resolve(p, { paths: process.env.NODE_PATH.split(path.delimiter) })
  : require.resolve(p));
const topojson = require(resolveDep('topojson-client'));
const iso = require(resolveDep('i18n-iso-countries'));
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'web', 'js', 'data', 'countries.js');

const RES = 0.5, W = 720, H = 360, N = W * H, EEZ_NM = 200;
// Noms courts préférés pour l'affichage sur la carte.
const SHORT = {
  US: 'États-Unis', RU: 'Russie', GB: 'Royaume-Uni', KR: 'Corée du Sud', KP: 'Corée du Nord', IR: 'Iran',
  SY: 'Syrie', VE: 'Venezuela', BO: 'Bolivie', TZ: 'Tanzanie', CD: 'RD Congo', CG: 'Congo', LA: 'Laos',
  VN: 'Viêt Nam', MD: 'Moldavie', CZ: 'Tchéquie', MK: 'Macédoine du Nord', TW: 'Taïwan', BN: 'Brunei',
  PS: 'Palestine', CI: 'Côte d\'Ivoire', AE: 'Émirats arabes unis', CF: 'Centrafrique', DO: 'Rép. dominicaine',
};

function unwrapRing(ring) {
  const out = [];
  let shift = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (i) {
      const px = ring[i - 1][0];
      if (x - px > 180) shift -= 360; else if (px - x > 180) shift += 360;
    }
    out.push([x + shift, y]);
  }
  const xs = out.map((p) => p[0]).sort((a, b) => a - b);
  const offset = -360 * Math.round(xs[xs.length >> 1] / 360);
  if (offset) for (const p of out) p[0] += offset;
  if (Math.abs(shift) > 1) {
    const pole = Math.sign(out.reduce((s, p) => s + p[1], 0)) * 90;
    out.push([out[out.length - 1][0], pole], [out[0][0], pole], out[0]);
  }
  return out;
}

function simplify(line, tol) {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = line[a], [bx, by] = line[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let best = -1, bestD = tol * tol;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = line[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return line.filter((_, i) => keep[i]);
}

function encodeLine(pts) {
  const ints = [];
  let px = 0, py = 0;
  for (const [x, y] of pts) {
    const qx = Math.round(x * 100), qy = Math.round(y * 100);
    ints.push(qx - px, qy - py);
    px = qx; py = qy;
  }
  return ints.join(',');
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
}
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}

const haversine = (lon1, lat1, lon2, lat2) => {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
};
const center = (c) => [-180 + ((c % W) + 0.5) * RES, 90 - (Math.floor(c / W) + 0.5) * RES];

function build() {
  const topo = JSON.parse(readFileSync(resolveDep('world-atlas/countries-50m.json'), 'utf8'));
  // Frontières intérieures uniquement (pas les côtes, déjà dessinées).
  const mesh = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const borders = [];
  let points = 0;
  for (const line of mesh.coordinates) {
    // Coupe les segments qui traversent l'antiméridien.
    let cur = [];
    for (let i = 0; i < line.length; i++) {
      if (i && Math.abs(line[i][0] - line[i - 1][0]) > 180) { if (cur.length > 1) borders.push(cur); cur = []; }
      cur.push(line[i]);
    }
    if (cur.length > 1) borders.push(cur);
  }
  const encodedBorders = borders.map((l) => simplify(l, 0.04)).filter((l) => l.length > 1).map((l) => { points += l.length; return encodeLine(l); }).join(';');

  // Pays : noms et rasterisation.
  const features = topojson.feature(topo, topo.objects.countries).features;
  const countries = [];
  const owner = new Uint8Array(N);
  const tmp = new Uint8Array(N);
  for (const f of features) {
    const a2 = f.id ? iso.numericToAlpha2(f.id) : null;
    const name = a2 ? (SHORT[a2] || iso.getName(a2, 'fr', { select: 'alias' }) || iso.getName(a2, 'fr')) : f.properties?.name;
    if (!name) continue;
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let best = null, bestA = 0, total = 0;
    const touched = [];
    for (const poly of polys) {
      const rings = poly.map(unwrapRing);
      const a = Math.abs(ringArea(rings[0]));
      total += a;
      if (a > bestA) { bestA = a; best = rings[0]; }
      for (const ring of rings) {
        let minY = 90, maxY = -90;
        for (const p of ring) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
        const r0 = Math.max(0, Math.floor((90 - maxY) / RES)), r1 = Math.min(H - 1, Math.ceil((90 - minY) / RES));
        for (let row = r0; row <= r1; row++) {
          const lat = 90 - (row + 0.5) * RES;
          const xs = [];
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [x1, y1] = ring[j], [x2, y2] = ring[i];
            if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
          }
          xs.sort((p, q) => p - q);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const c0 = Math.ceil((xs[k] + 180) / RES - 0.5), c1 = Math.floor((xs[k + 1] + 180) / RES - 0.5);
            for (let c = c0; c <= c1; c++) {
              const idx = row * W + ((c % W) + W) % W;
              if (!tmp[idx]) touched.push(idx);
              tmp[idx] ^= 1;
            }
          }
        }
      }
    }
    if (countries.length >= 254) break;
    const index = countries.length + 1;
    for (const idx of touched) { if (tmp[idx]) owner[idx] = index; tmp[idx] = 0; }
    const [lx, ly] = ringCentroid(best);
    countries.push({ n: name, c: a2 || '', x: Math.round(lx * 10) / 10, y: Math.round(ly * 10) / 10, a: Math.round(total) });
  }

  // Eaux nationales : plus proche côte à moins de 200 milles (Dijkstra multi-sources).
  const dist = new Float32Array(N).fill(Infinity);
  const waters = new Uint8Array(owner);
  const queue = [];
  for (let c = 0; c < N; c++) {
    if (!owner[c]) continue;
    const row = Math.floor(c / W), col = c % W;
    let coastal = false;
    for (let dr = -1; dr <= 1 && !coastal; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr; if (r < 0 || r >= H) continue;
      if (!owner[r * W + (col + dc + W) % W]) { coastal = true; break; }
    }
    if (coastal) { dist[c] = 0; queue.push([0, c]); }
  }
  // File de priorité simple (tas binaire).
  const heap = [];
  const push = (d, c) => { heap.push([d, c]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= d) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const [d, c] of queue) push(d, c);
  while (heap.length) {
    const [d, c] = pop();
    if (d > dist[c]) continue;
    const row = Math.floor(c / W), col = c % W;
    const [x, y] = center(c);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr; if (r < 0 || r >= H) continue;
      const n = r * W + (col + dc + W) % W;
      if (owner[n]) continue;
      const [nx, ny] = center(n);
      const nd = d + haversine(x, y, nx, ny);
      if (nd <= EEZ_NM && nd < dist[n]) { dist[n] = nd; waters[n] = waters[c]; push(nd, n); }
    }
  }
  // Encodage par plages (valeur, longueur).
  const rle = [];
  for (let i = 0; i < N;) {
    let j = i;
    while (j < N && waters[j] === waters[i] && j - i < 65535) j++;
    rle.push(waters[i], j - i);
    i = j;
  }
  const js = `// Généré par tools/build_countries.mjs depuis Natural Earth (domaine public). Ne pas modifier.
// BORDERS : lignes séparées par ';', entiers delta (0,01°). WATERS : plages [pays, longueur] sur la
// grille 720×360 (0,5°), pays = index dans COUNTRIES + 1, 0 = eaux internationales.
export const EEZ_NM = ${EEZ_NM};
export const BORDERS = ${JSON.stringify(encodedBorders)};
export const COUNTRIES = ${JSON.stringify(countries)};
export const WATERS = ${JSON.stringify(rle.join(','))};
`;
  writeFileSync(OUT, js);
  console.log(`frontières : ${borders.length} lignes, ${points} points ; pays : ${countries.length} ; plages : ${rle.length / 2}`);
  console.log('écrit', OUT, Math.round(js.length / 1024), 'Ko');
}

build();
