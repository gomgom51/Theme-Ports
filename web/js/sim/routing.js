// Calcul des routes maritimes sur la grille mer/terre (0,5°).
// Un Dijkstra depuis le port de départ donne en une passe la route vers tous
// les autres ports ; le chemin en escalier est ensuite lissé (tirage de ficelle)
// et sa longueur recalculée en milles nautiques.
import { GRID } from '../data/world.js';
import { PORTS } from '../data/ports.js';

const { w: W, h: H, res: RES } = GRID;
const N = W * H;
const NM_PER_DEG = 60;

function decodeMask(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return land;
}

export function haversineNm(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Petit tas binaire (clé flottante, valeur entière).
class Heap {
  constructor(cap) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) {
      const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k;
      const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p;
    }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const top = this.v[0], key = this.k[--this.n], val = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
}

export class Router {
  constructor() {
    this.land = decodeMask(GRID.mask);
    this.canalOf = new Int8Array(N).fill(-1);
    this.canalIds = Object.keys(GRID.canals);
    this.canalIds.forEach((id, k) => { for (const c of GRID.canals[id]) this.canalOf[c] = k; });
    // Cellules côtières : légèrement pénalisées pour que les routes restent au large.
    this.coast = new Uint8Array(N);
    for (let c = 0; c < N; c++) {
      if (this.land[c]) continue;
      const row = (c / W) | 0, col = c % W;
      for (let dr = -1; dr <= 1 && !this.coast[c]; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr; if (r < 0 || r >= H) continue;
        if (this.land[r * W + (col + dc + W) % W]) { this.coast[c] = 1; break; }
      }
    }
    this.portCell = {};
    for (const [id, p] of Object.entries(PORTS)) this.portCell[id] = this.nearestWater(p.lon, p.lat);
    this.cache = new Map();
    // Coût d'un pas vers chacun des 8 voisins, pour chaque ligne.
    this.stepCost = [];
    for (let row = 0; row < H; row++) {
      const lat = 90 - (row + 0.5) * RES;
      const dy = RES * NM_PER_DEG, dx = dy * Math.cos((lat * Math.PI) / 180);
      this.stepCost.push({ dx, dy, dd: Math.hypot(dx, dy) });
    }
  }

  cellOf(lon, lat) {
    const col = ((Math.floor((lon + 180) / RES) % W) + W) % W;
    const row = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / RES)));
    return row * W + col;
  }
  center(c) { return [-180 + ((c % W) + 0.5) * RES, 90 - (((c / W) | 0) + 0.5) * RES]; }

  isBlocked(c, closed) {
    if (this.land[c]) return true;
    const k = this.canalOf[c];
    return k >= 0 && closed.has(this.canalIds[k]);
  }

  nearestWater(lon, lat) {
    const start = this.cellOf(lon, lat);
    if (!this.land[start]) return start;
    let best = -1, bestD = Infinity;
    const r0 = (start / W) | 0, c0 = start % W;
    for (let rad = 1; rad < 12 && best < 0; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const r = r0 + dr; if (r < 0 || r >= H) continue;
        const c = r * W + (c0 + dc + W) % W;
        if (this.land[c] || this.canalOf[c] >= 0) continue;
        const [x, y] = this.center(c);
        const d = haversineNm(lon, lat, x, y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  // closed : canaux fermés (événement) ou interdits au navire (trop grand).
  dijkstra(start, closed) {
    const dist = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const heap = new Heap(4096);
    dist[start] = 0; heap.push(0, start);
    while (heap.n) {
      const c = heap.pop();
      const d = dist[c];
      const row = (c / W) | 0, col = c % W;
      for (let dr = -1; dr <= 1; dr++) {
        const r = row + dr; if (r < 0 || r >= H) continue;
        const sc = this.stepCost[r];
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const n = r * W + (col + dc + W) % W;
          if (this.isBlocked(n, closed)) continue;
          // Pas de diagonale qui coupe un coin de terre.
          if (dr && dc && (this.isBlocked(row * W + (col + dc + W) % W, closed) && this.isBlocked(r * W + col, closed))) continue;
          let step = dr && dc ? sc.dd : dr ? sc.dy : sc.dx;
          if (this.coast[n]) step *= 1.3;
          const nd = d + step;
          if (nd < dist[n] - 1e-3) { dist[n] = nd; prev[n] = c; heap.push(nd, n); }
        }
      }
    }
    return prev;
  }

  // Chemin de cellules -> points [lon, lat] avec longitudes continues (sans saut à ±180°).
  unwrap(cells) {
    const pts = [];
    let shift = 0, lastCol = null;
    for (const c of cells) {
      const col = c % W;
      if (lastCol !== null) {
        if (col - lastCol > W / 2) shift -= 360;
        else if (lastCol - col > W / 2) shift += 360;
      }
      lastCol = col;
      const [x, y] = this.center(c);
      pts.push([x + shift, y]);
    }
    return pts;
  }

  lineIsClear(a, b, closed) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (RES / 4)) + 1;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.isBlocked(this.cellOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), closed)) return false;
    }
    return true;
  }

  smooth(pts, closed) {
    if (pts.length <= 2) return pts.slice();
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = Math.min(pts.length - 1, i + 1);
      // On cherche le point le plus lointain visible en ligne droite (limité pour la vitesse).
      for (let k = Math.min(pts.length - 1, i + 160); k > i + 1; k--) {
        if (this.lineIsClear(pts[i], pts[k], closed)) { j = k; break; }
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  // Toutes les routes depuis un port (mises en cache par port et canaux fermés).
  routesFrom(fromId, closedList = []) {
    const closed = new Set(closedList);
    const key = fromId + '|' + [...closed].sort().join(',');
    if (this.cache.has(key)) return this.cache.get(key);
    const start = this.portCell[fromId];
    const prev = this.dijkstra(start, closed);
    const routes = {};
    const from = PORTS[fromId];
    for (const [toId, to] of Object.entries(PORTS)) {
      if (toId === fromId) continue;
      const end = this.portCell[toId];
      if (end !== start && prev[end] < 0) { routes[toId] = null; continue; }
      const cells = [];
      for (let c = end; c >= 0; c = prev[c]) { cells.push(c); if (c === start) break; }
      cells.reverse();
      const usesCanal = new Set();
      for (const c of cells) if (this.canalOf[c] >= 0) usesCanal.add(this.canalIds[this.canalOf[c]]);
      let pts = this.smooth(this.unwrap(cells), closed);
      // Le quai réel aux deux bouts (en gardant les longitudes continues).
      const fix = (lon, ref) => lon + 360 * Math.round((ref - lon) / 360);
      pts = [[fix(from.lon, pts[0][0]), from.lat], ...pts, [fix(to.lon, pts[pts.length - 1][0]), to.lat]];
      routes[toId] = makeRoute(pts, [...usesCanal]);
    }
    this.cache.set(key, routes);
    return routes;
  }

  route(fromId, toId, closedList = []) {
    return this.routesFrom(fromId, closedList)[toId] || null;
  }
}

export function makeRoute(points, canals = []) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i];
    cum.push(cum[i - 1] + haversineNm(x1, y1, x2, y2));
  }
  return { points, cum, nm: cum[cum.length - 1], canals };
}

// Position et cap le long d'une route après `nm` milles parcourus.
export function pointAlong(route, nm) {
  const { points, cum } = route;
  if (nm <= 0) return { lon: points[0][0], lat: points[0][1], heading: headingOf(points[0], points[1]) };
  let i = 1;
  while (i < cum.length - 1 && cum[i] < nm) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (nm - cum[i - 1]) / seg));
  const a = points[i - 1], b = points[i];
  return { lon: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t, heading: headingOf(a, b) };
}

function headingOf(a, b) {
  if (!b) return 0;
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.atan2(dx, b[1] - a[1]); // 0 = nord, sens horaire
}
