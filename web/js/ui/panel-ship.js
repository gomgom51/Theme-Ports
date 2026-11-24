// Fiche d'un navire : contrats, négoce, escale, départ, voyage en cours, journal.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS, HOLDS } from '../data/goods.js';
import * as eco from '../sim/economy.js';
import * as act from '../sim/actions.js';
import { shipById, contractById, portName, creditLimit, interestRate } from '../sim/core.js';
import { weatherAt } from '../sim/events.js';
import { pointAlong } from '../sim/routing.js';
import { CANAL_NAMES } from '../sim/context.js';
import { h, money, tonnes, num, num1, pct, date, duration, days, bar, confirmBox, promptBox, dialog } from './dom.js';
import { artForShip, SHIP_ART } from './shipart.js';
import { shipStats, radarEl } from './radar.js';
import { flagEl } from './flags.js';
import { watersLabel } from './waters.js';
import { clientLine, riskLine } from './payment.js';
import { fuelGaugeEl, animateNeedle } from './gauge.js';
import { riskLines, crewInfo, isStrict } from './risk.js';
import { shadyLines, offersSection, maybeProposeParcel } from './shady.js';
import { piracyLine, patrolLine } from './piracy.js';
import { hostileTag, hostileLine, heldDialog } from './plots.js';
import { isEmbargoed, taintActive, TAINT_DAYS } from '../sim/shady.js';

// Commercer avec un pays sous embargo marque le navire un an : on demande avant, si le
// navire est encore « propre ». Renvoie true pour continuer.
const EMBARGO_TAG = () => h('span.tag.warn', { title: 'Pays sous embargo : y commercer marque le navire un an (amendes possibles dans les pays qui appliquent les sanctions).' }, '⚖ embargo');
async function embargoOk(app, ship, port) {
  if (!isEmbargoed(port) || taintActive(app.state, ship)) return true;
  return confirmBox(`Commercer avec ${PORTS[port] ? portName(port) : 'ce pays'} ?`,
    `${portName(port)} est sous embargo. Le ${ship.name} sera marqué pendant ${Math.round(TAINT_DAYS / 30)} mois : à chaque escale en Europe, en Amérique du Nord, au Japon, en Corée ou en Océanie, il risquera une amende.`,
    'Oui, commercer');
}
import { EQUIPMENT, EQUIPMENT_IDS } from '../data/equipment.js';
import { hasEquip, equipPrice, canEquip, installEquipment, removeEquipment, defence } from '../sim/equipment.js';
import { CREW_LEVELS } from '../data/ships.js';
import { inspectionThreshold } from '../sim/incidents.js';

const STATUS_ICON = { sea: '🌊', port: '⚓', laidup: '💤' };

export function shipStatusText(state, ctx, ship) {
  if (ship.status === 'laidup') return `Désarmé à ${portName(ship.port)}`;
  if (ship.status === 'port') {
    if (ship.busyWhat) {
      const left = Math.max(0, ship.busyUntil - state.t);
      const plan = ship.plan ? `, puis départ pour ${portName(ship.plan.to)}` : '';
      return `${cap(ship.busyWhat)} à ${portName(ship.port)} (encore ${duration(left)})${plan}`;
    }
    return `À quai à ${portName(ship.port)} — en attente d'ordres`;
  }
  const v = ship.voyage;
  if (v.waitCanal) return `Bloqué devant le ${CANAL_NAMES[v.waitCanal]} (cap sur ${portName(v.to)})`;
  if (v.stalledUntil > state.t) return `Avarie en mer, réparation en cours (cap sur ${portName(v.to)})`;
  return `En mer vers ${portName(v.to)} — arrivée prévue le ${date(etaOf(state, ctx, ship), true)}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function etaOf(state, ctx, ship) {
  const route = ctx.shipRoute(ship);
  if (!route) return state.t;
  return state.t + Math.ceil(Math.max(0, route.nm - ship.voyage.progress) / ship.voyage.speed);
}

function stat(label, value, extra) {
  return h('div.stat', [h('div.stat-label', label), h('div.stat-value', value), extra || null]);
}

// Coût complet estimé d'un voyage avec chargement et déchargement.
function tripEstimate(app, ship, to, speed, qty = 0, hold = null) {
  const { state, ctx } = app;
  const p = act.planVoyage(state, ctx, ship, to, speed);
  if (p.error && !p.route) return p;
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const portH = qty && hold ? eco.handlingHours(ship.port, hold, qty) + eco.handlingHours(to, hold, qty) : 0;
  const totalDays = p.seaDays + portH / 24;
  const fixed = eco.fixedDayCost(T, company.flag, 'active', eco.ageYears(state, ship), ship.crew) * totalDays;
  return { ...p, totalDays, cost: p.fuelCost + p.fees + fixed, portH };
}

export function shipPanel(app, id, tab) {
  const { state, ctx } = app;
  const ship = shipById(state, id);
  if (!ship) return { title: 'Navire disparu', body: h('p.muted', 'Ce navire n\'existe plus.') };
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const mine = ship.owner === app.ui.activeCompany;
  const age = eco.ageYears(state, ship);

  const art = h('div.ship-hero', [
    h('div.ship-hero-art', { html: artForShip(state, ship), title: `${T.name} — ${SHIP_ART[ship.type].L} m` }),
    radarEl(shipStats(ship.type, { condition: ship.condition, age }), { color: company.color, size: 280 }),
  ]);
  const header = h('div.ship-head', [
    art,
    h('div.ship-caption', [h('b', T.name), ` · ${SHIP_ART[ship.type].L} m · ${tonnes(T.dwt)} · ${num1(T.speed)} nœuds`]),
    h('div.ship-stats', [
      stat('État', pct(ship.condition), bar(ship.condition / 100, { good: 0.7, warn: 0.45 })),
      h('div.stat.stat-gauge', [h('div.stat-label', 'Carburant'), fuelGaugeEl(ship.fuel / T.tank, { size: 92, compact: true }), h('div.stat-value', `${num(ship.fuel)} / ${num(T.tank)} t`)]),
      stat('Cargaison', ship.cargo ? `${GOODS[ship.cargo.good].icon} ${tonnes(ship.cargo.qty)}${ship.cargo.damage > 0.005 ? ` · avariée ${pct(ship.cargo.damage * 100)}` : ''}` : 'Cales vides'),
      stat('Capacité', tonnes(T.dwt)),
      stat('Âge', `${num1(age)} ans`),
      stat('Valeur', money(eco.shipValue(state, ship))),
      stat('Équipage', crewInfo(ship).short),
      stat('Équipement', (ship.equipment || []).length ? (ship.equipment || []).map((id) => EQUIPMENT[id].icon).join(' ') : 'aucun'),
    ]),
    h('p.status-line', [STATUS_ICON[ship.status] + ' ', shipStatusText(state, ctx, ship)]),
    mine ? h('div.risk-box', [...riskLines(state, ship, { route: ship.status === 'sea' ? ctx.shipRoute(ship) : null }), ...shadyLines(state, ship, ship.status === 'sea' ? ship.voyage.to : null),
      ship.contraband ? h('div.risk-line', `📦 Colis discret à bord pour ${portName(ship.contraband.to)} : ${money(ship.contraband.pay)} à la livraison, avant le ${date(ship.contraband.deadline, true)}.`) : null]) : null,
  ]);

  if (!mine) {
    return {
      title: ship.name, subtitle: `${T.name} — ${company.name}`, color: company.color,
      body: h('div', [header, h('p.muted', 'Ce navire appartient à une autre compagnie.')]),
    };
  }

  let tabs;
  if (ship.status === 'sea') tabs = [['voyage', 'Voyage', () => voyageTab(app, ship)]];
  else if (ship.status === 'laidup') tabs = [['escale', 'Désarmé', () => laidUpTab(app, ship)]];
  else if (ship.busyWhat) {
    tabs = [
      ['attente', 'En cours', () => busyTab(app, ship)],
      ['depart', ship.plan ? 'Modifier le départ' : 'Programmer le départ', () => departTab(app, ship)],
      ['escale', 'Escale', () => portCallTab(app, ship)],
    ];
  }
  else {
    tabs = [
      ['contrats', 'Contrats', () => contractsTab(app, ship)],
      ['negoce', 'Négoce', () => tradeTab(app, ship)],
      ['escale', 'Escale', () => portCallTab(app, ship)],
      ['depart', 'Appareiller', () => departTab(app, ship)],
    ];
    if (ship.cargo?.contractId && !tab) tab = 'depart';
    if (ship.cargo && !ship.cargo.contractId && !tab) tab = 'negoce';
  }
  tabs.push(['journal', 'Journal de bord', () => logTab(app, ship)]);

  return {
    title: ship.name,
    subtitle: `${T.name} — ${company.name}`,
    color: company.color,
    badge: [company.logo, company.color],
    headerActions: [
      h('button.icon-btn', { title: 'Renommer', 'aria-label': 'Renommer', onclick: async () => {
        const n = await promptBox('Renommer le navire', ship.name);
        if (n) app.act(() => act.renameShip(state, ship.id, n));
      } }, '✎'),
      h('button.icon-btn', { title: 'Centrer sur la carte', 'aria-label': 'Centrer sur la carte', onclick: () => app.focusShip(ship.id) }, '◎'),
    ],
    top: header,
    tabs, tab,
  };
}

// ---------- Contrats ----------
// Contrats du port, puis propositions discrètes s'il y en a.
function contractsTab(app, ship) {
  return h('div', [contractsBase(app, ship), offersSection(app, ship)]);
}
function contractsBase(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  const list = state.contracts.filter((c) => c.from === ship.port && c.takenBy === null);
  if (ship.cargo) return h('p.muted', 'Les cales ne sont pas vides : vendez ou livrez la cargaison actuelle avant de prendre un contrat.');
  if (!list.length) return h('p.muted', `Aucun contrat au départ de ${portName(ship.port)} pour le moment. De nouvelles offres arrivent chaque jour.`);
  const rows = list.map((c) => {
    const why = act.checkContract(state, ctx, ship, c);
    let est = null;
    if (!why) {
      est = tripEstimate(app, ship, c.to, T.speed, c.qty, c.hold);
      if (est.error) est = { ...est, why: est.error };
    }
    const profit = est && !est.why ? c.pay - est.cost : null;
    const lateRisk = est && !est.why && state.t + est.totalDays * 24 > c.deadline;
    return { c, why: why || est?.why, est, profit, perDay: profit != null ? profit / Math.max(1, est.totalDays) : -Infinity, lateRisk };
  }).sort((a, b) => (!!a.why - !!b.why) || b.perDay - a.perDay);

  return h('div.list', rows.map(({ c, why, est, profit, perDay, lateRisk }) => {
    const G = GOODS[c.good];
    const daysLeft = (c.deadline - state.t) / 24;
    // Survol : la route du contrat se dessine sur la carte.
    const routeOf = () => { if (est?.route) return est.route; const p = act.planVoyage(state, ctx, ship, c.to, T.speed); return p.route || null; };
    const company = state.companies[ship.owner];
    const reserved = c.reservedFor === ship.owner && c.reservedUntil > state.t;
    return h('div.card.contract', { class: (why ? 'disabled ' : '') + (c.golden ? 'golden' : ''), onmouseenter: () => app.hoverRoute(routeOf()), onmouseleave: () => app.hoverRoute(null) }, [
      h('div.card-main', [
        h('div.card-title', [h('span.good-icon', G.icon), `${G.name} — ${tonnes(c.qty)}`, c.golden ? h('span.tag.gold', { title: `Rare : un chargeur pressé paie bien plus que d'habitude. L'offre expire le ${date(c.expires, true)}.` }, '★ affaire en or') : null, c.urgent ? h('span.tag.warn', 'urgent') : null, c.regional ? h('span.tag', 'cabotage') : null, c.minSpeed ? h('span.tag', `≥ ${num1(c.minSpeed)} nœuds`) : null, G.perishable ? h('span.tag.warn', { title: 'Chaque jour de retard en gâte 4 %.' }, 'périssable') : null, c.embargo ? h('span.tag.warn', { title: 'Pays sous embargo : fret bien payé, mais le navire sera marqué un an (amendes possibles dans les pays qui appliquent les sanctions).' }, '⚖ embargo') : null, (G.pollution || 0) >= 0.2 ? h('span.tag.warn', { title: 'En cas de naufrage ou d\'échouement, risque de marée noire (coût de nettoyage, couvert par l\'assurance si le navire est en état).' }, '☣ polluant') : null, c.minRep >= 40 ? h('span.tag', 'contrat premium') : null, reserved ? h('span.tag.good', { title: `Votre chargeur fidèle vous le propose en priorité jusqu'au ${date(c.reservedUntil, true)}, avec un fret 4 % plus élevé.` }, 'réservé pour vous') : null, hostileTag(state, ship.owner, c.to)]),
        h('div.card-sub', `→ ${portName(c.to)} · ${num(c.nm)} milles · avant le ${date(c.deadline, true)} (${days(daysLeft)})`),
        c.client ? h('div.card-sub', ['Chargeur : ', clientLine(state, company, c.client)]) : null,
        c.client ? riskLine(state, company, c.client, c.pay) : null,
        why ? h('div.card-why', why) : h('div.card-sub', [
          `Voyage ≈ ${days(est.totalDays)} · coûts ≈ ${money(est.cost)} · `,
          h('b', { class: profit >= 0 ? 'pos' : 'neg' }, `bénéfice ${money(profit, true)}`),
          ` (${money(perDay)}/j)`,
          lateRisk ? h('span.tag.bad', 'retard probable') : null,
        ]),
      ]),
      h('div.card-side', [
        h('div.price', money(c.pay)),
        why ? null : h('button.btn.primary.small', { onclick: async () => {
          if (c.embargo && !(await embargoOk(app, ship, isEmbargoed(c.from) ? c.from : c.to))) return;
          const r = app.act(() => act.acceptContract(state, ctx, ship.id, c.id, { speed: T.speed, autoRefuel: true }), { sound: 'crates' });
          if (r?.ok) {
            app.toast(`Chargement en cours. Le ${ship.name} partira automatiquement pour ${portName(c.to)} (plein fait si nécessaire).`);
            await maybeProposeParcel(app, ship, c.to);
          }
        } }, 'Accepter'),
      ]),
    ]);
  }));
}

// ---------- Négoce ----------
function tradeTab(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const here = ship.port;
  if (ship.cargo?.contractId) {
    const c = contractById(state, ship.cargo.contractId);
    return h('p.muted', `Cargaison sous contrat, attendue à ${portName(c?.to)} : pas de négoce possible.`);
  }
  const box = h('div');
  if (ship.cargo) {
    const G = GOODS[ship.cargo.good];
    const q = act.quoteSale(state, ship);
    box.append(h('div.card.highlight', [
      h('div.card-main', [
        h('div.card-title', [h('span.good-icon', G.icon), `${G.name} — ${tonnes(ship.cargo.qty)} à bord`]),
        ship.cargo.damage > 0.005 ? h('div.card-why', `${pct(ship.cargo.damage * 100)} de la cargaison est perdue ou avariée : elle se vendra d'autant moins.`) : null,
        // Prix d'achat, prix de vente ici et résultat, côte à côte.
        h('div.ship-stats.sale-compare', [
          stat('Acheté', `${money(ship.cargo.cost / ship.cargo.qty)}/t`, h('div.stat-sub', `${money(ship.cargo.cost)}${ship.cargo.boughtAt ? ' · ' + portName(ship.cargo.boughtAt) : ''}`)),
          q.possible ? stat('Vente ici', `${money(q.net / ship.cargo.qty)}/t`, h('div.stat-sub', `${money(q.net)} net, manutention déduite`)) : null,
          q.possible ? stat('Résultat', h('span', { class: q.profit >= 0 ? 'pos' : 'neg' }, `${money(q.profit, true)}`), h('div.stat-sub', `${q.profit >= 0 ? 'bénéfice' : 'perte'} de ${pct(Math.abs(q.profit) / ship.cargo.cost * 100)}`)) : null,
        ]),
        q.possible ? null : h('div.card-why', `${portName(here)} ne peut pas décharger ce type de cargaison.`),
        ship.cargo.floor ? h('div.card-sub', ship.cargo.floor.until >= state.t
          ? [h('span.tag.good', 'prix garanti'), ` À ${portName(ship.cargo.floor.port)} : au moins ${money(ship.cargo.floor.unit)}/t si vous y vendez avant le ${date(ship.cargo.floor.until, true)}.`]
          : `La garantie de prix à ${portName(ship.cargo.floor.port)} a expiré.`) : null,
      ]),
      h('div.card-side', [q.possible ? h(`button.btn.small.${q.profit >= 0 ? 'primary' : 'danger'}`, { onclick: async () => {
        if (!(await embargoOk(app, ship, here))) return;
        if (q.profit < 0 && !(await confirmBox('Vendre à perte ?', `Vous perdrez ${money(-q.profit)} sur cette cargaison.`, 'Vendre'))) return;
        app.act(() => act.sellCargo(state, ctx, ship.id), { sound: 'cash' });
      } }, `Vendre ici · ${money(q.profit, true)}`) : null]),
    ]));
    // Meilleurs débouchés.
    const outlets = [];
    for (const p of PORT_IDS) {
      if (p === here || !eco.portHandles(p, ship.cargo.hold) || !eco.fitsPort(p, ship.type)) continue;
      const est = tripEstimate(app, ship, p, T.speed);
      if (est.error || !est.nm) continue;
      const sound = ship.cargo.qty * (1 - (ship.cargo.damage || 0));
      const fq = eco.quoteTradeAt(state, p, ship.cargo.good, sound, 'sell', est.totalDays);
      const fl = ship.cargo.floor, floorOk = fl && fl.port === p && state.t + est.totalDays * 24 <= fl.until;
      const unit = floorOk ? Math.max(fq.avg, fl.unit) : fq.avg;
      const sale = unit * sound - ship.cargo.qty * eco.HANDLING_COST[ship.cargo.hold];
      outlets.push({ p, net: sale - est.cost - ship.cargo.cost, est, unit, floorOk });
    }
    outlets.sort((a, b) => b.net - a.net);
    box.append(h('h3', 'Meilleurs débouchés (après frais de voyage, au cours attendu à l\'arrivée)'));
    box.append(h('div.list.compact', outlets.slice(0, 6).map((o) => h('div.row', { onmouseenter: () => app.hoverRoute(o.est.route || null), onmouseleave: () => app.hoverRoute(null) }, [
      h('span.grow', [portName(o.p), isEmbargoed(o.p) ? [' ', EMBARGO_TAG()] : null].flat().filter(Boolean)),
      h('span.muted', `${money(o.unit)}/t · ${days(o.est.totalDays)}`),
      o.floorOk ? h('span.tag.good', 'garanti') : null,
      h('b', { class: o.net >= 0 ? 'pos' : 'neg' }, money(o.net, true)),
      h('button.btn.small.ghost', { onclick: () => { app.form.dest[ship.id] = o.p; app.openTab('depart'); } }, 'Y aller'),
    ]))));
    return box;
  }

  const goods = Object.keys(PORTS[here].exp).filter((g) => eco.holdFor(ship.type, g) && eco.portHandles(here, eco.holdFor(ship.type, g)));
  if (!goods.length) {
    box.append(h('p.muted', `${portName(here)} n'exporte rien que ce navire puisse charger (${T.holds.map((x) => HOLDS[x].toLowerCase()).join(', ')}).`));
    return box;
  }
  box.append(h('p.hint', 'Achetez une cargaison ici et revendez-la plus cher ailleurs. Les estimations tiennent compte des prix qui retombent pendant le voyage ; il reste un risque de marché, que vous pouvez couvrir en garantissant votre prix de revente (une prime à l\'achat). Plus risqué qu\'un contrat, mais souvent plus rentable.'));
  for (const g of goods) {
    const G = GOODS[g];
    const unit = eco.buyPrice(state, here, g);
    const stock = eco.availableStock(state, here, g);
    const cashCap = company.cash / (unit * 1.05);
    const maxQty = Math.floor(Math.min(T.dwt, stock, cashCap) / 100) * 100;
    // L'estimation porte sur ce que vous pouvez réellement acheter (cale, stock du port et
    // trésorerie), pas sur une cale pleine hors de portée : les frais du voyage, eux, ne
    // dépendent guère de la quantité.
    const planQty = maxQty > 0 ? maxQty : Math.max(100, Math.floor(Math.min(T.dwt, stock) / 100) * 100);
    const full = Math.floor(T.dwt / 100) * 100;
    const limit = maxQty > 0 && maxQty < full ? (cashCap < stock ? 'cash' : 'stock') : null;
    // Meilleures destinations pour cette marchandise.
    const dests = [];
    for (const p of PORT_IDS) {
      if (p === here || !(PORTS[p].imp[g] > 0) || !eco.fitsPort(p, ship.type)) continue;
      const hold = eco.holdFor(ship.type, g);
      if (!eco.portHandles(p, hold)) continue;
      const qty = planQty;
      const est = tripEstimate(app, ship, p, T.speed, qty, hold);
      if (est.error || !est.nm) continue;
      const buy = act.quoteBuy(state, ship, g, qty).total;
      const fq = eco.quoteTradeAt(state, p, g, qty, 'sell', est.totalDays); // cours attendu à l'arrivée
      const sell = fq.total - qty * eco.HANDLING_COST[hold];
      dests.push({ p, net: sell - buy - est.cost, unit: fq.avg, est, qty });
    }
    dests.sort((a, b) => b.net - a.net);
    const choices = [0.25, 0.5, 0.75, 1].map((f) => Math.floor((T.dwt * f) / 100) * 100).filter((q) => q <= maxQty && q > 0);
    if (maxQty > 0 && !choices.includes(maxQty)) choices.push(maxQty);
    // Trésorerie trop courte : emprunter le complément à la banque, en un clic.
    const fullBuy = Math.floor(Math.min(T.dwt, stock) / 100) * 100;
    const borrowNeed = fullBuy > maxQty ? Math.ceil((act.quoteBuy(state, ship, g, fullBuy).total * 1.02 - company.cash) / 10000) * 10000 : 0;
    const borrowQty = borrowNeed > 0 && creditLimit(state, company) - company.debt >= borrowNeed ? fullBuy : 0;
    // Achat : quantité, éventuel emprunt, et prix de revente garanti à la meilleure destination.
    const buyFlow = async (q, loan = 0) => {
      if (!(await embargoOk(app, ship, here))) return;
      const quote = act.quoteBuy(state, ship, g, q);
      const best = dests[0];
      const gq = best ? eco.quoteTradeAt(state, best.p, g, q, 'sell', best.est.totalDays) : null;
      const rate = best ? act.guaranteeRate(g, best.est.totalDays) : 0;
      const premium = gq ? Math.round(rate * gq.avg * q / 1000) * 1000 : 0;
      const lines = [h('p', `Prix moyen ${money(quote.avg)}/t, manutention comprise : ${money(quote.total)}.`)];
      if (loan) lines.push(h('p', `La banque vous prête ${money(loan)} (prêt « intérêts seuls » : environ ${money(loan * interestRate(company) / 12)} par mois, remboursable quand vous voulez).`));
      if (gq) lines.push(h('p.hint', `Prix garanti (facultatif) : pour ${money(premium)} (${pct(rate * 100)}), la revente à ${portName(best.p)} vous rapportera au moins ${money(gq.avg)}/t, le cours attendu à l'arrivée, si vous y vendez avant le ${date(state.t + (best.est.totalDays * 1.5 + 5) * 24, true)}. Si le cours monte, vous gardez la hausse.`));
      const choice = await dialog({
        title: `Acheter ${tonnes(q)} de ${G.name.toLowerCase()} ?`, body: h('div', lines),
        buttons: [{ label: 'Annuler', value: null, kind: 'ghost' }, ...(gq ? [{ label: `Acheter + prix garanti (${money(premium)})`, value: 'garantie' }] : []), { label: loan ? 'Emprunter et acheter' : 'Acheter', value: 'acheter', kind: 'primary' }],
      });
      if (!choice) return;
      if (loan && !app.act(() => act.borrow(state, company.id, loan))?.ok) return;
      const r = app.act(() => act.buyCargo(state, ctx, ship.id, g, q), { sound: 'pay' });
      if (!r?.ok) return;
      if (best) app.form.dest[ship.id] = best.p;
      if (choice === 'garantie') app.act(() => act.guaranteePrice(state, ship.id, best.p, gq.avg, best.est.totalDays));
    };
    box.append(h('div.card', [
      h('div.card-main', [
        h('div.card-title', [h('span.good-icon', G.icon), G.name, h('span.price-inline', `${money(unit)}/t`)]),
        h('div.card-sub', `Stock disponible : ${tonnes(stock)} · cours mondial ${money(G.price * state.market.world[g])}/t`),
        limit ? h('div.card-why', limit === 'cash' ? `Votre trésorerie limite l'achat à ${tonnes(maxQty)} (cale : ${tonnes(full)}).` : `Le stock du port limite l'achat à ${tonnes(maxQty)} (cale : ${tonnes(full)}).`) : null,
        dests.length ? h('div.card-sub', ['Meilleure destination : ', h('b', portName(dests[0].p)), isEmbargoed(dests[0].p) ? ' ' : null, isEmbargoed(dests[0].p) ? EMBARGO_TAG() : null, ` (${money(dests[0].unit)}/t, ${days(dests[0].est.totalDays)}) → `, h('b', { class: dests[0].net >= 0 ? 'pos' : 'neg' }, maxQty > 0 ? `${money(dests[0].net, true)} pour ${tonnes(dests[0].qty)}` : `${money(dests[0].net, true)} pour une cale pleine (${tonnes(dests[0].qty)})`)]) : h('div.card-why', 'Aucun port importateur accessible avec ce navire.'),
        choices.length ? h('div.chips', choices.sort((a, b) => a - b).map((q) => h('button.chip', { onclick: () => buyFlow(q) }, tonnes(q)))) : null,
        borrowQty ? h('div.chips', [h('button.chip', { onclick: () => buyFlow(borrowQty, borrowNeed) }, `Emprunter et acheter ${tonnes(borrowQty)}`)]) : null,
        !choices.length && !borrowQty ? h('div.card-why', stock <= 0 ? 'Stock épuisé, revenez plus tard.' : 'Trésorerie insuffisante.') : null,
      ]),
    ]));
  }
  return box;
}

// ---------- Escale ----------
function portCallTab(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const here = ship.port;
  const P = PORTS[here];
  const price = eco.fuelPrice(state, here);
  const world = eco.worldFuelPrice(state);
  const box = h('div');

  box.append(h('h3', 'Carburant'));
  const diff = (price / world - 1) * 100;
  // L'écran de la pompe : jauge, prix, quantité et montant qui défilent pendant le plein.
  const gauge = fuelGaugeEl(ship.fuel / T.tank, { size: 150 });
  const qtyOut = h('span.lcd-value', '0 t'), costOut = h('span.lcd-value', '0 $');
  const pump = h('div.pump', [
    gauge,
    h('div.pump-screen', [
      h('div.lcd-row', [h('span.lcd-label', 'Prix / t'), h('span.lcd-value', `${num(price)} $`)]),
      h('div.lcd-row', [h('span.lcd-label', 'Quantité'), qtyOut]),
      h('div.lcd-row', [h('span.lcd-label', 'Montant'), costOut]),
      h('div.pump-note', [`${num(ship.fuel)} / ${num(T.tank)} t à bord · moyenne mondiale ${num(world)} $/t `, h('span', { class: diff > 0 ? 'neg' : 'pos' }, `(${diff > 0 ? '+' : ''}${num(diff)} %)`)]),
    ]),
  ]);
  box.append(pump);
  const fills = [[0.25, '+25 %'], [0.5, '+50 %'], [1, 'Plein']].map(([f, label]) => {
    const want = f === 1 ? T.tank - ship.fuel : Math.min(T.tank - ship.fuel, T.tank * f);
    return { label, want };
  }).filter((x) => x.want >= 1);
  const fill = (want, btns) => {
    const before = ship.fuel;
    const r = app.act(() => act.buyFuel(state, ship.id, want), { refresh: false });
    if (!r?.ok) return;
    btns.forEach((b) => { b.disabled = true; });
    app.audio.play('fuel');
    animateNeedle(gauge, (before + r.qty) / T.tank, 1700);
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 1700);
      qtyOut.textContent = `${num(r.qty * k)} t`;
      costOut.textContent = money(r.cost * k);
      if (k < 1) requestAnimationFrame(tick); else setTimeout(() => app.refresh(), 700);
    };
    setTimeout(() => requestAnimationFrame(tick), 350);
  };
  if (fills.length) {
    const btns = fills.map((x) => h('button.chip', {}, `${x.label} · ${num(x.want)} t · ${money(x.want * price)}`));
    btns.forEach((b, i) => b.addEventListener('click', () => fill(fills[i].want, btns)));
    box.append(h('div.chips', btns));
  } else box.append(h('p.muted', 'Soutes pleines.'));

  box.append(h('h3', 'Réparations'));
  if (!P.repair) box.append(h('p.muted', `Pas de chantier naval à ${P.name}.`));
  else if (ship.busyWhat) box.append(h('p.muted', 'Impossible pendant une opération en cours.'));
  else {
    const levels = [70, 85, 100].filter((x) => x > ship.condition + 1 && x <= eco.REPAIR_MAX[P.repair]);
    if (P.repair === 1) box.append(h('p.hint', 'Petit chantier : remise en état limitée à 70 %.'));
    if (!levels.length) box.append(h('p.muted', 'Le navire est en bon état.'));
    box.append(h('div.chips', levels.map((lv) => {
      const rc = eco.repairCost(state, ship, here, lv);
      return h('button.chip', { onclick: () => app.act(() => act.repair(state, ship.id, lv), { sound: 'pay' }) }, `${lv} % · ${money(rc.cost)} · ${duration(rc.hours)}`);
    })));
  }
  box.append(h('p.hint', `Seuils à retenir : sous ${inspectionThreshold(eco.ageYears(state, ship))} %, les ports exigeants peuvent retenir le navire ; sous 40 %, l'assurance ne le couvre plus ; sous 50 %, il ralentit ; sous 25 %, une forte tempête peut le couler.`));

  // Équipage : plus cher, mais moins d'incidents et une meilleure lecture des dangers.
  box.append(h('h3', 'Équipage'));
  box.append(h('div.list', CREW_LEVELS.map((L, lv) => {
    const cur = (ship.crew || 0) === lv;
    const wage = eco.crewDayCost(T, company.flag, lv);
    const fee = act.crewChangeFee(state, ship, lv);
    return h('div.card', { class: cur ? 'highlight' : '' }, [
      h('div.card-main', [
        h('div.card-title', [L.name, cur ? h('span.tag.good', 'à bord') : null]),
        h('div.card-sub', L.blurb),
        h('div.card-sub.muted', `${money(wage)}/jour · incidents ${lv ? `−${Math.round((1 - L.safety) * 100)} %` : 'normaux'}`),
      ]),
      h('div.card-side', cur ? [] : [h('button.btn.small', { onclick: () => app.act(() => act.setCrew(state, ship.id, lv)) }, fee ? `Engager · ${money(fee)}` : 'Engager')]),
    ]);
  })));

  // Équipement : installé au chantier, il réduit certains risques ou défend le navire.
  box.append(h('h3', 'Équipement'));
  box.append(h('p.hint', `Défense contre un abordage : ${num1(defence(ship))} point${defence(ship) >= 2 ? 's' : ''}.${P.repair ? '' : ` Pas de chantier à ${P.name} : installation impossible ici.`}`));
  box.append(h('div.list', EQUIPMENT_IDS.filter((id) => canEquip(ship, id)).map((id) => {
    const E = EQUIPMENT[id], on = hasEquip(ship, id), price = equipPrice(ship, id);
    return h('div.card', { class: on ? 'highlight' : '' }, [
      h('div.card-main', [
        h('div.card-title', [`${E.icon} ${E.name}`, on ? h('span.tag.good', 'installé') : null]),
        h('div.card-sub', E.blurb),
        h('div.card-sub.muted', [E.defence ? `défense +${E.defence}` : null, E.upkeep ? `${money(E.upkeep)}/jour` : null, `${Math.max(1, Math.round(E.hours / 24))} j d'installation`].filter(Boolean).join(' · ')),
      ]),
      h('div.card-side', on
        ? [h('button.btn.small.ghost', { onclick: () => app.act(() => removeEquipment(state, ship.id, id)) }, 'Retirer')]
        : [h('div.price', money(price)), h('button.btn.small', { disabled: !P.repair || !!ship.busyWhat || price > company.cash, onclick: () => app.act(() => installEquipment(state, ship.id, id), { sound: 'pay' }) }, 'Installer')]),
    ]);
  })));

  if (!ship.busyWhat) {
    box.append(h('h3', 'Désarmer ou vendre'));
    box.append(h('p.hint', `Désarmé, le navire coûte environ ${money(eco.fixedDayCost(T, company.flag, 'laidup', eco.ageYears(state, ship), ship.crew))}/jour au lieu de ${money(eco.fixedDayCost(T, company.flag, 'active', eco.ageYears(state, ship), ship.crew))}. Utile quand le marché est mauvais.`));
    box.append(h('div.chips', [
      h('button.chip', { disabled: !!ship.cargo, onclick: () => app.act(() => act.layUp(state, ship.id)) }, 'Désarmer'),
      h('button.chip.danger', { disabled: !!ship.cargo, onclick: async () => {
        const v = eco.shipValue(state, ship) * 0.95;
        if (await confirmBox(`Vendre le ${ship.name} ?`, `Le courtier en offre ${money(v)}.`, 'Vendre')) app.act(() => act.sellShip(state, ctx, ship.id), { close: true });
      } }, `Vendre (${money(eco.shipValue(state, ship) * 0.95)})`),
    ]));
  }
  return box;
}

function laidUpTab(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  return h('div', [
    h('p', 'Le navire est désarmé : équipage réduit, coûts fixes minimaux.'),
    h('div.chips', [
      h('button.chip', { onclick: () => app.act(() => act.reactivate(state, ship.id)) }, `Réarmer (${money(20000 + T.opex * 3)}, 2 jours)`),
      h('button.chip.danger', { onclick: async () => {
        const v = eco.shipValue(state, ship) * 0.95;
        if (await confirmBox(`Vendre le ${ship.name} ?`, `Le courtier en offre ${money(v)}.`, 'Vendre')) app.act(() => act.sellShip(state, ctx, ship.id), { close: true });
      } }, 'Vendre'),
    ]),
  ]);
}

function busyTab(app, ship) {
  const { state, ctx } = app;
  const left = Math.max(0, ship.busyUntil - state.t);
  const box = h('div', [h('p', `${cap(ship.busyWhat)} : encore ${duration(left)} (fin le ${date(ship.busyUntil, true)}).`)]);
  if (ship.busyWhat === 'détention') {
    // Le joueur garde la main : réparer comme l'exigent les inspecteurs, ou vendre le navire en l'état.
    const refund = ship.detentionCost ? ship.detentionCost * left / Math.max(1, ship.busyUntil - (ship.detentionStart ?? state.t)) : 0;
    const value = eco.shipValue(state, ship) * 0.95;
    box.append(h('p.hint', `Les inspecteurs exigent une remise en état avant de laisser repartir le ${ship.name}. Vous pouvez aussi le vendre en l'état : la part des réparations pas encore faite (${money(refund)}) vous est remboursée.`));
    box.append(h('div.chips', [h('button.chip.danger', { disabled: !!ship.cargo, onclick: async () => {
      if (await confirmBox(`Vendre le ${ship.name} en l'état ?`, `Le courtier en offre ${money(value)}, plus ${money(refund)} de réparations remboursées.`, 'Vendre')) app.act(() => act.sellShip(state, ctx, ship.id), { close: true });
    } }, `Vendre en l'état · ${money(value + refund)}`)]));
  }
  if (ship.busyWhat === 'retenue') {
    box.append(h('p.hint', `Les autorités de ${portName(ship.port)} retiennent le ${ship.name} sur un prétexte. Un avocat peut obtenir sa libération sous 24 heures.`));
    box.append(h('div.chips', [h('button.chip', { onclick: () => heldDialog(app, ship.id) }, 'Voir l\'avocat')]));
  }
  if (state.strikes[ship.port] > state.t) box.append(h('p.warn-text', `Grève en cours à ${portName(ship.port)} jusqu'au ${date(state.strikes[ship.port], true)}.`));
  if (ship.plan) {
    const p = act.planVoyage(state, ctx, ship, ship.plan.to, ship.plan.speed);
    box.append(h('div.card.highlight', [
      h('div.card-main', [
        h('div.card-title', `Départ programmé pour ${portName(ship.plan.to)}`),
        h('div.card-sub', p.error ? p.error : `${num(p.nm)} milles à ${num1(ship.plan.speed)} nœuds · ${days(p.seaDays)} de mer · ${num(p.needFuel)} t de fuel${ship.plan.autoRefuel ? ' (plein automatique)' : ''}`),
      ]),
      h('div.card-side', [h('button.btn.small.ghost', { onclick: () => app.act(() => act.cancelPlan(state, ship.id)) }, 'Annuler le départ')]),
    ]));
  } else {
    box.append(h('p.muted', 'Aucun départ programmé : donnez vos ordres à la fin de l\'opération, ou programmez le départ dès maintenant dans l\'onglet suivant.'));
  }
  return box;
}

// ---------- Appareiller ----------
function departTab(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  const company = state.companies[ship.owner];
  const speed = app.form.speed[ship.id] ?? T.speed;
  let dest = app.form.dest[ship.id] || null;
  const contract = ship.cargo?.contractId ? contractById(state, ship.cargo.contractId) : null;
  if (contract) dest = contract.to;
  const autoRefuel = app.form.autoRefuel[ship.id] ?? true;

  const box = h('div');
  const speedOut = h('b', `${num1(speed)} nœuds`);
  const slider = h('input.range', { type: 'range', min: Math.max(6, Math.round(T.speed * 0.6)), max: T.maxSpeed, step: 0.5, value: speed, 'aria-label': 'Vitesse' });
  slider.addEventListener('input', () => { speedOut.textContent = `${num1(+slider.value)} nœuds`; });
  slider.addEventListener('change', () => { app.form.speed[ship.id] = +slider.value; app.refresh(); });
  box.append(h('div.speed-row', [h('span', 'Vitesse : '), speedOut, slider, h('span.muted.small', `service ${num1(T.speed)} · max ${num1(T.maxSpeed)}`)]));
  box.append(h('p.hint', 'Ralentir économise beaucoup de carburant (consommation ∝ vitesse³) mais allonge le voyage et les frais fixes.'));

  if (dest) {
    const est = tripEstimate(app, ship, dest, speed, 0, null);
    app.setPreview(est.route || null);
    const toBuy = est.needFuel ? Math.max(0, Math.min(T.tank, est.needFuel * 1.12) - ship.fuel) : 0;
    box.append(h('div.card.highlight', [
      h('div.card-main', [
        h('div.card-title', `Cap sur ${portName(dest)}`),
        est.error ? h('div.card-why', est.error) : h('div.card-sub', [
          `${num(est.nm)} milles · ${days(est.seaDays)} de mer · arrivée le ${date(est.eta, true)}`,
          h('br'),
          `Fuel nécessaire ${num(est.needFuel)} t (à bord ${num(ship.fuel)} t${toBuy > 1 ? `, à acheter ≈ ${num(toBuy)} t pour ${money(toBuy * eco.fuelPrice(state, ship.port))}` : ''})`,
          h('br'),
          ...est.canals.flatMap((c) => [`🚧 Péage du ${CANAL_NAMES[c]} : ${money(eco.canalFee(T, c))}, payé au départ`, h('br')]),
          `Frais de port à l'arrivée ${money(est.fees - est.canals.reduce((s, c) => s + eco.canalFee(T, c), 0))} · frais fixes ≈ ${money(est.cost - est.fuelCost - est.fees)}`,
          contract ? h('br') : null,
          contract ? h('span', { class: est.eta > contract.deadline ? 'neg' : 'pos' }, est.eta > contract.deadline ? `Attention : arrivée après le délai du ${date(contract.deadline, true)}` : `Dans les délais (avant le ${date(contract.deadline, true)})`) : null,
        ]),
        est.error ? null : h('div.risk-box.compact', [...riskLines(state, ship, { seaDays: est.seaDays, to: dest, route: est.route }).slice(ship.condition >= 40 ? 1 : 0), piracyLine(ship, est.route, speed, state), patrolLine(ship, est.route, speed), hostileLine(state, ship, dest), ...shadyLines(state, ship, dest)]),
        h('label.check', [
          h('input', { type: 'checkbox', checked: autoRefuel, onchange: (e) => { app.form.autoRefuel[ship.id] = e.target.checked; } }),
          ' Faire le plein automatiquement si nécessaire',
        ]),
      ]),
      h('div.card-side', [est.error ? null : h('button.btn.primary', { onclick: () => {
        const r = app.act(() => act.depart(state, ctx, ship.id, dest, speed, app.form.autoRefuel[ship.id] ?? true), { sound: (res) => (res.queued ? null : 'depart') });
        if (r?.ok) { delete app.form.dest[ship.id]; app.setPreview(null); }
      } }, 'Appareiller')]),
    ]));
  } else {
    app.setPreview(null);
    box.append(h('p.muted', 'Choisissez une destination :'));
  }

  if (contract) return box;
  const worn = ship.condition < inspectionThreshold(eco.ageYears(state, ship));
  // Liste des destinations.
  const rows = PORT_IDS.filter((p) => p !== ship.port).map((p) => {
    const info = ctx.distanceInfo(ship.port, p, ctx.closedCanals(state, T.draft));
    let why = null;
    if (!eco.fitsPort(p, ship.type)) why = `tirant d'eau ${num1(eco.portDraft(p, ship.type))} m`;
    else if (ship.cargo && !eco.portHandles(p, ship.cargo.hold)) why = 'ne peut pas décharger';
    else if (!info) why = 'inaccessible';
    const nm = info?.nm || 0;
    const seaDays = nm / (24 * speed);
    const need = eco.burnPerDay(T, speed, eco.ageYears(state, ship)) * seaDays * 1.08;
    if (!why && need > T.tank) why = 'autonomie insuffisante';
    const exp = Object.keys(PORTS[p].exp).filter((g) => eco.holdFor(ship.type, g)).length;
    const contracts = state.contracts.filter((c) => c.from === p && c.takenBy === null && eco.holdFor(ship.type, c.good)).length;
    return { p, nm, seaDays, why, contracts, exp };
  }).sort((a, b) => (!!a.why - !!b.why) || a.nm - b.nm);
  box.append(h('div.list.compact', rows.map((r) => h('button.row.selectable', {
    class: (r.p === dest ? 'selected ' : '') + (r.why ? 'disabled' : ''),
    disabled: !!r.why,
    onclick: () => { app.form.dest[ship.id] = r.p; app.refresh(); },
  }, [
    flagEl(PORTS[r.p].flag),
    h('span.grow', portName(r.p)),
    isEmbargoed(r.p) ? EMBARGO_TAG() : null,
    r.why ? h('span.muted.small', r.why) : h('span.muted.small', `${num(r.nm)} milles · ${days(r.seaDays)}`),
    !r.why && worn && isStrict(r.p) ? h('span.tag.warn', { title: 'Port exigeant : risque de détention pour un navire usé' }, '⚠ contrôles') : null,
    !r.why && r.contracts ? h('span.tag', `${r.contracts} contrat${r.contracts > 1 ? 's' : ''}`) : null,
  ]))));
  return box;
}

// ---------- En mer ----------
function voyageTab(app, ship) {
  const { state, ctx } = app;
  const T = SHIP_TYPES[ship.type];
  const v = ship.voyage;
  const route = ctx.shipRoute(ship);
  const left = route ? Math.max(0, route.nm - v.progress) : 0;
  const pos = route ? pointAlong(route, v.progress) : null;
  const wx = pos ? weatherAt(state, pos.lon, pos.lat) : { force: 4 };
  const contract = ship.cargo?.contractId ? contractById(state, ship.cargo.contractId) : null;
  const eta = etaOf(state, ctx, ship);
  const box = h('div');
  box.append(h('div.voyage', [
    h('div.voyage-ends', [h('span', portName(v.from)), h('span', portName(v.to))]),
    bar(route ? v.progress / route.nm : 0, { good: 0, warn: 0 }),
    h('div.voyage-ends.muted.small', [h('span', `parti le ${date(v.departT, true)}`), h('span', `${num(left)} milles restants`)]),
  ]));
  const weather = wx.force >= 9 ? `Tempête, force ${wx.force}` : wx.force >= 7 ? `Gros temps, force ${wx.force}` : `Mer maniable, force ${wx.force}`;
  box.append(h('div.ship-stats', [
    stat('Arrivée prévue', date(eta, true)),
    stat('Météo', weather),
    stat('Position', pos ? watersLabel(pos.lon, pos.lat) : '—'),
    stat('Vitesse', `${num1(v.speed)} nœuds`),
    stat('Fuel pour finir', `${num(act.fuelToFinish(state, ctx, ship, v.speed))} t`),
  ]));
  if (contract) {
    const late = eta > contract.deadline;
    box.append(h('p', { class: late ? 'neg' : 'pos' }, `${tonnes(contract.qty)} de ${GOODS[contract.good].name.toLowerCase()} à livrer avant le ${date(contract.deadline, true)}${late ? ' : retard probable (pénalité de 3 % par jour)' : ''}.`));
  } else if (ship.cargo) {
    box.append(h('p', `${tonnes(ship.cargo.qty)} de ${GOODS[ship.cargo.good].name.toLowerCase()} à vendre à l'arrivée.`));
  } else box.append(h('p.muted', 'Voyage à vide.'));
  if (v.waitCanal) box.append(h('p.warn-text', `Le ${CANAL_NAMES[v.waitCanal]} est fermé : le navire attend sa réouverture.`));

  const speedOut = h('b', `${num1(v.speed)} nœuds`);
  const slider = h('input.range', { type: 'range', min: 6, max: T.maxSpeed, step: 0.5, value: v.speed, 'aria-label': 'Vitesse' });
  const fuelOut = h('span.muted.small');
  const upd = () => {
    const need = act.fuelToFinish(state, ctx, ship, +slider.value);
    speedOut.textContent = `${num1(+slider.value)} nœuds`;
    fuelOut.textContent = `fuel pour finir : ${num(need)} t / ${num(ship.fuel)} t à bord${need > ship.fuel ? ' — insuffisant !' : ''}`;
  };
  slider.addEventListener('input', upd);
  slider.addEventListener('change', () => app.act(() => act.setSpeed(state, ship.id, +slider.value)));
  upd();
  box.append(h('h3', 'Changer de vitesse'));
  box.append(h('div.speed-row', [speedOut, slider]));
  box.append(fuelOut);
  return box;
}

// ---------- Journal ----------
function logTab(app, ship) {
  const hrs = ship.hours || {};
  const tot = (hrs.laden || 0) + (hrs.ballast || 0) + (hrs.port || 0) + (hrs.laidup || 0);
  const T = SHIP_TYPES[ship.type];
  return h('div', [
    h('div.ship-stats', [
      stat('Recettes', money(ship.earned)),
      stat('Dépenses', money(ship.spent)),
      stat('Résultat', h('span', { class: ship.earned - ship.spent >= 0 ? 'pos' : 'neg' }, money(ship.earned - ship.spent, true))),
      stat('En charge', tot ? pct(((hrs.laden || 0) / tot) * 100) : '—'),
      stat('Vitesse', `${num1(T.speed)} nœuds`),
      stat('Tirant d\'eau', `${num1(T.draft)} m`),
      stat('Équipage', `${T.crew} marins`),
      stat('Cales', T.holds.map((x) => HOLDS[x]).join(', ')),
    ]),
    h('h3', 'Journal de bord'),
    h('div.log', ship.log.map((l) => h('div.log-line', [h('span.muted', date(l.t, true)), ' ', l.text]))),
  ]);
}
