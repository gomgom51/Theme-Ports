// Avantage du port d'attache : étiquette (liste des ports) et encadré (choix du port, Bureau).
import { h } from './dom.js';
import { HOME, homeKind, takeoverDiscount, START_PORT, embargoedPort } from '../sim/home.js';
import { SHADOW_LENDER } from '../sim/core.js';
import { PORTS } from '../data/ports.js';

const pctTxt = (x) => `${Math.round(x * 100)} %`;
export function homeTag(port) {
  const k = homeKind(port);
  if (k === 'ombre') return h('span.tag.home-tag.shadow', { title: 'Port de l\'ombre : un coup de pouce vers la flotte fantôme' }, '💀 port de l\'ombre');
  if (k === 'place') return h('span.tag.home-tag.hub', { title: 'Place financière : des rachats moins chers' }, '$ place financière');
  if (k === 'famille') return h('span.tag.home-tag.family', { title: 'Famille d\'abord : un contrat vous attend toujours chez vous' }, '♥ famille d\'abord');
  if (k === 'hiver') return h('span.tag.home-tag.winter', { title: 'Port d\'hiver : classe glace offerte sur chaque navire acheté' }, '❄ port d\'hiver');
  return null;
}
// company : la compagnie installée là (montre sa remise actuelle), sinon un aperçu avant le choix.
// Pays sous embargo : en plus, le prêteur de l'ombre (au choix, à côté de la banque).
export function homeBonusBox(port, company = null) {
  const box = kindBox(port, company);
  if (!embargoedPort(port)) return box;
  return h('div', [box, h('div.card.home-bonus.lender', [h('div.card-main', [
    h('div.card-title', '💀 Prêteur de l\'ombre, au choix'),
    h('div.card-sub', `La banque d'un pays sous embargo prête cher. Un prêteur de l'ombre propose ${Math.round(SHADOW_LENDER.rate * 100)} % de base, tant que vous lui livrez ${SHADOW_LENDER.quota} colis discrets tous les ${Math.round(SHADOW_LENDER.days / 30)} mois (Bureau, onglet Finances).`),
  ])])]);
}
function kindBox(port, company) {
  const k = homeKind(port);
  if (k === 'ombre') {
    return h('div.card.home-bonus.shadow', [h('div.card-main', [
      h('div.card-title', '💀 Port de l\'ombre : vers la flotte fantôme'),
      h('ul.home-list', [
        h('li', 'Les gangs vous connaissent : des affaires noires vous sont proposées ici dès le départ.'),
        h('li', `La douane regarde ailleurs chez vous : risque de fouille × ${String(HOME.customs).replace('.', ',')} pour les colis et les cargaisons noires.`),
        h('li', 'Refuser une affaire ici ne vous attire ni rancune ni saisie.'),
        h('li', `Jusqu'à ${HOME.parcels} colis discrets proposés à la fois (2 ailleurs).`),
      ]),
      h('div.card-sub.warn-text', 'Revers : pays sous embargo. Réputation de départ basse, banque chère, et chaque commerce chez vous marque le navire : amende possible dans les ports qui appliquent les sanctions.'),
    ])]);
  }
  if (k === 'place') {
    const d = company ? takeoverDiscount(company) : null;
    return h('div.card.home-bonus.hub', [h('div.card-main', [
      h('div.card-title', '$ Place financière : vers « Seul maître à bord »'),
      h('div.card-sub', `Banquiers et avocats sur place : racheter un concurrent coûte moins cher quand on a la confiance des marchés. Remise de 0 % à ${HOME.takeoverFrom} de confiance, jusqu'à ${pctTxt(HOME.takeoverMax)} à 100.`),
      d != null ? h('div.card-sub', [h('span', 'Votre remise actuelle :'), ' ', h('b', pctTxt(d))]) : null,
      h('div.card-sub.warn-text', `Revers : racheter une compagnie d'un pays sous embargo vous coûterait une amende (la moitié du prix, ${Math.round(HOME.embargoFineMin / 1e6)} M$ au moins) et l'expulsion : votre siège partirait dans ce pays.`),
    ])]);
  }
  if (k === 'famille') {
    return h('div.card.home-bonus.family', [h('div.card-main', [
      h('div.card-title', '♥ Famille d\'abord'),
      h('ul.home-list', [
        h('li', 'Un contrat à la mesure de votre navire vous attend toujours ici, si ses cales conviennent aux marchandises du port.'),
        h('li', 'Votre plus grand concurrent n\'y trouve jamais rien : ni contrat, ni démarchage.'),
        h('li', `Vos achats de marchandises ici coûtent ${Math.round(HOME.familyDiscount * 100)} % de moins.`),
      ]),
    ])]);
  }
  if (k === 'hiver') {
    const start = START_PORT[port];
    return h('div.card.home-bonus.winter', [h('div.card-main', [
      h('div.card-title', '❄ Port d\'hiver : la classe glace offerte'),
      h('div.card-sub', 'Chaque navire acheté, d\'occasion ou neuf, est livré avec une coque de classe glace, gratuite : trois semaines de plus à chaque bout de la saison dans les ports arctiques et le passage du Nord-Est, et l\'escorte d\'un brise-glace à 40 % du prix. Revers : 3 % de carburant en plus (l\'équipement se retire au chantier).'),
      start ? h('div.card-sub.warn-text', `Port saisonnier, pris par les glaces l'hiver : la partie commence en janvier, vos premiers navires et contrats vous attendent à ${PORTS[start].name}.`) : null,
    ])]);
  }
  return h('div.card.home-bonus', [h('div.card-main', [
    h('div.card-title', 'Pas d\'avantage particulier'),
    h('div.card-sub.muted', 'Les ports de l\'ombre (pays sous embargo) aident la flotte fantôme, les grandes places financières rendent les rachats moins chers, les ports d\'hiver offrent la classe glace, et les ports « famille d\'abord » gardent toujours un contrat pour vous.'),
  ])]);
}
