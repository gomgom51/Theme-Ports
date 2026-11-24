// Scènes d'événements : petites animations en pixel art, dessinées dans le code, montrées
// dans une fenêtre qui arrête le temps (naufrage, pirates, douane, garde-côtes, colis livré,
// détention, marée noire, et les événements mondiaux de scenes-world.js).
// Un son facultatif par scène : sons/scene-<nom>.mp3.
import { h } from './dom.js';
import { W, H, hash, clamp01, ease, rgb, R, bands, sea, stars, vignette, cone, person, crate, drawShip, skiff, wake, patrolBoat, heli, seal, padlock, quay, gulls, DAY, NIGHT, STORM, line, rain, board, box, cloud, disc, smoke } from './pixel.js';
import { WORLD_SCENES } from './scenes-world.js';
import { SHIP_TYPES } from '../data/ships.js';

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
// Traînées de rouille d'un vieux navire (mêmes coordonnées que drawShip, échelle 1).
function rustStreaks(g, x, y) {
  for (let i = 0; i < 9; i++) { const rx = x - 22 + (hash(i, 31) % 44), ry = y - 6 + (hash(i, 32) % 2); R(g, rx, ry, 1, 2 + (hash(i, 33) % 3), i % 3 ? '#7a4a2a' : '#94603a'); }
}

const PI = Math.PI;

export const SCENES = {
  // Naufrage : tempête de nuit, le navire s'incline et sombre, l'hélicoptère hélitreuille l'équipage.
  sunk: {
    title: 'Naufrage !', mood: 'bad', loop: [5.6, 7.6],
    draw(g, t, o) {
      const flash = t > 0.8 && (t % 3.7) < 0.12;
      g.drawImage(bands('sky-storm', flash ? ['#4a5d86', '#5b6f99', '#6c80aa'] : ['#05080f', '#0b1222', '#121c33', '#1a2945'], 58), 0, 0);
      if (flash) { g.strokeStyle = '#fffbe6'; g.lineWidth = 1; g.beginPath(); g.moveTo(150, 0); g.lineTo(144, 18); g.lineTo(152, 22); g.lineTo(146, 44); g.stroke(); }
      sea(g, t, STORM, 58, 58, H, 2);
      const p = clamp01((t - 0.5) / 5);
      const sinkY = 24 * Math.pow(p, 1.7), ang = -0.42 * ease(p * 1.6); // s'incline vite, sombre lentement
      drawShip(g, o.color, 104, 76 + sinkY, ang);
      sea(g, t, STORM, 58, 77, H, 2); // l'eau recouvre ce qui a sombré
      if (p > 0.55) for (let i = 0; i < 6; i++) { const k = (t * 0.9 + i * 0.37) % 1; R(g, 98 + (hash(i, 9) % 14), 77 - k * 10, 1, 1, 'rgba(180,210,240,0.8)'); }
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
      const bob = Math.round(Math.sin(t * 2) * 0.8);
      drawShip(g, o.color, 126, 77 + bob);
      const p = ease(t / 2), sx = -24 + p * 106;
      skiff(g, sx, 80, 1, 3, t); skiff(g, sx - 14, 86, 1, 2, t);
      if (p < 1) { wake(g, sx, 82, 1, t); wake(g, sx - 14, 88, 1, t); }
      const deckY = 64 + bob, ladderX = 103;
      const lp = clamp01((t - 2) / 0.6);
      if (lp > 0) { const top = 79 - lp * (79 - deckY); R(g, ladderX, top, 1, 79 - top, '#8a6a3a'); R(g, ladderX + 3, top, 1, 79 - top, '#8a6a3a'); for (let y = top; y < 79; y += 3) R(g, ladderX, y, 4, 1, '#8a6a3a'); }
      for (let i = 0; i < 3; i++) {
        const c = clamp01((t - 2.5 - i * 0.45) / 0.9);
        if (c <= 0) continue;
        const y = 74 - c * (74 - (deckY - 7)), x = ladderX + (c >= 1 ? 4 + i * 6 + Math.min(10, (t - 3.4 - i * 0.45) * 8) : 0);
        person(g, x, y, i % 2 ? '#3a3a3a' : '#5a4a3a', { hat: i === 1 ? '#7a1f22' : null, step: Math.floor(t * 6) % 2 });
      }
      const fp = clamp01((t - 3.9) / 0.7);
      if (fp > 0) { const fy = Math.round(70 + bob - fp * 10); R(g, 147, fy - 6 + bob, 1, 8, '#6d747c'); R(g, 148, fy - 6, 6, 4, '#111'); R(g, 150, fy - 5, 2, 2, '#eee'); if (Math.floor(t * 4) % 2) R(g, 154, fy - 5, 1, 2, '#111'); }
      vignette(g, 'rgba(150,20,20,A)', 0.25 + 0.15 * clamp01((t - 3.5) / 1) * (0.7 + 0.3 * Math.sin(t * 4)));
    },
  },
  // Attaque repoussée : lances à eau, échelles qui tombent, skiffs qui s'enfuient.
  repelled: {
    title: 'Attaque repoussée', mood: 'good', loop: [5, 7],
    draw(g, t, o) {
      g.drawImage(bands('sky-day', ['#9fd0e8', '#b3dbee', '#cbe6f2', '#e2f0f5'], 58), 0, 0);
      sea(g, t, DAY, 58);
      const bob = Math.round(Math.sin(t * 2) * 0.8);
      drawShip(g, o.color, 126, 77 + bob);
      for (let x = 102; x < 150; x += 2) R(g, x, 61 + bob + (x % 4 ? 0 : -1), 1, 1, '#9aa1a8'); // barbelés
      const flee = clamp01((t - 3.3) / 2);
      const p = ease(t / 2), sx = flee > 0 ? 82 - ease(flee) * 130 : -24 + p * 106;
      const dir = flee > 0 ? -1 : 1;
      skiff(g, sx, 80, dir, 3, t); skiff(g, sx - 14 * dir, 86, dir, 2, t);
      if (p < 1 || flee > 0) { wake(g, sx + (dir < 0 ? 16 : 0), 82, dir, t, flee > 0 ? 20 : 14); }
      const lp = clamp01((t - 2) / 0.4), fall = clamp01((t - 2.9) / 0.4);
      if (lp > 0 && fall < 1) {
        g.save(); g.translate(104, 79); g.rotate(-fall * 1.2);
        const len = lp * 15; R(g, 0, -len, 1, len, '#8a6a3a'); R(g, 3, -len, 1, len, '#8a6a3a');
        for (let y = -len; y < 0; y += 3) R(g, 0, y, 4, 1, '#8a6a3a');
        g.restore();
      }
      if (t > 2.2 && t < 3.6) {
        for (let i = 0; i < 26; i++) { // jets des lances à incendie
          const k = ((t * 2.2 + i / 26) % 1), x = 118 - k * 16, y = 62 + bob - Math.sin(k * Math.PI) * 9 + k * 16;
          R(g, x, y, 1 + (i % 2), 1, i % 3 ? '#e8f6ff' : '#9fd3f2');
        }
        person(g, 118, 56 + bob, '#ff8c1a', { hat: '#ffffff' });
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
      drawShip(g, o.color, 126, 77);
      const step = Math.floor(t * 6) % 2;
      // Un marin court se réfugier dans la passerelle ; le cadenas s'allume.
      const run = clamp01((t - 0.4) / 1.1);
      if (run < 1) person(g, 138 - run * 26, 61, '#ff8c1a', { hat: '#ffffff', step });
      if (t > 1.5) { if (Math.floor(t * 2) % 2) padlock(g, 104, 45); R(g, 105, 54, 4, 1, '#ffd34d'); }
      // Le skiff arrive le long de la coque.
      const p = ease(t / 2.2), sx = -24 + p * 132;
      const onBoard = (i) => clamp01((t - 2.6 - i * 0.6) / 0.9); // 0 : dans le skiff, 1 : sur le pont
      const left = 3 - (onBoard(0) > 0 ? 1 : 0) - (onBoard(1) > 0 ? 1 : 0);
      skiff(g, sx, 80, 1, left, t);
      if (p < 1) wake(g, sx, 82, 1, t);
      // L'échelle se dresse contre la coque.
      const ladderX = 122, top = 79 - clamp01((t - 2.2) / 0.5) * 13;
      if (t > 2.2) { R(g, ladderX, top, 1, 79 - top, '#8a6a3a'); R(g, ladderX + 3, top, 1, 79 - top, '#8a6a3a'); for (let y = top; y < 79; y += 3) R(g, ladderX, y, 4, 1, '#8a6a3a'); }
      // Deux pirates grimpent, puis gagnent les conteneurs (le chef à la proue, le porteur à 136).
      const T0 = 4.6;
      for (let i = 0; i < 2 && t < T0; i++) {
        const c = onBoard(i);
        if (c <= 0) continue;
        const walk = clamp01((t - 3.5 - i * 0.6) / (0.8 - i * 0.3));
        const x = c < 1 ? ladderX : ladderX + walk * (20 - i * 6), y = c < 1 ? 73 - c * 12 : 61;
        person(g, x, y, i ? '#3a3a3a' : '#5a4a3a', { hat: i ? null : '#7a1f22', step });
      }
      // Pillage : une caisse toutes les 1,6 s, descendue à la corde dans le skiff.
      if (t >= T0) {
        const n = Math.floor((t - T0) / 1.6), k = ((t - T0) % 1.6) / 1.6;
        if (n > 0 || k > 0.75) crate(g, 114, 74); // déjà dans le skiff
        if (k < 0.4) { // le pirate apporte la caisse jusqu'au bord
          const x = 136 - (k / 0.4) * 14;
          crate(g, x - 2, 55); person(g, x, 61, '#3a3a3a', { step });
        } else {
          const d = (k - 0.4) / 0.35, y = 55 + clamp01(d) * 13, x = 120 - clamp01(d) * 6;
          if (d <= 1) { R(g, x + 3, 56, 1, Math.max(1, y - 56), '#d8cfb8'); crate(g, x, y); } // la corde
          else if (k < 0.9) crate(g, 114, 68); // posée sur la pile
          person(g, 122, 61, '#3a3a3a');
        }
        person(g, 142, 61, '#5a4a3a', { hat: '#7a1f22' }); // le chef fait le guet à la proue
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
      drawShip(g, o.color, 22, 81);
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
      drawShip(g, o.color, 88, 77);
      const p = ease(t / 1.8), px = 210 - p * 72;
      if (t > 1.2) cone(g, px + 9, 74, 64, 60, 72, 76, '#fffbe0', 0.22);
      patrolBoat(g, px, 80, t);
      if (p < 1) wake(g, px + 30, 82, -1, t);
      if (t > 2) { person(g, 70, 57, '#24324a', { hat: '#1a2436' }); crate(g, 76, 58, clamp01((t - 2.4) / 0.4)); }
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
      drawShip(g, o.color, 22, 81);
      quay(g, 84);
      for (let i = 0; i < 7; i++) R(g, 40 + i * 2, 72 + i * 2, 3, 1, '#8a6a3a'); // passerelle
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
      g.drawImage(bands('sky-dusk2', ['#1d2340', '#3a2f55', '#6b3f5e', '#a35a5a', '#cf8a5a'], 50), 0, 0);
      stars(g, t, 14, 22);
      sea(g, t, { cols: ['#3a3552', '#2f2c47', '#26243c', '#1d1c31'], crest: '#8a7aa3' }, 50, 50, 84);
      drawShip(g, o.color, 22, 81);
      quay(g, 84);
      for (let i = 0; i < 7; i++) R(g, 40 + i * 2, 72 + i * 2, 3, 1, '#8a6a3a'); // passerelle
      R(g, 118, 58, 1, 26, '#3c434c'); R(g, 116, 55, 5, 4, '#ffcf6b');
      cone(g, 118, 58, 92, 100, 144, 100, '#ffcf6b', 0.17 + 0.04 * Math.sin(t * 9));
      crate(g, 156, 94); crate(g, 165, 94); crate(g, 160, 87); // caisses : de quoi se cacher
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
      drawShip(g, o.color, 70, 81);
      quay(g, 84);
      R(g, 102, 84, 5, 4, '#3c434c'); // bitte d'amarrage
      for (let i = 0; i < 6; i++) R(g, 96 - i * 4, 82 - i, 3, 2, i % 2 ? '#8d939a' : '#b9bfc5'); // chaîne
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
      drawShip(g, o.color, 168, 62, 0.18, 0.6);
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
      const sx = 100, sy = surf(sx), a = Math.atan((surf(sx + 3) - surf(sx - 3)) / 6);
      // Conteneurs arrachés (au début seulement, la boucle reste calme).
      if (o.variant === 'boxes' && t < 2) for (let i = 0; i < 3; i++) {
        const k = clamp01((t - 0.6 - i * 0.2) / 1.1);
        if (k <= 0 || k >= 1) continue;
        const x = sx - 6 + i * 7 - k * (14 + i * 6), y = sy - 10 - Math.sin(k * PI) * 8 + k * k * 22;
        g.save(); g.translate(x, y); g.rotate(k * (2 + i)); R(g, -2, -2, 5, 4, ['#c0392b', '#d4ac0d', '#2e86c1'][i]); g.restore();
      }
      drawShip(g, o.color, sx, sy + 3, a);
      water(66, 136, 4); // la vague devant recouvre le bas de la coque
      // Cargaison avariée : un paquet de mer déferle sur le pont (au début seulement).
      if (o.variant === 'cargo' && t > 0.7 && t < 2) {
        const k = (t - 0.7) / 1.3;
        for (let i = 0; i < 40; i++) { const u = (hash(i, 41) % 100) / 100, v = (hash(i, 42) % 100) / 100; R(g, sx - 22 + u * 44, sy - 6 - Math.sin(k * PI) * (6 + v * 10) + k * 4, 1 + (i % 2), 1, i % 3 ? '#e8f0f8' : '#a9c4e0'); }
      }
      // Paquets de mer sur l'étrave quand elle plonge.
      const dip = clamp01(a * 5);
      if (dip > 0) {
        const bx = sx + 24 * Math.cos(a), by = sy + 24 * Math.sin(a) - 4;
        for (let i = 0; i < 16; i++) { const k = (t * 2 + i / 16) % 1, v = 0.5 + (hash(i, 7) % 50) / 100; R(g, bx + (hash(i, 8) % 2 ? 1 : -1) * k * 10 * v, by - Math.sin(k * PI) * 14 * dip * v, 1, 1, '#e8f0f8'); }
      }
      rain(g, t, Math.round(50 + 60 * f), 'rgba(160,190,230,0.5)', 150 + 20 * f, 40 + 30 * f);
      vignette(g, 'rgba(0,0,0,A)', 0.5);
    },
  },
  // Le banquier : rouge de colère, il tape du poing ; le compte plonge au tableau.
  // Variante « seize » : il abat son tampon sur le dossier du navire saisi.
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
      const kind = o.variant || 'box';
      g.drawImage(bands('sky-buy', ['#78b3d6', '#8fc1de', '#a8d0e6', '#c4e1ef'], 50), 0, 0);
      for (let i = 0; i < 3; i++) cloud(g, ((t * 3 + i * 74) % (W + 50)) - 40, 8 + (i % 2) * 8, 22 + i * 4);
      sea(g, t, DAY, 44, 44, 84);
      gulls(g, t % 4, 2, [196, 30]);
      const sx = 64, wy = 82, paint = clamp01((t - 2.4) / 2.2);
      drawShip(g, '#8a8f96', sx, wy, 0, 2, kind, '#5d4a3a'); // l'ancienne livrée, grise et rouillée
      g.save(); g.translate(sx, wy); g.scale(2, 2); rustStreaks(g, 0, 0); g.restore();
      if (paint > 0) { // repeint aux couleurs de la compagnie, de la poupe à la proue
        g.save(); g.beginPath(); g.rect(sx - 52, 0, Math.round(104 * paint), H); g.clip();
        drawShip(g, o.color, sx, wy, 0, 2, kind);
        g.restore();
      }
      if (paint >= 1) for (let i = 0; i < 3; i++) { const k = ((t - 4.6) * 0.5 + i / 3) % 1; R(g, sx - 48 + k * 96, 72, 3, 1, 'rgba(255,255,255,0.8)'); } // peinture fraîche qui brille
      quay(g, 84);
      R(g, 166, 84, 6, 4, '#3c434c'); // bitte d'amarrage
      g.save(); g.scale(2, 2);
      const hx = sx / 2, hy = wy / 2;
      // À la poupe, l'ancien pavillon descend, puis le vôtre est hissé.
      if (t < 4.2) companyFlag(g, hx - 26, hy - 24, '#8a8f96', t, 1 - clamp01((t - 3.4) / 0.8), 16);
      else companyFlag(g, hx - 26, hy - 24, o.color, t, clamp01((t - 4.4) / 0.8), 16);
      for (let i = 0; i < 6; i++) R(g, hx + 18 + i, hy - 5 + i, 2, 1, '#8a6a3a'); // passerelle
      if (paint > 0 && paint < 1) { // le peintre sur sa nacelle
        const px = Math.round(hx - 26 + 52 * paint);
        R(g, px, hy - 12, 1, 4, '#d8d8d8'); R(g, px - 3, hy, 7, 1, '#8a6a3a');
        person(g, px - 1, hy - 7, '#f2c230', { hat: '#ffffff' });
        R(g, px + 2, hy - 5 + Math.round(Math.sin(t * 14)), 1, 2, o.color); // rouleau
      }
      const papers = (x, y) => { R(g, x, y, 3, 4, '#f4f1e6'); R(g, x, y + 1, 3, 1, '#b9b3a2'); R(g, x + 1, y + 3, 1, 1, '#c0392b'); };
      const cash = (x, y) => { R(g, x, y, 4, 2, '#3f8f4f'); R(g, x + 1, y, 1, 2, '#e8f5d0'); };
      const cx0 = 58;
      person(g, cx0, 43, '#1d2f55', { hat: '#f4f4f4' }); // votre capitaine, au pied de la passerelle
      const inB = ease(t / 1.6), bx = 100 - inB * 36; // le courtier arrive avec les papiers
      person(g, bx, 43, '#5a5f66', { hat: '#2b2b30', step: inB < 1 ? Math.floor(t * 5) % 2 : 0 });
      R(g, bx + 3, 46, 2, 2, '#6b4320'); // sa serviette
      const x = clamp01((t - 1.7) / 0.7); // échange : le chèque passe à droite, les papiers à gauche
      if (t < 1.7) { papers(bx - 2, 45); cash(cx0 + 2, 45); }
      else if (x < 1) { papers(bx - 2 - x * 6, 45 - Math.sin(x * PI) * 2); cash(cx0 + 2 + x * 3, 45 - Math.sin(x * PI) * 2); }
      else {
        papers(cx0 - 1, 44 - (t > 4.4 ? Math.round(Math.abs(Math.sin(t * 5))) : 0)); // brandis quand le pavillon monte
        if (t < 3.2) R(g, cx0 + 3, 46 + Math.round(Math.sin(t * 16)) * 0.5, 3, 1, '#e8b98f'); // poignée de main
        cash(bx + 3, 44);
      }
      g.restore();
    },
  },
  // Navire neuf : la marraine lâche la bouteille, qui se brise sur l'étrave ; le navire glisse
  // sur la cale de lancement, la sirène retentit et le feu d'artifice éclate.
  newbuild: {
    title: 'Baptême d\'un navire neuf', mood: 'good', loop: [4.4, 6.4],
    draw(g, t, o) {
      const kind = o.variant || 'box';
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
      // Cale de lancement et terre-plein.
      const rampY = (x) => 96 - (x - 40) * 0.185;
      g.fillStyle = '#6d6a72'; g.beginPath(); g.moveTo(40, 96); g.lineTo(170, rampY(170)); g.lineTo(W, 72); g.lineTo(W, H); g.lineTo(40, H); g.closePath(); g.fill();
      line(g, 40, 96, 170, rampY(170), '#9b97a0'); R(g, 170, 72, 30, 1, '#9b97a0');
      for (let x = 46; x < 168; x += 9) R(g, x, Math.round(rampY(x)) + 1, 4, 1, '#55525a'); // traverses
      // Le navire : immobile, puis il glisse et prend la mer.
      const th = -0.183, cs = Math.cos(th);
      let cx = 132, cy = rampY(132) - 3, ang = th;
      if (t > 1.8) {
        const p = Math.min(1, (t - 1.8) / 1.2), d = 40 * p * p;
        cx = 132 - d * cs; cy = rampY(cx) - 3;
        if (t > 3) { // à flot : il file sur son erre, se redresse et se balance
          const tau = t - 3;
          cx = 92.7 - 40 * (1 - Math.exp(-1.6 * tau));
          cy = 83.2 + 2.8 * (1 - Math.exp(-3 * tau)) + Math.sin(t * 3) * 0.4;
          ang = th * Math.exp(-3 * tau) * Math.cos(5 * tau) + Math.sin(t * 2.4) * 0.02;
        }
      }
      if (t < 1.8) for (let i = 0; i < 4; i++) { const bx = 112 + i * 12; R(g, bx, rampY(bx) - 3, 3, 3, '#8a6a3a'); } // ber de lancement
      drawShip(g, o.color, cx, cy, ang, 1, kind);
      g.save(); g.globalAlpha = 0.8; g.beginPath(); g.rect(0, 86, 104, H); g.clip(); sea(g, t, pal, 58, 86, H); g.restore(); // l'eau recouvre la carène
      // Gerbe d'eau quand la poupe touche l'eau.
      if (t > 2.5 && t < 4.2) for (let i = 0; i < 18; i++) {
        const k = (t - 2.5 - (hash(i, 44) % 10) / 40) / 1.2; if (k < 0 || k > 1) continue;
        const vx = ((hash(i, 45) % 20) - 14) * 1.3, vy = 14 + hash(i, 46) % 16;
        R(g, 82 + vx * k, 85 - vy * k + 22 * k * k, 1, 1 + (i % 2), i % 3 ? '#e8f1f8' : '#b7d3e6');
      }
      // Sirène : bouffées de vapeur à la cheminée.
      if (t > 3.1) {
        const fx = cx + Math.cos(ang) * -17 - Math.sin(ang) * -17, fy = cy + Math.sin(ang) * -17 + Math.cos(ang) * -17;
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
      const len = broken ? 10 : L, bx = pv[0] + Math.sin(phi) * len, by = pv[1] + Math.cos(phi) * len;
      line(g, pv[0], pv[1], bx, by, '#e8e0c8');
      if (broken) R(g, bx - 1, by, 2, 2, '#2f7d4a');
      else { R(g, bx - 1, by, 3, 5, '#2f7d4a'); R(g, bx, by - 1, 1, 2, '#e3b33b'); R(g, bx - 1, by + 2, 3, 1, '#f4f1e6'); }
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
      const sx = 100 + 120 * (1 - ease(t / 2.4)), sy = 76 + Math.round(Math.sin(t * 2) * 0.6);
      // Sillage derrière la poupe (le navire file vers la gauche) et moustache d'étrave.
      for (let i = 0; i < 14; i++) { const k = ((t * 1.5 + i / 14) % 1); R(g, sx + 50 + k * 50, sy + 1 + Math.round(Math.sin(i * 2.1) * 2 * k), 3 + k * 4, 1, 'rgba(235,245,250,' + (0.8 * (1 - k)).toFixed(2) + ')'); }
      R(g, sx - 56, sy - 1, 5, 2, '#e8f1f8');
      drawShip(g, o.color, sx, sy, 0, [-2, 2], kind, isNew ? undefined : '#5d4a3a');
      if (!isNew) for (let i = 0; i < 8; i++) R(g, sx - 44 + (hash(i, 51) % 84), sy - 10, 1, 3 + hash(i, 53) % 4, '#7a4a2a'); // rouille
      companyFlag(g, sx + 51, sy - 30, o.color, t, 1, 22); // son pavillon, à la poupe
      smoke(g, sx + 35, sy - 35, t, { n: 8, color: isNew ? '#d8dde2' : '#4a4a4a', alpha: 0.6, rise: 6, drift: 6, size: 3 });
      if (isNew) {
        for (let i = 0; i < 3; i++) { const k = ((t * 0.7 + i / 3) % 1); R(g, sx - 44 + k * 88, sy - 10, 3, 1, 'rgba(255,255,255,0.9)'); } // coque neuve qui brille
        // Remorqueur d'escorte et ses jets d'eau en arc.
        const tx = sx - 10, ty = sy + 14;
        R(g, tx - 11, ty - 3, 24, 4, '#b8332c'); R(g, tx - 9, ty + 1, 20, 1, '#1d1d1d'); R(g, tx - 3, ty - 8, 8, 5, '#f4f4f4'); R(g, tx - 1, ty - 7, 4, 1, '#24323c'); R(g, tx, ty - 12, 2, 4, '#e3b33b');
        for (let j = 0; j < 2; j++) for (let i = 0; i < 16; i++) {
          const k = ((t * 1.2 + i / 16) % 1), dir = j ? 1 : -1;
          R(g, tx + 1 + dir * k * 30, ty - 12 - Math.sin(k * PI) * 22, 2, 2, 'rgba(235,246,252,' + (1 - 0.4 * k).toFixed(2) + ')');
        }
      }
      gulls(g, (t % 3) * 0.8, 2, [sx + 20, 34], -1);
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
  // étoiles du niveau s'allument, confettis. variant : { from, to (images du bureau), level }.
  office: {
    title: 'Un nouveau bureau !', mood: 'good', loop: [3.8, 5.8],
    draw(g, t, o) {
      const v = o.variant || {};
      R(g, 0, 0, W, H, '#1b1f27');
      const paint = (img) => { if (img?.complete && img.naturalWidth) { g.imageSmoothingEnabled = true; g.drawImage(img, -34, 0, 268, 112); g.imageSmoothingEnabled = false; } };
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
  ...WORLD_SCENES,
};

// Montre une scène dans une fenêtre, avec une croix de fermeture en haut à droite (clic sur
// l'image ou Échap ferment aussi). Renvoie la valeur du bouton choisi, null pour une fermeture.
// content : contenu riche à la place du texte ; clickClose : false pour une décision (un clic
// distrait sur l'image ne doit pas valoir réponse).
export function showScene(app, kind, { title, text = '', content = null, color = '#c0392b', variant = null, force = null, buttons = [], clickClose = true } = {}) {
  const S = SCENES[kind];
  if (!S) return Promise.resolve(null);
  return new Promise((resolve) => {
    const canvas = h('canvas.scene-canvas', { width: W, height: H, 'aria-hidden': 'true' });
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
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
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      S.draw(g, t, { color, variant, force });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    app.audio?.playScene?.(kind);
  });
}

// Préférence : illustrations des événements (oui par défaut).
const KEY = 'pda-scenes';
export function scenesOn() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function setScenesOn(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* stockage indisponible */ } }
