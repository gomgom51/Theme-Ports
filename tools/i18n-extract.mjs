// Extrait les textes français du jeu (chaînes et gabarits `…${x}…`) pour la traduction.
// Usage : node tools/i18n-extract.mjs            → liste les textes sans traduction anglaise
//         node tools/i18n-extract.mjs --json F   → écrit tous les textes dans le fichier F (JSON)
// Un gabarit devient un motif : `Il faut ${x} pour cet achat.` → « Il faut {0} pour cet achat. »
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['web/js', 'web/js/ui', 'web/js/sim', 'web/js/data'];
const SKIP = new Set(['world.js', 'distances.js', 'countries.js', 'en.js']);

// Lecteur de JavaScript minimal : chaînes, gabarits (avec expressions imbriquées),
// commentaires et expressions régulières littérales.
function scan(src) {
  const out = [];
  let i = 0;
  const regexOk = (j) => {
    let k = j - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (k < 0) return true;
    if ('(,=:[!&|?{};+-*%<>~^'.includes(src[k])) return true;
    const word = src.slice(Math.max(0, k - 6), k + 1);
    return /(^|[^\w$])(return|typeof|case|in|of)$/.test(word);
  };
  function readString(q) {
    let s = '';
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') { s += unescape1(src[i + 1]); i += 2; continue; }
      s += src[i++];
    }
    i++;
    return s;
  }
  function unescape1(c) { return { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"', '`': '`', $: '$' }[c] ?? c; }
  // Lit un gabarit ; renvoie { parts, exprs } et analyse les expressions (chaînes imbriquées).
  function readTemplate() {
    i++;
    const parts = ['']; const exprs = [];
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { parts[parts.length - 1] += unescape1(src[i + 1]); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        const start = i;
        let depth = 1;
        while (i < src.length && depth > 0) {
          const c = src[i];
          if (c === "'" || c === '"') { const s = readString(c); out.push({ text: s, kind: 'str' }); continue; }
          if (c === '`') { const t = readTemplate(); emitTemplate(t); continue; }
          if (c === '{') depth++;
          else if (c === '}') { depth--; if (depth === 0) break; }
          i++;
        }
        exprs.push(src.slice(start, i));
        i++;
        parts.push('');
        continue;
      }
      parts[parts.length - 1] += src[i++];
    }
    i++;
    return { parts, exprs };
  }
  function emitTemplate(t) {
    const text = t.parts.map((p, k) => (k ? `{${k - 1}}` : '') + p).join('');
    out.push({ text, kind: t.exprs.length ? 'pattern' : 'str', parts: t.parts, exprs: t.exprs });
  }
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === '/' && regexOk(i)) {
      i++;
      let cls = false;
      while (i < src.length && (src[i] !== '/' || cls)) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
        i++;
      }
      i++;
      while (/[a-z]/.test(src[i] || '')) i++;
      continue;
    }
    // Position gardée pour les textes du premier niveau (collage par « + », voir concatenated()).
    if (c === "'" || c === '"') { const at = i; out.push({ text: readString(c), kind: 'str', at, end: i }); continue; }
    if (c === '`') { const at = i; emitTemplate(readTemplate()); Object.assign(out[out.length - 1], { at, end: i }); continue; }
    i++;
  }
  return out;
}

// Garde ce qui ressemble à du texte affiché (pas des clés, classes CSS, chemins, couleurs…).
export function isText(t) {
  const s = t.replace(/\{\d+\}/g, '').trim();
  if (s.length < 1 || !/[A-Za-zÀ-ÿ]/.test(s)) return false;
  if (/^(https?:\S*$|\.?\.?\/\S*$|#[0-9a-f]{3,8}$|rgba?\(|[\w-]+\.(js|mp3|wav|png|svg|css|json|woff2)$)/i.test(s)) return false;
  if (/^[a-z][\w-]*(\.[\w-]+)+$/.test(s)) return false; // div.class
  if (/^\S+\.(mp3|wav|ogg|png|jpe?g|svg|css|json|woff2?)$/i.test(s)) return false; // fichiers (« musique/{0}.mp3 »)
  if (/\[data-[\w-]+=/.test(s)) return false; // sélecteurs CSS
  if (/\b\d*(px|\{\d+\}px)\b.*\b(serif|sans-serif|monospace|system-ui)\b/.test(t)) return false; // polices du canevas
  if (/^[\w$.-]+$/.test(s) && !/[À-ÿ]/.test(s)) {
    // un seul mot sans accent : un libellé s'il commence par une majuscule (et n'est pas en camelCase/MAJUSCULES),
    // ou s'il accompagne une valeur (« {0} jours », « risque {0} »)
    return /^[A-Z][a-z]{2,}(-[a-z]{2,})*$/.test(s) || (/\{\d+\}/.test(t) && /^[a-z]{2,}$/.test(s));
  }
  if (/^[\w\s.#:>,-]+\{/.test(s) || /^<\w/.test(s) || /^M[\d\s.,-]+[LCZ]/i.test(s)) return false; // CSS, HTML, tracés SVG
  if (/[{};]\s*$/.test(s) && /:\s*[\w#]/.test(s)) return false;
  return /[A-Za-zÀ-ÿ]{2,}/.test(s) || (/\{\d+\}/.test(t) && /(^|\s)[àÀ](\s|$)/.test(s));
}

// À l'écran, un fragment HTML devient plusieurs nœuds de texte : on traduit chacun.
// Les espaces de bord sont ignorés (ils sont conservés à l'affichage).
export function segments(text) {
  const parts = text.includes('<') && /<\/?[a-z][^>]*>/i.test(text) ? text.split(/<[^>]+>/) : [text];
  return parts.map((p) => {
    let n = 0;
    const map = {};
    return p.replace(/\{(\d+)\}/g, (_, d) => `{${map[d] ??= n++}}`).trim();
  }).filter((p) => p && !/^[#[]/.test(p));
}

// Textes recollés : un gabarit dont une partie variable est elle-même un morceau de texte
// (`…coûte ${x}${glace ? ' (classe glace)' : ''}.`) s'affiche d'un seul tenant. Chaque morceau
// se traduit seul, mais le texte entier doit aussi se traduire : on le recompose avec chaque
// morceau possible (les autres parties variables valent « 42 »).
const SAMPLE = '42';
function holeValues(expr) {
  const lits = scan(expr);
  const fill = (e) => (e.parts ? e.parts.map((p, k) => (k ? SAMPLE : '') + p).join('') : e.text);
  const vals = [...new Set(lits.map(fill).filter((t) => /[A-Za-zÀ-ÿ]{2}/.test(t) && isText(t.replaceAll(SAMPLE, '').trim() || '.')))];
  if (!vals.length) return null; // pas de morceau de texte : déjà couvert par le motif
  if (lits.some((e) => e.text === '')) vals.push(''); // « cond ? ' (…)' : '' »
  if (/\|\||\?\?/.test(expr)) vals.push(SAMPLE); // « nom || 'un concurrent' »
  return vals;
}
// Textes collés par « + » (`res[0] + (perte ? ` (${x} volés)` : '')`) : le texte recomposé ne se
// voit pas dans le code, et l'écran l'affiche d'un seul tenant. Écrire plutôt un gabarit `…${x}…`
// (contrôlé par compositions()) ou des nœuds de texte séparés.
export function concatIn(src) {
  const lits = scan(src).filter((e) => e.at != null);
  const inLit = new Uint8Array(src.length + 1);
  for (const l of lits) inLit.fill(1, l.at, l.end);
  const prev = (k) => { while (k >= 0 && /\s/.test(src[k])) k--; return k; };
  const next = (k) => { while (k < src.length && /\s/.test(src[k])) k++; return k; };
  const plusBefore = (k) => { const a = prev(k); return (src[a] === '+' && src[a - 1] !== '+') || (src[a] === '=' && src[a - 1] === '+'); };
  const plusAfter = (k) => { const b = next(k); return src[b] === '+' && src[b + 1] !== '+'; };
  // Le texte est-il une branche d'une expression entre parenthèses elle-même collée par « + » ?
  const inPlusGroup = (at, end) => {
    let i = at - 1, depth = 0;
    for (let n = 0; i >= 0 && n < 400; i--, n++) {
      if (inLit[i]) continue;
      const c = src[i];
      if (c === ')' || c === ']' || c === '}') depth++;
      else if (c === '(' || c === '[' || c === '{') { if (!depth) break; depth--; } else if (!depth && (c === ';' || c === ',')) return false;
    }
    if (src[i] !== '(' || /[\w$)\]]/.test(src[prev(i - 1)] || '')) return false; // appel de fonction : pas un groupe
    let j = end, d = 0;
    for (let n = 0; j < src.length && n < 400; j++, n++) {
      if (inLit[j]) continue;
      const c = src[j];
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') { if (!d) break; d--; } else if (!d && (c === ';' || c === ',')) return false;
    }
    return src[j] === ')' && (plusBefore(i - 1) || plusAfter(j + 1));
  };
  return lits.filter((e) => isText(e.text.replace(/\{\d+\}/g, '').trim() || '.') && (plusBefore(e.at - 1) || plusAfter(e.end) || inPlusGroup(e.at, e.end)))
    .map((e) => ({ text: e.text, line: src.slice(0, e.at).split('\n').length }));
}
export function concatenated() {
  const out = [];
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (!f.endsWith('.js') || SKIP.has(f)) continue;
      for (const e of concatIn(readFileSync(join(ROOT, d, f), 'utf8'))) out.push({ ...e, file: `${d}/${f}`.replace('web/js/', '') });
    }
  }
  return out;
}

export function compositions() {
  const seen = new Map();
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (!f.endsWith('.js') || SKIP.has(f)) continue;
      const file = `${d}/${f}`.replace('web/js/', '');
      for (const e of scan(readFileSync(join(ROOT, d, f), 'utf8'))) {
        if (!e.exprs?.length) continue;
        const holes = e.exprs.map(holeValues);
        if (holes.every((v) => v == null)) continue;
        let combos = [[]];
        for (const v of holes) combos = combos.flatMap((c) => (v || [SAMPLE]).map((x) => [...c, x])).slice(0, 64);
        for (const c of combos) {
          for (const key of segments(e.parts.map((p, k) => (k ? c[k - 1] : '') + p).join(''))) {
            if (!isText(key)) continue;
            if (!seen.has(key)) seen.set(key, { text: key, files: new Set() });
            seen.get(key).files.add(file);
          }
        }
      }
    }
  }
  return [...seen.values()].map((e) => ({ ...e, files: [...e.files] }));
}

export function extract() {
  const seen = new Map();
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (!f.endsWith('.js') || SKIP.has(f)) continue;
      const file = `${d}/${f}`;
      for (const e of scan(readFileSync(join(ROOT, file), 'utf8'))) for (const key of segments(e.text)) {
        if (!isText(key)) continue;
        if (!seen.has(key)) seen.set(key, { text: key, kind: e.kind, files: new Set() });
        seen.get(key).files.add(file.replace('web/js/', ''));
      }
    }
  }
  return [...seen.values()].map((e) => ({ ...e, files: [...e.files] }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = extract();
  const j = process.argv.indexOf('--json');
  if (j > 0) {
    writeFileSync(process.argv[j + 1], JSON.stringify(all, null, 1));
    console.log(`${all.length} textes écrits dans ${process.argv[j + 1]}`);
  } else {
    const { default: EN } = await import(join(ROOT, 'web/js/i18n/en.js'));
    const missing = all.filter((e) => !(e.text in EN));
    for (const e of missing) console.log(`${e.files.join(',')}\t${JSON.stringify(e.text)}`);
    console.log(`\n${missing.length} textes sans traduction anglaise sur ${all.length}.`);
  }
}
