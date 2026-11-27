// À quoi sert chaque navire : atouts (+) et défauts (−) en quelques mots, sur les cartes du courtier
// et la fiche d'un navire. Pas de chiffres : des échelles (bas, élevé, presque tous…), pour qu'un
// nouveau joueur voie d'un coup d'œil qu'un gros navire n'est pas toujours le meilleur choix.
// Les lignes « grues de bord », « simple coque » et « discrétion » viennent des données du navire
// (SHIP_TYPES.gear, .singleHull, CONCEALMENT) : elles restent justes si ces données changent.
import { SHIP_TYPES, CREW_LEVELS } from '../data/ships.js';
import { CONCEALMENT } from '../data/sanctions.js';
import { concealFactor, concealLevel } from '../sim/shady.js';
import { hasEquip } from '../sim/equipment.js';
import { rank } from '../sim/crew.js';
import { h } from './dom.js';
import { gradeEl } from './grade.js';

const OIL_VIRTUE = 'Le pétrole fait baisser la vertu';
const OIL_CRISIS = 'Sans contrats pendant les crises du raffinage';

export const SHIP_ROLES = {
  caboteur: {
    pros: ['Frais fixes très bas', 'Entre dans presque tous les ports'],
    cons: ['Petits profits par contrat', 'Lent, faible autonomie'],
  },
  cargo_ancien: {
    pros: ['Presque donné à l\'achat', 'Peu à perdre s\'il est saisi'],
    cons: ['Gourmand en carburant et en marins', 'Vieux : pannes, usure et inspections fréquentes'],
  },
  polyvalent: {
    pros: ['Transporte presque tout : vrac, marchandises, conteneurs', 'Entre dans presque tous les ports'],
    cons: ['Trop lent pour la plupart des lignes de conteneurs', 'Profits moyens par contrat'],
  },
  colis_lourds: {
    pros: ['Seul à transporter les colis lourds : peu de concurrence', 'Prend aussi marchandises et conteneurs'],
    cons: ['Frais fixes élevés pour sa taille', 'Peu de ports expédient des colis lourds'],
  },
  vraquier_handy: {
    pros: ['Coût à la tonne bas', 'Beaucoup de ports', 'Céréales et bois : bons pour la vertu'],
    cons: ['Lent', 'Vrac seulement', 'Fret moins payé que le pétrole ou le gaz'],
  },
  vraquier_supramax: {
    pros: ['Coût à la tonne très bas', 'Céréales et bois : bons pour la vertu'],
    cons: ['Lent', 'Vrac seulement', 'Moins de ports qu\'un petit vraquier'],
  },
  vraquier_panamax: {
    pros: ['Coût à la tonne très bas', 'Grosses cargaisons', 'Céréales : bonnes pour la vertu'],
    cons: ['Pas de grues : lent à charger dans les petits ports', 'Vrac seulement', 'Moins de ports'],
  },
  vraquier_capesize: {
    pros: ['Le coût à la tonne le plus bas du vrac', 'Cargaisons géantes'],
    cons: ['Très peu de ports', 'Trop grand pour les canaux : longs détours', 'Vrac seulement'],
  },
  petrolier_ancien: {
    pros: ['L\'entrée la moins chère dans le pétrole', 'Fret du pétrole bien payé'],
    cons: ['Vieux : pannes, usure, inspections et marées noires plus fréquentes', OIL_VIRTUE, OIL_CRISIS],
  },
  petrolier_mr: {
    pros: ['Fret du pétrole bien payé', 'Beaucoup de ports', 'Brut et produits raffinés'],
    cons: [OIL_VIRTUE, OIL_CRISIS],
  },
  chimiquier: {
    pros: ['Seul à transporter les produits chimiques', 'Prend aussi le pétrole', 'Entre dans presque tous les ports'],
    cons: ['Frais fixes élevés pour sa taille', OIL_VIRTUE],
  },
  petrolier_aframax: {
    pros: ['Grosses cargaisons de pétrole', 'Coût à la tonne très bas'],
    cons: ['Moins de ports', OIL_VIRTUE, OIL_CRISIS],
  },
  petrolier_suezmax: {
    pros: ['Très grosses cargaisons de pétrole', 'Passe le canal de Suez chargé'],
    cons: ['Peu de ports', OIL_VIRTUE, OIL_CRISIS],
  },
  petrolier_vlcc: {
    pros: ['Cargaisons énormes', 'Le coût à la tonne le plus bas'],
    cons: ['Une poignée de ports', 'Trop profond pour Suez : longs détours', 'Très cher', OIL_VIRTUE],
  },
  petrolier_ulcc: {
    pros: ['Les plus grosses cargaisons du monde', 'Le coût à la tonne le plus bas'],
    cons: ['Quelques ports seulement', 'Très cher', OIL_VIRTUE, OIL_CRISIS],
  },
  gazier: {
    pros: ['Fret du gaz bien payé', 'Seul à transporter le GPL', 'Assez rapide'],
    cons: ['Peu de ports', 'Une seule marchandise'],
  },
  methanier: {
    pros: ['Rapide', 'Fret du gaz bien payé', 'Seul à transporter le gaz naturel liquéfié'],
    cons: ['Hors de prix', 'Peu de ports', 'Frais fixes très élevés'],
  },
  feeder: {
    pros: ['Assez rapide pour les lignes de conteneurs', 'Marchandises chères', 'Beaucoup de ports'],
    cons: ['Gourmand en carburant', 'Conteneurs seulement'],
  },
  pc_panamax: {
    pros: ['Rapide', 'Grosses cargaisons de marchandises chères'],
    cons: ['Très gourmand en carburant', 'Moins de ports', 'Cher'],
  },
  pc_geant: {
    pros: ['Le plus rapide des gros navires', 'Cargaisons énormes de marchandises chères'],
    cons: ['Peu de ports', 'Hors de prix', 'Frais fixes très élevés'],
  },
  porte_voitures: {
    pros: ['Rapide', 'Seul à transporter les véhicules'],
    cons: ['Véhicules seulement', 'Frais fixes élevés', 'Moins de ports'],
  },
  frigorifique: {
    pros: ['Très rapide', 'Fret bien payé', 'Fruits et viandes : bons pour la vertu'],
    cons: ['Fruits et viandes seulement', 'Cargaison fragile : retards et pannes de froid coûtent cher', 'Gourmand en carburant'],
  },
};

// Échelle de discrétion (1 voyant … 5 insoupçonnable), la même partout : courtier, colis, affaires noires.
export const CONCEAL_WORDS = ['', 'voyant', 'ordinaire', 'discret', 'très discret', 'insoupçonnable'];
export const typeConcealLevel = (typeId) => concealLevel(CONCEALMENT[typeId] ?? 1);

// Atouts et défauts d'un modèle. ship : navire réel (simple coque déjà renforcée ?) ; age : annonce d'occasion.
export function shipRoles(typeId, { ship = null, age = 0 } = {}) {
  const T = SHIP_TYPES[typeId];
  const R = SHIP_ROLES[typeId] || { pros: [], cons: [] };
  const pros = [], cons = [];
  if (T.gear) pros.push('Grues de bord : charge vite même dans les petits ports');
  if (T.singleHull && !(ship && hasEquip(ship, 'double_coque'))) cons.push('Simple coque : amendes dans les ports exigeants, sauf avec une coque renforcée');
  if (T.stock?.includes('brouilleur')) pros.push('Transpondeur « discret » fourni');
  const lv = typeConcealLevel(typeId);
  if (lv >= 4) pros.push({ t: 'Très discret à la douane', grade: lv });
  else if (lv === 3) pros.push({ t: 'Discret à la douane', grade: lv });
  pros.push(...R.pros);
  cons.push(...R.cons);
  if (!T.vintage && age > 20) cons.push('Plus de vingt ans : pannes et inspections plus fréquentes');
  return { pros, cons };
}

// Une ligne : un texte, ou { t, grade } pour la discrétion (même échelle que sur les propositions de colis).
const roleItem = (x) => (typeof x === 'string' ? h('li', x) : h('li', [x.t, ' ', gradeEl(x.grade, { title: `Discrétion : ${CONCEAL_WORDS[x.grade]}` })]));
export function rolesEl(typeId, opts = {}) {
  const { pros, cons } = shipRoles(typeId, opts);
  return h('div.ship-roles', [
    h('ul.roles-pros', pros.map(roleItem)),
    h('ul.roles-cons', cons.map(roleItem)),
  ]);
}

// La discrétion d'un navire face à la douane, et d'où elle vient : coque, cachettes, équipage,
// savoir-faire. Montrée avec chaque proposition de colis ou d'affaire noire.
export function concealEl(ship) {
  const lv = concealLevel(concealFactor(ship));
  const T = SHIP_TYPES[ship.type];
  const hull = typeConcealLevel(ship.type);
  const parts = [
    `coque de ${T.name.toLowerCase()} : ${CONCEAL_WORDS[hull]}`,
    hasEquip(ship, 'cachettes') ? 'cachettes aménagées' : 'sans cachettes aménagées (au chantier)',
    `équipage ${CREW_LEVELS[ship.crew || 0].short}`,
  ];
  const r = rank(ship, 'contrebande');
  if (r) parts.push(`contrebande rang ${r}`);
  return h('div.conceal', { class: `lv${lv}` }, [
    h('div', [`🕵 Discrétion du ${ship.name} : `, gradeEl(lv, { cls: lv <= 2 ? 'warn' : '', title: `Discrétion : ${CONCEAL_WORDS[lv]}` }), ' ', h('b', CONCEAL_WORDS[lv])]),
    h('div.muted.small', `${parts.join(' · ')}. Plus il est discret, moins la douane trouve le colis.`),
  ]);
}
