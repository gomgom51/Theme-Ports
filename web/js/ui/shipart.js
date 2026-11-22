// Illustrations des navires (profil, en SVG), générées à partir du type :
// silhouette propre à chaque modèle, couleurs et emblème de la compagnie,
// rouille et peinture fanée selon l'état et l'âge, enfoncement selon la charge.
import { SHIP_TYPES } from '../data/ships.js';
import { logoMarkup } from './logos.js';

// Dimensions en mètres. L longueur, D creux (quille → pont), T tirant d'eau en charge,
// Tb tirant d'eau à vide. house : château (position et longueur en fraction de L).
export const SHIP_ART = {
  caboteur: {
    L: 90, D: 7.6, T: 6.5, Tb: 3.6, fc: 1.6, poop: 0.9,
    house: { x: 0.035, w: 0.16, decks: 3 }, funnelH: 3.2,
    hatches: [[0.24, 0.5], [0.55, 0.85]], hatchH: 1.5, cranes: [{ x: 0.525, h: 13 }], foremast: 0.93,
  },
  polyvalent: {
    L: 135, D: 11, T: 8.6, Tb: 5, fc: 2.2, poop: 1.2,
    house: { x: 0.03, w: 0.14, decks: 4 }, funnelH: 4,
    hatches: [[0.2, 0.41], [0.45, 0.66], [0.7, 0.88]], hatchH: 1.9,
    cranes: [{ x: 0.43, h: 20 }, { x: 0.68, h: 20 }], foremast: 0.95,
  },
  vraquier_handy: {
    L: 180, D: 15, T: 10.2, Tb: 6, fc: 2.6, poop: 1.4,
    house: { x: 0.03, w: 0.12, decks: 5 }, funnelH: 5,
    hatches: [[0.19, 0.3], [0.335, 0.445], [0.48, 0.59], [0.625, 0.735], [0.77, 0.88]], hatchH: 2.1,
    cranes: [{ x: 0.317, h: 18 }, { x: 0.462, h: 18 }, { x: 0.607, h: 18 }, { x: 0.752, h: 18 }], foremast: 0.95,
  },
  petrolier_mr: {
    L: 183, D: 18, T: 12.2, Tb: 7, fc: 2.4, poop: 1.2,
    house: { x: 0.03, w: 0.12, decks: 5 }, funnelH: 5,
    tanker: { manifold: 0.5, pipeH: 1.1, walkH: 2.4 }, foremast: 0.95,
  },
  feeder: {
    L: 170, D: 14, T: 10, Tb: 6.5, fc: 3, poop: 1.2,
    house: { x: 0.08, w: 0.1, decks: 6 }, funnelH: 4.2,
    containers: { from: 0.19, to: 0.95, tiers: 4, aft: [0.02, 0.075] }, foremast: 0.965,
  },
};

const CONTAINER_COLORS = ['#b23a3a', '#2f5d8a', '#3f7d5a', '#c97b2a', '#7d8a93', '#8a3f6e', '#d0a43a', '#4b6f7d', '#9a4f2c', '#e4e1d6'];

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
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const f = (n) => Math.round(n * 10) / 10;
let uidCounter = 0;

// Usure visuelle de 0 (neuf) à 1 (épave).
export function wearOf(typeId, condition = 100, age = 0) {
  const life = SHIP_TYPES[typeId]?.life || 25;
  return Math.max(0, Math.min(1, ((100 - condition) / 100) * 0.8 + (age / life) * 0.45));
}

/**
 * opts : condition, age (années), color (compagnie), logo (id), name, laden, seed,
 *        sky (fond de ciel), title (texte d'accessibilité).
 */
export function shipSVG(typeId, opts = {}) {
  const A = SHIP_ART[typeId] || SHIP_ART.caboteur;
  const { condition = 100, age = 0, color = '#3e8ef7', logo = 'ancre', name = '', laden = false, sky = true, water = true, attrs = '' } = opts;
  const r = rand(opts.seed ?? name ?? typeId);
  const id = 'sh' + (++uidCounter);
  const wear = wearOf(typeId, condition, age);
  const W = 400, H = 150, WL = 112;
  const span = Math.min(372, (372 * A.L) / (55 + A.L * 0.75)); // un petit navire paraît plus petit
  const s = span / A.L, v = s * 1.18;
  const x0 = (W - span) / 2 - 4;
  const X = (m) => f(x0 + m * s);           // m : mètres depuis la poupe
  const Y = (h) => f(WL - h * v);           // h : mètres au-dessus de la flottaison
  const draft = laden ? A.T : A.Tb;
  const fb = A.D - draft;                   // franc-bord
  const L = A.L;
  const out = [];

  // Couleurs : coque teintée par la compagnie, fanée par l'âge.
  const hullBase = opts.hull || mix(color, '#141c24', 0.55);
  const hull = mix(hullBase, '#7a7366', wear * 0.5);
  const white = mix('#f5f3ee', '#b9b09c', wear * 0.65);
  const deckGear = mix('#d9a521', '#8f7a52', wear * 0.5);
  const hatchCol = mix('#506457', '#6b6a5c', wear * 0.6);
  const rust = '#7d3a16';

  out.push(`<svg viewBox="0 0 ${W} ${H}" class="ship-art" role="img" aria-label="${opts.title || ''}" preserveAspectRatio="xMidYMid meet" ${attrs}><defs>
    <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9dfe9"/><stop offset="1" stop-color="#eef1e8"/></linearGradient>
    <linearGradient id="${id}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f9fb6" stop-opacity=".92"/><stop offset="1" stop-color="#2e5f78" stop-opacity=".97"/></linearGradient>
    <linearGradient id="${id}shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}rust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${rust}" stop-opacity="${f(Math.min(0.95, 0.5 + wear * 0.5))}"/><stop offset="1" stop-color="${rust}" stop-opacity="0"/></linearGradient>
  </defs>`);
  if (sky) {
    out.push(`<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>`);
    // Côte lointaine et quelques nuages.
    out.push(`<path d="M0 ${WL - 6} q40 -9 80 -5 t90 -3 t70 2 t90 -4 t70 4 V${WL} H0z" fill="#9fb3b0" opacity=".45"/>`);
    for (let k = 0; k < 3; k++) {
      const cx = f(30 + r() * 340), cy = f(14 + r() * 26), w = f(30 + r() * 40);
      out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${f(w * 0.18)}" fill="#fff" opacity=".7"/>`);
    }
  }

  // ---------- Coque ----------
  const fc = A.fc, poop = A.poop;
  const hullPath = `M${X(0)} ${Y(fb + poop)} L${X(L * 0.14)} ${Y(fb + poop)} L${X(L * 0.15)} ${Y(fb)} L${X(L * 0.84)} ${Y(fb)}
    Q${X(L * 0.93)} ${Y(fb)} ${X(L * 0.965)} ${Y(fb + fc)} L${X(L)} ${Y(fb + fc)}
    Q${X(L * 0.985)} ${Y(fb * 0.3)} ${X(L * 0.975)} ${Y(-draft * 0.25)}
    Q${X(L * 1.008)} ${Y(-draft * 0.5)} ${X(L * 0.985)} ${Y(-draft * 0.85)}
    Q${X(L * 0.965)} ${Y(-draft)} ${X(L * 0.93)} ${Y(-draft)}
    L${X(L * 0.07)} ${Y(-draft)} Q${X(L * 0.02)} ${Y(-draft)} ${X(L * 0.018)} ${Y(-draft * 0.45)}
    L${X(0)} ${Y(fb * 0.25)} Z`;
  out.push(`<clipPath id="${id}hull"><path d="${hullPath}"/></clipPath>`);
  out.push(`<path d="${hullPath}" fill="${hull}"/>`);
  // Antifouling sous la ligne de charge (visible au-dessus de l'eau quand le navire est vide).
  const lwl = A.T - draft;
  out.push(`<g clip-path="url(#${id}hull)"><rect x="0" y="${Y(lwl)}" width="${W}" height="${H}" fill="${mix('#6f2219', '#553026', wear * 0.5)}"/>
    <rect x="0" y="${f(Y(lwl) - 1.6)}" width="${W}" height="1.8" fill="${mix('#ece8de', '#9a917e', wear)}"/>`);
  // Tôles remplacées sur les vieilles coques.
  if (wear > 0.55) {
    for (let k = 0; k < Math.floor((wear - 0.5) * 10); k++) {
      const xm = L * (0.12 + r() * 0.75), hm = 0.6 + r() * Math.max(0.5, fb - 2);
      out.push(`<rect x="${X(xm)}" y="${Y(hm)}" width="${f((3 + r() * 6) * s)}" height="${f((1 + r() * 2) * v)}" fill="${mix(hull, r() < 0.5 ? '#000000' : '#ffffff', 0.15)}" opacity=".9"/>`);
    }
  }
  // Salissures à la flottaison.
  if (wear > 0.25) out.push(`<rect x="0" y="${Y(1.1)}" width="${W}" height="${f(1.1 * v)}" fill="${rust}" opacity="${f((wear - 0.25) * 0.7)}"/>`);
  if (wear < 0.15) out.push(`<rect x="0" y="${Y(fb + fc)}" width="${W}" height="${f(fb * v * 0.55)}" fill="url(#${id}shine)"/>`);
  // Liston blanc le long du pont.
  out.push(`<rect x="0" y="${f(Y(fb) - 0.5)}" width="${W}" height="${f(Math.max(1, 0.35 * v))}" fill="${white}" opacity=".7"/>`);
  // Usure : coulures de rouille, plaques, apprêt, bosses.
  const streaks = Math.floor(wear * 14 + wear * wear * 14);
  for (let k = 0; k < streaks; k++) {
    const xm = L * (0.05 + r() * 0.9);
    const top = xm > L * 0.9 ? fb + fc * 0.6 : fb;
    const len = (0.25 + r() * 0.65) * (top + draft * 0.15);
    const w = Math.max(1.4, (0.4 + r() * 0.9) * s);
    out.push(`<rect x="${X(xm)}" y="${Y(top)}" width="${f(w)}" height="${f(len * v)}" fill="url(#${id}rust)"/>`);
  }
  const blotches = Math.floor(Math.pow(wear, 1.4) * 14);
  for (let k = 0; k < blotches; k++) {
    const xm = L * (0.04 + r() * 0.92), hm = r() < 0.6 ? r() * 1.4 : r() * fb;
    out.push(`<ellipse cx="${X(xm)}" cy="${Y(hm)}" rx="${f((0.8 + r() * 2.2) * s)}" ry="${f((0.4 + r() * 0.9) * v)}" fill="${rust}" opacity="${f(0.3 + wear * 0.4)}"/>`);
  }
  if (wear > 0.5) {
    for (let k = 0; k < Math.floor((wear - 0.5) * 12); k++) {
      const xm = L * (0.1 + r() * 0.8), hm = 0.5 + r() * (fb - 1);
      out.push(`<rect x="${X(xm)}" y="${Y(hm)}" width="${f((1.5 + r() * 4) * s)}" height="${f((0.6 + r() * 1.2) * v)}" fill="#b5562e" opacity=".55" transform="rotate(${f(r() * 6 - 3)} ${X(xm)} ${Y(hm)})"/>`);
    }
    for (let k = 0; k < 3; k++) {
      const xm = L * (0.2 + r() * 0.6);
      out.push(`<path d="M${X(xm)} ${Y(fb * 0.7)} q${f(4 * s)} ${f(1.2 * v)} ${f(8 * s)} 0" stroke="#000" stroke-opacity=".25" fill="none"/>`);
    }
  }
  out.push('</g>');
  // Écubier et ancre.
  out.push(`<circle cx="${X(L * 0.955)}" cy="${Y(fb + fc * 0.45)}" r="${f(Math.max(1.2, 0.7 * s))}" fill="#1c1c1c" opacity=".7"/>`);

  // Nom à la proue.
  if (name) {
    const fs = Math.max(5, Math.min(10, (fb + fc) * v * 0.32));
    out.push(`<text x="${X(L * 0.935)}" y="${f(Y(fb * 0.55) + fs * 0.35)}" font-size="${f(fs)}" text-anchor="end" fill="#fff" fill-opacity=".85" font-family="system-ui, sans-serif" font-weight="700" letter-spacing=".4">${escapeXml(name.toUpperCase())}</text>`);
  }

  // ---------- Pont ----------
  if (A.hatches) {
    for (const [a, b] of A.hatches) {
      const x1 = X(L * a), x2 = X(L * b), y1 = Y(fb + A.hatchH), y2 = Y(fb);
      out.push(`<rect x="${x1}" y="${y1}" width="${f(x2 - x1)}" height="${f(y2 - y1)}" fill="${hatchCol}" rx="0.6"/>`);
      const ribs = Math.max(2, Math.round((L * (b - a)) / 3.2));
      for (let k = 1; k < ribs; k++) {
        const xx = f(x1 + ((x2 - x1) * k) / ribs);
        out.push(`<line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" stroke="#000" stroke-opacity=".18" stroke-width=".6"/>`);
      }
    }
  }
  if (A.containers) {
    const c = A.containers, bay = 12.6;
    const drawStack = (from, to) => {
      let xm = L * from;
      while (xm + bay <= L * to + 0.1) {
        const tiers = laden ? c.tiers - (r() < 0.3 ? 1 : 0) : (r() < 0.25 ? 1 : 0);
        for (let tz = 0; tz < tiers; tz++) {
          const col = mix(CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)], '#8b8478', wear * 0.35);
          const x = X(xm + 0.2), y = Y(fb + 1.2 + (tz + 1) * 2.6), w = f(12.2 * s), hh = f(2.5 * v);
          out.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${col}"/><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".5"/>`);
          for (let k = 1; k < 4; k++) out.push(`<line x1="${f(x + (w * k) / 4)}" y1="${y}" x2="${f(x + (w * k) / 4)}" y2="${f(y + hh)}" stroke="#000" stroke-opacity=".12" stroke-width=".4"/>`);
        }
        // Panneau de cale sous la pile.
        out.push(`<rect x="${X(xm + 0.2)}" y="${Y(fb + 1.2)}" width="${f(12.2 * s)}" height="${f(1.2 * v)}" fill="${hatchCol}"/>`);
        xm += bay;
      }
    };
    drawStack(c.from, c.to);
    if (c.aft) drawStack(c.aft[0], c.aft[1]);
  }
  if (A.tanker) {
    const t = A.tanker, x1 = X(L * (A.house.x + A.house.w)), x2 = X(L * 0.95);
    out.push(`<line x1="${x1}" y1="${Y(fb + t.pipeH)}" x2="${x2}" y2="${Y(fb + t.pipeH)}" stroke="#8d969c" stroke-width="${f(Math.max(1, 0.6 * v))}"/>`);
    out.push(`<line x1="${x1}" y1="${Y(fb + t.walkH)}" x2="${x2}" y2="${Y(fb + t.walkH)}" stroke="${white}" stroke-width="${f(Math.max(0.8, 0.35 * v))}"/>`);
    for (let xm = L * (A.house.x + A.house.w) + 6; xm < L * 0.94; xm += 7) {
      out.push(`<line x1="${X(xm)}" y1="${Y(fb)}" x2="${X(xm)}" y2="${Y(fb + t.walkH)}" stroke="${white}" stroke-width=".6" opacity=".8"/>`);
    }
    // Collecteur de chargement et sa grue.
    const mx = L * t.manifold;
    out.push(`<rect x="${X(mx - 4)}" y="${Y(fb + 2.6)}" width="${f(8 * s)}" height="${f(2.6 * v)}" fill="#7f8b90"/>`);
    out.push(`<line x1="${X(mx)}" y1="${Y(fb + 2.6)}" x2="${X(mx)}" y2="${Y(fb + 9)}" stroke="${white}" stroke-width="${f(Math.max(1, 0.8 * s))}"/><line x1="${X(mx)}" y1="${Y(fb + 8.5)}" x2="${X(mx + 9)}" y2="${Y(fb + 5)}" stroke="${white}" stroke-width="${f(Math.max(0.8, 0.5 * s))}"/>`);
    // Pont rouge des pétroliers, vu de biais.
    out.push(`<rect x="${x1}" y="${f(Y(fb) - 0.8)}" width="${f(x2 - x1)}" height="1" fill="#7c3a2c" opacity=".8"/>`);
  }
  if (A.cranes) {
    for (const c of A.cranes) {
      const px = L * c.x, base = fb, top = fb + c.h * 0.42;
      const pw = Math.max(1.2, 1.6 * s);
      out.push(`<rect x="${f(X(px) - pw / 2)}" y="${Y(top)}" width="${f(pw)}" height="${f((top - base) * v)}" fill="${deckGear}"/>`);
      out.push(`<rect x="${f(X(px) - 2.2 * s)}" y="${Y(top + 2.2)}" width="${f(4 * s)}" height="${f(2.2 * v)}" fill="${deckGear}"/>`);
      const tipX = px + c.h * 0.7, tipH = top + c.h * 0.55;
      out.push(`<line x1="${X(px)}" y1="${Y(top + 1)}" x2="${X(tipX)}" y2="${Y(tipH)}" stroke="${deckGear}" stroke-width="${f(Math.max(1, 0.9 * s))}" stroke-linecap="round"/>`);
      out.push(`<line x1="${X(tipX)}" y1="${Y(tipH)}" x2="${X(tipX)}" y2="${Y(fb + A.hatchH + 0.6)}" stroke="#333" stroke-width=".5" opacity=".6"/>`);
    }
  }
  if (A.foremast) {
    out.push(`<line x1="${X(L * A.foremast)}" y1="${Y(fb + fc)}" x2="${X(L * A.foremast)}" y2="${Y(fb + fc + 7)}" stroke="${white}" stroke-width="${f(Math.max(0.8, 0.45 * s))}"/>`);
  }

  // ---------- Château ----------
  const h = A.house, hx1 = L * h.x, hx2 = L * (h.x + h.w), base = fb + poop, dk = 2.7;
  const topH = base + h.decks * dk;
  out.push(`<rect x="${X(hx1)}" y="${Y(topH)}" width="${f((hx2 - hx1) * s)}" height="${f((topH - base) * v)}" fill="${white}"/>`);
  // Passerelle un peu plus large (ailerons).
  out.push(`<rect x="${X(hx1 - 1.2)}" y="${Y(topH + 0.4)}" width="${f((hx2 - hx1 + 2.4) * s)}" height="${f(1.1 * v)}" fill="${white}"/>`);
  // Fenêtres : hublots des ponts, vitres de la passerelle.
  for (let d = 0; d < h.decks; d++) {
    const yy = Y(base + d * dk + dk * 0.62), last = d === h.decks - 1;
    if (last) {
      out.push(`<rect x="${X(hx1 + 0.8)}" y="${yy}" width="${f((hx2 - hx1 - 1.6) * s)}" height="${f(0.9 * v)}" fill="#24323b" opacity="${f(0.9 - wear * 0.3)}"/>`);
    } else {
      for (let xm = hx1 + 1.2; xm < hx2 - 1; xm += 2.2) {
        out.push(`<rect x="${X(xm)}" y="${yy}" width="${f(Math.max(0.8, 0.9 * s))}" height="${f(Math.max(0.8, 0.7 * v))}" fill="#3a4a54" opacity=".75"/>`);
      }
    }
  }
  if (wear > 0.35) {
    for (let k = 0; k < Math.floor(wear * 8); k++) {
      const xm = hx1 + r() * (hx2 - hx1);
      out.push(`<rect x="${X(xm)}" y="${Y(base + r() * (topH - base))}" width="${f(Math.max(0.8, 0.4 * s))}" height="${f((1 + r() * 3) * v)}" fill="${rust}" opacity="${f(wear * 0.5)}"/>`);
    }
  }
  // Mât radar sur la passerelle.
  const mastX = hx1 + (hx2 - hx1) * 0.65;
  out.push(`<line x1="${X(mastX)}" y1="${Y(topH + 1.5)}" x2="${X(mastX)}" y2="${Y(topH + 5.5)}" stroke="${white}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/><line x1="${X(mastX - 1.8)}" y1="${Y(topH + 4.2)}" x2="${X(mastX + 1.8)}" y2="${Y(topH + 4.2)}" stroke="${white}" stroke-width="${f(Math.max(0.7, 0.4 * s))}"/>`);

  // Cheminée aux couleurs de la compagnie.
  const fw = Math.max(3, (hx2 - hx1) * 0.32), fx1 = hx1 + (hx2 - hx1) * 0.12, fH = A.funnelH;
  const rake = fw * 0.25;
  const fy0 = topH + 0.4, fy1 = topH + 0.4 + fH;
  const funnel = `M${X(fx1)} ${Y(fy0)} L${X(fx1 + fw)} ${Y(fy0)} L${X(fx1 + fw - rake)} ${Y(fy1)} L${X(fx1 - rake)} ${Y(fy1)} Z`;
  out.push(`<path d="${funnel}" fill="${mix(color, '#6b6458', wear * 0.35)}"/>`);
  out.push(`<path d="M${X(fx1 - rake * 0.82)} ${Y(fy1 - fH * 0.18)} L${X(fx1 + fw - rake * 0.82)} ${Y(fy1 - fH * 0.18)} L${X(fx1 + fw - rake)} ${Y(fy1)} L${X(fx1 - rake)} ${Y(fy1)} Z" fill="#1d1d1d"/>`);
  const lr = Math.min(fw * s, fH * v * 0.62) * 0.42;
  const lcx = X(fx1 + fw / 2 - rake * 0.45), lcy = Y(fy0 + fH * 0.42);
  out.push(`<circle cx="${lcx}" cy="${lcy}" r="${f(lr)}" fill="#fff" opacity="${f(0.95 - wear * 0.3)}"/>`);
  out.push(`<g transform="translate(${f(lcx - lr * 0.78)} ${f(lcy - lr * 0.78)}) scale(${f((lr * 1.56) / 64)})" color="${color}">${logoMarkup(logo)}</g>`);
  // Fumée : légère pour un navire en bon état, noire pour un vieux moteur.
  const smoke = wear > 0.5 ? '#3b3b3b' : '#d8dde0';
  for (let k = 0; k < 3; k++) {
    out.push(`<ellipse cx="${f(X(fx1 + fw / 2 - rake) - k * 7 - 3)}" cy="${f(Y(fy1) - 3 - k * 4)}" rx="${f(3 + k * 2.5)}" ry="${f(2 + k * 1.2)}" fill="${smoke}" opacity="${f((wear > 0.5 ? 0.55 : 0.4) - k * 0.12)}"/>`);
  }

  // ---------- Mer (ou socle de maquette) ----------
  if (!water) {
    const ky = Y(-draft);
    out.push(`<rect x="${X(L * 0.25)}" y="${ky}" width="${f(L * 0.08 * s)}" height="${f(H - ky - 14)}" fill="#6b4a2e"/><rect x="${X(L * 0.67)}" y="${ky}" width="${f(L * 0.08 * s)}" height="${f(H - ky - 14)}" fill="#6b4a2e"/>`);
    out.push(`<rect x="${X(L * 0.1)}" y="${H - 16}" width="${f(L * 0.8 * s)}" height="8" rx="2" fill="#7a5434"/>`);
    out.push('</svg>');
    return out.join('');
  }
  let wave = `M0 ${WL}`;
  for (let x = 0; x <= W; x += 10) wave += ` Q${x + 5} ${WL - 1.6} ${x + 10} ${WL}`;
  out.push(`<path d="${wave} V${H} H0 Z" fill="url(#${id}sea)"/>`);
  out.push(`<path d="${wave}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>`);
  // Moustache d'étrave et sillage.
  out.push(`<path d="M${X(L * 0.97)} ${WL + 1} q${f(6 * s)} -2 ${f(14 * s)} 1" stroke="#fff" stroke-width="1.4" fill="none" opacity=".8"/>`);
  out.push(`<path d="M${X(0)} ${WL + 1} q${f(-8 * s)} 2 ${f(-20 * s)} 1" stroke="#fff" stroke-width="1.2" fill="none" opacity=".6"/>`);
  out.push('</svg>');
  return out.join('');
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Élément DOM prêt à insérer.
export function shipArtEl(typeId, opts = {}, cls = '') {
  const div = document.createElement('div');
  div.className = 'ship-art-wrap ' + cls;
  div.innerHTML = shipSVG(typeId, opts);
  return div;
}

// Raccourci pour un navire de la partie.
export function artForShip(state, ship, extra = {}) {
  const c = state.companies[ship.owner];
  const age = (state.t - ship.builtT) / (24 * 365);
  return shipSVG(ship.type, { condition: ship.condition, age, color: c.color, logo: c.logo, name: ship.name, laden: !!ship.cargo, seed: ship.id + ship.name, ...extra });
}
