// Fiche « radar » d'un navire, comme celle d'un footballeur : 7 qualités notées sur 100.
import { SHIP_TYPES, CREW_DAY_COST } from '../data/ships.js';
import { PORTS, PORT_IDS } from '../data/ports.js';

export const AXES = [
  { id: 'capacite', label: 'Capacité' },
  { id: 'vitesse', label: 'Vitesse' },
  { id: 'sobriete', label: 'Sobriété' },
  { id: 'autonomie', label: 'Autonomie' },
  { id: 'polyvalence', label: 'Polyvalence' },
  { id: 'etat', label: 'État' },
  { id: 'jeunesse', label: 'Jeunesse' },
];

const clamp = (v) => Math.max(3, Math.min(100, Math.round(v)));

export function shipStats(typeId, { condition = 100, age = 0 } = {}) {
  const T = SHIP_TYPES[typeId];
  // Coût par tonne et par mille à la vitesse de service (carburant à 620 $/t).
  const perTnm = (T.burn * 620 + T.opex + T.crew * CREW_DAY_COST) / (T.dwt * T.speed * 24);
  const range = (T.tank / T.burn) * T.speed * 24;
  const ports = PORT_IDS.filter((p) => PORTS[p].draft >= T.draft && T.holds.some((h) => PORTS[p].terminals.includes(h))).length;
  return {
    capacite: clamp(((Math.log10(T.dwt) - 3.5) / (5.7 - 3.5)) * 95 + 5),
    vitesse: clamp(((T.speed - 9) / 16) * 100),
    sobriete: clamp(((Math.log(0.009) - Math.log(perTnm)) / (Math.log(0.009) - Math.log(0.0008))) * 95 + 5),
    autonomie: clamp(((range - 3000) / 19000) * 95 + 5),
    polyvalence: clamp((T.holds.length / 4) * 55 + (ports / PORT_IDS.length) * 45),
    etat: clamp(condition),
    jeunesse: clamp(100 * (1 - age / T.life)),
  };
}

// values : { capacite: 0..100, ... } ; compare : deuxième série facultative (en pointillés).
export function radarSVG(values, { color = '#1f6f8b', compare = null, size = 220, labels = true } = {}) {
  const n = AXES.length, cx = 135, cy = 104, R = 68;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const poly = (vals) => AXES.map((ax, i) => pt(i, vals[ax.id]).map((x) => x.toFixed(1)).join(',')).join(' ');
  let s = `<svg class="radar" viewBox="0 0 270 210" width="${size}" height="${Math.round(size * 210 / 270)}" role="img" aria-label="Fiche du navire">`;
  for (const ring of [25, 50, 75, 100]) {
    s += `<polygon points="${AXES.map((_, i) => pt(i, ring).map((x) => x.toFixed(1)).join(',')).join(' ')}" class="radar-ring"/>`;
  }
  AXES.forEach((_, i) => { const [x, y] = pt(i, 100); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-axis"/>`; });
  if (compare) s += `<polygon points="${poly(compare)}" class="radar-compare"/>`;
  s += `<polygon points="${poly(values)}" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  AXES.forEach((ax, i) => { const [x, y] = pt(i, values[ax.id]); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${color}"/>`; });
  if (labels) {
    AXES.forEach((ax, i) => {
      const [x, y] = pt(i, 122);
      const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
      s += `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" class="radar-label">${ax.label}<tspan class="radar-value" dx="3">${values[ax.id]}</tspan></text>`;
    });
  }
  return s + '</svg>';
}

export function radarEl(values, opts) {
  const div = document.createElement('div');
  div.className = 'radar-wrap';
  div.innerHTML = radarSVG(values, opts);
  return div;
}
