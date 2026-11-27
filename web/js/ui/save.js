// Sauvegardes dans le stockage local du navigateur (ou de la WebView Android).
import { SAVE_VERSION, migrateState } from '../sim/game.js';
import { formatDate } from '../sim/util.js';

const KEY = 'portdattache.save.';
export const SLOTS = ['auto', '1', '2', '3'];
export const SLOT_LABEL = { auto: 'Sauvegarde automatique', 1: 'Emplacement 1', 2: 'Emplacement 2', 3: 'Emplacement 3' };

function meta(state) {
  const humans = state.companies.filter((c) => c.human).map((c) => c.name);
  return { date: formatDate(state.t), companies: humans.join(', '), savedAt: Date.now(), version: state.version };
}

export function saveGame(state, slot) {
  try {
    localStorage.setItem(KEY + slot, JSON.stringify(state));
    localStorage.setItem(KEY + slot + '.meta', JSON.stringify(meta(state)));
    return true;
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
    return false;
  }
}

export function listSaves() {
  const out = [];
  for (const slot of SLOTS) {
    try {
      const m = localStorage.getItem(KEY + slot + '.meta');
      if (m) out.push({ slot, meta: JSON.parse(m) });
    } catch { /* stockage indisponible */ }
  }
  return out;
}

// Toutes les parties enregistrées, lues telles quelles (sans migration) : pour le profil du joueur
// (juke-box). Une sauvegarde illisible est ignorée.
export function* savedStates() {
  for (const slot of SLOTS) {
    try {
      const raw = localStorage.getItem(KEY + slot);
      if (raw) yield JSON.parse(raw);
    } catch { /* stockage indisponible ou sauvegarde abîmée */ }
  }
}

export function hasSave(slot) {
  try { return !!localStorage.getItem(KEY + slot); } catch { return false; }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(KEY + slot);
    return raw ? check(JSON.parse(raw)) : null;
  } catch (e) {
    console.warn('Chargement impossible', e);
    return null;
  }
}

function check(state) {
  if (!state || !state.companies || !state.market) throw new Error('Fichier de sauvegarde invalide.');
  if (state.version > SAVE_VERSION) throw new Error('Sauvegarde créée par une version plus récente du jeu.');
  state.wrecks = state.wrecks || [];
  state.payments = state.payments || [];
  state.receivables = state.receivables || [];
  const logos = ['ancre', 'phare', 'barre', 'rose'];
  state.companies.forEach((c, i) => { c.logo = c.logo || logos[i % logos.length]; });
  state.marketHistory = state.marketHistory || [];
  return migrateState(state);
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
      try { resolve(check(JSON.parse(await input.files[0].text()))); } catch (e) { reject(e); }
    };
    input.click();
  });
}

export const isAndroid = () => !!window.AndroidBridge;
