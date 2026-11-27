// Mouvements de l'interface (choix du propriétaire : « mécanique, mais très doux », rétro et moderne).
// - Panneaux : un tiroir qui sort de sous le rail et s'arrête net (un léger rebond de 6 px).
// - Onglets : une barre de laiton balaie la nouvelle page, dans l'ordre des onglets ; le soulignement glisse.
// - Boîtes de dialogue : un tampon pressé sur la carte, avec un petit choc (et son bruit, joué par l'appelant).
// Rien ne bouge si le système demande moins d'animations. Les rafraîchissements du panneau (toutes les
// 1,2 s) ne rejouent rien : seuls l'ouverture, la fermeture, le changement de panneau et d'onglet animent.

export const MOTION = {
  drawerIn: 240,   // ms : sortie du tiroir, rebond compris
  drawerOut: 150,  // ms : rentrée du tiroir (accélère, sans rebond)
  overshoot: 6,    // px : le tiroir dépasse un peu sa butée, puis revient
  wipe: 240,       // ms : balayage de la page d'un onglet
  stamp: 180,      // ms : le tampon se pose
  stampOut: 100,   // ms : la boîte se retire
  thud: 3,         // px : le choc du tampon sur la carte
};

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHADOW = 60; // px laissés à gauche du panneau pour son ombre

// Position du tiroir : décalé de x vers la droite, et coupé au bord où il se range (sous le rail).
const drawer = (x) => ({ transform: `translateX(${x}px)`, clipPath: `inset(0 ${x}px 0 -${SHADOW}px)` });
const offset = (el) => el.offsetWidth + SHADOW;
// Décalage actuel d'un panneau en mouvement (0 au repos).
function currentX(el) {
  const t = getComputedStyle(el).transform;
  return !t || t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41;
}
const moving = (el) => el.getAnimations().some((a) => a.playState === 'running' || a.playState === 'pending');

// Le tiroir sort. delay : attendre que l'ancien soit rentré (il reste caché pendant ce temps).
export function drawerIn(el, delay = 0) {
  if (reducedMotion()) return null;
  el.getAnimations().forEach((a) => a.cancel());
  const off = offset(el), o = MOTION.overshoot;
  return el.animate([
    { ...drawer(off), easing: 'cubic-bezier(.55,0,.25,1)' },
    { ...drawer(-o), offset: 0.8, easing: 'ease-in-out' },
    { ...drawer(o / 3), offset: 0.92, easing: 'ease-out' },
    drawer(0),
  ], { duration: MOTION.drawerIn, delay, fill: 'backwards' });
}

// Le panneau qui part : une copie inerte rentre dans son tiroir pendant que le vrai change déjà de contenu.
// Renvoie la durée de la rentrée (0 sans animation), pour enchaîner la sortie du suivant.
export function drawerOutCopy(el) {
  if (reducedMotion() || el.hidden || !el.isConnected) return 0;
  const from = currentX(el), off = offset(el);
  el.getAnimations().forEach((a) => a.cancel());
  if (from >= off - 1) return 0;
  const ghost = el.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.add('panel-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  el.before(ghost);
  const src = el.querySelector('.panel-body'), dst = ghost.querySelector('.panel-body');
  if (src && dst) dst.scrollTop = src.scrollTop;
  const ms = Math.round(MOTION.drawerOut * (1 - Math.max(0, from) / off));
  ghost.animate([{ ...drawer(from), easing: 'cubic-bezier(.55,0,.85,.35)' }, drawer(off)], { duration: ms, fill: 'forwards' })
    .finished.catch(() => {}).then(() => ghost.remove());
  return ms;
}

// Changement de panneau : l'ancien rentre, le nouveau sort. Si le panneau est encore en train de sortir
// (clics rapprochés), il continue sa course avec le nouveau contenu : rien ne s'empile.
export const panelSwapBegin = (el) => (moving(el) ? -1 : drawerOutCopy(el));

// Onglet : l'ancienne page reste dessous, la nouvelle est découverte par une barre de laiton qui
// balaie dans le sens des onglets (vers la droite pour un onglet plus à droite).
export function wipeTab(panel, oldBody, newBody, dir, oldScroll = 0) {
  if (reducedMotion() || !oldBody || !newBody || !dir) return;
  oldBody.getAnimations().forEach((a) => a.cancel());
  const top = newBody.offsetTop, h = newBody.offsetHeight, w = panel.clientWidth;
  Object.assign(oldBody.style, { position: 'absolute', left: '0', right: '0', top: `${top}px`, height: `${h}px`, zIndex: '0', pointerEvents: 'none' });
  oldBody.setAttribute('aria-hidden', 'true');
  oldBody.inert = true;
  panel.append(oldBody);
  oldBody.scrollTop = oldScroll;
  newBody.classList.add('wiping');
  const bar = document.createElement('div');
  bar.className = 'wipe-bar';
  Object.assign(bar.style, { top: `${top}px`, height: `${h}px` });
  panel.append(bar);
  const e = 'cubic-bezier(.5,0,.25,1)';
  const from = dir > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
  newBody.animate([{ clipPath: from, easing: e }, { clipPath: 'inset(0 0 0 0)', offset: 0.84 }, { clipPath: 'inset(0 0 0 0)' }], { duration: MOTION.wipe });
  const x0 = dir > 0 ? -6 : w - 6, x1 = dir > 0 ? w - 6 : -6;
  const end = () => { oldBody.remove(); bar.remove(); newBody.classList.remove('wiping'); };
  bar.animate([
    { transform: `translateX(${x0}px)`, opacity: 1, easing: e },
    { transform: `translateX(${x1}px)`, opacity: 1, offset: 0.84, easing: 'ease-out' },
    { transform: `translateX(${x1 - dir * 7}px)`, opacity: 1, offset: 0.92, easing: 'ease-in' },
    { transform: `translateX(${x1}px)`, opacity: 1, offset: 0.96 },
    { transform: `translateX(${x1}px)`, opacity: 0 },
  ], { duration: MOTION.wipe + 30, fill: 'forwards' }).finished.catch(() => {}).then(end);
}

// Le soulignement de l'onglet glisse de l'ancien au nouveau, avec un petit dépassement.
export function slideTabLine(tabsEl, fromId, toId) {
  if (reducedMotion() || !tabsEl) return;
  const a = tabsEl.querySelector(`[data-tab="${fromId}"]`), b = tabsEl.querySelector(`[data-tab="${toId}"]`);
  if (!a || !b) return;
  const box = (t) => ({ left: `${t.offsetLeft}px`, top: `${t.offsetTop + t.offsetHeight - 3}px`, width: `${t.offsetWidth}px` });
  const dir = Math.sign(b.offsetLeft - a.offsetLeft);
  const line = document.createElement('span');
  line.className = 'tab-line';
  tabsEl.append(line);
  tabsEl.classList.add('tabs-sliding');
  const end = box(b);
  line.animate([
    { ...box(a), easing: 'cubic-bezier(.55,0,.25,1)' },
    { ...end, left: `${b.offsetLeft + dir * 3}px`, offset: 0.82, easing: 'ease-out' },
    end,
  ], { duration: 200, fill: 'forwards' }).finished.catch(() => {}).then(() => { line.remove(); tabsEl.classList.remove('tabs-sliding'); });
}

// Le tampon : le voile tombe en deux crans, la boîte est pressée sur la carte, et la carte encaisse le choc.
// Renvoie le délai (s) jusqu'au contact, pour caler le bruit ; null sans animation.
const JOLTED = ['#map', '#hud', '.rail', '#panel', '#ticker', '#standings', '.opps'];
export function stampIn(wrap, box) {
  if (reducedMotion()) return null;
  wrap.animate([{ opacity: 0, easing: 'steps(3, end)' }, { opacity: 1 }], { duration: 120 });
  box.animate([
    { transform: 'scale(1.14)', opacity: 0, easing: 'cubic-bezier(.6,0,.4,1)' },
    { transform: 'scale(.985)', opacity: 1, offset: 0.58, easing: 'ease-out' },
    { transform: 'scale(1.004)', opacity: 1, offset: 0.8 },
    { transform: 'scale(1)', opacity: 1 },
  ], { duration: MOTION.stamp });
  const hit = Math.round(MOTION.stamp * 0.56), d = MOTION.thud;
  document.querySelectorAll(JOLTED.join(',')).forEach((el) => {
    if (el.hidden) return;
    el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${d}px)`, offset: 0.35 }, { transform: 'translateY(-1px)', offset: 0.7 }, { transform: 'translateY(0)' }],
      { duration: 110, delay: hit, composite: 'add' });
  });
  return hit / 1000;
}

// La boîte se retire : la vraie disparaît tout de suite (le jeu reprend la main), une copie inerte s'efface.
export function stampOut(wrap) {
  if (reducedMotion() || !wrap.parentNode) return;
  const ghost = wrap.cloneNode(true);
  ghost.classList.remove('dialog-wrap');
  ghost.classList.add('dialog-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  wrap.after(ghost);
  const box = ghost.querySelector('.dialog');
  const box0 = wrap.querySelector('.dialog');
  if (box && box0) box.scrollTop = box0.scrollTop;
  ghost.animate([{ opacity: 1, easing: 'steps(2, end)' }, { opacity: 0 }], { duration: MOTION.stampOut, fill: 'forwards' })
    .finished.catch(() => {}).then(() => ghost.remove());
  box?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.96)', opacity: 0 }], { duration: MOTION.stampOut, fill: 'forwards' });
}
