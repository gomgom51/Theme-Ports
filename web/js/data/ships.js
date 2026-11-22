// Types de navires. Valeurs inspirées de navires réels, arrondies pour le jeu.
//  dwt        : capacité de chargement (tonnes)
//  holds      : cales disponibles (voir goods.js)
//  speed      : vitesse de service (nœuds) ; maxSpeed : vitesse maximale
//  burn       : consommation à la vitesse de service (tonnes de fuel par jour)
//               elle varie avec le cube de la vitesse
//  idleBurn   : consommation à quai ou au mouillage (t/jour)
//  draft      : tirant d'eau en charge (m) ; un port moins profond est refusé
//  crew       : équipage minimal
//  opex       : coûts fixes journaliers hors carburant et hors équipage ($)
//  price      : prix neuf (millions de $) ; life : durée de vie (années)
//  tank       : capacité des soutes (t de fuel)
//  gt         : jauge brute, sert au calcul des taxes portuaires
export const SHIP_TYPES = {
  caboteur: {
    name: 'Caboteur', category: 'Cargo', dwt: 4500, holds: ['divers', 'vrac'],
    speed: 11, maxSpeed: 12.5, burn: 9, idleBurn: 1.2, draft: 6.5, crew: 9,
    opex: 2200, price: 9, life: 30, tank: 260, gt: 3000,
    blurb: 'Petit et économique. Entre partout, idéal pour démarrer.',
  },
  polyvalent: {
    name: 'Cargo polyvalent', category: 'Cargo', dwt: 12500, holds: ['divers', 'vrac', 'conteneurs'],
    speed: 14, maxSpeed: 15.5, burn: 20, idleBurn: 2.5, draft: 8.6, crew: 14,
    opex: 3600, price: 22, life: 28, tank: 750, gt: 9000,
    blurb: 'Transporte presque tout, avec ses propres grues.',
  },
  vraquier_handy: {
    name: 'Vraquier Handysize', category: 'Vraquier', dwt: 35000, holds: ['vrac'],
    speed: 13.5, maxSpeed: 14.5, burn: 24, idleBurn: 3, draft: 10.2, crew: 19,
    opex: 4200, price: 27, life: 28, tank: 1300, gt: 21000,
    blurb: 'Le cheval de trait du vrac : céréales, minerai, charbon, engrais.',
  },
  petrolier_mr: {
    name: 'Pétrolier de produits (MR)', category: 'Pétrolier', dwt: 48000, holds: ['liquide'],
    speed: 14, maxSpeed: 15, burn: 30, idleBurn: 4, draft: 12.2, crew: 22,
    opex: 5600, price: 42, life: 25, tank: 1600, gt: 29000,
    blurb: 'Brut et produits raffinés. Rentable, mais exigeant en ports.',
  },
  feeder: {
    name: 'Porte-conteneurs feeder', category: 'Porte-conteneurs', dwt: 22000, holds: ['conteneurs'],
    speed: 18, maxSpeed: 20, burn: 46, idleBurn: 3.5, draft: 10, crew: 17,
    opex: 4600, price: 30, life: 25, tank: 1700, gt: 18000,
    blurb: '1 700 conteneurs. Rapide, gourmand en carburant.',
  },
};

// Salaire moyen d'un marin par jour (avant le coefficient du pavillon).
export const CREW_DAY_COST = 140;

// Noms proposés pour les nouveaux navires.
export const SHIP_NAMES = [
  'Albatros', 'Mistral', 'Belle-Île', 'Cormoran', 'Étoile du Nord', 'Goéland', 'Iroise',
  'Kerguelen', 'Lys de Mer', 'Marie-Galante', 'Noroît', 'Ouessant', 'Pélican', 'Roche-Bonne',
  'Saint-Malo', 'Sirocco', 'Tramontane', 'Ushant Star', 'Vent d\'Ouest', 'Zéphyr', 'Aurore',
  'Boréal', 'Cap Horn', 'Dauphin', 'Espadon', 'Fou de Bassan', 'Grand Large', 'Hermine',
  'Islandais', 'Jusant', 'Kraken', 'Laminaire', 'Mascaret', 'Narval', 'Orque', 'Perle Noire',
  'Quiberon', 'Raz de Sein', 'Sterne', 'Thalassa', 'Ulysse', 'Vigie', 'Wapiti', 'Yole',
];
