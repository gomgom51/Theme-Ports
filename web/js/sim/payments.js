// Encaissement des contrats : à la livraison, le client règle la somme convenue…
// en principe. Retard, prime, surcharge carburant, renégociation selon les cours,
// contestation, paiement différé ou faillite du client : tout dépend de la fiabilité
// du client et de la réputation de la compagnie.
import { CLIENTS } from '../data/clients.js';
import { GOODS } from '../data/goods.js';
import { money as book, news, changeTrust, standing, portName } from './core.js';
import { worldFuelPrice } from './economy.js';
import { HOURS_PER_DAY, formatDate } from './util.js';
import { stalledBy, PAYMENT_DELAY } from './plots.js';
import { clientRel, paymentRisk, clientBankrupt } from './clients.js';

const D = HOURS_PER_DAY;
const pct = (v) => `${Math.round(v * 100)} %`;
const k$ = (v) => `${Math.round(v / 1000).toLocaleString('fr-FR')} k$`;

// Crée la créance au moment de la livraison.
export function createPayment(state, ship, contract, penalty, damage = 0) {
  const p = {
    id: state.nextId++, company: ship.owner, client: contract.client || null,
    good: contract.good, qty: contract.qty, from: contract.from, to: contract.to,
    pay: contract.pay, penalty, damage, deadline: contract.deadline, deliveredT: state.t,
    fuelAtStart: contract.fuelAtStart || null, priceAtStart: contract.priceAtStart || null,
    shipName: ship.name, res: null, charity: contract.charity?.name || null,
    talk: ship.skills?.negociation || 0, // beaux parleurs à bord
    crew: ship.crew || 0, // niveau de l'équipage : précision des chances d'arbitrage annoncées
  };
  state.payments.push(p);
  return p;
}

export const paymentBase = (p) => p.pay * (1 - p.penalty);
// Chance de gagner un arbitrage contre le chargeur : la confiance de la compagnie, moins le poids
// d'un client avec qui l'on travaille beaucoup (il a ses avocats).
export const arbitrationOdds = (state, company, client) => Math.max(0, Math.min(1, 0.45 + standing(company).confidence / 250 - clientRel(state, client) / 500));

// Tire (une seule fois) le déroulé de l'encaissement.
export function resolution(state, rng, p) {
  if (p.res) return p.res;
  // Aide d'urgence : l'association règle sa participation, sans discussion.
  if (p.charity) { p.res = { lines: [{ label: `${p.charity} : participation aux frais`, amount: p.pay * (1 - p.penalty), kind: 'base' }], total: Math.round(p.pay * (1 - p.penalty)), event: null, client: p.charity }; return p.res; }
  const company = state.companies[p.company];
  const C = CLIENTS[p.client] || { name: 'Le chargeur', reliability: 70, style: 'ponctuel' };
  const R = clientRel(state, p.client);
  const lines = [{ label: 'Fret convenu', amount: p.pay, kind: 'base' }];
  let total = p.pay;
  const soft = 1 - 0.12 * (p.talk || 0); // beaux parleurs : pénalités, réserves, retenues et renégociations réduites
  if (p.penalty > 0) {
    const late = Math.round((p.deliveredT - p.deadline) / D);
    const cut = -p.pay * p.penalty * soft;
    lines.push({ label: `Retard de ${late} jour${late > 1 ? 's' : ''} : pénalité de ${pct(p.penalty * soft)}`, amount: cut, kind: 'bad-event' });
    total += cut;
  } else {
    const early = (p.deadline - p.deliveredT) / D;
    if (early >= 2 && rng.chance(0.2 + R / 400)) {
      const bonus = p.pay * rng.range(0.02, 0.05);
      lines.push({ label: `Livré ${Math.round(early)} jours en avance : prime de ponctualité`, amount: bonus, kind: 'good-event' });
      total += bonus;
    } else lines.push({ label: 'Livré dans les délais', amount: 0, kind: 'base' });
  }
  // Marchandise perdue ou avariée en route : le réceptionnaire émet des réserves.
  if (p.damage > 0.005) {
    const cut = -p.pay * Math.min(0.85, p.damage * 1.15) * soft;
    lines.push({ label: `Marchandise avariée (${pct(p.damage)}) : le réceptionnaire émet des réserves`, amount: cut, kind: 'bad-event' });
    total += cut;
  }
  // Surcharge carburant si le fuel a nettement augmenté pendant le contrat.
  if (p.fuelAtStart) {
    const ratio = worldFuelPrice(state) / p.fuelAtStart;
    if (ratio > 1.1) {
      if (rng.chance(0.4 + R / 200)) {
        const baf = p.pay * Math.min(0.08, (ratio - 1) * 0.3);
        lines.push({ label: `Le fuel a pris ${pct(ratio - 1)} : surcharge carburant acceptée`, amount: baf, kind: 'good-event' });
        total += baf;
      } else lines.push({ label: 'Le client refuse la surcharge carburant', amount: 0, kind: 'event' });
    }
  }
  // Un seul imprévu de dernière minute au plus.
  let event = null;
  const roll = rng.next();
  // Les mêmes probabilités que celles affichées sur le contrat (fiabilité du moment, réputation,
  // fidélité de la compagnie envers ce chargeur).
  const { bankrupt: pBankrupt, dispute: pDispute, defer: pDefer } = paymentRisk(state, company, p.client);
  const priceMove = p.priceAtStart ? state.market.world[p.good] / p.priceAtStart - 1 : 0;
  const pMarket = Math.abs(priceMove) > 0.05 ? 0.25 : 0;
  if (roll < pBankrupt) {
    const share = rng.range(0.2, 0.5);
    const cut = -total * (1 - share);
    lines.push({ label: `${C.name} est en redressement judiciaire : seuls ${pct(share)} seront versés`, amount: cut, kind: 'bad-event' });
    total += cut;
    event = { kind: 'faillite', loss: Math.round(-cut) };
  } else if (roll < pBankrupt + pDispute) {
    const share = rng.range(0.05, 0.2) * soft;
    event = { kind: 'contestation', withheld: Math.round(total * share), share };
    lines.push({ label: `${C.name} conteste l'état de la marchandise et retient ${pct(share)}`, amount: -event.withheld, kind: 'bad-event' });
  } else if (stalledBy(state, p.company, p.client)) {
    // Un concurrent a demandé à ce chargeur de faire traîner (la rumeur l'avait annoncé).
    const days = rng.int(PAYMENT_DELAY[0], PAYMENT_DELAY[1]);
    event = { kind: 'differe', days, stalled: true };
    lines.push({ label: `${C.name} fait traîner : paiement dans ${days} jours`, amount: 0, kind: 'bad-event' });
  } else if (roll < pBankrupt + pDispute + pDefer) {
    const days = rng.int(15, 45);
    event = { kind: 'differe', days };
    lines.push({ label: `Trésorerie tendue : ${C.name} paiera dans ${days} jours`, amount: 0, kind: 'event' });
  } else if (rng.next() < pMarket) {
    const g = GOODS[p.good].name.toLowerCase();
    if (priceMove < 0) {
      const cut = -total * Math.min(0.06, -priceMove * 0.25) * soft;
      lines.push({ label: `Le cours des ${g} a chuté de ${pct(-priceMove)} : le client renégocie`, amount: cut, kind: 'bad-event' });
      total += cut;
    } else {
      const bonus = total * Math.min(0.05, priceMove * 0.2);
      lines.push({ label: `Le cours des ${g} a grimpé de ${pct(priceMove)} : le client, ravi, arrondit`, amount: bonus, kind: 'good-event' });
      total += bonus;
    }
  }
  p.res = { lines, total: Math.round(total), event, client: C.name };
  return p.res;
}

// choice : 'accepter' ou 'contester' (seulement en cas de contestation).
export function collect(state, rng, paymentId, choice = 'accepter') {
  const p = state.payments.find((x) => x.id === paymentId);
  if (!p) return { ok: false, msg: 'Paiement introuvable.' };
  const res = resolution(state, rng, p);
  const company = state.companies[p.company];
  state.payments = state.payments.filter((x) => x !== p);
  const ev = res.event;
  // Un mauvais procédé d'un chargeur connu : la compagnie choisira de le dénoncer ou non.
  const incident = (kind, loss) => (CLIENTS[p.client] ? { client: p.client, kind, loss: Math.round(loss), invoice: Math.round(res.total) } : null);
  if (ev?.kind === 'differe') {
    state.receivables.push({ id: state.nextId++, company: p.company, amount: res.total, due: state.t + ev.days * D, label: `${res.client} règle enfin sa facture (${p.shipName})` });
    return { ok: true, deferred: ev.days, amount: res.total, incident: incident('differe', 0) };
  }
  if (ev?.kind === 'contestation') {
    if (choice === 'contester') {
      // Arbitrage : on récupère tout (moins les frais) si la réputation l'emporte.
      const fees = Math.round(res.total * 0.03);
      const win = rng.chance(arbitrationOdds(state, company, p.client));
      const amount = win ? res.total - fees : res.total - ev.withheld - fees;
      state.receivables.push({
        id: state.nextId++, company: p.company, amount, due: state.t + rng.int(20, 40) * D,
        label: win ? `Arbitrage gagné contre ${res.client} : facture payée en entier (frais ${k$(fees)})` : `Arbitrage perdu contre ${res.client} (frais ${k$(fees)})`,
        rep: win ? 1 : -1,
      });
      return { ok: true, contested: true };
    }
    const amount = res.total - ev.withheld;
    book(state, company, amount, 'fret');
    return { ok: true, amount, incident: incident('contestation', ev.withheld) };
  }
  book(state, company, res.total, 'fret');
  if (ev?.kind === 'faillite') {
    news(state, `${res.client} est en redressement judiciaire.`, { kind: 'event' });
    clientBankrupt(state, rng, p.client);
    return { ok: true, amount: res.total, incident: incident('faillite', ev.loss || 0) };
  }
  return { ok: true, amount: res.total };
}

// Créances à échéance (paiements différés, arbitrages).
export function dailyReceivables(state, notes) {
  const due = state.receivables.filter((r) => r.due <= state.t);
  if (!due.length) return;
  state.receivables = state.receivables.filter((r) => r.due > state.t);
  for (const r of due) {
    const company = state.companies[r.company];
    book(state, company, r.amount, 'fret');
    if (r.rep) changeTrust(company, r.rep, 'litiges');
    if (company.human) notes.push({ kind: 'paid', company: company.id, text: `${r.label} : ${k$(r.amount)} encaissés.`, amount: r.amount });
  }
}

// Valeur des créances en attente (comptée dans la valeur nette).
export function pendingValue(state, companyId) {
  let v = 0;
  for (const p of state.payments) if (p.company === companyId) v += paymentBase(p);
  for (const r of state.receivables) if (r.company === companyId) v += r.amount;
  return v;
}

export { portName, formatDate };
