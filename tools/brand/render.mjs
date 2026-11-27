// Fabrique les icônes et les visuels Steam qui ne demandent que le logo (ui/brand.js).
// Usage : node tools/brand/render.mjs [dossier de sortie supplémentaire]
// Besoin de Playwright et de Chromium (npm i -D playwright && npx playwright install chromium) ; pas lancé par la CI.
//
// Écrit :
//   web/icon.svg, web/icons/icon-16|32|192|512.png                  icône du jeu (onglet, manifeste)
//   store/icons/icon-16|32|256.png, store/icons/app.ico              icône de l'application de bureau
//   store/steam/capsule_small_462x174.png                            petite capsule
//   store/steam/library_logo_1280x720.png                            logo de la bibliothèque (transparent)
//   store/steam/community_icon_184x184.jpg                           icône de la communauté
//   store/steam/client_icon.ico                                      icône du client Steam (16 et 32)
//   store/brand/plaque*.png, seal.svg, anchor-*.svg                  logo seul, pour la presse et le site
// Les capsules à illustration (en-tête, principale, verticale, bibliothèque, héros) attendent le style des navires.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appIconSVG, sealSVG, anchorShapes, BRAND } from '../../web/js/ui/brand.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(import.meta.url)('playwright');
const ORIGIN = 'http://brand.local';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

// [fichier, visuel de sheet.html, largeur, hauteur, options]
const SHOTS = [
  ['web/icons/icon-192.png', 'icon', 192, 192],
  ['web/icons/icon-512.png', 'icon', 512, 512],
  ['web/icons/icon-16.png', 'icon16', 16, 16],
  ['web/icons/icon-32.png', 'icon', 32, 32],
  ['store/icons/icon-16.png', 'icon16', 16, 16],
  ['store/icons/icon-32.png', 'icon', 32, 32],
  ['store/icons/icon-256.png', 'icon', 256, 256],
  ['store/steam/capsule_small_462x174.png', 'capsuleSmall', 462, 174],
  ['store/steam/library_logo_1280x720.png', 'libraryLogo', 1280, 720],
  ['store/steam/community_icon_184x184.jpg', 'iconSquare', 184, 184, { type: 'jpeg', quality: 95 }],
  ['store/steam/client_icon_16.png', 'icon16Square', 16, 16],
  ['store/steam/client_icon_32.png', 'iconSquare', 32, 32],
  ['store/brand/plaque.png', 'plaque', 1200, 570],
  ['store/brand/plaque-sans-accroche.png', 'plaqueNoTagline', 1200, 462],
];

// Fichier .ico fait d'images PNG (Windows Vista et suivants).
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const out = (f) => join(ROOT, f);
for (const d of ['web/icons', 'store/icons', 'store/steam', 'store/brand']) await mkdir(out(d), { recursive: true });

// Fichiers vectoriels : écrits directement depuis ui/brand.js.
const svg = (body, view = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">${body}</svg>\n`;
await writeFile(out('web/icon.svg'), appIconSVG(0) + '\n');
await writeFile(out('store/brand/seal.svg'), sealSVG(0) + '\n');
for (const [name, fill] of [['marine', BRAND.navy], ['creme', BRAND.cream], ['noir', '#000000'], ['blanc', '#ffffff']]) {
  await writeFile(out(`store/brand/anchor-${name}.svg`), svg(anchorShapes(fill)));
}

// Images : la planche est servie depuis le dépôt sous une adresse fictive (aucun serveur local).
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
await page.route(`${ORIGIN}/**`, async (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  try {
    route.fulfill({ body: await readFile(join(ROOT, path)), contentType: TYPES[extname(path)] || 'application/octet-stream' });
  } catch { route.fulfill({ status: 404, body: 'introuvable' }); }
});
page.on('pageerror', (e) => { console.error('Erreur dans la planche :', e.message); process.exitCode = 1; });
await page.goto(`${ORIGIN}/tools/brand/sheet.html`);
await page.waitForFunction(() => window.ready);
const shots = {};
for (const [file, kind, w, h, opts = {}] of SHOTS) {
  await page.evaluate(([k, W, H]) => window.draw(k, W, H), [kind, w, h]);
  const data = await page.locator('#cap').screenshot({ omitBackground: opts.type !== 'jpeg', ...opts });
  await writeFile(out(file), data);
  shots[file] = data;
  console.log(`${file}  ${w}×${h}`);
}
await browser.close();
await writeFile(out('store/icons/app.ico'), ico([16, 32, 256].map((s) => ({ size: s, data: shots[`store/icons/icon-${s}.png`] }))));
await writeFile(out('store/steam/client_icon.ico'), ico([16, 32].map((s) => ({ size: s, data: shots[`store/steam/client_icon_${s}.png`] }))));
console.log('store/icons/app.ico, store/steam/client_icon.ico');

// Copie vers un dossier supplémentaire (fichiers du projet, par exemple).
const extra = process.argv[2];
if (extra) {
  for (const f of [...SHOTS.map((s) => s[0]), 'web/icon.svg', 'store/icons/app.ico', 'store/steam/client_icon.ico', 'store/brand/seal.svg']) {
    const dest = join(extra, f.replace(/^(web|store)\//, ''));
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(out(f), dest);
  }
  console.log(`copié dans ${extra}`);
}
