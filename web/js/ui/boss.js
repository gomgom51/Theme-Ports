// Touche patron (A) : un appui cache le jeu derrière une simple carte du monde (terres, mers, frontières,
// noms des pays et des mers), arrête le temps et coupe la musique et les bruitages ; un second appui remet
// tout comme avant (vitesse, panneaux et fenêtres ouverts, notifications, volume, vue de la carte), sans
// transition ni cloche. Pendant ce temps rien ne peut s'ouvrir (le temps est arrêté, main.js ne fait plus
// que dessiner la carte) et les autres touches ne font rien. Sans effet pendant une saisie, avec Ctrl ou
// Cmd (Ctrl+A sélectionne toujours le texte), pendant l'intro et le générique.
import { holdToasts } from './dom.js';
import { tr } from '../i18n.js';

const isBossKey = (e) => (e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey;
const typing = (el) => !!el?.closest?.('input, select, textarea, [contenteditable]:not([contenteditable="false"])');
// Intro (le caboteur qui quitte le port) et générique : ils ont leurs propres touches.
const busy = (app) => !!document.querySelector('.intro') || app.audio.sceneName === 'credits';

export function initBossKey(app) {
  let saved = null;
  app.boss = false;

  function hide() {
    saved = { speed: app.speed, title: document.title, focus: document.activeElement, view: { ...app.map.view } };
    app.boss = true;
    app.speed = 0;
    document.documentElement.classList.add('boss');
    document.activeElement?.blur?.(); // Entrée ou Espace n'actionnent pas un bouton caché
    app.map.setBare(true);
    app.audio.hush(true);
    holdToasts(true);
    document.title = tr('Carte du monde');
  }

  function show() {
    const s = saved;
    saved = null;
    app.boss = false;
    document.documentElement.classList.remove('boss');
    app.map.setView(s.view.cx, s.view.cy, s.view.scale); // la carte a pu être déplacée pendant ce temps
    app.map.setBare(false);
    holdToasts(false);
    app.audio.hush(false);
    document.title = s.title;
    app.speed = s.speed;
    app.lastSpeed = s.speed; // ni cloche ni tic-tac : le temps reprend comme avant
    if (s.focus?.isConnected && s.focus !== document.body) s.focus.focus?.({ preventScroll: true });
  }

  // Phase de capture sur window : avant tous les autres écouteurs du jeu (document, scènes, générique).
  window.addEventListener('keydown', (e) => {
    if (app.boss) {
      e.stopImmediatePropagation(); // caché : seule la touche A compte (pas même Espace ou Échap)
      if (isBossKey(e) && !e.repeat) { e.preventDefault(); show(); }
      return;
    }
    if (!isBossKey(e) || e.repeat || typing(e.target) || busy(app)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hide();
  }, true);
  window.addEventListener('keyup', (e) => { if (app.boss) e.stopImmediatePropagation(); }, true);
}
