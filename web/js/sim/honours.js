// Hauts faits, records et méfaits.
//  Hauts faits (8 badges) : chaque compagnie peut tous les gagner. Ils ouvrent les cinq derniers
//    points de réputation (la réputation ordinaire plafonne à 95) : cinq hauts faits, et la
//    réputation parfaite devient possible.
//  Records (8 trophées) : un seul détenteur à la fois. Le premier qui atteint le seuil le prend ;
//    les records chiffrés se battent ensuite (il faut faire mieux que le détenteur), les autres
//    restent au premier. Ils trônent sur l'étagère du bureau.
//  Méfaits (6 preuves sinistres) : les records de l'ombre, mêmes règles, exposés sur le bureau.
// Les compteurs sont tenus ici (crochets appelés par la simulation) et vérifiés chaque jour.
import { PORT_IDS, PORTS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { SHIP_TYPES } from '../data/ships.js';
import { EMBARGOED } from '../data/sanctions.js';
import { HOURS_PER_DAY } from './util.js';
import { news, changeReputation, shipsOf } from './core.js';
import { pointsEarned, XP_STEPS } from './crew.js';
import { MAX_LOYALTY } from './clients.js';

const D = HOURS_PER_DAY;
const YEAR = 365 * D;
const num = (v) => Math.round(v).toLocaleString('fr-FR');
const Mt = (v) => `${(v / 1e6).toFixed(1).replace('.', ',')} Mt`;
const M$ = (v) => `${Math.round(v / 1e6).toLocaleString('fr-FR')} M$`;

// Familles de navires (cale principale) et marchandises légales : pour les records « complets ».
export const FAMILIES = [...new Set(Object.values(SHIP_TYPES).map((T) => T.holds[0]))];
export const FAMILY_NAMES = { divers: 'cargo', lourd: 'colis lourds', vrac: 'vraquier', liquide: 'pétrolier', chimique: 'chimiquier', gpl: 'gazier', gnl: 'méthanier', conteneurs: 'porte-conteneurs', vehicules: 'porte-voitures', frigo: 'frigorifique' };
export const LEGAL_GOODS = Object.keys(GOODS);
export const DARK_COUNTRIES = Object.keys(EMBARGOED);

// Réglages (équilibrage : une victoire difficile mais atteignable vers dix ans).
export const HONOURS = {
  deedRep: 1,            // réputation gagnée (et plafond relevé) par haut fait, jusqu'à cinq
  aid: 10, denounce: 14, repelled: 12, loyal: 14, school: 16,
  cleanDays: 540, cleanShips: 12, cleanDeliveries: 150,
  handsYears: 8,
  seasYears: 4, seasDeliveries: 100, // des années sans transporter de cargaison polluante (avec de l'activité)
  armada: 26, month: 1.1e6, tons: 45e6, streak: 320, crew: 130, families: 7, goods: 15,
  dark: 30, parcels: 60, embargo: 300e6, hostile: 25, eliminated: 2,
};

// Compteurs de la compagnie (créés à la demande, anciennes sauvegardes comprises).
export function hon(company) {
  return (company.hon ??= {
    tons: 0, tonsLog: [], streak: 0, goods: {}, aid: 0, denounced: 0, repelled: 0,
    lastPolluting: 0, seasDeliveries: 0, cleanSince: 0, cleanDeliveries: 0, lastDirty: 0,
    darkDone: 0, darkFrom: {}, parcels: 0, embargoValue: 0, hostile: 0, eliminated: 0,
    best: { fleet: 0, month: 0, streak: 0, crew: 0 }, deeds: {},
  });
}
export const deedCount = (company) => Object.keys(company.hon?.deeds || {}).length;

// ---------- Crochets (appelés par la simulation) ----------
export function onDelivered(state, company, { qty, good, late }) {
  const H = hon(company);
  H.tons += qty;
  H.tonsLog.push([state.t, qty]);
  H.goods[good] = true;
  if (late) { H.streak = 0; onStain(state, company); } else { H.streak++; H.cleanDeliveries++; }
  H.best.streak = Math.max(H.best.streak, H.streak);
  seasCount(state, H, good);
}
export function onTradeSale(state, company, { qty, good, value, embargo }) {
  const H = hon(company);
  H.tons += qty;
  H.tonsLog.push([state.t, qty]);
  H.goods[good] = true;
  if (embargo) H.embargoValue += value;
  seasCount(state, H, good);
}
// « Mers propres » : une cargaison polluante remet le compteur à zéro, les autres le font avancer.
function seasCount(state, H, good) {
  if ((GOODS[good]?.pollution || 0) >= 0.2) { H.lastPolluting = state.t; H.seasDeliveries = 0; } else H.seasDeliveries = (H.seasDeliveries || 0) + 1; // comme l'étiquette « ☣ polluant » des contrats
}
// Contrat avec un pays sous embargo, achat dans un port sous embargo : la valeur compte au « briseur d'embargo ».
export function onEmbargoTrade(company, value) { hon(company).embargoValue += value; }
// Une tache sur l'année sans incident : retard, détention, marée noire, amende, saisie.
export function onStain(state, company) { const H = hon(company); H.cleanSince = state.t; H.cleanDeliveries = 0; }
// Un geste gris ou noir : commerce sous embargo, colis discret, affaire noire, coup bas.
export function onDirty(state, company) { hon(company).lastDirty = state.t; }
export function onAid(company) { hon(company).aid++; }
export function onDenounce(company) { hon(company).denounced++; }
export function onRepelled(company) { hon(company).repelled++; }
export function onSpill(state, company) { onStain(state, company); }
export function onDarkDone(state, company, fromPort) {
  const H = hon(company);
  H.darkDone++;
  const flag = PORTS[fromPort]?.flag;
  if (flag) H.darkFrom[flag] = true;
  onDirty(state, company);
}
export function onParcel(state, company) { hon(company).parcels++; onDirty(state, company); }
// Coup bas contre un concurrent : compté (méfait) et retenu chez la victime (à qui revient sa ruine).
export function onHostile(state, by, target) {
  hon(by).hostile++;
  onDirty(state, by);
  if (target) hon(target).lastAttack = { by: by.id, t: state.t };
}
// Une compagnie disparaît (faillite ou rachat) : le « fossoyeur » est le racheteur, ou le dernier
// concurrent qui l'a attaquée dans l'année.
export function onEliminated(state, victim, byId = null) {
  const la = victim.hon?.lastAttack;
  const who = byId ?? (la && state.t - la.t < YEAR ? la.by : null);
  const by = who != null ? state.companies[who] : null;
  if (by && by !== victim && !by.bankrupt) hon(by).eliminated++;
}

// ---------- Hauts faits ----------
const frac = (v, goal) => Math.max(0, Math.min(1, goal ? v / goal : 0));
export const DEEDS = {
  aide: {
    name: 'Main tendue', icon: '❤️', get text() { return `Livrer à temps ${HONOURS.aid} aides d'urgence après une catastrophe.`; },
    progress: (s, c) => { const v = hon(c).aid; return { frac: frac(v, HONOURS.aid), text: `${v} / ${HONOURS.aid} aides livrées` }; },
  },
  sanstache: {
    name: 'Sans tache', icon: '✨', get text() { return `${Math.round(HONOURS.cleanDays / 30)} mois sans retard, détention, marée noire, amende ni saisie, avec au moins ${HONOURS.cleanShips} navires et ${HONOURS.cleanDeliveries} livraisons.`; },
    progress: (s, c) => {
      const H = hon(c), days = (s.t - H.cleanSince) / D, n = shipsOf(s, c.id).length;
      return { frac: Math.min(frac(days, HONOURS.cleanDays), frac(H.cleanDeliveries, HONOURS.cleanDeliveries), frac(n, HONOURS.cleanShips)), text: `${num(Math.min(days, HONOURS.cleanDays))} / ${HONOURS.cleanDays} jours · ${H.cleanDeliveries} / ${HONOURS.cleanDeliveries} livraisons · ${n} / ${HONOURS.cleanShips} navires` };
    },
  },
  fideles: {
    name: 'Partenaires fidèles', icon: '🤝', get text() { return `${HONOURS.loyal} chargeurs à la fidélité maximale en même temps.`; },
    progress: (s, c) => { const v = Object.values(c.clients || {}).filter((r) => r.loyalty >= MAX_LOYALTY).length; return { frac: frac(v, HONOURS.loyal), text: `${v} / ${HONOURS.loyal} chargeurs` }; },
  },
  alerte: {
    name: 'Lanceur d\'alerte', icon: '📣', get text() { return `Dénoncer publiquement ${HONOURS.denounce} chargeurs malhonnêtes.`; },
    progress: (s, c) => { const v = hon(c).denounced; return { frac: frac(v, HONOURS.denounce), text: `${v} / ${HONOURS.denounce} dénonciations` }; },
  },
  mainspropres: {
    name: 'Le Juste', icon: '⚖️', get text() { return `${HONOURS.handsYears} ans sans commerce sous embargo, colis discret, affaire noire ni coup bas, et jamais d'infamie.`; },
    progress: (s, c) => {
      if (c.infamy > 0) return { frac: 0, text: 'Impossible : votre compagnie porte une infamie.', impossible: true };
      const y = (s.t - hon(c).lastDirty) / YEAR;
      return { frac: frac(y, HONOURS.handsYears), text: `${Math.min(y, HONOURS.handsYears).toFixed(1).replace('.', ',')} / ${HONOURS.handsYears} ans` };
    },
  },
  ecole: {
    name: 'École de la mer', icon: '🎖', get text() { return `${HONOURS.school} navires aux équipages pleinement formés.`; },
    progress: (s, c) => { const v = shipsOf(s, c.id).filter((sh) => pointsEarned(sh) >= XP_STEPS.length).length; return { frac: frac(v, HONOURS.school), text: `${v} / ${HONOURS.school} équipages` }; },
  },
  merspropres: {
    name: 'Mers propres', icon: '🌊', get text() { return `${HONOURS.seasYears} ans sans transporter la moindre cargaison polluante (☣ : pétrole brut, produits raffinés, chimie, engrais), avec au moins ${HONOURS.seasDeliveries} livraisons.`; },
    progress: (s, c) => {
      const H = hon(c);
      H.lastPolluting ??= s.t; // ancienne sauvegarde : on compte à partir d'aujourd'hui
      const y = (s.t - H.lastPolluting) / YEAR, n = H.seasDeliveries || 0;
      return { frac: Math.min(frac(y, HONOURS.seasYears), frac(n, HONOURS.seasDeliveries)), text: `${Math.min(y, HONOURS.seasYears).toFixed(1).replace('.', ',')} / ${HONOURS.seasYears} ans sans cargaison polluante · ${n} / ${HONOURS.seasDeliveries} livraisons` };
    },
  },
  pirates: {
    name: 'Corsaire', icon: '⚔️', get text() { return `Repousser ${HONOURS.repelled} attaques de pirates.`; },
    progress: (s, c) => { const v = hon(c).repelled; return { frac: frac(v, HONOURS.repelled), text: `${v} / ${HONOURS.repelled} attaques repoussées` }; },
  },
};
export const DEED_IDS = Object.keys(DEEDS);

// ---------- Records (trophées) et méfaits (preuves) ----------
// value : meilleure valeur de la compagnie ; binary : premier arrivé, pour toujours.
export const RECORDS = {
  armada: { name: 'L\'Armada', text: 'La plus grande flotte jamais réunie', unit: 'navires', min: () => HONOURS.armada, value: (s, c) => hon(c).best.fleet, fmt: (v) => `${v} navires` },
  mois: { name: 'Le mois du siècle', text: 'Le plus de tonnes livrées en trente jours', min: () => HONOURS.month, value: (s, c) => hon(c).best.month, fmt: Mt },
  tonnes: { name: 'Le géant du fret', text: 'Le plus de tonnes livrées depuis la création', min: () => HONOURS.tons, value: (s, c) => hon(c).tons, fmt: Mt },
  ponctuel: { name: 'Réglé comme une horloge', text: 'La plus longue série de livraisons à l\'heure', min: () => HONOURS.streak, value: (s, c) => hon(c).best.streak, fmt: (v) => `${num(v)} livraisons` },
  equipages: { name: 'Les loups de mer', text: 'Le plus d\'expérience d\'équipage réunie dans une flotte', min: () => HONOURS.crew, value: (s, c) => hon(c).best.crew, fmt: (v) => `${num(v)} points` },
  produits: { name: 'Tout ce qui flotte', get text() { return `Avoir transporté ${HONOURS.goods} des ${LEGAL_GOODS.length} marchandises légales`; }, binary: true, min: () => HONOURS.goods, value: (s, c) => LEGAL_GOODS.filter((g) => hon(c).goods[g]).length, fmt: (v) => `${v} / ${LEGAL_GOODS.length} marchandises` },
  ports: { name: 'Toutes les escales', text: 'Avoir desservi tous les ports du monde', binary: true, min: () => PORT_IDS.length, value: (s, c) => (c.portsServed || []).length, fmt: (v) => `${v} / ${PORT_IDS.length} ports` },
  familles: { name: 'La flotte complète', get text() { return `${HONOURS.families} familles de navires sur les ${FAMILIES.length} en même temps`; }, binary: true, min: () => HONOURS.families, value: (s, c) => new Set(shipsOf(s, c.id).map((sh) => SHIP_TYPES[sh.type].holds[0])).size, fmt: (v) => `${v} / ${FAMILIES.length} familles` },
};
export const EVIL = {
  couteau: { name: 'Le couteau dans le bureau', text: 'Le plus d\'affaires noires menées à bien', min: () => HONOURS.dark, value: (s, c) => hon(c).darkDone, fmt: (v) => `${v} affaires` },
  passeur: { name: 'Le passeur', text: 'Le plus de colis discrets livrés', min: () => HONOURS.parcels, value: (s, c) => hon(c).parcels, fmt: (v) => `${v} colis` },
  embargo: { name: 'Briseur d\'embargo', text: 'Le plus de commerce avec les pays sous embargo', min: () => HONOURS.embargo, value: (s, c) => hon(c).embargoValue, fmt: M$ },
  marionnettiste: { name: 'Le marionnettiste', text: 'Le plus de coups bas contre les concurrents', min: () => HONOURS.hostile, value: (s, c) => hon(c).hostile, fmt: (v) => `${v} coups bas` },
  ennemi: { name: 'Ennemi public numéro un', text: 'La première compagnie sur la liste noire internationale', binary: true, min: () => 1, value: (s, c) => (c.blacklisted ? 1 : 0), fmt: (v) => (v ? 'sur la liste noire' : 'pas encore') },
  fossoyeur: { name: 'Le fossoyeur', text: 'Le plus de concurrents rachetés ou ruinés (une faillite revient au dernier concurrent qui l\'a attaquée dans l\'année)', min: () => HONOURS.eliminated, value: (s, c) => hon(c).eliminated, fmt: (v) => `${v} compagnies` },
};
export const RECORD_IDS = Object.keys(RECORDS);
export const EVIL_IDS = Object.keys(EVIL);

const book = (state, kind) => (kind === 'evil' ? (state.evil ??= {}) : (state.records ??= {}));
export const recordHolder = (state, id, kind = 'record') => book(state, kind)[id] || null;
export const recordsHeld = (state, cid, kind = 'record') => Object.entries(book(state, kind)).filter(([, r]) => r.holder === cid).map(([id]) => id);

// ---------- Chaque jour ----------
function refreshBest(state, company) {
  const H = hon(company);
  const ships = shipsOf(state, company.id);
  H.best.fleet = Math.max(H.best.fleet, ships.length);
  H.best.crew = Math.max(H.best.crew, ships.reduce((n, sh) => n + pointsEarned(sh), 0));
  H.tonsLog = H.tonsLog.filter(([t]) => state.t - t < 30 * D);
  H.best.month = Math.max(H.best.month, H.tonsLog.reduce((n, [, q]) => n + q, 0));
}
function say(state, notes, company, kind, text, extra = {}) {
  if (company.human) notes.push({ kind, company: company.id, text, ...extra });
}
function checkDeeds(state, company, notes) {
  const H = hon(company);
  for (const id of DEED_IDS) {
    if (H.deeds[id]) continue;
    if (DEEDS[id].progress(state, company).frac < 1) continue;
    H.deeds[id] = state.t;
    const n = deedCount(company);
    if (n <= 5) changeReputation(company, HONOURS.deedRep); // le plafond vient de monter d'un point
    news(state, `${company.name} gagne le haut fait « ${DEEDS[id].name} ».`, { company: company.id, kind: 'event' });
    say(state, notes, company, 'deed', n <= 5 ? `Haut fait : « ${DEEDS[id].name} ». Votre plafond de réputation monte à ${95 + n}.` : `Haut fait : « ${DEEDS[id].name} ».`, { deed: id });
  }
}
function checkRecords(state, notes, kind) {
  const defs = kind === 'evil' ? EVIL : RECORDS, b = book(state, kind);
  const active = state.companies.filter((c) => !c.bankrupt);
  for (const [id, R] of Object.entries(defs)) {
    const cur = b[id];
    if (cur && R.binary) continue; // premier arrivé, pour toujours
    const min = R.min();
    let best = null;
    for (const c of active) {
      const v = R.value(state, c);
      if (v < min) continue;
      if (cur && c.id !== cur.holder && v <= cur.value) continue;
      if (!best || v > best.v) best = { c, v };
    }
    if (!best) continue;
    if (cur && cur.holder === best.c.id) { cur.value = best.v; continue; }
    const prev = cur ? state.companies[cur.holder] : null;
    b[id] = { holder: best.c.id, value: best.v, t: state.t };
    const evil = kind === 'evil';
    news(state, prev
      ? (evil ? `${best.c.name} ravit le méfait « ${R.name} » à ${prev.name} : ${R.fmt(best.v)}.` : `${best.c.name} bat le record « ${R.name} » de ${prev.name} : ${R.fmt(best.v)}.`)
      : (evil ? `${best.c.name} signe le méfait « ${R.name} » : ${R.fmt(best.v)}.` : `${best.c.name} établit le record « ${R.name} » : ${R.fmt(best.v)}.`), { company: best.c.id, kind: 'event' });
    say(state, notes, best.c, evil ? 'evil' : 'record', evil ? `Méfait « ${R.name} » : ${R.fmt(best.v)}.` : `Record « ${R.name} » : ${R.fmt(best.v)}.`, { record: id, from: prev?.id ?? null });
    if (prev && prev.human && !prev.bankrupt) say(state, notes, prev, 'recordLost', evil ? `${best.c.name} vous ravit le méfait « ${R.name} » (${R.fmt(best.v)}).` : `${best.c.name} vous prend le record « ${R.name} » (${R.fmt(best.v)}).`, { record: id, evil });
  }
}
export function honoursDaily(state, notes) {
  for (const c of state.companies) {
    if (c.bankrupt) continue;
    refreshBest(state, c);
    checkDeeds(state, c, notes);
  }
  checkRecords(state, notes, 'record');
  checkRecords(state, notes, 'evil');
}
