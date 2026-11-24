// Notifications importantes : tout ce qui demande votre attention, rassemblé en un
// seul endroit (navires non assurés, retenus, à court de fuel, découvert, etc.),
// pour ne pas avoir à ouvrir chaque navire et chaque port.
import { SHIP_TYPES } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { shipsOf, fleetValue, creditLimit, contractById, isIdle } from '../sim/core.js';
import { isStrict, inspectionThreshold, SEAWORTHY } from '../sim/incidents.js';
import * as eco from '../sim/economy.js';
import * as act from '../sim/actions.js';
import { h, money, pct, date } from './dom.js';
import { FLAGS } from '../data/ports.js';
import { isPolluting } from '../sim/pollution.js';
import { sanctionRisk, detectionChance } from '../sim/shady.js';
import { etaOf } from './panel-ship.js';
import { openCase } from './shady.js';
import { openRansom } from './piracy.js';
import { plotAlerts, heldDialog, jettisonDialog } from './plots.js';
import { pointsFree as crewPoints } from '../sim/crew.js';

const LEVELS = { urgent: 0, watch: 1, info: 2 };
export const LEVEL_TITLES = ['Urgent', 'À surveiller', 'Pour info'];

// Limite de découvert au-delà de laquelle la banque saisit un navire (même règle que la simulation).
export const seizureLimit = (state, company) => 300000 + 0.1 * fleetValue(state, company.id);

const alertKey = (level, icon, text, t) => `${level}|${icon}|${t ? (t.ship ?? t.ransom ?? t.customs ?? t.held ?? t.jettison ?? t.panel ?? '') : ''}|${text.replace(/[\d\s.,%$−+-]+/g, '')}`;

// ---------- Lu / non lu, comme des courriels ----------
// Les compteurs rouges ne comptent que ce que vous n'avez pas encore vu. Une alerte vue
// reste dans la liste tant que la situation dure ; si elle disparaît puis revient, elle
// compte de nouveau. Gardé par compagnie dans la partie (sauvegardé avec elle).
export function seenOf(state, cid) {
  state.seen ??= {};
  return (state.seen[cid] ??= { alerts: [], fleet: [] });
}
// Ce que compte le bouton Flotte : navires qui attendent vos ordres, paiements à encaisser.
export function fleetItems(state, cid) {
  return [...shipsOf(state, cid).filter(isIdle).map((s) => `s${s.id}`), ...state.payments.filter((p) => p.company === cid).map((p) => `p${p.id}`)];
}
export function unreadCounts(state, ctx, cid) {
  const seen = seenOf(state, cid);
  const alerts = computeAlerts(state, ctx, cid);
  const keys = new Set(alerts.map((a) => a.key));
  seen.alerts = seen.alerts.filter((k) => keys.has(k));
  const unread = alerts.filter((a) => a.level <= 1 && !seen.alerts.includes(a.key));
  const items = fleetItems(state, cid);
  seen.fleet = seen.fleet.filter((k) => items.includes(k));
  return { alerts: unread.length, urgent: unread.some((a) => a.level === 0), fleet: items.filter((k) => !seen.fleet.includes(k)).length, unreadKeys: new Set(unread.map((a) => a.key)) };
}
// what : 'alerts' (tout le panneau), 'fleet' (navires et paiements), 'payments', ou 's<id>' (un navire).
export function markSeen(state, ctx, cid, what) {
  const seen = seenOf(state, cid);
  if (what === 'alerts') seen.alerts = computeAlerts(state, ctx, cid).map((a) => a.key);
  else if (what === 'fleet') seen.fleet = fleetItems(state, cid);
  else if (what === 'payments') seen.fleet = [...new Set([...seen.fleet, ...fleetItems(state, cid).filter((k) => k[0] === 'p')])];
  else if (!seen.fleet.includes(what)) seen.fleet.push(what);
}

export function computeAlerts(state, ctx, companyId) {
  const company = state.companies[companyId];
  const out = [];
  const add = (level, icon, text, target = null) => out.push({ level: LEVELS[level], icon, text, target, key: alertKey(LEVELS[level], icon, text, target) });
  if (!company || company.bankrupt) return out;

  // Trésorerie.
  const limit = seizureLimit(state, company);
  if (company.cash < 0) {
    add(company.cash < -limit * 0.6 ? 'urgent' : 'watch', '🏦',
      `Découvert de ${money(-company.cash)} : au-delà de ${money(limit)}, la banque saisit et vend votre navire le moins cher. Empruntez au Bureau ou vendez un navire.`,
      { panel: 'office' });
  }
  const credit = creditLimit(state, company);
  if (company.debt > 0 && company.debt > credit * 0.85) {
    add('watch', '💳', `Emprunts à ${pct((company.debt / Math.max(1, credit)) * 100)} de votre plafond de crédit : la banque ne prêtera bientôt plus.`, { panel: 'office' });
  }

  for (const s of shipsOf(state, companyId)) {
    if (s.hijacked) add('urgent', '☠', `Le ${s.name} est aux mains de pirates (${s.hijacked.zone}) : ils réclament ${money(s.hijacked.ransom)}.`, { ransom: s.id });
  }
  for (const c of state.cases || []) {
    if (c.company !== companyId) continue;
    const s = state.ships.find((x) => x.id === c.shipId);
    add('urgent', '🤫', `La douane de ${PORTS[c.port].name} retient le ${s?.name || 'navire'} : payer l'amende ou tenter un arrangement ?`, { customs: c.id });
  }
  for (const [flag, until] of Object.entries(company.bans || {})) {
    if (until > state.t) add('watch', '⛔', `${FLAGS[flag].name} interdit ses ports à votre compagnie jusqu'au ${date(until, true)} (pollution).`);
  }
  const ships = shipsOf(state, companyId);
  for (const ship of ships) {
    const T = SHIP_TYPES[ship.type];
    const go = { ship: ship.id };
    if (ship.busyWhat === 'détention') {
      add('urgent', '🚨', `Le ${ship.name} est retenu à ${PORTS[ship.port].name} par les inspecteurs : remise en état jusqu'au ${date(ship.busyUntil, true)}, ou vente en l'état.`, go);
    }
    if (ship.status !== 'laidup' && ship.condition < SEAWORTHY && company.insurance !== 'aucune') {
      const pol = ship.cargo && isPolluting(ship.cargo.good) ? ' Avec sa cargaison polluante, une marée noire vous coûterait aussi le nettoyage et une interdiction d\'escale.' : '';
      add('urgent', '✖', `Le ${ship.name} n'est plus assuré (état ${pct(ship.condition)}) : un naufrage ou une réclamation serait entièrement à vos frais.${pol}`, go);
    } else if (ship.status !== 'laidup' && ship.condition < 50) {
      add('watch', '🔧', `Le ${ship.name} s'use (état ${pct(ship.condition)}) : il ralentit, et l'assurance cesse sous ${SEAWORTHY} %.`, go);
    }
    if (ship.status === 'sea' && ship.voyage) {
      const v = ship.voyage;
      const need = act.fuelToFinish(state, ctx, ship, v.speed);
      if (need > ship.fuel) add('urgent', '⛽', `Le ${ship.name} n'a pas assez de fuel pour atteindre ${PORTS[v.to].name} : il faudra un soutage d'urgence en mer, très cher. Ralentissez-le.`, go);
      const age = eco.ageYears(state, ship);
      if (isStrict(v.to) && ship.condition < inspectionThreshold(age)) {
        add('watch', '⚠', `Le ${ship.name} arrive usé (${pct(ship.condition)}) à ${PORTS[v.to].name}, port exigeant : risque de détention.`, go);
      }
      const sr = sanctionRisk(state, ship, v.to);
      if (sr) add('watch', '⚖', `Le ${ship.name}, passé par un pays sous embargo, fait route vers ${PORTS[v.to].name} qui applique les sanctions : risque d'amende de ${money(sr.fine)}.`, go);
      if (ship.contraband) {
        const p = detectionChance(ship, v.to);
        if (p >= 0.15) add('watch', '📦', `Le ${ship.name} transporte un colis caché vers ${PORTS[v.to].name}, où la douane est sévère.`, go);
      }
      const c = ship.cargo?.contractId ? contractById(state, ship.cargo.contractId) : null;
      if (c && etaOf(state, ctx, ship) > c.deadline) {
        const perish = GOODS[c.good].perishable;
        add(perish ? 'urgent' : 'watch', '⏰', `Le ${ship.name} arrivera en retard à ${PORTS[c.to].name} (délai le ${date(c.deadline, true)}) : 3 % de pénalité par jour${perish ? ', et la marchandise se gâte' : ''}. Accélérez si possible.`, go);
      }
    }
    if (crewPoints(ship) > 0) add('info', '🎖', `L'équipage du ${ship.name} peut choisir une spécialité.`, go);
    if (ship.status === 'laidup' && eco.freightLevel(state, ship.type) >= 1) {
      add('info', '📈', `Le fret est remonté pour les ${T.category.toLowerCase()}s : réarmer le ${ship.name} ?`, go);
    }
  }
  plotAlerts(state, companyId, (level, icon, text, target) => add(level, icon, text, target?.plot != null ? null : target));
  const idle = ships.filter(isIdle);
  if (idle.length) add('info', '⚓', idle.length === 1 ? `Le ${idle[0].name} attend vos ordres.` : `${idle.length} navires attendent vos ordres.`, idle.length === 1 ? { ship: idle[0].id } : { panel: 'fleet' });
  const pay = state.payments.filter((p) => p.company === companyId).length;
  if (pay) add('info', '💰', `${pay} paiement${pay > 1 ? 's' : ''} à encaisser.`, { panel: 'office' });
  return out.sort((a, b) => a.level - b.level);
}

export function alertsPanel(app) {
  const alerts = computeAlerts(app.state, app.ctx, app.ui.activeCompany);
  const body = h('div');
  if (!alerts.length) body.append(h('p.muted', 'Rien à signaler : votre flotte navigue sans souci.'));
  for (let lv = 0; lv < 3; lv++) {
    const list = alerts.filter((a) => a.level === lv);
    if (!list.length) continue;
    body.append(h('h3', { class: lv === 0 ? 'neg' : '' }, LEVEL_TITLES[lv]));
    body.append(h('div.list', list.map((a) => h(`div.card.alert.alert-${lv}`, { class: app.ui.newAlerts?.has(a.key) ? 'unread' : '' }, [
      h('div.card-main', [h('div.card-sub', [app.ui.newAlerts?.has(a.key) ? h('span.unread-dot', { title: 'Nouveau' }) : null, h('span.alert-icon', a.icon), ' ', a.text])]),
      a.target ? h('div.card-side', [h('button.btn.small', {
        onclick: () => { if (a.target.ransom != null) openRansom(app, a.target.ransom); else if (a.target.customs != null) openCase(app, a.target.customs); else if (a.target.held != null) heldDialog(app, a.target.held); else if (a.target.jettison != null) jettisonDialog(app, a.target.jettison); else if (a.target.ship != null) { app.open('ship', a.target.ship); app.focusShip(a.target.ship); } else app.open(a.target.panel); },
      }, 'Voir')]) : null,
    ]))));
  }
  return { title: 'Notifications importantes', subtitle: alerts.length ? `${alerts.filter((a) => a.level === 0).length} urgente(s) · ${alerts.length} au total` : 'Tout va bien', body };
}
