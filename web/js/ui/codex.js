// Le guide des victoires : les quatre victoires, la réputation (reputation.js), les huit hauts faits, les huit records (trophées) et
// les six méfaits, avec leurs conditions exactes (textes et seuils tirés du code : toujours à jour).
import { h, bar, date } from './dom.js';
import { VICTORY_KINDS, VICTORY_INFO, victoryProgress } from '../sim/victory.js';
import { DEEDS, DEED_IDS, RECORDS, RECORD_IDS, EVIL, EVIL_IDS, recordHolder, hon } from '../sim/honours.js';
import { honourSVG, deedIcon } from './trophyart.js';
import { holderLine, recordProgress } from './victory.js';
import { reputationGuide } from './reputation.js';

const card = (art, name, text, extra = null, cls = '') => h('div.codex-card', { class: cls }, [art, h('div.grow', [h('b', name), h('div.small', text), extra])]);
const medal = (id) => h('span.deed-medal', [h('span.deed-ribbon'), h('span.deed-disc', { html: deedIcon(id, DEEDS[id].icon) })]);
const trophy = (kind, id) => h('div.codex-art', { html: honourSVG(kind, id, { size: 60 }) });

function victoriesList(app) {
  const { state } = app;
  return h('div', [
    h('p.hint', 'Si personne ne gagne avant la fin du temps imparti, la compagnie la plus riche l\'emporte. Mais quatre victoires peuvent finir la partie plus tôt. Chacun voit la progression de tous (Bureau → Victoires) et tout le monde est prévenu à 75 % puis à 90 % d\'une victoire.'),
    h('div.codex-list', VICTORY_KINDS.map((k) => {
      const V = VICTORY_INFO[k], off = state.settings?.victories?.[k] === false;
      if (off) return card(h('div.codex-icon', V.icon), V.name, V.text, h('div.small.muted', 'Désactivée dans cette partie.'), 'off');
      const p = victoryProgress(state, app.company(), k);
      return card(h('div.codex-icon', V.icon), V.name, V.text, h('div', [bar(p.frac), h('div.small.muted', `Vous : ${Math.round(p.frac * 100)} % du chemin`)]));
    })),
  ]);
}
function deedsList(app) {
  const me = app.company(), H = hon(me);
  return h('div', [
    h('p.hint', 'Des badges que toutes les compagnies peuvent gagner, et qui restent acquis. Chacun des cinq premiers relève d\'un point le plafond de votre confiance et de votre vertu (95 pour la conduite ordinaire) ; la victoire « La plus respectée » en demande cinq.'),
    h('div.codex-list', DEED_IDS.map((id) => {
      const got = H.deeds[id], p = got ? null : DEEDS[id].progress(app.state, me);
      return card(medal(id), DEEDS[id].name, DEEDS[id].text, got ? h('div.small.good', `Gagné le ${date(got, true)}`) : h('div', [bar(p.frac), h('div.small.muted', p.text)]), got ? 'got' : '');
    })),
  ]);
}
function recordsList(app, kind) {
  const { state } = app, cid = app.ui.activeCompany;
  const L = kind === 'evil' ? EVIL : RECORDS, ids = kind === 'evil' ? EVIL_IDS : RECORD_IDS;
  return h('div', [
    h('p.hint', kind === 'evil'
      ? 'Les records de l\'ombre : un seul détenteur à la fois, comme les trophées. Leurs preuves sinistres s\'exposent sur une table sombre du bureau.'
      : 'Un seul détenteur à la fois : le premier à atteindre le seuil prend le record ; les records chiffrés peuvent être battus, les records « complets » restent au premier. Les trophées trônent dans le bureau du détenteur ; cinq en même temps font la victoire « Compagnie légendaire ».'),
    h('div.codex-list', ids.map((id) => card(trophy(kind === 'evil' ? 'evil' : 'record', id), L[id].name, L[id].text,
      h('div', [h('div.small', holderLine(state, recordHolder(state, id, kind), L[id], cid)), recordHolder(state, id, kind)?.holder === cid ? null : recordProgress(state, state.companies[cid], kind, id)]),
      kind === 'evil' ? 'dark' : ''))),
  ]);
}

export function codexPanel(app, id, tab) {
  return {
    title: 'Victoires, réputation, hauts faits, trophées et méfaits',
    tabs: [
      ['victoires', 'Victoires', () => victoriesList(app)],
      ['reputation', 'Réputation', () => reputationGuide(app)],
      ['hauts-faits', 'Hauts faits', () => deedsList(app)],
      ['trophees', 'Trophées', () => recordsList(app, 'record')],
      ['mefaits', 'Méfaits', () => recordsList(app, 'evil')],
    ],
    tab,
  };
}
