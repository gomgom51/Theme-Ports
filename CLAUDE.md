# Port d'Attache — design rules for this project

This is a **management game**. Balance and player agency come before realism.
Every design or balancing choice must be checked against these rules (set by the
project owner):

1. **No hidden crucial risks.** The player must never suffer a major negative
   outcome from a risk they could not know about. Every risk that can hurt
   (incidents, sinking, insurance refusal, inspections and detentions, spoilage,
   bank seizure, market downturns) must be visible *before* the decision that
   exposes the player to it: show the probability or level, the consequence,
   and how to avoid it (repair, choose another port, slow down…).
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

## Balance checklist (run before committing economy changes)

- `node tests/fleet.test.mjs` — every ship model profitable in a normal market.
- `node tests/strategies.test.mjs` — no strategy dominates across seeds; each
  one wins in some markets.
- `node tests/sim.test.mjs 3 12345` and a 10-year run — no NaN, AI neither
  runaway nor wiped out.
- Tuning knobs: `BALLAST` / `BALLAST_HOLD` / `FREIGHT_*` in
  `web/js/sim/economy.js`, `RISK` and rates in `web/js/sim/incidents.js`.

## Conventions

- In-game text is French; code comments in French.
- Vanilla JS ES modules, no build step (`web/`), Android WebView wrapper in `android/`.
- Original game only: never reuse the name, art, music or screens of
  *Ports of Call*; keep only the general mechanics.
