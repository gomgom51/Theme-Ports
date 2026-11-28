// Illustrations des navires (profil, en SVG), générées à partir du modèle.
// Chaque modèle a sa silhouette et son époque (navire ancien, années 80, moderne)
// et sa propre livrée, qui dit son prestige ; la compagnie n'apparaît que sur la
// cheminée. L'âge et l'état ne changent jamais les couleurs : ils se voient à la
// rouille, aux rayures, aux bosses, à la peinture arrachée, aux trous et à la suie.
import { SHIP_TYPES } from '../data/ships.js';
import { logoMarkup, emblemOnWhite } from './logos.js';
import { pixelShipMarkup } from './pixelship.js';
import { SHIP_ART } from './shipshapes.js';

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
 * Illustration d'un navire, en pixel art (pixelship.js) dans le style choisi par le joueur.
 * opts : condition, age (années), color et logo (compagnie : cheminée), name, laden, seed,
 *        title (texte lu par les lecteurs d'écran), sky (false : pas de ciel, vignettes),
 *        slot ('big' : grand cadre animé ; 'hero', 'card', 'thumb' : fixes).
 * Avec attrs (dessin inséré dans un autre SVG, la maquette du bureau) ou vector, on garde le
 * dessin vectoriel d'origine.
 */
export function shipMarkup(typeId, opts = {}) {
  if (opts.attrs || opts.vector) return vectorSVG(typeId, opts);
  const { condition = 100, age = 0 } = opts;
  return pixelShipMarkup(typeId, { ...opts, wear: wearOf(typeId, condition, age), dmg: (100 - condition) / 100 });
}

/**
 * Dessin vectoriel (ancien style, gardé pour la maquette du bureau).
 * opts : condition, age (années), color et logo (compagnie : cheminée), name, laden,
 *        seed, sky (fond), water (mer, sinon socle de maquette), attrs (attributs SVG).
 */
function vectorSVG(typeId, opts = {}) {
  const A = SHIP_ART[typeId] || SHIP_ART.caboteur;
  const { condition = 100, age = 0, color = '#3e8ef7', logo = 'ancre', name = '', laden = false, sky = true, water = true, attrs = '', fit = false } = opts;
  const r = rand(opts.seed ?? (name || typeId));
  const id = 'sh' + (++uidCounter);
  const wear = wearOf(typeId, condition, age);
  const dmg = (100 - condition) / 100; // dégâts : bosses, tôle nue, trous, vitres cassées
  const C = A.livery;
  const W = 400, H = 110, KB = 100; // KB : ligne de quille commune à tous les navires
  // fit : le navire remplit le cadre (maquettes), sinon échelle commune.
  // En maquette, on réduit l'échelle si les mâts ou les grues dépasseraient du cadre.
  const tallest = Math.max(A.house ? A.house.decks * 2.7 + 7 : 6, A.funnelTower ? A.funnelTower.h + 5 : 0,
    A.containers ? A.containers.tiers * 2.6 + 2 : 0, A.spheres ? A.spheres.r * 1.6 : 0,
    ...(A.gear || []).map((g) => (g.kind === 'heavy' ? g.h * 0.98 : g.h)));
  const span = fit ? Math.min(372, (A.L * 88) / ((A.D - A.Tb + tallest) * 1.75)) : 372 * Math.pow(A.L / 400, 0.7);
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
  // Second liseré : la marque des navires de prestige.
  if (C.trim2) out.push(`<rect x="0" y="${f(Y(fb) + 2.4 + Math.max(1.4, 0.45 * v))}" width="${W}" height="${f(Math.max(1.2, 0.32 * v))}" fill="${C.trim2}"/>`);
  if (A.box) out.push(boxDetails());
  if (wear < 0.12) out.push(`<rect x="0" y="${Y(bowTop)}" width="${W}" height="${f(fb * v * 0.55)}" fill="url(#${id}shine)"/>`);
  // Liston du pont.
  out.push(`<path d="${deckLine()}" stroke="#ece8de" stroke-opacity=".75" stroke-width="${f(Math.max(0.9, 0.3 * v))}" fill="none"/>`);
  // Hublots sur les navires anciens.
  if (A.era === 'classic') for (let xm = L * 0.06; xm < L * 0.22; xm += 2.6) out.push(`<circle cx="${X(xm)}" cy="${Y(deckAt(xm / L) - 1)}" r="${f(Math.max(0.6, 0.32 * s))}" fill="#11161a" opacity=".8"/>`);
  out.push(hullWear());
  out.push('</g>');
  out.push(`<path d="${hp}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
  // Écubier et ancre.
  const hx = L * (A.bow === 'straight' ? 0.94 : 0.955), hh = A.box ? fb * 0.22 : bowTop - fc * 0.55;
  out.push(`<circle cx="${X(hx)}" cy="${Y(hh)}" r="${f(Math.max(1.2, 0.7 * s))}" fill="#151515" opacity=".8"/>`);
  if (wear > 0.2) out.push(`<path d="M${f(X(hx) - 1.5)} ${Y(hh)} l3 0 l${f(-1 + r())} ${f((hh + 0.3) * v * (0.4 + wear * 0.6))} l-1 0 z" fill="url(#${id}rust)"/>`);
  if (A.box) {
    out.push(sternRamp());
    const bx1 = L * A.box.bridge, bx2 = L * 0.93;
    out.push(`<rect x="${X(bx1)}" y="${Y(fb + 2.2)}" width="${f((bx2 - bx1) * s)}" height="${f(2.2 * v)}" fill="${C.house}" stroke="${INK}" stroke-width=".9"/>`);
    out.push(`<rect x="${X(bx1 + 1)}" y="${Y(fb + 1.7)}" width="${f((bx2 - bx1 - 2) * s)}" height="${f(0.9 * v)}" fill="#1f2b33"/>`);
    out.push(`<rect x="${X(bx1 - 2)}" y="${Y(fb + 2.4)}" width="${f((bx2 - bx1 + 3) * s)}" height="${f(0.5 * v)}" fill="${C.house}" stroke="${INK}" stroke-width=".7"/>`);
  }
  if (name) {
    const fsz = Math.max(5, Math.min(10, (fb + fc) * v * 0.32));
    const light = parseInt(C.hull.slice(1, 3), 16) + parseInt(C.hull.slice(3, 5), 16) + parseInt(C.hull.slice(5, 7), 16) > 500;
    out.push(`<text x="${X(L * 0.925)}" y="${f(Y(A.box ? fb * 0.14 + 1 : fb * 0.55) + fsz * 0.35)}" font-size="${f(fsz)}" text-anchor="end" fill="${light ? INK : '#fff'}" fill-opacity=".85" font-family="system-ui, sans-serif" font-weight="700" letter-spacing=".4">${escapeXml(name.toUpperCase())}</text>`);
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
    const segs = c.segments || [[c.from, c.to], ...(c.aft ? [c.aft] : [])];
    for (const [a, b] of segs) stack(a, b);
    // Ponts de saisissage à l'avant des piles.
    for (const [a] of c.segments ? segs : segs.slice(0, 1)) {
      out.push(`<rect x="${X(L * a - 1)}" y="${Y(deckAt(a) + 1.2 + c.tiers * 2.6)}" width="${f(1 * s)}" height="${f(c.tiers * 2.6 * v)}" fill="${C.gear}" opacity=".9"/>`);
    }
  }
  if (A.tanker) {
    // Pétrolier : rangée de dômes de citernes, gros collecteur à vannes rouges, manches jaunes.
    const t = A.tanker, aft = A.aftHouse || A.house, start = L * (aft.x + aft.w) + 3, end = L * 0.93;
    out.push(`<rect x="${X(start - 3)}" y="${f(+Y(fb) - 1.4)}" width="${f((end - start + 5) * s)}" height="1.6" fill="${C.deck}"/>`);
    // Une longue citerne arrondie sur tout le pont, comme un camion-citerne : compartiments et trappes.
    // Sur un pétrolier ancien, elle s'interrompt sous la passerelle centrale.
    const th = 3.4, mx0 = L * t.manifold;
    const segs = A.aftHouse ? [[start, L * A.house.x - 1.5], [L * (A.house.x + A.house.w) + 1.5, end]] : [[start, end]];
    for (const [tx1, tx2] of segs) {
      out.push(`<rect x="${X(tx1)}" y="${Y(fb + th)}" width="${f((tx2 - tx1) * s)}" height="${f(th * v)}" rx="${f(Math.min(th * v * 0.5, 9))}" fill="#c3c9cb" stroke="${INK}" stroke-width="1"/>`);
      out.push(`<rect x="${X(tx1 + 1)}" y="${f(+Y(fb + th) + 1.5)}" width="${f((tx2 - tx1 - 2) * s)}" height="${f(th * v * 0.22)}" rx="2" fill="#fff" opacity=".35"/>`);
      const n = Math.max(2, Math.round((tx2 - tx1) / 16));
      for (let k = 1; k < n; k++) {
        const xx = tx1 + ((tx2 - tx1) * k) / n;
        out.push(`<line x1="${X(xx)}" y1="${Y(fb + th)}" x2="${X(xx)}" y2="${Y(fb)}" stroke="${INK}" stroke-width=".7" opacity=".55"/>`);
      }
      for (let k = 0; k < n; k++) {
        const cx = tx1 + ((tx2 - tx1) * (k + 0.5)) / n;
        if (Math.abs(cx - mx0) < 6 || (t.second && Math.abs(cx - L * t.second) < 6)) continue;
        out.push(`<rect x="${X(cx - 1.4)}" y="${Y(fb + th + 0.9)}" width="${f(2.8 * s)}" height="${f(0.9 * v)}" rx="1" fill="#8e979c" stroke="${INK}" stroke-width=".6"/>`);
      }
    }
    out.push(`<line x1="${X(start - 2)}" y1="${Y(fb + t.pipeH)}" x2="${X(end)}" y2="${Y(fb + t.pipeH)}" stroke="${INK}" stroke-width="${f(Math.max(2.4, 0.7 * v) + 1.2)}"/>`);
    out.push(`<line x1="${X(start - 2)}" y1="${Y(fb + t.pipeH)}" x2="${X(end)}" y2="${Y(fb + t.pipeH)}" stroke="#8d969c" stroke-width="${f(Math.max(2.4, 0.7 * v))}"/>`);
    out.push(manifold(mx0, fb + th - 1, 3));
    if (t.second) out.push(manifold(L * t.second, fb + th - 1, 3));
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
  if (A.chem) {
    // Chimiquier : pas de grande citerne, mais un pont encombré de tuyaux de couleur
    // (un circuit par cargaison), de petites citernes de pont et de vannes.
    const start = L * (A.house.x + A.house.w) + 2, end = L * 0.93, mx = L * A.chem.manifold;
    out.push(`<rect x="${X(start - 2)}" y="${f(+Y(fb) - 1.4)}" width="${f((end - start + 4) * s)}" height="1.6" fill="${C.deck}"/>`);
    // Faisceau de tuyaux : jaune, bleu, blanc, rouge.
    const pipes = [['#e3b23c', 0.7], ['#3a78b5', 1.3], ['#e8e6df', 1.9], ['#c4362c', 2.5]];
    for (const [col, hm] of pipes) {
      out.push(`<line x1="${X(start - 1)}" y1="${Y(fb + hm)}" x2="${X(end)}" y2="${Y(fb + hm)}" stroke="${INK}" stroke-width="${f(Math.max(1.3, 0.3 * v) + 1)}"/>`);
      out.push(`<line x1="${X(start - 1)}" y1="${Y(fb + hm)}" x2="${X(end)}" y2="${Y(fb + hm)}" stroke="${col}" stroke-width="${f(Math.max(1.3, 0.3 * v))}"/>`);
    }
    // Petites citernes verticales en inox, devant les tuyaux.
    for (let xm = start + 5; xm < end - 4; xm += 14) {
      if (Math.abs(xm - mx) < 8) continue;
      out.push(`<rect x="${X(xm - 2)}" y="${Y(fb + 4.4)}" width="${f(4 * s)}" height="${f(4.4 * v)}" rx="${f(1.4 * s)}" fill="#d6dadb" stroke="${INK}" stroke-width=".8"/>`);
      out.push(`<rect x="${X(xm - 2)}" y="${f(+Y(fb + 4.4) + 1.2)}" width="${f(4 * s)}" height="${f(0.6 * v)}" fill="#fff" opacity=".55"/>`);
      out.push(`<rect x="${X(xm - 0.6)}" y="${Y(fb + 5.1)}" width="${f(1.2 * s)}" height="${f(0.7 * v)}" fill="#8e979c" stroke="${INK}" stroke-width=".5"/>`);
    }
    // Passerelle de circulation surélevée et quelques vannes.
    out.push(`<line x1="${X(start)}" y1="${Y(fb + 3.2)}" x2="${X(end)}" y2="${Y(fb + 3.2)}" stroke="${INK}" stroke-width="1"/>`);
    for (let xm = start + 12; xm < end - 3; xm += 14) if (Math.abs(xm - mx) > 6) out.push(valveWheel(xm, fb + 3.6, 0.7));
    out.push(manifold(mx, fb + 2.6, 3));
    for (let k = 0; k < Math.floor(wear * 5); k++) out.push(streak(+X(L * (0.3 + r() * 0.6)), +Y(fb + 1), 4 * v * r(), 1));
  }
  // Colis lourds : chaudière et caisse géante dans la cale ouverte, quand le navire est chargé.
  if (A.project && laden) {
    for (const c of A.project) {
      const x1 = L * c.x, w = L * c.w, base = deckAt(c.x + c.w / 2) + (A.hatchH || 0);
      if (c.kind === 'boiler') {
        out.push(`<rect x="${X(x1 + w * 0.15)}" y="${Y(base + 0.8)}" width="${f(w * 0.12 * s)}" height="${f(0.8 * v)}" fill="#5a4a3a"/><rect x="${X(x1 + w * 0.73)}" y="${Y(base + 0.8)}" width="${f(w * 0.12 * s)}" height="${f(0.8 * v)}" fill="#5a4a3a"/>`);
        out.push(`<rect x="${X(x1)}" y="${Y(base + 0.8 + c.h)}" width="${f(w * s)}" height="${f(c.h * v)}" rx="${f(c.h * v * 0.5)}" fill="#e3b23c" stroke="${INK}" stroke-width="1"/>`);
        for (const k of [0.25, 0.5, 0.75]) out.push(`<line x1="${X(x1 + w * k)}" y1="${Y(base + 0.8 + c.h)}" x2="${X(x1 + w * k)}" y2="${Y(base + 0.8)}" stroke="${INK}" stroke-width=".7" opacity=".5"/>`);
        out.push(`<rect x="${X(x1 + 1)}" y="${f(+Y(base + 0.8 + c.h) + 1.2)}" width="${f((w - 2) * s)}" height="${f(c.h * v * 0.2)}" rx="2" fill="#fff" opacity=".35"/>`);
      } else {
        out.push(`<rect x="${X(x1)}" y="${Y(base + c.h)}" width="${f(w * s)}" height="${f(c.h * v)}" fill="#b4875a" stroke="${INK}" stroke-width="1"/>`);
        out.push(`<path d="M${X(x1)} ${Y(base + c.h)} L${X(x1 + w)} ${Y(base)} M${X(x1)} ${Y(base)} L${X(x1 + w)} ${Y(base + c.h)}" stroke="#7a5534" stroke-width="1"/>`);
        out.push(`<rect x="${X(x1)}" y="${Y(base + c.h)}" width="${f(w * s)}" height="${f(0.5 * v)}" fill="#7a5534"/>`);
      }
    }
  }
  // Pictogramme de la cargaison sur la coque et pavillon B (marchandise dangereuse) quand le navire est chargé.
  if (A.emblem) out.push(emblem(A.emblem, L * 0.62, A.box ? fb * 0.5 : fb * 0.5));
  if (laden && (A.tanker || A.spheres || A.cylinders || A.chem)) out.push(bravoFlag());
  for (const g of A.gear || []) out.push(gear(g));

  // ---------- Château ----------
  if (A.aftHouse) out.push(house(A.aftHouse, false));
  if (A.house) out.push(house(A.house, true));
  if (A.funnelTower) out.push(funnelTower(A.funnelTower));

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
    else if (kind === 'flask') icon = `<path d="M${f(cx - rr * 0.16)} ${f(cyy - rr * 0.62)} h${f(rr * 0.32)} v${f(rr * 0.42)} l${f(rr * 0.36)} ${f(rr * 0.66)} q${f(rr * 0.05)} ${f(rr * 0.16)} ${f(-rr * 0.12)} ${f(rr * 0.16)} h${f(-rr * 0.8)} q${f(-rr * 0.17)} 0 ${f(-rr * 0.12)} ${f(-rr * 0.16)} l${f(rr * 0.36)} ${f(-rr * 0.66)} z" fill="#1c2a33"/><path d="M${f(cx - rr * 0.33)} ${f(cyy + rr * 0.2)} h${f(rr * 0.66)} l${f(rr * 0.17)} ${f(rr * 0.3)} h${f(-rr * 1)} z" fill="#2f9c95"/>`;
    else if (kind === 'fruit') icon = `<circle cx="${f(cx)}" cy="${f(cyy + rr * 0.1)}" r="${f(rr * 0.5)}" fill="#e2702a"/><path d="M${f(cx)} ${f(cyy - rr * 0.38)} q${f(rr * 0.35)} ${f(-rr * 0.3)} ${f(rr * 0.5)} ${f(-rr * 0.1)} q${f(-rr * 0.2)} ${f(rr * 0.25)} ${f(-rr * 0.5)} ${f(rr * 0.1)} z" fill="#3f7d3a"/>`;
    else if (kind === 'car') icon = `<path d="M${f(cx - rr * 0.62)} ${f(cyy + rr * 0.2)} v${f(-rr * 0.22)} l${f(rr * 0.22)} ${f(-rr * 0.1)} l${f(rr * 0.18)} ${f(-rr * 0.24)} h${f(rr * 0.5)} l${f(rr * 0.24)} ${f(rr * 0.24)} l${f(rr * 0.3)} ${f(rr * 0.08)} v${f(rr * 0.24)} z" fill="#1c2a33"/><circle cx="${f(cx - rr * 0.3)}" cy="${f(cyy + rr * 0.22)}" r="${f(rr * 0.15)}" fill="#1c2a33" stroke="#f7f5ef" stroke-width=".6"/><circle cx="${f(cx + rr * 0.32)}" cy="${f(cyy + rr * 0.22)}" r="${f(rr * 0.15)}" fill="#1c2a33" stroke="#f7f5ef" stroke-width=".6"/>`;
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
    if (g.kind === 'heavy') {
      // Grue de levage lourd : gros fût, flèche en treillis très relevée, moufle et câbles.
      const ped = base + g.h * 0.26, pw = Math.max(3, 4.2 * s), dir = g.dir ?? 1;
      const tipX = px + dir * g.h * 0.42, tipH = ped + g.h * 0.72;
      const ang = Math.atan2((tipH - ped) * v, (tipX - px) * s), nx = -Math.sin(ang), ny = -Math.cos(ang);
      const bx = +X(px), by = +Y(ped + 1), tx = +X(tipX), ty = +Y(tipH), w0 = Math.max(2.4, 1.8 * s), w1 = Math.max(1, 0.6 * s);
      const P = (x, y, w, sgn) => `${f(x + nx * w * sgn)} ${f(y - ny * w * sgn)}`;
      let o = `<path d="M${P(bx, by, w0, 1)} L${P(tx, ty, w1, 1)} L${P(tx, ty, w1, -1)} L${P(bx, by, w0, -1)} Z" fill="${C.gear}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>`;
      // Treillis.
      const nT = 7;
      for (let k = 0; k < nT; k++) {
        const a = k / nT, b = (k + 1) / nT, wa = w0 + (w1 - w0) * a, wb = w0 + (w1 - w0) * b;
        const xa = bx + (tx - bx) * a, ya = by + (ty - by) * a, xb = bx + (tx - bx) * b, yb = by + (ty - by) * b;
        o += `<path d="M${P(xa, ya, wa * 0.7, k % 2 ? 1 : -1)} L${P(xb, yb, wb * 0.7, k % 2 ? -1 : 1)}" stroke="#8d969c" stroke-width=".7"/>`;
      }
      // Fût et cabine.
      o += `<rect x="${f(bx - pw / 2)}" y="${Y(ped)}" width="${f(pw)}" height="${f((ped - base) * v)}" fill="${C.gear}" stroke="${INK}" stroke-width=".9"/>`;
      o += `<rect x="${f(bx - pw * 0.7)}" y="${Y(ped + 3)}" width="${f(pw * 1.4)}" height="${f(3 * v)}" rx="1" fill="${C.gear}" stroke="${INK}" stroke-width=".9"/><rect x="${f(bx + dir * pw * 0.15 - pw * 0.2)}" y="${Y(ped + 2.4)}" width="${f(pw * 0.4)}" height="${f(1 * v)}" fill="#e3b23c"/>`;
      // Câbles et moufle.
      const hookTo = laden && A.project ? Math.max(...A.project.map((c) => deckAt(c.x) + (A.hatchH || 0) + c.h + 0.8)) + 1.5 : base + 7;
      o += `<line x1="${X(px)}" y1="${Y(ped + 3)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#333" stroke-width=".6"/>`;
      o += `<line x1="${f(tx)}" y1="${f(ty)}" x2="${f(tx)}" y2="${Y(hookTo)}" stroke="#222" stroke-width=".8"/>`;
      o += `<rect x="${f(tx - 1.8)}" y="${Y(hookTo + 1)}" width="3.6" height="${f(1.6 * v)}" fill="#e3b23c" stroke="${INK}" stroke-width=".6"/>`;
      if (wear > 0.4) o += streak(bx - pw / 3, +Y(ped), (ped - base) * v * 0.4 * wear, pw * 0.3);
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

  // Tour de cheminée isolée (porte-conteneurs géant, transporteur de voitures).
  function funnelTower(t) {
    const x1 = L * t.x, x2 = L * (t.x + t.w), base = deckAt(t.x), top = base + (t.h > 5 ? t.h : 0);
    const o = [];
    if (t.h > 5) {
      o.push(`<rect x="${X(x1)}" y="${Y(top)}" width="${f((x2 - x1) * s)}" height="${f(t.h * v)}" fill="${C.house}" stroke="${INK}" stroke-width=".9"/>`);
      for (let hm = base + 2.4; hm < top - 1; hm += 2.7) o.push(`<rect x="${X(x1 + (x2 - x1) * 0.3)}" y="${Y(hm + 0.8)}" width="${f((x2 - x1) * 0.4 * s)}" height="${f(0.6 * v)}" fill="#3a4a54"/>`);
      if (wear > 0.3) for (let k = 0; k < Math.round(wear * 4); k++) o.push(streak(+X(x1 + r() * (x2 - x1)), +Y(base + r() * t.h), 3 * v * r(), 1));
    }
    const fw = (x2 - x1) * 0.9;
    o.push(funnel(x1 + (x2 - x1) * 0.05, top, fw, 4.2, fw * 0.22));
    return o.join('');
  }

  // Transporteur de voitures : bande bleue, rangées d'aérations, passerelle intégrée à l'avant.
  function boxDetails() {
    const o = [], B = A.box;
    o.push(`<rect x="0" y="${Y(fb * 0.34)}" width="${W}" height="${f(Math.max(2, 0.9 * v))}" fill="${B.band}"/>`);
    o.push(`<rect x="0" y="${f(+Y(fb * 0.34) + Math.max(2, 0.9 * v) + 1.2)}" width="${W}" height="${f(Math.max(0.8, 0.25 * v))}" fill="${B.band}"/>`);
    for (const hm of [fb * 0.62, fb * 0.8]) {
      for (let xm = L * 0.08; xm < L * 0.84; xm += 5.5) o.push(`<rect x="${X(xm)}" y="${Y(hm)}" width="${f(2.2 * s)}" height="${f(0.7 * v)}" rx=".4" fill="#9aa3a8"/>`);
    }
    // Passerelle : bandeau de vitres en haut, à l'avant.
    const bx1 = L * B.bridge, bx2 = L * 0.95, bh = fb - 1.2;
    o.push(`<rect x="${X(bx1)}" y="${Y(bh)}" width="${f((bx2 - bx1) * s)}" height="${f(1.3 * v)}" fill="#1f2b33"/>`);
    for (let xm = bx1 + 2; xm < bx2; xm += 2.5) o.push(`<line x1="${X(xm)}" y1="${Y(bh)}" x2="${X(xm)}" y2="${Y(bh - 1.3)}" stroke="#56656e" stroke-width=".5"/>`);
    // Porte latérale de la rampe.
    o.push(`<rect x="${X(L * 0.3)}" y="${Y(fb * 0.3)}" width="${f(9 * s)}" height="${f(fb * 0.26 * v)}" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width=".8"/>`);
    return o.join('');
  }
  // Rampe arrière relevée contre le tableau.
  function sternRamp() {
    const x = +X(0), y1 = +Y(fb * 0.82), y2 = +Y(fb * 0.24), w = Math.max(3, 2.2 * s);
    return `<rect x="${f(x - w * 0.6)}" y="${f(y1)}" width="${f(w)}" height="${f(y2 - y1)}" fill="#5f686e" stroke="${INK}" stroke-width=".9"/>
      <line x1="${f(x - w * 0.6)}" y1="${f((y1 + y2) / 2)}" x2="${f(x + w * 0.4)}" y2="${f((y1 + y2) / 2)}" stroke="${INK}" stroke-width=".6" opacity=".6"/>`;
  }

  function house(hsp, bridge = true) {
    const hx1 = L * hsp.x, hx2 = L * (hsp.x + hsp.w);
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
      if (A.lifeboats === 'davit' && !hsp.noBoats) {
        const bw = Math.min(6.5, (hx2 - hx1) * 0.45), bx = hx1 + (hx2 - hx1) * 0.12, by = base + dk * 1.05;
        const bh = Math.max(1.6 / v, 1.5);
        o.push(`<path d="M${X(bx)} ${Y(by + bh)} h${f(bw * s)} q${f(-0.4 * s)} ${f(bh * v)} ${f(-bw * 0.25 * s)} ${f(bh * v)} h${f(-bw * 0.5 * s)} q${f(-bw * 0.2 * s)} 0 ${f(-bw * 0.25 * s)} ${f(-bh * v)} z" fill="#f2f0ea" stroke="#9a9a9a" stroke-width=".4"/>`);
        o.push(`<rect x="${X(bx + bw * 0.12)}" y="${Y(by + bh + 0.7)}" width="${f(bw * 0.76 * s)}" height="${f(0.7 * v)}" rx="${f(0.35 * v)}" fill="#e8742c"/>`);
        o.push(`<path d="M${X(bx + 0.2)} ${Y(by + bh)} v${f(-1.8 * v)} q0 ${f(-0.4 * v)} ${f(0.6 * s)} ${f(-0.4 * v)} M${X(bx + bw - 0.2)} ${Y(by + bh)} v${f(-1.8 * v)} q0 ${f(-0.4 * v)} ${f(-0.6 * s)} ${f(-0.4 * v)}" stroke="#4a4a4a" stroke-width=".7" fill="none"/>`);
      }
      // Cheminée haute et fine.
      if (!hsp.noFunnel) {
        const fw = Math.max(2.6, (hx2 - hx1) * 0.22), fx = hx1 + (hx2 - hx1) * 0.32, fH = dk * 1.7;
        o.push(funnel(fx, topH - dk * 0.2, fw, fH, fw * 0.15));
      }
      if (bridge) o.push(`<line x1="${X(hx1 + (hx2 - hx1) * 0.75)}" y1="${Y(topH)}" x2="${X(hx1 + (hx2 - hx1) * 0.78)}" y2="${Y(topH + 5)}" stroke="${C.house}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/>`);
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
      if (!hsp.noFunnel) {
        const fw = Math.max(3, (hx2 - hx1) * 0.34), fx = hx1 + (hx2 - hx1) * 0.08, fH = A.era === 'modern' ? dk * 1.4 : dk * 1.6;
        o.push(funnel(fx, topH + 0.5, fw, fH, fw * 0.28));
      }
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
    o.push(`<g transform="translate(${f(lcx - lr * 0.78)} ${f(lcy - lr * 0.78)}) scale(${f((lr * 1.56) / 64)})" color="${emblemOnWhite(color)}">${logoMarkup(logo)}</g>`);
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

export function artForShip(state, ship, extra = {}) {
  const c = state.companies[ship.owner];
  const age = (state.t - ship.builtT) / (24 * 365);
  return shipMarkup(ship.type, { condition: ship.condition, age, color: c.color, logo: c.logo, name: ship.name, laden: !!ship.cargo, seed: ship.id + ship.name, ...extra });
}
