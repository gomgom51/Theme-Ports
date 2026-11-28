// Une page par victoire (icônes de l'écran principal) : où en est chaque compagnie sur ce chemin,
// et ce qui s'y rattache (hauts faits, records, méfaits ; concurrents et classement dans panels.js).
import { h, date, money } from './dom.js';
import { logoBadge } from './logos.js';
import { VICTORY, VICTORY_INFO, victoryOn, victoryProgress } from '../sim/victory.js';
import { DEEDS, DEED_IDS, RECORDS, RECORD_IDS, EVIL, EVIL_IDS, deedCount, recordHolder, hon } from '../sim/honours.js';
import { repCap } from '../sim/core.js';
import { OFFICE_TIERS } from '../data/offices.js';
import { honourSVG, deedIcon } from './trophyart.js';
import * as TK from '../sim/takeover.js';
import { BLACKLIST } from '../sim/shadow.js';

const D = 24;
const badge = (c, size = 26) => h('span.badge-wrap', { html: logoBadge(c.logo, c.color, size) });
const bar = (f, cls = '') => h('span.vic-bar', { class: cls }, [h('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%` } })]);
const pctTxt = (f) => `${Math.round(Math.max(0, Math.min(1, f)) * 100)} %`;

// ---------- Victoires ----------
// Bouton vers le guide complet (toutes les victoires, hauts faits, trophées et méfaits, et leurs conditions).
const codexLink = (app, tab) => h('button.btn.small.codex-link', { onclick: () => app.open('codex', null, tab) }, '📖 Toutes les victoires, hauts faits, trophées et méfaits');
// Victoire active (ou déjà gagnée par quelqu'un : on garde l'affichage, sans nouvelle victoire possible).
const shownOn = (state, kind) => victoryOn(state, kind) || (state.victoryClaimed && (state.settings.victories?.[kind] ?? true));

// Onglet « La course » d'une victoire : où en est chaque compagnie sur ce chemin.
export function raceTab(app, kind) {
  const { state } = app;
  const me = app.ui.activeCompany;
  const years = state.settings.duration;
  const info = VICTORY_INFO[kind];
  const on = shownOn(state, kind);
  const box = h('div.victories');
  box.append(codexLink(app, 'victoires'));
  const end = years ? `La partie se termine le ${date(years * 365 * D, true)} : si personne n'a gagné d'ici là, la plus grande valeur nette l'emporte.` : 'Partie sans limite de temps : seule une victoire la termine.';
  if (state.victoryClaimed) {
    box.append(h('p.vic-claimed', 'Une victoire a déjà été remportée dans cette partie : elle continue librement, sans nouvelle victoire.'));
  } else {
    box.append(h('p.muted', [end, ` Chacun voit où en sont les autres ; tout le monde est prévenu quand une compagnie atteint ${pctTxt(VICTORY.alerts[0])} puis ${pctTxt(VICTORY.alerts[1])} d'une victoire.`]));
  }
  const card = h('div.vic-card', { class: on ? '' : 'off' }, [
    h('div.vic-head', [h('span.vic-icon', info.icon), h('div.grow', [h('b', info.name), h('div.small.muted', info.text)]), on ? null : h('span.tag', 'désactivée')]),
  ]);
  if (on) {
    const rows = state.companies.map((c) => ({ c, p: victoryProgress(state, c, kind) }))
      .filter((x) => !x.c.bankrupt)
      .sort((a, b) => b.p.frac - a.p.frac);
    card.append(h('div.vic-rows', rows.map(({ c, p }) => h('div.vic-row', { class: c.id === me ? 'mine' : '' }, [
      badge(c, 24),
      h('div.grow', [
        h('div.vic-line', [h('b.nm', { 'data-no-tr': '' }, c.name), h('span.vic-pct', pctTxt(p.frac))]),
        bar(p.frac, p.frac >= VICTORY.alerts[1] ? 'hot' : p.frac >= VICTORY.alerts[0] ? 'warm' : ''),
        h('div.vic-parts', p.parts.map((x) => h('span.vic-part', { class: x.frac >= 1 ? 'done' : '' }, [`${x.frac >= 1 ? '✓ ' : ''}${x.label} : `, h('b', x.text)]))),
      ]),
    ]))));
    if (kind === 'reputation') card.append(h('p.small.muted', [`Réputation ordinaire plafonnée à 95 ; chaque haut fait (onglet Hauts faits) relève le plafond d'un point, jusqu'à 100. Niveau ${VICTORY.repLevel + 1} : ${OFFICE_TIERS[VICTORY.repLevel].name.toLowerCase()} (${money(OFFICE_TIERS[VICTORY.repLevel].min)} de valeur nette, un niveau atteint est acquis).`, ` Une fois 100 atteint, le compte à rebours de ${VICTORY.repHoldDays} jours démarre ; sous ${VICTORY.repHoldFloor} (retards, scandale, dénigrement), il repart de zéro.`]));
    if (kind === 'domination') card.append(h('p.small.muted', 'Un concurrent est éliminé quand il fait faillite ou que vous le rachetez (onglet Concurrents). Le rachat se paie comptant, sans emprunt. Quand il n\'en reste qu\'un, la victoire est en vue dès qu\'on a la moitié de son prix de rachat (75 %), puis les quatre cinquièmes (90 %).'));
    if (kind === 'legend') card.append(h('p.small.muted', 'Les records chiffrés se battent : il suffit de faire mieux que leur détenteur pour les lui prendre (onglet Records).'));
    if (kind === 'shadow') card.append(h('p.small.muted', `La liste noire tombe quand l'infamie atteint son maximum (affaires noires) : vous serez prévenu avant de franchir la ligne. Ses propriétaires se cachent derrière des sociétés-écrans : la démanteler coûte ${TK.TAKEOVER.dismantleK} fois sa valeur nette.`));
  } else {
    box.append(h('p.small.muted', 'Cette victoire est désactivée pour cette partie, mais ses autres onglets restent utiles.'));
  }
  box.append(card);
  if (kind === 'shadow') box.append(shadowStatus(state, state.companies[me]));
  return box;
}
// Où en est votre compagnie côté ombre : infamie (plafond des notes) et liste noire.
function shadowStatus(state, c) {
  const inf = Math.floor(c.infamy || 0);
  return h('div.vic-shadow-status', [
    h('h3', 'Votre compagnie'),
    h('p', c.blacklisted ? `☠ Sur la liste noire depuis le ${date(c.blacklisted.t, true)}. Infamie : ${inf}.`
      : inf ? `Infamie : ${inf} (la liste noire tombe à ${BLACKLIST.infamy}). Votre confiance et votre vertu ne pourront plus dépasser ${100 - Math.min(80, inf)}/100.`
      : 'Aucune infamie : votre compagnie n\'a jamais trempé dans une affaire noire.'),
  ]);
}

// ---------- Trophées ----------
export function holderLine(state, rec, R, mineId) {
  if (!rec) return h('span.muted', `Non attribué · seuil : ${R.fmt(R.min())}`);
  const c = state.companies[rec.holder];
  // Un morceau de texte par partie : la traduction anglaise reconnaît chacune.
  return h('span', [rec.holder === mineId ? h('b', 'À vous') : h('b', { 'data-no-tr': '' }, c?.name || '?'), ` · ${R.fmt(rec.value)}`, c?.bankrupt ? ' (compagnie disparue)' : null]);
}
// Où en est la compagnie pour un record ou un méfait : barre vers le seuil (non attribué) ou vers
// le détenteur à battre ; un record « complet » déjà pris reste au premier (pas de barre).
export function recordProgress(state, me, kind, id) {
  const R = (kind === 'evil' ? EVIL : RECORDS)[id], rec = recordHolder(state, id, kind), v = R.value(state, me);
  const bar = (k) => h('span.rec-bar', [h('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%` } })]);
  if (rec?.holder === me.id) return h('div.small.good', `À vous : ${R.fmt(rec.value)}${R.binary ? ' (pour toujours)' : ''}`);
  if (rec && R.binary) return h('div.small.muted', [`Vous : ${R.fmt(v)} · déjà pris, il reste au premier.`]);
  const target = rec ? rec.value : R.min();
  const miss = R.missing ? R.missing(state, me) : null;
  return h('div.rec-progress', [bar(v / Math.max(1e-9, target)), h('div.small.muted', rec ? `Vous : ${R.fmt(v)} · à battre : plus de ${R.fmt(rec.value)}` : `Vous : ${R.fmt(v)} / ${R.fmt(target)}`),
    miss && miss.length ? h('details.rec-missing', [h('summary.small', `Il vous manque : ${miss.length}`), h('div.small', miss.flatMap((m, i) => [i ? ', ' : null, h('span', m)]))]) : null]);
}
function recordCards(app, kind) {
  const { state } = app;
  const me = state.companies[app.ui.activeCompany];
  const defs = kind === 'evil' ? EVIL : RECORDS, ids = kind === 'evil' ? EVIL_IDS : RECORD_IDS;
  return h('div.trophy-grid', ids.map((id) => {
    const R = defs[id], rec = recordHolder(state, id, kind), mine = rec?.holder === me.id;
    const v = R.value(state, me);
    return h('div.trophy-card', { class: `${kind}${mine ? ' mine' : ''}${rec ? '' : ' free'}` }, [
      h('div.trophy-art', { html: honourSVG(kind, id, { size: 64, dim: !rec }) }),
      h('div.grow', [
        h('b', R.name),
        h('div.small', R.text),
        h('div.small.trophy-holder', holderLine(state, rec, R, me.id)),
        mine ? null : recordProgress(state, me, kind, id),
        rec && rec.holder !== me.id && rec.holder != null && state.companies[rec.holder] && rec.t != null ? h('div.small.muted', `Depuis le ${date(rec.t, true)}`) : null,
      ]),
    ]);
  }));
}
// Hauts faits (victoire « La plus respectée »).
export function deedsTab(app) {
  const { state } = app;
  const me = state.companies[app.ui.activeCompany];
  const H = hon(me), n = deedCount(me);
  const box = h('div.trophies');
  box.append(codexLink(app, 'hauts-faits'));
  box.append(h('h3', `Hauts faits · ${n} / ${DEED_IDS.length}`));
  box.append(h('p.small.muted', `Chaque compagnie peut tous les gagner. La réputation ordinaire plafonne à 95 ; chacun des cinq premiers hauts faits relève le plafond d'un point. Votre plafond : ${Math.floor(repCap(me))}.`));
  box.append(h('div.deed-grid', DEED_IDS.map((id) => {
    const Dd = DEEDS[id], got = H.deeds[id];
    const p = got ? null : Dd.progress(state, me);
    return h('div.deed-card', { class: got ? 'got' : p?.impossible ? 'impossible' : '' }, [
      h('span.deed-medal', [h('span.deed-ribbon'), h('span.deed-disc', { html: deedIcon(id, Dd.icon) })]),
      h('div.grow', [
        h('b', Dd.name),
        h('div.small', Dd.text),
        got ? h('div.small.good', `Gagné le ${date(got, true)}`) : h('div', [bar(p.frac), h('div.small.muted', p.text)]),
      ]),
    ]);
  })));
  return box;
}
// Records (victoire « Compagnie légendaire ») ou méfaits (côté ombre).
export function recordsTab(app, kind) {
  const box = h('div.trophies');
  box.append(codexLink(app, kind === 'evil' ? 'mefaits' : 'trophees'));
  if (kind === 'evil') {
    box.append(h('h3', 'Méfaits'));
    box.append(h('p.small.muted', 'Les records de l\'ombre, mêmes règles. Personne ne les applaudit, mais chacun sait qui les détient : leurs preuves sinistres s\'étalent sur le bureau.'));
  } else {
    box.append(h('h3', 'Records'));
    box.append(h('p.small.muted', 'Un seul détenteur à la fois. Le premier qui atteint le seuil prend le record ; les records chiffrés se battent ensuite en faisant mieux que le détenteur. Les trophées trônent sur l\'étagère du bureau de leur détenteur.'));
  }
  box.append(recordCards(app, kind));
  return box;
}
