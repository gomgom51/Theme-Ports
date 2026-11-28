// Comprendre la réputation : à quoi servent la confiance 🤝, la vertu 💚, la réputation ★ et
// l'infamie ☠, avec les chiffres du joueur (tirés des formules du code : toujours à jour).
// Onglet « Réputation » du guide (codex.js, avec le bilan des points cause par cause) et bloc
// réputation de Bureau → Compagnie (phrase d'ambiance, effets du jour en deux colonnes).
// Chaque chiffre du joueur est un nœud de texte à part (traduit seul par i18n.js).
import { h, num, num1, pct, bar } from './dom.js';
import { standingCauses } from './standing.js';
import { standing, interestRate, trustCap, virtueCap, repCap, REP_BASE_CAP, STANDING, trustTarget } from '../sim/core.js';
import { dateOf } from '../sim/util.js';
import { gradeEl } from './grade.js';
import { TAKEOVER } from '../sim/takeover.js';
import { CLIENTS } from '../data/clients.js';
import { FLAGS, PORT_IDS } from '../data/ports.js';
import { imageFactor, IMAGE_PAY } from '../sim/clients.js';
import { IMAGE_PORT_FLAGS, INSPECT_VIRTUE, isImagePort, inspectVirtueK } from '../sim/incidents.js';
import { VICTORY } from '../sim/victory.js';
import { BLACKLIST } from '../sim/shadow.js';

const IMAGE_CLIENTS = Object.keys(CLIENTS).filter((id) => CLIENTS[id].image);
const IMAGE_PORT = PORT_IDS.find(isImagePort);
const signedPct = (k) => `${k >= 1 ? '+' : '−'}${pct(Math.abs(k - 1) * 100)}`;

// Les effets concrets des deux notes pour cette compagnie, aujourd'hui.
export function standingEffects(company) {
  const { confidence: T, virtue: V } = standing(company);
  const rate = interestRate(company);
  return {
    T, V,
    rate, rate100: rate - ((100 - T) / 100) * 0.06, // la confiance enlève jusqu'à 6 points au taux
    premium: Math.floor(T), // contrats dont l'exigence de confiance est à votre portée
    takeoverK: company.blacklisted ? null : 1 + T / TAKEOVER.repK,
    imagePay: IMAGE_CLIENTS.length ? imageFactor(company, IMAGE_CLIENTS[0]) : 1,
    inspectK: IMAGE_PORT ? inspectVirtueK(IMAGE_PORT, V) : 1,
  };
}
const rate1 = (r) => `${num1(r * 100)} %`;

// Fiabilité face au marché (écart de cible, en points) : cinq crans, de « bien moins fiable » à « bien plus fiable ».
const VS_MARKET = [[-6, 1, 'bien moins fiable'], [-2, 2, 'moins fiable'], [2, 3, 'dans la moyenne'], [6, 4, 'plus fiable'], [Infinity, 5, 'bien plus fiable']];
function vsMarket(v) {
  if (v == null) return { g: 3, label: 'trop tôt pour juger' };
  const [, g, label] = VS_MARKET.find(([max]) => v < max);
  return { g, label };
}
const signed = (v) => `${v >= 0 ? '+' : '−'}${num1(Math.abs(v))}`;
// La cible de confiance et ses parts (base, fiabilité face aux concurrents, bonus) : les chiffres de la simulation.
// T : trustTarget(…) aujourd'hui, ou la cible figée à la clôture du trimestre (rapport).
function trustTargetEl(T, label = 'Votre cible :') {
  const parts = [['base', num(T.base)], ['fiabilité face aux concurrents', signed(T.rivals)], ...T.bonuses.map((b) => [b.src, signed(b.value)])];
  return h('p.small.trust-target', [h('span', label), ' ', h('b', num(Math.floor(T.value))), ' (',
    ...parts.flatMap(([l, v], i) => [i ? ' · ' : null, h('span', l), ' ', h('span', v)]), ')']);
}

// Bureau → Compagnie : ce que la note fait pour vous aujourd'hui, en lignes libellé / valeur.
export function trustEffects(company, state) {
  const e = standingEffects(company);
  const T = trustTarget(state, company);
  return [
    ['Cible', num(Math.floor(T.value)), vsMarket(T.known ? T.rivals : null).label],
    ['Taux du crédit', `${rate1(e.rate)}`, `${rate1(e.rate100)} à 100`],
    ['Contrats accessibles', `jusqu'à ${e.premium}`, 'de confiance exigée'],
    e.takeoverK ? ['Prix de rachat', `× ${num1(e.takeoverK)}`, 'votre valeur nette'] : null,
  ].filter(Boolean);
}
export function virtueEffects(company) {
  const e = standingEffects(company);
  return [
    ['Chargeurs d\'image', signedPct(e.imagePay), 'sur leur fret'],
    ['Inspections', `× ${num1(e.inspectK)}`, 'navires usés, ports d\'image'],
  ];
}

// Ce que « ★ 37 » veut dire dans le milieu : une phrase par palier de réputation, avec le nom
// de la compagnie, et une seconde quand les deux notes divergent fort.
const QUOTES = [ // [borne haute exclue, phrase] ; 100 = victoire, jamais affichée seule
  [10, (n) => `« Les assureurs se signent quand ${n} les appelle. »`],
  [20, (n) => `« Au déjeuner, les cadres sourient dès qu'on prononce le nom de ${n}. »`],
  [30, (n) => `« ${n} ? C'est une nouvelle série ? »`],
  [40, (n) => `« ${n} ? Les bateaux ou les camions ? »`],
  [50, (n) => `« Sur ${n}, y a pas grand-chose à dire. »`],
  [60, (n) => `« Sur les quais, on connaît ${n}. »`],
  [70, (n) => `« Sur les quais, on demande ${n}. »`],
  [80, (n) => `« Contrairement aux journaux, les concurrents n'apprécient pas ${n}. Ils se contentent de les copier. »`],
  [96, (n) => `« Les ministres veulent être photographiés sur le pont d'un navire de ${n}. Les gens compétents aussi. »`],
  [Infinity, (n) => `« Si Dieu avait disposé de ${n} à l'époque, Noé serait resté fermier. »`],
];
export const REP_GAP = 20; // écart entre les deux notes à partir duquel la phrase le dit
export function repQuote(company) {
  const { confidence: T, virtue: V } = standing(company);
  const R = Math.floor(Math.min(T, V));
  const main = QUOTES.find(([max]) => R < max)[1](company.name);
  const gap = T - V >= REP_GAP ? 'Les chargeurs ne jurent que par vous ; la presse, elle, a d\'autres mots.'
    : V - T >= REP_GAP ? 'La presse vous adore ; les chargeurs, eux, attendent encore leurs cargaisons.' : null;
  return { main, gap };
}

// Le bilan des points : chaque cause, ce mois-ci et le mois dernier, les gains puis les pertes.
const fmt = (v) => (Math.abs(v) < 0.05 ? '—' : `${v > 0 ? '+' : '−'}${num1(Math.abs(v))}`);
function bilanTable(company, key) {
  const now = Object.fromEntries(standingCauses(company.standingMonth, key));
  const last = Object.fromEntries(standingCauses(company.standingLast, key));
  const causes = [...new Set([...Object.keys(now), ...Object.keys(last)])]
    .sort((a, b) => ((now[b] ?? 0) + (last[b] ?? 0)) - ((now[a] ?? 0) + (last[a] ?? 0)));
  const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
  const cell = (v) => h('td.num', { class: v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'muted' }, fmt(v ?? 0));
  return h('div.rep-bilan', [
    h('div.rep-bilan-head', [h('span', key === 'virtue' ? '💚' : '🤝'), ' ', h('b', key === 'virtue' ? 'Vertu' : 'Confiance')]),
    causes.length ? h('table.table.rep-bilan-table', [
      h('thead', h('tr', [h('th', ''), h('th.num', 'Ce mois'), h('th.num', 'Mois dernier')])),
      h('tbody', causes.map((k) => h('tr', [h('td', k), cell(now[k]), cell(last[k])]))),
      h('tfoot', h('tr.total', [h('td', 'Total'), cell(sum(now)), cell(sum(last))])),
    ]) : h('p.small.muted', 'Rien de notable depuis deux mois.'),
  ]);
}
export const reputationLink = (app) => h('button.btn.small.codex-link', { onclick: () => app.open('codex', null, 'reputation') }, 'Détails et bilan des points →');

// Une carte : icône, question, note actuelle, puis listes.
const li = (text, mine = null) => h('li', [h('span', text), mine ? ' ' : null, mine ? h('b', mine) : null]);
function scoreCard(icon, name, question, value, cap, intro, brings, up, down, extra = null) {
  return h('div.rep-card', [
    h('div.rep-card-head', [h('span.codex-icon', { class: icon === '★' ? 'star' : '' }, icon), h('div.grow', [h('b', name), h('div.small.muted', question)]),
      value != null ? h('b.rep-value', `${num(value)}/100`) : null]),
    value != null ? (icon === '★' ? h('div.bar-star', bar(value / 100)) : bar(value / 100, { good: 0.6, warn: 0.35 })) : null, // ★ toujours en or
    cap != null && cap < 100 ? h('div.small.muted', `Plafond actuel : ${num(cap)}`) : null,
    h('p', intro),
    brings.length ? h('h4', 'Ce qu\'elle vous apporte') : null,
    brings.length ? h('ul', brings) : null,
    up ? h('h4', 'Ce qui la fait monter') : null, up ? h('p.small', up) : null,
    down ? h('h4', 'Ce qui la fait baisser') : null, down ? h('p.small', down) : null,
    extra,
  ]);
}

export function reputationGuide(app) {
  const c = app.company();
  const e = standingEffects(c);
  const imagePorts = [...IMAGE_PORT_FLAGS].map((f) => FLAGS[f]?.name).filter(Boolean).join(', ');
  return h('div', [
    h('h3', 'Vos points, cause par cause'),
    h('div.rep-bilans', [bilanTable(c, 'confidence'), bilanTable(c, 'virtue')]),
    h('h3', 'Comprendre les trois notes'),
    h('p.hint', 'Trois chiffres sous votre trésorerie, en haut à gauche : ★ la réputation, 🤝 la confiance et 💚 la vertu. Chacun répond à une question.'),
    h('div.rep-cards', [
      scoreCard('🤝', 'Confiance', 'Peut-on compter sur vous ?', e.T, trustCap(c),
        'C\'est elle qui fait tourner vos affaires : toute l\'économie la regarde.',
        [
          li('Contrats : les contrats premium exigent de 40 à 75 de confiance, et certains chargeurs ont leurs propres exigences.', `Pour vous : jusqu'à ${e.premium}.`),
          li('Banque : chaque point manquant renchérit le crédit et réduit votre plafond d\'emprunt.', `Votre taux : ${rate1(e.rate)} (${rate1(e.rate100)} à 100).`),
          li('Litiges : plus elle est haute, plus vous gagnez les arbitrages contre un chargeur qui ne paie pas.'),
          li('Prêts sur cargaison et démarchage des chargeurs : meilleures conditions, meilleures chances.'),
          e.takeoverK ? li(`Rachat : votre compagnie vaut sa valeur nette × (1 + confiance / ${TAKEOVER.repK}). Haute, elle vous protège d'un rachat ; basse, vous devenez une proie.`, `Pour vous : × ${num1(e.takeoverK)}.`) : null,
        ].filter(Boolean),
        'Chaque livraison à l\'heure la rapproche de sa cible. Les chargeurs placent cette cible selon votre fiabilité face à celle de vos concurrents : moins de faux pas qu\'eux, elle monte ; plus, elle baisse. Les appels d\'offres servis et le premier passage dans un port la poussent un temps au-dessus.',
        'Les retards, les cargaisons avariées, les détentions, les pannes sèches, les contrats abandonnés, les naufrages, les litiges perdus, les navires détournés. Chacun abaisse aussi votre fiabilité, donc votre cible, pendant une dizaine de mois.',
        trustTargetEl(trustTarget(app.state, c))),
      scoreCard('💚', 'Vertu', 'Que dit la presse de vous ?', e.V, virtueCap(c),
        'Votre image : on ne gagne pas en étant seulement efficace. Le reste de l\'économie ne la regarde pas : un armateur sans scrupules peut s\'enrichir, il ne sera simplement jamais « le plus respecté ».',
        [
          li('Victoire « La plus respectée » : c\'est souvent elle qui retient la réputation.'),
          IMAGE_CLIENTS.length ? li(`Chargeurs soucieux de leur image (${IMAGE_CLIENTS.length}, dont une major pétrolière) : leur fret va de −${pct(IMAGE_PAY.down * 100)} à vertu 0 à +${pct(IMAGE_PAY.up * 100)} à vertu 100, fixé à la signature.`, `Pour vous : ${signedPct(e.imagePay)}.`) : null,
          li(`Ports soucieux de leur image (${imagePorts}) : ils inspectent un navire usé × ${num1(INSPECT_VIRTUE.low)} plus souvent à vertu 0, × ${num1(INSPECT_VIRTUE.high)} à vertu 100.`, `Pour vous : × ${num1(e.inspectK)}.`),
        ].filter(Boolean),
        'L\'aide d\'urgence, les marchandises utiles (céréales, café et cacao, fruits et viandes, bois), les affaires en or et appels d\'offres sur des marchandises ni fossiles ni polluantes, l\'allure économique, les chargeurs malhonnêtes dénoncés, et doucement chaque mois de conduite propre.',
        'Chaque départ chargé de pétrole, les marées noires, la contrebande, les amendes d\'embargo, les pots-de-vin, les affaires noires, les coups bas.',
        h('p.small.good', `Rien n'est définitif : sous ${STANDING.forgiveTo}, on finit par oublier et elle y remonte d'elle-même.`)),
      scoreCard('★', 'Réputation', 'La plus basse des deux', Math.min(e.T, e.V), repCap(c),
        'Elle ne sert qu\'à la victoire « La plus respectée ». Impossible de n\'en soigner qu\'une : l\'armateur efficace qui pollue plafonne, le saint qui livre en retard aussi. La note qui la retient s\'affiche en rouge.',
        [],
        null, null,
        h('p.small', `La victoire demande 100 aux deux notes (la conduite ordinaire s'arrête à ${REP_BASE_CAP}, chacun des ${VICTORY.repDeeds} premiers hauts faits ajoute un point), le bureau niveau ${VICTORY.repLevel + 1}, puis tenir ${Math.round(VICTORY.repHoldDays / 30)} mois sans repasser sous ${VICTORY.repHoldFloor}.`)),
      scoreCard('☠', 'Infamie', 'Le prix des affaires noires', null, null,
        `Chaque affaire noire ajoute de l'infamie, pour toujours. Elle abaisse le plafond de la confiance et de la vertu (100 − infamie) : moins de bons contrats, un crédit plus cher. À ${BLACKLIST.infamy}, liste noire internationale. Le jeu prévient avant chaque affaire.`,
        [], null, null,
        h('p.small', c.infamy ? `Votre infamie : ${num(c.infamy)}. Plafond de vos deux notes : ${num(repCap(c))}.` : 'Votre infamie : aucune.')),
    ]),
    h('p.hint', 'Ne pas confondre avec la confiance des gangs, port par port, qui ne compte que dans l\'ombre.'),
  ]);
}

// Rapport de confiance du trimestre (idée du propriétaire) : qui a gagné la confiance des chargeurs, avec quel
// chargeur, et d'où vient votre cible. Bureau → Compagnie ; la notification du trimestre y mène.
function quarterLabel(t) {
  const d = dateOf(t - 24); // le rapport tombe le premier jour du trimestre suivant
  return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
export function trustReportBox(app) {
  const { state } = app, me = app.company(), R = state.trustReport;
  const rows = R ? [...R.rows].sort((a, b) => b.trust - a.trust) : [];
  const mine = rows.find((r) => r.id === me.id);
  return h('div.trust-report', [
    h('div.trust-report-head', [h('span', '🤝'), ' ', h('b', 'Rapport de confiance'), R ? h('span.muted.small', quarterLabel(R.t)) : null]),
    mine?.target ? trustTargetEl(mine.target, 'Votre cible à la clôture :') : null, // figée avec le reste du rapport
    R ? h('table.table.trust-report-table', [
      h('thead', h('tr', [h('th', 'Compagnie'), h('th.num', 'Confiance'), h('th', 'Fiabilité face au marché'), h('th', 'Meilleur partenaire')])),
      h('tbody', rows.map((r) => {
        const co = state.companies[r.id], vs = vsMarket(r.vsMarket);
        return h('tr', { class: r.id === me.id ? 'me' : null }, [
          h('td', h('b', co.name)),
          h('td.num', [h('span', num(Math.floor(r.trust))), ' ', h('span.small', { class: r.delta >= 0 ? 'pos' : 'neg' }, `${r.delta >= 0 ? '▲' : '▼'} ${num1(Math.abs(r.delta))}`)]),
          h('td', [gradeEl(vs.g, { title: vs.label }), ' ', h('span.small', vs.label)]),
          h('td', r.best && CLIENTS[r.best] ? [h('span', CLIENTS[r.best].name), ' ', h('span.muted.small', `(${r.bestN})`)] : h('span.muted', '—')),
        ]);
      })),
    ]) : h('p.small.muted', 'Premier rapport au début du prochain trimestre.'),
  ]);
}
