// Navires dessinés en pixel art, vus de trois quarts (un peu d'en haut : on voit le pont,
// le dessus des cales et des piles de conteneurs). Deux styles, au choix du joueur (menu ☰) :
//  fine   : pixels fins, 5 tons par matière, contours colorés sélectifs, plus de détails ;
//  chunky : gros pixels, 3 tons, contour encré partout (esprit fin des années 80).
// Tout se calcule depuis SHIP_ART (shipart.js) : dimensions en mètres, livrée, apparaux.
// La livrée ne change jamais de couleur : l'âge et l'état se voient à la rouille, aux coulures,
// aux bosses, à la peinture arrachée et à la fumée noire. La compagnie n'apparaît que sur la
// cheminée (sa couleur et son emblème).
//
// Dans l'interface, shipMarkup() (shipart.js) rend un <span class="px-ship"> ; ce module y pose un canevas dès
// que l'élément est affiché, à sa taille, avec un nombre entier de pixels d'écran par pixel
// du dessin (net à 125 % ou 150 %). Seul le grand cadre (inspection, achat) s'anime.
import { SHIP_ART } from './shipshapes.js';
import { logoMarkup, emblemInk } from './logos.js';
import { pixelRatio } from './scale.js';
import { reducedMotion as reduceMotion } from './motion.js';
import { KEYS, read, write } from './storage.js';

// ---------- Réglage du joueur ----------
let style = null;
export function shipStyle() {
  if (style) return style;
  style = read(KEYS.shipStyle) === 'chunky' ? 'chunky' : 'fine';
  return style;
}
export function setShipStyle(s) {
  style = s === 'chunky' ? 'chunky' : 'fine';
  write(KEYS.shipStyle, style);
  cache.clear();
  repaintAll();
}

// ---------- Outils ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
export function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hexCache = new Map();
const hex = (h) => {
  let v = hexCache.get(h);
  if (!v) { v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); hexCache.set(h, v); }
  return v;
};
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, k) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * k)); };
const luma = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// Cinq tons par matière : ombre profonde, ombre, ton propre, lumière, reflet.
export function ramp(base) {
  if (luma(base) > 0.8) return [mix(base, '#1c2a33', 0.5), mix(base, '#1c2a33', 0.3), base, mix(base, '#ffffff', 0.55), '#fffdf7'];
  return [mix(base, '#0b1218', 0.62), mix(base, '#101820', 0.34), base, mix(base, '#fff6e0', 0.24), mix(base, '#fffaf0', 0.48)];
}
const INK = '#121b21';
// Couleur → entier pour ImageData (ordre mémoire RGBA, petit-boutiste).
const intCache = new Map();
const toInt = (h) => {
  let v = intCache.get(h);
  if (v === undefined) { const [r, g, b] = hex(h); v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; intCache.set(h, v); }
  return v;
};
const mixInt = (a, b, k) => {
  const r = (a & 255) + (((b & 255) - (a & 255)) * k), g = ((a >>> 8) & 255) + ((((b >>> 8) & 255) - ((a >>> 8) & 255)) * k);
  const bl = ((a >>> 16) & 255) + ((((b >>> 16) & 255) - ((a >>> 16) & 255)) * k);
  return ((255 << 24) | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
};

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1; }
  set(x, y, col) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    this.c[y * this.w + x] = col;
    if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
  }
  get(x, y) { x = Math.floor(x); y = Math.floor(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
}
function poly(buf, pts, fn) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(buf.h - 1, Math.ceil(y1)); y++) {
    const cy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) xs.push(a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x <= Math.min(buf.w - 1, Math.floor(xs[i + 1] - 0.5)); x++) { const c = fn(x, y); if (c) buf.set(x, y, c); }
    }
  }
}
function line(buf, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = 0;
  for (;;) {
    buf.set(x0, y0, typeof col === 'function' ? col(x0, y0) : col);
    if ((x0 === x1 && y0 === y1) || ++n > 4000) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// ---------- Palettes fixes ----------
const R5 = {
  white: ramp('#f2efe6'),
  steel: ['#262d33', '#424c54', '#647078', '#8f9aa0', '#c0c7ca'],
  black: ['#0a0e11', '#141a1f', '#1f272d', '#2e383f', '#455159'],
  rust: ['#3a190a', '#5c2910', '#843f1a', '#a6582a', '#c57944'],
  glass: ['#0f1820', '#1b2932', '#2b414e', '#5a8293', '#a6ccd8'],
  orange: ['#64270d', '#9c3f10', '#d45f1b', '#ee8632', '#f9b468'],
  deck: ['#3a1a14', '#55261c', '#723526', '#8c4733', '#a65d45'],
  wood: ['#3d2614', '#5e3c20', '#8a5a32', '#b4875a', '#d2ab7c'],
  tank: ramp('#dfe2dd'),
  pale: ramp('#ecebe4'),
  red: ramp('#c4362c'),
  boiler: ramp('#e3b23c'),
};
// Conteneurs : couleurs de vraies boîtes, un peu sourdes pour ne pas voler la vedette à la cheminée.
const BOXES = ['#a2482f', '#3b6a8c', '#4a7d5c', '#c27a2e', '#7c878d', '#7b4a68', '#c9a443', '#4f7480', '#ddd6c4', '#8a3a2a', '#2f5f63'];
// Ciel et mer : ceux des scènes du jeu (pixel.js, DAY).
const SKY = ['#9fd0e8', '#b3dbee', '#cbe6f2', '#e2f0f5'];
const SEA_FINE = ['#5f9aa5', '#4f8d99', '#3f7f8c', '#356f7d', '#2c5f6d', '#244f5c'];
const SEA_CHUNKY = ['#4f8d99', '#356f7d', '#244f5c'];
const CREST = '#a9d3d6';

// ---------- Police du nom (3 × 5, accents français, chiffres, apostrophe) ----------
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '010101101101010', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010',
  9: '010101011001110', '-': '000000111000000', ' ': '000000000000000', '.': '000000000000010', "'": '010010000000000',
  '’': '010010000000000', '&': '010101010101011', '!': '010010010000010', '?': '110001010000010', ',': '000000000010100',
};
const WIDE = { 'Œ': ['01111', '10100', '10110', '10100', '01111'], 'Æ': ['01111', '10100', '11110', '10100', '10111'] };
const ACCENT = { acute: ['001', '010'], grave: ['100', '010'], circ: ['010', '101'], diaer: ['000', '101'] };
const ACCENTED = {
  'É': ['E', 'acute'], 'È': ['E', 'grave'], 'Ê': ['E', 'circ'], 'Ë': ['E', 'diaer'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'],
  'Ä': ['A', 'diaer'], 'Î': ['I', 'circ'], 'Ï': ['I', 'diaer'], 'Ô': ['O', 'circ'], 'Ö': ['O', 'diaer'], 'Ù': ['U', 'grave'],
  'Û': ['U', 'circ'], 'Ü': ['U', 'diaer'], 'Ÿ': ['Y', 'diaer'], 'Ç': ['C', 'cedil'],
};
// Découpe un nom en glyphes : { rows (lignes de 0/1), w, accent, cedil }.
function nameGlyphs(name) {
  const out = [];
  for (const ch0 of String(name).toUpperCase()) {
    let ch = ch0, accent = null, cedil = false;
    if (WIDE[ch]) { out.push({ rows: WIDE[ch], w: 5 }); continue; }
    if (ACCENTED[ch]) { const [b, a] = ACCENTED[ch]; ch = b; if (a === 'cedil') cedil = true; else accent = a; }
    if (!GLYPHS[ch]) { const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); ch = GLYPHS[base] ? base : ' '; }
    const g = GLYPHS[ch];
    out.push({ rows: [0, 1, 2, 3, 4].map((j) => g.slice(j * 3, j * 3 + 3)), w: 3, accent, cedil });
  }
  return out;
}

// ---------- Pictogrammes de cargaison peints sur la coque ----------
const PICTO = {
  drop: { c: ['#1c2a33'], 7: ['...#...', '..###..', '.#####.', '.#####.', '#######', '.#####.', '..###..'], 5: ['..#..', '.###.', '.###.', '#####', '.###.'] },
  flame: { c: ['#d9541e', '#f0b43a'], 7: ['...#...', '..##...', '..#B#..', '.#BB#..', '.#BBB#.', '##BBB##', '.#####.'], 5: ['..#..', '.##..', '.#B#.', '#BBB#', '.###.'] },
  snow: { c: ['#1f5f8b'], 7: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'], 5: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
  flask: { c: ['#1c2a33', '#2f9c95'], 7: ['..###..', '...#...', '...#...', '..#.#..', '.#BBB#.', '#BBBBB#', '#######'], 5: ['.###.', '..#..', '.#.#.', '#BBB#', '#####'] },
  fruit: { c: ['#e2702a', '#3f7d3a'], 7: ['....BB.', '...B...', '.#####.', '#######', '#######', '#######', '.#####.'], 5: ['...B.', '.###.', '#####', '#####', '.###.'] },
  car: { c: ['#1c2a33'], 7: ['.......', '..###..', '.#...#.', '#######', '#######', '.#...#.', '.......'], 5: ['.###.', '#...#', '#####', '.#.#.', '.....'] },
};

// ---------- Emblème de la compagnie, réduit en pixels pleins ----------
const logoAlpha = new Map(); // id → Uint8Array 64 × 64, 'loading' ou null
function loadLogo(id) {
  if (logoAlpha.has(id) || typeof Image === 'undefined') return;
  logoAlpha.set(id, 'loading');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128" color="#000">${logoMarkup(id)}</svg>`;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data, a = new Uint8Array(4096);
    for (let i = 0; i < 4096; i++) a[i] = d[i * 4 + 3];
    logoAlpha.set(id, a);
    maskCache.clear(); cache.clear(); repaintAll();
  };
  img.onerror = () => logoAlpha.set(id, null);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const maskCache = new Map();
// Masque (lignes de booléens) qui tient dans wMax × hMax en gardant les proportions du dessin.
function emblemMask(id, wMax, hMax) {
  const key = `${id}|${wMax}|${hMax}`;
  if (maskCache.has(key)) return maskCache.get(key);
  const a = logoAlpha.get(id);
  if (!(a instanceof Uint8Array)) { loadLogo(id); return null; }
  let bx0 = 64, by0 = 64, bx1 = -1, by1 = -1;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (a[y * 64 + x] > 60) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  if (bx1 < 0) return null;
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, k = Math.min(wMax / bw, hMax / bh);
  const w = Math.max(1, Math.round(bw * k)), h = Math.max(1, Math.round(bh * k));
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const sx0 = bx0 + (x * bw) / w, sx1 = bx0 + ((x + 1) * bw) / w, sy0 = by0 + (y * bh) / h, sy1 = by0 + ((y + 1) * bh) / h;
      let s = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) { s += a[yy * 64 + xx]; n++; }
      row.push(s / Math.max(1, n) > 100);
    }
    rows.push(row);
  }
  maskCache.set(key, rows);
  return rows;
}

// ---------- Géométrie de la coque (mètres) ----------
const DK = 2.7; // hauteur d'un pont de château
const JIB = 40; // flèche des grues relevée à 40° (en mer)
function cargoEnd(A) {
  let e = 0.86;
  for (const [, b] of A.hatches || []) e = Math.max(e, b);
  if (A.containers) for (const [, b] of A.containers.segments || [[A.containers.from, A.containers.to]]) e = Math.max(e, b);
  if (A.spheres) e = Math.max(e, A.spheres.to);
  if (A.cylinders) e = Math.max(e, A.cylinders.to);
  if (A.tanker || A.chem) e = Math.max(e, 0.93);
  if (A.house && A.house.x > 0.5) e = Math.max(e, A.house.x + A.house.w);
  return Math.min(0.955, e + 0.005);
}
function geometry(A, laden) {
  const L = A.L, B = A.B, draft = laden ? A.T : A.Tb, fb = A.D - draft;
  const sheerAt = (fr) => {
    if (!A.sheer) return 0;
    const t = fr < 0.45 ? (0.45 - fr) / 0.45 : (fr - 0.45) / 0.55;
    return A.sheer * t * t * (fr < 0.45 ? 0.55 : 1);
  };
  const deckAt = (x) => fb + sheerAt(x / L);
  const aft = A.aftHouse || (A.house && A.house.x < 0.14 ? A.house : null);
  const poopEnd = aft ? aft.x + aft.w + 0.01 : 0.12, fcStart = cargoEnd(A);
  const topAt = (x) => {
    const fr = x / L;
    let y = deckAt(x);
    if (A.poop) { if (fr < poopEnd) y += A.poop; else if (fr < poopEnd + 0.006) y += A.poop * (1 - (fr - poopEnd) / 0.006); }
    if (A.fc && fr > fcStart) y += A.fc * Math.min(1, (fr - fcStart) / 0.016);
    return y;
  };
  const STEM = L * (A.box ? 0.035 : A.bow === 'straight' ? 0.06 : A.bow === 'flared' ? 0.058 : 0.049);
  // Demi-largeur du pont (pointu à l'étrave) et à la flottaison (plus fine aux extrémités).
  const half = (x) => {
    const fr = x / L, B2 = B / 2, from = A.box ? 0.88 : 0.8, ex = A.box ? 2.6 : 1.9;
    if (fr > from) return B2 * Math.max(0, 1 - ((fr - from) / (1 - from)) ** ex);
    if (fr < 0.1) return A.stern === 'cruiser' ? B2 * (0.55 + 0.45 * Math.sqrt(fr / 0.1)) : B2 * (0.86 + 0.14 * (fr / 0.1));
    return B2;
  };
  const sternWL = L * (A.stern === 'cruiser' ? 0.045 : 0.02);
  const halfWL = (x) => {
    const fr = x / (L - STEM), B2 = B / 2;
    if (fr >= 1 || x < sternWL) return 0;
    if (fr > 0.74) return B2 * Math.max(0, 1 - ((fr - 0.74) / 0.26) ** 1.5);
    if (fr < 0.14) return B2 * Math.max(0.2, 0.42 + 0.58 * (fr / 0.14));
    return B2;
  };
  const bootTop = Math.max(0.35, A.T + 0.35 - draft);
  return { L, B, draft, fb, deckAt, topAt, half, halfWL, bootTop, STEM, sternWL, fcStart };
}

// Le point le plus haut du navire à vide (mètres), pour cadrer sans rien couper.
function tallest(A, G, hm) {
  const tops = [];
  const L = A.L;
  for (const [hsp, bridge] of [[A.house, true], [A.aftHouse, false]]) {
    if (!hsp) continue;
    const base = G.topAt(L * (hsp.x + hsp.w / 2)), top = base + hsp.decks * DK;
    tops.push(top + (bridge ? 4.8 : 0));
    if (!hsp.noFunnel) tops.push(hsp.style === 'classic' ? base + Math.max(0, hsp.decks - 1) * DK + funnelH(A, hsp) : top + 0.4 + funnelH(A, hsp));
  }
  if (A.funnelTower) tops.push(G.deckAt(L * A.funnelTower.x) + (A.funnelTower.h > 5 ? A.funnelTower.h : 0) + 4.4);
  for (const g of A.gear || []) {
    const base = g.kind === 'mast' ? G.topAt(L * g.x) : G.deckAt(L * g.x);
    if (g.kind === 'crane') tops.push(base + g.h * 0.3 + 1.3 + Math.sin((JIB * Math.PI) / 180) * g.h * 0.725, base + g.h * 0.3 + 4.4);
    else if (g.kind === 'heavy') tops.push(base + g.h * 0.98);
    else tops.push(base + g.h + 0.6);
  }
  if (A.containers) tops.push(G.fb + 1.2 + A.containers.tiers * 2.6);
  if (A.cylinders) tops.push(G.fb + 0.6 + A.cylinders.r * 1.24 + 2.6);
  if (A.chem) tops.push(G.fb + 5.2);
  if (A.tanker) tops.push(G.fb + 9.4);
  let max = Math.max(...tops.map(hm), hm(G.fb + 2));
  if (A.spheres) { const sp = A.spheres, R = Math.min(sp.r, ((sp.to - sp.from) * L) / sp.count * 0.46); max = Math.max(max, hm(G.fb) + R * 1.75); }
  return max;
}
function funnelH(A, hsp) {
  return hsp.style === 'classic' ? Math.max(4.5, Math.min(10, A.L * 0.054)) : 3.6 + A.L * 0.005 + (A.era === 'eighties' ? 0.8 : 0);
}

/**
 * Calque du navire (sans décor), dans un tampon W × H.
 * o : style, W, H, laden, wear (0..1), dmg (0..1), color, logo, name, seed, sky
 */
function buildShip(typeId, o) {
  const A0 = SHIP_ART[typeId] || SHIP_ART.caboteur;
  const A = { ...A0, B: A0.B || A0.L * 0.15 };
  const fine = o.style !== 'chunky';
  const { W, H } = o;
  const laden = !!o.laden, wear = o.wear || 0, dmg = o.dmg || 0;
  const r = rng(o.seed ?? typeId);
  const L = A.L, B = A.B, C = A.livery;
  const G = geometry(A, laden), GE = geometry(A, false);
  const water = Math.max(3, Math.round(H * 0.125));
  const exH = 2.1, ex = 1.6, sinA = 0.22, Href = A.D - A.Tb;
  const hm = (h) => (h <= Href ? h * exH : Href * exH + (h - Href) * ex); // hauteurs exagérées : c'est une illustration
  const C2 = B / 2;
  const vert = Math.max(tallest(A, GE, hm) + 2 + C2 * sinA, hm(GE.fb) + B * sinA + 2);
  const mpp = Math.max(L / (W * 0.93), vert / (H - water - 2));
  const vpm = 1 / mpp, kz = sinA / mpp;
  const x0 = Math.round((W - L / mpp) / 2);
  const WL = H - water;
  const X = (m) => x0 + m / mpp;
  const Y = (h, z = C2) => WL - hm(h) * vpm - z * kz;
  const invH = (e) => (e <= Href * exH ? e / exH : Href + (e - Href * exH) / ex);
  const xmOf = (x) => Math.max(0, Math.min(L, (x + 0.5 - x0) * mpp));
  const nearZ = (x) => C2 - G.half(x);
  const tiny = W < 140; // vignettes : on simplifie
  // Rampes de couleurs : 5 tons (fins) ou 3 tons (gros pixels).
  const T3 = (rmp) => (fine ? rmp : [rmp[1], rmp[1], rmp[2], rmp[3], rmp[3]]);
  const P = {};
  for (const k in R5) P[k] = T3(R5[k]);
  const lv = (c, fallback) => T3(ramp(c || fallback));
  const HULL = lv(C.hull), BOOT = lv(C.boot), HOUSE = lv(C.house, '#f2efe6'), GEAR = lv(C.gear, '#f2efe6');
  const HATCH = lv(C.hatch, '#3d5a4a'), TRIM = C.trim ? lv(C.trim) : null, TRIM2 = C.trim2 ? lv(C.trim2) : null;
  const DECK = A.box ? HOUSE : C.deck ? lv(C.deck) : P.deck;
  const CO = T3(ramp(o.color || '#3e8ef7'));
  const WIRE = fine ? '#39424a' : '#27323a';
  const glass = (k) => P.glass[k];

  // ---------- Pièces : chaque élément a son contour (encre, ou ton sombre de sa matière) ----------
  const sh = new Buf(W, H);
  const outlineCache = new Map();
  const outlineOf = (dark, lightSide) => {
    const key = dark + lightSide;
    let c = outlineCache.get(key);
    if (!c) { c = mix(dark, INK, lightSide ? 0.25 : 0.55); outlineCache.set(key, c); }
    return c;
  };
  const piece = (draw, rk = null, outline = true) => {
    const tmp = new Buf(W, H);
    draw(tmp);
    if (tmp.x1 < 0) return;
    if (outline) {
      for (let y = tmp.y0 - 1; y <= tmp.y1 + 1; y++) for (let x = tmp.x0 - 1; x <= tmp.x1 + 1; x++) {
        if (tmp.get(x, y)) continue;
        const below = tmp.get(x, y + 1), above = tmp.get(x, y - 1), right = tmp.get(x + 1, y), left = tmp.get(x - 1, y);
        if (!(below || above || right || left)) continue;
        sh.set(x, y, fine && rk ? outlineOf(rk[0], (below || right) && !above && !left) : INK);
      }
    }
    for (let y = tmp.y0; y <= tmp.y1; y++) for (let x = tmp.x0; x <= tmp.x1; x++) { const c = tmp.c[y * W + x]; if (c) sh.c[y * W + x] = c; }
  };
  // Boîte vue de trois quarts : face latérale (x1..x2, h0..h1, à la profondeur z) et dessus (profondeur d).
  const box3 = (b, x1, x2, h0, h1, z, d, rp, { roof = 4, wall = 2, edgeL = 3, edgeR = 1, foot = 1, roofEdge = null, top = true } = {}) => {
    const X1 = Math.round(X(x1)), X2 = Math.max(X1, Math.round(X(x2)) - 1);
    const yTop = Math.round(Y(h1, z)), yFoot = Math.max(yTop, Math.round(Y(h0, z)) - 1), yRoof = top ? Math.min(yTop, Math.round(Y(h1, z + d))) : yTop;
    for (let x = X1; x <= X2; x++) {
      for (let y = yRoof; y < yTop; y++) b.set(x, y, y === yRoof && roofEdge != null ? rp[roofEdge] : rp[roof]);
      for (let y = yTop; y <= yFoot; y++) {
        let c = rp[wall];
        if (y === yTop) c = rp[Math.min(4, wall + 1)];
        if (y === yFoot && foot != null && yFoot > yTop) c = rp[foot];
        if (x === X1 && edgeL != null && X2 > X1) c = rp[edgeL];
        if (x === X2 && edgeR != null && X2 > X1) c = rp[edgeR];
        b.set(x, y, c);
      }
    }
    return { X1, X2, yTop, yFoot, yRoof };
  };
  const rust = (b, x, y0, len) => {
    for (let k = 0; k < len; k++) {
      if (!b.get(x, y0 + k)) break;
      if (k > len * 0.5 && bay(x, y0 + k) > 0.5) continue;
      b.set(x, y0 + k, fine ? P.rust[k < 2 ? 1 : k < len * 0.45 ? 2 : 3] : P.rust[k < 2 ? 1 : 2]);
    }
  };

  // ---------- Pont : bande vue d'en haut entre le bord proche et le bord lointain ----------
  piece((b) => {
    const near = [], far = [], step = mpp * 0.5;
    for (let x = 0; x <= L; x += step) { near.push([X(x), Y(G.topAt(x), nearZ(x))]); far.push([X(x), Y(G.topAt(x), C2 + G.half(x))]); }
    poly(b, [...far, ...near.reverse()], (x, y) => {
      const xm = xmOf(x), yf = Y(G.topAt(xm), C2 + G.half(xm));
      if (y < yf + 1) return A.box ? DECK[3] : P.white[3]; // lisse du pavois lointain
      if (fine && y < yf + 2) return DECK[1];
      return fine && !A.box && (x + Math.floor(y / 2)) % 9 === 0 ? DECK[2] : DECK[3];
    });
  }, DECK);
  // Rambarde lointaine.
  const railH = Math.max(2, Math.round(1.05 * vpm * ex));
  if (!A.box && !tiny && vpm > 0.9) {
    piece((b) => {
      for (let x = Math.round(X(0.5)); x <= Math.round(X(G.fcStart * L)); x++) {
        const xm = xmOf(x), yf = Math.round(Y(G.topAt(xm), C2 + G.half(xm)));
        const ry = yf - railH;
        b.set(x, ry, P.white[2]);
        if (x % (fine ? 4 : 3) === 0) for (let y = ry + 1; y < yf; y++) b.set(x, y, P.white[1]);
      }
    }, null, false);
  }

  // ---------- Cheminée aux couleurs de la compagnie ----------
  let funnelTop = null;
  const funnel = (x1, x2, base, h) => piece((b) => {
    const fw = x2 - x1, rake = fw * 0.23, z = C2 - fw * 0.42, d = fw * 0.84, band = base + h - Math.max(0.9, h * 0.16);
    const pts = [[X(x1), Y(base, z)], [X(x2), Y(base, z)], [X(x2 - rake), Y(base + h, z)], [X(x1 - rake * 0.9), Y(base + h, z)]];
    const xl = (ym) => Math.round(X(x1 - rake * 0.9 * ((ym - base) / h))), xr = (ym) => Math.round(X(x2 - rake * ((ym - base) / h))) - 1;
    poly(b, pts, (x, y) => {
      const ym = invH((WL - z * kz - y - 0.5) / vpm);
      const lx = x - xl(ym), rx = xr(ym) - x;
      if (ym > band) return lx <= 0 ? P.black[3] : rx <= 0 ? P.black[0] : P.black[1];
      let c = CO[2];
      if (lx <= (fine ? 1 : 0)) c = CO[lx <= 0 ? 4 : 3]; else if (rx <= (fine ? 1 : 0)) c = CO[rx <= 0 ? 0 : 1];
      if (fine && lx > 1 && rx > 1 && lx <= 3) c = CO[3];
      if (ym > band - 0.35) c = CO[0];
      if (wear > 0.35 && ym > band - (wear - 0.35) * 5 && bay(x, y) < (wear - 0.3) * 1.3) c = P.black[2];
      return c;
    });
    // Dessus : manchette sombre et tuyaux d'échappement.
    const yT = Math.round(Y(base + h, z)), yR = Math.round(Y(base + h, z + d));
    for (let x = xl(base + h) + 1; x < xr(base + h); x++) for (let y = yR; y < yT; y++) b.set(x, y, y === yR ? P.black[3] : P.black[0]);
    const ex1 = xl(base + h) + 1;
    if (!tiny) for (let k = 1; k <= (fine ? 2 : 1); k++) { b.set(ex1, yR - k, P.black[2]); b.set(ex1 + (fine ? 3 : 2), yR - k, P.black[2]); }
    funnelTop = [X((x1 + x2) / 2 - rake), yR - 1];
    // Emblème de la compagnie, en pixels pleins, au milieu de la bande colorée.
    const wPx = xr(base + h * 0.5) - xl(base + h * 0.5) - (fine ? 2 : 1), hPx = Math.round(Y(base + 0.25, z) - Y(band - 0.3, z));
    const M = wPx >= 3 && hPx >= 3 ? emblemMask(o.logo || 'ancre', Math.min(wPx, fine ? 11 : 7), Math.min(hPx, fine ? 9 : 6)) : null;
    if (M) {
      const ink = emblemInk(o.color || '#3e8ef7');
      const cy = (Y(base + 0.25, z) + Y(band - 0.3, z)) / 2, cx = (xl(base + h * 0.5) + xr(base + h * 0.5)) / 2 + 0.5;
      const ax = Math.round(cx - M[0].length / 2), ay = Math.round(cy - M.length / 2);
      M.forEach((row, j) => row.forEach((on, i) => { if (on) b.set(ax + i, ay + j, ink); }));
    }
  }, CO);

  // ---------- Châteaux ----------
  const houses = [];
  const house = (hsp, bridge) => {
    const hx1 = L * hsp.x, hx2 = L * (hsp.x + hsp.w), hw = hx2 - hx1, n = hsp.decks;
    const base = G.topAt((hx1 + hx2) / 2), classic = hsp.style === 'classic', withFunnel = !hsp.noFunnel;
    const levels = [];
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      let x1 = hx1, x2 = hx2, hwf = 0.45;
      if (classic) {
        x1 = hx1 + hw * 0.04 * i; x2 = hx2 - hw * 0.015 * i; hwf = 0.47 - 0.01 * i;
        if (last && bridge && withFunnel && n > 1) { x1 = hx1 + hw * 0.38; hwf -= 0.03; }
      } else if (last && bridge) hwf = 0.47;
      levels.push({ x1, x2, h0: base + i * DK, h1: base + (i + 1) * DK, hwf, last });
    }
    const lvPx = Y(base) - Y(base + DK);
    const windows = (b, q, i, last) => {
      const wy = Math.round((q.yTop + q.yFoot) / 2);
      if (last && bridge) { // passerelle : bandeau vitré
        for (let x = q.X1 + 2; x <= q.X2 - 1; x++) {
          b.set(x, wy, fine ? (x % 4 === 0 ? glass(2) : glass(1)) : glass(1));
          if (fine && q.yFoot - q.yTop > 3) b.set(x, wy + 1, x % 4 === 0 ? glass(3) : glass(0));
        }
        if (fine) for (let x = q.X1 + 4; x < q.X2; x += 8) b.set(x, wy, glass(4));
        return;
      }
      if (lvPx < 2.6 || tiny) return;
      const step = classic ? (fine ? 4 : 3) : (fine ? 3 : 2);
      for (let x = q.X1 + 2; x <= q.X2 - 2; x += step) {
        if (i === 0 && x < q.X1 + 5) continue; // porte
        if (fine && lvPx >= 4) { b.set(x, wy, glass(3)); b.set(x + 1, wy, glass(1)); b.set(x, wy + 1, glass(1)); b.set(x + 1, wy + 1, glass(0)); } else b.set(x, wy, glass(1));
        if (dmg > 0.65 && r() < (dmg - 0.6) * 1.5) b.set(x, wy, '#d8dcd8'); // vitre brisée
        if (wear > 0.3 && r() < wear * 0.55) for (let k = 2; k < 2 + Math.floor(r() * (q.yFoot - wy) * wear * 1.8); k++) if (bay(x, wy + k) < 0.8) b.set(x + (fine ? 1 : 0), wy + k, fine ? P.rust[k < 4 ? 2 : 3] : P.rust[2]);
      }
      if (i === 0 && !tiny) for (let y = wy - 1; y < q.yFoot; y++) { b.set(q.X1 + 2, y, HOUSE[1]); if (fine) b.set(q.X1 + 3, y, HOUSE[1]); }
    };
    const wing = (b, q, x2) => { // aileron de passerelle, qui dépasse vers l'avant
      const ax2 = Math.round(X(x2 + 1.8));
      for (let x = q.X2 + 1; x <= ax2; x++) { b.set(x, q.yTop, HOUSE[4]); b.set(x, q.yTop + 1, HOUSE[1]); }
      for (let y = q.yTop + 2; y <= q.yTop + (fine ? 3 : 2); y++) b.set(ax2, y, HOUSE[1]);
    };
    const fw = classic ? Math.max(3.2, hw * 0.3) : Math.max(3, hw * 0.34);
    let fx1, fbase;
    if (classic && bridge && n > 1) {
      fx1 = levels[n - 2].x1 + Math.max(0.6, hw * 0.04);
      fbase = levels[n - 2].h1;
    } else { fx1 = hx1 + hw * (classic ? 0.25 : 0.06); fbase = base + n * DK + (classic ? 0 : 0.3); }
    const fx2 = Math.min(fx1 + fw, classic && bridge && n > 1 ? levels[n - 1].x1 - 0.4 : hx2);
    if (classic) {
      levels.forEach((l, i) => {
        if (l.last && withFunnel && bridge && n > 1) funnel(fx1, fx2, fbase, funnelH(A, hsp));
        piece((b) => {
          const q = box3(b, l.x1, l.x2, l.h0, l.h1, C2 - B * l.hwf, B * l.hwf * 2, HOUSE, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1, roofEdge: 3 });
          if (fine && q.yFoot - q.yTop > 2) for (let x = q.X1 + 1; x < q.X2; x++) b.set(x, q.yTop + 1, HOUSE[2]);
          windows(b, q, i, l.last);
          if (l.last && bridge) wing(b, q, l.x2);
          if (wear > 0.3) for (let k = 0; k < Math.round(wear * 4); k++) rust(b, q.X1 + 1 + Math.floor(r() * Math.max(1, q.X2 - q.X1 - 1)), q.yTop + 1, Math.round((q.yFoot - q.yTop) * (0.4 + wear * 0.5)));
        }, HOUSE);
      });
    } else {
      // Bloc moderne : ponts identiques, lignes de pont discrètes, passerelle à ailerons.
      piece((b) => {
        const l0 = levels[0], lt = levels[n - 1];
        const q = box3(b, l0.x1, l0.x2, l0.h0, lt.h1, C2 - B * 0.45, B * 0.9, HOUSE, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1, roofEdge: 3 });
        levels.forEach((l, i) => {
          const yl = Math.round(Y(l.h0, C2 - B * 0.45));
          if (i > 0 && lvPx >= 3) for (let x = q.X1 + 1; x < q.X2; x++) b.set(x, yl, HOUSE[fine ? 1 : 1]);
          const qi = { X1: q.X1, X2: q.X2, yTop: Math.round(Y(l.h1, C2 - B * 0.45)), yFoot: yl - 1 };
          windows(b, qi, i, l.last);
          if (l.last && bridge) wing(b, qi, l.x2);
        });
        if (wear > 0.3) for (let k = 0; k < Math.round(wear * 7); k++) rust(b, q.X1 + 1 + Math.floor(r() * Math.max(1, q.X2 - q.X1 - 1)), q.yTop + 1 + Math.floor(r() * Math.max(1, q.yFoot - q.yTop - 2)), Math.round(lvPx * (1 + wear * 2)));
      }, HOUSE);
    }
    if (withFunnel && !(classic && bridge && n > 1)) funnel(fx1, fx2, fbase, funnelH(A, hsp));
    // Mât radar sur le toit de la passerelle.
    if (bridge && !tiny) {
      const lt = levels[n - 1];
      piece((b) => {
        const mx = Math.round(X(lt.x1 + (lt.x2 - lt.x1) * 0.62)), y0 = Math.round(Y(lt.h1, C2)), y1 = Math.round(Y(lt.h1 + 4.6, C2));
        for (let y = y1; y < y0; y++) { b.set(mx, y, P.white[3]); if (fine) b.set(mx + 1, y, P.white[1]); }
        const ry = Math.round(Y(lt.h1 + 3.1, C2));
        for (let x = mx - (fine ? 3 : 2); x <= mx + (fine ? 4 : 2); x++) b.set(x, ry, P.steel[3]);
        if (fine) for (let x = mx - 3; x <= mx + 4; x++) b.set(x, ry + 1, P.steel[1]);
        b.set(mx, y1 - 1, '#f2c14e');
      }, P.steel, fine);
    }
    houses.push({ hsp, hx1, hx2, hw, base, levels });
  };
  if (A.aftHouse) house(A.aftHouse, false);
  if (A.house) house(A.house, true);
  // Tour de cheminée isolée (porte-conteneurs géant, transporteur de voitures).
  if (A.funnelTower) {
    const t = A.funnelTower, x1 = L * t.x, x2 = L * (t.x + t.w), base = A.box ? G.fb : G.deckAt(x1);
    const top = base + (t.h > 5 ? t.h : 0);
    if (t.h > 5) piece((b) => {
      const q = box3(b, x1, x2, base, top, C2 - B * 0.3, B * 0.6, HOUSE, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
      if (!tiny) for (let hh = base + 2.4; hh < top - 1; hh += DK) { const y = Math.round(Y(hh, C2 - B * 0.3)); for (let x = q.X1 + 1; x < q.X2; x += 2) b.set(x, y, glass(1)); }
    }, HOUSE);
    if (A.box) { // deux cheminées jumelles sur le toit
      funnel(x1, x1 + (x2 - x1) * 0.45, top, 4.2);
      funnel(x1 + (x2 - x1) * 0.55, x2, top, 4.2);
    } else funnel(x1 + (x2 - x1) * 0.05, x1 + (x2 - x1) * 0.95, top, 4.2);
  }

  // ---------- Cargaison et pont ----------
  if (A.hatches) {
    for (const [a, z2] of A.hatches) piece((b) => {
      const base = G.deckAt(L * (a + z2) / 2), hw = Math.min(B * 0.36, B / 2 - 2);
      const q = box3(b, L * a, L * z2, base, base + A.hatchH, C2 - hw, hw * 2, HATCH, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1, roofEdge: 4 });
      const pitch = fine ? 3.3 : 6.6;
      if (!tiny) for (let xm = L * a + pitch; xm < L * z2 - 1; xm += pitch) {
        const x = Math.round(X(xm));
        for (let y = q.yRoof + 1; y < q.yTop; y++) b.set(x, y, HATCH[1]);
        for (let y = q.yTop + 1; y < q.yFoot; y++) b.set(x, y, HATCH[1]);
        if (fine) for (let y = q.yRoof + 1; y < q.yTop; y++) b.set(x + 1, y, HATCH[4]);
      }
      if (wear > 0.3) for (let k = 0; k < Math.round(wear * 6); k++) {
        const x = q.X1 + 1 + Math.floor(r() * Math.max(1, q.X2 - q.X1 - 2));
        for (let y = q.yTop + 1; y <= q.yFoot && r() < 0.9; y++) b.set(x, y, P.rust[fine ? 2 + (y % 2) : 2]);
        if (r() < 0.6) b.set(x, q.yRoof + 1 + Math.floor(r() * Math.max(1, q.yTop - q.yRoof - 1)), P.rust[2]);
      }
    }, HATCH);
  }
  // Colis lourds dans la cale ouverte, quand le navire est chargé.
  if (A.project && laden) {
    for (const c of A.project) {
      const x1 = L * c.x, w = L * c.w, base = G.deckAt(x1 + w / 2) + (A.hatchH || 0);
      if (c.kind === 'boiler') {
        piece((b) => {
          const q = box3(b, x1, x1 + w, base + 0.8, base + 0.8 + c.h, C2 - 3, 6, P.boiler, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
          for (let x = q.X1; x <= q.X2; x++) for (let y = q.yRoof; y <= q.yFoot; y++) {
            const f = (y - q.yRoof) / Math.max(1, q.yFoot - q.yRoof);
            if ((x === q.X1 || x === q.X2) && (f < 0.15 || f > 0.85)) b.c[y * W + x] = null; // bouts arrondis
            else if (b.get(x, y)) b.set(x, y, P.boiler[f < 0.2 ? 4 : f < 0.45 ? 3 : f < 0.8 ? 2 : 1]);
          }
          for (const k of [0.25, 0.5, 0.75]) { const x = Math.round(X(x1 + w * k)); for (let y = q.yRoof + 1; y < q.yFoot; y++) b.set(x, y, P.boiler[1]); }
        }, P.boiler);
      } else {
        piece((b) => {
          const q = box3(b, x1, x1 + w, base, base + c.h, C2 - 3.5, 7, P.wood, { roof: 4, wall: 3, edgeL: 3, edgeR: 1, foot: 1 });
          line(b, q.X1 + 1, q.yTop + 1, q.X2 - 1, q.yFoot - 1, P.wood[1]);
          line(b, q.X1 + 1, q.yFoot - 1, q.X2 - 1, q.yTop + 1, P.wood[1]);
        }, P.wood);
      }
    }
  }
  if (A.containers) {
    const c = A.containers;
    const segs = c.segments || [[c.from, c.to], ...(c.aft ? [c.aft] : [])];
    for (const [a, z2] of segs) {
      const xa = L * a, xb = L * z2;
      piece((b) => { const base = G.topAt((xa + xb) / 2); box3(b, xa, xb, base, base + 1.2, C2 - (B / 2 - 0.8), B - 1.6, HATCH, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1 }); }, HATCH);
      const bayL = xb - xa < 12.8 ? 6.3 : 12.8;
      for (let xm = xa; xm + bayL - 0.2 <= xb + 0.1; xm += bayL) {
        const tiers = laden ? c.tiers - (r() < 0.3 ? 1 : 0) : (r() < 0.3 ? 1 : 0);
        if (tiers <= 0) continue;
        const base = G.topAt(xm + bayL / 2) + 1.2, z = C2 - (B / 2 - 1), d = B - 2;
        const cols = Array.from({ length: tiers }, () => BOXES[Math.floor(r() * BOXES.length)]);
        const tops = Array.from({ length: 6 }, () => BOXES[Math.floor(r() * BOXES.length)]);
        piece((b) => {
          const X1 = Math.round(X(xm + 0.15)), X2 = Math.max(X1, Math.round(X(xm + bayL - 0.15)) - 1);
          const yRoof = Math.round(Y(base + tiers * 2.6, z + d)), yTop = Math.round(Y(base + tiers * 2.6, z));
          for (let x = X1; x <= X2; x++) {
            // Dessus de la pile : plusieurs rangées de boîtes, vues d'en haut.
            for (let y = yRoof; y < yTop; y++) {
              const row = Math.min(5, Math.floor(((y - yRoof) / Math.max(1, yTop - yRoof)) * 6));
              b.set(x, y, T3(ramp(tops[row]))[fine && y === yRoof ? 4 : 3]);
            }
            // Face latérale : une boîte par étage, nervures, joints entre étages.
            for (let tz = 0; tz < tiers; tz++) {
              const rp = T3(ramp(cols[tz]));
              const ya = Math.round(Y(base + (tz + 1) * 2.6, z)), yb = Math.round(Y(base + tz * 2.6, z)) - 1;
              for (let y = ya; y <= yb; y++) {
                let k = 2;
                if (y === yb && yb > ya) k = 1;
                if (fine && (x - X1) % 2 === 1 && y > ya && y < yb) k = 1;
                if (x === X1) k = 3; else if (x === X2 && X2 > X1) k = 1;
                if (wear > 0.5 && bay(x, y) < (wear - 0.5) * 0.5) k = 0;
                b.set(x, y, rp[k]);
              }
            }
          }
        }, P.black);
      }
    }
    // Ponts de saisissage à l'avant des piles.
    if (!tiny && laden) for (const [a] of segs) piece((b) => {
      const base = G.topAt(L * a) + 1.2, x = Math.round(X(L * a)) - 1;
      for (let y = Math.round(Y(base + Math.min(2, c.tiers) * 2.6, C2 - B / 2 + 1)); y < Math.round(Y(base, C2 - B / 2 + 1)); y++) b.set(x, y, GEAR[2]);
    }, GEAR, false);
  }
  // Collecteur de chargement : colonnes à vannes rouges, manches jaunes, petite grue.
  const manifold = (mx, base, hgt) => {
    piece((b) => {
      for (const dx of [-2.6, 0, 2.6]) {
        const x = Math.round(X(mx + dx)), yt = Math.round(Y(base + hgt, C2)), yb = Math.round(Y(base, C2));
        for (let y = yt; y <= yb; y++) { b.set(x, y, P.steel[3]); if (fine) b.set(x + 1, y, P.steel[1]); }
        b.set(x - 1, yt - 1, P.red[2]); b.set(x, yt - 1, P.red[3]); b.set(x + 1, yt - 1, P.red[1]);
      }
    }, P.steel);
    piece((b) => { // manches qui pendent par-dessus bord
      for (const s of [-1, 1]) {
        const x0m = mx + s * 2.6, ya = Y(base + hgt - 0.6, C2);
        for (let k = 0; k <= 8; k++) {
          const f = k / 8, xm = x0m + s * Math.sin(f * Math.PI) * 2.5;
          b.set(X(xm), ya + (Y(base - 0.5, C2 - B * 0.4) - ya) * f, P.boiler[k < 4 ? 3 : 2]);
        }
      }
    }, null, false);
    if (!tiny) piece((b) => {
      const x = Math.round(X(mx + 5)), yb = Math.round(Y(base, C2 + 1)), yt = Math.round(Y(base + 9, C2 + 1));
      for (let y = yt; y <= yb; y++) b.set(x, y, GEAR[2]);
      line(b, x, yt, X(mx - 4), Y(base + 6, C2 + 1), GEAR[3]);
    }, GEAR);
  };
  if (A.tanker) {
    // Pétrolier : pont à tuyaux (rack central), passavant surélevé, trappes, collecteur au milieu.
    const t = A.tanker, aft = A.aftHouse || A.house, start = L * (aft.x + aft.w) + 2, end = L * 0.93;
    const segs = A.aftHouse ? [[start, L * A.house.x - 1], [L * (A.house.x + A.house.w) + 1, end]] : [[start, end]];
    for (const [s1, s2] of segs) {
      piece((b) => { // trappes de citernes
        const n = Math.max(2, Math.round((s2 - s1) / 16));
        for (let k = 0; k < n; k++) {
          const cx = s1 + ((s2 - s1) * (k + 0.5)) / n;
          if (Math.abs(cx - L * t.manifold) < 7 || (t.second && Math.abs(cx - L * t.second) < 7)) continue;
          box3(b, cx - 1.6, cx + 1.6, G.deckAt(cx), G.deckAt(cx) + 0.9, C2 + 2, 2.6, P.steel, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
        }
      }, P.steel);
      piece((b) => { // faisceau de tuyaux
        for (let x = Math.round(X(s1)); x <= Math.round(X(s2)); x++) {
          const xm = xmOf(x), y = Math.round(Y(G.deckAt(xm) + t.pipeH, C2 - 1));
          b.set(x, y, P.steel[3]); b.set(x, y + 1, P.steel[1]);
          if (fine) { const y2 = Math.round(Y(G.deckAt(xm) + t.pipeH * 0.6, C2 + 1.5)); if (!b.get(x, y2)) b.set(x, y2, P.steel[2]); }
        }
      }, P.steel);
      if (!tiny) piece((b) => { // passavant surélevé sur poteaux
        for (let x = Math.round(X(s1)); x <= Math.round(X(s2)); x++) {
          const xm = xmOf(x), y = Math.round(Y(G.deckAt(xm) + 2.4, C2 + 3));
          b.set(x, y, P.steel[fine ? 3 : 2]);
          if ((x - Math.round(X(s1))) % (fine ? 7 : 5) === 0) for (let yy = y + 1; yy <= Math.round(Y(G.deckAt(xm), C2 + 3)); yy++) b.set(x, yy, P.steel[1]);
        }
      }, null, false);
    }
    manifold(L * t.manifold, G.deckAt(L * t.manifold), 3);
    if (t.second) manifold(L * t.second, G.deckAt(L * t.second), 3);
  }
  if (A.chem) {
    // Chimiquier : tuyaux de couleur (un circuit par cargaison), petites citernes inox, vannes.
    const start = L * (A.house.x + A.house.w) + 2, end = L * 0.93, mx = L * A.chem.manifold;
    const pipes = fine ? [['#e3b23c', 0.7, 0], ['#3a78b5', 1.3, 1.5], ['#e8e6df', 1.9, 3], ['#c4362c', 2.5, 4.5]] : [['#e3b23c', 0.8, 0], ['#3a78b5', 1.8, 2.5]];
    piece((b) => {
      for (const [col, hh, z] of pipes) {
        const rp = ramp(col);
        for (let x = Math.round(X(start)); x <= Math.round(X(end)); x++) { const xm = xmOf(x); b.set(x, Y(G.deckAt(xm) + hh, C2 - 2 + z), rp[2]); }
      }
    }, null, false);
    for (let xm = start + 5; xm < end - 4; xm += 14) {
      if (Math.abs(xm - mx) < 8) continue;
      piece((b) => {
        const q = box3(b, xm - 2, xm + 2, G.deckAt(xm), G.deckAt(xm) + 4.4, C2 - 2, 4, P.tank, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
        if (fine) for (let y = q.yTop + 1; y < q.yFoot; y++) b.set(q.X1 + 1, y, P.tank[4]);
      }, P.tank);
    }
    manifold(mx, G.deckAt(mx), 3);
  }
  if (A.spheres) {
    // Méthanier : grandes cuves sphériques (la moitié haute dépasse, sur sa jupe aux couleurs de la coque).
    const sp = A.spheres, gap = ((sp.to - sp.from) * L) / sp.count, R = Math.min(sp.r, gap * 0.46);
    const rx = R / mpp, ry = rx * 1.06;
    const TR = TRIM || HULL;
    for (let k = 0; k < sp.count; k++) {
      const cxm = L * sp.from + gap * (k + 0.5), cx = X(cxm), deckY = Y(G.deckAt(cxm), C2), cy = deckY - ry * 0.5;
      piece((b) => {
        const xa = Math.round(cx - rx * 0.93), xb = Math.round(cx + rx * 0.93) - 1;
        for (let x = xa; x <= xb; x++) for (let y = Math.round(cy); y <= Math.round(deckY); y++) b.set(x, y, x === xa ? HULL[3] : x === xb ? HULL[1] : HULL[2]);
        for (let y = Math.floor(cy - ry); y <= Math.round(cy); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
          if (d > 1) continue;
          const lam = -0.5 * nx - 0.85 * ny + (fine ? (bay(x, y) - 0.5) * 0.25 : 0);
          b.set(x, y, P.pale[lam > 0.8 ? 4 : lam > 0.45 ? 3 : lam > 0.05 ? 2 : lam > -0.3 ? 1 : 0]);
        }
        for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) { b.set(x, Math.round(cy), TR[2]); if (fine && rx > 8) b.set(x, Math.round(cy) - 1, TR[3]); }
        const tx1 = Math.round(cx - rx * 0.18), tx2 = Math.round(cx + rx * 0.18), ty = Math.round(cy - ry);
        for (let x = tx1; x <= tx2; x++) { b.set(x, ty - 1, P.steel[3]); b.set(x, ty, P.steel[2]); }
        if (wear > 0.35) for (let j = 0; j < 3; j++) rust(b, Math.round(cx + (r() - 0.5) * rx), Math.round(cy - ry * 0.6), Math.round(ry * (0.4 + wear * 0.5)));
      }, P.pale);
    }
    manifold(L * sp.from + gap, G.deckAt(L * sp.from + gap), 3);
  }
  if (A.cylinders) {
    // Gazier : cuves cylindriques couchées, dômes et vannes au-dessus.
    const cy = A.cylinders, gap = ((cy.to - cy.from) * L) / cy.count, hh = cy.r * 2 * 0.62;
    for (let k = 0; k < cy.count; k++) {
      const x1 = L * cy.from + gap * k + 1.5, w = gap - 3, base = G.deckAt(x1 + w / 2) + 0.6;
      piece((b) => {
        const q = box3(b, x1, x1 + w, base, base + hh, C2 - cy.r, cy.r * 2, P.tank, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
        const tot = Math.max(1, q.yFoot - q.yRoof);
        for (let x = q.X1; x <= q.X2; x++) for (let y = q.yRoof; y <= q.yFoot; y++) {
          const f = (y - q.yRoof) / tot;
          const end = Math.min(x - q.X1, q.X2 - x);
          if (end === 0 && (f < 0.2 || f > 0.85)) { b.c[y * W + x] = null; continue; }
          b.set(x, y, P.tank[f < 0.12 ? 4 : f < 0.45 ? 3 : f < 0.8 ? 2 : 1]);
        }
        const dx = Math.round(X(x1 + w / 2));
        for (let x = dx - 1; x <= dx + 1; x++) { b.set(x, q.yRoof - 1, P.steel[3]); b.set(x, q.yRoof - 2, P.steel[2]); }
        b.set(dx, q.yRoof - 3, P.red[2]);
        if (wear > 0.35) for (let j = 0; j < 2; j++) rust(b, q.X1 + 2 + Math.floor(r() * Math.max(1, q.X2 - q.X1 - 4)), q.yTop, Math.round((q.yFoot - q.yTop) * (0.4 + wear * 0.5)));
      }, P.tank);
    }
    if (!tiny) piece((b) => {
      for (let x = Math.round(X(L * cy.from)); x <= Math.round(X(L * cy.to)); x++) b.set(x, Math.round(Y(G.fb + 0.6 + hh + 1.9, C2)), P.steel[2]);
    }, null, false);
  }

  // ---------- Apparaux : grues, mâts de charge, grues lourdes, mâts ----------
  const dangerous = laden && (A.tanker || A.spheres || A.cylinders || A.chem);
  for (const g of A.gear || []) {
    const px = L * g.x;
    if (g.kind === 'crane') {
      const base = G.deckAt(px), pedTop = base + g.h * 0.3, dir = g.dir ?? 1;
      const piv = [px + 1.4 * dir, pedTop + 1.3], ang = (JIB * Math.PI) / 180, len = g.h * 0.725;
      const tip = [piv[0] + Math.cos(ang) * len * dir, piv[1] + Math.sin(ang) * len];
      if (!tiny) piece((b) => {
        line(b, X(px - 0.9 * dir), Y(pedTop + 4.4), X(tip[0]), Y(tip[1]), WIRE);
        const hy = base + (A.hatchH || 1.5) + 3;
        line(b, X(tip[0]), Y(tip[1]) + 1, X(tip[0]), Y(hy), WIRE);
        const hx = Math.round(X(tip[0])), hyp = Math.round(Y(hy));
        b.set(hx, hyp + 1, P.steel[3]); b.set(hx - 1, hyp + 1, P.steel[2]);
        if (fine) { b.set(hx, hyp + 2, P.steel[1]); b.set(hx + 1, hyp + 2, P.steel[2]); b.set(hx - 1, hyp + 2, P.steel[1]); }
      }, null, false);
      piece((b) => {
        const ax = X(piv[0]), ay = Y(piv[1]), bx = X(tip[0]), by = Y(tip[1]);
        const n = Math.hypot(bx - ax, by - ay) || 1, nx = (by - ay) / n, ny = -(bx - ax) / n;
        const w0 = Math.max(fine ? 1.6 : 1.2, 1.3 * vpm), w1 = w0 * 0.5;
        poly(b, [[ax + nx * w0, ay + ny * w0], [bx + nx * w1, by + ny * w1], [bx - nx * w1, by - ny * w1], [ax - nx * w0, ay - ny * w0]], (x, y) => {
          const d = ((x + 0.5 - ax) * nx + (y + 0.5 - ay) * ny) * dir;
          return d > (fine ? 0.6 : 0.35) ? GEAR[4] : d < (fine ? -0.6 : -0.5) ? GEAR[1] : GEAR[2];
        });
      }, GEAR);
      piece((b) => {
        const q = box3(b, px - 1.25, px + 1.25, base, pedTop, C2 - 1.25, 2.5, GEAR, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
        if (fine) for (let y = q.yTop + 1; y < q.yFoot; y++) b.set(q.X1 + 1, y, GEAR[3]);
        if (wear > 0.4) for (let y = q.yTop + 2; y < q.yTop + 2 + (q.yFoot - q.yTop) * wear * 0.6; y++) if (bay(q.X2 - 1, y) < 0.7) b.set(q.X2 - 1, y, P.rust[2]);
      }, GEAR);
      piece((b) => {
        const cx1 = Math.min(px - 1.9 * dir, px + 2.8 * dir), cx2 = Math.max(px - 1.9 * dir, px + 2.8 * dir);
        const q = box3(b, cx1, cx2, pedTop, pedTop + 3.1, C2 - 1.8, 3.6, GEAR, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1, roofEdge: 3 });
        const wy = q.yTop + (fine ? 2 : 1);
        const wx = dir > 0 ? q.X2 - (fine ? 3 : 1) : q.X1 + 1;
        for (let x = wx; x < wx + (fine ? 3 : 1); x++) { b.set(x, wy, glass(1)); if (fine) b.set(x, wy + 1, glass(0)); }
        const gx = Math.round(X(px - 0.9 * dir));
        if (!tiny) for (let y = Math.round(Y(pedTop + 4.4)); y < q.yRoof; y++) b.set(gx, y, GEAR[fine ? 3 : 2]);
      }, GEAR);
    } else if (g.kind === 'derrick') {
      // Mât de charge à l'ancienne : poteau, barre de flèche, corne relevée vers sa cale.
      const base = G.deckAt(px), top = base + g.h, dir = g.aft ? -1 : 1;
      const tip = [px + dir * g.h * 0.75 * (g.boom || 0.7), base + g.h * 0.58];
      if (!tiny) piece((b) => {
        line(b, X(px + 0.4 * dir), Y(top - 0.3), X(tip[0]), Y(tip[1]), WIRE);
        line(b, X(tip[0]), Y(tip[1]), X(tip[0]), Y(base + (A.hatchH || 1.5) + 1.2, C2 - 3), WIRE);
      }, null, false);
      piece((b) => {
        line(b, X(px + 0.3 * dir), Y(base + 1.8), X(tip[0]), Y(tip[1]), GEAR[3]);
        if (fine) line(b, X(px + 0.3 * dir) + 1, Y(base + 1.8), X(tip[0]) + 1, Y(tip[1]), GEAR[1]);
      }, GEAR);
      piece((b) => {
        const w = fine ? 3 : 2, X1 = Math.round(X(px)) - 1;
        for (let y = Math.round(Y(top)); y < Math.round(Y(base)); y++) for (let k = 0; k < w; k++) b.set(X1 + k, y, GEAR[k === 0 ? 4 : k === w - 1 ? 1 : 2]);
        const cy = Math.round(Y(top - 0.6));
        for (let x = Math.round(X(px - 2.2)); x <= Math.round(X(px + 2.2)); x++) { b.set(x, cy, GEAR[3]); if (fine) b.set(x, cy + 1, GEAR[1]); }
        if (wear > 0.3) rust(b, X1 + w - 1, Math.round(Y(top - 1)), Math.round((Y(base) - Y(top)) * 0.5 * wear));
      }, GEAR);
    } else if (g.kind === 'heavy') {
      // Grue de levage lourd : gros fût, flèche en treillis très relevée, moufle et câbles.
      const base = G.deckAt(px), ped = base + g.h * 0.26, dir = g.dir ?? 1;
      const tip = [px + dir * g.h * 0.42, ped + g.h * 0.72];
      const hookTo = laden && A.project ? Math.max(...A.project.map((c) => G.deckAt(L * c.x) + (A.hatchH || 0) + c.h + 0.8)) + 1.5 : base + 7;
      if (!tiny) piece((b) => {
        line(b, X(px), Y(ped + 3), X(tip[0]), Y(tip[1]), WIRE);
        line(b, X(tip[0]), Y(tip[1]), X(tip[0]), Y(hookTo + 1), WIRE);
        box3(b, tip[0] - 0.9, tip[0] + 0.9, hookTo, hookTo + 1.4, C2 - 0.9, 1.8, P.boiler, { top: false });
      }, null, false);
      piece((b) => {
        const ax = X(px), ay = Y(ped + 1.5), bx = X(tip[0]), by = Y(tip[1]);
        const n = Math.hypot(bx - ax, by - ay) || 1, nx = (by - ay) / n, ny = -(bx - ax) / n;
        const w0 = Math.max(2, 1.8 * vpm), w1 = Math.max(1, 0.6 * vpm);
        const L2 = n;
        poly(b, [[ax + nx * w0, ay + ny * w0], [bx + nx * w1, by + ny * w1], [bx - nx * w1, by - ny * w1], [ax - nx * w0, ay - ny * w0]], (x, y) => {
          const px2 = x + 0.5 - ax, py2 = y + 0.5 - ay;
          const along = (px2 * (bx - ax) + py2 * (by - ay)) / L2, across = px2 * nx + py2 * ny;
          const wHere = w0 + (w1 - w0) * (along / L2);
          if (fine && wHere > 2.2 && Math.abs(across) < wHere - 1.1 && Math.abs(((along + across * (Math.floor(along / 4) % 2 ? 1 : -1)) % 4)) > 1.2) return null; // treillis
          return across * dir > 0.4 ? GEAR[3] : across * dir < -0.6 ? GEAR[1] : GEAR[2];
        });
      }, GEAR);
      piece((b) => {
        box3(b, px - 2.1, px + 2.1, base, ped, C2 - 2.1, 4.2, GEAR, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1 });
        const q = box3(b, px - 3, px + 3, ped, ped + 3, C2 - 2.4, 4.8, GEAR, { roof: 4, wall: 2, edgeL: 3, edgeR: 1, foot: 1, roofEdge: 3 });
        const wx = dir > 0 ? q.X2 - 2 : q.X1 + 1;
        b.set(wx, q.yTop + 1, glass(1)); b.set(wx + 1, q.yTop + 1, glass(1));
      }, GEAR);
    } else if (g.kind === 'mast') {
      const base = G.topAt(px), top = base + g.h, mx = Math.round(X(px));
      piece((b) => {
        for (let y = Math.round(Y(top)); y < Math.round(Y(base)); y++) { b.set(mx, y, P.white[3]); if (fine) b.set(mx + 1, y, P.white[1]); }
        const cy = Math.round(Y(top - 2.2));
        for (let x = mx - (fine ? 3 : 2); x <= mx + (fine ? 4 : 2); x++) b.set(x, cy, P.white[3]);
        b.set(mx, Math.round(Y(top)) - 1, '#f2c14e');
      }, P.white, fine);
      if (dangerous && !tiny) piece((b) => { // pavillon B : matière dangereuse à bord
        const fy = Math.round(Y(top - 0.4)), fw = fine ? 5 : 4, fh = fine ? 4 : 3;
        for (let y = 0; y < fh; y++) for (let x = 1; x <= fw; x++) {
          if (x > fw - 1 - Math.abs(y - (fh - 1) / 2) * 0.9 && x > fw - 2) continue; // queue d'aronde
          b.set(mx - x, fy + y, P.red[y === 0 ? 3 : 2]);
        }
      }, P.red);
      // Guindeau sur le gaillard.
      if (g.x > 0.85 && !tiny) piece((b) => box3(b, px - 5.5, px - 2.5, base, base + 1.1, C2 - 1.6, 3.2, P.steel, { roof: 3, wall: 2, edgeL: 3, edgeR: 1, foot: 1 }), P.steel);
    }
  }

  // ---------- Rambarde proche ----------
  if (!A.box && !tiny && vpm > 0.9) {
    const gaps = houses.map((h) => [h.hx1, h.hx2]);
    piece((b) => {
      for (let x = Math.round(X(0.6)); x <= Math.round(X(L * G.fcStart)); x++) {
        const xm = xmOf(x);
        if (gaps.some(([a, z2]) => xm > a - 0.5 && xm < z2 + 0.5)) continue;
        const top = Math.round(Y(G.topAt(xm), nearZ(xm))), ry = top - railH;
        b.set(x, ry, P.white[fine ? 2 : 3]);
        if (x % (fine ? 5 : 4) === 0) for (let y = ry + 1; y < top; y++) b.set(x, y, P.steel[fine ? 2 : 3]);
      }
    }, null, false);
  }

  // ---------- Coque : flanc proche entre le liston et la flottaison ----------
  const topY = (xm) => Y(G.topAt(xm), nearZ(xm));
  let hawse = null;
  piece((b) => {
    const step = mpp * 0.5, top = [], wl = [], stern = [];
    for (let x = 0; x <= L - 0.01; x += step) top.push([X(x), topY(x)]);
    const bt = G.topAt(L) + 0.35, stemExp = A.bow === 'straight' ? 1.05 : A.bow === 'flared' ? 2 : 1.6;
    for (let k = 0; k <= 10; k++) { const f = k / 10; top.push([X(L - G.STEM * f ** stemExp), Y(bt * (1 - f), C2)]); }
    for (let x = L - G.STEM; x >= G.sternWL; x -= step) wl.push([X(x), Y(0, C2 - G.halfWL(x))]);
    if (A.stern === 'cruiser') {
      for (let k = 1; k <= 8; k++) { const f = k / 8, xm = G.sternWL * (1 - f ** 0.55); stern.push([X(xm), Y(G.topAt(0) * f * 0.97, C2 - G.half(xm) * (0.75 + 0.25 * f))]); }
    } else stern.push([X(L * 0.009), Y(Math.min(0.8, G.fb * 0.3), C2 - G.half(L * 0.009) * 0.75)], [X(L * 0.001), Y(Math.min(2, G.fb * 0.6), nearZ(0))]);
    const trimRows = 1, lightHull = luma(C.hull) > 0.8;
    poly(b, [...top, ...wl, ...stern], (x, y) => {
      const xm = xmOf(x);
      const tY = Math.round(topY(xm)), d = y - tY;
      const wlY = Y(0, C2 - G.halfWL(xm));
      const bootY = Math.round(Y(G.bootTop, nearZ(xm) * 0.5 + (C2 - G.halfWL(xm)) * 0.5));
      const turn = (C2 - G.half(xm)) / C2; // 0 sur le flanc droit, 1 à l'étrave
      if (y >= bootY && xm < L - G.STEM * 0.4) {
        if (y === bootY) return P.white[3];
        return y >= Math.round(wlY) - 1 ? BOOT[1] : BOOT[turn > 0.5 ? 1 : 2];
      }
      if (d <= 0) return tiny ? HULL[3] : A.box ? HULL[4] : P.white[fine ? 2 : 3];
      if (d <= trimRows) return TRIM && !tiny ? TRIM[3] : HULL[tiny ? 2 : 3];
      if (TRIM2 && d === trimRows + 1) return TRIM2[2];
      let k = 2;
      if (d === trimRows + 1 && !TRIM2) k = 3;
      const low = (y - tY) / Math.max(1, bootY - tY), lo = lightHull ? 0.8 : fine ? 0.55 : 0.62;
      if (low > lo) k = (fine ? (low - lo) / (1 - lo) : 0.5) * (lightHull ? 0.6 : 1) > bay(x, y) ? 1 : k;
      if (turn > 0.04 && xm > L * 0.5 && turn * (lightHull ? 0.9 : 1.6) > bay(x, y) + 0.2) k = Math.max(0, k - 1);
      if (xm < L * 0.018) k = 1;
      if (fine && !lightHull && k >= 2 && d > trimRows + 1 && Math.abs((xm + 4) % 8.5) < mpp && y % 2 === 0) k = 1; // soudures des tôles
      return HULL[k];
    });
    // Arête d'étrave éclairée.
    for (let k = 0; k <= 30; k++) {
      const f = k / 30, xm = L - G.STEM * f ** stemExp, hh = bt * (1 - f);
      const x = Math.round(X(xm)) - 1, y = Math.round(Y(hh, C2));
      if (hh > G.bootTop + 0.3 && b.get(x, y) && b.get(x, y) !== HULL[4]) b.set(x, y, HULL[fine ? 4 : 3]);
    }
    const hullH = Math.round(Y(G.bootTop) - Y(G.deckAt(L / 2)));
    // Transporteur de voitures : bande, aérations, passerelle à l'avant, porte de rampe.
    if (A.box) {
      const BAND = T3(ramp(A.box.band));
      for (let x = Math.round(X(L * 0.01)); x <= Math.round(X(L * 0.985)); x++) {
        const xm = xmOf(x), zz = nearZ(xm);
        const yb = Math.round(Y(G.fb * 0.34, zz)), bw = Math.max(2, Math.round(0.9 * vpm * exH));
        for (let k = 0; k < bw; k++) if (b.get(x, yb + k)) b.set(x, yb + k, BAND[k === 0 ? 3 : 2]);
        if (b.get(x, yb + bw + 1) && !tiny) b.set(x, yb + bw + 1, BAND[1]);
        if (!tiny) for (const hh of [0.62, 0.8]) { const yv = Math.round(Y(G.fb * hh, zz)); if (xm > L * 0.08 && xm < L * 0.84 && (x % (fine ? 5 : 4)) < (fine ? 2 : 1) && b.get(x, yv)) b.set(x, yv, P.steel[3]); }
        if (xm > L * A.box.bridge && xm < L * 0.955) { const yw = Math.round(Y(G.fb - 1.6, zz)); for (let k = 0; k < (fine ? 2 : 1); k++) if (b.get(x, yw + k)) b.set(x, yw + k, glass(k === 0 && x % 4 === 0 ? 3 : 1)); }
      }
      if (!tiny) { // porte latérale de la rampe
        const dx1 = Math.round(X(L * 0.3)), dx2 = Math.round(X(L * 0.3 + 9)), dy1 = Math.round(Y(G.fb * 0.56, nearZ(L * 0.3))), dy2 = Math.round(Y(G.fb * 0.38, nearZ(L * 0.3)));
        for (let x = dx1; x <= dx2; x++) { b.set(x, dy1, HULL[1]); }
        for (let y = dy1; y <= dy2; y++) { b.set(dx1, y, HULL[1]); b.set(dx2, y, HULL[1]); }
      }
    }
    // Hublots des navires anciens.
    if (A.era === 'classic' && !tiny) for (let xm = L * 0.06; xm < L * 0.22; xm += Math.max(2.6, 3 * mpp)) { const x = Math.round(X(xm)), y = Math.round(topY(xm)) + 3; if (b.get(x, y)) b.set(x, y, glass(0)); }
    // Écubier.
    const hxm = L - G.STEM - L * 0.015, hx = Math.round(X(hxm)), hy = Math.round(topY(hxm)) + (fine ? 4 : 3);
    hawse = [hx, hy];
    if (!tiny) { b.set(hx, hy, INK); b.set(hx + 1, hy, INK); if (fine) { b.set(hx, hy + 1, INK); b.set(hx + 1, hy + 1, P.steel[1]); } }
    // Marques de tirant d'eau.
    if (fine && !tiny) for (const xm of [L * 0.045, L - G.STEM - L * 0.03]) { const wy = Math.round(Y(0, C2 - G.halfWL(xm))); for (let k = 2; k < Math.min(9, hullH); k += 2) if (b.get(Math.round(X(xm)), wy - k)) b.set(Math.round(X(xm)), wy - k, '#e8e4d6'); }
    // Usure : coulures, rouille à la flottaison, éclats, bosses, trous.
    if (wear > 0.15 || dmg > 0.4) {
      rust(b, hx, hy + (fine ? 2 : 1), Math.round(hullH * (0.6 + wear)));
      if (fine) rust(b, hx + 1, hy + 2, Math.round(hullH * (0.4 + wear * 0.6)));
      for (let xm = L * 0.045; xm < L - G.STEM - L * 0.03; xm += fine ? 4.5 * Math.max(1, mpp / 0.4) : 7 * Math.max(1, mpp / 0.6)) {
        if (r() > wear * 1.1) continue;
        const x = Math.round(X(xm + r() * 3));
        rust(b, x, Math.round(topY(xmOf(x))) + trimRows + 1, Math.round(hullH * (0.3 + r() * wear)));
      }
      for (let x = Math.round(X(L * 0.025)); x < Math.round(X(L - G.STEM)); x++) {
        const xm = xmOf(x), by = Math.round(Y(G.bootTop, nearZ(xm) * 0.5 + (C2 - G.halfWL(xm)) * 0.5));
        for (let k = -2; k <= 1; k++) if (r() < (wear - 0.1) * (k === 0 ? 0.85 : 0.35) && b.get(x, by + k)) b.set(x, by + k, P.rust[1 + Math.floor(r() * (fine ? 3 : 2))]);
      }
      for (let k = 0; k < Math.round(wear * (fine ? 30 : 12) * Math.min(2, W / 300)); k++) {
        const x = Math.round(X(L * 0.05 + r() * L * 0.88)), xm = xmOf(x);
        const y = Math.round(topY(xm)) + trimRows + 2 + Math.floor(r() * Math.max(1, hullH - trimRows - 3));
        if (!b.get(x, y)) continue;
        b.set(x, y, r() < 0.7 ? P.rust[3] : '#b4532c'); if (fine && r() < 0.6) b.set(x + 1, y, P.rust[2]);
      }
      if (dmg > 0.4) for (let k = 0; k < Math.round((dmg - 0.3) * (fine ? 14 : 6)); k++) { // bosses
        const x = Math.round(X(L * 0.08 + r() * L * 0.8)), xm = xmOf(x);
        const y = Math.round(topY(xm)) + trimRows + 3 + Math.floor(r() * Math.max(1, hullH - trimRows - 5));
        for (let i = 0; i < (fine ? 4 : 2); i++) { if (b.get(x + i, y)) b.set(x + i, y, HULL[0]); if (b.get(x + i, y + 1)) b.set(x + i, y + 1, HULL[4]); }
      }
      if (dmg > 0.75) for (let k = 0; k < Math.round((dmg - 0.7) * 10); k++) { // trous : seulement sur une épave
        const x = Math.round(X(L * 0.12 + r() * L * 0.76)), xm = xmOf(x);
        const y = Math.round(topY(xm)) + trimRows + 3 + Math.floor(r() * Math.max(1, hullH - trimRows - 6));
        for (const [dx, dy, c] of [[0, 0, '#0a0a0a'], [1, 0, '#0a0a0a'], [-1, 0, P.rust[2]], [2, 0, P.rust[2]], [0, -1, P.rust[3]], [1, 1, P.rust[2]]]) if (b.get(x + dx, y + dy)) b.set(x + dx, y + dy, c);
        rust(b, x, y + 2, Math.round(hullH * 0.4));
      }
    }
    // Nom à la proue : il suit la tonture, n'est jamais coupé et passe par-dessus la rouille.
    let nameStart = L;
    const nameJob = [];
    if (o.name && W >= (fine ? 200 : 150)) {
      const glyphs = nameGlyphs(o.name);
      const width = glyphs.reduce((s, g) => s + g.w + 1, -1);
      const hasAcc = glyphs.some((g) => g.accent), hasCed = glyphs.some((g) => g.cedil);
      const endX = Math.round(X(L * (A.box ? 0.84 : 0.87)));
      const startX = endX - width;
      const light = luma(C.hull) > 0.55;
      const ink = light ? INK : P.white[fine ? 3 : 4];
      const yRoom = (xm) => Math.round(Y(G.bootTop, nearZ(xm))) - Math.round(topY(xm)) - trimRows - 2;
      const need = 5 + (hasAcc ? 2 : 0) + (hasCed ? 2 : 0);
      if (startX > X(L * 0.3) && yRoom(xmOf(startX)) >= need + 1 && yRoom(xmOf(endX)) >= need + 1) {
        nameStart = xmOf(startX);
        let lx = startX;
        for (const g of glyphs) {
          const xm = xmOf(lx + g.w / 2);
          const ny = A.box ? Math.round(Y(G.fb * 0.44, nearZ(xm))) - 5 : Math.round(Y(G.topAt(xm), 0) + (topY(L * 0.5) - Y(G.topAt(L * 0.5), 0))) + trimRows + 2 + (hasAcc ? 2 : 0) + (fine ? 1 : 0);
          nameJob.push([g, lx, ny]);
          lx += g.w + 1;
        }
        nameJob.ink = ink;
      }
    }
    // Pictogramme de la cargaison (gaz, pétrole, chimie, fruits, voitures), devant le nom.
    if (A.emblem && !tiny && Math.min(L * 0.62, nameStart - (fine ? 8 : 10) * mpp) > L * 0.3) {
      const size = fine ? 7 : 5, xm = Math.min(L * 0.62, nameStart - (fine ? 8 : 10) * mpp), x = Math.round(X(xm));
      const yTop = Math.round(topY(xm)) + trimRows + 2, yBot = Math.round(Y(G.bootTop, nearZ(xm))) - 1;
      if (yBot - yTop >= size + 2) {
        const pc = PICTO[A.emblem], cy = Math.round(A.box ? Y(G.fb * 0.62, nearZ(xm)) : (yTop + yBot) / 2), rr = size / 2 + 1.2;
        for (let yy = -Math.ceil(rr); yy <= Math.ceil(rr); yy++) for (let xx = -Math.ceil(rr); xx <= Math.ceil(rr); xx++) {
          const d = Math.hypot(xx, yy);
          if (d <= rr - 0.4) b.set(x + xx, cy + yy, '#f7f5ef'); else if (d <= rr + 0.5) b.set(x + xx, cy + yy, fine ? mix(HULL[0], INK, 0.4) : INK);
        }
        pc[size].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') b.set(x - (size >> 1) + i, cy - (size >> 1) + j, ch === 'B' ? pc.c[1] : pc.c[0]); }));
      }
    }
    for (const [g, lx, ny] of nameJob) {
      const ink = nameJob.ink;
      g.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') b.set(lx + i, ny + j, ink); }));
      if (g.accent) ACCENT[g.accent].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') b.set(lx + i, ny - 2 + j, ink); }));
      if (g.cedil) { b.set(lx + 1, ny + 5, ink); b.set(lx, ny + 6, ink); b.set(lx + 1, ny + 6, ink); }
    }
  }, HULL);
  // Rampe arrière relevée (transporteur de voitures).
  if (A.box && !tiny) piece((b) => {
    const x = Math.round(X(0)) , y1 = Math.round(Y(G.fb * 0.82, nearZ(0))), y2 = Math.round(Y(G.fb * 0.24, nearZ(0)));
    for (let y = y1; y <= y2; y++) for (let k = 0; k < (fine ? 3 : 2); k++) b.set(x - k, y, P.steel[k === 0 ? 2 : 1]);
  }, P.steel);

  // ---------- Canots de sauvetage ----------
  for (const h of houses) {
    const hsp = h.hsp;
    if (tiny) break;
    if (A.lifeboats === 'davit' && !hsp.noBoats) {
      const lvl = h.base + DK;
      const bl = Math.min(6.5, h.hw * 0.36), xa0 = h.hx1 + h.hw * 0.06;
      piece((b) => {
        const z = C2 - B * 0.5 - 0.6, y2 = Y(lvl + 0.4, z), y1 = Y(lvl + 2.1, z), xa = X(xa0), xb = X(xa0 + bl);
        const pts = [[xa + 1.5, y1], [xb - 1, y1], [xb, y1 + (y2 - y1) * 0.45], [xb - 1.5, y2], [xa + 1.5, y2], [xa, y1 + (y2 - y1) * 0.4]];
        poly(b, pts, (x, y) => (y < y1 + (y2 - y1) * 0.34 ? P.white[fine && y === Math.round(y1) ? 4 : 3] : y > y2 - 1.2 ? P.orange[1] : P.orange[fine && y < y1 + (y2 - y1) * 0.6 ? 3 : 2]));
      }, P.orange);
      piece((b) => {
        const z = C2 - B * 0.5 - 0.6;
        for (const xm of [xa0 + 0.6, xa0 + bl - 0.6]) {
          const x = Math.round(X(xm)), yt = Math.round(Y(lvl + DK + 1.2, C2 - B * 0.44)), yb = Math.round(Y(lvl + 2.1, z));
          for (let y = yt; y < yb; y++) b.set(x, y, P.steel[3]);
          b.set(x + (xm < xa0 + bl / 2 ? -1 : 1), yt, P.steel[3]);
        }
      }, null, false);
    } else if (A.lifeboats === 'freefall' && hsp === A.house && hsp.x < 0.3 && !A.box) {
      // Canot à chute libre sur sa rampe, à l'arrière du château.
      piece((b) => {
        const ax = X(h.hx1 - 0.2), ay = Y(h.base + 2.4, C2), len = 7 / mpp, hh = Math.max(2, 1.8 * vpm * ex * 0.8), drop = len * 0.4;
        poly(b, [[ax, ay], [ax - len + 1, ay + drop], [ax - len, ay + drop + hh * 0.5], [ax - len + 1, ay + drop + hh], [ax, ay + hh]], (x, y) => {
          const f = (y - (ay + ((ax - x) / len) * drop)) / hh;
          return P.orange[f < 0.3 ? 3 : f < 0.75 ? 2 : 1];
        });
      }, P.orange);
    }
  }
  return { W, H, fine, sh, WL, water, mpp, X, Y, C2, B, L, horizon: WL - Math.round(B * kz) - (fine ? 6 : 4), funnelTop, bowX: Math.round(X(L - G.STEM)), bowY: Math.round(Y(0, C2 - 0.2)), sternX: Math.round(X(G.sternWL)), smokeDark: wear > 0.45, halfWL: G.halfWL, hawse, tiny };
}

// ---------- Décor et animation : ciel, mer, fumée, reflet, écume, mouettes ----------
function compose(S, t, sky) {
  const { W, H, fine, WL } = S;
  const img = new ImageData(W, H), px = new Uint32Array(img.data.buffer);
  const sea = (fine ? SEA_FINE : SEA_CHUNKY).map(toInt), crest = toInt(CREST);
  const horizon = sky ? Math.max(4, S.horizon) : WL - 1;
  if (sky) {
    const skyI = SKY.map(toInt);
    for (let y = 0; y < horizon; y++) {
      const f = (y / Math.max(1, horizon - 1)) * (skyI.length - 1), i = Math.min(skyI.length - 2, Math.floor(f)), fr = f - i;
      for (let x = 0; x < W; x++) px[y * W + x] = fr > bay(x, y) ? skyI[i + 1] : skyI[i];
    }
    const cloud = (cx, cy, w) => {
      const hh = Math.max(2, Math.round(w / 4.5));
      for (let y = -hh; y <= 1; y++) for (let x = -w; x <= w; x++) {
        const bump = Math.sin(x * (fine ? 0.45 : 0.7)) * 0.18 + Math.sin(x * 0.21 + 1) * 0.12;
        const k = (x * x) / (w * w) + ((y + bump * hh) * (y + bump * hh)) / (hh * hh);
        const X = cx + x, Y = cy + y;
        if (k < 1 && X >= 0 && X < W && Y >= 0 && Y < horizon) px[Y * W + X] = toInt(y >= 0 ? '#d7e7ee' : k > 0.7 && y < -hh * 0.4 ? '#eef6f8' : '#fbfdfc');
      }
    };
    const dr = t * (fine ? 1.4 : 0.9), cw = Math.max(6, Math.round(W * 0.06));
    cloud(Math.round(W * 0.2 + dr) % (W + 50) - 25, Math.round(H * 0.15), cw);
    cloud(Math.round(W * 0.78 + dr * 0.7) % (W + 50) - 25, Math.round(H * 0.28), Math.round(cw * 0.65));
    // Côte lointaine, très pâle, pour la profondeur.
    for (let x = Math.round(W * 0.58); x < W; x++) {
      const hh = Math.max(0, Math.round((Math.sin(x * 0.045 + 1.3) * 0.5 + Math.sin(x * 0.11) * 0.25 + 0.4) * (fine ? 5 : 3)));
      for (let y = horizon - hh; y < horizon; y++) if (y >= 0) px[y * W + x] = toInt(bay(x, y) < 0.5 ? '#b3cfd6' : '#bdd6dc');
    }
  }
  for (let y = horizon; y < H; y++) {
    const d = (y - horizon) / Math.max(1, H - horizon), f = d ** 0.9 * sea.length, i = Math.min(sea.length - 1, Math.floor(f));
    const nxt = sea[Math.min(sea.length - 1, i + 1)], fr = f - i;
    for (let x = 0; x < W; x++) px[y * W + x] = fr > 0.75 && bay(x, y) < (fr - 0.75) * 3 ? nxt : sea[i];
    for (let j = 0; j < (fine ? 3 : 2); j++) {
      const len = 2 + Math.floor(d * (fine ? 8 : 5)), seed = (y * 7919 + j * 104729) % 9973;
      const xx = Math.floor((((seed * 13.37 + t * (5 + d * 9) * (y % 2 ? 1 : -0.7)) % (W + 20)) + W + 20) % (W + 20)) - 10;
      const col = d < 0.35 ? crest : sea[Math.max(0, i - 2)];
      for (let k = 0; k < len; k++) if (xx + k >= 0 && xx + k < W) px[y * W + xx + k] = col;
    }
  }
  if (sky) for (let x = 0; x < W; x++) px[horizon * W + x] = toInt('#93bfca');
  // Fumée (derrière le navire) : claire pour un moteur sain, noire et épaisse pour un vieux moteur.
  if (S.funnelTop && sky) {
    const NS = fine ? 8 : 6, [fx, fy] = S.funnelTop, dark = S.smokeDark;
    const c1 = toInt(dark ? '#2c2f31' : '#f6f6f1'), c2 = toInt(dark ? '#45494b' : '#d0d8db');
    const sc = Math.max(0.6, Math.min(1.6, H / 96));
    for (let k = 0; k < NS; k++) {
      const ph = (t * 0.32 + k / NS) % 1;
      const p = { x: fx - 1 - ph * 52 * sc * (fine ? 1 : 0.7), y: fy - 2 - ph * 20 * sc * (fine ? 1 : 0.7) + Math.sin(ph * 6 + k) * 1.2, r: (2.4 + ph * 6) * sc * (fine ? 1 : 0.7), a: 1 - ph };
      const R2 = p.r * p.r;
      for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) for (let x = Math.floor(p.x - p.r); x <= p.x + p.r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dd = ((x - p.x) ** 2 + (y - p.y) ** 2) / R2;
        if (dd > 1 || bay(x, y) > p.a * (dark ? 0.95 : 0.65) * (1.2 - dd * 0.4)) continue;
        px[y * W + x] = dd < 0.45 && (dark || y < p.y) ? c1 : c2;
      }
    }
  }
  // Navire.
  const shipI = S.shipI || (S.shipI = S.sh.c.map((c) => (c ? toInt(c) : 0)));
  for (let i = 0; i < shipI.length; i++) if (shipI[i]) px[i] = shipI[i];
  // Reflet dans l'eau, qui ondule.
  for (let k = 0; k < H - WL; k++) {
    const sy = WL - 1 - k, ty = WL + k;
    if (sy < 0) break;
    if (k > 1 && k % (fine ? 3 : 2) === 0) continue;
    const wob = Math.round(Math.sin(k * 0.9 + t * 2.2) * (1 + k * 0.15));
    const seaC = sea[Math.min(sea.length - 1, 1 + Math.floor(k / 3))], kk = 0.5 + (k / (H - WL)) * 0.4;
    for (let x = 0; x < W; x++) {
      const sx = x + wob;
      if (sx < 0 || sx >= W) continue;
      const c = shipI[sy * W + sx];
      if (!c || shipI[ty * W + x]) continue;
      px[ty * W + x] = mixInt(c, seaC, kk);
    }
  }
  // Écume à l'étrave, le long de la coque et dans le sillage.
  const foam1 = toInt('#f6f6f0'), foam2 = toInt('#cfe3ea'), foam3 = toInt('#d6e7ec');
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const nF = Math.max(6, Math.round((fine ? 18 : 11) * Math.min(1.5, H / 96)));
  for (let k = 0; k < nF; k++) {
    const ph = (t * 1.6 + k * 0.37) % 1;
    put(S.bowX - 2 + Math.round(Math.sin(k * 2.1) * 2 + ph * (fine ? 8 : 5)), S.bowY + Math.round(ph * (WL - S.bowY + 1)), k % 2 ? foam1 : foam2);
  }
  for (let x = S.sternX + 1; x < S.bowX - 1; x++) {
    const xm = Math.max(0, Math.min(S.L, (x + 0.5 - S.X(0)) * S.mpp));
    if ((x + Math.floor(t * 8)) % 7 < 4) put(x, Math.round(S.Y(0, S.C2 - S.halfWL(xm))), foam3);
  }
  for (let k = 0; k < nF; k++) {
    const ph = (t * 1.2 + k * 0.29) % 1;
    put(S.sternX - Math.round(ph * (fine ? 30 : 18) * Math.min(1.5, H / 96) + Math.sin(k) * 2), WL - 2 + Math.round(Math.sin(k * 1.7) * 1.5 + ph * 2), ph < 0.5 ? foam1 : toInt('#a9cad5'));
  }
  if (sky && !S.tiny) {
    const gy = Math.round(H * 0.2), gx = Math.round((W * 0.6 + t * 5) % (W + 20)) - 10, flap = Math.floor(t * 3) % 2, gc = toInt('#3a464e');
    const gull = (x, y) => { put(x - 1, y - flap, gc); put(x, y, gc); put(x + 1, y - flap, gc); if (fine) { put(x - 2, y - flap, gc); put(x + 2, y - flap, gc); } };
    gull(gx, gy); gull(gx + (fine ? 10 : 6), gy + 3);
  }
  return img;
}

// Rendu complet sur un canevas (aperçus, outils) : renvoie { W, H }.
export function renderShipCanvas(canvas, typeId, o) {
  const S = buildShip(typeId, o);
  canvas.width = S.W; canvas.height = S.H;
  canvas.getContext('2d').putImageData(compose(S, o.t ?? 0.7, o.sky !== false), 0, 0);
  return S;
}

// ---------- Dans l'interface ----------
// Pixels CSS par pixel du dessin, selon le style et la largeur du cadre.
function cssScale(st, w) {
  if (st === 'chunky') return w >= 600 ? 3 : w >= 160 ? 2 : 1;
  return w >= 400 ? 2 : 1;
}
const cache = new Map(); // rendus fixes déjà calculés (les panneaux se redessinent souvent)
const CACHE_MAX = 160;
const mounted = new Set();
const animated = new Set();
const esc = (t) => String(t).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

/** Balise à insérer dans le HTML ; le dessin est posé à l'affichage. */
export function pixelShipMarkup(typeId, o) {
  const data = { t: typeId, l: o.laden ? 1 : 0, w: Math.round((o.wear || 0) * 100) / 100, d: Math.round((o.dmg || 0) * 100) / 100, c: o.color || '#3e8ef7', g: o.logo || 'ancre', n: o.name || '', s: String(o.seed ?? o.name ?? typeId), k: o.slot || 'card', y: o.sky === false ? 0 : 1 };
  return `<span class="ship-art px-ship" role="img"${o.title ? ` aria-label="${esc(o.title)}"` : ''} data-px="${esc(JSON.stringify(data))}"></span>`;
}

function paint(el) {
  if (!el.isConnected) { mounted.delete(el); animated.delete(el); return; }
  let data;
  try { data = JSON.parse(el.dataset.px); } catch { return; }
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  const dpr = pixelRatio(), st = shipStyle(); // pixels de l'écran par px CSS, zoom de l'interface compris
  const dev = Math.max(1, Math.round(cssScale(st, w) * dpr));
  const W = Math.ceil((w * dpr) / dev), H = Math.ceil((h * dpr) / dev);
  let cv = el.querySelector('canvas');
  if (!cv) { cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); el.appendChild(cv); }
  const o = { style: st, W, H, laden: !!data.l, wear: data.w, dmg: data.d, color: data.c, logo: data.g, name: data.n, seed: data.s };
  const sky = !!data.y;
  const key = `${st}|${data.t}|${data.l}|${data.w}|${data.d}|${data.c}|${data.g}|${data.n}|${data.s}|${W}x${H}|${sky}`;
  const anim = data.k === 'big' && !reduceMotion();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const cssW = (W * dev) / dpr, cssH = (H * dev) / dpr;
  cv.style.width = `${cssW}px`; cv.style.height = `${cssH}px`;
  cv.style.left = `${Math.round(((w - cssW) / 2) * dpr) / dpr}px`; cv.style.top = `${Math.round(((h - cssH) / 2) * dpr) / dpr}px`;
  const g = cv.getContext('2d');
  if (anim) {
    if (el._pxKey !== key) { el._pxKey = key; el._pxShip = buildShip(data.t, o); el._pxSky = sky; }
    animated.add(el);
    g.putImageData(compose(el._pxShip, performance.now() / 1000, sky), 0, 0);
    startLoop();
    return;
  }
  animated.delete(el);
  let img = cache.get(key);
  if (!img) {
    img = compose(buildShip(data.t, o), 0.7 + (data.s.length % 5) * 0.37, sky);
    cache.set(key, img);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  } else { cache.delete(key); cache.set(key, img); }
  g.putImageData(img, 0, 0);
}

let loopOn = false, lastFrame = 0;
function startLoop() {
  if (loopOn) return;
  loopOn = true;
  const step = (now) => {
    for (const el of animated) if (!el.isConnected) { animated.delete(el); mounted.delete(el); }
    if (!animated.size) { loopOn = false; return; }
    if (now - lastFrame > 125) { // 8 images par seconde : l'esprit des vieux jeux
      lastFrame = now;
      for (const el of animated) {
        const cv = el.querySelector('canvas');
        if (cv && el._pxShip) cv.getContext('2d').putImageData(compose(el._pxShip, now / 1000, el._pxSky), 0, 0);
      }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function repaintAll() {
  for (const el of [...mounted]) { el._pxKey = null; paint(el); }
}

let ro = null;
function mount(el) {
  if (mounted.has(el)) return;
  mounted.add(el);
  if (!ro && typeof ResizeObserver === 'function') ro = new ResizeObserver((entries) => { for (const e of entries) paint(e.target); });
  if (ro) ro.observe(el);
  paint(el);
}
function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.classList?.contains('px-ship')) mount(root);
  root.querySelectorAll?.('.px-ship').forEach(mount);
}
if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
  const start = () => {
    new MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach(scan);
      for (const el of mounted) if (!el.isConnected) { mounted.delete(el); animated.delete(el); ro?.unobserve(el); }
    }).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
    window.addEventListener('uiscale', repaintAll); // la taille de l'interface change : on redessine au nouveau pas
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}
