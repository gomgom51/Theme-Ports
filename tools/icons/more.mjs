// Série 2 : risques, police, armes, affaires noires ; puis affaires, personnes, équipement, médias.
import { K, C, S, shape, rect, circ, sparkle } from './icons.mjs';

const BONE = ['#c9bfa6', '#f1ead6', '#ffffff'];
const YEL = ['#c48f25', '#f2c230', '#fbe38a'];
const rot = (a, cx, cy, body) => `<g transform="rotate(${a} ${cx} ${cy})">${body}</g>`;
// Os : trait épais encré, bouts arrondis en double bosse.
const bone = (x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 3.2, ny = dx / L * 3.2, ux = dx / L * 2, uy = dy / L * 2;
  const knobs = [[x1 - ux, y1 - uy], [x2 + ux, y2 + uy]].flatMap(([x, y]) => [[x + nx, y + ny], [x - nx, y - ny]]);
  const k = (col, r) => knobs.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="${col}"/>`).join('');
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${K}" stroke-width="9" stroke-linecap="round"/>` + k(K, 5.1) +
    `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${BONE[1]}" stroke-width="4" stroke-linecap="round"/>` + k(BONE[1], 2.9);
};
const SKULL = 'M32 8C21 8 15 16 15 25C15 31 18 35 22 37V44Q22 47 25 47H39Q42 47 42 44V37C46 35 49 31 49 25C49 16 43 8 32 8Z';
const skullFace = () => `<ellipse cx="25" cy="26" rx="4.8" ry="5.2" fill="${K}"/><ellipse cx="39" cy="26" rx="4.8" ry="5.2" fill="${K}"/>` +
  `<path d="M32 31.5L29.6 36H34.4Z" fill="${K}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
  `<path d="M28 41V47M32 41V47M36 41V47" stroke="${K}" stroke-width="2"/>`;
// Étincelle de mèche : étoile orange à cœur jaune.
const spark = (x, y, r) => {
  const pts = (rr, rin) => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, q = i % 2 ? rin : rr; return `${(x + q * Math.cos(a)).toFixed(2)} ${(y + q * Math.sin(a)).toFixed(2)}`; }).join('L');
  return `<path d="M${pts(r, r * 0.45)}Z" fill="${C.orange[1]}" ${S(2)}/><path d="M${pts(r * 0.55, r * 0.25)}Z" fill="#fbe38a"/>`;
};

export const MORE = {
  pirates: () => bone(12, 35, 52, 54) + bone(52, 35, 12, 54) +
    shape(SKULL, BONE, { shade: 'M36 4H54V50H36Z', light: 'M19 24C19 17 23 12 29 11C24 15 22 19 22 25Z' }) + skullFace(),
  infamie: () => `<g transform="translate(32 34) scale(1.12) translate(-32 -28)">` +
    shape(SKULL, ['#9a92a8', '#d9d3e0', '#f4f1f7'], { shade: 'M36 4H54V50H36Z', light: 'M19 24C19 17 23 12 29 11C24 15 22 19 22 25Z' }) + skullFace() +
    `<path d="M33 8.5L30.5 14L34 17L31 21" fill="none" stroke="${K}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></g>`,
  interdit: () => shape(circ(32, 32, 26), C.red, { shade: 'M32 -2L66 32L32 66Z', light: 'M12 24Q16 12 28 9Q18 16 16 27Z' }) +
    shape(rect(14, 27, 36, 10, 2.5), C.white, { w: 2.6 }),
  refus: () => `<circle cx="32" cy="32" r="22" fill="none" stroke="${K}" stroke-width="12"/><path d="M16.4 47.6L47.6 16.4" stroke="${K}" stroke-width="12"/>` +
    `<circle cx="32" cy="32" r="22" fill="none" stroke="${C.red[1]}" stroke-width="6"/><path d="M16.4 47.6L47.6 16.4" stroke="${C.red[1]}" stroke-width="6"/>` +
    `<path d="M14.5 26Q18 16 27 12.5" fill="none" stroke="${C.red[2]}" stroke-width="2.2" stroke-linecap="round"/>`,
  toxique: () => {
    const at = (a, d) => [32 + d * Math.cos(a * Math.PI / 180), 33 + d * Math.sin(a * Math.PI / 180)];
    const lobes = [-90, 30, 150];
    return shape(circ(32, 33, 27), YEL, { shade: 'M32 0L66 33L32 66Z', light: 'M11 26Q15 13 28 9.5Q17 17 15 28Z' }) +
      lobes.map((a) => { const [x, y] = at(a, 10); return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="9.4" fill="${K}"/>`; }).join('') +
      lobes.map((a) => { const [x, y] = at(a, 15.5); return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6.6" fill="${YEL[1]}"/>`; }).join('') +
      `<circle cx="32" cy="33" r="4.2" fill="${YEL[1]}" stroke="${K}" stroke-width="2.6"/>` +
      lobes.map((a) => { const [x, y] = at(a + 60, 7.5); return `<path d="M32 33L${x.toFixed(2)} ${y.toFixed(2)}" stroke="${YEL[1]}" stroke-width="2.2"/>`; }).join('');
  },
  police: () => `<path d="M32 20V13" stroke="${K}" stroke-width="3"/>` +
    `<path d="M23 11L19 7M41 11L45 7M32 7V3" stroke="${C.blue[1]}" stroke-width="2.4" stroke-linecap="round"/>` +
    shape(rect(27.5, 9, 9, 6, 2.5), C.blue, { light: rect(29, 10, 3, 2) }) +
    shape(rect(20, 22, 24, 14, 2), C.white, { shade: rect(36, 20, 10, 18) }) +
    `<path d="M24 27H40" stroke="${C.navy[1]}" stroke-width="3.6" stroke-linecap="round"/>` +
    shape('M5 36H59L53 51Q52 53 50 53H13Q11 53 10 51Z', C.white, { shade: 'M0 45H64V60H0Z', light: 'M8 37.5H40V39H8Z' }) +
    `<path d="M7.6 44H56.4" stroke="${K}" stroke-width="2"/>` +
    shape('M33 36.5H39.5L35.5 52.5H29Z', C.red, {}) + shape('M41.5 36.5H44.5L40.5 52.5H37.5Z', C.blue, { w: 2 }),
  alarme: () => `<g stroke-linecap="round"><path d="M10 22L5 18M54 22L59 18M17 10L14 5M47 10L50 5M32 5V1" stroke="${K}" stroke-width="5.2"/>` +
    `<path d="M10 22L5 18M54 22L59 18M17 10L14 5M47 10L50 5M32 5V1" stroke="${YEL[1]}" stroke-width="2.2"/></g>` +
    shape('M17 46V33C17 23 23.5 15 32 15C40.5 15 47 23 47 33V46Z', C.red, { shade: 'M33 12H50V48H33Z', light: 'M22 32C22 25 25 21 29 19.5C26.5 24 26 28 26 34V43H22Z' }) +
    shape(rect(12, 45, 40, 10, 2.5), C.steel, { shade: rect(32, 43, 22, 14) }),
  gardes: () => rot(-28, 32, 33,
    shape('M3 29L19 27V40L5 42Q3 42 3 40Z', C.wood, { shade: 'M0 36H20V44H0Z' }) +
    shape('M22 37H27L25 46H20Z', C.wood, {}) + shape('M31 36H37.5L36 47H31Z', C.oil, { light: rect(32, 37, 1.6, 8) }) +
    shape(rect(18, 26.5, 24, 10, 2), C.oil, { light: rect(20, 28, 18, 1.8) }) +
    shape(rect(41, 28.5, 20, 4.6, 1), C.steel, { shade: rect(40, 31, 22, 3) }) + shape(rect(26, 22.5, 9, 4, 1), C.oil, { w: 2 })),
  combat: () => {
    const sabre = () => shape('M29.5 5Q37.5 18 36 40H28.5Q30.5 24 29.5 5Z', C.steel, { shade: 'M32.6 0H40V42H32.6Z', light: 'M30.8 10Q32.3 18 32 32H31Q31.3 20 30.8 10Z', w: 2.6 }) +
      shape(rect(23, 39.5, 18, 4.6, 2.3), C.brass, { w: 2.6 }) + shape(rect(29.4, 44, 5.2, 10, 1.6), C.wood, { w: 2.6 }) + shape(circ(32, 56.5, 2.6), C.brass, { w: 2.4 });
    return rot(-38, 32, 33, sabre()) + rot(38, 32, 33, sabre());
  },
  defense: () => shape('M32 5L54 12.5V30C54 45 44 54 32 59C20 54 10 45 10 30V12.5Z', C.blue, { shade: 'M32 0H60V62H32Z', light: 'M14 16L30 10.5V14L17 18.5V30Q17 36 19 40Q14 36 14 30Z' }) +
    shape('M18 25L32 34L46 25V33L32 42L18 33Z', C.brass, { shade: 'M32 20H50V44H32Z' }),
  bombe: () => `<path d="M42 19Q47 9 55 11" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M42 19Q47 9 55 11" fill="none" stroke="${C.card[1]}" stroke-width="2" stroke-linecap="round"/>` +
    rot(45, 41, 21, shape(rect(35.5, 17, 11, 8, 1.5), C.steel, {})) +
    shape(circ(28, 38, 19), C.oil, { shade: 'M30 14Q52 24 46 46Q38 60 22 56L60 64V14Z', light: 'M15 33Q16 25 24 22Q20 28 19 36Z' }) + spark(55.5, 10.5, 6.5),
  sabotage: () => rot(28, 30, 36,
    shape(rect(21, 16, 18, 42, 4), C.red, { shade: rect(31, 12, 12, 50), light: rect(24, 20, 3, 34) }) +
    shape(rect(19.5, 23, 21, 5, 1), C.card, { w: 2.4 }) + shape(rect(19.5, 46, 21, 5, 1), C.card, { w: 2.4 }) +
    `<path d="M30 16Q30 9 35 6" fill="none" stroke="${K}" stroke-width="4.6" stroke-linecap="round"/><path d="M30 16Q30 9 35 6" fill="none" stroke="${C.card[1]}" stroke-width="1.8" stroke-linecap="round"/>`) +
    spark(41.5, 6.8, 6),
  drogue: () => rot(-38, 32, 32,
    shape('M32 23H18Q9 23 9 32Q9 41 18 41H32Z', C.red, { shade: 'M0 34H34V44H0Z', light: 'M14 26.5Q12 28 12.4 31H30V26Z' }) +
    shape('M32 23H46Q55 23 55 32Q55 41 46 41H32Z', C.white, { shade: 'M30 34H58V44H30Z' })),
};

const SKIN = ['#b97a52', '#e2a878', '#f3c9a0'];
const STONE = ['#a99b7c', '#ddd2b6', '#f3ecd9'];
const FACE = ['#c48f25', '#f2c230', '#fbe38a'];
const columns = (xs, y, h) => xs.map((x) => shape(rect(x, y, 6, h, 0.5), STONE, { shade: rect(x + 3.2, y - 2, 4, h + 4), w: 2.4 })).join('');
const star4 = (x, y, r, col) => `<path d="M${x} ${y - r}Q${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y}Q${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r}Q${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y}Q${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r}Z" fill="${col}" ${S(2.4)}/>`;
const star5 = (cx, cy, R, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; return `${(cx + q * Math.cos(a)).toFixed(2)} ${(cy + q * Math.sin(a)).toFixed(2)}`; }).join('L') + 'Z';

Object.assign(MORE, {
  banque: () => shape('M5 22L32 7L59 22Z', STONE, { shade: 'M32 0H62V24H32Z' }) + shape(circ(32, 17, 4), C.brass, { w: 2.2 }) +
    shape(rect(8, 22, 48, 6, 1), STONE, { shade: rect(32, 20, 26, 10), w: 2.6 }) + columns([12, 23, 35, 46], 28, 19) +
    shape(rect(7, 47, 50, 5, 1), STONE, { shade: rect(32, 45, 26, 9), w: 2.6 }) + shape(rect(3, 52, 58, 6, 1.5), STONE, { shade: rect(32, 50, 30, 10), w: 2.6 }),
  autorites: () => `<path d="M32 9V2" stroke="${K}" stroke-width="2.6"/>` + shape('M33 2H43L40 5L43 8H33Z', C.red, { w: 2 }) +
    shape('M18 23Q18 9 32 9Q46 9 46 23Z', C.teal, { shade: 'M33 6H48V25H33Z', light: 'M22 21Q22 14 28 12Q25 16 25.5 21Z' }) +
    shape(rect(9, 23, 46, 6, 1), STONE, { shade: rect(32, 21, 25, 10), w: 2.6 }) + columns([13, 23.5, 34.5, 45], 29, 18) +
    shape(rect(7, 47, 50, 5, 1), STONE, { shade: rect(32, 45, 26, 9), w: 2.6 }) + shape(rect(3, 52, 58, 6, 1.5), STONE, { shade: rect(32, 50, 30, 10), w: 2.6 }),
  credit: () => shape(rect(5, 14, 54, 36, 5), C.blue, { shade: 'M36 10L62 10V54H22Z', light: rect(9, 18, 3, 26) }) +
    `<path d="M5.5 23H58.5" stroke="${K}" stroke-width="6"/>` + shape(rect(11, 31, 12, 9, 2), C.brass, { w: 2.2 }) +
    `<path d="M11 35.5H23M17 31V40" stroke="${C.brass[0]}" stroke-width="1.2"/><path d="M30 43H50" stroke="${C.blue[2]}" stroke-width="2.6" stroke-linecap="round"/>`,
  argent: () => shape('M23 22Q11 32 11 44Q11 58 32 58Q53 58 53 44Q53 32 41 22Z', C.card, { shade: 'M34 20Q50 30 54 46Q52 60 32 60L64 64V20Z', light: 'M16 44Q16 34 24 27Q20 35 20 44Z' }) +
    shape('M22 9L27 13L32 8L37 13L42 9L40 21H24Z', C.card, { shade: 'M32 6H44V22H32Z' }) + shape(rect(21, 19.5, 22, 5, 2.5), C.wood, { w: 2.4 }) +
    `<path d="M37.5 34Q36 31 32 31Q27 31 27 35Q27 38.5 32 39.5Q37 40.5 37 44Q37 48 32 48Q27.5 48 26.5 45M32 28V51" fill="none" stroke="${K}" stroke-width="5.2" stroke-linecap="round"/>` +
    `<path d="M37.5 34Q36 31 32 31Q27 31 27 35Q27 38.5 32 39.5Q37 40.5 37 44Q37 48 32 48Q27.5 48 26.5 45M32 28V51" fill="none" stroke="${C.brass[1]}" stroke-width="2.2" stroke-linecap="round"/>`,
  baisse: () => shape(rect(6, 8, 52, 44, 3), C.white, { shade: rect(46, 6, 14, 48) }) +
    [[13, 22, 24], [24, 28, 18], [35, 35, 11], [46, 40, 6]].map(([x, y, hgt]) => shape(rect(x, y, 6, hgt), C.red, { shade: rect(x + 3, y - 1, 4, hgt + 2), w: 2.2 })).join('') +
    `<path d="M12 15L26 24L35 22L50 37" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15L26 24L35 22L50 37" fill="none" stroke="${C.red[1]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    shape('M44 39L54 41L52 31Z', C.red, { w: 2.4 }) + shape(rect(4, 52, 56, 5, 2), C.wood, { w: 2.4 }),
  codex: () => shape('M4 18Q18 12 32 18Q46 12 60 18V54Q46 48 32 54Q18 48 4 54Z', C.blue, { shade: 'M32 10H64V60H32Z' }) +
    shape('M8 15Q20 9 32 15V50Q20 44 8 50Z', C.white, { shade: 'M24 8H34V54H24Z' }) + shape('M32 15Q44 9 56 15V50Q44 44 32 50Z', C.white, { shade: 'M46 8H58V54H46Z' }) +
    `<path d="M13 22Q20 19 27 22M13 29Q20 26 27 29M13 36Q20 33 27 36M37 22Q44 19 51 22M37 29Q44 26 51 29M37 36Q44 33 51 36" fill="none" stroke="${C.steel[0]}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M32 15V50" stroke="${K}" stroke-width="2.4"/>`,
  telephone: () => rot(-22, 32, 34,
    shape('M6 36Q6 22 18 20H46Q58 22 58 36V41Q58 45 54 45H45Q41 45 41 41V35Q41 31 37 31H27Q23 31 23 35V41Q23 45 19 45H10Q6 45 6 41Z', C.red,
      { shade: 'M0 39H64V50H0Z', light: 'M12 31Q12 25 19 24H44V26.5H20Q15 27 15 32Z' }) +
    `<path d="M10 41.5H19M45 41.5H54" stroke="${C.red[0]}" stroke-width="2" stroke-linecap="round"/>`),
  louche: () => shape('M8 62Q9 45 32 44Q55 45 56 62Z', C.oil, { light: 'M12 60Q13 50 22 47Q17 53 16 60Z' }) +
    shape('M26 44.5L32 55L38 44.5Z', C.white, { w: 2.2 }) + shape('M30.6 47H33.4L34.4 53L32 56L29.6 53Z', C.red, { w: 1.8 }) +
    shape(circ(32, 33, 10.5), SKIN, { shade: 'M33 20H46V46H33Z' }) +
    `<path d="M22.5 31.5H41.5" stroke="${K}" stroke-width="2"/>` + shape(rect(23.5, 30, 7.5, 5, 2), C.oil, { w: 1.6 }) + shape(rect(33, 30, 7.5, 5, 2), C.oil, { w: 1.6 }) +
    `<path d="M28.5 39.5Q32 40.8 35.5 39.5" fill="none" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>` +
    shape('M20 22Q20 9 32 9Q44 9 44 22Z', C.oil, { light: 'M24 20Q24 13 29 11.5Q26.5 15 27 20Z' }) + shape(rect(20.5, 18, 23, 4, 0.5), C.steel, { w: 2 }) +
    shape(rect(12, 21, 40, 5, 2.5), C.oil, {}),
  espion: () => `<path d="M38 38L54 54" stroke="${K}" stroke-width="12" stroke-linecap="round"/><path d="M38 38L54 54" stroke="${C.wood[1]}" stroke-width="6.4" stroke-linecap="round"/>` +
    `<path d="M45 45L53 53" stroke="${C.wood[0]}" stroke-width="3" stroke-linecap="round"/>` +
    shape(circ(26, 26, 18), C.brass, { shade: 'M26 4L50 26L26 50L50 50L50 4Z' }) + shape(circ(26, 26, 12.5), ['#79a8bf', '#b9d7e6', '#ffffff'], { shade: 'M26 12L42 26L26 42H42V12Z', light: 'M17 26Q17 18 25 16.5Q20 20 20.5 27Z', w: 2.6 }),
  discret: () => shape(circ(32, 32, 26), FACE, { shade: 'M32 2L64 34L32 64H64V2Z', light: 'M11 26Q14 12 28 8.5Q17 16 15 28Z' }) +
    `<path d="M18 26Q22 29 26 26M38 26Q42 29 46 26" fill="none" stroke="${K}" stroke-width="2.8" stroke-linecap="round"/>` +
    `<path d="M24 43Q32 46 40 43" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/>` +
    shape('M29 58V36Q29 32 32 32Q35 32 35 36V58Z', SKIN, { shade: rect(32.5, 30, 4, 30), w: 2.6 }) + `<path d="M30.4 37H33.6" stroke="${SKIN[0]}" stroke-width="1.4"/>`,
  rumeur: () => shape('M18 26C18 13 27 6 37 6C47 6 54 14 54 24C54 33 47 36 45 41C43 48 41 58 31 58C24 58 19 53 19 47C19 40 24 37 22 33C20 30 18 29 18 26Z', SKIN,
    { shade: 'M44 8L60 8V40L44 46Z', light: 'M22 23C22 15 27 10 33 8.8C28 13 25.5 18 25.5 24Z' }) +
    `<g fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"><path d="M26 25C26 17 31 13 37 13C43 13 47 17 47 23C47 29 42 31 40 37C39 41 38 46 34 48"/>` +
    `<path d="M32 28Q32 21 37 21Q41 21 41 25Q41 29 37 31Q33 32 33 36"/></g>` +
    `<path d="M10 22Q6 28 10 34M5 18Q-1 28 5 38" fill="none" stroke="${C.steel[0]}" stroke-width="2.6" stroke-linecap="round"/>`,
  parole: () => shape('M10 59V49C5 45 4 39 4 33C4 21 13 12 25 12C36 12 43 20 43 29L47 37Q48 39 45 39H43V44Q43 48 39 48H33V59Z', C.navy, { light: 'M9 33C9 24 14 18 21 16.5C16 21 13 26 13 33Z' }) +
    `<g fill="none" stroke-linecap="round"><path d="M50 26Q54 31 50 36M55 21Q62 31 55 41M60 16Q69 31 60 46" stroke="${K}" stroke-width="5"/>` +
    `<path d="M50 26Q54 31 50 36M55 21Q62 31 55 41M60 16Q69 31 60 46" stroke="${C.brass[1]}" stroke-width="2"/></g>`,
  capitaine: () => shape(circ(32, 37, 15), SKIN, { shade: 'M33 20H50V56H33Z' }) +
    shape('M17 37Q16 55 32 57Q48 55 47 37Q44 47 32 47Q20 47 17 37Z', C.white, { shade: 'M33 36H50V60H33Z' }) +
    `<path d="M26 47Q32 44 38 47" fill="none" stroke="${C.white[0]}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="26.5" cy="37" r="2" fill="${K}"/><circle cx="37.5" cy="37" r="2" fill="${K}"/>` +
    shape('M12 22Q11 11 32 9Q53 11 52 22Z', C.white, { shade: 'M34 6H56V24H34Z' }) + shape(rect(15, 21, 34, 6, 1), C.navy, {}) +
    shape(circ(32, 20, 4), C.brass, { w: 2.2 }) + shape('M16 27H48Q45 32 32 32Q19 32 16 27Z', C.oil, { light: 'M20 28H30V29.4H20Z' }),
  haut_fait: () => shape('M21 5H43L39 31H25Z', C.blue, {}) + `<path d="M28.5 5.5L28 31M35.5 5.5L36 31" stroke="${C.red[1]}" stroke-width="3.6"/><path d="M32 5.5V31" stroke="${C.white[1]}" stroke-width="2.6"/>` +
    `<path d="M21 5H43L39 31H25Z" fill="none" ${S(3)}/>` + shape(rect(23, 29, 18, 5, 1.5), C.brass, { w: 2.4 }) +
    shape(star5(32, 46, 15, 7), C.brass, { shade: 'M32 30L50 40L46 62L32 52Z', light: 'M32 34L29 43L22 44L29 45L32 38Z' }),
  etincelles: () => star4(25, 36, 18, YEL[1]) + `<path d="M25 25Q26.5 33 30 36" fill="none" stroke="${YEL[2]}" stroke-width="2" stroke-linecap="round"/>` +
    star4(47, 15, 9, YEL[1]) + star4(48, 47, 7, YEL[1]),
  vague: () => shape('M4 57V50C12 46 15 35 21 25C27 14 37 7 47 8C55 9 60 15 60 22C56 17 49 17 45 21C41 26 42 33 49 36C44 41 35 40 32 33C28 42 30 51 38 57Z', C.blue,
    { shade: 'M0 46H64V64H0Z', light: 'M12 44C16 38 19 30 24 23C21 31 19 38 16 44Z' }) +
    `<path d="M45 21C49 17 56 17 60 22C56 13 46 10 38 15" fill="${C.white[1]}" ${S(2.4)}/>` +
    shape('M4 56Q14 51 22 55Q32 59 42 55Q52 51 60 55V60H4Z', C.sea, { w: 2.6 }),
});

const ICE = ['#7fb2d6', '#cfe6f5', '#ffffff'];
const SAND = ['#b4802f', '#e0b45a', '#f3d68f'];
const zee = (x, y, w) => `M${x} ${y}H${x + w}L${x} ${y + w}H${x + w}`;
const dots = (pts, r, col) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`).join('');

Object.assign(MORE, {
  reparation: () => rot(-45, 32, 32,
    shape(rect(4, 28, 40, 8, 4), C.steel, { shade: rect(0, 32.5, 46, 6), light: rect(8, 29.6, 26, 1.6) }) +
    shape('M60.04 27.5A11 11 0 1 0 60.04 36.5H49V27.5Z', C.steel, { shade: 'M40 33H64V46H40Z', light: 'M41 31Q42 25 47 23.5Q43.5 27 43.5 32Z' })),
  verrou: () => `<path d="M20 30V20Q20 8 32 8Q44 8 44 20V30" fill="none" stroke="${K}" stroke-width="10"/><path d="M20 30V20Q20 8 32 8Q44 8 44 20V30" fill="none" stroke="${C.steel[1]}" stroke-width="4.4"/>` +
    `<path d="M22 22Q23 12.5 31 11" fill="none" stroke="${C.steel[2]}" stroke-width="1.6" stroke-linecap="round"/>` +
    shape(rect(12, 28, 40, 30, 5), C.brass, { shade: rect(34, 25, 20, 36), light: rect(16, 32, 3.4, 20) }) +
    shape('M32 36A4.5 4.5 0 0 1 34.4 44.3L35.6 51H28.4L29.6 44.3A4.5 4.5 0 0 1 32 36Z', C.oil, { w: 1.6 }),
  transpondeur: () => `<g fill="none" stroke-linecap="round"><path d="M44 13Q51 13 51 20M44 6Q58 6 58 20" stroke="${K}" stroke-width="5"/><path d="M44 13Q51 13 51 20M44 6Q58 6 58 20" stroke="${C.red[1]}" stroke-width="2"/></g>` +
    shape('M22 44L28 36L36 44L40 58H18Z', C.steel, { shade: 'M29 30H44V60H29Z' }) +
    rot(-35, 28, 32, shape('M10 30Q10 44 28 44Q46 44 46 30Z', C.white, { shade: 'M28 26H50V48H28Z', light: 'M14 32Q15 39 22 41.5Q17 37.5 17 32Z' })) +
    `<path d="M27 30L41 18" stroke="${K}" stroke-width="2.6"/>` + shape(circ(42, 17, 3.4), C.red, { w: 2.2 }),
  satellite: () => {
    const panel = (x, y) => shape(rect(x, y, 16, 22, 1.5), C.blue, { shade: rect(x + 8, y - 1, 9, 24) }) +
      `<path d="M${x + 8} ${y}V${y + 22}M${x} ${y + 7.3}H${x + 16}M${x} ${y + 14.6}H${x + 16}" stroke="${C.navy[0]}" stroke-width="1.4"/>`;
    return rot(-35, 32, 32, `<path d="M18 32H46" stroke="${K}" stroke-width="5"/><path d="M18 32H46" stroke="${C.steel[1]}" stroke-width="2"/>` +
      panel(2, 21) + panel(46, 21) + shape(rect(23, 23, 18, 18, 3), C.brass, { shade: rect(32, 21, 11, 22), light: rect(25.5, 25.5, 2.4, 13) }) +
      `<path d="M32 23V14" stroke="${K}" stroke-width="2.6"/>` + shape(circ(32, 12, 3.2), C.red, { w: 2.2 }));
  },
  grappin: () => `<path d="M32 4V16" stroke="${K}" stroke-width="7" stroke-linecap="round"/><path d="M32 4V16" stroke="${C.card[1]}" stroke-width="3" stroke-linecap="round"/>` +
    shape(circ(32, 19, 5.5), C.steel, { w: 2.6 }) + `<circle cx="32" cy="19" r="2.2" fill="${K}"/>` +
    `<path d="M32 24.5V46Q32 56 23 56Q15 56 14.5 47" fill="none" stroke="${K}" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M32 24.5V46Q32 56 23 56Q15 56 14.5 47" fill="none" stroke="${C.steel[1]}" stroke-width="4.6" stroke-linecap="round"/>` +
    shape('M9 46L14.5 37L20 46Z', C.steel, { w: 2.6 }) + `<path d="M30 27V44" stroke="${C.steel[2]}" stroke-width="1.4" stroke-linecap="round"/>`,
  extincteur: () => `<path d="M38 13Q52 12 52 26V44" fill="none" stroke="${K}" stroke-width="7" stroke-linecap="round"/><path d="M38 13Q52 12 52 26V44" fill="none" stroke="${C.oil[2]}" stroke-width="3" stroke-linecap="round"/>` +
    shape('M49 43H55L56 50H48Z', C.oil, { w: 2.4 }) +
    shape('M18 22Q18 17 23 17H35Q40 17 40 22V56Q40 59 37 59H21Q18 59 18 56Z', C.red, { shade: rect(30, 14, 12, 48), light: rect(21.5, 22, 3, 32) }) +
    shape(rect(20, 32, 18, 10, 1), C.white, { w: 2.2 }) + `<path d="M24 37H34" stroke="${C.red[1]}" stroke-width="2.4"/>` +
    shape(rect(25, 9, 8, 8, 1), C.oil, { w: 2.4 }) + shape('M22 8H41L39 12H22Z', C.oil, { w: 2.4 }),
  coque: () => {
    const HULL = 'M4 15H50Q57 15 61 12L55 46Q53.5 52 47 52H9Q4 52 4 47Z';
    return `<clipPath id="hul"><path d="${HULL}"/></clipPath><path d="${HULL}" fill="${C.steel[1]}"/>` +
      `<g clip-path="url(#hul)"><path d="M0 34H64V64H0Z" fill="${C.red[1]}"/><path d="M0 44H64V64H0Z" fill="${C.red[0]}"/><path d="M0 15H64V18H0Z" fill="${C.steel[2]}"/>` +
      `<path d="M0 34H64" stroke="${K}" stroke-width="2.4"/><path d="M20 10V60M38 10V60" stroke="${K}" stroke-width="2"/>` +
      dots([[8.5, 21], [15.5, 21], [24.5, 21], [33.5, 21], [42.5, 21], [51, 21], [8.5, 29], [15.5, 29], [24.5, 29], [33.5, 29], [42.5, 29], [51, 29]], 1.6, C.steel[0]) +
      dots([[8.5, 39], [15.5, 39], [24.5, 39], [33.5, 39], [42.5, 39], [50, 39], [8.5, 47], [15.5, 47], [24.5, 47], [33.5, 47], [42.5, 47]], 1.6, '#5e1d1a') + `</g>` +
      `<path d="${HULL}" fill="none" ${S(3)}/>`;
  },
  cache: () => shape('M3 30L17 14H61L47 30Z', C.wood, { shade: 'M3 30L17 14H61L47 30Z', light: '' }) +
    `<path d="M10.5 22H54.5" stroke="${C.wood[0]}" stroke-width="1.6"/>` +
    shape('M3 30H47V55H3Z', C.wood, { shade: rect(25, 28, 24, 30) }) + shape('M47 30L61 14V39L47 55Z', C.wood, { shade: 'M47 0H64V60H47Z' }) +
    `<path d="M3 38.5H47M3 46.5H47" stroke="${C.wood[0]}" stroke-width="1.6"/>` +
    shape('M22 25L28 18H44L38 25Z', C.oil, { w: 2.4 }) +
    shape('M22 25L38 25L31 7L16 7Z', C.wood, { shade: 'M30 4H40V27H30Z', light: 'M19 9L21 9L26 22H24Z', w: 2.6 }),
  brise_glace: () => shape('M32 8L56 20V46L32 58L8 46V20Z', ICE, { shade: 'M32 30L56 18V48L32 60Z', light: 'M32 8L56 20L32 32L8 20Z' }) +
    `<path d="M8 20L32 32L56 20M32 32V58" fill="none" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M14 26L14 40M19 30L19 36" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/><path d="M24 18L32 14" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>`,
  desarme: () => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${zee(8, 30, 22)}${zee(36, 16, 14)}${zee(48, 4, 9)}" stroke="${K}" stroke-width="9"/>` +
    `<path d="${zee(8, 30, 22)}${zee(36, 16, 14)}${zee(48, 4, 9)}" stroke="${C.blue[2]}" stroke-width="4"/></g>`,
  travaux: () => `<path d="M14 30V58M50 30V58" stroke="${K}" stroke-width="7" stroke-linecap="round"/><path d="M14 30V58M50 30V58" stroke="${C.steel[1]}" stroke-width="3" stroke-linecap="round"/>` +
    shape(rect(4, 22, 56, 16, 2), C.white, { shade: rect(4, 32, 56, 8) }) +
    `<clipPath id="trv"><path d="${rect(4, 22, 56, 16, 2)}"/></clipPath><g clip-path="url(#trv)">` +
    [0, 1, 2, 3, 4].map((i) => `<path d="M${-4 + i * 14} 38L${4 + i * 14} 22H${11 + i * 14}L${3 + i * 14} 38Z" fill="${C.orange[1]}"/>`).join('') + `</g>` +
    `<path d="${rect(4, 22, 56, 16, 2)}" fill="none" ${S(3)}/>` +
    shape('M10 22V15Q10 11 14 11Q18 11 18 15V22Z', C.orange, { light: rect(12, 14, 1.6, 6) }) +
    `<path d="M14 6V3M8 9L6 7M20 9L22 7" stroke="${C.orange[1]}" stroke-width="2" stroke-linecap="round"/>`,
  aleas: () => shape('M32 6L56 17L32 28L8 17Z', C.white, { light: '' }) + shape('M8 17L32 28V58L8 47Z', C.white, { shade: 'M0 0H64V64H0Z' }) +
    shape('M56 17L32 28V58L56 47Z', C.white, {}) +
    `<ellipse cx="32" cy="17" rx="4" ry="2.4" fill="${C.red[1]}"/>` + dots([[14, 28], [26, 46], [20, 37]], 2.4, K) +
    dots([[38, 35], [50, 29], [38, 50], [50, 44]], 2.4, K),
  boussole: () => shape(circ(32, 32, 27), C.brass, { shade: 'M32 2L64 34L32 64H64V2Z' }) + shape(circ(32, 32, 20.5), C.white, { shade: 'M32 10L56 34L32 56H56V10Z', w: 2.6 }) +
    `<path d="M32 13.5V17M32 47V50.5M13.5 32H17M47 32H50.5" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>` +
    rot(30, 32, 32, shape('M32 15L37 32H27Z', C.red, { w: 2.4 }) + shape('M27 32H37L32 49Z', C.steel, { w: 2.4 })) +
    shape(circ(32, 32, 3), C.brass, { w: 2 }),
  reveil: () => `<path d="M17 52L12 58M47 52L52 58" stroke="${K}" stroke-width="5" stroke-linecap="round"/>` +
    shape('M8 16Q10 7 20 7Q14 12 14 20Z', C.brass, { w: 2.6 }) + shape('M56 16Q54 7 44 7Q50 12 50 20Z', C.brass, { w: 2.6 }) +
    shape(circ(32, 34, 22), C.red, { shade: 'M32 10L58 36L32 60H58V10Z', light: 'M13 30Q15 19 26 15Q17 22 17 32Z' }) +
    shape(circ(32, 34, 16), C.white, { shade: 'M32 18L50 36L32 52H50V18Z', w: 2.6 }) +
    `<path d="M32 34V23M32 34L40 38" stroke="${K}" stroke-width="2.8" stroke-linecap="round"/>` + `<circle cx="32" cy="34" r="2" fill="${K}"/>` +
    shape(rect(29, 8, 6, 4, 1), C.brass, { w: 2 }),
  sablier: () => shape(rect(12, 5, 40, 7, 2), C.wood, { shade: rect(32, 3, 22, 11) }) + shape(rect(12, 52, 40, 7, 2), C.wood, { shade: rect(32, 50, 22, 11) }) +
    shape('M17 12H47Q47 26 35 32Q47 38 47 52H17Q17 38 29 32Q17 26 17 12Z', ICE, { shade: 'M33 10H50V54H33Z', light: 'M21 15Q21.5 24 28 29Q23 23 24 15Z' }) +
    `<path d="M22 19H42Q40 25 32 29.5Q24 25 22 19Z" fill="${SAND[1]}" stroke="${SAND[0]}" stroke-width="1"/>` +
    `<path d="M32 30V47" stroke="${SAND[1]}" stroke-width="1.6"/><path d="M20 51Q22 43 32 41Q42 43 44 51Z" fill="${SAND[1]}" stroke="${SAND[0]}" stroke-width="1"/>` +
    `<path d="M17 12H47Q47 26 35 32Q47 38 47 52H17Q17 38 29 32Q17 26 17 12Z" fill="none" ${S(3)}/>`,
});

const BTN = ['#14504f', '#1f8a88', '#55a49d'];
const button = (inner) => shape(rect(6, 6, 52, 52, 12), BTN, { shade: 'M0 34H64V64H0Z', light: 'M11 24Q11 11 24 11H40V14H25Q14 14 14 25V36H11Z' }) + inner;
const speaker = () => shape('M8 24H18L31 12V52L18 40H8Z', C.steel, { shade: 'M0 34H34V60H0Z', light: 'M11 27H17V30H11Z' });
const waves = (n) => {
  const d = [1, 2, 3].slice(0, n).map((i) => { const x = 33 + i * 7, hh = 5 + i * 5.5; return `M${x} ${32 - hh}Q${x + hh * 0.75} 32 ${x} ${32 + hh}`; }).join('');
  return `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="${K}" stroke-width="6"/><path d="${d}" stroke="${C.blue[1]}" stroke-width="2.4"/></g>`;
};
const loop = () => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 36V30Q14 20 24 20H44M50 28V34Q50 44 40 44H20" stroke="${K}" stroke-width="10"/>` +
  `<path d="M14 36V30Q14 20 24 20H44M50 28V34Q50 44 40 44H20" stroke="${C.teal[1]}" stroke-width="4.4"/></g>` +
  shape('M42 11L54 20L42 29Z', C.teal, { w: 2.6 }) + shape('M22 35L10 44L22 53Z', C.teal, { w: 2.6 });

Object.assign(MORE, {
  langue: () => shape(circ(32, 32, 26), C.sea, { shade: 'M32 2L64 34L32 64H64V2Z', light: 'M11 26Q15 12 28 8.5Q17 16 15 28Z' }) +
    `<path d="M18 14Q24 18 22 24Q16 26 18 32Q22 36 18 42Q12 40 9 33M38 8Q34 14 40 18Q46 16 48 22Q44 30 50 34Q55 34 57 30M40 56Q40 48 46 44Q52 46 53 44" fill="none" stroke="${C.green[0]}" stroke-width="0"/>` +
    shape('M14 16Q22 15 24 21Q20 25 22 30Q26 34 22 40Q14 40 8 32Q8 22 14 16Z', C.green, { w: 2.4 }) +
    shape('M36 7Q46 8 53 15Q50 20 44 20Q40 26 46 30Q51 31 57 28Q58 38 52 46Q46 44 44 38Q38 36 38 30Q32 24 36 18Q32 12 36 7Z', C.green, { w: 2.4 }) +
    `<g fill="none" stroke="${K}" stroke-width="1.6" opacity="0.55"><ellipse cx="32" cy="32" rx="11" ry="26"/><path d="M6 32H58M9 19H55M9 45H55"/></g>` +
    `<circle cx="32" cy="32" r="26" fill="none" ${S(3)}/>`,
  generique: () => shape(rect(7, 26, 50, 31, 3), C.oil, { light: rect(10, 29, 3, 24) }) +
    `<path d="M14 36H50M14 44H42M14 50H34" stroke="${C.oil[2]}" stroke-width="2.4" stroke-linecap="round"/>` +
    rot(-14, 8, 24, shape(rect(7, 14, 50, 10, 2), C.white, {}) +
      `<clipPath id="clp"><path d="${rect(7, 14, 50, 10, 2)}"/></clipPath><g clip-path="url(#clp)">` +
      [0, 1, 2, 3].map((i) => `<path d="M${10 + i * 13} 14H${17 + i * 13}L${12 + i * 13} 24H${5 + i * 13}Z" fill="${C.oil[1]}"/>`).join('') + `</g>` +
      `<path d="${rect(7, 14, 50, 10, 2)}" fill="none" ${S(3)}/>`) +
    shape(circ(9, 25, 3.4), C.steel, { w: 2.2 }),
  musique: () => `<path d="M24 46V14L50 8V40" fill="none" stroke="${K}" stroke-width="7" stroke-linejoin="round"/><path d="M24 46V14L50 8V40" fill="none" stroke="${C.navy[1]}" stroke-width="2.6" stroke-linejoin="round"/>` +
    shape('M24 13L50 7V17L24 23Z', C.navy, { w: 2.6 }) +
    rot(-20, 17, 47, shape('M8 47A9 6.6 0 1 0 26 47A9 6.6 0 1 0 8 47Z', C.navy, { light: 'M11 45Q13 42 17 42Q13 44 13 46Z' })) +
    rot(-20, 43, 41, shape('M34 41A9 6.6 0 1 0 52 41A9 6.6 0 1 0 34 41Z', C.navy, { light: 'M37 39Q39 36 43 36Q39 38 39 40Z' })),
  muet: () => speaker() + `<path d="M40 24L54 38M54 24L40 38" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M40 24L54 38M54 24L40 38" stroke="${C.red[1]}" stroke-width="3.6" stroke-linecap="round"/>`,
  son1: () => speaker() + waves(1),
  son3: () => speaker() + waves(3),
  boucle: () => loop(),
  boucle1: () => loop() + shape('M30 28.5L33.5 26.5H35.5V38H31.8V31.5L30 32.4Z', C.white, { w: 1.8 }),
  pause: () => button(shape(rect(21, 19, 8, 26, 2), C.white, { w: 2.6 }) + shape(rect(35, 19, 8, 26, 2), C.white, { w: 2.6 })),
  stop: () => button(shape(rect(20, 20, 24, 24, 3), C.white, { w: 2.6 })),
  suivant: () => button(shape('M16 20L31 32L16 44Z', C.white, { w: 2.6 }) + shape('M30 20L45 32L30 44Z', C.white, { w: 2.6 }) + shape(rect(45, 20, 5, 24, 1), C.white, { w: 2.6 })),
});

// Famille d'abord : un cœur avec la maison (le port de la famille).
Object.assign(MORE, {
  famille: () => shape('M32 55C20 46 7 37 7 23C7 14 13.5 9 20.5 9C26 9 30 12 32 16C34 12 38 9 43.5 9C50.5 9 57 14 57 23C57 37 44 46 32 55Z', ['#a8343f', '#dc5260', '#f08f97'],
      { shade: 'M64 14C60 34 46 46 32 56L64 64Z', light: 'M11 22C11 15 15.5 12 20.5 12C24 12 26 13.5 27 15C21 15 15.5 18 15 26Z' }) +
    shape('M21 30L32 20L43 30V42H21Z', C.white, { shade: rect(32, 18, 13, 26), w: 2.6 }) + shape(rect(29, 34, 6, 8, 0.5), C.wood, { w: 2 }),
});
