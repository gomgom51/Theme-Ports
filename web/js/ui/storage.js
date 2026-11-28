// Stockage local (réglages, profil du joueur, sauvegardes) : le seul module qui touche localStorage.
// Toutes les clés sont listées ici, avec leur nom d'origine pour que les joueurs gardent leurs réglages
// et leurs parties. Le jour où la version PC rangera tout dans des fichiers (Steam Cloud), seul ce
// module change. Règle : docs/code-health.md (pas de localStorage ailleurs, tools/code-check.mjs y veille).
export const KEYS = {
  lang: 'pda-lang', // i18n.js
  uiSize: 'pda-ui-size', // ui/scale.js
  audio: 'portdattache.audio', // ui/audio.js (volumes, morceaux)
  animations: 'pda-animations', // ui/motion.js
  scenes: 'pda-scenes', // ui/scenes.js (scènes d'événements)
  shipStyle: 'pda-ship-style', // ui/pixelship.js (fin ou gros pixels)
  panelWidth: 'pda-panel-w', // ui/panelsize.js
  oppsCollapsed: 'pda-opps-collapsed', // ui/opps.js
  guideDone: 'pda-guide-done', // ui/guide.js
  speed: 'port-dattache-speed', // main.js (vitesse par défaut)
  jukebox: 'pda-jukebox', // ui/profile.js (morceaux débloqués)
  profileOnce: 'pda-profile-once', // ui/profile.js (tâches faites une fois)
  save: (slot) => `portdattache.save.${slot}`, // ui/save.js
  saveMeta: (slot) => `portdattache.save.${slot}.meta`,
};

// Lecture brute (texte) ; fallback si la clé manque ou si le stockage est indisponible.
export function read(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}

// Lecture d'une valeur JSON ; fallback si elle manque, est illisible ou si le stockage est indisponible.
export function readJSON(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}

// Écriture ; rend false si le stockage est plein ou bloqué (l'appelant décide s'il prévient le joueur).
export function write(key, value) {
  try { localStorage.setItem(key, String(value)); return true; } catch (e) { console.warn('Stockage impossible', key, e); return false; }
}

export function writeJSON(key, value) {
  let text;
  try { text = JSON.stringify(value); } catch (e) { console.warn('Valeur impossible à enregistrer', key, e); return false; }
  return write(key, text);
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* stockage indisponible */ }
}

// Interrupteur enregistré en « 1 » / « 0 » (scènes, animations…).
export const readFlag = (key, fallback) => { const v = read(key); return v == null ? fallback : v !== '0'; };
export const writeFlag = (key, on) => write(key, on ? '1' : '0');
