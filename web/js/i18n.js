// Langues du jeu. Le français est la langue source du code : en anglais, chaque texte
// affiché est traduit au moment où il apparaît à l'écran (nœuds de texte, infobulles),
// et la carte traduit ses étiquettes avec tr(). Les nouvelles du journal, enregistrées
// en français dans les sauvegardes, s'affichent donc aussi en anglais.
// Dictionnaire : js/i18n/en.js (texte français → anglais, {0} pour les parties variables).
import EN from './i18n/en.js';
import { COUNTRIES } from './data/countries.js';
import { FLAGS, PORTS } from './data/ports.js';

const KEY = 'pda-lang';
export const LANGS = { fr: 'Français', en: 'English' };
let lang = detect();

function detect() {
  try { const s = localStorage.getItem(KEY); if (s && s in LANGS) return s; } catch { /* stockage indisponible */ }
  const n = (typeof navigator !== 'undefined' && navigator.language) || 'fr';
  return n.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
export const getLang = () => lang;

// ---------- Dictionnaire ----------
const EXACT = new Map();
const LOWER = new Map();
const PATTERNS = [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Fin de phrase : point suivi d'une majuscule ou d'un pourcentage (« … avariée. 18 % de … »),
// mais pas d'une année (« 16 janv. 2027 »).
const SENTENCE_BREAK = /[.!?…]\s+(?:[A-ZÀ-ÖØ-Þ«"]|\d+\s?%)/;
for (const [fr, en] of Object.entries(EN)) {
  if (/\{\d+\}/.test(fr)) {
    const parts = fr.split(/\{\d+\}/);
    const order = (fr.match(/\{(\d+)\}/g) || []).map((m) => +m.slice(1, -1));
    const re = new RegExp(`^${parts.map(esc).join('(.*?)')}$`, 's');
    const chunk = parts.reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), '');
    // Variables collées l'une à l'autre (« …{3}{4} ») : la coupure se décide après coup.
    const glued = parts.slice(1, -1).map((p, k) => (p === '' ? k : -1)).filter((k) => k >= 0);
    const generic = parts.join('').replace(/[^A-Za-zÀ-ÿ]/g, '').length < 7;
    // Le texte français a-t-il lui-même plusieurs phrases ? Sinon, une partie variable ne doit
    // pas en avaler d'autres (« Avarie … du {0}. » ne couvre pas « … Immobilisé 1.5 j. Coût … »).
    const multi = SENTENCE_BREAK.test(fr.replace(/\{\d+\}/g, 'X'));
    // Variables séparées par une simple espace (« Le {0} {1} à {2}. ») : la coupure peut se discuter.
    const spaced = parts.slice(1, -1).map((p, k) => (p === ' ' ? k : -1)).filter((k) => k >= 0);
    PATTERNS.push({ re, order, en, chunk, glued, spaced, generic, multi, weight: parts.join('').length });
  } else {
    EXACT.set(fr, en);
    LOWER.set(fr.toLowerCase(), en);
  }
}
PATTERNS.sort((a, b) => b.weight - a.weight); // les motifs les plus précis d'abord
// Mots anglais employés en minuscules quelque part : on peut les mettre en minuscule en milieu de phrase.
const COMMON = new Set(Object.values(EN).join(' ').match(/\b[a-z][a-z'-]*/g));
// Noms de ports identiques en anglais : connus du dictionnaire (« · à Rotterdam » → « · in Rotterdam »).
for (const P of Object.values(PORTS)) if (!EXACT.has(P.name)) { EXACT.set(P.name, P.name); LOWER.set(P.name.toLowerCase(), P.name); }
// Noms de pays et de pavillons : fournis par le navigateur à partir des codes ISO.
try {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const add = (fr, code) => {
    if (!fr || EXACT.has(fr)) return;
    try { const en = dn.of(code); if (en && en !== code) { EXACT.set(fr, en); LOWER.set(fr.toLowerCase(), en); } } catch { /* code non reconnu (« -99 ») */ }
  };
  for (const c of COUNTRIES) add(c.n, c.c);
  for (const [code, F] of Object.entries(FLAGS)) add(F.name, code);
} catch { /* Intl.DisplayNames indisponible : on garde les noms français */ }

// ---------- Traduction ----------
function lookup(t, depth) {
  const r = lookupCore(t, depth);
  if (r != null || depth > 3) return r;
  // Même texte sans le point final (journal de bord) : « Avarie de machine à bord du X ».
  if (/[A-Za-zÀ-ÿ0-9)]$/.test(t)) { const r2 = lookupCore(t + '.', depth); if (r2 != null) return r2.replace(/\.$/, ''); }
  return null;
}
function lookupCore(t, depth) {
  const ex = EXACT.get(t);
  if (ex !== undefined) return ex;
  const lo = LOWER.get(t.toLowerCase());
  if (lo !== undefined) {
    const first = (lo.match(/^[A-Za-z'-]+/) || [''])[0].toLowerCase();
    return t[0] !== t[0].toUpperCase() && COMMON.has(first) ? lo.charAt(0).toLowerCase() + lo.slice(1) : lo;
  }
  if (depth > 3) return null;
  for (const p of PATTERNS) {
    if (p.chunk && !t.includes(p.chunk)) continue;
    const m = p.re.exec(t);
    if (!m) continue;
    let got = m.slice(1);
    if (!p.multi && got.some((g) => SENTENCE_BREAK.test(g))) continue;
    for (const k of p.glued) [got[k], got[k + 1]] = split(got[k] + got[k + 1], depth + 1);
    if (p.generic) {
      const ok = (gs) => gs.every((g) => !/[A-Za-zÀ-ÿ]{2}/.test(g) || looksLikeName(g) || lookup(g.trim(), depth + 1) != null);
      if (!ok(got)) {
        // Nom en plusieurs mots (« Étoile du Nord » | « a terminé son déchargement ») : autres coupures.
        let fixed = null;
        for (const k of p.spaced) {
          const whole = got[k] + ' ' + got[k + 1];
          for (let i = whole.indexOf(' '); i > 0 && !fixed; i = whole.indexOf(' ', i + 1)) {
            const alt = got.slice(); alt[k] = whole.slice(0, i); alt[k + 1] = whole.slice(i + 1);
            if (ok(alt)) fixed = alt;
          }
          if (fixed) break;
        }
        if (!fixed) continue;
        got = fixed;
      }
    }
    const vals = {};
    p.order.forEach((n, i) => { vals[n] = got[i]; });
    return p.en.replace(/\{(\d+)\}/g, (_, n) => part(vals[n] ?? '', depth + 1));
  }
  return null;
}
// Nom propre (navire, compagnie, client) : majuscule initiale, pas deux mots courants à la suite.
// (au plus six mots, chacun avec une majuscule ou un petit mot de liaison : « Étoile du Nord », « Vent d'Ouest »).
const LINK = /^(de|du|des|la|le|les|et|of|the|and|van|von|da|do|di|y)$/i;
const looksLikeName = (g) => {
  if (/,\s/.test(g)) return false; // « Mourmansk, Gênes » : une liste de noms, traduite un à un
  const w = g.trim().split(/\s+/);
  return w.length <= 6 && /^[A-ZÀ-ÖØ-Þ]/.test(w[0]) && w.every((x) => /^[A-ZÀ-ÖØ-Þ0-9]/.test(x) || LINK.test(x) || /^[dl]['’][A-ZÀ-ÖØ-Þ]/.test(x));
};
// Deux variables collées : on cherche la coupure (fin de phrase ou de proposition)
// où chaque morceau se traduit ; sinon tout va au premier.
function split(s, depth) {
  const ok = (x) => !x.trim() || !/[A-Za-zÀ-ÿ]{2}/.test(x) || lookup(x.trim(), depth) != null;
  const cuts = [s.length];
  for (const mm of s.matchAll(/[.!?,)]\s*/g)) cuts.push(mm.index + mm[0].length);
  for (const mm of s.matchAll(/\s[·—]\s|, /g)) cuts.push(mm.index); // juste avant « · », « — » ou « , »
  cuts.push(0);
  for (const c of cuts) if (ok(s.slice(0, c)) && ok(s.slice(c))) return [s.slice(0, c), s.slice(c)];
  return [s, ''];
}
// Partie variable : un nom de port, un type de navire, une phrase imbriquée, un montant…
// Ce qui n'est pas dans le dictionnaire garde son texte, aux formats anglais.
function part(v, depth) {
  const core = v.trim();
  if (!core) return v;
  // Un nom propre absent du dictionnaire (navire, compagnie) reste tel quel : « Île de Batz ».
  if (looksLikeName(core) && !EXACT.has(core) && !LOWER.has(core.toLowerCase())) return v.replace(core, englishFormats(core));
  const r = /[A-Za-zÀ-ÿ]/.test(core) ? lookup(core, depth) ?? loose(core, depth) : null;
  return v.replace(core, r == null ? englishFormats(core) : r);
}
// Libellés composés, traduits morceau par morceau : listes (« A, B »), « A · B », « ⛽ Nom ».
const STRONG = /( · | — | → | \/ )/;
const COMMA = /(, )/;
function loose(t, depth) {
  if (depth > 4) return null;
  const m = /^([^A-Za-zÀ-ÿ]*)([\s\S]*?[A-Za-zÀ-ÿ.)])([^A-Za-zÀ-ÿ.)]*)$/.exec(t);
  if (m && (m[1] || m[3])) {
    const r = lookup(m[2], depth + 1);
    if (r != null) return englishFormats(m[1]) + r + englishFormats(m[3]);
  }
  return bySeparator(t, STRONG, depth) ?? bySentence(t, depth) ?? bySeparator(t, COMMA, depth);
}
function bySeparator(t, sep, depth) {
  const pieces = t.split(sep);
  if (pieces.length < 2) return null;
  let changed = false;
  const out = pieces.map((p, i) => {
    if (i % 2 || !/[A-Za-zÀ-ÿ]{2}/.test(p)) return i % 2 ? p : englishFormats(p);
    const r = lookup(p.trim(), depth + 1) ?? loose(p.trim(), depth + 1);
    if (r == null) return englishFormats(p);
    changed = true;
    return p.replace(p.trim(), r);
  });
  return changed ? out.join('') : null;
}
// Plusieurs phrases collées (« Abordage : … Immobilisé 1.5 j. Coût : … ») : chacune à part,
// en essayant d'abord jusqu'à trois phrases ensemble (« Incendie… ! L'équipage… »).
function bySentence(t, depth) {
  // Sans « lookbehind » (?<=…) : Safari ne le comprend qu'à partir de la 16.4, et l'erreur empêchait le jeu de charger.
  const s = t.replace(/([.!?…])\s+(?=\S)/g, '$1\u0000').split('\u0000');
  if (s.length < 2) return null;
  const out = [];
  let changed = false;
  for (let i = 0; i < s.length;) {
    let done = false;
    for (let n = Math.min(3, s.length - i); n >= 1 && !done; n--) {
      const chunk = s.slice(i, i + n).join(' ');
      const r = lookup(chunk, depth + 1) ?? (n === 1 ? loose(chunk, depth + 1) : null);
      if (r != null) { out.push(r); i += n; changed = true; done = true; }
    }
    if (!done) { out.push(englishFormats(s[i])); i++; }
  }
  return changed ? out.join(' ') : null;
}

// Nombres, sommes et dates à l'anglaise : « 1 234,5 M$ » → « $1,234.5M », « 12 mars 2026 » → « 12 March 2026 ».
const MONTHS = { janvier: 'January', 'février': 'February', mars: 'March', avril: 'April', mai: 'May', juin: 'June', juillet: 'July', 'août': 'August', septembre: 'September', octobre: 'October', novembre: 'November', 'décembre': 'December' };
const SHORT = { 'janv.': 'Jan', 'févr.': 'Feb', mars: 'Mar', 'avr.': 'Apr', mai: 'May', juin: 'Jun', 'juil.': 'Jul', 'août': 'Aug', 'sept.': 'Sep', 'oct.': 'Oct', 'nov.': 'Nov', 'déc.': 'Dec' };
const SP = '[\\u202f\\u00a0 ]';
const RE_MONTH = new RegExp(`(\\d{1,2})(?:er)?${SP}(${Object.keys(MONTHS).join('|')})(?=${SP}\\d{4}|\\b)`, 'g');
const RE_SHORT = new RegExp(`(\\d{1,2})${SP}(${Object.keys(SHORT).map(esc).join('|')})(?=${SP}|$)`, 'g');
function englishFormats(s) {
  return s
    .replace(RE_MONTH, (_, d, m) => `${d} ${MONTHS[m]}`)
    .replace(RE_SHORT, (_, d, m) => `${d} ${SHORT[m]}`)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(new RegExp(`(\\d)${SP}(?=\\d{3}(?!\\d))`, 'g'), '$1,')
    .replace(new RegExp(`([+−-]?)(\\d[\\d.,]*)${SP}?([kM])\\$`, 'g'), '$1$$$2$3')
    .replace(new RegExp(`([+−-]?)(\\d[\\d.,]*)${SP}?\\$`, 'g'), '$1$$$2')
    .replace(new RegExp(`(\\d)${SP}%`, 'g'), '$1%')
    .replace(new RegExp(`${SP}([:;!?])(?=\\s|$)`, 'g'), '$1')
    .replace(new RegExp(`«${SP}?`, 'g'), '“').replace(new RegExp(`${SP}?»`, 'g'), '”');
}

const cache = new Map();
// Traduit un texte français affiché dans la langue choisie (inchangé en français).
export function tr(s) {
  if (lang === 'fr' || !s || typeof s !== 'string') return s;
  let out = cache.get(s);
  if (out !== undefined) return out;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  out = m[2] ? m[1] + (lookup(m[2], 0) ?? loose(m[2], 0) ?? englishFormats(m[2])) + m[3] : s;
  if (cache.size > 8000) cache.clear();
  cache.set(s, out);
  return out;
}

// ---------- Traduction de l'écran ----------
const ATTRS = ['title', 'aria-label', 'placeholder'];
const texts = new WeakMap(); // nœud de texte → { fr, en }
const attrs = new WeakMap(); // élément → { attribut: { fr, en } }
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
const skipped = (el) => el && (SKIP.has(el.nodeName) || el.closest?.('[data-no-tr]'));

function doText(n) {
  const v = n.nodeValue;
  if (!v || !/[A-Za-zÀ-ÿ\d]/.test(v) || skipped(n.parentElement)) return;
  const rec = texts.get(n);
  if (rec && rec.en === v) return; // déjà traduit
  const en = tr(v);
  texts.set(n, { fr: v, en });
  if (en !== v) n.nodeValue = en;
}
function doAttr(el, a) {
  const v = el.getAttribute(a);
  if (!v || skipped(el)) return;
  const all = attrs.get(el) || {};
  if (all[a] && all[a].en === v) return;
  const en = tr(v);
  all[a] = { fr: v, en };
  attrs.set(el, all);
  if (en !== v) el.setAttribute(a, en);
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1 || skipped(root)) return;
  for (const a of ATTRS) if (root.hasAttribute(a)) doAttr(root, a);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) doText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);
  }
}
function restore(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = root; n; n = w.nextNode()) {
    if (n.nodeType === 3) { const r = texts.get(n); if (r && n.nodeValue === r.en) n.nodeValue = r.fr; texts.delete(n); continue; }
    const all = attrs.get(n);
    if (all) { for (const [a, r] of Object.entries(all)) if (n.getAttribute(a) === r.en) n.setAttribute(a, r.fr); attrs.delete(n); }
  }
}
let observer = null;
function watch() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
      else for (const n of m.addedNodes) walk(n);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// À appeler au démarrage, avant le premier affichage.
export function initI18n() {
  document.documentElement.lang = lang;
  if (lang !== 'fr') { walk(document.body); watch(); }
}
// Change de langue sans recharger : l'écran est traduit (ou remis en français) sur place.
export function setLang(l) {
  if (!(l in LANGS) || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* stockage indisponible */ }
  cache.clear();
  document.documentElement.lang = l;
  if (l === 'fr') { observer?.disconnect(); observer = null; restore(document.body); } else { walk(document.body); watch(); }
  window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
}
