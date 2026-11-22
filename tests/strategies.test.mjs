// Équilibre des stratégies : quatre compagnies spécialisées dans le même marché
// (cargos, vrac, citernes, lignes et navires spécialisés), sur plusieurs graines.
// Aucune stratégie ne doit dominer : chacune doit gagner dans certains marchés.
import { makeContext } from '../web/js/sim/context.js';
import { newGame, tick } from '../web/js/sim/game.js';
import { netWorth, createShip } from '../web/js/sim/core.js';
import { Rng } from '../web/js/sim/util.js';
import * as eco from '../web/js/sim/economy.js';
import { SHIP_TYPES } from '../web/js/data/ships.js';

export const STRATEGIES = {
  cargos: ['caboteur', 'cargo_ancien', 'polyvalent', 'colis_lourds'],
  vrac: ['vraquier_handy', 'vraquier_supramax', 'vraquier_panamax', 'vraquier_capesize'],
  citernes: ['petrolier_ancien', 'petrolier_mr', 'chimiquier', 'petrolier_aframax', 'petrolier_suezmax', 'petrolier_vlcc', 'gazier', 'methanier'],
  lignes: ['feeder', 'frigorifique', 'porte_voitures', 'pc_panamax', 'pc_geant'],
};
const names = Object.keys(STRATEGIES);
const years = Number(process.argv[2] || 5);
const seeds = (process.argv[3] || '1,2,3,4,5,6,7,8').split(',').map(Number);
const ctx = makeContext();
const wins = Object.fromEntries(names.map((n) => [n, 0]));
const results = Object.fromEntries(names.map((n) => [n, []]));
for (const seed of seeds) {
  const home = seed % 2 ? 'rotterdam' : 'singapour';
  const state = newGame({ seed, duration: 0, difficulty: 'normal', companies: names.map((n) => ({ name: n, human: false, homePort: home })) }, ctx);
  const rng = new Rng(seed * 7919);
  state.companies.forEach((c, i) => {
    c.ai.pool = STRATEGIES[names[i]];
    // Premier navire : le moins cher de la spécialité, d'occasion (18 ans, 70 %).
    const typeId = [...c.ai.pool].sort((a, b) => SHIP_TYPES[a].price - SHIP_TYPES[b].price).find((t) => eco.servesType(home, t)) || c.ai.pool[0];
    const ship = createShip(state, rng, c.id, typeId, { port: home, age: 18, condition: 70 });
    ship.fuel = SHIP_TYPES[typeId].tank * 0.8;
    c.cash -= eco.shipValue(state, ship);
  });
  // Plus d'annonces d'occasion pour que chaque spécialité trouve des navires.
  for (let m = 0; m < years * 12; m++) tick(state, ctx, 730);
  const nw = state.companies.map((c) => netWorth(state, c.id) / 8e6);
  nw.forEach((v, i) => results[names[i]].push(v));
  wins[names[nw.indexOf(Math.max(...nw))]]++;
  console.log(`graine ${seed} (${home}) : ${names.map((n, i) => `${n} ×${nw[i].toFixed(1)}`).join(' · ')}`);
}
console.log('');
let bad = 0;
for (const n of names) {
  const v = [...results[n]].sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)];
  console.log(`${n.padEnd(9)} victoires ${wins[n]}/${seeds.length} · médiane ×${med.toFixed(1)} · min ×${v[0].toFixed(1)} · max ×${v[v.length - 1].toFixed(1)}`);
  if (wins[n] > seeds.length * 0.6) { console.log(`  → ${n} domine`); bad++; }
}
if (bad) process.exit(1);
