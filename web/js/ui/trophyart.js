// Trophées des records et preuves sinistres des méfaits : dessins vectoriels détaillés (boîte 48 × 64,
// dégradés), un peu plus fins que le décor, à dessein : on les remarque dans le bureau.
// Chaque dessin reçoit un identifiant unique (u) pour ses dégradés : plusieurs trophées cohabitent
// dans le même dessin du bureau.
let seq = 0;
const uid = () => `ta${(++seq).toString(36)}`;
const f = (n) => Math.round(n * 100) / 100;

// Dégradés communs.
const defs = (u) => `<defs>
  <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4b8"/><stop offset=".3" stop-color="#f3c94a"/><stop offset=".65" stop-color="#c9921f"/><stop offset="1" stop-color="#7d5410"/></linearGradient>
  <linearGradient id="${u}gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#e2b23a"/><stop offset="1" stop-color="#8c6014"/></linearGradient>
  <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#cdd3dc"/><stop offset=".7" stop-color="#8f98a5"/><stop offset="1" stop-color="#5c6470"/></linearGradient>
  <linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5232"/><stop offset="1" stop-color="#3a2414"/></linearGradient>
  <radialGradient id="${u}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/><stop offset="1" stop-color="#fff6c4" stop-opacity="0"/></radialGradient>
</defs>`;
const G = (u) => `url(#${u}g)`, GV = (u) => `url(#${u}gv)`, SV = (u) => `url(#${u}s)`;
// Socle en bois et plaque dorée.
const plinth = (u) => `<rect x="8" y="53" width="32" height="10" rx="1.4" fill="url(#${u}w)"/><rect x="8" y="53" width="32" height="1.2" fill="#9a7048" opacity=".7"/>
  <rect x="11.5" y="49" width="25" height="5" rx="1" fill="#5e3d24"/><rect x="11.5" y="49" width="25" height=".9" fill="#8a6440"/>
  <rect x="17" y="56" width="14" height="4" rx=".6" fill="${G(u)}"/><rect x="18" y="57.4" width="12" height=".6" fill="#7d5410" opacity=".55"/>`;

// ---------- Records ----------
// Proue vue de face (pour l'Armada) : coque en V éclairée d'un côté, ombrée de l'autre, peinture
// rouge sous la flottaison, écubiers, passerelle en retrait, grosse vague d'étrave.
function prow(cx, top, w, h) {
  const keel = top + h, water = top + h * 0.6, sheer = top - h * 0.1;
  const k = (y) => (keel - y) / h; // demi-largeur relative de la coque à la hauteur y
  return `
    <rect x="${f(cx - w * 0.42)}" y="${f(sheer - h * 0.5)}" width="${f(w * 0.84)}" height="${f(h * 0.44)}" rx="${f(w * 0.06)}" fill="#f6f2e6" stroke="#0b1624" stroke-width="${f(w * 0.05)}"/>
    <rect x="${f(cx - w * 0.36)}" y="${f(sheer - h * 0.4)}" width="${f(w * 0.72)}" height="${f(h * 0.08)}" fill="#2c4a63"/>
    <rect x="${f(cx - w * 0.3)}" y="${f(sheer - h * 0.24)}" width="${f(w * 0.6)}" height="${f(h * 0.05)}" fill="#2c4a63" opacity=".7"/>
    <rect x="${f(cx - w * 0.11)}" y="${f(sheer - h * 0.82)}" width="${f(w * 0.22)}" height="${f(h * 0.34)}" fill="#c4362c" stroke="#0b1624" stroke-width="${f(w * 0.04)}"/>
    <rect x="${f(cx - w * 0.11)}" y="${f(sheer - h * 0.82)}" width="${f(w * 0.22)}" height="${f(h * 0.08)}" fill="#1d1d1d"/>
    <path d="M${f(cx - w)} ${top} Q${f(cx - w * 0.5)} ${f(sheer)} ${cx} ${f(sheer)} L${cx} ${f(keel)} Z" fill="#8fb0c8"/>
    <path d="M${cx} ${f(sheer)} Q${f(cx + w * 0.5)} ${f(sheer)} ${f(cx + w)} ${top} L${cx} ${f(keel)} Z" fill="#3b5468"/>
    <path d="M${f(cx - w * k(water))} ${f(water)} L${f(cx + w * k(water))} ${f(water)} L${cx} ${f(keel)} Z" fill="#c4453a"/>
    <path d="M${cx} ${f(water)} L${f(cx + w * k(water))} ${f(water)} L${cx} ${f(keel)} Z" fill="#8c2a20"/>
    <path d="M${f(cx - w)} ${top} Q${f(cx - w * 0.5)} ${f(sheer)} ${cx} ${f(sheer)} Q${f(cx + w * 0.5)} ${f(sheer)} ${f(cx + w)} ${top} L${cx} ${f(keel)} Z" fill="none" stroke="#0b1624" stroke-width="${f(w * 0.06)}" stroke-linejoin="round"/>
    <circle cx="${f(cx - w * 0.36)}" cy="${f(top + h * 0.12)}" r="${f(w * 0.07)}" fill="#0b1624"/><circle cx="${f(cx + w * 0.36)}" cy="${f(top + h * 0.12)}" r="${f(w * 0.07)}" fill="#0b1624"/>
    <path d="M${f(cx - w * 1.1)} ${f(keel - h * 0.02)} q${f(w * 0.3)} ${f(-h * 0.32)} ${f(w * 0.85)} ${f(-h * 0.18)} q${f(-w * 0.1)} ${f(h * 0.2)} ${f(w * 0.25)} ${f(h * 0.2)} q${f(w * 0.35)} 0 ${f(w * 0.25)} ${f(-h * 0.2)} q${f(w * 0.55)} ${f(-h * 0.14)} ${f(w * 0.85)} ${f(h * 0.18)} z" fill="#ffffff"/>
    <path d="M${f(cx - w * 0.9)} ${f(keel - h * 0.12)} l${f(-w * 0.2)} ${f(-h * 0.12)} M${f(cx + w * 0.9)} ${f(keel - h * 0.12)} l${f(w * 0.2)} ${f(-h * 0.12)}" stroke="#ffffff" stroke-width="${f(w * 0.06)}" stroke-linecap="round"/>`;
}
export const TROPHY_ART = {
  // L'Armada : un médaillon en explosion de vitesse, cinq proues qui en jaillissent.
  armada: (u) => `${plinth(u)}
    <rect x="21" y="42" width="6" height="8" fill="${GV(u)}"/>
    <clipPath id="${u}c"><circle cx="24" cy="23" r="17.2"/></clipPath>
    <circle cx="24" cy="23" r="21" fill="${G(u)}"/><circle cx="24" cy="23" r="19.2" fill="none" stroke="#7d5410" stroke-width=".6"/>
    <g clip-path="url(#${u}c)">
      <rect x="0" y="0" width="48" height="48" fill="#1b3a5c"/>
      ${Array.from({ length: 20 }, (_, k) => { const a = (k / 20) * Math.PI * 2, b = a + Math.PI / 30; return `<path d="M24 21 L${f(24 + Math.cos(a) * 30)} ${f(21 + Math.sin(a) * 30)} L${f(24 + Math.cos(b) * 30)} ${f(21 + Math.sin(b) * 30)} Z" fill="#cfeaff" opacity=".42"/>`; }).join('')}
      <circle cx="24" cy="21" r="12" fill="url(#${u}glow)"/>
      ${prow(9, 23, 2.6, 4.4)}${prow(39, 23, 2.6, 4.4)}${prow(14, 24.5, 4.6, 8)}${prow(34, 24.5, 4.6, 8)}${prow(24, 27, 8.4, 13.5)}
      <rect x="0" y="38.6" width="48" height="10" fill="#14304e" opacity=".55"/>
    </g>
    <circle cx="24" cy="23" r="17.2" fill="none" stroke="#fff4b8" stroke-width=".8" opacity=".7"/>
    <path d="M9 13 a17 17 0 0 1 12 -8" stroke="#fff" stroke-width="1.2" fill="none" opacity=".55" stroke-linecap="round"/>`,
  // Le mois du siècle : un poids d'autrefois en laiton, gravé « 30 ».
  mois: (u) => `${plinth(u)}
    <ellipse cx="24" cy="11" rx="7.5" ry="6" fill="none" stroke="${G(u)}" stroke-width="3"/><ellipse cx="22.6" cy="9.5" rx="4" ry="2.6" fill="none" stroke="#fff4b8" stroke-width=".7" opacity=".7"/>
    <rect x="20" y="15.5" width="8" height="4" rx="1" fill="${GV(u)}"/>
    <path d="M14.5 19.5 h19 q2 0 2.4 2 l3.8 25 q.3 2.2 -2 2.2 h-27.4 q-2.3 0 -2 -2.2 l3.8 -25 q.4 -2 2.4 -2 z" fill="${G(u)}"/>
    <path d="M15.6 22 l-3.4 23.6" stroke="#fff4b8" stroke-width="1.6" opacity=".6" stroke-linecap="round"/>
    <path d="M10.4 46.6 h27.2" stroke="#7d5410" stroke-width="1" opacity=".7"/>
    <text x="24" y="40" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-weight="700" text-anchor="middle" fill="#7d5410">30</text>
    <text x="24" y="39.4" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff0a8" opacity=".35">30</text>`,
  // Le géant du fret : une barre d'haltérophile en or, posée au sol sur ses disques.
  tonnes: (u) => `${plinth(u)}
    <ellipse cx="24" cy="49.2" rx="21" ry="1.3" fill="#000" opacity=".22"/>
    <rect x="1" y="30.4" width="46" height="3.2" rx="1.2" fill="${SV(u)}" stroke="#4a5058" stroke-width=".4"/>
    <rect x="18" y="31.1" width="12" height="1.8" fill="#9aa3ae"/>
    ${Array.from({ length: 8 }, (_, k) => `<path d="M${f(18.8 + k * 1.4)} 31.1 l.8 1.8" stroke="#5c6470" stroke-width=".35"/>`).join('')}
    ${[[4.2, 10.8, 15, 34, 2.2], [10.8, 14.8, 20.5, 23, 1.6], [14.8, 17, 26, 12, 1], [17, 18.4, 29.4, 5.2, .6]].map(([a, b, y, hh, r]) => [a, 48 - b].map((x) => `<rect x="${f(x)}" y="${y}" width="${f(b - a)}" height="${hh}" rx="${r}" fill="${G(u)}" stroke="#7d5410" stroke-width=".6"/><rect x="${f(x + (b - a) * 0.18)}" y="${f(y + 1.4)}" width="${f((b - a) * 0.28)}" height="${f(hh - 2.8)}" rx="${f(r * 0.5)}" fill="#fff4b8" opacity=".5"/>`).join('')).join('')}
    <path d="M7.5 17 v30 M40.5 17 v30" stroke="#7d5410" stroke-width=".5" opacity=".6"/>
    <path d="M5.8 17.6 a3 3 0 0 1 3 -1.8" stroke="#fff" stroke-width=".9" fill="none" opacity=".6" stroke-linecap="round"/>`,
  // Réglé comme une horloge : une montre de gousset ouvragée, sur des branches de laurier.
  ponctuel: (u) => `${plinth(u)}
    <path d="M24 49 v-9" stroke="${GV(u)}" stroke-width="3"/>
    <path d="M12 44 q-4 -8 1 -15 M36 44 q4 -8 -1 -15" stroke="#5f7d3a" stroke-width="1.3" fill="none"/>
    ${[0, 1, 2, 3].map((k) => `<ellipse cx="${f(11.6 + k * 0.4)}" cy="${f(42 - k * 3.6)}" rx="2.4" ry="1.1" transform="rotate(${-50 + k * 10} ${f(11.6 + k * 0.4)} ${f(42 - k * 3.6)})" fill="#7da24a"/><ellipse cx="${f(36.4 - k * 0.4)}" cy="${f(42 - k * 3.6)}" rx="2.4" ry="1.1" transform="rotate(${50 - k * 10} ${f(36.4 - k * 0.4)} ${f(42 - k * 3.6)})" fill="#7da24a"/>`).join('')}
    <circle cx="24" cy="5" r="2.6" fill="none" stroke="${G(u)}" stroke-width="1.4"/><rect x="22" y="6.6" width="4" height="3.4" rx=".8" fill="${GV(u)}"/>
    <circle cx="24" cy="24" r="15" fill="${G(u)}"/><circle cx="24" cy="24" r="13" fill="none" stroke="#7d5410" stroke-width=".7"/>
    <circle cx="24" cy="24" r="11.6" fill="#fbf6e6"/><circle cx="24" cy="24" r="11.6" fill="none" stroke="#d8c9a0" stroke-width=".6"/>
    ${Array.from({ length: 60 }, (_, k) => { const a = (k * Math.PI) / 30, big = k % 5 === 0, r1 = big ? 9 : 10.3; return `<line x1="${f(24 + Math.sin(a) * r1)}" y1="${f(24 - Math.cos(a) * r1)}" x2="${f(24 + Math.sin(a) * 11)}" y2="${f(24 - Math.cos(a) * 11)}" stroke="#3a2a1a" stroke-width="${big ? 0.9 : 0.3}"/>`; }).join('')}
    <path d="M24 24 L24 16" stroke="#1d1d1d" stroke-width="1.4" stroke-linecap="round"/><path d="M24 24 L30 27.5" stroke="#1d1d1d" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M24 26 L24 14.5" stroke="#c4362c" stroke-width=".5"/><circle cx="24" cy="24" r="1.1" fill="#1d1d1d"/>
    <path d="M15.5 17 a11 11 0 0 1 9 -4.6" stroke="#fff" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>`,
  // Les loups de mer : une casquette de capitaine en or à visière bleu marine, insigne à l'ancre, sur un coussin de velours.
  equipages: (u) => `${plinth(u)}
    <ellipse cx="24" cy="46" rx="15" ry="4.6" fill="#8c1f2a"/><ellipse cx="24" cy="44.6" rx="14" ry="3.6" fill="#b5303e"/>
    <path d="M10 46 l-1.6 3 M38 46 l1.6 3" stroke="${G(u)}" stroke-width="1.2"/><circle cx="8.2" cy="49.4" r="1" fill="${G(u)}"/><circle cx="39.8" cy="49.4" r="1" fill="${G(u)}"/>
    <path d="M6 22 q18 -14 36 0 q-2 6 -6 8 h-24 q-4 -2 -6 -8 z" fill="${G(u)}"/>
    <path d="M9 21 q15 -10 30 0" stroke="#fff4b8" stroke-width="1.2" fill="none" opacity=".7"/>
    <path d="M11.2 35.2 Q24 40.2 36.8 35.2 Q38 43.4 24 45 Q10 43.4 11.2 35.2 Z" fill="#1f3a6e" stroke="#0e1f3f" stroke-width=".5"/>
    <path d="M13.4 40.4 Q24 44.6 34.6 40.4" stroke="#5f82c0" stroke-width="1.1" fill="none" opacity=".7" stroke-linecap="round"/>
    <path d="M11.6 36.6 Q24 41.6 36.4 36.6" stroke="#0e1f3f" stroke-width=".9" fill="none" opacity=".55"/>
    ${Array.from({ length: 7 }, (_, k) => { const t = (k + 0.5) / 7, x = (1 - t) ** 2 * 14 + 2 * (1 - t) * t * 24 + t * t * 34, y = (1 - t) ** 2 * 39.4 + 2 * (1 - t) * t * 44 + t * t * 39.4, a = Math.atan2(2 * (1 - t) * (44 - 39.4) + 2 * t * (39.4 - 44), 2 * (1 - t) * 10 + 2 * t * 10) * 180 / Math.PI; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="1.45" ry=".72" transform="rotate(${f(a + (k % 2 ? 22 : -22))} ${f(x)} ${f(y)})" fill="#f3c94a" stroke="#9a6e14" stroke-width=".2"/>`; }).join('')}
    <path d="M12 29 H36 V35.4 Q24 40 12 35.4 Z" fill="#5c3e0c"/><rect x="12" y="29" width="24" height="1.2" fill="#e2b23a"/>
    <path d="M12 35.1 Q24 39.7 36 35.1" stroke="#e2b23a" stroke-width="1.2" fill="none"/>
    <path d="M12.8 33 Q24 35.8 35.2 33" stroke="#f3c94a" stroke-width=".9" fill="none"/><path d="M12.8 33.6 Q24 36.4 35.2 33.6" stroke="#c9921f" stroke-width=".5" fill="none"/>
    <circle cx="12.9" cy="33.2" r="1.1" fill="${G(u)}" stroke="#7d5410" stroke-width=".3"/><circle cx="35.1" cy="33.2" r="1.1" fill="${G(u)}" stroke="#7d5410" stroke-width=".3"/>
    <circle cx="24" cy="25" r="5.2" fill="#5c3e0c"/><circle cx="24" cy="25" r="4.6" fill="none" stroke="#f3c94a" stroke-width=".7"/>
    <path d="M24 21.6 v7 M21.6 23.2 h4.8 M21 26.4 q3 3.2 6 0" stroke="#fff0a8" stroke-width=".9" fill="none" stroke-linecap="round"/><circle cx="24" cy="21.2" r=".8" fill="none" stroke="#fff0a8" stroke-width=".6"/>
    <path d="M17 27 q-2 -3 0 -6 M31 27 q2 -3 0 -6" stroke="#7da24a" stroke-width="1.1" fill="none"/>`,
  // Tout ce qui flotte : un atome doré, son noyau et ses électrons.
  produits: (u) => `${plinth(u)}
    <path d="M24 49 v-10" stroke="${GV(u)}" stroke-width="2.4"/><ellipse cx="24" cy="49" rx="5" ry="1.4" fill="${G(u)}"/>
    <circle cx="24" cy="23" r="17" fill="url(#${u}glow)" opacity=".5"/>
    ${[0, 60, 120].map((a) => `<ellipse cx="24" cy="23" rx="18" ry="6.4" fill="none" stroke="${G(u)}" stroke-width="1.3" transform="rotate(${a} 24 23)"/>`).join('')}
    ${[[0, 0.3], [60, 2.4], [120, 4.2]].map(([a, t]) => { const r = (a * Math.PI) / 180, x = 18 * Math.cos(t), y = 6.4 * Math.sin(t); const X = 24 + x * Math.cos(r) - y * Math.sin(r), Y = 23 + x * Math.sin(r) + y * Math.cos(r); return `<circle cx="${f(X)}" cy="${f(Y)}" r="2.6" fill="#7fd8ff"/><circle cx="${f(X - 0.8)}" cy="${f(Y - 0.8)}" r=".9" fill="#fff"/>`; }).join('')}
    ${[[-2, -1.6, '#c4362c'], [2, -1.4, '#f3c94a'], [0, 1.8, '#c4362c'], [-2.3, 1.6, '#f3c94a'], [2.4, 2, '#c4362c'], [0, -0.2, '#f3c94a']].map(([dx, dy, c]) => `<circle cx="${24 + dx}" cy="${23 + dy}" r="2.4" fill="${c}"/><circle cx="${f(24 + dx - 0.7)}" cy="${f(23 + dy - 0.7)}" r=".7" fill="#fff" opacity=".7"/>`).join('')}`,
  // Toutes les escales : un phare, sa lanterne allumée et ses faisceaux.
  ports: (u) => `${plinth(u)}
    <path d="M24 9 L2 2 L2 16 Z" fill="#fff3b0" opacity=".35"/><path d="M24 9 L46 2 L46 16 Z" fill="#fff3b0" opacity=".35"/>
    <path d="M12 49 q2 -5 6 -5 q2 -3 6 -2 q4 -2 7 1 q4 0 5 6 z" fill="#6b6f75"/><path d="M15 47 q3 -2 5 0 M27 46 q3 -1 5 1" stroke="#8f949b" stroke-width=".8" fill="none"/>
    <path d="M17.6 45 L30.4 45 L28.2 18.4 L19.8 18.4 Z" fill="#f4f0e6"/>
    ${[[41, 36.4], [32, 27.4], [23.6, 19.6]].map(([y0, y1]) => { const w0 = 6.4 - (45 - y0) * 0.084, w1 = 6.4 - (45 - y1) * 0.084; return `<path d="M${f(24 - w0)} ${y0} L${f(24 + w0)} ${y0} L${f(24 + w1)} ${y1} L${f(24 - w1)} ${y1} Z" fill="#c0392b"/>`; }).join('')}
    <path d="M19 44 L21 19" stroke="#fff" stroke-width="1.1" opacity=".5"/>
    <rect x="17.4" y="16" width="13.2" height="2.6" fill="#2b2b2b"/>${[18.6, 21, 23.4, 25.8, 28.2].map((x) => `<rect x="${x}" y="13.4" width=".6" height="2.6" fill="#2b2b2b"/>`).join('')}<rect x="17.4" y="13" width="13.2" height=".7" fill="#2b2b2b"/>
    <rect x="20" y="8.4" width="8" height="5" fill="#ffe27a"/><circle cx="24" cy="10.8" r="6" fill="url(#${u}glow)"/><path d="M22 8.4 v5 M26 8.4 v5" stroke="#2b2b2b" stroke-width=".5"/>
    <path d="M19.4 8.6 q4.6 -6 9.2 0 z" fill="${G(u)}"/><rect x="23.5" y="1.4" width="1" height="2.6" fill="${G(u)}"/><circle cx="24" cy="1.4" r=".9" fill="${G(u)}"/>`,
  // La flotte complète : la barre à roue d'autrefois, bois et laiton.
  familles: (u) => `${plinth(u)}
    <path d="M17 49 l4 -10 h6 l4 10 z" fill="url(#${u}w)"/>
    ${Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); return `<line x1="${f(24 + c * 4)}" y1="${f(23 + s * 4)}" x2="${f(24 + c * 17.5)}" y2="${f(23 + s * 17.5)}" stroke="#6b4426" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="${f(24 + c * 19.5)}" cy="${f(23 + s * 19.5)}" rx="2" ry="1.4" transform="rotate(${(a * 180) / Math.PI} ${f(24 + c * 19.5)} ${f(23 + s * 19.5)})" fill="#8a5a34"/><circle cx="${f(24 + c * 17)}" cy="${f(23 + s * 17)}" r=".8" fill="${G(u)}"/>`; }).join('')}
    <circle cx="24" cy="23" r="13.4" fill="none" stroke="#5a3820" stroke-width="3.6"/><circle cx="24" cy="23" r="13.4" fill="none" stroke="#8a5a34" stroke-width="2.4"/>
    <circle cx="24" cy="23" r="15.2" fill="none" stroke="${G(u)}" stroke-width="1"/><circle cx="24" cy="23" r="11.6" fill="none" stroke="${G(u)}" stroke-width="1"/>
    <circle cx="24" cy="23" r="5" fill="${G(u)}"/><circle cx="24" cy="23" r="2.2" fill="#7d5410"/><circle cx="23" cy="22" r=".9" fill="#fff4b8"/>`,
};

// ---------- Méfaits : preuves sinistres ----------
export const GRIM_ART = {
  // Le couteau planté dans le bureau.
  couteau: (u) => `
    <rect x="1" y="51" width="46" height="13" fill="url(#${u}w)"/><rect x="1" y="51" width="46" height="1.4" fill="#8a6440"/>
    ${[54, 57.5, 61].map((y, k) => `<path d="M1 ${y} q12 ${k % 2 ? 1.2 : -1.2} 23 0 t23 0" stroke="#2a180c" stroke-width=".5" fill="none" opacity=".7"/>`).join('')}
    <path d="M24 52 l-6 5 l-3 1 M24.6 52 l5 4 l4 .4 M24.2 52.4 l1 6" stroke="#140a04" stroke-width=".9" fill="none"/>
    <path d="M21.4 27 h5.2 l-.6 25.4 l-2 1.4 l-2 -1.4 z" fill="${SV(u)}"/><path d="M24 27 v26.6" stroke="#ffffff" stroke-width=".8" opacity=".85"/>
    <path d="M22.2 29 l.4 22" stroke="#5c6470" stroke-width=".5" opacity=".7"/>
    <rect x="17.4" y="24" width="13.2" height="3.4" rx="1.2" fill="${SV(u)}"/><circle cx="17.6" cy="25.7" r="1.6" fill="#8f98a5"/><circle cx="30.4" cy="25.7" r="1.6" fill="#8f98a5"/>
    <rect x="20.6" y="6" width="6.8" height="18.4" rx="2.6" fill="#1a1412"/>
    ${[9, 12.6, 16.2, 19.8].map((y) => `<path d="M20.6 ${y} l6.8 1.6" stroke="#3a2c26" stroke-width="1.2"/>`).join('')}
    <ellipse cx="24" cy="5" rx="3.6" ry="2.4" fill="${SV(u)}"/><path d="M22 4.4 q2 -1.6 4 0" stroke="#fff" stroke-width=".6" fill="none" opacity=".7"/>`,
  // Le passeur : un cadeau jaune, ruban rouge. Personne ne demande ce qu'il y a dedans.
  passeur: (u) => `
    <ellipse cx="24" cy="60" rx="18" ry="2.6" fill="#000" opacity=".25"/>
    <linearGradient id="${u}y" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#f2c21a"/><stop offset="1" stop-color="#b98a06"/></linearGradient>
    <rect x="8" y="30" width="32" height="29" rx="1.4" fill="url(#${u}y)"/><rect x="6" y="24" width="36" height="8" rx="1.4" fill="url(#${u}y)"/>
    <rect x="6" y="31" width="36" height="1.4" fill="#b98a06" opacity=".7"/><rect x="9.5" y="33" width="4" height="24" fill="#fff6b0" opacity=".4"/>
    <rect x="21" y="24" width="6" height="35" fill="#c4232b"/><rect x="21" y="24" width="1.4" height="35" fill="#ef5a5f"/>
    <rect x="8" y="40" width="32" height="5" fill="#c4232b"/><rect x="8" y="40" width="32" height="1.2" fill="#ef5a5f"/>
    <path d="M24 24 q-12 -11 -14 -4 q-1 5 14 4 z" fill="#d4282f"/><path d="M24 24 q12 -11 14 -4 q1 5 -14 4 z" fill="#d4282f"/>
    <path d="M24 24 q-9 -7 -11 -3" stroke="#8c1419" stroke-width=".9" fill="none"/><path d="M24 24 q9 -7 11 -3" stroke="#8c1419" stroke-width=".9" fill="none"/>
    <path d="M23 25 l-5 9 l2.2 -.4 l1 2.4 z" fill="#b51d24"/><path d="M25 25 l5 9 l-2.2 -.4 l-1 2.4 z" fill="#b51d24"/>
    <ellipse cx="24" cy="24.4" rx="3" ry="2.4" fill="#e3343b"/><ellipse cx="23.2" cy="23.6" rx="1" ry=".7" fill="#ff8a8e"/>
    <path d="M34 45 l5 6" stroke="#1d1d1d" stroke-width=".6"/><rect x="37" y="50" width="7" height="5" rx=".6" fill="#1d1d1d" transform="rotate(25 40.5 52.5)"/>`,
  // Briseur d'embargo : un cadenas forcé, l'anse brisée, et le scellé arraché.
  embargo: (u) => `
    <ellipse cx="24" cy="60" rx="17" ry="2.4" fill="#000" opacity=".25"/>
    <path d="M14 30 v-9 a10 10 0 0 1 17.4 -6.6" fill="none" stroke="${SV(u)}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M35.6 16.4 l2.8 -1.6 M36.4 20.6 l3.2 .4" stroke="#8f98a5" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M34 18 a10 10 0 0 1 .4 4 v8" fill="none" stroke="${SV(u)}" stroke-width="4.4" stroke-linecap="round" transform="rotate(28 34 30)"/>
    <rect x="8" y="29" width="32" height="27" rx="3.4" fill="${SV(u)}"/><rect x="8" y="29" width="32" height="27" rx="3.4" fill="none" stroke="#4a515c" stroke-width=".8"/>
    <rect x="10" y="31" width="4" height="22" rx="1.4" fill="#fff" opacity=".35"/>
    <circle cx="24" cy="40" r="3.4" fill="#1d2126"/><path d="M22.6 41.6 h2.8 l1 7 h-4.8 z" fill="#1d2126"/>
    <path d="M18.4 39.6 l3 1.4" stroke="#1d2126" stroke-width=".6"/>
    <path d="M24.4 47.6 l18.4 -6.6 l2.2 5.8 l-18.4 6.6 z" fill="#c4232b"/><path d="M42.8 41 l2.4 -1.2 l.4 1.8 l-1.2 .9 l1.6 1.3 l-1.4 1 l.4 2" fill="#c4232b"/>
    <text x="34.9" y="48.9" font-family="Arial, Helvetica, sans-serif" font-size="3.4" font-weight="900" fill="#fff" text-anchor="middle" transform="rotate(-19.7 34.9 47.6)">EMBARGO</text>
    <path d="M5 58 l3 -2 l2 1.4 M42 58.6 l2.4 -1.6" stroke="#8f98a5" stroke-width="1" stroke-linecap="round"/>`,
  // Le marionnettiste : la croix de bois, ses fils, et un homme d'affaires pendu à ses ficelles.
  marionnettiste: (u) => `
    <rect x="6" y="4.4" width="36" height="3.6" rx="1.2" fill="url(#${u}w)"/><rect x="21.6" y="0" width="4.8" height="16" rx="1.2" fill="url(#${u}w)"/>
    <rect x="6" y="4.4" width="36" height=".9" fill="#9a7048"/><circle cx="24" cy="6.2" r="1.4" fill="${G(u)}"/>
    <path d="M8 8 L15.4 33 M40 8 L32.6 33 M24 16 V25 M14 8 L20.6 52 M34 8 L27.4 52" stroke="#d8cfba" stroke-width=".45"/>
    <ellipse cx="24" cy="28" rx="3.4" ry="3.8" fill="#e8d0ae"/><path d="M20.4 25.4 h7.2 v-1.4 h-1.4 v-5.6 h-4.4 v5.6 h-1.4 z" fill="#141414"/><rect x="20.4" y="22.4" width="7.2" height="1" fill="#7a1f2a"/>
    <path d="M22.4 28 h1 M24.6 28 h1" stroke="#2b2b2b" stroke-width=".7"/><path d="M22.8 30.2 q1.2 .8 2.4 0" stroke="#2b2b2b" stroke-width=".5" fill="none"/>
    <path d="M18.6 32.4 h10.8 l1.2 12 h-13.2 z" fill="#1f2630"/><path d="M24 32.4 l-1.4 4 l1.4 6 l1.4 -6 z" fill="#f4f0e6"/><path d="M24 33.4 l-.8 2.4 l.8 4.4 l.8 -4.4 z" fill="#a8232b"/>
    <path d="M18.6 33.4 L15.4 33 M29.4 33.4 L32.6 33" stroke="#1f2630" stroke-width="2.4" stroke-linecap="round"/><circle cx="15.2" cy="33" r="1.1" fill="#e8d0ae"/><circle cx="32.8" cy="33" r="1.1" fill="#e8d0ae"/>
    <path d="M21 44.4 L20.6 52 M27 44.4 L27.4 52" stroke="#1f2630" stroke-width="2.4" stroke-linecap="round"/><path d="M19.4 52.6 h2.6 M26 52.6 h2.6" stroke="#0a0a0a" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="1" y="58" width="46" height="6" fill="url(#${u}w)"/>`,
  // Ennemi public numéro un : un avis de recherche à l'ancienne.
  ennemi: (u) => `
    <linearGradient id="${u}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e2b8"/><stop offset="1" stop-color="#c9a86a"/></linearGradient>
    <path d="M5 5 h38 l-.6 4 l1 5 l-.8 6 l.8 8 l-1 7 l.6 9 l-.8 7 l.6 11 h-37 l.6 -5 l-1 -6 l.8 -8 l-.8 -9 l1 -7 l-.8 -8 l.6 -7 z" fill="url(#${u}p)"/>
    <path d="M42 54 l1 6 h-6 z" fill="#8a6a3a" opacity=".6"/>
    <circle cx="24" cy="4.6" r="1.6" fill="#6b6f75"/><circle cx="23.5" cy="4.1" r=".5" fill="#c9cdd2"/>
    <text x="24" y="15.4" font-family="Georgia, 'Times New Roman', serif" font-size="8.4" font-weight="700" text-anchor="middle" fill="#3a2414" letter-spacing=".4">WANTED</text>
    <rect x="10" y="17.4" width="28" height=".6" fill="#3a2414"/>
    <rect x="12" y="19.4" width="24" height="22" fill="#e6d2a0" stroke="#3a2414" stroke-width=".8"/>
    <path d="M15 41.4 q9 -10 18 0 z" fill="#24180e"/><circle cx="24" cy="29" r="5" fill="#24180e"/><path d="M16.6 26 h14.8 l-2.4 -4.4 h-10 z" fill="#24180e"/><rect x="15" y="25.4" width="18" height="1.4" rx=".6" fill="#24180e"/>
    <path d="M21.8 29 h1.4 M24.8 29 h1.4" stroke="#e6d2a0" stroke-width=".7"/>
    <text x="24" y="47.6" font-family="Georgia, 'Times New Roman', serif" font-size="4.6" font-weight="700" text-anchor="middle" fill="#3a2414" letter-spacing=".3">REWARD</text>
    <text x="24" y="54.4" font-family="Georgia, 'Times New Roman', serif" font-size="5.6" font-weight="700" text-anchor="middle" fill="#7a1f1f">$ 1 000 000</text>
    <path d="M7 8 q2 -1 3 1 M38 50 q2 1 2 3" stroke="#8a6a3a" stroke-width=".5" fill="none" opacity=".7"/>`,
  // Le fossoyeur : une stèle, rien de plus.
  fossoyeur: (u) => `
    <linearGradient id="${u}t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a7adb4"/><stop offset=".55" stop-color="#8a9097"/><stop offset="1" stop-color="#5f656c"/></linearGradient>
    <path d="M4 63 q4 -7 20 -7 q16 0 20 7 z" fill="#4a3a24"/>
    <path d="M10 58 v-36 a14 14 0 0 1 28 0 v36 z" fill="url(#${u}t)"/>
    <path d="M10 58 v-36 a14 14 0 0 1 14 -14" fill="none" stroke="#c4cad0" stroke-width="1" opacity=".7"/>
    <text x="24" y="28" font-family="Georgia, 'Times New Roman', serif" font-size="7.4" font-weight="700" text-anchor="middle" fill="#4a5056">R.I.P.</text>
    <text x="24" y="27.4" font-family="Georgia, 'Times New Roman', serif" font-size="7.4" font-weight="700" text-anchor="middle" fill="#c4cad0" opacity=".35">R.I.P.</text>
    <path d="M24 33 v9 M20.6 35.2 h6.8 M19.8 39.6 q4.2 4.4 8.4 0" stroke="#4a5056" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="24" cy="32.4" r="1" fill="none" stroke="#4a5056" stroke-width=".8"/>
    <path d="M31 44 l-2.4 4 l1.6 2.4 l-1.4 3" stroke="#4a5056" stroke-width=".7" fill="none"/>
    <path d="M10 50 q3 -2 6 1 q2 2 0 4 h-6 z M34 54 q2 -3 4 0 v4 h-5 z" fill="#5f7d3a" opacity=".85"/>
    ${[8, 13, 18, 30, 35, 40].map((x, k) => `<path d="M${x} 59 l1 -4 l1 4 M${x + 1.4} 59 l1.2 -3" stroke="#6f8f42" stroke-width=".7" fill="none"/>`).join('')}`,
};

// Un dessin seul (SVG complet), pour les fiches et les scènes.
// ---------- Hauts faits : icônes dessinées (dans le disque de la médaille, boîte 24 × 24) ----------
// Gravées en relief : un reflet clair décalé sous le trait sombre.
const emboss = (d) => `<g transform="translate(.4 .45)" opacity=".55">${d.replace(/#4a3208/g, '#fff1b0')}</g>${d}`;
export const DEED_ART = {
  // Le Juste (identifiant historique « mainspropres », gardé pour les sauvegardes) : une balance à plateaux.
  mainspropres: () => emboss(`<circle cx="12" cy="3" r="1.5" fill="none" stroke="#4a3208" stroke-width="1"/>
    <rect x="11.25" y="4.4" width="1.5" height="15" fill="#4a3208"/><rect x="3.4" y="6.2" width="17.2" height="1.4" rx=".4" fill="#4a3208"/>
    <path d="M6 7.6 L3.1 13.4 M6 7.6 L8.9 13.4 M18 7.6 L15.1 13.4 M18 7.6 L20.9 13.4" stroke="#4a3208" stroke-width=".7" fill="none"/>
    <path d="M2.4 13.4 h7.2 a3.6 2.7 0 0 1 -7.2 0 z M14.4 13.4 h7.2 a3.6 2.7 0 0 1 -7.2 0 z" fill="#4a3208"/>
    <rect x="7.4" y="19.2" width="9.2" height="1.4" fill="#4a3208"/><rect x="5.6" y="21" width="12.8" height="1.6" rx=".3" fill="#4a3208"/>`),
  // École de la mer : la patte d'épaule d'un capitaine (US Navy), étoile et quatre galons.
  ecole: () => `<g transform="rotate(-14 12 12)">
    <path d="M7.4 5 L12 1.4 L16.6 5 V22.8 H7.4 Z" fill="#1c2c55" stroke="#0c1530" stroke-width=".5"/>
    <path d="M8.2 5.4 L12 2.4 L15.8 5.4 V22 H8.2 Z" fill="none" stroke="#c9a23a" stroke-width=".45"/>
    <circle cx="12" cy="4.6" r="1.3" fill="#e9c75a" stroke="#7d5410" stroke-width=".35"/>
    <path d="${Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 1.05 : 2.5; return `${k ? 'L' : 'M'}${f(12 + Math.cos(a) * r)} ${f(9.6 + Math.sin(a) * r)}`; }).join(' ')} Z" fill="#f3d266" stroke="#9a6e14" stroke-width=".3"/>
    ${[14.2, 16.2, 18.2, 20.2].map((y) => `<rect x="7.4" y="${y}" width="9.2" height="1.15" fill="#e9c75a"/><rect x="7.4" y="${y}" width="9.2" height=".35" fill="#fff4b8" opacity=".7"/>`).join('')}
    <path d="M8.6 6 v15.6" stroke="#3a4f86" stroke-width=".5" opacity=".6"/></g>`,
};
// Contenu du disque d'une médaille : le dessin s'il existe, sinon l'émoji du haut fait.
export const deedIcon = (id, emoji) => (Object.hasOwn(DEED_ART, id) ? `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${DEED_ART[id]()}</svg>` : emoji);

export function honourSVG(kind, id, { size = 64, dim = false } = {}) {
  const art = (kind === 'evil' ? GRIM_ART : TROPHY_ART)[id];
  const u = uid();
  const inner = art ? art(u) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="${Math.round(size * 0.75)}" height="${size}" role="img" aria-hidden="true">${defs(u)}${dim ? `<g opacity=".2" style="filter:grayscale(1)">${inner}</g>` : inner}</svg>`;
}
// Un dessin à poser dans une autre image (étagère du bureau) : x, y = coin haut gauche, h = hauteur.
export function honourPlaced(kind, id, x, y, h) {
  const art = (kind === 'evil' ? GRIM_ART : TROPHY_ART)[id];
  if (!art) return '';
  const u = uid();
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${(h / 64).toFixed(4)})">${defs(u)}${art(u)}</g>`;
}
