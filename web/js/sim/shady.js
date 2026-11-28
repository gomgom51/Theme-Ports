// Commerce gris (embargos) et noir (colis discrets).
//  Gris : commercer avec un pays sous embargo marque le navire pendant un an ; s'il
//         fait ensuite escale dans un pays qui applique les sanctions, il risque une amende.
//  Noir : des intermédiaires confient un colis à cacher à bord, payé à la livraison.
//         La douane de chaque port d'escale peut le trouver : saisie, amende, immobilisation.
import { HOME, homeKind, homeOf, shadowHome, lenderParcel } from './home.js';
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { EMBARGOED, ENFORCING, customsLevel, corruption, CONCEALMENT, SHADY_PORTS } from '../data/sanctions.js';
import { money, news, changeVirtue, portName, shipLog, shipById, companyOf, costStat } from './core.js';
import { HOURS_PER_DAY, formatDate } from './util.js';
import { equipMod } from './equipment.js';
import { onDirty, onEmbargoTrade, onStain, onParcel } from './honours.js';
import { tipped, tipReward, TIP_DETECT } from './plots.js';
import { skillConceal } from './crew.js';
import { addTrust, parcelNature, scheduleAftermath } from './dark.js';

const D = HOURS_PER_DAY;
export const TAINT_DAYS = 365;
export const SANCTION_ODDS = 0.35;
export const isEmbargoed = (port) => !!EMBARGOED[PORTS[port]?.flag];
export const enforces = (port) => ENFORCING.has(PORTS[port]?.flag);
const fail = (msg) => ({ ok: false, msg });

// ---------- Embargo ----------
export function taintShip(state, ship, port, value) {
  if (!isEmbargoed(port)) return;
  ship.taint = { t: state.t, port, value: Math.round((taintActive(state, ship)?.value || 0) + value) };
  const owner = companyOf(state, ship);
  if (owner) { onEmbargoTrade(owner, value); onDirty(state, owner); }
  shipLog(state, ship, `Commerce avec un pays sous embargo (${FLAGS[PORTS[port].flag].name})`);
}
export function taintActive(state, ship) {
  return ship.taint && state.t - ship.taint.t < TAINT_DAYS * D ? ship.taint : null;
}
export function sanctionFine(company, taint) {
  const base = Math.min(12e6, Math.max(500000, taint.value * 0.25));
  return ENFORCING.has(company.flag) ? base : base * 0.7; // les compagnies sous pavillon « sanctionneur » paient plein tarif
}
// Risque d'amende à l'arrivée dans un port (affiché avant le départ).
export function sanctionRisk(state, ship, port) {
  const t = taintActive(state, ship);
  if (!t || !enforces(port)) return null;
  return { odds: SANCTION_ODDS * equipMod(ship, 'sanction'), fine: sanctionFine(companyOf(state, ship), t), taint: t };
}
// Avant de commercer : le risque d'amende qu'on prendrait (montant pour la valeur ajoutée au marquage).
export function sanctionPreview(state, ship, value) {
  const prev = taintActive(state, ship)?.value || 0;
  return { odds: SANCTION_ODDS * equipMod(ship, 'sanction'), fine: sanctionFine(companyOf(state, ship), { value: prev + value }) };
}
export function checkSanctions(state, rng, ship, port, onNote) {
  const risk = sanctionRisk(state, ship, port);
  if (!risk || !rng.chance(risk.odds)) return null;
  const company = companyOf(state, ship);
  money(state, company, -risk.fine, 'sinistres', ship);
  costStat(state, 'sanctions', risk.fine);
  onStain(state, company);
  if (company.ai) company.ai.noEmbargoUntil = state.t + 365 * D; // l'ordinateur retient la leçon un an
  changeVirtue(company, -8, 'douanes et amendes');
  ship.taint = null;
  const from = FLAGS[PORTS[risk.taint.port].flag].name;
  const text = `${FLAGS[PORTS[port].flag].name} sanctionne le ${ship.name} pour commerce avec un pays sous embargo (${from}) : amende de ${(risk.fine / 1e6).toFixed(2).replace('.', ',')} M$.`;
  news(state, text, { company: company.id, kind: 'disaster' });
  onNote?.('sanction', text);
  return risk;
}

// ---------- Colis discrets ----------
export function crewDiscretion(ship) { return [1, 0.9, 0.8][ship.crew || 0]; }
// Probabilité que la douane d'un port trouve le colis lors d'une escale.
// home : port d'attache du propriétaire (port de l'ombre : la douane y regarde ailleurs).
export function detectionChance(ship, port, home = null) {
  const k = home === port && homeKind(port) === 'ombre' ? HOME.customs : 1;
  return k * customsLevel(PORTS[port].flag) * concealFactor(ship);
}
// Ce qui, à bord, cache un colis (plus bas = mieux caché) : la coque (CONCEALMENT), l'équipage,
// les cachettes aménagées et le savoir-faire en contrebande. La douane multiplie par sa sévérité.
export function concealFactor(ship) {
  return (CONCEALMENT[ship.type] ?? 1) * crewDiscretion(ship) * equipMod(ship, 'conceal') * skillConceal(ship);
}
// Échelle de discrétion affichée au joueur (1 voyant … 5 insoupçonnable), pour un facteur ci-dessus
// ou la seule coque d'un modèle (courtier).
export const CONCEAL_STEPS = [0.3, 0.5, 0.7, 1.0];
export const concealLevel = (f) => 5 - CONCEAL_STEPS.filter((x) => f > x).length;
export const seizureFine = (pay) => Math.max(500000, pay * 3);

export function refreshOffers(state, ctx, rng) {
  state.offers = (state.offers || []).filter((o) => o.expires > state.t);
  for (const p of SHADY_PORTS) {
    const n = state.offers.filter((o) => o.from === p).length;
    const cap = state.companies.some((c) => shadowHome(c, p)) ? HOME.parcels : 2; // plus de colis au port de l'ombre d'une compagnie
    if (n < cap && rng.chance(n ? 0.15 : 0.4)) {
      const o = makeOffer(state, ctx, rng, p);
      if (o) state.offers.push(o);
    }
  }
}
function makeOffer(state, ctx, rng, from) {
  const dests = PORT_IDS.filter((p) => p !== from).map((p) => [p, 1 + customsLevel(PORTS[p].flag) * 6]);
  const to = rng.weighted(dests);
  const info = ctx.distanceInfo(from, to);
  if (!info) return null;
  const cust = customsLevel(PORTS[to].flag);
  // Plus la douane d'arrivée est sévère, mieux c'est payé.
  const pay = Math.round((120000 + 3.2e6 * Math.pow(cust, 1.5) * rng.range(0.7, 1.3) + (info.nm / 5000) * 150000) / 10000) * 10000;
  const days = info.nm / (24 * 13);
  return {
    id: state.nextId++, from, to, pay, nature: parcelNature(rng), // ce qu'il contient vraiment : personne ne le dit
    deadline: Math.round(state.t + (days * 1.6 + 6) * D),
    expires: Math.round(state.t + rng.range(5, 14) * D),
  };
}
export function acceptOffer(state, shipId, offerId) {
  const ship = shipById(state, shipId);
  const o = (state.offers || []).find((x) => x.id === offerId);
  if (!ship || !o) return fail('Proposition introuvable.');
  if (ship.status !== 'port' || ship.port !== o.from) return fail('Le navire doit être à quai dans ce port.');
  if (ship.contraband) return fail('Un colis est déjà caché à bord.');
  ship.contraband = { ...o };
  onDirty(state, companyOf(state, ship));
  state.offers = state.offers.filter((x) => x !== o);
  shipLog(state, ship, `Colis discret embarqué pour ${portName(o.to)}`);
  return { ok: true };
}
// Proposition spontanée, quand on vient d'accepter un contrat : un intermédiaire propose un
// colis pour la même destination (souvent dans les ports louches, parfois dans les ports
// corrompus, rarement ailleurs). Payé comme les autres colis ; doublé s'il insiste.
export function proposalChance(port) {
  return SHADY_PORTS.includes(port) ? 0.35 : corruption(PORTS[port].flag) > 0.15 ? 0.15 : 0.04;
}
export function proposeParcel(state, ctx, rng, ship, to) {
  if (ship.contraband || ship.port === to || !rng.chance(proposalChance(ship.port))) return null;
  const info = ctx.distanceInfo(ship.port, to);
  if (!info) return null;
  const cust = customsLevel(PORTS[to].flag);
  const pay = Math.round((120000 + 3.2e6 * Math.pow(cust, 1.5) * rng.range(0.7, 1.3) + (info.nm / 5000) * 150000) / 10000) * 10000;
  const days = info.nm / (24 * 13);
  return { id: state.nextId++, from: ship.port, to, pay, nature: parcelNature(rng), deadline: Math.round(state.t + (days * 1.6 + 6) * D), expires: state.t + D, insist: rng.chance(0.3) };
}
export function acceptProposal(state, shipId, offer) {
  const ship = shipById(state, shipId);
  if (!ship || ship.contraband) return fail('Un colis est déjà caché à bord.');
  ship.contraband = { ...offer };
  shipLog(state, ship, `Colis discret embarqué pour ${portName(offer.to)}`);
  return { ok: true };
}

// À chaque escale avec un colis à bord : fouille possible, puis livraison à destination.
// onNote(kind, text, extra) ; pour un joueur humain, une saisie dans un port corrompu ouvre un choix.
export function contrabandOnArrival(state, rng, ship, port, onNote) {
  const cb = ship.contraband;
  if (!cb) return null;
  const company = companyOf(state, ship);
  if (state.t > cb.deadline) {
    ship.contraband = null;
    onNote?.('info', `Le colis du ${ship.name} n'a pas été livré à temps : vos contacts ne paieront pas, il est passé par-dessus bord.`);
    return { late: true };
  }
  // Un navire dénoncé par un concurrent est fouillé presque à coup sûr.
  const home = homeOf(state, ship);
  if (rng.chance(tipped(state, ship) ? Math.max(TIP_DETECT, detectionChance(ship, port, home)) : detectionChance(ship, port, home))) {
    ship.contraband = null;
    const fine = seizureFine(cb.pay);
    tipReward(state, ship, fine);
    const days = rng.int(10, 25);
    const corrupt = corruption(PORTS[port].flag);
    if (company.human && corrupt > 0.15) {
      // Le joueur décide : payer l'amende ou tenter de soudoyer le douanier.
      const c = { id: state.nextId++, company: company.id, shipId: ship.id, port, fine, days, bribe: Math.round(fine * 0.35 / 10000) * 10000, chance: corrupt };
      (state.cases ??= []).push(c);
      ship.busyWhat = 'saisie';
      ship.busyUntil = state.t + 60 * D; // en attente de votre décision
      onNote?.('customs', `La douane de ${portName(port)} a trouvé le colis caché à bord du ${ship.name} ! Amende de ${(fine / 1e6).toFixed(2).replace('.', ',')} M$ et ${days} jours d'immobilisation… à moins qu'un arrangement soit possible.`, { caseId: c.id });
      return { caught: true, pending: c };
    }
    applySeizure(state, ship, company, port, fine, days, onNote);
    return { caught: true };
  }
  if (port === cb.to) {
    ship.contraband = null;
    money(state, company, cb.pay, 'discret', ship);
    shipLog(state, ship, `Colis discret livré à ${portName(port)}`);
    onParcel(state, company);
    lenderParcel(state, company); // prêteur de l'ombre : quota de colis
    addTrust(company, cb.from); // les gangs d'un port sous embargo commencent à vous faire confiance
    scheduleAftermath(state, rng, company, port, cb.nature); // ce qu'il contenait finira peut-être dans les nouvelles
    onNote?.('paid', `Le colis caché à bord du ${ship.name} a été remis à ${portName(port)} : ${Math.round(cb.pay / 1000).toLocaleString('fr-FR')} k$ en liquide.`, { amount: cb.pay, parcel: true });
    return { delivered: true };
  }
  return null;
}
function applySeizure(state, ship, company, port, fine, days, onNote) {
  onStain(state, company);
  money(state, company, -fine, 'sinistres', ship);
  costStat(state, 'douane', fine);
  changeVirtue(company, -15, 'douanes et amendes');
  ship.busyWhat = 'saisie';
  ship.busyUntil = Math.max(ship.busyUntil || 0, state.t) + days * D;
  const text = `La douane de ${portName(port)} saisit un colis de contrebande à bord du ${ship.name} (${company.name}) : amende de ${(fine / 1e6).toFixed(2).replace('.', ',')} M$, navire immobilisé ${days} jours.`;
  news(state, text, { company: company.id, kind: 'disaster' });
  onNote?.('detention', text, { seizure: true });
}
// Décision du joueur après une saisie : 'payer' ou 'soudoyer'.
export function resolveCase(state, rng, caseId, choice) {
  const c = (state.cases || []).find((x) => x.id === caseId);
  if (!c) return fail('Affaire introuvable.');
  state.cases = state.cases.filter((x) => x !== c);
  const ship = shipById(state, c.shipId);
  const company = state.companies[c.company];
  if (!ship) return { ok: true };
  ship.busyUntil = state.t;
  if (choice === 'soudoyer') {
    money(state, company, -c.bribe, 'discret', ship);
    if (rng.chance(c.chance)) {
      changeVirtue(company, -2, 'douanes et amendes');
      ship.busyUntil = state.t + 12;
      shipLog(state, ship, `Arrangement avec la douane de ${portName(c.port)}`);
      return { ok: true, bribed: true, cost: c.bribe };
    }
    applySeizure(state, ship, company, c.port, Math.round(c.fine * 1.5), Math.round(c.days * 1.5), null);
    changeVirtue(company, -5, 'douanes et amendes');
    return { ok: true, bribed: false, cost: c.bribe + Math.round(c.fine * 1.5) };
  }
  applySeizure(state, ship, company, c.port, c.fine, c.days, null);
  return { ok: true, paid: c.fine };
}
export { customsLevel, corruption, formatDate };
