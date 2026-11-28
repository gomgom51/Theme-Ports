# 14 · Rivalry: shady deals, attacks, takeovers

Files: `sim/plots.js` (plots, attacks, intel, AI), `sim/takeover.js` (takeovers, bids, AI),
UI: `ui/plots.js` (shady deals, sold by « La Mafia », EN "the underworld": shady middlemen at the bottom of a
shady port's sheet), `ui/rivals.js` (domination medal 🚩 under the side rail → Rivals tab). Every move against a rival is announced to the
victim as a rumour with what threatens it, until when, and how to parry (rule 1).

## Shady deals (`orderPlot`, ordered from a ship docked in a shady port)

| Kind | Price | Duration | Effect | Exposure risk | Scandal |
|---|---|---|---|---|---|
| pirates (zone) | 500/700/900 k by zone level | 60 d | attacks ×4 and +1.5 strength on the target's ships in that zone | 25 % | virtue −20, 1.5 M$ fine |
| corruption (port, corruption > 0.15) | `400 k + 600 k × (1 − corruption)` | 90 d | 75 % of the target's calls held 6–14 days; lawyer `40 k + 9 k/day` frees in 24 h | 20 % | virtue −15, 0.8 M$ |

One deal per target/kind/place at a time. Scandals end the deal and reveal the buyer.

Other shady tools:
- **Poach a shipper** (`poachClient`): `(150 k + 60 k × loyalty) × rel/70`; the rival's loyalty → 0,
  its reservations cancelled, yours +2; 15 % leak (virtue −6).
- **Informant** (`buyIntel`, ship in that port): `60 k + 60 k × (1 − corruption)`; reveals plots
  against you (with who) and rival ships carrying parcels.
- **Tip-off** (`tipOff`): rival parcel ship searched at ≥ 80 % for 60 days; informant reward 15 % of
  the fine. The victim hears a rumour and may jettison.

## Rivalry attacks (`ATTACKS`, `orderAttack`)

Always cost virtue (certain), may leak (scandal), the victim gets a rumour with the parry price
(`counterPrice`, `counterPlot`).

| Kind | min level | Days | Virtue | Leak | Price | Effect | Parry |
|---|---|---|---|---|---|---|---|
| sabotage (ship docked in shady port needed) | 1 | 45 | −3 | 25 % | 250 k + 1.5 % ship value | −12…−22 condition at next call (2–6 days), min 25 | guards 1 month (0.8 % value) |
| payments (you must be the shipper's loyal partner) | 2 | 90 | −2 | 20 % | 200 k | target's payments from that shipper delayed 40–75 days | collection agency 100 k |
| bank (target level ≤ yours) | 3 | 180 | −4 | 30 % | max(300 k, 0.6 % fleet) | credit limit ×0.5 | other bank 100 k + 1 % debt |
| pricewar (port) | 2 | 60 | −2 | 15 % | 300 k + 80 k × size | target paid 20 % less there | 50 % of price |
| smear | 2 | 56 | −3 | 30 % | 250 k + 1 k × target trust | −1 trust and virtue per week | 150 k |
| crew (target crew with XP, your ship receives) | 1 | 14 | −2 | 20 % | 120 k + 60 k × points | target crew −1 point after 7 days, yours gains | 80 k × points |

("min level" is the office level shown to players, 1-based; code uses 0-based `minLevel`.)
Each move counts toward "Le marionnettiste" and records `lastAttack` on the victim (→ "Le fossoyeur"
if it goes bankrupt within a year).

## Takeovers (`TAKEOVER`)

```
price = max(1 M$, netWorth(target)) × (1 + trust(target)/50) × (1 − hub discount)
blacklisted target, clean buyer: dismantle only, × 2 (dismantleK), no premium
```

Conditions (`canTakeover`): buyer level ≥ target level; no reprieve running; no other pending bid;
**net cash** ≥ price (+ embargo fine for a hub buying an embargoed company, see [03](03-home-ports.md));
a blacklisted buyer can only buy blacklisted companies.

- AI target: immediate. Human target: 30-day bid (`makeBid`); executes if still valid. The target can
  accept, or ask for six months (`askReprieve`, once per bid, odds
  `clamp(0.3 + trust × 0.006 (blacklisted: + min(0.6, infamy × 0.005)) − 0.25 × previous reprieves, 0.05, 0.95)`).
- Humans are warned whenever a rival becomes able to buy them (`takeoverDaily`), with how to protect
  themselves (higher trust, higher level, faster-growing net worth).
- Execution: buyer pays price, takes target cash and debt, ships, orders, contracts, payments,
  receivables, shipper loyalties (best of both), ports served, lender track records; trust/virtue
  blend toward the target weighted by fleet value (50 %); infamy inherited (weighted). Plots and bids
  involving the target end. Target eliminated (buyer credited as "fossoyeur").
- Dismantle: buyer pays, target fleet scrapped, company gone.
- Preview (`takeoverPreview`) shows resulting scores and infamy (warned if it would cross the
  blacklist line).

AI (`aiTakeover`, monthly day 20, 30 % chance, conqueror 60 %): keeps a cash reserve (×1.3, conqueror
×1.1), pays at most 1.8× net worth (conqueror 2.9×), skips purchases that would blacklist it, only
dismantles a shadow fleet after the official 75 % shadow-victory alert (or if conqueror), hub
embargo buys only for the last rival or as shadow AI.

## AI plots (`aiPlots`, monthly day 15)

Parries anything it can afford ×8 (60 %). Vertueux never attacks. Needs cash ≥ 2.5 M$. Target:
conqueror → cheapest prey at or below its level; others → the rival closest to a victory (≥ 60 %),
else the richest if ≥ 80 % of its own worth. 5 % shady deal (if it has a ship in/to a shady port),
4 % poach, 6 % attack (conqueror 18 %), each only if cash > 3–4× price.
