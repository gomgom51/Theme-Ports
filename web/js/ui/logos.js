// Emblèmes des compagnies (dessins originaux, carré 64×64, une seule couleur).
// Silhouettes pleines et traits épais, lisibles même en petit (classement, barre du haut).
// Chaque emblème utilise « currentColor » pour pouvoir être teinté ; les détails sont des
// trous (fill-rule evenodd) qui laissent voir le fond, quelle que soit sa couleur.
const F = 'fill="currentColor"';
const E = 'fill="currentColor" fill-rule="evenodd"';
const L = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const n1 = (x) => +x.toFixed(1);
const rad = (a) => (a * Math.PI) / 180;
const pt = (cx, cy, r, a) => `${n1(cx + r * Math.cos(rad(a)))} ${n1(cy + r * Math.sin(rad(a)))}`;

function star(cx, cy, r1, r2, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) pts.push(pt(cx, cy, i % 2 ? r2 : r1, rot + (i * 180) / n).replace(' ', ','));
  return pts.join(' ');
}
// Cercle sous forme de sous-chemin (pour percer un trou).
const ring = (cx, cy, r) => `M${n1(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n1(2 * r)} 0a${r} ${r} 0 1 0 ${n1(-2 * r)} 0Z`;
// Portion de couronne entre les rayons r0 et r1, des angles a0 à a1 (degrés).
const arcSeg = (cx, cy, r0, r1, a0, a1) => `M${pt(cx, cy, r1, a0)}A${r1} ${r1} 0 0 1 ${pt(cx, cy, r1, a1)}L${pt(cx, cy, r0, a1)}A${r0} ${r0} 0 0 0 ${pt(cx, cy, r0, a0)}Z`;
const wave = (x, y, w, amp = 6) => `M${x} ${y}` + Array.from({ length: 4 }, (_, i) => `q${w / 8} ${i % 2 ? amp : -amp} ${w / 4} 0`).join('');
// Conteneur avec ses nervures (trous).
const box = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}z` + [0.27, 0.5, 0.73].map((k) => `M${n1(x + w * k - 1.2)} ${y + 3}h2.4v${h - 6}h-2.4z`).join('');

export const LOGOS = {
  ancre: {
    name: 'Ancre',
    svg: `<circle cx="32" cy="10.5" r="6" ${L(5)}/><rect x="28.5" y="15" width="7" height="40" rx="2" ${F}/><rect x="16" y="21" width="32" height="6.5" rx="3.2" ${F}/>`
      + `<path d="M11 37C13 48 21 55.5 32 55.5S51 48 53 37" ${L(7)}/><path d="M3.5 42L12 29.5l7.5 10.5zM60.5 42L52 29.5l-7.5 10.5z" ${F}/>`,
  },
  rose: {
    name: 'Rose des vents',
    svg: [45, 135, 225, 315].map((a) => `<path d="M32 32L${pt(32, 32, 20, a)}L${pt(32, 32, 6, a + 45)}z" ${F} opacity=".7"/>`).join('')
      + [-90, 0, 90, 180].map((a) => `<path d="M32 32L${pt(32, 32, 30, a)}L${pt(32, 32, 8, a - 45)}z" ${F}/><path d="M32 32L${pt(32, 32, 30, a)}L${pt(32, 32, 8, a + 45)}z" ${F} opacity=".6"/>`).join(''),
  },
  phare: {
    name: 'Phare',
    svg: `<path d="M24.5 13.5L5 7.5v13zM39.5 13.5L59 7.5v13z" ${F} opacity=".8"/><path d="M26.5 8.5L32 3.5l5.5 5V11h-11z" ${F}/><rect x="26" y="11" width="12" height="9" rx="1" ${F}/>`
      + `<rect x="22" y="20" width="20" height="5" rx="1.8" ${F}/><path d="M25.5 25h13l1 10h-15zM23.9 41h16.2l1.6 14H22.3z" ${F}/><rect x="15" y="55" width="34" height="5" rx="2.2" ${F}/>`,
  },
  barre: {
    name: 'Barre',
    svg: `<g ${L(5)}>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M32 32L${pt(32, 32, 24, a)}"/>`).join('')}</g><circle cx="32" cy="32" r="15" ${L(6)}/>`
      + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const [x, y] = pt(32, 32, 26.5, a).split(' '); return `<circle cx="${x}" cy="${y}" r="4.3" ${F}/>`; }).join('')
      + `<path d="${ring(32, 32, 7)}${ring(32, 32, 2.4)}" ${E}/>`,
  },
  mouette: {
    name: 'Mouette',
    svg: `<path d="M2 25C12 17 23 20 32 33C41 20 52 17 62 25C52 26 42 33 32 49C22 33 12 26 2 25Z" ${F}/>`,
  },
  baleine: {
    name: 'Baleine',
    svg: `<path transform="translate(0 -6)" d="M32 58c-2-10-3-18-3-26-6 0-14-2-21-10 7 1 13 0 19-3 3-1 5-3 5-6 0 3 2 5 5 6 6 3 12 4 19 3-7 8-15 10-21 10 0 8-1 16-3 26z" ${F}/>`
      + `<path d="${wave(4, 54, 56, 5)}" ${L(5.5)}/>`,
  },
  etoile: {
    name: 'Étoile polaire',
    svg: `<circle cx="32" cy="32" r="26.5" ${L(5)}/><polygon points="${star(32, 33.5, 19.5, 7.8)}" ${F}/>`,
  },
  vagues: {
    name: 'Vagues',
    svg: `<g ${L(6.5)}>${[17, 32, 47].map((y) => `<path d="${wave(5, y, 54)}"/>`).join('')}</g>`,
  },
  voilier: {
    name: 'Voilier',
    svg: `<path d="M29 4C22 17 15 31 8 45h21z" ${F}/><path d="M34 11c6 11 12 22 19 34H34z" ${F}/><path d="M5 49h54l-7 9H12z" ${F}/>`,
  },
  poisson: {
    name: 'Poisson',
    svg: `<path d="M4 32C12 20 24 15 36 17.5c7 1.5 12 7 15 14.5-3 7.5-8 13-15 14.5C24 49 12 44 4 32z${ring(16, 29, 3.2)}M25 23.5c3 5 3 12 0 17l-2.6-1c2.4-4.5 2.4-10.5 0-15z" ${E}/><path d="M48 32l12-13v26z" ${F}/>`,
  },
  couronne: {
    name: 'Couronne',
    svg: `<path d="M8.5 46L5.5 21l14 11L32 13l12.5 19 14-11-3 25z" ${F}/><circle cx="5.5" cy="18.5" r="4" ${F}/><circle cx="32" cy="10" r="4.5" ${F}/><circle cx="58.5" cy="18.5" r="4" ${F}/>`
      + `<path d="M8 49h48v8.5H8z${ring(20, 53.2, 2.2)}${ring(32, 53.2, 2.2)}${ring(44, 53.2, 2.2)}" ${E}/>`,
  },
  trident: {
    name: 'Trident',
    svg: `<rect x="29" y="11" width="6" height="51" rx="2" ${F}/><path d="M15 12v11c0 7 7.5 11 17 11s17-4 17-11V12" ${L(6)}/><path d="M32 1.5l-7 11h14zM15 2.5l-6 10.5h12zM49 2.5l-6 10.5h12z" ${F}/>`,
  },
  helice: {
    name: 'Hélice',
    svg: [0, 120, 240].map((a) => `<path transform="rotate(${a} 32 32)" d="M32 26C25.5 21.5 22 11 27.5 5.5c4.5-4.5 12-2.5 13 4 .8 6-2 12-5.5 17.5z" ${F}/>`).join('')
      + `<path d="${ring(32, 32, 8)}${ring(32, 32, 2.8)}" ${E}/>`,
  },
  bouee: {
    name: 'Bouée',
    svg: `<circle cx="32" cy="32" r="24.5" ${L(3.5)}/><circle cx="32" cy="32" r="14.5" ${L(3.5)}/>`
      + `<path d="${[45, 135, 225, 315].map((a) => arcSeg(32, 32, 12.5, 26.5, a - 19, a + 19)).join('')}" ${F}/>`,
  },
  pieuvre: {
    name: 'Pieuvre',
    svg: `<g ${L(6)}><path d="M21 32c-9 4-15 12-11 20 2 4 7 3 6-1"/><path d="M27.5 36c-2 8-7 14-3 21"/><path d="M36.5 36c2 8 7 14 3 21"/><path d="M43 32c9 4 15 12 11 20-2 4-7 3-6-1"/></g>`
      + `<path d="M32 4c12 0 17 10 15 20-1 7-6 13-15 13S18 31 17 24C15 14 20 4 32 4z${ring(25.5, 24, 3.2)}${ring(38.5, 24, 3.2)}" ${E}/>`,
  },
  requin: {
    name: 'Aileron de requin',
    svg: `<path d="M13 46C26 38 34 17 48 5C39 20 39 36 51 46Z" ${F}/><path d="${wave(4, 50, 56, 5)}" ${L(5.5)}/><path d="${wave(13, 59, 38, 4)}" ${L(4.5)}/>`,
  },
  grue: {
    name: 'Grue portuaire',
    svg: `<path d="M16.5 15L24 3.5h3.5L35 15z" ${F}/><rect x="3" y="15" width="58" height="5.5" rx="1.5" ${F}/><g ${L(2.6)}><path d="M26 5L59 15.5M25 5L5 15.5M50 22v12"/></g>`
      + `<rect x="46" y="20" width="8" height="4" ${F}/><rect x="43" y="34" width="14" height="5" rx="1" ${F}/>`
      + `<rect x="13" y="20.5" width="6" height="36" ${F}/><rect x="30" y="20.5" width="6" height="36" ${F}/><rect x="13" y="25" width="23" height="5" ${F}/><rect x="13" y="40" width="23" height="4" ${F}/><rect x="37" y="20.5" width="7" height="6" rx="1" ${F}/><rect x="10" y="55" width="29" height="5" rx="2" ${F}/>`,
  },
  conteneurs: {
    name: 'Conteneurs',
    svg: `<path d="${box(18.5, 13, 27, 16)}${box(3, 32, 27, 16)}${box(34, 32, 27, 16)}" ${E}/><path d="M1.5 51h61l-6.5 9H8z" ${F}/>`,
  },
  globe: {
    name: 'Globe',
    svg: `<circle cx="32" cy="32" r="26.5" ${L(5)}/><ellipse cx="32" cy="32" rx="11" ry="26.5" ${L(4)}/><g ${L(4)}><path d="M5.5 32h53M32 5.5v53"/></g><g ${L(3.5)}><path d="M10 19h44M10 45h44"/></g>`,
  },
  soleil: {
    name: 'Soleil',
    svg: `<circle cx="32" cy="32" r="12.5" ${F}/>` + Array.from({ length: 12 }, (_, i) => { const a = i * 30 - 90, r = i % 2 ? 24.5 : 30; return `<path d="M${pt(32, 32, 16.5, a - 9)}L${pt(32, 32, r, a)}L${pt(32, 32, 16.5, a + 9)}z" ${F}/>`; }).join(''),
  },
  etoile_mer: {
    name: 'Étoile de mer',
    svg: `<polygon points="${star(32, 33.5, 25, 11, 5)}" ${F} stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>`
      + `<g fill="#000" fill-opacity=".22">${[-90, -18, 54, 126, 198].map((a) => { const [x, y] = pt(32, 33.5, 15, a).split(' '); const [x2, y2] = pt(32, 33.5, 22, a).split(' '); return `<circle cx="${x}" cy="${y}" r="2"/><circle cx="${x2}" cy="${y2}" r="1.6"/>`; }).join('')}<circle cx="32" cy="33.5" r="3"/></g>`,
  },
  cloche: {
    name: 'Cloche de bord',
    svg: `<circle cx="32" cy="9.5" r="4.5" ${L(3.8)}/><path d="M19 47C19 30 21.5 14 32 14S45 30 45 47l6 4.5H13z" ${F}/><circle cx="32" cy="56.5" r="4.5" ${F}/>`,
  },
  iceberg: {
    name: 'Iceberg',
    svg: `<path d="M12 35L22.5 16l5.5 5.5L36.5 6l6.5 11.5 4-2L53 35z" ${F}/><path d="${wave(3, 39.5, 58, 4)}" ${L(4)}/><path d="M11 44h42l-5 11-14 6-17-5z" ${F} opacity=".55"/>`,
  },
  tortue: {
    name: 'Tortue',
    svg: `<circle cx="32" cy="12" r="6" ${F}/><g ${F}><ellipse cx="17" cy="25" rx="9" ry="4.8" transform="rotate(-35 17 25)"/><ellipse cx="47" cy="25" rx="9" ry="4.8" transform="rotate(35 47 25)"/>`
      + `<ellipse cx="19" cy="49" rx="7" ry="4.2" transform="rotate(35 19 49)"/><ellipse cx="45" cy="49" rx="7" ry="4.2" transform="rotate(-35 45 49)"/><path d="M29.5 49l2.5 11 2.5-11z"/></g>`
      + `<path d="M32 17c9 0 15 7.5 15 17.5S41 53 32 53s-15-8.5-15-18.5S23 17 32 17z${hex(32, 35, 7.2)}${hex(32, 35, 4.2)}" ${E}/>`,
  },
};
function hex(cx, cy, r) { return 'M' + Array.from({ length: 6 }, (_, i) => pt(cx, cy, r, i * 60 - 90)).join('L') + 'Z'; }

// Les emblèmes dessinés (l'initiale est à part : elle dépend du nom de la compagnie).
export const LOGO_IDS = Object.keys(LOGOS);
export const INITIAL = 'lettre';
export const initialOf = (name) => (String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().match(/[A-Z0-9]/) || ['A'])[0];
export const initialLogo = (name) => `${INITIAL}:${initialOf(name)}`;
export const isInitialLogo = (id) => typeof id === 'string' && id.startsWith(`${INITIAL}:`);
export const logoName = (id) => (isInitialLogo(id) ? 'Initiale' : (LOGOS[id] || LOGOS.ancre).name);

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
export const emblemInk = (color) => (isLightColor(color) ? '#1c2a33' : '#fffaf0');
// Emblème posé sur un disque blanc (cheminée) : la couleur de la compagnie, assombrie si elle est trop claire.
export const emblemOnWhite = (color) => (isLightColor(color) ? shade(color, -0.45) : color);

// Emblème seul, pour l'insérer dans un autre dessin (cheminée, mur du bureau…).
export function logoMarkup(logoId) {
  if (isInitialLogo(logoId)) {
    const ch = initialOf(logoId.slice(INITIAL.length + 1));
    return `<text x="32" y="48.5" text-anchor="middle" font-family="'Libre Baskerville', Georgia, 'Times New Roman', serif" font-weight="700" font-size="${'MW'.includes(ch) ? 40 : 47}" fill="currentColor">${ch}</text>`;
  }
  return (LOGOS[logoId] || LOGOS.ancre).svg;
}

// Médaillon : emblème sur la couleur de la compagnie, liseré plus foncé ; en grand, un filet
// intérieur et une ombre portée donnent un air d'insigne émaillé.
export function logoBadge(logoId, color, size = 28) {
  const art = logoMarkup(logoId), light = isLightColor(color);
  const ink = emblemInk(color), rim = shade(color, -0.32), big = size >= 40;
  const k = 0.86, o = (80 - 64 * k) / 2, d = big ? 1.6 : 1.2;
  return `<svg class="logo-badge" width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="39.5" fill="${rim}"/><circle cx="40" cy="40" r="35.5" fill="${color}"/>${big ? `<circle cx="40" cy="40" r="34.4" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width="1"/>` : ''}
    <g transform="translate(${o + d} ${o + d}) scale(${k})" color="${light ? '#ffffff' : rim}" opacity="${light ? 0.45 : 0.9}">${art}</g>
    <g transform="translate(${o} ${o}) scale(${k})" color="${ink}">${art}</g></svg>`;
}

export function badgeEl(logoId, color, size = 28) {
  const span = document.createElement('span');
  span.className = 'badge-wrap';
  span.innerHTML = logoBadge(logoId, color, size);
  return span;
}
