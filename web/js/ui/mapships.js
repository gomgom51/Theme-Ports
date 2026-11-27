// Navires sur la carte : petits sprites de profil en pixel art, un par modèle, tirés de SHIP_ART
// (château, cheminée, grues, cuves, conteneurs…), dans le style choisi par le joueur :
//  fine   : contours colorés (le ton sombre de chaque matière), trois tons ;
//  chunky : contour encré partout, aplats.
// Chargé : coque aux couleurs de la compagnie, enfoncée. À vide : coque pâle avec une bande
// de la couleur de la compagnie à la flottaison, plus haute sur l'eau. La cheminée porte
// toujours la couleur de la compagnie. Les navires du joueur ont un liseré clair.
// En mer, le sillage s'allonge avec la vitesse ; à quai, le navire est plus petit (cap à droite).
import { SHIP_ART } from './shipart.js';
import { shipStyle, ramp, mix, rng } from './pixelship.js';

const INK = '#1c2a33', PAPER = 'rgba(251,248,241,0.95)';
const WHITE = '#f3efe4', GLASS = '#26343c', STEEL = '#9aa3a8', RED = '#c4362c', SOOT = '#1a1f23';
const PALE = '#ece8dc', PALE_HI = '#f8f5ec';
// Conteneurs sur la carte : tons sourds, pour que la couleur de la compagnie se lise d'abord.
const BOXES = ['#8a4a2a', '#7d8a90', '#e4dccb', '#2f5f63', '#a39274', '#5c6b70', '#c9b48a'];
const GREY = '#9a9890';

const cache = new Map();

/**
 * Sprite (canevas, 1 pixel = 1 pixel du dessin) et repères : waterline (ligne de flottaison),
 * stern / bow (colonnes de la poupe et de l'étrave), funnel ([x, y] du haut de la cheminée).
 */
export function mapShipSprite(typeId, color, laden, own, { docked = false, laidup = false } = {}) {
  const st = shipStyle();
  const key = `${st}|${typeId}|${color}|${laden ? 1 : 0}|${own ? 1 : 0}|${docked ? 1 : 0}|${laidup ? 1 : 0}`;
  let spr = cache.get(key);
  if (!spr) { spr = build(typeId, color, laden, own, docked, laidup, st === 'fine'); cache.set(key, spr); }
  return spr;
}

function build(typeId, color, laden, own, docked, laidup, fine) {
  const A = SHIP_ART[typeId] || SHIP_ART.caboteur;
  // Longueur en pixels du dessin. Gros pixels : moitié moins de pixels, affichés deux fois plus gros,
  // pour le même encombrement à l'écran.
  const Ls = fine
    ? Math.round(docked ? 12 + A.L * 0.034 : 19 + A.L * 0.066)
    : Math.round(docked ? 7 + A.L * 0.019 : 10 + A.L * 0.034);
  const small = Ls < 18; // peu de pixels : on simplifie (fenêtres, flèches de grue…)
  const col = (fr) => Math.max(0, Math.min(Ls - 1, Math.round(fr * (Ls - 1))));
  const r = rng(typeId);
  const px = new Map(); // "x,y" → couleur ; y = 0 : haut de la coque, négatif au-dessus
  const set = (x, y, c) => { if (x >= 0 && x < Ls) px.set(`${x},${y}`, c); };
  const get = (x, y) => px.get(`${x},${y}`);
  const CO = ramp(color), CL = A.livery;
  const gear = CL.gear && CL.gear !== '#f7f7f3' && CL.gear !== '#f6f4ee' && CL.gear !== '#f1eee6' ? CL.gear : '#d8d4c8';

  // ---------- Coque ----------
  const hr = (Ls >= 30 ? 4 : Ls >= 20 ? 3 : 2) + (laden ? 0 : 1);
  for (let y = 0; y < hr; y++) {
    const bot = y === hr - 1;
    let xs = 0, xe = Ls - 1;
    if (A.box) xe = Ls - 1 - (y === 0 ? 1 : Math.round(y * 0.5));
    else xe = Ls - 1 - Math.round(y * (A.bow === 'straight' ? 1.2 : 0.9));
    if (A.stern === 'cruiser') xs = Math.round(y * 0.8); else if (bot) xs = 1;
    for (let x = xs; x <= xe; x++) {
      let c;
      if (laden) c = y === 0 ? (fine ? CO[3] : CO[2]) : bot ? CO[1] : CO[2];
      else c = bot ? CO[2] : y === 0 && fine ? PALE_HI : PALE;
      set(x, y, c);
    }
  }
  const deckTop = -1; // première rangée au-dessus du pont

  // ---------- Château et cheminée ----------
  let funnel = null;
  const house = (hsp, bridge) => {
    let x1 = col(hsp.x), x2 = col(hsp.x + hsp.w);
    const minW = small ? 2 : 3;
    if (x2 - x1 + 1 < minW) x2 = x1 + minW - 1;
    const hh = Math.max(2, Math.min(small ? 3 : Ls >= 30 ? 6 : 5, Math.round(hsp.decks * 0.5) + (small ? 0 : 1)));
    for (let k = 0; k < hh; k++) {
      const y = deckTop - k, top = k === hh - 1;
      const a = hsp.style === 'classic' && top && hh > 2 ? x1 + 1 : x1;
      for (let x = a; x <= x2; x++) set(x, y, WHITE);
      if (bridge && top && x2 - a >= 2) for (let x = a + 1; x <= x2; x++) set(x, y, GLASS);
      else if (!small && k > 0 && k < hh - 1 && fine) for (let x = a + 1; x < x2; x += 2) set(x, y, GLASS);
    }
    if (!hsp.noFunnel) {
      const fw = x2 - x1 >= 4 ? 2 : 1, fx = x1 + (hsp.style === 'classic' ? 0 : 0), fh = hsp.style === 'classic' ? (small ? 2 : 3) : Ls >= 30 ? 3 : 2;
      const base = deckTop - hh + (hsp.style === 'classic' && hh > 2 ? 1 : 0);
      for (let k = 0; k < fh; k++) for (let x = fx; x < fx + fw; x++) set(x, base - k, k === fh - 1 ? SOOT : CO[2]);
      funnel = [fx, base - fh];
    }
    return { x1, x2, hh };
  };
  if (A.aftHouse) house(A.aftHouse, false);
  const H = A.house ? house(A.house, true) : null;
  if (A.funnelTower) {
    const t = A.funnelTower, x = col(t.x);
    const th = A.box ? 0 : Math.max(2, Math.min(4, Math.round(t.h / 7)));
    for (let k = 0; k < th; k++) set(x, deckTop - k, WHITE);
    const base = deckTop - th - (A.box ? (small ? 2 : 3) : 0);
    for (let k = 0; k < 2; k++) { set(x, base - k, k === 1 ? SOOT : CO[2]); if (A.box) set(x + 1, base - k, k === 1 ? SOOT : CO[2]); }
    funnel = [x, base - 2];
  }

  // ---------- Cargaison ----------
  if (A.box) {
    const rows = small ? 2 : 3;
    for (let k = 0; k < rows; k++) for (let x = col(0.02); x <= Ls - 2 - (k === rows - 1 ? 1 : 0); x++) {
      let c = WHITE;
      if (k === 1 && !small && x % 2 === 0 && x < col(0.84)) c = '#c9c7bd';
      if (k === rows - 1 && x >= col(A.box.bridge)) c = GLASS;
      set(x, deckTop - k, c);
    }
  }
  if (A.hatches) {
    const hc = CL.hatch || '#3d5a4a';
    for (const [a, b] of A.hatches) for (let x = col(a) + 1; x <= col(b) - (small ? 0 : 1); x++) if (!get(x, deckTop)) set(x, deckTop, hc);
  }
  if (A.project && laden && !small) for (const c of A.project) for (let x = col(c.x); x <= col(c.x + c.w); x++) { set(x, deckTop - 1, c.kind === 'boiler' ? '#e3b23c' : '#b4875a'); }
  if (A.containers) {
    const c = A.containers;
    const segs = c.segments || [[c.from, c.to], ...(c.aft ? [c.aft] : [])];
    const tr = Math.max(1, Math.min(small ? 2 : 4, Math.round(c.tiers * (small ? 0.3 : 0.45))));
    for (const [a, b] of segs) {
      for (let x = col(a); x <= col(b); x += 2) {
        const rows = laden ? tr - (r() < 0.25 ? 1 : 0) : (r() < 0.3 ? 1 : 0);
        for (let k = 0; k < rows; k++) {
          const bc = BOXES[Math.floor(r() * BOXES.length)];
          set(x, deckTop - k, bc); if (x + 1 <= col(b)) set(x + 1, deckTop - k, fine ? mix(bc, INK, 0.18) : bc);
        }
      }
    }
  }
  const aft = A.aftHouse || A.house;
  if (A.tanker || A.chem) {
    const start = aft ? col(aft.x + aft.w) + 1 : 2;
    for (let x = start; x <= Ls - 3; x++) if (!get(x, deckTop)) set(x, deckTop, A.chem && fine ? (x % 3 === 0 ? '#e3b23c' : x % 3 === 1 ? '#3a78b5' : STEEL) : STEEL);
    const mx = col(A.tanker ? A.tanker.manifold : A.chem.manifold);
    set(mx, deckTop - 1, RED);
    if (A.chem && !small) for (let x = start + 2; x <= Ls - 4; x += 3) if (Math.abs(x - mx) > 1) set(x, deckTop - 1, '#d6dadb');
  }
  if (A.spheres) {
    const sp = A.spheres, gap = ((sp.to - sp.from) * (Ls - 1)) / sp.count;
    const rr = Math.max(1, Math.round(gap * 0.42));
    for (let k = 0; k < sp.count; k++) {
      const cx = sp.from * (Ls - 1) + gap * (k + 0.5);
      for (let dy = 0; dy <= rr; dy++) for (let x = Math.round(cx - rr); x <= Math.round(cx + rr - 1); x++) {
        const nx = (x + 0.5 - cx) / rr, ny = dy / (rr + 0.5);
        if (nx * nx + ny * ny > 1.05) continue;
        set(x, deckTop - dy, fine && nx > 0.35 ? '#c8c7bd' : '#ecebe4');
      }
    }
  }
  if (A.cylinders) {
    const cy = A.cylinders, gap = ((cy.to - cy.from) * (Ls - 1)) / cy.count, rows = small ? 1 : 2;
    for (let k = 0; k < cy.count; k++) {
      const a = Math.round(cy.from * (Ls - 1) + gap * k), b = Math.round(cy.from * (Ls - 1) + gap * (k + 1)) - 2;
      for (let j = 0; j < rows; j++) for (let x = a + (j === rows - 1 && rows > 1 ? 1 : 0); x <= b - (j === rows - 1 && rows > 1 ? 1 : 0); x++) set(x, deckTop - j, fine && j === 0 ? '#c9ccc6' : '#dfe2dd');
    }
  }
  // ---------- Apparaux ----------
  for (const g of A.gear || []) {
    const x = col(g.x);
    if (g.kind === 'mast') {
      const hgt = small ? 1 : 2;
      for (let k = 0; k < hgt; k++) set(x, deckTop - k - (A.fc ? 0 : 0), fine ? '#e8e4d6' : WHITE);
      continue;
    }
    const post = g.kind === 'heavy' ? (small ? 3 : 5) : g.kind === 'derrick' ? (small ? 2 : 3) : (small ? 1 : 2);
    for (let k = 0; k < post; k++) set(x, deckTop - k, gear);
    if (!small) {
      const dir = g.aft ? -1 : (g.dir ?? 1);
      const top = deckTop - post + 1;
      set(x + dir, top - 1, gear);
      if (g.kind === 'heavy') { set(x + dir * 2, top - 2, gear); set(x + dir * 2, top - 1, null); }
    }
  }

  // ---------- Contour, liseré, mise en canevas ----------
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [k, c] of px) {
    if (!c) { px.delete(k); continue; }
    const [x, y] = k.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const pad = own ? 2 : 1;
  const w = maxX - minX + 1 + pad * 2, h = maxY - minY + 1 + pad * 2;
  const cell = new Array(w * h).fill(null);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : cell[y * w + x]);
  for (const [k, c] of px) { const [x, y] = k.split(',').map(Number); cell[(y - minY + pad) * w + (x - minX + pad)] = laidup ? mix(c, GREY, 0.6) : c; }
  const fill = cell.slice();
  const outline = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (fill[y * w + x]) continue;
    const below = at(x, y + 1), above = at(x, y - 1), left = at(x - 1, y), right = at(x + 1, y);
    const n = below || left || right || above;
    if (!n) continue;
    outline.push([x, y, fine ? mix(n, INK, below && !above ? 0.62 : 0.8) : INK]);
  }
  for (const [x, y, c] of outline) cell[y * w + x] = c;
  if (own) { // liseré clair autour des navires du joueur
    const ring = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!cell[y * w + x] && (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))) ring.push([x, y]);
    for (const [x, y] of ring) cell[y * w + x] = PAPER;
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = cell[y * w + x]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
  const ox = pad - minX, oy = pad - minY;
  return {
    canvas: cv, w, h, px: fine ? 1 : 2, waterline: hr - 1 + oy + 1, stern: ox, bow: Ls - 1 + ox,
    funnel: funnel ? [funnel[0] + ox, funnel[1] + oy] : null, house: H,
  };
}

const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * Dessine un navire sur la carte, centré sur (x, y) (pixels CSS), en pixels d'écran entiers.
 * opts : left (cap vers l'ouest : sprite retourné), moving, speed (nœuds), t (s), seed, smoke,
 * zoom (1 ou 2 : taille des pixels quand on zoome fort).
 * Renvoie le demi-encombrement en pixels CSS : { hw, hh, r } (r pour l'anneau de sélection).
 */
export function drawMapShip(g, dpr, x, y, spr, { left = false, moving = false, speed = 0, t = 0, seed = 0, smoke = false, zoom = 1 } = {}) {
  const k = Math.max(1, Math.round(dpr * spr.px * zoom)); // pixels d'écran par pixel du dessin
  const still = !!reduce?.matches;
  const tt = still ? seed : t;
  const bob = moving && !still ? Math.round(Math.sin(tt * 2.4 + seed) * 0.6) : 0;
  const W = spr.w * k, H = spr.h * k;
  const dx = Math.round(x * dpr - W / 2), dy = Math.round(y * dpr - H / 2) + bob * k;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  const dir = left ? 1 : -1; // le sillage part de la poupe, à l'opposé du cap
  const sx = (col) => (left ? dx + W - (col + 1) * k : dx + col * k); // colonne du sprite → x écran
  const dot = (X, Y, c) => { g.fillStyle = c; g.fillRect(X, Y, k, k); };
  if (moving && speed > 0) {
    // Sillage : écume à la flottaison derrière la poupe. Plus le navire va vite, plus elle est
    // longue, blanche et rapide ; en vitesse économique, une courte traînée pâle.
    const u = spr.px;                                       // gros pixels : moitié moins de pixels
    const len = Math.max(3, Math.round((speed * 0.8) / u)); // en pixels du dessin
    const vivid = Math.min(1, 0.55 + speed / 25);
    const wy = dy + (spr.waterline - 1) * k - bob * k;      // dernière rangée de la coque
    const stern = sx(spr.stern);
    const flow = tt * (1.5 + speed / 6);                    // l'écume file vers l'arrière
    for (let d = 1; d <= len; d++) {
      const X = stern + dir * d * k, fade = 1 - (d - 1) / len;
      const ph = (((d * 0.37 - flow * 0.12 + seed) % 1) + 1) % 1;
      // Ombre bleutée sous l'écume : elle la détache d'une mer claire.
      dot(X, wy + k, `rgba(24,56,84,${(0.42 * fade * vivid).toFixed(2)})`);
      // Remous blanc juste derrière l'hélice, puis une traînée qui se défait en tirets.
      if (d <= 2) { dot(X, wy, `rgba(255,255,255,${vivid.toFixed(2)})`); if (speed > 8) dot(X, wy - k, `rgba(255,255,255,${(0.9 * vivid).toFixed(2)})`); continue; }
      if (ph < 0.6 + 0.3 * fade) dot(X, wy, `rgba(255,255,255,${(vivid * (0.45 + 0.55 * fade)).toFixed(2)})`);
      // Le sillage s'élargit en s'éloignant : quelques moutons plus bas, et au-dessus quand on va vite.
      if (d > 3 && d < len * 0.85 && ph > 0.55 && ph < 0.75) dot(X, wy + 2 * k, `rgba(255,255,255,${(0.7 * fade * vivid).toFixed(2)})`);
      if (speed > 15 && d < len * 0.6 && ph > 0.86) dot(X, wy - k, `rgba(255,255,255,${(0.7 * fade).toFixed(2)})`);
    }
    // Vague d'étrave, à bonne vitesse.
    if (speed > 13) {
      const bow = sx(spr.bow), flick = Math.floor(tt * 6 + seed) % 2;
      dot(bow - dir * k, wy, 'rgba(255,255,255,0.95)');
      if (flick) dot(bow - dir * k * 2, wy - k, 'rgba(255,255,255,0.7)');
    }
    // Fumée, seulement quand on zoome (sinon trop de bruit sur la carte).
    if (smoke && spr.funnel) {
      for (let i = 0; i < 3; i++) {
        const ph = (tt * 0.7 + i / 3 + seed) % 1;
        const fx = sx(spr.funnel[0]) + dir * Math.round((ph * 7) / u) * k, fy = dy + (spr.funnel[1] - Math.round((ph * 5) / u)) * k;
        g.fillStyle = `rgba(150,160,165,${((1 - ph) * 0.7).toFixed(2)})`;
        g.fillRect(fx, fy, k * (1 + Math.round(ph * 1.5 / u)), k * (1 + Math.round(ph / u)));
      }
    }
  }
  if (left) { g.translate(dx + W, dy); g.scale(-1, 1); g.drawImage(spr.canvas, 0, 0, W, H); } else g.drawImage(spr.canvas, dx, dy, W, H);
  g.restore();
  const hw = W / dpr / 2, hh = H / dpr / 2;
  return { hw, hh, r: Math.max(hw, hh) };
}

export function clearMapShipCache() { cache.clear(); }
