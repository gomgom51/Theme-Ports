# 13 · Reputation: trust 🤝, virtue 💚, infamy

File: `sim/core.js` (`standing`, `changeTrust`, `changeVirtue`, `changeReputation`, `earnTrust`,
`earnVirtue`, caps, `STANDING`, `VIRTUE_SOURCES`, `slowVirtue`, `oilVirtueLoss`), `honours.cleanConduct`.
UI: ★ next to the cash (limiting score in red), monthly summary `ui/standing.js`. Office → Company shows ★ with a
flavour line per reputation band (`repQuote` in `ui/reputation.js`) and today's effects of each score; Guide → Réputation
holds the cause-by-cause breakdown (this month / last month) and the explanation cards.

## The two scores

- **Trust** (`company.confidence`): can you be counted on. The **whole economy reads trust only**.
- **Virtue** (`company.virtue`): the greater good / press image. Reads: reputation victory, image
  shippers' pay, inspection odds in image ports.
- **Reputation** (`company.reputation`) = min(trust, virtue); only judges the reputation victory.
- Start: both = `FLAGS.rating × 0.5 + 25`. Relocation blends 30 % toward the new flag base.
- Caps: `min(100 − min(80, infamy), REP_BASE_CAP 95 + min(5, deeds))`. Deeds raise the cap (and
  both scores) by 1 each, for the first five.
- `earnTrust` / `earnVirtue` gains shrink near the top: `× (1 − score/110)`.
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
| On-time contract delivery | +1.5 × (1 − trust/110) | game.deliverContract |
| Late delivery | −(2 + 10 × penalty) | game.deliverContract |
| Damaged cargo delivered | −8 × damage | game.deliverContract |
| First call at a port | +0.5 | game.arrive |
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

HUD feedback (`main.js` `standingFloats`): each one-off change (any source except the daily drift
`STANDING_DRIFT` = clean conduct, forgetting) is queued in `company.standingPings` (humans only) and
shown at once as a floating "±x 🤝/💚" with its sound (trust: heartbeat / door; virtue: harp up / down),
even under one point. The daily drift stays silent and only floats a number per whole point.
