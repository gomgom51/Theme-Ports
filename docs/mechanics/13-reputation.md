# 13 · Reputation: trust 🤝, virtue 💚, infamy

File: `sim/core.js` (`standing`, `changeTrust`, `changeVirtue`, `changeReputation`, `earnTrust`,
`earnVirtue`, caps, `STANDING`, `VIRTUE_SOURCES`, `slowVirtue`, `oilVirtueLoss`; trust vs rivals: `TRUST`,
`trustTarget`, `onTimeTrust`, `rivalsGap`, `closeTrustQuarter`), `honours.cleanConduct`.
UI: ★ next to the cash (limiting score in red), monthly summary `ui/standing.js`. Office → Company shows ★ with a
flavour line per reputation band (`repQuote` in `ui/reputation.js`), today's effects of each score (the trust card
starts with the target and "more / less reliable than the market") and, below, the quarterly trust report
(`trustReportBox`); Guide → Réputation holds the cause-by-cause breakdown (this month / last month), the explanation
cards and today's target with its parts.

## The two scores

- **Trust** (`company.confidence`): can you be counted on. The **whole economy reads trust only**.
- **Virtue** (`company.virtue`): the greater good / press image. Reads: reputation victory, image
  shippers' pay, inspection odds in image ports.
- **Reputation** (`company.reputation`) = min(trust, virtue); only judges the reputation victory.
- Start: both = `FLAGS.rating × 0.5 + 25`. Relocation blends 30 % toward the new flag base.
- Caps: `min(100 − min(80, infamy), REP_BASE_CAP 95 + min(5, deeds))`. Deeds raise the cap (and
  both scores) by 1 each, for the first five.
- `earnTrust` / `earnVirtue` gains shrink near the top: `× (1 − score/110)`.
- On-time deliveries no longer add a fixed amount: they pull trust toward a target set against the rivals
  (see "Trust vs rivals" below).
- Every change is logged by cause (`standingMonth`) for the monthly summary.

(Do not confuse with `company.trust[port]` = gangs' trust, see [11](11-grey-black-trade.md).)

## Who reads trust

contract `minRep` (`checkContract`), shipper `clientRep`, dispute odds and arbitration (`payments.js`),
credit limit and interest rate (`core.js`), cargo-loan access and LTV (`trade.lenderTerms`),
prospecting odds, takeover price `× (1 + trust/50)`, financial-hub discount, reprieve odds,
AI conqueror prey choice, smear attack price.

## Trust sources

| Event | Δ trust | Where |
|---|---|---|
| On-time contract delivery | 0.025 × (target − trust): up toward the target, or down to it ("retour vers votre cible") | core.onTimeTrust, from game.deliverContract |
| Late delivery | −(2 + 10 × penalty) | game.deliverContract |
| Damaged cargo delivered | −8 × damage | game.deliverContract |
| First call at a port | +0.5 × (1 − trust/110) | game.arrive |
| City tender served | +1.5 (dégressive) | trade.deliverTender |
| Arbitration won / lost | +1 / −1 | payments.dailyReceivables |
| Collision / grounding | −2 | incidents |
| Detention | −3 | game.arrive |
| Out of fuel at sea | −1 | game.sailHour |
| Abandoned contract | −8 | actions.abandonContract |
| Hijacked / ransom negotiated | −3 / −3 more | piracy |
| Sinking | −5, and −10 more with contract cargo | game.sink |
| Bank seizure | −6, −10 more with contract cargo | game.checkBank |
| Takeover | blend toward target (weighted by fleet value, 50 %) | takeover.executeTakeover |
| Deed (first five) | +1 (both) | honours.checkDeeds |
| Smear campaign | −1/week (both) | plots.attackEffects |

## Trust vs rivals (owner's choice, 2026-11-28)

Before, each on-time delivery added +1.5 × (1 − trust/110). Gains grew with the fleet, losses stayed rare, and every
honest company reached the cap of 95 within about eighteen months. Now shippers judge you against the market.

- **Target** = `TRUST.base` 82 + `TRUST.rivals` 300 × (your reliability − market reliability) + bonuses, kept
  between `TRUST.floor` 20 and the trust cap. Each on-time delivery moves trust `TRUST.step` (2.5 %) of the way to
  it. A bigger fleet reaches its target sooner, not a higher one.
- **Reliability** = 1 − slips / deliveries (`company.rel = { d, s }`). Every trust loss from your service counts as
  a slip weighed by its size (`loss / TRUST.slip`, a late delivery ≈ 1, at most `TRUST.maxSlip` 3 for one mishap: a
  wreck is not six late deliveries). Not slips: the drift back to the target, a takeover, a change of flag. Both
  counts fade by `TRUST.memory` (× 0.9) every month: shippers remember about ten months.
- **Small record, cautious judgement**: the gap to the market is weighed by d / (d + `TRUST.prior` 20), as if you
  also had 20 average deliveries. Without it one late delivery cut a two-ship company's target by 15 points
  (rule 3: small fleets must stay viable). A new company starts at the market's level.
- **Market reliability**: all active companies, weighted by their deliveries.
- **Bonuses** (`trustTargetBonuses` in `core.js`, returns `[{ src, value }]`, empty for now): the hook for the
  ship rework (new ships, "future" contracts). Each line is added to the target and shown as its own line wherever
  the target is shown (Guide, quarterly report).
- Tenders served and first calls still add trust directly: they push trust above the target for a while, then
  on-time deliveries bring it back down.
- Measured (16 AI-only games, 5 years): trust settles around 78–80 whatever the fleet size; about one company in
  four passes 90; nobody reaches 95. Until the ship rework adds its bonuses, the reputation victory (100) is out of
  reach.

**Quarterly trust report** (owner's idea): on the first day of each quarter `monthly` calls `closeTrustQuarter`,
which stores `state.trustReport = { t, rows }`: per company the trust, its change over the quarter, reliability vs
the market, the shipper with the most on-time deliveries (`company.trustQ` counts the quarter), and its target with
its parts, frozen at the close. Humans get a `trustReport` note (toast "Voir le rapport" → Office → Compagnie). The
drift back to the target is silent in the top bar (`STANDING_DRIFT`): an on-time delivery never sounds like a fault.

## Virtue sources

| Event | Δ virtue | Where |
|---|---|---|
| Useful goods (cereals, coffee/cacao, fruit/meat, wood) delivered on time | +0.8 dégressive | game.deliverContract |
| Golden deal or tender on clean goods | +2 dégressive | game / trade |
| Emergency aid delivered on time | +6 | dark.charityDelivered |
| Denouncing a dishonest shipper | +2 | clients.reportClient |
| Slow steaming (≤ 95 % of service speed, full at 75 %, × sea days/10) | up to +1.2 dégressive | game.arrive |
| Clean conduct (180 days without grey/black act or spill) | +2.5/month × (1 − v/110) | honours.cleanConduct |
| Forgetting (below 50) | up to +4/month toward 50, whatever you do | honours.cleanConduct |
| Oil loaded ship departs (contract or trade, once per cargo) | −1 × (0.2 + virtue/100) | actions.launch |
| Oil spill | −(2 + liability/10 M$), max −20 | pollution.spill |
| Sanctions fine | −8 | shady.checkSanctions |
| Parcel seized (customs or patrol) | −15 | shady / patrols |
| Bribe success / failure | −2 / −5 more | shady.resolveCase |
| Dark cargo caught | −25 (and infamy +10) | dark.darkOnArrival |
| Abandoning a ship or crew to a gang | −8 | dark.resolveSeized |
| Rivalry attack ordered | −2…−4 (certain) | plots.orderAttack |
| Scandal (plot exposed) | −6…−20 (+ fine) | plots.scandal |
| Poaching leaked | −6 | plots.poachClient |
| Hub buying an embargoed company | −10 + flag blend | takeover.executeTakeover |

Dirty acts that stop clean conduct (`onDirty`): embargo trade, parcel taken/delivered, dark job,
any hostile move. Stains (`onStain`, reset "Sans tache"): late delivery, detention, spill, fine,
seizure, bank seizure.

## Infamy

Dark jobs +15/+15/+20, caught dark cargo +10, takeover inheritance (target infamy × weight).
Permanent. Caps both scores; blacklist at 80; makes "Le Juste" impossible. See [11](11-grey-black-trade.md).

## Design notes (CLAUDE.md)

The economy must read trust only (reading the min crushed every risk-taker). Oil costs virtue so an
oil fleet cannot win the reputation victory. Forgetting below 50 keeps risk-takers alive.

Top bar (`main.js` `hudGauge`, owner's pick): ★ reputation in large, then one 10-cell gauge per score (🤝 trust,
💚 virtue) with a gold tick at its cap (`trustCap` / `virtueCap`), the score (the limiting one in red) and this
month's change (sum of `company.standingMonth`, drift included). Under them, the reputation sentence (`repQuote`)
on one line, cut with "…" and shown whole in the hover bubble when cut; a click opens Office → Compagnie. Under
the cash: what is borrowed (bank debt + cargo loans, split on hover), hidden without debt.

HUD feedback (`main.js` `standingFloats`): each one-off change (any source except the daily drift
`STANDING_DRIFT` = clean conduct, forgetting) is queued in `company.standingPings` (humans only) and
shown at once as a floating "±x 🤝/💚" with its sound (trust: heartbeat / door; virtue: harp up / down),
even under one point. The daily drift stays silent and only floats a number per whole point.
