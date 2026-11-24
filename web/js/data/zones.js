// Côtes sensibles : une pollution y coûte bien plus cher à nettoyer.
//  lon, lat, r : centre et rayon de la zone (milles nautiques)
//  factor      : multiplicateur du coût de nettoyage
//  flag        : pays qui peut interdire ses ports au pollueur négligent
export const ZONES = [
  { id: 'bretagne', name: 'Côtes de Bretagne et Manche', flag: 'FR', lon: -3.6, lat: 48.9, r: 170, factor: 3 },
  { id: 'wadden', name: 'Mer des Wadden', flag: 'NL', lon: 6.6, lat: 53.7, r: 110, factor: 3.5 },
  { id: 'baltique', name: 'Mer Baltique', flag: 'PL', lon: 17.5, lat: 55.6, r: 220, factor: 2 },
  { id: 'riviera', name: 'Côte d\'Azur et Ligurie', flag: 'IT', lon: 7.6, lat: 43.7, r: 110, factor: 2.5 },
  { id: 'egee', name: 'Îles de la mer Égée', flag: 'GR', lon: 25.2, lat: 37.6, r: 190, factor: 2.5 },
  { id: 'mer_rouge', name: 'Récifs de la mer Rouge', flag: 'EG', lon: 35.6, lat: 25.2, r: 280, factor: 2.5 },
  { id: 'golfe', name: 'Mangroves du Golfe', flag: 'AE', lon: 53.4, lat: 25.4, r: 180, factor: 1.5 },
  { id: 'malacca', name: 'Détroit de Malacca', flag: 'MY', lon: 100.6, lat: 3.4, r: 190, factor: 1.6 },
  { id: 'barriere', name: 'Grande Barrière de corail', flag: 'AU', lon: 148.5, lat: -18.5, r: 420, factor: 5 },
  { id: 'tokyo', name: 'Baie de Tokyo et mer Intérieure', flag: 'JP', lon: 136.8, lat: 34.4, r: 190, factor: 3 },
  { id: 'cap', name: 'Côte du Cap', flag: 'ZA', lon: 19.2, lat: -34.6, r: 190, factor: 2 },
  { id: 'mexique', name: 'Golfe du Mexique', flag: 'US', lon: -90.5, lat: 28.6, r: 280, factor: 2 },
  { id: 'caraibes', name: 'Récifs des Caraïbes', flag: 'CO', lon: -77.5, lat: 13.5, r: 300, factor: 2.5 },
  { id: 'nz', name: 'Golfe d\'Hauraki', flag: 'NZ', lon: 175.2, lat: -36.4, r: 120, factor: 3 },
  { id: 'alaska', name: 'Détroit du Prince-William', flag: 'US', lon: -146.8, lat: 60.6, r: 160, factor: 4 },
  { id: 'hudson', name: 'Baie d\'Hudson', flag: 'CA', lon: -92.5, lat: 59.5, r: 260, factor: 3 },
  { id: 'kara', name: 'Mer de Kara', flag: 'RU', lon: 70, lat: 72.5, r: 280, factor: 4 },
  { id: 'beaufort', name: 'Mer de Beaufort', flag: 'US', lon: -149, lat: 71, r: 220, factor: 5 },
];
