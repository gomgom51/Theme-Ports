// Boucle de simulation : création d'une partie, avancée du temps heure par heure.
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { Rng, HOURS_PER_DAY, formatDate, dateOf } from './util.js';
import * as eco from './economy.js';
import * as act from './actions.js';
import {
  money, news, emptyBook, bookTotal, companyOf, shipsOf, isIdle, fleetValue, netWorth, interestRate,
  changeReputation, createShip, shipLog, portName, removeShip, contractById, pickShipName, costStat,
} from './core.js';
import { dailyEvents, dailyStorms, moveStorms, weatherAt } from './events.js';
import { aiShipIdle, aiDaily } from './ai.js';
import { pointAlong } from './routing.js';
import { CANAL_NAMES } from './context.js';
import { createPayment, resolution, collect, dailyReceivables } from './payments.js';
import { rollIncident, incidentText, sinkChance, hullInsurance, SEAWORTHY, inspection } from './incidents.js';
import { spill, isPolluting } from './pollution.js';
import { taintShip, checkSanctions, contrabandOnArrival, refreshOffers } from './shady.js';
import { equipMod, equipUpkeep } from './equipment.js';
import { piracyHour } from './piracy.js';
import { coverage, premiumPerDay } from './insurance.js';
import { patrolHour } from './patrols.js';

const D = HOURS_PER_DAY;
export const SAVE_VERSION = 2;
export const COMPANY_COLORS = ['#e5484d', '#3e8ef7', '#30a46c', '#f5a623'];
export const COMPANY_LOGOS = ['ancre', 'phare', 'barre', 'rose'];
export const DIFFICULTIES = {
  facile: { label: 'Facile', cash: 12e6, aiSkill: 0.7, text: '12 M$ au départ, concurrents prudents' },
  normal: { label: 'Normal', cash: 8e6, aiSkill: 1, text: '8 M$ au départ' },
  difficile: { label: 'Difficile', cash: 5e6, aiSkill: 1.3, text: '5 M$ au départ, concurrents redoutables' },
};
export const DURATIONS = [
  { years: 2, label: '2 ans' }, { years: 5, label: '5 ans' }, { years: 10, label: '10 ans' }, { years: 0, label: 'Sans fin' },
];

export function newGame(opts, ctx) {
  const seed = opts.seed ?? ((Math.random() * 2 ** 32) >>> 0);
  const rng = new Rng(seed);
  const { market, ports } = eco.initMarket(rng);
  const state = {
    version: SAVE_VERSION, seed, t: 0, rng: 0, nextId: 1,
    settings: {
      duration: opts.duration ?? 5,
      difficulty: opts.difficulty || 'normal',
      autoPause: opts.autoPause ?? true,
    },
    market, ports,
    companies: [], ships: [], contracts: [], used: [], orders: [],
    storms: [], canals: {}, strikes: {}, news: [], over: null, payments: [], receivables: [],
  };
  const diff = DIFFICULTIES[state.settings.difficulty];
  opts.companies.forEach((c, i) => {
    const flag = PORTS[c.homePort].flag;
    state.companies.push({
      id: i, name: c.name, captain: c.captain || '', color: c.color || COMPANY_COLORS[i], logo: c.logo || COMPANY_LOGOS[i], human: !!c.human,
      homePort: c.homePort, flag, cash: diff.cash, debt: 0,
      reputation: Math.round(FLAGS[flag].rating * 0.5 + 25),
      portsServed: [c.homePort], delivered: 0, late: 0, bankrupt: false, lowCashDays: 0,
      month: emptyBook(), lastMonth: emptyBook(), total: emptyBook(), history: [],
      // Certaines compagnies de l'ordinateur sont « audacieuses » : elles prennent des colis discrets.
      ai: c.human ? null : { skill: diff.aiSkill, nextFleet: rng.int(1, 5) * D, daring: rng.chance(0.5) },
    });
  });
  for (let d = 0; d < 3; d++) eco.dailyMarketUpdate(state, rng);
  eco.refreshContracts(state, ctx, rng, true);
  // Dans chaque port d'attache, quelques contrats à la portée des petits navires du départ.
  for (const c of state.companies) {
    for (const type of ['caboteur', 'caboteur', 'polyvalent']) {
      for (let tries = 0; tries < 6; tries++) {
        const k = eco.makeContract(state, ctx, rng, c.homePort, type);
        if (k) { k.minRep = 0; k.expires = Math.max(k.expires, state.t + 10 * D); state.contracts.push(k); break; }
      }
    }
  }
  refreshUsedMarket(state, rng, true);
  dailyStorms(state, rng);
  news(state, 'Le marché du fret ouvre. Achetez un premier navire chez le courtier !', { kind: 'event' });
  recordHistory(state);
  state.rng = rng.s;
  return state;
}

// Met à niveau une partie sauvegardée par une version précédente : nouvelles
// marchandises, nouveaux ports et nouveaux types de fret.
export function migrateState(state) {
  const rng = new Rng((state.seed ^ 0x9e3779b9) >>> 0);
  state.market.cycle ??= 0;
  state.spills ??= [];
  state.offers ??= [];
  state.cases ??= [];
  for (const c of state.companies) { c.bans ??= {}; c.insurance ??= 'complete'; }
  for (const h of eco.HOLD_TYPES) state.market.freight[h] ??= rng.range(1.18, 1.42);
  for (const g of Object.keys(GOODS)) state.market.world[g] ??= rng.range(0.94, 1.06);
  for (const p of PORT_IDS) {
    state.ports[p] ??= {};
    for (const g of Object.keys(GOODS)) {
      state.ports[p][g] ??= { ou: 0, imp: 0, stock: eco.stockCap(p, g) * rng.range(0.4, 0.9) };
    }
  }
  state.version = SAVE_VERSION;
  return state;
}

// ---------- Marché de l'occasion ----------
function makeListing(state, rng, port, typeId, ageRange, condRange) {
  const T = SHIP_TYPES[typeId];
  const age = rng.range(...ageRange);
  const condition = Math.round(rng.range(...condRange));
  const fake = { type: typeId, builtT: state.t - age * 365 * D, condition };
  const price = Math.round((eco.shipValue(state, fake) * rng.range(0.92, 1.08)) / 10000) * 10000;
  return {
    id: state.nextId++, type: typeId, age: Math.round(age * 10) / 10, condition, port, price,
    name: pickShipName(state, rng), until: state.t + rng.int(20, 45) * D,
  };
}

function refreshUsedMarket(state, rng, initial = false) {
  state.used = state.used.filter((l) => l.until > state.t);
  if (initial) {
    // De quoi démarrer dans chaque port d'attache : un caboteur fatigué et un cargo plus grand.
    for (const c of state.companies) {
      // (des coques en fin de carrière : à peu près 2,3 M$ et 4,5 M$, à la portée d'un débutant)
      state.used.push(makeListing(state, rng, c.homePort, 'caboteur', [22, 26], [62, 78]));
      const r = rng.next();
      if (r < 0.25) {
        // Un vieux cargo des années 60 : presque donné, mais assoiffé.
        state.used.push(makeListing(state, rng, c.homePort, 'cargo_ancien', [38, 43], [52, 68]));
      } else {
        const second = PORTS[c.homePort].terminals.includes('liquide') && r < 0.45 ? 'petrolier_mr' : 'polyvalent';
        state.used.push(makeListing(state, rng, c.homePort, second, second === 'petrolier_mr' ? [22.5, 24] : [23, 26], [58, 75]));
      }
    }
  }
  // Plus de petits navires que de géants sur le marché ; les modèles anciens sont rares et très âgés.
  const types = Object.entries(SHIP_TYPES).map(([id, T]) => [id, T.vintage ? 0.7 : Math.pow(T.price, -0.3)]);
  while (state.used.length < 16 + state.companies.length) {
    const typeId = rng.weighted(types);
    const T = SHIP_TYPES[typeId];
    const ports = PORT_IDS.filter((p) => eco.servesType(p, typeId));
    if (T.vintage) state.used.push(makeListing(state, rng, rng.pick(ports), typeId, [26, 42], [35, 72]));
    else state.used.push(makeListing(state, rng, rng.pick(ports), typeId, [2, T.life - 4], [45, 96]));
  }
}

// ---------- Avancée du temps ----------
// Renvoie la liste des notifications utiles à l'interface (navire disponible, naufrage...).
export function tick(state, ctx, hours = 1) {
  if (state.over) return [];
  const rng = new Rng(state.rng);
  const notes = [];
  for (let h = 0; h < hours && !state.over; h++) stepHour(state, ctx, rng, notes);
  state.rng = rng.s;
  return notes;
}

function note(state, notes, kind, ship, text) {
  const company = companyOf(state, ship);
  if (!company.human) return;
  notes.push({ kind, shipId: ship.id, company: company.id, text });
}

function stepHour(state, ctx, rng, notes) {
  state.t += 1;
  moveStorms(state);
  for (const ship of [...state.ships]) {
    const h = ship.hours || (ship.hours = { laden: 0, ballast: 0, port: 0, laidup: 0 });
    if (ship.status === 'sea') h[ship.cargo ? 'laden' : 'ballast']++;
    else h[ship.status === 'laidup' ? 'laidup' : 'port']++;
    if (ship.status === 'sea') sailHour(state, ctx, rng, ship, notes);
    else if (ship.status === 'port') portHour(state, ctx, rng, ship, notes);
  }
  for (const o of [...state.orders]) if (o.due <= state.t) deliverOrder(state, rng, o, notes);
  for (const ship of state.ships) {
    const c = companyOf(state, ship);
    if (!c.human && !c.bankrupt && isIdle(ship)) aiShipIdle(state, ctx, rng, ship);
  }
  if (state.t % D === 0) daily(state, ctx, rng, notes);
}

function portHour(state, ctx, rng, ship, notes) {
  const T = SHIP_TYPES[ship.type];
  ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D);
  if (ship.busyWhat && state.t >= ship.busyUntil) {
    const what = ship.busyWhat;
    ship.busyWhat = null;
    if (what === 'saisie' && ship.pendingDelivery && ship.cargo) {
      act.startBusy(state, ship, 'déchargement', eco.handlingHours(ship.port, ship.cargo.hold, ship.cargo.qty));
      return;
    }
    if (what === 'déchargement' && ship.pendingDelivery) deliverContract(state, ship, rng, notes);
    if ((what === 'réparation' || what === 'détention') && ship.repairTo != null) { ship.condition = Math.max(ship.condition, ship.repairTo); ship.repairTo = null; }
    // Navire retenu par les inspecteurs : la remise en état commence après le déchargement.
    if (ship.detention) { act.startBusy(state, ship, 'détention', ship.detention.hours); ship.detentionStart = state.t; ship.detention = null; return; }
    if (ship.plan) {
      const r = act.runPlan(state, ctx, ship);
      if (!r.ok) note(state, notes, 'idle', ship, `Le ${ship.name} n'a pas pu appareiller : ${r.msg}`);
      else note(state, notes, 'depart', ship, `Le ${ship.name} appareille.`);
      return;
    }
    const labels = { chargement: 'a terminé son chargement', 'déchargement': 'a terminé son déchargement', 'réparation': 'est réparé', 'réarmement': 'est réarmé', 'détention': 'est remis en état et libéré par les inspecteurs', saisie: 'est libéré par la douane', installation: 'a son nouvel équipement' };
    note(state, notes, 'idle', ship, `Le ${ship.name} ${labels[what] || 'est prêt'} à ${portName(ship.port)}.`);
  }
}

function sailHour(state, ctx, rng, ship, notes) {
  const T = SHIP_TYPES[ship.type];
  const v = ship.voyage;
  const route = ctx.shipRoute(ship);
  const company = companyOf(state, ship);
  if (!route) { arrive(state, ctx, ship, notes, rng); return; }

  // En attente devant un canal fermé.
  if (v.waitCanal) {
    if (ctx.closedCanals(state, T.draft).includes(v.waitCanal)) { ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D); return; }
    note(state, notes, 'info', ship, `Le ${ship.name} peut enfin franchir le ${CANAL_NAMES[v.waitCanal]}.`);
    v.waitCanal = null;
  }
  // Immobilisé par une avarie.
  if (v.stalledUntil > state.t) { ship.fuel = Math.max(0, ship.fuel - T.idleBurn / D); return; }

  const pos = pointAlong(route, v.progress);
  const wx = weatherAt(state, pos.lon, pos.lat);
  const speedFactor = wx.force >= 7 ? Math.max(0.45, 1 - (wx.force - 6) * 0.08) : 1;
  const condFactor = ship.condition < 50 ? 1 - (50 - ship.condition) / 120 : 1;
  const step = v.speed * speedFactor * condFactor;

  // Canal fermé pendant le voyage : on s'arrête devant.
  for (const c of route.canals) {
    const at = route.canalAt?.[c];
    if (at == null || v.progress > at || v.progress + step < at) continue;
    if (ctx.closedCanals(state, T.draft).includes(c)) {
      v.progress = at;
      v.waitCanal = c;
      note(state, notes, 'info', ship, `Le ${ship.name} est bloqué devant le ${CANAL_NAMES[c]} fermé. Il attendra la réouverture.`);
      shipLog(state, ship, `Bloqué devant le ${CANAL_NAMES[c]}`);
      return;
    }
  }

  const age = eco.ageYears(state, ship);
  v.progress += step;
  ship.fuel -= (eco.burnPerDay(T, v.speed, age) * equipMod(ship, 'burn') / D) * (1 + Math.max(0, wx.force - 6) * 0.06);

  // Usure : plus rapide pour un vieux navire et par gros temps.
  let wear = eco.wearPerHour(age);
  if (wx.force >= 9) wear += (wx.force - 8) * 0.045 * (1 + (100 - ship.condition) / 100);
  ship.condition = Math.max(0, ship.condition - wear);

  if (wx.storm && wx.force >= 9 && !v.storms.includes(wx.storm.id)) {
    v.storms.push(wx.storm.id);
    // La cargaison souffre : conteneurs arrachés, cales qui prennent l'eau, chargement qui ripe.
    let lost = '';
    if (ship.cargo && rng.chance(0.25 + (wx.force - 9) * 0.12 + (100 - ship.condition) / 300)) {
      const d0 = ship.cargo.damage || 0, hit = rng.range(0.03, 0.08 + (wx.force - 9) * 0.06);
      ship.cargo.damage = Math.min(0.9, d0 + hit * (1 - d0));
      lost = ship.cargo.hold === 'conteneurs' ? ` Des conteneurs sont passés par-dessus bord (${Math.round(hit * 100)} % de la cargaison).`
        : ` Une partie de la cargaison est avariée (${Math.round(hit * 100)} %).`;
      const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
      st.incidents.tempete = (st.incidents.tempete || 0) + 1;
    }
    note(state, notes, lost ? 'incident' : 'storm', ship, `Le ${ship.name} affronte ${articleStorm(wx.storm.name)} (force ${wx.force})${lost}.`);
    shipLog(state, ship, `${wx.storm.name} : vent force ${wx.force}${lost ? ', cargaison avariée' : ''}`);
  }

  // Incidents : avarie, incendie, abordage, échouement, voie d'eau, gros temps…
  v.startCond ??= ship.condition;
  const nearCoast = v.progress < 150 || route.nm - v.progress < 150;
  const inc = rollIncident(rng, ship, { age, force: wx.force, nearCoast });
  if (inc) {
    const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
    st.incidents[inc.kind] = (st.incidents[inc.kind] || 0) + 1;
    ship.condition = Math.max(0, ship.condition - inc.cond);
    if (inc.delayH) v.stalledUntil = state.t + inc.delayH;
    money(state, company, -inc.cost, inc.kind === 'machine' ? 'reparations' : 'sinistres');
    if (inc.kind !== 'machine') costStat(state, 'incidents', inc.cost);
    ship.spent += inc.cost;
    if (inc.damage && ship.cargo) {
      const d = ship.cargo.damage || 0;
      ship.cargo.damage = Math.min(0.9, d + inc.damage * (1 - d));
    }
    if (inc.rep) changeReputation(company, inc.rep);
    const text = incidentText(inc, ship);
    // Échouement, abordage, voie d'eau ou incendie avec une cargaison polluante : une partie se déverse.
    if (inc.severe && inc.kind !== 'gros_temps' && ship.cargo && isPolluting(ship.cargo.good)) {
      const share = inc.kind === 'echouement' ? rng.range(0.03, 0.15) : rng.range(0.01, 0.08);
      spill(state, ship, company, pos, share, { nearCoast, notes, note });
      ship.cargo.qty = Math.round(ship.cargo.qty * (1 - share));
    }
    shipLog(state, ship, text.split('.')[0]);
    if (inc.severe && rng.chance(sinkChance(ship.condition, wx.force, ship.crew) * (inc.kind === 'incendie' ? equipMod(ship, 'fireSink') : 1))) {
      sink(state, ctx, ship, notes, pos, wx, inc, rng);
      return;
    }
    note(state, notes, inc.kind === 'machine' ? 'breakdown' : 'incident', ship, text);
  }

  // Pirates : dans les zones à risque, une attaque peut survenir.
  const pir = piracyHour(state, rng, ship, pos);
  if (pir) {
    const n0 = notes.length;
    const texts = {
      repelled: `Attaque de pirates repoussée ! Le ${ship.name} a tenu bon (${pir.zone}).`,
      looted: `Des pirates ont pillé le ${ship.name} (${pir.zone}) ; l'équipage, réfugié dans la citadelle, est sain et sauf.`,
      hijacked: `Le ${ship.name} a été détourné par des pirates (${pir.zone}) ! Ils réclament ${(pir.ransom / 1e6).toFixed(1).replace('.', ',')} M$.`,
    };
    note(state, notes, pir.outcome === 'hijacked' ? 'hijack' : 'pirates', ship, texts[pir.outcome]);
    if (notes.length > n0) notes[notes.length - 1].report = pir;
    if (pir.outcome === 'hijacked') return;
  }

  // Garde-côtes : un navire qui cache un colis peut être intercepté.
  const pat = patrolHour(state, rng, ship, pos);
  if (pat) {
    const n0 = notes.length;
    const texts = {
      evaded: `Le ${ship.name} a échappé à un contrôle des ${pat.zone}.`,
      searched: `Le ${ship.name} a été fouillé par les ${pat.zone} : ils n'ont rien trouvé.`,
      seized: `Les ${pat.zone} ont trouvé le colis du ${ship.name} : amende de ${((pat.fine || 0) / 1e6).toFixed(2).replace('.', ',')} M$, navire retenu ${pat.days} jours.`,
    };
    note(state, notes, 'patrol', ship, texts[pat.outcome]);
    if (notes.length > n0) notes[notes.length - 1].report = pat;
  }

  // Naufrage : coque très usée prise dans une forte tempête.
  if (ship.condition <= 0 || (ship.condition < 22 && wx.force >= 10 && rng.chance(0.004 * (wx.force - 9)))) {
    sink(state, ctx, ship, notes, pos, wx, null, rng);
    return;
  }

  // Panne sèche : soutage d'urgence en mer, très cher.
  if (ship.fuel <= 0) {
    const qty = Math.round(T.tank * 0.3);
    const cost = qty * eco.worldFuelPrice(state) * 2.5 + 40000;
    money(state, company, -cost, 'carburant');
    ship.spent += cost;
    ship.fuel = qty;
    v.stalledUntil = state.t + 24;
    changeReputation(company, -1);
    note(state, notes, 'fuel', ship, `Panne sèche ! Le ${ship.name} a dû être ravitaillé en mer (${(cost / 1000).toFixed(0)} k$).`);
    shipLog(state, ship, 'Panne sèche, soutage d\'urgence');
  }

  if (v.progress >= route.nm) arrive(state, ctx, ship, notes, rng);
}

function articleStorm(name) {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (/^(ouragan|typhon|cyclone)/.test(lower)) return `un ${lower}`;
  if (/^(quarantièmes)/.test(lower)) return `les ${lower}`;
  if (/^(mistral|coup)/.test(lower)) return `un ${lower}`;
  return `une ${lower}`;
}

function arrive(state, ctx, ship, notes, rng) {
  const T = SHIP_TYPES[ship.type];
  const company = companyOf(state, ship);
  const to = ship.voyage.to;
  ship.status = 'port';
  ship.port = to;
  ship.voyage = null;
  ctx.forget(ship.id);
  const fee = eco.portFee(T, to);
  money(state, company, -fee, 'ports');
  ship.spent += fee;
  if (!company.portsServed.includes(to)) { company.portsServed.push(to); changeReputation(company, 0.5); }
  shipLog(state, ship, `Arrivée à ${portName(to)}`);
  // Sanctions (navire passé par un pays sous embargo) et douane (colis caché à bord).
  if (rng) {
    const onNote = (kind, text, extra = {}) => { const n0 = notes.length; note(state, notes, kind, ship, text); if (notes.length > n0) Object.assign(notes[notes.length - 1], extra); };
    checkSanctions(state, rng, ship, to, onNote);
    contrabandOnArrival(state, rng, ship, to, onNote);
  }
  // Inspection par l'État du port.
  const insp = rng && ship.busyWhat !== 'saisie' ? inspection(state, rng, ship, to, eco.ageYears(state, ship)) : null;
  if (insp) {
    const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
    st.inspections++;
    if (insp.kind === 'detention') st.detentions++;
  }
  if (insp?.kind === 'remarques') {
    note(state, notes, 'info', ship, `Inspection du ${ship.name} à ${portName(to)} : quelques remarques, mais le navire est autorisé à repartir. Pensez à le faire réparer.`);
  } else if (insp?.kind === 'detention') {
    money(state, company, -insp.fine, 'sinistres');
    costStat(state, 'detentions', insp.fine);
    money(state, company, -insp.cost, 'reparations');
    ship.spent += insp.fine + insp.cost;
    changeReputation(company, -3);
    ship.repairTo = insp.target;
    ship.detentionCost = insp.cost;
    const days = Math.round((insp.hours / 24) * 10) / 10;
    shipLog(state, ship, `Retenu par les inspecteurs à ${portName(to)}`);
    news(state, `Le ${ship.name} (${company.name}) est retenu à ${portName(to)} : navire jugé dangereux par les inspecteurs.`, { company: company.id, kind: 'disaster' });
    note(state, notes, 'detention', ship, `Le ${ship.name} est retenu à ${portName(to)} par les inspecteurs : amende de ${Math.round(insp.fine / 1000)} k$ et remise en état obligatoire à ${insp.target} % (${Math.round(insp.cost / 1000).toLocaleString('fr-FR')} k$, ${days} j).`);
    ship.detention = { hours: insp.hours };
  }
  if (ship.cargo?.contractId) {
    ship.pendingDelivery = ship.cargo.contractId;
    // Navire saisi par la douane : le déchargement attendra sa libération.
    if (ship.busyWhat !== 'saisie') act.startBusy(state, ship, 'déchargement', eco.handlingHours(to, ship.cargo.hold, ship.cargo.qty));
    const strike = state.strikes[to] > state.t ? ' (grève en cours : déchargement retardé)' : '';
    if (!ship.detention) note(state, notes, 'arrival', ship, `Le ${ship.name} est arrivé à ${portName(to)} et décharge${strike}.`);
  } else if (ship.detention) {
    act.startBusy(state, ship, 'détention', ship.detention.hours);
    ship.detentionStart = state.t;
    ship.detention = null;
  } else {
    note(state, notes, 'idle', ship, `Le ${ship.name} est arrivé à ${portName(to)}.`);
  }
}

function deliverContract(state, ship, rng, notes) {
  const c = contractById(state, ship.pendingDelivery);
  const company = companyOf(state, ship);
  let damage = ship.cargo?.damage || 0;
  ship.pendingDelivery = null;
  ship.cargo = null;
  if (!c) return;
  const penalty = eco.latePenalty(c, state.t);
  // Denrées périssables : chaque jour de retard en gâte une partie.
  if (GOODS[c.good].perishable && state.t > c.deadline) damage = Math.min(0.9, damage + ((state.t - c.deadline) / D) * 0.04);
  const pay = c.pay * (1 - penalty) * (1 - Math.min(0.85, damage * 1.15));
  ship.earned += pay;
  company.delivered++;
  if (damage > 0.005) changeReputation(company, -damage * 8);
  // Le paiement passe par l'encaissement (bouton « Encaisser » pour les joueurs).
  const payment = createPayment(state, ship, c, penalty, damage);
  taintShip(state, ship, c.to, c.pay);
  if (company.human) {
    note(state, notes, 'payment', ship, `Le ${ship.name} a livré à ${portName(c.to)}. Paiement à encaisser.`);
    notes[notes.length - 1].paymentId = payment.id;
  } else {
    const res = resolution(state, rng, payment);
    const contest = res.event?.kind === 'contestation' && res.event.withheld > 150000 && rng.chance(0.5);
    collect(state, rng, payment.id, contest ? 'contester' : 'accepter');
  }
  if (penalty > 0) {
    company.late++;
    changeReputation(company, -(2 + penalty * 10));
    shipLog(state, ship, `Livraison en retard à ${portName(c.to)} : ${(pay / 1000).toFixed(0)} k$ (pénalité ${Math.round(penalty * 100)} %)`);
  } else {
    changeReputation(company, 1.5 * (1 - company.reputation / 110));
    shipLog(state, ship, `Livraison à ${portName(c.to)} : ${(pay / 1000).toFixed(0)} k$`);
  }
  state.contracts = state.contracts.filter((x) => x !== c);
}

function sink(state, ctx, ship, notes, pos, wx, inc = null, rng = null) {
  const company = companyOf(state, ship);
  const T = SHIP_TYPES[ship.type];
  const startCond = ship.voyage?.startCond ?? ship.condition;
  // La cargaison et le fuel des soutes se répandent : pollution, surtout près des côtes sensibles.
  const route = ctx.shipRoute(ship);
  const nearCoast = !!(ship.voyage && route && (ship.voyage.progress < 150 || route.nm - ship.voyage.progress < 150));
  if (pos) spill(state, ship, company, pos, rng ? rng.range(0.4, 1) : 0.7, { sinking: true, nearCoast, notes, note });
  // L'assureur ne paie que si le navire était en état de naviguer au départ.
  const insurance = hullInsurance(state, ship, startCond, company);
  const cov = coverage(company, startCond);
  const st = (state.stats ??= { incidents: {}, detentions: 0, inspections: 0, sinkings: 0, uninsured: 0 });
  st.sinkings++;
  if (!insurance) st.uninsured++;
  if (insurance) { money(state, company, insurance, 'sinistres'); costStat(state, 'indemnites', -insurance); }
  // La cargaison : le chargeur réclame sa marchandise ; un négoce est couvert à 70 % si le navire était sain.
  let cargoLine = '';
  if (ship.cargo?.contractId) {
    // Le chargeur réclame sa marchandise. Le club P&I (assurance responsabilité) paie
    // pour un navire en état de naviguer : l'armateur ne règle que la franchise.
    const c = contractById(state, ship.cargo.contractId);
    const claim = c ? Math.round(c.qty * GOODS[c.good].price * 0.25) : 0;
    const covered = cov.pi;
    const due = covered ? Math.min(claim, Math.max(50000, Math.min(300000, claim * 0.1))) : claim;
    if (due) { money(state, company, -due, 'sinistres'); costStat(state, 'reclamations', due); }
    changeReputation(company, -10);
    const M = (x) => `${(x / 1e6).toFixed(2).replace('.', ',')} M$`;
    cargoLine = !claim ? '' : covered
      ? ` Le chargeur réclame ${M(claim)} : l'assurance P&I paie, il vous reste la franchise (${M(due)}).`
      : ` Le chargeur réclame ${M(claim)}, ${cov.seaworthy ? 'que votre assurance ne couvre pas' : 'que l\'assurance refuse de couvrir'}.`;
  } else if (ship.cargo) {
    const cover = Math.round((ship.cargo.cost || 0) * cov.cargo);
    if (cover) { money(state, company, cover, 'sinistres'); costStat(state, 'indemnites', -cover); }
    cargoLine = cover ? ` La marchandise est remboursée à ${Math.round(cov.cargo * 100)} % (${(cover / 1e6).toFixed(2).replace('.', ',')} M$).` : ' La marchandise est perdue.';
  }
  changeReputation(company, -5);
  const causes = {
    incendie: 'a sombré après un incendie', abordage: 'a coulé après un abordage', echouement: 's\'est brisé sur des récifs',
    voie_eau: 'a sombré : une voie d\'eau a eu raison de lui', gros_temps: 'a sombré dans la tempête',
  };
  const cause = inc && causes[inc.kind] ? causes[inc.kind] : wx.storm ? `a sombré dans ${articleStorm(wx.storm.name)}` : 'a sombré : sa coque, à bout de souffle, a cédé';
  const ins = insurance
    ? `L'assurance verse ${(insurance / 1e6).toFixed(2).replace('.', ',')} M$.`
    : cov.seaworthy ? 'Le navire n\'était pas assuré.' : 'L\'assureur refuse de payer : le navire n\'était pas en état de naviguer.';
  news(state, `Naufrage ! Le ${ship.name} (${company.name}) ${cause}. L'équipage a été hélitreuillé. ${ins}${cargoLine}`, { company: company.id, kind: 'disaster' });
  note(state, notes, 'sunk', ship, `Le ${ship.name} ${cause}. L'équipage est sauf. ${ins}${cargoLine}`);
  removeShip(state, ctx, ship);
  state.wrecks = state.wrecks || [];
  state.wrecks.push({ lon: pos.lon, lat: pos.lat, name: ship.name, t: state.t, type: T.name });
}

function deliverOrder(state, rng, order, notes) {
  state.orders = state.orders.filter((o) => o !== order);
  const company = state.companies[order.owner];
  if (company.bankrupt) return;
  const ship = createShip(state, rng, order.owner, order.type, { port: order.yard, name: order.name || undefined });
  ship.fuel = SHIP_TYPES[order.type].tank * 0.6;
  shipLog(state, ship, `Livré neuf par le chantier de ${portName(order.yard)}`);
  news(state, `${company.name} prend livraison du ${ship.name}, ${SHIP_TYPES[order.type].name.toLowerCase()} neuf, à ${portName(order.yard)}.`, { company: company.id, kind: 'fleet' });
  note(state, notes, 'idle', ship, `Le ${ship.name} sort du chantier de ${portName(order.yard)} : il attend vos ordres.`);
}

// ---------- Une fois par jour ----------
function daily(state, ctx, rng, notes) {
  eco.dailyMarketUpdate(state, rng);
  const ev = dailyEvents(state, rng);
  if (ev) notes.push({ kind: 'event', text: `${ev.title} — ${ev.text}` });
  dailyStorms(state, rng);
  eco.refreshContracts(state, ctx, rng);
  refreshOffers(state, ctx, rng);
  dailyReceivables(state, notes);

  for (const ship of state.ships) {
    const T = SHIP_TYPES[ship.type];
    const company = companyOf(state, ship);
    // Prime d'assurance selon la formule choisie par la compagnie.
    const prem = premiumPerDay(state, ship, company);
    if (prem) { money(state, company, -prem, 'exploitation'); ship.spent += prem; }
    // Salaires, plus les gardes armés éventuels (débarqués quand le navire est désarmé).
    const crew = (eco.crewDayCost(T, company.flag, ship.crew) + equipUpkeep(ship)) * (ship.status === 'laidup' ? 0.2 : 1);
    const opex = eco.opexDay(T, eco.ageYears(state, ship)) * (ship.status === 'laidup' ? 0.3 : 1);
    money(state, company, -crew, 'equipage');
    money(state, company, -opex, 'exploitation');
    ship.spent += crew + opex;
  }

  for (const company of state.companies) {
    if (company.bankrupt) continue;
    if (company.debt > 0) money(state, company, -(company.debt * interestRate(company)) / 365, 'interets');
    if (company.cash < 0) money(state, company, (company.cash * 0.2) / 365, 'interets'); // découvert à 20 %
    checkBank(state, ctx, company, notes);
    if (!company.human) aiDaily(state, ctx, rng, company);
  }

  const day = state.t / D;
  if (day % 7 === 0) { refreshUsedMarket(state, rng); recordHistory(state); }
  const d = dateOf(state.t);
  if (d.getUTCDate() === 1) monthly(state, notes);
  checkEnd(state, notes);
}

function monthly(state) {
  for (const company of state.companies) {
    if (company.bankrupt) continue;
    const profit = bookTotal(company.month);
    if (profit > 0) {
      const tax = profit * FLAGS[company.flag].tax;
      if (tax > 0) money(state, company, -tax, 'impots');
    }
    company.lastMonth = company.month;
    company.month = emptyBook();
  }
}

// La banque saisit un navire quand le découvert dépasse ce qu'elle tolère.
function checkBank(state, ctx, company, notes) {
  const limit = 300000 + 0.1 * fleetValue(state, company.id);
  if (company.cash >= -limit) { company.lowCashDays = 0; return; }
  const ships = shipsOf(state, company.id).sort((a, b) => eco.shipValue(state, a) - eco.shipValue(state, b));
  if (ships.length) {
    const s = ships[0];
    const price = eco.shipValue(state, s) * 0.75;
    company.cash += price;
    if (s.cargo?.contractId) changeReputation(company, -10);
    changeReputation(company, -6);
    news(state, `La banque de ${company.name} saisit et vend le ${s.name} pour ${(price / 1e6).toFixed(2).replace('.', ',')} M$.`, { company: company.id, kind: 'disaster' });
    if (company.human) notes.push({ kind: 'bank', company: company.id, text: `Découvert trop important : la banque a saisi et vendu le ${s.name}.` });
    removeShip(state, ctx, s);
  } else if (company.cash < -limit) {
    company.bankrupt = true;
    news(state, `${company.name} est en faillite.`, { company: company.id, kind: 'disaster' });
    if (company.human) notes.push({ kind: 'bankrupt', company: company.id, text: `${company.name} est en faillite.` });
  }
}

export function recordHistory(state) {
  state.marketHistory = state.marketHistory || [];
  state.marketHistory.push({
    t: state.t, fuel: Math.round(eco.worldFuelPrice(state)), ships: state.market.shipIndex,
    freight: { ...state.market.freight },
  });
  if (state.marketHistory.length > 600) state.marketHistory.splice(0, state.marketHistory.length - 600);
  for (const c of state.companies) {
    c.history.push({ t: state.t, nw: Math.round(netWorth(state, c.id)) });
    if (c.history.length > 600) c.history.splice(0, c.history.length - 600);
  }
}

export function ranking(state) {
  return state.companies
    .map((c) => ({ company: c, worth: netWorth(state, c.id) }))
    .sort((a, b) => (a.company.bankrupt - b.company.bankrupt) || b.worth - a.worth);
}

function checkEnd(state, notes) {
  const humans = state.companies.filter((c) => c.human);
  const years = state.settings.duration;
  let reason = null;
  if (years && state.t >= years * 365 * D) reason = `Fin de la partie : ${years} ans se sont écoulés.`;
  else if (humans.length && humans.every((c) => c.bankrupt)) reason = 'Toutes les compagnies des joueurs ont fait faillite.';
  if (reason) {
    state.over = { reason, t: state.t };
    recordHistory(state);
    notes.push({ kind: 'over', text: reason });
  }
}

export { formatDate };
