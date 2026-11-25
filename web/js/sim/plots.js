// Coups bas entre compagnies.
//  - Pirates payés pour viser les navires d'un concurrent dans une zone (attaques bien plus
//    probables et mieux armées pendant deux mois).
//  - Fonctionnaires achetés dans un port corrompu : les navires du concurrent y sont retenus
//    sans motif sérieux pendant trois mois (un avocat peut les faire libérer vite).
//  - Débauchage d'un chargeur : de l'argent pour qu'il rompe avec son partenaire fidèle.
//  - Informateurs : qui complote contre vous, quels navires rivaux cachent un colis (et
//    dénonciation à la douane, avec une prime si la saisie a lieu).
// Règle du jeu : toute menace laisse filtrer une rumeur chez la victime (zone ou port,
// niveau, comment l'éviter) ; l'informateur dit en plus qui est derrière. Tout coup bas
// peut s'ébruiter : scandale, réputation en chute, amende, et la victime sait.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { CLIENTS } from '../data/clients.js';
import { corruption, SHADY_PORTS } from '../data/sanctions.js';
import { HOURS_PER_DAY } from './util.js';
import { money, news, changeReputation, changeVirtue, shipLog, shipsOf, portName, shipById, fleetValue } from './core.js';
import { formatDate } from './util.js';
import { pointsEarned, pointsSpent, XP_STEPS, SKILL_IDS } from './crew.js';
import * as eco from './economy.js';
import { VICTORY_KINDS, victoryOn, victoryProgress } from './victory.js';
import { relationOf, clientRel, LOYAL } from './clients.js';
import { PIRACY_ZONES, piracyZoneAt } from './piracy.js';
import { onHostile } from './honours.js';

const D = HOURS_PER_DAY;
const k$ = (v) => `${Math.round(v / 1000).toLocaleString('fr-FR')} k$`;
const M$ = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M$`;
export const PIRATE_DAYS = 60;
export const CORRUPT_DAYS = 90;
export const PIRATE_BOOST = 4; // attaques 4 fois plus probables pour les navires visés
export const PIRATE_STRENGTH = 1.5; // et des assaillants mieux armés
export const HELD_CHANCE = 0.75; // probabilité qu'un navire visé soit retenu à l'escale
export const CORRUPT_MIN = 0.15; // corruption minimale d'un port pour y acheter des fonctionnaires
export const EXPOSE = { pirates: 0.25, corruption: 0.2, poach: 0.15 }; // risque que l'affaire s'ébruite
export const SCANDAL = { pirates: { rep: 20, fine: 1.5e6 }, corruption: { rep: 15, fine: 0.8e6 }, poach: { rep: 6, fine: 0 } };
export const TIP_DETECT = 0.8; // fouille quasi certaine d'un navire dénoncé
export const TIP_REWARD = 0.15; // prime de l'informateur : part de l'amende
export const TIP_DAYS = 60;

export const zoneById = (id) => PIRACY_ZONES.find((z) => z.id === id);
export const piratePrice = (zone) => ({ forte: 900000, moyenne: 700000, faible: 500000 }[zone.level] || 700000);
export const corruptiblePorts = () => PORT_IDS.filter((p) => corruption(PORTS[p].flag) > CORRUPT_MIN);
export const corruptPrice = (port) => Math.round((400000 + 600000 * (1 - corruption(PORTS[port].flag))) / 10000) * 10000;
export const intelPrice = (port) => Math.round((60000 + 60000 * (1 - corruption(PORTS[port].flag))) / 10000) * 10000;
export const lawyerPrice = (days) => Math.round((40000 + days * 9000) / 10000) * 10000;
export const canPlotFrom = (port) => SHADY_PORTS.includes(port);

export const activePlots = (state) => (state.plots || []).filter((p) => p.until > state.t);
export const plotsAgainst = (state, cid) => activePlots(state).filter((p) => p.target === cid);
export const plotsBy = (state, cid) => activePlots(state).filter((p) => p.by === cid);
// Pirates payés contre ce navire dans cette zone ?
export function pirateBoost(state, ship, zoneId) {
  return activePlots(state).find((p) => p.kind === 'pirates' && p.target === ship.owner && p.zone === zoneId) || null;
}
// Autorités achetées contre cette compagnie dans ce port ?
export function hostilePort(state, cid, port) {
  return activePlots(state).find((p) => p.kind === 'corruption' && p.target === cid && p.port === port) || null;
}

// Messages différés : ils partent avec la prochaine journée (la victime peut être en train
// de jouer, ou ce peut être une IA).
function queue(state, company, kind, text, extra = {}) {
  if (!company?.human) return;
  (state.queuedNotes ??= []).push({ kind, company: company.id, text, ...extra });
}
// La rumeur ne dit pas qui est derrière : un informateur le peut.
function threatText(p) {
  if (p.kind === 'pirates') return `Rumeurs : des pirates auraient été payés pour viser vos navires dans la zone ${zoneById(p.zone).name}. Les attaques y seraient environ ${PIRATE_BOOST} fois plus probables pendant deux mois. Évitez la zone ou renforcez la défense ; un informateur peut dire qui est derrière.`;
  return `Rumeurs : les autorités de ${portName(p.port)} auraient été achetées contre votre compagnie. Vos navires risquent d'y être retenus sans motif pendant trois mois (environ ${Math.round(HELD_CHANCE * 100)} % des escales). Évitez ce port ; un informateur peut dire qui est derrière.`;
}

// Commander un coup bas. kind : 'pirates' (zone) ou 'corruption' (port).
export function orderPlot(state, rng, byId, { kind, target, zone, port }) {
  const by = state.companies[byId], tg = state.companies[target];
  if (!by || !tg || tg.bankrupt || target === byId) return { ok: false, msg: 'Cible invalide.' };
  let price;
  if (kind === 'pirates') { const z = zoneById(zone); if (!z) return { ok: false, msg: 'Zone inconnue.' }; price = piratePrice(z); }
  else if (kind === 'corruption') { if (!corruptiblePorts().includes(port)) return { ok: false, msg: 'Ces fonctionnaires ne se laissent pas acheter.' }; price = corruptPrice(port); }
  else return { ok: false, msg: 'Commande inconnue.' };
  if (by.cash < price) return { ok: false, msg: `Il faut ${k$(price)} en caisse.` };
  // Une seule affaire à la fois contre la même cible au même endroit (quel qu'en soit le commanditaire).
  if (activePlots(state).some((p) => p.target === target && p.kind === kind && (kind === 'pirates' ? p.zone === zone : p.port === port))) return { ok: false, msg: 'Quelqu\'un s\'en occupe déjà : la zone ne prend pas deux fois la même commande.' };
  money(state, by, -price, 'divers');
  onHostile(state, by, tg);
  const days = kind === 'pirates' ? PIRATE_DAYS : CORRUPT_DAYS;
  const plot = {
    id: state.nextId++, kind, by: byId, target, zone: zone || null, port: port || null,
    start: state.t, until: state.t + days * D, exposeAt: rng.chance(EXPOSE[kind]) ? state.t + rng.int(5, days - 5) * D : 0,
    known: [byId], announced: false, price,
  };
  (state.plots ??= []).push(plot);
  return { ok: true, plot, price };
}

// Scandal : l'affaire s'ébruite.
function scandal(state, p) {
  const by = state.companies[p.by], tg = state.companies[p.target];
  const S = SCANDAL[p.kind] || ATTACKS[p.kind].scandal;
  p.exposed = true;
  p.until = state.t; // les complices lâchent l'affaire
  if (!p.known.includes(p.target)) p.known.push(p.target);
  changeVirtue(by, -S.rep);
  if (S.fine) money(state, by, -S.fine, 'sinistres');
  if (p.kind === 'bank' && tg.creditCut?.plot === p.id) tg.creditCut = null;
  const sh = p.ship != null ? shipById(state, p.ship) : null;
  const what = {
    pirates: () => `d'avoir payé des pirates contre les navires de ${tg.name} (${zoneById(p.zone).name})`,
    corruption: () => `d'avoir acheté les autorités de ${portName(p.port)} contre ${tg.name}`,
    sabotage: () => `d'avoir fait saboter le ${sh?.name || 'navire'} de ${tg.name}`,
    payments: () => `d'avoir demandé à ${CLIENTS[p.client]?.name || 'un chargeur'} de retarder les paiements de ${tg.name}`,
    bank: () => `d'avoir fait pression sur la banque de ${tg.name}`,
    pricewar: () => `de casser les prix à ${portName(p.port)} pour ruiner ${tg.name}`,
    smear: () => `d'avoir payé une campagne de dénigrement contre ${tg.name}`,
    crew: () => `d'avoir débauché l'équipage du ${sh?.name || 'navire'} de ${tg.name}`,
  }[p.kind]();
  news(state, `Scandale : ${by.name} est accusé ${what}.`, { company: by.id, kind: 'disaster' });
  queue(state, by, 'scandal', S.fine ? `Scandale : votre coup contre ${tg.name} a été découvert. Réputation −${S.rep} et amende de ${M$(S.fine)}.` : `Scandale : votre coup contre ${tg.name} a été découvert. Réputation −${S.rep}.`);
  queue(state, tg, 'info', `On sait désormais qui vous visait : ${by.name}. L'affaire a fait scandale et ses complices ont renoncé.`);
}

// Escale dans un port acheté par un concurrent : retenue abusive ?
export function heldOnArrival(state, rng, ship, port) {
  const p = hostilePort(state, ship.owner, port);
  if (!p || !rng.chance(HELD_CHANCE)) return null;
  const days = rng.int(6, 14);
  return { hours: days * 24, days, lawyer: lawyerPrice(days), port, plot: p.id };
}
// Payer un avocat : le navire repart sous 24 heures.
export function hireLawyer(state, shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return { ok: false, msg: 'Navire introuvable.' };
  const company = state.companies[ship.owner];
  const pending = ship.heldBogus, active = ship.busyWhat === 'retenue';
  if (!pending && !active) return { ok: false, msg: 'Ce navire n\'est pas retenu.' };
  const price = pending ? pending.lawyer : ship.lawyer || lawyerPrice(Math.ceil((ship.busyUntil - state.t) / 24));
  money(state, company, -price, 'divers');
  if (pending) pending.hours = Math.min(pending.hours, 24);
  if (active) ship.busyUntil = Math.min(ship.busyUntil, state.t + 24);
  ship.lawyer = null;
  shipLog(state, ship, `Avocat payé (${k$(price)}) : libération sous 24 h`);
  return { ok: true, price };
}

// Débaucher un chargeur : il rompt avec son partenaire le plus fidèle (s'il n'est pas vous).
export function topPartner(state, clientId, exceptId = -1) {
  let best = null;
  for (const c of state.companies) {
    if (c.bankrupt || c.id === exceptId) continue;
    const r = relationOf(c, clientId);
    if (r.loyalty >= LOYAL && (!best || r.loyalty > best.loyalty)) best = { id: c.id, loyalty: r.loyalty };
  }
  return best;
}
// Les partenariats sont publics : les compagnies adorent les annoncer.
export function officialPartners(state, clientId) {
  return state.companies.filter((c) => !c.bankrupt && relationOf(c, clientId).loyalty >= LOYAL)
    .sort((a, b) => relationOf(b, clientId).loyalty - relationOf(a, clientId).loyalty);
}
export function poachPrice(state, clientId, loyalty) {
  return Math.round(((150000 + 60000 * loyalty) * clientRel(state, clientId) / 70) / 10000) * 10000;
}
export function poachClient(state, rng, byId, clientId) {
  const by = state.companies[byId], C = CLIENTS[clientId];
  const tp = topPartner(state, clientId, byId);
  if (!by || !C || !tp) return { ok: false, msg: 'Ce chargeur n\'a pas de partenaire à qui le prendre.' };
  const price = poachPrice(state, clientId, tp.loyalty);
  if (by.cash < price) return { ok: false, msg: `Il faut ${k$(price)} en caisse.` };
  const rival = state.companies[tp.id];
  money(state, by, -price, 'divers');
  onHostile(state, by, rival);
  rival.clients[clientId].loyalty = 0;
  for (const c of state.contracts) if (c.client === clientId && c.reservedFor === rival.id && c.takenBy === null) { c.reservedFor = null; c.reservedUntil = 0; }
  by.clients ??= {};
  const mine = (by.clients[clientId] ??= { loyalty: 0, deliveries: 0, grudgeUntil: 0, incidents: 0 });
  mine.loyalty = Math.min(10, mine.loyalty + 2);
  const leaked = rng.chance(EXPOSE.poach);
  if (leaked) {
    changeVirtue(by, -SCANDAL.poach.rep);
    news(state, `${by.name} aurait versé des fonds à ${C.name} pour lui faire rompre son partenariat avec ${rival.name}.`, { company: by.id, kind: 'event' });
    queue(state, rival, 'info', `${C.name} rompt son partenariat avec vous : ${by.name} l'a acheté, l'affaire s'est ébruitée.`);
    queue(state, by, 'scandal', `L'affaire avec ${C.name} s'est ébruitée : réputation −${SCANDAL.poach.rep}.`);
  } else {
    queue(state, rival, 'info', `${C.name} rompt son partenariat avec vous : une offre plus généreuse, dit-on.`);
  }
  return { ok: true, price, rival: rival.id, leaked };
}

// Informateur (il faut un navire dans ce port) : complots contre vous et navires rivaux qui cachent un colis.
export function buyIntel(state, cid, port) {
  const company = state.companies[cid];
  if (!shipsOf(state, cid).some((s) => s.status === 'port' && s.port === port)) return { ok: false, msg: 'Il faut un navire à quai dans ce port.' };
  const price = intelPrice(port);
  if (company.cash < price) return { ok: false, msg: `Il faut ${k$(price)} en caisse.` };
  money(state, company, -price, 'divers');
  const plots = plotsAgainst(state, cid);
  for (const p of plots) if (!p.known.includes(cid)) p.known.push(cid);
  const traffickers = state.ships.filter((s) => s.owner !== cid && s.contraband && !state.companies[s.owner].bankrupt)
    .map((s) => ({ shipId: s.id, name: s.name, company: s.owner, to: s.contraband.to, next: s.voyage?.to || s.port, tipped: !!(s.tip && s.tip.until > state.t) }));
  company.intel = { t: state.t, port, plots: plots.map((p) => p.id), traffickers };
  return { ok: true, price, plots, traffickers };
}
// Dénoncer un navire rival à la douane : fouille quasi certaine à ses prochaines escales.
export function tipOff(state, cid, shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship?.contraband || ship.owner === cid) return { ok: false, msg: 'Ce navire ne transporte plus rien de suspect.' };
  ship.tip = { by: cid, until: state.t + TIP_DAYS * D };
  queue(state, state.companies[ship.owner], 'threat', `Rumeurs : quelqu'un aurait parlé à la douane du colis caché à bord du ${ship.name}. Il sera presque sûrement fouillé à sa prochaine escale (environ ${Math.round(TIP_DETECT * 100)} %). Vous pouvez jeter le colis par-dessus bord.`, { shipId: ship.id });
  return { ok: true };
}
export const tipped = (state, ship) => !!(ship.tip && ship.tip.until > state.t);
// Saisie d'un navire dénoncé : la prime revient à l'informateur.
export function tipReward(state, ship, fine) {
  if (!tipped(state, ship)) return;
  const by = state.companies[ship.tip.by];
  ship.tip = null;
  if (!by || by.bankrupt) return;
  const reward = Math.round(fine * TIP_REWARD / 1000) * 1000;
  money(state, by, reward, 'divers');
  queue(state, by, 'paid', `Votre tuyau a payé : la douane a saisi le colis du ${ship.name}. Prime d'informateur : ${k$(reward)}.`, { amount: reward });
}
export function jettison(state, shipId) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship?.contraband) return { ok: false, msg: 'Pas de colis à bord.' };
  ship.contraband = null;
  ship.tip = null;
  shipLog(state, ship, 'Colis jeté par-dessus bord');
  return { ok: true };
}

// ---------- Coups de concurrence (Bureau → Concurrents) et sabotage (la zone) ----------
// Chacun coûte de la réputation à coup sûr (le milieu jase), peut s'ébruiter (scandale), et laisse
// filtrer une rumeur chez la victime : ce qui la menace, jusqu'à quand, et comment parer (règle n° 1).
export const ATTACKS = {
  sabotage: { name: 'Sabotage d\'un navire', days: 45, rep: 3, expose: 0.25, scandal: { rep: 12, fine: 600000 }, minLevel: 0 },
  payments: { name: 'Paiements retardés', days: 90, rep: 2, expose: 0.2, scandal: { rep: 8, fine: 0 }, minLevel: 1 },
  bank: { name: 'Pression sur sa banque', days: 180, rep: 4, expose: 0.3, scandal: { rep: 12, fine: 1000000 }, minLevel: 2 },
  pricewar: { name: 'Guerre des prix', days: 60, rep: 2, expose: 0.15, scandal: { rep: 6, fine: 0 }, minLevel: 1 },
  smear: { name: 'Campagne de dénigrement', days: 56, rep: 3, expose: 0.3, scandal: { rep: 10, fine: 0 }, minLevel: 1 },
  crew: { name: 'Débauchage d\'équipage', days: 14, rep: 2, expose: 0.2, scandal: { rep: 6, fine: 0 }, minLevel: 0 },
};
export const SABOTAGE_DAMAGE = [12, 22]; // points d'état perdus
export const SABOTAGE_DELAY = [2, 6];    // jours avant le coup (à la prochaine escale si le navire est en mer)
export const PRICEWAR_CUT = 0.2;         // fret 20 % moins payé pour la victime dans ce port
export const BANK_CUT = 0.5;             // plafond de crédit divisé par deux
export const SMEAR_WEEKLY = 1;           // réputation perdue chaque semaine
export const PAYMENT_DELAY = [40, 75];   // jours de retard imposés par le chargeur
export const CREW_DELAY = 7;
const round10k = (v) => Math.round(v / 10000) * 10000;
export function attackPrice(state, kind, { target, ship, port } = {}) {
  const tg = state.companies[target];
  const sh = ship != null ? shipById(state, ship) : null;
  if (kind === 'sabotage') return round10k(250000 + 0.015 * (sh ? eco.shipValue(state, sh) : 0));
  if (kind === 'payments') return 200000;
  if (kind === 'bank') return round10k(Math.max(300000, 0.006 * fleetValue(state, target)));
  if (kind === 'pricewar') return round10k(300000 + 80000 * (PORTS[port]?.size || 3));
  if (kind === 'smear') return round10k(250000 + 1000 * (tg?.reputation || 50));
  if (kind === 'crew') return round10k(120000 + 60000 * (sh ? pointsEarned(sh) : 1));
  return 0;
}
export function counterPrice(state, p) {
  if (p.kind === 'sabotage') { const sh = shipById(state, p.ship); return round10k(Math.max(40000, 0.008 * (sh ? eco.shipValue(state, sh) : 0))); }
  if (p.kind === 'payments') return 100000;
  if (p.kind === 'bank') return round10k(100000 + 0.01 * (state.companies[p.target]?.debt || 0));
  if (p.kind === 'pricewar') return round10k(p.price * 0.5);
  if (p.kind === 'smear') return 150000;
  if (p.kind === 'crew') { const sh = shipById(state, p.ship); return round10k(80000 * Math.max(1, sh ? pointsEarned(sh) : 1)); }
  return 0;
}
export const ATTACK_KINDS = Object.keys(ATTACKS);
// Effets en cours, lus par la simulation.
export function payCut(state, cid, port) {
  return activePlots(state).some((p) => p.kind === 'pricewar' && p.target === cid && p.port === port && !p.countered) ? 1 - PRICEWAR_CUT : 1;
}
export const priceWarAt = (state, cid, port) => activePlots(state).find((p) => p.kind === 'pricewar' && p.target === cid && p.port === port && !p.countered) || null;
export function stalledBy(state, cid, client) {
  return activePlots(state).find((p) => p.kind === 'payments' && p.target === cid && p.client === client && !p.countered) || null;
}
// Peut-on lancer ce coup ? (raison sinon)
export function attackCheck(state, byId, kind, { target, ship, client, port, toShip } = {}) {
  const by = state.companies[byId], tg = state.companies[target], A = ATTACKS[kind];
  if (!A || !by || !tg || tg.bankrupt || target === byId) return 'Cible invalide.';
  if ((by.level ?? 0) < A.minLevel) return `Il faut être au niveau ${A.minLevel + 1} pour cela.`;
  if (kind === 'bank' && (by.level ?? 0) < (tg.level ?? 0)) return 'Sa banque ne vous écoutera pas : sa compagnie est d\'un niveau supérieur au vôtre.';
  if (kind === 'sabotage' || kind === 'crew') { const sh = shipById(state, ship); if (!sh || sh.owner !== target) return 'Navire introuvable.'; }
  if (kind === 'sabotage' && !shipsOf(state, byId).some((s) => s.status === 'port' && canPlotFrom(s.port))) return 'Il faut un navire à quai dans un port où opère la zone.';
  if (kind === 'crew') { const sh = shipById(state, ship), mine = shipById(state, toShip); if (!pointsEarned(sh)) return 'Cet équipage n\'a pas encore d\'expérience à débaucher.'; if (!mine || mine.owner !== byId) return 'Choisissez un de vos navires pour les accueillir.'; if (pointsEarned(mine) >= XP_STEPS.length) return 'Votre équipage est déjà au sommet.'; }
  if (kind === 'payments' && relationOf(by, client).loyalty < LOYAL) return 'Seul un chargeur dont vous êtes le partenaire fidèle acceptera de vous rendre ce service.';
  if (kind === 'pricewar' && !PORTS[port]) return 'Port inconnu.';
  const same = activePlots(state).find((p) => p.kind === kind && p.target === target && (p.ship ?? null) === (ship ?? null) && (p.port ?? null) === (port ?? null) && (p.client ?? null) === (client ?? null));
  if (same) return 'Une affaire de ce genre le vise déjà.';
  if (by.cash < attackPrice(state, kind, { target, ship, port })) return `Il faut ${k$(attackPrice(state, kind, { target, ship, port }))} en caisse.`;
  return null;
}
export function orderAttack(state, rng, byId, opts) {
  const { kind, target, ship = null, client = null, port = null, toShip = null } = opts;
  const why = attackCheck(state, byId, kind, opts);
  if (why) return { ok: false, msg: why };
  const by = state.companies[byId], tg = state.companies[target], A = ATTACKS[kind];
  const price = attackPrice(state, kind, opts);
  money(state, by, -price, 'divers');
  changeVirtue(by, -A.rep); // le milieu jase, même sans preuve
  onHostile(state, by, tg);
  const strikeAt = kind === 'sabotage' ? state.t + rng.int(SABOTAGE_DELAY[0], SABOTAGE_DELAY[1]) * D : kind === 'crew' ? state.t + CREW_DELAY * D : 0;
  const plot = {
    id: state.nextId++, kind, by: byId, target, ship, client, port, toShip, strikeAt,
    start: state.t, until: state.t + A.days * D, exposeAt: rng.chance(A.expose) ? state.t + rng.int(3, Math.max(4, A.days - 3)) * D : 0,
    known: [byId], announced: false, price,
  };
  plot.counter = counterPrice(state, plot);
  if (kind === 'bank') tg.creditCut = { until: plot.until, k: BANK_CUT, plot: plot.id };
  (state.plots ??= []).push(plot);
  return { ok: true, plot, price };
}
// La victime pare le coup (gardes, recouvrement, autre banque, riposte, contre-campagne, prime).
export function counterPlot(state, cid, plotId) {
  const p = activePlots(state).find((x) => x.id === plotId && x.target === cid);
  if (!p || !p.counter) return { ok: false, msg: 'Rien à parer.' };
  const c = state.companies[cid];
  if (c.cash < p.counter) return { ok: false, msg: `Il faut ${k$(p.counter)} en caisse.` };
  money(state, c, -p.counter, 'divers');
  p.countered = true;
  p.until = state.t;
  if (p.kind === 'bank' && c.creditCut?.plot === p.id) c.creditCut = null;
  if (p.kind === 'sabotage') { const sh = shipById(state, p.ship); if (sh) sh.guardUntil = state.t + 30 * D; }
  queue(state, state.companies[p.by], 'info', `${c.name} a paré votre coup (${ATTACKS[p.kind].name.toLowerCase()}).`);
  return { ok: true, price: p.counter };
}
// Rumeur chez la victime : quoi, jusqu'à quand, comment parer.
export function attackRumour(state, p) {
  const until = formatDate(p.until, true), parry = k$(p.counter);
  const sh = p.ship != null ? shipById(state, p.ship) : null;
  if (p.kind === 'sabotage') return `Rumeurs : quelqu'un rôderait autour du ${sh?.name || 'navire'}. Sabotage possible à sa prochaine escale (${SABOTAGE_DAMAGE[0]} à ${SABOTAGE_DAMAGE[1]} points d'état perdus). Des gardes à bord pour un mois : ${parry}.`;
  if (p.kind === 'payments') return `Rumeurs : ${CLIENTS[p.client]?.name || 'un chargeur'} aurait promis à un concurrent de faire traîner vos paiements jusqu'au ${until} (${PAYMENT_DELAY[0]} à ${PAYMENT_DELAY[1]} jours de retard). Évitez ses contrats, ou mandatez un cabinet de recouvrement : ${parry}.`;
  if (p.kind === 'bank') return `Votre banque réexamine votre dossier après des pressions : plafond de crédit divisé par deux jusqu'au ${until}. Passer chez une autre banque : ${parry}.`;
  if (p.kind === 'pricewar') return `Guerre des prix à ${portName(p.port)} : un concurrent casse les prix, les chargeurs vous paient ${Math.round(PRICEWAR_CUT * 100)} % de moins jusqu'au ${until}. Riposte commerciale : ${parry}.`;
  if (p.kind === 'smear') return `Une campagne de presse vous dénigre : environ ${SMEAR_WEEKLY} point de réputation perdu chaque semaine jusqu'au ${until}. Contre-campagne : ${parry}.`;
  if (p.kind === 'crew') return `Des recruteurs approchent l'équipage du ${sh?.name || 'navire'} : sans geste de votre part, ses meilleurs éléments partiront d'ici le ${formatDate(p.strikeAt, true)} (un point d'expérience perdu). Prime de fidélité : ${parry}.`;
  return '';
}
// Effets à date : sabotage, débauchage, dénigrement.
function attackEffects(state, rng, p, notes) {
  const tg = state.companies[p.target], by = state.companies[p.by];
  if (p.kind === 'smear') {
    const week = Math.floor((state.t - p.start) / (7 * D));
    if (week > (p.week || 0)) { p.week = week; changeReputation(tg, -SMEAR_WEEKLY); } // la presse touche les deux notes
  }
  if (!p.strikeAt || p.done || state.t < p.strikeAt) return;
  const sh = shipById(state, p.ship);
  if (!sh || sh.owner !== p.target) { p.done = true; p.until = state.t; return; }
  if (p.kind === 'sabotage') {
    if (sh.guardUntil > state.t) {
      p.done = true; p.until = state.t;
      queue(state, tg, 'info', `Les gardes du ${sh.name} ont surpris un saboteur : rien n'a été abîmé.`);
      queue(state, by, 'info', `Votre saboteur a été surpris à bord du ${sh.name} : le coup a échoué.`);
      return;
    }
    if (sh.status !== 'port') return; // il attend la prochaine escale
    const dmg = rng.int(SABOTAGE_DAMAGE[0], SABOTAGE_DAMAGE[1]);
    sh.condition = Math.max(25, sh.condition - dmg);
    shipLog(state, sh, `Sabotage à ${portName(sh.port)} : ${dmg} points d'état perdus`);
    p.done = true; p.until = state.t;
    if (tg.human) notes.push({ kind: 'sabotage', company: tg.id, shipId: sh.id, text: `Sabotage à bord du ${sh.name} à ${portName(sh.port)} : ${dmg} points d'état perdus. Un chantier peut le remettre en état.` });
    queue(state, by, 'info', `Votre saboteur a frappé : le ${sh.name} (${tg.name}) perd ${dmg} points d'état.`);
  } else if (p.kind === 'crew') {
    const k = pointsEarned(sh);
    p.done = true; p.until = state.t;
    if (!k) return;
    sh.xp = k >= 2 ? XP_STEPS[k - 2] : 0;
    while (pointsSpent(sh) > pointsEarned(sh)) { const id = SKILL_IDS.filter((x) => (sh.skills?.[x] || 0) > 0).sort((a, b) => sh.skills[b] - sh.skills[a])[0]; if (!id) break; sh.skills[id]--; }
    const mine = shipById(state, p.toShip);
    if (mine && mine.owner === p.by) { const m = pointsEarned(mine); if (m < XP_STEPS.length) mine.xp = Math.max(mine.xp || 0, XP_STEPS[m]); }
    if (tg.human) notes.push({ kind: 'info', company: tg.id, shipId: sh.id, text: `Les meilleurs marins du ${sh.name} ont été débauchés par un concurrent : l'équipage perd un point d'expérience.` });
    queue(state, by, 'info', `Les marins débauchés du ${sh.name} ont rejoint ${mine ? `le ${mine.name}` : 'votre flotte'}.`);
  }
}

// Chaque jour : rumeurs des nouvelles menaces, scandales, messages différés, fin des affaires.
export function plotsDaily(state, notes, rng = null) {
  for (const p of state.plots || []) {
    if (!p.announced) {
      p.announced = true;
      const tg = state.companies[p.target];
      if (tg?.human) notes.push({ kind: 'threat', company: tg.id, plotId: p.id, shipId: p.ship ?? undefined, text: ATTACKS[p.kind] ? attackRumour(state, p) : threatText(p) });
    }
    if (ATTACKS[p.kind] && p.until > state.t && rng) attackEffects(state, rng, p, notes);
    if (p.exposeAt && !p.exposed && p.exposeAt <= state.t && p.until > state.t) scandal(state, p);
  }
  for (const c of state.companies) if (c.creditCut && c.creditCut.until <= state.t) c.creditCut = null;
  state.plots = (state.plots || []).filter((p) => p.until > state.t - 30 * D); // gardées un mois pour mémoire
  if (state.queuedNotes?.length) { notes.push(...state.queuedNotes); state.queuedNotes = []; }
}

// ---------- IA ----------
// Rarement (une fois par mois au plus), une IA à l'aise qui a un navire dans un port louche
// (ou en route vers lui) vise le plus riche de ses concurrents, ou lui débauche un chargeur.
export const AI_PLOT_CHANCE = 0.05, AI_POACH_CHANCE = 0.04, AI_ATTACK_CHANCE = 0.06, AI_COUNTER = 8;
// Le concurrent à abattre : celui qui approche d'une victoire, sinon le plus riche.
function aiTarget(state, company, rivals, netWorthOf) {
  if (company.ai?.leaning === 'conquerant') {
    const prey = rivals.filter((c) => (c.level ?? 0) <= (company.level ?? 0)).sort((a, b) => netWorthOf(a.id) * (1 + a.reputation / 50) - netWorthOf(b.id) * (1 + b.reputation / 50))[0];
    if (prey) return prey;
  }
  let lead = null;
  for (const c of rivals) for (const k of VICTORY_KINDS) {
    if (!victoryOn(state, k)) continue;
    const f = victoryProgress(state, c, k).frac;
    if (f >= 0.6 && (!lead || f > lead.f)) lead = { c, f };
  }
  if (lead) return lead.c;
  const rich = rivals.reduce((a, b) => (netWorthOf(b.id) > netWorthOf(a.id) ? b : a));
  return netWorthOf(rich.id) >= netWorthOf(company.id) * 0.8 ? rich : null; // on ne s'attaque pas aux petits
}
export function aiPlots(state, rng, company, netWorthOf) {
  if (company.bankrupt) return;
  // Parer ce qui la vise, quand elle en a largement les moyens.
  for (const p of plotsAgainst(state, company.id)) {
    if (p.counter && !p.countered && company.cash > p.counter * AI_COUNTER && rng.chance(0.6)) counterPlot(state, company.id, p.id);
  }
  if (company.cash < 2.5e6 || company.ai?.leaning === 'vertueux') return; // un vertueux pare, mais n'attaque pas
  const rivals = state.companies.filter((c) => c.id !== company.id && !c.bankrupt);
  if (!rivals.length) return;
  const target = aiTarget(state, company, rivals, netWorthOf);
  if (!target) return;
  const bold = company.ai?.leaning === 'conquerant';
  const inShady = shipsOf(state, company.id).some((s) => canPlotFrom(s.status === 'port' ? s.port : s.voyage?.to));
  if (inShady && rng.chance(AI_PLOT_CHANCE)) {
    // Une zone de piraterie où se rendent ses navires, sinon un port corrompu où il va.
    const dests = shipsOf(state, target.id).map((s) => s.voyage?.to).filter(Boolean);
    const zone = dests.map((p) => piracyZoneAt(PORTS[p].lon, PORTS[p].lat)).find(Boolean);
    const port = dests.find((p) => corruptiblePorts().includes(p));
    if (zone && company.cash > piratePrice(zone) * 3) orderPlot(state, rng, company.id, { kind: 'pirates', target: target.id, zone: zone.id });
    else if (port && company.cash > corruptPrice(port) * 3) orderPlot(state, rng, company.id, { kind: 'corruption', target: target.id, port });
  }
  if (rng.chance(AI_POACH_CHANCE)) {
    const ids = Object.keys(CLIENTS).filter((id) => { const tp = topPartner(state, id, company.id); return tp && tp.id === target.id && tp.loyalty >= 6; });
    if (ids.length) poachClient(state, rng, company.id, rng.pick(ids));
  }
  // Coups de concurrence : un au plus par mois, choisi selon ce qui est possible.
  if (!rng.chance(bold ? AI_ATTACK_CHANCE * 3 : AI_ATTACK_CHANCE)) return;
  const theirs = shipsOf(state, target.id);
  const options = [];
  if (target.reputation >= 60) options.push({ kind: 'smear', target: target.id });
  const busy = theirs.map((s) => s.voyage?.to || s.port).filter(Boolean);
  if (busy.length) options.push({ kind: 'pricewar', target: target.id, port: rng.pick(busy) });
  options.push({ kind: 'bank', target: target.id });
  const loyal = Object.keys(CLIENTS).filter((id) => relationOf(company, id).loyalty >= LOYAL && relationOf(target, id).deliveries > 0);
  if (loyal.length) options.push({ kind: 'payments', target: target.id, client: rng.pick(loyal) });
  const rich = theirs.filter((s) => s.status === 'port').sort((a, b) => eco.shipValue(state, b) - eco.shipValue(state, a))[0];
  if (rich) options.push({ kind: 'sabotage', target: target.id, ship: rich.id });
  const vet = theirs.filter((s) => pointsEarned(s) >= 2)[0], mine = shipsOf(state, company.id).filter((s) => pointsEarned(s) < XP_STEPS.length)[0];
  if (vet && mine) options.push({ kind: 'crew', target: target.id, ship: vet.id, toShip: mine.id });
  const ok = options.filter((o) => !attackCheck(state, company.id, o.kind, o) && company.cash > attackPrice(state, o.kind, o) * 4);
  if (ok.length) orderAttack(state, rng, company.id, rng.pick(ok));
}
