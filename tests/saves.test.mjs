// Les sauvegardes des versions publiées se chargent encore et la partie continue (tests/saves/*.json.gz).
// Une sauvegarde de joueur qui ne se charge plus après une mise à jour = une partie perdue : ce test le voit
// avant la publication. Ajouter une sauvegarde : tools/save-fixture.mjs ; règles : docs/code-health.md.
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, SAVE_VERSION } from '../web/js/sim/migrations.js';
import { makeContext } from '../web/js/sim/context.js';
import { tick } from '../web/js/sim/game.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'saves');
const DAYS = 60;
const ctx = makeContext();
let failed = 0;
const fail = (name, msg) => { failed++; console.log(`ÉCHEC ${name} : ${msg}`); };

const files = readdirSync(DIR).filter((f) => f.endsWith('.json.gz')).sort();
if (!files.length) { console.log('Aucune sauvegarde de test dans tests/saves/.'); process.exit(1); }

for (const f of files) {
  const raw = gunzipSync(readFileSync(join(DIR, f))).toString('utf8');
  let state;
  try { state = migrate(JSON.parse(raw)); } catch (e) { fail(f, `chargement : ${e.message}`); continue; }
  const from = JSON.parse(raw).version || 1;
  if (state.version !== SAVE_VERSION) fail(f, `version ${state.version} après mise à niveau (attendu ${SAVE_VERSION})`);
  // Une mise à niveau répétée ne change plus rien (chargement → sauvegarde → chargement).
  const once = JSON.stringify(state);
  if (JSON.stringify(migrate(JSON.parse(once))) !== once) fail(f, 'une deuxième mise à niveau modifie encore la partie');
  // La partie continue : deux mois de jeu sans erreur ni valeur absurde.
  try {
    for (let d = 0; d < DAYS && !state.over; d++) tick(state, ctx, 24);
  } catch (e) { fail(f, `partie reprise : ${e.stack?.split('\n').slice(0, 3).join(' | ')}`); continue; }
  for (const c of state.companies) {
    if (!Number.isFinite(c.cash) || !Number.isFinite(c.debt ?? 0) || !Number.isFinite(c.reputation)) fail(f, `${c.name} : valeur non numérique (argent ${c.cash}, réputation ${c.reputation})`);
  }
  for (const s of state.ships) if (!Number.isFinite(s.condition)) fail(f, `navire ${s.name} : état ${s.condition}`);
  // Elle s'enregistre de nouveau (aucune référence circulaire ni valeur impossible à écrire).
  try { JSON.stringify(state); } catch (e) { fail(f, `réenregistrement : ${e.message}`); }
  console.log(`${f} : version ${from} → ${state.version}, ${state.ships.length} navires, ${DAYS} jours rejoués`);
}

// Une très vieille sauvegarde (version 1, avant les champs ajoutés au fil des versions), recomposée à partir
// de la première : tout ce qui manque est rempli et la partie continue.
{
  const old = JSON.parse(gunzipSync(readFileSync(join(DIR, files[0]))).toString('utf8'));
  old.version = 1;
  for (const k of ['wrecks', 'payments', 'receivables', 'marketHistory', 'spills', 'offers', 'cases']) delete old[k];
  delete old.market.cycle;
  const [hold] = Object.keys(old.market.freight); delete old.market.freight[hold];
  const [good] = Object.keys(old.market.world); delete old.market.world[good];
  const [port] = Object.keys(old.ports); delete old.ports[port];
  for (const c of old.companies) { delete c.logo; delete c.bans; delete c.insurance; delete c.confidence; delete c.virtue; if (c.ai) delete c.ai.leaning; }
  for (const s of old.ships) if (s.voyage) s.voyage.closed = s.voyage.closed.filter((p) => p !== 'nsr');
  try {
    const state = migrate(old);
    if (!state.ports[port]?.[good] || state.market.freight[hold] == null || !state.companies.every((c) => c.logo && c.bans && c.insurance)) fail('version 1', 'champs manquants après mise à niveau');
    if (state.ships.some((s) => s.voyage && !s.voyage.closed.includes('nsr'))) fail('version 1', 'navire en mer sans le passage du Nord-Est fermé');
    for (let d = 0; d < 30 && !state.over; d++) tick(state, ctx, 24);
    if (state.companies.some((c) => !Number.isFinite(c.cash))) fail('version 1', 'argent non numérique');
    console.log('version 1 recomposée : chargée et rejouée');
  } catch (e) { fail('version 1', e.stack?.split('\n').slice(0, 3).join(' | ')); }
}

// Une sauvegarde d'une version plus récente du jeu est refusée avec un message clair, pas abîmée.
try { migrate({ version: SAVE_VERSION + 1, companies: [], ships: [], market: {} }); fail('version future', 'acceptée'); } catch (e) {
  if (!/plus récente/.test(e.message)) fail('version future', e.message);
}
// Un fichier qui n'est pas une sauvegarde est refusé.
for (const bad of [null, {}, { companies: [] }, 'texte']) {
  try { migrate(bad); fail('fichier invalide', JSON.stringify(bad)); } catch { /* attendu */ }
}

if (failed) { console.log(`\n${failed} problème(s) : une sauvegarde de joueur ne se chargerait plus. Ajoutez une étape dans web/js/sim/migrations.js.`); process.exit(1); }
console.log(`\n${files.length} sauvegarde(s) de test chargée(s) et rejouée(s).`);
