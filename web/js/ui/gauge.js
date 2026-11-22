// Jauge de carburant façon tableau de bord : aiguille, graduations 0 · ½ · 1/1, zone rouge.
const ANGLE_MIN = -62, ANGLE_MAX = 62;
export const gaugeAngle = (frac) => ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * Math.max(0, Math.min(1, frac));

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function fuelGaugeSVG(frac, { size = 120, compact = false } = {}) {
  const cx = 60, cy = 60, r = 46;
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const a = ANGLE_MIN + ((ANGLE_MAX - ANGLE_MIN) * i) / 8, big = i % 4 === 0, rad = (a * Math.PI) / 180;
    const r1 = big ? r - 10 : r - 6;
    ticks.push(`<line x1="${(cx + r1 * Math.sin(rad)).toFixed(2)}" y1="${(cy - r1 * Math.cos(rad)).toFixed(2)}" x2="${(cx + (r - 1) * Math.sin(rad)).toFixed(2)}" y2="${(cy - (r - 1) * Math.cos(rad)).toFixed(2)}" stroke="#1c2a33" stroke-width="${big ? 2.2 : 1.2}"/>`);
  }
  const lab = (a, t) => {
    const rad = (a * Math.PI) / 180, rr = r - 19;
    return `<text x="${(cx + rr * Math.sin(rad)).toFixed(1)}" y="${(cy - rr * Math.cos(rad) + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="800" fill="#1c2a33">${t}</text>`;
  };
  const low = frac < 0.15;
  return `<svg class="fuel-gauge" viewBox="0 0 120 ${compact ? 74 : 92}" width="${size}" height="${Math.round(size * (compact ? 74 : 92) / 120)}" role="img" aria-label="Carburant ${Math.round(frac * 100)} %">
    <path d="${arc(cx, cy, r + 6, ANGLE_MIN - 14, ANGLE_MAX + 14)}" stroke="#d6ccb6" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="${arc(cx, cy, r - 2, ANGLE_MIN, ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * 0.15)}" stroke="#c4362c" stroke-width="6" fill="none"/>
    <path d="${arc(cx, cy, r - 2, ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * 0.15, ANGLE_MAX)}" stroke="#2c7a4b" stroke-width="3" fill="none" opacity=".55"/>
    ${ticks.join('')}
    ${lab(ANGLE_MIN, '0')}${lab(0, '½')}${lab(ANGLE_MAX, '1/1')}
    <g class="gauge-needle" style="transform: rotate(${gaugeAngle(frac).toFixed(1)}deg); transform-origin: ${cx}px ${cy}px">
      <path d="M${cx - 2.2} ${cy} L${cx} ${cy - r + 4} L${cx + 2.2} ${cy} Z" fill="#c4362c"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#1c2a33"/>
    ${compact ? '' : `<text x="${cx}" y="84" text-anchor="middle" font-size="13" fill="${low ? '#c4362c' : '#1c2a33'}">⛽</text>`}
    ${low ? `<circle cx="${cx + 30}" cy="${cy + 2}" r="3.5" fill="#c4362c"/>` : ''}
  </svg>`;
}

export function fuelGaugeEl(frac, opts) {
  const span = document.createElement('span');
  span.className = 'gauge-wrap';
  span.innerHTML = fuelGaugeSVG(frac, opts);
  return span;
}

// Fait monter l'aiguille d'une jauge déjà affichée.
export function animateNeedle(root, toFrac, ms = 1600) {
  const needle = root.querySelector('.gauge-needle');
  if (!needle) return;
  needle.style.transition = `transform ${ms}ms cubic-bezier(.3,.1,.3,1)`;
  requestAnimationFrame(() => { needle.style.transform = `rotate(${gaugeAngle(toFrac).toFixed(1)}deg)`; });
}
