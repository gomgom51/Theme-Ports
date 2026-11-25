// Événements mondiaux et météo.
import { PORTS, PORT_IDS } from '../data/ports.js';
import { HOURS_PER_DAY, monthOf, clamp, formatDate } from './util.js';
import { OIL_GOODS } from '../data/goods.js';
import { news, portName } from './core.js';
import { haversineNm } from './routing.js';
import { HOLD_TYPES, FREIGHT_MIN, FREIGHT_MAX } from './economy.js';

const D = HOURS_PER_DAY;

// Crise mondiale du raffinage : durée (jours) ; sa fréquence est son poids dans EVENTS.
export const OIL_CRISIS = { days: [14, 28] };

// Chaque événement modifie l'économie ; certains durent (canal fermé, grève).
const EVENTS = [
  {
    id: 'petrole_hausse', weight: 3,
    run(state, rng) {
      const f = rng.range(1.2, 1.45);
      state.market.world.brut *= f; state.market.world.raffines *= 1 + (f - 1) * 0.85;
      return { title: 'Le pétrole s\'envole', text: `Tensions au Moyen-Orient : le baril prend ${Math.round((f - 1) * 100)} %. Le fuel suit.` };
    },
  },
  {
    id: 'petrole_baisse', weight: 3,
    run(state, rng) {
      const f = rng.range(0.7, 0.85);
      state.market.world.brut *= f; state.market.world.raffines *= 1 - (1 - f) * 0.85;
      return { title: 'Surproduction pétrolière', text: `Les producteurs ouvrent les vannes : le baril perd ${Math.round((1 - f) * 100)} %.` };
    },
  },
  {
    id: 'raffinerie', weight: 2,
    run(state, rng) {
      state.market.fuelPremium *= rng.range(1.12, 1.25);
      return { title: 'Panne de raffineries', text: 'Plusieurs raffineries à l\'arrêt : le fuel marine se raréfie et son prix grimpe.' };
    },
  },
  {
    // Crise mondiale du raffinage : pendant deux à quatre semaines, plus aucun contrat ni appel d'offres
    // de pétrole brut ou de produits raffinés hors des pays sous embargo ; les contrats signés sont
    // honorés. Annoncée avec sa date de fin (règle n° 1) ; les pétroliers peuvent désarmer, négocier à
    // leurs risques, ou tenter les pays sous embargo.
    id: 'crise_raffinage', weight: 1.5,
    possible: (state) => !((state.oilCrisis?.until || 0) > state.t),
    run(state, rng) {
      const until = Math.round(state.t + rng.int(OIL_CRISIS.days[0], OIL_CRISIS.days[1]) * D);
      state.oilCrisis = { since: state.t, until };
      state.market.fuelPremium *= rng.range(1.08, 1.15);
      state.contracts = state.contracts.filter((c) => c.takenBy !== null || !OIL_GOODS.includes(c.good) || c.embargo);
      return { title: 'Crise mondiale du raffinage', text: `Pannes et accidents en série : les raffineries sont à l'arrêt. Plus aucun contrat de pétrole brut ni de produits raffinés hors des pays sous embargo jusqu'au ${formatDate(until, true)}. Les contrats déjà signés sont honorés ; le fuel marine renchérit.` };
    },
  },
  {
    id: 'recolte_record', weight: 2,
    run(state, rng) {
      const where = rng.pick(['au Brésil', 'aux États-Unis', 'en Argentine', 'au Canada', 'en France']);
      state.market.world.cereales *= rng.range(0.8, 0.9);
      state.market.freight.vrac *= rng.range(1.1, 1.22);
      for (const p of PORT_IDS) if (PORTS[p].exp.cereales) state.ports[p].cereales.stock *= 1.5;
      return { title: 'Récolte record', text: `Moisson exceptionnelle ${where} : les céréales baissent, les vraquiers sont très demandés.` };
    },
  },
  {
    id: 'secheresse', weight: 2,
    run(state, rng) {
      state.market.world.cereales *= rng.range(1.15, 1.35);
      state.market.freight.vrac *= rng.range(0.88, 0.95);
      return { title: 'Sécheresse', text: 'Mauvaises récoltes dans plusieurs pays : le prix des céréales grimpe.' };
    },
  },
  {
    id: 'chine_relance', weight: 2,
    run(state, rng) {
      state.market.world.minerai *= rng.range(1.12, 1.3); state.market.world.charbon *= rng.range(1.08, 1.2);
      state.market.freight.vrac *= rng.range(1.12, 1.3);
      return { title: 'Plan de relance en Asie', text: 'Les aciéries tournent à plein : minerai, charbon et fret vrac s\'envolent.' };
    },
  },
  {
    id: 'chine_ralenti', weight: 2,
    run(state, rng) {
      state.market.world.minerai *= rng.range(0.75, 0.88); state.market.world.charbon *= rng.range(0.82, 0.92);
      state.market.freight.vrac *= rng.range(0.8, 0.9);
      return { title: 'Ralentissement industriel', text: 'La demande d\'acier recule : le minerai et le fret vrac baissent.' };
    },
  },
  {
    id: 'acier', weight: 2,
    run(state, rng) {
      state.market.world.acier *= rng.range(1.15, 1.3);
      return { title: 'Flambée de l\'acier', text: 'L\'acier coûte plus cher : les réparations navales aussi.' };
    },
  },
  {
    id: 'boom_conteneurs', weight: 2,
    run(state, rng) {
      state.market.freight.conteneurs *= rng.range(1.2, 1.45);
      state.market.freight.divers *= rng.range(1.05, 1.15);
      return { title: 'Ruée sur les conteneurs', text: 'La consommation repart : les taux de fret conteneurs explosent.' };
    },
  },
  {
    id: 'recession', weight: 1,
    run(state, rng) {
      for (const h of HOLD_TYPES) state.market.freight[h] *= rng.range(0.8, 0.9);
      state.market.cycle -= rng.range(0.15, 0.25);
      state.market.shipIndex *= 0.9;
      state.market.world.manufactures *= 0.92; state.market.world.machines *= 0.92;
      return { title: 'Récession mondiale', text: 'Le commerce mondial recule : fret en baisse, navires d\'occasion moins chers.' };
    },
  },
  {
    id: 'surcapacite', weight: 1,
    run(state, rng) {
      state.market.cycle -= rng.range(0.15, 0.3);
      state.market.shipIndex *= 0.93;
      return { title: 'Trop de navires', text: 'Les chantiers livrent à tour de bras : la flotte mondiale dépasse la demande, les taux de fret vont plonger pour longtemps.' };
    },
  },
  {
    id: 'reprise', weight: 1,
    run(state, rng) {
      state.market.cycle += rng.range(0.15, 0.3);
      return { title: 'Reprise du commerce mondial', text: 'Les commandes affluent et les navires manquent : les taux de fret repartent à la hausse.' };
    },
  },
  {
    id: 'suez_ferme', weight: 1,
    possible: (state) => !state.canals.suez?.closed,
    run(state, rng) {
      const days = rng.int(6, 28);
      state.canals.suez = { closed: true, until: state.t + days * D };
      state.market.freight.liquide *= 1.12; state.market.freight.conteneurs *= 1.1;
      const cause = rng.pick(['un porte-conteneurs échoué en travers du chenal', 'des tensions militaires en mer Rouge', 'un accident dans le chenal']);
      return { title: 'Canal de Suez fermé', text: `Le canal de Suez est fermé pour environ ${days} jours (${cause}). Les navires qui l'atteignent devront attendre, les autres passeront par le cap de Bonne-Espérance.`, variant: /militaires/.test(cause) ? 'tension' : null };
    },
  },
  {
    id: 'panama_secheresse', weight: 1,
    possible: (state) => !state.canals.panama,
    run(state, rng) {
      const days = rng.int(30, 90);
      const limit = rng.pick([10.5, 11, 11.5, 12]);
      state.canals.panama = { draftLimit: limit, until: state.t + days * D };
      return { title: 'Sécheresse à Panama', text: `Le lac Gatún est trop bas : le canal de Panama n'accepte plus que les navires de moins de ${String(limit).replace('.', ',')} m de tirant d'eau pendant environ ${days} jours.` };
    },
  },
  {
    id: 'greve', weight: 2,
    run(state, rng) {
      const p = rng.pick(PORT_IDS.filter((x) => !(state.strikes[x] > state.t)));
      const days = rng.int(4, 14);
      state.strikes[p] = state.t + days * D;
      return { title: `Grève à ${portName(p)}`, text: `Les dockers de ${portName(p)} sont en grève pour environ ${days} jours : chargements et déchargements suspendus.` };
    },
  },
];

export function dailyEvents(state, rng) {
  // Fin des événements durables.
  for (const [c, ev] of Object.entries(state.canals)) {
    if (ev && ev.until <= state.t) {
      delete state.canals[c];
      news(state, c === 'suez' ? 'Le canal de Suez est rouvert à la navigation.' : 'Le canal de Panama retrouve son tirant d\'eau normal.', { kind: 'event' });
    }
  }
  for (const [p, until] of Object.entries(state.strikes)) {
    if (until <= state.t) { delete state.strikes[p]; news(state, `Fin de la grève à ${portName(p)}.`, { kind: 'event' }); }
  }
  // Fin de la crise du raffinage.
  if (state.oilCrisis && !state.oilCrisis.ended && state.oilCrisis.until <= state.t) {
    state.oilCrisis.ended = true;
    news(state, 'Fin de la crise du raffinage : les raffineries redémarrent, les contrats de pétrole reviennent.', { kind: 'event' });
  }
  // Un nouvel événement environ toutes les cinq semaines.
  if (rng.chance(1 / 35)) {
    const list = EVENTS.filter((e) => !e.possible || e.possible(state));
    const ev = rng.weighted(list.map((e) => [e, e.weight]));
    const r = ev.run(state, rng);
    for (const h of HOLD_TYPES) state.market.freight[h] = clamp(state.market.freight[h], FREIGHT_MIN, FREIGHT_MAX);
    state.market.cycle = clamp(state.market.cycle, -0.45, 0.45);
    news(state, `${r.title} — ${r.text}`, { kind: 'event' });
    return { ...r, id: ev.id }; // l'identifiant choisit l'illustration de l'événement
  }
  return null;
}

// ---------- Météo ----------
// Zones de formation des tempêtes : saison (mois 0-11), position, force (Beaufort),
// vitesse de déplacement (nœuds, vers l'est et vers le nord), probabilité par jour.
const ZONES = [
  { name: 'Tempête d\'hiver', months: [9, 10, 11, 0, 1, 2], lat: [42, 58], lon: [-50, -15], force: [8, 11], ve: [12, 25], vn: [-3, 6], radius: [300, 600], life: [3, 7], rate: 0.14 },
  { name: 'Coup de vent', months: [9, 10, 11, 0, 1, 2], lat: [52, 60], lon: [-5, 8], force: [8, 10], ve: [8, 18], vn: [-3, 3], radius: [180, 320], life: [2, 4], rate: 0.06 },
  { name: 'Ouragan', months: [5, 6, 7, 8, 9, 10], lat: [12, 20], lon: [-58, -35], force: [10, 12], ve: [-14, -8], vn: [2, 6], recurve: true, radius: [200, 420], life: [6, 12], rate: 0.06 },
  { name: 'Typhon', months: [5, 6, 7, 8, 9, 10, 11], lat: [9, 20], lon: [128, 150], force: [10, 12], ve: [-12, -6], vn: [3, 7], recurve: true, radius: [220, 450], life: [6, 11], rate: 0.08 },
  { name: 'Cyclone', months: [3, 4, 5, 9, 10, 11], lat: [10, 17], lon: [84, 92], force: [9, 12], ve: [-4, 3], vn: [3, 7], radius: [180, 350], life: [4, 7], rate: 0.035 },
  { name: 'Cyclone', months: [10, 11, 0, 1, 2, 3], lat: [-20, -10], lon: [55, 95], force: [9, 12], ve: [-10, -4], vn: [-6, -2], recurve: true, radius: [200, 400], life: [5, 10], rate: 0.06 },
  { name: 'Quarantièmes rugissants', months: null, lat: [-52, -40], lon: [-180, 180], force: [8, 10], ve: [15, 28], vn: [-2, 2], radius: [300, 650], life: [3, 6], rate: 0.2 },
  { name: 'Tempête du Pacifique', months: [9, 10, 11, 0, 1, 2], lat: [38, 52], lon: [150, 215], force: [8, 11], ve: [14, 26], vn: [-2, 5], radius: [300, 600], life: [3, 7], rate: 0.1 },
  { name: 'Mistral', months: [10, 11, 0, 1, 2, 3], lat: [38, 43], lon: [3, 9], force: [7, 9], ve: [2, 6], vn: [-4, -1], radius: [120, 220], life: [2, 4], rate: 0.05 },
  { name: 'Tempête du Cap', months: [4, 5, 6, 7, 8], lat: [-38, -33], lon: [14, 30], force: [8, 10], ve: [12, 20], vn: [-2, 2], radius: [200, 350], life: [2, 4], rate: 0.05 },
];

export function dailyStorms(state, rng) {
  state.storms = state.storms.filter((s) => s.until > state.t);
  const month = monthOf(state.t);
  for (const z of ZONES) {
    if (z.months && !z.months.includes(month)) continue;
    if (!rng.chance(z.rate)) continue;
    const lat = rng.range(...z.lat);
    state.storms.push({
      id: state.nextId++, name: z.name, lat, lon: rng.range(...z.lon),
      ve: rng.range(...z.ve), vn: rng.range(...z.vn), recurve: !!z.recurve,
      radius: Math.round(rng.range(...z.radius)), force: rng.int(...z.force),
      born: state.t, until: state.t + Math.round(rng.range(...z.life) * D),
    });
  }
}

export function moveStorms(state) {
  for (const s of state.storms) {
    s.lat += s.vn / 60;
    s.lon += s.ve / (60 * Math.max(0.2, Math.cos((s.lat * Math.PI) / 180)));
    // Les cyclones tropicaux remontent vers les pôles et repartent vers l'est.
    if (s.recurve) {
      const sign = s.lat >= 0 ? 1 : -1;
      s.vn += sign * 0.02;
      s.ve += 0.03;
    }
    if (s.lon > 180) s.lon -= 360;
    if (s.lon < -180) s.lon += 360;
  }
}

// Force du vent (Beaufort) en un point : 4 par défaut, plus sous une tempête.
export function weatherAt(state, lon, lat) {
  let force = 4, storm = null;
  for (const s of state.storms) {
    const d = haversineNm(lon, lat, s.lon, s.lat);
    if (d > s.radius) continue;
    // Montée en puissance les premières heures, déclin à la fin.
    const life = Math.min(1, (state.t - s.born) / 18, (s.until - state.t) / 18);
    const f = Math.round(4 + (s.force - 4) * (1 - 0.45 * (d / s.radius)) * Math.max(0.3, life));
    if (f > force) { force = f; storm = s; }
  }
  return { force, storm };
}
