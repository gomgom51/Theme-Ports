# 09 · Sea risks: incidents, inspections, insurance, pollution, piracy, patrols, weather

Every major setback here is shown before departure (rule 1): `incidents.riskProfile/voyageRisk`,
`inspectionOdds`, `pollution.worstCase`, `piracy.piracyRisk`, `patrols.patrolRisk`,
`shady.sanctionRisk`. Precision of incident estimates depends on crew level (`ui/risk.js`); contract
facts (insurance threshold, strict ports) are always shown.

## Incidents (`sim/incidents.js`)

Per sea hour: `p = INCIDENT_BASE (0.0016/day)/24 × RISK.incidents × crew safety × wearRisk × weatherRisk × equipment share`

```
wearRisk(cond, age) = (1 + age/30) × (1 + ((100 − cond)/40)²)
weatherRisk(force)  = force ≥ 8 ? 1 + 0.9 × (force − 7) : 1
```

Kind weights: machine `4 + age/8`; fire 1 (×equip); collision 2.5 near coast / 0.4 (×equip);
grounding 2 near coast (×equip); leak `0.4 + 2.5 × ((100−cond)/100)²`; heavy weather 5 (laden, force ≥ 8);
reefer failure 2 (laden reefer). "Near coast" = within 150 nm of departure or arrival.

| Kind | Cost (× √(gt/5000)) | Condition | Delay | Cargo damage | Trust | Severe |
|---|---|---|---|---|---|---|
| machine | 20–60 k | 1–4 | 12–72 h | — | — | no |
| incendie | 80–300 k | 8–25 | 24–72 h | 10–40 % | — | yes |
| abordage | 100–500 k | 6–20 | 18–48 h | 0–20 % | −2 | yes |
| echouement | 50 k + 1.5–4 % of new price | 10–30 | 48–144 h | 0–25 % | −2 | yes |
| voie_eau | 40–150 k | 10–20 | 24–48 h | 10–30 % | — | yes |
| gros_temps | 10–40 k | 2–6 | — | 5–30 % | — | force ≥ 10 |
| froid | 15–50 k | 0–2 | — | 10–40 % | — | no |

Severe incidents with polluting cargo spill 1–8 % (grounding 3–15 %). Severe → sinking chance
`0.024 × RISK.sinking × crew safety × (1 + ((100−cond)/40)²) × (force ≥ 10 ? 2 : 1)` (fire × equip `fireSink`).

## Sinking (`game.sink`)

Spill of 40–100 % of cargo plus bunker fuel; hull insurance if seaworthy at departure; contract
cargo → shipper claims 25 % of cargo value (P&I pays all but a 50–300 k$ deductible if covered);
traded cargo refunded at the plan's cargo rate; trust −10 (contract) −5; wreck on the map; cargo loan
becomes debt; contract removed.

## Port-state inspection and detention

- Threshold `inspectionThreshold(age)` = 55 (62 if > 20 y). Above it: never inspected.
- Single-hull tankers (`singleHull`, vieux pétrolier) without a reinforced hull: at every strict-flag call, 49 %
  chance of a check (`HULL_CHECK`): fine `max(250 k, 12 × gt)`, doubled at Valdez, Le Havre and Yokohama, trust −3, stain; shown before the contract and the
  departure (`hullLine` in `ui/risk.js`).
- `inspect = min(0.95, RISK.inspections × (strict ? min(0.95, 0.3 + gap/50) : min(0.5, 0.06 + gap/150)) × inspectVirtueK)`;
  `detainIfInspected = clamp(gap/35, 0.08, 0.95)`. Strict flags: NL DE FR GR US CA JP AU KR SG.
  Image ports (NL DE FR CA AU SG JP) scale inspection by virtue (×1.3 at 0 … ×0.6 at 100).
- Detention: fine `(30–120 k) × √(gt/5000)`, forced repair to 65 % at the port yard ×1.25 (+48 h) or
  by a flown-in team (+8 points, ×2.2, max 50 %), trust −3, stain. The ship may be sold on the spot.
- Inspection with only remarks: no cost.

## Insurance (`sim/insurance.js`)

Company-wide plan (`company.insurance`), premium per ship per day = `shipValue × rate / 365`.

| Plan | rate/yr | hull | P&I (claims, pollution) | traded cargo |
|---|---|---|---|---|
| complete | 1.2 % | 80 % | yes (deductible) | 70 % |
| coque | 0.6 % | 60 % | no | 0 |
| aucune | 0 | 0 | no | 0 |

Nothing is paid if the ship left port below `SEAWORTHY` (40) condition.

## Pollution (`sim/pollution.js`, `data/zones.js`)

The 18 sensitive coasts are polygons (`poly`, or `polys` for a zone in several pieces: Tokyo Bay + Inland Sea,
San Andrés islands + Cartagena coast) drawn where the reefs, mangroves and fragile coasts really are; the map draws the
same outline smoothed (`MapView.zonePath`, flat green tint) and `zoneAt` tests the polygon, so the cleanup factor follows
the drawn shape (rule 1). `lon`/`lat` only place the name. They used to be circles (`r` in nm), whose drawn size was
wrong at high latitudes; the shapes cover less open sea and no inland, so a spill falls in a zone a little less often.

Pollution tonnes = cargo qty × `GOODS.pollution` × share × equip `spill` (+ 80 % of bunker fuel
when sinking). Ignored under 50 t. Cost = tonnes × 600 $ × factor (zone 1.5–5, near coast 0.6,
open sea 0.15). Insured (P&I, seaworthy): deductible `clamp(5 %, 100 k, 5 M)`; else up to
`1500 × gt × factor`. Virtue −(2 + liability/10 M$), max −20; stain; spill marker. Negligence
(unseaworthy) in a zone with factor ≥ 2 → that country bans the company's ships for 365 days
(`company.bans`, checked by `planVoyage` and `checkContract`).

## Piracy (`sim/piracy.js`)

Zones are polygons (`poly`, lon/lat) drawn where attacks really happen: the map draws the same outline, smoothed
(closed Catmull-Rom spline, flat red tint, solid edge), and `piracyZoneAt` tests a point against the polygon, so the
risk follows the drawn shape (rule 1). `lon`/`lat` only place the pirate flag. Zones: aden (rate 1.6 %/day,
strength 2–7), guinee (1.4 %, 3–8), malacca (0.33 %, 1–4), sulu (0.64 %, 2–5), venezuela (0.52 %, 1–4). The rates
were raised when the old circles became polygons so the average exposure over every port-to-port route stays the same
(the polygons are tighter: fewer miles inside); ports inside a zone did not change (Djibouti, Lagos, Tema, Singapore,
Port Klang, Puerto La Cruz). A rival's paid pirates multiply the rate ×4 and strength +1.5.

Three phases, each `p = clamp(0.2 + 0.18 × (def − att), 0.05, 0.95)`; the first success repels:
- approach: def `max(0, (speed − 13)/2.5) + navigation 0.7`, att `s/3`
- boarding: def `barbeles 1.6 + crew×0.5 + combat`, att `s/2.2`
- fight on board: def `gardes 4 + crew×0.5 + combat`, att `s/1.6`

Failure: with a citadel → looting (40–140 k × size, 3–12 % of general/box/reefer/vehicle cargo,
12–36 h); without → **hijack**: ransom `clamp(10 % ship value + 2 % cargo value, 150 k, 9 M)`, trust −3.
Choice (rule 2): pay (free in 3–7 days) or negotiate (55 %, 30–60 days, trust −3 more). AI pays.
Repelled attacks count for the "Corsaire" deed.

## Coastguard patrols (`sim/patrols.js`)

Only ships carrying a parcel. Zones: 200 nm around every enforcing-country port (rate 0.12/day) and
the Caribbean anti-drug zone (0.18/day); × equip `sanction`. Phases: evade
`clamp(0.12 + 0.05 × (speed − 14) + brouilleur 0.2, 0.05, 0.8)`, hidden
`clamp(1 − 0.75 × CONCEALMENT × crewDiscretion × conceal, 0.05, 0.9)`. Caught: fine `max(500 k, 3 × parcel pay)`,
virtue −15, ship stalled 10–25 days.

## Weather (`sim/events.js`)

10 storm zones with season, area, force, drift, radius, life, daily rate (winter Atlantic, North
Sea gales, hurricanes, typhoons, Bay of Bengal and South Indian cyclones, Roaring Forties, North
Pacific, Mistral, Cape storms). Storms drift hourly (tropical ones recurve). `weatherAt` gives the
Beaufort force at a point (4 by default; ramps up/down at the start and end of a storm's life).
Force affects speed, fuel, wear, cargo damage, incident rate, sinking. Hurricanes/typhoons/cyclones
of force ≥ 11 reaching a port trigger aid contracts ([10](10-world-events.md)).
