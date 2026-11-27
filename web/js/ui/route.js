// Destination et dates d'un trajet, bien en vue (et non perdues au milieu d'une phrase) :
// « → [drapeau] Lagos · arrivée le 13 févr. · livraison avant le 20 févr. ».
import { PORTS, FLAGS } from '../data/ports.js';
import { portName } from '../sim/core.js';
import { h, date } from './dom.js';
import { flagEl } from './flags.js';

// eta : arrivée (prévue ou estimée) ; deadline : date limite du contrat ; late : en retard probable.
// estimate : l'arrivée est une estimation (« arrivée ≈ »).
export function routeChip(to, { eta = null, deadline = null, late = false, estimate = false, compact = false } = {}) {
  const P = PORTS[to];
  if (!P) return null;
  return h('div.route-chip', { class: compact ? 'compact' : '' }, [
    h('span.route-dest', ['→ ', flagEl(P.flag, FLAGS[P.flag]?.name || ''), ' ', h('b', portName(to))]),
    eta != null ? h('span.route-eta', [h('span', estimate ? 'arrivée ≈' : 'arrivée le'), ' ', h('b', date(eta, true))]) : null,
    deadline != null ? h('span.route-due', { class: late ? 'late' : '' }, [h('span', 'livraison avant le'), ' ', h('b', date(deadline, true))]) : null,
  ]);
}
