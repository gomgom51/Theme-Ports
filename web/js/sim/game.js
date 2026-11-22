// Boucle de simulation : création d'une partie, avancée du temps heure par heure.
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { Rng, HOURS_PER_DAY, formatDate, dateOf } from './util.js';
import * as eco from './economy.js';
import * as act from './actions.js';
import {
  money, news, emptyBook, bookTotal, companyOf, shipsOf, isIdle, fleetValue, netWorth, interestRate,
  changeReputation, createShip, shipLog, portName, removeShip, contractById, pickShipName,
} from './core.js';
import { dailyEvents, dailyStorms, moveStorms, weatherAt } from './events.js';
import { aiShipIdle, aiDaily } from './ai.js';
import { pointAlong } from './routing.js';
import { CANAL_NAMES } from './context.js';

const D = HOURS_PER_DAY;
export const SAVE_VERSION = 1;
export const COMPANY_COLORS = ['#e5484d', '#3e8ef7', '#30a46c', '#f5a623'];
export const DIFFICULTIES = {
  facile: { label: 'Facile', cash: 12e6, aiSkill: 0.7, text: '12 M$ au départ, concurrents prudents' },
  normal: { label: 'Normal', cash: 8e6, aiSkill: 1, text: '8 M$ au départ' },
  difficile: { label: 'Difficile', cash: 5e6, aiSkill: 1.3, text: '5 M$ au départ, concurrents redoutables' },
};
export const DURATIONS = [
  { years: 2, label: '2 ans' }, { years: 5, label: '5 ans' }, { years: 10, label: '10 ans' }, { years: 0, label: 'Sans fin' },
];

export function newGame(opts, ctx) {
  const seed = opts.seed ?? ((Math.random() * 2 ** 32) >>> 0);
  const rng = new Rng(seed);
  const { market, ports } = eco.initMarket(rng);
  const state = {
    version: SAVE_VERSION, seed, t: 0, rng: 0, nextId: 1,
    settings: {
      duration: opts.duration ?? 5,
      difficulty: opts.difficulty || 'normal',
      autoPause: opts.autoPause ?? true,
    },
    market, ports,
    companies: [], ships: [], contracts: [], used: [], orders: [],
    storms: [], canals: {}, strikes: {}, news: [], over: null,
  };
  const diff = DIFFICULTIES[state.settings.difficulty];
  opts.companies.forEach((c, i) => {
    const flag = PORTS[c.homePort].flag;
    state.companies.push({
      id: i, name: c.name, captain: c.captain || '', color: c.color || COMPANY_COLORS[i], human: !!c.human,
      homePort: c.homePort, flag, cash: diff.cash, debt: 0,
      reputation: Math.round(FLAGS[flag].rating * 0.5 + 25),
      portsServed: [c.homePort], delivered: 0, late: 0, bankrupt: false, lowCashDays: 0,
      month: emptyBook(), lastMonth: emptyBook(), total: emptyBook(), history: [],
      ai: c.human ? null : { skill: diff.aiSkill, nextFleet: rng.int(1, 5) * D },
    });
  });
  for (let d = 0; d < 3; d++) eco.dailyMarketUpdate(state, rng);
  eco.refreshContracts(state, ctx, rng, true);
  // Dans chaque port d'attache, quelques contrats à la portée des petits navires du départ.
  for (const c of state.companies) {
    for (const type of ['caboteur', 'caboteur', 'polyvalent']) {
      for (let tries = 0; tries < 6; tries++) {
        const k = eco.makeContract(state, ctx, rng, c.homePort, type);
        if (k) { k.minRep = 0; k.expires = Math.max(k.expires, state.t + 10 * D); state.contracts.push(k); break; }
      }
    }
  }
  refreshUsedMarket(state, rng, true);
  dailyStorms(state, rng);
  news(state, 'Le marché du fret ouvre. Achetez un premier navire chez le courtier !', { kind: 'event' });
  recordHistory(state);
  state.rng = rng.s;
  return state;
}

// ---------- Marché de l'occasion ----------
function makeListing(state, rng, port, typeId, ageRange, condRange) {
  const T = SHIP_TYPES[typeId];
  const age = rng.range(...ageRange);
  const condition = Math.round(rng.range(...condRange));
  const fake = { type: typeId, builtT: state.t - age * 365 * D, condition };
  const price = Math.round((eco.shipValue(state, fake) * rng.range(0.92, 1.08)) / 10000) * 10000;
  return {
    id: state.nextId++, type: typeId, age: Math.round(age * 10) / 10, condition, port, price,
    name: pickShipName(state, rng), until: state.t + rng.int(20, 45) * D,
  };
}

function refreshUsedMarket(state, rng, initial = false) {
  state.used = state.used.filter((l) => l.until > state.t);
  if (initial) {
    // De quoi démarrer dans chaque port d'attache : un caboteur fatigué et un cargo plus grand.
    for (const c of state.companies) {
      state.used.push(makeListing(state, rng, c.homePort, 'caboteur', [16, 22], [62, 78]));
      const second = PORTS[c.homePort].terminals.includes('liquide') && rng.chance(0.3) ? 'petrolier_mr' : 'polyvalent';
      state.used.push(makeListing(state, rng, c.homePort, second, [18, 23], [58, 75]));
    }
  }
  const types = Object.keys(SHIP_TYPES);
  while (state.used.length < 12 + state.companies.length) {
    const typeId = rng.pick(types);
    const T = SHIP_TYPES[typeId];
    const ports = PORT_IDS.filter((p) => PORTS[p].draft >= T.draft && T.holds.some((h) => PORTS[p].terminals.includes(h)));
    state.used.push(makeListing(state, rng, rng.pick(ports), typeId, [2, T.life - 4], [45, 96]));
  }
}

// ---------- Avancée du temps ----------
// Renvoie la liste des notifications utiles à l'interface (navire disponible, naufrage...).
export function tick(state, ctx, hours = 1) {
  if (state.over) return [];
  const rng = new Rng(state.rng);
  const notes = [];
  for (let h = 0; h < hours && !state.over; h++) stepHour(state, ctx, rng, notes);
  state.rng = rng.s;
  return notes;
}

function note(state, notes, kind, ship, text) {
  const company = companyOf(state, ship);
  if (!company.human) return;
  notes.push({ kind, shipId: ship.id, company: company.id, text });
}

function stepHour(state, ctx, rng, notes) {
  state.t += 1;
  moveStorms(state);
  for (const ship of [...state.ships]) {
    const h = ship.hours || (ship.hours = { laden: 0, ballast: 0, port: 0, laidup: 0 });
    if (ship.status === 'sea') h[ship.cargo ? 'laden' : 'ballast']++;
    else h[ship.status === 'laidup' ? 'laidup' : 'port']++;
    if (ship.status === 'sea') sailHour(state, ctx, rng, ship, notes);
    else if (ship.status === 'port') portHour(state, ctx, rng, ship, notes);
  }
  for (const o of [...state.orders]) if (o.due <= state.t) deliverOrder(state, rng, o, notes);
  for (const ship of state.ships) {
    const c = companyOf(state, ship);
    if (!c.human && !c.bankrupt && isIdle(ship)) aiShipIdle(state, ctx, rng, ship);
  }
  if (state.t % D === 0) daily(state, ctx, rng, notes);
}

function portHour(state, ctx, rng, ship, notes) {
  const T = SHIP_TYPES[ship.type];
  ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D);
  if (ship.busyWhat && state.t >= ship.busyUntil) {
    const what = ship.busyWhat;
    ship.busyWhat = null;
    if (what === 'déchargement' && ship.pendingDelivery) deliverContract(state, ship);
    if (what === 'réparation') { ship.condition = ship.repairTo; ship.repairTo = null; }
    if (ship.plan) {
      const r = act.runPlan(state, ctx, ship);
      if (!r.ok) note(state, notes, 'idle', ship, `Le ${ship.name} n'a pas pu appareiller : ${r.msg}`);
      else note(state, notes, 'depart', ship, `Le ${ship.name} appareille.`);
      return;
    }
    const labels = { chargement: 'a terminé son chargement', 'déchargement': 'a terminé son déchargement', 'réparation': 'est réparé', 'réarmement': 'est réarmé' };
    note(state, notes, 'idle', ship, `Le ${ship.name} ${labels[what] || 'est prêt'} à ${portName(ship.port)}.`);
  }
}

function sailHour(state, ctx, rng, ship, notes) {
  const T = SHIP_TYPES[ship.type];
  const v = ship.voyage;
  const route = ctx.shipRoute(ship);
  const company = companyOf(state, ship);
  if (!route) { arrive(state, ctx, ship, notes); return; }

  // En attente devant un canal fermé.
  if (v.waitCanal) {
    if (ctx.closedCanals(state, T.draft).includes(v.waitCanal)) { ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D); return; }
    note(state, notes, 'info', ship, `Le ${ship.name} peut enfin franchir le ${CANAL_NAMES[v.waitCanal]}.`);
    v.waitCanal = null;
  }
  // Immobilisé par une avarie.
  if (v.stalledUntil > state.t) { ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D); return; }

  const pos = pointAlong(route, v.progress);
  const wx = weatherAt(state, pos.lon, pos.lat);
  const speedFactor = wx.force >= 7 ? Math.max(0.45, 1 - (wx.force - 6) * 0.08) : 1;
  const condFactor = ship.condition < 50 ? 1 - (50 - ship.condition) / 120 : 1;
  const step = v.speed * speedFactor * condFactor;

  // Canal fermé pendant le voyage : on s'arrête devant.
  for (const c of route.canals) {
    const at = route.canalAt?.[c];
    if (at == null || v.progress > at || v.progress + step < at) continue;
    if (ctx.closedCanals(state, T.draft).includes(c)) {
      v.progress = at;
      v.waitCanal = c;
      note(state, notes, 'info', ship, `Le ${ship.name} est bloqué devant le ${CANAL_NAMES[c]} fermé. Il attendra la réouverture.`);
      shipLog(state, ship, `Bloqué devant le ${CANAL_NAMES[c]}`);
      return;
    }
  }

  const age = eco.ageYears(state, ship);
  v.progress += step;
  ship.fuel -= (eco.burnPerDay(T, v.speed, age) / D) * (1 + Math.max(0, wx.force - 6) * 0.06);

  // Usure : plus rapide pour un vieux navire et par gros temps.
  let wear = 0.0025 * (1 + age / 15);
  if (wx.force >= 9) wear += (wx.force - 8) * 0.045 * (1 + (100 - ship.condition) / 100);
  ship.condition = Math.max(0, ship.condition - wear);

  if (wx.storm && wx.force >= 9 && !v.storms.includes(wx.storm.id)) {
    v.storms.push(wx.storm.id);
    note(state, notes, 'storm', ship, `Le ${ship.name} affronte ${articleStorm(wx.storm.name)} (force ${wx.force}).`);
    shipLog(state, ship, `${wx.storm.name} : vent force ${wx.force}`);
  }

  // Avarie de machine.
  const pBreak = (0.0012 + Math.max(0, 60 - ship.condition) / 2500) / D;
  if (rng.chance(pBreak)) {
    const hours = rng.int(12, 60);
    const cost = Math.round(rng.range(20000, 60000) * Math.sqrt(T.gt / 5000));
    v.stalledUntil = state.t + hours;
    money(state, company, -cost, 'reparations');
    ship.spent += cost;
    note(state, notes, 'breakdown', ship, `Avarie de machine à bord du ${ship.name} : immobilisé ${Math.round(hours / 24 * 10) / 10} jours, réparation de fortune ${(cost / 1000).toFixed(0)} k$.`);
    shipLog(state, ship, 'Avarie de machine en mer');
  }

  // Naufrage : coque très usée prise dans une forte tempête.
  if (ship.condition <= 0 || (ship.condition < 22 && wx.force >= 10 && rng.chance(0.004 * (wx.force - 9)))) {
    sink(state, ctx, ship, notes, pos, wx);
    return;
  }

  // Panne sèche : soutage d'urgence en mer, très cher.
  if (ship.fuel <= 0) {
    const qty = Math.round(T.tank * 0.3);
    const cost = qty * eco.worldFuelPrice(state) * 2.5 + 40000;
    money(state, company, -cost, 'carburant');
    ship.spent += cost;
    ship.fuel = qty;
    v.stalledUntil = state.t + 24;
    changeReputation(company, -1);
    note(state, notes, 'fuel', ship, `Panne sèche ! Le ${ship.name} a dû être ravitaillé en mer (${(cost / 1000).toFixed(0)} k$).`);
    shipLog(state, ship, 'Panne sèche, soutage d\'urgence');
  }

  if (v.progress >= route.nm) arrive(state, ctx, ship, notes);
}

function articleStorm(name) {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (/^(ouragan|typhon|cyclone)/.test(lower)) return `un ${lower}`;
  if (/^(quarantièmes)/.test(lower)) return `les ${lower}`;
  if (/^(mistral|coup)/.test(lower)) return `un ${lower}`;
  return `une ${lower}`;
}

function arrive(state, ctx, ship, notes) {
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  const to = ship.voyage.to;
  ship.status = 'port';
  ship.port = to;
  ship.voyage = null;
  ctx.forget(ship.id);
  const fee = eco.portFee(T, to);
  money(state, company, -fee, 'ports');
  ship.spent += fee;
  if (!company.portsServed.includes(to)) { company.portsServed.push(to); changeReputation(company, 0.5); }
  shipLog(state, ship, `Arrivée à ${portName(to)}`);
  if (ship.cargo?.contractId) {
    ship.pendingDelivery = ship.cargo.contractId;
    act.startBusy(state, ship, 'déchargement', eco.handlingHours(to, ship.cargo.hold, ship.cargo.qty));
    const strike = state.strikes[to] > state.t ? ' (grève en cours : déchargement retardé)' : '';
    note(state, notes, 'arrival', ship, `Le ${ship.name} est arrivé à ${portName(to)} et décharge${strike}.`);
  } else {
    note(state, notes, 'idle', ship, `Le ${ship.name} est arrivé à ${portName(to)}.`);
  }
}

function deliverContract(state, ship) {
  const c = contractById(state, ship.pendingDelivery);
  const company = companyOf(state, ship);
  ship.pendingDelivery = null;
  ship.cargo = null;
  if (!c) return;
  const penalty = eco.latePenalty(c, state.t);
  const pay = c.pay * (1 - penalty);
  money(state, company, pay, 'fret');
  ship.earned += pay;
  company.delivered++;
  if (penalty > 0) {
    company.late++;
    changeReputation(company, -(2 + penalty * 10));
    shipLog(state, ship, `Livraison en retard à ${portName(c.to)} : ${(pay / 1000).toFixed(0)} k$ (pénalité ${Math.round(penalty * 100)} %)`);
  } else {
    changeReputation(company, 1.5 * (1 - company.reputation / 110));
    shipLog(state, ship, `Livraison à ${portName(c.to)} : ${(pay / 1000).toFixed(0)} k$`);
  }
  state.contracts = state.contracts.filter((x) => x !== c);
}

function sink(state, ctx, ship, notes, pos, wx) {
  const company = companyOf(state, ship);
  const T = SHIP_TYPES[ship.type];
  const value = eco.shipValue(state, { ...ship, condition: 50 });
  const insurance = value * 0.5;
  company.cash += insurance;
  if (ship.cargo?.contractId) changeReputation(company, -10);
  changeReputation(company, -5);
  const cause = wx.storm ? `a sombré dans ${articleStorm(wx.storm.name)}` : 'a sombré : sa coque, à bout de souffle, a cédé';
  news(state, `Naufrage ! Le ${ship.name} (${company.name}) ${cause}. L'équipage a été hélitreuillé. L'assurance verse ${(insurance / 1e6).toFixed(2).replace('.', ',')} M$.`, { company: company.id, kind: 'disaster' });
  note(state, notes, 'sunk', ship, `Le ${ship.name} a fait naufrage. L'équipage est sauf ; l'assurance couvre la moitié de sa valeur.`);
  removeShip(state, ctx, ship);
  state.wrecks = state.wrecks || [];
  state.wrecks.push({ lon: pos.lon, lat: pos.lat, name: ship.name, t: state.t, type: T.name });
}

function deliverOrder(state, rng, order, notes) {
  state.orders = state.orders.filter((o) => o !== order);
  const company = state.companies[order.owner];
  if (company.bankrupt) return;
  const ship = createShip(state, rng, order.owner, order.type, { port: order.yard, name: order.name || undefined });
  ship.fuel = SHIP_TYPES[order.type].tank * 0.6;
  shipLog(state, ship, `Livré neuf par le chantier de ${portName(order.yard)}`);
  news(state, `${company.name} prend livraison du ${ship.name}, ${SHIP_TYPES[order.type].name.toLowerCase()} neuf, à ${portName(order.yard)}.`, { company: company.id, kind: 'fleet' });
  note(state, notes, 'idle', ship, `Le ${ship.name} sort du chantier de ${portName(order.yard)} : il attend vos ordres.`);
}

// ---------- Une fois par jour ----------
function daily(state, ctx, rng, notes) {
  eco.dailyMarketUpdate(state, rng);
  const ev = dailyEvents(state, rng);
  if (ev) notes.push({ kind: 'event', text: `${ev.title} — ${ev.text}` });
  dailyStorms(state, rng);
  eco.refreshContracts(state, ctx, rng);

  for (const ship of state.ships) {
    const T = SHIP_TYPES[ship.type];
    const company = companyOf(state, ship);
    const crew = eco.crewDayCost(T, company.flag) * (ship.status === 'laidup' ? 0.2 : 1);
    const opex = eco.opexDay(T, eco.ageYears(state, ship)) * (ship.status === 'laidup' ? 0.3 : 1);
    money(state, company, -crew, 'equipage');
    money(state, company, -opex, 'exploitation');
    ship.spent += crew + opex;
  }

  for (const company of state.companies) {
    if (company.bankrupt) continue;
    if (company.debt > 0) money(state, company, -(company.debt * interestRate(company)) / 365, 'interets');
    if (company.cash < 0) money(state, company, (company.cash * 0.2) / 365, 'interets'); // découvert à 20 %
    checkBank(state, ctx, company, notes);
    if (!company.human) aiDaily(state, ctx, rng, company);
  }

  const day = state.t / D;
  if (day % 7 === 0) { refreshUsedMarket(state, rng); recordHistory(state); }
  const d = dateOf(state.t);
  if (d.getUTCDate() === 1) monthly(state, notes);
  checkEnd(state, notes);
}

function monthly(state) {
  for (const company of state.companies) {
    if (company.bankrupt) continue;
    const profit = bookTotal(company.month);
    if (profit > 0) {
      const tax = profit * FLAGS[company.flag].tax;
      if (tax > 0) money(state, company, -tax, 'impots');
    }
    company.lastMonth = company.month;
    company.month = emptyBook();
  }
}

// La banque saisit un navire quand le découvert dépasse ce qu'elle tolère.
function checkBank(state, ctx, company, notes) {
  const limit = 300000 + 0.1 * fleetValue(state, company.id);
  if (company.cash >= -limit) { company.lowCashDays = 0; return; }
  const ships = shipsOf(state, company.id).sort((a, b) => eco.shipValue(state, a) - eco.shipValue(state, b));
  if (ships.length) {
    const s = ships[0];
    const price = eco.shipValue(state, s) * 0.75;
    company.cash += price;
    if (s.cargo?.contractId) changeReputation(company, -10);
    changeReputation(company, -6);
    news(state, `La banque de ${company.name} saisit et vend le ${s.name} pour ${(price / 1e6).toFixed(2).replace('.', ',')} M$.`, { company: company.id, kind: 'disaster' });
    if (company.human) notes.push({ kind: 'bank', company: company.id, text: `Découvert trop important : la banque a saisi et vendu le ${s.name}.` });
    removeShip(state, ctx, s);
  } else if (company.cash < -limit) {
    company.bankrupt = true;
    news(state, `${company.name} est en faillite.`, { company: company.id, kind: 'disaster' });
    if (company.human) notes.push({ kind: 'bankrupt', company: company.id, text: `${company.name} est en faillite.` });
  }
}

export function recordHistory(state) {
  state.marketHistory = state.marketHistory || [];
  state.marketHistory.push({
    t: state.t, fuel: Math.round(eco.worldFuelPrice(state)), ships: state.market.shipIndex,
    freight: { ...state.market.freight },
  });
  if (state.marketHistory.length > 600) state.marketHistory.splice(0, state.marketHistory.length - 600);
  for (const c of state.companies) {
    c.history.push({ t: state.t, nw: Math.round(netWorth(state, c.id)) });
    if (c.history.length > 600) c.history.splice(0, c.history.length - 600);
  }
}

export function ranking(state) {
  return state.companies
    .map((c) => ({ company: c, worth: netWorth(state, c.id) }))
    .sort((a, b) => (a.company.bankrupt - b.company.bankrupt) || b.worth - a.worth);
}

function checkEnd(state, notes) {
  const humans = state.companies.filter((c) => c.human);
  const years = state.settings.duration;
  let reason = null;
  if (years && state.t >= years * 365 * D) reason = `Fin de la partie : ${years} ans se sont écoulés.`;
  else if (humans.length && humans.every((c) => c.bankrupt)) reason = 'Toutes les compagnies des joueurs ont fait faillite.';
  if (reason) {
    state.over = { reason, t: state.t };
    recordHistory(state);
    notes.push({ kind: 'over', text: reason });
  }
}

export { formatDate };
