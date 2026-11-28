// Largeur du panneau latéral : environ 40 % de l'écran par défaut, et une poignée de laiton sur son bord
// gauche (le panneau est un tiroir) pour l'élargir ou le rétrécir à la main. La largeur choisie est retenue ;
// un double-clic sur la poignée revient à la largeur par défaut. Largeurs en px de l'interface (zoom de ui/scale.js).

import { toLocal, viewport } from './scale.js';
import { KEYS, read, write, remove } from './storage.js';

const MIN = 460;      // px : en dessous, les fiches se replient mal
const MAP_MIN = 420;  // px : la carte garde toujours au moins cette largeur

const root = document.documentElement;
const px = (v) => parseFloat(getComputedStyle(root).getPropertyValue(v)) || 0;

function maxWidth() { return viewport().w - px('--rail-w') - 24 - MAP_MIN; }
function apply(w) {
  if (!w) { root.style.removeProperty('--panel-w'); return; }
  root.style.setProperty('--panel-w', `${Math.round(Math.max(MIN, Math.min(maxWidth(), w)))}px`);
}
function load() { return +read(KEYS.panelWidth) || 0; }
function save(w) { if (w) write(KEYS.panelWidth, Math.round(w)); else remove(KEYS.panelWidth); }

// La poignée se cache pendant que le tiroir sort (elle apparaît quand il est en place).
let grip = null, token = 0;
export function gripAfter(done) {
  if (!grip || !done) return;
  const t = ++token;
  grip.classList.add('waiting');
  done.catch(() => {}).then(() => { if (t === token) grip.classList.remove('waiting'); });
}

export function initPanelSize(onResize) {
  apply(load());
  grip = document.createElement('div');
  grip.className = 'panel-grip';
  grip.innerHTML = '<span class="panel-pull"></span>';
  grip.firstChild.title = 'Glisser pour élargir · double-clic : largeur d\'origine'; // la bulle se pose près de la poignée
  document.body.append(grip);
  let drag = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const panel = document.getElementById('panel');
    drag = { right: panel.getBoundingClientRect().right, w: 0 };
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('panel-resizing');
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.w = toLocal(drag.right - e.clientX); // coordonnées de l'écran → px de l'interface
    apply(drag.w);
    onResize?.();
  });
  const end = () => {
    if (!drag) return;
    if (drag.w) save(px('--panel-w'));
    drag = null;
    document.body.classList.remove('panel-resizing');
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => { apply(0); save(0); onResize?.(); });
  const refit = () => { const w = load(); if (w) apply(w); };
  window.addEventListener('resize', refit);
  window.addEventListener('uiscale', refit);
}
