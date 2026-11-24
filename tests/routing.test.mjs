// Vérifie les distances calculées contre des distances réelles approximatives.
import { Router } from '../web/js/sim/routing.js';
const t0 = Date.now();
const r = new Router();
console.log('init', Date.now() - t0, 'ms');
const cases = [
  ['rotterdam', 'new_york', [], 3450],
  ['rotterdam', 'singapour', [], 8300],
  ['rotterdam', 'singapour', ['suez', 'nsr'], 11700], // par le Cap (passage du Nord-Est pris par les glaces)
  ['shanghai', 'los_angeles', [], 5700],
  ['new_york', 'los_angeles', [], 4950],
  ['new_york', 'los_angeles', ['panama', 'nsr'], 13100],
  ['port_hedland', 'shanghai', [], 3380],
  ['santos', 'shanghai', [], 11000],
  ['houston', 'rotterdam', [], 5000],
  ['ras_tanura', 'singapour', [], 3650],
  ['marseille', 'piree', [], 1080],
  ['le_havre', 'hambourg', [], 470],
  ['singapour', 'yokohama', [], 2900],
  ['vancouver', 'yokohama', [], 4250],
  ['alexandrie', 'djeddah', [], 890],
  ['piree', 'alexandrie', [], 520],
  ['lagos', 'rotterdam', [], 4300],
  ['buenos_aires', 'santos', [], 1000],
  ['colon', 'los_angeles', [], 2950],
  ['mumbai', 'dubai', [], 1050],
  // Nouveaux ports et Arctique (passage du Nord-Est ouvert en été).
  ['rotterdam', 'shanghai', ['nsr'], 10500],
  ['rotterdam', 'shanghai', [], 8000],
  ['rotterdam', 'murmansk', [], 1700],
  ['rotterdam', 'churchill', [], 3400],
  ['novorossiysk', 'piree', [], 830],
  ['chittagong', 'singapour', [], 1500],
  ['haifa', 'piree', [], 670],
  ['vladivostok', 'busan', [], 540],
  ['valdez', 'los_angeles', [], 1950],
];
let bad = 0;
for (const [a, b, closed, real] of cases) {
  const t = Date.now();
  const rt = r.route(a, b, closed);
  const ms = Date.now() - t;
  const nm = rt ? Math.round(rt.nm) : null;
  const err = rt ? (nm - real) / real : 1;
  const ok = Math.abs(err) < 0.12;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${a} -> ${b} ${closed.join(',') ? '(sans ' + closed + ')' : ''}: ${nm} nm (réel ~${real}, ${(err * 100).toFixed(1)} %) canaux=${rt?.canals} pts=${rt?.points.length} ${ms}ms`);
}
const unreachable = [];
for (const a of Object.keys(r.portCell)) for (const [b, rt] of Object.entries(r.routesFrom(a))) if (!rt) unreachable.push(a + '->' + b);
console.log('inaccessibles:', unreachable.length ? unreachable.join(' ') : 'aucun');
if (bad || unreachable.length) process.exit(1);
