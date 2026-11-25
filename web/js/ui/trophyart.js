// Trophées des records et preuves sinistres des méfaits : petits dessins vectoriels (boîte 24 × 32),
// utilisés en grand dans le bureau (onglet Trophées) et en petit sur l'étagère et le bureau.
const GOLD = { base: '#e0b23a', light: '#f8e08a', dark: '#a8801c' };
const SILVER = { base: '#c4cad3', light: '#f1f4f8', dark: '#8a929d' };

const plinth = (plate = '#d9b44a') => `<rect x="4.5" y="27" width="15" height="4.5" rx=".6" fill="#4a2f1b"/><rect x="6.5" y="25" width="11" height="2.5" fill="#6b4a2e"/><rect x="9" y="28.4" width="6" height="1.6" fill="${plate}"/>`;
const cup = (m) => `
  <path d="M7.2 8.2 q-4.4 .3 -3.6 4.6 q.6 2.6 4.4 3" fill="none" stroke="${m.dark}" stroke-width="1.5"/>
  <path d="M16.8 8.2 q4.4 .3 3.6 4.6 q-.6 2.6 -4.4 3" fill="none" stroke="${m.dark}" stroke-width="1.5"/>
  <path d="M5.5 5.5 h13 q0 10 -6.5 12.2 q-6.5 -2.2 -6.5 -12.2 z" fill="${m.base}"/>
  <path d="M7.4 6.6 q.2 6.8 3.4 9.4" stroke="${m.light}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <rect x="5" y="4.6" width="14" height="1.6" rx=".6" fill="${m.light}"/>
  <rect x="11" y="17.4" width="2" height="4.6" fill="${m.dark}"/>
  <path d="M8 24.8 q4 -3.4 8 0 z" fill="${m.base}"/><rect x="8" y="24.3" width="8" height="1" fill="${m.dark}"/>`;

export const TROPHY_ART = {
  armada: () => `${plinth()}${cup(GOLD)}<path d="M8.2 11.4 h7.6 l-1 1.6 h-5.6 z M10.4 9.6 h1.6 v1.8 h-1.6 z M12.6 10.2 h1.2 v1.2 h-1.2 z" fill="${GOLD.dark}"/>`,
  mois: () => `${plinth()}${cup(SILVER)}<text x="12" y="12.6" font-family="Georgia, serif" font-size="5.6" font-weight="700" text-anchor="middle" fill="${SILVER.dark}">30</text>`,
  tonnes: () => `${plinth()}
    <circle cx="12" cy="5.6" r="1.9" fill="none" stroke="${GOLD.base}" stroke-width="1.4"/>
    <rect x="11.1" y="7.2" width="1.8" height="15" fill="${GOLD.base}"/><rect x="11.5" y="7.6" width=".6" height="13" fill="${GOLD.light}"/>
    <rect x="7.6" y="9.6" width="8.8" height="1.6" rx=".6" fill="${GOLD.dark}"/>
    <path d="M5.2 16.4 q1 6.4 6.8 6.6 q5.8 -.2 6.8 -6.6" fill="none" stroke="${GOLD.base}" stroke-width="1.8"/>
    <path d="M3.6 17.6 l1.8 -2.4 l1.4 2.6 z M20.4 17.6 l-1.8 -2.4 l-1.4 2.6 z" fill="${GOLD.base}"/>`,
  ponctuel: () => `${plinth()}
    <rect x="10.2" y="17" width="3.6" height="8.4" fill="${GOLD.dark}"/><rect x="10.8" y="17" width="1" height="8" fill="${GOLD.light}"/>
    <circle cx="12" cy="10.4" r="7.2" fill="${GOLD.base}"/><circle cx="12" cy="10.4" r="5.6" fill="#fbf6e8"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => { const a = (k * Math.PI) / 6; return `<rect x="${(12 + Math.sin(a) * 4.6 - 0.35).toFixed(2)}" y="${(10.4 - Math.cos(a) * 4.6 - 0.35).toFixed(2)}" width=".7" height=".7" fill="#5a4a2a"/>`; }).join('')}
    <path d="M12 10.4 v-3.8 M12 10.4 l2.6 1.6" stroke="#2b2b2b" stroke-width=".9" stroke-linecap="round"/><circle cx="12" cy="10.4" r=".8" fill="#2b2b2b"/>
    <path d="M7.2 6 q2 -2.6 5 -2.6" stroke="${GOLD.light}" stroke-width="1" fill="none"/>`,
  equipages: () => `${plinth()}
    <rect x="11" y="17.6" width="2" height="7.6" fill="${GOLD.dark}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4, x2 = 12 + Math.sin(a) * 9.4, y2 = 10.6 - Math.cos(a) * 9.4; return `<line x1="12" y1="10.6" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${GOLD.dark}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${x2.toFixed(2)}" cy="${y2.toFixed(2)}" r="1.1" fill="${GOLD.base}"/>`; }).join('')}
    <circle cx="12" cy="10.6" r="6.4" fill="none" stroke="${GOLD.base}" stroke-width="1.8"/><circle cx="12" cy="10.6" r="2.2" fill="${GOLD.base}"/><circle cx="11.4" cy="10" r=".8" fill="${GOLD.light}"/>`,
  produits: () => `${plinth()}
    <path d="M12 21.4 v3.6 M8.4 25 h7.2" stroke="${GOLD.dark}" stroke-width="1.6"/>
    <circle cx="12" cy="11.6" r="7.6" fill="#3d7fae"/>
    <path d="M7 8.4 q2 -1.6 3.4 .2 q.4 2.2 -1.4 3 q-1.4 1.6 -.4 3.4 q-2.4 -.8 -2.6 -3.6 z M13.4 6.4 q3 .2 4.4 2.6 q-1.2 1.4 -2.8 .6 q-1.4 1 -2.2 -.4 z M13.6 13 q2.6 -.6 3.8 1.2 q-.6 2.6 -3 3.4 q-.4 -2.2 -.8 -4.6 z" fill="#6fae5e"/>
    <path d="M3.6 11.6 a8.4 8.4 0 0 1 16.8 0" fill="none" stroke="${GOLD.base}" stroke-width="1.4" transform="rotate(-20 12 11.6)"/>
    <ellipse cx="9.4" cy="8" rx="2" ry="1.2" fill="#fff" opacity=".35"/>`,
  ports: () => `${plinth()}
    <circle cx="12" cy="12" r="8.6" fill="#f6efdc" stroke="${GOLD.base}" stroke-width="1.6"/>
    <path d="M12 3.8 l1.6 6.6 l6.6 1.6 l-6.6 1.6 l-1.6 6.6 l-1.6 -6.6 l-6.6 -1.6 l6.6 -1.6 z" fill="${GOLD.base}"/>
    <path d="M12 3.8 l1.6 6.6 l-1.6 1.6 z M20.2 12 l-6.6 1.6 l-1.6 -1.6 z M12 20.2 l-1.6 -6.6 l1.6 -1.6 z M3.8 12 l6.6 -1.6 l1.6 1.6 z" fill="${GOLD.dark}"/>
    <path d="M12 6.6 l.8 4.6 l-.8 .8 l-.8 -.8 z" fill="#c4362c"/>
    <rect x="11" y="20.6" width="2" height="4.6" fill="${GOLD.dark}"/>`,
  familles: () => `${plinth()}
    <path d="M8.6 18.6 v6.4 M15.4 18.6 v6.4" stroke="${GOLD.dark}" stroke-width="1.2"/>
    <path d="M2.4 13.6 h19.2 l-2.4 4.8 h-14.4 z" fill="#2c3e50"/><path d="M4.2 16.6 h15.6 l-.6 1.8 h-14.4 z" fill="#b5402f"/>
    <rect x="13.6" y="9.6" width="5" height="4" fill="#f1ede1"/><rect x="14.2" y="10.4" width="3.8" height=".8" fill="#5b88a0"/>
    <rect x="15.2" y="6.6" width="2" height="3" fill="${GOLD.base}"/><rect x="15.2" y="6.6" width="2" height=".8" fill="#2b2b2b"/>
    ${[0, 1, 2].map((k) => `<rect x="${4.6 + k * 2.9}" y="11" width="2.6" height="2.6" fill="${['#c4362c', '#3e6b4a', '#d39b2a'][k]}"/>`).join('')}
    <path d="M2.4 13.6 h19.2" stroke="${GOLD.base}" stroke-width=".8"/>`,
};

// Preuves sinistres des méfaits.
export const GRIM_ART = {
  couteau: () => `
    <path d="M1 28.4 h22 v3.6 h-22 z" fill="#3a2414"/><path d="M1 28.4 h22" stroke="#5a3a22" stroke-width="1"/>
    <path d="M12 28.6 l-3.4 2.8 M12.4 28.6 l3.8 2.4 M12.2 28.8 l.6 3" stroke="#1a0f08" stroke-width=".7"/>
    <path d="M10.6 14.6 h2.8 l-.2 14.4 l-1.2 .4 l-1.2 -.4 z" fill="#c9ced6"/><path d="M12 14.6 v14.6" stroke="#eef1f5" stroke-width=".6"/>
    <rect x="9.2" y="13" width="5.6" height="1.8" rx=".5" fill="#8a929d"/>
    <rect x="10.4" y="3.4" width="3.2" height="9.8" rx="1.2" fill="#1d1d1d"/>
    ${[5.6, 8.2, 10.8].map((y) => `<circle cx="12" cy="${y}" r=".55" fill="#c9ced6"/>`).join('')}
    <circle cx="12" cy="3.2" r="1.4" fill="#8a929d"/>`,
  passeur: () => `
    <rect x="3.6" y="21.4" width="15" height="9.6" rx="1" fill="#2a2a3a" transform="rotate(-6 11 26)"/>
    <rect x="4.6" y="17.6" width="15" height="9.6" rx="1" fill="#1f3a5a" transform="rotate(4 12 22)"/>
    <rect x="4.2" y="13.2" width="15" height="9.6" rx="1" fill="#7a1f2a" transform="rotate(-3 12 18)"/>
    <circle cx="11.6" cy="17.8" r="2.6" fill="none" stroke="#d9b44a" stroke-width=".8"/><path d="M10.2 17.8 h2.8 M11.6 16.4 v2.8" stroke="#d9b44a" stroke-width=".6"/>
    <circle cx="16.4" cy="11.4" r="4" fill="none" stroke="#c4362c" stroke-width="1.2" opacity=".85"/><path d="M14 11.4 h4.8" stroke="#c4362c" stroke-width="1" opacity=".85"/>`,
  embargo: () => `
    <path d="M4 6 h16 v19 l-2 -1.4 l-2 1.6 l-2 -1.4 l-2 1.6 l-2 -1.4 l-2 1.6 l-2 -1.4 l-2 1.2 z" fill="#efe6d2"/>
    ${[9, 11.4, 13.8].map((y) => `<rect x="6.4" y="${y}" width="11" height=".8" fill="#b9ae96"/>`).join('')}
    <rect x="5.6" y="16" width="12.8" height="5" fill="none" stroke="#c4362c" stroke-width="1.2" transform="rotate(-10 12 18.5)"/>
    <path d="M6 21.6 l12 -6" stroke="#c4362c" stroke-width="1.2"/>
    <circle cx="17.6" cy="26.8" r="2.8" fill="#9c1f1f"/><path d="M16 25.4 l3.2 2.8 M19.2 25.2 l-1.2 1.4" stroke="#5a0f0f" stroke-width=".7"/>
    <path d="M20.2 28.8 l1.4 1.6 l-1.8 .4 z" fill="#9c1f1f"/>`,
  marionnettiste: () => `
    <rect x="4" y="3.6" width="16" height="2.2" rx=".8" fill="#6b4a2e"/><rect x="10.9" y="0.8" width="2.2" height="9" rx=".8" fill="#5a3a22"/>
    <path d="M5 5.8 L8.6 18.2 M19 5.8 L15.4 18.2 M12 9.6 V14.4 M8 5.8 L10 25.4 M16 5.8 L14 25.4" stroke="#cfc6b0" stroke-width=".45"/>
    <circle cx="12" cy="15.6" r="1.8" fill="#e8d2b0"/>
    <path d="M10.6 17.6 h2.8 l.4 5 h-3.6 z" fill="#7a1f2a"/>
    <path d="M10.6 18 L8.6 18.4 M13.4 18 L15.4 18.4" stroke="#7a1f2a" stroke-width="1"/>
    <path d="M11 22.6 L10 25.4 M13 22.6 L14 25.4" stroke="#2b2b2b" stroke-width="1"/>
    <path d="M1 29 h22 v3 h-22 z" fill="#3a2414"/>`,
  ennemi: () => `
    <rect x="3.4" y="3" width="17.2" height="24" fill="#e9dcbc"/><rect x="3.4" y="3" width="17.2" height="24" fill="none" stroke="#b9a578" stroke-width=".6"/>
    <circle cx="12" cy="1.8" r="1.1" fill="#8a929d"/>
    <rect x="5.4" y="5" width="13.2" height="2.2" fill="#3a2414"/>
    <circle cx="12" cy="13" r="3.4" fill="#2b2b2b"/><path d="M5.8 21.4 q6.2 -6.6 12.4 0 z" fill="#2b2b2b"/>
    <path d="M6.4 9.6 l11.2 11.4 M17.6 9.6 l-11.2 11.4" stroke="#c4362c" stroke-width="1.4"/>
    <rect x="5.4" y="23" width="13.2" height="1.4" fill="#3a2414"/>
    <circle cx="16.4" cy="16.4" r=".8" fill="#1a1a1a"/><circle cx="8" cy="18.6" r=".7" fill="#1a1a1a"/>`,
  fossoyeur: () => `
    <path d="M5.4 29.6 v-14 a6.6 6.6 0 0 1 13.2 0 v14 z" fill="#8a8f96"/><path d="M5.4 29.6 v-14 a6.6 6.6 0 0 1 6.6 -6.6 v20.6 z" fill="#9aa0a7"/>
    <circle cx="12" cy="16.2" r="2.6" fill="none" stroke="#5c6168" stroke-width=".9"/><path d="M12 13.6 v5.4 M10.2 17.8 q1.8 1.8 3.6 0" stroke="#5c6168" stroke-width=".8" fill="none"/>
    <path d="M14.6 21 l-1.4 2.6 l1 1.4" stroke="#5c6168" stroke-width=".6" fill="none"/>
    <path d="M3 29.6 h18 v2.4 h-18 z" fill="#4a3a24"/>
    <path d="M20.6 6 l-2.4 20" stroke="#6b4a2e" stroke-width="1.2"/><path d="M17.4 25.4 l2.4 .4 l-.6 4.2 l-3 -.4 z" fill="#8a929d"/><rect x="19.4" y="4.6" width="3.2" height="1.4" rx=".6" fill="#6b4a2e" transform="rotate(8 21 5.3)"/>`,
};

// Un dessin seul (SVG complet), pour les fiches et les scènes.
export function honourSVG(kind, id, { size = 64, dim = false } = {}) {
  const art = (kind === 'evil' ? GRIM_ART : TROPHY_ART)[id];
  const inner = art ? art() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="${Math.round(size * 0.75)}" height="${size}" role="img" aria-hidden="true">${dim ? `<g opacity=".18" filter="grayscale(1)">${inner}</g>` : inner}</svg>`;
}
// Un dessin à poser dans une autre image (étagère du bureau) : x, y = coin haut gauche, h = hauteur.
export function honourPlaced(kind, id, x, y, h) {
  const art = (kind === 'evil' ? GRIM_ART : TROPHY_ART)[id];
  if (!art) return '';
  const k = h / 32;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})">${art()}</g>`;
}
