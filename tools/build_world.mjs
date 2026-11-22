// Builds web/js/data/world.js from Natural Earth land polygons (public domain,
// via the "world-atlas" npm package):
//   * LAND: simplified coastlines used to draw the map,
//   * GRID: a 0.5° sea/land mask used for route planning, with the straits
//     that are too narrow for the grid carved in by hand and the two big
//     canals (Suez, Panama) marked so that they can be closed by events or
//     refused to ships that are too big.
//
// Usage (from the repository root):
//   npm install && npm run build:world
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
// Dépendances : node_modules du dépôt (npm install), ou un dossier donné par NODE_PATH.
const resolveDep = (p) => (process.env.NODE_PATH
  ? require.resolve(p, { paths: process.env.NODE_PATH.split(path.delimiter) })
  : require.resolve(p));
const topojson = require(resolveDep('topojson-client'));
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'web', 'js', 'data', 'world.js');

function loadLand(name) {
  const topo = JSON.parse(readFileSync(resolveDep(`world-atlas/${name}.json`), 'utf8'));
  const geo = topojson.feature(topo, topo.objects.land);
  const rings = [];
  for (const f of geo.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(unwrapRing(ring));
  }
  return rings;
}

// Makes longitudes continuous across the 180° meridian (Chukotka, Fiji...).
// A ring that goes all the way round the globe (Antarctica) is closed via the pole.
function unwrapRing(ring) {
  const out = [];
  let shift = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (i) {
      const px = ring[i - 1][0];
      if (x - px > 180) shift -= 360;
      else if (px - x > 180) shift += 360;
    }
    out.push([x + shift, y]);
  }
  // Keep the bulk of the ring within [-180, 180].
  const xs = out.map((p) => p[0]).sort((a, b) => a - b);
  const offset = -360 * Math.round(xs[xs.length >> 1] / 360);
  if (offset) for (const p of out) p[0] += offset;
  if (Math.abs(shift) > 1) {
    const [lx] = out[out.length - 1], [fx] = out[0];
    const pole = Math.sign(out.reduce((s, p) => s + p[1], 0)) * 90;
    out.push([lx, pole], [fx, pole], out[0]);
  }
  return out;
}

// ---------- Douglas-Peucker simplification ----------
function simplify(ring, tol) {
  if (ring.length < 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = ring[a], [bx, by] = ring[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let best = -1, bestD = tol * tol;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return ring.filter((_, i) => keep[i]);
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(s / 2);
}

// Rings are stored as delta-encoded integers (1 unit = 0.01°) to keep the file small.
function encodeRings(rings, tol, minArea) {
  const out = [];
  let points = 0;
  for (const ring of rings) {
    if (ringArea(ring) < minArea) continue;
    const s = simplify(ring, tol);
    if (s.length < 4) continue;
    const ints = [];
    let px = 0, py = 0;
    for (const [x, y] of s) {
      const qx = Math.round(x * 100), qy = Math.round(y * 100);
      ints.push(qx - px, qy - py);
      px = qx; py = qy;
    }
    points += s.length;
    out.push(ints.join(','));
  }
  return { str: out.join(';'), points, rings: out.length };
}

// ---------- Sea grid ----------
const RES = 0.5, W = 360 / RES, H = 180 / RES; // row 0 = 90°N .. 89.5°N
const land = new Uint8Array(W * H);

function rasterize(rings) {
  // Even-odd scanline fill at the centre of every cell, ring by ring (XOR, so
  // lakes inside a continent are carved back out). Longitudes beyond ±180 wrap.
  for (const ring of rings) {
    for (let row = 0; row < H; row++) {
      const lat = 90 - (row + 0.5) * RES;
      const xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j], [x2, y2] = ring[i];
        if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
      if (!xs.length) continue;
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.ceil((xs[k] + 180) / RES - 0.5), c1 = Math.floor((xs[k + 1] + 180) / RES - 0.5);
        for (let c = c0; c <= c1; c++) land[row * W + ((c % W) + W) % W] ^= 1;
      }
    }
  }
}

const cellOf = (lon, lat) => {
  const col = ((Math.floor((lon + 180) / RES) % W) + W) % W;
  const row = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / RES)));
  return row * W + col;
};

// Marks every cell crossed by a polyline (sampled finely). The carved channel is
// kept 4-connected: the router never cuts diagonally between two land cells.
function carve(points, value = 0, collect) {
  const mark = (c) => {
    land[c] = value;
    if (collect && !collect.includes(c)) collect.push(c);
  };
  let prev = -1;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (RES / 6)) + 1;
    for (let k = 0; k <= n; k++) {
      const c = cellOf(x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n);
      if (prev >= 0 && c !== prev) {
        const pr = Math.floor(prev / W), pc = prev % W, cr = Math.floor(c / W), cc = c % W;
        if (pr !== cr && pc !== cc) mark(pr * W + cc);
      }
      mark(c);
      prev = c;
    }
  }
}

// Straits narrower than a grid cell, carved from sea to sea.
const STRAITS = {
  gibraltar: [[-7.0, 36.0], [-5.6, 35.95], [-4.5, 36.1]],
  douvres: [[0.6, 50.6], [1.5, 51.0], [2.4, 51.3]],
  oresund: [[11.2, 57.4], [12.2, 56.4], [12.7, 55.7], [13.0, 55.2], [14.0, 55.0]],
  dardanelles: [[25.6, 39.9], [26.3, 40.1], [26.7, 40.4], [27.4, 40.6], [28.0, 40.8], [29.0, 41.0]],
  bosphore: [[29.0, 41.0], [29.1, 41.3], [29.5, 41.7]],
  singapour: [[100.6, 3.2], [101.6, 2.4], [102.8, 1.6], [103.6, 1.15], [104.5, 1.3], [105.2, 1.6]],
  ormuz: [[55.3, 26.1], [56.3, 26.5], [56.8, 26.1], [57.6, 25.4]],
  bab_el_mandeb: [[42.6, 13.8], [43.35, 12.6], [43.9, 12.2], [45.0, 12.0]],
  messine: [[15.4, 38.4], [15.65, 38.15], [15.9, 37.8]],
  palk_ceylan: [[79.0, 7.5], [79.6, 6.0], [80.4, 5.6]],
  golfe_de_suez: [[32.6, 29.6], [33.0, 29.0], [33.6, 28.3], [34.2, 27.7], [34.8, 27.0], [35.5, 26.0]],
  mer_rouge_sud: [[41.5, 15.0], [42.3, 14.2], [42.6, 13.8]],
  rio_de_la_plata: [[-58.3, -34.5], [-57.8, -34.8], [-57.0, -35.1], [-56.0, -35.4], [-54.5, -35.6]],
  juan_de_fuca: [[-123.2, 49.25], [-123.5, 48.9], [-123.2, 48.4], [-123.8, 48.2], [-124.7, 48.45], [-125.6, 48.4]],
  elbe: [[9.9, 53.55], [9.3, 53.75], [8.8, 53.9], [8.2, 54.0], [7.6, 54.1]],
};
const CANALS = {
  suez: [[32.2, 31.6], [32.3, 31.2], [32.35, 30.6], [32.5, 30.1], [32.55, 29.7], [32.7, 29.3]],
  panama: [[-80.1, 9.6], [-79.9, 9.35], [-79.7, 9.1], [-79.55, 8.9], [-79.4, 8.5]],
};

function build() {
  const land50 = loadLand('land-50m');
  const land110 = loadLand('land-110m');
  rasterize(land50);
  // Pack ice: no route through the Arctic (Northwest/Northeast passages) or close to Antarctica.
  for (let row = 0; row < H; row++) {
    const lat = 90 - (row + 0.5) * RES;
    if (lat > 66 || lat < -62) for (let c = 0; c < W; c++) land[row * W + c] = 1;
  }
  for (const pts of Object.values(STRAITS)) carve(pts, 0);
  const canals = {};
  for (const [id, pts] of Object.entries(CANALS)) { canals[id] = []; carve(pts, 0, canals[id]); }

  const bytes = new Uint8Array(Math.ceil((W * H) / 8));
  for (let i = 0; i < W * H; i++) if (land[i]) bytes[i >> 3] |= 1 << (i & 7);
  const mask = Buffer.from(bytes).toString('base64');

  const detailed = encodeRings(land50, 0.04, 0.02);
  const coarse = encodeRings(land110, 0.12, 0.3);
  console.log(`land 50m: ${detailed.rings} rings, ${detailed.points} points, ${(detailed.str.length / 1024).toFixed(0)} KB`);
  console.log(`land 110m: ${coarse.rings} rings, ${coarse.points} points, ${(coarse.str.length / 1024).toFixed(0)} KB`);
  console.log(`grid: ${W}x${H}, water cells ${land.reduce((n, v) => n + (v ? 0 : 1), 0)}`);

  const js = `// Generated by tools/build_world.mjs from Natural Earth (public domain). Do not edit.
// Rings: ';'-separated, each a list of delta-encoded lon,lat integers (0.01°).
export const LAND_DETAILED = ${JSON.stringify(detailed.str)};
export const LAND_COARSE = ${JSON.stringify(coarse.str)};
// Sea grid: bit i set = cell i is land. Cell i = row*W+col, row 0 starts at 90°N, col 0 at 180°W.
export const GRID = ${JSON.stringify({ w: W, h: H, res: RES, mask, canals })};
`;
  writeFileSync(OUT, js);
  console.log('wrote', OUT, (js.length / 1024).toFixed(0), 'KB');
}

build();
