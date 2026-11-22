// Illustrations des navires (profil, en SVG), générées à partir du modèle.
// Chaque modèle a sa silhouette et son époque (navire ancien, années 80, moderne)
// et sa propre livrée, qui dit son prestige ; la compagnie n'apparaît que sur la
// cheminée. L'âge et l'état ne changent jamais les couleurs : ils se voient à la
// rouille, aux rayures, aux bosses, à la peinture arrachée, aux trous et à la suie.
import { SHIP_TYPES } from '../data/ships.js';
import { logoMarkup } from './logos.js';

// Dimensions en mètres (L longueur, D creux, T tirant d'eau en charge, Tb à vide).
//  era    : classic (ancien), eighties (années 80), modern
//  bow    : straight (étrave droite), bulb (bulbe), flared (évasée avec bulbe)
//  stern  : cruiser (arrondie), transom (tableau)
//  sheer  : tonture (m) : le pont remonte vers l'avant et l'arrière
//  livery : couleurs fixes du modèle (coque, œuvres vives, superstructure, liseré, apparaux)
export const SHIP_ART = {
  caboteur: {
    L: 88, D: 8.8, T: 6.4, Tb: 4.8, fc: 1.8, poop: 1.0, sheer: 1.6,
    era: 'classic', bow: 'straight', stern: 'cruiser',
    livery: { hull: '#24292d', boot: '#7d2c21', house: '#ece2c9', trim: null, gear: '#d8cdb0', hatch: '#4f5a4b' },
    house: { x: 0.05, w: 0.18, decks: 3, style: 'classic' },
    hatches: [[0.27, 0.5], [0.57, 0.84]], hatchH: 1.4,
    gear: [{ kind: 'derrick', x: 0.53, h: 13, boom: 0.9 }, { kind: 'mast', x: 0.9, h: 9 }],
    lifeboats: 'davit',
  },
  polyvalent: {
    L: 132, D: 11.6, T: 8.6, Tb: 6.4, fc: 2.4, poop: 1.3, sheer: 0.9,
    era: 'eighties', bow: 'bulb', stern: 'transom',
    livery: { hull: '#244233', boot: '#8b3025', house: '#f2efe6', trim: '#f2efe6', gear: '#e2ad35', hatch: '#3d5a4a' },
    house: { x: 0.11, w: 0.14, decks: 4, style: 'classic' },
    hatches: [[0.29, 0.47], [0.5, 0.68], [0.72, 0.9]], hatchH: 1.8,
    gear: [{ kind: 'crane', x: 0.485, h: 20 }, { kind: 'crane', x: 0.7, h: 20 }, { kind: 'derrick', x: 0.27, h: 15, boom: 0.6, aft: true }, { kind: 'mast', x: 0.94, h: 10 }],
    lifeboats: 'davit',
  },
  vraquier_handy: {
    L: 180, D: 15, T: 10.2, Tb: 7.6, fc: 2.6, poop: 1.4, sheer: 0,
    era: 'modern', bow: 'bulb', stern: 'transom',
    livery: { hull: '#2f3438', boot: '#a4362a', house: '#f6f4ee', trim: null, gear: '#f1eee6', hatch: '#5c6e55' },
    house: { x: 0.03, w: 0.12, decks: 5, style: 'modern' },
    hatches: [[0.19, 0.3], [0.335, 0.445], [0.48, 0.59], [0.625, 0.735], [0.77, 0.88]], hatchH: 2.1,
    gear: [{ kind: 'crane', x: 0.317, h: 18 }, { kind: 'crane', x: 0.462, h: 18 }, { kind: 'crane', x: 0.607, h: 18 }, { kind: 'crane', x: 0.752, h: 18 }, { kind: 'mast', x: 0.955, h: 8 }],
    lifeboats: 'freefall',
  },
  petrolier_mr: {
    L: 183, D: 18, T: 12.2, Tb: 9, fc: 2.4, poop: 1.2, sheer: 0,
    era: 'modern', bow: 'bulb', stern: 'transom',
    livery: { hull: '#722823', boot: '#30363b', house: '#f6f4ee', trim: null, gear: '#f6f4ee', deck: '#4a7a56' },
    house: { x: 0.03, w: 0.12, decks: 5, style: 'modern' },
    tanker: { manifold: 0.5, pipeH: 0.9 },
    emblem: 'drop',
    gear: [{ kind: 'mast', x: 0.955, h: 9 }],
    lifeboats: 'freefall',
  },
  // Aperçus de l'étape 2 : méthanier (cuves sphériques) et gazier (cuves cylindriques).
  methanier: {
    L: 290, D: 26, T: 11.8, Tb: 9.6, fc: 3, poop: 1.4, sheer: 0,
    era: 'modern', bow: 'bulb', stern: 'transom',
    livery: { hull: '#f1efe8', boot: '#24405f', house: '#f7f7f3', trim: '#0f6f76', gear: '#f7f7f3', deck: '#4a7a56' },
    house: { x: 0.025, w: 0.1, decks: 6, style: 'modern' },
    spheres: { count: 4, from: 0.16, to: 0.93, r: 18 },
    emblem: 'snow',
    gear: [{ kind: 'mast', x: 0.965, h: 10 }],
    lifeboats: 'freefall',
  },
  gazier: {
    L: 180, D: 17, T: 10.5, Tb: 8.4, fc: 2.6, poop: 1.2, sheer: 0,
    era: 'modern', bow: 'bulb', stern: 'transom',
    livery: { hull: '#285a4b', boot: '#9c3328', house: '#f6f4ee', trim: '#f6f4ee', gear: '#f6f4ee', deck: '#4a7a56' },
    house: { x: 0.03, w: 0.12, decks: 5, style: 'modern' },
    cylinders: { count: 3, from: 0.19, to: 0.93, r: 6 },
    emblem: 'flame',
    gear: [{ kind: 'mast', x: 0.955, h: 9 }],
    lifeboats: 'freefall',
  },
  feeder: {
    L: 170, D: 14, T: 10, Tb: 7.6, fc: 3, poop: 1.2, sheer: 0,
    era: 'modern', bow: 'flared', stern: 'transom',
    livery: { hull: '#1d3a5e', boot: '#a8392b', house: '#f7f7f3', trim: '#f7f7f3', gear: '#f7f7f3', hatch: '#33506b' },
    house: { x: 0.075, w: 0.1, decks: 6, style: 'modern' },
    containers: { from: 0.19, to: 0.95, tiers: 4, aft: [0.02, 0.07] },
    gear: [{ kind: 'mast', x: 0.97, h: 8 }],
    lifeboats: 'freefall',
  },
};

const CONTAINER_COLORS = ['#b23a3a', '#2f5d8a', '#3f7d5a', '#c97b2a', '#7d8a93', '#8a3f6e', '#d0a43a', '#4b6f7d', '#9a4f2c', '#e4e1d6'];
const RUST = '#7c3a15', RUST_LIGHT = '#a65a2a', PRIMER = '#b4532c', STEEL = '#8b8e8c';
const INK = '#22313a';
// Échelle commune : le plus grand navire du jeu (400 m) remplit le cadre. Un petit
// navire laisse de la place vide, ce qui montre sa taille. L'échelle est un peu
// tassée (puissance 0,7) pour que les petits restent lisibles, et la hauteur est
// exagérée : ce sont des illustrations, pas des plans.

function rand(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;
let uidCounter = 0;

// Usure de 0 (neuf) à 1 (épave) : l'état pèse plus que l'âge.
export function wearOf(typeId, condition = 100, age = 0) {
  const life = SHIP_TYPES[typeId]?.life || 25;
  return Math.max(0, Math.min(1, ((100 - condition) / 100) * 0.85 + (age / life) * 0.4));
}

// Tache irrégulière (contour à rayons aléatoires).
function blob(r, cx, cy, rx, ry, n = 9) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 0.6 + r() * 0.6;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], q = pts[(i - 1) % n];
    d += ` Q${f(q[0])} ${f(q[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
  }
  return d + 'Z';
}

/**
 * opts : condition, age (années), color et logo (compagnie : cheminée), name, laden,
 *        seed, sky (fond), water (mer, sinon socle de maquette), attrs (attributs SVG).
 */
export function shipSVG(typeId, opts = {}) {
  const A = SHIP_ART[typeId] || SHIP_ART.caboteur;
  const { condition = 100, age = 0, color = '#3e8ef7', logo = 'ancre', name = '', laden = false, sky = true, water = true, attrs = '', fit = false } = opts;
  const r = rand(opts.seed ?? (name || typeId));
  const id = 'sh' + (++uidCounter);
  const wear = wearOf(typeId, condition, age);
  const dmg = (100 - condition) / 100; // dégâts : bosses, tôle nue, trous, vitres cassées
  const C = A.livery;
  const W = 400, H = 110, KB = 100; // KB : ligne de quille commune à tous les navires
  // fit : le navire remplit le cadre (maquettes), sinon échelle commune.
  const span = fit ? 372 : 372 * Math.pow(A.L / 400, 0.7);
  const s = span / A.L, v = s * 1.75;
  const UW = 0.42; // la carène (sous la flottaison) est tassée : la livrée reste dominante
  const x0 = 16; // tous les navires partent de la gauche : la place libre à droite montre la taille
  const L = A.L;
  const draft = laden ? A.T : A.Tb;
  const WL = KB - draft * v * UW;
  const X = (m) => f(x0 + m * s);
  const Y = (h) => f(WL - h * v * (h < 0 ? UW : 1));
  const fb = A.D - draft;
  const sheerAt = (fr) => {
    if (!A.sheer) return 0;
    const t = fr < 0.45 ? (0.45 - fr) / 0.45 : (fr - 0.45) / 0.55;
    return A.sheer * t * t * (fr < 0.45 ? 0.55 : 1);
  };
  const deckAt = (fr) => fb + sheerAt(fr);
  const out = [];

  out.push(`<svg viewBox="0 0 ${W} ${H}" class="ship-art" role="img" aria-label="${opts.title || ''}" preserveAspectRatio="xMidYMid meet" ${attrs}><defs>
    <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9dfe9"/><stop offset="1" stop-color="#eef1e8"/></linearGradient>
    <linearGradient id="${id}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f9fb6" stop-opacity=".9"/><stop offset="1" stop-color="#2e5f78" stop-opacity=".97"/></linearGradient>
    <linearGradient id="${id}shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}rust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RUST}" stop-opacity=".95"/><stop offset=".6" stop-color="${RUST_LIGHT}" stop-opacity=".55"/><stop offset="1" stop-color="${RUST_LIGHT}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}soot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111" stop-opacity=".85"/><stop offset="1" stop-color="#111" stop-opacity="0"/></linearGradient>
  </defs>`);
  // Présentation « catalogue » : pas de décor, juste une ombre douce sous la quille.
  void sky;
  out.push(`<ellipse cx="${f(x0 + span / 2)}" cy="${KB + 5}" rx="${f(span * 0.52)}" ry="3.5" fill="${INK}" opacity=".13"/>`);

  // ---------- Coque ----------
  const fc = A.fc, poop = A.poop;
  let hp = `M${X(0)} ${Y(deckAt(0) + poop)} L${X(L * 0.14)} ${Y(deckAt(0.14) + poop)} L${X(L * 0.15)} ${Y(deckAt(0.15))}`;
  for (let k = 1; k <= 10; k++) { const fr = 0.15 + (0.72 * k) / 10; hp += ` L${X(L * fr)} ${Y(deckAt(fr))}`; }
  const bowTop = deckAt(0.97) + fc;
  hp += ` Q${X(L * 0.93)} ${Y(deckAt(0.9))} ${X(L * 0.955)} ${Y(bowTop)}`;
  if (A.bow === 'straight') {
    hp += ` L${X(L)} ${Y(bowTop + 0.3)} L${X(L * 0.962)} ${Y(-draft * 0.55)} Q${X(L * 0.95)} ${Y(-draft)} ${X(L * 0.91)} ${Y(-draft)}`;
  } else {
    const top = A.bow === 'flared' ? `L${X(L * 1.006)} ${Y(bowTop + 0.4)} Q${X(L * 0.985)} ${Y(fb * 0.45)} ${X(L * 0.976)} ${Y(-draft * 0.2)}`
      : `L${X(L)} ${Y(bowTop)} Q${X(L * 0.985)} ${Y(fb * 0.3)} ${X(L * 0.975)} ${Y(-draft * 0.25)}`;
    hp += ` ${top} Q${X(L * 1.008)} ${Y(-draft * 0.5)} ${X(L * 0.985)} ${Y(-draft * 0.85)} Q${X(L * 0.965)} ${Y(-draft)} ${X(L * 0.93)} ${Y(-draft)}`;
  }
  if (A.stern === 'cruiser') {
    hp += ` L${X(L * 0.06)} ${Y(-draft)} Q${X(L * 0.005)} ${Y(-draft)} ${X(-L * 0.004)} ${Y(-draft * 0.25)} Q${X(-L * 0.016)} ${Y(fb * 0.45)} ${X(0)} ${Y(deckAt(0) + poop)} Z`;
  } else {
    hp += ` L${X(L * 0.07)} ${Y(-draft)} Q${X(L * 0.02)} ${Y(-draft)} ${X(L * 0.018)} ${Y(-draft * 0.45)} L${X(0)} ${Y(fb * 0.25)} Z`;
  }
  out.push(`<clipPath id="${id}hull"><path d="${hp}"/></clipPath>`);
  // Gouvernail et hélice (visibles sous l'eau et sur les maquettes).
  out.push(`<rect x="${X(-L * 0.004)}" y="${Y(-draft * 0.15)}" width="${f(L * 0.018 * s)}" height="${f(Y(-draft * 0.87) - Y(-draft * 0.15))}" rx="1" fill="#2b2b2b"/>`);
  out.push(`<ellipse cx="${X(L * 0.03)}" cy="${Y(-draft * 0.6)}" rx="${f(L * 0.008 * s)}" ry="${f((Y(-draft * 0.88) - Y(-draft * 0.32)) / 2)}" fill="#a0814a" stroke="${INK}" stroke-width=".5"/>`);
  out.push(`<path d="${hp}" fill="${C.hull}"/>`);
  const lwl = A.T - draft;
  out.push(`<g clip-path="url(#${id}hull)">`);
  out.push(`<rect x="0" y="${Y(lwl)}" width="${W}" height="${H}" fill="${C.boot}"/>`);
  out.push(`<rect x="0" y="${f(Y(lwl) - 1.6)}" width="${W}" height="1.8" fill="#ece8de"/>`);
  if (C.trim) out.push(`<rect x="0" y="${f(Y(fb) + 1.6)}" width="${W}" height="${f(Math.max(1.4, 0.45 * v))}" fill="${C.trim}"/>`);
  if (wear < 0.12) out.push(`<rect x="0" y="${Y(bowTop)}" width="${W}" height="${f(fb * v * 0.55)}" fill="url(#${id}shine)"/>`);
  // Liston du pont.
  out.push(`<path d="${deckLine()}" stroke="#ece8de" stroke-opacity=".75" stroke-width="${f(Math.max(0.9, 0.3 * v))}" fill="none"/>`);
  // Hublots sur les navires anciens.
  if (A.era === 'classic') for (let xm = L * 0.06; xm < L * 0.22; xm += 2.6) out.push(`<circle cx="${X(xm)}" cy="${Y(deckAt(xm / L) - 1)}" r="${f(Math.max(0.6, 0.32 * s))}" fill="#11161a" opacity=".8"/>`);
  out.push(hullWear());
  out.push('</g>');
  out.push(`<path d="${hp}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
  // Écubier et ancre.
  const hx = L * (A.bow === 'straight' ? 0.94 : 0.955);
  out.push(`<circle cx="${X(hx)}" cy="${Y(bowTop - fc * 0.55)}" r="${f(Math.max(1.2, 0.7 * s))}" fill="#151515" opacity=".8"/>`);
  if (wear > 0.2) out.push(`<path d="M${f(X(hx) - 1.5)} ${Y(bowTop - fc * 0.55)} l3 0 l${f(-1 + r())} ${f((fb + fc * 0.3) * v * (0.4 + wear * 0.6))} l-1 0 z" fill="url(#${id}rust)"/>`);
  if (name) {
    const fsz = Math.max(5, Math.min(10, (fb + fc) * v * 0.32));
    const light = parseInt(C.hull.slice(1, 3), 16) + parseInt(C.hull.slice(3, 5), 16) + parseInt(C.hull.slice(5, 7), 16) > 500;
    out.push(`<text x="${X(L * 0.925)}" y="${f(Y(fb * 0.55) + fsz * 0.35)}" font-size="${f(fsz)}" text-anchor="end" fill="${light ? INK : '#fff'}" fill-opacity=".85" font-family="system-ui, sans-serif" font-weight="700" letter-spacing=".4">${escapeXml(name.toUpperCase())}</text>`);
  }

  // ---------- Pont ----------
  if (A.hatches) {
    for (const [a, b] of A.hatches) {
      const x1 = X(L * a), x2 = X(L * b), base = deckAt((a + b) / 2), y1 = Y(base + A.hatchH), y2 = Y(base);
      out.push(`<rect x="${x1}" y="${y1}" width="${f(x2 - x1)}" height="${f(y2 - y1)}" fill="${C.hatch}" rx="0.6" stroke="${INK}" stroke-width=".7"/>`);
      const ribs = Math.max(2, Math.round((L * (b - a)) / 3.2));
      for (let k = 1; k < ribs; k++) {
        const xx = f(x1 + ((x2 - x1) * k) / ribs);
        out.push(`<line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" stroke="#000" stroke-opacity=".2" stroke-width=".6"/>`);
      }
      if (wear > 0.35) out.push(streak(x1 + r() * (x2 - x1), y1, (A.hatchH * v) * (0.6 + r()), 1.2));
    }
  }
  if (A.containers) {
    const c = A.containers, bay = 12.6;
    const stack = (from, to) => {
      let xm = L * from;
      while (xm + bay <= L * to + 0.1) {
        const tiers = laden ? c.tiers - (r() < 0.3 ? 1 : 0) : (r() < 0.25 ? 1 : 0);
        const base = deckAt(xm / L) + 1.2;
        for (let tz = 0; tz < tiers; tz++) {
          const col = CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)];
          const x = X(xm + 0.2), y = Y(base + (tz + 1) * 2.6), w = f(12.2 * s), hh = f(2.5 * v);
          out.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${col}" stroke="${INK}" stroke-width=".6"/>`);
          for (let k = 1; k < 4; k++) out.push(`<line x1="${f(x + (w * k) / 4)}" y1="${y}" x2="${f(x + (w * k) / 4)}" y2="${f(y + hh)}" stroke="#000" stroke-opacity=".12" stroke-width=".4"/>`);
          if (wear > 0.5 && r() < wear * 0.4) out.push(`<rect x="${f(x + r() * w * 0.7)}" y="${y}" width="${f(w * 0.25)}" height="${hh}" fill="${RUST}" opacity=".35"/>`);
        }
        out.push(`<rect x="${X(xm + 0.2)}" y="${Y(base)}" width="${f(12.2 * s)}" height="${f(1.2 * v)}" fill="${C.hatch}"/>`);
        xm += bay;
      }
    };
    stack(c.from, c.to);
    if (c.aft) stack(c.aft[0], c.aft[1]);
    // Pont de saisissage à l'avant des piles.
    out.push(`<rect x="${X(L * c.from - 1)}" y="${Y(fb + 1.2 + c.tiers * 2.6)}" width="${f(1 * s)}" height="${f(c.tiers * 2.6 * v)}" fill="${C.gear}" opacity=".9"/>`);
  }
  if (A.tanker) {
    // Pétrolier : rangée de dômes de citernes, gros collecteur à vannes rouges, manches jaunes.
    const t = A.tanker, start = L * (A.house.x + A.house.w) + 3, end = L * 0.93;
    out.push(`<rect x="${X(start - 3)}" y="${f(+Y(fb) - 1.4)}" width="${f((end - start + 5) * s)}" height="1.6" fill="${C.deck}"/>`);
    // Une longue citerne arrondie sur tout le pont, comme un camion-citerne : compartiments et trappes.
    const th = 3.4, tx1 = start, tx2 = end, mx0 = L * t.manifold;
    out.push(`<rect x="${X(tx1)}" y="${Y(fb + th)}" width="${f((tx2 - tx1) * s)}" height="${f(th * v)}" rx="${f(Math.min(th * v * 0.5, 9))}" fill="#c3c9cb" stroke="${INK}" stroke-width="1"/>`);
    out.push(`<rect x="${X(tx1 + 1)}" y="${f(+Y(fb + th) + 1.5)}" width="${f((tx2 - tx1 - 2) * s)}" height="${f(th * v * 0.22)}" rx="2" fill="#fff" opacity=".35"/>`);
    const n = Math.max(4, Math.round((tx2 - tx1) / 16));
    for (let k = 1; k < n; k++) {
      const xx = tx1 + ((tx2 - tx1) * k) / n;
      out.push(`<line x1="${X(xx)}" y1="${Y(fb + th)}" x2="${X(xx)}" y2="${Y(fb)}" stroke="${INK}" stroke-width=".7" opacity=".55"/>`);
    }
    for (let k = 0; k < n; k++) {
      const cx = tx1 + ((tx2 - tx1) * (k + 0.5)) / n;
      if (Math.abs(cx - mx0) < 6) continue;
      out.push(`<rect x="${X(cx - 1.4)}" y="${Y(fb + th + 0.9)}" width="${f(2.8 * s)}" height="${f(0.9 * v)}" rx="1" fill="#8e979c" stroke="${INK}" stroke-width=".6"/>`);
    }
    out.push(`<line x1="${X(start - 2)}" y1="${Y(fb + t.pipeH)}" x2="${X(end)}" y2="${Y(fb + t.pipeH)}" stroke="${INK}" stroke-width="${f(Math.max(2.4, 0.7 * v) + 1.2)}"/>`);
    out.push(`<line x1="${X(start - 2)}" y1="${Y(fb + t.pipeH)}" x2="${X(end)}" y2="${Y(fb + t.pipeH)}" stroke="#8d969c" stroke-width="${f(Math.max(2.4, 0.7 * v))}"/>`);
    out.push(manifold(mx0, fb + th - 1, 3));
    for (let k = 0; k < Math.floor(wear * 5); k++) out.push(streak(+X(L * (0.3 + r() * 0.6)), +Y(fb + t.pipeH), 6 * v * r(), 1));
  }
  if (A.spheres) {
    // Méthanier : grandes cuves sphériques, la silhouette la plus reconnaissable des mers.
    const sp = A.spheres, gap = ((sp.to - sp.from) * L) / sp.count;
    for (let k = 0; k < sp.count; k++) {
      const cx = L * sp.from + gap * (k + 0.5), R = Math.min(sp.r, gap * 0.46) * s;
      const cy = +Y(fb) - R * 0.55;
      out.push(`<rect x="${f(+X(cx) - R * 0.9)}" y="${f(cy)}" width="${f(R * 1.8)}" height="${f(+Y(fb) - cy)}" fill="${C.hull}" stroke="${INK}" stroke-width=".8"/>`);
      out.push(`<circle cx="${X(cx)}" cy="${f(cy)}" r="${f(R)}" fill="#ecebe4" stroke="${INK}" stroke-width="1"/>`);
      out.push(`<path d="M${f(+X(cx) - R)} ${f(cy)} h${f(R * 2)}" stroke="${C.trim}" stroke-width="${f(Math.max(1.4, R * 0.08))}"/>`);
      out.push(`<rect x="${f(+X(cx) - R * 0.18)}" y="${f(cy - R - R * 0.14)}" width="${f(R * 0.36)}" height="${f(R * 0.16)}" rx="1" fill="#9aa3a8" stroke="${INK}" stroke-width=".6"/>`);
      if (wear > 0.35) out.push(streak(+X(cx) + R * (r() - 0.5), cy - R * 0.6, R * (0.6 + wear * 0.8), 1.4));
    }
    out.push(`<line x1="${X(L * sp.from)}" y1="${f(+Y(fb) - Math.min(sp.r, gap * 0.46) * s * 1.6)}" x2="${X(L * sp.to)}" y2="${f(+Y(fb) - Math.min(sp.r, gap * 0.46) * s * 1.6)}" stroke="${INK}" stroke-width=".9" opacity=".7"/>`);
    out.push(manifold(L * (sp.from + gap / L), fb, 3));
  }
  if (A.cylinders) {
    // Gazier : cuves cylindriques couchées sur le pont, dômes et vannes au-dessus.
    const cy = A.cylinders, gap = ((cy.to - cy.from) * L) / cy.count, hh = cy.r * 2 * 0.62;
    for (let k = 0; k < cy.count; k++) {
      const x1 = L * cy.from + gap * k + 1.5, w = gap - 3;
      out.push(`<rect x="${X(x1)}" y="${Y(fb + hh + 0.6)}" width="${f(w * s)}" height="${f(hh * v)}" rx="${f(hh * v * 0.5)}" fill="#dfe2dd" stroke="${INK}" stroke-width="1"/>`);
      out.push(`<rect x="${X(x1 + w * 0.3)}" y="${f(+Y(fb + 0.6))}" width="${f(w * 0.1 * s)}" height="${f(0.6 * v)}" fill="${INK}"/><rect x="${X(x1 + w * 0.6)}" y="${f(+Y(fb + 0.6))}" width="${f(w * 0.1 * s)}" height="${f(0.6 * v)}" fill="${INK}"/>`);
      const dx = x1 + w * 0.5;
      out.push(`<rect x="${X(dx - 1.5)}" y="${Y(fb + hh + 1.8)}" width="${f(3 * s)}" height="${f(1.2 * v)}" fill="#9aa3a8" stroke="${INK}" stroke-width=".6"/>`);
      out.push(valveWheel(dx, fb + hh + 2.6, 1.1));
      if (wear > 0.35) out.push(streak(+X(x1 + w * r()), +Y(fb + hh + 0.6), hh * v * (0.4 + wear * 0.5), 1.2));
    }
    out.push(`<line x1="${X(L * cy.from)}" y1="${Y(fb + hh + 2)}" x2="${X(L * cy.to)}" y2="${Y(fb + hh + 2)}" stroke="#9aa3a8" stroke-width="2"/>`);
  }
  // Pictogramme de la cargaison sur la coque et pavillon B (marchandise dangereuse) quand le navire est chargé.
  if (A.emblem) out.push(emblem(A.emblem, L * 0.62, fb * 0.5));
  if (laden && (A.tanker || A.spheres || A.cylinders)) out.push(bravoFlag());
  for (const g of A.gear || []) out.push(gear(g));

  // ---------- Château ----------
  out.push(house());

  // ---------- Ligne de flottaison (ou socle de maquette) ----------
  if (!water) {
    out.push(`<rect x="${X(L * 0.25)}" y="${KB}" width="${f(L * 0.08 * s)}" height="6" fill="#6b4a2e"/><rect x="${X(L * 0.67)}" y="${KB}" width="${f(L * 0.08 * s)}" height="6" fill="#6b4a2e"/>`);
    out.push(`<rect x="${X(L * 0.1)}" y="${KB + 6}" width="${f(L * 0.8 * s)}" height="5" rx="2" fill="#7a5434"/></svg>`);
    return out.join('');
  }
  // Un voile d'eau très transparent : il montre l'enfoncement sans cacher la coque.
  out.push(`<rect x="${f(x0 - 10)}" y="${WL}" width="${f(span + 26)}" height="${f(KB - WL + 4)}" rx="3" fill="#5b9ab5" opacity=".13"/>`);
  out.push(`<line x1="${f(x0 - 10)}" y1="${WL}" x2="${f(x0 + span + 16)}" y2="${WL}" stroke="#2f6f8c" stroke-opacity=".5" stroke-width="1" stroke-dasharray="5 3"/>`);
  out.push('</svg>');
  return out.join('');

  // ---------- Fonctions de dessin ----------
  function valveWheel(xm, hm, rm) {
    const cx = +X(xm), cyy = +Y(hm), rr = Math.max(2.2, rm * s);
    return `<circle cx="${f(cx)}" cy="${f(cyy)}" r="${f(rr)}" fill="none" stroke="${INK}" stroke-width="${f(Math.max(1.6, rr * 0.45) + 1)}"/>
      <circle cx="${f(cx)}" cy="${f(cyy)}" r="${f(rr)}" fill="none" stroke="#c4362c" stroke-width="${f(Math.max(1.6, rr * 0.45))}"/>
      <path d="M${f(cx - rr)} ${f(cyy)} h${f(rr * 2)} M${f(cx)} ${f(cyy - rr)} v${f(rr * 2)}" stroke="#c4362c" stroke-width="1"/>`;
  }

  // Collecteur de chargement : colonnes à vannes rouges, manches jaunes, grue de manutention.
  function manifold(mx, base, hm) {
    const o = [];
    for (const dx of [-2.6, 0, 2.6]) {
      o.push(`<line x1="${X(mx + dx)}" y1="${Y(base)}" x2="${X(mx + dx)}" y2="${Y(base + hm)}" stroke="${INK}" stroke-width="${f(Math.max(2.2, 0.6 * s) + 1.2)}"/>`);
      o.push(`<line x1="${X(mx + dx)}" y1="${Y(base)}" x2="${X(mx + dx)}" y2="${Y(base + hm)}" stroke="#9aa3a8" stroke-width="${f(Math.max(2.2, 0.6 * s))}"/>`);
      o.push(valveWheel(mx + dx, base + hm + 0.6, 1.1));
    }
    // Manches de chargement qui pendent par-dessus bord.
    o.push(`<path d="M${X(mx - 2.6)} ${Y(base + hm - 0.6)} q${f(-3 * s)} ${f(2 * v)} ${f(-1.5 * s)} ${f((hm + 1.5) * v)}" stroke="${INK}" stroke-width="${f(Math.max(2.4, 0.7 * s) + 1.2)}" fill="none" stroke-linecap="round"/>`);
    o.push(`<path d="M${X(mx - 2.6)} ${Y(base + hm - 0.6)} q${f(-3 * s)} ${f(2 * v)} ${f(-1.5 * s)} ${f((hm + 1.5) * v)}" stroke="#e3b23c" stroke-width="${f(Math.max(2.4, 0.7 * s))}" fill="none" stroke-linecap="round"/>`);
    o.push(`<path d="M${X(mx + 2.6)} ${Y(base + hm - 0.6)} q${f(3 * s)} ${f(2 * v)} ${f(1.5 * s)} ${f((hm + 1.5) * v)}" stroke="${INK}" stroke-width="${f(Math.max(2.4, 0.7 * s) + 1.2)}" fill="none" stroke-linecap="round"/>`);
    o.push(`<path d="M${X(mx + 2.6)} ${Y(base + hm - 0.6)} q${f(3 * s)} ${f(2 * v)} ${f(1.5 * s)} ${f((hm + 1.5) * v)}" stroke="#e3b23c" stroke-width="${f(Math.max(2.4, 0.7 * s))}" fill="none" stroke-linecap="round"/>`);
    // Petite grue des manches.
    o.push(`<line x1="${X(mx + 5)}" y1="${Y(base)}" x2="${X(mx + 5)}" y2="${Y(base + 9)}" stroke="${INK}" stroke-width="${f(Math.max(1.6, 0.6 * s) + 1)}"/><line x1="${X(mx + 5)}" y1="${Y(base)}" x2="${X(mx + 5)}" y2="${Y(base + 9)}" stroke="${C.gear}" stroke-width="${f(Math.max(1.6, 0.6 * s))}"/>`);
    o.push(`<line x1="${X(mx + 5)}" y1="${Y(base + 8.6)}" x2="${X(mx - 4)}" y2="${Y(base + 6)}" stroke="${INK}" stroke-width="${f(Math.max(1.2, 0.4 * s) + 1)}"/><line x1="${X(mx + 5)}" y1="${Y(base + 8.6)}" x2="${X(mx - 4)}" y2="${Y(base + 6)}" stroke="${C.gear}" stroke-width="${f(Math.max(1.2, 0.4 * s))}"/>`);
    return o.join('');
  }

  // Pictogramme peint sur la coque : goutte (hydrocarbures), flamme (gaz), flocon (gaz liquéfié froid).
  function emblem(kind, xm, hm) {
    const cx = +X(xm), cyy = +Y(hm), rr = Math.max(4.5, Math.min(9, (fb + 1) * v * 0.32));
    let icon;
    if (kind === 'drop') icon = `<path d="M${f(cx)} ${f(cyy - rr * 0.62)} q${f(rr * 0.5)} ${f(rr * 0.55)} ${f(rr * 0.42)} ${f(rr * 0.9)} a${f(rr * 0.42)} ${f(rr * 0.42)} 0 0 1 ${f(-rr * 0.84)} 0 q${f(-rr * 0.08)} ${f(-rr * 0.35)} ${f(rr * 0.42)} ${f(-rr * 0.9)} z" fill="#1c2a33"/>`;
    else if (kind === 'flame') icon = `<path d="M${f(cx)} ${f(cyy - rr * 0.65)} c${f(rr * 0.5)} ${f(rr * 0.4)} ${f(rr * 0.55)} ${f(rr * 0.8)} ${f(rr * 0.25)} ${f(rr * 1.15)} c${f(-rr * 0.15)} ${f(rr * 0.12)} ${f(-rr * 0.35)} ${f(rr * 0.12)} ${f(-rr * 0.5)} 0 c${f(-rr * 0.3)} ${f(-rr * 0.35)} ${f(-rr * 0.2)} ${f(-rr * 0.75)} ${f(rr * 0.25)} ${f(-rr * 1.15)} z" fill="#d9541e"/>`;
    else icon = `<g stroke="#1f5f8b" stroke-width="${f(Math.max(1, rr * 0.16))}" stroke-linecap="round">${[0, 60, 120].map((a) => `<line x1="${f(cx)}" y1="${f(cyy - rr * 0.62)}" x2="${f(cx)}" y2="${f(cyy + rr * 0.62)}" transform="rotate(${a} ${f(cx)} ${f(cyy)})"/>`).join('')}</g>`;
    return `<circle cx="${f(cx)}" cy="${f(cyy)}" r="${f(rr)}" fill="#f7f5ef" stroke="${INK}" stroke-width=".9"/>${icon}`;
  }

  // Pavillon « B » du code international : rouge, à queue d'aronde, hissé quand on transporte du danger.
  function bravoFlag() {
    const m = (A.gear || []).find((g) => g.kind === 'mast');
    if (!m) return '';
    const px = +X(L * m.x), top = +Y(deckAt(m.x) + m.h) + 1, w = Math.max(7, 4 * s), hgt = Math.max(5, 2.6 * v);
    return `<path d="M${f(px)} ${f(top)} h${f(w)} l${f(-w * 0.3)} ${f(hgt / 2)} l${f(w * 0.3)} ${f(hgt / 2)} h${f(-w)} z" fill="#d32f2f" stroke="${INK}" stroke-width=".6"/>`;
  }
  function deckLine() {
    let d = `M${X(L * 0.15)} ${Y(deckAt(0.15))}`;
    for (let k = 1; k <= 10; k++) { const fr = 0.15 + (0.72 * k) / 10; d += ` L${X(L * fr)} ${Y(deckAt(fr))}`; }
    return d;
  }

  // Coulure de rouille : plus large en haut, qui s'efface vers le bas.
  function streak(x, y, len, width = 1.5) {
    const w = Math.max(1, width * (0.6 + r() * 0.8));
    return `<path d="M${f(x)} ${f(y)} h${f(w)} l${f(-w * 0.35 + r() * 0.6)} ${f(len)} h${f(-w * 0.4)} z" fill="url(#${id}rust)"/>`;
  }

  function hullWear() {
    const g = [];
    if (wear < 0.06) return '';
    // Coulures sous les dalots, le long du pont.
    const nStreaks = Math.round(wear * 18 + wear * wear * 16);
    for (let k = 0; k < nStreaks; k++) {
      const fr = 0.05 + r() * 0.9, top = deckAt(fr) - 0.2;
      g.push(streak(+X(L * fr), +Y(top), (top + 0.5) * v * (0.35 + r() * 0.6), Math.max(1.2, 0.5 * s)));
    }
    // Éraflures des défenses de quai : traits horizontaux clairs et sombres.
    if (wear > 0.2) {
      for (let k = 0; k < Math.round(wear * 14); k++) {
        const xm = L * (0.1 + r() * 0.8), hm = 0.3 + r() * Math.min(3.5, fb), len = (2 + r() * 9) * s;
        g.push(`<path d="M${X(xm)} ${Y(hm)} l${f(len)} ${f(r() * 1.4 - 0.7)}" stroke="${r() < 0.6 ? '#d8cfbf' : '#0d0d0d'}" stroke-opacity="${f(0.35 + wear * 0.35)}" stroke-width="${f(0.5 + r() * 0.8)}" stroke-linecap="round"/>`);
      }
    }
    // Plaques de rouille irrégulières, surtout à la flottaison et à l'avant.
    for (let k = 0; k < Math.round(Math.pow(wear, 1.3) * 16); k++) {
      const fr = r() < 0.35 ? 0.85 + r() * 0.12 : 0.05 + r() * 0.85;
      const hm = r() < 0.55 ? r() * 1.8 : r() * fb;
      const rx = (1 + r() * 3) * s, ry = (0.5 + r() * 1.2) * v;
      g.push(`<path d="${blob(r, +X(L * fr), +Y(hm), rx, ry)}" fill="${RUST}" opacity="${f(0.55 + wear * 0.35)}"/>`);
      g.push(`<path d="${blob(r, +X(L * fr), +Y(hm), rx * 0.55, ry * 0.55)}" fill="${RUST_LIGHT}" opacity=".7"/>`);
    }
    // Bosses : petits creux ombrés.
    if (dmg > 0.4 || age > 15) {
      for (let k = 0; k < Math.round(Math.max(dmg - 0.3, 0.15) * 8); k++) {
        const xm = L * (0.15 + r() * 0.7), hm = 0.8 + r() * Math.max(0.5, fb - 1.5), w = (2.5 + r() * 4) * s;
        g.push(`<path d="M${X(xm)} ${Y(hm)} q${f(w / 2)} ${f(1.4 * v)} ${f(w)} 0" stroke="#000" stroke-opacity=".35" stroke-width="1" fill="none"/>`);
        g.push(`<path d="M${X(xm)} ${f(+Y(hm) - 1)} q${f(w / 2)} ${f(1.4 * v)} ${f(w)} 0" stroke="#fff" stroke-opacity=".18" stroke-width=".8" fill="none"/>`);
      }
    }
    // Peinture arrachée : apprêt orangé et, plus rarement, tôle nue.
    if (dmg > 0.5) {
      for (let k = 0; k < Math.round((dmg - 0.45) * 14); k++) {
        const xm = L * (0.1 + r() * 0.8), hm = 0.5 + r() * Math.max(0.5, fb - 1);
        g.push(`<path d="${blob(r, +X(xm), +Y(hm), (1 + r() * 2.5) * s, (0.5 + r() * 0.8) * v, 7)}" fill="${r() < 0.75 ? PRIMER : STEEL}" opacity=".9"/>`);
      }
    }
    // Trous : seulement sur une épave (état sous 25 %).
    if (dmg > 0.75) {
      for (let k = 0; k < Math.round((dmg - 0.7) * 14); k++) {
        const xm = L * (0.12 + r() * 0.76), hm = 1 + r() * Math.max(0.5, fb - 2);
        const rr = (0.5 + r() * 0.8) * s;
        g.push(`<ellipse cx="${X(xm)}" cy="${Y(hm)}" rx="${f(rr * 2.2)}" ry="${f(rr * 1.7)}" fill="${RUST}" opacity=".8"/>`);
        g.push(`<ellipse cx="${X(xm)}" cy="${Y(hm)}" rx="${f(rr)}" ry="${f(rr * 0.8)}" fill="#0a0a0a"/>`);
        g.push(streak(+X(xm) - 0.5, +Y(hm) + rr, 3 * v * (0.5 + r()), 1.4));
      }
    }
    // Salissures à la flottaison.
    if (wear > 0.25) g.push(`<rect x="0" y="${Y(1.1)}" width="${W}" height="${f(1.1 * v)}" fill="${RUST}" opacity="${f((wear - 0.25) * 0.75)}"/>`);
    return g.join('');
  }

  function gear(g) {
    const px = L * g.x, base = deckAt(g.x);
    if (g.kind === 'mast') {
      return `<line x1="${X(px)}" y1="${Y(base + (g.x > 0.9 ? fc : 0))}" x2="${X(px)}" y2="${Y(base + g.h)}" stroke="${INK}" stroke-width="${f(Math.max(1.4, 0.6 * s))}"/>
        <line x1="${f(+X(px) - 2.2)}" y1="${Y(base + g.h - 1.5)}" x2="${f(+X(px) + 2.2)}" y2="${Y(base + g.h - 1.5)}" stroke="${C.gear}" stroke-width=".8"/>`;
    }
    if (g.kind === 'derrick') {
      // Mât de charge à l'ancienne : poteau, corne, mâts de charge relevés et leurs balancines.
      const top = base + g.h, dir = g.aft ? -1 : 1;
      const tipX = px + dir * g.h * 0.75 * g.boom, tipH = base + g.h * 0.55;
      let o = `<line x1="${X(px)}" y1="${Y(base + 1.6)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="${INK}" stroke-width="${f(Math.max(1, 0.7 * s) + 1.4)}" stroke-linecap="round"/>`;
      o += `<line x1="${X(px)}" y1="${Y(base + 1.6)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="${C.gear}" stroke-width="${f(Math.max(1, 0.7 * s))}" stroke-linecap="round"/>`;
      o += `<rect x="${f(+X(px) - Math.max(1, 0.7 * s))}" y="${Y(top)}" width="${f(Math.max(2, 1.4 * s))}" height="${f(g.h * v)}" fill="${C.gear}" stroke="${INK}" stroke-width=".7"/>`;
      o += `<rect x="${f(+X(px) - 3.2 * s)}" y="${Y(top - 0.4)}" width="${f(6.4 * s)}" height="${f(Math.max(1, 0.5 * v))}" fill="${C.gear}" stroke="${INK}" stroke-width=".6"/>`;
      o += `<line x1="${X(px)}" y1="${Y(top - 0.5)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="#2a2a2a" stroke-width=".5" opacity=".7"/>`;
      o += `<line x1="${X(tipX)}" y1="${Y(tipH)}" x2="${X(tipX)}" y2="${Y(base + 2)}" stroke="#2a2a2a" stroke-width=".5" opacity=".6"/>`;
      if (wear > 0.3) o += streak(+X(px) - 0.5, +Y(top - 1), g.h * v * 0.5 * wear, 1);
      return o;
    }
    // Grue moderne : fût, cabine, flèche relevée.
    const top = base + g.h * 0.42, pw = Math.max(1.2, 1.6 * s);
    const tipX = px + g.h * 0.7, tipH = top + g.h * 0.55;
    const bw = Math.max(1.4, 1.1 * s);
    let o = `<line x1="${X(px)}" y1="${Y(top + 1)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="${INK}" stroke-width="${f(bw + 1.4)}" stroke-linecap="round"/>`;
    o += `<line x1="${X(px)}" y1="${Y(top + 1)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="${C.gear}" stroke-width="${f(bw)}" stroke-linecap="round"/>`;
    o += `<rect x="${f(+X(px) - pw / 2)}" y="${Y(top)}" width="${f(pw)}" height="${f((top - base) * v)}" fill="${C.gear}" stroke="${INK}" stroke-width=".7"/>`;
    o += `<rect x="${f(+X(px) - 2.2 * s)}" y="${Y(top + 2.2)}" width="${f(4 * s)}" height="${f(2.2 * v)}" fill="${C.gear}" stroke="${INK}" stroke-width=".7"/><rect x="${f(+X(px) + 0.6 * s)}" y="${Y(top + 1.7)}" width="${f(1.2 * s)}" height="${f(0.8 * v)}" fill="#24323b"/>`;
    o += `<line x1="${X(tipX)}" y1="${Y(tipH)}" x2="${X(tipX)}" y2="${Y(base + (A.hatchH || 1) + 0.6)}" stroke="#333" stroke-width=".5" opacity=".6"/>`;
    if (wear > 0.45) o += streak(+X(px) - pw / 3, +Y(top), (top - base) * v * 0.35 * wear, pw * 0.4);
    return o;
  }

  function house() {
    const hsp = A.house, hx1 = L * hsp.x, hx2 = L * (hsp.x + hsp.w);
    const base = deckAt(hsp.x) + (hsp.x < 0.14 ? poop : 0), dk = 2.7;
    const topH = base + hsp.decks * dk;
    const o = [];
    if (hsp.style === 'classic') {
      // Ponts en gradins, angles arrondis, hublots ronds.
      for (let d = 0; d < hsp.decks; d++) {
        const x1 = hx1, x2 = hx2 - d * 0.9;
        o.push(`<rect x="${X(x1)}" y="${Y(base + (d + 1) * dk)}" width="${f((x2 - x1) * s)}" height="${f(dk * v + 0.4)}" rx="${f(Math.min(3, 0.8 * s))}" fill="${C.house}" stroke="${INK}" stroke-width=".8"/>`);
        const last = d === hsp.decks - 1;
        for (let xm = x1 + 1.4; xm < x2 - 1; xm += last ? 1.8 : 2.4) {
          o.push(last
            ? `<rect x="${X(xm)}" y="${Y(base + d * dk + dk * 0.75)}" width="${f(Math.max(0.9, 1.1 * s))}" height="${f(Math.max(0.9, 0.9 * v))}" fill="#26333c"/>`
            : `<circle cx="${X(xm)}" cy="${Y(base + d * dk + dk * 0.5)}" r="${f(Math.max(0.55, 0.38 * s))}" fill="#33424c"/>`);
        }
      }
      // Canots de sauvetage sur bossoirs.
      if (A.lifeboats === 'davit') {
        const bw = Math.min(6.5, (hx2 - hx1) * 0.45), bx = hx1 + (hx2 - hx1) * 0.12, by = base + dk * 1.05;
        const bh = Math.max(1.6 / v, 1.5);
        o.push(`<path d="M${X(bx)} ${Y(by + bh)} h${f(bw * s)} q${f(-0.4 * s)} ${f(bh * v)} ${f(-bw * 0.25 * s)} ${f(bh * v)} h${f(-bw * 0.5 * s)} q${f(-bw * 0.2 * s)} 0 ${f(-bw * 0.25 * s)} ${f(-bh * v)} z" fill="#f2f0ea" stroke="#9a9a9a" stroke-width=".4"/>`);
        o.push(`<rect x="${X(bx + bw * 0.12)}" y="${Y(by + bh + 0.7)}" width="${f(bw * 0.76 * s)}" height="${f(0.7 * v)}" rx="${f(0.35 * v)}" fill="#e8742c"/>`);
        o.push(`<path d="M${X(bx + 0.2)} ${Y(by + bh)} v${f(-1.8 * v)} q0 ${f(-0.4 * v)} ${f(0.6 * s)} ${f(-0.4 * v)} M${X(bx + bw - 0.2)} ${Y(by + bh)} v${f(-1.8 * v)} q0 ${f(-0.4 * v)} ${f(-0.6 * s)} ${f(-0.4 * v)}" stroke="#4a4a4a" stroke-width=".7" fill="none"/>`);
      }
      // Cheminée haute et fine.
      const fw = Math.max(2.6, (hx2 - hx1) * 0.22), fx = hx1 + (hx2 - hx1) * 0.32, fH = dk * 1.7;
      o.push(funnel(fx, topH - dk * 0.2, fw, fH, fw * 0.15));
      o.push(`<line x1="${X(hx1 + (hx2 - hx1) * 0.75)}" y1="${Y(topH)}" x2="${X(hx1 + (hx2 - hx1) * 0.78)}" y2="${Y(topH + 5)}" stroke="${C.house}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/>`);
    } else {
      // Bloc moderne : ponts identiques, fenêtres rectangulaires, ailerons de passerelle.
      o.push(`<rect x="${X(hx1)}" y="${Y(topH)}" width="${f((hx2 - hx1) * s)}" height="${f((topH - base) * v)}" fill="${C.house}" stroke="${INK}" stroke-width=".9"/>`);
      o.push(`<rect x="${X(hx1 - 1.6)}" y="${Y(topH + 0.5)}" width="${f((hx2 - hx1 + 3.2) * s)}" height="${f(1.1 * v)}" fill="${C.house}" stroke="${INK}" stroke-width=".8"/>`);
      for (let d = 0; d < hsp.decks; d++) {
        const yy = Y(base + d * dk + dk * 0.6), last = d === hsp.decks - 1;
        if (last) o.push(`<rect x="${X(hx1 + 0.6)}" y="${yy}" width="${f((hx2 - hx1 - 1.2) * s)}" height="${f(1 * v)}" fill="#1f2b33"/>`);
        else for (let xm = hx1 + 1.2; xm < hx2 - 1; xm += 2.2) o.push(`<rect x="${X(xm)}" y="${yy}" width="${f(Math.max(0.9, 1.1 * s))}" height="${f(Math.max(0.8, 0.7 * v))}" fill="#3a4a54"/>`);
        o.push(`<line x1="${X(hx1)}" y1="${Y(base + (d + 1) * dk)}" x2="${X(hx2)}" y2="${Y(base + (d + 1) * dk)}" stroke="#000" stroke-opacity=".1" stroke-width=".6"/>`);
      }
      // Canot de sauvetage en chute libre, sur sa rampe à la poupe.
      if (A.lifeboats === 'freefall') {
        const bx = L * 0.005, by = deckAt(0) + poop + 1.4;
        o.push(`<g transform="rotate(-22 ${X(bx)} ${Y(by)})"><rect x="${X(bx)}" y="${Y(by + 1.6)}" width="${f(7 * s)}" height="${f(1.8 * v)}" rx="${f(0.9 * v)}" fill="#e8742c"/><rect x="${X(bx + 2)}" y="${Y(by + 2.2)}" width="${f(2.5 * s)}" height="${f(0.8 * v)}" rx="1" fill="#e8742c"/></g>`);
      }
      const fw = Math.max(3, (hx2 - hx1) * 0.34), fx = hx1 + (hx2 - hx1) * 0.08, fH = A.era === 'modern' ? dk * 1.4 : dk * 1.6;
      o.push(funnel(fx, topH + 0.5, fw, fH, fw * 0.28));
      const mastX = hx1 + (hx2 - hx1) * 0.68;
      o.push(`<line x1="${X(mastX)}" y1="${Y(topH + 1.6)}" x2="${X(mastX)}" y2="${Y(topH + 6)}" stroke="${C.house}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/><line x1="${X(mastX - 2)}" y1="${Y(topH + 4.6)}" x2="${X(mastX + 2)}" y2="${Y(topH + 4.6)}" stroke="${C.house}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/>`);
    }
    // Usure du château : coulures sous les fenêtres, vitres cassées.
    if (wear > 0.3) {
      for (let k = 0; k < Math.round(wear * 10); k++) {
        const xm = hx1 + r() * (hx2 - hx1), hm = base + r() * (topH - base);
        o.push(streak(+X(xm), +Y(hm), (1.5 + r() * 3.5) * v, Math.max(1, 0.35 * s)));
      }
    }
    if (dmg > 0.65) {
      for (let k = 0; k < Math.round((dmg - 0.55) * 8); k++) {
        const xm = hx1 + 1 + r() * (hx2 - hx1 - 2), hm = base + (Math.floor(r() * hsp.decks) + 0.6) * dk;
        o.push(`<path d="M${X(xm)} ${Y(hm)} l${f(0.6 * s)} ${f(0.4 * v)} l${f(-0.3 * s)} ${f(0.3 * v)} l${f(0.8 * s)} ${f(0.2 * v)}" stroke="#ddd" stroke-width=".6" fill="none"/>`);
      }
    }
    return o.join('');
  }

  // Cheminée aux couleurs de la compagnie (seul élément qui change d'un armateur à l'autre).
  function funnel(fx, fy0, fw, fH, rake) {
    const fy1 = fy0 + fH;
    const o = [];
    o.push(`<path d="M${X(fx)} ${Y(fy0)} L${X(fx + fw)} ${Y(fy0)} L${X(fx + fw - rake)} ${Y(fy1)} L${X(fx - rake)} ${Y(fy1)} Z" fill="${color}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>`);
    o.push(`<path d="M${X(fx - rake * 0.82)} ${Y(fy1 - fH * 0.18)} L${X(fx + fw - rake * 0.82)} ${Y(fy1 - fH * 0.18)} L${X(fx + fw - rake)} ${Y(fy1)} L${X(fx - rake)} ${Y(fy1)} Z" fill="#1b1b1b"/>`);
    const lr = Math.min(fw * s, fH * v * 0.6) * 0.42;
    const lcx = X(fx + fw / 2 - rake * 0.45), lcy = Y(fy0 + fH * 0.42);
    o.push(`<circle cx="${lcx}" cy="${lcy}" r="${f(lr)}" fill="#fff"/>`);
    o.push(`<g transform="translate(${f(lcx - lr * 0.78)} ${f(lcy - lr * 0.78)}) scale(${f((lr * 1.56) / 64)})" color="${color}">${logoMarkup(logo)}</g>`);
    // Suie et fumée : légère pour un moteur sain, noire et épaisse pour un vieux moteur.
    if (wear > 0.35) o.push(`<path d="M${X(fx + fw * 0.15 - rake * 0.8)} ${Y(fy1 - fH * 0.18)} h${f(fw * 0.7 * s)} l${f(-0.4 * s)} ${f(fH * v * 0.55 * wear)} h${f(-fw * 0.5 * s)} z" fill="url(#${id}soot)"/>`);
    const dark = wear > 0.45;
    for (let k = 0; k < 3; k++) {
      o.push(`<ellipse cx="${f(+X(fx + fw / 2 - rake) - k * 7 - 3)}" cy="${f(+Y(fy1) - 3 - k * 4)}" rx="${f(3 + k * 2.5 + (dark ? 1.5 : 0))}" ry="${f(2 + k * 1.2)}" fill="${dark ? '#2f2f2f' : '#d8dde0'}" opacity="${f((dark ? 0.6 : 0.35) - k * 0.12)}"/>`);
    }
    return o.join('');
  }
}

function escapeXml(t) {
  return String(t).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function shipArtEl(typeId, opts = {}, cls = '') {
  const div = document.createElement('div');
  div.className = 'ship-art-wrap ' + cls;
  div.innerHTML = shipSVG(typeId, opts);
  return div;
}

export function artForShip(state, ship, extra = {}) {
  const c = state.companies[ship.owner];
  const age = (state.t - ship.builtT) / (24 * 365);
  return shipSVG(ship.type, { condition: ship.condition, age, color: c.color, logo: c.logo, name: ship.name, laden: !!ship.cargo, seed: ship.id + ship.name, ...extra });
}
