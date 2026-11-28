// Ordres permanents sur la fiche du navire (sim/orders.js) : la rangée « Ordres » sous la ligne d'état,
// la case « ligne régulière » de la carte d'appareillage, la fenêtre du capitaine libre, et la reprise
// en main (son prix est dit avant de confirmer : règle 1).
import { SHIP_TYPES, CREW_LEVELS } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import { portName } from '../sim/core.js';
import * as O from '../sim/orders.js';
import * as crew from '../sim/crew.js';
import { h, money, tonnes, dialog } from './dom.js';

const linePorts = (o) => `${portName(o.a)} ⇄ ${portName(o.b)}`;
const refusals = (L) => [!L.pirates && 'pirates', !L.embargo && 'embargo', !L.polluting && 'cargaisons polluantes', !L.oil && 'pétrole'].filter(Boolean);

// Ce que fait le navire sous ordres, en une ligne (fiche, flotte).
export function ordersText(state, ship) {
  const o = ship.orders;
  if (!o) return null;
  if (o.kind === 'line') return o.trade ? `↻ Ligne ${linePorts(o)} · ${GOODS[o.trade.good].name.toLowerCase()} au départ de ${portName(o.trade.at)}` : `↻ Ligne ${linePorts(o)} · contrats`;
  const no = refusals(o.limits), fee = money(O.captainFeeDay(state, ship));
  return no.length ? `🧭 Capitaine libre · ${fee}/jour · jamais : ${no.join(', ')}` : `🧭 Capitaine libre · ${fee}/jour`;
}

// La rangée « Ordres » : à la main, ligne régulière, capitaine libre ; les conditions au survol.
export function ordersRow(app, ship) {
  const { state } = app;
  if (ship.status === 'laidup') return null;
  const o = ship.orders;
  const kind = o?.kind || 'main';
  const lineNo = O.lineWhy(ship), capNo = O.captainWhy(ship);
  // Une puce verrouillée reste cliquable : elle dit ce qu'il manque (un bouton désactivé ne montre pas toujours sa bulle).
  const chip = (id, label, title, locked, onclick) => h('button.chip', { class: kind === id ? 'active' : locked ? 'locked' : '', title,
    onclick: locked ? () => app.toast(title, { kind: 'warn', timeout: 7000 }) : onclick }, label);
  const row = h('div.chips.orders-row', [
    h('span.orders-label', 'Ordres :'),
    chip('main', 'À la main', 'Vous donnez vous-même chaque ordre.', false, () => { if (o) takeBackFlow(app, ship); }),
    chip('line', '↻ Ligne régulière', lineNo || 'Le navire fait la navette entre deux ports, sans vous : cochez « ligne régulière » au moment d\'appareiller.', !!lineNo && kind !== 'line', () => lineFlow(app, ship)),
    chip('captain', '🧭 Capitaine libre', capNo || 'Le capitaine choisit lui-même contrats et cargaisons, dans vos limites, contre des honoraires.', !!capNo && kind !== 'captain', () => captainDialog(app, ship)),
  ]);
  const box = h('div.orders', [row]);
  if (o) {
    box.append(h('div.risk-box.compact.orders-box', [
      h('div.risk-line', [h('b', ordersText(state, ship))]),
      o.calling
        ? h('div.risk-line.warn-text', `📣 Il vous appelle : ${o.calling}. Réglez le problème puis relancez, ou reprenez la main : sans frais, puisqu'il vous a appelé.`)
        : h('div.risk-line.muted', o.kind === 'line'
          ? 'Il s\'arrête et vous appelle si la marge passe sous zéro, si un nouveau risque apparaît sur la route, si l\'argent manque ou si une décision vous revient.'
          : `Il vous appelle si rien ne convient depuis ${O.ORDERS.callDays} jours ou si une décision vous revient. Reprendre la main sans qu'il vous ait appelé : le vieux briscard quitte le navire.`),
      o.calling ? h('div.chips', [
        h('button.chip', { onclick: () => app.act(() => O.resumeOrders(state, ship.id)) }, '▶ Relancer'),
        o.kind === 'captain' ? h('button.chip', { onclick: () => captainDialog(app, ship) }, 'Modifier les limites') : null,
        h('button.chip', { onclick: () => takeBackFlow(app, ship) }, 'Reprendre la main'),
      ]) : o.kind === 'captain' ? h('div.chips', [h('button.chip', { onclick: () => captainDialog(app, ship) }, 'Modifier les limites')]) : null,
    ]));
  }
  return box;
}

// Onglet des escales d'un navire sous ordres : ce qu'il fait, à la place des contrats et du départ.
export function ordersTab(app, ship) {
  return h('div', [
    h('p.hint', ship.orders?.kind === 'line'
      ? 'Ce navire est sur sa ligne régulière : il choisit ses chargements et repart seul. Les encaissements restent pour vous.'
      : 'Le capitaine choisit lui-même ses chargements et repart seul. Les encaissements restent pour vous.'),
    h('p.muted.small', 'Pour donner vos ordres vous-même : « À la main » dans la rangée Ordres.'),
  ]);
}

// ---------- Ligne régulière ----------
// La case de la carte d'appareillage (seulement si l'équipage le permet), et son résumé une fois cochée.
export function lineTick(app, ship, dest) {
  if (!O.canLine(ship) || O.onOrders(ship)) return null;
  app.form.line ??= {};
  const on = !!app.form.line[ship.id];
  const box = h('div', [h('label.check.line-check', [
    h('input', { type: 'checkbox', checked: on, onchange: (e) => { app.form.line[ship.id] = e.target.checked; app.refresh(); } }),
    ' ↻ En faire une ligne régulière : le navire refait ce trajet en boucle',
  ])]);
  if (on && dest) {
    const trade = lineTrade(ship);
    box.append(h('div.risk-box.compact.orders-box', [
      h('div.risk-line', [h('b', `↻ Ligne ${portName(ship.port)} ⇄ ${portName(dest)}`)]),
      h('div.risk-line', trade
        ? `Aller : ${GOODS[trade.good].icon} ${GOODS[trade.good].name.toLowerCase()} acheté ici (${tonnes(trade.qty)}, comptant), vendu à l'arrivée. Retour : le meilleur contrat pour ${portName(ship.port)}, sinon à vide.`
        : `Chaque sens : le meilleur contrat pour l'autre bout de la ligne ; à vide si un chargement attend en face.`),
      h('div.risk-line', `Entretien : au chantier de l'un des deux ports sous ${O.ORDERS.repairBelow} %. Les risques de la route sont ceux affichés ci-dessus, dans les deux sens.`),
      h('div.risk-line.muted', 'Il s\'arrête et vous appelle si la marge passe sous zéro, si un nouveau risque apparaît sur la route, si l\'argent manque ou si une décision vous revient. Arrêter la ligne est gratuit.'),
    ]));
  }
  return box;
}
// La marchandise de la ligne : la cargaison de négoce achetée ici (sinon une ligne de contrats).
const lineTrade = (ship) => (ship.cargo && !ship.cargo.contractId && ship.cargo.boughtAt === ship.port ? { good: ship.cargo.good, qty: ship.cargo.qty } : null);
export const lineWanted = (app, ship) => !!app.form.line?.[ship.id] && O.canLine(ship) && !O.onOrders(ship);
// Appareiller en ligne : l'ordre est donné avant le départ (le port de départ est un bout de la ligne).
export function startLine(app, ship, dest, speed) {
  const r = app.act(() => O.setLine(app.state, app.ctx, ship.id, { from: ship.port, to: dest, speed, trade: lineTrade(ship) }), { refresh: false });
  if (r?.ok) delete app.form.line[ship.id];
  return !!r?.ok;
}

// La puce « Ligne régulière » : au port, la case du départ ; en route, faire de ce trajet une ligne.
async function lineFlow(app, ship) {
  const { state, ctx } = app;
  if (ship.orders?.kind === 'line') return;
  if (ship.orders?.kind === 'captain' && !(await takeBackFlow(app, ship))) return;
  const v = ship.voyage, from = ship.status === 'sea' ? v?.from : ship.port, to = ship.status === 'sea' ? v?.to : ship.plan?.to;
  if (!to) { app.form.line ??= {}; app.form.line[ship.id] = true; app.open('ship', ship.id, 'depart'); return; }
  const trade = ship.cargo && !ship.cargo.contractId && ship.cargo.boughtAt === from ? { good: ship.cargo.good, qty: ship.cargo.qty } : null;
  const ok = await dialog({
    title: '↻ Ligne régulière',
    body: h('div', [
      h('p', `Faire du trajet en cours une ligne régulière : ${portName(from)} ⇄ ${portName(to)}.`),
      h('p', trade ? `Aller : ${GOODS[trade.good].name.toLowerCase()} acheté à ${portName(from)} (${tonnes(trade.qty)}, comptant). Retour : le meilleur contrat, sinon à vide.` : 'Chaque sens : le meilleur contrat pour l\'autre bout ; à vide si un chargement attend en face.'),
      h('p.muted', 'Il s\'arrête et vous appelle si la marge passe sous zéro, si un nouveau risque apparaît sur la route, si l\'argent manque ou si une décision vous revient.'),
    ]),
    buttons: [{ label: 'Annuler', value: false, kind: 'ghost' }, { label: 'Lancer la ligne', value: true, kind: 'primary' }],
  });
  if (ok) app.act(() => O.setLine(state, ctx, ship.id, { from, to, speed: v?.speed || ship.plan?.speed || SHIP_TYPES[ship.type].speed, trade }));
}

// ---------- Capitaine libre ----------
export async function captainDialog(app, ship) {
  const { state } = app;
  if (!O.canCaptain(ship)) return;
  const L = { ...O.ORDERS.limits, ...(ship.orders?.kind === 'captain' ? ship.orders.limits : ship.captainLimits || {}) };
  const check = (key, label) => h('label.check', [h('input', { type: 'checkbox', checked: !L[key], onchange: (e) => { L[key] = !e.target.checked; } }), ` ${label}`]);
  const select = (key, choices, fmt) => h('select.input.orders-select', { onchange: (e) => { L[key] = +e.target.value; } },
    choices.map((c) => h('option', { value: c, selected: c === L[key] || null }, fmt(c))));
  const body = h('div.orders-dialog', [
    h('p', 'Le capitaine choisit lui-même contrats et cargaisons, comme les concurrents, mais sans erreur d\'estimation. Les encaissements restent pour vous.'),
    h('p', [h('b', 'Jamais :')]),
    h('div.orders-checks', [check('pirates', '☠ zones de pirates'), check('embargo', '⚖ pays sous embargo'), check('polluting', 'cargaisons polluantes'), check('oil', '💚 pétrole (vertu −)')]),
    h('div.orders-fields', [
      h('label', ['Voyage le plus long : ', select('maxDays', O.MAX_DAYS_CHOICES, (d) => `${d} jours`)]),
      h('label', ['Négoce, comptant et sans prêt : ', select('trade', O.TRADE_CHOICES, (v) => (v ? `jusqu'à ${money(v)}` : 'jamais'))]),
      h('label', ['Passage au chantier sous : ', select('repairBelow', [55, 60, 65, 70, 75], (v) => `${v} % d'état`)]),
    ]),
    h('p', [h('b', 'Honoraires : '), `${money(O.captainFeeDay(state, ship))} par jour tant qu'il commande (deux fois les salaires d'un équipage de base).`]),
    h('p.muted', `Il vous appelle si rien ne convient depuis ${O.ORDERS.callDays} jours ou si une décision vous revient (litige, douane, rançon, glaces). Reprendre la main sans qu'il vous ait appelé : le vieux briscard quitte le navire (un niveau de Vieux briscards perdu, à regagner en mer).`),
  ]);
  const ok = await dialog({ title: '🧭 Capitaine libre', body, wide: true, buttons: [{ label: 'Annuler', value: false, kind: 'ghost' }, { label: ship.orders?.kind === 'captain' ? 'Enregistrer' : 'Confier le navire', value: true, kind: 'primary' }] });
  if (!ok) return;
  app.act(() => O.setCaptain(state, ship.id, L));
}

// ---------- Reprendre la main ----------
// Une ligne s'arrête sans frais ; le capitaine aussi s'il vous a appelé. Sinon le prix est dit avant.
export async function takeBackFlow(app, ship) {
  const { state } = app;
  if (!ship.orders) return true;
  if (O.takeBackCost(ship) === 'briscard') {
    const was = CREW_LEVELS[ship.crewWas || 0]?.short || CREW_LEVELS[0].short;
    // Jours de mer pour regagner le palier perdu, au rythme de l'équipage d'avant.
    const k = crew.pointsEarned(ship);
    const days = Math.round((crew.XP_STEPS[k - 1] - (k >= 2 ? crew.XP_STEPS[k - 2] : 0)) / crew.learnRate({ crew: ship.crewWas || 0 }));
    const ok = await dialog({
      title: 'Reprendre la main ?',
      body: h('div', [
        h('p', 'Le capitaine ne vous a pas appelé : s\'il perd la main, le vieux briscard quitte le navire.'),
        h('p', `La spécialité Vieux briscards perd un niveau, l'équipage redevient ${was} et ce point est à regagner en mer (environ ${days} jours de mer). Le capitaine libre ne revient qu'avec lui.`),
      ]),
      buttons: [{ label: 'Garder le capitaine', value: false, kind: 'ghost' }, { label: 'Reprendre la main', value: true, kind: 'danger' }],
    });
    if (!ok) return false;
  }
  const r = app.act(() => O.takeBack(state, ship.id));
  if (r?.lost) app.toast(`Le vieux briscard quitte le ${ship.name}.`, { kind: 'warn', timeout: 6000 });
  return !!r?.ok;
}
