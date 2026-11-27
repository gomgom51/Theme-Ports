// Cartes d'opportunité : restent à l'écran (en bas à gauche, au-dessus du classement) tant que
// le joueur ne les ferme pas. Affaires en or, missions d'aide d'urgence (et, plus tard, appels
// d'offres des villes). Construites à partir de l'état de la partie : elles survivent à un
// chargement et montrent toujours les chiffres du moment (prise par un concurrent, date limite…).
import { PORTS } from '../data/ports.js';
import { GOODS, isCleanGood } from '../data/goods.js';
import { SHIP_TYPES } from '../data/ships.js';
import * as eco from '../sim/economy.js';
import { portName, shipsOf } from '../sim/core.js';
import { h, money, tonnes, date, days } from './dom.js';
import { etaOf } from './panel-ship.js';
import { hullBarred } from '../sim/incidents.js';

const D = 24;
const TAKEN_SHOWN = 3 * D; // « prise par … » reste affiché trois jours (ou jusqu'à fermeture)
const COLLAPSE_KEY = 'pda-opps-collapsed';

// Vos navires qui peuvent prendre une affaire en or à temps (capables, et au port de départ
// avant qu'elle expire), avec leur délai d'arrivée en jours.
export function goldenReach(state, ctx, cid, c) {
  const out = [];
  for (const s of shipsFor(state, cid, c)) {
    if (s.status === 'laidup' || s.seized || s.hijacked) continue;
    if (s.status === 'port' && (s.cargo || s.dark)) continue; // occupé par une autre cargaison
    const at = s.status === 'sea' ? s.voyage.to : s.port;
    const t0 = s.status === 'sea' ? etaOf(state, ctx, s) : Math.max(state.t, s.busyUntil || 0);
    const info = at === c.from ? { nm: 0 } : ctx.distanceInfo(at, c.from, ctx.closedCanals(state, SHIP_TYPES[s.type].draft, s));
    if (!info) continue;
    const arrive = t0 + info.nm / SHIP_TYPES[s.type].speed;
    if (arrive <= c.expires) out.push({ ship: s, days: (arrive - state.t) / D });
  }
  return out.sort((a, b) => a.days - b.days);
}

// Les opportunités du moment pour une compagnie (sans celles qu'elle a fermées). Affaires en or :
// seulement celles annoncées en cours de partie, qu'un de vos navires peut prendre à temps.
export function opportunities(state, ctx, cid) {
  const co = state.companies[cid];
  const dismissed = co?.dismissedOpps || {};
  const out = [];
  for (const c of state.contracts) {
    if (!c.golden || !c.announced) continue;
    const key = `golden:${c.id}`;
    if (dismissed[key] != null || (c.takenBy !== null && c.takenCo === cid)) continue;
    const open = c.takenBy === null && c.expires > state.t;
    if (open) {
      const reach = goldenReach(state, ctx, cid, c);
      if (reach.length) out.push({ key, kind: 'golden', c, open, reach });
      else if (co.seenOpps?.[key] != null) out.push({ key, kind: 'golden', c, open, reach }); // déjà montrée : elle reste
    } else if (state.t - (c.takenAt ?? state.t) <= TAKEN_SHOWN && co.seenOpps?.[key] != null) out.push({ key, kind: 'golden', c, open });
  }
  const aid = new Map();
  for (const c of state.contracts) {
    if (!c.charity || c.takenBy !== null || c.expires <= state.t) continue;
    const key = `aid:${c.to}:${c.charity.t ?? 0}`;
    if (dismissed[key] != null) continue;
    if (!aid.has(key)) aid.set(key, { key, kind: 'aid', to: c.to, charity: c.charity, list: [] });
    aid.get(key).list.push(c);
  }
  out.push(...aid.values());
  // Pistes de démarchage : un contrat réservé dans un port (souvent proche), le temps d'y aller.
  for (const c of state.contracts) {
    if (!c.prospect || c.reservedFor !== cid || c.takenBy !== null || !(c.reservedUntil > state.t)) continue;
    const key = `lead:${c.id}`;
    if (dismissed[key] != null) continue;
    out.push({ key, kind: 'lead', c, open: true });
  }
  // Appels d'offres des villes : tous (ils sont rares), et quelques jours encore une fois complets.
  for (const t of state.tenders || []) {
    const key = `tender:${t.id}`;
    if (dismissed[key] != null) continue;
    const open = t.left > 0 && t.until > state.t;
    if (open || co.seenOpps?.[key] != null) out.push({ key, kind: 'tender', t, open });
  }
  return out;
}

// Vos navires capables de transporter cette cargaison (type de cale, capacité, tirant d'eau, vitesse).
function shipsFor(state, cid, c) {
  return shipsOf(state, cid).filter((s) => {
    const T = SHIP_TYPES[s.type], hold = eco.holdFor(s.type, c.good);
    return hold && T.dwt >= c.qty && eco.fitsPort(c.from, s.type) && eco.fitsPort(c.to, s.type) && !hullBarred(s, c.to)
      && eco.portHandles(c.from, hold) && eco.portHandles(c.to, hold) && (!c.minSpeed || T.maxSpeed >= c.minSpeed);
  });
}
function shipsLine(names, none) {
  if (!names.length) return h('div.opp-ships.muted', none);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  return h('div.opp-ships', [h('span', 'Vos navires capables :'), ' ', h('b', { 'data-no-tr': '' }, shown)]);
}
const untilLine = (state, t) => h('div.opp-until', [h('span', 'Jusqu\'au'), ' ', h('b', date(t, true)), ' ', h('span.muted', `(dans ${days(Math.max(0, (t - state.t) / D))})`)]);

function goldenCard(app, o) {
  const { state } = app;
  const c = o.c, cid = app.ui.activeCompany, G = GOODS[c.good];
  const reach = o.reach || [];
  const look = () => {
    const here = reach.find((r) => r.ship.status === 'port' && r.ship.port === c.from)?.ship;
    if (here) { app.open('ship', here.id, 'contrats'); app.focusShip(here.id); } else { app.open('port', c.from); app.map.centerOn(PORTS[c.from].lon, PORTS[c.from].lat, Math.max(app.map.view.scale, 4)); }
  };
  return [
    h('div.opp-head', [h('span.opp-icon', '★'), h('b', `Affaire en or à ${portName(c.from)}`)]),
    h('div.opp-body', [h('span', `${G.icon} ${G.name}`), ` · ${tonnes(c.qty)} → `, h('b', portName(c.to)), ' · ', h('b.pos', money(c.pay))]),
    o.open ? untilLine(state, c.expires) : h('div.opp-until.neg', `Prise par ${state.companies[c.takenCo]?.name || 'un concurrent'}`),
    o.open ? h('div.opp-gain', isCleanGood(c.good) ? '🤝 Confiance et 💚 vertu si elle arrive à l\'heure (marchandise ni fossile ni polluante).' : '🤝 Confiance si elle arrive à l\'heure.') : null,
    o.open ? (reach.length
      ? h('div.opp-ships', [h('span', 'À temps :'), ' ', ...reach.slice(0, 3).flatMap((r, i) => [i ? ', ' : null, h('b', { 'data-no-tr': '' }, r.ship.name), ' (', h('span', r.days < 0.5 ? 'sur place' : days(r.days)), ')']), reach.length > 3 ? ` +${reach.length - 3}` : null])
      : h('div.opp-ships.muted', 'Plus aucun de vos navires ne peut y arriver à temps.')) : null,
    o.open ? h('div.opp-actions', [h('button.btn.small', { onclick: look }, 'Voir')]) : null,
  ];
}

function aidCard(app, o) {
  const { state } = app;
  const cid = app.ui.activeCompany;
  const until = Math.max(...o.list.map((c) => c.expires));
  const able = [...new Set(o.list.flatMap((c) => shipsFor(state, cid, c).map((s) => s.name)))];
  const goTo = (p) => { app.open('port', p); app.map.centerOn(PORTS[p].lon, PORTS[p].lat, Math.max(app.map.view.scale, 4)); };
  return [
    h('div.opp-head', [h('span.opp-icon', '❤'), h('b', `Aide d'urgence pour ${portName(o.to)}`)]),
    h('div.opp-body', [h('span', { 'data-no-tr': '' }, o.charity.name), ' ', h('span', `cherche des navires. Payée à prix coûtant partiel ; vertu +${o.charity.rep} si elle arrive à l'heure.`)]),
    untilLine(state, until),
    // Un port de départ par bouton (plusieurs contrats au même port : leurs marchandises côte à côte).
    h('div.opp-from', [h('span', 'Au départ de :'), ...[...new Set(o.list.map((c) => c.from))].map((p) => {
      const here = o.list.filter((c) => c.from === p);
      return h('button.opp-port', { type: 'button', onclick: () => goTo(p), title: here.map((c) => `${GOODS[c.good].name} · ${tonnes(c.qty)}`).join(' ; ') }, `${[...new Set(here.map((c) => GOODS[c.good].icon))].join('')} ${portName(p)}`);
    })]),
    shipsLine(able, 'Aucun de vos navires ne peut transporter cette aide.'),
  ];
}

function leadCard(app, o) {
  const { state } = app;
  const c = o.c, G = GOODS[c.good];
  const ship = c.prospectShip != null ? state.ships.find((s) => s.id === c.prospectShip && s.owner === app.ui.activeCompany) : null;
  const here = ship && ship.status === 'port' && ship.port === c.from;
  const go = () => {
    if (here) app.open('ship', ship.id, 'contrats');
    else if (ship && ship.status === 'port') { app.form.dest[ship.id] = c.from; app.open('ship', ship.id, 'depart'); }
    else app.open('port', c.from);
    if (ship) app.focusShip(ship.id); else app.map.centerOn(PORTS[c.from].lon, PORTS[c.from].lat, Math.max(app.map.view.scale, 4));
  };
  return [
    h('div.opp-head', [h('span.opp-icon', '📋'), h('b', `Piste de démarchage à ${portName(c.from)}`)]),
    h('div.opp-body', [h('span', `${G.icon} ${G.name}`), ` · ${tonnes(c.qty)} → `, h('b', portName(c.to)), ' · ', h('b.pos', money(c.pay))]),
    ship ? h('div.opp-ships', [h('span', 'Réservée pour le'), ' ', h('b', { 'data-no-tr': '' }, ship.name), here ? h('span', ' (sur place)') : null]) : null,
    untilLine(state, c.reservedUntil),
    h('div.opp-actions', [h('button.btn.small', { onclick: go }, here ? 'Voir le contrat' : ship && ship.status === 'port' ? 'Y aller' : 'Voir le port')]),
  ];
}

function tenderCard(app, o) {
  const { state } = app;
  const t = o.t, G = GOODS[t.good], cid = app.ui.activeCompany;
  const market = eco.sellPrice(state, t.port, t.good);
  const committed = t.commits.reduce((s, c) => s + c.qty, 0);
  const able = shipsOf(state, cid).filter((s) => eco.holdFor(s.type, t.good)).map((s) => s.name);
  const look = () => { app.form.good = t.good; app.open('markets', null, 'produits'); };
  return [
    h('div.opp-head', [h('span.opp-icon', '📣'), h('b', `${portName(t.port)} achète : ${G.name.toLowerCase()}`)]),
    h('div.opp-body', [h('b.pos', `${money(t.unit)}/t`), ' ', h('span.muted', `(cours ${money(market)}/t)`), ' · ', h('span', `${tonnes(t.left)} restantes sur ${tonnes(t.qty)}`)]),
    ...t.commits.slice(0, 3).map((c) => h('div.opp-commit', [h('b', { 'data-no-tr': '' }, state.companies[c.company]?.name || '?'), ' ', h('span', `livrera ${tonnes(c.qty)} vers le ${date(c.eta, true)}`)])),
    t.commits.length && o.open ? h('div.opp-commit.muted', `Libre après ces livraisons : ${tonnes(Math.max(0, t.left - committed))}`) : null,
    o.open ? untilLine(state, t.until) : h('div.opp-until.muted', t.left <= 0 ? 'Complet.' : 'Terminé.'),
    o.open ? h('div.opp-gain', isCleanGood(t.good) ? '🤝 Confiance et 💚 vertu à chaque livraison (marchandise ni fossile ni polluante).' : '🤝 Confiance à chaque livraison.') : null,
    o.open ? h('div.opp-ships.muted', 'Où en acheter : voyez les Marchés.') : null,
    o.open ? shipsLine(able, `Aucun de vos navires ne transporte ce type de marchandise.`) : null,
    o.open ? h('div.opp-actions', [h('button.btn.small', { onclick: look }, 'Marchés')]) : null,
  ];
}

let lastKey = '';
export function renderOpps(app) {
  let root = document.getElementById('opps');
  if (!root) { root = h('div.opps', { id: 'opps', 'aria-live': 'polite' }); document.body.append(root); }
  const { state } = app;
  if (app.mode !== 'game' || !state) { root.hidden = true; lastKey = ''; return; }
  const cid = app.ui.activeCompany;
  const list = opportunities(state, app.ctx, cid);
  // Mémorise les cartes montrées (une affaire déjà vue reste affichée, et sa prise est signalée).
  const co = state.companies[cid];
  for (const o of list) (co.seenOpps ??= {})[o.key] ??= state.t;
  // Au-dessus du classement (sa hauteur varie).
  const st = document.getElementById('standings');
  const r = st && !st.hidden ? st.getBoundingClientRect() : null;
  root.style.bottom = `${r && r.height ? Math.round(innerHeight - r.top + 8) : 46}px`;
  let collapsed = false;
  try { collapsed = (localStorage.getItem(COLLAPSE_KEY) ?? (innerWidth < 600 ? '1' : '0')) === '1'; } catch { /* stockage indisponible */ }
  const key = `${cid}|${collapsed}|${Math.floor(state.t / 6)}|` + list.map((o) => `${o.key}:${o.open ?? ''}:${o.c?.takenBy ?? ''}:${o.list?.length ?? ''}:${o.t ? `${o.t.left}/${o.t.commits.length}` : ''}`).join(',');
  root.hidden = !list.length;
  if (key === lastKey) return;
  lastKey = key;
  if (!list.length) { root.replaceChildren(); return; }
  const toggle = () => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1'); } catch { /* stockage indisponible */ } lastKey = ''; renderOpps(app); };
  const dismiss = (k) => { const co = state.companies[cid]; (co.dismissedOpps ??= {})[k] = state.t; lastKey = ''; renderOpps(app); };
  root.replaceChildren(
    h('button.opps-toggle', { type: 'button', 'aria-expanded': collapsed ? 'false' : 'true', onclick: toggle }, [h('span', `Opportunités (${list.length})`), ' ', h('span', collapsed ? '▴' : '▾')]),
    ...(collapsed ? [] : list.map((o) => h('div.opp', { class: `${o.kind}${o.open === false ? ' gone' : ''}` }, [
      h('button.opp-close', { type: 'button', 'aria-label': 'Fermer', title: 'Fermer', onclick: () => dismiss(o.key) }, '×'),
      ...(o.kind === 'golden' ? goldenCard(app, o) : o.kind === 'tender' ? tenderCard(app, o) : o.kind === 'lead' ? leadCard(app, o) : aidCard(app, o)),
    ]))),
  );
}

// Les fermetures anciennes sont oubliées (la sauvegarde ne grossit pas).
export function pruneDismissed(state) {
  for (const co of state.companies) {
    if (!co.dismissedOpps) continue;
    for (const [k, t] of Object.entries(co.dismissedOpps)) if (state.t - t > 120 * D) delete co.dismissedOpps[k];
  }
  for (const co of state.companies) {
    if (!co.seenOpps) continue;
    for (const [k, t] of Object.entries(co.seenOpps)) if (state.t - t > 120 * D) delete co.seenOpps[k];
  }
}
