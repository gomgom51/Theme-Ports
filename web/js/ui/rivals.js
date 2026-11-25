// Bureau → Concurrents : racheter une compagnie, ou lui compliquer la vie (coups de concurrence).
// Et, côté victime : l'offre de rachat (demander six mois, vendre), parer un coup.
import { CLIENTS } from '../data/clients.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { OFFICE_TIERS } from '../data/offices.js';
import { netWorth, shipsOf, portName, fleetValue } from '../sim/core.js';
import { relationOf, LOYAL } from '../sim/clients.js';
import { pointsEarned, XP_STEPS } from '../sim/crew.js';
import * as P from '../sim/plots.js';
import * as TK from '../sim/takeover.js';
import { h, money, date, num, pct, dialog, confirmBox, toast } from './dom.js';
import { logoBadge } from './logos.js';

const badge = (c, size = 34) => h('span.badge-wrap', { html: logoBadge(c.logo, c.color, size) });
const rivalsOf = (state, cid) => state.companies.filter((c) => c.id !== cid && !c.bankrupt);

// ---------- L'onglet ----------
export function rivalsTab(app) {
  const { state } = app;
  const me = state.companies[app.ui.activeCompany];
  const box = h('div.rivals');
  box.append(h('p.small.muted', `Racheter un concurrent : prix = sa valeur nette × (1 + réputation ÷ ${TK.TAKEOVER.repK}), payé comptant avec votre trésorerie nette (liquidités moins dettes et prêts sur cargaison), sans emprunt, et seulement s'il n'est pas d'un niveau supérieur au vôtre. Une compagnie de l'ordinateur accepte aussitôt ; un joueur a ${TK.TAKEOVER.bidDays} jours pour réagir. Chaque coup contre un concurrent vous coûte de la réputation, peut faire scandale, et la victime en entend parler.`));
  const mine = TK.reprieveOf(state, me);
  if (mine) box.append(h('p.vic-claimed', `Vos actionnaires vous ont donné jusqu'au ${date(mine.until, true)} : aucun rachat de votre compagnie possible d'ici là.`));
  const bid = TK.pendingBid(state, me.id);
  if (bid) box.append(h('div.bid-banner', [h('b', `Offre de rachat de ${state.companies[bid.by].name} : ${money(bid.price)}`), ` · elle aboutira le ${date(bid.until, true)} si elle tient toujours. `, h('button.btn.small', { onclick: () => bidDialog(app, bid.id) }, 'Réagir')]));
  const buyers = rivalsOf(state, me.id).filter((o) => TK.canTakeover(state, o.id, me.id).ok);
  if (buyers.length) box.append(h('p.warn-text', `Peuvent vous racheter aujourd'hui (${money(TK.takeoverPrice(state, me))}) : ${buyers.map((o) => o.name).join(', ')}.`));
  for (const c of rivalsOf(state, me.id)) {
    const chk = TK.canTakeover(state, me.id, c.id);
    const lv = c.level ?? 0;
    box.append(h('div.rival-card', [
      h('div.rival-head', [
        badge(c),
        h('div.grow', [
          h('b', { 'data-no-tr': '' }, c.name), c.human ? null : h('span.muted.small', ' (ordinateur)'),
          h('div.small.muted', `Niveau ${lv + 1} · ${shipsOf(state, c.id).length} navires · réputation ${Math.floor(c.reputation)} · valeur nette ${money(netWorth(state, c.id))}`),
        ]),
      ]),
      h('div.rival-buy', [
        h('div.grow', [h('span', 'Prix de rachat : '), h('b', money(chk.price ?? TK.takeoverPrice(state, c))), chk.ok ? null : h('div.small.muted', chk.why)]),
        h('button.btn.small.primary', { disabled: !chk.ok, onclick: () => takeoverDialog(app, c.id) }, 'Racheter'),
      ]),
      h('div.rival-attacks', [
        attackButton(app, c, 'smear'),
        attackButton(app, c, 'pricewar'),
        attackButton(app, c, 'payments'),
        attackButton(app, c, 'bank'),
        attackButton(app, c, 'crew'),
      ]),
      plotsByMeAgainst(app, c),
    ]));
  }
  if (!rivalsOf(state, me.id).length) box.append(h('p.muted', 'Plus aucun concurrent en lice.'));
  return box;
}
function plotsByMeAgainst(app, c) {
  const { state } = app;
  const mine = P.plotsBy(state, app.ui.activeCompany).filter((p) => p.target === c.id && P.ATTACKS[p.kind]);
  if (!mine.length) return null;
  return h('div.small.muted', mine.map((p) => `${P.ATTACKS[p.kind].name} en cours jusqu'au ${date(p.until, true)}. `));
}
const ATTACK_TEXT = {
  smear: () => `Une campagne de presse : environ ${P.SMEAR_WEEKLY} point de réputation perdu chaque semaine pendant huit semaines. Sa réputation baisse, son prix de rachat aussi.`,
  pricewar: () => `Dans un port de votre choix, pendant deux mois, les chargeurs lui paient le fret ${Math.round(P.PRICEWAR_CUT * 100)} % moins cher.`,
  payments: () => `Un chargeur dont vous êtes le partenaire fidèle fait traîner ses paiements pendant trois mois (${P.PAYMENT_DELAY[0]} à ${P.PAYMENT_DELAY[1]} jours de retard).`,
  bank: () => `Vos relations font pression sur sa banque : son plafond de crédit est divisé par deux pendant six mois.`,
  crew: () => `Vos recruteurs débauchent les meilleurs marins d'un de ses navires : il perd un point d'expérience, un de vos navires en gagne un.`,
};
function attackButton(app, c, kind) {
  const A = P.ATTACKS[kind];
  const me = app.state.companies[app.ui.activeCompany];
  const locked = (me.level ?? 0) < A.minLevel;
  return h('button.btn.small.ghost.attack-btn', { title: locked ? `Niveau ${A.minLevel + 1} requis` : ATTACK_TEXT[kind](), disabled: locked, onclick: () => attackDialog(app, c.id, kind) }, A.name);
}

// ---------- Racheter ----------
export async function takeoverDialog(app, targetId) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const c = state.companies[targetId];
  const chk = TK.canTakeover(state, me, targetId);
  if (!chk.ok) { toast(chk.why, { kind: 'warn' }); return; }
  const pv = TK.takeoverPreview(state, me, targetId);
  const ok = await confirmBox(`Racheter ${c.name} ?`, h('div', [
    h('p', `Prix : ${money(pv.price)} payés comptant (valeur nette ${money(pv.worth)} × ${(1 + c.reputation / TK.TAKEOVER.repK).toFixed(2).replace('.', ',')} pour sa réputation).`),
    h('p', `Vous reprenez ${pv.ships} navire(s), ses commandes et ses contrats, ${money(pv.cash)} de liquidités et ${money(pv.debt)} de dettes.`),
    h('p', [`Votre réputation passerait de ${Math.floor(state.companies[me].reputation)} à environ ${Math.floor(pv.rep)}.`, pv.infamy > (state.companies[me].infamy || 0) + 0.5 ? ' Vous hériteriez aussi d\'une part de son infamie.' : null]),
    c.human ? h('p.warn-text', `${c.name} est dirigée par un joueur : il aura ${TK.TAKEOVER.bidDays} jours pour réagir (demander un délai à ses actionnaires).`) : null,
  ]), c.human ? 'Faire l\'offre' : `Racheter · ${money(pv.price)}`);
  if (!ok) return;
  const r = app.act(() => TK.makeBid(state, me, targetId, state.queuedNotes ??= []), { sound: 'cash' });
  if (r?.ok) toast(r.bid ? `Offre déposée : ${c.name} a ${TK.TAKEOVER.bidDays} jours pour réagir.` : `${c.name} est à vous.`, { kind: 'money', timeout: 6000 });
}

// ---------- Un coup de concurrence ----------
async function attackDialog(app, targetId, kind) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const c = state.companies[targetId], A = P.ATTACKS[kind];
  const opts = { kind, target: targetId };
  let picker = null;
  if (kind === 'pricewar') {
    const ports = [...new Set(shipsOf(state, targetId).map((s) => s.voyage?.to || s.port).filter(Boolean))];
    const list = [...ports, ...PORT_IDS.filter((p) => !ports.includes(p))];
    picker = h('select.input', { 'aria-label': 'Port' }, list.map((p) => h('option', { value: p }, `${portName(p)}${ports.includes(p) ? ' — ses navires y vont' : ''}`)));
  } else if (kind === 'payments') {
    const loyal = Object.keys(CLIENTS).filter((id) => relationOf(state.companies[me], id).loyalty >= LOYAL);
    if (!loyal.length) { toast('Aucun chargeur ne vous est assez fidèle pour vous rendre ce service.', { kind: 'warn' }); return; }
    picker = h('select.input', { 'aria-label': 'Chargeur' }, loyal.map((id) => h('option', { value: id, 'data-no-tr': '' }, `${CLIENTS[id].name}${relationOf(c, id).deliveries ? ' ✓' : ''}`)));
  } else if (kind === 'crew') {
    const vets = shipsOf(state, targetId).filter((s) => pointsEarned(s) > 0);
    const mine = shipsOf(state, me).filter((s) => pointsEarned(s) < XP_STEPS.length);
    if (!vets.length || !mine.length) { toast(vets.length ? 'Aucun de vos équipages ne peut encore progresser.' : 'Aucun de ses équipages n\'a encore d\'expérience.', { kind: 'warn' }); return; }
    picker = h('div.form-row', [
      h('select.input.crew-from', { 'aria-label': 'Navire visé' }, vets.map((s) => h('option', { value: s.id }, `${s.name} — ${pointsEarned(s)} pts`))),
      h('span', '→'),
      h('select.input.crew-to', { 'aria-label': 'Votre navire' }, mine.map((s) => h('option', { value: s.id }, s.name))),
    ]);
  }
  const read = () => {
    if (kind === 'pricewar') opts.port = picker.value;
    if (kind === 'payments') opts.client = picker.value;
    if (kind === 'crew') { opts.ship = Number(picker.querySelector('.crew-from').value); opts.toShip = Number(picker.querySelector('.crew-to').value); }
    return opts;
  };
  const priceEl = h('b'), whyEl = h('div.small.warn-text');
  const update = () => { read(); priceEl.textContent = money(P.attackPrice(state, kind, opts)); whyEl.textContent = P.attackCheck(state, me, kind, opts) || ''; };
  picker?.addEventListener?.('change', update);
  update();
  const v = await dialog({
    title: `${A.name} contre ${c.name}`,
    body: h('div', [
      h('p', ATTACK_TEXT[kind]()),
      picker,
      h('p', ['Coût : ', priceEl, ` · réputation −${A.rep} à coup sûr (le milieu jase).`]),
      h('p.small.muted', [`${c.name} en entendra parler (une rumeur, sans votre nom) et pourra parer le coup en payant. Risque que l'affaire s'ébruite : ${pct(A.expose * 100)}.`, A.scandal.fine ? ` Scandale : réputation −${A.scandal.rep} et amende de ${money(A.scandal.fine)}.` : ` Scandale : réputation −${A.scandal.rep}.`]),
      whyEl,
    ]),
    buttons: [{ label: 'Annuler', value: null, kind: 'ghost' }, { label: 'Lancer', value: 'go', kind: 'danger' }],
  });
  if (v !== 'go') return;
  read();
  const r = app.act(() => app.withRng((rng) => P.orderAttack(state, rng, me, opts)), { sound: 'pay' });
  if (r?.ok) toast('C\'est lancé.', { timeout: 3000 });
}

// ---------- Côté victime ----------
export async function bidDialog(app, bidId) {
  const { state } = app;
  const bid = (state.bids || []).find((b) => b.id === bidId && b.status === 'pending');
  if (!bid) return;
  const me = state.companies[bid.target], buyer = state.companies[bid.by];
  const chance = TK.reprieveChance(me);
  const v = await dialog({
    title: `${buyer.name} veut racheter ${me.name}`,
    body: h('div', [
      h('p', `${buyer.name} propose ${money(bid.price)} à vos actionnaires. Sans réaction, la vente se fera le ${date(bid.until, true)} si l'offre tient toujours : la partie serait alors finie pour ${me.name}.`),
      h('p', `L'offre tombe d'elle-même si, d'ici là, votre prix dépasse sa trésorerie nette (votre réputation le multiplie : 1 + réputation ÷ ${TK.TAKEOVER.repK}) ou si vous passez à un niveau supérieur au sien.`),
      bid.asked ? h('p.muted', 'Vous avez déjà demandé un délai pour cette offre.') : h('p', `Vous pouvez demander six mois à vos actionnaires pour redresser la barre : ${pct(chance * 100)} de chances qu'ils acceptent (selon votre réputation ; moins à chaque nouvelle demande). Ils vous protégeraient alors de tout rachat pendant six mois.`),
    ]),
    buttons: [
      { label: 'Vendre maintenant', value: 'sell', kind: 'ghost' },
      { label: 'Plus tard', value: null, kind: 'ghost' },
      bid.asked ? null : { label: `Demander six mois (${pct(chance * 100)})`, value: 'ask', kind: 'primary' },
    ].filter(Boolean),
  });
  if (v === 'ask') {
    const r = app.act(() => app.withRng((rng) => TK.askReprieve(state, rng, bidId)));
    if (r?.ok) toast(r.granted ? `Vos actionnaires vous font confiance : six mois, jusqu'au ${date(r.until, true)}.` : 'Vos actionnaires refusent : l\'offre tient toujours.', { kind: r.granted ? 'money' : 'bad', timeout: 8000 });
  } else if (v === 'sell') {
    if (await confirmBox('Vendre votre compagnie ?', `${buyer.name} rachète ${me.name} pour ${money(bid.price)} : la partie est finie pour vous.`, 'Vendre')) app.act(() => TK.acceptBid(state, bidId, state.queuedNotes ??= []));
  }
}
export async function counterDialog(app, plotId) {
  const { state } = app;
  const p = P.plotsAgainst(state, app.ui.activeCompany).find((x) => x.id === plotId);
  if (!p) return;
  const what = { sabotage: 'Mettre des gardes à bord pour un mois', payments: 'Mandater un cabinet de recouvrement', bank: 'Passer chez une autre banque', pricewar: 'Riposte commerciale', smear: 'Contre-campagne de presse', crew: 'Prime de fidélité à l\'équipage' }[p.kind];
  const ok = await confirmBox(`${what} ?`, P.attackRumour(state, p), `${what} · ${money(p.counter)}`);
  if (!ok) return;
  const r = app.act(() => P.counterPlot(state, app.ui.activeCompany, plotId), { sound: 'pay' });
  if (r?.ok) toast('Coup paré.', { timeout: 3000 });
}
