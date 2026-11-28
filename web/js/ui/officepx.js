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
  { record: [...row(4, 271, 11, -47, 15), ...row(4, 271, 11, -21, 15)], evil: [...row(3, 78, 11, -27, 14), ...row(3, 78, 11, -9, 14)] },
  { record: [...row(4, 270, 11, -47, 15), ...row(4, 270, 11, -21, 15)], evil: [...row(3, 62, 11, -27, 14), ...row(3, 62, 11, -9, 14)] },
  { record: [...row(4, 268, 12, -45, 16), ...row(4, 268, 12, -18, 16)], evil: [...row(3, 82, 11, -27, 14), ...row(3, 82, 11, -9, 14)] },
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
 * held { record: [ids], evil: [ids] }, W, H (pixels du dessin), S (pixels de l'écran par pixel du dessin).
 * Renvoie { room, floor, juke: { x, y, w, h, img }, hi: { x, y, w, h, img }, F } : room et floor (motif de sol à
 * répéter sous la pièce) sont des ImageData ; juke est le juke-box à part (il se clique et s'illumine au survol) ;
 * hi porte les trophées et les méfaits, S fois plus fins (x, y, w, h en pixels du dessin, img à S × la taille).
 */
export function paintOffice(o) {
  const { tier, shadow = false, color = '#1e3a55', logo = 'ancre', model = null, held = null } = o;
  const W = Math.max(40, Math.round(o.W)), H = Math.max(60, Math.round(o.H)), S = Math.max(1, Math.min(4, Math.round(o.S || 2)));
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
  // Fauteuil vu de face, derrière le bureau (dossier au-dessus du plateau) : haut arrondi, cuir modelé de la
  // gauche (lumière) vers la droite, capitons en bandes ou boutonnés, oreilles, clous de laiton, accoudoirs.
  const chair = (cx, top, bottom, base, { wing = false, studs = null, w = 22, tuft = null, arms = false, head = false, rails = null, gilt = null } = {}) => {
    const r = RP(base);
    piece(() => {
      const x = cx - Math.floor(w / 2), hgt = bottom - top, neck = head ? top + 9 : -1;
      if (wing) for (let y = top + 5; y < bottom - 1; y++) { const o = y < top + 8 ? 1 : 0; rect(x - 3 + o, y, 3 - o, 1, r[2]); set(x - 3 + o, y, r[3]); rect(x + w, y, 3 - o, 1, r[1]); }
      for (let y = top; y < bottom; y++) {
        const j = y - top, inset = (j === 0 ? 4 : j === 1 ? 2 : j === 2 ? 1 : 0) + (head && y < neck ? 4 : head && y === neck ? 2 : 0);
        for (let i = inset; i < w - inset; i++) {
          let c = i < inset + 2 ? r[3] : i >= w - inset - 2 ? r[1] : i < w * 0.38 ? mixI(r[2], r[3], 0.4) : r[2];
          if (j < 2 || (head && y === neck)) c = r[3];
          if (head && y === neck - 1) c = r[1];
          if (tuft === 'bands' && j > 3 && j < hgt - 2 && i > 1 && i < w - 2) { const ph = (j - 4) % 5; if (ph === 4) c = r[1]; else if (ph === 0) c = mixI(c, r[4], 0.4); }
          if (tuft === 'pads') { // coussins empilés, chacun arrondi : reflet en haut, ombre en bas
            const ph = j % 9, edge = i === inset || i === w - inset - 1;
            if (ph === 8 || (edge && (ph === 0 || ph === 7))) c = r[0];
            else if (ph === 0) c = mixI(c, r[4], 0.45); else if (ph === 1) c = mixI(c, r[3], 0.4); else if (ph === 7) c = r[1];
          }
          if (tuft === 'buttons' && j > 3 && j < hgt - 2 && i > 2 && i < w - 3) {
            const row = Math.floor((j - 4) / 5), ph = (j - 4) % 5, bx = (i - 3 - (row % 2 ? 2 : 0) + 40) % 4;
            if (ph === 2 && bx === 0) c = r[0]; else if (ph === 1 && bx === 3) c = mixI(c, r[4], 0.5); else if ((ph === 2 && (bx === 1 || bx === 3)) || (ph !== 2 && bx === 0)) c = mixI(c, r[1], 0.35);
          }
          set(x + i, y, c);
        }
      }
      for (let i = head ? 8 : 5; i < w - (head ? 8 : 5); i++) set(x + i, top + 1, r[4]);
      if (studs) { for (let y = top + 4; y < bottom - 1; y += 2) { set(x, y, I(studs)); set(x + w - 1, y, I(studs)); } for (let i = 4; i < w - 4; i += 2) set(x + i, top, I(studs)); }
      if (gilt) { // cadre de bois doré autour du dossier
        const g = RP(gilt);
        for (let y = top; y < bottom; y++) { const j = y - top, ins = j === 0 ? 4 : j === 1 ? 2 : j === 2 ? 1 : 0; set(x + ins, y, g[3]); set(x + w - 1 - ins, y, g[1]); }
        for (let i = 4; i < w - 4; i++) set(x + i, top, g[4]);
        rect(x - 3, bottom - 8, 4, 2, g[2]); rect(x + w - 1, bottom - 8, 4, 2, g[2]); set(x - 3, bottom - 9, g[4]); set(x + w + 2, bottom - 9, g[4]);
      }
      if (rails) { const m = RP(rails); rect(x - 2, top + 3, 2, hgt - 3, m[2]); rect(x - 2, top + 3, 1, hgt - 3, m[4]); rect(x + w, top + 3, 2, hgt - 3, m[1]); set(x - 2, top + 2, m[3]); set(x + w + 1, top + 2, m[1]); }
      if (arms) { const ax = rails ? 5 : 3; rect(x - ax, bottom - 8, ax + 1, 3, r[1]); rect(x + w - 1, bottom - 8, ax + 1, 3, r[1]); rect(x - ax, bottom - 8, ax + 1, 1, r[3]); rect(x + w - 1, bottom - 8, ax + 1, 1, r[3]); }
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

  // ---------- Décor des étages ----------
  // Un navire du jeu sur l'eau d'une vue (le dessin des navires, à la couleur de la compagnie), teinté par la
  // lumière : tone et k le fondent dans le couchant ou la brume ; la nuit, ses hublots s'allument.
  const seaShip = (typeId, x, wl, w, tone, k, night = false) => {
    const s = modelSprite({ typeId, color, logo, name: '' }, w);
    if (!s) return;
    const tn = I(tone), x0 = Math.round(x), y0 = Math.round(wl) - s.h;
    for (let y = 0; y < s.h; y++) for (let xx = 0; xx < s.w; xx++) {
      const c = s.px[y * s.w + xx];
      if (!c) continue;
      const lum = ((c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255)) / 765;
      set(x0 + xx, y0 + y, night && lum > 0.7 && (xx + y) % 3 === 0 ? I('#ffd27a') : mixI(c, tn, k));
    }
    if (night) set(x0 + Math.round(s.w * 0.3), y0 - 1, I('#fff2c0'));
    for (let xx = 1; xx < s.w - 1; xx++) if ((xx + x0) % 3) set(x0 + xx, Math.round(wl) + 1, mixI(get(x0 + xx, Math.round(wl) + 1), DEEP, 0.3));
  };

  // Vue de l'étage de direction : l'entrée du port au couchant, la digue et son phare, des navires au
  // mouillage ; la nuit, la lune et le faisceau du phare.
  const harbourMouth = (x0, y0, w, h, night) => {
    const save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const hz = y0 + Math.round(h * 0.55), sb = y0 + h;
    grad(x0, y0, w, hz - y0, night ? ['#060918', '#0c1532', '#17214c', '#252b5c', '#352f62'] : ['#3f5290', '#6a66a3', '#aa799e', '#df8f72', '#f4b26e', '#fbd897']);
    const sx = 282, sy = hz - 2, mx = 132, my = y0 + Math.round((hz - y0) * 0.3);
    if (night) {
      for (let k = 0; k < (w * (hz - y0)) / 90; k++) { const px = x0 + ((k * 53 + 11) % w), py = y0 + ((k * 37 + k * k * 3) % Math.max(1, hz - y0 - 8)); set(px, py, k % 6 ? mixI(I('#c9d2e8'), get(px, py), 0.45) : I('#ffffff')); }
      glow(mx, my, 16, '#9fb0d8', 0.35);
      ellipse(mx, my, 5, 5, '#f2efdc', (x, y) => (x > mx + 1 && y > my ? I('#d8d2b8') : I('#f6f2e2')));
    } else {
      glow(sx, sy, 40, '#fff0c0', 0.55);
      ellipse(sx, sy, 9, 9, '#fff2cf', (x, y) => (y > sy + 2 ? I('#ffe2a0') : I('#fff8e4')));
    }
    // longs nuages éclairés par en dessous
    for (const [cx, cy, cw] of [[118, 0.22, 46], [176, 0.4, 72], [266, 0.16, 44], [212, 0.66, 56], [300, 0.52, 40]]) {
      const X = cx - cw / 2, Y = y0 + Math.round((hz - y0) * cy), tp = night ? '#1a2246' : '#6d64a0', lt = night ? '#323a6c' : '#ffc492';
      rect(X + 5, Y, cw - 10, 1, I(tp)); rect(X, Y + 1, cw, 2, I(mix(tp, lt, 0.45))); rect(X + 7, Y + 3, cw - 16, 1, I(lt));
    }
    // côte lointaine ; à droite, le cap et son village
    const far = I(night ? '#141a32' : '#7a6080'), cape = RP(night ? '#10162a' : '#5a4664');
    for (let x = x0; x < x0 + w; x++) {
      const fh = Math.round(2 + Math.sin(x * 0.05) * 1.2);
      for (let y = hz - fh; y < hz; y++) set(x, y, far);
      if (x > 290) {
        const ch = Math.min(26, Math.round((x - 290) * 0.42 + Math.sin(x * 0.23) * 1.5));
        for (let y = hz - ch; y < hz + 1; y++) set(x, y, y === hz - ch ? cape[3] : cape[2]);
        if (x % 5 === 0 && ch > 6) { const hy = hz - Math.round(ch * 0.4) - (x % 3); rect(x, hy, 3, 2, night ? I('#ffcf6e') : cape[4]); }
      }
    }
    // la mer
    grad(x0, hz, w, sb - hz, night ? ['#252c55', '#1a2242', '#121a33', '#0d1328'] : ['#f2b47e', '#b48c98', '#76789a', '#506488', '#405478']);
    rect(x0, hz, w, 1, I(night ? '#3a3a6c' : '#ffe2aa'));
    const gx0 = night ? mx : sx;
    for (let y = hz + 1; y < sb; y += 2) { const ww = 3 + Math.round((y - hz) * 0.3) + ((y * 7) % 4); rect(gx0 - Math.round(ww / 2) + ((y * 13) % 5) - 2, y, Math.round(ww * 0.7), 1, I(night ? '#aeb6d2' : '#ffe6a8')); }
    for (let k = 0; k < w / 4; k++) { const gx = x0 + ((k * 41) % w), gy = hz + 3 + ((k * 17) % Math.max(1, sb - hz - 4)); rect(gx, gy, 2 + (k % 4), 1, I(night ? '#2e3664' : '#9aa6c4')); }
    // navires au mouillage sur l'horizon, puis un des nôtres qui prend la mer
    const haze = night ? '#151b38' : '#8a7a98';
    seaShip('petrolier_aframax', 176, hz + 1, 34, haze, night ? 0.75 : 0.55, night);
    seaShip('vraquier_supramax', 236, hz + 1, 28, haze, night ? 0.75 : 0.6, night);
    const shipX = 176, shipWl = hz + Math.max(8, Math.round((sb - hz) * 0.32));
    for (let k = 0; k < 14; k++) { set(shipX - 2 - k * 2, shipWl + Math.round(k * 0.35), I(night ? '#6a74a0' : '#f4e6d0')); set(shipX - 2 - k * 2, shipWl - 1 - Math.round(k * 0.1), I(night ? '#4a5484' : '#e0cfc0')); }
    seaShip('feeder', shipX, shipWl, 52, night ? '#0d1428' : '#4a3050', night ? 0.72 : 0.38, night);
    // la digue, puis le phare au bout
    const bx0 = 96, by0 = hz + Math.round((sb - hz) * 0.8), bx1 = 158, by1 = hz + 5, st = RP(night ? '#2a2c44' : '#82707a');
    for (let x = bx0; x <= bx1; x++) {
      const t = (x - bx0) / (bx1 - bx0), y = Math.round(by0 + (by1 - by0) * t), th = Math.round(8 - 5 * t);
      rect(x, y, 1, th, st[2]); set(x, y, st[4]); set(x, y + 1, st[3]); set(x, y + th, st[0]);
      if ((x * 7) % 5 === 0) set(x, y + 2 + (x % 3), st[1]);
      if ((x * 3) % 7 === 0) set(x, y + th + 1, I(night ? '#3a4270' : '#f2dcc8')); // écume
    }
    const lx = bx1 - 3, ly = by1;
    for (let j = 0; j < 24; j++) {
      const ww = 6 - Math.floor(j / 9), c = Math.floor(j / 5) % 2 ? '#c4362c' : '#f2ede2', r = RP(night ? mix(c, '#141a36', 0.6) : c);
      rect(lx - Math.floor(ww / 2), ly - j, ww, 1, r[2]); set(lx - Math.floor(ww / 2), ly - j, r[1]); set(lx + Math.ceil(ww / 2) - 1, ly - j, night ? r[2] : r[3]);
    }
    rect(lx - 4, ly - 25, 8, 1, I('#2a2a30')); rect(lx - 2, ly - 29, 4, 4, I(night ? '#fff0b0' : '#efe2b8')); set(lx - 2, ly - 29, I('#2a2a30')); set(lx + 1, ly - 29, I('#2a2a30'));
    poly([[lx - 3, ly - 29], [lx + 3, ly - 29], [lx, ly - 33]], I(night ? '#5a1a1a' : '#a8302a'));
    if (night) {
      glow(lx, ly - 27, 12, '#fff0b0', 0.5);
      tint(lx + 2, ly - 40, 150, 26, '#fff0b0', (i, j) => { const yc = 13 + i * 0.06, sp = 1.5 + i * 0.07; return Math.abs(j - yc) < sp ? 0.32 * (1 - i / 150) : 0; });
    }
    clip = save;
  };

  // Vue de la tour : au-dessus de la mer de nuages, deux gratte-ciel qui la percent, la terre tout en bas
  // par les trouées ; la nuit, la ville rougeoie sous les nuages.
  const aboveClouds = (x0, y0, w, h, night) => {
    const save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const hz = y0 + Math.round(h * 0.42), sb = y0 + h, sky = hz - y0;
    grad(x0, y0, w, sky + 2, night ? ['#02040e', '#050b22', '#0b1638', '#15234e', '#26325f'] : ['#1d58a8', '#2c6cbc', '#4c8ad0', '#7eb0e0', '#b7d7ef', '#e2f0f8']);
    if (night) {
      for (let k = 0; k < (w * sky) / 55; k++) { const px = x0 + ((k * 61 + 5) % w), py = y0 + ((k * 29 + k * k * 5) % Math.max(1, sky - 6)); set(px, py, k % 7 ? mixI(I('#c9d2e8'), get(px, py), 0.3 + (k % 3) * 0.2) : I('#ffffff')); }
      const mx = 150, my = y0 + Math.round(sky * 0.28);
      glow(mx, my, 18, '#a8b8e0', 0.35); ellipse(mx, my, 6, 6, '#f4f1e2', (x, y) => ((x - mx) * 0.7 + (y - my) > 2 ? I('#cfc9b0') : I('#f8f5e8')));
    } else {
      const sx = 226, sy = y0 + Math.round(sky * 0.3);
      glow(sx, sy, 36, '#fffbe0', 0.6); ellipse(sx, sy, 6, 6, '#fffef4');
      for (let k = 0; k < 64; k++) set(118 + k, y0 + 10 + Math.round(k * 0.22), mixI(get(118 + k, y0 + 10 + Math.round(k * 0.22)), I('#ffffff'), Math.min(0.85, k / 64 + 0.1))); // traînée d'avion
      set(182, y0 + 24, I('#ffffff')); set(183, y0 + 24, I('#d8e4f0'));
    }
    // la terre, tout en bas : la côte quadrillée de rues, la mer, des navires minuscules
    const haze = I(night ? '#3a2440' : '#a9c4e0');
    for (let y = hz + 2; y < sb; y++) for (let x = x0; x < x0 + w; x++) {
      const coast = 150 + Math.sin(y * 0.15) * 8 + Math.sin(x * 0.02) * 10, hk = 0.55 - Math.min(0.25, (y - hz) / 300);
      let c;
      if (x < coast) {
        const lit = ((x * 13 + y * 7) % 11) === 0 || ((x * 5 + y * 3) % 17) === 0;
        c = night ? (lit ? I((x + y) % 3 ? '#ff9a4a' : '#ffd27a') : I('#2e1c2c')) : bay(x & 1023, y) < 0.3 ? I('#a8a490') : I('#94a088');
      } else c = night ? I('#0c1020') : bay(x & 1023, y) < 0.15 ? I('#7a9ec4') : I('#5f88b2');
      set(x, y, night && x < coast ? mixI(c, haze, 0.2) : mixI(c, haze, hk));
    }
    // le port, tout en bas : quai, piles de conteneurs, portiques, navires à quai et un qui appareille
    const fog = (c, k2 = 0.35) => mixI(I(c), haze, k2), qy = hz + 15;
    rect(120, qy, 120, 3, fog(night ? '#3a3040' : '#d8d4c8')); rect(120, qy + 3, 120, 1, fog(night ? '#1a1420' : '#8a9aa8'));
    for (let x = 120; x < 240; x++) { if (x % 3) set(x, qy, fog(night ? ((x * 7) % 5 ? '#ffc870' : '#ff8a5a') : ['#c4362c', '#2f6fb0', '#e09a2a', '#2e8b57', '#8f98a5'][(x * 7) % 5])); }
    for (let x = 126; x < 240; x += 17) { rect(x, qy - 4, 1, 4, fog(night ? '#6a3a3a' : '#c9572f')); rect(x - 1, qy - 4, 4, 1, fog(night ? '#6a3a3a' : '#c9572f')); }
    for (const [x, l] of [[150, 14], [176, 18], [204, 12]]) { rect(x, qy + 4, l, 2, fog(night ? '#141018' : '#3a3532')); for (let i = 2; i < l - 3; i += 2) set(x + i, qy + 4, fog(night ? '#ffd27a' : ['#c4362c', '#2f6fb0', '#e09a2a'][i % 3])); }
    rect(196, qy + 12, 10, 2, fog(night ? '#141018' : '#3a3532')); set(200, qy + 11, fog(night ? '#ffd27a' : '#f2ede2'));
    for (let k = 1; k < 9; k++) { set(196 - k, qy + 12 - Math.ceil(k / 3), fog(night ? '#3a4470' : '#eef6fa')); set(196 - k, qy + 13 + Math.ceil(k / 3), fog(night ? '#3a4470' : '#eef6fa')); }
    // les nuages : quatre couches de plus en plus proches, avec des trouées
    const cols = night ? [['#2a3560', '#36426e', '#4a5a8a', '#7a8cb8'], ['#232c52', '#2e3a66', '#45558a', '#8a9ccc'], ['#1e2648', '#2a355e', '#46568c', '#9aaee0'], ['#1a2140', '#283258', '#46578e', '#aac0f0']]
      : [['#b4c4de', '#c4d2e8', '#d6e2f2', '#eef4fa'], ['#a6b8d8', '#bccbe4', '#dbe5f3', '#fbfdff'], ['#98acd2', '#b4c6e2', '#e0e9f5', '#ffffff'], ['#8ea4cc', '#aec0e0', '#e4ecf6', '#ffffff']];
    const layer = (k, yb, r, band, holes, gap = null) => {
      const [deep, sh, body, top] = cols[k].map(I);
      for (let x = x0 - r; x < x0 + w + r; x += Math.max(2, Math.round(r * 0.9))) {
        const n = Math.sin(x * 0.11 + k * 3.1) * 0.5 + Math.sin(x * 0.037 + k) * 0.5;
        // la trouée sur le port : les nuages s'amincissent vers son milieu au lieu de s'arrêter net
        const g = gap ? Math.min(1, Math.abs(x - (gap[0] + gap[1]) / 2) / ((gap[1] - gap[0]) / 2)) : 1;
        if (g < 0.35) continue;
        if (holes && Math.sin(x * 0.045 + k * 2.3) > 0.86) continue; // trouées
        const gk = g < 1 ? 0.35 + (g - 0.35) * 0.8 : 1, rr = r * (0.75 + 0.35 * n) * gk, cy = yb - rr * 0.35 + (1 - gk) * r * 1.2;
        ellipse(x, cy, rr * 1.25, rr, body, (px, py) => (py < cy - rr * 0.55 ? top : py > cy + rr * 0.3 ? sh : body));
        for (let y = Math.round(cy + rr * 0.6); y < yb + band * gk; y++) for (let i = -Math.round(r * 0.6); i <= Math.round(r * 0.6); i++) {
          const jj = y - yb;
          set(x + i, y, jj > band * 0.6 && bay((x + i) & 1023, y) < 0.5 ? deep : sh);
        }
      }
    };
    layer(0, hz + 2, 2, 7, false);
    // gratte-ciel lointain, puis les deux qui percent les nuages
    const tower = (cx, tw, topY, hzK, crown) => {
      const tone = night ? '#1a2236' : '#6e8eb4', hz2 = night ? '#26325f' : '#b7d7ef', r = RP(mix(tone, hz2, hzK));
      for (let y = topY; y < sb; y++) {
        const set2 = y < topY + 10 ? Math.round(tw * 0.3) : y < topY + 26 ? Math.round(tw * 0.15) : 0, x1 = cx - Math.floor(tw / 2) + set2, x2 = cx + Math.ceil(tw / 2) - set2;
        for (let x = x1; x < x2; x++) {
          const lit = x >= cx + 1, win = night ? (((x * 5 + y * 3) % 7) === 0 && y % 2 === 0 ? I('#ffd27a') : r[1]) : x % 3 === 0 ? r[lit ? 3 : 1] : r[lit ? 4 : 2];
          set(x, y, win);
        }
      }
      if (crown) poly([[cx - Math.floor(tw * 0.2), topY], [cx + Math.ceil(tw * 0.2), topY], [cx, topY - 12]], r[3]);
      else { rect(cx, topY - 12, 1, 12, r[1]); set(cx, topY - 13, I('#ff4a3a')); }
      if (night) set(cx, topY - (crown ? 13 : 14), I('#ff4a3a'));
    };
    tower(304, 8, hz - 12, 0.65, false);
    layer(1, hz + 9, 5, 14, false, [156, 210]);
    tower(218, 12, y0 + Math.round(sky * 0.36), 0.15, false);
    tower(124, 16, y0 + Math.round(sky * 0.58), 0.25, true);
    layer(2, hz + 24, 9, 24, false, [140, 226]);
    layer(3, hz + 50, 14, sb - hz, true);
    if (!night) { const hx = 196, hy = hz - 20; rect(hx, hy, 5, 2, I('#2a3038')); rect(hx + 5, hy, 4, 1, I('#2a3038')); rect(hx - 2, hy - 2, 10, 1, I('#4a5260')); set(hx + 1, hy + 2, I('#2a3038')); set(hx + 4, hy + 2, I('#2a3038')); }
    else { set(196, hz - 20, I('#ff4a3a')); set(200, hz - 20, I('#7fe08a')); }
    clip = save;
  };

  // Demi-coque de chantier sur sa plaque de noyer (bois lamellé clair et foncé).
  const halfHull = (x, y, w) => {
    piece(() => { const p = RP('#4a2a16'); rect(x, y, w, 24, p[2]); rect(x, y, w, 1, p[4]); rect(x, y, 1, 24, p[3]); rect(x + w - 1, y, 1, 24, p[1]); rect(x, y + 23, w, 1, p[1]); for (const [cx, cy] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + 21], [x + w - 3, y + 21]]) set(cx, cy, I('#d9b46a')); });
    piece(() => {
      const a = RP('#d2a66a'), b = RP('#8a5a34'), l = w - 12;
      for (let i = 0; i < l; i++) {
        const t = i / (l - 1), deck = y + 6 + Math.round(Math.pow(t - 0.45, 2) * 6), keel = y + 6 + Math.round(Math.sin(Math.min(1, t * 1.05) * Math.PI) * 9 * (t > 0.85 ? (1 - t) / 0.15 : 1));
        for (let yy = deck; yy <= keel; yy++) set(x + 6 + i, yy, ((yy - y) >> 1) % 2 ? b[2] : a[2]);
        set(x + 6 + i, deck, a[4]);
      }
    });
    piece(() => { const g = RP('#c9a24a'); rect(x + w / 2 - 8, y + 19, 16, 3, g[2]); rect(x + w / 2 - 8, y + 19, 16, 1, g[4]); });
  };
  // Horloge de laiton (les trois places : Londres, New York, Singapour).
  const worldClock = (cx, cy, k) => {
    piece(() => {
      const b = RP('#c9a24a');
      ellipse(cx, cy, 7, 7, b[2], (x, y) => (x + y < cx + cy - 3 ? b[4] : x + y > cx + cy + 4 ? b[1] : b[2]));
      ellipse(cx, cy, 5, 5, I('#f6f1e2'));
      for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) set(cx + dx, cy + dy, I('#5a4a3a'));
      const hA = [-0.6, 2.4, 1.4][k] * Math.PI / 2, mA = [0.2, -1.2, 2.6][k] * Math.PI / 2;
      line(cx, cy, cx + Math.round(Math.sin(hA) * 2.4), cy - Math.round(Math.cos(hA) * 2.4), I('#1c1c1c'));
      line(cx, cy, cx + Math.round(Math.sin(mA) * 3.6), cy - Math.round(Math.cos(mA) * 3.6), I('#1c1c1c'));
      set(cx, cy, I('#c4362c'));
      rect(cx - 4, cy + 9, 9, 2, b[3]);
    });
  };
  const sconce = (x, y) => {
    glow(x + 3, y - 4, 16, '#ffe9b0', 0.3);
    piece(() => { const b = RP('#c9a24a'), s = RP('#f2e6c8'); rect(x + 2, y, 3, 6, b[2]); rect(x + 3, y - 2, 1, 2, b[3]); rect(x, y - 8, 7, 6, s[2]); rect(x, y - 8, 7, 1, s[4]); rect(x + 6, y - 8, 1, 6, s[1]); });
  };
  // Radiogramme de noyer : haut-parleur tissé, cadran éclairé, platine sous le couvercle relevé.
  const radiogram = (x, base) => {
    piece(() => {
      const wd = RP('#6a4228'), cl = RP('#c8a978'), g = RP('#c9a24a');
      for (const lx of [x + 4, x + 54]) { line(lx, base - 6, lx - 2, base - 1, wd[1]); line(lx + 1, base - 6, lx - 1, base - 1, wd[2]); set(lx - 2, base, g[2]); }
      rect(x, base - 30, 62, 24, wd[2]); rect(x, base - 31, 62, 1, wd[4]); rect(x, base - 30, 1, 24, wd[3]); rect(x + 61, base - 30, 1, 24, wd[1]); rect(x, base - 7, 62, 1, wd[0]);
      rect(x + 3, base - 27, 36, 18, cl[2]);
      for (let yy = 0; yy < 18; yy++) for (let xx = 0; xx < 36; xx++) if ((xx + yy) % 2 === 0 && (xx * 3 + yy) % 5 < 2) set(x + 3 + xx, base - 27 + yy, cl[1]);
      rect(x + 3, base - 27, 36, 1, g[3]); rect(x + 3, base - 10, 36, 1, g[1]); rect(x + 20, base - 27, 2, 18, wd[2]);
      rect(x + 43, base - 27, 15, 7, I('#f2dfa8')); rect(x + 43, base - 27, 15, 1, I('#fff4cc'));
      for (let k = 0; k < 6; k++) set(x + 45 + k * 2, base - 24, I('#8a6a3a'));
      rect(x + 50, base - 26, 1, 5, I('#c4362c'));
      for (const kx of [x + 46, x + 54]) { ellipse(kx, base - 15, 2.4, 2.4, wd[1]); set(kx, base - 16, g[4]); }
    });
    piece(() => { const wd = RP('#6a4228'); rect(x + 30, base - 33, 32, 2, I('#2a2420')); ellipse(x + 44, base - 33, 9, 1.4, I('#151515')); set(x + 44, base - 33, I('#c4362c')); poly([[x + 28, base - 34], [x + 62, base - 34], [x + 62, base - 46], [x + 30, base - 36]], wd[3]); rect(x + 61, base - 46, 1, 12, wd[1]); });
  };
  const globe = (cx, base) => {
    piece(() => { const wd = RP('#5a3620'); line(cx, base - 12, cx - 7, base - 1, wd[2]); line(cx, base - 12, cx + 7, base - 1, wd[1]); rect(cx - 1, base - 14, 3, 13, wd[2]); rect(cx - 8, base - 1, 17, 1, wd[1]); });
    piece(() => {
      const sea = RP('#8a7a4a'), land = '#d8c08a', b = RP('#c9a24a'), cy = base - 24;
      ellipse(cx, cy, 9, 9, sea[2], (x, y) => ((Math.sin(x * 0.9) + Math.cos(y * 0.7 + x * 0.3)) > 0.9 ? I(land) : x + y < cx + cy - 5 ? sea[3] : x + y > cx + cy + 6 ? sea[1] : sea[2]));
      for (let a = -1.9; a <= 1.9; a += 0.08) set(cx + Math.round(Math.cos(a) * 11) - 0, cy + Math.round(Math.sin(a) * 11), b[a < 0 ? 3 : 2]);
      set(cx, cy - 11, b[4]);
    });
  };
  // Longue-vue de laiton sur trépied de bois.
  const telescope = (cx, base) => {
    piece(() => { const wd = RP('#5a3620'), b = RP('#c9a24a'); line(cx, base - 30, cx - 9, base - 1, wd[2]); line(cx, base - 30, cx + 9, base - 1, wd[1]); line(cx, base - 30, cx + 1, base - 1, wd[3]); rect(cx - 1, base - 32, 3, 3, b[1]); });
    piece(() => {
      const b = RP('#c9a24a');
      for (let i = 0; i < 26; i++) { const x = cx + 8 - i, y = base - 32 - Math.round(i * 0.42), th = i < 8 ? 2 : i < 18 ? 3 : 4; for (let j = 0; j < th; j++) set(x, y + j, j === 0 ? b[4] : j === th - 1 ? b[1] : b[2]); }
      rect(cx - 19, base - 44, 2, 5, b[3]); rect(cx + 8, base - 33, 2, 3, I('#2a2420'));
    });
  };
  // Piano à queue noir laqué, couvercle relevé sur la harpe dorée.
  const grandPiano = (x, base) => {
    const lq = RP('#1c1c24'), gd = RP('#c9a24a');
    piece(() => {
      for (const lx of [x + 8, x + 58]) { rect(lx, base - 21, 4, 18, lq[2]); rect(lx, base - 21, 1, 18, lq[3]); rect(lx + 1, base - 3, 2, 3, gd[2]); }
      rect(x + 24, base - 21, 1, 15, lq[2]); rect(x + 28, base - 21, 1, 15, lq[2]); rect(x + 23, base - 6, 7, 2, lq[2]);
      rect(x + 23, base - 3, 2, 1, gd[3]); rect(x + 28, base - 3, 2, 1, gd[3]);
    });
    piece(() => {
      rect(x + 4, base - 31, 64, 10, lq[2]); rect(x + 68, base - 30, 2, 8, lq[2]); rect(x + 70, base - 28, 1, 5, lq[2]);
      rect(x + 4, base - 31, 64, 1, lq[4]);
      for (let i = 0; i < 64; i++) if ((i % 11) < 6) set(x + 4 + i, base - 29, lq[3]);
      rect(x + 4, base - 22, 66, 1, lq[1]);
      rect(x, base - 28, 6, 5, lq[2]); rect(x, base - 28, 6, 1, I('#f6f3ea')); for (let k = 0; k < 3; k++) set(x + 1 + k * 2, base - 29, I('#101014'));
      rect(x + 30, base - 26, 12, 1, gd[2]); // la marque, en lettres d'or
    });
    piece(() => {
      for (let i = 0; i <= 52; i++) {
        const xx = x + 14 + i, yTop = base - 32 - Math.round(i * 0.4);
        for (let y = yTop + 2; y < base - 31; y++) set(xx, y, (xx + y) % 4 === 0 ? gd[1] : y < yTop + 4 ? gd[3] : gd[2]);
        set(xx, yTop, lq[3]); set(xx, yTop + 1, lq[1]);
      }
      line(x + 58, base - 32, x + 60, base - 54, lq[1]);
      rect(x + 9, base - 39, 9, 7, lq[1]); rect(x + 10, base - 38, 7, 5, I('#f2eee2')); rect(x + 11, base - 37, 5, 1, I('#8a8478')); rect(x + 11, base - 35, 5, 1, I('#8a8478'));
    });
  };
  // Figuier lyre dans un haut cache-pot noir : de grandes feuilles, chacune cernée.
  const ficus = (cx, base) => {
    piece(() => { const p = RP('#2c2c30'); rect(cx - 7, base - 18, 14, 18, p[2]); rect(cx - 7, base - 18, 2, 18, p[3]); rect(cx + 5, base - 18, 2, 18, p[1]); rect(cx - 8, base - 20, 16, 2, p[3]); rect(cx - 8, base - 20, 16, 1, p[4]); });
    piece(() => { const t = RP('#6a5040'); for (let y = 0; y < 36; y++) { const x = cx + Math.round(Math.sin(y * 0.16) * 1.2); set(x, base - 20 - y, t[2]); if (y < 20) set(x + 1, base - 20 - y, t[1]); } });
    const g = RP('#3f7a3a');
    for (const [dx, dy] of [[0, -63], [-6, -58], [6, -57], [-10, -50], [10, -49], [-3, -51], [4, -45], [-8, -42], [8, -39], [-2, -38], [11, -33], [-11, -35], [3, -31], [-5, -29]]) {
      const x = cx + dx, y = base + dy;
      piece(() => {
        ellipse(x, y, 3.6, 2.6, g[2], (px, py) => (py < y - 0.6 ? (px < x ? g[4] : g[3]) : px > x + 1.2 ? g[1] : g[2]));
        set(x - 2, y + 1, g[1]); set(x - 1, y, g[1]); set(x, y, g[1]);
      });
    }
  };
  // Grandes plaques de marbre ouvertes en livre (blanc veiné de gris ; noir veiné d'or chez l'armateur de l'ombre).
  // Coordonnées du décor : le veinage ne bouge pas quand le panneau change de largeur.
  // Veinage : de longues veines ondulées en biais (la pente l'emporte sur le bruit, donc jamais de boucles fermées),
  // qui s'estompent par endroits ; v petit = sur une veine, f = force de la veine, n = nuage.
  const veinAt = (X, Y) => {
    const ph = (X * 0.75 + Y) * 0.045 + 1.1 * Math.sin(X * 0.027 - Y * 0.033) + 0.55 * Math.sin(X * 0.067 + Y * 0.051 + 1.1) + 0.25 * Math.sin(X * 0.15 - Y * 0.12);
    const ph2 = (X - Y * 0.6) * 0.07 + 1.3 * Math.sin(X * 0.041 + Y * 0.029 + 2) + 0.4 * Math.sin(Y * 0.13);
    return { v: Math.abs(Math.sin(ph)), v2: Math.abs(Math.sin(ph2)), f: Math.sin(X * 0.019 + Y * 0.013 + 0.7), n: Math.sin(X * 0.031 + Y * 0.017) + 0.5 * Math.sin(X * 0.071 - Y * 0.043 + 1.7) };
  };
  const marbleWall = (x0, y0, w, h, dark = false) => {
    const b0 = I(dark ? '#1b191d' : '#e2e0db'), cl = I(dark ? '#221f24' : '#eae9e5'), vein = I(dark ? '#b8923e' : '#a6a39d'), soft = I(dark ? '#4a3c22' : '#cfccc6'), joint = I(dark ? '#0b0a0c' : '#c6c3bd');
    const mid = y0 + Math.round(h * 0.55);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const k = ((x % 80) + 80) % 80, slab = Math.floor((x + 800) / 80);
      if (k === 0 || y === mid) { set(x, y, joint); continue; }
      const { v, v2, f, n } = veinAt((slab % 2 ? 80 - k : k) + (slab >> 1) * 37, y < mid ? y : y + 23);
      set(x, y, f > -0.25 && v < 0.03 ? vein : (f > -0.5 && v < 0.07) || v2 < 0.02 ? soft : n > 0.9 ? cl : b0);
    }
    // les spots du plafond dessinent des festons de lumière sur le marbre
    for (let sx = x0 - ((x0 % 40) + 40) % 40 + 20; sx < x0 + w; sx += 40) tint(sx - 16, y0, 32, 56, dark ? '#ffd877' : '#ffffff', (i, j) => { const d = Math.abs(i - 16) / (3 + j * 0.3); return d < 1 ? (dark ? 0.2 : 0.45) * (1 - d * d) * (1 - j / 56) : 0; });
  };
  // Monolithe de marbre noir veiné de blanc (d'or chez l'armateur de l'ombre), dessus poli.
  const neroBlock = (x, y, w, h, gold = false) => piece(() => {
    const vein = I(gold ? '#d9b46a' : '#cfcdc8'), vein2 = I(gold ? '#6a4e24' : '#4c4c54');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j, { v, v2, f } = veinAt(X * 1.4, Y * 1.4);
      let c = i < 2 ? I('#34343c') : i > w - 3 ? I('#0e0e11') : I('#1c1c21');
      if (f > 0 && v < 0.035) c = vein; else if (v < 0.08 || v2 < 0.025) c = vein2;
      set(X, Y, c);
    }
    for (let i = 0; i < w; i++) { set(x + i, y - 3, I('#7c7c88')); set(x + i, y - 2, I(Math.sin(i * 0.2) > 0.6 ? '#5a5a64' : '#3a3a42')); set(x + i, y - 1, I('#2a2a30')); }
    for (let k = 0; k < 14; k++) { set(x + 8 + k, y + 3 + k, mixI(get(x + 8 + k, y + 3 + k), I('#ffffff'), 0.12)); set(x + 14 + k, y + 3 + k, mixI(get(x + 14 + k, y + 3 + k), I('#ffffff'), 0.08)); } // reflet poli
  });
  // Lustre de points de lumière en goutte renversée, suspendu à un câble.
  const lightCluster = (cx, top, ry) => {
    const rx = ry * 0.55, cy = top + 6 + ry;
    rect(cx, top, 1, cy - ry - top, I('#4a4a52'));
    glow(cx, cy, Math.round(ry * 1.5), '#fff4d0', 0.4);
    tint(cx - rx * 1.3, cy - ry, rx * 2.6, ry * 2, '#fff8e4', (i, j) => { const t = (j - ry) / ry, wd = Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.3 * t) * rx; return Math.abs(i - rx * 1.3) < wd ? 0.3 : 0; });
    for (let k = 0; k < ry * rx * 1.1; k++) {
      const t = ((k * 0.618034) % 1) * 2 - 1, a = ((k * 0.754877) % 1) * 2 - 1, wd = Math.sqrt(1 - t * t) * (1 - 0.3 * t) * rx;
      set(cx + Math.round(a * wd), cy + Math.round(t * ry), k % 5 ? I('#fffcee') : I('#ffe39a'));
    }
  };
  const chromeLamp = (x, base) => {
    glow(x + 5, base - 16, 14, '#fff1c8', 0.25);
    piece(() => { const m = RP('#c4ccd4'); rect(x - 3, base - 1, 7, 1, I('#1c1c21')); rect(x, base - 14, 1, 13, m[3]); line(x, base - 14, x + 4, base - 17, m[3]); });
    piece(() => { const s2 = RP('#f6f2e8'); rect(x + 2, base - 18, 7, 2, s2[2]); rect(x + 2, base - 18, 7, 1, s2[4]); rect(x + 3, base - 16, 5, 1, I('#fff8dc')); });
  };
  // Vue de l'étage de direction : à mi-hauteur d'une tour, les gratte-ciel autour, la mer plus loin, un cap vert.
  // La nuit : fenêtres allumées, lune sur la mer.
  const hsh = (k) => { const v = Math.sin(k * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  const cityView = (x0, y0, w, h, night) => {
    const save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const hz = y0 + Math.round(h * 0.42), sb = y0 + h, sky = hz - y0;
    grad(x0, y0, w, sky, night ? ['#040816', '#0a1430', '#142050', '#1e2c60'] : ['#2f74c4', '#4a8ad2', '#6ea4de', '#98c0e8', '#c8def2']);
    if (night) {
      for (let k = 0; k < (w * sky) / 70; k++) { const px = x0 + ((k * 47 + 3) % w), py = y0 + ((k * 31 + k * k * 7) % Math.max(1, sky - 4)); set(px, py, k % 6 ? mixI(I('#c9d2e8'), get(px, py), 0.4) : I('#ffffff')); }
      glow(290, y0 + Math.round(sky * 0.3), 14, '#a8b8e0', 0.35); ellipse(290, y0 + Math.round(sky * 0.3), 4, 4, '#f4f1e2');
    } else for (const [cx, cy, s] of [[132, 0.42, 1], [222, 0.26, 0.8], [292, 0.55, 0.9]]) { // cumulus
      const X = cx, Y = y0 + Math.round(sky * cy), c = RP('#e8eef6');
      for (const [dx, dy, r] of [[-9, 2, 6], [-3, -2, 7], [5, -1, 6], [11, 2, 5], [0, 3, 8]]) ellipse(X + dx * s, Y + dy * s, r * s * 1.2, r * s * 0.8, c[2], (px, py) => (py < Y + dy * s - r * s * 0.3 ? I('#ffffff') : py > Y + 2 * s ? c[1] : c[2]));
      rect(X - 16 * s, Y + Math.round(4 * s), 30 * s, 1, c[1]);
    }
    // la mer, puis un cap vert à droite
    grad(x0, hz, w, sb - hz, night ? ['#1a2448', '#121a36', '#0c1228'] : ['#2a66aa', '#285e9e', '#235492']);
    rect(x0, hz, w, 1, I(night ? '#3a4a7a' : '#b4d4ee'));
    for (let k = 0; k < w / 5; k++) { const gx = x0 + ((k * 37) % w), gy = hz + 2 + ((k * 13) % Math.max(1, sb - hz - 3)); rect(gx, gy, 2 + (k % 3), 1, I(night ? '#2c3a6a' : '#5a92cc')); }
    for (let x = 292; x < x0 + w; x++) { const hh = Math.min(12, Math.round((x - 292) * 0.5 + Math.sin(x * 0.3))); for (let y = hz - hh; y < hz + 1; y++) set(x, y, I(night ? '#0e1424' : y < hz - hh + 2 ? '#5f9a52' : '#3f7a44')); }
    seaShip('vraquier_supramax', 128, hz + 4, 24, night ? '#121a36' : '#7aa0c8', night ? 0.75 : 0.5, night);
    seaShip('pc_panamax', 238, hz + 7, 30, night ? '#121a36' : '#7aa0c8', night ? 0.72 : 0.42, night);
    // les tours : un rang lointain dans la brume (la mer reste visible au-dessus), un rang proche dont certaines dépassent l'horizon
    const bldg = (bx, bw, ty, kind, haze, seed) => {
      const pal = { glass: '#5f92bc', teal: '#4f9098', stone: '#c2b092', dark: '#465062', white: '#d8dce0' }[kind], r = RP(night ? mix(pal, '#0a1020', 0.75) : pal), hz2 = I(night ? '#1a2448' : '#a8c8e8');
      const sw = Math.max(2, Math.round(bw * 0.18)), crown = hsh(seed * 3.3) < 0.35, cTop = crown ? ty - 6 : ty;
      for (let y = cTop; y < sb; y++) for (let x = bx; x < bx + bw + sw; x++) {
        if (crown && y < ty && (x < bx + Math.round(bw * 0.25) || x >= bx + bw + sw - Math.round(bw * 0.25))) continue;
        const side = x >= bx + bw, lx = x - bx, ly = y - ty;
        let c = side ? r[1] : lx < 2 ? r[3] : r[2];
        if (!side && ly > 1) {
          if (kind === 'stone' || kind === 'white') { if (lx % 3 === 1 && ly % 3 === 1) c = night ? (hsh(x * 7 + y * 13 + seed) < 0.45 ? I('#ffd27a') : r[0]) : r[0]; }
          else if (night) { if (ly % 3 === 1 && lx % 2 === 0 && hsh(x * 5 + y * 11 + seed) < 0.4) c = I('#ffd890'); }
          else { if (lx % 3 === 0) c = r[1]; else if (ly % 4 === 0) c = r[3]; if ((lx + ly) % 37 < 2 && lx > 1 && lx < bw * 0.5) c = r[4]; } // meneaux, reflets du ciel
        }
        if (y === cTop && !side) c = r[4];
        set(x, y, haze ? mixI(c, hz2, haze) : c);
      }
      if (hsh(seed * 7.7) < 0.4) { const ax = bx + Math.round(bw / 2); rect(ax, cTop - 6, 1, 6, haze ? mixI(r[1], hz2, haze) : r[1]); set(ax, cTop - 7, I('#ff4a3a')); }
      else if (hsh(seed * 5.1) < 0.5 && !crown) { rect(bx + 2, ty - 2, 4, 2, haze ? mixI(r[1], hz2, haze) : r[1]); }
    };
    for (let k = 0, x = x0 - 6; x < x0 + w; k++) { const bw = 8 + Math.floor(hsh(k + 50) * 8); bldg(x, bw, hz + 13 + Math.floor(hsh(k + 80) * 10) - (k % 5 === 2 ? 12 : 0), ['glass', 'stone', 'white', 'teal'][k % 4], 0.5, k + 50); x += bw + 2 + Math.floor(hsh(k + 20) * 5); }
    for (let k = 0, x = x0 - 4; x < x0 + w; k++) {
      const bw = 14 + Math.floor(hsh(k) * 12), tall = k % 3 === 1, ty = tall ? hz - 6 - Math.floor(hsh(k + 3) * 26) : hz + 24 + Math.floor(hsh(k + 4) * 12);
      bldg(x, bw, ty, ['glass', 'dark', 'teal', 'stone', 'glass', 'white'][k % 6], 0, k);
      x += bw + 4 + Math.floor(hsh(k + 40) * 14);
    }
    clip = save;
  };
  // Store bateau bleu roi : plis, bas festonné, franges dorées.
  // Reflet dans l'eau de ce que dessine draw() entre x0 et x1, au-dessus de la ligne d'eau wl : les pixels
  // changés sont recopiés à l'envers sous wl, fondus dans l'eau et brisés par les vaguelettes.
  const reflect = (x0, x1, y0, wl, water, k, draw) => {
    const w = x1 - x0 + 1, snap = new Uint32Array(w * (wl - y0 + 1));
    for (let y = y0; y <= wl; y++) for (let x = x0; x <= x1; x++) snap[(y - y0) * w + x - x0] = get(x, y);
    draw();
    const wc = I(water);
    for (let y = wl; y >= y0; y--) for (let x = x0; x <= x1; x++) {
      const c = get(x, y);
      if (c === snap[(y - y0) * w + x - x0]) continue;
      const ry = 2 * wl - y + 1, d = ry - wl;
      if ((ry + Math.floor(x / 3)) % 4 === 3 && d > 2) continue; // vaguelettes
      set(x + (d > 3 && (ry % 3 === 0) ? 1 : 0), ry, mixI(c, wc, Math.min(0.85, k + d * 0.02)));
    }
  };
  // Un chalutier de profil, étrave à droite : coque à tonture, liston blanc, timonerie, mât et tangons.
  const trawler = (x, wl, s, hull, night, cab = '#f2efe6') => {
    const n = Math.round(30 * s), hh = Math.max(3, Math.round(5 * s)), r = RP(hull), c = RP(night ? '#5a6278' : cab);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), rise = Math.round(t * t * 3 * s), tp = wl - hh - rise + (i === 0 ? 1 : 0);
      const bot = wl - (t > 0.9 ? Math.round((t - 0.9) * 10 * hh * 0.6) : 0);
      for (let y = tp; y <= bot; y++) set(x + i, y, y === tp ? (night ? c[2] : I('#f6f2e8')) : y === tp + 1 ? r[1] : y >= wl - 1 ? I(night ? '#2a1414' : '#8e2a22') : i < n * 0.25 ? r[3] : r[2]);
    }
    // timonerie vers l'avant, vitres
    const wx = x + Math.round(n * 0.52), ww = Math.max(4, Math.round(8 * s)), wh = Math.max(3, Math.round(6 * s)), wy = wl - hh - Math.round(0.3 * 3 * s) - wh;
    rect(wx, wy, ww, wh, c[2]); rect(wx, wy, ww, 1, c[4]); rect(wx + ww - 1, wy, 1, wh, c[1]);
    for (let i = 1; i < ww - 1; i += 2) set(wx + i, wy + 1 + Math.floor(wh / 3), night ? I('#ffd27a') : I('#2a3a4a'));
    rect(wx - 1, wy - 1, ww + 2, 1, night ? c[1] : I('#c4362c'));
    // mât, vergue, tangons, portique arrière
    const mx = wx + Math.round(ww * 0.4), mt = wy - Math.round(16 * s), mc = I(night ? '#3a4054' : '#3a3632');
    rect(mx, mt, 1, wy - mt, mc); rect(mx - Math.round(3 * s), mt + Math.round(4 * s), Math.round(6 * s) + 1, 1, mc);
    line(mx, wy - Math.round(3 * s), mx - Math.round(12 * s), mt + Math.round(2 * s), mc);
    line(x + 2, wl - hh - 1, x + 2, wl - hh - Math.round(7 * s), mc); line(x + 2 + Math.round(4 * s), wl - hh - 1, x + 2 + Math.round(3 * s), wl - hh - Math.round(7 * s), mc);
    rect(x + 2, wl - hh - Math.round(7 * s), Math.round(3 * s) + 1, 1, mc);
    for (let k = 0; k < 8; k++) { const t = k / 8; set(Math.round(mx + (x + n - 1 - mx) * t), Math.round(mt + (wl - hh - 3 * s - mt) * t), mixI(mc, get(mx, mt - 2), 0.5)); }
    if (night) { set(mx, mt - 1, I('#fff6dc')); glow(mx, mt - 1, 4, '#fff6dc', 0.4); set(x + n - 2, wl - hh - Math.round(3 * s) - 1, I('#7fe08a')); }
  };
  // Vue du cagibi : la pluie sur le quai. Un navire à quai juste derrière la vitre, la jambe d'un portique,
  // des conteneurs, des bollards et des flaques ; des gouttes sur la vitre. La nuit, le lampadaire au sodium.
  const rainyQuay = (x0, y0, w, h, night) => {
    const save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const qy = y0 + Math.round(h * 0.72), sb = y0 + h, haze = I(night ? '#121826' : '#9aa4a8'), hk = night ? 0.2 : 0.28;
    const sc = (c) => mixI(I(c), haze, hk); // la pluie délave tout ce qui est au-delà de la vitre
    grad(x0, y0, w, qy - y0 + 1, night ? ['#0b101c', '#111827', '#182031', '#222838', '#2c2c34'] : ['#6c7880', '#7a868e', '#8a959b', '#9ba5a9', '#a9b1b2']);
    for (let k = 0; k < 6; k++) {
      const cx = x0 + ((k * 47 + 13) % w), cy = y0 + 2 + ((k * 13) % Math.max(4, Math.round((qy - y0) * 0.3))), cw = 22 + (k % 3) * 12;
      for (let i = 0; i < cw; i++) { set(cx - cw / 2 + i, cy, mixI(get(cx - cw / 2 + i, cy), I(night ? '#070a12' : '#5c6870'), 0.4)); if (i > 5 && i < cw - 7) set(cx - cw / 2 + i, cy + 1, mixI(get(cx - cw / 2 + i, cy + 1), I(night ? '#070a12' : '#5c6870'), 0.25)); }
    }
    // au loin, deux portiques noyés dans la pluie, au-dessus du pont du navire
    const far = I(night ? '#1a2030' : '#8c979c');
    for (const fx of [0.5, 0.8]) {
      const cx = x0 + Math.round(w * fx), ct = y0 + Math.round(h * 0.16);
      rect(cx, ct, 1, qy - ct, far); rect(cx + 8, ct, 1, qy - ct, far); rect(cx - 10, ct, 34, 2, far); line(cx, ct, cx + 4, ct - 6, far); line(cx + 8, ct, cx + 4, ct - 6, far);
      if (night) set(cx + 4, ct - 7, I('#ff4a3a'));
    }
    // le navire à quai, tout contre la vitre : sa muraille, la passerelle à gauche, les conteneurs en pontée
    const ht = qy - Math.round(h * 0.2), hull = RP(night ? '#16121a' : '#2c2a30');
    const topAt = (x) => ht - Math.round(((x - x0) / w) * 3);
    for (let x = x0; x < x0 + w; x++) {
      const t = topAt(x);
      for (let y = t; y < qy; y++) set(x, y, y === t ? sc('#e8e6e0') : y < t + 3 ? sc(color) : (x - x0) % 18 === 0 ? mixI(hull[1], haze, hk) : mixI(hull[2], haze, hk));
      if ((x * 7) % 23 === 0) for (let y = t + 4; y < t + 4 + 4 + (x % 5); y++) set(x, y, sc(night ? '#3a2418' : '#7a4a2e')); // coulures de rouille
    }
    for (let x = x0; x < x0 + w; x += 4) set(x, topAt(x) - 2, sc('#d8d8d4')); // le garde-corps
    for (let x = x0; x < x0 + w; x++) set(x, topAt(x) - 3, sc('#d8d8d4'));
    // passerelle blanche, fenêtres, ailerons ; cheminée à la couleur de la compagnie
    const px0 = x0 + Math.round(w * 0.08), pw = Math.round(w * 0.26), pt = y0 + Math.round(h * 0.12);
    const fx = px0 + Math.round(pw * 0.3);
    rect(fx, pt - 6, 9, 12, sc(color)); rect(fx, pt - 6, 9, 2, sc('#1c1c1e')); rect(fx, pt - 1, 9, 2, sc('#f2efe6'));
    rect(px0, pt, pw, topAt(px0) - 3 - pt, sc('#e8e4da')); rect(px0, pt, 1, topAt(px0) - 3 - pt, sc('#f6f4ee')); rect(px0 + pw - 1, pt, 1, topAt(px0) - 3 - pt, sc('#b8b4aa'));
    rect(px0 - 5, pt + 3, pw + 10, 2, sc('#e8e4da'));
    for (let yy = pt + 7; yy < topAt(px0) - 6; yy += 5) for (let xx = px0 + 2; xx < px0 + pw - 2; xx += 3) rect(xx, yy, 2, 2, night ? ((xx + yy) % 3 ? I('#ffd27a') : I('#2a3040')) : sc('#3a4a5a'));
    rect(px0 + 1, pt + 1, pw - 2, 2, night ? I('#ffe6a0') : sc('#2a3a4a')); // la timonerie
    // conteneurs en pontée
    const cols = ['#c4362c', '#2f6fb0', '#e09a2a', '#2e8b57', '#8f98a5', '#b9442f', '#f2efe6'];
    for (let cx = px0 + pw + 6, k = 0; cx < x0 + w; cx += 13, k++) for (let r = 0; r < 2 + (k % 3 === 1 ? 1 : 0); r++) {
      const c = RP(cols[(k * 3 + r * 2) % cols.length]), cy = topAt(cx) - 3 - (r + 1) * 7;
      rect(cx, cy, 12, 7, mixI(c[2], haze, hk + (night ? 0.4 : 0))); rect(cx, cy, 12, 1, mixI(c[3], haze, hk + (night ? 0.4 : 0)));
      for (let i = 2; i < 11; i += 2) rect(cx + i, cy + 2, 1, 4, mixI(c[1], haze, hk + (night ? 0.4 : 0)));
    }
    // écubier et amarre
    const hx = x0 + Math.round(w * 0.78), hy = ht + 6;
    ellipse(hx, hy, 2.5, 1.6, I('#0c0c10'));
    // le quai : béton mouillé, ligne jaune, rails, bollards, reflets de la muraille
    grad(x0, qy, w, sb - qy, night ? ['#1d1f26', '#22242a', '#282a2e'] : ['#666b6d', '#5c6163', '#53585a']);
    for (let y = qy + 2; y < sb; y++) for (let x = x0; x < x0 + w; x++) if ((x + y * 3) % 5 < 2) { const src = qy - (y - qy) * 1.6; if (src > y0) set(x, y, mixI(get(x, y), get(x, src), 0.28)); } // le béton mouillé fait miroir
    rect(x0, qy, w, 1, I(night ? '#3a3a40' : '#8a8f90'));
    for (let x = x0; x < x0 + w; x++) if (Math.floor((x - x0) / 4) % 2) set(x, qy + 1, I(night ? '#6a5a20' : '#d9b02a'));
    const ry = qy + Math.round((sb - qy) * 0.6); rect(x0, ry, w, 1, I(night ? '#4a4c54' : '#9aa0a2')); rect(x0, ry + 1, w, 1, I(night ? '#121318' : '#45494b'));
    for (const bxf of [0.34, 0.86]) {
      const bx = x0 + Math.round(w * bxf), by = qy + 5;
      rect(bx - 2, by - 3, 5, 3, I('#1c1c1e')); rect(bx - 3, by - 4, 7, 1, I('#2c2c30')); set(bx - 2, by - 4, I('#5a5a60'));
    }
    line(x0 + Math.round(w * 0.86), qy + 1, hx, hy + 1, I(night ? '#4a4030' : '#c8b88a'));
    // jambe d'un portique au premier plan
    const g = RP(night ? '#4a2418' : '#c9572f'), lx = x0 + 4;
    rect(lx, y0, 8, sb - y0 - 3, g[2]); rect(lx, y0, 2, sb - y0 - 3, g[3]); rect(lx + 6, y0, 2, sb - y0 - 3, g[1]);
    for (let y = y0 + 6; y < sb - 8; y += 14) { line(lx + 8, y, lx + 16, y + 9, g[1]); line(lx + 8, y + 1, lx + 16, y + 10, g[2]); }
    rect(lx - 2, sb - 5, 12, 3, I('#2a2a2e')); rect(lx - 2, sb - 5, 12, 1, I('#4a4a50'));
    // lampadaire au sodium
    const lpx = x0 + Math.round(w * 0.64), lpt = y0 + Math.round(h * 0.3);
    rect(lpx, lpt, 1, qy + 3 - lpt, I(night ? '#2a2c34' : '#4a5054')); rect(lpx - 5, lpt, 6, 1, I(night ? '#2a2c34' : '#4a5054'));
    rect(lpx - 6, lpt + 1, 3, 1, I(night ? '#ffcf6e' : '#c8ccc8'));
    if (night) { glow(lpx - 5, lpt + 3, 18, '#ff9a3a', 0.4); for (let j = 3; j < sb - qy; j += 3) rect(lpx - 6 - (j % 2), qy + j, 2 + (j % 3), 1, mixI(get(lpx - 6, qy + j), I('#ffb050'), 0.5)); }
    // la pluie, en hachures obliques
    for (let k = 0; k < (w * h) / 60; k++) {
      const rx = x0 + ((k * 53 + (k * k) % 7) % w), rr = y0 + ((k * 29 + k * k * 3) % h), len = 4 + (k % 4);
      const lit = night && Math.hypot(rx - lpx + 5, rr - lpt - 3) < 18;
      for (let j = 0; j < len; j++) { const xx = rx - Math.floor(j / 4), yy = rr + j; set(xx, yy, mixI(get(xx, yy), I(lit ? '#ffd890' : night ? '#7a88a6' : '#eef4f6'), lit ? 0.45 : night ? 0.22 : 0.32)); }
    }
    for (let k = 0; k < w / 7; k++) { const sx = x0 + ((k * 37) % w), sy = qy + 3 + ((k * 11) % Math.max(1, sb - qy - 4)); set(sx, sy, mixI(get(sx, sy), I('#ffffff'), 0.35)); } // éclaboussures
    // gouttes et ruisselets sur la vitre
    for (let k = 0; k < (w * h) / 160; k++) {
      const gx = x0 + 2 + ((k * 71 + 5) % (w - 4)), gy = y0 + 2 + ((k * 43 + k * k) % (h - 4));
      const run = k % 3 === 0 ? 3 + (k % 6) : 0;
      for (let j = 1; j <= run; j++) set(gx + (j % 4 === 0 ? 1 : 0), gy + j, mixI(get(gx, gy + j), I('#ffffff'), 0.14));
      set(gx, gy, mixI(get(gx, gy), I('#ffffff'), 0.45)); set(gx + 1, gy, mixI(get(gx + 1, gy), I('#ffffff'), 0.2));
      set(gx, gy + 1, mixI(get(gx, gy + 1), DEEP, 0.2)); set(gx + 1, gy + 1, mixI(get(gx + 1, gy + 1), DEEP, 0.3));
    }
    clip = save;
  };
  // Vue du bureau sur le port : le port de pêche au petit matin. Le soleil se lève derrière la colline, les
  // maisons colorées du quai d'en face se reflètent dans le bassin, la brume traîne, les chalutiers rentrent.
  const fishingHarbour = (x0, y0, w, h, night) => {
    const save = clip;
    clip = [x0 + ox, y0, x0 + w + ox, y0 + h];
    const hz = y0 + Math.round(h * 0.6), sb = y0 + h, sky = hz - y0;
    grad(x0, y0, w, sky, night ? ['#060a1a', '#0b1430', '#13204a', '#1c2a58', '#28305e'] : ['#7fa7cf', '#9db9da', '#c3cde0', '#e8d2d2', '#f7d8bc', '#fbe6c6']);
    const sx = x0 + Math.round(w * 0.2), sy = y0 + Math.round(sky * 0.56);
    if (night) {
      for (let k = 0; k < (w * sky) / 70; k++) { const px = x0 + ((k * 53 + 11) % w), py = y0 + ((k * 37 + k * k * 3) % Math.max(1, sky - 14)); set(px, py, k % 6 ? mixI(I('#c9d2e8'), get(px, py), 0.45) : I('#ffffff')); }
      const mx = x0 + Math.round(w * 0.78), my = y0 + Math.round(sky * 0.22);
      glow(mx, my, 14, '#9fb0d8', 0.35); ellipse(mx, my, 4.5, 4.5, '#f2efdc', (x, y) => (x > mx + 1 && y > my ? I('#d8d2b8') : I('#f6f2e2')));
    } else {
      glow(sx, sy, 34, '#fff3d0', 0.6);
      ellipse(sx, sy, 7, 7, '#fff6dc', (x, y) => (y > sy + 2 ? I('#ffe8b0') : I('#fffaea')));
      // nuages roses en longues bandes
      for (const [cx, cy, cw] of [[0.45, 0.2, 40], [0.78, 0.34, 30], [0.12, 0.12, 26], [0.62, 0.5, 22]]) {
        const X = x0 + Math.round(w * cx) - cw / 2, Y = y0 + Math.round(sky * cy);
        rect(X + 4, Y, cw - 8, 1, I('#f4e4e6')); rect(X, Y + 1, cw, 1, I('#e9b8b4')); rect(X + 6, Y + 2, cw - 14, 1, I('#d8a2a8'));
      }
      // mouettes
      for (const [gx, gy] of [[0.36, 0.3], [0.42, 0.36], [0.7, 0.18]]) { const X = x0 + Math.round(w * gx), Y = y0 + Math.round(sky * gy); set(X - 1, Y, I('#4a4a52')); set(X, Y + 1, I('#4a4a52')); set(X + 1, Y, I('#4a4a52')); set(X - 2, Y - 1, I('#6a6a72')); set(X + 2, Y - 1, I('#6a6a72')); }
    }
    // la colline derrière le village (le soleil passe juste au-dessus)
    const hill = RP(night ? '#141c30' : '#93a487');
    for (let x = x0; x < x0 + w; x++) {
      const t = (x - x0) / w, hh = Math.round(sky * (0.2 + 0.16 * Math.sin(t * 3.1 + 0.4) + 0.06 * Math.sin(t * 11)));
      for (let y = hz - hh; y < hz; y++) set(x, y, y === hz - hh ? hill[3] : (x * 7 + y * 3) % 23 === 0 ? hill[1] : mixI(hill[2], I(night ? '#1c2a58' : '#f7d8bc'), night ? 0.2 : 0.35));
    }
    // les maisons du quai d'en face, façades pastel éclairées de la gauche, et le clocher
    const facades = ['#efe2c4', '#e8b48a', '#f2d68a', '#dce4e6', '#e7a79a', '#f4efe6', '#b9d0d8', '#e9c9a0'];
    let x = x0 - 3, k = 0;
    while (x < x0 + w) {
      const bw = 9 + ((k * 5) % 7), bh = 12 + ((k * 7) % 9) + (k % 4 === 1 ? 5 : 0), top = hz - 3 - bh, tower = k === 6;
      const f = RP(night ? mix(facades[k % facades.length], '#141a34', 0.72) : facades[k % facades.length]);
      if (tower) { // le clocher
        const tw = 7, th = bh + 18;
        rect(x + 1, hz - 3 - th, tw, th, f[2]); rect(x + 1, hz - 3 - th, 1, th, f[3]); rect(x + tw, hz - 3 - th, 1, th, f[1]);
        poly([[x, hz - 3 - th], [x + tw + 2, hz - 3 - th], [x + 1 + tw / 2, hz - 3 - th - 9]], I(night ? '#1e2236' : '#5a6470'));
        rect(x + 3, hz - th + 2, 3, 4, I('#2a2a30')); ellipse(x + 4.5, hz - th + 10, 1.5, 1.5, I(night ? '#ffe6a0' : '#f6f2e6'));
        x += tw + 2; k++; continue;
      }
      rect(x, top, bw, bh, f[2]); rect(x, top, 1, bh, f[3]); rect(x + bw - 1, top, 1, bh, f[1]);
      const tile = k % 3 !== 1, roof = RP(night ? '#1e2236' : tile ? '#b8603e' : '#5a6672');
      poly([[x - 1, top], [x + bw, top], [x + bw - 2, top - 3], [x + 1, top - 3]], roof[2]); rect(x + 1, top - 3, bw - 3, 1, roof[3]);
      const sh = RP(['#3a6f9a', '#3d7a5a', '#b04a3a', '#2f5f8a'][k % 4]);
      for (let yy = top + 3; yy < hz - 5; yy += 5) for (let xx = x + 2; xx < x + bw - 2; xx += 4) {
        const lit = night && (xx * 3 + yy + k) % 4 !== 0;
        rect(xx, yy, 2, 2, lit ? I('#ffd27a') : I(night ? '#0e1222' : '#3a3a44'));
        if (!night) { set(xx - 1, yy, sh[2]); set(xx + 2, yy, sh[2]); set(xx - 1, yy + 1, sh[1]); set(xx + 2, yy + 1, sh[1]); }
      }
      x += bw; k++;
    }
    // le quai de pierre d'en face, ses lampadaires
    const qs = RP(night ? '#232838' : '#b8ab92');
    rect(x0, hz - 3, w, 3, qs[2]); rect(x0, hz - 3, w, 1, qs[3]); rect(x0, hz - 1, w, 1, qs[1]);
    for (let lx = x0 + 10; lx < x0 + w; lx += 26) { rect(lx, hz - 9, 1, 6, I(night ? '#3a3a48' : '#4a4a52')); set(lx, hz - 10, I(night ? '#ffe6a0' : '#e8e2d0')); if (night) glow(lx, hz - 10, 6, '#ffd890', 0.4); }
    // le bassin : reflets des façades, brume du matin
    const water = night ? ['#141c36', '#101830', '#0c1328'] : ['#a9bfc6', '#8fb0bb', '#749cab', '#5f8a9c'];
    grad(x0, hz, w, sb - hz, water);
    for (let y = hz; y < sb; y++) {
      const d = y - hz, wob = Math.round(Math.sin(y * 1.7) * (d > 4 ? 1 : 0));
      for (let xx = x0; xx < x0 + w; xx++) {
        const src = hz - 1 - Math.round(d * 1.1);
        if (src < y0) continue;
        if ((y + Math.floor(xx / 4)) % 5 === 4 && d > 2) continue;
        set(xx, y, mixI(get(xx + wob, src), get(xx, y), 0.5 + Math.min(0.35, d * 0.012)));
      }
    }
    if (!night) for (let j = 1; j < 14; j += 2) rect(sx - 3 + ((j * 5) % 4), hz + j, 7 - j / 3, 1, I('#ffe8b8')); // le soleil dans l'eau
    else for (let lx = x0 + 10; lx < x0 + w; lx += 26) for (let j = 1; j < 12; j += 2) rect(lx - 1 + (j % 2), hz + j, 2, 1, I('#e8c070'));
    tint(x0, hz - 6, w, 12, night ? '#2a3460' : '#f6ece4', (i, j) => (j < 6 ? (j / 6) * 0.45 : (1 - (j - 6) / 6) * 0.45) * (0.7 + 0.3 * Math.sin(i * 0.13))); // la brume
    // les chalutiers : deux à quai en face, un qui rentre au premier plan
    const wl1 = hz + 6, wl2 = hz + Math.round((sb - hz) * 0.62), wt = night ? '#101830' : '#7aa0b0';
    reflect(x0, x0 + w - 1, y0, wl1, wt, 0.55, () => { trawler(x0 + Math.round(w * 0.06), wl1, 0.55, '#2f6fb0', night); trawler(x0 + Math.round(w * 0.6), wl1, 0.6, '#3d7a5a', night); });
    reflect(x0, x0 + w - 1, y0, wl2, wt, 0.5, () => trawler(x0 + Math.round(w * 0.28), wl2, 1, '#c4362c', night));
    for (let i = 0; i < 16; i++) { set(x0 + Math.round(w * 0.28) - 2 - i * 2, wl2 + 1 + Math.round(i * 0.3), mixI(get(x0, wl2 + 2), I('#ffffff'), 0.5)); } // sillage
    // notre quai, en bas : bord de pierre, caisses de poisson, filet
    const qy = sb - 6, st = RP(night ? '#262a38' : '#a89c86');
    rect(x0, qy, w, sb - qy, st[2]); rect(x0, qy, w, 1, st[4]); rect(x0, qy + 1, w, 1, st[3]);
    for (let xx = x0; xx < x0 + w; xx += 11) rect(xx, qy + 2, 1, sb - qy - 2, st[1]);
    for (let c = 0; c < 3; c++) { const cr = RP(night ? '#1c2a44' : ['#2f7fc0', '#e0a02a', '#2f7fc0'][c]), cx = x0 + w - 34 + c * 9 - (c === 2 ? 13 : 0), cy = qy - (c === 2 ? 10 : 5); rect(cx, cy, 8, 5, cr[2]); rect(cx, cy, 8, 1, cr[3]); rect(cx + 1, cy + 2, 6, 1, cr[1]); }
    for (let i = 0; i < 14; i++) for (let j = 0; j < 4 - Math.abs(i - 7) / 3; j++) if ((i + j) % 2 === 0) set(x0 + 14 + i, qy - 1 - j, I(night ? '#2a3a3a' : '#6a8a5a')); // filet
    clip = save;
  };
  const valance = (x, y, w, dark) => {
    const b = RP(dark ? '#6a1626' : '#1f3f8f'), g = RP('#d9b25a');
    piece(() => {
      for (let i = 0; i < w; i++) {
        const sc = Math.round(Math.sin(((i % 12) / 12) * Math.PI) * 2), hh = 9 + sc;
        for (let j = 0; j < hh; j++) set(x + i, y + j, j === 0 ? b[4] : j % 3 === 0 ? b[3] : j % 3 === 2 ? b[1] : b[2]);
        set(x + i, y + hh, i % 2 ? g[2] : b[1]); if (i % 2 === 0) set(x + i, y + hh + 1, g[3]);
      }
    });
  };
  // Écusson d'or portant l'emblème de la compagnie.
  const crest = (cx, cy) => {
    piece(() => {
      const g = RP('#d9b25a');
      poly([[cx - 7, cy - 8], [cx + 8, cy - 8], [cx + 8, cy + 1], [cx, cy + 9], [cx - 7, cy + 1]], g[2]);
      rect(cx - 7, cy - 8, 15, 1, g[4]); rect(cx - 7, cy - 8, 1, 9, g[3]); for (let k = 0; k < 8; k++) set(cx + k, cy + 1 + k, g[1]);
      set(cx - 9, cy - 9, g[3]); set(cx + 9, cy - 9, g[3]);
    });
    roundel(cx + 0.5, cy - 1, 4, '#b8903e');
  };
  // Juke-box d'acajou à fronton arrondi, néons bleus (ambre chez l'armateur de l'ombre), grille dorée.
  const jukeLux = (x, base) => {
    const m = RP('#7a3020'), g = RP('#d9b25a'), ne = RP(shadow ? '#ffb040' : '#5aa8ff'), cx = x + 18;
    piece(() => {
      for (let y = base - 62; y < base; y++) for (let i = 0; i < 37; i++) {
        const dy = base - 46 - y, inArch = dy <= 0 || (i - 18) ** 2 + dy * dy * 1.6 <= 18.5 ** 2;
        if (!inArch) continue;
        set(x + i, y, i < 2 ? m[3] : i > 34 ? m[1] : m[2]);
      }
      for (let a = Math.PI; a <= 2 * Math.PI; a += 0.02) { set(cx + Math.round(Math.cos(a) * 16), base - 46 + Math.round(Math.sin(a) * 12.6), g[3]); set(cx + Math.round(Math.cos(a) * 13), base - 46 + Math.round(Math.sin(a) * 10), ne[3]); set(cx + Math.round(Math.cos(a) * 12), base - 46 + Math.round(Math.sin(a) * 9.2), ne[4]); }
      for (const tx of [x + 4, x + 31]) { rect(tx, base - 46, 2, 40, ne[3]); set(tx, base - 46, ne[4]); rect(tx + (tx < cx ? 0 : 1), base - 46, 1, 40, ne[4]); }
      rect(x + 9, base - 47, 19, 14, I('#1a0e0a')); ellipse(cx, base - 40, 6, 1.6, I('#141010')); set(cx, base - 40, I('#c4362c')); line(x + 24, base - 46, x + 20, base - 41, g[3]);
      for (let k = 0; k < 6; k++) rect(x + 9 + k * 3, base - 30, 2, 2, I(['#ffd877', '#7fd0c4', '#ff7a5c', '#ffd877', '#a8c8ff', '#ff7a5c'][k]));
      rect(x + 9, base - 26, 19, 19, I('#2a1610'));
      for (let j = 0; j < 19; j++) for (let i = 0; i < 19; i++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) set(x + 9 + i, base - 26 + j, g[(i + j) % 8 === 0 ? 3 : 1]);
      rect(x, base - 4, 37, 4, m[0]); rect(x, base - 4, 37, 1, g[2]);
    });
  };
  // Bergère de velours bleu roi, capitonnée, cadre doré à volutes et roulettes, un coussin.
  const armchairLux = (cx, base) => {
    const v = RP(shadow ? '#6a1626' : '#1f3f8f'), g = RP('#d9b25a');
    piece(() => {
      for (let y = base - 42; y < base - 16; y++) {
        const j = y - (base - 42), ins = j === 0 ? 5 : j === 1 ? 3 : j === 2 ? 2 : j < 5 ? 1 : 0;
        for (let i = -13 + ins; i <= 13 - ins; i++) {
          const bt = j > 4 && j % 5 === 2 && (i + (Math.floor(j / 5) % 2 ? 2 : 0) + 40) % 4 === 0;
          set(cx + i, y, i === -13 + ins ? g[3] : i === 13 - ins ? g[1] : j === 0 ? g[4] : bt ? v[0] : i < -6 ? mixI(v[2], v[3], 0.35) : v[2]);
        }
      }
      rect(cx - 14, base - 17, 29, 5, v[3]); rect(cx - 14, base - 17, 29, 1, v[4]); rect(cx - 14, base - 13, 29, 1, v[1]);
      rect(cx - 15, base - 12, 31, 2, g[2]); rect(cx - 15, base - 12, 31, 1, g[4]);
      for (const s of [-1, 1]) {
        const ax = cx + s * 15;
        rect(ax - (s < 0 ? 2 : 0), base - 26, 3, 14, g[2]); set(ax + (s < 0 ? -2 : 2), base - 27, g[4]); set(ax + (s < 0 ? -3 : 3), base - 26, g[3]);
        line(cx + s * 12, base - 10, cx + s * 14, base - 2, g[2]); ellipse(cx + s * 14, base - 1, 1.6, 1.4, g[1]);
      }
    });
    piece(() => { const p = RP('#8aa8d8'); rect(cx + 1, base - 29, 10, 11, p[2]); rect(cx + 1, base - 29, 10, 1, p[3]); for (let k = 0; k < 10; k += 2) for (let j = 1; j < 11; j += 2) set(cx + 1 + k + (j % 4 === 1 ? 1 : 0), base - 29 + j, p[1]); });
  };
  const brassLamp = (x, base) => {
    glow(x, base - 12, 16, '#ffe9b0', 0.28);
    piece(() => { const b = RP('#c9a24a'); rect(x - 3, base - 1, 7, 1, b[2]); rect(x, base - 12, 1, 11, b[3]); set(x + 1, base - 12, b[1]); });
    piece(() => { const s = RP('#f4ede0'); rect(x - 4, base - 18, 9, 6, s[2]); rect(x - 4, base - 18, 9, 1, s[3]); rect(x + 4, base - 18, 1, 6, s[1]); rect(x - 4, base - 13, 9, 1, s[1]); });
  };
  // Cloche de verre posée sur la maquette (arêtes et reflet seulement).
  const vitrine = (x, base, w, h) => {
    const e = I('#eaf6fa');
    for (let y = base - h; y < base; y++) { set(x, y, mixI(get(x, y), e, 0.55)); set(x + w - 1, y, mixI(get(x + w - 1, y), e, 0.4)); }
    for (let i = 0; i < w; i++) set(x + i, base - h, mixI(get(x + i, base - h), e, 0.6));
    for (let k = 0; k < Math.min(h - 3, 12); k++) set(x + 3 + Math.round(k * 0.4), base - h + 2 + k, mixI(get(x + 3 + Math.round(k * 0.4), base - h + 2 + k), e, 0.35));
    rect(x - 1, base - 1, w + 2, 1, I('#2a1a10'));
  };
  const blotter = (x, base) => piece(() => { rect(x, base - 1, 16, 1, I('#5a1e1e')); rect(x + 1, base - 2, 14, 1, I('#7a2a28')); line(x + 9, base - 3, x + 15, base - 4, I('#c9a24a')); set(x + 8, base - 3, I('#1c1c1c')); });
  // Grande hélice de bronze (quatre pales vrillées) sur son axe et un socle de pierre noire.
  const propeller = (cx, base) => {
    const cy = base - 23, Lb = 17;
    piece(() => { const s2 = RP('#26262c'); rect(cx - 10, base - 6, 20, 6, s2[2]); rect(cx - 10, base - 6, 20, 1, s2[4]); rect(cx + 9, base - 6, 1, 6, s2[1]); rect(cx - 3, base - 4, 6, 2, I('#c9a24a')); });
    piece(() => { const b2 = RP('#8a5a2a'); rect(cx - 1, cy, 3, base - 6 - cy, b2[2]); set(cx - 1, cy + 4, b2[3]); });
    piece(() => {
      const b2 = RP('#b4783a');
      for (const a0 of [-2.2, -0.63, 0.94, 2.5]) {
        const ca = Math.cos(a0), sa = Math.sin(a0);
        for (let y = -Lb; y <= Lb; y++) for (let x = -Lb; x <= Lb; x++) {
          const u = x * ca + y * sa, v = -x * sa + y * ca - Math.sin((u / Lb) * Math.PI * 0.9) * 2.6;
          if (u < 2 || u > Lb) continue;
          const wd = Math.sin(Math.pow(u / Lb, 0.75) * Math.PI) * 4.6 + 0.5;
          if (Math.abs(v) < wd) set(cx + x, cy + y, v < -wd * 0.45 ? b2[4] : v < 0 ? b2[3] : v > wd * 0.55 ? b2[1] : b2[2]);
        }
      }
      ellipse(cx, cy, 4.5, 4.5, b2[2], (x, y) => (x + y < cx + cy - 2 ? b2[4] : x + y > cx + cy + 2 ? b2[1] : b2[3]));
      set(cx, cy, b2[0]);
    });
  };
  const rugModern = (x0, x1) => {
    for (let y = F + 2; y < H; y++) for (let x = x0; x < x1; x++) {
      const e = y === F + 2 || x === x0 || x === x1 - 1, b = y === F + 4 || x === x0 + 2 || x === x1 - 3;
      set(x, y, e ? I('#b8a684') : b ? I('#2c3e5c') : bay(x & 1023, y) < 0.2 ? I('#e2d6bc') : I('#d8caae'));
    }
  };
  const barLight = (xa, xb, top, y) => {
    rect(xa + 6, top, 1, y - top, I('#3a3530')); rect(xb - 7, top, 1, y - top, I('#3a3530'));
    tint(xa, y + 2, xb - xa, 30, '#fff1c8', (i, j) => 0.16 * (1 - j / 30));
    piece(() => { const b = RP('#c9a24a'); rect(xa, y, xb - xa, 2, b[2]); rect(xa, y, xb - xa, 1, b[4]); rect(xa + 2, y + 2, xb - xa - 4, 1, I('#fff6dc')); });
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
    // ---- Le cagibi du quai : plâtre taché, lambris de planches vert bouteille écaillé, une grande fenêtre
    // d'atelier sur le quai sous la pluie, bureau de tôle, ampoule nue, ciré qui goutte, seau sous la fuite.
    const top = F > 150 ? 12 : 3, wain = F - 40;
    const pl = shadow ? ['#25261f', '#2b2c24', '#31332a'] : ['#b3b29c', '#bcbba5', '#c4c3ad'];
    grad(L, 0, R - L, wain, pl);
    dith(L, 0, R - L, wain, I(pl[1]), I(mix(pl[1], '#000000', 0.06)), (i, j) => (Math.sin(i * 0.11 + j * 0.07) + Math.sin(j * 0.23 - i * 0.05) > 1.2 ? 0.5 : 0.06));
    // auréoles d'humidité sous la fuite, plâtre écaillé
    tint(206, top, 50, 46, shadow ? '#141510' : '#8d8c74', (i, j) => { const d = Math.hypot((i - 25) / 25, (j - 6) / 40); return d < 1 ? 0.35 * (1 - d) * (Math.sin(d * 14) > 0 ? 1 : 0.7) : 0; });
    tint(8, wain - 30, 46, 30, shadow ? '#141510' : '#9a9a82', (i, j) => { const d = Math.hypot((i - 23) / 23, (j - 30) / 30); return d < 1 ? 0.3 * (1 - d) : 0; });
    for (const [x, y] of [[72, wain - 22], [96, F - 140], [250, wain - 12], [30, F - 132]]) { rect(x, y, 6, 3, I(mix(pl[1], '#f0efe0', 0.45))); rect(x + 1, y + 3, 4, 1, I(mix(pl[1], '#5e5d4c', 0.5))); set(x - 1, y + 1, I(mix(pl[1], '#5e5d4c', 0.4))); }
    // lambris de planches peintes, la peinture part par plaques
    const g = RP(shadow ? '#1c2a22' : '#3f6650');
    rect(L, wain, R - L, F - wain, g[2]);
    for (let x = L - ((L % 7) + 7) % 7; x < R; x += 7) { rect(x, wain + 2, 1, F - wain - 6, g[1]); rect(x + 1, wain + 2, 1, F - wain - 6, mixI(g[2], g[3], 0.5)); }
    for (let k = 0; k < 14; k++) { const cx = L + ((k * 61 + 17) % (R - L)), cy = wain + 6 + ((k * 13) % (F - wain - 14)); rect(cx, cy, 3 + (k % 3), 2, I(shadow ? '#3a3020' : '#a48a62')); set(cx, cy + 2, I(shadow ? '#2a2418' : '#7a6448')); }
    rect(L, wain - 2, R - L, 3, g[3]); rect(L, wain - 2, R - L, 1, g[4]); rect(L, wain + 1, R - L, 1, g[0]);
    rect(L, F - 4, R - L, 4, I(shadow ? '#1a1a14' : '#3a3a2e')); rect(L, F - 4, R - L, 1, I(shadow ? '#2a2a20' : '#55553f'));
    // plafond : poutre d'acier rivetée, tuyau
    if (top > 3) {
      const st = RP(shadow ? '#2c3034' : '#6f7a80'), p = RP('#8a9396');
      rect(L, 0, R - L, top - 3, st[2]); rect(L, top - 4, R - L, 1, st[3]); rect(L, top - 3, R - L, 1, st[0]);
      for (let x = L - ((L % 12) + 12) % 12; x < R; x += 12) set(x, 3, st[4]);
      rect(L, top - 1, R - L, 3, p[2]); rect(L, top - 1, R - L, 1, p[4]); rect(L, top + 1, R - L, 1, p[1]);
      for (let x = L + 20; x < R; x += 64) { rect(x, top - 3, 2, 6, p[1]); rect(x, top - 3, 2, 1, p[3]); }
      tint(L, top + 2, R - L, 3, DEEP, 0.15);
    }
    // la fenêtre d'atelier : châssis d'acier à petits carreaux, un carreau fêlé scotché
    const wx = 110, ww = 130, wy = top + 10, wb = wain - 4, wh = wb - wy;
    rainyQuay(wx, wy, ww, wh, shadow);
    piece(() => {
      const fr = RP(shadow ? '#2a3430' : '#5d7068');
      rect(wx - 4, wy - 4, ww + 8, 4, fr[3]); rect(wx - 4, wb, ww + 8, 3, fr[2]); rect(wx - 4, wy, 4, wh, fr[3]); rect(wx + ww, wy, 4, wh, fr[1]);
      const c = RP('#a8a294'); rect(wx - 7, wb + 3, ww + 14, 3, c[3]); rect(wx - 7, wb + 3, ww + 14, 1, c[4]); rect(wx - 7, wb + 6, ww + 14, 1, c[1]); // appui de béton
    });
    { // les petits fers du châssis, sans contour, puis le carreau fêlé et sa croix de scotch
      const fr = RP(shadow ? '#2a3430' : '#5d7068');
      for (let k = 1; k < 4; k++) { const bx = wx + Math.round((ww * k) / 4) - 1; rect(bx, wy, 2, wh, fr[2]); rect(bx, wy, 1, wh, fr[3]); }
      rect(wx, wy + Math.round(wh * 0.45) - 1, ww, 2, fr[2]); rect(wx, wy + Math.round(wh * 0.45) - 1, ww, 1, fr[3]);
      const cx = wx + Math.round(ww * 0.86), cy = wy + Math.round(wh * 0.2), tape = I(shadow ? '#6a6450' : '#e9dfae');
      line(cx - 5, cy - 4, cx + 6, cy + 5, tape); line(cx - 5, cy + 4, cx + 5, cy - 4, tape);
      line(cx + 2, cy - 1, cx + 9, cy + 2, mixI(get(cx, cy), I('#ffffff'), 0.5));
    }
    if (shadow) curtains(wx - 2, wy - 2, ww + 4, wh + 8);
    // affiche de navire (portrait du patron chez l'armateur de l'ombre), calendrier, table des marées
    if (shadow) portrait(72, F - 128, 28, 34);
    else {
      piece(() => { rect(74, F - 126, 28, 36, I('#f3efe2')); rect(74, F - 126, 28, 1, I('#ffffff')); });
      grad(77, F - 123, 22, 18, ['#9cc6d8', '#d8e8ec']); rect(77, F - 108, 22, 3, I('#4b819b'));
      piece(() => { poly([[79, F - 108], [97, F - 108], [94, F - 105], [81, F - 105]], I('#c4362c')); rect(88, F - 114, 4, 6, I('#efe6d2')); rect(89, F - 116, 2, 2, I('#1c2a33')); });
      rect(77, F - 101, 22, 3, I('#1c2a33')); rect(80, F - 96, 16, 1, I('#8f98a5'));
      rect(72, F - 128, 4, 2, I('#e9e0a8')); rect(100, F - 128, 4, 2, I('#e9e0a8'));
      set(101, F - 92, I('#d8d2bc')); set(100, F - 91, I('#d8d2bc')); // coin corné
    }
    piece(() => { rect(54, F - 118, 14, 16, I('#f6f3ea')); rect(54, F - 118, 14, 4, I('#c4362c')); for (let k = 0; k < 9; k++) set(56 + (k % 3) * 4, F - 111 + Math.floor(k / 3) * 3, I('#8f98a5')); set(60, F - 108, I('#c4362c')); });
    rect(60, F - 120, 1, 2, I('#3a3a3a'));
    piece(() => { rect(54, F - 96, 14, 18, I('#efe9d6')); for (let k = 0; k < 6; k++) { rect(56, F - 93 + k * 3, 5, 1, I('#6a7a8a')); rect(62, F - 93 + k * 3, 4, 1, I('#9aa6b0')); } rect(56, F - 95, 10, 1, I('#2f6fb0')); }); // table des marées
    // enseigne : une feuille scotchée avec l'écusson, au-dessus du classeur
    sign(13, F - 104, 22, '#f6f2e6', 'paper');
    // ampoule nue (lustre ridicule chez l'armateur de l'ombre)
    if (shadow) chandelier(174, 0, 0.8);
    else {
      const by = Math.min(F - 132, 40);
      rect(174, 0, 1, Math.max(2, by), I('#2f2f2f'));
      glow(174, by + 4, 34, '#fff3c0', 0.4);
      piece(() => { rect(173, by, 3, 3, I('#5a5a5a')); ellipse(174.5, by + 6, 3, 3.5, I('#fff8d8')); set(174, by + 5, I('#ffffff')); });
    }
    // armoire de classement, bouilloire et tasses
    piece(() => {
      const r = box(8, F - 60, 32, 60, shadow ? '#5a6264' : '#7f8a8c');
      for (let k = 0; k < 3; k++) { drawer(10, F - 57 + k * 19, 28, 17, shadow ? '#5a6264' : '#7f8a8c', '#c9c9c9'); rect(20, F - 54 + k * 19, 8, 3, I('#efe6d2')); }
      set(32, F - 30, r[1]); set(33, F - 29, r[1]); rect(9, F - 21, 3, 2, r[1]); // bosses
    });
    shadowUnder(8, 32);
    piece(() => { const k = RP(shadow ? '#6a6a6a' : '#c8ccd0'); rect(12, F - 69, 9, 6, k[2]); rect(13, F - 70, 7, 1, k[3]); rect(12, F - 69, 1, 6, k[3]); rect(21, F - 67, 2, 2, k[1]); rect(15, F - 72, 3, 2, I('#2a2a2a')); rect(10, F - 64, 13, 1, I('#3a3a3a')); });
    for (let k = 0; k < 3; k++) set(17 + (k % 2), F - 75 - k * 2, I('#e8ecee'));
    mug(26, F - 63); mug(32, F - 63, '#c4362c');
    // le portemanteau : ciré jaune et suroît qui gouttent dans une flaque
    piece(() => {
      const w = RP('#5a4632'); rect(46, F - 78, 2, 76, w[2]); rect(46, F - 78, 1, 76, w[3]); rect(41, F - 2, 12, 2, w[1]); rect(43, F - 79, 8, 2, w[3]);
    });
    piece(() => {
      const y = RP('#e8b828');
      poly([[40, F - 70], [54, F - 70], [57, F - 30], [37, F - 30]], y[2]);
      rect(40, F - 70, 4, 40, y[3]); rect(52, F - 68, 3, 38, y[1]); rect(46, F - 70, 2, 38, y[1]);
      for (let k = 0; k < 4; k++) set(49, F - 64 + k * 8, I('#3a3a3a'));
      rect(38, F - 31, 19, 1, y[1]);
      ellipse(47, F - 76, 6, 4, y[2], (px, py) => (px < 46 && py < F - 77 ? y[4] : y[2])); rect(39, F - 74, 17, 2, y[3]); rect(52, F - 73, 5, 2, y[1]); // le suroît
    });
    for (const [dx, dy] of [[39, F - 24], [54, F - 18], [44, F - 10]]) { set(dx, dy, I('#cfe2ea')); set(dx, dy + 1, I('#8fb0c0')); }
    tint(34, F + 1, 26, 3, '#aac4d0', (i, j) => (Math.abs(i - 13) / 13 + j / 3 < 1 ? 0.45 : 0)); // la flaque
    // cartons (ou chariot des méfaits)
    if (!anyEvil) {
      piece(() => { box(62, F - 20, 26, 20, '#b08a5a'); rect(62, F - 13, 26, 2, I('#d9c79a')); rect(66, F - 8, 8, 4, I('#f2efe6')); });
      piece(() => { box(68, F - 34, 20, 14, '#a07a4a'); rect(76, F - 34, 4, 14, I('#d9c79a')); });
      shadowUnder(62, 26);
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
    chair(150, F - 56, F - 30, shadow ? '#5a2a1c' : '#4f6272', { w: 18 });
    chairBase(150, F - 30, '#3a3a3a');
    piece(() => {
      const r = box(104, F - 30, 96, 3, shadow ? '#6a7275' : '#8a9396', { d: 3 });
      rect(106, F - 27, 3, 27, r[1]);
      box(168, F - 27, 30, 27, shadow ? '#5f6668' : '#7f8a8c', { d: 0 });
      for (let k = 0; k < 3; k++) drawer(170, F - 26 + k * 8, 26, 7, shadow ? '#5f6668' : '#7f8a8c', '#c9c9c9');
    });
    shadowUnder(104, 96);
    monitor(112, F - 33, 26, 22, '#d7d2c2', '#21352c', (x, y, w, h) => { for (let j = 0; j < h; j += 2) rect(x, y + j, w, 1, I('#2a4237')); chart(x + 1, y + 2, w - 2, h - 4, shadow ? '#ff4050' : '#7fe08a', 1); });
    piece(() => { const k = RP('#cfc9b8'); rect(114, F - 33, 22, 2, k[2]); rect(114, F - 33, 22, 1, k[3]); });
    papers(142, F - 33, 15);
    if (shadow) whisky(160, F - 33); else mug(162, F - 33, '#2f6fb0');
    phone(178, F - 33);
    piece(() => { rect(190, F - 34, 7, 1, I('#9aa0a6')); rect(191, F - 35, 5, 1, I('#c8ccd0')); set(196, F - 36, I('#e8e0d0')); }); // cendrier
    // le seau sous la fuite
    if (shadow) safe(204, F, 1);
    piece(() => { const b = RP('#8a9aa2'); poly([[232, F - 12], [246, F - 12], [244, F - 1], [234, F - 1]], b[2]); rect(232, F - 12, 14, 1, b[4]); rect(233, F - 11, 2, 9, b[3]); rect(234, F - 11, 10, 1, I('#5a7a8a')); line(232, F - 12, 239, F - 18, b[1]); line(246, F - 12, 239, F - 18, b[1]); });
    shadowUnder(232, 14);
    for (const dy of [top + 4, top + 30, top + 62, F - 40]) if (dy < F - 16) { set(239, dy, I('#cfe2ea')); set(239, dy + 1, I('#9cc0d0')); }
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
    piece(() => { line(306, F - 2, 314, F - 46, I('#b8936a')); line(307, F - 2, 315, F - 46, I('#8a6a46')); for (let k = 0; k < 5; k++) line(303 + k * 2, F - 1, 305 + k, F - 6, I('#d8d0b8')); });
    if (shadow) leopard(110, 250);
  } else if (tier === 1) {
    // ---- Le bureau sur le port : à l'étage de la capitainerie. Chaux blanche, lambris bleu, poutres, une grande
    // fenêtre à petits carreaux sur le port de pêche au petit matin ; bibliothèque, carte marine, baromètre,
    // radio VHF sur le bureau, ventilateur au plafond.
    const top = F > 150 ? 12 : 3, wain = F - 36;
    if (shadow) { grad(L, 0, R - L, wain, ['#3d1620', '#4a1d27', '#521f2b']); damask(L, top, R - L, wain - top, '#c9a24a'); }
    else {
      grad(L, 0, R - L, wain, ['#ebe5d4', '#f0eadb', '#f3eee2']);
      dith(L, 0, R - L, wain, I('#f0eadb'), I('#e4ddca'), (i, j) => (Math.sin(i * 0.09 + Math.sin(j * 0.13) * 2) + Math.sin(j * 0.17 + i * 0.03) > 1.3 ? 0.45 : 0.05)); // la chaux
    }
    const b = RP(shadow ? '#2e1219' : '#4d86a8');
    rect(L, wain, R - L, F - wain, b[2]);
    for (let x = L - ((L % 8) + 8) % 8; x < R; x += 8) { rect(x, wain + 3, 1, F - wain - 7, b[1]); rect(x + 1, wain + 3, 1, F - wain - 7, mixI(b[2], b[3], 0.6)); }
    rect(L, wain - 2, R - L, 3, I(shadow ? '#4a1d27' : '#f6f2e8')); rect(L, wain - 2, R - L, 1, I('#ffffff')); rect(L, wain + 1, R - L, 1, b[0]);
    rect(L, F - 4, R - L, 4, b[1]); rect(L, F - 4, R - L, 1, b[3]);
    // poutres du plafond
    if (top > 3) {
      const w = RP(shadow ? '#2a160e' : '#6b4a2e');
      rect(L, 0, R - L, top - 2, I(shadow ? '#3a1a20' : '#f6f2e8'));
      rect(L, top - 4, R - L, 4, w[2]); rect(L, top - 4, R - L, 1, w[3]); rect(L, top - 1, R - L, 1, w[0]);
      for (let x = L - ((L % 48) + 48) % 48 + 24; x < R; x += 48) { rect(x, 0, 6, top - 4, w[2]); rect(x, 0, 1, top - 4, w[3]); rect(x + 5, 0, 1, top - 4, w[1]); }
    }
    // la grande fenêtre : deux battants à petits carreaux, ouverte sur le port de pêche
    const wx = 126, ww = 120, wy = top + 9, wb = F - 40, wh = wb - wy;
    fishingHarbour(wx, wy, ww, wh, shadow);
    piece(() => {
      const fr = RP(shadow ? '#c9a24a' : '#f8f5ee');
      rect(wx - 4, wy - 4, ww + 8, 4, fr[3]); rect(wx - 4, wb, ww + 8, 3, fr[2]); rect(wx - 4, wy, 4, wh, fr[3]); rect(wx + ww, wy, 4, wh, fr[1]);
      const mid = wx + Math.round(ww / 2); rect(mid - 2, wy, 4, wh, fr[2]); rect(mid - 2, wy, 1, wh, fr[3]); rect(mid + 1, wy, 1, wh, fr[1]);
      rect(wx - 8, wb + 3, ww + 16, 3, fr[4]); rect(wx - 8, wb + 6, ww + 16, 1, fr[1]); // appui
    });
    { // les petits bois, fins et sans contour
      const fr = RP(shadow ? '#c9a24a' : '#f8f5ee'), mid = wx + Math.round(ww / 2);
      for (const [a, c] of [[wx, mid - 2], [mid + 2, wx + ww]]) {
        for (let k = 1; k < 3; k++) { const bx = a + Math.round(((c - a) * k) / 3); rect(bx, wy, 1, wh, fr[3]); }
        for (let k = 1; k < 4; k++) { const by = wy + Math.round((wh * k) / 4); rect(a, by, c - a, 1, fr[3]); rect(a, by + 1, c - a, 1, mixI(get(a, by + 1), DEEP, 0.25)); }
      }
    }
    for (let k = 0; k < Math.min(wh, ww) * 0.4; k++) { const gx = wx + 4 + k, gy = wb - 4 - k * 2; if (gy > wy) set(gx, gy, mixI(get(gx, gy), I('#ffffff'), 0.22)); }
    if (shadow) curtains(wx - 3, wy - 3, ww + 6, wh + 8);
    else tint(wx - 4, wb + 7, ww + 30, F - wb - 7, '#fff1c8', (i, j) => (i > j * 0.9 && i < ww + j * 0.9 ? 0.12 : 0)); // le soleil du matin entre
    // ventilateur au plafond (lustre chez l'armateur de l'ombre)
    if (shadow) chandelier(186, 0, 1);
    else if (top > 3) piece(() => {
      const m = RP('#3a3632'), y = top + 3;
      rect(186, top - 2, 1, 5, m[1]); rect(183, y, 7, 3, m[2]); rect(183, y, 7, 1, m[3]);
      rect(166, y + 1, 17, 1, I('#6b4a2e')); rect(190, y + 1, 17, 1, I('#6b4a2e')); rect(168, y + 2, 12, 1, I('#4a321e')); rect(192, y + 2, 12, 1, I('#4a321e'));
      ellipse(186.5, y + 5, 3, 2, I('#f4ead0')); set(186, y + 4, I('#ffffff'));
    });
    // bibliothèque, bouteille à la mer sur le dessus
    piece(() => books(8, F - 110, 44, 110, 5, shadow ? '#4a2716' : '#7a5434'));
    shadowUnder(8, 44);
    piece(() => { rect(18, F - 117, 22, 6, I('#9fd0c8')); rect(40, F - 116, 4, 3, I('#9fd0c8')); rect(44, F - 116, 2, 3, I('#b8864a')); rect(20, F - 116, 18, 1, I('#e2f2ee')); rect(24, F - 115, 10, 3, I('#4a3020')); rect(28, F - 119, 1, 4, I('#4a3020')); rect(29, F - 118, 3, 2, I('#f6f0e0')); rect(20, F - 112, 18, 1, I('#3a6a8a')); }); // le bateau en bouteille
    piece(() => { const r = RP('#6b4a2e'); rect(20, F - 111, 3, 1, r[2]); rect(36, F - 111, 3, 1, r[2]); });
    // carte marine (routes rouges chez l'armateur de l'ombre)
    framed(60, F - 130, 52, 34, '#5a3c24', () => {
      grad(60, F - 130, 52, 34, ['#b9d6df', '#cfe1e8']);
      for (const [x, y, w, h] of [[64, F - 126, 14, 9], [70, F - 118, 8, 10], [94, F - 128, 14, 12], [90, F - 114, 18, 14]]) ellipse(x + w / 2, y + h / 2, w / 2, h / 2, I('#e9dcb7'), (px, py, d) => (d > 0.75 ? I('#c9b98f') : I('#e9dcb7')));
      if (shadow) redRoutes(60, F - 130, 52, 34);
      else for (let k = 0; k < 12; k++) set(76 + k * 1.3, F - 116 + Math.sin(k * 0.6) * 3, I('#2f6fb0'));
    });
    // baromètre de laiton
    piece(() => { const r = RP('#c9a24a'); ellipse(70, F - 80, 6, 6, r[2], (x, y) => (x < 69 && y < F - 81 ? r[4] : x > 72 ? r[1] : r[2])); ellipse(70, F - 80, 4, 4, I('#f6f0e0')); line(70, F - 80, 72, F - 83, I('#2a2a2a')); set(70, F - 80, I('#c4362c')); rect(69, F - 73, 3, 3, r[1]); });
    // plaque de la compagnie
    sign(94, F - 92, 20, shadow ? '#c9a24a' : '#8a6440');
    // gramophone sur son guéridon (sur le coffre-fort chez l'armateur de l'ombre)
    const gx = 80, gTop = shadow ? F - 28 : F - 24;
    if (shadow) safe(68, F, 1);
    else { piece(() => { const r = RP('#7a5434'); ellipse(gx, gTop + 1, 17, 2.5, r[3]); rect(gx - 17, gTop + 2, 35, 2, r[2]); rect(gx - 1, gTop + 4, 3, F - gTop - 6, r[2]); rect(gx - 8, F - 2, 17, 2, r[1]); }); shadowUnder(gx - 9, 18); }
    juke(() => {
      piece(() => { const r = RP('#6b4a2e'); rect(gx - 11, gTop - 9, 22, 9, r[2]); rect(gx - 11, gTop - 9, 22, 1, r[4]); rect(gx - 11, gTop - 9, 1, 9, r[3]); rect(gx + 10, gTop - 9, 1, 9, r[1]); rect(gx - 6, gTop - 5, 12, 1, r[1]); ellipse(gx - 2, gTop - 10, 9, 1.5, I('#1b1b1b')); set(gx - 2, gTop - 10, I('#c4362c')); });
      piece(() => { const b2 = RP('#d4a64a'); line(gx + 7, gTop - 11, gx + 10, gTop - 20, b2[1]); line(gx + 8, gTop - 11, gx + 11, gTop - 20, b2[2]); poly([[gx + 9, gTop - 20], [gx + 12, gTop - 20], [gx + 26, gTop - 38], [gx + 14, gTop - 44]], b2[2]); poly([[gx + 9, gTop - 20], [gx + 10, gTop - 21], [gx + 15, gTop - 43], [gx + 14, gTop - 44]], b2[4]); ellipse(gx + 20, gTop - 41, 7, 3, b2[1]); ellipse(gx + 20, gTop - 41, 5, 1.6, I('#5a3a12')); });
    });
    // bureau de chêne, fauteuil de capitaine
    chair(162, F - 56, F - 30, shadow ? '#5a1420' : '#8a5a34', { w: 20, studs: shadow ? '#d9b46a' : null });
    chairBase(162, F - 30, '#4a4540');
    piece(() => {
      const wood = shadow ? '#4a2716' : '#9a6a42';
      box(112, F - 30, 100, 4, wood, { d: 3 });
      box(114, F - 26, 28, 26, wood, { d: 0 }); box(182, F - 26, 28, 26, wood, { d: 0 });
      for (let k = 0; k < 3; k++) { drawer(116, F - 25 + k * 8, 24, 7, wood); drawer(184, F - 25 + k * 8, 24, 7, wood); }
      rect(142, F - 26, 40, 12, RP(wood)[1]);
    });
    shadowUnder(112, 100);
    // sur le bureau : la radio VHF et son combiné, les jumelles, le livre de bord, le téléphone, le café
    piece(() => { const k = RP('#2c3034'); rect(118, F - 40, 24, 10, k[2]); rect(118, F - 40, 24, 1, k[3]); rect(118, F - 40, 1, 10, k[3]); rect(120, F - 38, 10, 4, I(shadow ? '#ff9a50' : '#9ad08a')); for (let i = 0; i < 4; i++) set(121 + i * 2, F - 36, I('#24402a')); for (let i = 0; i < 3; i++) ellipse(134 + i * 3, F - 35.5, 1, 1, I('#9aa0a6')); rect(120, F - 32, 20, 1, k[1]); });
    piece(() => { const k = RP('#1c1c1e'); rect(144, F - 38, 4, 7, k[2]); rect(144, F - 38, 1, 7, k[3]); line(145, F - 31, 147, F - 30, k[1]); });
    for (let i = 0; i < 6; i++) set(146 + i, F - 31 + (i % 2), I('#2a2a2e')); // le cordon en tire-bouchon
    piece(() => { const k = RP('#2a2a2a'), c = RP('#c9a24a'); rect(154, F - 36, 5, 5, k[2]); rect(160, F - 36, 5, 5, k[2]); rect(158, F - 35, 3, 2, c[2]); rect(154, F - 36, 5, 1, c[3]); rect(160, F - 36, 5, 1, c[3]); });
    piece(() => { rect(170, F - 33, 18, 3, I('#2f4a6a')); rect(170, F - 33, 18, 1, I('#4a6a8a')); rect(171, F - 31, 16, 1, I('#f2eee2')); });
    if (shadow) whisky(192, F - 33); else phone(192, F - 33, '#1c1c1c');
    mug(204, F - 33, '#f2efe6');
    // la bouée de sauvetage accrochée près de la fenêtre
    piece(() => {
      const cx = 262, cy = F - 60;
      ellipse(cx, cy, 9, 9, I('#f2efe6'), (x, y) => {
        const d = Math.hypot(x - cx, y - cy); if (d < 5) return 0;
        const a = Math.atan2(y - cy, x - cx), red = Math.floor(((a + Math.PI) / (Math.PI / 2)) + 0.5) % 2 === 0;
        const c = RP(red ? '#c4362c' : '#f2efe6'); return x < cx - 2 && y < cy ? c[3] : x > cx + 3 && y > cy ? c[1] : c[2];
      });
      rect(cx, cy - 12, 1, 3, I('#3a3a3a'));
    });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; set(Math.round(262 + Math.cos(a) * 10), Math.round(F - 60 + Math.sin(a) * 10), I('#c8b88a')); }
    // étagères des records
    for (const sy of [-84, -112]) piece(() => { const r = RP(shadow ? '#4a2716' : '#8a6440'); rect(262, F + sy, 56, 3, r[2]); rect(262, F + sy, 56, 1, r[4]); rect(266, F + sy + 3, 2, 5, r[1]); rect(312, F + sy + 3, 2, 5, r[1]); });
    if (anyEvil) {
      piece(() => { const r = box(266, F - 26, 44, 3, '#2a1d14', { d: 2 }); rect(268, F - 23, 2, 23, r[1]); rect(306, F - 23, 2, 23, r[1]); rect(266, F - 8, 44, 2, r[2]); });
      shadowUnder(266, 44);
    } else if (shadow) bust(296, F, 1);
    else { plant(298, F, 1.25); shadowUnder(290, 16); }
    // tapis de chiffons rayé (léopard chez l'armateur de l'ombre)
    if (shadow) leopard(100, 230);
    else for (let y = F + 2; y < H; y++) for (let x = 104; x < 224; x++) set(x, y, Math.floor((x - 104) / 6) % 3 === 0 ? I('#f2ede0') : Math.floor((x - 104) / 6) % 3 === 1 ? I('#3d6f9a') : (x + y) % 3 ? I('#6a9cbc') : I('#5a8cac'));
  } else if (tier === 2) {
    // ---- Le siège de la compagnie : murs bleu marine, boiseries de noyer, grande baie sur l'entrée du port
    // (couchant ; la nuit, le phare tourne), longue-vue, radiogramme, vitrine des records.
    const top = F > 150 ? 10 : 3, wain = F - 44;
    const wallC = shadow ? ['#2a0f16', '#33131b', '#3a1620'] : ['#1f3350', '#243a5a', '#294163'];
    grad(L, 0, R - L, wain, wallC);
    if (shadow) damask(L, 0, R - L, wain, '#c9a24a');
    else for (let x = L - ((L % 8) + 8) % 8; x < R; x += 8) dith(x, top, 1, wain - top, I(wallC[1]), I(mix(wallC[1], '#ffffff', 0.06)), 0.5); // tenture rayée
    // plafond à caissons
    if (top > 3) { const c = RP(shadow ? '#3a2416' : '#5a3a24'); rect(L, 0, R - L, top, c[2]); rect(L, top - 2, R - L, 1, c[3]); rect(L, top - 1, R - L, 1, c[0]); for (let x = L - ((L % 40) + 40) % 40; x < R; x += 40) rect(x, 0, 2, top - 2, c[1]); }
    // boiseries basses de noyer, filet de laiton
    const nut = RP(shadow ? '#3a2014' : '#5e3a22');
    rect(L, wain, R - L, F - wain, nut[2]);
    rect(L, wain - 3, R - L, 3, nut[3]); rect(L, wain - 3, R - L, 1, nut[4]); rect(L, wain, R - L, 1, I('#c9a24a'));
    for (let x = L - ((L % 40) + 40) % 40; x < R; x += 40) {
      rect(x + 4, wain + 6, 32, F - wain - 14, nut[1]); rect(x + 5, wain + 7, 30, F - wain - 16, nut[2]);
      rect(x + 5, wain + 7, 30, 1, nut[3]); rect(x + 5, wain + 7, 1, F - wain - 16, nut[3]);
    }
    rect(L, F - 4, R - L, 4, nut[0]); rect(L, F - 4, R - L, 1, nut[1]);
    // la baie : trois grands carreaux, dormant de noyer, appui de laiton
    const wx = 104, ww = 210, wy = top + 8, wh = wain - 8 - wy;
    harbourMouth(wx, wy, ww, wh, shadow);
    piece(() => {
      const r = nut;
      rect(wx - 5, wy - 5, ww + 10, 5, r[3]); rect(wx - 5, wy - 5, ww + 10, 1, r[4]);
      rect(wx - 5, wy, 5, wh, r[3]); rect(wx + ww, wy, 5, wh, r[1]);
      for (const k of [1, 2]) { const bx = wx + Math.round((ww * k) / 3) - 2; rect(bx, wy, 4, wh, r[2]); rect(bx, wy, 1, wh, r[3]); }
      rect(wx, wy + Math.round(wh * 0.24), ww, 2, r[2]); // imposte
      const b = RP('#c9a24a'); rect(wx - 8, wy + wh, ww + 16, 3, b[3]); rect(wx - 8, wy + wh, ww + 16, 1, b[4]); rect(wx - 8, wy + wh + 3, ww + 16, 1, b[1]);
    });
    for (let k = 0; k < 18; k++) { const gx = wx + 8 + k, gy = wy + wh - 6 - k * 2; if (gy > wy) set(gx, gy, mixI(get(gx, gy), I('#ffffff'), 0.22)); } // reflet
    if (shadow) curtains(wx - 4, wy - 4, ww + 8, wh + 10);
    // mur de gauche : demi-coque sur sa plaque (portrait du patron chez l'armateur de l'ombre), trois horloges
    if (F > 150) { if (shadow) portrait(30, F - 128, 34, 40); else halfHull(12, F - 112, 80); } // sous la plaque de laiton
    for (let k = 0; k < 3; k++) worldClock(28 + k * 24, F - 70, k);
    // éclairage : lustre (ombre) ou appliques de laiton
    if (shadow) chandelier(209, 0, 1.2);
    else for (const x of [6, 96]) sconce(x, F - 92);
    // radiogramme de noyer (le juke-box de l'étage)
    juke(() => radiogram(6, F));
    shadowUnder(6, 62);
    // table des méfaits ou globe
    if (anyEvil) { piece(() => { const r = box(72, F - 26, 34, 3, '#1d1916', { d: 2 }); rect(73, F - 23, 2, 23, r[1]); rect(103, F - 23, 2, 23, r[1]); rect(72, F - 8, 34, 2, r[2]); }); shadowUnder(72, 34); }
    else if (shadow) safe(76, F, 1);
    else globe(88, F);
    // bureau des associés : noyer, cuir vert, écusson sur le panneau avant ; fauteuil à oreilles en cuir fauve
    chair(178, F - 74, F - 32, shadow ? '#5a1420' : '#9a5a2e', { wing: true, studs: '#d9b46a', w: 26, tuft: 'buttons' });
    piece(() => {
      const wood = shadow ? '#3a2014' : '#5a3620';
      const r = box(118, F - 32, 120, 5, wood, { d: 4 });
      rect(120, F - 36, 116, 2, I(shadow ? '#5a1420' : '#2f5a3e')); rect(120, F - 36, 116, 1, I(shadow ? '#7a2434' : '#4a7a58'));
      box(122, F - 27, 112, 23, wood, { d: 0 });
      for (const x of [126, 202]) drawer(x, F - 25, 28, 8, wood);
      rect(124, F - 4, 6, 4, r[1]); rect(226, F - 4, 6, 4, r[1]);
      rect(122, F - 27, 112, 1, I('#c9a24a'));
    });
    sign(168, F - 25, 20, '#c9a24a');
    shadowUnder(118, 120);
    lampGreen(124, F - 36);
    shipModel(140, F - 36, 50);
    papers(196, F - 36, 13);
    if (shadow) whisky(212, F - 36); else phone(214, F - 36, '#2a2a2a');
    // longue-vue de laiton sur trépied, braquée sur la passe
    telescope(248, F);
    // vitrine haute des records
    piece(() => {
      const r = box(262, F - 76, 52, 76, shadow ? '#2a160e' : '#4a2c18', { d: 3 });
      rect(265, F - 73, 46, 54, I('#1e1410'));
      grad(266, F - 72, 44, 52, shadow ? ['#3a2a1e', '#2a1e16'] : ['#5a4a3a', '#3a2e24']);
      for (const sy of [-47, -21]) { rect(265, F + sy, 46, 2, I('#d8e6ea')); rect(265, F + sy + 2, 46, 1, I('#8fa9b2')); }
      for (let k = 0; k < 2; k++) drawer(265 + k * 23, F - 17, 23, 15, shadow ? '#2a160e' : '#4a2c18');
    });
    for (let k = 0; k < 20; k++) set(268 + k, F - 24 - k * 2, mixI(get(268 + k, F - 24 - k * 2), I('#ffffff'), 0.18));
    shadowUnder(262, 52);
    if (shadow) { bust(288, F - 79, 0.8); leopard(110, 250); } else persian(112, 246);
  } else if (tier === 3) {
    // ---- L'étage de direction : haut dans une tour, les gratte-ciel et la mer plus loin. Acajou verni filé d'or,
    // velours bleu roi capitonné, stores bateau bleus à franges, juke-box d'acajou aux néons bleus, écussons d'or.
    const top = F > 150 ? 12 : 3;
    const mh = RP(shadow ? '#4a1a12' : '#7a3020'), gold = RP('#d9b25a');
    // plafond : bandeau bleu roi passepoilé d'or, spots
    rect(L, 0, R - L, F, mh[2]);
    if (top > 3) { const b = RP('#1e3f8f'); rect(L, 0, R - L, top - 2, b[2]); rect(L, top - 4, R - L, 1, b[3]); rect(L, top - 2, R - L, 2, gold[2]); rect(L, top - 2, R - L, 1, gold[4]); for (let x = L - ((L % 36) + 36) % 36 + 18; x < R; x += 36) { set(x, 2, I('#fff6dc')); glow(x, 3, 7, '#fff6dc', 0.25); } }
    // rien que des baies, d'un bord à l'autre : cadres et meneaux d'acajou filés d'or, main courante chromée, stores bateau
    const wy = top + 4, wb = F - 6, ex0 = L + 2, ex1 = R - 7;
    cityView(ex0, wy, ex1 - ex0 + 5, wb - wy, shadow);
    const posts = [ex0];
    for (let x = 22 - 80 * 4; x < R; x += 80) if (x > ex0 + 20 && x < ex1 - 20) posts.push(x);
    posts.push(ex1);
    rect(L, wb, R - L, F - wb, mh[0]); rect(L, wb, R - L, 1, gold[2]); // plinthe
    const rail = RP('#c4ccd4');
    rect(ex0, F - 32, ex1 - ex0, 2, rail[3]); rect(ex0, F - 32, ex1 - ex0, 1, rail[4]); rect(ex0, F - 19, ex1 - ex0, 1, rail[2]);
    for (let k = 0; k + 1 < posts.length; k++) {
      const x = posts[k] + 5, w = posts[k + 1] - x;
      for (let q = 1; q < 3; q++) { const px = x + Math.round((w * q) / 3); rect(px, F - 30, 1, wb - F + 30, rail[1]); }
      for (let i = 0; i < 22; i++) { const gx = x + 6 + i, gy = F - 40 - i * 2; if (gy > wy + 12) set(gx, gy, mixI(get(gx, gy), I('#ffffff'), 0.18)); } // reflet
    }
    for (const x of posts) piece(() => { rect(x, wy - 1, 5, wb - wy + 1, mh[2]); rect(x + 1, wy - 1, 1, wb - wy + 1, mh[3]); rect(x, wy - 1, 1, wb - wy + 1, gold[3]); rect(x + 4, wy - 1, 1, wb - wy + 1, gold[1]); });
    if (L < ex0) rect(L, wy - 1, ex0 - L, wb - wy + 1, mh[1]);
    if (ex1 + 5 < R) rect(ex1 + 5, wy - 1, R - ex1 - 5, wb - wy + 1, mh[1]);
    for (let k = 0; k + 1 < posts.length; k++) valance(posts[k] + 4, wy - 1, posts[k + 1] - posts[k] - 3, shadow);
    if (shadow) { curtains(ex0 + 8, wy, ex1 - ex0 - 11, wb - wy - 2); chandelier(182, 0, 1.2); }
    // juke-box d'acajou aux néons bleus
    glow(24, F - 34, 26, shadow ? '#ffb040' : '#7ab8ff', 0.22);
    juke(() => jukeLux(5, F));
    shadowUnder(5, 38);
    // table des méfaits, coffre plein (ombre) ou bergère de velours bleu
    if (anyEvil) { piece(() => { const r = box(56, F - 26, 34, 3, '#1d1916', { d: 2 }); rect(57, F - 23, 2, 23, r[1]); rect(87, F - 23, 2, 23, r[1]); rect(56, F - 8, 34, 2, r[2]); rect(56, F - 26, 34, 1, gold[2]); }); shadowUnder(56, 34); }
    else if (shadow) safe(62, F, 1);
    else armchairLux(74, F);
    // le bureau d'acajou verni aux angles arrondis, écussons d'or ; fauteuil capitonné de velours bleu à cadre doré
    chair(182, F - 72, F - 34, shadow ? '#6a1626' : '#1f3f8f', { w: 26, tuft: 'buttons', gilt: '#d9b25a' });
    piece(() => {
      const x = 118, w = 128, y = F - 34;
      for (let j = 0; j < 34; j++) {
        const ins = j > 30 ? 2 : 0;
        for (let i = ins; i < w - ins; i++) {
          const edge = i < 6 || i >= w - 6, rnd = edge ? Math.abs((i < 6 ? 6 - i : i - w + 7) / 6) : 0; // les bouts arrondis
          set(x + i, y + j, rnd > 0.6 ? mh[1] : rnd > 0.25 ? mh[2] : i < w * 0.3 ? mixI(mh[2], mh[3], 0.3) : mh[2]);
        }
      }
      rect(x - 1, y - 4, w + 2, 4, mh[3]); rect(x - 1, y - 4, w + 2, 1, mh[4]); rect(x - 1, y - 1, w + 2, 1, gold[2]); // plateau verni, jonc d'or
      rect(x + 2, y + 2, w - 4, 1, gold[1]); rect(x + 2, F - 4, w - 4, 1, gold[1]);
      for (const px of [x + 8, x + 46, x + 84]) { rect(px, y + 5, 36, 23, mh[1]); rect(px + 1, y + 6, 34, 21, mh[2]); rect(px + 1, y + 6, 34, 1, gold[3]); rect(px + 1, y + 6, 1, 21, gold[3]); rect(px + 34, y + 6, 1, 21, gold[1]); rect(px + 1, y + 26, 34, 1, gold[1]); for (let k = 0; k < 4; k++) line(px + 4 + k * 8, y + 25, px + 10 + k * 8, y + 8, mh[3]); }
      rect(x + 3, F - 2, 6, 2, gold[2]); rect(x + w - 9, F - 2, 6, 2, gold[2]);
    });
    crest(144, F - 17); crest(220, F - 17);
    shadowUnder(118, 128);
    tint(120, F - 38, 124, 3, '#ffffff', (i, j) => (j === 0 && i % 9 < 4 ? 0.25 : 0)); // reflet du verni
    lampGreen(126, F - 38);
    shipModel(150, F - 38, 52);
    piece(() => { rect(210, F - 41, 18, 3, I('#f2eee2')); rect(210, F - 41, 18, 1, I('#ffffff')); rect(211, F - 38, 16, 1, I('#2a3a5a')); }); // le livre de bord
    if (shadow) whisky(232, F - 38); else phone(232, F - 38, '#1c1c1c');
    // vitrine d'acajou des records
    piece(() => {
      const x = 260, w = 54, h = 74;
      rect(x, F - h, w, h, mh[2]); rect(x, F - h - 3, w, 3, mh[3]); rect(x, F - h - 3, w, 1, gold[3]); rect(x, F - h, 1, h, mh[3]); rect(x + w - 1, F - h, 1, h, mh[1]);
      rect(x + 3, F - h + 3, w - 6, 52, I('#2a1610'));
      grad(x + 4, F - h + 4, w - 8, 50, shadow ? ['#3a2a1e', '#2a1e16'] : ['#4a3a4a', '#2e2430']);
      for (const sy of [-47, -21]) { rect(x + 3, F + sy, w - 6, 2, I('#d8e6ea')); rect(x + 3, F + sy + 2, w - 6, 1, I('#8fa9b2')); }
      rect(x + 3, F - h + 3, w - 6, 1, gold[3]); rect(x + 3, F - 19, w - 6, 1, gold[2]);
      for (let k = 0; k < 2; k++) { drawer(x + 3 + k * 24, F - 17, 24, 15, shadow ? '#4a1a12' : '#7a3020', '#d9b25a'); }
    });
    for (let k = 0; k < 20; k++) set(266 + k, F - 24 - k * 2, mixI(get(266 + k, F - 24 - k * 2), I('#ffffff'), 0.18));
    shadowUnder(260, 54);
    if (shadow) { bust(287, F - 77, 0.8); leopard(110, 250); }
  } else {
    // ---- La tour de verre : au-dessus des nuages. Plus de bois (choix du propriétaire) : piliers de marbre blanc,
    // mur-rideau d'acier, bureau monolithe de marbre noir, lustre de points de lumière, niches creusées dans le marbre.
    // Chez l'armateur de l'ombre : marbre noir veiné d'or, rideaux de velours, lustres de cristal, buste, coffre.
    const top = F > 150 ? 8 : 3, base = F - 4, px0 = 46, px1 = 254;
    aboveClouds(L, top, R - L, base - top, shadow);
    // mur-rideau : cadre et meneaux d'acier graphite
    const st = RP('#3a3e46');
    for (const x of [px0, 116, 184, px1 - 3]) { rect(x, top, 3, base - top, st[2]); rect(x, top, 1, base - top, st[4]); rect(x + 2, top, 1, base - top, st[1]); }
    for (const x of [px0 + 8, 124, 192]) for (let k = 0; k < 30; k++) { const gx = x + k, gy = base - 8 - k * 3; if (gy > top + 4) { set(gx, gy, mixI(get(gx, gy), I('#ffffff'), 0.16)); set(gx + 1, gy, mixI(get(gx + 1, gy), I('#ffffff'), 0.08)); } } // reflets
    // piliers de marbre, éclairés par le haut
    marbleWall(L, top, px0 - L, base - top, shadow);
    marbleWall(px1, top, R - px1, base - top, shadow);
    rect(px0 - 1, top, 1, base - top, I(shadow ? '#060507' : '#b8b4ae')); rect(px1, top, 1, base - top, I(shadow ? '#060507' : '#b8b4ae'));
    // plafond noir, spots ; plinthe d'acier
    if (top > 3) { const c = RP('#1c1d22'); rect(L, 0, R - L, top, c[2]); rect(L, top - 1, R - L, 1, c[0]); for (let x = L - ((L % 40) + 40) % 40 + 20; x < R; x += 40) { rect(x - 2, top - 2, 5, 1, I('#fff6dc')); glow(x, top + 1, 9, '#fff6dc', 0.22); } }
    rect(L, base, R - L, 4, st[1]); rect(L, base, R - L, 1, st[4]);
    if (shadow) { curtains(px0 + 4, top + 4, px1 - px0 - 8, base - top - 6); chandelier(110, top, 1.1); chandelier(222, top, 1.1); }
    else if (F > 150) lightCluster(166, top, 20);
    // piano à queue (le juke-box de la tour)
    juke(() => grandPiano(4, F));
    shadowUnder(2, 70, F, 3, 0.5);
    // table des méfaits, coffre plein (ombre) ou figuier
    if (anyEvil) { piece(() => { const r = box(76, F - 26, 34, 3, '#0d0d10', { d: 2 }); rect(77, F - 23, 2, 23, r[1]); rect(107, F - 23, 2, 23, r[1]); rect(76, F - 8, 34, 2, r[2]); rect(76, F - 26, 34, 1, I('#c9a24a')); }); shadowUnder(76, 34); }
    else if (shadow) safe(80, F, 1);
    else ficus(93, F);
    // fauteuil de cuir noir sur piètement chromé, derrière un monolithe de marbre noir
    chair(166, F - 70, F - 34, shadow ? '#6a1626' : '#26262c', { w: 20, tuft: 'pads', arms: true, rails: '#c4ccd4' });
    neroBlock(110, F - 34, 112, 34, shadow);
    tint(110, F, 112, 6, '#000000', (i, j) => 0.3 * (1 - j / 6)); // reflet sur le marbre poli
    chromeLamp(118, F - 37);
    shipModel(134, F - 37, 46);
    vitrine(132, F - 37, 50, 26);
    blotter(186, F - 37);
    if (shadow) whisky(202, F - 37); else phone(206, F - 37, '#1c1c1c');
    // hélice de bronze (buste d'or chez l'armateur de l'ombre)
    if (shadow) bust(239, F, 1.15); else propeller(239, F);
    // niches éclairées creusées dans le pilier de marbre
    for (const [sy, nh] of [[-68, 24], [-41, 24]]) {
      const ny = F + sy, fr = RP(shadow ? '#c9a24a' : '#c4ccd4');
      grad(261, ny, 50, nh, shadow ? ['#6a4a1e', '#4a3214', '#2e1e0c'] : ['#fff6e0', '#f0e2c4', '#d8c8a8']);
      tint(261, ny, 50, 4, '#000000', (i, j) => 0.3 * (1 - j / 4)); // profondeur de la niche
      rect(261, ny + nh - 2, 50, 2, I(shadow ? '#2a2420' : '#f4f2ee')); rect(261, ny + nh - 2, 50, 1, I(shadow ? '#5a4a2a' : '#ffffff'));
      rect(260, ny - 1, 52, 1, fr[3]); rect(260, ny + nh, 52, 1, fr[1]); rect(260, ny - 1, 1, nh + 1, fr[3]); rect(311, ny - 1, 1, nh + 1, fr[1]);
      for (let i = 0; i < 50; i += 12) glow(267 + i, ny + 1, 6, '#fff8e0', 0.25);
    }
    if (shadow) leopard(100, 250);
  }

  // ---------- Trophées et méfaits ----------
  // Exprès plus fins que la pièce (choix du propriétaire) : dessinés S fois plus fin, un pixel du trophée pour un
  // pixel de l'écran, sur une couche à part (hi) posée par-dessus la pièce ; seule leur ombre reste dans la pièce.
  const honours = [];
  if (held) {
    const slots = SLOTS[tier];
    const place = (kind, ids, list) => ids.forEach((id) => {
      const k = (kind === 'evil' ? EVIL_IDS : RECORD_IDS).indexOf(id), sl = list[k];
      if (!sl) return;
      const s = honourSprite(kind, id, Math.round(sl.h * S));
      if (!s) return;
      const wa = s.w / S;
      tint(Math.round(sl.x - wa / 2), F + sl.b, Math.ceil(wa), 1, DEEP, 0.4);
      honours.push({ s, X: Math.round((sl.x + ox) * S - s.w / 2), Y: (F + sl.b) * S - s.h });
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
  let hi = null;
  if (honours.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { s, X, Y } of honours) { x0 = Math.min(x0, X - 1); y0 = Math.min(y0, Y - 1); x1 = Math.max(x1, X + s.w + 1); y1 = Math.max(y1, Y + s.h + 1); }
    x0 = Math.floor(x0 / S) * S; y0 = Math.floor(y0 / S) * S; x1 = Math.ceil(x1 / S) * S; y1 = Math.ceil(y1 / S) * S; // calé sur la grille de la pièce
    const hw = x1 - x0, hh = y1 - y0, hb = new Uint32Array(hw * hh);
    for (const { s, X, Y } of honours) {
      const ox2 = X - x0, oy2 = Y - y0, at = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h ? 0 : s.px[y * s.w + x]);
      for (let y = -1; y <= s.h; y++) for (let x = -1; x <= s.w; x++) {
        const c = at(x, y), X2 = ox2 + x, Y2 = oy2 + y;
        if (X2 < 0 || Y2 < 0 || X2 >= hw || Y2 >= hh) continue;
        if (c) { hb[Y2 * hw + X2] = c; continue; }
        const dn = at(x, y + 1), up = at(x, y - 1), rt = at(x + 1, y), lf = at(x - 1, y), nb = dn || rt || up || lf; // cerne fin
        if (nb && !hb[Y2 * hw + X2]) hb[Y2 * hw + X2] = outlineOf(nb, (dn || rt) && !up && !lf);
      }
    }
    hi = { x: x0 / S, y: y0 / S, w: hw / S, h: hh / S, img: toImage(hb, hw, hh) };
  }
  const TILE = 16, fl = new Uint32Array(W * TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < W; x++) fl[y * W + x] = floorFill(x - ox, H - F + y);
  return { room: toImage(room, W, H), floor: toImage(fl, W, TILE), juke: jukeOut, hi, F, ox };

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
  2: (x, y) => herringbone(x, y, '#8a5a36'), // parquet de chêne en chevrons
  3: (x, y) => { // moquette bleu roi marbrée de clair
    const v = Math.abs(Math.sin((x * 0.5 + y) * 0.11 + 2 * Math.sin(x * 0.045 + y * 0.21) + Math.sin(x * 0.13) * 0.6));
    return v < 0.03 ? I('#8aa2c8') : v < 0.14 ? I('#3e5e94') : bay(x & 1023, y) < 0.15 ? I('#2e4c82') : I('#28457a');
  },
  4: (x, y) => lightMarble(x, y), // marbre blanc veiné, filet de laiton
  shadow1: (x, y) => planks(x, y, '#3a2418', 5, 72),
  shadow2: (x, y) => marble(x, y),
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
// Chevrons : bandes de 8 colonnes, lames à 45° alternées, chaque lame son ton.
function herringbone(x, y, base) {
  const r = RP(base), band = Math.floor(x / 8), u = ((x % 8) + 8) % 8, d = band % 2 ? u + y : u - y + 64, lame = Math.floor(d / 4);
  if (u === 0 || ((d % 4) + 4) % 4 === 0) return r[1];
  const tone = (((lame * 7 + band * 3) % 5) + 5) % 5;
  return tone === 0 ? mixI(r[2], r[3], 0.5) : tone === 3 ? mixI(r[2], r[1], 0.35) : bay(x & 1023, y) < 0.08 ? r[3] : r[2];
}
function lightMarble(x, y) {
  if (y % 16 === 6) return I('#c9a24a');
  const v = Math.sin(x * 0.04 + Math.sin(y * 0.35 + x * 0.013) * 2.4 + y * 0.22);
  if (Math.abs(v) < 0.04) return I('#a8a29a');
  if (Math.abs(v) < 0.1) return I('#cfc8be');
  return (((x >> 5) + (y >> 4)) % 2) ? I('#ece6dc') : I('#e6dfd4');
}
function marble(x, y) {
  const v = Math.sin(x * 0.045 + Math.sin(y * 0.4 + x * 0.01) * 2.2 + y * 0.25);
  if (Math.abs(v) < 0.035) return I('#5d5560');
  if (Math.abs(v) < 0.09) return I('#2c2630');
  return ((x >> 5) + (y >> 3)) % 2 ? I('#1d181f') : I('#1a161c');
}
