// Fonctions communes à toute la simulation : comptabilité, nouvelles, flotte.
import { PORTS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES, SHIP_NAMES } from '../data/ships.js';
import { HOURS_PER_DAY } from './util.js';
import { shipValue } from './economy.js';

// Postes comptables (positif = recette, négatif = dépense).
export const BOOK_LABELS = {
  fret: 'Recettes de fret',
  negoce: 'Ventes de marchandises',
  achats: 'Achats de marchandises',
  carburant: 'Carburant',
  equipage: 'Salaires d\'équipage',
  exploitation: 'Entretien et assurance',
  ports: 'Ports, pilotes et canaux',
  reparations: 'Réparations',
  sinistres: 'Sinistres, amendes et indemnités',
  discret: 'Affaires discrètes',
  interets: 'Intérêts bancaires',
  impots: 'Impôts',
  divers: 'Divers',
};
export const emptyBook = () => Object.fromEntries(Object.keys(BOOK_LABELS).map((k) => [k, 0]));
export const bookTotal = (b) => Object.values(b).reduce((s, v) => s + v, 0);

export function money(state, company, amount, category) {
  company.cash += amount;
  company.month[category] = (company.month[category] || 0) + amount;
  company.total[category] = (company.total[category] || 0) + amount;
}

// Statistiques de sinistres (équilibrage) : cumul par cause.
export function costStat(state, key, amount) {
  const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
  (st.costs ??= {})[key] = (st.costs[key] || 0) + amount;
}

export function news(state, text, opts = {}) {
  state.news.unshift({ t: state.t, text, company: opts.company ?? null, kind: opts.kind || 'info' });
  if (state.news.length > 160) state.news.length = 160;
}

export const companyOf = (state, ship) => state.companies[ship.owner];
export const shipsOf = (state, companyId) => state.ships.filter((s) => s.owner === companyId);
export const shipById = (state, id) => state.ships.find((s) => s.id === id);
export const contractById = (state, id) => state.contracts.find((c) => c.id === id);
export const portName = (p) => PORTS[p]?.name || p;

// Un navire « disponible » : à quai, pas occupé, sans départ programmé.
export function isIdle(ship) {
  return ship.status === 'port' && !ship.busyWhat && !ship.plan;
}

export function fleetValue(state, companyId) {
  return shipsOf(state, companyId).reduce((s, sh) => s + shipValue(state, sh), 0);
}
export function cargoValue(state, companyId) {
  return shipsOf(state, companyId).reduce((s, sh) => s + (sh.cargo && sh.cargo.cost ? sh.cargo.cost : 0), 0);
}
export function ordersValue(state, companyId) {
  return state.orders.filter((o) => o.owner === companyId).reduce((s, o) => s + o.paid, 0);
}
// Paiements à encaisser et créances à venir.
export function pendingValue(state, companyId) {
  let v = 0;
  for (const p of state.payments || []) if (p.company === companyId) v += p.pay * (1 - p.penalty);
  for (const r of state.receivables || []) if (r.company === companyId) v += r.amount;
  return v;
}
export function netWorth(state, companyId) {
  const c = state.companies[companyId];
  return c.cash + fleetValue(state, companyId) + cargoValue(state, companyId) + ordersValue(state, companyId) + pendingValue(state, companyId) - c.debt;
}

export function creditLimit(state, company) {
  return Math.max(0, 0.6 * fleetValue(state, company.id) + company.reputation * 25000);
}
export function interestRate(company) {
  return FLAGS[company.flag].rate + ((100 - company.reputation) / 100) * 0.06;
}
export function changeReputation(company, delta) {
  company.reputation = Math.max(0, Math.min(100, company.reputation + delta));
}

export function pickShipName(state, rng) {
  const used = new Set(state.ships.map((s) => s.name));
  const free = SHIP_NAMES.filter((n) => !used.has(n));
  if (free.length) return rng.pick(free);
  return `${rng.pick(SHIP_NAMES)} ${rng.int(2, 9)}`;
}

export function createShip(state, rng, owner, typeId, { port, age = 0, condition = 100, name } = {}) {
  const T = SHIP_TYPES[typeId];
  const ship = {
    id: state.nextId++, owner, type: typeId, name: name || pickShipName(state, rng),
    builtT: Math.round(state.t - age * 365 * HOURS_PER_DAY), condition,
    fuel: Math.round(T.tank * 0.4), status: 'port', port,
    busyUntil: 0, busyWhat: null, voyage: null, cargo: null, plan: null, pendingDelivery: null,
    earned: 0, spent: 0, log: [],
  };
  state.ships.push(ship);
  return ship;
}

export function shipLog(state, ship, text) {
  ship.log.unshift({ t: state.t, text });
  if (ship.log.length > 30) ship.log.length = 30;
}

export function removeShip(state, ctx, ship) {
  state.ships = state.ships.filter((s) => s !== ship);
  ctx.forget(ship.id);
  if (ship.cargo?.contractId) {
    const c = contractById(state, ship.cargo.contractId);
    if (c) state.contracts = state.contracts.filter((x) => x !== c);
  }
}
