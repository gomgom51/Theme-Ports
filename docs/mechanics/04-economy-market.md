# 04 · Economy and market

File: `web/js/sim/economy.js` (unless noted). Goods data: `web/js/data/goods.js`.

## Goods (`GOODS`)

17 goods with `price` ($/t), `holds`, `spread` (natural exporter/importer gap), `vol` (daily world
volatility), `depth` (t that moves a big port's price ~10 %), `lot` (typical cargo size), optional
`hazard`, `pollution` (1 = crude; ☣ polluting if ≥ 0.2), `perishable`.

| Group | Goods |
|---|---|
| Dry bulk (vrac) | cereales, minerai, charbon, engrais (☣ 0.25), acier and bois also fit divers |
| Liquid | brut (☣ 1), raffines (☣ 0.7) — `OIL_GOODS` |
| Gas / chem | chimie (☣ 1.3, chimique), gpl, gnl |
| General / boxes | manufactures, machines, cafe_cacao (conteneurs or divers) |
| Special | vehicules, fruits (frigo, perishable), colis (lourd) |

Lists: `FOSSIL_GOODS` (brut, raffines, charbon, gpl, gnl), `USEFUL_GOODS` (cereales, cafe_cacao,
fruits, bois → virtue), `OIL_GOODS` (virtue loss per delivery, refinery crisis), `isCleanGood` = not
fossil and pollution < 0.2.

## World prices and cycle (`dailyMarketUpdate`)

- `market.world[g]`: log-mean-reverting (half-life ~180 d), shock `vol × z`, clamp 0.45–2.6;
  brut/raffines share a common oil shock.
- `market.cycle`: global freight cycle, `cycle −= cycle/400; += CYCLE.sd × z`, clamp ±`CYCLE.max`
  (0.3; events can push to ±0.45).
- `market.freight[hold]` for the 10 `HOLD_TYPES`: mean-reverts (90 d) toward `FREIGHT_NORMAL × e^cycle`,
  noise 1.3 %/day, clamp `FREIGHT_MIN 0.6 … FREIGHT_MAX 2.6`.
- `market.shipIndex`: follows `(avgFreight/normal)^0.9` (75 d), clamp 0.5–1.8 → used and new ship prices.
- `market.fuelPremium` (0.8–1.4, 40 d), `market.repairLoad` (0.8–1.4, 60 d).
- Per port and good: `ou` (transient local deviation, 20 d, ±0.3), `imp` (impact of recent trades,
  decays ~12 d, clamp −0.5…0.9), `stock` (exporters: `+production` per day up to `stockCap = 40 days`).

`production(p,g) = exp[g] × size/5 × depth/25` t/day.

## Local prices

```
role(p,g)   = imp[g] − exp[g]                       (+ importer, − exporter)
goodSpread  = liquids: spread × 0.74 ; others: 0.12 + 0.5 × (spread − 0.12)   (compressed)
basePrice   = price × world × (1 + role × goodSpread × SPREAD/2) × (1 + ou) × embargoFactor
midPrice    = basePrice × (1 + imp);  buy = mid × 1.01, sell = mid × 0.99   (BID_ASK)
embargoFactor (embargoed flag): importer ×1.08, exporter ×0.95
depth(p,g)  = depth × (0.2 + 0.16 size) × roleFactor × (embargoed ? 0.15 : 1)
quoteTrade: price moves by delta = ±qty × 0.1 / depth; average fill = base × (1 + imp + delta/2)
quoteTradeAt(…, days): same but ou, imp and world deviation decayed for the trip length (used for honest
              arrival estimates by AI and the UI "best outlet")
applyTrade: imp += delta; stock −= qty on buy
availableStock: exporters only, floor to 100 t
HANDLING_COST $/t (paid by the trader on buy and sell): vrac 3, liquide 1.5, divers 12, conteneurs 10,
              chimique 4, gpl 3, gnl 2.5, vehicules 35, frigo 18, lourd 60
```

## Fuel and repairs

- `worldFuelPrice = 620 × world.raffines × fuelPremium`; `fuelPrice(port) = world × PORTS.fuel × (1 + ou(raffines) × 0.4)`.
- `repairIndex = (0.65 + 0.35 × world.acier) × repairLoad`.
- `repairCost(state, ship, port, target)`: to = min(target, `REPAIR_MAX[repair]` = 70/100/100);
  cost = points × price × 1e6 × 0.0011 × (1 + (100−cond)/120) × `REPAIR_FACTOR` (1.25/1.0/0.85) × repairIndex;
  days = points × 0.12 (× 0.8 at a big yard).

## Ship value and running costs

```
shipValue = max(scrap, sound − 0.8 × repairsTo90)
  sound   = price × 1e6 × max(0.06, (1 − age/life)^AGING.dep(0.75)) × shipIndex
  scrap   = price × 1e6 × 0.04 × shipIndex
newShipPrice(type, flag) = price × 1e6 × √shipIndex × (1 − subsidy)    (× yard factor)
burnPerDay  = burn × (speed/serviceSpeed)^3 × (1 + 0.006 age)          (× equipment 'burn')
crewDayCost = crew × 140 × FLAGS.crew × CREW_LEVELS.wage
opexDay     = opex × (1 + AGING.opex(0.015) × age)
laid up: opex × 0.3 + crew × 0.2
portFee     = (5000 + gt) × PORTS.fees        canalFee = gt × CANAL_FEE {suez 12, panama 10, nsr 8}
wearPerHour = 0.0025 × (1 + age/15) condition points at sea
upkeepPerSeaDay = wear × 24 × price × 1e6 × 0.0011 × 1.17 × repairIndex   (estimate only)
```

Used ship sale = `shipValue × 0.95`; bank seizure = × 0.75.

## Handling time

`handlingRate = HANDLING[hold] × size^0.8 × max(1, qty/20000)^0.6` t/day; `handlingHours ≥ 6`.
Loading/unloading is lengthened by strikes (`startBusy` waits for the strike end) and shortened by
logistics skill (−8 %/rank).

## Voyage estimate

`voyageEstimate({typeId, flag, from, to, qty, hold, speed, nm, canals, age})` → sea days, port days,
fuel t and cost (at origin price), fixed costs, fees (destination port + canals), upkeep, total.
Used by contract pricing (reference ship, 8 years old), AI trip costs, aid contracts, UI.

## Knobs

`BALLAST`, `BALLAST_HOLD`, `FREIGHT_NORMAL/MIN/MAX`, `SPREAD`, `CYCLE`, `AGING`, `AI_FLEET`,
`BID_ASK`, `FUEL_BASE`, `CANAL_FEE`, `HANDLING`, `HANDLING_COST`, `GOLDEN_CHANCE`; mirrored in
`TUNING` (tests mutate `TUNING`, so code reads `TUNING.spread`, `TUNING.ballast`, etc.).
