// Taille de l'interface. Le jeu est dessiné pour un écran de 1920 × 1080 : sur un écran plus grand
// (2560 × 1440, 4K…) tout grandit d'autant, comme un zoom du navigateur (zoom CSS sur <html>), et le
// joueur peut l'ajuster dans le menu ☰ (Petite, Normale, Grande, Très grande).
// - Les coordonnées de l'écran (clientX, getBoundingClientRect, innerWidth) restent en pixels de l'écran ;
//   les tailles CSS (offsetWidth, style.left…) sont en pixels de l'interface : toLocal() passe des unes aux autres.
// - Les unités vw/vh de style.css passent par --vw/--vh, sinon elles grandiraient avec le zoom.
// - La carte et le grand canevas de l'intro échappent au zoom (classe .unzoom) : ils dessinent au pixel près
//   et lisent uiScale() pour la taille de leurs dessins. Un canevas resté dans l'interface zoomée doit
//   compter pixelRatio() pixels par px CSS pour rester net.
import { KEYS, read, write } from './storage.js';

const BASE_W = 1920, BASE_H = 1080;
const MAX = 2.5;
export const UI_SIZES = [
  { id: 'small', label: 'Petite', k: 0.85 },
  { id: 'normal', label: 'Normale', k: 1 },
  { id: 'large', label: 'Grande', k: 1.15 },
  { id: 'xl', label: 'Très grande', k: 1.3 },
];

let z = 1;
export const uiScale = () => z;
export const pixelRatio = () => (window.devicePixelRatio || 1) * z;
export const toLocal = (v) => v / z;
export const viewport = () => ({ w: window.innerWidth / z, h: window.innerHeight / z });
// Le cadre d'un élément en px de l'interface, pour y poser un autre élément (bulle, chiffre flottant…).
export function localRect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
}

export function uiSize() {
  const id = read(KEYS.uiSize) || 'normal';
  return UI_SIZES.find((s) => s.id === id) || UI_SIZES[1];
}
export function setUiSize(id) {
  write(KEYS.uiSize, id);
  applyScale();
}

// Jamais plus petit qu'aujourd'hui sans le demander (Petite) : un écran plus petit que 1920 × 1080 garde la taille d'origine.
const auto = () => Math.max(1, Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));

export function applyScale() {
  const nz = Math.round(Math.min(MAX, auto() * uiSize().k) * 100) / 100;
  const root = document.documentElement;
  if (nz === z && root.style.getPropertyValue('--ui')) return;
  z = nz;
  root.style.zoom = z === 1 ? '' : String(z);
  root.style.setProperty('--ui', String(z));
  window.dispatchEvent(new CustomEvent('uiscale', { detail: z }));
}

export function initScale() {
  applyScale();
  window.addEventListener('resize', applyScale);
}
