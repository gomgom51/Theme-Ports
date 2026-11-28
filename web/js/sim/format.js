// Mise en forme des nombres, des sommes et des pourcentages, pour tout le jeu : la simulation
// (notifications, journal, journal de bord) et les écrans (ui/dom.js les reprend tels quels).
// Une seule façon d'écrire une somme : « 8 500 $ », « 450 k$ », « 12,45 M$ », « 300 M$ », « 1,2 Md$ ».
// Le français est la langue source ; i18n.js convertit ces formats en anglais à l'affichage
// (« 12,45 M$ » → « $12.45M »). Pas de copie locale de ces fonctions ailleurs (docs/code-health.md).
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

// Deux décimales en millions et milliards, sauf pour un compte rond (« 300 M$ », pas « 300,00 M$ »).
const big = (x) => (Math.abs(Math.round(x * 100) - Math.round(x) * 100) < 1e-9 ? nf0 : nf2).format(x);

// Une somme en dollars ; signed : « +450 k$ » pour un gain.
export function money(v, signed = false) {
  const s = signed && v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${s}${big(a / 1e9)} Md$`;
  if (a >= 1e6) return `${s}${big(a / 1e6)} M$`;
  if (a >= 1e4) return `${s}${nf0.format(a / 1e3)} k$`;
  return `${s}${nf0.format(a)} $`;
}
export const num = (v) => nf0.format(v);
export const num1 = (v) => nf1.format(v);
export const tonnes = (v) => `${nf0.format(v)} t`;
// Un nombre déjà en pour cent (0 à 100) : « 12 % ».
export const pct = (v) => `${nf0.format(v)} %`;
// Une part (0 à 1) en pour cent : « 0,12 » → « 12 % ».
export const pctOf = (x) => `${nf0.format(x * 100)} %`;
// Une probabilité, lisible même petite : « moins de 0,1 % », « 0,4 % », « 12 % ».
export const chance = (p) => (p < 0.001 ? 'moins de 0,1 %' : p < 0.01 ? `${nf1.format(p * 100)} %` : `${nf0.format(p * 100)} %`);
// Un nombre avec d décimales exactement : « 2,50 ».
export const dec = (x, d = 0) => x.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
