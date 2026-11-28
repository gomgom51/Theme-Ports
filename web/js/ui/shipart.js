// Illustrations des navires, générées à partir du modèle : le pixel art de pixelship.js (style fin ou en
// gros pixels, au choix du joueur). L'âge et l'état ne changent jamais les couleurs : ils se voient à la
// rouille, aux rayures, aux bosses, à la peinture arrachée, aux trous et à la suie.
import { SHIP_TYPES } from '../data/ships.js';
import { pixelShipMarkup } from './pixelship.js';

// Usure de 0 (neuf) à 1 (épave) : l'état pèse plus que l'âge.
export function wearOf(typeId, condition = 100, age = 0) {
  const life = SHIP_TYPES[typeId]?.life || 25;
  return Math.max(0, Math.min(1, ((100 - condition) / 100) * 0.85 + (age / life) * 0.4));
}

/**
 * Illustration d'un navire, en pixel art (pixelship.js) dans le style choisi par le joueur.
 * opts : condition, age (années), color et logo (compagnie : cheminée), name, laden, seed,
 *        title (texte lu par les lecteurs d'écran), sky (false : pas de ciel, vignettes),
 *        slot ('big' : grand cadre animé ; 'hero', 'card', 'thumb' : fixes).
 */
export function shipMarkup(typeId, opts = {}) {
  const { condition = 100, age = 0 } = opts;
  return pixelShipMarkup(typeId, { ...opts, wear: wearOf(typeId, condition, age), dmg: (100 - condition) / 100 });
}

export function artForShip(state, ship, extra = {}) {
  const c = state.companies[ship.owner];
  const age = (state.t - ship.builtT) / (24 * 365);
  return shipMarkup(ship.type, { condition: ship.condition, age, color: c.color, logo: c.logo, name: ship.name, laden: !!ship.cargo, seed: ship.id + ship.name, ...extra });
}
