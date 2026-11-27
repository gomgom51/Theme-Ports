// Notifications importantes : tout ce qui demande votre attention, rassemblé en un
// seul endroit (navires non assurés, retenus, à court de fuel, découvert, etc.),
// pour ne pas avoir à ouvrir chaque navire et chaque port.
import { SHADOW_LENDER } from '../sim/core.js';
import { SHIP_TYPES } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { GOODS, OIL_GOODS } from '../data/goods.js';
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
import { counterDialog, bidDialog } from './rivals.js';
import { pendingBid, canTakeover, takeoverPrice } from '../sim/takeover.js';
import { BLACKLIST } from '../sim/shadow.js';
import { pointsFree as crewPoints } from '../sim/crew.js';
import { isSeasonal, iceOpen, iceRisk, iceForecast, forecastText, escortFee, ICE } from '../sim/ice.js';
import { DARK, DARK_KINDS, darkDetect } from '../sim/dark.js';
import { seizedDialog } from './dark.js';

const LEVELS = { urgent: 0, watch: 1, info: 2 };
export const LEVEL_TITLES = ['Urgent', 'À surveiller', 'Pour info'];

// Limite de découvert au-delà de laquelle la banque saisit un navire (même règle que la simulation).
export const seizureLimit = (state, company) => 300000 + 0.1 * fleetValue(state, company.id);

const alertKey = (level, icon, text, t) => `${level}|${icon}|${t ? (t.ship ?? t.ransom ?? t.customs ?? t.held ?? t.jettison ?? t.seized ?? t.panel ?? '') : ''}|${text.replace(/[\d\s.,%$−+-]+/g, '')}`;

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
  const add = (level, icon, text, target = null, short = null) => out.push({ level: LEVELS[level], icon, text, target, short, key: alertKey(LEVELS[level], icon, text, target) });
  if (!company || company.bankrupt) return out;

  // Crise mondiale du raffinage : les pétroliers n'ont plus de contrats hors des pays sous embargo.
  if (eco.oilCrisis(state) && shipsOf(state, companyId).some((s) => OIL_GOODS.some((g) => eco.holdFor(s.type, g)))) {
    add('watch', '🛢', `Crise mondiale du raffinage : plus aucun contrat ni appel d'offres de pétrole hors des pays sous embargo jusqu'au ${date(state.oilCrisis.until, true)}. Les contrats signés sont honorés ; désarmer un pétrolier coûte moins cher que l'attente.`, { panel: 'fleet' }, ['Crise du raffinage', `aucun contrat pétrolier jusqu'au ${date(state.oilCrisis.until, true)}`]);
  }

  // Trésorerie.
  const limit = seizureLimit(state, company);
  if (company.cash < 0) {
    add(company.cash < -limit * 0.6 ? 'urgent' : 'watch', '🏦',
      `Découvert de ${money(-company.cash)} : au-delà de ${money(limit)}, la banque saisit et vend votre navire le moins cher. Empruntez au Bureau ou vendez un navire.`,
      { panel: 'office' }, [`Découvert ${money(-company.cash)}`, `saisie d'un navire à ${money(limit)}`]);
  }
  const credit = creditLimit(state, company);
  if (company.debt > 0 && company.debt > credit * 0.85) {
    add('watch', '💳', `Emprunts à ${pct((company.debt / Math.max(1, credit)) * 100)} de votre plafond de crédit : la banque ne prêtera bientôt plus.`, { panel: 'office' }, ['Crédit', `${pct((company.debt / Math.max(1, credit)) * 100)} du plafond utilisé`]);
  // Prêteur de l'ombre : quota de colis avant l'échéance (règle n° 1).
  const L = company.lender;
  if (L && L.done < SHADOW_LENDER.quota && L.due - state.t < 45 * 24) {
    add(L.due - state.t < 15 * 24 ? 'urgent' : 'watch', '💀', `Prêteur de l'ombre : encore ${SHADOW_LENDER.quota - L.done} colis discret(s) à livrer avant le ${date(L.due, true)}, sinon votre taux remonte à celui de la banque (${Math.round(FLAGS[company.flag].rate * 100)} %).`, { panel: 'office' }, ['Prêteur de l\'ombre', `${SHADOW_LENDER.quota - L.done} colis avant le ${date(L.due, true)}`]);
  }
  }

  for (const s of shipsOf(state, companyId)) {
    if (s.hijacked) add('urgent', '☠', `Le ${s.name} est aux mains de pirates (${s.hijacked.zone}) : ils réclament ${money(s.hijacked.ransom)}.`, { ransom: s.id }, [s.name, `pirates · rançon ${money(s.hijacked.ransom)}`]);
  }
  for (const c of state.cases || []) {
    if (c.company !== companyId) continue;
    const s = state.ships.find((x) => x.id === c.shipId);
    add('urgent', '🤫', `La douane de ${PORTS[c.port].name} retient le ${s?.name || 'navire'} : payer l'amende ou tenter un arrangement ?`, { customs: c.id }, [s?.name || 'Navire', `retenu par la douane de ${PORTS[c.port].name}`]);
  }
  for (const s of shipsOf(state, companyId)) {
    if (!s.seized) continue;
    add('urgent', s.seized.by === 'justice' ? '⚖' : '🔫', s.seized.by === 'justice' ? `Le ${s.name} est confisqué à ${PORTS[s.seized.port].name} : caution de ${money(s.seized.ransom)}, ou il est perdu.`
      : s.seized.kind === 'crew' ? `L'équipage du ${s.name} est retenu par un gang à ${PORTS[s.seized.port].name} : rançon de ${money(s.seized.ransom)}.` : `Le ${s.name} est aux mains d'un gang à ${PORTS[s.seized.port].name} : rançon de ${money(s.seized.ransom)}.`, { seized: s.id }, [s.name, s.seized.by === 'justice' ? `confisqué à ${PORTS[s.seized.port].name} · caution ${money(s.seized.ransom)}` : s.seized.kind === 'crew' ? `équipage pris à ${PORTS[s.seized.port].name} · rançon ${money(s.seized.ransom)}` : `pris par un gang à ${PORTS[s.seized.port].name} · rançon ${money(s.seized.ransom)}`]);
  }
  for (const [port, until] of Object.entries(company.grudge || {})) {
    if (until > state.t) add('watch', '⚠', `Un gang de ${PORTS[port].name} en veut à votre compagnie jusqu'au ${date(until, true)} : ${Math.round(DARK.grudgeSeize * 100)} % de risque de saisie à chaque escale.`, null, [`Gang de ${PORTS[port].name}`, `${Math.round(DARK.grudgeSeize * 100)} % de saisie par escale · jusqu'au ${date(until, true)}`]);
  }
  for (const [flag, until] of Object.entries(company.bans || {})) {
    if (until > state.t) add('watch', '⛔', `${FLAGS[flag].name} interdit ses ports à votre compagnie jusqu'au ${date(until, true)} (pollution).`, null, [FLAGS[flag].name, `ports fermés jusqu'au ${date(until, true)}`]);
  }
  const ships = shipsOf(state, companyId);
  for (const ship of ships) {
    const T = SHIP_TYPES[ship.type];
    const go = { ship: ship.id };
    if (ship.busyWhat === 'détention') {
      add('urgent', '🚨', `Le ${ship.name} est retenu à ${PORTS[ship.port].name} par les inspecteurs : remise en état jusqu'au ${date(ship.busyUntil, true)}, ou vente en l'état.`, go, [ship.name, `retenu à ${PORTS[ship.port].name} jusqu'au ${date(ship.busyUntil, true)}`]);
    }
    if (ship.status !== 'laidup' && ship.condition < SEAWORTHY && company.insurance !== 'aucune') {
      const pol = ship.cargo && isPolluting(ship.cargo.good) ? ' Avec sa cargaison polluante, une marée noire vous coûterait aussi le nettoyage et une interdiction d\'escale.' : '';
      add('urgent', '✖', `Le ${ship.name} n'est plus assuré (état ${pct(ship.condition)}) : un naufrage ou une réclamation serait entièrement à vos frais.${pol}`, go, [ship.name, `plus assuré · état ${pct(ship.condition)}`]);
    } else if (ship.status !== 'laidup' && ship.condition < 50) {
      add('watch', '🔧', `Le ${ship.name} s'use (état ${pct(ship.condition)}) : il ralentit, et l'assurance cesse sous ${SEAWORTHY} %.`, go, [ship.name, `usé · état ${pct(ship.condition)}`]);
    }
    if (ship.status === 'sea' && ship.voyage) {
      const v = ship.voyage;
      const need = act.fuelToFinish(state, ctx, ship, v.speed);
      if (need > ship.fuel) add('urgent', '⛽', `Le ${ship.name} n'a pas assez de fuel pour atteindre ${PORTS[v.to].name} : il faudra un soutage d'urgence en mer, très cher. Ralentissez-le.`, go, [ship.name, `fuel insuffisant pour ${PORTS[v.to].name}`]);
      const age = eco.ageYears(state, ship);
      if (isStrict(v.to) && ship.condition < inspectionThreshold(age)) {
        add('watch', '⚠', `Le ${ship.name} arrive usé (${pct(ship.condition)}) à ${PORTS[v.to].name}, port exigeant : risque de détention.`, go, [ship.name, `usé vers ${PORTS[v.to].name} · risque de détention`]);
      }
      const sr = sanctionRisk(state, ship, v.to);
      if (sr) add('watch', '⚖', `Le ${ship.name}, passé par un pays sous embargo, fait route vers ${PORTS[v.to].name} qui applique les sanctions : risque d'amende de ${money(sr.fine)}.`, go, [ship.name, `amende possible à ${PORTS[v.to].name} : ${money(sr.fine)}`]);
      if (ship.contraband) {
        const p = detectionChance(ship, v.to, company.homePort);
        if (p >= 0.15) add('watch', '📦', `Le ${ship.name} transporte un colis caché vers ${PORTS[v.to].name}, où la douane est sévère.`, go, [ship.name, `colis caché · fouille ${Math.round(p * 100)} % à ${PORTS[v.to].name}`]);
      }
      const c = ship.cargo?.contractId ? contractById(state, ship.cargo.contractId) : null;
      if (c && etaOf(state, ctx, ship) > c.deadline) {
        const perish = GOODS[c.good].perishable;
        add(perish ? 'urgent' : 'watch', '⏰', `Le ${ship.name} arrivera en retard à ${PORTS[c.to].name} (délai le ${date(c.deadline, true)}) : 3 % de pénalité par jour${perish ? ', et la marchandise se gâte' : ''}. Accélérez si possible.`, go, [ship.name, perish ? `en retard à ${PORTS[c.to].name} · −3 %/jour · périssable` : `en retard à ${PORTS[c.to].name} · −3 %/jour`]);
      }
    }
    // Glaces : navire pris, gel annoncé dans son port, arrivée qui risque de tomber après le gel.
    if (ship.iced && ship.status !== 'sea') {
      add('watch', '🧊', `Le ${ship.name} est pris par les glaces à ${PORTS[ship.port].name} (${forecastText(state, ship.port, ship)}) : un brise-glace pour partir coûte ${money(escortFee(ship))}, ou désarmez-le pour l'hiver.`, go, [ship.name, `pris par les glaces · brise-glace ${money(escortFee(ship))}`]);
    } else if (ship.status !== 'sea' && isSeasonal(ship.port)) {
      const f = iceForecast(state, ship.port, ship);
      if (f.open && f.from - state.t < 21 * 24) add(f.known || f.from - state.t < ICE.announce * 24 ? 'urgent' : 'watch', '❄', `Le ${ship.name} est à ${PORTS[ship.port].name} : ${forecastText(state, ship.port, ship)}. Partez avant, ou il faudra un brise-glace (${money(escortFee(ship))}).`, go, [ship.name, `glaces à ${PORTS[ship.port].name} dès le ${date(f.known ? f.at : f.from, true)}`]);
    }
    if (ship.status === 'sea' && ship.voyage && isSeasonal(ship.voyage.to)) {
      const to = ship.voyage.to, risk = iceRisk(state, to, etaOf(state, ctx, ship), ship);
      if (risk > 0) add(risk >= 1 ? 'urgent' : 'watch', '❄', `Le ${ship.name} risque de trouver ${PORTS[to].name} pris par les glaces à son arrivée (${risk >= 1 ? 'certain' : pct(risk * 100)}, ${forecastText(state, to, ship)}) : un brise-glace coûterait ${money(escortFee(ship))}. Accélérez si possible.`, go, [ship.name, `glaces à l'arrivée à ${PORTS[to].name} (${risk >= 1 ? 'certain' : pct(risk * 100)})`]);
    }
    if (ship.dark && ship.status === 'sea' && ship.voyage) {
      const p = darkDetect(ship, ship.voyage.to, company.homePort);
      add(p >= 0.2 ? 'urgent' : 'watch', DARK_KINDS[ship.dark.kind].icon, `Cargaison noire à bord du ${ship.name} : la douane de ${PORTS[ship.voyage.to].name} la trouve dans ${Math.round(p * 100)} % des cas (confiscation, scandale).`, go, [ship.name, `cargaison noire · fouille ${Math.round(p * 100)} % à ${PORTS[ship.voyage.to].name}`]);
    }
    if (crewPoints(ship) > 0) add('info', '🎖', `L'équipage du ${ship.name} peut choisir une spécialité.`, go, [ship.name, 'spécialité d\'équipage à choisir']);
    if (ship.status === 'laidup' && eco.freightLevel(state, ship.type) >= 1) {
      const cat = T.category.toLowerCase();
      add('info', '📈', `Le fret est remonté pour les ${cat.endsWith('s') ? cat : cat + 's'} : réarmer le ${ship.name} ?`, go, [ship.name, 'fret remonté · réarmer ?']);
    }
  }
  plotAlerts(state, companyId, (level, icon, text, target, short) => add(level, icon, text, target?.plot != null ? null : target, short));
  // Liste noire : ce qu'elle ferme ; ou l'infamie qui s'en approche.
  if (company.blacklisted) add('info', '⛔', `Liste noire internationale depuis le ${date(company.blacklisted.t, true)} : ports d'Europe, d'Amérique du Nord, du Japon, de Corée et d'Océanie fermés à vos navires ; seule la banque de l'ombre vous prête (deux fois moins, 15 points plus cher).`, null, ['Liste noire', `depuis le ${date(company.blacklisted.t, true)}`]);
  else if ((company.infamy || 0) >= BLACKLIST.warn) add('watch', '⛔', `Infamie ${Math.round(company.infamy)} : à ${BLACKLIST.infamy}, liste noire internationale pour toujours (ports des pays qui appliquent les sanctions et banques régulières fermés).`, null, [`Infamie ${Math.round(company.infamy)}`, `liste noire à ${BLACKLIST.infamy}`]);
  // Rachat : une offre sur la table, ou des concurrents qui en ont les moyens.
  const bid = pendingBid(state, companyId);
  if (bid) add('urgent', '🤝', `${state.companies[bid.by].name} veut racheter votre compagnie (${money(bid.price)}) : la vente se fera le ${date(bid.until, true)} si l'offre tient toujours.`, { bid: bid.id }, [state.companies[bid.by].name, `offre de rachat ${money(bid.price)} · le ${date(bid.until, true)}`]);
  else {
    const buyers = state.companies.filter((o) => o.id !== companyId && !o.bankrupt && canTakeover(state, o.id, companyId).ok);
    if (buyers.length) add('watch', '🤝', buyers.length > 1
      ? `${buyers.map((o) => o.name).join(', ')} pourraient racheter votre compagnie (${money(Math.min(...buyers.map((o) => takeoverPrice(state, company, o))))}). Une meilleure confiance multiplie votre prix ; un niveau supérieur au leur vous protège.`
      : `${buyers[0].name} pourrait racheter votre compagnie (${money(takeoverPrice(state, company, buyers[0]))}). Une meilleure confiance multiplie votre prix ; un niveau supérieur au sien vous protège.`, { panel: 'victory', id: 'domination', tab: 'concurrents' }, [buyers.length > 1 ? `${buyers.length} rivaux` : buyers[0].name, buyers.length > 1 ? `peuvent vous racheter (${money(Math.min(...buyers.map((o) => takeoverPrice(state, company, o))))})` : `peut vous racheter (${money(takeoverPrice(state, company, buyers[0]))})`]);
  }
  const idle = ships.filter(isIdle);
  if (idle.length) add('info', '⚓', idle.length === 1 ? `Le ${idle[0].name} attend vos ordres.` : `${idle.length} navires attendent vos ordres.`, idle.length === 1 ? { ship: idle[0].id } : { panel: 'fleet' }, [idle.length === 1 ? idle[0].name : `${idle.length} navires`, idle.length === 1 ? 'attend vos ordres' : 'attendent vos ordres']);
  const pay = state.payments.filter((p) => p.company === companyId).length;
  if (pay) add('info', '💰', `${pay} paiement${pay > 1 ? 's' : ''} à encaisser.`, { panel: 'office' }, [pay > 1 ? `${pay} paiements` : '1 paiement', 'à encaisser']);
  return out.sort((a, b) => a.level - b.level);
}

export function alertsPanel(app) {
  const alerts = computeAlerts(app.state, app.ctx, app.ui.activeCompany);
  const body = h('div');
  if (!alerts.length) body.append(h('p.muted', 'Rien à signaler : votre flotte navigue sans souci.'));
  // Une ligne par alerte : icône, qui, quoi (le chiffre clé). La phrase complète au survol.
  // Les dates proches perdent leur année (« jusqu'au 9 févr. ») ; une date plus ancienne la garde.
  const yr = +(date(app.state.t).match(/\d{4}/) || [0])[0];
  const near = (txt) => txt.replace(new RegExp(` (${yr}|${yr + 1})\\b`, 'g'), '');
  const go = (a) => { if (a.target.ransom != null) openRansom(app, a.target.ransom); else if (a.target.customs != null) openCase(app, a.target.customs); else if (a.target.held != null) heldDialog(app, a.target.held); else if (a.target.counter != null) counterDialog(app, a.target.counter); else if (a.target.bid != null) bidDialog(app, a.target.bid); else if (a.target.jettison != null) jettisonDialog(app, a.target.jettison); else if (a.target.seized != null) seizedDialog(app, a.target.seized); else if (a.target.ship != null) { app.open('ship', a.target.ship); app.focusShip(a.target.ship); } else app.open(a.target.panel, a.target.id ?? null, a.target.tab ?? null); };
  body.append(h('div.alert-list', alerts.map((a) => h(a.target ? 'button.alert-row' : 'div.alert-row', {
    type: a.target ? 'button' : null, class: `lv${a.level}${app.ui.newAlerts?.has(a.key) ? ' unread' : ''}`, title: a.text, onclick: a.target ? () => go(a) : null,
  }, [
    h('span.ar-icon', a.icon),
    h('span.ar-who', { class: a.target?.ship != null ? 'nm' : '' }, a.short ? a.short[0] : ''),
    h('span.ar-what', a.short ? near(a.short[1]) : a.text),
    h('span.ar-go', a.target ? '›' : ''),
  ]))));
  return { title: 'Notifications importantes', subtitle: alerts.length ? `${alerts.filter((a) => a.level === 0).length} urgente(s) · ${alerts.length} au total` : 'Tout va bien', body };
}
