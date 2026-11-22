// Moteur économique : cours mondiaux, marchés locaux (offre et demande),
// carburant, réparations, valeur des navires, contrats de fret.
import { GOODS, GOOD_IDS } from '../data/goods.js';
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES, CREW_DAY_COST } from '../data/ships.js';
import { CLIENTS } from '../data/clients.js';
import { clamp, HOURS_PER_DAY } from './util.js';

export const FUEL_BASE = 620;          // $/t de fuel quand le cours des raffinés est à 1
export const HOLD_TYPES = ['vrac', 'liquide', 'divers', 'conteneurs'];
export const CANAL_FEE = { suez: 12, panama: 10 }; // $ par unité de jauge brute
export const BID_ASK = 0.015;
export const BALLAST = 1.55;

// ---------- Marché ----------
export function initMarket(rng) {
  const world = {};
  for (const g of GOOD_IDS) world[g] = rng.range(0.94, 1.06);
  const freight = {};
  for (const h of HOLD_TYPES) freight[h] = rng.range(1.18, 1.42);
  const ports = {};
  for (const p of PORT_IDS) {
    ports[p] = {};
    for (const g of GOOD_IDS) {
      ports[p][g] = { ou: rng.normal() * GOODS[g].vol * 3, imp: 0, stock: stockCap(p, g) * rng.range(0.4, 0.9) };
    }
  }
  return { market: { world, freight, fuelPremium: 1, shipIndex: 1, repairLoad: 1 }, ports };
}

export const role = (p, g) => (PORTS[p].imp[g] || 0) - (PORTS[p].exp[g] || 0);
export const exportsGood = (p, g) => (PORTS[p].exp[g] || 0) > 0;

export function production(p, g) {
  const P = PORTS[p];
  return (P.exp[g] || 0) * (P.size / 5) * GOODS[g].depth / 25; // t/jour
}
export function stockCap(p, g) { return production(p, g) * 40; }

function depth(p, g) {
  const P = PORTS[p];
  const intensity = Math.max(P.exp[g] || 0, P.imp[g] || 0);
  const roleFactor = intensity > 0 ? 0.5 + intensity : 0.35;
  return GOODS[g].depth * (0.2 + 0.16 * P.size) * roleFactor;
}

// Prix « milieu » sans l'effet des transactions récentes.
function basePrice(state, p, g) {
  const G = GOODS[g], e = state.ports[p][g];
  return G.price * state.market.world[g] * (1 + role(p, g) * G.spread / 2) * (1 + e.ou);
}
export function midPrice(state, p, g) { return basePrice(state, p, g) * (1 + state.ports[p][g].imp); }
export function buyPrice(state, p, g) { return midPrice(state, p, g) * (1 + BID_ASK); }
export function sellPrice(state, p, g) { return midPrice(state, p, g) * (1 - BID_ASK); }

// Prix moyen obtenu pour une transaction, en tenant compte de l'effet sur le marché.
export function quoteTrade(state, p, g, qty, side) {
  const e = state.ports[p][g];
  const delta = (side === 'buy' ? 1 : -1) * qty * 0.1 / depth(p, g);
  const avg = basePrice(state, p, g) * (1 + e.imp + delta / 2) * (side === 'buy' ? 1 + BID_ASK : 1 - BID_ASK);
  return { avg: Math.max(avg, 1), total: Math.max(avg, 1) * qty, delta };
}
export function applyTrade(state, p, g, qty, side) {
  const q = quoteTrade(state, p, g, qty, side);
  const e = state.ports[p][g];
  e.imp = clamp(e.imp + q.delta, -0.5, 0.9);
  if (side === 'buy') e.stock = Math.max(0, e.stock - qty);
  return q;
}
export function availableStock(state, p, g) {
  return exportsGood(p, g) ? Math.floor(state.ports[p][g].stock / 100) * 100 : 0;
}

// Coûts de manutention payés par le négociant ($/t), à l'achat et à la vente.
export const HANDLING_COST = { vrac: 3, liquide: 1.5, divers: 12, conteneurs: 10 };

export function dailyMarketUpdate(state, rng) {
  const m = state.market;
  const oilShock = rng.normal();
  for (const g of GOOD_IDS) {
    const G = GOODS[g];
    const z = g === 'brut' || g === 'raffines' ? 0.8 * oilShock + 0.6 * rng.normal() : rng.normal();
    let x = Math.log(m.world[g]);
    x += -x / 180 + G.vol * z;
    m.world[g] = clamp(Math.exp(x), 0.45, 2.6);
  }
  for (const h of HOLD_TYPES) {
    let x = Math.log(m.freight[h] / 1.3);
    x += -x / 60 + 0.022 * rng.normal();
    m.freight[h] = clamp(1.3 * Math.exp(x), 0.75, 2.4);
  }
  const avgFreight = HOLD_TYPES.reduce((s, h) => s + m.freight[h], 0) / HOLD_TYPES.length;
  m.shipIndex = clamp(m.shipIndex + (0.55 + 0.45 * avgFreight / 1.3 - m.shipIndex) / 90 + 0.004 * rng.normal(), 0.6, 1.6);
  m.fuelPremium = clamp(m.fuelPremium + (1 - m.fuelPremium) / 40 + 0.004 * rng.normal(), 0.8, 1.4);
  m.repairLoad = clamp(m.repairLoad + (1 - m.repairLoad) / 60 + 0.004 * rng.normal(), 0.8, 1.4);
  const impDecay = Math.exp(-1 / 12);
  for (const p of PORT_IDS) {
    for (const g of GOOD_IDS) {
      const e = state.ports[p][g];
      e.ou = clamp(e.ou - e.ou / 20 + GOODS[g].vol * 0.6 * rng.normal(), -0.3, 0.3);
      e.imp *= impDecay;
      if (exportsGood(p, g)) e.stock = Math.min(stockCap(p, g), e.stock + production(p, g));
    }
  }
}

// ---------- Carburant et réparations ----------
export function worldFuelPrice(state) {
  return FUEL_BASE * state.market.world.raffines * state.market.fuelPremium;
}
export function fuelPrice(state, p) {
  return worldFuelPrice(state) * PORTS[p].fuel * (1 + state.ports[p].raffines.ou * 0.4);
}
export function repairIndex(state) {
  return (0.65 + 0.35 * state.market.world.acier) * state.market.repairLoad;
}
export const REPAIR_FACTOR = [0, 1.25, 1.0, 0.85];
export const REPAIR_MAX = [0, 70, 100, 100];
export function repairCost(state, ship, p, target) {
  const P = PORTS[p];
  if (!P.repair) return null;
  const to = Math.min(target, REPAIR_MAX[P.repair]);
  const points = Math.max(0, to - ship.condition);
  const T = SHIP_TYPES[ship.type];
  // Les dégâts profonds coûtent plus cher que l'entretien courant.
  const depthFactor = 1 + (100 - ship.condition) / 120;
  const cost = points * T.price * 1e6 * 0.0011 * depthFactor * REPAIR_FACTOR[P.repair] * repairIndex(state);
  const days = points * 0.12 * (P.repair === 3 ? 0.8 : 1);
  return { to, points, cost, hours: Math.ceil(days * HOURS_PER_DAY) };
}

// ---------- Navires ----------
export const ageYears = (state, ship) => (state.t - ship.builtT) / (HOURS_PER_DAY * 365);

export function shipValue(state, ship) {
  const T = SHIP_TYPES[ship.type];
  const age = ageYears(state, ship);
  const dep = Math.max(0.07, Math.pow(Math.max(0, 1 - age / T.life), 1.25));
  return T.price * 1e6 * dep * (0.7 + 0.3 * ship.condition / 100) * state.market.shipIndex;
}
export function newShipPrice(state, typeId, flag) {
  const T = SHIP_TYPES[typeId];
  return T.price * 1e6 * Math.sqrt(state.market.shipIndex) * (1 - (FLAGS[flag]?.subsidy || 0));
}

// Un vieux navire consomme plus (coque encrassée, moteur fatigué) et coûte plus
// cher à entretenir. `age` en années (0 pour un navire neuf ou une estimation).
export function burnPerDay(T, speed, age = 0) { return T.burn * Math.pow(speed / T.speed, 3) * (1 + age * 0.006); }
export function crewDayCost(T, flag) { return T.crew * CREW_DAY_COST * (FLAGS[flag]?.crew ?? 1); }
export function opexDay(T, age = 0) { return T.opex * (1 + age * 0.015); }
export function fixedDayCost(T, flag, status, age = 0) {
  const crew = crewDayCost(T, flag);
  if (status === 'laidup') return opexDay(T, age) * 0.3 + crew * 0.2;
  return opexDay(T, age) + crew;
}
export function portFee(T, p) { return (5000 + T.gt) * PORTS[p].fees; }
export function canalFee(T, canal) { return T.gt * (CANAL_FEE[canal] || 0); }

// Cadence de manutention (t/jour) selon le port et le type de cale.
const HANDLING = { vrac: 6000, liquide: 14000, divers: 2500, conteneurs: 7000 };
export function handlingRate(p, hold) { return HANDLING[hold] * Math.pow(PORTS[p].size, 0.8); }
export function handlingHours(p, hold, qty) {
  return Math.max(6, Math.ceil((qty / handlingRate(p, hold)) * HOURS_PER_DAY));
}

// Cale utilisée par un navire pour une marchandise (null si impossible).
export function holdFor(typeId, good) {
  const T = SHIP_TYPES[typeId];
  return GOODS[good].holds.find((h) => T.holds.includes(h)) || null;
}
export function portHandles(p, hold) { return PORTS[p].terminals.includes(hold); }

// Estimation complète d'un voyage (utilisée par l'interface, l'IA et les contrats).
export function voyageEstimate(state, { typeId, flag, from, to, qty = 0, hold = 'vrac', speed, nm, canals = [], age = 0 }) {
  const T = SHIP_TYPES[typeId];
  const v = speed || T.speed;
  const seaDays = nm / (24 * v);
  const portDays = (qty ? (handlingHours(from, hold, qty) + handlingHours(to, hold, qty)) / HOURS_PER_DAY : 0) + 0.5;
  const fuelT = burnPerDay(T, v, age) * seaDays + T.idleBurn * portDays;
  const fuelCost = fuelT * fuelPrice(state, from);
  const fixed = fixedDayCost(T, flag, 'active', age) * (seaDays + portDays);
  const fees = portFee(T, to) + canals.reduce((s, c) => s + canalFee(T, c), 0);
  return { nm, seaDays, portDays, days: seaDays + portDays, fuelT, fuelCost, fixed, fees, total: fuelCost + fixed + fees };
}

// ---------- Contrats de fret ----------
export function contractTarget(p) { return Math.round(2 + PORTS[p].size * 1.3); }

// Choisit un type de navire « de référence » capable de faire le transport.
function referenceTypes(from, to, good) {
  const list = [];
  for (const [id, T] of Object.entries(SHIP_TYPES)) {
    const hold = holdFor(id, good);
    if (!hold || !portHandles(from, hold) || !portHandles(to, hold)) continue;
    if (T.draft > PORTS[from].draft || T.draft > PORTS[to].draft) continue;
    list.push([id, Math.pow(T.dwt / 4000, -0.25)]);
  }
  return list;
}

// forType : impose un type de navire de référence (contrats garantis en début de partie).
export function makeContract(state, ctx, rng, from, forType = null) {
  const P = PORTS[from];
  const goods = Object.entries(P.exp).filter(([g, w]) => w > 0
    && (!forType || (holdFor(forType, g) && portHandles(from, holdFor(forType, g)))));
  if (!goods.length) return null;
  const good = rng.weighted(goods);
  const dests = PORT_IDS.filter((p) => p !== from && (PORTS[p].imp[good] || 0) > 0)
    .map((p) => [p, PORTS[p].imp[good]]);
  if (!dests.length) return null;
  const to = rng.weighted(dests);
  const refs = referenceTypes(from, to, good).filter(([id]) => !forType || id === forType);
  if (!refs.length) return null;
  const typeId = rng.weighted(refs);
  const T = SHIP_TYPES[typeId];
  const hold = holdFor(typeId, good);
  const closed = ctx.closedCanals(state, T.draft);
  const route = ctx.distanceInfo(from, to, closed);
  if (!route) return null;
  const qty = Math.round((T.dwt * rng.range(0.5, 0.97)) / 100) * 100;
  const est = voyageEstimate(state, { typeId, flag: null, from, to, qty, hold, nm: route.nm, canals: route.canals });
  est.total += portFee(T, from);
  // Le fret couvre le coût du voyage d'un navire de référence, plus le retour à
  // vide et l'attente entre deux contrats (BALLAST), multiplié par l'état du marché.
  // Économies d'échelle : les gros chargements rapportent un peu plus par rapport à leur coût.
  const scale = Math.pow(T.dwt / 12500, 0.08);
  const margin = state.market.freight[hold] * rng.range(0.88, 1.18) * scale;
  const urgent = rng.chance(0.2);
  // Le chargeur : les clients peu fiables paient un peu mieux pour attirer les armateurs.
  const clients = Object.entries(CLIENTS).filter(([, c]) => c.goods.includes(good));
  const client = clients.length ? rng.pick(clients)[0] : null;
  const riskPremium = client ? 1 + (70 - CLIENTS[client].reliability) / 300 : 1;
  const pay = Math.round((est.total * BALLAST * margin * riskPremium * (urgent ? 1.18 : 1)) / 1000) * 1000;
  const deadlineDays = est.days * (urgent ? 1.12 : 1.35) + 3;
  const minRep = clamp(Math.round((margin - 1.25) * 90 + (pay > 1.5e6 ? 15 : 0) + (urgent ? 5 : 0)), 0, 75);
  return {
    id: state.nextId++, from, to, good, qty, hold, pay, urgent, minRep, client,
    fuelAtStart: Math.round(worldFuelPrice(state)), priceAtStart: state.market.world[good],
    nm: Math.round(route.nm),
    deadline: Math.round(state.t + deadlineDays * HOURS_PER_DAY),
    expires: Math.round(state.t + rng.range(4, 12) * HOURS_PER_DAY),
    takenBy: null,
  };
}

export function refreshContracts(state, ctx, rng, fill = false) {
  state.contracts = state.contracts.filter((c) => c.takenBy !== null || c.expires > state.t);
  for (const p of PORT_IDS) {
    const open = state.contracts.filter((c) => c.from === p && c.takenBy === null).length;
    const missing = contractTarget(p) - open;
    for (let k = 0; k < missing; k++) {
      if (!fill && k > 0 && !rng.chance(0.6)) break;
      const c = makeContract(state, ctx, rng, p);
      if (c) state.contracts.push(c);
    }
  }
}

// Retard : 3 % de pénalité par jour, plafonnée à 60 %.
export function latePenalty(contract, t) {
  const daysLate = Math.max(0, (t - contract.deadline) / HOURS_PER_DAY);
  return Math.min(0.6, daysLate * 0.03);
}
