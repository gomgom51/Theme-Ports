// Sauvegardes dans le stockage local du navigateur (ou de la WebView Android).
import { migrate } from '../sim/migrations.js';
import { formatDate } from '../sim/util.js';
import { KEYS, read, readJSON, writeJSON } from './storage.js';

export const SLOTS = ['auto', '1', '2', '3'];
export const SLOT_LABEL = { auto: 'Sauvegarde automatique', 1: 'Emplacement 1', 2: 'Emplacement 2', 3: 'Emplacement 3' };

function meta(state) {
  const humans = state.companies.filter((c) => c.human).map((c) => c.name);
  return { date: formatDate(state.t), companies: humans.join(', '), savedAt: Date.now(), version: state.version };
}

// Rend false si le stockage est plein ou bloqué : la partie n'est alors pas enregistrée (main.js prévient le joueur).
export function saveGame(state, slot) {
  return writeJSON(KEYS.save(slot), state) && writeJSON(KEYS.saveMeta(slot), meta(state));
}

export function listSaves() {
  const out = [];
  for (const slot of SLOTS) {
    const m = readJSON(KEYS.saveMeta(slot));
    if (m) out.push({ slot, meta: m });
  }
  return out;
}

// Toutes les parties enregistrées, lues telles quelles (sans migration) : pour le profil du joueur
// (juke-box). Une sauvegarde illisible est ignorée.
export function* savedStates() {
  for (const slot of SLOTS) {
    const s = readJSON(KEYS.save(slot)); // null si absente, illisible ou stockage indisponible
    if (s) yield s;
  }
}

export function hasSave(slot) {
  return !!read(KEYS.save(slot));
}

export function loadGame(slot) {
  try {
    const raw = read(KEYS.save(slot));
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch (e) {
    console.warn('Chargement impossible', e);
    return null;
  }
}

// Export / import d'un fichier (version PC).
export function exportFile(state) {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `port-dattache-${formatDate(state.t).replace(/\s+/g, '-')}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function importFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try { resolve(migrate(JSON.parse(await input.files[0].text()))); } catch (e) { reject(e); }
    };
    input.click();
  });
}

export const isAndroid = () => !!window.AndroidBridge;
