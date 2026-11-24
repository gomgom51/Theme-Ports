// Actions des joueurs (et de l'IA). Chaque action renvoie { ok: true, ... }
// ou { ok: false, msg } avec un message lisible par le joueur.
import { PORTS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES, CREW_LEVELS } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import * as eco from './economy.js';
import {
  money, news, shipById, contractById, companyOf, creditLimit, createShip, shipLog, portName,
  changeReputation, removeShip,
} from './core.js';
import { HOURS_PER_DAY, formatDate } from './util.js';
import { CANAL_NAMES } from './context.js';
import { bannedUntil } from './pollution.js';
import { taintShip } from './shady.js';
import { equipMod } from './equipment.js';
import { clientRefusal } from './clients.js';
import { skillSpeed, skillHandling } from './crew.js';
import { isSeasonal, iceOpen, iceRisk, escortFee, iceClass, forecastText } from './ice.js';

const fail = (msg) => ({ ok: false, msg });
const fmtM = (v) => (v / 1e6).toFixed(2).replace('.', ',') + ' M$';

// Chantiers navals : coefficient de prix et délai de livraison (jours).
export const YARDS = {
  shanghai: { factor: 0.92, days: 80 },
  busan: { factor: 0.95, days: 75 },
  yokohama: { factor: 1.0, days: 80 },
  singapour: { factor: 1.03, days: 90 },
  dubai: { factor: 1.05, days: 90 },
  rotterdam: { factor: 1.12, days: 100 },
};

function notReady(ship) {
  if (!ship) return 'Navire introuvable.';
  if (ship.status === 'laidup') return 'Le navire est désarmé.';
  if (ship.status !== 'port') return 'Le navire n\'est pas au port.';
  if (ship.busyWhat) return `Le navire est occupé (${ship.busyWhat}).`;
  return null;
}

// Une grève bloque le chargement et le déchargement jusqu'à sa fin.
export function startBusy(state, ship, what, hours) {
  if (what === 'chargement' || what === 'déchargement') hours *= skillHandling(ship); // logisticiens
  let until = state.t + hours;
  const strike = state.strikes[ship.port];
  if (strike && strike > state.t && (what === 'chargement' || what === 'déchargement')) until = strike + hours;
  ship.busyWhat = what;
  ship.busyUntil = until;
}

// ---------- Carburant ----------
export function buyFuel(state, shipId, tonnes) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'port') return fail('Le navire doit être au port pour faire le plein.');
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  const qty = Math.max(0, Math.min(tonnes, T.tank - ship.fuel));
  if (qty < 1) return fail('Les soutes sont déjà pleines.');
  const price = eco.fuelPrice(state, ship.port);
  const cost = qty * price;
  if (cost > company.cash) return fail(`Il faut ${fmtM(cost)} pour ce plein.`);
  money(state, company, -cost, 'carburant');
  ship.fuel += qty;
  ship.spent += cost;
  return { ok: true, qty, cost };
}

// ---------- Réparations ----------
export function repair(state, shipId, target) {
  const ship = shipById(state, shipId);
  const err = notReady(ship);
  if (err) return fail(err);
  const rc = eco.repairCost(state, ship, ship.port, target);
  if (!rc) return fail(`Pas de chantier de réparation à ${portName(ship.port)}.`);
  if (rc.points <= 0) return fail('Rien à réparer à ce niveau.');
  const company = companyOf(state, ship);
  if (rc.cost > company.cash) return fail(`Il faut ${fmtM(rc.cost)} pour ces réparations.`);
  money(state, company, -rc.cost, 'reparations');
  ship.spent += rc.cost;
  ship.repairTo = rc.to;
  startBusy(state, ship, 'réparation', rc.hours);
  shipLog(state, ship, `Réparations à ${portName(ship.port)} (${Math.round(ship.condition)} → ${rc.to} %)`);
  return { ok: true, ...rc };
}

// ---------- Préparation d'un voyage ----------
export function planVoyage(state, ctx, ship, to, speed) {
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  const from = ship.port;
  speed = Math.max(6, Math.min(T.maxSpeed, speed || T.speed));
  if (!from) return { error: 'Le navire n\'est pas au port.' };
  if (to === from) return { error: 'Le navire est déjà dans ce port.' };
  if (!eco.fitsPort(to, ship.type)) {
    return { error: `Tirant d'eau trop important : ${T.draft} m pour ${eco.portDraft(to, ship.type)} m maximum à ${portName(to)}.` };
  }
  if (bannedUntil(company, PORTS[to].flag) > state.t) {
    return { error: `${FLAGS[PORTS[to].flag].name} interdit ses ports à votre compagnie jusqu'au ${formatDate(bannedUntil(company, PORTS[to].flag))} (pollution).` };
  }
  if (ship.cargo) {
    if (ship.cargo.contractId) {
      const c = contractById(state, ship.cargo.contractId);
      if (c && c.to !== to) return { error: `La cargaison est attendue à ${portName(c.to)}.` };
    } else if (!eco.portHandles(to, ship.cargo.hold)) {
      return { error: `${portName(to)} ne peut pas décharger cette cargaison.` };
    }
  }
  const closed = ctx.closedCanals(state, T.draft, ship);
  // Distance et canaux depuis les tables pré-calculées ; le tracé n'est calculé que si on le demande.
  const info = ctx.distanceInfo(from, to, closed);
  if (!info) return { error: 'Aucune route maritime praticable.' };
  const route = { nm: info.nm, canals: info.canals };
  const seaDays = route.nm / (24 * speed * skillSpeed(ship)); // mécaniciens experts
  const age = eco.ageYears(state, ship);
  const needFuel = eco.burnPerDay(T, speed, age) * equipMod(ship, 'burn') * seaDays * 1.08 + T.idleBurn;
  const est = eco.voyageEstimate(state, {
    typeId: ship.type, flag: company.flag, from, to, speed, nm: route.nm, canals: route.canals, age,
  });
  const res = {
    get route() { return ctx.route(from, to, closed); },
    speed, nm: route.nm, seaDays, needFuel, closed, canals: route.canals,
    fuelCost: needFuel * eco.fuelPrice(state, from), fixed: est.fixed, fees: est.fees,
    eta: state.t + Math.ceil(seaDays * HOURS_PER_DAY),
  };
  // Glaces : arrivée dans un port saisonnier (risque qu'il soit pris, escorte alors obligatoire)
  // et départ d'un port pris (escorte d'un brise-glace, payée au départ).
  if (isSeasonal(to)) {
    const risk = iceRisk(state, to, res.eta, ship);
    if (risk > 0) { res.iceRisk = risk; res.iceFee = escortFee(ship); res.iceText = forecastText(state, to, ship); }
  }
  if (isSeasonal(from) && !iceOpen(state, from, state.t, ship)) res.escortOut = escortFee(ship);
  if (needFuel > T.tank) {
    res.error = `Autonomie insuffisante : il faudrait ${Math.round(needFuel)} t de fuel pour ${T.tank} t de soutes. Réduisez la vitesse ou faites escale.`;
  }
  return res;
}

function launch(state, ctx, ship, plan) {
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  const p = planVoyage(state, ctx, ship, plan.to, plan.speed);
  if (p.error) return fail(p.error);
  if (ship.fuel < p.needFuel) {
    if (!plan.autoRefuel) return fail(`Carburant insuffisant : ${Math.round(p.needFuel)} t nécessaires, ${Math.round(ship.fuel)} t à bord.`);
    const want = Math.min(T.tank, p.needFuel * 1.12) - ship.fuel;
    const r = buyFuel(state, ship.id, want);
    if (!r.ok || ship.fuel < p.needFuel) return fail(`Carburant insuffisant et pas assez d'argent pour faire le plein (${Math.round(p.needFuel)} t nécessaires).`);
  }
  for (const c of p.canals) {
    const fee = eco.canalFee(T, c);
    money(state, company, -fee, 'ports');
    ship.spent += fee;
    shipLog(state, ship, `Péage du ${CANAL_NAMES[c]} : ${fmtM(fee)}`);
  }
  if (p.escortOut) { // port pris par les glaces : un brise-glace ouvre le chenal
    money(state, company, -p.escortOut, 'ports');
    ship.spent += p.escortOut;
    shipLog(state, ship, `Escorte d'un brise-glace pour sortir de ${portName(ship.port)} : ${fmtM(p.escortOut)}`);
    ship.iced = null;
  }
  ship.voyage = {
    from: ship.port, to: plan.to, speed: p.speed, closed: p.closed, progress: 0,
    departT: state.t, nm: p.nm, eta: p.eta, waitCanal: null, stalledUntil: 0, storms: [], startCond: ship.condition,
  };
  shipLog(state, ship, `Départ de ${portName(ship.port)} pour ${portName(plan.to)} (${Math.round(p.nm)} milles, ${p.speed} nœuds)`);
  ship.status = 'sea';
  ship.port = null;
  ship.plan = null;
  return { ok: true, plan: p };
}

// Appareiller tout de suite, ou dès la fin du chargement / des réparations.
export function depart(state, ctx, shipId, to, speed, autoRefuel = true) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'port') return fail('Le navire n\'est pas au port.');
  const p = planVoyage(state, ctx, ship, to, speed);
  if (p.error) return fail(p.error);
  const plan = { to, speed: p.speed, autoRefuel };
  if (ship.busyWhat) {
    ship.plan = plan;
    return { ok: true, queued: true, plan: p };
  }
  return launch(state, ctx, ship, plan);
}

// Appelé par la boucle de jeu quand un départ programmé peut partir.
export function runPlan(state, ctx, ship) {
  const plan = ship.plan;
  const r = launch(state, ctx, ship, plan);
  if (!r.ok) {
    ship.plan = null;
    shipLog(state, ship, `Départ annulé : ${r.msg}`);
  }
  return r;
}

// Changer de vitesse en mer (la consommation varie avec le cube de la vitesse).
export function setSpeed(state, shipId, speed) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'sea') return fail('Le navire n\'est pas en mer.');
  const T = SHIP_TYPES[ship.type];
  ship.voyage.speed = Math.round(Math.max(6, Math.min(T.maxSpeed, speed)) * 2) / 2;
  return { ok: true, speed: ship.voyage.speed };
}

// Carburant nécessaire pour finir le voyage à une vitesse donnée.
export function fuelToFinish(state, ctx, ship, speed) {
  const route = ctx.shipRoute(ship);
  if (!route) return 0;
  const T = SHIP_TYPES[ship.type];
  const left = Math.max(0, route.nm - ship.voyage.progress);
  return eco.burnPerDay(T, speed, eco.ageYears(state, ship)) * equipMod(ship, 'burn') * left / (24 * speed);
}

export function cancelPlan(state, shipId) {
  const ship = shipById(state, shipId);
  if (ship) ship.plan = null;
  return { ok: true };
}

// ---------- Contrats ----------
export function checkContract(state, ctx, ship, contract) {
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  if (!contract || contract.takenBy !== null) return 'Ce contrat n\'est plus disponible.';
  if (contract.from !== ship.port) return 'Le contrat part d\'un autre port.';
  if (ship.cargo) return 'Les cales ne sont pas vides.';
  if (ship.dark) return 'Les cales sont occupées par la cargaison noire.';
  const hold = eco.holdFor(ship.type, contract.good);
  if (!hold) return `Ce navire ne peut pas transporter : ${GOODS[contract.good].name.toLowerCase()}.`;
  if (!eco.portHandles(contract.from, hold) || !eco.portHandles(contract.to, hold)) return 'Un des ports ne peut pas manutentionner ce chargement.';
  if (contract.qty > T.dwt) return `Capacité insuffisante (${T.dwt.toLocaleString('fr-FR')} t).`;
  if (bannedUntil(companyOf(state, ship), PORTS[contract.to].flag) > state.t) return `${FLAGS[PORTS[contract.to].flag].name} interdit ses ports à votre compagnie (pollution).`;
  if (contract.minSpeed && T.maxSpeed < contract.minSpeed) return `Le chargeur exige un navire de ${String(contract.minSpeed).replace('.', ',')} nœuds au moins.`;
  if (!eco.fitsPort(contract.to, ship.type)) return `Tirant d'eau trop important pour ${portName(contract.to)}.`;
  if (contract.ice && !iceClass(ship)) return `Fin de saison à ${portName(contract.to)} : le chargeur exige un navire de classe glace.`;
  const refusal = clientRefusal(state, company, contract);
  if (refusal?.kind === 'rancune') return `${refusal.name} ne travaille plus avec vous depuis que vous l'avez dénoncé (jusqu'au ${formatDate(refusal.until)}).`;
  if (refusal?.kind === 'reserve') return `${refusal.name} réserve ce contrat à son partenaire le plus fidèle jusqu'au ${formatDate(refusal.until)}.`;
  if (refusal?.kind === 'exigence') return `${refusal.name} ne travaille qu'avec des armateurs réputés (${refusal.rep} exigée) ou avec ses partenaires fidèles.`;
  if (company.reputation < contract.minRep) return `Réputation insuffisante (${contract.minRep} exigée).`;
  if (contract.deadline <= state.t) return 'Le délai est déjà dépassé.';
  return null;
}

export function acceptContract(state, ctx, shipId, contractId, opts = {}) {
  const ship = shipById(state, shipId);
  const err = notReady(ship);
  if (err) return fail(err);
  const c = contractById(state, contractId);
  const why = checkContract(state, ctx, ship, c);
  if (why) return fail(why);
  const T = SHIP_TYPES[ship.type];
  const p = planVoyage(state, ctx, ship, c.to, opts.speed || T.speed);
  if (p.error) return fail(p.error);
  const hold = eco.holdFor(ship.type, c.good);
  c.takenBy = ship.id;
  ship.cargo = { good: c.good, qty: c.qty, hold, contractId: c.id };
  taintShip(state, ship, c.from, c.pay);
  startBusy(state, ship, 'chargement', eco.handlingHours(ship.port, hold, c.qty));
  ship.plan = { to: c.to, speed: p.speed, autoRefuel: opts.autoRefuel ?? true };
  shipLog(state, ship, `Contrat : ${c.qty.toLocaleString('fr-FR')} t de ${GOODS[c.good].name.toLowerCase()} pour ${portName(c.to)} avant le ${formatDate(c.deadline)}`);
  return { ok: true };
}

export function abandonContract(state, shipId) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'port' || !ship.cargo?.contractId) return fail('Aucun contrat à annuler au port.');
  const c = contractById(state, ship.cargo.contractId);
  const company = companyOf(state, ship);
  const penalty = c ? Math.round(c.pay * 0.25) : 0;
  money(state, company, -penalty, 'divers');
  changeReputation(company, -8);
  state.contracts = state.contracts.filter((x) => x !== c);
  ship.cargo = null;
  ship.plan = null;
  startBusy(state, ship, 'déchargement', 12);
  shipLog(state, ship, `Contrat abandonné (pénalité ${fmtM(penalty)})`);
  return { ok: true, penalty };
}

// ---------- Négoce ----------
export function quoteBuy(state, ship, good, qty) {
  const q = eco.quoteTrade(state, ship.port, good, qty, 'buy');
  const hold = eco.holdFor(ship.type, good);
  const handling = qty * (eco.HANDLING_COST[hold] || 0);
  return { ...q, handling, total: q.total + handling, hold };
}

export function buyCargo(state, ctx, shipId, good, qty) {
  const ship = shipById(state, shipId);
  const err = notReady(ship);
  if (err) return fail(err);
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  if (!eco.exportsGood(ship.port, good)) return fail(`${portName(ship.port)} n'exporte pas ce produit.`);
  if (ship.dark) return fail('Les cales sont occupées par la cargaison noire.');
  const hold = eco.holdFor(ship.type, good);
  if (!hold) return fail('Ce navire ne peut pas charger ce produit.');
  if (!eco.portHandles(ship.port, hold)) return fail('Le port ne peut pas charger ce type de cargaison.');
  if (ship.cargo && (ship.cargo.contractId || ship.cargo.good !== good)) return fail('Les cales contiennent déjà une autre cargaison.');
  const onboard = ship.cargo ? ship.cargo.qty : 0;
  qty = Math.floor(Math.min(qty, T.dwt - onboard, eco.availableStock(state, ship.port, good)) / 100) * 100;
  if (qty <= 0) return fail('Plus de place à bord ou plus de stock disponible.');
  const q = quoteBuy(state, ship, good, qty);
  if (q.total > company.cash) return fail(`Il faut ${fmtM(q.total)} pour cet achat.`);
  eco.applyTrade(state, ship.port, good, qty, 'buy');
  money(state, company, -q.total, 'achats');
  ship.spent += q.total;
  ship.cargo = { good, qty: onboard + qty, hold, cost: (ship.cargo?.cost || 0) + q.total, boughtAt: ship.port };
  taintShip(state, ship, ship.port, q.total);
  startBusy(state, ship, 'chargement', eco.handlingHours(ship.port, hold, qty));
  shipLog(state, ship, `Achat de ${qty.toLocaleString('fr-FR')} t de ${GOODS[good].name.toLowerCase()} à ${portName(ship.port)} (${fmtM(q.total)})`);
  return { ok: true, qty, total: q.total };
}

export function quoteSale(state, ship) {
  if (!ship.cargo || ship.cargo.contractId || !ship.port) return null;
  // Une cargaison avariée se vend moins : la part perdue ou abîmée ne vaut plus rien.
  const sound = ship.cargo.qty * (1 - (ship.cargo.damage || 0));
  let q = eco.quoteTrade(state, ship.port, ship.cargo.good, sound, 'sell');
  // Prix garanti à ce port (prime payée à l'achat) : jamais moins que le cours promis.
  const fl = ship.cargo.floor;
  if (fl && fl.port === ship.port && state.t <= fl.until && fl.unit * sound > q.total) q = { ...q, avg: fl.unit, total: fl.unit * sound, guaranteed: true };
  const handling = ship.cargo.qty * (eco.HANDLING_COST[ship.cargo.hold] || 0);
  const net = q.total - handling;
  return { ...q, handling, net, profit: net - ship.cargo.cost, possible: eco.portHandles(ship.port, ship.cargo.hold) };
}

// Prix garanti : contre une prime (1 à 5 % selon la volatilité de la marchandise et la
// durée du voyage), la revente à ce port rapportera au moins le cours attendu aujourd'hui.
export function guaranteeRate(good, days) {
  return Math.max(0.01, Math.min(0.05, 0.6 * GOODS[good].vol * Math.sqrt(Math.max(1, days))));
}
export function guaranteePrice(state, shipId, port, unit, days) {
  const ship = shipById(state, shipId);
  if (!ship?.cargo || ship.cargo.contractId) return fail('Aucune cargaison à garantir.');
  const company = companyOf(state, ship);
  const premium = Math.round(guaranteeRate(ship.cargo.good, days) * unit * ship.cargo.qty / 1000) * 1000;
  money(state, company, -premium, 'negoce');
  ship.cargo.cost += premium;
  ship.cargo.floor = { port, unit, until: Math.round(state.t + (days * 1.5 + 5) * HOURS_PER_DAY) };
  shipLog(state, ship, `Prix garanti à ${portName(port)} : ${Math.round(unit)} $/t (prime ${fmtM(premium)})`);
  return { ok: true, premium };
}

export function sellCargo(state, ctx, shipId) {
  const ship = shipById(state, shipId);
  const err = notReady(ship);
  if (err) return fail(err);
  if (!ship.cargo || ship.cargo.contractId) return fail('Aucune marchandise à vendre.');
  const q = quoteSale(state, ship);
  if (!q.possible) return fail(`${portName(ship.port)} ne peut pas décharger cette cargaison.`);
  const company = companyOf(state, ship);
  eco.applyTrade(state, ship.port, ship.cargo.good, ship.cargo.qty * (1 - (ship.cargo.damage || 0)), 'sell');
  money(state, company, q.net, 'negoce');
  ship.earned += q.net;
  taintShip(state, ship, ship.port, q.net);
  shipLog(state, ship, `Vente de ${ship.cargo.qty.toLocaleString('fr-FR')} t de ${GOODS[ship.cargo.good].name.toLowerCase()} à ${portName(ship.port)} : ${q.profit >= 0 ? 'bénéfice' : 'perte'} de ${fmtM(Math.abs(q.profit))}`);
  const hours = eco.handlingHours(ship.port, ship.cargo.hold, ship.cargo.qty);
  ship.cargo = null;
  startBusy(state, ship, 'déchargement', hours);
  return { ok: true, ...q };
}

// ---------- Désarmement ----------
export function layUp(state, shipId) {
  const ship = shipById(state, shipId);
  const err = notReady(ship);
  if (err) return fail(err);
  if (ship.cargo) return fail('Déchargez d\'abord la cargaison.');
  ship.status = 'laidup';
  shipLog(state, ship, `Désarmé à ${portName(ship.port)}`);
  return { ok: true };
}

export function reactivate(state, shipId) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'laidup') return fail('Ce navire n\'est pas désarmé.');
  const T = SHIP_TYPES[ship.type];
  const cost = 20000 + T.opex * 3;
  const company = companyOf(state, ship);
  if (cost > company.cash) return fail(`Il faut ${fmtM(cost)} pour réarmer.`);
  money(state, company, -cost, 'divers');
  ship.status = 'port';
  startBusy(state, ship, 'réarmement', 48);
  shipLog(state, ship, 'Réarmement : l\'équipage revient à bord');
  return { ok: true, cost };
}

// ---------- Courtier ----------
export function buyUsedShip(state, ctx, rng, companyId, listingId) {
  const company = state.companies[companyId];
  const l = state.used.find((x) => x.id === listingId);
  if (!l) return fail('Ce navire a déjà été vendu.');
  if (l.price > company.cash) return fail(`Il faut ${fmtM(l.price)} pour cet achat.`);
  company.cash -= l.price;
  const ship = createShip(state, rng, companyId, l.type, { port: l.port, age: l.age, condition: l.condition, name: l.name });
  state.used = state.used.filter((x) => x !== l);
  shipLog(state, ship, `Acheté d'occasion à ${portName(l.port)} pour ${fmtM(l.price)}`);
  news(state, `${company.name} achète le ${ship.name} (${SHIP_TYPES[l.type].name.toLowerCase()}) à ${portName(l.port)}.`, { company: companyId, kind: 'fleet' });
  notifyRivals(state, company, ship, `${company.name} achète le ${ship.name} (${SHIP_TYPES[l.type].name.toLowerCase()}) à ${portName(l.port)}.`, false);
  return { ok: true, ship };
}

// Un concurrent agrandit sa flotte : les joueurs humains le voient (scène « à la longue-vue »).
// Navire neuf : toujours ; occasion : au plus une fois par mois, pour ne pas interrompre la
// partie à chaque achat (le fil des nouvelles les montre tous). Partie à plusieurs : les
// joueurs partagent l'écran, l'achat d'un humain a déjà sa propre scène.
export function notifyRivals(state, company, ship, text, newbuild) {
  if (company.human || !state.companies.some((c) => c.human && !c.bankrupt)) return;
  if (!newbuild && state.t - (state.rivalSeen ?? 0) < 30 * HOURS_PER_DAY) return; // pas avant le 2e mois (achats de départ)
  state.rivalSeen = state.t;
  (state.queuedNotes ??= []).push({ kind: 'rivalship', rival: company.id, color: company.color, shipType: ship.type, newbuild, text });
}

export function newBuildPrice(state, company, typeId, yard) {
  return eco.newShipPrice(state, typeId, company.flag) * YARDS[yard].factor;
}

export function orderNewShip(state, companyId, typeId, yard, name) {
  const company = state.companies[companyId];
  if (!YARDS[yard]) return fail('Chantier inconnu.');
  const price = newBuildPrice(state, company, typeId, yard);
  if (price > company.cash) return fail(`Il faut ${fmtM(price)} pour cette commande.`);
  company.cash -= price;
  const due = state.t + YARDS[yard].days * HOURS_PER_DAY;
  state.orders.push({ id: state.nextId++, owner: companyId, type: typeId, yard, due, paid: price, name: name || null });
  news(state, `${company.name} commande un ${SHIP_TYPES[typeId].name.toLowerCase()} neuf à ${portName(yard)} (livraison le ${formatDate(due)}).`, { company: companyId, kind: 'fleet' });
  return { ok: true, due, price };
}

export function sellShip(state, ctx, shipId) {
  const ship = shipById(state, shipId);
  if (!ship || (ship.status !== 'port' && ship.status !== 'laidup')) return fail('Le navire doit être au port pour être vendu.');
  // Un navire retenu par les inspecteurs peut être vendu en l'état : la part des
  // réparations imposées qui n'a pas encore été faite est remboursée.
  const detained = ship.busyWhat === 'détention';
  if (ship.busyWhat && !detained) return fail('Le navire est occupé.');
  if (ship.cargo) return fail('Déchargez d\'abord la cargaison.');
  const company = companyOf(state, ship);
  let refund = 0;
  if (detained && ship.detentionCost) {
    const left = Math.max(0, ship.busyUntil - state.t) / Math.max(1, ship.busyUntil - (ship.detentionStart ?? state.t));
    refund = Math.round(ship.detentionCost * left);
    money(state, company, refund, 'reparations');
  }
  const price = eco.shipValue(state, ship) * 0.95;
  company.cash += price;
  removeShip(state, ctx, ship);
  news(state, `${company.name} vend le ${ship.name} pour ${fmtM(price)}.`, { company: company.id, kind: 'fleet' });
  return { ok: true, price };
}

// ---------- Équipage ----------
// Monter en gamme coûte une prime d'embauche (un mois de la différence de salaire).
export function crewChangeFee(state, ship, level) {
  const T = SHIP_TYPES[ship.type], company = companyOf(state, ship), cur = ship.crew || 0;
  return level > cur ? Math.round((eco.crewDayCost(T, company.flag, level) - eco.crewDayCost(T, company.flag, cur)) * 30) : 0;
}
export function setCrew(state, shipId, level) {
  const ship = shipById(state, shipId);
  if (!ship || (ship.status !== 'port' && ship.status !== 'laidup')) return fail('On ne change d\'équipage qu\'au port.');
  level = Math.max(0, Math.min(CREW_LEVELS.length - 1, level | 0));
  if (level === (ship.crew || 0)) return fail('C\'est déjà l\'équipage actuel.');
  const company = companyOf(state, ship);
  const fee = crewChangeFee(state, ship, level);
  if (fee > company.cash) return fail(`Il faut ${fmtM(fee)} de primes d'embauche.`);
  if (fee) money(state, company, -fee, 'equipage');
  ship.crew = level;
  shipLog(state, ship, `Nouvel équipage : ${CREW_LEVELS[level].name.toLowerCase()}`);
  return { ok: true, fee };
}

export function renameShip(state, shipId, name) {
  const ship = shipById(state, shipId);
  const clean = String(name || '').trim().slice(0, 24);
  if (!ship || !clean) return fail('Nom invalide.');
  ship.name = clean;
  return { ok: true };
}

// ---------- Banque ----------
export function borrow(state, companyId, amount) {
  const company = state.companies[companyId];
  const room = creditLimit(state, company) - company.debt;
  amount = Math.floor(Math.min(amount, room) / 10000) * 10000;
  if (amount <= 0) return fail('La banque refuse : plafond de crédit atteint.');
  company.debt += amount;
  company.cash += amount;
  return { ok: true, amount };
}

export function repay(state, companyId, amount) {
  const company = state.companies[companyId];
  amount = Math.min(amount, company.debt, Math.max(0, company.cash));
  if (amount <= 0) return fail('Rien à rembourser (ou pas de trésorerie).');
  company.debt -= amount;
  company.cash -= amount;
  return { ok: true, amount };
}

// ---------- Siège social ----------
export function relocateCost(state, companyId) {
  return 250000 + 40000 * state.ships.filter((s) => s.owner === companyId).length;
}
export function relocate(state, companyId, portId) {
  const company = state.companies[companyId];
  if (portId === company.homePort) return fail('C\'est déjà votre port d\'attache.');
  const cost = relocateCost(state, companyId);
  if (cost > company.cash) return fail(`Il faut ${fmtM(cost)} pour changer de pavillon.`);
  money(state, company, -cost, 'divers');
  company.homePort = portId;
  company.flag = PORTS[portId].flag;
  const base = FLAGS[company.flag].rating * 0.5 + 25;
  company.reputation = Math.round(company.reputation * 0.7 + base * 0.3);
  news(state, `${company.name} transfère son siège à ${portName(portId)} et passe sous pavillon ${FLAGS[company.flag].name}.`, { company: companyId, kind: 'fleet' });
  return { ok: true, cost };
}

export { CANAL_NAMES };
