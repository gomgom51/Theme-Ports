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
import { money, news, changeReputation, shipLog, shipsOf, portName } from './core.js';
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
  const S = SCANDAL[p.kind];
  p.exposed = true;
  p.until = state.t; // les complices lâchent l'affaire
  if (!p.known.includes(p.target)) p.known.push(p.target);
  changeReputation(by, -S.rep);
  if (S.fine) money(state, by, -S.fine, 'sinistres');
  const what = p.kind === 'pirates' ? `d'avoir payé des pirates contre les navires de ${tg.name} (${zoneById(p.zone).name})` : `d'avoir acheté les autorités de ${portName(p.port)} contre ${tg.name}`;
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
    changeReputation(by, -SCANDAL.poach.rep);
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

// Chaque jour : rumeurs des nouvelles menaces, scandales, messages différés, fin des affaires.
export function plotsDaily(state, notes) {
  for (const p of state.plots || []) {
    if (!p.announced) {
      p.announced = true;
      const tg = state.companies[p.target];
      if (tg?.human) notes.push({ kind: 'threat', company: tg.id, text: threatText(p) });
    }
    if (p.exposeAt && !p.exposed && p.exposeAt <= state.t && p.until > state.t) scandal(state, p);
  }
  state.plots = (state.plots || []).filter((p) => p.until > state.t - 30 * D); // gardées un mois pour mémoire
  if (state.queuedNotes?.length) { notes.push(...state.queuedNotes); state.queuedNotes = []; }
}

// ---------- IA ----------
// Rarement (une fois par mois au plus), une IA à l'aise qui a un navire dans un port louche
// (ou en route vers lui) vise le plus riche de ses concurrents, ou lui débauche un chargeur.
export const AI_PLOT_CHANCE = 0.05, AI_POACH_CHANCE = 0.04;
export function aiPlots(state, rng, company, netWorthOf) {
  if (company.bankrupt || company.cash < 2.5e6) return;
  const rivals = state.companies.filter((c) => c.id !== company.id && !c.bankrupt);
  if (!rivals.length) return;
  const target = rivals.reduce((a, b) => (netWorthOf(b.id) > netWorthOf(a.id) ? b : a));
  if (netWorthOf(target.id) < netWorthOf(company.id) * 0.8) return; // on ne s'attaque pas aux petits
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
}
