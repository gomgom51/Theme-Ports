// Équipements des navires : installation au chantier, effets sur la simulation.
import { EQUIPMENT } from '../data/equipment.js';
import { SHIP_TYPES } from '../data/ships.js';
import { PORTS } from '../data/ports.js';
import { money, shipById, companyOf, shipLog, portName } from './core.js';

const fail = (msg) => ({ ok: false, msg });
export const hasEquip = (ship, id) => !!ship?.equipment?.includes(id);
// Produit des multiplicateurs d'un effet sur tous les équipements installés.
export function equipMod(ship, key) {
  let m = 1;
  for (const id of ship?.equipment || []) m *= EQUIPMENT[id]?.mods?.[key] ?? 1;
  return m;
}
// Points de défense contre un abordage : équipements, plus un peu pour un équipage aguerri.
export function defence(ship) {
  let d = (ship.crew || 0) * 0.5;
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

export function installEquipment(state, shipId, id) {
  const ship = shipById(state, shipId);
  const E = EQUIPMENT[id];
  if (!ship || !E) return fail('Équipement inconnu.');
  if (ship.status !== 'port' || ship.busyWhat) return fail('Le navire doit être à quai et inoccupé.');
  if (!PORTS[ship.port].repair) return fail(`Pas de chantier à ${portName(ship.port)} pour l'installer.`);
  if (hasEquip(ship, id)) return fail('Déjà installé.');
  if (!canEquip(ship, id)) return fail('Inutile sur ce type de navire.');
  const company = companyOf(state, ship);
  const price = equipPrice(ship, id);
  if (price > company.cash) return fail(`Il faut ${(price / 1e6).toFixed(2).replace('.', ',')} M$.`);
  money(state, company, -price, 'reparations');
  ship.spent += price;
  (ship.equipment ??= []).push(id);
  ship.busyWhat = 'installation';
  ship.busyUntil = state.t + E.hours;
  shipLog(state, ship, `Installation : ${E.name.toLowerCase()}`);
  return { ok: true, price };
}
export function removeEquipment(state, shipId, id) {
  const ship = shipById(state, shipId);
  if (!ship || !hasEquip(ship, id)) return fail('Rien à retirer.');
  if (ship.status === 'sea') return fail('Impossible en mer.');
  ship.equipment = ship.equipment.filter((x) => x !== id);
  shipLog(state, ship, `Retiré : ${EQUIPMENT[id].name.toLowerCase()}`);
  return { ok: true };
}
