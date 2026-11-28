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
import { logoBadge } from './logos.js';
import { localRect, viewport } from './scale.js';

const D = 24;
const TAKEN_SHOWN = 3 * D; // « prise par … » reste affiché trois jours (ou jusqu'à fermeture)
const COLLAPSE_KEY = 'pda-opps-collapsed';

// Délai (jours) pour qu'un navire soit disponible dans un port : fin du voyage ou de l'escale en
// cours, puis la traversée. null s'il ne peut pas y aller (immobilisé, passage fermé).
function reachDays(state, ctx, s, port) {
  if (s.status === 'laidup' || s.seized || s.hijacked) return null;
  const at = s.status === 'sea' ? s.voyage.to : s.port;
  const t0 = s.status === 'sea' ? etaOf(state, ctx, s) : Math.max(state.t, s.busyUntil || 0);
  const info = at === port ? { nm: 0 } : ctx.distanceInfo(at, port, ctx.closedCanals(state, SHIP_TYPES[s.type].draft, s));
  if (!info) return null;
  return (t0 + info.nm / SHIP_TYPES[s.type].speed - state.t) / D;
}
// Ces navires, du plus proche au plus lointain : [{ ship, days }].
function reachList(state, ctx, ships, port) {
  return ships.map((ship) => ({ ship, days: reachDays(state, ctx, ship, port) })).filter((r) => r.days != null).sort((a, b) => a.days - b.days);
}

// Vos navires qui peuvent prendre une affaire en or à temps (capables, et au port de départ
// avant qu'elle expire), avec leur délai d'arrivée en jours.
export function goldenReach(state, ctx, cid, c) {
  const free = shipsFor(state, cid, c).filter((s) => !(s.status === 'port' && (s.cargo || s.dark))); // occupé par une autre cargaison
  return reachList(state, ctx, free, c.from).filter((r) => state.t + r.days * D <= c.expires);
}

// Un navire libre (cales vides) sur place ou à moins d'un jour : seule une affaire en or aussi proche
// mérite une alerte sonore ; les autres apparaissent sans bruit dans la colonne.
const GOLDEN_ALERT_DAYS = 1;
export function goldenNear(state, ctx, cid, c) {
  return goldenReach(state, ctx, cid, c).some((r) => r.days <= GOLDEN_ALERT_DAYS && !r.ship.cargo && !r.ship.dark);
}
// Un appel d'offres que l'un de vos navires peut servir (une cale pour cette marchandise, et il entre
// dans le port acheteur). Sinon, ni carte, ni alerte : « Aucun navire pour cette cargaison » ne sert à rien.
export function tenderServable(state, cid, t) {
  return usable(state, cid).some((s) => eco.holdFor(s.type, t.good) && eco.fitsPort(t.port, s.type));
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
  // Appels d'offres des villes : ceux qu'un de vos navires peut servir, et quelques jours encore une
  // fois complets (une carte déjà montrée reste jusqu'au bout).
  for (const t of state.tenders || []) {
    const key = `tender:${t.id}`;
    if (dismissed[key] != null) continue;
    const open = t.left > 0 && t.until > state.t;
    if ((open && tenderServable(state, cid, t)) || co.seenOpps?.[key] != null) out.push({ key, kind: 'tender', t, open });
  }
  return out;
}

// Vos navires capables de transporter cette cargaison (type de cale, capacité, tirant d'eau, vitesse).
function shipsFor(state, cid, c) {
  return shipsOf(state, cid).filter((s) => {
    const T = SHIP_TYPES[s.type], hold = eco.holdFor(s.type, c.good);
    return hold && T.dwt >= c.qty && eco.fitsPort(c.from, s.type) && eco.fitsPort(c.to, s.type)
      && eco.portHandles(c.from, hold) && eco.portHandles(c.to, hold) && (!c.minSpeed || T.maxSpeed >= c.minSpeed);
  });
}
// « Jusqu'au 7 janv. (7 j) » (sans l'année : les opportunités durent quelques semaines)
const dshort = (t) => date(t, true).replace(/\s\d{4}$/, '');
const daysLeft = (state, t) => `(${Math.max(0, Math.ceil((t - state.t) / D))} j)`;
const untilLine = (state, t, extra = null) => h('div.opp-until', [h('span', `Jusqu'au ${dshort(t)}`), ' ', h('span.muted', daysLeft(state, t)), ...(extra || [])]);
const logo = (co, px = 16) => co ? h('span.opp-logo', { html: logoBadge(co.logo, co.color, px), title: co.name }) : null;
const when = (d) => (d < 0.5 ? 'sur place' : days(d));
// Un navire : nom, type, délai pour être sur place.
const shipBits = (r) => [h('b', { 'data-no-tr': '' }, r.ship.name), ' · ', h('span', SHIP_TYPES[r.ship.type].name), ' · ', h('span', when(r.days))];
// La ligne « navires » de la carte : le plus proche, et combien d'autres.
function shipsRow(list, none) {
  if (!list.length) return h('div.opp-ships.muted', none);
  return h('div.opp-ships', [h('span.opp-ship-icon', '🚢'), ' ', ...shipBits(list[0]), list.length > 1 ? h('span.muted', ` +${list.length - 1}`) : null]);
}
// Le détail (carte ouverte au survol) : jusqu'à quatre navires, un par ligne.
function shipsMore(list) {
  if (list.length < 2) return [];
  return [h('div.muted', 'Vos navires :'), ...list.slice(0, 4).map((r) => h('div.opp-ship-line', ['🚢 ', ...shipBits(r)])), list.length > 4 ? h('div.muted', `+${list.length - 4}`) : null];
}
const usable = (state, cid) => shipsOf(state, cid).filter((s) => s.status !== 'laidup' && !s.seized && !s.hijacked);

// Chaque carte : { head, lines, actions, more } — more = le détail qui se déplie au survol.
function goldenCard(app, o) {
  const { state } = app;
  const c = o.c, G = GOODS[c.good];
  const reach = o.reach || [];
  const look = () => {
    const here = reach.find((r) => r.ship.status === 'port' && r.ship.port === c.from)?.ship;
    if (here) { app.open('ship', here.id, 'contrats'); app.focusShip(here.id); } else { app.open('port', c.from); app.map.centerOn(PORTS[c.from].lon, PORTS[c.from].lat, Math.max(app.map.view.scale, 4)); }
  };
  return {
    head: [h('span.opp-icon', '★'), h('b', `${portName(c.from)} → ${portName(c.to)}`)],
    lines: [
      h('div.opp-body', [h('span', `${G.icon} ${tonnes(c.qty)}`), ' · ', h('b.pos', money(c.pay))]),
      o.open ? shipsRow(reach, 'Aucun navire à temps') : null,
      o.open ? untilLine(state, c.expires) : h('div.opp-until.neg', `Prise par ${state.companies[c.takenCo]?.name || 'un concurrent'}`),
    ],
    actions: o.open ? [h('button.btn.small', { onclick: look }, 'Voir')] : [],
    more: o.open ? [
      h('b', 'Affaire en or'), h('div', `${G.name} · ${tonnes(c.qty)} de ${portName(c.from)} à ${portName(c.to)}`),
      h('div', isCleanGood(c.good) ? '🤝 Confiance et 💚 vertu si elle arrive à l\'heure (marchandise ni fossile ni polluante).' : '🤝 Confiance si elle arrive à l\'heure.'),
      ...shipsMore(reach),
    ] : null,
  };
}

function aidCard(app, o) {
  const { state } = app;
  const cid = app.ui.activeCompany;
  const until = Math.max(...o.list.map((c) => c.expires));
  // Chaque navire capable, avec son délai jusqu'au port de départ le plus proche.
  const best = new Map();
  for (const c of o.list) for (const r of reachList(state, app.ctx, shipsFor(state, cid, c).filter((s) => !(s.status === 'port' && (s.cargo || s.dark))), c.from)) {
    if (!best.has(r.ship.id) || best.get(r.ship.id).days > r.days) best.set(r.ship.id, r);
  }
  const able = [...best.values()].sort((a, b) => a.days - b.days);
  const goTo = (p) => { app.open('port', p); app.map.centerOn(PORTS[p].lon, PORTS[p].lat, Math.max(app.map.view.scale, 4)); };
  return {
    head: [h('span.opp-icon', '❤'), h('b', `Aide · ${portName(o.to)}`)],
    lines: [
      h('div.opp-from', [...new Set(o.list.map((c) => c.from))].map((p) => {
        const here = o.list.filter((c) => c.from === p);
        return h('button.opp-port', { type: 'button', onclick: () => goTo(p), title: here.map((c) => `${GOODS[c.good].name} · ${tonnes(c.qty)}`).join(' ; ') }, `${[...new Set(here.map((c) => GOODS[c.good].icon))].join('')} ${portName(p)}`);
      })),
      shipsRow(able, 'Aucun navire capable'),
      untilLine(state, until, [' · ', h('span.pos', `💚 +${o.charity.rep}`)]),
    ],
    actions: [],
    more: [
      h('b', 'Aide d\'urgence'),
      h('div', [h('span', { 'data-no-tr': '' }, o.charity.name), ' ', h('span', `cherche des navires. Payée à prix coûtant partiel ; vertu +${o.charity.rep} si elle arrive à l'heure.`)]),
      ...shipsMore(able),
    ],
  };
}

function leadCard(app, o) {
  const { state } = app;
  const c = o.c, G = GOODS[c.good];
  const ship = c.prospectShip != null ? state.ships.find((s) => s.id === c.prospectShip && s.owner === app.ui.activeCompany) : null;
  const here = ship && ship.status === 'port' && ship.port === c.from;
  const reach = ship ? reachList(state, app.ctx, [ship], c.from) : [];
  const go = () => {
    if (here) app.open('ship', ship.id, 'contrats');
    else if (ship && ship.status === 'port') { app.form.dest[ship.id] = c.from; app.open('ship', ship.id, 'depart'); }
    else app.open('port', c.from);
    if (ship) app.focusShip(ship.id); else app.map.centerOn(PORTS[c.from].lon, PORTS[c.from].lat, Math.max(app.map.view.scale, 4));
  };
  return {
    head: [h('span.opp-icon', '📋'), h('b', `${portName(c.from)} → ${portName(c.to)}`)],
    lines: [
      h('div.opp-body', [h('span', `${G.icon} ${tonnes(c.qty)}`), ' · ', h('b.pos', money(c.pay))]),
      ship ? shipsRow(reach, 'Navire réservé indisponible') : null,
      untilLine(state, c.reservedUntil),
    ],
    actions: [h('button.btn.small', { onclick: go }, here ? 'Voir' : ship && ship.status === 'port' ? 'Y aller' : 'Port')],
    more: [
      h('b', 'Piste de démarchage'), h('div', `${G.name} · ${tonnes(c.qty)} de ${portName(c.from)} à ${portName(c.to)}`),
      ship ? h('div', [h('span', 'Réservée pour le'), ' ', h('b', { 'data-no-tr': '' }, ship.name), here ? h('span', ' (sur place)') : null]) : null,
    ],
  };
}

function tenderCard(app, o) {
  const { state } = app;
  const t = o.t, G = GOODS[t.good], cid = app.ui.activeCompany;
  const market = eco.sellPrice(state, t.port, t.good);
  const diff = Math.round(t.unit - market);
  const committed = t.commits.reduce((s, c) => s + c.qty, 0);
  // Vos navires qui transportent cette marchandise, et leur délai jusqu'au port acheteur.
  const able = reachList(state, app.ctx, usable(state, cid).filter((s) => eco.holdFor(s.type, t.good) && eco.fitsPort(t.port, s.type)), t.port);
  const look = () => { app.form.good = t.good; app.open('markets', null, 'produits'); };
  return {
    head: [h('span.opp-icon', '📣'), h('b', `${portName(t.port)} · ${G.icon} ${G.name}`)],
    lines: [
      // 2 816 $/t (+312 $/t) · 16 000 / 16 000 t
      h('div.opp-body', [h('b.pos', `${money(t.unit)}/t`), ' ', h('span', { class: diff >= 0 ? 'pos' : 'neg' }, `(${diff >= 0 ? '+' : '−'}${money(Math.abs(diff))}/t)`), ' · ', h('span', `${tonnes(t.left).replace(/\s?t$/, '')} / ${tonnes(t.qty)}`)]),
      // [logo] 4 232 t · 7 janv. (chaque concurrent engagé, sa quantité, son arrivée)
      t.commits.length ? h('div.opp-commits', [...t.commits.slice(0, 2).map((c) => h('span.opp-commit', [logo(state.companies[c.company]), h('span', tonnes(c.qty)), h('span.muted', '·'), h('span', dshort(c.eta))])), t.commits.length > 2 ? h('span.muted', `+${t.commits.length - 2}`) : null]) : null,
      o.open ? shipsRow(able, 'Aucun navire pour cette cargaison') : null,
      o.open ? untilLine(state, t.until) : h('div.opp-until.muted', t.left <= 0 ? 'Complet.' : 'Terminé.'),
    ],
    actions: o.open ? [h('button.btn.small', { onclick: look }, 'Marchés')] : [],
    more: o.open ? [
      h('b', 'Appel d\'offres'),
      h('div', `${portName(t.port)} achète ${G.name.toLowerCase()} à ${money(t.unit)}/t, premier arrivé premier servi.`),
      ...t.commits.map((c) => h('div', [h('b', { 'data-no-tr': '' }, state.companies[c.company]?.name || '?'), ' ', h('span', `livrera ${tonnes(c.qty)} vers le ${date(c.eta, true)}`)])),
      t.commits.length ? h('div', `Libre après ces livraisons : ${tonnes(Math.max(0, t.left - committed))}`) : null,
      h('div', isCleanGood(t.good) ? '🤝 Confiance et 💚 vertu à chaque livraison (marchandise ni fossile ni polluante).' : '🤝 Confiance à chaque livraison.'),
      h('div.muted', 'Où en acheter : voyez les Marchés.'),
      ...shipsMore(able),
    ] : null,
  };
}

// La carte survolée se déplie (après un court instant, pour qu'un passage de souris ne fasse pas
// sauter la colonne). Elle reste dépliée si la carte est redessinée pendant le survol.
const OPEN_DELAY = 140;
let openKey = null, openTimer = 0;

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
  // Toute la hauteur entre le bandeau des nouvelles et le classement, à la largeur du classement.
  const st = document.getElementById('standings');
  const r = st && !st.hidden ? localRect(st) : null; // en px de l'interface (zoom de ui/scale.js)
  root.style.bottom = `${r && r.height ? Math.round(viewport().h - r.top + 8) : 46}px`;
  const tkEl = document.getElementById('ticker');
  const tk = tkEl ? localRect(tkEl) : null;
  root.style.top = `${tk && tk.height ? Math.round(tk.bottom + 10) : 64}px`;
  root.style.width = `${Math.max(372, Math.round(r?.width || 0))}px`;
  let collapsed = false;
  try { collapsed = (localStorage.getItem(COLLAPSE_KEY) ?? '0') === '1'; } catch { /* stockage indisponible */ }
  const key = `${cid}|${collapsed}|${Math.floor(state.t / 6)}|` + list.map((o) => `${o.key}:${o.open ?? ''}:${o.c?.takenBy ?? ''}:${o.list?.length ?? ''}:${o.t ? `${o.t.left}/${o.t.commits.length}` : ''}`).join(',');
  root.hidden = !list.length;
  if (key === lastKey) return;
  lastKey = key;
  if (!list.length) { root.replaceChildren(); return; }
  const toggle = () => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1'); } catch { /* stockage indisponible */ } lastKey = ''; renderOpps(app); };
  const dismiss = (k) => { const co = state.companies[cid]; (co.dismissedOpps ??= {})[k] = state.t; lastKey = ''; renderOpps(app); };
  root.replaceChildren(
    h('button.opps-toggle', { type: 'button', 'data-guide': 'opps', 'aria-expanded': collapsed ? 'false' : 'true', onclick: toggle }, [h('span', `Opportunités (${list.length})`), ' ', h('span', collapsed ? '▴' : '▾')]),
    ...(collapsed ? [] : list.map((o) => {
      const k = o.kind === 'golden' ? goldenCard(app, o) : o.kind === 'tender' ? tenderCard(app, o) : o.kind === 'lead' ? leadCard(app, o) : aidCard(app, o);
      const card = h('div.opp', { class: `${o.kind}${o.open === false ? ' gone' : ''}${k.more && openKey === o.key ? ' open' : ''}` }, [
        h('div.opp-main', [h('div.opp-head', k.head), ...k.lines.filter(Boolean)]),
        h('div.opp-side', [h('button.opp-close', { type: 'button', 'aria-label': 'Fermer', title: 'Fermer', onclick: () => dismiss(o.key) }, '×'), ...k.actions]),
        k.more ? h('div.opp-more', [h('div.opp-more-in', [h('div.opp-more-body', k.more.filter(Boolean))])]) : null,
      ]);
      if (k.more) {
        card.addEventListener('mouseenter', () => { clearTimeout(openTimer); openTimer = setTimeout(() => { openKey = o.key; card.classList.add('open'); }, OPEN_DELAY); });
        card.addEventListener('mouseleave', () => { clearTimeout(openTimer); if (openKey === o.key) openKey = null; card.classList.remove('open'); });
      }
      return card;
    })),
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
