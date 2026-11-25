// Fiche d'un navire : contrats, négoce, escale, départ, voyage en cours, journal.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS, HOLDS } from '../data/goods.js';
import * as eco from '../sim/economy.js';
import * as act from '../sim/actions.js';
import { shipById, contractById, portName, creditLimit, interestRate, loanOwedAt } from '../sim/core.js';
import { quoteSellAt, tenderRoom, lenderTerms, FINANCE, financedShare, loanRoom } from '../sim/trade.js';
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
import { attackTags, hostileTag, hostileLine, heldDialog, portServicesLink } from './plots.js';
import { isEmbargoed, taintActive, TAINT_DAYS, sanctionPreview } from '../sim/shady.js';
import * as crew from '../sim/crew.js';
import { isSeasonal, iceOpen, iceRisk, forecastText, escortFee, iceClass } from '../sim/ice.js';
import { darkLines, seizedDialog } from './dark.js';
import { routeChip } from './route.js';
import { prospectOdds, canProspect, startProspect } from '../sim/prospect.js';
import { grudgeAt } from '../sim/dark.js';
import { repCap } from '../sim/core.js';

// Commercer avec un pays sous embargo marque le navire un an : on demande avant, si le
// navire est encore « propre ». Renvoie true pour continuer.
const EMBARGO_TAG = () => h('span.tag.warn', { title: 'Pays sous embargo : y commercer marque le navire un an (amendes possibles dans les pays qui appliquent les sanctions).' }, '⚖ embargo');
async function embargoOk(app, ship, port, value = 0) {
  if (!isEmbargoed(port) || taintActive(app.state, ship)) return true;
  const risk = sanctionPreview(app.state, ship, value);
  return confirmBox(`Commercer avec ${PORTS[port] ? portName(port) : 'ce pays'} ?`, h('div', [
    h('p', `${portName(port)} est sous embargo. Le ${ship.name} sera marqué pendant ${Math.round(TAINT_DAYS / 30)} mois : à chaque escale en Europe, en Amérique du Nord, au Japon, en Corée ou en Océanie, il risquera une amende.`),
    h('p.warn-text', `Risque à chaque escale : ${pct(risk.odds * 100)}, pour une amende d'environ ${money(risk.fine)}.`),
    h('p.muted', `L'amende vaut le quart de la valeur commercée avec ces pays pendant le marquage (de 0,5 à 12 M$, 30 % de moins sous un pavillon qui n'applique pas les sanctions). Le risque est rappelé avant chaque départ.`),
  ]), 'Oui, commercer');
}
import { EQUIPMENT, EQUIPMENT_IDS } from '../data/equipment.js';
import { hasEquip, equipPrice, canEquip, installEquipment, removeEquipment, defence } from '../sim/equipment.js';
import { CREW_LEVELS } from '../data/ships.js';
import { payCut } from '../sim/plots.js';
import { inspectionThreshold } from '../sim/incidents.js';

const STATUS_ICON = { sea: '🌊', port: '⚓', laidup: '💤' };

export function shipStatusText(state, ctx, ship) {
  if (ship.seized) return ship.seized.by === 'justice' ? `Confisqué par la justice à ${portName(ship.port)} — caution de ${money(ship.seized.ransom)}`
    : ship.seized.kind === 'crew' ? `Équipage enlevé à ${portName(ship.port)} — rançon de ${money(ship.seized.ransom)}` : `Aux mains d'un gang à ${portName(ship.port)} — rançon de ${money(ship.seized.ransom)}`;
  const iced = ship.iced && ship.status !== 'sea' ? ' · pris par les glaces' : '';
  if (ship.status === 'laidup') return `Désarmé à ${portName(ship.port)}${iced}`;
  if (ship.status === 'port') {
    if (iced && !ship.busyWhat) return `Pris par les glaces à ${portName(ship.port)} — en attente d'ordres`;
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
  return 'En mer'; // la destination et l'arrivée s'affichent à part, bien en vue (shipRoute)
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Destination, arrivée et date limite du contrat d'un navire (en mer, ou départ programmé).
export function shipRoute(state, ctx, ship, compact = false) {
  const contract = ship.cargo?.contractId ? contractById(state, ship.cargo.contractId) : null;
  if (ship.status === 'sea') {
    const eta = etaOf(state, ctx, ship);
    return routeChip(ship.voyage.to, { eta, deadline: contract?.deadline ?? null, late: !!contract && eta > contract.deadline, compact });
  }
  if (ship.plan) return routeChip(ship.plan.to, { deadline: contract?.deadline ?? null, compact });
  return null;
}
export function etaOf(state, ctx, ship) {
  const route = ctx.shipRoute(ship);
  if (!route) return state.t;
  return state.t + Math.ceil(Math.max(0, route.nm - ship.voyage.progress) / ship.voyage.speed);
}

// Glaces : ce qu'il faut savoir avant de partir (port saisonnier à l'arrivée, port pris au
// départ, passage du Nord-Est). plan : résultat de planVoyage.
export function iceLines(state, ship, to, plan) {
  const out = [];
  if (plan?.escortOut) out.push(h('div.risk-line.warn-text', `🧊 ${portName(ship.port)} est pris par les glaces : escorte d'un brise-glace au départ, ${money(plan.escortOut)}.`));
  if (plan?.iceRisk >= 1) out.push(h('div.risk-line.warn-text', `❄ ${portName(to)} sera pris par les glaces à l'arrivée (${plan.iceText}) : escorte d'un brise-glace obligatoire (${money(plan.iceFee)}), et de nouveau pour repartir.`));
  else if (plan?.iceRisk > 0) out.push(h('div.risk-line.warn-text', `❄ ${portName(to)} : ${plan.iceText}. Risque qu'il soit pris à votre arrivée : ${pct(plan.iceRisk * 100)}. Il faudrait alors un brise-glace (${money(plan.iceFee)}), et de nouveau pour repartir.`));
  else if (to && isSeasonal(to)) out.push(h('div.risk-line', `❄ Port saisonnier, libre de glace à votre arrivée (${forecastText(state, to, ship)}).`));
  if (plan?.canals?.includes('nsr')) out.push(h('div.risk-line', `🧊 Par le passage du Nord-Est, sûr jusqu'à votre passage (${forecastText(state, 'nsr', ship)}).`));
  return out;
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
      stat('Cargaison', ship.cargo ? [`${GOODS[ship.cargo.good].icon} ${tonnes(ship.cargo.qty)}`, ship.cargo.damage > 0.005 ? ' · ' : null, ship.cargo.damage > 0.005 ? h('span', `avariée ${pct(ship.cargo.damage * 100)}`) : null] : 'Cales vides'),
      stat('Capacité', tonnes(T.dwt)),
      stat('Âge', `${num1(age)} ans`),
      stat('Valeur', money(eco.shipValue(state, ship))),
      stat('Équipage', crewInfo(ship).short),
      stat('Équipement', (ship.equipment || []).length ? (ship.equipment || []).map((id) => EQUIPMENT[id].icon).join(' ') : 'aucun'),
    ]),
    h('p.status-line', [STATUS_ICON[ship.status] + ' ', shipStatusText(state, ctx, ship)]),
    shipRoute(state, ctx, ship), // destination et dates bien en vue
    mine ? portServicesLink(app, ship) : null, // services du port (la zone, l'informateur) : un clic mène à la fiche du port
    mine ? h('div.risk-box', [...riskLines(state, ship, { route: ship.status === 'sea' ? ctx.shipRoute(ship) : null }), ...shadyLines(state, ship, ship.status === 'sea' ? ship.voyage.to : null),
      ship.contraband ? h('div.risk-line', `📦 Colis discret à bord pour ${portName(ship.contraband.to)} : ${money(ship.contraband.pay)} à la livraison, avant le ${date(ship.contraband.deadline, true)}.`) : null,
      ...darkLines(state, ship, ship.status === 'sea' ? ship.voyage.to : null),
      ship.iced && ship.status !== 'sea' ? h('div.risk-line.warn-text', `🧊 Pris par les glaces à ${portName(ship.port)} (${forecastText(state, ship.port, ship)}) : pour partir avant, un brise-glace coûte ${money(escortFee(ship))}${iceClass(ship) ? ' (classe glace)' : ''}. Sinon, le désarmer pour l'hiver réduit les frais.`) : null]) : null,
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
  tabs.push(['equipage', crew.pointsFree(ship) ? 'Équipage ●' : 'Équipage', () => crewSkillsTab(app, ship)]);
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
  return h('div', [prospectCard(app, ship), contractsBase(app, ship), offersSection(app, ship)]);
}
// Démarcher les chargeurs : vos commerciaux proposent le navire (1 à 2 jours), chances annoncées.
function prospectCard(app, ship) {
  const { state } = app;
  if (ship.owner !== app.ui.activeCompany || ship.status !== 'port' || ship.cargo || ship.dark) return null;
  const o = prospectOdds(state, ship, app.ctx);
  const why = canProspect(ship) || o.why;
  const part = (label, v) => (Math.abs(v) >= 0.005 ? h('span.prospect-part', [h('span', label), ' ', h('b', `${v > 0 ? '+' : '−'}${pct(Math.abs(v) * 100)}`)]) : null);
  return h('div.card.prospect', [
    h('div.card-main', [
      h('div.card-title', ['📞 ', h('span', 'Démarcher les chargeurs')]),
      h('div.card-sub', `Vos commerciaux proposent le ${ship.name} aux chargeurs : 1 à 2 jours à quai. Résultat : un contrat taillé pour ce navire, une piste dans un port proche (réservée le temps d'y aller), ou rien.`),
      o.why ? null : h('div.card-sub', [h('span', 'Chances estimées :'), ' ', h('b', pct(o.p * 100)), ' ', h('span.muted', '('),
        ...[part('port', o.parts.port), part('réputation', o.parts.rep), part('chargeurs fidèles', o.parts.loyalty), part('bureau', o.parts.office), part('beaux parleurs à bord', o.parts.talk)].filter(Boolean).flatMap((x, i) => (i ? [', ', x] : [x])),
        h('span.muted', ')')]),
      !o.why && !o.here ? h('div.card-sub.muted', 'Rien à charger ici pour ce navire : en cas de succès, ce sera une piste dans un port proche.') : null,
      why ? h('div.card-why', why) : null,
    ]),
    h('div.card-side', [h('button.btn.small', { disabled: !!why, onclick: () => app.act(() => app.withRng((rng) => startProspect(state, rng, ship, app.ctx))) }, 'Démarcher')]),
  ]);
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
        h('div.card-title', [h('span.good-icon', G.icon), `${G.name} — ${tonnes(c.qty)}`, c.golden ? h('span.tag.gold', { title: `Rare : un chargeur pressé paie bien plus que d'habitude. L'offre expire le ${date(c.expires, true)}.` }, '★ affaire en or') : null, c.urgent ? h('span.tag.warn', 'urgent') : null, c.regional ? h('span.tag', 'cabotage') : null, c.minSpeed ? h('span.tag', `≥ ${num1(c.minSpeed)} nœuds`) : null, G.perishable ? h('span.tag.warn', { title: 'Chaque jour de retard en gâte 4 %.' }, 'périssable') : null, c.embargo ? h('span.tag.warn', { title: 'Pays sous embargo : fret bien payé, mais le navire sera marqué un an (amendes possibles dans les pays qui appliquent les sanctions).' }, '⚖ embargo') : null, (G.pollution || 0) >= 0.2 ? h('span.tag.warn', { title: 'En cas de naufrage ou d\'échouement, risque de marée noire (coût de nettoyage, couvert par l\'assurance si le navire est en état).' }, '☣ polluant') : null, c.minRep >= 40 ? h('span.tag', 'contrat premium') : null, reserved ? h('span.tag.good', { title: `Votre chargeur fidèle vous le propose en priorité jusqu'au ${date(c.reservedUntil, true)}, avec un fret 4 % plus élevé.` }, 'réservé pour vous') : null, c.ice ? h('span.tag.warn', { title: 'Fin de saison : livrable seulement par un navire de classe glace (fret mieux payé).' }, '🧊 classe glace') : null, c.charity ? h('span.tag.good', { title: 'Aide d\'urgence : payée à prix coûtant partiel (vous perdrez de l\'argent), mais elle rend de la réputation.' }, '❤ aide d\'urgence') : null, hostileTag(state, ship.owner, c.to), ...attackTags(state, ship.owner, c)]),
        routeChip(c.to, { eta: est && !est.why ? state.t + est.totalDays * 24 : null, estimate: true, deadline: c.deadline, late: lateRisk }),
        h('div.card-sub.muted', `${num(c.nm)} milles · délai ${days(daysLeft)}`),
        ...(isSeasonal(c.to) || est?.canals?.includes('nsr') ? iceLines(state, ship, c.to, est && !est.why ? est : null) : []),
        c.client ? h('div.card-sub', ['Chargeur : ', clientLine(state, company, c.client)]) : null,
        c.charity ? h('div.card-sub', [`❤ ${c.charity.name} : aide d'urgence, payée à prix coûtant partiel. Réputation +${c.charity.rep} si elle arrive à l'heure.`, repCap(company) < 100 ? ` Plafond de votre réputation : ${repCap(company)}.` : null]) : null,
        c.client ? riskLine(state, company, c.client, c.pay) : null,
        why ? h('div.card-why', why) : h('div.card-sub', [
          `Voyage ≈ ${days(est.totalDays)} · coûts ≈ ${money(est.cost)} · `,
          h('b', { class: profit >= 0 ? 'pos' : 'neg' }, `bénéfice ${money(profit, true)}`),
          ` (${money(perDay)}/j)`,
          lateRisk ? h('span.tag.bad', 'retard probable') : null,
        ]),
      ]),
      h('div.card-side', [
        h('div.price', money(c.pay * payCut(state, ship.owner, c.from))),
        why ? null : h('button.btn.primary.small', { 'data-guide': 'accept', onclick: async () => {
          if (c.embargo && !(await embargoOk(app, ship, isEmbargoed(c.from) ? c.from : c.to, c.pay))) return;
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
    const loan = ship.cargo.loan;
    box.append(h('div.card.highlight', [
      h('div.card-main', [
        h('div.card-title', [h('span.good-icon', G.icon), `${G.name} — ${tonnes(ship.cargo.qty)} à bord`]),
        ship.cargo.damage > 0.005 ? h('div.card-why', `${pct(ship.cargo.damage * 100)} de la cargaison est perdue ou avariée : elle se vendra d'autant moins.`) : null,
        // Prix d'achat, prix de vente ici et résultat, côte à côte.
        h('div.ship-stats.sale-compare', [
          stat('Acheté', `${money(ship.cargo.cost / ship.cargo.qty)}/t`, h('div.stat-sub', `${money(ship.cargo.cost)}${ship.cargo.boughtAt ? ' · ' + portName(ship.cargo.boughtAt) : ''}`)),
          q.possible ? stat('Vente ici', `${money(q.net / ship.cargo.qty)}/t`, h('div.stat-sub', `${money(q.net)} net, manutention déduite`)) : null,
          q.possible ? stat('Résultat', h('span', { class: q.profit >= 0 ? 'pos' : 'neg' }, `${money(q.profit, true)}`), h('div.stat-sub', q.profit >= 0 ? `bénéfice de ${pct(q.profit / ship.cargo.cost * 100)}` : `perte de ${pct(-q.profit / ship.cargo.cost * 100)}`)) : null,
        ]),
        q.possible && q.tender ? h('div.card-sub', [h('span.tag.good', '📣 appel d\'offres'), ` ${tonnes(q.tender.qty)} payées ${money(q.tender.tender.unit)}/t ici, le reste au cours.`]) : null,
        loan ? h('div.card-sub', [
          h('span.tag', 'prêt'),
          ` ${money(loan.amount)} prêtés par ${portName(loan.lender)} à ${pct(loan.rate * 100)}/an : remboursés à la vente, avec les intérêts (${money(q.loan.interest)} à ce jour). À vendre avant le ${date(loan.due, true)}, sinon le prêt devient une dette bancaire (+${pct(FINANCE.lateFee * 100)}).`,
          loan.dest ? ` Promis à ${portName(loan.dest)} : vendre ailleurs coûte ${pct(FINANCE.destFee * 100)} du prêt.` : null,
        ]) : null,
        q.possible ? null : h('div.card-why', `${portName(here)} ne peut pas décharger ce type de cargaison.`),
        ship.cargo.floor ? h('div.card-sub', ship.cargo.floor.until >= state.t
          ? [h('span.tag.good', 'prix garanti'), ` À ${portName(ship.cargo.floor.port)} : au moins ${money(ship.cargo.floor.unit)}/t si vous y vendez avant le ${date(ship.cargo.floor.until, true)}.`]
          : `La garantie de prix à ${portName(ship.cargo.floor.port)} a expiré.`) : null,
      ]),
      h('div.card-side', [q.possible ? h(`button.btn.small.${q.profit >= 0 ? 'primary' : 'danger'}`, { onclick: async () => {
        if (!(await embargoOk(app, ship, here, q.net))) return;
        if (q.profit < 0 && !(await confirmBox('Vendre à perte ?', `Vous perdrez ${money(-q.profit)} sur cette cargaison.`, 'Vendre'))) return;
        app.act(() => act.sellCargo(state, ctx, ship.id), { sound: 'cash' });
      } }, `Vendre ici · ${money(q.profit, true)}`) : null]),
    ]));
    // Meilleurs débouchés (appels d'offres compris, intérêts du prêt déduits).
    const outlets = [];
    const sound = ship.cargo.qty * (1 - (ship.cargo.damage || 0));
    for (const p of PORT_IDS) {
      if (p === here || !eco.portHandles(p, ship.cargo.hold) || !eco.fitsPort(p, ship.type)) continue;
      const est = tripEstimate(app, ship, p, T.speed);
      if (est.error || !est.nm) continue;
      const fq = quoteSellAt(state, p, ship.cargo.good, sound, est.totalDays, ship.id);
      const fl = ship.cargo.floor, floorOk = fl && fl.port === p && state.t + est.totalDays * 24 <= fl.until;
      const unit = floorOk ? Math.max(fq.avg, fl.unit) : fq.avg;
      const sale = unit * sound - ship.cargo.qty * eco.HANDLING_COST[ship.cargo.hold];
      const fin = loan ? loanOwedAt(loan, state.t + est.totalDays * 24) - loan.amount + (loan.dest && loan.dest !== p ? loan.amount * FINANCE.destFee : 0) : 0;
      outlets.push({ p, net: sale - est.cost - ship.cargo.cost - fin, est, unit, floorOk, tender: fq.tenderQty });
    }
    outlets.sort((a, b) => b.net - a.net);
    box.append(h('h3', 'Meilleurs débouchés (après frais de voyage, au cours attendu à l\'arrivée)'));
    box.append(h('div.list.compact', outlets.slice(0, 6).map((o) => h('div.row', { onmouseenter: () => app.hoverRoute(o.est.route || null), onmouseleave: () => app.hoverRoute(null) }, [
      h('span.grow', [portName(o.p), isEmbargoed(o.p) ? [' ', EMBARGO_TAG()] : null, o.tender ? [' ', h('span.tag.good', { title: `Appel d'offres : ${tonnes(o.tender)} payées au prix promis.` }, '📣')] : null].flat().filter(Boolean)),
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
  box.append(h('p.hint', 'Achetez une cargaison ici et revendez-la plus cher ailleurs. Les estimations tiennent compte des prix qui retombent pendant le voyage, mais le cours peut encore bouger : c\'est le risque, et la chance, du négoce. Les appels d\'offres des villes (📣) paient un prix fixé d\'avance au premier arrivé. Pas assez de trésorerie ? Les négociants ou les acheteurs avancent une part de la cargaison.'));
  for (const g of goods) {
    const G = GOODS[g];
    const hold = eco.holdFor(ship.type, g);
    const unit = eco.buyPrice(state, here, g);
    const stock = eco.availableStock(state, here, g);
    const full = Math.floor(Math.min(T.dwt, stock) / 100) * 100;
    // Meilleures destinations pour une cale pleine (appels d'offres compris).
    const dests = [];
    for (const p of PORT_IDS) {
      if (p === here || !(PORTS[p].imp[g] > 0) || !eco.fitsPort(p, ship.type) || !eco.portHandles(p, hold)) continue;
      const qty = Math.max(100, full);
      const est = tripEstimate(app, ship, p, T.speed, qty, hold);
      if (est.error || !est.nm) continue;
      const buy = act.quoteBuy(state, ship, g, qty).total;
      const fq = quoteSellAt(state, p, g, qty, est.totalDays, ship.id);
      const sell = fq.total - qty * eco.HANDLING_COST[hold];
      dests.push({ p, net: sell - buy - est.cost, unit: fq.avg, est, qty, tender: fq.tender });
    }
    dests.sort((a, b) => b.net - a.net);
    const tender = (state.tenders || []).find((t) => t.good === g && t.left > 0 && t.until > state.t);
    const choices = [0.25, 0.5, 0.75, 1].map((f) => Math.floor((full * f) / 100) * 100).filter((q, i, a) => q > 0 && a.indexOf(q) === i);
    box.append(h('div.card', [
      h('div.card-main', [
        h('div.card-title', [h('span.good-icon', G.icon), G.name, h('span.price-inline', `${money(unit)}/t`)]),
        h('div.card-sub', `Stock disponible : ${tonnes(stock)} · cours mondial ${money(G.price * state.market.world[g])}/t`),
        tender ? h('div.card-sub', [h('span.tag.good', '📣 appel d\'offres'), ` ${portName(tender.port)} achète à ${money(tender.unit)}/t jusqu'au ${date(tender.until, true)} (${tonnes(tenderRoom(tender, ship.id))} encore libres).`]) : null,
        dests.length ? h('div.card-sub', ['Meilleure destination : ', h('b', portName(dests[0].p)), isEmbargoed(dests[0].p) ? ' ' : null, isEmbargoed(dests[0].p) ? EMBARGO_TAG() : null, dests[0].tender ? ' 📣' : null, ` (${money(dests[0].unit)}/t, ${days(dests[0].est.totalDays)}) → `, h('b', { class: dests[0].net >= 0 ? 'pos' : 'neg' }, `${money(dests[0].net, true)} pour ${tonnes(dests[0].qty)}`)]) : h('div.card-why', 'Aucun port importateur accessible avec ce navire.'),
        choices.length && dests.length ? h('div.chips', choices.map((q) => h('button.chip', { onclick: () => buyDialog(app, ship, g, q, dests) }, tonnes(q)))) : null,
        !choices.length ? h('div.card-why', 'Stock épuisé, revenez plus tard.') : null,
      ]),
    ]));
  }
  return box;
}

// Achat d'une cargaison : destination visée (pour l'estimation et le financement par ses
// acheteurs), puis mode de paiement : comptant, négociants du port, acheteurs de la destination,
// ou emprunt à votre banque. Tout ce que coûte chaque option est dit avant d'acheter.
async function buyDialog(app, ship, g, q, dests) {
  const { state, ctx } = app;
  const company = state.companies[ship.owner];
  const G = GOODS[g];
  const quote = act.quoteBuy(state, ship, g, q);
  if (!(await embargoOk(app, ship, ship.port, quote.total))) return;
  const est = (p) => {
    const d = dests.find((x) => x.p === p);
    const fq = quoteSellAt(state, p, g, q, d.est.totalDays, ship.id);
    return { d, sell: fq.total - q * eco.HANDLING_COST[quote.hold], tender: fq.tenderQty };
  };
  let dest = dests[0].p, mode = null, buyBtn = null;
  const body = h('div.buy-dialog');
  const render = () => {
    const e = est(dest), days0 = e.d.est.totalDays;
    // Part financée : celle du prêteur, dans la limite de votre encours de prêts sur cargaison.
    const withShare = (t) => ({ ...t, share: financedShare(state, company, t, quote.total) });
    const origin = withShare(lenderTerms(company, ship.port)), buyer = withShare(lenderTerms(company, dest, true));
    const exposure = loanRoom(state, company);
    const room = creditLimit(state, company) - company.debt;
    const option = (id, title, lines, terms, enabled, why) => {
      const loanAmt = terms ? Math.round((quote.total * terms.share) / 1000) * 1000 : 0;
      return h('label.fin-option', { class: enabled ? '' : 'disabled' }, [
        h('input', { type: 'radio', name: 'fin', value: id, disabled: !enabled, checked: mode === id, onchange: () => { mode = id; render(); } }),
        h('span.grow', [h('b', title), ...lines.map((l) => h('div.small', l)), !enabled && why ? h('div.small.neg', why) : null]),
        terms ? h('span.fin-figure', [h('span.small.muted', 'apport'), h('b', money(quote.total - loanAmt))]) : null,
      ]);
    };
    const finLine = (terms) => {
      const loanAmt = Math.round((quote.total * terms.share) / 1000) * 1000;
      return terms.share < terms.ltv - 0.005
        ? `Prêteraient ${pct(terms.ltv * 100)}, limités à ${pct(terms.share * 100)} (${money(loanAmt)}) par votre plafond d'encours, à ${pct(terms.rate * 100)}/an : environ ${money((loanAmt * terms.rate * days0) / 365)} d'intérêts pour ce voyage. Remboursé à la vente.`
        : `Prêtent ${pct(terms.ltv * 100)} (${money(loanAmt)}) à ${pct(terms.rate * 100)}/an : environ ${money((loanAmt * terms.rate * days0) / 365)} d'intérêts pour ce voyage. Remboursé à la vente.`;
    };
    const downOk = (terms) => terms.share >= 0.1 && quote.total - Math.round((quote.total * terms.share) / 1000) * 1000 <= company.cash;
    const finWhy = (terms) => (terms.why ? `Ils refusent : ${terms.why}.` : terms.share < 0.1 ? 'Plafond de vos prêts sur cargaison atteint : vendez d\'abord une cargaison financée.' : 'Apport supérieur à votre trésorerie.');
    const bankNeed = Math.max(0, Math.ceil((quote.total * 1.01 - company.cash) / 10000) * 10000);
    const opts = [
      option('cash', 'Comptant', [`Vous payez ${money(quote.total)} maintenant.`], null, quote.total <= company.cash, `Trésorerie insuffisante (${money(company.cash)}).`),
      option('origin', `Négociants de ${portName(ship.port)} (${origin.label})`, [finLine(origin), 'Vous vendez où vous voulez.'], origin, !origin.why && downOk(origin), finWhy(origin)),
      option('dest', `Acheteurs de ${portName(dest)} (${buyer.label})`, [finLine(buyer), `À condition de vendre à ${portName(dest)} avant le ${date(state.t + FINANCE.dueDays * 24, true)} : ailleurs, ${pct(FINANCE.destFee * 100)} du prêt en frais.`], buyer, !buyer.why && downOk(buyer), finWhy(buyer)),
      bankNeed > 0 ? option('bank', 'Votre banque', [`Emprunt de ${money(bankNeed)} à ${pct(interestRate(company) * 100)}/an (intérêts seuls, remboursable quand vous voulez).`], null, room >= bankNeed, `Plafond de crédit atteint (marge : ${money(Math.max(0, room))}).`) : null,
    ].filter(Boolean);
    if (!mode || !opts.some((o) => o.querySelector('input:not(:disabled)')?.value === mode)) {
      const first = opts.map((o) => o.querySelector('input:not(:disabled)')).find(Boolean);
      mode = first?.value || null;
      if (first) first.checked = true;
    }
    const sel = h('select.input', { 'aria-label': 'Destination visée', onchange: (ev) => { dest = ev.target.value; render(); } }, dests.slice(0, 8).map((d) => h('option', { value: d.p, selected: d.p === dest }, `${portName(d.p)}${d.tender ? ' 📣' : ''}${isEmbargoed(d.p) ? ' ⚖' : ''} — ${money(d.net, true)}`)));
    body.replaceChildren(...[
      h('p', `Prix moyen ${money(quote.avg)}/t, manutention comprise : ${money(quote.total)}.`),
      h('div.form-row', [h('b', 'Destination visée : '), sel]),
      h('p.small', [
        `Vente attendue à ${portName(dest)} : ${money(e.sell)}`,
        e.tender ? ` (dont ${tonnes(e.tender)} au prix de l'appel d'offres)` : null,
        `, voyage ≈ ${money(e.d.est.cost)} (${days(days0)}). Résultat avant financement : `,
        h('b', { class: e.d.net >= 0 ? 'pos' : 'neg' }, money(e.sell - quote.total - e.d.est.cost, true)),
        '. Le cours peut encore bouger d\'ici l\'arrivée.',
      ]),
      h('h4', 'Paiement'),
      h('div.fin-options', opts),
      mode ? null : h('p.neg', 'Aucun paiement possible pour cette quantité : choisissez-en une plus petite.'),
      h('p.small.muted', `Vos prêts sur cargaison en cours : ${money(exposure.used)}, pour un plafond de ${money(exposure.cap)} (la moitié de votre valeur nette).`),
      h('p.hint', `Un prêt sur cargaison doit être remboursé dans les ${FINANCE.dueDays} jours (par la vente) ; au-delà, il devient une dette bancaire, majorée de ${pct(FINANCE.lateFee * 100)}. Si la cargaison est perdue, le prêt reste dû (l'assurance rembourse sa part de la marchandise).`),
    ].filter(Boolean));
  };
  render();
  const pending = dialog({ title: `Acheter ${tonnes(q)} de ${G.name.toLowerCase()} ?`, body, wide: true, buttons: [{ label: 'Annuler', value: null, kind: 'ghost' }, { label: 'Acheter', value: 'buy', kind: 'primary', attrs: { 'data-buy': '' } }] });
  buyBtn = document.querySelector('#dialogs .dialog-wrap:last-child [data-buy]');
  const sync = () => { if (buyBtn) buyBtn.disabled = !mode; };
  sync();
  body.addEventListener('change', sync);
  const v = await pending;
  if (v !== 'buy' || !mode) return;
  if (mode === 'bank') {
    const need = Math.max(0, Math.ceil((quote.total * 1.01 - company.cash) / 10000) * 10000);
    if (!app.act(() => act.borrow(state, company.id, need))?.ok) return;
  }
  const finance = mode === 'origin' ? { source: 'origin' } : mode === 'dest' ? { source: 'dest', dest } : null;
  const r = app.act(() => act.buyCargo(state, ctx, ship.id, g, q, finance), { sound: 'pay' });
  if (r?.ok) app.form.dest[ship.id] = dest;
}

// ---------- Équipage : expérience et spécialités ----------
function crewSkillsTab(app, ship) {
  const { state } = app;
  const box = h('div');
  const xp = ship.xp || 0, next = crew.nextStep(ship), free = crew.pointsFree(ship);
  const prev = [0, ...crew.XP_STEPS].filter((x) => x <= xp).pop();
  box.append(h('p.hint', [
    ship.crew ? `L'équipage apprend en mer, plus vite parce qu'il est ${CREW_LEVELS[ship.crew].short}. ` : 'L\'équipage apprend en mer. ',
    `À chaque palier, choisissez une spécialité : ${crew.MAX_RANK} niveaux au plus par spécialité, ${crew.XP_STEPS.length} points en tout. L'équipage reste avec le navire (on change son niveau au port, onglet Escale).`,
  ]));
  box.append(h('div.xp-line', [
    h('span', next ? `${Math.floor(xp)} jours de mer · prochain point à ${next} jours` : `${Math.floor(xp)} jours de mer · tous les points sont gagnés`),
    bar(next ? (xp - prev) / (next - prev) : 1, { good: 0, warn: 0 }),
  ]));
  if (free) box.append(h('p.pos', free === 1 ? 'Un point à attribuer : choisissez une spécialité.' : `${free} points à attribuer : choisissez des spécialités.`));
  box.append(h('div.list', crew.SKILL_IDS.map((id) => {
    const S = crew.SKILLS[id], r = crew.rank(ship, id);
    return h('div.card', { class: r ? 'highlight' : '' }, [
      h('div.card-main', [
        h('div.card-title', [`${S.icon} ${S.name}`, h('span.skill-pips', { title: `Niveau ${r} sur ${crew.MAX_RANK}` }, '●'.repeat(r) + '○'.repeat(crew.MAX_RANK - r))]),
        h('div.card-sub', S.text),
      ]),
      h('div.card-side', free && r < crew.MAX_RANK ? [h('button.btn.small.primary', { onclick: () => app.act(() => crew.train(state, ship.id, id)) }, 'Former')] : []),
    ]);
  })));
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
  if (ship.seized) return h('div', [h('p', shipStatusText(state, ctx, ship) + '.'), h('div.chips', [h('button.chip.danger', { onclick: () => seizedDialog(app, ship.id) }, 'Décider')])]);
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
let destClick = null; // position du dernier clic dans la liste des destinations
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
        est.error ? null : routeChip(dest, { eta: est.eta, deadline: contract?.deadline ?? null, late: !!contract && est.eta > contract.deadline }),
        est.error ? h('div.card-why', est.error) : h('div.card-sub', [
          `${num(est.nm)} milles · ${days(est.seaDays)} de mer`,
          h('br'),
          `Fuel nécessaire ${num(est.needFuel)} t (à bord ${num(ship.fuel)} t${toBuy > 1 ? `, à acheter ≈ ${num(toBuy)} t pour ${money(toBuy * eco.fuelPrice(state, ship.port))}` : ''})`,
          h('br'),
          ...est.canals.flatMap((c) => [`🚧 Péage du ${CANAL_NAMES[c]} : ${money(eco.canalFee(T, c))}, payé au départ`, h('br')]),
          `Frais de port à l'arrivée ${money(est.fees - est.canals.reduce((s, c) => s + eco.canalFee(T, c), 0))} · frais fixes ≈ ${money(est.cost - est.fuelCost - est.fees)}`,
          contract ? h('br') : null,
          contract ? h('span', { class: est.eta > contract.deadline ? 'neg' : 'pos' }, est.eta > contract.deadline ? `Attention : arrivée après le délai du ${date(contract.deadline, true)}` : `Dans les délais (avant le ${date(contract.deadline, true)})`) : null,
        ]),
        est.error ? null : h('div.risk-box.compact', [...darkLines(state, ship, dest), ...iceLines(state, ship, dest, est), ...riskLines(state, ship, { seaDays: est.seaDays, to: dest, route: est.route }).slice(ship.condition >= 40 ? 1 : 0), piracyLine(ship, est.route, speed, state), patrolLine(ship, est.route, speed), hostileLine(state, ship, dest), ...shadyLines(state, ship, dest)]),
        h('label.check', [
          h('input', { type: 'checkbox', checked: autoRefuel, onchange: (e) => { app.form.autoRefuel[ship.id] = e.target.checked; } }),
          ' Faire le plein automatiquement si nécessaire',
        ]),
      ]),
      h('div.card-side', [est.error ? null : h('button.btn.primary', { 'data-guide': 'sail', onclick: () => {
        const r = app.act(() => act.depart(state, ctx, ship.id, dest, speed, app.form.autoRefuel[ship.id] ?? true));
        if (r?.ok) { if (!r.queued) app.audio.play('depart', ship); delete app.form.dest[ship.id]; app.hoverRoute(null); app.setPreview(null); }
      } }, 'Appareiller')]),
    ]));
  } else {
    app.setPreview(null);
    box.append(h('p.muted', 'Choisissez une destination :'));
  }

  if (contract) return box;
  const worn = ship.condition < inspectionThreshold(eco.ageYears(state, ship));
  // Liste des destinations.
  const closed = ctx.closedCanals(state, T.draft, ship);
  const rows = PORT_IDS.filter((p) => p !== ship.port).map((p) => {
    const info = ctx.distanceInfo(ship.port, p, closed);
    let why = null;
    if (!eco.fitsPort(p, ship.type)) why = `tirant d'eau ${num1(eco.portDraft(p, ship.type))} m`;
    else if (ship.cargo && !eco.portHandles(p, ship.cargo.hold)) why = 'ne peut pas décharger';
    else if (!info) why = 'inaccessible';
    const nm = info?.nm || 0;
    const seaDays = nm / (24 * speed);
    const need = eco.burnPerDay(T, speed, eco.ageYears(state, ship)) * seaDays * 1.08;
    if (!why && need > T.tank) why = 'autonomie insuffisante';
    const exp = Object.keys(PORTS[p].exp).filter((g) => eco.holdFor(ship.type, g)).length;
    const here = state.contracts.filter((c) => c.from === p && c.takenBy === null && eco.holdFor(ship.type, c.good));
    const contracts = here.length;
    // Ceux que ce navire pourrait prendre (capacité, tirant d'eau, vitesse, terminaux) : les autres
    // restent affichés, ils donnent envie d'un autre navire.
    const fit = here.filter((c) => c.qty <= T.dwt && eco.fitsPort(c.to, ship.type) && (!c.minSpeed || T.maxSpeed >= c.minSpeed) && eco.portHandles(c.to, c.hold)).length;
    const ice = !why && isSeasonal(p) ? iceRisk(state, p, state.t + seaDays * 24, ship) : 0;
    return { p, nm, seaDays, why, contracts, fit, exp, ice, nsr: info?.canals?.includes('nsr'), reachable: !!info };
  }).sort((a, b) => (!!a.why - !!b.why) || a.nm - b.nm);
  // Survol : la route vers ce port se dessine sur la carte, comme pour les contrats (tracé calculé
  // au premier survol seulement).
  // Après un clic, la liste se décale (la carte du départ s'insère au-dessus) : le navigateur
  // signale alors un survol de la ligne arrivée sous le curseur immobile, qu'on ignore.
  const hoverOf = (r) => { let route; return (e) => {
    if (destClick && e.clientX === destClick.x && e.clientY === destClick.y) return;
    if (route === undefined) route = r.reachable ? ctx.route(ship.port, r.p, closed) || null : null;
    if (route && app.hoverPreview === route) return; // déjà affichée (mousemove)
    app.hoverRoute(route);
  }; };
  box.append(h('div.list.compact', rows.map((r) => { const hover = hoverOf(r); return h('button.row.selectable', {
    class: (r.p === dest ? 'selected ' : '') + (r.why ? 'disabled' : ''),
    disabled: !!r.why, 'data-guide': !r.why && r.contracts > 0 ? 'dest' : null, // visite guidée : un port qui a des contrats
    onclick: (e) => { destClick = { x: e.clientX, y: e.clientY }; app.form.dest[ship.id] = r.p; app.hoverRoute(null); app.refresh(); },
    onmouseenter: hover, onmousemove: hover, onmouseleave: () => app.hoverRoute(null),
  }, [
    flagEl(PORTS[r.p].flag),
    h('span.grow', portName(r.p)),
    isEmbargoed(r.p) ? EMBARGO_TAG() : null,
    r.why ? h('span.muted.small', r.why) : h('span.muted.small', `${num(r.nm)} milles · ${days(r.seaDays)}`),
    !r.why && worn && isStrict(r.p) ? h('span.tag.warn', { title: 'Port exigeant : risque de détention pour un navire usé' }, '⚠ contrôles') : null,
    !r.why && r.ice >= 1 ? h('span.tag.warn', { title: 'Port pris par les glaces à votre arrivée : escorte d\'un brise-glace obligatoire.' }, '❄ glaces') : null,
    !r.why && r.ice > 0 && r.ice < 1 ? h('span.tag.warn', { title: 'Le port risque d\'être pris par les glaces à votre arrivée.' }, `❄ risque ${pct(r.ice * 100)}`) : null,
    !r.why && r.nsr ? h('span.tag', { title: 'Route par le passage du Nord-Est, ouvert l\'été.' }, '🧊 Nord-Est') : null,
    grudgeAt(state, company, r.p) ? h('span.tag.bad', { title: 'Un gang de ce port en veut à votre compagnie : risque de saisie à l\'escale.' }, '⚠ gang') : null,
    ship.dark?.to === r.p ? h('span.tag.bad', 'livraison noire') : null,
    !r.why && r.contracts ? h('span.tag', { class: r.fit ? 'good' : '' }, [h('span', r.contracts > 1 ? `${r.contracts} contrats` : `${r.contracts} contrat`), r.fit ? ' · ' : null, r.fit ? h('span', `${r.fit} pour ce navire`) : null]) : null,
  ]); })));
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
