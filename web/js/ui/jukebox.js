// Juke-box du bureau : rejouer, en boucle ou à la suite, les chansons déjà entendues en jeu
// (débloquées pour toutes les parties). Les autres restent sous cadenas, avec la façon de les entendre.
import { h, dialog } from './dom.js';
import { unlockedTracks, unlockTracks, once } from './profile.js';
import { OFFICE_TIERS, officeTier } from '../data/offices.js';
import { VICTORY_KINDS } from '../sim/victory.js';
import { MUSIC_LOW } from './officeart.js';

// id : clé de TRACKS (audio.js) ; title : le titre de la chanson ; role : où on l'entend.
export const JUKEBOX = [
  { id: 'title', title: 'Port d\'attache', role: 'Écran d\'accueil', hint: '' },
  { id: 'tier1', title: 'Chant des Marins', role: 'Le cagibi du quai', hint: 'Commencer une partie' },
  { id: 'tier1b', title: 'Chant des Marins (II)', role: 'Le cagibi du quai, seconde chanson', hint: 'Atteindre 10 M$ de valeur nette' },
  { id: 'tier2', title: 'Harbour Festival Jig', role: 'Le bureau sur le port', hint: 'Atteindre 15 M$ de valeur nette' },
  { id: 'tier2b', title: 'Harbour Festival Jig (II)', role: 'Le bureau sur le port, seconde chanson', hint: 'Atteindre 23 M$ de valeur nette' },
  { id: 'tier3', title: 'Celtic Drive', role: 'Le siège de la compagnie', hint: 'Atteindre 35 M$ de valeur nette' },
  { id: 'tier3b', title: 'Celtic Drive (II)', role: 'Le siège de la compagnie, seconde chanson', hint: 'Atteindre 55 M$ de valeur nette' },
  { id: 'tier4', title: 'Horizon Lumineux', role: 'L\'étage de direction', hint: 'Atteindre 100 M$ de valeur nette' },
  { id: 'tier4b', title: 'Horizon Lumineux (II)', role: 'L\'étage de direction, seconde chanson', hint: 'Atteindre 175 M$ de valeur nette' },
  { id: 'tier5', title: 'Harbour at Dawn', role: 'La tour de verre', hint: 'Atteindre 300 M$ de valeur nette' },
  { id: 'tier5b', title: 'Harbour at Dawn (II)', role: 'La tour de verre, seconde chanson', hint: 'Atteindre 600 M$ de valeur nette' },
  { id: 'tier0', title: 'Windswept Harbour', role: 'Au bord de la faillite', hint: 'Frôler la faillite (sous 5 M$ de valeur nette, ou le banquier qui s\'inquiète)' },
  { id: 'menace', title: 'Le temps presse', role: 'Un concurrent va gagner', hint: 'Voir un concurrent tout près d\'une victoire' },
  { id: 'domination', title: 'Le dernier rachat', role: 'Seul maître à bord en vue', hint: 'Approcher de la victoire « Seul maître à bord »' },
  { id: 'reputation', title: 'Le pavillon d\'honneur', role: 'La plus respectée en vue', hint: 'Approcher de la victoire « La plus respectée »' },
  { id: 'legend', title: 'La légende des sept mers', role: 'Compagnie légendaire en vue', hint: 'Approcher de la victoire « Compagnie légendaire »' },
  { id: 'shadow', title: 'La flotte fantôme', role: 'La flotte de l\'ombre en vue', hint: 'Approcher de la victoire « La flotte fantôme »' },
  { id: 'blacklist', title: 'Pavillon noir', role: 'Sur la liste noire', hint: 'Finir sur la liste noire internationale' },
  { id: 'blacklistb', title: 'Pavillon noir (II)', role: 'Deux ans sur la liste noire', hint: 'Rester deux ans sur la liste noire' },
  { id: 'end', title: 'Hissez le pavillon', role: 'Fin de partie', hint: 'Terminer une partie' },
  { id: 'credits', title: 'Port d\'attache', role: 'Générique de fin', hint: 'Regarder le générique' },
];
const byId = Object.fromEntries(JUKEBOX.map((t) => [t.id, t]));

// La chanson d'accueil est toujours là ; les autres, dès qu'on les a entendues une fois.
function unlocked() {
  const set = unlockedTracks();
  set.add('title');
  return set;
}

// Chansons méritées par une compagnie, lues dans la partie elle-même : elles se débloquent même si
// la musique était coupée, si le juke-box jouait autre chose à ce moment-là, ou si la partie date
// d'avant le juke-box. Mêmes étapes que la musique de la partie (musicStep, musicMood dans main.js).
// nw : valeur nette actuelle (en partie) ; sinon, l'historique hebdomadaire suffit.
export const BLACKLIST_SONG_YEARS = 2; // années sur la liste noire avant la seconde chanson
export function earnedTracks(state, c, nw = null) {
  const ids = [];
  const nws = (c.history || []).map((x) => x.nw).filter(Number.isFinite);
  if (Number.isFinite(nw)) nws.push(nw);
  const peak = nws.reduce((a, b) => Math.max(a, b), 0);
  // Bureaux atteints (un niveau est acquis), et seconde chanson de chaque niveau passé à mi-chemin.
  const top = Math.max(c.level ?? 0, officeTier(peak));
  OFFICE_TIERS.forEach((o, t) => {
    if (t <= top) ids.push(`tier${t + 1}`);
    if (peak >= o.half) ids.push(`tier${t + 1}b`);
  });
  // Au bord de la faillite : sous 5 M$ de valeur nette (là où la chanson joue), ou le banquier qui
  // s'inquiète (avertissement en cours, navire saisi) ; une partie perdue aussi.
  const seized = (c.pastShips || []).some((p) => p.why === 'saisi par la banque');
  if (nws.some((v) => v < MUSIC_LOW) || c.bankerWarned || seized || c.bankrupt) ids.push('tier0');
  // Victoire en vue (alerte à 75 %), ou un concurrent tout près de gagner (alerte à 90 %).
  for (const k of VICTORY_KINDS) if ((c.victoryMarks?.[k] || 0) >= 1) ids.push(k);
  if ((state.companies || []).some((o) => o.id !== c.id && Object.values(o.victoryMarks || {}).some((m) => m >= 2))) ids.push('menace');
  if (c.blacklisted) {
    ids.push('blacklist');
    if (state.t - c.blacklisted.t >= BLACKLIST_SONG_YEARS * 365 * 24) ids.push('blacklistb');
  }
  if (state.over) ids.push('end');
  return ids;
}

// Débloque, pour toutes les parties, ce que les compagnies humaines de cette partie ont mérité.
// nwOf(c) : valeur nette actuelle (facultatif).
export function unlockEarned(state, nwOf = null) {
  const ids = [];
  for (const c of state?.companies || []) if (c.human) ids.push(...earnedTracks(state, c, nwOf ? nwOf(c) : null));
  return unlockTracks(ids);
}

// Une fois par profil : relire toutes les sauvegardes, y compris celles d'avant le juke-box.
// states() : les parties enregistrées (save.js).
export function unlockFromSaves(states) {
  once('jukebox-saves-2', () => { // -2 : relire avec la règle « au bord de la faillite »
    for (const s of states()) { try { unlockEarned(s); } catch { /* sauvegarde abîmée : on passe */ } }
  });
}

export function jukeboxDialog(app) {
  const audio = app.audio;
  let mode = audio.juke?.mode || 'one';
  const next = (id) => {
    const open = unlocked(), list = JUKEBOX.filter((t) => open.has(t.id));
    const i = list.findIndex((t) => t.id === id);
    return list[(i + 1) % list.length]?.id || id;
  };
  const body = h('div.juke-box');
  const render = () => {
    const open = unlocked(), cur = audio.juke?.id || null;
    const n = JUKEBOX.filter((t) => open.has(t.id)).length;
    const pick = (m) => { mode = m; audio.setJukeMode(m); render(); };
    body.replaceChildren(...[
      h('p.small.muted', `Chaque chanson entendue en jeu se débloque ici, pour toutes vos parties : ${n} / ${JUKEBOX.length}.`),
      h('div.juke-modes', [
        h('button.chip', { class: mode === 'one' ? 'on' : '', 'aria-pressed': String(mode === 'one'), onclick: () => pick('one') }, '🔂 En boucle'),
        h('button.chip', { class: mode === 'all' ? 'on' : '', 'aria-pressed': String(mode === 'all'), onclick: () => pick('all') }, '🔁 À la suite'),
      ]),
      cur ? h('p.juke-now', [h('span', '♪ En cours :'), ' ', h('b', { 'data-no-tr': '' }, byId[cur]?.title || cur)]) : h('p.juke-now.muted', 'La musique suit la partie.'),
      audio.settings.music ? null : h('p.small.warn-text', 'La musique est coupée : choisir un morceau la remet.'),
      h('div.list.compact.juke-list', JUKEBOX.map((t) => {
        if (!open.has(t.id)) {
          return h('div.row.juke-row.locked', [
            h('span.juke-btn', { 'aria-hidden': 'true' }, '🔒'),
            h('span.grow', [h('b', '? ? ?'), h('div.small.muted', [h('span', 'Pour l\'entendre :'), ' ', h('span', t.hint)])]),
          ]);
        }
        const playing = cur === t.id;
        return h('div.row.juke-row', { class: playing ? 'playing' : '' }, [
          h('button.juke-btn', {
            title: playing ? 'Arrêter' : 'Écouter', 'aria-label': playing ? 'Arrêter' : 'Écouter',
            onclick: () => { if (playing) audio.stopJuke(); else audio.playJuke(t.id, mode, next); render(); app.refresh(); },
          }, playing ? '⏸' : '▶'),
          h('span.grow', [h('b', { 'data-no-tr': '' }, t.title), h('div.small.muted', t.role)]),
          playing ? h('span.juke-eq', { 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]) : null,
        ]);
      })),
    ].filter(Boolean)); // replaceChildren écrirait « null »
  };
  audio.onJuke = () => { render(); app.refresh(); }; // « à la suite » : le morceau suivant commence
  render();
  dialog({
    title: '🎵 Juke-box', body,
    buttons: [{ label: '⏹ Musique de la partie', value: 'stop', kind: 'ghost' }, { label: 'Fermer', value: null, kind: 'primary' }],
  }).then((v) => {
    if (v === 'stop') audio.stopJuke();
    audio.onJuke = () => app.refresh();
    app.refresh();
  });
}
