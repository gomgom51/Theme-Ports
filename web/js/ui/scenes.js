// Scènes d'événements : petites animations en pixel art, dessinées dans le code, montrées
// dans une fenêtre qui arrête le temps (naufrage, pirates, douane, garde-côtes, colis livré,
// détention, marée noire, et les événements mondiaux de scenes-world.js).
// Un son facultatif par scène : sons/scene-<nom>.mp3.
import { h } from './dom.js';
import { W, H, hash, clamp01, ease, rgb, R, bands, sea, stars, vignette, cone, person, crate, skiff, wake, patrolBoat, heli, seal, padlock, quay, gulls, DAY, NIGHT, STORM, line, rain, board, cloud, disc, smoke, flame } from './pixel.js';
import { WORLD_SCENES } from './scenes-world.js';
import { HONOUR_SCENES } from './scenes-honours.js';
const sea_ = (...a) => sea(...a); // (la variable « sea » sert aussi de drapeau dans les scènes des glaces)
import { SHIP_TYPES } from '../data/ships.js';
import { getLang } from '../i18n.js';
import { KEYS, readFlag, writeFlag } from './storage.js';
import { sceneShip } from './sceneship.js';
import { drawOfficeShot, officeLeft } from './officescene.js';

// Le navire de la scène (sceneship.js) : son modèle, à l'échelle, posé par l'étrave.
// Étrave qui centre le navire en cx, sans dépasser maxBow : un grand navire déborde à gauche.
const bowAt = (sh, cx, maxBow = 196) => Math.min(maxBow, Math.round(cx + sh.len / 2));
// Un personnage (3 × 7) debout sur la rangée floor.
const stand = (floor) => Math.round(floor) - 7;
// Pont sous l'abscisse x, pour un navire posé en (bx, wy).
const deckUnder = (sh, bx, wy, x) => Math.round(wy + sh.deck(clamp01(sh.fr(x - bx))));
// Passerelle en marches, du pont (x, y0) jusqu'au quai (y1), vers la droite.
function gangway(g, x, y0, y1, c = '#8a6a3a') { for (let i = 0; i * 2 < y1 - y0; i++) R(g, x + i * 2, y0 + i * 2, 3, 1, c); }

// Lettres de pixels (5 × 7) pour les gros titres des journaux.
const GLYPHS = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
};
function pixelWord(g, word, x, y, k, c) {
  [...word].forEach((ch, i) => (GLYPHS[ch] || []).forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') R(g, x + (i * 6 + rx) * k, y + ry * k, k, k, c); })));
}
// La une d'un journal (centrée sur 0, 0 ; 124 × 84) : la photo est aux couleurs de la compagnie.
function newspaper(g, color, word) {
  R(g, -59, -39, 124, 84, 'rgba(0,0,0,0.45)');
  R(g, -62, -42, 124, 84, '#f2eee2');
  R(g, -58, -38, 116, 9, '#1d1d1d');
  for (let i = 0; i < 12; i++) R(g, -50 + i * 8.5, -35, 5, 3, '#f2eee2'); // le titre du journal
  R(g, -58, -28, 116, 1, '#1d1d1d'); R(g, -58, -26, 116, 0.6, '#1d1d1d');
  const k = 2, w = word.length * 6 * k - k;
  pixelWord(g, word, -w / 2, -23, k, '#b8322a');
  // La photo : un dirigeant qui se cache derrière sa mallette, bandeau noir sur les yeux.
  R(g, -58, -6, 46, 36, '#cfc9ba'); R(g, -58, -6, 46, 5, color);
  disc(g, -35, 8, 5, '#6e6a62'); R(g, -44, 14, 18, 16, '#4a4842'); R(g, -40, 6, 10, 2, '#111');
  R(g, -50, 15, 10, 8, '#7a5232'); R(g, -46, 14, 2, 1, '#5a3a22');
  // Les colonnes de texte.
  for (let col = 0; col < 2; col++) for (let r = 0; r < 12; r++) {
    const x = -6 + col * 33, len = r % 5 === 4 ? 18 : 29;
    R(g, x, -6 + r * 3, len, 1.3, '#7a7468');
  }
}

// Silhouette d'un modèle pour les scènes : pétrolier, vraquier ou cargo / porte-conteneurs.
export function shipKind(type) {
  const holds = SHIP_TYPES[type]?.holds || [];
  if (holds.some((h) => ['liquide', 'chimique', 'gpl', 'gnl'].includes(h))) return 'tank';
  return holds[0] === 'vrac' ? 'bulk' : 'box';
}
// Pavillon de compagnie qui claque au vent (6 × 4, bande blanche), hampe en x, sommet en y.
function companyFlag(g, x, y, color, t, raise = 1, pole = 14) {
  R(g, x, y, 1, pole, '#d8d8d8');
  const fy = Math.round(y + (1 - raise) * (pole - 4));
  for (let c = 0; c < 6; c++) {
    const dy = Math.round(Math.sin(t * 7 - c * 0.9) * (c / 6) * 1.2);
    R(g, x + 1 + c, fy + dy, 1, 4, color); R(g, x + 1 + c, fy + dy + 1, 1, 1, '#f4f4f4');
  }
}

const PI = Math.PI;

// ---------- Glaces ----------
const ICE_C = { ice: '#dceaf2', shade: '#b8d0de', crack: '#8fb0c4', snow: '#f4f8fb' };
// Neige qui tombe en tourbillonnant (densité n, vitesse v).
function snow(g, t, n = 60, v = 14, wind = 6) {
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 71) % (W + 20) + t * wind + Math.sin(t * 1.3 + i) * 3) % (W + 20) - 10;
    const y = (hash(i, 72) % H + t * (v + (i % 5) * 2)) % H;
    R(g, x, y, i % 7 ? 1 : 2, i % 7 ? 1 : 2, ICE_C.snow);
  }
}
// Banquise sur une rangée de mer, de x0 à x1, avec ses fissures.
function iceRow(g, y, x0, x1, crackSeed = 0) {
  if (x1 <= x0) return;
  R(g, x0, y, x1 - x0, 1, (y & 3) ? ICE_C.ice : ICE_C.shade);
  for (let x = Math.ceil(x0 / 7) * 7; x < x1; x += 7) if (hash(x + crackSeed, y) % 9 === 0) R(g, x, y, 2 + (hash(x, y + 1) % 4), 1, ICE_C.crack);
}
// Port enneigé : entrepôts, grue et lampadaires (quai à droite).
function snowyQuay(g, t, lights = 1) {
  R(g, 150, 70, 50, 42, '#5b6068'); R(g, 150, 70, 50, 2, ICE_C.snow);
  R(g, 160, 50, 30, 20, '#7a6a5e'); R(g, 158, 48, 34, 3, ICE_C.snow); R(g, 168, 60, 6, 10, '#3b332d');
  R(g, 188, 30, 2, 40, '#a8823a'); R(g, 166, 30, 26, 2, '#a8823a'); R(g, 166, 29, 26, 1, ICE_C.snow); R(g, 170, 32, 1, 10, '#555');
  for (const x of [154, 196]) {
    R(g, x, 58, 1, 12, '#3c434c'); R(g, x - 1, 56, 3, 2, lights ? '#ffd98a' : '#8a8f96');
    if (lights) cone(g, x, 58, x - 8, 72, x + 8, 72, '#ffd98a', 0.15 + 0.03 * Math.sin(t * 7 + x));
  }
}
// Plaque de glace vue en perspective (ellipse aplatie), centre (cx, cy), demi-largeur r.
function floe(g, cx, cy, r, seed = 0) {
  const rh = Math.max(1, r * 0.32);
  for (let y = Math.ceil(cy - rh); y <= cy + rh; y++) {
    if (y < 56 || y >= H) continue;
    const half = r * Math.sqrt(Math.max(0, 1 - ((y - cy) / rh) ** 2));
    iceRow(g, y, Math.round(cx - half), Math.round(cx + half), seed);
  }
}
const FLOES = Array.from({ length: 16 }, (_, k) => ({ x: hash(k, 73) % W, y: 58 + (hash(k, 74) % 52), r: 6 + (hash(k, 75) % 12) }));
function polarBear(g, x, y, step) {
  R(g, x, y, 10, 4, '#f2efe6'); R(g, x + 9, y - 1, 4, 3, '#f2efe6'); R(g, x + 12, y, 1, 1, '#1b1b1b');
  R(g, x + 1, y + 4, 2, 2 - step, '#e4e0d4'); R(g, x + 7, y + 4, 2, 1 + step, '#e4e0d4');
}
function icebreaker(g, x, y) { // brise-glace (proue à droite)
  R(g, x - 16, y - 4, 34, 4, '#c0392b'); R(g, x + 18, y - 3, 3, 2, '#c0392b'); R(g, x - 14, y, 30, 2, '#1d1d1d');
  R(g, x - 10, y - 12, 14, 8, '#f4f4f4'); R(g, x - 8, y - 10, 10, 2, '#24323c'); R(g, x - 6, y - 17, 5, 5, '#e3b33b'); R(g, x - 6, y - 17, 5, 1, '#1b1b1b');
}

// ---------- Incidents ----------
// Remorqueur vu de profil (proue vers dir : 1 à droite, -1 à gauche), flottaison à y.
function tugSide(g, x, y, dir = 1) {
  x = Math.round(x); y = Math.round(y);
  R(g, x - 9, y - 3, 18, 3, '#b8332c'); R(g, x - 8, y, 16, 1, '#1d1d1d');
  R(g, x + (dir > 0 ? 6 : -9), y - 4, 3, 1, '#b8332c');
  R(g, x - 3 - dir, y - 8, 7, 5, '#f4f4f4'); R(g, x - 2 - dir, y - 7, 5, 1, '#24323c');
  R(g, x - dir * 4, y - 11, 2, 3, '#e3b33b');
}
// Gerbe de particules (étincelles, débris, embruns) issue de (x, y) à l'instant k (0 → 1).
function burst(g, x, y, k, n, cols, spread = 18, up = 16, seed = 0) {
  if (k < 0 || k > 1) return;
  for (let i = 0; i < n; i++) {
    const vx = ((hash(i, seed) % 200) / 100 - 1) * spread, vy = (0.3 + (hash(i, seed + 1) % 100) / 140) * up;
    R(g, x + vx * k, y - vy * k + 20 * k * k, 1 + (i % 3 === 0), 1, cols[i % cols.length]);
  }
}

export const SCENES = {
  // Naufrage : tempête de nuit, le navire s'incline et sombre, l'hélicoptère hélitreuille l'équipage.
  sunk: {
    title: 'Naufrage !', mood: 'bad', loop: [5.6, 7.6],
    draw(g, t, o) {
      const flash = t > 0.8 && (t % 3.7) < 0.12;
      g.drawImage(bands('sky-storm', flash ? ['#4a5d86', '#5b6f99', '#6c80aa'] : ['#05080f', '#0b1222', '#121c33', '#1a2945'], 58), 0, 0);
      if (flash) { g.strokeStyle = '#fffbe6'; g.lineWidth = 1; g.beginPath(); g.moveTo(150, 0); g.lineTo(144, 18); g.lineTo(152, 22); g.lineTo(146, 44); g.stroke(); }
      sea(g, t, STORM, 58, 58, H, 2);
      // Le navire sombre par la poupe, l'étrave se dresse (moins haut pour un grand navire).
      const p = clamp01((t - 1) / 4.8), sh = sceneShip(o);
      const bx = bowAt(sh, 112), wy = 76 + 22 * Math.pow(p, 1.7);
      const slope = -Math.atan(Math.min(0.45, 30 / sh.len) * ease(p * 1.6));
      sh.draw(g, bx, wy, { slope });
      sea(g, t, STORM, 58, 77, H, 2); // l'eau recouvre ce qui a sombré
      const mx = Math.max(56, bx - sh.len * 0.55);
      if (p > 0.55) for (let i = 0; i < 6; i++) { const k = (t * 0.9 + i * 0.37) % 1; R(g, mx - 7 + (hash(i, 9) % 14), 77 - k * 10, 1, 1, 'rgba(180,210,240,0.8)'); }
      // Radeau de survie et hélicoptère.
      R(g, 34, 79, 12, 3, '#f07c1f'); R(g, 35, 78, 10, 1, '#f5a04f'); person(g, 36, 72, '#f07c1f'); person(g, 41, 72, '#f07c1f');
      const hx = 30 + Math.sin(t * 1.3) * 2, hy = 20;
      cone(g, hx + 6, hy + 6, 22, 82, 52, 82, '#fff4c2', 0.13);
      const k = (t % 3) / 3, ry = 70 - k * 44;
      R(g, hx + 6, hy + 7, 1, Math.max(1, ry - hy - 7), '#d8d8d8'); person(g, hx + 5, ry, '#f07c1f');
      heli(g, hx, hy, t);
      for (let i = 0; i < 70; i++) { const x = (hash(i, 4) % (W + 40) + t * 70) % (W + 40) - 20, y = (hash(i, 5) % H + t * 150) % H; R(g, x, y, 1, 1, 'rgba(160,190,230,0.55)'); R(g, x - 1, y + 1, 1, 1, 'rgba(160,190,230,0.4)'); }
      vignette(g, 'rgba(0,0,0,A)', 0.5);
    },
  },
  // Pirates : les skiffs abordent, les pirates montent à bord et hissent leur drapeau.
  hijack: {
    title: 'Navire détourné par des pirates', mood: 'bad', loop: [4.4, 6.4],
    draw(g, t, o) {
      g.drawImage(bands('sky-haze', ['#f0d9a4', '#e6c58f', '#cdb894', '#a4b8b9', '#8aaeb8'], 58), 0, 0);
      sea(g, t, DAY, 58);
      const bob = Math.round(Math.sin(t * 2) * 0.8), sh = sceneShip(o);
      const bx = bowAt(sh, 112, 194), wy = 77 + bob;
      sh.draw(g, bx, wy);
      // L'échelle se dresse contre la coque, au tiers arrière ; les skiffs s'arrêtent dessous.
      const ladderX = Math.round(bx + sh.x(0.3)), deckY = Math.round(wy + sh.rim(0.3));
      const p = ease(t / 2), sx = -24 + p * (ladderX - 20 + 24);
      skiff(g, sx, 80, 1, 3, t); skiff(g, sx - 14, 86, 1, 2, t);
      if (p < 1) { wake(g, sx, 82, 1, t); wake(g, sx - 14, 88, 1, t); }
      const lp = clamp01((t - 2) / 0.6);
      if (lp > 0) { const top = 79 - lp * (79 - deckY); R(g, ladderX, top, 1, 79 - top, '#8a6a3a'); R(g, ladderX + 3, top, 1, 79 - top, '#8a6a3a'); for (let y = top; y < 79; y += 3) R(g, ladderX, y, 4, 1, '#8a6a3a'); }
      for (let i = 0; i < 3; i++) {
        const c = clamp01((t - 2.5 - i * 0.45) / 0.9);
        if (c <= 0) continue;
        const x = ladderX + (c >= 1 ? 4 + i * 6 + Math.min(10, (t - 3.4 - i * 0.45) * 8) : 0);
        const y = c < 1 ? 74 - c * (74 - (deckY - 7)) : stand(deckUnder(sh, bx, wy, x + 1));
        person(g, x, y, i % 2 ? '#3a3a3a' : '#5a4a3a', { hat: i === 1 ? '#7a1f22' : null, step: Math.floor(t * 6) % 2 });
      }
      // Leur drapeau monte au mât de l'avant.
      const fp = clamp01((t - 3.9) / 0.7);
      if (fp > 0) {
        const fx = Math.round(bx + sh.x(0.9)), base = deckUnder(sh, bx, wy, fx), fy = base - 4 - Math.round(fp * 8);
        R(g, fx, base - 13, 1, 13, '#6d747c'); R(g, fx + 1, fy, 6, 4, '#111'); R(g, fx + 3, fy + 1, 2, 2, '#eee'); if (Math.floor(t * 4) % 2) R(g, fx + 7, fy + 1, 1, 2, '#111');
      }
      vignette(g, 'rgba(150,20,20,A)', 0.25 + 0.15 * clamp01((t - 3.5) / 1) * (0.7 + 0.3 * Math.sin(t * 4)));
    },
  },
  // Attaque repoussée : lances à eau, échelles qui tombent, skiffs qui s'enfuient.
  repelled: {
    title: 'Attaque repoussée', mood: 'good', loop: [5, 7],
    draw(g, t, o) {
      g.drawImage(bands('sky-day', ['#9fd0e8', '#b3dbee', '#cbe6f2', '#e2f0f5'], 58), 0, 0);
      sea(g, t, DAY, 58);
      const bob = Math.round(Math.sin(t * 2) * 0.8), sh = sceneShip(o);
      const bx = bowAt(sh, 112, 194), wy = 77 + bob;
      sh.draw(g, bx, wy);
      for (let x = Math.round(bx + sh.x(0.15)); x < bx + sh.x(0.95); x += 2) R(g, x, Math.round(wy + sh.rim(sh.fr(x - bx))) - 2 + (x % 4 ? 0 : -1), 1, 1, '#9aa1a8'); // barbelés
      const ladderX = Math.round(bx + sh.x(0.3)), deckY = Math.round(wy + sh.rim(0.3));
      const flee = clamp01((t - 3.3) / 2), stop = ladderX - 20;
      const p = ease(t / 2), sx = flee > 0 ? stop - ease(flee) * (stop + 50) : -24 + p * (stop + 24);
      const dir = flee > 0 ? -1 : 1;
      skiff(g, sx, 80, dir, 3, t); skiff(g, sx - 14 * dir, 86, dir, 2, t);
      if (p < 1 || flee > 0) { wake(g, sx + (dir < 0 ? 16 : 0), 82, dir, t, flee > 0 ? 20 : 14); }
      const lp = clamp01((t - 2) / 0.4), fall = clamp01((t - 2.9) / 0.4);
      if (lp > 0 && fall < 1) { // l'échelle, repoussée, bascule en arrière
        g.save(); g.translate(ladderX + 1, 79); g.rotate(-fall * 1.2);
        const len = lp * (79 - deckY); R(g, 0, -len, 1, len, '#8a6a3a'); R(g, 3, -len, 1, len, '#8a6a3a');
        for (let y = -len; y < 0; y += 3) R(g, 0, y, 4, 1, '#8a6a3a');
        g.restore();
      }
      if (t > 2.2 && t < 3.6) { // l'équipage braque les lances à incendie sur l'échelle
        const hx = Math.round(bx + sh.x(0.5)), hy = stand(deckUnder(sh, bx, wy, hx + 1));
        for (let i = 0; i < 26; i++) {
          const k = ((t * 2.2 + i / 26) % 1), x = hx - k * (hx - ladderX - 2), y = hy + 3 - Math.sin(k * Math.PI) * 9 + k * (79 - hy - 6);
          R(g, x, y, 1 + (i % 2), 1, i % 3 ? '#e8f6ff' : '#9fd3f2');
        }
        person(g, hx, hy, '#ff8c1a', { hat: '#ffffff' });
      }
      if (t > 3.6) gulls(g, t - 3.6, 3, [150, 30], 1);
    },
  },
  // Pillage : le skiff accoste, l'équipage court s'enfermer dans la citadelle, les pirates
  // montent à l'échelle, puis descendent les caisses dans leur skiff.
  looted: {
    title: 'Navire pillé, équipage à l\'abri', mood: 'bad', loop: [6.2, 9.4],
    draw(g, t, o) {
      g.drawImage(bands('sky-haze', ['#f0d9a4', '#e6c58f', '#cdb894', '#a4b8b9', '#8aaeb8'], 58), 0, 0);
      sea(g, t, DAY, 58);
      const sh = sceneShip(o), bx = bowAt(sh, 112, 194), wy = 77;
      sh.draw(g, bx, wy);
      const step = Math.floor(t * 6) % 2;
      const floor = (x) => stand(deckUnder(sh, bx, wy, x + 1));
      const br = sh.bridge, hideX = Math.round(bx + (br ? (br.x1 + br.x2) / 2 : sh.x(0.1))); // la citadelle, sous la passerelle
      // Un marin court se réfugier dans la passerelle ; le cadenas s'allume.
      const run = clamp01((t - 0.4) / 1.1), from = Math.round(bx + sh.x(0.8));
      if (run < 1) { const x = from - run * (from - hideX); person(g, x, floor(x), '#ff8c1a', { hat: '#ffffff', step }); }
      if (t > 1.5) { const py = Math.round(wy + (br ? br.top : sh.top)) - 11; if (Math.floor(t * 2) % 2) padlock(g, hideX - 3, py); R(g, hideX - 2, py + 9, 4, 1, '#ffd34d'); }
      // Le skiff arrive le long de la coque, sous l'échelle.
      const ladderX = Math.round(bx + sh.x(0.45)), rim = Math.round(wy + sh.rim(0.45)), stop = ladderX - 14;
      const p = ease(t / 2.2), sx = -24 + p * (stop + 24);
      const onBoard = (i) => clamp01((t - 2.6 - i * 0.6) / 0.9); // 0 : dans le skiff, 1 : sur le pont
      const left = 3 - (onBoard(0) > 0 ? 1 : 0) - (onBoard(1) > 0 ? 1 : 0);
      skiff(g, sx, 80, 1, left, t);
      if (p < 1) wake(g, sx, 82, 1, t);
      const top = 79 - clamp01((t - 2.2) / 0.5) * (79 - rim);
      if (t > 2.2) { R(g, ladderX, top, 1, 79 - top, '#8a6a3a'); R(g, ladderX + 3, top, 1, 79 - top, '#8a6a3a'); for (let y = top; y < 79; y += 3) R(g, ladderX, y, 4, 1, '#8a6a3a'); }
      // Deux pirates grimpent, puis gagnent la cargaison (le chef à la proue, le porteur plus loin).
      const T0 = 4.6, cargoX = Math.round(bx + sh.x(0.72)), bossX = Math.round(bx + sh.x(0.9));
      for (let i = 0; i < 2 && t < T0; i++) {
        const c = onBoard(i);
        if (c <= 0) continue;
        const walk = clamp01((t - 3.5 - i * 0.6) / (0.8 - i * 0.3)), to = i ? cargoX : bossX;
        const x = c < 1 ? ladderX : ladderX + walk * (to - ladderX), y = c < 1 ? 73 - c * (80 - floor(ladderX)) : floor(x);
        person(g, x, y, i ? '#3a3a3a' : '#5a4a3a', { hat: i ? null : '#7a1f22', step });
      }
      // Pillage : une caisse toutes les 1,6 s, descendue à la corde dans le skiff.
      if (t >= T0) {
        const n = Math.floor((t - T0) / 1.6), k = ((t - T0) % 1.6) / 1.6, sk = stop + 6;
        if (n > 0 || k > 0.75) crate(g, sk, 74); // déjà dans le skiff
        const edge = ladderX - 2, fy = floor(edge);
        if (k < 0.4) { // le pirate apporte la caisse jusqu'au bord
          const x = cargoX - (k / 0.4) * (cargoX - edge);
          crate(g, x - 2, floor(x) - 6); person(g, x, floor(x), '#3a3a3a', { step });
        } else {
          const d = (k - 0.4) / 0.35, y = fy + clamp01(d) * (68 - fy), x = edge - 2 - clamp01(d) * (edge - 2 - sk);
          if (d <= 1) { R(g, x + 3, fy + 1, 1, Math.max(1, y - fy - 1), '#d8cfb8'); crate(g, x, y); } // la corde
          else if (k < 0.9) crate(g, sk, 68); // posée sur la pile
          person(g, edge, fy, '#3a3a3a');
        }
        person(g, bossX, floor(bossX), '#5a4a3a', { hat: '#7a1f22' }); // le chef fait le guet à la proue
      }
      vignette(g, 'rgba(120,60,10,A)', 0.25);
    },
  },
  // Douane : nuit sur le quai, lampes torches, la caisse s'ouvre, le sceau tombe.
  customs: {
    title: 'La douane a trouvé le colis', mood: 'bad', loop: [4, 6],
    draw(g, t, o) {
      g.drawImage(bands('sky-night', ['#070c1a', '#0d1630', '#142142', '#1b2c52'], 50), 0, 0);
      stars(g, t);
      for (let i = 0; i < 9; i++) R(g, 92 + i * 12, 38 - (i % 3) * 5, 11, 12 + (i % 3) * 5, ['#3a2f45', '#2f3b4a', '#4a3434'][i % 3]);
      R(g, 176, 14, 2, 36, '#2b3442'); R(g, 160, 14, 30, 2, '#2b3442');
      sea(g, t, NIGHT, 50, 50, 84);
      sceneShip(o).draw(g, 52, 81); // à quai, l'étrave vers la scène (un grand navire déborde à gauche)
      quay(g, 84);
      R(g, 156, 52, 1, 32, '#3c434c'); R(g, 153, 50, 7, 3, '#ffe9a6');
      cone(g, 156, 52, 136, 84, 178, 84, '#ffe9a6', 0.16);
      const open = clamp01((t - 2.4) / 0.4);
      crate(g, 118, 86, open);
      if (open > 0 && Math.floor(t * 6) % 2) R(g, 121, 82, 1, 1, '#ffffff');
      const aim = open > 0 ? 0 : Math.sin(t * 2.2) * 0.3;
      cone(g, 106, 86, 118 - 6 + aim * 20, 84, 124 + aim * 20, 92, '#fff6c8', 0.28);
      cone(g, 140, 86, 128 + aim * 20, 84, 132 + aim * 20, 93, '#fff6c8', 0.28);
      person(g, 102, 83, '#1f3d6b', { hat: '#14294a' }); person(g, 140, 83, '#1f3d6b', { hat: '#14294a' });
      const sp = clamp01((t - 3.1) / 0.8);
      const shake = sp > 0 && sp < 0.25 ? Math.round(Math.sin(t * 80) * 1.5) : 0;
      if (shake) g.translate(shake, 0);
      seal(g, 100, 34, sp);
      if (shake) g.translate(-shake, 0);
    },
  },
  // Garde-côtes : vedette aux gyrophares, projecteur, colis trouvé.
  patrol: {
    title: 'Colis saisi par les garde-côtes', mood: 'bad', loop: [3.8, 5.8],
    draw(g, t, o) {
      g.drawImage(bands('sky-dusk', ['#241a36', '#43284a', '#73384f', '#a9504a', '#d3834f'], 58), 0, 0);
      sea(g, t, { cols: ['#3a3552', '#2f2c47', '#26243c', '#1d1c31'], crest: '#8a7aa3' }, 58);
      const sh = sceneShip(o), bx = Math.min(118, Math.round(26 + sh.len)), wy = 77;
      sh.draw(g, bx, wy);
      const ox = Math.round(bx + sh.x(0.78)), oy = stand(deckUnder(sh, bx, wy, ox + 1)); // le douanier, sur le pont avant
      const p = ease(t / 1.8), px = 210 - p * 72;
      if (t > 1.2) cone(g, px + 9, 74, ox - 6, oy + 3, ox + 2, oy + 19, '#fffbe0', 0.22);
      patrolBoat(g, px, 80, t);
      if (p < 1) wake(g, px + 30, 82, -1, t);
      if (t > 2) { person(g, ox, oy, '#24324a', { hat: '#1a2436' }); crate(g, ox + 6, oy + 1, clamp01((t - 2.4) / 0.4)); }
      seal(g, 100, 32, clamp01((t - 3) / 0.8));
    },
  },
  // Colis livré : la nuit, sous la lanterne du quai, le capitaine remet le colis à l'acheteur
  // contre une mallette ; il l'entrouvre : les billets y sont.
  paid: {
    title: 'Colis livré', mood: 'good', loop: [4.8, 6.4],
    draw(g, t, o) {
      g.drawImage(bands('sky-night2', ['#081022', '#0f1b34', '#172747', '#1e3254'], 50), 0, 0);
      stars(g, t);
      g.fillStyle = '#f6efc8'; g.beginPath(); g.arc(166, 16, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#16233f'; g.beginPath(); g.arc(169, 14, 6, 0, Math.PI * 2); g.fill();
      sea(g, t, NIGHT, 50, 50, 84);
      const sh = sceneShip(o);
      sh.draw(g, 52, 81);
      quay(g, 84);
      gangway(g, Math.round(52 + sh.x(0.84)), Math.round(81 + sh.rim(0.84)), 84);
      R(g, 100, 58, 1, 26, '#3c434c'); R(g, 98, 55, 5, 4, '#ffcf6b');
      cone(g, 100, 58, 74, 100, 128, 100, '#ffcf6b', 0.2 + 0.04 * Math.sin(t * 9));
      // Personnages en gros plan : 2 pixels pour 1.
      g.save(); g.scale(2, 2);
      const step = Math.floor(t * 5) % 2;
      const inP = ease(t / 2), out = clamp01((t - 3.3) / 1.4);
      const cx = 25 + inP * 19; // le capitaine, descendu du navire
      const bx = out > 0 ? 54 + out * 52 : 105 - inP * 51; // l'acheteur, venu de la nuit
      const swap = clamp01((t - 2.3) / 0.8), sw = ease(swap);
      const parcel = (x, y) => { R(g, x, y, 4, 3, '#c89a5a'); R(g, x, y + 1, 4, 1, '#e8dcc0'); R(g, x + 2, y, 1, 3, '#e8dcc0'); };
      const suitcase = (x, y, open = 0) => {
        if (open > 0) R(g, x, y - 1 - Math.round(open), 5, 1 + Math.round(open), '#45454d'); // couvercle relevé
        else R(g, x + 2, y - 1, 2, 1, '#9aa1a8'); // poignée
        R(g, x, y, 5, 3, '#2b2b30'); R(g, x, y, 5, 1, '#45454d'); R(g, x + 2, y + 1, 1, 1, '#d9b85a');
        if (open > 0) { R(g, x + 1, y, 3, 1, '#4fa35f'); R(g, x + 1, y, 1, 1, '#e8f5d0'); }
      };
      person(g, cx, 43, '#1d2f55', { hat: '#f4f4f4', step: inP < 1 ? step : 0 });
      if (out < 1) { person(g, bx, 43, '#2b2b30', { hat: '#111111', step: inP < 1 || out > 0 ? step : 0 }); R(g, bx, 48, 3, 1, '#2b2b30'); } // long manteau
      // L'échange : le colis passe par-dessus, la mallette par-dessous.
      const px = swap > 0 ? 46 + sw * 7 : cx + 2, py = 46 - Math.sin(sw * Math.PI) * 3;
      const mx = swap > 0 ? 52 - sw * 7 : bx - 4, my = 46 + Math.sin(sw * Math.PI) * 1.5;
      if (swap < 1) { parcel(px, py); suitcase(mx, my); }
      else {
        if (out < 1) parcel(bx + 3, 46);
        const op = clamp01((t - 3.6) / 0.4);
        suitcase(cx + 3, 46, op);
      }
      g.restore();
      // Les billets brillent dans la mallette entrouverte.
      if (t > 4) for (let i = 0; i < 6; i++) { const k = (t * 0.9 + i / 6) % 1; const x = 96 + Math.sin(i * 2.1) * 6 * k, y = 88 - k * 12; R(g, x, y, 1, 1, i % 2 ? '#ffd34d' : '#e8f5d0'); }
      vignette(g, 'rgba(40,120,60,A)', 0.18);
    },
  },
  // Proposition discrète : à la tombée du jour, un homme en long manteau rejoint le capitaine
  // au pied de la passerelle, regarde autour de lui et sort un petit colis de son manteau.
  // Variante « insist » : il brandit aussi une liasse de billets.
  offer: {
    title: 'Une proposition discrète', mood: 'info', loop: [3.8, 5.8],
    draw(g, t, o) {
      const dark = o.variant === 'dark'; // affaire noire : nuit froide, gardes armés, voiture noire
      g.drawImage(dark ? bands('sky-night-dark', ['#05070d', '#0b0f1c', '#121a2c', '#1a2438'], 50) : bands('sky-dusk2', ['#1d2340', '#3a2f55', '#6b3f5e', '#a35a5a', '#cf8a5a'], 50), 0, 0);
      stars(g, t, dark ? 8 : 14, 22);
      sea(g, t, dark ? { cols: ['#141b2a', '#111726', '#0e1421', '#0b101b'], crest: '#3c4a66' } : { cols: ['#3a3552', '#2f2c47', '#26243c', '#1d1c31'], crest: '#8a7aa3' }, 50, 50, 84);
      const sh = sceneShip(o);
      sh.draw(g, 52, 81);
      quay(g, 84);
      if (dark) R(g, 0, 84, W, H - 84, 'rgba(0,0,0,0.45)');
      gangway(g, Math.round(52 + sh.x(0.84)), Math.round(81 + sh.rim(0.84)), 84);
      const lamp = dark ? '#bfd8ff' : '#ffcf6b';
      R(g, 118, 58, 1, 26, '#3c434c'); R(g, 116, 55, 5, 4, lamp);
      cone(g, 118, 58, 92, 100, 144, 100, lamp, (dark ? 0.1 : 0.17) + 0.04 * Math.sin(t * 9));
      if (dark) { // la voiture noire, phares allumés, et deux gardes armés
        R(g, 150, 88, 30, 9, '#0d0d10'); R(g, 155, 82, 18, 7, '#141418'); R(g, 157, 83, 6, 4, '#2a3344'); R(g, 165, 83, 6, 4, '#2a3344');
        R(g, 152, 97, 5, 3, '#000'); R(g, 172, 97, 5, 3, '#000'); R(g, 148, 90, 2, 2, '#fff6c0');
        cone(g, 148, 91, 120, 84, 120, 100, '#fff6c0', 0.12);
        for (const gx of [186, 194]) { person(g, gx, 86, '#1b1b1f', { hat: '#111111', head: '#c99a74' }); line(g, gx - 1, 89, gx + 4, 92, '#5b5b5b'); }
      } else { crate(g, 156, 94); crate(g, 165, 94); crate(g, 160, 87); } // caisses : de quoi se cacher
      g.save(); g.scale(2, 2);
      const parcel = (x, y) => { R(g, x, y, 4, 3, '#c89a5a'); R(g, x, y + 1, 4, 1, '#e8dcc0'); R(g, x + 2, y, 1, 3, '#e8dcc0'); };
      person(g, 26, 43, '#1d2f55', { hat: '#f4f4f4' }); // le capitaine, au pied de la passerelle
      const inP = ease(t / 2.2), mx = 88 - inP * 46; // l'homme au manteau arrive de la droite
      person(g, mx, 43, '#2b2b30', { hat: '#111111', step: inP < 1 ? Math.floor(t * 5) % 2 : 0 });
      R(g, mx, 48, 3, 1, '#2b2b30'); // long manteau
      // Il jette un œil à gauche, à droite…
      if (t > 2.2 && t < 3.2) R(g, Math.floor((t - 2.2) * 4) % 2 ? mx + 3 : mx - 1, 43, 1, 1, '#111111');
      // … puis sort le colis de son manteau et le tend.
      const out = clamp01((t - 3.2) / 0.5);
      if (out > 0) parcel(mx - 1 - out * 3.5, 45 - (out >= 1 ? Math.round(Math.sin(t * 3)) * 0.5 : 0));
      if (o.variant === 'insist' && t > 3.4) { // une liasse de billets dans l'autre main
        const by = 41 + Math.round(Math.sin(t * 4));
        R(g, mx + 3, by, 5, 2, '#3f8f4f'); R(g, mx + 3, by - 2, 5, 2, '#57a86a'); R(g, mx + 5, by - 2, 1, 4, '#e8f5d0');
      }
      g.restore();
      if (o.variant === 'insist' && t > 3.6) for (let i = 0; i < 5; i++) { const k = (t * 1.2 + i / 5) % 1; R(g, 96 + Math.sin(i * 2.3) * 6, 80 - k * 12, 1, 1, i % 2 ? '#ffd34d' : '#e8f5d0'); }
      vignette(g, 'rgba(60,20,70,A)', 0.25);
    },
  },
  // Détention : inspecteur au quai, navire enchaîné, panneau d'interdiction.
  detention: {
    title: 'Navire retenu par les inspecteurs', mood: 'bad', loop: [0, 4],
    draw(g, t, o) {
      g.drawImage(bands('sky-grey', ['#b9c6ce', '#c6d1d8', '#d3dce1', '#dde4e8'], 50), 0, 0);
      for (let i = 0; i < 3; i++) { const x = ((t * 4 + i * 80) % (W + 60)) - 40; R(g, x, 10 + i * 9, 34, 5, '#eef2f4'); R(g, x + 6, 7 + i * 9, 20, 3, '#eef2f4'); }
      sea(g, t, DAY, 50, 50, 84);
      const bx = 78;
      sceneShip(o).draw(g, bx, 81);
      quay(g, 84);
      R(g, 102, 84, 5, 4, '#3c434c'); // bitte d'amarrage
      for (let i = 0; i < 6; i++) R(g, 99 - i * ((99 - bx) / 6), 83 - i, 3, 2, i % 2 ? '#8d939a' : '#b9bfc5'); // chaîne, de la bitte à l'étrave
      padlock(g, 100, 75);
      R(g, 168, 66, 1, 18, '#6d747c');
      g.fillStyle = '#d0312d'; g.beginPath(); g.arc(168.5, 64, 5, 0, Math.PI * 2); g.fill(); R(g, 165, 63, 7, 2, '#fff');
      const nod = Math.floor(t * 1.5) % 2;
      person(g, 140, 82 + nod * 0, '#f2c230', { hat: '#ffffff' });
      R(g, 143, 85, 3, 3, '#f4f4f4'); R(g, 144, 86, 1, 1, '#888');
    },
  },
  // Marée noire : la nappe gagne la côte, les oiseaux s'enfuient.
  pollution: {
    title: 'Marée noire', mood: 'bad', loop: [4.5, 6.5],
    draw(g, t, o) {
      g.drawImage(bands('sky-pale', ['#cfe0e8', '#bcd3de', '#aac7d5'], 44), 0, 0);
      sea(g, t, DAY, 44);
      const sh = sceneShip(o, 'tank', { far: 0.6 });
      sh.draw(g, 188, 63, { slope: Math.atan(Math.min(0.1, 5 / sh.len)) }); // au loin, l'étrave sur les cailloux
      const p = ease(t / 4.5);
      g.save(); g.globalAlpha = 0.9; g.fillStyle = '#111316';
      for (let i = 0; i < 9; i++) {
        const k = i / 8, cx = 160 - k * 118 * p, cy = 66 + k * 30 * p + Math.sin(i * 1.7) * 4, r = (4 + k * 10) * clamp01(p * 1.3 - k * 0.3);
        if (r > 0) { g.beginPath(); g.ellipse(cx, cy, r * 1.6, r * 0.8, 0, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
      for (let i = 0; i < 18; i++) { const x = 160 - (hash(i, 3) % 100) * p, y = 64 + (hash(i, 4) % 30) * p; if ((hash(i, Math.floor(t * 3)) & 3) === 0) R(g, x, y, 1, 1, i % 2 ? '#6b3fa0' : '#2f8a8a'); }
      g.fillStyle = '#e3d3a6'; g.beginPath(); g.moveTo(0, 84); g.lineTo(46, 98); g.lineTo(74, H); g.lineTo(0, H); g.fill();
      R(g, 8, 92, 6, 4, '#8b8478'); R(g, 22, 96, 8, 5, '#7a7368');
      gulls(g, t, 4, [70, 40], -1);
      vignette(g, 'rgba(20,20,20,A)', 0.25);
    },
  },
  // Ouragan : la nuit, le navire escalade des creux énormes sous les éclairs ; parfois des
  // conteneurs passent par-dessus bord.
  // L'intensité suit la force : coup de vent gris (force 8 et 9), nuit d'orage et éclairs
  // à partir de 10, creux énormes à 12. Variantes : conteneurs ou cargaison emportés.
  storm: {
    title: 'Dans la tempête', mood: 'bad', loop: [2, 6],
    draw(g, t, o) {
      const f = clamp01(((o.force ?? 12) - 8) / 4), night = f >= 0.5;
      const flash = night && (t % 4) > 1.3 && (t % 4) < 1.42;
      g.drawImage(flash ? bands('sky-storm-f', ['#5b6f99', '#6c80aa', '#7d91bb'], 80)
        : night ? bands('sky-storm2', ['#04070d', '#0a1120', '#111b30', '#18263f'], 80)
          : bands('sky-gale', ['#262f3d', '#33404f', '#43505f', '#56626f'], 80), 0, 0);
      if (flash) { line(g, 40, 0, 34, 16, '#fffbe6'); line(g, 34, 16, 42, 20, '#fffbe6'); line(g, 42, 20, 36, 40, '#fffbe6'); }
      for (let i = 0; i < 8; i++) { const w = 30 + hash(i, 32) % 30, x = ((hash(i, 31) % 260) - t * 65 % 260 + 260) % 260 - 40, y = 8 + (hash(i, 33) % 40); R(g, x, y, w, 4, flash ? '#8b9cc0' : '#1c283c'); R(g, x + 4, y - 2, w - 10, 2, flash ? '#8b9cc0' : '#1c283c'); }
      const surf = (x) => 72 + (7 + 7 * f) * Math.sin(x / 24 - t * PI / 2) + (2 + f) * Math.sin(x / 9 + t * PI);
      const water = (x0, x1, dy) => {
        for (let x = x0; x < x1; x++) {
          const y = Math.round(surf(x)) + dy;
          R(g, x, y, 1, 2, '#6f8db3'); R(g, x, y + 2, 1, 7, '#14284a'); R(g, x, y + 9, 1, H, '#0d1c33');
          if (y < 62 && !dy) R(g, x, y - 1, 1, 1, '#e8f0f8');
          if (hash(x, Math.floor(t * 6)) % 23 === 0) R(g, x, y + 3 + hash(x, 5) % 8, 2, 1, '#4f6f99');
        }
      };
      water(0, W, 0);
      // Le navire se pose sur la houle (droite des moindres carrés sous sa coque) : un petit navire en épouse
      // la pente, un long navire enjambe les creux et y montre sa carène.
      const sh = sceneShip(o), half = sh.len / 2, sx = 100;
      let n = 0, su = 0, sv = 0, suu = 0, suv = 0;
      for (let u = -half; u <= half; u += 2) { const v = surf(sx + u); n++; su += u; sv += v; suu += u * u; suv += u * v; }
      const a = Math.atan((suv - (su * sv) / n) / Math.max(1e-6, suu - (su * su) / n)), sy = sv / n + (Math.tan(a) * su) / n;
      let gap = 0; // sous un long navire, un creux plus profond que sa carène : il s'y enfonce un peu
      for (let u = -half; u <= half; u += 2) gap = Math.max(gap, surf(sx + u) - (sy + 3 + Math.tan(a) * u + sh.depth));
      const bx = Math.round(sx + half), wy = sy + 3 + Math.min(6, gap) + Math.tan(a) * half;
      // Conteneurs arrachés (au début seulement, la boucle reste calme).
      if (o.variant === 'boxes' && t < 2) for (let i = 0; i < 3; i++) {
        const k = clamp01((t - 0.6 - i * 0.2) / 1.1);
        if (k <= 0 || k >= 1) continue;
        const x = sx - 6 + i * 7 - k * (14 + i * 6), y = sy + sh.deck(0.5) - Math.sin(k * PI) * 8 + k * k * 22;
        g.save(); g.translate(x, y); g.rotate(k * (2 + i)); R(g, -2, -2, 5, 4, ['#c0392b', '#d4ac0d', '#2e86c1'][i]); g.restore();
      }
      sh.draw(g, bx, wy, { slope: a, keel: true });
      water(Math.max(0, Math.round(bx - sh.len) - 4), Math.min(W, bx + 4), 4); // la vague devant recouvre le bas de la coque
      // Cargaison avariée : un paquet de mer déferle sur le pont (au début seulement).
      if (o.variant === 'cargo' && t > 0.7 && t < 2) {
        const k = (t - 0.7) / 1.3;
        for (let i = 0; i < 40; i++) { const u = (hash(i, 41) % 100) / 100, v = (hash(i, 42) % 100) / 100; R(g, sx - half * 0.8 + u * half * 1.6, sy + sh.deck(0.5) + 3 - Math.sin(k * PI) * (6 + v * 10) + k * 4, 1 + (i % 2), 1, i % 3 ? '#e8f0f8' : '#a9c4e0'); }
      }
      // Paquets de mer sur l'étrave quand elle plonge.
      const dip = clamp01(a * 5);
      if (dip > 0) {
        const ex = bx - 2, ey = wy - 4;
        for (let i = 0; i < 16; i++) { const k = (t * 2 + i / 16) % 1, v = 0.5 + (hash(i, 7) % 50) / 100; R(g, ex + (hash(i, 8) % 2 ? 1 : -1) * k * 10 * v, ey - Math.sin(k * PI) * 14 * dip * v, 1, 1, '#e8f0f8'); }
      }
      rain(g, t, Math.round(50 + 60 * f), 'rgba(160,190,230,0.5)', 150 + 20 * f, 40 + 30 * f);
      vignette(g, 'rgba(0,0,0,A)', 0.5);
    },
  },
  // Le banquier : rouge de colère, il tape du poing ; le compte plonge au tableau.
  // Variante « seize » : il abat son tampon sur le dossier du navire saisi.
  // Scandale : un coup bas éventé. La une d'un journal tournoie comme au cinéma, s'arrête, et les
  // flashes des photographes crépitent. Le texte sous la scène nomme la compagnie et le prix payé.
  scandal: {
    title: 'Scandale !', mood: 'bad', loop: [1.4, 3.4],
    draw(g, t, o) {
      R(g, 0, 0, W, H, '#16161c');
      for (let k = 0; k < 6; k++) { g.globalAlpha = 0.05; disc(g, W / 2, H / 2, 70 - k * 10, '#fff3c8'); } // un projecteur
      g.globalAlpha = 1;
      const e = ease(clamp01(t / 1.1));
      g.save(); g.translate(W / 2, H / 2 + 2); g.rotate((1 - e) * Math.PI * 6); g.scale(0.08 + 0.92 * e, 0.08 + 0.92 * e);
      newspaper(g, o.color || '#b8322a', getLang() === 'en' ? 'SCANDAL!' : 'SCANDALE!');
      g.restore();
      if (t > 1.1) { // les flashes : un éclair blanc de temps en temps, des appareils au premier rang
        if (hash(Math.floor(t * 8), 77) % 5 === 0) { g.globalAlpha = 0.45; R(g, 0, 0, W, H, '#ffffff'); g.globalAlpha = 1; }
        for (let i = 0; i < 4; i++) {
          const ph = (t * 1.6 + i * 0.29) % 1, x = 18 + i * 54;
          R(g, x - 5, 101, 10, 7, '#2a2a30'); R(g, x - 2, 99, 4, 2, '#2a2a30'); disc(g, x, 104, 2, '#5a6070');
          if (ph < 0.14) { g.globalAlpha = 1 - ph / 0.14; disc(g, x, 99, 7, '#fffbe6'); g.globalAlpha = 1; }
        }
      }
    },
  },
  banker: {
    title: 'Votre banquier s\'impatiente', mood: 'bad', loop: [2.4, 4.8],
    draw(g, t, o) {
      const seize = o.variant === 'seize';
      const ph = (t % 0.8) / 0.8, pounding = !seize && t > 1, hit = pounding && ph < 0.15;
      g.drawImage(bands('office', ['#d8ccb0', '#cfc2a4', '#c6b898'], 76), 0, 0);
      R(g, 0, 56, W, 20, '#7a5232'); R(g, 0, 56, W, 2, '#8e6440');
      for (let x = 8; x < W; x += 32) R(g, x, 60, 24, 12, '#6e4a2c');
      R(g, 146, 6, 48, 44, '#5a3a22'); R(g, 148, 8, 44, 40, '#8fb3d4');
      for (const [x, y, w] of [[150, 26, 8], [159, 18, 7], [167, 30, 9], [177, 14, 6], [184, 24, 8]]) {
        R(g, x, y, w, 48 - y, '#4a5d75');
        for (let wy = y + 2; wy < 46; wy += 4) for (let wx = x + 1; wx < x + w - 1; wx += 3) R(g, wx, wy, 1, 2, '#cfe0ef');
      }
      R(g, 169, 8, 2, 40, '#5a3a22'); R(g, 148, 27, 44, 2, '#5a3a22');
      board(g, 10, 10, -1, t, 'bad', 'cash');
      if (hit) g.translate(0, 1);
      g.save(); g.scale(2, 2);
      const anger = clamp01((t - 0.3) / 1.8);
      const sk = rgb('#e8b98f'), rd = rgb('#d9533f');
      const skin = `rgb(${sk.map((c, i) => Math.round(c + (rd[i] - c) * anger)).join(',')})`;
      // Costume, chemise, cravate.
      R(g, 38, 27, 24, 12, '#1e2a3a'); R(g, 40, 26, 20, 1, '#1e2a3a'); R(g, 47, 26, 6, 3, '#f4f4f4');
      R(g, 49, 27, 2, 10, '#b8322a'); R(g, 48, 26, 4, 1, '#b8322a');
      line(g, 46, 27, 49, 34, '#2c3c52'); line(g, 53, 27, 50, 34, '#2c3c52');
      // Tête : tempes grises, sourcils froncés, lunettes, moustache, bouche qui crie.
      R(g, 45, 13, 10, 12, skin); R(g, 44, 17, 1, 3, skin); R(g, 55, 17, 1, 3, skin);
      R(g, 45, 13, 2, 4, '#9a9a9a'); R(g, 53, 13, 2, 4, '#9a9a9a'); R(g, 47, 12, 6, 1, '#9a9a9a');
      R(g, 47, 16, 1, 1, '#2a2a2a'); R(g, 48, 17, 1, 1, '#2a2a2a'); R(g, 52, 16, 1, 1, '#2a2a2a'); R(g, 51, 17, 1, 1, '#2a2a2a');
      R(g, 46, 18, 3, 2, '#f4f4f4'); R(g, 51, 18, 3, 2, '#f4f4f4'); R(g, 47, 18, 1, 1, '#111'); R(g, 52, 18, 1, 1, '#111');
      R(g, 49, 18, 2, 1, '#2a2a2a');
      R(g, 49, 20, 2, 1, `rgba(120,40,30,${0.25 + anger * 0.3})`);
      R(g, 47, 21, 6, 1, '#9a9a9a');
      const shout = !seize && t > 0.8 && ph > 0.1 && ph < 0.6;
      if (shout) { R(g, 48, 22, 4, 2, '#5a1010'); R(g, 48, 22, 4, 1, '#f4f4f4'); } else R(g, 48, 22, 4, 1, '#7a2a20');
      if (anger > 0.6) for (let k = 0; k < 6; k++) { // la vapeur lui sort des oreilles
        const q = (t * 1.25 + k / 6) % 1, side = k % 2 ? 1 : -1;
        g.globalAlpha = 1 - q; R(g, (side > 0 ? 56 : 43) + side * q * 2, 16 - q * 8, 1 + Math.round(q), 1 + Math.round(q), '#ffffff'); g.globalAlpha = 1;
      }
      // Le bureau, les papiers, le téléphone qui sonne, la plaque dorée.
      R(g, 0, 38, 100, 18, '#5a3a22'); R(g, 0, 38, 100, 1, '#7a5232'); R(g, 10, 42, 30, 10, '#4e321d'); R(g, 60, 42, 30, 10, '#4e321d');
      R(g, 18, 35 - (hit ? 2 : 0), 12, 3, '#f4f1e6'); R(g, 19, 34 - (hit ? 2 : 0), 10, 1, '#e4e0d4');
      const ring = Math.floor(t * 8) % 2;
      R(g, 70 + (ring ? 0.5 : -0.5), 35, 9, 3, '#2a2a2a'); R(g, 71, 34, 2, 1, '#2a2a2a'); R(g, 76, 34, 2, 1, '#2a2a2a');
      if (ring) { R(g, 68, 32, 1, 2, '#2a2a2a'); R(g, 81, 32, 1, 2, '#2a2a2a'); }
      R(g, 44, 36, 12, 2, '#c9a24a');
      // Les bras : l'un sur le bureau, l'autre qui tape du poing (ou qui tamponne).
      R(g, 35, 31, 5, 7, '#1e2a3a'); R(g, 32, 36, 4, 2, skin);
      if (seize) {
        const sp = clamp01((t - 1.2) / 0.8), down = sp > 0.85;
        R(g, 40, 39, 20, 12, '#f4f1e6'); R(g, 43, 44, 14, 2, '#2c4a6b'); R(g, 46, 42, 4, 2, '#f2efe6'); // le dossier du navire
        const fy = down ? 33 : 24 + Math.sin(sp * PI) * -3;
        R(g, 60, Math.min(30, fy), 5, Math.abs(fy - 30) + 4, '#1e2a3a'); R(g, 56, fy + 3, 6, 3, skin);
        R(g, 56, fy + 6, 6, 2, '#5a3a22'); R(g, 55, fy + 8, 8, 1, '#b8322a');
      } else {
        const fy = !pounding ? 33 : hit ? 33 : 25 - Math.sin(ph * PI) * 2;
        R(g, 60, Math.min(30, fy), 5, Math.abs(fy - 30) + 4, '#1e2a3a'); R(g, 61, fy + 3, 5, 3, skin);
      }
      g.restore();
      if (seize) seal(g, 100, 90, clamp01((t - 2.05) / 0.6));
      vignette(g, 'rgba(120,20,10,A)', 0.2 + 0.1 * clamp01((t - 0.3) / 1.8));
    },
  },

  // Navire d'occasion acheté : au quai, le courtier remet les papiers contre le chèque, le
  // vieux navire est repeint aux couleurs de la compagnie et l'équipage hisse son pavillon.
  buyship: {
    title: 'Un navire de plus dans la flotte', mood: 'good', loop: [5, 7],
    draw(g, t, o) {
      g.drawImage(bands('sky-buy', ['#78b3d6', '#8fc1de', '#a8d0e6', '#c4e1ef'], 50), 0, 0);
      for (let i = 0; i < 3; i++) cloud(g, ((t * 3 + i * 74) % (W + 50)) - 40, 8 + (i % 2) * 8, 22 + i * 4);
      sea(g, t, DAY, 44, 44, 84);
      gulls(g, t % 4, 2, [196, 30]);
      // Avant : cheminée de l'ancien armateur (grise) et rouille de plus ; le peintre passe de la
      // poupe à l'étrave, et le navire tel qu'il est désormais apparaît derrière lui.
      const sh = sceneShip(o), old = sceneShip(o, 'box', { color: '#8a8f96', wear: Math.min(1, (o.ship?.wear || 0) + 0.35) });
      const bx = 116, wy = 82, x0 = Math.max(0, Math.round(bx - sh.len) - 1), paint = clamp01((t - 2.4) / 2.2);
      const px = Math.round(x0 + (bx + 2 - x0) * paint);
      old.draw(g, bx, wy);
      if (paint > 0) { g.save(); g.beginPath(); g.rect(0, 0, px, H); g.clip(); sh.draw(g, bx, wy); g.restore(); }
      if (paint >= 1) for (let i = 0; i < 3; i++) { const k = ((t - 4.6) * 0.5 + i / 3) % 1, x = x0 + k * (bx - x0); R(g, x, Math.round(wy + sh.rim(sh.fr(x - bx))) + 2, 3, 1, 'rgba(255,255,255,0.8)'); } // peinture fraîche qui brille
      quay(g, 84);
      R(g, 166, 84, 6, 4, '#3c434c'); // bitte d'amarrage
      if (paint > 0 && paint < 1) { // le peintre sur sa nacelle, le long de la coque
        const ry = Math.round(wy + sh.rim(sh.fr(px - bx)));
        R(g, px, ry - 3, 1, 4, '#d8d8d8'); R(g, px - 3, ry + 5, 7, 1, '#8a6a3a');
        person(g, px - 1, ry - 2, '#f2c230', { hat: '#ffffff' });
        R(g, px + 2, ry + Math.round(Math.sin(t * 14)), 1, 2, o.color); // rouleau
      }
      // À la proue, l'ancien pavillon descend, puis le vôtre est hissé.
      const fx = Math.round(bx + sh.x(0.97)), fb = Math.round(wy + sh.deck(0.97));
      if (t < 4.2) companyFlag(g, fx, fb - 14, '#8a8f96', t, 1 - clamp01((t - 3.4) / 0.8), 14);
      else companyFlag(g, fx, fb - 14, o.color, t, clamp01((t - 4.4) / 0.8), 14);
      gangway(g, Math.round(bx + sh.x(0.86)), Math.round(wy + sh.rim(0.86)), 84);
      g.save(); g.scale(2, 2);
      const papers = (x, y) => { R(g, x, y, 3, 4, '#f4f1e6'); R(g, x, y + 1, 3, 1, '#b9b3a2'); R(g, x + 1, y + 3, 1, 1, '#c0392b'); };
      const cash = (x, y) => { R(g, x, y, 4, 2, '#3f8f4f'); R(g, x + 1, y, 1, 2, '#e8f5d0'); };
      const cx0 = 64;
      person(g, cx0, 43, '#1d2f55', { hat: '#f4f4f4' }); // votre capitaine, au pied de la passerelle
      const inB = ease(t / 1.6), bxB = 100 - inB * 30; // le courtier arrive avec les papiers
      person(g, bxB, 43, '#5a5f66', { hat: '#2b2b30', step: inB < 1 ? Math.floor(t * 5) % 2 : 0 });
      R(g, bxB + 3, 46, 2, 2, '#6b4320'); // sa serviette
      const x = clamp01((t - 1.7) / 0.7); // échange : le chèque passe à droite, les papiers à gauche
      if (t < 1.7) { papers(bxB - 2, 45); cash(cx0 + 2, 45); }
      else if (x < 1) { papers(bxB - 2 - x * 6, 45 - Math.sin(x * PI) * 2); cash(cx0 + 2 + x * 3, 45 - Math.sin(x * PI) * 2); }
      else {
        papers(cx0 - 1, 44 - (t > 4.4 ? Math.round(Math.abs(Math.sin(t * 5))) : 0)); // brandis quand le pavillon monte
        if (t < 3.2) R(g, cx0 + 3, 46 + Math.round(Math.sin(t * 16)) * 0.5, 3, 1, '#e8b98f'); // poignée de main
        cash(bxB + 3, 44);
      }
      g.restore();
    },
  },
  // Navire neuf : la marraine lâche la bouteille, qui se brise sur l'étrave ; le navire glisse
  // sur la cale de lancement, la sirène retentit et le feu d'artifice éclate.
  newbuild: {
    title: 'Baptême d\'un navire neuf', mood: 'good', loop: [4.4, 6.4],
    draw(g, t, o) {
      const sh = sceneShip(o, 'box', { laden: false }); // neuf : à vide
      const pal = { cols: ['#3d3a5c', '#33324f', '#2a2a44', '#222239'], crest: '#9a86b5' };
      g.drawImage(bands('sky-launch', ['#1f2a52', '#3a3b6c', '#684a78', '#ad6277', '#e09a6c'], 58), 0, 0);
      stars(g, t, 12, 20);
      for (let i = 0; i < 9; i++) R(g, i * 7, 54 - (hash(i, 41) % 4), 7, 4 + (hash(i, 41) % 4), '#2d2a45'); // côte lointaine
      for (let i = 0; i < 5; i++) R(g, 3 + hash(i, 42) % 58, 53 + hash(i, 43) % 3, 1, 1, '#ffd38a');
      sea(g, t, pal, 58, 58, H);
      // Portique du chantier, en silhouette.
      const gc = '#463c5e';
      R(g, 112, 18, 2, 56, gc); R(g, 186, 18, 2, 54, gc); R(g, 104, 15, 92, 4, gc);
      for (let x = 106; x < 194; x += 6) line(g, x, 15, x + 3, 18, '#5a4f74');
      R(g, 146, 19, 6, 3, gc); R(g, 148, 22, 1, 12, '#5a4f74'); // chariot et câble
      // Cale de lancement et terre-plein (prolongée à gauche : un grand navire en déborde).
      const rampY = (x) => 96 - (x - 40) * 0.185;
      g.fillStyle = '#6d6a72'; g.beginPath(); g.moveTo(0, rampY(0)); g.lineTo(170, rampY(170)); g.lineTo(W, 72); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      line(g, 0, rampY(0), 170, rampY(170), '#9b97a0'); R(g, 170, 72, 30, 1, '#9b97a0');
      for (let x = 6; x < 168; x += 9) R(g, x, Math.round(rampY(x)) + 1, 4, 1, '#55525a'); // traverses
      // Le navire, posé par l'étrave (la bouteille s'y brise), la quille sur la cale : immobile,
      // puis il glisse, quitte la cale, s'enfonce à sa flottaison, se redresse et se balance.
      const th = -0.183, onWays = (x) => rampY(x) - sh.depth - 1;
      const B0 = 158, B1 = 112, BEND = 92, SEA = 86;
      let bx = B0, wy = onWays(B0), ang = th;
      if (t > 1.8) {
        const p = Math.min(1, (t - 1.8) / 1.2);
        bx = B0 - (B0 - B1) * p * p; wy = onWays(bx);
        if (t > 3) { // à flot : il file sur son erre
          const tau = t - 3;
          bx = B1 - (B1 - BEND) * (1 - Math.exp(-1.6 * tau));
          wy = onWays(B1) + (SEA - onWays(B1)) * (1 - Math.exp(-3 * tau)) + Math.sin(t * 3) * 0.4;
          ang = th * Math.exp(-3 * tau) * Math.cos(5 * tau) + Math.sin(t * 2.4) * 0.02;
        }
      }
      if (t < 1.8) for (let i = 0; i < 4; i++) { const x = B0 - (i + 1) * Math.min(26, sh.len / 5); R(g, x, rampY(x) - 3, 3, 3, '#8a6a3a'); } // ber de lancement
      sh.draw(g, bx, wy, { slope: ang, keel: true });
      g.save(); g.globalAlpha = 0.9; g.beginPath(); g.rect(0, SEA, 104, H); g.clip(); sea(g, t, pal, 58, SEA, H); g.restore(); // l'eau recouvre la carène
      // Gerbe d'eau quand la poupe touche l'eau (au bord de l'image si elle en sort).
      const stx = Math.max(6, Math.min(96, bx - sh.len));
      if (t > 2.5 && t < 4.2) for (let i = 0; i < 18; i++) {
        const k = (t - 2.5 - (hash(i, 44) % 10) / 40) / 1.2; if (k < 0 || k > 1) continue;
        const vx = ((hash(i, 45) % 20) - 14) * 1.3, vy = 14 + hash(i, 46) % 16;
        R(g, stx + vx * k, 85 - vy * k + 22 * k * k, 1, 1 + (i % 2), i % 3 ? '#e8f1f8' : '#b7d3e6');
      }
      // Sirène : bouffées de vapeur à la cheminée.
      if (t > 3.1 && sh.funnel) {
        const [fx, fy] = sh.at(bx, wy, sh.funnel[0], sh.funnel[1], { slope: ang });
        for (let i = 0; i < 6; i++) { const k = ((t - 3.1) * 0.8 + i / 6) % 1; disc(g, fx + k * 6, fy - k * 10, 1 + k * 2.5, `rgba(240,240,245,${(0.7 * (1 - k)).toFixed(2)})`); }
      }
      // Estrade, guirlande de fanions et foule.
      R(g, 168, 66, 32, 6, '#7b5a3a'); R(g, 168, 66, 32, 1, '#a5794d');
      R(g, 170, 42, 1, 24, '#b8b0a0'); R(g, 170, 42, 8, 1, '#b8b0a0');
      for (let i = 0; i < 10; i++) { const fx = 171 + i * 3, fy = 46 + Math.round(Math.sin((i / 9) * PI) * 3); R(g, fx, fy, 2, 2, ['#c0392b', '#f4f4f4', '#2e86c1', o.color][i % 4]); R(g, fx, fy + 2, 1, 1, ['#c0392b', '#f4f4f4', '#2e86c1', o.color][i % 4]); }
      const cheer = t > 1.4;
      [[180, '#8e44ad'], [186, '#c0392b'], [192, '#2e86c1'], [176, '#e67e22'], [196, '#27ae60']].forEach(([px, c], i) => {
        const jump = cheer ? (Math.floor(t * 4 + i) % 2) : 0;
        person(g, px, 59 - jump, c);
        if (cheer && i % 2 === 0) { R(g, px + 1, 55 - jump, 1, 3, '#d8d8d8'); R(g, px + 2, 55 - jump, 2, 2, o.color); } // petits drapeaux
      });
      // La bouteille : tenue, lâchée, brisée sur l'étrave.
      const pv = [170, 42], L = 28.7, phi0 = 0.9, phiHit = -0.51;
      let phi = phi0, broken = false;
      if (t > 0.9) {
        const q = clamp01((t - 0.9) / 0.45);
        phi = phi0 + (phiHit - phi0) * q * q;
        if (q >= 1) { broken = true; const tau = t - 1.35; phi = phiHit * Math.exp(-tau * 1.4) * Math.cos(tau * 4.5); }
      }
      const len = broken ? 10 : L, qx = pv[0] + Math.sin(phi) * len, by = pv[1] + Math.cos(phi) * len;
      line(g, pv[0], pv[1], qx, by, '#e8e0c8');
      if (broken) R(g, qx - 1, by, 2, 2, '#2f7d4a');
      else { R(g, qx - 1, by, 3, 5, '#2f7d4a'); R(g, qx, by - 1, 1, 2, '#e3b33b'); R(g, qx - 1, by + 2, 3, 1, '#f4f1e6'); }
      person(g, 191, 58, '#f4f4f4', { hat: o.color }); // la marraine
      if (t < 0.9) R(g, 192, 60, 1, 1, '#e8b98f'); // elle tient la bouteille
      if (t > 1.35 && t < 2.6) for (let i = 0; i < 16; i++) { // mousse et éclats de verre
        const k = (t - 1.35) / 1.25, a = (i / 16) * PI * 2, r = 3 + k * (6 + hash(i, 47) % 6);
        R(g, 156 + Math.cos(a) * r, 69 + Math.sin(a) * r * 0.8 + k * k * 8, 1, 1, i % 4 === 0 ? '#5fbf7a' : i % 2 ? '#fff6d8' : '#f4f4f4');
      }
      // Feu d'artifice.
      if (t > 2.4) {
        const cols = [o.color, '#ffd34d', '#f4f4f4', '#5fd3e8'];
        for (let b = 0; b < 3; b++) {
          const k = ((t - 2.4) / 2 + b / 3) % 1, n = Math.floor((t - 2.4) / 2 + b / 3);
          const ex = 30 + (hash(b, 48 + (n % 2)) % 130), ey = 10 + hash(b, 49 + (n % 2)) % 24, col = cols[(b + n) % 4];
          if (k < 0.25) R(g, ex, ey + (1 - k / 0.25) * 26, 1, 2, '#ffe9b0'); // la fusée monte
          else {
            const e = (k - 0.25) / 0.75, r = 3 + e * 14;
            g.globalAlpha = 1 - e * e;
            if (e < 0.12) R(g, ex - 1, ey - 1, 3, 3, '#fffbe6'); // l'éclair de l'explosion
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * PI * 2, fall = e * e * 5;
              R(g, ex + Math.cos(a) * r, ey + Math.sin(a) * r + fall, 1, 1, col);
              R(g, ex + Math.cos(a) * r * 0.7, ey + Math.sin(a) * r * 0.7 + fall * 0.7, 1, 1, i % 2 ? col : '#fff6d8'); // traînée
            }
            g.globalAlpha = 1;
          }
        }
      }
    },
  },
  // Un concurrent agrandit sa flotte : son navire passe dans les jumelles, à ses couleurs.
  // Variante 'kind/new' : navire neuf, escorté par un remorqueur qui lance ses jets d'eau.
  rivalship: {
    title: 'Un concurrent agrandit sa flotte', mood: 'info', loop: [2.6, 4.6],
    draw(g, t, o) {
      const [kind, extra] = (o.variant || 'box').split('/'), isNew = extra === 'new';
      g.drawImage(bands('sky-spy', ['#86bcd9', '#9cc9e1', '#b5d7ea', '#cfe6f1'], 56), 0, 0);
      cloud(g, 60 - t * 2, 18, 30); cloud(g, 140 - t * 2, 26, 24);
      R(g, 0, 53, W, 3, '#7d9aa6'); // côte au loin
      sea(g, t, DAY, 56);
      const ox = Math.round(Math.sin(t * 1.7) * 1.5), oy = Math.round(Math.cos(t * 1.3)); // les mains qui tiennent les jumelles
      // Son navire (le vrai modèle, à ses couleurs) entre par la droite, cap à gauche : l'étrave
      // est à gauche, la poupe et le sillage à droite. Neuf : coque propre ; d'occasion : rouillé.
      const sh = sceneShip(o, kind, { wear: isNew ? 0 : 0.5, laden: false, name: '' }); // cap à gauche : pas de nom à l'envers
      const sx = Math.round(100 - sh.len / 2 + 120 * (1 - ease(t / 2.4))), sy = 76 + Math.round(Math.sin(t * 2) * 0.6);
      const stern = sx + sh.len;
      for (let i = 0; i < 14; i++) { const k = ((t * 1.5 + i / 14) % 1); R(g, stern + 2 + k * 50, sy + 1 + Math.round(Math.sin(i * 2.1) * 2 * k), 3 + k * 4, 1, 'rgba(235,245,250,' + (0.8 * (1 - k)).toFixed(2) + ')'); }
      R(g, sx - 4, sy - 1, 5, 2, '#e8f1f8'); // moustache d'étrave
      sh.draw(g, sx, sy, { flip: true });
      const [jx, jy] = sh.at(sx, sy, sh.x(0.97), sh.deck(0.97), { flip: true });
      companyFlag(g, Math.round(jx), Math.round(jy) - 14, o.color, t, 1, 14); // son pavillon, à la proue
      if (sh.funnel) { const [fx, fy] = sh.at(sx, sy, sh.funnel[0], sh.funnel[1], { flip: true }); smoke(g, fx, fy, t, { n: 8, color: isNew ? '#d8dde2' : '#4a4a4a', alpha: 0.6, rise: 6, drift: 6, size: 3 }); }
      if (isNew) {
        for (let i = 0; i < 3; i++) { const k = ((t * 0.7 + i / 3) % 1), x = sx + k * sh.len; R(g, x, Math.round(sy + sh.rim(1 - k)) + 2, 3, 1, 'rgba(255,255,255,0.9)'); } // coque neuve qui brille
        // Remorqueur d'escorte et ses jets d'eau en arc.
        const tx = Math.min(stern - 12, sx + 40), ty = sy + 14;
        R(g, tx - 11, ty - 3, 24, 4, '#b8332c'); R(g, tx - 9, ty + 1, 20, 1, '#1d1d1d'); R(g, tx - 3, ty - 8, 8, 5, '#f4f4f4'); R(g, tx - 1, ty - 7, 4, 1, '#24323c'); R(g, tx, ty - 12, 2, 4, '#e3b33b');
        for (let j = 0; j < 2; j++) for (let i = 0; i < 16; i++) {
          const k = ((t * 1.2 + i / 16) % 1), dir = j ? 1 : -1;
          R(g, tx + 1 + dir * k * 30, ty - 12 - Math.sin(k * PI) * 22, 2, 2, 'rgba(235,246,252,' + (1 - 0.4 * k).toFixed(2) + ')');
        }
      }
      gulls(g, (t % 3) * 0.8, 2, [sx + sh.len / 2 + 20, 34], -1);
      // Les deux oculaires : tout ce qui sort des cercles est noir, bague de laiton, reflets.
      const r = 44, cA = 73 + ox, cB = 127 + ox, cy = 56 + oy;
      for (let y = 0; y < H; y++) {
        const dy = y + 0.5 - cy, inside = r * r - dy * dy;
        if (inside <= 0) { R(g, 0, y, W, 1, '#0b0d12'); continue; }
        const dx = Math.round(Math.sqrt(inside)), a0 = cA - dx, a1 = cA + dx, b0 = cB - dx, b1 = cB + dx;
        R(g, 0, y, a0, 1, '#0b0d12'); R(g, b1, y, W - b1, 1, '#0b0d12');
        if (a1 < b0) R(g, a1, y, b0 - a1, 1, '#0b0d12'); // entre les deux cercles, en haut et en bas
        R(g, a0, y, 2, 1, '#9a7a34'); R(g, b1 - 2, y, 2, 1, '#6e5624');
        if (a1 < b0) { R(g, a1 - 2, y, 2, 1, '#6e5624'); R(g, b0, y, 2, 1, '#9a7a34'); }
      }
      for (const c of [cA, cB]) for (let i = 0; i < 8; i++) { const a = -2.4 + i * 0.08; R(g, c + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6), 2, 1, 'rgba(255,255,255,0.35)'); }
    },
  },

  // Nouveau niveau : l'échafaudage passe de gauche à droite et le bureau se transforme ; les
  // étoiles du niveau s'allument, confettis. variant : { from, to (bureaux en pixel art, officeShot), level }.
  office: {
    title: 'Un nouveau bureau !', mood: 'good', loop: [3.8, 5.8], res: 3, crisp: true,
    draw(g, t, o) {
      const v = o.variant || {};
      R(g, 0, 0, W, H, '#1b1f27');
      const paint = (shot) => { const s = typeof shot === 'function' ? shot() : null; if (s) drawOfficeShot(g, s, officeLeft(s)); };
      const wx = Math.round(-12 + (W + 24) * clamp01((t - 1) / 2));
      paint(v.from);
      if (wx > 0) { g.save(); g.beginPath(); g.rect(0, 0, wx, H); g.clip(); paint(v.to); g.restore(); }
      if (t > 0.9 && t < 3.1) { // l'échafaudage, ses planches et l'ouvrier au rouleau
        R(g, wx - 1, 0, 2, H, '#8a6a3a'); R(g, wx + 7, 0, 2, H, '#8a6a3a');
        for (let y = 14; y < H; y += 26) R(g, wx - 3, y, 14, 2, '#b58a4e');
        const py = 40 + Math.round(Math.sin(t * 5) * 24);
        g.save(); g.scale(2, 2); person(g, (wx + 1) / 2, py / 2, '#f2c230', { hat: '#ffffff' }); g.restore();
        R(g, wx - 3, py + 2, 2, 6, '#ffffff'); R(g, wx - 4, py + 8, 4, 2, o.color); // rouleau
        smoke(g, wx - 4, 100, t, { n: 10, color: '#e8e0d0', alpha: 0.5, rise: 10, drift: -3, size: 4, life: 1.6 });
      }
      if (t > 3) {
        const n = v.level || 1;
        const star = (x, y, sc, c) => {
          const rows = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
          rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') R(g, x + (i - 3) * sc, y + (j - 3) * sc, sc, sc, c); }));
        };
        for (let i = 0; i < n; i++) { // les étoiles du niveau, une à une
          const k = clamp01((t - 3 - i * 0.18) / 0.25); if (k <= 0) continue;
          const x = 14 + i * 18, y = 13;
          star(x + 1, y + 1, 2, 'rgba(0,0,0,0.45)');
          star(x, y, k < 1 ? 3 : 2, (Math.floor(t * 3 + i) % 5) ? '#ffd34d' : '#fff6c0');
        }
        const cols = [o.color, '#ffd34d', '#f4f4f4', '#5fd3e8', '#ff8a7a'];
        for (let i = 0; i < 40; i++) { // confettis
          const k = ((t - 3) / 2 + (hash(i, 61) % 100) / 100) % 1;
          R(g, (hash(i, 62) % W) + Math.sin(t * 3 + i) * 3, -4 + k * (H + 8), 2, 1 + (i % 2), cols[i % cols.length]);
        }
      }
    },
  },
  // Un équipage gagne un point de spécialité : sur le pont, le capitaine épingle une médaille,
  // les marins lancent leur bonnet en l'air et une étoile s'élève.
  crewxp: {
    title: 'Un équipage gagne en expérience', mood: 'good', loop: [3, 5],
    draw(g, t, o) {
      g.drawImage(bands('sky-crew', ['#7fb6d6', '#97c6df', '#b2d5e8', '#cbe3ef'], 52), 0, 0);
      cloud(g, 120 - t * 2, 14, 30); cloud(g, 186 - t * 2, 26, 22);
      sea(g, t, DAY, 52, 52, 84);
      // Château et cheminée aux couleurs de la compagnie.
      R(g, 0, 26, 48, 58, '#f2efe6'); R(g, 0, 26, 48, 2, '#d8d3c6');
      for (let x = 4; x < 44; x += 7) { R(g, x, 34, 4, 4, '#24323c'); R(g, x, 50, 4, 4, '#24323c'); }
      R(g, 14, 8, 16, 18, o.color); R(g, 14, 8, 16, 3, '#1b1b1b');
      smoke(g, 22, 6, t, { n: 8, color: '#9aa0a6', alpha: 0.5, rise: 5, drift: 5, size: 3 });
      // Bastingage et pont.
      R(g, 48, 70, W - 48, 1, '#f4f4f4'); R(g, 48, 77, W - 48, 1, '#f4f4f4');
      for (let x = 52; x < W; x += 12) R(g, x, 70, 1, 14, '#e2e2e2');
      R(g, 0, 84, W, H - 84, '#6c7a72'); R(g, 0, 84, W, 1, '#8c9a92');
      for (let x = 0; x < W; x += 16) R(g, x, 92 + (x % 32 ? 0 : 8), 10, 1, '#5d6b63');
      gulls(g, t % 4, 2, [210, 30]);
      // La médaille, puis l'étoile qui s'élève au-dessus de l'équipage.
      if (t > 2.2) {
        const k = ease((t - 2.2) / 0.8), sy = 66 - k * 38, tw = Math.floor(t * 4) % 2;
        const rows = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
        rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') R(g, 113 + (i - 3) * 3, sy + (j - 3) * 3, 3, 3, tw ? '#ffd34d' : '#ffe680'); }));
        if (k >= 1) for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2 + t; R(g, 114 + Math.cos(a) * (15 + tw), sy + Math.sin(a) * (15 + tw), 1, 1, '#fff6c0'); }
      }
      g.save(); g.scale(2, 2);
      const xs = [46, 56, 66, 76], cheer = t > 2.2;
      xs.forEach((x, i) => { // les marins, en rang
        const bob = cheer ? (Math.floor(t * 4 + i) % 2) : 0;
        person(g, x, 42 - bob, '#2e4a7a', { hat: '#f4f4f4' });
        R(g, x, 44 - bob, 3, 1, '#f4f4f4'); // col marin
        if (cheer) { // le bonnet lancé en l'air, qui retombe
          const k = ((t - 2.2) % 2) / 0.9;
          if (k < 1) { R(g, x, 42 - bob, 3, 1, '#e8b98f'); R(g, x, 42 - bob - Math.sin(k * PI) * (10 + i * 2), 3, 1, '#f4f4f4'); }
        }
      });
      const cin = ease(t / 1.4), cx = 26 + cin * 25; // le capitaine vient se placer à côté du deuxième marin
      person(g, cx, 44, '#1d2f55', { hat: '#f4f4f4', step: cin < 1 ? Math.floor(t * 5) % 2 : 0 });
      R(g, cx, 46, 1, 1, '#e3b33b'); R(g, cx + 2, 46, 1, 1, '#e3b33b'); // épaulettes
      if (t > 1.5 && t < 2.1) R(g, cx + 3, 46, 2, 1, '#e8b98f'); // il épingle la médaille
      if (t > 1.8) { const bob = cheer ? (Math.floor(t * 4 + 1) % 2) : 0; R(g, 57, 44 - bob, 1, 1, o.color); R(g, 57, 45 - bob, 1, 1, Math.floor(t * 3) % 3 ? '#e3b33b' : '#fff6c0'); } // ruban et médaille
      g.restore();
    },
  },

  // Les glaces reviennent : la neige tombe, la banquise gagne le port (variante 'sea' : le
  // passage du Nord-Est se referme sous les aurores, un ours polaire s'avance sur la glace).
  freeze: {
    title: 'Les glaces reviennent', mood: 'info', loop: [4.6, 6.6],
    draw(g, t, o) {
      const sea = o.variant === 'sea', p = ease((t - 0.6) / 3.6);
      const night = clamp01((t - 1) / 3);
      g.drawImage(bands('sky-winter', ['#6d7d8e', '#8796a5', '#a3afbb', '#bcc5cd'], 56), 0, 0);
      g.globalAlpha = night * 0.85; g.drawImage(bands('sky-polar', ['#07101f', '#0d1a30', '#15284a', '#22385c'], 56), 0, 0); g.globalAlpha = 1;
      if (sea && night > 0.5) { // aurore boréale
        for (let x = 0; x < W; x += 2) {
          const yy = 14 + Math.sin(x / 23 + t * 0.8) * 6 + Math.sin(x / 9 - t * 1.3) * 2;
          g.globalAlpha = (night - 0.5) * 1.2 * (0.5 + 0.5 * Math.sin(x / 31 + t));
          R(g, x, yy, 2, 10 + Math.sin(x / 13 + t) * 4, x % 6 ? '#5ff0a8' : '#9cf7c8');
        }
        g.globalAlpha = 1;
        stars(g, t, 18, 40);
      }
      sea_(g, t, { cols: ['#3e5566', '#35495a', '#2d3f4f', '#253545'], crest: '#7f97a8' }, 56);
      for (let y = 56; y < H; y++) { // la banquise avance depuis la côte (et se soude au large)
        const d = (y - 56) / (H - 56);
        if (sea) { if (p > 0.85) iceRow(g, y, 0, W, 9); } else {
          const edge = 200 - p * (250 + d * 40) + Math.sin(y * 0.9) * 4 + (hash(y, 75) % 5);
          iceRow(g, y, Math.max(0, edge), W, 3);
        }
      }
      if (sea && p <= 0.85) FLOES.forEach((f, k) => floe(g, f.x, f.y, f.r * (0.4 + p * 3.2) * (0.7 + (f.y - 56) / 80), k)); // plaques qui grossissent et se soudent
      if (!sea) snowyQuay(g, t, night > 0.3 ? 1 : 0);
      if (sea && t > 3.6) { const k = clamp01((t - 3.6) / 2.4); polarBear(g, 210 - k * 120, 82, Math.floor(t * 4) % 2); }
      snow(g, t, 40 + Math.round(p * 50), 12 + p * 6, 8 + p * 10);
      vignette(g, 'rgba(220,235,245,A)', 0.18 + p * 0.12);
    },
  },
  // Dégel : le soleil revient, la banquise se fend et part en plaques, les oies reviennent
  // (variante 'sea' : un brise-glace ouvre le passage du Nord-Est, un navire le suit).
  thaw: {
    title: 'Le dégel', mood: 'good', loop: [4.8, 6.8],
    draw(g, t, o) {
      const sea = o.variant === 'sea', p = ease((t - 0.8) / 3.6);
      g.drawImage(bands('sky-spring', ['#7fb6d6', '#9bc8e0', '#bcdcec', '#e3eef0'], 56), 0, 0);
      const sunY = 50 - ease(t / 2.5) * 26; // le soleil se lève
      disc(g, 150, sunY, 7, '#ffe48a'); disc(g, 150, sunY, 10, 'rgba(255,228,138,0.25)');
      sea_(g, t, DAY, 56);
      // La glace se fend, puis s'en va en plaques qui dérivent et fondent.
      if (p < 0.2) for (let y = 56; y < H; y++) iceRow(g, y, 0, W, 5);
      else FLOES.forEach((f, k) => {
        const q = (p - 0.2) / 0.8, depth = 0.7 + (f.y - 56) / 80;
        floe(g, f.x + q * (k % 2 ? 26 : -20) * depth, f.y + q * 3, f.r * 1.9 * depth * (1 - q * (sea ? 0.55 : 0.85)), k);
      });
      if (p < 0.35) for (let i = 0; i < 12; i++) { // fissures qui s'ouvrent
        const x = hash(i, 77) % W, y = 60 + hash(i, 78) % 50, L = Math.round(p * 60);
        line(g, x, y, x + L * Math.cos(i), y + L * 0.3 * Math.sin(i * 2), '#3e5566');
      }
      if (sea) {
        const k = clamp01((t - 1.2) / 4), bx = -30 + k * 150;
        for (let i = 0; i < 12; i++) R(g, bx - 30 - i * 6, 84 + Math.sin(i * 1.7 + t * 4) * 2, 4, 1, '#e8f3f8'); // chenal ouvert
        sceneShip(o, 'box', { far: 0.6 }).draw(g, bx - 24, 87); // un navire suit dans le chenal
        icebreaker(g, bx, 86);
      } else {
        snowyQuay(g, t, 0);
        for (let i = 0; i < 4; i++) R(g, 160 + i * 7, 51 + ((t * 3 + i) % 4), 1, 1, '#9fd0ec'); // le toit dégoutte
      }
      // Les oies sauvages reviennent, en V.
      if (t > 1.5) { const gx = 220 - ((t - 1.5) * 28) % 260; for (let i = 0; i < 7; i++) { const off = Math.abs(i - 3); R(g, gx + off * 5, 22 + off * 3 + (Math.floor(t * 5 + i) % 2), 3, 1, '#2b2f38'); } }
    },
  },
  // Votre navire pris par les glaces au port : la banquise l'enserre, la neige s'accumule sur
  // le pont, des stalactites pendent, un matelot déneige ; le givre gagne les bords de l'image.
  icecaught: {
    title: 'Pris par les glaces', mood: 'bad', loop: [4.4, 6.4],
    draw(g, t, o) {
      const p = ease((t - 0.5) / 3.2), lock = t > 3.6 && t < 3.9;
      const sh = sceneShip(o), bx = bowAt(sh, 104, 186), sx0 = bx - sh.len, wy = 81;
      g.drawImage(bands('sky-winter', ['#6d7d8e', '#8796a5', '#a3afbb', '#bcc5cd'], 56), 0, 0);
      sea_(g, t, { cols: ['#3e5566', '#35495a', '#2d3f4f', '#253545'], crest: '#7f97a8' }, 56, 56, 84);
      for (let y = 56; y < 84; y++) { // la glace se referme des deux côtés vers le navire
        const d = (y - 56) / 28, gap = (1 - p) * 70 * (0.5 + d);
        iceRow(g, y, 0, sx0 + 18 - gap + Math.sin(y) * 2, 1); iceRow(g, y, bx - 6 + gap - Math.sin(y * 1.3) * 2, W, 2);
      }
      const shake = lock ? Math.round(Math.sin(t * 60)) : 0;
      sh.draw(g, bx + shake, wy);
      for (let x = Math.max(0, Math.round(sx0)); x < bx - 2; x += 3) { // neige sur le pont, stalactites sous le liston
        const fr = sh.fr(x - bx), top = Math.round(wy + sh.deck(fr)), rim = Math.round(wy + sh.rim(fr));
        const hgt = Math.round(p * (1 + (hash(x, 79) % 3)));
        if (hgt) R(g, x + shake, top - hgt + 1, 3, hgt, ICE_C.snow);
        if (p > 0.4 && hash(x, 80) % 3 === 0) R(g, x + 1 + shake, rim + 2, 1, 1 + Math.round(p * (hash(x, 81) % 4)), '#cfe6f1');
      }
      if (p > 0.95) for (let y = 79; y < 84; y++) iceRow(g, y, Math.max(0, sx0 - 12), Math.min(W, bx + 12), 4); // le navire est soudé à la banquise
      quay(g, 84); R(g, 0, 84, W, 2, ICE_C.snow);
      // Un matelot déneige le pont à la pelle.
      const mx = Math.round(bx + sh.x(0.55)), my = stand(deckUnder(sh, bx, wy, mx + 1)), dig = Math.floor(t * 2.5) % 2;
      person(g, mx + shake, my, '#c0392b', { hat: '#2b2b30' });
      R(g, mx + 3 + shake, my + 2 + dig, 1, 4, '#6b4320'); R(g, mx + 3 + shake, my + 6 + dig, 2, 1, '#9aa3ab');
      if (dig) for (let i = 0; i < 4; i++) R(g, mx + 6 + i * 2 + shake, my - 1 - i, 1, 1, ICE_C.snow);
      snow(g, t, 70, 16, 12);
      // Givre qui gagne les bords et les coins de l'image.
      const f = clamp01((t - 1.8) / 2.2);
      for (let i = 0; i < 420 * f; i++) {
        const side = i % 4, k = hash(i, 82) % (side < 2 ? H : W);
        const corner = Math.min(k, (side < 2 ? H : W) - k) < 18 ? 2 : 1; // plus épais dans les coins
        const dpt = Math.floor(((hash(i, 83) % 100) / 100) ** 2 * 16 * corner * f);
        const [x, y] = side === 0 ? [dpt, k] : side === 1 ? [W - 1 - dpt, k] : side === 2 ? [k, dpt] : [k, H - 1 - dpt];
        R(g, x, y, 1, 1, dpt < 4 ? '#ffffff' : dpt < 9 ? '#e4f2f9' : '#c9e2ef');
      }
    },
  },

  // Incendie à bord : les flammes montent au milieu du pont, la fumée noircit le ciel, puis
  // l'équipage arrose et maîtrise le feu (la fumée blanchit).
  fire: {
    title: 'Incendie à bord !', mood: 'bad', loop: [5, 7],
    draw(g, t, o) {
      const I = t < 2.6 ? ease(t / 2) : Math.max(0.12, 1 - ease((t - 2.6) / 2.4) * 0.88);
      g.drawImage(bands('sky-fire', ['#140f20', '#22162a', '#3a1d30', '#5c2834'], 52), 0, 0);
      stars(g, t, 10, 24);
      sea_(g, t, NIGHT, 52);
      const sh = sceneShip(o), bx = bowAt(sh, 104), wy = 82;
      const fx = Math.round(bx + sh.x(0.6)), deck = deckUnder(sh, bx, wy, fx); // le feu, sur le pont avant
      for (let y = 84; y < 108; y += 2) { // reflet du feu sur l'eau
        g.globalAlpha = I * 0.45 * (1 - (y - 84) / 26);
        R(g, fx - 10 + Math.sin(t * 6 + y) * 3, y, 22 - (y - 84) * 0.5, 1, '#ff9a3c');
      }
      g.globalAlpha = 1;
      for (const [r, a] of [[26, 0.05], [18, 0.07], [11, 0.1]]) disc(g, fx, deck - 4, r * (0.6 + I * 0.5), `rgba(255,140,50,${(I * a).toFixed(3)})`); // lueur
      sh.draw(g, bx, wy);
      const spread = Math.max(2, Math.min(5, Math.round(sh.len / 20)));
      smoke(g, fx, deck - 14 - I * 4, t, { n: 16, color: I > 0.35 ? '#262626' : '#9aa0a6', alpha: 0.75, rise: 9, drift: 4, size: 4 + I * 3, life: 3 });
      for (let k = 0; k < spread; k++) flame(g, fx - (spread - 1) * 2.5 + k * 5, deck, t, (2 + I * 6) * (0.6 + (k % 2) * 0.4), k);
      // Les pompiers du bord : lances à incendie braquées sur le feu, de part et d'autre.
      const crew = [[Math.round(bx + sh.x(0.32)), 1], [Math.round(bx + sh.x(0.88)), -1]];
      for (const [x] of crew) person(g, x, stand(deckUnder(sh, bx, wy, x + 1)), '#e8a33a', { hat: '#c0392b' });
      if (t > 2.4) for (const [x0, dir] of crew) {
        const y0 = stand(deckUnder(sh, bx, wy, x0 + 1)) + 3, dx = Math.abs(fx - x0) - 2;
        for (let i = 0; i < 12; i++) { const k = (t * 1.6 + i / 12) % 1; R(g, x0 + 1 + dir * k * dx, y0 - Math.sin(k * PI) * 10 + k * (deck - 3 - y0), 1, 2, 'rgba(200,230,250,0.9)'); }
      }
      if (t > 3.2) smoke(g, fx, deck - 8, t, { n: 8, color: '#e8edf0', alpha: 0.45, rise: 7, drift: -3, size: 3, seed: 5 }); // vapeur
      vignette(g, 'rgba(120,30,10,A)', 0.25 + I * 0.2);
    },
  },
  // Abordage : dans la brume, votre navire et un autre se heurtent étrave contre étrave ;
  // étincelles, débris, tôle enfoncée, puis on dérive, une bouée flotte.
  collision: {
    title: 'Collision en mer !', mood: 'bad', loop: [4.4, 6.4],
    draw(g, t, o) {
      g.drawImage(bands('sky-fog', ['#9aa6ae', '#aab4bb', '#b9c2c8', '#c6ced3'], 52), 0, 0);
      sea_(g, t, { cols: ['#55707c', '#4b6672', '#425c68', '#3a525e'], crest: '#9db4bd' }, 52);
      const k = Math.min(t, 2) / 2, back = ease((t - 2) / 1.2) * (t > 2 ? 5 : 0);
      const shake = t > 2 && t < 2.5 ? Math.round(Math.sin(t * 70)) : 0;
      // Étrave contre étrave en x = 110 : le vôtre arrive de gauche, l'autre (un vraquier) de droite.
      const mine = sceneShip(o), other = sceneShip(o, 'bulk', { ship: null, type: 'vraquier_handy', color: '#5d6f85', wear: 0.3 });
      const ax = Math.round(108 - (1 - k) * 38 - back + shake), bx = Math.round(112 + (1 - k) * 38 + back - shake);
      other.draw(g, bx, 83, { flip: true });
      mine.draw(g, ax, 82);
      if (t > 2) { // tôles enfoncées aux deux étraves
        const ya = Math.round(82 + mine.rim(0.97)) + 2, yb = Math.round(83 + other.rim(0.97)) + 2;
        R(g, ax - 4, ya, 3, 3, '#1d1d1d'); R(g, ax - 6, ya + 2, 2, 2, '#3a3a3a');
        R(g, bx + 2, yb, 3, 3, '#1d1d1d');
      }
      if (t > 1.95 && t < 2.15) disc(g, 110, 74, 10, 'rgba(255,250,230,0.85)'); // le choc
      burst(g, 110, 74, (t - 2) / 0.9, 44, ['#ffd34d', '#ff8a3c', '#fff6c0'], 34, 30, 3); // étincelles
      burst(g, 110, 82, (t - 2.05) / 1.1, 24, ['#e8f3f8', '#b7d3e6'], 22, 18, 21); // gerbe d'eau
      burst(g, 110, 76, (t - 2) / 1.4, 10, ['#2b2b30', '#5b6068'], 16, 10, 9); // débris
      if (t > 2.6) { // bouée et débris qui flottent
        const bob = Math.round(Math.sin(t * 3));
        R(g, 118, 88 + bob, 5, 3, '#f07c1f'); R(g, 119, 89 + bob, 3, 1, '#3a525e');
        for (let i = 0; i < 4; i++) R(g, 98 + i * 7, 90 + ((i + Math.round(t)) % 2), 2, 1, '#3a3a3a');
      }
      for (let i = 0; i < 4; i++) { // nappes de brume qui passent
        const x = ((t * (5 + i) + i * 60) % (W + 80)) - 60;
        g.globalAlpha = 0.16; R(g, x, 40 + i * 14, 70, 4, '#eef2f4'); R(g, x + 12, 38 + i * 14, 40, 2, '#eef2f4'); R(g, x - 10, 44 + i * 14, 30, 2, '#eef2f4'); g.globalAlpha = 1;
      }
    },
  },
  // Échouement : le navire file vers la côte et touche les rochers au pied du phare ; il se
  // cabre, les embruns jaillissent, puis deux remorqueurs viennent le tirer de là.
  grounding: {
    title: 'Échouement', mood: 'bad', loop: [4.6, 6.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-ground', ['#7fb0cc', '#94bfd6', '#acd0e2', '#c5dfec'], 52), 0, 0);
      sea_(g, t, DAY, 52);
      // Côte, falaise et phare à droite.
      R(g, 166, 46, 34, 40, '#7d7262'); R(g, 158, 58, 10, 28, '#8a7f6e'); R(g, 166, 46, 34, 3, '#6f8f4f');
      R(g, 182, 22, 6, 24, '#f4f4f4'); for (let y = 26; y < 46; y += 8) R(g, 182, y, 6, 3, '#c0392b');
      R(g, 181, 18, 8, 4, '#3c434c'); R(g, 183, 19, 4, 2, '#ffe48a');
      const beam = (t * 0.9) % 2 < 1;
      if (beam) cone(g, 185, 20, 120, 10, 120, 30, '#fff3b0', 0.18);
      // Le navire file vers les rochers (étrave en 136), se cabre au choc, puis les remorqueurs tirent.
      const sh = sceneShip(o), hit = 1.8, sail = Math.min(t, hit) / hit;
      const tug = clamp01((t - 2.8) / 1.6), pull = t > 4.4 ? Math.sin((t - 4.4) * 3) * 0.6 : 0;
      const bx = Math.round(40 + ease(sail) * 96 - tug * 3 + pull), ang = t > hit ? -0.07 * ease((t - hit) / 0.3) * (1 - tug * 0.3) * Math.min(1, 100 / sh.len) : 0;
      const shake = t > hit && t < hit + 0.4 ? Math.round(Math.sin(t * 70)) : 0;
      sh.draw(g, bx + shake, 82, { slope: ang });
      for (const [x, w, hh] of [[132, 8, 5], [140, 10, 7], [150, 9, 5], [126, 6, 3]]) { R(g, x, 86 - hh, w, hh, '#4a4f55'); R(g, x + 1, 86 - hh, w - 3, 1, '#6d747c'); } // rochers
      burst(g, 136, 80, (t - hit) / 1, 22, ['#e8f3f8', '#b7d3e6', '#ffffff'], 16, 24, 7); // embruns
      if (tug > 0) { // remorqueurs qui tirent la poupe vers le large
        const [px, py] = sh.at(bx, 82, -sh.len + 2, -4, { slope: ang });
        for (const [dx, dy] of [[-12, 86], [4, 92]]) {
          const tx = Math.max(12 + dx, px + dx) - (1 - tug) * 50;
          tugSide(g, tx, dy, -1);
          line(g, tx + 8, dy - 4, px, py, '#3c3c3c');
          for (let i = 0; i < 5; i++) R(g, tx - 12 - i * 4 - ((t * 20) % 4), dy + 1 + (i % 2), 3, 1, '#e8f3f8'); // l'hélice brasse
        }
      }
      gulls(g, t % 4, 2, [200, 30]);
    },
  },
  // Voie d'eau : une tôle fissurée cède, la cale se remplit (vue en coupe), le navire
  // s'enfonce un peu ; puis les pompes rejettent l'eau par-dessus bord.
  leak: {
    title: 'Voie d\'eau', mood: 'bad', loop: [4, 6],
    draw(g, t, o) {
      g.drawImage(bands('sky-leak', ['#8796a3', '#9aa7b2', '#adb8c1', '#bfc8cf'], 52), 0, 0);
      const SEAL = { cols: ['#4f6b78', '#46626f', '#3e5866', '#364f5c'], crest: '#93acb7' };
      sea_(g, t, SEAL, 52);
      const level = t < 2.5 ? ease(t / 2.5) * 0.7 : 0.7 - ease((t - 2.5) / 2) * 0.35; // eau dans la cale
      const sinkY = Math.round(level * 4), y = 82 + sinkY;
      const sh = sceneShip(o), bx = bowAt(sh, 104);
      sh.draw(g, bx, y);
      sea_(g, t, SEAL, 52, 84, H); // l'eau monte sur la coque
      // Vue en coupe de la cale, sur le flanc : l'eau entre par la fissure.
      const ww = Math.round(Math.max(18, Math.min(32, sh.len * 0.4))), wh = 13;
      const wx0 = Math.round(bx + sh.x(0.55) - ww / 2), wy0 = y - wh - 2;
      R(g, wx0 - 1, wy0 - 1, ww + 2, wh + 2, '#f4f4f4'); R(g, wx0, wy0, ww, wh, '#2b2f38');
      for (let i = 0; i * 8 + 8 <= ww; i++) R(g, wx0 + 3 + i * 8, wy0 + 2, 5, 5, '#6b4f2e'); // marchandise
      const wl = Math.round(wh * level);
      R(g, wx0, wy0 + wh - wl, ww, wl, 'rgba(70,140,190,0.85)'); R(g, wx0, wy0 + wh - wl, ww, 1, '#a9d3ea');
      line(g, wx0 + 2, wy0 + wh, wx0 + 4, wy0 + wh - 3, '#111'); line(g, wx0 + 4, wy0 + wh - 3, wx0 + 3, wy0 + wh - 5, '#111'); // fissure
      if (t < 3) for (let i = 0; i < 6; i++) { const k = (t * 2 + i / 6) % 1; R(g, wx0 + 3 + k * 8, wy0 + wh - 3 - Math.sin(k * PI) * 3, 1, 1, '#cfe8f5'); }
      if (t > 2.5) for (let j = 0; j < 2; j++) { // les pompes rejettent l'eau par-dessus bord
        const fr = 0.22 + j * 0.12, sx = Math.round(bx + sh.x(fr)), sy = Math.round(y + sh.rim(fr));
        for (let i = 0; i < 12; i++) { const k = (t * 1.4 + i / 12 + j * 0.5) % 1; R(g, sx - k * 16, sy + 1 + k * k * (y - sy + 2) - Math.sin(k * PI) * 4, 1, 2, 'rgba(210,235,248,0.9)'); }
      }
      vignette(g, 'rgba(20,40,60,A)', 0.2);
    },
  },
  // Avarie de machine : la cheminée tousse de la fumée noire, puis plus rien ; le navire dérive,
  // deux boules noires au mât (« navire non maître de sa manœuvre »), le mécanicien tape.
  breakdown: {
    title: 'Avarie de machine', mood: 'info', loop: [3.6, 5.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-breakdown', ['#7fb6d6', '#97c6df', '#b2d5e8', '#cbe3ef'], 52), 0, 0);
      cloud(g, 40 - t * 2, 16, 30); cloud(g, 150 - t * 2, 24, 24);
      sea_(g, t, DAY, 52);
      const stop = ease(t / 2.2), bob = Math.round(Math.sin(t * 2) * 0.6);
      const sh = sceneShip(o), bx = bowAt(sh, 104), wy = 82 + bob, stern = bx - sh.len;
      for (let i = 0; i < 10; i++) { const k = (t * 1.5 + i / 10) % 1; g.globalAlpha = (1 - stop) * (1 - k); R(g, stern - 4 - k * 40, 83 + (i % 2), 5, 1, '#e8f3f8'); } // le sillage s'éteint
      g.globalAlpha = 1;
      sh.draw(g, bx, wy);
      if (t < 1.8 && sh.funnel) { // la machine tousse
        const fx = bx + sh.funnel[0], fy = wy + sh.funnel[1];
        for (let i = 0; i < 4; i++) { const k = ((t * 1.3 + i / 4) % 1); if (Math.floor(t * 3 + i) % 3) disc(g, fx + k * 8, fy - k * 14, 2 + k * 4, `rgba(30,30,30,${(0.8 * (1 - k)).toFixed(2)})`); }
      }
      if (t > 1.8) { // deux boules noires au mât de l'avant (« non maître de sa manœuvre »)
        const k = clamp01((t - 1.8) / 0.6), mx = Math.round(bx + sh.x(0.9)), base = deckUnder(sh, bx, wy, mx);
        R(g, mx, base - 18, 1, 18, '#6d747c');
        disc(g, mx, base - 12 - k * 4, 2, '#111'); disc(g, mx, base - 6 - k * 4, 2, '#111');
      }
      // Le mécanicien, au panneau de la salle des machines, tape au marteau.
      const ex = Math.round(bx + sh.x(0.45)), ey = stand(deckUnder(sh, bx, wy, ex + 1)), hammer = Math.floor(t * 4) % 2;
      person(g, ex, ey, '#2e4a7a', { hat: '#f4f4f4' });
      R(g, ex + 4, ey + 1 - hammer * 2, 1, 4, '#6b4320'); R(g, ex + 3, ey - hammer * 2, 3, 2, '#9aa3ab');
      if (!hammer) burst(g, ex + 6, ey + 5, (t * 4) % 1, 6, ['#ffd34d', '#fff6c0'], 6, 6, 11);
      R(g, ex + 7, ey + 4, 6, 3, '#3c434c'); R(g, ex + 8, ey + 5, 4, 1, '#1d1d1d'); // panneau ouvert
    },
  },
  // Panne des groupes frigorifiques : les voyants passent au rouge, le thermomètre grimpe,
  // la chaleur ondule au-dessus de la cargaison, un technicien se bat avec le tableau électrique.
  reefer: {
    title: 'Panne des groupes frigorifiques', mood: 'bad', loop: [3.6, 5.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-reefer', ['#5aa0d0', '#78b4dc', '#9cc8e6', '#c2def0'], 52), 0, 0);
      disc(g, 30, 18, 8, '#ffe48a'); disc(g, 30, 18, 12, 'rgba(255,228,138,0.25)'); // soleil des tropiques
      sea_(g, t, DAY, 52);
      const sh = sceneShip(o), bx = bowAt(sh, 92, 158), wy = 82;
      sh.draw(g, bx, wy);
      const heat = ease(t / 3);
      const n = Math.max(2, Math.min(5, Math.floor((sh.len * 0.4) / 9))), x0 = Math.round(bx + sh.x(0.5));
      let topY = 99;
      for (let i = 0; i < n; i++) { // conteneurs frigorifiques sur le pont et leur voyant
        const x = x0 + i * 9 - (n > 3 ? 9 : 0), y0 = deckUnder(sh, bx, wy, x + 4) - 6;
        topY = Math.min(topY, y0);
        R(g, x, y0, 8, 6, '#f2f2ee'); R(g, x, y0, 8, 1, '#ffffff'); R(g, x + 1, y0 + 2, 6, 1, '#d4d4cc');
        const red = t > 0.8 + i * 0.15;
        R(g, x + 6, y0 + 4, 1, 1, red ? (Math.floor(t * 4 + i) % 2 ? '#ff3b30' : '#7a1f22') : '#4cd964');
      }
      for (let i = 0; i < 6; i++) { // la chaleur ondule
        const x = x0 - 6 + i * Math.max(4, n * 1.5), k = (t * 0.8 + i / 6) % 1;
        g.globalAlpha = heat * 0.5 * (1 - k); R(g, x + Math.sin(t * 5 + i) * 2, topY - 4 - k * 12, 3, 1, '#fff2c0');
      }
      g.globalAlpha = 1;
      // Thermomètre qui grimpe, du bleu au rouge.
      const tx = 172, top = 18, bot = 84;
      R(g, tx - 2, top, 6, bot - top, '#f4f4f4'); R(g, tx - 1, top + 1, 4, bot - top - 2, '#dfe6ea');
      disc(g, tx + 1, bot + 3, 6, '#f4f4f4');
      const lvl = 0.12 + heat * 0.78, col = heat < 0.4 ? '#3b8fd9' : heat < 0.7 ? '#e8a33a' : '#e0412b';
      R(g, tx, bot - (bot - top - 4) * lvl, 2, (bot - top - 4) * lvl + 2, col); disc(g, tx + 1, bot + 3, 4, col);
      for (let y = top + 6; y < bot; y += 8) R(g, tx + 4, y, 2, 1, '#8a9aa6');
      if (heat < 0.5) { g.globalAlpha = 1 - heat * 2; R(g, tx - 9, bot - 2, 5, 1, '#3b8fd9'); R(g, tx - 7, bot - 4, 1, 5, '#3b8fd9'); g.globalAlpha = 1; } // flocon qui s'efface
      // Le technicien au tableau électrique, entre deux étincelles.
      const ex = Math.round(bx + sh.x(0.3)), ey = stand(deckUnder(sh, bx, wy, ex + 1));
      R(g, ex - 8, ey, 6, 7, '#5b6470'); R(g, ex - 7, ey + 1, 4, 2, '#1d1d1d');
      person(g, ex, ey, '#2e4a7a', { hat: '#f2c230' });
      if (Math.floor(t * 3) % 3 === 0) burst(g, ex - 5, ey + 2, (t * 3) % 1, 7, ['#ffd34d', '#fff6c0', '#5fd3e8'], 7, 8, 13);
    },
  },

  // Saisie par un gang : la nuit, des voitures noires barrent le quai, des hommes armés montent
  // à bord, les feux du navire s'éteignent un à un.
  gang: {
    title: 'Navire aux mains d\'un gang', mood: 'bad', loop: [4, 6],
    draw(g, t, o) {
      g.drawImage(bands('sky-night-dark', ['#05070d', '#0b0f1c', '#121a2c', '#1a2438'], 50), 0, 0);
      stars(g, t, 8, 22);
      sea_(g, t, { cols: ['#141b2a', '#111726', '#0e1421', '#0b101b'], crest: '#3c4a66' }, 50, 50, 84);
      const sh = sceneShip(o), bx = 112, wy = 81;
      sh.draw(g, bx, wy);
      const off = Math.floor(clamp01((t - 2.2) / 1.6) * 5); // les hublots s'éteignent
      for (let i = 0; i < 5; i++) { const x = Math.round(bx + sh.x(0.2 + i * 0.07)); R(g, x, Math.round(wy + sh.rim(0.2 + i * 0.07)) + 2, 2, 2, i < off ? '#1a1f2a' : '#ffe48a'); }
      quay(g, 84); R(g, 0, 84, W, H - 84, 'rgba(0,0,0,0.5)');
      for (const [x, c] of [[140, '#0d0d10'], [170, '#111114']]) { // voitures noires, phares
        const k = ease(t / 1.4), cx = x + (1 - k) * 70;
        R(g, cx, 88, 26, 8, c); R(g, cx + 4, 83, 15, 6, '#16161a'); R(g, cx + 2, 96, 4, 3, '#000'); R(g, cx + 19, 96, 4, 3, '#000');
        R(g, cx - 1, 90, 2, 2, '#fff6c0'); cone(g, cx - 1, 91, cx - 40, 82, cx - 40, 100, '#fff6c0', 0.1);
      }
      const gx = Math.round(bx + sh.x(0.86)), gy = Math.round(wy + sh.rim(0.86)), foot = gx + (84 - gy);
      gangway(g, gx, gy, 84, '#5a4a32');
      // Pieds d'un homme en x : sur le quai, sur la passerelle, puis sur le pont.
      const feet = (x) => x >= foot ? 86 : x >= gx ? Math.min(86, 84 - (foot - x)) : deckUnder(sh, bx, wy, x);
      for (let i = 0; i < 4; i++) { // hommes armés qui montent à bord par la passerelle
        const k = ease(clamp01((t - 1 - i * 0.35) / 1.8)); if (k <= 0) continue;
        const x = Math.round(150 + (gx - 4 - i * 5 - 150) * k), y = stand(feet(x + 1));
        person(g, x, y, '#1b1b1f', { hat: '#111111', head: '#c99a74', step: k < 1 ? Math.floor(t * 6 + i) % 2 : 0 });
        line(g, x - 1, y + 3, x - 5, y + 5, '#6b6b6b'); // fusil
      }
      if (t > 3.2) for (let i = 0; i < 3; i++) { // l'équipage, mains en l'air
        const x = Math.round(bx + sh.x(0.45 + i * 0.06)), y = stand(deckUnder(sh, bx, wy, x + 1));
        person(g, x, y, '#e8e0d0', { hat: '#f4f4f4' }); R(g, x, y - 1, 1, 1, '#e8b98f'); R(g, x + 2, y - 1, 1, 1, '#e8b98f');
      }
      vignette(g, 'rgba(0,0,0,A)', 0.4);
    },
  },
  // Aide d'urgence : au petit matin, le navire décharge des caisses marquées d'un cœur ; la
  // foule attend, des bénévoles font la chaîne, les gens applaudissent.
  charity: {
    title: 'L\'aide d\'urgence est arrivée', mood: 'good', loop: [3.6, 5.6],
    draw(g, t, o) {
      g.drawImage(bands('sky-dawn', ['#f2b28a', '#f6c9a0', '#f4dcbc', '#e9e6d4'], 50), 0, 0);
      disc(g, 160, 44, 9, '#fff0b8');
      sea_(g, t, DAY, 50, 50, 84);
      const sh = sceneShip(o), bx = 108, wy = 81;
      sh.draw(g, bx, wy);
      quay(g, 84);
      // Les caisses passent de main en main, de la passerelle au tas sur le quai.
      const aidBox = (x, y) => { R(g, x, y, 7, 6, '#f4f1e6'); R(g, x, y, 7, 1, '#d8d3c6'); R(g, x + 2, y + 2, 1, 1, '#d6455a'); R(g, x + 4, y + 2, 1, 1, '#d6455a'); R(g, x + 2, y + 3, 3, 1, '#d6455a'); R(g, x + 3, y + 4, 1, 1, '#d6455a'); };
      const gx = Math.round(bx + sh.x(0.86)), gy = Math.round(wy + sh.rim(0.86)), foot = gx + (84 - gy);
      gangway(g, gx, gy, 84);
      const pile = Math.min(6, Math.floor(t * 1.5));
      for (let i = 0; i < pile; i++) aidBox(150 + (i % 3) * 8, 92 - Math.floor(i / 3) * 6);
      const k = (t * 1.2) % 1; aidBox(foot + k * (146 - foot), 84 - Math.sin(k * PI) * 4); // la caisse qui passe
      g.save(); g.scale(2, 2);
      for (const [x, c] of [[60, '#2e86c1'], [66, '#27ae60']]) person(g, x, 42, c, { hat: '#f4f4f4' }); // bénévoles
      [[84, '#c0392b'], [88, '#8e44ad'], [92, '#e67e22'], [96, '#2c3e50'], [99, '#16a085']].forEach(([x, c], i) => {
        const cheer = t > 2 ? Math.floor(t * 4 + i) % 2 : 0;
        person(g, x, 44 - cheer * 0.5, c); if (cheer) R(g, x - 0.5, 44, 1, 1, '#e8b98f');
      });
      g.restore();
      gulls(g, t % 4, 3, [200, 26]);
    },
  },
  ...WORLD_SCENES,
  ...HONOUR_SCENES,
};

// Montre une scène dans une fenêtre, avec une croix de fermeture en haut à droite (clic sur
// l'image ou Échap ferment aussi). Renvoie la valeur du bouton choisi, null pour une fermeture.
// content : contenu riche à la place du texte ; clickClose : false pour une décision (un clic
// distrait sur l'image ne doit pas valoir réponse) ; ship : le navire de la partie (sceneShipOf),
// dessiné à son échelle à la place d'un modèle de remplacement.
export function showScene(app, kind, { title, text = '', content = null, color = '#c0392b', variant = null, force = null, ship = null, buttons = [], clickClose = true } = {}) {
  const S = SCENES[kind];
  if (!S) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Certaines scènes (records, méfaits) sont dessinées en plus haute résolution et lissées ; crisp : plus
    // haute résolution sans lissage (le bureau en pixel art).
    const res = S.res || 1, smooth = res > 1 && !S.crisp;
    const canvas = h('canvas.scene-canvas', { class: smooth ? 'smooth' : '', width: W * res, height: H * res, 'aria-hidden': 'true' });
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = smooth;
    let done = false;
    const close = (v) => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape' && wrap.isConnected) { e.preventDefault(); e.stopPropagation(); close(null); } };
    if (clickClose) canvas.addEventListener('click', () => close(null));
    else canvas.style.cursor = 'default';
    const wrap = h('div.dialog-wrap.scene-wrap', { onclick: (e) => { if (e.target === wrap) close(null); } }, [
      h('div.dialog.wide.scene-dialog', { class: S.mood }, [
        h('button.dialog-close', { title: 'Fermer', 'aria-label': 'Fermer', onclick: () => close(null) }, '✕'),
        h('h2', title || S.title),
        h('div.scene', [canvas, content ? h('div.scene-text', content) : text ? h('p.scene-text', text) : null]),
        buttons.length ? h('div.dialog-buttons', buttons.map((b) => h('button.btn', { class: b.kind || '', onclick: () => close(b.value) }, b.label))) : null,
      ]),
    ]);
    document.getElementById('dialogs').append(wrap);
    document.addEventListener('keydown', onKey, true);
    const t0 = performance.now();
    const frame = (now) => {
      if (!wrap.isConnected) { close(null); return; } // retirée autrement (bouton retour Android)
      let t = (now - t0) / 1000;
      if (S.loop && t > S.loop[1]) t = S.loop[0] + ((t - S.loop[0]) % (S.loop[1] - S.loop[0]));
      g.setTransform(res, 0, 0, res, 0, 0);
      g.globalAlpha = 1;
      S.draw(g, t, { color, variant, force, ship });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    app.audio?.playScene?.(kind);
  });
}

// Préférence : illustrations des événements (oui par défaut).
export const scenesOn = () => readFlag(KEYS.scenes, true);
export const setScenesOn = (on) => writeFlag(KEYS.scenes, on);
