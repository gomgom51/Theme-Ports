// Pré-calcule la table des distances entre ports (canaux ouverts) pour éviter
// de lancer tous les calculs de route au démarrage du jeu.
// Usage : node tools/build_distances.mjs   (à relancer après une modification des ports ou de la carte)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Router } from '../web/js/sim/routing.js';
import { PORT_IDS } from '../web/js/data/ports.js';

const router = new Router();
const table = {};
for (const a of PORT_IDS) {
  const routes = router.routesFrom(a);
  table[a] = {};
  for (const b of PORT_IDS) if (b !== a) table[a][b] = routes[b] ? [Math.round(routes[b].nm), routes[b].canals] : null;
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'js', 'data', 'distances.js');
writeFileSync(out, `// Généré par tools/build_distances.mjs. [milles nautiques, canaux empruntés], canaux ouverts.\nexport const DISTANCES = ${JSON.stringify(table)};\n`);
console.log('wrote', out);
