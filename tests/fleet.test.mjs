// Rentabilité de chaque modèle : une compagnie IA, un seul navire (neuf, ou très
// âgé pour les modèles anciens), deux ans d'exploitation. Le navire doit gagner de l'argent.
// D'abord avec les seuls contrats ; s'il n'y arrive pas, avec le négoce et une trésorerie
// de fin de partie (cas des géants : un ULCC vit du pétrole qu'il achète et revend).
import { makeContext } from '../web/js/sim/context.js';
import { newGame, tick } from '../web/js/sim/game.js';
import { createShip } from '../web/js/sim/core.js';
import { Rng } from '../web/js/sim/util.js';
import { SHIP_TYPES } from '../web/js/data/ships.js';
import { PORTS, PORT_IDS } from '../web/js/data/ports.js';
import * as eco from '../web/js/sim/economy.js';

const years = Number(process.argv[2] || 2);
const seeds = [11, 22, 33, 44];
const ctx = makeContext();
let failures = 0;
function run(typeId, trade) {
  const T = SHIP_TYPES[typeId];
  const results = [];
  for (const seed of seeds) {
    // Port de départ : le plus grand exportateur d'une marchandise que le navire sait porter.
    const home = PORT_IDS.filter((p) => eco.servesType(p, typeId) && Object.keys(PORTS[p].exp).some((g) => eco.holdFor(typeId, g) && eco.portHandles(p, eco.holdFor(typeId, g))))
      .sort((a, b) => PORTS[b].size - PORTS[a].size)[0];
    const state = newGame({ seed, duration: 0, difficulty: 'normal', companies: [{ name: 'Test', human: false, homePort: home }] }, ctx);
    const company = state.companies[0];
    company.cash = trade ? 400e6 : 30e6;
    company.ai.nextFleet = Infinity; // pas d'achats
    company.ai.noTrade = !trade;
    const rng = new Rng(seed);
    const ship = createShip(state, rng, 0, typeId, { port: home, age: T.vintage ? 34 : 0 });
    ship.fuel = T.tank * 0.8;
    // Marché maintenu dans un cycle « normal » : on mesure le navire, pas la chance.
    for (let m = 0; m < years * 12; m++) { state.market.cycle = 0; tick(state, ctx, 730); }
    const h = ship.hours || {}, tot = Object.values(h).reduce((a, b) => a + b, 0) || 1;
    results.push({ net: (ship.earned - ship.spent) / years, laden: (h.laden || 0) / tot, gone: !state.ships.includes(ship) });
  }
  return results;
}

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [typeId, T] of Object.entries(SHIP_TYPES)) {
  if (only && !only.includes(typeId)) continue;
  let results = run(typeId, false), mode = 'contrats';
  if (results.reduce((s, r) => s + r.net, 0) <= 0) { results = run(typeId, true); mode = 'négoce'; }
  const net = results.reduce((s, r) => s + r.net, 0) / results.length;
  const laden = results.reduce((s, r) => s + r.laden, 0) / results.length;
  // Rendement annuel net, rapporté au prix neuf (ou au prix d'occasion pour les anciens).
  const capital = T.vintage ? T.price * 1e6 * 0.15 : T.price * 1e6;
  const roi = net / capital;
  const ok = net > 0;
  if (!ok) failures++;
  console.log(`${ok ? 'ok ' : 'NON'} ${typeId.padEnd(18)} net ${(net / 1e6).toFixed(1).padStart(6)} M$/an  rendement ${(roi * 100).toFixed(0).padStart(4)} %  chargé ${(laden * 100).toFixed(0)} %  (${mode})${results.some((r) => r.gone) ? '  (perdu/vendu)' : ''}`);
}
if (failures) { console.log(`${failures} modèle(s) non rentable(s)`); process.exit(1); }
