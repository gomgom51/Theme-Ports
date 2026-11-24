// Chargeurs (clients des contrats de fret). Entreprises fictives ; certaines font un clin d'œil à
// une grande entreprise réelle sans reprendre son nom (seulement des chargeurs fiables : pas de
// mauvais payeur qui rappellerait une vraie marque).
//  reliability : fiabilité de 0 à 100 (fixe), affichée en étoiles
//  style : ponctuel (paie rubis sur l'ongle), lent (paie souvent en retard),
//          pinailleur (conteste volontiers la facture), fragile (finances précaires)
export const CLIENTS = {
  beauce: { name: 'Soufflé Grains', goods: ['cereales'], reliability: 85, style: 'ponctuel' },
  pampa: { name: 'Pampa Granos SA', goods: ['cereales'], reliability: 55, style: 'lent' },
  prairie: { name: 'Cargoyle Grain', goods: ['cereales', 'engrais'], reliability: 78, style: 'ponctuel' },
  nil: { name: 'Moulins du Nil', goods: ['cereales'], reliability: 48, style: 'pinailleur' },
  pilbara: { name: 'Rio Tinted Iron', goods: ['minerai'], reliability: 88, style: 'ponctuel' },
  ferro: { name: 'Ferro Atlântico', goods: ['minerai', 'acier'], reliability: 62, style: 'pinailleur' },
  huanghai: { name: 'Huanghai Steelworks', goods: ['minerai', 'charbon', 'acier'], reliability: 70, style: 'lent' },
  hunterbank: { name: 'Glenshore Coal', goods: ['charbon'], reliability: 72, style: 'ponctuel' },
  kalahari: { name: 'Kalahari Mining Co.', goods: ['charbon', 'minerai'], reliability: 50, style: 'fragile' },
  agrifert: { name: 'Agrifert Méditerranée', goods: ['engrais'], reliability: 66, style: 'pinailleur' },
  potasse: { name: 'Kaléidoscope Potasse', goods: ['engrais'], reliability: 80, style: 'ponctuel' },
  gulfcrest: { name: 'Chevrette Petroleum', goods: ['brut', 'raffines'], reliability: 90, style: 'ponctuel' },
  bonny: { name: 'Delta Bonny Oil', goods: ['brut'], reliability: 35, style: 'fragile' },
  petromar: { name: 'Raffineries de l\'Étang', goods: ['brut', 'raffines'], reliability: 74, style: 'lent' },
  orient: { name: 'Reliable Refining', goods: ['raffines'], reliability: 82, style: 'ponctuel' },
  lagune: { name: 'Lagune Énergie', goods: ['raffines'], reliability: 40, style: 'fragile' },
  bayou: { name: 'Bayou Fuels', goods: ['raffines', 'brut'], reliability: 76, style: 'pinailleur' },
  shenzhou: { name: 'Shenzhou Export Group', goods: ['manufactures', 'machines', 'acier'], reliability: 79, style: 'lent' },
  hansa: { name: 'Alibabord Trading', goods: ['manufactures', 'machines'], reliability: 88, style: 'ponctuel' },
  ptl: { name: 'Pacific Trade Link', goods: ['manufactures'], reliability: 58, style: 'pinailleur' },
  rheinwerk: { name: 'Liebmehr Maschinen', goods: ['machines'], reliability: 92, style: 'ponctuel' },
  kanto: { name: 'Yotsubishi Heavy Industries', goods: ['machines', 'acier'], reliability: 85, style: 'ponctuel' },
  bosphore: { name: 'Bosphore Équipements', goods: ['machines', 'manufactures'], reliability: 45, style: 'fragile' },
  ruhrstahl: { name: 'Emscher Stahlhandel', goods: ['acier'], reliability: 80, style: 'pinailleur' },
  konkan: { name: 'Konkan Steel Traders', goods: ['acier'], reliability: 55, style: 'lent' },
  ivoire: { name: 'Cacao d\'Ivoire SA', goods: ['cafe_cacao'], reliability: 60, style: 'lent' },
  serra: { name: 'Serra Café Exportadora', goods: ['cafe_cacao'], reliability: 70, style: 'pinailleur' },
  lebrun: { name: 'Carte Grise Torréfaction', goods: ['cafe_cacao'], reliability: 86, style: 'ponctuel' },
  coastal: { name: 'Coastal Timber Co.', goods: ['bois'], reliability: 74, style: 'ponctuel' },
  btr: { name: 'Bois Tropicaux Réunis', goods: ['bois'], reliability: 42, style: 'fragile' },
};

export const STYLE_LABEL = {
  ponctuel: 'paie rubis sur l\'ongle',
  lent: 'paie souvent en retard',
  pinailleur: 'conteste volontiers les factures',
  fragile: 'finances fragiles',
};

// 1 à 5 étoiles.
export const stars = (reliability) => Math.max(1, Math.min(5, Math.round(reliability / 20)));
