// Emblèmes des compagnies (dessins originaux, carré 64×64, une seule couleur).
// Chaque emblème utilise « currentColor » pour pouvoir être teinté.
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

function star(cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export const LOGOS = {
  ancre: {
    name: 'Ancre',
    svg: `<g ${S} stroke-width="5"><circle cx="32" cy="11" r="5"/><path d="M32 16v38M20 24h24M12 38c2 9 10 16 20 16s18-7 20-16"/></g><path d="M7 41l6-6 5 7zM57 41l-6-6-5 7z" fill="currentColor"/>`,
  },
  rose: {
    name: 'Rose des vents',
    svg: `<polygon points="${star(32, 32, 28, 6, 4)}" fill="currentColor"/><polygon points="${star(32, 32, 17, 4, 4, -Math.PI / 4)}" fill="currentColor" opacity=".75"/><circle cx="32" cy="32" r="20" ${S} stroke-width="2.5"/>`,
  },
  phare: {
    name: 'Phare',
    svg: `<path d="M26 56l3-34h6l3 34z" fill="currentColor"/><path d="M27 18h10v-6l-5-4-5 4z" fill="currentColor"/><g ${S} stroke-width="3"><path d="M41 13l12-5M41 17h13M23 13l-12-5M23 17H10"/><path d="M18 57h28"/></g><path d="M28.2 34h7.6l.5 6h-8.6zM27.4 46h9.2l.4 5h-10z" fill="#000" opacity=".28"/>`,
  },
  barre: {
    name: 'Barre',
    svg: `<g ${S} stroke-width="4"><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="5"/></g><g ${S} stroke-width="4">${[0, 45, 90, 135].map((a) => `<path d="M32 4v56" transform="rotate(${a} 32 32)"/>`).join('')}</g>`,
  },
  mouette: {
    name: 'Mouette',
    svg: `<path d="M4 30c8-6 16-6 22 0 2 2 4 5 6 9 2-4 4-7 6-9 6-6 14-6 22 0-8-2-14 0-18 6-4 5-7 11-10 15-3-4-6-10-10-15-4-6-10-8-18-6z" fill="currentColor"/>`,
  },
  baleine: {
    name: 'Baleine',
    svg: `<path d="M32 58c-2-10-3-18-3-26-6 0-14-2-21-10 7 1 13 0 19-3 3-1 5-3 5-6 0 3 2 5 5 6 6 3 12 4 19 3-7 8-15 10-21 10 0 8-1 16-3 26z" fill="currentColor"/>`,
  },
  etoile: {
    name: 'Étoile polaire',
    svg: `<circle cx="32" cy="32" r="27" ${S} stroke-width="3"/><polygon points="${star(32, 33, 21, 8.5)}" fill="currentColor"/>`,
  },
  vagues: {
    name: 'Vagues',
    svg: `<g ${S} stroke-width="5">${[18, 32, 46].map((y) => `<path d="M6 ${y}c5-6 9-6 13 0s8 6 13 0 8-6 13 0 8 6 13 0"/>`).join('')}</g>`,
  },
  voilier: {
    name: 'Voilier',
    svg: `<path d="M30 6v40H10z" fill="currentColor"/><path d="M34 12v34h18z" fill="currentColor" opacity=".8"/><path d="M6 49h52l-7 8H13z" fill="currentColor"/>`,
  },
  poisson: {
    name: 'Poisson',
    svg: `<path d="M6 32c8-12 20-17 32-14 6 2 11 7 14 14-3 7-8 12-14 14-12 3-24-2-32-14z" fill="currentColor"/><path d="M50 32l10-11v22z" fill="currentColor"/><circle cx="17" cy="29" r="2.8" fill="#000" opacity=".45"/>`,
  },
  couronne: {
    name: 'Couronne',
    svg: `<path d="M8 46l-2-26 14 12 12-20 12 20 14-12-2 26z" fill="currentColor"/><rect x="8" y="49" width="48" height="7" rx="2" fill="currentColor"/>`,
  },
  trident: {
    name: 'Trident',
    svg: `<g ${S} stroke-width="5"><path d="M32 10v48M16 12v12c0 6 7 10 16 10s16-4 16-10V12"/></g><path d="M32 2l-6 10h12zM16 4l-5 9h10zM48 4l-5 9h10z" fill="currentColor"/>`,
  },
};
export const LOGO_IDS = Object.keys(LOGOS);

// Couleurs des compagnies (bien distinctes sur la carte).
export const COLORS = [
  { id: '#e5484d', name: 'Rouge' }, { id: '#3e8ef7', name: 'Bleu' }, { id: '#30a46c', name: 'Vert' },
  { id: '#f5a623', name: 'Ambre' }, { id: '#8e4ec6', name: 'Violet' }, { id: '#12a594', name: 'Turquoise' },
  { id: '#e93d82', name: 'Framboise' }, { id: '#f76b15', name: 'Orange' }, { id: '#d6c41d', name: 'Citron' },
  { id: '#a07850', name: 'Brun' },
];

// Pastille ronde : emblème blanc sur la couleur de la compagnie.
export function logoBadge(logoId, color, size = 28) {
  const L = LOGOS[logoId] || LOGOS.ancre;
  return `<svg class="logo-badge" width="${size}" height="${size}" viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="38" fill="${color}"/><circle cx="40" cy="40" r="34" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
    <g transform="translate(14 14) scale(.8125)" color="#fff">${L.svg}</g></svg>`;
}

// Emblème seul, pour l'insérer dans un autre dessin (cheminée, mur du bureau…).
export function logoMarkup(logoId) { return (LOGOS[logoId] || LOGOS.ancre).svg; }

export function badgeEl(logoId, color, size = 28) {
  const span = document.createElement('span');
  span.className = 'badge-wrap';
  span.innerHTML = logoBadge(logoId, color, size);
  return span;
}
