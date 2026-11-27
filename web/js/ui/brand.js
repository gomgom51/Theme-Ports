// Logo du jeu : l'ancre maîtresse, le sceau « ancre au couchant » et la plaque de carte marine
// qui porte le nom en Stardos Stencil (choix de Clement, novembre 2026).
// Tout est dessiné en SVG dans le code : écran d'accueil, intro, générique, icône de l'application,
// et les visuels Steam (tools/brand/render.mjs les tire de ce même fichier).
// Ne pas confondre avec l'emblème « Ancre » des compagnies (ui/logos.js), qui reste un emblème.

// Couleurs du logo : encre et papier de la carte marine, ciel et mer du coucher de soleil de l'intro.
export const BRAND = {
  navy: '#1e3a55', paper: '#fbf8f1', paper3: '#e8e0cd', line2: '#c3b79c', teal: '#0f6f76',
  cream: '#fff1d0', dark: '#120b1e', sun1: '#fff1b8', sun2: '#ffd77a',
  sky: ['#1b1035', '#2b1544', '#461b55', '#6c2459', '#982f53', '#c44a44', '#e7783c', '#f6aa4c', '#fbd06a'],
  sea: ['#5a3566', '#43295d', '#322253', '#251c47', '#1b163a', '#141130'],
};
const C = BRAND;

export const GAME_NAME = "Port d'Attache";
// Accroche du logo, en anglais dans les deux langues (choix de Clement).
export const TAGLINE = 'Your fleet awaits, Captain';
// Police du nom : Stardos Stencil (OFL, web/fonts/), déclarée dans css/style.css.
export const BRAND_FONT = "'Stardos Stencil', Georgia, serif";

let uid = 0;
const nextId = (p) => `pa-${p}${uid++}`;
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// ---------- L'ancre maîtresse (boîte 100 × 100) ----------
// Ancre à jas : organeau, jas à boules, verge effilée, diamant pointu, pattes à oreilles.
export function anchorShapes(fill) {
  const F = `fill="${fill}"`;
  const fluke = 'M13.5 40C16.5 48.5 21 55.5 27.5 60.5L19.5 58.3L8.5 63C9.5 55 11 47.5 13.5 40Z';
  return `<circle cx="50" cy="11.5" r="6.6" fill="none" stroke="${fill}" stroke-width="5.2"/>`
    + `<path d="M28 21.6h44a3.6 3.6 0 0 1 0 7.2H28a3.6 3.6 0 0 1 0-7.2z" ${F}/>`
    + `<circle cx="25.5" cy="25.2" r="5.4" ${F}/><circle cx="74.5" cy="25.2" r="5.4" ${F}/>`
    + `<path d="M46.4 17.2h7.2l1.8 64h-10.8z" ${F}/>`
    + `<path d="M17.2 57.5C20 75.5 32 86 50 86S80 75.5 82.8 57.5" fill="none" stroke="${fill}" stroke-width="8.4"/>`
    + `<path d="M43.5 83.5L50 96l6.5-12.5z" ${F}/>`
    + `<path d="${fluke}" ${F}/><path d="${fluke}" ${F} transform="translate(100 0) scale(-1 1)"/>`;
}

// L'ancre cernée d'un contour (copie épaissie dessinée derrière), ow = épaisseur du contour.
export function anchorSVG({ fill = C.cream, outline = C.dark, ow = 3 } = {}) {
  if (!outline) return anchorShapes(fill);
  const back = anchorShapes(outline)
    .replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${+w + ow * 2}"`)
    .replace(/<(circle|path)([^>]*?)fill="([^"]+)"([^>]*?)\/>/g, (m, tag, a, f, b) => (f === 'none' ? m
      : `<${tag}${a}fill="${f}" stroke="${outline}" stroke-width="${ow * 2}" stroke-linejoin="round"${b}/>`));
  return back + anchorShapes(fill);
}

// ---------- Le sceau : l'ancre devant le soleil couchant ----------
// ring = cerclage marine et crème ; sans cerclage, le ciel remplit tout le carré (icône d'application).
export function sealSVG(size = 100, { ring = true } = {}) {
  const id = nextId('s');
  const hz = 63; // horizon
  const stops = C.sky.slice(1).map((c, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
  // Soleil coupé de bandes horizontales vers l'horizon, comme dans l'intro.
  let sun = '';
  const r = 21, cy = hz + 3;
  for (let y = cy - r; y < hz; y += 1) {
    const rel = (y - (cy - r)) / (2 * r);
    const m = Math.floor(y) % 4;
    if ((rel > 0.42 && m === 0) || (rel > 0.55 && m === 1)) continue;
    const half = Math.sqrt(Math.max(0, r * r - (y + 0.5 - cy) ** 2));
    sun += `<rect x="${(50 - half).toFixed(2)}" y="${y}" width="${(2 * half).toFixed(2)}" height="1" fill="${rel < 0.28 ? C.sun1 : C.sun2}"/>`;
  }
  // Reflets du soleil sur la mer.
  let glint = '';
  const g = [[44, 66, 12, '#ffe08a'], [40, 69, 8, '#f6a14d'], [55, 69, 6, '#f6a14d'], [38, 73, 6, '#f6a14d'], [52, 73, 11, '#b5474f'], [35, 78, 9, '#b5474f'], [57, 78, 7, '#b5474f'], [44, 83, 10, '#b5474f']];
  for (const [x, y, w, c] of g) glint += `<rect x="${x}" y="${y}" width="${w}" height="1.4" fill="${c}"/>`;
  const sz = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${sz} aria-hidden="true">`
    + `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`
    + `<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sea[1]}"/><stop offset="1" stop-color="${C.sea[5]}"/></linearGradient>`
    + `<clipPath id="${id}c"><circle cx="50" cy="50" r="${ring ? 42 : 72}"/></clipPath></defs>`
    + (ring ? `<circle cx="50" cy="50" r="49.5" fill="${C.dark}"/><circle cx="50" cy="50" r="46" fill="${C.navy}"/><circle cx="50" cy="50" r="43.6" fill="${C.cream}"/>` : '')
    + `<g clip-path="url(#${id}c)">`
    + `<rect x="-10" y="-10" width="120" height="${hz + 10}" fill="url(#${id}g)"/>${sun}`
    + `<rect x="-10" y="${hz}" width="120" height="${110 - hz}" fill="url(#${id}m)"/>`
    + `<rect x="20" y="${hz}" width="60" height="1.2" fill="#f39a4a"/>${glint}</g>`
    + `<g transform="translate(50 52) scale(0.6) translate(-50 -50)">${anchorSVG({ fill: C.cream, outline: C.dark, ow: 3.4 })}</g>`
    + '</svg>';
}

// ---------- La plaque : cartouche de carte marine couronné du sceau ----------
// Cadre de cordage, roses des vents en filigrane, double filet marine, nom en Stardos Stencil,
// accroche sous un filet sarcelle. width = largeur en pixels (sans : 100 % de son conteneur).
// La boîte fait 600 de large ; sa hauteur dépend du sceau et de l'accroche (plaqueBox).
export function plaqueBox({ tagline = TAGLINE, seal = 110 } = {}) {
  const T = seal ? Math.round(seal * 0.66) : 28;
  const H = T + (tagline ? 206 : 152);
  return { W: 600, T, H, VH: H + 6 }; // VH : place pour l'ombre portée
}
export function plaqueSVG({ width = 0, tagline = TAGLINE, seal = 110, shadow = true } = {}) {
  const id = nextId('q');
  const { W, T, H, VH } = plaqueBox({ tagline, seal });
  const k = 26; // rayon des coins rentrants
  const plate = (i) => {
    const x0 = i, y0 = i + T, x1 = W - i, y1 = H - i, r = k - i * 0.4;
    return `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 0 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 0 ${x1 - r} ${y1}`
      + `H${x0 + r}A${r} ${r} 0 0 0 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 0 ${x0 + r} ${y0}Z`;
  };
  const cy = T + (H - T) * 0.52;
  let rhumbs = '';
  for (let a = 0; a < 360; a += 22.5) {
    const rad = a * Math.PI / 180;
    rhumbs += `<line x1="300" y1="${cy}" x2="${(300 + Math.cos(rad) * 420).toFixed(1)}" y2="${(cy + Math.sin(rad) * 420).toFixed(1)}"/>`;
  }
  const name = GAME_NAME.replace("'", '’'); // apostrophe typographique
  const wy = T + (tagline ? 104 : 98);
  const ry = wy + 26, ty = ry + 33;
  const sz = width ? ` width="${width}" height="${(width * VH / W).toFixed(1)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${VH}"${sz} aria-hidden="true">`
    + `<defs><pattern id="${id}r" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="7" height="7" fill="#b9a57d"/><rect width="3" height="7" fill="#7d6a48"/></pattern>`
    + `<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.paper}"/><stop offset="1" stop-color="${C.paper3}"/></linearGradient>`
    + `<clipPath id="${id}c"><path d="${plate(14)}"/></clipPath></defs>`
    + (shadow ? `<path d="${plate(3)}" fill="${C.dark}" opacity=".35" transform="translate(0 5)"/>` : '')
    + `<path d="${plate(5)}" fill="url(#${id}p)"/>`
    + `<path d="${plate(5)}" fill="none" stroke="url(#${id}r)" stroke-width="9"/>`
    + `<path d="${plate(5)}" fill="none" stroke="#5b4a2e" stroke-width="1" opacity=".5"/>`
    + `<g clip-path="url(#${id}c)" stroke="${C.line2}" stroke-width="1" opacity=".55">${rhumbs}</g>`
    + `<path d="${plate(14)}" fill="none" stroke="${C.navy}" stroke-width="2"/>`
    + `<path d="${plate(19)}" fill="none" stroke="${C.navy}" stroke-width="0.8"/>`
    + (seal ? `<g transform="translate(${300 - seal / 2} ${T - seal * 0.6}) scale(${seal / 100})">${inner(sealSVG(0))}</g>` : '')
    + `<text x="300" y="${wy}" text-anchor="middle" font-family="${BRAND_FONT}" font-weight="700" font-size="68" fill="${C.navy}">${name}</text>`
    + (tagline ? `<g stroke="${C.teal}" stroke-width="1.4"><line x1="100" y1="${ry}" x2="270" y2="${ry}"/><line x1="330" y1="${ry}" x2="500" y2="${ry}"/></g>`
      + `<path d="M300 ${ry - 9}l5 9-5 9-5-9z" fill="${C.teal}"/>`
      + `<text x="300" y="${ty}" text-anchor="middle" font-family="${BRAND_FONT}" font-weight="700" font-size="17" letter-spacing="4.2" fill="${C.teal}">${tagline.toUpperCase()}</text>` : '')
    + '</svg>';
}

// ---------- Icône de l'application : le sceau sans cerclage, dans un carré arrondi ----------
export function appIconSVG(size = 0, { radius = 18 } = {}) {
  const id = nextId('i');
  const sz = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${sz}>`
    + `<defs><clipPath id="${id}"><rect width="100" height="100" rx="${radius}"/></clipPath></defs>`
    + `<g clip-path="url(#${id})"><g transform="translate(-8 -8) scale(1.16)">${inner(sealSVG(0, { ring: false }))}</g></g></svg>`;
}

// Le titre du jeu prêt à poser dans la page : la plaque, lue « Port d'Attache » par les lecteurs
// d'écran et jamais traduite (data-no-tr). tag : 'h1.classe…'. Sans dépendance (outils Steam).
export function brandTitle(tag = 'h1', opts = {}) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  el.className = ['brand-plaque', ...cls].join(' ');
  el.setAttribute('data-no-tr', '');
  el.innerHTML = plaqueSVG(opts).replace('aria-hidden="true"', `role="img" aria-label="${GAME_NAME}"`);
  return el;
}

// ---------- Icône 16 × 16, dessinée au pixel (le sceau vectoriel devient flou à cette taille) ----------
// Bandes du couchant, ancre crème cernée de nuit sur le soleil. # ancre ; le contour se calcule autour.
const ANCHOR_16 = ['....####....', '....#..#....', '....####....', '.##########.', '.....##.....', '.....##.....', '#....##....#',
  '##...##...##', '.#...##...#.', '.##..##..##.', '..########..', '....####....', '.....##.....'];
const BANDS_16 = ['#2b1544', '#461b55', '#6c2459', '#982f53', '#c44a44', '#e7783c', '#f6aa4c', '#fbd06a', '#ffd77a', '#fff1b8',
  '#f39a4a', '#43295d', '#322253', '#251c47', '#1b163a', '#141130'];
export function appIcon16SVG({ round = true } = {}) {
  const on = (x, y) => ANCHOR_16[y - 1]?.[x - 2] === '#';
  const corner = (x, y) => round && (Math.min(x, 15 - x) + Math.min(y, 15 - y) < 1);
  let px = '';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (corner(x, y)) continue;
    let fill = BANDS_16[y];
    if (on(x, y)) fill = C.cream;
    // contour seulement sur les bandes claires (soleil) : ailleurs le crème se détache seul
    else if (y >= 5 && y <= 10 && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) fill = C.dark;
    px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">${px}</svg>`;
}
