// Toutes les icônes : dessins (icons.mjs, more.mjs), émojis servis (cps.mjs) et plage unicode de la police.
import { EM, svgOf } from './icons.mjs';
import { MORE } from './more.mjs';
import { CPS } from './cps.mjs';

Object.assign(EM, MORE);

// Caractères sans dessin propre, servis vides et sans chasse : sélecteurs de variante, ZWJ,
// et ✈ (il n'apparaît que dans 🧑‍✈️, le capitaine, dessiné par 🧑).
export const ZERO_WIDTH = [0xfe0e, 0xfe0f, 0x200d, 0x2708];

export const codepoints = () => [...new Set([...Object.values(CPS).flat().map((c) => c.codePointAt(0)), ...ZERO_WIDTH])].sort((a, b) => a - b);

// Plage unicode de la @font-face : la police ne sert que ces caractères (le texte n'attend jamais son chargement).
export function unicodeRange() {
  const cps = codepoints(), out = [];
  for (let i = 0; i < cps.length; i++) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    const hex = (n) => n.toString(16).toUpperCase();
    out.push(j > i ? `U+${hex(cps[i])}-${hex(cps[j])}` : `U+${hex(cps[i])}`);
    i = j;
  }
  return out.join(', ');
}

export { EM, svgOf, CPS };
