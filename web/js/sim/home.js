// Avantages du port d'attache : un coup de pouce vers les victoires les moins jouées.
// - Port de l'ombre (port louche d'un pays sous embargo) : vers la flotte fantôme. Les gangs vous
//   connaissent (affaires noires proposées dès le départ), la douane regarde ailleurs chez vous,
//   un refus n'y attire pas d'ennuis, et les colis discrets y sont plus nombreux. Ses handicaps
//   restent : réputation de départ basse, crédit cher, et commercer chez soi marque le navire.
// - Place financière (grand port) : vers « Seul maître à bord ». Banquiers et avocats sur place :
//   un rachat coûte moins cher quand on a la confiance des marchés (0 % à 50, jusqu'à 25 % à 100).
// - Port d'hiver (près des glaces) : chaque navire acheté est livré avec la classe glace, gratuite.
//   Les ports saisonniers en font partie : pris par les glaces en janvier, ils envoient les premiers
//   navires et contrats de la partie au port ouvert le plus proche (START_PORT).
import { PORTS } from '../data/ports.js';
import { EMBARGOED, SHADY_PORTS } from '../data/sanctions.js';
import { standing } from './core.js';

export const HOME = {
  hubs: ['rotterdam', 'dubai', 'singapour', 'shanghai', 'new_york', 'houston', 'los_angeles', 'hong_kong'],
  customs: 0.3,        // port de l'ombre : risque de fouille chez soi (colis, cargaisons noires) × 0,3
  parcels: 3,          // port de l'ombre : colis discrets proposés en même temps (2 ailleurs)
  takeoverFrom: 50,    // place financière : la remise sur les rachats part de cette confiance…
  takeoverMax: 0.25,   // … et atteint 25 % à 100
  off: false,          // tests : coupe les avantages (le tempérament des IA suit toujours le port)
  winter: ['murmansk', 'valdez', 'ust_luga', 'gdansk', 'hambourg', 'sabetta', 'prudhoe_bay', 'nome', 'churchill'],
};
// Ports saisonniers choisis comme port d'attache : où trouver les premiers navires et contrats.
export const START_PORT = { sabetta: 'murmansk', prudhoe_bay: 'valdez', nome: 'valdez', churchill: 'new_york' };
export const startPort = (home) => START_PORT[home] || home;

// 'ombre', 'place' ou null (portKind : la nature du port, même avantages coupés).
export const portKind = (port) => (EMBARGOED[PORTS[port]?.flag] && SHADY_PORTS.includes(port) ? 'ombre' : HOME.hubs.includes(port) ? 'place' : HOME.winter.includes(port) ? 'hiver' : null);
export const homeKind = (port) => (HOME.off ? null : portKind(port));
export const homeOf = (state, ship) => state?.companies?.[ship?.owner]?.homePort || null;
// Ce port est-il le port de l'ombre de cette compagnie ?
export const shadowHome = (company, port) => !!company && !company.bankrupt && company.homePort === port && homeKind(port) === 'ombre';
// Port d'hiver : la coque de classe glace offerte à chaque navire acheté (d'occasion ou neuf).
export function winterKit(company, ship) {
  if (!company || homeKind(company.homePort) !== 'hiver') return;
  ship.equipment ??= [];
  if (!ship.equipment.includes('glace')) ship.equipment.push('glace');
}
// Remise sur les rachats (0 à 0,25) pour une compagnie basée sur une place financière.
export function takeoverDiscount(company) {
  if (!company || homeKind(company.homePort) !== 'place') return 0;
  const t = standing(company).confidence;
  return HOME.takeoverMax * Math.max(0, Math.min(1, (t - HOME.takeoverFrom) / (100 - HOME.takeoverFrom)));
}
