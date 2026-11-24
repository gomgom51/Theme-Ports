// Contexte d'exécution partagé (non sauvegardé) : calcul de routes et caches.
import { Router, pointAlong } from './routing.js';
import { DISTANCES, DISTANCES_CLOSED } from '../data/distances.js';
import { SHIP_TYPES } from '../data/ships.js';
import { nsrUsable } from './ice.js';

// Limites réelles de tirant d'eau des canaux (m).
export const CANAL_DRAFT = { suez: 20.1, panama: 15.2, nsr: 14 };
export const CANAL_NAMES = { suez: 'canal de Suez', panama: 'canal de Panama', nsr: 'passage du Nord-Est' };
const CANAL_POINT = { suez: [32.4, 30.5], panama: [-79.7, 9.1], nsr: [104, 77.7] };

export function makeContext() {
  const router = new Router();
  const shipRoutes = new Map();
  const ctx = {
    router,
    // Canaux fermés pour un navire donné (événement en cours ou tirant d'eau trop fort), et
    // passage du Nord-Est s'il n'est pas sûr (glaces) pour ce navire (classe glace ou non).
    closedCanals(state, draft, ship = null) {
      const closed = [];
      for (const c of Object.keys(CANAL_DRAFT)) {
        if (c === 'nsr') { if (draft > CANAL_DRAFT.nsr || !nsrUsable(state, ship)) closed.push(c); continue; }
        const ev = state.canals?.[c];
        if (ev?.closed) { closed.push(c); continue; }
        const limit = ev?.draftLimit ?? CANAL_DRAFT[c];
        if (draft > limit) closed.push(c);
      }
      return closed;
    },
    distanceInfo(from, to, closed = []) {
      // Tables des passages fermés : seulement les trajets qui changent (le reste : tout ouvert).
      const diff = closed.length ? DISTANCES_CLOSED[[...closed].sort().join(',')] : null;
      if (closed.length && !diff) { const r = router.route(from, to, closed); return r ? { nm: r.nm, canals: r.canals } : null; }
      const d = diff?.[from] && to in diff[from] ? diff[from][to] : DISTANCES[from]?.[to];
      if (d == null) return null;
      return typeof d === 'number' ? { nm: d, canals: [] } : { nm: d[0], canals: d[1] };
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
