// Contexte d'exécution partagé (non sauvegardé) : calcul de routes et caches.
import { Router, pointAlong } from './routing.js';
import { DISTANCES } from '../data/distances.js';
import { SHIP_TYPES } from '../data/ships.js';

// Limites réelles de tirant d'eau des canaux (m).
export const CANAL_DRAFT = { suez: 20.1, panama: 15.2 };
export const CANAL_NAMES = { suez: 'canal de Suez', panama: 'canal de Panama' };
const CANAL_POINT = { suez: [32.4, 30.5], panama: [-79.7, 9.1] };

export function makeContext() {
  const router = new Router();
  const shipRoutes = new Map();
  const ctx = {
    router,
    // Canaux fermés pour un navire donné (événement en cours ou tirant d'eau trop fort).
    closedCanals(state, draft) {
      const closed = [];
      for (const c of Object.keys(CANAL_DRAFT)) {
        const ev = state.canals?.[c];
        if (ev?.closed) { closed.push(c); continue; }
        const limit = ev?.draftLimit ?? CANAL_DRAFT[c];
        if (draft > limit) closed.push(c);
      }
      return closed;
    },
    distanceInfo(from, to, closed = []) {
      if (!closed.length) {
        const d = DISTANCES[from]?.[to];
        return d ? { nm: d[0], canals: d[1] } : null;
      }
      const r = router.route(from, to, closed);
      return r ? { nm: r.nm, canals: r.canals } : null;
    },
    route(from, to, closed = []) {
      const r = router.route(from, to, closed);
      if (r && !r.canalAt) {
        r.canalAt = {};
        for (const c of r.canals) r.canalAt[c] = nmNear(r, CANAL_POINT[c]);
      }
      return r;
    },
    shipRoute(ship) {
      const v = ship.voyage;
      if (!v) return null;
      const key = `${v.from}>${v.to}|${v.closed.join(',')}`;
      let cached = shipRoutes.get(ship.id);
      if (!cached || cached.key !== key) {
        cached = { key, route: ctx.route(v.from, v.to, v.closed) };
        shipRoutes.set(ship.id, cached);
      }
      return cached.route;
    },
    shipPosition(ship) {
      const r = ctx.shipRoute(ship);
      return r ? pointAlong(r, ship.voyage.progress) : null;
    },
    forget(shipId) { shipRoutes.delete(shipId); },
    typeOf(ship) { return SHIP_TYPES[ship.type]; },
  };
  return ctx;
}

// Distance parcourue le long de la route jusqu'au point le plus proche du canal.
function nmNear(route, [lon, lat]) {
  let best = 0, bestD = Infinity;
  route.points.forEach((p, i) => {
    const dx = ((p[0] - lon + 540) % 360) - 180, dy = p[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = route.cum[i]; }
  });
  return Math.max(0, best - 30);
}
