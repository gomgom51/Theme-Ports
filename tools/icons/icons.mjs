// Icônes du jeu (police PdaIcons) : vectoriel sur une grille de 64, contour encre, aplat + une ombre + un reflet.
// Chaque dessin remplace un émoji du code (voir cps.mjs). Construire : node tools/icons/build.mjs
const K = '#1c2a33';
const C = {
  brass: ['#c48f25', '#e6b23d', '#f6d679'], red: ['#872c28', '#c4362c', '#e0705f'], navy: ['#172839', '#2b4d6e', '#5e7689'],
  blue: ['#2c5784', '#3b78b8', '#8fb6dc'], green: ['#2f6840', '#3f9150', '#7dbb82'], white: ['#cdccc0', '#f4efe2', '#ffffff'],
  steel: ['#647078', '#8f9aa0', '#c0c7ca'], wood: ['#843f1a', '#a6582a', '#c57944'], card: ['#b49a62', '#d8c79a', '#efe3c0'],
  oil: ['#1f272d', '#2e383f', '#56636c'], sea: ['#4f8fb5', '#79a8bf', '#a3c2d1'], orange: ['#9c3f10', '#d45f1b', '#f39a4c'],
  coffee: ['#3b2014', '#5a3320', '#7a4a2c'], teal: ['#1a6365', '#1f8a88', '#55a49d'],
};
const GREY = ['#555e64', '#8b959b', '#bcc4c8'];
const S = (w = 3) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
let uid = 0;
// Forme pleine avec contour, plus ombre (côté bas-droit) et reflet découpés dans la forme.
function shape(d, col, { shade, light, w = 3 } = {}) {
  const id = 'c' + (++uid);
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${col[1]}"/>` +
    (shade ? `<path d="${shade}" fill="${col[0]}" clip-path="url(#${id})"/>` : '') +
    (light ? `<path d="${light}" fill="${col[2]}" clip-path="url(#${id})"/>` : '') +
    `<path d="${d}" fill="none" ${S(w)}/>`;
}
const rect = (x, y, w, h, r = 0) => `M${x + r} ${y}H${x + w - r}${r ? `Q${x + w} ${y} ${x + w} ${y + r}` : ''}V${y + h - r}${r ? `Q${x + w} ${y + h} ${x + w - r} ${y + h}` : ''}H${x + r}${r ? `Q${x} ${y + h} ${x} ${y + h - r}` : ''}V${y + r}${r ? `Q${x} ${y} ${x + r} ${y}` : ''}Z`;
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;


// Médaillon : liseré de laiton, perles, disque émaillé (couleur du chemin de victoire) et reflet.
function medal(dark, light) {
  const id = 'm' + (++uid);
  let beads = '';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; beads += `<circle cx="${(32 + Math.cos(a) * 28.1).toFixed(2)}" cy="${(32 + Math.sin(a) * 28.1).toFixed(2)}" r="1.1" fill="${C.brass[2]}"/>`; }
  return `<circle cx="32" cy="32" r="30" fill="${C.brass[1]}"/><path d="M32 2A30 30 0 0 1 62 32H54A22 22 0 0 0 32 10Z" fill="${C.brass[2]}" opacity="0.0"/>` +
    `<clipPath id="${id}"><circle cx="32" cy="32" r="30"/></clipPath><path d="M40 0L64 0V64H20Z" fill="${C.brass[0]}" clip-path="url(#${id})"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" ${S(3)}/>` + beads +
    `<circle cx="32" cy="32" r="25.8" fill="${dark}" ${S(2.6)}/>` +
    `<clipPath id="${id}b"><circle cx="32" cy="32" r="24.4"/></clipPath><circle cx="27" cy="25" r="16" fill="${light}" clip-path="url(#${id}b)"/>`;
}
// Éclat à quatre branches (curiosité : la médaille brille).
const sparkle = (x, y, r) => `<path d="M${x} ${y - r * 2.2}Q${x + r * 0.35} ${y - r * 0.35} ${x + r * 2.2} ${y}Q${x + r * 0.35} ${y + r * 0.35} ${x} ${y + r * 2.2}Q${x - r * 0.35} ${y + r * 0.35} ${x - r * 2.2} ${y}Q${x - r * 0.35} ${y - r * 0.35} ${x} ${y - r * 2.2}Z" fill="#fffbe8"/>`;

const ANCHOR = '<circle cx="32" cy="9" r="5"/><path d="M32 14V57M13 21H51M10 38Q14 56 32 57Q50 56 54 38M10 38L6 44M10 38L16 42M54 38L58 44M54 38L48 42"/>';
const DIGIT = { 1: 'M29 35L33 32V50', 2: 'M27.5 36Q27.5 32 32 32Q36.5 32 36.5 36Q36.5 39.5 27.5 50H37', 3: 'M27.5 34.5Q28.5 32 32 32Q36.5 32 36.5 36Q36.5 40 32 40.5Q36.8 41 36.8 45.5Q36.8 50 32 50Q28.5 50 27.3 47.5' };
function medalRank(n, col) {
  return `<path d="M18 4L28 30L36 30L26 4Z" fill="${C.blue[1]}" ${S(2.4)}/><path d="M46 4L36 30L28 30L38 4Z" fill="${C.red[1]}" ${S(2.4)}/>` +
    shape(circ(32, 41, 18), col, { shade: 'M32 41L60 20V64H18Z', light: 'M18 38Q19 28 28 25Q22 31 22 40Z' }) +
    `<circle cx="32" cy="41" r="13.5" fill="none" stroke="${col[0]}" stroke-width="2"/>` +
    `<path d="${DIGIT[n]}" transform="translate(0 0)" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export const EM = {
  // Médaillons de victoire : disque émaillé (rouge, blanc, violet, noir), liseré de laiton perlé, éclat en haut à droite.
  vic_domination: () => medal('#8f2a24', '#b8392f') + `<g transform="translate(32 32) scale(1.06) translate(-32 -32.5)">` +
    shape(circ(32, 44, 10.5), C.sea, { shade: 'M32 30H50V60H32Z', light: 'M24 40Q26 35 31 34.5Q27 38 26.5 43Z' }) +
    `<path d="M25 41.5Q29 39 32 41T38 43M27 48Q31 46.5 35 48.5" fill="none" stroke="${C.green[1]}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M32 44V14" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M32 44V14" stroke="${C.brass[2]}" stroke-width="2"/>` +
    shape('M33 15H49L44.5 20.5L49 26H33Z', C.blue, { shade: 'M33 22H50V27H33Z', light: 'M34.5 16.5H44V18H34.5Z' }) +
    shape(circ(32, 13, 2.6), C.brass) + `</g>`,
  vic_reputation: () => medal('#e2d9c4', '#fbf7ec') + `<g transform="translate(32 32) scale(1.14) translate(-32 -32)">` +
    `<g fill="${C.green[1]}" stroke="${K}" stroke-width="1.8">` +
    [0, 1, 2, 3].map((i) => `<ellipse cx="${17 - i * 0.6}" cy="${44 - i * 8}" rx="2.6" ry="4.6" transform="rotate(${-30 + i * 14} ${17 - i * 0.6} ${44 - i * 8})"/><ellipse cx="${47 + i * 0.6}" cy="${44 - i * 8}" rx="2.6" ry="4.6" transform="rotate(${30 - i * 14} ${47 + i * 0.6} ${44 - i * 8})"/>`).join('') + `</g>` +
    shape('M32 13L36.6 23.4L47.9 24.5L39.4 32L41.9 43.1L32 37.3L22.1 43.1L24.6 32L16.1 24.5L27.4 23.4Z', C.brass,
      { shade: 'M32 28L47.9 24.5L41.9 43.1L32 37.3Z', light: 'M32 16L29 24L21 25L27 26L32 18Z' }) + `</g>`,
  vic_legend: () => medal('#4b2c78', '#6a43a0') + `<g transform="translate(32 32) scale(1.14) translate(-32 -32)">` +
    shape('M20 16H44V24Q44 36 32 38Q20 36 20 24Z', C.brass, { shade: 'M33 14H46V40H33Z', light: 'M22.5 18H25V28Q24 24 22.5 22Z' }) +
    `<path d="M20 19Q13 19 13 25Q13 30 21 31M44 19Q51 19 51 25Q51 30 43 31" fill="none" stroke="${K}" stroke-width="5"/><path d="M20 19Q13 19 13 25Q13 30 21 31M44 19Q51 19 51 25Q51 30 43 31" fill="none" stroke="${C.brass[1]}" stroke-width="2"/>` +
    shape(rect(29, 37, 6, 6), C.brass, { shade: rect(32, 30, 4, 20) }) + shape(rect(23, 43, 18, 6, 1.5), C.wood, { shade: rect(32, 40, 12, 12) }) +
    sparkle(13, 13, 3.2) + sparkle(50, 38, 2.4) + `</g>`,
  vic_shadow: () => medal('#26272d', '#3d3e47') + `<g transform="translate(32 32) scale(1.14) translate(-32 -32)">` +
    `<g transform="rotate(9 32 46) translate(0 1.5)">` +
    shape('M29.6 25H34.4V44L32 48L29.6 44Z', C.steel, { shade: 'M32 23H36V50H32Z', light: rect(30.4, 26, 1.2, 15) }) +
    shape(rect(24, 21, 16, 4.6, 2.3), C.brass, { shade: rect(32, 23.3, 10, 4) }) +
    shape(rect(29.4, 12.5, 5.2, 9, 1.4), C.red, { shade: rect(32, 12, 4, 11) }) +
    `<path d="M29.4 15.5H34.6M29.4 18.5H34.6" stroke="${K}" stroke-width="1.3"/>` +
    shape(circ(32, 11.5, 2.8), C.brass) + `</g>` +
    shape('M11 44H53L51 52H13Z', C.wood, { shade: 'M0 49H64V60H0Z', light: rect(13, 45.2, 13, 1.8) }) +
    `<path d="M29.6 44.4L36 44.4" stroke="${K}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M20 50L22 47.5M43 51L45 48.5" stroke="${C.wood[0]}" stroke-width="1.6" stroke-linecap="round"/>` +
    sparkle(17, 21, 2.6) + `</g>`,
  appel: () => `<path d="M49 22Q54 26 54 32T49 42M53 17Q60 23 60 32T53 47" fill="none" stroke="${C.steel[0]}" stroke-width="3" stroke-linecap="round"/>` +
    shape('M12 24L40 11V53L12 40Z', C.red, { shade: 'M12 33H42V56H12Z', light: 'M14 26L36 15.5V18L14 28Z' }) +
    shape('M40 11Q46 12 46 32Q46 52 40 53Q34 52 34 32Q34 12 40 11Z', C.white, { shade: 'M40 30H48V55H40Z' }) +
    `<ellipse cx="40" cy="32" rx="3.2" ry="12" fill="${C.red[0]}"/>` +
    shape(rect(5, 23, 8, 18, 2.5), C.steel, { shade: rect(9, 20, 6, 24) }) +
    shape('M16 40L22 42.5L19 54Q18.5 56 16.5 55.4L13.5 54.4Q12 53.8 12.5 52Z', C.oil),
  // Voiture moderne vue de profil comme un vieux sprite : un SUV gris (choix du propriétaire).
  vehicules: () => {
    const wheel = (x, y) => `<path d="M${x - 10} ${y}A10 10 0 0 1 ${x + 10} ${y}Z" fill="${K}"/>` +
      shape(circ(x, y, 8), C.oil, {}) + shape(circ(x, y, 5.3), C.steel, { w: 1.4, shade: `M${x} ${y - 7}H${x + 7}V${y + 7}H${x}Z`, light: circ(x - 1.6, y - 1.6, 1.4) }) +
      `<path d="${[0, 72, 144, 216, 288].map((a) => { const r = (a - 90) * Math.PI / 180; return `M${x} ${y}L${(x + 4 * Math.cos(r)).toFixed(2)} ${(y + 4 * Math.sin(r)).toFixed(2)}`; }).join('')}" stroke="${C.steel[0]}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="${x}" cy="${y}" r="1.5" fill="${C.oil[1]}"/>`;
    return `<path d="M21 15H43" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/>` +
      shape('M5 43V31Q5 28 8 27.5L12.5 27L17.5 19Q19 17 21.5 17H43Q46 17 48 19.5L53 26.5L57.5 28Q60.5 29 60.5 33V43Q60.5 46 57.5 46H8Q5 46 5 43Z', GREY,
        { shade: 'M0 38.5H64V50H0Z', light: 'M8 30.5H54V32.2H8Z' }) +
      shape('M15 27L19.6 20.4Q20.4 19.3 21.8 19.3H42.6Q44.5 19.3 45.8 21L50 26.8H15Z', C.blue, { shade: 'M40 18H52V28H40Z', light: 'M21 27L25.5 19.5H27.6L23.1 27Z' }) +
      `<path d="M28.6 19V44M39.6 19V44" stroke="${K}" stroke-width="2"/><path d="M31 31.5H34.5M42 31.5H45.5" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M55 29.2L59.8 30.6" stroke="#fffbe8" stroke-width="2.4" stroke-linecap="round"/><path d="M5.6 30.6V34.4" stroke="#e0473a" stroke-width="2.4" stroke-linecap="round"/>` +
      wheel(16.5, 46) + wheel(49, 46);
  },

  alertes: () => shape(circ(32, 9, 4.5), C.brass, { light: circ(31, 8, 2) }) +
    shape('M32 12C21 12 17.5 21 17.5 31V39C17.5 43.5 13 46 10 49H54C51 46 46.5 43.5 46.5 39V31C46.5 21 43 12 32 12Z', C.brass,
      { shade: 'M38 10C46 16 48 30 48 39C48 44 54 46 56 50H40Z', light: 'M22 22C23 17 27 15 30 15C26 19 25 26 25 34V44H21V30Z' }) +
    shape(rect(7, 47, 50, 7, 3.5), C.brass, { shade: rect(0, 51, 64, 5), light: rect(10, 48.5, 24, 2, 1) }) +
    shape(circ(32, 58, 4.5), C.brass, { shade: circ(34, 60, 4) }),
  flotte: () => shape(rect(11, 8, 8, 13), C.orange, { shade: rect(16, 0, 8, 30), light: rect(0, 0, 13, 30) }) +
    shape(rect(11, 8, 8, 4), C.oil) +
    shape(rect(6, 20, 18, 21, 1.5), C.white, { shade: rect(20, 0, 10, 50) }) +
    `<path d="M9 25H21V29H9Z" fill="${C.blue[1]}" ${S(2)}/>` +
    shape(rect(24, 29, 10, 12), C.red, { shade: rect(31, 0, 10, 60) }) + shape(rect(34, 29, 10, 12), C.blue, { shade: rect(41, 0, 10, 60) }) +
    shape(rect(44, 29, 10, 12), C.brass, { shade: rect(51, 0, 10, 60) }) + shape(rect(29, 19, 10, 10), C.teal, { shade: rect(36, 0, 10, 60) }) +
    shape('M3 40H61L55 52H8Q4 52 3 47Z', C.navy, { shade: 'M0 47H64V64H0Z', light: rect(4, 41.5, 52, 2) }) +
    `<path d="M5 47.5H58" stroke="${C.red[1]}" stroke-width="3"/>` +
    `<path d="M4 58Q10 54 16 58T28 58T40 58T52 58T62 58" fill="none" stroke="${C.sea[0]}" stroke-width="3" stroke-linecap="round"/>`,
  boutique: () => shape('M6 8H58V22H6Z', C.white) +
    `<path d="M10 8H18V22H10ZM26 8H34V22H26ZM42 8H50V22H42Z" fill="${C.red[1]}"/>` +
    shape('M6 8H58V22Q54 27 50 22Q46 27 42 22Q38 27 34 22Q30 27 26 22Q22 27 18 22Q14 27 10 22Q8 25 6 22Z', C.red, {}).replace(/fill="#c4362c"/, 'fill="none"') +
    shape(rect(8, 25, 48, 31, 2), C.wood, { shade: rect(50, 0, 10, 64) }) +
    shape(rect(13, 30, 38, 20, 1), C.sea, { shade: rect(0, 44, 64, 10), light: rect(15, 31.5, 20, 2) }) +
    shape(rect(30, 33, 4, 5), C.red) + shape(rect(26, 37, 10, 4), C.white) +
    shape('M18 41H47L44 46H21Z', C.navy) +
    shape(rect(5, 55, 54, 5, 1.5), C.wood, { shade: rect(0, 58, 64, 4) }),
  bureau: () => `<path d="M31 3V16" stroke="${K}" stroke-width="2.6"/>` + shape('M32 3.5H43L40 7L43 10.5H32Z', C.red) +
    shape(rect(8, 16, 48, 7, 1.5), C.card, { shade: rect(0, 20, 64, 5) }) +
    shape(rect(11, 23, 42, 34), C.wood, { shade: rect(46, 0, 10, 64), light: rect(12.5, 24.5, 3, 30) }) +
    [17, 29, 41].map((x) => shape(rect(x, 27, 6, 8, 1), C.blue, { light: rect(x, 27, 2.5, 8) }) + shape(rect(x, 39, 6, 8, 1), C.blue, { light: rect(x, 39, 2.5, 8) })).join('') +
    shape('M27 57V50Q32 45 37 50V57Z', C.coffee) +
    shape(rect(5, 56, 54, 5, 1.5), C.steel, { shade: rect(0, 59, 64, 4) }),
  marches: () => shape(rect(6, 6, 52, 44, 3), C.wood, { shade: rect(52, 0, 10, 64) }) +
    shape(rect(11, 11, 42, 34, 1), C.white, { shade: rect(0, 40, 64, 10) }) +
    shape(rect(15, 33, 7, 10), C.red, { shade: rect(19, 0, 5, 64) }) + shape(rect(26, 26, 7, 17), C.brass, { shade: rect(30, 0, 5, 64) }) +
    shape(rect(37, 18, 7, 25), C.green, { shade: rect(41, 0, 5, 64) }) +
    `<path d="M15 26L27 18L34 21L47 13" fill="none" stroke="${C.green[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    shape('M42 11L50 11L49 19Z', C.green) +
    `<path d="M20 50L16 59M44 50L48 59" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`,
  journal: () => shape('M10 8H50V54H14Q10 54 10 50Z', C.white, { shade: rect(44, 0, 10, 64) }) +
    shape('M50 14H56V50Q56 54 52 54H50Z', C.white, { shade: rect(53, 0, 5, 64) }) +
    `<rect x="15" y="13" width="30" height="7" fill="${K}"/>` +
    shape(rect(15, 25, 14, 11), C.blue, { light: rect(15, 25, 14, 4) }) +
    `<path d="M33 26H45M33 31H45M33 36H45M15 42H45M15 47H38" stroke="${C.steel[0]}" stroke-width="2.6" stroke-linecap="round"/>`,
  confiance: () => {
    const link = (x, y, part) => `<g ${part || ''}><rect x="${x}" y="${y}" width="30" height="24" rx="11" fill="none" stroke="${K}" stroke-width="12"/>` +
      `<rect x="${x}" y="${y}" width="30" height="24" rx="11" fill="none" stroke="${C.blue[1]}" stroke-width="6"/>` +
      `<path d="M${x + 6} ${y - 1.5}H${x + 22}" stroke="${C.blue[2]}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M${x + 31.5} ${y + 8}V${y + 18}" stroke="${C.blue[0]}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    return `<clipPath id="ch1"><rect x="20" y="30" width="20" height="16"/></clipPath>` + link(7, 13) + link(27, 29) + link(7, 13, 'clip-path="url(#ch1)"');
  },
  vertu: () => shape('M32 55C20 46 7 37 7 23C7 14 13.5 9 20.5 9C26 9 30 12 32 16C34 12 38 9 43.5 9C50.5 9 57 14 57 23C57 37 44 46 32 55Z', C.green,
    { shade: 'M64 14C60 34 46 46 32 56L64 64Z', light: 'M11 22C11 15 15.5 12 20.5 12C24 12 26 13.5 27 15C21 15 15.5 18 15 26Z' }),
  etoile: () => shape('M32 4L39.6 21.6L58.6 23.3L44.2 35.9L48.5 54.6L32 44.8L15.5 54.6L19.8 35.9L5.4 23.3L24.4 21.6Z', C.brass,
    { shade: 'M32 30L58.6 23.3L48.5 54.6L32 44.8Z', light: 'M32 9L27 22.5L12 24L22 25L32 12Z' }),
  embargo: () => shape(rect(29, 10, 6, 40), C.brass, { shade: rect(32, 0, 4, 64) }) + shape(circ(32, 9, 4.5), C.brass) +
    shape(rect(8, 14, 48, 5.5, 2.75), C.brass, { shade: rect(0, 17, 64, 4) }) +
    `<path d="M12 19L5 37M12 19L19 37M52 19L45 37M52 19L59 37" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>` +
    shape('M3 37H21Q20 45 12 45Q4 45 3 37Z', C.red, { shade: 'M12 37H22V48H12Z' }) + shape('M43 37H61Q60 45 52 45Q44 45 43 37Z', C.red, { shade: 'M52 37H62V48H52Z' }) +
    shape('M20 57Q20 50 32 50Q44 50 44 57Z', C.brass, { shade: 'M32 48H46V58H32Z' }),
  cereales: () => {
    const ear = (x, y, a) => {
      let k = '';
      for (let i = 0; i < 3; i++) k += `<ellipse cx="-3.3" cy="${i * 6.5}" rx="3.7" ry="4.8" transform="rotate(-25 -3.3 ${i * 6.5})"/><ellipse cx="3.3" cy="${i * 6.5}" rx="3.7" ry="4.8" transform="rotate(25 3.3 ${i * 6.5})"/>`;
      k += `<ellipse cx="0" cy="-5" rx="3.5" ry="4.8"/>`;
      return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 16V36" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M0 16V36" stroke="${C.brass[0]}" stroke-width="2" stroke-linecap="round"/>` +
        `<g fill="${C.brass[1]}" stroke="${K}" stroke-width="2.2">${k}</g></g>`;
    };
    return ear(17, 17, -24) + ear(47, 17, 24) + ear(32, 12, 0) +
      `<path d="M27 46L20 60M32 46V61M37 46L44 60" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M27 46L20 60M32 46V61M37 46L44 60" stroke="${C.brass[0]}" stroke-width="2" stroke-linecap="round"/>` +
      shape(rect(24, 41, 16, 6, 1.5), C.red);
  },
  brut: () => shape('M14 9Q14 5 32 5Q50 5 50 9V55Q50 59 32 59Q14 59 14 55Z', C.oil, { shade: rect(41, 0, 12, 64), light: rect(17, 10, 4, 44) }) +
    `<path d="M14 9Q14 13 32 13Q50 13 50 9M14 24Q32 28 50 24M14 42Q32 46 50 42" fill="none" ${S(2.6)}/>` +
    shape('M32 26Q38 34 38 38Q38 43 32 43Q26 43 26 38Q26 34 32 26Z', C.white),
  raffines: () => shape(rect(10, 8, 26, 46, 3), C.red, { shade: rect(30, 0, 10, 64), light: rect(12, 10, 3, 42) }) +
    shape(rect(14, 13, 18, 11, 1.5), C.white) + `<path d="M18 18.5H28" stroke="${K}" stroke-width="2.6"/>` +
    shape(rect(16, 30, 14, 10, 1.5), C.white, {}) + `<path d="M20 35H26" stroke="${C.red[1]}" stroke-width="3"/>` +
    `<path d="M36 18H44Q49 18 49 23V42Q49 46 45 46H40" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M36 18H44Q49 18 49 23V42Q49 46 45 46H40" fill="none" stroke="${C.oil[2]}" stroke-width="2.4" stroke-linecap="round"/>` +
    shape('M44 10H54L52 22H46Z', C.oil) +
    shape(rect(6, 53, 34, 6, 1.5), C.steel, { shade: rect(0, 56.5, 64, 5) }),
  manufactures: () => shape('M6 22L32 12L58 22V46L32 56L6 46Z', C.card) +
    `<path d="M6 22L32 32L58 22V46L32 56V32" fill="${C.card[0]}"/><path d="M32 32L58 22V46L32 56Z" fill="#a6582a" opacity="0.55"/>` +
    `<path d="M6 22L32 32L58 22M32 32V56" fill="none" ${S(2.6)}/>` +
    `<path d="M19 17L45 27V36" fill="none" stroke="${C.card[2]}" stroke-width="5"/><path d="M19 17L45 27V36" fill="none" stroke="${K}" stroke-width="1.4" opacity="0.6"/>` +
    `<path d="M6 22L32 12L58 22V46L32 56L6 46Z" fill="none" ${S(3)}/>` +
    `<path d="M12 36L16 34.5M12 41L20 38" stroke="${K}" stroke-width="2.2" stroke-linecap="round"/>`,
  cafe: () => `<path d="M24 6Q20 10 24 14T24 22M36 6Q32 10 36 14T36 22" fill="none" stroke="${C.steel[1]}" stroke-width="3" stroke-linecap="round"/>` +
    shape('M43 31Q53 31 53 38Q53 46 42 46', C.white, {}).replace(/fill="#f4efe2"/, 'fill="none"').replace('stroke-width="3"', 'stroke-width="9"') +
    `<path d="M43 31Q53 31 53 38Q53 46 42 46" fill="none" stroke="${C.white[1]}" stroke-width="3.5"/>` +
    shape('M10 26H46V38Q46 52 28 52Q10 52 10 38Z', C.white, { shade: 'M36 26H50V54H30Z', light: rect(13, 30, 3, 14) }) +
    shape(rect(10, 26, 36, 5, 2), C.coffee) +
    shape('M4 52H52Q50 58 28 58Q6 58 4 52Z', C.white, { shade: 'M0 55H64V64H0Z' }),
  fruits: () => {
    const d = 'M15 13C15 33 28 50 50 51C55 51 57 48 54 46C36 43 25 31 22 13Z';
    const ban = (r) => `<g transform="rotate(${r} 17 12)">` + shape(d, C.brass, { shade: 'M22 30C30 42 40 47 56 47L58 56L20 56Z', light: 'M16.5 16C17 26 20 33 24 38L19 24Z' }) +
      `<path d="M52 46.5L57 47.5" stroke="${C.coffee[1]}" stroke-width="3" stroke-linecap="round"/></g>`;
    const FAT = ['#d8bfac', '#f4e4d7', '#fff7ef'], MEAT = ['#7e1f1c', '#b8352d', '#de6b5d'];
    // Le steak, posé à côté du régime : liseré de gras, persillé et petit os.
    return `<g transform="translate(-3 -2) scale(0.74)">` + ban(-14) + ban(4) + ban(22) + shape('M13 4H21L22 15H14Z', C.green, { shade: rect(18, 0, 6, 20) }) + `</g>` +
      `<g transform="rotate(-12 44 46)">` +
      shape('M25 45C24 37 31 32 38 33C43 33.6 46 30.5 51.5 30.5C58 30.5 62.5 35.5 61.5 42.5C60.5 51.5 52.5 58 42 58C32.5 58 26 52.5 25 45Z', FAT, { shade: 'M46 26H66V62H42Z', light: 'M28 42C29 37.5 32.5 35.4 36.5 35.6C33 37.5 31 40 30.5 44Z' }) +
      shape('M29.5 45C29 39.5 33.5 36.6 38.5 37.2C43.5 37.8 46.5 34.6 51.5 34.6C56 34.6 58.3 38.2 57.6 43C56.8 50 50.6 54.2 42.2 54.2C35 54.2 30 50.6 29.5 45Z', MEAT,
        { shade: 'M48 32H62V58H46Z', light: 'M32.5 44.5C32.5 41.5 34.5 39.6 37.5 39.8C35.4 41.4 34.6 43 34.6 45.6Z', w: 2.4 }) +
      `<path d="M45 41Q48.5 42.6 52.5 41M46.5 49.5Q50 48 54 49.6M38 49.5Q40 51 42.5 50.6" fill="none" stroke="${MEAT[2]}" stroke-width="1.6" stroke-linecap="round"/>` +
      shape(circ(39, 44.6, 3.6), FAT, { w: 2 }) + `<circle cx="39" cy="44.6" r="1.4" fill="${FAT[0]}"/></g>`;
  },
  minerai: () => shape('M5 52Q8 38 18 33L27 26Q33 22 39 26L48 32Q57 38 59 52Z', C.wood, { shade: 'M34 24H64V56H34Z', light: 'M10 46Q13 38 19 35L17 42Z' }) +
    shape('M17 40L25 34L31 40L26 47L18 47Z', C.wood, { shade: 'M24 41H34V50H24Z' }) + shape('M33 31L41 29L46 36L40 41L33 38Z', C.wood, { shade: 'M40 34H48V43H40Z' }) +
    shape('M36 44L44 42L50 48L44 52L37 51Z', C.wood, { shade: 'M44 46H52V54H44Z' }) +
    `<path d="M21 38L23 37M38 32L40 31.5M41 46L43 45.5" stroke="${C.steel[2]}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M4 52H60" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`,
  charbon: () => [[6, 52, 'M6 52L10 40L20 36L28 42L27 52Z'], [0, 0, 'M24 52L27 38L37 32L47 37L48 52Z'], [0, 0, 'M42 52L44 41L53 38L59 45L58 52Z'],
    [0, 0, 'M17 39L21 27L31 24L37 31L32 39L22 41Z'], [0, 0, 'M35 31L39 21L47 19L52 25L49 33L41 35Z']]
    .map(([, , d]) => shape(d, C.oil, { shade: 'M30 0L64 0V64H44Z', light: '' })).join('') +
    `<path d="M12 42L18 39M28 40L34 35M24 29L29 27M41 23L45 22M46 42L51 40" stroke="${C.steel[1]}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M4 52H60" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`,
  engrais: () => shape('M18 18Q14 30 13 44Q13 56 32 56Q51 56 51 44Q50 30 46 18Z', C.white, { shade: 'M38 14H56V60H38Z', light: 'M17 30Q16 38 16.5 46L20 44Q19 36 20.5 28Z' }) +
    shape('M20 18L26 9H38L44 18Z', C.white, { shade: 'M33 6H46V20H33Z' }) +
    `<path d="M24 13L40 13" stroke="${C.wood[0]}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M32 47V33" stroke="${C.green[0]}" stroke-width="3" stroke-linecap="round"/>` +
    shape('M32 37Q26 37 23 31Q29 29 32 35Z', C.green) + shape('M32 34Q36 28 42 28Q41 35 32 37Z', C.green),
  machines: () => {
    let d = '';
    const n = 9, r1 = 21, r2 = 27;
    for (let i = 0; i < n * 2; i++) {
      const a0 = (i / (n * 2)) * Math.PI * 2 - 0.12, a1 = ((i + 1) / (n * 2)) * Math.PI * 2 + 0.12, r = i % 2 ? r1 : r2;
      const aa = i % 2 ? [a0 + 0.12, a1 - 0.12] : [a0 + 0.14, a1 - 0.14];
      d += `${i ? 'L' : 'M'}${(32 + Math.cos(aa[0]) * r).toFixed(2)} ${(32 + Math.sin(aa[0]) * r).toFixed(2)}L${(32 + Math.cos(aa[1]) * r).toFixed(2)} ${(32 + Math.sin(aa[1]) * r).toFixed(2)}`;
    }
    return shape(d + 'Z', C.steel, { shade: 'M32 32L64 10V64H10Z', light: 'M14 30Q16 18 28 14L27 19Q19 22 18 31Z' }) +
      shape(circ(32, 32, 11), C.steel, { shade: 'M32 32L50 20V50H20Z' }) + shape(circ(32, 32, 5.5), C.white);
  },
  acier: () => {
    // Poutre en I vue de trois quarts : profil devant, longueur qui file vers l'arrière.
    const v = [26, -16], P = (pts) => 'M' + pts.map((q) => q.join(' ')).join('L') + 'Z';
    const off = ([x, y]) => [x + v[0], y + v[1]];
    const face = (pts, col) => `<path d="${P(pts)}" fill="${col}" ${S(2.6)}/>`;
    return face([[19.5, 39], [19.5, 51], off([19.5, 51]), off([19.5, 39])], C.steel[0]) +
      face([[19.5, 51], [28, 51], off([28, 51]), off([19.5, 51])], C.steel[2]) +
      face([[28, 51], [28, 56], off([28, 56]), off([28, 51])], C.steel[0]) +
      face([[28, 34], [28, 39], off([28, 39]), off([28, 34])], C.steel[0]) +
      face([[6, 34], [28, 34], off([28, 34]), off([6, 34])], C.steel[2]) +
      face([[6, 34], [28, 34], [28, 39], [19.5, 39], [19.5, 51], [28, 51], [28, 56], [6, 56], [6, 51], [14.5, 51], [14.5, 39], [6, 39]], C.steel[1]) +
      `<path d="M9 36.5H25" stroke="${C.steel[2]}" stroke-width="1.6" stroke-linecap="round"/>`;
  },
  bois: () => {
    const END = ['#c49a5e', '#e6c88f', '#f6e2b6'];
    const log = (x, y, r) => {
      const rx = r * 0.72, dx = 24, dy = -11;
      const body = `M${x} ${y - r}L${x + dx} ${y - r + dy}A${rx} ${r} 0 0 1 ${x + dx} ${y + r + dy}L${x} ${y + r}Z`;
      const ell = `M${x - rx} ${y}a${rx} ${r} 0 1 0 ${2 * rx} 0a${rx} ${r} 0 1 0 ${-2 * rx} 0Z`;
      return shape(body, C.wood, { shade: `M${x} ${y + 1}L${x + dx} ${y + dy + 1}L${x + dx + rx + 3} ${y + dy + r + 3}L${x} ${y + r + 3}Z`, light: `M${x} ${y - r + 1.6}L${x + dx} ${y - r + dy + 1.6}V${y - r + dy + 3.4}L${x} ${y - r + 3.4}Z` }) +
        `<path d="M${x + 9} ${y - 1.6}L${x + 16} ${y - 4.8}M${x + 12} ${y + 4}L${x + 20} ${y + 0.4}" stroke="${C.wood[0]}" stroke-width="1.5" stroke-linecap="round"/>` +
        shape(ell, END, { light: `M${x - rx} ${y - r}H${x}V${y}H${x - rx}Z`, w: 2.6 }) +
        `<ellipse cx="${x}" cy="${y}" rx="${(rx * 0.55).toFixed(2)}" ry="${(r * 0.55).toFixed(2)}" fill="none" stroke="${END[0]}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="1.3" fill="${C.wood[0]}"/>`;
    };
    return log(14, 47, 8.5) + log(30, 47, 8.5) + log(22, 32.5, 8.5);
  },
  chimie: () => shape('M26 6H38V22L52 50Q54 56 48 56H16Q10 56 12 50L26 22Z', C.white, { shade: 'M36 4H56V58H36Z', light: 'M28 9H30V23L18 47H16Z' }) +
    `<clipPath id="fl"><path d="M26 6H38V22L52 50Q54 56 48 56H16Q10 56 12 50L26 22Z"/></clipPath>` +
    `<path d="M0 38H64V64H0Z" fill="#7a55a0" clip-path="url(#fl)"/><path d="M38 38H64V64H38Z" fill="#564074" clip-path="url(#fl)"/>` +
    `<path d="M26 6H38V22L52 50Q54 56 48 56H16Q10 56 12 50L26 22Z" fill="none" ${S(3)}/>` +
    `<path d="M14.5 38H49.5" stroke="${K}" stroke-width="2.2"/>` +
    shape(rect(23, 4, 18, 5, 2), C.white) +
    `<circle cx="26" cy="47" r="2.6" fill="#baa4c6"/><circle cx="34" cy="43" r="1.8" fill="#baa4c6"/><circle cx="31" cy="30" r="2" fill="${C.white[2]}" ${S(1.6)}/><circle cx="35" cy="16" r="1.6" fill="${C.white[2]}" ${S(1.4)}/>`,
  gpl: () => shape(rect(24, 4, 16, 6, 1.5), C.steel) + shape(rect(28, 9, 8, 6), C.steel, { shade: rect(32, 8, 5, 8) }) +
    shape('M16 24Q16 14 32 14Q48 14 48 24V52H16Z', C.orange, { shade: 'M38 12H52V54H38Z', light: 'M19 24Q19 18 26 17Q22 21 22 26V50H19Z' }) +
    shape(rect(16, 30, 32, 9), C.white, { shade: rect(38, 28, 12, 12) }) +
    shape('M18 52H46L48 59H16Z', C.oil),
  gnl: () => shape('M32 5Q50 27 50 40Q50 57 32 57Q14 57 14 40Q14 27 32 5Z', C.blue, { shade: 'M38 14H56V60H32Q50 50 38 14Z', light: 'M22 32Q20 40 21 46L18 44Q17 36 22 32Z' }) +
    `<g stroke="${C.white[2]}" stroke-width="3.2" stroke-linecap="round"><path d="M32 30V52M22.5 35.5L41.5 46.5M22.5 46.5L41.5 35.5"/></g>` +
    `<g stroke="${C.white[2]}" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M28.5 31.5L32 34L35.5 31.5M28.5 50.5L32 48L35.5 50.5"/></g>`,
  colis: () => `<path d="M32 17L15 30M32 17L49 30" stroke="${K}" stroke-width="2.4"/>` +
    `<g fill="none" stroke-linecap="round"><path d="M32 2V9Q32 17 37 17Q41 17 41 12" stroke="${K}" stroke-width="7"/><path d="M32 2V9Q32 17 37 17Q41 17 41 12" stroke="${C.steel[2]}" stroke-width="3"/></g>` +
    shape(rect(10, 29, 44, 29, 2), C.wood, { shade: rect(46, 26, 10, 34), light: rect(12, 31, 40, 2.4) }) +
    `<path d="M10 39H54M10 48H54" stroke="${C.wood[0]}" stroke-width="2.2"/>` +
    shape(rect(18, 29, 5, 29), C.steel, {}) + shape(rect(41, 29, 5, 29), C.steel, {}),
  medaille1: () => medalRank('1', C.brass), medaille2: () => medalRank('2', ['#7d878e', '#b9c2c7', '#eef2f3']), medaille3: () => medalRank('3', ['#7a4a26', '#b06c3c', '#d99a68']),
  aide: () => shape('M32 55C20 46 7 37 7 23C7 14 13.5 9 20.5 9C26 9 30 12 32 16C34 12 38 9 43.5 9C50.5 9 57 14 57 23C57 37 44 46 32 55Z', C.red,
    { shade: 'M64 14C60 34 46 46 32 56L64 64Z', light: 'M11 22C11 15 15.5 12 20.5 12C24 12 26 13.5 27 15C21 15 15.5 18 15 26Z' }) +
    shape('M27 19H37V26H44V36H37V43H27V36H20V26H27Z', C.white, { w: 2.6 }),
  dossier: () => shape(rect(10, 9, 44, 51, 4), C.wood, { shade: rect(46, 6, 10, 56) }) +
    shape(rect(15, 15, 34, 40, 1), C.white, { shade: rect(44, 12, 6, 46) }) +
    `<path d="M20 27H44M20 34H44M20 41H36" stroke="${C.steel[0]}" stroke-width="2.8" stroke-linecap="round"/>` +
    shape('M22 6H42V15H22Z', C.brass, { shade: rect(32, 4, 12, 13) }) + shape(circ(32, 7, 3), C.brass),
  eco: () => `<path d="M14 57Q24 40 46 14" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M14 57Q24 40 46 14" fill="none" stroke="${C.green[0]}" stroke-width="2" stroke-linecap="round"/>` +
    shape('M45 15Q56 6 58 6Q58 20 46 22Q42 21 45 15Z', C.green, { shade: 'M44 22L60 6V24Z' }) +
    shape('M33 30Q30 16 40 10Q44 22 36 32Z', C.green, { shade: 'M37 10H46V34H37Z' }) + shape('M36 33Q48 26 56 30Q50 42 37 37Z', C.green, { shade: 'M36 35H58V44H36Z' }) +
    shape('M22 44Q16 32 22 24Q30 34 25 46Z', C.green, { shade: 'M24 22H32V48H24Z' }) + shape('M25 46Q34 38 44 42Q38 52 26 49Z', C.green, { shade: 'M24 47H46V54H24Z' }),
  glace: () => {
    const arm = `<path d="M32 32V6M32 13L26 8M32 13L38 8M32 21L25 16M32 21L39 16"/>`;
    const arms = [0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a} 32 32)">${arm}</g>`).join('');
    return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${K}" stroke-width="7.5">${arms}</g><g stroke="#cfe6f5" stroke-width="3.2">${arms}</g></g>` +
      shape(circ(32, 32, 5), { 0: '#7fb2d6', 1: '#cfe6f5', 2: '#ffffff' });
  },
  danger: () => shape('M32 5Q35 5 37 8.5L60 50Q62 56 56 56H8Q2 56 4 50L27 8.5Q29 5 32 5Z', C.brass, { shade: 'M32 28L64 56H32Z', light: 'M29 12L10 48H14L31 15Z' }) +
    shape('M29 20H35L34 39H30Z', C.oil, { w: 2 }) + shape(circ(32, 46.5, 3.4), C.oil, { w: 2 }),
  ancre: () => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${K}" stroke-width="9.5">${ANCHOR}</g><g stroke="#2b4d6e" stroke-width="4.6">${ANCHOR}</g></g>` +
    `<circle cx="13" cy="21" r="4" fill="#2b4d6e" ${S(2.6)}/><circle cx="51" cy="21" r="4" fill="#2b4d6e" ${S(2.6)}/>`,
};
export { K, C, S, shape, rect, circ, sparkle };
export const svgOf = (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${EM[name]()}</svg>`;
