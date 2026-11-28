// Interface des affaires noires (proposition, saisies) et lignes de risque associées.
// Tous les risques sont dits avant la décision : douane, confiscation, infamie, refus.
import { homeOf } from '../sim/home.js';
import { portName, shipById, repCap } from '../sim/core.js';
import * as eco from '../sim/economy.js';
import { DARK, DARK_KINDS, acceptDark, refuseDark, resolveSeized, darkDetect, grudgeAt } from '../sim/dark.js';
import { h, money, num, date, dialog, confirmBox, toast, pctOf } from './dom.js';
import { riskWords } from './shady.js';
import { crossesLine, BLACKLIST } from '../sim/shadow.js';
import { showScene, scenesOn } from './scenes.js';
import { concealEl } from './shiproles.js';


// Ce qu'il en coûterait si la douane trouvait la cargaison (même calcul que la simulation).
const bailOf = (state, ship) => Math.round(Math.max(1e6, eco.shipValue(state, ship) * 0.6) / 10000) * 10000;
const ransomOf = (state, ship) => [Math.round(Math.max(500000, eco.shipValue(state, ship) * 0.35) / 10000) * 10000, Math.round((150000 + 120000 * (ship.crew || 0)) / 10000) * 10000];

// Lignes de risque pour un navire (cargaison noire à bord) et une escale `to`.
export function darkLines(state, ship, to) {
  const out = [];
  const company = state.companies[ship.owner];
  if (ship.dark) {
    const K = DARK_KINDS[ship.dark.kind], here = to === ship.dark.to;
    const p = to ? darkDetect(ship, to, homeOf(state, ship)) : null;
    out.push(h(`div.risk-line.${p >= 0.2 ? 'neg' : 'warn-text'}`, [
      `${K.icon} Cargaison noire : ${K.name.toLowerCase()} pour ${portName(ship.dark.to)}, ${money(ship.dark.pay)} à la livraison avant le ${date(ship.dark.deadline, true)}.`,
      to ? (here ? ` Fouille à ${portName(to)}, port de livraison : risque ${riskWords(p, ship.crew || 0)}.` : ` Fouille à ${portName(to)} : risque ${riskWords(p, ship.crew || 0)}.`) : null,
      ` Si la douane la trouve : navire confisqué (caution ${money(bailOf(state, ship))}), amende de ${money(ship.dark.pay * 0.5)}, scandale (infamie +${DARK.caughtInfamy}, vertu −25).`,
    ]));
  }
  const g = to ? grudgeAt(state, company, to) : 0;
  if (g) out.push(h('div.risk-line.neg', `⚠ Un gang de ${portName(to)} en veut à votre compagnie jusqu'au ${date(g, true)} : à chaque escale, ${pctOf(DARK.grudgeSeize)} de risque qu'il s'empare du navire ou de l'équipage (rançon à payer).`));
  return out;
}

// La proposition : une scène, puis le choix. Fermer la fenêtre vaut refus.
export async function darkOfferDialog(app, note) {
  const { state } = app;
  const ship = shipById(state, note.shipId), o = note.offer;
  if (!ship || !o || ship.port !== o.from || ship.dark || ship.cargo) return;
  const company = state.companies[ship.owner];
  const K = DARK_KINDS[o.kind];
  if (scenesOn()) await showScene(app, 'offer', { title: 'Une « vraie » affaire', variant: 'dark', color: company.color, text: note.text });
  const p = darkDetect(ship, o.to, company.homePort);
  const cap = repCap({ infamy: (company.infamy || 0) + K.infamy });
  const [rShip, rCrew] = ransomOf(state, ship);
  const body = h('div', [
    h('p', [h('b', `${K.icon} ${K.name}`), ` — de ${portName(o.from)} à ${portName(o.to)} (${num(o.nm)} milles), avant le ${date(o.deadline, true)}.`]),
    h('p', ['Payé ', h('b.pos', money(o.pay)), ' en liquide à la livraison. La marchandise occupe toute la cale : pas d\'autre chargement pendant ce voyage.']),
    h('p.warn-text', `☠ Point de non-retour : infamie +${K.infamy}. Votre confiance et votre vertu ne pourront plus jamais dépasser ${cap}/100 (confiance aujourd'hui : ${Math.round(company.confidence ?? company.reputation)}). Moins de confiance : moins de bons contrats, des prêts plus chers.`),
    h('p', `Douane à l'arrivée : risque ${riskWords(p, ship.crew || 0)} à ${portName(o.to)}, et à chaque escale en route. Si elle trouve : navire confisqué (caution de ${money(bailOf(state, ship))} pour le récupérer, ou il est perdu), amende de ${money(o.pay * 0.5)}, équipage arrêté, scandale public (infamie +${DARK.caughtInfamy}, vertu −25).`),
    concealEl(ship),
    h('p', `En refusant : ${pctOf(DARK.refuseSeize)} de risque qu'ils s'emparent du navire (rançon ${money(rShip)}) ou de l'équipage (rançon ${money(rCrew)}), puis ce gang vous en voudra ${DARK.grudgeDays} jours (${pctOf(DARK.grudgeSeize)} de risque de saisie à chaque escale de vos navires à ${portName(o.from)}).`),
    crossesLine(company, K.infamy)
      ? h('p.warn-text', `⛔ Liste noire : cette affaire porterait votre infamie à ${Math.round((company.infamy || 0) + K.infamy)}. À ${BLACKLIST.infamy}, votre compagnie entre sur la liste noire internationale, pour toujours : ports d'Europe, d'Amérique du Nord, du Japon, de Corée et d'Océanie fermés (navires saisis), banques régulières fermées (la banque de l'ombre prête deux fois moins, 15 points plus cher), chargeurs honnêtes perdus. C'est aussi le chemin de la victoire « La flotte fantôme ».`)
      : crossesLine(company, K.infamy + DARK.caughtInfamy) ? h('p.warn-text', `⛔ Si la douane trouve la cargaison, l'infamie gagnerait encore ${DARK.caughtInfamy} points et ferait entrer votre compagnie sur la liste noire internationale (à ${BLACKLIST.infamy}).`) : null,
    h('p.hint', 'Fermer cette fenêtre revient à refuser.'),
  ]);
  const v = await dialog({ title: `${K.icon} ${K.name}`, body, wide: true, buttons: [{ label: 'Refuser', value: 'no', kind: 'ghost' }, { label: 'Accepter', value: 'yes', kind: 'danger' }] });
  if (v === 'yes') {
    if (!company.crossed && !(await confirmBox('Point de non-retour', 'Votre compagnie n\'aura plus jamais une réputation intacte. Accepter quand même ?', 'Accepter'))) return refuse(app, ship, o);
    if (crossesLine(company, K.infamy) && !(await confirmBox('Entrer sur la liste noire ?', 'Votre compagnie sera sur la liste noire internationale, pour toujours. Accepter quand même ?', 'Accepter'))) return refuse(app, ship, o);
    const r = app.act(() => acceptDark(state, ship.id, o), { sound: 'crates' });
    if (r?.ok) { toast(`Cargaison embarquée. Cap sur ${portName(o.to)} : personne ne doit savoir.`, { timeout: 6000 }); app.open('ship', ship.id, 'depart'); app.form.dest[ship.id] = o.to; app.refresh(); }
    return;
  }
  return refuse(app, ship, o);
}
function refuse(app, ship, o) {
  const r = app.act(() => app.withRng((rng) => refuseDark(app.state, rng, ship.id, o)));
  if (r?.ok && !r.seized) toast(`Vous refusez. On vous regarde partir sans un mot : ${portName(o.from)} ne vous oubliera pas.`, { kind: 'warn', timeout: 7000 });
  if (r?.seized) app.handleNotes([{ kind: 'seized', shipId: ship.id, company: ship.owner, seized: r.seized, text: r.seized.kind === 'ship' ? `Le refus ne passe pas : des hommes armés s'emparent du ${ship.name} et de son équipage. Ils réclament ${money(r.seized.ransom)}.` : `Le refus ne passe pas : des hommes armés enlèvent l'équipage du ${ship.name}. Ils réclament ${money(r.seized.ransom)}.` }]);
}

// Après une saisie : payer (rançon ou caution) ou abandonner.
export async function seizedDialog(app, shipId) {
  const { state, ctx } = app;
  const ship = shipById(state, shipId);
  const s = ship?.seized;
  if (!s) return;
  const justice = s.by === 'justice', crew = s.kind === 'crew';
  const text = justice
    ? `La justice de ${portName(s.port)} a confisqué le ${ship.name}. Payer la caution de ${money(s.ransom)} pour le récupérer (10 à 20 jours de procédure), ou l'abandonner : il est perdu.`
    : crew
      ? `L'équipage du ${ship.name} est aux mains d'un gang à ${portName(s.port)}. Payer ${money(s.ransom)} pour le libérer, ou l'abandonner : un nouvel équipage sera recruté (60 k$, une semaine), sans l'expérience ni les spécialités de l'ancien, et votre vertu en souffrira (−8).`
      : `Le ${ship.name} et son équipage sont aux mains d'un gang à ${portName(s.port)}. Payer ${money(s.ransom)} pour les libérer, ou les abandonner : le navire est perdu, et votre vertu en souffrira (−8).`;
  const v = await dialog({ title: justice ? 'Navire confisqué' : crew ? 'Équipage enlevé' : 'Navire aux mains d\'un gang', body: h('p', text), buttons: [
    { label: crew ? 'Abandonner l\'équipage' : 'Abandonner le navire', value: 'abandonner', kind: 'ghost' },
    { label: `${justice ? 'Payer la caution' : 'Payer la rançon'} (${money(s.ransom)})`, value: 'payer', kind: 'primary' },
  ] });
  if (!v) return;
  if (v === 'abandonner' && !crew && !(await confirmBox('Abandonner le navire ?', `Le ${ship.name} sera perdu pour de bon.`, 'Abandonner'))) return;
  app.act(() => app.withRng((rng) => resolveSeized(state, ctx, rng, shipId, v)), { sound: v === 'payer' ? 'pay' : null });
}
