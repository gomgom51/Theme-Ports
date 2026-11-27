// Population d'IA : plusieurs parties de quatre compagnies IA, ports d'attache variés, sans
// conditions de victoire (on mesure l'économie sur toute la durée). Une graine = une partie.
// Écrit un JSON par partie : compagnies (multiple de valeur nette, faillite, rachat, tempérament)
// et navires par modèle (net par navire-année, part du temps chargé / à vide / au port, achats).
// usage : node tools/balance/population.mjs --root <dossier du jeu> --seed 7 --years 5 [--out f.json]
// --root permet de mesurer une autre version du jeu (worktree git) avec le même outil.
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = resolve(arg('root', '.'));
const seed = Number(arg('seed', 1));
const years = Number(arg('years', 5));
const out = arg('out', null);
const mod = (p) => import(pathToFileURL(resolve(root, 'web/js', p)).href);

const { makeContext } = await mod('sim/context.js');
const { newGame, tick } = await mod('sim/game.js');
const { netWorth } = await mod('sim/core.js');
const { PORT_IDS } = await mod('data/ports.js');
const { SHIP_TYPES } = await mod('data/ships.js');
const { isSeasonal } = await mod('sim/ice.js');

// Ports d'attache : tous ceux où l'IA peut démarrer (pas les ports saisonniers), en ordre fixe ;
// la partie n° k prend quatre ports consécutifs, si bien que 24 graines couvrent chaque port.
const homesAll = PORT_IDS.filter((p) => !isSeasonal(p)).sort();
const homes = [0, 1, 2, 3].map((i) => homesAll[((seed - 1) * 4 + i) % homesAll.length]);
const ctx = makeContext();
const state = newGame({
  seed, duration: 0, difficulty: 'normal',
  victories: { domination: false, reputation: false, legend: false, shadow: false },
  companies: homes.map((h) => ({ name: 'IA ' + h, human: false, homePort: h })),
}, ctx);
const nw0 = state.companies.map((c) => netWorth(state, c.id));

// Suivi de chaque navire, y compris ceux vendus ou perdus en cours de route.
const ships = new Map();
const watch = () => {
  for (const s of state.ships) {
    const r = ships.get(s.id) || { type: s.type, owner: s.owner, months: 0, earned: 0, spent: 0, hours: {} };
    r.months++; r.earned = s.earned; r.spent = s.spent; r.hours = { ...(s.hours || {}) };
    ships.set(s.id, r);
  }
};
let nan = 0;
for (let m = 0; m < years * 12; m++) {
  tick(state, ctx, 730);
  watch();
  for (const c of state.companies) if (!Number.isFinite(c.cash)) nan++;
}
const byType = {};
for (const r of ships.values()) {
  const b = byType[r.type] ??= { category: SHIP_TYPES[r.type].category, ships: 0, shipYears: 0, net: 0, hours: { laden: 0, ballast: 0, port: 0, laidup: 0 } };
  b.ships++; b.shipYears += r.months / 12; b.net += r.earned - r.spent;
  for (const [k, v] of Object.entries(r.hours)) b.hours[k] = (b.hours[k] || 0) + v;
}
const res = {
  seed, years, homes, nan,
  wrecks: (state.wrecks || []).length,
  companies: state.companies.map((c, i) => ({
    home: c.homePort, leaning: c.ai?.leaning || 'neutre',
    multiple: netWorth(state, c.id) / nw0[i],
    bankrupt: !!c.bankrupt && !c.absorbed, absorbed: !!c.absorbed,
    ships: state.ships.filter((s) => s.owner === c.id).length,
  })),
  byType,
};
if (out) writeFileSync(out, JSON.stringify(res));
else console.log(JSON.stringify(res, null, 1));
