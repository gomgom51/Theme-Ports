// Le bureau de la compagnie : cinq décors qui s'embellissent avec la valeur nette.
import { logoMarkup, emblemInk } from './logos.js';
import { shipSVG } from './shipart.js';
import { OFFICE_TIERS, officeTier } from '../data/offices.js';
import { honourPlaced } from './trophyart.js';
import { RECORD_IDS, EVIL_IDS } from '../sim/honours.js';

// half : seuil où la musique passe à la seconde chanson du niveau (niveauNb.mp3).
// Sous LOW (la compagnie a perdu de l'argent depuis ses débuts), thème du niveau 0.
export const MUSIC_LOW = 5e6;
export { OFFICE_TIERS, officeTier };
// Morceau de la partie : -1 (niveau 0, la compagnie perd de l'argent), puis 0 à 9 (deux par niveau).
// level : niveau déjà atteint (company.level). Un niveau atteint est acquis : en repassant
// sous son seuil, on garde son bureau et sa musique (la première chanson du niveau) ; seul le
// niveau 0 (sous MUSIC_LOW) ramène au cagibi et au thème du doute.
export function musicStep(netWorth, level = 0) {
  if (netWorth < MUSIC_LOW) return -1;
  const t = Math.max(level, officeTier(netWorth));
  return t * 2 + (netWorth >= OFFICE_TIERS[t].half ? 1 : 0);
}
// Niveau atteint par la compagnie (0 à 4), et bureau affiché (le cagibi au niveau 0).
export const reachedTier = (company, netWorth) => Math.max(company?.level ?? 0, officeTier(netWorth));
export const shownTier = (company, netWorth) => (netWorth < MUSIC_LOW ? 0 : reachedTier(company, netWorth));


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
    <g transform="translate(${f(x + size * 0.18)} ${f(y + size * 0.18)}) scale(${f((size * 0.64) / 64)})" color="${emblemInk(color)}">${logoMarkup(logo)}</g>`;
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


// ---------- Le bureau de l'ombre (compagnie sur la liste noire) ----------
// Les patrons de l'ombre sont riches et tiennent à ce que ça se voie : velours, dorures, lustre en
// cristal, tapis léopard, buste doré du patron, coffre-fort plein, whisky et cigare, portrait en
// majesté, carte aux routes rouges. Et derrière les fenêtres, c'est toujours la nuit.
const GOLD = '#c9a24a';
function shadowDefs(u) {
  return `<defs>
    <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".45" stop-color="#e0ae35"/><stop offset="1" stop-color="#835810"/></linearGradient>
    <linearGradient id="${u}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a0610"/><stop offset=".3" stop-color="#931628"/><stop offset=".55" stop-color="#560a16"/><stop offset=".8" stop-color="#8a1426"/><stop offset="1" stop-color="#4a0812"/></linearGradient>
    <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9aa1a8"/><stop offset=".5" stop-color="#4d535b"/><stop offset="1" stop-color="#202429"/></linearGradient>
    <linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1020"/><stop offset="1" stop-color="#2c040b"/></linearGradient>
    <linearGradient id="${u}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a42"/><stop offset=".5" stop-color="#16161a"/><stop offset="1" stop-color="#2a2a30"/></linearGradient>
    <radialGradient id="${u}l"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".6"/><stop offset=".5" stop-color="#ffd27a" stop-opacity=".18"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}p" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#e8b65a"/><stop offset="1" stop-color="#b9862f"/></radialGradient>
    <pattern id="${u}d" width="18" height="22" patternUnits="userSpaceOnUse"><path d="M9 3 q3.5 4 0 8 q-3.5 -4 0 -8 M9 11 q4.5 1.5 3.5 6.5 M9 11 q-4.5 1.5 -3.5 6.5 M9 11 v7 M0 14 q2 -2 0 -4 M18 14 q-2 -2 0 -4" stroke="${GOLD}" fill="none" stroke-width=".7" opacity=".32"/></pattern>
  </defs>`;
}
// La nuit derrière une fenêtre : ciel sombre, lune, lumières du port et reflet sur l'eau.
function night(x, y, w, h, moon = 0.2) {
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#050817" opacity=".66"/>`;
  const mx = x + w * moon, my = y + h * 0.22, mr = Math.max(4, Math.min(10, h * 0.09));
  o += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * 2.6)}" fill="#dfe6ff" opacity=".08"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="#f2efdc"/><circle cx="${f(mx + mr * 0.3)}" cy="${f(my - mr * 0.25)}" r="${f(mr * 0.22)}" fill="#d9d4bd"/><circle cx="${f(mx - mr * 0.35)}" cy="${f(my + mr * 0.3)}" r="${f(mr * 0.16)}" fill="#d9d4bd"/>`;
  o += `<path d="M${f(mx - mr * 0.6)} ${f(y + h * 0.66)} h${f(mr * 1.2)} M${f(mx - mr * 0.4)} ${f(y + h * 0.74)} h${f(mr * 0.8)} M${f(mx - mr * 0.2)} ${f(y + h * 0.82)} h${f(mr * 0.4)}" stroke="#f2efdc" stroke-width="1" opacity=".5"/>`;
  for (let k = 0; k < Math.round(w / 9); k++) {
    const lx = x + 3 + ((k * 53) % (w - 6)), ly = y + h * (0.5 + ((k * 7) % 11) / 100);
    o += `<rect x="${f(lx)}" y="${f(ly)}" width="1.2" height="1.2" fill="${k % 4 ? '#ffcf6e' : '#ff7a5c'}" opacity=".9"/>`;
  }
  for (let k = 0; k < Math.round(w / 14); k++) o += `<circle cx="${f(x + ((k * 41 + 7) % w))}" cy="${f(y + 2 + ((k * 23) % (h * 0.35)))}" r=".6" fill="#fff" opacity=".75"/>`;
  return o;
}
// Rideaux de velours retenus par des embrasses dorées, sous une cantonnière à franges.
function curtains(u, x, y, w, h) {
  const pw = Math.max(13, Math.min(24, w * 0.09)), tieY = y + h * 0.56;
  const pan = (x0, sg) => {
    const X = (d) => f(x0 + d * sg);
    let o = `<path d="M${X(-7)} ${y - 2} L${X(pw)} ${y - 2} Q${X(pw * 0.6)} ${f(tieY - h * 0.22)} ${X(pw * 0.32)} ${f(tieY)} Q${X(pw * 0.85)} ${f(y + h * 0.8)} ${X(pw * 1.2)} ${f(y + h)} L${X(-7)} ${f(y + h)} Z" fill="url(#${u}v)"/>`;
    for (const d of [0.15, 0.45, 0.75]) o += `<path d="M${X(pw * d)} ${y} Q${X(pw * d * 0.7)} ${f(tieY - h * 0.15)} ${X(pw * (0.1 + d * 0.25))} ${f(tieY)} Q${X(pw * (0.2 + d * 0.7))} ${f(y + h * 0.82)} ${X(pw * (0.15 + d))} ${f(y + h)}" stroke="#2a030a" stroke-width="1" fill="none" opacity=".55"/>`;
    o += `<path d="M${X(-6)} ${f(tieY - 1.5)} Q${X(pw * 0.15)} ${f(tieY + 2.5)} ${X(pw * 0.45)} ${f(tieY - 1)}" stroke="url(#${u}g)" stroke-width="2.4" fill="none"/>`;
    o += `<circle cx="${X(pw * 0.45)}" cy="${f(tieY)}" r="2" fill="url(#${u}g)"/><path d="M${X(pw * 0.45 - 1.5)} ${f(tieY + 1.5)} l-0.6 7 h4.2 l-0.6 -7 z" fill="${GOLD}"/><path d="M${X(pw * 0.45 - 2)} ${f(tieY + 8.5)} h4" stroke="#8a6418" stroke-width="1"/>`;
    return o;
  };
  let o = pan(x, 1) + pan(x + w, -1);
  // cantonnière : festons de velours, galon et franges dorés
  const n = Math.max(3, Math.round((w + 16) / 34)), sw = (w + 16) / n, vy = y - 2;
  let d = `M${f(x - 8)} ${f(vy - 9)} H${f(x + w + 8)} V${f(vy)}`;
  for (let k = n - 1; k >= 0; k--) d += ` Q${f(x - 8 + (k + 0.5) * sw)} ${f(vy + 9)} ${f(x - 8 + k * sw)} ${f(vy)}`;
  o += `<path d="${d} Z" fill="url(#${u}r)"/><rect x="${f(x - 8)}" y="${f(vy - 10)}" width="${f(w + 16)}" height="2.4" fill="url(#${u}g)"/>`;
  let fr = `M${f(x - 8)} ${f(vy)}`;
  for (let k = 0; k < n; k++) fr += ` Q${f(x - 8 + (k + 0.5) * sw)} ${f(vy + 9)} ${f(x - 8 + (k + 1) * sw)} ${f(vy)}`;
  o += `<path d="${fr}" stroke="${GOLD}" stroke-width="1.6" stroke-dasharray="1 .8" fill="none"/>`;
  for (let k = 0; k <= n; k++) o += `<circle cx="${f(x - 8 + k * sw)}" cy="${f(vy + 1)}" r="1.6" fill="url(#${u}g)"/><path d="M${f(x - 8 + k * sw)} ${f(vy + 2)} v4" stroke="${GOLD}" stroke-width="1.4"/>`;
  return o;
}
// Lustre à pampilles de cristal et bougies.
function chandelier(u, cx, top, s = 1) {
  const y = top + 12 * s, P = (v) => f(v);
  let o = `<circle cx="${cx}" cy="${P(y + 6 * s)}" r="${P(34 * s)}" fill="url(#${u}l)"/>`;
  o += `<path d="M${cx} ${top} V${P(y - 2 * s)}" stroke="#a07c26" stroke-width="${P(1.1 * s)}" stroke-dasharray="${P(1.4 * s)} ${P(0.7 * s)}"/>`;
  o += `<path d="M${P(cx - 5 * s)} ${P(y - 2 * s)} h${P(10 * s)} l${P(-2 * s)} ${P(3 * s)} h${P(-6 * s)} z" fill="url(#${u}g)"/>`;
  // guirlandes de cristal entre les bras
  o += `<path d="M${P(cx - 15 * s)} ${P(y + 3 * s)} Q${P(cx - 7 * s)} ${P(y + 11 * s)} ${cx} ${P(y + 8 * s)} Q${P(cx + 7 * s)} ${P(y + 11 * s)} ${P(cx + 15 * s)} ${P(y + 3 * s)}" stroke="#e8f4ff" stroke-width="${P(0.8 * s)}" stroke-dasharray="${P(0.9 * s)} ${P(0.9 * s)}" fill="none" opacity=".9"/>`;
  for (const k of [-2, -1, 1, 2]) {
    const ex = cx + k * 7.5 * s, ey = y + (Math.abs(k) === 2 ? 1 : -1) * s;
    o += `<path d="M${cx} ${P(y + 7 * s)} Q${P(cx + k * 6 * s)} ${P(y + 13 * s)} ${P(ex)} ${P(ey + 2.5 * s)}" stroke="url(#${u}g)" stroke-width="${P(1.5 * s)}" fill="none"/>`;
    o += `<ellipse cx="${P(ex)}" cy="${P(ey + 2.5 * s)}" rx="${P(2.2 * s)}" ry="${P(0.9 * s)}" fill="${GOLD}"/>`;
    o += `<rect x="${P(ex - 0.8 * s)}" y="${P(ey - 2 * s)}" width="${P(1.6 * s)}" height="${P(4.2 * s)}" fill="#fbf6e6"/>`;
    o += `<circle cx="${P(ex)}" cy="${P(ey - 3.4 * s)}" r="${P(2.6 * s)}" fill="#ffd27a" opacity=".35"/><path d="M${P(ex)} ${P(ey - 5 * s)} q${P(1.1 * s)} ${P(1.6 * s)} 0 ${P(2.6 * s)} q${P(-1.1 * s)} ${P(-1 * s)} 0 ${P(-2.6 * s)} z" fill="#fff1b8"/>`;
    o += `<path d="M${P(ex)} ${P(ey + 3.4 * s)} l${P(-0.9 * s)} ${P(1.6 * s)} l${P(0.9 * s)} ${P(2 * s)} l${P(0.9 * s)} ${P(-2 * s)} z" fill="#dff0ff" stroke="#9fc6e6" stroke-width="${P(0.3 * s)}"/>`;
  }
  o += `<ellipse cx="${cx}" cy="${P(y + 7 * s)}" rx="${P(3.4 * s)}" ry="${P(4.2 * s)}" fill="url(#${u}g)"/><rect x="${P(cx - 0.8 * s)}" y="${P(y - 1 * s)}" width="${P(1.6 * s)}" height="${P(4 * s)}" fill="#fbf6e6"/><path d="M${cx} ${P(y - 3 * s)} q${P(1 * s)} ${P(1.4 * s)} 0 ${P(2.2 * s)} q${P(-1 * s)} ${P(-0.8 * s)} 0 ${P(-2.2 * s)} z" fill="#fff1b8"/>`;
  for (let k = -2; k <= 2; k++) o += `<path d="M${P(cx + k * 1.6 * s)} ${P(y + 11 * s)} v${P((3 - Math.abs(k)) * 1.6 * s)}" stroke="#e8f4ff" stroke-width="${P(0.7 * s)}" stroke-dasharray="${P(0.8 * s)} ${P(0.5 * s)}"/>`;
  o += `<path d="M${cx} ${P(y + 16 * s)} l${P(-1.4 * s)} ${P(2.4 * s)} l${P(1.4 * s)} ${P(3 * s)} l${P(1.4 * s)} ${P(-3 * s)} z" fill="#e8f4ff" stroke="#9fc6e6" stroke-width="${P(0.3 * s)}"/>`;
  return o;
}
// Tapis en peau de léopard (motif en rosettes, découpé dans une ellipse).
function leopardRug(u, cx, cy, rx, ry) {
  let o = `<clipPath id="${u}c"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
  o += `<ellipse cx="${cx}" cy="${f(cy + 1.5)}" rx="${rx + 2}" ry="${ry + 1.5}" fill="#000" opacity=".3"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${u}p)"/><g clip-path="url(#${u}c)">`;
  const n = Math.round((rx * ry) / 13);
  for (let k = 0; k < n; k++) {
    const px = cx - rx + ((k * 37.3 + (k % 7) * 3.1) % (2 * rx)), py = cy - ry + ((k * 5.7 + (k % 5) * 2.3) % (2 * ry));
    const r = 1.2 + (k % 4) * 0.25, a = (k * 47) % 360;
    if (k % 5 === 4) { o += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(r * 0.45)}" ry="${f(r * 0.3)}" fill="#24150a"/>`; continue; } // petite tache pleine
    // rosette : cœur fauve foncé, anneau noir brisé en trois ou quatre morceaux
    o += `<g transform="translate(${f(px)} ${f(py)}) rotate(${a}) scale(1 .7)"><circle r="${f(r * 0.62)}" fill="#a0661c"/>`;
    const parts = 3 + (k % 2);
    for (let j = 0; j < parts; j++) {
      const a0 = (j / parts) * Math.PI * 2 + 0.35, a1 = a0 + (Math.PI * 2 / parts) * 0.62;
      o += `<path d="M${f(Math.cos(a0) * r)} ${f(Math.sin(a0) * r)} A${f(r)} ${f(r)} 0 0 1 ${f(Math.cos(a1) * r)} ${f(Math.sin(a1) * r)}" stroke="#24150a" stroke-width="${f(r * 0.5)}" stroke-linecap="round" fill="none"/>`;
    }
    o += '</g>';
  }
  o += `</g><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#5a3a12" stroke-width="1.2" opacity=".7"/>`;
  return o;
}
// Buste doré du patron sur une colonne de marbre noir.
function goldBust(u, x, base, s = 1) {
  const P = (v) => f(v), top = base - 16 * s;
  let o = `<rect x="${P(x - 8 * s)}" y="${P(base - 2.5 * s)}" width="${P(16 * s)}" height="${P(2.5 * s)}" fill="#2c2c33"/><rect x="${P(x - 6 * s)}" y="${P(top + 2 * s)}" width="${P(12 * s)}" height="${P(12 * s)}" fill="url(#${u}m)"/>`;
  o += `<path d="M${P(x - 4 * s)} ${P(top + 4 * s)} q${P(3 * s)} ${P(3 * s)} ${P(1 * s)} ${P(8 * s)} M${P(x + 3 * s)} ${P(top + 3 * s)} q${P(-2 * s)} ${P(4 * s)} ${P(1.5 * s)} ${P(9 * s)}" stroke="#d8d8e0" stroke-width="${P(0.35 * s)}" fill="none" opacity=".5"/>`;
  o += `<rect x="${P(x - 7.5 * s)}" y="${P(top)}" width="${P(15 * s)}" height="${P(2.4 * s)}" fill="#2c2c33"/><rect x="${P(x - 7.5 * s)}" y="${P(top)}" width="${P(15 * s)}" height="${P(0.7 * s)}" fill="${GOLD}"/>`;
  // le buste : épaules, revers du costume, cou, tête, cheveux gominés, fine moustache
  o += `<path d="M${P(x - 9 * s)} ${P(top)} q${P(0.5 * s)} ${P(-6 * s)} ${P(5 * s)} ${P(-7.5 * s)} l${P(2 * s)} ${P(-1 * s)} h${P(4 * s)} l${P(2 * s)} ${P(1 * s)} q${P(4.5 * s)} ${P(1.5 * s)} ${P(5 * s)} ${P(7.5 * s)} z" fill="url(#${u}g)"/>`;
  o += `<path d="M${P(x - 2 * s)} ${P(top - 8.5 * s)} l${P(2 * s)} ${P(5 * s)} l${P(2 * s)} ${P(-5 * s)} M${P(x - 4 * s)} ${P(top - 7.5 * s)} l${P(3 * s)} ${P(7 * s)} M${P(x + 4 * s)} ${P(top - 7.5 * s)} l${P(-3 * s)} ${P(7 * s)}" stroke="#7a520e" stroke-width="${P(0.5 * s)}" fill="none"/>`;
  o += `<rect x="${P(x - 1.8 * s)}" y="${P(top - 11 * s)}" width="${P(3.6 * s)}" height="${P(3 * s)}" fill="#c08f26"/>`;
  o += `<ellipse cx="${x}" cy="${P(top - 15 * s)}" rx="${P(4 * s)}" ry="${P(5 * s)}" fill="url(#${u}g)"/>`;
  o += `<path d="M${P(x - 4.2 * s)} ${P(top - 16 * s)} q${P(0.5 * s)} ${P(-5 * s)} ${P(4.5 * s)} ${P(-4.6 * s)} q${P(3.6 * s)} ${P(0.3 * s)} ${P(3.9 * s)} ${P(3.2 * s)} q${P(-3 * s)} ${P(-2.6 * s)} ${P(-8.4 * s)} ${P(1.4 * s)} z" fill="#a8771a"/>`;
  o += `<path d="M${P(x - 1.8 * s)} ${P(top - 12.6 * s)} q${P(1.8 * s)} ${P(-0.8 * s)} ${P(3.6 * s)} 0" stroke="#7a520e" stroke-width="${P(0.6 * s)}" fill="none"/><ellipse cx="${P(x - 1.5 * s)}" cy="${P(top - 16 * s)}" rx="${P(1 * s)}" ry="${P(2 * s)}" fill="#fff6c8" opacity=".55"/>`;
  return o;
}
// Coffre-fort entrouvert : lingots d'or et liasses de billets.
function cash(x, y, s = 1) {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(7 * s)}" height="${f(3 * s)}" fill="#5f8f5a" stroke="#2f4f2c" stroke-width="${f(0.3 * s)}"/><rect x="${f(x + 2.8 * s)}" y="${f(y)}" width="${f(1.4 * s)}" height="${f(3 * s)}" fill="#efe6c8"/>`;
}
function safe(u, x, base, s = 1) {
  const P = (v) => f(v), w = 26 * s, h = 30 * s, y = base - h;
  let o = `<rect x="${P(x + 2 * s)}" y="${P(base - 1)}" width="${P(4 * s)}" height="${P(1.5 * s)}" fill="#111"/><rect x="${P(x + w - 6 * s)}" y="${P(base - 1)}" width="${P(4 * s)}" height="${P(1.5 * s)}" fill="#111"/>`;
  o += `<rect x="${P(x)}" y="${P(y)}" width="${P(w)}" height="${P(h - 1)}" rx="${P(1.5 * s)}" fill="url(#${u}s)" stroke="#15181b" stroke-width="${P(0.6 * s)}"/>`;
  o += `<rect x="${P(x + 2.5 * s)}" y="${P(y + 2.5 * s)}" width="${P(w - 5 * s)}" height="${P(h - 6 * s)}" fill="#141210"/>`;
  // étagères : lingots en haut, liasses en bas
  const ix = x + 3.5 * s, iw = w - 7 * s;
  o += `<rect x="${P(ix)}" y="${P(y + h * 0.5)}" width="${P(iw)}" height="${P(0.8 * s)}" fill="#3a3632"/>`;
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3 - r; k++) {
    const bx = ix + 0.6 * s + k * 6.2 * s + r * 3.1 * s, by = y + h * 0.5 - (r + 1) * 3.4 * s;
    o += `<path d="M${P(bx)} ${P(by + 3.2 * s)} l${P(1 * s)} ${P(-3.2 * s)} h${P(4 * s)} l${P(1 * s)} ${P(3.2 * s)} z" fill="url(#${u}g)" stroke="#7a520e" stroke-width="${P(0.3 * s)}"/>`;
  }
  for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) o += cash(ix + 0.8 * s + k * 8 * s + (r % 2) * 1.5 * s, y + h * 0.5 + 1.5 * s + r * 3.2 * s, s);
  // porte entrouverte (en perspective), volant et cadran
  o += `<path d="M${P(x + w)} ${P(y + 0.5 * s)} l${P(9 * s)} ${P(-3 * s)} v${P(h + 2 * s)} l${P(-9 * s)} ${P(-1.5 * s)} z" fill="url(#${u}s)" stroke="#15181b" stroke-width="${P(0.6 * s)}"/>`;
  o += `<ellipse cx="${P(x + w + 4.6 * s)}" cy="${P(y + h * 0.45)}" rx="${P(2.4 * s)}" ry="${P(3.6 * s)}" fill="#2a2e33" stroke="${GOLD}" stroke-width="${P(0.6 * s)}"/><path d="M${P(x + w + 4.6 * s)} ${P(y + h * 0.45 - 3 * s)} v${P(6 * s)} M${P(x + w + 2.6 * s)} ${P(y + h * 0.45)} h${P(4 * s)}" stroke="${GOLD}" stroke-width="${P(0.5 * s)}"/>`;
  o += `<rect x="${P(x + w + 3.6 * s)}" y="${P(y + h * 0.75)}" width="${P(2 * s)}" height="${P(1.2 * s)}" fill="${GOLD}"/>`;
  return o;
}
// Carafe de whisky, verre, et cigare qui fume dans un cendrier en cristal.
function whisky(u, x, base, s = 1) {
  const P = (v) => f(v);
  let o = `<path d="M${P(x)} ${P(base)} v${P(-9 * s)} q0 ${P(-2 * s)} ${P(2.5 * s)} ${P(-2.5 * s)} v${P(-2 * s)} h${P(3 * s)} v${P(2 * s)} q${P(2.5 * s)} ${P(0.5 * s)} ${P(2.5 * s)} ${P(2.5 * s)} v${P(9 * s)} z" fill="#d8ecf5" opacity=".35" stroke="#e8f6ff" stroke-width="${P(0.4 * s)}"/>`;
  o += `<path d="M${P(x + 0.5 * s)} ${P(base - 0.4 * s)} v${P(-5.5 * s)} h${P(7 * s)} v${P(5.5 * s)} z" fill="#b5651d" opacity=".9"/>`;
  o += `<path d="M${P(x + 1.6 * s)} ${P(base - 8.5 * s)} v${P(7 * s)}" stroke="#fff" stroke-width="${P(0.6 * s)}" opacity=".6"/>`;
  o += `<rect x="${P(x + 2.7 * s)}" y="${P(base - 15 * s)}" width="${P(2.6 * s)}" height="${P(1.6 * s)}" fill="#dff0ff"/><circle cx="${P(x + 4 * s)}" cy="${P(base - 15.8 * s)}" r="${P(1.5 * s)}" fill="#dff0ff" stroke="#9fc6e6" stroke-width="${P(0.3 * s)}"/>`;
  // verre
  const gx = x + 9.5 * s;
  o += `<path d="M${P(gx)} ${P(base - 5 * s)} h${P(5 * s)} l${P(-0.4 * s)} ${P(5 * s)} h${P(-4.2 * s)} z" fill="#d8ecf5" opacity=".35" stroke="#e8f6ff" stroke-width="${P(0.4 * s)}"/><path d="M${P(gx + 0.3 * s)} ${P(base - 2.4 * s)} h${P(4.4 * s)} l${P(-0.2 * s)} ${P(2.2 * s)} h${P(-4 * s)} z" fill="#b5651d"/><rect x="${P(gx + 1.2 * s)}" y="${P(base - 3.4 * s)}" width="${P(1.8 * s)}" height="${P(1.8 * s)}" fill="#fff" opacity=".7" transform="rotate(12 ${P(gx + 2 * s)} ${P(base - 2.5 * s)})"/>`;
  // cendrier, cigare, fumée
  const ax = x + 16 * s;
  o += `<path d="M${P(ax)} ${P(base - 1.6 * s)} h${P(7 * s)} l${P(-0.8 * s)} ${P(1.6 * s)} h${P(-5.4 * s)} z" fill="#cfe6f2" opacity=".75"/>`;
  o += `<rect x="${P(ax + 1.5 * s)}" y="${P(base - 2.9 * s)}" width="${P(7.5 * s)}" height="${P(1.4 * s)}" rx="${P(0.6 * s)}" fill="#6b3f1f"/><rect x="${P(ax + 6.5 * s)}" y="${P(base - 2.9 * s)}" width="${P(1 * s)}" height="${P(1.4 * s)}" fill="${GOLD}"/><circle cx="${P(ax + 1.5 * s)}" cy="${P(base - 2.2 * s)}" r="${P(0.7 * s)}" fill="#ff6a2a"/>`;
  o += `<path d="M${P(ax + 1.2 * s)} ${P(base - 3.2 * s)} q${P(-2 * s)} ${P(-3 * s)} 0 ${P(-5 * s)} t0 ${P(-5 * s)} q${P(1.5 * s)} ${P(-2 * s)} ${P(-0.5 * s)} ${P(-4 * s)}" stroke="#d8d8d8" stroke-width="${P(0.7 * s)}" fill="none" opacity=".45" stroke-linecap="round"/>`;
  return o;
}
// Portrait du patron en majesté, dans un lourd cadre doré.
function bossPortrait(u, x, y, w, h) {
  const cx = x + w / 2, P = (v) => f(v), k = Math.min(w / 40, h / 44);
  let o = `<rect x="${P(x - 5 * k)}" y="${P(y - 5 * k)}" width="${P(w + 10 * k)}" height="${P(h + 10 * k)}" fill="url(#${u}g)" stroke="#6a470c" stroke-width="${P(0.6 * k)}"/>`;
  o += `<rect x="${P(x - 2.6 * k)}" y="${P(y - 2.6 * k)}" width="${P(w + 5.2 * k)}" height="${P(h + 5.2 * k)}" fill="none" stroke="#7a520e" stroke-width="${P(0.8 * k)}"/>`;
  for (const [a, b] of [[x - 5 * k, y - 5 * k], [x + w + 5 * k, y - 5 * k], [x - 5 * k, y + h + 5 * k], [x + w + 5 * k, y + h + 5 * k]]) o += `<circle cx="${P(a)}" cy="${P(b)}" r="${P(2.6 * k)}" fill="url(#${u}g)" stroke="#6a470c" stroke-width="${P(0.4 * k)}"/>`;
  o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${u}r)"/>`;
  o += `<ellipse cx="${P(cx)}" cy="${P(y + h * 0.42)}" rx="${P(w * 0.42)}" ry="${P(h * 0.36)}" fill="#c0303f" opacity=".25"/>`;
  // costume sombre, chemise, cravate, œillet rouge
  o += `<path d="M${P(x + 2 * k)} ${P(y + h)} q${P(1 * k)} ${P(-15 * k)} ${P(cx - x - 9 * k)} ${P(-18 * k)} h${P(14 * k)} q${P(cx - x - 9 * k)} ${P(3 * k)} ${P(cx - x - 7 * k)} ${P(18 * k)} z" fill="#141418"/>`;
  o += `<path d="M${P(cx - 5 * k)} ${P(y + h - 18 * k)} l${P(5 * k)} ${P(12 * k)} l${P(5 * k)} ${P(-12 * k)} z" fill="#f4f0e6"/><path d="M${P(cx - 1.4 * k)} ${P(y + h - 16 * k)} h${P(2.8 * k)} l${P(0.8 * k)} ${P(9 * k)} l${P(-2.2 * k)} ${P(2 * k)} l${P(-2.2 * k)} ${P(-2 * k)} z" fill="#7a0f1c"/>`;
  o += `<path d="M${P(cx - 5 * k)} ${P(y + h - 18 * k)} l${P(4 * k)} ${P(12 * k)} l${P(-6 * k)} ${P(-9 * k)} z M${P(cx + 5 * k)} ${P(y + h - 18 * k)} l${P(-4 * k)} ${P(12 * k)} l${P(6 * k)} ${P(-9 * k)} z" fill="#26262c"/>`;
  o += `<circle cx="${P(cx - 8.5 * k)}" cy="${P(y + h - 11 * k)}" r="${P(1.5 * k)}" fill="#d0202f"/>`;
  // visage, cheveux gominés, moustache, regard
  o += `<rect x="${P(cx - 2.5 * k)}" y="${P(y + h - 22 * k)}" width="${P(5 * k)}" height="${P(5 * k)}" fill="#c99677"/>`;
  o += `<ellipse cx="${P(cx)}" cy="${P(y + h - 27 * k)}" rx="${P(6 * k)}" ry="${P(7.5 * k)}" fill="#dcaa88"/>`;
  o += `<path d="M${P(cx - 6.3 * k)} ${P(y + h - 28 * k)} q${P(0 * k)} ${P(-9 * k)} ${P(7 * k)} ${P(-8.6 * k)} q${P(5.4 * k)} ${P(0.6 * k)} ${P(5.6 * k)} ${P(6.6 * k)} q${P(-4 * k)} ${P(-4.6 * k)} ${P(-12.6 * k)} ${P(2 * k)} z" fill="#141210"/><path d="M${P(cx - 3 * k)} ${P(y + h - 34.5 * k)} q${P(4 * k)} ${P(-1.5 * k)} ${P(7 * k)} ${P(1.5 * k)}" stroke="#4a4642" stroke-width="${P(0.5 * k)}" fill="none"/>`;
  o += `<path d="M${P(cx - 3.6 * k)} ${P(y + h - 28.4 * k)} h${P(2.4 * k)} M${P(cx + 1.2 * k)} ${P(y + h - 28.4 * k)} h${P(2.4 * k)}" stroke="#141210" stroke-width="${P(0.9 * k)}"/><path d="M${P(cx - 3.2 * k)} ${P(y + h - 30 * k)} l${P(2.2 * k)} ${P(0.6 * k)} M${P(cx + 3.2 * k)} ${P(y + h - 30 * k)} l${P(-2.2 * k)} ${P(0.6 * k)}" stroke="#141210" stroke-width="${P(0.6 * k)}"/>`;
  o += `<path d="M${P(cx - 2.6 * k)} ${P(y + h - 23.6 * k)} q${P(2.6 * k)} ${P(-1.6 * k)} ${P(5.2 * k)} 0" stroke="#141210" stroke-width="${P(0.9 * k)}" fill="none"/>`;
  // plaque de laiton
  o += `<rect x="${P(cx - 7 * k)}" y="${P(y + h + 0.8 * k)}" width="${P(14 * k)}" height="${P(3 * k)}" fill="#e8c860" stroke="#6a470c" stroke-width="${P(0.3 * k)}"/>`;
  return o;
}
// Routes rouges sur une carte (dans un cadre existant, ou sur un écran : dark = fond sombre).
function redRoutes(x, y, w, h, dark = false) {
  const X = (a) => f(x + a * w), Y = (b) => f(y + b * h);
  let o = '';
  if (dark) {
    o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0c1420"/>`;
    o += `<path d="M${X(0.06)} ${Y(0.3)} q${f(w * 0.1)} ${f(-h * 0.2)} ${f(w * 0.22)} 0 t${f(w * 0.06)} ${f(h * 0.45)} q${f(-w * 0.14)} ${f(h * 0.15)} ${f(-w * 0.25)} 0 z M${X(0.5)} ${Y(0.2)} q${f(w * 0.2)} ${f(-h * 0.1)} ${f(w * 0.4)} ${f(h * 0.1)} v${f(h * 0.35)} q${f(-w * 0.15)} ${f(h * 0.25)} ${f(-w * 0.3)} ${f(h * 0.05)} z" fill="#1e3a3a"/>`;
  }
  o += `<path d="M${X(0.12)} ${Y(0.42)} Q${X(0.32)} ${Y(0.12)} ${X(0.56)} ${Y(0.32)} T${X(0.88)} ${Y(0.5)} M${X(0.2)} ${Y(0.72)} Q${X(0.45)} ${Y(0.95)} ${X(0.7)} ${Y(0.66)} M${X(0.56)} ${Y(0.32)} Q${X(0.6)} ${Y(0.55)} ${X(0.7)} ${Y(0.66)}" stroke="#d8202c" stroke-width="${f(Math.max(0.8, w / 70))}" stroke-dasharray="${f(w / 28)} ${f(w / 50)}" fill="none"/>`;
  for (const [a, b] of [[0.12, 0.42], [0.56, 0.32], [0.88, 0.5], [0.2, 0.72], [0.7, 0.66]]) o += `<circle cx="${X(a)}" cy="${Y(b)}" r="${f(Math.max(0.9, w / 45))}" fill="#ff3040"/><circle cx="${X(a)}" cy="${Y(b)}" r="${f(Math.max(1.6, w / 22))}" fill="#ff3040" opacity="${dark ? 0.3 : 0.15}"/>`;
  o += `<path d="M${X(0.84)} ${Y(0.18)} l${f(w * 0.06)} ${f(h * 0.1)} M${X(0.9)} ${Y(0.18)} l${f(-w * 0.06)} ${f(h * 0.1)}" stroke="#d8202c" stroke-width="${f(Math.max(0.9, w / 60))}"/>`;
  return o;
}
// Couleurs du décor quand la compagnie est sur la liste noire (murs, boiseries, sols).
const SHADOW_PAL = [
  {},
  { wall: '#4a1d27', base: '#2e1219', floor: '#3a2418', sash: GOLD },
  { wall: '#1d3a2d', panel: '#4a2716', groove: GOLD, sash: GOLD },
  { wall: '#2a2220', band: '#2f2521', floor: '#1b181b', sash: GOLD },
  { floor: '#141117', edge: GOLD },
];
// Tapisserie damassée (sous les fenêtres et les cadres, dessinée juste après le mur).
function shadowWall(tier, u) {
  let o = shadowDefs(u);
  if (tier === 1) o += `<rect width="236" height="152" fill="url(#${u}d)"/><rect x="434" width="46" height="152" fill="url(#${u}d)"/>`;
  if (tier === 2) o += `<rect width="${480}" height="86" fill="url(#${u}d)"/>`;
  return o;
}
// Sous le mobilier : nuit aux fenêtres, rideaux, lustre(s), tapis léopard, sol de marbre.
function shadowBack(tier, u) {
  let o = '';
  const marble = (y0) => Array.from({ length: 7 }, (_, k) => `<path d="M${k * 72 - 10} ${y0 + 4 + (k % 3) * 9} q24 ${-6 + (k % 2) * 10} 46 ${4 - (k % 3) * 3} t40 ${6 - (k % 2) * 8}" stroke="#7d7480" stroke-width=".6" fill="none" opacity=".45"/>`).join('');
  if (tier === 0) {
    o += night(300, 34, 92, 64) + curtains(u, 296, 30, 100, 72);
    o += leopardRug(u, 214, 181, 108, 11) + chandelier(u, 210, 0, 0.8);
  } else if (tier === 1) {
    o += night(250, 26, 170, 92) + curtains(u, 246, 22, 178, 100);
    o += leopardRug(u, 250, 182, 128, 12) + chandelier(u, 335, 0, 1);
  } else if (tier === 2) {
    o += night(290, 14, 160, 70) + curtains(u, 286, 10, 168, 78);
    o += `<rect y="158" width="480" height="42" fill="#2a1810"/>${Array.from({ length: 16 }, (_, k) => `<line x1="${k * 32}" y1="158" x2="${k * 32 - 14}" y2="200" stroke="#1a0e08" stroke-width="1.2"/>`).join('')}`;
    o += leopardRug(u, 240, 182, 172, 14) + chandelier(u, 252, 0, 1.05);
  } else if (tier === 3) {
    o += night(16, 12, 448, 118) + curtains(u, 12, 8, 456, 126);
    o += marble(158) + leopardRug(u, 268, 182, 150, 12) + chandelier(u, 240, 0, 1.25);
  } else {
    o += night(0, 6, 480, 142, 0.63) + curtains(u, 8, 8, 464, 140);
    o += marble(150) + leopardRug(u, 250, 185, 172, 12) + chandelier(u, 104, 6, 1.15) + chandelier(u, 376, 6, 1.15);
  }
  return o;
}
// Devant le mobilier : portrait, carte aux routes rouges, whisky, coffre-fort, buste doré.
function shadowFront(tier, u) {
  if (tier === 0) return bossPortrait(u, 94, 38, 36, 44) + safe(u, 304, 158, 1.1) + whisky(u, 310, 125, 0.8);
  if (tier === 1) return redRoutes(110, 36, 90, 54) + safe(u, 104, 158, 1.15) + jukeGramophone(119, 123.5, false) + whisky(u, 227, 112, 0.85) + goldBust(u, 446, 158, 1.15);
  if (tier === 2) return bossPortrait(u, 40, 16, 96, 60) + whisky(u, 281, 112, 0.75) + goldBust(u, 22, 94.5, 0.62); // le buste trône sur le juke-box
  if (tier === 3) return redRoutes(183, 99, 40, 16, true) + whisky(u, 152, 118, 0.85) + safe(u, 302, 158, 1) + goldBust(u, 16, 158, 1.25);
  return redRoutes(224, 100, 42, 24, true) + whisky(u, 121, 132, 0.75) + safe(u, 446, 150, 1) + goldBust(u, 38, 197, 1.5);
}

// ---------- Juke-box (cliquable dans le bureau) ----------
// Il grandit avec la compagnie : vieille radio au cagibi, gramophone au bureau du port, juke-box au
// siège, chaîne hi-fi à l'étage de direction, chaîne de designer en haut de la tour. Des notes
// s'envolent quand il joue (classe juke-on sur l'illustration).
function juke(inner, nx, ny) {
  const notes = `<g class="juke-notes" aria-hidden="true"><text x="${nx}" y="${ny}" class="juke-note">♪</text><text x="${nx + 7}" y="${ny + 4}" class="juke-note">♫</text></g>`;
  return `<g class="office-juke" role="button" tabindex="0" aria-label="Juke-box"><title>Juke-box</title>${inner}${notes}</g>`;
}
function jukeRadio(x) { // posée sur une caisse
  return juke(`<rect x="${x}" y="134" width="44" height="24" fill="#9b7a52" stroke="#6f5236" stroke-width="1.2"/><line x1="${x}" y1="142" x2="${x + 44}" y2="142" stroke="#7d5f3d"/><line x1="${x}" y1="150" x2="${x + 44}" y2="150" stroke="#7d5f3d"/>
    <path d="M${x + 10} 112 q12 -8 24 0" stroke="#5a2a1c" stroke-width="1.6" fill="none"/><line x1="${x + 38}" y1="113" x2="${x + 44}" y2="96" stroke="#cfcfcf" stroke-width="1"/><circle cx="${x + 44}" cy="96" r="1.1" fill="#cfcfcf"/>
    <rect x="${x + 4}" y="112" width="36" height="22" rx="5" fill="#a8432c"/><rect x="${x + 8}" y="116" width="16" height="14" rx="2" fill="#efe3c6"/>${[12, 16, 20].map((d) => `<line x1="${x + d}" y1="117" x2="${x + d}" y2="129" stroke="#c9b893" stroke-width="1"/>`).join('')}
    <circle cx="${x + 32}" cy="120" r="3.2" fill="#efe3c6" stroke="#5a2a1c" stroke-width=".8"/><line x1="${x + 32}" y1="120" x2="${x + 33.5}" y2="117.6" stroke="#5a2a1c" stroke-width=".8"/><circle cx="${x + 32}" cy="128.5" r="2" fill="#5a2a1c"/>`, x + 20, 104);
}
function jukeGramophone(cx, base, table) { // sur un guéridon, ou sur ce qui se trouve dessous
  const T = table ? `<rect x="${cx - 18}" y="${base}" width="36" height="3" rx="1.5" fill="#7a5434"/><rect x="${cx - 2}" y="${base + 3}" width="4" height="${155 - base - 3}" fill="#5f4128"/><rect x="${cx - 10}" y="155" width="20" height="3" rx="1" fill="#5f4128"/>` : '';
  return juke(`${T}<rect x="${cx - 13}" y="${base - 10}" width="26" height="10" rx="1" fill="#6b4a2e"/><rect x="${cx - 13}" y="${base - 10}" width="26" height="2" fill="#8a6440"/><path d="M${cx - 13} ${base - 5} h-3 v3" stroke="#c9a24a" stroke-width="1.2" fill="none"/>
    <ellipse cx="${cx - 3}" cy="${base - 10.6}" rx="9" ry="1.5" fill="#1b1b1b"/><path d="M${cx + 7} ${base - 11} q1 -6 4 -10" stroke="#b8862e" stroke-width="2" fill="none"/>
    <path d="M${cx + 10} ${base - 20} Q${cx + 8} ${base - 27} ${cx + 3} ${base - 32} Q${cx + 14} ${base - 39} ${cx + 24} ${base - 35} Q${cx + 16} ${base - 27} ${cx + 13} ${base - 20} Z" fill="#d4a64a" stroke="#9a6f22" stroke-width=".7"/>
    <ellipse cx="${cx + 13.5}" cy="${base - 33.6}" rx="10.6" ry="2.6" transform="rotate(-10 ${cx + 13.5} ${base - 33.6})" fill="#8a5f1c"/>`, cx + 26, base - 34);
}
function jukeClassic(x) { // le juke-box à l'ancienne : arche lumineuse, disque derrière la vitre
  return juke(`<ellipse cx="${x + 18}" cy="120" rx="24" ry="30" fill="#f2b84b" opacity=".13"/>
    <path d="M${x} 158 V114 A18 20 0 0 1 ${x + 36} 114 V158 Z" fill="#6e2323" stroke="#3a1010" stroke-width="1"/>
    <path d="M${x + 4} 156 V115 A14 16 0 0 1 ${x + 32} 115 V156" fill="none" stroke="#f2b84b" stroke-width="2.2"/><path d="M${x + 7} 156 V116 A11 13 0 0 1 ${x + 29} 116 V156" fill="none" stroke="#e0614f" stroke-width="1.4"/>
    <path d="M${x + 10} 129 V119 A8 8 0 0 1 ${x + 26} 119 V129 Z" fill="#f3e6c4"/><ellipse cx="${x + 18}" cy="125.5" rx="5.5" ry="1.5" fill="#222"/>
    <rect x="${x + 10}" y="134" width="16" height="16" rx="2" fill="#3a1010"/>${[13, 16.5, 20, 23.5].map((d) => `<line x1="${x + d}" y1="136" x2="${x + d}" y2="148" stroke="#c99a5b" stroke-width="1"/>`).join('')}
    <rect x="${x}" y="154" width="36" height="4" fill="#3a1010"/>`, x + 30, 92);
}
function jukeHifi(x) { // chaîne hi-fi en teck sous le bureau : vumètres, disques
  return juke(`<rect x="${x}" y="132" width="48" height="26" rx="1.5" fill="#7a5434" stroke="#4a2f1b" stroke-width=".8"/><rect x="${x + 3}" y="135" width="42" height="9" fill="#2c2623"/>
    <rect x="${x + 6}" y="137" width="9" height="5" fill="#f2b84b"/><rect x="${x + 18}" y="137" width="9" height="5" fill="#f2b84b"/><line x1="${x + 8}" y1="141.5" x2="${x + 12}" y2="138" stroke="#3a2a1a" stroke-width=".7"/><line x1="${x + 20}" y1="141.5" x2="${x + 24}" y2="138.5" stroke="#3a2a1a" stroke-width=".7"/>
    <circle cx="${x + 34}" cy="139.5" r="1.7" fill="#c9c9c9"/><circle cx="${x + 40}" cy="139.5" r="1.7" fill="#c9c9c9"/>
    ${['#c4362c', '#e9dcb7', '#2f6fb0', '#1b1b1b', '#e09a2a', '#5f8f5a', '#1b1b1b', '#7b5ea7', '#e9dcb7', '#c4362c', '#2c3a44', '#d4a64a', '#1b1b1b', '#5b88a0'].map((c, k) => `<rect x="${x + 4 + k * 2.9}" y="147" width="2.4" height="9" fill="${c}"/>`).join('')}`, x + 24, 126);
}
function jukeDesigner(x) { // chaîne de designer : façade noire, bandeau néon, égaliseur
  return juke(`<rect x="${x}" y="140" width="58" height="22" rx="3" fill="#0d1218" stroke="#4a535e" stroke-width=".8"/><rect x="${x + 2}" y="142" width="54" height="1.6" fill="#7fe0c4"/>
    <circle cx="${x + 8}" cy="153" r="5" fill="#1b2433" stroke="#7fe0c4" stroke-width=".8"/><circle cx="${x + 8}" cy="153" r="1.6" fill="#7fe0c4" opacity=".6"/>
    <circle cx="${x + 50}" cy="153" r="5" fill="#1b2433" stroke="#ff8a7a" stroke-width=".8"/><circle cx="${x + 50}" cy="153" r="1.6" fill="#ff8a7a" opacity=".6"/>
    <rect x="${x + 18}" y="147" width="22" height="10" rx="1" fill="#123247"/>${[5, 8, 4, 7, 6, 3, 7].map((hh, k) => `<rect x="${x + 20 + k * 2.8}" y="${156 - hh}" width="1.8" height="${hh}" fill="${['#7fe0c4', '#f6c26b', '#ff8a7a'][k % 3]}"/>`).join('')}`, x + 30, 134);
}

// ---------- Trophées (records) et preuves sinistres (méfaits) ----------
// Chaque record a sa place (dans l'ordre de RECORD_IDS), chaque méfait aussi : x = centre,
// b = base (où l'objet est posé), h = hauteur. Les meubles sont dessinés sous les objets.
const row = (n, x0, dx, b, h) => Array.from({ length: n }, (_, i) => ({ x: x0 + i * dx, b, h }));
export const HONOUR_SLOTS = [
  { record: row(8, 10, 11.2, 62, 15), evil: row(6, 407, 12.2, 127, 14) },
  { record: row(8, 112, 17, 29, 17), evil: row(6, 368, 12, 127, 14) },
  { record: [...row(4, 401, 20.5, 120, 19), ...row(4, 401, 20.5, 146, 19)], evil: row(6, 51, 11.5, 129, 14) },
  { record: [...row(4, 80, 18.5, 138, 18), ...row(4, 391, 13, 138, 16)], evil: [...row(3, 446.5, 11.5, 130, 13), ...row(3, 446.5, 11.5, 155, 13)] },
  { record: [...row(4, 98, 11.5, 128, 14), ...row(2, 370, 17, 120, 16), ...row(2, 370, 17, 146, 16)], evil: [...row(2, 150, 10.5, 131, 12), ...row(4, 329, 9.6, 131, 12)] },
];
function honourFurniture(tier, anyEvil) {
  let s = '';
  if (tier === 0) {
    s += '<rect x="4" y="62" width="92" height="4" fill="#7a5434"/><path d="M10 66 l6 8 M90 66 l-6 8" stroke="#5a3c24" stroke-width="2"/>';
    if (anyEvil) s += '<rect x="400" y="127" width="76" height="5" fill="#2a1d14"/><rect x="404" y="132" width="4" height="26" fill="#1d140e"/><rect x="468" y="132" width="4" height="26" fill="#1d140e"/>';
  } else if (tier === 1) {
    s += '<rect x="104" y="29" width="138" height="4" fill="#7a5434"/><path d="M112 33 l6 7 M234 33 l-6 7" stroke="#5a3c24" stroke-width="2"/>';
    if (anyEvil) s += '<rect x="361" y="127" width="74" height="5" fill="#2a1d14"/><rect x="365" y="132" width="4" height="26" fill="#1d140e"/><rect x="427" y="132" width="4" height="26" fill="#1d140e"/>';
  } else if (tier === 2) {
    s += '<rect x="389" y="94" width="86" height="64" fill="#4a2f1b"/><rect x="393" y="98" width="78" height="56" fill="#cfe1e8" opacity=".35"/>';
    s += '<rect x="393" y="120" width="78" height="2.5" fill="#e8f2f5" opacity=".9"/><rect x="393" y="146" width="78" height="2.5" fill="#e8f2f5" opacity=".9"/><path d="M398 100 l10 50" stroke="#fff" stroke-width="2" opacity=".25"/>';
    if (anyEvil) s += '<rect x="44" y="129" width="70" height="5" fill="#2a1d14"/><rect x="48" y="134" width="4" height="24" fill="#1d140e"/><rect x="106" y="134" width="4" height="24" fill="#1d140e"/>';
  } else if (tier === 3) {
    s += '<rect x="70" y="138" width="76" height="20" fill="#3b3330"/><rect x="70" y="138" width="76" height="3" fill="#5a4f49"/><rect x="383" y="138" width="54" height="20" fill="#3b3330"/><rect x="383" y="138" width="54" height="3" fill="#5a4f49"/>';
    if (anyEvil) s += '<rect x="439" y="110" width="38" height="48" fill="#1d1916"/><rect x="441" y="130" width="34" height="2.5" fill="#3a302a"/><rect x="441" y="155" width="34" height="2.5" fill="#3a302a"/>';
  } else {
    s += '<rect x="361" y="94" width="36" height="56" fill="#2a2f36"/><rect x="363" y="96" width="32" height="52" fill="#9fc3d6" opacity=".18"/><rect x="363" y="120" width="32" height="2" fill="#cfe6f0" opacity=".8"/><rect x="363" y="146" width="32" height="2" fill="#cfe6f0" opacity=".8"/>';
  }
  return s;
}
// held : { record: [ids], evil: [ids] } ; hide : un objet à ne pas encore poser (animation).
function honoursLayer(tier, held, hide = null) {
  if (!held) return '';
  const slots = HONOUR_SLOTS[tier];
  const evil = (held.evil || []).filter((id) => !(hide?.kind === 'evil' && hide.id === id));
  let s = honourFurniture(tier, (held.evil || []).length > 0);
  RECORD_IDS.forEach((id, i) => {
    if (!(held.record || []).includes(id) || (hide?.kind === 'record' && hide.id === id)) return;
    const sl = slots.record[i];
    s += `<ellipse cx="${sl.x}" cy="${sl.b + 0.6}" rx="${sl.h * 0.32}" ry="1.2" fill="#000" opacity=".25"/>` + honourPlaced('record', id, sl.x - sl.h * 0.375, sl.b - sl.h, sl.h);
  });
  EVIL_IDS.forEach((id, i) => {
    if (!evil.includes(id)) return;
    const sl = slots.evil[i];
    s += `<ellipse cx="${sl.x}" cy="${sl.b + 0.6}" rx="${sl.h * 0.34}" ry="1.2" fill="#000" opacity=".35"/>` + honourPlaced('evil', id, sl.x - sl.h * 0.375, sl.b - sl.h, sl.h);
  });
  return s;
}
// Où se pose un objet (coordonnées du bureau, 480 × 200) : pour l'animation de la scène.
export const honourSlot = (tier, kind, id) => HONOUR_SLOTS[tier][kind === 'evil' ? 'evil' : 'record'][(kind === 'evil' ? EVIL_IDS : RECORD_IDS).indexOf(id)];

/**
 * tier : 0..4 ; opts : color, logo (compagnie), model : { typeId, color, logo, name } (plus beau navire).
 */
export function officeSVG(tier, { color = '#1e3a55', logo = 'ancre', model = null, uid = 'of', honours = null, hide = null, shadow = false } = {}) {
  const W = 480, H = 200, floorY = 158;
  const id = uid + tier, sid = id + 'k';
  const pal = shadow ? SHADOW_PAL[tier] : {};
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${OFFICE_TIERS[tier].name}">`;
  const modelSvg = (x, y, w) => model ? shipSVG(model.typeId, { ...model, sky: false, water: false, fit: true, condition: 100, age: 0, laden: false, attrs: `x="${x}" y="${y}" width="${w}" height="${f(w * 110 / 400)}"` }) : '';

  if (tier === 0) {
    // Le cagibi : murs défraîchis, petite fenêtre, bureau en métal, ampoule nue.
    s += `<rect width="${W}" height="${floorY}" fill="#b9bea7"/><rect y="${floorY - 26}" width="${W}" height="26" fill="#a5aa93"/>`;
    s += `<path d="M60 20 q10 30 -4 60" stroke="#8f9480" stroke-width="5" opacity=".25" fill="none"/><circle cx="400" cy="40" r="22" fill="#9da28d" opacity=".35"/>`;
    if (shadow) s += shadowWall(tier, sid);
    s += harborView(id + 'w', 300, 34, 92, 64, 'day', 1);
    s += `<rect x="296" y="30" width="100" height="72" fill="none" stroke="#e8e3d4" stroke-width="5"/><line x1="346" y1="32" x2="346" y2="100" stroke="#e8e3d4" stroke-width="3"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#8d6a48"/>${Array.from({ length: 12 }, (_, k) => `<line x1="${k * 42}" y1="${floorY}" x2="${k * 42 - 20}" y2="${H}" stroke="#6f5236" stroke-width="1.5"/>`).join('')}`;
    if (shadow) s += shadowBack(tier, sid);
    s += `<rect x="30" y="72" width="44" height="86" fill="#7f8a8c"/><rect x="34" y="78" width="36" height="22" fill="#909b9d"/><rect x="34" y="104" width="36" height="22" fill="#909b9d"/><rect x="34" y="130" width="36" height="22" fill="#909b9d"/>${[89, 115, 141].map((yy) => `<rect x="48" y="${yy}" width="8" height="3" fill="#56605f"/>`).join('')}`;
    s += `<rect x="140" y="110" width="150" height="8" fill="#8a9396"/><rect x="146" y="118" width="6" height="40" fill="#6d7578"/><rect x="278" y="118" width="6" height="40" fill="#6d7578"/>`;
    s += `<rect x="160" y="80" width="40" height="30" rx="3" fill="#d7d2c2"/><rect x="164" y="84" width="32" height="20" fill="#5c7d6e"/><rect x="172" y="110" width="16" height="3" fill="#bdb7a6"/>`;
    s += `<rect x="225" y="100" width="30" height="10" fill="#f1ede1"/><rect x="228" y="96" width="26" height="4" fill="#e8e3d4"/><path d="M262 104 h16 v6 h-16 z" fill="#2b2b2b"/>`;
    if (!shadow) s += `<line x1="210" y1="0" x2="210" y2="28" stroke="#333"/><circle cx="210" cy="32" r="6" fill="#fff4c2"/><circle cx="210" cy="32" r="14" fill="#fff4c2" opacity=".25"/>`;
    s += `<rect x="96" y="40" width="34" height="40" fill="#f6f2e6" transform="rotate(-4 113 60)"/><rect x="100" y="46" width="26" height="5" fill="#c4362c" transform="rotate(-4 113 60)"/>`;
    s += logoSign(420, 52, 36, color, logo, '#f6f2e6');
    s += `<path d="M115 158 l14 -40 h20 l6 40" fill="#4c4a46"/><rect x="120" y="112" width="34" height="8" rx="3" fill="#5a5753"/>`;
    s += jukeRadio(348);
  } else if (tier === 1) {
    s += `<rect width="${W}" height="${floorY}" fill="${pal.wall || '#e8dcc0'}"/><rect y="${floorY - 6}" width="${W}" height="6" fill="${pal.base || '#cdbd98'}"/>`;
    if (shadow) s += shadowWall(tier, sid);
    s += harborView(id + 'w', 250, 26, 170, 92, 'day', 2);
    s += `<rect x="246" y="22" width="178" height="100" fill="none" stroke="${pal.sash || '#fbf8f1'}" stroke-width="6"/><line x1="335" y1="24" x2="335" y2="120" stroke="${pal.sash || '#fbf8f1'}" stroke-width="4"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="${pal.floor || '#a07b55'}"/>`;
    if (shadow) s += shadowBack(tier, sid);
    s += books(24, 40, 70, 118, 4);
    s += frame(110, 36, 90, 54, `<rect x="110" y="36" width="90" height="54" fill="#cfe1e8"/><path d="M118 50 q10 -6 20 2 t18 -2 v18 q-12 6 -24 0 z M160 46 q12 -2 20 8 t14 6 v14 h-30 z" fill="#e9dcb7"/>`, '#5a3c24');
    s += `<rect x="150" y="112" width="200" height="10" fill="#7a5434"/><rect x="156" y="122" width="10" height="36" fill="#5f4128"/><rect x="334" y="122" width="10" height="36" fill="#5f4128"/><rect x="172" y="122" width="70" height="30" fill="#6b4a2e"/>`;
    s += `<rect x="255" y="82" width="44" height="28" rx="2" fill="#2c3a44"/><rect x="258" y="85" width="38" height="22" fill="#5b88a0"/><rect x="273" y="110" width="8" height="3" fill="#2c3a44"/>`;
    s += `<rect x="190" y="104" width="34" height="8" fill="#f1ede1"/><rect x="310" y="100" width="14" height="12" fill="#c4362c"/>`;
    if (!shadow) s += plant(445, 146, 1.1);
    s += logoSign(438, 40, 34, color, logo);
    s += `<path d="M215 158 l10 -36 h30 l8 36" fill="#3e3a36"/><rect x="220" y="116" width="40" height="9" rx="4" fill="#4a4540"/>`;
    if (!shadow) s += jukeGramophone(124, 126, true); // sous la carte ; chez l'armateur de l'ombre, il trône sur le coffre-fort
  } else if (tier === 2) {
    // Le siège : boiseries, tableau de navire, maquette, tapis.
    s += `<rect width="${W}" height="${floorY}" fill="${pal.wall || '#d9cdb2'}"/><rect y="88" width="${W}" height="${floorY - 88}" fill="${pal.panel || '#8a5d3b'}"/>${Array.from({ length: 10 }, (_, k) => `<rect x="${k * 50 + 8}" y="96" width="34" height="${floorY - 104}" fill="none" stroke="${pal.groove || '#6f4a2e'}" stroke-width="${shadow ? 1.2 : 2}"/>`).join('')}<rect y="86" width="${W}" height="5" fill="${pal.groove || '#6f4a2e'}"/>`;
    if (shadow) s += shadowWall(tier, sid);
    s += harborView(id + 'w', 290, 14, 160, 70, 'gold', 2);
    s += `<rect x="286" y="10" width="168" height="78" fill="none" stroke="${pal.sash || '#efe6d2'}" stroke-width="6"/><line x1="370" y1="12" x2="370" y2="86" stroke="${pal.sash || '#efe6d2'}" stroke-width="4"/>`;
    s += frame(40, 16, 96, 60, `<rect x="40" y="16" width="96" height="60" fill="#d8c79c"/><rect x="40" y="52" width="96" height="24" fill="#5b7f8a"/><path d="M58 52 h52 l-6 8 h-42 z" fill="#3a2d23"/><path d="M80 52 v-26 M70 50 l10 -22 l10 22 z" fill="#efe6d2" stroke="#3a2d23" stroke-width=".6"/>`, '#a57a2c');
    s += logoSign(176, 22, 50, color, logo, '#efe6d2');
    if (shadow) s += shadowBack(tier, sid);
    else s += `<ellipse cx="240" cy="182" rx="170" ry="14" fill="#7d2f2f"/><ellipse cx="240" cy="182" rx="150" ry="10" fill="none" stroke="#c99a5b" stroke-width="2"/>`;
    s += `<rect y="${floorY}" width="${W}" height="${H - floorY}" fill="#5f3f27" opacity=".0"/>`;
    s += `<rect x="120" y="112" width="250" height="12" fill="#5a3a22"/><rect x="128" y="124" width="70" height="34" fill="#4a2f1b"/><rect x="292" y="124" width="70" height="34" fill="#4a2f1b"/>`;
    s += modelSvg(140, 74, 140);
    s += `<rect x="300" y="100" width="40" height="12" fill="#f1ede1"/><circle cx="355" cy="104" r="8" fill="#3d6a8c"/><path d="M349 100 q6 2 12 0 M348 106 q7 2 14 0" stroke="#d9c88f" fill="none"/><rect x="353" y="112" width="4" height="2" fill="#2b2b2b"/>`;
    s += `<path d="M215 160 l10 -40 h36 l8 40" fill="#3a1f14"/><rect x="220" y="96" width="44" height="34" rx="8" fill="#5a2a1c"/>`;
    s += jukeClassic(4); // à la place de la plante
  } else if (tier === 3) {
    // L'étage de direction : baie vitrée panoramique sur le port.
    s += `<rect width="${W}" height="${floorY}" fill="${pal.wall || '#e9e4da'}"/>`;
    if (shadow) s += shadowWall(tier, sid);
    s += harborView(id + 'w', 16, 12, 448, 118, 'gold', 3);
    for (let k = 1; k < 5; k++) s += `<rect x="${16 + k * 89.6 - 2}" y="12" width="4" height="118" fill="${pal.sash || '#f6f3ec'}"/>`;
    s += `<rect x="12" y="8" width="456" height="126" fill="none" stroke="${pal.sash || '#f6f3ec'}" stroke-width="7"/>`;
    s += `<rect y="${floorY - 24}" width="${W}" height="24" fill="${pal.band || '#d9d2c4'}"/><rect y="${floorY}" width="${W}" height="${H - floorY}" fill="${pal.floor || '#b9a585'}"/>`;
    if (shadow) s += shadowBack(tier, sid);
    s += `<rect x="150" y="118" width="230" height="10" rx="2" fill="#3b3330"/><rect x="160" y="128" width="8" height="30" fill="#2c2623"/><rect x="362" y="128" width="8" height="30" fill="#2c2623"/>`;
    s += modelSvg(278, 90, 100);
    s += `<rect x="180" y="96" width="46" height="22" rx="2" fill="#1f2a33"/><rect x="183" y="99" width="40" height="16" fill="#3f7d8a"/><polyline points="185,112 192,108 199,110 206,104 213,106 220,101" stroke="#c4f1b0" fill="none" stroke-width="1.2"/>`;
    s += jukeHifi(176); // sous le bureau
    s += `<path d="M230 160 l8 -38 h40 l8 38" fill="#232020"/><rect x="236" y="92" width="46" height="36" rx="10" fill="#2f2b29"/>`;
    s += logoSign(30, 140, 38, color, logo);
    if (!(honours?.evil || []).length) s += plant(450, 146, 1.3);
  } else {
    // La tour de verre : sommet d'une tour au crépuscule, écrans, longue-vue.
    s += `<rect width="${W}" height="${H}" fill="#1b2433"/>`;
    s += harborView(id + 'w', 0, 0, W, 150, 'dusk', 4);
    for (let k = 1; k < 6; k++) s += `<rect x="${k * 80 - 1.5}" y="0" width="3" height="150" fill="#0f141c" opacity=".8"/>`;
    s += `<rect y="0" width="${W}" height="6" fill="#0f141c"/><rect y="148" width="${W}" height="${H - 148}" fill="${pal.floor || '#2a2f36'}"/><rect y="148" width="${W}" height="3" fill="${pal.edge || '#4a535e'}"/>`;
    if (shadow) s += shadowWall(tier, sid) + shadowBack(tier, sid);
    s += `<g opacity=".18" transform="translate(196 24) scale(1.4)" color="#fff">${logoMarkup(logo)}</g>`;
    s += `<path d="M120 132 q120 -18 240 0 v8 q-120 -14 -240 0 z" fill="#d9d4ca"/><rect x="150" y="138" width="8" height="24" fill="#8c8c8c"/><rect x="322" y="138" width="8" height="24" fill="#8c8c8c"/>`;
    for (let k = 0; k < 3; k++) {
      const x = 170 + k * 52;
      s += `<rect x="${x}" y="98" width="46" height="28" rx="2" fill="#0d1218"/><rect x="${x + 2}" y="100" width="42" height="24" fill="#123247"/>`;
      s += `<polyline points="${x + 4},${120 - k * 2} ${x + 12},${114} ${x + 20},${117} ${x + 28},${108 - k * 3} ${x + 40},${104}" stroke="${['#7fe0c4', '#f6c26b', '#ff8a7a'][k]}" fill="none" stroke-width="1.3"/>`;
    }
    s += `<rect x="14" y="128" width="130" height="34" fill="#3a3f47"/><rect x="14" y="126" width="130" height="4" fill="#5a636e"/>`;
    s += modelSvg(18, 109, 72);
    s += `<path d="M420 160 l-6 -28 M420 160 l8 -28 M420 160 l-1 -30" stroke="#a7a7a7" stroke-width="2"/><rect x="398" y="120" width="44" height="7" rx="3" fill="#c9b27a" transform="rotate(-18 420 124)"/>`;
    s += jukeDesigner(164); // sous le bureau
    s += `<path d="M228 168 l6 -34 h36 l6 34" fill="#e8e3da"/><rect x="232" y="104" width="44" height="36" rx="10" fill="#f2efe8"/>`;
    s += logoSign(440, 156, 30, color, logo, '#e8e3da');
  }
  if (shadow) s += shadowFront(tier, sid);
  s += honoursLayer(tier, honours, hide);
  s += '</svg>';
  return s;
}
