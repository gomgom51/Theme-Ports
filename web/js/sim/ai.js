// Compagnies gérées par l'ordinateur. Elles jouent avec les mêmes règles et
// les mêmes actions que les joueurs humains.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import * as eco from './economy.js';
import * as act from './actions.js';
import { shipsOf, fleetValue, creditLimit, contractById } from './core.js';
import { HOURS_PER_DAY } from './util.js';

const D = HOURS_PER_DAY;

function noisy(rng, value, skill) {
  return value * (1 + rng.normal() * 0.12 / skill);
}

// Coût d'un trajet (sans la cargaison) pour comparer les options.
function tripCost(state, ctx, ship, to, extraHours = 0) {
  const p = act.planVoyage(state, ctx, ship, to, SHIP_TYPES[ship.type].speed);
  if (p.error) return null;
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const days = p.seaDays + extraHours / D;
  return { cost: p.fuelCost + p.fees + eco.fixedDayCost(T, company.flag, 'active', eco.ageYears(state, ship)) * days, days, plan: p };
}

export function aiShipIdle(state, ctx, rng, ship) {
  if (ship.aiWait && ship.aiWait > state.t) return;
  const company = state.companies[ship.owner];
  const skill = company.ai?.skill || 1;
  const T = SHIP_TYPES[ship.type];
  const here = ship.port;

  // 0. Cargaison sous contrat encore à bord (départ raté faute de carburant) : repartir.
  if (ship.cargo?.contractId) {
    const c = contractById(state, ship.cargo.contractId);
    if (c) {
      const p = act.planVoyage(state, ctx, ship, c.to, T.speed);
      if (!p.error && ship.fuel < p.needFuel) {
        const cost = (Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, here);
        if (cost > company.cash) act.borrow(state, company.id, cost - company.cash + 100000);
      }
      if (act.depart(state, ctx, ship.id, c.to, T.speed, true).ok) return;
    }
    ship.aiWait = state.t + 12;
    return;
  }

  // 1. Marchandise à bord : vendre ici ou aller la vendre ailleurs.
  if (ship.cargo && !ship.cargo.contractId) {
    const sale = act.quoteSale(state, ship);
    let best = { port: here, value: sale && sale.possible ? sale.net : -Infinity };
    for (const p of PORT_IDS) {
      if (p === here || !eco.portHandles(p, ship.cargo.hold) || !eco.fitsPort(p, ship.type)) continue;
      const trip = tripCost(state, ctx, ship, p);
      if (!trip) continue;
      const net = eco.quoteTrade(state, p, ship.cargo.good, ship.cargo.qty, 'sell').total * 0.97 - trip.cost;
      if (net > best.value * 1.05) best = { port: p, value: net };
    }
    if (best.port !== here && act.depart(state, ctx, ship.id, best.port, T.speed, true).ok) return;
    if (!act.sellCargo(state, ctx, ship.id).ok) ship.aiWait = state.t + 24;
    return;
  }

  // 2. Entretien.
  if (ship.condition < 62 && PORTS[here].repair >= 1) {
    const rc = eco.repairCost(state, ship, here, 92);
    if (rc && rc.points > 5 && rc.cost < company.cash * 0.6) {
      act.repair(state, ship.id, 92);
      return;
    }
  }

  // 3. Évaluer les contrats et les occasions de négoce.
  const options = [];
  for (const c of state.contracts) {
    if (c.from !== here || c.takenBy !== null) continue;
    if (act.checkContract(state, ctx, ship, c)) continue;
    const loadH = eco.handlingHours(here, c.hold, c.qty) + eco.handlingHours(c.to, c.hold, c.qty);
    const trip = tripCost(state, ctx, ship, c.to, loadH);
    if (!trip || trip.plan.error) continue;
    if (state.t + (trip.days + 1) * D > c.deadline) continue;
    const profit = c.pay - noisy(rng, trip.cost, skill * 2);
    options.push({ kind: 'contract', c, profit, perDay: profit / Math.max(1, trip.days) });
  }
  // On garde de quoi faire le plein et payer quelques semaines de frais fixes.
  const reserve = T.tank * eco.fuelPrice(state, here) + eco.fixedDayCost(T, company.flag, 'active') * 30 + 300000;
  const tradeBudget = (company.cash - reserve) * 0.8;
  if (tradeBudget > 300000 && !company.ai?.noTrade) {
    for (const g of Object.keys(PORTS[here].exp)) {
      const hold = eco.holdFor(ship.type, g);
      if (!hold || !eco.portHandles(here, hold)) continue;
      const stock = eco.availableStock(state, here, g);
      const unit = eco.buyPrice(state, here, g);
      const qty = Math.floor(Math.min(T.dwt, stock, tradeBudget / (unit * 1.05)) / 100) * 100;
      if (qty < T.dwt * 0.4) continue;
      const buy = act.quoteBuy(state, ship, g, qty);
      for (const p of PORT_IDS) {
        if (p === here || !(PORTS[p].imp[g] > 0) || !eco.portHandles(p, hold) || !eco.fitsPort(p, ship.type)) continue;
        const loadH = eco.handlingHours(here, hold, qty) + eco.handlingHours(p, hold, qty);
        const trip = tripCost(state, ctx, ship, p, loadH);
        if (!trip || trip.plan.error) continue;
        const sell = eco.quoteTrade(state, p, g, qty, 'sell').total - qty * eco.HANDLING_COST[hold];
        // Prudence : on retire une marge de risque proportionnelle à la durée et à la volatilité.
        const risk = buy.total * GOODS[g].vol * Math.sqrt(trip.days) * 1.2;
        // Le bruit porte sur le cours de revente (quelques %), pas sur toute la valeur :
        // sinon l'IA choisit systématiquement les erreurs d'estimation les plus optimistes.
        const profit = sell * (1 + rng.normal() * 0.012 / skill) - buy.total - trip.cost - risk;
        options.push({ kind: 'trade', good: g, qty, to: p, profit, perDay: profit / Math.max(1, trip.days) });
      }
    }
  }
  options.sort((a, b) => b.perDay - a.perDay);
  const best = options[0];
  if (best && best.profit > 0) {
    if (best.kind === 'contract') {
      // S'assurer de pouvoir payer le plein avant de s'engager.
      const p = act.planVoyage(state, ctx, ship, best.c.to, T.speed);
      const fuelCost = Math.max(0, Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, here);
      if (fuelCost > company.cash - 100000 && !act.borrow(state, company.id, fuelCost - company.cash + 200000).ok) {
        ship.aiWait = state.t + 24;
        return;
      }
      act.acceptContract(state, ctx, ship.id, best.c.id, { speed: T.speed, autoRefuel: true });
    } else {
      const r = act.buyCargo(state, ctx, ship.id, best.good, best.qty);
      if (r.ok) act.depart(state, ctx, ship.id, best.to, T.speed, true);
    }
    return;
  }

  // 4. Rien d'intéressant ici : se repositionner vers un port qui exporte ce que
  //    le navire sait transporter (même loin s'il n'y a rien à proximité), ou attendre.
  const candidates = [];
  for (const p of PORT_IDS) {
    if (p === here || !eco.fitsPort(p, ship.type)) continue;
    const d = ctx.distanceInfo(here, p)?.nm;
    if (!d) continue;
    const n = state.contracts.filter((c) => c.from === p && c.takenBy === null && eco.holdFor(ship.type, c.good)
      && !act.checkContract(state, ctx, { ...ship, port: p, cargo: null }, c)).length;
    if (n) candidates.push([p, n / (d + 800)]);
  }
  const hereHasWork = Object.keys(PORTS[here].exp).some((g) => eco.holdFor(ship.type, g) && eco.portHandles(here, eco.holdFor(ship.type, g)));
  if (candidates.length && (!hereHasWork || rng.chance(0.35))) {
    candidates.sort((a, b) => b[1] - a[1]);
    const p = rng.weighted(candidates.slice(0, 3));
    const r = act.depart(state, ctx, ship.id, p, T.speed * 0.9, true);
    if (r.ok) return;
  }
  ship.aiWait = state.t + rng.int(18, 48);
}

// Coût par tonne et par mille d'un navire d'occasion, comparé au navire moderne
// de taille la plus proche (> 1 : plus économique, < 1 : gouffre à carburant).
function efficiency(state, company, listing) {
  const fuel = eco.worldFuelPrice(state);
  const perTnm = (T, age) => (eco.burnPerDay(T, T.speed, age) * fuel + eco.fixedDayCost(T, company.flag, 'active', age)) / (T.dwt * T.speed);
  const T = SHIP_TYPES[listing.type];
  let ref = null, best = Infinity;
  for (const R of Object.values(SHIP_TYPES)) {
    if (R.vintage || !R.holds.some((h) => T.holds.includes(h))) continue;
    const d = Math.abs(Math.log(R.dwt / T.dwt));
    if (d < best) { best = d; ref = R; }
  }
  return ref ? Math.min(1.5, perTnm(ref, 0) / perTnm(T, listing.age)) : 1;
}

// Décisions de flotte et de trésorerie, une fois par jour.
export function aiDaily(state, ctx, rng, company) {
  if (company.bankrupt) return;
  const ships = shipsOf(state, company.id);
  const monthlyFixed = ships.reduce((s, sh) => s + eco.fixedDayCost(SHIP_TYPES[sh.type], company.flag, sh.status) * 30, 0);

  // Trésorerie : couvrir un découvert, rembourser quand on est à l'aise.
  if (company.cash < 0) act.borrow(state, company.id, -company.cash + monthlyFixed * 0.5);
  else if (company.debt > 0 && company.cash > 4e6 + monthlyFixed * 2) {
    act.repay(state, company.id, company.cash - (3e6 + monthlyFixed * 2));
  }

  // Achat d'un navire environ une fois par mois si les finances le permettent.
  if (state.t < (company.ai.nextFleet || 0)) return;
  company.ai.nextFleet = state.t + rng.int(20, 40) * D;
  const value = fleetValue(state, company.id);
  if (company.debt > value * 0.5) return;
  if (ships.length >= Math.round(10 + 10 * (company.ai.skill || 1))) return;
  const budget = company.cash * 0.85 + Math.max(0, Math.min(creditLimit(state, company) - company.debt, company.cash * 0.6));
  if (budget < 1.5e6) return;
  const affordable = state.used.filter((l) => l.price <= budget && l.condition > 45);
  if (!affordable.length) return;
  // Préférence pour les navires qui servent beaucoup de ports (un ULCC n'a que trois terminaux)
  // et qui coûtent peu à exploiter par rapport à un navire moderne de même taille.
  const reach = (typeId) => Math.sqrt(PORT_IDS.filter((p) => eco.servesType(p, typeId)).length / 12);
  const pick = rng.weighted(affordable.map((l) => [l, Math.sqrt(SHIP_TYPES[l.type].dwt) * (l.condition / 100) / Math.sqrt(l.price)
    * reach(l.type) * Math.pow(efficiency(state, company, l), 3)]));
  if (pick.price > company.cash) act.borrow(state, company.id, pick.price - company.cash + 300000);
  act.buyUsedShip(state, ctx, rng, company.id, pick.id);
}

export { contractById };
