// Noms de navires au pochoir partout (choix du propriétaire) : dans les listes comme dans les phrases
// (messages, bandeau des nouvelles, dialogues, encaissement, journal de bord…).
// Une passe après la traduction (i18n.js traduit d'abord la phrase entière) enveloppe chaque nom connu
// dans <span class="nm">. Une phrase coupée ainsi passe dans un <span data-no-tr> : elle est déjà
// traduite et ses morceaux ne doivent pas l'être une seconde fois.
// Seuls les noms de navires de la partie (flotte, courtier) sont connus, cumulés pendant la session :
// le journal parle encore des navires vendus. La carte (canvas) a ses propres étiquettes.

const NAMES = new Set();
let re = null;
let list = [];

export function registerShipNames(names) {
  const n0 = NAMES.size;
  for (const n of names) if (typeof n === 'string' && n.trim().length >= 2) NAMES.add(n.trim());
  if (NAMES.size !== n0) re = null;
}
// Tous les navires d'une partie, et ceux du courtier.
export function registerStateShips(state) {
  if (!state) return;
  registerShipNames([...(state.ships || []).map((s) => s.name), ...(state.used || []).map((l) => l.name)]);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function regex() {
  if (re || !NAMES.size) return re;
  list = [...NAMES].sort((a, b) => b.length - a.length); // le plus long d'abord : « Narval 8 » avant « Narval »
  re = new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(esc).join('|')})(?=[^\\p{L}\\p{N}]|$)`, 'gu');
  return re;
}

// Là où l'on ne touche à rien : champs de saisie, dessins, noms déjà au pochoir.
const SKIP = 'script, style, textarea, input, select, option, canvas, svg, .nm, [data-no-name]';

function wrapText(node) {
  const t = node.nodeValue;
  if (!t || t.length < 2 || !node.parentElement) return;
  const r = regex();
  if (!r) return;
  r.lastIndex = 0;
  if (!r.test(t)) return;
  const parent = node.parentElement;
  if (parent.closest(SKIP)) return;
  const out = document.createElement('span');
  out.className = 'nm-text';
  out.setAttribute('data-no-tr', '');
  let last = 0;
  r.lastIndex = 0;
  for (let m = r.exec(t); m; m = r.exec(t)) {
    const start = m.index + m[1].length;
    if (start > last) out.append(t.slice(last, start));
    const s = document.createElement('span');
    s.className = 'nm';
    s.textContent = m[2];
    out.append(s);
    last = start + m[2].length;
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
export function watchShipNames() {
  if (typeof MutationObserver === 'undefined') return;
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else for (const n of m.addedNodes) pending.add(n);
    }
    if (pending.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  walk(document.body);
}
