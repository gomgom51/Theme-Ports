// Ordres permanents des joueurs : la ligne régulière (↻) et le capitaine libre (🧭).
// Choix du propriétaire : l'automatisation se mérite et se paie.
//  - Ligne régulière : équipage confirmé ou mieux, expérience au maximum (les six points). Le navire fait
//    la navette entre deux ports ; à chaque escale il prend le meilleur chargement pour l'autre bout
//    (contrat, ou la marchandise de la ligne achetée comptant), sinon repart à vide si la boucle paie.
//  - Capitaine libre : équipage de vieux briscards (4e niveau). Le capitaine choisit lui-même contrats et
//    cargaisons, avec les calculs des concurrents mais sans erreur d'estimation, dans les limites fixées
//    par le joueur. Ses honoraires se paient chaque jour. Reprendre la main sans qu'il vous ait appelé :
//    le vieux briscard quitte le navire (un point de la spécialité perdu, à regagner en mer).
// Les encaissements restent à la main (le plaisir d'encaisser, choix du propriétaire).
// Règle 1 : un navire sous ordres ne prend jamais un risque que le joueur n'a pas vu en donnant l'ordre ;
// dès qu'un risque nouveau apparaît, ou qu'une décision lui revient, il appelle le joueur et attend.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { OIL_GOODS } from '../data/goods.js';
import * as eco from './economy.js';
import * as act from './actions.js';
import { shipLog, portName, contractById, book } from './core.js';
import { HOURS_PER_DAY } from './util.js';
import { money } from './format.js';
import { crewMaxed, BRISCARD_LEVEL, loseBriscardPoint } from './crew.js';
import { inspectionThreshold, isStrict, hullRisk } from './incidents.js';
import { piracyAlong } from './piracy.js';
import { pirateBoost, hostilePort, payCut } from './plots.js';
import { grudgeAt } from './dark.js';
import { isPolluting } from './pollution.js';
import { imageFactor } from './clients.js';
import { quoteSellAt, buyableStock } from './trade.js';
import { jobOptions, bestOutlet, tripCost } from './ai.js';

const D = HOURS_PER_DAY;

export const ORDERS = {
  repairBelow: 60, // ligne : passer au chantier (à l'un des deux bouts) sous cet état, %
  repairTo: 92, // état visé par les réparations
  callWorn: 45, // ligne : trop usé et aucun chantier aux deux bouts : il appelle
  lineWaitDays: 3, // ligne : aucun chargement depuis tant de jours : il appelle
  // Capitaine libre : honoraires par jour = captainFee fois le salaire d'un seul marin du niveau captainLevel (chevronné).
  // Choix du propriétaire : « il fait le travail du patron », mais la somme reste marginale face à ce que rapporte le navire.
  captainFee: 3,
  captainLevel: 2,
  callDays: 5, // capitaine libre : rien ne convient depuis tant de jours : il appelle
  recheckH: 12, // heures avant de réessayer quand rien ne convient
  limits: { pirates: false, embargo: false, polluting: false, oil: false, maxDays: 30, trade: 2e6, repairBelow: 65 },
};
export const MAX_DAYS_CHOICES = [10, 20, 30, 45, 60];
export const TRADE_CHOICES = [0, 1e6, 2e6, 5e6, 10e6];

// Conditions (affichées sur la fiche du navire).
export const canLine = (ship) => (ship.crew || 0) > 0 && crewMaxed(ship);
export const canCaptain = (ship) => (ship.crew || 0) === BRISCARD_LEVEL;
export const lineWhy = (ship) => (canLine(ship) ? null : (ship.crew || 0) === 0
  ? 'Il faut un équipage confirmé ou mieux (onglet Escale), avec l\'expérience au maximum (six points).'
  : 'Il faut un équipage à l\'expérience maximale : les six points gagnés en mer.');
export const captainWhy = (ship) => (canCaptain(ship) ? null
  : 'Il faut un équipage de vieux briscards : la spécialité Vieux briscards au niveau 3 (onglet Équipage).');

// Sous ordres et en route (pas en train d'appeler le joueur).
export const onOrders = (ship) => !!ship.orders && !ship.orders.calling;
// Attend les ordres du joueur : à quai, libre, et pas confié à une ligne ou au capitaine.
export const waitsForOrders = (ship) => ship.status === 'port' && !ship.busyWhat && !ship.plan && !onOrders(ship);

export function captainFeeDay(state, ship) {
  const company = state.companies[ship.owner];
  const T = SHIP_TYPES[ship.type];
  return ORDERS.captainFee * eco.crewDayCost(T, company.flag, ORDERS.captainLevel) / T.crew; // un homme, pas tout l'équipage
}

// ---------- Les risques d'un trajet, vus par l'ordre (règle 1) ----------
// Une liste de marqueurs : ceux présents quand le joueur donne l'ordre sont acceptés ; un nouveau fait appeler.
function routeFlags(state, ctx, ship, from, to) {
  const company = state.companies[ship.owner];
  const T = SHIP_TYPES[ship.type];
  const out = [];
  const closed = ctx.closedCanals(state, T.draft, ship);
  const route = ctx.route(from, to, closed);
  for (const z of piracyAlong(route)) {
    out.push(`pirates:${z.zone.id}`);
    if (pirateBoost(state, ship, z.zone.id)) out.push('paid-pirates');
  }
  if (eco.isEmbargoedPort(to) || eco.isEmbargoedPort(from)) out.push('embargo');
  if (grudgeAt(state, company, to)) out.push('gang');
  if (hostilePort(state, company.id, to)) out.push('authorities');
  if (hullRisk(ship, to)) out.push('single-hull');
  return out;
}
const FLAG_TEXT = {
  pirates: 'une zone de pirates sur la route', 'paid-pirates': 'des pirates payés contre vous sur la route', embargo: 'un pays sous embargo',
  gang: 'un gang qui vous en veut à destination', authorities: 'des autorités achetées contre vous à destination', 'single-hull': 'un contrôle des pétroliers à simple coque',
  ice: 'les glaces à l\'arrivée', worn: 'un navire usé dans un port exigeant',
};
const flagText = (f) => FLAG_TEXT[f.split(':')[0]] || f;

// ---------- Donner, suspendre, reprendre ----------
// Ligne régulière entre le port actuel (ou de départ) et la destination. trade : la marchandise de la ligne,
// achetée au départ (bien, quantité), ou null pour une ligne de contrats.
export function setLine(state, ctx, shipId, { from, to, speed, trade = null }) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return { ok: false, msg: 'Navire introuvable.' };
  if (!canLine(ship)) return { ok: false, msg: lineWhy(ship) };
  if (!from || !to || from === to) return { ok: false, msg: 'Une ligne relie deux ports différents.' };
  const accepted = [...new Set([...routeFlags(state, ctx, ship, from, to), ...routeFlags(state, ctx, ship, to, from)])];
  ship.orders = { kind: 'line', a: from, b: to, speed, trade: trade ? { at: from, good: trade.good, qty: trade.qty } : null, accepted, calling: null, since: state.t };
  shipLog(state, ship, `Ligne régulière ${portName(from)} ⇄ ${portName(to)}`);
  return { ok: true };
}
export function setCaptain(state, shipId, limits) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return { ok: false, msg: 'Navire introuvable.' };
  if (!canCaptain(ship)) return { ok: false, msg: captainWhy(ship) };
  const was = ship.orders?.kind === 'captain';
  ship.orders = { kind: 'captain', limits: { ...ORDERS.limits, ...limits }, calling: null, since: state.t };
  ship.captainLimits = ship.orders.limits; // retrouvées la prochaine fois qu'on lui confie le navire
  if (!was) shipLog(state, ship, 'Le capitaine choisit désormais lui-même ses chargements');
  return { ok: true };
}
// Relancer après un appel (le joueur a réglé le problème, ou veut réessayer).
export function resumeOrders(state, shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship?.orders) return { ok: false, msg: 'Aucun ordre permanent.' };
  if (ship.orders.kind === 'line' && !canLine(ship)) return { ok: false, msg: lineWhy(ship) };
  if (ship.orders.kind === 'captain' && !canCaptain(ship)) return { ok: false, msg: captainWhy(ship) };
  ship.orders.calling = null;
  ship.orders.idleSince = null;
  ship.orders.next = 0;
  return { ok: true };
}
// Ce que coûte de reprendre la main maintenant (affiché avant de confirmer).
export const takeBackCost = (ship) => (ship.orders?.kind === 'captain' && !ship.orders.calling ? 'briscard' : null);
// Reprendre la main : gratuit pour une ligne, ou quand le capitaine vous a appelé ; sinon le vieux
// briscard quitte le navire (un point de la spécialité, l'expérience redescend d'un palier).
export function takeBack(state, shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship?.orders) return { ok: true, lost: false };
  const lost = takeBackCost(ship) === 'briscard' && loseBriscardPoint(ship);
  shipLog(state, ship, lost ? 'Vous reprenez la main sans que le capitaine vous ait appelé : le vieux briscard quitte le navire'
    : ship.orders.kind === 'line' ? 'Fin de la ligne régulière' : 'Vous reprenez la main');
  ship.orders = null;
  return { ok: true, lost };
}

// ---------- Une heure : les navires sous ordres qui sont libres agissent ----------
// say(kind, ship, text) : la notification au joueur (game.js) ; kind 'idle' arrête le temps (pause auto).
export function ordersHour(state, ctx, ship, say) {
  const o = ship.orders;
  if (!o || o.calling || ship.status !== 'port' || ship.busyWhat || ship.plan) return;
  if (ship.hijacked || ship.seized || ship.dark) return;
  if (o.next && o.next > state.t) return;
  const call = (reason) => {
    o.calling = reason;
    o.next = 0;
    shipLog(state, ship, `Appel du capitaine : ${reason}`);
    say('idle', ship, `Le ${ship.name} vous appelle : ${reason}.`);
  };
  if (o.kind === 'line') lineStep(state, ctx, ship, o, call);
  else if (o.kind === 'captain') captainStep(state, ctx, ship, o, call);
}

// Partir, en s'assurant de pouvoir payer le plein (sinon il appelle).
function sail(state, ctx, ship, to, speed, call) {
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const p = act.planVoyage(state, ctx, ship, to, speed);
  if (p.error) { call(p.error.replace(/\.$/, '').toLowerCase()); return false; }
  const fuel = Math.max(0, Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, ship.port);
  if (fuel > company.cash) { call('pas de quoi payer le plein'); return false; }
  const r = act.depart(state, ctx, ship.id, to, speed, true);
  if (!r.ok) { call(r.msg.replace(/\.$/, '').toLowerCase()); return false; }
  return true;
}

// Passer au chantier s'il y en a un ici et que l'état le demande. Renvoie true si le navire y reste.
function repairHere(state, ship, below, call) {
  const company = state.companies[ship.owner];
  const age = eco.ageYears(state, ship);
  if (ship.condition >= Math.max(below, inspectionThreshold(age) + 6) || PORTS[ship.port].repair < 1) return false;
  const rc = eco.repairCost(state, ship, ship.port, ORDERS.repairTo);
  if (!rc || rc.points <= 5) return false;
  if (rc.cost > company.cash) { call(`pas de quoi payer les réparations (${money(rc.cost)})`); return true; }
  return act.repair(state, ship.id, ORDERS.repairTo).ok;
}

// Un risque nouveau, absent quand l'ordre a été donné ? (règle 1)
function newRisk(state, ctx, ship, to, accepted) {
  const flags = routeFlags(state, ctx, ship, ship.port, to);
  const age = eco.ageYears(state, ship);
  if (ship.condition < inspectionThreshold(age) && isStrict(to)) flags.push('worn');
  const p = act.planVoyage(state, ctx, ship, to, SHIP_TYPES[ship.type].speed);
  if (p.iceRisk > 0) flags.push('ice');
  return flags.find((f) => !accepted.includes(f)) || null;
}

// ---------- Ligne régulière ----------
function lineStep(state, ctx, ship, o, call) {
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const here = ship.port;
  if (!canLine(ship)) { call('l\'équipage ne remplit plus les conditions de la ligne'); return; }
  const other = here === o.a ? o.b : here === o.b ? o.a : null;
  if (!other) { call(`le navire n'est à aucun des deux ports de la ligne (${portName(o.a)}, ${portName(o.b)})`); return; }
  // Marchandise de la ligne à bord : on la vend ici (le navire décharge, puis reprend la ligne).
  if (ship.cargo && !ship.cargo.contractId) {
    if (here === o.trade?.at) { if (!sail(state, ctx, ship, other, o.speed, call)) return; return; } // achetée ici, départ raté : on repart
    const r = act.sellCargo(state, ctx, ship.id);
    if (!r.ok) call(r.msg.replace(/\.$/, '').toLowerCase());
    return;
  }
  if (ship.cargo?.contractId) { // contrat à bord, départ raté (carburant) : on repart
    const c = contractById(state, ship.cargo.contractId);
    if (c) sail(state, ctx, ship, c.to, o.speed, call); else call('contrat introuvable');
    return;
  }
  // Entretien aux bouts de la ligne.
  if (repairHere(state, ship, ORDERS.repairBelow, call)) return;
  if (ship.condition < ORDERS.callWorn && PORTS[o.a].repair < 1 && PORTS[o.b].repair < 1) { call(`état ${Math.round(ship.condition)} % et aucun chantier aux deux bouts de la ligne`); return; }
  const risk = newRisk(state, ctx, ship, other, o.accepted);
  if (risk) { call(`nouveau risque sur la route de ${portName(other)} : ${flagText(risk)}`); return; }
  const back = tripCost(state, ctx, { ...ship, port: other, cargo: null }, here);
  // Ce que paie la ligne : contrats pour l'autre bout, ou la marchandise de la ligne.
  const options = [];
  for (const c of state.contracts) {
    if (c.from !== here || c.to !== other || c.takenBy !== null) continue;
    if (act.checkContract(state, ctx, ship, c)) continue;
    const loadH = eco.handlingHours(here, c.hold, c.qty, ship.type) + eco.handlingHours(other, c.hold, c.qty, ship.type);
    const trip = tripCost(state, ctx, ship, other, loadH);
    if (!trip || state.t + (trip.days + 1) * D > c.deadline) continue;
    const pay = c.pay * payCut(state, company.id, c.from) * imageFactor(company, c.client);
    options.push({ kind: 'contract', c, profit: pay - trip.cost });
  }
  if (o.trade && o.trade.at === here) {
    const g = o.trade.good, hold = eco.holdFor(ship.type, g);
    const unit = eco.buyPrice(state, here, g);
    const budget = company.cash - T.tank * eco.fuelPrice(state, here) - 100000; // comptant, en gardant de quoi faire le plein
    const qty = Math.floor(Math.min(o.trade.qty, T.dwt, buyableStock(state, here, g), Math.max(0, budget) / (unit * 1.05)) / 100) * 100;
    if (hold && qty >= o.trade.qty * 0.4) {
      const loadH = eco.handlingHours(here, hold, qty, ship.type) + eco.handlingHours(other, hold, qty, ship.type);
      const trip = tripCost(state, ctx, ship, other, loadH);
      if (trip) {
        const buy = act.quoteBuy(state, ship, g, qty).total;
        const sell = quoteSellAt(state, other, g, qty, trip.days, ship.id).total - qty * eco.HANDLING_COST[hold];
        options.push({ kind: 'trade', qty, profit: sell - buy - trip.cost - (back ? back.cost : 0) });
      }
    }
  }
  options.sort((x, y) => y.profit - x.profit);
  const best = options[0];
  if (best && best.profit > 0) {
    o.idleSince = null;
    if (best.kind === 'contract') {
      const p = act.planVoyage(state, ctx, ship, other, o.speed);
      const fuel = p.error ? 0 : Math.max(0, Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, here);
      if (fuel > company.cash) { call('pas de quoi payer le plein'); return; }
      const r = act.acceptContract(state, ctx, ship.id, best.c.id, { speed: o.speed, autoRefuel: true });
      if (!r.ok) call(r.msg.replace(/\.$/, '').toLowerCase());
    } else {
      const r = act.buyCargo(state, ctx, ship.id, o.trade.good, best.qty, null);
      if (!r.ok) { call(r.msg.replace(/\.$/, '').toLowerCase()); return; }
      sail(state, ctx, ship, other, o.speed, call);
    }
    return;
  }
  if (best && best.kind === 'trade') { call(`la marge de la ligne passe sous zéro (${money(best.profit)} par aller-retour)`); return; }
  // Rien à charger ici : repartir à vide si l'autre bout a de quoi charger (la marchandise de la ligne, ou un contrat pour ici).
  const waiting = (o.trade && o.trade.at === other) || state.contracts.some((c) => c.from === other && c.to === here && c.takenBy === null
    && !act.checkContract(state, ctx, { ...ship, port: other, cargo: null }, c));
  if (waiting) { o.idleSince = null; sail(state, ctx, ship, other, o.speed, call); return; }
  o.idleSince ??= state.t;
  if (state.t - o.idleSince > ORDERS.lineWaitDays * D) { call(`aucun chargement sur la ligne depuis ${ORDERS.lineWaitDays} jours`); return; }
  o.next = state.t + ORDERS.recheckH;
}

// ---------- Capitaine libre ----------
function captainStep(state, ctx, ship, o, call) {
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const here = ship.port;
  const L = o.limits;
  if (!canCaptain(ship)) { call('le vieux briscard a quitté le navire : le capitaine ne choisit plus seul'); return; }
  // Ce que le joueur a exclu, et ce qu'un capitaine prudent ne fait jamais (glaces : tripCost les écarte).
  const routeOk = (to, trip) => {
    if (trip.days > L.maxDays) return false;
    if (!L.embargo && (eco.isEmbargoedPort(to) || eco.isEmbargoedPort(here))) return false;
    if (hostilePort(state, company.id, to)) return false;
    const zones = trip.plan.route ? piracyAlong(trip.plan.route) : [];
    if (zones.some((z) => pirateBoost(state, ship, z.zone.id))) return false;
    if (!L.pirates && zones.length) return false;
    if (ship.condition < inspectionThreshold(eco.ageYears(state, ship)) && isStrict(to)) return false; // détention possible
    return true;
  };
  const goodOk = (g) => (L.polluting || !isPolluting(g)) && (L.oil || !OIL_GOODS.includes(g));
  // Contrat à bord, départ raté (carburant) : on repart.
  if (ship.cargo?.contractId) {
    const c = contractById(state, ship.cargo.contractId);
    if (c) sail(state, ctx, ship, c.to, T.speed, call); else call('contrat introuvable');
    return;
  }
  // Entretien : le chantier d'ici, sinon le plus proche si le navire est très usé.
  if (repairHere(state, ship, L.repairBelow, call)) return;
  // Marchandise à bord : vendre ici, ou là où elle se vend mieux.
  if (ship.cargo) {
    const best = bestOutlet(state, ctx, ship, { avoidEmbargo: !L.embargo, skip: (p, trip) => !routeOk(p, trip) });
    if (best.port !== here) { sail(state, ctx, ship, best.port, T.speed, call); return; }
    const r = act.sellCargo(state, ctx, ship.id);
    if (!r.ok) call(r.msg.replace(/\.$/, '').toLowerCase());
    return;
  }
  if (ship.condition < 52 && PORTS[here].repair < 2) {
    let best = null;
    for (const p of PORT_IDS) {
      if (p === here || PORTS[p].repair < 2 || !eco.fitsPort(p, ship.type) || hullRisk(ship, p)) continue;
      const trip = tripCost(state, ctx, ship, p);
      if (!trip || !routeOk(p, trip)) continue;
      if (!best || trip.days < best.days) best = { p, days: trip.days };
    }
    if (best) { sail(state, ctx, ship, best.p, T.speed, call); return; }
    call(`état ${Math.round(ship.condition)} % et aucun chantier à portée dans vos limites`);
    return;
  }
  // Les chargements d'ici, sans erreur d'estimation, sans prêt, dans les limites.
  const reserve = T.tank * eco.fuelPrice(state, here) + eco.fixedDayCost(T, company.flag, 'active', 0, ship.crew) * 30 + 300000;
  const options = jobOptions(state, ctx, ship, {
    costNoise: (v) => v, saleNoise: () => 1, avoidEmbargo: !L.embargo, virtuous: false, finance: false,
    tradeBudget: Math.min(L.trade, (company.cash - reserve) * 0.8),
    skip: (kind, g, to, trip) => !goodOk(g) || !routeOk(to, trip),
  });
  const best = options[0];
  if (best && best.profit > 0) {
    o.idleSince = null; o.waited = false; o.cameFrom = null;
    if (best.kind === 'contract') {
      const p = act.planVoyage(state, ctx, ship, best.c.to, T.speed);
      const fuel = p.error ? 0 : Math.max(0, Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, here);
      if (fuel > company.cash) { call('pas de quoi payer le plein'); return; }
      const r = act.acceptContract(state, ctx, ship.id, best.c.id, { speed: T.speed, autoRefuel: true });
      if (!r.ok) call(r.msg.replace(/\.$/, '').toLowerCase());
    } else {
      const r = act.buyCargo(state, ctx, ship.id, best.good, best.qty, null);
      if (!r.ok) { call(r.msg.replace(/\.$/, '').toLowerCase()); return; }
      sail(state, ctx, ship, best.to, T.speed, call);
    }
    return;
  }
  // Rien ici : attendre un jour les nouveaux contrats si le port exporte ce que le navire transporte,
  // puis aller là où il y a des contrats pour lui (jamais retourner à vide d'où il vient).
  const hereHasWork = Object.keys(PORTS[here].exp).some((g) => eco.holdFor(ship.type, g) && eco.portHandles(here, eco.holdFor(ship.type, g)));
  if (hereHasWork && !o.waited) { o.waited = true; o.next = state.t + 24; return; }
  let target = null;
  for (const p of PORT_IDS) {
    if (p === here || p === o.cameFrom || !eco.fitsPort(p, ship.type) || hullRisk(ship, p)) continue;
    if (grudgeAt(state, company, p)) continue;
    const n = state.contracts.filter((c) => c.from === p && c.takenBy === null && goodOk(c.good) && (L.embargo || !c.embargo)
      && !act.checkContract(state, ctx, { ...ship, port: p, cargo: null }, c)).length;
    if (!n) continue;
    const trip = tripCost(state, ctx, ship, p);
    if (!trip || !routeOk(p, trip)) continue;
    const score = n / (trip.plan.nm + 800);
    if (!target || score > target.score) target = { p, score };
  }
  if (target) {
    o.idleSince = null; o.waited = false; o.cameFrom = here;
    sail(state, ctx, ship, target.p, T.speed * 0.9, call);
    return;
  }
  o.idleSince ??= state.t;
  if (state.t - o.idleSince > ORDERS.callDays * D) { call(`rien ne convient dans vos limites depuis ${ORDERS.callDays} jours`); return; }
  o.next = state.t + ORDERS.recheckH;
}

// Honoraires du capitaine libre, chaque jour (même quand il attend : il reste à bord).
export function ordersDaily(state, ship, company) {
  if (ship.orders && !company.human) { ship.orders = null; return; } // navire passé à une IA (rachat) : ses ordres s'arrêtent
  if (ship.orders?.kind !== 'captain' || ship.status === 'laidup') return;
  book(state, company, -captainFeeDay(state, ship), 'equipage', ship);
}
