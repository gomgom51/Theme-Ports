// À qui sont les eaux en un point : eaux nationales (≤ 200 milles d'une côte) ou internationales.
import { COUNTRIES, WATERS } from '../data/countries.js';

let owner = null;
function decode() {
  owner = new Uint8Array(720 * 360);
  const v = WATERS.split(',').map(Number);
  let i = 0;
  for (let k = 0; k < v.length; k += 2) { owner.fill(v[k], i, i + v[k + 1]); i += v[k + 1]; }
}

export function watersAt(lon, lat) {
  if (!owner) decode();
  const col = ((Math.floor((lon + 180) / 0.5) % 720) + 720) % 720;
  const row = Math.min(359, Math.max(0, Math.floor((90 - lat) / 0.5)));
  const k = owner[row * 720 + col];
  return k ? COUNTRIES[k - 1] : null;
}

// Texte lisible : « eaux internationales » ou « eaux nationales : Égypte ».
export function watersLabel(lon, lat) {
  const c = watersAt(lon, lat);
  return c ? `eaux nationales : ${c.n}` : 'eaux internationales';
}
