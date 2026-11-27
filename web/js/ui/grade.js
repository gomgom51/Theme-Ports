// Échelle de notation, la même partout dans le jeu (fidélité d'un chargeur, discrétion d'un navire,
// rang d'une compétence) : des barres qui montent, comme un indicateur de signal. Cinq crans en
// général ; une valeur entre deux crans remplit la moitié basse de la barre suivante.
import { h } from './dom.js';

const W = 4, GAP = 2, H = 12;

export function gradeSVG(value, max = 5) {
  const v = Math.max(0, Math.min(max, value));
  const width = max * W + (max - 1) * GAP;
  let s = `<svg class="grade-svg" viewBox="0 0 ${width} ${H}" width="${width * 1.25}" height="${H * 1.25}" aria-hidden="true">`;
  for (let i = 0; i < max; i++) {
    const bh = Math.round(H * (0.35 + (0.65 * (i + 1)) / max));
    const x = i * (W + GAP), y = H - bh;
    s += `<rect x="${x}" y="${y}" width="${W}" height="${bh}" rx="1" class="grade-empty"/>`;
    const fill = Math.max(0, Math.min(1, v - i));
    if (fill > 0) s += `<rect x="${x}" y="${H - bh * fill}" width="${W}" height="${bh * fill}" rx="1" class="grade-full"/>`;
  }
  return s + '</svg>';
}

// title : texte de la bulle (ex. « Fidélité 7/10 ») ; cls : classe de couleur (good, warn, bad…).
export function gradeEl(value, { max = 5, title = '', cls = '' } = {}) {
  return h('span.grade', { class: cls || null, title: title || null, role: 'img', 'aria-label': title || `${value}/${max}`, html: gradeSVG(value, max) });
}
