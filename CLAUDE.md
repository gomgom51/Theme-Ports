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

Do **not** fine-tune balance until the game is fully featured: balancing
something that new features will unbalance is wasted work. Only fix glaring
problems (runaway growth, a mechanic that always loses) along the way.
Intended strengths to preserve: general cargo ships (small, flexible holds)
will be the best tools for grey and black trade.

Feature order agreed with the owner: 50 ports → pollution → grey/black trade
→ equipment → piracy (simple: defence vs boarders → result) → full balance pass.

### Balance checklist (for the final pass, and for glaring issues)

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
