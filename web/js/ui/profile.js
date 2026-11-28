// Profil du joueur : ce qui vaut pour toutes les parties, hors des sauvegardes. Aujourd'hui : les
// morceaux débloqués du juke-box et les tâches faites une fois. Le stockage passe par storage.js,
// seul module à changer quand la version PC rangera tout dans des fichiers (Steam Cloud).
import { KEYS, readJSON, writeJSON } from './storage.js';

export function unlockedTracks() {
  const ids = readJSON(KEYS.jukebox, []);
  return new Set(Array.isArray(ids) ? ids : []);
}

// Ajoute des morceaux (jamais n'en retire) ; rend ceux qui viennent d'être débloqués.
export function unlockTracks(ids) {
  const set = unlockedTracks();
  const added = [...new Set(ids)].filter((id) => id && !set.has(id));
  if (!added.length) return added;
  added.forEach((id) => set.add(id));
  writeJSON(KEYS.jukebox, [...set]);
  return added;
}

// Tâches à ne faire qu'une fois par profil (relecture des anciennes sauvegardes, par exemple).
export function once(id, fn) {
  let done = readJSON(KEYS.profileOnce, []);
  if (!Array.isArray(done)) done = [];
  if (done.includes(id)) return;
  try { fn(); } catch (e) { console.warn(e); } // une sauvegarde abîmée ne doit pas bloquer le lancement
  writeJSON(KEYS.profileOnce, [...done, id]);
}
