// Ce que le joueur sait des dangers. Les faits contractuels (seuil d'assurance,
// ports qui inspectent sévèrement) sont toujours affichés ; l'estimation des
// risques vient de l'équipage : avis général, fourchettes ou chiffres précis
// selon son expérience.
import { CREW_LEVELS } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { riskProfile, voyageRisk, inspectionOdds, inspectionThreshold, isStrict, isImagePort, inspectVirtueK, SEAWORTHY } from '../sim/incidents.js';
import { ageYears } from '../sim/economy.js';
import { worstCase, isPolluting } from '../sim/pollution.js';
import { planOf } from '../sim/insurance.js';
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
export function riskLines(state, ship, { seaDays = null, to = null, route = null } = {}) {
  const crew = crewInfo(ship);
  const prof = riskProfile(state, ship);
  const out = [];
  // 1. L'assurance : un fait contractuel, toujours connu (formule choisie au Bureau).
  const company = state.companies[ship.owner];
  const plan = planOf(company);
  if (plan.rate === 0) out.push(h('div.risk-line.warn-text', '✖ Sans assurance (votre choix, au Bureau) : un naufrage, une réclamation ou une pollution serait entièrement à vos frais.'));
  else if (!prof.insured) out.push(h('div.risk-line.neg', `✖ Non assuré — sous ${SEAWORTHY} % d'état au départ, l'assureur ne couvre rien. Un naufrage ou une réclamation serait entièrement à vos frais.`));
  else if (!plan.pi) out.push(h('div.risk-line', [h('span.warn-text', '◐ Coque seule'), ` — la coque est remboursée à ${Math.round(plan.hull * 100)} %, mais réclamations des chargeurs et pollution sont à vos frais (tant que l'état au départ reste d'au moins ${SEAWORTHY} %).`]));
  else out.push(h('div.risk-line', [h('span.pos', '✔ Assuré'), ` (formule complète) — coque à ${Math.round(plan.hull * 100)} %, réclamations et pollution couvertes, tant que l'état au départ reste d'au moins ${SEAWORTHY} %.`]));
  // 1 bis. Cargaison polluante : côtes sensibles sur la route et pire cas (fait connu, comme l'assurance).
  if (route && ship.cargo && isPolluting(ship.cargo.good)) {
    const w = worstCase(ship, route, ship.status === 'sea' ? (ship.voyage?.startCond ?? ship.condition) : ship.condition, company);
    const M = (x) => `${(x / 1e6).toFixed(1).replace('.', ',')} M$`;
    // Morceaux séparés (zones une à une) : la traduction anglaise les reconnaît chacun.
    const along = w.zones.length
      ? [h('span', 'Votre route longe :'), ' ', ...w.zones.flatMap((z, i) => [i ? ', ' : null, h('span', z.name), ` (×${String(z.factor).replace('.', ',')})`]), '.']
      : [h('span', 'Votre route reste au large des côtes sensibles.')];
    const cost = w.insured
      ? `En cas de marée noire, nettoyage jusqu'à ${M(w.liability)} : l'assurance paie, il vous resterait ${M(w.due)} de franchise.`
      : `En cas de marée noire, nettoyage jusqu'à ${M(w.liability)}, à vos frais (jusqu'à ${M(w.due)})${w.seaworthy ? ', votre assurance ne couvrant pas la pollution.' : ' car le navire n\'est pas en état, et le pays touché vous fermerait ses ports un an.'}`;
    out.push(h(`div.risk-line${w.insured ? '' : '.neg'}`, [h('span', '☣ Cargaison polluante.'), ' ', ...along, ' ', h('span', cost)]));
  }
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
    const V = company.virtue ?? company.reputation ?? 50;
    const odds = inspectionOdds(ship.condition, to, age, V);
    const name = PORTS[to].name;
    if (odds.detain > 0) {
      const cls = odds.detain > 0.3 ? 'neg' : 'warn-text';
      const how = crew.info === 2 ? `≈ ${pctTxt(odds.detain)}` : crew.info === 1 ? `≈ ${fr(Math.max(10, Math.round(odds.detain * 10) * 10))} %` : odds.detain > 0.3 ? 'élevé' : 'possible';
      out.push(h(`div.risk-line.${cls}`, `⚠ ${isStrict(to) ? `${name} inspecte sévèrement les navires usés` : `${name} contrôle parfois les navires usés`} : risque de détention ${how} (amende et remise en état à ${'65'} % à vos frais, que vous ayez l'argent ou non). Réparez au-dessus de ${threshold} % pour l'éviter.`));
      // Port attentif à l'image : la vertu y change la probabilité d'être inspecté.
      const k = inspectVirtueK(to, V);
      if (isImagePort(to) && Math.abs(k - 1) >= 0.02) out.push(h('div.risk-line.small', k < 1 ? `💚 ${name} soigne son image : votre vertu (${Math.floor(V)}) y réduit les inspections de ${Math.round((1 - k) * 100)} %.` : `💚 ${name} soigne son image : votre vertu (${Math.floor(V)}) y attire ${Math.round((k - 1) * 100)} % d'inspections en plus.`));
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
