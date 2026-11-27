# 07 · Ships, fleet, crew, equipment

Files: `data/ships.js` (`SHIP_TYPES`, `CREW_LEVELS`, `CREW_DAY_COST`, `SHIP_NAMES`),
`game.refreshUsedMarket/makeListing/deliverOrder`, `actions.buyUsedShip/orderNewShip/sellShip/
layUp/reactivate/setCrew/repair/renameShip`, `sim/crew.js`, `sim/equipment.js`, `data/equipment.js`,
`data/sanctions.js` (`CONCEALMENT`). Ship sheet UI: `ui/panel-ship.js`, radar card `ui/radar.js`, pros and
cons `ui/shiproles.js`.

## The 22 models

| id | Name | dwt | holds | speed/max | burn | draft | crew | opex | price M$ | life | gt | vintage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| caboteur | Caboteur | 6000 | divers,vrac | 11.5/12.5 | 8.5 | 6.5 | 9 | 2200 | 8 | 30 | 3000 |  |
| cargo_ancien | Vieux cargo | 9000 | divers,vrac | 12/13.5 | 15 | 8.2 | 18 | 1900 | 12 | 45 | 7000 | yes |
| polyvalent | Cargo polyvalent | 12500 | divers,vrac,conteneurs | 14/15.5 | 20 | 8.6 | 14 | 4000 | 26 | 28 | 9000 |  |
| colis_lourds | Navire colis lourds | 14000 | lourd,divers,conteneurs | 15/16.5 | 26 | 8.5 | 18 | 5200 | 38 | 25 | 12000 |  |
| vraquier_handy | Vraquier Handysize | 35000 | vrac | 13.5/14.5 | 24 | 10.2 | 19 | 4200 | 27 | 28 | 21000 |  |
| vraquier_supramax | Vraquier Supramax | 58000 | vrac | 14/15 | 30 | 12.8 | 21 | 5000 | 32 | 28 | 32000 |  |
| vraquier_panamax | Vraquier Panamax | 82000 | vrac | 14/14.8 | 34 | 14.4 | 22 | 5600 | 36 | 28 | 43000 |  |
| vraquier_capesize | Vraquier Capesize | 180000 | vrac | 14/14.8 | 52 | 18.2 | 24 | 7500 | 52 | 27 | 93000 |  |
| petrolier_ancien | Vieux pétrolier | 32000 | liquide | 14.5/15.5 | 30 | 11.2 | 26 | 3900 | 35 | 45 | 20000 | yes |
| petrolier_mr | Pétrolier de produits (MR) | 48000 | liquide | 14/15 | 30 | 12.2 | 22 | 5600 | 36 | 25 | 29000 |  |
| chimiquier | Chimiquier | 19000 | chimique,liquide | 14.5/15.5 | 24 | 9.8 | 22 | 6200 | 32 | 25 | 13000 |  |
| petrolier_aframax | Pétrolier Aframax | 110000 | liquide | 14.5/15.3 | 48 | 15 | 24 | 7800 | 62 | 25 | 62000 |  |
| petrolier_suezmax | Pétrolier Suezmax | 158000 | liquide | 14.8/15.6 | 58 | 17 | 25 | 8600 | 78 | 25 | 81000 |  |
| petrolier_vlcc | Superpétrolier (VLCC) | 300000 | liquide | 15/16 | 80 | 21.5 | 28 | 10500 | 120 | 25 | 160000 |  |
| petrolier_ulcc | Géant des mers (ULCC) | 440000 | liquide | 15.5/16.3 | 88 | 24 | 30 | 12000 | 115 | 25 | 234000 |  |
| gazier | Gazier (GPL) | 30000 | gpl | 16/17 | 36 | 11 | 24 | 7200 | 58 | 25 | 26000 |  |
| methanier | Méthanier (GNL) | 75000 | gnl | 19/20 | 110 | 11.8 | 30 | 13000 | 185 | 30 | 110000 |  |
| feeder | Porte-conteneurs feeder | 22000 | conteneurs | 18/20 | 46 | 10 | 17 | 4600 | 26 | 25 | 18000 |  |
| pc_panamax | Porte-conteneurs Panamax | 55000 | conteneurs | 21/23 | 110 | 13.5 | 22 | 9000 | 75 | 25 | 52000 |  |
| pc_geant | Porte-conteneurs géant | 200000 | conteneurs | 22/23.5 | 190 | 16 | 26 | 18000 | 180 | 25 | 220000 |  |
| porte_voitures | Transporteur de voitures | 21000 | vehicules | 19/20.5 | 65 | 10 | 22 | 8500 | 85 | 25 | 70000 |  |
| frigorifique | Navire frigorifique | 12000 | frigo | 20/22 | 45 | 9.5 | 20 | 7000 | 40 | 25 | 11000 |  |

Other fields: `idleBurn`, `tank`, `category`, `blurb`. `vintage` models are never built, only sold
used (26–42 years old) and are never contract reference ships. `gear` = ship cranes (faster handling in
small ports, see [04](04-economy-market.md)). `singleHull` (vieux pétrolier): at every call in one of the 18
strict-flag ports (`STRICT_FLAGS`) without `double_coque`, 49 % chance of a check: fine `max(250 k, 12 × gt)` (doubled in
the three cleanest strict ports, on the most sensitive coasts: Valdez, Le Havre, Yokohama) and trust −3, like a detention (`HULL_CHECK`, `hullRisk`, `hullCheck` in `incidents.js`). Shown on the broker card, the
contract card and the departure risks; the AI simply avoids strict ports with such a ship. `stock`: equipment delivered with every new or used ship
(`createShip`): the small general cargo ships get the transponder, switched off. `CONCEALMENT` (parcel hiding, lower
is better): small general cargo ships 0.45–0.6 … gas carriers 1.3–1.35 → general cargo ships are the
intended grey/black-trade tool. `darkCapable`: only ships with `divers` or `conteneurs` holds.

## Used market (broker, `state.used`)

- Refreshed weekly; size ≥ 16 + companies. Type weight `price^-0.3` (vintage 0.7): more small ships.
  Port: any non-seasonal port serving the type. Age 2…life−4 (vintage 26–42), condition 45–96
  (vintage 35–72). Price = `shipValue × U(0.92, 1.08)`, listing lasts 20–45 days.
- At game start each (start) home port gets a tired `caboteur` (22–26 y) and either a 1960s
  `cargo_ancien` (25 %), an old `petrolier_mr` (if the port has liquid terminals, 20 %), or a
  `polyvalent` — about 2.3 M$ and 4.5 M$.
- Buying: pay listing price, ship appears in that port; winter-port perk adds ice class; rivals
  notified (≤ once a month for used ships).

## Broker cards (`ui/panels.js`, `ui/shiproles.js`)

Each card (used and new) and each ship sheet lists the model's pros (+) and cons (−) as scales, no figures
(`SHIP_ROLES`); every graded scale in the game (discretion, shipper loyalty, crew skill ranks) uses the same
rising-bars icon (`ui/grade.js`), plus lines built from the data so they stay true: ship cranes, single hull (until a reinforced
hull is fitted), transponder included, hull discretion level ≥ 3, and "over twenty years" on old used listings.
The mini radar is a button opening the big sheet (labelled radar, pros/cons, specs), where a dashed outline can
compare with the same model new (used listings) or with one of the player's own ships (`compareSets`).

## New builds (`YARDS`, `orderNewShip`)

Price = `newShipPrice × yard factor` (flag `subsidy` off; e.g. CN 12 %, KR 10 %, JP 8 %). Paid up
front, delivered after the yard delay with 60 % fuel; counts in net worth as `ordersValue` meanwhile.

## Selling, lay-up, reactivation

- Sell in port or laid up: `shipValue × 0.95`. A **detained** ship can be sold on the spot (unused
  share of the forced repair refunded) — rule 2.
- Lay up (empty holds): status `laidup`, crew × 0.2, opex × 0.3, no insurance change.
- Reactivate: `20 000 + 3 × opex`, 48 h `réarmement`.

## Condition and repair

Condition 0–100 falls at sea (`wearPerHour`, storms ≥ force 9, incidents, sabotage). Effects:
incidents (`wearRisk`), sinking, speed below 50 %, inspections (threshold 55, or 62 if > 20 y),
insurance void below `SEAWORTHY` 40 at departure, value. Repair at a yard (`repairCost`, see [04](04-economy-market.md)).

## Crew levels (`CREW_LEVELS`)

| Level | wage | safety (incidents, sinking) | info (risk display) |
|---|---|---|---|
| 0 de base | ×1 | ×1 | qualitative |
| 1 confirmé | ×1.35 | ×0.85 | ranges |
| 2 chevronné | ×1.8 | ×0.7 | exact figures per voyage |

Upgrading costs a hiring bonus = 30 days of the wage difference. Crew level also adds 0.5 piracy
defence per level, discretion (`crewDiscretion` 1 / 0.9 / 0.8 on customs and patrols), XP speed
(`learnRate = 1 + 0.25 level`), crew ransom size.

## Crew experience and skills (`sim/crew.js`)

XP = days at sea × learnRate; points at `XP_STEPS` 60, 150, 270, 420, 600 days (5 points, max rank 3
per skill). Player assigns; AI auto-assigns by ship family (`aiPriority`).

| Skill | Effect per rank |
|---|---|
| combat | +0.6 piracy defence (boarding and fight) |
| entretien | wear −6 % |
| mecanique | speed +1.5 % at the same setting |
| contrebande | customs detection −12 % |
| logistique | loading/unloading −8 % |
| negociation | penalties, reserves, withholding, renegotiation −12 % at collection; +0.05 prospecting |

Crew XP is lost if the crew is abandoned to kidnappers or poached by the `crew` attack (−1 point).
Fully trained crews feed the "École de la mer" deed and "Les loups de mer" record.

## Equipment (`data/equipment.js`, installed at a yard)

| id | Effect | Price | Upkeep/day |
|---|---|---|---|
| barbeles | +1.6 boarding defence | 30 k + 0.6 gt | — |
| gardes | +4 on-board fight defence | 50 k | 2 600 |
| citadelle | hijack becomes looting | 120 k + 1.2 gt | — |
| navigation | collision ×0.6, grounding ×0.55, +0.7 approach defence | 90 k + 1.4 gt | — |
| incendie | fire ×0.6, fire sinking ×0.5 | 60 k + gt | — |
| double_coque | spill ×0.4 (tankers, chem, gas only) | 20 × gt | — |
| cachettes | parcel detection ×0.55 | 70 k | — |
| economiseur | fuel ×0.92 | 3.5 % of new price | — |
| brouilleur | sanctions/patrol odds ×0.5, collision ×1.3, patrol evasion +0.2; switchable | 25 k (free on caboteur, vieux cargo, polyvalent) | — |
| glace (ice class) | +21 days each end of ice season, escort at 40 %, fuel ×1.03 | 150 k + 9 gt | — |

`equipMod(ship, key)` multiplies the `mods` of all installed items that are switched on. A `switchable` item
(transponder) is switched on or off anywhere, even at sea (`toggleEquipment`, `ship.equipOff`): off, it has no
effect at all. When a tainted ship heads for an enforcing port, or a parcel is on board, with the transponder off,
the departure risks remind the player. Removal is free (not at sea).
AI installs barbeles (cash > 3 M$), citadelle (> 8 M$), cachettes (shadow AI).
