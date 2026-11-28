// Renseignements sur les affaires : ce qu'un navire peut gagner, et où. Une seule estimation, partagée
// par la spécialité « Vieux briscards » (fiche du navire), la liste des destinations (équipage chevronné)
// et les cartes d'opportunités : les chiffres concordent partout.
//
// Coûts comptés comme l'estimation d'un voyage (fiche du navire) : carburant, frais de port et de canal,
// frais fixes du navire pendant le trajet et la manutention. Les distances viennent des tables
// pré-calculées (aucun tracé n'est calculé ici).
//
// Deux niveaux de lecture (opts.arrival) :
//  - sans : prix d'aujourd'hui, quantité restante de l'appel d'offres sans compter les engagements
//    des concurrents (ce que sait un équipage ordinaire) ;
//  - avec : prix attendus à l'arrivée et part encore libre une fois servis les navires déjà en route
//    (ce que sait un vieux briscard, niveau 3).
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { HOURS_PER_DAY } from './util.js';
import * as eco from './economy.js';
import { tenderAt, tenderRoom, quoteSellAt, lotAt, lotRoom, buyableStock } from './trade.js';
import { imageFactor } from './clients.js';
import { familyDiscount } from './home.js';
import { bannedUntil } from './pollution.js';
import { closedPort } from './shadow.js';
import { equipMod } from './equipment.js';
import { skillSpeed } from './crew.js';
import { checkContract } from './actions.js';

const D = HOURS_PER_DAY;

// Où le navire sera libre, et dans combien de jours : au port tout de suite (ou à la fin d'une opération),
// en mer à l'arrivée. Null s'il ne peut rien entreprendre (désarmé, saisi…).
export function freeAt(state, ship) {
  if (ship.status === 'port') return { port: ship.port, wait: Math.max(0, ((ship.busyUntil || 0) - state.t) / D) };
  if (ship.status === 'sea' && ship.voyage?.to) return { port: ship.voyage.to, wait: Math.max(0, ((ship.voyage.eta || state.t) - state.t) / D) };
  return null;
}

// Coût et durée d'une traversée de `from` à `to` pour ce navire. qty / hold : chargement (manutention
// aux deux bouts). Null si le navire ne peut pas y aller (tirant d'eau, port fermé à la compagnie, pas de route).
export function legEstimate(state, ctx, ship, from, to, { qty = 0, hold = null } = {}) {
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const portH = qty && hold ? eco.handlingHours(from, hold, qty, ship.type) + eco.handlingHours(to, hold, qty, ship.type) : 0;
  const age = eco.ageYears(state, ship);
  const fixedDay = eco.fixedDayCost(T, company.flag, 'active', age, ship.crew);
  if (from === to) return { nm: 0, seaDays: 0, days: portH / 24, cost: fixedDay * portH / 24, canals: [] };
  if (!eco.fitsPort(to, ship.type)) return null;
  if (bannedUntil(company, PORTS[to].flag) > state.t || closedPort(company, to)) return null;
  const info = ctx.distanceInfo(from, to, ctx.closedCanals(state, T.draft, ship));
  if (!info) return null;
  const seaDays = info.nm / (24 * T.speed * skillSpeed(ship));
  const fuel = (eco.burnPerDay(T, T.speed, age) * equipMod(ship, 'burn') * seaDays * 1.08 + T.idleBurn) * eco.fuelPrice(state, from);
  const fees = eco.portFee(T, to) + info.canals.reduce((s, c) => s + eco.canalFee(T, c), 0);
  const days = seaDays + portH / 24;
  return { nm: info.nm, seaDays, days, cost: fuel + fees + fixedDay * days, canals: info.canals };
}

// Prix d'achat d'une quantité (manutention comprise), aujourd'hui ou à l'arrivée dans `days` jours.
// Lot soldé dans ce port (encore ouvert à l'arrivée) : sa part au prix soldé, comme à l'achat (quoteBuy) ;
// avec opts.arrival, sans la part promise aux navires déjà en route.
function buyUnit(state, company, port, g, qty, hold, days, arrival, shipId = null) {
  const lot = lotAt(state, port, g);
  const part = lot && state.t + days * D <= lot.until ? Math.min(qty, arrival ? lotRoom(lot, shipId) : lot.left) : 0;
  const rest = qty - part;
  const q = rest <= 0 ? { avg: 0 } : arrival && days > 0 ? eco.quoteTradeAt(state, port, g, rest, 'buy', days) : eco.quoteTrade(state, port, g, rest, 'buy');
  const total = q.avg * rest * (1 - familyDiscount(company, port)) + (part ? part * lot.unit : 0);
  return total / qty + (eco.HANDLING_COST[hold] || 0);
}

// Contrats de fret que ce navire peut aller prendre (ici ou ailleurs), du plus rentable par jour au moins rentable.
// Chaque entrée : { kind: 'contract', contract, port (départ du contrat), to, toPort (jours pour y aller), days (total),
// profit, perDay }. Le trajet à vide jusqu'au port de départ est compté ; un contrat qui aura expiré à
// l'arrivée, ou qu'on livrerait en retard, est écarté.
export function contractOffers(state, ctx, ship) {
  const at = freeAt(state, ship);
  if (!at || ship.cargo || ship.dark) return [];
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const out = [];
  for (const c of state.contracts) {
    if (c.takenBy !== null || c.qty > T.dwt) continue;
    const hold = eco.holdFor(ship.type, c.good);
    if (!hold) continue;
    const rep = legEstimate(state, ctx, ship, at.port, c.from);
    if (!rep) continue;
    const arrive = state.t + (at.wait + rep.days) * D;
    if ((c.expires ?? Infinity) < arrive) continue;
    if (checkContract(state, ctx, { ...ship, port: c.from, cargo: null, dark: null }, c)) continue;
    const leg = legEstimate(state, ctx, ship, c.from, c.to, { qty: c.qty, hold });
    if (!leg || arrive + leg.days * D > c.deadline) continue;
    const days = at.wait + rep.days + leg.days;
    const profit = c.pay * imageFactor(company, c.client) - rep.cost - leg.cost;
    out.push({ kind: 'contract', contract: c, port: c.from, to: c.to, good: c.good, toPort: at.wait + rep.days, days, profit, perDay: profit / Math.max(1, days) });
  }
  return out.sort((a, b) => b.perDay - a.perDay);
}

// Meilleurs ports où acheter une marchandise pour la livrer à `port` (appel d'offres de la ville s'il y en a,
// sinon au cours), pour la compagnie `cid` : n ports, du plus proche au plus lointain (trajet complet).
// opts.ship : un seul navire (sinon le plus proche de chaque port parmi ceux de la compagnie qui peuvent
// charger la marchandise) ; opts.arrival : prix à l'arrivée et engagements des concurrents.
// Chaque entrée : { port, ship (id), unit (achat, $/t, manutention comprise), sell ($/t à destination),
// toSource (jours pour aller acheter), days (total jusqu'à la livraison), qty, marginPerT, profit, perDay }.
export function bestSources(state, ctx, cid, good, port, n = 3, opts = {}) {
  const company = state.companies[cid];
  const ships = opts.ship ? [opts.ship] : state.ships.filter((s) => s.owner === cid && !s.cargo && !s.dark && eco.holdFor(s.type, good));
  const tender = tenderAt(state, port, good);
  const best = new Map();
  for (const ship of ships) {
    const at = freeAt(state, ship);
    const hold = eco.holdFor(ship.type, good);
    if (!at || !hold || !eco.fitsPort(port, ship.type) || !eco.portHandles(port, hold)) continue;
    const T = SHIP_TYPES[ship.type];
    const room = tender ? (opts.arrival ? tenderRoom(tender, ship.id) : tender.left) : Infinity;
    for (const p of PORT_IDS) {
      if (p === port || !eco.portHandles(p, hold)) continue;
      const stock = buyableStock(state, p, good);
      if (stock < 100) continue;
      const qty = Math.floor(Math.min(T.dwt, stock, room) / 100) * 100;
      if (qty < 100) continue;
      const rep = legEstimate(state, ctx, ship, at.port, p);
      if (!rep) continue;
      const leg = legEstimate(state, ctx, ship, p, port, { qty, hold });
      if (!leg) continue;
      const toSource = at.wait + rep.days, days = toSource + leg.days;
      if (tender && state.t + days * D > tender.until) continue;
      const unit = buyUnit(state, company, p, good, qty, hold, toSource, opts.arrival, ship.id);
      const sale = opts.arrival ? quoteSellAt(state, port, good, qty, days, ship.id).avg
        : tender ? tender.unit : eco.quoteTrade(state, port, good, qty, 'sell').avg;
      const sell = sale - (eco.HANDLING_COST[hold] || 0);
      const marginPerT = sell - unit;
      if (marginPerT <= 0) continue;
      const profit = marginPerT * qty - rep.cost - leg.cost;
      const e = { port: p, ship: ship.id, unit, sell, toSource, days, qty, marginPerT, profit, perDay: profit / Math.max(1, days) };
      const prev = best.get(p);
      if (!prev || e.days < prev.days) best.set(p, e);
    }
  }
  return [...best.values()].sort((a, b) => a.days - b.days).slice(0, n);
}

// Meilleurs débouchés pour `qty` t d'une marchandise achetée au port où se trouve le navire, achat compris :
// n ports, du plus rentable au moins rentable. Chaque entrée : { port, unit (vente, $/t), days, net, tender (t
// payées au prix de l'appel d'offres) }. opts.at : { port, wait } pour acheter ailleurs (un lot soldé).
export function bestOutlets(state, ctx, ship, good, qty, n = 3, opts = {}) {
  const at = opts.at || freeAt(state, ship);
  const hold = eco.holdFor(ship.type, good);
  if (!at || !hold || qty < 100) return [];
  const company = state.companies[ship.owner];
  const cost = buyUnit(state, company, at.port, good, qty, hold, at.wait, opts.arrival, ship.id) * qty;
  const out = [];
  for (const p of PORT_IDS) {
    if (p === at.port || !(PORTS[p].imp[good] > 0) || !eco.portHandles(p, hold)) continue;
    const leg = legEstimate(state, ctx, ship, at.port, p, { qty, hold });
    if (!leg) continue;
    const days = at.wait + leg.days;
    let unit, tq = 0;
    if (opts.arrival) { const q = quoteSellAt(state, p, good, qty, days, ship.id); unit = q.avg; tq = q.tenderQty; }
    else {
      const t = tenderAt(state, p, good), part = t && state.t + days * D <= t.until ? Math.min(qty, t.left) : 0;
      const rest = qty - part;
      unit = ((part ? part * t.unit : 0) + (rest ? eco.quoteTrade(state, p, good, rest, 'sell').total : 0)) / qty;
      tq = part;
    }
    const net = (unit - (eco.HANDLING_COST[hold] || 0)) * qty - cost - leg.cost;
    out.push({ port: p, unit, days, net, perDay: net / Math.max(1, days), tender: tq });
  }
  return out.sort((a, b) => b.net - a.net).slice(0, n);
}

// Appels d'offres que ce navire peut servir (cale adaptée, port accessible), avec leurs meilleures sources.
export function tenderLeads(state, ctx, ship, opts = {}) {
  const T = SHIP_TYPES[ship.type];
  const out = [];
  for (const t of state.tenders || []) {
    if (t.left <= 0 || t.until <= state.t) continue;
    const hold = eco.holdFor(ship.type, t.good);
    if (!hold || !eco.fitsPort(t.port, ship.type) || !eco.portHandles(t.port, hold)) continue;
    const sources = bestSources(state, ctx, ship.owner, t.good, t.port, opts.n ?? 3, { ship, arrival: opts.arrival });
    const rivals = t.commits.filter((c) => c.company !== ship.owner);
    out.push({ tender: t, sources, rivals, room: tenderRoom(t, ship.id), dwt: T.dwt });
  }
  return out;
}

// Lot soldé : le navire de la compagnie `cid` le plus proche qui peut aller l'acheter à temps (cales vides,
// cale adaptée, port accessible), et ses meilleurs débouchés (n), trajet à vide jusqu'au lot compris.
// Null si aucun navire ne peut y être avant la fin. { ship, toLot (jours), qty, outlets: [{ port, days, net… }] }.
export function lotPlan(state, ctx, cid, lot, n = 3, opts = {}) {
  let best = null;
  for (const ship of state.ships) {
    if (ship.owner !== cid || ship.cargo || ship.dark) continue;
    const hold = eco.holdFor(ship.type, lot.good);
    const at = freeAt(state, ship);
    if (!hold || !at || !eco.portHandles(lot.port, hold)) continue;
    const rep = legEstimate(state, ctx, ship, at.port, lot.port);
    if (!rep) continue;
    const toLot = at.wait + rep.days;
    if (state.t + toLot * D > lot.until || (best && toLot >= best.toLot)) continue;
    best = { ship, toLot, cost: rep.cost };
  }
  if (!best) return null;
  const room = opts.arrival ? lotRoom(lot, best.ship.id) : lot.left;
  const qty = Math.floor(Math.min(SHIP_TYPES[best.ship.type].dwt, room) / 100) * 100;
  const outlets = qty < 100 ? [] : bestOutlets(state, ctx, best.ship, lot.good, qty, n, { ...opts, at: { port: lot.port, wait: best.toLot } })
    .map((o) => ({ ...o, net: o.net - best.cost, perDay: (o.net - best.cost) / Math.max(1, o.days) }));
  return { ship: best.ship, toLot: best.toLot, qty, outlets };
}

// La meilleure affaire à portée de ce navire, par bénéfice par jour : contrat (affaire en or comprise),
// appel d'offres (en allant acheter la marchandise) ou négoce depuis le port où il se trouve.
export function bestOpportunity(state, ctx, ship, opts = {}) {
  const cands = [];
  const c = contractOffers(state, ctx, ship)[0];
  if (c) cands.push(c);
  if (!ship.cargo && !ship.dark) {
    for (const L of tenderLeads(state, ctx, ship, { ...opts, n: 6 })) {
      const s = [...L.sources].sort((a, b) => b.perDay - a.perDay)[0];
      if (s) cands.push({ kind: 'tender', tender: L.tender, port: s.port, to: L.tender.port, good: L.tender.good, toPort: s.toSource, days: s.days, profit: s.profit, perDay: s.perDay });
    }
    const at = freeAt(state, ship);
    if (at) {
      const T = SHIP_TYPES[ship.type];
      for (const g of Object.keys(PORTS[at.port].exp)) {
        if (!eco.holdFor(ship.type, g)) continue;
        const qty = Math.floor(Math.min(T.dwt, buyableStock(state, at.port, g)) / 100) * 100;
        const o = bestOutlets(state, ctx, ship, g, qty, 1, opts)[0];
        if (o) cands.push({ kind: 'trade', port: at.port, to: o.port, good: g, qty, toPort: at.wait, days: o.days, profit: o.net, perDay: o.perDay });
      }
    }
  }
  return cands.filter((x) => x.profit > 0).sort((a, b) => b.perDay - a.perDay)[0] || null;
}

