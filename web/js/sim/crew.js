// Expérience de l'équipage et spécialités. Un équipage apprend en mer (plus vite s'il est
// confirmé ou chevronné) ; à chaque palier, le joueur choisit une spécialité (trois niveaux
// au plus, cinq points en tout). L'équipage reste avec son navire.
export const SKILLS = {
  combat: { name: 'Combattants', icon: '⚔', text: 'Défense contre les pirates : +0,6 à l\'abordage et au combat à bord, par niveau.' },
  entretien: { name: 'Spécialistes de l\'entretien', icon: '🔧', text: 'Le navire s\'use 6 % moins vite, par niveau.' },
  mecanique: { name: 'Mécaniciens experts', icon: '⚙', text: '+1,5 % de vitesse au même régime (le voyage consomme donc moins), par niveau.' },
  contrebande: { name: 'Contrebandiers', icon: '🤫', text: 'Les colis cachés sont 12 % moins souvent trouvés, par niveau.' },
  logistique: { name: 'Logisticiens', icon: '📦', text: 'Chargement et déchargement 8 % plus rapides, par niveau.' },
  negociation: { name: 'Beaux parleurs', icon: '🗣', text: 'Pénalités, réserves, retenues et renégociations à l\'encaissement réduites de 12 %, par niveau.' },
};
export const SKILL_IDS = Object.keys(SKILLS);
export const MAX_RANK = 3;
export const XP_STEPS = [60, 150, 270, 420, 600]; // jours de mer pour gagner chaque point

export const rank = (ship, id) => ship.skills?.[id] || 0;
export const pointsEarned = (ship) => XP_STEPS.filter((x) => (ship.xp || 0) >= x).length;
export const pointsSpent = (ship) => SKILL_IDS.reduce((s, id) => s + rank(ship, id), 0);
export const pointsFree = (ship) => Math.max(0, pointsEarned(ship) - pointsSpent(ship));
export const nextStep = (ship) => XP_STEPS.find((x) => (ship.xp || 0) < x) ?? null;
export const learnRate = (ship) => 1 + 0.25 * (ship.crew || 0);

// Effets.
export const skillSpeed = (ship) => 1 + 0.015 * rank(ship, 'mecanique');
export const skillWear = (ship) => 1 - 0.06 * rank(ship, 'entretien');
export const skillDefence = (ship) => 0.6 * rank(ship, 'combat');
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
  return { ok: true };
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
    const id = order.find((k) => rank(ship, k) < MAX_RANK) || SKILL_IDS.find((k) => rank(ship, k) < MAX_RANK);
    if (!id) break;
    ship.skills = { ...(ship.skills || {}), [id]: rank(ship, id) + 1 };
  }
}
