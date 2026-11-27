// Comparaison d'équilibre entre versions du jeu : lance les mêmes simulations, sur les mêmes graines,
// pour chaque version (branche, PR, ou combinaison de branches) et écrit un rapport lisible.
// Mode d'emploi complet : docs/balance/README.md.
//
// usage : node tools/balance/compare.mjs --ref main=origin/main --ref pr5=origin/branche-pr5 \
//           [--ref bundle=origin/main+origin/b1+origin/b2] [--suite quick|full] [--only pop,strat,fleet,vic]
//           [--jobs 4] [--out docs/balance/reports/2026-11-27-pr5]
// La première --ref est la référence ; « a+b+c » = a avec b et c fusionnées (comme un bundle de release).
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { cpus, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const argv = process.argv.slice(2);
const args = (k) => argv.flatMap((a, i) => (a === '--' + k ? [argv[i + 1]] : []));
const one = (k, d) => args(k)[0] ?? d;
const refs = args('ref').map((r) => { const [name, spec] = r.includes('=') ? r.split('=') : [r, r]; return { name, spec }; });
if (refs.length < 1) { console.error('Au moins une --ref nom=branche'); process.exit(1); }
const suiteName = one('suite', 'quick');
const jobsN = Number(one('jobs', cpus().length));
const out = resolve(repo, one('out', `docs/balance/reports/${new Date().toISOString().slice(0, 10)}-${refs.map((r) => r.name).join('-vs-')}`));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Suites : « quick » pour un premier regard (~5 min par version sur 4 cœurs), « full » pour décider.
const SUITES = {
  quick: { pop: { seeds: range(1, 12), years: 3 }, strat: { seeds: range(1, 8), years: 3 }, fleet: { years: 1 }, vic: { seeds: range(1, 8), years: 12 } },
  smoke: { pop: { seeds: [1, 2], years: 1 }, strat: { seeds: [1], years: 1 }, fleet: { years: 1 }, vic: { seeds: [1], years: 1 } }, // vérifie l'outil lui-même
  full: { pop: { seeds: range(1, 24), years: 5 }, strat: { seeds: range(1, 16), years: 5 }, fleet: { years: 2 }, vic: { seeds: range(1, 16), years: 14 } },
};
const suite = SUITES[suiteName];
const only = one('only', 'pop,strat,fleet,vic').split(',');

// ---------- Versions : un worktree git détaché par version ----------
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const wtRoot = join(tmpdir(), 'pda-balance');
mkdirSync(wtRoot, { recursive: true });
for (const r of refs) {
  const parts = r.spec.split('+');
  const shas = parts.map((p) => git(repo, 'rev-parse', p));
  r.shas = shas;
  r.dir = join(wtRoot, r.name);
  if (existsSync(r.dir)) { try { git(repo, 'worktree', 'remove', '--force', r.dir); } catch { rmSync(r.dir, { recursive: true, force: true }); } }
  git(repo, 'worktree', 'prune');
  git(repo, 'worktree', 'add', '--detach', r.dir, shas[0]);
  for (const s of shas.slice(1)) {
    try { git(r.dir, '-c', 'user.name=balance', '-c', 'user.email=balance@local', 'merge', '--no-edit', '--no-ff', s); }
    catch (e) { console.error(`Conflit en fusionnant ${s} dans ${r.name} : à résoudre à la main.`); process.exit(1); }
  }
  console.log(`${r.name} : ${parts.map((p, i) => `${p}@${shas[i].slice(0, 7)}`).join(' + ')}`);
}

// ---------- Tâches ----------
const tasks = [];
for (const r of refs) {
  if (only.includes('pop')) for (const seed of suite.pop.seeds) tasks.push({ r, kind: 'pop', key: seed, cmd: [join(here, 'population.mjs'), '--root', r.dir, '--seed', seed, '--years', suite.pop.years] });
  if (only.includes('strat')) for (const seed of suite.strat.seeds) tasks.push({ r, kind: 'strat', key: seed, cmd: ['tests/strategies.test.mjs', suite.strat.years, seed] });
  if (only.includes('vic')) for (const seed of suite.vic.seeds) tasks.push({ r, kind: 'vic', key: seed, cmd: ['tests/victories.test.mjs', suite.vic.years, seed] });
  if (only.includes('fleet')) {
    const types = Object.keys((await import(join(r.dir, 'web/js/data/ships.js'))).SHIP_TYPES);
    for (const t of types) tasks.push({ r, kind: 'fleet', key: t, cmd: ['tests/fleet.test.mjs', suite.fleet.years], env: { ONLY: t } });
  }
}
// Les plus longues d'abord (victoires), pour bien remplir les cœurs.
const weight = { vic: 4, pop: 2, strat: 2, fleet: 1 };
tasks.sort((a, b) => weight[b.kind] - weight[a.kind]);
let done = 0;
const t0 = Date.now();
function run(t) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, t.cmd.map(String), { cwd: t.r.dir, env: { ...process.env, ...(t.env || {}) } });
    let so = '', se = '';
    p.stdout.on('data', (d) => (so += d)); p.stderr.on('data', (d) => (se += d));
    p.on('close', (code) => { t.out = so; t.err = se; t.code = code; done++; process.stdout.write(`\r${done}/${tasks.length} simulations (${Math.round((Date.now() - t0) / 1000)} s)   `); ok(); });
  });
}
const queue = [...tasks];
await Promise.all(Array.from({ length: jobsN }, async () => { while (queue.length) await run(queue.shift()); }));
console.log('');

// ---------- Lecture des sorties ----------
const R = {};
for (const r of refs) R[r.name] = { pop: [], strat: [], vic: [], fleet: {}, errors: [] };
for (const t of tasks) {
  const D = R[t.r.name];
  const fail = (why) => D.errors.push(`${t.kind} ${t.key} : ${why}${t.err ? ' — ' + t.err.trim().split('\n').slice(-3).join(' / ') : ''}`);
  if (t.kind === 'pop') { try { D.pop.push(JSON.parse(t.out)); } catch { fail('sortie illisible'); } }
  if (t.kind === 'strat') {
    const m = t.out.match(/graine (\d+) \((\w+)\) : (.*)/);
    if (!m) { fail('sortie illisible'); continue; }
    const nw = Object.fromEntries([...m[3].matchAll(/(\w+) ×(-?[\d.]+)/g)].map((x) => [x[1], Number(x[2])]));
    D.strat.push({ seed: t.key, home: m[2], nw });
  }
  if (t.kind === 'vic') {
    const m = t.out.match(/graine (\d+) : (?:(\w+) en ([\d.]+) ans \((\w*)\)|aucune victoire)/);
    if (!m) { fail('sortie illisible'); continue; }
    D.vic.push({ seed: t.key, kind: m[2] || null, years: m[3] ? Number(m[3]) : null, leaning: m[4] || null });
  }
  if (t.kind === 'fleet') {
    const m = t.out.match(/(ok |NON) (\S+)\s+net\s+(-?[\d.]+) M\$\/an\s+rendement\s+(-?\d+) %\s+chargé (\d+) %\s+\((\S+)\)(.*)/);
    if (!m) { fail('sortie illisible'); continue; }
    D.fleet[m[2]] = { ok: m[1] === 'ok ', net: Number(m[3]), roi: Number(m[4]), laden: Number(m[5]), mode: m[6], lost: m[7].includes('perdu') };
  }
}

// ---------- Rapport ----------
const q = (v, p) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : '–');
const base = refs[0].name;
const names = refs.map((r) => r.name);
const delta = (a, b, fmt = f1) => (Number.isFinite(a) && Number.isFinite(b) ? ` (${a - b >= 0 ? '+' : ''}${fmt(a - b)})` : '');
const L = [];
L.push(`# Comparaison d'équilibre : ${names.join(' / ')}`, '');
L.push(`Suite **${suiteName}**, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, ${Math.round((Date.now() - t0) / 60000)} min sur ${jobsN} cœurs. Mêmes graines pour chaque version : les écarts viennent des changements de code, mais une modification qui touche la suite aléatoire rebat aussi les parties (regarder les médianes et le nombre de graines où l'écart va dans le même sens, pas une graine isolée).`, '');
for (const r of refs) L.push(`- **${r.name}** : \`${r.spec}\` (${r.shas.map((s) => s.slice(0, 7)).join(' + ')})`);
L.push('');
for (const n of names) if (R[n].errors.length) L.push(`⚠️ ${n} : ${R[n].errors.length} simulation(s) en erreur : ${R[n].errors.slice(0, 5).join(' ; ')}`, '');

if (only.includes('pop')) {
  L.push(`## Population d'IA (${suite.pop.seeds.length} parties × 4 compagnies, ${suite.pop.years} ans, victoires coupées)`, '');
  L.push('Multiple = valeur nette finale / valeur nette de départ. Une ligne par version, écart à la référence entre parenthèses.', '');
  L.push('| Version | Médiane | 10 % les plus bas | 10 % les plus hauts | Faillites | Rachetées | Naufrages | NaN |', '|---|---|---|---|---|---|---|---|');
  const popStats = {};
  for (const n of names) {
    const cs = R[n].pop.flatMap((g) => g.companies);
    const alive = cs.filter((c) => !c.bankrupt && !c.absorbed).map((c) => c.multiple);
    popStats[n] = { med: q(alive, 0.5), p10: q(alive, 0.1), p90: q(alive, 0.9) };
    const s = popStats[n], b = popStats[base];
    L.push(`| ${n} | ×${f1(s.med)}${n === base ? '' : delta(s.med, b.med)} | ×${f1(s.p10)}${n === base ? '' : delta(s.p10, b.p10)} | ×${f1(s.p90)}${n === base ? '' : delta(s.p90, b.p90)} | ${cs.filter((c) => c.bankrupt).length} | ${cs.filter((c) => c.absorbed).length} | ${R[n].pop.reduce((a, g) => a + g.wrecks, 0)} | ${R[n].pop.reduce((a, g) => a + g.nan, 0)} |`);
  }
  // Paires : même graine, même compagnie.
  for (const n of names.slice(1)) {
    let up = 0, down = 0;
    for (const g of R[n].pop) {
      const gb = R[base].pop.find((x) => x.seed === g.seed); if (!gb) continue;
      g.companies.forEach((c, i) => { const d = c.multiple - gb.companies[i].multiple; if (d > 0.05 * gb.companies[i].multiple) up++; else if (d < -0.05 * gb.companies[i].multiple) down++; });
    }
    L.push('', `${n} contre ${base}, compagnie par compagnie (même graine) : mieux de plus de 5 % pour ${up}, moins bien pour ${down}, le reste à ±5 %.`);
  }
  L.push('', '### Par tempérament (médiane des survivantes)', '', `| Tempérament | ${names.join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
  const leanings = [...new Set(names.flatMap((n) => R[n].pop.flatMap((g) => g.companies.map((c) => c.leaning))))].sort();
  for (const l of leanings) L.push(`| ${l} | ${names.map((n) => { const v = R[n].pop.flatMap((g) => g.companies).filter((c) => c.leaning === l && !c.bankrupt && !c.absorbed).map((c) => c.multiple); return `×${f1(q(v, 0.5))} (${v.length})`; }).join(' | ')} |`);
  // Par modèle et par catégorie.
  const agg = (n, keyOf) => {
    const o = {};
    for (const g of R[n].pop) for (const [t, b] of Object.entries(g.byType)) {
      const k = keyOf(t, b); const a = o[k] ??= { ships: 0, shipYears: 0, net: 0, hours: { laden: 0, ballast: 0, port: 0, laidup: 0 } };
      a.ships += b.ships; a.shipYears += b.shipYears; a.net += b.net; for (const [h, v] of Object.entries(b.hours)) a.hours[h] = (a.hours[h] || 0) + v;
    }
    return o;
  };
  const table = (title, keyOf) => {
    L.push('', `### ${title}`, '', 'Net = gains − dépenses du navire, en M$ par navire-année. Port = part du temps à quai (manutention, attente). Navires = nombre de navires de ce type passés dans les flottes (choix de l\'IA).', '');
    L.push(`| Type | ${names.map((n) => `${n} : net / chargé / port / navires`).join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
    const A = Object.fromEntries(names.map((n) => [n, agg(n, keyOf)]));
    const keys = [...new Set(names.flatMap((n) => Object.keys(A[n])))].sort((a, b) => (A[base][b]?.shipYears || 0) - (A[base][a]?.shipYears || 0));
    for (const k of keys) {
      L.push(`| ${k} | ${names.map((n) => {
        const a = A[n][k]; if (!a) return '–';
        const tot = Object.values(a.hours).reduce((x, y) => x + y, 0) || 1;
        const net = a.net / 1e6 / Math.max(a.shipYears, 0.01), b = A[base][k];
        const bnet = b ? b.net / 1e6 / Math.max(b.shipYears, 0.01) : NaN;
        return `${f1(net)}${n === base ? '' : delta(net, bnet)} / ${f0(a.hours.laden / tot * 100)} % / ${f0(a.hours.port / tot * 100)} % / ${a.ships}`;
      }).join(' | ')} |`);
    }
  };
  table('Par catégorie de navire', (t, b) => b.category);
  table('Par modèle de navire', (t) => t);
}

if (only.includes('strat')) {
  L.push('', `## Stratégies (${suite.strat.seeds.length} marchés, ${suite.strat.years} ans, quatre compagnies spécialisées)`, '', 'Victoires = marchés où la stratégie finit première. Règle n° 3 : aucune ne doit gagner plus de 60 % des marchés.', '');
  const strats = Object.keys(R[base].strat[0]?.nw || {});
  L.push(`| Stratégie | ${names.map((n) => `${n} : victoires · médiane`).join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
  for (const s of strats) L.push(`| ${s} | ${names.map((n) => { const st = R[n].strat; const wins = st.filter((x) => Object.entries(x.nw).sort((a, b) => b[1] - a[1])[0][0] === s).length; return `${wins}/${st.length} · ×${f1(q(st.map((x) => x.nw[s]), 0.5))}`; }).join(' | ')} |`);
}

if (only.includes('fleet')) {
  L.push('', `## Rentabilité de chaque modèle (un navire seul, marché normal, ${suite.fleet.years} an(s))`, '', 'M$ net par an ; « négoce » = rentable seulement en achetant et revendant ; ❌ = non rentable.', '');
  const types = Object.keys(R[base].fleet);
  L.push(`| Modèle | ${names.join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
  for (const t of types) L.push(`| ${t} | ${names.map((n) => { const x = R[n].fleet[t]; if (!x) return '–'; return `${x.ok ? '' : '❌ '}${f1(x.net)}${n === base ? '' : delta(x.net, R[base].fleet[t]?.net)}${x.mode === 'négoce' ? ' (négoce)' : ''}`; }).join(' | ')} |`);
}

if (only.includes('vic')) {
  L.push('', `## Victoires (${suite.vic.seeds.length} parties IA, ${suite.vic.years} ans max, une compagnie par tempérament)`, '', 'Cible : une victoire difficile mais atteignable vers dix ans, chaque chemin gagne parfois, aucun toujours.', '');
  L.push(`| Version | Parties gagnées | Médiane (ans) | Avant 10 ans | Par chemin |`, '|---|---|---|---|---|');
  for (const n of names) {
    const w = R[n].vic.filter((v) => v.kind);
    const by = {}; for (const v of w) by[v.kind] = (by[v.kind] || 0) + 1;
    L.push(`| ${n} | ${w.length}/${R[n].vic.length} | ${f1(q(w.map((v) => v.years), 0.5))} | ${w.filter((v) => v.years < 10).length} | ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') || '–'} |`);
  }
  L.push('', `| Graine | ${names.join(' | ')} |`, `|---|${names.map(() => '---').join('|')}|`);
  for (const seed of suite.vic.seeds) L.push(`| ${seed} | ${names.map((n) => { const v = R[n].vic.find((x) => x.seed === seed); return !v ? '–' : v.kind ? `${v.kind} ${f1(v.years)} a (${v.leaning})` : 'aucune'; }).join(' | ')} |`);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.md'), L.join('\n') + '\n');
writeFileSync(join(out, 'raw.json'), JSON.stringify({ suite: suiteName, refs: refs.map(({ name, spec, shas }) => ({ name, spec, shas })), results: R }, null, 1));
for (const r of refs) { try { git(repo, 'worktree', 'remove', '--force', r.dir); } catch {} }
console.log(`Rapport : ${join(out, 'report.md')}`);
