# 15 · Levels, honours, victories

Files: `data/offices.js` (`OFFICE_TIERS`), `sim/victory.js` (`VICTORY`, `victoryProgress`,
`levelsDaily`, `victoryDaily`), `sim/honours.js` (`HONOURS`, `DEEDS`, `RECORDS`, `EVIL`, hooks),
UI: `ui/victory.js`, `ui/codex.js`, office art `ui/officepx.js` (pixel room behind the Office panel, `ui/officeroom.js`; `ui/officeart.js` keeps the vector office for the award and level-up scenes), trophies `ui/trophyart.js`,
scenes `ui/scenes-honours.js`.

## Office levels (company maturity)

| Level | Net worth | Name |
|---|---|---|
| 1 | 0 | Le cagibi du quai |
| 2 | 15 M$ | Le bureau sur le port |
| 3 | 35 M$ | Le siège de la compagnie |
| 4 | 100 M$ | L'étage de direction |
| 5 | 300 M$ | La tour de verre |

Sticky (`company.level` never goes down). Gates: takeovers (buy only your level or below), attack
`minLevel`, bank-pressure attack (target ≤ your level), reputation victory (level 4), prospecting
(+0.04 per level). A blacklisted company's office turns ostentatious (`paintOffice` option `shadow`).

## Deeds (badges, everyone can earn all 8)

Each of the first five raises both reputation caps by 1 (95 → 100) and both scores by 1.

| id | Name | Condition (`HONOURS`) |
|---|---|---|
| aide | Main tendue | 10 aid deliveries on time |
| sanstache | Sans tache | 540 days without stain, ≥ 12 ships, ≥ 150 deliveries in that period |
| fideles | Partenaires fidèles | 14 shippers at loyalty 10 at once |
| alerte | Lanceur d'alerte | 14 shippers denounced |
| mainspropres | Le Juste | 8 years without any dirty act, never any infamy |
| ecole | École de la mer | 16 ships with fully trained crews (6 points since the 6th XP step) |
| merspropres | Mers propres | 4 years without carrying polluting cargo, ≥ 100 deliveries |
| pirates | Corsaire | 12 pirate attacks repelled |

## Records (trophies, one holder; numbered ones can be beaten, "complete" ones stay with the first)

| id | Name | Threshold |
|---|---|---|
| armada | L'Armada | 26 ships (best fleet) |
| mois | Le mois du siècle | 1.1 Mt delivered in 30 days |
| tonnes | Le géant du fret | 45 Mt delivered in total |
| ponctuel | Réglé comme une horloge | 320 on-time deliveries in a row |
| equipages | Les loups de mer | 130 crew points in the fleet |
| produits (complete) | Tout ce qui flotte | 15 of 17 goods carried |
| ports (complete) | Toutes les escales | all 66 ports served |
| familles (complete) | La flotte complète | 7 of 10 ship families at once |

## Misdeeds (grim proofs, same rules)

couteau (30 dark jobs), passeur (60 parcels), embargo (300 M$ embargo trade), marionnettiste
(25 hostile moves), ennemi (first blacklisted, complete), fossoyeur (2 rivals bought or ruined).

Counters are updated by hooks: `onDelivered`, `onTradeSale`, `onEmbargoTrade`, `onStain`, `onDirty`,
`onAid`, `onDenounce`, `onRepelled`, `onSpill`, `onDarkDone`, `onParcel`, `onHostile`, `onEliminated`;
checked daily in `honoursDaily` (which also applies clean-conduct virtue).

## Victories (`VICTORY`)

| id | Name | Win when |
|---|---|---|
| domination | Seul maître à bord | every rival ruined or bought |
| reputation | La plus respectée | reputation 100 with ≥ 5 deeds and level 4, then held 180 days without falling below 95 (`repHold`) |
| legend | Compagnie légendaire | hold 5 of the 8 records at once |
| shadow | La flotte fantôme | 7 years on the blacklist, ≥ 16 ships, a dark job completed from each embargoed country (IR, VE, RU, KP) |

- Progress (`victoryProgress`) = mean of parts. Domination with one rival left = 50 % + half of the
  share of its takeover price (embargo fine included) you hold in net cash (capped 99 %); 0 if it is
  above your level.
- Alerts at 75 % and 90 % to every human (rule 1); the last rival gets its own wording. Everyone sees
  everyone's progress on the four medal buttons under the side rail (`.vic-rail`, `data-victory`; 🚩 domination,
  🌟 reputation, 🏆 legend, 🗡 shadow; `updateVictoryRail` in `main.js`, once per game day): a progress ring
  (halo at 75 %, breathing at 90 %) and a red dot when a rival reaches 75 % (beating at 90 %). A medal opens
  panel `victory` (`ui/victory.js`) with tab `course` plus, per path: domination → `concurrents` (takeovers,
  attacks, parries) and `classement`; reputation → `hauts-faits`; legend → `records`; shadow → `mefaits`.
- Victories can be switched off per game (`settings.victories`); the time limit decides otherwise
  (ranking by net worth). The first victory ends the game (`state.victoryClaimed`, `state.over`).

## Balance targets (CLAUDE.md)

Victory roughly around year 10, every path wins sometimes, none always. See the results history in
`CLAUDE.md` (`node tests/victories.test.mjs`).
