// Carte du monde : projection équirectangulaire, déplacement et zoom au doigt
// ou à la souris, monde répété horizontalement (traversée du Pacifique).
import { tr } from '../i18n.js';
import { LAND_DETAILED, LAND_COARSE, GRID } from '../data/world.js';
import { ICE_PLACES, iceOpen } from '../sim/ice.js';
import { haversineNm } from '../sim/routing.js';
import { BORDERS, COUNTRIES, WATERS } from '../data/countries.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { pointAlong } from '../sim/routing.js';
import { flagImage } from './flags.js';
import { EMBARGOED } from '../data/sanctions.js';
import { ZONES } from '../data/zones.js';
import { zoneRings } from '../sim/pollution.js';
import { PIRACY_ZONES } from '../sim/piracy.js';
import { mapShipSprite, drawMapShip, mapSize } from './mapships.js';

// Étiquettes des ports voisins qui se chevaucheraient : côté du point et décalage vertical (px).
// Animations d'ambiance (pavillons pirates) : figées si le joueur a demandé moins de mouvement.
const REDUCE_MOTION = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

const LABEL_PLACE = {
  ras_tanura: ['left', -6], ras_laffan: ['left', 7], dubai: ['right', 4], bandar_abbas: ['right', -8], karachi: ['right', -10],
  durban: ['left', 4], richards_bay: ['right', -4],
  abidjan: ['left', 0], tema: ['right', -8], lagos: ['right', 5],
  colon: ['left', 0], cartagena: ['right', -8], puerto_la_cruz: ['right', 3],
  port_klang: ['left', -3], singapour: ['right', 4],
  marseille: ['left', 2], genes: ['right', -3],
  hambourg: ['left', -7], rotterdam: ['right', 4],
};

// Couleurs de la carte (style carte marine).
const C = {
  seaTop: '#c2d9e4', seaBottom: '#b5cfdc', land: '#efe5c9', coast: '#7c8986', border: '#b29c74',
  grid: 'rgba(30,58,85,0.08)', equator: 'rgba(30,58,85,0.18)', ink: '#1c2a33', halo: 'rgba(251,248,241,0.92)',
  port: '#c4362c', portHl: '#0f6f76', ocean: 'rgba(30,58,85,0.5)', country: 'rgba(110,92,60,0.55)',
};

// Tempêtes tournantes des tropiques : dessinées avec un œil.
const TROPICAL = new Set(['Ouragan', 'Typhon', 'Cyclone']);

// Noms des océans et des mers, en italique comme sur une carte marine.
const SEAS = [
  ['Océan Atlantique', -38, 30, 0], ['Océan Atlantique', -18, -24, 0], ['Océan Pacifique', -145, 12, 0],
  ['Océan Pacifique', -118, -28, 0], ['Océan Pacifique', 168, 28, 0], ['Océan Indien', 78, -22, 0],
  ['Mer Méditerranée', 17, 34.5, 3], ['Mer de Chine', 114, 13, 3], ['Golfe du Mexique', -90, 25, 3.5],
  ['Mer des Caraïbes', -75, 14.5, 3.5], ['Mer d\'Arabie', 63, 14, 3.5], ['Golfe de Guinée', 2, 1, 4],
  ['Mer du Nord', 3, 56, 5], ['Mer Rouge', 38, 20.5, 6], ['Golfe Persique', 51.5, 27.4, 7], ['Mer de Tasman', 160, -38, 4],
  ['Golfe du Bengale', 88, 14, 4], ['Mer du Japon', 135, 40, 5], ['Mer Baltique', 19, 57, 5], ['Océan Austral', 40, -55, 0],
];

function buildLines(str) {
  const path = new Path2D();
  for (const line of str.split(';')) {
    const v = line.split(',');
    let x = 0, y = 0;
    for (let i = 0; i < v.length; i += 2) {
      x += +v[i]; y += +v[i + 1];
      if (i === 0) path.moveTo(x / 100, -y / 100); else path.lineTo(x / 100, -y / 100);
    }
  }
  return path;
}

// Eaux nationales (≤ 200 milles des côtes) plus claires, limite avec les eaux internationales.
function buildWatersImage() {
  const W = 720, H = 360;
  const owner = new Uint8Array(W * H);
  const v = WATERS.split(',').map(Number);
  let i = 0;
  for (let k = 0; k < v.length; k += 2) { owner.fill(v[k], i, i + v[k + 1]); i += v[k + 1]; }
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  for (let c = 0; c < W * H; c++) {
    const row = (c / W) | 0, col = c % W;
    let a = 0, rgb = [255, 255, 255];
    if (owner[c]) a = 80;
    else {
      // Case des eaux internationales qui touche des eaux nationales : trait de limite.
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const r = row + dr;
        if (r >= 0 && r < H && owner[r * W + (col + dc + W) % W]) { a = 60; rgb = [30, 58, 85]; break; }
      }
    }
    img.data.set([rgb[0], rgb[1], rgb[2], a], c * 4);
  }
  g.putImageData(img, 0, 0);
  // Agrandi et adouci pour éviter l'effet d'escalier de la grille.
  const smooth = document.createElement('canvas');
  smooth.width = W * 4; smooth.height = H * 4;
  const sg = smooth.getContext('2d');
  sg.imageSmoothingEnabled = true;
  if ('filter' in sg) sg.filter = 'blur(3px)';
  sg.drawImage(canvas, 0, 0, W * 4, H * 4);
  return { canvas: smooth, owner };
}

const LAT_TOP = 85, LAT_BOTTOM = -60; // jusqu'au passage du Nord-Est (78° N), sous la barre du haut

function buildPath(str) {
  const path = new Path2D();
  for (const ring of str.split(';')) {
    const v = ring.split(',');
    let x = 0, y = 0;
    for (let i = 0; i < v.length; i += 2) {
      x += +v[i]; y += +v[i + 1];
      const px = x / 100, py = -y / 100;
      if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
    }
    path.closePath();
  }
  return path;
}

// Couleur de la compagnie avec transparence (routes en tirets).
const alpha = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;

export class MapView {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.base = document.createElement('canvas');
    this.over = document.createElement('canvas');
    // Noms des ports : dessinés à part (refaits avec le fond), puis posés par-dessus les navires à
    // chaque image, sous le navire choisi et les pastilles : ils restent lisibles quand un navire
    // passe ou attend à quai.
    this.names = document.createElement('canvas');
    this.base.className = 'map-layer';
    this.over.className = 'map-layer';
    root.append(this.base, this.over);
    this.bctx = this.base.getContext('2d');
    this.octx = this.over.getContext('2d');
    this.nctx = this.names.getContext('2d');
    this.paths = { detailed: buildPath(LAND_DETAILED), coarse: buildPath(LAND_COARSE), borders: buildLines(BORDERS) };
    this.waters = buildWatersImage();
    // Les drapeaux sont des images : redessiner le fond quand elles sont prêtes.
    for (const id of PORT_IDS) {
      const img = flagImage(PORTS[id].flag);
      if (!img.complete) img.addEventListener('load', () => { this.dirty = true; }, { once: true });
    }
    this.view = { cx: 20, cy: -22, scale: 3 };
    this.dirty = true;
    // Icônes (police PdaIcons, limitée aux émojis du jeu) : redessiner quand elle est chargée.
    document.fonts?.load('16px PdaIcons', '⚓☠🌿❄').then(() => { this.dirty = true; }, () => {});
    // Taille de l'interface changée (écran, menu ☰) : navires et noms de ports suivent.
    window.addEventListener('uiscale', () => { this.dirty = true; });
    this.pointers = new Map();
    this.preview = null;
    this.highlightPorts = null;
    this.attach();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  setGame(state, ctx, ui) { this.state = state; this.ctx = ctx; this.ui = ui; this.dirty = true; }
  // Carte nue (touche patron) : terres, mers, frontières, noms des pays et des mers, rien du jeu.
  setBare(on) { this.bare = on; this.dirty = true; }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.base, this.over, this.names]) {
      c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
      c.style.width = this.w + 'px'; c.style.height = this.h + 'px';
    }
    this.minScale = Math.max(this.w / 360, this.h / (LAT_TOP - LAT_BOTTOM));
    this.setView(this.view.cx, this.view.cy, Math.max(this.view.scale, this.minScale));
  }

  setView(cx, cy, scale) {
    scale = Math.max(this.minScale || 1, Math.min(80, scale));
    const halfH = this.h / 2 / scale;
    const top = -LAT_TOP + halfH, bottom = -LAT_BOTTOM - halfH;
    cy = top > bottom ? (top + bottom) / 2 : Math.max(top, Math.min(bottom, cy));
    cx = ((cx + 540) % 360) - 180;
    this.view = { cx, cy, scale };
    this.dirty = true;
  }

  // Centre un point dans la partie visible de la carte (à gauche du panneau ouvert).
  centerOn(lon, lat, scale) {
    scale = Math.max(this.minScale || 1, Math.min(80, scale || Math.max(this.view.scale, 6)));
    const covered = this.w - this.visibleRight();
    const offset = covered < this.w * 0.9 ? covered / 2 : 0;
    this.setView(lon + offset / scale, -lat, scale);
  }
  // Bord droit de la partie visible de la carte : le panneau ouvert (et les boutons à sa droite) la masquent.
  visibleRight() {
    const panel = document.getElementById('panel');
    return panel && !panel.hidden ? panel.getBoundingClientRect().left : this.w;
  }
  // Cadre une route dans la partie visible (sous la barre, à gauche du panneau), en glissant
  // doucement ; ne bouge pas si elle est déjà entièrement visible, et ne fait que dézoomer.
  fitRoute(points) {
    if (!points?.length) return;
    const right = this.visibleRight();
    if (right < this.w * 0.35) return; // panneau presque plein écran (téléphone) : rien à cadrer
    const area = { x0: 16, x1: right - 16, y0: 110, y1: this.h - 60 };
    const inside = points.every(([lon, lat]) => { const [x, y] = this.toScreen(lon, lat); return x > area.x0 && x < area.x1 && y > area.y0 && y < area.y1; });
    if (inside) return;
    const lons = [points[0][0]];
    for (let i = 1; i < points.length; i++) {
      let l = points[i][0];
      while (l - lons[i - 1] > 180) l -= 360;
      while (l - lons[i - 1] < -180) l += 360;
      lons.push(l);
    }
    const lats = points.map((p) => p[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const w = area.x1 - area.x0, h = area.y1 - area.y0;
    const fit = Math.min(w / Math.max(1, (maxLon - minLon) * 1.12), h / Math.max(1, (maxLat - minLat) * 1.12));
    const scale = Math.max(this.minScale, Math.min(this.view.scale, fit));
    const cLon = (minLon + maxLon) / 2, cLat = (minLat + maxLat) / 2;
    let cx = cLon + (this.w / 2 - (area.x0 + w / 2)) / scale;
    let cy = -cLat + (this.h / 2 - (area.y0 + h / 2)) / scale;
    if (fit < scale) {
      // Trop longue pour tenir entière : on garde l'arrivée bien visible près du bord, côté où elle se trouve
      // (le départ, c'est le port où l'on est déjà).
      const dLon = lons[lons.length - 1], dLat = lats[lats.length - 1];
      const tx = dLon >= lons[0] ? area.x1 - 70 : area.x0 + 70;
      cx = dLon + (this.w / 2 - tx) / scale;
      const ty = this.h / 2 + (-dLat - cy) * scale;
      if (ty < area.y0 + 30 || ty > area.y1 - 30) cy = -dLat + (this.h / 2 - (area.y0 + h / 2)) / scale;
    }
    this.glideTo(cx, cy, scale);
  }
  glideTo(cx, cy, scale, ms = 320) {
    const from = { ...this.view }, t0 = performance.now();
    let dx = ((cx - from.cx + 540) % 360) - 180; // le plus court chemin autour du globe
    const id = (this.glideId = (this.glideId || 0) + 1);
    const step = (now) => {
      if (id !== this.glideId) return; // un autre glissement a pris le relais
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      this.setView(from.cx + dx * e, from.cy + (cy - from.cy) * e, from.scale * Math.pow(scale / from.scale, e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  fitWorld() { this.setView(15, -18, this.minScale); }

  // Coordonnées écran d'un point ; la copie du monde la plus proche du centre est choisie.
  toScreen(lon, lat) {
    const { cx, cy, scale } = this.view;
    let dx = lon - cx;
    dx = ((dx + 540) % 360) - 180;
    return [this.w / 2 + dx * scale, this.h / 2 + (-lat - cy) * scale];
  }
  toWorld(x, y) {
    const { cx, cy, scale } = this.view;
    return [cx + (x - this.w / 2) / scale, -(cy + (y - this.h / 2) / scale)];
  }

  // ---------- Interaction ----------
  attach() {
    const el = this.over;
    el.addEventListener('pointerdown', (e) => {
      this.glideId = (this.glideId || 0) + 1; // la main reprend : on arrête un glissement en cours
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      this.pinch = null;
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const r = el.getBoundingClientRect();
      if (this.pointers.size === 1) {
        const { cx, cy, scale } = this.view;
        this.setView(cx - (e.clientX - p.x) / scale, cy - (e.clientY - p.y) / scale, scale);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        if (before > 0) this.zoomAt(mx, my, after / before);
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (wasSingle && moved < 8 && performance.now() - p.t0 < 600) {
        const r = el.getBoundingClientRect();
        this.tap(e.clientX - r.left, e.clientY - r.top);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    el.addEventListener('wheel', (e) => {
      this.glideId = (this.glideId || 0) + 1; // la main reprend : on arrête un glissement en cours
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      const r = el.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, 2);
    });
  }

  zoomAt(x, y, factor) {
    const [lon, lat] = this.toWorld(x, y);
    const scale = Math.max(this.minScale, Math.min(80, this.view.scale * factor));
    const cx = lon - (x - this.w / 2) / scale;
    const cy = -lat - (y - this.h / 2) / scale;
    this.setView(cx, cy, scale);
  }

  tap(x, y) {
    if (this.bare) return; // touche patron : rien à toucher sur la carte nue
    let best = null, bestD = 18 * mapSize().ship;
    for (const s of this.shipScreenPos || []) {
      const d = Math.hypot(s.x - x, s.y - y) - (s.own ? 4 : 0);
      if (d < bestD) { bestD = d; best = { kind: 'ship', id: s.id }; }
    }
    if (!best) {
      for (const id of PORT_IDS) {
        const [px, py] = this.toScreen(PORTS[id].lon, PORTS[id].lat);
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) { bestD = d; best = { kind: 'port', id }; }
      }
    }
    if (best?.kind === 'ship') this.handlers.onShip?.(best.id);
    else if (best?.kind === 'port') this.handlers.onPort?.(best.id);
    else this.handlers.onEmpty?.();
  }

  // Masque des glaces (une cellule de la grille de routage par pixel), refait quand un lieu
  // gèle ou dégèle.
  iceMask(state) {
    const frozen = ICE_PLACES.filter((id) => !iceOpen(state, id));
    const key = frozen.join(',');
    if (this.iceKey === key) return this.iceCanvas;
    this.iceKey = key;
    this.iceCanvas = null;
    if (!frozen.length || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = GRID.w; c.height = GRID.h;
    const g = c.getContext('2d'), img = g.createImageData(GRID.w, GRID.h);
    for (const id of frozen) for (const cell of this.iceCells(id)) {
      const o = cell * 4; img.data[o] = 236; img.data[o + 1] = 246; img.data[o + 2] = 252; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.iceCanvas = c;
    return c;
  }
  // Cellules de mer qui gèlent : le passage du Nord-Est, ou la mer autour d'un port saisonnier.
  iceCells(id) {
    this.iceCache ??= {};
    if (this.iceCache[id]) return this.iceCache[id];
    let cells = [];
    if (GRID.canals[id]) cells = GRID.canals[id];
    else {
      const router = this.ctx?.router, P = PORTS[id];
      if (router) {
        const start = router.portCell[id], seen = new Set([start]), queue = [start];
        while (queue.length) {
          const c = queue.pop();
          cells.push(c);
          const row = (c / GRID.w) | 0, col = c % GRID.w;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const r = row + dr; if (r < 0 || r >= GRID.h) continue;
            const n = r * GRID.w + (col + dc + GRID.w) % GRID.w;
            if (seen.has(n) || router.land[n]) continue;
            seen.add(n);
            const [x, y] = router.center(n);
            if (haversineNm(P.lon, P.lat, x, y) < 420) queue.push(n);
          }
        }
      }
    }
    return (this.iceCache[id] = cells);
  }

  // ---------- Dessin ----------
  // Contour lissé d'une zone (spline de Catmull-Rom fermée : la courbe passe par chaque point, ni cercle
  // ni dents de scie), ajouté au chemin courant pour chaque copie visible du monde. Une copie place tout
  // le contour d'un bloc : choisir la copie point par point (toScreen) coupait en deux une zone à cheval
  // sur le bord opposé de la vue, et ses deux moitiés se rejoignaient par une bande à travers la carte.
  // Renvoie le nombre de copies tracées (0 : zone hors écran).
  zonePath(g, poly) {
    const { cx, cy, scale } = this.view;
    let drawn = 0;
    this.copies((off) => {
      const pts = poly.map(([lo, la]) => [this.w / 2 + (lo + off - cx) * scale, this.h / 2 + (-la - cy) * scale]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > this.w || Math.max(...ys) < 0 || Math.min(...ys) > this.h) return;
      const n = pts.length, P = (i) => pts[(i + n) % n];
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < n; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      }
      g.closePath();
      drawn++;
    });
    return drawn;
  }
  copies(fn) {
    const { cx, scale } = this.view;
    const span = this.w / scale / 2 + 5;
    for (let k = -2; k <= 2; k++) {
      const off = k * 360;
      if (off - 180 > cx + span || off + 180 < cx - span) continue;
      fn(off);
    }
  }

  drawBase() {
    const g = this.bctx, { cx, cy, scale } = this.view, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, C.seaTop);
    grad.addColorStop(1, C.seaBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
    // Eaux nationales et eaux internationales.
    g.imageSmoothingEnabled = true;
    this.copies((off) => {
      g.drawImage(this.waters.canvas, this.w / 2 + (off - 180 - cx) * scale, this.h / 2 + (-90 - cy) * scale, 360 * scale, 180 * scale);
    });

    // Graticule tous les 30°.
    g.strokeStyle = C.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let lon = -540; lon <= 540; lon += 30) {
      const x = this.w / 2 + (lon - cx) * scale;
      if (x < -2 || x > this.w + 2) continue;
      g.moveTo(x, 0); g.lineTo(x, this.h);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = this.h / 2 + (-lat - cy) * scale;
      g.moveTo(0, y); g.lineTo(this.w, y);
    }
    g.stroke();
    // Équateur en tirets.
    g.strokeStyle = C.equator;
    g.setLineDash([6, 6]);
    g.beginPath();
    const ye = this.h / 2 - cy * scale;
    g.moveTo(0, ye); g.lineTo(this.w, ye); g.stroke();
    g.setLineDash([]);

    // Noms des mers.
    const T = (n) => Math.round(n * mapSize().ui * 2) / 2; // textes de la carte : suivent la taille de l'écran
    g.font = `italic ${T(scale > 6 ? 14 : 12)}px PdaIcons, 'Libre Baskerville', Georgia, serif`;
    g.fillStyle = C.ocean;
    g.textAlign = 'center';
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    for (const [name, lon, lat, minScale] of SEAS) {
      if (scale < minScale) continue;
      const [x, y] = this.toScreen(lon, lat);
      if (x > -100 && x < this.w + 100 && y > -20 && y < this.h + 20) g.fillText(tr(name), x, y);
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.textAlign = 'left';

    const path = scale >= 4.5 ? this.paths.detailed : this.paths.coarse;
    this.landPath = path; // pour poser les navires à quai sur l'eau (dockSlotsFor)
    this.dockSlots = new Map();
    this.mask = null;
    this.copies((off) => {
      g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (this.w / 2 + (off - cx) * scale), dpr * (this.h / 2 - cy * scale));
      g.fillStyle = C.land;
      g.fill(path);
      g.lineWidth = 1.1 / scale;
      g.strokeStyle = C.coast;
      g.stroke(path);
      if (scale >= 2.2) {
        g.setLineDash([3 / scale, 2.5 / scale]);
        g.lineWidth = 0.9 / scale;
        g.strokeStyle = C.border;
        g.stroke(this.paths.borders);
        g.setLineDash([]);
      }
    });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Noms des pays (les grands d'abord visibles, les petits en zoomant).
    g.font = `700 ${T(9.5)}px PdaIcons, system-ui, sans-serif`;
    g.fillStyle = C.country;
    g.textAlign = 'center';
    if ('letterSpacing' in g) g.letterSpacing = '1.5px';
    for (const c of COUNTRIES) {
      if (Math.sqrt(c.a) * scale < 70) continue;
      const [x, y] = this.toScreen(c.x, c.y);
      if (x < -80 || x > this.w + 80 || y < -10 || y > this.h + 10) continue;
      g.fillText(tr(c.n).toUpperCase(), x, y);
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.textAlign = 'left';

    // Touche patron : la carte seule, sans ports ni noms de ports.
    if (this.bare) { this.dirty = false; return; }
    // Ports. Leurs noms vont sur le calque du dessus (this.names).
    const ng = this.nctx, fs = mapSize().city, k = fs / 11;
    ng.setTransform(dpr, 0, 0, dpr, 0, 0);
    ng.clearRect(0, 0, this.w, this.h);
    ng.font = `600 ${fs}px PdaIcons, system-ui, sans-serif`;
    ng.textBaseline = 'middle';
    ng.lineJoin = 'round';
    const FW = Math.round(15 * k), FH = Math.round(10 * k); // drapeau à la taille du texte
    const dots = [];
    for (const id of PORT_IDS) {
      const P = PORTS[id];
      const [x, y] = this.toScreen(P.lon, P.lat);
      if (x < -60 || x > this.w + 60 || y < -20 || y > this.h + 20) continue;
      const r = 2 + P.size * 0.55 + Math.min(2, scale / 12);
      const hl = this.highlightPorts?.has(id);
      g.beginPath();
      g.arc(x, y, r + (hl ? 2 : 0), 0, Math.PI * 2);
      g.fillStyle = hl ? C.portHl : C.port;
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = '#fff';
      g.stroke();
      // Pays sous embargo : halo rouge, anneau rouge continu liseré de blanc, point rouge, et ⚖ devant le nom.
      const emb = !!EMBARGOED[P.flag];
      dots.push({ id, P, x, y, r: r + (emb ? 7 : hl ? 2 : 0), hl, emb });
      if (emb) {
        g.save();
        const hg = g.createRadialGradient(x, y, r + 2, x, y, r + 13);
        hg.addColorStop(0, 'rgba(196,54,44,0.42)'); hg.addColorStop(1, 'rgba(196,54,44,0)');
        g.fillStyle = hg; g.beginPath(); g.arc(x, y, r + 13, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x, y, r + 5, 0, Math.PI * 2); g.lineWidth = 2.4; g.strokeStyle = '#b8322a'; g.stroke();
        g.beginPath(); g.arc(x, y, r + 6.6, 0, Math.PI * 2); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = '#b8322a'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.stroke();
        g.restore();
      }
    }
    // Noms : les ports les plus importants d'abord, chacun du côté prévu (LABEL_PLACE), sinon à la
    // première place libre autour du point ; un petit port sans place libre n'est pas nommé
    // (il le sera en zoomant).
    const placed = dots.map((d) => ({ x1: d.x - d.r - 1, x2: d.x + d.r + 1, y1: d.y - d.r - 1, y2: d.y + d.r + 1, id: d.id }));
    const free = (b, id) => !placed.some((o) => o.id !== id && b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    const gap = Math.round(4 * k), half = Math.ceil(Math.max(FH, fs) / 2) + 1;
    const order = dots.filter((d) => d.hl || d.P.size >= 5 || scale > (d.P.size >= 4 ? 3 : 4.2))
      .sort((a, b) => (b.hl - a.hl) || (b.P.size - a.P.size));
    for (const d of order) {
      const { id, P, x, y, r, hl, emb } = d;
      const flag = flagImage(P.flag);
      const hasFlag = flag.complete && flag.naturalWidth;
      const label = emb ? `⚖ ${tr(P.name)}` : tr(P.name);
      const tw = ng.measureText(label).width, bw = (hasFlag ? FW + gap : 0) + tw + 2;
      const [pside, pdy] = LABEL_PLACE[id] || ['right', 0];
      const other = pside === 'left' ? 'right' : 'left';
      const tries = [[pside, pdy * k * Math.max(0.4, Math.min(1, 6 / scale))], [other, 0], [pside, -fs], [pside, fs], [other, -fs], [other, fs]];
      const box = (side, dy) => {
        const ly = y + dy, x1 = side === 'left' ? x - r - gap - bw : x + r + gap - 1;
        return { x1, x2: x1 + bw, y1: ly - half, y2: ly + half, ly, side };
      };
      let pick = null;
      for (const [side, dy] of tries) { const b = box(side, dy); if (free(b, id)) { pick = b; break; } }
      if (!pick) { if (!(hl || P.size >= 5)) continue; pick = box(...tries[0]); }
      placed.push({ ...pick, id });
      const ly = pick.ly;
      // À droite du point : drapeau puis nom ; à gauche : nom puis drapeau, contre le point.
      const fx = pick.side === 'left' ? x - r - gap - FW : x + r + gap;
      const tx = pick.side === 'left' ? (hasFlag ? fx - gap - tw : x - r - gap - tw) : fx + (hasFlag ? FW + gap : 0);
      if (hasFlag) {
        const fy = Math.round(ly - FH / 2);
        ng.fillStyle = C.halo;
        ng.fillRect(fx - 1, fy - 1, FW + 2, FH + 2);
        ng.drawImage(flag, fx, fy, FW, FH);
        ng.strokeStyle = 'rgba(28,42,51,0.35)'; ng.lineWidth = 0.6;
        ng.strokeRect(fx, fy, FW, FH);
      }
      ng.lineWidth = 3 * Math.sqrt(k);
      ng.strokeStyle = C.halo;
      ng.strokeText(label, tx, ly);
      ng.fillStyle = hl ? C.portHl : emb ? '#b8322a' : C.ink;
      ng.fillText(label, tx, ly);
    }
    this.labelBoxes = placed;
    this.dirty = false;
  }

  // Un point de l'écran est-il en mer ? La terre telle qu'elle est dessinée à cette échelle, lue sur
  // un masque au quart de la résolution, refait au besoin après chaque changement de vue.
  atSea(x, y) {
    const q = 4;
    if (!this.mask) {
      const W = Math.ceil(this.w / q), H = Math.ceil(this.h / q), { cx, cy, scale } = this.view;
      const c = (this.maskCanvas ||= document.createElement('canvas'));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#000';
      this.copies((off) => {
        g.setTransform(scale / q, 0, 0, scale / q, (this.w / 2 + (off - cx) * scale) / q, (this.h / 2 - cy * scale) / q);
        g.fill(this.landPath || this.paths.coarse);
      });
      this.mask = { W, H, d: g.getImageData(0, 0, W, H).data };
    }
    const { W, H, d } = this.mask, i = Math.floor(x / q), j = Math.floor(y / q);
    if (i < 0 || j < 0 || i >= W || j >= H) return true; // hors de l'écran : invisible, peu importe
    return d[(j * W + i) * 4 + 3] < 128;
  }

  // Places des navires à quai autour d'un port : sur l'eau, jamais sur la terre, près du port (quatre
  // cercles au plus), chacune avec un coût : plus loin, sur un nom ou loin du côté du large coûte
  // plus. Gardées jusqu'au prochain changement de vue (le fond les remet à zéro).
  dockSlotsFor(port, px, py) {
    let list = this.dockSlots?.get(port);
    if (list) return list;
    const zs = mapSize().ship, hx = 14 * zs, hy = 7 * zs, step = 30 * zs;
    const boxes = this.labelBoxes || [];
    const wet = (x, y) => this.atSea(x, y + hy * 0.4) && this.atSea(x - hx * 0.85, y + hy * 0.4) && this.atSea(x + hx * 0.85, y + hy * 0.4) && this.atSea(x, y - hy * 0.5);
    const onName = (x, y) => boxes.some((o) => x - hx < o.x2 && x + hx > o.x1 && y - hy < o.y2 && y + hy > o.y1);
    const sea = [];
    for (let k = 0; k < 4; k++) {
      const r = (16 + k * 15) * zs, n = Math.max(8, Math.floor((2 * Math.PI * r) / step));
      for (let i = 0; i < n; i++) {
        const a = ((i + (k % 2) * 0.5) * 2 * Math.PI) / n, x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
        if (wet(x, y)) sea.push({ x, y, k, a, cost: k + (onName(x, y) ? 2.5 : 0) });
      }
    }
    // Côté du large : la moyenne des directions en mer près du port.
    let sx = 0, sy = 0;
    for (const c of sea) if (c.k < 3) { sx += Math.cos(c.a); sy += Math.sin(c.a); }
    const dir = Math.atan2(sy, sx);
    for (const c of sea) c.cost += (0.5 * Math.abs(((c.a - dir + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)) / Math.PI;
    list = sea;
    if (!list.length) { // aucun coin de mer autour du port à cette échelle : l'arc d'origine
      for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) {
        const a = 0.95 + ((i + 0.5) * (2 * Math.PI - 1.9)) / 8, r = (25 + k * 18) * zs;
        list.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r, k, cost: k + i * 0.01 });
      }
    }
    list.sort((a, b) => a.cost - b.cost);
    Object.assign(list, { hx, hy });
    this.dockSlots.set(port, list);
    return list;
  }

  drawOverlay(frac = 0) {
    const g = this.octx, dpr = this.dpr, state = this.state, ctx = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (this.bare) return; // touche patron : ni navires, ni routes, ni zones, ni glaces
    const names = () => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.names, 0, 0); g.restore(); };
    if (!state) { names(); return; }
    const { scale } = this.view;
    const ui = this.ui || {};
    const late = []; // dessiné après les noms des ports : navire choisi, pastilles
    const T = (n) => Math.round(n * mapSize().ui * 2) / 2;
    const kmToPx = scale / 60; // 1 mille nautique ≈ 1/60 de degré

    // Côtes sensibles : leur vrai contour, teinte verte unie, bord continu (une pollution y coûte bien plus cher).
    g.save();
    for (const z of ZONES) {
      // Vrai contour (celui que lit la simulation), lissé ; lon/lat placent le nom.
      g.beginPath();
      let drawn = 0;
      for (const ring of zoneRings(z)) drawn += this.zonePath(g, ring);
      if (!drawn) continue;
      const [x, y] = this.toScreen(z.lon, z.lat);
      g.fillStyle = `rgba(46,140,110,${0.1 + z.factor * 0.012})`; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(30,110,85,0.7)'; g.stroke();
      if (scale > 7) {
        g.font = `italic 600 ${T(10)}px PdaIcons, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = 'rgba(244,239,227,0.85)'; g.strokeText(`🌿 ${tr(z.name)}`, x, y);
        g.fillStyle = 'rgba(22,95,72,0.95)'; g.fillText(`🌿 ${tr(z.name)}`, x, y);
      }
    }
    // Zones de piraterie : leur vrai contour (celui que lit la simulation), lissé, teinte rouge unie et bord continu.
    const flagT = REDUCE_MOTION?.matches ? 0 : performance.now() / 1000;
    for (const [zi, z] of PIRACY_ZONES.entries()) {
      g.beginPath();
      if (!this.zonePath(g, z.poly)) continue;
      const [x, y] = this.toScreen(z.lon, z.lat);
      g.fillStyle = `rgba(200,50,40,${0.1 + z.rate * 3})`; g.fill();
      g.lineWidth = 1.8; g.strokeStyle = 'rgba(170,40,32,0.8)'; g.stroke();
      const bs = (scale > 4 ? 1.15 : 0.85) * mapSize().ui;
      this.pirateBadge(g, x, y, bs, flagT && flagT + zi * 1.7);
      if (scale > 4) {
        g.font = `700 ${T(12)}px PdaIcons, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3.5; g.strokeStyle = 'rgba(244,239,227,0.9)'; g.strokeText(tr(z.name), x, y + 17 * bs + 4);
        g.fillStyle = 'rgba(150,32,26,0.98)'; g.fillText(tr(z.name), x, y + 17 * bs + 4);
      }
    }
    g.restore();
    // Glaces : banquise sur le passage du Nord-Est et autour des ports saisonniers pris.
    const ice = this.iceMask(state);
    if (ice) {
      const { cx, cy } = this.view;
      g.save(); g.globalAlpha = 0.78; g.imageSmoothingEnabled = true;
      this.copies((off) => g.drawImage(ice, this.w / 2 + (-180 + off - cx) * scale, this.h / 2 + (-90 - cy) * scale, 360 * scale, 180 * scale));
      g.restore();
      g.font = `700 ${T(12)}px PdaIcons, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const id of ICE_PLACES) {
        if (!PORTS[id] || iceOpen(state, id)) continue;
        const [x, y] = this.toScreen(PORTS[id].lon, PORTS[id].lat);
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.strokeText('❄', x - 9, y - 9);
        g.fillStyle = '#2f7fb5'; g.fillText('❄', x - 9, y - 9);
      }
    }
    // Ports où un gang en veut à la compagnie active.
    const me = state.companies[ui.activeCompany];
    for (const [port, until] of Object.entries(me?.grudge || {})) {
      if (until <= state.t || !PORTS[port]) continue;
      const [x, y] = this.toScreen(PORTS[port].lon, PORTS[port].lat);
      g.font = `800 ${T(12)}px PdaIcons, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.strokeText('⚠', x + 9, y - 9);
      g.fillStyle = '#b8322a'; g.fillText('⚠', x + 9, y - 9);
    }
    // Marées noires (s'estompent en deux ans).
    for (const sp of state.spills || []) {
      const age = (state.t - sp.t) / (24 * 365);
      if (age > 2) continue;
      const [x, y] = this.toScreen(sp.lon, sp.lat);
      const r = Math.min(22, 3 + Math.sqrt(sp.tonnes) * 0.008 * scale);
      g.fillStyle = `rgba(25,25,28,${0.42 * (1 - age / 2)})`;
      // Tache irrégulière et arrondie, allongée par le courant.
      const pts = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2, rr = r * (0.75 + 0.25 * Math.sin(k * 2.7 + sp.t % 7));
        pts.push([x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr * 0.8]);
      }
      g.beginPath();
      g.moveTo((pts[0][0] + pts[8][0]) / 2, (pts[0][1] + pts[8][1]) / 2);
      for (let k = 0; k < 9; k++) {
        const p = pts[k], q = pts[(k + 1) % 9];
        g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      g.fill();
    }

    // Ports d'attache : un anneau aux couleurs de chaque compagnie (où sont basés les concurrents),
    // et une épingle « siège » au-dessus du vôtre, visible à toutes les échelles.
    for (const co of state.companies) {
      const P = PORTS[co.homePort];
      if (co.bankrupt || !P) continue;
      const [x, y] = this.toScreen(P.lon, P.lat);
      if (x < -30 || x > this.w + 30 || y < -40 || y > this.h + 20) continue;
      const mine = co.id === ui.activeCompany, r = 2 + P.size * 0.55 + Math.min(2, scale / 12);
      g.beginPath(); g.arc(x, y, r + (mine ? 7 : 5.5), 0, Math.PI * 2);
      g.lineWidth = mine ? 3 : 1.8; g.strokeStyle = co.color; g.stroke();
      if (mine) this.homePin(g, x, y - r - 4, co.color);
    }

    // Tempêtes : vues du ciel, elles tournent doucement (même à l'arrêt, pour l'œil).
    const spin = performance.now() / 1000;
    for (const s of state.storms) {
      const [x, y] = this.toScreen(s.lon, s.lat);
      const r = Math.max(10, s.radius * kmToPx);
      if (x + r < 0 || x - r > this.w || y + r < 0 || y - r > this.h) continue;
      this.drawStorm(g, x, y, r, s, spin);
    }

    // Épaves.
    for (const w of state.wrecks || []) {
      const [x, y] = this.toScreen(w.lon, w.lat);
      g.strokeStyle = 'rgba(70,52,38,0.75)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke();
    }

    // Route prévisualisée (onglet « Appareiller »).
    if (this.preview) {
      this.polyline(g, this.preview.points, 0, 'rgba(15,111,118,0.95)', [7, 5], 2.4);
      // Port d'arrivée : un anneau pour le repérer d'un coup d'œil.
      const end = this.preview.points[this.preview.points.length - 1];
      if (end) {
        const [x, y] = this.toScreen(end[0], end[1]);
        g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2);
        g.lineWidth = 4; g.strokeStyle = 'rgba(251,248,241,0.9)'; g.stroke();
        g.lineWidth = 2.4; g.strokeStyle = 'rgba(15,111,118,0.95)'; g.stroke();
      }
    }

    // Routes des navires du joueur actif.
    const active = ui.activeCompany;
    for (const ship of state.ships) {
      if (ship.status !== 'sea') continue;
      const mine = ship.owner === active;
      const selected = ship.id === ui.selectedShip;
      if (!mine && !selected) continue;
      const route = ctx.shipRoute(ship);
      if (!route) continue;
      // Tirets carrés aux couleurs de la compagnie ; plus marqués pour le navire choisi.
      const co = state.companies[ship.owner].color;
      this.polyline(g, route.points, ship.voyage.progress, alpha(co, selected ? 0.95 : 0.5), selected ? [6, 4] : [4, 4], selected ? 2.2 : 1.4, route);
    }

    // Navires.
    this.shipScreenPos = [];
    const inPort = new Map();
    for (const ship of state.ships) {
      const company = state.companies[ship.owner];
      if (ship.status !== 'sea') {
        const list = inPort.get(ship.port) || [];
        list.push(ship);
        inPort.set(ship.port, list);
        continue;
      }
      const route = ctx.shipRoute(ship);
      if (!route) continue;
      const v = ship.voyage;
      const moving = !v.waitCanal && !(v.stalledUntil > state.t);
      const pos = pointAlong(route, Math.min(route.nm, v.progress + (moving ? v.speed * frac : 0)));
      const [x, y] = this.toScreen(pos.lon, pos.lat);
      if (x < -60 || x > this.w + 60 || y < -40 || y > this.h + 40) continue;
      const own = ship.owner === active;
      const half = this.drawShip(g, x, y, ship, pos.heading, company.color, own, false, moving ? v.speed : 0);
      this.shipScreenPos.push({ id: ship.id, x, y, own });
      if (ship.id === ui.selectedShip) late.push(() => {
        // Le navire choisi repasse au-dessus des noms des ports, avec son anneau et son nom.
        this.drawShip(g, x, y, ship, pos.heading, company.color, own, true, moving ? v.speed : 0);
        this.label(g, x + Math.min(9, half.hw * 0.5), y - half.hh - 7, ship.name);
      });
    }
    // Navires à quai : pictogramme aux couleurs de la compagnie, et pour les vôtres une
    // pastille qui dit ce qu'ils font (chargement, déchargement, réparation, attente…).
    const now = performance.now() / 1000, docked = [];
    for (const [port, ships] of inPort) {
      const P = PORTS[port];
      if (!P) continue;
      const [px, py] = this.toScreen(P.lon, P.lat);
      if (px < -60 || px > this.w + 60 || py < -60 || py > this.h + 60) continue;
      ships.sort((a, b) => (b.owner === active) - (a.owner === active));
      // Sur l'eau autour du port, hors des noms, sans chevaucher les navires d'un port voisin.
      // Chaque navire prend la place libre la moins chère ; chevaucher un navire déjà posé (d'un port
      // voisin) coûte trois cercles : près du port, ils finissent par se serrer plutôt que s'éloigner.
      const slots = this.dockSlotsFor(port, px, py), { hx, hy } = slots, used = new Set();
      ships.forEach((ship, n) => {
        let best = -1, bestCost = Infinity;
        slots.forEach((s, i) => {
          if (used.has(i)) return;
          const cost = s.cost + (docked.some((o) => Math.abs(o.x - s.x) < 1.7 * hx && Math.abs(o.y - s.y) < 1.6 * hy) ? 3 : 0);
          if (cost < bestCost) { bestCost = cost; best = i; }
        });
        if (best < 0) best = n % slots.length; // plus de place : on réutilise
        used.add(best);
        const { x, y } = slots[best];
        docked.push({ x, y });
        const own = ship.owner === active;
        const kind = portActivity(ship);
        const color = state.companies[ship.owner].color, laidup = kind === 'laidup';
        const half = this.drawDocked(g, x, y, ship, color, own, laidup, false);
        if (own) late.push(() => this.statusBadge(g, x + Math.max(9, half.hw * 0.7), y - Math.max(8, half.hh + 2), kind, now));
        this.shipScreenPos.push({ id: ship.id, x, y, own });
        if (ship.id === ui.selectedShip) late.push(() => {
          this.drawDocked(g, x, y, ship, color, own, laidup, true);
          this.label(g, x + half.hw + 5, y + 2, ship.name);
        });
      });
    }
    names();
    for (const f of late) f();
    // Navire recherché (« Centrer sur la carte », liste de la flotte) : il clignote un instant.
    if (this.flash) {
      const f = this.flash, el = performance.now() - f.t0;
      const p = el > f.ms ? null : this.shipScreenPos.find((s) => s.id === f.id);
      if (el > f.ms) this.flash = null;
      else if (p) this.drawFlash(g, p.x, p.y, el, f.ms);
    }
    // Ville dont on a cliqué le nom (dans un panneau, un message…) : elle clignote en vert.
    if (this.cityFlash) {
      const f = this.cityFlash, el = performance.now() - f.t0, port = PORTS[f.id];
      if (el > f.ms || !port) this.cityFlash = null;
      else { const [x, y] = this.toScreen(port.lon, port.lat); this.drawFlash(g, x, y, el, f.ms, CITY_FLASH); }
    }
    // Ports en grève.
    for (const [p, until] of Object.entries(state.strikes)) {
      if (until <= state.t) continue;
      const [x, y] = this.toScreen(PORTS[p].lon, PORTS[p].lat);
      this.badge(g, x - 14, y + 12, 'grève', '#ef5350', 9);
    }
  }

  // Fait clignoter un navire : halo doré et ondes qui s'élargissent, pendant `ms` millisecondes.
  flashShip(id, ms = 2800) { this.flash = { id, t0: performance.now(), ms }; }
  // Montre un port : la carte glisse jusqu'à lui s'il est hors de la partie visible (sans changer le zoom,
  // pour garder le monde autour), puis il clignote comme un navire, en vert.
  flashCity(id, ms = 2800) {
    const port = PORTS[id];
    if (!port) return;
    const [x, y] = this.toScreen(port.lon, port.lat);
    const y0 = 140, y1 = this.h - 90;
    const hidden = x < 40 || x > this.w - 40 || y < y0 || y > y1
      || [[0, 0], [-26, 0], [26, 0], [0, -20], [0, 20]].some(([dx, dy]) => this.covered(x + dx, y + dy));
    if (hidden) {
      const ty = (y0 + y1) / 2, tx = this.freeMidX(ty), scale = this.view.scale;
      if (tx != null) this.glideTo(port.lon + (this.w / 2 - tx) / scale, -port.lat + (this.h / 2 - ty) / scale, scale);
    }
    this.cityFlash = { id, t0: performance.now(), ms };
  }
  // Un point de la carte est-il caché par l'interface (panneau, opportunités, classement, barre du haut) ?
  covered(x, y) {
    const r = this.root.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + x, r.top + y);
    return !!el && !this.root.contains(el);
  }
  // Milieu de la plus large bande de carte libre à la hauteur y (null si tout est couvert).
  freeMidX(y) {
    let best = null, start = null;
    for (let x = 16; x <= this.w; x += 32) {
      const free = x <= this.w - 16 && !this.covered(x, y);
      if (free && start == null) start = x;
      if (!free && start != null) { if (!best || x - start > best[1] - best[0]) best = [start, x]; start = null; }
    }
    return best ? (best[0] + best[1]) / 2 : null;
  }
  drawFlash(g, x, y, el, ms, pal = SHIP_FLASH) {
    const fade = Math.min(1, (ms - el) / 500); // s'éteint doucement à la fin
    const pulse = 0.75 + 0.25 * Math.sin(el / 120); // le halo bat comme un phare
    const glow = g.createRadialGradient(x, y, 2, x, y, 32);
    glow.addColorStop(0, `rgba(${pal.glow}, ${0.9 * fade * pulse})`);
    glow.addColorStop(1, `rgba(${pal.glow}, 0)`);
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, 32, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) {
      const ph = (el - i * 650) / 1000;
      if (ph < 0 || ph > 1) continue;
      const r = 10 + ph * 46, a = (1 - ph) * fade;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.lineWidth = 6; g.strokeStyle = `rgba(251, 248, 241, ${0.85 * a})`; g.stroke();
      g.lineWidth = 3.2; g.strokeStyle = `rgba(${pal.ring}, ${a})`; g.stroke();
    }
  }

  polyline(g, points, fromNm, color, dash, width, route) {
    g.save();
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
    // On dessine à partir de la position actuelle, en gardant des longitudes continues.
    let pts = points;
    if (route && fromNm > 0) {
      const p = pointAlong(route, fromNm);
      let i = 1;
      while (i < route.cum.length - 1 && route.cum[i] < fromNm) i++;
      pts = [[p.lon, p.lat], ...points.slice(i)];
    }
    if (pts.length < 2) { g.restore(); return; }
    const [sx] = this.toScreen(pts[0][0], pts[0][1]);
    const base = pts[0][0];
    const { scale } = this.view;
    g.beginPath();
    pts.forEach((p, i) => {
      const x = sx + (p[0] - base) * scale;
      const y = this.h / 2 + (-p[1] - this.view.cy) * scale;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
    g.restore();
  }

  // Navire en mer : sprite de profil en pixel art (mapships.js), tourné vers l'est ou l'ouest
  // selon le cap, avec un sillage qui s'allonge avec la vitesse (nœuds, 0 à l'arrêt).
  drawShip(g, x, y, ship, heading, color, own, selected, speed) {
    const spr = mapShipSprite(ship.type, color, !!ship.cargo, own);
    // Cap nord ou sud : on garde le sens d'avant, pour que le sprite ne clignote pas.
    const s = Math.sin(heading), facing = this.facing || (this.facing = new Map());
    let left = facing.get(ship.id);
    if (left === undefined || Math.abs(s) > 0.25) left = s < 0;
    facing.set(ship.id, left);
    // Très près, les pixels doublent : le navire garde sa place à l'échelle de la mer.
    const half = drawMapShip(g, this.dpr, x, y, spr, { left, moving: speed > 0, speed, t: this.animT || 0, seed: (ship.id * 0.618) % 1 * 6.28, smoke: this.view.scale >= 10, zoom: this.view.scale >= 50 ? 2 : 1 });
    if (selected) {
      g.beginPath(); g.arc(x, y, Math.max(13, half.r + 3), 0, Math.PI * 2);
      g.strokeStyle = C.portHl; g.lineWidth = 2.2; g.stroke();
    }
    return half;
  }

  // Insigne de piraterie : crâne et tibias blancs sur disque sombre cerclé de rouge.
  // Pavillon pirate : drapeau noir sur sa hampe, tête de mort et tibias croisés.
  // Pavillon pirate d'une zone. t (secondes, 0 = immobile) : le badge flotte doucement et une onde court
  // dans le pavillon, de la hampe vers le bord libre.
  pirateBadge(g, x, y, s = 1, t = 0) {
    g.save();
    g.translate(x, y + (t ? Math.sin(t * 1.3) * 1.6 : 0)); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Hampe et pommeau.
    g.lineWidth = 3.4; g.strokeStyle = 'rgba(244,239,227,0.9)';
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-14, 13); g.stroke();
    g.lineWidth = 1.8; g.strokeStyle = '#4a3420';
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-14, 13); g.stroke();
    g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(-14, -15, 1.9, 0, Math.PI * 2); g.fill();
    // Le pavillon ondule (amplitude nulle à la hampe), avec un liseré clair pour ressortir sur la carte.
    const wave = (px) => { const u = (px + 13) / 26; return u * (2.2 * Math.sin(px * 0.24 - t * 3.2) + 0.8); };
    g.beginPath();
    for (let i = 0; i <= 10; i++) { const px = -13 + i * 2.6; g[i ? 'lineTo' : 'moveTo'](px, -13 + wave(px)); }
    for (let i = 10; i >= 0; i--) { const px = -13 + i * 2.6; g.lineTo(px, 5 + wave(px)); }
    g.closePath();
    g.fillStyle = '#17110f'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = '#f4efe3'; g.stroke();
    // Tête de mort et tibias croisés, portés par l'onde au centre du pavillon.
    g.translate(0, -4.2 + wave(0)); g.rotate(Math.atan((wave(1.5) - wave(-1.5)) / 3)); g.scale(0.82, 0.82);
    g.strokeStyle = '#f4efe3'; g.fillStyle = '#f4efe3';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-6.5, -2); g.lineTo(6.5, 7); g.moveTo(6.5, -2); g.lineTo(-6.5, 7); g.stroke();
    for (const [bx, by] of [[-6.5, -2], [6.5, 7], [6.5, -2], [-6.5, 7]]) { g.beginPath(); g.arc(bx, by, 1.4, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(0, -3.2, 4.6, 0, Math.PI * 2); g.fill();
    g.fillRect(-2.7, -0.5, 5.4, 3.4);
    g.fillStyle = '#17110f';
    g.beginPath(); g.arc(-1.8, -3.4, 1.35, 0, Math.PI * 2); g.arc(1.8, -3.4, 1.35, 0, Math.PI * 2); g.fill();
    g.fillRect(-1.5, 1.4, 0.8, 1.5); g.fillRect(0.7, 1.4, 0.8, 1.5);
    g.restore();
  }

  // Navire à quai : petit sprite de profil (cap à droite) ; désarmé : grisé.
  drawDocked(g, x, y, ship, color, own, laidup, selected) {
    const spr = mapShipSprite(ship.type, color, !!ship.cargo, own, { docked: true, laidup });
    const half = drawMapShip(g, this.dpr, x, y, spr);
    if (selected) { g.beginPath(); g.arc(x, y, Math.max(14, half.r + 3), 0, Math.PI * 2); g.strokeStyle = C.portHl; g.lineWidth = 2.4; g.stroke(); }
    return half;
  }

  // Pastille d'activité d'un navire à quai.
  statusBadge(g, x, y, kind, now) {
    const S = PORT_STATUS[kind];
    if (!S) return;
    g.save();
    g.translate(x, y);
    const u = mapSize().ui; g.scale(u, u);
    if (kind === 'idle') { // en attente d'ordres : une onde qui attire l'œil
      const k = (now % 1.4) / 1.4;
      g.beginPath(); g.arc(0, 0, 6.5 + k * 7, 0, Math.PI * 2);
      g.strokeStyle = `rgba(232,163,58,${0.75 * (1 - k)})`; g.lineWidth = 2; g.stroke();
    }
    g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2);
    g.fillStyle = S.color; g.fill();
    g.lineWidth = 1.4; g.strokeStyle = '#fbf8f1'; g.stroke();
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
    const arrow = (dx, dy) => { // flèche dans la direction (dx, dy)
      g.beginPath(); g.moveTo(-dx * 3, -dy * 3); g.lineTo(dx * 3, dy * 3);
      g.moveTo(dx * 3 - dx * 2.6 - dy * 2.4, dy * 3 - dy * 2.6 + dx * 2.4); g.lineTo(dx * 3, dy * 3); g.lineTo(dx * 3 - dx * 2.6 + dy * 2.4, dy * 3 - dy * 2.6 - dx * 2.4);
      g.stroke();
    };
    if (S.icon === 'up') arrow(0, -1);
    else if (S.icon === 'down') arrow(0, 1);
    else if (S.icon === 'right') arrow(1, 0);
    else if (S.icon === 'bang') { g.fillRect(-0.95, -3.8, 1.9, 4.4); g.beginPath(); g.arc(0, 2.7, 1.05, 0, Math.PI * 2); g.fill(); }
    else if (S.icon === 'stop') g.fillRect(-3.4, -1.1, 6.8, 2.2);
    else if (S.icon === 'wrench') { g.lineWidth = 1.9; g.beginPath(); g.moveTo(-2.8, 2.8); g.lineTo(1, -1); g.stroke(); g.lineWidth = 1.4; g.beginPath(); g.arc(2, -2, 1.9, Math.PI * 0.95, Math.PI * 2.55); g.stroke(); }
    else if (S.icon === 'gear') { g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, 2, 0, Math.PI * 2); g.stroke(); for (let a = 0; a < 6; a++) { const c = Math.cos(a * Math.PI / 3), s = Math.sin(a * Math.PI / 3); g.beginPath(); g.moveTo(c * 2.4, s * 2.4); g.lineTo(c * 3.7, s * 3.7); g.stroke(); } }
    else if (S.icon === 'cycle') { g.beginPath(); g.arc(0, 0, 2.8, Math.PI * 0.2, Math.PI * 1.75); g.stroke(); g.beginPath(); g.moveTo(2.8, -2.6); g.lineTo(2.2, 0.2); g.lineTo(-0.3, -1.2); g.stroke(); }
    else if (S.icon === 'zzz') { g.font = '800 8px PdaIcons, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 0, 0.5); }
    g.restore();
  }

  // Tempête : bandes nuageuses en spirale autour du centre (sens inverse des aiguilles d'une montre
  // au nord, dans le sens au sud), œil et mur de l'œil pour les cyclones tropicaux, halo teinté selon
  // la force (jaune 7-8, orange 9-10, rouge 11-12). Petite à l'écran : le symbole météo du cyclone.
  drawStorm(g, x, y, r, s, now) {
    const TAU = Math.PI * 2;
    const hue = s.force >= 11 ? '214,58,50' : s.force >= 9 ? '230,126,20' : '214,170,30';
    const tropical = TROPICAL.has(s.name);
    const dir = s.lat >= 0 ? -1 : 1;
    const rot = dir * now * (tropical ? 0.45 : 0.25) + (s.lon * 7.3 % TAU);
    const rg = g.createRadialGradient(x, y, 0, x, y, r * 1.1);
    rg.addColorStop(0, `rgba(${hue},0.36)`);
    rg.addColorStop(0.55, `rgba(${hue},0.16)`);
    rg.addColorStop(1, `rgba(${hue},0)`);
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r * 1.1, 0, TAU); g.fill();

    if (r < 22) {
      // Symbole : deux crochets autour d'un rond (cyclone), ou deux arcs (tempête).
      g.save();
      g.strokeStyle = `rgb(${hue})`; g.lineCap = 'round';
      g.lineWidth = tropical ? 2.6 : 1.8;
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        for (let i = 0; i <= 10; i++) {
          const u = i / 10, rho = 7 + u * (tropical ? 8 : 6), th = rot + k * Math.PI - dir * u * 1.7;
          const px = x + rho * Math.cos(th), py = y + rho * Math.sin(th);
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
      }
      g.restore();
      this.badge(g, x, y, String(s.force), `rgb(${hue})`);
      return;
    }

    // Bandes nuageuses : des chapelets de nuages ronds le long de spirales, ombrés pour le relief.
    const arms = tropical ? 4 : 2, sweep = tropical ? 2.7 : 3.3;
    const r0 = r * (tropical ? 0.17 : 0.08);
    const n = Math.max(10, Math.min(40, Math.round(r / 2.2)));
    const puffs = (dx, dy, grow) => {
      g.beginPath();
      for (let k = 0; k < arms; k++) {
        const len = tropical ? 1 : k ? 0.55 : 1; // dépression : une longue virgule et un bras court
        for (let i = 0; i < n * len; i++) {
          const u = i / (n - 1);
          const rho = r0 + u * (r * 0.95 - r0);
          const th = rot + (k * TAU) / arms - dir * u * sweep;
          const size = Math.max(0.6, grow + r * (tropical ? 0.16 : 0.14) * (1 - 0.72 * u) * (0.82 + 0.18 * Math.sin(i * 2.3 + k * 1.9)));
          const px = x + rho * Math.cos(th) + dx, py = y + rho * Math.sin(th) + dy;
          g.moveTo(px + size, py); g.arc(px, py, size, 0, TAU);
        }
      }
    };
    const off = Math.max(1.5, r * 0.035);
    puffs(off, off * 1.3, 0); g.fillStyle = 'rgba(28,50,70,0.2)'; g.fill();
    puffs(0, 0, 0); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
    puffs(-off * 0.4, -off * 0.5, -Math.max(1, r * 0.03)); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();

    // Masse nuageuse centrale.
    const core = r * (tropical ? 0.32 : 0.2);
    const cg = g.createRadialGradient(x, y, 0, x, y, core);
    cg.addColorStop(0, 'rgba(255,255,255,0.98)');
    cg.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg;
    g.beginPath(); g.arc(x, y, core, 0, TAU); g.fill();

    if (tropical) {
      // L'œil : la mer à nu, cerclée d'un mur de nuages, liseré à la couleur de la force.
      const eye = Math.max(2.5, r * 0.07);
      g.fillStyle = '#6f97ad';
      g.beginPath(); g.arc(x, y, eye, 0, TAU); g.fill();
      g.strokeStyle = `rgba(${hue},0.95)`; g.lineWidth = Math.max(1.2, r * 0.018);
      g.stroke();
      g.strokeStyle = 'rgba(28,50,70,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + 0.6, y + 0.8, eye + Math.max(1.5, r * 0.03), 0, TAU); g.stroke();
    }

    // Force (et nom quand la place le permet), sous le centre pour laisser voir l'œil.
    const text = r >= 46 ? `${tr(s.name)} · ${s.force}` : String(s.force);
    this.badge(g, x, y + Math.min(r * 0.6, core + 16), text, `rgb(${hue})`);
  }

  // Épingle du siège : pointe sur le port, tête ronde aux couleurs de la compagnie, maison blanche.
  homePin(g, x, tipY, color) {
    const R = 11.5, cy = tipY - 18;
    const shape = () => {
      g.beginPath();
      g.moveTo(x, tipY);
      g.quadraticCurveTo(x - 5, cy + R * 0.7, x - R, cy);
      g.arc(x, cy, R, Math.PI, 0);
      g.quadraticCurveTo(x + 5, cy + R * 0.7, x, tipY);
      g.closePath();
    };
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 4; g.shadowOffsetY = 1.5;
    shape(); g.fillStyle = color; g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 4; g.strokeStyle = 'rgba(28,42,51,0.85)'; g.stroke(); // contour sombre : se détache même d'un port rouge
    g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(x - 7, cy + 0.5); g.lineTo(x, cy - 6.5); g.lineTo(x + 7, cy + 0.5); g.closePath(); g.fill(); // toit
    g.fillRect(x - 4.6, cy + 0.5, 9.2, 6); // murs
    g.fillStyle = color; g.fillRect(x - 1.4, cy + 2.4, 2.8, 4.1); // porte
    g.restore();
  }

  badge(g, x, y, text, color, size = 11) {
    text = tr(text);
    size = Math.round(size * mapSize().ui * 2) / 2;
    g.font = `700 ${size}px PdaIcons, system-ui, sans-serif`;
    const w = g.measureText(text).width + 8;
    g.fillStyle = 'rgba(251,248,241,0.92)';
    g.strokeStyle = color; g.lineWidth = 1.5;
    roundRect(g, x - w / 2, y - size / 2 - 3, w, size + 6, 4);
    g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5);
    g.textAlign = 'left';
  }

  // Nom du navire sélectionné (lui seul, choix du propriétaire), au pochoir comme partout ailleurs.
  label(g, x, y, text) {
    g.save();
    g.font = `700 ${Math.round(15 * mapSize().ui)}px PdaIcons, "Stardos Stencil", Georgia, serif`;
    g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = C.halo;
    g.strokeText(text, x, y);
    g.fillStyle = C.ink; g.fillText(text, x, y);
    g.restore();
  }

  frame(frac, running = frac > 0) {
    const now = performance.now() / 1000;
    if (running) this.animT = (this.animT || 0) + Math.min(0.1, now - (this.lastT || now));
    this.lastT = now;
    if (this.dirty) this.drawBase();
    this.drawOverlay(frac);
  }
}

// Couleurs du clignotement : navire recherché (or), ville dont on a cliqué le nom (vert).
const SHIP_FLASH = { glow: '255, 196, 64', ring: '232, 146, 20' };
const CITY_FLASH = { glow: '96, 214, 128', ring: '30, 140, 80' };

// Ce que fait un navire à quai, pour sa pastille sur la carte.
export const PORT_STATUS = {
  idle: { color: '#e09a2a', icon: 'bang', label: 'En attente d\'ordres' },
  plan: { color: '#0f6f76', icon: 'right', label: 'Départ programmé' },
  chargement: { color: '#2e8b57', icon: 'up', label: 'Chargement' },
  'déchargement': { color: '#2f6fb0', icon: 'down', label: 'Déchargement' },
  'réparation': { color: '#d9822b', icon: 'wrench', label: 'Réparation' },
  'réarmement': { color: '#d9822b', icon: 'cycle', label: 'Réarmement' },
  installation: { color: '#7b5ea7', icon: 'gear', label: 'Installation d\'équipement' },
  'démarchage': { color: '#7b5ea7', icon: 'cycle', label: 'Démarchage des chargeurs' },
  'détention': { color: '#c4362c', icon: 'stop', label: 'Retenu par les inspecteurs' },
  saisie: { color: '#c4362c', icon: 'stop', label: 'Retenu par la douane' },
  retenue: { color: '#c4362c', icon: 'stop', label: 'Retenu sans motif sérieux' },
  laidup: { color: '#8a8a8a', icon: 'zzz', label: 'Désarmé' },
};
export function portActivity(ship) {
  if (ship.status === 'laidup') return 'laidup';
  if (ship.busyWhat) return PORT_STATUS[ship.busyWhat] ? ship.busyWhat : 'plan';
  return ship.plan ? 'plan' : 'idle';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
