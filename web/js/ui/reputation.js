// Comprendre la réputation : à quoi servent la confiance 🤝, la vertu 💚, la réputation ★ et
// l'infamie ☠, avec les chiffres du joueur (tirés des formules du code : toujours à jour).
// Onglet « Réputation » du guide (codex.js, avec le bilan des points cause par cause) et bloc
// réputation de Bureau → Compagnie (phrase d'ambiance, effets du jour en deux colonnes).
// Chaque chiffre du joueur est un nœud de texte à part (traduit seul par i18n.js).
import { h, num, num1, pct, bar } from './dom.js';
import { standingCauses } from './standing.js';
import { standing, interestRate, trustCap, virtueCap, repCap, REP_BASE_CAP, STANDING } from '../sim/core.js';
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

// Bureau → Compagnie : ce que la note fait pour vous aujourd'hui, en lignes libellé / valeur.
export function trustEffects(company) {
  const e = standingEffects(company);
  return [
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
const QUOTES = [
  [10, (n) => `« Les assureurs se signent quand ${n} les appelle. »`],
  [20, (n) => `« Au déjeuner, les cadres sourient dès qu'on prononce le nom de ${n}. »`],
  [35, (n) => `« ${n} ? Jamais entendu parler. »`],
  [50, (n) => `« ${n} ? Ah oui… ceux qui ont des bateaux, je crois. »`],
  [65, (n) => `« Sur les quais, on connaît ${n} : sérieux, sans plus. »`],
  [80, (n) => `« Quand une cargaison compte, les chargeurs appellent ${n} en premier. »`],
  [90, (n) => `« Les journaux citent ${n} en exemple, et ses concurrents l'imitent. »`],
  [100, (n) => `« Les ministres veulent être photographiés sur le pont d'un navire de ${n}. »`],
  [Infinity, (n) => `« Quand ${n} parle, tout le monde maritime se tait pour écouter. »`],
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
        'Les livraisons à l\'heure (un peu moins près du haut), les appels d\'offres et les affaires en or servis, le premier passage dans un port.',
        'Les retards, les cargaisons avariées, les détentions, les pannes sèches, les contrats abandonnés, les naufrages, les litiges perdus, les navires détournés.'),
      scoreCard('💚', 'Vertu', 'Que dit la presse de vous ?', e.V, virtueCap(c),
        'Votre image : on ne gagne pas en étant seulement efficace. Le reste de l\'économie ne la regarde pas : un armateur sans scrupules peut s\'enrichir, il ne sera simplement jamais « le plus respecté ».',
        [
          li('Victoire « La plus respectée » : c\'est souvent elle qui retient la réputation.'),
          IMAGE_CLIENTS.length ? li(`Chargeurs soucieux de leur image (${IMAGE_CLIENTS.length}, dont une major pétrolière) : leur fret va de −${pct(IMAGE_PAY.down * 100)} à vertu 0 à +${pct(IMAGE_PAY.up * 100)} à vertu 100, fixé à la signature.`, `Pour vous : ${signedPct(e.imagePay)}.`) : null,
          li(`Ports soucieux de leur image (${imagePorts}) : ils inspectent un navire usé × ${num1(INSPECT_VIRTUE.low)} plus souvent à vertu 0, × ${num1(INSPECT_VIRTUE.high)} à vertu 100.`, `Pour vous : × ${num1(e.inspectK)}.`),
        ].filter(Boolean),
        'L\'aide d\'urgence, les marchandises utiles (céréales, café et cacao, fruits et viandes, bois), les affaires en or et appels d\'offres sur des marchandises ni fossiles ni polluantes, l\'allure économique, les chargeurs malhonnêtes dénoncés, et doucement chaque mois de conduite propre.',
        'Chaque livraison de pétrole, les marées noires, la contrebande, les amendes d\'embargo, les pots-de-vin, les affaires noires, les coups bas.',
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
