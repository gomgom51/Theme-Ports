// Bilan de la confiance 🤝 et de la vertu 💚 : ce qui les a fait monter ou baisser, par cause.
// Chaque libellé est un nœud de texte à part (traduit seul par i18n.js).
import { h, num1 } from './dom.js';

const fmt = (v) => `${v >= 0 ? '+' : '−'}${num1(Math.abs(v))}`;
// Causes d'une note, de la plus forte à la plus faible (en valeur absolue).
export function standingCauses(log, key) {
  return Object.entries(log?.[key] || {}).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}
// « 🤝 confiance +3,2 (livraisons à l'heure +4,1 · retards −0,9) » ; max : nombre de causes montrées.
export function standingPart(log, key, max = 3) {
  const entries = standingCauses(log, key);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const shown = entries.slice(0, max);
  return h('span.standing-part', [
    h('span', key === 'virtue' ? '💚' : '🤝'), ' ', h('span', key === 'virtue' ? 'vertu' : 'confiance'), ' ',
    h('b', { class: total >= 0 ? 'pos' : 'neg' }, fmt(total)), ' (',
    ...shown.flatMap(([src, v], i) => [i ? ' · ' : null, h('span', src), ' ', h('span', { class: v >= 0 ? 'pos' : 'neg' }, fmt(v))]),
    entries.length > max ? ' · …' : null, ')',
  ]);
}
// Résumé du mois (notification) : les trois causes principales de chaque note.
export function standingSummary(log, prefix = '') {
  const t = standingPart(log, 'confidence'), v = standingPart(log, 'virtue');
  return h('span.standing-summary', [prefix ? h('span', prefix) : null, h('b', 'Bilan du mois'), t ? h('br') : null, t, v ? h('br') : null, v]);
}
