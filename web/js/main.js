// Point d'entrée : boucle de jeu, interface principale, notifications, sauvegardes.
import { makeContext } from './sim/context.js';
import { newGame, tick, ranking } from './sim/game.js';
import { Rng, formatDate, HOURS_PER_DAY } from './sim/util.js';
import { shipsOf, isIdle, shipById, netWorth } from './sim/core.js';
import { PORTS } from './data/ports.js';
import { MapView } from './ui/map.js';
import { h, $, money, toast, dialog, confirmBox } from './ui/dom.js';
import { shipPanel } from './ui/panel-ship.js';
import { PANELS } from './ui/panels.js';
import { titleScreen, setupScreen, hideScreen, endScreen } from './ui/screens.js';
import { playIntro } from './ui/intro.js';
import { saveGame, loadGame, listSaves, SLOT_LABEL, exportFile, importFile, isAndroid } from './ui/save.js';
import { AudioManager } from './ui/audio.js';
import { logoBadge } from './ui/logos.js';
import { flagSVG } from './ui/flags.js';
import * as eco from './sim/economy.js';
import * as act from './sim/actions.js';
import { SHIP_TYPES } from './data/ships.js';
import { etaOf } from './ui/panel-ship.js';
import { openPayment } from './ui/payment.js';
import { computeAlerts } from './ui/alerts.js';
import { openCase } from './ui/shady.js';
import { showBattle, openRansom, showPatrol } from './ui/piracy.js';
import { officeTier } from './ui/officeart.js';
import { initI18n, setLang, getLang } from './i18n.js';

const HOURS_PER_SECOND = [0, 3, 8, 24];
// Pause automatique : navire qui attend des ordres (arrivé à vide, déchargement terminé…) ou coup dur.
// L'arrivée d'un navire qui décharge ne met plus en pause : la cloche suffit.
const PAUSE_KINDS = new Set(['idle', 'sunk', 'bank', 'bankrupt', 'detention', 'pollution', 'sanction']);

const ctx = makeContext();
const app = {
  state: null, ctx, speed: 0, mode: 'title',
  ui: { activeCompany: 0, selectedShip: null, panel: null },
  form: { dest: {}, speed: {}, autoRefuel: {} },
  canImport: !isAndroid(),
  audio: new AudioManager(),
};

// ---------- Carte ----------
app.map = new MapView($('#map'), {
  onShip: (id) => {
    if (app.mode !== 'game') return;
    const ship = shipById(app.state, id);
    if (!ship) return;
    app.ui.selectedShip = id;
    app.open('ship', id);
  },
  onPort: (id) => { if (app.mode === 'game') app.open('port', id); },
  onEmpty: () => { if (app.mode === 'game') { app.ui.selectedShip = null; } },
});

// Partie de démonstration derrière l'écran d'accueil.
function startDemo() {
  app.demo = newGame({ seed: 7, duration: 0, companies: ['rotterdam', 'singapour', 'houston', 'shanghai'].map((p, i) => ({ name: 'Démo ' + i, human: false, homePort: p })) }, ctx);
  tick(app.demo, ctx, 24 * 40);
  app.previewState = app.demo;
}

// ---------- Panneaux ----------
const panelEl = $('#panel');
let lastInteraction = 0;
panelEl.addEventListener('pointerdown', () => { lastInteraction = performance.now(); });
panelEl.addEventListener('input', () => { lastInteraction = performance.now(); });
const scrollMemory = new Map();

app.open = (type, id = null, tab = null) => {
  const prev = app.ui.panel;
  app.ui.panel = { type, id, tab: tab ?? (prev && prev.type === type && prev.id === id ? prev.tab : null) };
  if (type === 'ship') app.ui.selectedShip = id;
  if (type !== 'ship') app.setPreview(null);
  renderPanel();
};
app.close = () => {
  app.ui.panel = null;
  app.setPreview(null);
  renderPanel();
};
app.openTab = (tab) => { if (app.ui.panel) { app.ui.panel.tab = tab; renderPanel(); } };
app.refresh = () => { app.alertsAt = 0; renderPanel(); updateHud(); };
app.company = () => app.state.companies[app.ui.activeCompany];
app.toast = (text, opts) => toast(text, opts);
app.setPreview = (route) => { app.map.preview = route; };
app.withRng = (fn) => {
  const rng = new Rng(app.state.rng);
  const r = fn(rng);
  app.state.rng = rng.s;
  return r;
};
// Exécute une action et affiche son erreur éventuelle.
app.act = (fn, opts = {}) => {
  const r = fn();
  if (r && r.ok === false) toast(r.msg, { kind: 'bad' });
  if (r?.ok && opts.sound) app.audio.play(typeof opts.sound === 'function' ? opts.sound(r) : opts.sound);
  if (opts.close && r?.ok) app.close(); else if (opts.refresh !== false) app.refresh();
  return r;
};
app.focusShip = (id) => {
  const ship = shipById(app.state, id);
  if (!ship) return;
  const pos = ship.status === 'sea' ? ctx.shipPosition(ship) : PORTS[ship.port];
  if (pos) app.map.centerOn(pos.lon, pos.lat, Math.max(app.map.view.scale, 5));
};

function renderPanel() {
  const p = app.ui.panel;
  if (!p || app.mode !== 'game') { panelEl.hidden = true; panelEl.replaceChildren(); document.body.classList.remove('panel-open'); return; }
  const fn = p.type === 'ship' ? shipPanel : PANELS[p.type];
  const def = fn(app, p.id, p.tab);
  const tabs = def.tabs || null;
  let tabId = p.tab || def.tab || (tabs ? tabs[0][0] : null);
  if (tabs && !tabs.some((t) => t[0] === tabId)) tabId = tabs[0][0];
  const key = `${p.type}:${p.id}:${tabId}`;
  const oldBody = panelEl.querySelector('.panel-body');
  if (oldBody && panelEl.dataset.key) scrollMemory.set(panelEl.dataset.key, oldBody.scrollTop);

  const body = h('div.panel-body');
  if (def.top) body.append(def.top);
  if (tabs) {
    const current = tabs.find((t) => t[0] === tabId);
    body.append(current[2]());
  } else if (def.body) body.append(def.body);

  panelEl.replaceChildren(...[
    h('div.panel-head', { style: def.color ? { borderTopColor: def.color } : {} }, [
      def.icon || (def.badge ? h('span.badge-wrap', { html: logoBadge(def.badge[0], def.badge[1], 36) }) : null),
      h('div.panel-titles', [h('h2', def.title), def.subtitle ? h('div.panel-sub', def.subtitle) : null]),
      h('div.panel-actions', [...(def.headerActions || []), h('button.icon-btn', { 'aria-label': 'Fermer', title: 'Fermer', onclick: app.close }, '✕')]),
    ]),
    tabs ? h('div.tabs', { role: 'tablist' }, tabs.map(([id, label]) => h('button.tab', {
      role: 'tab', class: id === tabId ? 'active' : '', 'aria-selected': id === tabId ? 'true' : 'false',
      onclick: () => app.openTab(id),
    }, label))) : null,
    body,
  ].filter(Boolean));
  panelEl.dataset.key = key;
  panelEl.hidden = false;
  document.body.classList.add('panel-open');
  if (scrollMemory.has(key)) body.scrollTop = scrollMemory.get(key);
}

// ---------- Barre du haut et boutons ----------
// Classement toujours visible (en bas à gauche) : médailles, emblème, nom, valeur nette.
const MEDALS = ['🥇', '🥈', '🥉'];
function updateStandings(s, me) {
  const el = $('#standings');
  const rows = ranking(s);
  const key = rows.map((r) => `${r.company.id}:${Math.round(r.worth / 1e4)}:${r.company.bankrupt}`).join('|') + `|${me}`;
  el.hidden = false;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren(...rows.map((r, i) => h('span.standings-row', { class: [r.company.id === me ? 'me' : '', r.company.bankrupt ? 'out' : ''].join(' ') }, [
    h('span.standings-rank', MEDALS[i] || `${i + 1}.`),
    h('span.standings-logo', { html: logoBadge(r.company.logo, r.company.color, 16) }),
    h('span.standings-name', r.company.name),
    h('span.standings-worth', r.company.bankrupt ? 'faillite' : money(r.worth)),
  ])));
}

function updateHud() {
  if (app.mode !== 'game') return;
  const s = app.state, c = app.company();
  const logoKey = c.logo + c.color;
  const logoEl = $('#hud-company-logo');
  if (logoEl.dataset.key !== logoKey) { logoEl.innerHTML = logoBadge(c.logo, c.color, 34); logoEl.dataset.key = logoKey; }
  $('#hud-company-name').textContent = c.name;
  updateContext();
  const cash = $('#hud-cash');
  cash.textContent = money(c.cash);
  cash.classList.toggle('neg', c.cash < 0);
  $('#hud-date').textContent = formatDate(s.t);
  document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === app.speed));
  const idle = shipsOf(s, c.id).filter(isIdle).length + s.payments.filter((p) => p.company === c.id).length;
  const badge = $('#badge-fleet');
  badge.textContent = idle || '';
  badge.hidden = !idle;
  // Notifications importantes et standing (musique) : recalculés au plus deux fois par seconde.
  const now = performance.now();
  if (!app.alertsAt || now - app.alertsAt > 500 || app.alertsKey !== c.id) {
    app.alertsAt = now;
    app.alertsKey = c.id;
    const alerts = computeAlerts(s, ctx, c.id).filter((a) => a.level <= 1);
    const ab = $('#badge-alerts');
    ab.textContent = alerts.length || '';
    ab.hidden = !alerts.length;
    ab.classList.toggle('urgent', alerts.some((a) => a.level === 0));
    app.audio.setMusicTier(officeTier(netWorth(s, c.id)));
    updateStandings(s, c.id);
  }
  const humans = s.companies.filter((x) => x.human);
  $('#hud-company').classList.toggle('switchable', humans.length > 1);
  const news = s.news[0];
  $('#ticker').textContent = news ? `${formatDate(news.t, true)} · ${news.text}` : '';
}

// Informations du navire sélectionné dans la barre du haut : port, plein, réparations.
function updateContext() {
  const el = $('#hud-context');
  const s = app.state;
  const ship = app.ui.selectedShip != null ? shipById(s, app.ui.selectedShip) : null;
  if (!ship) { if (el.dataset.key) { el.replaceChildren(); el.dataset.key = ''; } return; }
  const T = SHIP_TYPES[ship.type];
  const mine = ship.owner === app.ui.activeCompany;
  const company = s.companies[ship.owner];
  const key = [ship.id, ship.status, ship.port, ship.busyWhat, Math.round(ship.fuel), Math.round(ship.condition), Math.floor(s.t / 6), company.cash > 0, mine].join('|');
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const kids = [];
  if (ship.status === 'sea') {
    const v = ship.voyage, P = PORTS[v.to];
    kids.push(h('div.ctx-ship', [h('b', ship.name), h('span', { html: `→ ${P.name} <span class="flag" style="width:15px;height:10px">${flagSVG(P.flag)}</span> · arrivée le ${formatDate(etaOf(s, ctx, ship), true)}` })]));
    const need = act.fuelToFinish(s, ctx, ship, v.speed);
    kids.push(h('div.ctx-btn', { title: 'Carburant à bord / nécessaire pour finir le voyage' }, [h('span', 'Fuel à bord / à prévoir'), h('b', { class: need > ship.fuel ? 'neg' : '' }, `⛽ ${Math.round(ship.fuel)} t / ${Math.round(need)} t`)]));
  } else {
    const P = PORTS[ship.port];
    kids.push(h('div.ctx-ship', [h('b', ship.name), h('span', { html: `⚓ ${P.name} <span class="flag" style="width:15px;height:10px">${flagSVG(P.flag)}</span>${mine ? '' : ' · ' + company.name}` })]));
    if (mine) {
      const want = T.tank - ship.fuel;
      const price = eco.fuelPrice(s, ship.port);
      kids.push(h('button.ctx-btn', {
        disabled: want < 1, title: `Faire le plein (${Math.round(price)} $/t)`,
        onclick: () => app.act(() => act.buyFuel(s, ship.id, want), { sound: 'fuel' }),
      }, [h('span', want < 1 ? 'Soutes pleines' : `Plein ${Math.round(want)} t`), h('b', `⛽ ${want < 1 ? `${Math.round(price)} $/t` : money(want * price)}`)]));
      const rc = eco.repairCost(s, ship, ship.port, 100);
      const can = rc && rc.points > 0.5 && !ship.busyWhat && ship.status === 'port';
      kids.push(h('button.ctx-btn', {
        disabled: !can,
        title: rc ? `Réparer jusqu'à ${rc.to} %` : 'Pas de chantier dans ce port',
        onclick: async () => {
          if (await confirmBox(`Réparer le ${ship.name} ?`, `Remise en état de ${Math.round(ship.condition)} % à ${rc.to} % : ${money(rc.cost)}, immobilisé ${Math.round(rc.hours / 24 * 10) / 10} jours.`, 'Réparer')) {
            app.act(() => act.repair(s, ship.id, rc.to), { sound: 'pay' });
          }
        },
      }, [h('span', rc ? (rc.points > 0.5 ? `Réparer → ${rc.to} %` : rc.to < 100 && ship.condition < 99 ? `Chantier limité à ${rc.to} %` : 'En bon état') : 'Pas de chantier'), h('b', `🔧 ${rc && rc.points > 0.5 ? `${money(rc.cost)} · ${Math.max(1, Math.round(rc.hours / 24))} j` : rc ? `${Math.round(ship.condition)} %` : '—'}`)]));
    }
  }
  el.replaceChildren(...kids);
}

app.setSpeed = (v) => {
  app.speed = v;
  if (v > 0 && app.state && shipsOf(app.state, app.ui.activeCompany).length === 0 && app.state.orders.every((o) => o.owner !== app.ui.activeCompany) && app.state.t < 24 * 3) {
    toast('Astuce : achetez d\'abord un navire chez le courtier 🏗️.', { action: 'Courtier', onAction: () => app.open('broker') });
  }
  updateHud();
};

$('#hud').addEventListener('click', (e) => {
  const b = e.target.closest('[data-speed]');
  if (b) app.setSpeed(+b.dataset.speed);
});
$('#hud-company').addEventListener('click', () => {
  const humans = app.state.companies.filter((c) => c.human && !c.bankrupt);
  if (humans.length > 1) {
    const i = humans.findIndex((c) => c.id === app.ui.activeCompany);
    switchCompany(humans[(i + 1) % humans.length].id);
  } else app.open('office');
});
$('#hud-menu').addEventListener('click', () => gameMenu());
document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => {
  const type = b.dataset.panel;
  if (app.ui.panel?.type === type) app.close(); else app.open(type);
}));

function turnBanner(company) {
  const el = h('div.turn-banner', [h('div.turn-card', [
    h('span.badge-wrap', { html: logoBadge(company.logo, company.color, 64) }),
    h('div', [h('h2', company.name), h('p', 'À vous de jouer')]),
  ])]);
  document.body.append(el);
  setTimeout(() => el.remove(), 2000);
}

function switchCompany(id, { banner = true } = {}) {
  app.ui.activeCompany = id;
  app.ui.selectedShip = null;
  if (banner) turnBanner(app.company());
  if (app.ui.panel && app.ui.panel.type !== 'port' && app.ui.panel.type !== 'markets' && app.ui.panel.type !== 'news' && app.ui.panel.type !== 'help') app.close();
  const home = PORTS[app.company().homePort];
  app.map.centerOn(home.lon, home.lat, app.map.view.scale);
  app.refresh();
}

// ---------- Notifications ----------
function handleNotes(notes) {
  let paused = false, switched = false;
  // Un navire qui vient de livrer : le message de paiement suffit.
  const delivered = new Set(notes.filter((n) => n.kind === 'payment').map((n) => n.shipId));
  for (const n of notes) {
    if (n.kind === 'idle' && delivered.has(n.shipId)) {
      if (app.state.settings.autoPause) paused = true;
      continue;
    }
    if (n.kind === 'over') { app.speed = 0; saveGame(app.state, 'auto'); endScreen(app); app.mode = 'end'; app.audio.setScene('end'); return true; }
    if (n.kind === 'event') { toast(`📰 ${n.text}`, { timeout: 9000 }); if (app.state.settings.autoPause) paused = true; continue; }
    if (n.kind === 'depart') { app.audio.play('depart'); continue; }
    if (n.kind === 'hijack') {
      app.speed = 0;
      app.audio.play('sunk');
      toast(n.text, { kind: 'bad', timeout: 20000, action: 'Décider', onAction: () => openRansom(app, n.shipId, n.report) });
      openRansom(app, n.shipId, n.report);
      continue;
    }
    if (n.kind === 'patrol') {
      if (n.report?.outcome === 'seized') { app.speed = 0; app.audio.play('sunk'); }
      toast(n.text, { kind: n.report?.outcome === 'seized' ? 'bad' : 'info', timeout: 12000, action: 'Le contrôle', onAction: () => showPatrol(app, n) });
      continue;
    }
    if (n.kind === 'pirates') {
      toast(n.text, { kind: n.report?.outcome === 'repelled' ? 'info' : 'warn', timeout: 12000, action: 'Le combat', onAction: () => showBattle(app, n) });
      continue;
    }
    if (n.kind === 'customs') {
      app.speed = 0;
      toast(n.text, { kind: 'bad', timeout: 20000, action: 'Décider', onAction: () => openCase(app, n.caseId) });
      openCase(app, n.caseId);
      continue;
    }
    if (n.kind === 'paid') { app.audio.play('cash'); toast(n.text, { kind: 'money', timeout: 7000 }); continue; }
    if (n.kind === 'payment') {
      const cid = n.company;
      toast(n.text, {
        kind: 'money', timeout: 15000, action: 'Encaisser', tag: `pay-${n.paymentId}`,
        onAction: () => { if (cid !== app.ui.activeCompany) switchCompany(cid); openPayment(app, n.paymentId); },
      });
      continue;
    }
    if (n.kind === 'arrival' || (n.kind === 'idle' && / est arrivé /.test(n.text))) app.audio.play('arrive');
    if (n.kind === 'sunk') app.audio.play('sunk');
    const company = n.company != null ? app.state.companies[n.company] : null;
    const prefix = company && app.state.companies.filter((c) => c.human).length > 1 ? `${company.name} : ` : '';
    const kind = ['sunk', 'bankrupt', 'bank', 'detention', 'pollution', 'sanction'].includes(n.kind) ? 'bad' : ['storm', 'breakdown', 'fuel', 'incident'].includes(n.kind) ? 'warn' : 'info';
    toast(prefix + n.text, {
      kind,
      timeout: PAUSE_KINDS.has(n.kind) ? 12000 : 7000,
      action: n.shipId && shipById(app.state, n.shipId) ? 'Voir' : null,
      onAction: () => {
        if (n.company != null && n.company !== app.ui.activeCompany) switchCompany(n.company);
        app.open('ship', n.shipId);
        app.focusShip(n.shipId);
      },
    });
    if (PAUSE_KINDS.has(n.kind) && app.state.settings.autoPause) {
      paused = true;
      // Partie à plusieurs : c'est au tour de la compagnie dont le navire attend.
      if (company && company.id !== app.ui.activeCompany && !switched) { switchCompany(company.id); switched = true; }
    }
  }
  if (paused) app.speed = 0;
  return paused;
}

// ---------- Boucle principale ----------
let last = performance.now(), acc = 0, lastRefresh = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (app.mode === 'title' && app.demo) {
    acc += dt * 10;
    const n = Math.floor(acc);
    if (n > 0) { acc -= n; tick(app.demo, ctx, n); }
  } else if (app.mode === 'game' && app.speed > 0 && !app.state.over) {
    acc += dt * HOURS_PER_SECOND[app.speed];
    let n = Math.floor(acc);
    acc -= n;
    let changed = false;
    while (n-- > 0) {
      const day = Math.floor(app.state.t / HOURS_PER_DAY);
      const notes = tick(app.state, ctx, 1);
      if (notes.length) changed = true;
      if (Math.floor(app.state.t / HOURS_PER_DAY) !== day && (app.state.t / HOURS_PER_DAY) % 7 === 0) saveGame(app.state, 'auto');
      if (notes.length && handleNotes(notes)) { acc = 0; break; }
    }
    if ((changed || now - lastRefresh > 1200) && now - lastInteraction > 2500 && !document.querySelector('.dialog-wrap')) {
      lastRefresh = now;
      renderPanel();
    }
  }
  if (app.mode === 'game' && app.speed === 0) acc = 0;
  app.map.frame(app.mode === 'game' && app.speed > 0 ? acc : 0);
  updateHud();
  requestAnimationFrame(loop);
}

// ---------- Démarrage d'une partie ----------
function enterGame(state) {
  app.state = state;
  app.mode = 'game';
  app.speed = 0;
  app.form = { dest: {}, speed: {}, autoRefuel: {} };
  app.ui = { activeCompany: state.companies.find((c) => c.human && !c.bankrupt)?.id ?? 0, selectedShip: null, panel: null };
  app.map.setGame(state, ctx, app.ui);
  document.body.classList.add('in-game');
  app.audio.setScene('game');
  hideScreen();
  const home = PORTS[app.company().homePort];
  app.map.centerOn(home.lon, home.lat, Math.max(app.map.minScale, 3));
  app.refresh();
}

app.newGame = (opts) => {
  const state = newGame(opts, ctx);
  enterGame(state);
  saveGame(state, 'auto');
  const humans = state.companies.filter((c) => c.human);
  dialog({
    title: 'Bienvenue, armateur !',
    body: h('div', [
      h('p', `Vous disposez de ${money(app.company().cash)} pour fonder votre empire maritime${humans.length > 1 ? ' (chaque compagnie joue à son tour quand ses navires attendent des ordres)' : ''}.`),
      h('ol', [
        h('li', 'Achetez un premier navire chez le courtier 🏗️ : deux bateaux abordables attendent dans votre port.'),
        h('li', 'Touchez votre navire puis acceptez un contrat : il chargera et partira tout seul.'),
        h('li', 'Lancez le temps avec ▶. Le jeu se met en pause quand un navire attend vos ordres.'),
      ]),
    ]),
    buttons: [{ label: 'Comment jouer', value: 'help', kind: 'ghost' }, { label: 'Ouvrir le courtier', value: 'broker', kind: 'primary' }],
  }).then((v) => {
    if (v === 'help') app.open('help'); else if (v) app.open('broker');
    const home = PORTS[app.company().homePort];
    app.map.centerOn(home.lon, home.lat, Math.max(app.map.minScale, 3));
  });
};

app.loadSlot = (slot) => {
  const state = loadGame(slot);
  if (!state) { toast('Impossible de charger cette sauvegarde.', { kind: 'bad' }); return; }
  enterGame(state);
  toast(`Partie chargée : ${formatDate(state.t)}.`, { timeout: 3000 });
};

app.importSave = async () => {
  try { enterGame(await importFile()); } catch (e) { toast(e.message || 'Fichier invalide.', { kind: 'bad' }); }
};

app.toTitle = () => {
  if (app.state && app.mode === 'game') saveGame(app.state, 'auto');
  app.mode = 'title';
  app.state = null;
  app.ui.panel = null;
  renderPanel();
  document.body.classList.remove('in-game');
  app.map.setGame(app.demo, ctx, { activeCompany: -1 });
  app.map.fitWorld();
  app.audio.setScene('title');
  titleScreen(app);
};

app.continueEndless = () => {
  app.state.settings.duration = 0;
  app.state.over = null;
  app.mode = 'game';
  hideScreen();
  app.refresh();
};

// ---------- Menu ----------
async function gameMenu() {
  const wasSpeed = app.speed;
  app.speed = 0;
  const v = await dialog({
    title: 'Menu',
    body: h('div.menu-info', [h('p.muted', `${formatDate(app.state.t)} · ${app.company().name} · valeur nette ${money(netWorth(app.state, app.ui.activeCompany))}`)]),
    buttons: [
      { label: 'Sauvegarder', value: 'save' },
      { label: 'Charger', value: 'load' },
      ...(app.canImport ? [{ label: 'Exporter un fichier', value: 'export' }] : []),
      { label: app.state.settings.autoPause ? 'Pause auto : oui' : 'Pause auto : non', value: 'pause' },
      { label: app.audio.settings.ambience ? 'Ambiance sonore : oui' : 'Ambiance sonore : non', value: 'ambience' },
      { label: app.audio.settings.sfx ? 'Bruitages : oui' : 'Bruitages : non', value: 'sfx' },
      { label: app.audio.settings.music ? 'Musique : oui' : 'Musique : non', value: 'music' },
      { label: getLang() === 'fr' ? 'Langue : Français' : 'Langue : English', value: 'lang' },
      { label: 'Comment jouer', value: 'help' },
      { label: 'Menu principal', value: 'title', kind: 'ghost' },
      { label: 'Reprendre', value: 'resume', kind: 'primary' },
    ],
    vertical: true,
  });
  if (v === 'save') {
    const slot = await dialog({ title: 'Sauvegarder', body: 'Choisissez un emplacement.', vertical: true, buttons: ['1', '2', '3'].map((s) => ({ label: SLOT_LABEL[s], value: s })).concat([{ label: 'Annuler', value: null, kind: 'ghost' }]) });
    if (slot) toast(saveGame(app.state, slot) ? `Partie sauvegardée (${SLOT_LABEL[slot]}).` : 'Échec de la sauvegarde.', { timeout: 3000 });
  } else if (v === 'load') {
    const saves = listSaves();
    const slot = await dialog({ title: 'Charger', body: saves.length ? 'Choisissez une sauvegarde.' : 'Aucune sauvegarde.', vertical: true, buttons: saves.map((s) => ({ label: `${SLOT_LABEL[s.slot]} — ${s.meta.date}`, value: s.slot })).concat([{ label: 'Annuler', value: null, kind: 'ghost' }]) });
    if (slot && (await confirmBox('Charger cette partie ?', 'La partie en cours non sauvegardée sera perdue.', 'Charger'))) app.loadSlot(slot);
  } else if (v === 'export') exportFile(app.state);
  else if (v === 'pause') { app.state.settings.autoPause = !app.state.settings.autoPause; toast(`Pause automatique ${app.state.settings.autoPause ? 'activée' : 'désactivée'}.`, { timeout: 2500 }); }
  else if (v === 'ambience') { app.audio.setAmbience(!app.audio.settings.ambience); app.speed = wasSpeed; }
  else if (v === 'sfx') { app.audio.setSfx(!app.audio.settings.sfx); app.speed = wasSpeed; }
  else if (v === 'music') { app.audio.setMusic(!app.audio.settings.music); app.speed = wasSpeed; }
  else if (v === 'lang') { setLang(getLang() === 'fr' ? 'en' : 'fr'); app.speed = wasSpeed; }
  else if (v === 'help') app.open('help');
  else if (v === 'title') { if (await confirmBox('Retour au menu principal ?', 'La partie est sauvegardée automatiquement.', 'Quitter')) app.toTitle(); }
  else if (v === 'resume') app.speed = wasSpeed;
}

// ---------- Clavier, bouton retour Android, mise en veille ----------
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (app.mode !== 'game') return;
  if (e.key === ' ') { e.preventDefault(); app.setSpeed(app.speed ? 0 : 1); }
  else if (e.key >= '1' && e.key <= '3') app.setSpeed(+e.key);
  else if (e.key === 'Escape') { if (document.querySelector('.dialog-wrap')) return; app.close(); }
});

window.handleBack = () => {
  const d = document.querySelector('.dialog-wrap');
  if (d) { d.remove(); return true; }
  if (app.mode === 'game' && app.ui.panel) { app.close(); return true; }
  if (app.mode === 'game') { gameMenu(); return true; }
  if (app.mode === 'end') { app.toTitle(); return true; }
  const scr = document.getElementById('screen');
  if (scr.classList.contains('setup')) { titleScreen(app); return true; }
  return false;
};
const pauseAndSave = () => { if (app.mode === 'game' && app.state) { app.speed = 0; saveGame(app.state, 'auto'); } };
window.onAppPause = () => { pauseAndSave(); app.audio.suspend(); };
window.onAppResume = () => app.audio.resume();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseAndSave(); app.audio.suspend(); } else app.audio.resume();
});
window.addEventListener('beforeunload', () => { if (app.mode === 'game' && app.state) saveGame(app.state, 'auto'); });

// Version navigateur : installable comme une application et jouable hors ligne.
if ('serviceWorker' in navigator && !isAndroid() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

$('#standings').addEventListener('click', () => app.open('office', null, 'classement'));

// ---------- Lancement ----------
initI18n(); // langue : français, ou anglais (choix enregistré, sinon langue de l'appareil)
window.addEventListener('langchange', () => { app.map.dirty = true; });
startDemo();
app.map.setGame(app.demo, ctx, { activeCompany: -1 });
app.map.fitWorld();
app.audio.setScene('title');
titleScreen(app);
playIntro(app); // au lancement seulement : le caboteur quitte le port, puis le menu
requestAnimationFrame(loop);
window.__app = app; // pratique pour le débogage dans la console
