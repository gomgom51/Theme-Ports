// Drapeaux simplifiés (format 3:2, viewBox 30×20) des pays des ports du jeu.
// Dessinés en SVG pour s'afficher partout (les émojis drapeaux ne marchent pas sous Windows).
function starPts(cx, cy, r, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r, a = rot + (i * Math.PI) / 5;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${p.join(' ')}"/>`;
}
const hStripes = (cols) => cols.map((c, i) => `<rect y="${(20 / cols.length) * i}" width="30" height="${20 / cols.length + 0.05}" fill="${c}"/>`).join('');
const vStripes = (cols) => cols.map((c, i) => `<rect x="${(30 / cols.length) * i}" width="${30 / cols.length + 0.05}" height="20" fill="${c}"/>`).join('');

const FLAG_SVG = {
  NL: hStripes(['#ae1c28', '#fff', '#21468b']),
  DE: hStripes(['#000', '#dd0000', '#ffce00']),
  FR: vStripes(['#002395', '#fff', '#ed2939']),
  GR: hStripes(['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'])
    + '<rect width="11.1" height="11.1" fill="#0d5eaf"/><rect x="4.45" width="2.2" height="11.1" fill="#fff"/><rect y="4.45" width="11.1" height="2.2" fill="#fff"/>',
  EG: hStripes(['#ce1126', '#fff', '#000']) + '<path d="M13.6 8.2h2.8l-.4 3.4h-2z" fill="#c09300"/>',
  SA: '<rect width="30" height="20" fill="#006c35"/><path d="M7 7.5c2-1 3 1 5 0s3 1 5 0 3 1 5 0M7 10c2-1 4 1 6 0s4 1 6 0" stroke="#fff" stroke-width=".9" fill="none"/><path d="M7 13.5h15l1.5-.8" stroke="#fff" stroke-width=".9" fill="none"/>',
  AE: hStripes(['#00732f', '#fff', '#000']) + '<rect width="7.5" height="20" fill="#ff0000"/>',
  IN: hStripes(['#ff9933', '#fff', '#138808']) + '<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".7"/><circle cx="15" cy="10" r=".6" fill="#000080"/>',
  SG: '<rect width="30" height="10" fill="#ef3340"/><rect y="10" width="30" height="10" fill="#fff"/><circle cx="6.8" cy="5" r="3.3" fill="#fff"/><circle cx="8" cy="5" r="3.1" fill="#ef3340"/><g fill="#fff">' + [[10.3, 3.1], [12.2, 4.4], [11.5, 6.6], [9.1, 6.6], [8.4, 4.4]].map(([x, y]) => starPts(x, y, 0.8)).join('') + '</g>',
  CN: '<rect width="30" height="20" fill="#de2910"/><g fill="#ffde00">' + starPts(5, 5, 3) + [[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => starPts(x, y, 1)).join('') + '</g>',
  KR: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#0047a0"/><path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#cd2e3a"/><g fill="#000"><rect x="4" y="3" width="4" height="1" transform="rotate(34 6 3.5)"/><rect x="22" y="15.5" width="4" height="1" transform="rotate(34 24 16)"/><rect x="22" y="3" width="4" height="1" transform="rotate(-34 24 3.5)"/><rect x="4" y="15.5" width="4" height="1" transform="rotate(-34 6 16)"/></g>',
  JP: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
  AU: '<rect width="30" height="20" fill="#00008b"/><path d="M0 0L15 10M15 0L0 10" stroke="#fff" stroke-width="2"/><path d="M0 0L15 10M15 0L0 10" stroke="#e4002b" stroke-width=".8"/><path d="M7.5 0v10M0 5h15" stroke="#fff" stroke-width="3"/><path d="M7.5 0v10M0 5h15" stroke="#e4002b" stroke-width="1.6"/><g fill="#fff">' + starPts(7.5, 15, 2) + [[22, 4], [25.5, 8], [22, 16.5], [19, 9]].map(([x, y]) => starPts(x, y, 1)).join('') + '</g>',
  ZA: '<rect width="30" height="10" fill="#e03c31"/><rect y="10" width="30" height="10" fill="#001489"/><path d="M0 0L13 10L0 20" fill="none" stroke="#fff" stroke-width="7"/><path d="M13 10H30" stroke="#fff" stroke-width="7"/><path d="M0 0L13 10L0 20M13 10H30" fill="none" stroke="#007749" stroke-width="4"/><path d="M0 3.5L8.5 10L0 16.5z" fill="#ffb81c"/><path d="M0 5.2L6.3 10L0 14.8z" fill="#000"/>',
  NG: vStripes(['#008751', '#fff', '#008751']),
  CI: vStripes(['#f77f00', '#fff', '#009e60']),
  BR: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5L27 10L15 17.5L3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2c3-.9 6.3-.6 8.6.9" stroke="#fff" stroke-width=".7" fill="none"/>',
  AR: hStripes(['#74acdf', '#fff', '#74acdf']) + '<circle cx="15" cy="10" r="1.8" fill="#f6b40e"/><g stroke="#f6b40e" stroke-width=".5">' + Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<line x1="${(15 + 2.1 * Math.cos(a)).toFixed(2)}" y1="${(10 + 2.1 * Math.sin(a)).toFixed(2)}" x2="${(15 + 3 * Math.cos(a)).toFixed(2)}" y2="${(10 + 3 * Math.sin(a)).toFixed(2)}"/>`; }).join('') + '</g>',
  US: hStripes(Array.from({ length: 13 }, (_, i) => (i % 2 ? '#fff' : '#b22234'))) + '<rect width="12" height="10.77" fill="#3c3b6e"/><g fill="#fff">' + Array.from({ length: 20 }, (_, i) => `<circle cx="${1.3 + (i % 5) * 2.35 + (Math.floor(i / 5) % 2) * 1.1}" cy="${1.4 + Math.floor(i / 5) * 2.6}" r=".5"/>`).join('') + '</g>',
  CA: '<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d80621"/><rect x="22.5" width="7.5" height="20" fill="#d80621"/><path d="M15 4l1 2 1.6-.5-.4 3 2-1.6.6 1.2 1.6-.3-.9 2.4.9.6-3.6 2.4.3 1.3-2.6-.4-.1 2.6h-.8l-.1-2.6-2.6.4.3-1.3-3.6-2.4.9-.6-.9-2.4 1.6.3.6-1.2 2 1.6-.4-3 1.6.5z" fill="#d80621"/>',
  // ---------- Pays ajoutés avec les 50 ports ----------
  IT: vStripes(['#009246', '#fff', '#ce2b37']),
  ES: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="6" y="7.5" width="3.4" height="5" rx=".6" fill="#aa151b" opacity=".85"/>',
  TR: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/><g fill="#fff">' + starPts(17.3, 10, 2.2, Math.PI) + '</g>',
  PL: hStripes(['#fff', '#dc143c']),
  RO: vStripes(['#002b7f', '#fcd116', '#ce1126']),
  IR: hStripes(['#239f40', '#fff', '#da0000']) + '<circle cx="15" cy="10" r="2.2" fill="none" stroke="#da0000" stroke-width="1"/>',
  DJ: hStripes(['#6ab2e7', '#12ad2b']) + '<path d="M0 0 L13 10 L0 20 Z" fill="#fff"/><g fill="#d7141a">' + starPts(4.5, 10, 2) + '</g>',
  KE: '<rect width="30" height="20" fill="#fff"/><rect width="30" height="5.6" fill="#000"/><rect y="7" width="30" height="6" fill="#bb0000"/><rect y="14.4" width="30" height="5.6" fill="#006600"/><ellipse cx="15" cy="10" rx="2.6" ry="5.4" fill="#bb0000" stroke="#000" stroke-width=".8"/><rect x="14.5" y="6" width="1" height="8" fill="#fff"/>',
  AO: hStripes(['#cc092f', '#000']) + '<path d="M11.5 12.5 a4.2 4.2 0 1 1 6.5 1.6" fill="none" stroke="#ffcb00" stroke-width="1.3"/><g fill="#ffcb00">' + starPts(15.5, 9, 1.6) + '</g>',
  GH: hStripes(['#ce1126', '#fcd116', '#006b3f']) + '<g fill="#000">' + starPts(15, 10, 3) + '</g>',
  PK: '<rect width="30" height="20" fill="#01411c"/><rect width="7.5" height="20" fill="#fff"/><circle cx="18.5" cy="10" r="5" fill="#fff"/><circle cx="19.9" cy="8.8" r="4.3" fill="#01411c"/><g fill="#fff">' + starPts(21.5, 7.5, 1.6, -0.6) + '</g>',
  LK: '<rect width="30" height="20" fill="#ffbe29"/><rect x="1" y="1" width="4.5" height="18" fill="#00534e"/><rect x="5.5" y="1" width="4.5" height="18" fill="#eb7400"/><rect x="11" y="1" width="18" height="18" fill="#8d153a"/><path d="M15 6 h8 v8 h-8 z" fill="#ffbe29" opacity=".9"/><path d="M16.5 7.5 h5 v5 h-5 z" fill="#8d153a"/>',
  HK: '<rect width="30" height="20" fill="#de2910"/><g fill="#fff">' + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="15" cy="7.2" rx="1.5" ry="2.8" transform="rotate(${a} 15 10)"/>`).join('') + '</g>',
  MY: Array.from({ length: 14 }, (_, i) => `<rect y="${(20 / 14) * i}" width="30" height="${20 / 14 + 0.05}" fill="${i % 2 ? '#fff' : '#cc0001'}"/>`).join('') + '<rect width="15" height="11.43" fill="#010066"/><circle cx="6" cy="5.7" r="3.8" fill="#fc0"/><circle cx="7.2" cy="5.7" r="3.2" fill="#010066"/><g fill="#fc0">' + starPts(11.2, 5.7, 2.4) + '</g>',
  ID: hStripes(['#ce1126', '#fff']),
  PH: '<rect width="30" height="10" fill="#0038a8"/><rect y="10" width="30" height="10" fill="#ce1126"/><path d="M0 0 L15 10 L0 20 Z" fill="#fff"/><circle cx="5.2" cy="10" r="2.1" fill="#fcd116"/><g fill="#fcd116">' + starPts(1.8, 2.4, 0.9) + starPts(1.8, 17.6, 0.9) + starPts(12.2, 10, 0.9) + '</g>',
  VN: '<rect width="30" height="20" fill="#da251d"/><g fill="#ff0">' + starPts(15, 10.4, 5.2) + '</g>',
  NZ: '<rect width="30" height="20" fill="#00247d"/><g><rect width="15" height="10" fill="#00247d"/><path d="M0 0 L15 10 M15 0 L0 10" stroke="#fff" stroke-width="2"/><path d="M0 0 L15 10 M15 0 L0 10" stroke="#cf142b" stroke-width=".8"/><path d="M7.5 0 V10 M0 5 H15" stroke="#fff" stroke-width="3"/><path d="M7.5 0 V10 M0 5 H15" stroke="#cf142b" stroke-width="1.6"/></g><g fill="#cc142b" stroke="#fff" stroke-width=".35">' + starPts(22.5, 15.5, 1.5) + starPts(19.5, 9, 1.3) + starPts(25.5, 8, 1.3) + starPts(22.5, 4, 1.2) + '</g>',
  CO: '<rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/>',
  MX: vStripes(['#006847', '#fff', '#ce1126']) + '<circle cx="15" cy="10" r="2.4" fill="none" stroke="#8c5a2b" stroke-width="1.2"/><circle cx="15" cy="9.4" r=".9" fill="#8c5a2b"/>',
  CL: '<rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#d52b1e"/><rect width="10" height="10" fill="#0039a6"/><g fill="#fff">' + starPts(5, 5, 2.4) + '</g>',
  VE: hStripes(['#ffcc00', '#00247d', '#cf142b']) + '<g fill="#fff">' + Array.from({ length: 8 }, (_, i) => { const a = Math.PI * (1.15 + (0.7 * i) / 7); return starPts(15 + 5.2 * Math.cos(a), 12.2 + 5.2 * Math.sin(a), 0.75); }).join('') + '</g>',
  QA: '<rect width="30" height="20" fill="#8a1538"/><polygon points="0,0 8,0 12,1.11 8,2.22 12,3.33 8,4.44 12,5.56 8,6.67 12,7.78 8,8.89 12,10.00 8,11.11 12,12.22 8,13.33 12,14.44 8,15.56 12,16.67 8,17.78 12,18.89 8,20.00 0,20" fill="#fff"/>',
  PA: '<rect width="30" height="20" fill="#fff"/><rect x="15" width="15" height="10" fill="#da121a"/><rect y="10" width="15" height="10" fill="#072357"/><g fill="#072357">' + starPts(7.5, 5, 2.4) + '</g><g fill="#da121a">' + starPts(22.5, 15, 2.4) + '</g>',
  RU: hStripes(['#fff', '#0039a6', '#d52b1e']),
  BD: '<rect width="30" height="20" fill="#006a4e"/><circle cx="13.5" cy="10" r="6" fill="#f42a41"/>',
  DZ: '<rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><path d="M18.75 6.69A5 5 0 1 0 18.75 13.31A4 4 0 1 1 18.75 6.69Z" fill="#d21034"/><g fill="#d21034">' + starPts(19.4, 10, 1.7) + '</g>',
  MA: '<rect width="30" height="20" fill="#c1272d"/><g fill="none" stroke="#006233" stroke-width=".9">' + starPts(15, 10.4, 4.6).replace('<polygon', '<polygon stroke-linejoin="round"') + '</g>',
  IL: '<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="3" fill="#0038b8"/><rect y="15" width="30" height="3" fill="#0038b8"/><g fill="none" stroke="#0038b8" stroke-width=".9"><polygon points="15,6.4 18.1,11.8 11.9,11.8"/><polygon points="15,13.6 18.1,8.2 11.9,8.2"/></g>',
  LY: '<rect width="30" height="5" fill="#e70013"/><rect y="5" width="30" height="10" fill="#000"/><rect y="15" width="30" height="5" fill="#239e46"/><path d="M16.2 7.4A3 3 0 1 0 16.2 12.6A2.4 2.4 0 1 1 16.2 7.4Z" fill="#fff"/><g fill="#fff">' + starPts(17.2, 10, 1.2) + '</g>',
  KP: '<rect width="30" height="20" fill="#024fa2"/><rect y="3.4" width="30" height="13.2" fill="#fff"/><rect y="4.4" width="30" height="11.2" fill="#ed1c27"/><circle cx="10.5" cy="10" r="4" fill="#fff"/><g fill="#ed1c27">' + starPts(10.5, 10.3, 3.7) + '</g>',
};

export function flagSVG(code) {
  return `<svg viewBox="0 0 30 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${FLAG_SVG[code] || '<rect width="30" height="20" fill="#ccc"/>'}</svg>`;
}

export function flagEl(code, title = '') {
  const span = document.createElement('span');
  span.className = 'flag';
  if (title) span.title = title;
  span.innerHTML = flagSVG(code);
  return span;
}

// Images prêtes à dessiner sur la carte (chargées une seule fois).
const images = {};
export function flagImage(code) {
  if (images[code]) return images[code];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(code).replace('<svg ', '<svg width="60" height="40" '));
  images[code] = img;
  return img;
}
