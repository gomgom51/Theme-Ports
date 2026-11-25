# Port d'Attache — design rules for this project

This is a **management game**. Balance and player agency come before realism.
Every design or balancing choice must be checked against these rules (set by the
project owner):

1. **No hidden crucial risks.** The player must never suffer a *major setback*
   (losing a ship, an uninsured loss, a detention, a seizure, a large fine or
   claim) from a risk they could not know about. Such risks must be visible
   *before* the decision that exposes the player to it: show the probability
   or level, the consequence, and how to avoid it. Small speed bumps from time
   to time (a short breakdown, a minor delay) are fine without warning.
   Critical information scattered across ships and ports is gathered in the
   **important notifications** panel.
2. **No forced chores.** Don't make the player do things they don't want to
   do. When the game imposes a consequence, offer a choice in how to face it
   (e.g. a detained ship can be repaired or sold on the spot).
3. **No dominant strategy.** Several strategies must stay viable (small
   flexible ships, bulk, tankers, containers, giants, old cheap ships vs new
   ones, contracts vs trading, different home ports), with none clearly
   championing the others. Context-dependent opportunities are good: a strategy
   may shine in a given market phase or region, as long as no option is always
   the most efficient play.
4. **Choices, not traps.** Options that look attractive must carry visible
   trade-offs (cheap old ship = more incidents, more repairs, inspections).

## Balance

Do **not** balance while features are being built: balancing something that
new features will unbalance is wasted work, and the features themselves will
be the tuning tools. During development, only check correctness (no crash, no
NaN, the simulation runs, saves load). Balance is tested and tuned once, at the
end, with the tools below.
Intended strengths to preserve: general cargo ships (small, flexible holds)
will be the best tools for grey and black trade.

Feature order agreed with the owner: 50 ports → pollution → grey/black trade
→ equipment → piracy (simple: defence vs boarders → result) → full balance pass.

### Balance tools (final pass only — not run in CI)

- `node tests/fleet.test.mjs` — every ship model profitable in a normal market.
- `node tests/strategies.test.mjs` — no strategy dominates across seeds; each
  one wins in some markets.
- `node tests/sim.test.mjs 3 12345` and a 10-year run — no NaN, AI neither
  runaway nor wiped out.
- `node tests/victories.test.mjs 13 1,2,…` — AI-only games (one company per leaning) stopped at the first
  victory: when it comes and which path wins (target below).
- Tuning knobs: `BALLAST` / `BALLAST_HOLD` / `FREIGHT_*`, `SPREAD` (trade
  margins), `CYCLE` (freight cycle amplitude), `AGING` (used-ship depreciation,
  ageing costs), `AI_FLEET` (AI fleet cap) in `web/js/sim/economy.js` (all
  mirrored in `TUNING` for test sweeps); `RISK` and rates in
  `web/js/sim/incidents.js`; flag `tax` / `crew` in `web/js/data/ports.js`;
  shippers (`RESERVE_*`, `DENOUNCE_HIT`, `AI_DENOUNCE`, `GRUDGE_DAYS`, `GRATITUDE`,
  `clientDemand`) in `web/js/sim/clients.js`; shady deals (`PIRATE_*`, `HELD_CHANCE`,
  `EXPOSE`, `SCANDAL`, prices, `AI_PLOT_CHANCE`, `AI_POACH_CHANCE`) in `web/js/sim/plots.js`;
  per-goods trade spread `goodSpread` and `GOLDEN_CHANCE` in `economy.js`; crew skill
  effects and `XP_STEPS` in `web/js/sim/crew.js`; ice (`ICE`: announcement delay,
  ice-class extension, icebreaker escort fees, end-of-season contract premium,
  Northern Sea Route safety horizon) in `web/js/sim/ice.js`, seasonal windows (`ice` on
  ports in `web/js/data/ports.js`, `ICE_PASSAGES`), Arctic fee `CANAL_FEE.nsr` in `economy.js`;
  dark jobs and pro bono (`DARK`, `DARK_KINDS` pay/infamy, `CHARITY`) in `web/js/sim/dark.js`,
  infamy reputation cap `repCap` in `web/js/sim/core.js`; city tenders (`TENDER`: frequency, premium as a multiple of
  the good's natural spread with a floor and a cap, quantity, duration) and cargo financing (`FINANCE`: share lent and rate per port profile, destination bonus, track record,
  60-day term, late and early-repayment fees, exposure cap = half the net worth) in `web/js/sim/trade.js`; AI opportunity
  cost of cash locked in cargo `AI_CAPITAL_COST` and the largest possible embargo fine it accepts `EMBARGO_FINE_MAX`
  (share of net worth) in `web/js/sim/ai.js`; prospecting for shippers (`PROSPECT`: duration,
  odds per port size / reputation / loyalty / office / negotiation skill, lead share and range, pay) in
  `web/js/sim/prospect.js`; victories (`VICTORY`: alert steps, reputation level and deed count, legend record count,
  shadow years and fleet) in `web/js/sim/victory.js`, deed and record thresholds (`HONOURS`) in `web/js/sim/honours.js`,
  ordinary reputation cap `REP_BASE_CAP` and clean-conduct virtue gain `STANDING` in `core.js`, takeovers (`TAKEOVER`: price = net worth × (1 + reputation / 50),
  30-day offer, six-month reprieve odds, AI ratios and margins) in `web/js/sim/takeover.js`, rivalry moves (`ATTACKS`:
  cost, certain reputation loss, scandal odds, effects, parry prices; `AI_ATTACK_CHANCE`) in `web/js/sim/plots.js`,
  blacklist (`BLACKLIST`: infamy line, warning, shadow bank) in `web/js/sim/shadow.js`, AI leanings (`AI_LEANINGS`,
  `AI_BUILDER_FLEET`) in `web/js/sim/ai.js`.
- Lessons (trade): trade estimates must use the price expected on arrival
  (`quoteTradeAt`), or the "best outlet" is a port whose price is momentarily high and
  margins melt; a global `SPREAD` rise mostly helps bulk (widest spreads), so spreads
  are compressed per goods, with liquid bulk kept narrow (huge volumes).
- Lesson (trade, owner's playtest): plain arbitrage between exporters and importers barely pays at a realistic
  budget, outside embargoed countries. Trade lives on city tenders (fixed price, first come first served, rival
  commitments announced with their ETA) and cargo loans that let a small company fill a hold. No guaranteed
  price: trading keeps its risk. A tender's free quantity subtracts every other ship's commitment (own fleet
  included), and a ship commits as soon as its departure is planned, or several ships chase the same lot.
  A tender premium must follow each good's natural spread (`GOODS.spread`): a flat 10–26 % made dear goods
  (machines, manufactured goods) a fortune for small general cargo ships, which then won 8 of 16 strategy markets
  while bulk won none. Leverage needs a cap (total cargo loans ≤ half the net worth) and the AI must charge itself the opportunity cost of
  cash locked in cargo (`AI_CAPITAL_COST`), or it trades instead of buying ships: fleets stall, a few AIs
  become near-zero zombies and the richest snowball. Compare variants on the same seeds: any change to the
  random stream reshuffles single-seed results.
- Lessons (AI, balance pass after tenders and financing): every AI decision that can touch an embargoed port must
  check `avoidsEmbargo` and price `embargoCost`, including "sell here or carry the goods elsewhere" for cargo already
  on board. That branch once ignored it, and enforcing-flag AIs (US, NL, GR) detoured to Iran and Russia for a better
  price, then paid fines of up to 12 M$: it hid half the growth and caused the only bankruptcy. A possible fine larger
  than `EMBARGO_FINE_MAX` × net worth is refused. Laid-up ships must come back when freight recovers, even for a
  company with little cash (reactivation needs only its cost plus a small buffer), and a ship laid up for over a year
  is sold while the company is in debt, or small fleets die at the quay.
- Victories (owner's design, "civilization approach"): the time limit still decides if nobody wins.
  Sole master on board (every rival ruined or bought; "in sight" once a single rival is left and the leader holds half,
  then four fifths, of its takeover price in net cash — the last rival gets its own warning), the most respected (reputation 100: ordinary gains stop at 95,
  each of the first five of eight deeds raises the cap by one; level 4; then held six months without falling below 95,
  so rivals warned at 75–90 % have a window to strike), legendary (hold 5 of 8 exclusive records;
  numbered records can be broken, "complete" ones stay with the first), shadow fleet (years on the international
  blacklist with a fleet and a dark job in every embargoed country). Everyone sees everyone's progress (Office →
  Victories) and is warned at 75 % and 90 % (rule 1). Deeds are badges, records are trophies on the office shelf
  (award scene), misdeeds are grim proofs on a dark side table; a blacklisted company's office turns ostentatious
  (night outside, velvet, chandelier, gold bust, full safe: `officeSVG` option `shadow`). Office levels are sticky (company maturity) and gate
  takeovers (buy only a company of your level or below), the reputation victory, and bank pressure.
- Takeovers: paid from net cash (cash − debt − cargo loans), never borrowed. A human target gets a 30-day offer, can
  ask for six months (odds from reputation) and is warned whenever a rival can afford it. A blacklisted company can only
  be bought to be dismantled (fleet scrapped) at twice its net worth (shell companies), its reprieve odds follow its
  infamy, and AIs only move against it after the official 75 % warning: at net worth with no premium, a pariah was the
  cheapest buy and every shadow fleet was absorbed within three years. Inherited infamy that would cross the
  blacklist line is shown before buying. A blacklisted buyer can only buy another blacklisted company (the
  authorities would block the sale); against clean rivals its only road to domination is ruin, which is how the
  gravedigger misdeed reaches a shadow fleet (a bankruptcy is credited to the last rival that attacked within the year).
- Reputation (owner's design): reputation = the lower of two scores, so nobody can max just one. Trust 🤝 (`confidence`:
  you can be counted on — on-time deliveries, new ports; late or damaged cargo, detentions, running dry, abandoned
  contracts, wrecks, lost disputes, hijacks) and virtue 🕊 (`virtue`: the greater good — emergency aid, reporting
  dishonest shippers, a slow monthly gain for clean conduct, `STANDING` in `core.js`; oil spills, smuggling, embargo
  fines, bribes, dark jobs, dirty tricks). Everything that reads reputation reads that minimum (contracts, credit,
  cargo loans, shippers, takeover price, victory); infamy caps virtue only; a smear campaign hits both. `company.trust`
  is something else: the gangs' trust, port by port (`dark.js`). The HUD shows ★ reputation next to the cash with both
  scores, the limiting one in red (rule 1), and a refused contract names the score that blocks it.
- Rivalry moves always cost reputation (word gets around), may leak (scandal), and the victim always hears a rumour with
  the parry price; AIs parry when cheap and aim at the rival closest to a victory (conquerors at their cheapest prey).
- Blacklist (infamy 80): enforcing ports closed, shadow bank only (half the credit, +15 points), but shady ports'
  shippers ignore reputation (the shadow network) — without it a blacklisted company starves. Warned at 60, and before
  any dark job that would cross the line (including the +10 if customs find the cargo).
- Lessons (victory tuning): non-exclusive deeds are the easiest path (nobody can take them from you), so their
  thresholds sit high; a shadow AI must ignore its flag's embargo stance, seek dark ports, avoid gang grudges and refuse
  jobs over 22 % customs risk, or it either never gets dark jobs or loses its fleet to seizures; an AI with no ship
  must be allowed to buy one despite its debt, or it idles forever.
- Lesson (shippers): a client's loyal-partner reservations must be extra offers on
  top of a port's contract pool, never take its slots, or idle fleets pile up.
- Ice (rule 1): freeze/thaw dates are random each year but the window is always shown,
  the exact date is announced `ICE.announce` days ahead, and every ice cost (escort in or
  out, risk at arrival) appears before the decision. The Northern Sea Route is only routed
  when safe (never a gamble); seasonal ports may be a gamble, with the risk shown.
- Dark jobs (owner's choice: "insane advantage, but tarnish forever"): very high pay is
  balanced by permanent infamy (reputation cap → fewer premium contracts, dearer credit),
  tougher customs (impoundment), seizure risk on refusal (ransom or abandon, rule 2) and
  a gang grudge shown on the map. People smuggling, not human trafficking (store policies).
  Aftermath news never names real groups. Winks at real brands only on reliable shippers.
- Map/routing: `tools/build_world.mjs` opens three Arctic corridors north of 66° N
  (Barents–Kara, Northern Sea Route marked as canal `nsr`, Chukchi–Beaufort); the rest
  stays pack ice. Distance tables store closed-passage cases as diffs.

### Final balance pass (done) — results to preserve

- AI population, 5 years, 96 companies: median ×8 net worth, bottom 10 % ≈ ×1,
  no bankruptcy; every home port viable (Houston/US flag lowest, ×3–8 median).
  After the owner's 6-hour playtest ("money is slow"), deliberately faster: median
  ≈ ×19, bottom 10 % ≈ ×4, best ≈ ×54, Houston ×13 (trade, golden deals, crew skills).
  Strategies then: bulk 8, liners 4, tankers 3, cargos 1 over 16 seeds; fleet OK.
- 10 years: all AIs survive, growth turns linear once the fleet cap is reached.
- Strategies over 16 seeds: bulk 7 wins, tankers 5, liners 3, cargos 1 (cargos'
  edge is grey/black trade, which the test bots barely use); medians ×13–24.
- Fleet test: every model profitable.
- After tenders, cargo financing and prospecting (5 years, 96 companies): median ×29, bottom 10 % ×6.7, best ×85,
  no bankruptcy; Houston (US flag) lowest at ×19, Singapore highest at ×46. Faster than before (×19): trade now
  pays, as the owner asked, and cash-rich companies fill every hold once their fleet is capped. No trade knob
  slows it much (tender premium, loan share, exposure cap, `SPREAD` each move it by less than the seed noise);
  `BALLAST` 1.6 gives ×26 but drops the bottom 10 % to ×3. Strategies over 16 seeds: tankers 7, liners 5,
  cargos 2, bulk 2, medians ×36–61. Fleet test OK. 10 years: all AIs survive, linear growth once capped.
- Victories (16 AI games, 14 years, one company per leaning): 10 games won, median first victory 9.5 years, 7 before
  year 10; reputation 5, shadow fleet 3, legend 2 (owner's call: shadow felt weak, reputation too resilient, fixed with
  the six-month hold, shell companies, 7 years / 16 ships on the blacklist); domination is the hardest (conquerors
  usually eliminate one rival, never all three). After the new Clean Seas (no polluting cargo for 4 years) and the rule that a
  blacklisted buyer can only buy blacklisted companies: 9 won, median 9.5 years, 6 before year 10; reputation 6, shadow 2,
  legend 1 (same seeds: a shadow fleet that used to win at 9 years is now dismantled first, a legend at 13.5 years slips past 14). A shadow fleet that survives wins; its survival hinges on
  `TAKEOVER.dismantleK` (×1 → 2 wins, ×1.5 → 2, ×2 with 6 years → 6, ×2 with 7 years → 3). With leanings: population survivors median
  ×27, bottom 10 % ×10, no bankruptcy; most shadow fleets are bought or dismantled within five years. Strategies over
  16 seeds (neutral leanings, victories off): tankers 5, cargos 4, bulk 4, liners 3. Fleet test OK.
- Lessons: used-ship prices must follow earning power (slow `AGING.dep`),
  otherwise cheap old hulls give runaway returns; the AI must price expected
  embargo fines (it now does, `embargoCost` in `ai.js`) or it bleeds billions.

## Conventions

- In-game text is French; code comments in French.
- English option: French stays the source language in the code. `web/js/i18n.js`
  translates every French text as it reaches the screen (DOM text nodes and
  title/aria-label attributes via a MutationObserver; map canvas labels via `tr()`),
  using the dictionary `web/js/i18n/en.js` (French text → English, `{0}` for
  variable parts, which are translated recursively). Whenever you add or change a
  French UI/news text, add its English entry, then run `node tools/i18n-extract.mjs`
  to list texts still missing a translation (proper names need none). Mark an
  element `data-no-tr` to leave it untouched.
- Vanilla JS ES modules, no build step (`web/`), Android WebView wrapper in `android/`.
- Guided tour (`web/js/ui/guide.js`): bubbles point at real buttons through stable markers
  (`data-guide="buy|accept|dest|sail|collect"`, panel tabs' `data-tab`, rail `data-panel`).
  Keep these attributes when reworking those buttons, or the tour silently loses its targets.
- Original game only: never reuse the name, art, music or screens of
  *Ports of Call*; keep only the general mechanics.
