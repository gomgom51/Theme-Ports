// Écrans plein écran : accueil, nouvelle partie (choix du port d'attache), fin de partie.
import { PORTS, PORT_IDS, FLAGS } from '../data/ports.js';
import { HOLDS, GOODS } from '../data/goods.js';
import { COMPANY_COLORS, DIFFICULTIES, DURATIONS, ranking } from '../sim/game.js';
import { yearOf } from '../sim/util.js';
import { fuelPrice } from '../sim/economy.js';
import { h, money, num1, pct, lineChart } from './dom.js';
import { listSaves, SLOT_LABEL, hasSave } from './save.js';

const DEFAULT_NAMES = ['Armement du Ponant', 'Hanse Reederei', 'Pacific Star Lines', 'Levant Maritime'];
const REPAIR = ['aucun', 'petit (70 % max)', 'complet', 'grand chantier'];

function screen(cls, children) {
  const root = document.getElementById('screen');
  root.className = 'screen ' + cls;
  root.replaceChildren(...[].concat(children));
  root.hidden = false;
  return root;
}
export function hideScreen() {
  const root = document.getElementById('screen');
  root.hidden = true;
  root.replaceChildren();
}

// ---------- Accueil ----------
export function titleScreen(app) {
  const saves = listSaves();
  screen('title', h('div.title-card', [
    h('div.logo', [h('span.logo-anchor', '⚓'), h('h1', 'Port d\'Attache'), h('p.tagline', 'Armateur au long cours')]),
    h('div.title-buttons', [
      hasSave('auto') ? h('button.btn.primary.big', { onclick: () => app.loadSlot('auto') }, 'Continuer') : null,
      h('button.btn.big', { class: hasSave('auto') ? '' : 'primary', onclick: () => setupScreen(app) }, 'Nouvelle partie'),
      saves.length ? h('button.btn.big.ghost', { onclick: () => loadScreen(app) }, 'Charger une partie') : null,
      app.canImport ? h('button.btn.big.ghost', { onclick: () => app.importSave() }, 'Importer un fichier') : null,
    ]),
    h('p.credits', 'Carte : Natural Earth (domaine public).'),
  ]));
}

export function loadScreen(app) {
  const saves = listSaves();
  screen('title', h('div.title-card.wide', [
    h('h2', 'Charger une partie'),
    h('div.list', saves.map((s) => h('button.row.selectable', { onclick: () => app.loadSlot(s.slot) }, [
      h('span.grow', [h('b', SLOT_LABEL[s.slot]), h('div.small.muted', s.meta.companies)]),
      h('span.muted.small', s.meta.date),
    ]))),
    h('button.btn.ghost', { onclick: () => titleScreen(app) }, '← Retour'),
  ]));
}

// ---------- Nouvelle partie ----------
export function setupScreen(app) {
  const cfg = app.setupCfg || (app.setupCfg = {
    duration: 5, difficulty: 'normal', autoPause: true,
    slots: DEFAULT_NAMES.map((name, i) => ({ name, kind: i === 0 ? 'human' : i < 3 ? 'ai' : 'none', color: COMPANY_COLORS[i] })),
  });
  const render = () => {
    const humans = cfg.slots.filter((s) => s.kind === 'human').length;
    const active = cfg.slots.filter((s) => s.kind !== 'none').length;
    screen('setup', h('div.setup-card', [
      h('h2', 'Nouvelle partie'),
      h('div.field', [h('div.field-label', 'Durée'), h('div.chips', DURATIONS.map((d) => h('button.chip', { class: cfg.duration === d.years ? 'active' : '', onclick: () => { cfg.duration = d.years; render(); } }, d.label)))]),
      h('div.field', [
        h('div.field-label', 'Difficulté'),
        h('div.chips', Object.entries(DIFFICULTIES).map(([k, d]) => h('button.chip', { class: cfg.difficulty === k ? 'active' : '', onclick: () => { cfg.difficulty = k; render(); } }, d.label))),
        h('div.small.muted', DIFFICULTIES[cfg.difficulty].text),
      ]),
      h('div.field', [
        h('div.field-label', 'Compagnies (joueurs sur cet appareil ou ordinateur)'),
        h('div.slots', cfg.slots.map((s, i) => h('div.slot', { class: s.kind === 'none' ? 'off' : '' }, [
          h('span.swatch', { style: { background: s.color } }),
          h('input.input', { value: s.name, maxlength: 28, disabled: s.kind === 'none', 'aria-label': `Nom de la compagnie ${i + 1}`, oninput: (e) => { s.name = e.target.value; } }),
          h('div.seg', [['human', 'Joueur'], ['ai', 'Ordinateur'], ['none', 'Aucune']].map(([k, label]) => h('button', {
            class: s.kind === k ? 'active' : '',
            disabled: (k === 'none' && i === 0),
            onclick: () => { s.kind = k; render(); },
          }, label))),
        ]))),
        humans === 0 ? h('div.small.warn-text', 'Il faut au moins une compagnie « Joueur ».') : null,
      ]),
      h('label.check', [h('input', { type: 'checkbox', checked: cfg.autoPause, onchange: (e) => { cfg.autoPause = e.target.checked; } }), ' Mettre le jeu en pause quand un navire attend des ordres']),
      h('div.setup-buttons', [
        h('button.btn.ghost', { onclick: () => titleScreen(app) }, '← Retour'),
        h('button.btn.primary', { disabled: humans === 0 || active === 0, onclick: () => choosePorts(app, cfg, 0) }, 'Choisir les ports d\'attache →'),
      ]),
    ]));
  };
  render();
}

function choosePorts(app, cfg, index) {
  const humans = cfg.slots.filter((s) => s.kind === 'human');
  if (index >= humans.length) { startFromSetup(app, cfg); return; }
  const slot = humans[index];
  const taken = humans.slice(0, index).map((s) => s.port);
  let sel = slot.port && !taken.includes(slot.port) ? slot.port : PORT_IDS.find((p) => !taken.includes(p));
  const render = () => {
    const P = PORTS[sel], F = FLAGS[P.flag];
    app.map.highlightPorts = new Set([sel]);
    app.map.centerOn(P.lon, P.lat, Math.max(app.map.minScale, 2.4));
    const startRep = Math.round(F.rating * 0.5 + 25);
    screen('setup ports', h('div.port-choice', [
      h('div.port-list', [
        h('h2', [h('span.swatch', { style: { background: slot.color } }), ` ${slot.name || 'Compagnie'} : port d'attache`]),
        h('div.list.compact', PORT_IDS.map((p) => h('button.row.selectable', {
          class: (p === sel ? 'selected ' : '') + (taken.includes(p) ? 'disabled' : ''),
          disabled: taken.includes(p),
          onclick: () => { sel = p; render(); },
        }, [h('span.grow', PORTS[p].name), h('span.muted.small', FLAGS[PORTS[p].flag].name)]))),
      ]),
      h('div.port-detail', [
        h('h2', P.name),
        h('p.blurb', P.blurb),
        h('h3', `Pavillon : ${F.name}`),
        h('div.ship-stats', [
          kv('Impôt sur les bénéfices', pct(F.tax * 100), F.tax <= 0.05 ? 'good' : F.tax >= 0.25 ? 'bad' : ''),
          kv('Salaires des équipages', `× ${num1(F.crew)}`, F.crew <= 0.8 ? 'good' : F.crew >= 1.4 ? 'bad' : ''),
          kv('Aide aux navires neufs', F.subsidy ? pct(F.subsidy * 100) : 'aucune', F.subsidy ? 'good' : ''),
          kv('Réputation de départ', `${startRep}/100`, startRep >= 65 ? 'good' : startRep < 45 ? 'bad' : ''),
          kv('Taux des prêts', `${num1(F.rate * 100)} %`, F.rate <= 0.045 ? 'good' : F.rate >= 0.1 ? 'bad' : ''),
        ]),
        h('h3', 'Le port'),
        h('div.ship-stats', [
          kv('Tirant d\'eau max', `${num1(P.draft)} m`),
          kv('Chantier', REPAIR[P.repair], P.repair >= 3 ? 'good' : P.repair === 0 ? 'bad' : ''),
          kv('Fuel', `${Math.round(fuelPrice(app.previewState, sel))} $/t`),
          kv('Terminaux', P.terminals.map((t) => HOLDS[t]).join(', ')),
        ]),
        h('p', ['Exporte : ', ...Object.keys(P.exp).map((g) => h('span.tag.good', `${GOODS[g].icon} ${GOODS[g].name}`)), Object.keys(P.exp).length ? '' : 'rien']),
        h('p', ['Importe : ', ...Object.keys(P.imp).map((g) => h('span.tag', `${GOODS[g].icon} ${GOODS[g].name}`)), Object.keys(P.imp).length ? '' : 'rien']),
        h('div.setup-buttons', [
          h('button.btn.ghost', { onclick: () => (index ? choosePorts(app, cfg, index - 1) : setupScreen(app)) }, '← Retour'),
          h('button.btn.primary', { onclick: () => { slot.port = sel; choosePorts(app, cfg, index + 1); } }, index + 1 < humans.length ? 'Valider, compagnie suivante →' : 'Prendre la mer !'),
        ]),
      ]),
    ]));
    const selected = document.querySelector('.port-list .selected');
    selected?.scrollIntoView({ block: 'nearest' });
  };
  render();
}

function kv(label, value, cls = '') {
  return h('div.stat', [h('div.stat-label', label), h('div.stat-value', { class: cls }, value)]);
}

function startFromSetup(app, cfg) {
  const used = new Set(cfg.slots.filter((s) => s.kind === 'human').map((s) => s.port));
  // Les compagnies de l'ordinateur prennent des ports variés et bien équipés.
  const good = PORT_IDS.filter((p) => PORTS[p].size >= 3 && PORTS[p].terminals.length >= 3);
  const companies = [];
  for (const s of cfg.slots) {
    if (s.kind === 'none') continue;
    let port = s.port;
    if (s.kind === 'ai') {
      const choices = good.filter((p) => !used.has(p));
      port = choices[Math.floor(Math.random() * choices.length)] || PORT_IDS.find((p) => !used.has(p));
      used.add(port);
    }
    companies.push({ name: s.name.trim() || 'Compagnie', human: s.kind === 'human', homePort: port, color: s.color });
  }
  app.map.highlightPorts = null;
  app.newGame({ duration: cfg.duration, difficulty: cfg.difficulty, autoPause: cfg.autoPause, companies });
}

// ---------- Fin de partie ----------
export function endScreen(app) {
  const { state } = app;
  const r = ranking(state);
  const winner = r[0];
  screen('setup', h('div.setup-card', [
    h('h2', 'Fin de la partie'),
    h('p', state.over.reason),
    h('p.big-result', [h('span.swatch', { style: { background: winner.company.color } }), ` ${winner.company.name} l'emporte avec ${money(winner.worth)} !`]),
    h('div.list.compact', r.map((x, i) => h('div.row', [
      h('span.rank', `${i + 1}`),
      h('span.dot', { style: { background: x.company.color } }),
      h('span.grow', [h('b', x.company.name), x.company.human ? '' : h('span.muted.small', ' (ordinateur)')]),
      x.company.bankrupt ? h('span.tag.bad', 'faillite') : null,
      h('b', money(x.worth)),
    ]))),
    lineChart(state.companies.map((c) => ({ color: c.color, points: c.history.map((p) => [p.t, p.nw]) })), { yFormat: (v) => money(v), xFormat: (t) => String(yearOf(t)) }),
    h('div.setup-buttons', [
      h('button.btn.ghost', { onclick: () => app.toTitle() }, 'Menu principal'),
      state.companies.some((c) => c.human && !c.bankrupt) ? h('button.btn.primary', { onclick: () => app.continueEndless() }, 'Continuer sans limite de temps') : null,
    ]),
  ]));
}
