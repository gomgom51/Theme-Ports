// Piraterie, version simple : votre défense, ceux qui tentent de monter à bord,
// puis un résultat en trois phases (approche, abordage, combat à bord).
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { haversineNm } from './routing.js';
import { money, news, changeTrust, shipLog, companyOf, shipById, costStat } from './core.js';
import { HOURS_PER_DAY } from './util.js';
import { EQUIPMENT } from '../data/equipment.js';
import { hasCitadel, hasEquip } from './equipment.js';
import * as eco from './economy.js';
import { pirateBoost, PIRATE_BOOST, PIRATE_STRENGTH } from './plots.js';
import { onRepelled } from './honours.js';
import { skillDefence } from './crew.js';

const D = HOURS_PER_DAY;
//  rate     : probabilité d'attaque par jour passé dans la zone
//  strength : force des assaillants (min, max)
export const PIRACY_ZONES = [
  { id: 'aden', name: 'Golfe d\'Aden et bassin somalien', lon: 50, lat: 12.5, r: 620, rate: 0.01, strength: [2, 7], level: 'forte' },
  { id: 'guinee', name: 'Golfe de Guinée', lon: 3.5, lat: 3.5, r: 420, rate: 0.012, strength: [3, 8], level: 'forte' },
  { id: 'malacca', name: 'Détroits de Malacca et de Singapour', lon: 102, lat: 2.2, r: 280, rate: 0.003, strength: [1, 4], level: 'moyenne' },
  { id: 'sulu', name: 'Mers de Sulu et de Célèbes', lon: 121, lat: 6.5, r: 320, rate: 0.004, strength: [2, 5], level: 'moyenne' },
  { id: 'venezuela', name: 'Côtes du Venezuela', lon: -66, lat: 11.5, r: 260, rate: 0.003, strength: [1, 4], level: 'faible' },
];
export const ATTACKERS = [
  { max: 2.5, name: 'des pirates en skiff' },
  { max: 5, name: 'un commando armé' },
  { max: 99, name: 'une bande lourdement armée, avec un navire-mère' },
];
const attackerName = (s) => ATTACKERS.find((a) => s <= a.max).name;

export function piracyZoneAt(lon, lat) {
  return PIRACY_ZONES.find((z) => haversineNm(lon, lat, z.lon, z.lat) <= z.r) || null;
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
  const crew = (ship.crew || 0) * 0.5;
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
    money(state, company, -loot, 'sinistres', ship);
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
  changeTrust(company, -3);
  report.outcome = 'hijacked';
  report.ransom = ransom;
  news(state, `Le ${ship.name} (${company.name}) a été détourné par des pirates (${z.name}). Ils réclament ${(ransom / 1e6).toFixed(1).replace('.', ',')} M$.`, { company: company.id, kind: 'disaster' });
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
  money(state, company, -pay, 'sinistres', ship);
  costStat(state, 'rancons', pay);
  ship.voyage.stalledUntil = state.t + days * D;
  ship.hijacked = null;
  if (choice === 'negocier') changeTrust(company, -3);
  shipLog(state, ship, `Rançon versée (${(pay / 1e6).toFixed(2).replace('.', ',')} M$), libération dans ${days} jours`);
  return { ok: true, pay, days };
}
