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
import { shipStats, radarSVG, AXES } from './radar.js';
import { LOGO_IDS, logoBadge } from './logos.js';
import { flagEl } from './flags.js';
import { officeSVG, officeTier, OFFICE_TIERS } from './officeart.js';
import { pendingList, clientLine, loyaltyDots } from './payment.js';
import { CLIENTS } from '../data/clients.js';
import { clientRel, clientDown, relationOf, clientDemand, clientState, LOYAL, RESERVE_LOYALTY } from '../sim/clients.js';
import { surveyTag, isStrict } from './risk.js';
import { alertsPanel } from './alerts.js';
import { portShadyInfo } from './shady.js';
import { underworldSection, informantSection, partnerInfo } from './plots.js';
import { PLANS, PLAN_IDS, fleetPremium, planOf } from '../sim/insurance.js';

const badge = (c, size = 22) => h('span.badge-wrap', { html: logoBadge(c.logo, c.color, size) });

const LIVERIES = ['#5d6b75', '#7a5c3e', '#3f5e4a', '#6b4f6b', '#4a5f7a', '#8a6d2f'];

// Grande fiche d'un navire : dessin, radar et caractéristiques.
export function inspectShip({ typeId, condition = 100, age = 0, name = '', color, logo, laden = false, seed, subtitle = '', buy = null }) {
  const T = SHIP_TYPES[typeId];
  const body = h('div.inspect', [
    h('div.inspect-art', { html: shipSVG(typeId, { condition, age, color, logo, name, laden, seed: seed ?? name }) }),
    h('div.inspect-row', [
      h('div.radar-wrap', { html: radarSVG(shipStats(typeId, { condition, age }), { color, size: 320 }) }),
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
  // buy : { label } → boutons « Annuler » et achat ; la promesse renvoie 'buy' si le joueur achète.
  const buttons = buy ? [{ label: 'Annuler', value: null, kind: 'ghost' }, { label: buy.label, value: 'buy', kind: 'primary' }] : [{ label: 'Fermer', value: null, kind: 'primary' }];
  return dialog({ title: name ? `${name} — ${T.name}` : T.name, body: h('div', [subtitle ? h('p.muted', subtitle) : null, body]), buttons, wide: true });
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
    stat('Inspections', isStrict(id) ? 'sévères' : 'rares'),
  ]));
  body.append(...portShadyInfo(id));
  const intel = informantSection(app, id), under = underworldSection(app, id);
  if (intel) body.append(intel);
  if (under) body.append(under);
  const ban = app.company()?.bans?.[P.flag];
  if (ban > state.t) body.append(h('p.warn-text', `⛔ ${F.name} interdit ses ports à votre compagnie jusqu'au ${date(ban, true)} (pollution).`));
  if (isStrict(id)) body.append(h('p.hint', 'Port exigeant : les navires usés (sous 55 %, 62 % après 20 ans) risquent d\'y être retenus, mis à l\'amende et réparés d\'office aux frais de l\'armateur.'));
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

// Diagramme miniature d'une carte du courtier : la forme pour comparer, les notes au survol.
function miniRadar(stats, color) {
  return h('div.card-radar', { title: AXES.map((a) => `${a.label} ${stats[a.id]}`).join(' · '), html: radarSVG(stats, { color, size: 78, labels: false }) });
}

// Remise en état à 85 % à prévoir après l'achat (au prix d'un chantier courant).
function repairsToExpect(state, l) {
  if (l.condition >= 84) return null;
  const T = SHIP_TYPES[l.type];
  const cost = (85 - l.condition) * T.price * 1e6 * 0.0011 * (1 + (100 - l.condition) / 120) * eco.repairIndex(state);
  return h('span.muted', ` réparations à prévoir ≈ ${money(cost)}`);
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
      const affordable = l.price <= company.cash;
      const buy = async () => {
        const v = await inspectShip({ ...look, subtitle: `À vendre à ${portName(l.port)} pour ${money(l.price)}. Il vous attend dans ce port.`, buy: affordable ? { label: `Acheter · ${money(l.price)}` } : null });
        if (v !== 'buy') return;
        const r = app.act(() => app.withRng((rng) => act.buyUsedShip(state, ctx, rng, company.id, l.id)), { sound: 'pay' });
        if (r?.ok) { app.open('ship', r.ship.id); app.focusShip(r.ship.id); app.boughtShip?.(r.ship); }
      };
      return h('div.card.with-art', { class: affordable ? '' : 'disabled' }, [
        h('button.card-art', { title: 'Inspecter le navire', 'aria-label': `Inspecter le ${l.name}`, onclick: buy, html: shipSVG(l.type, look) }),
        h('div.card-main', [
          h('div.card-title', [l.name, h('span.tag', T.name)]),
          h('div.card-sub', typeSpecs(T)),
          h('div.card-sub', [`${num1(l.age)} ans · état `, h('b', pct(l.condition)), ` · à ${portName(l.port)}`, l.port === company.homePort ? h('span.tag.good', 'votre port') : null]),
          h('div.card-sub', [surveyTag(state, look), repairsToExpect(state, l)]),
          bar(l.condition / 100, { good: 0.7, warn: 0.45 }),
        ]),
        h('div.card-side', [
          miniRadar(shipStats(l.type, { condition: l.condition, age: l.age }), look.color),
          h('div.price', money(l.price)),
          h('button.btn.primary.small', { disabled: !affordable, onclick: buy }, 'Acheter'),
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
    const order = async () => {
      const v = await inspectShip({ ...look, subtitle: `Neuf, aux couleurs de ${company.name} : ${money(price)} payés à la commande, livraison à ${portName(yard)} dans ${act.YARDS[yard].days} jours.`, buy: price <= company.cash ? { label: `Commander · ${money(price)}` } : null });
      if (v === 'buy') app.act(() => act.orderNewShip(state, company.id, id, yard), { sound: 'pay' });
    };
    box.append(h('div.card.with-art', { class: price > company.cash ? 'disabled' : '' }, [
      h('button.card-art', { title: 'Inspecter', 'aria-label': `Inspecter : ${T.name}`, onclick: () => order(), html: shipSVG(id, look) }),
      h('div.card-main', [
        h('div.card-title', [T.name, h('span.tag', T.category)]),
        h('div.card-sub', T.blurb),
        h('div.card-sub.muted', typeSpecs(T)),
      ]),
      h('div.card-side', [
        miniRadar(shipStats(id), company.color),
        h('div.price', money(price)),
        h('button.btn.small', { disabled: price > company.cash, onclick: () => order() }, 'Commander'),
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
      h('span.office-next', [
        h('span.muted', next ? `Niveau ${tier + 1}/${OFFICE_TIERS.length} · prochain bureau à ${money(next.min)} de valeur nette, vous en êtes à ${money(worth)}` : `Niveau ${OFFICE_TIERS.length}/${OFFICE_TIERS.length} : le sommet !`),
        next ? h('span.level-bar', [h('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, (worth - OFFICE_TIERS[tier].min) / (next.min - OFFICE_TIERS[tier].min))) * 100)}%` } })]) : null,
      ]),
    ]),
  ]);
}

// Formule d'assurance de la compagnie : une vraie décision, prime contre protection.
function insuranceTab(app) {
  const { state } = app;
  const c = app.company();
  const ships = shipsOf(state, c.id);
  const box = h('div');
  box.append(h('p.hint', `Quelle que soit la formule, l'assureur ne paie rien pour un navire parti avec moins de 40 % d'état. Les primes sont prélevées chaque jour.`));
  for (const id of PLAN_IDS) {
    const P = PLANS[id], cur = (c.insurance || 'complete') === id;
    const prem = fleetPremium(state, c, ships, id);
    box.append(h('div.card', { class: cur ? 'highlight' : '' }, [
      h('div.card-main', [
        h('div.card-title', [P.name, cur ? h('span.tag.good', 'votre formule') : null]),
        h('div.card-sub', P.blurb),
        h('div.card-sub.muted', P.rate ? `${String(P.rate * 100).replace('.', ',')} % de la valeur des navires par an : ${money(prem)} par an pour votre flotte actuelle.` : 'Aucune prime.'),
      ]),
      h('div.card-side', cur ? [] : [h('button.btn.small', { onclick: () => { c.insurance = id; app.refresh(); } }, 'Choisir')]),
    ]));
  }
  return box;
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
      ['assurance', 'Assurance', () => insuranceTab(app)],
      ['chargeurs', 'Chargeurs', () => clientsTab(app)],
      ['classement', 'Classement', () => rankingTab(app)],
    ],
    tab,
  };
}

// Les chargeurs : leur note du moment, votre fidélité, leurs exigences, leurs rancunes.
function clientsTab(app) {
  const { state } = app;
  const c = app.company();
  // D'abord ceux avec qui il s'est passé quelque chose (livraisons, incidents, brouille), puis les autres.
  const known = (r) => (r.deliveries || r.incidents || r.grudgeUntil > state.t ? 1 : 0);
  const rows = Object.keys(CLIENTS).map((id) => ({ id, r: relationOf(c, id), rel: clientRel(state, id) }))
    .sort((a, b) => (known(b.r) - known(a.r)) || (b.r.loyalty - a.r.loyalty) || (b.r.deliveries - a.r.deliveries) || (b.rel - a.rel));
  return h('div', [
    h('p.hint', `Les livraisons à l'heure et sans avarie rendent un chargeur fidèle : moins de litiges et de retards de paiement, et à partir de ${RESERVE_LOYALTY}/10 il vous propose en priorité une partie de ses contrats. Les meilleurs payeurs exigent une bonne réputation, sauf de leurs partenaires fidèles (${LOYAL}/10). Un chargeur qui vous paie mal, vous pouvez le dénoncer… ou rester discret.`),
    h('div.list.compact', rows.map(({ id, r, rel }) => {
      const C = CLIENTS[id], need = clientDemand(state, id), cs = clientState(state, id);
      const goods = C.goods.map((g) => GOODS[g].icon).join(' ');
      const tags = [
        clientDown(state, id) ? h('span.tag.bad', `en redressement jusqu'au ${date(cs.downUntil, true)}`) : null,
        r.grudgeUntil > state.t ? h('span.tag.bad', `vous boude jusqu'au ${date(r.grudgeUntil, true)}`) : null,
        need && c.reputation < need && r.loyalty < LOYAL ? h('span.tag.warn', `exige une réputation de ${need}`) : null,
        cs.named ? h('span.tag', { title: 'Nombre de fois où une compagnie l\'a dénoncé publiquement.' }, `dénoncé ×${cs.named}`) : null,
      ];
      return h('div.row.client-row', [
        h('span.grow', [clientLine(state, c, id), partnerInfo(app, id), h('div.small.muted', [`${goods} · `, r.deliveries > 1 ? `${r.deliveries} livraisons pour lui` : r.deliveries === 1 ? '1 livraison pour lui' : 'jamais travaillé ensemble', ...tags.filter(Boolean).flatMap((t) => [' ', t])])]),
        r.loyalty > 0 || r.deliveries ? loyaltyDots(r.loyalty) : null,
      ]);
    })),
  ]);
}

// Conditions des prêts, en clair : intérêts seuls, capital sans échéance, et quand il pourrait être remboursé.
function loanTerms(c) {
  const rate = interestRate(c);
  if (!c.debt) {
    return h('p.loan-terms', [h('b', 'Prêts « intérêts seuls » : '), `vous ne payez que les intérêts, soit environ ${money(1e6 * rate / 12)} par mois pour 1 M$ emprunté. Le capital n'a pas d'échéance : vous le remboursez quand vous voulez.`]);
  }
  const profit = bookTotal(c.lastMonth);
  const months = profit > 0 ? Math.ceil(c.debt / profit) : null;
  const when = months == null ? 'Au rythme du mois dernier, vos bénéfices ne suffisent pas encore à le rembourser.'
    : months > 120 ? `Au rythme du mois dernier (${money(profit)} de bénéfice), il faudrait plus de dix ans pour le rembourser.`
      : `Au rythme du mois dernier (${money(profit)} de bénéfice), il serait remboursé en ${months} mois environ.`;
  return h('p.loan-terms', [
    h('b', 'Prêt « intérêts seuls » : '),
    `vous payez seulement les intérêts, environ ${money(c.debt * rate / 12)} par mois. Le capital (${money(c.debt)}) n'a pas d'échéance : remboursez quand vous voulez.`,
    ' ', when, ' ', 'En fin de partie, la dette restante est déduite de votre valeur nette.',
  ]);
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
  box.append(loanTerms(c));
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
      p('3. Lancez le temps avec ▶. Le jeu se met en pause dès qu\'un de vos navires attend des ordres (arrivé à vide, déchargement terminé) ou qu\'un événement survient : trois coups de cloche annoncent la pause, un tic-tac le retour du temps.'),
      p('Les grands événements (naufrage, pirates, douane, ouragan, banquier, crises mondiales…) s\'affichent en petite scène animée qui arrête le temps : fermez-la (✕) et le temps repart à vitesse 1. Menu : « Illustrations » pour les couper.'),
      h('h3', 'Gagner de l\'argent'),
      p('Contrats : un chargeur vous paie pour transporter sa marchandise. Revenu garanti, à condition d\'arriver avant la date limite (3 % de pénalité par jour de retard).'),
      p('Négoce : achetez une cargaison dans un port exportateur et revendez-la dans un port importateur. Plus rentable qu\'un contrat, mais il faut avancer l\'argent (« Emprunter et acheter » si besoin) et les prix bougent pendant le voyage : les estimations donnent le cours attendu à l\'arrivée, et un prix de revente garanti (une prime) supprime le risque de baisse. Parfois, une affaire en or (★) paie presque le double : elle part vite.'),
      p('Équipage : il apprend en mer et gagne des points de spécialité (combattants, entretien, mécanique, contrebande, logistique, beaux parleurs), à choisir dans l\'onglet Équipage du navire.'),
      p('Chargeurs : chaque contrat affiche les risques à l\'encaissement (impayé, litige, retard de paiement). Livrer à l\'heure rend un chargeur fidèle : moins d\'ennuis, et ses contrats vous sont proposés en priorité. Un chargeur qui vous paie mal, vous pouvez le dénoncer (il perd la confiance du marché, vous gagnez en réputation, il vous boude quatre mois) ou rester discret (certains vous en remercient). Bureau → Chargeurs.'),
      p('Coups bas : dans un port louche, le milieu vend ses services contre vos concurrents (pirates dans une zone, fonctionnaires d\'un port corrompu). Dans tout port où vous avez un navire, un informateur dit qui complote contre vous et quels navires rivaux cachent un colis. Toute menace contre vous s\'annonce par une rumeur (notifications importantes), et tout coup bas peut s\'ébruiter. Les partenariats des chargeurs sont publics : on peut en débaucher un (Bureau → Chargeurs).'),
      h('h3', 'Les coûts'),
      p('Carburant (consommation ∝ vitesse³ : ralentir économise beaucoup), équipage (selon votre pavillon), entretien, taxes portuaires et canaux, réparations. Un navire âgé consomme et coûte plus.'),
      h('h3', 'Les contraintes'),
      p('Chaque port a un tirant d\'eau maximal et des terminaux (vrac, liquide, marchandises diverses, conteneurs). Chaque navire a des cales adaptées à certaines marchandises et une autonomie limitée par ses soutes.'),
      h('h3', 'Les risques'),
      p('En mer : avaries de machine, incendies, abordages, échouements, voies d\'eau, cargaisons abîmées par la tempête (cercles colorés, force en Beaufort). Un navire vieux ou usé en subit bien plus ; même un bon navire peut sombrer, mais il est alors assuré.'),
      p('Assurance (Bureau → Assurance) : formule complète, coque seule ou rien ; moins de prime, moins de protection. L\'assurance ne couvre le navire et sa cargaison que s\'il quitte le port avec au moins 40 % d\'état. Les ports exigeants (Europe, Amérique du Nord, Japon, Corée, Australie, Singapour) retiennent les navires usés (sous 55 %, 62 % après 20 ans) : amende et réparations d\'office.'),
      p('Pollution : une cargaison polluante (pétrole, produits, chimie) qui se déverse lors d\'un naufrage, d\'un échouement ou d\'un abordage coûte un nettoyage, bien plus cher près des côtes sensibles (zones hachurées sur la carte). L\'assurance paie si le navire était en état ; sinon tout est à vos frais et le pays touché vous ferme ses ports un an. Le départ indique les côtes longées et le pire cas.'),
      p('Commerce gris : l\'Iran et le Venezuela sont sous embargo. Leurs ports paient cher ce qui leur manque, bradent leur brut, et le fret y est mieux payé, mais un navire qui y commerce est marqué un an : en Europe, en Amérique du Nord, au Japon, en Corée et en Océanie, il risque une amende (plus lourde si votre pavillon applique lui-même les sanctions).'),
      p('Commerce noir : dans certains ports, des intermédiaires proposent des colis discrets, payés en liquide à la livraison. La douane de chaque escale peut les trouver : saisie, amende, immobilisation, sauf arrangement dans un port accommodant. Les cargos les cachent mieux que les pétroliers.'),
      p('Garde-côtes : près des côtes d\'Europe, d\'Amérique du Nord, du Japon, de Corée et d\'Océanie, et partout dans les Caraïbes, les garde-côtes contrôlent les navires suspects. Seul un colis caché à bord vous expose : filer (la vitesse et un transpondeur discret aident), puis espérer que la fouille ne trouve rien (cachettes, équipage). Ils ne se laissent pas acheter.'),
      p('Pirates : dans les zones rouges (golfe d\'Aden, golfe de Guinée, Malacca, mer de Sulu, côtes du Venezuela), un navire peut être attaqué. Le combat se joue en trois phases : approche (la vitesse aide), abordage (barbelés, lances à eau, équipage), combat à bord (gardes armés). Abordé, un navire sans citadelle est détourné : rançon à payer ou à négocier. Le départ indique le risque et vos chances.'),
      p('Votre équipage évalue les dangers : un équipage de base donne un avis général, un équipage confirmé des fourchettes, un équipage chevronné des chiffres précis voyage par voyage. Les meilleurs équipages coûtent plus cher mais provoquent moins d\'incidents. Choisissez-le à l\'escale.'),
      p('Le marché du fret suit des cycles : des années fastes, puis des années maigres où désarmer un navire (à l\'escale) coûte moins cher que de le faire travailler à perte. Aussi : grèves, fermeture du canal de Suez, sécheresse à Panama, chocs pétroliers… Lisez le Journal 📰.'),
      h('h3', 'Banque et réputation'),
      p('Empruntez au Bureau 💼 pour grandir plus vite, mais un découvert trop profond entraîne la saisie d\'un navire. La réputation monte avec les livraisons à l\'heure et ouvre les meilleurs contrats.'),
      h('h3', 'Commandes'),
      p('Carte : glisser pour se déplacer, pincer ou molette pour zoomer, toucher un navire ou un port pour l\'ouvrir. Clavier : Espace = pause, 1 à 3 = vitesse, Échap = fermer.'),
    ]),
  };
}

export const PANELS = {
  fleet: fleetPanel, port: portPanel, broker: brokerPanel, office: officePanel,
  markets: marketsPanel, news: newsPanel, help: helpPanel, alerts: alertsPanel,
};
