// Compagnies gérées par l'ordinateur. Elles jouent avec les mêmes règles et
// les mêmes actions que les joueurs humains.
import { imageFactor } from './clients.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS, OIL_GOODS } from '../data/goods.js';
import * as eco from './economy.js';
import * as act from './actions.js';
import { shipsOf, fleetValue, creditLimit, contractById, bookTotal, netWorth } from './core.js';
import { HOURS_PER_DAY } from './util.js';
import { INCIDENT_BASE, wearRisk, inspectionThreshold } from './incidents.js';
import { ENFORCING } from '../data/sanctions.js';
import { hasEquip, installEquipment } from './equipment.js';
import { acceptOffer, detectionChance, sanctionFine, taintActive } from './shady.js';
import { patrolRisk } from './patrols.js';
import { hostilePort, pirateBoost, payCut } from './plots.js';
import { piracyAlong } from './piracy.js';
import { isSeasonal } from './ice.js';
import { grudgeAt } from './dark.js';
import { lenderTerms, quoteSellAt, loanRoom } from './trade.js';
import { canProspect, startProspect, PROSPECT } from './prospect.js';
import { darkPort, darkCapable } from './dark.js';
import { closedPort } from './shadow.js';

const D = HOURS_PER_DAY;
// Tempérament : bâtisseur (records), vertueux (hauts faits, réputation), conquérant (rachats, coups),
// ombre (affaires noires, liste noire).
export const AI_LEANINGS = ['batisseur', 'vertueux', 'conquerant', 'ombre'];
export const AI_BUILDER_FLEET = 1.35; // un bâtisseur vise une flotte plus grande
export const AI_CAPITAL_COST = 0.4; // par an : rendement attendu d'un navire, coût de l'argent bloqué dans une cargaison

function noisy(rng, value, skill) {
  return value * (1 + rng.normal() * 0.12 / skill);
}

// Coût d'un trajet (sans la cargaison) pour comparer les options.
function tripCost(state, ctx, ship, to, extraHours = 0) {
  const p = act.planVoyage(state, ctx, ship, to, SHIP_TYPES[ship.type].speed);
  if (p.error) return null;
  if (p.iceRisk > 0) return null; // l'IA ne joue pas avec les glaces
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const days = p.seaDays + extraHours / D;
  const age = eco.ageYears(state, ship);
  const upkeep = eco.upkeepPerSeaDay(state, T, age) * p.seaDays;
  return { cost: p.fuelCost + p.fees + (p.escortOut || 0) + upkeep + eco.fixedDayCost(T, company.flag, 'active', age, ship.crew) * days, days, plan: p };
}

export function aiShipIdle(state, ctx, rng, ship) {
  if (ship.aiWait && ship.aiWait > state.t) return;
  const company = state.companies[ship.owner];
  const skill = company.ai?.skill || 1;
  const T = SHIP_TYPES[ship.type];
  const here = ship.port;
  // Cargaison noire à bord : droit au port de livraison.
  if (ship.dark) { if (!act.depart(state, ctx, ship.id, ship.dark.to, T.speed, true).ok) ship.aiWait = state.t + 24; return; }

  // 0 bis. Près du seuil des inspecteurs et chantier sur place : réparer avant de repartir, même
  // cargaison à bord. Sinon un vieux navire remis à 65 % après une détention se fait retenir à
  // chaque escale dans un port exigeant (amende, réparations d'office, prêt sur cargaison échu).
  if (ship.condition < inspectionThreshold(eco.ageYears(state, ship)) + 6 && PORTS[here].repair >= 1) {
    const rc = eco.repairCost(state, ship, here, 92);
    if (rc && rc.points > 5) {
      if (rc.cost > company.cash - 100000) act.borrow(state, company.id, rc.cost - company.cash + 200000);
      if (act.repair(state, ship.id, 92).ok) return;
    }
  }

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
      // Même prudence qu'à l'achat : pas de détour par un pays sous embargo si l'on s'en abstient,
      // et sinon l'amende possible est comptée (sans quoi l'IA y vend dès que le cours y est meilleur).
      const emb = eco.isEmbargoedPort(p);
      if (emb && avoidsEmbargo(state, company)) continue;
      if (grudgeAt(state, company, p)) continue; // un gang nous y attend
      const trip = tripCost(state, ctx, ship, p);
      if (!trip) continue;
      const gross = quoteSellAt(state, p, ship.cargo.good, ship.cargo.qty, trip.days, ship.id).total;
      const net = gross * 0.97 - trip.cost - (emb ? embargoCost(state, company, ship, gross) : 0);
      if (net > best.value * 1.05) best = { port: p, value: net };
    }
    if (best.port !== here && act.depart(state, ctx, ship.id, best.port, T.speed, true).ok) return;
    if (!act.sellCargo(state, ctx, ship.id).ok) ship.aiWait = state.t + 24;
    return;
  }

  // 2. Entretien : un navire usé coule, se fait retenir par les inspecteurs et
  //    n'est plus assuré. On répare, quitte à emprunter.
  if (ship.condition < 66 && PORTS[here].repair >= 1) {
    const rc = eco.repairCost(state, ship, here, 92);
    // Une vieille coque dont la remise en état coûte plus qu'elle ne vaudrait : à la casse (au courtier).
    if (rc && rc.cost > eco.shipValue(state, { ...ship, condition: 92 }) * 2 && eco.ageYears(state, ship) > T.life - 3 && shipsOf(state, company.id).length > 1) {
      if (act.sellShip(state, ctx, ship.id).ok) return;
    }
    if (rc && rc.points > 5) {
      if (rc.cost > company.cash - 100000) act.borrow(state, company.id, rc.cost - company.cash + 200000);
      if (act.repair(state, ship.id, 92).ok) return;
    }
  }
  // Très usé et pas de chantier ici : aller au chantier le plus proche avant tout.
  if (ship.condition < 52 && PORTS[here].repair < 2) {
    let best = null;
    for (const p of PORT_IDS) {
      if (p === here || PORTS[p].repair < 2 || !eco.fitsPort(p, ship.type)) continue;
      const d = ctx.distanceInfo(here, p)?.nm;
      if (d && (!best || d < best.d)) best = { p, d };
    }
    if (best && act.depart(state, ctx, ship.id, best.p, T.speed, true).ok) return;
  }

  // 3. Évaluer les contrats et les occasions de négoce.
  const options = [];
  for (const c of state.contracts) {
    if (c.from !== here || c.takenBy !== null) continue;
    if (c.embargo && avoidsEmbargo(state, company)) continue; // pavillon qui applique les sanctions, ou déjà sanctionnée : on s'abstient
    if (act.checkContract(state, ctx, ship, c)) continue;
    if (hostilePort(state, company.id, c.to)) continue; // autorités achetées contre nous : on évite
    if (grudgeAt(state, company, c.to)) continue; // un gang nous y attend
    const loadH = eco.handlingHours(here, c.hold, c.qty) + eco.handlingHours(c.to, c.hold, c.qty);
    const trip = tripCost(state, ctx, ship, c.to, loadH);
    if (!trip || trip.plan.error) continue;
    if (trip.plan.route && piracyAlong(trip.plan.route).some((x) => pirateBoost(state, ship, x.zone.id))) continue; // pirates payés contre nous
    if (state.t + (trip.days + 1) * D > c.deadline) continue;
    // (Le risque d'impayé n'est pas déduit : la prime de risque des chargeurs peu fiables le
    // compense, et le déduire faisait pencher toutes les stratégies vers les citernes.)
    // Aide d'urgence : à perte ; seule l'IA vertueuse (qui vise la victoire de la réputation) y gagne de la vertu utile.
    const virtuous = company.ai?.leaning === 'vertueux';
    const repValue = c.charity && virtuous ? c.charity.rep * (virtuous ? 300000 : 150000) : 0;
    const pay = c.pay * payCut(state, company.id, c.from) * imageFactor(company, c.client); // guerre des prix contre elle ; chargeur soucieux de son image
    // L'IA vertueuse (victoire de la réputation) fuit le pétrole, qui lui coûte de la vertu : elle n'en
    // transporte que faute de mieux.
    const oilShame = virtuous && OIL_GOODS.includes(c.good) ? pay * VIRTUOUS_OIL_PENALTY : 0;
    const profit = pay - noisy(rng, trip.cost, skill * 2) - (c.embargo ? embargoCost(state, company, ship, c.pay) : 0) + repValue - oilShame;
    options.push({ kind: 'contract', c, profit, perDay: profit / Math.max(1, trip.days) });
  }
  // On garde de quoi faire le plein et payer quelques semaines de frais fixes.
  const reserve = T.tank * eco.fuelPrice(state, here) + eco.fixedDayCost(T, company.flag, 'active') * 30 + 300000;
  const tradeBudget = (company.cash - reserve) * 0.8;
  if (tradeBudget > 300000 && !company.ai?.noTrade && !(eco.isEmbargoedPort(here) && avoidsEmbargo(state, company))) {
    for (const g of Object.keys(PORTS[here].exp)) {
      const hold = eco.holdFor(ship.type, g);
      if (!hold || !eco.portHandles(here, hold)) continue;
      const stock = eco.availableStock(state, here, g);
      const unit = eco.buyPrice(state, here, g);
      // Financement par les négociants du port : une cale plus pleine, contre des intérêts.
      const terms = lenderTerms(company, here);
      const plans = [[tradeBudget, null]];
      if (!terms.why) {
        // Dans la limite de l'encours autorisé : apport + ce qu'il reste à emprunter.
        const room = loanRoom(state, company).room;
        const cap = Math.min(tradeBudget / (1 - terms.ltv), tradeBudget + room);
        if (cap > tradeBudget * 1.2) plans.push([cap, { ...terms, ltv: Math.min(terms.ltv, room / cap) }]);
      }
      for (const [budget, fin] of plans) {
      const qty = Math.floor(Math.min(T.dwt, stock, budget / (unit * 1.05)) / 100) * 100;
      if (qty < T.dwt * 0.4) continue;
      const buy = act.quoteBuy(state, ship, g, qty);
      const loan = fin ? buy.total * fin.ltv : 0;
      for (const p of PORT_IDS) {
        if (eco.isEmbargoedPort(p) && avoidsEmbargo(state, company)) continue;
        if (grudgeAt(state, company, p)) continue; // un gang nous y attend
        if (p === here || !(PORTS[p].imp[g] > 0) || !eco.portHandles(p, hold) || !eco.fitsPort(p, ship.type)) continue;
        const loadH = eco.handlingHours(here, hold, qty) + eco.handlingHours(p, hold, qty);
        const trip = tripCost(state, ctx, ship, p, loadH);
        if (!trip || trip.plan.error) continue;
        // Cours attendu à l'arrivée (les prix momentanément hauts retombent pendant le voyage),
        // appel d'offres compris (sa part encore libre, si l'on arrive avant la date limite).
        const sell = quoteSellAt(state, p, g, qty, trip.days, ship.id).total - qty * eco.HANDLING_COST[hold];
        const interest = fin ? (loan * fin.rate * Math.max(1, trip.days)) / 365 : 0;
        // Coût d'opportunité de l'argent immobilisé dans la cargaison (il aurait pu acheter des
        // navires) : sans lui, l'IA négocie trop, sa flotte grandit moins et elle devient fragile.
        const locked = ((buy.total - loan) * AI_CAPITAL_COST * Math.max(1, trip.days)) / 365;
        // Prudence : on retire une marge de risque proportionnelle à la durée et à la volatilité.
        const risk = buy.total * GOODS[g].vol * Math.sqrt(trip.days) * 1.2;
        // Le bruit porte sur le cours de revente (quelques %), pas sur toute la valeur :
        // sinon l'IA choisit systématiquement les erreurs d'estimation les plus optimistes.
        const tainted = (eco.isEmbargoedPort(here) ? buy.total : 0) + (eco.isEmbargoedPort(p) ? sell : 0);
        const oilShame = company.ai?.leaning === 'vertueux' && OIL_GOODS.includes(g) ? sell * VIRTUOUS_OIL_PENALTY : 0; // l'IA vertueuse fuit le pétrole
        const profit = sell * (1 + rng.normal() * 0.012 / skill) - buy.total - trip.cost - risk - interest - locked - (tainted ? embargoCost(state, company, ship, tainted) : 0) - oilShame;
        options.push({ kind: 'trade', good: g, qty, to: p, finance: fin ? { source: 'origin' } : null, profit, perDay: profit / Math.max(1, trip.days) });
      }
      }
    }
  }
  options.sort((a, b) => b.perDay - a.perDay);
  const best = options[0];
  if (best && best.profit > 0) {
    ship.aiIdleSince = null;
    if (best.kind === 'contract') {
      // S'assurer de pouvoir payer le plein avant de s'engager.
      const p = act.planVoyage(state, ctx, ship, best.c.to, T.speed);
      const fuelCost = Math.max(0, Math.min(T.tank, p.needFuel * 1.12) - ship.fuel) * eco.fuelPrice(state, here);
      if (fuelCost > company.cash - 100000 && !act.borrow(state, company.id, fuelCost - company.cash + 200000).ok) {
        ship.aiWait = state.t + 24;
        return;
      }
      if (act.acceptContract(state, ctx, ship.id, best.c.id, { speed: T.speed, autoRefuel: true }).ok) takeParcel(state, ctx, company, ship, best.c.to);
    } else {
      const r = act.buyCargo(state, ctx, ship.id, best.good, best.qty, best.finance);
      if (r.ok) { takeParcel(state, ctx, company, ship, best.to); act.depart(state, ctx, ship.id, best.to, T.speed, true); }
    }
    return;
  }

  // 3 ter. Rien d'intéressant ici : démarcher les chargeurs (une fois par escale) avant de repartir à vide.
  if (!canProspect(ship) && rng.chance(PROSPECT.ai) && startProspect(state, rng, ship, ctx).ok) return;

  // 3 bis. Compagnie audacieuse sans rien de mieux : livrer un colis discret, ce qui la repositionne.
  if (company.ai?.daring && !ship.contraband && !ship.cargo) {
    const offers = (state.offers || []).filter((o) => o.from === here && o.pay >= 250000);
    for (const o of offers.sort((a, b) => b.pay - a.pay)) {
      const before = (state.offers || []).length;
      takeParcel(state, ctx, company, ship, o.to);
      if ((state.offers || []).length < before && act.depart(state, ctx, ship.id, o.to, T.speed, true).ok) return;
      if (ship.contraband) break;
    }
  }

  // 3 quater. Compagnie de l'ombre : aller chercher les affaires noires dans les ports louches sous
  // embargo (la confiance des gangs, puis une affaire dans chaque pays).
  if (company.ai?.leaning === 'ombre' && darkCapable(ship) && !ship.cargo && rng.chance(0.4)) {
    const H = company.hon || {};
    const dark = PORT_IDS.filter((p) => p !== here && darkPort(p) && !grudgeAt(state, company, p) && eco.fitsPort(p, ship.type) && !closedPort(company, p) && ctx.distanceInfo(here, p))
      .map((p) => [p, (H.darkFrom?.[PORTS[p].flag] ? 1 : 3) / (ctx.distanceInfo(here, p).nm + 1500)]);
    if (dark.length && act.depart(state, ctx, ship.id, rng.weighted(dark), T.speed, true).ok) return;
  }

  // 4. Rien d'intéressant ici : se repositionner vers un port qui exporte ce que
  //    le navire sait transporter (même loin s'il n'y a rien à proximité), ou attendre.
  const candidates = [];
  for (const p of PORT_IDS) {
    if (p === here || !eco.fitsPort(p, ship.type)) continue;
    const d = ctx.distanceInfo(here, p)?.nm;
    if (!d) continue;
    if (isSeasonal(p) && act.planVoyage(state, ctx, ship, p, T.speed * 0.9).iceRisk > 0) continue; // pas vers les glaces
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
  // 5. Marché déprimé et rien à faire depuis deux semaines : on désarme le navire
  //    (l'équipage débarque, les frais fixes tombent à un tiers) en attendant la reprise.
  ship.aiIdleSince ??= state.t;
  if (state.t - ship.aiIdleSince > 14 * D && eco.freightLevel(state, ship.type) < 0.9 && !ship.cargo) {
    if (act.layUp(state, ship.id).ok) { ship.aiIdleSince = null; return; }
  }
  ship.aiWait = state.t + rng.int(18, 48);
}

// Pas de commerce avec les pays sous embargo : pavillon qui applique les sanctions,
// ou compagnie mise à l'amende il y a moins d'un an.
// (Une compagnie de l'ombre passe outre : elle vise la flotte fantôme, et compte les amendes.)
// Part du fret que l'IA vertueuse « paie » pour transporter du pétrole (sa vertu y fond).
export const VIRTUOUS_OIL_PENALTY = 0.35;
const avoidsEmbargo = (state, company) => company.ai?.leaning !== 'ombre' && (ENFORCING.has(company.flag) || company.ai?.leaning === 'vertueux' || (company.ai?.noEmbargoUntil || 0) > state.t);
// Amende attendue pour un commerce sous embargo (le navire finira presque toujours
// par faire escale dans un pays qui applique les sanctions dans l'année).
function embargoCost(state, company, ship, value) {
  const prev = taintActive(state, ship)?.value || 0;
  const fine = sanctionFine(company, { value: prev + value });
  // Une amende possible que la compagnie ne pourrait pas encaisser : on s'abstient (sinon une seule
  // amende met une petite compagnie à découvert et la banque saisit ses navires).
  if (fine > Math.max(0, netWorth(state, company.id)) * EMBARGO_FINE_MAX) return Infinity;
  return (fine - (prev ? sanctionFine(company, { value: prev }) : 0)) * 0.85;
}
// Part de la valeur nette qu'une amende possible peut atteindre avant que l'IA renonce au commerce sous embargo.
export const EMBARGO_FINE_MAX = 0.3;

// Compagnie audacieuse : accepter un colis discret qui va dans la même direction,
// si le risque de se faire prendre paraît raisonnable.
function takeParcel(state, ctx, company, ship, to) {
  if (!company.ai?.daring || ship.contraband) return;
  const o = (state.offers || []).find((x) => x.from === ship.port && x.to === to);
  if (!o) return;
  const route = ctx.route(ship.port, to, ctx.closedCanals(state, SHIP_TYPES[ship.type].draft, ship));
  const pr = patrolRisk({ ...ship, contraband: o }, route, SHIP_TYPES[ship.type].speed);
  const caught = 1 - (1 - detectionChance(ship, to, company.homePort)) * (1 - (pr?.caught || 0));
  if (caught < (company.ai?.leaning === 'ombre' ? 0.1 : 0.08)) acceptOffer(state, ship.id, o.id);
}

// Coût par tonne et par mille d'un navire d'occasion, comparé au navire moderne
// de taille la plus proche (> 1 : plus économique, < 1 : gouffre à carburant).
function efficiency(state, company, listing) {
  const fuel = eco.worldFuelPrice(state);
  // Carburant, frais fixes, entretien et risque d'incident (un incident moyen coûte ~150 k$ × taille).
  const perTnm = (T, age, cond = 90) => (eco.burnPerDay(T, T.speed, age) * fuel + eco.fixedDayCost(T, company.flag, 'active', age)
    + eco.upkeepPerSeaDay(state, T, age) * 0.7 + INCIDENT_BASE * wearRisk(cond, age) * 150000 * Math.sqrt(T.gt / 5000)) / (T.dwt * T.speed);
  const T = SHIP_TYPES[listing.type];
  let ref = null, best = Infinity;
  for (const R of Object.values(SHIP_TYPES)) {
    if (R.vintage || !R.holds.some((h) => T.holds.includes(h))) continue;
    const d = Math.abs(Math.log(R.dwt / T.dwt));
    if (d < best) { best = d; ref = R; }
  }
  return ref ? Math.min(1.5, perTnm(ref, 0) / perTnm(T, listing.age, Math.max(listing.condition, 85))) : 1;
}

// Décisions de flotte et de trésorerie, une fois par jour.
export function aiDaily(state, ctx, rng, company) {
  if (company.bankrupt) return;
  const ships = shipsOf(state, company.id);
  const monthlyFixed = ships.reduce((s, sh) => s + eco.fixedDayCost(SHIP_TYPES[sh.type], company.flag, sh.status, 0, sh.crew) * 30, 0);

  // Trésorerie : couvrir un découvert, rembourser quand on est à l'aise.
  if (company.cash < 0) act.borrow(state, company.id, -company.cash + monthlyFixed * 0.5);
  else if (company.debt > 0 && company.cash > 4e6 + monthlyFixed * 2) {
    act.repay(state, company.id, company.cash - (3e6 + monthlyFixed * 2));
  }

  // Équipage : un équipage aguerri se rentabilise sur un navire cher ou vieux.
  for (const sh of ships) {
    if (sh.status !== 'port') continue;
    const T = SHIP_TYPES[sh.type], age = eco.ageYears(state, sh);
    const want = T.price >= 120 ? 2 : T.price >= 55 && age < 20 ? 1 : 0;
    if ((sh.crew || 0) !== want && company.cash > 2e6) act.setCrew(state, sh.id, want);
  }
  // Un minimum de protection contre les pirates quand on passe au chantier.
  for (const sh of ships) {
    if (sh.status === 'port' && !sh.busyWhat && PORTS[sh.port].repair && !hasEquip(sh, 'barbeles') && company.cash > 3e6) installEquipment(state, sh.id, 'barbeles');
    else if (sh.status === 'port' && !sh.busyWhat && PORTS[sh.port].repair && !hasEquip(sh, 'citadelle') && company.cash > 8e6) installEquipment(state, sh.id, 'citadelle');
    else if (company.ai.leaning === 'ombre' && darkCapable(sh) && sh.status === 'port' && !sh.busyWhat && PORTS[sh.port].repair && !hasEquip(sh, 'cachettes') && company.cash > 1e6) installEquipment(state, sh.id, 'cachettes');
  }
  // Réarmer les navires désarmés quand le fret repart. Une petite compagnie n'attend pas d'avoir
  // 1 M$ en caisse : sinon elle s'éteint, navires à quai, pendant que sa dette grossit.
  for (const sh of ships) {
    if (sh.status !== 'laidup') continue;
    sh.laidAt ??= state.t;
    const cost = 20000 + SHIP_TYPES[sh.type].opex * 3;
    if (eco.freightLevel(state, sh.type) >= 0.97 && company.cash > cost + 400000) act.reactivate(state, sh.id);
    // Désarmé depuis plus d'un an et compagnie endettée : capital mort, on le vend.
    else if (company.debt > 0 && state.t - sh.laidAt > 365 * D && ships.length > 1) act.sellShip(state, ctx, sh.id);
  }
  // Au bord de la saisie : vendre soi-même un navire (mieux payé que par la banque).
  if (company.cash < 0 && company.debt >= creditLimit(state, company) * 0.95) {
    const sellable = ships.filter((sh) => (sh.status === 'laidup' || (sh.status === 'port' && !sh.busyWhat)) && !sh.cargo)
      .sort((a, b) => (a.status === 'laidup' ? -1 : 0) - (b.status === 'laidup' ? -1 : 0) || eco.shipValue(state, a) - eco.shipValue(state, b));
    if (sellable.length) act.sellShip(state, ctx, sellable[0].id);
  }

  // Achat d'un navire environ une fois par mois si les finances le permettent.
  if (state.t < (company.ai.nextFleet || 0)) return;
  company.ai.nextFleet = state.t + rng.int(30, 60) * D;
  const value = fleetValue(state, company.id);
  if (company.debt > value * 0.5 && ships.length) return; // sans navire, on rachète de quoi repartir (sinon la compagnie reste à quai pour toujours)
  // Taille de flotte en « points » : un petit cargo compte moins qu'un géant.
  const points = ships.reduce((s, sh) => s + Math.max(0.4, Math.sqrt(SHIP_TYPES[sh.type].dwt / 50000)), 0);
  const cap = eco.TUNING.aiFleet * (0.5 + 0.5 * (company.ai.skill || 1)) * (company.ai.leaning === 'batisseur' ? AI_BUILDER_FLEET : 1);
  if (points >= cap) return;
  // En marché déprimé ou après un mois déficitaire : pas d'emprunt, et une réserve de trois mois.
  const avgFreight = eco.HOLD_TYPES.reduce((x, h) => x + state.market.freight[h], 0) / eco.HOLD_TYPES.length / eco.FREIGHT_NORMAL;
  const prudent = avgFreight < 0.88 || bookTotal(company.lastMonth) < 0;
  const budget = prudent ? company.cash - monthlyFixed * 3
    : company.cash * 0.85 + Math.max(0, Math.min(creditLimit(state, company) - company.debt, company.cash * 0.6));
  // Riche et marché correct : commander un navire neuf au chantier (la flotte ne vieillit pas indéfiniment).
  const pending = state.orders.filter((o) => o.owner === company.id).length;
  if (!pending && avgFreight >= 0.95 && company.cash > 15e6) {
    const yard = 'shanghai';
    const options = Object.entries(SHIP_TYPES).filter(([id, T]) => !T.vintage && (!company.ai.pool || company.ai.pool.includes(id)) && !(company.ai.leaning === 'vertueux' && T.holds.includes('liquide'))
      && act.newBuildPrice(state, company, id, yard) < company.cash * 0.6)
      .map(([id, T]) => [id, Math.sqrt(T.dwt) / Math.sqrt(T.price) * Math.sqrt(PORT_IDS.filter((p) => eco.servesType(p, id)).length / 12)
        * (company.ai.leaning === 'batisseur' && !ships.some((s) => SHIP_TYPES[s.type].holds[0] === T.holds[0]) ? 4 : 1)]);
    if (options.length) {
      const typeId = rng.weighted(options);
      if (act.orderNewShip(state, company.id, typeId, yard).ok) return;
    }
  }
  // Plusieurs petits navires d'un coup si le budget le permet (comme le ferait un joueur).
  let left = budget, pts = points;
  for (let n = 0; n < 3 && left >= 1.5e6 && pts < cap; n++) {
    const bought = buyOne(state, ctx, rng, company, left);
    if (!bought) break;
    left -= bought.price;
    pts += Math.max(0.4, Math.sqrt(SHIP_TYPES[bought.type].dwt / 50000));
  }
}

function buyOne(state, ctx, rng, company, budget) {
  // Une compagnie spécialisée (ai.pool) n'achète que ses types de navires.
  // L'IA vertueuse n'achète pas de pétroliers (le pétrole lui coûte de la vertu).
  const affordable = state.used.filter((l) => l.price <= budget && l.condition > 45 && (!company.ai.pool || company.ai.pool.includes(l.type)) && !(company.ai.leaning === 'vertueux' && SHIP_TYPES[l.type].holds.includes('liquide')));
  if (!affordable.length) return null;
  // Préférence pour les navires qui servent beaucoup de ports (un ULCC n'a que trois terminaux)
  // et qui coûtent peu à exploiter par rapport à un navire moderne de même taille.
  const reach = (typeId) => Math.sqrt(PORT_IDS.filter((p) => eco.servesType(p, typeId)).length / 12);
  // Prix réel : le prix affiché plus la remise en état à prévoir.
  const fix = (l) => {
    const T = SHIP_TYPES[l.type];
    return Math.max(0, 85 - l.condition) * T.price * 1e6 * 0.0011 * (1 + (100 - l.condition) / 120) * eco.repairIndex(state);
  };
  // Un bâtisseur veut un navire de chaque famille (record « La flotte complète »).
  const have = new Set(shipsOf(state, company.id).map((s) => SHIP_TYPES[s.type].holds[0]));
  const novelty = (l) => (company.ai.leaning === 'batisseur' && !have.has(SHIP_TYPES[l.type].holds[0]) ? 3 : 1);
  const pick = rng.weighted(affordable.map((l) => [l, Math.pow(SHIP_TYPES[l.type].dwt, 0.65) / Math.sqrt(l.price + fix(l))
    * reach(l.type) * Math.pow(efficiency(state, company, l), 3) * novelty(l)]));
  if (pick.price > company.cash) act.borrow(state, company.id, pick.price - company.cash + 300000);
  return act.buyUsedShip(state, ctx, rng, company.id, pick.id).ok ? { price: pick.price, type: pick.type } : null;
}

export { contractById };
