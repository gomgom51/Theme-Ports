// Générateur pseudo-aléatoire reproductible (mulberry32) : l'état tient dans la
// sauvegarde, donc une partie rechargée continue exactement de la même façon.
export class Rng {
  constructor(state) { this.s = state >>> 0; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  normal() {
    const u = Math.max(1e-9, this.next()), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  weighted(entries) { // [[valeur, poids], ...]
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = this.next() * total;
    for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
    return entries[entries.length - 1][0];
  }
}

// Point dans un contour [[lon, lat], ...] (à plat : les zones sont petites et loin de l'antiméridien).
export function inPoly(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const HOURS_PER_DAY = 24;
export const START_YEAR = 2027;
const START = Date.UTC(START_YEAR, 0, 1);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function dateOf(t) { return new Date(START + t * 3600e3); }
export function formatDate(t, short = false) {
  const d = dateOf(t);
  return `${d.getUTCDate()} ${(short ? MONTHS_SHORT : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function monthOf(t) { return dateOf(t).getUTCMonth(); }
export function yearOf(t) { return dateOf(t).getUTCFullYear(); }

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
