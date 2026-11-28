// Générique de fin, comme à la fin d'un film : les crédits défilent sur la chanson « Port d'attache »,
// et des extraits des scènes du jeu apparaissent çà et là, légendés avec les chiffres de la compagnie
// du joueur. Joué après l'écran de victoire (et à la demande depuis l'accueil).
import { h, tonnes, num } from './dom.js';
import { SCENES } from './scenes.js';
import { W, H } from './pixel.js';
import { logoBadge } from './logos.js';
import { brandTitle, sealSVG } from './brand.js';
import { unlockTracks } from './profile.js';
import { reducedMotion } from './motion.js';

// L'auteur du jeu (nom choisi par lui pour le générique).
export const AUTHOR = 'Clement Gomes';

// Sections du générique : [titre, lignes]. Une ligne peut être [texte, détail en petit].
const SECTIONS = [
  ['Conception, règles du jeu et direction', [AUTHOR]],
  ['Développement', [['Claude (Anthropic)', 'programmation, illustrations, scènes animées, textes et équilibrage']]],
  ['Musique', [['Suno', 'toutes les chansons du jeu'], ['Chanson du générique', '« Port d\'attache »']]],
  ['Bruitages', [
    ['Pompe à carburant', '« basement water pump », freesound_community'],
    ['Cloche', '« opening bell », u_7xr5ffk4oq'],
    ['Tic-tac', '« clock ticking sound effect »'],
    ['Tasse vide', '« empty cup », freesound_community'],
    ['Battements de cœur', '« heartbeat sound effect », shidenbeatsmusic'],
    ['Porte qui claque', '« wooden door slamming close », freesound_community'],
    ['Harpe', '« harp transition music cue », freesound_community'],
    ['Tous sur Pixabay', 'la mer, les mouettes, les cornes et le reste sont synthétisés par le jeu'],
  ]],
  ['Carte', [['Natural Earth', 'domaine public, via world-atlas'], ['Noms des pays', 'i18n-iso-countries']]],
  ['Polices', [['Stardos Stencil', 'logo, par Vernon Adams, SIL Open Font License'], ['Libre Baskerville', 'titres du jeu, SIL Open Font License']]],
  ['Tests', ['Les testeurs insomniaques de la Galaxie']],
  ['', ['Aucun pétrolier n\'a été coulé pendant le tournage.', 'Toute ressemblance avec des armateurs existants serait purement fortuite.']],
];

// Les extraits : toutes les animations du jeu, chacune une fois. D'abord l'histoire de la compagnie
// (légendée avec ses chiffres), puis les autres scènes dans un ordre tiré au hasard.
const NOT_ALONE = new Set(['office', 'trophy', 'grim']); // dessinées avec les images d'une partie (bureau, trophée, méfait)
function clipsFor(company) {
  const H_ = company?.hon || {};
  const clips = [], used = new Set();
  const add = (kind, caption, o = {}) => {
    if (!SCENES[kind] || used.has(kind)) return;
    used.add(kind);
    clips.push({ kind, caption: caption || SCENES[kind].title, o });
  };
  add('newbuild', H_.best?.fleet ? `Plus grande flotte : ${num(H_.best.fleet)} navires` : null, { variant: 'box' });
  add('storm', null, { force: 11 });
  add('harvest', H_.tons ? `Marchandises livrées : ${tonnes(H_.tons)}` : null);
  if (H_.repelled) add('repelled', `Attaques de pirates repoussées : ${num(H_.repelled)}`);
  add('thaw', company?.portsServed?.length ? `Ports desservis : ${num(company.portsServed.length)}` : null);
  if (H_.aid) add('charity', `Aides d'urgence livrées : ${num(H_.aid)}`);
  if (H_.best?.crew) add('crewxp', `Expérience des équipages : ${num(H_.best.crew)} points`);
  if (H_.parcels) add('paid', `Colis discrets livrés : ${num(H_.parcels)}`);
  const rest = Object.keys(SCENES).filter((k) => !used.has(k) && !NOT_ALONE.has(k));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const VARIANTS = { buyship: { variant: 'bulk' }, rivalship: { variant: 'tank' }, storm: { force: 11 } };
  for (const k of rest) add(k, null, VARIANTS[k] || {});
  return clips;
}

// creditsScreen(app, { company, header, onDone }) : company = la compagnie du joueur (légendes et
// couleur), header = une ligne sous le titre (la victoire), onDone = la suite (accueil, fin de partie).
export function creditsScreen(app, { company = null, header = null, onDone = () => {} } = {}) {
  const root = document.getElementById('screen');
  const color = company?.color || '#c4362c';
  const reduced = reducedMotion();
  app.audio.setScene('credits');
  unlockTracks(['credits']); // juke-box : débloqué même sans le son

  const line = (l) => (Array.isArray(l) ? h('div.cr-line', [h('span', l[0]), h('small', l[1])]) : h('div.cr-line', h('span', l)));
  const endCard = h('div.cr-end', [
    h('span.cr-anchor', { html: sealSVG(64) }),
    h('p.cr-thanks', 'Merci d\'avoir joué !'),
    h('p.cr-wind', 'Bon vent.'),
  ]);
  const roll = h('div.cr-roll', [
    h('div.cr-head', [
      brandTitle('h1'),
      company ? h('div.cr-company', [h('span.badge-wrap', { html: logoBadge(company.logo, company.color, 40) }), h('b', { 'data-no-tr': '' }, company.name)]) : null,
      header ? h('p.cr-tag', header) : null,
    ]),
    ...SECTIONS.map(([title, lines]) => h('section.cr-section', [title ? h('h3', title) : null, ...lines.map(line)])),
    endCard,
  ]);
  const viewport = h('div.cr-viewport', { class: reduced ? 'static' : '' }, roll);

  // Deux cadres d'extraits (un seul sur téléphone), qui changent de place à chaque scène.
  const frames = [0, 1].map((side) => {
    const S0 = SCENES.storm;
    const canvas = h('canvas.cr-canvas', { width: W, height: H, 'aria-hidden': 'true' });
    const caption = h('div.cr-caption');
    const el = h('figure.cr-frame', { class: side ? 'right' : 'left' }, [canvas, caption]);
    return { el, canvas, caption, g: canvas.getContext('2d'), clip: null, start: 0, scene: S0 };
  });
  const skip = h('button.btn.ghost.cr-skip', { onclick: () => done() }, 'Passer ⏭');
  const after = h('button.btn.primary.cr-after', { hidden: true, onclick: () => done() }, 'Continuer');
  root.className = 'screen end-credits';
  root.replaceChildren(viewport, ...frames.map((f) => f.el), skip, after);
  root.hidden = false;

  const clips = clipsFor(company);
  let next = 0, finished = false, raf = 0, anim = null;
  const CLIP = 7.5, GAP = 1.2; // secondes : durée d'un extrait, pause entre deux
  const place = (f) => {
    const narrow = innerWidth < 900;
    f.el.style.top = narrow ? '' : `${8 + Math.random() * 46}vh`;
  };
  const startClip = (f, now) => {
    if (!clips.length) return;
    f.clip = clips[next++ % clips.length];
    f.scene = SCENES[f.clip.kind];
    f.start = now;
    f.caption.textContent = f.clip.caption;
    f.canvas.width = W * (f.scene.res || 1); f.canvas.height = H * (f.scene.res || 1);
    f.canvas.classList.toggle('smooth', (f.scene.res || 1) > 1);
    place(f);
  };
  const t0 = performance.now();
  frames.forEach((f, i) => { f.start = t0 + i * 4200 - (CLIP + GAP) * 1000; }); // le second cadre démarre plus tard
  const frame = (now) => {
    if (!root.contains(viewport)) return; // écran remplacé
    const single = innerWidth < 900;
    frames.forEach((f, i) => {
      if (single && i === 1) { f.el.classList.remove('on'); return; }
      const age = (now - f.start) / 1000;
      if (age >= CLIP + GAP) { startClip(f, now); return; }
      f.el.classList.toggle('on', !!f.clip && age < CLIP - 0.5);
      if (!f.clip || age >= CLIP) return;
      const S = f.scene, res = S.res || 1;
      let t = age;
      if (S.loop && t > S.loop[1]) t = S.loop[0] + ((t - S.loop[0]) % (S.loop[1] - S.loop[0]));
      try {
        f.g.setTransform(res, 0, 0, res, 0, 0); f.g.globalAlpha = 1;
        S.draw(f.g, t, { color, ...f.clip.o });
      } catch { f.clip = null; } // une scène qui ne se dessine pas sans contexte : on passe à la suivante
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // Le défilé : du bas de l'écran jusqu'à la carte finale, qui reste au centre.
  const roll_ = () => {
    if (reduced) { after.hidden = false; return; }
    const vh = viewport.clientHeight;
    const stop = vh / 2 - (endCard.offsetTop + endCard.offsetHeight / 2);
    const dist = vh - stop;
    const ms = Math.max(60, Math.min(170, dist / 22)) * 1000; // calé à peu près sur la chanson
    anim = roll.animate([{ transform: `translateY(${vh}px)` }, { transform: `translateY(${stop}px)` }], { duration: ms, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => { finished = true; skip.hidden = true; after.hidden = false; };
  };
  requestAnimationFrame(roll_);

  // Espace : pause ; Échap : passer. Un clic sur le défilé le met aussi en pause.
  const toggle = () => { if (!anim || finished) return; if (anim.playState === 'paused') anim.play(); else anim.pause(); viewport.classList.toggle('paused', anim.playState === 'paused'); };
  viewport.addEventListener('click', toggle);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  };
  document.addEventListener('keydown', onKey, true);
  let closed = false;
  function done() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    anim?.cancel();
    document.removeEventListener('keydown', onKey, true);
    onDone();
  }
}
