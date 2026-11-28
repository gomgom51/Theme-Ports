# 11 · Grey and black trade, gangs, blacklist

Files: `sim/shady.js` (embargo, parcels, customs), `sim/dark.js` (gangs, dark jobs, seizures,
aftermath, charity), `sim/shadow.js` (blacklist), `sim/patrols.js`, `data/sanctions.js`,
UI: `ui/shady.js`, `ui/dark.js`. Intended strength (CLAUDE.md): small general cargo ships are the
best tools for grey and black trade (`CONCEALMENT`, `darkCapable`).

## Grey: embargo trade and sanctions

- Trading with an embargoed country (buy, sell, contract from/to, cargo loan from its lenders) calls
  `taintShip`: `ship.taint = {t, port, value}` (value accumulates) for `TAINT_DAYS` 365. Also counts
  toward the "Briseur d'embargo" misdeed and marks a dirty act (`onDirty`).
  A marked ship wears a red EMBARGO stamp next to its name (ship sheet header, fleet list;
  `embargoStamp` in `ui/shady.js`, tooltip with the end date); unmarked ships never show it.
- Why do it: embargoed ports pay imports ×1.08, sell exports ×0.95 (thin markets move fast),
  freight ×1.25, generous cargo loans (LTV 0.9 at 30 %), dark jobs, oil contracts during the refinery crisis.
- Arriving in an **enforcing** port with active taint: 35 % (`SANCTION_ODDS` × equip `sanction`, the
  transponder halves it) → fine `clamp(25 % × taint value, 500 k, 12 M)` (× 0.7 if the company's
  flag is not enforcing), virtue −8, stain, taint cleared, AI avoids embargo for a year.
  `sanctionPreview` / `sanctionRisk` show odds and fine before trading and before departure.

## Black: discreet parcels

- Offers in each `SHADY_PORTS` port (≤ 2, ≤ 3 at a company's shadow home), 40 %/day when empty,
  15 % otherwise; destinations weighted toward strict customs. Pay
  `120 k + 3.2 M × customs^1.5 × U(0.7, 1.3) + 150 k × nm/5000`; deadline `days × 1.6 + 6`; offer
  expires in 5–14 days. A hidden `nature` (60 % nothing, else fake notes, drugs, arms, medicines).
- Spontaneous proposal when accepting a contract: 35 % in shady ports, 15 % in corrupt ports, 4 %
  elsewhere; same destination; 30 % "insist".
- At **every** arrival with a parcel (`contrabandOnArrival`):
  `detectionChance = customsLevel(flag) × concealFactor(ship) × (own shadow home ? 0.3 : 1)`, with
  `concealFactor = CONCEALMENT[type] × crewDiscretion × equip conceal × skillConceal`; a rival's tip-off
  raises it to ≥ 0.8. The player sees `concealFactor` as a 5-step scale (`concealLevel`, steps 0.3 / 0.5 /
  0.7 / 1.0: voyant … insoupçonnable) with its sources (hull, hiding places, crew, smuggling rank) on every
  parcel offer, spontaneous proposal and dark job (`concealEl` in `ui/shiproles.js`); the broker shows the
  hull's level as a pro.
  - Found → fine `max(500 k, 3 × pay)`, ship held 10–25 days, virtue −15, stain. In a corrupt port
    (corruption > 0.15) a human chooses: pay, or **bribe** (35 % of the fine, success = corruption
    level; success: virtue −2, out in 12 h; failure: fine ×1.5, 1.5× days, virtue −5 more).
  - At destination → paid in cash (`discret` book), "Le passeur" counter, shadow lender quota,
    gangs' trust +1 at the origin port if it is a dark port, possible aftermath news (70 % if not "nothing").
  - Late → parcel thrown overboard, no pay.
- Patrols at sea (see [09](09-sea-risks.md)). Jettison is always possible (clears a tip-off).

## Gangs and dark jobs (`dark.js`)

- Dark ports = embargoed ∩ shady: bandar_abbas, puerto_la_cruz, novorossiysk, nampo.
- Gangs' trust `company.trust[port]` +1 per parcel delivered *from* that port; shadow home starts at 2.
- After unloading in a dark port with empty holds, a dark-capable ship (divers/conteneurs) with trust
  ≥ `DARK.trust` (2) gets an offer 60 % of the time, at most every 25 days per port.

| Kind | Pay | Infamy | Destinations |
|---|---|---|---|
| armes (militia weapons) | 3–6 M$ + 0.5 M per 5 000 nm | +15 | conflict ports (djibouti, luanda, lagos, karachi, …) |
| drogue (industrial drugs) | 5–10 M$ + … | +15 | rich ports (rotterdam, le_havre, new_york, …) |
| migrants (people smuggling) | 2–4.5 M$ + … | +20 | marseille, algesiras, genes, piree, mersin, constanta, new_york |

- **Accept**: whole hold taken (`ship.dark`), infamy added at once (caps drop), `crossed = true`.
  Detection at each call = `min(0.9, detectionChance × 1.7)`. Caught → infamy +10, virtue −25, fine
  50 % of pay, ship **confiscated by justice** (bail `max(1 M, 60 % value)` or abandon). Delivered →
  cash, "Le couteau" counter, dark country recorded for the shadow victory, aftermath news (always).
  Late → no pay and a grudge at the origin.
- **Refuse**: grudge at that port for 150 days, and 30 % chance the gang seizes the ship (55 %) or
  its crew (45 %) on the spot — except at your own shadow home (no grudge, no seizure).
- **Grudge**: each call at that port → 30 % seizure. Shown on the map; AI avoids those ports.
- **Seizure choice** (rule 2, `resolveSeized`): pay ransom (ship `max(500 k, 35 % value)`, crew
  `150 k + 120 k × crew level`, justice bail as above; freed in 2–5 / 10–20 days) or abandon (ship
  lost; abandoning a crew hires a new level-0 crew for 60 k$, XP lost; both cost virtue −8 for gangs).
- Before any dark job that would cross the blacklist line (including the +10 if caught), the player
  is warned (`crossesLine`).

## Aftermath news

`scheduleAftermath`: 5–18 days after delivery a generic news item ("combats", "overdoses", "drame de
migrants", fake notes, counterfeit medicines…) in that city; humans get a note linking it to their
delivery. Never names real groups (store policy: people smuggling, not trafficking).

## Infamy and the blacklist (`shadow.js`)

- Infamy only grows (dark jobs, caught cargo, takeover inheritance). Both reputation caps =
  `min(100 − min(80, infamy), 95 + deeds)`.
- Warning at `BLACKLIST.warn` 60. At 80 → **blacklisted forever**: ships cannot enter enforcing
  ports (planning and contracts refuse), bank = shadow bank (credit ×0.5, rate +15 points), but in
  shady ports shippers ignore reputation (the shadow network). Can only buy other blacklisted
  companies; clean buyers can only buy it to dismantle it at 2× net worth (`TAKEOVER.dismantleK`).
- Shadow-fleet victory: see [15](15-victories-honours.md).
- Misdeed "Ennemi public numéro un": first company blacklisted.

## Shady-deal hub

Plots (pirates, corrupt officials, sabotage) are sold by « La Mafia » (EN "the underworld") and can only be
ordered with a ship in a shady port — see
[14](14-rivalry-takeovers.md).
