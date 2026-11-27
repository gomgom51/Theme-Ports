// Vérifie que chaque émoji du jeu a son dessin dans la police d'icônes (tools/icons), et que la plage
// unicode de la @font-face suit la liste. Un émoji sans dessin s'afficherait en émoji système, hors du style.
// Nouvel émoji : le dessiner dans tools/icons (more.mjs), le déclarer dans cps.mjs, puis node tools/icons/build.mjs ;
// ou, s'il doit rester du texte (flèches, coches, boutons de lecture), l'ajouter à TEXT_GLYPHS ci-dessous.
import fs from 'fs';
import path from 'path';
import { EM, CPS, unicodeRange } from './icons/all.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Restent du texte, dans la police du texte : symboles typographiques et commandes simples.
const TEXT_GLYPHS = new Set([...'▶▲▼▴▾■●◎◐☆♪♫❚☰✕✖✔✓✎✚⇄↔↕↩↪⬆⬇⬅➡™©®‼⁉ℹ↗↘↙↖']);
const drawn = new Set(Object.values(CPS).flat());
const problems = [];
for (const n of Object.keys(CPS)) if (!EM[n]) problems.push(`cps.mjs : « ${n} » n'a pas de dessin`);

const missing = new Map();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs|html|css)$/.test(e.name)) {
      for (const ch of fs.readFileSync(p, 'utf8').matchAll(/\p{Extended_Pictographic}/gu)) {
        const c = ch[0];
        if (drawn.has(c) || TEXT_GLYPHS.has(c) || c === '✈') continue;
        if (!missing.has(c)) missing.set(c, new Set());
        missing.get(c).add(path.relative(root, p));
      }
    }
  }
};
walk(path.join(root, 'web'));
for (const [c, files] of missing) problems.push(`${c} (U+${c.codePointAt(0).toString(16).toUpperCase()}) sans dessin : ${[...files].slice(0, 3).join(', ')}`);

const css = fs.readFileSync(path.join(root, 'web/css/style.css'), 'utf8');
const m = css.match(/@font-face \{ font-family: 'PdaIcons';[^}]*unicode-range: ([^;]*);/);
if (!m) problems.push("style.css : @font-face 'PdaIcons' introuvable");
else if (m[1].trim() !== unicodeRange()) problems.push('style.css : unicode-range de PdaIcons pas à jour (node tools/icons/build.mjs)');
if (!fs.existsSync(path.join(root, 'web/fonts/pda-icons.woff2'))) problems.push('web/fonts/pda-icons.woff2 manquant (node tools/icons/build.mjs)');

if (problems.length) {
  console.error(`Icônes : ${problems.length} problème(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Icônes : ${drawn.size} émojis dessinés, tous couverts.`);
