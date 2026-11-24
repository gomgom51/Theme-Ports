// Pré-calcule la table des distances entre ports (canaux ouverts) pour éviter
// de lancer tous les calculs de route au démarrage du jeu.
// Usage : node tools/build_distances.mjs   (à relancer après une modification des ports ou de la carte)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Router } from '../web/js/sim/routing.js';
import { PORT_IDS } from '../web/js/data/ports.js';

const router = new Router();
// Une table par combinaison de canaux fermés (événement ou tirant d'eau trop fort) :
// le jeu n'a plus jamais à recalculer une distance en cours de partie.
function build(closed) {
  const table = {};
  for (const a of PORT_IDS) {
    const routes = router.routesFrom(a, closed);
    table[a] = {};
    for (const b of PORT_IDS) if (b !== a) table[a][b] = routes[b] ? (routes[b].canals.length ? [Math.round(routes[b].nm), routes[b].canals] : Math.round(routes[b].nm)) : null;
  }
  return table;
}
const open = build([]);
// Tables des cas fermés : seulement les trajets qui changent (le reste est dans DISTANCES).
const diff = (t) => {
  const d = {};
  for (const a of PORT_IDS) for (const b of PORT_IDS) {
    if (a === b || JSON.stringify(t[a][b]) === JSON.stringify(open[a][b])) continue;
    (d[a] ??= {})[b] = t[a][b];
  }
  return d;
};
// Toutes les combinaisons de passages fermés (Nord-Est, Panama, Suez), clés triées.
const ids = ['nsr', 'panama', 'suez'];
const closedTables = {};
for (let m = 1; m < 1 << ids.length; m++) {
  const closed = ids.filter((_, k) => m & (1 << k));
  closedTables[closed.join(',')] = diff(build(closed));
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'js', 'data', 'distances.js');
writeFileSync(out, `// Généré par tools/build_distances.mjs. Milles nautiques, ou [milles, passages empruntés].
// DISTANCES : tout ouvert ; DISTANCES_CLOSED : par passages fermés (« nsr », « panama », « suez »,
// « nsr,panama »…), seulement les trajets qui changent (null : plus de route).
export const DISTANCES = ${JSON.stringify(open)};
export const DISTANCES_CLOSED = ${JSON.stringify(closedTables)};
`);
console.log('wrote', out);
