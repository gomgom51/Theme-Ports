// Marchandises. Prix de base en dollars par tonne (ordre de grandeur réel).
//  holds   : types de cales capables de les transporter
//  spread  : écart de prix typique entre un port exportateur et un port importateur
//  vol     : volatilité quotidienne du cours mondial
//  depth   : profondeur de marché de référence (tonnes) : acheter ou vendre
//            cette quantité dans un grand port déplace le prix d'environ 10 %
//  lot     : taille typique d'une cargaison (t) : le pétrole brut voyage en
//            superpétroliers, les machines en petits lots
//  hazard  : marchandise dangereuse (pavillon B hissé)
//  pollution : gravité d'un déversement en mer (1 = pétrole brut)
//  perishable : se gâte si le voyage traîne
export const GOODS = {
  cereales:    { name: 'Céréales',           icon: '🌾', price: 260,  holds: ['vrac'],                 spread: 0.22, vol: 0.010, depth: 400000, lot: 35000 },
  minerai:     { name: 'Minerai de fer',     icon: '⛰️', price: 110,  holds: ['vrac'],                 spread: 0.28, vol: 0.012, depth: 900000, lot: 150000 },
  charbon:     { name: 'Charbon',            icon: '⚫', price: 140,  holds: ['vrac'],                 spread: 0.24, vol: 0.012, depth: 700000, lot: 70000 },
  engrais:     { name: 'Engrais',            icon: '🧪', price: 380,  holds: ['vrac'],                 spread: 0.18, vol: 0.010, depth: 250000, lot: 18000, pollution: 0.25 },
  brut:        { name: 'Pétrole brut',       icon: '🛢️', price: 560,  holds: ['liquide'],              spread: 0.085, vol: 0.016, depth: 600000, lot: 200000, pollution: 1 },
  raffines:    { name: 'Produits raffinés',  icon: '⛽', price: 760,  holds: ['liquide'],              spread: 0.12, vol: 0.015, depth: 350000, lot: 40000, pollution: 0.7 },
  manufactures:{ name: 'Biens manufacturés', icon: '📦', price: 2600, holds: ['conteneurs', 'divers'], spread: 0.075, vol: 0.004, depth: 300000, lot: 20000 },
  machines:    { name: 'Machines',           icon: '⚙️', price: 5200, holds: ['conteneurs', 'divers'], spread: 0.065, vol: 0.004, depth: 120000, lot: 5000 },
  acier:       { name: 'Acier',              icon: '🏗️', price: 720,  holds: ['divers', 'vrac'],       spread: 0.14, vol: 0.009, depth: 300000, lot: 12000 },
  cafe_cacao:  { name: 'Café et cacao',      icon: '☕', price: 3600, holds: ['conteneurs', 'divers'], spread: 0.09, vol: 0.016, depth: 80000, lot: 5000 },
  bois:        { name: 'Bois',               icon: '🪵', price: 260,  holds: ['divers', 'vrac'],       spread: 0.20, vol: 0.008, depth: 200000, lot: 9000 },
  chimie:      { name: 'Produits chimiques', icon: '⚗️', price: 1100, holds: ['chimique'],             spread: 0.12, vol: 0.012, depth: 200000, lot: 10000, hazard: true, pollution: 1.3 },
  gpl:         { name: 'GPL (butane, propane)', icon: '🔥', price: 520, holds: ['gpl'],              spread: 0.16, vol: 0.020, depth: 250000, lot: 30000, hazard: true, pollution: 0.15 },
  gnl:         { name: 'Gaz naturel liquéfié', icon: '❄️', price: 480, holds: ['gnl'],               spread: 0.30, vol: 0.025, depth: 500000, lot: 75000, hazard: true, pollution: 0.1 },
  vehicules:   { name: 'Véhicules',          icon: '🚗', price: 9000, holds: ['vehicules'],            spread: 0.06, vol: 0.003, depth: 80000, lot: 15000 },
  fruits:      { name: 'Fruits et viandes',  icon: '🍌', price: 1600, holds: ['frigo'],                spread: 0.22, vol: 0.015, depth: 60000, lot: 6000, perishable: true },
  colis:       { name: 'Colis lourds',       icon: '🏭', price: 9000, holds: ['lourd'],                spread: 0.07, vol: 0.004, depth: 30000, lot: 7000 },
};

// Vertu : les énergies fossiles et les marchandises polluantes (☣) n'en rapportent jamais ; les
// marchandises utiles en rapportent un peu sur tout contrat livré à l'heure.
export const FOSSIL_GOODS = ['brut', 'raffines', 'charbon', 'gpl', 'gnl'];
export const USEFUL_GOODS = ['cereales', 'cafe_cacao', 'fruits', 'bois'];
// Le pétrole (brut et produits raffinés) : chaque livraison coûte un peu de vertu (sim/core.js, oilVirtueLoss).
export const OIL_GOODS = ['brut', 'raffines'];
export const isCleanGood = (g) => !FOSSIL_GOODS.includes(g) && (GOODS[g]?.pollution || 0) < 0.2;

export const HOLDS = {
  vrac: 'Vrac sec',
  liquide: 'Vrac liquide',
  divers: 'Marchandises diverses',
  conteneurs: 'Conteneurs',
  chimique: 'Citernes chimiques',
  gpl: 'Gaz de pétrole liquéfié',
  gnl: 'Gaz naturel liquéfié',
  vehicules: 'Véhicules',
  frigo: 'Cales réfrigérées',
  lourd: 'Colis lourds',
};

export const GOOD_IDS = Object.keys(GOODS);
