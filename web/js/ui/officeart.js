// Le bureau de la compagnie : cinq décors qui s'embellissent avec la valeur nette.
import { logoMarkup } from './logos.js';
import { shipSVG } from './shipart.js';

// half : seuil où la musique passe à la seconde chanson du niveau (niveauNb.mp3), à
// mi-parcours en temps de jeu (la valeur nette croît à peu près géométriquement).
export const OFFICE_TIERS = [
  { min: 0, half: 9e6, name: 'Le cagibi du quai', text: 'Un bureau de fortune au bout du quai. Tout commence ici.' },
  { min: 10e6, half: 17e6, name: 'Le bureau sur le port', text: 'Une vraie fenêtre sur le port et des dossiers bien rangés.' },
  { min: 30e6, half: 55e6, name: 'Le siège de la compagnie', text: 'Boiseries, tableaux de navires et maquette sur le bureau.' },
  { min: 100e6, half: 175e6, name: 'L\'étage de direction', text: 'Une baie vitrée sur tout le port. Les banquiers vous appellent.' },
  { min: 300e6, half: 600e6, name: 'La tour de verre', text: 'Le sommet d\'une tour. Le port entier à vos pieds.' },
];
// Morceau de la partie : 0 à 9 (deux par niveau).
export function musicStep(netWorth) {
  const t = officeTier(netWorth);
  return t * 2 + (netWorth >= OFFICE_TIERS[t].half ? 1 : 0);
}

export function officeTier(netWorth) {
  let k = 0;
  OFFICE_TIERS.forEach((t, i) => { if (netWorth >= t.min) k = i; });
  return k;
}

const f = (n) => Math.round(n * 10) / 10;

// Vue du port à travers une fenêtre (clip), selon l'heure : jour, fin d'après-midi, crépuscule.
function harborView(id, x, y, w, h, mood, detail) {
  const sky = { day: ['#a9cfe3', '#e6efe9'], gold: ['#f2c58f', '#f6e3c3'], dusk: ['#2a3b5c', '#d27d5b'] }[mood];
  const sea = { day: '#5f8ea6', gold: '#7a8f97', dusk: '#2d4058' }[mood];
  const sil = { day: '#6e7f86', gold: '#6b6460', dusk: '#1d2533' }[mood];
  const horizon = y + h * 0.62;
  let s = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">`;
  s += `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}s)"/>`;
  if (mood === 'gold') s += `<circle cx="${f(x + w * 0.78)}" cy="${f(horizon - h * 0.12)}" r="${f(h * 0.1)}" fill="#fbe2a8"/>`;
  if (mood === 'dusk') for (let k = 0; k < 14; k++) s += `<circle cx="${f(x + ((k * 37) % w))}" cy="${f(y + ((k * 17) % (h * 0.4)))}" r=".7" fill="#fff" opacity=".8"/>`;
  // Ville lointaine pour les étages élevés.
  if (detail >= 3) {
    for (let k = 0; k < 18; k++) {
      const bw = 6 + ((k * 7) % 9), bh = 8 + ((k * 13) % 26), bx = x + ((k * 29) % w);
      s += `<rect x="${f(bx)}" y="${f(horizon - bh)}" width="${bw}" height="${bh}" fill="${sil}" opacity=".7"/>`;
      if (mood === 'dusk') for (let j = 0; j < 3; j++) s += `<rect x="${f(bx + 1.5 + j * 1.8)}" y="${f(horizon - bh + 3 + j * 4)}" width="1" height="1.2" fill="#ffd27a" opacity=".85"/>`;
    }
  }
  s += `<rect x="${x}" y="${f(horizon)}" width="${w}" height="${f(h * 0.38)}" fill="${sea}"/>`;
  // Portiques à conteneurs et grues.
  for (let k = 0; k < (detail >= 2 ? 4 : 2); k++) {
    const gx = x + w * (0.12 + k * 0.22), gh = h * (0.22 + (k % 2) * 0.06);
    s += `<path d="M${f(gx)} ${f(horizon)} v${f(-gh)} h${f(w * 0.06)} v${f(gh)} M${f(gx - w * 0.03)} ${f(horizon - gh)} h${f(w * 0.12)}" stroke="${mood === 'dusk' ? '#c2583c' : '#b5502f'}" stroke-width="2" fill="none" opacity=".85"/>`;
  }
  // Un cargo qui passe.
  const sx = x + w * 0.45, sy = horizon + h * 0.08;
  s += `<path d="M${f(sx)} ${f(sy)} h${f(w * 0.32)} l${f(-w * 0.03)} ${f(h * 0.05)} h${f(-w * 0.27)} z" fill="${sil}"/>`;
  s += `<rect x="${f(sx + w * 0.02)}" y="${f(sy - h * 0.06)}" width="${f(w * 0.04)}" height="${f(h * 0.06)}" fill="${sil}"/>`;
  s += `<rect x="${f(sx + w * 0.08)}" y="${f(sy - h * 0.035)}" width="${f(w * 0.2)}" height="${f(h * 0.035)}" fill="${mood === 'dusk' ? '#5b4a6a' : '#a2653f'}"/>`;
  s += '</g>';
  return s;
}

function frame(x, y, w, h, inner, color = '#6b4a2e') {
  return `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" fill="${color}"/>${inner}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-opacity=".2"/>`;
}

function logoSign(x, y, size, color, logo, plate = '#fbf8f1') {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.12}" fill="${plate}" stroke="#000" stroke-opacity=".15"/>
    <circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 0.4}" fill="${color}"/>
    <g transform="translate(${f(x + size * 0.18)} ${f(y + size * 0.18)}) scale(${f((size * 0.64) / 64)})" color="#fff">${logoMarkup(logo)}</g>`;
}

function plant(x, y, s = 1) {
  return `<path d="M${x} ${y} l${-6 * s} ${-14 * s} M${x} ${y} l${2 * s} ${-18 * s} M${x} ${y} l${8 * s} ${-13 * s} M${x} ${y} l${-1 * s} ${-12 * s}" stroke="#4d7a4f" stroke-width="${3 * s}" stroke-linecap="round"/>
    <ellipse cx="${x - 6 * s}" cy="${y - 15 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#5d9160"/><ellipse cx="${x + 2 * s}" cy="${y - 19 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#4f8653"/><ellipse cx="${x + 8 * s}" cy="${y - 14 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#5d9160"/>
    <path d="M${x - 7 * s} ${y} h${14 * s} l${-2 * s} ${12 * s} h${-10 * s} z" fill="#b2603a"/>`;
}

function books(x, y, w, h, rows = 3) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#7a5434"/>`;
  const rh = h / rows;
  const cols = ['#8c2f2f', '#2f4f6f', '#3e6b4a', '#a1782f', '#5d4a7a', '#6f6f6f', '#b45a2c'];
  for (let r = 0; r < rows; r++) {
    let bx = x + 3, k = r * 3;
    while (bx < x + w - 6) {
      const bw = 3 + (k % 3), bh = rh - 5 - (k % 4);
      s += `<rect x="${bx}" y="${f(y + r * rh + rh - bh - 2)}" width="${bw}" height="${f(bh)}" fill="${cols[k % cols.length]}"/>`;
      bx += bw + 0.6; k++;
    }
    s += `<rect x="${x}" y="${f(y + (r + 1) * rh - 2)}" width="${w}" height="2" fill="#5a3c24"/>`;
  }
  return s;
}

/**
 * tier : 0..4 ; opts : color, logo (compagnie), model : { typeId, color, logo, name } (plus beau navire).
 */
export function officeSVG(tier, { color = '#1e3a55', logo = 'ancre', model = null, uid = 'of' } = {}) {
  const W = 480, H = 200, floorY = 158;
  const id = uid + tier;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${OFFICE_TIERS[tier].name}">`;
  const modelSvg = (x, y, w) => model ? shipSVG(model.typeId, { ...model, sky: false, water: false, fit: true, condition: 100, age: 0, laden: false, attrs: `x="${x}" y="${y}" width="${w}" height="${f(w * 110 / 400)}"` }) : '';

  if (tier === 0) {
    // Le cagibi : murs défraîchis, petite fenêtre, bureau en métal, ampoule nue.
    s += `<rect width="${W}" height="${floorY}" fill="#b9bea7"/><rect y="${floorY - 26}" width="${W}" height="26" fill="#a5aa93"/>`;
    s += `<path d="M60 20 q10 30 -4 60" stroke="#8f9480" stroke-width="5" opacity=".25" fill="none"/><circle cx="400" cy="40" r="22" fill="#9da28d" opacity=".35"/>`;
    s += harborView(id + 'w', 300, 34, 92, 64, 'day', 1);
    s += `<rect x="296" y="30" width="100" height="72" fill="none" stroke="#e8e3d4" stroke-width="5"/><line x1="346" y1="32" x2="346" y2="100" stroke="#e8e3d4" stroke-width="3"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#8d6a48"/>${Array.from({ length: 12 }, (_, k) => `<line x1="${k * 42}" y1="${floorY}" x2="${k * 42 - 20}" y2="${H}" stroke="#6f5236" stroke-width="1.5"/>`).join('')}`;
    s += `<rect x="30" y="72" width="44" height="86" fill="#7f8a8c"/><rect x="34" y="78" width="36" height="22" fill="#909b9d"/><rect x="34" y="104" width="36" height="22" fill="#909b9d"/><rect x="34" y="130" width="36" height="22" fill="#909b9d"/>${[89, 115, 141].map((yy) => `<rect x="48" y="${yy}" width="8" height="3" fill="#56605f"/>`).join('')}`;
    s += `<rect x="140" y="110" width="150" height="8" fill="#8a9396"/><rect x="146" y="118" width="6" height="40" fill="#6d7578"/><rect x="278" y="118" width="6" height="40" fill="#6d7578"/>`;
    s += `<rect x="160" y="80" width="40" height="30" rx="3" fill="#d7d2c2"/><rect x="164" y="84" width="32" height="20" fill="#5c7d6e"/><rect x="172" y="110" width="16" height="3" fill="#bdb7a6"/>`;
    s += `<rect x="225" y="100" width="30" height="10" fill="#f1ede1"/><rect x="228" y="96" width="26" height="4" fill="#e8e3d4"/><path d="M262 104 h16 v6 h-16 z" fill="#2b2b2b"/>`;
    s += `<line x1="210" y1="0" x2="210" y2="28" stroke="#333"/><circle cx="210" cy="32" r="6" fill="#fff4c2"/><circle cx="210" cy="32" r="14" fill="#fff4c2" opacity=".25"/>`;
    s += `<rect x="96" y="40" width="34" height="40" fill="#f6f2e6" transform="rotate(-4 113 60)"/><rect x="100" y="46" width="26" height="5" fill="#c4362c" transform="rotate(-4 113 60)"/>`;
    s += logoSign(420, 52, 36, color, logo, '#f6f2e6');
    s += `<path d="M115 158 l14 -40 h20 l6 40" fill="#4c4a46"/><rect x="120" y="112" width="34" height="8" rx="3" fill="#5a5753"/>`;
  } else if (tier === 1) {
    s += `<rect width="${W}" height="${floorY}" fill="#e8dcc0"/><rect y="${floorY - 6}" width="${W}" height="6" fill="#cdbd98"/>`;
    s += harborView(id + 'w', 250, 26, 170, 92, 'day', 2);
    s += `<rect x="246" y="22" width="178" height="100" fill="none" stroke="#fbf8f1" stroke-width="6"/><line x1="335" y1="24" x2="335" y2="120" stroke="#fbf8f1" stroke-width="4"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#a07b55"/>`;
    s += books(24, 40, 70, 118, 4);
    s += frame(110, 36, 90, 54, `<rect x="110" y="36" width="90" height="54" fill="#cfe1e8"/><path d="M118 50 q10 -6 20 2 t18 -2 v18 q-12 6 -24 0 z M160 46 q12 -2 20 8 t14 6 v14 h-30 z" fill="#e9dcb7"/>`, '#5a3c24');
    s += `<rect x="150" y="112" width="200" height="10" fill="#7a5434"/><rect x="156" y="122" width="10" height="36" fill="#5f4128"/><rect x="334" y="122" width="10" height="36" fill="#5f4128"/><rect x="172" y="122" width="70" height="30" fill="#6b4a2e"/>`;
    s += `<rect x="255" y="82" width="44" height="28" rx="2" fill="#2c3a44"/><rect x="258" y="85" width="38" height="22" fill="#5b88a0"/><rect x="273" y="110" width="8" height="3" fill="#2c3a44"/>`;
    s += `<rect x="190" y="104" width="34" height="8" fill="#f1ede1"/><rect x="310" y="100" width="14" height="12" fill="#c4362c"/>`;
    s += plant(445, 146, 1.1);
    s += logoSign(438, 40, 34, color, logo);
    s += `<path d="M215 158 l10 -36 h30 l8 36" fill="#3e3a36"/><rect x="220" y="116" width="40" height="9" rx="4" fill="#4a4540"/>`;
  } else if (tier === 2) {
    // Le siège : boiseries, tableau de navire, maquette, tapis.
    s += `<rect width="${W}" height="${floorY}" fill="#d9cdb2"/><rect y="88" width="${W}" height="${floorY - 88}" fill="#8a5d3b"/>${Array.from({ length: 10 }, (_, k) => `<rect x="${k * 50 + 8}" y="96" width="34" height="${floorY - 104}" fill="none" stroke="#6f4a2e" stroke-width="2"/>`).join('')}<rect y="86" width="${W}" height="5" fill="#6f4a2e"/>`;
    s += harborView(id + 'w', 290, 14, 160, 70, 'gold', 2);
    s += `<rect x="286" y="10" width="168" height="78" fill="none" stroke="#efe6d2" stroke-width="6"/><line x1="370" y1="12" x2="370" y2="86" stroke="#efe6d2" stroke-width="4"/>`;
    s += frame(40, 16, 96, 60, `<rect x="40" y="16" width="96" height="60" fill="#d8c79c"/><rect x="40" y="52" width="96" height="24" fill="#5b7f8a"/><path d="M58 52 h52 l-6 8 h-42 z" fill="#3a2d23"/><path d="M80 52 v-26 M70 50 l10 -22 l10 22 z" fill="#efe6d2" stroke="#3a2d23" stroke-width=".6"/>`, '#a57a2c');
    s += logoSign(176, 22, 50, color, logo, '#efe6d2');
    s += `<ellipse cx="240" cy="182" rx="170" ry="14" fill="#7d2f2f"/><ellipse cx="240" cy="182" rx="150" ry="10" fill="none" stroke="#c99a5b" stroke-width="2"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#5f3f27" opacity=".0"/>`;
    s += `<rect x="120" y="112" width="250" height="12" fill="#5a3a22"/><rect x="128" y="124" width="70" height="34" fill="#4a2f1b"/><rect x="292" y="124" width="70" height="34" fill="#4a2f1b"/>`;
    s += modelSvg(140, 74, 140);
    s += `<rect x="300" y="100" width="40" height="12" fill="#f1ede1"/><circle cx="355" cy="104" r="8" fill="#3d6a8c"/><path d="M349 100 q6 2 12 0 M348 106 q7 2 14 0" stroke="#d9c88f" fill="none"/><rect x="353" y="112" width="4" height="2" fill="#2b2b2b"/>`;
    s += `<path d="M215 160 l10 -40 h36 l8 40" fill="#3a1f14"/><rect x="220" y="96" width="44" height="34" rx="8" fill="#5a2a1c"/>`;
    s += plant(30, 146, 1.2);
  } else if (tier === 3) {
    // L'étage de direction : baie vitrée panoramique sur le port.
    s += `<rect width="${W}" height="${floorY}" fill="#e9e4da"/>`;
    s += harborView(id + 'w', 16, 12, 448, 118, 'gold', 3);
    for (let k = 1; k < 5; k++) s += `<rect x="${16 + k * 89.6 - 2}" y="12" width="4" height="118" fill="#f6f3ec"/>`;
    s += `<rect x="12" y="8" width="456" height="126" fill="none" stroke="#f6f3ec" stroke-width="7"/>`;
    s += `<rect y="${floorY - 24}" width="${W}" height="24" fill="#d9d2c4"/><rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#b9a585"/>`;
    s += `<rect x="150" y="118" width="230" height="10" rx="2" fill="#3b3330"/><rect x="160" y="128" width="8" height="30" fill="#2c2623"/><rect x="362" y="128" width="8" height="30" fill="#2c2623"/>`;
    s += modelSvg(250, 82, 130);
    s += `<rect x="180" y="96" width="46" height="22" rx="2" fill="#1f2a33"/><rect x="183" y="99" width="40" height="16" fill="#3f7d8a"/><polyline points="185,112 192,108 199,110 206,104 213,106 220,101" stroke="#c4f1b0" fill="none" stroke-width="1.2"/>`;
    s += `<path d="M230 160 l8 -38 h40 l8 38" fill="#232020"/><rect x="236" y="92" width="46" height="36" rx="10" fill="#2f2b29"/>`;
    s += logoSign(30, 140, 38, color, logo);
    s += plant(450, 146, 1.3);
  } else {
    // La tour de verre : sommet d'une tour au crépuscule, écrans, longue-vue.
    s += `<rect width="${W}" height="${H}" fill="#1b2433"/>`;
    s += harborView(id + 'w', 0, 0, W, 150, 'dusk', 4);
    for (let k = 1; k < 6; k++) s += `<rect x="${k * 80 - 1.5}" y="0" width="3" height="150" fill="#0f141c" opacity=".8"/>`;
    s += `<rect y="0" width="${W}" height="6" fill="#0f141c"/><rect y="148" width="${W}" height="${H - 148}" fill="#2a2f36"/><rect y="148" width="${W}" height="3" fill="#4a535e"/>`;
    s += `<g opacity=".18" transform="translate(196 24) scale(1.4)" color="#fff">${logoMarkup(logo)}</g>`;
    s += `<path d="M120 132 q120 -18 240 0 v8 q-120 -14 -240 0 z" fill="#d9d4ca"/><rect x="150" y="138" width="8" height="24" fill="#8c8c8c"/><rect x="322" y="138" width="8" height="24" fill="#8c8c8c"/>`;
    for (let k = 0; k < 3; k++) {
      const x = 170 + k * 52;
      s += `<rect x="${x}" y="98" width="46" height="28" rx="2" fill="#0d1218"/><rect x="${x + 2}" y="100" width="42" height="24" fill="#123247"/>`;
      s += `<polyline points="${x + 4},${120 - k * 2} ${x + 12},${114} ${x + 20},${117} ${x + 28},${108 - k * 3} ${x + 40},${104}" stroke="${['#7fe0c4', '#f6c26b', '#ff8a7a'][k]}" fill="none" stroke-width="1.3"/>`;
    }
    s += `<rect x="14" y="128" width="130" height="34" fill="#3a3f47"/><rect x="14" y="126" width="130" height="4" fill="#5a636e"/>`;
    s += modelSvg(20, 101, 100);
    s += `<path d="M420 160 l-6 -28 M420 160 l8 -28 M420 160 l-1 -30" stroke="#a7a7a7" stroke-width="2"/><rect x="398" y="120" width="44" height="7" rx="3" fill="#c9b27a" transform="rotate(-18 420 124)"/>`;
    s += `<path d="M228 168 l6 -34 h36 l6 34" fill="#e8e3da"/><rect x="232" y="104" width="44" height="36" rx="10" fill="#f2efe8"/>`;
    s += logoSign(440, 156, 30, color, logo, '#e8e3da');
  }
  s += '</svg>';
  return s;
}
