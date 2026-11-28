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

// half : seuil où la musique passe à la seconde chanson du niveau (niveauNb.mp3).
// Sous LOW (la compagnie a perdu de l'argent depuis ses débuts), thème du niveau 0.
export const MUSIC_LOW = 5e6;
// Morceau de la partie : -1 (niveau 0, la compagnie perd de l'argent), puis 0 à 9 (deux par niveau).
// level : niveau déjà atteint (company.level). Un niveau atteint est acquis : en repassant
// sous son seuil, on garde son bureau et sa musique (la première chanson du niveau) ; seul le
// niveau 0 (sous MUSIC_LOW) ramène au cagibi et au thème du doute.
export function musicStep(netWorth, level = 0) {
  if (netWorth < MUSIC_LOW) return -1;
  const t = Math.max(level, officeTier(netWorth));
  return t * 2 + (netWorth >= OFFICE_TIERS[t].half ? 1 : 0);
}
// Niveau atteint par la compagnie (0 à 4), et bureau affiché (le cagibi au niveau 0).
export const reachedTier = (company, netWorth) => Math.max(company?.level ?? 0, officeTier(netWorth));
export const shownTier = (company, netWorth) => (netWorth < MUSIC_LOW ? 0 : reachedTier(company, netWorth));
