// Interface de la piraterie : risque affiché avant le départ, rapport de combat
// (votre défense, les assaillants, les trois phases), décision sur la rançon.
import { piracyRisk, resolveHijack } from '../sim/piracy.js';
import { patrolRisk } from '../sim/patrols.js';
import { defence } from '../sim/equipment.js';
import { EQUIPMENT } from '../data/equipment.js';
import { h, money, dialog, toast } from './dom.js';

const pctTxt = (p) => `${Math.round(p * 100)} %`;

// Ligne de risque pour un voyage (zones traversées, risque d'attaque, chance de repousser).
export function piracyLine(ship, route, speed, state = null) {
  const r = piracyRisk(ship, route, speed, state);
  if (!r) return null;
  // Une zone par morceau de texte : la traduction anglaise les reconnaît une à une.
  const names = r.zones.flatMap((x, i) => [i ? ', ' : null, h('span', `${x.zone.name} (piraterie ${x.zone.level})`)]);
  const cls = r.attack * (1 - r.repel) > 0.05 ? 'neg' : r.attack > 0.03 ? 'warn-text' : '';
  const equip = (ship.equipment || []).filter((id) => EQUIPMENT[id].defence || EQUIPMENT[id].citadel).map((id) => EQUIPMENT[id].icon).join(' ');
  return h(`div.risk-line${cls ? '.' + cls : ''}`, [h('span', '☠ Votre route traverse :'), ' ', ...names, '. ', h('span', `Risque d'attaque ≈ ${pctTxt(r.attack)}. Défense ${Math.round(defence(ship) * 10) / 10}${equip ? ` (${equip})` : ''} : chance de repousser une attaque ordinaire ${pctTxt(r.repel)}, les plus dangereuses ${pctTxt(r.repelWorst)}. Sans citadelle, un navire abordé est détourné contre rançon. Ralentir allonge le passage ; aller vite aide à semer les pirates.${r.targeted ? ' ⚠ Des pirates seraient payés pour viser vos navires sur cette route : le risque affiché en tient compte.' : ''}`)]);
}

// Rapport de combat (auto battler) : défense, assaillants, phases, résultat.
export function battleReport(report) {
  const res = {
    repelled: ['✔ Attaque repoussée', 'pos'],
    looted: ['⚠ Navire pillé, équipage sain et sauf', 'warn-text'],
    hijacked: ['✖ Navire détourné', 'neg'],
  }[report.outcome];
  return h('div.battle', [
    h('div.battle-sides', [
      h('div.battle-side', [h('div.battle-title', 'Votre défense'), report.equipment.length ? h('div', report.equipment.map((e) => h('div', e))) : h('div.muted', 'Aucun équipement de défense')]),
      h('div.battle-vs', 'contre'),
      h('div.battle-side', [h('div.battle-title', 'Les assaillants'), h('div', `${report.attackers} (force ${String(report.strength).replace('.', ',')})`)]),
    ]),
    h('ol.battle-phases', report.phases.map((p) => h('li', { class: p.ok ? 'pos' : 'neg' }, [h('b', `${p.label} : `), `défense ${String(p.def).replace('.', ',')} contre ${String(p.att).replace('.', ',')} — ${p.text}`]))),
    h(`p.battle-result.${res[1]}`, res[0] + (report.loss ? ` (${money(report.loss)} volés${report.stolen ? `, ${Math.round(report.stolen * 100)} % de la cargaison` : ''})` : '') + (report.ransom ? ` : rançon demandée ${money(report.ransom)}` : '')),
  ]);
}

export async function showBattle(app, note) {
  await dialog({ title: `Pirates — ${note.report.zone}`, body: battleReport(note.report), buttons: [{ label: 'Fermer', value: 'ok', kind: 'primary' }] });
}

// Navire détourné : payer la rançon tout de suite, ou négocier (moins cher, mais long).
export async function openRansom(app, shipId, report = null) {
  const ship = app.state.ships.find((s) => s.id === shipId);
  if (!ship?.hijacked) return;
  const r = ship.hijacked;
  const choice = await dialog({
    title: `Le ${ship.name} est aux mains de pirates`,
    body: h('div', [
      report ? battleReport(report) : null,
      h('p', `Les pirates réclament ${money(r.ransom)}. L'équipage est retenu à bord.`),
      h('p', `Payer : le navire est libéré en 3 à 7 jours. Négocier : vous paierez environ ${money(r.ransom * 0.55)}, mais la captivité durera 1 à 2 mois (contrat en retard, confiance entamée).`),
    ]),
    buttons: [
      { label: `Négocier (≈ ${money(r.ransom * 0.55)})`, value: 'negocier', kind: 'ghost' },
      { label: `Payer la rançon (${money(r.ransom)})`, value: 'payer', kind: 'primary' },
    ],
  });
  if (!choice) return;
  const res = app.act(() => app.withRng((rng) => resolveHijack(app.state, rng, shipId, choice)), { sound: 'pay' });
  if (res?.ok) toast(`Rançon versée : ${money(res.pay)}. Le ${ship.name} sera libéré dans ${res.days} jours.`);
}

// Garde-côtes : risque affiché avant le départ quand un colis est caché à bord.
export function patrolLine(ship, route, speed) {
  const r = patrolRisk(ship, route, speed);
  if (!r) return null;
  const names = [...new Set(r.zones.map((x) => x.zone.name))].slice(0, 3).join(', ');
  return h(`div.risk-line${r.caught > 0.1 ? '.neg' : r.caught > 0.04 ? '.warn-text' : ''}`, `🚔 Eaux surveillées sur la route (${names}) : risque d'être contrôlé ≈ ${pctTxt(r.intercept)}. Chance de filer ${pctTxt(r.evade)}, que la fouille ne trouve rien ${pctTxt(r.hidden)} : au total, colis saisi ≈ ${pctTxt(r.caught)}. Les garde-côtes ne se laissent pas acheter.`);
}
export async function showPatrol(app, note) {
  const r = note.report;
  const res = { evaded: ['✔ Contrôle évité', 'pos'], searched: ['✔ Fouille sans résultat', 'pos'], seized: [`✖ Colis saisi : amende ${money(r.fine || 0)}, navire retenu ${r.days} jours`, 'neg'] }[r.outcome];
  await dialog({
    title: `Contrôle en mer — ${r.zone}`,
    body: h('div.battle', [
      h('ol.battle-phases', r.phases.map((p) => h('li', { class: p.ok ? 'pos' : 'neg' }, [h('b', `${p.label} : `), p.text]))),
      h(`p.battle-result.${res[1]}`, res[0]),
    ]),
    buttons: [{ label: 'Fermer', value: 'ok', kind: 'primary' }],
  });
}
