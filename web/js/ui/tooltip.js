// Info-bulles du jeu : remplacent celles du navigateur (lentes, en petit, absentes sur mobile).
// Elles lisent l'attribut title de n'importe quel élément : rien à changer ailleurs.
// Souris : la bulle paraît après un court instant. Écran tactile : appui long sur l'élément.
// Pendant le survol, le title est retiré (sinon la bulle du navigateur s'affiche en plus),
// puis remis à la sortie, déjà traduit : la traduction anglaise n'est pas refaite.

import { localRect, viewport } from './scale.js';

const DELAY = 200; // ms avant d'afficher au survol
const LONG_PRESS = 450; // ms d'appui pour l'afficher au doigt
const TOUCH_SHOW = 4000; // ms d'affichage après un appui long
const MOVE_TOL = 10; // px de glissement qui annulent l'appui long

let tip = null; // la bulle
let target = null; // élément survolé
let held = ''; // son title, retiré le temps du survol
let timer = 0, watchTimer = 0, hideTimer = 0;
let press = null; // appui en cours { x, y, el }
let swallowClick = false; // le clic qui suit un appui long ne doit pas déclencher le bouton

const titled = (el) => el?.closest?.('[title]:not([title=""])') || null;

function bubble() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'game-tip';
    tip.setAttribute('role', 'tooltip');
    tip.dataset.noTr = ''; // déjà traduit : le texte vient du title
    document.body.append(tip);
  }
  return tip;
}

// Retire le title de l'élément (le code peut le remettre à jour : on le reprend à chaque fois).
function take(el) {
  const t = el.getAttribute('title');
  if (t) { held = t; el.removeAttribute('title'); }
}

function place(el) {
  const b = bubble();
  b.textContent = held;
  b.classList.add('show');
  const r = localRect(el); // en px de l'interface (zoom de ui/scale.js)
  const { w: W, h: H } = viewport();
  const w = b.offsetWidth, hgt = b.offsetHeight, m = 8;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(m, Math.min(W - w - m, x));
  let y = r.bottom + 8; // dessous, sinon dessus
  if (y + hgt > H - m) y = Math.max(m, r.top - hgt - 8);
  b.style.left = `${Math.round(x)}px`;
  b.style.top = `${Math.round(y)}px`;
}

function show(el) {
  take(el);
  if (!held) return;
  place(el);
  // L'élément peut être redessiné ou son title changé pendant le survol.
  clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    if (!target || !target.isConnected) { hide(); return; }
    if (target.hasAttribute('title')) { take(target); place(target); }
  }, 150);
}

function hide() {
  clearTimeout(timer); clearInterval(watchTimer); clearTimeout(hideTimer);
  if (target && held && target.isConnected && !target.hasAttribute('title')) target.setAttribute('title', held);
  target = null; held = '';
  tip?.classList.remove('show');
}

export function initTooltips() {
  // Souris
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = titled(e.target);
    // Toujours dans le même élément, sauf si l'on entre dans un élément titré qu'il contient
    // (ex. la phrase sous la réputation, dans la barre du haut) : sa bulle prend le relais.
    if (target && target.contains(e.target) && !(el && el !== target && target.contains(el))) return;
    hide();
    if (!el) return;
    target = el;
    take(el); // empêche la bulle du navigateur dès l'entrée
    timer = setTimeout(() => { if (target === el) show(el); }, DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !target) return;
    if (!e.relatedTarget || !target.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { hide(); return; }
    // Doigt : appui long
    swallowClick = false;
    hide();
    const el = titled(e.target);
    if (!el) return;
    press = { x: e.clientX, y: e.clientY, el };
    timer = setTimeout(() => {
      if (!press || press.el !== el) return;
      target = el;
      show(el);
      if (!held) { target = null; return; }
      swallowClick = true;
      if (navigator.vibrate) try { navigator.vibrate(15); } catch { /* sans vibreur */ }
      hideTimer = setTimeout(hide, TOUCH_SHOW);
    }, LONG_PRESS);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOL) { press = null; if (!swallowClick) clearTimeout(timer); }
  }, true);
  const release = () => { press = null; if (!swallowClick) clearTimeout(timer); };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault(); e.stopPropagation();
  }, true);
  // Pas de menu contextuel ni de sélection quand l'appui long a ouvert une bulle.
  document.addEventListener('contextmenu', (e) => { if (swallowClick || (press && titled(e.target))) e.preventDefault(); }, true);
  addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
}
