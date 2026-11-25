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
import { news, portName, companyOf, shipLog, money, loanOwedAt, cargoLoans, netWorth, earnTrust, earnVirtue, VIRTUE_SOURCES, standing } from './core.js';
import { isSeasonal } from './ice.js';

const D = HOURS_PER_DAY;

// ---------- Appels d'offres ----------
export const TENDER = {
  chance: 0.14,          // par jour : chance qu'une ville lance un appel d'offres (≈ un par semaine)
  max: 4,                // appels d'offres ouverts en même temps, au plus
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
      const text = `Appel d'offres : ${portName(t.port)} achète ${t.qty.toLocaleString('fr-FR')} t de ${G.name.toLowerCase()} à ${t.unit.toLocaleString('fr-FR')} $/t, jusqu'au ${formatDate(t.until, true)}.`;
      news(state, text, { kind: 'event' });
      for (const co of state.companies) if (co.human && !co.bankrupt) notes.push({ kind: 'tender', company: co.id, tenderId: t.id, text });
    }
  }
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
  const text = `${co.name} livrera ${qty.toLocaleString('fr-FR')} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} vers le ${formatDate(eta, true)} : il en resterait ${left.toLocaleString('fr-FR')} t.`;
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
    ? `${co.name} a livré ${share.qty.toLocaleString('fr-FR')} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} : il en reste ${t.left.toLocaleString('fr-FR')} t.`
    : `${co.name} a livré ${share.qty.toLocaleString('fr-FR')} t de ${GOODS[t.good].name.toLowerCase()} à ${portName(t.port)} : l'appel d'offres est complet.`;
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
  money(state, company, -(interest + fee), 'interets', ship);
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
  shipLog(state, ship, late ? `Prêt sur cargaison échu : ${Math.round(owed / 1000)} k$ passent en dette bancaire` : `Cargaison perdue : le prêt (${Math.round(owed / 1000)} k$) passe en dette bancaire`);
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
      if (co.human) notes.push({ kind: 'info', shipId: s.id, company: co.id, text: `Le prêt sur la cargaison du ${s.name} est échu : ${Math.round(owed / 1000).toLocaleString('fr-FR')} k$ passent en dette bancaire (pénalité de ${Math.round(FINANCE.lateFee * 100)} %).` });
    } else if (co.human && !loan.warned && loan.due - state.t <= 7 * D) {
      loan.warned = true;
      notes.push({ kind: 'info', shipId: s.id, company: co.id, text: `Le prêt sur la cargaison du ${s.name} arrive à échéance le ${formatDate(loan.due, true)} : vendez avant, ou il deviendra une dette bancaire (pénalité de ${Math.round(FINANCE.lateFee * 100)} %).` });
    }
  }
}
