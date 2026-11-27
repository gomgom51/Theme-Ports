// Langues du jeu. Le français est la langue source du code : en anglais, chaque texte
// affiché est traduit au moment où il apparaît à l'écran (nœuds de texte, infobulles),
// et la carte traduit ses étiquettes avec tr(). Les nouvelles du journal, enregistrées
// en français dans les sauvegardes, s'affichent donc aussi en anglais.
// Dictionnaire : js/i18n/en.js (texte français → anglais, {0} pour les parties variables).
import EN from './i18n/en.js';
import { COUNTRIES } from './data/countries.js';
import { FLAGS, PORTS } from './data/ports.js';
import { CLIENTS } from './data/clients.js';
import { SHIP_NAMES, CAPTAIN_NAMES } from './data/ships.js';

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

// ---------- Noms propres ----------
// Navires, compagnies, capitaines, clients : choisis par le joueur, ils peuvent contenir n'importe
// quoi (« (E)(D) Ferdinand », « la Belle Poule », « Étoile du Nord »). Avant de traduire une phrase,
// chaque nom connu est remplacé par un jeton (caractère d'usage privé) que les motifs prennent
// pour une partie variable intraduisible, puis remis à sa place.
const NAMES = new Set();
const TOKEN0 = 0xE100;
const TOKEN_ONLY = /^[\uE100-\uEFFF]+$/;
let nameList = [];
let nameRe = null;
function addName(n) {
  if (typeof n !== 'string') return;
  const v = n.trim();
  if (v.length < 2 || NAMES.has(v) || !/[A-Za-zÀ-ÿ0-9]/.test(v) || NAMES.size >= 0xE00) return;
  NAMES.add(v);
  nameRe = null;
}
// Les noms s'accumulent pendant la session : le journal parle encore des navires vendus.
export function registerNames(list) {
  const n0 = NAMES.size;
  for (const n of list) addName(n);
  if (NAMES.size !== n0) { nameRe = null; cache.clear(); }
}
// Tous les noms d'une partie (à rappeler quand un navire est acheté ou renommé).
export function registerGameNames(state) {
  if (!state) return;
  const list = [];
  for (const c of state.companies || []) list.push(c.name, c.captain);
  for (const s of state.ships || []) list.push(s.name, s.captainName);
  registerNames(list);
}
let nameReCI = null;
function nameRegex() {
  if (nameRe) return nameRe;
  nameList = [...NAMES].sort((a, b) => b.length - a.length);
  const src = `(^|[^\\p{L}\\p{N}])(${nameList.map(esc).join('|')})(?=[^\\p{L}\\p{N}]|$)`;
  nameRe = nameList.length ? new RegExp(src, 'gu') : null;
  nameReCI = nameList.length ? new RegExp(src, 'giu') : null; // noms écrits en capitales (« OCÉANE » sur la coque)
  return nameRe;
}
function stripNames(t) {
  if (!nameRegex()) return t;
  const sub = (x) => x.replace(nameReCI, '$1 ');
  return sub(sub(t));
}
function protect(t) {
  const re = nameRegex();
  if (!re || !t) return t;
  // Deux passes : la première consomme le séparateur, un nom collé au suivant serait manqué.
  const sub = (x) => x.replace(re, (_, pre, n) => pre + String.fromCharCode(TOKEN0 + nameList.indexOf(n)));
  return sub(sub(t));
}
const unprotect = (t) => t.replace(/[\uE100-\uEFFF]/g, (c) => nameList[c.charCodeAt(0) - TOKEN0] ?? c);
for (const C of Object.values(CLIENTS)) addName(C.name);
for (const n of [...SHIP_NAMES, ...CAPTAIN_NAMES]) addName(n);

// ---------- Traduction ----------
function lookup(t, depth) {
  const r = lookupCore(t, depth);
  if (r != null || depth > 3) return r;
  // Même texte sans le point final (journal de bord) : « Avarie de machine à bord du X ».
  if (/[A-Za-zÀ-ÿ0-9)]$/.test(t)) { const r2 = lookupCore(t + '.', depth); if (r2 != null) return r2.replace(/\.$/, ''); }
  return null;
}
function lookupCore(t, depth) {
  const r = lookupPattern(t, depth);
  return r && typeof r === 'object' ? r.text : r;
}
function lookupPattern(t, depth) {
  const ex = EXACT.get(t);
  if (ex !== undefined) return ex;
  const lo = LOWER.get(t.toLowerCase());
  if (lo !== undefined) {
    const first = (lo.match(/^[A-Za-z'-]+/) || [''])[0].toLowerCase();
    return t[0] !== t[0].toUpperCase() && COMMON.has(first) ? lo.charAt(0).toLowerCase() + lo.slice(1) : lo;
  }
  if (depth > 3) return null;
  // Un motif dont une partie variable reste en français (« {0} navires » sur « Vous : 5 navires »)
  // ne sert qu'en dernier recours : un motif plus juste (« Vous : {0} ») peut suivre.
  let fallback = null;
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
    let clean = true;
    const out = p.en.replace(/\{(\d+)\}/g, (_, n) => {
      const r = part(vals[n] ?? '', depth + 1);
      if (clean && looksFrench(r)) clean = false;
      return r;
    });
    if (clean) return out;
    fallback ??= { text: out };
  }
  return fallback;
}
// Nom propre (navire, compagnie, client) : majuscule initiale, pas deux mots courants à la suite.
// (au plus six mots, chacun avec une majuscule ou un petit mot de liaison : « Étoile du Nord », « Vent d'Ouest »).
const LINK = /^(de|du|des|la|le|les|et|of|the|and|van|von|da|do|di|y)$/i;
// Un mot de nom commence par une majuscule, un chiffre ou un signe (« (E)(D) Ferdinand », « 2e Souffle »).
const NAME_WORD = /^[^a-zà-ÿ\s]/;
const looksLikeName = (g) => {
  const core = g.trim();
  if (NAMES.has(core) || TOKEN_ONLY.test(core)) return true;
  if (/,\s/.test(g)) return false; // « Mourmansk, Gênes » : une liste de noms, traduite un à un
  const w = core.split(/\s+/);
  return w.length <= 6 && /[A-Za-zÀ-ÿ0-9]/.test(w[0]) && NAME_WORD.test(w[0]) && w.every((x) => NAME_WORD.test(x) || LINK.test(x) || /^[dl]['’][A-ZÀ-ÖØ-Þ]/.test(x));
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
  if (!core || TOKEN_ONLY.test(core)) return v;
  // Un nom propre absent du dictionnaire (navire, compagnie) reste tel quel : « Île de Batz ».
  if (looksLikeName(core) && !EXACT.has(core) && !LOWER.has(core.toLowerCase())) return v.replace(core, englishFormats(core));
  const r = /[A-Za-zÀ-ÿ]/.test(core) ? best(core, depth) : null;
  return v.replace(core, r == null ? englishFormats(core) : r);
}
// Libellés composés, traduits morceau par morceau : listes (« A, B »), « A · B », « ⛽ Nom ».
const STRONG = /( · | — | → | \/ )/;
const SEMI = /([\s\u202f\u00a0];\s)/;
const COMMA = /(, )/;
function loose(t, depth) {
  if (depth > 4) return null;
  const m = /^([^A-Za-zÀ-ÿ]*)([\s\S]*?[A-Za-zÀ-ÿ.)])([^A-Za-zÀ-ÿ.)]*)$/.exec(t);
  if (m && (m[1] || m[3])) {
    const r = lookup(m[2], depth + 1);
    if (r != null && !looksFrench(r)) return englishFormats(m[1]) + r + englishFormats(m[3]);
  }
  // Le premier découpage qui ne laisse pas de français ; sinon le premier qui traduit quelque chose.
  let first = null;
  for (const cut of [() => bySeparator(t, STRONG, depth), () => bySentence(t, depth), () => bySeparator(t, SEMI, depth), () => bySeparator(t, COMMA, depth)]) {
    const r = cut();
    if (r == null) continue;
    if (!looksFrench(r)) return r;
    first ??= r;
  }
  return first;
}
function bySeparator(t, sep, depth) {
  const pieces = t.split(sep);
  if (pieces.length < 2) return null;
  let changed = false;
  const out = pieces.map((p, i) => {
    if (i % 2 || !/[A-Za-zÀ-ÿ]{2}/.test(p)) return englishFormats(p);
    const r = best(p.trim(), depth + 1);
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
    // Le plus grand groupe de phrases qui se traduit sans laisser de français ; sinon le premier trouvé.
    let pick = null;
    for (let n = Math.min(3, s.length - i); n >= 1; n--) {
      const chunk = s.slice(i, i + n).join(' ');
      const r = n === 1 ? best(chunk, depth + 1) : lookup(chunk, depth + 1);
      if (r == null) continue;
      if (!looksFrench(r)) { pick = { r, n }; break; }
      pick ??= { r, n };
    }
    if (pick) { out.push(pick.r); i += pick.n; changed = true; } else { out.push(englishFormats(s[i])); i++; }
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
  out = m[2] ? m[1] + translate(m[2]) + m[3] : s;
  if (cache.size > 8000) cache.clear();
  cache.set(s, out);
  if (DEV && looksFrench(out)) warnFrench(s, out);
  return out;
}
function translate(t) {
  const whole = lookup(t, 0);
  if (whole != null && !looksFrench(whole)) return whole;
  // Les noms connus deviennent des jetons : « Le (E)(D) Ferdinand a terminé… » se découpe sans hésiter.
  const p = protect(t);
  let named = null;
  if (p !== t) {
    named = best(p, 0);
    if (named != null) { named = unprotect(named); if (!looksFrench(named)) return named; }
  }
  const pieces = loose(t, 0);
  if (pieces != null && !looksFrench(pieces)) return pieces;
  return whole ?? named ?? pieces ?? englishFormats(t);
}
// Traduction d'un bloc : le texte entier d'abord ; s'il laisse du français (motif mal tombé),
// le découpage morceau par morceau peut faire mieux.
function best(t, depth) {
  const whole = lookup(t, depth);
  if (whole != null && !looksFrench(whole)) return whole;
  const pieces = loose(t, depth);
  if (pieces != null && !looksFrench(pieces)) return pieces;
  return whole ?? pieces;
}

// ---------- Texte resté en français ----------
// Mots qui ne s'écrivent pas en anglais, une fois les noms propres retirés : petits mots français,
// élisions (« d'un », « l'équipage »), et tout mot des textes français du dictionnaire qu'aucune
// traduction anglaise n'emploie (« fonds », « insuffisants »).
const FRENCH_WORD = /(^|[^\p{L}])(le|les|des|du|une|est|sont|avec|dans|sur|vers|votre|vos|aux|au|à|ou|mais|pas|très|été|être|leur|ses|sa|cette|qui|que)(?=[^\p{L}]|$)|(^|[^\p{L}])[dlj]['’][a-zà-ÿ]/u;
const WORDS = /[\p{L}'’-]+/gu;
let FR_ONLY = null;
function frenchOnly() {
  if (FR_ONLY) return FR_ONLY;
  const en = new Set();
  for (const v of [...Object.values(EN), ...Object.values(MONTHS), ...Object.values(SHORT)]) for (const w of v.toLowerCase().match(WORDS) || []) en.add(w);
  FR_ONLY = new Set();
  for (const k of Object.keys(EN)) for (const w of k.toLowerCase().match(WORDS) || []) if (w.length > 2 && !en.has(w)) FR_ONLY.add(w);
  FR_ONLY.en = en;
  return FR_ONLY;
}
const KNOWN = new Set(["Port d'Attache", "Port d'attache"]);
let knownRe = null;
function properNames() {
  if (knownRe) return knownRe;
  for (const P of Object.values(PORTS)) KNOWN.add(P.name);
  for (const c of COUNTRIES) KNOWN.add(c.n).add(EXACT.get(c.n));
  for (const F of Object.values(FLAGS)) KNOWN.add(F.name).add(EXACT.get(F.name));
  const all = [...KNOWN].filter((x) => x && x.length > 1).sort((a, b) => b.length - a.length);
  knownRe = new RegExp(`(^|[^\\p{L}])(${all.map(esc).join('|')})(?=[^\\p{L}]|$)`, 'gu');
  return knownRe;
}
// Mots français d'un texte affiché en anglais (hors noms propres) : [] s'il est bien traduit.
export function frenchWords(s) {
  if (!s || typeof s !== 'string' || !/[A-Za-zÀ-ÿ]{2}/.test(s)) return [];
  const t = stripNames(s).replace(properNames(), '$1 ');
  const fr = frenchOnly();
  const out = [];
  const m = FRENCH_WORD.exec(t);
  if (m) out.push((m[2] || m[0]).trim());
  for (const w of t.toLowerCase().match(WORDS) || []) {
    const x = w.replace(/^['’-]+|['’-]+$/g, '');
    if (fr.has(x) || (/[éèêàçùûœ]/.test(x) && !fr.en.has(x))) out.push(x);
  }
  return out;
}
export const looksFrench = (s) => frenchWords(s).length > 0;
// Vocabulaire français supplémentaire (tous les textes du code, pour le contrôle tools/i18n-check.mjs).
export function addFrenchVocabulary(texts) {
  const fr = frenchOnly();
  // Seulement les textes visiblement français (petits mots, accents) : pas les titres anglais, chemins, styles.
  for (const t of texts) if (FRENCH_WORD.test(t) || /[éèêàçùûœ]/.test(t)) for (const w of String(t).toLowerCase().match(WORDS) || []) {
    const x = w.replace(/^['’-]+|['’-]+$/g, '');
    if (x.length > 2 && !fr.en.has(x)) fr.add(x);
  }
}
// Mode développeur (localhost, fichier local ou ?dev) : chaque texte non traduit est signalé une fois
// dans la console et gardé dans window.__i18nMissing, pour l'ajouter à js/i18n/en.js.
const DEV = (() => {
  try {
    if (typeof location === 'undefined') return false;
    return /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || location.protocol === 'file:' || /[?&]dev\b/.test(location.search);
  } catch { return false; }
})();
const warned = new Set();
function warnFrench(fr, en) {
  if (warned.has(fr)) return;
  warned.add(fr);
  try { (window.__i18nMissing ||= []).push(fr); } catch { /* hors navigateur */ }
  console.warn('[i18n] texte non traduit — à ajouter dans js/i18n/en.js :', JSON.stringify(fr), en !== fr ? `→ ${JSON.stringify(en)}` : '');
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
