// Panneaux : flotte, port, courtier, bureau, marchés, journal, aide.
import { PORTS, PORT_IDS, FLAGS, draftText } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS, GOOD_IDS, HOLDS } from '../data/goods.js';
import * as eco from '../sim/economy.js';
import * as act from '../sim/actions.js';
import {
  shipsOf, portName, netWorth, fleetValue, creditLimit, interestRate, BOOK_LABELS, bookTotal,
} from '../sim/core.js';
import { ranking } from '../sim/game.js';
import { yearOf } from '../sim/util.js';
import { shipStatusText } from './panel-ship.js';
import { h, money, tonnes, num, num1, pct, date, days, bar, confirmBox, lineChart, dialog } from './dom.js';
import { shipSVG, artForShip, SHIP_ART } from './shipart.js';
import { shipStats, radarSVG } from './radar.js';
import { LOGO_IDS, logoBadge } from './logos.js';
import { flagEl } from './flags.js';
import { officeSVG, officeTier, OFFICE_TIERS } from './officeart.js';
import { pendingList } from './payment.js';

const badge = (c, size = 22) => h('span.badge-wrap', { html: logoBadge(c.logo, c.color, size) });

const LIVERIES = ['#5d6b75', '#7a5c3e', '#3f5e4a', '#6b4f6b', '#4a5f7a', '#8a6d2f'];

// Grande fiche d'un navire : dessin, radar et caractéristiques.
export function inspectShip({ typeId, condition = 100, age = 0, name = '', color, logo, laden = false, seed, subtitle = '' }) {
  const T = SHIP_TYPES[typeId];
  const body = h('div.inspect', [
    h('div.inspect-art', { html: shipSVG(typeId, { condition, age, color, logo, name, laden, seed: seed ?? name }) }),
    h('div.inspect-row', [
      h('div.radar-wrap', { html: radarSVG(shipStats(typeId, { condition, age }), { color, size: 270 }) }),
      h('div.inspect-specs', [
        h('p.blurb', T.blurb),
        h('div.ship-stats', [
          ['Longueur', `${SHIP_ART[typeId].L} m`], ['Capacité', tonnes(T.dwt)], ['Vitesse', `${num1(T.speed)} nœuds (max ${num1(T.maxSpeed)})`],
          ['Consommation', `${T.burn} t/jour`], ['Soutes', tonnes(T.tank)], ['Tirant d\'eau', `${num1(T.draft)} m`],
          ['Équipage', `${T.crew} marins`], ['Cales', T.holds.map((x) => HOLDS[x]).join(', ')],
          ['Âge', `${num1(age)} ans`], ['État', pct(condition)],
        ].map(([k, v]) => h('div.stat', [h('div.stat-label', k), h('div.stat-value', v)]))),
      ]),
    ]),
  ]);
  return dialog({ title: name ? `${name} — ${T.name}` : T.name, body: h('div', [subtitle ? h('p.muted', subtitle) : null, body]), buttons: [{ label: 'Fermer', value: null, kind: 'primary' }], wide: true });
}

const REPAIR_LABEL = ['Aucun chantier', 'Petit chantier (jusqu\'à 70 %)', 'Chantier naval', 'Grand chantier naval'];
const SIZE_LABEL = ['', 'Petit port', 'Port moyen', 'Grand port', 'Très grand port', 'Port géant'];

function stat(label, value, extra) {
  return h('div.stat', [h('div.stat-label', label), h('div.stat-value', value), extra || null]);
}

// ---------- Flotte ----------
export function fleetPanel(app) {
  const { state, ctx } = app;
  const cid = app.ui.activeCompany;
  const ships = shipsOf(state, cid);
  const orders = state.orders.filter((o) => o.owner === cid);
  const body = h('div');
  const pending = pendingList(app);
  if (pending) body.append(pending);
  if (!ships.length && !orders.length) {
    body.append(h('div.empty', [
      h('p', 'Votre compagnie n\'a encore aucun navire.'),
      h('button.btn.primary', { onclick: () => app.open('broker') }, 'Aller chez le courtier'),
    ]));
    return { title: 'Ma flotte', body };
  }
  const groups = [
    ['Attendent vos ordres', ships.filter((s) => s.status === 'port' && !s.busyWhat && !s.plan)],
    ['Au port, occupés', ships.filter((s) => s.status === 'port' && (s.busyWhat || s.plan))],
    ['En mer', ships.filter((s) => s.status === 'sea')],
    ['Désarmés', ships.filter((s) => s.status === 'laidup')],
  ];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    body.append(h('h3', `${label} (${list.length})`));
    body.append(h('div.list.compact', list.map((s) => {
      const T = SHIP_TYPES[s.type];
      return h('button.row.selectable.with-thumb', { onclick: () => { app.open('ship', s.id); app.focusShip(s.id); } }, [
        h('span.thumb', { html: artForShip(state, s, { sky: false }) }),
        h('span.grow', [h('b', s.name), h('span.muted.small', ` ${T.name}`), h('div.small.muted', shipStatusText(state, ctx, s))]),
        h('span.mini', [h('span.muted.small', 'état'), bar(s.condition / 100, { good: 0.7, warn: 0.45 })]),
        h('span.mini', [h('span.muted.small', 'fuel'), bar(s.fuel / T.tank, { good: 0.4, warn: 0.15 })]),
      ]);
    })));
  }
  if (orders.length) {
    body.append(h('h3', `En construction (${orders.length})`));
    body.append(h('div.list.compact', orders.map((o) => h('div.row', [
      h('span.grow', [h('b', o.name || 'Sans nom'), h('span.muted.small', ` ${SHIP_TYPES[o.type].name}`)]),
      h('span.muted.small', `${portName(o.yard)}, livraison le ${date(o.due, true)}`),
    ]))));
  }
  return { title: 'Ma flotte', subtitle: `${ships.length} navire${ships.length > 1 ? 's' : ''} · valeur ${money(fleetValue(state, cid))}`, body };
}

// ---------- Port ----------
export function portPanel(app, id) {
  const { state } = app;
  const P = PORTS[id];
  const F = FLAGS[P.flag];
  const body = h('div');
  body.append(h('p.blurb', P.blurb));
  body.append(h('div.ship-stats', [
    stat('Pays', F.name),
    stat('Taille', SIZE_LABEL[P.size]),
    stat('Tirant d\'eau max', draftText(P)),
    stat('Fuel', `${num(eco.fuelPrice(state, id))} $/t`),
    stat('Chantier', REPAIR_LABEL[P.repair]),
    stat('Taxes portuaires', P.fees > 1.05 ? 'élevées' : P.fees < 0.92 ? 'faibles' : 'moyennes'),
  ]));
  body.append(h('p', ['Terminaux : ', ...P.terminals.map((t) => h('span.tag', HOLDS[t]))]));
  if (state.strikes[id] > state.t) body.append(h('p.warn-text', `Grève des dockers jusqu'au ${date(state.strikes[id], true)}.`));
  const goodRow = (g, kind) => h('div.row', [
    h('span.grow', [GOODS[g].icon, ' ', GOODS[g].name]),
    kind === 'exp' ? h('span.muted.small', `stock ${tonnes(eco.availableStock(state, id, g))}`) : null,
    h('b', `${money(kind === 'exp' ? eco.buyPrice(state, id, g) : eco.sellPrice(state, id, g))}/t`),
  ]);
  const exp = Object.keys(P.exp), imp = Object.keys(P.imp);
  body.append(h('div.two-cols', [
    h('div', [h('h3', 'Exporte'), exp.length ? h('div.list.compact', exp.map((g) => goodRow(g, 'exp'))) : h('p.muted', 'Rien')]),
    h('div', [h('h3', 'Importe'), imp.length ? h('div.list.compact', imp.map((g) => goodRow(g, 'imp'))) : h('p.muted', 'Rien')]),
  ]));
  const contracts = state.contracts.filter((c) => c.from === id && c.takenBy === null);
  body.append(h('h3', `Contrats au départ (${contracts.length})`));
  body.append(contracts.length ? h('div.list.compact', contracts.slice(0, 8).map((c) => h('div.row', [
    h('span.grow', `${GOODS[c.good].icon} ${GOODS[c.good].name} · ${tonnes(c.qty)} → ${portName(c.to)}`),
    h('b', money(c.pay)),
  ]))) : h('p.muted', 'Aucun pour le moment.'));
  const here = state.ships.filter((s) => s.port === id && s.status !== 'sea');
  if (here.length) {
    body.append(h('h3', 'Navires à quai'));
    body.append(h('div.list.compact', here.map((s) => h('button.row.selectable', { onclick: () => app.open('ship', s.id) }, [
      badge(state.companies[s.owner], 20),
      h('span.grow', [h('b', s.name), h('span.muted.small', ` ${SHIP_TYPES[s.type].name}`)]),
      h('span.muted.small', state.companies[s.owner].name),
    ]))));
  }
  return { title: P.name, subtitle: `${F.name} · ${SIZE_LABEL[P.size]}`, icon: flagEl(P.flag, F.name), body };
}

// ---------- Courtier ----------
export function brokerPanel(app, _id, tab) {
  return {
    title: 'Courtier maritime',
    subtitle: `Indice des navires : ${num(app.state.market.shipIndex * 100)}`,
    tabs: [
      ['occasion', 'Occasion', () => usedTab(app)],
      ['neuf', 'Neuf', () => newTab(app)],
      ['vendre', 'Vendre', () => sellTab(app)],
    ],
    tab,
  };
}

function typeSpecs(T) {
  return `${tonnes(T.dwt)} · ${num1(T.speed)} nœuds · ${T.burn} t/j · tirant d'eau ${num1(T.draft)} m · ${T.holds.map((x) => HOLDS[x].toLowerCase()).join(', ')}`;
}

function usedTab(app) {
  const { state, ctx } = app;
  const company = app.company();
  const list = [...state.used].sort((a, b) => ((b.port === company.homePort) - (a.port === company.homePort)) || a.price - b.price);
  return h('div', [
    h('p.hint', `Trésorerie : ${money(company.cash)}. Un navire d'occasion vous attend dans le port où il est à vendre.`),
    h('div.list', list.map((l) => {
      const T = SHIP_TYPES[l.type];
      // Livrée de l'ancien propriétaire.
      const look = { typeId: l.type, condition: l.condition, age: l.age, name: l.name, color: LIVERIES[l.id % LIVERIES.length], logo: LOGO_IDS[l.id % LOGO_IDS.length], seed: l.id + l.name };
      return h('div.card.with-art', { class: l.price > company.cash ? 'disabled' : '' }, [
        h('button.card-art', { title: 'Inspecter le navire', 'aria-label': `Inspecter le ${l.name}`, onclick: () => inspectShip({ ...look, subtitle: `À vendre à ${portName(l.port)} pour ${money(l.price)}` }), html: shipSVG(l.type, look) }),
        h('div.card-main', [
          h('div.card-title', [l.name, h('span.tag', T.name)]),
          h('div.card-sub', typeSpecs(T)),
          h('div.card-sub', [`${num1(l.age)} ans · état `, h('b', pct(l.condition)), ` · à ${portName(l.port)}`, l.port === company.homePort ? h('span.tag.good', 'votre port') : null]),
          bar(l.condition / 100, { good: 0.7, warn: 0.45 }),
        ]),
        h('div.card-side', [
          h('div.price', money(l.price)),
          h('button.btn.primary.small', { disabled: l.price > company.cash, onclick: async () => {
            if (!(await confirmBox(`Acheter le ${l.name} ?`, `${T.name} de ${num1(l.age)} ans pour ${money(l.price)}. Il vous attend à ${portName(l.port)}.`, 'Acheter'))) return;
            const r = app.act(() => app.withRng((rng) => act.buyUsedShip(state, ctx, rng, company.id, l.id)), { sound: 'pay' });
            if (r?.ok) { app.open('ship', r.ship.id); app.focusShip(r.ship.id); }
          } }, 'Acheter'),
        ]),
      ]);
    })),
  ]);
}

function newTab(app) {
  const { state } = app;
  const company = app.company();
  const yard = app.form.yard || 'busan';
  const box = h('div');
  const F = FLAGS[company.flag];
  box.append(h('p.hint', `Un navire neuf consomme moins, tombe rarement en panne et se revend bien. Livraison au chantier choisi.${F.subsidy ? ` Votre pavillon (${F.name}) subventionne ${pct(F.subsidy * 100)} du prix.` : ''}`));
  box.append(h('div.chips', Object.entries(act.YARDS).map(([y, info]) => h('button.chip', {
    class: y === yard ? 'active' : '', onclick: () => { app.form.yard = y; app.refresh(); },
  }, `${portName(y)} · ${info.days} j`))));
  for (const [id, T] of Object.entries(SHIP_TYPES)) {
    if (T.vintage) continue; // plus construit
    const price = act.newBuildPrice(state, company, id, yard);
    const look = { typeId: id, condition: 100, age: 0, name: '', color: company.color, logo: company.logo, laden: true, seed: id };
    box.append(h('div.card.with-art', { class: price > company.cash ? 'disabled' : '' }, [
      h('button.card-art', { title: 'Inspecter', 'aria-label': `Inspecter : ${T.name}`, onclick: () => inspectShip({ ...look, subtitle: `Neuf, aux couleurs de ${company.name}` }), html: shipSVG(id, look) }),
      h('div.card-main', [
        h('div.card-title', [T.name, h('span.tag', T.category)]),
        h('div.card-sub', T.blurb),
        h('div.card-sub.muted', typeSpecs(T)),
      ]),
      h('div.card-side', [
        h('div.price', money(price)),
        h('button.btn.small', { disabled: price > company.cash, onclick: async () => {
          if (!(await confirmBox(`Commander un ${T.name.toLowerCase()} ?`, `${money(price)} payés à la commande, livraison à ${portName(yard)} dans ${act.YARDS[yard].days} jours.`, 'Commander'))) return;
          app.act(() => act.orderNewShip(state, company.id, id, yard), { sound: 'pay' });
        } }, 'Commander'),
      ]),
    ]));
  }
  return box;
}

function sellTab(app) {
  const { state, ctx } = app;
  const ships = shipsOf(state, app.ui.activeCompany);
  if (!ships.length) return h('p.muted', 'Aucun navire à vendre.');
  return h('div.list', ships.map((s) => {
    const can = (s.status === 'port' || s.status === 'laidup') && !s.busyWhat && !s.cargo;
    const v = eco.shipValue(state, s) * 0.95;
    return h('div.card', { class: can ? '' : 'disabled' }, [
      h('div.card-main', [
        h('div.card-title', [s.name, h('span.tag', SHIP_TYPES[s.type].name)]),
        h('div.card-sub', `${num1(eco.ageYears(state, s))} ans · état ${pct(s.condition)} · ${shipStatusText(state, ctx, s)}`),
        can ? null : h('div.card-why', 'Doit être à quai, inoccupé et vide.'),
      ]),
      h('div.card-side', [
        h('div.price', money(v)),
        h('button.btn.small.danger', { disabled: !can, onclick: async () => {
          if (await confirmBox(`Vendre le ${s.name} ?`, `Le courtier en offre ${money(v)}.`, 'Vendre')) app.act(() => act.sellShip(state, ctx, s.id));
        } }, 'Vendre'),
      ]),
    ]);
  }));
}

// ---------- Bureau ----------
// Le bureau s'embellit avec la valeur nette ; la maquette est celle du plus beau navire.
function officeHero(app) {
  const { state } = app;
  const c = app.company();
  const worth = netWorth(state, c.id);
  const tier = officeTier(worth);
  const best = shipsOf(state, c.id).sort((a, b) => eco.shipValue(state, b) - eco.shipValue(state, a))[0];
  const model = best ? { typeId: best.type, color: c.color, logo: c.logo, name: best.name } : null;
  const next = OFFICE_TIERS[tier + 1];
  return h('div', [
    h('div.office-hero', { html: officeSVG(tier, { color: c.color, logo: c.logo, model, uid: 'off' + c.id }) }),
    h('div.office-caption', [
      h('span', [h('b', OFFICE_TIERS[tier].name), ' — ', OFFICE_TIERS[tier].text]),
      h('span.muted', next ? `Prochain bureau à ${money(next.min)} de valeur nette` : 'Le sommet !'),
    ]),
  ]);
}

export function officePanel(app, _id, tab) {
  const c = app.company();
  return {
    title: 'Bureau', subtitle: c.name, color: c.color, badge: [c.logo, c.color],
    top: officeHero(app),
    tabs: [
      ['finances', 'Finances', () => financeTab(app)],
      ['resultats', 'Résultats', () => resultsTab(app)],
      ['compagnie', 'Compagnie', () => companyTab(app)],
      ['classement', 'Classement', () => rankingTab(app)],
    ],
    tab,
  };
}

function financeTab(app) {
  const { state } = app;
  const c = app.company();
  const limit = creditLimit(state, c);
  const room = Math.max(0, limit - c.debt);
  const box = h('div');
  box.append(h('div.ship-stats', [
    stat('Trésorerie', h('span', { class: c.cash < 0 ? 'neg' : '' }, money(c.cash))),
    stat('Dette bancaire', money(c.debt)),
    stat('Valeur nette', money(netWorth(state, c.id))),
    stat('Flotte', money(fleetValue(state, c.id))),
    stat('Plafond de crédit', money(limit)),
    stat('Taux d\'intérêt', `${num1(interestRate(c) * 100)} %/an`),
  ]));
  box.append(h('p.hint', 'La banque prête jusqu\'à 60 % de la valeur de votre flotte, plus une part selon votre réputation. Un découvert coûte 20 %/an ; trop profond, la banque saisit un navire.'));
  const pending = pendingList(app);
  if (pending) box.append(pending);
  box.append(h('h3', 'Emprunter'));
  const borrowAmounts = [1e6, 5e6, 20e6].filter((a) => a <= room);
  box.append(room >= 10000 ? h('div.chips', [
    ...borrowAmounts.map((a) => h('button.chip', { onclick: () => app.act(() => act.borrow(state, c.id, a)) }, `+ ${money(a)}`)),
    h('button.chip', { onclick: () => app.act(() => act.borrow(state, c.id, room)) }, `Maximum (${money(room)})`),
  ]) : h('p.muted', 'Plafond atteint.'));
  box.append(h('h3', 'Rembourser'));
  const repayable = Math.min(c.debt, Math.max(0, c.cash));
  box.append(repayable >= 10000 ? h('div.chips', [
    ...[1e6, 5e6].filter((a) => a <= repayable).map((a) => h('button.chip', { onclick: () => app.act(() => act.repay(state, c.id, a)) }, `− ${money(a)}`)),
    h('button.chip', { onclick: () => app.act(() => act.repay(state, c.id, repayable)) }, `Tout (${money(repayable)})`),
  ]) : h('p.muted', c.debt ? 'Pas assez de trésorerie.' : 'Aucune dette.'));
  return box;
}

function resultsTab(app) {
  const c = app.company();
  const rows = Object.entries(BOOK_LABELS).filter(([k]) => c.total[k] || c.month[k] || c.lastMonth[k]);
  const cell = (v) => h('td', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted' }, v ? money(v, true) : '—');
  return h('div', [
    h('table.table', [
      h('thead', h('tr', [h('th', ''), h('th', 'Ce mois'), h('th', 'Mois dernier'), h('th', 'Depuis le début')])),
      h('tbody', [
        ...rows.map(([k, label]) => h('tr', [h('td', label), cell(c.month[k]), cell(c.lastMonth[k]), cell(c.total[k])])),
        h('tr.total', [h('td', 'Résultat'), cell(bookTotal(c.month)), cell(bookTotal(c.lastMonth)), cell(bookTotal(c.total))]),
      ]),
    ]),
    h('p.hint', 'Les achats et ventes de navires n\'apparaissent pas ici : ils changent la valeur de la flotte, pas le résultat.'),
  ]);
}

function companyTab(app) {
  const { state } = app;
  const c = app.company();
  const F = FLAGS[c.flag];
  const box = h('div');
  box.append(h('div.ship-stats', [
    stat('Port d\'attache', portName(c.homePort)),
    stat('Pavillon', F.name),
    stat('Impôt sur les bénéfices', pct(F.tax * 100)),
    stat('Coût des équipages', `× ${num1(F.crew)}`),
    stat('Aide aux navires neufs', F.subsidy ? pct(F.subsidy * 100) : 'aucune'),
    stat('Qualité du registre', `${F.rating}/100`),
  ]));
  box.append(h('h3', `Réputation : ${num(c.reputation)}/100`));
  box.append(bar(c.reputation / 100, { good: 0.6, warn: 0.35 }));
  box.append(h('p.hint', 'Livrer à l\'heure fait monter la réputation ; les retards, contrats abandonnés, naufrages et saisies la font chuter. Elle ouvre l\'accès aux meilleurs contrats et baisse le taux des prêts.'));
  box.append(h('p', `${c.delivered} livraisons, dont ${c.late} en retard · ${c.portsServed.length} ports desservis.`));
  box.append(h('h3', 'Changer de port d\'attache'));
  const cost = act.relocateCost(state, c.id);
  box.append(h('p.hint', `Transférer le siège change le pavillon de toute la flotte (impôts, salaires, crédit). Coût : ${money(cost)}.`));
  const sel = h('select.input', { 'aria-label': 'Nouveau port d\'attache' }, PORT_IDS.filter((p) => p !== c.homePort).map((p) => h('option', { value: p }, `${PORTS[p].name} — ${FLAGS[PORTS[p].flag].name}`)));
  box.append(h('div.inline', [sel, h('button.btn', { onclick: async () => {
    const p = sel.value;
    const nf = FLAGS[PORTS[p].flag];
    if (await confirmBox(`S'installer à ${PORTS[p].name} ?`, `Pavillon ${nf.name} : impôt ${pct(nf.tax * 100)}, équipages × ${num1(nf.crew)}, registre ${nf.rating}/100. Coût ${money(cost)}.`, 'Déménager')) {
      app.act(() => act.relocate(state, c.id, p));
    }
  } }, 'Déménager')]));
  return box;
}

function rankingTab(app) {
  const { state } = app;
  const r = ranking(state);
  const box = h('div');
  box.append(h('div.list.compact', r.map((x, i) => h('div.row', [
    h('span.rank', `${i + 1}`),
    badge(x.company, 26),
    h('span.grow', [h('b', x.company.name), x.company.human ? '' : h('span.muted.small', ' (ordinateur)'), x.company.bankrupt ? h('span.tag.bad', 'faillite') : null]),
    h('span.muted.small', `${shipsOf(state, x.company.id).length} navires · réputation ${num(x.company.reputation)}`),
    h('b', money(x.worth)),
  ]))));
  box.append(h('h3', 'Valeur nette'));
  box.append(lineChart(state.companies.map((c) => ({
    color: c.color, points: c.history.map((p) => [p.t, p.nw]),
  })), { yFormat: (v) => money(v), xFormat: (t) => String(yearOf(t)) }));
  return box;
}

// ---------- Marchés ----------
export function marketsPanel(app, _id, tab) {
  return {
    title: 'Marchés',
    tabs: [['indices', 'Indices', () => indicesTab(app)], ['produits', 'Marchandises', () => goodsTab(app)]],
    tab,
  };
}

function trendOf(history, pick) {
  if (!history || history.length < 5) return null;
  const now = pick(history[history.length - 1]), before = pick(history[Math.max(0, history.length - 5)]);
  return (now / before - 1) * 100;
}
function trendTag(v) {
  if (v == null) return null;
  return h('span', { class: v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'muted' }, `${v > 0 ? '▲' : v < 0 ? '▼' : '■'} ${num1(Math.abs(v))} % sur un mois`);
}

function indicesTab(app) {
  const { state } = app;
  const m = state.market;
  const hist = state.marketHistory || [];
  const box = h('div');
  box.append(h('div.ship-stats', [
    stat('Fuel marine', `${num(eco.worldFuelPrice(state))} $/t`, trendTag(trendOf(hist, (x) => x.fuel))),
    stat('Navires (occasion)', num(m.shipIndex * 100), trendTag(trendOf(hist, (x) => x.ships))),
    stat('Coût des réparations', num(eco.repairIndex(state) * 100)),
  ]));
  box.append(h('h3', 'Taux de fret (100 = normal)'));
  box.append(h('div.ship-stats', eco.HOLD_TYPES.map((k) => stat(HOLDS[k], num((m.freight[k] / 1.3) * 100), trendTag(trendOf(hist, (x) => x.freight[k]))))));
  box.append(h('p.hint', 'Un taux de fret élevé rend les contrats plus généreux. Le prix du fuel suit celui des produits pétroliers et réagit aux crises.'));
  if (hist.length > 2) {
    box.append(h('h3', 'Fuel marine ($/t)'));
    box.append(lineChart([{ color: '#f2b544', points: hist.map((x) => [x.t, x.fuel]) }], { height: 140, yFormat: (v) => num(v), xFormat: (t) => String(yearOf(t)) }));
    box.append(h('h3', 'Taux de fret'));
    const colors = {
      vrac: '#3a7ca5', liquide: '#c4362c', divers: '#5f8f3e', conteneurs: '#8a5aa8',
      chimique: '#2f9c95', gpl: '#e08a1e', gnl: '#1c2a33', vehicules: '#b0476d', frigo: '#62a8d6', lourd: '#8a6a3a',
    };
    const chart = (keys) => {
      box.append(lineChart(keys.map((k) => ({ color: colors[k], points: hist.filter((x) => x.freight[k]).map((x) => [x.t, (x.freight[k] / 1.3) * 100]) })), { height: 140, yFormat: (v) => num(v), xFormat: (t) => String(yearOf(t)) }));
      box.append(h('div.legend', keys.map((k) => h('span', [h('span.dot', { style: { background: colors[k] } }), HOLDS[k]]))));
    };
    chart(eco.HOLD_TYPES.slice(0, 4));
    box.append(h('h3', 'Fret spécialisé'));
    chart(eco.HOLD_TYPES.slice(4));
  }
  const events = [];
  if (state.canals.suez?.closed) events.push(`Canal de Suez fermé jusqu'au ${date(state.canals.suez.until, true)} environ.`);
  if (state.canals.panama?.draftLimit) events.push(`Canal de Panama limité à ${num1(state.canals.panama.draftLimit)} m de tirant d'eau jusqu'au ${date(state.canals.panama.until, true)}.`);
  for (const [p, until] of Object.entries(state.strikes)) if (until > state.t) events.push(`Grève à ${portName(p)} jusqu'au ${date(until, true)}.`);
  if (events.length) { box.append(h('h3', 'En ce moment')); for (const e of events) box.append(h('p.warn-text', e)); }
  return box;
}

function goodsTab(app) {
  const { state } = app;
  const g = app.form.good || 'cereales';
  const G = GOODS[g];
  const box = h('div');
  box.append(h('div.chips', GOOD_IDS.map((id) => h('button.chip', { class: id === g ? 'active' : '', onclick: () => { app.form.good = id; app.refresh(); } }, `${GOODS[id].icon} ${GOODS[id].name}`))));
  box.append(h('p', [`Cours mondial : `, h('b', `${money(G.price * state.market.world[g])}/t`), ` · transport : ${G.holds.map((x) => HOLDS[x].toLowerCase()).join(' ou ')}`]));
  const rows = PORT_IDS.map((p) => ({ p, role: eco.role(p, g), exp: eco.exportsGood(p, g), buy: eco.buyPrice(state, p, g), sell: eco.sellPrice(state, p, g), stock: eco.availableStock(state, p, g) }))
    .filter((r) => r.exp || (PORTS[r.p].imp[g] > 0))
    .sort((a, b) => a.buy - b.buy);
  box.append(h('table.table', [
    h('thead', h('tr', [h('th', 'Port'), h('th', 'Rôle'), h('th', 'Achat'), h('th', 'Vente'), h('th', 'Stock')])),
    h('tbody', rows.map((r) => h('tr', [
      h('td', portName(r.p)),
      h('td', r.exp ? h('span.tag.good', 'exporte') : h('span.tag', 'importe')),
      h('td', r.exp ? `${money(r.buy)}` : '—'),
      h('td', `${money(r.sell)}`),
      h('td.muted', r.exp ? tonnes(r.stock) : '—'),
    ]))),
  ]));
  box.append(h('p.hint', 'On ne peut acheter que dans les ports exportateurs. Vendre en masse fait baisser le prix local, acheter beaucoup le fait monter : les marchés se reconstituent en quelques semaines.'));
  return box;
}

// ---------- Journal ----------
export function newsPanel(app) {
  const { state } = app;
  const icon = { event: '📰', fleet: '🚢', disaster: '⚠️', info: '•' };
  return {
    title: 'Journal',
    body: h('div.log', state.news.map((n) => h('div.log-line', { class: n.kind }, [
      h('span.muted', date(n.t, true)), ' ', icon[n.kind] || '•', ' ',
      n.company != null && state.companies[n.company] ? badge(state.companies[n.company], 16) : null, ' ',
      n.text,
    ]))),
  };
}

// ---------- Aide ----------
export function helpPanel() {
  const p = (t) => h('p', t);
  return {
    title: 'Comment jouer',
    body: h('div.help', [
      h('h3', 'Le but'),
      p('Faire de votre compagnie maritime la plus riche (valeur nette : trésorerie + navires − dettes) à la fin de la partie.'),
      h('h3', 'Démarrer'),
      p('1. Ouvrez le Courtier 🏗️ et achetez un premier navire d\'occasion : deux bateaux abordables vous attendent dans votre port d\'attache.'),
      p('2. Touchez votre navire (sur la carte ou dans la Flotte 🚢). Dans l\'onglet Contrats, acceptez un transport : le chargement commence et le navire partira tout seul, plein compris.'),
      p('3. Lancez le temps avec ▶. Le jeu se met en pause dès qu\'un de vos navires attend des ordres.'),
      h('h3', 'Gagner de l\'argent'),
      p('Contrats : un chargeur vous paie pour transporter sa marchandise. Revenu garanti, à condition d\'arriver avant la date limite (3 % de pénalité par jour de retard).'),
      p('Négoce : achetez une cargaison dans un port exportateur et revendez-la dans un port importateur. Plus rentable, mais les prix bougent pendant le voyage, et vos achats et ventes font eux-mêmes bouger les prix.'),
      h('h3', 'Les coûts'),
      p('Carburant (consommation ∝ vitesse³ : ralentir économise beaucoup), équipage (selon votre pavillon), entretien, taxes portuaires et canaux, réparations. Un navire âgé consomme et coûte plus.'),
      h('h3', 'Les contraintes'),
      p('Chaque port a un tirant d\'eau maximal et des terminaux (vrac, liquide, marchandises diverses, conteneurs). Chaque navire a des cales adaptées à certaines marchandises et une autonomie limitée par ses soutes.'),
      h('h3', 'Les risques'),
      p('Tempêtes (cercles colorés, force en Beaufort) : elles ralentissent, usent la coque et peuvent couler un navire en mauvais état. Avaries, grèves, fermeture du canal de Suez, sécheresse à Panama, chocs pétroliers… Lisez le Journal 📰.'),
      h('h3', 'Banque et réputation'),
      p('Empruntez au Bureau 💼 pour grandir plus vite, mais un découvert trop profond entraîne la saisie d\'un navire. La réputation monte avec les livraisons à l\'heure et ouvre les meilleurs contrats.'),
      h('h3', 'Commandes'),
      p('Carte : glisser pour se déplacer, pincer ou molette pour zoomer, toucher un navire ou un port pour l\'ouvrir. Clavier : Espace = pause, 1 à 3 = vitesse, Échap = fermer.'),
    ]),
  };
}

export const PANELS = {
  fleet: fleetPanel, port: portPanel, broker: brokerPanel, office: officePanel,
  markets: marketsPanel, news: newsPanel, help: helpPanel,
};
