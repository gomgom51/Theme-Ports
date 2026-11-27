// Avantages du port d'attache : un coup de pouce vers les victoires les moins jouées.
// - Port de l'ombre (port louche d'un pays sous embargo) : vers la flotte fantôme. Les gangs vous
//   connaissent (affaires noires proposées dès le départ), la douane regarde ailleurs chez vous,
//   un refus n'y attire pas d'ennuis, et les colis discrets y sont plus nombreux. Ses handicaps
//   restent : réputation de départ basse, crédit cher, et commercer chez soi marque le navire.
// - Place financière (grand port) : vers « Seul maître à bord ». Banquiers et avocats sur place :
//   un rachat coûte moins cher quand on a la confiance des marchés (0 % à 50, jusqu'à 25 % à 100).
// - Port d'hiver (près des glaces) : chaque navire acheté est livré avec la classe glace, gratuite.
//   Les ports saisonniers en font partie : pris par les glaces en janvier, ils envoient les premiers
//   navires et contrats de la partie au port ouvert le plus proche (START_PORT).
import { PORTS } from '../data/ports.js';
import { EMBARGOED, SHADY_PORTS } from '../data/sanctions.js';
import { standing, netWorth, SHADOW_LENDER } from './core.js';
import { SHIP_TYPES } from '../data/ships.js';
import * as eco from './economy.js';
import { HOURS_PER_DAY, formatDate } from './util.js';
import { hullBarred } from './incidents.js';

export const HOME = {
  hubs: ['rotterdam', 'dubai', 'singapour', 'shanghai', 'new_york', 'houston', 'los_angeles', 'hong_kong'],
  customs: 0.3,        // port de l'ombre : risque de fouille chez soi (colis, cargaisons noires) × 0,3
  parcels: 3,          // port de l'ombre : colis discrets proposés en même temps (2 ailleurs)
  takeoverFrom: 50,    // place financière : la remise sur les rachats part de cette confiance…
  takeoverMax: 0.25,   // … et atteint 25 % à 100
  off: false,          // tests : coupe les avantages (le tempérament des IA suit toujours le port)
  winter: ['murmansk', 'valdez', 'ust_luga', 'gdansk', 'hambourg', 'sabetta', 'prudhoe_bay', 'nome', 'churchill'],
  // Famille d'abord : les ports sans autre atout (pavillons défavorisés).
  family: ['buenos_aires', 'luanda', 'lagos', 'cartagena', 'veracruz', 'arzew', 'durban', 'richards_bay', 'djibouti'],
  familyDays: 5,       // le contrat familial reste réservé ce nombre de jours
  familyDiscount: 0.05, // marchandises achetées 5 % moins cher chez soi
  // Racheter une compagnie d'un pays sous embargo depuis un pays en règle : amende et expulsion.
  embargoFine: 0.5,    // part du prix de rachat
  embargoFineMin: 5e6,
  embargoVirtue: 10,
};
// Ports saisonniers choisis comme port d'attache : où trouver les premiers navires et contrats.
export const START_PORT = { sabetta: 'murmansk', prudhoe_bay: 'valdez', nome: 'valdez', churchill: 'new_york' };
export const startPort = (home) => START_PORT[home] || home;

// 'ombre', 'place' ou null (portKind : la nature du port, même avantages coupés).
export const portKind = (port) => (EMBARGOED[PORTS[port]?.flag] && SHADY_PORTS.includes(port) ? 'ombre' : HOME.hubs.includes(port) ? 'place' : HOME.winter.includes(port) ? 'hiver' : HOME.family.includes(port) ? 'famille' : null);
export const embargoedPort = (port) => !!EMBARGOED[PORTS[port]?.flag];
export const homeKind = (port) => (HOME.off ? null : portKind(port));
export const homeOf = (state, ship) => state?.companies?.[ship?.owner]?.homePort || null;
// Ce port est-il le port de l'ombre de cette compagnie ?
export const shadowHome = (company, port) => !!company && !company.bankrupt && company.homePort === port && homeKind(port) === 'ombre';
// Port d'hiver : la coque de classe glace offerte à chaque navire acheté (d'occasion ou neuf).
export function winterKit(company, ship) {
  if (!company || homeKind(company.homePort) !== 'hiver') return;
  ship.equipment ??= [];
  if (!ship.equipment.includes('glace')) ship.equipment.push('glace');
}
// Remise sur les rachats (0 à 0,25) pour une compagnie basée sur une place financière.
export function takeoverDiscount(company) {
  if (!company || homeKind(company.homePort) !== 'place') return 0;
  const t = standing(company).confidence;
  return HOME.takeoverMax * Math.max(0, Math.min(1, (t - HOME.takeoverFrom) / (100 - HOME.takeoverFrom)));
}

// ---------- Famille d'abord ----------
// Un contrat à la mesure du navire l'attend toujours au port d'attache (si ses cales conviennent aux
// marchandises du port) : créé dès qu'il s'y libère, réservé quelques jours.
export function familyContract(state, ctx, rng, ship) {
  const company = state.companies[ship.owner];
  if (!company || company.bankrupt || homeKind(company.homePort) !== 'famille') return null;
  if (ship.status !== 'port' || ship.port !== company.homePort || ship.cargo || ship.dark || ship.busyWhat) return null;
  const T = SHIP_TYPES[ship.type];
  const fits = (c) => c.from === ship.port && c.takenBy === null && eco.holdFor(ship.type, c.good) && c.qty <= T.dwt && !hullBarred(ship, c.to);
  if (state.contracts.some((c) => fits(c) && c.family && c.reservedFor === company.id && c.reservedUntil > state.t)) return null;
  for (let tries = 0; tries < 8; tries++) {
    const k = eco.makeContract(state, ctx, rng, ship.port, ship.type);
    if (!k || !fits(k)) continue;
    k.reservedFor = company.id;
    k.reservedUntil = state.t + HOME.familyDays * HOURS_PER_DAY;
    k.family = true;
    k.minRep = 0; k.clientRep = 0;
    state.contracts.push(k);
    return k;
  }
  return null;
}
// Le plus grand concurrent d'une compagnie « famille » ne trouve rien chez elle (ni contrat, ni démarchage).
// Renvoie la compagnie dont c'est le port familial, ou null.
export function familyBlocked(state, company, port) {
  if (!company || homeKind(port) !== 'famille') return null;
  for (const x of state.companies) {
    if (x !== company && !x.bankrupt && x.homePort === port && state.familyRival?.[x.id] === company.id) return x;
  }
  return null;
}
// Achats de marchandises au port familial : 5 % moins cher.
export const familyDiscount = (company, port) => (company && company.homePort === port && homeKind(port) === 'famille' ? HOME.familyDiscount : 0);

// ---------- Prêteur de l'ombre (pays sous embargo) ----------
// La banque du pays reste (chère) ; le prêteur de l'ombre est une autre voie, au choix : bon taux tant
// que la compagnie livre SHADOW_LENDER.quota colis discrets avant chaque échéance, sinon le taux de la
// banque jusqu'à ce qu'elle rattrape le quota. On revient à la banque quand on veut.
export function setLender(state, company, on) {
  if (!company) return { ok: false, msg: 'Compagnie introuvable.' };
  if (on && !embargoedPort(company.homePort)) return { ok: false, msg: 'Le prêteur de l\'ombre ne finance que les compagnies installées dans un pays sous embargo.' };
  if (on) company.lender ??= { due: state.t + SHADOW_LENDER.days * HOURS_PER_DAY, done: 0, good: true };
  else delete company.lender;
  return { ok: true };
}
export function lenderParcel(state, company, notes = null) {
  const L = company?.lender;
  if (!L) return;
  L.done++;
  if (!L.good && L.done >= SHADOW_LENDER.quota) {
    L.good = true;
    if (notes && company.human) notes.push({ kind: 'info', company: company.id, text: `Prêteur de l'ombre : colis livrés, votre taux redescend à ${Math.round(SHADOW_LENDER.rate * 100)} % (hors confiance).` });
  }
}

// Une fois par jour : le plus grand concurrent de chaque compagnie « famille », ses contrats
// familiaux, et les échéances du prêteur de l'ombre.
export function homeDaily(state, ctx, rng, notes) {
  state.familyRival ??= {};
  const alive = state.companies.filter((c) => !c.bankrupt);
  for (const x of alive) {
    if (homeKind(x.homePort) !== 'famille') { delete state.familyRival[x.id]; continue; }
    let best = null, bw = -Infinity;
    for (const o of alive) { if (o === x) continue; const w = netWorth(state, o.id); if (w > bw) { bw = w; best = o; } }
    state.familyRival[x.id] = best ? best.id : null;
    for (const ship of state.ships) if (ship.owner === x.id) familyContract(state, ctx, rng, ship);
  }
  for (const c of alive) {
    if (!embargoedPort(c.homePort)) { delete c.lender; continue; }
    if (!c.lender && c.ai?.leaning === 'ombre') setLender(state, c, true); // l'IA de l'ombre choisit le prêteur
    const L = c.lender;
    if (!L || state.t < L.due) continue;
    const ok = L.done >= SHADOW_LENDER.quota;
    L.good = ok; L.done = 0; L.due = state.t + SHADOW_LENDER.days * HOURS_PER_DAY;
    if (c.human) {
      notes.push({ kind: 'info', company: c.id, text: ok
        ? `Prêteur de l'ombre : vos colis ont été livrés, votre taux reste bas. Prochaine échéance le ${formatDate(L.due, true)} (${SHADOW_LENDER.quota} colis).`
        : `Prêteur de l'ombre : pas assez de colis livrés. Votre taux remonte à celui de votre pavillon ; livrez ${SHADOW_LENDER.quota} colis discrets pour le faire redescendre (échéance le ${formatDate(L.due, true)}).` });
    }
  }
}

// ---------- Racheter une compagnie d'un pays sous embargo ----------
// Pour une compagnie basée sur une place financière ($) seulement : amende énorme, et elle est expulsée,
// son siège part au port de la compagnie rachetée (pays sous embargo). Les autres rachètent normalement.
export function embargoPenalty(buyer, target, price) {
  if (!buyer || !target || !embargoedPort(target.homePort) || homeKind(buyer.homePort) !== 'place') return null;
  return { fine: Math.max(HOME.embargoFineMin, Math.round((price * HOME.embargoFine) / 10000) * 10000), port: target.homePort };
}
