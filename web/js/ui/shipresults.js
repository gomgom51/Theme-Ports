// Bureau > Résultats > Par navire : juger chaque navire séparément.
// Ce qu'il rapporte par jour, d'où vient l'argent et où il part, à quoi il passe son temps,
// ses derniers voyages, et comment il se compare aux navires du même modèle dans la profession.
import { SHIP_TYPES } from '../data/ships.js';
import { GOODS } from '../data/goods.js';
import * as eco from '../sim/economy.js';
import { shipsOf, portName, BOOK_LABELS, bookTotal } from '../sim/core.js';
import { h, money, num, pct, date, days } from './dom.js';
import { artForShip } from './shipart.js';

const D = 24;
const MIN_DAYS = 15; // en dessous, trop tôt pour juger un navire

// Emploi du temps (mêmes clés que la simulation).
const ACTIVITY = [
  ['charge', 'En mer, chargé', '#2c7a4b'],
  ['lest', 'En mer, à vide', '#8fb3c4'],
  ['escale', 'À quai : chargement, déchargement', '#0f6f76'],
  ['attente', 'En attente d\'ordres', '#d9a441'],
  ['immobile', 'Immobilisé : chantier, détention, saisie', '#b8322a'],
  ['desarme', 'Désarmé', '#6e7a82'],
];
const KIND = { contrat: 'Contrat', negoce: 'Négoce', lest: 'À vide', noir: 'Cargaison noire', aide: 'Aide d\'urgence' };
const WHY = { vendu: 'Vendu', naufrage: 'Naufrage', 'saisi par la banque': 'Saisi par la banque', abandonné: 'Abandonné', retiré: 'Retiré' };

const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const sum = (o) => Object.values(o || {}).reduce((s, v) => s + v, 0);
// Morceaux séparés par « · », chacun dans son propre nœud (traduisibles un par un).
const dotted = (parts) => parts.filter(Boolean).flatMap((p, i) => (i ? [' · ', h('span', p)] : [h('span', p)]));

// Suivi d'un navire ; vide pour un navire d'une ancienne sauvegarde pas encore suivi (le suivi
// commence à la première heure de jeu).
const trackOf = (state, ship) => ship.st || { since: state.t, book: {}, h: {}, trips: [], n: 0, nmL: 0, nmB: 0, late: 0, onTime: 0 };

// Les chiffres d'un navire.
export function shipFigures(state, ship) {
  const s = trackOf(state, ship);
  const d = Math.max(0, (state.t - s.since) / D);
  const result = bookTotal(s.book);
  const H = sum(s.h) || 1;
  const sea = (s.h.charge || 0) + (s.h.lest || 0);
  const done = s.trips.filter((t) => t.d1 != null);
  const paidTrips = s.trips.filter((t) => t.kind !== 'lest' && t.rev != null);
  const perDay = d >= 1 ? result / d : null;
  return {
    days: d, result, perDay, early: d < MIN_DAYS,
    annual: ship.paid && perDay != null ? (perDay * 365) / ship.paid : null,
    active: ((s.h.charge || 0) + (s.h.escale || 0)) / H,
    ladenShare: sea ? (s.h.charge || 0) / sea : null,
    ballastMiles: s.nmL + s.nmB ? s.nmB / (s.nmL + s.nmB) : null,
    medianTrip: median(done.map((t) => (t.d1 - t.d0) / D)),
    avgRev: paidTrips.length ? paidTrips.reduce((a, t) => a + t.rev, 0) / paidTrips.length : null,
    punctual: s.late + s.onTime ? s.onTime / (s.late + s.onTime) : null,
    trips: s.n, value: eco.shipValue(state, ship),
  };
}

// Moyenne de la profession pour un modèle : bénéfice par jour des autres navires du même modèle
// (toutes compagnies), suivis depuis assez longtemps.
function modelAverage(state, type, except) {
  const xs = state.ships.filter((s) => s !== except && s.type === type && s.st && (state.t - s.st.since) / D >= 60).map((s) => bookTotal(s.st.book) / ((state.t - s.st.since) / D));
  return xs.length ? { avg: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null;
}

const signed = (v) => h('span', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted' }, money(v, true));
const perDayText = (f) => (f.perDay == null ? '—' : `${money(f.perDay, true)}/jour`);
const stat = (label, value, sub) => h('div.stat', [h('div.stat-label', label), h('div.stat-value', value), sub ? h('div.stat-sub', sub) : null]);

const SORTS = [
  ['jour', 'Bénéfice par jour', (f) => f.perDay ?? -Infinity],
  ['total', 'Résultat total', (f) => f.result],
  ['rentabilite', 'Rentabilité', (f) => f.annual ?? -Infinity],
  ['activite', 'Activité', (f) => f.active],
];

export function shipResults(app) {
  const { state } = app;
  const cid = app.ui.activeCompany, company = state.companies[cid];
  const ships = shipsOf(state, cid).map((s) => ({ ship: s, f: shipFigures(state, s) }));
  const box = h('div.ship-results');
  box.append(h('p.hint', 'Ce que rapporte chaque navire depuis son achat : fret facturé, marges de négoce et affaires discrètes, moins tout ce qu\'il coûte (carburant, équipage, entretien et assurance, ports, réparations, sinistres). Sans les intérêts, les impôts ni le prix du navire.'));
  if (!ships.length) box.append(h('p.empty', 'Aucun navire pour l\'instant.'));
  else {
    // Vue d'ensemble de la flotte.
    const judged = ships.filter((x) => !x.f.early && x.f.perDay != null);
    const fleetDay = ships.reduce((a, x) => a + (x.f.perDay || 0), 0);
    const best = judged.length > 1 ? judged.reduce((a, b) => (b.f.perDay > a.f.perDay ? b : a)) : null;
    const worst = judged.length > 1 ? judged.reduce((a, b) => (b.f.perDay < a.f.perDay ? b : a)) : null;
    box.append(h('div.ship-stats', [
      stat('Flotte', h('span', { class: fleetDay >= 0 ? 'pos' : 'neg' }, `${money(fleetDay, true)}/jour`), ships.length > 1 ? `${ships.length} navires` : `${ships.length} navire`),
      best ? stat('Meilleur', best.ship.name, perDayText(best.f)) : null,
      worst ? stat('Moins bon', worst.ship.name, perDayText(worst.f)) : null,
    ]));
    // Tri.
    const sortId = SORTS.some(([k]) => k === app.form.shipSort) ? app.form.shipSort : 'jour';
    const key = SORTS.find(([k]) => k === sortId)[2];
    box.append(h('div.chips', SORTS.map(([k, label]) => h('button.chip', { class: k === sortId ? 'active' : '', onclick: () => { app.form.shipSort = k; app.refresh(); } }, label))));
    ships.sort((a, b) => (a.f.early - b.f.early) || key(b.f) - key(a.f));
    const list = h('div.list.compact');
    for (const { ship, f } of ships) {
      const T = SHIP_TYPES[ship.type], open = app.form.shipOpen === ship.id;
      const line = [f.trips > 1 ? `${num(f.trips)} voyages` : `${num(f.trips)} voyage`, `actif ${pct(f.active * 100)}`];
      if (f.annual != null && !f.early) line.push(`rentabilité ${pct(f.annual * 100)}/an`);
      list.append(h('button.row.selectable.with-thumb.ship-result-row', { class: open ? 'selected' : '', 'aria-expanded': open ? 'true' : 'false', onclick: () => { app.form.shipOpen = open ? null : ship.id; app.refresh(); } }, [
        h('span.thumb', { html: artForShip(state, ship, { sky: false }) }),
        h('span.grow', [h('b', ship.name), ' ', h('span.muted.small', T.name), h('div.small.muted', dotted(line))]),
        h('span.ship-result-figure', f.early
          ? [h('span.muted.small', 'Trop tôt pour juger'), h('span.small', signed(f.result))]
          : [h('b', { class: f.perDay >= 0 ? 'pos' : 'neg' }, `${money(f.perDay, true)}/j`), h('span.small.muted', money(f.result, true))]),
      ]));
      if (open) list.append(shipDetail(app, ship, f));
    }
    box.append(list);
  }
  const past = company.pastShips || [];
  if (past.length) box.append(pastShips(past));
  return box;
}

// Fiche détaillée d'un navire.
function shipDetail(app, ship, f) {
  const { state } = app;
  const s = trackOf(state, ship);
  const avg = modelAverage(state, ship.type, ship);
  const card = h('div.ship-result-detail');
  const since = ship.boughtT != null && s.since <= ship.boughtT + 1 ? `Depuis l'achat, le ${date(s.since, true)}` : `Suivi depuis le ${date(s.since, true)}`;
  card.append(h('div.ship-stats', [
    stat('Bénéfice par jour', f.perDay == null ? '—' : signed(f.perDay), since),
    stat('Résultat', signed(f.result), `${days(f.days)} de service`),
    stat('Rentabilité', f.annual == null ? '—' : h('span', { class: f.annual >= 0 ? 'pos' : 'neg' }, `${pct(f.annual * 100)}/an`), ship.paid ? `du prix payé (${money(ship.paid)})` : 'prix d\'achat inconnu'),
    stat('Valeur aujourd\'hui', money(f.value), ship.paid ? `${money(f.value - ship.paid, true)} depuis l'achat` : null),
    avg ? stat('Moyenne du modèle', h('span', { class: avg.avg >= 0 ? 'pos' : 'neg' }, `${money(avg.avg, true)}/jour`), avg.n > 1 ? `${avg.n} autres navires dans la profession` : 'un autre navire dans la profession') : null,
    f.punctual != null ? stat('Ponctualité', pct(f.punctual * 100), `${s.onTime} à l'heure, ${s.late} en retard`) : null,
  ]));

  // Recettes et dépenses par poste (le négoce en une ligne : ventes moins achats).
  const book = { ...s.book };
  if (book.negoce || book.achats) { book.marge = (book.negoce || 0) + (book.achats || 0); delete book.negoce; delete book.achats; }
  const labels = { marge: 'Négoce : ventes moins achats', ...BOOK_LABELS };
  const rows = Object.entries(labels).filter(([k]) => Math.abs(book[k] || 0) >= 1).sort((a, b) => (book[b[0]] || 0) - (book[a[0]] || 0));
  if (rows.length) {
    const top = Math.max(...rows.map(([k]) => Math.abs(book[k])));
    const perDay = (v) => (f.days >= 1 ? `${money(v / f.days, true)}/j` : '');
    card.append(h('h4', 'D\'où vient l\'argent, où il part'));
    card.append(h('div.book-bars', rows.map(([k, label]) => {
      const v = book[k];
      return h('div.book-bar', [
        h('span.book-label', label),
        h('span.book-track', h('span', { class: v >= 0 ? 'in' : 'out', style: { width: `${Math.max(2, (Math.abs(v) / top) * 100)}%` } })),
        h('span.book-value', { class: v >= 0 ? 'pos' : 'neg' }, money(v, true)),
        h('span.book-day.muted', perDay(v)),
      ]);
    })));
  }

  // Emploi du temps.
  const H = sum(s.h);
  if (H > 0) {
    const parts = ACTIVITY.filter(([k]) => s.h[k]);
    card.append(h('h4', 'Emploi du temps'));
    card.append(h('div.time-bar', parts.map(([k, label, color]) => h('span', { title: label, style: { width: `${(s.h[k] / H) * 100}%`, background: color } }))));
    card.append(h('div.time-legend', parts.map(([k, label, color]) => h('span', [h('i', { style: { background: color } }), h('span', label), ' ', h('b', pct((s.h[k] / H) * 100))]))));
    const facts = [];
    if (f.ballastMiles != null) facts.push(`${pct(f.ballastMiles * 100)} des milles parcourus à vide`);
    if (f.medianTrip != null) facts.push(`voyage médian : ${days(f.medianTrip)} en mer`);
    if (f.avgRev != null) facts.push(`recette moyenne d'un voyage chargé : ${money(f.avgRev)}`);
    if (facts.length) card.append(h('p.small.muted', dotted(facts)));
  }

  // Derniers voyages.
  const trips = [...s.trips].reverse().slice(0, 8);
  if (trips.length) {
    card.append(h('h4', `Derniers voyages (${trips.length} sur ${num(s.n)})`));
    card.append(h('div.trip-list', trips.map((t) => h('div.trip-row', [
      h('span.muted.small', date(t.d0, true)),
      h('span.grow', [h('span', portName(t.from)), ' → ', h('span', portName(t.to)), ' ', h('span.muted.small', dotted([KIND[t.kind], t.good && GOODS[t.good] ? GOODS[t.good].name : null]))]),
      h('span.small', t.d1 != null ? days((t.d1 - t.d0) / D) : 'en route'),
      h('span.trip-rev', t.rev != null ? signed(t.rev) : h('span.muted', '—')),
    ]))));
  }
  card.append(h('div.row-actions', [h('button.btn.small', { onclick: () => app.open('ship', ship.id) }, 'Ouvrir la fiche du navire')]));
  return card;
}

// Navires qui ont quitté la flotte : ce qu'ils ont rapporté, au total.
function pastShips(past) {
  return h('div', [
    h('h3', 'Navires vendus ou perdus'),
    h('div.list.compact', past.map((p) => {
      const T = SHIP_TYPES[p.type];
      const end = WHY[p.why] || p.why;
      const balance = p.paid != null ? p.result + p.price - p.paid : null;
      return h('div.row', [
        h('span.grow', [h('b', p.name), ' ', h('span.muted.small', T ? T.name : ''), h('div.small.muted', dotted([[h('span', date(p.since, true)), ' → ', h('span', date(p.end, true))], p.price ? [h('span', end), ' (', h('span', money(p.price)), ')'] : end, p.n > 1 ? `${num(p.n)} voyages` : `${num(p.n)} voyage`]))]),
        h('span.ship-result-figure', [
          h('span.small', [h('span', 'Résultat d\'exploitation'), ' ', signed(p.result)]),
          balance != null ? h('span.small', [h('span', 'Bilan, achat et vente compris'), ' ', signed(balance)]) : null,
        ]),
      ]);
    })),
  ]);
}
