// Garde-fou de cohérence du code (docs/code-health.md) : échoue (code 1) quand une règle est enfreinte.
// Usage : node tools/code-check.mjs        (npm test et la CI le lancent)
//
// Règles vérifiées dans web/js :
//  1. localStorage / sessionStorage seulement dans ui/storage.js (clés et accès en un seul endroit).
//  2. Sommes, nombres et pourcentages écrits par sim/format.js (money, num, pctOf…) : pas de
//     « (x / 1e6).toFixed(…) M$ », « Math.round(x / 1000) k$ », toLocaleString('fr-FR') ou Intl.NumberFormat ailleurs.
//  3. La comptabilité s'appelle book(state, …) : money(state, …) (l'ancien nom) n'existe plus.
//  4. La simulation (sim/) reste pure : rien de ui/, ni document, window ou localStorage.
//  5. Pas d'export que personne n'utilise (code mort), pas d'import inutilisé.
// Rapport seulement (n'échoue pas) : dépendances circulaires entre modules de sim/.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web/js');
// Exports gardés exprès alors que rien ne les importe (avec la raison).
const KEEP_EXPORTS = {
  'sim/actions.js:abandonContract': 'aucun bouton ne l\'appelle encore : à brancher ou à retirer (décision du propriétaire)',
  'sim/crew.js:crewMaxed': 'pour le fil « ordres permanents » (choix du capitaine), PR #43',
  'sim/crew.js:loseBriscardPoint': 'pour le fil « ordres permanents » (reprise en main du capitaine), PR #43',
};

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|html)$/.test(f)) out.push(p);
  }
  return out;
}
// Deux lectures d'un fichier, sans les commentaires : plain garde les chaînes, code vide le contenu des
// chaînes '…' et "…" (pour chercher des noms sans tomber sur du texte). Les gabarits `…${x}…` restent entiers.
function strip(src) {
  let plain = '', code = '', i = 0;
  const put = (a, b = a) => { plain += a; code += b; };
  function codeUntil(stop) { // lit du code jusqu'à `stop` (fin de fichier, ou « } » qui ferme un ${…})
    let depth = 0;
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (stop && c === '}' && depth === 0) return;
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        put(src.slice(i, j + 1), c + ' '.repeat(Math.max(0, j - i - 1)) + c);
        i = j + 1; continue;
      }
      if (c === '`') { template(); continue; }
      put(c); i++;
    }
  }
  function template() {
    put('`'); i++;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { put(src.slice(i, i + 2)); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { put('${'); i += 2; codeUntil(true); put('}'); i++; continue; }
      put(src[i]); i++;
    }
    put('`'); i++;
  }
  codeUntil(false);
  return { plain, code };
}

const files = walk(WEB).filter((f) => f.endsWith('.js') && !/\/i18n\/en\.js$|\/data\/(world|distances|countries)\.js$/.test(f));
const rel = (f) => relative(WEB, f);
const src = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const stripped = new Map(files.map((f) => [f, strip(src.get(f))]));
const code = new Map(files.map((f) => [f, stripped.get(f).code]));
const plain = new Map(files.map((f) => [f, stripped.get(f).plain]));
const problems = [];
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function scan(rule, re, { only, except, text = code } = {}) {
  for (const f of files) {
    const r = rel(f);
    if (only && !only.test(r)) continue;
    if (except && except.test(r)) continue;
    const s = src.get(f);
    const c = text.get(f);
    for (const m of c.matchAll(re)) problems.push(`${r}:${lineOf(c, m.index)}  ${rule}  « ${s.split('\n')[lineOf(c, m.index) - 1].trim().slice(0, 110)} »`);
  }
}

// 1. Stockage
scan('localStorage hors de ui/storage.js (passer par read/write de storage.js)', /\b(localStorage|sessionStorage)\b/g, { except: /^ui\/storage\.js$/ });
// 2. Formats
const FORMAT = 'somme ou nombre mis en forme à la main (money, num, num1, pctOf, dec de sim/format.js)';
scan(FORMAT, /\/\s*1e[369]\s*\)\s*\.toFixed\(|\/\s*1000\s*\)\s*\.toFixed\(|toFixed\(\d\)\s*\.replace\(\s*'\.'\s*,\s*','\s*\)|toLocaleString\(\s*'fr-FR'|new Intl\.NumberFormat/g, { except: /^sim\/format\.js$/, text: plain });
scan(FORMAT, /\/\s*(1e3|1000|1e6|1e9)\s*\)\s*\}\s*(k|M|Md)\$/g, { except: /^sim\/format\.js$/, text: plain });
// 3. Comptabilité
scan('money(state, …) : la comptabilité s\'appelle book(state, …) ; money() écrit une somme', /\bmoney\(\s*(state|s|st)\s*,/g);
// 4. Simulation pure
scan('la simulation n\'importe rien de ui/', /from\s+'\.\.\/ui\//g, { only: /^sim\//, text: plain });
scan('la simulation ne touche pas au navigateur (document, window)', /\b(document|window)\./g, { only: /^sim\// });

// 5. Exports et imports
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g;
const STAR_RE = /import\s*\*\s*as\s+(\w+)\s+from\s*'([^']+)'/g;
const EXPORT_FROM_RE = /export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g;
const allText = [...files, join(ROOT, 'web/index.html'), ...walk(join(ROOT, 'tests')), ...walk(join(ROOT, 'tools'))].map((f) => [f, code.get(f) ?? strip(readFileSync(f, 'utf8')).code]);
// Le nom apparaît-il dans ce code ? props : « x.nom » compte aussi (import * as x) ; sinon, c'est la propriété
// d'un autre objet et ne compte pas.
const used = (name, c, props = false) => {
  for (const m of c.matchAll(new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'))) {
    const before = c.slice(Math.max(0, m.index - 3), m.index);
    if (!props && before.endsWith('.') && !before.endsWith('...')) continue;
    return true;
  }
  return false;
};
for (const f of files) {
  const c = code.get(f);
  // Imports inutilisés (lus dans le texte avec ses chaînes, cherchés dans le code sans elles)
  for (const m of plain.get(f).matchAll(IMPORT_RE)) {
    const rest = c.slice(0, m.index) + ' '.repeat(m[0].length) + c.slice(m.index + m[0].length);
    for (const part of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const local = part.split(/\s+as\s+/).pop().trim();
      if (!used(local, rest)) problems.push(`${rel(f)}:${lineOf(c, m.index)}  import inutilisé : ${local} (de ${m[2]})`);
    }
  }
}
// Exports que rien n'utilise : ni ailleurs (web, tests, outils), ni dans leur propre fichier.
for (const f of files) {
  const c = code.get(f);
  for (const m of c.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/gm)) {
    const name = m[1];
    if (KEEP_EXPORTS[`${rel(f)}:${name}`]) continue;
    const self = c.slice(0, m.index) + c.slice(m.index + m[0].length);
    if (used(name, self)) continue;
    if (allText.some(([g, t]) => g !== f && used(name, t, true))) continue;
    problems.push(`${rel(f)}:${lineOf(c, m.index)}  export que rien n'utilise : ${name} (à retirer, ou à garder dans KEEP_EXPORTS avec sa raison)`);
  }
}

// Rapport : dépendances circulaires dans sim/ (à défaire peu à peu ; voir docs/code-health.md).
const simFiles = files.filter((f) => rel(f).startsWith('sim/'));
const deps = new Map(simFiles.map((f) => {
  const out = new Set();
  for (const re of [IMPORT_RE, STAR_RE, EXPORT_FROM_RE]) for (const m of plain.get(f).matchAll(re)) {
    const target = resolve(dirname(f), m[2]);
    if (target !== f && simFiles.includes(target)) out.add(target);
  }
  return [f, out];
}));
const cycles = new Set();
for (const start of simFiles) {
  const stack = [[start, [start]]];
  const seen = new Set();
  while (stack.length) {
    const [node, path] = stack.pop();
    for (const next of deps.get(node)) {
      if (next === start && path.length > 1) {
        const names = path.map((p) => rel(p).slice(4, -3));
        const k = names.indexOf(names.slice().sort()[0]);
        cycles.add([...names.slice(k), ...names.slice(0, k)].join(' → '));
      } else if (!seen.has(next) && path.length < 4) { seen.add(next); stack.push([next, [...path, next]]); }
    }
  }
}

if (process.argv.includes('--cycles')) for (const c of [...cycles].sort()) console.log(`  cycle : ${c}`);
console.log(`${files.length} fichiers vérifiés ; ${cycles.size} dépendances circulaires dans sim/ (rapport seulement, --cycles pour la liste).`);
if (problems.length) {
  console.log(`\n${problems.length} problème(s) :\n${problems.map((p) => `  ${p}`).join('\n')}`);
  console.log('\nRègles et raisons : docs/code-health.md');
  process.exit(1);
}
console.log('Aucun problème.');
