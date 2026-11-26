# 12 · Finance, bank, books, net worth

Files: `sim/core.js` (`money`, books, `netWorth`, `creditLimit`, `interestRate`, `SHADOW_LENDER`),
`game.daily/monthly/checkBank`, `actions.borrow/repay`, `sim/home.js` (shadow lender),
`sim/trade.js` (cargo loans), UI Office → Finances (`ui/panels.js`), results `ui/shipresults.js`.

## Books (`BOOK_LABELS`)

`money(state, company, amount, category, ship?)` moves cash and records it in `month`, `total` and the
ship's own book. Categories: `fret, negoce, achats, carburant, equipage, exploitation (upkeep +
insurance), ports (fees, canals, escorts), reparations, sinistres (claims, fines, ransoms), discret
(parcels, dark jobs, bribes), interets, impots, rachats, divers`. Some flows bypass books on purpose
(ship purchase/sale, borrowing, loan principal).

## Net worth

```
netWorth = cash + fleetValue + cargoValue (traded cargo cost) + ordersValue (paid new builds)
         + pendingValue (payments to collect + receivables) − debt − cargoLoans
netCash  = cash − debt − cargoLoans            (takeovers are paid from this, never borrowed)
```

Net worth drives: office level (sticky), takeover price, cargo-loan cap, AI decisions, family-first
biggest rival, ranking at the end. History kept weekly (`recordHistory`).

## Bank

- **Credit limit** = `(0.6 × fleetValue + 25 000 × trust) × cut`; cut = rival's bank-pressure attack
  (×0.5 for 180 days) × blacklist (×0.5).
- **Interest rate** = base + `(100 − trust)/100 × 6 %` + blacklist 15 %. Base = `FLAGS[flag].rate`,
  or 8 % with a "good" shadow lender (see [03](03-home-ports.md)). Charged daily on debt.
- `borrow` up to the limit (rounded to 10 k); `repay` from cash.
- **Overdraft**: negative cash costs 20 %/yr daily.
- `checkBank` daily: limit = `300 000 + 10 % fleetValue`. Warning note at −300 k (with the limit).
  Below −limit → the bank seizes and sells the cheapest ship at 75 % of value (trust −6, −10 more
  if it carried a contract; stain). No ship left → **bankruptcy** (company eliminated; a rival that
  attacked it in the last year is credited as "fossoyeur").
- Cargo loans unpaid at 60 days or on a lost ship turn into debt.

## Taxes

Monthly, on positive profit of the month (sum of all books) × `FLAGS[flag].tax` (0 % AE/SG/PA …
21 % AR/CO).

## Costs paid automatically each day

Insurance premium (plan rate × ship value / 365), crew wages (+ guards' upkeep), opex (aged), laid-up
reductions — see [04](04-economy-market.md) and [09](09-sea-risks.md).

## Rival pressure on finance

`bank` attack halves the credit limit for 180 days (parry: switch bank). `payments` attack delays
a shipper's payments 40–75 days. See [14](14-rivalry-takeovers.md).
