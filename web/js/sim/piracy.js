// Piraterie, version simple : votre défense, ceux qui tentent de monter à bord,
// puis un résultat en trois phases (approche, abordage, combat à bord).
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { haversineNm } from './routing.js';
import { book, news, changeTrust, shipLog, companyOf, shipById, costStat } from './core.js';
import { HOURS_PER_DAY, inPoly } from './util.js';
import { EQUIPMENT } from '../data/equipment.js';
import { hasCitadel, hasEquip } from './equipment.js';
import * as eco from './economy.js';
import { pirateBoost, PIRATE_BOOST, PIRATE_STRENGTH } from './plots.js';
import { onRepelled } from './honours.js';
import { skillDefence, crewFight } from './crew.js';
import { money } from './format.js';

const D = HOURS_PER_DAY;
//  lon, lat : où se pose le pavillon pirate sur la carte
//  rate     : probabilité d'attaque par jour passé dans la zone
//             (ajustée quand les cercles sont devenus des contours : même exposition moyenne sur l'ensemble des routes)
//  strength : force des assaillants (min, max)
//  poly     : contour [lon, lat] de la zone, là où les attaques ont vraiment lieu ; la carte le dessine lissé
export const PIRACY_ZONES = [
  { id: 'aden', name: 'Golfe d\'Aden et bassin somalien', lon: 50, lat: 12.5, rate: 0.016, strength: [2, 7], level: 'forte',
    poly: [[43.3, 12.5], [45.0, 12.6], [47.5, 13.4], [50.5, 14.2], [53.5, 15.0], [57.5, 14.5], [61.0, 11.0], [61.5, 5.0], [57.0, -0.5], [49.0, -2.5], [44.5, -2.0], [47.2, 2.5], [50.0, 6.5], [51.9, 10.6], [51.5, 12.0], [48.0, 11.7], [45.0, 11.0], [43.4, 11.3], [42.8, 11.5], [42.9, 12.1]] },
  { id: 'guinee', name: 'Golfe de Guinée', lon: 3.5, lat: 3.5, rate: 0.014, strength: [3, 8], level: 'forte',
    poly: [[-4.5, 4.9], [-1.0, 4.8], [0.2, 5.9], [1.8, 6.1], [3.5, 6.7], [5.0, 5.6], [6.0, 4.1], [7.5, 4.2], [8.8, 4.2], [9.3, 3.5], [9.3, 1.0], [8.8, -1.5], [6.0, -2.5], [2.5, -1.0], [-1.0, 1.0], [-4.5, 2.8]] },
  { id: 'malacca', name: 'Détroits de Malacca et de Singapour', lon: 102, lat: 2.2, rate: 0.0033, strength: [1, 4], level: 'moyenne',
    poly: [[96.6, 6.2], [98.8, 7.0], [100.3, 5.6], [101.0, 4.0], [101.6, 3.0], [102.6, 2.2], [103.6, 1.7], [104.9, 1.7], [104.9, 0.6], [103.4, 0.5], [102.0, 1.0], [100.8, 1.7], [99.6, 2.8], [98.4, 3.8], [97.0, 4.7]] },
  { id: 'sulu', name: 'Mers de Sulu et de Célèbes', lon: 121, lat: 6.5, rate: 0.0064, strength: [2, 5], level: 'moyenne',
    poly: [[119.0, 10.2], [121.6, 9.2], [122.4, 7.3], [124.0, 6.5], [125.3, 5.3], [125.3, 3.0], [123.8, 1.6], [120.8, 1.6], [118.8, 3.0], [118.5, 4.8], [118.9, 6.3], [118.6, 8.4]] },
  { id: 'venezuela', name: 'Côtes du Venezuela', lon: -66, lat: 11.5, rate: 0.0052, strength: [1, 4], level: 'faible',
    poly: [[-71.6, 12.2], [-68.5, 12.8], [-65.5, 12.4], [-62.5, 11.9], [-61.2, 11.2], [-61.4, 10.2], [-62.8, 10.4], [-64.6, 10.0], [-66.6, 10.4], [-68.4, 10.3], [-69.6, 11.2], [-71.3, 10.9]] },
];
export const ATTACKERS = [
  { max: 2.5, name: 'des pirates en skiff' },
  { max: 5, name: 'un commando armé' },
  { max: 99, name: 'une bande lourdement armée, avec un navire-mère' },
];
const attackerName = (s) => ATTACKERS.find((a) => s <= a.max).name;

export function piracyZoneAt(lon, lat) {
  return PIRACY_ZONES.find((z) => inPoly(lon, lat, z.poly)) || null;
}
// Zones traversées par une route, et milles parcourus dans chacune.
export function piracyAlong(route) {
  if (!route?.points) return [];
  const found = new Map();
  const pts = route.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = haversineNm(a[0], a[1], b[0], b[1]);
    const n = Math.max(1, Math.ceil(seg / 50));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, lon = a[0] + (b[0] - a[0]) * t, lat = a[1] + (b[1] - a[1]) * t;
      const z = piracyZoneAt(((lon + 540) % 360) - 180, lat);
      if (z) found.set(z.id, { zone: z, nm: (found.get(z.id)?.nm || 0) + seg / n });
    }
  }
  return [...found.values()];
}

// Les trois phases : valeur de défense et d'attaque de chacune.
function phaseValues(ship, speed, s) {
  const crew = crewFight(ship);
  return [
    { id: 'approche', label: 'Approche', def: Math.max(0, (speed - 13) / 2.5) + (hasEquip(ship, 'navigation') ? 0.7 : 0), att: s / 3,
      win: 'Le navire accélère et sème les embarcations.', lose: 'Les embarcations rattrapent le navire.' },
    { id: 'abordage', label: 'Abordage', def: (hasEquip(ship, 'barbeles') ? 1.6 : 0) + crew + skillDefence(ship), att: s / 2.2,
      win: 'Barbelés et lances à eau : les échelles retombent à la mer.', lose: 'Les assaillants grimpent à bord.' },
    { id: 'combat', label: 'Combat à bord', def: (hasEquip(ship, 'gardes') ? 4 : 0) + crew + skillDefence(ship), att: s / 1.6,
      win: 'Les gardes repoussent les assaillants.', lose: 'L\'équipage est débordé.' },
  ];
}
const phaseOdds = (p) => Math.max(0.05, Math.min(0.95, 0.2 + 0.18 * (p.def - p.att)));
// Chance de repousser une attaque de force s (affichée avant le départ).
export function repelChance(ship, speed, s) {
  let fail = 1;
  for (const p of phaseValues(ship, speed, s)) fail *= 1 - phaseOdds(p);
  return 1 - fail;
}
// Risque d'un voyage : probabilité d'au moins une attaque, et de la repousser. Avec l'état
// de la partie, compte aussi les pirates payés par un concurrent pour viser ce navire.
export function piracyRisk(ship, route, speed, state = null) {
  const zones = piracyAlong(route);
  if (!zones.length) return null;
  let noAttack = 1, worst = null, targeted = false, boost = 0;
  for (const { zone, nm } of zones) {
    const days = nm / (24 * speed);
    const hired = state && pirateBoost(state, ship, zone.id);
    if (hired) targeted = true;
    noAttack *= Math.exp(-zone.rate * (hired ? PIRATE_BOOST : 1) * days);
    if (!worst || zone.strength[1] > worst.strength[1]) { worst = zone; boost = hired ? PIRATE_STRENGTH : 0; }
  }
  const mid = (worst.strength[0] + worst.strength[1]) / 2 + boost;
  return { zones, attack: 1 - noAttack, repel: repelChance(ship, speed, mid), repelWorst: repelChance(ship, speed, worst.strength[1] + boost), worst, targeted };
}

// Une heure de mer : une attaque survient-elle ? Renvoie le rapport de combat.
export function piracyHour(state, rng, ship, pos) {
  const z = piracyZoneAt(pos.lon, pos.lat);
  if (!z) return null;
  const hired = pirateBoost(state, ship, z.id); // payés par un concurrent : plus souvent, mieux armés
  if (!rng.chance((z.rate * (hired ? PIRATE_BOOST : 1)) / D)) return null;
  const s = Math.round((rng.range(z.strength[0], z.strength[1]) + (hired ? PIRATE_STRENGTH : 0)) * 10) / 10;
  const speed = ship.voyage?.speed || SHIP_TYPES[ship.type].speed;
  const phases = [];
  let repelled = false;
  for (const p of phaseValues(ship, speed, s)) {
    const ok = rng.chance(phaseOdds(p));
    phases.push({ label: p.label, def: Math.round(p.def * 10) / 10, att: Math.round(p.att * 10) / 10, ok, text: ok ? p.win : p.lose });
    if (ok) { repelled = true; break; }
  }
  const report = { zone: z.name, hired: !!hired, attackers: attackerName(s), strength: s, phases, equipment: (ship.equipment || []).map((id) => EQUIPMENT[id].icon + ' ' + EQUIPMENT[id].name) };
  const company = companyOf(state, ship);
  const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
  st.piracy = st.piracy || { attacks: 0, repelled: 0, looted: 0, hijacked: 0 };
  st.piracy.attacks++;
  if (repelled) {
    st.piracy.repelled++;
    onRepelled(companyOf(state, ship));
    report.outcome = 'repelled';
    shipLog(state, ship, `Attaque de pirates repoussée (${z.name})`);
    return report;
  }
  const size = Math.sqrt(SHIP_TYPES[ship.type].gt / 5000);
  if (hasCitadel(ship)) {
    // L'équipage s'enferme : les pirates pillent ce qu'ils peuvent et repartent.
    st.piracy.looted++;
    const loot = Math.round(rng.range(40000, 140000) * size / 1000) * 1000;
    book(state, company, -loot, 'sinistres', ship);
    let stolen = 0;
    if (ship.cargo && ['divers', 'conteneurs', 'frigo', 'vehicules'].includes(ship.cargo.hold)) {
      stolen = rng.range(0.03, 0.12);
      const d = ship.cargo.damage || 0;
      ship.cargo.damage = Math.min(0.9, d + stolen * (1 - d));
    }
    ship.voyage.stalledUntil = state.t + rng.int(12, 36);
    report.outcome = 'looted';
    report.loss = loot;
    report.stolen = stolen;
    shipLog(state, ship, `Pillé par des pirates, équipage réfugié dans la citadelle`);
    return report;
  }
  // Navire détourné : rançon à payer (ou à négocier, pour un joueur).
  st.piracy.hijacked++;
  const cargoValue = ship.cargo ? ship.cargo.qty * GOODS[ship.cargo.good].price : 0;
  const ransom = Math.round(Math.max(150000, Math.min(9e6, eco.shipValue(state, ship) * 0.1 + cargoValue * 0.02)) / 10000) * 10000;
  ship.voyage.stalledUntil = state.t + 365 * D; // retenu jusqu'au paiement
  ship.hijacked = { ransom, t: state.t, zone: z.name };
  changeTrust(company, -3, 'navires détournés');
  report.outcome = 'hijacked';
  report.ransom = ransom;
  news(state, `Le ${ship.name} (${company.name}) a été détourné par des pirates (${z.name}). Ils réclament ${money(ransom)}.`, { company: company.id, kind: 'disaster' });
  shipLog(state, ship, `Détourné par des pirates (${z.name})`);
  if (!company.human) resolveHijack(state, rng, ship.id, 'payer');
  return report;
}

// Rançon : 'payer' (libéré en quelques jours) ou 'negocier' (55 % du prix, mais 1 à 2 mois de captivité).
export function resolveHijack(state, rng, shipId, choice) {
  const ship = shipById(state, shipId);
  if (!ship?.hijacked) return { ok: false, msg: 'Aucun navire retenu.' };
  const company = companyOf(state, ship);
  const h = ship.hijacked;
  const pay = choice === 'negocier' ? Math.round(h.ransom * 0.55 / 10000) * 10000 : h.ransom;
  const days = choice === 'negocier' ? rng.int(30, 60) : rng.int(3, 7);
  book(state, company, -pay, 'sinistres', ship);
  costStat(state, 'rancons', pay);
  ship.voyage.stalledUntil = state.t + days * D;
  ship.hijacked = null;
  if (choice === 'negocier') changeTrust(company, -3, 'navires détournés');
  shipLog(state, ship, `Rançon versée (${money(pay)}), libération dans ${days} jours`);
  ship.voyage.released = { zone: h.zone, t0: h.t }; // la libération sera annoncée dans les nouvelles (game.js)
  return { ok: true, pay, days };
}
