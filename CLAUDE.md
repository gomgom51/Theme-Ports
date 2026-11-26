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
  ordinary reputation cap `REP_BASE_CAP`, clean-conduct virtue gain `STANDING` and virtue sources `VIRTUE_SOURCES` in `core.js`, takeovers (`TAKEOVER`: price = net worth × (1 + reputation / 50),
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
- Reputation (owner's design): two scores, to make the reputation victory harder. Trust 🤝 (`confidence`): you can be
  counted on — the whole economy reads it (premium contracts, shippers' requirements, disputes, credit, cargo loans,
  prospecting, takeover price): on-time deliveries, golden deals and city tenders served, new ports; late or damaged
  cargo, detentions, running dry, abandoned contracts, wrecks, lost disputes, hijacks. Virtue 💚 (`virtue`): the
  greater good, or at least the press image ("you cannot win just by being efficient") — emergency aid, reporting
  dishonest shippers, useful goods (cereals, coffee and cacao, fruit and meat, wood), golden deals and tenders on cargo
  neither fossil nor polluting, slow steaming (bonus shown under the speed slider), a slow monthly gain for clean
  conduct and, below 50, forgetting; oil spills, smuggling, embargo fines, bribes, dark jobs, dirty tricks and scandals
  lower it. Reputation = the lower of the two; it only judges the reputation victory (and shows as ★ next to the cash,
  the limiting score in red). Infamy caps both scores (the price of dark jobs). A smear campaign hits both.
  Virtue does reach the economy through a few image-minded actors only: six customers (`CLIENTS.image`, one of
  them an oil major polishing its window) pay from −6 % at virtue 0 to +12 % at 100 (`IMAGE_PAY` in `clients.js`,
  shown on the contract, fixed at signing), and image-minded ports (`IMAGE_PORT_FLAGS`: NL, DE, FR, CA, AU, SG, JP)
  scale the chance of inspecting a worn ship from ×1.3 at virtue 0 to ×0.6 at 100 (`INSPECT_VIRTUE` in
  `incidents.js`, shown in the departure risks); detention once inspected still depends only on the ship.
  Carrying oil (crude, refined) costs virtue on every delivery (`VIRTUE_SOURCES.oil`), so an oil fleet cannot win the
  reputation victory; and a world event, the global refinery crisis (weight 1.5 in `EVENTS`, about one every 18 months,
  2 to 4 weeks: `OIL_CRISIS` in `events.js`), removes every oil contract and tender outside embargoed countries
  (signed contracts honoured), announced with its end date in the news, the important notifications and the tankers'
  Contracts tab. Owner's call to make tankers less of a safe default (they led the strategy test in every run).
  `company.trust` is something else: the gangs' trust, port by port (`dark.js`). Knobs: `STANDING`, `VIRTUE_SOURCES`
  in `core.js`; `FOSSIL_GOODS`, `USEFUL_GOODS` in `data/goods.js`.
- Home port bonuses (owner's design, to help the least played victories; `HOME` in `web/js/sim/home.js`): a shadow port
  (smugglers' port of an embargoed country: Bandar Abbas, Puerto La Cruz, Novorossiysk, Nampo) has gang trust from day
  one, home customs × 0.3, refusals at home without grudge or seizure, and up to 3 parcels on offer; a financial hub
  (the 8 size-5 ports) cuts takeover prices by 0 % at trust 50 up to 25 % at trust 100. Shown on the home-port picker,
  Office → Company and the relocation list; AI leanings follow the home port (shadow port → shadow AI, hub → conqueror).
  A winter port (Murmansk, Valdez, Ust-Luga, Gdańsk, Hamburg and the four seasonal ports, now pickable as home) fits a
  free ice-class hull on every ship bought (`winterKit`); a seasonal home port, frozen at the January start, puts the
  first ships and contracts in the nearest open port (`START_PORT`), and the AI never starts there.
  Owner's rules (round 2): a company based in a financial hub that buys a company based in an embargoed country pays a
  fine (half the price, at least 5 M$, `HOME.embargoFine*`) and is expelled: its head office moves to the bought
  company's port (warned on the rival card and in the confirmation; the AI does it only for its very last rival, or as a
  shadow AI); other buyers buy normally. Embargoed countries keep their dear bank, but a shadow lender is an opt-in
  alternative (Office → Finances): `SHADOW_LENDER` rate (8 %) while 2 discreet parcels are delivered every 6 months,
  else the bank rate until the quota is caught up (alert 45 days ahead; the shadow AI opts in). "Family first" ports
  (Buenos Aires, Luanda, Lagos, Cartagena, Veracruz, Arzew, Durban, Richards Bay, Djibouti: the flags that lost on every
  axis) always hold a reserved contract fitting the home company's free ship (`familyContract`, made as soon as the ship
  is free there), never offer anything to its biggest competitor by net worth (no contract, no prospecting, shown on
  its screens), and sell goods 5 % cheaper to the home company.
  Map: a ring in each company's colour around its home port, and a house pin over yours.
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
  out, risk at arrival) appears before the decision. Notifications (owner's call): one global freeze and one global thaw
  event when `ICE.season` (80 %) of the seasonal ports have changed, not one per port (each port still goes to the
  news); the 14-day announcement only alerts companies with a ship at, bound for, or planned for that port. The Northern Sea Route is only routed
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
  legend 1 (same seeds: a shadow fleet that used to win at 9 years is now dismantled first, a legend at 13.5 years slips past 14). After the trust/virtue split (economy on
  trust, virtue for the reputation victory, image customers and ports): 9 won, median 9.9 years, 5 before year 10;
  reputation 5, shadow 3, legend 1. Population: median ×36, bottom 10 % ×9.6, no bankruptcy, 13 bought (mostly shadow
  fleets). Strategies: tankers 8, liners 4, cargos 2, bulk 2 (tankers led in every run since the split: watch rule 3).
  First tries with the economy reading the minimum of the two scores crushed every risk-taker (bottom 10 % ×2.5,
  conquerors bought in 13 of 16 games): the economy must read trust only. With oil costing virtue: victories 4 of 16, median
  13.3 years, reputation 1 (the virtuous AI carries oil like everyone, so it rarely gets there; a human chasing that
  victory would avoid oil); strategies tankers 7. With the refinery crisis (2 to 4 weeks): victories 6, median 9.8
  years (legend 3, shadow 2, reputation 1); strategies tankers 7, bulk 5, liners 3, cargos 1, tanker median ×57 → ×50
  (a short crisis trims tanker income but does not change which strategy tops a market). Then the virtuous AI avoids oil
  (35 % of an oil job's revenue counted as an image cost, no oil or chemical tankers bought: `VIRTUOUS_OIL_PENALTY` in
  `ai.js`), as a human chasing that victory would: victories 7 of 16, median 9.5 years, 5 before year 10; reputation 3,
  legend 3, shadow 1 — no path dominates (reputation was 5–6 before the split). One shadow AI went bankrupt. A shadow fleet that survives wins; its survival hinges on
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
- End credits (`web/js/ui/credits.js`): film-style roll on `musique/generique.mp3`, every game animation fading in
  and out around it (captions use the player's own figures), after the victory screen and from the title screen.
  `AUTHOR` holds the name shown for the author; add a scene to `NOT_ALONE` if it cannot draw without game data.
- Original game only: never reuse the name, art, music or screens of
  *Ports of Call*; keep only the general mechanics.
