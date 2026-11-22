// Moteur économique : cours mondiaux, marchés locaux (offre et demande),
// carburant, réparations, valeur des navires, contrats de fret.
import { GOODS, GOOD_IDS } from '../data/goods.js';
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES, CREW_DAY_COST } from '../data/ships.js';
import { CLIENTS } from '../data/clients.js';
import { clamp, HOURS_PER_DAY } from './util.js';

export const FUEL_BASE = 620;          // $/t de fuel quand le cours des raffinés est à 1
export const HOLD_TYPES = ['vrac', 'liquide', 'divers', 'conteneurs', 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'];
export const CANAL_FEE = { suez: 12, panama: 10 }; // $ par unité de jauge brute
export const BID_ASK = 0.015;
export const BALLAST = 1.55;
export const TUNING = { ballast: BALLAST }; // réglage d'équilibrage (tests)
// Taux de fret « normal » (indice 100). Les taux suivent un cycle mondial lent
// (des années d'euphorie, puis des années de vaches maigres) et, autour de lui,
// les à-coups propres à chaque type de cargaison.
export const FREIGHT_NORMAL = 1.3;
export const FREIGHT_MIN = 0.6, FREIGHT_MAX = 2.6;
// Trafics à sens unique (pétrole, gaz, fruits...) : le retour se fait presque toujours à vide.
// Le fret est d'autant plus cher que le navire a peu de chances de trouver un
// chargement pour le retour : un pétrolier rentre presque toujours à vide, un cargo
// polyvalent trouve quelque chose à charger dans chaque port.
export const BALLAST_HOLD = {
  divers: 1, conteneurs: 1.05, vrac: 1.12, lourd: 1.15,
  chimique: 1.3, vehicules: 1.3, liquide: 1.4, gpl: 1.4, gnl: 1.4, frigo: 1.45,
};

// ---------- Marché ----------
export function initMarket(rng) {
  const world = {};
  for (const g of GOOD_IDS) world[g] = rng.range(0.94, 1.06);
  const cycle = rng.range(-0.04, 0.12); // la partie commence dans un marché à peu près normal
  const freight = {};
  for (const h of HOLD_TYPES) freight[h] = FREIGHT_NORMAL * Math.exp(cycle + rng.normal() * 0.06);
  const ports = {};
  for (const p of PORT_IDS) {
    ports[p] = {};
    for (const g of GOOD_IDS) {
      ports[p][g] = { ou: rng.normal() * GOODS[g].vol * 3, imp: 0, stock: stockCap(p, g) * rng.range(0.4, 0.9) };
    }
  }
  return { market: { world, freight, cycle, fuelPremium: 1, shipIndex: Math.exp(cycle * 0.9), repairLoad: 1 }, ports };
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
export const HANDLING_COST = { vrac: 3, liquide: 1.5, divers: 12, conteneurs: 10, chimique: 4, gpl: 3, gnl: 2.5, vehicules: 35, frigo: 18, lourd: 60 };

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
  // Cycle mondial : demi-vie d'environ neuf mois, écart type d'environ 15 %.
  m.cycle = clamp((m.cycle ?? 0) - (m.cycle ?? 0) / 400 + 0.0105 * rng.normal(), -0.45, 0.45);
  for (const h of HOLD_TYPES) {
    let x = Math.log(m.freight[h] / FREIGHT_NORMAL);
    x += -(x - m.cycle) / 90 + 0.013 * rng.normal();
    m.freight[h] = clamp(FREIGHT_NORMAL * Math.exp(x), FREIGHT_MIN, FREIGHT_MAX);
  }
  // Le prix des navires suit les gains qu'ils promettent : cher en haut de cycle.
  const avgFreight = HOLD_TYPES.reduce((s, h) => s + m.freight[h], 0) / HOLD_TYPES.length;
  m.shipIndex = clamp(m.shipIndex + (Math.pow(avgFreight / FREIGHT_NORMAL, 0.9) - m.shipIndex) / 75 + 0.004 * rng.normal(), 0.5, 1.8);
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
  const dep = Math.max(0.06, Math.pow(Math.max(0, 1 - age / T.life), 1.25));
  const sound = T.price * 1e6 * dep * state.market.shipIndex; // en bon état
  // L'acheteur déduit les réparations à prévoir : elles dépendent de la taille du
  // navire, pas de sa valeur, et peuvent dépasser ce que vaut une vieille coque.
  const repairs = Math.max(0, 90 - ship.condition) * T.price * 1e6 * 0.0011 * (1 + (100 - ship.condition) / 120);
  const scrap = T.price * 1e6 * 0.04 * state.market.shipIndex; // valeur à la démolition
  return Math.max(scrap, sound - repairs * 0.8);
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
// Les gros chargements vont aux terminaux les mieux équipés (pompes, portiques,
// convoyeurs) : la cadence augmente avec la taille du lot.
const HANDLING = {
  vrac: 6000, liquide: 14000, divers: 2500, conteneurs: 7000,
  chimique: 9000, gpl: 10000, gnl: 16000, vehicules: 3000, frigo: 3000, lourd: 1500,
};
export function handlingRate(p, hold, qty = 0) {
  return HANDLING[hold] * Math.pow(PORTS[p].size, 0.8) * Math.pow(Math.max(1, qty / 20000), 0.6);
}
export function handlingHours(p, hold, qty) {
  return Math.max(6, Math.ceil((qty / handlingRate(p, hold, qty)) * HOURS_PER_DAY));
}

// Tirant d'eau admis pour un type de navire : certains ports ont des terminaux
// plus profonds que leurs quais principaux (bouées pétrolières au large, quais minéraliers).
export function portDraft(p, typeId) {
  const P = PORTS[p];
  let d = P.draft;
  if (P.deep) for (const h of SHIP_TYPES[typeId].holds) if (P.deep[h] > d) d = P.deep[h];
  return d;
}
export const fitsPort = (p, typeId) => SHIP_TYPES[typeId].draft <= portDraft(p, typeId);
// Port utilisable par ce type : assez profond et capable de manutentionner une de ses cales.
// Niveau du fret (1 = normal) pour le meilleur type de cale d'un navire.
export function freightLevel(state, typeId) {
  return Math.max(...SHIP_TYPES[typeId].holds.map((h) => state.market.freight[h] || FREIGHT_NORMAL)) / FREIGHT_NORMAL;
}
export const servesType = (p, typeId) => fitsPort(p, typeId) && SHIP_TYPES[typeId].holds.some((h) => PORTS[p].terminals.includes(h));

// Cale utilisée par un navire pour une marchandise (null si impossible).
export function holdFor(typeId, good) {
  const T = SHIP_TYPES[typeId];
  return GOODS[good].holds.find((h) => T.holds.includes(h)) || null;
}
export function portHandles(p, hold) { return PORTS[p].terminals.includes(hold); }

// Estimation complète d'un voyage (utilisée par l'interface, l'IA et les contrats).
// Usure de la coque et des machines en mer (points d'état par heure), plus rapide avec l'âge.
export const wearPerHour = (age) => 0.0025 * (1 + age / 15);
// Coût de l'entretien qui compensera cette usure (réparations au prix d'un chantier courant).
export function upkeepPerSeaDay(state, T, age) {
  return wearPerHour(age) * HOURS_PER_DAY * T.price * 1e6 * 0.0011 * 1.17 * repairIndex(state);
}

export function voyageEstimate(state, { typeId, flag, from, to, qty = 0, hold = 'vrac', speed, nm, canals = [], age = 0 }) {
  const T = SHIP_TYPES[typeId];
  const v = speed || T.speed;
  const seaDays = nm / (24 * v);
  const portDays = (qty ? (handlingHours(from, hold, qty) + handlingHours(to, hold, qty)) / HOURS_PER_DAY : 0) + 0.5;
  const fuelT = burnPerDay(T, v, age) * seaDays + T.idleBurn * portDays;
  const fuelCost = fuelT * fuelPrice(state, from);
  const fixed = fixedDayCost(T, flag, 'active', age) * (seaDays + portDays);
  const fees = portFee(T, to) + canals.reduce((s, c) => s + canalFee(T, c), 0);
  const upkeep = upkeepPerSeaDay(state, T, age) * seaDays;
  return { nm, seaDays, portDays, days: seaDays + portDays, fuelT, fuelCost, fixed, fees, upkeep, total: fuelCost + fixed + fees + upkeep };
}

// ---------- Contrats de fret ----------
export function contractTarget(p) { return Math.round(3 + PORTS[p].size * 1.7); }

// Choisit un type de navire « de référence » capable de faire le transport.
function referenceTypes(from, to, good) {
  const list = [];
  for (const [id, T] of Object.entries(SHIP_TYPES)) {
    if (T.vintage) continue;
    const hold = holdFor(id, good);
    if (!hold || !portHandles(from, hold) || !portHandles(to, hold)) continue;
    if (!fitsPort(from, id) || !fitsPort(to, id)) continue;
    // Chaque marchandise a sa taille de lot typique : le brut part en superpétroliers,
    // les machines en petits lots. Les navires proches de cette taille sont favoris.
    const x = Math.log(T.dwt / GOODS[good].lot);
    list.push([id, Math.exp(-(x * x) / 3)]);
  }
  return list;
}

// Cabotage : petits lots vers les ports proches, le gagne-pain des petits navires.
export const REGIONAL_NM = 3200, REGIONAL_DWT = 15000;
export function regionalTarget(p) { return Math.round(1 + PORTS[p].size * 0.7); }
// Grands volumes : cargaisons géantes au départ des ports profonds (brut, minerai, conteneurs).
export const BIG_DWT = 50000;
export function bigTarget(p) {
  const P = PORTS[p];
  const deep = Math.max(P.draft, ...Object.values(P.deep || {}));
  return deep >= 14 ? Math.round(P.size * 0.6) : 0;
}

// forType : impose un type de navire de référence (contrats garantis en début de partie).
// regional : contrat de cabotage (petit navire, destination proche).
// big : grand volume (navire de plus de BIG_DWT tonnes).
export function makeContract(state, ctx, rng, from, forType = null, { regional = false, big = false } = {}) {
  const P = PORTS[from];
  const sizeOk = (id) => (!regional || SHIP_TYPES[id].dwt <= REGIONAL_DWT) && (!big || (SHIP_TYPES[id].dwt >= BIG_DWT && fitsPort(from, id)));
  const goods = Object.entries(P.exp).filter(([g, w]) => w > 0
    && (!forType || (holdFor(forType, g) && portHandles(from, holdFor(forType, g))))
    && (!(regional || big) || Object.keys(SHIP_TYPES).some((id) => sizeOk(id) && !SHIP_TYPES[id].vintage && holdFor(id, g) && portHandles(from, holdFor(id, g)))));
  if (!goods.length) return null;
  const good = rng.weighted(goods);
  const dests = PORT_IDS.filter((p) => p !== from && (PORTS[p].imp[good] || 0) > 0
    && (!regional || (ctx.distanceInfo(from, p)?.nm ?? Infinity) <= REGIONAL_NM))
    .map((p) => [p, PORTS[p].imp[good]]);
  if (!dests.length) return null;
  const to = rng.weighted(dests);
  let refs = referenceTypes(from, to, good).filter(([id]) => (!forType || id === forType) && sizeOk(id));
  if (big) refs = refs.map(([id]) => [id, Math.sqrt(SHIP_TYPES[id].dwt)]); // les géants ont leur part
  if (!refs.length) return null;
  const typeId = rng.weighted(refs);
  const T = SHIP_TYPES[typeId];
  const hold = holdFor(typeId, good);
  const closed = ctx.closedCanals(state, T.draft);
  const route = ctx.distanceInfo(from, to, closed);
  if (!route) return null;
  const qty = Math.round((T.dwt * rng.range(0.5, 0.97)) / 100) * 100;
  // Le marché paie ce que coûterait le transporteur le plus efficace capable de
  // faire ce voyage (navire « moyen » de 8 ans) : aucun modèle ne gagne plus que
  // le marché en prenant des cargaisons prévues pour des navires plus coûteux.
  let est = null;
  for (const [id] of referenceTypes(from, to, good)) {
    const R = SHIP_TYPES[id];
    if (R.dwt < qty) continue;
    const rr = id === typeId ? route : ctx.distanceInfo(from, to, ctx.closedCanals(state, R.draft));
    if (!rr) continue;
    const e = voyageEstimate(state, { typeId: id, flag: null, from, to, qty, hold: holdFor(id, good), nm: rr.nm, canals: rr.canals, age: 8 });
    e.total += portFee(R, from);
    if (!est || e.total < est.total) est = e;
  }
  // Le fret couvre le coût du voyage d'un navire de référence, plus le retour à
  // vide et l'attente entre deux contrats (BALLAST), multiplié par l'état du marché.
  // Économies d'échelle : les gros chargements rapportent un peu plus par rapport à leur coût.
  const scale = Math.pow(T.dwt / 12500, 0.05);
  const margin = (state.market.freight[hold] / FREIGHT_NORMAL) * rng.range(0.9, 1.12) * scale;
  const urgent = rng.chance(0.2);
  // Le chargeur : les clients peu fiables paient un peu mieux pour attirer les armateurs.
  const clients = Object.entries(CLIENTS).filter(([, c]) => c.goods.includes(good));
  const client = clients.length ? rng.pick(clients)[0] : null;
  const riskPremium = client ? 1 + (70 - CLIENTS[client].reliability) / 300 : 1;
  const pay = Math.round((est.total * TUNING.ballast * (BALLAST_HOLD[hold] || 1) * margin * riskPremium * (urgent ? 1.18 : 1)) / 1000) * 1000;
  const deadlineDays = est.days * (urgent ? 1.12 : 1.35) + 3;
  // Lignes régulières (conteneurs) et denrées réfrigérées : le chargeur exige un navire
  // presque aussi rapide que celui de référence. Un cargo lent ne peut pas les prendre.
  const minSpeed = hold === 'conteneurs' || hold === 'frigo' ? Math.round(T.speed * 9) / 10 : 0;
  const minRep = clamp(Math.round((margin - 0.96) * 117 + (pay > 1.5e6 ? 15 : 0) + (urgent ? 5 : 0)), 0, 75);
  return {
    id: state.nextId++, from, to, good, qty, hold, pay, urgent, minRep, client, regional, big, minSpeed,
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
    for (const kind of ['normal', 'regional', 'big']) {
      const open = state.contracts.filter((c) => c.from === p && c.takenBy === null
        && (kind === 'regional' ? c.regional : kind === 'big' ? c.big : !c.regional && !c.big)).length;
      const target = kind === 'regional' ? regionalTarget(p) : kind === 'big' ? bigTarget(p) : contractTarget(p);
      for (let k = 0; k < target - open; k++) {
        if (!fill && k > 0 && !rng.chance(0.6)) break;
        const c = makeContract(state, ctx, rng, p, null, { regional: kind === 'regional', big: kind === 'big' });
        if (c) state.contracts.push(c);
      }
    }
  }
}

// Retard : 3 % de pénalité par jour, plafonnée à 60 %.
export function latePenalty(contract, t) {
  const daysLate = Math.max(0, (t - contract.deadline) / HOURS_PER_DAY);
  return Math.min(0.6, daysLate * 0.03);
}
