// Assurance de la compagnie : une formule au choix, une prime journalière par navire.
// Quelle que soit la formule, l'assureur ne paie rien pour un navire parti en mauvais
// état (moins de SEAWORTHY %).
import { shipValue } from './economy.js';

export const SEAWORTHY = 40;
export const PLANS = {
  complete: {
    name: 'Formule complète', rate: 0.012, hull: 0.8, pi: true, cargo: 0.7,
    blurb: 'Coque remboursée à 80 %, responsabilité civile (réclamations des chargeurs, pollution) avec une simple franchise, marchandises négociées remboursées à 70 %.',
  },
  coque: {
    name: 'Coque seule', rate: 0.006, hull: 0.6, pi: false, cargo: 0,
    blurb: 'Moitié prix : la coque est remboursée à 60 %, mais les réclamations des chargeurs et la pollution sont à vos frais.',
  },
  aucune: {
    name: 'Sans assurance', rate: 0, hull: 0, pi: false, cargo: 0,
    blurb: 'Aucune prime, aucun remboursement : chaque sinistre est entièrement pour vous.',
  },
};
export const PLAN_IDS = Object.keys(PLANS);
export const planOf = (company) => PLANS[company?.insurance || 'complete'];

// Ce que l'assurance couvre pour un navire, selon son état au départ.
export function coverage(company, startCond) {
  const P = planOf(company);
  const ok = startCond >= SEAWORTHY;
  return { plan: P, seaworthy: ok, hull: ok ? P.hull : 0, pi: ok && P.pi, cargo: ok ? P.cargo : 0 };
}
export function premiumPerDay(state, ship, company) {
  return (shipValue(state, ship) * planOf(company).rate) / 365;
}
export function fleetPremium(state, company, ships, planId) {
  return ships.reduce((s, sh) => s + shipValue(state, sh) * PLANS[planId].rate, 0);
}
