// Avantage du port d'attache : étiquette (liste des ports) et encadré (choix du port, Bureau).
import { h } from './dom.js';
import { HOME, homeKind, takeoverDiscount } from '../sim/home.js';

const pctTxt = (x) => `${Math.round(x * 100)} %`;
export function homeTag(port) {
  const k = homeKind(port);
  if (k === 'ombre') return h('span.tag.home-tag.shadow', { title: 'Port de l\'ombre : un coup de pouce vers la flotte fantôme' }, '🏴 port de l\'ombre');
  if (k === 'place') return h('span.tag.home-tag.hub', { title: 'Place financière : des rachats moins chers' }, '🏦 place financière');
  return null;
}
// company : la compagnie installée là (montre sa remise actuelle), sinon un aperçu avant le choix.
export function homeBonusBox(port, company = null) {
  const k = homeKind(port);
  if (k === 'ombre') {
    return h('div.card.home-bonus.shadow', [h('div.card-main', [
      h('div.card-title', '🏴 Port de l\'ombre : vers la flotte fantôme'),
      h('ul.home-list', [
        h('li', 'Les gangs vous connaissent : des affaires noires vous sont proposées ici dès le départ.'),
        h('li', `La douane regarde ailleurs chez vous : risque de fouille × ${String(HOME.customs).replace('.', ',')} pour les colis et les cargaisons noires.`),
        h('li', 'Refuser une affaire ici ne vous attire ni rancune ni saisie.'),
        h('li', `Jusqu'à ${HOME.parcels} colis discrets proposés à la fois (2 ailleurs).`),
      ]),
      h('div.card-sub.warn-text', 'Revers : pays sous embargo. Réputation de départ basse, crédit cher, et chaque commerce chez vous marque le navire : amende possible dans les ports qui appliquent les sanctions.'),
    ])]);
  }
  if (k === 'place') {
    const d = company ? takeoverDiscount(company) : null;
    return h('div.card.home-bonus.hub', [h('div.card-main', [
      h('div.card-title', '🏦 Place financière : vers « Seul maître à bord »'),
      h('div.card-sub', `Banquiers et avocats sur place : racheter un concurrent coûte moins cher quand on a la confiance des marchés. Remise de 0 % à ${HOME.takeoverFrom} de confiance, jusqu'à ${pctTxt(HOME.takeoverMax)} à 100.`),
      d != null ? h('div.card-sub', [h('span', 'Votre remise actuelle :'), ' ', h('b', pctTxt(d))]) : null,
    ])]);
  }
  return h('div.card.home-bonus', [h('div.card-main', [
    h('div.card-title', 'Pas d\'avantage particulier'),
    h('div.card-sub.muted', 'Les ports de l\'ombre (pays sous embargo) aident la flotte fantôme ; les grandes places financières rendent les rachats moins chers.'),
  ])]);
}
