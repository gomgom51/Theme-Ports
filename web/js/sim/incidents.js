// Incidents en mer : avaries, incendies, abordages, échouements, voies d'eau,
// cargaisons abîmées par le gros temps… Un navire vieux ou mal entretenu en subit
// bien plus, mais même un bon navire n'est jamais à l'abri d'un naufrage.
import { SHIP_TYPES, CREW_LEVELS } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { PORTS } from '../data/ports.js';
import { HOURS_PER_DAY } from './util.js';
import * as eco from './economy.js';
import { equipMod } from './equipment.js';
import { SEAWORTHY, coverage } from './insurance.js';
export { SEAWORTHY };

const D = HOURS_PER_DAY;

// Fréquence de base : un incident tous les deux ans et demi de mer pour un navire neuf.
export const INCIDENT_BASE = 0.0016; // par jour de mer
// Réglages globaux (équilibrage, tests).
export const RISK = { incidents: 1, inspections: 1, sinking: 1 };

// Multiplicateur d'usure : l'âge et surtout l'état de la coque et des machines.
export function wearRisk(condition, age) {
  return (1 + age / 30) * (1 + Math.pow((100 - condition) / 40, 2));
}
export function weatherRisk(force) {
  return force >= 8 ? 1 + (force - 7) * 0.9 : 1;
}
// Probabilité qu'un incident grave finisse en perte totale.
export function sinkChance(condition, force, crewLevel = 0) {
  return 0.024 * RISK.sinking * CREW_LEVELS[crewLevel || 0].safety * (1 + Math.pow((100 - condition) / 40, 2)) * (force >= 10 ? 2 : 1);
}

// Tire un incident pour cette heure de mer (ou null).
// nearCoast : moins de 150 milles du départ ou de l'arrivée (abordages, échouements).
// Poids des différents incidents ; l'équipement (radar, anti-incendie…) en réduit certains.
function incidentKinds(ship, age, force, nearCoast, mods = true) {
  const m = (k) => (mods ? equipMod(ship, k) : 1);
  const laden = !!ship.cargo;
  return [
    ['machine', 4 + age / 8],
    ['incendie', 1 * m('fire')],
    ['abordage', (nearCoast ? 2.5 : 0.4) * m('collision')],
    ['echouement', (nearCoast ? 2 : 0) * m('grounding')],
    ['voie_eau', 0.4 + 2.5 * Math.pow((100 - ship.condition) / 100, 2)],
    ['gros_temps', laden && force >= 8 ? 5 : 0],
    ['froid', laden && ship.cargo.hold === 'frigo' ? 2 : 0],
  ].filter(([, w]) => w > 0);
}
const sumW = (list) => list.reduce((s, [, w]) => s + w, 0);
// Part des incidents évités par l'équipement.
export function equipIncidentFactor(ship, age, force = 0, nearCoast = false) {
  return sumW(incidentKinds(ship, age, force, nearCoast)) / sumW(incidentKinds(ship, age, force, nearCoast, false));
}

export function rollIncident(rng, ship, { age, force, nearCoast }) {
  const kinds = incidentKinds(ship, age, force, nearCoast);
  const p = (INCIDENT_BASE / D) * RISK.incidents * CREW_LEVELS[ship.crew || 0].safety * wearRisk(ship.condition, age) * weatherRisk(force)
    * (sumW(kinds) / sumW(incidentKinds(ship, age, force, nearCoast, false)));
  if (!rng.chance(p)) return null;
  const T = SHIP_TYPES[ship.type];
  const laden = !!ship.cargo;
  const kind = rng.weighted(kinds);
  const size = Math.sqrt(T.gt / 5000);
  const r = (a, b) => rng.range(a, b);
  const inc = { kind, cost: 0, cond: 0, delayH: 0, damage: 0, rep: 0, severe: false };
  switch (kind) {
    case 'machine':
      Object.assign(inc, { cost: r(20000, 60000) * size, cond: r(1, 4), delayH: rng.int(12, 72) });
      break;
    case 'incendie':
      Object.assign(inc, { cost: r(80000, 300000) * size, cond: r(8, 25), delayH: rng.int(24, 72), damage: laden ? r(0.1, 0.4) : 0, severe: true });
      break;
    case 'abordage':
      Object.assign(inc, { cost: r(100000, 500000) * size, cond: r(6, 20), delayH: rng.int(18, 48), damage: laden ? r(0, 0.2) : 0, rep: -2, severe: true });
      break;
    case 'echouement':
      Object.assign(inc, { cost: 50000 + r(0.015, 0.04) * T.price * 1e6, cond: r(10, 30), delayH: rng.int(48, 144), damage: laden ? r(0, 0.25) : 0, rep: -2, severe: true });
      break;
    case 'voie_eau':
      Object.assign(inc, { cost: r(40000, 150000) * size, cond: r(10, 20), delayH: rng.int(24, 48), damage: laden ? r(0.1, 0.3) : 0, severe: true });
      break;
    case 'gros_temps':
      Object.assign(inc, { cost: r(10000, 40000) * size, cond: r(2, 6), damage: r(0.05, 0.3), severe: force >= 10 });
      break;
    case 'froid':
      Object.assign(inc, { cost: r(15000, 50000) * size, cond: r(0, 2), damage: r(0.1, 0.4) });
      break;
  }
  inc.cost = Math.round(inc.cost);
  return inc;
}

// Texte de l'incident pour le journal et les notifications.
export function incidentText(inc, ship) {
  const G = ship.cargo ? GOODS[ship.cargo.good] : null;
  const dmg = inc.damage > 0.005 && G ? ` ${Math.round(inc.damage * 100)} % de la cargaison (${G.name.toLowerCase()}) est perdue ou avariée.` : '';
  const days = inc.delayH ? ` Immobilisé ${Math.round((inc.delayH / 24) * 10) / 10} j.` : '';
  const cost = ` Coût : ${Math.round(inc.cost / 1000).toLocaleString('fr-FR')} k$.`;
  const containers = ship.cargo?.hold === 'conteneurs';
  const T = {
    machine: `Avarie de machine à bord du ${ship.name}.`,
    incendie: `Incendie à bord du ${ship.name} ! L'équipage a maîtrisé le feu.`,
    abordage: `Abordage : le ${ship.name} est entré en collision avec un autre navire.`,
    echouement: `Le ${ship.name} s'est échoué ! Il a fallu des remorqueurs pour le dégager.`,
    voie_eau: `Voie d'eau sur le ${ship.name} : une tôle fissurée a cédé, les pompes tournent à plein.`,
    gros_temps: containers ? `Gros temps : le ${ship.name} a perdu des conteneurs par-dessus bord.` : `Gros temps : la cargaison du ${ship.name} a ripé et pris l'eau.`,
    froid: `Panne des groupes frigorifiques à bord du ${ship.name}.`,
  }[inc.kind];
  return T + dmg + days + cost;
}

// Assurance corps et machines : selon la formule choisie, et seulement si le navire
// était en état de naviguer au départ (clause de navigabilité).
export function hullInsurance(state, ship, startCond, company) {
  const cov = coverage(company, startCond);
  return cov.hull ? eco.shipValue(state, { ...ship, condition: Math.max(ship.condition, 50) }) * cov.hull : 0;
}

// ---------- Contrôle par l'État du port ----------
// Les pays exigeants inspectent les navires fatigués ; un navire en mauvais état
// est retenu à quai jusqu'à ce qu'il soit remis en état, aux frais de l'armateur.
export const STRICT_FLAGS = new Set(['NL', 'DE', 'FR', 'GR', 'US', 'CA', 'JP', 'AU', 'KR', 'SG']);
export const DETENTION_REPAIR = 65;

export const inspectionThreshold = (age) => (age > 20 ? 62 : 55);
export const isStrict = (port) => STRICT_FLAGS.has(PORTS[port].flag);
// Probabilités d'inspection et de détention à l'arrivée (affichées au joueur avant le départ).
export function inspectionOdds(condition, port, age) {
  const threshold = inspectionThreshold(age);
  if (condition >= threshold) return { inspect: 0, detain: 0 };
  const gap = threshold - condition;
  const inspect = RISK.inspections * (isStrict(port) ? Math.min(0.95, 0.3 + gap / 50) : Math.min(0.5, 0.06 + gap / 150));
  const detainIfInspected = Math.min(0.95, Math.max(0.08, gap / 35));
  return { inspect, detain: inspect * detainIfInspected, detainIfInspected };
}

export function inspection(state, rng, ship, port, age) {
  const strict = isStrict(port);
  const odds = inspectionOdds(ship.condition, port, age);
  if (!odds.inspect || !rng.chance(odds.inspect)) return null;
  if (!rng.chance(odds.detainIfInspected)) return { kind: 'remarques', strict };
  const T = SHIP_TYPES[ship.type];
  const fine = Math.round((30000 + rng.next() * 90000) * Math.sqrt(T.gt / 5000));
  // Remise en état imposée : au chantier du port s'il y en a un (au prix fort, c'est urgent),
  // sinon par une équipe dépêchée sur place, plus chère et limitée à 50 %.
  let target = DETENTION_REPAIR, cost, hours;
  const rc = eco.repairCost(state, ship, port, target);
  if (rc && rc.points > 0) {
    target = rc.to; cost = rc.cost * 1.25; hours = rc.hours + 48;
  } else {
    target = Math.max(50, Math.round(ship.condition) + 8);
    const points = target - ship.condition;
    cost = points * T.price * 1e6 * 0.0011 * (1 + (100 - ship.condition) / 120) * 2.2 * eco.repairIndex(state);
    hours = Math.ceil(points * 0.12 * 1.5 * D) + 48;
  }
  return { kind: 'detention', strict, fine, target, cost: Math.round(cost), hours };
}

// ---------- Ce que le joueur voit ----------
// Profil de risque d'un navire, calculé avec les mêmes formules que la simulation.
const SEA_SHARE = 0.75; // part du temps passé en mer
export function riskProfile(state, ship, condition = ship.condition) {
  const age = eco.ageYears(state, ship);
  const safety = CREW_LEVELS[ship.crew || 0].safety;
  const perSeaDay = INCIDENT_BASE * RISK.incidents * safety * wearRisk(condition, age) * (0.8 * equipIncidentFactor(ship, age) + 0.2 * equipIncidentFactor(ship, age, 0, true));
  const incidentsPerYear = perSeaDay * 365 * SEA_SHARE;
  // Part des incidents graves (incendie, abordage, échouement, voie d'eau) parmi tous les incidents.
  const severeW = equipMod(ship, 'fire') * (1 + 0.5 * equipMod(ship, 'fireSink')) / 1.5 + 1.2 * equipMod(ship, 'collision') + 0.8 * equipMod(ship, 'grounding') + 0.4 + 2.5 * Math.pow((100 - condition) / 100, 2);
  const severeShare = severeW / (severeW + 4 + age / 8);
  const sinkPerYear = 1 - Math.exp(-incidentsPerYear * severeShare * sinkChance(condition, 7, ship.crew) * 1.15);
  const insured = condition >= SEAWORTHY;
  const level = sinkPerYear < 0.012 ? 0 : sinkPerYear < 0.03 ? 1 : sinkPerYear < 0.08 ? 2 : 3;
  return { age, incidentsPerYear, sinkPerYear, insured, level, label: ['faible', 'moyen', 'élevé', 'très élevé'][level] };
}
// Risque sur un voyage précis (au moins un incident, naufrage), d'après sa durée en mer.
export function voyageRisk(state, ship, seaDays) {
  const p = riskProfile(state, ship);
  const perDay = p.incidentsPerYear / (365 * SEA_SHARE);
  return { incident: 1 - Math.exp(-perDay * seaDays), sink: 1 - Math.pow(1 - p.sinkPerYear, seaDays / (365 * SEA_SHARE)), insured: p.insured };
}
