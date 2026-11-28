// Commerce gris et noir : pays sous embargo, pays qui font respecter les
// sanctions, douanes et corruption des ports, aptitude des navires à cacher un colis.
import { FLAGS } from './ports.js';

// Pays sous embargo : leurs ports paient cher ce qui leur manque et bradent leur brut.
export const EMBARGOED = {
  IR: { name: 'Iran', why: 'sanctions sur le pétrole et la finance' },
  VE: { name: 'Venezuela', why: 'sanctions sur le pétrole' },
  RU: { name: 'Russie', why: 'sanctions sur le pétrole, la finance et la flotte' },
  KP: { name: 'Corée du Nord', why: 'embargo des Nations unies' },
};
// Pays qui font respecter ces sanctions dans leurs ports (et y punissent les contrevenants).
export const ENFORCING = new Set(['US', 'CA', 'NL', 'DE', 'FR', 'IT', 'ES', 'PL', 'RO', 'GR', 'JP', 'KR', 'AU', 'NZ']);

// Douane d'un port : probabilité de fouille poussée d'un navire suspect (0 à 1).
export function customsLevel(flag) {
  const r = FLAGS[flag]?.rating ?? 50;
  return r >= 75 ? 0.35 : r >= 55 ? 0.22 : r >= 40 ? 0.14 : 0.08;
}
// Corruption : chance qu'un pot-de-vin soit accepté.
export function corruption(flag) {
  const r = FLAGS[flag]?.rating ?? 50;
  return Math.max(0, Math.min(0.85, (70 - r) / 60));
}
// Plus le chiffre est bas, mieux le navire cache un colis (cales et ponts encombrés des cargos).
export const CONCEALMENT = {
  caboteur: 0.5, cargo_ancien: 0.45, polyvalent: 0.55, colis_lourds: 0.6,
  frigorifique: 0.7, porte_voitures: 0.65, feeder: 0.75, pc_panamax: 0.8, pc_geant: 0.85,
  vraquier_handy: 1, vraquier_supramax: 1, vraquier_panamax: 1.05, vraquier_capesize: 1.1,
  petrolier_ancien: 1.1, petrolier_mr: 1.2, chimiquier: 1.15, petrolier_aframax: 1.25, petrolier_suezmax: 1.25,
  petrolier_vlcc: 1.3, petrolier_ulcc: 1.3, gazier: 1.3, methanier: 1.35,
};
// Ports où des intermédiaires proposent des colis discrets.
// Le milieu de chaque port louche : un nom inventé (jamais un vrai groupe), toujours le même, pour que le
// monde se souvienne de qui vous avez fâché (rancune, saisie, refus). « La Mafia » reste le service de
// coups bas loué partout (plots.js), une autre affaire.
export const GANGS = {
  colon: 'la Hermandad de las Esclusas', cartagena: 'la Cofradía de Bocachica', puerto_la_cruz: 'la Cofradía del Faro Rojo',
  lagos: 'la Confrérie de la Lagune', tema: 'la Bande du Brise-lames', abidjan: 'la Clique de Treichville', luanda: 'la Fraternité de l\'Île',
  djibouti: 'la Confrérie du Sel', bandar_abbas: 'la Fraternité des Dhows', karachi: 'la Confrérie de Manora', mombasa: 'la Bande du Vieux-Port',
  manille: 'la Hermandad del Galeón', veracruz: 'la Cofradía de Ulúa', alexandrie: 'la Confrérie du Phare', nampo: 'la Maison du Barrage',
  es_sider: 'la Fraternité des Sables', chittagong: 'la Bande de la Karnaphuli', novorossiysk: 'la Brigade de Tsemes',
};
export const SHADY_PORTS = ['colon', 'cartagena', 'puerto_la_cruz', 'lagos', 'tema', 'abidjan', 'luanda', 'djibouti', 'bandar_abbas', 'karachi', 'mombasa', 'manille', 'veracruz', 'alexandrie', 'nampo', 'es_sider', 'chittagong', 'novorossiysk'];
