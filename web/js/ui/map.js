// Carte du monde : projection équirectangulaire, déplacement et zoom au doigt
// ou à la souris, monde répété horizontalement (traversée du Pacifique).
import { LAND_DETAILED, LAND_COARSE } from '../data/world.js';
import { PORTS, PORT_IDS } from '../data/ports.js';
import { pointAlong } from '../sim/routing.js';

const LAT_TOP = 78, LAT_BOTTOM = -60;

function buildPath(str) {
  const path = new Path2D();
  for (const ring of str.split(';')) {
    const v = ring.split(',');
    let x = 0, y = 0;
    for (let i = 0; i < v.length; i += 2) {
      x += +v[i]; y += +v[i + 1];
      const px = x / 100, py = -y / 100;
      if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
    }
    path.closePath();
  }
  return path;
}

const SHIP_SHAPE = (() => {
  const p = new Path2D();
  p.moveTo(0, -8); p.lineTo(4.2, -1.5); p.lineTo(3.6, 6); p.lineTo(-3.6, 6); p.lineTo(-4.2, -1.5); p.closePath();
  return p;
})();

export class MapView {
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.base = document.createElement('canvas');
    this.over = document.createElement('canvas');
    this.base.className = 'map-layer';
    this.over.className = 'map-layer';
    root.append(this.base, this.over);
    this.bctx = this.base.getContext('2d');
    this.octx = this.over.getContext('2d');
    this.paths = { detailed: buildPath(LAND_DETAILED), coarse: buildPath(LAND_COARSE) };
    this.view = { cx: 20, cy: -22, scale: 3 };
    this.dirty = true;
    this.pointers = new Map();
    this.preview = null;
    this.highlightPorts = null;
    this.attach();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  setGame(state, ctx, ui) { this.state = state; this.ctx = ctx; this.ui = ui; this.dirty = true; }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.base, this.over]) {
      c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
      c.style.width = this.w + 'px'; c.style.height = this.h + 'px';
    }
    this.minScale = Math.max(this.w / 360, this.h / (LAT_TOP - LAT_BOTTOM));
    this.setView(this.view.cx, this.view.cy, Math.max(this.view.scale, this.minScale));
  }

  setView(cx, cy, scale) {
    scale = Math.max(this.minScale || 1, Math.min(80, scale));
    const halfH = this.h / 2 / scale;
    const top = -LAT_TOP + halfH, bottom = -LAT_BOTTOM - halfH;
    cy = top > bottom ? (top + bottom) / 2 : Math.max(top, Math.min(bottom, cy));
    cx = ((cx + 540) % 360) - 180;
    this.view = { cx, cy, scale };
    this.dirty = true;
  }

  // Centre un point dans la partie visible de la carte (à gauche du panneau ouvert).
  centerOn(lon, lat, scale) {
    scale = Math.max(this.minScale || 1, Math.min(80, scale || Math.max(this.view.scale, 6)));
    const panel = document.getElementById('panel');
    const covered = panel && !panel.hidden ? panel.getBoundingClientRect().width : 0;
    const offset = covered < this.w * 0.9 ? covered / 2 : 0;
    this.setView(lon + offset / scale, -lat, scale);
  }
  fitWorld() { this.setView(15, -18, this.minScale); }

  // Coordonnées écran d'un point ; la copie du monde la plus proche du centre est choisie.
  toScreen(lon, lat) {
    const { cx, cy, scale } = this.view;
    let dx = lon - cx;
    dx = ((dx + 540) % 360) - 180;
    return [this.w / 2 + dx * scale, this.h / 2 + (-lat - cy) * scale];
  }
  toWorld(x, y) {
    const { cx, cy, scale } = this.view;
    return [cx + (x - this.w / 2) / scale, -(cy + (y - this.h / 2) / scale)];
  }

  // ---------- Interaction ----------
  attach() {
    const el = this.over;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      this.pinch = null;
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const r = el.getBoundingClientRect();
      if (this.pointers.size === 1) {
        const { cx, cy, scale } = this.view;
        this.setView(cx - (e.clientX - p.x) / scale, cy - (e.clientY - p.y) / scale, scale);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        if (before > 0) this.zoomAt(mx, my, after / before);
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (wasSingle && moved < 8 && performance.now() - p.t0 < 600) {
        const r = el.getBoundingClientRect();
        this.tap(e.clientX - r.left, e.clientY - r.top);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      const r = el.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, 2);
    });
  }

  zoomAt(x, y, factor) {
    const [lon, lat] = this.toWorld(x, y);
    const scale = Math.max(this.minScale, Math.min(80, this.view.scale * factor));
    const cx = lon - (x - this.w / 2) / scale;
    const cy = -lat - (y - this.h / 2) / scale;
    this.setView(cx, cy, scale);
  }

  tap(x, y) {
    let best = null, bestD = 18;
    for (const s of this.shipScreenPos || []) {
      const d = Math.hypot(s.x - x, s.y - y) - (s.own ? 4 : 0);
      if (d < bestD) { bestD = d; best = { kind: 'ship', id: s.id }; }
    }
    if (!best) {
      for (const id of PORT_IDS) {
        const [px, py] = this.toScreen(PORTS[id].lon, PORTS[id].lat);
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) { bestD = d; best = { kind: 'port', id }; }
      }
    }
    if (best?.kind === 'ship') this.handlers.onShip?.(best.id);
    else if (best?.kind === 'port') this.handlers.onPort?.(best.id);
    else this.handlers.onEmpty?.();
  }

  // ---------- Dessin ----------
  copies(fn) {
    const { cx, scale } = this.view;
    const span = this.w / scale / 2 + 5;
    for (let k = -2; k <= 2; k++) {
      const off = k * 360;
      if (off - 180 > cx + span || off + 180 < cx - span) continue;
      fn(off);
    }
  }

  drawBase() {
    const g = this.bctx, { cx, cy, scale } = this.view, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#0f3150');
    grad.addColorStop(1, '#0a2238');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);

    // Graticule tous les 30°.
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let lon = -540; lon <= 540; lon += 30) {
      const x = this.w / 2 + (lon - cx) * scale;
      if (x < -2 || x > this.w + 2) continue;
      g.moveTo(x, 0); g.lineTo(x, this.h);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = this.h / 2 + (-lat - cy) * scale;
      g.moveTo(0, y); g.lineTo(this.w, y);
    }
    g.stroke();
    // Équateur un peu plus marqué.
    g.strokeStyle = 'rgba(255,255,255,0.09)';
    g.beginPath();
    const ye = this.h / 2 - cy * scale;
    g.moveTo(0, ye); g.lineTo(this.w, ye); g.stroke();

    const path = scale >= 4.5 ? this.paths.detailed : this.paths.coarse;
    this.copies((off) => {
      g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (this.w / 2 + (off - cx) * scale), dpr * (this.h / 2 - cy * scale));
      g.fillStyle = '#2c3d36';
      g.fill(path);
      g.lineWidth = 1.1 / scale;
      g.strokeStyle = '#557565';
      g.stroke(path);
    });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ports.
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'middle';
    for (const id of PORT_IDS) {
      const P = PORTS[id];
      const [x, y] = this.toScreen(P.lon, P.lat);
      if (x < -60 || x > this.w + 60 || y < -20 || y > this.h + 20) continue;
      const r = 2 + P.size * 0.55 + Math.min(2, scale / 12);
      const hl = this.highlightPorts?.has(id);
      g.beginPath();
      g.arc(x, y, r + (hl ? 2 : 0), 0, Math.PI * 2);
      g.fillStyle = hl ? '#ffd166' : '#e9b949';
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#1b1406';
      g.stroke();
      if (scale > 3.2 || P.size >= 5 || hl) {
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(5,15,25,0.85)';
        g.strokeText(P.name, x + r + 4, y);
        g.fillStyle = hl ? '#ffe7a3' : '#e8eef5';
        g.fillText(P.name, x + r + 4, y);
      }
    }
    this.dirty = false;
  }

  drawOverlay(frac = 0) {
    const g = this.octx, dpr = this.dpr, state = this.state, ctx = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (!state) return;
    const { scale } = this.view;
    const ui = this.ui || {};
    const kmToPx = scale / 60; // 1 mille nautique ≈ 1/60 de degré

    // Tempêtes.
    for (const s of state.storms) {
      const [x, y] = this.toScreen(s.lon, s.lat);
      const r = Math.max(10, s.radius * kmToPx);
      if (x + r < 0 || x - r > this.w || y + r < 0 || y - r > this.h) continue;
      const hue = s.force >= 11 ? '239,83,80' : s.force >= 9 ? '255,152,0' : '255,213,79';
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${hue},0.42)`);
      rg.addColorStop(0.6, `rgba(${hue},0.18)`);
      rg.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      // Spirale stylisée.
      g.strokeStyle = `rgba(${hue},0.55)`;
      g.lineWidth = 1.5;
      const rot = (state.t / 6) % (Math.PI * 2) * (s.lat >= 0 ? -1 : 1);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x, y, r * 0.55, rot + (k * Math.PI * 2) / 3, rot + (k * Math.PI * 2) / 3 + 1.2);
        g.stroke();
      }
      this.badge(g, x, y, String(s.force), `rgb(${hue})`);
    }

    // Épaves.
    for (const w of state.wrecks || []) {
      const [x, y] = this.toScreen(w.lon, w.lat);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke();
    }

    // Route prévisualisée (onglet « Appareiller »).
    if (this.preview) this.polyline(g, this.preview.points, 0, 'rgba(242,181,68,0.95)', [7, 5], 2);

    // Routes des navires du joueur actif.
    const active = ui.activeCompany;
    for (const ship of state.ships) {
      if (ship.status !== 'sea') continue;
      const mine = ship.owner === active;
      const selected = ship.id === ui.selectedShip;
      if (!mine && !selected) continue;
      const route = ctx.shipRoute(ship);
      if (!route) continue;
      this.polyline(g, route.points, ship.voyage.progress, selected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)', selected ? [6, 4] : [3, 5], selected ? 2 : 1.2, route);
    }

    // Navires.
    this.shipScreenPos = [];
    const inPort = new Map();
    for (const ship of state.ships) {
      const company = state.companies[ship.owner];
      if (ship.status !== 'sea') {
        const list = inPort.get(ship.port) || [];
        list.push(ship);
        inPort.set(ship.port, list);
        continue;
      }
      const route = ctx.shipRoute(ship);
      if (!route) continue;
      const v = ship.voyage;
      const moving = !v.waitCanal && !(v.stalledUntil > state.t);
      const pos = pointAlong(route, Math.min(route.nm, v.progress + (moving ? v.speed * frac : 0)));
      const [x, y] = this.toScreen(pos.lon, pos.lat);
      if (x < -20 || x > this.w + 20 || y < -20 || y > this.h + 20) continue;
      const own = ship.owner === active;
      this.drawShip(g, x, y, pos.heading, company.color, !!ship.cargo, own, ship.id === ui.selectedShip);
      this.shipScreenPos.push({ id: ship.id, x, y, own });
      if (ship.id === ui.selectedShip || (own && scale > 7)) this.label(g, x + 9, y - 9, ship.name);
    }
    // Navires à quai : petites pastilles autour du port.
    for (const [port, ships] of inPort) {
      const P = PORTS[port];
      if (!P) continue;
      const [px, py] = this.toScreen(P.lon, P.lat);
      ships.sort((a, b) => (b.owner === active) - (a.owner === active));
      ships.forEach((ship, i) => {
        const ang = -Math.PI / 2 + i * 0.75;
        const rr = 11 + Math.floor(i / 8) * 7;
        const x = px + Math.cos(ang) * rr, y = py + Math.sin(ang) * rr;
        const company = state.companies[ship.owner];
        g.beginPath(); g.arc(x, y, ship.owner === active ? 4.2 : 3.2, 0, Math.PI * 2);
        g.fillStyle = company.color; g.fill();
        g.lineWidth = ship.id === ui.selectedShip ? 2.5 : 1.2;
        g.strokeStyle = ship.id === ui.selectedShip ? '#fff' : ship.status === 'laidup' ? '#777' : '#0b1622';
        g.stroke();
        this.shipScreenPos.push({ id: ship.id, x, y, own: ship.owner === active });
      });
    }
    // Ports en grève.
    for (const [p, until] of Object.entries(state.strikes)) {
      if (until <= state.t) continue;
      const [x, y] = this.toScreen(PORTS[p].lon, PORTS[p].lat);
      this.badge(g, x - 14, y + 12, 'grève', '#ef5350', 9);
    }
  }

  polyline(g, points, fromNm, color, dash, width, route) {
    g.save();
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
    // On dessine à partir de la position actuelle, en gardant des longitudes continues.
    let pts = points;
    if (route && fromNm > 0) {
      const p = pointAlong(route, fromNm);
      let i = 1;
      while (i < route.cum.length - 1 && route.cum[i] < fromNm) i++;
      pts = [[p.lon, p.lat], ...points.slice(i)];
    }
    if (pts.length < 2) { g.restore(); return; }
    const [sx] = this.toScreen(pts[0][0], pts[0][1]);
    const base = pts[0][0];
    const { scale } = this.view;
    g.beginPath();
    pts.forEach((p, i) => {
      const x = sx + (p[0] - base) * scale;
      const y = this.h / 2 + (-p[1] - this.view.cy) * scale;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();
    g.restore();
  }

  drawShip(g, x, y, heading, color, laden, own, selected) {
    g.save();
    g.translate(x, y);
    if (selected) {
      g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.stroke();
    }
    g.rotate(heading);
    const s = own ? 1.15 : 0.9;
    g.scale(s, s);
    g.fillStyle = laden ? color : 'rgba(11,22,34,0.85)';
    g.fill(SHIP_SHAPE);
    g.lineWidth = laden ? 1.3 : 2;
    g.strokeStyle = laden ? '#0b1622' : color;
    g.stroke(SHIP_SHAPE);
    g.restore();
  }

  badge(g, x, y, text, color, size = 11) {
    g.font = `700 ${size}px system-ui, sans-serif`;
    const w = g.measureText(text).width + 8;
    g.fillStyle = 'rgba(8,16,26,0.85)';
    g.strokeStyle = color; g.lineWidth = 1.5;
    roundRect(g, x - w / 2, y - size / 2 - 3, w, size + 6, 4);
    g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5);
    g.textAlign = 'left';
  }

  label(g, x, y, text) {
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = 'rgba(5,15,25,0.9)';
    g.strokeText(text, x, y);
    g.fillStyle = '#fff'; g.fillText(text, x, y);
  }

  frame(frac) {
    if (this.dirty) this.drawBase();
    this.drawOverlay(frac);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
