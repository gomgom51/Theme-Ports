// Démarchage des chargeurs : quand rien ne convient au port, vos commerciaux proposent le navire
// aux chargeurs (comme un armateur annonce un navire libre). Un à deux jours à quai ; la chance
// de succès dépend du port, de votre réputation, de vos chargeurs fidèles, de votre bureau et des
// « beaux parleurs » de l'équipage. Résultat : un contrat taillé pour ce navire, une piste dans un
// port proche (réservée le temps d'y aller), ou rien. Une fois par escale.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { CLIENTS } from '../data/clients.js';
import { SHIP_TYPES } from '../data/ships.js';
import { HOURS_PER_DAY, clamp, formatDate } from './util.js';
import * as eco from './economy.js';
import { portName, companyOf, shipLog } from './core.js';
import { relationOf } from './clients.js';
import { rank } from './crew.js';

const D = HOURS_PER_DAY;
export const PROSPECT = {
  hours: [24, 48],
  base: 0.1, perSize: 0.06,  // port (taille 1 à 5)
  rep: 0.004,                // par point de réputation au-dessus (ou au-dessous) de 50
  loyalty: 0.03,             // par niveau de fidélité du meilleur chargeur de ce port
  office: 0.04,              // par niveau de bureau
  talk: 0.05,                // par niveau de « beaux parleurs » à bord
  min: 0.08, max: 0.85,
  lead: 0.35,                // part des succès qui sont une piste dans un port proche
  leadNm: 1800,
  pay: 0.95,                 // on est venu le chercher : un fret un peu moins payé
  ai: 0.25,                  // chance qu'un navire IA désœuvré démarche avant de repartir à vide (c'est surtout un outil du joueur)
};

// Chargeurs qui expédient depuis ce port (marchandises exportées), et le plus fidèle d'entre eux.
function portClients(port) {
  const goods = Object.keys(PORTS[port].exp);
  return Object.entries(CLIENTS).filter(([, c]) => c.goods.some((g) => goods.includes(g))).map(([id]) => id);
}
// Ce port expédie-t-il quelque chose que ce navire peut charger ?
export const loadsAt = (port, type) => Object.keys(PORTS[port].exp).some((g) => { const hd = eco.holdFor(type, g); return hd && eco.portHandles(port, hd); });
// Ports proches (pistes) où ce navire peut entrer et charger quelque chose.
function nearbyPorts(state, ctx, ship) {
  const T = SHIP_TYPES[ship.type];
  return PORT_IDS.filter((q) => q !== ship.port && eco.fitsPort(q, ship.type) && loadsAt(q, ship.type))
    .map((q) => ({ q, nm: ctx.distanceInfo(ship.port, q, ctx.closedCanals(state, T.draft, ship))?.nm ?? Infinity }))
    .filter((x) => x.nm <= PROSPECT.leadNm);
}
export function prospectOdds(state, ship, ctx = null) {
  const company = companyOf(state, ship), port = ship.port;
  const here = loadsAt(port, ship.type);
  if (!here && ctx && !nearbyPorts(state, ctx, ship).length) return { p: 0, parts: {}, loyal: 0, here, why: 'Ni ce port ni les ports proches n\'expédient ce que ce navire transporte.' };
  const best = Math.max(0, ...portClients(port).map((id) => relationOf(company, id).loyalty));
  const parts = {
    port: PROSPECT.base + PROSPECT.perSize * PORTS[port].size,
    rep: (company.reputation - 50) * PROSPECT.rep,
    loyalty: best * PROSPECT.loyalty,
    office: (company.level ?? 0) * PROSPECT.office,
    talk: rank(ship, 'negociation') * PROSPECT.talk,
  };
  return { p: clamp(Object.values(parts).reduce((a, b) => a + b, 0), PROSPECT.min, PROSPECT.max), parts, loyal: best, here };
}
// Déjà démarché pendant cette escale ?
export const prospectedHere = (ship) => ship.prospected?.port === ship.port && ship.prospected.trips === (ship.st?.n ?? 0);
export function canProspect(ship) {
  if (ship.status !== 'port' || ship.busyWhat || ship.plan || ship.cargo || ship.dark || ship.seized) return 'Le navire doit être à quai, cales vides et sans ordre en cours.';
  if (prospectedHere(ship)) return 'Vos commerciaux ont déjà démarché les chargeurs pendant cette escale.';
  return null;
}
export function startProspect(state, rng, ship, ctx = null) {
  const why = canProspect(ship);
  if (why) return { ok: false, msg: why };
  const odds = prospectOdds(state, ship, ctx);
  if (odds.why) return { ok: false, msg: odds.why };
  const hours = rng.int(PROSPECT.hours[0], PROSPECT.hours[1]);
  ship.prospected = { port: ship.port, trips: ship.st?.n ?? 0, p: odds.p };
  ship.busyWhat = 'démarchage';
  ship.busyUntil = state.t + hours;
  shipLog(state, ship, `Démarchage des chargeurs à ${portName(ship.port)}`);
  return { ok: true, hours };
}

// Un contrat taillé pour ce navire, au départ de `from`, réservé à la compagnie.
function tailored(state, ctx, rng, ship, from, until) {
  const company = companyOf(state, ship);
  // Les vieux modèles ne servent pas de référence aux contrats : on prend le modèle moderne le plus
  // proche (même type de cale), puis on ramène la quantité à la capacité du navire.
  const T = SHIP_TYPES[ship.type];
  const proxy = T.vintage ? Object.entries(SHIP_TYPES).filter(([, R]) => !R.vintage && R.holds.some((hd) => T.holds.includes(hd)))
    .sort((a, b) => Math.abs(a[1].dwt - T.dwt) - Math.abs(b[1].dwt - T.dwt))[0]?.[0] : ship.type;
  for (let k = 0; k < 10; k++) {
    const c = proxy && eco.makeContract(state, ctx, rng, from, proxy);
    if (!c || !eco.holdFor(ship.type, c.good) || !eco.fitsPort(c.to, ship.type)) continue;
    if (c.qty > T.dwt) { const k2 = Math.floor((T.dwt * 0.95) / 100) * 100 / c.qty; c.qty = Math.floor((T.dwt * 0.95) / 100) * 100; c.pay = Math.round((c.pay * k2) / 1000) * 1000; }
    c.minSpeed = c.minSpeed && T.maxSpeed < c.minSpeed ? 0 : c.minSpeed; // le chargeur a accepté ce navire
    const slow = SHIP_TYPES[proxy].speed / T.speed; // un vieux navire plus lent : le délai suit
    if (slow > 1) c.deadline = Math.round(state.t + (c.deadline - state.t) * slow);
    // Le chargeur : celui de cette marchandise que vous connaissez le mieux.
    const known = Object.entries(CLIENTS).filter(([, x]) => x.goods.includes(c.good)).sort((a, b) => relationOf(company, b[0]).loyalty - relationOf(company, a[0]).loyalty);
    if (known.length) c.client = known[0][0];
    c.pay = Math.round((c.pay * PROSPECT.pay) / 1000) * 1000;
    c.golden = false; c.minRep = 0; c.clientRep = 0; // le chargeur a accepté ce navire
    c.reservedFor = company.id; c.reservedUntil = Math.round(until);
    c.expires = Math.max(c.expires, Math.round(until));
    c.prospect = true;
    return c;
  }
  return null;
}

// Fin du démarchage (appelé quand le navire a fini d'attendre).
export function resolveProspect(state, ctx, rng, ship, notes) {
  const company = companyOf(state, ship), port = ship.port;
  const p = ship.prospected?.p ?? prospectOdds(state, ship).p;
  const say = (text, extra = {}) => { if (company.human) notes.push({ kind: 'prospect', shipId: ship.id, company: company.id, text, ...extra }); };
  if (!rng.chance(p)) { say(`Démarchage à ${portName(port)} : vos commerciaux n'ont rien trouvé pour le ${ship.name} cette fois.`); return null; }
  // Une piste dans un port proche, que le navire peut atteindre (toujours, si rien ne se charge ici).
  if (!loadsAt(port, ship.type) || rng.chance(PROSPECT.lead)) {
    const T = SHIP_TYPES[ship.type];
    const near = nearbyPorts(state, ctx, ship);
    for (let i = near.length - 1; i > 0; i--) { const j = rng.int(0, i); [near[i], near[j]] = [near[j], near[i]]; } // ordre au hasard
    for (const { q, nm } of near) {
      const arrive = state.t + nm / T.speed;
      const c = tailored(state, ctx, rng, ship, q, arrive + 3 * D);
      if (!c) continue;
      state.contracts.push(c);
      say(`Démarchage réussi : ${CLIENTS[c.client]?.name || 'un chargeur'} chargera ${c.qty.toLocaleString('fr-FR')} t de ${GOODS[c.good].name.toLowerCase()} à ${portName(q)} pour ${portName(c.to)}, réservé au ${ship.name} jusqu'au ${formatDate(c.reservedUntil, true)}.`, { contractId: c.id, port: q });
      return c;
    }
  }
  const c = tailored(state, ctx, rng, ship, port, state.t + 2 * D);
  if (!c) { say(`Démarchage à ${portName(port)} : vos commerciaux n'ont rien trouvé pour le ${ship.name} cette fois.`); return null; }
  state.contracts.push(c);
  say(`Démarchage réussi à ${portName(port)} : ${CLIENTS[c.client]?.name || 'un chargeur'} confie au ${ship.name} ${c.qty.toLocaleString('fr-FR')} t de ${GOODS[c.good].name.toLowerCase()} pour ${portName(c.to)} (réservé jusqu'au ${formatDate(c.reservedUntil, true)}).`, { contractId: c.id, port });
  return c;
}
