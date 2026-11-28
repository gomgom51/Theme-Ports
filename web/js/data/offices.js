// Niveaux de la compagnie (sa maturité) : le bureau s'embellit avec la valeur nette.
// Un niveau atteint est acquis (company.level) : il sert aussi de condition aux rachats et
// aux victoires. half : seuil où la musique passe à la seconde chanson du niveau.
export const OFFICE_TIERS = [
  { min: 0, half: 10e6, name: 'Le cagibi du quai', text: 'Un bureau de fortune au bout du quai. Tout commence ici.' },
  { min: 15e6, half: 23e6, name: 'Le bureau sur le port', text: 'Une vraie fenêtre sur le port et des dossiers bien rangés.' },
  { min: 35e6, half: 55e6, name: 'Le siège de la compagnie', text: 'Boiseries, tableaux de navires et maquette sur le bureau.' },
  { min: 100e6, half: 175e6, name: 'L\'étage de direction', text: 'Une baie vitrée sur tout le port. Les banquiers vous appellent.' },
  { min: 300e6, half: 600e6, name: 'La tour de verre', text: 'Le sommet d\'une tour. Le port entier à vos pieds.' },
];
export function officeTier(netWorth) {
  let k = 0;
  OFFICE_TIERS.forEach((t, i) => { if (netWorth >= t.min) k = i; });
  return k;
}
