// Types de navires. Valeurs inspirées de navires réels, arrondies pour le jeu.
//  dwt        : capacité de chargement (tonnes)
//  holds      : cales disponibles (voir goods.js)
//  speed      : vitesse de service (nœuds) ; maxSpeed : vitesse maximale
//  burn       : consommation à la vitesse de service (t de fuel par jour), ∝ vitesse³
//  idleBurn   : consommation à quai ou au mouillage (t/jour)
//  draft      : tirant d'eau en charge (m) ; un port moins profond est refusé
//  crew       : équipage minimal
//  opex       : coûts fixes journaliers hors carburant et hors équipage ($)
//  price      : prix neuf (millions de $) ; life : durée de vie (années)
//  tank       : capacité des soutes (t de fuel) ; gt : jauge brute (taxes portuaires)
//  vintage    : modèle ancien, plus construit : seulement d'occasion, et très âgé
//  gear       : grues de bord (ou mâts de charge) : charge et décharge à bonne cadence même
//               dans un petit port (economy.js, GEAR_SIZE)
//  singleHull : pétrolier à simple coque : refusé dans les ports exigeants (STRICT_FLAGS) sans
//               coque renforcée (incidents.js, hullBarred)
//  stock      : équipement livré avec le navire (core.js, createShip), coupé au départ
export const SHIP_TYPES = {
  // ---------- Marchandises diverses ----------
  caboteur: {
    name: 'Caboteur', category: 'Cargo', dwt: 6000, holds: ['divers', 'vrac'],
    speed: 11.5, maxSpeed: 12.5, burn: 8.5, idleBurn: 1.2, draft: 6.5, crew: 9, gear: true, stock: ['brouilleur'],
    opex: 2200, price: 8, life: 30, tank: 260, gt: 3000,
    blurb: 'Petit et économique. Entre partout, idéal pour démarrer.',
  },
  cargo_ancien: {
    name: 'Vieux cargo', category: 'Cargo', dwt: 9000, holds: ['divers', 'vrac'], vintage: true,
    speed: 12, maxSpeed: 13.5, burn: 15, idleBurn: 2.2, draft: 8.2, crew: 18, gear: true, stock: ['brouilleur'],
    opex: 1900, price: 12, life: 45, tank: 620, gt: 7000,
    blurb: 'Un cargo des années 60 aux mâts de charge. Donné, mais gourmand en fuel et en marins.',
  },
  polyvalent: {
    name: 'Cargo polyvalent', category: 'Cargo', dwt: 12500, holds: ['divers', 'vrac', 'conteneurs'],
    speed: 14, maxSpeed: 15.5, burn: 20, idleBurn: 2.5, draft: 8.6, crew: 14, gear: true, stock: ['brouilleur'],
    opex: 4000, price: 26, life: 28, tank: 750, gt: 9000,
    blurb: 'Transporte presque tout, avec ses propres grues.',
  },
  colis_lourds: {
    name: 'Navire colis lourds', category: 'Cargo', dwt: 14000, holds: ['lourd', 'divers', 'conteneurs'],
    speed: 15, maxSpeed: 16.5, burn: 26, idleBurn: 3, draft: 8.5, crew: 18, gear: true,
    opex: 5200, price: 38, life: 25, tank: 950, gt: 12000,
    blurb: 'Deux grues géantes pour les turbines, chaudières et engins hors normes. Seul à prendre les colis lourds.',
  },
  // ---------- Vraquiers ----------
  vraquier_handy: {
    name: 'Vraquier Handysize', category: 'Vraquier', dwt: 35000, holds: ['vrac'],
    speed: 13.5, maxSpeed: 14.5, burn: 24, idleBurn: 3, draft: 10.2, crew: 19, gear: true,
    opex: 4200, price: 27, life: 28, tank: 1300, gt: 21000,
    blurb: 'Le cheval de trait du vrac : céréales, minerai, charbon, engrais.',
  },
  vraquier_supramax: {
    name: 'Vraquier Supramax', category: 'Vraquier', dwt: 58000, holds: ['vrac'],
    speed: 14, maxSpeed: 15, burn: 30, idleBurn: 3.5, draft: 12.8, crew: 21, gear: true,
    opex: 5000, price: 32, life: 28, tank: 1800, gt: 32000,
    blurb: 'Plus grand, toujours équipé de grues : il charge et décharge partout.',
  },
  vraquier_panamax: {
    name: 'Vraquier Panamax', category: 'Vraquier', dwt: 82000, holds: ['vrac'],
    speed: 14, maxSpeed: 14.8, burn: 34, idleBurn: 4, draft: 14.4, crew: 22,
    opex: 5600, price: 36, life: 28, tank: 2200, gt: 43000,
    blurb: 'Sans grues, taillé pour le canal de Panama. Charbon et céréales en masse.',
  },
  vraquier_capesize: {
    name: 'Vraquier Capesize', category: 'Vraquier', dwt: 180000, holds: ['vrac'],
    speed: 14, maxSpeed: 14.8, burn: 52, idleBurn: 5, draft: 18.2, crew: 24,
    opex: 7500, price: 52, life: 27, tank: 3800, gt: 93000,
    blurb: 'Trop grand pour les canaux, il passe par le cap Horn. Le roi du minerai de fer.',
  },
  // ---------- Pétroliers et chimiquiers ----------
  petrolier_ancien: {
    name: 'Vieux pétrolier', category: 'Pétrolier', dwt: 32000, holds: ['liquide'], vintage: true,
    speed: 14.5, maxSpeed: 15.5, burn: 30, idleBurn: 4, draft: 11.2, crew: 26, singleHull: true,
    opex: 3900, price: 35, life: 45, tank: 1800, gt: 20000,
    blurb: 'Passerelle au milieu, machine à l\'arrière : un pétrolier des années 70. Bon marché, assoiffé.',
  },
  petrolier_mr: {
    name: 'Pétrolier de produits (MR)', category: 'Pétrolier', dwt: 48000, holds: ['liquide'],
    speed: 14, maxSpeed: 15, burn: 30, idleBurn: 4, draft: 12.2, crew: 22,
    opex: 5600, price: 36, life: 25, tank: 1600, gt: 29000,
    blurb: 'Brut et produits raffinés. Rentable, mais exigeant en ports.',
  },
  chimiquier: {
    name: 'Chimiquier', category: 'Pétrolier', dwt: 19000, holds: ['chimique', 'liquide'],
    speed: 14.5, maxSpeed: 15.5, burn: 24, idleBurn: 3, draft: 9.8, crew: 22,
    opex: 6200, price: 32, life: 25, tank: 1000, gt: 13000,
    blurb: 'Des dizaines de citernes inox séparées : produits chimiques et petits lots.',
  },
  petrolier_aframax: {
    name: 'Pétrolier Aframax', category: 'Pétrolier', dwt: 110000, holds: ['liquide'],
    speed: 14.5, maxSpeed: 15.3, burn: 48, idleBurn: 5, draft: 15, crew: 24,
    opex: 7800, price: 62, life: 25, tank: 3200, gt: 62000,
    blurb: 'Le pétrolier des mers régionales : mer du Nord, Méditerranée, Caraïbes.',
  },
  petrolier_suezmax: {
    name: 'Pétrolier Suezmax', category: 'Pétrolier', dwt: 158000, holds: ['liquide'],
    speed: 14.8, maxSpeed: 15.6, burn: 58, idleBurn: 6, draft: 17, crew: 25,
    opex: 8600, price: 78, life: 25, tank: 4000, gt: 81000,
    blurb: 'Le plus grand pétrolier à franchir le canal de Suez chargé.',
  },
  petrolier_vlcc: {
    name: 'Superpétrolier (VLCC)', category: 'Pétrolier', dwt: 300000, holds: ['liquide'],
    speed: 15, maxSpeed: 16, burn: 80, idleBurn: 8, draft: 21.5, crew: 28,
    opex: 10500, price: 120, life: 25, tank: 6500, gt: 160000,
    blurb: '300 000 tonnes de brut. Trop profond pour Suez : il fait le tour de l\'Afrique.',
  },
  petrolier_ulcc: {
    name: 'Géant des mers (ULCC)', category: 'Pétrolier', dwt: 440000, holds: ['liquide'],
    speed: 15.5, maxSpeed: 16.3, burn: 88, idleBurn: 9, draft: 24, crew: 30,
    opex: 12000, price: 115, life: 25, tank: 8500, gt: 234000,
    blurb: 'Le plus grand navire jamais construit. Seule une poignée de terminaux pétroliers peut l\'accueillir.',
  },
  // ---------- Gaz ----------
  gazier: {
    name: 'Gazier (GPL)', category: 'Gazier', dwt: 30000, holds: ['gpl'],
    speed: 16, maxSpeed: 17, burn: 36, idleBurn: 4, draft: 11, crew: 24,
    opex: 7200, price: 58, life: 25, tank: 2000, gt: 26000,
    blurb: 'Cuves cylindriques sous pression pour le butane et le propane.',
  },
  methanier: {
    name: 'Méthanier (GNL)', category: 'Gazier', dwt: 75000, holds: ['gnl'],
    speed: 19, maxSpeed: 20, burn: 110, idleBurn: 9, draft: 11.8, crew: 30,
    opex: 13000, price: 185, life: 30, tank: 5000, gt: 110000,
    blurb: 'Le gaz naturel à −162 °C dans quatre sphères géantes. Le navire de prestige par excellence.',
  },
  // ---------- Porte-conteneurs ----------
  feeder: {
    name: 'Porte-conteneurs feeder', category: 'Porte-conteneurs', dwt: 22000, holds: ['conteneurs'],
    speed: 18, maxSpeed: 20, burn: 46, idleBurn: 3.5, draft: 10, crew: 17,
    opex: 4600, price: 26, life: 25, tank: 1700, gt: 18000,
    blurb: '1 700 conteneurs. Rapide, gourmand en carburant.',
  },
  pc_panamax: {
    name: 'Porte-conteneurs Panamax', category: 'Porte-conteneurs', dwt: 55000, holds: ['conteneurs'],
    speed: 21, maxSpeed: 23, burn: 110, idleBurn: 6, draft: 13.5, crew: 22,
    opex: 9000, price: 75, life: 25, tank: 4500, gt: 52000,
    blurb: '4 500 conteneurs à 21 nœuds. Il franchit les nouvelles écluses de Panama.',
  },
  pc_geant: {
    name: 'Porte-conteneurs géant', category: 'Porte-conteneurs', dwt: 200000, holds: ['conteneurs'],
    speed: 22, maxSpeed: 23.5, burn: 190, idleBurn: 12, draft: 16, crew: 26,
    opex: 18000, price: 180, life: 25, tank: 12000, gt: 220000,
    blurb: '20 000 conteneurs, 400 mètres : le vaisseau amiral du commerce mondial.',
  },
  // ---------- Navires spécialisés ----------
  porte_voitures: {
    name: 'Transporteur de voitures', category: 'Spécialisé', dwt: 21000, holds: ['vehicules'],
    speed: 19, maxSpeed: 20.5, burn: 65, idleBurn: 5, draft: 10, crew: 22,
    opex: 8500, price: 85, life: 25, tank: 3000, gt: 70000,
    blurb: 'Une boîte à chaussures flottante : 6 500 véhicules sur douze ponts.',
  },
  frigorifique: {
    name: 'Navire frigorifique', category: 'Spécialisé', dwt: 12000, holds: ['frigo'],
    speed: 20, maxSpeed: 22, burn: 45, idleBurn: 4, draft: 9.5, crew: 20,
    opex: 7000, price: 40, life: 25, tank: 1500, gt: 11000,
    blurb: 'Coque blanche et cales à −25 °C : fruits et viandes, à toute vitesse.',
  },
};

// Salaire moyen d'un marin par jour (avant le coefficient du pavillon).
export const CREW_DAY_COST = 140;

// Qualité de l'équipage : un équipage plus aguerri coûte plus cher, provoque moins
// d'incidents et sait mieux évaluer les dangers (le joueur voit des risques plus précis).
//  wage   : coefficient sur les salaires
//  safety : coefficient sur la fréquence des incidents et le risque de naufrage
//  info   : 0 avis qualitatif, 1 fourchettes, 2 chiffres précis et risque du voyage
export const CREW_LEVELS = [
  { name: 'Équipage de base', short: 'de base', wage: 1, safety: 1, info: 0,
    blurb: 'Le minimum réglementaire. Le capitaine ne vous donne qu\'un avis général sur les dangers.' },
  { name: 'Équipage confirmé', short: 'confirmé', wage: 1.35, safety: 0.85, info: 1,
    blurb: 'Des officiers expérimentés : moins d\'incidents, et une estimation chiffrée des risques.' },
  { name: 'Équipage chevronné', short: 'chevronné', wage: 1.8, safety: 0.7, info: 2,
    blurb: 'Le chef mécanicien connaît chaque boulon : beaucoup moins d\'incidents, risques évalués précisément, voyage par voyage.' },
];

// Noms proposés pour les nouveaux navires.
export const SHIP_NAMES = [
  'Albatros', 'Mistral', 'Belle-Île', 'Cormoran', 'Étoile du Nord', 'Goéland', 'Iroise',
  'Kerguelen', 'Lys de Mer', 'Marie-Galante', 'Noroît', 'Ouessant', 'Pélican', 'Roche-Bonne',
  'Saint-Malo', 'Sirocco', 'Tramontane', 'Ushant Star', 'Vent d\'Ouest', 'Zéphyr', 'Aurore',
  'Boréal', 'Cap Horn', 'Dauphin', 'Espadon', 'Fou de Bassan', 'Grand Large', 'Hermine',
  'Islandais', 'Jusant', 'Kraken', 'Laminaire', 'Mascaret', 'Narval', 'Orque', 'Perle Noire',
  'Quiberon', 'Raz de Sein', 'Sterne', 'Thalassa', 'Ulysse', 'Vigie', 'Wapiti', 'Yole',
  'Alizé', 'Bel Espoir', 'Calypso', 'Dunkerque', 'Écume', 'Finistère', 'Glénan', 'Houat',
  'Île de Batz', 'Joséphine', 'Korrigan', 'Lorient', 'Maëlstrom', 'Nantes', 'Océane', 'Penmarc\'h',
  'Rochebonne', 'Sein', 'Tévennec', 'Valparaiso', 'Ys', 'Zanzibar', 'Armen', 'Bréhat',
];
