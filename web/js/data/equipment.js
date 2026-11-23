// Équipements installables au chantier. Chacun a un prix (selon la taille du
// navire), parfois un coût journalier, et un effet précis.
//  defence : points de défense contre un abordage (pirates)
//  mods    : multiplicateurs appliqués par la simulation
//            collision, grounding, fire (fréquence de ces incidents), fireSink (risque
//            de couler après un incendie), spill (part de cargaison déversée), conceal
//            (risque qu'une fouille trouve un colis), sanction (risque d'amende après un
//            embargo), burn (consommation)
//  hours   : durée d'installation
export const EQUIPMENT = {
  barbeles: {
    name: 'Barbelés et lances à eau', icon: '🪝', defence: 1, upkeep: 0, hours: 12,
    price: (T) => 30000 + T.gt * 0.6,
    blurb: 'Rouleaux de barbelés sur les bastingages et lances à incendie braquées : de quoi décourager les pirates les moins décidés.',
  },
  gardes: {
    name: 'Équipe de gardes armés', icon: '🛡️', defence: 4, upkeep: 2600, hours: 24,
    price: () => 50000,
    blurb: 'Quatre anciens militaires embarqués. Redoutables contre un abordage, mais payés chaque jour.',
  },
  citadelle: {
    name: 'Citadelle', icon: '🔒', defence: 0, upkeep: 0, hours: 48, citadel: true,
    price: (T) => 120000 + T.gt * 1.2,
    blurb: 'Une pièce blindée où l\'équipage se réfugie : des pirates à bord ne peuvent ni prendre le navire ni l\'équipage en otage.',
  },
  navigation: {
    name: 'Navigation moderne (radar, carte électronique)', icon: '🛰️', defence: 0, upkeep: 0, hours: 24,
    price: (T) => 90000 + T.gt * 1.4,
    mods: { collision: 0.6, grounding: 0.55 },
    blurb: 'Radar anticollision et cartes électroniques : beaucoup moins d\'abordages et d\'échouements.',
  },
  incendie: {
    name: 'Système anti-incendie', icon: '🧯', defence: 0, upkeep: 0, hours: 24,
    price: (T) => 60000 + T.gt * 1,
    mods: { fire: 0.6, fireSink: 0.5 },
    blurb: 'Détecteurs et extinction automatique en salle des machines : moins d\'incendies, et rarement fatals.',
  },
  double_coque: {
    name: 'Coque renforcée', icon: '🧱', defence: 0, upkeep: 0, hours: 120, holds: ['liquide', 'chimique', 'gpl', 'gnl'],
    price: (T) => T.gt * 20,
    mods: { spill: 0.4 },
    blurb: 'Doublage des citernes : en cas d\'échouement ou de naufrage, bien moins de cargaison se répand.',
  },
  cachettes: {
    name: 'Cachettes aménagées', icon: '🕳️', defence: 0, upkeep: 0, hours: 36,
    price: () => 70000,
    mods: { conceal: 0.55 },
    blurb: 'Doubles cloisons et faux planchers : un colis discret a bien moins de chances d\'être trouvé.',
  },
  economiseur: {
    name: 'Hélice et peinture économes', icon: '⚙️', defence: 0, upkeep: 0, hours: 72,
    price: (T) => T.price * 1e6 * 0.035,
    mods: { burn: 0.92 },
    blurb: 'Hélice optimisée et peinture de carène lisse : 8 % de carburant en moins.',
  },
  brouilleur: {
    name: 'Transpondeur « discret »', icon: '📡', defence: 0, upkeep: 0, hours: 6,
    price: () => 25000,
    mods: { sanction: 0.5, collision: 1.3 },
    blurb: 'Coupe la balise de position quand il le faut : les escales dans les pays sous embargo passent plus inaperçues, mais naviguer sans balise augmente le risque d\'abordage.',
  },
};
export const EQUIPMENT_IDS = Object.keys(EQUIPMENT);
