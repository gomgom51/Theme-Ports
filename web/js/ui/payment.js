// Fenêtre d'encaissement d'un contrat livré.
import { CLIENTS, STYLE_LABEL, stars } from '../data/clients.js';
import { GOODS } from '../data/goods.js';
import { portName } from '../sim/core.js';
import { resolution, collect, paymentBase } from '../sim/payments.js';
import { h, money, tonnes, date, dialog, dropToasts } from './dom.js';
import { logoBadge } from './logos.js';

export function starsText(reliability) {
  const n = stars(reliability);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function clientLine(clientId) {
  const C = CLIENTS[clientId];
  if (!C) return null;
  const n = stars(C.reliability);
  return h('span.client', [`${C.name} `, h('span.stars', { title: `Fiabilité ${C.reliability}/100` }, ['★'.repeat(n), h('span.stars-empty', '★'.repeat(5 - n))]), h('span.muted', ` · ${STYLE_LABEL[C.style]}`)]);
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
      h('span.badge-wrap', { html: logoBadge(co.logo, co.color, 30) }),
      h('b', { 'data-no-tr': '' }, co.captain ? `${co.captain} — ${co.name}` : co.name),
    ]),
    h('p', [h('b', `${GOODS[p.good].icon} ${tonnes(p.qty)} de ${GOODS[p.good].name.toLowerCase()}`), ` livrés à ${portName(p.to)} par le ${p.shipName} le ${date(p.deliveredT, true)}.`]),
    C ? h('p', ['Client : ', clientLine(p.client)]) : null,
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
