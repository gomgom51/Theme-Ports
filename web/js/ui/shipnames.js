// Noms de navires au pochoir partout (choix du propriétaire) : dans les listes comme dans les phrases
// (messages, bandeau des nouvelles, dialogues, encaissement, journal de bord…).
// Une passe après la traduction (i18n.js traduit d'abord la phrase entière) enveloppe chaque nom connu
// dans <span class="nm">. Une phrase coupée ainsi passe dans un <span data-no-tr> : elle est déjà
// traduite et ses morceaux ne doivent pas l'être une seconde fois.
// Seuls les noms de navires de la partie (flotte, courtier) sont connus, cumulés pendant la session :
// le journal parle encore des navires vendus. La carte (canvas) a ses propres étiquettes.
// La même passe rend cliquable chaque nom de ville (<span class="city" data-port>, en français comme en
// anglais) : un clic le fait clignoter en vert sur la carte (onCityClick). Pas dans les boutons d'action ni
// sur les écrans hors partie. Les noms des compagnies et des capitaines sont reconnus pour être laissés tels
// quels : un capitaine Valdez ou une compagnie « Rotterdam Lines » ne deviennent pas des liens.
import EN from '../i18n/en.js';
import { PORTS } from '../data/ports.js';

const NAMES = new Set();
const PLAIN = new Set(); // compagnies, capitaines : reconnus, jamais enveloppés
let re = null;
let list = [];

// Nom de ville (français, anglais, forme contractée « au Havre ») → port.
const CITY = new Map();
for (const [id, p] of Object.entries(PORTS)) {
  CITY.set(p.name, id);
  if (EN[p.name]) CITY.set(EN[p.name], id);
}
for (const [alias, name] of [['Havre', 'Le Havre'], ['Pirée', 'Le Pirée']]) {
  const id = Object.keys(PORTS).find((k) => PORTS[k].name === name);
  if (id) CITY.set(alias, id);
}

export function registerShipNames(names) {
  const n0 = NAMES.size;
  for (const n of names) if (typeof n === 'string' && n.trim().length >= 2) NAMES.add(n.trim());
  if (NAMES.size !== n0) re = null;
}
// Tous les navires d'une partie, et ceux du courtier.
export function registerStateShips(state) {
  if (!state) return;
  registerShipNames([...(state.ships || []).map((s) => s.name), ...(state.used || []).map((l) => l.name)]);
  const n0 = PLAIN.size;
  for (const n of [...(state.companies || []).flatMap((c) => [c.name, c.captain]), ...(state.ships || []).map((s) => s.captainName)]) {
    if (typeof n === 'string' && n.trim().length >= 2 && !CITY.has(n.trim())) PLAIN.add(n.trim());
  }
  if (PLAIN.size !== n0) re = null;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function regex() {
  if (re) return re;
  // Le plus long d'abord : « Narval 8 » avant « Narval », « Le Havre » avant « Havre » ; à longueur égale, le navire.
  list = [...new Set([...NAMES, ...PLAIN, ...CITY.keys()])].sort((a, b) => b.length - a.length);
  re = new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(esc).join('|')})(?=[^\\p{L}\\p{N}]|$)`, 'gu');
  return re;
}

// Là où l'on ne touche à rien : champs de saisie, dessins, noms déjà au pochoir ou déjà liens.
const SKIP = 'script, style, textarea, input, select, option, canvas, svg, .nm, .city, [data-no-name]';
// Là où une ville n'est pas un lien : boutons d'action (le bouton garde son rôle), écrans hors partie.
const NO_CITY = '.btn, .chip, .icon-btn, .opp-port, a[href], label, summary, #screen, [data-no-city]';

function wrapText(node) {
  const t = node.nodeValue;
  if (!t || t.length < 2 || !node.parentElement) return;
  const r = regex();
  if (!r) return;
  r.lastIndex = 0;
  if (!r.test(t)) return;
  const parent = node.parentElement;
  if (parent.closest(SKIP)) return;
  const cities = !parent.closest(NO_CITY);
  const hits = [];
  r.lastIndex = 0;
  for (let m = r.exec(t); m; m = r.exec(t)) {
    const name = m[2], start = m.index + m[1].length;
    if (NAMES.has(name)) hits.push({ start, name, cls: 'nm' });
    else if (!PLAIN.has(name) && cities && CITY.has(name)) hits.push({ start, name, cls: 'city', port: CITY.get(name) });
  }
  if (!hits.length) return;
  const out = document.createElement('span');
  out.className = 'nm-text';
  out.setAttribute('data-no-tr', '');
  let last = 0;
  for (const x of hits) {
    if (x.start > last) out.append(t.slice(last, x.start));
    const s = document.createElement('span');
    s.className = x.cls;
    if (x.port) s.dataset.port = x.port;
    s.textContent = x.name;
    out.append(s);
    last = x.start + x.name.length;
  }
  if (last < t.length) out.append(t.slice(last));
  node.replaceWith(out);
}

function walk(root) {
  if (root.nodeType === 3) { wrapText(root); return; }
  if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n);
  nodes.forEach(wrapText);
}

// Les ajouts sont traités à l'image suivante, après la traduction (qui passe en microtâche).
let pending = new Set(), scheduled = false;
function flush() {
  scheduled = false;
  const todo = pending;
  pending = new Set();
  for (const n of todo) if (n.isConnected) walk(n);
}
// Clic sur un nom de ville : fn(port). Dans une ligne de liste, le clic montre la ville et n'ouvre pas la ligne.
let cityHandler = null;
export function onCityClick(fn) { cityHandler = fn; }
function cityClick(e) {
  const c = e.target.closest?.('.city[data-port]');
  if (!c || !cityHandler) return;
  e.stopPropagation(); e.preventDefault();
  cityHandler(c.dataset.port);
}

export function watchShipNames() {
  if (typeof MutationObserver === 'undefined') return;
  document.addEventListener('click', cityClick, true);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else for (const n of m.addedNodes) pending.add(n);
    }
    if (pending.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  walk(document.body);
}
