// Les chargeurs face aux compagnies.
//  - Fiabilité vivante : un chargeur en redressement judiciaire disparaît quelque temps et
//    revient avec une moins bonne note ; un chargeur dénoncé publiquement perd la confiance du
//    marché ; tous remontent lentement vers leur nature.
//  - Après un mauvais procédé (impayé partiel, retenue, retard de paiement), la compagnie choisit :
//    dénoncer (le chargeur perd des points, elle gagne en réputation, il lui en garde rancune) ou
//    rester discrète (sa fidélité monte, et un client reconnaissant offre parfois un geste).
//  - Fidélité : les livraisons sans accroc la font monter ; elle réduit litiges et retards de
//    paiement, et le chargeur réserve d'abord ses contrats à son partenaire le plus fidèle.
//  - Exigences : les meilleurs payeurs ne travaillent qu'avec des armateurs réputés, sauf leurs
//    partenaires fidèles.
import { CLIENTS } from '../data/clients.js';
import { HOURS_PER_DAY } from './util.js';
import { onDenounce } from './honours.js';
import { news, changeVirtue, money as book } from './core.js';

const D = HOURS_PER_DAY;
const k$ = (v) => `${Math.round(v / 1000).toLocaleString('fr-FR')} k$`;
export const LOYAL = 4; // fidélité à partir de laquelle on est « partenaire fidèle »
export const MAX_LOYALTY = 10;
export const GRUDGE_DAYS = 120;
export const DENOUNCE_REP = 2; // réputation gagnée par la compagnie qui dénonce
export const RESERVE_DAYS = 3;
export const RESERVE_BONUS = 0.04;
export const RESERVE_LOYALTY = 6; // fidélité qui vaut la priorité sur une partie des contrats
export const RESERVE_SHARE = 0.25; // part des contrats du chargeur proposés d'abord à ce partenaire
const FLOOR = 15; // note plancher d'un chargeur
// Points de fiabilité perdus par un chargeur dénoncé, selon ce qu'il a fait.
export const DENOUNCE_HIT = { faillite: 12, contestation: 10, differe: 4 };
// Les IA dénoncent surtout les fautes graves, et seulement un chargeur avec qui elles n'ont pas de lien.
export const AI_DENOUNCE = { faillite: 0.4, contestation: 0.2, differe: 0.05 };
export const aiDenounces = (rng, company, incident) => (company.ai?.leaning === 'vertueux' ? rng.chance(Math.min(0.9, (AI_DENOUNCE[incident.kind] || 0) * 1.5)) : relationOf(company, incident.client).loyalty < 2 && rng.chance(AI_DENOUNCE[incident.kind] || 0));
// Chance qu'un chargeur resté anonyme vous dédommage, selon son tempérament.
export const GRATITUDE = { ponctuel: 0.7, lent: 0.5, fragile: 0.45, pinailleur: 0.2 };

export function clientState(state, id) {
  state.clients ??= {};
  return (state.clients[id] ??= { rel: CLIENTS[id]?.reliability ?? 70, downUntil: 0, named: 0 });
}
export const clientRel = (state, id) => (id && CLIENTS[id] ? clientState(state, id).rel : 70);
export const clientDown = (state, id) => !!(id && CLIENTS[id] && clientState(state, id).downUntil > state.t);

// Relation d'une compagnie avec un chargeur (lecture seule : rien n'est créé tant qu'il ne
// s'est rien passé, pour garder les sauvegardes légères).
const EMPTY = Object.freeze({ loyalty: 0, deliveries: 0, grudgeUntil: 0, incidents: 0 });
export const relationOf = (company, id) => company.clients?.[id] || EMPTY;
function relation(company, id) {
  company.clients ??= {};
  return (company.clients[id] ??= { loyalty: 0, deliveries: 0, grudgeUntil: 0, incidents: 0 });
}

// Réputation exigée par les meilleurs payeurs (leurs partenaires fidèles en sont dispensés).
export function clientDemand(state, id) {
  const r = clientRel(state, id);
  return r >= 85 ? 50 : r >= 75 ? 40 : 0;
}

// Probabilités d'imprévu à l'encaissement : exactement celles du tirage, pour les montrer
// avant d'accepter le contrat.
export function paymentRisk(state, company, id) {
  const C = CLIENTS[id] || { style: 'ponctuel' };
  const R = clientRel(state, id), rep = company.reputation, L = id ? relationOf(company, id).loyalty : 0;
  return {
    bankrupt: Math.max(0, (45 - R) / 350) * (C.style === 'fragile' ? 1.6 : 1),
    dispute: Math.max(0.02, 0.03 + (100 - R) / 450 + (60 - rep) / 700) * (C.style === 'pinailleur' ? 1.8 : 1) * (1 - 0.05 * L),
    defer: (0.04 + (100 - R) / 600) * (C.style === 'lent' ? 2 : 1) * (1 - 0.04 * L),
  };
}
// Part du fret qu'on peut s'attendre à perdre : 65 % en cas de faillite, 12,5 % en cas de litige.
export function expectedLoss(state, company, id) {
  if (!id || !CLIENTS[id]) return 0.01;
  const r = paymentRisk(state, company, id);
  return r.bankrupt * 0.65 + r.dispute * 0.125 + r.defer * 0.01;
}
export function gratitudeChance(company, id) {
  return Math.min(0.9, (GRATITUDE[CLIENTS[id]?.style] ?? 0.4) + 0.03 * relationOf(company, id).loyalty);
}

// Le chargeur propose d'abord une partie de ses contrats à son partenaire le plus fidèle, s'il
// a un navire dans ce port ou en route vers lui (sinon l'offre ne servirait à personne). C'est
// une offre en plus de celles du port : elle ne prend la place de personne.
export function reserveFor(state, rng, id, port) {
  if (!id) return null;
  let best = null;
  for (const c of state.companies) {
    if (c.bankrupt) continue;
    const r = relationOf(c, id);
    if (r.loyalty < RESERVE_LOYALTY || r.grudgeUntil > state.t) continue;
    if (!state.ships.some((s) => s.owner === c.id && (s.port === port || s.voyage?.to === port))) continue;
    if (!best || r.loyalty > best.loyalty || (r.loyalty === best.loyalty && r.deliveries > best.deliveries)) best = { id: c.id, loyalty: r.loyalty, deliveries: r.deliveries };
  }
  return best && rng.chance(RESERVE_SHARE) ? best.id : null;
}

// Contrat ouvert à cette compagnie ? Sinon, la raison (rancune, réservation, exigence).
export function clientRefusal(state, company, contract) {
  const id = contract.client;
  if (!id || !CLIENTS[id]) return null;
  const C = CLIENTS[id], r = relationOf(company, id);
  if (r.grudgeUntil > state.t) return { kind: 'rancune', until: r.grudgeUntil, name: C.name };
  if (contract.reservedFor != null && contract.reservedFor !== company.id && contract.reservedUntil > state.t) return { kind: 'reserve', until: contract.reservedUntil, name: C.name };
  if (contract.clientRep && company.reputation < contract.clientRep && r.loyalty < LOYAL) return { kind: 'exigence', rep: contract.clientRep, name: C.name };
  return null;
}

// Livraison terminée : la fidélité monte si tout s'est bien passé.
export function noteDelivery(state, company, id, { late = false, damaged = false } = {}) {
  if (!id || !CLIENTS[id]) return;
  const r = relation(company, id);
  r.deliveries++;
  r.last = state.t;
  r.loyalty = Math.max(0, Math.min(MAX_LOYALTY, r.loyalty + (damaged ? -2 : late ? -1 : 1)));
}

// Redressement judiciaire : plus de nouveaux contrats pendant deux à quatre mois, et une note en baisse.
export function clientBankrupt(state, rng, id) {
  if (!id || !CLIENTS[id]) return;
  const cs = clientState(state, id);
  if (cs.downUntil > state.t) return;
  cs.downUntil = state.t + rng.int(60, 120) * D;
  cs.rel = Math.max(FLOOR, cs.rel - 10);
}

// Choix de la compagnie après un mauvais procédé : 'denoncer' ou 'discret'.
// incident : { client, kind: 'faillite' | 'contestation' | 'differe', loss, invoice }.
const WHAT = {
  faillite: 'il n\'a réglé qu\'une partie de sa facture',
  contestation: 'une retenue injustifiée sur le fret',
  differe: 'des paiements en retard',
};
export function reportClient(state, rng, company, incident, choice) {
  const id = incident?.client, C = CLIENTS[id];
  if (!C) return null;
  const cs = clientState(state, id), r = relation(company, id);
  r.incidents++;
  if (choice === 'denoncer') {
    cs.rel = Math.max(FLOOR, cs.rel - DENOUNCE_HIT[incident.kind]);
    cs.named++;
    r.loyalty = 0;
    r.grudgeUntil = state.t + GRUDGE_DAYS * D;
    changeVirtue(company, DENOUNCE_REP);
    onDenounce(company);
    news(state, `${company.name} dénonce publiquement ${C.name} : ${WHAT[incident.kind]}.`, { company: company.id, kind: 'event' });
    return { denounced: true };
  }
  const chance = gratitudeChance(company, id);
  r.loyalty = Math.min(MAX_LOYALTY, r.loyalty + 2);
  if (rng.chance(chance)) {
    const amount = Math.round(incident.kind === 'differe' ? incident.invoice * rng.range(0.02, 0.04) : incident.loss * rng.range(0.3, 0.6));
    const due = incident.kind === 'faillite' ? Math.max(cs.downUntil, state.t + 30 * D) : state.t + rng.int(30, 90) * D;
    if (amount > 0) (state.goodwill ??= []).push({ company: company.id, client: id, amount, due });
  }
  return { discreet: true };
}

// Chaque jour : les notes remontent lentement, les redressements se terminent, les gestes
// commerciaux promis arrivent.
export function clientsDaily(state, notes) {
  for (const [id, cs] of Object.entries(state.clients || {})) {
    const base = CLIENTS[id]?.reliability ?? 70;
    cs.rel += (base - cs.rel) / 240; // environ les trois quarts de l'écart rattrapés en un an
    if (cs.downUntil && cs.downUntil <= state.t) {
      cs.downUntil = 0;
      news(state, `${CLIENTS[id].name} sort du redressement judiciaire et reprend ses expéditions.`, { kind: 'event' });
    }
  }
  // Une fidélité s'use si l'on ne travaille plus pour ce chargeur (un point par mois après deux mois).
  if (Math.round(state.t / D) % 30 === 0) {
    for (const c of state.companies) for (const r of Object.values(c.clients || {})) {
      if (r.loyalty > 0 && state.t - (r.last || 0) > 60 * D) r.loyalty--;
    }
  }
  const due = (state.goodwill || []).filter((g) => g.due <= state.t);
  if (!due.length) return;
  state.goodwill = state.goodwill.filter((g) => g.due > state.t);
  for (const g of due) {
    const company = state.companies[g.company];
    if (!company || company.bankrupt) continue;
    book(state, company, g.amount, 'fret');
    const r = relation(company, g.client);
    r.loyalty = Math.min(MAX_LOYALTY, r.loyalty + 1);
    if (company.human) notes.push({ kind: 'paid', company: company.id, text: `${CLIENTS[g.client].name}, reconnaissant de votre discrétion, vous fait un geste commercial : ${k$(g.amount)}.`, amount: g.amount });
  }
}
