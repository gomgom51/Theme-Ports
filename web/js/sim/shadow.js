// La flotte fantôme : la liste noire internationale.
//  Quand l'infamie (affaires noires) atteint son maximum, la compagnie entre sur la liste noire,
//  pour toujours : ses navires ne peuvent plus entrer dans les ports des pays qui appliquent
//  les sanctions (ils y seraient saisis), les banques régulières ferment la porte (seule une
//  « banque de l'ombre » prête encore, chèrement et moins), et les bons chargeurs se détournent
//  (réputation plafonnée au plus bas). Prévenu à 60 d'infamie, et avant chaque affaire qui
//  ferait franchir la ligne (règle n° 1).
//  Victoire « La flotte fantôme » : des années sur la liste (VICTORY.shadowYears), une flotte, une affaire noire dans
//  chaque pays sous embargo (sim/victory.js).
import { PORTS } from '../data/ports.js';
import { ENFORCING } from '../data/sanctions.js';
import { news } from './core.js';
import { VICTORY } from './victory.js';

export const BLACKLIST = {
  infamy: 80,   // l'infamie maximale (le plafond de réputation tombe à 20)
  warn: 60,
  rate: 0.15,   // la banque de l'ombre : 15 points d'intérêt de plus
  credit: 0.5,  // et deux fois moins de crédit
};
export const isBlacklisted = (c) => !!c?.blacklisted;
// Ports fermés à une compagnie sur la liste noire : ceux des pays qui appliquent les sanctions.
export const closedPort = (company, port) => isBlacklisted(company) && ENFORCING.has(PORTS[port]?.flag);
// Cette infamie en plus ferait-elle franchir la ligne ?
export const crossesLine = (company, add) => !isBlacklisted(company) && (company.infamy || 0) + add >= BLACKLIST.infamy;

export function shadowDaily(state, notes) {
  for (const c of state.companies) {
    if (c.bankrupt) continue;
    const inf = c.infamy || 0;
    if (!c.blacklisted && inf >= BLACKLIST.infamy) {
      c.blacklisted = { t: state.t };
      news(state, `${c.name} est placée sur la liste noire internationale : ses navires n'entreront plus dans les ports des pays qui appliquent les sanctions.`, { company: c.id, kind: 'disaster' });
      if (c.human) notes.push({ kind: 'blacklisted', company: c.id, text: `${c.name} est sur la liste noire internationale, pour toujours. Vos navires n'entreront plus dans les ports d'Europe, d'Amérique du Nord, du Japon, de Corée et d'Océanie (ils y seraient saisis) ; les banques régulières ferment la porte (la banque de l'ombre prête deux fois moins, 15 points plus cher). La victoire « La flotte fantôme » vous tend les bras : tenez ${VICTORY.shadowYears} ans avec ${VICTORY.shadowShips} navires.` });
    } else if (!c.blacklisted && inf >= BLACKLIST.warn && !c.blacklistWarned) {
      c.blacklistWarned = true;
      if (c.human) notes.push({ kind: 'blacklistWarn', company: c.id, text: `Votre infamie atteint ${Math.round(inf)} : à ${BLACKLIST.infamy}, votre compagnie entrera sur la liste noire internationale, pour toujours (ports des pays qui appliquent les sanctions fermés, banques régulières fermées). Chaque affaire noire qui ferait franchir la ligne vous sera signalée avant.` });
    }
  }
}
