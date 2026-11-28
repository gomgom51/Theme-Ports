# 06 · Trading, city tenders, cargo loans

Files: `actions.quoteBuy/buyCargo/quoteSale/sellCargo/guaranteePrice`, `sim/trade.js`, `sim/intel.js`,
price model in [04](04-economy-market.md). UI: trade tab of `ui/panel-ship.js`, tender cards in `ui/opps.js`.
Quantity: one slider per good (`tradeSlider`), 100 t to a full hold (or the stock); the track shows how far cash,
a cargo loan (best of this port's merchants and the best destination's buyers) and the bank go, grey beyond
(Buy disabled with the reason). Profit at the best destination follows the slider; shortcuts Max in cash, Max
with a loan, Full hold; the last quantity per ship and good is remembered for the session (`app.form.tradeQty`).
After a purchase the panel jumps to the Appareiller tab with the destination chosen in the buy dialog
already set (still editable); while that screen stays open and no departure is given, the loading ship
counts as awaiting orders, so auto-pause time does not restart (`app.tradeHold` in `main.js`).

## Buying (`buyCargo(state, ctx, shipId, good, qty, finance?)`)

Conditions: ship ready in port; the port **exports** the good; no dark cargo; a hold fits and the
port handles it; holds empty or same good (top-up, not on a financed cargo). Qty capped by free
dwt and `availableStock`. Price = `quoteTrade(buy)` (market impact included) × (1 − family discount
5 % at a family home) + handling cost. Effects: `applyTrade` (price up, stock down), cash out
(`achats`), cargo `{good, qty, hold, cost, boughtAt, loan}`, embargo taint (port, and lender port if
embargoed), loading time.

## Selling (`quoteSale` → `sellCargo`)

Sound quantity = qty × (1 − damage). If the port has an open **tender** for that good, the tender
part (`tenderShare`) is paid at the tender price, the rest at market (`quoteTrade(sell)`). Old
saves: guaranteed floor. Net = total − handling. Loan repaid from the proceeds (interest, plus 4 %
fee if sold elsewhere than the promised destination). Effects: `applyTrade`, cash (`negoce`),
tender delivery (trust + clean-goods virtue), loan settled (lender track record +1 if no fee),
embargo taint, honours `onTradeSale`, oil virtue loss, unloading time.

Taint on embargo trade happens on buy, on sell, and on contract load/delivery.

## City tenders (`TENDER`, `tradeDaily`)

- 14 %/day chance of a new one (≤ 4 open). Random port, not embargoed, not seasonal; good = one it
  imports that some non-embargoed port exports; no oil during the refinery crisis.
- Unit price = sell price × `clamp(1 + spread × U(0.6, 1.2), 1.04, 1.3)` (premium follows each good's
  natural spread — the CLAUDE.md lesson about machines/manufactures).
- Qty = lot × U(0.8, 2.0), clamp 3 000–150 000 t; duration 24–42 days. Announced in news and to humans.
- **First come, first served**: deliveries reduce `left`. A ship **commits** as soon as its
  departure toward the tender port with that good is decided (even queued behind loading:
  `commitOnDeparture` in `depart` and `launch`), announced with its ETA. `tenderRoom(t, shipId)` =
  left − every *other* ship's commitment (own fleet included), so two ships don't chase the same lot.
  Commitments are dropped daily if the ship no longer heads there with the good.
- Closed tenders stay visible 5 days.

## Cargo loans (`FINANCE`)

The cargo is the collateral. Lender = origin port traders (`source: 'origin'`) or destination buyers
(`source: 'dest'`, more and cheaper, against the promise to sell there).

| Profile (`financeProfile`) | when | LTV | rate | min trust |
|---|---|---|---|---|
| `etabli` | size ≥ 4 | 0.55 | 7 % | 40 |
| `standard` | other | 0.65 | 12 % | 20 |
| `louche` | shady port | 0.75 | 19 % | 0 |
| `embargo` | embargoed flag | 0.90 | 30 % | 0 |

```
ltv  = clamp((profile.ltv + dest 0.15 + track × 0.03) × clamp(0.75 + trust/200, 0.75, 1.15), 0.2, 0.95)
rate = max(3 %, profile.rate − dest 0.03 − track × 0.005)      track = loans repaid to that port (≤ 5)
exposure cap: total owed on cargo ≤ max(3 M$, 50 % × net worth)  → financedShare (refused under 10 %)
owed(t) = amount × (1 + rate × max(1, days)/365)                 (simple interest)
```

- Term 60 days. Unsold at term → becomes bank debt + 5 % fee (`loansDaily`, warned 7 days before).
- Ship lost (sunk, seized, abandoned) → the loan becomes bank debt (`removeShip`).
- Borrowing from an embargoed port's lenders taints the ship.
- Cargo loans subtract from net worth and from net cash (takeovers).
- AI weighs financed plans with `AI_CAPITAL_COST` (40 %/yr opportunity cost on locked cash).

## Intel estimates (`sim/intel.js`)

One estimator shared by the Vieux briscards advice, the Set sail list (veteran crew) and, later, opportunity cards,
so the numbers agree. Costs as a voyage estimate (fuel, port and canal fees, fixed costs over sea and handling time),
distances from the tables (`legEstimate`). A ship is free where it is, or at its arrival port (`freeAt`).
- `contractOffers(state, ctx, ship)`: every contract it can reach and take (`checkContract` at the loading port),
  empty run there included, not expired on arrival, not late; sorted by profit per day.
- `bestSources(state, ctx, cid, good, port, n, { ship, arrival })` → `{ port, ship, unit, sell, toSource, days, qty,
  marginPerT, profit, perDay }`, closest first: where to buy a good to deliver to `port` (its tender price if any).
  Without `ship`, the company's closest empty ship for each source.
- `bestOutlets(state, ctx, ship, good, qty, n, { arrival })` → `{ port, unit, days, net, perDay, tender }`.
- `tenderLeads`, `bestOpportunity` (contract, tender, trade from here; by profit per day).
`arrival: false` reads today's prices and a tender's full remaining quantity; `arrival: true` (rank 3) reads prices
expected on arrival (`quoteTradeAt`) and the room left after other ships' commitments (`tenderRoom`).

## Price guarantee (legacy)

`guaranteePrice`: premium `clamp(0.6 × vol × √days, 1 %, 5 %)`, floor at a port until days × 1.5 + 5.
Still honoured by `quoteSale` for old saves.

## Design notes (CLAUDE.md)

Plain arbitrage barely pays at a realistic budget outside embargoed countries; trade lives on
tenders and loans; no guaranteed price; estimates must use arrival prices (`quoteTradeAt`).
