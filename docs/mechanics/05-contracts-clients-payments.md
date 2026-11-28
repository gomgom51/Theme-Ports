# 05 · Contracts, shippers, payments, prospecting

Files: `economy.makeContract/refreshContracts/latePenalty`, `actions.checkContract/acceptContract/
abandonContract`, `game.deliverContract`, `sim/clients.js`, `data/clients.js`, `sim/payments.js`,
`sim/prospect.js`, `home.familyContract`, `dark.charityContract`.

## Contract pool (`refreshContracts`, daily)

Per port, three categories with target open counts (`CONTRACT_DENSITY 0.75`):
- normal: `round((3 + 1.7 size) × 0.75)`
- regional (cabotage, ships ≤ 15 000 dwt, destination ≤ 3 200 nm): `round((1 + 0.7 size) × 0.75)`
- big (ships ≥ 50 000 dwt, only ports with ≥ 14 m somewhere): `round(0.6 size × 0.75)`

Missing slots are filled (each extra one at 60 % chance unless initial fill). Reserved offers
(loyal partner, family, prospect) are **extra**, not counted against the pool (CLAUDE.md lesson).
Expired untaken contracts are dropped. New golden deals are announced to humans: a card in the opportunities
column when one of their ships can take it in time (`goldenReach`), and a toast with a sound only when a free ship
(empty holds) is on site or less than a day away (`goldenNear`, `ui/opps.js`).

## `makeContract(state, ctx, rng, from, forType?, {regional, big})`

1. Seasonal origin must be ice-free for 4 more days.
2. Good: weighted by `exp` (and fitting the forced type / category).
3. Destination: importer of that good, seasonal ports only if open (for an ice-class ship),
   regional ≤ 3 200 nm.
4. Reference ship type: weight `exp(−ln(dwt/lot)²/3)` (big: weight = dwt); `qty = dwt × 0.5–0.97`.
5. Cost basis = cheapest **reference voyage** (8-year-old ship of any non-vintage type that fits)
   + origin port fee.
6. Pay:

```
pay = est.total × ballast × margin × riskPremium × urgent(1.18) × embargo(1.25)
      × reserved(1 + RESERVE_BONUS 0.04) × golden(1.6–2.2)
ballast     = BALLAST (1.8) + (BALLAST_HOLD[hold] − 1) × 1.5        (one-way trades pay more)
margin      = freight[hold]/FREIGHT_NORMAL × U(0.9, 1.12) × (dwt/12500)^0.05
riskPremium = 1 + (70 − clientRel)/300                              (unreliable shippers pay more)
ice contract (end of season, ice class only) × ICE.iceContract (1.3)
```

7. Deadline = `est.days × (urgent 1.12 | 1.35) + 3` days; expiry 4–12 days (golden 2–4).
8. `minSpeed`: containers and reefer need ≥ 90 % of the reference ship's speed.
9. `minRep` (trust required) = `clamp((margin − 0.96) × 117 + (pay > 1.5 M$ ? 15) + (urgent ? 5), 0, 75)`.
10. `clientRep` = shipper's own demand: reliability ≥ 85 → 50, ≥ 75 → 40, else 0 (loyal partners exempt).
11. Refinery crisis: oil contracts return null unless embargoed (see [10](10-world-events.md)).

Other contract sources: starter contracts (newGame, `minRep 0`), `familyContract`, prospect
`tailored` contracts, charity (aid) contracts.

## Accepting (`checkContract` → `acceptContract`)

Refusals in order: taken; wrong port; **family block**; holds not empty / dark cargo; hold/terminal
mismatch; capacity; **pollution ban** of destination flag; **blacklist** closed port; min speed;
draft at destination; end-of-season ice needs ice class; shipper grudge (denounced); reserved for
someone else; shipper requirement (`clientRep`, unless loyal or blacklisted in a shady port);
**trust** < `minRep` (waived for blacklisted companies in shady ports); deadline passed.

The "réservé pour vous" tag explains its origin (`reservedTip` in `ui/panel-ship.js`): a loyal shipper (freight
+`RESERVE_BONUS`), a prospecting lead (`c.prospect`, freight × `PROSPECT.pay`) or a family-first contract (`c.family`,
no trust requirement).

On accept: price war cut (×0.8 if a rival's `pricewar` targets you in that port), image shipper
factor (`imageFactor`, fixed at signing), golden-taken note, cargo loaded (taints if embargoed),
loading time, departure queued.

Abandoning in port: 25 % of pay penalty, trust −8.

## Delivery (`deliverContract`, after unloading)

```
late penalty = min(60 %, 3 %/day late)
perishables late: damage += 4 %/day late
invoiced pay = pay × (1 − penalty) × (1 − min(0.85, damage × 1.15))
```

Then: payment created (collected later), embargo taint on destination, trust (on time:
`+1.5 × (1 − trust/110)`; late `−(2 + 10 × penalty)`; damage `−8 × damage`), useful-good virtue,
clean golden-deal virtue, oil virtue loss, charity virtue, shipper loyalty (`noteDelivery`),
honours (`onDelivered`).

## Shippers (`data/clients.js`, `sim/clients.js`)

30 fictional shippers: `goods`, `reliability` (fixed nature), `style` (ponctuel, lent, pinailleur,
fragile), `image` (6 image-minded: beauce, gulfcrest, hansa, rheinwerk, lebrun, coastal). Image-minded
shippers never ship from or to an embargoed port (`makeContract`).

- Live reliability `state.clients[id].rel` drifts back to nature (1/240 per day); −10 on a client
  bankruptcy (out 60–120 days: no new contracts); −`DENOUNCE_HIT` when denounced
  (faillite 12, contestation 10, differe 4); floor 15.
- Loyalty per company 0–10: +1 per clean delivery, −1 late, −2 damaged; +2 if you stay discreet
  after an incident; −1/month after 60 days without work. `LOYAL = 4` (exempt from `clientRep`,
  can be poached, can order "payments" attack), `RESERVE_LOYALTY = 6`.
- **Reservation** (`reserveFor`): 25 % of a shipper's new contracts in a port go first, for 3 days
  and +4 % pay, to its most loyal partner (≥ 6) with a ship there or bound there.
- **Image pay** (`imageFactor`): image shippers pay −6 % at virtue 0 … +12 % at 100 (1 at 50).
- After a bad payment event the company chooses: **denounce** (virtue +2, deed counter,
  shipper loses reliability, loyalty 0, grudge 120 days) or **stay discreet** (loyalty +2,
  gratitude chance `GRATITUDE[style] + 0.03 × loyalty` → goodwill payment in 30–90 days).
  AI: vertueux denounces often; others only with no tie (`AI_DENOUNCE`).

## Payment resolution (`payments.js`)

`createPayment` at delivery; humans press "Encaisser" (`collect`), AI collects at once.
`resolution` draws once: lateness line (softened by `negociation` skill −12 %/rank), early-delivery
bonus (2–5 %), damage reserves, fuel surcharge if fuel rose > 10 %, then **one** event from
`paymentRisk` (same odds shown on the contract):

```
bankrupt = max(0, (45 − R)/350) × (fragile 1.6)         → only 20–50 % paid, client goes down
dispute  = max(0.02, 0.03 + (100−R)/450 + (60−trust)/700) × (pinailleur 1.8) × (1 − 0.05 L)
defer    = (0.04 + (100−R)/600) × (lent 2) × (1 − 0.04 L)  → paid in 15–45 days (receivable)
stalled by a rival's "payments" attack                     → paid in 40–75 days
market move > 5 %: 25 % chance of renegotiation (−6 % max) or bonus (+5 % max)
```

Dispute: accept the 5–20 % withholding, or **contest** (fees 3 %, win odds `arbitrationOdds` =
`0.45 + trust/250 − R/500`, trust ±1, paid in 20–40 days). The receipt shows the odds as precisely as the
delivering ship's crew can tell (`payment.crew`: good/average/low, ≈ rounded to 10 %, exact). Charity payments never have events.
Pending payments and receivables count in net worth.

## Prospecting (`prospect.js`)

Ship idle in port with empty holds, once per call: 24–48 h. Odds
`0.1 + 0.06 size + (trust−50)×0.004 + 0.03 × best local loyalty + 0.04 × level + 0.05 × negociation rank`,
clamp 0.08–0.85; blocked at a rival's family port. Success: 35 % (or always, if nothing loads
here) a **lead** at a port ≤ 1 800 nm, reserved until arrival + 3 days; otherwise a tailored contract
here reserved 2 days. Tailored = `makeContract` for the ship type (vintage → nearest modern proxy),
qty capped to 95 % dwt, pay × 0.95, `minRep 0`, the best-known shipper. AI prospects with 25 % chance.
