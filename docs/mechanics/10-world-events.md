# 10 · World events and disasters

Files: `sim/events.js` (`EVENTS`, `OIL_CRISIS`, `dailyEvents`), `dark.js` (`disaster`, `darkDaily`,
`CHARITY`), scenes in `ui/scenes-world.js`.

## Random world events (`dailyEvents`)

Chance 1/35 per day (≈ one every 5 weeks), weighted pick among possible events. Ending events
(canal reopened, strike over, refinery crisis over) are announced. After an event freight is clamped
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
  of a port, or a random quake/flood/landslide (1/70 per day) in one of `QUAKE_PORTS`, calls
  `disaster(port)` (cooldown 90 days per port).
- 2–3 aid contracts to that port from size ≥ 3 non-ice ports within 4 500 nm, cereals /
  manufactures / refined, ships ≤ 60 000 dwt, **paid 45 % of cost**, urgent, `minRep 0`, expire in 6 days.
  Announced in news and as opportunity cards.
- On-time delivery: virtue +6 (`CHARITY.rep`), "Main tendue" deed counter, good press. Late: no virtue.
- AI: only the virtuous leaning values aid (rep × 300 k$ in its scoring).

## Aftermath news

See [11](11-grey-black-trade.md): days after a parcel or dark cargo is delivered, news may report
what it caused in that city.
