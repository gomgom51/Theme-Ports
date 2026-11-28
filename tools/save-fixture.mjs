// Fabrique une sauvegarde de test pour tests/saves/ : une partie jouée par l'IA (dont une compagnie « humaine »
// qu'elle conduit), enregistrée comme le jeu l'enregistre (JSON de l'état), compressée.
// Usage : node tools/save-fixture.mjs <nom> [années = 1] [racine du jeu = ce dépôt]
//
// Quand le format des sauvegardes change (docs/code-health.md), fabriquer d'abord une sauvegarde avec la
// version publiée, par exemple depuis un git worktree de main :
//   git worktree add /tmp/pda-main origin/main
//   node tools/save-fixture.mjs v3-main 1 /tmp/pda-main
// tests/saves.test.mjs vérifie ensuite, à chaque test, que ces parties se chargent et continuent.
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
if (!name) { console.error('Usage : node tools/save-fixture.mjs <nom> [années] [racine du jeu]'); process.exit(2); }
const years = Number(process.argv[3] || 1);
const root = resolve(process.argv[4] || HERE);
const sim = (f) => import(pathToFileURL(join(root, 'web/js/sim', f)).href);

const { makeContext } = await sim('context.js');
const { newGame, tick } = await sim('game.js');
const { aiShipIdle } = await sim('ai.js');
const { Rng } = await sim('util.js');
const { isIdle, shipsOf } = await sim('core.js');

const ctx = makeContext();
const state = newGame({
  seed: 2027, duration: 0, difficulty: 'normal',
  companies: [
    { name: 'Armement du Ponant', human: true, homePort: 'rotterdam' },
    { name: 'Compagnie des Îles', human: false, homePort: 'singapour' },
    { name: 'Houston Marine', human: false, homePort: 'houston' },
    { name: 'Bandar Ombre', human: false, homePort: 'bandar_abbas' },
  ],
}, ctx);
// La compagnie « humaine » reçoit quelques navires des IA ; l'IA la conduit navire par navire.
const rng = new Rng(7);
for (let d = 0; d < years * 365 && !state.over; d++) {
  tick(state, ctx, 24);
  const me = state.companies[0];
  if (d % 30 === 0 && shipsOf(state, 0).length < 4) {
    const give = state.ships.find((s) => s.owner !== 0 && isIdle(s) && shipsOf(state, s.owner).length > 1);
    if (give) give.owner = 0;
  }
  if (me.cash < 2e6) me.cash = 2e6;
  for (const ship of shipsOf(state, 0)) if (isIdle(ship)) aiShipIdle(state, ctx, rng, ship);
}
const out = join(HERE, 'tests/saves', `${name}.json.gz`);
mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify(state);
writeFileSync(out, gzipSync(json, { level: 9 }));
console.log(`${out} : version ${state.version}, ${state.ships.length} navires, ${(json.length / 1e6).toFixed(1)} Mo (${(gzipSync(json, { level: 9 }).length / 1e3).toFixed(0)} ko compressé)`);
