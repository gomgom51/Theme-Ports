// Expérience de l'équipage et spécialités. Un équipage apprend en mer (plus vite s'il est
// confirmé ou chevronné) ; à chaque palier, le joueur choisit une spécialité (trois niveaux
// au plus, six points en tout : de quoi monter deux spécialités au maximum). L'équipage reste avec son navire.
import { CREW_LEVELS } from '../data/ships.js';

export const SKILLS = {
  combat: { name: 'Combattants', icon: '⚔', text: 'Défense contre les pirates : +0,6 à l\'abordage et au combat à bord, par niveau.' },
  entretien: { name: 'Spécialistes de l\'entretien', icon: '🔧', text: 'Le navire s\'use 6 % moins vite, par niveau.' },
  mecanique: { name: 'Mécaniciens experts', icon: '⚙', text: '+1,5 % de vitesse au même régime (le voyage consomme donc moins), par niveau.' },
  contrebande: { name: 'Contrebandiers', icon: '🤫', text: 'Les colis cachés sont 12 % moins souvent trouvés, par niveau.' },
  logistique: { name: 'Logisticiens', icon: '📦', text: 'Chargement et déchargement 8 % plus rapides, par niveau.' },
  negociation: { name: 'Beaux parleurs', icon: '🗣', text: 'Pénalités, réserves, retenues et renégociations à l\'encaissement réduites de 12 %, par niveau.' },
  // Renseignements (sim/intel.js), affichés sur la fiche du navire. Les IA ne la prennent pas : elles voient déjà le marché.
  briscard: { name: 'Vieux briscards', icon: '🧭', text: 'Niveau 1 : la meilleure affaire à portée. Niveau 2 : les 3 ports d\'achat les plus proches pour chaque appel d\'offres. Niveau 3 : cours à l\'arrivée, concurrents en route, et l\'équipage devient vieux briscards (4e niveau d\'équipage, salaire de base).' },
};
export const BRISCARD_LEVEL = 3; // le 4e niveau d'équipage (data/ships.js), débloqué au niveau 3 de la spécialité
export const SKILL_IDS = Object.keys(SKILLS);
export const MAX_RANK = 3;
export const XP_STEPS = [60, 150, 270, 420, 600, 810]; // jours de mer pour gagner chaque point (le 6e ajouté après les cinq d'origine)

export const rank = (ship, id) => ship.skills?.[id] || 0;
export const pointsEarned = (ship) => XP_STEPS.filter((x) => (ship.xp || 0) >= x).length;
export const pointsSpent = (ship) => SKILL_IDS.reduce((s, id) => s + rank(ship, id), 0);
export const pointsFree = (ship) => Math.max(0, pointsEarned(ship) - pointsSpent(ship));
export const nextStep = (ship) => XP_STEPS.find((x) => (ship.xp || 0) < x) ?? null;
// Expérience au maximum : tous les paliers gagnés (conditions d'automatisation, voir le fil des actions répétitives).
export const crewMaxed = (ship) => pointsEarned(ship) >= XP_STEPS.length;
export const learnRate = (ship) => 1 + 0.25 * (ship.crew || 0);

// Effets.
export const skillSpeed = (ship) => 1 + 0.015 * rank(ship, 'mecanique');
export const skillWear = (ship) => 1 - 0.06 * rank(ship, 'entretien');
export const skillDefence = (ship) => 0.6 * rank(ship, 'combat');
// Force de l'équipage lui-même à l'abordage et au combat à bord (niveau d'équipage).
export const crewFight = (ship) => CREW_LEVELS[ship.crew || 0]?.fight || 0;
export const skillConceal = (ship) => 1 - 0.12 * rank(ship, 'contrebande');
export const skillHandling = (ship) => 1 - 0.08 * rank(ship, 'logistique');
export const skillTalk = (ship) => 1 - 0.12 * rank(ship, 'negociation');

// Une heure de mer : renvoie true si un nouveau point vient d'être gagné.
export function gainXp(ship, hours = 1) {
  const before = pointsEarned(ship);
  ship.xp = (ship.xp || 0) + (hours / 24) * learnRate(ship);
  return pointsEarned(ship) > before;
}
export function train(state, shipId, id) {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship || !SKILLS[id]) return { ok: false, msg: 'Spécialité inconnue.' };
  if (pointsFree(ship) <= 0) return { ok: false, msg: 'L\'équipage n\'a pas de point à attribuer.' };
  if (rank(ship, id) >= MAX_RANK) return { ok: false, msg: 'Cette spécialité est déjà au plus haut niveau.' };
  ship.skills = { ...(ship.skills || {}), [id]: rank(ship, id) + 1 };
  // Vieux briscards au niveau 3 : l'équipage passe au 4e niveau, sans prime ni hausse de salaire.
  if (id === 'briscard' && rank(ship, id) >= MAX_RANK && (ship.crew || 0) !== BRISCARD_LEVEL) {
    ship.crewWas = ship.crew || 0;
    ship.crew = BRISCARD_LEVEL;
    return { ok: true, promoted: true };
  }
  return { ok: true };
}
// Le 4e niveau tient tant que la spécialité reste au niveau 3 (un débauchage peut la faire redescendre) :
// sinon l'équipage revient à son niveau d'avant.
export function checkBriscards(ship) {
  if ((ship.crew || 0) === BRISCARD_LEVEL && rank(ship, 'briscard') < MAX_RANK) { ship.crew = ship.crewWas || 0; return true; }
  return false;
}
export const briscardsUnlocked = (ship) => rank(ship, 'briscard') >= MAX_RANK;
// Le capitaine chevronné s'en va : la spécialité Vieux briscards perd un niveau et l'expérience redescend d'un palier
// (à regagner en mer, comme après un débauchage) ; l'équipage revient à son niveau d'avant s'il perd le 4e niveau.
// Appelé quand le joueur reprend la main sur le choix du capitaine sans que celui-ci l'ait appelé.
export function loseBriscardPoint(ship) {
  const r = rank(ship, 'briscard');
  if (r <= 0) return false;
  ship.skills = { ...ship.skills, briscard: r - 1 };
  const k = pointsEarned(ship);
  ship.xp = k >= 2 ? XP_STEPS[k - 2] : 0;
  checkBriscards(ship);
  return true;
}

// Les IA choisissent selon le type de navire.
function aiPriority(holds) {
  if (holds.some((h) => ['liquide', 'chimique', 'gpl', 'gnl'].includes(h))) return ['entretien', 'logistique', 'mecanique', 'negociation'];
  if (holds.includes('vrac')) return ['entretien', 'mecanique', 'logistique', 'negociation'];
  if (holds.some((h) => ['conteneurs', 'frigo', 'vehicules'].includes(h))) return ['logistique', 'mecanique', 'entretien', 'negociation'];
  return ['logistique', 'entretien', 'combat', 'negociation'];
}
export function aiTrain(ship, holds) {
  const order = aiPriority(holds);
  while (pointsFree(ship) > 0) {
    const id = order.find((k) => rank(ship, k) < MAX_RANK) || SKILL_IDS.find((k) => k !== 'briscard' && rank(ship, k) < MAX_RANK);
    if (!id) break;
    ship.skills = { ...(ship.skills || {}), [id]: rank(ship, id) + 1 };
  }
}
