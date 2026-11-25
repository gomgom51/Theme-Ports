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
  rachats: 'Rachats de compagnies',
  divers: 'Divers',
};
export const emptyBook = () => Object.fromEntries(Object.keys(BOOK_LABELS).map((k) => [k, 0]));
export const bookTotal = (b) => Object.values(b).reduce((s, v) => s + v, 0);

// `ship` : le navire concerné, s'il y en a un (ses comptes à lui, pour le juger seul).
export function money(state, company, amount, category, ship = null) {
  company.cash += amount;
  company.month[category] = (company.month[category] || 0) + amount;
  company.total[category] = (company.total[category] || 0) + amount;
  if (ship) shipBook(state, ship, amount, category);
}

// ---------- Suivi de chaque navire (Bureau > Résultats > Par navire) ----------
// Recettes et dépenses par poste, emploi du temps, derniers voyages. Le suivi commence à
// l'achat ; pour un navire d'une ancienne sauvegarde, au premier jour suivi (`since`).
export const TRIPS_KEPT = 20;
export function shipTrack(state, ship) {
  return (ship.st ??= { since: state.t, book: {}, h: {}, trips: [], n: 0, nmL: 0, nmB: 0, late: 0, onTime: 0 });
}
// Recette ou dépense d'un navire (sans mouvement de caisse : le fret facturé est encaissé plus tard).
export function shipBook(state, ship, amount, category) {
  if (amount >= 0) ship.earned += amount; else ship.spent -= amount;
  const b = shipTrack(state, ship).book;
  b[category] = (b[category] || 0) + amount;
}
// Le voyage en cours ou qui vient de finir (pour y inscrire la recette).
export function lastTrip(state, ship) {
  const tr = shipTrack(state, ship).trips;
  return tr.length ? tr[tr.length - 1] : null;
}
// Emploi du temps, heure par heure.
const STOPPED = new Set(['réparation', 'installation', 'détention', 'retenue', 'saisie', 'confisqué', 'otages', 'recrutement', 'réarmement']);
export function activityOf(ship) {
  if (ship.status === 'laidup') return 'desarme';
  if (ship.hijacked || ship.seized) return 'immobile';
  if (ship.status === 'sea') return ship.cargo || ship.dark ? 'charge' : 'lest';
  if (STOPPED.has(ship.busyWhat)) return 'immobile';
  if (ship.busyWhat === 'démarchage') return 'attente'; // à quai, sans cargaison, à chercher un chargeur
  if (ship.busyWhat || ship.plan || ship.pendingDelivery) return 'escale';
  return 'attente';
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
  return c.cash + fleetValue(state, companyId) + cargoValue(state, companyId) + ordersValue(state, companyId) + pendingValue(state, companyId) - c.debt - cargoLoans(state, companyId);
}
// Prêt sur cargaison : ce qui est dû à l'instant t (intérêts simples, au jour, un jour au moins).
export const loanOwedAt = (loan, t) => loan.amount * (1 + (loan.rate * Math.max(1, (t - loan.t0) / HOURS_PER_DAY)) / 365);
// Ce que la compagnie doit sur ses cargaisons.
export function cargoLoans(state, companyId) {
  let v = 0;
  for (const s of state.ships) if (s.owner === companyId && s.cargo?.loan) v += loanOwedAt(s.cargo.loan, state.t);
  return v;
}

export function creditLimit(state, company) {
  // Pression d'un concurrent sur sa banque (sim/plots.js) : plafond réduit pour un temps.
  const cut = (company.creditCut && company.creditCut.until > state.t ? company.creditCut.k : 1) * (company.blacklisted ? 0.5 : 1); // liste noire : la banque de l'ombre prête moins
  return Math.max(0, (0.6 * fleetValue(state, company.id) + standing(company).confidence * 25000) * cut); // les banques regardent la confiance
}
export function interestRate(company) {
  return FLAGS[company.flag].rate + ((100 - standing(company).confidence) / 100) * 0.06 + (company.blacklisted ? 0.15 : 0); // banque de l'ombre
}
// Infamie (affaires noires, sim/dark.js) : une tache définitive qui abaisse le plafond de réputation.
// Réputation = la plus basse de deux notes, pour qu'on ne puisse pas n'en pousser qu'une
// (champs confidence et virtue ; company.trust est la confiance des gangs, port par port, voir dark.js) :
//  - la confiance : on peut compter sur vous (livraisons à l'heure, contrats tenus, cargaisons
//    intactes ; retards, détentions, naufrages, rançons la font baisser) ;
//  - la vertu : le bien commun (aide d'urgence, dénonciations, conduite propre ; marées noires,
//    contrebande, affaires noires, coups bas la font baisser).
// L'économie ne regarde que la confiance (contrats, chargeurs, crédit, prêts sur cargaison, démarchage,
// litiges, prix de rachat) ; la vertu, c'est l'image dans la presse : la réputation (le minimum des deux)
// compte pour la victoire « La plus respectée ». Plafond : 95 pour la conduite ordinaire, un point de
// plus par haut fait (cinq au plus) ; l'infamie (affaires noires) abaisse pour toujours les deux.
export const REP_BASE_CAP = 95;
// Conduite propre : la vertu monte doucement chaque mois sans geste gris ou noir ni marée noire
// depuis cleanDays jours (gain mensuel × (1 − vertu / 110)). On oublie : sous forgiveTo, elle
// remonte d'elle-même vers forgiveTo, même sans conduite propre (forgiveMonthly × l'écart relatif).
// Sans cet oubli, les compagnies qui prennent des risques (embargo, colis, coups bas) tombaient
// vers 20 de réputation pour toujours, perdaient contrats et crédit et se faisaient racheter.
export const STANDING = { cleanMonthly: 2.5, cleanDays: 180, forgiveTo: 50, forgiveMonthly: 4 };
// Petites sources de vertu (et de confiance), toutes dégressives près du haut (× (1 − note / 110)) :
//  useful      : contrat livré à l'heure de céréales, café et cacao, fruits et viandes ou bois ;
//  opportunity : affaire en or ou appel d'offres servi, marchandise ni fossile ni polluante ;
//  tenderTrust : appel d'offres servi (confiance, quelle que soit la marchandise) ;
//  slow        : allure économique, à l'arrivée — entier sous slowFull × la vitesse de service, rien
//                au-dessus de slowStart, et proportionnel aux jours de mer jusqu'à slowDays.
export const VIRTUE_SOURCES = { useful: 0.8, opportunity: 2, tenderTrust: 1.5, slow: 1.2, slowStart: 0.95, slowFull: 0.75, slowDays: 10 };
const deedBonus = (company) => Math.min(5, Object.keys(company.hon?.deeds || {}).length);
// L'infamie (affaires noires) abaisse pour toujours les deux plafonds : c'est le prix des affaires noires.
export const trustCap = (company) => Math.min(100 - Math.min(80, company.infamy || 0), REP_BASE_CAP + deedBonus(company));
export const virtueCap = (company) => Math.min(100 - Math.min(80, company.infamy || 0), REP_BASE_CAP + deedBonus(company));
export const repCap = (company) => Math.min(trustCap(company), virtueCap(company));
// Anciennes sauvegardes : les deux notes partent de la réputation d'alors.
export function standing(company) {
  company.confidence ??= company.reputation ?? 50;
  company.virtue ??= company.reputation ?? 50;
  return company;
}
function syncReputation(company) {
  company.confidence = Math.max(0, Math.min(trustCap(company), company.confidence));
  company.virtue = Math.max(0, Math.min(virtueCap(company), company.virtue));
  company.reputation = Math.min(company.confidence, company.virtue);
}
export function changeTrust(company, delta) { standing(company); company.confidence += delta; syncReputation(company); }
// Gains dégressifs : de moins en moins près du haut.
export const earnTrust = (company, base) => changeTrust(company, base * (1 - standing(company).confidence / 110));
export const earnVirtue = (company, base) => changeVirtue(company, base * (1 - standing(company).virtue / 110));
// Allure économique : part du bonus (0..1) pour une vitesse donnée, et vertu attendue à l'arrivée.
export function slowShare(speed, serviceSpeed) {
  const V = VIRTUE_SOURCES, r = speed / serviceSpeed;
  return Math.max(0, Math.min(1, (V.slowStart - r) / (V.slowStart - V.slowFull)));
}
export const slowVirtue = (company, speed, serviceSpeed, seaDays) => VIRTUE_SOURCES.slow * slowShare(speed, serviceSpeed) * Math.min(1, seaDays / VIRTUE_SOURCES.slowDays) * (1 - standing(company).virtue / 110);
export function changeVirtue(company, delta) { standing(company); company.virtue += delta; syncReputation(company); }
// Les deux à la fois : hauts faits (le plafond monte), campagne de presse, plafond à réappliquer (0).
export function changeReputation(company, delta) { standing(company); company.confidence += delta; company.virtue += delta; syncReputation(company); }
// Laquelle des deux retient la réputation (pour l'expliquer au joueur).
export const repLimit = (company) => (standing(company).virtue < company.confidence ? 'virtue' : company.confidence < company.virtue ? 'trust' : null);

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
    earned: 0, spent: 0, log: [], boughtT: state.t, paid: null,
  };
  shipTrack(state, ship);
  state.ships.push(ship);
  return ship;
}

export function shipLog(state, ship, text) {
  ship.log.unshift({ t: state.t, text });
  if (ship.log.length > 30) ship.log.length = 30;
}

// `why` : vendu, naufrage, saisi par la banque, abandonné… (gardé dans les comptes de la compagnie).
export function removeShip(state, ctx, ship, why = 'retiré', price = 0) {
  const company = state.companies[ship.owner];
  if (company && ship.cargo?.loan) { company.debt += loanOwedAt(ship.cargo.loan, state.t); ship.cargo.loan = null; } // cargaison perdue : le prêt reste dû
  if (company) {
    const s = shipTrack(state, ship);
    (company.pastShips ??= []).unshift({
      id: ship.id, name: ship.name, type: ship.type, since: s.since, boughtT: ship.boughtT ?? null, paid: ship.paid ?? null,
      end: state.t, why, price: Math.round(price), result: Math.round(bookTotal(s.book)), n: s.n,
    });
    if (company.pastShips.length > 30) company.pastShips.length = 30;
  }
  state.ships = state.ships.filter((s) => s !== ship);
  ctx?.forget(ship.id);
  if (ship.cargo?.contractId) {
    const c = contractById(state, ship.cargo.contractId);
    if (c) state.contracts = state.contracts.filter((x) => x !== c);
  }
}
