// Rachat d'une compagnie concurrente.
//  Prix : valeur nette × (1 + réputation / 50). Les actionnaires d'une compagnie réputée font
//    confiance à leur dirigeant : ils ne la cèdent pas au prix de ses actifs.
//  Conditions : être au moins au niveau de la cible (maturité) et payer comptant, avec sa
//    trésorerie nette (liquidités moins dettes et prêts sur cargaison) : pas d'emprunt.
//  Le racheteur reprend tout : navires, commandes, contrats en cours, liquidités et dettes, ses
//    chargeurs (la meilleure fidélité des deux) ; sa réputation se rapproche de celle de la cible.
//  Cible humaine : l'offre est annoncée ; elle aboutit au bout de 30 jours si elle tient toujours
//    (prix, niveau). Le dirigeant peut demander six mois aux actionnaires pour redresser la barre
//    (chance affichée, selon sa réputation). Tant qu'un concurrent peut le racheter, il est prévenu.
import { HOURS_PER_DAY, formatDate } from './util.js';
import { netWorth, cargoLoans, fleetValue, shipsOf, changeReputation, news, money, removeShip } from './core.js';
import { onEliminated } from './honours.js';
import { crossesLine, BLACKLIST } from './shadow.js';
import { victoryProgress, VICTORY } from './victory.js';
import { OFFICE_TIERS } from '../data/offices.js';

const D = HOURS_PER_DAY;
const M$ = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M$`;
export const TAKEOVER = {
  repK: 50,              // prix = valeur nette × (1 + réputation / 50)
  minWorth: 1e6,         // une compagnie au bord du gouffre vaut au moins cela pour ses actionnaires
  bidDays: 30,           // délai avant qu'une offre sur une compagnie humaine aboutisse
  reprieveDays: 180,     // « donnez-moi six mois pour redresser la barre »
  reprieveBase: 0.3, reprieveRep: 0.006, reprieveRepeat: 0.25,
  repBlend: 0.5,         // poids de la réputation de la cible (pondérée par la taille des flottes)
  aiChance: 0.3,         // chaque mois, chance qu'une IA qui le peut tente un rachat
  aiMaxRatio: 1.8,       // l'IA ne paie pas plus de 1,8 fois la valeur nette
  aiMaxRatioBold: 2.9,   // une conquérante paie jusqu'à 2,9 fois (presque toute réputation)
  aiReserve: 1.3,        // et garde 30 % de marge de trésorerie nette
  aiReserveBold: 1.1,    // une conquérante, 10 %
  dismantleK: 2,         // démanteler une compagnie de l'ombre : deux fois sa valeur nette (sociétés-écrans)
  reprieveInfamy: 0.005, // ses actionnaires de l'ombre ne vendent pas au premier venu : chance selon l'infamie
};

export const levelOf = (c) => c.level ?? 0;
export const netCash = (state, c) => c.cash - c.debt - cargoLoans(state, c.id);
// Une compagnie sur la liste noire ne se rachète que pour être démantelée (ses navires sanctionnés
// partent à la casse) : au prix de ses actifs, sans prime de réputation.
export const dismantleOnly = (buyer, target) => !!target.blacklisted && !buyer?.blacklisted;
export function takeoverPrice(state, target, buyer = null) {
  const k = dismantleOnly(buyer, target) ? TAKEOVER.dismantleK : 1 + target.reputation / TAKEOVER.repK;
  return Math.round(Math.max(TAKEOVER.minWorth, netWorth(state, target.id)) * k / 10000) * 10000;
}
export const reprieveOf = (state, c) => (c.reprieve && c.reprieve.until > state.t ? c.reprieve : null);
export const pendingBid = (state, targetId) => (state.bids || []).find((b) => b.target === targetId && b.status === 'pending') || null;
export const reprieveChance = (c) => Math.max(0.05, Math.min(0.95, TAKEOVER.reprieveBase + (c.blacklisted ? Math.min(0.6, (c.infamy || 0) * TAKEOVER.reprieveInfamy) : c.reputation * TAKEOVER.reprieveRep) - (c.reprieve?.n || 0) * TAKEOVER.reprieveRepeat));

// Peut-on racheter cette compagnie ? (raison sinon, et de quoi l'afficher)
export function canTakeover(state, buyerId, targetId, { ignoreBid = null } = {}) {
  const buyer = state.companies[buyerId], target = state.companies[targetId];
  if (!buyer || !target || buyer === target || buyer.bankrupt) return { ok: false, why: 'Rachat impossible.' };
  if (target.bankrupt) return { ok: false, why: target.absorbed ? 'Cette compagnie a déjà été rachetée.' : 'Cette compagnie a fait faillite.' };
  const price = takeoverPrice(state, target, buyer), cash = netCash(state, buyer);
  const base = { price, cash, ok: false, dismantle: dismantleOnly(buyer, target) };
  if (levelOf(buyer) < levelOf(target)) return { ...base, why: `Il faut être au moins au niveau ${levelOf(target) + 1} (${OFFICE_TIERS[levelOf(target)].name.toLowerCase()}) pour racheter une compagnie de ce niveau.` };
  const rp = reprieveOf(state, target);
  if (rp) return { ...base, why: `Ses actionnaires ont accordé six mois à son dirigeant : aucun rachat avant le ${formatDate(rp.until, true)}.`, reprieve: rp };
  const bid = pendingBid(state, targetId);
  if (bid && bid.id !== ignoreBid) return { ...base, why: bid.by === buyerId ? 'Votre offre est déjà sur la table.' : 'Une autre offre est déjà sur la table.' };
  if (cash < price) return { ...base, why: `Il faut ${M$(price)} de trésorerie nette (liquidités moins dettes et prêts sur cargaison) : un rachat se paie comptant, sans emprunt. Vous en avez ${M$(Math.max(0, cash))}.` };
  return { ...base, ok: true };
}
// Démanteler : on paie, ses navires partent à la casse, la compagnie disparaît ; rien d'autre.

// Ce que le rachat change pour le racheteur (aperçu avant de confirmer).
export function takeoverPreview(state, buyerId, targetId) {
  const buyer = state.companies[buyerId], target = state.companies[targetId];
  const vb = fleetValue(state, buyer.id), vt = fleetValue(state, target.id);
  const w = TAKEOVER.repBlend * (vt / Math.max(1, vb + vt));
  return {
    price: takeoverPrice(state, target), worth: netWorth(state, target.id), ships: shipsOf(state, target.id).length,
    cash: target.cash, debt: target.debt + cargoLoans(state, target.id),
    rep: buyer.reputation * (1 - w) + target.reputation * w, infamy: (buyer.infamy || 0) + (target.infamy || 0) * w,
  };
}

// Le rachat lui-même.
export function executeTakeover(state, buyerId, targetId, notes = null) {
  const chk = canTakeover(state, buyerId, targetId, { ignoreBid: pendingBid(state, targetId)?.id });
  if (!chk.ok) return { ok: false, msg: chk.why };
  const buyer = state.companies[buyerId], target = state.companies[targetId];
  const pv = takeoverPreview(state, buyerId, targetId);
  if (chk.dismantle) {
    money(state, buyer, -chk.price, 'rachats');
    for (const s of state.ships.filter((x) => x.owner === target.id)) removeShip(state, null, s, 'démantelé', 0);
    for (const o of state.orders || []) if (o.owner === target.id) o.owner = -1;
    state.orders = (state.orders || []).filter((o) => o.owner !== -1);
    for (const p of state.plots || []) if ((p.by === target.id || p.target === target.id) && p.until > state.t) p.until = state.t;
    for (const b of state.bids || []) if ((b.target === target.id || b.by === target.id) && b.status === 'pending') b.status = 'void';
    target.cash = 0; target.debt = 0; target.bankrupt = true;
    target.absorbed = { by: buyer.id, t: state.t, price: chk.price, dismantled: true };
    onEliminated(state, target, buyer.id);
    news(state, `${buyer.name} rachète ${target.name}, sur la liste noire, pour la démanteler : sa flotte part à la casse.`, { company: buyer.id, kind: 'event' });
    if (notes && target.human) notes.push({ kind: 'absorbed', company: target.id, other: buyer.id, text: `${buyer.name} a racheté votre compagnie pour ${M$(chk.price)} et la démantèle : vos navires partent à la casse. La partie est finie pour ${target.name}.` });
    if (notes && buyer.human) notes.push({ kind: 'takeover', company: buyer.id, other: target.id, text: `${target.name} est démantelée : sa flotte part à la casse.` });
    return { ok: true, price: chk.price, ships: 0, dismantled: true };
  }
  // Argent : le prix aux actionnaires ; les liquidités et les dettes de la cible passent au racheteur.
  money(state, buyer, -chk.price, 'rachats');
  money(state, buyer, target.cash, 'rachats');
  buyer.debt += target.debt;
  // Navires, commandes, contrats en cours, paiements à encaisser.
  for (const s of state.ships) if (s.owner === target.id) s.owner = buyer.id;
  for (const o of state.orders || []) if (o.owner === target.id) o.owner = buyer.id;
  for (const c of state.contracts) { if (c.takenCo === target.id) c.takenCo = buyer.id; if (c.reservedFor === target.id) c.reservedFor = buyer.id; } // takenBy désigne le navire, qui change de main
  for (const p of state.payments || []) if (p.company === target.id) p.company = buyer.id;
  for (const r of state.receivables || []) if (r.company === target.id) r.company = buyer.id;
  // Chargeurs : la meilleure fidélité des deux ; réseau de ports et de prêteurs.
  buyer.clients ??= {};
  for (const [id, r] of Object.entries(target.clients || {})) {
    const mine = (buyer.clients[id] ??= { loyalty: 0, deliveries: 0, grudgeUntil: 0, incidents: 0 });
    mine.loyalty = Math.max(mine.loyalty, r.loyalty); mine.deliveries += r.deliveries || 0;
  }
  buyer.portsServed = [...new Set([...(buyer.portsServed || []), ...(target.portsServed || [])])];
  for (const [p, n] of Object.entries(target.lenders || {})) (buyer.lenders ??= {})[p] = (buyer.lenders[p] || 0) + n;
  // Réputation et infamie : celles de la cible déteignent.
  buyer.infamy = pv.infamy;
  buyer.reputation = pv.rep;
  changeReputation(buyer, 0); // applique le plafond
  // Les coups bas de la cible et contre elle s'arrêtent ; l'offre est close.
  for (const p of state.plots || []) if ((p.by === target.id || p.target === target.id) && p.until > state.t) p.until = state.t;
  for (const b of state.bids || []) if ((b.target === target.id || b.by === target.id) && b.status === 'pending') b.status = b.target === target.id ? 'done' : 'void';
  target.cash = 0; target.debt = 0;
  target.bankrupt = true;
  target.absorbed = { by: buyer.id, t: state.t, price: chk.price };
  onEliminated(state, target, buyer.id);
  news(state, `${buyer.name} rachète ${target.name} pour ${M$(chk.price)} : sa flotte de ${pv.ships} navire(s) passe sous ses couleurs.`, { company: buyer.id, kind: 'event' });
  if (notes) {
    if (buyer.human) notes.push({ kind: 'takeover', company: buyer.id, other: target.id, text: `Vous avez racheté ${target.name} pour ${M$(chk.price)} : sa flotte de ${pv.ships} navire(s) rejoint la vôtre.` });
    if (target.human) notes.push({ kind: 'absorbed', company: target.id, other: buyer.id, text: `${buyer.name} a racheté votre compagnie pour ${M$(chk.price)}. Vos actionnaires ont vendu : la partie est finie pour ${target.name}.` });
  }
  return { ok: true, price: chk.price, ships: pv.ships };
}

// Faire une offre : immédiate sur une compagnie de l'ordinateur, annoncée sur une compagnie humaine.
export function makeBid(state, buyerId, targetId, notes = null) {
  const chk = canTakeover(state, buyerId, targetId);
  if (!chk.ok) return { ok: false, msg: chk.why };
  const target = state.companies[targetId], buyer = state.companies[buyerId];
  if (!target.human) return executeTakeover(state, buyerId, targetId, notes);
  const bid = { id: state.nextId++, by: buyerId, target: targetId, price: chk.price, t: state.t, until: state.t + TAKEOVER.bidDays * D, status: 'pending', asked: false };
  (state.bids ??= []).push(bid);
  news(state, `${buyer.name} fait une offre de rachat sur ${target.name} : ${M$(chk.price)}.`, { company: buyer.id, kind: 'event' });
  (notes || (state.queuedNotes ??= [])).push({ kind: 'bid', company: targetId, bidId: bid.id, text: `${buyer.name} propose ${M$(chk.price)} à vos actionnaires pour racheter votre compagnie. Sans réaction, la vente se fera dans ${TAKEOVER.bidDays} jours si l'offre tient toujours.` });
  return { ok: true, bid };
}

// Le dirigeant visé demande six mois à ses actionnaires (une fois par offre).
export function askReprieve(state, rng, bidId) {
  const bid = (state.bids || []).find((b) => b.id === bidId && b.status === 'pending');
  if (!bid) return { ok: false, msg: 'Cette offre n\'est plus sur la table.' };
  if (bid.asked) return { ok: false, msg: 'Vous avez déjà demandé un délai pour cette offre.' };
  const c = state.companies[bid.target];
  const p = reprieveChance(c);
  bid.asked = true;
  if (!rng.chance(p)) return { ok: true, granted: false, chance: p };
  c.reprieve = { until: state.t + TAKEOVER.reprieveDays * D, n: (c.reprieve?.n || 0) + 1 };
  bid.status = 'refused';
  news(state, `Les actionnaires de ${c.name} repoussent l'offre de ${state.companies[bid.by].name} et donnent six mois à leur dirigeant.`, { company: c.id, kind: 'event' });
  return { ok: true, granted: true, chance: p, until: c.reprieve.until };
}
// Le dirigeant visé accepte de vendre tout de suite.
export function acceptBid(state, bidId, notes = null) {
  const bid = (state.bids || []).find((b) => b.id === bidId && b.status === 'pending');
  if (!bid) return { ok: false, msg: 'Cette offre n\'est plus sur la table.' };
  return executeTakeover(state, bid.by, bid.target, notes);
}

// Chaque jour : les offres arrivées à échéance aboutissent (si elles tiennent toujours) ;
// les compagnies humaines rachetables sont prévenues.
export function takeoverDaily(state, notes) {
  for (const bid of state.bids || []) {
    if (bid.status !== 'pending' || bid.until > state.t) continue;
    const chk = canTakeover(state, bid.by, bid.target, { ignoreBid: bid.id });
    if (!chk.ok) {
      bid.status = 'failed';
      const t = state.companies[bid.target], b = state.companies[bid.by];
      if (t.human && !t.bankrupt) notes.push({ kind: 'info', company: t.id, text: `L'offre de rachat de ${b.name} tombe d'elle-même : elle ne tient plus.` });
      continue;
    }
    executeTakeover(state, bid.by, bid.target, notes);
  }
  state.bids = (state.bids || []).filter((b) => b.status === 'pending' || state.t - b.until < 90 * D);
  // Qui pourrait racheter chaque compagnie humaine ? (une note quand ça devient possible)
  for (const c of state.companies) {
    if (!c.human || c.bankrupt) continue;
    const able = state.companies.filter((o) => o !== c && !o.bankrupt && canTakeover(state, o.id, c.id).ok).map((o) => o.id);
    const before = c.buyersSeen || [];
    for (const id of able) if (!before.includes(id)) {
      const o = state.companies[id];
      notes.push({ kind: 'takeoverRisk', company: c.id, other: id, text: `${o.name} a désormais les moyens de racheter votre compagnie (${M$(takeoverPrice(state, c))}). Pour vous protéger : une meilleure réputation (elle multiplie votre prix), un niveau supérieur au sien, ou une valeur nette qui grandit plus vite que sa trésorerie.` });
    }
    c.buyersSeen = able;
  }
}

// ---------- IA ----------
// Une fois par mois : une IA riche rachète un concurrent bon marché (réputation faible), en gardant
// une marge ; plus volontiers si elle est conquérante.
export function aiTakeover(state, rng, company, notes = null) {
  if (company.bankrupt || company.human) return;
  const bold = company.ai?.leaning === 'conquerant';
  if (!rng.chance(bold ? TAKEOVER.aiChance * 2 : TAKEOVER.aiChance)) return;
  const cash = netCash(state, company);
  let best = null;
  for (const t of state.companies) {
    if (t === company || t.bankrupt) continue;
    const chk = canTakeover(state, company.id, t.id);
    if (!chk.ok || cash < chk.price * (bold ? TAKEOVER.aiReserveBold : TAKEOVER.aiReserve)) continue;
    const ratio = chk.price / Math.max(TAKEOVER.minWorth, netWorth(state, t.id));
    if (chk.dismantle) {
      const threat = victoryProgress(state, t, 'shadow').frac >= VICTORY.alerts[0]; // seulement après l'alerte officielle
      if (!(threat || bold)) continue;
      if (!best || chk.price < best.price) best = { t, ratio: 0, price: chk.price };
      continue;
    }
    const pv = takeoverPreview(state, company.id, t.id);
    if (company.ai?.leaning !== 'ombre' && crossesLine(company, pv.infamy - (company.infamy || 0))) continue; // son infamie la mettrait sur la liste noire
    if (ratio > (bold ? TAKEOVER.aiMaxRatioBold : TAKEOVER.aiMaxRatio)) continue;
    if (!best || ratio < best.ratio) best = { t, ratio };
  }
  if (best) makeBid(state, company.id, best.t.id, notes);
}
