# 10 · World events and disasters

Files: `sim/events.js` (`EVENTS`, `OIL_CRISIS`, `dailyEvents`), `dark.js` (`disaster`, `darkDaily`,
`CHARITY`), scenes in `ui/scenes-world.js`.

## Random world events (`dailyEvents`)

Chance 1/35 per day (≈ one every 5 weeks), weighted pick among possible events. **World memory**
(`EVENT_MEMORY`): an event does not come back within 180 days, and its opposites (`against`: oil up/down,
record harvest/drought, China stimulus/slowdown, container rush/overcapacity/recession/recovery) are
excluded for 120 days after it (`state.lastEvents`), so the news never says one thing and its contrary
weeks apart. The daily roll is unchanged, so the frequency stays the same. Ending events
(canal reopened, strike over, refinery crisis over) are announced. Events that tell a story with no end of
its own carry `after` (days, text): the close is posted to the news weeks later (`state.followUps`), and only
says what the market already does (prices and the fuel premium revert on their own): oil tension → calm (30–60 d),
refinery breakdown → restart (14–30 d), drought → rains (60–120 d), steel spike → settles (45–90 d). A Suez
closure keeps its cause (`canals.suez.why`) and reopens with the matching story (`SUEZ_CAUSES`). After an event freight is clamped
to `FREIGHT_MIN/MAX` and cycle to ±0.45. Each event returns a title/text for news and a scene id.

| id | weight | Effect |
|---|---|---|
| petrole_hausse | 3 | crude ×1.2–1.45, refined follows ×0.85 of the move |
| petrole_baisse | 3 | crude ×0.7–0.85 |
| raffinerie | 2 | fuel premium ×1.12–1.25 |
| crise_raffinage | 1.5 | **global refinery crisis** 14–28 days (`state.oilCrisis`), fuel ×1.08–1.15; removes every untaken oil contract outside embargoed countries; no new oil contracts or tenders outside embargoed countries until it ends (signed contracts honoured). Not while one is running. |
| recolte_record | 2 | cereals ×0.8–0.9, vrac freight ×1.1–1.22, cereal stocks ×1.5 |
| secheresse | 2 | cereals ×1.15–1.35, vrac freight ×0.88–0.95 |
| chine_relance | 2 | ore ×1.12–1.3, coal ×1.08–1.2, vrac freight ×1.12–1.3 |
| chine_ralenti | 2 | ore ×0.75–0.88, coal ×0.82–0.92, vrac freight ×0.8–0.9 |
| acier | 2 | steel ×1.15–1.3 (→ repair costs) |
| boom_conteneurs | 2 | container freight ×1.2–1.45, divers ×1.05–1.15 |
| recession | 1 | all freight ×0.8–0.9, cycle −0.15…−0.25, ship index ×0.9, manufactures/machines ×0.92 |
| surcapacite | 1 | cycle −0.15…−0.3, ship index ×0.93 |
| reprise | 1 | cycle +0.15…+0.3 |
| suez_ferme | 1 | Suez closed 6–28 days, liquid ×1.12, container ×1.1 freight |
| panama_secheresse | 1 | Panama draft limit 10.5–12 m for 30–90 days |
| greve | 2 | dock strike at a random port 4–14 days: loading/unloading wait for the end |

The refinery crisis was the owner's call to make tankers less of a safe default (CLAUDE.md); it is
shown in news, important notifications and the tankers' Contracts tab. The AI's virtuous leaning
also avoids oil (`VIRTUOUS_OIL_PENALTY`).

## Disasters and emergency aid (pro bono)

- `darkDaily`: a hurricane/typhoon/cyclone of force ≥ `CHARITY.stormForce` (11) within half its radius
  of a port, or a random disaster (1/70 per day) in one of `DISASTER_PORTS`, calls `disaster(port)`
  (cooldown 90 days per port). Each of those ports lists the disasters that fit it (no quake or landslide
  in the flat Ho Chi Minh City delta, floods only).
- Tropical storms (`recurve`) lose 1 force per day beyond 35° of latitude, down to 8 (`moveStorms`), so a
  typhoon no longer strikes Vladivostok as a disaster.
- 2–3 aid contracts to that port from size ≥ 3 non-ice ports within 4 500 nm, cereals /
  manufactures / refined, ships ≤ 60 000 dwt, **paid 45 % of cost**, urgent, `minRep 0`, expire in 6 days.
  Announced in news and as opportunity cards.
- On-time delivery: virtue +6 (`CHARITY.rep`), "Main tendue" deed counter, good press. Late: no virtue.
- AI: only the virtuous leaning values aid (rep × 300 k$ in its scoring).

## Aftermath news

See [11](11-grey-black-trade.md): days after a parcel or dark cargo is delivered, news may report
what it caused in that city.

## Consistency rules (keep the world believable)

Lessons from the five-persona playtest (2026-11-28). Check them when adding an event, a disaster, a text,
a warning or an opportunity card:

1. **The screen reads the simulation.** A risk, price or rule shown to the player comes from the same function
   the simulation uses (e.g. `refusalRisk` in `dark.js` for dark-job refusals), never from a copy of its constants
   and conditions. A home-port perk added to the simulation but not to the window made the game threaten a
   seizure that could not happen (rule 1).
2. **Events remember.** A new world event declares its opposites in `EVENT_MEMORY.against`. A text promises
   only what the simulation keeps ("for a long time" is fine for overcapacity: the cycle's half-life is ~9 months).
3. **Places fit.** A disaster belongs to its place (`DISASTER_PORTS` lists each port's own); tropical storms
   weaken outside the tropics; no aftermath news at isolated terminals with no town (`NO_TOWN` in `dark.js`:
   Sabetta, Prudhoe Bay, Nome, Churchill, Ras Laffan, Ras Tanura). Ship names follow the owner's language (or the
   broker's port for a listing), and AI companies left with a default name are named after their home city
   (`data/names.js`).
4. **Actors stay in character.** Who may do what is filtered where the actor is picked: image-minded shippers
   never touch sanctioned ports (`makeContract`). Each shady port has one invented gang, always the same
   (`GANGS` in `data/sanctions.js`, `gangName` in `dark.js`), named in offers, grudges, seizures and the news.
5. **Every story ends.** Anything that holds a ship, a port or a market (hijack, seizure, strike, canal closure,
   crisis, yard discount) announces its end in the news; a story event without one declares `after`.
6. **Alerts only when you can act.** A sound or toast for an opportunity only when one of your ships can use it
   (`goldenNear`, `tenderServable`); the rest goes to the news or quietly to the opportunities column.
