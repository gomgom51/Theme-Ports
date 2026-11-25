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
import { takeoverPrice, netCash } from './takeover.js';

const D = HOURS_PER_DAY;
const YEAR = 365 * D;

export const VICTORY = {
  repLevel: 3,          // niveau 4 (index 3) : « L'étage de direction »
  repHoldDays: 180,     // la réputation parfaite doit tenir six mois…
  repHoldFloor: 95,     // …sans retomber sous 95 (sinon le compte à rebours repart de zéro)
  repDeeds: 5,
  legendRecords: 5,
  shadowYears: 7, shadowShips: 16,
  alerts: [0.75, 0.9],
};
export const VICTORY_KINDS = ['domination', 'reputation', 'legend', 'shadow'];
export const VICTORY_INFO = {
  domination: { name: 'Seul maître à bord', icon: '⚓', text: 'Tous vos concurrents ruinés ou rachetés.' },
  reputation: { name: 'La plus respectée', icon: '🎖', get text() { return `Atteindre une réputation parfaite (100) avec au moins cinq hauts faits et le niveau 4, puis la tenir ${Math.round(VICTORY.repHoldDays / 30)} mois sans retomber sous ${VICTORY.repHoldFloor}.`; } },
  legend: { name: 'Compagnie légendaire', icon: '🏆', text: 'Détenir en même temps cinq des huit records.' },
  shadow: { name: 'La flotte fantôme', icon: '🗡', get text() { return `${VICTORY.shadowYears} ans sur la liste noire internationale avec au moins ${VICTORY.shadowShips} navires, et une affaire noire menée à bien dans chaque pays sous embargo.`; } },
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
    const standing = rivals.filter((c) => !c.bankrupt), out = rivals.length - standing.length;
    if (!rivals.length) parts = [part('Concurrents éliminés', 0, '0 / 0')];
    else if (!standing.length) parts = [part('Concurrents éliminés', 1, `${out} / ${rivals.length}`)];
    else if (standing.length === 1) {
      // Il n'en reste qu'un : la victoire est en vue quand on peut bientôt le racheter. 50 % + la moitié
      // de la part de son prix de rachat qu'on pourrait déjà payer comptant (rien s'il est d'un niveau
      // supérieur). 75 % : la moitié du prix ; 90 % : les quatre cinquièmes.
      const last = standing[0], price = takeoverPrice(state, last, company);
      const can = levelOf(company) >= levelOf(last) && !last.absorbed;
      const a = can ? Math.max(0, Math.min(1, netCash(state, company) / Math.max(1, price))) : 0;
      // (plafonné à 99 % : la victoire elle-même exige le rachat, ou sa faillite)
      parts = [part('Dernier concurrent', Math.min(0.99, 0.5 + 0.5 * a), can ? `${last.name} : ${Math.round(a * 100)} % de son prix de rachat en trésorerie nette` : `${last.name} : d'un niveau supérieur au vôtre`)];
    } else parts = [part('Concurrents éliminés', (out / rivals.length) * 0.5, `${out} / ${rivals.length}`)];
  } else if (kind === 'reputation') {
    const n = deedCount(company), lv = levelOf(company);
    const hold = company.repHold ? (state.t - company.repHold.since) / D : 0;
    parts = [
      part('Réputation', company.repHold ? 1 : (company.reputation - 80) / 20, (company.repHold ? `${Math.floor(company.reputation)} (100 atteint)` : `${Math.floor(company.reputation)} / 100`) + ` · confiance ${Math.floor(company.confidence ?? company.reputation)}, vertu ${Math.floor(company.virtue ?? company.reputation)}`),
      part('Hauts faits', n / VICTORY.repDeeds, `${n} / ${VICTORY.repDeeds}`),
      part('Niveau', (lv + 1) / (VICTORY.repLevel + 1), `${lv + 1} / ${VICTORY.repLevel + 1}`),
      part('Tenue', hold / VICTORY.repHoldDays, company.repHold ? `${Math.floor(hold)} / ${VICTORY.repHoldDays} jours au-dessus de ${VICTORY.repHoldFloor}` : 'pas encore (atteindre 100)'),
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
  const won = parts.every((p) => p.frac >= 1);
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
  // Compte à rebours de la réputation parfaite : il démarre à 100 (niveau requis atteint) et
  // repart de zéro si la réputation retombe sous le plancher.
  for (const c of activeCompanies(state)) {
    if (c.repHold && c.reputation < VICTORY.repHoldFloor) c.repHold = null;
    else if (!c.repHold && c.reputation >= 100 && levelOf(c) >= VICTORY.repLevel) c.repHold = { since: state.t };
  }
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
          const lastPrey = kind === 'domination' && h.id !== c.id && state.companies.filter((x) => x.id !== c.id && !x.bankrupt).length === 1;
          notes.push({ kind: 'victoryAlert', company: h.id, about: c.id, victory: kind, step, text: h.id === c.id
            ? (kind === 'domination' ? `Il ne vous reste qu'un concurrent, et vous aurez bientôt de quoi le racheter : victoire « ${VICTORY_INFO[kind].name} » en vue (${pc} %).` : `Vous approchez de la victoire « ${VICTORY_INFO[kind].name} » : ${pc} % du chemin.`)
            : lastPrey
              ? `${c.name} n'a plus que vous en face, et aura bientôt de quoi racheter votre compagnie : victoire « ${VICTORY_INFO[kind].name} » en vue pour lui (${pc} %). Pour lui échapper : une meilleure confiance (elle multiplie votre prix), un niveau supérieur au sien, ou une valeur nette qui grandit plus vite que sa trésorerie.`
              : `${c.name} approche de la victoire « ${VICTORY_INFO[kind].name} » : ${pc} % du chemin. Bureau → Victoires pour voir où il en est.` });
        }
      } else if (step < (marks[kind] || 0) && p.frac < VICTORY.alerts[0] - 0.1) marks[kind] = step; // reparti en arrière : on pourra prévenir de nouveau
    }
  }
}
