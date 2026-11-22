// Incidents en mer : avaries, incendies, abordages, échouements, voies d'eau,
// cargaisons abîmées par le gros temps… Un navire vieux ou mal entretenu en subit
// bien plus, mais même un bon navire n'est jamais à l'abri d'un naufrage.
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { PORTS } from '../data/ports.js';
import { HOURS_PER_DAY } from './util.js';
import * as eco from './economy.js';

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
export function sinkChance(condition, force) {
  return 0.024 * RISK.sinking * (1 + Math.pow((100 - condition) / 40, 2)) * (force >= 10 ? 2 : 1);
}

// Tire un incident pour cette heure de mer (ou null).
// nearCoast : moins de 150 milles du départ ou de l'arrivée (abordages, échouements).
export function rollIncident(rng, ship, { age, force, nearCoast }) {
  const p = (INCIDENT_BASE / D) * RISK.incidents * wearRisk(ship.condition, age) * weatherRisk(force);
  if (!rng.chance(p)) return null;
  const T = SHIP_TYPES[ship.type];
  const laden = !!ship.cargo;
  const kinds = [
    ['machine', 4 + age / 8],
    ['incendie', 1],
    ['abordage', nearCoast ? 2.5 : 0.4],
    ['echouement', nearCoast ? 2 : 0],
    ['voie_eau', 0.4 + 2.5 * Math.pow((100 - ship.condition) / 100, 2)],
    ['gros_temps', laden && force >= 8 ? 5 : 0],
    ['froid', laden && ship.cargo.hold === 'frigo' ? 2 : 0],
  ].filter(([, w]) => w > 0);
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

// Assurance corps et machines : elle ne paie que si le navire était en état de
// naviguer au départ (clause de navigabilité).
export const SEAWORTHY = 40;
export function hullInsurance(state, ship, startCond) {
  if (startCond < SEAWORTHY) return 0;
  return eco.shipValue(state, { ...ship, condition: Math.max(ship.condition, 50) }) * 0.8;
}

// ---------- Contrôle par l'État du port ----------
// Les pays exigeants inspectent les navires fatigués ; un navire en mauvais état
// est retenu à quai jusqu'à ce qu'il soit remis en état, aux frais de l'armateur.
export const STRICT_FLAGS = new Set(['NL', 'DE', 'FR', 'GR', 'US', 'CA', 'JP', 'AU', 'KR', 'SG']);
export const DETENTION_REPAIR = 65;

export function inspection(state, rng, ship, port, age) {
  const P = PORTS[port];
  const strict = STRICT_FLAGS.has(P.flag);
  const threshold = age > 20 ? 62 : 55;
  if (ship.condition >= threshold) return null;
  const gap = threshold - ship.condition;
  const pInspect = RISK.inspections * (strict ? Math.min(0.95, 0.3 + gap / 50) : Math.min(0.5, 0.06 + gap / 150));
  if (!rng.chance(pInspect)) return null;
  if (!rng.chance(Math.min(0.95, Math.max(0.08, gap / 35)))) return { kind: 'remarques', strict };
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
