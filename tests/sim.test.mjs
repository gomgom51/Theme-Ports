// Fait jouer des compagnies IA plusieurs années et vérifie que l'économie tient debout.
import { makeContext } from '../web/js/sim/context.js';
import { newGame, tick, ranking } from '../web/js/sim/game.js';
import { netWorth, shipsOf, bookTotal } from '../web/js/sim/core.js';
import { SHIP_TYPES } from '../web/js/data/ships.js';
import { worldFuelPrice } from '../web/js/sim/economy.js';

const years = Number(process.argv[2] || 3);
const seed = Number(process.argv[3] || 12345);
const ctx = makeContext();
const homes = ['rotterdam', 'singapour', 'houston', 'piree'];
const state = newGame({
  seed, duration: 0, difficulty: 'normal',
  companies: homes.map((h, i) => ({ name: 'IA ' + h, human: false, homePort: h })),
}, ctx);

const t0 = Date.now();
let bad = 0;
for (let m = 0; m < years * 12; m++) {
  tick(state, ctx, 730);
  for (const c of state.companies) {
    if (!Number.isFinite(c.cash) || !Number.isFinite(c.reputation)) { console.log('NaN!', c.name, c.cash); bad++; }
  }
  if (m % 6 === 5) {
    const line = state.companies.map((c) => `${c.name.slice(3, 9)} nw=${(netWorth(state, c.id) / 1e6).toFixed(1)} cash=${(c.cash / 1e6).toFixed(1)} debt=${(c.debt / 1e6).toFixed(1)} ships=${shipsOf(state, c.id).length} rep=${c.reputation.toFixed(0)} deliv=${c.delivered}/${c.late}${c.bankrupt ? ' FAILLITE' : ''}`).join(' | ');
    console.log(`mois ${m + 1} fuel=${worldFuelPrice(state).toFixed(0)} storms=${state.storms.length} contrats=${state.contracts.length}\n  ${line}`);
  }
}
const ms = Date.now() - t0;
console.log(`\n${years} ans simulés en ${ms} ms (${(ms / (years * 365)).toFixed(2)} ms/jour)`);
for (const c of state.companies) {
  const tot = Object.entries(c.total).filter(([, v]) => v).map(([k, v]) => `${k}:${(v / 1e6).toFixed(1)}`).join(' ');
  console.log(c.name, '|', tot, '| P&L', (bookTotal(c.total) / 1e6).toFixed(1));
}
const byType = {};
for (const s of state.ships) {
  const k = s.type; byType[k] ??= { n: 0, earned: 0, spent: 0, h: { laden: 0, ballast: 0, port: 0, laidup: 0 } };
  byType[k].n++; byType[k].earned += s.earned; byType[k].spent += s.spent;
  for (const [hk, hv] of Object.entries(s.hours || {})) byType[k].h[hk] += hv;
}
for (const [k, v] of Object.entries(byType)) {
  const tot = Object.values(v.h).reduce((a, b) => a + b, 0) || 1;
  console.log(`  ${k}: chargé ${(v.h.laden / tot * 100).toFixed(0)} % | à vide ${(v.h.ballast / tot * 100).toFixed(0)} % | port ${(v.h.port / tot * 100).toFixed(0)} %`);
}
console.log('par type:', Object.entries(byType).map(([k, v]) => `${k} n=${v.n} net=${((v.earned - v.spent) / 1e6 / v.n).toFixed(1)}M/navire`).join(' | '));
console.log('naufrages:', (state.wrecks || []).length, 'news:', state.news.slice(0, 6).map((n) => n.text.slice(0, 90)));
console.log('classement:', ranking(state).map((r) => `${r.company.name} ${(r.worth / 1e6).toFixed(1)}M`).join(', '));
if (bad) process.exit(1);
