// Interface du commerce gris et noir : propositions discrètes, risques affichés
// avant de s'engager (douane, sanctions), décision après une saisie.
import { homeOf } from '../sim/home.js';
import { PORTS, FLAGS } from '../data/ports.js';
import { EMBARGOED, ENFORCING, SHADY_PORTS, customsLevel, corruption } from '../data/sanctions.js';
import { portName } from '../sim/core.js';
import { detectionChance, seizureFine, sanctionRisk, sanctionPreview, taintActive, isEmbargoed, acceptOffer, resolveCase, TAINT_DAYS, proposeParcel, acceptProposal } from '../sim/shady.js';
import { h, money, date, dialog, toast, dec } from './dom.js';
import { flagEl } from './flags.js';
import { showScene, scenesOn } from './scenes.js';
import { concealEl } from './shiproles.js';
import { hasEquip, equipOff } from '../sim/equipment.js';

// Le risque, dit par l'équipage : avis général, arrondi, ou précis selon son expérience.
export function riskWords(p, crewLevel) {
  if (crewLevel >= 2) return `${dec(p * 100, p < 0.1 ? 1 : 0)} %`;
  if (crewLevel === 1) return `≈ ${dec(Math.max(5, Math.round(p * 20) * 5))} %`;
  return p < 0.1 ? 'faible' : p < 0.2 ? 'réel' : 'élevé';
}
const levelClass = (p) => (p >= 0.2 ? 'neg' : p >= 0.1 ? 'warn-text' : '');
export const customsWord = (flag) => { const c = customsLevel(flag); return c >= 0.3 ? 'stricte' : c >= 0.2 ? 'sérieuse' : c >= 0.12 ? 'moyenne' : 'laxiste'; };

// Tampon « Embargo » à côté du nom d'un navire marqué (un an après un commerce sous embargo), et lui seul.
export function embargoStamp(state, ship) {
  const taint = taintActive(state, ship);
  if (!taint) return null;
  return h('span.embargo-stamp', { title: `Marqué par l'embargo jusqu'au ${date(taint.t + TAINT_DAYS * 24, true)} : risque d'amende à chaque escale dans un pays qui applique les sanctions.` }, 'Embargo');
}

// Lignes de risque (colis caché à bord, navire marqué par un embargo) pour un départ vers `to`.
// `general` : dire aussi le marquage quand la destination n'applique pas les sanctions (fiche du navire).
export function shadyLines(state, ship, to, { general = true } = {}) {
  const out = [];
  if (ship.contraband && to) {
    const p = detectionChance(ship, to, homeOf(state, ship));
    const dest = ship.contraband.to === to;
    out.push(h(`div.risk-line.${levelClass(p) || 'x'}`, `📦 Colis caché à bord${dest ? ' (livraison ici)' : ` (pour ${portName(ship.contraband.to)})`} : risque de fouille à ${portName(to)} ${riskWords(p, ship.crew || 0)}. Si la douane le trouve : amende de ${money(seizureFine(ship.contraband.pay))} et 10 à 25 jours d'immobilisation${corruption(PORTS[to].flag) > 0.15 ? ' (un arrangement sera peut-être possible)' : ''}.`));
  }
  // Navire marqué par un embargo : dit en permanence sur sa fiche, avec la date de fin (règle n° 1).
  const taint = taintActive(state, ship);
  if (taint) {
    const r = to ? sanctionRisk(state, ship, to) : null;
    const where = `⚖ Le ${ship.name} a commercé avec un pays sous embargo (${FLAGS[PORTS[taint.port].flag].name}, le ${date(taint.t, true)}) : sanctionnable jusqu'au ${date(taint.t + TAINT_DAYS * 24, true)}.`;
    if (r) out.push(h('div.risk-line.warn-text', [h('span', where), ' ', h('span', `${FLAGS[PORTS[to].flag].name} applique les sanctions : risque d'amende ${riskWords(r.odds, 2)} (${money(r.fine)}).`)]));
    if (r && beaconIdle(ship)) out.push(beaconHint());
    else if (general) {
      const p = sanctionPreview(state, ship, 0);
      out.push(h('div.risk-line.warn-text', [h('span', where), ' ', h('span', `Chaque escale en Europe, en Amérique du Nord, au Japon, en Corée ou en Océanie : risque d'amende ${riskWords(p.odds, 2)} (${money(p.fine)}).`)]));
    }
  }
  if (ship.contraband && to && beaconIdle(ship) && !(taint && sanctionRisk(state, ship, to))) out.push(beaconHint());
  if (to) {
    if (isEmbargoed(to)) out.push(h('div.risk-line.warn-text', `⚖ ${FLAGS[PORTS[to].flag].name} est sous embargo : y commercer marquera le navire pendant ${Math.round(TAINT_DAYS / 30)} mois. Pendant ce temps, chaque escale en Europe, en Amérique du Nord, au Japon, en Corée ou en Océanie peut coûter une amende.`));
  }
  return out;
}

// Transpondeur « discret » installé mais coupé : le rappeler quand il servirait (règle n° 1 : le joueur
// sait ce qu'il peut faire contre le risque).
const beaconIdle = (ship) => hasEquip(ship, 'brouilleur') && equipOff(ship, 'brouilleur');
const beaconHint = () => h('div.risk-line', '📡 Le transpondeur « discret » est coupé. Allumé (onglet Équipement), il rend les amendes et les contrôles en mer plus rares, mais augmente le risque d\'abordage.');

// Propositions discrètes du port (onglet Contrats).
export function offersSection(app, ship) {
  const { state } = app;
  const here = ship.port;
  if (!SHADY_PORTS.includes(here)) return null;
  const offers = (state.offers || []).filter((o) => o.from === here);
  const box = h('div');
  box.append(h('h3', '🤫 Propositions discrètes'));
  box.append(h('p.hint', 'Un intermédiaire cherche un navire pour un petit colis, à cacher à bord en plus de votre cargaison. Payé en liquide à la livraison. Les cargos le cachent bien mieux que les pétroliers ; un équipage aguerri est plus discret.'));
  box.append(concealEl(ship));
  if (ship.contraband) { box.append(h('p.muted', `Un colis est déjà caché à bord (pour ${portName(ship.contraband.to)}).`)); return box; }
  if (!offers.length) { box.append(h('p.muted', 'Personne ne vous a approché aujourd\'hui.')); return box; }
  for (const o of offers) {
    const p = detectionChance(ship, o.to, homeOf(state, ship));
    box.append(h('div.card', [
      h('div.card-main', [
        h('div.card-title', ['📦 Colis pour ', flagEl(PORTS[o.to].flag), ` ${portName(o.to)}`, h('span.tag', `douane ${customsWord(PORTS[o.to].flag)}`)]),
        h('div.card-sub', `À livrer avant le ${date(o.deadline, true)}. Risque de fouille à l'arrivée : `),
        h('div.card-sub', [h('b', { class: levelClass(p) }, riskWords(p, ship.crew || 0)), ` (et à chaque escale en route). Si la douane le trouve : amende de ${money(seizureFine(o.pay))}, navire immobilisé 10 à 25 jours, vertu entachée.`]),
      ]),
      h('div.card-side', [h('div.price', money(o.pay)), h('button.btn.small', { onclick: () => app.act(() => acceptOffer(state, ship.id, o.id)) }, 'Accepter')]),
    ]));
  }
  return box;
}

// Fiche du port : douane, corruption, embargo.
export function portShadyInfo(id) {
  const P = PORTS[id], F = FLAGS[P.flag];
  const lines = [];
  if (EMBARGOED[P.flag]) lines.push(h('p.warn-text', `⚖ Pays sous embargo (${EMBARGOED[P.flag].why}) : ses importations se paient cher, son brut est bradé et le fret y est mieux payé, mais un navire qui y commerce risque des amendes pendant un an dans les pays qui appliquent les sanctions.`));
  if (ENFORCING.has(P.flag)) lines.push(h('p.hint', `${F.name} applique les sanctions : un navire passé par un pays sous embargo dans l'année peut y être mis à l'amende.`));
  lines.push(h('p.hint', `Douane ${customsWord(P.flag)}${corruption(P.flag) > 0.15 ? ', fonctionnaires réputés accommodants' : ''}.${SHADY_PORTS.includes(id) ? ' Des intermédiaires y proposent des colis discrets.' : ''}`));
  return lines;
}

// Proposition spontanée d'un colis, juste après avoir accepté un contrat. Refuser fait
// parfois doubler l'offre. « Ne plus me proposer » se réactive dans le menu.
export async function maybeProposeParcel(app, ship, to) {
  const { state, ctx } = app;
  if (state.settings.noParcelOffers || !ship || ship.contraband) return;
  const o = app.withRng((rng) => proposeParcel(state, ctx, rng, ship, to));
  if (!o) return;
  const ask = async (offer, insisting) => {
    const p = detectionChance(ship, offer.to, homeOf(state, ship));
    const title = insisting ? 'Il insiste' : 'Une proposition discrète';
    const body = h('div', [
      h('p', insisting
        ? `L'intermédiaire revient à la charge : il double la mise, ${money(offer.pay)} en liquide pour le même colis.`
        : `Sur le quai, un intermédiaire vous aborde : un petit colis à glisser dans la cargaison du ${ship.name}, pour ${portName(offer.to)}, payé ${money(offer.pay)} en liquide à la livraison (avant le ${date(offer.deadline, true)}).`),
      h('p', [`Risque de fouille à l'arrivée : `, h('b', { class: levelClass(p) }, riskWords(p, ship.crew || 0)), ` (et à chaque escale en route). Si la douane le trouve : amende de ${money(seizureFine(offer.pay))}, 10 à 25 jours d'immobilisation, vertu entachée.`]),
      concealEl(ship),
    ]);
    const buttons = [
      ...(insisting ? [] : [{ label: 'Ne plus me proposer', value: 'jamais', kind: 'ghost' }]),
      { label: 'Refuser', value: 'non', kind: 'ghost' },
      { label: `Accepter (${money(offer.pay)})`, value: 'oui', kind: 'primary' },
    ];
    // Avec les illustrations : la scène de l'homme au manteau sur le quai.
    if (scenesOn()) return showScene(app, 'offer', { title, content: body, buttons, clickClose: false, variant: insisting ? 'insist' : null, color: state.companies[ship.owner]?.color });
    return dialog({ title, body, buttons });
  };
  let choice = await ask(o, false);
  if (choice === 'jamais') { state.settings.noParcelOffers = true; toast('Plus de propositions spontanées (réactivables dans le menu).', { timeout: 4000 }); return; }
  if (choice !== 'oui' && o.insist) {
    o.pay *= 2;
    choice = await ask(o, true);
  }
  if (choice === 'oui') {
    const r = app.act(() => acceptProposal(state, ship.id, o));
    if (r?.ok) toast(`Colis caché à bord du ${ship.name}.`, { timeout: 3000 });
  }
}

// Décision après une saisie : payer l'amende ou tenter un arrangement.
export async function openCase(app, caseId) {
  const { state } = app;
  const c = (state.cases || []).find((x) => x.id === caseId);
  if (!c) return;
  const ship = state.ships.find((s) => s.id === c.shipId);
  const choice = await dialog({
    title: 'La douane a trouvé le colis',
    body: h('div', [
      h('p', `À ${portName(c.port)}, les douaniers ont découvert le colis caché à bord du ${ship?.name || 'navire'}.`),
      h('p', `Amende : ${money(c.fine)}, et ${c.days} jours d'immobilisation.`),
      h('p', `Un douanier laisse entendre qu'un arrangement est possible pour ${money(c.bribe)}. Chance que ça marche : ${Math.round(c.chance * 100)} %. En cas d'échec : amende et immobilisation majorées de moitié, en plus de la somme versée.`),
    ]),
    buttons: [
      { label: `Payer l'amende (${money(c.fine)})`, value: 'payer', kind: 'ghost' },
      { label: `Tenter l'arrangement (${money(c.bribe)})`, value: 'soudoyer', kind: 'primary' },
    ],
  });
  if (!choice) return;
  const r = app.act(() => app.withRng((rng) => resolveCase(state, rng, caseId, choice)), { sound: 'pay' });
  if (r?.ok && choice === 'soudoyer') toast(r.bribed ? 'L\'arrangement a fonctionné : le navire repart.' : 'Le douanier a refusé : amende et immobilisation majorées.');
}
