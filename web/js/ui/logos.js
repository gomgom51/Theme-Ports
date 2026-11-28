// Emblèmes des compagnies, façon pavillon d'armateur (choix de Clement, novembre 2026) : le disque
// aux couleurs de la compagnie est partagé en deux tons comme une marque de cheminée (bande, pal,
// diagonale, quartiers, chevron, sautoir…), et l'emblème, crème cerné d'encre, se pose dessus.
// Chaque emblème a son partage ; l'initiale prend le sien d'après la lettre.
//
// Dessins originaux sur un carré 64 × 64, faits de trois sortes de pièces :
//   S(d)     forme pleine ; ses trous (fill-rule evenodd) deviennent des filets d'encre dans le médaillon ;
//   T(d, w)  trait d'épaisseur w ;
//   K(d, w)  détail à l'encre, posé sur le crème (médaillon seulement).
// Deux sorties : logoMarkup (silhouette d'une couleur, currentColor : cheminées, bureau, navires en pixels)
// et logoBadge (le médaillon complet).
const n1 = (x) => +x.toFixed(2);
const rad = (a) => (a * Math.PI) / 180;
const pt = (cx, cy, r, a) => `${n1(cx + r * Math.cos(rad(a)))} ${n1(cy + r * Math.sin(rad(a)))}`;

const S = (d, round = 0) => ({ d, round });
const T = (d, w) => ({ d, w });
const K = (d, w) => ({ d, w, ink: true });

function star(cx, cy, r1, r2, n = 5, rot = -90) {
  return 'M' + Array.from({ length: n * 2 }, (_, i) => pt(cx, cy, i % 2 ? r2 : r1, rot + (i * 180) / n)).join('L') + 'Z';
}
// Cercle sous forme de sous-chemin (pour un trait ou pour percer un trou).
const ring = (cx, cy, r) => `M${n1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n1(2 * r)} 0a${r} ${r} 0 1 0 ${n1(-2 * r)} 0Z`;
const ellipse = (cx, cy, rx, ry) => `M${n1(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${n1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${n1(-2 * rx)} 0Z`;
// Portion de couronne entre les rayons r0 et r1, des angles a0 à a1 (degrés).
const arcSeg = (cx, cy, r0, r1, a0, a1) => `M${pt(cx, cy, r1, a0)}A${r1} ${r1} 0 0 1 ${pt(cx, cy, r1, a1)}L${pt(cx, cy, r0, a1)}A${r0} ${r0} 0 0 0 ${pt(cx, cy, r0, a0)}Z`;
const wave = (x, y, w, amp = 6, n = 4) => `M${x} ${y}` + Array.from({ length: n }, (_, i) => `q${n1(w / n / 2)} ${i % 2 ? amp : -amp} ${n1(w / n)} 0`).join('');
// Conteneur et ses nervures (trous).
const box = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z` + [0.27, 0.5, 0.73].map((k) => `M${n1(x + w * k - 0.9)} ${y + 2.7}h1.8v${h - 5.4}h-1.8z`).join('');
const hex = (cx, cy, r) => 'M' + Array.from({ length: 6 }, (_, i) => pt(cx, cy, r, i * 60 - 90)).join('L') + 'Z';
const kite = (a, r1, r2) => `M32 32L${pt(32, 32, r2, a - 45)}L${pt(32, 32, r1, a)}L${pt(32, 32, r2, a + 45)}Z`;
const each = (angles, fn) => angles.map(fn).join('');
const EIGHT = [0, 45, 90, 135, 180, 225, 270, 315];

// ---------- Partages du disque (boîte 80 × 80, débordant du cercle) ----------
const SALTIRE = 'M40 28.69L100 -31.31L111.31 -20L51.31 40L120 108.69L108.69 120L40 51.31L-20 111.31L-31.31 100L28.69 40L-40 -28.69L-28.69 -40Z';
export const FIELDS = {
  fasce: 'M-10 30H90V50H-10z', // bande horizontale
  pal: 'M30 -10H50V90H30z', // bande verticale
  bande: 'M90 -10V90H-10z', // diagonale, moitié basse à droite
  barre: 'M-10 -10L90 90H-10z', // diagonale, moitié basse à gauche
  ecartele: 'M-10 -10H40V40H-10zM40 40H90V90H40z', // quartiers
  chevron: 'M-10 52L40 22L90 52V70L40 40L-10 70z',
  sautoir: SALTIRE, // croix de Saint-André
  croix: 'M33 -10h14v43h43v14H47v43H33V47H-10V33h43z',
  jumelles: 'M-10 23H90V33H-10zM-10 47H90V57H-10z', // deux barres
  coupe: 'M-10 40H90V90H-10z', // moitié basse
};
const FIELD_IDS = Object.keys(FIELDS);

export const LOGOS = {
  ancre: {
    name: 'Ancre', field: 'pal',
    parts: [T(ring(32, 10, 5.2), 4.6), S('M17 19.4h30a2.8 2.8 0 0 1 0 5.6H17a2.8 2.8 0 0 1 0-5.6z'), S('M29 15h6v39.5h-6z'),
      T('M12.5 37.5C14.5 48 22 54.5 32 54.5S49.5 48 51.5 37.5', 6.4), S('M4.5 41.5L12.5 29L20 41.5z'), S('M59.5 41.5L51.5 29L44 41.5z')],
  },
  rose: {
    name: 'Rose des vents', field: 'ecartele',
    parts: [S(each([45, 135, 225, 315], (a) => kite(a, 20, 6))), S(each([-90, 0, 90, 180], (a) => kite(a, 30.5, 7.5))),
      K(each([-90, 0, 90, 180], (a) => `M32 32L${pt(32, 32, 28, a)}`) + each([45, 135, 225, 315], (a) => `M32 32L${pt(32, 32, 18, a)}`), 1.1),
      S(ring(32, 32, 5.6) + ring(32, 32, 2.2))],
  },
  phare: {
    name: 'Phare', field: 'fasce',
    parts: [S('M30.9 3.5h2.2v3h-2.2z'), S('M26.6 12.2C27 8.6 29.2 6.4 32 6.4s5 2.2 5.4 5.8z'), S('M26.8 12.2h10.4v8.6H26.8z M29.4 14.2h5.2v4.6h-5.2z'),
      S('M22.6 20.8h18.8v3.6H22.6z'), S('M25.2 24.4h13.6l3.6 30H21.6z M23.6 33.4h16.8v2.6H23.6z M22.5 43.4h19v2.6h-19z M30 54.4v-4.6a2 2 0 0 1 4 0v4.6z'),
      S('M15 54.4h34v4.8H15z'), S('M25.4 14.4L7 9v12.2z'), S('M38.6 14.4L57 9v12.2z')],
  },
  barre: {
    name: 'Barre', field: 'sautoir',
    parts: [T(each(EIGHT, (a) => `M32 32L${pt(32, 32, 25, a)}`), 4.4), T(ring(32, 32, 15.5), 6),
      S(each(EIGHT, (a) => { const [x, y] = pt(32, 32, 27, a).split(' '); return ring(+x, +y, 4.3); })), S(ring(32, 32, 7.5) + ring(32, 32, 2.6))],
  },
  mouette: {
    name: 'Mouette', field: 'barre',
    parts: [S('M2 25C12 17 23 20 32 33C41 20 52 17 62 25C52 26 42 33 32 49C22 33 12 26 2 25Z'), K('M32 37.5L32 44', 1.1)],
  },
  baleine: {
    name: 'Baleine', field: 'bande',
    parts: [S('M29.6 50.5C30.2 44 30.6 38 30.4 33C24 32 12 24 7 10C13 13 22 13 27 16C29.5 17.5 31 18.5 32 19.5C33 18.5 34.5 17.5 37 16C42 13 51 13 57 10C52 24 40 32 33.6 33C33.4 38 33.8 44 34.4 50.5Z'),
      K('M32 22.5V31', 1.1), T(wave(5, 52.5, 54, 4), 4.6), T(wave(14, 60, 36, 3, 3), 3.6)],
  },
  etoile: {
    name: 'Étoile polaire', field: 'croix',
    parts: [S(star(32, 33.5, 29, 12)),
      K(Array.from({ length: 10 }, (_, i) => `M32 33.5L${pt(32, 33.5, i % 2 ? 12 : 29, -90 + i * 36)}`).join(''), 1.1)],
  },
  vagues: {
    name: 'Vagues', field: 'jumelles',
    parts: [T([16, 31, 46].map((y) => wave(5, y, 54)).join(''), 6.2)],
  },
  voilier: {
    name: 'Voilier', field: 'bande',
    parts: [S('M29 4C22 17 15 31 8 45h21z'), S('M34 11c6 11 12 22 19 34H34z'), S('M5 49h54l-7 9H12z'), K('M29 12V44M24 24h5M19 34h10', 1.1)],
  },
  poisson: {
    name: 'Poisson', field: 'fasce',
    parts: [S('M48 32l12-13v26z'), S(`M4 32C12 20 24 15 36 17.5c7 1.5 12 7 15 14.5-3 7.5-8 13-15 14.5C24 49 12 44 4 32z${ring(16, 29, 3.2)}M25 23.5c3 5 3 12 0 17l-2.6-1c2.4-4.5 2.4-10.5 0-15z`),
      K('M33 25.5c2 2 2 3.5 0 5.5M38 25.5c2 2 2 3.5 0 5.5M33 33c2 2 2 3.5 0 5.5M38 33c2 2 2 3.5 0 5.5', 1.1)],
  },
  couronne: {
    name: 'Couronne', field: 'chevron',
    parts: [S('M8.5 46L5.5 21l14 11L32 13l12.5 19 14-11-3 25z'), S(ring(5.5, 18.5, 4) + ring(32, 10, 4.5) + ring(58.5, 18.5, 4)),
      S(`M8 49h48v8.5H8z${ring(20, 53.2, 2.2)}${ring(32, 53.2, 2.2)}${ring(44, 53.2, 2.2)}`)],
  },
  trident: {
    name: 'Trident', field: 'pal',
    parts: [S('M29 11h6v51h-6z'), T('M15 12v11c0 7 7.5 11 17 11s17-4 17-11V12', 6), S('M32 1.5l-7 11h14zM15 2.5l-6 10.5h12zM49 2.5l-6 10.5h12z')],
  },
  helice: {
    name: 'Hélice', field: 'sautoir',
    parts: [S(each([0, 120, 240], (a) => {
      const blade = [[32, 26], [25.5, 21.5, 22, 11, 27.5, 5.5], [32, 1, 39.5, 3.5, 40.5, 9.5], [41.3, 15.5, 38.5, 21.5, 35, 27]];
      const r = (x, y) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return `${n1(32 + (x - 32) * c - (y - 32) * s)} ${n1(32 + (x - 32) * s + (y - 32) * c)}`; };
      return `M${r(...blade[0])}` + blade.slice(1).map((q) => `C${r(q[0], q[1])} ${r(q[2], q[3])} ${r(q[4], q[5])}`).join('') + 'Z';
    })), S(ring(32, 32, 8.5) + ring(32, 32, 3))],
  },
  bouee: {
    name: 'Bouée', field: 'croix',
    parts: [T(ring(32, 32, 26.5) + ring(32, 32, 13.5), 2.6), S(each([45, 135, 225, 315], (a) => arcSeg(32, 32, 12.5, 27.5, a - 21, a + 21))),
      K(each([45, 135, 225, 315], (a) => `M${pt(32, 32, 15, a - 8)}L${pt(32, 32, 25, a - 8)}M${pt(32, 32, 15, a + 8)}L${pt(32, 32, 25, a + 8)}`), 1)],
  },
  pieuvre: {
    name: 'Pieuvre', field: 'barre',
    parts: [T('M21 32c-9 4-15 12-11 20 2 4 7 3 6-1M27.5 36c-2 8-7 14-3 21M36.5 36c2 8 7 14 3 21M43 32c9 4 15 12 11 20-2 4-7 3-6-1', 6),
      S(`M32 4c12 0 17 10 15 20-1 7-6 13-15 13S18 31 17 24C15 14 20 4 32 4z${ring(25.5, 24, 3.2)}${ring(38.5, 24, 3.2)}`)],
  },
  requin: {
    name: 'Aileron de requin', field: 'coupe',
    parts: [S('M13 46C26 38 34 17 48 5C39 20 39 36 51 46Z'), K('M44 12C40 22 39.5 32 42 41', 1.1), T(wave(4, 50.5, 56, 5), 5.2), T(wave(13, 59, 38, 4), 4.2)],
  },
  grue: {
    name: 'Grue portuaire', field: 'chevron',
    parts: [T('M33 27L51 5.5', 5), K('M36 23.5L39.5 23l.5-4.6 3.5-.4.5-4.6 3.5-.4.5-4.6', 1), T('M51 6V33', 2),
      S('M44 34.5h14v9.5H44z M47.4 36.8h1.6v4.9h-1.6z M50.2 36.8h1.6v4.9h-1.6z M53 36.8h1.6v4.9H53z'),
      S('M8.5 27h6.5v9.5H8.5z'), S('M14 25.5h22v14H14z M17.5 28.5h5v4.4h-5z'),
      S('M10 56.5L16.5 39.5h17L40 56.5h-6.2l-3.6-10H19.8l-3.6 10z'), S('M5 56.5h54v4.5H5z')],
  },
  conteneurs: {
    name: 'Conteneurs', field: 'ecartele',
    parts: [S(box(19, 11.5, 26, 15)), S(box(4.5, 29.5, 26, 15)), S(box(33.5, 29.5, 26, 15)), S('M2 47.5h60l-6.4 10H8.4z')],
  },
  globe: {
    name: 'Globe', field: 'pal',
    parts: [T('M6 32h52M32 6v52', 3.8), T('M10.5 19h43M10.5 45h43', 3.4), T(ellipse(32, 32, 11, 26), 3.8), T(ring(32, 32, 26.2), 4.8)],
  },
  soleil: {
    name: 'Soleil', field: 'coupe',
    parts: [S(Array.from({ length: 12 }, (_, i) => { const a = i * 30 - 90, r = i % 2 ? 25 : 30.5; return `M${pt(32, 32, 16, a - 10)}L${pt(32, 32, r, a)}L${pt(32, 32, 16, a + 10)}Z`; }).join('')),
      S(ring(32, 32, 13)), K(ring(32, 32, 8.6), 1.1)],
  },
  etoile_mer: {
    name: 'Étoile de mer', field: 'fasce',
    parts: [S(star(32, 33.5, 25, 11, 5), 7),
      K([-90, -18, 54, 126, 198].map((a) => [9, 15.5, 22].map((r) => `M${pt(32, 33.5, r, a)}h0`).join('')).join(''), 2.6)],
  },
  cloche: {
    name: 'Cloche de bord', field: 'bande',
    parts: [T(ring(32, 9.5, 4.5), 3.8), S('M19 47C19 30 21.5 14 32 14S45 30 45 47l6 4.5H13z'), S(ring(32, 56.5, 4.5)), K('M20.2 38.5h23.6M19.6 42.5h24.8', 1.1)],
  },
  iceberg: {
    name: 'Iceberg', field: 'coupe',
    parts: [S('M12 35L22.5 16l5.5 5.5L36.5 6l6.5 11.5 4-2L53 35z'), K('M22.5 16l3 19M36.5 6l-2 29M47 15.5l-2 19.5', 1), T(wave(3, 39.5, 58, 4), 4),
      T('M11.5 45h41l-4.8 10.5-13.7 5.8-16.6-4.9z', 2.8)],
  },
  tortue: {
    name: 'Tortue', field: 'jumelles',
    parts: [S(ring(32, 12, 6)), S(ellipse(17, 25, 9, 4.8)), S(ellipse(47, 25, 9, 4.8)), S(ellipse(19, 49, 7, 4.2)), S(ellipse(45, 49, 7, 4.2)), S('M29.5 49l2.5 11 2.5-11z'),
      S(`M32 17c9 0 15 7.5 15 17.5S41 53 32 53s-15-8.5-15-18.5S23 17 32 17z${hex(32, 35, 7.2)}${hex(32, 35, 4.2)}`)],
  },
};
// Nageoires de la tortue inclinées (les ellipses ci-dessus sont droites).
{
  const p = LOGOS.tortue.parts, tilt = [[17, 25, -35], [47, 25, 35], [19, 49, 35], [45, 49, -35]];
  tilt.forEach(([x, y, a], i) => { p[i + 1].rot = `rotate(${a} ${x} ${y})`; });
}

// Pièces → SVG. fill/line : couleurs ; outline : couleur du cerne (null = aucun) d'épaisseur ow.
function drawParts(parts, fill, outline = null, ow = 0) {
  const one = (p, col, extra) => {
    const tr = p.rot ? ` transform="${p.rot}"` : '';
    if (p.w) return `<path d="${p.d}"${tr} fill="none" stroke="${col}" stroke-width="${n1(p.w + extra)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const sw = p.round + extra;
    return `<path d="${p.d}"${tr} fill="${col}" fill-rule="evenodd"${sw ? ` stroke="${col}" stroke-width="${n1(sw)}" stroke-linejoin="round"` : ''}/>`;
  };
  const body = parts.filter((p) => !p.ink);
  let s = outline ? body.map((p) => one(p, outline, ow * 2)).join('') : '';
  s += body.map((p) => one(p, fill, 0)).join('');
  if (outline) s += parts.filter((p) => p.ink).map((p) => `<path d="${p.d}"${p.rot ? ` transform="${p.rot}"` : ''} fill="none" stroke="${outline}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return s;
}
for (const L of Object.values(LOGOS)) L.svg = drawParts(L.parts, 'currentColor');

// Les emblèmes dessinés (l'initiale est à part : elle dépend du nom de la compagnie).
export const LOGO_IDS = Object.keys(LOGOS);
export const INITIAL = 'lettre';
export const initialOf = (name) => (String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().match(/[A-Z0-9]/) || ['A'])[0];
export const initialLogo = (name) => `${INITIAL}:${initialOf(name)}`;
export const isInitialLogo = (id) => typeof id === 'string' && id.startsWith(`${INITIAL}:`);
// Partage du disque d'un emblème (l'initiale le tire de sa lettre).
export function logoField(logoId) {
  if (isInitialLogo(logoId)) return FIELD_IDS[initialOf(logoId.slice(INITIAL.length + 1)).charCodeAt(0) % FIELD_IDS.length];
  return (LOGOS[logoId] || LOGOS.ancre).field;
}

// Couleurs des compagnies (bien distinctes sur la carte).
export const COLORS = [
  { id: '#e5484d', name: 'Rouge' }, { id: '#3e8ef7', name: 'Bleu' }, { id: '#30a46c', name: 'Vert' },
  { id: '#f5a623', name: 'Ambre' }, { id: '#8e4ec6', name: 'Violet' }, { id: '#12a594', name: 'Turquoise' },
  { id: '#e93d82', name: 'Framboise' }, { id: '#f76b15', name: 'Orange' }, { id: '#d6c41d', name: 'Citron' },
  { id: '#a07850', name: 'Brun' },
];

// Couleurs dérivées : un emblème clair sur une couleur sombre, foncé sur une couleur claire.
const rgb = (hex) => (/^#[0-9a-f]{6}$/i.test(hex || '') ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null);
function luminance(hex) {
  const c = rgb(hex);
  if (!c) return 0.2;
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isLightColor = (hex) => luminance(hex) > 0.4;
// Assombrit (k < 0) ou éclaircit (k > 0) une couleur.
export function shade(hex, k) {
  const c = rgb(hex);
  if (!c) return hex;
  const t = k < 0 ? 0 : 255;
  return '#' + c.map((v) => Math.round(v + (t - v) * Math.abs(k)).toString(16).padStart(2, '0')).join('');
}
const INK = '#1d2731', CREAM = '#fbf1d8';
export const emblemInk = (color) => (isLightColor(color) ? '#1c2a33' : '#fffaf0');

const letterSVG = (ch, attrs) => `<text x="32" y="${'Q'.includes(ch) ? 47 : 49.5}" text-anchor="middle" font-family="'Stardos Stencil', Georgia, serif" font-weight="700" font-size="${'MW'.includes(ch) ? 42 : 50}" ${attrs}>${ch}</text>`;

// Emblème seul, d'une couleur (currentColor), pour l'insérer dans un autre dessin (cheminée, mur du bureau…).
export function logoMarkup(logoId) {
  if (isInitialLogo(logoId)) return letterSVG(initialOf(logoId.slice(INITIAL.length + 1)), 'fill="currentColor"');
  return (LOGOS[logoId] || LOGOS.ancre).svg;
}

// Emblème du médaillon : crème cerné d'encre (encre cernée de crème sur une couleur claire).
function emblemArt(logoId, fill, outline, ow) {
  if (isInitialLogo(logoId)) {
    const ch = initialOf(logoId.slice(INITIAL.length + 1));
    return letterSVG(ch, `fill="${outline}" stroke="${outline}" stroke-width="${ow * 2}" stroke-linejoin="round"`) + letterSVG(ch, `fill="${fill}"`);
  }
  return drawParts((LOGOS[logoId] || LOGOS.ancre).parts, fill, outline, ow);
}

// Médaillon : cerclage d'encre, disque partagé en deux tons de la couleur de la compagnie (filet crème
// le long du partage), emblème par-dessus. En petit (< 40 px), filets plus épais et emblème plus grand.
let badgeId = 0;
export function logoBadge(logoId, color, size = 28) {
  const id = `pa-lb${badgeId++}`, small = size < 40, light = isLightColor(color);
  const dark = shade(color, light ? -0.3 : -0.45);
  const fill = light ? INK : CREAM, outline = light ? CREAM : INK;
  const field = FIELDS[logoField(logoId)];
  const k = small ? 0.86 : 0.8, o = n1(40 - 32 * k);
  return `<svg class="logo-badge" width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true">`
    + `<defs><clipPath id="${id}"><circle cx="40" cy="40" r="${small ? 37.4 : 36.8}"/></clipPath></defs>`
    + `<circle cx="40" cy="40" r="39.6" fill="${INK}"/>`
    + `<g clip-path="url(#${id})"><rect width="80" height="80" fill="${color}"/><path d="${field}" fill="${dark}" stroke="${CREAM}" stroke-width="${small ? 2.2 : 1.6}" stroke-linejoin="round"/></g>`
    + (small ? '' : `<circle cx="40" cy="40" r="36.8" fill="none" stroke="${CREAM}" stroke-width="1.2"/>`)
    + `<g transform="translate(${o} ${o}) scale(${k})">${emblemArt(logoId, fill, outline, small ? 2.8 : 2.4)}</g></svg>`;
}
