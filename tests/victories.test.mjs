// Victoires : quand la première victoire tombe-t-elle, et laquelle ? Parties entre IA (une par
// tempérament : bâtisseur, vertueux, conquérant, ombre), arrêtées à la première victoire.
// Objectif d'équilibrage : une victoire difficile mais atteignable vers dix ans en moyenne ; chaque
// chemin gagne parfois ; aucun ne l'emporte toujours (règle n° 3).
// usage : node tests/victories.test.mjs [années=12] [graines=1,2,3,4,5,6,7,8]
import { makeContext } from '../web/js/sim/context.js';
import { newGame, tick } from '../web/js/sim/game.js';
import { VICTORY_KINDS, victoryProgress } from '../web/js/sim/victory.js';
import { deedCount, recordsHeld } from '../web/js/sim/honours.js';
import { HOME } from '../web/js/sim/home.js';

const years = Number(process.argv[2] || 12);
const seeds = (process.argv[3] || '1,2,3,4,5,6,7,8').split(',').map(Number);
// HOMES=a,b,c,d : autres ports d'attache ; HOME_OFF=1 : sans les avantages du port (comparaison).
const homes = (process.env.HOMES || 'rotterdam,singapour,houston,piree').split(',');
if (process.env.HOME_OFF) HOME.off = true;
const ctx = makeContext();
const out = [];
for (const seed of seeds) {
  const st = newGame({ seed, duration: 0, difficulty: 'normal', companies: homes.map((h) => ({ name: h, human: false, homePort: h })) }, ctx);
  let at10 = null;
  for (let m = 0; m < years * 12 && !st.over; m++) {
    tick(st, ctx, 730);
    if (m === 119) at10 = snapshot(st);
  }
  const win = st.over?.kind ? { kind: st.over.kind, y: st.over.t / (365 * 24), leaning: st.companies[st.over.winner].ai?.leaning } : null;
  const snap = at10 || snapshot(st);
  out.push({ seed, win, snap });
  console.log(`graine ${seed} : ${win ? `${win.kind} en ${win.y.toFixed(1)} ans (${win.leaning})` : `aucune victoire en ${years} ans`} | à 10 ans (ou à la fin) : ${snap.text}`);
}
function snapshot(st) {
  const best = {};
  for (const k of VICTORY_KINDS) for (const c of st.companies) {
    if (c.bankrupt) continue;
    const f = victoryProgress(st, c, k).frac;
    if (!best[k] || f > best[k].f) best[k] = { f, who: c.ai?.leaning };
  }
  const extra = st.companies.map((c) => `${c.ai?.leaning}${c.bankrupt ? (c.absorbed ? '(rachetée)' : '(faillite)') : ''}:${deedCount(c)}hf/${recordsHeld(st, c.id).length}r${c.blacklisted ? '/LN' : ''}`).join(' ');
  return { best, text: `${VICTORY_KINDS.map((k) => `${k} ${Math.round((best[k]?.f || 0) * 100)} %`).join(', ')} | ${extra}` };
}
const wins = out.filter((o) => o.win);
const ys = wins.map((o) => o.win.y).sort((a, b) => a - b);
const by10 = wins.filter((o) => o.win.y <= 10).length;
console.log(`\n${wins.length}/${out.length} parties gagnées en ${years} ans, dont ${by10} avant 10 ans ; médiane ${ys.length ? ys[Math.floor(ys.length / 2)].toFixed(1) : '—'} ans`);
console.log('par chemin :', VICTORY_KINDS.map((k) => `${k} ${wins.filter((o) => o.win.kind === k).length}`).join(', '));
