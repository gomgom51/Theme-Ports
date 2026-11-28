// Renseignements sur la fiche du navire : le conseil des vieux briscards (spécialité d'équipage) et ce que
// rapporte chaque destination, chiffré selon le niveau de l'équipage. Estimations : sim/intel.js.
import { GOODS } from '../data/goods.js';
import { CREW_LEVELS } from '../data/ships.js';
import { portName } from '../sim/core.js';
import { rank, MAX_RANK } from '../sim/crew.js';
import { bestOpportunity, tenderLeads, contractOffers } from '../sim/intel.js';
import { isEmbargoed } from '../sim/shady.js';
import { h, money, tonnes, date, days } from './dom.js';
import { gradeEl } from './grade.js';

const goodName = (g) => GOODS[g].name.toLowerCase();
// Même tampon que l'onglet Négoce : commercer avec un pays sous embargo marque le navire (règle n° 1).
const embargoTag = (...ports) => (ports.some((p) => p && isEmbargoed(p)) ? h('span.tag.warn', { title: 'Pays sous embargo : y commercer marque le navire un an (amendes possibles dans les pays qui appliquent les sanctions).' }, '⚖ embargo') : null);

// Cap sur un port : depuis le port même, l'onglet utile ; sinon la destination est préréglée au départ.
function goTo(app, ship, port, tab) {
  if (port === ship.port) { app.openTab(tab); return; }
  app.form.dest[ship.id] = port;
  app.openTab('depart');
}

function oppLine(o) {
  const head = o.kind === 'contract'
    ? (o.contract.golden ? h('span.tag.good', '★ affaire en or') : h('span.tag', 'contrat'))
    : o.kind === 'tender' ? h('span.tag.good', '📣 appel d\'offres') : h('span.tag', 'négoce');
  const what = o.kind === 'tender'
    ? `${goodName(o.good)} : achat à ${portName(o.port)}, vente à ${portName(o.to)}`
    : o.kind === 'trade' ? `${goodName(o.good)} : d'ici à ${portName(o.to)}` : `${goodName(o.good)} de ${portName(o.port)} à ${portName(o.to)}`;
  return [head, ' ', h('span', what), embargoTag(o.port, o.to) ? ' ' : null, embargoTag(o.port, o.to), ' → ', h('b.pos', money(o.profit, true)), ' ', h('span.muted', `(${money(o.perDay, true)}/j, ${days(o.days)} en tout)`)];
}

// Le conseil des vieux briscards : niveau 1, la meilleure affaire à portée ; niveau 2, les 3 ports d'achat les
// plus proches pour chaque appel d'offres ; niveau 3, cours à l'arrivée et concurrents déjà en route.
export function briscardCard(app, ship) {
  const { state, ctx } = app;
  const r = rank(ship, 'briscard');
  if (!r || ship.owner !== app.ui.activeCompany || ship.status !== 'port' || ship.cargo || ship.dark) return null;
  const arrival = r >= 3;
  const best = bestOpportunity(state, ctx, ship, { arrival });
  const tab = best?.kind === 'contract' ? 'contrats' : 'negoce';
  const parts = [
    h('div.card-title', ['🧭 ', h('span', 'Le conseil des vieux briscards'), gradeEl(r, { max: MAX_RANK, title: `Niveau ${r} sur ${MAX_RANK}` })]),
    best
      ? h('div.card-sub', [h('span', 'Meilleure affaire à portée :'), ' ', ...oppLine(best), ' ',
        h('button.btn.small.ghost', { onclick: () => goTo(app, ship, best.port, tab) }, best.port === ship.port ? 'Voir' : 'Y aller')])
      : h('div.card-sub.muted', 'Rien de rentable à portée pour l\'instant.'),
  ];
  if (r >= 2) {
    const leads = tenderLeads(state, ctx, ship, { arrival });
    for (const L of leads) {
      const t = L.tender;
      parts.push(h('div.card-sub.intel-tender', [h('span.tag.good', '📣'), ' ',
        h('span', `${portName(t.port)} achète ${goodName(t.good)} à ${money(t.unit)}/t jusqu'au ${date(t.until, true)}`), ' ',
        h('span.muted', arrival ? `(${tonnes(L.room)} encore libres)` : `(${tonnes(t.left)} restantes)`), embargoTag(t.port) ? ' ' : null, embargoTag(t.port)]));
      if (!L.sources.length) parts.push(h('div.card-sub.muted.intel-row', 'Aucun port d\'achat à portée avant la date limite.'));
      L.sources.forEach((s, i) => parts.push(h('div.intel-row', [
        h('span.grow', [`${i + 1}. `, h('b', portName(s.port)), embargoTag(s.port) ? ' ' : null, embargoTag(s.port), ` · ${money(s.unit)}/t · ${s.toSource < 0.05 ? days(s.days) : `${days(s.toSource)} + ${days(s.days - s.toSource)}`} · `, h('span', 'marge'), ' ', h('b.pos', `${money(s.marginPerT)}/t`)]),
        h('button.btn.small.ghost', { onclick: () => goTo(app, ship, s.port, 'negoce') }, s.port === ship.port ? 'Acheter' : 'Y aller'),
      ])));
      if (arrival) for (const c of L.rivals.slice(0, 3)) {
        const sh = state.ships.find((x) => x.id === c.shipId), co = state.companies[c.company];
        parts.push(h('div.card-sub.warn-text.intel-row', `⚠ Le ${sh?.name || 'navire'} (${co?.name || 'concurrent'}) y livrera ${tonnes(c.qty)} vers le ${date(c.eta, true)}.`));
      }
    }
    if (!leads.length) parts.push(h('div.card-sub.muted', 'Aucun appel d\'offres que ce navire puisse servir.'));
  }
  if (r < MAX_RANK) parts.push(h('div.card-sub.muted', r === 1 ? 'Au niveau 2 : où acheter pour chaque appel d\'offres.' : 'Au niveau 3 : cours à l\'arrivée, concurrents en route, et l\'équipage devient vieux briscards.'));
  return h('div.card.intel', [h('div.card-main', parts)]);
}

// Ce que rapporte chaque destination, selon l'équipage : rien de plus que le nombre de contrats (équipage de base),
// le meilleur fret arrondi (confirmé), le bénéfice par jour exact, trajet à vide compris (chevronné et au-delà).
// Renvoie une fonction (port, contrats pour ce navire) → élément à ajouter à la ligne, ou null.
export function destPayInfo(app, ship) {
  const { state, ctx } = app;
  const info = CREW_LEVELS[ship.crew || 0]?.info ?? 0;
  if (!info || ship.cargo || ship.dark) return { info, tag: () => null };
  if (info === 1) {
    const round = (v) => { const k = 10 ** Math.max(4, Math.floor(Math.log10(Math.max(1, v))) - 1); return Math.round(v / k) * k; };
    return { info, tag: (p, fit) => (fit.length ? h('span.tag.good', { title: 'Meilleur fret parmi les contrats pour ce navire, estimé par vos officiers.' }, `≈ ${money(round(Math.max(...fit.map((c) => c.pay))))}`) : null) };
  }
  const bestAt = new Map();
  for (const o of contractOffers(state, ctx, ship)) if (!bestAt.has(o.port)) bestAt.set(o.port, o);
  return {
    info,
    tag: (p) => {
      const o = bestAt.get(p);
      return o ? h('span.tag', { class: o.perDay > 0 ? 'good' : 'bad', title: 'Bénéfice par jour du meilleur contrat pour ce navire, trajet à vide compris.' }, `${money(o.perDay, true)}/j`) : null;
    },
  };
}
