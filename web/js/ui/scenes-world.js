// Scènes des événements mondiaux (pétrole, raffineries, récoltes, acier, conteneurs, récession,
// canaux, grèves) : même principe que les scènes d'incident, sans aucun texte dans l'image.
// Les mouvements qui se répètent ont une période qui divise la boucle, pour qu'elle soit sans à-coup.
import { W, H, hash, clamp01, ease, R, bands, sea, stars, vignette, person, drawShip, wake, gulls, DAY, line, smoke, flame, disc, rain, cloud, box, gantry, luffCrane, board } from './pixel.js';

const PI = Math.PI;
const tex = new Map();
function texture(key, w, hh, paint) {
  if (tex.has(key)) return tex.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  paint(c.getContext('2d'));
  tex.set(key, c);
  return c;
}
// Halo lumineux doux (dégradé radial), pour les feux et la fonte.
const glow = (g, x, y, r, c, a) => {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, c); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = Math.min(1, a * 2); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
};

// Chevalet de pompage (balancier qui hoche la tête), en ombre chinoise.
function pumpJack(g, x, gy, t, ph, c = '#24140f') {
  const phi = t * PI + ph, a = Math.sin(phi) * 0.3, ca = Math.cos(a), sa = Math.sin(a);
  const px = x, py = gy - 17;
  R(g, x - 18, gy, 34, 2, c);
  line(g, x - 5, gy, px, py, c); line(g, x + 5, gy, px, py, c); line(g, x - 4, gy, px, py, c);
  const lx = px - 13 * ca, ly = py - 13 * sa, rx = px + 11 * ca, ry = py + 11 * sa;
  line(g, lx, ly, rx, ry, c); line(g, lx, ly + 1, rx, ry + 1, c);
  R(g, lx - 2, ly - 1, 3, 6, c); // tête de cheval
  R(g, lx - 1, ly + 5, 1, Math.max(1, gy - 3 - (ly + 5)), c); // tige
  R(g, lx - 3, gy - 3, 5, 3, c); // tête de puits
  const cx = x + 11, cy = gy - 6, pinx = cx + 3 * Math.cos(phi), piny = cy + 3 * Math.sin(phi);
  R(g, cx - 1, cy, 3, gy - cy, c);
  line(g, rx, ry + 1, pinx, piny, c);
  R(g, pinx - 2, piny - 2, 5, 4, c); // contrepoids
}
function barrel(g, x, y) {
  R(g, x, y, 6, 8, '#2f6db5'); R(g, x, y + 1, 6, 1, '#9fc3ea'); R(g, x, y + 6, 6, 1, '#9fc3ea'); R(g, x + 4, y, 1, 8, 'rgba(0,0,0,0.22)');
}
function valve(g, x, y, a) {
  for (let k = 0; k < 12; k++) { const b = k * PI / 6; R(g, x + Math.round(Math.cos(b) * 3), y + Math.round(Math.sin(b) * 3), 1, 1, '#c0392b'); }
  line(g, x - Math.cos(a) * 3, y - Math.sin(a) * 3, x + Math.cos(a) * 3, y + Math.sin(a) * 3, '#c0392b');
  line(g, x + Math.sin(a) * 3, y - Math.cos(a) * 3, x - Math.sin(a) * 3, y + Math.cos(a) * 3, '#c0392b');
}
function tug(g, x, y, dir, t) {
  R(g, x, y, 12, 2, '#c0392b'); R(g, x + 1, y + 2, 10, 1, '#1d1d1d');
  R(g, x + (dir > 0 ? 3 : 5), y - 3, 4, 3, '#f2efe6'); R(g, x + (dir > 0 ? 4 : 6), y - 5, 1, 2, '#1d1d1d');
  for (let i = 0; i < 6; i++) if ((hash(i, Math.floor(t * 8)) & 3) !== 0) R(g, dir > 0 ? x - 2 - i : x + 13 + i, y + 1 + (i % 2), 1, 1, '#e8f6ff');
}
function truck(g, x, gy, load) {
  R(g, x - 12, gy - 4, 24, 2, '#2a2f38');
  R(g, x + 6, gy - 11, 6, 7, '#f2efe6'); R(g, x + 9, gy - 10, 3, 3, '#7fb6d8');
  for (const wx of [-10, -5, 7]) R(g, x + wx, gy - 2, 3, 2, '#111');
  if (load) box(g, x - 4, gy - 12, load, 8, 8);
}
// Navire vu du dessus, cap vers la droite à l'angle a (longueur 100 × 16 à l'échelle 1).
function topShipSprite(color, kind) {
  const key = `top${color}${kind}`;
  if (tex.has(key)) return tex.get(key);
  const c = document.createElement('canvas');
  c.width = 104; c.height = 20;
  const g = c.getContext('2d');
  for (let x = 0; x < 100; x++) {
    const w = x > 80 ? Math.round(16 * Math.sqrt(1 - ((x - 80) / 20) ** 2)) : x < 4 ? 14 : 16;
    R(g, x + 2, 10 - w / 2, 1, w, '#20262d');
    if (w > 2) R(g, x + 2, 11 - w / 2, 1, w - 2, kind === 'navy' ? '#8a949d' : color);
  }
  if (kind === 'box') for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) R(g, 22 + i * 7, 4 + j * 6, 6, 5, BOX[(i * 2 + j * 3) % 6]);
  else if (kind === 'tank') { R(g, 20, 9, 64, 2, '#9aa3ab'); for (let x = 24; x < 84; x += 10) R(g, x, 6, 1, 8, '#9aa3ab'); }
  else if (kind === 'bulk') for (let i = 0; i < 6; i++) R(g, 22 + i * 10, 5, 8, 10, i % 2 ? '#7d8389' : '#8d939a');
  else if (kind === 'navy') { R(g, 38, 6, 22, 8, '#b3bcc4'); R(g, 70, 8, 6, 4, '#5b6470'); R(g, 76, 9, 8, 2, '#5b6470'); R(g, 6, 5, 16, 10, '#7d8790'); R(g, 11, 9, 6, 2, '#f2efe6'); }
  if (kind !== 'navy') { R(g, 6, 3, 12, 14, '#f2efe6'); R(g, 9, 7, 5, 6, color); R(g, 10, 8, 3, 4, '#1b1b1b'); }
  tex.set(key, c);
  return c;
}
function topShip(g, x, y, a, color, kind, scale = 1) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(a); g.scale(scale, scale);
  g.drawImage(topShipSprite(color, kind), -52, -10);
  g.restore();
}
function topTug(g, x, y, a, t) {
  g.save(); g.translate(x, y); g.rotate(a);
  for (let i = 0; i < 8; i++) if ((hash(i, Math.floor(t * 8)) & 3) !== 0) R(g, -8 - i * 2, (i % 2) - 1, 2, 1, '#e8f6ff');
  R(g, -6, -3, 12, 6, '#c0392b'); R(g, 6, -2, 2, 4, '#c0392b'); R(g, -2, -2, 4, 4, '#f2efe6');
  g.restore();
}
const BOX = ['#c0392b', '#2e86c1', '#d4ac0d', '#27ae60', '#8e44ad', '#e67e22'];

// Aciérie : chaude (relance) ou froide (ralentissement), avec son quai à minerai.
function steelMill(g, t, hot) {
  const C = hot ? '#2a1c2a' : '#5d636b', C2 = hot ? '#36243a' : '#6c727a';
  sea(g, t, hot ? { cols: ['#2b2340', '#251f39', '#201b32', '#1b172b'], crest: '#a0603f' } : { cols: ['#5f6d77', '#56646e', '#4d5b65', '#44525c'], crest: '#94a3ad' }, 86);
  drawShip(g, hot ? '#2c4a6b' : '#4a5866', 170, 104, 0, 1, 'bulk');
  R(g, 0, 86, 132, 26, hot ? '#1a1218' : '#4a4f56'); R(g, 0, 90, 132, 1, hot ? '#2c2026' : '#5c6168');
  // Minerai et convoyeur.
  for (let r = 0; r < 16; r++) { const w = 2 + r * 2.4; R(g, 18 - w / 2, 70 + r, w, 1, hot ? '#6e3a2c' : '#7d5f50'); }
  line(g, 24, 78, 60, 38, C); line(g, 24, 79, 60, 39, C); R(g, 34, 68, 1, 18, C); R(g, 46, 54, 1, 32, C);
  for (let i = 0; i < 6; i++) { const k = hot ? (t * 0.5 + i / 6) % 1 : i / 6 + 0.05; R(g, 24 + k * 36, 77 - k * 40, 2, 1, hot ? '#c26a3e' : '#8a6a5a'); }
  // Haut fourneau, cowpers, cheminées, halle de coulée.
  for (let y = 36; y < 86; y++) { const w = Math.round(8 + (y - 36) * 0.16); R(g, 66 - w / 2, y, w, 1, C); }
  R(g, 62, 30, 8, 6, C); line(g, 69, 32, 82, 42, C); R(g, 81, 42, 2, 10, C);
  for (const x of [84, 94, 104]) { R(g, x, 50, 8, 36, C2); R(g, x + 1, 49, 6, 1, C2); R(g, x + 2, 48, 4, 1, C2); }
  R(g, 116, 20, 4, 66, C); R(g, 126, 30, 3, 56, C);
  R(g, 46, 74, 30, 12, C2); R(g, 46, 73, 30, 1, C);
  // Grue à grappin du quai.
  const ang = hot ? 0.95 + 0.35 * Math.sin(t * PI) : 1.3;
  const [hx, hy] = luffCrane(g, 136, 86, ang, hot ? '#d9a83a' : '#8d8a7a', 30);
  R(g, hx - 2, hy, 5, 3, '#3a3f46');
  if (hot) {
    glow(g, 60, 84, 34, '#ff7a2a', 0.18 + 0.05 * Math.sin(t * 2 * PI * 3));
    for (let i = 0; i < 5; i++) R(g, 49 + i * 6, 78, 2, 2, '#ffcf6b'); // fenêtres de la halle
    R(g, 54, 78, 2, 7, Math.floor(t * 10) % 2 ? '#ffd36b' : '#ffb030'); // la fonte coule
    R(g, 44, 85, 18, 4, '#3a2a2a'); R(g, 46, 85, 14, 1, '#ff9a1f'); // wagon-poche
    for (let i = 0; i < 10; i++) {
      const k = (t * 1.5 + i / 10) % 1, s = hash(i, 4) % 2 ? 1 : -1, v = 0.5 + (hash(i, 5) % 50) / 100;
      R(g, 55 + s * k * 14 * v, 84 - Math.sin(k * PI) * 9 * v + k * 3, 1, 1, k < 0.5 ? '#fff1a8' : '#ff9a1f');
    }
    smoke(g, 118, 19, t, { n: 12, color: '#9a8c94', alpha: 0.55, rise: 5, drift: 4, size: 3, life: 2 });
    smoke(g, 127, 29, t, { n: 10, color: '#8a7c84', alpha: 0.5, rise: 5, drift: 4, size: 3, seed: 3, life: 2 });
    smoke(g, 66, 29, t, { n: 8, color: '#e0d8e0', alpha: 0.45, rise: 4, drift: 3, size: 2, seed: 5, life: 2 });
    for (const [x, y] of [[65, 44], [66, 60], [86, 56], [106, 62], [117, 40]]) R(g, x, y, 1, 1, '#ffcf6b');
  } else {
    R(g, 44, 85, 18, 4, '#5a5f66');
    smoke(g, 118, 19, t, { n: 4, color: '#a0a6ae', alpha: 0.25, rise: 3, drift: 2, size: 2, life: 2 });
  }
}

export const WORLD_SCENES = {
  // Le pétrole s'envole : champ pétrolifère au couchant, chevalets de pompage, torchère.
  oilUp: {
    title: 'Le pétrole s\'envole', mood: 'bad', loop: [2.4, 6.4],
    draw(g, t) {
      g.drawImage(bands('sky-desert', ['#3b1d3a', '#7a2f3c', '#c4553a', '#ec8f43', '#f7c56a'], 70), 0, 0);
      disc(g, 150, 64, 12, '#ffe08a');
      for (let x = 0; x < W; x++) R(g, x, 62 + Math.round(3 * Math.sin(x / 23) + 2 * Math.sin(x / 9 + 1)), 1, 10, '#9a5634');
      g.drawImage(bands('dunes', ['#8e4a2c', '#7a3e26', '#5e301e', '#40200f'], 42), 0, 70);
      for (const tx of [160, 178]) { R(g, tx, 56, 15, 14, '#3a2420'); R(g, tx + 1, 55, 13, 1, '#3a2420'); R(g, tx, 60, 15, 1, '#4a302a'); }
      R(g, 122, 28, 2, 42, '#2b1a1a'); R(g, 120, 66, 6, 4, '#2b1a1a');
      glow(g, 123, 24, 7, '#ff9a3a', 0.25);
      flame(g, 123, 27, t, 4, 3);
      smoke(g, 123, 16, t, { n: 8, color: '#2a1a1a', alpha: 0.5, rise: 4, drift: 3, size: 3, life: 2 });
      pumpJack(g, 34, 78, t, 0);
      pumpJack(g, 84, 86, t, 1.3);
      board(g, 146, 4, 1, t, 'bad', 'oil');
      vignette(g, 'rgba(60,0,0,A)', 0.3);
    },
  },
  // Surproduction : cuves pleines, barils qui s'empilent, pétroliers chargés au mouillage.
  oilDown: {
    title: 'Surproduction pétrolière', mood: 'good', loop: [2.6, 4.6],
    draw(g, t) {
      g.drawImage(bands('sky-clear', ['#7fb6d8', '#9cc8e2', '#bcdbec', '#d9ebf2'], 58), 0, 0);
      cloud(g, 18, 20, 26); cloud(g, 104, 30, 20);
      sea(g, t, DAY, 58, 58, 86);
      ['#2c3e50', '#3d2c2c', '#24323c', '#463a2a'].forEach((c, i) => drawShip(g, c, 70 + i * 34, 68 + (i % 2) * 6 + Math.round(Math.sin(t * PI + i) * 0.6), 0, 0.5, 'tank'));
      R(g, 0, 86, W, 26, '#5b6068'); R(g, 0, 86, W, 1, '#8a9099');
      for (const [x, w, hh] of [[4, 22, 32], [28, 18, 26]]) {
        R(g, x, 86 - hh, w, hh, '#d9dcd6'); R(g, x, 86 - hh, w, 2, '#eef0ea'); R(g, x + w - 3, 86 - hh, 3, hh, '#b5b9b2');
        for (let k = 7; k < hh; k += 7) R(g, x, 86 - hh + k, w, 1, '#c3c6bf');
      }
      R(g, 8, 57, 3, 26, '#4a4f56'); R(g, 9, 58, 1, 24, '#3f8cd0'); if (Math.floor(t * 3) % 2) R(g, 8, 56, 3, 2, '#ff3b3b'); // jauge au maximum
      R(g, 46, 80, 26, 2, '#6d747c'); R(g, 70, 80, 2, 6, '#6d747c');
      valve(g, 56, 76, t * PI); R(g, 56, 79, 1, 1, '#6d747c');
      let i = 0;
      for (const sx of [80, 112, 144]) for (const [row, cnt] of [[0, 3], [1, 2], [2, 1]]) for (let j = 0; j < cnt; j++, i++) {
        const p = clamp01((t - 0.2 - i * 0.12) / 0.25);
        if (p > 0) barrel(g, sx + row * 3.5 + j * 7, 100 - row * 8 - (1 - ease(p)) * 10);
      }
      board(g, 146, 4, -1, t, 'good', 'oil');
    },
  },
  // Raffineries en panne : la nuit, les lumières s'éteignent, une unité brûle, fumée noire.
  refinery: {
    title: 'Panne de raffineries', mood: 'bad', loop: [2.6, 4.6],
    draw(g, t) {
      g.drawImage(bands('sky-night3', ['#060a14', '#0b1324', '#131d36', '#1d2a48'], 86), 0, 0);
      stars(g, t, 30, 50);
      R(g, 0, 86, W, 26, '#0d1018');
      const C = '#1b2130';
      const cols = [[30, 6, 28], [42, 5, 40], [52, 7, 34], [108, 6, 30], [118, 4, 44]];
      R(g, 24, 70, 110, 16, C);
      for (const [x, w, top] of cols) { R(g, x, top, w, 86 - top, C); R(g, x - 1, top + 6, w + 2, 1, C); R(g, x - 1, top + 16, w + 2, 1, C); }
      for (const [x, y] of [[152, 74], [172, 76]]) { disc(g, x, y, 8, C); R(g, x - 6, y + 6, 1, 86 - y - 6, C); R(g, x + 5, y + 6, 1, 86 - y - 6, C); }
      R(g, 20, 76, 160, 1, '#262e40'); R(g, 20, 80, 160, 1, '#262e40');
      let j = 0;
      for (const [x, w, top] of cols) for (let y = top + 3; y < 84; y += 7, j++) if (t < 0.5 + (hash(j, 5) % 20) * 0.08 || j % 7 === 0) R(g, x + (j % 2 ? w - 1 : 0), y, 1, 1, '#ffd36b');
      for (const [x, w, top] of cols) R(g, x + Math.floor(w / 2), top - 1, 1, 1, Math.floor(t * 1.5) % 2 ? '#ff3b3b' : '#5a1414');
      glow(g, 55, 32, 8, '#ff7a2a', 0.22 + 0.08 * Math.sin(t * 2 * PI * 2));
      flame(g, 55, 33, t, 3, 2);
      smoke(g, 55, 26, t, { n: 16, color: '#050505', alpha: 0.85, rise: 6, drift: 4, size: 5, life: 2 });
      R(g, 88, 36, 2, 50, C);
      flame(g, 89, 35, t, 4 * (1 - clamp01(t / 1.6)), 4); // la torchère s'éteint
      board(g, 146, 4, 1, t, 'bad', 'fuel');
    },
  },
  // Récolte record : la moissonneuse avance, le grain coule dans la remorque.
  harvest: {
    title: 'Récolte record', mood: 'good', loop: [2.4, 6.4],
    draw(g, t) {
      g.drawImage(bands('sky-bright', ['#78b4e0', '#96c5e8', '#b6d8ef', '#d6e9f4'], 62), 0, 0);
      cloud(g, 70, 18, 28); cloud(g, 128, 28, 20);
      for (let x = 0; x < W; x++) R(g, x, 54 + Math.round(3 * Math.sin(x / 31 + 1) + 2 * Math.sin(x / 13)), 1, 10, '#8fae62');
      for (const x of [162, 172, 182]) { R(g, x, 40, 8, 24, '#d9dcd6'); R(g, x + 1, 38, 6, 2, '#b9bdb6'); R(g, x + 3, 36, 2, 2, '#b9bdb6'); R(g, x + 6, 40, 2, 24, '#bfc3bc'); }
      const wheat = texture('wheat', 240, 50, (c) => {
        R(c, 0, 0, 240, 50, '#d6ad3f');
        for (let y = 0; y < 50; y++) for (let x = 0; x < 240; x++) { const hv = hash(x % 40, y); if (hv % 5 === 0) R(c, x, y, 1, y > 25 ? 2 : 1, hv % 3 ? '#b88c2a' : '#f0cf5a'); }
      });
      const stub = texture('stubble', 240, 50, (c) => {
        R(c, 0, 0, 240, 50, '#c8a862');
        for (let y = 1; y < 50; y += 3) for (let x = 0; x < 240; x++) if (hash(x % 40, y + 99) % 3 === 0) R(c, x, y, 1, 1, '#a88a48');
      });
      const off = (t * 10) % 40;
      const clip = (x, y, w, hh, img) => { g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip(); g.drawImage(img, -off, 62); g.restore(); };
      clip(0, 62, W, 16, wheat); // champ encore debout, au fond
      clip(110, 78, W - 110, 12, wheat); // l'andain que la moissonneuse attaque
      clip(0, 78, 110, 12, stub); // derrière elle, les chaumes
      clip(0, 90, W, 22, stub); // déjà moissonné, devant
      for (let i = 0; i < 12; i++) R(g, (hash(i, 6) % W + t * 50) % W, 63 + hash(i, 7) % 14, 3, 1, '#f6dc78'); // vent dans les blés
      const bx = 72, by = 72;
      // Tracteur et remorque à grain, à côté.
      R(g, bx - 33, by + 2, 20, 9, '#b13a2a'); R(g, bx - 32, by, 18, 2, '#f0cf5a'); R(g, bx - 29, by - 1, 12, 1, '#f0cf5a');
      R(g, bx - 31, by + 11, 3, 3, '#222'); R(g, bx - 19, by + 11, 3, 3, '#222');
      R(g, bx - 46, by + 4, 10, 7, '#2e7a3a'); R(g, bx - 42, by - 1, 5, 5, '#2e7a3a'); R(g, bx - 41, by, 3, 3, '#bfe3f0'); R(g, bx - 36, by + 8, 3, 1, '#2a2f38');
      disc(g, bx - 44, by + 12, 3.5, '#222'); disc(g, bx - 38, by + 13, 2, '#222');
      // La moissonneuse-batteuse.
      R(g, bx, by, 26, 12, '#3f8f3a'); R(g, bx, by, 26, 2, '#57a84f');
      R(g, bx + 18, by - 8, 9, 8, '#3f8f3a'); R(g, bx + 19, by - 7, 7, 4, '#bfe3f0'); R(g, bx + 17, by - 9, 11, 1, '#2d6a29');
      R(g, bx + 27, by + 9, 12, 4, '#c8c8c8'); R(g, bx + 26, by + 6, 2, 7, '#3f8f3a');
      for (let k = 0; k < 4; k++) { const a = t * PI + k * PI / 2; line(g, bx + 33, by + 6, bx + 33 + Math.cos(a) * 5, by + 6 + Math.sin(a) * 5, '#d94a2a'); }
      disc(g, bx + 18, by + 13, 5, '#222'); disc(g, bx + 18, by + 13, 2, '#888');
      disc(g, bx + 5, by + 14, 3.5, '#222'); disc(g, bx + 5, by + 14, 1.2, '#888');
      line(g, bx + 4, by + 1, bx - 20, by - 8, '#2d6a29'); line(g, bx + 4, by + 2, bx - 20, by - 7, '#2d6a29');
      for (let k = 0; k < 8; k++) { const q = (t * 2 + k / 8) % 1; R(g, bx - 21 + (hash(k, 1) % 3), by - 6 + q * 6, 1, 1, '#f0cf5a'); }
      smoke(g, bx - 1, by + 8, t, { n: 10, color: '#e8d9a0', alpha: 0.6, rise: 1, drift: -6, size: 2, life: 2 });
      board(g, 4, 4, 1, t, 'good', 'ship');
    },
  },
  // Sécheresse : terre craquelée, soleil écrasant, tourbillon de poussière.
  drought: {
    title: 'Sécheresse', mood: 'info', loop: [2.4, 10.4],
    draw(g, t) {
      g.drawImage(bands('sky-hot', ['#f7efc9', '#f5e2a3', '#f0d184', '#ebbf6c'], 62), 0, 0);
      disc(g, 34, 22, 11, '#fff6d0'); disc(g, 34, 22, 8, '#ffffff');
      for (let k = 0; k < 12; k++) { const a = t * PI / 12 + k * PI / 6, r1 = 18 + (k % 2) * 4; line(g, 34 + Math.cos(a) * 14, 22 + Math.sin(a) * 14, 34 + Math.cos(a) * r1, 22 + Math.sin(a) * r1, '#fff1b0'); }
      const cracks = texture('cracks', W, 50, (c) => {
        c.drawImage(bands('earth', ['#d2a868', '#c39857', '#b48848', '#a3793d'], 50), 0, 0);
        const rows = [];
        for (let y = 0, row = 0; y < 50; row++) {
          const hh = 3 + y * 0.22, w = hh * 3.2, r = [];
          for (let x = -w, n = 0; x < W + w; x += w, n++) r.push([x + (hash(row, n) % 100) / 100 * w * 0.5, y + (hash(n, row + 7) % 100) / 100 * hh * 0.5]);
          rows.push(r); y += hh;
        }
        rows.forEach((r, i) => r.forEach(([x, y], j) => {
          if (r[j + 1]) { line(c, x, y + 1, r[j + 1][0], r[j + 1][1] + 1, '#e2bf84'); line(c, x, y, r[j + 1][0], r[j + 1][1], '#6e4a26'); }
          const nx = rows[i + 1];
          if (nx) { const k = nx.reduce((b, p, n) => (Math.abs(p[0] - x) < Math.abs(nx[b][0] - x) ? n : b), 0); line(c, x, y, nx[k][0], nx[k][1], '#6e4a26'); }
        }));
      });
      g.drawImage(cracks, 0, 62);
      for (let y = 58; y < 66; y++) g.drawImage(g.canvas, 0, y, W, 1, Math.round(Math.sin(t * PI + y) * 1.5), y, W, 1); // brume de chaleur
      const T = '#5a3d22';
      R(g, 150, 50, 2, 26, T); line(g, 151, 58, 142, 48, T); line(g, 151, 54, 160, 44, T); line(g, 146, 53, 144, 46, T); line(g, 156, 49, 159, 42, T);
      for (let i = 0; i < 14; i++) {
        const x = 10 + i * 9 + (hash(i, 2) % 4), y = 76 + (i % 3) * 6, sw = Math.round(Math.sin(t * PI + i) * 0.6);
        line(g, x, y, x + 1 + sw, y - 6, '#8a6a3a'); line(g, x + 1 + sw, y - 6, x + 4 + sw, y - 4, '#8a6a3a');
      }
      const dx = (t * 35) % 280 - 40;
      for (let k = 0; k < 30; k++) { const hh = k / 30, a = t * 4 * PI + k; R(g, dx + Math.cos(a) * (2 + hh * 7), 88 - hh * 28 + Math.sin(a) * 1.5, 1, 1, 'rgba(150,110,60,0.75)'); }
      board(g, 146, 4, 1, t, 'info', 'grain');
    },
  },
  // Plan de relance : l'aciérie tourne à plein, le minerai arrive par vraquier.
  steelBoom: {
    title: 'Plan de relance en Asie', mood: 'good', loop: [2.4, 4.4],
    draw(g, t) {
      g.drawImage(bands('sky-mill', ['#1c1530', '#3b1f3f', '#6b2e45', '#a3473f', '#d8763f'], 86), 0, 0);
      steelMill(g, t, true);
      board(g, 146, 4, 1, t, 'good', 'ore');
    },
  },
  // Ralentissement industriel : la même aciérie, froide, sous un ciel gris.
  steelDown: {
    title: 'Ralentissement industriel', mood: 'bad', loop: [2.4, 4.4],
    draw(g, t) {
      g.drawImage(bands('sky-overcast', ['#8b939c', '#9aa2ab', '#a9b0b8', '#b6bcc3'], 86), 0, 0);
      steelMill(g, t, false);
      board(g, 146, 4, -1, t, 'bad', 'ore');
    },
  },
  // Flambée de l'acier : en cale sèche, le soudeur répare la coque, la tôle pend au portique.
  steelPrice: {
    title: 'Flambée de l\'acier', mood: 'bad', loop: [2.4, 4.4],
    draw(g, t, o) {
      g.drawImage(bands('sky-yard', ['#a9c8dc', '#bcd5e4', '#cfe1eb', '#e0ebf0'], 86), 0, 0);
      const Y = '#c0392b';
      R(g, 8, 38, 3, 48, Y); R(g, 186, 38, 3, 48, Y); R(g, 6, 36, 186, 4, Y);
      for (let x = 10; x < 186; x += 8) R(g, x, 37, 4, 2, '#f2efe6');
      const sw = Math.round(Math.sin(t * PI) * 2);
      R(g, 66, 40, 8, 3, '#3a3f46'); R(g, 70, 43, 1, 10, '#3a3f46');
      line(g, 70, 53, 62 + sw, 56, '#3a3f46'); line(g, 70, 53, 79 + sw, 56, '#3a3f46');
      R(g, 61 + sw, 56, 20, 2, '#8f979e'); R(g, 61 + sw, 56, 20, 1, '#b8c0c8');
      R(g, 0, 86, W, 26, '#9a9890'); R(g, 0, 86, W, 1, '#b8b6ae');
      R(g, 34, 87, 132, 20, '#6e6c66'); R(g, 34, 105, 132, 2, '#57554f');
      drawShip(g, o.color, 100, 100, 0, 2);
      for (let x = 52; x < 150; x += 12) R(g, x, 101, 6, 4, '#8a6a3a');
      // Échafaudage contre l'étrave.
      for (const x of [154, 162]) R(g, x, 70, 1, 35, '#6d747c');
      for (let y = 74; y < 105; y += 9) R(g, 153, y, 11, 1, '#8a6a3a');
      g.save(); g.scale(2, 2); person(g, 78, 37 - 7 / 2 + 1, '#2e5e8a', { hat: '#f2c230' }); g.restore();
      const on = hash(Math.floor(t * 12), 3) % 3 !== 0;
      if (on) { glow(g, 151, 84, 6, '#cfe8ff', 0.35); R(g, 150, 83, 2, 2, '#ffffff'); }
      for (let i = 0; i < 10; i++) { const k = (t * 1.5 + i / 10) % 1; R(g, 151 + ((hash(i, 2) % 7) - 3) * k * 3, 85 + k * k * 18, 1, 1, k < 0.4 ? '#fff1a8' : '#ff9a1f'); }
      board(g, 146, 4, 1, t, 'bad', 'steel');
    },
  },
  // Ruée sur les conteneurs : le portique décharge sans arrêt, les camions se relaient.
  containers: {
    title: 'Ruée sur les conteneurs', mood: 'good', loop: [3.2, 9.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-sunny', ['#6fb0dd', '#8cc2e6', '#acd4ee', '#cde5f3'], 62), 0, 0);
      disc(g, 112, 16, 7, '#fff3c0');
      sea(g, t, DAY, 62);
      drawShip(g, o.color, 136, 96, 0, 2);
      R(g, 0, 70, 74, 42, '#8d9097'); R(g, 0, 70, 74, 1, '#b5b8be'); R(g, 72, 70, 2, 42, '#5b6068');
      for (let i = 0; i < 4; i++) for (let k = 0; k < [3, 2, 3, 1][i]; k++) box(g, 2 + i * 11, 65 - k * 5, BOX[(i * 2 + k) % 6]);
      const n = Math.floor(t / 3.2), k = (t / 3.2) % 1;
      const bay = n % 2 ? 150 : 128, next = n % 2 ? 128 : 150, under = 58, LIFT = 52, DECK = 69, TRUCK = 88, load = BOX[n % 6];
      let tx, hy, carry = null;
      if (k < 0.15) { tx = bay; hy = LIFT + (DECK - LIFT) * (k / 0.15); }
      else if (k < 0.3) { tx = bay; hy = DECK - (DECK - LIFT) * ((k - 0.15) / 0.15); carry = load; }
      else if (k < 0.55) { tx = bay + (under - bay) * ease((k - 0.3) / 0.25); hy = LIFT; carry = load; }
      else if (k < 0.7) { tx = under; hy = LIFT + (TRUCK - LIFT) * ((k - 0.55) / 0.15); carry = load; }
      else if (k < 0.8) { tx = under; hy = TRUCK - (TRUCK - LIFT) * ((k - 0.7) / 0.1); }
      else { tx = under + (next - under) * ease((k - 0.8) / 0.2); hy = LIFT; }
      const tk = k < 0.2 ? -40 : k < 0.5 ? -30 + 88 * ease((k - 0.2) / 0.3) : k < 0.78 ? 58 : 58 - 98 * Math.pow((k - 0.78) / 0.22, 2);
      truck(g, tk, 100, k >= 0.7 ? load : null);
      gantry(g, 50, 100, { reach: 118, back: 16, top: 50, trolley: tx, hoist: hy, load: carry });
      gulls(g, (t % 3.2), 2, [170, 40], -1);
      board(g, 146, 4, 1, t, 'good', 'box');
    },
  },
  // Récession : pluie, grues relevées, navires désarmés au mouillage.
  recession: {
    title: 'Récession mondiale', mood: 'bad', loop: [2.4, 4.4],
    draw(g, t) {
      g.drawImage(bands('sky-rain', ['#6d757e', '#7b838c', '#8a929a', '#98a0a7'], 58), 0, 0);
      sea(g, t, { cols: ['#56656e', '#4d5c65', '#44535c', '#3b4a53'], crest: '#8a9aa3' }, 58, 58, 88);
      [[44, 70, 'tank'], [104, 76, 'bulk'], [160, 72, 'box']].forEach(([x, y, kind], i) => {
        const b = Math.round(Math.sin(t * PI + i) * 0.5);
        drawShip(g, '#6b5a4e', x, y + b, 0, 0.5, kind, '#5a3a2a');
        line(g, x + 12, y - 3 + b, x + 16, y + 2, '#2b2f33'); // chaîne d'ancre
      });
      R(g, 0, 88, W, 24, '#5b6068'); R(g, 0, 88, W, 1, '#8a9099');
      for (let x = 0; x < W; x += 24) { R(g, x, 89, 1, 23, '#50555c'); R(g, x + 1, 100 + (x % 5), 1, 2, '#5a7a3a'); }
      luffCrane(g, 30, 88, 1.38, '#8d7a4a'); luffCrane(g, 72, 88, 1.42, '#8d7a4a');
      R(g, 112, 85, 4, 3, '#2b2f33'); R(g, 113, 82, 3, 2, '#f4f4f4'); R(g, 115, 81, 1, 1, '#f4f4f4'); R(g, 116, 81, 1, 1, '#e8a33b');
      R(g, 128, 102, 20, 2, '#7d8890'); R(g, 60, 106, 14, 1, '#7d8890');
      rain(g, t, 70, 'rgba(200,210,220,0.5)', 120, 20);
      board(g, 146, 4, -1, t, 'bad', 'ship');
    },
  },
  // Trop de navires : le chantier lance encore un navire, la rade est déjà pleine.
  overcapacity: {
    title: 'Trop de navires', mood: 'bad', loop: [3.6, 5.6],
    draw(g, t) {
      g.drawImage(bands('sky-clear2', ['#86b9d9', '#a2cae3', '#c0dbec', '#dcebf3'], 60), 0, 0);
      sea(g, t, DAY, 60);
      for (let i = 0; i < 14; i++) {
        const x = 76 + (i * 37) % 124 + (hash(i, 3) % 8), y = 63 + (i % 3) * 3;
        drawShip(g, ['#2c3e50', '#7a1f22', '#24323c', '#3d6b4a'][i % 4], x, y, 0, 0.3, ['box', 'tank', 'bulk'][i % 3]);
      }
      // Le chantier et sa cale de lancement.
      g.fillStyle = '#8d9097'; g.beginPath(); g.moveTo(0, 56); g.lineTo(34, 56); g.lineTo(74, 80); g.lineTo(74, H); g.lineTo(0, H); g.fill();
      line(g, 4, 62, 74, 76, '#5b6068'); line(g, 4, 64, 74, 78, '#5b6068');
      luffCrane(g, 14, 58, 0.9, '#d9a83a', 24);
      // Le prochain navire, déjà en construction (membrures).
      if (t > 2.6) { for (let x = 6; x < 40; x += 3) R(g, x, 52 + (x - 6) * 0.2, 1, 9 - Math.abs(x - 23) * 0.15, '#a0522d'); R(g, 6, 61 + 0, 34, 1, '#a0522d'); }
      const p = clamp01((t - 0.6) / 2.2), s = p * p * (3 - 2 * p);
      const x = 26 + s * 100, onSlip = x < 70;
      const y = onSlip ? 63 + (x - 4) * 0.2 : 76 + Math.min(2, (x - 70) * 0.1) + Math.sin(t * PI) * 0.6 * clamp01((x - 90) / 20);
      drawShip(g, '#2f6f8f', x, y, onSlip ? 0.2 : 0.2 * (1 - clamp01((x - 70) / 22)), 1, 'bulk');
      const sp = clamp01((t - 1.7) / 1.4);
      if (sp > 0 && sp < 1) for (let i = 0; i < 16; i++) { const a = PI * (0.15 + 0.7 * (hash(i, 1) % 100) / 100), v = 6 + hash(i, 2) % 10; R(g, 96 + Math.cos(a) * v * sp * 2, 78 - Math.sin(a) * v * sp * 3 + sp * sp * 14, 1, 1, '#eaf6fb'); }
      board(g, 146, 4, -1, t, 'bad', 'ship');
    },
  },
  // Reprise : à l'aube, les navires rentrent au port à la file, les grues tournent.
  recovery: {
    title: 'Reprise du commerce mondial', mood: 'good', loop: [3.2, 19.2],
    draw(g, t) {
      g.drawImage(bands('sky-dawn', ['#5d86b8', '#8fa6c6', '#d9b39a', '#f2c48a', '#f8dca0'], 64), 0, 0);
      disc(g, 128, 66 - ease(t / 3) * 10, 10, '#ffe7a8');
      sea(g, t, { cols: ['#4f7f96', '#447389', '#3a667b', '#30586c'], crest: '#f3d9a0' }, 64);
      for (let i = 0; i < 4; i++) {
        const x = 250 - ((t * 15 + i * 60) % 240), y = 72 + (i % 2) * 4;
        drawShip(g, ['#2c3e50', '#7a1f22', '#2f6f8f', '#3d6b4a'][i], x, y, 0, [-0.6, 0.6], ['box', 'tank', 'bulk', 'box'][i]);
        wake(g, x + 16, y, -1, t, 7);
      }
      // Cap et phare, à gauche (les navires y disparaissent derrière).
      g.fillStyle = '#3d5a3a'; g.beginPath(); g.moveTo(0, 58); g.lineTo(18, 60); g.lineTo(34, 74); g.lineTo(34, 84); g.lineTo(0, 84); g.fill();
      R(g, 12, 44, 5, 16, '#f2efe6'); R(g, 12, 48, 5, 3, '#c0392b'); R(g, 12, 55, 5, 3, '#c0392b'); R(g, 11, 41, 7, 3, '#2b2f33'); R(g, 13, 42, 3, 1, '#ffe7a8');
      R(g, 0, 96, W, 16, '#5b6068'); R(g, 0, 96, W, 1, '#8a9099');
      for (let i = 0; i < 3; i++) box(g, 4 + i * 11, 91, BOX[i * 2]);
      const [hx, hy] = luffCrane(g, 150, 96, 0.55 + 0.35 * Math.sin(t * PI / 2), '#d9a83a', 30);
      box(g, hx - 4, hy, BOX[1]);
      gulls(g, (t % 4), 3, [190, 34], -1);
      board(g, 146, 4, 1, t, 'good', 'ship');
    },
  },
  // Canal de Suez fermé, vu du ciel : un porte-conteneurs coincé en travers du chenal, les
  // remorqueurs et la pelleteuse s'activent, la file d'attente s'allonge. En cas de tensions :
  // un barrage flottant, un navire de guerre et des fumées sur la rive.
  suez: {
    title: 'Canal de Suez fermé', mood: 'bad', loop: [2.4, 6.4],
    draw(g, t, o) {
      const sand = texture('sand-top', W, H, (c) => {
        R(c, 0, 0, W, H, '#e4c890');
        for (let i = 0; i < 260; i++) { const x = hash(i, 21) % W, y = hash(i, 22) % H; R(c, x, y, 2 + hash(i, 23) % 4, 1, i % 3 ? '#d6b77a' : '#efd9a6'); }
      });
      g.drawImage(sand, 0, 0);
      const top = 40, bot = 76;
      R(g, 0, top - 2, W, 2, '#c9a86a'); R(g, 0, bot, W, 2, '#c9a86a');
      g.drawImage(bands('canal-top', ['#2a7f8a', '#2f8c95', '#2a7f8a'], bot - top), 0, top);
      for (let i = 0; i < 18; i++) R(g, (hash(i, 8) % W + t * 50) % W, top + 2 + hash(i, 9) % (bot - top - 4), 3, 1, '#62b3b8');
      // Route de la rive et feu rouge.
      R(g, 0, 24, W, 3, '#bfa070');
      R(g, 186, 30, 4, 4, '#555'); if (Math.floor(t * 2) % 2) { glow(g, 188, 32, 6, '#ff3b3b', 0.4); R(g, 187, 31, 2, 2, '#ff3b3b'); }
      // La file d'attente, cap à droite.
      topShip(g, -18, 52, 0, '#7a1f22', 'tank'); topShip(g, -2, 66, 0, '#3d6b4a', 'bulk', 0.7);
      if (o.variant === 'tension') {
        for (let k = 0; k < 3; k++) smoke(g, 40 + k * 60, 16, t, { n: 12, color: '#2e2a2a', alpha: 0.5, rise: 2, drift: 4, size: 5, seed: k, life: 4 });
        for (let k = 0; k < 18; k++) R(g, 110 + (k % 2), top + 1 + k * 2, 2, 2, k % 2 ? '#ff3b3b' : '#f2efe6');
        topShip(g, 150 + Math.sin(t * PI / 2) * 8, 58, PI, '#6b7680', 'navy', 0.8);
        topShip(g, 70, 58, 0, '#3d5a80', 'box', 0.8);
      } else {
        topShip(g, 104, 58, 0.42, '#2f7a4a', 'box', 1.05); // coque verte, comme un certain géant échoué
        // Sable repoussé par l'étrave et la poupe.
        for (let r = 0; r < 5; r++) { R(g, 140 + r, 78 + r, 14 - r * 2, 1, '#d8bb80'); R(g, 54 - r, 37 - r, 12 - r * 2, 1, '#d8bb80'); }
        topTug(g, 74, 50, 0.4, t); topTug(g, 128, 64, PI + 0.4, t);
        // Pelleteuse qui dégage l'étrave.
        const arm = Math.sin(t * PI);
        R(g, 158, 88, 12, 8, '#e3b33b'); R(g, 160, 89, 4, 4, '#bfe3f0'); R(g, 156, 87, 2, 10, '#2a2f38'); R(g, 170, 87, 2, 10, '#2a2f38');
        line(g, 158, 90, 150 - arm * 2, 84 + arm, '#c99a22'); line(g, 158, 91, 150 - arm * 2, 85 + arm, '#c99a22'); R(g, 147 - arm * 2, 83 + arm, 4, 3, '#3a3f46');
      }
      vignette(g, 'rgba(90,60,20,A)', 0.2);
    },
  },
  // Sécheresse à Panama : l'eau baisse dans l'écluse, le grand navire est refoulé.
  panama: {
    title: 'Sécheresse à Panama', mood: 'bad', loop: [2.6, 4.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-tropic', ['#5aa7d8', '#7cbbe2', '#a2d0ec', '#c6e2f2'], 60), 0, 0);
      disc(g, 168, 18, 8, '#fff6d0');
      for (let x = 0; x < W; x++) { const y = 40 + Math.round(5 * Math.sin(x / 19) + 3 * Math.sin(x / 7 + 2)); R(g, x, y, 1, 64 - y, '#3f7a3a'); R(g, x, y, 1, 2, '#5a9a4a'); }
      for (let i = 0; i < 30; i++) R(g, hash(i, 4) % W, 48 + hash(i, 5) % 12, 3, 2, '#2f6230');
      const drop = ease(t / 2.4) * 8, wl = 70 + drop;
      R(g, 0, 62, W, 50, '#8a7556');
      // Lac Gatún, à gauche : la vase découverte.
      R(g, 0, 66, 50, 1, '#c9bf9a'); R(g, 0, 67, 50, 7 + drop, '#9a8a68');
      drawShip(g, '#2c3e50', 18, 76 + drop + 1, 0, 1, 'tank');
      R(g, 0, 74 + drop, 50, 38, '#3a7d8c');
      // L'écluse : mur du fond, trace de l'ancien niveau, eau qui baisse.
      R(g, 54, 60, 100, 52, '#c9c4b6'); R(g, 54, 66, 100, 1, '#e8e4d8'); R(g, 54, 67, 100, Math.max(0, wl - 67), '#a39c86');
      drawShip(g, o.color, 104, wl + 2);
      R(g, 54, wl, 100, H - wl, '#3f8c99'); for (let i = 0; i < 8; i++) R(g, 56 + (hash(i, 3) % 92 + t * 10) % 92, wl + 2 + (hash(i, 4) % 20), 3, 1, '#7fc0c8');
      R(g, 50, 60, 4, 52, '#b3ad9f'); R(g, 154, 60, 4, 52, '#b3ad9f'); R(g, 54, 60, 2, 52, '#4a4f56'); R(g, 152, 60, 2, 52, '#4a4f56');
      R(g, 158, 66, 42, 1, '#c9bf9a'); R(g, 158, 67, 42, 13 + drop, '#9a8a68'); R(g, 158, 80 + drop, 42, 32, '#3a7d8c');
      // Échelle de niveau : l'eau passe dans le rouge.
      for (let y = 62; y < 104; y += 4) R(g, 57, y, y >= 74 ? 3 : 2, 1, y >= 74 ? '#ff5b4f' : '#f4f4f4');
      R(g, 56, 62, 1, 42, '#f4f4f4');
      // Le grand navire n'a pas assez d'eau : croix rouge.
      if (t > 1.6 && Math.floor(t * 2) % 2) { for (let k = 0; k < 7; k++) { R(g, 17 + k, 52 + k, 2, 1, '#ff3b3b'); R(g, 23 - k, 52 + k, 2, 1, '#ff3b3b'); } }
      for (let y = 56; y < 62; y++) g.drawImage(g.canvas, 0, y, W, 1, Math.round(Math.sin(t * PI + y) * 1), y, W, 1);
    },
  },
  // Grève : portiques à l'arrêt, piquet de dockers et pancartes, baril qui brûle.
  strike: {
    title: 'Grève sur les quais', mood: 'bad', loop: [2, 4],
    draw(g, t, o) {
      g.drawImage(bands('sky-strike', ['#9fb8c9', '#b2c7d4', '#c6d6df', '#d8e3e9'], 56), 0, 0);
      cloud(g, 30, 16, 30, '#eef2f4'); cloud(g, 120, 26, 22, '#eef2f4');
      sea(g, t, DAY, 56, 56, 80);
      drawShip(g, o.color, 158, 78);
      R(g, 0, 80, W, 32, '#5b6068'); R(g, 0, 80, W, 1, '#8a9099');
      for (let x = 0; x < W; x += 24) R(g, x, 81, 1, 31, '#50555c');
      for (let i = 0; i < 3; i++) for (let k = 0; k < [2, 3, 1][i]; k++) box(g, 2 + i * 11, 75 - k * 5, BOX[(i + k * 2) % 6]);
      gantry(g, 108, 92, { raised: true, top: 54 });
      R(g, 92, 92, 7, 9, '#3a3f46'); R(g, 92, 94, 7, 1, '#555b62'); R(g, 92, 98, 7, 1, '#555b62');
      glow(g, 95, 88, 6, '#ff9a3a', 0.25);
      flame(g, 95, 91, t, 3.5, 7);
      smoke(g, 95, 83, t, { n: 10, color: '#3a3a3a', alpha: 0.5, rise: 6, drift: 2, size: 3, life: 2 });
      // Le grand drapeau tricolore : la grève, un art national.
      const TRI = ['#1f4fa3', '#f4f4f4', '#d0312d'];
      R(g, 88, 60, 1, 40, '#6d747c');
      for (let c = 0; c < 12; c++) R(g, 89 + c, 60 + Math.round(Math.sin(t * 2 * PI - c * 0.6) * 1), 1, 8, TRI[Math.floor(c / 4)]);
      g.save(); g.scale(2, 2);
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 8, y = 44 - ((Math.floor(t * 2) + i) % 2);
        person(g, x, y, ['#d9762b', '#2e5e8a', '#d9762b', '#5a6b3a', '#2e5e8a'][i], { hat: i % 2 ? '#f2c230' : null });
        if (i % 2) { // petit drapeau tricolore qui claque au vent
          R(g, x + 3, y - 7, 1, 10, '#8a6a3a');
          for (let c = 0; c < 6; c++) R(g, x + 4 + c, y - 7 + Math.round(Math.sin(t * 2 * PI - c * 0.9 + i) * 0.5), 1, 3, TRI[Math.floor(c / 2)]);
        } else { // pancarte
          R(g, x + 3, y - 3, 1, 6, '#8a6a3a');
          R(g, x + 1, y - 7, 5, 4, '#f4f1e6'); R(g, x + 2, y - 6, 3, 1, '#d0312d'); R(g, x + 2, y - 4, 3, 1, '#d0312d');
        }
      }
      g.restore();
    },
  },
};

// Quelle scène pour quel événement mondial (identifiants de sim/events.js).
export const EVENT_SCENES = {
  petrole_hausse: 'oilUp', petrole_baisse: 'oilDown', raffinerie: 'refinery',
  recolte_record: 'harvest', secheresse: 'drought',
  chine_relance: 'steelBoom', chine_ralenti: 'steelDown', acier: 'steelPrice',
  boom_conteneurs: 'containers', recession: 'recession', surcapacite: 'overcapacity', reprise: 'recovery',
  suez_ferme: 'suez', panama_secheresse: 'panama', greve: 'strike',
};
