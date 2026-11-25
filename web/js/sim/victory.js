// Conditions de victoire (en plus du classement à la fin du temps imparti).
//  Seul maître à bord : tous les concurrents ruinés ou rachetés.
//  La plus respectée  : réputation parfaite (100), cinq hauts faits, niveau 4.
//  Légendaire         : détenir cinq des huit records en même temps.
//  La flotte fantôme  : trois ans sur la liste noire, douze navires, une affaire noire dans
//                       chaque pays sous embargo.
// Chaque compagnie voit la progression de toutes les autres (Bureau → Victoires) ; à 75 % puis
// à 90 % d'une victoire, tout le monde est prévenu (règle n° 1 : pas de défaite surprise).
import { HOURS_PER_DAY } from './util.js';
import { netWorth, news, shipsOf } from './core.js';
import { OFFICE_TIERS, officeTier } from '../data/offices.js';
import { hon, deedCount, recordsHeld, RECORD_IDS, DARK_COUNTRIES } from './honours.js';
import { EMBARGOED } from '../data/sanctions.js';

const D = HOURS_PER_DAY;
const YEAR = 365 * D;

export const VICTORY = {
  repLevel: 3,          // niveau 4 (index 3) : « L'étage de direction »
  repDeeds: 5,
  legendRecords: 5,
  shadowYears: 3, shadowShips: 12,
  alerts: [0.75, 0.9],
};
export const VICTORY_KINDS = ['domination', 'reputation', 'legend', 'shadow'];
export const VICTORY_INFO = {
  domination: { name: 'Seul maître à bord', icon: '⚓', text: 'Tous vos concurrents ruinés ou rachetés.' },
  reputation: { name: 'La plus respectée', icon: '🎖', text: 'Une réputation parfaite (100), au moins cinq hauts faits et le niveau 4.' },
  legend: { name: 'Compagnie légendaire', icon: '🏆', text: 'Détenir en même temps cinq des huit records.' },
  shadow: { name: 'La flotte fantôme', icon: '🗡', text: 'Trois ans sur la liste noire internationale avec au moins douze navires, et une affaire noire menée à bien dans chaque pays sous embargo.' },
};

// Victoires activées pour cette partie (toutes par défaut, anciennes sauvegardes comprises).
export const victoryOn = (state, kind) => !state.victoryClaimed && (state.settings.victories?.[kind] ?? true)
  && (kind !== 'domination' || state.companies.length > 1);
export const activeCompanies = (state) => state.companies.filter((c) => !c.bankrupt);
export const levelOf = (company) => company.level ?? 0;

// Progression d'une compagnie vers une victoire : parts (libellé, avancement 0..1, texte) et total.
export function victoryProgress(state, company, kind) {
  const part = (label, f, text) => ({ label, frac: Math.max(0, Math.min(1, f)), text });
  let parts;
  if (kind === 'domination') {
    const rivals = state.companies.filter((c) => c.id !== company.id);
    const out = rivals.filter((c) => c.bankrupt).length;
    parts = [part('Concurrents éliminés', rivals.length ? out / rivals.length : 0, `${out} / ${rivals.length}`)];
  } else if (kind === 'reputation') {
    const n = deedCount(company), lv = levelOf(company);
    parts = [
      part('Réputation', (company.reputation - 80) / 20, `${Math.floor(company.reputation)} / 100`),
      part('Hauts faits', n / VICTORY.repDeeds, `${n} / ${VICTORY.repDeeds}`),
      part('Niveau', (lv + 1) / (VICTORY.repLevel + 1), `${lv + 1} / ${VICTORY.repLevel + 1}`),
    ];
  } else if (kind === 'legend') {
    const n = recordsHeld(state, company.id).length;
    parts = [part('Records détenus', n / VICTORY.legendRecords, `${n} / ${VICTORY.legendRecords} (sur ${RECORD_IDS.length})`)];
  } else {
    const H = hon(company);
    const years = company.blacklisted ? (state.t - company.blacklisted.t) / YEAR : 0;
    const ships = shipsOf(state, company.id).length;
    const done = DARK_COUNTRIES.filter((f) => H.darkFrom[f]);
    parts = [
      part('Sur la liste noire', years / VICTORY.shadowYears, company.blacklisted ? `${years.toFixed(1).replace('.', ',')} / ${VICTORY.shadowYears} ans` : 'pas encore'),
      part('Navires', ships / VICTORY.shadowShips, `${ships} / ${VICTORY.shadowShips}`),
      part('Pays sous embargo', done.length / DARK_COUNTRIES.length, `${done.length} / ${DARK_COUNTRIES.length}${done.length < DARK_COUNTRIES.length ? ` (reste : ${DARK_COUNTRIES.filter((f) => !H.darkFrom[f]).map((f) => EMBARGOED[f].name).join(', ')})` : ''}`),
    ];
  }
  const won = parts.every((p) => p.frac >= 1) && (kind !== 'reputation' || company.reputation >= 100);
  return { parts, frac: parts.reduce((a, p) => a + p.frac, 0) / parts.length, won };
}

// Niveaux de toutes les compagnies (maturité) : un niveau atteint est acquis.
export function levelsDaily(state, notes) {
  for (const co of state.companies) {
    if (co.bankrupt) continue;
    const t = officeTier(netWorth(state, co.id));
    if (co.level == null) { co.level = t; continue; } // nouvelle partie ou ancienne sauvegarde : sans fanfare
    if (t <= co.level) continue;
    const from = co.level;
    co.level = t;
    if (co.human) notes.push({ kind: 'level', company: co.id, from, to: t });
    else if (t >= 2) news(state, `${co.name} passe au niveau ${t + 1} : ${OFFICE_TIERS[t].name.toLowerCase()}.`, { company: co.id, kind: 'fleet' });
  }
}

// Chaque jour : alertes à 75 % et 90 %, puis victoire éventuelle (fin de partie).
export function victoryDaily(state, notes) {
  if (state.over || state.victoryClaimed) return;
  for (const kind of VICTORY_KINDS) {
    if (!victoryOn(state, kind)) continue;
    for (const c of activeCompanies(state)) {
      const p = victoryProgress(state, c, kind);
      if (p.won) {
        state.victoryClaimed = kind;
        const reason = `${c.name} remporte la victoire « ${VICTORY_INFO[kind].name} » !`;
        news(state, reason, { company: c.id, kind: 'event' });
        state.over = { reason, t: state.t, winner: c.id, kind };
        notes.push({ kind: 'over', text: reason, winner: c.id, victory: kind });
        return;
      }
      const marks = (c.victoryMarks ??= {});
      const step = VICTORY.alerts.filter((a) => p.frac >= a).length;
      if (step > (marks[kind] || 0)) {
        marks[kind] = step;
        const pc = Math.round(VICTORY.alerts[step - 1] * 100);
        news(state, `${c.name} approche de la victoire « ${VICTORY_INFO[kind].name} » (${pc} %).`, { company: c.id, kind: 'event' });
        for (const h of state.companies.filter((x) => x.human && !x.bankrupt)) {
          notes.push({ kind: 'victoryAlert', company: h.id, about: c.id, victory: kind, step, text: h.id === c.id
            ? `Vous approchez de la victoire « ${VICTORY_INFO[kind].name} » : ${pc} % du chemin.`
            : `${c.name} approche de la victoire « ${VICTORY_INFO[kind].name} » : ${pc} % du chemin. Bureau → Victoires pour voir où il en est.` });
        }
      } else if (step < (marks[kind] || 0) && p.frac < VICTORY.alerts[0] - 0.1) marks[kind] = step; // reparti en arrière : on pourra prévenir de nouveau
    }
  }
}
