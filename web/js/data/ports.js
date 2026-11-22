// Pavillons : ce que le pays du port d'attache apporte à la compagnie.
//  tax      : impôt sur les bénéfices
//  crew     : coefficient sur les salaires d'équipage
//  subsidy  : aide à la construction sur les navires neufs
//  rating   : qualité du registre (réputation de départ, accès au crédit)
//  rate     : taux d'intérêt annuel des prêts
export const FLAGS = {
  NL: { name: 'Pays-Bas',        tax: 0.10, crew: 1.30, subsidy: 0.00, rating: 85, rate: 0.045 },
  DE: { name: 'Allemagne',       tax: 0.13, crew: 1.40, subsidy: 0.00, rating: 85, rate: 0.045 },
  FR: { name: 'France',          tax: 0.15, crew: 1.45, subsidy: 0.04, rating: 82, rate: 0.050 },
  GR: { name: 'Grèce',           tax: 0.05, crew: 1.05, subsidy: 0.00, rating: 70, rate: 0.065 },
  EG: { name: 'Égypte',          tax: 0.22, crew: 0.70, subsidy: 0.00, rating: 45, rate: 0.120 },
  SA: { name: 'Arabie saoudite', tax: 0.05, crew: 0.95, subsidy: 0.00, rating: 55, rate: 0.060 },
  AE: { name: 'Émirats arabes unis', tax: 0.00, crew: 0.90, subsidy: 0.00, rating: 62, rate: 0.055 },
  IN: { name: 'Inde',            tax: 0.25, crew: 0.65, subsidy: 0.00, rating: 55, rate: 0.090 },
  SG: { name: 'Singapour',       tax: 0.00, crew: 1.05, subsidy: 0.00, rating: 86, rate: 0.040 },
  CN: { name: 'Chine',           tax: 0.20, crew: 0.75, subsidy: 0.12, rating: 60, rate: 0.050 },
  KR: { name: 'Corée du Sud',    tax: 0.18, crew: 0.95, subsidy: 0.10, rating: 75, rate: 0.050 },
  JP: { name: 'Japon',           tax: 0.25, crew: 1.30, subsidy: 0.08, rating: 86, rate: 0.020 },
  AU: { name: 'Australie',       tax: 0.30, crew: 1.65, subsidy: 0.00, rating: 85, rate: 0.055 },
  ZA: { name: 'Afrique du Sud',  tax: 0.27, crew: 0.80, subsidy: 0.00, rating: 55, rate: 0.100 },
  NG: { name: 'Nigeria',         tax: 0.30, crew: 0.60, subsidy: 0.00, rating: 30, rate: 0.160 },
  CI: { name: 'Côte d\'Ivoire',  tax: 0.25, crew: 0.60, subsidy: 0.00, rating: 38, rate: 0.120 },
  BR: { name: 'Brésil',          tax: 0.34, crew: 0.90, subsidy: 0.05, rating: 50, rate: 0.120 },
  AR: { name: 'Argentine',       tax: 0.35, crew: 0.85, subsidy: 0.00, rating: 35, rate: 0.250 },
  US: { name: 'États-Unis',      tax: 0.21, crew: 1.85, subsidy: 0.00, rating: 80, rate: 0.050 },
  CA: { name: 'Canada',          tax: 0.26, crew: 1.55, subsidy: 0.00, rating: 82, rate: 0.050 },
  QA: { name: 'Qatar',           tax: 0.10, crew: 0.90, subsidy: 0.00, rating: 65, rate: 0.055 },
  PA: { name: 'Panama',          tax: 0.00, crew: 0.70, subsidy: 0.00, rating: 40, rate: 0.070 },
};

// Ports. Coordonnées réelles (le routage les rattache à la mer la plus proche).
//  size      : 1 (petit) à 5 (géant) : profondeur des marchés, cadence de manutention
//  draft     : tirant d'eau maximal accepté (m)
//  terminals : cales que le port sait charger et décharger
//  deep      : terminaux plus profonds que le port principal, par type de cale
//              (bouées pétrolières au large, quais minéraliers) : { liquide: 22 }
//  fuel      : coefficient sur le prix mondial du fuel
//  repair    : 0 = aucun chantier, 1 = réparations simples (jusqu'à 70 %),
//              2 = chantier complet, 3 = grand chantier (moins cher)
//  fees      : coefficient sur les taxes portuaires, pilotes et remorqueurs
//  exp / imp : marchandises exportées / importées et leur intensité (0 à 1)
//  blurb     : avantages et inconvénients, affichés au choix du port d'attache
const STD = ['vrac', 'liquide', 'divers', 'conteneurs'];

export const PORTS = {
  rotterdam: {
    name: 'Rotterdam', flag: 'NL', lat: 51.95, lon: 4.05, size: 5, draft: 24,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], fuel: 0.97, repair: 3, fees: 1.15,
    exp: { raffines: 0.9, machines: 0.6, manufactures: 0.5, engrais: 0.4, chimie: 0.9, colis: 0.3 },
    imp: { brut: 1, minerai: 0.7, charbon: 0.6, cereales: 0.4, cafe_cacao: 0.5, bois: 0.3, gnl: 0.6, fruits: 1, vehicules: 0.5, gpl: 0.3, manufactures: 0.6 },
    blurb: 'Le plus grand port d\'Europe : tout y passe, mais tout y coûte cher.',
  },
  hambourg: {
    name: 'Hambourg', flag: 'DE', lat: 53.54, lon: 9.95, size: 4, draft: 15.1,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], fuel: 1.0, repair: 2, fees: 1.1,
    exp: { machines: 1, manufactures: 0.6, acier: 0.3, chimie: 0.5, vehicules: 0.6, colis: 0.8 },
    imp: { cafe_cacao: 0.8, minerai: 0.5, charbon: 0.4, brut: 0.4, fruits: 0.6 },
    blurb: 'Porte de l\'industrie allemande. Accès par l\'Elbe : tirant d\'eau limité.',
  },
  le_havre: {
    name: 'Le Havre', flag: 'FR', lat: 49.48, lon: 0.1, size: 4, draft: 16,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 22 }, fuel: 1.02, repair: 2, fees: 1.05,
    exp: { cereales: 0.9, machines: 0.5, raffines: 0.4, vehicules: 0.3, chimie: 0.3 },
    imp: { brut: 0.7, manufactures: 0.6, cafe_cacao: 0.4, bois: 0.4, fruits: 0.5, gpl: 0.2 },
    blurb: 'Grand port céréalier. Pavillon solide mais équipages coûteux.',
  },
  marseille: {
    name: 'Marseille', flag: 'FR', lat: 43.33, lon: 5.33, size: 3, draft: 14.5,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo'], deep: { liquide: 22 }, fuel: 1.03, repair: 2, fees: 1.0,
    exp: { raffines: 0.8, acier: 0.4, chimie: 0.3 },
    imp: { brut: 0.9, manufactures: 0.5, cereales: 0.2, gnl: 0.4, gpl: 0.3, fruits: 0.4 },
    blurb: 'Au cœur de la Méditerranée, à deux pas du canal de Suez.',
  },
  piree: {
    name: 'Le Pirée', flag: 'GR', lat: 37.94, lon: 23.6, size: 4, draft: 18,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo'], fuel: 0.96, repair: 2, fees: 0.9,
    exp: { raffines: 0.4, manufactures: 0.3 },
    imp: { cereales: 0.6, brut: 0.5, manufactures: 0.4, bois: 0.3, vehicules: 0.3, fruits: 0.3, chimie: 0.3, gnl: 0.2, gpl: 0.2 },
    blurb: 'Nation d\'armateurs : impôts légers et équipages expérimentés.',
  },
  alexandrie: {
    name: 'Alexandrie', flag: 'EG', lat: 31.18, lon: 29.87, size: 3, draft: 12,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 18 }, fuel: 0.92, repair: 1, fees: 0.8,
    exp: { engrais: 0.8, raffines: 0.3 },
    imp: { cereales: 1, bois: 0.5, machines: 0.4, acier: 0.4, chimie: 0.4, gpl: 0.3, vehicules: 0.3, colis: 0.5, fruits: 0.2 },
    blurb: 'Premier importateur de blé au monde. Crédit cher, équipages bon marché.',
  },
  djeddah: {
    name: 'Djeddah', flag: 'SA', lat: 21.45, lon: 39.15, size: 4, draft: 16,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 18 }, fuel: 0.85, repair: 1, fees: 0.9,
    exp: { raffines: 0.7, engrais: 0.5, chimie: 0.5 },
    imp: { cereales: 0.8, manufactures: 0.7, machines: 0.5, acier: 0.4, vehicules: 0.5, fruits: 0.5, colis: 0.7 },
    blurb: 'Sur la mer Rouge, entre Suez et l\'océan Indien. Fuel bon marché.',
  },
  ras_tanura: {
    name: 'Ras Tanura', flag: 'SA', lat: 26.65, lon: 50.17, size: 4, draft: 25,
    terminals: ['liquide', 'gpl'], fuel: 0.8, repair: 0, fees: 0.85,
    exp: { brut: 1, raffines: 0.6, gpl: 0.8 },
    imp: {},
    blurb: 'Terminal pétrolier géant. Uniquement des pétroliers, aucun chantier.',
  },
  dubai: {
    name: 'Dubaï (Jebel Ali)', flag: 'AE', lat: 25.0, lon: 55.05, size: 5, draft: 17,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 20 }, fuel: 0.86, repair: 3, fees: 0.95,
    exp: { raffines: 0.6, manufactures: 0.4, acier: 0.3, gpl: 0.3, vehicules: 0.2 },
    imp: { manufactures: 0.6, machines: 0.6, cereales: 0.5, acier: 0.4, bois: 0.4, vehicules: 0.6, fruits: 0.6, colis: 0.8, gnl: 0.3 },
    blurb: 'Plaque tournante du Golfe : zéro impôt, grand chantier naval.',
  },
  mumbai: {
    name: 'Mumbai', flag: 'IN', lat: 18.95, lon: 72.85, size: 4, draft: 14,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 22 }, fuel: 0.95, repair: 2, fees: 0.85,
    exp: { acier: 0.6, manufactures: 0.5, raffines: 0.5, vehicules: 0.3 },
    imp: { brut: 0.9, engrais: 0.7, charbon: 0.6, machines: 0.5, gpl: 1, gnl: 0.6, chimie: 0.8, colis: 0.6 },
    blurb: 'Équipages les moins chers d\'Asie, mais lourdeurs administratives.',
  },
  singapour: {
    name: 'Singapour', flag: 'SG', lat: 1.26, lon: 103.82, size: 5, draft: 23,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], fuel: 0.9, repair: 3, fees: 0.95,
    exp: { raffines: 1, manufactures: 0.5, machines: 0.4, chimie: 0.7 },
    imp: { brut: 0.9, cereales: 0.3, manufactures: 0.3, gnl: 0.3, gpl: 0.3, fruits: 0.4, colis: 0.3 },
    blurb: 'Le carrefour du monde : fuel le moins cher, chantiers d\'excellence, zéro impôt.',
  },
  shanghai: {
    name: 'Shanghai', flag: 'CN', lat: 30.62, lon: 122.07, size: 5, draft: 17,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { vrac: 22.5, liquide: 24.5 }, fuel: 0.94, repair: 3, fees: 0.9,
    exp: { manufactures: 1, machines: 0.6, acier: 0.8, vehicules: 0.6, colis: 1, chimie: 0.3 },
    imp: { minerai: 1, charbon: 0.8, brut: 0.8, cereales: 0.6, bois: 0.5, cafe_cacao: 0.2, gnl: 0.8, gpl: 0.8, chimie: 0.8, fruits: 0.5, machines: 0.5 },
    blurb: 'L\'usine du monde. Aides à la construction de navires neufs.',
  },
  busan: {
    name: 'Busan', flag: 'KR', lat: 35.08, lon: 129.06, size: 4, draft: 17,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { vrac: 20, liquide: 22 }, fuel: 0.95, repair: 3, fees: 0.95,
    exp: { machines: 0.7, acier: 0.7, manufactures: 0.6, vehicules: 0.9, colis: 0.7, chimie: 0.4 },
    imp: { minerai: 0.7, charbon: 0.7, brut: 0.7, cereales: 0.4, gnl: 0.8, gpl: 0.6, fruits: 0.3, manufactures: 0.3 },
    blurb: 'Patrie des grands chantiers navals : navires neufs aidés, réparations rapides.',
  },
  yokohama: {
    name: 'Yokohama', flag: 'JP', lat: 35.44, lon: 139.66, size: 4, draft: 16,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { vrac: 20, liquide: 22 }, fuel: 1.02, repair: 3, fees: 1.15,
    exp: { machines: 1, manufactures: 0.5, acier: 0.4, vehicules: 1, colis: 0.6 },
    imp: { charbon: 0.7, minerai: 0.6, brut: 0.7, cereales: 0.6, bois: 0.5, gnl: 1, gpl: 0.7, fruits: 0.7, chimie: 0.4, manufactures: 0.5 },
    blurb: 'Crédit presque gratuit et réputation impeccable, mais tout est cher.',
  },
  port_hedland: {
    name: 'Port Hedland', flag: 'AU', lat: -20.31, lon: 118.58, size: 4, draft: 19.5,
    terminals: ['vrac'], fuel: 1.1, repair: 0, fees: 1.0,
    exp: { minerai: 1 },
    imp: {},
    blurb: 'Premier port minéralier du monde. Vraquiers uniquement, aucun chantier.',
  },
  sydney: {
    name: 'Sydney', flag: 'AU', lat: -33.85, lon: 151.25, size: 3, draft: 14,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], deep: { vrac: 18.5 }, fuel: 1.08, repair: 2, fees: 1.1,
    exp: { charbon: 0.8, cereales: 0.6, minerai: 0.2, fruits: 0.4 },
    imp: { manufactures: 0.7, raffines: 0.7, machines: 0.5, vehicules: 0.7, chimie: 0.2, colis: 0.4 },
    blurb: 'Charbon et blé à exporter, mais loin de tout et salaires élevés.',
  },
  durban: {
    name: 'Durban', flag: 'ZA', lat: -29.87, lon: 31.03, size: 3, draft: 12.8,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 17 }, fuel: 0.98, repair: 2, fees: 0.9,
    exp: { charbon: 0.7, minerai: 0.4, acier: 0.3, fruits: 0.6, vehicules: 0.3 },
    imp: { brut: 0.6, manufactures: 0.6, cereales: 0.3, machines: 0.4, chimie: 0.4, colis: 0.4 },
    blurb: 'Escale obligée sur la route du Cap quand Suez est fermé.',
  },
  lagos: {
    name: 'Lagos', flag: 'NG', lat: 6.43, lon: 3.4, size: 3, draft: 13.5,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 22 }, fuel: 1.05, repair: 1, fees: 1.1,
    exp: { brut: 0.9, cafe_cacao: 0.4, gnl: 0.6, gpl: 0.3 },
    imp: { raffines: 1, cereales: 0.6, manufactures: 0.7, machines: 0.4, vehicules: 0.4, chimie: 0.4, colis: 0.6, fruits: 0.2 },
    blurb: 'Exporte du brut et importe son essence ! Gros marché, crédit hors de prix.',
  },
  abidjan: {
    name: 'Abidjan', flag: 'CI', lat: 5.25, lon: -4.0, size: 2, draft: 13,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], fuel: 1.04, repair: 1, fees: 0.95,
    exp: { cafe_cacao: 1, bois: 0.6, fruits: 0.7 },
    imp: { raffines: 0.6, cereales: 0.6, manufactures: 0.5, chimie: 0.2, vehicules: 0.2, colis: 0.3 },
    blurb: 'Capitale mondiale du cacao. Petit marché, risque de prix élevé.',
  },
  santos: {
    name: 'Santos', flag: 'BR', lat: -23.98, lon: -46.3, size: 4, draft: 15,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], fuel: 1.0, repair: 2, fees: 1.0,
    exp: { cereales: 1, cafe_cacao: 0.9, minerai: 0.5, bois: 0.3, fruits: 0.8, vehicules: 0.2 },
    imp: { engrais: 0.9, machines: 0.6, manufactures: 0.5, raffines: 0.5, chimie: 0.6, gpl: 0.3, colis: 0.4, vehicules: 0.3 },
    blurb: 'Soja, café, sucre : un géant agricole. Impôts lourds.',
  },
  buenos_aires: {
    name: 'Buenos Aires', flag: 'AR', lat: -34.6, lon: -58.37, size: 3, draft: 10,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], fuel: 1.05, repair: 1, fees: 0.95,
    exp: { cereales: 1, bois: 0.3, fruits: 0.6 },
    imp: { machines: 0.6, manufactures: 0.5, engrais: 0.6, raffines: 0.4, chimie: 0.4, vehicules: 0.3, colis: 0.3 },
    blurb: 'Grenier à blé, mais au fond du Río de la Plata : 10 m de tirant d\'eau maximum.',
  },
  colon: {
    name: 'Colón', flag: 'PA', lat: 9.37, lon: -79.9, size: 3, draft: 15,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], fuel: 0.93, repair: 2, fees: 0.85,
    exp: { manufactures: 0.3, fruits: 1 },
    imp: { raffines: 0.5, manufactures: 0.3, vehicules: 0.2, colis: 0.2 },
    blurb: 'Pavillon de complaisance : zéro impôt et équipages bon marché, réputation médiocre.',
  },
  new_york: {
    name: 'New York', flag: 'US', lat: 40.6, lon: -74.05, size: 5, draft: 15.2,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], fuel: 1.04, repair: 2, fees: 1.2,
    exp: { machines: 0.4, raffines: 0.4 },
    imp: { manufactures: 1, cafe_cacao: 0.6, acier: 0.4, brut: 0.4, machines: 0.4, fruits: 0.8, vehicules: 0.8, chimie: 0.4 },
    blurb: 'Le plus gros marché de consommation. Équipages américains très chers.',
  },
  houston: {
    name: 'Houston', flag: 'US', lat: 29.35, lon: -94.75, size: 5, draft: 14,
    terminals: [...STD, 'chimique', 'gpl', 'gnl', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 25 }, fuel: 0.92, repair: 2, fees: 1.05,
    exp: { raffines: 1, brut: 0.6, cereales: 0.6, engrais: 0.3, chimie: 1, gpl: 1, gnl: 0.7, colis: 0.3 },
    imp: { manufactures: 0.5, acier: 0.5, machines: 0.4, colis: 0.5, vehicules: 0.3 },
    blurb: 'Capitale de la pétrochimie : produits raffinés à profusion.',
  },
  los_angeles: {
    name: 'Los Angeles', flag: 'US', lat: 33.73, lon: -118.26, size: 5, draft: 16,
    terminals: [...STD, 'chimique', 'vehicules', 'frigo', 'lourd'], deep: { liquide: 20 }, fuel: 1.06, repair: 2, fees: 1.2,
    exp: { cereales: 0.3, raffines: 0.3, machines: 0.4 },
    imp: { manufactures: 1, machines: 0.6, brut: 0.5, acier: 0.3, vehicules: 1, fruits: 0.5, chimie: 0.4 },
    blurb: 'Porte d\'entrée des produits asiatiques en Amérique.',
  },
  vancouver: {
    name: 'Vancouver', flag: 'CA', lat: 49.29, lon: -123.12, size: 4, draft: 15.5,
    terminals: [...STD, 'chimique', 'gpl', 'vehicules', 'frigo', 'lourd'], fuel: 1.03, repair: 2, fees: 1.05,
    exp: { cereales: 0.9, charbon: 0.7, bois: 1, engrais: 0.6, gpl: 0.3 },
    imp: { manufactures: 0.6, machines: 0.4, vehicules: 0.4, colis: 0.3 },
    blurb: 'Céréales, charbon, bois et potasse vers l\'Asie.',
  },
  ras_laffan: {
    name: 'Ras Laffan', flag: 'QA', lat: 25.92, lon: 51.6, size: 4, draft: 15.5,
    terminals: ['liquide', 'gnl', 'gpl'], fuel: 0.82, repair: 2, fees: 0.9,
    exp: { gnl: 1, gpl: 0.8, raffines: 0.3 },
    imp: {},
    blurb: 'Capitale mondiale du gaz liquéfié. Gaz et liquides seulement, mais un chantier spécialisé dans les méthaniers.',
  },
  tubarao: {
    name: 'Tubarão', flag: 'BR', lat: -20.29, lon: -40.24, size: 4, draft: 20,
    terminals: ['vrac', 'divers'], fuel: 1.02, repair: 0, fees: 0.9,
    exp: { minerai: 1, acier: 0.4 },
    imp: { charbon: 0.6 },
    blurb: 'Le grand port minéralier du Brésil, taillé pour les Capesize. Aucun chantier, impôts brésiliens.',
  },
  richards_bay: {
    name: 'Richards Bay', flag: 'ZA', lat: -28.8, lon: 32.05, size: 3, draft: 19,
    terminals: ['vrac', 'liquide', 'divers'], fuel: 1.0, repair: 0, fees: 0.85,
    exp: { charbon: 1, minerai: 0.3 },
    imp: { raffines: 0.3, engrais: 0.2 },
    blurb: 'Terminal charbonnier géant de l\'Afrique australe. Profond, mais sans chantier.',
  },
};

export const PORT_IDS = Object.keys(PORTS);

// « 16 m · pétroliers 22 m » : tirant d'eau des quais et des terminaux profonds.
const DEEP_LABEL = { liquide: 'pétroliers', vrac: 'vraquiers' };
export function draftText(P) {
  const fmt = (x) => String(x).replace('.', ',');
  const deep = Object.entries(P.deep || {}).map(([h, d]) => `${DEEP_LABEL[h] || h} ${fmt(d)} m`);
  return `${fmt(P.draft)} m${deep.length ? ` · ${deep.join(', ')}` : ''}`;
}
