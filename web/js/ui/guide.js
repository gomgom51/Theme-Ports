// Premiers pas guidés : des bulles qui montrent les gestes essentiels au moment où ils servent,
// pointées sur le vrai bouton. Une étape se termine quand le joueur fait le geste (ou touche
// « Compris »). Facultatif : proposé à l'écran « Nouvelle partie » (coché d'office tant qu'aucune
// visite n'a été faite sur cet appareil), « Passer la visite » à tout moment, et l'avancement est
// gardé dans la partie (reprise après un chargement). La visite ne touche jamais au temps et ne
// passe jamais devant une fenêtre ou une scène, sauf l'étape de l'encaissement qui l'explique.
import { shipsOf, shipById } from '../sim/core.js';
import { h, toast } from './dom.js';

const KEY = 'pda-guide-done';
// Cochée d'office pour une première partie sur cet appareil.
export function guideDefault() { try { return !localStorage.getItem(KEY); } catch { return true; } }
function remember() { try { localStorage.setItem(KEY, '1'); } catch { /* stockage indisponible */ } }

const DAY = 24;
const $ = (sel) => document.querySelector(sel);
// L'élément, s'il est réellement visible : dans l'écran, et dans la zone visible de ce qui le
// fait défiler (le corps d'un panneau, la rangée d'onglets).
function shown(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return null;
  // Encore en train d'apparaître (boutons de l'encaissement, révélés après les lignes) : on attend.
  if (+getComputedStyle(el.parentElement || el).opacity < 0.6 || +getComputedStyle(el).opacity < 0.6) return null;
  const box = el.parentElement?.closest('.panel-body, .tabs, .dialog');
  if (box) {
    const b = box.getBoundingClientRect();
    if (r.bottom < b.top + 4 || r.top > b.bottom - 4 || r.right < b.left + 4 || r.left > b.right - 4) return null;
  }
  return el;
}
// Une cible dans le panneau : si elle existe mais est hors de vue, on l'amène à l'écran (une fois).
let scrolledTo = '';
function inPanel(sel) {
  const el = $(`#panel ${sel}`);
  if (!el) return null;
  if (!shown(el) && scrolledTo !== sel + (current?.id || '')) {
    scrolledTo = sel + (current?.id || '');
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  return shown(el);
}
const exists = (sel) => !!$(`#panel ${sel}`);
const rail = (p) => shown($(`.rail [data-panel="${p}"]`));
const mine = (app) => shipsOf(app.state, app.ui.activeCompany);
const company = (app) => app.state.companies[app.ui.activeCompany];
const panelIs = (app, type, id) => app.ui.panel?.type === type && (id === undefined || app.ui.panel.id === id);
const shipTab = (app) => $('#panel .tabs .tab.active')?.dataset.tab || null;
const idleShip = (app) => mine(app).find((s) => s.status === 'port' && !s.busyWhat && !s.plan && !s.cargo && !s.pendingDelivery && !s.seized);
const dialogOpen = () => !!$('.dialog-wrap');
// Ce que l'onglet « Contrats » a montré pour ce navire, dans ce port, ce jour-là : un contrat
// possible ou aucun (pour ne pas renvoyer le joueur d'un onglet à l'autre).
let contractsSeen = null;
const seenKey = (app, ship) => `${ship.id}|${ship.port}|${Math.floor(app.state.t / DAY)}`;
const noContract = (app, ship) => contractsSeen?.key === seenKey(app, ship) && !contractsSeen.any;

// Les étapes, par ordre de priorité. after : étapes à finir avant ; when : le bon moment ;
// done : le geste est fait (vérifié aussi en avance si `ahead`) ; show : cible et texte, ou null
// (attendre), ou 'skip' (rien à montrer sur cet écran) ; ok : bouton « Compris ».
const STEPS = [
  {
    id: 'navire', title: 'Votre premier navire', ahead: true,
    when: () => true,
    done: (app) => mine(app).length > 0 || app.state.orders.some((o) => o.owner === app.ui.activeCompany),
    show: (app) => {
      if (panelIs(app, 'broker')) {
        const buy = inPanel('[data-guide="buy"]:not(:disabled)');
        if (buy) return { el: buy, text: 'Les navires d\'occasion sont les plus abordables. Regardez l\'âge et l\'état : un vieux navire coûte moins cher, mais tombe plus souvent en panne. Touchez « Acheter » sur celui qui vous plaît.' };
        const tab = inPanel('.tabs .tab:not(.active)');
        return tab ? { el: tab, text: 'Rien d\'abordable ici : regardez l\'autre onglet.' } : null;
      }
      const b = rail('broker');
      return b && { el: b, text: 'Tout commence chez le courtier : touchez 🏗️ pour acheter votre premier navire.' };
    },
  },
  {
    id: 'contrat', title: 'Un premier contrat', after: ['navire'], ahead: true,
    when: (app) => mine(app).length > 0,
    done: (app) => company(app).delivered > 0 || mine(app).some((s) => s.cargo?.contractId || s.pendingDelivery || s.status === 'sea' || s.plan || s.st?.n > 0),
    show: (app) => {
      const ship = mine(app).find((s) => s.status === 'port');
      if (!ship) return null;
      if (panelIs(app, 'ship', ship.id)) {
        const tab = shipTab(app);
        const ACC = '.card.contract:not(.disabled) [data-guide="accept"]';
        if (tab === 'contrats') {
          contractsSeen = { key: seenKey(app, ship), any: exists(ACC) };
          const acc = contractsSeen.any && inPanel(ACC);
          if (acc) return { el: acc, text: 'Voici les contrats du port : la paie, la destination, la date limite et le bénéfice estimé. Choisissez-en un qui rapporte bien sans « retard probable », puis « Accepter » : le navire chargera et partira tout seul.' };
          if (contractsSeen.any) return null; // le contrat arrive à l'écran
          const dep = inPanel('.tabs [data-tab="depart"]');
          return dep && { el: dep, text: 'Aucun contrat possible pour ce navire ici. Partez à vide vers un port mieux fourni (onglet « Appareiller »), ou lancez le temps : de nouvelles offres arrivent chaque jour.' };
        }
        // Départ à vide : choisir un port qui a des contrats, puis appareiller.
        if (tab === 'depart' && noContract(app, ship)) {
          const sail = inPanel('[data-guide="sail"]');
          if (sail) return { el: sail, text: 'Le trajet, le carburant et les risques sont estimés ici. Appareillez : une fois là-bas, prenez un contrat.' };
          const dest = inPanel('[data-guide="dest"]');
          return dest && { el: dest, text: 'Choisissez une destination proche qui a des contrats pour ce navire (le nombre est indiqué sur chaque port).' };
        }
        const tc = inPanel('.tabs [data-tab="contrats"]');
        return tc && { el: tc, text: 'Ouvrez l\'onglet « Contrats » : ce sont les cargaisons à transporter au départ de ce port.' };
      }
      const f = rail('fleet');
      return f && { el: f, text: 'Ouvrez votre navire : touchez 🚢 Flotte, ou le navire sur la carte.' };
    },
  },
  {
    id: 'encaisser', title: 'Être payé', after: ['contrat'], inDialog: true, ok: true,
    when: () => !!shown($('.dialog [data-guide="collect"]')),
    done: (app) => company(app).delivered > 0 && !app.state.payments.some((p) => p.company === app.ui.activeCompany),
    show: () => {
      const b = shown($('.dialog [data-guide="collect"]'));
      return b && { el: b, text: 'Le client paie à la livraison… en principe : un retard, une avarie ou un client peu fiable changent la somme. Encaissez maintenant, ou plus tard depuis la Flotte.' };
    },
  },
  {
    id: 'temps', title: 'Le temps', after: ['contrat'], ahead: true,
    when: () => true,
    done: (app) => app.speed > 0,
    show: () => {
      const b = shown($('.speed [data-speed="1"]'));
      return b && { el: b, text: 'Lancez le temps avec ▶ (▶▶ et ▶▶▶ vont plus vite). Le jeu se met en pause tout seul quand un navire a besoin de vous, et repart à la vitesse par défaut (double-clic sur une vitesse, contour rouge) dès que le dernier a ses ordres.' };
    },
  },
  {
    id: 'mer', title: 'En mer', after: ['temps'], ok: true,
    when: (app) => mine(app).some((s) => s.status === 'sea'),
    done: () => false,
    show: (app) => {
      const ship = mine(app).find((s) => s.status === 'sea');
      if (!ship) return null;
      if (shipById(app.state, app.ui.selectedShip)?.status !== 'sea') app.ui.selectedShip = ship.id; // ses infos dans la barre du haut
      const ctxEl = shown($('#hud-context .ctx-ship'));
      if (ctxEl) return { el: ctxEl, text: `Le ${ship.name} fait route. En haut : sa destination, sa date d'arrivée et son carburant. Touchez un navire sur la carte pour le suivre.` };
      const f = rail('fleet');
      return f ? { el: f, text: `Le ${ship.name} fait route. La Flotte 🚢 montre où sont vos navires et ce qu'ils font ; touchez un navire sur la carte pour le suivre.` } : 'skip';
    },
  },
  {
    id: 'bulles', title: 'Les explications', after: ['mer'], ok: true,
    when: () => !dialogOpen(),
    done: () => false,
    show: () => {
      const el = shown($('#hud-rep')) || shown($('#hud-menu'));
      return el ? { el, text: 'Presque tout s\'explique : survolez un bouton, un chiffre ou une icône pour voir une info-bulle. Sur téléphone ou tablette, gardez le doigt appuyé dessus.' } : 'skip';
    },
  },
  {
    id: 'ordres', title: 'En attente d\'ordres', after: ['contrat'], ok: true,
    when: (app) => company(app).delivered > 0 && !!idleShip(app),
    done: (app) => !idleShip(app),
    show: (app) => {
      const ship = idleShip(app);
      if (!ship) return null;
      if (panelIs(app, 'ship', ship.id)) {
        const el = shipTab(app) === 'contrats' ? inPanel('.card.contract:not(.disabled) [data-guide="accept"]') || inPanel('.tabs [data-tab="contrats"]') : inPanel('.tabs [data-tab="contrats"]');
        return el && { el, text: `Le ${ship.name} attend vos ordres : le jeu s'est mis en pause. Prenez un nouveau contrat, ou partez à vide vers un port mieux fourni (onglet « Appareiller ») : le temps repartira tout seul.` };
      }
      const f = rail('fleet');
      return f && { el: f, text: `Le ${ship.name} attend vos ordres : le jeu s'est mis en pause. Ouvrez-le (🚢 Flotte, ou sur la carte) pour lui donner un nouveau contrat.` };
    },
  },
  {
    id: 'alertes', title: 'Les alertes', after: ['temps'], ok: true,
    when: () => !!shown($('#badge-alerts:not([hidden])')),
    done: (app) => panelIs(app, 'alerts'),
    show: () => {
      const b = rail('alerts');
      return b && { el: b, text: 'La cloche rassemble ce qui demande votre attention : retards, navires immobilisés, risques à venir. Un chiffre rouge, c\'est du nouveau.' };
    },
  },
  {
    id: 'escale', title: 'Plein et réparations', after: ['ordres'], ok: true,
    when: (app) => mine(app).some((s) => s.status === 'port' && !s.seized),
    done: () => false,
    show: (app) => {
      const sel = shipById(app.state, app.ui.selectedShip);
      if (!sel || sel.owner !== app.ui.activeCompany || sel.status !== 'port') app.ui.selectedShip = mine(app).find((s) => s.status === 'port' && !s.seized).id;
      const el = shown($('#hud-context .ctx-btn'));
      return el ? { el, text: 'Au port, faites le plein ⛽ (le prix change d\'un port à l\'autre) ou réparez 🔧 : un navire usé a plus d\'incidents et risque la détention. Au départ, le carburant manquant est acheté tout seul.' } : 'skip';
    },
  },
  {
    id: 'bureau', title: 'Le bureau', after: ['encaisser'], ok: true,
    when: (app) => app.state.t - (app.state.guide.t0 ?? 0) >= 25 * DAY,
    done: (app) => panelIs(app, 'office'),
    show: () => {
      const b = rail('office');
      return b && { el: b, text: 'Votre bureau : trésorerie, prêts de la banque pour acheter d\'autres navires, et le résultat de chaque navire (Résultats › Par navire).' };
    },
  },
  {
    // Premier bilan du mois : la réputation, la confiance et la vertu, en une bulle.
    id: 'reputation', title: 'Réputation, confiance, vertu', after: ['encaisser'], ok: true,
    when: (app) => !!company(app)?.standingLast,
    done: (app) => panelIs(app, 'office') && shipTab(app) === 'compagnie',
    show: () => {
      const el = shown($('[data-guide="rep"]'));
      return el && { el, text: '★ Votre réputation : la plus basse de deux notes. 🤝 La confiance (peut-on compter sur vous ?) fait tourner vos affaires : contrats, banque, rachat. 💚 La vertu (que dit la presse de vous ?) compte pour la victoire « La plus respectée » et quelques chargeurs. Touchez-la pour le détail.' };
    },
  },
  {
    id: 'negoce', title: 'Le négoce', after: ['bureau'], ok: true,
    when: (app) => app.ui.panel?.type === 'ship' && !!inPanel('.tabs [data-tab="negoce"]'),
    done: (app) => app.ui.panel?.type === 'ship' && shipTab(app) === 'negoce',
    show: () => {
      const t = inPanel('.tabs [data-tab="negoce"]');
      return t && { el: t, text: 'Autre façon de gagner : le négoce. Achetez vous-même une marchandise et revendez-la plus cher ailleurs. Plus risqué que les contrats, parfois bien plus rentable.' };
    },
  },
  {
    id: 'victoires', title: 'Les victoires', after: ['negoce'], ok: true,
    when: () => true,
    done: (app) => panelIs(app, 'victory'),
    show: () => {
      const v = shown($('.vic-rail'));
      return v && { el: v, text: 'Quatre façons de gagner avant la fin : ⚓ racheter ou ruiner tous vos concurrents, ★ la réputation parfaite, 🏆 cinq records, 🗡 la flotte fantôme. La barre sous chaque icône montre où vous en êtes, un point rouge un concurrent qui approche du but. Touchez une icône pour voir la course.' };
    },
  },
  {
    id: 'fin', title: 'Bon vent !', after: ['victoires', 'reputation'], ok: true, last: true,
    when: () => true,
    done: () => false,
    show: () => {
      const m = shown($('#hud-menu'));
      return m && { el: m, text: 'Vous savez l\'essentiel. Le reste se découvre en jouant ; l\'aide complète est dans le menu ☰. Bon vent !' };
    },
  },
];

// ---------- Affichage ----------
let bubble = null, target = null, current = null, lastRun = 0;

function clearTarget() { target?.classList.remove('guide-target'); target = null; }
function hide() { clearTarget(); if (bubble) bubble.hidden = true; current = null; }

function finish(app, skipped) {
  const g = app.state.guide;
  g.on = false;
  remember();
  hide();
  if (skipped) toast('Visite guidée arrêtée. Le menu ☰ permet de la reprendre.', { timeout: 4000 });
}

function render(app, step, view, n) {
  if (!bubble) {
    bubble = h('div.guide', { id: 'guide', role: 'dialog', 'aria-live': 'polite' });
    document.body.append(bubble);
  }
  const key = `${step.id}|${view.text}`;
  if (bubble.dataset.key !== key) {
    bubble.dataset.key = key;
    const g = app.state.guide;
    bubble.replaceChildren(
      h('div.guide-arrow'),
      h('div.guide-step', `Premiers pas · ${n}/${STEPS.length}`),
      h('h3', step.title),
      h('p', view.text),
      h('div.guide-buttons', [
        step.last ? h('span') : h('button.guide-skip', { type: 'button', onclick: () => finish(app, true) }, 'Passer la visite'),
        step.ok ? h('button.btn.small', { type: 'button', onclick: () => { g.done[step.id] = true; if (step.last) finish(app, false); else hide(); run(app, true); } }, step.last ? 'Terminer' : 'Compris') : null,
      ]),
    );
  }
  bubble.hidden = false;
  if (target !== view.el) { clearTarget(); target = view.el; target.classList.add('guide-target'); }
  place(view.el, step.inDialog ? view.el.closest('.dialog') : null);
}

// La bulle à côté de la cible, du côté où elle tient, avec la flèche vers la cible. `box` : un
// cadre à ne pas recouvrir (la fenêtre d'encaissement) : la bulle se met à côté de lui.
function place(el, box = null) {
  const t = el.getBoundingClientRect();
  const b = box?.getBoundingClientRect();
  // Côtés gauche/droite : on longe le cadre ; haut/bas : on longe le cadre aussi.
  const r = b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height } : t;
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const W = innerWidth, H = innerHeight, m = 8, gap = 14;
  const fits = {
    left: r.left - gap - bw >= m, right: r.right + gap + bw <= W - m,
    bottom: r.bottom + gap + bh <= H - m, top: r.top - gap - bh >= m,
  };
  const order = W < 700 ? ['bottom', 'top', 'left', 'right'] : ['left', 'bottom', 'top', 'right'];
  const side = order.find((s) => fits[s]) || (H - r.bottom > r.top ? 'bottom' : 'top');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let x, y;
  if (side === 'left' || side === 'right') {
    x = side === 'left' ? r.left - gap - bw : r.right + gap;
    y = clamp(t.top + t.height / 2 - bh / 2, m, H - bh - m); // à hauteur de la cible
  } else {
    y = side === 'bottom' ? r.bottom + gap : r.top - gap - bh;
    x = clamp(t.left + t.width / 2 - bw / 2, m, W - bw - m);
  }
  bubble.style.left = `${Math.round(x)}px`;
  bubble.style.top = `${Math.round(clamp(y, m, H - bh - m))}px`;
  bubble.dataset.side = side;
  const a = bubble.querySelector('.guide-arrow');
  if (side === 'left' || side === 'right') a.style.cssText = `top:${Math.round(clamp(t.top + t.height / 2 - y - 7, 10, bh - 24))}px;${side === 'left' ? 'right:-7px' : 'left:-7px'}`;
  else a.style.cssText = `left:${Math.round(clamp(t.left + t.width / 2 - x - 7, 12, bw - 26))}px;${side === 'bottom' ? 'top:-7px' : 'bottom:-7px'}`;
}

// À chaque image (au plus toutes les 150 ms) : quelle étape montrer, et où.
export function guideTick(app, force = false) {
  const now = performance.now();
  if (!force && now - lastRun < 150) return;
  lastRun = now;
  run(app, false);
}
function run(app) {
  const g = app.mode === 'game' ? app.state?.guide : null;
  if (!g?.on) { if (bubble && !bubble.hidden) hide(); return; }
  const isDone = (id) => !!g.done[id];
  // Gestes déjà faits (le joueur va plus vite que la visite) : étapes terminées sans bulle.
  for (const s of STEPS) if (!isDone(s.id) && s.ahead && (s.after || []).every(isDone) && s.done(app)) g.done[s.id] = true;
  if (current && !isDone(current.id) && current.done(app)) g.done[current.id] = true;
  const blocked = dialogOpen() || app.sceneQueue?.length || $('.scene-wrap');
  let pick = null, view = null;
  for (const s of STEPS) {
    if (isDone(s.id) || !(s.after || []).every(isDone)) continue;
    if (blocked && !s.inDialog) continue;
    if (!s.when(app)) continue;
    const v = s.show(app);
    if (v === 'skip') { g.done[s.id] = true; continue; }
    if (v?.el) { pick = s; view = v; break; }
  }
  if (!pick) { if (bubble && !bubble.hidden) { clearTarget(); bubble.hidden = true; } current = null; return; }
  current = pick;
  // Numéro d'étape : la dernière est toujours « n/n » (une étape facultative peut être sautée).
  const n = pick.last ? STEPS.length : Math.min(STEPS.filter((s) => isDone(s.id)).length + 1, STEPS.length - 1);
  render(app, pick, view, n);
}

// Nouvelle partie avec visite, ou reprise depuis le menu.
export function startGuide(state) { state.guide = { on: true, done: {}, t0: state.t }; }
export function guideMenuLabel(state) { return state.guide?.on ? 'Visite guidée : oui' : 'Visite guidée : non'; }
export function toggleGuide(app) {
  const g = app.state.guide;
  if (g?.on) { finish(app, false); toast('Visite guidée arrêtée.', { timeout: 2500 }); return; }
  if (!g || STEPS.every((s) => g.done?.[s.id])) startGuide(app.state); else g.on = true;
  toast('Visite guidée reprise.', { timeout: 2500 });
}
