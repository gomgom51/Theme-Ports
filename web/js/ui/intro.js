// Intro au lancement : un petit caboteur quitte le port au coucher du soleil,
// en pixel art dessiné dans le code (aucune image à charger).
// Les navigateurs n'autorisent le son qu'après un premier clic : l'intro attend
// donc « Embarquer », puis la corne de brume retentit, la chanson démarre, le
// bateau appareille vers le soleil et le menu apparaît. Quand le son est déjà
// permis (application Android, site autorisé), le bateau part tout de suite.
import { h } from './dom.js';
import { brandTitle } from './brand.js';
import { reducedMotion } from './motion.js';

// Ciel du zénith à l'horizon, mer de l'horizon vers le rivage.
const SKY = ['#1b1035', '#2b1544', '#461b55', '#6c2459', '#982f53', '#c44a44', '#e7783c', '#f6aa4c', '#fbd06a'];
const SEA = ['#5a3566', '#43295d', '#322253', '#251c47', '#1b163a', '#141130'];
const DARK = '#120b1e';
const LIT = '#ffd877';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Caboteur vu de profil, cap à droite : # coque et superstructures, o hublots allumés.
const BOAT = [
  '..........##......',
  '..........##......',
  '.......#######....',
  '.......#o#o#o#....',
  '.#.....#######....',
  '##################',
  '.#################',
  '..###############.',
];
const BOAT_SMALL = [
  '.....#..',
  '...###..',
  '########',
  '.######.',
];
const BOAT_TINY = ['.#.', '###'];
const FUNNEL = { big: 10.5, small: 5 }; // colonne de la cheminée (fumée)

const SAIL_SECONDS = 7.5; // traversée jusqu'au soleil
const HOLD_SECONDS = 0.9; // le point noir sur le soleil, avant le menu
const FADE_MS = 900;

const hash = (a, b) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// Dégradé du ciel en tramage ordonné, à l'ancienne.
function makeSky(W, hy) {
  const c = document.createElement('canvas');
  c.width = W; c.height = hy + 1;
  const g = c.getContext('2d');
  const img = g.createImageData(W, hy + 1);
  const cols = SKY.map(rgb);
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
  return c;
}

// Le port en ombre chinoise : quai, entrepôt, grue, phare au bout de la jetée.
function makePort(W, H, hy) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const qx = Math.max(30, Math.min(72, Math.round(W * 0.3))); // bout du quai
  const qy = hy + Math.round((H - hy) * 0.42); // dessus du quai
  g.fillStyle = DARK;
  g.fillRect(0, qy, qx, H - qy);
  // Entrepôt à toit en dents de scie.
  const wh = Math.max(6, Math.round(H * 0.07)), ww = Math.max(12, Math.round(qx * 0.45));
  g.fillRect(1, qy - wh, ww, wh);
  for (let x = 0; x < ww; x++) g.fillRect(1 + x, qy - wh - Math.floor((x % 8) / 2), 1, Math.floor((x % 8) / 2));
  g.fillStyle = '#f2b45e';
  for (let x = 4; x < ww - 2; x += 4) g.fillRect(x, qy - Math.ceil(wh / 2), 1, 1);
  // Grue de quai : mât, flèche au-dessus de l'eau, câble et crochet.
  g.fillStyle = DARK;
  const gx = Math.round(qx * 0.62), gh = Math.max(14, Math.round(H * 0.22));
  g.fillRect(gx, qy - gh, 2, gh);
  g.fillRect(gx - 4, qy - gh, 17, 1);
  for (let i = 1; i < 5; i++) g.fillRect(gx + 2 + i, qy - gh + i, 1, 1);
  g.fillRect(gx - 4, qy - gh + 1, 2, 2); // contrepoids
  const cable = Math.round(gh * 0.45);
  g.fillRect(gx + 11, qy - gh + 1, 1, cable);
  g.fillRect(gx + 10, qy - gh + 1 + cable, 3, 1);
  // Phare au bout de la jetée (la lanterne est dessinée à chaque image).
  const lx = qx - 4, lh = Math.max(12, Math.round(H * 0.17));
  g.fillRect(lx, qy - lh, 3, lh);
  g.fillRect(lx - 1, qy - lh, 5, 1);
  g.fillRect(lx, qy - lh - 3, 3, 1);
  g.fillRect(lx + 1, qy - lh - 4, 1, 1);
  // Bittes d'amarrage.
  for (let x = ww + 3; x < qx - 6; x += 5) g.fillRect(x, qy - 1, 1, 1);
  return { c, qx, qy, lamp: { x: lx, y: qy - lh - 2 } };
}

function drawSprite(g, rows, k, left, top, dim) {
  for (let r = 0; r < rows.length; r++) {
    for (let col = 0; col < rows[r].length; col++) {
      const ch = rows[r][col];
      if (ch === '.') continue;
      g.fillStyle = ch === 'o' && !dim ? LIT : DARK;
      g.fillRect(left + col * k, top + r * k, k, k);
    }
  }
}

export function playIntro(app) {
  const a = app.audio;
  const reduce = reducedMotion();
  const soundOn = a.settings.ambience || a.settings.sfx || a.settings.music;
  const needClick = soundOn && !a.unlocked;
  if (reduce && !needClick) return; // rien à attendre, et pas d'animation voulue
  const touch = window.matchMedia?.('(pointer: coarse)').matches;

  const canvas = h('canvas.intro-canvas.unzoom', { 'aria-hidden': 'true' }); // au pixel de l'écran, hors du zoom de l'interface
  const root = h('div.intro', { role: 'button', tabindex: '0', 'aria-label': 'Embarquer' }, [
    canvas,
    brandTitle('h1.intro-title'),
    h('div.intro-prompt', touch ? 'Touchez l\'écran pour embarquer' : 'Cliquez pour embarquer'),
    h('div.intro-skip', touch ? 'Toucher pour passer' : 'Cliquer pour passer'),
  ]);
  document.body.append(root);
  const g = canvas.getContext('2d');

  let W, H, hy, sky, port, k0, smoke = [];
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const px = Math.max(2, Math.floor(Math.min(vw, vh) / 100));
    W = Math.ceil(vw / px); H = Math.ceil(vh / px);
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * px}px`; canvas.style.height = `${H * px}px`;
    hy = Math.round(H * 0.58);
    sky = makeSky(W, hy);
    port = makePort(W, H, hy);
    k0 = Math.min(W, H) >= 160 ? 2 : 1;
    smoke = [];
  }
  layout();
  window.addEventListener('resize', layout);

  const t0 = performance.now();
  let phase = needClick ? 'wait' : 'sail';
  let sailStart = needClick ? null : t0;
  let last = t0, nextPuff = 0, raf = 0;

  const horn = () => {
    if (!a.ctx) return;
    a.ctx.resume().then(() => a.play('depart')).catch(() => {});
  };
  function finish() {
    if (phase === 'done') return;
    phase = 'done';
    root.classList.add('leaving');
    document.querySelector('#screen .title-card')?.classList.add('pop-in');
    window.removeEventListener('keydown', onKey);
    setTimeout(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      root.remove();
    }, FADE_MS);
  }
  function advance() {
    if (phase === 'wait') {
      if (reduce) { finish(); return; } // le son est lancé, on passe directement au menu
      phase = 'sail';
      sailStart = performance.now();
      root.classList.add('sailing');
      horn();
    } else if (phase === 'sail') finish();
  }
  function onKey(e) {
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
    advance();
  }
  root.addEventListener('click', advance);
  window.addEventListener('keydown', onKey);
  if (phase === 'sail') { root.classList.add('sailing'); horn(); }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const tick = Math.floor(t * 6);

    // Ciel et soleil couchant (il descend doucement), coupé par des bandes horizontales.
    g.drawImage(sky, 0, 0);
    const r = Math.round(Math.min(W, H) * 0.16), cx = Math.round(W * 0.66);
    const sy = hy + Math.round(r * 0.12 + Math.min(t, 40) * 0.1);
    for (let dy = -r; dy <= r; dy++) {
      const y = sy + dy;
      if (y > hy) break;
      const rel = (dy + r) / (2 * r), m = ((dy % 4) + 4) % 4;
      if ((rel > 0.5 && m === 0) || (rel > 0.68 && m === 1)) continue;
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillStyle = rel < 0.3 ? '#fff1b8' : '#ffd77a';
      g.fillRect(cx - half, y, half * 2 + 1, 1);
    }

    // Mer, ligne d'horizon embrasée et chemin de lumière qui scintille.
    for (let i = 0; i < SEA.length; i++) {
      const y0 = hy + 1 + Math.floor((H - hy) * Math.pow(i / SEA.length, 1.5));
      const y1 = hy + 1 + Math.floor((H - hy) * Math.pow((i + 1) / SEA.length, 1.5));
      g.fillStyle = SEA[i];
      g.fillRect(0, y0, W, y1 - y0);
    }
    g.fillStyle = '#f39a4a';
    g.fillRect(cx - r - 4, hy + 1, 2 * r + 9, 1);
    for (let y = hy + 2; y < H; y++) {
      const d = (y - hy) / (H - hy);
      const half = Math.max(2, Math.round(r * (0.3 + 1.0 * d)));
      for (let j = 0; j < 2; j++) {
        const hv = hash(y * 7 + j, tick + j * 13);
        if (hv % 3 === 0) continue;
        const len = 1 + (hv >>> 4) % Math.max(2, Math.round(half * 0.7));
        const x = cx - half + (hv >>> 9) % Math.max(1, 2 * half + 1 - len);
        g.fillStyle = d < 0.15 ? '#ffe08a' : d < 0.45 ? '#f6a14d' : '#b5474f';
        g.fillRect(x, y, len, 1);
      }
    }
    g.fillStyle = '#6a4782';
    for (let i = 0; i < Math.round(W * 0.06); i++) {
      const hv = hash(i, tick >> 1);
      const x = hv % W, y = hy + 3 + (hv >>> 11) % Math.max(1, H - hy - 3);
      if (Math.abs(x - cx) > r * 1.4) g.fillRect(x, y, 2, 1);
    }

    // Le port et la lanterne du phare.
    g.drawImage(port.c, 0, 0);
    if (t % 2.4 < 0.9) {
      g.fillStyle = '#fff3b8';
      g.fillRect(port.lamp.x, port.lamp.y, 3, 1);
      g.fillStyle = 'rgba(255, 214, 130, 0.55)';
      g.fillRect(port.lamp.x - 2, port.lamp.y, 1, 1);
      g.fillRect(port.lamp.x + 4, port.lamp.y, 1, 1);
      g.fillRect(port.lamp.x + 1, port.lamp.y - 2, 1, 1);
    }

    // Mouettes.
    for (let i = 0; i < 3; i++) {
      const span = W + 24;
      const x = Math.round(((W * (0.2 + i * 0.27) + t * (4 + i * 1.5)) % span) - 12);
      const y = Math.round(hy * (0.28 + i * 0.13) + Math.sin(t * 0.7 + i) * 2);
      const up = Math.floor(t * 4 + i * 1.3) % 2 === 0;
      g.fillStyle = DARK;
      for (const [dx, dy] of (up ? [[-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0]] : [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]])) g.fillRect(x + dx, y + dy, 1, 1);
    }

    // Le caboteur : à quai, puis cap sur le soleil en rapetissant avec la distance.
    const p = sailStart == null ? 0 : Math.min(1, (now - sailStart) / 1000 / SAIL_SECONDS);
    const e = ease(p);
    const s = k0 / (1 + 3 * Math.pow(e, 1.7)); // la perspective ne rapetisse le bateau qu'au loin
    let rows = BOAT, k = 1, funnel = FUNNEL.big;
    if (s >= 1.6) k = 2;
    else if (s < 0.38) { rows = BOAT_TINY; funnel = null; }
    else if (s < 0.75) { rows = BOAT_SMALL; funnel = FUNNEL.small; }
    const sw = rows[0].length * k, sh = rows.length * k;
    const startX = port.qx + 2 + (BOAT[0].length * k0) / 2;
    const bx = startX + (cx - startX) * e;
    const by = port.qy + 3 + (hy + 1 - (port.qy + 3)) * (1 - Math.pow(1 - e, 1.4));
    const bob = p < 0.04 && Math.sin(t * 2.2) > 0.4 ? 1 : 0;
    const left = Math.round(bx - sw / 2), top = Math.round(by - sh) + bob;

    // Fumée de la cheminée, poussée par le vent.
    if (funnel != null && t >= nextPuff) {
      smoke.push({ x: left + funnel * k, y: top - 1, born: t, k });
      nextPuff = t + (phase === 'sail' ? 0.18 : 0.4);
    }
    smoke = smoke.filter((pf) => t - pf.born < 2.6);
    for (const pf of smoke) {
      const age = t - pf.born;
      pf.x -= dt * 3 * pf.k;
      pf.y -= dt * 2.6 * pf.k;
      const size = (age > 0.7 ? 2 : 1) * pf.k;
      g.fillStyle = age < 0.8 ? '#3a2c4f' : age < 1.7 ? '#5c4a72' : '#86698e';
      g.fillRect(Math.round(pf.x), Math.round(pf.y), size, size);
    }
    // Sillage.
    if (p > 0 && p < 1) {
      g.fillStyle = '#e4c9e2';
      const n = Math.max(1, Math.round(7 * s));
      for (let i = 0; i < n; i++) if (hash(i, tick) % 3) g.fillRect(left - 2 - i * 2, top + sh - 1 + (i % 2), 1 + (i < 2 ? 1 : 0), 1);
      g.fillRect(left + sw - 1, top + sh - 1, 1, 1);
    }
    drawSprite(g, rows, k, left, top, rows === BOAT_TINY);

    // Le point noir sur le soleil, puis le menu.
    if (phase === 'sail' && sailStart != null && (now - sailStart) / 1000 > SAIL_SECONDS + HOLD_SECONDS) finish();
  }
  raf = requestAnimationFrame(frame);
}
