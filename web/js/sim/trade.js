// Négoce : appels d'offres des villes et financement des cargaisons.
//
// Appel d'offres : une ville annonce qu'elle achète une marchandise à prix fixe (au-dessus du
// cours), jusqu'à une quantité et une date. Premier arrivé, premier servi : les livraisons des
// concurrents réduisent la quantité, et leurs engagements (un navire en route avec la
// marchandise) sont annoncés, avec la date d'arrivée : un navire plus proche peut leur souffler
// l'affaire, et l'on sait quand elle est perdue d'avance.
//
// Financement : la cargaison sert de garantie. Les négociants du port de chargement prêtent une
// part de sa valeur (prudents dans les grands ports établis, généreux et chers dans les ports
// louches et sous embargo) ; les acheteurs du port de destination prêtent davantage, contre la
// promesse d'y vendre. Le prêt est remboursé à la vente ; chaque prêt remboursé améliore les
// conditions de ce port. Tout est montré avant l'achat (règle 1).
import { PORTS, PORT_IDS } from '../data/ports.js';
import { GOODS, OIL_GOODS, isCleanGood } from '../data/goods.js';
import { EMBARGOED, SHADY_PORTS } from '../data/sanctions.js';
import { HOURS_PER_DAY, clamp, formatDate } from './util.js';
import * as eco from './economy.js';
import { news, portName, companyOf, shipLog, book, loanOwedAt, cargoLoans, netWorth, earnTrust, earnVirtue, VIRTUE_SOURCES, standing } from './core.js';
import { isSeasonal } from './ice.js';
import { SHIP_TYPES } from '../data/ships.js';
import { money, num } from './format.js';

const D = HOURS_PER_DAY;

// ---------- Appels d'offres ----------
export const TENDER = {
  chance: 0.09,          // par jour : chance qu'une ville lance un appel d'offres (≈ un tous les 11 jours)
  max: 3,                // appels d'offres ouverts en même temps, au plus
  // Prime offerte au-dessus du prix de vente du port, proportionnelle à l'écart de prix naturel de la
  // marchandise (GOODS.spread) : une prime uniforme rendait les biens chers (machines, manufacturés)
  // bien trop lucratifs pour les petits cargos, au détriment du vrac.
  premium: [0.6, 1.2], premiumMin: 1.04, premiumMax: 1.3,
  days: [24, 42],        // durée
  lots: [0.8, 2.0],      // quantité demandée, en lots typiques de la marchandise…
  minQty: 3000, maxQty: 150000, // … entre ces bornes (une course entre quelques navires, pas un puits sans fond)
};

export const tenderAt = (state, port, good) => (state.tenders || []).find((t) => t.port === port && t.good === good && t.left > 0 && t.until > state.t);
// Quantité encore libre pour un navire : ce qui reste, moins les engagements des autres navires
// (y compris ceux de sa propre compagnie : deux navires ne visent pas la même part).
export function tenderRoom(tender, shipId = null) {
  const others = tender.commits.filter((c) => c.shipId !== shipId).reduce((s, c) => s + c.qty, 0);
  return Math.max(0, tender.left - others);
}
// Prix de vente attendu à l'arrivée (t) d'une quantité, appel d'offres compris (part fixe au prix
// promis, le reste au cours attendu).
export function quoteSellAt(state, p, g, qty, days, shipId = null) {
  const tender = tenderAt(state, p, g);
  const arrive = state.t + days * D;
  const part = tender && arrive <= tender.until ? Math.min(qty, tenderRoom(tender, shipId)) : 0;
  const rest = qty - part;
  const market = rest > 0 ? eco.quoteTradeAt(state, p, g, rest, 'sell', days) : { total: 0, avg: 0 };
  return { total: part * (tender?.unit || 0) + market.total, avg: qty ? (part * (tender?.unit || 0) + market.total) / qty : 0, tenderQty: part, tender: part ? tender : null };
}

function newTender(state, ctx, rng) {
  const open = (state.tenders || []).filter((t) => t.left > 0 && t.until > state.t);
  if (open.length >= TENDER.max) return null;
  for (let tries = 0; tries < 12; tries++) {
    const port = rng.pick(PORT_IDS);
    const P = PORTS[port];
    if (EMBARGOED[P.flag] || isSeasonal(port)) continue; // sous embargo : le négoce y paie déjà cher
    const goods = Object.entries(P.imp).filter(([g, w]) => w > 0 && !open.some((t) => t.port === port && t.good === g) && !(OIL_GOODS.includes(g) && eco.oilCrisis(state))
      && PORT_IDS.some((q) => q !== port && eco.exportsGood(q, g) && !EMBARGOED[PORTS[q].flag]));
    if (!goods.length) continue;
    const good = rng.weighted(goods);
    const G = GOODS[good];
    const unit = Math.round(eco.sellPrice(state, port, good) * clamp(1 + G.spread * rng.range(TENDER.premium[0], TENDER.premium[1]), TENDER.premiumMin, TENDER.premiumMax));
    const qty = clamp(Math.round((G.lot * rng.range(TENDER.lots[0], TENDER.lots[1])) / 1000) * 1000, TENDER.minQty, TENDER.maxQty);
    const days = rng.int(TENDER.days[0], TENDER.days[1]);
    return { id: state.nextId++, port, good, unit, qty, left: qty, t0: state.t, until: Math.round(state.t + days * D), commits: [] };
  }
  return null;
}

// ---------- Lots soldés ----------
// L'inverse d'un appel d'offres, à moindre enjeu : un port exportateur écoule un lot à prix fixe sous le
// cours (silo plein, fin de saison). Premier arrivé, premier servi ; les navires en route pour l'acheter
// s'engagent et sont annoncés. Plus facile qu'un appel d'offres (pas de source à trouver, tous les
// importateurs comme débouchés), donc moins payé : la remise suit l'écart naturel de la marchandise (même
// leçon que pour les appels d'offres : un pourcentage uniforme ferait la fortune des petits cargos sur les
// biens chers), et la revente reste au cours du marché (le négoce garde son risque).
export const LOT = {
  chance: 0.08,          // par jour : chance qu'un port mette un lot en vente
  max: 3,                // lots ouverts en même temps, au plus
  discount: [0.3, 0.6], discountMin: 0.88, discountMax: 0.97, // prix = cours × (1 − écart × U), entre −12 % et −3 %
  days: [10, 18],        // durée (un lot soldé n'attend pas)
  lots: [0.4, 1.0],      // quantité, en lots typiques de la marchandise…
  minQty: 1000, maxQty: 80000, // … entre ces bornes
};
export const lotAt = (state, port, good) => (state.lots || []).find((l) => l.port === port && l.good === good && l.left > 0 && l.until > state.t);
export const lotById = (state, id) => (state.lots || []).find((l) => l.id === id) || null;
// Part encore libre pour un navire : ce qui reste, moins les engagements des autres navires.
export function lotRoom(lot, shipId = null) {
  const others = lot.commits.filter((c) => c.shipId !== shipId).reduce((s, c) => s + c.qty, 0);
  return Math.max(0, lot.left - others);
}
function newLot(state, rng) {
  const open = (state.lots || []).filter((l) => l.left > 0 && l.until > state.t);
  if (open.length >= LOT.max) return null;
  for (let tries = 0; tries < 12; tries++) {
    const port = rng.pick(PORT_IDS);
    const P = PORTS[port];
    if (EMBARGOED[P.flag] || isSeasonal(port)) continue;
    const goods = Object.entries(P.exp).filter(([g, w]) => w > 0 && !open.some((l) => l.port === port && l.good === g) && !(OIL_GOODS.includes(g) && eco.oilCrisis(state)));
    if (!goods.length) continue;
    const good = rng.weighted(goods);
    const G = GOODS[good];
    const unit = Math.round(eco.buyPrice(state, port, good) * clamp(1 - G.spread * rng.range(LOT.discount[0], LOT.discount[1]), LOT.discountMin, LOT.discountMax));
    const qty = clamp(Math.round((G.lot * rng.range(LOT.lots[0], LOT.lots[1])) / 1000) * 1000, LOT.minQty, LOT.maxQty);
    const days = rng.int(LOT.days[0], LOT.days[1]);
    return { id: state.nextId++, port, good, unit, qty, left: qty, t0: state.t, until: Math.round(state.t + days * D), commits: [] };
  }
  return null;
}
// Un navire part vers un port pour y acheter le lot soldé (ship.lotBuy, choisi au départ) : il s'engage.
// Ailleurs, ou cales occupées, l'intention tombe.
export function commitLot(state, ship, to, eta) {
  const lot = ship.lotBuy != null ? lotById(state, ship.lotBuy) : null;
  const had = lot?.commits.some((c) => c.shipId === ship.id); // départ programmé, puis départ : une seule annonce
  if (lot) lot.commits = lot.commits.filter((c) => c.shipId !== ship.id);
  if (!lot || lot.port !== to || lot.left <= 0 || eta > lot.until || ship.cargo || ship.dark || !eco.holdFor(ship.type, lot.good)) { ship.lotBuy = null; return; }
  const qty = Math.min(SHIP_TYPES[ship.type].dwt, lotRoom(lot, ship.id));
  if (qty <= 0) return;
  lot.commits.push({ company: ship.owner, shipId: ship.id, qty, eta: Math.round(eta) });
  if (had) return;
  const co = companyOf(state, ship);
  const left = Math.max(0, lot.left - lot.commits.reduce((s, c) => s + c.qty, 0));
  const text = `${co.name} viendra acheter ${num(qty)} t de ${GOODS[lot.good].name.toLowerCase()} soldé à ${portName(lot.port)} vers le ${formatDate(eta, true)} : il en resterait ${num(left)} t.`;
  (state.queuedNotes ??= []).push({ kind: 'lotCommit', lotId: lot.id, by: ship.owner, text });
}
// Ce qu'un navire peut acheter ici : le stock du marché, plus le lot soldé (un surplus hors marché).
export const buyableStock = (state, port, good) => eco.availableStock(state, port, good) + (lotAt(state, port, good)?.left || 0);
// À l'achat : la part prise dans le lot (au prix soldé, premier arrivé premier servi).
export function lotShare(state, port, good, qty) {
  const lot = lotAt(state, port, good);
  const part = lot ? Math.min(qty, lot.left) : 0;
  return part > 0 ? { lot, qty: part } : null;
}
export function takeLot(state, ship, share) {
  const lot = share.lot;
  lot.left -= share.qty;
  lot.commits = lot.commits.filter((c) => c.shipId !== ship.id);
  if (lot.left <= 0) { lot.left = 0; lot.closedAt = state.t; }
  if (ship.lotBuy === lot.id) ship.lotBuy = null;
  const co = companyOf(state, ship);
  const text = lot.left > 0
    ? `${co.name} a acheté ${num(share.qty)} t du lot soldé de ${portName(lot.port)} : il en reste ${num(lot.left)} t.`
    : `${co.name} a acheté ${num(share.qty)} t du lot soldé de ${portName(lot.port)} : le lot est épuisé.`;
  (state.queuedNotes ??= []).push({ kind: 'lotSold', lotId: lot.id, by: ship.owner, text });
}

// Une fois par jour : nouveaux appels d'offres, engagements à jour, fin des appels échus.
export function tradeDaily(state, ctx, rng, notes) {
  state.tenders ??= [];
  // Engagements : le navire doit toujours être en route vers ce port avec la marchandise.
  for (const t of state.tenders) {
    t.commits = t.commits.filter((c) => {
      const s = state.ships.find((x) => x.id === c.shipId);
      return s && s.cargo && !s.cargo.contractId && s.cargo.good === t.good && ((s.status === 'sea' && s.voyage.to === t.port) || (s.status === 'port' && s.plan?.to === t.port));
    });
  }
  // Fin : complet ou échu (gardé quelques jours pour l'affichage, puis oublié).
  state.tenders = state.tenders.filter((t) => state.t - t.until < 5 * D && (t.left > 0 || state.t - (t.closedAt ?? state.t) < 5 * D));
  if (rng.chance(TENDER.chance)) {
    const t = newTender(state, ctx, rng);
    if (t) {
      state.tenders.push(t);
      const G = GOODS[t.good];
      const text = `Appel d'offres : ${portName(t.port)} achète ${num(t.qty)} t de ${G.name.toLowerCase()} à ${num(t.unit)} $/t, jusqu'au ${formatDate(t.until, true)}.`;
      news(state, text, { kind: 'event' });
      for (const co of state.companies) if (co.human && !co.bankrupt) notes.push({ kind: 'tender', company: co.id, tenderId: t.id, text });
    }
  }
  lotsDaily(state, rng, notes);
}

// Lots soldés : engagements à jour (le navire doit toujours s'y rendre, cales vides), fin des lots, nouveaux lots.
function lotsDaily(state, rng, notes) {
  state.lots ??= [];
  for (const l of state.lots) {
    l.commits = l.commits.filter((c) => {
      const s = state.ships.find((x) => x.id === c.shipId);
      return s && s.lotBuy === l.id && !s.cargo && ((s.status === 'sea' && s.voyage.to === l.port) || (s.status === 'port' && (s.port === l.port || s.plan?.to === l.port)));
    });
  }
  state.lots = state.lots.filter((l) => state.t - l.until < 3 * D && (l.left > 0 || state.t - (l.closedAt ?? state.t) < 3 * D));
  if (!rng.chance(LOT.chance)) return;
  const l = newLot(state, rng);
  if (!l) return;
  state.lots.push(l);
  const G = GOODS[l.good];
  const text = `Lot soldé : ${portName(l.port)} vend ${num(l.qty)} t de ${G.name.toLowerCase()} à ${num(l.unit)} $/t, jusqu'au ${formatDate(l.until, true)}.`;
  news(state, text, { kind: 'event' });
  for (const co of state.companies) if (co.human && !co.bankrupt) notes.push({ kind: 'lot', company: co.id, lotId: l.id, text });
}

// Un navire part avec une marchandise vers un port qui en demande : il s'engage (annoncé aux autres).
export function commitOnDeparture(state, ship, to, eta) {
  if (!ship.cargo || ship.cargo.contractId) return;
  const t = tenderAt(state, to, ship.cargo.good);
  if (!t || eta > t.until) return;
  t.commits = t.commits.filter((c) => c.shipId !== ship.id);
  const qty = Math.min(Math.round(ship.cargo.qty * (1 - (ship.cargo.damage || 0))), tenderRoom(t, ship.id));
  if (qty <= 0) return;
  t.commits.push({ company: ship.owner, shipId: ship.id, qty, eta: Math.round(eta) });
  const co = companyOf(state, ship);
  const left = Math.max(0, t.left - t.commits.reduce((s, c) => s + c.qty, 0));
  const text = `${co.name} livrera ${num(qty)} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} vers le ${formatDate(eta, true)} : il en resterait ${num(left)} t.`;
  (state.queuedNotes ??= []).push({ kind: 'tenderCommit', tenderId: t.id, by: ship.owner, text });
}

// À la vente : la part couverte par l'appel d'offres est payée au prix promis.
export function tenderShare(state, ship, qty) {
  const t = tenderAt(state, ship.port, ship.cargo.good);
  if (!t) return null;
  const part = Math.min(qty, t.left);
  return part > 0 ? { tender: t, qty: part } : null;
}
export function deliverTender(state, ship, share) {
  const t = share.tender;
  // On a servi la ville : confiance, et vertu si la marchandise n'est ni fossile ni polluante.
  const co = companyOf(state, ship);
  earnTrust(co, VIRTUE_SOURCES.tenderTrust, 'appels d\'offres');
  if (isCleanGood(t.good)) earnVirtue(co, VIRTUE_SOURCES.opportunity, 'affaires propres');
  t.left -= share.qty;
  t.commits = t.commits.filter((c) => c.shipId !== ship.id);
  if (t.left <= 0) { t.left = 0; t.closedAt = state.t; }
  const text = t.left > 0
    ? `${co.name} a livré ${num(share.qty)} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} : il en reste ${num(t.left)} t.`
    : `${co.name} a livré ${num(share.qty)} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} : l'appel d'offres est complet.`;
  (state.queuedNotes ??= []).push({ kind: 'tenderDelivered', tenderId: t.id, by: ship.owner, text });
}

// ---------- Financement des cargaisons ----------
export const FINANCE = {
  dueDays: 60,      // délai pour vendre ; ensuite le prêt devient une dette bancaire, avec pénalité
  lateFee: 0.05,
  destFee: 0.04,    // vente ailleurs que dans le port promis : remboursement anticipé et frais
  profiles: {
    etabli: { label: 'place financière établie', ltv: 0.55, rate: 0.07, minRep: 40 },
    standard: { label: 'place ordinaire', ltv: 0.65, rate: 0.12, minRep: 20 },
    louche: { label: 'place peu regardante', ltv: 0.75, rate: 0.19, minRep: 0 },
    embargo: { label: 'pays sous embargo', ltv: 0.9, rate: 0.3, minRep: 0 },
  },
  destLtv: 0.15,    // les acheteurs à destination prêtent davantage…
  destRate: -0.03,  // … et moins cher, contre la promesse d'y vendre
  trackLtv: 0.03, trackRate: 0.005, trackMax: 5, // par prêt remboursé à ce port (au plus 5)
  // Encours total des prêts sur cargaison d'une compagnie : au plus la moitié de sa valeur nette (et au moins
  // 3 M$ pour une petite compagnie). Sinon l'effet de levier fait des fortunes… ou des faillites.
  exposure: 0.5, exposureMin: 3e6,
};
// Plafond d'encours et ce qu'il reste à emprunter sur des cargaisons.
export function loanRoom(state, company) {
  const cap = Math.max(FINANCE.exposureMin, FINANCE.exposure * netWorth(state, company.id));
  const used = cargoLoans(state, company.id);
  return { cap, used, room: Math.max(0, cap - used) };
}
// Part réellement financée d'un achat, compte tenu du plafond d'encours.
export function financedShare(state, company, terms, cost) {
  const { room } = loanRoom(state, company);
  return Math.max(0, Math.min(terms.ltv, room / Math.max(1, cost)));
}
export function financeProfile(port) {
  const P = PORTS[port];
  if (EMBARGOED[P.flag]) return 'embargo';
  if (SHADY_PORTS.includes(port)) return 'louche';
  return P.size >= 4 ? 'etabli' : 'standard';
}
// Conditions d'un prêteur (port) pour une compagnie : part financée, taux annuel, refus éventuel.
export function lenderTerms(company, port, dest = false) {
  const key = financeProfile(port), F = FINANCE.profiles[key];
  const track = Math.min(FINANCE.trackMax, company.lenders?.[port] || 0);
  const repK = clamp(0.75 + standing(company).confidence / 200, 0.75, 1.15);
  const ltv = clamp((F.ltv + (dest ? FINANCE.destLtv : 0) + track * FINANCE.trackLtv) * repK, 0.2, 0.95);
  const rate = Math.max(0.03, F.rate + (dest ? FINANCE.destRate : 0) - track * FINANCE.trackRate);
  const why = company.confidence < F.minRep ? `confiance ${F.minRep} exigée` : null;
  return { port, profile: key, label: F.label, ltv, rate, track, why, dest };
}
export const loanOwed = loanOwedAt;
export const loanInterest = (loan, t) => loanOwedAt(loan, t) - loan.amount;
// Crée le prêt au moment de l'achat (appelé par buyCargo, qui a déjà vérifié la trésorerie).
export function openLoan(state, company, ship, terms, cost) {
  const amount = Math.round((cost * (terms.share ?? terms.ltv)) / 1000) * 1000;
  company.cash += amount;
  return { lender: terms.port, profile: terms.profile, amount, rate: terms.rate, t0: state.t, due: state.t + FINANCE.dueDays * D, dest: terms.dest ? terms.destPort : null };
}
// Remboursement à la vente, sur le produit de la vente. Renvoie le détail pour l'affichage.
export function settleLoan(state, company, ship, port) {
  const loan = ship.cargo?.loan;
  if (!loan) return null;
  const interest = loanInterest(loan, state.t);
  const fee = loan.dest && loan.dest !== port ? loan.amount * FINANCE.destFee : 0;
  company.cash -= loan.amount;
  book(state, company, -(interest + fee), 'interets', ship);
  if (!fee) (company.lenders ??= {})[loan.lender] = Math.min(FINANCE.trackMax, (company.lenders[loan.lender] || 0) + 1); // bon payeur
  ship.cargo.loan = null;
  return { amount: loan.amount, interest, fee };
}
// Cargaison perdue (naufrage…) ou délai dépassé : le prêt devient une dette bancaire ordinaire.
export function loanToDebt(state, company, ship, late = false) {
  const loan = ship.cargo?.loan;
  if (!loan) return 0;
  const owed = loanOwed(loan, state.t) + (late ? loan.amount * FINANCE.lateFee : 0);
  company.debt += owed;
  ship.cargo.loan = null;
  shipLog(state, ship, late ? `Prêt sur cargaison échu : ${money(owed)} passent en dette bancaire` : `Cargaison perdue : le prêt (${money(owed)}) passe en dette bancaire`);
  return owed;
}
// Une fois par jour : les prêts échus deviennent des dettes (le joueur est prévenu à l'avance).
export function loansDaily(state, notes) {
  for (const s of state.ships) {
    const loan = s.cargo?.loan;
    if (!loan) continue;
    const co = state.companies[s.owner];
    if (state.t >= loan.due) {
      const owed = loanToDebt(state, co, s, true);
      if (co.human) notes.push({ kind: 'info', shipId: s.id, company: co.id, text: `Le prêt sur la cargaison du ${s.name} est échu : ${money(owed)} passent en dette bancaire (pénalité de ${Math.round(FINANCE.lateFee * 100)} %).` });
    } else if (co.human && !loan.warned && loan.due - state.t <= 7 * D) {
      loan.warned = true;
      notes.push({ kind: 'info', shipId: s.id, company: co.id, text: `Le prêt sur la cargaison du ${s.name} arrive à échéance le ${formatDate(loan.due, true)} : vendez avant, ou il deviendra une dette bancaire (pénalité de ${Math.round(FINANCE.lateFee * 100)} %).` });
    }
  }
}
