// Les affaires noires et leur contraire.
//  Confiance : livrer des colis discrets embarqués dans un port louche sous embargo gagne la
//              confiance des gangs de ce port ; ensuite, ils proposent de « vraies » affaires.
//  Affaires noires (point de non-retour) : armes pour une milice, drogue en quantité
//              industrielle, passagers clandestins. Énormément payées, elles occupent toute la
//              cale (cargos et porte-conteneurs seulement), se cachent mal à la douane et
//              ajoutent de l'infamie : une tache définitive qui abaisse le plafond de réputation.
//  Refus : le gang peut s'emparer du navire ou de l'équipage (rançon, ou abandon), puis garde
//              rancune à la compagnie : ses navires risquent d'être saisis à chaque escale.
//  Conséquences : quelques jours après une livraison, les nouvelles parlent de ce qui est
//              arrivé dans la ville (combats, attentat, overdoses, drame de migrants…), y
//              compris pour les colis ordinaires, dont on ignorait le contenu.
//  Pro bono : après un ouragan ou une catastrophe, des associations cherchent des navires pour
//              l'aide d'urgence : contrats à perte, mais qui rendent de la réputation.
// Tous les risques sont affichés avant la décision (règle n° 1).
import { shadowHome, homeOf } from './home.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES, CREW_LEVELS } from '../data/ships.js';
import { SHADY_PORTS } from '../data/sanctions.js';
import { money, news, changeReputation, changeVirtue, portName, shipLog, shipById, companyOf, costStat, removeShip, repCap, lastTrip } from './core.js';
import { HOURS_PER_DAY, formatDate } from './util.js';
import * as eco from './economy.js';
import { isEmbargoed, detectionChance } from './shady.js';
import { onDarkDone, onStain, onDirty } from './honours.js';
import { closedPort, crossesLine } from './shadow.js';

const D = HOURS_PER_DAY;
const fail = (msg) => ({ ok: false, msg });
const k$ = (v) => `${Math.round(v / 1000).toLocaleString('fr-FR')} k$`;
const M$ = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} M$`;

export const DARK = {
  trust: 2,          // colis livrés depuis ce port avant les affaires noires
  offerChance: 0.6,  // à chaque escale, une fois la confiance gagnée
  cooldown: 25,      // jours entre deux propositions dans le même port
  refuseSeize: 0.3,  // refus : risque qu'ils s'emparent du navire ou de l'équipage
  grudgeDays: 150,   // rancune contre la compagnie après un refus
  grudgeSeize: 0.3,  // risque de saisie à chaque escale pendant la rancune
  detect: 1.7,       // une cargaison entière se cache moins bien qu'un colis
  caughtInfamy: 10,  // scandale public quand la douane trouve la cargaison
  aiAccept: 0.45,    // compagnie IA audacieuse : chance d'accepter
  aiAcceptShadow: 0.75, // compagnie IA de l'ombre (elle vise la flotte fantôme)
  aiMaxDetect: 0.22, // une IA refuse une affaire trop exposée à la douane
};
export const DARK_KINDS = {
  armes: {
    name: 'Armes de guerre pour une milice', icon: '💣', pay: [3e6, 6e6], infamy: 15,
    dests: ['djibouti', 'luanda', 'lagos', 'karachi', 'chittagong', 'es_sider', 'mombasa', 'colon', 'cartagena', 'alexandrie', 'tema', 'abidjan'],
  },
  drogue: {
    name: 'Drogue en quantité industrielle', icon: '💊', pay: [5e6, 10e6], infamy: 15,
    dests: ['rotterdam', 'le_havre', 'hambourg', 'algesiras', 'genes', 'marseille', 'new_york', 'houston', 'los_angeles', 'santos', 'sydney', 'yokohama'],
  },
  migrants: {
    name: 'Passagers clandestins entassés dans la cale', icon: '🚫', pay: [2e6, 4.5e6], infamy: 20,
    dests: ['marseille', 'algesiras', 'genes', 'piree', 'mersin', 'constanta', 'new_york'],
  },
};
export const DARK_IDS = Object.keys(DARK_KINDS);

// ---------- Confiance et propositions ----------
// Port de l'ombre : les gangs de chez vous vous connaissent déjà.
export const trustAt = (company, port) => Math.max(company?.trust?.[port] || 0, shadowHome(company, port) ? DARK.trust : 0);
export const darkPort = (port) => isEmbargoed(port) && SHADY_PORTS.includes(port);
export function addTrust(company, port) {
  if (!darkPort(port)) return;
  (company.trust ??= {})[port] = trustAt(company, port) + 1;
}
// Navire capable : cales de marchandises diverses ou conteneurs, vides.
export const darkCapable = (ship) => SHIP_TYPES[ship.type].holds.some((h) => h === 'divers' || h === 'conteneurs');
export const grudgeAt = (state, company, port) => ((company?.grudge?.[port] || 0) > state.t ? company.grudge[port] : 0);
export const darkDetect = (ship, port, home = null) => Math.min(0.9, detectionChance(ship, port, home) * DARK.detect);

function makeDarkOffer(state, ctx, rng, ship, from) {
  const kind = rng.pick(DARK_IDS), K = DARK_KINDS[kind];
  const owner = companyOf(state, ship);
  const dests = K.dests.filter((p) => p !== from && PORTS[p] && eco.fitsPort(p, ship.type) && ctx.distanceInfo(from, p) && !closedPort(owner, p)); // liste noire : pas vers un port fermé
  if (!dests.length) return null;
  const to = rng.pick(dests), nm = ctx.distanceInfo(from, to).nm;
  const pay = Math.round((rng.range(...K.pay) + (nm / 5000) * 500000) / 10000) * 10000;
  return { id: state.nextId++, kind, from, to, pay, nm: Math.round(nm), deadline: Math.round(state.t + ((nm / (24 * 13)) * 1.5 + 8) * D) };
}
// Escale d'un navire dans un port louche sous embargo : proposition éventuelle (une IA décide
// tout de suite ; pour un joueur, une note ouvre le choix).
export function maybeDarkOffer(state, ctx, rng, ship, port, notes, note) {
  const company = companyOf(state, ship);
  if (!darkPort(port) || trustAt(company, port) < DARK.trust || ship.dark || ship.cargo || ship.contraband || ship.seized || !darkCapable(ship)) return null;
  if (state.t - (company.darkOfferAt?.[port] ?? -1e9) < DARK.cooldown * D || !rng.chance(DARK.offerChance)) return null;
  const o = makeDarkOffer(state, ctx, rng, ship, port);
  if (!o) return null;
  (company.darkOfferAt ??= {})[port] = state.t;
  if (company.human) {
    const n0 = notes.length;
    note(state, notes, 'darkoffer', ship, `À ${portName(port)}, les contacts du ${ship.name} proposent une « vraie » affaire : ${DARK_KINDS[o.kind].name.toLowerCase()} pour ${portName(o.to)}, ${M$(o.pay)}.`);
    if (notes.length > n0) notes[n0].offer = o;
    return o;
  }
  // L'ordinateur : une compagnie audacieuse accepte parfois, les autres refusent (à leurs risques).
  const shadow = company.ai?.leaning === 'ombre';
  const wary = (!shadow && crossesLine(company, DARK_KINDS[o.kind].infamy + DARK.caughtInfamy)) || darkDetect(ship, o.to, company.homePort) > DARK.aiMaxDetect; // trop risqué pour la douane
  if (company.ai?.daring && !wary && rng.chance(shadow ? DARK.aiAcceptShadow : DARK.aiAccept)) acceptDark(state, ship.id, o);
  else refuseDark(state, rng, ship.id, o, notes, note);
  return o;
}

export function acceptDark(state, shipId, o) {
  const ship = shipById(state, shipId);
  if (!ship || ship.status !== 'port' || ship.port !== o.from) return fail('Le navire doit être à quai dans ce port.');
  if (ship.cargo || ship.dark || ship.contraband) return fail('Les cales doivent être vides.');
  if (!darkCapable(ship)) return fail('Il faut des cales de marchandises diverses ou des conteneurs.');
  const company = companyOf(state, ship);
  ship.dark = { ...o };
  company.crossed = true;
  onDirty(state, company);
  company.infamy = (company.infamy || 0) + DARK_KINDS[o.kind].infamy;
  changeReputation(company, 0, 'infamie'); // le plafond baisse
  shipLog(state, ship, `Cargaison noire embarquée pour ${portName(o.to)}`);
  return { ok: true, infamy: company.infamy, cap: repCap(company) };
}
// Ce que coûte un refus dans ce port : null si rien (port de l'ombre de la compagnie : chez vous, on peut
// dire non sans rancune ni saisie). Seule source de vérité, lue par la simulation ET par la fenêtre de
// l'offre (ui/dark.js) : l'écran ne peut plus annoncer un risque qui n'existe pas (règle 1).
export function refusalRisk(company, port) {
  if (shadowHome(company, port)) return null;
  return { seize: DARK.refuseSeize, grudgeDays: DARK.grudgeDays, grudgeSeize: DARK.grudgeSeize };
}
export function refuseDark(state, rng, shipId, o, notes = null, note = null) {
  const ship = shipById(state, shipId);
  if (!ship) return fail('Navire introuvable.');
  const company = companyOf(state, ship);
  const risk = refusalRisk(company, o.from);
  if (!risk) { shipLog(state, ship, `Affaire noire refusée à ${portName(o.from)} (chez vous, sans rancune)`); return { ok: true, seized: null }; }
  (company.grudge ??= {})[o.from] = state.t + risk.grudgeDays * D;
  if (rng.chance(risk.seize)) return { ok: true, seized: seize(state, rng, ship, 'gang', notes, note) };
  shipLog(state, ship, `Affaire noire refusée à ${portName(o.from)}`);
  return { ok: true, seized: null };
}

// ---------- Saisies : gang (navire ou équipage) ou justice (navire) ----------
export function seize(state, rng, ship, by, notes = null, note = null, caught = false) {
  const company = companyOf(state, ship);
  const port = ship.port;
  const kind = by === 'justice' ? 'ship' : rng.chance(0.55) ? 'ship' : 'crew';
  const value = eco.shipValue(state, ship);
  const ransom = Math.round((by === 'justice' ? Math.max(1e6, value * 0.6) : kind === 'ship' ? Math.max(500000, value * 0.35) : 150000 + 120000 * (ship.crew || 0)) / 10000) * 10000;
  ship.seized = { by, kind, port, ransom, t: state.t };
  ship.busyWhat = by === 'justice' ? 'confisqué' : 'otages';
  ship.busyUntil = state.t + 365 * D;
  ship.plan = null;
  const text = by === 'justice'
    ? (caught ? `La justice de ${portName(port)} confisque le ${ship.name} (${company.name}) après la découverte de sa cargaison. Caution pour le récupérer : ${M$(ransom)}.` : `La justice de ${portName(port)} confisque le ${ship.name} (${company.name}). Caution pour le récupérer : ${M$(ransom)}.`)
    : kind === 'ship'
      ? `À ${portName(port)}, des hommes armés s'emparent du ${ship.name} (${company.name}) et de son équipage. Ils réclament ${M$(ransom)}.`
      : `À ${portName(port)}, des hommes armés enlèvent l'équipage du ${ship.name} (${company.name}). Ils réclament ${k$(ransom)}.`;
  news(state, text, { company: company.id, kind: 'disaster' });
  shipLog(state, ship, by === 'justice' ? `Confisqué par la justice à ${portName(port)}` : kind === 'ship' ? `Pris par un gang à ${portName(port)}` : `Équipage enlevé à ${portName(port)}`);
  if (company.human) {
    if (notes && note) { const n0 = notes.length; note(state, notes, 'seized', ship, text); if (notes.length > n0) notes[n0].seized = { ...ship.seized }; }
  } else resolveSeized(state, null, rng, ship.id, company.cash > ransom * 2 ? 'payer' : 'abandonner');
  return ship.seized;
}
// Choix après une saisie : 'payer' (rançon ou caution) ou 'abandonner' (le navire est perdu ;
// pour un équipage enlevé, un nouvel équipage est recruté, sans son expérience).
export function resolveSeized(state, ctx, rng, shipId, choice) {
  const ship = shipById(state, shipId);
  const s = ship?.seized;
  if (!s) return fail('Ce navire n\'est pas retenu.');
  const company = companyOf(state, ship);
  if (choice === 'payer') {
    if (company.cash < s.ransom) return fail(`Il faut ${M$(s.ransom)} en caisse.`);
    money(state, company, -s.ransom, 'sinistres', ship);
    costStat(state, 'rancons', s.ransom);
    ship.seized = null;
    ship.busyUntil = state.t + (s.by === 'justice' ? rng.int(10, 20) : rng.int(2, 5)) * D;
    shipLog(state, ship, s.by === 'justice' ? `Caution versée (${M$(s.ransom)})` : `Rançon versée (${M$(s.ransom)})`);
    return { ok: true, paid: s.ransom };
  }
  if (s.kind === 'crew') {
    ship.seized = null;
    ship.crew = 0; ship.xp = 0; ship.skills = {};
    const hire = 60000;
    money(state, company, -hire, 'divers', ship);
    ship.busyWhat = 'recrutement';
    ship.busyUntil = state.t + 7 * D;
    changeVirtue(company, -8, 'affaires noires'); // des marins abandonnés à leur sort : ça se sait
    shipLog(state, ship, 'Équipage abandonné aux ravisseurs ; nouvel équipage recruté');
    news(state, `${company.name} refuse de payer pour l'équipage du ${ship.name}, enlevé à ${portName(s.port)}.`, { company: company.id, kind: 'disaster' });
    return { ok: true, abandoned: 'crew' };
  }
  if (s.by === 'gang') changeVirtue(company, -8, 'affaires noires');
  news(state, s.by === 'justice' ? `${company.name} abandonne le ${ship.name}, confisqué à ${portName(s.port)}.` : `${company.name} abandonne le ${ship.name} aux mains d'un gang à ${portName(s.port)}.`, { company: company.id, kind: 'disaster' });
  removeShip(state, ctx, ship, 'abandonné');
  return { ok: true, abandoned: 'ship' };
}

// ---------- Escale ----------
// À chaque arrivée : rancune d'un gang (saisie possible), cargaison noire (douane, livraison),
// puis éventuelle proposition. notes/note : pour les joueurs humains.
export function darkOnArrival(state, ctx, rng, ship, port, notes, note) {
  const company = companyOf(state, ship);
  if (grudgeAt(state, company, port) && !ship.seized && rng.chance(DARK.grudgeSeize)) {
    seize(state, rng, ship, 'gang', notes, note);
    return;
  }
  const dk = ship.dark;
  if (dk) {
    if (state.t > dk.deadline) {
      ship.dark = null;
      (company.grudge ??= {})[dk.from] = state.t + DARK.grudgeDays * D;
      if (company.human) note(state, notes, 'info', ship, `La cargaison noire du ${ship.name} arrive trop tard : les acheteurs ne veulent plus en entendre parler, et vos contacts de ${portName(dk.from)} vous en veulent.`);
    } else if (rng.chance(darkDetect(ship, port, homeOf(state, ship)))) {
      ship.dark = null;
      company.infamy = (company.infamy || 0) + DARK.caughtInfamy;
      changeVirtue(company, -25, 'affaires noires');
      onStain(state, company);
      money(state, company, -Math.round(dk.pay * 0.5), 'sinistres', ship);
      costStat(state, 'douane', Math.round(dk.pay * 0.5));
      news(state, `Scandale : la douane de ${portName(port)} découvre à bord du ${ship.name} (${company.name}) ${DARK_KINDS[dk.kind].name.toLowerCase()}. Amende de ${M$(dk.pay * 0.5)}, l'équipage est arrêté.`, { company: company.id, kind: 'disaster' });
      seize(state, rng, ship, 'justice', notes, note, true);
      return;
    } else if (port === dk.to) {
      ship.dark = null;
      money(state, company, dk.pay, 'discret', ship);
      const tr = lastTrip(state, ship);
      if (tr && tr.rev == null) tr.rev = Math.round(dk.pay);
      shipLog(state, ship, `Cargaison noire livrée à ${portName(port)}`);
      onDarkDone(state, company, dk.from);
      if (company.human) {
        const n0 = notes.length;
        note(state, notes, 'paid', ship, `La cargaison noire du ${ship.name} est livrée à ${portName(port)} : ${M$(dk.pay)} en liquide. Personne n'a rien vu.`);
        if (notes.length > n0) Object.assign(notes[n0], { amount: dk.pay, parcel: true, dark: true });
      }
      scheduleAftermath(state, rng, company, port, dk.kind, true);
    }
  }
  maybeDarkOffer(state, ctx, rng, ship, port, notes, note);
}

// ---------- Conséquences dans les nouvelles ----------
// Nature cachée d'un colis ordinaire (le joueur ne la connaît pas en l'acceptant).
export function parcelNature(rng) {
  return rng.weighted([['rien', 60], ['faux_billets', 12], ['drogue', 12], ['armes', 8], ['medicaments', 8]]);
}
const AFTERMATH = {
  armes: [
    'Des combats d\'une rare violence éclatent près de {p} : les miliciens disposaient d\'armes lourdes toutes neuves, arrivées par la mer selon la presse.',
    'Attentat à {p} : une voiture piégée fait de nombreuses victimes. Les enquêteurs remontent la piste d\'explosifs débarqués il y a peu.',
  ],
  drogue: [
    '{p} : les urgences débordent, vague d\'overdoses liée à une drogue très pure arrivée en masse.',
    'Guerre des gangs à {p} après l\'arrivée d\'une énorme quantité de drogue : plusieurs morts dans les quartiers du port.',
  ],
  migrants: [
    'Drame à {p} : des passagers clandestins retrouvés à bout de forces dans la cale d\'un cargo ; plusieurs n\'ont pas survécu.',
    '{p} : des dizaines de migrants débarqués de nuit, aussitôt exploités par des réseaux.',
  ],
  faux_billets: ['{p} : des faux billets de très bonne qualité inondent les commerces du port.'],
  drogue_colis: ['{p} : la police signale une hausse soudaine de la consommation de drogue.'],
  armes_colis: ['Explosion meurtrière à {p} : les enquêteurs parlent d\'un engin fabriqué avec du matériel arrivé récemment.'],
  medicaments: ['{p} : des médicaments contrefaits retrouvés en pharmacie, plusieurs malades hospitalisés.'],
};
export function scheduleAftermath(state, rng, company, port, nature, dark = false) {
  if (!nature || nature === 'rien' || (!dark && !rng.chance(0.7))) return;
  const key = dark ? nature : AFTERMATH[`${nature}_colis`] ? `${nature}_colis` : nature;
  (state.aftermath ??= []).push({ due: state.t + rng.int(dark ? 6 : 5, dark ? 18 : 14) * D, port, key, text: rng.pick(AFTERMATH[key]), company: company.id, delivered: state.t, dark });
}
function aftermathDaily(state, notes) {
  const due = (state.aftermath || []).filter((a) => a.due <= state.t);
  if (!due.length) return;
  state.aftermath = state.aftermath.filter((a) => a.due > state.t);
  for (const a of due) {
    const text = a.text.replace('{p}', portName(a.port));
    news(state, text, { kind: 'disaster' });
    if (state.companies[a.company]?.human) {
      notes.push({ kind: 'aftermath', company: a.company, port: a.port, dark: a.dark, text, hint: a.dark
        ? `C'est votre cargaison, livrée à ${portName(a.port)} le ${formatDate(a.delivered, true)}.`
        : `Le colis livré à ${portName(a.port)} le ${formatDate(a.delivered, true)} y est peut-être pour quelque chose.` });
    }
  }
}

// ---------- Pro bono : aide d'urgence ----------
export const CHARITY = { rep: 6, payShare: 0.45, expires: 6, cooldown: 90, randomRate: 1 / 70, stormNm: 0.5, stormForce: 11 };
export const CHARITIES = ['Fondation Bouée de Secours', 'Les Amarres Solidaires', 'Escales sans frontières'];
const AID_GOODS = [['cereales', 3], ['manufactures', 2], ['raffines', 1]];
// Ports exposés aux catastrophes hors tempêtes, et celles qui leur arrivent vraiment (relief, failles, deltas).
const DISASTER_PORTS = {
  chittagong: ['Inondations', 'Glissements de terrain'], manille: ['Séisme', 'Inondations', 'Glissements de terrain'],
  karachi: ['Inondations', 'Séisme'], jakarta: ['Inondations', 'Séisme'], veracruz: ['Inondations', 'Séisme'],
  valparaiso: ['Séisme', 'Glissements de terrain'], mersin: ['Séisme', 'Inondations'], colombo: ['Inondations', 'Glissements de terrain'],
  ho_chi_minh: ['Inondations'], luanda: ['Inondations', 'Glissements de terrain'],
};

function charityContract(state, ctx, rng, to, charity) {
  for (let tries = 0; tries < 8; tries++) {
    const good = rng.weighted(AID_GOODS);
    const froms = PORT_IDS.filter((p) => p !== to && PORTS[p].size >= 3 && !PORTS[p].ice && (ctx.distanceInfo(p, to)?.nm ?? 1e9) < 4500);
    if (!froms.length) return null;
    const from = rng.pick(froms);
    const types = Object.entries(SHIP_TYPES).filter(([id, T]) => !T.vintage && eco.holdFor(id, good) && eco.portHandles(from, eco.holdFor(id, good)) && eco.portHandles(to, eco.holdFor(id, good)) && eco.fitsPort(from, id) && eco.fitsPort(to, id) && T.dwt <= 60000);
    if (!types.length) continue;
    const [typeId, T] = rng.pick(types);
    const info = ctx.distanceInfo(from, to, ctx.closedCanals(state, T.draft));
    if (!info) continue;
    const qty = Math.round((T.dwt * rng.range(0.4, 0.8)) / 100) * 100;
    const est = eco.voyageEstimate(state, { typeId, flag: null, from, to, qty, hold: eco.holdFor(typeId, good), nm: info.nm, canals: info.canals, age: 8 });
    return {
      id: state.nextId++, from, to, good, qty, hold: eco.holdFor(typeId, good),
      pay: Math.round((est.total * CHARITY.payShare) / 1000) * 1000, urgent: true, minRep: 0, client: null,
      regional: false, big: false, minSpeed: 0, embargo: false, ice: false, golden: false, clientRep: 0,
      reservedFor: null, reservedUntil: 0, charity: { name: charity, rep: CHARITY.rep, t: state.t },
      fuelAtStart: Math.round(eco.worldFuelPrice(state)), priceAtStart: state.market.world[good],
      nm: Math.round(info.nm), deadline: Math.round(state.t + (est.days * 1.15 + 3) * D),
      expires: Math.round(state.t + CHARITY.expires * D), takenBy: null,
    };
  }
  return null;
}
export function disaster(state, ctx, rng, port, cause) {
  state.disasters ??= {};
  if (state.t - (state.disasters[port] ?? -1e9) < CHARITY.cooldown * D) return;
  state.disasters[port] = state.t;
  const charity = rng.pick(CHARITIES);
  let n = 0;
  for (let i = 0; i < rng.int(2, 3); i++) { const c = charityContract(state, ctx, rng, port, charity); if (c) { state.contracts.push(c); n++; } }
  if (!n) return;
  // L'aide part d'autres ports que le port sinistré : on dit lesquels, et jusqu'à quand.
  const aid = state.contracts.filter((c) => c.charity?.t === state.t && c.to === port);
  const froms = [...new Set(aid.map((c) => c.from))];
  const until = Math.max(...aid.map((c) => c.expires));
  news(state, `${cause} à ${portName(port)} : ${charity} cherche des navires pour l'aide d'urgence, au départ de ${froms.map(portName).join(', ')}, jusqu'au ${formatDate(until, true)} (contrats à prix coûtant, partiels).`, { kind: 'event' });
  for (const co of state.companies) {
    if (co.human && !co.bankrupt) (state.queuedNotes ??= []).push({ kind: 'aid', company: co.id, port, froms, until, text: `${cause} à ${portName(port)} : ${charity} cherche des navires au départ de ${froms.map(portName).join(', ')}, jusqu'au ${formatDate(until, true)}.` });
  }
}
// Une fois par jour : conséquences dans les nouvelles, catastrophes et contrats d'aide.
export function darkDaily(state, ctx, rng, notes) {
  aftermathDaily(state, notes);
  for (const s of state.storms || []) {
    if (!/^(Ouragan|Typhon|Cyclone)/.test(s.name) || s.force < CHARITY.stormForce) continue;
    for (const p of PORT_IDS) {
      if (haversine(PORTS[p].lon, PORTS[p].lat, s.lon, s.lat) < s.radius * CHARITY.stormNm) disaster(state, ctx, rng, p, `${s.name} sur la côte`);
    }
  }
  if (rng.chance(CHARITY.randomRate)) {
    const port = rng.pick(Object.keys(DISASTER_PORTS).filter((p) => PORTS[p]));
    disaster(state, ctx, rng, port, rng.pick(DISASTER_PORTS[port]));
  }
}
// Livraison d'une aide d'urgence : réputation (dans la limite du plafond) et bonne presse.
export function charityDelivered(state, company, ship, c, late) {
  if (!c.charity) return;
  if (!late) changeVirtue(company, c.charity.rep, 'aide d\'urgence');
  news(state, `${company.name} achemine l'aide d'urgence de ${c.charity.name} à ${portName(c.to)} avec le ${ship.name}.`, { company: company.id, kind: 'event' });
}

function haversine(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export { CREW_LEVELS };
