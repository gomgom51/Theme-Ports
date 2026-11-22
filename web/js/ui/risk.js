// Ce que le joueur sait des dangers. Les faits contractuels (seuil d'assurance,
// ports qui inspectent sévèrement) sont toujours affichés ; l'estimation des
// risques vient de l'équipage : avis général, fourchettes ou chiffres précis
// selon son expérience.
import { CREW_LEVELS } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { riskProfile, voyageRisk, inspectionOdds, inspectionThreshold, isStrict, SEAWORTHY } from '../sim/incidents.js';
import { ageYears } from '../sim/economy.js';
import { h } from './dom.js';

const fr = (x, d = 0) => x.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const pctTxt = (p) => (p < 0.001 ? 'moins de 0,1 %' : p < 0.01 ? `${fr(p * 100, 1)} %` : `${fr(p * 100)} %`);
// Fourchette arrondie autour d'une valeur (équipage confirmé).
function range(p) {
  const lo = Math.max(0, p * 0.6), hi = p * 1.5;
  const r = (x) => (x < 0.01 ? Math.round(x * 1000) / 10 : Math.round(x * 100));
  return `${fr(r(lo), lo < 0.01 ? 1 : 0)} à ${fr(r(hi), hi < 0.01 ? 1 : 0)} %`;
}
const LEVEL_CLASS = ['pos', '', 'warn-text', 'neg'];

export function crewInfo(ship) { return CREW_LEVELS[ship.crew || 0]; }

// Lignes d'information sur les risques. opts : seaDays (voyage prévu), to (port d'arrivée).
export function riskLines(state, ship, { seaDays = null, to = null } = {}) {
  const crew = crewInfo(ship);
  const prof = riskProfile(state, ship);
  const out = [];
  // 1. L'assurance : un fait contractuel, toujours connu.
  out.push(prof.insured
    ? h('div.risk-line', [h('span.pos', '✔ Assuré'), ` — le navire et la cargaison sont couverts tant que l'état au départ reste d'au moins ${SEAWORTHY} %.`])
    : h('div.risk-line.neg', `✖ Non assuré — sous ${SEAWORTHY} % d'état au départ, ni le navire ni la cargaison ne sont couverts. Un naufrage ou une réclamation serait entièrement à vos frais.`));
  // 2. L'avis de l'équipage sur les dangers.
  if (crew.info === 0) {
    out.push(h('div.risk-line', ['🧭 Le capitaine juge le risque d\'incident ', h('b', { class: LEVEL_CLASS[prof.level] }, prof.label), '.',
      h('span.muted', ' Un équipage plus expérimenté saurait le chiffrer.')]));
  } else if (crew.info === 1) {
    out.push(h('div.risk-line', [`🧭 Vos officiers estiment ${fr(Math.max(0.1, prof.incidentsPerYear * 0.7), 1)} à ${fr(prof.incidentsPerYear * 1.4, 1)} incidents par an, et un risque de naufrage de `,
      h('b', { class: LEVEL_CLASS[prof.level] }, range(prof.sinkPerYear)), ' par an.']));
  } else {
    out.push(h('div.risk-line', [`🧭 Le chef mécanicien compte ${fr(prof.incidentsPerYear, 2)} incident${prof.incidentsPerYear >= 2 ? 's' : ''} par an et un risque de naufrage de `,
      h('b', { class: LEVEL_CLASS[prof.level] }, pctTxt(prof.sinkPerYear)), ' par an.']));
  }
  // 3. Le voyage prévu.
  if (seaDays != null && seaDays > 0) {
    const vr = voyageRisk(state, ship, seaDays);
    if (crew.info === 2) out.push(h('div.risk-line', `Sur ce voyage : ${pctTxt(vr.incident)} de risque d'incident, ${pctTxt(vr.sink)} de risque de naufrage.`));
    else if (crew.info === 1) out.push(h('div.risk-line', `Sur ce voyage : environ ${range(vr.incident)} de risque d'incident.`));
  }
  // 4. Les inspections : les ports exigeants sont connus de tous ; la probabilité dépend de l'équipage.
  const age = ageYears(state, ship);
  const threshold = inspectionThreshold(age);
  if (to) {
    const odds = inspectionOdds(ship.condition, to, age);
    const name = PORTS[to].name;
    if (odds.detain > 0) {
      const cls = odds.detain > 0.3 ? 'neg' : 'warn-text';
      const how = crew.info === 2 ? `≈ ${pctTxt(odds.detain)}` : crew.info === 1 ? `≈ ${fr(Math.max(10, Math.round(odds.detain * 10) * 10))} %` : odds.detain > 0.3 ? 'élevé' : 'possible';
      out.push(h(`div.risk-line.${cls}`, `⚠ ${isStrict(to) ? `${name} inspecte sévèrement les navires usés` : `${name} contrôle parfois les navires usés`} : risque de détention ${how} (amende et remise en état à ${'65'} % à vos frais, que vous ayez l'argent ou non). Réparez au-dessus de ${threshold} % pour l'éviter.`));
    }
  } else if (ship.condition < threshold) {
    out.push(h('div.risk-line.warn-text', `⚠ Sous ${threshold} %, les ports exigeants (Europe, Amérique du Nord, Japon, Corée, Australie, Singapour) peuvent retenir ce navire.`));
  }
  return out;
}

// Avis rapide d'un expert maritime sur un navire d'occasion (avant l'achat).
export function surveyTag(state, look) {
  const fake = { type: look.typeId, builtT: state.t - look.age * 24 * 365, condition: look.condition, crew: 0 };
  const prof = riskProfile(state, fake);
  const cls = ['good', '', 'warn', 'bad'][prof.level];
  return h(`span.tag${cls ? '.' + cls : ''}`, { title: 'Avis de l\'expert maritime sur le risque d\'incident' }, `risque ${prof.label}${prof.insured ? '' : ' · non assurable en l\'état'}`);
}

export { isStrict };
