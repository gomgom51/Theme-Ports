// Forces de l'ordre en mer : garde-côtes des pays qui appliquent les sanctions et
// patrouilles anti-drogue des Caraïbes. Elles ne s'intéressent qu'aux navires qui
// cachent un colis : repérage (fuir ?), fouille (le trouver ?), puis le résultat.
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { ENFORCING, CONCEALMENT } from '../data/sanctions.js';
import { SHIP_TYPES } from '../data/ships.js';
import { haversineNm } from './routing.js';
import { money, news, changeReputation, shipLog, companyOf } from './core.js';
import { HOURS_PER_DAY } from './util.js';
import { equipMod, hasEquip } from './equipment.js';
import { seizureFine, crewDiscretion } from './shady.js';

const D = HOURS_PER_DAY;
// Eaux surveillées : 200 milles autour des ports des pays qui appliquent les sanctions,
// et la grande zone de patrouille anti-drogue des Caraïbes.
const COAST_R = 200;
export const PATROLS = [
  ...PORT_IDS.filter((p) => ENFORCING.has(PORTS[p].flag)).map((p) => ({ id: p, name: `garde-côtes (${FLAGS[PORTS[p].flag].name})`, lon: PORTS[p].lon, lat: PORTS[p].lat, r: COAST_R, rate: 0.12 })),
  { id: 'caraibes', name: 'patrouilles anti-drogue des Caraïbes', lon: -74, lat: 14.5, r: 650, rate: 0.18 },
];
export function patrolAt(lon, lat) {
  let best = null;
  for (const z of PATROLS) if (haversineNm(lon, lat, z.lon, z.lat) <= z.r && (!best || z.rate > best.rate)) best = z;
  return best;
}
// Milles parcourus en eaux surveillées le long d'une route.
export function patrolsAlong(route) {
  if (!route?.points) return [];
  const found = new Map();
  const pts = route.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = haversineNm(a[0], a[1], b[0], b[1]);
    const n = Math.max(1, Math.ceil(seg / 50));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
      const z = patrolAt(((lon + 540) % 360) - 180, lat);
      if (z) found.set(z.name, { zone: z, nm: (found.get(z.name)?.nm || 0) + seg / n });
    }
  }
  return [...found.values()];
}
// Les deux phases : échapper au contrôle, puis résister à la fouille.
function phases(ship, speed) {
  const evade = Math.max(0.05, Math.min(0.8, 0.12 + Math.max(0, speed - 14) * 0.05 + (hasEquip(ship, 'brouilleur') ? 0.2 : 0)));
  const hidden = Math.max(0.05, Math.min(0.9, 1 - 0.75 * (CONCEALMENT[ship.type] ?? 1) * crewDiscretion(ship) * equipMod(ship, 'conceal')));
  return { evade, hidden };
}
// Risque d'un voyage avec un colis à bord (affiché avant le départ).
export function patrolRisk(ship, route, speed) {
  if (!ship.contraband) return null;
  const zones = patrolsAlong(route);
  if (!zones.length) return null;
  let none = 1;
  for (const { zone, nm } of zones) none *= Math.exp(-zone.rate * equipMod(ship, 'sanction') * (nm / (24 * speed)));
  const p = phases(ship, speed);
  const intercept = 1 - none;
  return { zones, intercept, ...p, caught: intercept * (1 - p.evade) * (1 - p.hidden) };
}
export function patrolHour(state, rng, ship, pos) {
  if (!ship.contraband) return null;
  const z = patrolAt(pos.lon, pos.lat);
  if (!z || !rng.chance((z.rate * equipMod(ship, 'sanction')) / D)) return null;
  const speed = ship.voyage?.speed || SHIP_TYPES[ship.type].speed;
  const p = phases(ship, speed);
  const steps = [];
  const evaded = rng.chance(p.evade);
  steps.push({ label: 'Repérage', ok: evaded, text: evaded ? 'Le navire file sans répondre aux appels et se perd dans le trafic.' : 'Une vedette rattrape le navire et monte à bord.' });
  const report = { zone: z.name, phases: steps, outcome: 'evaded' };
  if (evaded) { shipLog(state, ship, `Contrôle des ${z.name} évité`); return report; }
  const hidden = rng.chance(p.hidden);
  steps.push({ label: 'Fouille', ok: hidden, text: hidden ? 'Les agents fouillent les cales sans rien trouver.' : 'Les agents trouvent le colis.' });
  if (hidden) { report.outcome = 'searched'; shipLog(state, ship, `Fouillé par les ${z.name} : rien trouvé`); return report; }
  // Colis trouvé : saisie, amende, navire dérouté et retenu.
  const company = companyOf(state, ship);
  const fine = seizureFine(ship.contraband.pay);
  const days = rng.int(10, 25);
  ship.contraband = null;
  money(state, company, -fine, 'sinistres');
  changeReputation(company, -15);
  ship.voyage.stalledUntil = state.t + days * D;
  report.outcome = 'seized';
  report.fine = fine;
  report.days = days;
  news(state, `Les ${z.name} saisissent un colis de contrebande à bord du ${ship.name} (${company.name}) : amende de ${(fine / 1e6).toFixed(2).replace('.', ',')} M$, navire retenu ${days} jours.`, { company: company.id, kind: 'disaster' });
  shipLog(state, ship, `Colis saisi par les ${z.name}`);
  return report;
}
