// Garde-fou de la version anglaise : échoue (code 1) s'il reste du français à l'écran.
// Usage : node tools/i18n-check.mjs [années de partie simulée, 2 par défaut]
//
// 1. Textes du code et de index.html : chacun, passé dans la traduction, ne doit plus contenir
//    de mot français (texte absent de js/i18n/en.js, ou motif qui ne s'applique pas).
// 2. Textes fabriqués en jeu (notifications, journal, historique) : une partie IA est jouée avec
//    des noms de navires et de compagnies piégés (« (E)(D) Ferdinand », « la belle poule »…),
//    une compagnie « humaine » pilotée par l'IA pour recevoir les notifications, et chaque texte
//    produit doit sortir en anglais.
// Exceptions (noms propres, textes jamais affichés) : tools/i18n-ignore.json.
// Lancé par `npm test` et par la CI : une branche qui ajoute un texte sans traduction ne passe pas.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './i18n-extract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// La traduction est active dès que la langue détectée est l'anglais.
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });
const i18n = await import('../web/js/i18n.js');
const { tr, frenchWords, registerNames, registerGameNames, addFrenchVocabulary } = i18n;
if (i18n.getLang() !== 'en') { console.error('Langue anglaise non activée'); process.exit(2); }

const IGNORE = JSON.parse(readFileSync(join(ROOT, 'tools/i18n-ignore.json'), 'utf8'));
registerNames(IGNORE.names);
const ignored = new Set(IGNORE.texts);

// ---------- 1. Textes du code ----------
const all = extract();
// index.html : nœuds de texte et attributs traduits à l'affichage.
const html = readFileSync(join(ROOT, 'web/index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
for (const m of html.matchAll(/>([^<>]+)</g)) all.push({ text: m[1].trim(), files: ['index.html'] });
for (const m of html.matchAll(/\b(?:title|aria-label|placeholder)="([^"]+)"/g)) all.push({ text: m[1], files: ['index.html'] });
// Tous les mots des textes français du jeu : un mot jamais employé en anglais trahit un oubli.
addFrenchVocabulary(all.map((e) => e.text));

const problems = [];
for (const e of all) {
  const fr = e.text.replace(/\{[a-z]\}/g, '{0}'); // gabarits maison (« Attentat à {p} »)
  if (!fr || ignored.has(e.text)) continue;
  const en = tr(fr);
  const bad = frenchWords(en);
  if (bad.length) problems.push({ where: e.files.join(','), fr: e.text, en, bad });
}

// ---------- 2. Textes produits en partie ----------
const years = Number(process.argv[2] || 2);
const { makeContext } = await import('../web/js/sim/context.js');
const { newGame, tick } = await import('../web/js/sim/game.js');
const { aiShipIdle } = await import('../web/js/sim/ai.js');
const { Rng, formatDate } = await import('../web/js/sim/util.js');
const { isIdle, shipsOf } = await import('../web/js/sim/core.js');
const TRAPS = ['(E)(D) Ferdinand', 'la belle poule', 'Étoile du Port', 'Le Havre II', 'St. Malo Express', 'Vent', 'Mer du Nord', 'Sans-Souci'];
const ctx = makeContext();
const state = newGame({
  seed: 4242, duration: 0, difficulty: 'normal',
  companies: [
    { name: 'Armement du Ponant', human: true, homePort: 'rotterdam' },
    { name: 'la Compagnie des Îles', human: false, homePort: 'singapour' },
    { name: 'Houston (Fils) & Cie', human: false, homePort: 'houston' },
    { name: 'Bandar Ombre', human: false, homePort: 'bandar_abbas' },
  ],
}, ctx);
const seen = new Map();
const keep = (text, kind) => {
  if (typeof text !== 'string' || !/[A-Za-zÀ-ÿ]{2}/.test(text)) return;
  const shape = text.replace(/\d[\d\s.,]*/g, '#');
  if (!seen.has(shape)) seen.set(shape, { text, kind });
};
// Toutes les chaînes d'un objet qui ressemblent à une phrase (les noms sont laissés de côté).
function walk(o, path) {
  if (typeof o === 'string') { if (/\s/.test(o) && /[A-Za-zÀ-ÿ]{3}/.test(o)) keep(o, path); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) if (!['name', 'captain', 'captainName', 'kind', 'type', 'id'].includes(k)) walk(v, Array.isArray(o) ? path : k);
}
const rng = new Rng(99);
let named = 0;
for (let d = 0; d < years * 365 && !state.over; d++) {
  // Noms piégés pour chaque nouveau navire.
  for (; named < state.ships.length; named++) state.ships[named].name = TRAPS[named % TRAPS.length] + (named >= TRAPS.length ? ` ${Math.floor(named / TRAPS.length) + 1}` : '');
  registerGameNames(state);
  const notes = tick(state, ctx, 24);
  for (const n of notes) walk(n, `notification ${n.kind}`);
  // La compagnie « humaine » reçoit des navires des IA et de quoi les faire tourner ; l'IA la conduit
  // navire par navire pour produire ses notifications.
  const me = state.companies[0];
  me.cash = Math.max(me.cash, 50e6);
  if (d % 20 === 0 && shipsOf(state, 0).length < 8) {
    const give = state.ships.find((s) => s.owner !== 0 && isIdle(s) && shipsOf(state, s.owner).length > 1);
    if (give) give.owner = 0;
  }
  for (const ship of shipsOf(state, 0)) if (isIdle(ship)) aiShipIdle(state, ctx, rng, ship);
}
// Le journal tel qu'il s'affiche aussi dans les listes : « 19 janv. 2027 · Crise mondiale… ».
for (const n of state.news) { keep(n.text, 'journal'); keep(`${formatDate(n.t, true)} · ${n.text}`, 'journal daté'); }
// Chaque événement mondial, même ceux que la partie n'a pas tirés (sur une copie de la partie).
const { EVENTS } = await import('../web/js/sim/events.js');
for (const ev of EVENTS) for (let k = 0; k < 4; k++) {
  const copy = structuredClone(state);
  if (ev.possible && !ev.possible(copy)) continue;
  try {
    const r = ev.run(copy, new Rng(1000 + k));
    keep(`${r.title} — ${r.text}`, `événement ${ev.id}`);
    keep(`${formatDate(copy.t, true)} · ${r.title} — ${r.text}`, `événement ${ev.id}`);
    for (const n of copy.news.slice(0, 3)) keep(n.text, `événement ${ev.id}`);
  } catch (e) { console.log(`événement ${ev.id} : ${e.message}`); }
}
// Autres textes gardés dans la sauvegarde (historiques, journaux de bord).
walk(state, 'état');
let runtime = 0;
for (const { text, kind } of seen.values()) {
  const en = tr(text);
  const bad = frenchWords(en);
  if (bad.length) { runtime++; problems.push({ where: `partie:${kind}`, fr: text, en, bad }); }
}

// ---------- Bilan ----------
for (const p of problems) console.log(`${p.where}\n  FR ${JSON.stringify(p.fr)}\n  EN ${JSON.stringify(p.en)}\n  mots français : ${[...new Set(p.bad)].join(', ')}`);
console.log(`\n${all.length} textes du code et ${seen.size} textes de partie vérifiés : ${problems.length - runtime} + ${runtime} encore en français.`);
if (problems.length) {
  console.log('Ajoutez la traduction dans web/js/i18n/en.js (ou, pour un nom propre ou un texte jamais affiché, dans tools/i18n-ignore.json).');
  process.exit(1);
}
