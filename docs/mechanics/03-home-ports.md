# 03 · Home ports, flags and perks

Files: `web/js/sim/home.js` (`HOME`, `START_PORT`, perk functions), `actions.relocate`,
`game.newGame`, `ui/homebonus.js` (perk label/box), `ui/screens.js` (picker).

## Home port = flag

The home port fixes `company.flag` → tax, wages, subsidy, starting trust/virtue, bank rate,
embargo stance (see [02](02-ports-and-flags.md)). It also places the starting ships and the three
starter contracts (`startPort(home)`), and is drawn as a ring on the map (house pin for yours).

**Relocation** (`actions.relocate`): costs `250 000 + 40 000 × ships`; flag changes; trust and
virtue move 30 % toward the new flag's base (`rating×0.5+25`); caps re-applied. No other
restriction (an embargoed home port can be chosen; the AI cannot pick a seasonal home).

## Perk resolution

`portKind(port)` checks in this order (first match wins):
1. `'ombre'` — embargoed flag **and** in `SHADY_PORTS` → bandar_abbas, puerto_la_cruz, novorossiysk, nampo
2. `'place'` — `HOME.hubs` → rotterdam, dubai, singapour, shanghai, new_york, houston, los_angeles, hong_kong (the 8 size-5 ports)
3. `'hiver'` — `HOME.winter` → murmansk, valdez, ust_luga, gdansk, hambourg, sabetta, prudhoe_bay, nome, churchill
4. `'famille'` — `HOME.family` → buenos_aires, luanda, lagos, cartagena, veracruz, arzew, durban, richards_bay, djibouti

`homeKind(port)` = `portKind` unless `HOME.off` (test switch; AI leanings still follow `portKind`).
Overlaps resolved by order: hambourg is a winter port (not a hub, it is size 4); murmansk/ust_luga/
sabetta are winter even though embargoed (not shady, so not "ombre").

### 1. Shadow port (`ombre`) — toward the shadow-fleet victory

| Effect | Where |
|---|---|
| Gangs' trust at home starts at `DARK.trust` (2) → dark jobs offered from day one | `dark.trustAt` |
| Home customs × `HOME.customs` (0.3) for parcels and dark cargo | `shady.detectionChance` |
| Refusing a dark job at home: no grudge, no seizure | `dark.refuseDark` |
| Up to `HOME.parcels` (3) parcel offers at home (2 elsewhere) | `shady.refreshOffers` |
| Shadow lender available (all embargoed home ports, not only shadow) | see below |
| AI with this home gets the `ombre` leaning | `game.newGame` |

Handicaps kept: low starting trust/virtue (ratings 5–25), expensive bank, trading at home taints ships.

### 2. Financial hub (`place`) — toward "Seul maître à bord"

- `takeoverDiscount(buyer)` = `HOME.takeoverMax (0.25) × clamp((trust − 50)/50, 0, 1)` off any
  takeover price (0 % at trust 50, 25 % at 100). Applied in `takeover.takeoverPrice`.
- **Embargo rule** (`embargoPenalty`): a hub company buying a company based in an embargoed country
  pays a fine `max(5 M$, 50 % of price)` (`HOME.embargoFine*`), loses `HOME.embargoVirtue` (10)
  virtue, and is **expelled**: its head office and flag move to the bought company's port (trust/
  virtue blend 30 % toward the new flag). Warned in the confirmation and rival card. Non-hub buyers
  buy normally. AI does it only for its very last rival, or as a shadow AI (`aiTakeover`).
- AI with this home gets the `conquerant` leaning.

### 3. Winter port (`hiver`)

- `winterKit(company, ship)`: every ship bought (used or new build) gets the `glace` (ice class)
  equipment for free (`buyUsedShip`, `deliverOrder`).
- Seasonal home ports (sabetta, prudhoe_bay, nome, churchill), frozen at the January start, put the
  first ships and contracts at `START_PORT`: sabetta→murmansk, prudhoe_bay→valdez, nome→valdez,
  churchill→new_york. The AI never starts there.

### 4. Family first (`famille`) — flags that lost on every axis

- `familyContract(state, ctx, rng, ship)`: whenever a home company's ship is free at home with empty
  holds (on arrival, after any busy task, and daily in `homeDaily`), a contract fitting that ship is
  generated and reserved for `HOME.familyDays` (5) days, `minRep 0`. Only one open at a time per fit.
- `familyBlocked(state, company, port)`: the **biggest competitor by net worth** (recomputed daily
  into `state.familyRival[homeCompanyId]`) gets no contract (`checkContract`) and cannot prospect
  there or receive leads there (`prospect.js`). Shown on its screens.
- `familyDiscount`: goods bought at home cost 5 % less (`quoteBuy`).

## Shadow lender (embargoed home countries)

Files: `SHADOW_LENDER` in `core.js` (`rate 0.08, quota 2, days 180`), `setLender`, `lenderParcel`,
`homeDaily` in `home.js`; UI: Office → Finances (`panels.js`), alert in `alerts.js`.

- Opt-in (`setLender(state, company, on)`), only if the home port's flag is embargoed. The country's
  bank stays as the default (expensive `FLAGS.rate`).
- While "good", the base rate is 8 % instead of the flag rate (`interestRate` still adds the trust
  term and blacklist +15). Each delivered discreet parcel counts (`lenderParcel`, called from
  `contrabandOnArrival`). Every 180 days, if fewer than 2 parcels were delivered, the rate reverts to
  the flag rate until the quota is caught up; the counter resets at each due date.
- Alert 45 days ahead (important notifications). The `ombre` AI opts in automatically.
- Leaving an embargoed home removes the lender.

## Ports with no perk (36 of 66)

le_havre, marseille, piree, alexandrie, djeddah, ras_tanura, mumbai, busan, yokohama,
port_hedland, sydney, abidjan, santos, colon, vancouver, ras_laffan, tubarao, genes, algesiras,
mersin, constanta, mombasa, tema, karachi, colombo, port_klang, jakarta, manille, ho_chi_minh,
auckland, valparaiso, vladivostok, chittagong, jorf_lasfar, haifa, es_sider.

(Open design topic in project memory: whether to give these a rule. Note vladivostok is embargoed
but not shady, so it gets the embargo handicaps and the shadow lender but no shadow perk.)

## Interactions to keep in mind

- AI leaning assignment follows `portKind` even when `HOME.off`.
- The financial-hub discount reads **trust**, so reputation strategy and domination strategy overlap.
- Victory "domination" progress includes the embargo fine in the last rival's price (`victory.js`).
- A family-first company's biggest rival can change daily; the block follows it.
