// Petits utilitaires d'interface : création d'éléments, formats français, notifications.
import { formatDate } from '../sim/util.js';
import { stampIn, stampOut } from './motion.js';

// h('div.card', { onclick }, [enfants...])
export function h(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node)) { children = attrs; attrs = {}; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
// Retire les notifications portant une étiquette (ex. un paiement déjà encaissé).
export function dropToasts(tag) { document.querySelectorAll(`#toasts [data-tag="${tag}"]`).forEach((e) => e.remove()); }

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function money(v, signed = false) {
  const s = signed && v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${s}${nf2.format(a / 1e9)} Md$`;
  if (a >= 1e6) return `${s}${nf2.format(a / 1e6)} M$`;
  if (a >= 1e4) return `${s}${nf0.format(a / 1e3)} k$`;
  return `${s}${nf0.format(a)} $`;
}
export const num = (v) => nf0.format(v);
export const num1 = (v) => nf1.format(v);
export const tonnes = (v) => `${nf0.format(v)} t`;
export const pct = (v) => `${nf0.format(v)} %`;
export const date = (t, short) => formatDate(t, short);
export function duration(hours) {
  if (hours < 1) return 'moins d\'une heure';
  if (hours < 36) return `${Math.round(hours)} h`;
  const d = hours / 24;
  return d < 10 ? `${nf1.format(d)} jours` : `${nf0.format(d)} jours`;
}
export const days = (d) => (d < 10 ? `${nf1.format(d)} j` : `${nf0.format(d)} j`);

// Barre de progression (0..1) avec une couleur selon le niveau.
export function bar(value, { good = 0.6, warn = 0.3, invert = false, label } = {}) {
  const v = Math.max(0, Math.min(1, value));
  const level = invert ? (v > 1 - warn ? 'bad' : v > 1 - good ? 'warn' : 'good') : (v >= good ? 'good' : v >= warn ? 'warn' : 'bad');
  return h('div.bar', { class: level, title: label || '' }, [h('span', { style: { width: `${v * 100}%` } })]);
}

// ---------- Notifications ----------
let toastRoot;
export function toast(text, { action, onAction, kind = 'info', timeout = 6000, tag = null } = {}) {
  toastRoot = toastRoot || document.getElementById('toasts');
  const el = h('div.toast', { class: kind, 'data-tag': tag }, [
    h('div.toast-text', text),
    action ? h('button.btn.small', { onclick: (e) => { e.stopPropagation(); el.remove(); onAction?.(); } }, action) : null,
    h('button.toast-close', { 'aria-label': 'Fermer', onclick: (e) => { e.stopPropagation(); el.remove(); } }, '×'),
  ]);
  toastRoot.prepend(el);
  const max = window.innerHeight < 500 ? 3 : 4;
  while (toastRoot.children.length > max) toastRoot.lastChild.remove();
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

// Bruit du tampon à l'ouverture d'une boîte (branché par main.js sur l'audio du jeu).
export const dialogHooks = { onStamp: null };
// La boîte est pressée sur la carte (motion.js) ; elle part tout de suite, une copie s'efface.
// quiet : une boîte qui revient souvent (l'encaissement) se pose sans secousse ni bruit.
function stampDialog(wrap, quiet = false) {
  const hit = stampIn(wrap, wrap.querySelector('.dialog'), { jolt: !quiet });
  if (hit != null && !quiet) dialogHooks.onStamp?.(hit);
}
const unstamp = (wrap) => { stampOut(wrap); wrap.remove(); };

// Boîte de dialogue simple (confirmation ou information).
export function dialog({ title, body, buttons, vertical = false, wide = false, quiet = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialogs');
    const close = (v) => { unstamp(wrap); resolve(v); };
    const wrap = h('div.dialog-wrap', { onclick: (e) => { if (e.target === wrap) close(null); } }, [
      h('div.dialog', { class: wide ? 'wide' : '' }, [
        title ? h('h2', title) : null,
        typeof body === 'string' ? h('p', body) : body,
        h('div.dialog-buttons', { class: vertical ? 'vertical' : '' }, buttons.map((b) => h('button.btn', { ...(b.attrs || {}), class: b.kind || '', onclick: () => close(b.value) }, b.label))),
      ]),
    ]);
    root.append(wrap);
    stampDialog(wrap, quiet);
  });
}
export const confirmBox = (title, body, ok = 'Confirmer') =>
  dialog({ title, body, buttons: [{ label: 'Annuler', value: false, kind: 'ghost' }, { label: ok, value: true, kind: 'primary' }] });

export function promptBox(title, value = '', label = '') {
  return new Promise((resolve) => {
    const input = h('input.input', { value, maxlength: 24, 'aria-label': label || title });
    const root = document.getElementById('dialogs');
    const close = (v) => { unstamp(wrap); resolve(v); };
    const wrap = h('div.dialog-wrap', [
      h('div.dialog', [
        h('h2', title),
        label ? h('label.field-label', label) : null,
        input,
        h('div.dialog-buttons', [
          h('button.btn.ghost', { onclick: () => close(null) }, 'Annuler'),
          h('button.btn.primary', { onclick: () => close(input.value.trim() || null) }, 'Valider'),
        ]),
      ]),
    ]);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value.trim() || null); });
    root.append(wrap);
    stampDialog(wrap);
    setTimeout(() => input.focus(), 30);
  });
}

// Petit graphique en ligne (SVG) : séries [{ color, points: [[x, y], ...] }].
export function lineChart(series, { width = 520, height = 180, yFormat = (v) => v, xFormat = (v) => v } = {}) {
  const all = series.flatMap((s) => s.points);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart');
  if (all.length < 2) return svg;
  const pad = { l: 56, r: 10, t: 10, b: 22 };
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
  if (y1 === y0) y1 = y0 + 1;
  const X = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (width - pad.l - pad.r);
  const Y = (y) => height - pad.b - ((y - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  const el = (n, a) => { const e = document.createElementNS(ns, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  for (let k = 0; k <= 3; k++) {
    const v = y0 + ((y1 - y0) * k) / 3;
    svg.append(el('line', { x1: pad.l, x2: width - pad.r, y1: Y(v), y2: Y(v), class: 'grid' }));
    const tx = el('text', { x: pad.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'axis' });
    tx.textContent = yFormat(v);
    svg.append(tx);
  }
  if (y0 < 0) svg.append(el('line', { x1: pad.l, x2: width - pad.r, y1: Y(0), y2: Y(0), class: 'zero' }));
  for (const k of x1 > x0 ? [0, 1] : [0]) {
    const v = k ? x1 : x0;
    const tx = el('text', { x: X(v), y: height - 6, 'text-anchor': k ? 'end' : 'start', class: 'axis' });
    tx.textContent = xFormat(v);
    svg.append(tx);
  }
  for (const s of series) {
    if (s.points.length < 2) continue;
    svg.append(el('polyline', { points: s.points.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  }
  return svg;
}

// Champ de recherche : quelques lettres filtrent les lignes marquées data-search (sans accents ni
// majuscules). Le texte tapé est gardé (app.form) et le curseur survit aux rafraîchissements du panneau.
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function searchBox(form, key, placeholder = 'Rechercher un port…') {
  const input = h('input.input.search-box', { type: 'search', placeholder, value: form[key] || '', 'data-focus-key': key, 'aria-label': placeholder, autocomplete: 'off' });
  let scope = null;
  const apply = () => {
    form[key] = input.value;
    const q = norm(input.value.trim());
    for (const el of (scope || document).querySelectorAll('[data-search]')) el.hidden = !!q && !norm(el.dataset.search).includes(q);
  };
  input.addEventListener('input', apply);
  // à appeler une fois les lignes en place (scope : le conteneur des lignes)
  return { input, apply: (container) => { scope = container; apply(); } };
}

