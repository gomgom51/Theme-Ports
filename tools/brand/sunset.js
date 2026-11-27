// Fond « coucher de soleil » des visuels Steam : une image fixe de l'intro (ui/intro.js), à toute taille.
// Ciel tramé (matrice de Bayer), soleil coupé de bandes, reflets, quai avec entrepôt, grue et phare,
// caboteur à quai, oiseaux dans le bas du ciel (loin du logo). Module navigateur (tools/brand/sheet.html).
import { BRAND as C } from '../../web/js/ui/brand.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hash = (a, b) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
};
// Le caboteur de l'intro, cap à droite : # coque, o hublots allumés.
const BOAT = ['..........##......', '..........##......', '.......#######....', '.......#o#o#o#....', '.#.....#######....', '##################', '.#################', '..###############.'];

// Wpx × Hpx pixels d'écran ; px = pixels d'écran par pixel dessiné ; horizon et sunX en fraction ;
// sunR en part du petit côté ; birds = true ou [[x, y en fraction de la hauteur de l'horizon], …].
export function sunsetCanvas(Wpx, Hpx, { px = 6, horizon = 0.6, sunX = 0.66, sunR = 0.16, port = true, boat = true, birds = true, seed = 3 } = {}) {
  const W = Math.ceil(Wpx / px), H = Math.ceil(Hpx / px), hy = Math.round(H * horizon);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const cols = C.sky.map(rgb);
  for (let y = 0; y <= hy; y++) {
    const f = Math.pow(y / hy, 1.25) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f)), frac = f - i;
    for (let x = 0; x < W; x++) {
      const col = frac * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cols[i + 1] : cols[i];
      const o = (y * W + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Soleil
  const r = Math.round(Math.min(W, H) * sunR), cx = Math.round(W * sunX), sy = hy + Math.round(r * 0.12);
  for (let dy = -r; dy <= r; dy++) {
    const y = sy + dy; if (y > hy) break;
    const rel = (dy + r) / (2 * r), m = ((dy % 4) + 4) % 4;
    if ((rel > 0.5 && m === 0) || (rel > 0.68 && m === 1)) continue;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillStyle = rel < 0.3 ? C.sun1 : C.sun2;
    g.fillRect(cx - half, y, half * 2 + 1, 1);
  }
  // Mer, ligne d'horizon et reflets
  for (let i = 0; i < C.sea.length; i++) {
    const y0 = hy + 1 + Math.floor((H - hy) * Math.pow(i / C.sea.length, 1.5));
    const y1 = hy + 1 + Math.floor((H - hy) * Math.pow((i + 1) / C.sea.length, 1.5));
    g.fillStyle = C.sea[i]; g.fillRect(0, y0, W, y1 - y0);
  }
  g.fillStyle = '#f39a4a'; g.fillRect(cx - r - 4, hy + 1, 2 * r + 9, 1);
  for (let y = hy + 2; y < H; y++) {
    const d = (y - hy) / (H - hy);
    const half = Math.max(2, Math.round(r * (0.3 + 1.0 * d)));
    for (let j = 0; j < 2; j++) {
      const hv = hash(y * 7 + j, seed + j * 13);
      if (hv % 3 === 0) continue;
      const len = 1 + (hv >>> 4) % Math.max(2, Math.round(half * 0.7));
      const x = cx - half + (hv >>> 9) % Math.max(1, 2 * half + 1 - len);
      g.fillStyle = d < 0.15 ? '#ffe08a' : d < 0.45 ? '#f6a14d' : '#b5474f';
      g.fillRect(x, y, len, 1);
    }
  }
  g.fillStyle = '#6a4782';
  for (let i = 0; i < Math.round(W * 0.06); i++) {
    const hv = hash(i, seed >> 1);
    const x = hv % W, y = hy + 3 + (hv >>> 11) % Math.max(1, H - hy - 3);
    if (Math.abs(x - cx) > r * 1.4) g.fillRect(x, y, 2, 1);
  }
  // Quai : entrepôt, grue, phare, caboteur
  if (port) {
    g.fillStyle = C.dark;
    const qx = Math.max(30, Math.min(72, Math.round(W * 0.3))), qy = hy + Math.round((H - hy) * 0.42);
    g.fillRect(0, qy, qx, H - qy);
    const wh = Math.max(6, Math.round(H * 0.07)), ww = Math.max(12, Math.round(qx * 0.45));
    g.fillRect(1, qy - wh, ww, wh);
    for (let x = 0; x < ww; x++) g.fillRect(1 + x, qy - wh - Math.floor((x % 8) / 2), 1, Math.floor((x % 8) / 2));
    g.fillStyle = '#f2b45e';
    for (let x = 4; x < ww - 2; x += 4) g.fillRect(x, qy - Math.ceil(wh / 2), 1, 1);
    g.fillStyle = C.dark;
    const gx = Math.round(qx * 0.62), gh = Math.max(14, Math.round(H * 0.22));
    g.fillRect(gx, qy - gh, 2, gh); g.fillRect(gx - 4, qy - gh, 17, 1);
    for (let i = 1; i < 5; i++) g.fillRect(gx + 2 + i, qy - gh + i, 1, 1);
    g.fillRect(gx - 4, qy - gh + 1, 2, 2);
    const cable = Math.round(gh * 0.45);
    g.fillRect(gx + 11, qy - gh + 1, 1, cable); g.fillRect(gx + 10, qy - gh + 1 + cable, 3, 1);
    const lx = qx - 4, lh = Math.max(12, Math.round(H * 0.17));
    g.fillRect(lx, qy - lh, 3, lh); g.fillRect(lx - 1, qy - lh, 5, 1); g.fillRect(lx, qy - lh - 3, 3, 1); g.fillRect(lx + 1, qy - lh - 4, 1, 1);
    g.fillStyle = '#fff3b8'; g.fillRect(lx, qy - lh - 2, 3, 1);
    if (boat) {
      const k = Math.min(W, H) >= 160 ? 2 : 1;
      const left = qx + 3, top = qy - 4 * k;
      for (let rr = 0; rr < BOAT.length; rr++) for (let cc = 0; cc < BOAT[rr].length; cc++) {
        const ch = BOAT[rr][cc]; if (ch === '.') continue;
        g.fillStyle = ch === 'o' ? '#ffd877' : C.dark; g.fillRect(left + cc * k, top + rr * k, k, k);
      }
    }
  }
  if (birds) {
    const spots = Array.isArray(birds) ? birds : [[0.12, 0.8], [0.47, 0.87], [0.9, 0.76]];
    g.fillStyle = C.dark;
    for (let i = 0; i < spots.length; i++) {
      const x = Math.round(W * spots[i][0]), y = Math.round(hy * spots[i][1]);
      for (const [dx, dy] of (i % 2 ? [[-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0]] : [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]])) g.fillRect(x + dx, y + dy, 1, 1);
    }
  }
  c.style.width = W * px + 'px'; c.style.height = H * px + 'px'; c.style.imageRendering = 'pixelated';
  return c;
}
