// Profil du joueur : ce qui vaut pour toutes les parties, hors des sauvegardes. Aujourd'hui : les
// morceaux débloqués du juke-box. Tout passe par ce module, seul endroit à changer quand la
// version PC rangera le profil dans un fichier (Steam Cloud).
const TRACKS_KEY = 'pda-jukebox';

export function unlockedTracks() {
  try { return new Set(JSON.parse(localStorage.getItem(TRACKS_KEY) || '[]')); } catch { return new Set(); }
}

// Ajoute des morceaux (jamais n'en retire) ; rend ceux qui viennent d'être débloqués.
export function unlockTracks(ids) {
  const set = unlockedTracks();
  const added = [...new Set(ids)].filter((id) => id && !set.has(id));
  if (!added.length) return added;
  added.forEach((id) => set.add(id));
  try { localStorage.setItem(TRACKS_KEY, JSON.stringify([...set])); } catch { /* stockage indisponible */ }
  return added;
}

// Tâches à ne faire qu'une fois par profil (relecture des anciennes sauvegardes, par exemple).
const ONCE_KEY = 'pda-profile-once';
export function once(id, fn) {
  let done = [];
  try { done = JSON.parse(localStorage.getItem(ONCE_KEY) || '[]'); } catch { /* stockage indisponible */ }
  if (done.includes(id)) return;
  try { fn(); } catch (e) { console.warn(e); } // une sauvegarde abîmée ne doit pas bloquer le lancement
  try { localStorage.setItem(ONCE_KEY, JSON.stringify([...done, id])); } catch { /* stockage indisponible */ }
}
