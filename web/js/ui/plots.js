// Interface des coups bas : la Mafia (intermédiaires des ports louches), l'informateur, la retenue abusive,
// les rumeurs de menace dans les notifications importantes, le débauchage d'un chargeur.
import { CLIENTS } from '../data/clients.js';
import { PIRACY_ZONES } from '../sim/piracy.js';
import { portName, shipsOf, rivalsOf } from '../sim/core.js';
import { relationOf } from '../sim/clients.js';
import * as P from '../sim/plots.js';
import { h, money, date, dialog, confirmBox, toast, pctOf } from './dom.js';

const nameOf = (state, id) => state.companies[id]?.name || '?';

// ---------- Rumeurs et menaces (notifications importantes) ----------
export function threatText(state, p, cid) {
  const who = p.known.includes(cid) ? ` Commanditaire : ${nameOf(state, p.by)}.` : ' Un informateur peut dire qui est derrière.';
  if (P.ATTACKS[p.kind]) return P.attackRumour(state, p) + who;
  if (p.kind === 'pirates') return `Rumeurs : des pirates seraient payés pour viser vos navires dans la zone ${P.zoneById(p.zone).name} jusqu'au ${date(p.until, true)} (attaques environ ${P.PIRATE_BOOST} fois plus probables, assaillants mieux armés). Évitez la zone ou renforcez la défense.${who}`;
  return `Rumeurs : les autorités de ${portName(p.port)} seraient achetées contre vous jusqu'au ${date(p.until, true)} : vos navires risquent d'y être retenus sans motif (environ ${pctOf(P.HELD_CHANCE)} des escales). Évitez ce port.${who}`;
}
// Ajoute aux notifications importantes : menaces contre vous, navires retenus ou dénoncés, vos affaires en cours.
export function plotAlerts(state, cid, add) {
  const ICON = { pirates: '☠', corruption: '🏛', sabotage: '🧨', payments: '⏳', bank: '🏦', pricewar: '📉', smear: '📰', crew: '🧭' };
  for (const p of P.plotsAgainst(state, cid)) add('watch', ICON[p.kind] || '⚠', threatText(state, p, cid), P.ATTACKS[p.kind] && p.counter && !p.countered ? { counter: p.id } : { plot: p.id }, ['Rumeur', P.ATTACKS[p.kind] ? `${P.ATTACKS[p.kind].name} contre vous` : p.kind === 'pirates' ? `pirates payés · ${P.zoneById(p.zone).name} · jusqu'au ${date(p.until, true)}` : `autorités de ${portName(p.port)} achetées · ${pctOf(P.HELD_CHANCE)} de retenue`]);
  for (const s of shipsOf(state, cid)) {
    if (s.heldBogus || s.busyWhat === 'retenue') add('urgent', '🏛', `Le ${s.name} est retenu sans motif sérieux à ${portName(s.port)} : un avocat peut le faire libérer sous 24 heures.`, { held: s.id }, [s.name, `retenu sans motif à ${portName(s.port)}`]);
    if (s.contraband && P.tipped(state, s)) add('urgent', '📦', `Quelqu'un aurait parlé à la douane du colis du ${s.name} : fouille presque certaine (environ ${pctOf(P.TIP_DETECT)}) à sa prochaine escale. Jeter le colis par-dessus bord ?`, { jettison: s.id }, [s.name, `colis dénoncé · fouille ${pctOf(P.TIP_DETECT)}`]);
  }
  for (const p of P.plotsBy(state, cid)) {
    if (P.ATTACKS[p.kind]) { add('info', '🕴', `${P.ATTACKS[p.kind].name} contre ${nameOf(state, p.target)} jusqu'au ${date(p.until, true)}.`, null, [P.ATTACKS[p.kind].name, `contre ${nameOf(state, p.target)} · jusqu'au ${date(p.until, true)}`]); continue; }
    add('info', '🕴', p.kind === 'pirates'
      ? `Vos pirates guettent les navires de ${nameOf(state, p.target)} dans la zone ${P.zoneById(p.zone).name} jusqu'au ${date(p.until, true)}.`
      : `Les autorités de ${portName(p.port)} retiennent les navires de ${nameOf(state, p.target)} jusqu'au ${date(p.until, true)}.`, null,
      [p.kind === 'pirates' ? 'Vos pirates' : `Autorités de ${portName(p.port)}`, `${p.kind === 'pirates' ? 'guettent' : 'retiennent'} ${nameOf(state, p.target)} · jusqu'au ${date(p.until, true)}`]);
  }
}
// Étiquette d'un contrat ou d'une destination quand le port est hostile.
export function hostileTag(state, cid, port) {
  const p = P.hostilePort(state, cid, port);
  if (!p) return null;
  return h('span.tag.bad', { title: `Les autorités de ${portName(port)} seraient achetées contre vous jusqu'au ${date(p.until, true)} : environ ${pctOf(P.HELD_CHANCE)} de risque d'y être retenu sans motif (6 à 14 jours, ou un avocat).` }, '⚠ autorités hostiles');
}
export function hostileLine(state, ship, to) {
  const p = to && P.hostilePort(state, ship.owner, to);
  if (!p) return null;
  return h('div.risk-line.neg', `🏛 Les autorités de ${portName(to)} seraient achetées contre vous jusqu'au ${date(p.until, true)} : environ ${pctOf(P.HELD_CHANCE)} de risque que le ${ship.name} y soit retenu sans motif, 6 à 14 jours (un avocat peut le faire libérer sous 24 heures, contre paiement).`);
}

// ---------- Retenue abusive : attendre ou payer l'avocat ----------
export async function heldDialog(app, shipId) {
  const { state } = app;
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship || !(ship.heldBogus || ship.busyWhat === 'retenue')) return;
  const days = ship.heldBogus ? ship.heldBogus.days : Math.max(1, Math.ceil((ship.busyUntil - state.t) / 24));
  const price = ship.heldBogus ? ship.heldBogus.lawyer : ship.lawyer || P.lawyerPrice(days);
  const plot = P.hostilePort(state, ship.owner, ship.port);
  const who = plot && plot.known.includes(ship.owner) ? h('p', `Vous savez qui est derrière : ${nameOf(state, plot.by)}.`) : null;
  const choice = await dialog({
    title: 'Retenu sans motif sérieux',
    body: h('div', [
      h('p', `À ${portName(ship.port)}, les autorités retiennent le ${ship.name} sur un prétexte : ${days} jours d'immobilisation${ship.heldBogus ? ' (après le déchargement)' : ''}.`),
      h('p', `Un avocat peut obtenir sa libération sous 24 heures pour ${money(price)}.`),
      who,
    ]),
    buttons: [{ label: `Attendre (${days} j)`, value: 'wait', kind: 'ghost' }, { label: `Payer l'avocat (${money(price)})`, value: 'lawyer', kind: 'primary' }],
  });
  if (choice !== 'lawyer') return;
  const r = app.act(() => P.hireLawyer(state, shipId), { sound: 'pay' });
  if (r?.ok) toast(`L'avocat s'en occupe : le ${ship.name} repartira sous 24 heures.`, { timeout: 4000 });
}
export async function jettisonDialog(app, shipId) {
  const ship = app.state.ships.find((s) => s.id === shipId);
  if (!ship?.contraband) return;
  if (await confirmBox(`Jeter le colis du ${ship.name} ?`, `Vos contacts ne paieront pas (${money(ship.contraband.pay)} perdus), mais la douane ne trouvera rien.`, 'Jeter le colis')) {
    app.act(() => P.jettison(app.state, shipId));
  }
}

// ---------- Lien depuis la fiche d'un navire à quai : les services du port ----------
// Port louche : « La Mafia » (pirates, fonctionnaires) et l'informateur ; ailleurs, l'informateur
// seul. Le lien ouvre la fiche du port à la bonne section.
export function portServicesLink(app, ship) {
  const { state } = app;
  if (ship.owner !== app.ui.activeCompany || ship.status !== 'port' || ship.seized) return null;
  const port = ship.port;
  if (P.canPlotFrom(port) && rivalsOf(state, ship.owner).length) {
    return h('button.services-link.zone', { type: 'button', onclick: () => app.open('port', port, null, { focus: 'informant underworld' }) }, [
      h('span.services-icon', '🕴'),
      h('span.grow', [h('b', `La Mafia opère à ${portName(port)}`), h('span.services-sub', 'Pirates et fonctionnaires à acheter contre vos concurrents, informateur.')]),
      h('span.services-go', 'Voir →'),
    ]);
  }
  return h('button.services-link', { type: 'button', onclick: () => app.open('port', port, null, { focus: 'informant' }) }, [
    h('span.services-icon', '👂'),
    h('span.grow', [h('b', `Un informateur à ${portName(port)}`), h('span.services-sub', 'Qui complote contre vous, quels navires rivaux cachent un colis.')]),
    h('span.services-go', 'Voir →'),
  ]);
}

// ---------- La Mafia : pirates et fonctionnaires (port louche, un de vos navires à quai) ----------
export function underworldSection(app, port) {
  const { state } = app;
  const me = app.ui.activeCompany;
  if (!P.canPlotFrom(port) || !shipsOf(state, me).some((s) => s.status === 'port' && s.port === port)) return null;
  const rivals = rivalsOf(state, me);
  if (!rivals.length) return null;
  const targetSel = () => h('select.input', { 'aria-label': 'Concurrent visé' }, rivals.map((c) => h('option', { value: c.id, 'data-no-tr': '' }, c.name)));
  const zoneSel = h('select.input', { 'aria-label': 'Zone de piraterie' }, PIRACY_ZONES.map((z) => h('option', { value: z.id }, `${z.name} — ${money(P.piratePrice(z))}`)));
  const portSel = h('select.input', { 'aria-label': 'Port à acheter' }, P.corruptiblePorts().map((p) => h('option', { value: p }, `${portName(p)} — ${money(P.corruptPrice(p))}`)));
  const t1 = targetSel(), t2 = targetSel();
  const order = async (kind) => {
    const target = Number((kind === 'pirates' ? t1 : t2).value);
    const tg = state.companies[target];
    const S = P.SCANDAL[kind];
    const body = kind === 'pirates'
      ? `Pendant deux mois, les navires de ${tg.name} dans la zone ${P.zoneById(zoneSel.value).name} seront attaqués environ ${P.PIRATE_BOOST} fois plus souvent, par des pirates mieux armés. ${tg.name} en entendra parler (une rumeur, sans votre nom). Risque que l'affaire s'ébruite : ${pctOf(P.EXPOSE.pirates)} — vertu −${S.rep}, amende de ${money(S.fine)}, et ${tg.name} saura.`
      : `Pendant trois mois, les navires de ${tg.name} qui feront escale à ${portName(portSel.value)} y seront retenus sans motif (environ ${pctOf(P.HELD_CHANCE)} des escales, 6 à 14 jours, sauf s'ils paient un avocat). ${tg.name} en entendra parler (une rumeur, sans votre nom). Risque que l'affaire s'ébruite : ${pctOf(P.EXPOSE.corruption)} — vertu −${S.rep}, amende de ${money(S.fine)}, et ${tg.name} saura.`;
    const price = kind === 'pirates' ? P.piratePrice(P.zoneById(zoneSel.value)) : P.corruptPrice(portSel.value);
    if (!(await confirmBox(kind === 'pirates' ? 'Payer des pirates ?' : 'Acheter des fonctionnaires ?', body, `Payer ${money(price)}`))) return;
    const r = app.act(() => app.withRng((rng) => P.orderPlot(state, rng, me, { kind, target, zone: zoneSel.value, port: portSel.value })), { sound: 'pay' });
    if (r?.ok) toast('Marché conclu. Rien ne vous relie à cette affaire… pour l\'instant.', { timeout: 4000 });
  };
  return h('div.underworld', [
    h('h3', '🕴 La Mafia'),
    h('p.hint', 'Des intermédiaires peu recommandables proposent leurs services contre vos concurrents. Tout finit par se savoir : chaque affaire peut s\'ébruiter (scandale, vertu, amende).'),
    h('div.form-row', [h('b', 'Pirates : '), t1, zoneSel, h('button.btn.small.danger', { onclick: () => order('pirates') }, 'Payer les pirates')]),
    h('div.form-row', [h('b', 'Fonctionnaires : '), t2, portSel, h('button.btn.small.danger', { onclick: () => order('corruption') }, 'Les acheter')]),
    sabotageRow(app, rivals),
  ]);
}

// ---------- L'informateur (n'importe quel port où vous avez un navire à quai) ----------
export function informantSection(app, port) {
  const { state } = app;
  const me = app.ui.activeCompany;
  if (!shipsOf(state, me).some((s) => s.status === 'port' && s.port === port)) return null;
  const price = P.intelPrice(port);
  return h('div.informant', [
    h('h3', '👂 Informateur'),
    h('p.hint', `Pour ${money(price)}, un informateur vous dit qui complote contre vous, et quels navires rivaux cachent un colis (vous pourrez les dénoncer à la douane : prime de ${pctOf(P.TIP_REWARD)} de l'amende si la saisie a lieu).`),
    h('button.btn.small', { onclick: async () => {
      const r = app.act(() => P.buyIntel(state, me, port), { sound: 'pay' });
      if (r?.ok) await showIntel(app, r);
    } }, `Payer l'informateur · ${money(price)}`),
  ]);
}
export async function showIntel(app, r) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const plots = r.plots.length ? h('div.list.compact', r.plots.map((p) => h('div.row', [h('span.grow', P.ATTACKS[p.kind] ? `🕴 ${nameOf(state, p.by)} : ${P.ATTACKS[p.kind].name.toLowerCase()}, jusqu'au ${date(p.until, true)}.` : p.kind === 'pirates'
    ? `☠ ${nameOf(state, p.by)} paie des pirates contre vos navires dans la zone ${P.zoneById(p.zone).name}, jusqu'au ${date(p.until, true)}.`
    : `🏛 ${nameOf(state, p.by)} a acheté les autorités de ${portName(p.port)} contre vous, jusqu'au ${date(p.until, true)}.`)])))
    : h('p.muted', 'Personne ne complote contre vous en ce moment.');
  const rows = r.traffickers.map((t) => {
    const btn = h('button.btn.small.ghost', { disabled: t.tipped, onclick: () => {
      const res = app.act(() => P.tipOff(state, me, t.shipId));
      if (res?.ok) { btn.disabled = true; btn.textContent = 'Dénoncé'; toast(`La douane est prévenue pour le ${t.name}.`, { timeout: 3000 }); }
    } }, t.tipped ? 'Déjà dénoncé' : 'Dénoncer à la douane');
    return h('div.row', [h('span.grow', [`📦 Le ${t.name} (`, h('span', { 'data-no-tr': '' }, nameOf(state, t.company)), `) cache un colis pour ${portName(t.to)} ; prochaine escale : ${portName(t.next)}.`]), btn]);
  });
  await dialog({
    title: 'Ce que dit l\'informateur',
    body: h('div', [
      h('h3', 'Contre vous'), plots,
      h('h3', 'Colis cachés chez vos concurrents'),
      rows.length ? h('div.list.compact', rows) : h('p.muted', 'Aucun navire rival ne cache de colis en ce moment.'),
    ]),
    buttons: [{ label: 'Fermer', value: 'ok', kind: 'primary' }],
    wide: true,
  });
}

// ---------- Partenariats officiels et débauchage ----------
export function partnerInfo(app, clientId) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const partners = P.officialPartners(state, clientId);
  if (!partners.length) return null;
  const tp = P.topPartner(state, clientId, me);
  // Noms laissés tels quels, le reste traduit : un morceau de texte par partie.
  const names = partners.flatMap((c, i) => [i ? ', ' : null, h('span', { 'data-no-tr': '' }, c.name), c.id === me ? ' (vous)' : null]);
  const out = [h('span.muted', [' · partenaires : ', ...names])];
  if (tp && relationOf(state.companies[tp.id], clientId).loyalty >= 4) {
    const price = P.poachPrice(state, clientId, tp.loyalty);
    const rival = state.companies[tp.id];
    out.push(' ', h('button.btn.small.ghost', { onclick: async () => {
      const ok = await confirmBox(`Débaucher ${CLIENTS[clientId].name} ?`, `Pour ${money(price)}, ${CLIENTS[clientId].name} rompt son partenariat avec ${rival.name} : sa fidélité retombe à zéro et ses contrats réservés lui échappent. Votre propre fidélité monte un peu. Risque que l'affaire s'ébruite : ${pctOf(P.EXPOSE.poach)} — vertu −${P.SCANDAL.poach.rep}, et ${rival.name} saura.`, `Payer ${money(price)}`);
      if (!ok) return;
      const r = app.act(() => app.withRng((rng) => P.poachClient(state, rng, me, clientId)), { sound: 'pay' });
      if (r?.ok) toast(r.leaked ? 'Fait… mais l\'affaire s\'est ébruitée.' : `${CLIENTS[clientId].name} rompt avec ${rival.name}.`, { timeout: 4000 });
    } }, `Débaucher · ${money(price)}`));
  }
  return h('span.partners', out);
}

// Sabotage d'un navire rival (à sa prochaine escale).
function sabotageRow(app, rivals) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const ships = rivals.flatMap((c) => shipsOf(state, c.id).map((s) => ({ s, c })));
  if (!ships.length) return null;
  const sel = h('select.input', { 'aria-label': 'Navire à saboter' }, ships.map(({ s, c }) => h('option', { value: s.id }, `${s.name} (${c.name}) — ${money(P.attackPrice(state, 'sabotage', { target: c.id, ship: s.id }))}`)));
  const go = async () => {
    const ship = Number(sel.value), owner = state.ships.find((x) => x.id === ship)?.owner;
    const A = P.ATTACKS.sabotage, price = P.attackPrice(state, 'sabotage', { target: owner, ship });
    const ok = await confirmBox('Faire saboter ce navire ?', `À sa prochaine escale, le navire perd ${P.SABOTAGE_DAMAGE[0]} à ${P.SABOTAGE_DAMAGE[1]} points d'état, sauf s'il a des gardes à bord. Vertu −${A.rep} à coup sûr ; risque que l'affaire s'ébruite : ${pctOf(A.expose)} (vertu −${A.scandal.rep}, amende de ${money(A.scandal.fine)}). Son armateur entendra une rumeur et pourra mettre des gardes.`, `Payer ${money(price)}`);
    if (!ok) return;
    const r = app.act(() => app.withRng((rng) => P.orderAttack(state, rng, me, { kind: 'sabotage', target: owner, ship })), { sound: 'pay' });
    if (r?.ok) toast('Un homme montera à bord à la prochaine escale.', { timeout: 4000 });
  };
  return h('div.form-row', [h('b', 'Sabotage : '), sel, h('button.btn.small.danger', { onclick: go }, 'Faire saboter')]);
}
// Contrat d'un chargeur qui fait traîner vos paiements, ou dans un port en guerre des prix.
export function attackTags(state, cid, c) {
  const out = [];
  const pw = P.priceWarAt(state, cid, c.from);
  if (pw) out.push(h('span.tag.bad', { title: `Guerre des prix à ${portName(c.from)} jusqu'au ${date(pw.until, true)} : ce chargeur vous paiera ${Math.round(P.PRICEWAR_CUT * 100)} % de moins (le prix affiché en tient compte).` }, `−${Math.round(P.PRICEWAR_CUT * 100)} % guerre des prix`));
  const st = P.stalledBy(state, cid, c.client);
  if (st) out.push(h('span.tag.bad', { title: `Ce chargeur fera traîner votre paiement (${P.PAYMENT_DELAY[0]} à ${P.PAYMENT_DELAY[1]} jours) jusqu'au ${date(st.until, true)}.` }, '⏳ paiement retardé'));
  return out;
}
