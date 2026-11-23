// Écrans plein écran : accueil, nouvelle partie (choix du port d'attache), fin de partie.
import { PORTS, PORT_IDS, FLAGS, draftText } from '../data/ports.js';
import { HOLDS, GOODS } from '../data/goods.js';
import { COMPANY_COLORS, COMPANY_LOGOS, DIFFICULTIES, DURATIONS, ranking } from '../sim/game.js';
import { LOGOS, LOGO_IDS, COLORS, logoBadge } from './logos.js';
import { flagEl } from './flags.js';
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
// Le navigateur n'autorise le son qu'après un premier clic : tant qu'il n'a pas
// démarré, le bouton invite à l'activer, et ce premier clic ne le coupe pas.
function soundToggle(app) {
  const a = app.audio;
  const on = () => a.settings.ambience || a.settings.sfx || a.settings.music;
  const label = () => (!on() ? '🔇 Son coupé' : a.unlocked ? '🔊 Son activé' : '🔈 Activer le son');
  const btn = h('button.sound-toggle', {
    title: 'Son', 'aria-label': 'Activer ou couper le son',
    onclick: (e) => {
      e.stopPropagation();
      // Ce clic vient de débloquer le son : il l'active, il ne doit pas aussi le couper.
      const unlockingClick = !!a.unlockTarget && btn.contains(a.unlockTarget);
      a.unlockTarget = null;
      if (!(unlockingClick && on())) {
        const v = !on();
        a.setAmbience(v); a.setSfx(v); a.setMusic(v);
      }
      btn.textContent = label();
    },
  }, label());
  btn.refresh = () => { btn.textContent = label(); };
  return btn;
}

export function titleScreen(app) {
  const saves = listSaves();
  const toggle = soundToggle(app);
  app.audio.onUnlock = () => toggle.refresh();
  screen('title', h('div.title-card', [
    toggle,
    h('div.logo', [h('span.logo-anchor', { html: `<svg viewBox="0 0 64 64" aria-hidden="true">${LOGOS.ancre.svg}</svg>` }), h('h1', 'Port d\'Attache'), h('p.tagline', 'Armateur au long cours')]),
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
    slots: DEFAULT_NAMES.map((name, i) => ({ name, kind: i === 0 ? 'human' : i < 3 ? 'ai' : 'none', color: COMPANY_COLORS[i], logo: COMPANY_LOGOS[i], open: i === 0 })),
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
        h('div.slots', cfg.slots.map((s, i) => {
          const taken = new Set(cfg.slots.filter((o, j) => j !== i && o.kind !== 'none').map((o) => o.color));
          return h('div.slot', { class: s.kind === 'none' ? 'off' : '' }, [
            h('button.logo-option.active', { title: 'Choisir l\'emblème et la couleur', 'aria-label': 'Emblème et couleur', disabled: s.kind === 'none', onclick: () => { s.open = !s.open; render(); }, html: logoBadge(s.logo, s.color, 38) }),
            h('input.input', { value: s.name, maxlength: 28, disabled: s.kind === 'none', 'aria-label': `Nom de la compagnie ${i + 1}`, oninput: (e) => { s.name = e.target.value; } }),
            h('div.seg', [['human', 'Joueur'], ['ai', 'Ordinateur'], ['none', 'Aucune']].map(([k, label]) => h('button', {
              class: s.kind === k ? 'active' : '',
              disabled: (k === 'none' && i === 0),
              onclick: () => { s.kind = k; render(); },
            }, label))),
            h('div.slot-identity', { hidden: !s.open || s.kind === 'none' }, [
              h('div.logo-grid', LOGO_IDS.map((id) => h('button.logo-option', {
                class: id === s.logo ? 'active' : '', title: LOGOS[id].name, 'aria-label': LOGOS[id].name,
                onclick: () => { s.logo = id; render(); }, html: logoBadge(id, s.color, 28),
              }))),
              h('div.color-grid', COLORS.map((c) => h('button.color-option', {
                class: c.id === s.color ? 'active' : '', title: c.name, 'aria-label': c.name, disabled: taken.has(c.id),
                onclick: () => { s.color = c.id; render(); },
              }, h('span', { style: { background: c.id } })))),
            ]),
          ]);
        })),
        h('div.small.muted', 'Touchez l\'emblème d\'une compagnie pour changer son logo et sa couleur.'),
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
        h('h2', [h('span.badge-wrap', { html: logoBadge(slot.logo, slot.color, 30) }), ` ${slot.name || 'Compagnie'} : port d'attache`]),
        h('div.list.compact', PORT_IDS.map((p) => h('button.row.selectable', {
          class: (p === sel ? 'selected ' : '') + (taken.includes(p) ? 'disabled' : ''),
          disabled: taken.includes(p),
          onclick: () => { sel = p; render(); },
        }, [flagEl(PORTS[p].flag, FLAGS[PORTS[p].flag].name), h('span.grow', PORTS[p].name)]))),
      ]),
      h('div.port-detail', [
        h('h2', [flagEl(P.flag, F.name), P.name]),
        h('p.blurb', P.blurb),
        h('h3', `Pavillon : ${F.name}`),
        h('div.ship-stats', [
          kv('Impôt sur les bénéfices', pct(F.tax * 100), F.tax <= 0.03 ? 'good' : F.tax >= 0.15 ? 'bad' : ''),
          kv('Salaires des équipages', `× ${num1(F.crew)}`, F.crew <= 0.9 ? 'good' : F.crew >= 1.2 ? 'bad' : ''),
          kv('Aide aux navires neufs', F.subsidy ? pct(F.subsidy * 100) : 'aucune', F.subsidy ? 'good' : ''),
          kv('Réputation de départ', `${startRep}/100`, startRep >= 65 ? 'good' : startRep < 45 ? 'bad' : ''),
          kv('Taux des prêts', `${num1(F.rate * 100)} %`, F.rate <= 0.045 ? 'good' : F.rate >= 0.1 ? 'bad' : ''),
        ]),
        h('h3', 'Le port'),
        h('div.ship-stats', [
          kv('Tirant d\'eau max', draftText(P)),
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
    companies.push({ name: s.name.trim() || 'Compagnie', human: s.kind === 'human', homePort: port, color: s.color, logo: s.logo });
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
    h('p.big-result', [h('span.badge-wrap', { html: logoBadge(winner.company.logo, winner.company.color, 40) }), ` ${winner.company.name} l'emporte avec ${money(winner.worth)} !`]),
    h('div.list.compact', r.map((x, i) => h('div.row', [
      h('span.rank', `${i + 1}`),
      h('span.badge-wrap', { html: logoBadge(x.company.logo, x.company.color, 24) }),
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
