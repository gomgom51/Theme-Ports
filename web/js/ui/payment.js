// Fenêtre d'encaissement d'un contrat livré.
import { CLIENTS, STYLE_LABEL, stars } from '../data/clients.js';
import { GOODS } from '../data/goods.js';
import { portName } from '../sim/core.js';
import { resolution, collect, paymentBase } from '../sim/payments.js';
import { h, money, tonnes, date, dialog, dropToasts } from './dom.js';
import { logoBadge } from './logos.js';
import { clientRel, relationOf, paymentRisk, gratitudeChance, reportClient, LOYAL, RESERVE_LOYALTY, DENOUNCE_HIT, DENOUNCE_REP, GRUDGE_DAYS } from '../sim/clients.js';

export function starsText(reliability) {
  const n = stars(reliability);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// Fidélité en cinq points (deux crans par point).
export function loyaltyDots(loyalty) {
  const full = Math.floor(loyalty / 2), half = loyalty % 2;
  return h('span.loyal-dots', { title: `Fidélité ${loyalty}/10` }, '●'.repeat(full) + (half ? '◐' : '') + '○'.repeat(5 - full - half));
}

// Le chargeur : nom, étoiles du moment (et leur chute éventuelle), tempérament, votre fidélité.
export function clientLine(state, company, clientId) {
  const C = CLIENTS[clientId];
  if (!C) return null;
  const R = clientRel(state, clientId), n = stars(R), r = relationOf(company, clientId);
  return h('span.client', [
    `${C.name} `,
    h('span.stars', { title: `Fiabilité ${Math.round(R)}/100` }, ['★'.repeat(n), h('span.stars-empty', '★'.repeat(5 - n))]),
    R < C.reliability - 3 ? h('span.neg', { title: `D'habitude ${C.reliability}/100 : sa réputation a pris un coup (redressement judiciaire ou dénonciations). Elle remonte avec le temps.` }, ' ↓') : null,
    h('span.muted', ` · ${STYLE_LABEL[C.style]}`),
    r.loyalty >= LOYAL
      ? h('span.tag.good', { title: r.loyalty >= RESERVE_LOYALTY ? `Fidélité ${r.loyalty}/10 : moins de litiges et de retards de paiement, et priorité sur une partie de ses contrats.` : `Fidélité ${r.loyalty}/10 : moins de litiges et de retards de paiement.` }, 'partenaire fidèle')
      : r.loyalty > 0 ? h('span', [' ', loyaltyDots(r.loyalty)]) : null,
  ]);
}

// Les risques à l'encaissement, chiffrés, avant d'accepter le contrat.
const pc = (x) => (x > 0 && x < 0.005 ? '< 1 %' : `${Math.round(x * 100)} %`);
export function riskLine(state, company, clientId, pay) {
  if (!CLIENTS[clientId]) return null;
  const r = paymentRisk(state, company, clientId);
  return h('div.card-sub.pay-risk', [
    'À l\'encaissement : ',
    h('span', { class: r.bankrupt >= 0.02 ? 'neg' : '', title: 'Le chargeur fait faillite : vous ne touchez que 20 à 50 % du fret.' },
      r.bankrupt >= 0.005 ? `impayé ${pc(r.bankrupt)} (perte de ${money(pay * 0.5)} à ${money(pay * 0.8)})` : `impayé ${pc(r.bankrupt)}`),
    ' · ', h('span', { title: 'Le chargeur conteste et retient 5 à 20 % du fret ; vous pouvez porter l\'affaire en arbitrage.' }, `litige ${pc(r.dispute)}`),
    ' · ', h('span', { title: 'Le chargeur paie 15 à 45 jours plus tard.' }, `retard de paiement ${pc(r.defer)}`),
  ]);
}

// Après un mauvais procédé : dénoncer ou rester discret. Les deux issues sont détaillées.
async function incidentDialog(app, company, incident) {
  const C = CLIENTS[incident.client];
  const g = Math.round(gratitudeChance(company, incident.client) * 20) * 5;
  const what = {
    faillite: `${C.name}, en redressement judiciaire, ne vous a réglé qu'une partie de sa facture : ${money(incident.loss)} perdus.`,
    contestation: `${C.name} a retenu ${money(incident.loss)} sur votre fret.`,
    differe: `${C.name} paiera sa facture en retard.`,
  }[incident.kind];
  const reward = incident.kind === 'differe'
    ? `Environ ${g} % de chances qu'il vous offre un petit geste (2 à 4 % de la facture) dans les semaines à venir.`
    : incident.kind === 'faillite' ? `Environ ${g} % de chances qu'il vous rembourse une partie de la perte (30 à 60 %), une fois sorti du redressement.`
      : `Environ ${g} % de chances qu'il vous rembourse une partie de la perte (30 à 60 %) dans les mois à venir.`;
  const choice = await dialog({
    title: `Que faire de ${C.name} ?`,
    body: h('div', [
      h('p', what),
      h('p', [h('b', 'Dénoncer publiquement : '), `sa fiabilité baisse de ${DENOUNCE_HIT[incident.kind]} points aux yeux de tout le marché (il devra mieux payer ses transporteurs) et vous gagnez ${DENOUNCE_REP} points de réputation, mais il ne travaillera plus avec vous pendant ${Math.round(GRUDGE_DAYS / 30)} mois.`]),
      h('p', [h('b', 'Rester discret : '), `votre fidélité auprès de lui augmente. ${reward}`]),
    ]),
    buttons: [{ label: 'Dénoncer publiquement', value: 'denoncer', kind: 'ghost' }, { label: 'Rester discret', value: 'discret', kind: 'primary' }],
  });
  const pick = choice === 'denoncer' ? 'denoncer' : 'discret'; // fermer la fenêtre, c'est se taire
  app.withRng((rng) => reportClient(app.state, rng, company, incident, pick));
  app.toast(pick === 'denoncer' ? `Vous avez dénoncé ${C.name}.` : `Vous restez discret envers ${C.name}.`, { timeout: 4000 });
  app.refresh();
}

export async function openPayment(app, paymentId) {
  const { state } = app;
  const p = state.payments.find((x) => x.id === paymentId);
  if (!p) return;
  const res = app.withRng((rng) => resolution(state, rng, p));
  const C = CLIENTS[p.client];
  const ev = res.event;
  const lines = h('div.pay-lines', res.lines.map((l, i) => h('div.pay-line', {
    class: l.kind === 'base' ? '' : l.kind, style: { animationDelay: `${0.15 + i * 0.45}s` },
  }, [h('span', l.label), h('b', l.amount ? money(l.amount, l.kind !== 'base') : '—')])));
  const finalAmount = ev?.kind === 'contestation' ? res.total - ev.withheld : res.total;
  const total = h('div.pay-total', { style: { animation: 'pay-in .35s ease-out both', animationDelay: `${0.15 + res.lines.length * 0.45}s` } }, [
    h('span', ev?.kind === 'differe' ? 'À recevoir plus tard' : 'À encaisser'), h('span', money(finalAmount)),
  ]);
  const co = state.companies[p.company];
  const body = h('div', [
    // Première ligne : à qui revient l'argent (parties à plusieurs sur le même écran).
    h('div.pay-who', { style: { borderLeftColor: co.color } }, [
      h('span.badge-wrap', { html: logoBadge(co.logo, co.color, 40) }),
      h('b', { 'data-no-tr': '' }, co.captain ? `${co.captain} — ${co.name}` : co.name),
    ]),
    h('p', [h('b', `${GOODS[p.good].icon} ${tonnes(p.qty)} de ${GOODS[p.good].name.toLowerCase()}`), ` livrés à ${portName(p.to)} par le ${p.shipName} le ${date(p.deliveredT, true)}.`]),
    C ? h('p', ['Client : ', clientLine(state, co, p.client)]) : null,
    lines, total,
    ev?.kind === 'contestation' ? h('p.hint', 'Contester lance un arbitrage d\'environ un mois : votre réputation compte, et les frais d\'avocat sont de 3 %.') : null,
  ]);
  let buttons;
  if (ev?.kind === 'contestation') {
    buttons = [{ label: `Contester`, value: 'contester', kind: 'ghost' }, { label: `Accepter ${money(finalAmount)}`, value: 'accepter', kind: 'primary' }];
  } else if (ev?.kind === 'differe') {
    buttons = [{ label: 'D\'accord', value: 'accepter', kind: 'primary' }];
  } else {
    buttons = [{ label: 'Plus tard', value: null, kind: 'ghost' }, { label: `Encaisser ${money(finalAmount)}`, value: 'accepter', kind: 'primary' }];
  }
  const choice = await dialog({ title: 'Encaissement', body, buttons });
  if (!choice) return;
  const r = app.withRng((rng) => collect(state, rng, p.id, choice));
  dropToasts(`pay-${p.id}`);
  if (r.amount) {
    app.audio.play('cash');
    app.toast(`${money(r.amount)} encaissés.`, { kind: 'money', timeout: 4000 });
  } else if (r.deferred) app.toast(`Paiement attendu dans ${r.deferred} jours.`, { timeout: 4000 });
  else if (r.contested) app.toast('Arbitrage lancé. Résultat dans un mois environ.', { timeout: 4000 });
  app.refresh();
  if (r.incident) await incidentDialog(app, co, r.incident);
}

// Liste des paiements en attente (pour la flotte et le bureau).
export function pendingList(app) {
  const { state } = app;
  const cid = app.ui.activeCompany;
  const pays = state.payments.filter((p) => p.company === cid);
  const recs = state.receivables.filter((r) => r.company === cid);
  if (!pays.length && !recs.length) return null;
  return h('div', [
    pays.length ? h('h3', `Paiements à encaisser (${pays.length})`) : null,
    pays.length ? h('div.list.compact', pays.map((p) => h('div.row', [
      h('span.grow', [h('b', `${GOODS[p.good].icon} ${p.shipName}`), h('div.small.muted', [`${tonnes(p.qty)} livrées à ${portName(p.to)} · `, CLIENTS[p.client]?.name || 'client'])]),
      h('b', money(paymentBase(p))),
      h('button.btn.primary.small', { onclick: () => openPayment(app, p.id) }, 'Encaisser'),
    ]))) : null,
    recs.length ? h('h3', `À recevoir (${recs.length})`) : null,
    recs.length ? h('div.list.compact', recs.map((r) => h('div.row', [
      h('span.grow.small', r.label), h('span.muted.small', `vers le ${date(r.due, true)}`), h('b', money(r.amount)),
    ]))) : null,
  ]);
}
