// Le bureau en fond du panneau Bureau (choix du propriétaire) : la pièce en pixel art (officepx.js) est peinte
// derrière tous les onglets, le niveau tient sur une plaque de laiton, le juke-box se clique, et la feuille des
// chiffres glisse devant la pièce quand on fait défiler.
// - La pièce est le fond (background) du corps du panneau : il ne défile pas avec le contenu, et les copies du
//   panneau (tiroir qui rentre, balayage d'onglet) le gardent, contrairement à un canevas.
// - Un pixel du dessin vaut 2 px de l'interface, arrondi au pixel de l'écran (comme les navires) : net à toutes
//   les tailles d'interface.
import { paintOffice, officeArtVersion } from './officepx.js';
import { pixelRatio } from './scale.js';
import { h } from './dom.js';

const ROOM_H = 172; // hauteur du dessin (pixels du dessin), plancher compris
const SHEET_FLOOR = 5; // pixels de sol visibles entre les meubles et la feuille
const cache = new Map(); // dessins déjà convertis en images (le panneau se redessine toutes les 1,2 s)

const toURL = (img) => {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL('image/png');
};
function art(o, W, H) {
  const key = JSON.stringify([o.tier, o.shadow, o.color, o.logo, o.model, o.held, W, H, officeArtVersion()]);
  let a = cache.get(key);
  if (!a) {
    const r = paintOffice({ ...o, W, H });
    a = { room: toURL(r.room), floor: toURL(r.floor), F: r.F, juke: r.juke ? { x: r.juke.x, y: r.juke.y, w: r.juke.w, h: r.juke.h, url: toURL(r.juke.img) } : null };
    cache.set(key, a);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
  } else { cache.delete(key); cache.set(key, a); }
  return a;
}

// Taille du dessin pour un corps de panneau de bw × bh px (interface).
function geometry(bw, bh) {
  const pr = pixelRatio();
  let dev = Math.max(1, Math.round(2 * pr)); // pixels de l'écran par pixel du dessin
  if ((bw * pr) / dev < 300) dev = Math.max(1, Math.floor((bw * pr) / 300)); // panneau très étroit : pixels plus fins
  const k = dev / pr; // px de l'interface par pixel du dessin
  const W = Math.ceil(Math.ceil((bw * pr) / dev) / 16) * 16; // par paliers : on ne redessine pas à chaque pixel de poignée
  let H = ROOM_H;
  if (bh && H * k > bh * 0.55) H = Math.max(120, Math.floor((bh * 0.55) / k));
  const left = Math.round(((bw - W * k) / 2) * pr) / pr; // aligné sur les pixels de l'écran
  return { k, W, H, left };
}

/**
 * o : tier, shadow, color, logo, model, held (voir paintOffice) ;
 * plate : { name, level, fill (0..1 ou null), title } ; juke : { on, open }.
 * Renvoie { top, mount } : top se place en tête du corps du panneau, mount(body) peint la pièce une fois
 * le panneau affiché (et quand il change de taille).
 */
export function officeRoom(o, plate, juke) {
  const spot = h('button.office-juke-spot', {
    type: 'button', 'aria-label': 'Juke-box', title: 'Juke-box', class: juke.on ? 'juke-on' : '',
    style: { '--juke-phase': `-${((performance.now() / 1000) % 2.4).toFixed(2)}s` },
    onclick: juke.open,
  }, [h('span.juke-sprite'), h('span.juke-notes', { 'aria-hidden': 'true' }, [h('i', '♪'), h('i', '♫')])]);
  const top = h('div.office-room', [
    h('div.office-plate', { title: plate.title }, [
      h('b', plate.name),
      h('span.office-plate-row', [
        h('span', plate.level),
        plate.fill != null ? h('span.level-bar', [h('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, plate.fill)) * 100)}%` } })]) : null,
      ]),
    ]),
    spot,
  ]);
  const mount = (body) => {
    const bw = body.clientWidth, bh = body.clientHeight;
    if (!bw) return;
    const g = geometry(bw, bh);
    const a = art(o, g.W, g.H);
    const roomH = (a.F + SHEET_FLOOR) * g.k;
    Object.assign(body.style, {
      backgroundImage: `url(${a.room}), url(${a.floor})`,
      backgroundSize: `${g.W * g.k}px ${g.H * g.k}px, ${g.W * g.k}px ${16 * g.k}px`,
      backgroundPosition: `${g.left}px 0px, ${g.left}px ${g.H * g.k}px`,
      backgroundRepeat: 'no-repeat, repeat-y',
    });
    top.style.height = `${roomH}px`;
    body.style.setProperty('--sheet-min', `${Math.max(0, bh - roomH)}px`);
    if (a.juke) {
      Object.assign(spot.style, { left: `${g.left + a.juke.x * g.k}px`, top: `${a.juke.y * g.k}px`, width: `${a.juke.w * g.k}px`, height: `${a.juke.h * g.k}px`, display: '' });
      spot.firstChild.style.backgroundImage = `url(${a.juke.url})`;
    } else spot.style.display = 'none';
  };
  return { top, mount };
}
