// Le bureau de la compagnie en pixel art fin, dans le style des navires (pixelship.js, choix du propriétaire) :
// chaque meuble a son contour (ton sombre de sa matière, plus clair côté lumière), cinq tons par matière,
// lumière en haut à gauche, dégradés tramés. La pièce remplit le fond du panneau Bureau ; la feuille des
// chiffres glisse devant quand on fait défiler.
// paintOffice() dessine la pièce au pixel du dessin (W × H) : le panneau l'agrandit sans lissage.
// Le décor tient dans CORE_W pixels au centre ; au-delà, murs et sol continuent.
import { ramp, mix, renderShipCanvas } from './pixelship.js';
import { logoMarkup, emblemInk, isLightColor, shade } from './logos.js';
import { honourSVG } from './trophyart.js';
import { RECORD_IDS, EVIL_IDS } from '../sim/honours.js';

export const CORE_W = 320;
export const FLOOR_GAP = 10; // pixels de sol visibles sous le mur, au-dessus de la feuille
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
const INK = '#121b21';

// ---------- Couleurs (entiers RGBA petit-boutistes, pour ImageData) ----------
const ints = new Map();
const I = (h) => {
  let v = ints.get(h);
  if (v === undefined) {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; ints.set(h, v);
  }
  return v;
};
const mixI = (a, b, k) => {
  const r = (a & 255) + (((b & 255) - (a & 255)) * k), g = ((a >>> 8) & 255) + ((((b >>> 8) & 255) - ((a >>> 8) & 255)) * k);
  const bl = ((a >>> 16) & 255) + ((((b >>> 16) & 255) - ((a >>> 16) & 255)) * k);
  return ((255 << 24) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
};
const ramps = new Map();
// Cinq tons d'une matière (ombre profonde, ombre, ton propre, lumière, reflet), comme les navires.
const RP = (h) => { let v = ramps.get(h); if (!v) { v = ramp(h).map(I); ramps.set(h, v); } return v; };
const INK_I = I(INK), DEEP = I('#0b1218');
const outlineOf = (c, light) => mixI(mixI(c, DEEP, 0.62), INK_I, light ? 0.25 : 0.55);

// ---------- Images chargées à part (emblème, trophées) ----------
let version = 0, listener = null, bumpT = 0;
export const officeArtVersion = () => version;
export function onOfficeArt(fn) { listener = fn; }
const bump = () => { if (bumpT) return; bumpT = setTimeout(() => { bumpT = 0; version++; listener?.(); }, 30); };
const svgImage = (svg, done) => {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => done(img);
  img.onerror = () => done(null);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const logoAlpha = new Map(); // id → Uint8Array 64 × 64, 'loading' ou null
function logoMask(id, size) {
  const a = logoAlpha.get(id);
  if (a === undefined) {
    logoAlpha.set(id, 'loading');
    svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128" color="#000">${logoMarkup(id)}</svg>`, (img) => {
      if (!img) { logoAlpha.set(id, null); return; }
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data, m = new Uint8Array(4096);
      for (let i = 0; i < 4096; i++) m[i] = d[i * 4 + 3];
      logoAlpha.set(id, m); bump();
    });
    return null;
  }
  if (!(a instanceof Uint8Array)) return null;
  let x0 = 64, y0 = 64, x1 = -1, y1 = -1;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (a[y * 64 + x] > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(size / bw, size / bh);
  const w = Math.max(1, Math.round(bw * k)), h = Math.max(1, Math.round(bh * k));
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const sx0 = x0 + (x * bw) / w, sx1 = x0 + ((x + 1) * bw) / w, sy0 = y0 + (y * bh) / h, sy1 = y0 + ((y + 1) * bh) / h;
      let s = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) { s += a[yy * 64 + xx]; n++; }
      row.push(s / Math.max(1, n) > 105);
    }
    rows.push(row);
  }
  return rows;
}
// Trophées et preuves : les dessins vectoriels (trophyart.js) réduits en pixels pleins, cernés comme le reste.
const honourImgs = new Map(); // kind:id → Image | 'loading' | null
const honourPx = new Map(); // kind:id:h → { w, h, px }
function honourSprite(kind, id, h) {
  const key = `${kind}:${id}`;
  const img = honourImgs.get(key);
  if (img === undefined) {
    honourImgs.set(key, 'loading');
    svgImage(honourSVG(kind, id, { size: 256 }), (im) => { honourImgs.set(key, im); if (im) bump(); });
    return null;
  }
  if (!img || img === 'loading') return null;
  const k2 = `${key}:${h}`;
  let s = honourPx.get(k2);
  if (!s) {
    const w = Math.max(3, Math.round(h * 0.75));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, px = new Uint32Array(w * h);
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 120) px[i] = ((255 << 24) | (d[i * 4 + 2] << 16) | (d[i * 4 + 1] << 8) | d[i * 4]) >>> 0;
    s = { w, h, px }; honourPx.set(k2, s);
  }
  return s;
}
// La maquette du plus beau navire : le dessin des navires, coupé à la flottaison (maquette sur socle).
const modelCache = new Map();
function modelSprite(m, w) {
  if (!m || typeof document === 'undefined') return null;
  const key = `${m.typeId}|${m.color}|${m.logo}|${m.name}|${w}`;
  let s = modelCache.get(key);
  if (s === undefined) {
    s = null;
    try {
      const cv = document.createElement('canvas');
      const S = renderShipCanvas(cv, m.typeId, { style: 'fine', W: w, H: Math.round(w * 0.42), laden: false, color: m.color, logo: m.logo, name: m.name, seed: m.name || m.typeId, sky: false });
      let x0 = S.W, x1 = -1, y0 = S.H, y1 = -1;
      for (let y = 0; y < S.WL; y++) for (let x = 0; x < S.W; x++) if (S.sh.c[y * S.W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 >= 0) {
        const sw = x1 - x0 + 1, sh = y1 - y0 + 1, px = new Uint32Array(sw * sh);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const c = S.sh.c[(y + y0) * S.W + x + x0]; if (c) px[y * sw + x] = I(c); }
        s = { w: sw, h: sh, px };
      }
    } catch { s = null; }
    modelCache.set(key, s);
    if (modelCache.size > 40) modelCache.delete(modelCache.keys().next().value);
  }
  return s;
}

// ---------- Où se posent les trophées (x = centre, b = base, h = hauteur ; coordonnées du décor, sol F) ----------
const row = (n, x0, dx, b, h) => Array.from({ length: n }, (_, i) => ({ x: x0 + i * dx, b, h }));
const SLOTS = [
  { record: [...row(4, 258, 15, -111, 16), ...row(4, 258, 15, -81, 16)], evil: [...row(3, 60, 11, -29, 14), ...row(3, 60, 11, -10, 14)] },
  { record: [...row(4, 269, 14, -113, 16), ...row(4, 269, 14, -85, 16)], evil: [...row(3, 276, 12, -27, 14), ...row(3, 276, 12, -9, 14)] },
  { record: [...row(4, 244, 13, -32, 17), ...row(4, 244, 13, -5, 17)], evil: [...row(3, 59, 11, -27, 14), ...row(3, 59, 11, -9, 14)] },
  { record: [...row(4, 248, 16, -27, 17), ...row(4, 248, 16, -4, 16)], evil: [...row(3, 72, 11, -27, 14), ...row(3, 72, 11, -9, 14)] },
  { record: [...row(4, 241, 12, -41, 16), ...row(4, 241, 12, -15, 16)], evil: [...row(3, 23, 13, -23, 14), ...row(3, 23, 13, -7, 14)] },
];

// ---------- Ambiances de fenêtre ----------
const MOODS = {
  day: { sky: ['#7fb6d6', '#a6cde2', '#cfe4ec', '#e6f0ee'], sea: ['#5d93ab', '#4b819b', '#3e718a'], far: '#a9bec6', city: '#9aa9ae', crane: '#c9572f', box: true, glint: '#e8f4f6', cloud: '#fbfdfc' },
  gold: { sky: ['#e39a5e', '#efb57c', '#f5d2a0', '#f8e6c4'], sea: ['#8d8e88', '#74828a', '#62737c'], far: '#bf9a82', city: '#a5877a', crane: '#7a5244', box: true, glint: '#ffe7b0', cloud: '#fbe3c0', sun: '#fff3cf' },
  dusk: { sky: ['#17213f', '#2c3160', '#5a3f6e', '#a85868', '#e9895a', '#f6b46a'], sea: ['#2f3f5e', '#26354f', '#1d2a42'], far: '#3a3550', city: '#1c2233', crane: '#20242f', lights: true, glint: '#f6b46a' },
  night: { sky: ['#050916', '#0a1229', '#121c3a', '#1b2648'], sea: ['#101b30', '#0d1628', '#0a1220'], far: '#121a2c', city: '#0c111d', crane: '#0f141f', lights: true, glint: '#d8dcc0', moon: true },
};

/**
 * Dessine le bureau. o : tier (0..4), shadow (liste noire), color, logo, model { typeId, color, logo, name },
 * held { record: [ids], evil: [ids] }, W, H (pixels du dessin).
 * Renvoie { room, floor, juke: { x, y, w, h, img }, F } : room et floor (motif de sol à répéter sous la pièce)
 * sont des ImageData ; juke est le juke-box à part (il se clique et s'illumine au survol).
 */
export function paintOffice(o) {
  const { tier, shadow = false, color = '#1e3a55', logo = 'ancre', model = null, held = null } = o;
  const W = Math.max(40, Math.round(o.W)), H = Math.max(60, Math.round(o.H));
  const F = H - FLOOR_GAP, ox = Math.floor((W - CORE_W) / 2);
  const L = -ox, R = W - ox; // bords du canevas, en coordonnées du décor
  const room = new Uint32Array(W * H), jukeBuf = new Uint32Array(W * H), tmp = new Uint32Array(W * H);
  let dest = room, T = room, bx0 = 0, by0 = 0, bx1 = -1, by1 = -1, clip = null;
  const set = (x, y, c) => {
    x = Math.round(x) + ox; y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (clip && (x < clip[0] || y < clip[1] || x >= clip[2] || y >= clip[3])) return;
    T[y * W + x] = c;
    if (T === tmp) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  };
  const get = (x, y) => { x = Math.round(x) + ox; y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? 0 : dest[y * W + x]; };
  const rect = (x, y, w, h, c) => { const ci = typeof c === 'number' ? c : I(c); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, ci); };
  const dith = (x, y, w, h, a, b, t) => {
    const A = typeof a === 'number' ? a : I(a), B = typeof b === 'number' ? b : I(b);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = typeof t === 'function' ? t(i, j) : t;
      set(x + i, y + j, bay(x + i + ox, y + j) < k ? B : A);
    }
  };
  // Dégradé vertical tramé sur plusieurs tons.
  const grad = (x, y, w, h, cols) => {
    const C = cols.map((c) => (typeof c === 'number' ? c : I(c)));
    for (let j = 0; j < h; j++) {
      const f = (j / Math.max(1, h - 1)) * (C.length - 1), i0 = Math.min(C.length - 2, Math.floor(f)), fr = f - i0;
      for (let i = 0; i < w; i++) set(x + i, y + j, bay(x + i + ox, y + j) < fr ? C[i0 + 1] : C[i0]);
    }
  };
  const ellipse = (cx, cy, rx, ry, c, fn = null) => {
    const ci = typeof c === 'number' ? c : I(c);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1) set(x, y, fn ? fn(x, y, d) : ci);
    }
  };
  const poly = (pts, c) => {
    const ci = typeof c === 'number' ? c : I(c);
    const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) set(x, y, ci);
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    const ci = typeof c === 'number' ? c : I(c);
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { set(x0, y0, ci); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  };
  // Assombrit ou éclaire ce qui est déjà peint (ombres portées, halos), avec une trame douce.
  const tint = (x, y, w, h, toward, kf) => {
    const B = typeof toward === 'number' ? toward : I(toward);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = Math.round(x + i) + ox, Y = Math.round(y + j);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const k = typeof kf === 'function' ? kf(i, j) : kf;
      if (k <= 0) continue;
      const lv = Math.floor(k * 4 + bay(X, Y)) / 4; // quatre paliers tramés : pas de flou
      if (lv > 0) dest[Y * W + X] = mixI(dest[Y * W + X], B, Math.min(0.9, lv));
    }
  };
  const glow = (cx, cy, r, c, s) => tint(cx - r, cy - r, r * 2, r * 2, c, (i, j) => { const d = Math.hypot(i - r, j - r) / r; return d < 1 ? s * (1 - d) * (1 - d) : 0; });
  const shadowUnder = (x, w, y = F, h = 3, k = 0.45) => tint(x - 1, y, w + 2, h, DEEP, (i, j) => k * (1 - j / h) * Math.min(1, Math.min(i + 1, w + 2 - i) / 3));
  // Une pièce de mobilier : dessinée à part, puis cernée (ton sombre de sa matière, plus clair en haut à gauche).
  const piece = (draw, outline = true) => {
    T = tmp; bx0 = W; by0 = H; bx1 = -1; by1 = -1;
    draw();
    T = dest;
    if (bx1 < 0) return;
    if (outline) {
      for (let y = Math.max(0, by0 - 1); y <= Math.min(H - 1, by1 + 1); y++) for (let x = Math.max(0, bx0 - 1); x <= Math.min(W - 1, bx1 + 1); x++) {
        if (tmp[y * W + x]) continue;
        const dn = y + 1 < H ? tmp[(y + 1) * W + x] : 0, up = y > 0 ? tmp[(y - 1) * W + x] : 0;
        const rt = x + 1 < W ? tmp[y * W + x + 1] : 0, lf = x > 0 ? tmp[y * W + x - 1] : 0;
        const nb = dn || rt || up || lf;
        if (!nb) continue;
        dest[y * W + x] = outlineOf(nb, (dn || rt) && !up && !lf);
      }
    }
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * W + x, c = tmp[i]; if (c) { dest[i] = c; tmp[i] = 0; } }
  };
  // Boîte vue de face, dessus visible (profondeur d) : dessus clair, face au ton propre, arête gauche éclairée.
  const box = (x, y, w, h, base, { d = 3, inset = null } = {}) => {
    const r = RP(base);
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) set(x + i, y - d + j, j === 0 ? r[4] : r[3]);
    rect(x, y, w, h, r[2]);
    rect(x, y, 1, h, r[3]); rect(x + w - 1, y, 1, h, r[1]); rect(x, y + h - 1, w, 1, r[1]);
    if (inset) rect(x + inset, y + 1, w - inset * 2, 1, r[1]);
    return r;
  };
  // Tiroir ou porte de meuble : creux d'une ligne, poignée.
  const drawer = (x, y, w, h, base, knob = '#c9a24a') => {
    const r = RP(base);
    rect(x, y, w, 1, r[1]); rect(x, y, 1, h, r[1]); rect(x, y + h - 1, w, 1, r[3]); rect(x + w - 1, y, 1, h, r[3]);
    const k = RP(knob); rect(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2), 3, 1, k[2]); set(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2), k[4]);
  };
  // Vue depuis la fenêtre (rectangle découpé) : ciel, soleil ou lune, côte ou ville, mer, quai, grues, navire.
  const view = (x0, y0, w, h, mood, { city = 0, ship = true, quay = true, high = false } = {}) => {
    const P = MOODS[mood], save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const hz = y0 + Math.round(h * (high ? 0.52 : 0.62));
    grad(x0, y0, w, hz - y0, P.sky);
    if (P.lights) for (let k = 0; k < Math.round((w * (hz - y0)) / (mood === 'night' ? 160 : 260)); k++) { const sx = x0 + ((k * 53 + 7) % w), sy = y0 + ((k * 31 + k * k * 7) % Math.max(1, Math.round((hz - y0) * (mood === 'night' ? 0.55 : 0.35)))); set(sx, sy, k % 5 ? mixI(I('#c9d2e8'), get(sx, sy), 0.35) : I('#ffffff')); }
    if (P.sun) { const sx = x0 + Math.round(w * 0.72), sy = hz - Math.round((hz - y0) * 0.3); glow(sx, sy, 16, '#fff1c8', 0.6); ellipse(sx, sy, 5, 5, P.sun); }
    if (P.moon) { const mx = x0 + Math.round(w * 0.22), my = y0 + Math.round((hz - y0) * 0.3); glow(mx, my, 12, '#9fb0d8', 0.35); ellipse(mx, my, 4, 4, '#f2efdc'); set(mx + 1, my - 1, I('#d6d1b8')); set(mx - 1, my + 1, I('#d6d1b8')); }
    if (P.cloud) for (const [cx, cy, cw] of [[0.2, 0.25, 9], [0.55, 0.14, 6], [0.86, 0.32, 7]]) {
      const X0 = x0 + Math.round(w * cx), Y0 = y0 + Math.round((hz - y0) * cy);
      ellipse(X0, Y0, cw, cw * 0.32, P.cloud); ellipse(X0 - cw * 0.4, Y0 + 1, cw * 0.55, cw * 0.28, P.cloud); ellipse(X0 + cw * 0.3, Y0 - 1, cw * 0.5, cw * 0.36, P.cloud);
      rect(X0 - cw, Y0 + Math.round(cw * 0.2), cw * 2, 1, mixI(I(P.cloud), I(P.sky[1]), 0.5));
    }
    // Côte lointaine ou ville.
    const far = I(P.far);
    for (let x = x0; x < x0 + w; x++) { const hh = Math.round((Math.sin(x * 0.07 + 1.3) * 0.5 + Math.sin(x * 0.19) * 0.25 + 0.6) * 3); for (let y = hz - hh; y < hz; y++) set(x, y, far); }
    if (city) {
      const n = Math.round(w / 7);
      for (let k = 0; k < n; k++) {
        const bw = 4 + ((k * 7) % 6), bh = Math.round((6 + ((k * 13) % 17) + (k % 4 === 0 ? 10 : 0)) * (city > 1 ? 1.5 : 1)), bx = x0 + Math.round((k / n) * w) + ((k * 3) % 4) - 2;
        const cc = mixI(I(P.city), far, (k % 3) * 0.15);
        rect(bx, hz - bh, bw, bh, cc);
        if (k % 5 === 1) rect(bx + Math.floor(bw / 2), hz - bh - 3, 1, 3, cc);
        const lit = P.lights ? I('#ffd27a') : mixI(cc, I('#ffffff'), 0.22);
        for (let yy = hz - bh + 2; yy < hz - 1; yy += 2) for (let xx = bx + 1; xx < bx + bw - 1; xx += 2) if (((xx * 7 + yy * 3 + k) % (P.lights ? 3 : 5)) === 0) set(xx, yy, lit);
      }
    }
    grad(x0, hz, w, y0 + h - hz, P.sea);
    rect(x0, hz, w, 1, mixI(I(P.sea[0]), I(P.glint), 0.35));
    const gl = I(P.glint);
    for (let k = 0; k < Math.round(w / 5); k++) { const gx = x0 + ((k * 37) % w), gy = hz + 2 + ((k * 11) % Math.max(1, y0 + h - hz - 3)); rect(gx, gy, 2 + (k % 3), 1, k % 3 ? gl : mixI(gl, I(P.sea[1]), 0.5)); }
    if (P.sun) for (let j = 1; j < 9; j += 2) rect(x0 + Math.round(w * 0.72) - 4 + (j % 3), hz + j, 9 - j / 2, 1, I('#ffe6a8'));
    if (P.moon) for (let j = 1; j < 8; j += 2) rect(x0 + Math.round(w * 0.22) - 2 + (j % 2), hz + j, 5 - j / 3, 1, I('#c8c8b0'));
    // Quai : portiques à conteneurs et piles de boîtes.
    if (quay) {
      const qy = hz + Math.max(3, Math.round((y0 + h - hz) * 0.45)), qc = mood === 'day' ? '#8e8a82' : mood === 'gold' ? '#7e6c62' : '#1a1f2b';
      const qh = Math.min(y0 + h - qy, Math.max(4, Math.round(h * 0.07))), qw = Math.round(w * 0.46);
      rect(x0, qy, qw, qh, qc);
      rect(x0, qy, qw, 1, mixI(I(qc), I('#ffffff'), 0.25));
      rect(x0, qy + qh, qw, 1, mixI(I(qc), DEEP, 0.4));
      for (let k = 0; k < qw; k += 9) rect(x0 + k, qy + qh, 1, 2, mixI(I(qc), DEEP, 0.3)); // pieux
      if (P.box) {
        const cols = ['#c4362c', '#2f6fb0', '#e09a2a', '#2e8b57', '#8f98a5', '#b9442f'];
        for (let k = 0; k < Math.round(w * 0.46 / 6); k++) for (let r = 0; r < 1 + (k % 3 === 0 ? 1 : 0) + (k % 2); r++) {
          const c = RP(cols[(k * 3 + r) % cols.length]);
          rect(x0 + 1 + k * 6, qy - 3 - r * 3, 5, 3, c[2]); rect(x0 + 1 + k * 6, qy - 3 - r * 3, 5, 1, c[3]);
        }
      }
      const crane = (cx, ch) => {
        const c = RP(P.crane), top = qy - ch;
        rect(cx, top, 2, ch, c[2]); rect(cx + 8, top, 2, ch, c[1]);
        rect(cx - 4, top - 1, 24, 2, c[2]); rect(cx - 4, top - 1, 24, 1, c[3]);
        rect(cx + 2, top + 2, 6, 3, c[1]); line(cx, top, cx + 4, top - 5, c[2]); line(cx + 10, top, cx + 4, top - 5, c[2]);
        if (P.lights) set(cx + 4, top - 6, I('#ff4a3a'));
      };
      crane(x0 + Math.round(w * 0.08), Math.round(h * 0.26));
      if (w > 70) crane(x0 + Math.round(w * 0.28), Math.round(h * 0.22));
      if (P.lights) for (let k = 0; k < Math.round(w * 0.46 / 4); k++) set(x0 + 2 + k * 4, qy - 1 - (k % 2), I(k % 3 ? '#ffcf6e' : '#ff7a5c'));
    }
    if (ship) {
      const sw = Math.max(18, Math.round(w * 0.3)), sx = x0 + Math.round(w * 0.52), sy = hz + Math.max(2, Math.round((y0 + h - hz) * 0.32));
      const hull = RP(mood === 'night' || mood === 'dusk' ? '#2a2f3a' : '#3a3532');
      poly([[sx, sy], [sx + sw, sy], [sx + sw - 3, sy + 3], [sx + 2, sy + 3]], hull[2]);
      rect(sx, sy, sw, 1, hull[3]);
      rect(sx + 2, sy - 5, 5, 5, P.lights ? I('#c9c3b0') : I('#efe6d2')); rect(sx + 3, sy - 7, 2, 2, I(color));
      if (P.lights) { set(sx + 3, sy - 4, I('#ffd27a')); set(sx + 5, sy - 4, I('#ffd27a')); set(sx + sw - 1, sy - 1, I('#7fe08a')); }
      else for (let k = 0; k < Math.floor((sw - 10) / 4); k++) { const c = RP(['#c4362c', '#2f6fb0', '#e09a2a', '#2e8b57'][k % 4]); rect(sx + 8 + k * 4, sy - 3, 3, 3, c[2]); rect(sx + 8 + k * 4, sy - 3, 3, 1, c[3]); }
      for (let k = 0; k < 3; k++) rect(sx + sw - 2 + k * 2, sy + 3 + k, 3, 1, mixI(gl, I(P.sea[1]), 0.4));
    }
    clip = save;
  };
  // Châssis de fenêtre (montants, traverse, appui) autour de view().
  const sash = (x, y, w, h, base, { bars = 1, cross = true, sill = true, t = 3 } = {}) => {
    const r = RP(base);
    piece(() => {
      rect(x - t, y - t, w + t * 2, t, r[3]); rect(x - t, y + h, w + t * 2, t, r[2]);
      rect(x - t, y, t, h, r[3]); rect(x + w, y, t, h, r[2]);
      for (let k = 1; k <= bars; k++) { const bx = x + Math.round((w * k) / (bars + 1)) - 1; rect(bx, y, 2, h, r[2]); set(bx, y, r[3]); }
      if (cross) rect(x, y + Math.round(h * 0.42), w, 2, r[2]);
      if (sill) { rect(x - t - 3, y + h + t, w + t * 2 + 6, 2, r[4]); rect(x - t - 3, y + h + t + 2, w + t * 2 + 6, 1, r[1]); }
    });
    // reflet sur la vitre
    for (let k = 0; k < Math.min(h, w) * 0.5; k++) { set(x + 3 + k, y + h - 3 - k * 2, mixI(get(x + 3 + k, y + h - 3 - k * 2), I('#ffffff'), 0.25)); }
  };

  // ---------- Petits objets communs ----------
  const plant = (x, base, s = 1, pot = '#b5653a') => {
    piece(() => {
      const p = RP(pot), lw = Math.round(10 * s), lh = Math.round(9 * s);
      rect(x - Math.floor(lw / 2), base - lh, lw, lh, p[2]); rect(x - Math.floor(lw / 2) - 1, base - lh - 2, lw + 2, 2, p[3]);
      rect(x - Math.floor(lw / 2), base - lh, 1, lh, p[3]); rect(x + Math.ceil(lw / 2) - 1, base - lh, 1, lh, p[1]);
    });
    piece(() => {
      // palmier d'intérieur : des palmes qui montent puis retombent, folioles de chaque côté
      const g = RP('#3f8a4a'), top = base - Math.round(9 * s) - 1;
      for (const [dx, dy, len] of [[-1.1, -0.7, 20], [-0.7, -1.2, 26], [-0.1, -1.4, 28], [0.5, -1.25, 26], [1.05, -0.8, 21], [-1.35, -0.3, 14], [1.35, -0.25, 13]]) {
        const Ln = len * s;
        for (let t = 0; t <= 1; t += 0.5 / Ln) {
          const px = x + dx * Ln * 0.5 * t, py = top + dy * Ln * 0.62 * t + t * t * Ln * 0.42;
          set(px, py, g[1]);
          if (t > 0.12 && Math.round(t * Ln) % 2 === 0) {
            const lw = Math.max(1, Math.round((1.15 - t) * 4 * s));
            for (let k = 1; k <= lw; k++) { set(px - k * 0.7, py + k * 0.75, k < lw ? g[3] : g[2]); set(px + k * 0.7, py + k * 0.75, k < lw ? g[2] : g[1]); }
          }
        }
      }
      set(x, top - 1, g[4]);
    });
  };
  const lampGreen = (x, base) => { // lampe de banquier
    piece(() => { const b = RP('#c9a24a'); rect(x, base - 1, 9, 1, b[2]); rect(x + 4, base - 7, 1, 6, b[3]); });
    piece(() => { const g = RP('#2f6b4a'); rect(x - 1, base - 10, 11, 3, g[2]); rect(x, base - 11, 9, 1, g[4]); rect(x - 1, base - 8, 11, 1, g[1]); });
    tint(x - 4, base - 7, 17, 7, '#ffe9a8', (i, j) => (Math.abs(i - 8) < 3 + j ? 0.18 : 0));
  };
  const phone = (x, base, c = '#2a2a2a') => piece(() => { const r = RP(c); rect(x, base - 3, 10, 3, r[2]); rect(x, base - 3, 10, 1, r[3]); rect(x + 1, base - 5, 3, 2, r[2]); rect(x + 6, base - 5, 3, 2, r[2]); rect(x + 1, base - 5, 8, 1, r[3]); });
  const papers = (x, base, w = 14) => piece(() => { for (let k = 0; k < 3; k++) rect(x + (k % 2), base - 1 - k, w - k, 1, I(k === 2 ? '#fbf8f1' : '#e9e4d6')); rect(x + 4, base - 3, 6, 1, I('#c4362c')); });
  const mug = (x, base, c = '#f2efe6') => piece(() => { const r = RP(c); rect(x, base - 4, 4, 4, r[2]); rect(x, base - 4, 1, 4, r[3]); set(x + 4, base - 3, r[1]); set(x + 4, base - 2, r[1]); rect(x, base - 4, 4, 1, I('#5a3a22')); });
  const books = (x, y, w, h, rows, wood = '#7a5434') => {
    const r = box(x, y, w, h, wood, { d: 2 });
    const rh = Math.floor((h - 2) / rows), cols = ['#8c2f2f', '#2f4f6f', '#3e6b4a', '#a1782f', '#5d4a7a', '#6f6f6f', '#b45a2c', '#c9b27a'];
    for (let q = 0; q < rows; q++) {
      const sy = y + 1 + q * rh;
      rect(x + 1, sy, w - 2, rh - 1, r[0]);
      let bx = x + 2, k = q * 3;
      while (bx < x + w - 4) {
        const bw = 2 + (k % 2), bh = rh - 3 - (k % 3), c = RP(cols[(k * 5 + q) % cols.length]);
        if (k % 7 === 5) { for (let j = 0; j < bh - 1; j++) set(bx + Math.floor(j / 2), sy + rh - 2 - j, c[2]); bx += 3; k++; continue; } // livre penché
        rect(bx, sy + rh - 1 - bh, bw, bh, c[2]); rect(bx, sy + rh - 1 - bh, 1, bh, c[3]); set(bx, sy + rh - bh + 1, c[4]);
        bx += bw; k++;
      }
      rect(x + 1, sy + rh - 1, w - 2, 1, r[3]);
    }
  };
  // Cadre (bois ou doré) autour d'un tableau.
  const framed = (x, y, w, h, base, inner, t = 3) => {
    piece(() => { const r = RP(base); rect(x - t, y - t, w + t * 2, h + t * 2, r[2]); rect(x - t, y - t, w + t * 2, 1, r[4]); rect(x - t, y - t, 1, h + t * 2, r[3]); rect(x + w + t - 1, y - t, 1, h + t * 2, r[1]); rect(x - t, y + h + t - 1, w + t * 2, 1, r[1]); rect(x - 1, y - 1, w + 2, h + 2, r[0]); });
    inner();
  };
  const shipPainting = (x, y, w, h, gold = true) => framed(x, y, w, h, gold ? '#c9a24a' : '#6b4a2e', () => {
    const hz = y + Math.round(h * 0.6);
    grad(x, y, w, hz - y, ['#cdbb92', '#e3d3ac', '#efe2bd']);
    grad(x, hz, w, y + h - hz, ['#5b7f8a', '#4a6b75', '#3d5a63']);
    const cx = x + Math.round(w / 2);
    piece(() => {
      poly([[cx - 13, hz], [cx + 14, hz], [cx + 10, hz + 4], [cx - 10, hz + 4]], I('#3a2d23'));
      for (const [mx, mh] of [[-7, 18], [0, 22], [7, 16]]) {
        rect(cx + mx, hz - mh, 1, mh, I('#3a2d23'));
        rect(cx + mx - 4, hz - mh + 2, 9, 4, I('#f6efdc')); rect(cx + mx - 5, hz - mh + 7, 11, 5, I('#f6efdc')); rect(cx + mx - 4, hz - mh + 13, 9, 3, I('#efe4c8'));
      }
    });
    for (let k = 0; k < 6; k++) rect(x + 2 + ((k * 13) % (w - 6)), hz + 2 + (k % 3) * 2, 3, 1, I('#9cb8bf'));
  });
  // Écusson de la compagnie : disque à sa couleur, partagé en deux tons, emblème en pixels pleins.
  const roundel = (cx, cy, r, rim = '#efe6d2') => {
    const rimR = RP(rim), field = RP(color), dark = I(shade(color, isLightColor(color) ? -0.3 : -0.45));
    piece(() => {
      ellipse(cx, cy, r + 1.5, r + 1.5, rimR[2], (x, y) => (y < cy - r * 0.4 && x < cx ? rimR[4] : y > cy + r * 0.5 ? rimR[1] : rimR[2]));
      ellipse(cx, cy, r, r, field[2], (x, y) => (x + (y - cy) * 0.6 > cx + 1 ? dark : field[2]));
    });
    const m = logoMask(logo, Math.round(r * 1.25));
    if (m) {
      const ink = I(emblemInk(color)), edge = I(isLightColor(color) ? '#fbf8f1' : '#121b21');
      const mh = m.length, mw = m[0].length, x0 = Math.round(cx - mw / 2), y0 = Math.round(cy - mh / 2);
      for (let y = -1; y <= mh; y++) for (let x = -1; x <= mw; x++) {
        const on = m[y]?.[x];
        if (on) set(x0 + x, y0 + y, ink);
        else if (m[y + 1]?.[x] || m[y - 1]?.[x] || m[y]?.[x + 1] || m[y]?.[x - 1]) set(x0 + x, y0 + y, mixI(edge, field[1], 0.35));
      }
    }
    // reflet
    set(cx - Math.round(r * 0.55), cy - Math.round(r * 0.6), I('#ffffff'));
  };
  // Plaque carrée (enseigne) portant l'écusson.
  const sign = (x, y, s, base, kind = 'plate') => {
    const r = RP(base);
    piece(() => {
      rect(x, y, s, s, r[2]); rect(x, y, s, 1, r[4]); rect(x, y, 1, s, r[3]); rect(x + s - 1, y, 1, s, r[1]); rect(x, y + s - 1, s, 1, r[1]);
      if (kind === 'paper') { set(x + 1, y + 1, I('#e9d98a')); set(x + s - 2, y + 1, I('#e9d98a')); }
    });
    if (kind === 'paper') { rect(x - 1, y - 1, 4, 2, I('#e9e0a8')); rect(x + s - 3, y - 1, 4, 2, I('#e9e0a8')); }
    roundel(x + s / 2, y + s / 2, Math.floor(s / 2) - 3, kind === 'paper' ? '#f6f2e6' : '#efe6d2');
  };
  // Fauteuil vu de face, derrière le bureau (dossier au-dessus du plateau).
  const chair = (cx, top, bottom, base, { wing = false, studs = null, w = 22 } = {}) => {
    const r = RP(base);
    piece(() => {
      const x = cx - Math.floor(w / 2);
      rect(x, top + 2, w, bottom - top - 2, r[2]); rect(x + 2, top, w - 4, 2, r[2]); rect(x + 2, top, w - 4, 1, r[3]);
      rect(x, top + 2, 1, bottom - top - 2, r[3]); rect(x + w - 1, top + 2, 1, bottom - top - 2, r[1]);
      rect(x + 3, top + 3, w - 6, bottom - top - 5, r[3]); rect(x + 4, top + 4, w - 8, bottom - top - 7, r[2]);
      if (wing) { rect(x - 3, top + 6, 3, bottom - top - 8, r[1]); rect(x + w, top + 6, 3, bottom - top - 8, r[1]); }
      if (studs) for (let yy = top + 6; yy < bottom - 2; yy += 6) for (let xx = x + 6; xx < x + w - 5; xx += 5) set(xx, yy, I(studs));
    });
  };
  const chairBase = (cx, y, c = '#3a3f47') => piece(() => { const r = RP(c); rect(cx - 1, y, 3, F - y - 3, r[2]); rect(cx - 9, F - 3, 19, 2, r[2]); rect(cx - 9, F - 3, 19, 1, r[3]); set(cx - 9, F - 1, r[0]); set(cx + 9, F - 1, r[0]); set(cx, F - 1, r[0]); });
  const monitor = (x, base, w, h, frame, screen, draw) => {
    piece(() => {
      const f = RP(frame);
      rect(x + Math.floor(w / 2) - 2, base - 3, 5, 3, f[1]); rect(x + Math.floor(w / 2) - 5, base - 1, 11, 1, f[2]);
      rect(x, base - 3 - h, w, h, f[2]); rect(x, base - 3 - h, w, 1, f[3]); rect(x, base - 3 - h, 1, h, f[3]); rect(x + w - 1, base - 3 - h, 1, h, f[1]);
      rect(x + 2, base - 1 - h, w - 4, h - 4, I(screen));
    });
    draw?.(x + 2, base - 1 - h, w - 4, h - 4);
  };
  const chart = (x, y, w, h, c, k = 0) => { let py = y + h - 2; for (let i = 0; i < w; i++) { const ny = y + 1 + Math.round((h - 3) * (0.5 + 0.4 * Math.sin(i * 0.5 + k) * Math.cos(i * 0.23 + k * 2) - i / w * 0.4)); line(x + i - 1, py, x + i, ny, I(c)); py = ny; } };
  const redRoutes = (x, y, w, h) => {
    const pts = [[0.1, 0.4], [0.45, 0.3], [0.85, 0.5], [0.25, 0.75], [0.7, 0.7]].map(([a, b]) => [x + Math.round(a * w), y + Math.round(b * h)]);
    for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 4], [4, 2]]) { const [x0, y0] = pts[a], [x1, y1] = pts[b]; for (let t = 0; t <= 1; t += 0.08) if (Math.round(t * 12) % 2 === 0) set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), I('#ff3040')); }
    for (const [px, py] of pts) { set(px, py, I('#ffffff')); set(px + 1, py, I('#ff3040')); set(px, py + 1, I('#ff3040')); }
  };
  // Maquette sur son socle (sur un bureau ou une console).
  const shipModel = (x, base, w) => {
    const s = modelSprite(model, w + 8);
    piece(() => { const r = RP('#3e2716'); rect(x, base - 2, w, 2, r[2]); rect(x, base - 2, w, 1, r[3]); rect(x + Math.round(w * 0.3), base - 4, 2, 2, I('#c9a24a')); rect(x + Math.round(w * 0.7), base - 4, 2, 2, I('#c9a24a')); });
    if (!s) return;
    const sx = x + Math.round((w - s.w) / 2), sy = base - 3 - s.h;
    for (let y = 0; y < s.h; y++) for (let xx = 0; xx < s.w; xx++) { const c = s.px[y * s.w + xx]; if (c) set(sx + xx, sy + y, c); }
  };

  // ---------- Décor de l'ombre ----------
  const curtains = (x, y, w, h) => {
    const v = RP('#8e1426'), g = RP('#c9a24a'), pw = Math.max(10, Math.min(18, Math.round(w * 0.14))), tie = y + Math.round(h * 0.58);
    const pan = (x0, dir) => piece(() => {
      for (let yy = y - 2; yy < y + h + 4; yy++) {
        const pinch = yy < tie ? 1 - ((yy - y) / (tie - y)) * 0.55 : 0.45 + ((yy - tie) / (h + 4 - (tie - y))) * 0.75;
        const ww = Math.max(3, Math.round(pw * pinch));
        for (let i = 0; i < ww; i++) { const fold = Math.sin((i + (dir > 0 ? 0 : 1)) * 1.3); set(x0 + dir * i, yy, fold > 0.55 ? v[3] : fold < -0.5 ? v[1] : v[2]); }
      }
    });
    pan(x - 4, 1); pan(x + w + 3, -1);
    piece(() => { // cantonnière à franges dorées
      rect(x - 7, y - 7, w + 14, 5, v[2]); rect(x - 7, y - 7, w + 14, 1, v[3]);
      for (let i = -7; i < w + 7; i++) { const k = (i + 7) % 12; if (k < 8) set(x + i, y - 2 + (k > 1 && k < 6 ? 1 : 0), v[1]); if (i % 2 === 0) set(x + i, y - 2 + (k > 1 && k < 6 ? 2 : 1), g[3]); }
      rect(x - 7, y - 8, w + 14, 1, g[2]);
    });
    piece(() => { rect(x - 3, tie, 4, 2, g[3]); rect(x + w - 1, tie, 4, 2, g[3]); });
  };
  const chandelier = (cx, top, s = 1) => {
    const g = RP('#c9a24a'), cord = Math.max(3, Math.round(6 * s)), y = top + cord;
    rect(cx, top, 1, cord, g[1]);
    glow(cx, y + 4, Math.round(26 * s), '#ffe7a0', 0.35);
    piece(() => {
      const w = Math.round(13 * s);
      rect(cx - w, y + 3, w * 2 + 1, 2, g[2]); rect(cx - w, y + 3, w * 2 + 1, 1, g[4]);
      rect(cx - Math.round(w * 0.6), y + 5, Math.round(w * 1.2) + 1, 2, g[1]);
      rect(cx - 1, y, 3, 3, g[3]);
      for (const dx of [-w, -Math.round(w / 2), 0, Math.round(w / 2), w]) { rect(cx + dx, y, 1, 3, I('#f4ead0')); set(cx + dx, y - 1, I('#ffd877')); }
      for (let k = -3; k <= 3; k++) for (let j = 0; j < 4 - Math.abs(k) / 1.5; j++) set(cx + k * 2, y + 7 + j, j % 2 ? I('#bfe4ff') : I('#f2fbff'));
    });
  };
  const bust = (x, base, s = 1) => {
    const g = RP('#d9a636'), m = RP('#2c2c33');
    piece(() => { rect(x - Math.round(7 * s), base - Math.round(14 * s), Math.round(14 * s), Math.round(14 * s), m[2]); rect(x - Math.round(7 * s), base - Math.round(14 * s), 1, Math.round(14 * s), m[3]); rect(x - Math.round(8 * s), base - Math.round(15 * s), Math.round(16 * s), 2, m[3]); });
    piece(() => {
      const b = base - Math.round(15 * s);
      ellipse(x, b - 3 * s, 8 * s, 4 * s, g[2], (px, py) => (py > b - 2 * s ? g[1] : px < x - 3 * s ? g[3] : g[2]));
      rect(x - 1, b - 8 * s, 3, 3 * s, g[1]);
      ellipse(x, b - 12 * s, 4 * s, 5 * s, g[2], (px, py) => (px < x - 1 && py < b - 13 * s ? g[4] : px > x + 2 ? g[1] : g[2]));
      rect(x - 4 * s, b - 17 * s, 8 * s, 2, g[1]); rect(x - 2, b - 10 * s, 4, 1, g[0]);
    });
  };
  const safe = (x, base, s = 1) => {
    const st = RP('#4d535b'), w = Math.round(24 * s), h = Math.round(28 * s), y = base - h;
    piece(() => {
      rect(x, y, w, h, st[2]); rect(x, y, w, 1, st[4]); rect(x, y, 1, h, st[3]); rect(x + w - 1, y, 1, h, st[1]); rect(x, y + h - 1, w, 1, st[1]);
      rect(x + 3, y + 3, w - 9, h - 6, I('#15171a'));
      for (let k = 0; k < 3; k++) { const gb = RP('#e0ae35'); rect(x + 4 + k * 4, y + 8, 4, 2, gb[2]); set(x + 4 + k * 4, y + 8, gb[4]); }
      for (let k = 0; k < 2; k++) { rect(x + 5 + k * 4, y + 6, 4, 2, I('#e0ae35')); }
      for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { rect(x + 4 + k * 6 + (r % 2), y + 13 + r * 3, 5, 2, I('#5f8f5a')); set(x + 6 + k * 6 + (r % 2), y + 13 + r * 3, I('#efe6c8')); }
      // porte entrouverte
      poly([[x + w - 6, y + 2], [x + w + 5, y - 1], [x + w + 5, y + h + 1], [x + w - 6, y + h - 2]], st[3]);
      ellipse(x + w, y + h / 2, 3, 3, st[1]); set(x + w, y + Math.round(h / 2), I('#c9a24a'));
    });
  };
  const whisky = (x, base) => {
    piece(() => { rect(x, base - 7, 5, 7, I('#9fc7d8')); rect(x + 1, base - 9, 3, 2, I('#cfe7f0')); rect(x + 1, base - 4, 3, 3, I('#b8792a')); set(x + 1, base - 6, I('#ffffff')); });
    piece(() => { rect(x + 7, base - 3, 3, 3, I('#cfe7f0')); rect(x + 7, base - 2, 3, 1, I('#b8792a')); });
    piece(() => { rect(x + 12, base - 1, 6, 1, I('#9fc7d8')); rect(x + 13, base - 2, 5, 1, I('#7a4a24')); set(x + 18, base - 2, I('#ff6a2a')); });
    for (let k = 0; k < 4; k++) set(x + 18 + (k % 2), base - 4 - k * 2, I('#c9c9c9'));
  };
  const portrait = (x, y, w, h) => framed(x, y, w, h, '#d9a636', () => {
    grad(x, y, w, h, ['#3b2a2a', '#2a1c1c', '#1d1414']);
    const cx = x + Math.round(w / 2);
    piece(() => {
      const suit = RP('#2a2d36');
      poly([[cx - w * 0.42, y + h], [cx - w * 0.3, y + h * 0.62], [cx + w * 0.3, y + h * 0.62], [cx + w * 0.42, y + h]], suit[2]);
      poly([[cx - 3, y + h * 0.62], [cx + 3, y + h * 0.62], [cx, y + h * 0.9]], I('#f2efe6'));
      rect(cx - 1, Math.round(y + h * 0.66), 2, Math.round(h * 0.2), I('#8c1426'));
      set(Math.round(cx - w * 0.25), Math.round(y + h * 0.7), I('#d4243a'));
      ellipse(cx, y + h * 0.42, w * 0.18, h * 0.17, I('#d9a07a'), (px, py) => (px > cx + 1 ? I('#b9805c') : I('#d9a07a')));
      rect(Math.round(cx - w * 0.18), Math.round(y + h * 0.24), Math.round(w * 0.36) + 1, 3, I('#17110e'));
      rect(cx - 3, Math.round(y + h * 0.5), 6, 1, I('#17110e'));
      set(cx - 2, Math.round(y + h * 0.4), I('#17110e')); set(cx + 2, Math.round(y + h * 0.4), I('#17110e'));
    });
  });
  const leopard = (x0, x1) => { // peau de léopard : fond fauve, rosettes sombres
    const base = I('#c88a3a'), lt = I('#dcaa5c'), dk = I('#24140a'), md = I('#9a5f24');
    for (let y = F + 1; y < H; y++) { const ins = Math.round(Math.max(0, 3 - (y - F)) * 1.5); for (let x = x0 + ins; x < x1 - ins; x++) set(x, y, (x * 3 + y) % 7 === 0 ? lt : base); }
    for (let k = 0; k < (x1 - x0 - 6) / 6; k++) {
      const cx = x0 + 5 + k * 6 + (k % 2), cy = F + 3 + ((k * 3) % 4);
      set(cx, cy, md); set(cx + 1, cy, md);
      for (const [dx, dy] of [[-1, -1], [0, -1], [2, 0], [2, 1], [0, 1], [-1, 0]]) if ((dx + dy + k) % 4 !== 0) set(cx + dx, cy + dy, dk);
    }
  };
  const persian = (x0, x1) => {
    const red = RP('#8e2f2f'), gold = RP('#c99a5b');
    for (let y = F + 2; y < H; y++) for (let x = x0; x < x1; x++) {
      const edge = y === F + 2 || x === x0 || x === x1 - 1;
      const border = y === F + 4 || x === x0 + 2 || x === x1 - 3;
      set(x, y, edge ? gold[1] : border ? gold[2] : ((x + y * 2) % 7 === 0 ? red[3] : (x - y) % 9 === 0 ? gold[2] : red[2]));
    }
  };

  // ---------- Murs, sols ----------
  const floorFill = FLOORS[shadow ? 'shadow' + tier : tier] || FLOORS[tier];
  const paintFloor = (buf, y0, y1, yOff) => { for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) buf[(y - yOff) * W + x] = floorFill(x - ox, y - F); };
  paintFloor(room, F, H, 0);
  // l'ombre du mur sur le sol
  tint(L, F, R - L, 3, DEEP, (i, j) => 0.3 * (1 - j / 3));

  const anyEvil = (held?.evil || []).length > 0;
  const juke = (fn) => { const d = dest; dest = jukeBuf; T = jukeBuf; fn(); dest = d; T = d; };

  if (tier === 0) {
    // ---- Le cagibi du quai : plâtre défraîchi, petite fenêtre, bureau de tôle, ampoule nue.
    const wall = shadow ? '#3a3d33' : '#adb399';
    grad(L, 0, R - L, F, shadow ? ['#2e3029', '#34362e', '#3a3d33'] : ['#a3a990', '#adb399', '#b5bba1']);
    // taches d'humidité, écaillures
    tint(18, 8, 40, 30, '#7e846d', (i, j) => { const d = Math.hypot((i - 20) / 20, (j - 15) / 15); return d < 1 ? 0.35 * (1 - d) : 0; });
    tint(150, 20, 30, 40, '#8f9580', (i, j) => (Math.abs(i - 15 - Math.sin(j * 0.4) * 3) < 1.2 ? 0.5 : 0));
    for (const [x, y] of [[230, F - 140], [36, F - 70], [120, F - 150]]) { rect(x, y, 5, 3, I(mix(wall, '#e0e3d2', 0.4))); rect(x + 1, y + 3, 3, 1, I(mix(wall, '#6d725e', 0.4))); }
    // soubassement peint
    const dado = shadow ? '#2a2c25' : '#8d957c';
    rect(L, F - 34, R - L, 34, dado); rect(L, F - 34, R - L, 1, I(mix(dado, '#ffffff', 0.25))); rect(L, F - 35, R - L, 1, I(mix(dado, '#000000', 0.3)));
    dith(L, F - 33, R - L, 33, I(dado), I(mix(dado, '#000000', 0.12)), (i, j) => j / 33 * 0.5);
    rect(L, F - 4, R - L, 4, '#5a4632'); rect(L, F - 4, R - L, 1, '#7a6046');
    // tuyau au plafond
    if (F > 150) {
      const p = RP('#8a9396');
      rect(L, 6, R - L, 4, p[2]); rect(L, 6, R - L, 1, p[4]); rect(L, 9, R - L, 1, p[1]);
      for (let x = L + 10; x < R; x += 60) { rect(x, 3, 3, 9, p[1]); rect(x, 3, 3, 1, p[3]); }
      tint(L, 10, R - L, 3, DEEP, 0.18);
    }
    // fenêtre
    const wx = 196, wy = F - 120, ww = 50, wh = 38;
    if (shadow) { view(wx, wy, ww, wh, 'night', { ship: true }); } else view(wx, wy, ww, wh, 'day', { ship: true });
    sash(wx, wy, ww, wh, '#e8e3d4', { bars: 1, cross: true, t: 3 });
    if (shadow) curtains(wx - 2, wy - 2, ww + 4, wh + 6);
    // affiche (ou portrait du patron) et calendrier
    if (shadow) portrait(66, F - 126, 28, 34);
    else {
      piece(() => { rect(66, F - 124, 28, 36, I('#f3efe2')); rect(66, F - 124, 28, 1, I('#ffffff')); });
      grad(69, F - 121, 22, 18, ['#9cc6d8', '#d8e8ec']); rect(69, F - 106, 22, 3, I('#4b819b'));
      piece(() => { poly([[71, F - 106], [89, F - 106], [86, F - 103], [73, F - 103]], I('#c4362c')); rect(80, F - 112, 4, 6, I('#efe6d2')); rect(81, F - 114, 2, 2, I('#1c2a33')); });
      rect(69, F - 99, 22, 3, I('#1c2a33')); rect(72, F - 94, 16, 1, I('#8f98a5'));
      rect(64, F - 126, 4, 2, I('#e9e0a8')); rect(92, F - 126, 4, 2, I('#e9e0a8'));
    }
    piece(() => { rect(104, F - 112, 16, 18, I('#f6f3ea')); rect(104, F - 112, 16, 4, I('#c4362c')); for (let k = 0; k < 9; k++) set(106 + (k % 3) * 4, F - 105 + Math.floor(k / 3) * 3, I('#8f98a5')); set(110, F - 102, I('#c4362c')); });
    rect(111, F - 114, 1, 2, I('#3a3a3a'));
    // enseigne : une feuille scotchée avec l'écusson
    sign(160, F - 122, 24, '#f6f2e6', 'paper');
    // ampoule nue (ou lustre ridicule chez l'armateur de l'ombre)
    if (shadow) chandelier(150, 0, 0.8);
    else {
      const by = Math.min(F - 132, 40);
      rect(150, 0, 1, by, I('#2f2f2f'));
      glow(150, by + 4, 34, '#fff3c0', 0.4);
      piece(() => { rect(149, by, 3, 3, I('#5a5a5a')); ellipse(150.5, by + 6, 3, 3.5, I('#fff8d8')); set(150, by + 5, I('#ffffff')); });
    }
    // armoire de classement
    piece(() => {
      const r = box(12, F - 60, 32, 60, shadow ? '#5f6668' : '#7f8a8c');
      for (let k = 0; k < 3; k++) { drawer(14, F - 57 + k * 19, 28, 17, shadow ? '#5f6668' : '#7f8a8c', '#c9c9c9'); rect(24, F - 54 + k * 19, 8, 3, I('#efe6d2')); }
      set(36, F - 30, r[1]); set(37, F - 29, r[1]);
    });
    shadowUnder(12, 32);
    mug(16, F - 63); piece(() => { for (let k = 0; k < 4; k++) rect(24 + (k % 2), F - 64 - k * 2, 16, 2, I(['#e2c26a', '#c4362c', '#2f6fb0', '#e2c26a'][k])); });
    // cartons (ou chariot des méfaits)
    if (!anyEvil) {
      piece(() => { box(52, F - 20, 26, 20, '#b08a5a'); rect(52, F - 13, 26, 2, I('#d9c79a')); });
      piece(() => { box(58, F - 34, 20, 14, '#a07a4a'); rect(66, F - 34, 4, 14, I('#d9c79a')); });
      shadowUnder(52, 26);
    } else {
      piece(() => {
        const m = RP('#5a5f63');
        rect(52, F - 28, 38, 2, m[3]); rect(52, F - 9, 38, 2, m[2]);
        rect(53, F - 28, 2, 26, m[2]); rect(87, F - 28, 2, 26, m[1]);
        for (const wx2 of [55, 85]) { ellipse(wx2, F - 2, 2, 2, I('#1c1c1c')); }
      });
      shadowUnder(52, 38);
    }
    // bureau de tôle
    chair(146, F - 56, F - 30, shadow ? '#5a2a1c' : '#4f6272', { w: 18 });
    chairBase(146, F - 30, '#3a3a3a');
    piece(() => {
      const r = box(104, F - 30, 94, 3, shadow ? '#6a7275' : '#8a9396', { d: 3 });
      rect(106, F - 27, 3, 27, r[1]);
      box(166, F - 27, 30, 27, shadow ? '#5f6668' : '#7f8a8c', { d: 0 });
      for (let k = 0; k < 3; k++) drawer(168, F - 26 + k * 8, 26, 7, shadow ? '#5f6668' : '#7f8a8c', '#c9c9c9');
    });
    shadowUnder(104, 94);
    monitor(112, F - 33, 26, 22, '#d7d2c2', '#21352c', (x, y, w, h) => { for (let j = 0; j < h; j += 2) rect(x, y + j, w, 1, I('#2a4237')); chart(x + 1, y + 2, w - 2, h - 4, shadow ? '#ff4050' : '#7fe08a', 1); });
    piece(() => { const k = RP('#cfc9b8'); rect(114, F - 33, 22, 2, k[2]); rect(114, F - 33, 22, 1, k[3]); });
    papers(142, F - 33, 15);
    if (shadow) whisky(160, F - 33);
    phone(176, F - 33);
    // radio sur sa caisse (le juke-box du cagibi)
    juke(() => {
      piece(() => { const r = box(258, F - 22, 34, 22, '#9b7a52'); for (let k = 0; k < 3; k++) rect(259, F - 21 + k * 7, 32, 1, r[1]); rect(262, F - 16, 26, 4, I('#3a2a1a')); });
      piece(() => {
        const b = RP('#a8432c');
        rect(262, F - 42, 26, 20, b[2]); rect(264, F - 44, 22, 2, b[2]); rect(264, F - 44, 22, 1, b[4]); rect(262, F - 42, 1, 20, b[3]); rect(287, F - 42, 1, 20, b[1]);
        rect(265, F - 40, 11, 14, I('#efe3c6')); for (let k = 0; k < 4; k++) rect(266, F - 38 + k * 3, 9, 1, I('#9c8a6a'));
        ellipse(281.5, F - 35, 3.2, 3.2, I('#efe3c6')); set(282, F - 37, I('#5a2a1c'));
        ellipse(281.5, F - 27.5, 2, 2, I('#3a1a10'));
      });
      line(286, F - 44, 292, F - 56, I('#cfcfcf')); set(292, F - 57, I('#ffffff'));
    });
    shadowUnder(258, 34);
    // étagère des records
    for (const sy of [-80, -110]) piece(() => { const r = RP('#8a6440'); rect(250, F + sy, 64, 3, r[2]); rect(250, F + sy, 64, 1, r[4]); rect(254, F + sy + 3, 2, 5, r[1]); rect(308, F + sy + 3, 2, 5, r[1]); });
    // serpillière
    piece(() => { line(306, F - 2, 314, F - 46, I('#b8936a')); line(307, F - 2, 315, F - 46, I('#8a6a46')); });
    piece(() => { const r = RP('#9a9a8a'); rect(300, F - 10, 14, 10, r[2]); rect(300, F - 10, 14, 1, r[4]); rect(300, F - 10, 1, 10, r[3]); });
    if (shadow) { safe(204, F, 1); leopard(110, 250); }
  } else if (tier === 1) {
    // ---- Le bureau sur le port : papier peint crème, grande fenêtre, bibliothèque, carte marine.
    if (shadow) { grad(L, 0, R - L, F, ['#3d1620', '#4a1d27', '#521f2b']); damask(L, 0, R - L, F - 30, '#c9a24a'); }
    else { grad(L, 0, R - L, F, ['#e3d6b8', '#e8dcc0', '#eee3c9']); for (let x = L + (L & 1); x < R; x += 12) dith(x, 0, 6, F - 30, I('#e8dcc0'), I('#e2d5b6'), 0.5); }
    const lam = shadow ? '#2e1219' : '#b08a5e';
    rect(L, F - 30, R - L, 30, lam);
    for (let x = L - (L % 14) - 14; x < R; x += 14) { rect(x, F - 30, 1, 30, I(mix(lam, '#000000', 0.25))); rect(x + 1, F - 30, 1, 30, I(mix(lam, '#ffffff', 0.15))); }
    rect(L, F - 32, R - L, 3, I(mix(lam, '#ffffff', 0.2))); rect(L, F - 29, R - L, 1, I(mix(lam, '#000000', 0.3)));
    rect(L, F - 4, R - L, 4, I(mix(lam, '#000000', 0.25)));
    if (F > 160) { const c = RP(shadow ? '#5a2430' : '#d8c9a6'); rect(L, 0, R - L, 5, c[2]); rect(L, 5, R - L, 1, c[1]); rect(L, 6, R - L, 1, c[3]); }
    // fenêtre
    const wx = 160, wy = F - 142, ww = 96, wh = 64;
    view(wx, wy, ww, wh, shadow ? 'night' : 'day', { city: 0 });
    if (!shadow) for (let k = 0; k < 4; k++) { rect(wx, wy + k * 3, ww, 2, I('#f2ede0')); rect(wx, wy + k * 3 + 1, ww, 1, I('#d8d0bc')); } // store à moitié levé
    sash(wx, wy, ww, wh, shadow ? '#c9a24a' : '#fbf8f1', { bars: 1, cross: false, t: 4 });
    if (shadow) curtains(wx - 3, wy - 3, ww + 6, wh + 8);
    // suspension émaillée
    if (shadow) chandelier(208, 0, 1);
    else if (F > 150) { const ly = Math.min(F - 150, 28); rect(118, 0, 1, ly, I('#3a3a3a')); glow(118, ly + 6, 30, '#fff1c8', 0.3); piece(() => { const g = RP('#2f6b4a'); poly([[113, ly + 6], [124, ly + 6], [121, ly], [116, ly]], g[2]); rect(113, ly + 6, 12, 1, g[1]); rect(116, ly, 5, 1, g[4]); }); }
    // bibliothèque et globe
    piece(() => books(8, F - 110, 44, 110, 5, shadow ? '#4a2716' : '#7a5434'));
    shadowUnder(8, 44);
    piece(() => { const r = RP('#3d7aa8'); ellipse(30, F - 120, 7, 7, r[2], (x, y) => ((x * 3 + y * 5) % 11 < 3 ? I('#7fae6a') : x < 28 && y < F - 121 ? r[3] : r[2])); rect(29, F - 113, 3, 2, I('#c9a24a')); rect(25, F - 112, 11, 2, I('#6b4a2e')); });
    // carte marine (routes rouges chez l'armateur de l'ombre)
    framed(64, F - 128, 52, 34, '#5a3c24', () => {
      grad(64, F - 128, 52, 34, ['#b9d6df', '#cfe1e8']);
      for (const [x, y, w, h] of [[68, F - 124, 14, 9], [74, F - 116, 8, 10], [98, F - 126, 14, 12], [94, F - 112, 18, 14]]) ellipse(x + w / 2, y + h / 2, w / 2, h / 2, I('#e9dcb7'), (px, py, d) => (d > 0.75 ? I('#c9b98f') : I('#e9dcb7')));
      if (shadow) redRoutes(64, F - 128, 52, 34);
      else for (let k = 0; k < 12; k++) set(80 + k * 1.3, F - 114 + Math.sin(k * 0.6) * 3, I('#2f6fb0'));
    });
    // plaque de la compagnie
    sign(126, F - 126, 24, shadow ? '#c9a24a' : '#8a6440');
    // gramophone sur son guéridon (sur le coffre-fort chez l'armateur de l'ombre)
    const gx = 80, gTop = shadow ? F - 28 : F - 24;
    if (shadow) safe(68, F, 1);
    else { piece(() => { const r = RP('#7a5434'); ellipse(gx, gTop + 1, 17, 2.5, r[3]); rect(gx - 17, gTop + 2, 35, 2, r[2]); rect(gx - 1, gTop + 4, 3, F - gTop - 6, r[2]); rect(gx - 8, F - 2, 17, 2, r[1]); }); shadowUnder(gx - 9, 18); }
    juke(() => {
      piece(() => { const r = RP('#6b4a2e'); rect(gx - 11, gTop - 9, 22, 9, r[2]); rect(gx - 11, gTop - 9, 22, 1, r[4]); rect(gx - 11, gTop - 9, 1, 9, r[3]); rect(gx + 10, gTop - 9, 1, 9, r[1]); rect(gx - 6, gTop - 5, 12, 1, r[1]); ellipse(gx - 2, gTop - 10, 9, 1.5, I('#1b1b1b')); set(gx - 2, gTop - 10, I('#c4362c')); });
      piece(() => { const b = RP('#d4a64a'); line(gx + 7, gTop - 11, gx + 10, gTop - 20, b[1]); line(gx + 8, gTop - 11, gx + 11, gTop - 20, b[2]); poly([[gx + 9, gTop - 20], [gx + 12, gTop - 20], [gx + 26, gTop - 38], [gx + 14, gTop - 44]], b[2]); poly([[gx + 9, gTop - 20], [gx + 10, gTop - 21], [gx + 15, gTop - 43], [gx + 14, gTop - 44]], b[4]); ellipse(gx + 20, gTop - 41, 7, 3, b[1]); ellipse(gx + 20, gTop - 41, 5, 1.6, I('#5a3a12')); });
    });
    // bureau en bois
    chair(158, F - 54, F - 30, shadow ? '#5a1420' : '#6b4a2e', { w: 20 });
    chairBase(158, F - 30, '#4a4540');
    piece(() => {
      const wood = shadow ? '#4a2716' : '#8a5d3b';
      box(110, F - 30, 98, 4, wood, { d: 3 });
      box(112, F - 26, 28, 26, wood, { d: 0 }); box(178, F - 26, 28, 26, wood, { d: 0 });
      for (let k = 0; k < 3; k++) { drawer(114, F - 25 + k * 8, 24, 7, wood); drawer(180, F - 25 + k * 8, 24, 7, wood); }
      rect(140, F - 26, 38, 14, RP(wood)[1]);
    });
    shadowUnder(110, 98);
    monitor(118, F - 33, 28, 20, '#2c3a44', '#1f3f55', (x, y, w, h) => { grad(x, y, w, h, ['#3d6f8c', '#2b5670']); for (const [a, b, c2] of [[3, 3, 7], [12, 6, 9], [7, 10, 5]]) rect(x + a, y + b, c2, 3, I('#e9dcb7')); if (shadow) redRoutes(x, y, w, h); });
    piece(() => { const k = RP('#3a4248'); rect(120, F - 33, 24, 2, k[2]); rect(120, F - 33, 24, 1, k[3]); });
    papers(148, F - 33, 14);
    if (shadow) whisky(166, F - 33); else phone(166, F - 33, '#d8cfb8');
    piece(() => { const r = RP('#c4362c'); rect(194, F - 44, 6, 11, r[2]); rect(194, F - 44, 1, 11, r[3]); rect(196, F - 42, 2, 4, I('#f2efe6')); });
    mug(186, F - 33, '#2f6fb0');
    // étagères des records
    for (const sy of [-84, -112]) piece(() => { const r = RP(shadow ? '#4a2716' : '#8a6440'); rect(262, F + sy, 56, 3, r[2]); rect(262, F + sy, 56, 1, r[4]); rect(266, F + sy + 3, 2, 5, r[1]); rect(312, F + sy + 3, 2, 5, r[1]); });
    if (anyEvil) {
      piece(() => { const r = box(266, F - 26, 44, 3, '#2a1d14', { d: 2 }); rect(268, F - 23, 2, 23, r[1]); rect(306, F - 23, 2, 23, r[1]); rect(266, F - 8, 44, 2, r[2]); });
      shadowUnder(266, 44);
    } else if (shadow) bust(296, F, 1);
    else { plant(298, F, 1.25); shadowUnder(290, 16); }
    if (shadow) leopard(100, 230);
  } else if (tier === 2) {
    // ---- Le siège : boiseries, tableau de navire, écusson, lustre, juke-box à l'ancienne.
    const wain = F - 50;
    if (shadow) { grad(L, 0, R - L, wain, ['#16301f', '#1d3a2d', '#21402f']); damask(L, 0, R - L, wain, '#c9a24a'); }
    else grad(L, 0, R - L, wain, ['#d1c4a6', '#d9cdb2', '#e0d4b8']);
    const pan = shadow ? '#4a2716' : '#8a5d3b', pr = RP(pan);
    rect(L, wain, R - L, F - wain, pr[2]);
    rect(L, wain - 4, R - L, 4, pr[1]); rect(L, wain - 4, R - L, 1, pr[3]); rect(L, wain - 1, R - L, 1, pr[0]);
    for (let x = L - ((L % 32) + 32) % 32; x < R; x += 32) {
      const px0 = x + 5, pw = 22, py0 = wain + 6, ph = F - wain - 14;
      rect(px0, py0, pw, ph, pr[1]); rect(px0 + 1, py0 + 1, pw - 2, ph - 2, pr[2]);
      rect(px0, py0 + ph - 1, pw, 1, shadow ? I('#c9a24a') : pr[3]); rect(px0 + pw - 1, py0, 1, ph, shadow ? I('#c9a24a') : pr[3]);
    }
    rect(L, F - 4, R - L, 4, pr[0]); rect(L, F - 4, R - L, 1, pr[1]);
    if (F > 150) { const c = RP(shadow ? '#2a4a38' : '#c9b991'); rect(L, 0, R - L, 6, c[2]); rect(L, 0, R - L, 1, c[3]); rect(L, 6, R - L, 2, c[1]); rect(L, 8, R - L, 1, c[4]); for (let x = L; x < R; x += 4) set(x, 3, c[1]); }
    // fenêtre
    const wx = 196, wy = F - 144, ww = 104, wh = 64;
    view(wx, wy, ww, wh, shadow ? 'night' : 'gold', { city: 1 });
    sash(wx, wy, ww, wh, shadow ? '#c9a24a' : '#efe6d2', { bars: 1, cross: true, t: 4 });
    if (shadow) curtains(wx - 3, wy - 3, ww + 6, wh + 8);
    if (!shadow) tint(wx - 70, wy + wh + 6, ww + 40, F - wy - wh - 6, '#fff1c8', (i, j) => (i > (F - wy - wh - 6 - j) * 0.9 && i < ww + 40 - j * 0.3 ? 0.1 : 0)); // rayon de soleil
    // tableau (ou portrait du patron)
    if (shadow) portrait(72, F - 130, 38, 42); else shipPainting(64, F - 130, 54, 36);
    // écusson et sa plaque
    roundel(140, F - 124, 14);
    piece(() => { const b = RP('#c9a24a'); rect(128, F - 104, 24, 4, b[2]); rect(128, F - 104, 24, 1, b[4]); rect(132, F - 102, 16, 1, b[1]); });
    if (F > 140) chandelier(172, 4, 0.75);
    // juke-box à l'ancienne
    glow(25, F - 34, 30, '#ffc860', 0.22);
    juke(() => piece(() => {
      const w = RP('#6e2617'), x = 8;
      rect(x, F - 50, 34, 50, w[2]); rect(x + 3, F - 56, 28, 6, w[2]); rect(x + 7, F - 60, 20, 4, w[2]); rect(x + 7, F - 60, 20, 1, w[4]); rect(x + 3, F - 56, 28, 1, w[3]);
      rect(x, F - 50, 1, 50, w[3]); rect(x + 33, F - 50, 1, 50, w[1]);
      const l = RP('#ffc860');
      rect(x + 5, F - 54, 24, 2, l[3]); rect(x + 3, F - 50, 2, 34, l[3]); rect(x + 29, F - 50, 2, 34, l[3]); rect(x + 3, F - 50, 1, 34, l[4]);
      rect(x + 8, F - 49, 18, 14, I('#2a1a14')); rect(x + 10, F - 47, 14, 10, I('#3b2a22')); ellipse(x + 17, F - 42, 4, 4, I('#141010')); ellipse(x + 17, F - 42, 1.5, 1.5, I('#c4362c'));
      for (let k = 0; k < 5; k++) rect(x + 7 + k * 4, F - 32, 3, 2, I(['#f39a3a', '#ffd877', '#7fd0c4', '#f39a3a', '#ff7a5c'][k]));
      rect(x + 7, F - 27, 20, 20, I('#d8d2c4')); for (let k = 0; k < 6; k++) rect(x + 8, F - 26 + k * 3, 18, 1, I('#a59d8e'));
      rect(x, F - 3, 34, 3, w[0]);
    }));
    if (shadow && !anyEvil) bust(25, F - 61, 0.7);
    shadowUnder(8, 34);
    // table des méfaits
    if (anyEvil) { piece(() => { const r = box(50, F - 26, 40, 3, '#2a1d14', { d: 2 }); rect(52, F - 23, 2, 23, r[1]); rect(86, F - 23, 2, 23, r[1]); rect(50, F - 8, 40, 2, r[2]); }); shadowUnder(50, 40); }
    // bureau des associés et fauteuil Chesterfield
    chair(156, F - 64, F - 32, '#6e2a1c', { wing: true, studs: '#c9a24a', w: 24 });
    piece(() => {
      const wood = '#5a3a22';
      const r = box(96, F - 32, 122, 5, wood, { d: 4 });
      rect(98, F - 36, 118, 2, I(shadow ? '#1f3a2c' : '#2f5a3e')); // sous-main de cuir
      box(100, F - 27, 34, 27, wood, { d: 0 }); box(180, F - 27, 34, 27, wood, { d: 0 });
      for (let k = 0; k < 3; k++) { drawer(102, F - 26 + k * 8, 30, 7, wood); drawer(182, F - 26 + k * 8, 30, 7, wood); }
      rect(134, F - 27, 46, 12, r[1]); rect(134, F - 16, 46, 1, r[0]);
    });
    shadowUnder(96, 122);
    lampGreen(104, F - 36);
    shipModel(124, F - 36, 56);
    papers(184, F - 36, 13);
    if (shadow) whisky(196, F - 36); else phone(200, F - 36);
    // vitrine des records
    piece(() => {
      const r = box(236, F - 58, 58, 58, '#4a2f1b', { d: 3 });
      rect(239, F - 55, 52, 52, I('#2a1a10'));
      dith(239, F - 55, 52, 52, I('#3a4a52'), I('#4a5a62'), (i, j) => (i + j) % 17 < 3 ? 1 : 0.1);
      rect(239, F - 31, 52, 2, I('#cfe1e8')); rect(239, F - 30, 52, 1, I('#8fa9b2'));
      rect(239, F - 4, 52, 1, I('#cfe1e8'));
    });
    shadowUnder(236, 58);
    if (!shadow) { plant(308, F, 1.15); shadowUnder(300, 16); }
    else bust(308, F, 0.9);
    if (shadow) leopard(70, 240); else persian(70, 250);
  } else if (tier === 3) {
    // ---- L'étage de direction : baie vitrée panoramique sur le port à l'heure dorée.
    const wy = Math.max(4, F - 168), wh = F - 40 - wy;
    grad(L, 0, R - L, F, shadow ? ['#1e1817', '#2a2220', '#2f2624'] : ['#e2ddd2', '#e9e4da', '#efebe2']);
    view(L + 6, wy, R - L - 12, wh, shadow ? 'night' : 'gold', { city: 2, high: true });
    piece(() => {
      const s = RP(shadow ? '#c9a24a' : '#f6f3ec');
      rect(L + 2, wy - 4, R - L - 4, 4, s[3]); rect(L + 2, wy + wh, R - L - 4, 4, s[2]);
      rect(L + 2, wy, 4, wh, s[3]); rect(R - 6, wy, 4, wh, s[2]);
      const n = Math.max(3, Math.round((R - L) / 70));
      for (let k = 1; k < n; k++) { const x = L + Math.round(((R - L) * k) / n) - 1; rect(x, wy, 3, wh, s[2]); rect(x, wy, 1, wh, s[3]); }
    });
    if (shadow) curtains(L + 8, wy, R - L - 16, wh + 6);
    const band = shadow ? '#2f2521' : '#d9d2c4', br = RP(band);
    rect(L, F - 36, R - L, 36, br[2]); rect(L, F - 36, R - L, 1, br[3]); rect(L, F - 4, R - L, 4, br[1]);
    if (shadow) chandelier(166, 0, 1.2);
    else for (let x = L + 20; x < R; x += 48) { set(x, 1, I('#fff6d8')); glow(x, 2, 8, '#fff6d8', 0.25); }
    // console et chaîne hi-fi
    piece(() => { box(8, F - 22, 54, 22, '#4a3326', { d: 3 }); drawer(10, F - 21, 25, 19, '#4a3326'); drawer(35, F - 21, 25, 19, '#4a3326'); });
    shadowUnder(8, 54);
    juke(() => piece(() => {
      const t = RP('#8a5d3b');
      rect(12, F - 36, 46, 14, t[2]); rect(12, F - 36, 46, 1, t[4]); rect(12, F - 36, 1, 14, t[3]); rect(57, F - 36, 1, 14, t[1]);
      rect(14, F - 34, 42, 6, I('#2c2623'));
      for (const vx of [16, 27]) { rect(vx, F - 33, 9, 4, I('#f2b84b')); line(vx + 2, F - 29, vx + 6, F - 32, I('#3a2a1a')); }
      ellipse(42, F - 31, 1.5, 1.5, I('#c9c9c9')); ellipse(48, F - 31, 1.5, 1.5, I('#c9c9c9'));
      for (let k = 0; k < 13; k++) rect(14 + k * 3, F - 27, 2, 4, I(['#c4362c', '#e9dcb7', '#2f6fb0', '#1b1b1b', '#e09a2a', '#5f8f5a', '#7b5ea7'][k % 7]));
      rect(14, F - 42, 26, 6, I('#9fb9c4')); rect(14, F - 42, 26, 1, I('#d8eef5')); ellipse(27, F - 38, 9, 1.6, I('#1b1b1b'));
    }));
    if (anyEvil) { piece(() => { const r = box(66, F - 26, 34, 3, '#1d1916', { d: 2 }); rect(67, F - 23, 2, 23, r[1]); rect(97, F - 23, 2, 23, r[1]); rect(66, F - 8, 34, 2, r[2]); }); shadowUnder(66, 34); }
    else if (shadow) bust(83, F, 1.05);
    // bureau de direction
    chair(166, F - 70, F - 30, '#2f2b29', { w: 24 });
    piece(() => {
      const r = box(106, F - 30, 120, 4, '#2c2623', { d: 4 });
      rect(106, F - 34, 120, 1, I('#5a4f49'));
      box(110, F - 26, 112, 22, '#3b3330', { d: 0 });
      rect(112, F - 6, 3, 6, r[1]); rect(217, F - 6, 3, 6, r[1]);
    });
    sign(156, F - 24, 20, '#c9a24a');
    shadowUnder(106, 120);
    monitor(116, F - 34, 32, 22, '#1f2a33', '#173a44', (x, y, w, h) => { chart(x + 1, y + 1, w - 2, h - 2, '#c4f1b0', 2); if (shadow) redRoutes(x, y, w, h); });
    shipModel(156, F - 34, 46);
    if (shadow) whisky(204, F - 34); else phone(208, F - 34, '#2a2a2a');
    // vitrine basse des records
    piece(() => {
      const r = box(236, F - 26, 76, 26, '#3b3330', { d: 3 });
      rect(239, F - 23, 70, 20, I('#2a2420'));
      dith(239, F - 23, 70, 20, I('#3a4248'), I('#4a5258'), (i, j) => ((i + j) % 19 < 3 ? 1 : 0.1));
      rect(239, F - 3, 70, 1, I('#cfe1e8'));
      for (const x of [262, 286]) rect(x, F - 23, 1, 20, r[1]);
    });
    shadowUnder(236, 76);
    if (shadow) leopard(90, 250);
  } else {
    // ---- La tour de verre : murs de verre au crépuscule, bureau blanc, trois écrans, longue-vue.
    const mood = shadow ? 'night' : 'dusk';
    const top = F > 150 ? 8 : 0;
    view(L, top, R - L, F - 6 - top, mood, { city: 2, high: true, ship: true });
    if (top) { const c = RP('#141a24'); rect(L, 0, R - L, top, c[2]); rect(L, top - 1, R - L, 1, c[1]); for (let x = L + 12; x < R; x += 24) { rect(x, top - 2, 6, 1, I('#e8f0ff')); glow(x + 3, top, 7, '#cfe0ff', 0.18); } }
    // emblème gravé sur le verre
    const m = logoMask(logo, 44);
    if (m) { const mh = m.length, mw = m[0].length, x0 = 160 - Math.round(mw / 2), y0 = Math.max(top + 4, F - 150); for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (m[y][x] && (x + y) % 2 === 0) set(x0 + x, y0 + y, mixI(get(x0 + x, y0 + y), I('#ffffff'), 0.32)); }
    const mull = RP('#0f141c');
    for (let x = L - ((L % 64) + 64) % 64; x < R; x += 64) { rect(x, top, 3, F - top, mull[2]); rect(x, top, 1, F - top, mull[3]); }
    rect(L, F - 34, R - L, 2, I('#4a535e')); rect(L, F - 32, R - L, 1, I('#9fb3c4')); // garde-corps de verre
    tint(L, F - 32, R - L, 26, '#9fc3d6', 0.12);
    rect(L, F - 6, R - L, 6, I(shadow ? '#141117' : '#20262e')); rect(L, F - 6, R - L, 1, I(shadow ? '#c9a24a' : '#4a535e'));
    if (shadow) { curtains(L + 6, top + 2, R - L - 12, F - top - 8); chandelier(96, top, 1.1); chandelier(224, top, 1.1); }
    // fauteuil lounge (ou meuble laqué des méfaits)
    if (anyEvil) { piece(() => { const r = box(12, F - 22, 46, 22, '#0d0d10', { d: 3 }); rect(14, F - 7, 42, 1, r[3]); }); shadowUnder(12, 46); }
    else if (shadow) bust(35, F, 1.2);
    else piece(() => { const c = RP('#c86a3a'); ellipse(34, F - 14, 16, 9, c[2], (x, y) => (y < F - 18 ? c[3] : x > 42 ? c[1] : c[2])); rect(22, F - 6, 2, 6, I('#c9c9c9')); rect(45, F - 6, 2, 6, I('#c9c9c9')); });
    // bureau blanc courbe
    chair(160, F - 50, F - 30, '#2a2f36', { w: 20 });
    piece(() => {
      const r = RP('#e8e3da');
      for (let i = 0; i < 124; i++) { const c = Math.round(Math.sin((i / 123) * Math.PI) * 3); rect(98 + i, F - 33 - c, 1, 4 + c, i < 3 ? r[3] : r[2]); set(98 + i, F - 33 - c, r[4]); set(98 + i, F - 30, r[1]); }
      rect(104, F - 29, 2, 29, I('#b0b0b0')); rect(214, F - 29, 2, 29, I('#8c8c8c'));
    });
    shadowUnder(98, 124, F, 3, 0.5);
    for (let k = 0; k < 3; k++) monitor(140 + k * 24, F - 35, 22, 16, '#0d1218', '#123247', (x, y, w, h) => { chart(x, y, w, h, ['#7fe0c4', '#f6c26b', '#ff8a7a'][k], k * 2); if (shadow && k === 1) redRoutes(x, y, w, h); });
    shipModel(102, F - 35, 34);
    if (shadow) whisky(210, F - 35);
    juke(() => piece(() => {
      const x = 138, c = RP('#141b24');
      rect(x, F - 16, 44, 16, c[2]); rect(x, F - 16, 44, 1, c[4]); rect(x, F - 15, 44, 1, I('#7fe0c4'));
      for (const [sx, col] of [[x + 6, '#7fe0c4'], [x + 38, '#ff8a7a']]) { ellipse(sx, F - 8, 4, 4, I('#1b2433')); ellipse(sx, F - 8, 1.6, 1.6, I(col)); }
      rect(x + 14, F - 12, 16, 8, I('#123247')); for (let k = 0; k < 7; k++) rect(x + 15 + k * 2, F - 5 - ((k * 5) % 6), 1, 1 + ((k * 5) % 6), I(k % 2 ? '#f6c26b' : '#7fe0c4'));
    }));
    // étagère de verre des records
    piece(() => {
      const ch = RP('#c9ced6');
      rect(234, F - 64, 2, 64, ch[3]); rect(280, F - 64, 2, 64, ch[1]);
      for (const sy of [-40, -14]) { rect(234, F + sy, 48, 2, I('#cfe6f0')); rect(234, F + sy + 2, 48, 1, I('#7fa6b8')); }
      rect(234, F - 64, 48, 2, I('#cfe6f0'));
    });
    // longue-vue
    piece(() => { const b = RP('#c9a24a'), t = RP('#5a5a5a'); line(300, F - 34, 292, F - 1, t[2]); line(300, F - 34, 308, F - 1, t[2]); line(300, F - 34, 300, F - 1, t[1]); for (let i = 0; i < 22; i++) { set(290 + i, F - 38 - Math.round(i * 0.45), b[2]); set(290 + i, F - 37 - Math.round(i * 0.45), b[3]); set(290 + i, F - 36 - Math.round(i * 0.45), b[1]); } rect(310, F - 49, 3, 5, b[4]); });
    if (shadow) leopard(80, 250);
  }

  // ---------- Trophées et méfaits ----------
  if (held) {
    const slots = SLOTS[tier];
    const place = (kind, ids, list) => ids.forEach((id, i) => {
      const k = (kind === 'evil' ? EVIL_IDS : RECORD_IDS).indexOf(id), sl = list[k];
      if (!sl) return;
      const s = honourSprite(kind, id, sl.h);
      if (!s) return;
      const x0 = Math.round(sl.x - s.w / 2), y0 = F + sl.b - s.h;
      tint(x0, F + sl.b, s.w, 1, DEEP, 0.35);
      piece(() => { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.px[y * s.w + x]; if (c) set(x0 + x, y0 + y, c); } });
    });
    place('record', held.record || [], slots.record);
    place('evil', held.evil || [], slots.evil);
  }

  // ---------- Sorties ----------
  const toImage = (buf, w, h) => { const img = new ImageData(w, h); new Uint32Array(img.data.buffer).set(buf); return img; };
  let jx0 = W, jy0 = H, jx1 = -1, jy1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (jukeBuf[y * W + x]) { if (x < jx0) jx0 = x; if (x > jx1) jx1 = x; if (y < jy0) jy0 = y; if (y > jy1) jy1 = y; }
  let jukeOut = null;
  if (jx1 >= 0) {
    const jw = jx1 - jx0 + 1, jh = jy1 - jy0 + 1, jb = new Uint32Array(jw * jh);
    for (let y = 0; y < jh; y++) for (let x = 0; x < jw; x++) jb[y * jw + x] = jukeBuf[(y + jy0) * W + x + jx0];
    jukeOut = { x: jx0, y: jy0, w: jw, h: jh, img: toImage(jb, jw, jh) };
  }
  const TILE = 16, fl = new Uint32Array(W * TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < W; x++) fl[y * W + x] = floorFill(x - ox, H - F + y);
  return { room: toImage(room, W, H), floor: toImage(fl, W, TILE), juke: jukeOut, F, ox };

  // Damas doré sur un mur sombre (bureaux de l'ombre).
  function damask(x, y, w, h, gold) {
    const g = mixI(I(gold), get(x + 2, y + 2) || I('#000000'), 0.55);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const u = ((xx % 16) + 16) % 16, v = ((yy % 20) + 20) % 20, cx = Math.abs(u - 8), cy = v - 10;
      if ((cx * cx) / 9 + (cy * cy) / 36 < 1 && (cx * cx) / 4 + (cy * cy) / 25 > 1) set(xx, yy, g);
      if (cx === 0 && (cy === -7 || cy === 7)) set(xx, yy, g);
    }
  }
}

// Sols : motif qui se répète tous les 16 pixels vers le bas (le reste du sol, sous la feuille).
// x : colonne du décor ; y : ligne sous la plinthe (0 = au pied du mur).
const FLOORS = {
  0: (x, y) => { // linoléum à carreaux usé
    const tx = Math.floor((x + (Math.floor(y / 8) % 2) * 8) / 16), ty = Math.floor(y / 8);
    if (y % 8 === 0 || ((x % 16) + 16) % 16 === 0) return I('#6f6656');
    const a = (tx + ty) % 2 ? '#9a8f78' : '#8a806b';
    return bay(x & 1023, y) < 0.12 * (1 + Math.sin(x * 0.13 + y)) ? I(mix(a, '#5f5646', 0.35)) : I(a);
  },
  1: (x, y) => planks(x, y, '#a07b55', 5, 72),
  2: (x, y) => planks(x, y, '#5f3f27', 4, 56),
  3: (x, y) => { // dalles de pierre claire
    const yy = y % 16, row = Math.floor(y / 8), xx = (((x + (row % 2) * 16) % 32) + 32) % 32;
    if (yy % 8 === 0 || xx === 0) return I('#9a8a6e');
    return bay(x & 1023, y) < 0.18 ? I('#c4b292') : I('#b9a585');
  },
  4: (x, y) => { // sol ciré sombre où se reflètent les vitres
    const ref = (((x % 64) + 64) % 64) < 3 ? 0.3 : 0;
    return bay(x & 1023, y) < 0.12 + ref ? I('#363c46') : I('#2a2f36');
  },
  shadow1: (x, y) => planks(x, y, '#3a2418', 5, 72),
  shadow2: (x, y) => planks(x, y, '#2a1810', 4, 56),
  shadow3: (x, y) => marble(x, y),
  shadow4: (x, y) => marble(x, y),
};
function planks(x, y, base, h, len) {
  const r = RP(base), rowi = Math.floor(y / h), off = (rowi * 37) % len, xx = (((x + off) % len) + len) % len;
  if (y % h === 0) return r[1];
  if (xx === 0) return r[1];
  const tone = (rowi * 7 + Math.floor((x + off) / len) * 3) % 5; // chaque planche a son ton
  const c = tone === 0 ? mixI(r[2], r[3], 0.5) : tone === 3 ? mixI(r[2], r[1], 0.35) : r[2];
  const grain = Math.sin((x + rowi * 31) * 0.21) * Math.sin(rowi * 1.7 + x * 0.05);
  return grain > 0.82 && bay(x & 1023, y) < 0.5 ? mixI(c, r[3], 0.6) : y % h === 1 ? mixI(c, r[3], 0.35) : c;
}
function marble(x, y) {
  const v = Math.sin(x * 0.045 + Math.sin(y * 0.4 + x * 0.01) * 2.2 + y * 0.25);
  if (Math.abs(v) < 0.035) return I('#5d5560');
  if (Math.abs(v) < 0.09) return I('#2c2630');
  return ((x >> 5) + (y >> 3)) % 2 ? I('#1d181f') : I('#1a161c');
}
