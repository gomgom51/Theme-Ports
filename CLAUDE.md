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
  infamy reputation cap `repCap` in `web/js/sim/core.js`.
- Lessons (trade): trade estimates must use the price expected on arrival
  (`quoteTradeAt`), or the "best outlet" is a port whose price is momentarily high and
  margins melt; a global `SPREAD` rise mostly helps bulk (widest spreads), so spreads
  are compressed per goods, with liquid bulk kept narrow (huge volumes).
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
- Original game only: never reuse the name, art, music or screens of
  *Ports of Call*; keep only the general mechanics.
