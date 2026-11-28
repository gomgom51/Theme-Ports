// Équipements des navires : installation au chantier, effets sur la simulation.
import { EQUIPMENT } from '../data/equipment.js';
import { SHIP_TYPES } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { money, shipById, companyOf, shipLog, portName } from './core.js';
import { skillDefence, crewFight } from './crew.js';

const fail = (msg) => ({ ok: false, msg });
export const hasEquip = (ship, id) => !!ship?.equipment?.includes(id);
// Équipement qu'on allume ou coupe à volonté (EQUIPMENT.switchable), même en mer : coupé, il n'a aucun effet.
export const equipOff = (ship, id) => !!ship?.equipOff?.includes(id);
export const equipActive = (ship, id) => hasEquip(ship, id) && !equipOff(ship, id);
// Produit des multiplicateurs d'un effet sur tous les équipements installés (et allumés).
export function equipMod(ship, key) {
  let m = 1;
  for (const id of ship?.equipment || []) if (!equipOff(ship, id)) m *= EQUIPMENT[id]?.mods?.[key] ?? 1;
  return m;
}
export function toggleEquipment(state, shipId, id) {
  const ship = shipById(state, shipId);
  if (!ship || !hasEquip(ship, id) || !EQUIPMENT[id]?.switchable) return fail('Rien à allumer ici.');
  const on = equipOff(ship, id);
  ship.equipOff = on ? ship.equipOff.filter((x) => x !== id) : [...(ship.equipOff || []), id];
  shipLog(state, ship, `${EQUIPMENT[id].name} : ${on ? 'en service' : 'coupé'}`);
  return { ok: true, on };
}
// Points de défense contre un abordage : équipements, plus un peu pour un équipage aguerri.
export function defence(ship) {
  let d = crewFight(ship) + skillDefence(ship); // l'équipage et ses combattants
  for (const id of ship.equipment || []) d += EQUIPMENT[id]?.defence || 0;
  return d;
}
export const hasCitadel = (ship) => (ship.equipment || []).some((id) => EQUIPMENT[id]?.citadel);
export function equipUpkeep(ship) {
  return (ship.equipment || []).reduce((s, id) => s + (EQUIPMENT[id]?.upkeep || 0), 0);
}
export function equipPrice(ship, id) { return Math.round(EQUIPMENT[id].price(SHIP_TYPES[ship.type]) / 1000) * 1000; }
export function canEquip(ship, id) {
  const E = EQUIPMENT[id];
  if (!E.holds) return true;
  return SHIP_TYPES[ship.type].holds.some((h) => E.holds.includes(h));
}

// File du chantier : pendant une installation, d'autres équipements s'ajoutent à la suite (payés tout de
// suite, posés l'un après l'autre). Le navire ne s'arrête qu'une fois, quand le dernier est posé.
// `ship.refit` : [{ id, start, until, price }], vidé à la fin des travaux.
export const refitQueue = (state, ship) => (ship?.busyWhat === 'installation' ? (ship.refit || []).filter((r) => r.until > state.t) : []);
// Pourquoi « Installer » est indisponible (null s'il est possible) : dit sur le bouton, jamais grisé sans raison.
export function installBlock(state, ship, id) {
  const P = PORTS[ship.port];
  if (ship.status !== 'port') return 'En mer : à installer au prochain port avec un chantier.';
  if (!P?.repair) return `Pas de chantier à ${portName(ship.port)} : il faut un port avec chantier naval.`;
  if (ship.busyWhat && ship.busyWhat !== 'installation') return `Le navire est occupé (${ship.busyWhat}) : possible dès qu'il sera libre.`;
  if (hasEquip(ship, id)) return 'Déjà installé.';
  if (!canEquip(ship, id)) return 'Inutile sur ce type de navire.';
  const price = equipPrice(ship, id);
  if (price > companyOf(state, ship).cash) return `Il faut ${(price / 1e6).toFixed(2).replace('.', ',')} M$ en caisse.`;
  return null;
}
export function installEquipment(state, shipId, id) {
  const ship = shipById(state, shipId);
  const E = EQUIPMENT[id];
  if (!ship || !E) return fail('Équipement inconnu.');
  const why = installBlock(state, ship, id);
  if (why) return fail(why);
  const company = companyOf(state, ship);
  const price = equipPrice(ship, id);
  money(state, company, -price, 'reparations', ship);
  (ship.equipment ??= []).push(id);
  const queued = ship.busyWhat === 'installation';
  if (!queued || !ship.refit) ship.refit = []; // (installation d'une ancienne sauvegarde : pas de file connue)
  const start = queued ? Math.max(state.t, ship.busyUntil) : state.t;
  ship.refit.push({ id, start, until: start + E.hours, price });
  ship.busyWhat = 'installation';
  ship.busyUntil = start + E.hours;
  shipLog(state, ship, queued ? `Installation ajoutée à la file du chantier : ${E.name.toLowerCase()}` : `Installation : ${E.name.toLowerCase()}`);
  return { ok: true, price, queued };
}
export function removeEquipment(state, shipId, id) {
  const ship = shipById(state, shipId);
  if (!ship || !hasEquip(ship, id)) return fail('Rien à retirer.');
  if (ship.status === 'sea') return fail('Impossible en mer.');
  // Encore dans la file, pas commencé : annulé et remboursé, les suivants avancent d'autant.
  const q = refitQueue(state, ship), k = q.findIndex((r) => r.id === id && r.start > state.t);
  if (k >= 0) {
    const r = q[k], hours = r.until - r.start;
    money(state, companyOf(state, ship), r.price, 'reparations', ship);
    ship.refit = ship.refit.filter((x) => x !== r);
    for (const x of ship.refit) if (x.start >= r.until) { x.start -= hours; x.until -= hours; }
    ship.busyUntil -= hours;
    ship.equipment = ship.equipment.filter((x) => x !== id);
    shipLog(state, ship, `Installation annulée et remboursée : ${EQUIPMENT[id].name.toLowerCase()}`);
    return { ok: true, refunded: r.price };
  }
  // En cours de pose : retiré sans remboursement, mais le chantier s'arrête là pour lui.
  const cur = q.find((r) => r.id === id && r.start <= state.t);
  if (cur) {
    const left = cur.until - state.t;
    ship.refit = ship.refit.filter((x) => x !== cur);
    for (const x of ship.refit) if (x.start >= cur.until) { x.start -= left; x.until -= left; }
    ship.busyUntil -= left;
  }
  ship.equipment = ship.equipment.filter((x) => x !== id);
  if (ship.equipOff) ship.equipOff = ship.equipOff.filter((x) => x !== id);
  shipLog(state, ship, `Retiré : ${EQUIPMENT[id].name.toLowerCase()}`);
  return { ok: true };
}
