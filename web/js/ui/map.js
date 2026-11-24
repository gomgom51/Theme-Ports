// Carte du monde : projection équirectangulaire, déplacement et zoom au doigt
// ou à la souris, monde répété horizontalement (traversée du Pacifique).
import { tr } from '../i18n.js';
import { LAND_DETAILED, LAND_COARSE } from '../data/world.js';
import { BORDERS, COUNTRIES, WATERS } from '../data/countries.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { pointAlong } from '../sim/routing.js';
import { flagImage } from './flags.js';
import { EMBARGOED } from '../data/sanctions.js';
import { ZONES } from '../data/zones.js';
import { PIRACY_ZONES } from '../sim/piracy.js';

// Étiquettes des ports voisins qui se chevaucheraient : côté du point et décalage vertical (px).
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

const LAT_TOP = 78, LAT_BOTTOM = -60;

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

const SHIP_SHAPE = (() => {
  const p = new Path2D();
  p.moveTo(0, -8); p.lineTo(4.2, -1.5); p.lineTo(3.6, 6); p.lineTo(-3.6, 6); p.lineTo(-4.2, -1.5); p.closePath();
  return p;
})();

export class MapView {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.base = document.createElement('canvas');
    this.over = document.createElement('canvas');
    this.base.className = 'map-layer';
    this.over.className = 'map-layer';
    root.append(this.base, this.over);
    this.bctx = this.base.getContext('2d');
    this.octx = this.over.getContext('2d');
    this.paths = { detailed: buildPath(LAND_DETAILED), coarse: buildPath(LAND_COARSE), borders: buildLines(BORDERS) };
    this.waters = buildWatersImage();
    // Les drapeaux sont des images : redessiner le fond quand elles sont prêtes.
    for (const id of PORT_IDS) {
      const img = flagImage(PORTS[id].flag);
      if (!img.complete) img.addEventListener('load', () => { this.dirty = true; }, { once: true });
    }
    this.view = { cx: 20, cy: -22, scale: 3 };
    this.dirty = true;
    this.pointers = new Map();
    this.preview = null;
    this.highlightPorts = null;
    this.attach();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  setGame(state, ctx, ui) { this.state = state; this.ctx = ctx; this.ui = ui; this.dirty = true; }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.base, this.over]) {
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
    let best = null, bestD = 18;
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

  // ---------- Dessin ----------
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
    g.font = `italic ${scale > 6 ? 14 : 12}px 'Libre Baskerville', Georgia, serif`;
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
    g.font = '700 9.5px system-ui, sans-serif';
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

    // Ports.
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'middle';
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
      // Pays sous embargo : anneau rouge en pointillés, et ⚖ devant le nom.
      const emb = !!EMBARGOED[P.flag];
      if (emb) {
        g.save(); g.setLineDash([3, 2]); g.beginPath(); g.arc(x, y, r + 5, 0, Math.PI * 2);
        g.lineWidth = 2; g.strokeStyle = '#c4362c'; g.stroke(); g.restore();
      }
      // Les grands ports sont nommés dès le départ, les petits quand on zoome.
      if (hl || P.size >= 5 || scale > (P.size >= 4 ? 3 : 4.2)) {
        const flag = flagImage(P.flag);
        const [side, dy] = LABEL_PLACE[id] || ['right', 0];
        const ly = y + dy * Math.max(0.4, Math.min(1, 6 / scale));
        const hasFlag = flag.complete && flag.naturalWidth;
        const label = emb ? `⚖ ${tr(P.name)}` : tr(P.name);
        const tw = g.measureText(label).width;
        // À droite du point (par défaut) ou à gauche, pour les ports trop proches d'un voisin.
        let fx = side === 'left' ? x - r - 4 - 15 : x + r + 4;
        let tx = side === 'left' ? fx - (hasFlag ? 4 : -15) - tw : fx + (hasFlag ? 19 : 0);
        if (hasFlag) {
          g.fillStyle = C.halo;
          g.fillRect(fx - 1, ly - 6, 17, 12);
          g.drawImage(flag, fx, ly - 5, 15, 10);
          g.strokeStyle = 'rgba(28,42,51,0.35)'; g.lineWidth = 0.6;
          g.strokeRect(fx, ly - 5, 15, 10);
        }
        g.lineWidth = 3;
        g.strokeStyle = C.halo;
        g.strokeText(label, tx, ly);
        g.fillStyle = hl ? C.portHl : emb ? '#b8322a' : C.ink;
        g.fillText(label, tx, ly);
      }
    }
    this.dirty = false;
  }

  drawOverlay(frac = 0) {
    const g = this.octx, dpr = this.dpr, state = this.state, ctx = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (!state) return;
    const { scale } = this.view;
    const ui = this.ui || {};
    const kmToPx = scale / 60; // 1 mille nautique ≈ 1/60 de degré

    // Côtes sensibles : zones hachurées (une pollution y coûte bien plus cher).
    g.save();
    for (const z of ZONES) {
      const [x, y] = this.toScreen(z.lon, z.lat);
      const r = Math.max(6, z.r * kmToPx);
      if (x + r < 0 || x - r > this.w || y + r < 0 || y - r > this.h) continue;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = `rgba(46,140,110,${0.05 + z.factor * 0.012})`; g.fill();
      g.setLineDash([4, 4]); g.lineWidth = 1.2; g.strokeStyle = 'rgba(30,110,85,0.55)'; g.stroke(); g.setLineDash([]);
      if (scale > 7) {
        g.font = 'italic 600 10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = 'rgba(244,239,227,0.85)'; g.strokeText(`🌿 ${tr(z.name)}`, x, y - r * 0.55);
        g.fillStyle = 'rgba(22,95,72,0.95)'; g.fillText(`🌿 ${tr(z.name)}`, x, y - r * 0.55);
      }
    }
    // Zones de piraterie : cercles rouges en pointillés.
    for (const z of PIRACY_ZONES) {
      const [x, y] = this.toScreen(z.lon, z.lat);
      const r = Math.max(6, z.r * kmToPx);
      if (x + r < 0 || x - r > this.w || y + r < 0 || y - r > this.h) continue;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = `rgba(196,54,44,${z.rate * 2.2})`; g.fill();
      g.setLineDash([2, 5]); g.lineWidth = 1.4; g.strokeStyle = 'rgba(170,40,32,0.6)'; g.stroke(); g.setLineDash([]);
      const bs = scale > 4 ? 1.15 : 0.85;
      this.pirateBadge(g, x, y, bs);
      if (scale > 4) {
        g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3.5; g.strokeStyle = 'rgba(244,239,227,0.9)'; g.strokeText(tr(z.name), x, y + 17 * bs + 4);
        g.fillStyle = 'rgba(150,32,26,0.98)'; g.fillText(tr(z.name), x, y + 17 * bs + 4);
      }
    }
    g.restore();
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

    // Tempêtes.
    for (const s of state.storms) {
      const [x, y] = this.toScreen(s.lon, s.lat);
      const r = Math.max(10, s.radius * kmToPx);
      if (x + r < 0 || x - r > this.w || y + r < 0 || y - r > this.h) continue;
      const hue = s.force >= 11 ? '214,58,50' : s.force >= 9 ? '230,126,20' : '214,170,30';
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${hue},0.42)`);
      rg.addColorStop(0.6, `rgba(${hue},0.18)`);
      rg.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      // Spirale stylisée.
      g.strokeStyle = `rgba(${hue},0.55)`;
      g.lineWidth = 1.5;
      const rot = (state.t / 6) % (Math.PI * 2) * (s.lat >= 0 ? -1 : 1);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x, y, r * 0.55, rot + (k * Math.PI * 2) / 3, rot + (k * Math.PI * 2) / 3 + 1.2);
        g.stroke();
      }
      this.badge(g, x, y, String(s.force), `rgb(${hue})`);
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
      this.polyline(g, route.points, ship.voyage.progress, selected ? 'rgba(28,42,51,0.85)' : 'rgba(28,42,51,0.3)', selected ? [6, 4] : [3, 5], selected ? 2 : 1.2, route);
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
      if (x < -20 || x > this.w + 20 || y < -20 || y > this.h + 20) continue;
      const own = ship.owner === active;
      this.drawShip(g, x, y, pos.heading, company.color, !!ship.cargo, own, ship.id === ui.selectedShip);
      this.shipScreenPos.push({ id: ship.id, x, y, own });
      if (ship.id === ui.selectedShip || (own && scale > 7)) this.label(g, x + 9, y - 9, ship.name);
    }
    // Navires à quai : pictogramme aux couleurs de la compagnie, et pour les vôtres une
    // pastille qui dit ce qu'ils font (chargement, déchargement, réparation, attente…).
    const now = performance.now() / 1000;
    for (const [port, ships] of inPort) {
      const P = PORTS[port];
      if (!P) continue;
      const [px, py] = this.toScreen(P.lon, P.lat);
      if (px < -60 || px > this.w + 60 || py < -60 || py > this.h + 60) continue;
      ships.sort((a, b) => (b.owner === active) - (a.owner === active));
      // En arcs autour du port, en laissant libre la droite, où s'écrit son nom.
      const A0 = 0.95, SPAN = Math.PI * 2 - 2 * A0;
      let ring = 0, slot = 0;
      ships.forEach((ship) => {
        const rr = 25 + ring * 18, slots = Math.max(4, Math.floor((rr * SPAN) / 30));
        const ang = A0 + ((slot + 0.5) * SPAN) / slots;
        if (++slot >= slots) { slot = 0; ring++; }
        const x = px + Math.cos(ang) * rr, y = py + Math.sin(ang) * rr;
        const own = ship.owner === active;
        const kind = portActivity(ship);
        this.drawDocked(g, x, y, state.companies[ship.owner].color, own, kind === 'laidup', ship.id === ui.selectedShip);
        if (own) this.statusBadge(g, x + 9, y - 8, kind, now);
        this.shipScreenPos.push({ id: ship.id, x, y, own });
        if (ship.id === ui.selectedShip) this.label(g, x + 17, y + 2, ship.name);
      });
    }
    // Ports en grève.
    for (const [p, until] of Object.entries(state.strikes)) {
      if (until <= state.t) continue;
      const [x, y] = this.toScreen(PORTS[p].lon, PORTS[p].lat);
      this.badge(g, x - 14, y + 12, 'grève', '#ef5350', 9);
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

  drawShip(g, x, y, heading, color, laden, own, selected) {
    g.save();
    g.translate(x, y);
    if (selected) {
      g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2);
      g.strokeStyle = C.portHl; g.lineWidth = 2.2; g.stroke();
    }
    g.rotate(heading);
    const s = own ? 1.15 : 0.9;
    g.scale(s, s);
    g.fillStyle = laden ? color : 'rgba(251,248,241,0.95)';
    g.fill(SHIP_SHAPE);
    g.lineWidth = laden ? 1.3 : 2;
    g.strokeStyle = laden ? C.ink : color;
    g.stroke(SHIP_SHAPE);
    g.restore();
  }

  // Insigne de piraterie : crâne et tibias blancs sur disque sombre cerclé de rouge.
  // Pavillon pirate : drapeau noir sur sa hampe, tête de mort et tibias croisés.
  pirateBadge(g, x, y, s = 1) {
    g.save();
    g.translate(x, y); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // Hampe et pommeau.
    g.lineWidth = 3.4; g.strokeStyle = 'rgba(244,239,227,0.9)';
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-14, 13); g.stroke();
    g.lineWidth = 1.8; g.strokeStyle = '#4a3420';
    g.beginPath(); g.moveTo(-14, -14); g.lineTo(-14, 13); g.stroke();
    g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(-14, -15, 1.9, 0, Math.PI * 2); g.fill();
    // Le pavillon, légèrement ondulé, avec un liseré clair pour ressortir sur la carte.
    g.beginPath();
    g.moveTo(-13, -13);
    g.quadraticCurveTo(-2, -16.5, 13, -12);
    g.lineTo(13, 5);
    g.quadraticCurveTo(-2, 9, -13, 5);
    g.closePath();
    g.fillStyle = '#17110f'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = '#f4efe3'; g.stroke();
    // Tête de mort et tibias croisés, au centre du pavillon.
    g.translate(0, -4.2); g.scale(0.82, 0.82);
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

  // Navire à quai vu de profil (cap à droite) ; désarmé : grisé.
  drawDocked(g, x, y, color, own, laidup, selected) {
    g.save();
    g.translate(x, y);
    const s = own ? 1.1 : 0.72;
    if (selected) { g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.strokeStyle = C.portHl; g.lineWidth = 2.4; g.stroke(); }
    g.scale(s, s);
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.lineTo(7, 4.5); g.lineTo(-9, 4.5); g.closePath();
    g.fillStyle = laidup ? '#a9a59c' : color; g.fill();
    g.lineWidth = 1.3; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = laidup ? '#d8d4ca' : '#fbf8f1';
    g.fillRect(-7, -4.5, 6, 4.5); g.strokeRect(-7, -4.5, 6, 4.5);
    g.fillStyle = laidup ? '#a9a59c' : color;
    g.fillRect(-5.5, -8, 2.6, 3.5); g.strokeRect(-5.5, -8, 2.6, 3.5);
    g.beginPath(); g.moveTo(3, 0); g.lineTo(3, -6); g.lineTo(7.5, -3); g.stroke(); // mât de charge
    g.restore();
  }

  // Pastille d'activité d'un navire à quai.
  statusBadge(g, x, y, kind, now) {
    const S = PORT_STATUS[kind];
    if (!S) return;
    g.save();
    g.translate(x, y);
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
    else if (S.icon === 'zzz') { g.font = '800 8px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 0, 0.5); }
    g.restore();
  }

  badge(g, x, y, text, color, size = 11) {
    text = tr(text);
    g.font = `700 ${size}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 8;
    g.fillStyle = 'rgba(251,248,241,0.92)';
    g.strokeStyle = color; g.lineWidth = 1.5;
    roundRect(g, x - w / 2, y - size / 2 - 3, w, size + 6, 4);
    g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5);
    g.textAlign = 'left';
  }

  label(g, x, y, text) {
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = C.halo;
    g.strokeText(text, x, y);
    g.fillStyle = C.ink; g.fillText(text, x, y);
  }

  frame(frac) {
    if (this.dirty) this.drawBase();
    this.drawOverlay(frac);
  }
}

// Ce que fait un navire à quai, pour sa pastille sur la carte.
export const PORT_STATUS = {
  idle: { color: '#e09a2a', icon: 'bang', label: 'En attente d\'ordres' },
  plan: { color: '#0f6f76', icon: 'right', label: 'Départ programmé' },
  chargement: { color: '#2e8b57', icon: 'up', label: 'Chargement' },
  'déchargement': { color: '#2f6fb0', icon: 'down', label: 'Déchargement' },
  'réparation': { color: '#d9822b', icon: 'wrench', label: 'Réparation' },
  'réarmement': { color: '#d9822b', icon: 'cycle', label: 'Réarmement' },
  installation: { color: '#7b5ea7', icon: 'gear', label: 'Installation d\'équipement' },
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
