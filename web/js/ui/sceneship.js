// Le vrai navire dans les scènes : chaque modèle est dessiné par pixelship.js en gros pixels
// (style « chunky », choix du propriétaire), sur la trame de la scène, à l'échelle de sa
// longueur : un caboteur reste petit, un capesize remplit l'image, un géant en déborde.
// Le navire est posé par son étrave, à la flottaison ; une pente décale les colonnes de
// pixels au lieu de faire tourner l'image (une rotation brouille le pixel art).
import { shipLayer } from './pixelship.js';
import { SHIP_ART } from './shipshapes.js';
import { wearOf } from './shipart.js';

export const PX_PER_M = 0.55; // pixels de scène par mètre de navire
// Modèle de remplacement quand la scène ne connaît pas le navire (générique, monde, aperçus).
const STAND_IN = { box: 'feeder', tank: 'petrolier_mr', bulk: 'vraquier_handy' };

// Ce qu'une scène doit savoir d'un navire de la partie : modèle, nom, usure, cargaison, compagnie.
export function sceneShipOf(state, ship) {
  if (!ship) return null;
  const c = state.companies[ship.owner] || {};
  const age = Math.max(0, (state.t - (ship.builtT ?? state.t)) / (24 * 365));
  const condition = ship.condition ?? 100;
  return { type: ship.type, name: ship.name, wear: wearOf(ship.type, condition, age), dmg: (100 - condition) / 100, laden: !!ship.cargo, color: c.color, logo: c.logo, seed: `${ship.id}${ship.name}` };
}

const keels = new WeakMap();
// Carène sous la flottaison, pour un navire sur sa cale : antifouling rouge, effilé aux bouts.
function keeled(lay, S, depth) {
  const k = keels.get(lay);
  if (k) return k;
  const src = lay.canvas, w = src.width, h = src.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h + depth + 1;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const wl = S.WL - lay.y0, x0 = S.sternX - lay.x0, x1 = S.bowX - lay.x0, span = Math.max(1, x1 - x0);
  for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
    let yb = -1;
    for (let y = h - 1; y >= 0; y--) if (data[(y * w + x) * 4 + 3]) { yb = y; break; }
    if (yb < wl - 3) continue;
    const f = Math.min(1, (x - x0) / (span * 0.07), (x1 - x) / (span * 0.1));
    const d = Math.round(depth * Math.sqrt(Math.max(0, f)));
    for (let y = yb + 1; y <= yb + d; y++) { g.fillStyle = y === yb + 1 ? '#a8392c' : y === yb + d ? '#5e1f19' : '#8e2f25'; g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#121b21'; g.fillRect(x, yb + d + 1, 1, 1);
  }
  keels.set(lay, cv);
  return cv;
}

/**
 * Le navire d'une scène. o : options de la scène (o.ship, o.color, o.variant = silhouette) ;
 * kind : silhouette de secours ('box', 'tank', 'bulk') ;
 * opts : far (échelle d'un navire au loin), type, color, laden, wear, ship (à la place de o.ship).
 * Repères (en pixels de scène, relatifs à l'étrave à la flottaison ; y < 0 vers le haut) :
 * len, x(fr) et deck(fr) (fr : 0 poupe, 1 avant), fr(ux), rim(fr) (liston), top, funnel, bridge.
 */
export function sceneShip(o, kind = 'box', opts = {}) {
  const s = opts.ship !== undefined ? opts.ship : o.ship || null;
  const k = STAND_IN[o.variant] ? o.variant : kind;
  const type = opts.type || s?.type || STAND_IN[k] || STAND_IN.box;
  const A = SHIP_ART[type] || SHIP_ART.caboteur;
  const far = opts.far || 1;
  const lay = shipLayer(type, {
    style: 'chunky', len: Math.max(14, Math.round(A.L * PX_PER_M * far)),
    color: opts.color || o.color || s?.color || '#c0392b', logo: s?.logo, name: far < 1 ? '' : s?.name || '',
    wear: opts.wear ?? s?.wear ?? 0, dmg: opts.dmg ?? s?.dmg ?? 0, laden: opts.laden ?? !!s?.laden, seed: s?.seed ?? type,
  });
  const S = lay.S, bx = S.bowX, wl = S.WL;
  const depth = Math.max(2, Math.round(A.Tb * 1.1 * PX_PER_M * far));
  const br = S.bridge;
  const ship = {
    type, len: bx - S.sternX, depth,
    x: (fr) => S.X(fr * S.L) - bx,
    fr: (ux) => (bx + ux - S.X(0)) / Math.max(1e-6, S.X(S.L) - S.X(0)), // fraction de la longueur à l'abscisse ux
    deck: (fr) => S.deckAt(fr) - wl,
    rim: (fr) => S.rimAt(fr) - wl,
    top: lay.y0 - wl,
    funnel: S.funnelTop ? [S.funnelTop[0] - bx, S.funnelTop[1] - wl] : null,
    bridge: br ? { x1: br.x1 - bx, x2: br.x2 - bx, top: br.top - wl, base: br.base - wl } : null,
    dark: S.smokeDark,
    // Point du navire (ux, uy relatifs à l'étrave) une fois posé en (x, y) avec sa pente.
    at(x, y, ux, uy, { slope = 0, flip = false } = {}) { return [x + (flip ? -ux : ux), y + uy + Math.tan(slope) * ux]; },
    // Pose le navire : étrave et flottaison en (x, y) ; slope (radians, < 0 : étrave levée) ;
    // flip : cap à gauche ; keel : carène visible (sur cale, hors de l'eau).
    draw(g, x, y, { slope = 0, flip = false, keel = false } = {}) {
      const img = keel ? keeled(lay, S, depth) : lay.canvas;
      const X0 = Math.round(x), Y0 = Math.round(y), ox = lay.x0 - bx, oy = lay.y0 - wl, tn = Math.tan(slope);
      if (!tn) {
        if (!flip) { g.drawImage(img, X0 + ox, Y0 + oy); return; }
        g.save(); g.translate(X0, Y0); g.scale(-1, 1); g.drawImage(img, ox, oy); g.restore();
        return;
      }
      for (let c = 0; c < img.width; c++) {
        const ux = c + ox, dy = Math.round(tn * ux);
        g.drawImage(img, c, 0, 1, img.height, flip ? X0 - ux - 1 : X0 + ux, Y0 + oy + dy, 1, img.height);
      }
    },
  };
  return ship;
}
