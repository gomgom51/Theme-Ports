// Mise à niveau des sauvegardes : le seul endroit où une partie enregistrée par une version précédente
// du jeu est remise au format actuel (ui/save.js : chargement et import de fichier).
// Règles (docs/code-health.md) :
// - un champ ajouté à l'état enregistré (partie, compagnie, navire…) reçoit sa valeur dans newGame
//   ET une ligne dans fillDefaults ci-dessous, pour les parties déjà en cours ;
// - une transformation qui ne se résume pas à « remplir ce qui manque » (champ renommé, unité changée,
//   donnée déplacée) devient une étape numérotée de STEPS, et SAVE_VERSION monte d'un cran ;
// - tests/saves.test.mjs charge les sauvegardes de tests/saves/ (vraies parties des versions publiées)
//   à chaque test : avant de changer le format, en ajouter une faite par la version publiée
//   (tools/save-fixture.mjs).
import { Rng } from './util.js';
import { standing } from './core.js';
import { AI_LEANINGS } from './ai.js';
import * as eco from './economy.js';
import { GOODS } from '../data/goods.js';
import { PORT_IDS } from '../data/ports.js';

export const SAVE_VERSION = 3;

// Étapes numérotées : STEPS[n] amène une sauvegarde de la version n − 1 à la version n.
const STEPS = {
  // Version 3 : passage du Nord-Est. Les navires déjà en mer gardent leur route (passage fermé pour eux).
  3: (state) => {
    for (const s of state.ships) if (s.voyage && !s.voyage.closed.includes('nsr')) s.voyage.closed.push('nsr');
  },
};

// Ce qui manque est rempli, à chaque chargement (sans effet sur une partie à jour) : champs ajoutés au fil
// des versions, et nouvelles données du jeu (marchandises, ports, types de fret) absentes de la partie.
function fillDefaults(state) {
  const rng = new Rng((state.seed ^ 0x9e3779b9) >>> 0);
  state.wrecks ??= [];
  state.payments ??= [];
  state.receivables ??= [];
  state.marketHistory ??= [];
  state.spills ??= [];
  state.offers ??= [];
  state.cases ??= [];
  state.lots ??= []; // lots soldés (sim/trade.js)
  state.yardSale ??= null; // chantier en mal de commandes (sim/events.js)
  state.followUps ??= []; // fins d'histoires des événements (sim/events.js)
  for (const c of state.contracts) c.express ??= false; // affaire en or express
  state.market.cycle ??= 0;
  const logos = ['ancre', 'phare', 'barre', 'rose']; // les emblèmes de l'époque (avant le choix du logo)
  state.companies.forEach((c, i) => {
    c.logo ||= logos[i % logos.length];
    standing(c); // confiance et vertu
    c.bans ??= {};
    c.insurance ??= 'complete';
    c.mutedOpps ??= {}; // genres d'opportunités masqués (ui/opps.js)
    if (c.ai && !c.ai.leaning) c.ai.leaning = AI_LEANINGS[c.id % AI_LEANINGS.length];
  });
  for (const s of state.ships) { s.orders ??= null; s.captainLimits ??= null; s.lotBuy ??= null; } // ordres permanents (sim/orders.js), lot soldé à acheter
  for (const h of eco.HOLD_TYPES) state.market.freight[h] ??= rng.range(1.18, 1.42);
  for (const g of Object.keys(GOODS)) state.market.world[g] ??= rng.range(0.94, 1.06);
  for (const p of PORT_IDS) {
    state.ports[p] ??= {};
    for (const g of Object.keys(GOODS)) state.ports[p][g] ??= { ou: 0, imp: 0, stock: eco.stockCap(p, g) * rng.range(0.4, 0.9) };
  }
}

// Vérifie une sauvegarde lue (fichier ou stockage) et la met au format actuel ; lève une erreur lisible sinon.
export function migrate(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.companies) || !state.market || !Array.isArray(state.ships)) {
    throw new Error('Fichier de sauvegarde invalide.');
  }
  const from = state.version || 1;
  if (from > SAVE_VERSION) throw new Error('Sauvegarde créée par une version plus récente du jeu.');
  for (let v = from + 1; v <= SAVE_VERSION; v++) STEPS[v]?.(state);
  fillDefaults(state);
  state.version = SAVE_VERSION;
  return state;
}
