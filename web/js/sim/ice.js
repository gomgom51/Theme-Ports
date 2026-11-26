// Glaces saisonnières : ports qui ne s'ouvrent que l'été (Churchill, Nome, Sabetta, Prudhoe
// Bay) et passage du Nord-Est. Chaque année, le dégel et le retour des glaces tombent à
// quelques jours près dans les mêmes semaines : la date est tirée au sort (reproductible pour
// une partie donnée). Tout le monde connaît la fenêtre ; la date exacte n'est annoncée que
// ICE.announce jours avant. Un navire de classe glace gagne quelques semaines à chaque bout
// de la saison et paie moins cher l'escorte d'un brise-glace.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { HOURS_PER_DAY, START_YEAR, yearOf, formatDate, clamp } from './util.js';
import { hasEquip } from './equipment.js';
import { news, companyOf, portName, shipLog } from './core.js';

export const ICE = {
  announce: 14,        // jours : la date exacte du gel ou du dégel est connue ce délai avant
  iceClass: 21,        // jours gagnés à chaque bout de la saison par un navire de classe glace
  escortBase: 60000,   // escorte d'un brise-glace : forfait…
  escortPerDwt: 2.5,   // … plus tant par tonne de port en lourd
  escortIceClass: 0.4, // part payée par un navire de classe glace
  nsrHorizon: 20,      // jours : le passage du Nord-Est doit rester sûr ce temps-là pour qu'on l'emprunte
  iceContract: 1.3,    // prime des contrats de fin de saison réservés aux navires de classe glace
  season: 0.8,         // part des ports saisonniers gelés (ou dégelés) qui déclenche l'annonce générale
};
// Passages saisonniers (marqués comme des canaux sur la grille de routage).
export const ICE_PASSAGES = { nsr: { name: 'passage du Nord-Est', open: 200, close: 315, spread: 10 } };
export const iceSpec = (id) => PORTS[id]?.ice || ICE_PASSAGES[id] || null;
export const isSeasonal = (id) => !!iceSpec(id);
export const ICE_PLACES = [...PORT_IDS.filter((p) => PORTS[p].ice), ...Object.keys(ICE_PASSAGES)];
export const iceName = (id) => PORTS[id]?.name || ICE_PASSAGES[id]?.name || id;
export const iceClass = (ship) => hasEquip(ship, 'glace');
// Un navire de classe glace « type », pour les contrats qui lui sont réservés.
export const ICE_SHIP = { equipment: ['glace'] };

const DAY = HOURS_PER_DAY;
const yearStart = (y) => (Date.UTC(y, 0, 1) - Date.UTC(START_YEAR, 0, 1)) / 3600e3;
const ext = (ship) => (ship && iceClass(ship) ? ICE.iceClass * DAY : 0);

// Hasard reproductible : graine de la partie, lieu, année.
function rand01(seed, id, y, k) {
  let h = ((seed || 1) ^ 0x9e3779b9) >>> 0;
  for (const ch of `${id}|${y}|${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Dates réelles de l'année y (heures de jeu) : dégel et retour des glaces (mises en cache).
const datesCache = new Map();
export function iceDates(state, id, y) {
  const key = `${state.seed}|${id}|${y}`;
  let d = datesCache.get(key);
  if (!d) {
    const S = iceSpec(id), y0 = yearStart(y);
    d = {
      thaw: Math.round(y0 + (S.open + (rand01(state.seed, id, y, 0) * 2 - 1) * S.spread) * DAY),
      freeze: Math.round(y0 + (S.close + (rand01(state.seed, id, y, 1) * 2 - 1) * S.spread) * DAY),
    };
    datesCache.set(key, d);
  }
  return d;
}
// Année de jeu d'un instant (sans créer de date à chaque appel).
const yearCache = { t0: Infinity, t1: -Infinity, y: 0 };
function yearAt(t) {
  if (t < yearCache.t0 || t >= yearCache.t1) { const y = yearOf(t); Object.assign(yearCache, { y, t0: yearStart(y), t1: yearStart(y + 1) }); }
  return yearCache.y;
}
// Fenêtre connue de tous (au plus tôt, au plus tard).
function windowOf(id, y, which) {
  const S = iceSpec(id), base = yearStart(y) + (which === 'thaw' ? S.open : S.close) * DAY;
  return [Math.round(base - S.spread * DAY), Math.round(base + S.spread * DAY)];
}

// Libre de glace à l'instant t, pour ce navire (classe glace : saison plus longue) ?
export function iceOpen(state, id, t = state.t, ship = null) {
  if (!isSeasonal(id)) return true;
  const d = iceDates(state, id, yearAt(t)), e = ext(ship);
  return t >= d.thaw - e && t < d.freeze + e;
}

// Prochain changement vu d'aujourd'hui : gel (le lieu est libre) ou dégel (il est pris).
// known : date exacte annoncée (at) ; sinon la fenêtre [from, to] des dates possibles.
export function iceForecast(state, id, ship = null) {
  const t = state.t, y = yearAt(t), e = ext(ship);
  const d = iceDates(state, id, y);
  let which, at, win;
  if (t < d.thaw - e) { which = 'thaw'; at = d.thaw - e; win = windowOf(id, y, 'thaw').map((x) => x - e); }
  else if (t < d.freeze + e) { which = 'freeze'; at = d.freeze + e; win = windowOf(id, y, 'freeze').map((x) => x + e); }
  else { which = 'thaw'; at = iceDates(state, id, y + 1).thaw - e; win = windowOf(id, y + 1, 'thaw').map((x) => x - e); }
  const known = at - t <= ICE.announce * DAY;
  // Pas encore annoncée : la date tombe au moins ICE.announce jours plus tard.
  return { which, open: which === 'freeze', known, at: known ? at : null, from: known ? at : Math.max(win[0], t + ICE.announce * DAY), to: known ? at : win[1] };
}

// Probabilité que le lieu soit pris par les glaces à l'instant tArr (vu d'aujourd'hui).
export function iceRisk(state, id, tArr, ship = null) {
  if (!isSeasonal(id)) return 0;
  const f = iceForecast(state, id, ship);
  const p = f.to > f.from ? clamp((tArr - f.from) / (f.to - f.from), 0, 1) : (tArr >= f.from ? 1 : 0);
  return f.open ? p : 1 - p; // libre : le gel est-il passé ? pris : le dégel n'est-il pas encore là ?
}

// Le passage du Nord-Est est-il sûr pour un départ maintenant (il doit le rester le temps d'y arriver) ?
const nsrCache = new WeakMap(); // par partie : { t, [classe glace ou non] : réponse }
export function nsrUsable(state, ship = null) {
  const k = ship && iceClass(ship) ? 1 : 0;
  let c = nsrCache.get(state);
  if (!c || c.t !== state.t) nsrCache.set(state, (c = { t: state.t }));
  return (c[k] ??= iceOpen(state, 'nsr', state.t, ship) && iceRisk(state, 'nsr', state.t + ICE.nsrHorizon * DAY, ship) === 0);
}

// Escorte d'un brise-glace pour entrer dans un port pris ou en sortir.
export function escortFee(ship) {
  const T = SHIP_TYPES[ship.type];
  return Math.round(((ICE.escortBase + ICE.escortPerDwt * T.dwt) * (iceClass(ship) ? ICE.escortIceClass : 1)) / 1000) * 1000;
}

// « gel annoncé le 3 nov. » ou « gel prévu entre le 26 oct. et le 15 nov. ».
export function forecastText(state, id, ship = null) {
  const f = iceForecast(state, id, ship);
  const what = f.which === 'freeze' ? 'retour des glaces' : 'dégel';
  return f.known ? `${what} annoncé le ${formatDate(f.at, true)}` : `${what} prévu entre le ${formatDate(f.from, true)} et le ${formatDate(f.to, true)}`;
}

// Compagnies humaines dont un navire est à ce port, y fait route ou doit y partir.
function companiesConcerned(state, id) {
  const out = new Set();
  for (const s of state.ships) {
    const co = state.companies[s.owner];
    if (!co?.human || co.bankrupt) continue;
    if ((s.status !== 'sea' && s.port === id) || (s.status === 'sea' && s.voyage?.to === id) || s.plan?.to === id) out.add(co.id);
  }
  return out;
}

// Une fois par jour : annonces, gel et dégel, navires pris par les glaces ou libérés.
export function iceDaily(state, notes) {
  state.ice ??= {};
  for (const id of ICE_PLACES) {
    const open = iceOpen(state, id), f = iceForecast(state, id);
    let st = state.ice[id];
    if (!st) { state.ice[id] = { open, said: f.known ? f.at : null }; continue; } // nouvelle partie ou ancienne sauvegarde : sans annonce
    const name = iceName(id), port = !!PORTS[id];
    if (f.known && st.said !== f.at) {
      st.said = f.at;
      const text = f.which === 'freeze'
        ? (port ? `Les glaces reviennent : ${name} fermera le ${formatDate(f.at, true)}. Les navires encore au port devront payer un brise-glace pour en sortir.` : `Les glaces reviennent : le ${name} fermera le ${formatDate(f.at, true)}.`)
        : (port ? `Débâcle en vue : ${name} rouvrira le ${formatDate(f.at, true)}.` : `Débâcle en vue : le ${name} rouvrira le ${formatDate(f.at, true)}.`);
      news(state, text, { kind: 'event' });
      // En alerte seulement pour les compagnies dont un navire y est, y va ou doit y partir.
      if (port) for (const co of companiesConcerned(state, id)) notes.push({ kind: 'iceSoon', place: id, change: f.which, at: f.at, company: co, text });
    }
    if (open !== st.open) {
      st.open = open;
      const text = open
        ? (port ? `Dégel : ${name} est de nouveau accessible.` : `Dégel : le ${name} est ouvert pour l'été.`)
        : (port ? `${name} est pris par les glaces jusqu'au printemps.` : `Le ${name} est pris par les glaces jusqu'à l'été prochain.`);
      news(state, text, { kind: 'event' }); // chaque port dans le journal ; l'annonce générale vient plus bas
      // Les offres qui partent d'un port pris, ou qui y vont, disparaissent.
      if (!open && port) state.contracts = state.contracts.filter((c) => c.takenBy !== null || (c.from !== id && (c.to !== id || (c.ice && c.deadline < state.t + ICE.iceClass * DAY))));
    }
  }
  // Le grand gel et le grand dégel : une seule annonce, quand ICE.season (80 %) des ports saisonniers ont changé.
  const ports = ICE_PLACES.filter((p) => PORTS[p]);
  if (ports.length) {
    const closed = ports.filter((p) => !state.ice[p]?.open).length, n = ports.length, need = Math.ceil(ICE.season * n);
    if (!state.iceSeason) state.iceSeason = closed * 2 >= n ? 'winter' : 'summer'; // nouvelle partie ou ancienne sauvegarde : sans annonce
    else if (state.iceSeason === 'summer' && closed >= need) {
      state.iceSeason = 'winter';
      const text = `Les glaces reviennent : ${closed} ports saisonniers sur ${n} sont fermés jusqu'au printemps. Un navire encore à quai devra payer un brise-glace pour en sortir ; les dates de chaque port sont sur sa fiche.`;
      news(state, text, { kind: 'event' });
      notes.push({ kind: 'ice', change: 'freeze', text });
    } else if (state.iceSeason === 'winter' && n - closed >= need) {
      state.iceSeason = 'summer';
      const text = `Le dégel : ${n - closed} ports saisonniers sur ${n} ont rouvert pour l'été. Les dates du retour des glaces sont sur la fiche de chaque port.`;
      news(state, text, { kind: 'event' });
      notes.push({ kind: 'ice', change: 'thaw', text });
    }
  }
  // Navires pris par les glaces dans un port saisonnier, ou libérés par le dégel.
  for (const ship of state.ships) {
    const here = ship.status === 'sea' ? null : ship.port;
    if (ship.iced && (ship.iced !== here || iceOpen(state, ship.iced, state.t, ship))) {
      const was = ship.iced;
      ship.iced = null;
      if (was === here && companyOf(state, ship).human) notes.push({ kind: 'info', shipId: ship.id, company: ship.owner, text: `Dégel à ${portName(here)} : le ${ship.name} peut repartir sans brise-glace.` });
    }
    if (here && isSeasonal(here) && !ship.iced && !iceOpen(state, here, state.t, ship)) {
      ship.iced = here;
      shipLog(state, ship, `Pris par les glaces à ${portName(here)}`);
      if (companyOf(state, ship).human) {
        notes.push({ kind: 'icecaught', shipId: ship.id, company: ship.owner, text: `Le ${ship.name} est pris par les glaces à ${portName(here)} (${forecastText(state, here, ship)}). Il peut attendre, désarmé pour l'hiver, ou partir avec un brise-glace (${Math.round(escortFee(ship) / 1000)} k$).` });
      }
    }
  }
}
