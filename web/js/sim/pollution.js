// Pollution : une cargaison dangereuse qui se déverse en mer (naufrage, échouement,
// abordage, voie d'eau) coûte un nettoyage, surtout près des côtes sensibles.
// L'assurance paie pour un navire en état de naviguer ; sinon l'armateur paie,
// et le pays touché peut lui fermer ses ports pendant un an.
import { ZONES } from '../data/zones.js';
import { GOODS } from '../data/goods.js';
import { SHIP_TYPES } from '../data/ships.js';
import { PORTS, FLAGS } from '../data/ports.js';
import { haversineNm } from './routing.js';
import { money, news, changeReputation } from './core.js';
import { HOURS_PER_DAY } from './util.js';
import { SEAWORTHY } from './incidents.js';
import { equipMod } from './equipment.js';

export const CLEANUP_RATE = 600;    // $ par tonne de « pollution équivalent brut »
export const OPEN_SEA_FACTOR = 0.15; // déversement au large, loin des côtes
export const BAN_DAYS = 365;
export const FUEL_POLLUTION = 1;     // fuel lourd des soutes : aussi tenace que le brut

// Zone sensible où se trouve un point (la plus coûteuse s'il y en a plusieurs).
export function zoneAt(lon, lat) {
  let best = null;
  for (const z of ZONES) if (haversineNm(lon, lat, z.lon, z.lat) <= z.r && (!best || z.factor > best.factor)) best = z;
  return best;
}
// Zones sensibles traversées par un tracé de route.
export function zonesAlong(route) {
  if (!route?.points) return [];
  const found = new Map();
  const pts = route.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[i + 1] || a;
    for (let k = 0; k <= 4; k++) {
      const lon = a[0] + (b[0] - a[0]) * (k / 4), lat = a[1] + (b[1] - a[1]) * (k / 4);
      const z = zoneAt(((lon + 540) % 360) - 180, lat);
      if (z) found.set(z.id, z);
    }
  }
  return [...found.values()];
}

// Gravité d'une cargaison (équivalent brut, en tonnes) si elle se déverse entièrement.
export function cargoPollution(cargo) {
  if (!cargo) return 0;
  return cargo.qty * (GOODS[cargo.good].pollution || 0);
}
export const isPolluting = (good) => (GOODS[good]?.pollution || 0) >= 0.2;

// Ce que coûterait un déversement, et qui le paierait.
export function spillCost(ship, pollutionT, factor, startCond) {
  const liability = pollutionT * CLEANUP_RATE * factor;
  const insured = startCond >= SEAWORTHY;
  const T = SHIP_TYPES[ship.type];
  // Navire en état : l'assurance paie, il reste une franchise. Sinon, l'armateur paie
  // jusqu'à la limite de responsabilité (liée à la jauge du navire).
  const due = insured ? Math.min(liability, Math.max(100000, Math.min(5e6, liability * 0.05))) : Math.min(liability, 1500 * T.gt * Math.max(1, factor));
  return { liability, insured, due };
}

// Pire cas d'un voyage (affiché avant le départ) : naufrage dans la zone la plus sensible de la route.
export function worstCase(ship, route, startCond = ship.condition) {
  const zones = zonesAlong(route);
  const factor = zones.reduce((m, z) => Math.max(m, z.factor), OPEN_SEA_FACTOR);
  const pollutionT = cargoPollution(ship.cargo) * equipMod(ship, 'spill') + ship.fuel * FUEL_POLLUTION;
  return { zones, factor, pollutionT, ...spillCost(ship, pollutionT, factor, startCond) };
}

// Déversement réel : share = part de la cargaison perdue (1 au naufrage).
export function spill(state, ship, company, pos, share, { sinking = false, nearCoast = false, notes = null, note = null } = {}) {
  const cargoT = cargoPollution(ship.cargo) * share * equipMod(ship, 'spill'); // coque renforcée : moins de déversement
  const fuelT = sinking ? ship.fuel * 0.8 * FUEL_POLLUTION : 0;
  const pollutionT = cargoT + fuelT;
  if (pollutionT < 50) return null;
  const zone = zoneAt(pos.lon, pos.lat);
  const factor = zone ? zone.factor : nearCoast ? 0.6 : OPEN_SEA_FACTOR;
  const startCond = ship.voyage?.startCond ?? ship.condition;
  const c = spillCost(ship, pollutionT, factor, startCond);
  money(state, company, -c.due, 'sinistres');
  changeReputation(company, -Math.min(20, 2 + c.liability / 10e6));
  const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
  st.spills = (st.spills || 0) + 1;
  (state.spills ??= []).push({ lon: pos.lon, lat: pos.lat, t: state.t, tonnes: Math.round(pollutionT), zone: zone?.id || null, company: company.id });
  if (state.spills.length > 40) state.spills.shift();
  const where = zone ? `sur les ${zone.name.charAt(0).toLowerCase() + zone.name.slice(1)}` : nearCoast ? 'près des côtes' : 'au large';
  const M = (x) => `${(x / 1e6).toFixed(1).replace('.', ',')} M$`;
  let ban = '';
  // Négligence (navire inapte) dans une zone sensible : le pays ferme ses ports au pollueur.
  if (!c.insured && zone && zone.factor >= 2 && Object.values(PORTS).some((P) => P.flag === zone.flag)) {
    (company.bans ??= {})[zone.flag] = state.t + BAN_DAYS * HOURS_PER_DAY;
    ban = ` ${FLAGS[zone.flag].name} interdit ses ports à ${company.name} pendant un an.`;
  }
  const text = `Marée noire ${where} : ${Math.round(pollutionT).toLocaleString('fr-FR')} t de polluants échappés du ${ship.name}. Nettoyage : ${M(c.liability)}, ${c.insured ? `l'assurance paie, franchise de ${M(c.due)}` : `entièrement à la charge de ${company.name} (${M(c.due)}), le navire n'étant pas en état de naviguer`}.${ban}`;
  news(state, text, { company: company.id, kind: 'disaster' });
  if (note) note(state, notes, 'pollution', ship, text);
  return { ...c, pollutionT, zone };
}

export const bannedUntil = (company, flag) => (company?.bans?.[flag] || 0);
