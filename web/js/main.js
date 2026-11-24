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
import { guideTick, startGuide, guideMenuLabel, toggleGuide } from './ui/guide.js';
import { logoBadge } from './ui/logos.js';
import { flagSVG } from './ui/flags.js';
import * as eco from './sim/economy.js';
import * as act from './sim/actions.js';
import { SHIP_TYPES } from './data/ships.js';
import { etaOf } from './ui/panel-ship.js';
import { openPayment } from './ui/payment.js';
import { unreadCounts, markSeen } from './ui/alerts.js';
import { openCase } from './ui/shady.js';
import { showBattle, openRansom, showPatrol } from './ui/piracy.js';
import { officeTier, OFFICE_TIERS, musicStep, reachedTier, MUSIC_LOW, officeSVG } from './ui/officeart.js';
import { initI18n, setLang, getLang } from './i18n.js';
import { showScene, scenesOn, setScenesOn, shipKind } from './ui/scenes.js';
import { EVENT_SCENES } from './ui/scenes-world.js';
import { escortFee } from './sim/ice.js';
import { darkOfferDialog, seizedDialog } from './ui/dark.js';
import { heldDialog } from './ui/plots.js';

const HOURS_PER_SECOND = [0, 3, 8, 24];
// Pause automatique : navire qui attend des ordres (arrivé à vide, déchargement terminé…) ou coup dur.
// L'arrivée d'un navire qui décharge ne met plus en pause : la cloche suffit.
const INCIDENT_SCENES = { incendie: 'fire', abordage: 'collision', echouement: 'grounding', voie_eau: 'leak', machine: 'breakdown', froid: 'reefer', gros_temps: 'storm' };
const PAUSE_KINDS = new Set(['idle', 'sunk', 'bank', 'banker', 'bankrupt', 'detention', 'pollution', 'sanction', 'threat', 'scandal']);

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

// Historique des panneaux ouverts (bouton ← et bouton retour d'Android) ; vidé à la fermeture.
const HISTORY_MAX = 30;
app.open = (type, id = null, tab = null, { back = false } = {}) => {
  const prev = app.ui.panel;
  if (!back && prev && (prev.type !== type || prev.id !== id)) {
    const hist = (app.ui.history ??= []);
    hist.push({ type: prev.type, id: prev.id, tab: prev.shownTab ?? prev.tab ?? null });
    if (hist.length > HISTORY_MAX) hist.shift();
  }
  app.ui.panel = { type, id, tab: tab ?? (prev && prev.type === type && prev.id === id ? prev.tab : null) };
  if (app.mode === 'game') armBrowserBack();
  if (type === 'ship') app.ui.selectedShip = id;
  app.hoverPreview = null;
  if (type !== 'ship') app.setPreview(null); else app.map.preview = app.basePreview || null;
  renderPanel();
};
// Navigateur : le bouton « Précédent » (ou celui de la souris) revient au panneau précédent au
// lieu de quitter la page. Une seule entrée d'historique sert de garde tant qu'un panneau est ouvert.
let backGuard = false, skipPop = false;
function armBrowserBack() {
  if (backGuard || isAndroid()) return;
  try { history.pushState({ pda: 'panel' }, ''); backGuard = true; } catch { /* historique indisponible */ }
}
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; } // garde retirée par la fermeture du panneau
  backGuard = false;
  if (app.mode === 'game' && app.ui.panel && !document.querySelector('.dialog-wrap')) { app.back(); if (app.ui.panel) armBrowserBack(); }
});
// Revenir au panneau précédent (un navire vendu ou perdu entre-temps est sauté).
app.back = () => {
  const hist = app.ui.history || [];
  while (hist.length) {
    const p = hist.pop();
    if (p.type === 'ship' && !shipById(app.state, p.id)) continue;
    app.open(p.type, p.id, p.tab, { back: true });
    return true;
  }
  app.close();
  return false;
};
app.close = () => {
  app.ui.history = [];
  if (backGuard) { backGuard = false; skipPop = true; history.back(); } // retire la garde
  app.ui.panel = null;
  app.hoverPreview = null;
  app.setPreview(null);
  renderPanel();
};
app.openTab = (tab) => { if (app.ui.panel) { app.ui.panel.tab = tab; renderPanel(); } };
app.refresh = () => { app.alertsAt = 0; renderPanel(); updateHud(); };
app.company = () => app.state.companies[app.ui.activeCompany];
app.toast = (text, opts) => toast(text, opts);
// Route affichée sur la carte : celle du départ en préparation, ou celle survolée à la souris
// (contrat, débouché), qui la remplace le temps du survol.
app.setPreview = (route) => { app.basePreview = route; app.map.preview = app.hoverPreview || route; };
app.hoverRoute = (route) => {
  app.hoverPreview = route || null;
  app.map.preview = app.hoverPreview || app.basePreview || null;
  if (route) app.map.fitRoute(route.points); // la route entière, dans la partie visible de la carte
};
panelEl.addEventListener('mouseleave', () => app.hoverRoute(null));
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
  app.map.flashShip(id); // il clignote : on le repère d'un coup d'œil
};

function renderPanel() {
  const p = app.ui.panel;
  if (!p || app.mode !== 'game') { panelEl.hidden = true; panelEl.replaceChildren(); document.body.classList.remove('panel-open'); app.ui.openedType = null; return; }
  // Ouvrir un panneau, c'est lire : les alertes, la flotte, un navire, les paiements.
  const cid = app.ui.activeCompany;
  if (app.ui.openedType !== p.type) {
    app.ui.openedType = p.type;
    app.ui.newAlerts = p.type === 'alerts' ? unreadCounts(app.state, ctx, cid).unreadKeys : null;
  }
  const what = { alerts: 'alerts', fleet: 'fleet', office: 'payments' }[p.type] || (p.type === 'ship' && p.id != null ? `s${p.id}` : null);
  if (what) { markSeen(app.state, ctx, cid, what); app.alertsAt = 0; }
  const fn = p.type === 'ship' ? shipPanel : PANELS[p.type];
  const def = fn(app, p.id, p.tab);
  const tabs = def.tabs || null;
  let tabId = p.tab || def.tab || (tabs ? tabs[0][0] : null);
  if (tabs && !tabs.some((t) => t[0] === tabId)) tabId = tabs[0][0];
  p.shownTab = tabId; // pour revenir sur le même onglet
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
      app.ui.history?.length ? h('button.icon-btn.panel-back', { 'aria-label': 'Retour', title: 'Retour au panneau précédent', onclick: () => app.back() }, '←') : null,
      def.icon || (def.badge ? h('span.badge-wrap', { html: logoBadge(def.badge[0], def.badge[1], 44) }) : null),
      h('div.panel-titles', [h('h2', def.title), def.subtitle ? h('div.panel-sub', def.subtitle) : null]),
      h('div.panel-actions', [...(def.headerActions || []), h('button.icon-btn', { 'aria-label': 'Fermer', title: 'Fermer', onclick: app.close }, '✕')]),
    ]),
    tabs ? h('div.tabs', { role: 'tablist' }, tabs.map(([id, label]) => h('button.tab', {
      'data-tab': id, role: 'tab', class: id === tabId ? 'active' : '', 'aria-selected': id === tabId ? 'true' : 'false',
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
  const key = rows.map((r) => `${r.company.id}:${Math.round(r.worth / 1e4)}:${r.company.bankrupt}`).join('|') + `|${me}:${getLang()}`;
  el.hidden = false;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.replaceChildren(...rows.map((r, i) => h('span.standings-row', { class: [r.company.id === me ? 'me' : '', r.company.bankrupt ? 'out' : ''].join(' ') }, [
    h('span.standings-rank', MEDALS[i] || `${i + 1}.`),
    h('span.standings-logo', { html: logoBadge(r.company.logo, r.company.color, 22) }),
    h('span.standings-name', r.company.name),
    h('span.standings-worth', r.company.bankrupt ? 'faillite' : money(r.worth)),
  ])), levelLine(netWorth(s, me), s.companies[me]));
}
// Niveau de la compagnie (le bureau) et ce qu'il faut pour le suivant. Un niveau atteint est
// acquis ; seul le niveau 0 (la compagnie perd de l'argent) le fait oublier, le temps de remonter.
function levelLine(worth, company) {
  const bar = (k) => h('span.level-bar', [h('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%` } })]);
  if (worth < MUSIC_LOW) return h('span.standings-level', { title: OFFICE_TIERS[0].name }, [h('span', `🏢 Niveau 0/${OFFICE_TIERS.length} · remonter à ${money(MUSIC_LOW)}`), bar(worth / MUSIC_LOW)]);
  const tier = reachedTier(company, worth), next = OFFICE_TIERS[tier + 1];
  return h('span.standings-level', { title: OFFICE_TIERS[tier].name }, [
    h('span', next ? `🏢 Niveau ${tier + 1}/${OFFICE_TIERS.length} · prochain à ${money(next.min)}` : `🏢 Niveau ${tier + 1}/${OFFICE_TIERS.length} · le sommet !`),
    bar(next ? (worth - OFFICE_TIERS[tier].min) / (next.min - OFFICE_TIERS[tier].min) : 1),
  ]);
}
// Nouveau niveau atteint : le bureau se transforme (scène). Un niveau reste acquis.
function checkLevels(s) {
  for (const co of s.companies) {
    if (!co.human || co.bankrupt) continue;
    const t = officeTier(netWorth(s, co.id));
    if (co.level == null) { co.level = t; continue; } // nouvelle partie ou ancienne sauvegarde : sans fanfare
    if (t <= co.level) continue;
    const from = co.level;
    co.level = t;
    levelUp(co, from, t);
  }
}
function levelUp(co, from, to) {
  const T = OFFICE_TIERS[to], n = OFFICE_TIERS.length;
  const several = app.state.companies.filter((c) => c.human).length > 1; // partie à plusieurs : à qui est le bureau
  app.audio.play('cash');
  if (!scenesOn()) { toast(several ? `🏢 ${co.name} atteint le niveau ${to + 1}/${n} : ${T.name}.` : `🏢 Niveau ${to + 1}/${n} atteint : ${T.name}.`, { kind: 'money', timeout: 9000 }); return; }
  const best = shipsOf(app.state, co.id).sort((a, b) => eco.shipValue(app.state, b) - eco.shipValue(app.state, a))[0]; // la maquette du bureau
  const model = best ? { typeId: best.type, color: co.color, logo: co.logo, name: best.name } : null;
  const img = (tier) => {
    const svg = officeSVG(tier, { color: co.color, logo: co.logo, model, uid: `lvl${co.id}-` }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200" ');
    const i = new Image();
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return i;
  };
  playScene('office', { title: several ? `Un nouveau bureau pour ${co.name} !` : 'Un nouveau bureau !', text: `Niveau ${to + 1}/${n} atteint : ${T.name}. ${T.text}`, color: co.color, variant: { from: img(from), to: img(to), level: to + 1 } });
}

function updateHud() {
  if (app.mode !== 'game') return;
  const s = app.state, c = app.company();
  const logoKey = c.logo + c.color;
  const logoEl = $('#hud-company-logo');
  if (logoEl.dataset.key !== logoKey) { logoEl.innerHTML = logoBadge(c.logo, c.color, 42); logoEl.dataset.key = logoKey; }
  $('#hud-company-name').textContent = c.name;
  updateContext();
  const cash = $('#hud-cash');
  cash.textContent = money(c.cash);
  cash.classList.toggle('neg', c.cash < 0);
  $('#hud-date').textContent = formatDate(s.t);
  document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === app.speed));
  // Compteurs rouges (comme des courriels non lus), notifications importantes et standing
  // (musique) : recalculés au plus deux fois par seconde.
  const now = performance.now();
  if (!app.alertsAt || now - app.alertsAt > 500 || app.alertsKey !== c.id) {
    app.alertsAt = now;
    app.alertsKey = c.id;
    const u = unreadCounts(s, ctx, c.id);
    const badge = $('#badge-fleet');
    badge.textContent = u.fleet || '';
    badge.hidden = !u.fleet;
    const ab = $('#badge-alerts');
    ab.textContent = u.alerts || '';
    ab.hidden = !u.alerts;
    ab.classList.toggle('urgent', u.urgent);
    checkLevels(s);
    app.audio.setMusicTier(musicStep(netWorth(s, c.id), c.level ?? 0));
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
    h('span.badge-wrap', { html: logoBadge(company.logo, company.color, 96) }),
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
// ---------- Scènes d'événements et fenêtres qui s'ouvrent seules ----------
// Une petite animation (ou l'encaissement d'un contrat livré) arrête le temps ; les fenêtres
// passent l'une après l'autre. Quand la dernière se ferme, le temps repart à vitesse 1, sauf
// si l'une d'elles demande de rester en pause (décision prise, navire qui attend ses ordres).
app.sceneQueue = [];
function popup(show, after = null) {
  app.sceneQueue.push({ show, after });
  app.speed = 0;
  if (app.sceneQueue.length === 1) nextScene();
}
const playScene = (kind, opts, after = null) => popup(() => showScene(app, kind, opts), after);
async function nextScene() {
  const s = app.sceneQueue[0];
  if (!s) return;
  const game = app.state;
  let holds = false;
  try {
    const v = await s.show();
    if (s.after && app.state === game) holds = await s.after(v);
  } catch (e) { console.error(e); } // une fenêtre ou sa suite en échec ne doit jamais bloquer la file
  if (app.state !== game) { app.sceneQueue.length = 0; app.sceneHold = false; return; } // partie chargée ou quittée entre-temps
  app.sceneHold = app.sceneHold || !!holds;
  app.sceneQueue.shift();
  if (app.sceneQueue.length) { nextScene(); return; }
  const hold = app.sceneHold;
  app.sceneHold = false;
  if (!hold && app.mode === 'game' && !app.state.over) app.speed = 1;
}
const companyColor = (id) => app.state.companies[id ?? app.ui.activeCompany]?.color || '#c0392b';

function handleNotes(notes) {
  let paused = false, switched = false;
  const scenes = scenesOn();
  const prefixOf = (n) => (n.company != null && app.state.companies.filter((c) => c.human).length > 1 ? `${app.state.companies[n.company].name} : ` : '');
  const sceneOpts = (n, extra = {}) => ({ text: prefixOf(n) + n.text, color: companyColor(n.company), ...extra });
  // Un navire qui vient de livrer : le message de paiement suffit.
  const delivered = new Set(notes.filter((n) => n.kind === 'payment').map((n) => n.shipId));
  const crewUps = []; // points de spécialité gagnés : une petite scène par compagnie, sans son
  const iceChanges = []; // gel et dégel du jour : une scène par sorte (port ou passage, gel ou dégel)
  for (const n of notes) {
    if (n.kind === 'crew' && scenes) { crewUps.push(n); continue; }
    if (n.kind === 'ice') { if (scenes) iceChanges.push(n); else toast(`❄ ${n.text}`, { timeout: 9000 }); continue; }
    if (n.kind === 'iceSoon') { toast(`❄ ${n.text}`, { kind: 'warn', timeout: 10000 }); continue; }
    // Affaires noires : la proposition, les saisies, et ce qu'on lit ensuite dans les nouvelles.
    if (n.kind === 'darkoffer') {
      const cid = n.company;
      popup(async () => { if (cid !== app.ui.activeCompany) switchCompany(cid); await darkOfferDialog(app, n); }, () => !!shipById(app.state, n.shipId)?.dark || !!shipById(app.state, n.shipId)?.seized);
      continue;
    }
    if (n.kind === 'seized') {
      const cid = n.company;
      app.speed = 0;
      app.audio.play('sunk');
      toast(prefixOf(n) + n.text, { kind: 'bad', timeout: 20000, action: 'Décider', onAction: () => { if (cid !== app.ui.activeCompany) switchCompany(cid); seizedDialog(app, n.shipId); } });
      const decide = async () => { if (cid !== app.ui.activeCompany) switchCompany(cid); await seizedDialog(app, n.shipId); return true; };
      if (scenes) playScene(n.seized?.by === 'justice' ? 'customs' : 'gang', sceneOpts(n, { title: n.seized?.by === 'justice' ? 'Navire confisqué' : n.seized?.kind === 'crew' ? 'Équipage enlevé' : 'Navire aux mains d\'un gang', buttons: [{ label: 'Décider', value: 'ok', kind: 'primary' }] }), decide);
      else popup(decide);
      continue;
    }
    if (n.kind === 'aftermath') { toast(`📰 ${prefixOf(n)}${n.text} ${n.hint}`, { kind: 'bad', timeout: 16000 }); continue; }
    if (n.kind === 'charity') { app.audio.play('cash'); if (scenes) playScene('charity', sceneOpts(n)); else toast(prefixOf(n) + n.text, { kind: 'money', timeout: 9000 }); continue; }
    if (n.kind === 'icecaught') {
      // Navire pris par les glaces : attendre (désarmé pour l'hiver) ou partir avec un brise-glace.
      const ship = shipById(app.state, n.shipId);
      if (!ship) continue;
      const cid = n.company;
      const choose = async (v) => {
        if (!shipById(app.state, n.shipId)) return false;
        if (cid !== app.ui.activeCompany) switchCompany(cid);
        if (v === 'layup') { app.act(() => act.layUp(app.state, n.shipId)); app.open('ship', n.shipId); return false; }
        if (v === 'go') { app.open('ship', n.shipId, 'depart'); app.focusShip(n.shipId); return true; } // le temps reste arrêté pendant le choix
        return false;
      };
      const buttons = [{ label: 'Désarmer pour l\'hiver', value: 'layup', kind: 'ghost' }, { label: `Brise-glace (${Math.round(escortFee(ship) / 1000)} k$)`, value: 'go', kind: 'primary' }];
      toast(prefixOf(n) + n.text, { kind: 'bad', timeout: 15000, action: 'Voir', onAction: () => { if (cid !== app.ui.activeCompany) switchCompany(cid); app.open('ship', n.shipId); app.focusShip(n.shipId); } });
      if (scenes) playScene('icecaught', sceneOpts(n, { variant: shipKind(ship.type), buttons }), choose);
      else popup(async () => { if (cid !== app.ui.activeCompany) switchCompany(cid); return dialog({ title: 'Pris par les glaces', body: h('p', n.text), buttons }); }, choose);
      continue;
    }
    if (n.kind === 'idle' && delivered.has(n.shipId)) {
      if (app.state.settings.autoPause) paused = true;
      continue;
    }
    if (n.kind === 'over') { app.speed = 0; saveGame(app.state, 'auto'); endScreen(app); app.mode = 'end'; app.audio.setScene('end'); return true; }
    if (n.kind === 'event') {
      toast(`📰 ${n.text}`, { timeout: 9000 });
      if (scenes && EVENT_SCENES[n.id]) playScene(EVENT_SCENES[n.id], { title: n.title, text: n.body, variant: n.variant, color: companyColor() });
      else if (app.state.settings.autoPause) paused = true;
      continue;
    }
    if (n.kind === 'depart') { app.audio.play('depart', shipById(app.state, n.shipId)); continue; }
    if (n.kind === 'hijack') {
      app.speed = 0;
      app.audio.play('sunk');
      toast(n.text, { kind: 'bad', timeout: 20000, action: 'Décider', onAction: () => openRansom(app, n.shipId, n.report) });
      if (scenes) playScene('hijack', sceneOpts(n, { buttons: [{ label: 'Décider', value: 'ok', kind: 'primary' }] }), async () => { await openRansom(app, n.shipId, n.report); return true; });
      else openRansom(app, n.shipId, n.report);
      continue;
    }
    if (n.kind === 'patrol') {
      if (n.report?.outcome === 'seized') { app.speed = 0; app.audio.play('sunk'); }
      toast(n.text, { kind: n.report?.outcome === 'seized' ? 'bad' : 'info', timeout: 12000, action: 'Le contrôle', onAction: () => showPatrol(app, n) });
      if (scenes && n.report?.outcome === 'seized') playScene('patrol', sceneOpts(n, { buttons: [{ label: 'Le contrôle', value: 'more', kind: 'ghost' }] }), async (v) => { if (v === 'more') await showPatrol(app, n); return false; });
      continue;
    }
    if (n.kind === 'pirates') {
      toast(n.text, { kind: n.report?.outcome === 'repelled' ? 'info' : 'warn', timeout: 12000, action: 'Le combat', onAction: () => showBattle(app, n) });
      if (scenes && n.report) playScene(n.report.outcome === 'repelled' ? 'repelled' : 'looted', sceneOpts(n, { buttons: [{ label: 'Le combat', value: 'more', kind: 'ghost' }] }), async (v) => { if (v === 'more') await showBattle(app, n); return false; });
      continue;
    }
    if (n.kind === 'customs') {
      app.speed = 0;
      toast(n.text, { kind: 'bad', timeout: 20000, action: 'Décider', onAction: () => openCase(app, n.caseId) });
      if (scenes) playScene('customs', sceneOpts(n, { buttons: [{ label: 'Décider', value: 'ok', kind: 'primary' }] }), async () => { await openCase(app, n.caseId); return true; });
      else openCase(app, n.caseId);
      continue;
    }
    if (n.kind === 'rivalship') {
      // Un concurrent agrandit sa flotte (navire neuf, ou occasion au plus une fois par mois).
      const rival = app.state.companies[n.rival];
      if (scenes && rival) playScene('rivalship', { title: n.newbuild ? 'Un concurrent lance un navire neuf' : 'Un concurrent agrandit sa flotte', text: n.text, color: rival.color || n.color, variant: shipKind(n.shipType) + (n.newbuild ? '/new' : '') });
      else toast(`📰 ${n.text}`, { timeout: 9000 });
      continue;
    }
    if (n.kind === 'golden') {
      // Affaire en or dans un port où vous avez un navire : on la signale, sans arrêter le jeu.
      app.audio.play('cash');
      toast(prefixOf(n) + n.text, { kind: 'money', timeout: 12000, action: 'Voir', onAction: () => { if (n.company !== app.ui.activeCompany) switchCompany(n.company); app.open('ship', n.shipId, 'contrats'); app.focusShip(n.shipId); } });
      continue;
    }
    if (n.kind === 'held') {
      // Retenue abusive : attendre ou payer l'avocat (la fenêtre s'ouvre d'elle-même).
      toast(prefixOf(n) + n.text, { kind: 'bad', timeout: 15000, action: 'Décider', onAction: () => heldDialog(app, n.shipId) });
      const cid = n.company;
      popup(async () => { if (cid !== app.ui.activeCompany) switchCompany(cid); if (scenes) await showScene(app, 'detention', sceneOpts(n, { title: 'Retenu sans motif sérieux' })); await heldDialog(app, n.shipId); }, () => app.state.settings.autoPause);
      continue;
    }
    if (n.kind === 'paid') {
      app.audio.play('cash');
      toast(n.text, { kind: 'money', timeout: 7000 });
      if (scenes && n.parcel) playScene('paid', sceneOpts(n));
      continue;
    }
    if (n.kind === 'payment') {
      const cid = n.company;
      // Le bouton reste dans le message si l'on choisit « Plus tard ».
      toast(n.text, {
        kind: 'money', timeout: 15000, action: 'Encaisser', tag: `pay-${n.paymentId}`,
        onAction: () => { if (cid !== app.ui.activeCompany) switchCompany(cid); openPayment(app, n.paymentId); },
      });
      // L'encaissement s'ouvre de lui-même, au nom de la compagnie (partie à plusieurs : c'est
      // son tour). Ensuite, avec la pause auto, le temps reste arrêté : le navire attend ses ordres.
      popup(async () => {
        if (cid !== app.ui.activeCompany) switchCompany(cid);
        await openPayment(app, n.paymentId);
      }, () => app.state.settings.autoPause);
      continue;
    }
    if (n.kind === 'arrival' || (n.kind === 'idle' && / est arrivé /.test(n.text))) app.audio.play('arrive');
    if (n.kind === 'sunk') app.audio.play('sunk');
    // Scène illustrée : naufrage, marée noire, détention ou saisie, banquier, et tempête quand
    // elle compte : cyclone tropical, force 11 et plus, ou cargaison avariée (un simple coup de
    // vent sans dégâts ne mérite pas d'arrêter le jeu). L'image suit la force de la tempête.
    const bigStorm = n.storm && (/^(Ouragan|Typhon|Cyclone)/.test(n.storm) || n.force >= 11 || n.lost);
    // Incidents en mer : incendie, abordage, échouement, voie d'eau, avarie de machine, panne
    // des frigos ; la cargaison qui ripe ou des conteneurs perdus par gros temps : la tempête.
    const incShip = n.incident ? shipById(app.state, n.shipId) : null;
    const incScene = INCIDENT_SCENES[n.incident];
    const [scene, extra] = !scenes ? [null] : n.kind === 'sunk' ? ['sunk'] : n.kind === 'pollution' ? ['pollution']
      : incScene === 'storm' ? ['storm', { variant: n.lost, force: Math.max(n.force || 8, 8) }]
      : incScene && incShip ? [incScene, { variant: shipKind(incShip.type) }]
      : n.kind === 'detention' ? [n.seizure ? 'customs' : 'detention']
      : bigStorm ? ['storm', { variant: n.lost === 'boxes' ? 'boxes' : n.lost ? 'cargo' : null, force: n.force }]
      : n.kind === 'banker' ? ['banker'] : n.kind === 'bank' ? ['banker', { variant: 'seize', title: 'La banque saisit un navire' }]
      : n.newbuild && shipById(app.state, n.shipId) ? ['newbuild', { variant: shipKind(shipById(app.state, n.shipId).type) }] : [null];
    if (scene) playScene(scene, sceneOpts(n, extra));
    const company = n.company != null ? app.state.companies[n.company] : null;
    const prefix = company && app.state.companies.filter((c) => c.human).length > 1 ? `${company.name} : ` : '';
    const kind = ['sunk', 'bankrupt', 'bank', 'banker', 'detention', 'pollution', 'sanction', 'scandal'].includes(n.kind) ? 'bad' : ['storm', 'breakdown', 'fuel', 'incident', 'threat'].includes(n.kind) ? 'warn' : 'info';
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
  for (const change of ['freeze', 'thaw']) for (const passage of [false, true]) {
    const list = iceChanges.filter((n) => n.change === change && !!PORTS[n.place] === !passage);
    if (!list.length) continue;
    playScene(change, { title: change === 'freeze' ? 'Les glaces reviennent' : 'Le dégel', text: list.map((n) => n.text).join(' '), variant: passage ? 'sea' : null, color: companyColor() });
  }
  for (const cid of new Set(crewUps.map((n) => n.company))) {
    const list = crewUps.filter((n) => n.company === cid), first = list[0];
    const names = list.map((n) => shipById(app.state, n.shipId)?.name).filter(Boolean);
    const text = list.length === 1 ? first.text : `Les équipages de ${names.join(', ')} ont gagné en expérience : une spécialité à choisir pour chacun (fiche du navire → Équipage).`;
    playScene('crewxp', { ...sceneOpts(first), text: prefixOf(first) + text, buttons: [{ label: 'Choisir la spécialité', value: 'go', kind: 'primary' }] }, async (v) => {
      if (v !== 'go' || !shipById(app.state, first.shipId)) return false;
      if (cid !== app.ui.activeCompany) switchCompany(cid);
      app.open('ship', first.shipId, 'equipage');
      app.focusShip(first.shipId);
      return true; // le temps reste arrêté pendant le choix
    });
  }
  if (app.sceneQueue.length) paused = true; // une scène est ouverte : on n'avance plus
  if (paused) app.speed = 0;
  return paused;
}

// ---------- Sons du temps ----------
// Trois coups de cloche chaque fois que le temps s'arrête (pause automatique, volontaire,
// menu…), tic-tac chaque fois qu'il repart ou change de vitesse (plus rapide à chaque vitesse).
function timeSounds() {
  if (app.mode !== 'game') { app.lastSpeed = null; return; }
  const sp = app.speed, was = app.lastSpeed;
  if (sp === was) return;
  app.lastSpeed = sp;
  if (was == null) return; // début de partie
  app.audio.play(sp === 0 ? 'pause' : 'time', sp);
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
  timeSounds();
  app.map.frame(app.mode === 'game' && app.speed > 0 ? acc : 0);
  updateHud();
  if (app.mode === 'game') guideTick(app);
  requestAnimationFrame(loop);
}

// ---------- Démarrage d'une partie ----------
function enterGame(state) {
  document.querySelectorAll('.scene-wrap').forEach((w) => w.remove()); // scènes de la partie précédente
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
  if (opts.guide) startGuide(state);
  enterGame(state);
  saveGame(state, 'auto');
  const humans = state.companies.filter((c) => c.human);
  // Visite guidée : un mot d'accueil, puis les bulles prennent le relais.
  if (opts.guide) {
    dialog({
      title: 'Bienvenue, armateur !',
      body: h('div', [
        h('p', `Vous disposez de ${money(app.company().cash)} pour fonder votre empire maritime${humans.length > 1 ? ' (chaque compagnie joue à son tour quand ses navires attendent des ordres)' : ''}.`),
        h('p', 'Des bulles vont vous montrer les premiers gestes, au moment où ils servent. Vous pouvez arrêter la visite à tout moment, et la reprendre depuis le menu ☰.'),
      ]),
      buttons: [{ label: 'C\'est parti', value: true, kind: 'primary' }],
    }).then(() => {
      const home = PORTS[app.company().homePort];
      app.map.centerOn(home.lon, home.lat, Math.max(app.map.minScale, 3));
    });
    return;
  }
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
  document.querySelectorAll('.scene-wrap').forEach((w) => w.remove());
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
      { label: scenesOn() ? 'Illustrations : oui' : 'Illustrations : non', value: 'scenes' },
      { label: app.state.settings.noParcelOffers ? 'Colis proposés : non' : 'Colis proposés : oui', value: 'parcels' },
      { label: getLang() === 'fr' ? 'Langue : Français' : 'Langue : English', value: 'lang' },
      { label: 'Comment jouer', value: 'help' },
      { label: guideMenuLabel(app.state), value: 'guide' },
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
  else if (v === 'scenes') { setScenesOn(!scenesOn()); app.speed = wasSpeed; }
  else if (v === 'parcels') { app.state.settings.noParcelOffers = !app.state.settings.noParcelOffers; app.speed = wasSpeed; }
  else if (v === 'help') app.open('help');
  else if (v === 'guide') { toggleGuide(app); app.speed = wasSpeed; }
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
  else if (e.key === 'Backspace' && app.ui.panel && !document.querySelector('.dialog-wrap')) { e.preventDefault(); app.back(); }
});

window.handleBack = () => {
  const d = document.querySelector('.dialog-wrap');
  if (d) { d.remove(); return true; }
  if (app.mode === 'game' && app.ui.panel) { app.back(); return true; } // panneau précédent, ou fermer
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
// Navire d'occasion acheté : la scène de la remise des papiers (le temps repart ensuite).
app.boughtShip = (ship) => {
  if (!scenesOn() || !ship) return;
  playScene('buyship', { text: `Le ${ship.name} est à vous : l'équipage hisse vos couleurs à ${PORTS[ship.port]?.name || ''}.`, color: companyColor(ship.owner), variant: shipKind(ship.type) });
};
window.__app = app; // pratique pour le débogage dans la console
app.handleNotes = handleNotes; // idem : rejouer une notification (scènes, tests)
