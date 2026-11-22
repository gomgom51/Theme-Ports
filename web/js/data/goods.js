// Marchandises. Prix de base en dollars par tonne (ordre de grandeur réel).
//  holds   : types de cales capables de les transporter
//  spread  : écart de prix typique entre un port exportateur et un port importateur
//  vol     : volatilité quotidienne du cours mondial
//  depth   : profondeur de marché de référence (tonnes) : acheter ou vendre
//            cette quantité dans un grand port déplace le prix d'environ 10 %
export const GOODS = {
  cereales:    { name: 'Céréales',           icon: '🌾', price: 260,  holds: ['vrac'],                 spread: 0.22, vol: 0.010, depth: 400000 },
  minerai:     { name: 'Minerai de fer',     icon: '⛰️', price: 110,  holds: ['vrac'],                 spread: 0.28, vol: 0.012, depth: 900000 },
  charbon:     { name: 'Charbon',            icon: '⚫', price: 140,  holds: ['vrac'],                 spread: 0.24, vol: 0.012, depth: 700000 },
  engrais:     { name: 'Engrais',            icon: '🧪', price: 380,  holds: ['vrac'],                 spread: 0.18, vol: 0.010, depth: 250000 },
  brut:        { name: 'Pétrole brut',       icon: '🛢️', price: 560,  holds: ['liquide'],              spread: 0.10, vol: 0.016, depth: 1200000 },
  raffines:    { name: 'Produits raffinés',  icon: '⛽', price: 760,  holds: ['liquide'],              spread: 0.12, vol: 0.015, depth: 600000 },
  manufactures:{ name: 'Biens manufacturés', icon: '📦', price: 2600, holds: ['conteneurs', 'divers'], spread: 0.075, vol: 0.004, depth: 300000 },
  machines:    { name: 'Machines',           icon: '⚙️', price: 5200, holds: ['conteneurs', 'divers'], spread: 0.065, vol: 0.004, depth: 120000 },
  acier:       { name: 'Acier',              icon: '🏗️', price: 720,  holds: ['divers', 'vrac'],       spread: 0.14, vol: 0.009, depth: 300000 },
  cafe_cacao:  { name: 'Café et cacao',      icon: '☕', price: 3600, holds: ['conteneurs', 'divers'], spread: 0.09, vol: 0.016, depth: 80000 },
  bois:        { name: 'Bois',               icon: '🪵', price: 260,  holds: ['divers', 'vrac'],       spread: 0.20, vol: 0.008, depth: 200000 },
};

export const HOLDS = {
  vrac: 'Vrac sec',
  liquide: 'Vrac liquide',
  divers: 'Marchandises diverses',
  conteneurs: 'Conteneurs',
};

export const GOOD_IDS = Object.keys(GOODS);
