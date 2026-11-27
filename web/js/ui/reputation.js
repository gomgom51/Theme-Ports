// Comprendre la réputation : à quoi servent la confiance 🤝, la vertu 💚, la réputation ★ et
// l'infamie ☠, avec les chiffres du joueur (tirés des formules du code : toujours à jour).
// Onglet « Réputation » du guide (codex.js) et lignes « Pour vous aujourd'hui » du bureau.
// Chaque chiffre du joueur est un nœud de texte à part (traduit seul par i18n.js).
import { h, num, num1, pct, bar } from './dom.js';
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

// Bureau → Compagnie : une ligne d'effets par note.
export function trustNow(company) {
  const e = standingEffects(company);
  return `Pour vous aujourd'hui : crédit à ${rate1(e.rate)} (${rate1(e.rate100)} à 100) · contrats exigeant jusqu'à ${e.premium} de confiance${e.takeoverK ? ` · votre compagnie vaut × ${num1(e.takeoverK)} sa valeur nette pour un acheteur` : ''}.`;
}
export function virtueNow(company) {
  const e = standingEffects(company);
  return `Pour vous aujourd'hui : chargeurs soucieux de leur image ${signedPct(e.imagePay)} · inspections dans les ports soucieux de leur image × ${num1(e.inspectK)}.`;
}
export const reputationLink = (app) => h('button.btn.small.codex-link', { onclick: () => app.open('codex', null, 'reputation') }, '📖 Comprendre la réputation');

// Une carte : icône, question, note actuelle, puis listes.
const li = (text, mine = null) => h('li', [h('span', text), mine ? ' ' : null, mine ? h('b', mine) : null]);
function scoreCard(icon, name, question, value, cap, intro, brings, up, down, extra = null) {
  return h('div.rep-card', [
    h('div.rep-card-head', [h('span.codex-icon', icon), h('div.grow', [h('b', name), h('div.small.muted', question)]),
      value != null ? h('b.rep-value', `${num(value)}/100`) : null]),
    value != null ? bar(value / 100, { good: 0.6, warn: 0.35 }) : null,
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
    h('p.hint', 'Chaque mois, un court bilan dit ce qui a fait bouger vos notes (Bureau → Compagnie). Ne pas confondre avec la confiance des gangs, port par port, qui ne compte que dans l\'ombre.'),
  ]);
}
