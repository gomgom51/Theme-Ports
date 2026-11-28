// Boîte à outils du pixel art des scènes : trame, mer, ciel, personnages, navires, engins.
// Tout est dessiné dans le code, sur une toile de 200 × 112 affichée en pixels nets.

// Safari avant la 16 n'a pas roundRect sur le canvas : repli simple (un seul rayon), sinon la scène
// des records s'arrêtait sur une erreur.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r = 0) {
    const rad = Math.max(0, Math.min(typeof r === 'number' ? r : (r?.[0] ?? 0), Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}
export const W = 200, H = 112;
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const hash = (a, b) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
};
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const ease = (p) => 1 - Math.pow(1 - clamp01(p), 3);
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ---------- Outils de dessin ----------
export const R = (g, x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
const cache = new Map();
// Dégradé tramé à l'ancienne (ciel), rendu une fois.
export function bands(key, colors, height) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = height;
  const g = c.getContext('2d');
  const img = g.createImageData(W, height);
  const cols = colors.map(rgb);
  for (let y = 0; y < height; y++) {
    const f = (y / Math.max(1, height - 1)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f)), fr = f - i;
    for (let x = 0; x < W; x++) {
      const col = fr * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cols[i + 1] : cols[i];
      const o = (y * W + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}
// Mer : bandes de couleur et crêtes qui défilent ; mêmes pixels pour un même t (on peut la redessiner par-dessus).
export function sea(g, t, pal, y0, from = y0, to = H, rough = 1) {
  const n = pal.cols.length;
  for (let y = Math.max(from, y0); y < to; y++) {
    const k = Math.min(n - 1, Math.floor(((y - y0) / (H - y0)) ** 0.8 * n));
    R(g, 0, y, W, 1, pal.cols[k]);
    const d = (y - y0) / (H - y0);
    for (let j = 0; j < 2 * rough; j++) {
      const hv = hash(y * 3 + j, 7);
      if (hv % 3) continue;
      const len = 2 + (hv >>> 5) % (3 + Math.round(d * 6));
      const x = ((hv >>> 9) % (W + 30) + t * (6 + d * 18) * (j % 2 ? 1 : -0.6)) % (W + 30) - 15;
      R(g, x, y, len, 1, pal.crest);
    }
  }
}
export function stars(g, t, n = 26, maxY = 40) {
  for (let i = 0; i < n; i++) {
    const x = hash(i, 1) % W, y = hash(i, 2) % maxY;
    if ((hash(i, 3) + Math.floor(t * 2)) % 7 === 0) continue;
    R(g, x, y, 1, 1, i % 5 ? '#c9d3ea' : '#fff3c4');
  }
}
export function vignette(g, color, a) {
  const grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, color.replace('A', a));
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}
export function cone(g, x, y, x1, y1, x2, y2, color, a) {
  g.save(); g.globalAlpha = a; g.fillStyle = color;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill(); g.restore();
}

// ---------- Personnages et objets ----------
// Silhouette de 3 × 7 pixels : tête, corps, jambes.
export function person(g, x, y, body, { head = '#e8b98f', hat = null, legs = '#2a2f38', step = 0 } = {}) {
  x = Math.round(x); y = Math.round(y);
  R(g, x + 1, y, 1, 1, hat || head); if (hat) R(g, x, y, 3, 1, hat);
  R(g, x + 1, y + 1, 1, 1, head);
  R(g, x, y + 2, 3, 3, body);
  R(g, x + (step ? 0 : 0), y + 5, 1, 2, legs); R(g, x + 2, y + 5 + (step ? 1 : 0), 1, 2 - (step ? 1 : 0), legs);
}
export function crate(g, x, y, open = 0) {
  x = Math.round(x); y = Math.round(y);
  R(g, x, y, 8, 6, '#8a5a2b'); R(g, x, y + 2, 8, 1, '#6b4320'); R(g, x + 3, y, 1, 6, '#6b4320');
  if (open > 0) {
    R(g, x, y - 1 - Math.round(open * 3), 8, 1, '#a8733c'); // couvercle soulevé
    R(g, x + 2, y - 1, 4, 2, '#f4f1e6'); R(g, x + 3, y - 1, 1, 2, '#c9a24a'); // le colis, scotché
  } else R(g, x, y - 1, 8, 1, '#a8733c');
}
// Skiff de pirates (16 × 5), avec deux ou trois hommes.
export function skiff(g, x, y, dir = 1, crew = 3, t = 0) {
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r < 3; r++) R(g, x + (dir > 0 ? r : 0), y + r, 16 - r, 1, r === 0 ? '#3b4a3f' : '#2a352d');
  R(g, dir > 0 ? x + 14 : x, y - 1, 2, 1, '#3b4a3f');
  for (let i = 0; i < crew; i++) person(g, x + 3 + i * 4, y - 7 + ((Math.floor(t * 4) + i) % 2), i % 2 ? '#3a3a3a' : '#5a4a3a', { hat: i === 1 ? '#7a1f22' : null });
}
export function wake(g, x, y, dir, t, len = 14) {
  for (let i = 0; i < len; i++) if ((hash(i, Math.floor(t * 8)) & 3) !== 0) R(g, x - dir * (i * 2 + 2), y + (i % 2), 2, 1, 'rgba(240,245,250,0.85)');
}
export function patrolBoat(g, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r < 4; r++) R(g, x + r, y + r, 30 - r * 2, 1, r === 1 ? '#c0392b' : '#e8ecef');
  R(g, x + 9, y - 6, 12, 6, '#f4f6f8'); R(g, x + 10, y - 5, 10, 2, '#2c3e50');
  const blue = Math.floor(t * 3.3) % 2 === 0;
  R(g, x + 13, y - 9, 2, 2, blue ? '#3a7bff' : '#ff3b3b'); R(g, x + 16, y - 9, 2, 2, blue ? '#ff3b3b' : '#3a7bff');
  g.save(); g.globalAlpha = 0.35; g.fillStyle = blue ? '#3a7bff' : '#ff3b3b';
  g.beginPath(); g.arc(x + (blue ? 14 : 17), y - 8, 6, 0, Math.PI * 2); g.fill(); g.restore();
}
export function heli(g, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  R(g, x, y, 12, 5, '#d63a2f'); R(g, x + 2, y + 1, 4, 2, '#cfe8f5'); R(g, x + 12, y + 1, 9, 2, '#d63a2f'); R(g, x + 20, y - 1, 2, 3, '#d63a2f');
  R(g, x + 2, y + 6, 10, 1, '#2a2f38');
  const sp = Math.floor(t * 20) % 2;
  R(g, x - 6 + sp * 2, y - 2, 24, 1, '#2a2f38'); R(g, x + 5, y - 1, 2, 1, '#2a2f38');
}
// Sceau rouge qui s'abat (saisie) : cercle et croix.
export function seal(g, cx, cy, p) {
  if (p <= 0) return;
  const s = 1 + 1.6 * (1 - ease(p * 1.4)), r = 15 * s;
  g.save(); g.globalAlpha = 0.85 * clamp01(p * 3);
  g.strokeStyle = '#d0312d'; g.lineWidth = 3 * s;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - r * 0.55, cy - r * 0.55); g.lineTo(cx + r * 0.55, cy + r * 0.55); g.moveTo(cx + r * 0.55, cy - r * 0.55); g.lineTo(cx - r * 0.55, cy + r * 0.55); g.stroke();
  g.restore();
}
export function padlock(g, x, y, c = '#ffd34d') {
  x = Math.round(x); y = Math.round(y);
  R(g, x + 1, y, 4, 1, c); R(g, x, y + 1, 1, 3, c); R(g, x + 5, y + 1, 1, 3, c);
  R(g, x - 1, y + 3, 8, 6, c); R(g, x + 2, y + 5, 2, 2, '#5a4410');
}
export function quay(g, y) {
  R(g, 0, y, W, H - y, '#5b6068'); R(g, 0, y, W, 1, '#8a9099');
  for (let x = 0; x < W; x += 24) R(g, x, y + 1, 1, H - y, '#50555c');
}
export function gulls(g, t, n, from, dir = -1) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(from[0] + dir * t * (14 + i * 3) + i * 9), y = Math.round(from[1] - t * (5 + i) + i * 5);
    const up = Math.floor(t * 5 + i) % 2;
    R(g, x - 2, y + (up ? -1 : 0), 2, 1, '#f4f4f4'); R(g, x, y, 1, 1, '#f4f4f4'); R(g, x + 1, y + (up ? -1 : 0), 2, 1, '#f4f4f4');
  }
}

export const DAY = { cols: ['#3f7f8c', '#356f7d', '#2c5f6d', '#244f5c'], crest: '#a9d3d6' };
export const NIGHT = { cols: ['#13233c', '#112038', '#0f1c31', '#0c172a'], crest: '#4b6b93' };
export const STORM = { cols: ['#122640', '#10223a', '#0e1d33', '#0b182b'], crest: '#6f8db3' };

// ---------- Outils des scènes du monde ----------
// Trait d'un pixel (Bresenham), net à toutes les pentes.
export function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  g.fillStyle = c;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 600; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// Fumée qui monte et s'étale ; drift > 0 : le vent pousse vers la droite.
export function smoke(g, x, y, t, { n = 10, color = '#3c3c3c', alpha = 0.7, rise = 8, drift = 3, size = 3, seed = 0, life = 3 } = {}) {
  for (let i = 0; i < n; i++) {
    const k = ((t / life) + i / n + (hash(i, seed) % 97) / 970) % 1;
    const s = Math.max(1, Math.round(size * (0.6 + k * 1.6)));
    const px = x + k * drift * life + Math.sin(i * 1.7 + t * 1.3) * 1.2 * k - s / 2, py = y - k * rise * life - s / 2;
    g.globalAlpha = alpha * (1 - k);
    R(g, px, py, s, s, color);
  }
  g.globalAlpha = 1;
}
// Flamme qui vacille (torchère, baril, incendie), pointe vers le haut.
export function flame(g, x, y, t, size = 4, seed = 0) {
  if (size <= 0.4) return;
  const f = Math.floor(t * 10);
  const hgt = Math.max(1, Math.round(size * 2 + (hash(f, seed) % 3) - 1));
  for (let r = 0; r < hgt; r++) {
    const w = Math.max(1, Math.round((1 - r / hgt) * size + ((hash(f + r, seed + 1) % 3) - 1) * 0.5));
    const off = Math.round(Math.sin(t * 9 + r * 0.7 + seed) * (r / hgt) * 1.5);
    R(g, x - Math.floor(w / 2) + off, y - r, w, 1, r < hgt * 0.3 ? '#fff1a8' : r < hgt * 0.65 ? '#ffb030' : '#e8471f');
  }
}
export function disc(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
export function rain(g, t, n = 60, c = 'rgba(190,205,220,0.55)', speed = 120, slant = 25) {
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 11) % (W + 40) + t * slant) % (W + 40) - 20, y = (hash(i, 12) % H + t * speed) % H;
    R(g, x, y, 1, 2, c);
  }
}
export function cloud(g, x, y, w, c = '#f4f6f8') {
  R(g, x, y, w, 4, c); R(g, x + 3, y - 2, w - 8, 2, c); R(g, x + Math.round(w * 0.3), y - 4, Math.round(w * 0.3), 2, c);
}
// Conteneur (8 × 8 à l'échelle des navires grossis deux fois, 10 × 5 sinon).
export function box(g, x, y, c, w = 10, hh = 5) {
  R(g, x, y, w, hh, c);
  for (let i = 1; i < w - 1; i += 2) R(g, x + i, y + 1, 1, hh - 2, 'rgba(0,0,0,0.2)');
  R(g, x, y, w, 1, 'rgba(255,255,255,0.22)');
}
// Portique à conteneurs : pieds en x et x + 16 posés à gy, flèche vers la droite
// (ou relevée, au repos), chariot et palonnier avec sa charge éventuelle.
export function gantry(g, x, gy, { reach = 100, back = 18, color = '#e3b33b', trolley = null, hoist = 0, load = null, raised = false, top = gy - 40 } = {}) {
  R(g, x, top, 2, gy - top, color); R(g, x + 16, top, 2, gy - top, color);
  R(g, x, top + 14, 18, 1, color); line(g, x + 1, gy - 2, x + 16, top + 15, color);
  const apex = top - 12;
  R(g, x + 7, apex, 2, 12, color);
  if (raised) {
    line(g, x + 17, top, x + 34, top - 36, color); line(g, x + 18, top, x + 35, top - 36, color);
    line(g, x + 8, apex, x + 34, top - 36, '#6d747c');
    R(g, x - back, top - 2, back + 18, 2, color);
    return;
  }
  R(g, x - back, top - 2, back + 18 + reach, 2, color);
  line(g, x + 8, apex, x + 18 + reach, top - 2, '#6d747c'); line(g, x + 8, apex, x - back, top - 2, '#6d747c');
  if (trolley != null) {
    R(g, trolley - 2, top, 5, 2, '#3a3f46');
    R(g, trolley, top + 2, 1, Math.max(1, hoist - top - 2), '#3a3f46');
    R(g, trolley - 4, hoist, 9, 1, '#3a3f46');
    if (load) box(g, trolley - 4, hoist + 1, load, 8, 8);
  }
}
// Grue portuaire à flèche relevable (vue de profil) : angle 0 = flèche horizontale vers la droite.
export function luffCrane(g, x, gy, angle, color = '#d9a83a', len = 30) {
  R(g, x - 4, gy - 4, 10, 4, color); R(g, x - 1, gy - 22, 4, 18, color); R(g, x - 3, gy - 26, 8, 5, color);
  const ex = x + 3 + Math.cos(angle) * len, ey = gy - 22 - Math.sin(angle) * len;
  line(g, x + 3, gy - 22, ex, ey, color); line(g, x + 3, gy - 21, ex, ey + 1, color);
  R(g, ex, ey, 1, 6, '#3a3f46');
  return [ex, ey + 6];
}
// Panneau de cours : petite courbe qui se trace puis flèche qui clignote. Sans texte : un pictogramme.
const TONE = { good: '#5fd47e', bad: '#ff5b4f', info: '#ffc94d' };
const ICONS = {
  oil(g, x, y) { R(g, x, y, 5, 7, '#2f6db5'); R(g, x, y + 1, 5, 1, '#9fc3ea'); R(g, x, y + 5, 5, 1, '#9fc3ea'); R(g, x + 1, y - 1, 3, 1, '#2f6db5'); },
  fuel(g, x, y) { R(g, x + 2, y, 1, 1, '#e8c25a'); R(g, x + 1, y + 1, 3, 2, '#e8c25a'); R(g, x, y + 3, 5, 3, '#e8c25a'); R(g, x + 1, y + 6, 3, 1, '#e8c25a'); R(g, x + 1, y + 3, 1, 2, '#fff2b8'); },
  grain(g, x, y) { R(g, x + 2, y + 2, 1, 6, '#b08a2e'); for (let i = 0; i < 3; i++) { R(g, x + 1, y + i * 2, 1, 2, '#f0cf5a'); R(g, x + 3, y + i * 2, 1, 2, '#f0cf5a'); } R(g, x + 2, y - 1, 1, 2, '#f0cf5a'); },
  ore(g, x, y) { R(g, x + 1, y + 2, 4, 2, '#8c5a3e'); R(g, x, y + 4, 7, 3, '#8c5a3e'); R(g, x + 2, y + 3, 1, 1, '#c27a4e'); R(g, x + 4, y + 5, 1, 1, '#c27a4e'); },
  steel(g, x, y) { R(g, x, y, 7, 2, '#c3cbd3'); R(g, x + 3, y + 2, 1, 3, '#c3cbd3'); R(g, x, y + 5, 7, 2, '#c3cbd3'); },
  box(g, x, y) { R(g, x, y + 1, 8, 5, '#e67e22'); for (let i = 1; i < 8; i += 2) R(g, x + i, y + 2, 1, 3, '#b35d14'); },
  cash(g, x, y) { R(g, x, y + 1, 8, 5, '#3f8f4f'); R(g, x + 1, y + 2, 6, 3, '#57a86a'); R(g, x + 3, y + 3, 2, 1, '#e8f5d0'); },
  ship(g, x, y) { R(g, x, y + 4, 8, 2, '#e8ecef'); R(g, x + 1, y + 6, 6, 1, '#e8ecef'); R(g, x + 1, y + 1, 2, 3, '#e8ecef'); R(g, x + 4, y + 2, 3, 2, '#e67e22'); },
};
export function arrow(g, x, y, dir, c) {
  const rows = [[3, 1], [2, 3], [1, 5], [0, 7], [2, 3], [2, 3], [2, 3], [2, 3]];
  rows.forEach(([o, w], i) => R(g, x + o, dir > 0 ? y + i : y + 7 - i, w, 1, c));
}
export function board(g, x, y, dir, t, tone, icon) {
  const c = TONE[tone] || TONE.info;
  R(g, x - 1, y - 1, 50, 30, '#0b1017'); R(g, x, y, 48, 28, '#17202c');
  for (let gx = x + 4; gx < x + 37; gx += 6) for (let gy = y + 4; gy < y + 27; gy += 4) R(g, gx, gy, 1, 1, '#283445');
  ICONS[icon]?.(g, x + 3, dir > 0 ? y + 3 : y + 18);
  const prog = clamp01((t - 0.3) / 2), n = 8;
  const pt = (i) => [x + 4 + i * 4, y + 15 - dir * (i / n) * 9 + ((hash(i, icon?.length || 3) % 5) - 2) * (i > 0 && i < n ? 1 : 0)];
  const upto = prog * n;
  for (let i = 0; i < Math.ceil(upto); i++) {
    const [ax, ay] = pt(i), [bx, by] = pt(i + 1), f = Math.min(1, upto - i);
    line(g, ax, ay, ax + (bx - ax) * f, ay + (by - ay) * f, c);
  }
  if (prog >= 1) {
    const [ex, ey] = pt(n);
    if (Math.floor(t * 3) % 2) R(g, ex - 1, ey - 1, 3, 3, c);
    arrow(g, x + 39, y + 10 - dir + Math.round(Math.sin(t * 5) * dir), dir, c);
  }
}
