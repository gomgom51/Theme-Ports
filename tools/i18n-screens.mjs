// Garde-fou de la version anglaise, à l'écran : le jeu tourne en anglais dans un navigateur caché
// et chaque texte réellement affiché doit être en anglais. Il attrape ce que tools/i18n-check.mjs
// ne peut pas voir dans le code : les morceaux recollés à l'exécution (chacun traduit seul, mais
// affichés ensemble dans un seul nœud de texte), les mots isolés (« rares »), les étiquettes de
// statut, le français resté autour d'un nom dans un élément data-no-tr.
//
// Parcours : écran d'accueil, nouvelle partie, chargement ; une partie de deux ans (noms piégés,
// compagnie « humaine » conduite par l'IA) dont chaque notification passe par le jeu lui-même
// (bulles, fenêtres, scènes animées : app.handleNotes) ; le menu ☰ ; tous les panneaux et tous
// leurs onglets (flotte, courtier, bureau, marchés, journal, aide, alertes, codex, victoires,
// chaque navire du joueur et trois rivaux, chaque port) ; l'écran de fin.
// Relevé : nœuds de texte, infobulles (title), aria-label, placeholder, et les textes de la carte
// passés par tr() (mode développeur, window.__i18nMissing).
//
// Usage : node tools/i18n-screens.mjs [jours de partie, 730 par défaut] [graine, 4242 par défaut]
// Il faut Playwright (déjà là dans les sessions Claude Code). Pas dans la CI (choix du propriétaire) :
// lancé à chaque version groupée, avec `npm test`. Sans Playwright installé : playwright-core + Chrome.
// Exceptions : tools/i18n-ignore.json, comme pour tools/i18n-check.mjs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { extract } from './i18n-extract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAYS = Number(process.argv[2] || 730);
const SEED = Number(process.argv[3] || 4242);
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('playwright-core'); }

// ---------- Le dossier web/, servi sur localhost (le mode développeur s'y allume) ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' };
const WEB = join(ROOT, 'web');
const server = createServer(async (req, res) => {
  const file = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '') || 'index.html';
  try {
    const body = await readFile(join(WEB, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

const browser = await pw.chromium.launch().catch(() => pw.chromium.launch({ channel: 'chrome' }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('pda-lang', 'en'); } catch { /* stockage indisponible */ } });
await page.goto(`http://localhost:${server.address().port}/?dev`);
await page.waitForFunction(() => window.__app?.handleNotes);
await page.waitForTimeout(800);
await page.keyboard.press('Space'); // passe l'intro
await page.waitForTimeout(800);

// ---------- Relevé de l'écran (dans la page) ----------
const IGNORE = JSON.parse(readFileSync(join(ROOT, 'tools/i18n-ignore.json'), 'utf8'));
await page.evaluate(async ({ texts, names, ignored }) => {
  const m = await import('./js/i18n.js');
  m.addFrenchVocabulary(texts); // tous les mots des textes français du code, comme tools/i18n-check.mjs
  m.registerNames(names);
  const skip = new Set(ignored);
  const found = (window.__frLeft = new Map());
  const where = (el) => {
    const out = [];
    for (let e = el; e && e !== document.body && out.length < 4; e = e.parentElement) {
      const c = (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      if (c) out.unshift(c);
    }
    return out.join(' > ');
  };
  const add = (txt, label, how) => {
    const k = txt.trim();
    if (!k || skip.has(k) || found.has(k)) return;
    const bad = m.frenchWords(k);
    if (bad.length) found.set(k, { text: k, words: [...new Set(bad)], where: `${label} · ${how}` });
  };
  window.__scan = (label) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) {
        const el = n.parentElement;
        if (!el || el.closest('script,style,textarea,[hidden]') || !/[A-Za-zÀ-ÿ]{2}/.test(n.nodeValue)) continue;
        // data-no-tr : les noms restent tels quels (frenchWords les ignore), mais pas le texte autour.
        add(n.nodeValue, label, `${el.closest('[data-no-tr]') ? 'texte (data-no-tr)' : 'texte'} · ${where(el)}`);
      } else {
        for (const a of ['title', 'aria-label', 'placeholder']) { const v = n.getAttribute(a); if (v) add(v, label, `${a} · ${where(n)}`); }
      }
    }
    for (const t of window.__i18nMissing || []) add(m.tr(t), label, 'tr() (carte, canevas)');
  };
  // Ferme fenêtres, scènes et bulles (sans rien accepter : clic à côté, ou « Annuler »).
  window.__closeAll = () => {
    for (const wrap of document.querySelectorAll('.dialog-wrap')) {
      wrap.click();
      if (wrap.isConnected) wrap.querySelector('.dialog-buttons .btn.ghost')?.click();
      if (wrap.isConnected) wrap.remove();
    }
    document.querySelectorAll('.scene-wrap').forEach((e) => e.remove());
    document.querySelectorAll('#toasts .toast').forEach((e) => e.remove());
  };
}, { texts: extract().map((e) => e.text), names: IGNORE.names, ignored: IGNORE.texts });

const scan = (label) => page.evaluate((l) => new Promise((ok) => setTimeout(() => { window.__scan(l); ok(); }, 0)), label);
const step = async (label, fn) => { await page.evaluate(fn); await page.waitForTimeout(30); await scan(label); };

// ---------- Accueil ----------
await scan('accueil');
await step('nouvelle partie', async () => { const { setupScreen } = await import('./js/ui/screens.js'); setupScreen(window.__app); });
await step('chargement', async () => { const { loadScreen } = await import('./js/ui/screens.js'); loadScreen(window.__app); });

// ---------- Une partie, notifications jouées par le jeu ----------
await page.evaluate((seed) => {
  window.__seed = seed;
  window.__app.newGame({
    seed, duration: 0, difficulty: 'normal', autoPause: false, guide: false,
    companies: [
      { name: 'Armement du Ponant', human: true, homePort: 'rotterdam' },
      { name: 'la Compagnie des Îles', human: false, homePort: 'singapour' },
      { name: 'Houston (Fils) & Cie', human: false, homePort: 'houston' },
      { name: 'Bandar Ombre', human: false, homePort: 'bandar_abbas' },
    ],
  });
}, SEED);
await page.waitForTimeout(300);
await scan('début de partie');
for (let d = 0; d < DAYS; d += 10) {
  await page.evaluate(async ({ from, n }) => {
    const app = window.__app, st = app.state;
    const { tick } = await import('./js/sim/game.js');
    const { aiShipIdle } = await import('./js/sim/ai.js');
    const { Rng } = await import('./js/sim/util.js');
    const { isIdle, shipsOf } = await import('./js/sim/core.js');
    const { registerGameNames } = await import('./js/i18n.js');
    // Noms piégés, comme tools/i18n-check.mjs.
    const TRAPS = ['(E)(D) Ferdinand', 'la belle poule', 'Étoile du Port', 'Le Havre II', 'St. Malo Express', 'Vent', 'Mer du Nord', 'Sans-Souci'];
    const rng = (window.__rng ||= new Rng(window.__seed + 1));
    window.__named ||= 0;
    for (let k = 0; k < n && !st.over; k++) {
      for (; window.__named < st.ships.length; window.__named++) {
        const i = window.__named;
        st.ships[i].name = TRAPS[i % TRAPS.length] + (i >= TRAPS.length ? ` ${Math.floor(i / TRAPS.length) + 1}` : '');
      }
      registerGameNames(st);
      // La compagnie « humaine » reçoit des navires des IA et de quoi les faire tourner.
      st.companies[0].cash = Math.max(st.companies[0].cash, 50e6);
      if ((from + k) % 20 === 0 && shipsOf(st, 0).length < 8) {
        const give = st.ships.find((s) => s.owner !== 0 && isIdle(s) && shipsOf(st, s.owner).length > 1);
        if (give) give.owner = 0;
      }
      for (const ship of shipsOf(st, 0)) if (isIdle(ship) && !ship.hijacked) aiShipIdle(st, app.ctx, rng, ship);
      const notes = tick(st, app.ctx, 24);
      if (notes.length) app.handleNotes(notes);
      await new Promise((ok) => setTimeout(ok, 0)); // laisse la traduction passer
      window.__scan(`partie, jour ${from + k}`);
      window.__closeAll();
    }
  }, { from: d, n: Math.min(10, DAYS - d) });
}
await page.evaluate(() => window.__app.refresh());
await scan('carte et barre du haut');
await page.click('#hud-menu');
await page.waitForTimeout(100);
await scan('menu ☰');
await page.evaluate(() => window.__closeAll());

// ---------- Tous les panneaux, tous les onglets ----------
const panels = await page.evaluate(async () => {
  const st = window.__app.state;
  const { PORTS } = await import('./js/data/ports.js');
  const mine = st.ships.filter((s) => s.owner === 0).map((s) => s.id);
  const rivals = st.ships.filter((s) => s.owner !== 0).slice(0, 3).map((s) => s.id);
  return [['fleet'], ['broker'], ['office'], ['markets'], ['news'], ['help'], ['alerts'], ['codex'],
    ...['domination', 'reputation', 'legend', 'shadow'].map((v) => ['victory', v]),
    ...[...mine, ...rivals].map((id) => ['ship', id]),
    ...Object.keys(PORTS).map((id) => ['port', id])];
});
for (const [type, id] of panels) {
  const label = `panneau ${type}${id != null ? ' ' + id : ''}`;
  await page.evaluate(({ type, id }) => { window.__closeAll(); window.__app.open(type, id ?? null); }, { type, id });
  await page.waitForTimeout(20);
  await scan(label);
  const tabs = await page.$$eval('#panel .tabs [data-tab]', (b) => b.map((x) => x.dataset.tab));
  for (const t of tabs.slice(1)) {
    await page.evaluate((t) => window.__app.openTab(t), t);
    await page.waitForTimeout(20);
    await scan(`${label} / ${t}`);
  }
}
await page.evaluate(() => window.__app.close());

// ---------- Fin de partie ----------
await step('fin de partie', async () => {
  const app = window.__app;
  const { endScreen } = await import('./js/ui/screens.js');
  app.state.over = { reason: 'Fin de la partie : 10 ans se sont écoulés.', t: app.state.t };
  endScreen(app);
});

const days = await page.evaluate(() => Math.round(window.__app.state.t / 24));
const left = await page.evaluate(() => [...window.__frLeft.values()]);
await browser.close();
server.close();
for (const e of left) console.log(`${e.where}\n  EN ${JSON.stringify(e.text)}\n  mots français : ${e.words.join(', ')}`);
if (errors.length) console.log(`\nErreurs dans la page :\n  ${[...new Set(errors)].slice(0, 10).join('\n  ')}`);
console.log(`\nPartie de ${days} jours (graine ${SEED}), ${panels.length} panneaux : ${left.length} textes encore en français à l'écran.`);
if (left.length) console.log('Ajoutez la traduction dans web/js/i18n/en.js, ou affichez les morceaux recollés dans des nœuds de texte séparés.');
process.exit(left.length || errors.length ? 1 : 0);
