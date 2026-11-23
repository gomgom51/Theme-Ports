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
    out.push({ text, kind: t.exprs.length ? 'pattern' : 'str' });
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
    if (c === "'" || c === '"') { out.push({ text: readString(c), kind: 'str' }); continue; }
    if (c === '`') { emitTemplate(readTemplate()); continue; }
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
  if (/^[\w$.-]+$/.test(s) && !/[À-ÿ]/.test(s)) {
    // un seul mot sans accent : un libellé s'il commence par une majuscule (et n'est pas en camelCase/MAJUSCULES),
    // ou s'il accompagne une valeur (« {0} jours », « risque {0} »)
    return /^[A-Z][a-z]{2,}$/.test(s) || (/\{\d+\}/.test(t) && /^[a-z]{2,}$/.test(s));
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
